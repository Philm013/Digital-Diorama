/*
 * FLORA BACKGROUND (High Detail)
 * Parametric tall aquatic plants for three.js: Vallisneria twisting ribbons, Amazon Sword rosettes
 * with folded lanceolate blades, and Rotala stems with whorled leaves and blushing tips.
 * Whole stems sway on the GPU (aSway weight 0 at root -> 1 at tip), one draw call when merged.
 *
 * QUICK START
 *   import { createAsset } from './flora-background.mjs';
 *   const wall = createAsset({ plantSpecies: 'rotala', leafColor: 'red', heightAt });
 *   scene.add(wall); // loop: wall.userData.update(t)
 *
 * PARAMS  plantSpecies: amazon | rotala | vallisneria ; leafColor: green | red | bronze
 *         density 0.2-2, height 0.1-0.7 m, width/depth band, surfaceY, swayStrength, seed
 *         optional heightAt(x,z), mask(x,z), rootPosition(x,rng) callbacks constrain placement
 * SPECS  ~4,000-16,000 triangles, 1 material, 1.1 x 0.4 x 0.12 m default.
 * PARTS  animate: stems (vertex sway)
 *        detach: stems (one group per plant when not merged)
 * LICENSE MIT - procedural geometry, free for commercial use.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = { leaf: '#3c9a3a', leafLight: '#72c450', leafDark: '#246a28', tip: '#9ad050', stem: '#4a8a3a', root: '#d8d0b0' };

export const COLORWAYS = {
  'default': { ...BASE },
  'green':   { ...BASE },
  'red':     { leaf: '#b8402e', leafLight: '#e8704a', leafDark: '#7a2418', tip: '#ff6a8a', stem: '#8a3a2a', root: '#d8c0b0' },
  'bronze':  { leaf: '#8a6a2a', leafLight: '#b8923a', leafDark: '#5a4418', tip: '#d88a3a', stem: '#6a5a2a', root: '#d8ccb0' },
  'neon':    { leaf: '#a040ff', leafLight: '#30f0ff', leafDark: '#6020c0', tip: '#ff40c8', stem: '#5030a0', root: '#e0d0ff' }
};

export const presets = COLORWAYS;

export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'One mesh or selectable plants.' },
  leafColor:    { type: 'choice', default: 'green', options: Object.keys(COLORWAYS).filter(k => k !== 'default'), label: 'Leaf Color', affects: 'colors', describe: 'Vibrant green, deep red, bronze (or neon).' },
  plantSpecies: { type: 'choice', default: 'vallisneria', options: ['amazon', 'rotala', 'vallisneria'], label: 'Species', affects: 'geometry', describe: 'Background species.' },
  density:      { type: 'range', default: 1, min: 0.2, max: 2, step: 0.1, label: 'Density', affects: 'geometry', describe: 'Sparse accents to dense jungle wall.' },
  height:       { type: 'range', default: 0.38, min: 0.1, max: 0.7, step: 0.01, label: 'Height', affects: 'geometry', describe: 'Typical plant height (m).' },
  maxHeight:    { type: 'range', default: 0.45, min: 0.1, max: 0.9, step: 0.01, label: 'Surface Limit', affects: 'geometry', describe: 'Ribbons bend over at this height (water surface).' },
  surfaceY:     { type: 'range', default: 1.2, min: 0.1, max: 2, step: 0.01, label: 'Water Surface', affects: 'geometry', describe: 'Absolute waterline in the plant coordinate system.' },
  width:        { type: 'range', default: 1.1, min: 0.1, max: 2.4, step: 0.05, label: 'Band Width', affects: 'geometry', describe: 'X extent (m).' },
  depth:        { type: 'range', default: 0.1, min: 0.03, max: 0.5, step: 0.01, label: 'Band Depth', affects: 'geometry', describe: 'Z extent (m).' },
  swayStrength: { type: 'range', default: 0.02, min: 0, max: 0.06, step: 0.002, label: 'Sway', affects: 'geometry', describe: 'Wavemaker flow amplitude.' },
  seed:         { type: 'range', default: 9, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Growth seed.' }
};

export const rig = { stems: { axis: 'x', range: [-0.06, 0.06], describe: 'Stems sway rhythmically in the flow.' } };
export const detach = ['stems'];
export const night = {};

const ZONE_KEYS = Object.keys(BASE);
const COLORWAYS_LOOKUP = COLORWAYS;
const hexOf = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v & 0xFFFFFF;
  if (typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v)) return parseInt(v.replace('#', ''), 16);
  return null;
};

function zonesFor(name, o = {}) {
  const cw = COLORWAYS_LOOKUP[name] || COLORWAYS_LOOKUP['default'];
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

function makeSwayMat(strength) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6, metalness: 0.0, side: THREE.DoubleSide });
  const uniforms = { uTime: { value: 0 }, uSway: { value: strength } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime; sh.uniforms.uSway = uniforms.uSway;
    sh.vertexShader = 'attribute float aSway;\nuniform float uTime;\nuniform float uSway;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float sw = aSway * aSway;
      float ph = position.x * 5.0 + position.z * 3.0;
      transformed.x += (sin(uTime * 0.9 + ph) + 0.4 * sin(uTime * 2.1 + ph * 2.0 + aSway * 3.0)) * uSway * sw;
      transformed.z += cos(uTime * 0.7 + ph * 1.3) * uSway * 0.5 * sw;`);
  };
  mat.customProgramCacheKey = () => 'background-sway';
  mat.userData.uniforms = uniforms;
  return mat;
}
const MAT = makeSwayMat(0.02);

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

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function createAsset(userParams = {}) {
  const p = {};
  for (const k of Object.keys(params)) p[k] = params[k].default;
  Object.assign(p, userParams);
  const C = zonesFor(p.leafColor, userParams);
  const merge = !!p.mergeForProduction;
  const rnd = rng(p.seed);
  const heightAt = typeof userParams.heightAt === 'function' ? userParams.heightAt : () => 0;
  const mask = typeof userParams.mask === 'function' ? userParams.mask : () => true;
  const rootPosition = typeof userParams.rootPosition === 'function' ? userParams.rootPosition : null;
  const mat = makeSwayMat(p.swayStrength);

  const plants = []; // each: { key -> {pos, sw} }
  let cur = null;
  const B = (ck) => (cur[ck] ||= { pos: [], sw: [] });
  const tri = (ck, a, b, c, sa, sb, sc) => { const b0 = B(ck); b0.pos.push(...a, ...b, ...c); b0.sw.push(sa, sb, sc); };
  const quad = (ck, a, b, c, d, sa, sb, sc, sd) => { tri(ck, a, b, c, sa, sb, sc); tri(ck, a, c, d, sa, sc, sd); };

  const W = p.width, D = p.depth;
  const spacing = { vallisneria: 0.03, amazon: 0.12, rotala: 0.022 }[p.plantSpecies] / Math.sqrt(p.density);
  const n = Math.max(1, Math.round(W / spacing));

  for (let i = 0; i < n; i++) {
    cur = {}; plants.push(cur);
    const x = -W / 2 + (i + 0.2 + rnd() * 0.6) * W / n;
    let root = rootPosition ? rootPosition(x, rnd) : null;
    if (!rootPosition) {
      for (let attempt = 0; attempt < 18; attempt++) {
        const zTry = -D / 2 + rnd() * D;
        if (mask(x, zTry)) { root = [x, zTry]; break; }
      }
    }
    if (!root || !mask(root[0], root[1])) { plants.pop(); continue; }
    const [rx, rz] = root;
    cur.rootX = rx; cur.rootZ = rz;
    const y0 = heightAt(rx, rz) - 0.002;
    const room = Math.min(p.maxHeight, p.surfaceY - y0 - 0.025);
    if (room < 0.045) { plants.pop(); continue; }
    const requested = p.height * (0.65 + rnd() * 0.55);
    const factor = p.plantSpecies === 'vallisneria' ? 1.2 : p.plantSpecies === 'rotala' ? 1.1 : 1.0;
    const H = Math.min(requested, room / factor);

    if (p.plantSpecies === 'vallisneria') {
      const leaves = 3 + Math.floor(rnd() * 3);
      for (let l = 0; l < leaves; l++) {
        const ck = ['leaf', 'leafLight', 'leafDark'][Math.floor(rnd() * 3)];
        const len = H * (0.7 + rnd() * 0.5), w = 0.0035 + rnd() * 0.002, segs = 12;
        const ang = rnd() * Math.PI * 2, twist = (rnd() - 0.5) * 5, lean = (rnd() - 0.5) * 0.14;
        let prevL = null, prevR = null;
        for (let k = 0; k <= segs; k++) {
          const t = k / segs, a = ang + twist * t;
          const curl = Math.max(0, t - 0.78) ** 2 * len * 0.45;
          const px = rx + lean * len * t + Math.cos(ang) * curl + Math.sin(t * twist) * 0.003;
          const pz = rz + Math.sin(ang) * curl + Math.cos(t * twist) * 0.003;
          const py = y0 + len * t;
          const ww = w * (k === segs ? 0.15 : 1 - t * 0.3);
          const ox = Math.cos(a) * ww, oz = Math.sin(a) * ww;
          const Lp = [px - ox, py, pz - oz], Rp = [px + ox, py, pz + oz];
          const sw = Math.min(1, (py - y0) / p.height);
          if (prevL) quad(ck, prevL[0], prevR[0], Rp, Lp, prevL[1], prevR[1], sw, sw);
          prevL = [Lp, sw]; prevR = [Rp, sw];
        }
      }
    } else if (p.plantSpecies === 'amazon') {
      const leaves = 8 + Math.floor(rnd() * 6);
      for (let l = 0; l < leaves; l++) {
        const ck = l % 3 === 0 ? 'leafLight' : l % 3 === 1 ? 'leaf' : 'leafDark';
        const ang = l / leaves * Math.PI * 2 + rnd() * 0.4;
        const len = H * (0.5 + rnd() * 0.5), wmax = len * 0.11, pet = 0.3;
        const tilt = 0.25 + rnd() * 0.55; // outward lean from vertical
        const dx = Math.cos(ang), dz = Math.sin(ang), px = -dz, pz = dx;
        const segs = 9;
        let prev = null;
        for (let k = 0; k <= segs; k++) {
          const t = k / segs;
          const arc = tilt * (0.4 + t * 1.2);
          const r = Math.sin(arc) * len * t * 0.55, y = y0 + Math.cos(arc * 0.7) * len * t;
          const cx = rx + dx * r, cz = rz + dz * r;
          const bt = Math.max(0, (t - pet) / (1 - pet));
          const ww = t < pet ? 0.0012 : wmax * Math.pow(Math.sin(Math.PI * Math.min(1, bt * 0.95 + 0.02)), 0.75);
          const fold = ww * 0.25;
          const sw = t * Math.min(1, len / p.height);
          const Lp = [cx - px * ww, y - fold, cz - pz * ww], Mp = [cx, y, cz], Rp = [cx + px * ww, y - fold, cz + pz * ww];
          if (prev) { quad(ck, prev[0], prev[1], Mp, Lp, prev[3], prev[3], sw, sw); quad(ck, prev[1], prev[2], Rp, Mp, prev[3], prev[3], sw, sw); }
          prev = [Lp, Mp, Rp, sw];
        }
      }
      // crown at the base
      tri('stem', [rx - 0.006, y0, rz], [rx + 0.006, y0, rz], [rx, y0 + 0.02, rz], 0, 0, 0.02);
    } else {
      // ROTALA: stems (swept tube) with whorls of narrow leaves, blushing tips
      const stems = 1 + Math.floor(rnd() * 2);
      for (let s = 0; s < stems; s++) {
        const sx = rx + (rnd() - 0.5) * 0.008, sz = rz + (rnd() - 0.5) * 0.008, h = H * (0.8 + rnd() * 0.3);
        const bend = new THREE.Vector3((rnd() - 0.5) * 0.06, 0, (rnd() - 0.5) * 0.04);
        const path = new THREE.CatmullRomCurve3([
          new THREE.Vector3(sx, y0, sz), new THREE.Vector3(sx + bend.x * 0.3, y0 + h * 0.35, sz + bend.z * 0.3),
          new THREE.Vector3(sx + bend.x * 0.8, y0 + h * 0.7, sz + bend.z * 0.8), new THREE.Vector3(sx + bend.x, y0 + h, sz + bend.z)
        ]);
        const tube = new THREE.TubeGeometry(path, 10, 0.0014, 4, false).toNonIndexed();
        const tp = tube.attributes.position.array;
        for (let k = 0; k < tp.length; k += 9) tri('stem', [tp[k], tp[k + 1], tp[k + 2]], [tp[k + 3], tp[k + 4], tp[k + 5]], [tp[k + 6], tp[k + 7], tp[k + 8]], (tp[k + 1] - y0) / p.height, (tp[k + 4] - y0) / p.height, (tp[k + 7] - y0) / p.height);
        const whorls = Math.floor(h / 0.011);
        for (let w = 1; w <= whorls; w++) {
          const t = w / whorls, c = path.getPointAt(t);
          const ck = t > 0.8 ? 'tip' : t > 0.55 ? 'leafLight' : rnd() > 0.5 ? 'leaf' : 'leafDark';
          const ll = 0.012 * (1 - t * 0.5), lw = 0.0022;
          const sw = (c.y - y0) / p.height;
          for (let k = 0; k < 3; k++) {
            const a = w * 0.9 + k * Math.PI * 2 / 3;
            const ex = Math.cos(a), ez = Math.sin(a);
            const tipP = [c.x + ex * ll, c.y + ll * 0.55, c.z + ez * ll];
            const mid = [c.x + ex * ll * 0.45, c.y + ll * 0.2, c.z + ez * ll * 0.45];
            const l1 = [mid[0] - ez * lw, mid[1], mid[2] + ex * lw], l2 = [mid[0] + ez * lw, mid[1], mid[2] - ex * lw];
            tri(ck, [c.x, c.y, c.z], l1, tipP, sw, sw, sw); tri(ck, [c.x, c.y, c.z], tipP, l2, sw, sw, sw);
          }
        }
      }
    }
    // white root tuft
    tri('root', [rx - 0.004, y0 + 0.001, rz], [rx + 0.004, y0 + 0.001, rz + 0.002], [rx, y0 - 0.006, rz], 0, 0, 0);

    // Clip each generated leaf back toward its safe root before GPU sway is applied.
    for (const bucket of Object.values(cur)) {
      if (!bucket || !Array.isArray(bucket.pos)) continue;
      for (let k = 0; k < bucket.pos.length; k += 3) {
        const ox = bucket.pos[k], oz = bucket.pos[k + 2];
        if (mask(ox, oz)) continue;
        let lo = 0, hi = 1;
        for (let j = 0; j < 14; j++) {
          const mid = (lo + hi) * 0.5;
          if (mask(rx + (ox - rx) * mid, rz + (oz - rz) * mid)) lo = mid;
          else hi = mid;
        }
        bucket.pos[k] = rx + (ox - rx) * lo;
        bucket.pos[k + 2] = rz + (oz - rz) * lo;
      }
    }
  }

  const list = [];
  plants.forEach((pl, i) => {
    for (const [ck, b] of Object.entries(pl)) {
      if (!b || !Array.isArray(b.pos) || !b.pos.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b.pos), 3));
      geo.setAttribute('aSway', new THREE.BufferAttribute(new Float32Array(b.sw.map(v => Math.max(0, Math.min(1.3, v)))), 1));
      list.push({ g: geo, c: C[ck], n: 'plant' + (i + 1) + '_' + ck });
    }
  });

  const audit = { vertices: 0, outsideFootprint: 0, aboveSurface: 0, maxY: -Infinity };
  for (const pl of plants) for (const bucket of Object.values(pl)) {
    if (!bucket || !Array.isArray(bucket.pos)) continue;
    for (let i = 0; i < bucket.pos.length; i += 3) {
      const x = bucket.pos[i], y = bucket.pos[i + 1], z = bucket.pos[i + 2];
      audit.vertices++;
      if (!mask(x, z)) audit.outsideFootprint++;
      if (y > p.surfaceY + 1e-5) audit.aboveSurface++;
      audit.maxY = Math.max(audit.maxY, y);
    }
  }

  const g = new THREE.Group(); g.name = 'flora-background';
  const m = finish(list, mat, 'stems', merge); if (m) g.add(m);
  g.userData = {
    material: mat,
    audit,
    setRig(name, v) { if (name === 'stems') mat.userData.uniforms.uSway.value = v; },
    update(t) { mat.userData.uniforms.uTime.value = t; }
  };
  return g;
}

export default createAsset;
