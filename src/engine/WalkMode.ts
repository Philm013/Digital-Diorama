import * as THREE from 'three';
import type { Engine } from './Engine';
import { clamp } from './util';

export class WalkMode {
  active = false;
  eye = 1.6;
  yaw = 0;
  pitch = -0.05;
  pos = new THREE.Vector3();
  private vy = 0;
  private bob = 0;
  keys = new Set<string>();
  /** virtual joystick input from the UI: x = strafe, y = forward (-1..1) */
  joy = { x: 0, y: 0 };
  /** the on-screen joystick is pushed to its rim: run */
  joyRun = false;
  /** vertical input (swim up / down) */
  rise = 0;
  /** roaming the endless world beyond the diorama's box */
  endless = false;
  /** bird's-eye: flying at a height above the ground instead of walking */
  get flying() { return this.eye >= 8; }
  private saved?: { pos: THREE.Vector3; target: THREE.Vector3; near: number; fov: number };
  onChange?: () => void;

  constructor(private engine: Engine) {}

  enter(eye = 1.6, opts: { endless?: boolean } = {}) {
    const e = this.engine;
    this.eye = eye;
    this.saved = { pos: e.camera.position.clone(), target: e.controls.target.clone(), near: e.camera.near, fov: e.camera.fov };
    this.endless = !!opts.endless && !!e.terrain;
    if (this.endless) e.setEndless(true);
    const b = e.bounds;
    // start at the front-centre edge looking into the scene (outside it when roaming, to see it in its landscape)
    this.pos.set((b.minX + b.maxX) / 2, 0, this.endless ? b.maxZ + 5 : b.maxZ - Math.min(3, (b.maxZ - b.minZ) * 0.12));
    const sel = e.getActor(e.selectedId);
    if (sel && !this.endless) {
      const p = sel.root.position;
      this.pos.set(clamp(p.x, b.minX + 0.5, b.maxX - 0.5), 0, clamp(p.z + Math.max(2, sel.radius * 4 + eye * 2), b.minZ + 0.5, b.maxZ - 0.5));
    }
    this.pos.y = this.groundY(this.pos.x, this.pos.z) + eye;
    this.yaw = 0;
    this.pitch = eye < 0.5 ? 0.05 : this.flying ? -0.3 : -0.05;
    this.vy = 0;
    this.applyLens();
    e.controls.enabled = false;
    this.active = true;
    e.buildFrame();
    e.applyEnv();
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    document.addEventListener('mousemove', this.onMouse);
    this.onChange?.();
    e.changed(false);
  }

  /** see from another animal's eye height without leaving the spot */
  setEye(eye: number) {
    const wasFlying = this.flying;
    this.eye = eye;
    const g = this.groundY(this.pos.x, this.pos.z);
    if (this.flying || wasFlying) this.pos.y = g + eye;
    this.vy = 0;
    if (this.flying && !wasFlying) this.pitch = -0.3;
    this.applyLens();
    this.onChange?.();
  }
  private applyLens() {
    const e = this.engine;
    e.camera.near = Math.max(0.005, Math.min(this.eye, 2) * 0.04);
    e.camera.fov = this.flying ? 68 : 62;
    e.camera.updateProjectionMatrix();
  }

  /** back to the front of the diorama, looking at it */
  goHome() {
    const b = this.engine.bounds;
    this.pos.set((b.minX + b.maxX) / 2, 0, b.maxZ + (this.endless ? 5 : -2));
    this.pos.y = this.groundY(this.pos.x, this.pos.z) + this.eye;
    this.yaw = 0;
    this.vy = 0;
  }
  /** metres from the middle of the diorama, and the bearing to it relative to where you look (radians) */
  get homeVector() {
    const dx = -this.pos.x, dz = -this.pos.z;
    const dist = Math.hypot(dx, dz);
    const bearing = Math.atan2(-dx, -dz); // yaw that would face the diorama
    let rel = bearing - this.yaw;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    return { dist, rel };
  }

