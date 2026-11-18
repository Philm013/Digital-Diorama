import * as THREE from 'three';
import { clamp, smoothstep } from './util';

export interface SkyState {
  hour: number;
  sunDir: THREE.Vector3;
  moonDir: THREE.Vector3;
  sunUp: number; // 0..1 above-horizon factor
  night: number; // 0 day .. 1 full night
  dusk: number; // 0..1 golden hour glow
  top: THREE.Color;
  horizon: THREE.Color;
  sunColor: THREE.Color;
  lightColor: THREE.Color;
  lightIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
}

type Key = [number, string, string, string, number];
// hour, sky top, horizon, light colour, light intensity
const KEYS: Key[] = [
  [0, '#070b1c', '#18223d', '#7d93c9', 0.32],
  [4.5, '#0b1330', '#27304f', '#8095c7', 0.3],
  [5.6, '#283a6b', '#e8946a', '#ff9f73', 0.55],
  [6.6, '#5b8fd0', '#f6c99a', '#ffd2a1', 1.6],
  [8, '#4f8ed6', '#cfe4f2', '#fff0d8', 2.6],
  [12, '#3f86d8', '#c4e1f4', '#fffaf0', 3.0],
  [16, '#4b8bd4', '#d6e6f0', '#fff2dc', 2.7],
  [17.8, '#5a7fc0', '#f8c48f', '#ffcf94', 1.9],
  [18.9, '#3b4b84', '#ff8a5a', '#ff9a66', 0.85],
  [19.9, '#1b2450', '#7a4f78', '#a58ac6', 0.4],
  [21, '#0a1027', '#1f2747', '#7d93c9', 0.32],
  [24, '#070b1c', '#18223d', '#7d93c9', 0.32],
];

const cA = new THREE.Color(), cB = new THREE.Color();

export function skyAt(hour: number, out?: SkyState): SkyState {
  const h = ((hour % 24) + 24) % 24;
  let k = 0;
  while (k < KEYS.length - 2 && KEYS[k + 1][0] <= h) k++;
  const a = KEYS[k], b = KEYS[k + 1];
  const t = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
  const s = out ?? {
    hour: h, sunDir: new THREE.Vector3(), moonDir: new THREE.Vector3(), sunUp: 0, night: 0, dusk: 0,
    top: new THREE.Color(), horizon: new THREE.Color(), sunColor: new THREE.Color(), lightColor: new THREE.Color(),
    lightIntensity: 1, hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), hemiIntensity: 1,
  };
  s.hour = h;
  s.top.copy(cA.set(a[1])).lerp(cB.set(b[1]), t);
  s.horizon.copy(cA.set(a[2])).lerp(cB.set(b[2]), t);
  s.lightColor.copy(cA.set(a[3])).lerp(cB.set(b[3]), t);
  s.lightIntensity = a[4] + (b[4] - a[4]) * t;
  // sun path: rises in the east (+x), arcs over the south (+z, the viewer's side) and sets in the west
  const ang = ((h - 6) / 12) * Math.PI;
  s.sunDir.set(Math.cos(ang), Math.sin(ang) * 0.92, 0.42 + 0.3 * Math.max(0, Math.sin(ang))).normalize();
  s.moonDir.set(-Math.cos(ang) * 0.8, Math.max(0.35, -Math.sin(ang) * 0.85), 0.55).normalize();
  s.sunUp = smoothstep(-0.08, 0.12, s.sunDir.y);
  s.night = 1 - smoothstep(-0.16, 0.06, s.sunDir.y);
  s.dusk = smoothstep(0.42, 0.08, Math.abs(s.sunDir.y)) * (1 - s.night * 0.6);
  s.sunColor.set('#fff1cf').lerp(cA.set('#ff8a50'), s.dusk);
  s.hemiSky.copy(s.top).lerp(s.horizon, 0.45);
  s.hemiGround.set('#5a4a36').lerp(cA.set('#141820'), s.night);
  s.hemiIntensity = 0.95 - 0.7 * s.night;
  return s;
}

/* ---------- gradient sky dome used in island / open / walk modes ---------- */
const domeVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // keep at the far plane
}`;
const domeFrag = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uSunColor;
uniform float uSunUp;
uniform float uNight;
uniform float uOvercast;
uniform float uTime;
varying vec3 vDir;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.55, h));
  col = mix(col, uGround, smoothstep(0.0, -0.25, h));
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(sd, 900.0) * 3.0 + pow(sd, 12.0) * 0.35) * uSunUp;
  float md = max(dot(d, normalize(uMoonDir)), 0.0);
  col += vec3(0.85, 0.9, 1.0) * smoothstep(0.9993, 0.9996, md) * uNight;
  if (uNight > 0.01 && h > 0.0) {
    vec3 sp = floor(d * 380.0);
    float s = step(0.9975, hash(sp)) * (0.6 + 0.4 * sin(uTime * 2.0 + hash(sp + 1.0) * 30.0));
    col += vec3(s) * uNight * smoothstep(0.0, 0.25, h);
  }
  // soft clouds
  if (h > 0.02) {
    vec3 q = d / max(h, 0.05) * 1.3 + vec3(uTime * 0.01, 0.0, uTime * 0.004);
    float c = noise(q) * 0.55 + noise(q * 2.3) * 0.3 + noise(q * 5.1) * 0.15;
    c = smoothstep(0.55 - uOvercast * 0.35, 0.85, c) * smoothstep(0.02, 0.2, h);
    vec3 cc = mix(vec3(1.0), uHorizon, 0.3) * (1.0 - 0.75 * uNight);
    col = mix(col, cc, c * 0.85);
  }
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum) * 0.8, uOvercast * 0.75);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class SkyDome {
  mesh: THREE.Mesh;
  uniforms: Record<string, THREE.IUniform>;
  constructor() {
    this.uniforms = {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGround: { value: new THREE.Color('#3b4a3a') },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() },
      uSunUp: { value: 1 },
      uNight: { value: 0 },
      uOvercast: { value: 0 },
      uTime: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: domeVert, fragmentShader: domeFrag, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
    this.mesh.name = 'sky-dome';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }
  apply(s: SkyState, overcast: number, t: number, ground?: THREE.Color) {
    const u = this.uniforms;
    (u.uTop.value as THREE.Color).copy(s.top);
    (u.uHorizon.value as THREE.Color).copy(s.horizon);
    if (ground) (u.uGround.value as THREE.Color).copy(ground);
    (u.uSunDir.value as THREE.Vector3).copy(s.sunDir);
    (u.uMoonDir.value as THREE.Vector3).copy(s.moonDir);
    (u.uSunColor.value as THREE.Color).copy(s.sunColor);
    u.uSunUp.value = s.sunUp;
    u.uNight.value = s.night;
    u.uOvercast.value = overcast;
    u.uTime.value = t;
  }
}
