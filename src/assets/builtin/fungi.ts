import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ParamSpec } from '../modules';
import { Noise2D, rng } from '../../engine/util';

/* Small procedural kit in the same shape as the reference modules:
   createAsset(params) → THREE.Group, plus a params schema for the inspector. */

function colorize(g: THREE.BufferGeometry, c: THREE.ColorRepresentation, jitter = 0, R?: () => number) {
  const geo = g.index ? g.toNonIndexed() : g;
  const col = new THREE.Color(c);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) {
    const k = jitter && R ? 1 + (R() - 0.5) * jitter : 1;
    for (let v = 0; v < 3 && i + v < n; v++) { arr[(i + v) * 3] = col.r * k; arr[(i + v) * 3 + 1] = col.g * k; arr[(i + v) * 3 + 2] = col.b * k; }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  return geo;
}
function finish(parts: THREE.BufferGeometry[], name: string, mat: THREE.Material) {
  const m = mergeGeometries(parts.filter(Boolean));
  parts.forEach((p) => p.dispose());
  m.computeVertexNormals();
  const mesh = new THREE.Mesh(m, mat);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
const solidMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });

/* ---------------- mushrooms ---------------- */
export const MUSHROOMS: Record<string, { label: string; cap: string; stem: string; gill: string; shape: 'convex' | 'funnel' | 'bun' | 'ball' | 'cone' | 'bell'; h: number; r: number; spots?: string; glow?: string }> = {
  'fly-agaric': { label: 'Fly agaric', cap: '#d4321f', stem: '#f1ece0', gill: '#efe6d2', shape: 'convex', h: 0.16, r: 0.075, spots: '#fbf6ea' },
  chanterelle: { label: 'Chanterelle', cap: '#eba52c', stem: '#e8a232', gill: '#dd9422', shape: 'funnel', h: 0.08, r: 0.05 },
  porcini: { label: 'Porcini (cep)', cap: '#7b4a26', stem: '#e7dcc2', gill: '#d9cf8f', shape: 'bun', h: 0.14, r: 0.08 },
  puffball: { label: 'Puffball', cap: '#efe8d6', stem: '#e8e0cb', gill: '#e8e0cb', shape: 'ball', h: 0.07, r: 0.05 },
  morel: { label: 'Morel', cap: '#9a7a52', stem: '#eee2c6', gill: '#5a4026', shape: 'cone', h: 0.12, r: 0.035 },
  'ghost-mycena': { label: 'Glowing mushroom', cap: '#d9f2c4', stem: '#e8f4d8', gill: '#cfe8b8', shape: 'bell', h: 0.06, r: 0.022, glow: '#8dff5a' },
};

const MUSHROOM_PARAMS: Record<string, ParamSpec> = {
  species: { type: 'choice', default: 'fly-agaric', options: Object.keys(MUSHROOMS), label: 'Species' },
  count: { type: 'range', default: 5, min: 1, max: 14, step: 1, label: 'Mushrooms' },
  spread: { type: 'range', default: 0.25, min: 0.05, max: 1, step: 0.01, unit: 'm', label: 'Spread' },
  size: { type: 'range', default: 1, min: 0.4, max: 2, step: 0.05, label: 'Size' },
  seed: { type: 'range', default: 3, min: 1, max: 999, step: 1, label: 'Seed' },
};

function capProfile(shape: string, r: number, h: number) {
  const pts: THREE.Vector2[] = [];
  const N = 9;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let x = 0, y = 0;
    switch (shape) {
      case 'convex': x = r * Math.sin(t * Math.PI / 2) * (1 + 0.05 * Math.sin(t * 9)); y = h * 0.42 * Math.cos(t * Math.PI / 2); break;
      case 'bun': x = r * Math.sin(t * Math.PI / 2); y = h * 0.5 * Math.pow(Math.cos(t * Math.PI / 2), 0.7); break;
      case 'funnel': x = r * t; y = h * 0.12 + h * 0.22 * t * t - (t > 0.85 ? (t - 0.85) * h * 0.8 : 0); break;
      case 'bell': x = r * Math.sin(t * Math.PI / 2) * 0.9; y = h * 0.6 * Math.cos(t * Math.PI / 2.2); break;
      case 'cone': x = r * Math.pow(t, 0.8); y = h * 0.75 * (1 - t); break;
      default: x = r * Math.sin(t * Math.PI); y = r * (1 - Math.cos(t * Math.PI));
    }
    pts.push(new THREE.Vector2(Math.max(0.0005, x), y));
  }
  return pts;
}

