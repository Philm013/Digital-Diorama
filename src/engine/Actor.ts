import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { AssetDef } from '../assets/types';
import type { BuiltModel } from '../assets/builder';
import type { ActorDoc } from './types';
import { clamp, rng } from './util';

export interface WorldQuery {
  groundAt(x: number, z: number): number;
  waterAt(x: number, z: number): number | null;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  time: number;
  night?: number;
}

const DEG = Math.PI / 180;
const _v = new THREE.Vector3();
let haloTex: THREE.Texture | null = null;
function haloTexture() {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  haloTex = new THREE.CanvasTexture(c);
  return haloTex;
}

export type AmbientState = 'idle' | 'move' | 'circle' | 'swim';

export class Actor {
  doc: ActorDoc;
  def: AssetDef;
  root = new THREE.Group();
  model?: BuiltModel;
  mixer?: THREE.AnimationMixer;
  actions = new Map<string, THREE.AnimationAction>();
  current?: THREE.AnimationAction;
  currentName = '';
  /** clip forced by a script (null → automatic) */
  forcedClip: string | null = null;
  clipSpeed = 1;
  /** bones/rig nodes posed by scripts: name → degrees */
  holds = new Map<string, number>();
  private restQuats = new Map<string, THREE.Quaternion>();
  label?: CSS2DObject;
  toothpick?: THREE.Mesh;
  bubble?: CSS2DObject;
  private bubbleTimer = 0;
  ring?: THREE.Mesh;
  // motion bookkeeping
  velocity = new THREE.Vector3();
  private lastPos = new THREE.Vector3();
  speedSmoothed = 0;
  /** a quicker speed estimate, for gait playback rates (Digital Diorama revision 7) */
  private speedFast = 0;
  private relFast = 0;
  /** true while a script is steering this actor (ambient life pauses) */
  scripted = false;
  ambientEnabled = true;
  ambient: AmbientState = 'idle';
  private ambientTimer = 1 + Math.random() * 3;
  private ambientTarget = new THREE.Vector3();
  /** ambient walking speed, eased in and out (Digital Diorama revision 7) */
  private moveV = 0;
  private home = new THREE.Vector3();
  private circlePhase = Math.random() * Math.PI * 2;
  private R = rng(Math.floor(Math.random() * 1e9));
  /** current height above ground for flyers / depth for swimmers */
  lift = 0;
  airborne = false;
  tinted = false;
  private ownMaterials = false;
  private gaitPhase = 0;
  hidden = false;
  /** clones created by scripts are temporary */
  isClone = false;
  cloneOf?: string;
  baseScale = 1;
  dying = 0;
  /** fireflies (and glowing fungi) light up after dark */
  get glowAtNight() { return this.def.id === 'wild/firefly' || this.def.id === 'fungi/ghost-mycena'; }
  private lastBlink = -1;
  private halo?: THREE.Sprite;
  private setHalo(color: string, size: number, alpha: number) {
    if (!this.halo) {
      this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.halo.name = 'halo';
      this.halo.renderOrder = 5;
      this.root.add(this.halo);
    }
    const s = this.root.scale.x || 1;
    this.halo.position.set(0, (this.model?.height ?? 0.3) * 0.6 / s, 0);
    this.halo.scale.setScalar(size / s);
    (this.halo.material as THREE.SpriteMaterial).opacity = alpha;
    this.halo.visible = alpha > 0.01;
  }

  constructor(doc: ActorDoc, def: AssetDef) {
    this.doc = doc;
    this.def = def;
    this.root.name = 'actor:' + doc.id;
    this.root.userData.actorId = doc.id;
    this.applyDocTransform();
  }

