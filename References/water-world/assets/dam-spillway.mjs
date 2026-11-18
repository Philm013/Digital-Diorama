/*
 * DAM & SPILLWAY (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A concrete gravity dam (optionally arched in plan) impounds a reservoir across a valley. Raise
 * the radial gates and water pours over the ogee crest, races down the spillway chute and slams
 * into a stilling basin where a hydraulic jump boils white before the river carries on. A crest
 * road with lamps, gate piers and a hollow powerhouse at the toe with turbine outflows complete
 * it.
 *
 * QUICK START
 *   import { createAsset } from './dam-spillway.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // reservoir on −X, tailwater on +X; gates: setRig('gate-1', metres raised)
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | weathered | sandstone | modern | alpine — Theme
 *   height              10–60 m (default 24) — Dam Height
 *   crestLength         40–200 m (default 90) — Crest Length
 *   spillwayWidth       6–40 m (default 18) — Spillway Width
 *   gates               1–6 (default 3) — Gates
 *   gateOpen            0–1 (default 0.6) — Gate Opening
 *   reservoirLevel      0.4–0.97 (default 0.9) — Reservoir Level
 *   arch                0–1 (default 0.3) — Arch Curvature
 *   powerhouse          on/off (default on) — Powerhouse
 *   outflowWidth        6–30 m (default 13) — River Width Below
 *   diorama             on/off (default on) — Diorama Sides
 *   chainEnds           on/off (default off) — Standard Ends
 *   inletWidth          1.5–20 m (default 6) — Feeder Width
 *   seed                1–999 (default 11) — Seed
 *   concrete            colour (default #c8c4bc) — Concrete Colour
 *   concreteDark        colour (default #a29e96) — Concrete Dark Colour
 *   stain               colour (default #8a867e) — Stain Colour
 *   rock                colour (default #7a756c) — Rock Colour
 *   grass               colour (default #7c9a55) — Grass Colour
 *   grassDark           colour (default #5f7f42) — Grass Dark Colour
 *   soil                colour (default #5a4a3a) — Soil Colour
 *   steel               colour (default #5f6a74) — Steel Colour
 *   gate                colour (default #3f6f8f) — Gate Colour
 *   rail                colour (default #d8d8d8) — Rail Colour
 *   roof                colour (default #4a4e55) — Roof Colour
 *   wall                colour (default #d6d0c4) — Wall Colour
 *   glass               colour (default #8fb8cc) — Glass Colour
 *   lamp                colour (default #ffd890) — Lamp Colour
 *   water               colour (default #3f8698) — Water Colour
 *   deep                colour (default #1a4f66) — Deep Colour
 *   foam                colour (default #f6fcff) — Foam Colour
 *
 * SPECS  43,330 triangles at defaults, 6 materials, 13 draw calls when merged,
 *        174.0 x 42.6 x 110.0 m (W x H x D, real-world scale).
 * PARTS animate: gate-1 (translate y 0…4 m), gate-2 (translate y 0…4 m), gate-3 (translate y 0…4
 * m), door (rotate y 0…100°)
 *        detach: gate-1, gate-2, gate-3, gate-4, gate-5, gate-6, powerhouse, door, spillway-flow
 *        night: lamps
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.ports.{inlet, outlet} · userData.surface.heightAt(x, z, t)
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = {
  concrete: '#c8c4bc', concreteDark: '#a29e96', stain: '#8a867e', rock: '#7a756c', grass: '#7c9a55', grassDark: '#5f7f42', soil: '#5a4a3a',
  steel: '#5f6a74', gate: '#3f6f8f', rail: '#d8d8d8', roof: '#4a4e55', wall: '#d6d0c4', glass: '#8fb8cc', lamp: '#ffd890', water: '#3f8698', deep: '#1a4f66', foam: '#f6fcff',
};
export const COLORWAYS = {
  'default': { ...BASE },
  weathered: { ...BASE, concrete: '#a8a49a', concreteDark: '#88847a', stain: '#6a665e' },
  sandstone: { ...BASE, concrete: '#c8a87a', concreteDark: '#a8885a', rock: '#9a7a5a' },
  modern: { ...BASE, concrete: '#e6e6e2', concreteDark: '#c6c6c2', gate: '#d8402f', roof: '#2f3a44' },
  alpine: { ...BASE, water: '#4fb0c0', deep: '#1f7088', grass: '#6f8f55', rock: '#8a8a8a' },
};
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  height: { type: 'range', default: 24, min: 10, max: 60, step: 1, unit: 'm', label: 'Dam Height', affects: 'geometry', describe: 'Crest height above the river bed.' },
  crestLength: { type: 'range', default: 90, min: 40, max: 200, step: 5, unit: 'm', label: 'Crest Length', affects: 'geometry', describe: 'Length of the dam across the valley.' },
  spillwayWidth: { type: 'range', default: 18, min: 6, max: 40, step: 1, unit: 'm', label: 'Spillway Width', affects: 'geometry', describe: 'Width of the gated spillway.' },
  gates: { type: 'range', default: 3, min: 1, max: 6, step: 1, label: 'Gates', affects: 'geometry', describe: 'Number of radial gates.' },
  gateOpen: { type: 'range', default: 0.6, min: 0, max: 1, step: 0.05, label: 'Gate Opening', affects: 'geometry', describe: 'How far the gates are raised (sets the spill).' },
  reservoirLevel: { type: 'range', default: 0.9, min: 0.4, max: 0.97, step: 0.01, label: 'Reservoir Level', affects: 'geometry', describe: 'Pool level as a fraction of the dam height.' },
  arch: { type: 'range', default: 0.3, min: 0, max: 1, step: 0.05, label: 'Arch Curvature', affects: 'geometry', describe: 'Straight gravity dam → curved arch in plan.' },
  powerhouse: { type: 'toggle', default: true, label: 'Powerhouse', affects: 'geometry', describe: 'Turbine hall at the toe with outflow jets.' },
  outflowWidth: { type: 'range', default: 13, min: 6, max: 30, step: 0.1, unit: 'm', label: 'River Width Below', affects: 'geometry', describe: 'Wetted width of the river leaving the stilling basin.' },
  diorama: { type: 'toggle', default: true, label: 'Diorama Sides', affects: 'geometry', describe: 'Cut-away valley and reservoir sections. Off: a short flange so the valley can sit in surrounding terrain.' },
  chainEnds: { type: 'toggle', default: false, label: 'Standard Ends', affects: 'geometry', describe: 'Close the reservoir off upstream (the valley floor rises to a feeder stream) and blend both ends to the shared river cross-section, so a brook can feed the lake and a river reach carry the outflow on seamlessly.' },
  inletWidth: { type: 'range', default: 6, min: 1.5, max: 20, step: 0.1, unit: 'm', label: 'Feeder Width', affects: 'geometry', describe: 'Wetted width of the feeder stream (Standard Ends only).' },
  seed: { type: 'range', default: 11, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {
  'gate-1': { type: 'translate', axis: 'y', range: [0, 4], describe: 'Radial gate 1 lift.' }, 'gate-2': { type: 'translate', axis: 'y', range: [0, 4], describe: 'Radial gate 2 lift.' }, 'gate-3': { type: 'translate', axis: 'y', range: [0, 4], describe: 'Radial gate 3 lift.' },
  door: { axis: 'y', range: [0, 100], describe: 'Powerhouse door.' },
};
export const detach = ['gate-1', 'gate-2', 'gate-3', 'gate-4', 'gate-5', 'gate-6', 'powerhouse', 'door', 'spillway-flow'];
export const night = { lamps: { color: '#ffd890', intensity: 0.7, distance: 16, offset: [0, 26, 0], describe: 'Crest-road lamps and powerhouse windows.' } };
// ─── Inline helpers (standalone by design: no shared modules) ─────────────────────────────

// ─── Zone colours & parameter resolution ──────────────────────────────────────────────────────
const ZONE_KEYS = Object.keys(BASE);
const hexOf = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v & 0xFFFFFF;
  if (typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v)) return parseInt(v.replace('#', ''), 16);
  return null;
};

/** Colorway (+ per-zone overrides) → { zone: hex }. Duplicate hexes are nudged (+1) so every zone stays isolatable. */
function zonesFor(name, o = {}) {
  const cw = COLORWAYS[name] || COLORWAYS['default'];
  const used = new Set(), out = {};
  for (const k of ZONE_KEYS) {
    let hex = (hexOf(o[k]) ?? hexOf(cw[k]) ?? hexOf(BASE[k]) ?? 0x808080) & 0xFFFFFF;
    while (used.has(hex)) hex = (hex + 1) & 0xFFFFFF;
    used.add(hex); out[k] = hex;
  }
  return out;
}

/** Colour params the caller explicitly set. A value equal to the BASE default never masks a chosen colorway. */
function colorOverrides(user, colorway) {
  const o = {};
  for (const k of ZONE_KEYS) {
    const h = hexOf(user[k]);
    if (h === null || (colorway !== 'default' && h === hexOf(BASE[k]))) continue;
    o[k] = h;
  }
  return o;
}

/** The two params every asset shares. */
function baseParams() {
  return {
    mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'true: each material merges into one draw call (rig/detach parts stay separate named meshes so they still animate). false: individually selectable meshes for editing.' },
    colorway: { type: 'choice', default: 'default', options: Object.keys(COLORWAYS), label: 'Theme', affects: 'colors', describe: 'Curated colorway scheme (individual zone colours below override it).' },
  };
}
/** One colour-picker param per BASE zone. */
function zoneParams(labels = {}) {
  const o = {};
  for (const k of Object.keys(BASE)) {
    o[k] = { type: 'color', default: BASE[k], label: labels[k] || k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, ' $1') + ' Colour', affects: 'colors', describe: `Override the "${k}" zone colour (leave at its default to follow the colorway).` };
  }
  return o;
}

/** Schema defaults ← user values: ranges clamped & snapped to step, choices validated, toggles coerced. */
function resolveParams(user = {}) {
  const p = {};
  for (const [k, s] of Object.entries(params)) {
    let v = user[k] !== undefined && user[k] !== null ? user[k] : s.default;
    if (s.type === 'range') {
      v = Number(v); if (!Number.isFinite(v)) v = s.default;
      if (s.step) v = Math.round((v - s.min) / s.step) * s.step + s.min;
      v = +Math.min(s.max, Math.max(s.min, v)).toFixed(6);
    } else if (s.type === 'choice') { if (!s.options.includes(v)) v = s.default; }
    else if (s.type === 'toggle') v = v === true || v === 'true' || v === 1;
    else if (s.type === 'text') v = String(v).slice(0, s.maxLength || 24);
    else if (s.type === 'color') { if (hexOf(v) === null) v = s.default; }
    p[k] = v;
  }
  return p;
}

/** Non-indexed, uv/normal stripped, flat vertex colour. Pass hex = null to keep an existing per-vertex colour attribute. */
function prep(geo, hex) {
  if (geo.index) geo = geo.toNonIndexed();
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  if (hex === null && geo.attributes.color) return geo;
  const c = new THREE.Color(hex ?? 0x808080);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3]     = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

const MAT = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide
});
const GLASS_MAT = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: true, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false
});
MAT.name = 'solid';
GLASS_MAT.name = 'glass';

