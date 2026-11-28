/*
 * CORAL SPS (High Detail)
 * Parametric Small-Polyp-Stony corals for three.js: branching Acropora/staghorn (tapered swept
 * tubes), plating Montipora (ruffled spiral whorls from exact polar vertex grids) and encrusting
 * mounds. Fuzzy polyps retract via a shader uniform when startled (userData.startle()).
 *
 * QUICK START
 *   import { createAsset } from './coral-sps.mjs';
 *   const sps = createAsset({ growthForm: 'branching', anchors: stone.userData.peaks });
 *   scene.add(sps); // loop: sps.userData.update(t, dt)
 *
 * PARAMS  growthForm: branching | plating | encrusting ; polypExtension 0-1 (smooth vs fuzzy)
 *         colorway: neon-pink | cyber-cyan | orange | purple | lime | cream ; size, count, glow, seed
 * SPECS  ~2,000-9,000 triangles, 2 materials, ~0.05-0.18 m per colony.
 * PARTS  animate: polyps (retract/extend)
 *        detach: polyps
 * LICENSE MIT - procedural geometry, free for commercial use.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = { skeleton: '#d84a9a', skeletonDark: '#9a2a6a', tip: '#ffd0ea', polyp: '#ffe8f4', base: '#8a6a6a', rim: '#ffffff' };

export const COLORWAYS = {
  'default':    { ...BASE },
  'neon-pink':  { ...BASE },
  'cyber-cyan': { skeleton: '#2ab8d8', skeletonDark: '#1a6a9a', tip: '#c0ffff', polyp: '#e0ffff', base: '#4a6a7a', rim: '#ffffff' },
  'orange':     { skeleton: '#ff7a2a', skeletonDark: '#b04a1a', tip: '#ffe08a', polyp: '#fff0c0', base: '#7a5a4a', rim: '#fff4d0' },
  'purple':     { skeleton: '#8a3ad8', skeletonDark: '#5a1a9a', tip: '#40ffd0', polyp: '#c0fff0', base: '#5a4a6a', rim: '#e0d0ff' },
  'lime':       { skeleton: '#8ad83a', skeletonDark: '#4a8a1a', tip: '#3a7aff', polyp: '#d0ffb0', base: '#6a7a4a', rim: '#f0ffd0' },
  'cream':      { skeleton: '#e8dcc0', skeletonDark: '#b8a888', tip: '#a050ff', polyp: '#fff8e8', base: '#8a7a6a', rim: '#ffffff' }
};

export const presets = COLORWAYS;

export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'One mesh per material or selectable colonies.' },
  colorway:       { type: 'choice', default: 'neon-pink', options: Object.keys(COLORWAYS), label: 'Palette', affects: 'colors', describe: 'Coral pigment.' },
  growthForm:     { type: 'choice', default: 'branching', options: ['branching', 'plating', 'encrusting'], label: 'Growth Form', affects: 'geometry', describe: 'Structure type.' },
  polypExtension: { type: 'range', default: 0.8, min: 0, max: 1, step: 0.05, label: 'Polyp Extension', affects: 'geometry', describe: 'Smooth (0) vs fuzzy (1).' },
  size:           { type: 'range', default: 1, min: 0.5, max: 2, step: 0.05, label: 'Size', affects: 'geometry', describe: 'Colony size.' },
  count:          { type: 'range', default: 3, min: 1, max: 8, step: 1, label: 'Colonies', affects: 'geometry', describe: 'Colonies when no anchors given.' },
  glow:           { type: 'range', default: 0.3, min: 0, max: 1.5, step: 0.05, label: 'Fluorescence', affects: 'colors', describe: 'Emissive glow.' },
  seed:           { type: 'range', default: 31, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Growth seed.' }
};

export const rig = { polyps: { axis: 'scale', range: [0, 1], describe: 'Polyps retract when startled.' } };
export const detach = ['polyps'];
export const night = { polyps: { color: '#ff5ac8', intensity: 0.5, distance: 0.3, describe: 'Fluorescent tips.' } };

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

function coralMat(glow, polyp) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6, metalness: 0.0, side: THREE.DoubleSide });
  const u = { uTime: { value: 0 }, uGlow: { value: glow }, uExt: { value: 1 } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    if (polyp) {
      sh.vertexShader = 'uniform float uTime; uniform float uExt; attribute vec3 aRoot;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 rel = transformed - aRoot;
        float wav = 1.0 + 0.12 * sin(uTime * 2.0 + aRoot.x * 200.0 + aRoot.y * 150.0);
        transformed = aRoot + rel * max(0.02, uExt) * wav;`);
    }
    sh.fragmentShader = 'uniform float uGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * uGlow;');
  };
  mat.customProgramCacheKey = () => 'coral-sps-' + (polyp ? 'p' : 's');
  mat.userData.uniforms = u;
  return mat;
}
const MAT = coralMat(0.2, false);

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

function addTaper(list, pts, r0, r1, hex, radial = 6, segs = 8) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const c = curve.getPointAt(i / segs), r = r0 + (r1 - r0) * (i / segs);
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c); pos.setXYZ(k, v.x, v.y, v.z); }
  }
  list.push({ g: geo, c: hex, n: 'branch' });
  return curve;
}

function polypAt(list, root, nrm, len, hex) {
  const geo = new THREE.ConeGeometry(len * 0.28, len, 4, 1).translate(0, len / 2, 0).toNonIndexed();
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm));
  geo.translate(root.x, root.y, root.z);
  const n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = root.x; a[i * 3 + 1] = root.y; a[i * 3 + 2] = root.z; }
  geo.setAttribute('aRoot', new THREE.BufferAttribute(a, 3));
  list.push({ g: geo, c: hex, n: 'polyp' });
}

export function createAsset(userParams = {}) {
  const p = {};
  for (const k of Object.keys(params)) p[k] = params[k].default;
  Object.assign(p, userParams);
  const C = zonesFor(p.colorway, userParams);
  const merge = !!p.mergeForProduction;
  const rnd = rng(p.seed);
  const heightAt = typeof userParams.heightAt === 'function' ? userParams.heightAt : () => 0;
  const S = p.size;
  const skMat = coralMat(p.glow * 0.5, false), poMat = coralMat(p.glow, true);
  let anchors = Array.isArray(userParams.anchors) && userParams.anchors.length ? userParams.anchors : null;
  if (!anchors) { anchors = []; for (let i = 0; i < p.count; i++) { const x = (rnd() - 0.5) * 0.3, z = (rnd() - 0.5) * 0.2; anchors.push([x, heightAt(x, z), z]); } }

  const sk = [], po = [];
  const polypDensity = 0.35 + p.polypExtension * 0.65;
  anchors.forEach(([ax, ay, az]) => {
    const s = S * (0.7 + rnd() * 0.6);
    if (p.growthForm === 'branching') {
      sk.push({ g: new THREE.SphereGeometry(0.014 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.3, 0.6, 1.3).translate(ax, ay - 0.002, az), c: C.base, n: 'basePlate' });
      const grow = (start, dir, len, r, depth) => {
        const pts = [start.clone()]; let q = start.clone(); const d = dir.clone();
        for (let k = 1; k <= 3; k++) { d.add(new THREE.Vector3((rnd() - 0.5) * 0.3, 0.12, (rnd() - 0.5) * 0.3)).normalize(); q = q.clone().addScaledVector(d, len / 3); pts.push(q); }
        const r1 = depth ? r * 0.7 : r * 0.55;
        const curve = addTaper(sk, pts, r, r1, depth ? C.skeleton : C.skeletonDark, 6, 6);
        // growing tip (axial corallite)
        const tip = curve.getPointAt(1), tn = curve.getTangentAt(1);
        sk.push({ g: new THREE.CylinderGeometry(r1 * 0.6, r1, r1 * 3, 6).translate(0, r1 * 1.5, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tn)).translate(tip.x, tip.y, tip.z), c: C.tip, n: 'axialTip' });
        // radial polyps along the branch
        const np = Math.round(len / 0.004 * polypDensity);
        for (let k = 0; k < np; k++) {
          const t = 0.1 + rnd() * 0.85, c = curve.getPointAt(t), tg = curve.getTangentAt(t);
          const side = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).cross(tg).normalize();
          const rr = r + (r1 - r) * t;
          polypAt(po, c.clone().addScaledVector(side, rr), side.clone().addScaledVector(tg, 0.6).normalize(), 0.0035 * s, t > 0.8 ? C.tip : C.polyp);
        }
        if (depth > 0) { const kids = 2 + (rnd() > 0.5 ? 1 : 0); for (let k = 0; k < kids; k++) { const a = curve.getPointAt(0.5 + rnd() * 0.4); const nd = d.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.6, 0.3, (rnd() - 0.5) * 1.6)).normalize(); grow(a, nd, len * 0.7, r1 * 0.9, depth - 1); } }
      };
      const trunks = 3 + Math.floor(rnd() * 3);
      for (let k = 0; k < trunks; k++) { const a = rnd() * Math.PI * 2; grow(new THREE.Vector3(ax, ay, az), new THREE.Vector3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5).normalize(), 0.05 * s, 0.0045 * s, 2); }
    } else if (p.growthForm === 'plating') {
      // ruffled spiral whorl plates built on an exact polar vertex grid (shared ring vertices)
      const plates = 2 + Math.floor(rnd() * 3);
      for (let pl = 0; pl < plates; pl++) {
        const R = (0.04 + rnd() * 0.035) * s, y = ay + pl * 0.012 * s, cx = ax + (rnd() - 0.5) * 0.02 * s, cz = az + (rnd() - 0.5) * 0.02 * s;
        const NR = 6, NT = 28, th0 = rnd() * 6.28, tilt = 0.15 + rnd() * 0.2, sweep = Math.PI * (1.2 + rnd() * 0.8);
        const P = (i, j, off) => { const r = R * (0.12 + 0.88 * i / NR), a = th0 + sweep * j / NT; return [cx + Math.cos(a) * r, y + r * tilt + Math.sin(a * 5 + pl) * 0.004 * s * (i / NR) ** 2 + off, cz + Math.sin(a) * r]; };
        const arrTop = [], arrBot = [], arrRim = [];
        for (let i = 0; i < NR; i++) for (let j = 0; j < NT; j++) {
          const a = P(i, j, 0), b = P(i + 1, j, 0), c = P(i + 1, j + 1, 0), d = P(i, j + 1, 0);
          const tk = 0.0025 * s;
          const a2 = P(i, j, -tk), b2 = P(i + 1, j, -tk), c2 = P(i + 1, j + 1, -tk), d2 = P(i, j + 1, -tk);
          arrTop.push(...a, ...b, ...c, ...a, ...c, ...d);
          arrBot.push(...a2, ...c2, ...b2, ...a2, ...d2, ...c2);
          if (i === NR - 1) arrRim.push(...b, ...b2, ...c2, ...b, ...c2, ...c);
          if (rnd() < 0.35 * polypDensity) { const cen = P(i + 0.5, j + 0.5, 0); polypAt(po, new THREE.Vector3(...cen), new THREE.Vector3(0, 1, 0), 0.0025 * s, i > NR - 2 ? C.tip : C.polyp); }
        }
        [[arrTop, C.skeleton, 'plateTop'], [arrBot, C.skeletonDark, 'plateUnder'], [arrRim, C.rim, 'growthRim']].forEach(([a, c, n]) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(a), 3)); sk.push({ g: geo, c, n }); });
      }
      sk.push({ g: new THREE.CylinderGeometry(0.006 * s, 0.012 * s, 0.015 * s, 8).translate(ax, ay + 0.006 * s, az), c: C.base, n: 'stalk' });
    } else {
      // ENCRUSTING: low lumpy mound hugging the anchor, with polyp-covered bumps
      const R = 0.035 * s;
      const geo = new THREE.SphereGeometry(R, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      const pos = geo.attributes.position, v = new THREE.Vector3();
      const ph = rnd() * 6;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const a = Math.atan2(v.z, v.x); const bump = 1 + 0.15 * Math.sin(a * 5 + ph) * Math.sin(v.y * 90); pos.setXYZ(i, v.x * bump * 1.2, v.y * 0.45 * bump, v.z * bump); }
      geo.translate(ax, ay - 0.003, az);
      sk.push({ g: geo, c: C.skeleton, n: 'mound' });
      const nb = 9;
      for (let k = 0; k < nb; k++) {
        const a = rnd() * 6.28, r = Math.sqrt(rnd()) * R;
        const y = ay - 0.003 + Math.sqrt(Math.max(0, 1 - (r / R) ** 2)) * R * 0.45;
        sk.push({ g: new THREE.SphereGeometry(0.006 * s, 8, 5).scale(1, 0.6, 1).translate(ax + Math.cos(a) * r * 1.2, y, az + Math.sin(a) * r), c: k % 2 ? C.skeletonDark : C.tip, n: 'nodule' });
      }
      const np = Math.round(160 * polypDensity * s);
      for (let k = 0; k < np; k++) {
        const th = rnd() * 6.28, ph2 = rnd() * Math.PI / 2.2;
        const n = new THREE.Vector3(Math.cos(th) * Math.sin(ph2), Math.cos(ph2), Math.sin(th) * Math.sin(ph2));
        const root = new THREE.Vector3(ax + n.x * R * 1.2, ay - 0.003 + n.y * R * 0.45, az + n.z * R);
        polypAt(po, root, n, 0.003 * s, k % 5 ? C.polyp : C.tip);
      }
    }
  });

  const g = new THREE.Group(); g.name = 'coral-sps';
  const m1 = finish(sk, skMat, 'skeleton', merge); if (m1) g.add(m1);
  const pg = new THREE.Group(); pg.name = 'polyps';
  const m2 = finish(po, poMat, 'polyps', merge); if (m2) pg.add(m2);
  g.add(pg);
  let ext = p.polypExtension, target = p.polypExtension, recover = 0;
  poMat.userData.uniforms.uExt.value = ext;
  g.userData = {
    anchors,
    startle() { target = 0.05; recover = 2.5 + Math.random() * 2; },
    setRig(name, v) { if (name === 'polyps') { target = v; ext = v; } },
    setGlow(v) { poMat.userData.uniforms.uGlow.value = v; skMat.userData.uniforms.uGlow.value = v * 0.5; },
    update(t, dt = 0.016) {
      if (recover > 0) { recover -= dt; if (recover <= 0) target = p.polypExtension; }
      ext += (target - ext) * Math.min(1, dt * (target < ext ? 8 : 0.8));
      poMat.userData.uniforms.uExt.value = ext;
      poMat.userData.uniforms.uTime.value = t;
    }
  };
  return g;
}

export default createAsset;