export function createMushrooms(p: Record<string, unknown> = {}) {
  const P = { ...Object.fromEntries(Object.entries(MUSHROOM_PARAMS).map(([k, v]) => [k, v.default])), ...p } as Record<string, any>;
  const sp = MUSHROOMS[P.species] ?? MUSHROOMS['fly-agaric'];
  const R = rng(Number(P.seed) || 3);
  const N = new Noise2D(Number(P.seed) || 3);
  const parts: THREE.BufferGeometry[] = [], glowParts: THREE.BufferGeometry[] = [];
  const count = Math.round(Number(P.count));
  for (let i = 0; i < count; i++) {
    const a = R() * Math.PI * 2, d = i === 0 ? 0 : Math.sqrt(R()) * Number(P.spread);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const k = (0.55 + R() * 0.65) * Number(P.size) * (i === 0 ? 1.15 : 1);
    const h = sp.h * k, r = sp.r * k;
    const lean = (R() - 0.5) * 0.25;
    const g = new THREE.Group();
    if (sp.shape === 'ball') {
      const ball = new THREE.IcosahedronGeometry(r, 1);
      const pos = ball.attributes.position as THREE.BufferAttribute;
      for (let v = 0; v < pos.count; v++) { const y = pos.getY(v); pos.setY(v, y < 0 ? y * 0.6 : y * 0.9); }
      ball.translate(x, r * 0.6, z);
      parts.push(colorize(ball, sp.cap, 0.08, R));
      continue;
    }
    const stemH = sp.shape === 'funnel' ? h * 0.7 : sp.shape === 'cone' ? h * 0.45 : h * 0.75;
    const sr = r * (sp.shape === 'bun' ? 0.42 : sp.shape === 'bell' ? 0.14 : 0.26);
    const stemPts = [new THREE.Vector2(sr * (sp.shape === 'bun' ? 1.5 : 1.15), 0), new THREE.Vector2(sr * 1.1, stemH * 0.2), new THREE.Vector2(sr * 0.9, stemH * 0.7), new THREE.Vector2(sr * 0.8, stemH)];
    const stem = new THREE.LatheGeometry(stemPts, 7);
    const cap = new THREE.LatheGeometry(capProfile(sp.shape, r, h), 12);
    const capPos = cap.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < capPos.count; v++) {
      const vx = capPos.getX(v), vz = capPos.getZ(v);
      const w = N.noise(vx * 30 + i, vz * 30) * r * (sp.shape === 'cone' ? 0.18 : 0.05);
      capPos.setXYZ(v, vx * (1 + w / r), capPos.getY(v) + stemH * 0.92 + w * 0.3, vz * (1 + w / r));
    }
    const gills = new THREE.CircleGeometry(r * 0.95, 12).rotateX(Math.PI / 2).translate(0, stemH * 0.93, 0);
    const m = new THREE.Matrix4().makeRotationZ(lean).premultiply(new THREE.Matrix4().makeTranslation(x, 0, z));
    for (const [geo, col] of [[stem, sp.stem], [cap, sp.cap], [gills, sp.gill]] as const) {
      geo.applyMatrix4(m);
      (sp.glow && geo === cap ? glowParts : parts).push(colorize(geo, col, 0.06, R));
    }
    if (sp.spots) {
      const nSpots = 7 + Math.floor(R() * 6);
      for (let s = 0; s < nSpots; s++) {
        const sa = R() * Math.PI * 2, sd = R() * 0.8;
        const t = sd;
        const sy = stemH * 0.92 + h * 0.42 * Math.cos(t * Math.PI / 2) + 0.002;
        const spot = new THREE.IcosahedronGeometry(r * (0.08 + R() * 0.06), 0).scale(1, 0.45, 1)
          .translate(Math.cos(sa) * r * Math.sin(t * Math.PI / 2), sy, Math.sin(sa) * r * Math.sin(t * Math.PI / 2));
        spot.applyMatrix4(m);
        parts.push(colorize(spot, sp.spots));
      }
    }
    void g;
  }
  const group = new THREE.Group();
  group.name = 'mushrooms';
  group.add(finish(parts, 'mushrooms-solid', solidMat()));
  let glowMat: THREE.MeshStandardMaterial | null = null;
  if (glowParts.length) {
    glowMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6, emissive: new THREE.Color(sp.glow), emissiveIntensity: 0.05 });
    group.add(finish(glowParts, 'mushrooms-glow', glowMat));
  }
  group.userData.setNight = (v: number) => { if (glowMat) glowMat.emissiveIntensity = 0.05 + v * 1.6; };
  return group;
}