/** Bucket → mesh. merge = true: one Mesh (one draw call). merge = false: a Group of individually selectable Meshes. */
function finish(list, material = MAT, name = 'solid', merge = true) {
  if (list.length === 0) return null;
  if (merge) {
    const merged = mergeGeometries(list.map(p => prep(p.g, p.c)));
    if (!merged) return null;
    merged.computeVertexNormals();
    const m = new THREE.Mesh(merged, material);
    m.name = name; m.castShadow = true; m.receiveShadow = true;
    return m;
  } else {
    const g = new THREE.Group();
    g.name = name;
    list.forEach((p, i) => {
      const geo = prep(p.g, p.c);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, material);
      m.name = `${name}_${p.n || 'part'}_${i + 1}`;
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    });
    return g;
  }
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
  return geo;
}

// 3D vector-oriented tube/wire helper (trusses, fences, ropes, chains, rails)
function addWire(parts, p1, p2, hex, r = 0.01, radialSegments = 5) {
  const v1 = new THREE.Vector3(...p1);
  const v2 = new THREE.Vector3(...p2);
  const dist = v1.distanceTo(v2);
  if (dist < 1e-5) return;
  const geo = new THREE.CylinderGeometry(r, r, dist, radialSegments);
  const mid = v1.clone().lerp(v2, 0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    v2.clone().sub(v1).normalize()
  );
  geo.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
  parts.push({ g: geo, c: hex });
}

/** Extrude a THREE.Shape (mouldings, arches, hulls, profiles) and optionally place it with a matrix. */
function addExtrusion(parts, shape, depth, hex, { bevel = 0, steps = 1, curveSegments = 10, matrix = null, n } = {}) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, steps, curveSegments, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2
  });
  if (matrix) geo.applyMatrix4(matrix);
  parts.push({ g: geo, c: hex, n });
  return geo;
}

/** Deterministic PRNG (mulberry32) — same seed, same model. */
function rng(seed = 1) {
  let a = (Math.floor(seed * 2654435761) >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, z, s = 0) {
  const h = Math.sin(x * 127.1 + z * 311.7 + s * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
/** Smooth value noise in [0,1]. */
function noise2(x, z, s = 0) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi, s), b = hash2(xi + 1, zi, s), c = hash2(xi, zi + 1, s), d = hash2(xi + 1, zi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Fractal noise in [0,1]. */
function fbm2(x, z, s = 0, oct = 4) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { sum += amp * noise2(x * f, z * f, s + i * 17); norm += amp; amp *= 0.5; f *= 2.03; }
  return sum / norm;
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

/** Linear-space colour blend of two hexes → THREE.Color (for per-vertex gradients). */
function mixC(a, b, t) {
  return new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, t)));
}
/** Per-vertex colour by callback, for gradients on solids (keep with prep(geo, null)). */
function tint(geo, fn) {
  if (geo.index) geo = geo.toNonIndexed();
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    c.set(fn(p.getX(i), p.getY(i), p.getZ(i)));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
/** One colour per triangle from its centroid → crisp faceted colouring (rocks, ice, coral). fn(cx, cy, cz, faceIndex) → hex. */
function faceTint(geo, fn) {
  if (geo.index) geo = geo.toNonIndexed();
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i + 2 < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    c.set(fn(x, y, z, i / 3));
    for (let k = 0; k < 3; k++) { col[(i + k) * 3] = c.r; col[(i + k) * 3 + 1] = c.g; col[(i + k) * 3 + 2] = c.b; }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** Faceted terrain grid. hFn(x,z) → y; colFn(cx, cy, cz, slope) → hex per triangle (one flat colour per facet). */
function heightField(w, d, nx, nz, hFn, colFn, cx = 0, cz = 0) {
  const H = new Float32Array((nx + 1) * (nz + 1));
  const X = (i) => cx - w / 2 + (i / nx) * w, Z = (j) => cz - d / 2 + (j / nz) * d;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) H[j * (nx + 1) + i] = hFn(X(i), Z(j));
  const pos = new Float32Array(nx * nz * 18), col = new Float32Array(nx * nz * 18);
  const c = new THREE.Color();
  let o = 0;
  const tri = (ax, ay, az, bx, by, bz, qx, qy, qz) => {
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az, e2x = qx - ax, e2y = qy - ay, e2z = qz - az;
    const nx_ = e1y * e2z - e1z * e2y, ny_ = e1z * e2x - e1x * e2z, nz_ = e1x * e2y - e1y * e2x;
    const slope = 1 - Math.abs(ny_) / (Math.hypot(nx_, ny_, nz_) || 1);
    c.set(colFn((ax + bx + qx) / 3, (ay + by + qy) / 3, (az + bz + qz) / 3, slope));
    pos[o] = ax; pos[o + 1] = ay; pos[o + 2] = az; pos[o + 3] = bx; pos[o + 4] = by; pos[o + 5] = bz; pos[o + 6] = qx; pos[o + 7] = qy; pos[o + 8] = qz;
    for (let k = 0; k < 3; k++) { col[o + k * 3] = c.r; col[o + k * 3 + 1] = c.g; col[o + k * 3 + 2] = c.b; }
    o += 9;
  };
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x0 = X(i), x1 = X(i + 1), z0 = Z(j), z1 = Z(j + 1);
      const a = H[j * (nx + 1) + i], b = H[j * (nx + 1) + i + 1], cc = H[(j + 1) * (nx + 1) + i + 1], dd = H[(j + 1) * (nx + 1) + i];
      if ((i + j) & 1) { tri(x0, a, z0, x0, dd, z1, x1, b, z0); tri(x1, b, z0, x0, dd, z1, x1, cc, z1); }
      else { tri(x0, a, z0, x0, dd, z1, x1, cc, z1); tri(x0, a, z0, x1, cc, z1, x1, b, z0); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/**
 * Diorama cut-away sides for a terrain grid: strata bands (soil · clay · rock) from the terrain edge down to baseY,
 * a bottom plate, and water cross-sections wherever the water level stands above the ground at the edge.
 * Edge samples use the same x/z stations as heightField(w, d, nx, nz) → watertight seams.
 */
function dioramaSkirt(solid, water, w, d, nx, nz, hFn, baseY, hexes, wlFn = null, waterHex = 0x2f7fa5, cx = 0, cz = 0) {
  const [hTop, hMid, hRock] = hexes;
  const sides = [
    { n: nx, at: (t) => [cx - w / 2 + t * w, cz + d / 2] },
    { n: nz, at: (t) => [cx + w / 2, cz + d / 2 - t * d] },
    { n: nx, at: (t) => [cx + w / 2 - t * w, cz - d / 2] },
    { n: nz, at: (t) => [cx - w / 2, cz - d / 2 + t * d] },
  ];
  const quad = (list, a, b, ya0, ya1, yb0, yb1, hex) => {
    if (ya1 - ya0 < 1e-4 && yb1 - yb0 < 1e-4) return;
    const v = [a[0], ya0, a[1], b[0], yb0, b[1], b[0], yb1, b[1], a[0], ya0, a[1], b[0], yb1, b[1], a[0], ya1, a[1]];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    list.push({ g, c: hex, n: 'skirt' });
    return g;
  };
  for (const s of sides) {
    for (let k = 0; k < s.n; k++) {
      const a = s.at(k / s.n), b = s.at((k + 1) / s.n);
      const ta = hFn(a[0], a[1]), tb = hFn(b[0], b[1]);
      const sa = ta - 0.45 - noise2(a[0] * 0.3, a[1] * 0.3, 3) * 0.5, sb = tb - 0.45 - noise2(b[0] * 0.3, b[1] * 0.3, 3) * 0.5;
      const ma = Math.max(baseY, ta - 1.8 - noise2(a[0] * 0.15, a[1] * 0.15, 5) * 1.6), mb = Math.max(baseY, tb - 1.8 - noise2(b[0] * 0.15, b[1] * 0.15, 5) * 1.6);
      quad(solid, a, b, Math.max(sa, baseY), ta, Math.max(sb, baseY), tb, hTop);
      quad(solid, a, b, Math.min(ma, Math.max(sa, baseY)), Math.max(sa, baseY), Math.min(mb, Math.max(sb, baseY)), Math.max(sb, baseY), hMid);
      quad(solid, a, b, baseY, Math.min(ma, Math.max(sa, baseY)), baseY, Math.min(mb, Math.max(sb, baseY)), hRock);
      if (wlFn && water) {
        const wa = wlFn(a[0], a[1]), wb = wlFn(b[0], b[1]);
        if (wa !== null && wb !== null && (wa > ta + 0.01 || wb > tb + 0.01)) {
          const g = quad([], a, b, ta, Math.max(ta, wa), tb, Math.max(tb, wb), 0);
          if (g) water.push({ g: waterify(g, () => ({ color: waterHex })), c: null, n: 'section' });
        }
      }
    }
  }
  const bot = new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2).translate(cx, baseY, cz);
  solid.push({ g: bot, c: hRock, n: 'base' });
}

// ─── GPU water: Gerstner swell, flow-advected streaks, ripples, rain rings, foam ────────────────
//   aFlow = (s: metres along flow, u: metres across, speed m/s, foam 0..1)
//   aWave = (ocean-wave weight, ripple weight, mode 0 surface|1 falling sheet|2 swirl|3 foam overlay|4 caustic overlay, standing bump m)
const WATER_GLSL = /* glsl */`
uniform float uTime;
uniform vec4 uWaves[4];
uniform float uWaveAmp;
uniform vec4 uRip[8];
uniform float uRipCount;
uniform vec3 uFoam;
uniform float uFoamAmt;
uniform float uRain;
uniform vec2 uStreak;
uniform vec2 uCap;
uniform vec3 uGlow;
uniform vec4 uHoleA[12];
uniform vec4 uHoleB[12];
uniform float uHoleCount;
varying vec4 vFlow;
varying vec4 vWave;
varying vec2 vLoc;
varying vec2 vRest;
varying float vCrest;
float wHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float wNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float wRipple(vec2 p, float t, float norm) {
  float h = 0.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= uRipCount) { break; }
    vec4 r = uRip[i];
    if (r.w <= 0.0) { continue; }
    float amp = mix(r.w, min(1.0, r.w * 50.0), norm);
    float d = length(p - r.xy);
    if (r.z < 0.0) {
      h += amp * sin(d * 4.2 - t * 5.5) * exp(-d / max(-r.z, 0.01));
    } else {
      float age = t - r.z;
      if (age < 0.0 || age > 2.6) { continue; }
      float front = d - age * 1.5;
      h += amp * sin(front * 7.5) * exp(-front * front * 2.2) * (1.0 - age / 2.6);
    }
  }
  return h;
}
float wRainRings(vec2 p, float t) {
  float acc = 0.0;
  vec2 c0 = floor(p);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = c0 + vec2(float(i), float(j));
      float h = wHash(c);
      if (h > uRain) { continue; }
      vec2 ctr = c + vec2(wHash(c + 3.7), wHash(c + 9.1));
      float life = fract(t * 1.1 + h * 13.0);
      float r = length(p - ctr);
      acc += (1.0 - smoothstep(0.0, 0.08, abs(r - life * 0.8))) * (1.0 - life);
    }
  }
  return acc;
}
`;
const WATER_VERT = /* glsl */`
vec4 wWorld = modelMatrix * vec4(position, 1.0);
float wCr = 0.0;
if (aWave.x > 0.0 && uWaveAmp > 0.0) {
  vec3 wD = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec4 wv = uWaves[i];
    if (wv.w <= 0.0) { continue; }
    float k = 6.2831853 / wv.w;
    float c = sqrt(9.81 / k);
    vec2 dir = normalize(wv.xy);
    float f = k * (dot(dir, wWorld.xz) - c * uTime);
    float a = wv.z / k * uWaveAmp;
    wD += vec3(dir.x * a * cos(f), a * sin(f), dir.y * a * cos(f));
    wCr += wv.z * uWaveAmp * sin(f);
  }
  transformed += inverse(mat3(modelMatrix)) * (wD * aWave.x);
}
if (aWave.y > 0.0 && uRipCount > 0.0) { transformed.y += wRipple(position.xz, uTime, 0.0) * aWave.y; }
transformed.y += aWave.w * (1.0 + 0.22 * sin(uTime * 3.6 + aFlow.x * 1.7 + aFlow.y * 2.3));
vFlow = aFlow; vWave = aWave; vLoc = position.xz; vRest = wWorld.xz; vCrest = wCr * aWave.x;
`;
const WATER_FRAG = /* glsl */`
for (int i = 0; i < 12; i++) {
  if (float(i) >= uHoleCount) { break; }
  vec4 hA = uHoleA[i]; vec4 hB = uHoleB[i];
  vec2 hd = vRest - hA.xy;
  if (hB.z > 0.5) { if (dot(hd, hd) < hB.x * hB.x) { discard; } }
  else { vec2 hl = vec2(hd.x * hA.z - hd.y * hA.w, hd.x * hA.w + hd.y * hA.z); if (abs(hl.x) < hB.x && abs(hl.y) < hB.y) { discard; } }
}
float wSp = vFlow.z;
float wMode = vWave.z;
vec2 wSc = (wMode > 0.5 && wMode < 1.5) ? uStreak * vec2(0.6, 1.7) : uStreak;
float wPat;
if (wMode > 1.5 && wMode < 2.5) {
  float ph1 = fract(uTime * 0.16);
  float ph2 = fract(uTime * 0.16 + 0.5);
  float wt = abs(2.0 * ph1 - 1.0);
  float a1 = wNoise(vec2((vFlow.x - wSp * ph1 * 6.0) * wSc.x, vFlow.y * wSc.y));
  float a2 = wNoise(vec2((vFlow.x - wSp * ph2 * 6.0) * wSc.x + 31.7, vFlow.y * wSc.y + 7.3));
  wPat = mix(a1, a2, wt);
} else {
  vec2 q = vec2((vFlow.x - wSp * uTime) * wSc.x, vFlow.y * wSc.y);
  wPat = wNoise(q) * 0.62 + wNoise(q * 2.6 + vec2(uTime * 0.11, uTime * 0.07)) * 0.38;
}
float wM = clamp(vFlow.w, 0.0, 1.0);
float wFoam = wM > 0.001 ? smoothstep(1.0 - wM - 0.04, 1.0 - wM + 0.04, wPat) : 0.0;
float wCap = smoothstep(uCap.x, uCap.y, vCrest + (wPat - 0.5) * (uCap.y - uCap.x) * 2.0);
float wRing = (vWave.y > 0.0 && uRipCount > 0.0) ? smoothstep(0.5, 0.85, wRipple(vLoc, uTime, 1.0)) * vWave.y : 0.0;
float wRn = (uRain > 0.0 && vWave.y > 0.0) ? wRainRings(vLoc * 2.6, uTime) * vWave.y : 0.0;
float wAll = clamp(max(max(wFoam, wCap), wRing * 0.8) + wRn * 0.75, 0.0, 1.0) * uFoamAmt;
diffuseColor.rgb *= 0.88 + 0.24 * wPat;
if (wMode > 3.5) {
  float wCau = 1.0 - smoothstep(0.0, 0.07, abs(wPat - 0.5));
  diffuseColor.rgb = uFoam;
  diffuseColor.a = wCau * opacity;
  wAll = wCau;
} else if (wMode > 2.5) {
  diffuseColor.rgb = uFoam;
  diffuseColor.a = wAll * opacity;
} else {
  diffuseColor.rgb = mix(diffuseColor.rgb, uFoam, wAll);
  diffuseColor.a = mix(diffuseColor.a, 1.0, wAll * 0.9);
}
totalEmissiveRadiance += uGlow * wAll;
`;

/**
 * Per-asset water material. Uniforms live on material.userData.uniforms:
 *   uTime · uWaves[4] (dirX, dirZ, steepness, wavelength m) · uWaveAmp · uRip[8] (x, z, t0 | -reach, amp) · uRipCount
 *   uFoam (colour) · uFoamAmt · uRain (0..1 rain-ring density) · uStreak (along, across streak frequency) · uGlow (foam emission)
 *   uCap (whitecap crest threshold lo, hi — lower it where shoaling waves should break)
 */
function makeWaterMaterial(o = {}) {
  const u = {
    uTime: { value: 0 },
    uWaves: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(1, 0, 0, 0)) },
    uWaveAmp: { value: o.waveAmp ?? 1 },
    uRip: { value: [0, 1, 2, 3, 4, 5, 6, 7].map(() => new THREE.Vector4(0, 0, -1, 0)) },
    uRipCount: { value: 0 },
    uFoam: { value: new THREE.Color(o.foam ?? 0xffffff) },
    uFoamAmt: { value: o.foamAmt ?? 1 },
    uRain: { value: o.rain ?? 0 },
    uStreak: { value: new THREE.Vector2(o.streakAlong ?? 0.35, o.streakAcross ?? 2.0) },
    uGlow: { value: new THREE.Color(0x000000) },
    uCap: { value: new THREE.Vector2(...(o.cap || [0.42, 0.62])) },
    uHoleA: { value: Array.from({ length: 12 }, () => new THREE.Vector4()) },
    uHoleB: { value: Array.from({ length: 12 }, () => new THREE.Vector4()) },
    uHoleCount: { value: 0 },
  };
  (o.waves || []).slice(0, 4).forEach((w, i) => u.uWaves.value[i].set(w[0], w[1], w[2], w[3]));
  (o.ripples || []).slice(0, 8).forEach((r, i) => u.uRip.value[i].set(r[0], r[1], r[2], r[3]));
  u.uRipCount.value = Math.min(8, (o.ripples || []).length);
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: o.roughness ?? 0.16, metalness: o.metalness ?? 0.04,
    transparent: true, opacity: o.opacity ?? 0.86, side: THREE.DoubleSide, depthWrite: o.depthWrite ?? true,
  });
  m.name = 'water';
  m.userData.uniforms = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aFlow;\nattribute vec4 aWave;\n' + WATER_GLSL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + WATER_VERT);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + WATER_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + WATER_FRAG);
  };
  return m;
}

