import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createAsset, createClips, setPose, species as SPECIES } from '../assets/animals/mammal-rig.mjs';

export type ViewPreset = 'q34' | 'side' | 'rear' | 'front' | 'top' | 'head' | 'headSide' | 'hind' | 'hindSide';
export type SortMode = 'height' | 'alpha' | 'length';

export interface AssetStats {
  species: string;
  label: string;
  triangles: number;
  dimensions: { length: number; height: number; width: number };
  parts: string[];
  bones: string[];
  stance: string;
}

interface Entry { key: string; root: THREE.Group; mixer?: THREE.AnimationMixer; clips?: THREE.AnimationClip[]; label?: THREE.Sprite; scale: number }

function makeLabel(text: string, sub: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(15,23,42,0.82)';
  g.beginPath(); g.roundRect(8, 16, 496, 96, 26); g.fill();
  g.fillStyle = '#f8fafc'; g.font = '600 44px Inter, system-ui, sans-serif'; g.textAlign = 'center';
  g.fillText(text, 256, 66);
  g.fillStyle = '#94a3b8'; g.font = '28px Inter, system-ui, sans-serif';
  g.fillText(sub, 256, 100);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.renderOrder = 10;
  return s;
}

export class Stage {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  clock = new THREE.Clock();
  entries: Entry[] = [];
  world = new THREE.Group();
  grid: THREE.GridHelper;
  ground: THREE.Mesh;
  sun: THREE.DirectionalLight;
  skeletonHelpers: THREE.SkeletonHelper[] = [];
  wireframe = false;
  showSkeleton = false;
  speed = 1;
  playing = true;
  mode: 'lineup' | 'inspect' = 'lineup';
  onPick?: (info: { species: string; part: string }) => void;
  private camGoal: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
  private raf = 0;
  private buildToken = 0;
  private ro: ResizeObserver;
  private down = new THREE.Vector2();

  constructor(private el: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    el.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color('#dfe5ec');
    this.scene.fog = new THREE.Fog('#dfe5ec', 40, 120);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 400);
    this.camera.position.set(6, 4, 9);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.addEventListener('start', () => { this.camGoal = null; });

