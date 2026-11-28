/*
 * WHALE (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A humpback, orca or blue whale on a long loop through open water, built from articulated body,
 * tail-stock and fluke segments that beat as it swims, with pectoral flippers, dorsal fin, ventral
 * grooves and markings per species. Its cycle: cruise at depth, rise until the back breaks the
 * surface, blow twice (misty spouts), arch and raise its flukes — water streaming off them — and
 * sound. In breach mode every other cycle it launches clear of the sea, twists and crashes back in
 * a ring of spray.
 *
 * QUICK START
 *   import { createAsset } from './whale.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   whale.userData.onWaterEvent = (x, z, t, a) => ocean.userData.addRipple(x, z, t, a);   // ring another asset's water
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | orca | blue | grey | arctic — Theme
 *   species             humpback | orca | blue — Species
 *   length              5–30 m (default 14) — Length
 *   behaviour           cruise | breach — Behaviour
 *   cycle               20–90 s (default 36) — Cycle
 *   speed               0.5–6 m/s (default 2.4) — Speed
 *   pathRadius          6–80 m (default 24) — Path Radius
 *   depth               2–30 m (default 7) — Cruise Depth
 *   swell               0–2.5 m (default 0.8) — Swell
 *   waterPatch          on/off (default on) — Water Patch
 *   back                colour (default #2a2e34) — Back Colour
 *   belly               colour (default #d8dce0) — Belly Colour
 *   groove              colour (default #9aa0a8) — Groove Colour
 *   fin                 colour (default #e8ecee) — Fin Colour
 *   fluke               colour (default #2a2e35) — Fluke Colour
 *   flukeUnder          colour (default #e4e8ea) — Fluke Under Colour
 *   eye                 colour (default #0a0a0a) — Eye Colour
 *   patch               colour (default #f4f4f0) — Patch Colour
 *   saddle              colour (default #8a9098) — Saddle Colour
 *   spout               colour (default #f4f8fa) — Spout Colour
 *   water               colour (default #1f6f8f) — Water Colour
 *   deep                colour (default #0c3a52) — Deep Colour
 *   foam                colour (default #f6fcff) — Foam Colour
 *   seabed              colour (default #3a4a50) — Seabed Colour
 *
 * SPECS  20,715 triangles at defaults, 6 materials, 11 draw calls when merged,
 *        70.4 x 15.5 x 70.4 m (W x H x D, real-world scale).
 * PARTS animate: tail (rotate x -30…30°), flukes (rotate x -40…40°), flipper-l (rotate z -30…30°),
 * flipper-r (rotate z -30…30°)
 *        detach: whale-body, water-patch
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.onWaterEvent(x, z, t, amp) hook · userData.surface · userData.matchWaves(asset)
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = {
  back: '#2a2e34', belly: '#d8dce0', groove: '#9aa0a8', fin: '#e8ecee', fluke: '#2a2e35', flukeUnder: '#e4e8ea', eye: '#0a0a0a', patch: '#f4f4f0', saddle: '#8a9098', spout: '#f4f8fa',
  water: '#1f6f8f', deep: '#0c3a52', foam: '#f6fcff', seabed: '#3a4a50',
};
export const COLORWAYS = {
  'default': { ...BASE },
  orca: { ...BASE, back: '#141416', belly: '#f4f4f1', groove: '#e8e8e6', fin: '#141417', fluke: '#141418', flukeUnder: '#f4f4f2', patch: '#f6f6f3', saddle: '#9aa0a8' },
  blue: { ...BASE, back: '#5a6a7a', belly: '#7a8a9a', groove: '#6a7a8a', fin: '#5a6a7b', fluke: '#4a5a6a', flukeUnder: '#6a7a8b', saddle: '#6a7a8c' },
  grey: { ...BASE, back: '#6a6a68', belly: '#8a8a86', groove: '#7a7a76', fin: '#6a6a69', fluke: '#5a5a58', flukeUnder: '#7a7a77', saddle: '#9a9a96' },
  arctic: { ...BASE, water: '#2a6a7a', deep: '#0f3440', seabed: '#4a5a5a' },
};
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  species: { type: 'choice', default: 'humpback', options: ['humpback', 'orca', 'blue'], label: 'Species', affects: 'geometry', describe: 'Body shape, fins and markings (with the Default theme, natural colours).' },
  length: { type: 'range', default: 14, min: 5, max: 30, step: 0.5, unit: 'm', label: 'Length', affects: 'geometry', describe: 'Body length.' },
  behaviour: { type: 'choice', default: 'breach', options: ['cruise', 'breach'], label: 'Behaviour', affects: 'geometry', describe: 'Surface-blow-dive cycles, or alternate those with full breaches.' },
  cycle: { type: 'range', default: 36, min: 20, max: 90, step: 1, unit: 's', label: 'Cycle', affects: 'geometry', describe: 'Seconds per dive cycle.' },
  speed: { type: 'range', default: 2.4, min: 0.5, max: 6, step: 0.1, unit: 'm/s', label: 'Speed', affects: 'geometry', describe: 'Swimming speed.' },
  pathRadius: { type: 'range', default: 24, min: 6, max: 80, step: 1, unit: 'm', label: 'Path Radius', affects: 'geometry', describe: 'Radius of the swimming loop.' },
  depth: { type: 'range', default: 7, min: 2, max: 30, step: 0.5, unit: 'm', label: 'Cruise Depth', affects: 'geometry', describe: 'Depth between surfacings.' },
  swell: { type: 'range', default: 0.8, min: 0, max: 2.5, step: 0.05, unit: 'm', label: 'Swell', affects: 'geometry', describe: 'Wave height of the preview water patch.' },
  waterPatch: { type: 'toggle', default: true, label: 'Water Patch', affects: 'geometry', describe: 'Own patch of ocean (turn off when placing in another water asset).' },
  ...zoneParams(),
};
export const rig = {
  tail: { axis: 'x', range: [-30, 30], describe: 'Tail-stock beat (+ = up).' },
  flukes: { axis: 'x', range: [-40, 40], describe: 'Fluke angle.' },
  'flipper-l': { axis: 'z', range: [-30, 30], describe: 'Left pectoral flipper.' },
  'flipper-r': { axis: 'z', range: [-30, 30], describe: 'Right pectoral flipper.' },
};
export const detach = ['whale-body', 'water-patch'];
export const night = {};
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

/** Tapered tube along a Catmull-Rom path (trunks, roots, kelp, pipes, horns). rFn(t ∈ [0,1]) → radius. */
function sweep(pts, rFn, radial = 6, segs = 12, caps = true) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2]))));
  const fr = curve.computeFrenetFrames(segs, false);
  const rings = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, c = curve.getPointAt(t), r = Math.max(0, rFn(t)), ring = [];
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      ring.push(c.clone().addScaledVector(fr.normals[i], Math.cos(a) * r).addScaledVector(fr.binormals[i], Math.sin(a) * r));
    }
    rings.push({ c, ring });
  }
  const v = [];
  const P = (q) => v.push(q.x, q.y, q.z);
  for (let i = 0; i < segs; i++) {
    for (let k = 0; k < radial; k++) {
      const a = rings[i].ring[k], b = rings[i].ring[(k + 1) % radial];
      const c = rings[i + 1].ring[(k + 1) % radial], d = rings[i + 1].ring[k];
      P(a); P(b); P(c); P(a); P(c); P(d);
    }
  }
  if (caps) {
    for (const [i, flip] of [[0, true], [segs, false]]) {
      const { c, ring } = rings[i];
      for (let k = 0; k < radial; k++) {
        const a = ring[k], b = ring[(k + 1) % radial];
        if (flip) { P(c); P(b); P(a); } else { P(c); P(a); P(b); }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
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

/**
 * Lofted boat hull, boat-local (+Z bow, +Y up, +X port, design waterline y = 0). Smooth sections from keel to sheer.
 * o: { len, beam, draft, freeboard, sheerRise, stern: 'transom' | 'pointed', transomBeam 0..1, tm (widest station 0..1), bowFine,
 *      fullness (2 round bilge … 6 boxy), vee (deadrise 0..1), rocker 0..1, flare 0..0.6, stations, ribs, thick,
 *      inner (open boat: inner shell + gunwale cap), deck: null | { y: 'sheer' | number, crown, cut(x, z) → true = hole },
 *      strakes (lapstrake shading), rubRail (radius), cols: { bottom, boot, hull, hullDark, inside, insideDark, trim, transom, deck } }
 * → { parts, halfW(t), sheer(t), keel(t), sec(t, j, inset), beamAt(t, y, inset), Z(t), T(z), nP }
 */
function boatHull(o) {
  const L = o.len, B = o.beam / 2, d = o.draft, fb = o.freeboard, nS = o.stations ?? 24, nP = o.ribs ?? 8, th = o.thick ?? 0.03;
  const tm = o.tm ?? 0.45, sb = o.stern === 'pointed' ? 0 : (o.transomBeam ?? 0.75), n = o.fullness ?? 2.6, cols = o.cols;
  const halfW = (t) => {
    if (t >= tm) { const u = (t - tm) / (1 - tm); return B * Math.pow(Math.max(0, 1 - u * u), o.bowFine ?? 0.55); }
    const u = (tm - t) / tm;
    return B * (sb + (1 - sb) * Math.pow(Math.max(0, 1 - u * u), 0.55));
  };
  const sheer = (t) => fb + (o.sheerRise ?? 0.12) * Math.pow(2 * t - 1, 2) * (t > 0.5 ? 1.4 : 0.8);
  const keel = (t) => { const u = Math.abs(2 * t - 1), rk = (o.rocker ?? 0.5) * (t < 0.5 && sb > 0 ? 0.3 : 1); return -d * (1 - rk * Math.pow(u, 2.2)); };
  const sec = (t, j, inset = 0) => {
    const w = Math.max(0, halfW(t) - inset), ys = sheer(t), yk = Math.min(ys - 0.01, keel(t) + inset), f = j / (nP - 1);
    const a = (f * Math.PI) / 2, s = Math.sin(a), c = Math.cos(a);
    let x = w * Math.pow(s, 2 / n), y = ys - (ys - yk) * Math.pow(Math.max(0, c), 2 / n);
    y += (o.vee ?? 0.2) * (x / Math.max(1e-6, B)) * (ys - yk) * 0.3 * (1 - f);
    x *= 1 + (o.flare ?? 0.1) * ((y - yk) / Math.max(1e-6, ys - yk) - 1);
    return [x, y];
  };
  const Z = (t) => (t - 0.5) * L, T = (z) => z / L + 0.5;
  const beamAt = (t, y, inset = 0) => {
    let prev = sec(t, 0, inset);
    if (y <= prev[1]) return 0;
    for (let k = 1; k <= 32; k++) {
      const q = sec(t, (k / 32) * (nP - 1), inset);
      if (y <= q[1]) return lerp(prev[0], q[0], (y - prev[1]) / Math.max(1e-6, q[1] - prev[1]));
      prev = q;
    }
    return prev[0];
  };
  const parts = [], col = new THREE.Color();
  const geoOf = (pos, cc) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (cc) g.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3)); return g; };
  const shell = (inset, colFn, name) => {
    const pos = [], cc = [];
    const P = (i, j, sg) => { const t = i / (nS - 1), q = sec(t, j, inset); return [sg * q[0], q[1], Z(t)]; };
    for (const sg of [1, -1]) for (let i = 0; i < nS - 1; i++) for (let j = 0; j < nP - 1; j++) {
      const a = P(i, j, sg), b = P(i + 1, j, sg), c2 = P(i + 1, j + 1, sg), e = P(i, j + 1, sg);
      col.set(colFn((a[1] + b[1] + c2[1] + e[1]) / 4, j, i));
      for (const q of sg > 0 ? [a, b, c2, a, c2, e] : [a, c2, b, a, e, c2]) { pos.push(q[0], q[1], q[2]); cc.push(col.r, col.g, col.b); }
    }
    parts.push({ g: geoOf(pos, cc), c: null, n: name });
  };
  shell(0, (y, j) => (y < -0.02 ? cols.bottom : y < (o.bootTop ?? 0.07) && cols.boot !== undefined ? cols.boot : o.strakes && j % 2 ? (cols.hullDark ?? cols.hull) : cols.hull), 'hull');
  if (o.inner) {
    shell(th, (y, j) => (o.strakes && j % 2 ? (cols.insideDark ?? cols.inside) : cols.inside), 'hull-inside');
    const pos = [];
    for (const sg of [1, -1]) for (let i = 0; i < nS - 1; i++) {
      const t0 = i / (nS - 1), t1 = (i + 1) / (nS - 1), o0 = sec(t0, nP - 1), o1 = sec(t1, nP - 1), i0 = sec(t0, nP - 1, th), i1 = sec(t1, nP - 1, th);
      pos.push(sg * o0[0], o0[1], Z(t0), sg * o1[0], o1[1], Z(t1), sg * i1[0], i1[1], Z(t1), sg * o0[0], o0[1], Z(t0), sg * i1[0], i1[1], Z(t1), sg * i0[0], i0[1], Z(t0));
    }
    parts.push({ g: geoOf(pos), c: cols.trim, n: 'gunwale' });
  }
  if (sb > 0) {
    const pos = [], strip = (inset, z) => {
      for (let j = 0; j < nP - 1; j++) { const a = sec(0, j, inset), b = sec(0, j + 1, inset); pos.push(a[0], a[1], z, b[0], b[1], z, -b[0], b[1], z, a[0], a[1], z, -b[0], b[1], z, -a[0], a[1], z); }
    };
    strip(0, Z(0));
    if (o.inner) {
      strip(th, Z(0) + th);
      const a = sec(0, nP - 1), b = sec(0, nP - 1, th);
      pos.push(a[0], a[1], Z(0), -a[0], a[1], Z(0), -b[0], b[1], Z(0) + th, a[0], a[1], Z(0), -b[0], b[1], Z(0) + th, b[0], b[1], Z(0) + th);
    }
    parts.push({ g: geoOf(pos), c: cols.transom ?? cols.hull, n: 'transom' });
  }
  if (o.rubRail) for (const sg of [1, -1]) {
    const pts = [];
    for (let i = 0; i < nS; i++) { const t = i / (nS - 1), q = sec(t, nP - 1); pts.push([sg * (q[0] + o.rubRail * 0.4), q[1] - o.rubRail * 0.6, Z(t)]); }
    parts.push({ g: sweep(pts, () => o.rubRail, 5, nS * 2, false), c: cols.trim, n: 'rub-rail' });
  }
  const dk = o.deck || { y: 'sheer' };
  const deckW = (t) => (dk.y === 'sheer' ? halfW(t) : beamAt(t, dk.y, th));
  const deckAt = (t, u) => { const w = deckW(t); return [u * w, (dk.y === 'sheer' ? sheer(t) : dk.y) + (dk.crown ?? 0) * w * (1 - u * u), Z(t)]; };
  if (o.deck) {
    // Deck: cut(uc, tc) drops grid quads (square openings on station lines); hole(t) → half-width fraction of a smooth opening
    const nD = 8, pos = [], cc = [];
    const quad = (a, b, c2, e, hex) => { col.set(hex); for (const q of [a, b, c2, a, c2, e]) { pos.push(q[0], q[1], q[2]); cc.push(col.r, col.g, col.b); } };
    const shade = (i, k) => (dk.plank && (i + k) % 2 ? (cols.deckDark ?? cols.deck) : cols.deck);
    for (let i = 0; i < nS - 1; i++) {
      const t0 = i / (nS - 1), t1 = (i + 1) / (nS - 1), h0 = dk.hole ? dk.hole(t0) : 0, h1 = dk.hole ? dk.hole(t1) : 0;
      if (h0 > 0 || h1 > 0) {
        for (const sg of [1, -1]) for (let k = 0; k < nD / 2; k++) {
          const f0 = k / (nD / 2), f1 = (k + 1) / (nD / 2);
          quad(deckAt(t0, sg * lerp(h0, 1, f0)), deckAt(t1, sg * lerp(h1, 1, f0)), deckAt(t1, sg * lerp(h1, 1, f1)), deckAt(t0, sg * lerp(h0, 1, f1)), shade(i, k));
        }
        continue;
      }
      for (let k = 0; k < nD; k++) {
        const u0 = (k / nD) * 2 - 1, u1 = ((k + 1) / nD) * 2 - 1;
        if (dk.cut && dk.cut((u0 + u1) / 2, (t0 + t1) / 2)) continue;
        quad(deckAt(t0, u0), deckAt(t1, u0), deckAt(t1, u1), deckAt(t0, u1), shade(i, k));
      }
    }
    parts.push({ g: geoOf(pos, cc), c: null, n: 'deck' });
  }
  return { parts, halfW, sheer, keel, sec, beamAt, deckAt, deckW, Z, T, nP, nS };
}