/** Attach water attributes + per-vertex colour. f(x, y, z, s, u) → { s, u, speed, foam, ocean, ripple, mode, bump, color }. */
function waterify(geo, f) {
  if (geo.index) geo = geo.toNonIndexed();
  const pos = geo.attributes.position, n = pos.count, su = geo.userData.su;
  const A = new Float32Array(n * 4), W = new Float32Array(n * 4), col = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const s0 = su ? su[i * 2] : 0, u0 = su ? su[i * 2 + 1] : 0;
    const r = (f && f(pos.getX(i), pos.getY(i), pos.getZ(i), s0, u0)) || {};
    A[i * 4] = r.s ?? s0; A[i * 4 + 1] = r.u ?? u0; A[i * 4 + 2] = r.speed ?? 0; A[i * 4 + 3] = r.foam ?? 0;
    W[i * 4] = r.ocean ?? 0; W[i * 4 + 1] = r.ripple ?? 0; W[i * 4 + 2] = r.mode ?? 0; W[i * 4 + 3] = r.bump ?? 0;
    c.set(r.color ?? 0x2b6e8f);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('aFlow', new THREE.BufferAttribute(A, 4));
  geo.setAttribute('aWave', new THREE.BufferAttribute(W, 4));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** Triangulate between two point rows sorted by key → near-equilateral facets for offset ("hex") grids & rings. */
function zipRows(A, B, out, key = (p) => p[0]) {
  let i = 0, j = 0;
  const same = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) < 1e-9;
  while (i < A.length - 1 || j < B.length - 1) {
    const stepA = j >= B.length - 1 || (i < A.length - 1 && key(A[i + 1]) <= key(B[j + 1]));
    if (stepA) { if (!same(A[i], A[i + 1])) out.push(A[i], B[j], A[i + 1]); i++; }
    else { if (!same(B[j], B[j + 1])) out.push(A[i], B[j], B[j + 1]); j++; }
  }
}

