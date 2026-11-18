import * as THREE from 'three';
import type { Engine } from '../engine/Engine';
import type { Actor } from '../engine/Actor';
import type { ActorDoc, EnvDoc, Weather, Season } from '../engine/types';
import { getDef } from '../assets/catalog';
import { eats } from '../assets/foodweb';
import { compileScripts, type HatInstance, type ScriptFactory } from './compile';
import { COLORS } from './context';
import { animalCallFor, playSound, setVolume, speak, stopSpeech } from './sound';
import { clamp, uid } from '../engine/util';

const STOP = Symbol('stop');
const DEG = Math.PI / 180;

interface Thread {
  id: number;
  actorId: string; // '' = world
  hat: HatInstance;
  cancelled: boolean;
  done: boolean;
  sliceStart: number;
  redraw: boolean;
  promise?: Promise<void>;
}
interface Snapshot {
  actors: Map<string, { pos: THREE.Vector3; rotY: number; scale: number; visible: boolean; lift: number; label?: ActorDoc['label']; params: string }>;
  env: EnvDoc;
}

export class ScriptRuntime {
  running = false;
  time = 0;
  /** duration of the last frame, used to move things at real-time speed */
  dt = 1 / 60;
  timerStart = 0;
  private threads = new Set<Thread>();
  private waiters: (() => void)[] = [];
  private factories = new Map<string, ScriptFactory | null>(); // owner actor id ('' = world) → factory
  private hats = new Map<string, HatInstance[]>(); // instance id (actor/clone/world) → hats
  private nextId = 1;
  private snapshot?: Snapshot;
  private everyTimers = new Map<HatInstance, number>();
  private touching = new Map<HatInstance, boolean>();
  private wasNight = false;
  shared = new Map<string, unknown>();
  answerText = '';
  keysDown = new Set<string>();
  energy = new Map<string, number>();
  hold = new Map<string, number>(); // actor id → time until which ambient life is paused
  temps = new Set<string>();
  highlightOwner: string | null = null;
  onHighlight?: (blockId: string) => void;
  onAsk?: (question: string, who: string) => Promise<string>;
  onCaption?: (text: string, secs: number) => void;
  onError?: (who: string, message: string) => void;
  onState?: () => void;

  constructor(public engine: Engine) {
    engine.runtime = this;
  }

  /* ---------------- lifecycle ---------------- */
  private compileAll() {
    this.factories.clear();
    const errors: string[] = [];
    for (const a of this.engine.actorList) {
      if (a.isClone || !a.doc.scripts) continue;
      const r = compileScripts(a.doc.scripts, { highlight: true });
      if (r.error) errors.push(`${a.name}: ${r.error}`);
      this.factories.set(a.id, r.factory);
    }
    if (this.engine.doc.worldScripts) {
      const r = compileScripts(this.engine.doc.worldScripts, { highlight: true });
      if (r.error) errors.push(`World: ${r.error}`);
      this.factories.set('', r.factory);
    }
    for (const e of errors) this.onError?.('Compile', e);
  }

  private instantiate(instanceId: string, owner: string) {
    const f = this.factories.get(owner);
    if (!f) return;
    try { this.hats.set(instanceId, f()); } catch (e) { this.onError?.(this.who(instanceId), (e as Error).message); }
  }

  /** start everything: snapshot, compile, fire green-flag hats */
  start(fireStart = true) {
    if (this.running) this.stop();
    const e = this.engine;
    this.snapshot = {
      actors: new Map(e.actorList.map((a) => [a.id, { pos: a.root.position.clone(), rotY: a.root.rotation.y, scale: a.root.scale.x, visible: a.root.visible, lift: a.lift, label: a.doc.label ? { ...a.doc.label } : undefined, params: JSON.stringify(a.doc.params) }])),
      env: JSON.parse(JSON.stringify(e.env)),
    };
    this.running = true;
    this.time = 0;
    this.timerStart = 0;
    this.shared.clear();
    this.energy.clear();
    this.hold.clear();
    this.everyTimers.clear();
    this.touching.clear();
    this.wasNight = e.skyState.night > 0.5;
    this.compileAll();
    this.hats.clear();
    for (const a of e.actorList) if (this.factories.get(a.id)) this.instantiate(a.id, a.id);
    if (this.factories.get('')) this.instantiate('', '');
    e.startPlay();
    if (fireStart) this.fire('dd_when_start');
    this.onState?.();
  }

