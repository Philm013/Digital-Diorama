/*
 * FLORA CARPET (High Detail)
 * Parametric foreground carpeting plants for three.js: Dwarf Hairgrass blades, Dwarf Baby Tears
 * mounds and Monte Carlo round-leaf cushions, distributed by a coverage noise field across any
 * terrain (pass heightAt). Blades sway on the GPU via a per-vertex aSway weight (one draw call).
 *
 * QUICK START
 *   import { createAsset } from './flora-carpet.mjs';
 *   const lawn = createAsset({ plantSpecies: 'hairgrass', coverage: 0.8, heightAt: bed.userData.heightAt });
 *   scene.add(lawn); // loop: lawn.userData.update(t)
 *
 * PARAMS  plantSpecies: babytears | hairgrass | montecarlo ; coverage 0-1 ; density 0.4-2
 *         width/depth (area), swayStrength, seed ; options: heightAt(x,z), mask(x,z)->bool
 * SPECS  ~6,000-24,000 triangles, 1 material, 0.6 x 0.03-0.07 x 0.3 m default.
 * PARTS  animate: blades (vertex sway)
 *        detach: patches (each tile group)
 * LICENSE MIT - procedural geometry, free for commercial use.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = { leaf: '#3fa83a', leafLight: '#7fd04a', leafDark: '#2a7a2c', stem: '#5a9a3a', root: '#c8d8b0' };

export const COLORWAYS = {
  'default': { ...BASE },
  'emerald': { leaf: '#1f9a4a', leafLight: '#4fd070', leafDark: '#146a34', stem: '#3a8a4a', root: '#c8e0c0' },
  'lime':    { leaf: '#7ac83a', leafLight: '#b0e85a', leafDark: '#4a9a2a', stem: '#6aa83a', root: '#e0f0c0' },
  'deep':    { leaf: '#2a6a34', leafLight: '#4a8a3a', leafDark: '#1a4a24', stem: '#3a6a34', root: '#a8b898' },
  'neon':    { leaf: '#30ffa0', leafLight: '#a0ff60', leafDark: '#10c0a0', stem: '#20d080', root: '#e0ffe0' }
};

export const presets = COLORWAYS;

export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'Merge into one mesh or keep selectable patch tiles.' },
  colorway:     { type: 'choice', default: 'default', options: Object.keys(COLORWAYS), label: 'Palette', affects: 'colors', describe: 'Leaf green family.' },
  plantSpecies: { type: 'choice', default: 'hairgrass', options: ['babytears', 'hairgrass', 'montecarlo'], label: 'Species', affects: 'geometry', describe: 'Carpet species.' },
  coverage:     { type: 'range', default: 0.75, min: 0, max: 1, step: 0.05, label: 'Coverage', affects: 'geometry', describe: 'Patchy tufts to seamless carpet.' },
  density:      { type: 'range', default: 1, min: 0.4, max: 2, step: 0.1, label: 'Density', affects: 'geometry', describe: 'Clumps per area.' },
  width:        { type: 'range', default: 0.6, min: 0.1, max: 2.4, step: 0.05, label: 'Area Width', affects: 'geometry', describe: 'X extent (m).' },
  depth:        { type: 'range', default: 0.3, min: 0.1, max: 0.9, step: 0.05, label: 'Area Depth', affects: 'geometry', describe: 'Z extent (m).' },
  bladeHeight:  { type: 'range', default: 0.05, min: 0.015, max: 0.12, step: 0.005, label: 'Blade Height', affects: 'geometry', describe: 'Hairgrass height (m).' },
  swayStrength: { type: 'range', default: 0.006, min: 0, max: 0.02, step: 0.001, label: 'Sway', affects: 'geometry', describe: 'Current-driven undulation.' },
  seed:         { type: 'range', default: 3, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Distribution seed.' }
};

export const rig = { blades: { axis: 'x', range: [-0.02, 0.02], describe: 'Blades undulate in the current (vertex shader).' } };
export const detach = ['patches'];
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

function makeSwayMat(strength) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7, metalness: 0.0, side: THREE.DoubleSide });
  const uniforms = { uTime: { value: 0 }, uSway: { value: strength } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime; sh.uniforms.uSway = uniforms.uSway;
    sh.vertexShader = 'attribute float aSway;\nuniform float uTime;\nuniform float uSway;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float sw = aSway * aSway;
      transformed.x += sin(uTime * 1.4 + position.x * 9.0 + position.z * 6.0) * uSway * sw;
      transformed.z += cos(uTime * 1.1 + position.x * 7.0 - position.z * 4.0) * uSway * 0.6 * sw;`);
  };
  mat.customProgramCacheKey = () => 'carpet-sway';
  mat.userData.uniforms = uniforms;
  return mat;
}
const MAT = makeSwayMat(0.006);

function finish(list, material = MAT, name = 'solid', merge = true) {
  if (list.length === 0) return null;
  if (merge) {
    const merged = mergeGeometries(list.map(p => prep(p.g, p.c)));
    if (!merged) return null;
    merged.computeVertexNormals();
    const m = new THREE.Mesh(merged, material);
    m.name = name; m.castShadow = false; m.receiveShadow = true;
    return m;
  }
  const g = new THREE.Group();
  g.name = name;
  list.forEach((p, i) => {
    const geo = prep(p.g, p.c);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material);
    m.name = p.n ? `${name}_${p.n}_${i + 1}` : `${name}_part_${i + 1}`;
    m.receiveShadow = true;
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

export function createAsset(userParams = {}) {
  const p = {};
  for (const k of Object.keys(params)) p[k] = params[k].default;
  Object.assign(p, userParams);
  const C = zonesFor(p.colorway, userParams);
  const merge = !!p.mergeForProduction;
  const rnd = rng(p.seed);
  const heightAt = typeof userParams.heightAt === 'function' ? userParams.heightAt : () => 0;
  const mask = typeof userParams.mask === 'function' ? userParams.mask : () => true;
  const mat = makeSwayMat(p.swayStrength);
  const clampXZ = (px, pz, rx, rz) => {
    if (mask(px, pz)) return [px, pz];
    let lo = 0, hi = 1;
    for (let i = 0; i < 14; i++) {
      const t = (lo + hi) * 0.5;
      if (mask(rx + (px - rx) * t, rz + (pz - rz) * t)) lo = t;
      else hi = t;
    }
    return [rx + (px - rx) * lo, rz + (pz - rz) * lo];
  };

  const W = p.width, D = p.depth;
  const TX = Math.max(1, Math.round(W / 0.2)), TZ = Math.max(1, Math.round(D / 0.15));
  const tiles = new Map(); // tileKey -> colourKey -> {pos:[], sw:[]}
  const bucket = (x, z, ck) => {
    const tx = Math.min(TX - 1, Math.max(0, Math.floor((x + W / 2) / W * TX))), tz = Math.min(TZ - 1, Math.max(0, Math.floor((z + D / 2) / D * TZ)));
    const key = tx + '_' + tz;
    if (!tiles.has(key)) tiles.set(key, {});
    const t = tiles.get(key);
    return (t[ck] ||= { pos: [], sw: [] });
  };
  const tri = (b, a, c, d, sa, sc, sd) => { b.pos.push(...a, ...c, ...d); b.sw.push(sa, sc, sd); };

  const ph1 = rnd() * 10, ph2 = rnd() * 10;
  const cov = (x, z) => 0.5 + 0.25 * Math.sin(x * 9 + ph1) * Math.cos(z * 11 + ph2) + 0.25 * Math.sin(x * 23 - z * 17 + ph2);

  const cell = (p.plantSpecies === 'hairgrass' ? 0.016 : 0.02) / Math.sqrt(p.density);
  const nx = Math.ceil(W / cell), nz = Math.ceil(D / cell);
  const colours = ['leaf', 'leafLight', 'leafDark'];

  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = -W / 2 + (i + rnd()) * cell, z = -D / 2 + (j + rnd()) * cell;
    if (cov(x, z) < 1 - p.coverage || !mask(x, z)) continue;
    const y0 = heightAt(x, z) - 0.002;

    if (p.plantSpecies === 'hairgrass') {
      const blades = 4 + Math.floor(rnd() * 5);
      for (let b = 0; b < blades; b++) {
        const ck = colours[Math.floor(rnd() * 3)], bk = bucket(x, z, ck);
        const bx = x + (rnd() - 0.5) * 0.008, bz = z + (rnd() - 0.5) * 0.008;
        if (!mask(bx, bz)) continue;
        const h = p.bladeHeight * (0.55 + rnd() * 0.6), w = 0.0012 + rnd() * 0.0008;
        const ang = rnd() * Math.PI * 2, lean = 0.15 + rnd() * 0.45;
        const lx = Math.cos(ang), lz = Math.sin(ang), px = -lz, pz = lx;
        const segs = 3, L = [];
        for (let k = 0; k <= segs; k++) {
          const t = k / segs, off = lean * h * t * t * 0.6;
          const cx = bx + lx * off, cz = bz + lz * off, cy = y0 + h * t, ww = w * (1 - t * 0.9);
          const left = clampXZ(cx - px * ww, cz - pz * ww, x, z);
          const right = clampXZ(cx + px * ww, cz + pz * ww, x, z);
          L.push([[left[0], cy, left[1]], [right[0], cy, right[1]], t]);
        }
        for (let k = 0; k < segs; k++) {
          const [a0, a1, ta] = L[k], [b0, b1, tb] = L[k + 1];
          if (k === segs - 1) { const tip = [(b0[0] + b1[0]) / 2, b0[1], (b0[2] + b1[2]) / 2]; tri(bk, a0, a1, tip, ta, ta, tb); }
          else { tri(bk, a0, a1, b1, ta, ta, tb); tri(bk, a0, b1, b0, ta, tb, tb); }
        }
      }
    } else {
      // leaf mound: leaves on a low dome, oriented to the dome normal
      const mono = p.plantSpecies === 'montecarlo';
      const R = (mono ? 0.016 : 0.012) * (0.7 + rnd() * 0.6), hgt = R * (mono ? 0.6 : 0.8);
      const count = mono ? 14 : 24;
      for (let l = 0; l < count; l++) {
        const ck = colours[Math.floor(rnd() * 3)], bk = bucket(x, z, ck);
        const th = rnd() * Math.PI * 2, ph = Math.acos(1 - rnd() * 0.95);
        const nrm = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
        const c = new THREE.Vector3(x + nrm.x * R, y0 + nrm.y * hgt, z + nrm.z * R);
        const centerXZ = clampXZ(c.x, c.z, x, z);
        c.x = centerXZ[0]; c.z = centerXZ[1];
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm);
        const lr = mono ? 0.0042 : 0.0026;
        const sw = 0.25 + nrm.y * 0.25;
        const segs = mono ? 6 : 4;
        const rot = rnd() * 6.28;
        const pts = [];
        for (let s = 0; s < segs; s++) {
          const a = rot + s / segs * Math.PI * 2, rr = mono ? lr : (s % 2 ? lr * 0.55 : lr);
          const pt = new THREE.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr * (mono ? 1 : 0.7)).applyQuaternion(q).add(c);
          const clipped = clampXZ(pt.x, pt.z, x, z);
          pt.x = clipped[0]; pt.z = clipped[1];
          pts.push(pt.toArray());
        }
        const cc = c.toArray();
        for (let s = 0; s < segs; s++) tri(bk, cc, pts[s], pts[(s + 1) % segs], sw, sw, sw);
        // short stem to the substrate
        if (mono && l % 3 === 0) {
          const sb = bucket(x, z, 'stem');
          tri(sb, [c.x - 0.0006, c.y, c.z], [c.x + 0.0006, c.y, c.z], [x, y0, z], sw, sw, 0);
        }
      }
    }
  }

  const list = [];
  for (const [key, t] of tiles) for (const [ck, b] of Object.entries(t)) {
    if (!b.pos.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b.pos), 3));
    geo.setAttribute('aSway', new THREE.BufferAttribute(new Float32Array(b.sw), 1));
    list.push({ g: geo, c: C[ck], n: 'patch_' + key });
  }

  const audit = { vertices: 0, outsideFootprint: 0, maxY: -Infinity };
  for (const part of list) {
    const positions = part.g.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i + 1], z = positions[i + 2];
      audit.vertices++;
      if (!mask(x, z)) audit.outsideFootprint++;
      audit.maxY = Math.max(audit.maxY, y);
    }
  }

  const g = new THREE.Group(); g.name = 'flora-carpet';
  const m = finish(list, mat, 'blades', merge); if (m) g.add(m);
  g.userData = {
    material: mat,
    audit,
    setRig(name, v) { if (name === 'blades') mat.userData.uniforms.uSway.value = v; },
    update(t) { mat.userData.uniforms.uTime.value = t; }
  };
  return g;
}

export default createAsset;