/** Point triples → non-indexed geometry; horizontal facets are oriented to face +Y. Extra per-point fields 3,4 → userData.su. */
function triGeo(pts) {
  const n = pts.length, v = new Float32Array(n * 3), su = new Float32Array(n * 2);
  for (let t = 0; t < n; t += 3) {
    let a = pts[t], b = pts[t + 1], c = pts[t + 2];
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (ny < 0) { const tmp = b; b = c; c = tmp; }
    [a, b, c].forEach((p, k) => {
      v[(t + k) * 3] = p[0]; v[(t + k) * 3 + 1] = p[1]; v[(t + k) * 3 + 2] = p[2];
      su[(t + k) * 2] = p[3] ?? 0; su[(t + k) * 2 + 1] = p[4] ?? 0;
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.userData.su = su;
  return g;
}

/** Offset-row water grid in the XZ plane at height y (classic low-poly water facets). */
function waterGrid(w, d, nx, nz, y = 0, cx = 0, cz = 0) {
  const dx = w / nx, rows = [];
  for (let j = 0; j <= nz; j++) {
    const z = cz - d / 2 + (j / nz) * d, row = [];
    if (j & 1) {
      row.push([cx - w / 2, y, z]);
      for (let i = 0; i < nx; i++) row.push([cx - w / 2 + (i + 0.5) * dx, y, z]);
      row.push([cx + w / 2, y, z]);
    } else for (let i = 0; i <= nx; i++) row.push([cx - w / 2 + i * dx, y, z]);
    rows.push(row);
  }
  const tris = [];
  for (let j = 0; j < nz; j++) zipRows(rows[j], rows[j + 1], tris);
  return triGeo(tris);
}

/** Concentric-ring disc or annulus (pools, basins, fountains, vortices). pw > 1 packs rings toward the centre. */
function waterDisc(r, rings = 6, y = 0, cx = 0, cz = 0, r0 = 0, pw = 1) {
  const R = [];
  for (let i = 0; i <= rings; i++) {
    const f = Math.pow(i / rings, pw), rr = r0 + (r - r0) * f;
    const dr = Math.max(1e-3, (r - r0) * (f - Math.pow(Math.max(0, i - 1) / rings, pw)) || (r - r0) / rings);
    const n = rr < 1e-6 ? 1 : Math.max(8, Math.round((2 * Math.PI * rr) / Math.max(dr, (r - r0) / rings * 0.35)));
    const ring = [];
    for (let k = 0; k <= n; k++) { const a = (k / n) * Math.PI * 2; ring.push([cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr, a]); }
    R.push(ring);
  }
  const tris = [];
  for (let i = 0; i < rings; i++) zipRows(R[i], R[i + 1], tris, (p) => p[3]);
  return triGeo(tris.map((p) => [p[0], p[1], p[2]]));
}

/**
 * Ribbon along a centreline (rivers, channels, flumes, falling sheets). pts: [[x,y,z], ...];
 * half: number | (t, i) → half-width; across: optional fixed [x,y,z] across-vector (vertical sheets).
 * Each vertex carries s (arc length) and u (offset across) → waterify picks them up as flow coordinates.
 */
function waterRibbon(pts, half, nA = 6, across = null) {
  const n = pts.length, S = [0];
  for (let i = 1; i < n; i++) S.push(S[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  const L = S[n - 1] || 1, rows = [];
  for (let i = 0; i < n; i++) {
    let ax, ay = 0, az;
    if (across) { ax = across[0]; ay = across[1]; az = across[2]; }
    else {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[2] - a[2];
      const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      ax = -tz; az = tx;
    }
    const hw = typeof half === 'function' ? half(S[i] / L, i) : half;
    const row = [];
    for (let k = 0; k <= nA; k++) {
      const u = -hw + (2 * hw * k) / nA;
      row.push([pts[i][0] + ax * u, pts[i][1] + ay * u, pts[i][2] + az * u, S[i], u]);
    }
    rows.push(row);
  }
  const tris = [];
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < nA; k++) {
      const a = rows[i][k], b = rows[i][k + 1], c = rows[i + 1][k + 1], d = rows[i + 1][k];
      if ((i + k) & 1) tris.push(a, d, b, b, d, c); else tris.push(a, d, c, a, c, b);
    }
  }
  const g = triGeo(tris);
  g.userData.length = L;
  return g;
}

/**
 * Water-column cut-away walls around a waterGrid(w, d, nx, nz) tile: the top edge uses the very same vertices as the
 * surface edge (and the same wave weight), so it rides the swell; bands fade to yBot (number or (x,z) → y).
 */
function waterColumnSides(list, w, d, nx, nz, yTop, yBot, colFn, weightFn = () => 1, bands = 4, cx = 0, cz = 0) {
  const hw = w / 2, hd = d / 2, dx = w / nx, dz = d / nz;
  const rowX = (j) => ((j & 1)
    ? [-hw, ...Array.from({ length: nx }, (_, i) => -hw + (i + 0.5) * dx), hw]
    : Array.from({ length: nx + 1 }, (_, i) => -hw + i * dx));
  const edges = [
    rowX(0).map((x) => [x, -hd]), rowX(nz).map((x) => [x, hd]),
    Array.from({ length: nz + 1 }, (_, j) => [-hw, -hd + j * dz]), Array.from({ length: nz + 1 }, (_, j) => [hw, -hd + j * dz]),
  ].map((e) => e.map((q) => [q[0] + cx, q[1] + cz]));
  const yb = (x, z) => (typeof yBot === 'function' ? yBot(x, z) : yBot);
  for (const e of edges) {
    const v = [];
    for (let k = 0; k < e.length - 1; k++) {
      const A = e[k], B = e[k + 1], ya = yb(A[0], A[1]), yB = yb(B[0], B[1]);
      for (let b = 0; b < bands; b++) {
        const t0 = b / bands, t1 = (b + 1) / bands;
        const a0 = lerp(yTop, ya, t0), a1 = lerp(yTop, ya, t1), b0 = lerp(yTop, yB, t0), b1 = lerp(yTop, yB, t1);
        v.push(A[0], a0, A[1], B[0], b0, B[1], B[0], b1, B[1], A[0], a0, A[1], B[0], b1, B[1], A[0], a1, A[1]);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    list.push({ g: waterify(geo, (x, y, z) => ({ ocean: Math.abs(y - yTop) < 1e-4 ? weightFn(x, z) : 0, color: colFn(x, y, z) })), c: null, n: 'column' });
  }
}

/**
 * Cut-away water walls hung from the OPEN boundary edges of any waterify()-ed surface (discs, grids, clipped meshes).
 * Each wall's top vertices copy the surface's boundary vertices — position, aFlow and aWave — so the wall rides exactly
 * the same swell, ripples and standing bumps. yBot: number | (x, z) → y. keep(x, z): which boundary edges get a wall.
 */
function waterSkirt(list, wgeo, yBot, colFn, keep = null) {
  const p = wgeo.attributes.position, F = wgeo.attributes.aFlow, W = wgeo.attributes.aWave;
  const key = (i) => `${Math.round(p.getX(i) * 1000)},${Math.round(p.getY(i) * 1000)},${Math.round(p.getZ(i) * 1000)}`;
  const cnt = new Map(), edges = [];
  for (let t = 0; t + 2 < p.count; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = t + e, b = t + ((e + 1) % 3), ka = key(a), kb = key(b);
      if (ka === kb) continue;
      const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      cnt.set(k, (cnt.get(k) || 0) + 1);
      edges.push([a, b, k]);
    }
  }
  const yb = (x, z) => (typeof yBot === 'function' ? yBot(x, z) : yBot);
  const pos = [], fl = [], wv = [], col = [], c = new THREE.Color();
  const put = (i, y, top) => {
    const x = p.getX(i), z = p.getZ(i);
    pos.push(x, y, z);
    fl.push(F.getX(i), F.getY(i), top ? F.getZ(i) : 0, 0);
    wv.push(top ? W.getX(i) : 0, top ? W.getY(i) : 0, 0, top ? W.getW(i) : 0);
    c.set(colFn(x, y, z));
    col.push(c.r, c.g, c.b);
  };
  for (const [a, b, k] of edges) {
    if (cnt.get(k) !== 1) continue;
    const ax = p.getX(a), az = p.getZ(a), bx = p.getX(b), bz = p.getZ(b);
    if (keep && !keep((ax + bx) / 2, (az + bz) / 2)) continue;
    const ay = p.getY(a), by = p.getY(b), ya = Math.min(ay, yb(ax, az)), yB = Math.min(by, yb(bx, bz));
    if (ay - ya < 1e-3 && by - yB < 1e-3) continue;
    put(a, ay, true); put(b, by, true); put(b, yB, false);
    put(a, ay, true); put(b, yB, false); put(a, ya, false);
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(fl, 4));
  g.setAttribute('aWave', new THREE.Float32BufferAttribute(wv, 4));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  list.push({ g, c: null, n: 'water-wall' });
  return g;
}

// ─── GPU particles: each instance loops p = p0 + v·τ + ½gτ² (τ = time since spawn, wraps every `life` s) ────────
const EMIT_VERT = /* glsl */`
float pLife = max(aV0.w, 0.001);
float pTau = mod(uTime + aP0.w * pLife, pLife);
float pK = pTau / pLife;
float pOn = step(aPx.w, uEmit);
vec3 pV0 = aV0.xyz;
if (uCycle.x > 0.0) {
  float ph = fract((uTime - pTau) / uCycle.x);
  pOn *= step(ph, uCycle.y);
  float e = clamp(ph / max(uCycle.y, 0.001), 0.0, 1.0);
  pV0 *= mix(1.0 - uCycle.z, 1.0, sin(e * 3.14159));
}
vec3 pDisp = uDrag > 0.0 ? pV0 * (1.0 - exp(-uDrag * pTau)) / uDrag : pV0 * pTau;
vec3 pPos = aP0.xyz + pDisp + 0.5 * uGrav * pTau * pTau;
vec3 pVel = pV0 * exp(-uDrag * pTau) + uGrav * pTau;
pPos.x += sin(uTime * uSway.y + aPx.y * 6.2831) * uSway.x;
pPos.z += cos(uTime * uSway.y * 0.83 + aPx.y * 4.37) * uSway.x;
float pSc = aPx.x * mix(uGrow.x, uGrow.y, pK) * pOn;
if (uPulse > 0.5) { pSc *= min(1.0, sin(pK * 3.14159) * 1.6); }
if (pPos.y < uFloor) { pSc = 0.0; }
vec3 pL = transformed;
float pA = uTime * aPx.z + aPx.y * 6.2831;
pL.xz = mat2(cos(pA), -sin(pA), sin(pA), cos(pA)) * pL.xz;
if (uStretch > 0.0) {
  float sp = length(pVel);
  vec3 yA = sp > 1e-4 ? pVel / sp : vec3(0.0, 1.0, 0.0);
  vec3 xA = normalize(abs(yA.y) < 0.99 ? cross(yA, vec3(0.0, 1.0, 0.0)) : cross(yA, vec3(1.0, 0.0, 0.0)));
  vec3 zA = cross(xA, yA);
  pL = xA * pL.x + yA * pL.y * (1.0 + sp * uStretch) + zA * pL.z;
}
transformed = pL * pSc + pPos;
`;

/**
 * Particle system as one InstancedMesh (1 draw call). spawn(i, r) → { p:[x,y,z], v:[vx,vy,vz], life, size, spin }.
 * o: { count, shape: drop|streak|puff|cloud|flatcloud|flake|chunk|ring|bubble, color, opacity, gravity, grow:[a,b], stretch, sway:[amp,freq],
 *      floor, cycle:[period, duty, power], drag, emit, pulse (fade in/out over life), timeOffset, seed }. Live controls on mesh.userData.uniforms (uEmit, uCycle, ...).
 */
function makeEmitter(name, o) {
  const r = rng(o.seed ?? 7);
  let base;
  switch (o.shape) {
    case 'streak': base = new THREE.CylinderGeometry(0.5, 0.5, 1, 3, 1, true); break;
    case 'puff': base = new THREE.IcosahedronGeometry(1, 0); break;
    case 'cloud': base = new THREE.IcosahedronGeometry(1, 1); break;
    case 'flatcloud': base = new THREE.IcosahedronGeometry(1, 1).scale(1, 0.42, 1); break;
    case 'flake': base = new THREE.OctahedronGeometry(1, 0).scale(1, 0.3, 1); break;
    case 'chunk': base = new THREE.TetrahedronGeometry(1, 0); break;
    case 'ring': base = new THREE.TorusGeometry(1, 0.07, 3, 12).rotateX(Math.PI / 2); break;
    case 'bubble': base = new THREE.OctahedronGeometry(1, 1); break;
    default: base = new THREE.OctahedronGeometry(1, 0);
  }
  const geo = prep(base, o.color ?? 0xffffff);
  geo.computeVertexNormals();
  const n = Math.max(1, Math.floor(o.count));
  const P0 = new Float32Array(n * 4), V0 = new Float32Array(n * 4), PX = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const s = o.spawn(i, r);
    P0[i * 4] = s.p[0]; P0[i * 4 + 1] = s.p[1]; P0[i * 4 + 2] = s.p[2]; P0[i * 4 + 3] = s.phase ?? r();
    V0[i * 4] = s.v[0]; V0[i * 4 + 1] = s.v[1]; V0[i * 4 + 2] = s.v[2]; V0[i * 4 + 3] = s.life ?? 2;
    PX[i * 4] = s.size ?? 1; PX[i * 4 + 1] = r(); PX[i * 4 + 2] = s.spin ?? 0; PX[i * 4 + 3] = s.rank ?? r();
  }
  geo.setAttribute('aP0', new THREE.InstancedBufferAttribute(P0, 4));
  geo.setAttribute('aV0', new THREE.InstancedBufferAttribute(V0, 4));
  geo.setAttribute('aPx', new THREE.InstancedBufferAttribute(PX, 4));
  const u = {
    uTime: { value: 0 },
    uGrav: { value: new THREE.Vector3(...(o.gravity ?? [0, -9.81, 0])) },
    uGrow: { value: new THREE.Vector2(...(o.grow ?? [1, 1])) },
    uStretch: { value: o.stretch ?? 0 },
    uSway: { value: new THREE.Vector2(...(o.sway ?? [0, 0])) },
    uFloor: { value: o.floor ?? -1e6 },
    uCycle: { value: new THREE.Vector3(...(o.cycle ?? [0, 1, 0])) },
    uDrag: { value: o.drag ?? 0 },
    uEmit: { value: o.emit ?? 1 },
    uPulse: { value: o.pulse ? 1 : 0 },
  };
  const opacity = o.opacity ?? 1;
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: o.roughness ?? 0.35, metalness: 0,
    transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide,
  });
  mat.name = name;
  mat.userData.uniforms = u;
  mat.userData.timeOffset = o.timeOffset || 0;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aP0; attribute vec4 aV0; attribute vec4 aPx;
uniform float uTime; uniform vec3 uGrav; uniform vec2 uGrow; uniform float uStretch; uniform vec2 uSway;
uniform float uFloor; uniform vec3 uCycle; uniform float uDrag; uniform float uEmit; uniform float uPulse;`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + EMIT_VERT);
  };
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.uniforms = u;
  if (o.parent) mesh.userData.parent = o.parent;
  return mesh;
}

// ─── Wind / current flex for foliage, kelp, reeds, sails: vertices bend by height weight² ─────
/** o: { amp m, freq rad/s, dir:[x,z] }. Uniforms on material.userData.uniforms (uTime, uSway). */
function makeSwayMaterial(o = {}) {
  const u = {
    uTime: { value: 0 },
    uSway: { value: new THREE.Vector4(o.amp ?? 0.2, o.freq ?? 1.3, (o.dir || [1, 0.3])[0], (o.dir || [1, 0.3])[1]) },
  };
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82, metalness: 0, side: THREE.DoubleSide });
  m.name = 'sway';
  m.userData.uniforms = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aSway;\nuniform float uTime;\nuniform vec4 uSway;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
float swW = aSway.x * aSway.x;
vec2 swD = normalize(uSway.zw + vec2(1e-5));
float swA = sin(uTime * uSway.y + aSway.y) + 0.35 * sin(uTime * uSway.y * 2.3 + aSway.y * 1.7);
transformed.xz += (swD * swA + vec2(-swD.y, swD.x) * 0.3 * cos(uTime * uSway.y * 0.7 + aSway.y)) * uSway.x * swW;`);
  };
  return m;
}
/** Flex weight 0 at local y0 → 1 at y1, constant phase per plant. */
function swayify(geo, phase, y0, y1) {
  if (geo.index) geo = geo.toNonIndexed();
  const p = geo.attributes.position, a = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    a[i * 2] = Math.min(1, Math.max(0, (p.getY(i) - y0) / Math.max(1e-6, y1 - y0)));
    a[i * 2 + 1] = phase;
  }
  geo.setAttribute('aSway', new THREE.BufferAttribute(a, 2));
  return geo;
}