  stop() {
    if (!this.running) return;
    for (const t of this.threads) t.cancelled = true;
    this.threads.clear();
    const w = this.waiters; this.waiters = [];
    w.forEach((fn) => fn());
    stopSpeech();
    const e = this.engine;
    // remove clones & spawned things
    for (const id of this.temps) e.removeActor(id, false);
    this.temps.clear();
    // restore
    const snap = this.snapshot;
    for (const a of e.actorList) {
      const s = snap?.actors.get(a.id);
      a.clearBubble();
      a.forcedClip = null;
      a.clipSpeed = 1;
      a.holds.clear();
      a.scripted = false;
      if (a.tinted) a.setTint(null);
      a.setGlow(null);
      a.setOpacity(1);
      if (s) {
        a.root.position.copy(s.pos);
        a.root.rotation.y = s.rotY;
        a.root.scale.setScalar(s.scale);
        a.root.visible = s.visible;
        a.lift = s.lift;
        a.doc.label = s.label;
        e.syncActorLabel(a);
        if (JSON.stringify(a.doc.params) !== s.params) { a.doc.params = JSON.parse(s.params); void e.rebuildActor(a); }
        a.setHome();
      }
    }
    if (snap) e.setEnv(snap.env, false);
    e.follow(null);
    this.running = false;
    this.hats.clear();
    e.stopPlay();
    this.onState?.();
  }

  /* ---------------- events ---------------- */
  fire(type: string, filter?: (h: HatInstance, instanceId: string) => boolean, onlyInstance?: string): Thread[] {
    const started: Thread[] = [];
    for (const [inst, hats] of this.hats) {
      if (onlyInstance !== undefined && inst !== onlyInstance) continue;
      for (const h of hats) {
        if (h.type !== type) continue;
        if (filter && !filter(h, inst)) continue;
        // Scratch semantics: re-triggering a running hat restarts it
        for (const t of this.threads) if (t.hat === h && t.actorId === inst) t.cancelled = true;
        started.push(this.spawnThread(inst, h));
      }
    }
    return started;
  }
  tapped(actorId: string) { return this.fire('dd_when_tapped', undefined, actorId).length > 0; }
  key(key: string, down: boolean) {
    const k = key.toLowerCase();
    if (down) {
      if (this.keysDown.has(k)) return;
      this.keysDown.add(k);
      if (this.running) this.fire('dd_when_key', (h) => h.key === 'any' || h.key === k);
    } else this.keysDown.delete(k);
  }
  /** run a single stack (clicked in the editor) */
  runStack(actorId: string, json: unknown, blockId: string) {
    if (!this.running) this.start(false);
    const r = compileScripts(json, { highlight: true, onlyBlock: blockId });
    if (!r.factory) return;
    const hats = r.factory();
    for (const h of hats) this.spawnThread(actorId, h);
  }

  private spawnThread(instanceId: string, hat: HatInstance): Thread {
    const t: Thread = { id: this.nextId++, actorId: instanceId, hat, cancelled: false, done: false, sliceStart: performance.now(), redraw: false };
    this.threads.add(t);
    const api = new ThreadApi(this, t);
    t.promise = (async () => {
      try { await hat.fn(api); }
      catch (e) {
        if (e !== STOP) {
          console.error(e);
          this.onError?.(this.who(instanceId), (e as Error)?.message ?? String(e));
        }
      } finally { t.done = true; this.threads.delete(t); }
    })();
    return t;
  }

  who(instanceId: string) { return instanceId ? this.engine.getActor(instanceId)?.name ?? 'Object' : 'World'; }