/* ---------------- fallen log ---------------- */
const LOG_PARAMS: Record<string, ParamSpec> = {
  length: { type: 'range', default: 3.2, min: 1, max: 8, step: 0.1, unit: 'm', label: 'Length' },
  radius: { type: 'range', default: 0.28, min: 0.1, max: 0.7, step: 0.01, unit: 'm', label: 'Radius' },
  moss: { type: 'range', default: 0.6, min: 0, max: 1, step: 0.05, label: 'Moss' },
  fungi: { type: 'range', default: 6, min: 0, max: 16, step: 1, label: 'Bracket fungi' },
  decay: { type: 'range', default: 0.5, min: 0, max: 1, step: 0.05, label: 'Decay' },
  seed: { type: 'range', default: 5, min: 1, max: 999, step: 1, label: 'Seed' },
};
export function createLog(p: Record<string, unknown> = {}) {
  const P = { ...Object.fromEntries(Object.entries(LOG_PARAMS).map(([k, v]) => [k, v.default])), ...p } as Record<string, any>;
  const R = rng(Number(P.seed));
  const N = new Noise2D(Number(P.seed));
  const L = Number(P.length), r = Number(P.radius);
  const body = new THREE.CylinderGeometry(r * 0.92, r, L, 12, Math.max(6, Math.round(L * 4)), false).rotateZ(Math.PI / 2);
  const pos = body.attributes.position as THREE.BufferAttribute;
  const cols: number[] = [];
  const bark = new THREE.Color('#5d4632'), dark = new THREE.Color('#3d2c1e'), moss = new THREE.Color('#5f7d34'), rot = new THREE.Color('#8a6a45'), c = new THREE.Color();
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
    const bend = Math.sin((x / L) * Math.PI) * r * 0.25;
    const n = N.noise(x * 3, Math.atan2(z, y) * 2) * r * 0.12;
    const rr = Math.hypot(y, z) || 1;
    const k = (rr + n - Number(P.decay) * 0.08 * r * (N.noise(x * 6, z * 6) > 0.3 ? 1 : 0)) / rr;
    pos.setXYZ(v, x, y * k + bend + r, z * k);
    c.copy(bark).lerp(dark, Math.max(0, N.noise(x * 8, y * 8)) * 0.6);
    if (y / rr > 0.25 && N.noise(x * 1.7, z * 2) > 0.45 - Number(P.moss) * 0.9) c.lerp(moss, 0.85);
    if (Math.abs(x) > L / 2 - 0.02) c.copy(rot);
    cols.push(c.r, c.g, c.b);
  }
  body.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const parts: THREE.BufferGeometry[] = [colorizeKeep(body)];
  // end grain rings
  for (const sx of [-1, 1]) {
    const ring = new THREE.CircleGeometry(r * 0.9, 12).rotateY(sx * Math.PI / 2).translate(sx * L / 2, r + Math.sin(sx * Math.PI / 2 * 0) * 0, 0);
    parts.push(colorize(ring, '#a98559'));
    const inner = new THREE.CircleGeometry(r * 0.45, 10).rotateY(sx * Math.PI / 2).translate(sx * (L / 2 + 0.003), r, 0);
    parts.push(colorize(inner, '#8a6a42'));
  }
  // bracket fungi
  for (let i = 0; i < Number(P.fungi); i++) {
    const x = (R() - 0.5) * L * 0.85, a = (R() * 0.9 + 0.05) * Math.PI * (R() > 0.5 ? 1 : -1);
    const s = r * (0.35 + R() * 0.35);
    const shelf = new THREE.SphereGeometry(s, 8, 4, 0, Math.PI, 0, Math.PI / 2).scale(1, 0.35, 0.9).rotateX(-Math.PI / 2 * 0).rotateY(a > 0 ? 0 : Math.PI);
    shelf.translate(x, r + Math.cos(a) * r * 0.95 - 0.02, Math.sin(a) * r * 1.02);
    parts.push(colorize(shelf, R() > 0.5 ? '#c99a5b' : '#e3c9a0', 0.12, R));
  }
  const group = new THREE.Group();
  group.name = 'fallen-log';
  group.add(finish(parts, 'log', solidMat()));
  return group;
}
function colorizeKeep(g: THREE.BufferGeometry) {
  const geo = g.index ? g.toNonIndexed() : g;
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  return geo;
}