/** Unlit lamp/window material; setNight() raises its brightness. */
function makeGlowMaterial() {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  m.name = 'glow';
  m.color.setScalar(0.5);
  return m;
}

/** Outline of one opening (wall-local XY). Shared by the wall hole AND its glass pane → perfect fit, no z-fighting. */
function openingShape(o) {
  const s = new THREE.Shape(), y0 = o.y ?? 0, x0 = o.x - o.w / 2, x1 = o.x + o.w / 2, y1 = y0 + o.h;
  s.moveTo(x0, y0); s.lineTo(x1, y0);
  if (o.arch) { const r = o.w / 2; s.lineTo(x1, y1 - r); s.absarc(o.x, y1 - r, r, 0, Math.PI, false); }
  else { s.lineTo(x1, y1); s.lineTo(x0, y1); }
  s.lineTo(x0, y0);
  return s;
}
/**
 * Wall panel with REAL openings. Doors (y = 0) notch the outline; windows are holes. Optional gable peak.
 * Spans x ∈ [0, len], y ∈ [0, h (+gable)], z ∈ [0, thick] — place with a matrix.
 */
function wallGeo(len, h, thick, openings = [], gable = 0) {
  const s = new THREE.Shape();
  const doors = openings.filter((o) => (o.y ?? 0) <= 1e-3).sort((a, b) => a.x - b.x);
  s.moveTo(0, 0);
  for (const o of doors) {
    const x0 = o.x - o.w / 2, x1 = o.x + o.w / 2;
    s.lineTo(x0, 0);
    if (o.arch) { const r = o.w / 2; s.lineTo(x0, o.h - r); s.absarc(o.x, o.h - r, r, Math.PI, 0, true); }
    else { s.lineTo(x0, o.h); s.lineTo(x1, o.h); }
    s.lineTo(x1, 0);
  }
  s.lineTo(len, 0); s.lineTo(len, h);
  if (gable > 0) s.lineTo(len / 2, h + gable);
  s.lineTo(0, h); s.lineTo(0, 0);
  for (const o of openings) if ((o.y ?? 0) > 1e-3) s.holes.push(openingShape(o));
  return new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 10 });
}
/** Jambs, head (flat or arched), sill / threshold around one opening — wall-local coordinates, then mtx. */
function frameOpening(list, o, thick, hex, mtx = null, trim = 0.08) {
  const y0 = o.y ?? 0, x0 = o.x - o.w / 2, x1 = o.x + o.w / 2, y1 = y0 + o.h, d = thick + 0.05, zc = thick / 2;
  const push = (w, h, dd, x, y, z, n) => { const g = new THREE.BoxGeometry(w, h, dd).translate(x, y, z); if (mtx) g.applyMatrix4(mtx); list.push({ g, c: hex, n }); };
  const top = o.arch ? y1 - o.w / 2 : y1;
  push(trim, top - y0, d, x0 - trim / 2, (y0 + top) / 2, zc, 'jamb');
  push(trim, top - y0, d, x1 + trim / 2, (y0 + top) / 2, zc, 'jamb');
  if (o.arch) {
    const s = new THREE.Shape(), r0 = o.w / 2, r1 = r0 + trim;
    s.absarc(o.x, top, r1, 0, Math.PI, false); s.lineTo(o.x - r0, top);
    s.absarc(o.x, top, r0, Math.PI, 0, true); s.lineTo(o.x + r1, top);
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, zc - d / 2);
    if (mtx) g.applyMatrix4(mtx);
    list.push({ g, c: hex, n: 'arch-head' });
  } else push(o.w + trim * 2, trim * 1.4, d, o.x, y1 + trim * 0.7, zc, 'lintel');
  if (y0 > 0.01) push(o.w + trim * 2.6, trim, d + 0.1, o.x, y0 - trim / 2, zc, 'sill');
  else push(o.w, 0.04, d, o.x, 0.02, zc, 'threshold');
}
/** Glass pane filling an opening (same outline as the hole). */
function paneGeo(o, thick, mtx = null) {
  const g = new THREE.ShapeGeometry(openingShape(o), 8).translate(0, 0, thick / 2);
  if (mtx) g.applyMatrix4(mtx);
  return g;
}
/** Matrix placing wall-local coords: origin at (x, y, z), wall running along +x rotated by ry. */
function wallMtx(x, y, z, ry = 0) {
  return new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
}
/** Gabled roof: two slabs hinged at a ridge along x. */
function addGableRoof(list, w, d, rise, over, t, hex, cx, y0, cz) {
  const ang = Math.atan2(rise, d / 2), len = Math.hypot(d / 2, rise) + over;
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(w + over * 2, t, len).translate(0, t / 2, (s * len) / 2).rotateX(s * ang).translate(cx, y0 + rise, cz);
    list.push({ g, c: hex, n: 'roof' });
  }
}

/**
 * Make `mat` (this asset's water) ride another asset's swell: shares its live wave array and copies the amplitude.
 * src: a water material or any asset (its first 'water' material is used).
 */
function matchWavesFrom(mat, src) {
  if (!mat || !src) return false;
  let m = src.isMaterial ? src : null;
  if (!m && src.traverse) src.traverse((o) => { if (!m && o.material && o.material.name === 'water' && o.material.userData.uniforms) m = o.material; });
  if (!m || m === mat) return false;
  mat.userData.uniforms.uWaves.value = m.userData.uniforms.uWaves.value;
  mat.userData.uniforms.uWaveAmp.value = m.userData.uniforms.uWaveAmp.value;
  return true;
}

// ─── Embedding in composed scenes: standard river ends, closed shorelines, edge flanges, exposed ground, draping ───
/**
 * Standard river cross-section shared by every chainable reach, so the end of one reach meets the start of the next
 * exactly: a parabolic channel of width w, banks rising to 0.8 m above the water, then a 12 % valley-side slope.
 * u: signed distance across the flow from the centreline · wl: water level. Returns the ground height.
 */
function chainProfile(u, w, wl) {
  const a = Math.abs(u), hw = w / 2, dp = Math.min(1.6, 0.35 + w * 0.12);
  if (a < hw) return wl - dp * (1 - (a / hw) ** 2) + 0.06;
  if (a < hw + 2.5) return wl + 0.06 + 0.74 * smooth(hw, hw + 2.5, a);
  return wl + 0.8 + Math.min(a - hw - 2.5, 12) * 0.12;
}
/**
 * Blend a terrain function toward chainProfile over `len` metres at the chained ends.
 * o: { axis: 'x' | 'z' (flow axis), lo, hi (ends along that axis), c (centreline offset across), inlet: { w, wl }, outlet: { w, wl }, len }
 * The inlet sits at `lo`, the outlet at `hi`; each end is optional.
 */
function chainEnds(h, o) {
  const len = o.len ?? 10, c = o.c ?? 0, ax = o.axis === 'z';
  return (x, z) => {
    let y = h(x, z);
    const s = ax ? z : x, u = (ax ? x : z) - c;
    if (o.inlet) { const k = smooth(o.lo + len, o.lo + 0.6, s); if (k > 0) y = lerp(y, chainProfile(u, o.inlet.w, o.inlet.wl), k); }
    if (o.outlet) { const k = smooth(o.hi - len, o.hi - 0.6, s); if (k > 0) y = lerp(y, chainProfile(u, o.outlet.w, o.outlet.wl), k); }
    return y;
  };
}
/**
 * Close a water body at the tile border: the ground rises to `wl + 0.45` at every border (except the sides listed in
 * `open`: '-x', '+x', '-z', '+z'), so the water never meets the tile edge and the tile can sit in any terrain.
 */