  get id() { return this.doc.id; }
  get name() { return this.doc.name; }
  get height() { return (this.model?.height ?? 1) * this.root.scale.y; }
  get radius() { return (this.model?.radius ?? 0.5) * this.root.scale.x; }
  get isFlyer() { return this.def.loco === 'fly'; }
  get isSwimmer() { return this.def.loco === 'swim' || this.def.water === 'column'; }
  /** in water deep enough to swim (swimmers only; set as the actor follows the ground) */
  wet = false;
  get moves() { return this.def.loco !== 'sessile' && this.def.loco !== 'scenery'; }

  applyDocTransform() {
    const d = this.doc;
    this.root.position.set(d.pos[0], d.pos[1], d.pos[2]);
    this.root.rotation.y = d.rotY;
    this.root.scale.setScalar(d.scale);
    this.baseScale = d.scale;
    this.lift = d.lift ?? 0;
    this.home.copy(this.root.position);
    this.lastPos.copy(this.root.position);
    this.root.visible = !d.hidden;
  }

  setModel(m: BuiltModel) {
    if (this.model) {
      this.root.remove(this.model.object);
      this.mixer?.stopAllAction();
    }
    this.model = m;
    this.root.add(m.object);
    this.actions.clear();
    this.current = undefined;
    this.currentName = '';
    this.ownMaterials = false;
    this.tinted = false;
    this.restQuats.clear();
    if (m.clips.length) {
      this.mixer = new THREE.AnimationMixer(m.raw);
      for (const c of m.clips) this.actions.set(c.name, this.mixer.clipAction(c));
      this.play(this.idleClip(), 0);
    } else this.mixer = undefined;
    m.object.traverse((o) => { o.userData.actorId = this.doc.id; });
    this.updateRing();
    this.syncLabel();
  }

  /* ---------- clips ---------- */
  get clipNames() { return [...this.actions.keys()]; }
  idleClip() {
    if (this.actions.has('idle')) return 'idle';
    if (this.actions.has('perch')) return 'perch';
    return this.clipNames[0] ?? '';
  }
  play(name: string, fade = 0.25, timeScale = 1) {
    const a = this.actions.get(name);
    if (!a) return false;
    if (this.current === a) { a.timeScale = timeScale * this.clipSpeed; return true; }
    a.reset();
    a.setEffectiveWeight(1);
    a.timeScale = timeScale * this.clipSpeed;
    const once = name === 'roar' || name === 'sit' || name === 'peck' || name === 'hop';
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    a.clampWhenFinished = once;
    a.play();
    if (this.current && fade > 0) {
      // (Digital Diorama revision 8: a gait fading out into a standing clip holds its pose; still playing, its planted
      // feet kept walking back under an animal that had stopped)
      if (this.gaitMeta(this.currentName) && !this.gaitMeta(name)) this.current.timeScale = 0;
      this.current.crossFadeTo(a, fade, false);
    }
    else if (this.current) this.current.stop();
    this.current = a;
    this.currentName = name;
    return true;
  }