/**
 * Foam wake for a hull moving toward +Z at `speed` m/s: Kelvin-angle arms from the bow shoulders, a churned centre trail
 * from the stern and bow-wave collars along the sides (water mode 3 → foam overlay bucket).
 * o: { len, beam, speed, sideAt(z) → half-beam at the waterline, y, trail }
 */
function wakeParts(list, o) {
  const sp = o.speed;
  if (!(sp > 0.05)) return;
  const L = o.len, hb = o.beam / 2, y = o.y ?? 0.04, k = Math.min(1, sp / 4), trail = o.trail ?? Math.max(6, L * (1.5 + k * 3));
  const zs = -L / 2, zb = L / 2, wTrail = (t) => hb * 0.55 + t * trail * 0.07, pts = [];
  for (let i = 0; i <= 14; i++) pts.push([0, y, zs - (i / 14) * trail]);
  list.push({ g: waterify(waterRibbon(pts, wTrail, 4), (x, yy, z, s, u) => ({ s, u, speed: sp, foam: (0.25 + 0.6 * k) * Math.pow(Math.max(0, 1 - s / trail), 1.4) * (1 - 0.5 * Math.pow(Math.abs(u) / wTrail(s / trail), 2)), ocean: 1, mode: 3 })), c: null, n: 'wake-trail' });
  const ka = (19.47 * Math.PI) / 180, armL = trail * 0.85;
  for (const sg of [1, -1]) {
    const z0 = zb * 0.55, x0 = sg * (o.sideAt ? o.sideAt(z0) : hb * 0.4), ap = [];
    for (let i = 0; i <= 12; i++) { const dd = (i / 12) * armL; ap.push([x0 + sg * Math.sin(ka) * dd, y, z0 - Math.cos(ka) * dd]); }
    list.push({ g: waterify(waterRibbon(ap, (t) => 0.12 + t * armL * 0.05, 3), (x, yy, z, s, u) => ({ s, u, speed: sp * 0.8, foam: (0.15 + 0.55 * k) * Math.pow(Math.max(0, 1 - s / armL), 1.6), ocean: 1, mode: 3 })), c: null, n: 'wake-arm' });
  }
  if (o.sideAt) for (const sg of [1, -1]) {
    const cp = [];
    for (let i = 0; i <= 10; i++) { const z = zb * 0.95 - (i / 10) * L * 0.85; cp.push([sg * (o.sideAt(z) + 0.06), y, z]); }
    list.push({ g: waterify(waterRibbon(cp, 0.08 + 0.14 * k, 2), (x, yy, z, s) => ({ s, speed: sp, foam: 0.25 + 0.5 * k * Math.max(0, 1 - s / (L * 0.85)), ocean: 1, mode: 3 })), c: null, n: 'bow-wave' });
  }
}

