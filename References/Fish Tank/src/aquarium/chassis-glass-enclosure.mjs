/*
 * CHASSIS GLASS ENCLOSURE (High Detail)
 * Parametric aquarium vessel for three.js: glass shell, water body, animated surface, meniscus,
 * silicone seams, polished edges, condensation & mineral line, sliding lid. No loaders, no textures.
 *
 * QUICK START
 *   import { createAsset } from './chassis-glass-enclosure.mjs';
 *   const tank = createAsset({ tankShape: 'bowfront', mergeForProduction: true });
 *   scene.add(tank); // in your loop: tank.userData.update(elapsedSeconds)
 *
 * PARAMS  tankShape: rectangle | shallow | bowfront | hexagon | cylinder
 *         glassThickness: standard | starphire, framing: rimless | black | chrome
 *         width 0.6-2.4, depth 0.3-0.9, height 0.3-0.9, waterLevel 0.5-0.97, lidOpen 0-1
 * SPECS  ~2,500-6,000 triangles, 5 materials, 1.20 x 0.55 x 0.50 m default (real-world scale).
 * PARTS  animate: glassLid (x slide), waterSurface (vertex ripple), waterVolume (y scale)
 *        detach: glassLid, waterVolume, condensation
 * LICENSE MIT - procedural geometry, free for commercial use.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = {
  glass: '#d8f4f0', edge: '#7fe0d0', silicone: '#e8f0f0', frame: '#141414',
  water: '#7cc8d8', surface: '#bfeaf2', meniscus: '#e6fbff', spots: '#f4f8f6', clip: '#cfd8d8'
};

export const COLORWAYS = {
  'default':   { ...BASE },
  'standard':  { glass: '#b8e6c8', edge: '#4fb88a', silicone: '#202020', frame: '#141414', water: '#79c4cf', surface: '#b5e4ec', meniscus: '#dff6fa', spots: '#eef2ee', clip: '#222222' },
  'reef':      { glass: '#d4ecff', edge: '#7fc8ff', silicone: '#101010', frame: '#0c0c0c', water: '#3a78d8', surface: '#9cc8ff', meniscus: '#d8ecff', spots: '#e8f0ff', clip: '#181818' },
  'blackwater':{ glass: '#e6f0e4', edge: '#8fd8b8', silicone: '#d8d0c0', frame: '#2a1a10', water: '#a8742c', surface: '#d8b070', meniscus: '#f0d8a8', spots: '#f2eadc', clip: '#3a2a1a' },
  'cyber':     { glass: '#e0e8ff', edge: '#b080ff', silicone: '#c8c8ff', frame: '#c8ccd4', water: '#5ab8e8', surface: '#b0d8ff', meniscus: '#e0f0ff', spots: '#e8e8ff', clip: '#a8b0c0' },
  'marine':    { glass: '#dcf2ff', edge: '#7fd4ff', silicone: '#1a1a1a', frame: '#3a120a', water: '#4aa0e0', surface: '#a8d8ff', meniscus: '#e0f2ff', spots: '#f0f6ff', clip: '#2a1008' }
};

export const presets = COLORWAYS;

export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'Merge per material (true) or keep selectable panels (false).' },
  colorway:       { type: 'choice', default: 'default', options: Object.keys(COLORWAYS), label: 'Theme', affects: 'colors', describe: 'Glass/water tint scheme.' },
  tankShape:      { type: 'choice', default: 'rectangle', options: ['rectangle', 'shallow', 'bowfront', 'hexagon', 'cylinder'], label: 'Tank Shape', affects: 'geometry', describe: 'Vessel footprint.' },
  width:          { type: 'range', default: 1.2, min: 0.6, max: 2.4, step: 0.05, label: 'Width', affects: 'geometry', describe: 'Outer width (m).' },
  depth:          { type: 'range', default: 0.5, min: 0.3, max: 0.9, step: 0.05, label: 'Depth', affects: 'geometry', describe: 'Outer depth (m).' },
  height:         { type: 'range', default: 0.55, min: 0.3, max: 0.9, step: 0.05, label: 'Height', affects: 'geometry', describe: 'Glass height before shape multiplier (m).' },
  glassThickness: { type: 'choice', default: 'starphire', options: ['standard', 'starphire'], label: 'Glass', affects: 'geometry', describe: 'Standard float glass (8mm, green edge) or Starphire ultra-clear (12mm).' },
  framing:        { type: 'choice', default: 'rimless', options: ['rimless', 'black', 'chrome'], label: 'Framing', affects: 'geometry', describe: 'Rim trim.' },
  waterLevel:     { type: 'range', default: 0.9, min: 0.5, max: 0.97, step: 0.01, label: 'Water Level', affects: 'geometry', describe: 'Fraction of glass height filled.' },
  waterOpacity:   { type: 'range', default: 0.16, min: 0.04, max: 0.6, step: 0.01, label: 'Water Density', affects: 'colors', describe: 'Tint strength of the water body.' },
  showLid:        { type: 'toggle', default: true, label: 'Glass Lid', affects: 'geometry', describe: 'Show the removable lid.' },
  lidOpen:        { type: 'range', default: 0.25, min: 0, max: 1, step: 0.01, label: 'Lid Slide', affects: 'geometry', describe: 'Lid slides back along X.' },
  condensation:   { type: 'range', default: 0.6, min: 0, max: 1, step: 0.05, label: 'Condensation', affects: 'geometry', describe: 'Droplets and mineral spots above the waterline.' },
  water:          { type: 'color', default: BASE.water, label: 'Water Tint', affects: 'colors', describe: 'Water body color.' }
};

export const rig = {
  glassLid:     { axis: 'x', range: [0, 0.6], describe: 'Lid slides open (fraction of width).' },
  waterVolume:  { axis: 'y', range: [0.5, 0.97], describe: 'Water line height.' },
  waterSurface: { axis: 'y', range: [-0.004, 0.004], describe: 'Procedural ripple displacement.' }
};

export const detach = ['glassLid', 'waterVolume', 'condensation'];

export const night = {
  waterVolume: { color: '#3060ff', intensity: 0.3, distance: 1.5, describe: 'Faint moonlight scatter in the water.' }
};

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

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide });
const METAL_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.25, metalness: 0.9, side: THREE.DoubleSide });
const GLASS_MAT = new THREE.MeshPhysicalMaterial({ vertexColors: true, flatShading: true, roughness: 0.03, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.6 });
const EDGE_MAT = new THREE.MeshPhysicalMaterial({ vertexColors: true, flatShading: true, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.85, side: THREE.DoubleSide, envMapIntensity: 1.4 });
const SOFT_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.4, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });

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

function box(w, h, d, x = 0, y = 0, z = 0) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

function addCylinder(parts, rTop, rBot, h, segs, x, y, z, rx = 0, ry = 0, rz = 0, hex = '#888888') {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  if (rx) geo.rotateX(rx);
  if (ry) geo.rotateY(ry);
  if (rz) geo.rotateZ(rz);
  geo.translate(x, y, z);
  parts.push({ g: geo, c: hex });
}

function addWire(parts, p1, p2, hex, r = 0.01, radialSegments = 5) {
  const v1 = new THREE.Vector3(...p1), v2 = new THREE.Vector3(...p2);
  const dist = v1.distanceTo(v2);
  if (dist < 1e-5) return;
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

// ---------- shared footprint maths (same formulas as substrate-terrain.mjs) ----------
function outlineFor(shape, w, d) {
  if (shape === 'cylinder' || shape === 'hexagon') {
    const r = Math.min(w, d * 1.6) / 2, n = shape === 'cylinder' ? 40 : 6, pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
    return { pts, hMul: shape === 'cylinder' ? 1.3 : 1.45, curved: shape === 'cylinder' };
  }
  if (shape === 'bowfront') {
    const bulge = d * 0.28, pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2]], n = 14;
    for (let i = 1; i < n; i++) { const u = 1 - 2 * i / n; pts.push([u * w / 2, d / 2 + bulge * (1 - u * u)]); }
    pts.push([-w / 2, d / 2]);
    return { pts, hMul: 1, curved: false, bow: true };
  }
  const dd = shape === 'shallow' ? d * 1.25 : d;
  return { pts: [[-w / 2, -dd / 2], [w / 2, -dd / 2], [w / 2, dd / 2], [-w / 2, dd / 2]], hMul: shape === 'shallow' ? 0.55 : 1, curved: false };
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

function shapeFrom(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  s.closePath();
  return s;
}

function flatSlab(pts, thick, y) {
  const geo = new THREE.ExtrudeGeometry(shapeFrom(pts), { depth: thick, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2).translate(0, y, 0);
  return geo;
}

export function createAsset(userParams = {}) {
  const p = {};
  for (const k of Object.keys(params)) p[k] = params[k].default;
  Object.assign(p, userParams);
  const C = zonesFor(p.colorway, userParams);
  const merge = !!p.mergeForProduction;

  const O = outlineFor(p.tankShape, p.width, p.depth);
  const H = p.height * O.hMul;
  const gT = p.glassThickness === 'starphire' ? 0.012 : 0.008;
  const pts = O.pts;
  const inner = insetOutline(pts, gT);
  const waterIn = insetOutline(pts, gT + 0.0005);
  let waterY = H * p.waterLevel;
  const edgeHex = p.glassThickness === 'standard' && !userParams.edge ? 0x3fa070 : C.edge;

  const g = new THREE.Group();
  g.name = 'chassis-glass-enclosure';
  const glass = [], edges = [], frame = [], silicone = [], spots = [], clips = [];

  // ---------- glass walls ----------
  const n = pts.length;
  if (O.curved) {
    const r = Math.hypot(pts[0][0], pts[0][1]);
    const prof = [new THREE.Vector2(r - gT, 0), new THREE.Vector2(r, 0), new THREE.Vector2(r, H), new THREE.Vector2(r - gT, H), new THREE.Vector2(r - gT, 0)];
    glass.push({ g: new THREE.LatheGeometry(prof, 56), c: C.glass, n: 'seamlessCylinder' });
    edges.push({ g: new THREE.RingGeometry(r - gT, r, 56, 1).rotateX(-Math.PI / 2).translate(0, H + 0.0004, 0), c: edgeHex, n: 'polishedEdge' });
  } else {
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez);
      const ang = Math.atan2(-ez, ex);
      const ia = inner[i], ib = inner[(i + 1) % n];
      const mx = (a[0] + b[0] + ia[0] + ib[0]) / 4, mz = (a[1] + b[1] + ia[1] + ib[1]) / 4;
      glass.push({ g: box(L, H, gT).rotateY(ang).translate(mx, H / 2, mz), c: C.glass, n: 'panel' });
      edges.push({ g: box(L, 0.0016, gT).rotateY(ang).translate(mx, H + 0.0008, mz), c: edgeHex, n: 'polishedEdge' });
    }
  }
  glass.push({ g: flatSlab(inner, gT, 0), c: C.glass, n: 'bottomPanel' });

  // ---------- silicone seams at corners + bottom perimeter ----------
  if (!O.curved) {
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      const a1 = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), a2 = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
      let da = Math.abs(a2 - a1); if (da > Math.PI) da = Math.PI * 2 - da;
      if (da > 0.35) addCylinder(silicone, 0.0032, 0.0032, H - gT - 0.004, 6, inner[i][0], gT + (H - gT) / 2, inner[i][1], 0, 0, 0, C.silicone);
    }
  }
  const innerRing = O.curved ? inner : inner;
  for (let i = 0; i < innerRing.length; i++) {
    const a = innerRing[i], b = innerRing[(i + 1) % innerRing.length];
    addWire(silicone, [a[0], gT + 0.002, a[1]], [b[0], gT + 0.002, b[1]], C.silicone, 0.0028, 4);
  }

  // ---------- framing ----------
  if (p.framing !== 'rimless') {
    const fh = 0.028, fo = 0.006;
    const outerF = insetOutline(pts, -fo);
    const ringSlab = (y) => {
      for (let i = 0; i < outerF.length; i++) {
        const a = outerF[i], b = outerF[(i + 1) % outerF.length];
        const ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez), ang = Math.atan2(-ez, ex);
        const ia = inner[i], ib = inner[(i + 1) % inner.length];
        const mx = (a[0] + b[0] + ia[0] + ib[0]) / 4, mz = (a[1] + b[1] + ia[1] + ib[1]) / 4;
        frame.push({ g: box(L + 0.004, fh, gT + fo + 0.002).rotateY(ang).translate(mx, y, mz), c: C.frame, n: 'rimTrim' });
      }
    };
    ringSlab(H - fh / 2 + 0.004); ringSlab(fh / 2 - 0.004);
    if (!O.curved) for (let i = 0; i < n; i++) { const q = outerF[i]; frame.push({ g: box(0.016, H, 0.016).rotateY(-Math.atan2(q[1], q[0]) + Math.PI / 4).translate(q[0], H / 2, q[1]), c: C.frame, n: 'cornerTrim' }); }
  }

  // ---------- water volume (side walls only; the animated surface caps it) ----------
  const M = 96;
  const per = resample(waterIn, M);
  const wv = [];
  for (let k = 0; k < M; k++) {
    const a = per[k], b = per[(k + 1) % M];
    wv.push(a[0], 0, a[1], b[0], 0, b[1], b[0], 1, b[1], a[0], 0, a[1], b[0], 1, b[1], a[0], 1, a[1]);
  }
  const wvGeo = new THREE.BufferGeometry();
  wvGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wv), 3));
  prep(wvGeo, C.water); wvGeo.computeVertexNormals();
  const waterMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0, transparent: true, opacity: p.waterOpacity, side: THREE.DoubleSide, depthWrite: false });
  const waterVol = new THREE.Mesh(wvGeo, waterMat);
  waterVol.name = 'waterVolume'; waterVol.renderOrder = 1;
  const waterGroup = new THREE.Group(); waterGroup.name = 'waterVolume';
  waterGroup.add(waterVol);

  // ---------- animated surface (concentric-ring grid on the inner outline) ----------
  const R = 12;
  let cx = 0, cz = 0; per.forEach(q => { cx += q[0]; cz += q[1]; }); cx /= M; cz /= M;
  const sp = [cx, 0, cz], ring = [];
  for (let k = 1; k <= R; k++) for (let j = 0; j < M; j++) { const f = k / R; sp.push(cx + (per[j][0] - cx) * f, 0, cz + (per[j][1] - cz) * f); }
  const idx = [];
  for (let j = 0; j < M; j++) idx.push(0, 1 + j, 1 + ((j + 1) % M));
  for (let k = 1; k < R; k++) for (let j = 0; j < M; j++) {
    const a = 1 + (k - 1) * M + j, b = 1 + (k - 1) * M + ((j + 1) % M), c = 1 + k * M + j, d = 1 + k * M + ((j + 1) % M);
    idx.push(a, c, d, a, d, b);
  }
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(sp);
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const sCol = new Float32Array(sPos.length); const scc = new THREE.Color(C.surface);
  for (let i = 0; i < sCol.length; i += 3) { sCol[i] = scc.r; sCol[i + 1] = scc.g; sCol[i + 2] = scc.b; }
  sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  sGeo.setIndex(idx); sGeo.computeVertexNormals();
  const base = Float32Array.from(sPos);
  const surfMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, flatShading: true, roughness: 0.04, metalness: 0.05, transmission: 0, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2.0 });
  const surface = new THREE.Mesh(sGeo, surfMat);
  surface.name = 'waterSurface'; surface.renderOrder = 3;
  ring.length = 0;

  // ---------- meniscus: curved strip rising up the glass ----------
  const rows = [[0, 0.0042], [0.0012, 0.0024], [0.0035, 0.0009], [0.008, 0.0001]];
  const mp = [], mi = [];
  rows.forEach(([off, hy]) => { const rr = insetOutline(per, off); rr.forEach(q => mp.push(q[0], hy, q[1])); });
  for (let r = 0; r < rows.length - 1; r++) for (let j = 0; j < M; j++) {
    const a = r * M + j, b = r * M + ((j + 1) % M), c = (r + 1) * M + j, d = (r + 1) * M + ((j + 1) % M);
    mi.push(a, c, d, a, d, b);
  }
  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(mp), 3));
  mGeo.setIndex(mi);
  const menGeo = prep(mGeo, C.meniscus); menGeo.computeVertexNormals();
  const meniscus = new THREE.Mesh(menGeo, SOFT_MAT);
  meniscus.name = 'meniscus'; meniscus.renderOrder = 3;

  const surfGroup = new THREE.Group(); surfGroup.name = 'waterSurfaceGroup';
  surfGroup.add(surface, meniscus);
  g.add(waterGroup, surfGroup);

  // ---------- condensation + mineral line (static, above waterline) ----------
  const condGroup = new THREE.Group(); condGroup.name = 'condensation';
  const buildCondensation = () => {
    condGroup.clear();
    const list = [];
    const rnd = rng(1337);
    const cnt = Math.round(220 * p.condensation);
    const edgesL = []; let tot = 0;
    for (let i = 0; i < inner.length; i++) { const a = inner[i], b = inner[(i + 1) % inner.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); edgesL.push(L); tot += L; }
    const top = H - 0.004, lo = waterY + 0.012;
    if (top > lo) {
      for (let c = 0; c < cnt; c++) {
        let d = rnd() * tot, i = 0; while (d > edgesL[i] && i < edgesL.length - 1) { d -= edgesL[i]; i++; }
        const a = inner[i], b = inner[(i + 1) % inner.length], t = d / (edgesL[i] || 1);
        const ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez) || 1;
        let nx = -ez / L, nz = ex / L;
        const mx = a[0] + ex * t, mz = a[1] + ez * t;
        if (nx * (cx - mx) + nz * (cz - mz) < 0) { nx = -nx; nz = -nz; }
        const yy = lo + Math.pow(rnd(), 0.6) * (top - lo);
        const rad = 0.0012 + rnd() * 0.003;
        const dg = new THREE.CircleGeometry(rad, 6);
        dg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(nx, 0, nz)));
        dg.translate(mx + nx * 0.0006, yy, mz + nz * 0.0006);
        list.push({ g: dg, c: C.spots, n: 'droplet' });
      }
      // dried mineral line just above the water
      const mv = [], ml = resample(insetOutline(pts, gT + 0.0004), M);
      const y0 = waterY + 0.005, y1 = waterY + 0.005 + 0.004 + 0.004 * p.condensation;
      for (let k = 0; k < M; k++) { const a = ml[k], b = ml[(k + 1) % M]; mv.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1]); }
      const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(mv), 3));
      if (p.condensation > 0) list.push({ g: mg, c: C.spots, n: 'mineralLine' });
    }
    const m = finish(list, SOFT_MAT, 'condensation', true);
    if (m) { m.renderOrder = 2; condGroup.add(m); }
  };
  buildCondensation();
  g.add(condGroup);

  // ---------- lid ----------
  const lidGroup = new THREE.Group(); lidGroup.name = 'glassLid';
  if (p.showLid) {
    const lidPts = insetOutline(pts, gT + 0.004);
    const lidList = [{ g: flatSlab(lidPts, 0.005, 0), c: C.glass, n: 'lidPane' }];
    const lidHw = [];
    addCylinder(lidHw, 0.012, 0.014, 0.012, 12, cx, 0.011, cz + (O.curved ? 0 : 0.02), 0, 0, 0, C.clip);
    const lm = finish(lidList, GLASS_MAT, 'lid', merge); if (lm) { lm.renderOrder = 2; lidGroup.add(lm); }
    const lh = finish(lidHw, EDGE_MAT, 'lidKnob', merge); if (lh) lidGroup.add(lh);
    // support clips on the glass
    for (let i = 0; i < inner.length; i += Math.max(1, Math.floor(inner.length / 6))) clips.push({ g: box(0.03, 0.012, 0.03).translate(inner[i][0], H - 0.004, inner[i][1]), c: C.clip, n: 'lidClip' });
    lidGroup.position.y = H + (p.framing !== 'rimless' ? 0.004 : 0.002);
  }
  g.add(lidGroup);

  // ---------- assemble static parts ----------
  const gm = finish(glass, GLASS_MAT, 'glass', merge); if (gm) { gm.renderOrder = 2; g.add(gm); }
  const em = finish(edges, EDGE_MAT, 'polishedEdges', merge); if (em) g.add(em);
  const fm = finish(frame, p.framing === 'chrome' ? METAL_MAT : MAT, 'frame', merge); if (fm) g.add(fm);
  const sm = finish(silicone, SOFT_MAT, 'siliconeSeams', merge); if (sm) { sm.renderOrder = 2; g.add(sm); }
  const cm = finish(clips, MAT, 'lidClips', merge); if (cm) g.add(cm);

  // ---------- rig + animation ----------
  const lidRange = (O.curved ? 0.5 : 0.6) * Math.min(p.width, 2.4);
  const ripple = { x: cx + 0.2, z: cz - 0.1, s: 1 };
  const setWater = (lvl) => {
    waterY = H * lvl;
    waterVol.scale.y = waterY - gT; waterVol.position.y = gT;
    surfGroup.position.y = waterY;
  };
  setWater(p.waterLevel);
  lidGroup.position.x = p.lidOpen * lidRange;

  let bnx = Infinity, bxx = -Infinity, bnz = Infinity, bxz = -Infinity;
  inner.forEach(q => { bnx = Math.min(bnx, q[0]); bxx = Math.max(bxx, q[0]); bnz = Math.min(bnz, q[1]); bxz = Math.max(bxz, q[1]); });
  let onx = Infinity, oxx = -Infinity, onz = Infinity, oxz = -Infinity;
  pts.forEach(q => { onx = Math.min(onx, q[0]); oxx = Math.max(oxx, q[0]); onz = Math.min(onz, q[1]); oxz = Math.max(oxz, q[1]); });

  g.userData = {
    outline: pts, innerOutline: inner,
    innerBounds: { minX: bnx, maxX: bxx, minZ: bnz, maxZ: bxz },
    outerBounds: { minX: onx, maxX: oxx, minZ: onz, maxZ: oxz },
    floorY: gT, glassT: gT, height: H,
    get waterY() { return waterY; },
    setRipple(x, z, s = 1) { ripple.x = x; ripple.z = z; ripple.s = s; },
    setRig(name, v) {
      if (name === 'glassLid') lidGroup.position.x = v * lidRange;
      if (name === 'waterVolume') { setWater(v); }
    },
    update(t) {
      const pos = sGeo.attributes.position.array;
      const ring0 = 1 + (R - 1) * M;
      for (let i = 0, vi = 0; i < pos.length; i += 3, vi++) {
        const x = base[i], z = base[i + 2];
        let y = Math.sin(x * 23 + t * 1.3) * 0.0011 + Math.sin(z * 31 - t * 1.7 + x * 7) * 0.0009 + Math.sin((x + z) * 47 + t * 2.3) * 0.0004;
        const dx = x - ripple.x, dz = z - ripple.z, dd = Math.hypot(dx, dz);
        y += Math.sin(dd * 70 - t * 7) * 0.0032 * ripple.s * Math.exp(-dd * 7);
        if (vi >= ring0) y = y * 0.3 + 0.0012; // edge vertices pinned near the meniscus
        pos[i + 1] = y;
      }
      sGeo.attributes.position.needsUpdate = true;
      sGeo.computeVertexNormals();
    }
  };
  return g;
}

export default createAsset;
