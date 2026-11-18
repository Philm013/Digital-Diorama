import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { Actor, type WorldQuery } from './Actor';
import { Terrain, GROUND_TYPES, type SculptTool } from './Terrain';
import { Water } from './Water';
import { Frame } from './Frame';
import { SkyDome, skyAt, type SkyState } from './Sky';
import { Groundcover } from './Groundcover';
import { WeatherFX } from './Weather';
import { WIND, applyWind } from './wind';
import { probeHeights, sampleGrid, type HeightGrid } from './HeightProbe';
import { DEFAULT_ENV, type ActorDoc, type DioramaDoc, type EnvDoc, type Mode, type Quality } from './types';
import { getDef } from '../assets/catalog';
import { buildModel } from '../assets/builder';
import type { AssetDef } from '../assets/types';
import { clamp, nextFrame, uid, disposeObject } from './util';
import { BACKDROPS } from './backdropPainter';

export type EngineEvent =
  | { type: 'change' }
  | { type: 'select'; id: string | null }
  | { type: 'tap'; id: string | null; point?: THREE.Vector3 }
  | { type: 'loading'; done: number; total: number; label: string }
  | { type: 'loaded' }
  | { type: 'toast'; text: string; kind?: 'info' | 'error' | 'success' }
  | { type: 'key'; key: string; down: boolean }
  | { type: 'actors' }
  | { type: 'thunder' };

export interface BrushState { tool: SculptTool | 'paint' | null; radius: number; strength: number; ground: number }

const tmpV = new THREE.Vector3();