function rimmed(h, w, d, wl, rim = 7, open = {}, cx = 0, cz = 0) {
  return (x, z) => {
    const y = h(x, z);
    let e = Infinity;
    if (!open['-x']) e = Math.min(e, x - (cx - w / 2));
    if (!open['+x']) e = Math.min(e, cx + w / 2 - x);
    if (!open['-z']) e = Math.min(e, z - (cz - d / 2));
    if (!open['+z']) e = Math.min(e, cz + d / 2 - z);
    if (e >= rim) return y;
    const t = Math.max(0, e) / rim;
    return Math.max(y, wl + 0.45 - 3.2 * t * t);
  };
}
/** Short vertical flange under the tile border (used instead of the diorama skirt): hides hairline seams against surrounding terrain. */
function edgeFlange(solid, w, d, nx, nz, hFn, hex, depth = 1.6, cx = 0, cz = 0) {
  const v = [];
  const sides = [
    { n: nx, at: (t) => [cx - w / 2 + t * w, cz + d / 2] }, { n: nz, at: (t) => [cx + w / 2, cz + d / 2 - t * d] },
    { n: nx, at: (t) => [cx + w / 2 - t * w, cz - d / 2] }, { n: nz, at: (t) => [cx - w / 2, cz - d / 2 + t * d] },
  ];
  for (const sd of sides) for (let k = 0; k < sd.n; k++) {
    const a = sd.at(k / sd.n), b = sd.at((k + 1) / sd.n), ta = hFn(a[0], a[1]), tb = hFn(b[0], b[1]);
    v.push(a[0], ta - depth, a[1], b[0], tb - depth, b[1], b[0], tb, b[1], a[0], ta - depth, a[1], b[0], tb, b[1], a[0], ta, a[1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  solid.push({ g, c: hex, n: 'flange' });
}
/** Diorama skirt when p.diorama is on, otherwise the thin flange — the common ending of every ground tile. */
function tileEdge(p, solid, water, w, d, nx, nz, hFn, baseY, hexes, wlFn = null, waterHex = 0x2f7fa5, cx = 0, cz = 0) {
  if (p.diorama) dioramaSkirt(solid, water, w, d, nx, nz, hFn, baseY, hexes, wlFn, waterHex, cx, cz);
  else edgeFlange(solid, w, d, nx, nz, hFn, hexes[1], 1.6, cx, cz);
}
/**
 * Ground descriptor for scenes: bounds [x0, z0, x1, z1] (local), heightAt(x, z) → top surface | null, colorAt(x, z) → THREE.Color.
 * o: { h, col (x, y, z, slope) → colour, w, d, cx, cz, top (optional height fn including ice / roofs etc.) }
 */
function makeGround(o) {
  const x0 = (o.cx || 0) - o.w / 2, z0 = (o.cz || 0) - o.d / 2, x1 = x0 + o.w, z1 = z0 + o.d, top = o.top || o.h;
  const inside = (x, z) => x >= x0 - 1e-6 && x <= x1 + 1e-6 && z >= z0 - 1e-6 && z <= z1 + 1e-6;
  const c = new THREE.Color();
  return {
    bounds: [x0, z0, x1, z1],
    heightAt: (x, z) => (inside(x, z) ? top(x, z) : null),
    colorAt: (x, z) => {
      if (!o.col) return null;
      const e = 0.6, y = top(x, z), gx = (top(x + e, z) - top(x - e, z)) / (2 * e), gz = (top(x, z + e) - top(x, z - e)) / (2 * e);
      return c.set(o.col(x, y, z, 1 - 1 / Math.sqrt(1 + gx * gx + gz * gz))).clone();
    },
  };
}
/**
 * Anchor tagging for drapeable dressing: everything pushed into a sub's buckets since `anchorMark(sub)` gets an
 * aAnchor attribute = idx, so drapeGroup can move each tree / rock / reed clump as one rigid piece after merging.
 */
function anchorMark(b) { return BUCKETS_ALL.map((k) => b[k].length); }
function anchorTag(b, mark, idx) {
  BUCKETS_ALL.forEach((k, j) => {
    for (let i = mark[j]; i < b[k].length; i++) {
      const geo = b[k][i].g, n = geo.attributes.position.count;
      geo.setAttribute('aAnchor', new THREE.BufferAttribute(new Float32Array(n).fill(idx), 1));
    }
  });
}
const BUCKETS_ALL = ['solid', 'glass', 'glow', 'water', 'foam', 'sway'];
/**
 * Conform an asset to terrain: every vertex is lifted by H(world x, z) − (asset origin height). With anchors (local
 * [x, z, kind?]) tagged geometry (aAnchor) moves rigidly with its anchor; untagged vertices follow the nearest anchor.
 * keep(worldX, worldZ, groundY, kind) → false collapses that anchor's geometry (a tree that would stand in water, a reed
 * clump on dry ground). Returns the number of anchors kept.
 */
function drapeGroup(g, H, anchors = null, keep = null) {
  g.updateMatrixWorld(true);
  const Y = g.matrixWorld.elements[13], inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), v = new THREE.Vector3(), w = new THREE.Vector3();
  const aw = anchors ? anchors.map((a) => {
    w.set(a[0], 0, a[1]).applyMatrix4(g.matrixWorld);
    const hy = H(w.x, w.z), ok = !keep || hy === null || keep(w.x, w.z, hy, a[2]);
    return [a[0], a[1], hy === null ? 0 : hy - Y, ok];
  }) : null;
  const nearest = (lx, lz) => { let best = 0, bd = Infinity; for (let i = 0; i < aw.length; i++) { const d = (aw[i][0] - lx) ** 2 + (aw[i][1] - lz) ** 2; if (d < bd) { bd = d; best = i; } } return best; };
  const offAt = (lx, lz, wx, wz) => {
    if (aw) return aw[nearest(lx, lz)][2];
    const hy = H(wx, wz);
    return hy === null ? 0 : hy - Y;
  };
  g.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    if (o.isInstancedMesh) {
      if (o.frustumCulled === false) return; // GPU-animated emitters stay put
      const m = new THREE.Matrix4();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m); v.setFromMatrixPosition(m).applyMatrix4(o.matrixWorld);
        const l = v.clone().applyMatrix4(inv), dy = offAt(l.x, l.z, v.x, v.z);
        m.elements[13] += dy; o.setMatrixAt(i, m);
      }
      o.instanceMatrix.needsUpdate = true;
      return;
    }
    const pos = o.geometry.attributes.position, tag = o.geometry.attributes.aAnchor, toG = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const sy = Math.max(1e-6, toG.elements[5]);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const l = v.clone().applyMatrix4(inv);
      const ai = aw ? (tag ? Math.min(aw.length - 1, Math.max(0, Math.round(tag.getX(i)))) : nearest(l.x, l.z)) : -1;
      if (ai >= 0 && !aw[ai][3]) {
        // collapse onto the anchor point: zero-area triangles draw nothing
        w.set(aw[ai][0], 0, aw[ai][1]).applyMatrix4(g.matrixWorld).applyMatrix4(new THREE.Matrix4().copy(o.matrixWorld).invert());
        pos.setXYZ(i, w.x, w.y, w.z);
        continue;
      }
      const dy = ai >= 0 ? aw[ai][2] : offAt(l.x, l.z, v.x, v.z);
      pos.setY(i, pos.getY(i) + dy / sy);
    }
    pos.needsUpdate = true;
    o.geometry.computeBoundingBox(); o.geometry.computeBoundingSphere();
    if (o.geometry.attributes.normal) o.geometry.computeVertexNormals();
  });
  return aw ? aw.filter((a) => a[3]).length : 0;
}

// ─── Assembly, rigs, animation hooks ────────────────────────────────────────────────────────
const BUCKETS = ['solid', 'glass', 'glow', 'water', 'foam', 'sway'];

/** Geometry bag: static buckets + named sub-assemblies (rig / detach parts stay separate meshes, even when merged). */
function partsBag() {
  const mk = (name = null, pivot = [0, 0, 0], parent = null) => ({ name, pivot, parent, solid: [], glass: [], glow: [], water: [], foam: [], sway: [] });
  const bag = mk();
  bag.subs = {};
  bag.sub = (name, pivot = [0, 0, 0], parent = null) => bag.subs[name] || (bag.subs[name] = mk(name, pivot, parent));
  return bag;
}

/**
 * Foam / caustic overlays (water modes 3–4) share the water material's uniforms but never write depth and draw after
 * the water surface (renderOrder), so their transparent parts can't punch holes in the water beneath them.
 */
function makeFoamMaterial(wm) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: wm.roughness, metalness: wm.metalness,
    transparent: true, opacity: wm.opacity, side: THREE.DoubleSide, depthWrite: false,
  });
  m.name = 'water-foam';
  m.userData.uniforms = wm.userData.uniforms;
  m.onBeforeCompile = wm.onBeforeCompile;
  return m;
}

function assemble(g, bag, mats, merge) {
  const route = (b) => {
    b.water = b.water.filter((it) => {
      const w = it.g.attributes.aWave;
      if (w && w.count && w.getZ(0) > 2.5) { b.foam.push(it); return false; }
      return true;
    });
  };
  route(bag);
  for (const b of Object.values(bag.subs)) route(b);
  const put = (parent, b, prefix, off) => {
    for (const key of BUCKETS) {
      const list = b[key];
      if (!list.length) continue;
      if (!mats[key]) throw new Error(`"${key}" geometry present but no ${key} material supplied`);
      for (const it of list) {
        if (off) it.g.translate(-off[0], -off[1], -off[2]);
        if ((key === 'water' || key === 'foam') && !it.g.attributes.aFlow) throw new Error('water geometry must be waterify()-ed');
        if (key === 'sway' && !it.g.attributes.aSway) throw new Error('sway geometry must be swayify()-ed');
      }
      const m = finish(list, mats[key], prefix ? `${prefix}_${key}` : key, merge);
      if (!m) continue;
      if (key !== 'solid' && key !== 'sway') m.traverse((o) => { o.castShadow = false; });
      if (key === 'foam') m.traverse((o) => { o.renderOrder = 2; });
      parent.add(m);
    }
  };
  put(g, bag, null, null);
  const nodes = {};
  for (const b of Object.values(bag.subs)) {
    const pv = new THREE.Group();
    pv.name = b.name;
    pv.position.set(b.pivot[0], b.pivot[1], b.pivot[2]);
    put(pv, b, b.name, b.pivot);
    nodes[b.name] = pv;
    g.add(pv);
  }
  for (const b of Object.values(bag.subs)) {
    const pv = nodes[b.name], pb = b.parent && bag.subs[b.parent];
    if (pb) { nodes[b.parent].add(pv); pv.position.set(b.pivot[0] - pb.pivot[0], b.pivot[1] - pb.pivot[1], b.pivot[2] - pb.pivot[2]); }
    pv.userData.rest = pv.position.clone();
  }
}

/** Drive a rig channel: rotate (degrees, default), translate (metres) or scale along `axis`. */
function applyRig(g, name, v, cache = {}) {
  const r = rig[name];
  const o = cache[name] || (cache[name] = g.getObjectByName(name));
  if (!r || !o) return;
  const ax = r.axis || 'y';
  if (r.type === 'translate') o.position[ax] = (o.userData.rest ? o.userData.rest[ax] : 0) + v;
  else if (r.type === 'scale') o.scale[ax] = Math.max(1e-4, v);
  else o.rotation[ax] = (v * Math.PI) / 180;
  g.userData.rigValues[name] = v;
}

function countTriangles(root) {
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const geo = o.geometry, tris = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    n += o.isInstancedMesh ? tris * o.count : tris;
  });
  return Math.round(n);
}

/**
 * Build meshes from the bag and wire the runtime API onto g.userData:
 *   update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles · rigValues
 * x: { waterMat, swayMat, glowMat, emitters: [InstancedMesh], objects: [Object3D (userData.parent = sub name)], timed: [Material], tick(t, dt, drive), onNight(k), ports }
 */
