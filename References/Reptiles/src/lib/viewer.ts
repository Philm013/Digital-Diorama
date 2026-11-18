import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export type RigCfg = { axis: 'x' | 'y' | 'z'; range: [number, number]; type?: 'scale'; speed?: number; phase?: number; describe?: string };
export type NightCfg = Record<string, { color: string; intensity: number; describe?: string }>;

export const ENVIRONMENTS: Record<string, { label: string; sky: string; ground: string; horizon: string }> = {
  savanna:    { label: 'Savanna',    sky: '#e9dcc0', ground: '#b9a06a', horizon: '#d9c79c' },
  rainforest: { label: 'Rainforest', sky: '#cfe0c8', ground: '#4c6a38', horizon: '#9db88a' },
  desert:     { label: 'Desert',     sky: '#f3e3c6', ground: '#dcbc86', horizon: '#ecd3a6' },
  ocean:      { label: 'Ocean',      sky: '#9cc8dc', ground: '#cdbf96', horizon: '#6fa6c0' },
  island:     { label: 'Volcanic Island', sky: '#dfe4dc', ground: '#6e6656', horizon: '#b5b8a8' },
  wetland:    { label: 'Wetland',    sky: '#d6e0cc', ground: '#5e6a42', horizon: '#a8b48c' },
  forest:     { label: 'Forest',     sky: '#d8dccb', ground: '#5a4a34', horizon: '#9ea28a' },
  grassland:  { label: 'Grassland',  sky: '#e2e6cc', ground: '#7c8a48', horizon: '#bcc490' },
  lake:       { label: 'Freshwater Lake', sky: '#bcd6dc', ground: '#6a7458', horizon: '#8cb4bc' },
  river:      { label: 'Mountain Stream', sky: '#c8d8dc', ground: '#6a6a60', horizon: '#9cb0b4' },
  soil:       { label: 'Forest Floor', sky: '#d6d2c4', ground: '#5a3e2c', horizon: '#a49886' },
  studio:     { label: 'Studio',     sky: '#dde3ea', ground: '#c9d1da', horizon: '#dde3ea' }
};

const NIGHT_SKY = new THREE.Color('#0b1220');

export class Viewer {
  renderer: THREE.WebGLRenderer;
  labels: CSS2DRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
  controls: OrbitControls;
  hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
  sun = new THREE.DirectionalLight(0xffffff, 1.5);
  torch = new THREE.PointLight(0xfff1d6, 0, 0, 0);
  ground: THREE.Mesh;
  grid: THREE.GridHelper | null = null;
  content = new THREE.Group();
  rigNodes: { node: THREE.Object3D; cfg: RigCfg; rot: THREE.Euler; scl: THREE.Vector3 }[] = [];
  nightCfg: NightCfg | null = null;
  env = ENVIRONMENTS.studio;
  isNight = false;
  animating = false;
  showGrid = true;
  clock = new THREE.Clock();
  raf = 0;
  ro: ResizeObserver;
  onStats?: (s: { tris: number; calls: number; dims: string }) => void;

