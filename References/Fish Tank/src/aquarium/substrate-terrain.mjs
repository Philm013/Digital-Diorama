/*
 * SUBSTRATE TERRAIN (High Detail)
 * Parametric aquarium floor for three.js: sloped/terraced/undulating sand bed clipped to the tank
 * footprint, layered strata skirt visible through the glass, scattered grains/pebbles, foraging
 * craters and an animated additive caustic overlay. Exposes userData.heightAt(x, z).
 *
 * QUICK START
 *   import { createAsset } from './substrate-terrain.mjs';
 *   const bed = createAsset({ substrateType: 'aquasoil', contour: 'rear-bank' });
 *   scene.add(bed); const y = bed.userData.heightAt(0.1, -0.05);
 *
 * PARAMS  substrateType: silica | aquasoil | coral | pebbles ; contour: flat | rear-bank | dual-mound | terraced
 *         tankShape/width/depth (inner footprint), baseDepth, slopeHeight, foragingCraters, caustics
 * SPECS  ~6,000-9,000 triangles, 2 materials, 1.18 x 0.03-0.2 x 0.48 m default.
 * PARTS  animate: caustics (shader time)
 *        detach: foragingCraters, pebbles, caustics
 * LICENSE MIT - procedural geometry, free for commercial use.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = {
  sand: '#e9e4d8', sandDark: '#d8d0bf', sandLight: '#f6f2ea', strata: '#c9bfa8',
  deep: '#a89c84', pebble: '#b8b0a2', pebbleDark: '#8c847a', crater: '#cfc6b2'
};

export const COLORWAYS = {
  'default':  { ...BASE },
  'aquasoil': { sand: '#2e2620', sandDark: '#231c17', sandLight: '#3d332a', strata: '#1a1512', deep: '#3a2a1c', pebble: '#5a4c40', pebbleDark: '#3a3028', crater: '#28201a' },
  'coral':    { sand: '#f4efe6', sandDark: '#e8dccd', sandLight: '#fffaf2', strata: '#e2d4c0', deep: '#cdbba4', pebble: '#f0d8d0', pebbleDark: '#e0c0b8', crater: '#ece2d4' },
  'pebbles':  { sand: '#8a8278', sandDark: '#6c655c', sandLight: '#a49c90', strata: '#5c564e', deep: '#4a453f', pebble: '#b0a89a', pebbleDark: '#6e665c', crater: '#7a7368' },
  'black':    { sand: '#1c1c20', sandDark: '#141418', sandLight: '#2a2a30', strata: '#101012', deep: '#202024', pebble: '#3a3a44', pebbleDark: '#24242c', crater: '#18181c' },
  'reef':     { sand: '#f6f3ec', sandDark: '#e6e0d2', sandLight: '#ffffff', strata: '#ddd4c2', deep: '#c8bca4', pebble: '#e8d0e0', pebbleDark: '#c8b8c8', crater: '#ece6da' }
};

export const presets = COLORWAYS;

const TYPE_TO_CW = { silica: 'default', aquasoil: 'aquasoil', coral: 'coral', pebbles: 'pebbles' };

export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'Merge per material or keep selectable zones.' },
  colorway:      { type: 'choice', default: 'auto', options: ['auto', ...Object.keys(COLORWAYS)], label: 'Palette', affects: 'colors', describe: 'auto follows substrateType.' },
  substrateType: { type: 'choice', default: 'silica', options: ['silica', 'aquasoil', 'coral', 'pebbles'], label: 'Substrate', affects: 'geometry', describe: 'Fine white silica, black volcanic aquasoil, crushed coral or river pebbles.' },
  contour:       { type: 'choice', default: 'rear-bank', options: ['flat', 'rear-bank', 'dual-mound', 'terraced'], label: 'Contour', affects: 'geometry', describe: 'Landform; back-left high, front-right low.' },
  tankShape:     { type: 'choice', default: 'rectangle', options: ['rectangle', 'shallow', 'bowfront', 'hexagon', 'cylinder'], label: 'Footprint', affects: 'geometry', describe: 'Matches chassis-glass-enclosure shape.' },
  width:         { type: 'range', default: 1.2, min: 0.6, max: 2.4, step: 0.05, label: 'Tank Width', affects: 'geometry', describe: 'Outer tank width (m).' },
  depth:         { type: 'range', default: 0.5, min: 0.3, max: 0.9, step: 0.05, label: 'Tank Depth', affects: 'geometry', describe: 'Outer tank depth (m).' },
  glassInset:    { type: 'range', default: 0.0135, min: 0.005, max: 0.03, step: 0.0005, label: 'Glass Inset', affects: 'geometry', describe: 'Gap from outer outline to bed edge.' },
  baseDepth:     { type: 'range', default: 0.03, min: 0.01, max: 0.08, step: 0.005, label: 'Base Depth', affects: 'geometry', describe: 'Minimum bed thickness (m).' },
  slopeHeight:   { type: 'range', default: 0.13, min: 0, max: 0.3, step: 0.005, label: 'Slope Height', affects: 'geometry', describe: 'Rear bank height (m).' },
  foragingCraters: { type: 'toggle', default: true, label: 'Foraging Craters', affects: 'geometry', describe: 'Indentations dug by bottom feeders.' },
  craterCount:   { type: 'range', default: 6, min: 1, max: 16, step: 1, label: 'Craters', affects: 'geometry', describe: 'Number of craters.' },
  caustics:      { type: 'toggle', default: true, label: 'Caustics', affects: 'geometry', describe: 'Animated caustic light overlay.' },
  causticStrength: { type: 'range', default: 0.55, min: 0, max: 1.5, step: 0.05, label: 'Caustic Strength', affects: 'colors', describe: 'Overlay brightness.' },
  causticColor:  { type: 'color', default: '#e8fbff', label: 'Caustic Color', affects: 'colors', describe: 'Light tint.' },
  seed:          { type: 'range', default: 42, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Noise seed.' }
};

export const rig = { caustics: { axis: 'y', range: [0, 1], describe: 'Caustic animation time.' } };
export const detach = ['foragingCraters', 'pebbles', 'caustics'];
export const night = { caustics: { color: '#6080ff', intensity: 0.2, distance: 1, describe: 'Moonlit caustics.' } };

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

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide });

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

// ---------- footprint maths (same formulas as chassis-glass-enclosure.mjs) ----------
function outlineFor(shape, w, d) {
  if (shape === 'cylinder' || shape === 'hexagon') {
    const r = Math.min(w, d * 1.6) / 2, n = shape === 'cylinder' ? 40 : 6, pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
    return pts;
  }
  if (shape === 'bowfront') {
    const bulge = d * 0.28, pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2]], n = 14;
    for (let i = 1; i < n; i++) { const u = 1 - 2 * i / n; pts.push([u * w / 2, d / 2 + bulge * (1 - u * u)]); }
    pts.push([-w / 2, d / 2]);
    return pts;
  }
  const dd = shape === 'shallow' ? d * 1.25 : d;
  return [[-w / 2, -dd / 2], [w / 2, -dd / 2], [w / 2, dd / 2], [-w / 2, dd / 2]];
}

function insetOutline(pts, dist) {
  const n = pts.length; let area = 0;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const s = area > 0 ? 1 : -1, out = [];
  const nrm = (a, b) => { const ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez) || 1; return [s * -ez / L, s * ex / L]; };
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const n1 = nrm(p0, p1), n2 = nrm(p1, p2);
    let bx = n1[0] + n2[0], bz = n1[1] + n2[1]; const bl = Math.hypot(bx, bz) || 1; bx /= bl; bz /= bl;
    const cos = Math.max(0.2, bx * n1[0] + bz * n1[1]);
    out.push([p1[0] + bx * dist / cos, p1[1] + bz * dist / cos]);
  }
  return out;
}

function resample(pts, M) {
  const n = pts.length, lens = []; let total = 0;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); lens.push(L); total += L; }
  const out = [];
  for (let k = 0; k < M; k++) {
    let d = (k / M) * total, i = 0;
    while (d > lens[i] && i < n - 1) { d -= lens[i]; i++; }
    const a = pts[i], b = pts[(i + 1) % n], t = lens[i] ? d / lens[i] : 0;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

const CAUSTIC_GLSL = `
float causticAt(vec2 uv, float t){
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  vec2 i = p; float c = 1.0; float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0; c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 2.0);
}`;

export function createAsset(userParams = {}) {
  const p = {};
  for (const k of Object.keys(params)) p[k] = params[k].default;
  Object.assign(p, userParams);
  const cwName = p.colorway === 'auto' ? (TYPE_TO_CW[p.substrateType] || 'default') : p.colorway;
  const C = zonesFor(cwName, userParams);
  const merge = !!p.mergeForProduction;
  const rnd = rng(p.seed);

  const outline = insetOutline(outlineFor(p.tankShape, p.width, p.depth), p.glassInset);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  outline.forEach(q => { minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minZ = Math.min(minZ, q[1]); maxZ = Math.max(maxZ, q[1]); });
  const bw = maxX - minX, bd = maxZ - minZ;

  // ---------- height field ----------
  const craters = [];
  if (p.foragingCraters) for (let i = 0; i < p.craterCount; i++) craters.push([minX + bw * (0.45 + rnd() * 0.5), minZ + bd * (0.35 + rnd() * 0.6), 0.012 + rnd() * 0.02, 0.004 + rnd() * 0.006]);
  const ph = [rnd() * 10, rnd() * 10, rnd() * 10];
  const heightAt = (x, z, withCraters = true) => {
    const u = THREE.MathUtils.clamp((maxX - x) / bw, 0, 1); // 1 at left
    const v = THREE.MathUtils.clamp((maxZ - z) / bd, 0, 1); // 1 at back
    let h = p.baseDepth;
    const S = p.slopeHeight;
    if (p.contour === 'rear-bank') h += S * Math.pow(0.3 * u + 0.7 * v, 1.8) + S * 0.25 * Math.pow(u * v, 2);
    else if (p.contour === 'dual-mound') {
      const m1 = Math.exp(-(((x - (minX + bw * 0.22)) / (bw * 0.18)) ** 2 + ((z - (minZ + bd * 0.3)) / (bd * 0.35)) ** 2));
      const m2 = Math.exp(-(((x - (minX + bw * 0.8)) / (bw * 0.14)) ** 2 + ((z - (minZ + bd * 0.25)) / (bd * 0.3)) ** 2));
      h += S * m1 + S * 0.6 * m2 + S * 0.15 * v;
    } else if (p.contour === 'terraced') {
      const raw = 0.3 * u + 0.7 * v, steps = 3, k = raw * steps, f = k - Math.floor(k);
      h += S * (Math.floor(k) + THREE.MathUtils.smoothstep(f, 0.75, 1)) / steps;
    }
    // gentle undulation / ripples
    h += 0.004 * Math.sin(x * 23 + ph[0]) * Math.sin(z * 19 + ph[1]) + 0.0015 * Math.sin(x * 61 + z * 47 + ph[2]);
    if (withCraters) for (const c of craters) { const d2 = ((x - c[0]) ** 2 + (z - c[1]) ** 2) / (c[2] * c[2]); h -= c[3] * Math.exp(-d2 * 2) - c[3] * 0.35 * Math.exp(-((Math.sqrt(d2) - 1.15) ** 2) * 6); }
    return Math.max(0.006, h);
  };

  // point-in-polygon + projection to clamp grid vertices into the footprint
  const inside = (x, z) => { let c = false; for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) { const [xi, zi] = outline[i], [xj, zj] = outline[j]; if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) c = !c; } return c; };
  const clampIn = (x, z) => {
    if (inside(x, z)) return [x, z];
    let best = null, bd2 = Infinity;
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      const ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez || 1;
      const t = THREE.MathUtils.clamp(((x - a[0]) * ex + (z - a[1]) * ez) / L2, 0, 1);
      const px = a[0] + ex * t, pz = a[1] + ez * t, d2 = (px - x) ** 2 + (pz - z) ** 2;
      if (d2 < bd2) { bd2 = d2; best = [px, pz]; }
    }
    return best;
  };

  // ---------- top surface (grid, triangles bucketed into colour zones) ----------
  const NX = Math.max(24, Math.round(bw / 0.022)), NZ = Math.max(12, Math.round(bd / 0.022));
  const grid = [];
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const [x, z] = clampIn(minX + bw * i / NX, minZ + bd * j / NZ);
    grid.push([x, heightAt(x, z), z]);
  }
  const buckets = { sand: [], sandDark: [], sandLight: [], crater: [] };
  const allTop = [];
  const tri = (a, b, c) => {
    const area = Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]));
    if (area < 1e-9) return;
    const cx = (a[0] + b[0] + c[0]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
    const n = Math.sin(cx * 90 + ph[0]) * Math.sin(cz * 110 + ph[1]) + (rnd() - 0.5) * 0.9;
    let key = n > 0.45 ? 'sandLight' : n < -0.45 ? 'sandDark' : 'sand';
    if (craters.some(c => Math.hypot(cx - c[0], cz - c[1]) < c[2] * 0.8)) key = 'crater';
    buckets[key].push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    allTop.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  };
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const a = grid[j * (NX + 1) + i], b = grid[j * (NX + 1) + i + 1], c = grid[(j + 1) * (NX + 1) + i], d = grid[(j + 1) * (NX + 1) + i + 1];
    if ((i + j) % 2) { tri(a, c, b); tri(b, c, d); } else { tri(a, c, d); tri(a, d, b); }
  }
  const parts = [];
  const craterParts = [];
  for (const [k, arr] of Object.entries(buckets)) {
    if (!arr.length) continue;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3));
    (k === 'crater' ? craterParts : parts).push({ g: geo, c: C[k], n: k });
  }

  // ---------- strata skirt (layers seen through the front glass) ----------
  const per = resample(outline, 160);
  const sk = { deep: [], strata: [] };
  for (let k = 0; k < per.length; k++) {
    const a = per[k], b = per[(k + 1) % per.length];
    const ha = heightAt(a[0], a[1]), hb = heightAt(b[0], b[1]);
    const la = Math.min(ha * 0.45, p.baseDepth * 0.7), lb = Math.min(hb * 0.45, p.baseDepth * 0.7);
    sk.deep.push(a[0], 0, a[1], b[0], 0, b[1], b[0], lb, b[1], a[0], 0, a[1], b[0], lb, b[1], a[0], la, a[1]);
    sk.strata.push(a[0], la, a[1], b[0], lb, b[1], b[0], hb, b[1], a[0], la, a[1], b[0], hb, b[1], a[0], ha, a[1]);
  }
  for (const [k, arr] of Object.entries(sk)) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3)); parts.push({ g: geo, c: C[k], n: 'strata_' + k }); }
  // embedded grains in the skirt (visible pebble layer against the glass)
  for (let k = 0; k < 70; k++) {
    const q = per[Math.floor(rnd() * per.length)], h = heightAt(q[0], q[1]);
    const r = 0.002 + rnd() * 0.004;
    parts.push({ g: new THREE.IcosahedronGeometry(r, 0).scale(1, 0.7, 1).translate(q[0] * 0.995, rnd() * h * 0.9, q[1] * 0.995), c: rnd() > 0.5 ? C.pebble : C.pebbleDark, n: 'grain' });
  }

  // ---------- surface pebbles / coral rubble ----------
  const pebbles = [];
  const nPeb = p.substrateType === 'pebbles' ? 260 : p.substrateType === 'coral' ? 180 : p.substrateType === 'aquasoil' ? 120 : 80;
  for (let k = 0; k < nPeb; k++) {
    const x = minX + rnd() * bw, z = minZ + rnd() * bd;
    if (!inside(x, z)) continue;
    const big = p.substrateType === 'pebbles' ? 0.006 + rnd() * 0.012 : 0.0025 + rnd() * 0.005;
    const geo = p.substrateType === 'coral' && rnd() > 0.5
      ? new THREE.CylinderGeometry(big * 0.4, big * 0.5, big * 3, 5).rotateZ(Math.PI / 2).rotateY(rnd() * 6)
      : new THREE.IcosahedronGeometry(big, 0).scale(1 + rnd() * 0.4, 0.55, 1);
    geo.rotateY(rnd() * 6).translate(x, heightAt(x, z) + big * 0.15, z);
    pebbles.push({ g: geo, c: rnd() > 0.5 ? C.pebble : C.pebbleDark, n: 'pebble' });
  }

  const g = new THREE.Group(); g.name = 'substrate-terrain';
  const m1 = finish(parts, MAT, 'substrate', merge); if (m1) g.add(m1);
  const cg = new THREE.Group(); cg.name = 'foragingCraters';
  const m2 = finish(craterParts, MAT, 'craters', merge); if (m2) cg.add(m2);
  g.add(cg);
  const pg = new THREE.Group(); pg.name = 'pebbles';
  const m3 = finish(pebbles, MAT, 'pebbles', merge); if (m3) pg.add(m3);
  g.add(pg);

  // ---------- caustic overlay ----------
  const causticMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(p.causticColor) }, uStrength: { value: p.causticStrength } },
    vertexShader: 'varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: CAUSTIC_GLSL + 'uniform float uTime; uniform vec3 uColor; uniform float uStrength; varying vec3 vW; varying vec3 vN; void main(){ float up = clamp(vN.y, 0.0, 1.0); float c = causticAt(vW.xz * 2.2, uTime * 0.45) * 0.7 + causticAt(vW.xz * 3.1 + 7.0, uTime * 0.31) * 0.45; gl_FragColor = vec4(uColor * c * uStrength * up, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  });
  const cgeo = new THREE.BufferGeometry(); cgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(allTop), 3)); cgeo.computeVertexNormals();
  const caustic = new THREE.Mesh(cgeo, causticMat); caustic.name = 'caustics'; caustic.renderOrder = 1; caustic.position.y = 0.0006;
  caustic.visible = !!p.caustics;
  g.add(caustic);

  g.userData = {
    heightAt, inside, bounds: { minX, maxX, minZ, maxZ }, outline, craters,
    causticMaterial: causticMat, causticGLSL: CAUSTIC_GLSL,
    setRig(name, v) { if (name === 'caustics') caustic.visible = !!v; if (name === 'foragingCraters') cg.visible = !!v; },
    update(t) { causticMat.uniforms.uTime.value = t; }
  };
  return g;
}

export default createAsset;