  /* ---------------- scheduling ---------------- */
  frame(t: Thread): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.waiters.push(() => (t.cancelled || !this.running ? reject(STOP) : resolve()));
    });
  }

  tick(dt: number) {
    if (!this.running) return;
    this.dt = Math.min(0.1, Math.max(0.001, dt));
    this.time += dt;
    const w = this.waiters;
    this.waiters = [];
    for (const fn of w) fn();
    for (const t of this.threads) { t.sliceStart = performance.now(); t.redraw = false; }
    // ambient life pauses while scripts steer an object
    for (const a of this.engine.actorList) a.scripted = (this.hold.get(a.id) ?? -1) > this.time;
    // timer hats
    for (const [inst, hats] of this.hats) for (const h of hats) {
      if (h.type === 'dd_when_every') {
        const next = this.everyTimers.get(h) ?? h.secs ?? 1;
        if (this.time >= next) {
          this.everyTimers.set(h, this.time + (h.secs ?? 1));
          if (![...this.threads].some((t) => t.hat === h && t.actorId === inst)) this.spawnThread(inst, h);
        } else if (!this.everyTimers.has(h)) this.everyTimers.set(h, next);
      } else if (h.type === 'dd_when_touch' && inst) {
        const me = this.engine.getActor(inst);
        if (!me || !me.root.visible) continue;
        const hit = h.target === '@any' ? this.engine.actorList.some((o) => o !== me && o.root.visible && this.touchingActors(me, o)) : (() => { const o = this.engine.getActor(h.target); return !!o && o.root.visible && this.touchingActors(me, o); })();
        const was = this.touching.get(h) ?? false;
        this.touching.set(h, hit);
        if (hit && !was) this.spawnThread(inst, h);
      }
    }
    const night = this.engine.skyState.night > 0.5;
    if (night !== this.wasNight) {
      this.wasNight = night;
      this.fire('dd_when_time', (h) => h.when === (night ? 'night' : 'day'));
    }
  }

  touchingActors(a: Actor, b: Actor) {
    const pa = a.root.position, pb = b.root.position;
    const d = Math.hypot(pa.x - pb.x, pa.z - pb.z);
    const vy = Math.abs((pa.y + a.height / 2) - (pb.y + b.height / 2));
    return d < (a.radius + b.radius) * 0.75 && vy < (a.height + b.height) * 0.6 + 0.3;
  }

  /* ---------------- clones ---------------- */
  async makeClone(src: Actor, opts: { scale?: number; at?: THREE.Vector3; asset?: string } = {}) {
    if (this.temps.size >= 60) return null;
    const e = this.engine;
    const def = opts.asset ? getDef(opts.asset) : src.def;
    if (!def) return null;
    const doc: ActorDoc = {
      ...JSON.parse(JSON.stringify(src.doc)), id: uid('c'), name: opts.asset ? e.uniqueName(def.name) : src.doc.name, asset: def.id,
      pos: (opts.at ?? src.root.position).toArray() as [number, number, number], rotY: src.root.rotation.y,
      scale: opts.scale ?? src.root.scale.x, scripts: undefined,
    };
    if (opts.asset) { doc.params = {}; doc.lift = e.defaultLift(def); doc.label = { show: true }; }
    const a = await e.spawnTemp(doc, def);
    if (!a) return null;
    a.isClone = true;
    a.cloneOf = opts.asset ? undefined : (src.cloneOf ?? src.id);
    this.temps.add(a.id);
    if (!opts.asset) {
      const owner = src.cloneOf ?? src.id;
      this.instantiate(a.id, owner);
      this.fire('dd_when_clone', undefined, a.id);
    }
    return a;
  }

  /* ---------------- helpers used by the API ---------------- */
  resolve(self: Actor | undefined, ref: unknown): Actor | 'camera' | THREE.Vector3 | null {
    const r = String(ref ?? '');
    const e = this.engine;
    if (r === '@self' || r === '') return self ?? null;
    if (r === '@camera') return 'camera';
    if (r === '@random') return this.randomSpot(self);
    if (r === '@any') return null;
    const a = e.getActor(r);
    if (a) return a;
    // allow names typed as text
    return e.actorList.find((x) => x.name.toLowerCase() === r.toLowerCase()) ?? null;
  }
  randomSpot(self?: Actor) {
    const e = this.engine, b = e.bounds;
    const wantWet = !!self && (self.isSwimmer || self.def.water === 'column');
    for (let k = 0; k < 30; k++) {
      const x = b.minX + 1 + Math.random() * (b.maxX - b.minX - 2), z = b.minZ + 1 + Math.random() * (b.maxZ - b.minZ - 2);
      const wet = e.waterAt(x, z) !== null;
      if (!self || wet === wantWet || self.def.loco === 'fly') return new THREE.Vector3(x, e.groundAt(x, z), z);
    }
    return new THREE.Vector3(0, e.groundAt(0, 0), 0);
  }
  posOf(t: Actor | 'camera' | THREE.Vector3 | null): THREE.Vector3 | null {
    if (!t) return null;
    if (t === 'camera') { const c = this.engine.camera.position; return new THREE.Vector3(c.x, this.engine.groundAt(c.x, c.z), c.z); }
    if (t instanceof THREE.Vector3) return t.clone();
    return t.root.position.clone();
  }
  eatsRel(a: Actor, b: Actor) { return eats(a.def, b.def); }
}

/* =================================================================== */
class ThreadApi {
  private rt: ScriptRuntime;
  private t: Thread;
  constructor(rt: ScriptRuntime, t: Thread) { this.rt = rt; this.t = t; }
  private get e() { return this.rt.engine; }
  private get me(): Actor | undefined { return this.t.actorId ? this.e.getActor(this.t.actorId) : undefined; }
  private check() { if (this.t.cancelled || !this.rt.running) throw STOP; }
  private holdAmbient(sec = 1.5) { if (this.me) this.rt.hold.set(this.me.id, this.rt.time + sec); }
  private redraw() { this.t.redraw = true; }

  /* --- scheduling --- */
  hl(id: string) {
    const owner = this.me ? (this.me.cloneOf ?? this.me.id) : '';
    if (this.rt.highlightOwner === owner) this.rt.onHighlight?.(id);
  }
  frame() { this.check(); return this.rt.frame(this.t); }
  async tick() {
    this.check();
    if (this.t.redraw || performance.now() - this.t.sliceStart > 12) await this.rt.frame(this.t);
  }
  async wait(sec: number) {
    const end = this.rt.time + Math.max(0, Number(sec) || 0);
    do { await this.frame(); } while (this.rt.time < end);
  }