function finalize(g, bag, p, C, x = {}) {
  const mats = { solid: MAT, glass: GLASS_MAT, glow: x.glowMat || null, water: x.waterMat || null, foam: x.waterMat ? makeFoamMaterial(x.waterMat) : null, sway: x.swayMat || null };
  assemble(g, bag, mats, p.mergeForProduction);
  for (const e of x.emitters || []) (g.getObjectByName(e.userData.parent || '') || g).add(e);
  for (const o of x.objects || []) (g.getObjectByName(o.userData.parent || '') || g).add(o);
  const timed = [mats.water, mats.sway, ...(x.emitters || []).map((e) => e.material), ...(x.timed || [])]
    .filter((m) => m && m.userData && m.userData.uniforms && m.userData.uniforms.uTime);
  const manual = {}, cache = {};
  const drive = (name, v) => { if (!(name in manual)) applyRig(g, name, v, cache); };
  g.userData.params = p;
  g.userData.zones = C;
  g.userData.rigValues = {};
  g.userData.setRig = (name, v) => {
    if (v === null || v === undefined) delete manual[name];
    else { manual[name] = v; applyRig(g, name, v, cache); }
  };
  g.userData.setNight = (k) => {
    k = Math.min(1, Math.max(0, +k || 0));
    g.userData.nightLevel = k;
    if (mats.glow) mats.glow.color.setScalar(0.45 + 1.15 * k);
    if (x.onNight) x.onNight(k);
  };
  let last = null;
  g.userData.time = 0;
  g.userData.update = (t = performance.now() / 1000) => {
    const dt = last === null ? 0 : Math.min(0.1, Math.max(0, t - last));
    last = t; g.userData.time = t;
    for (const m of timed) m.userData.uniforms.uTime.value = t + (m.userData.timeOffset || 0);
    if (x.tick) x.tick(t, dt, drive);
  };
  if (x.ports) g.userData.ports = x.ports;
  if (x.ground) g.userData.ground = makeGround(x.ground);
  if (mats.water) g.userData.matchWaves = (src) => matchWavesFrom(mats.water, src);
  if (x.drape) g.userData.drape = (H, keep) => drapeGroup(g, H, Array.isArray(x.drape) ? x.drape : null, keep);
  if (mats.water) {
    // addRipple(worldX, worldZ, t, amp): other assets (boats, birds, whales) ring this water; uses the slots the asset leaves free
    const U = mats.water.userData.uniforms, base = U.uRipCount.value, v = new THREE.Vector3(), inv = new THREE.Matrix4();
    let nxt = 0;
    g.userData.addRipple = (wx, wz, t = g.userData.time, amp = 0.03) => {
      const free = 8 - base, slot = free > 0 ? base + (nxt++ % free) : 7;
      g.updateWorldMatrix(true, false);
      v.set(wx, 0, wz).applyMatrix4(inv.copy(g.matrixWorld).invert());
      U.uRip.value[slot].set(v.x, v.z, t, amp);
      U.uRipCount.value = Math.max(U.uRipCount.value, slot + 1);
    };
    // setHoles([{ x, z, w, d, yaw } | { x, z, r }]): world-space cut-outs where another asset brings its own water
    g.userData.setHoles = (list = []) => {
      const n = Math.min(12, list.length);
      for (let i = 0; i < n; i++) {
        const q = list[i], a = q.yaw || 0;
        U.uHoleA.value[i].set(q.x, q.z, Math.cos(a), Math.sin(a));
        U.uHoleB.value[i].set(q.r !== undefined ? q.r : q.w / 2, q.r !== undefined ? q.r : q.d / 2, q.r !== undefined ? 1 : 0, 0);
      }
      U.uHoleCount.value = n;
    };
  }
  g.userData.triangles = countTriangles(g);
  g.userData.setNight(0);
  g.userData.update(0);
  return g;
}

