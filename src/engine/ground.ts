import * as THREE from 'three';
import { rng } from './util';

/**
 * Ground types, the tiling noise shared by the terrain shader and the CPU, and the terrain
 * material itself. Ground colour is decided per pixel: the shader looks up the painted type of
 * the four grid vertices around a pixel, warps the lookup with noise and sharpens the blend, so
 * two kinds of ground meet in an organic, slightly ragged edge instead of a blurry gradient or
 * a pixel staircase. The CPU can ask the same question (`groundScores`) so grass, flowers and
 * pebbles stop exactly where the painted ground does.
 */

export interface GroundType {
  id: string;
  name: string;
  emoji: string;
  color: string;
  color2: string;
  /** groundcover densities per m² */
  grass?: number;
  grassColor?: string;
  flowers?: number;
  pebbles?: number;
  litter?: number;
  /** strength of the fine speckle in the ground shader (0 smooth … 0.3 gritty) */
  grain?: number;
}

// New types are only ever appended: saved dioramas store these indices.
export const GROUND_TYPES: GroundType[] = [
  { id: 'grass', name: 'Grass', emoji: '🌱', color: '#5c8a3a', color2: '#77a347', grass: 4.2, grassColor: '#79aa45', grain: 0.1 },
  { id: 'meadow', name: 'Meadow', emoji: '🌼', color: '#6a9541', color2: '#8db45a', grass: 3.4, grassColor: '#88b850', flowers: 0.8, grain: 0.1 },
  { id: 'forest', name: 'Forest floor', emoji: '🍂', color: '#4d3d25', color2: '#6a5432', grass: 0.35, grassColor: '#5e7d36', litter: 3.5, pebbles: 0.1, grain: 0.18 },
  { id: 'dry', name: 'Dry grass', emoji: '🌾', color: '#a8914f', color2: '#c4ad68', grass: 3.0, grassColor: '#c8ae5e', grain: 0.12 },
  { id: 'jungle', name: 'Jungle floor', emoji: '🌿', color: '#3c5527', color2: '#536f34', grass: 1.4, grassColor: '#3f7a32', litter: 1.5, grain: 0.14 },
  { id: 'soil', name: 'Soil', emoji: '🟫', color: '#654a32', color2: '#7a5a3c', pebbles: 0.15, grain: 0.16 },
  { id: 'mud', name: 'Mud', emoji: '🪵', color: '#47382a', color2: '#56442f', pebbles: 0.05, grain: 0.08 },
  { id: 'sand', name: 'Sand', emoji: '🏖️', color: '#d8c08b', color2: '#e8d4a2', grass: 0.06, grassColor: '#a9a35c', pebbles: 0.05, grain: 0.07 },
  { id: 'redsand', name: 'Desert sand', emoji: '🏜️', color: '#c98a54', color2: '#dba46c', grass: 0.03, grassColor: '#a6935a', grain: 0.07 },
  { id: 'rock', name: 'Rock', emoji: '🪨', color: '#78756d', color2: '#918c82', pebbles: 0.9, grain: 0.22 },
  { id: 'gravel', name: 'Gravel', emoji: '⚪', color: '#8a8378', color2: '#a39a8b', pebbles: 3, grain: 0.3 },
  { id: 'moss', name: 'Tundra moss', emoji: '🍃', color: '#6b7a4c', color2: '#8a9361', grass: 1.2, grassColor: '#7f8b52', flowers: 0.12, grain: 0.14 },
  { id: 'snow', name: 'Snow', emoji: '❄️', color: '#e9eff4', color2: '#ffffff', grain: 0.03 },
  { id: 'ice', name: 'Ice', emoji: '🧊', color: '#b6d4e2', color2: '#d3e7f0', grain: 0.04 },
  { id: 'scree', name: 'Scree', emoji: '🪨', color: '#8c877c', color2: '#a7a193', pebbles: 2.4, grain: 0.32 },
  { id: 'cliff', name: 'Cliff rock', emoji: '⛰️', color: '#5e5850', color2: '#757068', pebbles: 0.3, grain: 0.26 },
  { id: 'ash', name: 'Volcanic ash', emoji: '🌋', color: '#3a3735', color2: '#4e4945', pebbles: 0.5, grain: 0.2 },
  { id: 'clay', name: 'Red clay', emoji: '🧱', color: '#a0563a', color2: '#bb7550', pebbles: 0.15, grain: 0.14 },
  { id: 'salt', name: 'Salt flat', emoji: '🧂', color: '#e3ddcd', color2: '#f3efe5', grain: 0.05 },
  { id: 'heath', name: 'Heather', emoji: '🪻', color: '#6e5e5a', color2: '#857262', grass: 1.6, grassColor: '#7c6a5e', flowers: 0.9, grain: 0.16 },
  { id: 'marsh', name: 'Marsh reeds', emoji: '🎋', color: '#4d5c34', color2: '#64733f', grass: 5.2, grassColor: '#7f9147', litter: 0.4, grain: 0.12 },
  { id: 'shingle', name: 'Pebble beach', emoji: '🫧', color: '#948f85', color2: '#b1ab9e', pebbles: 4.5, grain: 0.34 },
];
export const GROUND_INDEX: Record<string, number> = Object.fromEntries(GROUND_TYPES.map((g, i) => [g.id, i]));
/** size of the palette arrays in the shader */
export const MAX_GROUND = 24;