  /* --- motion --- */
  private speed(gait = 'walk') {
    const a = this.me!;
    const base = a.def.speed ?? 1;
    const sc = Math.max(0.4, Math.sqrt(a.root.scale.x * (a.model?.exhibitScale ?? 1)));
    return base * sc * (gait === 'run' ? 2.3 : 1) * (a.def.loco === 'crawl' ? 0.8 : 1);
  }
  private faceTowards(x: number, z: number, maxStep = Math.PI) {
    const a = this.me!;
    const p = a.root.position;
    if (Math.hypot(x - p.x, z - p.z) < 1e-4) return 0;
    const want = Math.atan2(x - p.x, z - p.z);
    let d = want - a.root.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    a.root.rotation.y += clamp(d, -maxStep, maxStep);
    return Math.abs(d);
  }
  private clampToBounds(p: THREE.Vector3) {
    const b = this.e.bounds;
    p.x = clamp(p.x, b.minX + 0.3, b.maxX - 0.3);
    p.z = clamp(p.z, b.minZ + 0.3, b.maxZ - 0.3);
  }
  private async travel(tx: number, tz: number, speed: number, stopDist = 0, turnRate = 4, maxSec = 60) {
    const a = this.me;
    if (!a) return;
    const start = this.rt.time;
    while (this.rt.time - start < maxSec) {
      this.holdAmbient();
      const p = a.root.position;
      const d = Math.hypot(tx - p.x, tz - p.z);
      if (d <= stopDist + 0.03) break;
      const dt = this.rt.dt;
      const off = this.faceTowards(tx, tz, turnRate * dt * 2);
      const step = Math.min(d - stopDist, speed * dt * (off > 1.2 ? 0.25 : 1));
      p.x += ((tx - p.x) / d) * step;
      p.z += ((tz - p.z) / d) * step;
      this.clampToBounds(p);
      await this.frame();
    }
    a.setHome();
  }
  async move(dist: number) {
    const a = this.me; if (!a) return;
    const n = Number(dist) || 0;
    const dir = new THREE.Vector3(Math.sin(a.root.rotation.y), 0, Math.cos(a.root.rotation.y));
    const target = a.root.position.clone().addScaledVector(dir, n);
    this.clampToBounds(target);
    const speed = this.speed();
    const p = a.root.position;
    let left = Math.hypot(target.x - p.x, target.z - p.z);
    while (left > 0.01) {
      this.holdAmbient();
      const step = Math.min(left, speed * this.rt.dt);
      p.x += Math.sign(n) * dir.x * step;
      p.z += Math.sign(n) * dir.z * step;
      left -= step;
      await this.frame();
    }
    a.setHome();
  }
  async turn(deg: number) {
    const a = this.me; if (!a) return;
    const total = -(Number(deg) || 0) * DEG;
    const steps = Math.max(1, Math.round(Math.abs(total) / (8 * DEG)));
    for (let i = 0; i < steps; i++) { a.root.rotation.y += total / steps; this.holdAmbient(); await this.frame(); }
  }
  pointDir(c: number) { const a = this.me; if (a) { a.root.rotation.y = Math.PI - (Number(c) || 0) * DEG; this.holdAmbient(); this.redraw(); } }
  pointTowards(ref: unknown) {
    const a = this.me; if (!a) return;
    const p = this.rt.posOf(this.rt.resolve(a, ref));
    if (p) { this.faceTowards(p.x, p.z); this.holdAmbient(); this.redraw(); }
  }
  goTo(ref: unknown) {
    const a = this.me; if (!a) return;
    const p = this.rt.posOf(this.rt.resolve(a, ref));
    if (!p) return;
    this.clampToBounds(p);
    a.root.position.x = p.x; a.root.position.z = p.z;
    a.setHome(); this.holdAmbient(); this.redraw();
  }
  goXY(x: number, y: number) {
    const a = this.me; if (!a) return;
    const p = new THREE.Vector3(Number(x) || 0, 0, -(Number(y) || 0));
    this.clampToBounds(p);
    a.root.position.x = p.x; a.root.position.z = p.z;
    a.setHome(); this.holdAmbient(); this.redraw();
  }
  private async glide(sec: number, tx: number, tz: number) {
    const a = this.me; if (!a) return;
    const p = a.root.position, sx = p.x, sz = p.z;
    const dur = Math.max(0.01, Number(sec) || 0), start = this.rt.time;
    const goal = new THREE.Vector3(tx, 0, tz); this.clampToBounds(goal);
    while (true) {
      const k = Math.min(1, (this.rt.time - start) / dur);
      p.x = sx + (goal.x - sx) * k; p.z = sz + (goal.z - sz) * k;
      this.holdAmbient();
      if (k >= 1) break;
      await this.frame();
    }
    a.setHome();
  }
  async glideTo(sec: number, ref: unknown) {
    const p = this.rt.posOf(this.rt.resolve(this.me, ref));
    if (p) await this.glide(sec, p.x, p.z);
  }
  async glideXY(sec: number, x: number, y: number) { await this.glide(sec, Number(x) || 0, -(Number(y) || 0)); }
  async walkTo(ref: unknown, gait = 'walk') {
    const a = this.me; if (!a) return;
    const tgt = this.rt.resolve(a, ref);
    const p = this.rt.posOf(tgt);
    if (!p) return;
    const stop = tgt && typeof tgt === 'object' && !(tgt instanceof THREE.Vector3) ? (a.radius + tgt.radius) * 0.7 : 0;
    await this.travel(p.x, p.z, this.speed(gait), stop);
  }
  async wander(sec: number) {
    const a = this.me; if (!a) return;
    const end = this.rt.time + (Number(sec) || 0);
    while (this.rt.time < end) {
      const ang = Math.random() * Math.PI * 2, r = 1 + Math.random() * (2 + a.radius * 3);
      const tx = a.root.position.x + Math.cos(ang) * r, tz = a.root.position.z + Math.sin(ang) * r;
      const goal = new THREE.Vector3(tx, 0, tz); this.clampToBounds(goal);
      const w = this.e.waterAt(goal.x, goal.z);
      if ((w !== null) !== (a.isSwimmer) && a.def.loco !== 'fly') { await this.frame(); continue; }
      await this.travel(goal.x, goal.z, this.speed(), 0, 3, Math.max(0.5, end - this.rt.time));
      if (this.rt.time < end) await this.wait(Math.min(end - this.rt.time, 0.5 + Math.random() * 1.5));
    }
  }
  async follow(ref: unknown, sec: number) {
    const a = this.me; if (!a) return;
    const end = this.rt.time + (Number(sec) || 0);
    while (this.rt.time < end) {
      const tgt = this.rt.resolve(a, ref);
      const p = this.rt.posOf(tgt);
      if (!p) break;
      const keep = a.radius * 2 + (tgt && typeof tgt === 'object' && !(tgt instanceof THREE.Vector3) ? tgt.radius * 1.5 : 1);
      const d = Math.hypot(p.x - a.root.position.x, p.z - a.root.position.z);
      this.holdAmbient();
      if (d > keep) {
        this.faceTowards(p.x, p.z, 0.15);
        const step = Math.min(d - keep, this.speed(d > keep * 3 ? 'run' : 'walk') * this.rt.dt);
        a.root.position.x += ((p.x - a.root.position.x) / d) * step;
        a.root.position.z += ((p.z - a.root.position.z) / d) * step;
        this.clampToBounds(a.root.position);
      }
      await this.frame();
    }
    a.setHome();
  }
  async flee(ref: unknown, sec: number) {
    const a = this.me; if (!a) return;
    const end = this.rt.time + (Number(sec) || 0);
    while (this.rt.time < end) {
      const p = this.rt.posOf(this.rt.resolve(a, ref));
      if (!p) break;
      const away = new THREE.Vector3(a.root.position.x - p.x, 0, a.root.position.z - p.z);
      if (away.lengthSq() < 1e-4) away.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      away.normalize();
      const tx = a.root.position.x + away.x, tz = a.root.position.z + away.z;
      this.faceTowards(tx, tz, 0.2);
      const step = this.speed('run') * this.rt.dt;
      a.root.position.x += away.x * step; a.root.position.z += away.z * step;
      const before = a.root.position.clone();
      this.clampToBounds(a.root.position);
      if (before.distanceToSquared(a.root.position) > 1e-6) a.root.rotation.y += 0.3; // slide along the walls
      this.holdAmbient();
      await this.frame();
    }
    a.setHome();
  }
  async circle(ref: unknown, r: number, sec: number) {
    const a = this.me; if (!a) return;
    const tgt = this.rt.resolve(a, ref);
    const c = (tgt === a ? a.root.position.clone() : this.rt.posOf(tgt)) ?? a.root.position.clone();
    const R = Math.max(0.3, Number(r) || 2);
    const end = this.rt.time + (Number(sec) || 0);
    let ang = Math.atan2(a.root.position.z - c.z, a.root.position.x - c.x);
    const w = this.speed() / R;
    while (this.rt.time < end) {
      ang += w * this.rt.dt;
      const nx = c.x + Math.cos(ang) * R, nz = c.z + Math.sin(ang) * R;
      this.faceTowards(nx, nz);
      a.root.position.x = nx; a.root.position.z = nz;
      this.clampToBounds(a.root.position);
      this.holdAmbient();
      await this.frame();
    }
    a.setHome();
  }
  async flyTo(h: number) {
    const a = this.me; if (!a) return;
    const goal = Math.max(0, Number(h) || 0);
    while (Math.abs(a.lift - goal) > 0.02) {
      a.lift += clamp(goal - a.lift, -2.5 * this.rt.dt, 2.5 * this.rt.dt);
      this.holdAmbient();
      await this.frame();
    }
    a.lift = goal;
    a.doc.lift = a.def.loco === 'fly' ? goal : a.doc.lift;
  }
  changeHeight(h: number) { const a = this.me; if (a) { a.lift = Math.max(0, a.lift + (Number(h) || 0)); this.redraw(); } }
  async jump(h: number) {
    const a = this.me; if (!a) return;
    const H = Math.max(0, Number(h) || 1), base = a.lift, dur = 0.25 + Math.sqrt(H) * 0.35, start = this.rt.time;
    while (this.rt.time - start < dur) {
      const k = (this.rt.time - start) / dur;
      a.lift = base + 4 * H * k * (1 - k);
      this.holdAmbient();
      await this.frame();
    }
    a.lift = base;
  }
  async spin(n: number) { await this.turn((Number(n) || 1) * 360); }
  bounce() {
    const a = this.me; if (!a) return;
    const b = this.e.bounds, p = a.root.position, m = a.radius + 0.4;
    let fx = Math.sin(a.root.rotation.y), fz = Math.cos(a.root.rotation.y);
    if ((p.x < b.minX + m && fx < 0) || (p.x > b.maxX - m && fx > 0)) fx = -fx;
    if ((p.z < b.minZ + m && fz < 0) || (p.z > b.maxZ - m && fz > 0)) fz = -fz;
    a.root.rotation.y = Math.atan2(fx, fz);
  }
  x() { return round2(this.me?.root.position.x ?? 0); }
  y() { return round2(-(this.me?.root.position.z ?? 0)); }
  height() { const a = this.me; return a ? round2(Math.max(0, a.root.position.y - this.e.groundAt(a.root.position.x, a.root.position.z))) : 0; }
  direction() { const a = this.me; return a ? Math.round(((180 - a.root.rotation.y / DEG) % 360 + 360) % 360) : 0; }

