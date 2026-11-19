import * as THREE from 'three';
import type { Engine } from './Engine';

/**
 * Table-top WebXR: in AR the diorama is placed on a real surface (hit-test);
 * in VR it floats at table height in front of the viewer. Feature-detected.
 */
export class XRMode {
  active = false;
  kind: 'ar' | 'vr' | null = null;
  placed = false;
  holder = new THREE.Group();
  private reticle: THREE.Mesh;
  private hitSource: XRHitTestSource | null = null;
  private session: XRSession | null = null;
  private saved: { background: THREE.Color | THREE.Texture | null; fog: THREE.Fog | THREE.FogExp2 | null; sky: boolean; table: boolean; clearAlpha: number } | null = null;
  private scale = 0.02;
  onChange?: () => void;

  constructor(private engine: Engine) {
    this.holder.name = 'xr-holder';
    this.reticle = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.08, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd23f' }));
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
  }

  static async support(): Promise<{ ar: boolean; vr: boolean }> {
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    if (!xr || !window.isSecureContext) return { ar: false, vr: false };
    const [ar, vr] = await Promise.all([
      xr.isSessionSupported('immersive-ar').catch(() => false),
      xr.isSessionSupported('immersive-vr').catch(() => false),
    ]);
    return { ar, vr };
  }

  private get parts(): THREE.Object3D[] {
    const e = this.engine;
    return [e.world, e.frame.group, e.groundcover.group, e.weather.group, e.sun, e.sun.target, e.fill];
  }

  async start(kind: 'ar' | 'vr', overlay?: HTMLElement | null) {
    const e = this.engine;
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    if (!xr || this.active) return;
    const init: XRSessionInit = kind === 'ar'
      ? { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], ...(overlay ? { domOverlay: { root: overlay } } : {}) }
      : { optionalFeatures: ['local-floor'] };
    const session = await xr.requestSession(kind === 'ar' ? 'immersive-ar' : 'immersive-vr', init);
    this.session = session;
    this.kind = kind;
    e.walk?.exit();
    e.renderer.xr.enabled = true;
    e.renderer.xr.setReferenceSpaceType('local');
    await e.renderer.xr.setSession(session);
    // shrink the whole diorama to table-top size
    for (const p of this.parts) this.holder.add(p);
    e.scene.add(this.holder);
    const b = e.bounds;
    const size = Math.max(b.maxX - b.minX, b.maxZ - b.minZ, 1);
    this.scale = (kind === 'ar' ? 0.6 : 0.9) / size;
    this.holder.scale.setScalar(this.scale);
    this.saved = { background: e.scene.background as THREE.Color | null, fog: e.scene.fog as THREE.Fog | null, sky: e.sky.mesh.visible, table: e.frame.table?.visible ?? false, clearAlpha: e.renderer.getClearAlpha() };
    e.scene.fog = null;
    e.labels.domElement.style.display = 'none';
    if (kind === 'ar') {
      e.scene.background = null;
      e.renderer.setClearAlpha(0); // let the camera feed show through
      e.sky.mesh.visible = false;
      if (e.frame.table) e.frame.table.visible = false;
      this.holder.visible = false;
      this.placed = false;
      e.scene.add(this.reticle);
      const viewer = await session.requestReferenceSpace('viewer');
      this.hitSource = (await session.requestHitTestSource?.({ space: viewer })) ?? null;
    } else {
      e.sky.mesh.visible = true;
      e.scene.background = new THREE.Color('#1c2430');
      if (e.frame.table) e.frame.table.visible = false;
      const floor = e.frame.floorY || b.bottom;
      this.holder.position.set(0, -0.62 - floor * this.scale, -1.15);
      this.placed = true;
    }
    session.addEventListener('select', this.onSelect);
    session.addEventListener('end', this.onEnd);
    this.active = true;
    this.onChange?.();
  }

  /** called every animation frame with the XR frame */
  update(frame?: XRFrame) {
    if (!this.active || this.kind !== 'ar' || !frame || !this.hitSource) return;
    const ref = this.engine.renderer.xr.getReferenceSpace();
    if (!ref) return;
    const hits = frame.getHitTestResults(this.hitSource);
    const pose = hits.length ? hits[0].getPose(ref) : null;
    this.reticle.visible = !!pose && !this.placed;
    if (pose) this.reticle.matrix.fromArray(pose.transform.matrix);
  }

  private onSelect = () => {
    if (this.kind !== 'ar' || !this.reticle.visible) return;
    const p = new THREE.Vector3().setFromMatrixPosition(this.reticle.matrix);
    const floor = this.engine.frame.floorY || this.engine.bounds.bottom;
    this.holder.position.set(p.x, p.y - floor * this.scale, p.z);
    this.holder.visible = true;
    this.placed = true;
    this.reticle.visible = false;
    this.onChange?.();
  };

  /** let the user pick a new spot */
  replace() { if (this.kind === 'ar') { this.placed = false; this.holder.visible = false; this.onChange?.(); } }

  stop() { void this.session?.end().catch(() => this.onEnd()); }

  private onEnd = () => {
    const e = this.engine;
    if (!this.active) return;
    this.active = false;
    this.hitSource?.cancel();
    this.hitSource = null;
    this.session = null;
    for (const p of this.parts) e.scene.add(p);
    e.scene.remove(this.holder, this.reticle);
    this.holder.scale.setScalar(1);
    this.holder.position.set(0, 0, 0);
    this.holder.visible = true;
    e.renderer.xr.enabled = false;
    if (this.saved) {
      e.scene.background = this.saved.background;
      e.scene.fog = this.saved.fog;
      e.sky.mesh.visible = this.saved.sky;
      if (e.frame.table) e.frame.table.visible = this.saved.table;
      e.renderer.setClearAlpha(this.saved.clearAlpha);
    }
    e.labels.domElement.style.display = '';
    e.resize();
    e.applyEnv();
    this.kind = null;
    this.onChange?.();
  };
}