/* ======================= tiling noise (GPU texture + identical CPU sampling) ======================= */
const NOISE_N = 128;
let noiseBytes: Uint8Array | null = null;
let noiseTex: THREE.DataTexture | null = null;

/** periodic value noise: smooth, and seamless when the texture repeats */
function periodicFbm(seed: number, periods: number[], weights: number[]): Float32Array {
  const out = new Float32Array(NOISE_N * NOISE_N);
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  periods.forEach((P, o) => {
    const R = rng(seed * 7919 + o * 104729 + 13);
    const lat = new Float32Array(P * P);
    for (let i = 0; i < lat.length; i++) lat[i] = R();
    for (let y = 0; y < NOISE_N; y++) {
      const fy = (y / NOISE_N) * P, iy = Math.floor(fy), ty = fade(fy - iy);
      const y0 = (iy % P) * P, y1 = ((iy + 1) % P) * P;
      for (let x = 0; x < NOISE_N; x++) {
        const fx = (x / NOISE_N) * P, ix = Math.floor(fx), tx = fade(fx - ix);
        const x0 = ix % P, x1 = (ix + 1) % P;
        const a = lat[y0 + x0], b = lat[y0 + x1], c = lat[y1 + x0], d = lat[y1 + x1];
        out[y * NOISE_N + x] += ((a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty) * weights[o];
      }
    }
  });
  // stretch to the full 0..1 range so every channel has the same contrast
  let lo = Infinity, hi = -Infinity;
  for (const v of out) { if (v < lo) lo = v; if (v > hi) hi = v; }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / (hi - lo || 1);
  return out;
}

function buildNoise() {
  if (noiseBytes) return noiseBytes;
  const ch = [
    periodicFbm(11, [4, 8, 16], [0.6, 0.28, 0.12]),
    periodicFbm(23, [4, 8, 16], [0.6, 0.28, 0.12]),
    periodicFbm(37, [8, 16, 32], [0.55, 0.3, 0.15]),
    periodicFbm(51, [32, 64, 128], [0.5, 0.3, 0.2]),
  ];
  const b = new Uint8Array(NOISE_N * NOISE_N * 4);
  for (let i = 0; i < NOISE_N * NOISE_N; i++) for (let c = 0; c < 4; c++) b[i * 4 + c] = Math.round(ch[c][i] * 255);
  noiseBytes = b;
  return b;
}

export function groundNoiseTexture() {
  if (noiseTex) return noiseTex;
  const t = new THREE.DataTexture(buildNoise(), NOISE_N, NOISE_N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  noiseTex = t;
  return t;
}

/** bilinear, repeating sample of the noise texture (matches the GPU's LinearFilter + RepeatWrapping) */
export function sampleGroundNoise(u: number, v: number, out: Float32Array | number[]) {
  const d = buildNoise();
  const x = u * NOISE_N - 0.5, y = v * NOISE_N - 0.5;
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const M = NOISE_N - 1;
  const x0 = ix & M, x1 = (ix + 1) & M, y0 = iy & M, y1 = (iy + 1) & M;
  const a = (y0 * NOISE_N + x0) * 4, b = (y0 * NOISE_N + x1) * 4, c = (y1 * NOISE_N + x0) * 4, e = (y1 * NOISE_N + x1) * 4;
  for (let k = 0; k < 4; k++) {
    const top = d[a + k] + (d[b + k] - d[a + k]) * fx, bot = d[c + k] + (d[e + k] - d[c + k]) * fx;
    out[k] = (top + (bot - top) * fy) / 255;
  }
  return out;
}

/* ======================= ground scores (CPU twin of the shader) ======================= */
export interface PaintGrid { paint: Uint8Array; nx: number; nz: number; x0: number; z0: number; dx: number; dz: number }
const nl = new Float32Array(4), nm = new Float32Array(4), nj = new Float32Array(4);
const jitterCoef = (t: number) => [Math.sin(t * 1.7 + 0.3), Math.cos(t * 1.3 + 1.1), Math.sin(t * 2.9 + 2.0), Math.cos(t * 0.7 + 0.4)];
const JITTER = Array.from({ length: 256 }, (_, t) => jitterCoef(t));
/**
 * The kinds of ground around a point and a score for each (same maths as the shader): coverage
 * from the four surrounding grid vertices plus each kind's own noise. Returns how many kinds.
 */
export function groundScores(g: PaintGrid, x: number, z: number, types: number[], scores: number[]) {
  sampleGroundNoise(x * 0.02, z * 0.02, nl);
  sampleGroundNoise(x * 0.11 + 0.37, z * 0.11 + 0.61, nm);
  sampleGroundNoise(x * 0.23 + 0.13, z * 0.23 + 0.29, nj);
  const gx = (x + (nl[0] - 0.5) * 0.9 + (nm[0] - 0.5) * 0.36 - g.x0) / g.dx;
  const gz = (z + (nl[1] - 0.5) * 0.9 + (nm[1] - 0.5) * 0.36 - g.z0) / g.dz;
  const bx = Math.floor(gx), bz = Math.floor(gz), fx = gx - bx, fz = gz - bz;
  const at = (i: number, j: number) => g.paint[Math.min(g.nz - 1, Math.max(0, j)) * g.nx + Math.min(g.nx - 1, Math.max(0, i))];
  const tc = [at(bx, bz), at(bx + 1, bz), at(bx, bz + 1), at(bx + 1, bz + 1)];
  const wc = [(1 - fx) * (1 - fz), fx * (1 - fz), (1 - fx) * fz, fx * fz];
  let n = 0;
  for (let i = 0; i < 4; i++) {
    let s = 0;
    while (s < n && types[s] !== tc[i]) s++;
    if (s === n) { types[n] = tc[i]; scores[n] = 0; n++; }
    scores[s] += wc[i];
  }
  for (let s = 0; s < n; s++) {
    const k = JITTER[types[s]];
    scores[s] += ((nj[0] - 0.5) * k[0] + (nj[1] - 0.5) * k[1] + (nj[2] - 0.5) * k[2] + (nj[3] - 0.5) * k[3]) * 0.7;
  }
  return n;
}
const _t = [0, 0, 0, 0], _w = [0, 0, 0, 0];
/** the ground type that shows at a point */
export function dominantGround(g: PaintGrid, x: number, z: number) {
  const n = groundScores(g, x, z, _t, _w);
  let best = 0;
  for (let k = 1; k < n; k++) if (_w[k] > _w[best]) best = k;
  return _t[best];
}

/* ======================= shared uniforms ======================= */
const pal = (k: 'color' | 'color2') => Array.from({ length: MAX_GROUND }, (_, i) => new THREE.Color(GROUND_TYPES[i]?.[k] ?? '#808080'));
/** palette, noise, weather and the editor overlays — shared by every ground mesh */
export const GROUND_UNIFORMS = {
  uPalA: { value: pal('color') },
  uPalB: { value: pal('color2') },
  uGrain: { value: Array.from({ length: MAX_GROUND }, (_, i) => GROUND_TYPES[i]?.grain ?? 0.12) },
  uNoise: { value: null as THREE.Texture | null },
  uSnow: { value: 0 },
  uRockTint: { value: new THREE.Color('#7d7466') },
  uUnderTint: { value: new THREE.Color('#3d5a52') },
  // editor overlays: a selected area, a brush / stamp footprint and a top-view grid
  uSelRect: { value: new THREE.Vector4() },
  uSelOpt: { value: new THREE.Vector4() },
  uCursor: { value: new THREE.Vector4() },
  uCursorOpt: { value: new THREE.Vector4(0, 1, 0, 0) },
  uCursorCol: { value: new THREE.Color('#ffffff') },
  uGridOn: { value: 0 },
};

const FRAG_PARS = /* glsl */ `
uniform sampler2D uPaint;
uniform vec4 uGrid;
uniform vec2 uGridN;
uniform float uWaterY;
uniform float uOverlay;
uniform vec3 uPalA[${MAX_GROUND}];
uniform vec3 uPalB[${MAX_GROUND}];
uniform float uGrain[${MAX_GROUND}];
uniform sampler2D uNoise;
uniform float uSnow;
uniform vec3 uRockTint;
uniform vec3 uUnderTint;
uniform vec4 uSelRect;
uniform vec4 uSelOpt;
uniform vec4 uCursor;
uniform vec4 uCursorOpt;
uniform vec3 uCursorCol;
uniform float uGridOn;
varying vec3 vGW;
varying float vUp;
float ddType(ivec2 c) { c = clamp(c, ivec2(0), ivec2(uGridN) - 1); return texelFetch(uPaint, c, 0).r * 255.0; }
vec3 ddPal(float t, float tone) { int i = int(t + 0.5); return mix(uPalA[i], uPalB[i], tone); }
float ddGrainOf(float t) { return uGrain[int(t + 0.5)]; }
`;

const FRAG_COLOR = /* glsl */ `
float ddLine = 0.0;
vec3 ddLineCol = vec3(0.0);
{
  vec2 p = vGW.xz;
  vec4 nl = texture2D(uNoise, p * 0.02);
  vec4 nm = texture2D(uNoise, p * 0.11 + vec2(0.37, 0.61));
  vec4 nj = texture2D(uNoise, p * 0.23 + vec2(0.13, 0.29));
  vec4 nh = texture2D(uNoise, p * 2.1 + vec2(0.71, 0.53));
  // warp the lookup so edges between kinds of ground wander naturally
  vec2 g = (p + (nl.rg - 0.5) * 0.9 + (nm.rg - 0.5) * 0.36 - uGrid.xy) * uGrid.zw;
  vec2 b = floor(g);
  vec2 f = g - b;
  ivec2 c = ivec2(b);
  float tc[4];
  tc[0] = ddType(c); tc[1] = ddType(c + ivec2(1, 0)); tc[2] = ddType(c + ivec2(0, 1)); tc[3] = ddType(c + ivec2(1, 1));
  float wc[4];
  wc[0] = (1.0 - f.x) * (1.0 - f.y); wc[1] = f.x * (1.0 - f.y); wc[2] = (1.0 - f.x) * f.y; wc[3] = f.x * f.y;
  // how much of each kind of ground covers this spot (smooth), plus a little noise of its own
  float st[4]; float sc[4];
  for (int s = 0; s < 4; s++) { st[s] = -1.0; sc[s] = 0.0; }
  for (int i = 0; i < 4; i++) {
    for (int s = 0; s < 4; s++) {
      if (st[s] < 0.0 || st[s] == tc[i]) { st[s] = tc[i]; sc[s] += wc[i]; break; }
    }
  }
  float fw = max(length(fwidth(g)), 1e-3);
  float sharp = clamp(1.0 / (1.6 * fw), 2.0, 34.0);
  float best = -9.0;
  for (int s = 0; s < 4; s++) {
    if (st[s] < 0.0) continue;
    float t = st[s];
    vec4 k = vec4(sin(t * 1.7 + 0.3), cos(t * 1.3 + 1.1), sin(t * 2.9 + 2.0), cos(t * 0.7 + 0.4));
    sc[s] += dot(nj - 0.5, k) * 0.7;
    best = max(best, sc[s]);
  }
  float tone = clamp((nl.b - 0.5) * 1.6 + (nm.b - 0.5) * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = vec3(0.0);
  float grain = 0.0, wsum = 0.0;
  for (int s = 0; s < 4; s++) {
    if (st[s] < 0.0) continue;
    float w = exp((sc[s] - best) * sharp);
    col += ddPal(st[s], tone) * w;
    grain += ddGrainOf(st[s]) * w;
    wsum += w;
  }
  col /= wsum;
  grain /= wsum;
  col *= 1.0 + (nh.a - 0.5) * grain * 2.0 + (nh.b - 0.5) * 0.06;
  // bare rock shows through on steep slopes
  float steep = smoothstep(0.92, 0.6, vUp);
  col = mix(col, uRockTint * (0.85 + 0.3 * nm.a), steep * 0.55);
  // water: tinted beds, dark wet banks
  float dw = uWaterY - vGW.y;
  if (dw > 0.0) col = mix(col, uUnderTint, 0.25 + clamp(dw / 2.5, 0.0, 1.0) * 0.45);
  else col *= mix(0.78, 1.0, smoothstep(0.0, 0.25, -dw));
  diffuseColor.rgb *= col;
  // snow settles on gentle slopes (not under water)
  float sn = smoothstep(0.55, 0.85, vUp) * uSnow * step(dw, 0.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 0.99), sn);
  if (uOverlay > 0.5) {
    if (uGridOn > 0.0) {
      vec2 fw = max(fwidth(p), vec2(1e-4));
      vec2 a1 = abs(fract(p - 0.5) - 0.5) / fw;
      float l1 = (1.0 - min(min(a1.x, a1.y), 1.0)) * (1.0 - smoothstep(0.06, 0.25, max(fw.x, fw.y)));
      vec2 p5 = p * 0.2;
      vec2 a5 = abs(fract(p5 - 0.5) - 0.5) / (fw * 0.2);
      float l5 = 1.0 - min(min(a5.x, a5.y), 1.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), (l1 * 0.16 + l5 * 0.42) * uGridOn);
    }
    if (uSelOpt.x > 0.5) {
      vec2 sc = (uSelRect.xy + uSelRect.zw) * 0.5;
      vec2 hs = max((uSelRect.zw - uSelRect.xy) * 0.5, vec2(0.01));
      float d;
      if (uSelOpt.y > 0.5) { d = (length((p - sc) / hs) - 1.0) * min(hs.x, hs.y); }
      else { vec2 q = abs(p - sc) - hs; d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
      float px = max(fwidth(d), 1e-4);
      float edge = 1.0 - smoothstep(px * 1.2, px * 2.8, abs(d));
      float inner = (1.0 - smoothstep(px * 0.6, px * 1.6, abs(d + uSelOpt.z))) * step(0.5, fract((p.x - p.y) * 0.6));
      float inside = 1.0 - smoothstep(-px, px, d);
      float ants = step(0.5, fract((p.x + p.y) * 0.5 - uSelOpt.w * 0.6));
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.1, 1.07, 0.9) + vec3(0.05, 0.04, 0.0), inside * 0.75);
      vec3 lc = mix(vec3(1.0, 0.84, 0.22), vec3(1.0), ants);
      diffuseColor.rgb = mix(diffuseColor.rgb, lc, max(edge, inner * 0.55));
      ddLine = max(ddLine, edge);
      ddLineCol = lc;
    }
    if (uCursorOpt.x > 0.5) {
      vec2 q = p - uCursor.xy;
      q = vec2(q.x * uCursorOpt.y + q.y * uCursorOpt.z, -q.x * uCursorOpt.z + q.y * uCursorOpt.y);
      vec2 rr = max(uCursor.zw, vec2(0.01));
      float d = (length(q / rr) - 1.0) * min(rr.x, rr.y);
      float px = max(fwidth(d), 1e-4);
      float ring = 1.0 - smoothstep(px * 1.2, px * 2.8, abs(d));
      float inside = 1.0 - smoothstep(-px, px, d);
      // a short tick marks which way a stretched landform points
      float tick = uCursorOpt.w > 0.5 ? (1.0 - smoothstep(px, px * 2.5, abs(q.y))) * step(0.0, q.x) * step(q.x, rr.x * 1.25) * step(rr.x * 0.75, q.x) : 0.0;
      diffuseColor.rgb = mix(diffuseColor.rgb, uCursorCol, max(ring, tick) * 0.9);
      diffuseColor.rgb *= 1.0 + inside * 0.08;
      ddLine = max(ddLine, max(ring, tick));
      ddLineCol = uCursorCol;
    }
  }
}
`;

export interface GroundMaterialOpts { paint: THREE.Texture; x0: number; z0: number; dx: number; dz: number; nx: number; nz: number; waterY?: number | null; overlay?: boolean }
export interface GroundLocalUniforms {
  uPaint: { value: THREE.Texture };
  uGrid: { value: THREE.Vector4 };
  uGridN: { value: THREE.Vector2 };
  uWaterY: { value: number };
  uOverlay: { value: number };
}

/**
 * A MeshStandardMaterial whose diffuse colour comes from the painted ground. Vertex colours carry
 * only shading (valleys a little darker, ridges a little lighter), so the ground reads clearly
 * from above. Every ground material shares one compiled program.
 */
export function createGroundMaterial(o: GroundMaterialOpts) {
  GROUND_UNIFORMS.uNoise.value = groundNoiseTexture();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  const local: GroundLocalUniforms = {
    uPaint: { value: o.paint },
    uGrid: { value: new THREE.Vector4(o.x0, o.z0, 1 / o.dx, 1 / o.dz) },
    uGridN: { value: new THREE.Vector2(o.nx, o.nz) },
    uWaterY: { value: o.waterY ?? -1e4 },
    uOverlay: { value: o.overlay === false ? 0 : 1 },
  };
  mat.userData.ground = local;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, GROUND_UNIFORMS, local);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW;\nvarying float vUp;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvUp = objectNormal.y;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += ddLineCol * ddLine * 0.55;');
  };
  mat.customProgramCacheKey = () => 'dd-ground-2';
  return mat;
}

/** a single-channel texture of ground-type indices over a grid (one texel per vertex) */
export function createPaintTexture(paint: Uint8Array, nx: number, nz: number) {
  const t = new THREE.DataTexture(paint, nx, nz, THREE.RedFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}