export class Engine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  labels: CSS2DRenderer;
  container: HTMLElement;
  clock = new THREE.Timer();
  time = 0;
  quality: Quality;

  doc!: DioramaDoc;
  terrain?: Terrain;
  water?: Water;
  base?: Actor;
  private groundGrid?: HeightGrid | null;
  private waterGrid?: HeightGrid | null;
  seaLevel: number | null = null;
  frame: Frame;
  sky = new SkyDome();
  groundcover = new Groundcover();
  weather = new WeatherFX();
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  fill: THREE.DirectionalLight;
  skyState: SkyState = skyAt(10.5);
  actors = new Map<string, Actor>();
  world = new THREE.Group();
  bounds = { minX: -20, maxX: 20, minZ: -14, maxZ: 14, bottom: -3, top: 14 };

  mode: Mode = 'explore';
  selectedId: string | null = null;
  playing = false;
  loading = false;
  brush: BrushState = { tool: null, radius: 2.5, strength: 0.06, ground: 0 };
  version = 0;
  private subs = new Set<() => void>();
  private listeners = new Set<(e: EngineEvent) => void>();
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private dirtyTimer = 0;
  private groundcoverTimer = 0;
  private pixelRatio = 1;
  private frameTimes: number[] = [];
  private maxPixelRatio = 2;
  onTick = new Set<(dt: number, t: number) => void>();
  /** set by the code runtime */
  runtime: { tick(dt: number): void; running: boolean } | null = null;
  autosave?: (doc: DioramaDoc) => void;
  private flight: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t: number; dur: number; done?: () => void } | null = null;
  private followId: string | null = null;
  walk: import('./WalkMode').WalkMode | null = null;
  xr: import('./XRMode').XRMode | null = null;
  disposed = false;
  private resizeObs?: ResizeObserver;
  /** debugging/screenshots: freeze ambient wandering */
  ambientOff = false;

  constructor(container: HTMLElement, quality: Quality) {
    this.container = container;
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.maxPixelRatio = quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = 'dd-canvas';
    container.appendChild(this.renderer.domElement);
    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'dd-labels';
    container.appendChild(this.labels.domElement);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 2500);
    this.camera.position.set(0, 18, 42);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 160;
    this.controls.screenSpacePanning = true;
    this.controls.zoomToCursor = true;

    this.sun = new THREE.DirectionalLight('#fff4e0', 2.6);
    this.sun.castShadow = true;
    const sm = quality === 'high' ? 2048 : quality === 'medium' ? 1536 : 1024;
    this.sun.shadow.mapSize.set(sm, sm);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight('#bcd8f0', '#5a4a36', 0.9);
    this.scene.add(this.hemi);
    this.fill = new THREE.DirectionalLight('#c9dcff', 0.35);
    this.fill.position.set(-30, 20, 40);
    this.scene.add(this.fill);

    this.frame = new Frame(quality !== 'low');
    this.world.name = 'world';
    this.scene.add(this.world, this.frame.group, this.sky.mesh, this.groundcover.group, this.weather.group);
    this.weather.onThunder = () => this.emit({ type: 'thunder' });

    window.addEventListener('resize', this.resize);
    // panels opening/closing change the viewport without a window resize
    if (typeof ResizeObserver !== 'undefined') { this.resizeObs = new ResizeObserver(() => this.resize()); this.resizeObs.observe(container); }
    this.resize();
    this.renderer.setAnimationLoop(this.tick);
  }

  /* ================= events ================= */
  on(fn: (e: EngineEvent) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(e: EngineEvent) { for (const fn of this.listeners) fn(e); }
  subscribe = (fn: () => void) => { this.subs.add(fn); return () => { this.subs.delete(fn); }; };
  getVersion = () => this.version;
  changed(persist = true) {
    this.version++;
    for (const fn of this.subs) fn();
    if (persist && this.doc && !this.playing) {
      this.doc.updated = Date.now();
      clearTimeout(this.dirtyTimer);
      this.dirtyTimer = window.setTimeout(() => this.autosave?.(this.serialize()), 1200);
    }
  }
  toast(text: string, kind: 'info' | 'error' | 'success' = 'info') { this.emit({ type: 'toast', text, kind }); }

  /* ================= sizing & quality ================= */
  resize = () => {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.weather.setPixelRatio(h * this.pixelRatio);
  };

  setQuality(q: Quality) {
    this.quality = q;
    this.maxPixelRatio = q === 'high' ? 2 : q === 'medium' ? 1.5 : 1;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.resize();
    this.rebuildGroundcover();
  }

  /* ================= world queries ================= */
  groundAt = (x: number, z: number): number => {
    if (this.terrain) return this.terrain.heightAt(x, z);
    if (this.groundGrid) return sampleGrid(this.groundGrid, x, z) ?? (this.seaLevel ?? 0) - 3;
    return 0;
  };
  waterAt = (x: number, z: number): number | null => {
    if (this.terrain) {
      const wl = this.terrain.waterLevel;
      return wl !== null && this.terrain.heightAt(x, z) < wl ? wl : null;
    }
    if (this.waterGrid) {
      const w = sampleGrid(this.waterGrid, x, z);
      if (w !== null && w > this.groundAt(x, z)) return w;
    }
    if (this.seaLevel !== null && this.groundAt(x, z) < this.seaLevel) return this.seaLevel;
    return null;
  };
  get worldQuery(): WorldQuery {
    return { groundAt: this.groundAt, waterAt: this.waterAt, bounds: this.bounds, time: this.time, night: this.skyState.night };
  }
  get env(): EnvDoc { return this.doc?.env ?? DEFAULT_ENV; }

  /* ================= loading ================= */
  async load(doc: DioramaDoc) {
    this.loading = true;
    this.stopPlay();
    this.clearWorld();
    this.doc = doc;
    this.doc.env = { ...DEFAULT_ENV, ...doc.env };
    const total = doc.actors.length + 3;
    let done = 0;
    const progress = (label: string) => { this.emit({ type: 'loading', done, total, label }); };
    progress('Shaping the land…');
    await nextFrame();
    // ---- base ----
    if (doc.base.kind === 'terrain') {
      this.terrain = Terrain.fromDoc(doc.base.terrain);
      this.world.add(this.terrain.group);
      this.water = new Water(this.terrain);
      this.world.add(this.water.mesh);
      const t = this.terrain;
      this.bounds = { minX: -t.width / 2, maxX: t.width / 2, minZ: -t.depth / 2, maxZ: t.depth / 2, bottom: t.bottomY, top: t.maxHeight() + 12 };
      this.seaLevel = t.waterLevel;
    } else {
      const def = getDef(doc.base.asset);
      if (def) {
        const actorDoc: ActorDoc = { id: 'base', asset: def.id, name: def.name, params: doc.base.params, pos: [0, 0, 0], rotY: 0, scale: 1, lift: 0, grounded: false };
        const base = new Actor(actorDoc, def);
        base.ambientEnabled = false;
        try {
          const model = await buildModel(def, doc.base.params, this.quality, true);
          base.setModel(model);
        } catch (e) { console.error(e); this.toast('Could not build the habitat tile', 'error'); }
        this.base = base;
        this.world.add(base.root);
        base.root.updateMatrixWorld(true);
        const isWater = (m: THREE.Mesh) => {
          const mat = m.material as THREE.Material;
          return /water|sea|surface/i.test(mat?.name ?? '') || /water|surface|sea/i.test(m.name);
        };
        this.groundGrid = probeHeights(this.renderer, base.root, (m) => !isWater(m) && !(m.material as THREE.Material).transparent && !/sway|glass|foam|glow/i.test((m.material as THREE.Material).name ?? ''), 256);
        this.waterGrid = probeHeights(this.renderer, base.root, isWater, 128);
        this.seaLevel = 0;
        const box = new THREE.Box3().setFromObject(base.root);
        this.bounds = { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, bottom: box.min.y, top: box.max.y + 10 };
      }
    }
    done++;
    progress('Painting the backdrop…');
    await nextFrame();
    this.buildFrame();
    this.applyEnv();
    done++;
    progress('Growing grass…');
    await nextFrame();
    this.rebuildGroundcover(true);
    this.buildWeather();
    // ---- actors ----
    for (const a of doc.actors) {
      const def = getDef(a.asset);
      done++;
      progress(def ? `Adding ${def.name}…` : 'Adding…');
      if (!def) continue;
      await this.spawn(a, def);
      await nextFrame();
    }
    done++;
    this.frameCamera(true);
    this.loading = false;
    this.undoStack = [];
    this.redoStack = [];
    this.emit({ type: 'loaded' });
    this.emit({ type: 'actors' });
    this.changed(false);
  }

  /** seasonal colour overrides for trees — applied at build time, never saved into the document */
  seasonParams(def: AssetDef, season = this.env.season): Record<string, unknown> {
    if (def.family === 'deciduous') return { leafHueAndSeason: { spring: 'freshSpring', summer: 'deepSummer', autumn: 'peakAutumn', winter: 'moonlit' }[season] };
    if (def.family === 'terraTree' && ['broadleaf', 'shrub', 'acacia'].includes(String(def.params.species))) return season === 'autumn' ? { colorway: 'autumn' } : season === 'winter' ? { colorway: 'dusk' } : {};
    if (def.family === 'water' && def.id.startsWith('grove/') && season === 'autumn') return { colorway: 'autumn' };
    return {};
  }
  private paramsFor(a: ActorDoc, def: AssetDef) {
    return { ...this.seasonParams(def), ...a.params };
  }

  private async spawn(a: ActorDoc, def: AssetDef) {
    const actor = new Actor(a, def);
    this.actors.set(a.id, actor);
    this.world.add(actor.root);
    try {
      const model = await buildModel(def, this.paramsFor(a, def), this.quality, this.env.trueScale);
      if (!this.actors.has(a.id)) return actor; // removed while building
      actor.setModel(model);
      this.decorate(actor);
      actor.followGround(this.worldQuery);
      actor.setHome();
      this.syncActorLabel(actor);
      model.setNight?.(this.skyState.night);
    } catch (e) {
      console.error('Failed to build', def.id, e);
      this.toast(`Couldn’t build ${def.name}`, 'error');
    }
    return actor;
  }

  /** temporary actors created by scripts (clones, spawned species) — never saved */
  async spawnTemp(doc: ActorDoc, def: AssetDef): Promise<Actor | null> {
    const a = await this.spawn(doc, def);
    a.isClone = true;
    this.emit({ type: 'actors' });
    return a;
  }

  /** per-family touches: wind sway for vegetation */
  private decorate(actor: Actor) {
    const d = actor.def;
    if (d.category === 'plants' && d.family !== 'water') {
      const h = actor.model!.height / (actor.model!.exhibitScale || 1);
      actor.model!.object.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh) for (const mat of Array.isArray(m.material) ? m.material : [m.material]) applyWind(mat, h, d.family === 'plant' ? 0.6 : 0.35);
      });
    }
  }

  clearWorld() {
    for (const a of this.actors.values()) { a.dispose(); disposeObject(a.root, false); }
    this.actors.clear();
    this.selectedId = null;
    if (this.terrain) { this.world.remove(this.terrain.group); this.terrain.dispose(); this.terrain = undefined; }
    if (this.water) { this.world.remove(this.water.mesh); this.water.dispose(); this.water = undefined; }
    if (this.base) { this.base.dispose(); disposeObject(this.base.root); this.base = undefined; }
    this.groundGrid = null;
    this.waterGrid = null;
    this.groundcover.clear();
    this.weather.clear();
    this.frame.clear();
  }

  serialize(): DioramaDoc {
    const d = this.doc;
    if (this.terrain && d.base.kind === 'terrain') d.base.terrain = this.terrain.toDoc();
    d.actors = [...this.actors.values()].filter((a) => !a.isClone).map((a) => a.doc);
    return JSON.parse(JSON.stringify(d));
  }

  /* ================= frame / env ================= */
  buildFrame() {
    const env = this.env;
    const b = this.bounds;
    let groundY = 0, backY = 0;
    if (this.terrain) {
      const t = this.terrain;
      let s = 0, n = 0, bs = 0, bn = 0;
      for (let i = 0; i < t.nx; i += 4) { s += t.h(i, Math.floor(t.nz / 2)); n++; bs += t.h(i, 0); bn++; }
      groundY = s / n; backY = Math.max(bs / bn, groundY);
    } else { groundY = 0; backY = 1; }
    const subtitle = this.doc.author ? `by ${this.doc.author}` : (BACKDROPS[env.backdrop]?.name ?? '');
    this.frame.build(env.frame, env.backdrop, { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, bottomY: b.bottom, topY: b.top, groundY, backGroundY: backY }, this.doc.title, subtitle);
    this.sky.mesh.visible = env.frame === 'island' || env.frame === 'open' || !!this.walk?.active;
    const room = env.frame === 'shoebox' || env.frame === 'museum';
    this.scene.background = room ? new THREE.Color('#d8cfc2') : null;
    // shadow camera covers the whole box
    const sc = this.sun.shadow.camera;
    const half = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.75 + 4;
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = 400;
    sc.updateProjectionMatrix();
  }

  setEnv(patch: Partial<EnvDoc>, recordUndo = true) {
    if (recordUndo) this.pushUndo();
    const prev = { ...this.env };
    Object.assign(this.doc.env, patch);
    const env = this.env;
    if (patch.frame !== undefined || patch.backdrop !== undefined) this.buildFrame();
    if (patch.weather !== undefined && patch.weather !== prev.weather) this.buildWeather();
    if ((patch.grass !== undefined && patch.grass !== prev.grass) || (patch.season !== undefined && patch.season !== prev.season)) this.rebuildGroundcover(true);
    if (patch.labels !== undefined) for (const a of this.actors.values()) this.syncActorLabel(a);
    if (patch.trueScale !== undefined && patch.trueScale !== prev.trueScale) void this.rebuildAll();
    else if (patch.season !== undefined && patch.season !== prev.season) void this.rebuildWhere((a) => JSON.stringify(this.seasonParams(a.def, prev.season)) !== JSON.stringify(this.seasonParams(a.def, patch.season)));
    if (patch.weather !== undefined && (patch.weather === 'snow') !== (prev.weather === 'snow')) this.rebuildGroundcover(true);
    this.applyEnv();
    void env;
    this.changed();
  }

  /** apply time-of-day / weather / fog / season to lights and materials */
  applyEnv() {
    const env = this.env;
    const s = skyAt(env.time, this.skyState);
    const overcast = env.weather === 'cloudy' ? 0.55 : env.weather === 'rain' ? 0.75 : env.weather === 'storm' ? 0.9 : env.weather === 'snow' ? 0.6 : env.weather === 'fog' ? 0.5 : 0;
    const under = !!BACKDROPS[env.backdrop]?.underwater;
    const b = this.bounds;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const night = s.night;
    const lightDir = night > 0.5 ? s.moonDir : s.sunDir;
    this.sun.position.set(cx + lightDir.x * 80, lightDir.y * 80 + 5, cz + lightDir.z * 80);
    this.sun.target.position.set(cx, 0, cz);
    this.sun.color.copy(s.lightColor);
    let li = s.lightIntensity * (1 - overcast * 0.55);
    if (under) li *= 0.85;
    this.sun.intensity = li + this.weather.flash * 6;
    this.hemi.color.copy(s.hemiSky);
    if (under) this.hemi.color.lerp(new THREE.Color('#5fb2c8'), 0.6);
    this.hemi.groundColor.copy(s.hemiGround);
    this.hemi.intensity = s.hemiIntensity * (1 + overcast * 0.3) * (under ? 1.55 : 1) + this.weather.flash * 2;
    this.fill.intensity = 0.35 * (1 - night * 0.8);
    this.renderer.toneMappingExposure = 1.05 + night * 0.25;
    this.frame.applySky(s, overcast, this.time, under ? { top: '#0d3a5a', horizon: '#2f8fb0' } : undefined);
    this.sky.apply(s, overcast, this.time, s.horizon.clone().lerp(new THREE.Color('#a9bccb'), 0.4).multiplyScalar(1 - night * 0.7));
    // fog: subtle depth haze, thick for fog weather or underwater
    const size = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    const walkingNow = !!this.walk?.active;
    const fogAmt = clamp(env.fog + (env.weather === 'fog' ? 0.6 : 0) + (under ? (walkingNow ? 0.45 : 0.12) : 0), 0, 1);
    const walking = !!this.walk?.active;
    if (fogAmt > 0.01 || walking) {
      const col = under ? new THREE.Color('#2a7f9e').multiplyScalar(1 - night * 0.7) : s.horizon.clone().lerp(new THREE.Color('#c8ccd0'), overcast * 0.6);
      const near = walking ? size * (0.6 - fogAmt * 0.5) : this.camera.position.distanceTo(this.controls.target) * (1.0 - fogAmt * 0.55);
      const far = near + size * (walking ? 2.6 : 2.2) * (1.15 - fogAmt);
      if (!(this.scene.fog instanceof THREE.Fog)) this.scene.fog = new THREE.Fog(col, near, far);
      const f = this.scene.fog as THREE.Fog;
      f.color.copy(col); f.near = near; f.far = far;
    } else this.scene.fog = null;
    if (this.scene.background instanceof THREE.Color) this.scene.background.set('#d8cfc2').multiplyScalar(1 - night * 0.6);
    if (this.water) {
      const u = this.water.material.uniforms;
      (u.uSky.value as THREE.Color).copy(s.top);
      (u.uHorizon.value as THREE.Color).copy(s.horizon);
      (u.uSunDir.value as THREE.Vector3).copy(lightDir);
      (u.uSunColor.value as THREE.Color).copy(s.sunColor);
      u.uSunIntensity.value = s.sunUp * (1 - overcast);
      u.uRain.value = env.weather === 'rain' ? 0.8 : env.weather === 'storm' ? 1 : 0;
      u.uNight.value = night;
    }
    this.terrain?.setSnow(env.season === 'winter' || env.weather === 'snow' ? (env.season === 'winter' ? 0.85 : 0.5) : 0);
    WIND.uWind.value = env.wind * (env.weather === 'storm' ? 2.2 : env.weather === 'rain' ? 1.3 : 1);
    // night lights in assets
    for (const a of this.actors.values()) a.model?.setNight?.(night);
    this.base?.model?.setNight?.(night);
  }

  buildWeather() {
    const b = this.bounds;
    const ground = this.terrain ? this.terrain.minHeight() : this.seaLevel ?? 0;
    this.weather.build(this.env.weather, { minX: b.minX + 0.3, maxX: b.maxX - 0.3, minZ: b.minZ + 0.3, maxZ: b.maxZ - 0.3, bottom: ground - 0.5, top: b.top }, this.quality);
  }

  rebuildGroundcover(now = false) {
    if (!this.terrain) { this.groundcover.clear(); return; }
    const run = () => {
      if (!this.terrain) return;
      const blockers = [...this.actors.values()].filter((a) => a.def.category !== 'animals' && a.def.family !== 'terraTree' && (a.def.family === 'water' || a.def.family === 'rock' || a.def.family === 'builtin'));
      const snowy = this.env.season === 'winter' || this.env.weather === 'snow';
      this.groundcover.build(this.terrain, this.env.grass * (snowy ? 0.3 : 1), this.quality, snowy ? 'winter' : this.env.season, this.terrain.seed, (x, z) => blockers.some((a) => Math.hypot(a.root.position.x - x, a.root.position.z - z) < a.radius * 0.8));
    };
    clearTimeout(this.groundcoverTimer);
    if (now) run(); else this.groundcoverTimer = window.setTimeout(run, 350);
  }

  /* ================= actors ================= */
  get actorList() { return [...this.actors.values()]; }
  getActor(id: string | null | undefined) { return id ? this.actors.get(id) : undefined; }

  uniqueName(base: string) {
    const names = new Set([...this.actors.values()].map((a) => a.doc.name));
    if (!names.has(base)) return base;
    for (let i = 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`;
  }

  defaultLift(def: AssetDef) {
    if (def.loco === 'fly') return def.family === 'bird' || (def.realLength ?? 1) > 0.15 ? 3.5 : 0.9;
    if (def.loco === 'swim' || def.water === 'column') return 1.2;
    return 0;
  }

  /** find a dry (or wet, for swimmers) free spot near a point */
  findSpot(def: AssetDef, near?: THREE.Vector3): THREE.Vector3 {
    const b = this.bounds;
    const wantWet = def.loco === 'swim' || !!def.water;
    let best: THREE.Vector3 | null = null;
    for (let k = 0; k < 40; k++) {
      const r = near ? 1 + k * 0.4 : 0;
      const x = near ? near.x + (Math.random() - 0.5) * r * 2 : b.minX + 2 + Math.random() * (b.maxX - b.minX - 4);
      const z = near ? near.z + (Math.random() - 0.5) * r * 2 : b.minZ + 2 + Math.random() * (b.maxZ - b.minZ - 4) * 0.8 + (b.maxZ - b.minZ) * 0.1;
      const cx = clamp(x, b.minX + 1, b.maxX - 1), cz = clamp(z, b.minZ + 1, b.maxZ - 1);
      const wet = this.waterAt(cx, cz) !== null;
      if (wet === wantWet || (def.water === 'surface' && wet)) { best = new THREE.Vector3(cx, this.groundAt(cx, cz), cz); break; }
      if (!best) best = new THREE.Vector3(cx, this.groundAt(cx, cz), cz);
    }
    return best!;
  }

  async addActor(assetId: string, at?: THREE.Vector3, opts: Partial<ActorDoc> = {}, record = true): Promise<Actor | null> {
    const def = getDef(assetId);
    if (!def) return null;
    if (record) this.pushUndo();
    const p = at ?? this.findSpot(def);
    const doc: ActorDoc = {
      id: uid('a'), asset: def.id, name: this.uniqueName(def.name), params: {},
      pos: [p.x, p.y, p.z], rotY: (Math.random() - 0.5) * 1.6, scale: 1,
      lift: this.defaultLift(def), grounded: true, label: { show: true }, ...opts,
    };
    const actor = await this.spawn(doc, def);
    this.rebuildGroundcover();
    this.emit({ type: 'actors' });
    this.changed();
    return actor;
  }

  removeActor(id: string, record = true) {
    const a = this.actors.get(id);
    if (!a) return;
    if (record && !a.isClone) this.pushUndo();
    if (this.selectedId === id) this.select(null);
    a.dispose();
    disposeObject(a.root, false);
    this.actors.delete(id);
    if (!a.isClone) { this.rebuildGroundcover(); this.emit({ type: 'actors' }); this.changed(); }
  }

  async duplicateActor(id: string) {
    const a = this.actors.get(id);
    if (!a) return null;
    const p = a.root.position.clone().add(new THREE.Vector3(a.radius * 2 + 0.4, 0, 0.3));
    p.x = clamp(p.x, this.bounds.minX + 0.5, this.bounds.maxX - 0.5);
    const doc = JSON.parse(JSON.stringify(a.doc)) as ActorDoc;
    const copy = await this.addActor(a.def.id, p, { params: doc.params, scale: doc.scale, lift: doc.lift, rotY: doc.rotY, scripts: doc.scripts, label: doc.label, note: doc.note });
    if (copy) this.select(copy.id);
    return copy;
  }

  async updateParams(id: string, params: Record<string, unknown>) {
    const a = this.actors.get(id);
    if (!a) return;
    this.pushUndo();
    a.doc.params = { ...a.doc.params, ...params };
    for (const [k, v] of Object.entries(params)) if (v === undefined) delete a.doc.params[k];
    await this.rebuildActor(a);
    this.changed();
  }

  async rebuildActor(a: Actor) {
    try {
      const model = await buildModel(a.def, this.paramsFor(a.doc, a.def), this.quality, this.env.trueScale);
      a.setModel(model);
      this.decorate(a);
      a.followGround(this.worldQuery);
      this.syncActorLabel(a);
      if (this.selectedId === a.id) a.setSelected(true);
      model.setNight?.(this.skyState.night);
    } catch (e) {
      console.error(e);
      this.toast(`Couldn’t rebuild ${a.def.name}`, 'error');
    }
  }

  async rebuildWhere(fn: (a: Actor) => boolean) {
    for (const a of [...this.actors.values()]) if (fn(a)) { await this.rebuildActor(a); await nextFrame(); }
  }

  async rebuildAll() {
    for (const a of this.actors.values()) { await this.rebuildActor(a); await nextFrame(); }
    this.changed(false);
  }

  /** write the live transform back into the document */
  commitTransform(a: Actor) {
    a.doc.pos = [a.root.position.x, a.root.position.y, a.root.position.z];
    a.doc.rotY = a.root.rotation.y;
    a.doc.scale = a.root.scale.x;
    a.setHome();
  }

  syncActorLabel(a: Actor) {
    const show = this.env.labels && a.doc.label?.show !== false && a.def.category !== 'sky' && a.def.category !== 'habitats';
    const saved = a.doc.label;
    a.doc.label = { ...(saved ?? {}), show };
    a.syncLabel();
    a.doc.label = saved;
  }

  select(id: string | null) {
    if (this.selectedId === id) return;
    this.getActor(this.selectedId)?.setSelected(false);
    this.selectedId = id;
    this.getActor(id)?.setSelected(this.mode === 'build' || this.mode === 'code');
    this.emit({ type: 'select', id });
    this.changed(false);
  }

  setMode(m: Mode) {
    this.mode = m;
    const sel = this.getActor(this.selectedId);
    sel?.setSelected(m !== 'explore');
    this.brush.tool = null;
    this.changed(false);
  }

  /* ================= picking ================= */
  private raycaster = new THREE.Raycaster();
  private ndc(clientX: number, clientY: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }
  pickActor(clientX: number, clientY: number): { actor: Actor; point: THREE.Vector3 } | null {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const roots = [...this.actors.values()].filter((a) => a.root.visible && a.model).map((a) => a.root);
    const hits = this.raycaster.intersectObjects(roots, true);
    for (const h of hits) {
      if ((h.object as THREE.Mesh).name === 'selection-ring' || h.object.name === 'toothpick') continue;
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.actorId) o = o.parent;
      const id = o?.userData.actorId;
      if (id && this.actors.has(id)) return { actor: this.actors.get(id)!, point: h.point };
    }
    return null;
  }
  /** point on the ground (terrain or habitat tile) under the cursor */
  pickGround(clientX: number, clientY: number, includeActors = false): { point: THREE.Vector3; actor?: Actor } | null {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const targets: THREE.Object3D[] = [];
    if (this.terrain) targets.push(this.terrain.surface);
    if (this.base) targets.push(this.base.root);
    if (includeActors) for (const a of this.actors.values()) if (a.def.category === 'plants' || a.def.category === 'land' || a.def.category === 'fungi') targets.push(a.root);
    const hits = this.raycaster.intersectObjects(targets, true).filter((h) => (h.object as THREE.Mesh).isMesh && !/water|surface|sea/i.test(((h.object as THREE.Mesh).material as THREE.Material)?.name ?? ''));
    if (hits.length) {
      const h = hits[0];
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.actorId) o = o.parent;
      const actor = o?.userData.actorId && o.userData.actorId !== 'base' ? this.actors.get(o.userData.actorId) : undefined;
      return { point: h.point.clone(), actor };
    }
    // fall back to a horizontal plane at ground level
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(this.seaLevel ?? 0));
    const p = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(plane, p)) {
      const b = this.bounds;
      if (p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ) { p.y = this.groundAt(p.x, p.z); return { point: p }; }
    }
    return null;
  }

  /* ================= terrain tools ================= */
  private flattenTo = 0;
  beginStroke(p: THREE.Vector3) {
    this.pushUndo();
    this.flattenTo = p.y;
  }
  strokeAt(p: THREE.Vector3, dt: number) {
    const t = this.terrain;
    if (!t || !this.brush.tool) return;
    if (this.brush.tool === 'paint') t.paintAt(this.brush.ground, p.x, p.z, this.brush.radius);
    else t.sculpt(this.brush.tool, p.x, p.z, this.brush.radius, this.brush.strength * dt * 10, this.flattenTo);
    t.rebuild();
    this.water?.sync();
    for (const a of this.actors.values()) if (a.doc.grounded !== false) { a.followGround(this.worldQuery); }
  }
  endStroke() {
    if (!this.terrain) return;
    this.bounds.bottom = this.terrain.bottomY;
    this.rebuildGroundcover();
    for (const a of this.actors.values()) this.commitTransform(a);
    this.changed();
  }
  setWaterLevel(v: number | null) {
    if (!this.terrain) return;
    this.pushUndo();
    this.terrain.setWaterLevel(v);
    this.water?.sync();
    this.seaLevel = v;
    this.bounds.bottom = this.terrain.bottomY;
    for (const a of this.actors.values()) { a.followGround(this.worldQuery); this.commitTransform(a); }
    this.rebuildGroundcover();
    this.buildFrame();
    this.changed();
  }
  get groundTypes() { return GROUND_TYPES; }

  /* ================= undo ================= */
  private snapshot() {
    const d = this.doc;
    const terrain = this.terrain ? this.terrain.toDoc() : null;
    return JSON.stringify({ env: d.env, actors: [...this.actors.values()].filter((a) => !a.isClone).map((a) => a.doc), terrain, title: d.title });
  }
  pushUndo() {
    if (this.loading || this.playing) return;
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 40) this.undoStack.shift();
    this.redoStack = [];
  }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  async undo() { await this.restoreFrom(this.undoStack, this.redoStack); }
  async redo() { await this.restoreFrom(this.redoStack, this.undoStack); }
  private async restoreFrom(from: string[], to: string[]) {
    const snap = from.pop();
    if (!snap) return;
    to.push(this.snapshot());
    const s = JSON.parse(snap) as { env: EnvDoc; actors: ActorDoc[]; terrain: import('./types').TerrainDoc | null };
    // terrain
    if (s.terrain && this.terrain && this.doc.base.kind === 'terrain') {
      const t = Terrain.fromDoc(s.terrain);
      this.terrain.heights.set(t.heights);
      this.terrain.paint.set(t.paint);
      this.terrain.waterLevel = t.waterLevel;
      this.terrain.rebuild();
      this.water?.sync();
      t.dispose();
    }
    // env
    const envChanged = JSON.stringify(s.env) !== JSON.stringify(this.doc.env);
    if (envChanged) this.setEnv(s.env, false);
    // actors: reconcile
    const want = new Map(s.actors.map((a) => [a.id, a]));
    for (const a of [...this.actors.values()]) if (!want.has(a.id) && !a.isClone) this.removeActor(a.id, false);
    for (const d of s.actors) {
      const cur = this.actors.get(d.id);
      if (!cur) { const def = getDef(d.asset); if (def) await this.spawn(d, def); continue; }
      const paramsChanged = JSON.stringify(cur.doc.params) !== JSON.stringify(d.params);
      cur.doc = d;
      cur.applyDocTransform();
      if (paramsChanged) await this.rebuildActor(cur);
      this.syncActorLabel(cur);
      cur.followGround(this.worldQuery);
    }
    this.rebuildGroundcover();
    this.emit({ type: 'actors' });
    this.changed();
  }

  /* ================= camera ================= */
  frameCamera(instant = false) {
    const b = this.bounds;
    const w = b.maxX - b.minX, d = b.maxZ - b.minZ;
    const target = new THREE.Vector3((b.minX + b.maxX) / 2, Math.max(0, (this.terrain?.maxHeight() ?? 2) * 0.25), (b.minZ + b.maxZ) / 2 + d * 0.05);
    const fov = this.camera.fov * Math.PI / 180;
    // in portrait we let the sides crop a little so the diorama fills the screen
    const aspect = Math.max(0.72, this.camera.aspect);
    const dist = Math.max(w / aspect, d * 1.15) / (2 * Math.tan(fov / 2)) * 0.98 + d * 0.12;
    const pos = target.clone().add(new THREE.Vector3(0, Math.sin(0.5) * dist, Math.cos(0.5) * dist));
    this.controls.maxDistance = dist * 3;
    if (instant) { this.camera.position.copy(pos); this.controls.target.copy(target); this.controls.update(); }
    else this.flyTo(pos, target, 1.2);
  }

  flyTo(pos: THREE.Vector3, target: THREE.Vector3, dur = 1.2, done?: () => void) {
    this.flight = { from: this.camera.position.clone(), to: pos.clone(), tFrom: this.controls.target.clone(), tTo: target.clone(), t: 0, dur, done };
  }

  focusActor(id: string, dur = 1.1, done?: () => void) {
    const a = this.actors.get(id);
    if (!a) return;
    const h = a.height, r = Math.max(a.radius, h * 0.6);
    const target = a.root.position.clone().add(new THREE.Vector3(0, h * 0.5, 0));
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    if (dir.y < 0.25) dir.y = 0.25;
    dir.normalize();
    const dist = clamp(r * 4.2 + 1.5, 2.5, 40);
    this.flyTo(target.clone().addScaledVector(dir, dist), target, dur, done);
  }

  follow(id: string | null) { this.followId = id; }

  /* ================= play mode hooks ================= */
  startPlay() {
    this.playing = true;
    this.changed(false);
  }
  stopPlay() {
    this.playing = false;
    this.followId = null;
    this.changed(false);
  }

  /* ================= loop ================= */
  private tick = (_t?: number, frame?: XRFrame) => {
    if (this.disposed) return;
    if (this.xr?.active) this.xr.update(frame);
    this.clock.update();
    const dt = Math.min(0.1, this.clock.getDelta());
    this.time += dt;
    const t = this.time;
    if (this.doc) {
      const env = this.env;
      if (env.daySpeed > 0 && !this.loading) {
        env.time = (env.time + dt * env.daySpeed / 60) % 24;
        this.applyEnv();
      } else if (this.weather.flash > 0 || (Math.floor(t * 4) !== Math.floor((t - dt) * 4))) this.applyEnv();
      WIND.uTime.value = t;
      this.water?.update(t);
      this.weather.update(t, dt);
      const live = (this.mode === 'explore' || this.playing) && !this.ambientOff;
      const q = this.worldQuery;
      this.runtime?.tick(dt);
      for (const a of this.actors.values()) a.update(dt, t, q, live);
      this.base?.update(dt, t, q, false);
      for (const fn of this.onTick) fn(dt, t);
    }
    if (this.flight) {
      const f = this.flight;
      f.t += dt / f.dur;
      const k = f.t >= 1 ? 1 : 1 - Math.pow(1 - f.t, 3);
      this.camera.position.lerpVectors(f.from, f.to, k);
      this.controls.target.lerpVectors(f.tFrom, f.tTo, k);
      if (f.t >= 1) { this.flight = null; f.done?.(); }
    } else if (this.followId) {
      const a = this.actors.get(this.followId);
      if (a) {
        tmpV.copy(a.root.position).add(new THREE.Vector3(0, a.height * 0.5, 0));
        const delta = tmpV.clone().sub(this.controls.target);
        this.controls.target.add(delta);
        this.camera.position.add(delta);
      }
    }
    if (this.walk?.active) this.walk.update(dt);
    else if (!this.xr?.active) this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (!this.xr?.active) { this.labels.render(this.scene, this.camera); this.adaptResolution(dt); }
  };

  private adaptResolution(dt: number) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 45) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    const max = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
    let pr = this.pixelRatio;
    if (avg > 1 / 32 && pr > 0.75) pr = Math.max(0.75, pr - 0.25);
    else if (avg < 1 / 55 && pr < max) pr = Math.min(max, pr + 0.25);
    if (pr !== this.pixelRatio) { this.pixelRatio = pr; this.renderer.setPixelRatio(pr); this.resize(); }
  }

  screenshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.resize);
    this.resizeObs?.disconnect();
    this.clearWorld();
    this.frame.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }
}