/**
 * Cambered triangular sail: luff A → Bh (head), foot A → Cl (clew); belly = depth × chord toward unit vector nrm.
 * Carries aSway (leech flutters most) for the sway material.
 */
function sailGeo(A, Bh, Cl, depth, nrm, nU = 7, nV = 9, phase = 0) {
  const P = (u, v) => {
    const Lp = [lerp(A[0], Bh[0], v), lerp(A[1], Bh[1], v), lerp(A[2], Bh[2], v)], Rp = [lerp(Cl[0], Bh[0], v), lerp(Cl[1], Bh[1], v), lerp(Cl[2], Bh[2], v)];
    const ch = Math.hypot(Rp[0] - Lp[0], Rp[1] - Lp[1], Rp[2] - Lp[2]), b = depth * ch * 4 * u * (1 - u) * (1.15 - 0.3 * u);
    return [lerp(Lp[0], Rp[0], u) + nrm[0] * b, lerp(Lp[1], Rp[1], u) + nrm[1] * b, lerp(Lp[2], Rp[2], u) + nrm[2] * b];
  };
  const pos = [], sw = [];
  for (let j = 0; j < nV; j++) for (let i = 0; i < nU; i++) {
    const u0 = i / nU, u1 = (i + 1) / nU, v0 = j / nV, v1 = (j + 1) / nV;
    for (const [u, v] of [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]]) { const q = P(u, v); pos.push(q[0], q[1], q[2]); sw.push(u * (0.4 + 0.6 * (1 - v)), phase + v * 2.2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(sw, 2));
  return g;
}

/** Standard swell set (wave height H m) for floating-asset water patches. */
function patchWaves(H) {
  const st = (h, Lw) => Math.min(0.45, (h / 2) * ((2 * Math.PI) / Lw));
  return [[1, 0.25, st(H, 12), 12], [-0.3, 1, st(H / 3, 6.5), 6.5], [0.6, -0.8, st(H / 6, 3.7), 3.7]];
}
/**
 * Local water patch for previewing a floating asset on its own: swell disc + cut-away walls + floor.
 * Returns a surface sampler (assign to g.userData.waterSurface).
 */
function waterPatch(P, g, o) {
  const sea = waterify(waterDisc(o.r, Math.max(6, Math.round(o.r / 1.1)), 0, 0, 0, 0, 1), (x, y, z) => ({ s: x, u: z, speed: 0.4, foam: 0.03, ocean: 1, ripple: 1, color: mixC(o.water, o.deep, smooth(0, o.r, Math.hypot(x, z)) * 0.5) }));
  P.water.push({ g: sea, c: null, n: 'patch' });
  waterSkirt(P.water, sea, -o.depth, (x, y) => mixC(o.water, o.deep, smooth(0, -o.depth, y)));
  P.solid.push({ g: new THREE.CylinderGeometry(o.r, o.r, 0.2, 48).translate(0, -o.depth - 0.1, 0), c: o.floor, n: 'patch-floor' });
  return makeSurface(g, (lx, lz, t, wx, wz) => (Math.hypot(lx, lz) <= o.r ? swellAt(o.waves, wx, wz, t, o.mat ? o.mat.userData.uniforms.uWaveAmp.value : 1) : null));
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
  const sp = p.species, cw = p.colorway === 'default' && COLORWAYS[sp] ? sp : p.colorway;
  const C = zonesFor(cw, colorOverrides(userParams, cw));
  const g = new THREE.Group();
  g.name = 'whale';
  const P = partsBag();
  const Lw = p.length, SPC = {
    // (Digital Diorama revision 9: a broad, blunt head; it tapered to a point)
    humpback: { R: 0.115, prof: [[0, 0.16], [0.12, 0.3], [0.3, 0.62], [0.5, 0.92], [0.65, 1], [0.8, 0.92], [0.9, 0.78], [0.96, 0.52], [1, 0.22]], hu: 0.85, hd: 0.8, wd: 1, flat: 0.35, span: 0.3, flip: 0.3, dorsal: [0.33, 0.04] },
    orca: { R: 0.13, prof: [[0, 0.18], [0.15, 0.4], [0.35, 0.8], [0.55, 1], [0.75, 0.95], [0.9, 0.7], [1, 0.25]], hu: 0.95, hd: 0.9, wd: 1, flat: 0, span: 0.24, flip: 0.12, dorsal: [0.55, 0.14] },
    blue: { R: 0.085, prof: [[0, 0.14], [0.15, 0.28], [0.35, 0.6], [0.55, 0.88], [0.7, 0.98], [0.85, 0.9], [0.95, 0.65], [1, 0.2]], hu: 0.8, hd: 0.75, wd: 1.1, flat: 0.45, span: 0.25, flip: 0.1, dorsal: [0.26, 0.015] },
  }[sp];
  const Rm = SPC.R * Lw, zOf = (u) => (u - 0.5) * Lw;
  const Rf = (u) => { const pr = SPC.prof; for (let i = 0; i < pr.length - 1; i++) if (u <= pr[i + 1][0]) return Rm * lerp(pr[i][1], pr[i + 1][1], (u - pr[i][0]) / (pr[i + 1][0] - pr[i][0])); return Rm * pr[pr.length - 1][1]; };
  const ring = 18, hu = (u) => SPC.hu * (1 - SPC.flat * smooth(0.78, 1, u));
  const colAt = (u, x, y, R, k) => {
    const yr = y / Math.max(1e-6, R), xr = Math.abs(x) / Math.max(1e-6, R);
    if (sp === 'orca') {
      if (u > 0.8 && u < 0.9 && yr > 0.0 && yr < 0.5 && xr > 0.5) return C.patch;
      if (u > 0.42 && u < 0.56 && yr > 0.7) return C.saddle;
      if ((u > 0.3 && yr < -0.25) || (u > 0.18 && u < 0.4 && yr < 0.05 && xr > 0.6)) return C.belly;
      return C.back;
    }
    if (yr < -0.4) return u > 0.55 && u < 0.98 ? (k % 2 ? C.groove : C.belly) : C.belly;
    if (sp === 'blue') return noise2(u * 40, k * 0.7, 3) > 0.62 ? C.saddle : C.back;
    return yr < -0.15 && noise2(u * 30, k, 5) > 0.55 ? C.groove : C.back;
  };
  const loft = (list, u0, u1, nU, name) => {
    const pos = [], col = [], c = new THREE.Color();
    const pt = (u, k) => { const a = (k / ring) * Math.PI * 2, R = Rf(u), cs = Math.cos(a), sn = Math.sin(a); return [cs * R * SPC.wd, sn * R * (sn > 0 ? hu(u) : SPC.hd), zOf(u)]; };
    for (let i = 0; i < nU; i++) for (let k = 0; k < ring; k++) {
      const ua = lerp(u0, u1, i / nU), ub = lerp(u0, u1, (i + 1) / nU), A = pt(ua, k), B = pt(ub, k), Cc = pt(ub, k + 1), Dd = pt(ua, k + 1);
      c.set(colAt((ua + ub) / 2, (A[0] + Cc[0]) / 2, (A[1] + Cc[1]) / 2, Rf((ua + ub) / 2), k));
      for (const q of [A, B, Cc, A, Cc, Dd]) { pos.push(q[0], q[1], q[2]); col.push(c.r, c.g, c.b); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    list.push({ g: geo, c: null, n: name });
  };
  // Segments: front body (whale) → tail stock (beats) → flukes
  const wh = P.sub('whale-body', [0, 0, 0]), uJ = 0.45, tl = P.sub('tail', [0, 0, zOf(uJ)], 'whale-body'), fk = P.sub('flukes', [0, 0, zOf(0)], 'tail');
  loft(wh.solid, uJ - 0.02, 1, 22, 'body');
  loft(tl.solid, 0, uJ + 0.03, 14, 'tail-stock');
  { const pts = []; for (let k = 0; k < ring; k++) { const a = (k / ring) * Math.PI * 2; pts.push(Math.cos(a) * Rf(1) * SPC.wd, Math.sin(a) * Rf(1) * 0.8, zOf(1)); } const v = []; for (let k = 0; k < ring; k++) { const k2 = (k + 1) % ring; v.push(0, 0, zOf(1) + Rf(1) * 0.6, pts[k * 3], pts[k * 3 + 1], pts[k * 3 + 2], pts[k2 * 3], pts[k2 * 3 + 1], pts[k2 * 3 + 2]); } wh.solid.push({ g: new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(v, 3)), c: C.back, n: 'snout' }); }
  // Flukes: notched two-lobed planform, extruded thin, dark above / pale below
  const span = SPC.span * Lw, ch = 0.09 * Lw, fs = new THREE.Shape();
  fs.moveTo(0, 0.02 * Lw);
  fs.quadraticCurveTo(-span * 0.3, -ch * 0.1, -span / 2, -ch * 0.95);
  // (Digital Diorama revision 9: a finely scalloped trailing edge; 0.17 m teeth read as a saw blade)
  const serr = sp === 'humpback' ? 12 : 1;
  for (let i = 1; i <= serr; i++) { const f = i / serr; fs.lineTo(lerp(-span / 2, -span * 0.06, f), -ch * lerp(0.95, 0.62, f) + (i % 2 ? -0.004 * Lw : 0)); }
  fs.lineTo(0, -ch * 0.52);
  for (let i = serr; i >= 1; i--) { const f = i / serr; fs.lineTo(-lerp(-span / 2, -span * 0.06, f) * 1, -ch * lerp(0.95, 0.62, f) + (i % 2 ? -0.004 * Lw : 0)); }
  fs.lineTo(span / 2, -ch * 0.95);
  fs.quadraticCurveTo(span * 0.3, -ch * 0.1, 0, 0.02 * Lw);
  // (Digital Diorama revision 9: 0.012 L thick (it was 0.31 m on a 14 m whale) and its edges in the top colour: by the faces'
  // centres, the side walls alternated dark and pale triangles)
  const th = 0.012 * Lw, flg = new THREE.ExtrudeGeometry(fs, { depth: th, bevelEnabled: false, curveSegments: 6 }).rotateX(Math.PI / 2).translate(0, th / 2, zOf(0) + 0.02 * Lw);
  fk.solid.push({ g: faceTint(flg, (x, y) => (y < -th * 0.4 ? C.flukeUnder : C.fluke)), c: null, n: 'flukes' });
  // Pectoral flippers (subs), dorsal fin, eyes, blowholes, tubercles
  const uF = sp === 'humpback' ? 0.74 : 0.78, fl = SPC.flip * Lw, fr = sp === 'humpback' ? 0.045 * Lw : 0.06 * Lw;
  // (Digital Diorama revision 9: flat flipper blades held out from the sides, drooping a little and swept back: the
  // humpback's long and narrow with a scalloped leading edge, the orca's a broad paddle, the blue whale's slender; they were
  // capsules splayed down like the legs of a lander)
  const flipShape = (s) => {
    const sh = new THREE.Shape(), n = 16, chord = (t) => fr * (sp === 'orca' ? 2.1 : 1.7) * (sp === 'orca' ? Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)))) : (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, 0.2 + t * 1.1))) * (1 - 0.75 * t));
    const lead = [], trail = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, c = chord(t), knob = sp === 'humpback' && i > 1 && i < n ? 0.12 * fr * Math.max(0, Math.sin(t * 40)) : 0;
      lead.push([s * t * fl, c * 0.45 + knob]); trail.push([s * t * fl, -c * 0.55]);
    }
    sh.moveTo(trail[0][0], trail[0][1]);
    for (const q of trail.slice(1)) sh.lineTo(q[0], q[1]);
    for (const q of lead.reverse()) sh.lineTo(q[0], q[1]);
    sh.closePath();
    return sh;
  };
  const fth = 0.012 * Lw;
  for (const [nm, s] of [['flipper-l', 1], ['flipper-r', -1]]) {
    const at = [s * Rf(uF) * 0.85, -Rf(uF) * 0.35, zOf(uF)], f = P.sub(nm, at, 'whale-body');
    const geo = new THREE.ExtrudeGeometry(flipShape(s), { depth: fth, bevelEnabled: false, curveSegments: 4 }).rotateX(Math.PI / 2).translate(0, fth / 2, 0)
      .rotateZ(-s * 0.42).rotateY(s * (sp === 'humpback' ? 0.55 : 0.75)).translate(at[0], at[1], at[2]);
    f.solid.push({ g: geo, c: sp === 'humpback' ? C.fin : C.back, n: 'flipper' });
  }
  const [uD, hD] = SPC.dorsal, dH = hD * Lw, dS = new THREE.Shape();
  dS.moveTo(0.06 * Lw, 0); dS.quadraticCurveTo(0.02 * Lw, dH * 0.6, -0.02 * Lw, dH); dS.quadraticCurveTo(-0.025 * Lw, dH * 0.4, -0.06 * Lw, 0); dS.lineTo(0.06 * Lw, 0);
  const dg = new THREE.ExtrudeGeometry(dS, { depth: 0.012 * Lw + 0.03, bevelEnabled: false, curveSegments: 5 }).rotateY(-Math.PI / 2).translate((0.006 * Lw + 0.015), Rf(uD) * hu(uD) * 0.92, zOf(uD));
  (uD < uJ ? tl : wh).solid.push({ g: dg, c: C.back, n: 'dorsal' });
  for (const s of [-1, 1]) wh.solid.push({ g: new THREE.SphereGeometry(0.008 * Lw, 6, 4).translate(s * Rf(0.88) * 0.93, -Rf(0.88) * 0.05, zOf(0.88)), c: C.eye, n: 'eye' });
  for (const s of [-1, 1]) wh.solid.push({ g: new THREE.CapsuleGeometry(0.005 * Lw, 0.012 * Lw, 2, 5).rotateX(Math.PI / 2).translate(s * 0.007 * Lw, Rf(0.83) * hu(0.83) + 0.002 * Lw, zOf(0.83)), c: C.eye, n: 'blowhole' });
  if (sp === 'humpback') for (let i = 0; i < 14; i++) { const u = 0.86 + (i % 7) * 0.018, s = i < 7 ? 1 : -1; wh.solid.push({ g: new THREE.IcosahedronGeometry(0.008 * Lw, 0).translate(s * (0.15 + (i % 3) * 0.12) * Rf(u), Rf(u) * hu(u) * 0.95, zOf(u)), c: C.back, n: 'tubercle' }); }
  // Water + effects
  const waves = patchWaves(p.swell), Rp = p.pathRadius, D0 = -Math.max(p.depth, Rm * 1.5), T = p.cycle, ySurf = -Rm * 0.62;
  const waterMat = makeWaterMaterial({ waves, opacity: 0.8, foam: C.foam, roughness: 0.12, streakAlong: 0.4, streakAcross: 0.6, cap: [0.5, 0.78], ripples: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] });
  if (p.waterPatch) g.userData.surface = waterPatch(P.sub('water-patch', [0, 0, 0]), g, { r: Rp + Lw * 0.8, depth: -D0 + Lw * 0.45 + 2, waves, water: C.water, deep: C.deep, floor: C.seabed, mat: waterMat });
  const breach = p.behaviour === 'breach', PE = breach ? 2 * T : T, blowAt = 0.41, blow2 = 0.465, flukeAt = 0.5;
  const bhole = [0, Rf(0.83) * hu(0.83) + 0.05, zOf(0.83)];
  const emitters = [blowAt, blow2].map((ph, i) => makeEmitter(`blow-${i + 1}`, {
    count: 50, shape: 'cloud', color: C.spout, opacity: 0.6, gravity: [0, -2, 0], grow: [0.4, 2.4], drag: 1.2, pulse: true, cycle: [PE, 1.1 / PE, 0], timeOffset: -ph * T, parent: 'whale-body', seed: 30 + i,
    spawn: (k, rr) => ({ p: [bhole[0] + (rr() - 0.5) * 0.2, bhole[1], bhole[2]], v: [(rr() - 0.5) * 1.6, 7 + rr() * 5 * Math.sqrt(Lw / 14), (rr() - 0.5) * 1.6], life: 2.6, size: 0.18 * Math.sqrt(Lw / 14) }),
  }));
  emitters.push(makeEmitter('fluke-drips', {
    count: 120, shape: 'streak', color: C.foam, stretch: 0.12, cycle: [PE, 0.11 * T / PE, 0], timeOffset: -(flukeAt + 0.02) * T, parent: 'flukes', seed: 41,
    spawn: (k, rr) => { const x = (rr() - 0.5) * span * 0.95; return { p: [x, -0.02, 0.02 * Lw - ch * (0.6 + rr() * 0.35)], v: [0, -0.3, 0], life: 1.6, size: 0.05 + rr() * 0.04 }; },
  }));
  let splash = null;
  if (breach) {
    splash = makeEmitter('breach-splash', {
      count: 320, shape: 'drop', color: C.foam, stretch: 0.03, floor: -0.5, cycle: [PE, 0.6 / PE, 0], timeOffset: -(T + 0.505 * T), seed: 52,
      spawn: (k, rr) => { const a = rr() * 6.28, d = rr() * Lw * 0.35, up = 5 + rr() * 9 * Math.sqrt(Lw / 14); return { p: [Math.cos(a) * d, 0.1, Math.sin(a) * d], v: [Math.cos(a) * (2 + rr() * 4), up, Math.sin(a) * (2 + rr() * 4)], life: 3.2, size: 0.12 + rr() * 0.22 }; },
    });
    emitters.push(splash);
  }
  // Motion: loop path + dive / breach profile
  const U = waterMat.userData.uniforms, ease = (v) => v * v * (3 - 2 * v), path = (t) => { const a = (p.speed * t) / Rp; return [Rp * Math.sin(a), Rp * Math.cos(a)]; };
  const prof = (ph, br) => {
    if (!br) {
      if (ph < 0.3) return [D0, 0, 0, 0];
      if (ph < 0.4) { const u = ease((ph - 0.3) / 0.1); return [lerp(D0, ySurf, u), 0.25 * Math.sin(Math.PI * u), 0, 0]; }
      if (ph < 0.5) return [ySurf + 0.08 * Math.sin((ph - 0.4) * 50), 0, 0, 0];
      if (ph < 0.62) { const u = (ph - 0.5) / 0.12; return [lerp(ySurf, ySurf - 0.2 * Lw, u * u), -0.75 * ease(u), 0, 22 * Math.sin(Math.PI * Math.min(1, u * 1.3))]; }
      if (ph < 0.75) { const u = ease((ph - 0.62) / 0.13); return [lerp(ySurf - 0.2 * Lw, D0, u), lerp(-0.75, 0, u), 0, 0]; }
      return [D0, 0, 0, 0];
    }
    if (ph < 0.28) return [D0, 0, 0, 0];
    if (ph < 0.38) { const u = ease((ph - 0.28) / 0.1); return [lerp(D0, D0 - 0.25 * Lw, u), lerp(0, 1.25, u), 0, 0]; }
    if (ph < 0.45) { const u = (ph - 0.38) / 0.07, e2 = 1 - (1 - u) * (1 - u); return [lerp(D0 - 0.25 * Lw, 0.35 * Lw, e2), 1.25, 1.2 * u, 0]; }
    if (ph < 0.51) { const u = (ph - 0.45) / 0.06; return [lerp(0.35 * Lw, -0.15 * Lw, u * u), lerp(1.25, 0.35, u), 1.2 + 0.8 * u, 0]; }
    if (ph < 0.7) { const u = ease((ph - 0.51) / 0.19); return [lerp(-0.15 * Lw, D0, u), lerp(0.35, 0, u), lerp(2.0, 0, u), 0]; }
    return [D0, 0, 0, 0];
  };
  let whN = null, last = 0;
  const events = [];
  const ring2 = (x, z, t, a) => { const s = events.length % 4; events.push(1); U.uRip.value[s].set(x, z, t, a); fireRipple(g, x, z, t, a); };
  g.userData.view = { target: [0, -2, 0], radius: Rp * 1.6 + Lw };
  finalize(g, P, p, C, {
    waterMat, emitters,
    tick: (t, dt, drive) => {
      if (!whN) { whN = g.getObjectByName('whale-body'); whN.rotation.order = 'YXZ'; }
      const cyc = Math.floor(t / T), ph = t / T - cyc, br = breach && cyc % 2 === 1;
      const [y, pitch, roll, lift] = prof(ph, br), [x, z] = path(t), [x2, z2] = path(t + 0.2);
      whN.position.set(x, y, z);
      whN.rotation.set(-pitch, Math.atan2(x2 - x, z2 - z), roll);
      const beat = 2 * Math.PI * t / (3.6 * Math.sqrt(Lw / 14) / Math.max(0.4, p.speed / 2.4));
      drive('tail', 10 * Math.sin(beat) + lift); drive('flukes', 14 * Math.sin(beat - 0.9) + lift * 0.6);
      drive('flipper-l', 6 * Math.sin(beat * 0.5) + (br ? 25 * Math.sin(Math.PI * clamp01((ph - 0.38) / 0.2)) : 0)); drive('flipper-r', -6 * Math.sin(beat * 0.5) - (br ? 25 * Math.sin(Math.PI * clamp01((ph - 0.38) / 0.2)) : 0));
      const cross = (a) => last < a && ph >= a;
      if (!br) { if (cross(0.395)) ring2(x, z, t, 0.05); if (cross(0.56)) { const q = path(t - 4); ring2(q[0], q[1], t, 0.06); } }
      else { if (cross(0.42)) ring2(x, z, t, 0.07); if (cross(0.505)) { ring2(x, z, t, 0.09); ring2(x + 2, z - 1, t + 0.15, 0.06); } }
      if (splash && breach && cyc % 2 === 0 && ph > 0.8) { const q = path((cyc + 1) * T + 0.505 * T); splash.position.set(q[0], 0, q[1]); }
      last = ph;
    },
  });
  g.userData.waterSurface = g.userData.surface || null;
  g.userData.matchWaves = (src) => matchWavesFrom(waterMat, src);
  return g;
}
export default createAsset;
