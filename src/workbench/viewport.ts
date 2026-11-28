/**
 * The workbench's live 3D view: an orbitable studio with a metric grid, a forward marker,
 * clip playback for skinned rigs and the app's procedural idle for pivot rigs.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { BuiltModel } from '../assets/builder';

export type ViewName = 'front34' | 'front' | 'side' | 'right' | 'back' | 'back34' | 'top' | 'below' | 'low';
export const VIEW_DIRS: Record<ViewName, THREE.Vector3> = {
  front34: new THREE.Vector3(0.85, 0.42, 1),
  front: new THREE.Vector3(0, 0.12, 1),
  side: new THREE.Vector3(1, 0.06, 0),
  right: new THREE.Vector3(-1, 0.06, 0),
  back: new THREE.Vector3(0, 0.2, -1),
  back34: new THREE.Vector3(-0.85, 0.42, -1),
  top: new THREE.Vector3(0, 1, 0.0001),
  below: new THREE.Vector3(0, -1, 0.0001),
  low: new THREE.Vector3(0.9, 0.05, 0.7),
};
export type Lighting = 'studio' | 'daylight' | 'overcast' | 'night';

const DEG = Math.PI / 180;

export class Viewport {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 0.001, 5000);
  controls: OrbitControls;
  model: BuiltModel | null = null;
  mixer: THREE.AnimationMixer | null = null;
  action: THREE.AnimationAction | null = null;
  clipName = '';
  playing = true;
  speed = 1;
  /** procedural idle for pivot rigs (reptiles, Wildform, built-ins) */
  rigAnim = true;
  autoRotate = false;
  private holder = new THREE.Group();
  private ground: THREE.Mesh;
  private grid: THREE.GridHelper | null = null;
  private marker: THREE.Mesh;
  private box: THREE.Box3Helper | null = null;
  private skel: THREE.SkeletonHelper | null = null;
  private hemi = new THREE.HemisphereLight('#dbe9f7', '#7a6a52', 1.15);
  private key = new THREE.DirectionalLight('#fff3df', 2.4);
  private rim = new THREE.DirectionalLight('#cfe0ff', 0.7);
  private clock = new THREE.Clock();
  private t = 0;
  private radius = 1;
  private center = new THREE.Vector3();
  private wire = false;
  private showBox = false;
  private showSkel = false;
  private wireMat = new THREE.MeshBasicMaterial({ color: '#2b2b2b', wireframe: true, transparent: true, opacity: 0.35 });
  private ro: ResizeObserver;
  onFrame?: () => void;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.scene.background = new THREE.Color('#e9e4d8');
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.key, this.key.target, this.rim, this.holder);
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(1, 72).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d9d1c0', roughness: 1 }));
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.marker = new THREE.Mesh(new THREE.ConeGeometry(1, 3, 3).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#e0342b' }));
    this.scene.add(this.marker);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Show a freshly built model (the previous one is removed; materials may be shared, so only geometry of unique builds is disposed by the caller). */
  setModel(m: BuiltModel | null, keepCamera = false) {
    if (this.model) this.holder.remove(this.model.object);
    this.mixer?.stopAllAction();
    this.mixer = null; this.action = null;
    this.model = m;
    if (this.skel) { this.scene.remove(this.skel); this.skel = null; }
    if (!m) return;
    this.holder.add(m.object);
    if (m.clips.length) this.mixer = new THREE.AnimationMixer(m.raw);
    this.applyWire();
    this.fit(!keepCamera);
    if (this.clipName) this.playClip(this.clipName);
    this.applySkeleton();
  }

  /** Recompute ground, grid, marker and lights from the model's size; optionally reframe the camera. */
  fit(reframe = true) {
    if (!this.model) return;
    const obj = this.model.object;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj, this.model.skinned);
    if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
    const size = box.getSize(new THREE.Vector3());
    box.getCenter(this.center);
    this.radius = Math.max(box.getBoundingSphere(new THREE.Sphere()).radius, 1e-4);
    const r = this.radius;
    this.ground.scale.setScalar(r * 8);
    this.ground.position.y = Math.min(0, box.min.y) - r * 0.002;
    if (this.grid) { this.scene.remove(this.grid); this.grid.geometry.dispose(); }
    const step = niceStep(Math.max(size.x, size.y, size.z));
    this.grid = new THREE.GridHelper(step * 16, 16, '#b5aa94', '#cdc4b1');
    this.grid.position.y = this.ground.position.y + r * 0.001;
    this.scene.add(this.grid);
    this.gridStep = step;
    this.marker.scale.setScalar(r * 0.05);
    this.marker.position.set(this.center.x, this.ground.position.y + r * 0.02, box.max.z + r * 0.16);
    this.key.position.set(this.center.x + r * 2.2, this.center.y + r * 3.4, this.center.z + r * 2.6);
    this.key.target.position.copy(this.center);
    const sc = this.key.shadow.camera as THREE.OrthographicCamera;
    sc.left = sc.bottom = -r * 2.2; sc.right = sc.top = r * 2.2; sc.near = r * 0.1; sc.far = r * 12;
    sc.updateProjectionMatrix();
    this.rim.position.set(this.center.x - r * 3, this.center.y + r, this.center.z - r * 2);
    this.camera.near = r / 200; this.camera.far = r * 200;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(this.center);
    this.controls.minDistance = r * 0.05; this.controls.maxDistance = r * 40;
    if (this.box) { this.scene.remove(this.box); this.box = null; }
    if (this.showBox) { this.box = new THREE.Box3Helper(box, '#3b82f6'); this.scene.add(this.box); }
    if (reframe) this.view('front34');
  }
  gridStep = 1;

  view(name: ViewName | 'head' | 'headside' | 'body' | 'bodyside') {
    if (name === 'head' || name === 'headside') { this.headView(name === 'headside'); return; }
    if (name === 'body' || name === 'bodyside') { this.bodyView(name === 'bodyside'); return; }
    const dir = (VIEW_DIRS[name] ?? VIEW_DIRS.front34).clone().normalize();
    const dist = this.radius / Math.sin((this.camera.fov / 2) * DEG) * (name === 'top' || name === 'below' ? 0.92 : 1.0);
    this.camera.position.copy(this.center).addScaledVector(dir, dist);
    this.controls.target.copy(this.center);
    this.camera.lookAt(this.center);
    this.controls.update();
  }
  /** Close-up of the face: the rig's Head bone (or the front-top of the bounds), from ¾ front or the side. */
  headView(side = false) {
    if (!this.model) return;
    const obj = this.model.object;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj, this.model.skinned);
    const size = box.getSize(new THREE.Vector3());
    let head: THREE.Vector3 | null = null;
    const bone = this.model.raw.getObjectByName('Head') ?? this.model.raw.getObjectByName('head');
    if (bone) head = bone.getWorldPosition(new THREE.Vector3());
    if (!head) head = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y + size.y * 0.78, box.max.z - size.z * 0.12);
    // frame about a fifth of the body (at least the head's own size); no more than half again the head-to-chest
    // distance, so the head of a long-tailed lizard or a snake still fills the view
    const chest = this.model.raw.getObjectByName('Chest') ?? this.model.raw.getObjectByName('Spine4');
    const neck = bone && chest ? bone.getWorldPosition(new THREE.Vector3()).distanceTo(chest.getWorldPosition(new THREE.Vector3())) * 1.5 : Infinity;
    const r = Math.max(Math.min(Math.max(size.x, size.y, size.z) * 0.2, neck), 1e-4);
    const dir = (side ? new THREE.Vector3(1, 0.1, 0.05) : new THREE.Vector3(0.55, 0.18, 1)).normalize();
    const dist = r / Math.sin((this.camera.fov / 2) * DEG);
    // a bone sits inside the skull: aim a little ahead of it, toward the snout
    const aim = head.clone().add(new THREE.Vector3(0, 0, r * 0.35));
    this.camera.position.copy(aim).addScaledVector(dir, dist);
    this.controls.target.copy(aim);
    this.camera.lookAt(aim);
    this.controls.update();
  }
  /** the head and trunk without a long tail or neck stretching the frame: from the Head bone to the Hips (or the model) */
  bodyView(side = false) {
    if (!this.model) return;
    const obj = this.model.object;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj, this.model.skinned);
    const hb = this.model.raw.getObjectByName('Head'), pb = this.model.raw.getObjectByName('Hips');
    const a = hb ? hb.getWorldPosition(new THREE.Vector3()) : box.getCenter(new THREE.Vector3());
    const b = pb ? pb.getWorldPosition(new THREE.Vector3()) : box.getCenter(new THREE.Vector3());
    const ctr = a.clone().lerp(b, 0.5);
    const r = Math.max(a.distanceTo(b) * 0.75, box.getSize(new THREE.Vector3()).y * 0.6, 1e-4);
    const dir = (side ? new THREE.Vector3(1, 0.12, 0.02) : new THREE.Vector3(0.75, 0.42, 1)).normalize();
    const dist = r / Math.sin((this.camera.fov / 2) * DEG);
    ctr.y = Math.max(ctr.y, box.min.y + r * 0.3);
    this.camera.position.copy(ctr).addScaledVector(dir, dist);
    this.controls.target.copy(ctr);
    this.camera.lookAt(ctr);
    this.controls.update();
  }
  cameraState() { return { p: this.camera.position.toArray(), t: this.controls.target.toArray() }; }
  setCameraState(s: { p: number[]; t: number[] }) {
    this.camera.position.fromArray(s.p); this.controls.target.fromArray(s.t); this.controls.update();
  }

  playClip(name: string) {
    this.clipName = name;
    if (!this.mixer || !this.model) return;
    const clip = this.model.clips.find((c) => c.name === name) ?? this.model.clips[0];
    if (!clip) return;
    this.mixer.stopAllAction();
    this.action = this.mixer.clipAction(clip);
    this.action.play();
    this.mixer.update(0);
  }
  /** jump the current clip to a phase (0..1) */
  scrub(u: number) {
    if (!this.action || !this.mixer) return;
    const d = this.action.getClip().duration;
    this.action.time = ((u % 1) + 1) % 1 * d;
    this.mixer.update(0);
  }
  clipPhase() {
    if (!this.action) return 0;
    return this.action.time / (this.action.getClip().duration || 1);
  }

  setWire(on: boolean) { this.wire = on; this.applyWire(); }
  private applyWire() {
    const m = this.model;
    if (!m) return;
    m.object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || o.name === '__wire') return;
      const has = o.children.find((c) => c.name === '__wire');
      if (this.wire && !has) {
        const w = (mesh as THREE.SkinnedMesh).isSkinnedMesh ? null : new THREE.Mesh(mesh.geometry, this.wireMat);
        if (w) { w.name = '__wire'; w.raycast = () => {}; mesh.add(w); }
        else { (mesh.material as THREE.MeshStandardMaterial).wireframe = true; }
      } else if (!this.wire) {
        if (has) mesh.remove(has);
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if ((mesh as THREE.SkinnedMesh).isSkinnedMesh && mat.wireframe) mat.wireframe = false;
      }
    });
  }
  setBounds(on: boolean) { this.showBox = on; this.fit(false); }
  setSkeleton(on: boolean) { this.showSkel = on; this.applySkeleton(); }
  private applySkeleton() {
    if (this.skel) { this.scene.remove(this.skel); this.skel = null; }
    if (!this.showSkel || !this.model) return;
    this.skel = new THREE.SkeletonHelper(this.model.raw);
    (this.skel.material as THREE.LineBasicMaterial).depthTest = false;
    this.scene.add(this.skel);
  }
  setBackground(hex: string) { (this.scene.background as THREE.Color).set(hex); }
  setLighting(l: Lighting) {
    const cfg = {
      studio: { hemi: ['#dbe9f7', '#7a6a52', 1.15], key: ['#fff3df', 2.4], rim: 0.7, exp: 1.1 },
      daylight: { hemi: ['#bcd8f0', '#5a4a36', 0.9], key: ['#fff4e0', 2.6], rim: 0.35, exp: 1.05 },
      overcast: { hemi: ['#e4e8ec', '#8a8478', 1.9], key: ['#f2f2f2', 0.6], rim: 0.2, exp: 1.0 },
      night: { hemi: ['#3a4a6a', '#1a1a22', 0.5], key: ['#9fb4e8', 0.7], rim: 0.2, exp: 1.3 },
    }[l];
    this.hemi.color.set(cfg.hemi[0] as string); this.hemi.groundColor.set(cfg.hemi[1] as string); this.hemi.intensity = cfg.hemi[2] as number;
    this.key.color.set(cfg.key[0] as string); this.key.intensity = cfg.key[1] as number;
    this.rim.intensity = cfg.rim;
    this.renderer.toneMappingExposure = cfg.exp;
    this.model?.setNight?.(l === 'night' ? 1 : 0);
  }

  private frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.playing) this.t += dt * this.speed;
    if (this.mixer && this.playing) this.mixer.update(dt * this.speed);
    const m = this.model;
    if (m) {
      if (m.rig.length && this.rigAnim && this.playing) {
        for (const r of m.rig) {
          if (r.role === 'leg') continue;
          const u = (Math.sin(this.t * r.speed * 1.6 + r.phase) + 1) / 2;
          const v = r.min + (r.max - r.min) * (r.role === 'jaw' && !r.scale ? u * 0.18 : u);
          if (r.scale) r.node.scale[r.axis] = v; else r.node.rotation[r.axis] = r.base + v * DEG;
        }
      } else if (m.rig.length && !this.rigAnim) {
        for (const r of m.rig) { if (r.scale) r.node.scale[r.axis] = r.base; else r.node.rotation[r.axis] = r.base; }
      }
      if (this.playing) m.update?.(this.t);
    }
    if (this.autoRotate) {
      const a = dt * 0.35;
      const off = this.camera.position.clone().sub(this.controls.target);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
      this.camera.position.copy(this.controls.target).add(off);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.();
  }

  /** PNG data URL of the current view at an optional fixed size */
  capture(w?: number, h?: number): string {
    if (!w || !h) { this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL('image/png'); }
    const oldSize = this.renderer.getSize(new THREE.Vector2()), oldAspect = this.camera.aspect;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.renderer.setSize(oldSize.x, oldSize.y, false);
    this.camera.aspect = oldAspect; this.camera.updateProjectionMatrix();
    return url;
  }
  /** world-space size of the model's bounds (metres, as displayed) */
  bounds() {
    if (!this.model) return null;
    const box = new THREE.Box3().setFromObject(this.model.object, this.model.skinned);
    return box.getSize(new THREE.Vector3());
  }
  dispose() { this.renderer.setAnimationLoop(null); this.ro.disconnect(); this.renderer.dispose(); }
}

function niceStep(size: number) {
  const raw = Math.max(size, 1e-4) / 6;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n < 2 ? 1 : n < 5 ? 2 : 5) * p;
}