  /* --- looks --- */
  async sayFor(text: unknown, sec: number, think = false) { this.me?.say(String(text ?? ''), 0, think); await this.wait(sec); this.me?.say(''); }
  say(text: unknown) { this.me?.say(String(text ?? '')); }
  show() { const a = this.me; if (a) { a.root.visible = true; this.redraw(); } }
  hide() { const a = this.me; if (a) { a.root.visible = false; this.redraw(); } }
  setSize(p: number) { const a = this.me; if (a) { a.root.scale.setScalar(clamp((Number(p) || 0) / 100, 0.02, 20) * (a.doc.scale || 1)); a.updateRing(); a.syncLabel(); this.redraw(); } }
  changeSize(d: number) { const a = this.me; if (a) { a.root.scale.setScalar(clamp(a.root.scale.x + ((Number(d) || 0) / 100) * (a.doc.scale || 1), 0.02, 20)); a.syncLabel(); this.redraw(); } }
  playAnim(name: string) {
    const a = this.me; if (!a) return;
    const map: Record<string, string[]> = { graze: ['graze', 'peck'], walk: ['walk', 'hop'], trot: ['trot', 'walk'], gallop: ['gallop', 'trot'], flap: ['flap'], glide: ['glide', 'flap'], idle: ['idle', 'perch'], hop: ['hop', 'walk'] };
    for (const c of map[name] ?? [name]) if (a.actions.has(c)) { a.forcedClip = c; a.play(c, 0.25); return; }
    // no clip: give a little procedural flourish instead
    if (name === 'roar' || name === 'alert') a.setRig(a.rigNames.find((n) => /jaw/i.test(n)) ?? '', 25);
  }
  autoAnim() { const a = this.me; if (a) { a.forcedClip = null; a.holds.clear(); } }
  tint(c: unknown) { const a = this.me; if (a) a.setTint(c ? (COLORS[String(c)] ?? String(c)) : null); }
  glow(c: unknown) { const a = this.me; if (a) a.setGlow(c ? (COLORS[String(c)] ?? String(c)) : null, 0.9); }
  ghost(p: number) { const a = this.me; if (a) a.setOpacity(1 - clamp((Number(p) || 0) / 100, 0, 1)); }
  setJoint(name: string, deg: number | null) { const a = this.me; if (a && name) a.setRig(name, deg === null ? null : Number(deg) || 0); }
  setLabel(t: unknown) { const a = this.me; if (a) { a.doc.label = { show: true, text: String(t ?? '') }; this.e.syncActorLabel(a); } }
  async setParam(key: string, value: unknown) {
    const a = this.me; if (!a || !key) return;
    a.doc.params = { ...a.doc.params, [key]: value };
    await this.e.rebuildActor(a);
    this.check();
  }

