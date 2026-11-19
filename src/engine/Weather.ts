import * as THREE from 'three';
import type { Quality, Weather as WeatherKind } from './types';
import { rng } from './util';

const rainVert = /* glsl */ `
uniform float uTime; uniform float uHeight; uniform float uBase; uniform float uSpeed; uniform vec2 uWind; uniform vec2 uOffset;
attribute float aSeed; attribute float aEnd;
varying float vA;
void main() {
  vec3 p = position;
  float fall = mod(p.y - uBase - uTime * uSpeed * (0.85 + aSeed * 0.3), uHeight);
  float y = uBase + fall;
  float len = 0.45 + aSeed * 0.25;
  vec3 wp = vec3(p.x + uOffset.x + uWind.x * (uHeight - fall) * 0.08, y + aEnd * len, p.z + uOffset.y + uWind.y * (uHeight - fall) * 0.08);
  wp.x += aEnd * uWind.x * 0.06; wp.z += aEnd * uWind.y * 0.06;
  vA = 0.55 * (1.0 - aEnd * 0.6);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const rainFrag = /* glsl */ `
uniform vec3 uColor; varying float vA; uniform float uOpacity;
void main() { gl_FragColor = vec4(uColor, vA * uOpacity); }`;

const snowVert = /* glsl */ `
uniform float uTime; uniform float uHeight; uniform float uBase; uniform float uSize; uniform float uPixel; uniform vec2 uOffset;
attribute float aSeed;
void main() {
  vec3 p = position;
  float fall = mod(p.y - uBase - uTime * (0.55 + aSeed * 0.5), uHeight);
  vec3 wp = vec3(p.x + uOffset.x + sin(uTime * 0.7 + aSeed * 20.0) * 0.6, uBase + fall, p.z + uOffset.y + cos(uTime * 0.5 + aSeed * 13.0) * 0.6);
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixel * (0.6 + aSeed * 0.8) / max(0.5, -mv.z);
}`;
const snowFrag = /* glsl */ `
uniform float uOpacity;
void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; gl_FragColor = vec4(1.0, 1.0, 1.0, smoothstep(0.5, 0.1, d) * 0.9 * uOpacity); }`;

export class WeatherFX {
  group = new THREE.Group();
  private rain?: THREE.LineSegments;
  private snow?: THREE.Points;
  private uniforms = {
    uTime: { value: 0 }, uHeight: { value: 20 }, uBase: { value: 0 }, uSpeed: { value: 16 },
    uWind: { value: new THREE.Vector2(0.6, 0.2) }, uColor: { value: new THREE.Color('#c9d6e2') },
    uSize: { value: 0.12 }, uPixel: { value: 600 }, uOpacity: { value: 1 },
    uOffset: { value: new THREE.Vector2() },
  };
  private home = { x: 0, z: 0, base: 0, height: 20 };
  kind: WeatherKind = 'clear';
  flash = 0;
  private nextFlash = 3;
  onThunder?: () => void;

  /**
   * Keep the rain or snow falling around a point (the endless world); null puts it back over
   * the diorama it was built for.
   */
  follow(x: number | null, z = 0, groundY = 0) {
    const u = this.uniforms;
    if (x === null) { u.uOffset.value.set(0, 0); u.uBase.value = this.home.base; u.uHeight.value = this.home.height; return; }
    u.uOffset.value.set(x - this.home.x, z - this.home.z);
    u.uBase.value = groundY - 4;
    u.uHeight.value = 26;
  }

  constructor() { this.group.name = 'weather'; }

  build(kind: WeatherKind, bounds: { minX: number; maxX: number; minZ: number; maxZ: number; bottom: number; top: number }, quality: Quality) {
    this.clear();
    this.kind = kind;
    const u = this.uniforms;
    u.uBase.value = bounds.bottom;
    u.uHeight.value = Math.max(4, bounds.top - bounds.bottom);
    u.uOffset.value.set(0, 0);
    this.home = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2, base: bounds.bottom, height: u.uHeight.value };
    const q = quality === 'high' ? 1 : quality === 'medium' ? 0.6 : 0.35;
    const R = rng(11);
    const W = bounds.maxX - bounds.minX, D = bounds.maxZ - bounds.minZ;
    if (kind === 'rain' || kind === 'storm') {
      const n = Math.round((kind === 'storm' ? 6000 : 3500) * q);
      const pos = new Float32Array(n * 6), seed = new Float32Array(n * 2), end = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const x = bounds.minX + R() * W, z = bounds.minZ + R() * D, y = bounds.bottom + R() * u.uHeight.value, s = R();
        pos.set([x, y, z, x, y, z], i * 6);
        seed[i * 2] = seed[i * 2 + 1] = s;
        end[i * 2] = 0; end[i * 2 + 1] = 1;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
      u.uSpeed.value = kind === 'storm' ? 22 : 15;
      (u.uWind.value as THREE.Vector2).set(kind === 'storm' ? 2.5 : 0.8, kind === 'storm' ? 0.8 : 0.3);
      const m = new THREE.ShaderMaterial({ vertexShader: rainVert, fragmentShader: rainFrag, uniforms: u, transparent: true, depthWrite: false });
      this.rain = new THREE.LineSegments(g, m);
      this.rain.frustumCulled = false;
      this.group.add(this.rain);
    }
    if (kind === 'snow') {
      const n = Math.round(4500 * q);
      const pos = new Float32Array(n * 3), seed = new Float32Array(n);
      for (let i = 0; i < n; i++) { pos.set([bounds.minX + R() * W, bounds.bottom + R() * u.uHeight.value, bounds.minZ + R() * D], i * 3); seed[i] = R(); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      const m = new THREE.ShaderMaterial({ vertexShader: snowVert, fragmentShader: snowFrag, uniforms: u, transparent: true, depthWrite: false });
      this.snow = new THREE.Points(g, m);
      this.snow.frustumCulled = false;
      this.group.add(this.snow);
    }
  }

  setPixelRatio(heightPx: number) { this.uniforms.uPixel.value = heightPx * 0.9; }

  update(t: number, dt: number) {
    this.uniforms.uTime.value = t;
    if (this.kind === 'storm') {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) {
        this.flash = 1;
        this.nextFlash = 4 + Math.random() * 8;
        setTimeout(() => this.onThunder?.(), 300 + Math.random() * 900);
      }
    }
    this.flash = Math.max(0, this.flash - dt * 3.5);
  }

  clear() {
    for (const o of [this.rain, this.snow]) if (o) { this.group.remove(o); o.geometry.dispose(); (o.material as THREE.Material).dispose(); }
    this.rain = undefined; this.snow = undefined;
    this.flash = 0;
  }
}