    this.scene.add(new THREE.HemisphereLight('#f4f7ff', '#8a7a66', 1.25));
    this.sun = new THREE.DirectionalLight('#fff4e0', 2.3);
    this.sun.position.set(8, 14, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight('#cfe0ff', 0.6);
    fill.position.set(-8, 5, -6);
    this.scene.add(fill);

    this.ground = new THREE.Mesh(new THREE.CircleGeometry(200, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#cfd6cf', roughness: 1 }));
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.grid = new THREE.GridHelper(200, 200, '#9aa5ad', '#b8c1c7');
    (this.grid.material as THREE.Material).transparent = true;
    (this.grid.material as THREE.Material).opacity = 0.45;
    this.grid.position.y = 0.002;
    this.scene.add(this.grid);
    this.scene.add(this.world);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    this.resize();
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.down.set(e.clientX, e.clientY));
    this.renderer.domElement.addEventListener('pointerup', (e) => { if (this.down.distanceTo(new THREE.Vector2(e.clientX, e.clientY)) < 5) this.pick(e); });
    const loop = () => { this.raf = requestAnimationFrame(loop); this.tick(); };
    loop();
  }

  resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.playing) for (const e of this.entries) e.mixer?.update(dt * this.speed);
    if (this.camGoal) {
      this.camera.position.lerp(this.camGoal.pos, 0.14);
      this.controls.target.lerp(this.camGoal.target, 0.14);
      if (this.camera.position.distanceTo(this.camGoal.pos) < 1e-3) this.camGoal = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private clear() {
    this.buildToken++;
    for (const h of this.skeletonHelpers) { this.scene.remove(h); h.dispose(); }
    this.skeletonHelpers = [];
    for (const e of this.entries) {
      e.mixer?.stopAllAction();
      e.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
      if (e.label) { (e.label.material as THREE.SpriteMaterial).map?.dispose(); e.label.material.dispose(); }
    }
    this.world.clear();
    this.entries = [];
  }

  private applyDisplay(root: THREE.Object3D) {
    root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) (m.material as THREE.MeshStandardMaterial).wireframe = this.wireframe; });
  }

  setWireframe(on: boolean) { this.wireframe = on; for (const e of this.entries) this.applyDisplay(e.root); }

  setSkeleton(on: boolean) {
    this.showSkeleton = on;
    for (const h of this.skeletonHelpers) { this.scene.remove(h); h.dispose(); }
    this.skeletonHelpers = [];
    if (!on) return;
    for (const e of this.entries) {
      const h = new THREE.SkeletonHelper(e.root);
      (h.material as THREE.LineBasicMaterial).depthTest = false;
      h.renderOrder = 5;
      this.scene.add(h);
      this.skeletonHelpers.push(h);
    }
  }

  setGrid(on: boolean) { this.grid.visible = on; }

  setClip(name: string | null) {
    for (const e of this.entries) {
      if (!e.mixer || !e.clips) continue;
      e.mixer.stopAllAction();
      setPose(e.root, 'stand', 0);
      if (!name || name === 'stand') continue;
      const c = e.clips.find((k) => k.name === name);
      if (!c) continue;
      const a = e.mixer.clipAction(c);
      a.reset();
      const loop = (c.userData as { loop?: boolean })?.loop !== false;
      a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopPingPong, Infinity);
      a.time = Math.random() * c.duration * (this.mode === 'lineup' ? 1 : 0);
      a.play();
    }
  }

  /** Builds every species into one review scene, one per frame so the UI stays responsive. */
  buildLineup(opts: { colorway: string; detail: string; normalize: boolean; sort: SortMode; clip: string | null }, onProgress: (done: number, total: number) => void): Promise<void> {
    this.mode = 'lineup';
    this.clear();
    const token = this.buildToken;
    const keys = Object.keys(SPECIES);
    const built: Entry[] = [];
    return new Promise((resolve) => {
      let i = 0;
      const step = () => {
        if (token !== this.buildToken) return resolve();
        const t0 = performance.now();
        while (i < keys.length && performance.now() - t0 < 30) {
          const key = keys[i++];
          const root = createAsset({ species: key, colorway: opts.colorway, detail: opts.detail, mergeForProduction: true, rigMode: 'skinned' });
          const d = root.userData.dimensions;
          const scale = opts.normalize ? 1.4 / Math.max(0.01, Math.max(d.height, d.length * 0.62)) : 1;
          built.push({ key, root, scale, mixer: new THREE.AnimationMixer(root), clips: createClips(root) });
        }
        onProgress(i, keys.length);
        if (i < keys.length) { requestAnimationFrame(step); return; }
        this.layout(built, opts.sort, opts.normalize);
        this.entries = built;
        for (const e of built) this.applyDisplay(e.root);
        if (this.showSkeleton) this.setSkeleton(true);
        this.setClip(opts.clip);
        this.frameAll();
        resolve();
      };
      step();
    });
  }

  private layout(list: Entry[], sort: SortMode, normalize: boolean) {
    const dim = (e: Entry) => e.root.userData.dimensions as { length: number; height: number; width: number; min: number[]; max: number[] };
    if (sort === 'alpha') list.sort((a, b) => a.key.localeCompare(b.key));
    else if (sort === 'length') list.sort((a, b) => dim(b).length - dim(a).length);
    else list.sort((a, b) => dim(b).height - dim(a).height);
    const perRow = 8;
    const rows: Entry[][] = [];
    for (let i = 0; i < list.length; i += perRow) rows.push(list.slice(i, i + perRow));
    let z = 0;
    rows.forEach((row) => {
      const gap = normalize ? 0.6 : 0.5;
      const widths = row.map((e) => dim(e).length * e.scale);
      const total = widths.reduce((s, w) => s + w, 0) + gap * (row.length - 1);
      let x = -total / 2;
      const rowDepth = Math.max(...row.map((e) => Math.max(dim(e).width, dim(e).height * 0.7) * e.scale)) + (normalize ? 1.6 : 1.4);
      row.forEach((e, k) => {
        const d = dim(e);
        const holder = new THREE.Group();
        holder.name = `holder-${e.key}`;
        holder.userData.species = e.key;
        e.root.scale.setScalar(e.scale);
        e.root.rotation.y = Math.PI / 2; // face +X: left flank toward the camera
        holder.add(e.root);
        holder.position.set(x - d.min[2] * e.scale, 0, z);
        this.world.add(holder);
        const lab = makeLabel(e.root.userData.label, normalize ? `${d.height.toFixed(2)} m tall` : `${d.length.toFixed(2)} m long`);
        const lw = Math.max(0.9, Math.min(1.6, widths[k] * 0.9));
        lab.scale.set(lw, lw / 4, 1);
        lab.position.set(x + widths[k] / 2, d.height * e.scale + lw * 0.2, z);
        this.world.add(lab);
        e.label = lab;
        x += widths[k] + gap;
      });
      z -= rowDepth;
    });
  }

  frameAll() {
    const box = new THREE.Box3().setFromObject(this.world);
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const r = Math.max(s.x, s.z) * 0.62;
    this.sun.position.set(c.x + r * 0.6, r * 1.2 + 6, c.z + r * 0.9);
    this.sun.target.position.copy(c);
    const sc = this.sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -r * 1.2; sc.right = r * 1.2; sc.top = r * 1.2; sc.bottom = -r * 1.2; sc.near = 0.5; sc.far = r * 6 + 30;
    sc.updateProjectionMatrix();
    this.camGoal = { pos: new THREE.Vector3(c.x + r * 0.15, Math.max(2, r * 0.75), c.z + r * 1.35), target: new THREE.Vector3(c.x, s.y * 0.2, c.z) };
  }

  /** Builds one species for close inspection (unmerged: every anatomical part is a selectable mesh). */
  inspect(params: Record<string, unknown>, clip: string | null): AssetStats {
    this.mode = 'inspect';
    this.clear();
    const root = createAsset({ ...params, mergeForProduction: false, rigMode: 'skinned' });
    const holder = new THREE.Group();
    holder.userData.species = root.userData.species;
    holder.add(root);
    this.world.add(holder);
    const e: Entry = { key: root.userData.species, root, scale: 1, mixer: new THREE.AnimationMixer(root), clips: createClips(root) };
    this.entries = [e];
    this.applyDisplay(root);
    if (this.showSkeleton) this.setSkeleton(true);
    this.setClip(clip);
    const d = root.userData.dimensions;
    const r = Math.max(d.length, d.height) * 1.2;
    this.sun.position.set(r * 0.8, r * 1.6 + 1, r * 1.1);
    this.sun.target.position.set(0, d.height * 0.4, 0);
    const sc = this.sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 0.01; sc.far = r * 6;
    sc.updateProjectionMatrix();
    return root.userData as AssetStats;
  }

  scrubPose(name: string, phase: number) {
    const e = this.entries[0];
    if (!e) return;
    e.mixer?.stopAllAction();
    setPose(e.root, name, phase);
  }

  /** Camera presets aimed at the review areas (skull, ears, rump, hind-leg junction). */
  view(preset: ViewPreset) {
    const e = this.entries[0];
    if (!e || this.mode !== 'inspect') return;
    const root = e.root;
    const partBox = (names: string[]) => {
      const b = new THREE.Box3();
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && names.some((n) => m.name === n || m.name.startsWith(n + '-'))) { m.geometry.computeBoundingBox(); b.union(m.geometry.boundingBox!); }
      });
      return b;
    };
    let box = new THREE.Box3(new THREE.Vector3(...root.userData.dimensions.min), new THREE.Vector3(...root.userData.dimensions.max));
    let dir = new THREE.Vector3(1, 0.35, 0.9);
    let fit = 1.25;
    switch (preset) {
      case 'side': dir.set(1, 0.04, 0); break;
      case 'rear': dir.set(0.0, 0.12, -1); break;
      case 'front': dir.set(0, 0.1, 1); break;
      case 'top': dir.set(0, 1, 0.0001); break;
      case 'head': { const b = partBox(['head', 'jaw', 'ears', 'horns', 'nose']); if (!b.isEmpty()) box = b; dir.set(0.85, 0.28, 0.75); fit = 1.6; break; }
      case 'headSide': { const b = partBox(['head', 'jaw', 'ears', 'nose']); if (!b.isEmpty()) box = b; dir.set(1, 0.05, 0); fit = 1.5; break; }
      case 'hind': {
        const b = partBox(['leg-hind-left', 'leg-hind-right']);
        if (!b.isEmpty()) { b.max.y = Math.max(b.max.y, box.max.y * 0.9); b.min.z -= (b.max.z - b.min.z) * 0.3; box = b; }
        dir.set(0.7, 0.2, -0.75); fit = 1.35; break;
      }
      case 'hindSide': {
        const b = partBox(['leg-hind-left']);
        if (!b.isEmpty()) { b.max.y = Math.max(b.max.y, box.max.y * 0.9); b.min.z -= (b.max.z - b.min.z) * 0.4; b.max.z += (b.max.z - b.min.z) * 0.4; box = b; }
        dir.set(1, 0.06, 0); fit = 1.3; break;
      }
      default: break;
    }
    dir = dir.normalize();
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const rad = s.length() * 0.5 * fit;
    const dist = rad / Math.tan((this.camera.fov * Math.PI) / 360);
    this.camGoal = { pos: c.clone().addScaledVector(dir, dist), target: c };
  }

  private pick(ev: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObjects(this.world.children, true).filter((h) => (h.object as THREE.Mesh).isMesh && !(h.object as THREE.Sprite).isSprite);
    if (!hits.length) return;
    let o: THREE.Object3D | null = hits[0].object;
    const part = o.name;
    while (o && !o.userData.species) o = o.parent;
    if (o) this.onPick?.({ species: o.userData.species, part });
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.clear();
    this.ro.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