  /* --- sound --- */
  sound(name: string) { playSound(name); }
  async soundWait(name: string) { await this.wait(playSound(name)); }
  async animalCall() { const a = this.me; if (a) await this.wait(playSound(animalCallFor(a.def.id))); }
  async speak(text: unknown) { await Promise.race([speak(String(text ?? '')), new Promise<void>((r) => setTimeout(r, 15000))]); this.check(); }
  volume(p: number) { setVolume(clamp((Number(p) || 0) / 100, 0, 1)); }

  /* --- events & control --- */
  broadcast(msg: string) { const m = String(msg).trim().toLowerCase(); this.rt.fire('dd_when_receive', (h) => h.msg === m); }
  async broadcastWait(msg: string) {
    const m = String(msg).trim().toLowerCase();
    const started = this.rt.fire('dd_when_receive', (h) => h.msg === m);
    while (started.some((t) => !t.done)) await this.frame();
  }
  async stop(what: string) {
    if (what === 'all') { setTimeout(() => this.rt.stop(), 0); throw STOP; }
    if (what === 'other') return; // other scripts: not tracked individually — keep it simple
    throw STOP;
  }
  async clone(ref: unknown) {
    const src = this.rt.resolve(this.me, ref);
    if (src && typeof src === 'object' && !(src instanceof THREE.Vector3)) await this.rt.makeClone(src);
    this.check();
  }
  async deleteClone() {
    const a = this.me;
    if (a?.isClone) { this.rt.temps.delete(a.id); this.e.removeActor(a.id, false); }
    throw STOP;
  }

