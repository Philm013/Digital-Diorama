/*
 * DECOR ARTIFACTS (High Detail)
 * Parametric aquarium ornaments for three.js: Zen Pagoda (hollow tiers with genuine door/window
 * openings & upturned lathe eaves), Shipwreck (lofted hull with a breach exposing ribs, broken deck
 * and mast), Classical Ruins (fluted columns, capital, fallen drums), Skull, Buddha Head and a glowing
 * Cyber Monolith. Decay layers (algae / coral encrusting) and a rigged hidden treasure chest whose lid
 * pops open to release an air bubble.
 *
 * QUICK START
 *   import { createAsset } from './decor-artifacts.mjs';
 *   const deco = createAsset({ artifactType: 'shipwreck', decayLevel: 'algae', hiddenChest: true });
 *   scene.add(deco); // loop: deco.userData.update(t, dt)
 *
 * PARAMS  artifactType: pagoda | shipwreck | ruins | skull | buddha | monolith
 *         decayLevel: pristine | algae | coral ; hiddenChest toggle ; size 0.5-1.6 ; colorway ; seed
 * SPECS  ~1,500-6,000 triangles, 3 materials, ~0.1-0.32 m footprint.
 * PARTS  animate: hiddenChest (lid x 0..-75deg), chestBubble (rise)
 *        detach: hiddenChest, decay
 * LICENSE MIT - procedural geometry, free for commercial use.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = { stone: '#9a9488', stoneDark: '#6a645a', wood: '#5a3e28', woodDark: '#33231a', metal: '#5a5248', gold: '#e8b830', algae: '#4a7a2a', coral: '#ff6a8a', coral2: '#ffb03a', glow: '#30f0ff', hollow: '#1a1612' };

export const COLORWAYS = {
  'default': { ...BASE },
  'ancient': { stone: '#b0a690', stoneDark: '#7a705c', wood: '#4a3420', woodDark: '#2a1c10', metal: '#6a5a40', gold: '#e8c040', algae: '#3a6a28', coral: '#ff7a9a', coral2: '#ffc04a', glow: '#ffd070', hollow: '#14100c' },
  'bronze':  { stone: '#7a5a30', stoneDark: '#4a3418', wood: '#5a3e28', woodDark: '#33231a', metal: '#3a8a6a', gold: '#f0c040', algae: '#3a6a2a', coral: '#ff6aa8', coral2: '#ffa03a', glow: '#ffb050', hollow: '#120c08' },
  'zen':     { stone: '#8a8e90', stoneDark: '#5a5e62', wood: '#8a2a1a', woodDark: '#4a1610', metal: '#2a2a2a', gold: '#d8b040', algae: '#4a8a3a', coral: '#ff8aa8', coral2: '#ffd06a', glow: '#fff0c0', hollow: '#101010' },
  'neon':    { stone: '#1c1c26', stoneDark: '#0e0e14', wood: '#2a2a3a', woodDark: '#14141e', metal: '#c8ccd8', gold: '#ffe040', algae: '#a040ff', coral: '#ff40c8', coral2: '#30f0ff', glow: '#30f0ff', hollow: '#050508' }
};

export const presets = COLORWAYS;

export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'Merge per material or keep selectable parts.' },
  colorway:     { type: 'choice', default: 'auto', options: ['auto', ...Object.keys(COLORWAYS)], label: 'Palette', affects: 'colors', describe: 'auto follows artifactType.' },
  artifactType: { type: 'choice', default: 'pagoda', options: ['pagoda', 'shipwreck', 'ruins', 'skull', 'buddha', 'monolith'], label: 'Artifact', affects: 'geometry', describe: 'Ornament type.' },
  decayLevel:   { type: 'choice', default: 'algae', options: ['pristine', 'algae', 'coral'], label: 'Decay', affects: 'geometry', describe: 'Pristine, algae-covered, coral-encrusted.' },
  hiddenChest:  { type: 'toggle', default: true, label: 'Hidden Chest', affects: 'geometry', describe: 'Treasure chest with popping lid.' },
  size:         { type: 'range', default: 1, min: 0.5, max: 1.6, step: 0.05, label: 'Size', affects: 'geometry', describe: 'Artifact scale (rebuilt).' },
  chestInterval:{ type: 'range', default: 9, min: 3, max: 30, step: 1, label: 'Chest Interval', affects: 'geometry', describe: 'Seconds between lid pops.' },
  seed:         { type: 'range', default: 13, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Decay seed.' }
};

export const rig = { hiddenChest: { axis: 'x', range: [0, -75], describe: 'Chest lid pops open and releases a bubble.' } };
export const detach = ['hiddenChest', 'decay'];
export const night = { glow: { color: '#30f0ff', intensity: 1.0, distance: 0.4, describe: 'Monolith neon strips / lanterns.' } };

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

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide });
const METAL_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.3, metalness: 0.85, side: THREE.DoubleSide });
const GLOW_MAT = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

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

// Wall panel with a genuine opening, built from up to 4 convex boxes (jambs, sill, header).
// Local: wall runs along X (length len), thickness along Z, base at y=0. Returns geometries.
function wallWithOpening(len, h, t, ow, oh, sill, hex, list, mtx) {
  const parts = [];
  const side = (len - ow) / 2;
  if (side > 1e-4) { parts.push(box(side, h, t, -len / 2 + side / 2, h / 2, 0)); parts.push(box(side, h, t, len / 2 - side / 2, h / 2, 0)); }
  if (sill > 1e-4) parts.push(box(ow, sill, t, 0, sill / 2, 0));
  const top = h - (sill + oh);
  if (top > 1e-4) parts.push(box(ow, top, t, 0, h - top / 2, 0));
  parts.forEach(g => { g.applyMatrix4(mtx); list.push({ g, c: hex, n: 'wallPanel' }); });
}

export function createAsset(userParams = {}) {
  const p = {};
  for (const k of Object.keys(params)) p[k] = params[k].default;
  Object.assign(p, userParams);
  const autoCw = { pagoda: 'zen', shipwreck: 'default', ruins: 'ancient', skull: 'ancient', buddha: 'bronze', monolith: 'neon' }[p.artifactType];
  const C = zonesFor(p.colorway === 'auto' ? autoCw : p.colorway, userParams);
  const merge = !!p.mergeForProduction;
  const rnd = rng(p.seed);
  const S = p.size;

  const g = new THREE.Group(); g.name = 'decor-artifacts';
  const solid = [], metal = [], glow = [], decay = [];
  const tops = []; // decay anchor points [x,y,z,r]
  let chestPos = [0.07 * S, 0, 0.05 * S];

  if (p.artifactType === 'pagoda') {
    const tiers = 3, t = 0.004 * S;
    let y = 0;
    solid.push({ g: box(0.11 * S, 0.012 * S, 0.11 * S, 0, 0.006 * S, 0), c: C.stoneDark, n: 'plinth' });
    solid.push({ g: box(0.095 * S, 0.008 * S, 0.095 * S, 0, 0.016 * S, 0), c: C.stone, n: 'step' });
    y = 0.02 * S;
    for (let i = 0; i < tiers; i++) {
      const w = 0.075 * S * (1 - i * 0.2), h = 0.038 * S * (1 - i * 0.12);
      solid.push({ g: box(w, t, w, 0, y + t / 2, 0), c: C.woodDark, n: 'floor' });
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => addCylinder(solid, 0.0035 * S, 0.0035 * S, h, 8, sx * (w / 2 - 0.003 * S), y + h / 2, sz * (w / 2 - 0.003 * S), 0, 0, 0, C.wood));
      const inner = w - 0.012 * S;
      // front wall: door opening; sides & back: window openings
      for (let k = 0; k < 4; k++) {
        const mtx = new THREE.Matrix4().makeRotationY(k * Math.PI / 2).multiply(new THREE.Matrix4().makeTranslation(0, y + t, w / 2 - t));
        if (k === 0) wallWithOpening(inner, h - t, t, inner * 0.38, h * 0.7, 0, C.wood, solid, mtx);
        else wallWithOpening(inner, h - t, t, inner * 0.32, h * 0.32, h * 0.32, C.wood, solid, mtx);
      }
      // interior lantern glow
      glow.push({ g: new THREE.SphereGeometry(0.006 * S, 8, 6).translate(0, y + h * 0.45, 0), c: C.glow, n: 'lantern' });
      // upturned eaves: 4-sided lathe rotated 45deg so it squares with the walls
      const R = w * 0.95, prof = [];
      for (let k = 0; k <= 8; k++) { const u = k / 8; prof.push(new THREE.Vector2(R * (1 - u) + 0.0001, h * 0.55 * Math.pow(u, 0.6) - (1 - u) * (1 - u) * -0.006 * S)); }
      prof.unshift(new THREE.Vector2(R * 1.02, -0.002 * S));
      const roof = new THREE.LatheGeometry(prof, 4).rotateY(Math.PI / 4).translate(0, y + h, 0);
      solid.push({ g: roof, c: C.stoneDark, n: 'eaves' });
      solid.push({ g: new THREE.LatheGeometry([new THREE.Vector2(0.0001, 0), new THREE.Vector2(R * 1.02, 0), new THREE.Vector2(R * 1.02, -0.002 * S), new THREE.Vector2(0.0001, -0.002 * S)], 4).rotateY(Math.PI / 4).translate(0, y + h, 0), c: C.woodDark, n: 'soffit' });
      tops.push([R * 0.6, y + h + 0.004 * S, R * 0.3, 0.008 * S], [-R * 0.5, y + h + 0.006 * S, -R * 0.4, 0.008 * S]);
      y += h + h * 0.3;
    }
    const spire = [new THREE.Vector2(0.006 * S, 0)];
    for (let k = 0; k < 6; k++) spire.push(new THREE.Vector2(0.006 * S * (1 - k / 7), k * 0.005 * S + 0.002 * S), new THREE.Vector2(0.004 * S * (1 - k / 7), k * 0.005 * S + 0.004 * S));
    spire.push(new THREE.Vector2(0.0001, 0.04 * S));
    metal.push({ g: new THREE.LatheGeometry(spire, 10).translate(0, y - 0.01 * S, 0), c: C.gold, n: 'sorin' });
    chestPos = [0.085 * S, 0, 0.04 * S];
  } else if (p.artifactType === 'shipwreck') {
    const L = 0.3 * S, B = 0.055 * S, Dp = 0.05 * S, NS = 18, NT = 10;
    const beam = (u) => B * Math.pow(Math.max(0, 1 - Math.pow(Math.max(0, u), 2.4)), 0.5) * (u < -0.85 ? 0.9 : 1);
    const P = (i, j) => { const u = -1 + 2 * i / NS, th = -Math.PI / 2 + Math.PI * j / NT; const b = Math.max(0.002 * S, beam(u)); const d = Dp * (1 - 0.25 * u * u); return [u * L / 2, -d * Math.cos(th) * (1 - 0.1 * Math.abs(Math.sin(th))) + d, b * Math.sin(th)]; };
    const breach = (i, j) => i >= 6 && i <= 10 && j >= 6 && j <= 9;
    const hullA = [], hullB = [];
    for (let i = 0; i < NS; i++) for (let j = 0; j < NT; j++) {
      if (breach(i, j)) continue;
      const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
      (j % 2 ? hullA : hullB).push(...a, ...b, ...c, ...a, ...c, ...d);
    }
    [[hullA, C.wood], [hullB, C.woodDark]].forEach(([a, c]) => { const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(a), 3)); solid.push({ g: bg, c, n: 'hullPlanks' }); });
    // transom (flat stern) + exposed ribs in the breach
    const tr = []; for (let j = 0; j < NT; j++) { const a = P(0, j), b = P(0, j + 1); tr.push(a[0], Dp * 0.75, 0, ...a, ...b); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tr), 3)); solid.push({ g: tg, c: C.woodDark, n: 'transom' });
    for (let i = 5; i <= 11; i++) { const pts = []; for (let j = 0; j <= NT; j++) pts.push(new THREE.Vector3(...P(i, j)).multiplyScalar(0.97)); solid.push({ g: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.0025 * S, 4, false), c: C.woodDark, n: 'rib' }); }
    // keel + broken deck planks
    const kpts = []; for (let i = 0; i <= NS; i++) kpts.push(new THREE.Vector3(...P(i, NT / 2)).add(new THREE.Vector3(0, -0.003 * S, 0)));
    solid.push({ g: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(kpts), 24, 0.004 * S, 4, false), c: C.woodDark, n: 'keel' });
    const deckY = Dp * 0.95;
    for (let k = 0; k < 7; k++) { const z = -B * 0.8 + k * B * 0.27; const l0 = -L * 0.42, l1 = L * (0.38 - (k % 3) * 0.12); if (k === 4) continue; const wd = Math.min(beam(l0 / (L / 2)), beam(l1 / (L / 2))); if (Math.abs(z) > wd) continue; solid.push({ g: box(l1 - l0, 0.003 * S, B * 0.22, (l0 + l1) / 2, deckY, z), c: k % 2 ? C.wood : C.woodDark, n: 'deckPlank' }); }
    // broken mast + yard + cannon
    addCylinder(solid, 0.005 * S, 0.007 * S, 0.12 * S, 8, -L * 0.05, deckY + 0.055 * S, 0, 0.25, 0, -0.2, C.woodDark);
    addCylinder(solid, 0.003 * S, 0.003 * S, 0.09 * S, 6, L * 0.12, deckY + 0.01 * S, B * 0.6, Math.PI / 2, 0.7, 0, C.wood);
    addCylinder(metal, 0.006 * S, 0.008 * S, 0.05 * S, 10, L * 0.1, deckY + 0.008 * S, -B * 0.4, 0, 0, Math.PI / 2 - 0.1, C.metal);
    for (let k = 0; k < 4; k++) metal.push({ g: new THREE.TorusGeometry(0.0035 * S, 0.0012 * S, 5, 10).rotateY(Math.PI / 2).translate(L * (-0.3 + k * 0.15), Dp * 0.6, B * 0.98), c: C.metal, n: 'porthole' });
    for (let k = 0; k < 6; k++) tops.push([L * (-0.35 + k * 0.13), deckY + 0.004 * S, (rnd() - 0.5) * B, 0.01 * S]);
    // tilt and sink the hull into the sand
    const tilt = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.28, 0.15, 0.12)).premultiply(new THREE.Matrix4().makeTranslation(0, -0.022 * S, 0));
    [solid, metal].forEach(list => list.forEach(q => q.g.applyMatrix4(tilt)));
    tops.forEach(tp => { const v = new THREE.Vector3(tp[0], tp[1], tp[2]).applyMatrix4(tilt); tp[0] = v.x; tp[1] = v.y; tp[2] = v.z; });
    chestPos = [L * 0.45, 0, B * 1.4];
  } else if (p.artifactType === 'ruins') {
    solid.push({ g: box(0.2 * S, 0.012 * S, 0.1 * S, 0, 0.004 * S, 0), c: C.stoneDark, n: 'stylobate' });
    solid.push({ g: box(0.18 * S, 0.01 * S, 0.085 * S, 0, 0.014 * S, 0), c: C.stone, n: 'stylobateStep' });
    const fluted = (r, h, x, z, broken) => {
      const geo = new THREE.CylinderGeometry(r, r * 1.05, h, 24, 6);
      const pos = geo.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const a = Math.atan2(v.z, v.x), k = 1 - 0.06 * Math.max(0, Math.cos(a * 12)); let y = v.y; if (broken && y > h / 2 - 1e-4) y -= rnd() * 0.02 * S; pos.setXYZ(i, v.x * k, y, v.z * k); }
      geo.translate(x, 0.019 * S + h / 2, z);
      solid.push({ g: geo, c: C.stone, n: 'flutedColumn' });
      solid.push({ g: new THREE.LatheGeometry([new THREE.Vector2(r * 1.35, 0), new THREE.Vector2(r * 1.35, 0.004 * S), new THREE.Vector2(r * 1.15, 0.008 * S), new THREE.Vector2(r * 1.05, 0.01 * S), new THREE.Vector2(0.0001, 0.01 * S)], 16).translate(x, 0.019 * S, z), c: C.stoneDark, n: 'base' });
      tops.push([x, 0.019 * S + h, z, r]);
    };
    fluted(0.013 * S, 0.17 * S, -0.06 * S, -0.015 * S, false);
    fluted(0.013 * S, 0.11 * S, 0.0, -0.02 * S, true);
    fluted(0.013 * S, 0.06 * S, 0.06 * S, -0.015 * S, true);
    const cy = 0.019 * S + 0.17 * S;
    solid.push({ g: new THREE.LatheGeometry([new THREE.Vector2(0.012 * S, 0), new THREE.Vector2(0.019 * S, 0.006 * S), new THREE.Vector2(0.02 * S, 0.01 * S), new THREE.Vector2(0.0001, 0.01 * S)], 16).translate(-0.06 * S, cy, -0.015 * S), c: C.stone, n: 'echinus' });
    solid.push({ g: box(0.045 * S, 0.008 * S, 0.045 * S, -0.06 * S, cy + 0.014 * S, -0.015 * S), c: C.stoneDark, n: 'abacus' });
    solid.push({ g: box(0.09 * S, 0.018 * S, 0.03 * S, -0.03 * S, 0.03 * S, 0.045 * S).rotateY(0.3).translate(0.02 * S, 0, 0), c: C.stone, n: 'fallenArchitrave' });
    [[0.05, 0.035], [0.085, 0.05]].forEach(([x, z]) => { const geo = new THREE.CylinderGeometry(0.013 * S, 0.013 * S, 0.03 * S, 20); geo.rotateZ(Math.PI / 2).rotateY(0.6 + rnd()).translate(x * S, 0.013 * S, z * S); solid.push({ g: geo, c: C.stone, n: 'fallenDrum' }); });
    chestPos = [0.11 * S, 0, 0.06 * S];
  } else if (p.artifactType === 'skull') {
    const R = 0.045 * S;
    const cr = new THREE.SphereGeometry(R, 20, 14); cr.scale(1.15, 0.95, 0.9).translate(0, R * 0.95, 0);
    solid.push({ g: cr, c: C.stone, n: 'cranium' });
    solid.push({ g: new THREE.SphereGeometry(R * 0.7, 14, 10).scale(1, 0.9, 0.95).translate(R * 0.55, R * 0.55, 0), c: C.stone, n: 'face' });
    [-1, 1].forEach(s => { solid.push({ g: new THREE.SphereGeometry(R * 0.22, 10, 8).scale(0.6, 1, 1).translate(R * 1.08, R * 0.8, s * R * 0.32), c: C.hollow, n: 'eyeSocket' }); solid.push({ g: new THREE.SphereGeometry(R * 0.18, 8, 6).scale(1.2, 0.6, 0.8).translate(R * 0.95, R * 0.45, s * R * 0.55), c: C.stoneDark, n: 'cheekbone' }); });
    solid.push({ g: new THREE.ConeGeometry(R * 0.1, R * 0.22, 3).rotateZ(Math.PI).translate(R * 1.2, R * 0.48, 0), c: C.hollow, n: 'nasal' });
    for (let k = 0; k < 8; k++) { const a = -0.6 + k * 0.17; solid.push({ g: box(R * 0.06, R * 0.11, R * 0.07, R * 1.08 * Math.cos(a) * 0.95, R * 0.24, R * 0.7 * Math.sin(a)).rotateY(0), c: C.stoneDark, n: 'tooth' }); }
    solid.push({ g: new THREE.TorusGeometry(R * 0.6, R * 0.12, 6, 14, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI / 2).translate(R * 0.55, R * 0.12, 0), c: C.stone, n: 'jaw' });
    tops.push([0, R * 1.85, 0, R * 0.3], [-R * 0.4, R * 1.7, R * 0.3, R * 0.25]);
    const sink = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.2, -0.5, 0.15)).premultiply(new THREE.Matrix4().makeTranslation(0, -0.012 * S, 0));
    solid.forEach(q => q.g.applyMatrix4(sink));
    tops.forEach(tp => { const v = new THREE.Vector3(tp[0], tp[1], tp[2]).applyMatrix4(sink); tp[0] = v.x; tp[1] = v.y; tp[2] = v.z; });
  } else if (p.artifactType === 'buddha') {
    const R = 0.05 * S, list = [];
    list.push({ g: new THREE.SphereGeometry(R, 20, 16).scale(0.92, 1.12, 0.95).translate(0, R * 1.05, 0), c: C.stone, n: 'head' });
    list.push({ g: new THREE.SphereGeometry(R * 0.38, 12, 8).translate(0, R * 2.15, -R * 0.05), c: C.stoneDark, n: 'ushnisha' });
    for (let k = 0; k < 70; k++) { const th = rnd() * Math.PI * 2, ph = Math.acos(1 - rnd() * 0.9); const v = new THREE.Vector3(Math.sin(ph) * Math.cos(th) * 0.92, Math.cos(ph) * 1.12, Math.sin(ph) * Math.sin(th) * 0.95).multiplyScalar(R); if (v.x > R * 0.45 && v.y < R * 0.95) continue; list.push({ g: new THREE.SphereGeometry(R * 0.075, 5, 4).translate(v.x, v.y + R * 1.05, v.z), c: C.stoneDark, n: 'curl' }); }
    [-1, 1].forEach(s => { list.push({ g: new THREE.CapsuleGeometry(R * 0.12, R * 0.65, 3, 6).scale(0.5, 1, 1).translate(0, R * 0.8, s * R * 0.98), c: C.stone, n: 'ear' }); list.push({ g: new THREE.TorusGeometry(R * 0.13, R * 0.02, 4, 10, Math.PI).rotateZ(Math.PI).rotateY(Math.PI / 2).translate(R * 0.86, R * 1.2, s * R * 0.3), c: C.stoneDark, n: 'closedEye' }); });
    list.push({ g: new THREE.ConeGeometry(R * 0.11, R * 0.32, 5).rotateZ(-Math.PI / 2 + 0.3).translate(R * 0.95, R * 1.0, 0), c: C.stone, n: 'nose' });
    list.push({ g: new THREE.SphereGeometry(R * 0.16, 8, 6).scale(0.5, 0.4, 1).translate(R * 0.88, R * 0.62, 0), c: C.stoneDark, n: 'lips' });
    list.push({ g: new THREE.CylinderGeometry(R * 0.5, R * 0.62, R * 0.5, 16).translate(0, R * 0.05, 0), c: C.stone, n: 'neck' });
    metal.push({ g: new THREE.SphereGeometry(R * 0.05, 6, 5).translate(R * 0.9, R * 1.42, 0), c: C.gold, n: 'urna' });
    const tilt = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.3, 0.4, -0.2)).premultiply(new THREE.Matrix4().makeTranslation(0, -0.02 * S, 0));
    list.forEach(q => { q.g.applyMatrix4(tilt); solid.push(q); }); metal.forEach(q => q.g.applyMatrix4(tilt));
    [[0, R * 2.2, 0], [-R * 0.3, R * 1.9, R * 0.4], [R * 0.2, R * 2.0, -R * 0.5]].forEach(v0 => { const v = new THREE.Vector3(...v0).applyMatrix4(tilt); tops.push([v.x, v.y, v.z, R * 0.25]); });
    chestPos = [0.08 * S, 0, 0.05 * S];
  } else {
    // CYBER MONOLITH: tapered obelisk with neon inlays and hovering halo rings
    const h = 0.22 * S, w = 0.035 * S;
    solid.push({ g: new THREE.CylinderGeometry(w * 0.55, w, h, 4, 1).rotateY(Math.PI / 4).translate(0, h / 2, 0), c: C.stone, n: 'obelisk' });
    solid.push({ g: new THREE.ConeGeometry(w * 0.55 * 1.414 / 1.414, 0.03 * S, 4).rotateY(Math.PI / 4).translate(0, h + 0.015 * S, 0), c: C.stoneDark, n: 'pyramidion' });
    solid.push({ g: box(w * 2.4, 0.012 * S, w * 2.4, 0, 0.006 * S, 0), c: C.stoneDark, n: 'base' });
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; for (let j = 0; j < 5; j++) { const y = 0.02 * S + j * h * 0.18, ww = w * (1 - (y / h) * 0.45); glow.push({ g: box(ww * 0.7, 0.003 * S, 0.0015 * S).translate(0, y, ww / 2 + 0.0002).applyMatrix4(new THREE.Matrix4().makeRotationY(a)), c: j % 2 ? C.glow : C.coral, n: 'neonInlay' }); } glow.push({ g: box(0.002 * S, h * 0.8, 0.0015 * S).translate(0, h * 0.42, w * 0.78 / 2 + 0.0008).applyMatrix4(new THREE.Matrix4().makeRotationY(a)), c: C.glow, n: 'neonSpine' }); }
    [0.3, 0.55, 0.8].forEach((f, i) => glow.push({ g: new THREE.TorusGeometry(w * (1.6 - i * 0.3), 0.0015 * S, 4, 32).rotateX(Math.PI / 2 + 0.2 * (i - 1)).translate(0, h * f, 0), c: i % 2 ? C.coral : C.glow, n: 'haloRing' }));
    tops.push([w * 0.6, 0.012 * S, w * 0.6, 0.008 * S]);
    chestPos = [0.07 * S, 0, 0.04 * S];
  }

  // ---------- decay layer ----------
  const dg = new THREE.Group(); dg.name = 'decay';
  if (p.decayLevel !== 'pristine') {
    tops.forEach(([x, y, z, r]) => {
      const n = p.decayLevel === 'coral' ? 4 : 3;
      for (let k = 0; k < n; k++) {
        const ox = x + (rnd() - 0.5) * r * 2, oz = z + (rnd() - 0.5) * r * 2;
        if (p.decayLevel === 'algae') decay.push({ g: new THREE.IcosahedronGeometry(r * (0.5 + rnd() * 0.6), 1).scale(1.3, 0.45, 1.3).translate(ox, y, oz), c: C.algae, n: 'algaeTuft' });
        else if (rnd() > 0.5) { const geo = new THREE.CylinderGeometry(r * 0.12, r * 0.22, r * (0.8 + rnd()), 6).translate(0, r * 0.5, 0).rotateZ((rnd() - 0.5) * 0.8).translate(ox, y, oz); decay.push({ g: geo, c: rnd() > 0.5 ? C.coral : C.coral2, n: 'coralFinger' }); }
        else decay.push({ g: new THREE.SphereGeometry(r * (0.3 + rnd() * 0.3), 8, 6).scale(1, 0.7, 1).translate(ox, y, oz), c: rnd() > 0.5 ? C.coral2 : C.algae, n: 'coralKnob' });
      }
    });
  }
  const dm = finish(decay, MAT, 'decayLayer', merge); if (dm) dg.add(dm);

  // ---------- hidden chest ----------
  const chest = new THREE.Group(); chest.name = 'hiddenChest';
  const lidPivot = new THREE.Group(); lidPivot.name = 'chestLid';
  const bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(0.008 * S, 2), new THREE.MeshStandardMaterial({ color: 0xeefaff, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.55, envMapIntensity: 2 }));
  bubble.name = 'chestBubble'; bubble.visible = false;
  if (p.hiddenChest) {
    const cw = 0.04 * S, ch = 0.022 * S, cd = 0.026 * S, t = 0.0025 * S, cp = [], cm = [];
    cp.push({ g: box(cw, t, cd, 0, t / 2, 0), c: C.woodDark, n: 'chestFloor' });
    cp.push({ g: box(cw, ch, t, 0, ch / 2, cd / 2 - t / 2), c: C.wood, n: 'chestFront' });
    cp.push({ g: box(cw, ch, t, 0, ch / 2, -cd / 2 + t / 2), c: C.wood, n: 'chestBack' });
    cp.push({ g: box(t, ch, cd, -cw / 2 + t / 2, ch / 2, 0), c: C.wood, n: 'chestSide' });
    cp.push({ g: box(t, ch, cd, cw / 2 - t / 2, ch / 2, 0), c: C.wood, n: 'chestSide' });
    for (let k = 0; k < 9; k++) cm.push({ g: new THREE.CylinderGeometry(0.0035 * S, 0.0035 * S, 0.0008 * S, 10).rotateX((rnd() - 0.5) * 0.6).translate((rnd() - 0.5) * cw * 0.7, ch * 0.75 + rnd() * 0.003 * S, (rnd() - 0.5) * cd * 0.6), c: C.gold, n: 'coin' });
    [-1, 1].forEach(s => cm.push({ g: box(0.003 * S, ch + 0.001, cd + 0.001, s * cw * 0.3, ch / 2, 0), c: C.metal, n: 'band' }));
    cm.push({ g: box(0.006 * S, 0.007 * S, 0.002 * S, 0, ch - 0.002 * S, cd / 2 + 0.001 * S), c: C.gold, n: 'lock' });
    const a1 = finish(cp, MAT, 'chestBox', merge); if (a1) chest.add(a1);
    const a2 = finish(cm, METAL_MAT, 'chestMetal', merge); if (a2) chest.add(a2);
    // lid: half-cylinder pivoting on the back top edge
    const lid = [{ g: new THREE.CylinderGeometry(cd / 2, cd / 2, cw, 12, 1, false, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).translate(0, 0, cd / 2), c: C.wood, n: 'lidShell' }];
    const lidM = [];
    [-1, 1].forEach(s => lidM.push({ g: new THREE.TorusGeometry(cd / 2 + 0.0005, 0.0012 * S, 4, 12, Math.PI).rotateY(Math.PI / 2).translate(s * cw * 0.3, 0, cd / 2), c: C.metal, n: 'lidBand' }));
    const l1 = finish(lid, MAT, 'lid', merge); if (l1) lidPivot.add(l1);
    const l2 = finish(lidM, METAL_MAT, 'lidBands', merge); if (l2) lidPivot.add(l2);
    lidPivot.position.set(0, ch, -cd / 2);
    chest.add(lidPivot, bubble);
    chest.position.set(chestPos[0], -0.006 * S, chestPos[2]);
    chest.rotation.set(0.12, -0.5, 0.06);
  }

  const s1 = finish(solid, MAT, 'artifact', merge); if (s1) g.add(s1);
  const s2 = finish(metal, METAL_MAT, 'artifactMetal', merge); if (s2) g.add(s2);
  const s3 = finish(glow, GLOW_MAT, 'artifactGlow', merge); if (s3) g.add(s3);
  g.add(dg, chest);

  let open = 0, cycle = 0, bub = -1;
  const setLid = (v) => { lidPivot.rotation.x = -THREE.MathUtils.degToRad(75) * v; };
  g.userData = {
    setRig(name, v) { if (name === 'hiddenChest') { setLid(v); open = v; } if (name === 'decay') dg.visible = !!v; },
    update(t, dt = 0.016) {
      if (!p.hiddenChest) return;
      cycle += dt;
      const T = p.chestInterval;
      const ph = cycle % T;
      const target = ph > T - 2.2 && ph < T - 0.6 ? 1 : 0;
      open += (target - open) * Math.min(1, dt * (target ? 9 : 2.5));
      setLid(open);
      if (target && bub < 0) bub = 0;
      if (bub >= 0) {
        bub += dt; bubble.visible = true;
        bubble.position.set(Math.sin(bub * 7) * 0.003, 0.03 * S + bub * 0.08, 0);
        bubble.scale.setScalar(1 + bub * 0.25);
        if (bub > 4) { bub = -1; bubble.visible = false; }
      }
    }
  };
  return g;
}

export default createAsset;