  /* ---------- labels & bubbles ---------- */
  syncLabel() {
    const show = !!this.doc.label?.show;
    const text = this.doc.label?.text?.trim() || this.doc.name;
    if (!show) {
      if (this.label) { this.root.remove(this.label); this.label.element.remove(); this.label = undefined; }
      if (this.toothpick) { this.root.remove(this.toothpick); this.toothpick.geometry.dispose(); (this.toothpick.material as THREE.Material).dispose(); this.toothpick = undefined; }
      return;
    }
    const s = this.root.scale.x || 1;
    const floating = this.def.loco === 'fly' && (this.doc.lift ?? 0) > 0.3 || this.isSwimmer || this.def.water === 'surface';
    const h = (this.model?.height ?? 1) + (floating ? 0.25 : 0.55) / s;
    const off = floating ? 0 : ((this.model?.halfWidth ?? 0.3) + 0.18 / s);
    if (floating && this.toothpick) { this.root.remove(this.toothpick); this.toothpick.geometry.dispose(); (this.toothpick.material as THREE.Material).dispose(); this.toothpick = undefined; }
    if (!floating && !this.toothpick) {
      this.toothpick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 5).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#d9b77e', roughness: 0.8 }));
      this.toothpick.castShadow = true;
      this.toothpick.name = 'toothpick';
      this.root.add(this.toothpick);
    }
    if (this.toothpick) {
      this.toothpick.position.set(off, 0, 0);
      this.toothpick.scale.set(1 / s, h, 1 / s);
    }
    if (!this.label) {
      const el = document.createElement('div');
      el.className = 'dd-flag';
      this.label = new CSS2DObject(el);
      this.label.center.set(0, 1);
      this.root.add(this.label);
    }
    this.label.element.textContent = text;
    this.label.center.set(floating ? 0.5 : 0, 1);
    this.label.position.set(off, h, 0);
  }

  say(text: string, seconds = 0, think = false) {
    if (!text) { this.clearBubble(); return; }
    if (!this.bubble) {
      const el = document.createElement('div');
      el.className = 'dd-bubble';
      this.bubble = new CSS2DObject(el);
      this.bubble.center.set(0.5, 1);
      this.root.add(this.bubble);
    }
    const el = this.bubble.element;
    el.textContent = text;
    el.classList.toggle('think', think);
    this.bubble.position.set(0, (this.model?.height ?? 1) + 0.25 / (this.root.scale.x || 1), 0);
    this.bubbleTimer = seconds > 0 ? seconds : Infinity;
  }
  clearBubble() {
    if (this.bubble) { this.root.remove(this.bubble); this.bubble.element.remove(); this.bubble = undefined; }
  }

  /* ---------- selection ring ---------- */
  setSelected(on: boolean) {
    if (on && !this.ring) {
      this.ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.95, depthTest: false }));
      this.ring.renderOrder = 10;
      this.ring.name = 'selection-ring';
      this.root.add(this.ring);
      this.updateRing();
    } else if (!on && this.ring) {
      this.root.remove(this.ring);
      this.ring.geometry.dispose();
      (this.ring.material as THREE.Material).dispose();
      this.ring = undefined;
    }
  }
  updateRing() {
    if (!this.ring) return;
    const r = Math.max(0.25, (this.model?.radius ?? 0.5) * 1.15);
    this.ring.scale.setScalar(r);
    this.ring.position.y = 0.04 / (this.root.scale.x || 1);
  }

  /* ---------- looks ---------- */
  private ensureOwnMaterials() {
    if (this.ownMaterials || !this.model) return;
    this.model.object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material) {
        m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
      }
    });
    this.ownMaterials = true;
  }
  setTint(color: string | null, amount = 0.65) {
    if (!this.model) return;
    this.ensureOwnMaterials();
    const c = new THREE.Color(color ?? '#ffffff');
    const white = new THREE.Color('#ffffff');
    this.model.object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        const sm = mat as THREE.MeshStandardMaterial;
        if (sm.color) sm.color.copy(white).lerp(c, color ? amount : 0);
      }
    });
    this.tinted = !!color;
  }
  setGlow(color: string | null, intensity = 0.8) {
    if (!this.model) return;
    this.ensureOwnMaterials();
    this.model.object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        const sm = mat as THREE.MeshStandardMaterial;
        if (sm.emissive) { sm.emissive.set(color ?? '#000000'); sm.emissiveIntensity = color ? intensity : 1; }
      }
    });
  }
  setOpacity(alpha: number) {
    if (!this.model) return;
    this.ensureOwnMaterials();
    this.model.object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        mat.transparent = alpha < 0.999 || mat.userData.wasTransparent;
        if (mat.userData.wasTransparent === undefined) mat.userData.wasTransparent = mat.transparent && alpha >= 0.999;
        (mat as THREE.MeshStandardMaterial).opacity = alpha;
      }
    });
  }

  /** set a rig joint (skinned bone or pivot) to an angle in degrees; null releases it */
  setRig(name: string, deg: number | null) {
    if (deg === null) { this.holds.delete(name); return; }
    this.holds.set(name, deg);
  }
  get rigNames(): string[] {
    const names = new Set<string>();
    for (const r of this.model?.rig ?? []) names.add(r.name);
    if (this.model?.skinned) {
      this.model.raw.traverse((o) => { if ((o as THREE.Bone).isBone && /^(Head|Neck1|Jaw|Tail1?|Tail|EarL|EarR|HumerusL|HumerusR|Trunk1|ThighL|ThighR|Chest|Hips)$/.test(o.name)) names.add(o.name); });
    }
    return [...names];
  }

  /* ---------- per frame ---------- */
  update(dt: number, t: number, world: WorldQuery, live: boolean) {
    const m = this.model;
    if (!m) return;
    // ambient life (only when nothing else steers us)
    if (live && this.ambientEnabled && !this.scripted && this.doc.ambient !== false && this.moves) this.runAmbient(dt, world);
    // ground following
    this.followGround(world);
    // velocity estimate → automatic gait
    _v.subVectors(this.root.position, this.lastPos);
    _v.y = 0;
    const sp = dt > 0 ? _v.length() / dt : 0;
    this.speedSmoothed += (sp - this.speedSmoothed) * Math.min(1, dt * 6);
    // Digital Diorama revision 7: the playback rate follows a quicker estimate of the speed (about 50 ms behind) than the
    // gait choice does; following the slow one (about 170 ms), planted feet slid as an animal set off or stopped
    this.speedFast += (sp - this.speedFast) * Math.min(1, dt * 20);
    this.lastPos.copy(this.root.position);
    const scale = this.root.scale.x * m.exhibitScale;
    const rel = this.speedSmoothed / Math.max(0.2, scale);
    this.relFast = this.speedFast / Math.max(0.2, scale);
    if (this.mixer) {
      if (!this.forcedClip) this.autoClip(rel);
      // a gait chosen by a script still keeps its feet planted while the animal moves (and steps at its own pace in place)
      else if (this.currentName === this.forcedClip && this.gaitMeta(this.forcedClip)) {
        if (rel > 0.02) this.playGait(this.forcedClip, this.relFast); else this.play(this.forcedClip, 0.25, 1);
      }
      for (const [name] of this.holds) if (!this.restQuats.has(name)) {
        const b = m.raw.getObjectByName(name);
        if (b) this.restQuats.set(name, b.quaternion.clone());
      }
      for (const [name, q] of this.restQuats) { const b = m.raw.getObjectByName(name); if (b && this.holds.has(name)) b.quaternion.copy(q); }
      this.mixer.update(dt);
      for (const [name, deg] of this.holds) {
        const b = m.raw.getObjectByName(name);
        if (b) b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(this.boneAxis(name), deg * DEG));
      }
    }
    if (m.rig.length) this.animateRig(dt, t, rel);
    m.update?.(t);
    if (this.glowAtNight && world.night !== undefined) {
      const fungus = this.def.category === 'fungi';
      const dark = THREE.MathUtils.smoothstep(world.night, 0.3, 0.8);
      const blink = fungus ? dark * (0.75 + 0.25 * Math.sin(t * 1.3 + this.circlePhase)) : dark * (Math.sin(t * 3.1 + this.circlePhase * 7) > 0.15 ? 1 : 0.08);
      if (Math.abs(blink - this.lastBlink) > 0.02) {
        if (!fungus) this.setGlow(blink > 0.1 ? '#d8ff6a' : null, 2.2 * blink);
        this.setHalo(fungus ? '#7dff5a' : '#e6ff7a', fungus ? 1.1 : 0.7, blink * (fungus ? 0.7 : 0.95));
        this.lastBlink = blink;
      }
    }
    if (this.bubble && this.bubbleTimer !== Infinity) {
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) this.clearBubble();
    }
  }

  private boneAxis(name: string) {
    if (/^Ear|^Humerus/.test(name)) return new THREE.Vector3(0, 0, 1);
    if (/^Head$|^Tail/.test(name) && this.def.family === 'mammal' && name.startsWith('Tail')) return new THREE.Vector3(0, 1, 0);
    if (name === 'Head' && this.def.family === 'bird') return new THREE.Vector3(0, 1, 0);
    return new THREE.Vector3(1, 0, 0);
  }

  private autoClip(rel: number) {
    const has = (n: string) => this.actions.has(n);
    if (this.def.family === 'bird') {
      if (this.airborne) {
        if (has('glide') && rel > 3 && Math.sin(performance.now() / 2300 + this.circlePhase) > 0.35) this.play('glide', 0.4);
        else this.play('flap', 0.25, clamp(0.8 + rel * 0.05, 0.8, 1.6));
      } else {
        // Digital Diorama revision 8: a bird's walk plants its feet and carries its stride, so it plays at the rate the
        // feet need, starting and stopping (like the mammals) at a share of its own pace. It used to play at
        // clamp(rel × 1.2, 0.6, 2.2) whatever the bird's size, and the feet slid about 1.8 hip heights a step.
        const walk = this.gaitMeta('walk'), cur = this.currentName;
        const start = walk ? (walk.speed ?? 1) * (cur === 'walk' ? 0.08 : 0.12) : 0.12;
        if (rel > start) {
          if (walk) this.playGait('walk', this.relFast, 0.2);
          else this.play(has('walk') ? 'walk' : 'hop', 0.2, clamp(rel * 1.2, 0.6, 2.2));
        } else if (cur === 'flap' || cur === 'glide' || cur === 'walk' || cur === 'hop' || !cur) this.play(this.idleClip(), 0.35);
      }
      return;
    }
    // Digital Diorama revision 11: a swimmer in the water swims (the herp rig's swim clip: tail sculling, legs folded
    // or flippers beating), at the rate its stroke carries it; on land it walks
    const swim = this.wet ? this.gaitMeta('swim') : null;
    if (swim) {
      if (rel > (swim.speed ?? 0.5) * 0.06) this.playGait('swim', this.relFast, 0.35);
      else if (this.currentName === 'swim' || !this.currentName) this.play(this.idleClip(), 0.5);
      return;
    }
    if (this.gaitByStride(rel)) return;
    if (rel < 0.08) {
      if (['walk', 'trot', 'gallop'].includes(this.currentName) || !this.currentName) this.play(this.idleClip(), 0.35);
    } else if (rel < 1.1 || !has('trot')) this.play('walk', 0.25, clamp(rel / 0.75, 0.5, 2));
    else if (rel < 2.4 || !has('gallop')) this.play('trot', 0.25, clamp(rel / 1.6, 0.6, 1.8));
    else this.play('gallop', 0.25, clamp(rel / 3.2, 0.7, 1.6));
  }

  /** stride metadata of a gait clip (rigged mammals: distance per cycle and the hip height it was timed for) */
  private gaitMeta(name: string) {
    const ud = this.actions.get(name)?.getClip().userData as { stride?: number; speed?: number; hipH?: number } | undefined;
    return ud?.stride && ud.hipH ? (ud as { stride: number; speed?: number; hipH: number }) : null;
  }

  /**
   * play a gait clip at the rate that carries its planted feet back at ground speed `rel`, so they don't slide
   * (Digital Diorama revision 7: down to a tenth of the clip's own speed; held at 0.3, a slow walk's feet slid 10-15 cm a step)
   */
  private playGait(name: string, rel: number, fade = 0.15) {
    const m = this.gaitMeta(name), a = this.actions.get(name);
    if (!m || !a) return this.play(name, fade);
    return this.play(name, fade, clamp((rel * a.getClip().duration) / m.stride, 0.1, 2.5));
  }

  /**
   * Gaits for clips that carry stride metadata (the rigged mammals): picked by Froude number v²/(g·h), which is how
   * animals of every size change gait — walk below about 0.5, trot to about 2.5, gallop above (switching back a
   * little lower, so a steady speed never flickers between two gaits) — and played at the speed the feet need.
   */
  private gaitByStride(rel: number) {
    const walk = this.gaitMeta('walk');
    if (!walk) return false;
    const cur = this.currentName, moving = cur === 'walk' || cur === 'trot' || cur === 'gallop';
    const vWalk = walk.speed ?? Math.sqrt(0.2 * 9.81 * walk.hipH);
    // (Digital Diorama revision 7: an animal moving at more than a tenth of its walking pace walks, slowly, rather than
    // gliding in its idle; it used to stand still below about a fifth)
    if (rel < vWalk * (moving ? 0.08 : 0.12)) {
      if (moving || !cur) this.play(this.idleClip(), 0.35);
      return true;
    }
    const fr = (rel * rel) / (9.81 * walk.hipH);
    const toTrot = cur === 'trot' || cur === 'gallop' ? 0.42 : 0.5, toGallop = cur === 'gallop' ? 2.0 : 2.5;
    let want = fr < toTrot || !this.actions.has('trot') ? 'walk' : 'trot';
    if (want === 'trot' && fr >= toGallop && this.actions.has('gallop')) want = 'gallop';
    this.playGait(want, this.relFast);
    return true;
  }

  private animateRig(dt: number, t: number, rel: number) {
    const moving = rel > 0.08, stroke = this.model!.legStroke;
    // Digital Diorama revision 8: pivot legs step at the cadence whose back-swing keeps pace with the ground (half a
    // cycle per stroke, within 2-30 rad/s); at 6 + 4·rel whatever their length, a gecko's feet skidded about 15 cm a
    // step and a Komodo dragon's back-swung twice as fast as it walked. Hoppers keep the old beat.
    const cadence = stroke && this.def.loco !== 'hop' ? clamp((Math.PI * rel) / stroke, 2, 30) : 6 + rel * 4;
    this.gaitPhase += dt * (moving ? cadence : 0);
    const flying = this.airborne || (this.isFlyer && moving);
    for (const r of this.model!.rig) {
      let u: number;
      let speed = r.speed;
      if (this.holds.has(r.name)) {
        const v = this.holds.get(r.name)!;
        if (r.scale) r.node.scale[r.axis] = v; else r.node.rotation[r.axis] = r.base + v * DEG;
        continue;
      }
      switch (r.role) {
        case 'wing':
          u = flying ? (Math.sin(t * 18) * (/right|R$/.test(r.name) ? -1 : 1) + 1) / 2 : 0.35 + 0.3 * (Math.sin(t * speed * 1.6 + r.phase) + 1) / 2;
          break;
        case 'leg':
          u = (Math.sin(this.gaitPhase + r.phase) + 1) / 2;
          break;
        case 'tail':
          if (moving) speed *= 2.5;
          u = (Math.sin(t * speed * 1.6 + r.phase) + 1) / 2;
          break;
        case 'jaw':
          u = r.scale ? (Math.sin(t * 0.7 + r.phase) > 0.93 ? 1 : 0.05) : 0.18 * (Math.sin(t * speed + r.phase) + 1) / 2;
          break;
        default:
          u = (Math.sin(t * speed * 1.6 + r.phase) + 1) / 2;
      }
      if (r.role === 'leg' && !moving) {
        if (r.scale) r.node.scale[r.axis] = r.base; else r.node.rotation[r.axis] = r.base;
        continue;
      }
      const v = r.min + (r.max - r.min) * u;
      if (r.scale) r.node.scale[r.axis] = v;
      else r.node.rotation[r.axis] = r.base + v * DEG;
    }
    // a little body bob while walking for models without leg rigs
    if (moving && !this.model!.rig.some((r) => r.role === 'leg') && !flying && this.def.loco !== 'swim') {
      this.model!.object.position.y = Math.abs(Math.sin(this.gaitPhase)) * 0.04 * (this.model!.height);
    } else this.model!.object.position.y *= 0.8;
  }

  followGround(world: WorldQuery) {
    const p = this.root.position;
    const loco = this.def.loco;
    if (this.doc.grounded === false && !this.scripted && this.ambient === 'idle' && loco !== 'fly') return;
    const g = world.groundAt(p.x, p.z);
    const w = world.waterAt(p.x, p.z);
    const h = this.height;
    if (this.def.water === 'surface') { p.y = w ?? g; this.airborne = false; return; }
    if (this.def.water === 'bed') { p.y = g; this.airborne = false; return; }
    if (loco === 'scenery' || loco === 'sessile') {
      if (this.doc.grounded !== false) p.y = g + (this.doc.lift ?? 0);
      this.airborne = false;
      return;
    }
    if (this.isSwimmer) {
      this.wet = w !== null && w > g + 0.2;
      if (w !== null && w > g + 0.2) {
        const top = w - Math.max(0.15, h * 0.6), bottom = g + 0.12;
        p.y = clamp(g + this.lift, bottom, Math.max(bottom, top));
      } else p.y = g;
      this.airborne = false;
      return;
    }
    if (loco === 'fly' && this.lift > 0.05) {
      p.y = g + this.lift;
      if (w !== null && p.y < w + 0.3) p.y = w + 0.3;
      this.airborne = true;
      return;
    }
    this.airborne = false;
    // walkers wade, then swim with head above water
    if (w !== null && w - g > h * 0.55) p.y = w - h * 0.55;
    else p.y = g + Math.max(0, this.lift);
  }

  /* ---------- ambient behaviour ---------- */
  private pickTarget(world: WorldQuery, radius: number) {
    const b = world.bounds;
    for (let k = 0; k < 12; k++) {
      const a = this.R() * Math.PI * 2, d = (0.35 + this.R() * 0.65) * radius;
      const x = clamp(this.home.x + Math.cos(a) * d, b.minX + 0.8, b.maxX - 0.8);
      const z = clamp(this.home.z + Math.sin(a) * d, b.minZ + 0.8, b.maxZ - 0.8);
      const w = world.waterAt(x, z), g = world.groundAt(x, z);
      const wet = w !== null && w - g > this.height * 0.5;
      if (this.isSwimmer ? wet : !wet || this.def.family === 'mammal' && ['hippo', 'moose', 'otter', 'beaver', 'capybara', 'polarBear'].includes(String(this.def.params.species))) {
        this.ambientTarget.set(x, 0, z);
        return true;
      }
    }
    return false;
  }

  private runAmbient(dt: number, world: WorldQuery) {
    const p = this.root.position;
    const loco = this.def.loco;
    const sc = this.root.scale.x * (this.model?.exhibitScale ?? 1);
    if (loco === 'fly' && (this.doc.lift ?? 0) > 0.3) {
      // birds & flying insects circle lazily above their home at about their placed height
      const small = this.height < 0.5;
      const r = small ? 1.2 + sc * 0.5 : 3.5 + sc * 1.5;
      const base = this.doc.lift ?? 1;
      const targetLift = base * (1 + 0.25 * Math.sin(world.time * (small ? 0.7 : 0.3) + this.circlePhase));
      this.lift += (targetLift - this.lift) * Math.min(1, dt * 0.8);
      const spd = (this.def.speed ?? 2) * (small ? 0.6 : 0.5);
      this.circlePhase += dt * spd / r;
      const nx = this.home.x + Math.cos(this.circlePhase) * r, nz = this.home.z + Math.sin(this.circlePhase) * r;
      const b = world.bounds;
      p.x = clamp(nx, b.minX + 0.5, b.maxX - 0.5);
      p.z = clamp(nz, b.minZ + 0.5, b.maxZ - 0.5);
      this.root.rotation.y = Math.atan2(-Math.sin(this.circlePhase), Math.cos(this.circlePhase));
      this.ambient = 'circle';
      return;
    }
    if (this.isSwimmer) {
      const w = world.waterAt(p.x, p.z), g = world.groundAt(p.x, p.z);
      if (w === null || w - g < 0.3) return;
      const r = 1.5 + sc * 1.2;
      const spd = (this.def.speed ?? 0.8) * 0.5;
      this.circlePhase += dt * spd / r;
      const tx = this.home.x + Math.cos(this.circlePhase) * r * 1.2, tz = this.home.z + Math.sin(this.circlePhase * 0.8) * r;
      const tw = world.waterAt(tx, tz), tg = world.groundAt(tx, tz);
      if (tw !== null && tw - tg > 0.3) {
        const dx = tx - p.x, dz = tz - p.z;
        p.x = tx; p.z = tz;
        if (Math.abs(dx) + Math.abs(dz) > 1e-5) this.root.rotation.y = Math.atan2(dx, dz);
      }
      this.lift = (w - g) * (0.45 + 0.15 * Math.sin(world.time * 0.4 + this.circlePhase));
      this.ambient = 'swim';
      return;
    }
    // walkers / crawlers / hoppers
    this.ambientTimer -= dt;
    if (this.ambient === 'idle') {
      if (this.ambientTimer <= 0) {
        const radius = Math.min(6, 1.2 + this.radius * 4);
        if (this.pickTarget(world, radius)) { this.ambient = 'move'; this.ambientTimer = 12; }
        else this.ambientTimer = 2 + this.R() * 3;
        if (this.mixer && this.R() < 0.35) {
          const extra = ['graze', 'alert', 'peck'].filter((n) => this.actions.has(n));
          if (extra.length) { this.play(extra[Math.floor(this.R() * extra.length)], 0.3); this.ambient = 'idle'; this.ambientTimer = 3 + this.R() * 2; }
        }
      }
      return;
    }
    const dx = this.ambientTarget.x - p.x, dz = this.ambientTarget.z - p.z;
    const d = Math.hypot(dx, dz);
    let spd = (this.def.speed ?? 1) * Math.max(0.5, Math.sqrt(sc)) * 0.55;
    // Digital Diorama revision 8: a bird on the ground walks no faster than its legs carry it (1.3 times its walk's own
    // pace); a flying bird used to cross the ground at its flying speed, three to eight times that, its feet sliding
    if (this.def.family === 'bird') { const w = this.gaitMeta('walk'); if (w?.speed) spd = Math.min(spd, w.speed * sc * 1.3); }
    if (d < 0.08 || this.ambientTimer <= 0) {
      this.ambient = 'idle';
      this.ambientTimer = 3 + this.R() * 6;
      this.moveV = 0;
      return;
    }
    const want = Math.atan2(dx, dz);
    let diff = want - this.root.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.root.rotation.y += clamp(diff, -dt * 2.5, dt * 2.5);
    // Digital Diorama revision 7: walkers ease into their pace and slow down as they arrive (at full speed from the first
    // frame, their planted feet slid while the walk faded in); the gait's playback follows the actual speed
    const wantV = Math.abs(diff) < 0.9 ? spd * clamp(d / (spd * 0.5), 0.25, 1) : 0;
    this.moveV += (wantV - this.moveV) * Math.min(1, dt * 3);
    if (this.moveV > 1e-4) {
      const step = Math.min(d, this.moveV * dt);
      p.x += Math.sin(this.root.rotation.y) * step;
      p.z += Math.cos(this.root.rotation.y) * step;
    }
  }

  /** reset ambient anchor after an edit */
  setHome() { this.home.copy(this.root.position); this.lastPos.copy(this.root.position); this.ambient = 'idle'; }

  dispose() {
    this.clearBubble();
    if (this.label) { this.label.element.remove(); this.label = undefined; }
    this.mixer?.stopAllAction();
    this.root.parent?.remove(this.root);
  }
}