  /* --- sensing --- */
  touching(ref: unknown) {
    const a = this.me; if (!a) return false;
    if (ref === '@any') return this.e.actorList.some((o) => o !== a && o.root.visible && this.rt.touchingActors(a, o));
    const o = this.rt.resolve(a, ref);
    if (o === 'camera') return this.e.camera.position.distanceTo(a.root.position) < a.radius + 1;
    return !!o && typeof o === 'object' && !(o instanceof THREE.Vector3) && o !== a && o.root.visible && this.rt.touchingActors(a, o);
  }
  distanceTo(ref: unknown) {
    const a = this.me;
    const from = a ? a.root.position : this.e.controls.target;
    const p = this.rt.posOf(this.rt.resolve(a, ref));
    return p ? round2(Math.hypot(p.x - from.x, p.z - from.z)) : 0;
  }
  async ask(q: unknown) {
    this.me?.say(String(q ?? ''));
    const ans = this.rt.onAsk ? await this.rt.onAsk(String(q ?? ''), this.me?.name ?? 'World') : '';
    this.me?.say('');
    this.check();
    this.rt.answerText = ans;
  }
  answer() { return this.rt.answerText; }
  keyPressed(k: string) { return k === 'any' ? this.rt.keysDown.size > 0 : this.rt.keysDown.has(k); }
  isNight() { return this.e.skyState.night > 0.5; }
  timeOfDay() { return Math.round(this.e.env.time * 10) / 10; }
  inWater() { const a = this.me; return !!a && this.e.waterAt(a.root.position.x, a.root.position.z) !== null; }
  timer() { return round2(this.rt.time - this.rt.timerStart); }
  resetTimer() { this.rt.timerStart = this.rt.time; }
  myName() { return this.me?.name ?? 'World'; }
  propOf(prop: string, ref: unknown) {
    const o = this.rt.resolve(this.me, ref);
    if (!o || o === 'camera' || o instanceof THREE.Vector3) return 0;
    switch (prop) {
      case 'x': return round2(o.root.position.x);
      case 'y': return round2(-o.root.position.z);
      case 'height': return round2(Math.max(0, o.root.position.y - this.e.groundAt(o.root.position.x, o.root.position.z)));
      case 'dir': return Math.round(((180 - o.root.rotation.y / DEG) % 360 + 360) % 360);
      case 'size': return Math.round((o.root.scale.x / (o.doc.scale || 1)) * 100);
      case 'name': return o.name;
      case 'energy': return Math.round(this.rt.energy.get(o.id) ?? 100);
    }
    return 0;
  }
  nearest(kind: string): string {
    const a = this.me;
    const from = a ? a.root.position : this.e.controls.target;
    let best: Actor | null = null, bd = Infinity;
    for (const o of this.e.actorList) {
      if (o === a || !o.root.visible || o.def.category === 'habitats') continue;
      let ok = false;
      switch (kind) {
        case 'animal': ok = o.def.category === 'animals'; break;
        case 'plant': ok = o.def.category === 'plants'; break;
        case 'food': ok = !!a && this.rt.eatsRel(a, o); break;
        case 'predator': ok = !!a && this.rt.eatsRel(o, a); break;
        case 'same': ok = !!a && o.def.id === a.def.id; break;
      }
      if (!ok) continue;
      const d = o.root.position.distanceTo(from);
      if (d < bd) { bd = d; best = o; }
    }
    return best?.id ?? '';
  }