/** World-space water sampler other assets can float on: fn(localX, localZ, t, worldX, worldZ) → local water height | null. */
function makeSurface(g, fn) {
  const inv = new THREE.Matrix4(), v = new THREE.Vector3();
  return {
    heightAt(wx, wz, t = g.userData.time || 0) {
      g.updateWorldMatrix(true, false);
      inv.copy(g.matrixWorld).invert();
      v.set(wx, 0, wz).applyMatrix4(inv);
      const h = fn(v.x, v.z, t, wx, wz);
      if (h === null || h === undefined || !Number.isFinite(h)) return null;
      v.y = h;
      v.applyMatrix4(g.matrixWorld);
      return v.y;
    },
  };
}
/** Forward a ripple at asset-local (x, z) to the water the asset sits on: a scene sets g.userData.onWaterEvent(wx, wz, t, amp). */
function fireRipple(g, x, z, t, amp) {
  const cb = g.userData.onWaterEvent;
  if (typeof cb !== 'function') return;
  g.updateWorldMatrix(true, false);
  const v = new THREE.Vector3(x, 0, z).applyMatrix4(g.matrixWorld);
  cb(v.x, v.z, t, amp);
}
/** Vertical part of the Gerstner swell at world (wx, wz) — the water shader's own maths, for floating objects. */
function swellAt(waves, wx, wz, t, amp = 1) {
  let y = 0;
  for (const w of waves) {
    if (!(w[3] > 0)) continue;
    const k = (2 * Math.PI) / w[3], c = Math.sqrt(9.81 / k), l = Math.hypot(w[0], w[1]) || 1;
    y += (w[2] / k) * amp * Math.sin(k * ((w[0] / l) * wx + (w[1] / l) * wz - c * t));
  }
  return y;
}

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'dam-spillway';
  const P = partsBag();
  const H = p.height, Ld = p.crestLength, Ws = Math.min(p.spillwayWidth, Ld * 0.6), r = rng(p.seed);
  const Lx = H * 5.5 + 40, Wv = Ld + 20, crestW = 6, base = crestW + 0.75 * H;
  const yR = H * p.reservoirLevel, spillCrest = H - 3, yT = 1.2;
  const archX = (z) => -p.arch * Ld * 0.18 * (1 - Math.min(1, (2 * z / Ld) ** 2));
  const xU = (z) => archX(z) - 0.06 * H;
  const valley = (x, z) => { const az = Math.abs(z); return Math.max(0, (az - 8) * (H * 1.25) / (Ld / 2 - 8)) * smooth(6, Ld / 2, az) + (fbm2(x * 0.04, z * 0.04, p.seed, 3) - 0.5) * 2; };
  const wOutC = p.outflowWidth, hwO = wOutC / 2, inW = p.inletWidth, yIn = yR + 0.5, xBasinEnd = archX(0) + base + 24;
  const h0 = (x, z) => {
    let y = valley(x, z);
    const az = Math.abs(z);
    if (x > archX(z) + base - 2 && x < archX(z) + base + 26 && az < Ws / 2 + 3) y = Math.min(y, -1.5);
    if (!p.chainEnds && x > archX(z) + base + 26 && az < hwO + 0.5) y = Math.min(y, lerp(-0.8, y, smooth(hwO - 1.5, hwO + 0.5, az)));
    return y;
  };
  // Standard ends: the valley floor climbs out of the lake to a feeder stream; below the basin the river runs in the shared section.
  const yF = (x) => (yR + 1.2) * smooth(xU(0) - 6, -Lx / 2 + 6, x);
  let xS = xU(0) - 6; for (let lo = -Lx / 2 + 6, hi = xU(0) - 6, i = 0; i < 40; i++) { xS = (lo + hi) / 2; if (yF(xS) > yR) lo = xS; else hi = xS; }
  const wlS = (x) => lerp(yIn, yR + 0.02, smooth(-Lx / 2, xS + 2, x));
  const pzH = Ws / 2 + 9, pxH = archX(pzH) + base - 1 + 16;
  const h1 = (x, z) => {
    const az = Math.abs(z);
    let y = h0(x, z);
    if (x < xU(0)) {
      y = Math.max(y, yF(x) + 0.05 * Math.max(0, az - 6));
      if (x < xS + 6) y = lerp(Math.min(y, chainProfile(z, inW, wlS(x))), y, smooth(inW / 2 + 6, inW / 2 + 12, az));
    }
    if (x > xBasinEnd) y = lerp(y, Math.max(az < hwO + 2.5 ? -Infinity : y, chainProfile(z, wOutC, yT)), smooth(xBasinEnd, xBasinEnd + 10, x));
    if (p.powerhouse) { const d = Math.max(pxH - 1 - x, x - pxH - 14, hwO - 1 - z, z - pzH - 4.5); y = lerp(Math.min(y, yT - 1.2), y, smooth(0, 2, d)); }
    return y;
  };
  const h = p.chainEnds ? chainEnds(h1, { axis: 'x', lo: -Lx / 2, hi: Lx / 2, inlet: { w: inW, wl: yIn }, outlet: { w: wOutC, wl: yT } }) : h0;
  const nx = Math.round(Lx / 1.2), nz = Math.round(Wv / 1.2);
  const terrainCol = (x, y, z, sl) => (sl > 0.5 ? C.rock : y < 0.5 || (x < archX(z) && y < yR + 0.35 && y > yR - 2.5) ? C.soil : noise2(x * 0.1, z * 0.1, p.seed) > 0.5 ? C.grass : C.grassDark);
  P.solid.push({ g: heightField(Lx, Wv, nx, nz, h, terrainCol), c: null, n: 'valley' });
  tileEdge(p, P.solid, P.water, Lx, Wv, nx, nz, h, Math.min(-4, -0.06 * H - 2), [C.grassDark, C.soil, C.rock], (x, z) => (x < archX(z) - 0.06 * H ? (p.chainEnds && x < xS ? (Math.abs(z) < inW / 2 + 0.4 ? wlS(x) : null) : h(x, z) < yR ? yR : null) : x > archX(0) + base && h(x, z) < yT ? yT : null), C.deep);
  // Dam body: lofted cross-section (vertical upstream face, 0.75:1 downstream batter), curved in plan
  const nS = 48, sections = [];
  for (let k = 0; k <= nS; k++) {
    const z = -Ld / 2 + (k / nS) * Ld, x0 = archX(z), inSpill = Math.abs(z) < Ws / 2, top = inSpill ? spillCrest : H, bot = Math.min(0, valley(x0, z)) - 2;
    sections.push([[x0 - 0.06 * H, bot, z], [x0, top, z], [x0 + crestW * (inSpill ? 0.5 : 1), top, z], [x0 + base, bot, z]]);
  }
  const dv = [];
  for (let k = 0; k < nS; k++) for (let i = 0; i < 4; i++) { const a = sections[k][i], b = sections[k][(i + 1) % 4], c = sections[k + 1][(i + 1) % 4], d = sections[k + 1][i]; dv.push(...a, ...b, ...c, ...a, ...c, ...d); }
  for (const k of [0, nS]) { const s = sections[k]; dv.push(...s[0], ...s[1], ...s[2], ...s[0], ...s[2], ...s[3]); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dv, 3));
  P.solid.push({ g: faceTint(dg, (x, y, z) => (Math.abs(z) < Ws / 2 && x > archX(z) + 1 ? C.concreteDark : Math.floor(y / 1.6) % 2 ? C.concrete : (noise2(z * 0.2, y * 0.3, p.seed) > 0.7 ? C.stain : C.concrete))), c: null, n: 'dam' });
  // Stilling basin walls + end sill
  const xb0 = archX(0) + base, basinL = 24;
  for (const s of [-1, 1]) P.solid.push({ g: new THREE.BoxGeometry(basinL, 4, 1).translate(xb0 + basinL / 2, 0.2, s * (Ws / 2 + 0.5)), c: C.concreteDark, n: 'training-wall' });
  P.solid.push({ g: new THREE.BoxGeometry(1, 1.6, Ws).translate(xb0 + basinL, -0.7, 0), c: C.concreteDark, n: 'end-sill' });
  for (let k = 0; k < 6; k++) P.solid.push({ g: new THREE.BoxGeometry(0.8, 0.9, 0.8).translate(xb0 + 6, -1.0, -Ws / 2 + (k + 0.5) * (Ws / 6)), c: C.concreteDark, n: 'baffle-block' });
  // Gate piers, radial gates, crest bridge, railings, lamps
  const nG = p.gates, gw = Ws / nG, glowMat = makeGlowMaterial(), lift = p.gateOpen * 3.2;
  for (let k = 0; k <= nG; k++) {
    const z = -Ws / 2 + k * gw, x0 = archX(z);
    P.solid.push({ g: new THREE.BoxGeometry(5, 7, 1.2).translate(x0 + 1.5, spillCrest + 3.5, z), c: C.concrete, n: 'pier' });
  }
  P.solid.push({ g: new THREE.BoxGeometry(4, 0.6, Ws + 1.2).translate(archX(0) + 2, H + 0.3 + 0.2, 0), c: C.concrete, n: 'crest-bridge' });
  for (let k = 0; k < nG; k++) {
    const zc = -Ws / 2 + (k + 0.5) * gw, gt = P.sub(`gate-${k + 1}`, [archX(zc), spillCrest, zc]);
    gt.solid.push({ g: new THREE.CylinderGeometry(4.2, 4.2, gw - 1.3, 12, 1, true, 4.1, 1.0).rotateX(Math.PI / 2).translate(archX(zc) + 3.4, spillCrest + 1.6, zc), c: C.gate, n: 'skin-plate' });
    for (const s of [-1, 1]) addWire(gt.solid, [archX(zc) + 3.4, spillCrest + 1.6, zc + s * (gw / 2 - 0.8)], [archX(zc) - 0.6, spillCrest + 2.0, zc + s * (gw / 2 - 0.8)], C.steel, 0.12, 4);
  }
  for (const s of [-1, 1]) {
    const pts = []; for (let k = 0; k <= nS; k++) { const z = -Ld / 2 + (k / nS) * Ld; pts.push([archX(z) + (s < 0 ? 0.2 : crestW - 0.2), H + 1.1, z]); }
    for (let k = 0; k < nS; k++) addWire(P.solid, pts[k], pts[k + 1], C.rail, 0.04, 4);
    for (let k = 0; k <= nS; k += 2) addWire(P.solid, [pts[k][0], H, pts[k][2]], pts[k], C.rail, 0.04, 4);
  }
  for (let k = 0; k <= 6; k++) {
    const z = -Ld / 2 + 4 + (k / 6) * (Ld - 8), x = archX(z) + crestW - 0.4;
    if (Math.abs(z) < Ws / 2 + 1) continue;
    addCylinder(P.solid, 0.06, 0.08, 4, 6, x, H + 2, z, 0, 0, 0, C.steel);
    P.glow.push({ g: new THREE.IcosahedronGeometry(0.22, 1).translate(x, H + 4.1, z), c: C.lamp, n: 'lamp' });
  }
  // Water: reservoir, spillway chute sheets (only under open gates), stilling basin jump, river
  const resW = Math.min(Ld, Wv);
  const gx0 = p.chainEnds ? xS - 3 : -Lx / 2 - 2, gx1 = archX(0) + 2;
  if (p.chainEnds) {
    const ip = []; for (let x = -Lx / 2; x <= xS + 3.01; x += 0.8) ip.push([x, wlS(x), 0]);
    P.water.push({ g: waterify(waterRibbon(ip, inW / 2 + 0.3, 4), (x, y, z, s, u) => ({ s, u, speed: 0.9 * (1 - 0.4 * (u / (inW / 2)) ** 2) * smooth(xS + 3, xS - 4, x) + 0.1, foam: 0.04, mode: 2, ripple: 1, color: mixC(C.water, C.deep, 0.25) })), c: null, n: 'feeder-stream' });
  }
  P.water.push({ g: waterify(waterGrid(gx1 - gx0, resW, Math.round((gx1 - gx0) / 1.6), Math.round(resW / 1.6), yR, (gx0 + gx1) / 2, 0), (x, y, z) => ({ s: x, u: z, speed: 0.15 + 0.6 * p.gateOpen * smooth(-30, 0, x) * (Math.abs(z) < Ws ? 1 : 0), foam: 0.01, ocean: 0.4, ripple: 1, mode: 2, color: mixC(C.water, C.deep, smooth(0, 15, yR - h(x, z))) })), c: null, n: 'reservoir' });
  const sf = P.sub('spillway-flow', [0, 0, 0]);
  if (p.gateOpen > 0) {
    for (let k = 0; k < nG; k++) {
      const zc = -Ws / 2 + (k + 0.5) * gw, x0 = archX(zc), pts = [];
      const face = (x) => spillCrest - Math.max(0, (x - x0 - crestW * 0.5) / 0.75);
      for (let i = 0; i <= 26; i++) { const x = lerp(x0 - 0.5, x0 + base, i / 26), y = x < x0 + crestW * 0.5 ? spillCrest + 0.35 * lift / 3.2 + 0.25 : face(x) + 0.35; pts.push([x, Math.max(y, 0.4), zc]); }
      sf.water.push({ g: waterify(waterRibbon(pts, gw / 2 - 0.6, 4), (x, y, z, s, u) => ({ s, u, speed: 3 + Math.sqrt(2 * 9.81 * Math.max(0, spillCrest - y)) * 0.6, mode: 2, foam: 0.25 + 0.5 * smooth(spillCrest - 2, 2, y) * p.gateOpen, color: mixC(C.water, C.foam, 0.25) })), c: null, n: 'chute' });
    }
  }
  const bp = []; for (let x = xb0 - 0.5; x <= Lx / 2 + 0.01; x += 1) bp.push([x, yT, 0]);
  P.water.push({
    g: waterify(waterRibbon(bp, (t) => (t < (basinL + 1) / (Lx / 2 - xb0) ? Ws / 2 : hwO), 8), (x, y, z, s, u) => {
      const jump = Math.exp(-Math.max(0, x - xb0 - 3) / (6 + 6 * p.gateOpen)) * p.gateOpen;
      return { s, u, speed: 1.2 + 3 * jump, foam: 0.05 + 0.9 * jump, bump: 0.5 * jump * Math.exp(-(((x - xb0 - 4) / 3) ** 2)), mode: 2, ripple: 1, color: mixC(C.water, C.deep, 0.3) };
    }),
    c: null, n: 'tailwater',
  });
  // Powerhouse (hollow: door + windows + floor), turbine outflow boils
  const emitters = [];
  if (p.powerhouse) {
    const pz = Ws / 2 + 9, pxb = archX(pz) + base - 1, pw = 16, pd = 10, ph = 9, tt = 0.4, phs = P.sub('powerhouse', [pxb + pw / 2, 0, pz]);
    const y0 = Math.max(0.5, h(pxb + pw / 2, pz));
    const door = { x: 3, w: 2.2, h: 3.2 }, wins = [0, 1, 2].map((k) => ({ x: 6.5 + k * 3, y: 4.5, w: 1.8, h: 3 }));
    const f = wallMtx(pxb, y0, pz + pd / 2, 0), b = wallMtx(pxb + pw, y0, pz - pd / 2, Math.PI), wl = wallMtx(pxb, y0, pz - pd / 2, -Math.PI / 2), wr = wallMtx(pxb + pw, y0, pz + pd / 2, Math.PI / 2);
    phs.solid.push({ g: wallGeo(pw, ph, tt, [door, ...wins]).applyMatrix4(f), c: C.wall, n: 'front' });
    phs.solid.push({ g: wallGeo(pw, ph, tt, wins).applyMatrix4(b), c: C.wall, n: 'back' });
    phs.solid.push({ g: wallGeo(pd, ph, tt, [{ x: pd / 2, y: 4.5, w: 2, h: 3 }]).applyMatrix4(wl), c: C.wall, n: 'end' });
    phs.solid.push({ g: wallGeo(pd, ph, tt, [{ x: pd / 2, y: 4.5, w: 2, h: 3 }]).applyMatrix4(wr), c: C.wall, n: 'end' });
    for (const [m, list] of [[f, [door, ...wins]], [b, wins], [wl, [{ x: pd / 2, y: 4.5, w: 2, h: 3 }]], [wr, [{ x: pd / 2, y: 4.5, w: 2, h: 3 }]]]) for (const o of list) {
      frameOpening(phs.solid, o, tt, C.concreteDark, m);
      if ((o.y ?? 0) > 0) { phs.glass.push({ g: paneGeo(o, tt, m), c: C.glass, n: 'pane' }); phs.glow.push({ g: paneGeo(o, tt * 0.3, m), c: C.lamp, n: 'window-glow' }); }
    }
    phs.solid.push({ g: new THREE.BoxGeometry(pw + 0.8, 0.5, pd + 0.8).translate(pxb + pw / 2, y0 + ph + 0.25, pz), c: C.roof, n: 'roof' });
    phs.solid.push({ g: new THREE.BoxGeometry(pw - 0.8, 0.2, pd - 0.8).translate(pxb + pw / 2, y0 + 0.1, pz), c: C.concreteDark, n: 'floor' });
    for (let k = 0; k < 3; k++) { phs.solid.push({ g: new THREE.CylinderGeometry(1.2, 1.4, 1.6, 12).translate(pxb + 4 + k * 4, y0 + 0.9, pz - 1), c: C.gate, n: 'generator' }); }
    const dd = P.sub('door', [pxb + door.x - door.w / 2, y0, pz + pd / 2 + tt / 2], 'powerhouse');
    dd.solid.push({ g: new THREE.BoxGeometry(door.w, door.h, 0.08).translate(pxb + door.x, y0 + door.h / 2, pz + pd / 2 + tt / 2), c: C.steel, n: 'door-leaf' });
    const outs = [0, 1, 2].map((k) => [pxb + pw + 0.5, pz - 2.5 + k * 2.5]);
    P.water.push({ g: waterify((p.chainEnds ? waterGrid(14, pz + 4.5 - hwO, 14, 12, yT, pxb + pw + 7, (pz + 4.5 + hwO) / 2) : waterGrid(14, 9, 14, 10, yT - 0.05, pxb + pw + 7, pz)), (x, y, z) => ({ s: x, u: z, speed: 2, foam: 0.7 * smooth(10, 0, x - pxb - pw), mode: 2, ripple: 1, color: mixC(C.water, C.deep, 0.2) })), c: null, n: 'tailrace' });
    emitters.push(makeEmitter('outflow', { count: 90, shape: 'drop', color: C.foam, floor: yT - 0.1, stretch: 0.04, seed: p.seed, spawn: (i, rr) => { const o = outs[i % 3]; return { p: [o[0], yT, o[1] + (rr() - 0.5) * 1.5], v: [2 + rr() * 2, 1 + rr() * 2, (rr() - 0.5)], life: 0.8, size: 0.08 + rr() * 0.08 }; } }));
  }
  if (p.gateOpen > 0) emitters.push(makeEmitter('spray', { count: Math.round(160 * p.gateOpen), shape: 'drop', color: C.foam, stretch: 0.04, floor: yT - 0.2, seed: p.seed + 1, spawn: (i, rr) => ({ p: [xb0 + 1 + rr() * 5, yT + 0.2, (rr() - 0.5) * Ws * 0.9], v: [1 + rr() * 3, 2 + rr() * 5, (rr() - 0.5) * 2], life: 1.3, size: 0.06 + rr() * 0.1 }) }));
  const waterMat = makeWaterMaterial({ waves: [[1, 0.3, 0.04, 8], [-0.3, 1, 0.03, 4]], opacity: 0.88, foam: C.foam, streakAlong: 0.25, streakAcross: 0.9, roughness: 0.1 });
  finalize(g, P, p, C, {
    waterMat, glowMat, emitters,
    tick: (t, dt, drive) => { for (let k = 0; k < nG; k++) drive(`gate-${k + 1}`, lift); },
    ports: { inlet: p.chainEnds ? { position: [-Lx / 2, yIn, 0], direction: [1, 0, 0], width: inW, level: yIn, s: 0 } : { position: [-Lx / 2, yR, 0], direction: [1, 0, 0], width: resW, level: yR, s: 0 }, outlet: { position: [Lx / 2, yT, 0], direction: [1, 0, 0], width: p.outflowWidth, level: yT, s: 0 } },
    ground: { h, col: terrainCol, w: Lx, d: Wv },
  });
  g.userData.view = { target: [archX(0) + base * 0.6, H * 0.35, 0], radius: Math.max(Ld, Lx) * 0.75 };
  g.userData.surface = makeSurface(g, (lx, lz) => (p.chainEnds && lx < xS + 2 && Math.abs(lz) < inW / 2 + 0.3 ? wlS(lx) : lx < archX(lz) - 0.1 ? (h(lx, lz) < yR ? yR : null) : lx > xb0 && h(lx, lz) < yT ? yT : null));
  return g;
}
export default createAsset;