  constructor(private el: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    el.appendChild(this.renderer.domElement);
    this.labels = new CSS2DRenderer();
    Object.assign(this.labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    el.appendChild(this.labels.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotateSpeed = 0.8;

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.sun, this.sun.target, this.camera, this.content);
    this.camera.add(this.torch);

    this.ground = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 1 }));
    this.ground.receiveShadow = true;
    this.ground.position.y = -0.0005;
    this.scene.add(this.ground);
    this.scene.fog = new THREE.Fog(0xffffff, 10, 100);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    this.resize();
    this.applyLook();
    const loop = () => { this.raf = requestAnimationFrame(loop); this.tick(); };
    loop();
  }

  resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private disposeContent() {
    this.content.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); });
    this.content.children.slice().forEach((c) => {
      c.traverse((o) => { if (o instanceof CSS2DObject) o.element.remove(); });
      this.content.remove(c);
    });
  }

  setContent(obj: THREE.Object3D, rig: Record<string, RigCfg> = {}, night: NightCfg | null = null, fit = true) {
    this.disposeContent();
    this.content.add(obj);
    this.nightCfg = night;
    this.rigNodes = [];
    for (const [name, cfg] of Object.entries(rig)) {
      const node = obj.getObjectByName(name);
      if (node) this.rigNodes.push({ node, cfg, rot: node.rotation.clone(), scl: node.scale.clone() });
    }
    if (fit) this.fit();
    this.applyLook();
    this.emitStats();
  }

  setLineup(items: { obj: THREE.Object3D; label: string; sub: string; row: number }[], normalize: boolean) {
    this.disposeContent();
    this.rigNodes = [];
    this.nightCfg = { eyes: { color: '#ffc870', intensity: 1.2 } };
    const rows: Record<number, { obj: THREE.Object3D; label: string; sub: string; w: number; d: number; h: number }[]> = {};
    for (const it of items) {
      const b = new THREE.Box3().setFromObject(it.obj), s = b.getSize(new THREE.Vector3());
      const k = normalize ? 1 / Math.max(s.x, s.y, s.z) : 1;
      it.obj.scale.setScalar(k);
      const c = b.getCenter(new THREE.Vector3());
      const wrap = new THREE.Group();
      it.obj.position.set(-c.x * k, 0, -c.z * k);
      wrap.add(it.obj);
      (rows[it.row] ||= []).push({ obj: wrap, label: it.label, sub: it.sub, w: s.x * k, d: s.z * k, h: s.y * k });
    }
    let zCursor = 0;
    const gap = normalize ? 0.35 : 0.25;
    Object.keys(rows).sort().forEach((r) => {
      const row = rows[+r];
      const total = row.reduce((a, b) => a + b.w + gap, -gap);
      const depth = Math.max(...row.map((x) => x.d));
      let x = -total / 2;
      for (const it of row) {
        it.obj.position.set(x + it.w / 2, 0, zCursor + depth / 2);
        x += it.w + gap;
        const div = document.createElement('div');
        div.className = 'lineup-label';
        div.innerHTML = `<b>${it.label}</b><span>${it.sub}</span>`;
        const lab = new CSS2DObject(div);
        lab.position.set(0, it.h + (normalize ? 0.12 : 0.08), 0);
        it.obj.add(lab);
        this.content.add(it.obj);
      }
      zCursor += depth + gap * 3;
    });
    this.content.position.z = -zCursor / 2;
    this.fit(0.9);
    this.applyLook();
    this.emitStats();
  }

  fit(pad = 1) {
    const box = new THREE.Box3().setFromObject(this.content);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const m = Math.max(size.x, size.y, size.z, 0.01);
    this.controls.target.copy(c);
    const dir = new THREE.Vector3(0.9, 0.55, 1.15).normalize();
    this.camera.position.copy(c).addScaledVector(dir, m * 1.55 * pad + 0.0001);
    this.camera.near = m / 300; this.camera.far = m * 400;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = m * 0.15; this.controls.maxDistance = m * 25;
    this.controls.update();
    this.ground.scale.setScalar(m * 60);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -m * 0.75; sc.right = sc.top = m * 0.75; sc.near = m * 0.1; sc.far = m * 8;
    sc.updateProjectionMatrix();
    this.sun.position.copy(c).add(new THREE.Vector3(1.1, 2.2, 1.4).multiplyScalar(m * 1.2));
    this.sun.target.position.copy(c);
    (this.scene.fog as THREE.Fog).near = m * 5; (this.scene.fog as THREE.Fog).far = m * 40;
    if (this.grid) { this.scene.remove(this.grid); this.grid.geometry.dispose(); }
    const step = Math.pow(10, Math.floor(Math.log10(m / 3)));
    this.grid = new THREE.GridHelper(step * 80, 80, 0x000000, 0x000000);
    (this.grid.material as THREE.Material).opacity = 0.12;
    (this.grid.material as THREE.Material).transparent = true;
    this.grid.visible = this.showGrid;
    this.scene.add(this.grid);
    this.torch.intensity = 0;
    this.applyLook();
  }

  setEnvironment(key: string) { this.env = ENVIRONMENTS[key] || ENVIRONMENTS.studio; this.applyLook(); }
  setNight(v: boolean) { this.isNight = v; this.applyLook(); }
  setGrid(v: boolean) { this.showGrid = v; if (this.grid) this.grid.visible = v; }
  setAutoRotate(v: boolean) { this.controls.autoRotate = v; }
  setAnimate(v: boolean) {
    this.animating = v;
    if (!v) for (const r of this.rigNodes) { r.node.rotation.copy(r.rot); r.node.scale.copy(r.scl); }
  }
  setVisible(name: string, v: boolean) { const n = this.content.getObjectByName(name); if (n) n.visible = v; }

  applyLook() {
    const n = this.isNight, e = this.env;
    const sky = n ? NIGHT_SKY : new THREE.Color(e.sky);
    this.scene.background = sky;
    (this.scene.fog as THREE.Fog).color.copy(n ? NIGHT_SKY : new THREE.Color(e.horizon));
    (this.ground.material as THREE.MeshStandardMaterial).color.set(e.ground).multiplyScalar(n ? 0.35 : 1);
    this.hemi.color.set(n ? 0x5a6a9a : 0xffffff);
    this.hemi.groundColor.set(n ? 0x101420 : 0x444444);
    this.hemi.intensity = n ? 0.35 : 1.2;
    this.sun.color.set(n ? 0x8ea4ff : 0xffffff);
    this.sun.intensity = n ? 0.35 : 1.5;
    this.torch.intensity = n ? 1.2 : 0;
    this.renderer.toneMappingExposure = n ? 1.25 : 1.05;
    const glow = n && this.nightCfg ? Object.values(this.nightCfg)[0] : null;
    this.content.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && m.userData && m.userData.zone === 'eyes') {
        m.emissive.set(glow ? glow.color : 0x000000);
        m.emissiveIntensity = glow ? glow.intensity : 0;
      }
    });
  }

  emitStats() {
    let tris = 0, calls = 0;
    this.content.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { calls++; const g = m.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; }
    });
    const s = new THREE.Box3().setFromObject(this.content).getSize(new THREE.Vector3());
    const f = (v: number) => (v < 0.1 ? `${(v * 100).toFixed(1)} cm` : `${v.toFixed(2)} m`);
    this.onStats?.({ tris: Math.round(tris), calls, dims: `${f(s.x)} × ${f(s.y)} × ${f(s.z)}` });
  }

  tick() {
    const t = this.clock.getElapsedTime();
    if (this.animating) {
      for (const r of this.rigNodes) {
        const c = r.cfg, u = (Math.sin(t * (c.speed ?? 1) * 1.6 + (c.phase ?? 0)) + 1) / 2;
        const v = c.range[0] + (c.range[1] - c.range[0]) * u;
        if (c.type === 'scale') r.node.scale[c.axis] = v;
        else r.node.rotation[c.axis] = THREE.MathUtils.degToRad(v);
      }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  snapshot(): string { return this.renderer.domElement.toDataURL('image/png'); }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.disposeContent();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }
}