  /* --- world --- */
  setTime(h: number) { this.e.setEnv({ time: ((Number(h) || 0) % 24 + 24) % 24 }, false); }
  changeTime(h: number) { this.setTime(this.e.env.time + (Number(h) || 0)); }
  dayCycle(s: number) { this.e.setEnv({ daySpeed: Math.max(0, Number(s) || 0) }, false); }
  weather(w: string) { this.e.setEnv({ weather: w as Weather }, false); }
  season(s: string) { this.e.setEnv({ season: s as Season }, false); }
  fog(p: number) { this.e.setEnv({ fog: clamp((Number(p) || 0) / 100, 0, 1) }, false); }
  wind(p: number) { this.e.setEnv({ wind: clamp((Number(p) || 0) / 100, 0, 1) }, false); }
  waterLevel(h: number) { if (this.e.terrain) { this.e.terrain.setWaterLevel(Number(h) || 0); this.e.water?.sync(); } }
  caption(text: unknown, sec: number) { this.rt.onCaption?.(String(text ?? ''), Number(sec) || 3); }
  cameraLook(ref: unknown) { const o = this.rt.resolve(this.me, ref); if (o && typeof o === 'object' && !(o instanceof THREE.Vector3)) this.e.focusActor(o.id); }
  cameraFollow(ref: unknown) { const o = this.rt.resolve(this.me, ref); if (o && typeof o === 'object' && !(o instanceof THREE.Vector3)) { this.e.focusActor(o.id, 0.8, () => this.e.follow(o.id)); } }
  cameraOverview() { this.e.follow(null); this.e.frameCamera(); }
  async spawn(species: unknown, ref: unknown) {
    const id = String(species ?? '');
    const def = getDef(id) ?? getDef(this.e.actorList.find((a) => a.name.toLowerCase() === id.toLowerCase())?.def.id ?? '');
    if (!def) return;
    const p = this.rt.posOf(this.rt.resolve(this.me, ref)) ?? this.rt.randomSpot();
    await this.rt.makeClone(this.me ?? this.e.actorList[0], { asset: def.id, at: p, scale: 1 });
    this.check();
  }
  setShared(n: string, v: unknown) { this.rt.shared.set(n, v); }
  changeShared(n: string, d: number) { this.rt.shared.set(n, (Number(this.rt.shared.get(n)) || 0) + (Number(d) || 0)); }
  getShared(n: string) { return this.rt.shared.get(n) ?? 0; }

  /* --- ecosystem --- */
  async eat(ref: unknown) {
    const a = this.me; if (!a) return;
    const o = this.rt.resolve(a, ref);
    if (!o || o === 'camera' || o instanceof THREE.Vector3 || o === a || !o.root.visible) return;
    await this.walkTo(o.id, this.rt.eatsRel(o, a) ? 'run' : 'walk');
    this.faceTowards(o.root.position.x, o.root.position.z);
    this.playAnim(a.actions.has('graze') ? 'graze' : 'roar');
    playSound('munch');
    await this.wait(1.2);
    if (o.def.category === 'plants' || o.def.category === 'fungi') {
      o.root.scale.multiplyScalar(0.8);
      if (o.root.scale.x < (o.doc.scale || 1) * 0.3) o.root.visible = false;
    } else {
      o.say('');
      o.root.visible = false;
    }
    this.rt.energy.set(a.id, Math.min(100, (this.rt.energy.get(a.id) ?? 100) + 30));
    this.autoAnim();
  }
  predatorNear(d: number) {
    const a = this.me; if (!a) return false;
    return this.e.actorList.some((o) => o !== a && o.root.visible && this.rt.eatsRel(o, a) && o.root.position.distanceTo(a.root.position) < (Number(d) || 0));
  }
  energy() { const a = this.me; return a ? Math.round(this.rt.energy.get(a.id) ?? 100) : 0; }
  changeEnergy(d: number) { const a = this.me; if (a) this.rt.energy.set(a.id, clamp((this.rt.energy.get(a.id) ?? 100) + (Number(d) || 0), 0, 100)); }
  async grow(p: number) {
    const a = this.me; if (!a) return;
    const goal = a.root.scale.x * (1 + (Number(p) || 0) / 100), start = a.root.scale.x, t0 = this.rt.time, dur = 1.5;
    while (this.rt.time - t0 < dur) { a.root.scale.setScalar(start + (goal - start) * ((this.rt.time - t0) / dur)); await this.frame(); }
    a.root.scale.setScalar(goal);
    a.syncLabel();
  }
  async baby() {
    const a = this.me; if (!a) return;
    const at = a.root.position.clone().add(new THREE.Vector3(a.radius * 1.5, 0, a.radius));
    const kid = await this.rt.makeClone(a, { scale: a.root.scale.x * 0.45, at });
    this.check();
    if (kid) {
      kid.doc.name = `${a.name} baby`;
      kid.doc.label = { show: true, text: `${a.name} baby` };
      this.e.syncActorLabel(kid);
      // grow up over ~20 seconds
      const target = a.root.scale.x, t0 = this.rt.time;
      const grow = () => {
        if (!this.rt.running || !this.e.getActor(kid.id)) { this.e.onTick.delete(growTick); return; }
        const k = Math.min(1, (this.rt.time - t0) / 20);
        kid.root.scale.setScalar(target * (0.45 + 0.55 * k));
        if (k >= 1) this.e.onTick.delete(growTick);
      };
      const growTick = () => grow();
      this.e.onTick.add(growTick);
    }
  }
  async sleep(sec: number) {
    const a = this.me; if (!a) return;
    if (a.actions.has('sit')) { a.forcedClip = 'sit'; a.play('sit', 0.4); }
    a.say('Zzz…', 0, true);
    this.holdAmbient(Number(sec) + 0.5);
    await this.wait(sec);
    a.say('');
    this.autoAnim();
  }
}

function round2(v: number) { return Math.round(v * 100) / 100; }
