/*
 * HARDSCAPE STONE (High Detail)
 * Parametric aquascape rock formations for three.js: watertight noise-displaced icospheres with
 * per-facet zone colouring (calcite veins, algae dusting, coralline patches), arranged as Iwagumi
 * monoliths, archways or rubble, with optional hollow cave voids.
 * Exposes userData.peaks (coral perches) and userData.gaps (fish swim-through points).
 *
 * QUICK START
 *   import { createAsset } from './hardscape-stone.mjs';
 *   scene.add(createAsset({ stoneType: 'seiryu', formation: 'monoliths', mergeForProduction: true }));
 *
 * PARAMS  stoneType: seiryu | dragon | river | liverock ; formation: monoliths | archway | rubble
 *         count 3-14, size 0.5-1.6, algaeLevel 0-1, caveVoids toggle, seed
 * SPECS  ~3,000-8,000 triangles, 1 material, ~0.45 x 0.3 x 0.3 m default.
 * PARTS  animate: none
 *        detach: caveVoids, satellites
 * LICENSE MIT - procedural geometry, free for commercial use.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = {
  stone: '#7b7f84', stoneDark: '#55595e', stoneLight: '#a2a6aa', vein: '#e8e6e0',
  algae: '#6f8f3a', coralline: '#8a3a8a'
};

export const COLORWAYS = {
  'default':  { ...BASE },
  'seiryu':   { stone: '#6e7378', stoneDark: '#4a4e53', stoneLight: '#9aa0a5', vein: '#eeece6', algae: '#6f8f3a', coralline: '#5e6266' },
  'dragon':   { stone: '#8a6a44', stoneDark: '#5a4028', stoneLight: '#a88a60', vein: '#c8a878', algae: '#6a7a30', coralline: '#704a2a' },
  'river':    { stone: '#8c8478', stoneDark: '#6a6258', stoneLight: '#b0a898', vein: '#d8d0c0', algae: '#5a7a34', coralline: '#7a7064' },
  'liverock': { stone: '#d8cfc4', stoneDark: '#b4a89c', stoneLight: '#efe8de', vein: '#ff7ab8', algae: '#5a8a3a', coralline: '#7a2a8a' },
  'abyssal':  { stone: '#4a2a5a', stoneDark: '#2a1636', stoneLight: '#6a3a7a', vein: '#ff4ab0', algae: '#30c0a0', coralline: '#9a30c0' },
  'synthetic':{ stone: '#2a2c34', stoneDark: '#18191e', stoneLight: '#40434e', vein: '#30f0ff', algae: '#c040ff', coralline: '#ff40c0' }
};

export const presets = COLORWAYS;

export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'Merge per material or keep selectable rocks.' },
  colorway:   { type: 'choice', default: 'auto', options: ['auto', ...Object.keys(COLORWAYS)], label: 'Palette', affects: 'colors', describe: 'auto follows stoneType.' },
  stoneType:  { type: 'choice', default: 'seiryu', options: ['seiryu', 'dragon', 'river', 'liverock'], label: 'Stone Type', affects: 'geometry', describe: 'Seiryu, Dragon Stone, River Rock or Reef Live Rock.' },
  formation:  { type: 'choice', default: 'monoliths', options: ['monoliths', 'archway', 'rubble'], label: 'Formation', affects: 'geometry', describe: 'Layout of the stones.' },
  count:      { type: 'range', default: 7, min: 3, max: 14, step: 1, label: 'Stone Count', affects: 'geometry', describe: 'Satellite stones.' },
  size:       { type: 'range', default: 1, min: 0.5, max: 1.6, step: 0.05, label: 'Size', affects: 'geometry', describe: 'Formation scale (rebuilt).' },
  algaeLevel: { type: 'range', default: 0.15, min: 0, max: 1, step: 0.05, label: 'Algae', affects: 'geometry', describe: 'Pristine to green-dusted.' },
  caveVoids:  { type: 'toggle', default: true, label: 'Cave Voids', affects: 'geometry', describe: 'Hollow cave for fish to hide.' },
  seed:       { type: 'range', default: 5, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Shape seed.' }
};

export const rig = {};
export const detach = ['caveVoids', 'satellites'];
export const night = {};

const ZONE_KEYS = Object.keys(BASE);
const hexOf = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v & 0xFFFFFF;
  if (typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v)) return parseInt(v.replace('#', ''), 16);
  return null;
};

function zonesFor(name, o = {}) {
  const cw = COLORWAYS[name] || COLORWAYS['default'];
  const used = new Set(), out = {};
  for (const k of ZONE_KEYS) {
    let hex = (hexOf(o[k]) ?? hexOf(cw[k]) ?? hexOf(BASE[k])) & 0xFFFFFF;
    while (used.has(hex)) hex = (hex + 1) & 0xFFFFFF;
    used.add(hex); out[k] = hex;
  }
  return out;
}

function prep(geo, hex) {
  if (geo.index) geo = geo.toNonIndexed();
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  if (geo.attributes.normal) geo.deleteAttribute('normal');
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide });

function finish(list, material = MAT, name = 'solid', merge = true) {
  if (list.length === 0) return null;
  if (merge) {
    const merged = mergeGeometries(list.map(p => prep(p.g, p.c)));
    if (!merged) return null;
    merged.computeVertexNormals();
    const m = new THREE.Mesh(merged, material);
    m.name = name; m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  const g = new THREE.Group();
  g.name = name;
  list.forEach((p, i) => {
    const geo = prep(p.g, p.c);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material);
    m.name = p.n ? `${name}_${p.n}_${i + 1}` : `${name}_part_${i + 1}`;
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  });
  return g;
}

function box(w, h, d, x = 0, y = 0, z = 0) { return new THREE.BoxGeometry(w, h, d).translate(x, y, z); }

function addCylinder(parts, rTop, rBot, h, segs, x, y, z, rx = 0, ry = 0, rz = 0, hex = '#888888') {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  if (rx) geo.rotateX(rx); if (ry) geo.rotateY(ry); if (rz) geo.rotateZ(rz);
  geo.translate(x, y, z); parts.push({ g: geo, c: hex });
}

function addWire(parts, p1, p2, hex, r = 0.01, radialSegments = 5) {
  const v1 = new THREE.Vector3(...p1), v2 = new THREE.Vector3(...p2);
  const dist = v1.distanceTo(v2); if (dist < 1e-5) return;
  const geo = new THREE.CylinderGeometry(r, r, dist, radialSegments);
  const mid = v1.clone().lerp(v2, 0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v2.clone().sub(v1).normalize());
  geo.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
  parts.push({ g: geo, c: hex });
}

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// smooth deterministic noise: sum of seeded oriented sines
function makeNoise(rnd) {
  const waves = Array.from({ length: 6 }, (_, i) => {
    const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    return [v.x, v.y, v.z, 1.5 + i * 1.3 + rnd(), rnd() * 6.28, 1 / (1 + i * 0.7)];
  });
  return (x, y, z) => { let s = 0, n = 0; for (const w of waves) { s += Math.sin((x * w[0] + y * w[1] + z * w[2]) * w[3] + w[4]) * w[5]; n += w[5]; } return s / n; };
}

const TYPE = {
  seiryu:   { detail: 2, amp: 0.16, ridge: 0.22, pit: 0, freq: 1.0 },
  dragon:   { detail: 2, amp: 0.14, ridge: 0.05, pit: 0.28, freq: 1.6 },
  river:    { detail: 2, amp: 0.05, ridge: 0, pit: 0, freq: 0.7 },
  liverock: { detail: 2, amp: 0.26, ridge: 0.04, pit: 0.2, freq: 2.2 }
};

export function createAsset(userParams = {}) {
  const p = {};
  for (const k of Object.keys(params)) p[k] = params[k].default;
  Object.assign(p, userParams);
  const cwName = p.colorway === 'auto' ? p.stoneType : p.colorway;
  const C = zonesFor(cwName, userParams);
  const merge = !!p.mergeForProduction;
  const rnd = rng(p.seed);
  const S = p.size;
  const T = TYPE[p.stoneType] || TYPE.seiryu;
  const groundFn = typeof userParams.groundFn === 'function' ? userParams.groundFn : () => 0;

  const g = new THREE.Group(); g.name = 'hardscape-stone';
  const main = [], sats = [], cave = [];
  const peaks = [], gaps = [], rocks = [];

  // Build one rock: displaced icosphere -> facets bucketed into colour zones
  const rock = (list, r, sx, sy, sz, x, z, opt = {}) => {
    const noise = makeNoise(rnd), noise2 = makeNoise(rnd);
    const geo = new THREE.IcosahedronGeometry(1, opt.detail ?? T.detail);
    const pos = geo.attributes.position, v = new THREE.Vector3();
    const pitMask = [];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const f = T.freq;
      let d = 1 + T.amp * noise(v.x * f * 2, v.y * f * 2, v.z * f * 2);
      d += T.ridge * (0.5 - Math.abs(noise2(v.x * 3, v.y * 3, v.z * 3))) * 0.6;
      const pn = noise2(v.x * 6 + 3, v.y * 6, v.z * 6);
      const pitted = T.pit > 0 && pn > 0.35;
      if (pitted) d -= T.pit * (pn - 0.35);
      if (v.y < -0.3) d *= 0.9 + 0.1 * (1 + v.y); // flatten base
      pitMask.push(pitted);
      pos.setXYZ(i, v.x * d * sx, v.y * d * sy, v.z * d * sz);
    }
    geo.scale(r, r, r);
    if (opt.rz) geo.rotateZ(opt.rz);
    if (opt.rx) geo.rotateX(opt.rx);
    geo.rotateY(opt.ry ?? rnd() * 6.28);
    const sink = opt.sink ?? 0.45;
    const baseY = (opt.y ?? groundFn(x, z)) + r * sy * (1 - sink * 1.4) * 0.6;
    geo.translate(x, baseY, z);
    const arr = geo.attributes.position.array;
    const buckets = {};
    const A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3(), N = new THREE.Vector3(), E1 = new THREE.Vector3(), E2 = new THREE.Vector3();
    let topY = -Infinity, topP = null;
    for (let i = 0; i < arr.length; i += 9) {
      A.set(arr[i], arr[i + 1], arr[i + 2]); B.set(arr[i + 3], arr[i + 4], arr[i + 5]); Cc.set(arr[i + 6], arr[i + 7], arr[i + 8]);
      N.crossVectors(E1.subVectors(B, A), E2.subVectors(Cc, A)).normalize();
      const cx = (A.x + B.x + Cc.x) / 3, cy = (A.y + B.y + Cc.y) / 3, cz = (A.z + B.z + Cc.z) / 3;
      if (cy > topY) { topY = cy; topP = [cx, cy, cz]; }
      let key = 'stone';
      const tn = noise(cx * 40, cy * 40, cz * 40);
      if (tn > 0.35) key = 'stoneLight'; else if (tn < -0.35) key = 'stoneDark';
      if (p.stoneType === 'seiryu' && Math.abs(Math.sin(cy * 160 + cx * 60 + tn * 4)) < 0.1) key = 'vein';
      if (p.stoneType === 'dragon' && pitMask[i / 3]) key = 'stoneDark';
      if (p.stoneType === 'liverock' && noise2(cx * 30, cy * 30, cz * 30) > 0.15) key = 'coralline';
      if (p.stoneType === 'liverock' && rnd() < 0.03) key = 'vein';
      if (N.y > 0.55 && rnd() < p.algaeLevel * N.y) key = 'algae';
      (buckets[key] ||= []).push(...arr.slice(i, i + 9));
    }
    for (const [k, a] of Object.entries(buckets)) {
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(a), 3));
      list.push({ g: bg, c: C[k], n: 'rock_' + k });
    }
    rocks.push([x, z, r * Math.max(sx, sz)]);
    if (topP) peaks.push(topP);
    return topY;
  };

  const lean = (rnd() - 0.5) * 0.2 + 0.18; // Iwagumi stones share a common lean direction
  if (p.formation === 'monoliths') {
    rock(main, 0.075 * S, 0.85, 2.1, 0.75, 0, 0, { rz: -lean, sink: 0.25 });                  // oyaishi
    rock(main, 0.06 * S, 0.9, 1.6, 0.8, 0.13 * S, 0.05 * S, { rz: -lean * 1.1, sink: 0.3 });  // fukuishi
    rock(main, 0.05 * S, 1, 1.3, 0.85, -0.12 * S, 0.06 * S, { rz: -lean * 0.8, sink: 0.3 }); // soeishi
    for (let i = 0; i < p.count; i++) {
      const a = rnd() * Math.PI * 2, d = (0.12 + rnd() * 0.14) * S;
      rock(sats, (0.015 + rnd() * 0.025) * S, 1, 0.8 + rnd() * 0.6, 1, Math.cos(a) * d, Math.sin(a) * d * 0.7, { rz: -lean, sink: 0.4, detail: 1 });
    }
    { const gx = 0.075 * S, gz = 0.055 * S; gaps.push([gx, groundFn(gx, gz) + 0.05 * S + 0.035, gz]); }
  } else if (p.formation === 'archway') {
    const sep = 0.085 * S;
    const h1 = rock(main, 0.05 * S, 0.8, 2.2, 0.8, -sep, 0, { rz: 0.18, sink: 0.2 });
    const h2 = rock(main, 0.048 * S, 0.8, 2.0, 0.8, sep, 0.01, { rz: -0.2, sink: 0.2 });
    const lintelY = Math.min(h1, h2) - 0.012 * S;
    rock(main, 0.06 * S, 2.3, 0.65, 0.9, 0, 0.005, { y: lintelY - 0.06 * S * 0.65 * 0.3, sink: 0, rz: (rnd() - 0.5) * 0.15, ry: (rnd() - 0.5) * 0.3 });
    { const gy = groundFn(0, 0.005); gaps.push([0, gy + (lintelY - gy) * 0.45, 0.005]); }
    for (let i = 0; i < p.count; i++) {
      const a = rnd() * Math.PI * 2, d = (0.14 + rnd() * 0.12) * S;
      rock(sats, (0.015 + rnd() * 0.03) * S, 1, 0.7 + rnd() * 0.7, 1, Math.cos(a) * d, Math.sin(a) * d * 0.7, { sink: 0.4, detail: 1 });
    }
  } else {
    for (let i = 0; i < p.count + 6; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.2 * S;
      rock(i < 3 ? main : sats, (0.02 + rnd() * 0.035) * S, 1 + rnd() * 0.3, 0.6 + rnd() * 0.6, 1, Math.cos(a) * d, Math.sin(a) * d * 0.7, { sink: 0.35, detail: i < 3 ? 2 : 1 });
    }
  }

  // cave voids: two wall stones + roof slab enclosing a hollow facing the front
  const caveGroup = new THREE.Group(); caveGroup.name = 'caveVoids';
  if (p.caveVoids) {
    const cx = 0.17 * S, cz = 0.02 * S, wsep = 0.04 * S;
    const ha = rock(cave, 0.03 * S, 0.7, 1.2, 1.5, cx - wsep, cz, { sink: 0.15, ry: 0.1 });
    const hb = rock(cave, 0.03 * S, 0.7, 1.1, 1.5, cx + wsep, cz, { sink: 0.15, ry: -0.1 });
    rock(cave, 0.045 * S, 1.6, 0.5, 1.4, cx, cz, { y: Math.min(ha, hb) - 0.012 * S, sink: 0 });
    gaps.push([cx, groundFn(cx, cz) + 0.02 * S, cz + 0.03 * S]);
  }

  const m1 = finish(main, MAT, 'stones', merge); if (m1) g.add(m1);
  const sg = new THREE.Group(); sg.name = 'satellites'; const m2 = finish(sats, MAT, 'satelliteStones', merge); if (m2) sg.add(m2); g.add(sg);
  const m3 = finish(cave, MAT, 'cave', merge); if (m3) caveGroup.add(m3); g.add(caveGroup);

  peaks.sort((a, b) => b[1] - a[1]);
  g.userData = {
    peaks, gaps, rocks, top: peaks.length ? peaks[0][1] : 0,
    setRig(name, v) { if (name === 'caveVoids') caveGroup.visible = !!v; if (name === 'satellites') sg.visible = !!v; },
    update() {}
  };
  return g;
}

export default createAsset;