/* ---------------- termite mound ---------------- */
const MOUND_PARAMS: Record<string, ParamSpec> = {
  height: { type: 'range', default: 2.6, min: 0.6, max: 6, step: 0.1, unit: 'm', label: 'Height' },
  width: { type: 'range', default: 1.4, min: 0.5, max: 3, step: 0.05, unit: 'm', label: 'Width' },
  spires: { type: 'range', default: 3, min: 1, max: 6, step: 1, label: 'Spires' },
  seed: { type: 'range', default: 4, min: 1, max: 999, step: 1, label: 'Seed' },
};
export function createTermiteMound(p: Record<string, unknown> = {}) {
  const P = { ...Object.fromEntries(Object.entries(MOUND_PARAMS).map(([k, v]) => [k, v.default])), ...p } as Record<string, any>;
  const R = rng(Number(P.seed));
  const N = new Noise2D(Number(P.seed));
  const parts: THREE.BufferGeometry[] = [];
  const H = Number(P.height), W = Number(P.width);
  for (let s = 0; s < Number(P.spires); s++) {
    const main = s === 0;
    const h = main ? H : H * (0.35 + R() * 0.4), w = main ? W : W * (0.35 + R() * 0.3);
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(Math.max(0.01, w * 0.5 * Math.pow(1 - t, 0.75) * (1 + 0.12 * Math.sin(t * 9))), t * h)); }
    const g = new THREE.LatheGeometry(pts, 14);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const ox = main ? 0 : (R() - 0.5) * W * 0.9, oz = main ? 0 : (R() - 0.5) * W * 0.6;
    const cols: number[] = [];
    const c = new THREE.Color(), base = new THREE.Color('#a8673c'), lite = new THREE.Color('#c98a55'), hole = new THREE.Color('#3a2414');
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
      const n = N.noise(x * 4 + s, y * 3 + z * 4) * 0.12 * w;
      const k = 1 + n / Math.max(0.05, Math.hypot(x, z));
      pos.setXYZ(v, x * k + ox, y, z * k + oz);
      c.copy(base).lerp(lite, 0.5 + 0.5 * N.noise(y * 5, x * 5));
      if (N.noise(x * 11, y * 11 + z * 7) > 0.7) c.copy(hole);
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    parts.push(colorizeKeep(g));
  }
  const group = new THREE.Group();
  group.name = 'termite-mound';
  group.add(finish(parts, 'mound', solidMat()));
  return group;
}

/* ---------------- bird nest ---------------- */
const NEST_PARAMS: Record<string, ParamSpec> = {
  eggs: { type: 'range', default: 3, min: 0, max: 6, step: 1, label: 'Eggs' },
  eggColor: { type: 'color', default: '#9fd3e0', label: 'Egg colour' },
  size: { type: 'range', default: 0.22, min: 0.1, max: 0.6, step: 0.01, unit: 'm', label: 'Nest width' },
  seed: { type: 'range', default: 9, min: 1, max: 999, step: 1, label: 'Seed' },
};
export function createNest(p: Record<string, unknown> = {}) {
  const P = { ...Object.fromEntries(Object.entries(NEST_PARAMS).map(([k, v]) => [k, v.default])), ...p } as Record<string, any>;
  const R = rng(Number(P.seed));
  const S = Number(P.size);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 26; i++) {
    const a0 = R() * Math.PI * 2, rad = S * (0.38 + R() * 0.14), y = S * (0.05 + R() * 0.22);
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 6; k++) { const a = a0 + k * 0.28; pts.push(new THREE.Vector3(Math.cos(a) * rad, y + (R() - 0.5) * S * 0.08, Math.sin(a) * rad)); }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, S * 0.018, 3, false);
    parts.push(colorize(tube, R() > 0.5 ? '#8a6a42' : '#a7834f', 0.15, R));
  }
  const bowl = new THREE.SphereGeometry(S * 0.4, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, S * 0.26, 0);
  parts.push(colorize(bowl, '#6e5232'));
  for (let e = 0; e < Number(P.eggs); e++) {
    const a = (e / Math.max(1, Number(P.eggs))) * Math.PI * 2 + R();
    const egg = new THREE.SphereGeometry(S * 0.085, 8, 6).scale(1, 1.3, 1).rotateZ(1.2).rotateY(a).translate(Math.cos(a) * S * 0.12, S * 0.1, Math.sin(a) * S * 0.12);
    parts.push(colorize(egg, String(P.eggColor)));
  }
  const group = new THREE.Group();
  group.name = 'bird-nest';
  group.add(finish(parts, 'nest', solidMat()));
  return group;
}

export const FUNGI_BUILTINS: Record<string, { createAsset: (p?: Record<string, unknown>) => THREE.Object3D; params: Record<string, ParamSpec> }> = {
  mushrooms: { createAsset: createMushrooms, params: MUSHROOM_PARAMS },
  log: { createAsset: createLog, params: LOG_PARAMS },
  'termite-mound': { createAsset: createTermiteMound, params: MOUND_PARAMS },
  nest: { createAsset: createNest, params: NEST_PARAMS },
};