  exit() {
    if (!this.active) return;
    const e = this.engine;
    this.active = false;
    if (this.endless) { this.endless = false; e.setEndless(false); }
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    document.removeEventListener('mousemove', this.onMouse);
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.saved) {
      e.camera.position.copy(this.saved.pos);
      e.controls.target.copy(this.saved.target);
      e.camera.near = this.saved.near;
      e.camera.fov = this.saved.fov;
      e.camera.updateProjectionMatrix();
    }
    e.controls.enabled = true;
    e.buildFrame();
    e.applyEnv();
    this.keys.clear();
    this.joy.x = this.joy.y = 0;
    this.onChange?.();
    e.changed(false);
  }

  lockPointer() { this.engine.renderer.domElement.requestPointerLock?.(); }

  look(dx: number, dy: number) {
    this.yaw -= dx * 0.0032;
    this.pitch = clamp(this.pitch - dy * 0.0032, -1.35, 1.35);
  }

  private onMouse = (ev: MouseEvent) => {
    if (document.pointerLockElement === this.engine.renderer.domElement) this.look(ev.movementX, ev.movementY);
  };
  private onKey = (ev: KeyboardEvent) => {
    const tag = (ev.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = ev.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', ' ', 'c', 'q', 'e'].includes(k)) {
      if (ev.type === 'keydown') this.keys.add(k); else this.keys.delete(k);
      if (k === ' ' || k.startsWith('arrow')) ev.preventDefault();
    }
  };

  private groundY(x: number, z: number) { return this.engine.groundAt(x, z); }

  update(dt: number) {
    const e = this.engine;
    const k = this.keys;
    let fwd = this.joy.y, side = this.joy.x;
    if (k.has('w') || k.has('arrowup')) fwd += 1;
    if (k.has('s') || k.has('arrowdown')) fwd -= 1;
    if (k.has('a')) side -= 1;
    if (k.has('d')) side += 1;
    if (k.has('arrowleft') || k.has('q')) this.yaw += dt * 1.8;
    if (k.has('arrowright') || k.has('e')) this.yaw -= dt * 1.8;
    const run = k.has('shift') || this.joyRun ? (this.endless ? 3 : 2.2) : 1;
    const speed = (this.flying ? 7 : (0.25 + this.eye * 0.85) * (this.endless ? 1.25 : 1)) * run;
    const len = Math.hypot(fwd, side);
    if (len > 1) { fwd /= len; side /= len; }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const nx = this.pos.x + (-sin * fwd + cos * side) * speed * dt;
    const nz = this.pos.z + (-cos * fwd - sin * side) * speed * dt;
    const b = e.bounds;
    if (this.endless) { this.pos.x = nx; this.pos.z = nz; }
    else {
      this.pos.x = clamp(nx, b.minX + 0.2, b.maxX - 0.2);
      this.pos.z = clamp(nz, b.minZ + 0.2, b.maxZ - 0.2);
    }
    const g = this.groundY(this.pos.x, this.pos.z);
    const w = e.waterAt(this.pos.x, this.pos.z);
    const swimming = !this.flying && w !== null && w - g > this.eye * 0.9;
    let up = this.rise + (k.has(' ') ? 1 : 0) - (k.has('c') ? 1 : 0);
    if (this.flying) {
      // glide over the land at a height you choose: up / down change it
      this.eye = clamp(this.eye + up * dt * 6, 8, 60);
      const floor = Math.max(g, w ?? -Infinity);
      this.pos.y += (floor + this.eye - this.pos.y) * Math.min(1, dt * 3);
      this.vy = 0;
      up = 0;
    } else if (swimming) {
      // free swimming between bed and surface
      this.pos.y = clamp(this.pos.y + up * speed * dt * 0.8, g + this.eye * 0.3, w + this.eye * 0.15);
      this.vy = 0;
    } else {
      if (up > 0 && this.pos.y <= g + this.eye + 0.01) this.vy = 2.6 * Math.sqrt(this.eye / 1.6);
      this.vy -= 9.8 * Math.sqrt(this.eye / 1.6) * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y < g + this.eye) { this.pos.y += (g + this.eye - this.pos.y) * Math.min(1, dt * 14); this.vy = Math.max(0, this.vy); }
      up = 0;
    }
    if (len > 0.05 && !swimming && !this.flying) this.bob += dt * speed * 5 / Math.max(0.3, this.eye);
    const bobY = Math.sin(this.bob) * 0.025 * this.eye;
    e.camera.position.set(this.pos.x, this.pos.y + bobY, this.pos.z);
    e.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  get underwater() {
    const e = this.engine;
    const w = e.waterAt(this.pos.x, this.pos.z);
    return this.active && w !== null && e.camera.position.y < w;
  }
}
