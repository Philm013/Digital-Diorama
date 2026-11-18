/*
 * BEACH & SURF (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * Sandy beach profile from an offshore bar to the dunes. Shoaling Gerstner waves steepen over the
 * bar, roll in as foam lines and run up the slope as swash before draining back — the waterline
 * moves because the animated sea genuinely intersects the sand. Wet-sand band, wrack line,
 * driftwood, shells, rocks, swaying dune grass and palms.
 *
 * QUICK START
 *   import { createAsset } from './beach-shore.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // sea on −Z, land on +Z; `tide` slides the waterline up or down the slope
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | tropical | volcanic | shingle | sunset — Theme
 *   width               30–200 m (default 60) — Beach Length
 *   depth               40–120 m (default 64) — Sea-to-Dune Depth
 *   slope               0.03–0.2 (default 0.07) — Beach Slope
 *   tide                -1–1 m (default 0) — Tide Level
 *   waveHeight          0–2.5 m (default 0.9) — Wave Height
 *   wavePeriod          4–14 s (default 7) — Wave Period
 *   waveAngle           -40–40 ° (default 8) — Wave Approach Angle
 *   surfFoam            0–1 (default 0.8) — Surf Foam
 *   sandbar             on/off (default on) — Offshore Sandbar
 *   cusps               0–1 (default 0.5) — Beach Cusps
 *   vegetation          none | dunegrass | palms | mixed — Vegetation
 *   rocks               0–30 (default 6) — Rocks
 *   driftwood           0–10 (default 3) — Driftwood
 *   shells              on/off (default on) — Shells & Wrack
 *   seaWater            on/off (default on) — Own Sea
 *   diorama             on/off (default on) — Diorama Sides
 *   seed                1–999 (default 11) — Seed
 *   sand                colour (default #e6d3a3) — Sand Colour
 *   wetSand             colour (default #b9a175) — Wet Sand Colour
 *   dune                colour (default #d8c08a) — Dune Colour
 *   grass               colour (default #8fae5a) — Grass Colour
 *   grassDark           colour (default #6b8f45) — Grass Dark Colour
 *   water               colour (default #2a8fa6) — Water Colour
 *   deep                colour (default #145d7a) — Deep Colour
 *   foam                colour (default #fbfdff) — Foam Colour
 *   rock                colour (default #7b776f) — Rock Colour
 *   wood                colour (default #9a7b5a) — Wood Colour
 *   palm                colour (default #7a5c3c) — Palm Colour
 *   frond               colour (default #4f8f3f) — Frond Colour
 *   shell               colour (default #f1e4d0) — Shell Colour
 *   weed                colour (default #4b5a32) — Weed Colour
 *   soil                colour (default #8c6d4a) — Soil Colour
 *
 * SPECS  24,507 triangles at defaults, 3 materials, 4 draw calls when merged,
 *        60.0 x 20.0 x 64.0 m (W x H x D, real-world scale).
 * PARTS animate: water shader, particles
 *        detach: vegetation, props
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.surface.heightAt(worldX, worldZ, t) → sea height (world metres)
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = {
  sand: '#e6d3a3', wetSand: '#b9a175', dune: '#d8c08a', grass: '#8fae5a', grassDark: '#6b8f45',
  water: '#2a8fa6', deep: '#145d7a', foam: '#fbfdff', rock: '#7b776f', wood: '#9a7b5a',
  palm: '#7a5c3c', frond: '#4f8f3f', shell: '#f1e4d0', weed: '#4b5a32', soil: '#8c6d4a',
};
export const COLORWAYS = {
  'default': { ...BASE },
  tropical: { ...BASE, sand: '#f4ead2', wetSand: '#d6c49a', dune: '#efe1bd', water: '#22b5bf', deep: '#0a7a95', grass: '#7fbf5a', frond: '#3fa04a' },
  volcanic: { ...BASE, sand: '#3b3836', wetSand: '#242221', dune: '#4a4642', water: '#2b7d8f', deep: '#123f52', rock: '#2a2828', shell: '#d9d2c4', soil: '#3a2f28' },
  shingle: { ...BASE, sand: '#a9a49a', wetSand: '#7d786f', dune: '#b7ae96', water: '#4f8496', deep: '#25495a', foam: '#eef3f5', grass: '#7a9461', rock: '#6b6a66' },
  sunset: { ...BASE, sand: '#e8c39a', wetSand: '#b98e6a', water: '#4a7fa0', deep: '#2b4a72', foam: '#fff1e0' },
};
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  width: { type: 'range', default: 60, min: 30, max: 200, step: 5, unit: 'm', label: 'Beach Length', affects: 'geometry', describe: 'Alongshore extent (X).' },
  depth: { type: 'range', default: 64, min: 40, max: 120, step: 2, unit: 'm', label: 'Sea-to-Dune Depth', affects: 'geometry', describe: 'Cross-shore extent (Z): offshore bar → surf → beach → dunes.' },
  slope: { type: 'range', default: 0.07, min: 0.03, max: 0.2, step: 0.01, label: 'Beach Slope', affects: 'geometry', describe: 'Gradient of the beach face (rise/run). Steeper = narrower swash.' },
  tide: { type: 'range', default: 0, min: -1, max: 1, step: 0.05, unit: 'm', label: 'Tide Level', affects: 'geometry', describe: 'Still-water level; the wet band and waterline follow it.' },
  waveHeight: { type: 'range', default: 0.9, min: 0, max: 2.5, step: 0.05, unit: 'm', label: 'Wave Height', affects: 'geometry', describe: 'Breaker height (crest to trough) arriving from offshore.' },
  wavePeriod: { type: 'range', default: 7, min: 4, max: 14, step: 0.5, unit: 's', label: 'Wave Period', affects: 'geometry', describe: 'Seconds between breakers; sets wavelength via shallow-water speed √(g·h).' },
  waveAngle: { type: 'range', default: 8, min: -40, max: 40, step: 1, unit: '°', label: 'Wave Approach Angle', affects: 'geometry', describe: 'Angle of the incoming swell relative to straight onshore (drives longshore drift).' },
  surfFoam: { type: 'range', default: 0.8, min: 0, max: 1, step: 0.05, label: 'Surf Foam', affects: 'geometry', describe: 'Whitewater in the surf zone and swash lace.' },
  sandbar: { type: 'toggle', default: true, label: 'Offshore Sandbar', affects: 'geometry', describe: 'A submerged bar where waves first trip and break.' },
  cusps: { type: 'range', default: 0.5, min: 0, max: 1, step: 0.05, label: 'Beach Cusps', affects: 'geometry', describe: 'Scalloped, crescent-shaped shoreline.' },
  vegetation: { type: 'choice', default: 'mixed', options: ['none', 'dunegrass', 'palms', 'mixed'], label: 'Vegetation', affects: 'geometry', describe: 'Dune grass, palms, both or bare sand.' },
  rocks: { type: 'range', default: 6, min: 0, max: 30, step: 1, label: 'Rocks', affects: 'geometry', describe: 'Boulders scattered in the surf and on the beach.' },
  driftwood: { type: 'range', default: 3, min: 0, max: 10, step: 1, label: 'Driftwood', affects: 'geometry', describe: 'Logs stranded along the high-water line.' },
  shells: { type: 'toggle', default: true, label: 'Shells & Wrack', affects: 'geometry', describe: 'Shells and seaweed wrack marking the last high tide.' },
  seaWater: { type: 'toggle', default: true, label: 'Own Sea', affects: 'geometry', describe: 'The asset’s own patch of sea. Turn it off when the asset sits in an ocean tile, which then supplies (and shoals) the water.' },
  diorama: { type: 'toggle', default: true, label: 'Diorama Sides', affects: 'geometry', describe: 'Cut-away soil, rock and water-column sides.' },
  seed: { type: 'range', default: 11, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {};
export const detach = ['vegetation', 'props'];
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

/** Low-poly boulder: icosahedron with deterministic per-corner jitter (shared corners stay welded). */
function rockGeo(r, seed = 1, detail = 1, squash = 0.75, jag = 0.22) {
  const geo = new THREE.IcosahedronGeometry(r, detail);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (hash2(Math.round(x * 997) * 0.37 + seed * 13.1, Math.round(y * 997) * 0.71 + Math.round(z * 997) * 0.53, seed) - 0.5) * 2 * jag;
    p.setXYZ(i, x * k, y * k * squash, z * k);
  }
  return geo;
}
/** Push a rock into a bucket at (x,y,z) with a yaw. */
function addRock(list, r, x, y, z, hex, seed = 1, squash = 0.7, jag = 0.22, detail = 1) {
  const g = rockGeo(r, seed, detail, squash, jag).rotateY(seed * 1.7).translate(x, y, z);
  list.push({ g, c: hex, n: 'rock' });
  return g;
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

/** Conifer: trunk + 3–4 stacked cones. C3 = [trunk, leaf, leafDark]. */
function addPine(list, x, y, z, h, C3, seed = 1) {
  const r = rng(seed * 7 + 3), tw = h * 0.035;
  addCylinder(list, tw * 0.6, tw, h * 0.32, 6, x, y + h * 0.16, z, 0, 0, 0, C3[0]);
  const tiers = 3 + (r() > 0.5 ? 1 : 0);
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers, rad = h * (0.3 - t * 0.17) * (0.9 + r() * 0.2), ht = h * (0.42 - t * 0.08);
    const g = new THREE.ConeGeometry(rad, ht, 7, 1).rotateY(r() * Math.PI * 2)
      .translate(x + (r() - 0.5) * 0.04 * h, y + h * 0.2 + t * h * 0.52 + ht / 2, z + (r() - 0.5) * 0.04 * h);
    list.push({ g, c: i % 2 ? C3[2] : C3[1], n: 'pine' });
  }
}
/** Broadleaf: curved trunk + clustered icosahedron canopy. */
function addBroadleaf(list, x, y, z, h, C3, seed = 1) {
  const r = rng(seed * 11 + 5), th = h * 0.45;
  const pts = [[x, y - 0.1, z], [x + (r() - 0.5) * 0.1 * h, y + th * 0.5, z + (r() - 0.5) * 0.1 * h], [x + (r() - 0.5) * 0.15 * h, y + th, z + (r() - 0.5) * 0.15 * h]];
  list.push({ g: sweep(pts, (t) => h * 0.045 * (1 - t * 0.45), 6, 4, false), c: C3[0], n: 'trunk' });
  const blobs = 4 + Math.floor(r() * 3);
  for (let i = 0; i < blobs; i++) {
    const a = r() * Math.PI * 2, dd = i === 0 ? 0 : h * 0.17 * (0.6 + r() * 0.6), rr = h * (0.19 + r() * 0.08);
    const g = new THREE.IcosahedronGeometry(rr, 1).scale(1, 0.82, 1)
      .translate(pts[2][0] + Math.cos(a) * dd, y + th + h * 0.16 + (i === 0 ? h * 0.12 : r() * h * 0.14), pts[2][2] + Math.sin(a) * dd);
    list.push({ g, c: i % 2 ? C3[2] : C3[1], n: 'canopy' });
  }
}
/** One drooping palm frond (V-folded strip) from origin o at heading a. */
function frondGeo(o, a, len, droop, wid) {
  const seg = 6, v = [], ca = Math.cos(a), sa = Math.sin(a), P = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, hx = t * len, hy = Math.sin(t * Math.PI * 0.6) * len * 0.22 - t * t * len * droop;
    P.push([o[0] + ca * hx, o[1] + hy, o[2] + sa * hx, t]);
  }
  const L = (p, w) => [p[0] - sa * w, p[1] - w * 0.35, p[2] + ca * w], R = (p, w) => [p[0] + sa * w, p[1] - w * 0.35, p[2] - ca * w];
  const T = (p, q, s) => v.push(...p.slice(0, 3), ...q.slice(0, 3), ...s.slice(0, 3));
  for (let i = 0; i < seg; i++) {
    const A = P[i], B = P[i + 1];
    const wA = wid * Math.sin(Math.PI * Math.min(1, A[3] * 0.85 + 0.12)), wB = wid * Math.sin(Math.PI * Math.min(1, B[3] * 0.85 + 0.12));
    T(A, L(B, wB), B); T(A, L(A, wA), L(B, wB)); T(A, B, R(B, wB)); T(A, R(B, wB), R(A, wA));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}
/** Coconut palm: leaning ringed trunk, 7 fronds, coconuts. */
function addPalm(list, x, y, z, h, C3, seed = 1, lean = 0.16) {
  const r = rng(seed * 13 + 1), dir = r() * Math.PI * 2, lx = Math.cos(dir) * lean * h, lz = Math.sin(dir) * lean * h;
  const top = [x + lx, y + h, z + lz];
  const pts = [[x, y - 0.1, z], [x + lx * 0.15, y + h * 0.4, z + lz * 0.15], [x + lx * 0.55, y + h * 0.75, z + lz * 0.55], top];
  list.push({ g: sweep(pts, (t) => h * 0.04 * (1.15 - t * 0.4) * (1 + 0.1 * Math.sin(t * 46)), 6, 16, true), c: C3[0], n: 'palm-trunk' });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.4;
    list.push({ g: frondGeo(top, a, h * (0.4 + r() * 0.12), 0.45 + r() * 0.3, h * 0.065), c: i % 2 ? C3[1] : C3[2], n: 'frond' });
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + r();
    const g = new THREE.IcosahedronGeometry(h * 0.028, 0).translate(top[0] + Math.cos(a) * h * 0.035, top[1] - h * 0.03, top[2] + Math.sin(a) * h * 0.035);
    list.push({ g, c: C3[0], n: 'coconut' });
  }
}
/** Birch: slender white trunk with dark lenticel marks + small airy canopy clusters. C4 = [bark, mark, leaf, leafDark]. */
function addBirch(list, x, y, z, h, C4, seed = 1) {
  const r = rng(seed * 19 + 7), lean = (r() - 0.5) * 0.12 * h;
  const pts = [[x, y - 0.1, z], [x + lean * 0.4, y + h * 0.4, z + lean * 0.2], [x + lean, y + h * 0.8, z + lean * 0.5]];
  list.push({ g: faceTint(sweep(pts, (t) => h * 0.022 * (1 - t * 0.5), 6, 12, false), (cx, cy) => (hash2(Math.floor(cy * 5), Math.floor(cx * 3), seed) > 0.75 ? C4[1] : C4[0])), c: null, n: 'trunk' });
  for (let i = 0; i < 7; i++) {
    const a = r() * 6.28, d = h * 0.09 * (0.3 + r()), yy = y + h * (0.5 + r() * 0.45), rr = h * (0.07 + r() * 0.05);
    list.push({ g: new THREE.IcosahedronGeometry(rr, 0).scale(1, 1.35, 1).translate(pts[2][0] + Math.cos(a) * d, yy, pts[2][2] + Math.sin(a) * d), c: i % 2 ? C4[3] : C4[2], n: 'canopy' });
  }
}
/**
 * Weeping willow: stout leaning trunk, rounded crown and curtains of hanging strands. Trunk + crown → `list`,
 * strands → `swayList` (they carry their own aSway: 0 where they hang from, 1 at the tips). C3 = [trunk, leaf, leafDark].
 */
function addWillow(list, swayList, x, y, z, h, C3, seed = 1) {
  const r = rng(seed * 23 + 3), dir = r() * 6.28, lean = h * 0.12, R = h * 0.42;
  const top = [x + Math.cos(dir) * lean, y + h * 0.62, z + Math.sin(dir) * lean];
  list.push({ g: sweep([[x, y - 0.2, z], [x + Math.cos(dir) * lean * 0.3, y + h * 0.3, z + Math.sin(dir) * lean * 0.3], top], (t) => h * 0.06 * (1 - t * 0.45), 7, 8, false), c: C3[0], n: 'trunk' });
  for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28 + r(), d = i === 0 ? 0 : R * 0.45; list.push({ g: new THREE.IcosahedronGeometry(R * (0.45 + r() * 0.15), 1).scale(1, 0.55, 1).translate(top[0] + Math.cos(a) * d, top[1] + h * 0.18 + r() * h * 0.06, top[2] + Math.sin(a) * d), c: i % 2 ? C3[2] : C3[1], n: 'crown' }); }
  const strands = Math.round(70 + h * 5);
  for (let i = 0; i < strands; i++) {
    const a = r() * 6.28, d = R * (0.55 + r() * 0.55), ca = Math.cos(a), sa = Math.sin(a), sx = top[0] + ca * d, sz = top[2] + sa * d, sy = top[1] + h * 0.15 - (d / R) * h * 0.12;
    const len = h * (0.35 + r() * 0.35), w = 0.08 + r() * 0.07, bot = Math.max(y + 0.25, sy - len);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([sx + sa * w, sy, sz - ca * w, sx - sa * w, sy, sz + ca * w, sx + ca * 0.18, bot, sz + sa * 0.18], 3));
    const pa = geo.attributes.position, sw = new Float32Array(pa.count * 2), ph = sx * 0.6 + sz * 0.4;
    for (let k = 0; k < pa.count; k++) { sw[k * 2] = clamp01((sy - pa.getY(k)) / Math.max(0.01, sy - bot)); sw[k * 2 + 1] = ph; }
    geo.setAttribute('aSway', new THREE.BufferAttribute(sw, 2));
    swayList.push({ g: geo, c: i % 3 ? C3[1] : C3[2], n: 'strand' });
  }
}
/** Move foliage pieces (canopy / crown / frond / pine / coconut) pushed since index `from` into the sway list, flexing between y0 and y1. */
function swayCanopy(list, swayList, from, y0, y1, phase) {
  for (let i = list.length - 1; i >= from; i--) {
    const it = list[i];
    if (!['canopy', 'crown', 'frond', 'pine', 'coconut'].includes(it.n)) continue;
    list.splice(i, 1);
    swayList.push({ g: swayify(it.g, phase, y0, y1), c: it.c, n: it.n });
  }
}
/** Clump of reeds / rushes with occasional cattail heads. C3 = [stem, stemDark, head]. */
function addReeds(list, x, y, z, n, h, C3, seed = 1, spread = 0.8) {
  const r = rng(seed * 17 + 9);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * spread, hh = h * (0.6 + r() * 0.5);
    const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, tilt = (r() - 0.5) * 0.3, rot = r() * Math.PI * 2;
    const g = new THREE.ConeGeometry(0.02 * h + 0.01, hh, 3, 1).translate(0, hh / 2, 0).rotateZ(tilt).rotateY(rot).translate(px, y, pz);
    list.push({ g, c: i % 3 ? C3[0] : C3[1], n: 'reed' });
    if (r() < 0.3) {
      const head = new THREE.CapsuleGeometry(0.035 * h + 0.012, 0.12 * h, 2, 5).translate(0, hh * 0.78, 0).rotateZ(tilt).rotateY(rot).translate(px, y, pz);
      list.push({ g: head, c: C3[2], n: 'cattail' });
    }
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
  g.name = 'beach-shore';
  const P = partsBag();
  const W = p.width, D = p.depth, hw = W / 2, hd = D / 2, r = rng(p.seed);
  const zs0 = -hd + D * 0.45;
  const shoreZ = (x) => zs0 + p.cusps * 2.4 * Math.sin(x * 0.12 + p.seed) + (noise2(x * 0.03, 1.5, p.seed) - 0.5) * 3;
  const h = (x, z) => {
    const dz = z - shoreZ(x);
    let y;
    if (dz < 0) {
      y = Math.max(-5.5, dz * p.slope * 0.8);
      if (p.sandbar) y += 0.9 * Math.exp(-(((dz + 15) / 4.5) ** 2));
    } else {
      y = Math.min(dz * p.slope * 0.85, 1.25) + Math.max(0, dz - 14) * 0.02;
      y += smooth(18, 30, dz) * (1.4 + 1.6 * fbm2(x * 0.05, z * 0.05, p.seed + 2, 3));
    }
    return y + (noise2(x * 0.4, z * 0.4, p.seed + 9) - 0.5) * 0.06;
  };
  const runup = 0.3 + p.waveHeight * 0.45;
  const nx = Math.max(24, Math.round(W / 1.2)), nz = Math.max(24, Math.round(D / 1.2));
  const terrainCol = (x, y, z, sl) => {
      if (y < p.tide + runup) return y < p.tide - 0.6 ? C.wetSand : mixC(C.wetSand, C.sand, smooth(p.tide, p.tide + runup, y) * 0.4).getHex();
    if (y > 1.5 && sl < 0.3 && noise2(x * 0.18, z * 0.18, p.seed) > 0.42) return noise2(x * 0.5, z * 0.5, p.seed + 1) > 0.5 ? C.grass : C.grassDark;
    return y > 1.35 ? C.dune : C.sand;
  };
  P.solid.push({ g: heightField(W, D, nx, nz, h, terrainCol), c: null, n: 'beach' });

  // Surf: a world-phase Gerstner sea whose amplitude shoals over the bar and runs up the beach face.
  const zMax = zs0 + 10, wdz = zMax + hd;
  const nxW = Math.max(16, Math.round(W / 1.1)), nzW = Math.max(8, Math.round(wdz / ((W / nxW) * 0.866)));
  const Lw = p.wavePeriod * Math.sqrt(9.81 * 2.4), aW = (p.waveAngle * Math.PI) / 180, kw = (2 * Math.PI) / Lw, A = p.waveHeight / 2;
  const waves = [
    [Math.sin(aW), Math.cos(aW), Math.min(0.62, A * kw), Lw],
    [Math.sin(aW + 0.35), Math.cos(aW + 0.35), Math.min(0.25, A * kw * 0.64), Lw * 0.55],
    [Math.sin(aW - 0.6), Math.cos(aW - 0.6), Math.min(0.12, A * kw * 0.3), Lw * 0.31],
  ];
  const depthAt = (x, z) => p.tide - h(x, z);
  const wWeight = (d) => 0.75 + 0.55 * Math.exp(-(((d - 1.4) / 1.1) ** 2)) - 0.25 * smooth(0.9, 0, d);
  const wCol = (x, z) => {
    const d = depthAt(x, z);
    return mixC(mixC(C.water, C.deep, smooth(0.8, 5, d)), C.sand, 0.28 * smooth(1.4, 0, d));
  };
  const foamAt = (d) => p.surfFoam * (d < 0.3 ? 0.6 * smooth(-0.6, 0.3, d) + 0.2 : d < 2.4 ? 0.08 + 0.22 * smooth(2.4, 0.4, d) : 0.02);
  const Qs = waves.reduce((a, w) => a + w[2], 0);
  const cel = Math.sqrt(9.81 * 1.5);
  if (p.seaWater) P.water.push({
    g: waterify(waterGrid(W, wdz, nxW, nzW, p.tide, 0, (-hd + zMax) / 2), (x, y, z) => {
      const d = depthAt(x, z);
      return { s: z * Math.cos(aW) + x * Math.sin(aW), u: x * Math.cos(aW) - z * Math.sin(aW), speed: cel, foam: foamAt(d), ocean: wWeight(d), color: wCol(x, z) };
    }),
    c: null, n: 'surf',
  });
  if (p.diorama && p.seaWater) {
    waterColumnSides(P.water, W, wdz, nxW, nzW, p.tide, (x, z) => Math.min(h(x, z), p.tide),
      (x, y, z) => mixC(wCol(x, z), C.deep, 0.5), (x, z) => wWeight(depthAt(x, z)), 3, 0, (-hd + zMax) / 2);
  }
  tileEdge(p, P.solid, null, W, D, nx, nz, h, -8, [C.sand, C.soil, C.rock]);

  // Props
  const props = P.sub('props', [0, 0, 0]);
  for (let i = 0; i < p.rocks; i++) {
    const x = (r() - 0.5) * W * 0.9, z = zs0 + (r() - 0.65) * 22, rr = 0.4 + r() * 1.3;
    addRock(props.solid, rr, x, h(x, z) + rr * 0.15, z, C.rock, p.seed * 31 + i, 0.6);
  }
  const hiZ = (x) => shoreZ(x) + (p.tide + runup + 0.25) / (p.slope * 0.85);
  for (let i = 0; i < p.driftwood; i++) {
    const x = (r() - 0.5) * W * 0.85, z = hiZ(x) + 1 + r() * 4, L = 2 + r() * 3.5, a = r() * Math.PI, y = h(x, z);
    const ca = Math.cos(a) * L / 2, sa = Math.sin(a) * L / 2;
    props.solid.push({ g: sweep([[x - ca, y + 0.12, z - sa], [x + ca * 0.1, y + 0.2, z + sa * 0.1], [x + ca, y + 0.1, z + sa]], (t) => 0.16 * (1 - t * 0.4), 6, 4, true), c: C.wood, n: 'driftwood' });
    addWire(props.solid, [x + ca * 0.3, y + 0.2, z + sa * 0.3], [x + ca * 0.4 - sa * 0.35, y + 0.55, z + sa * 0.4 + ca * 0.35], C.wood, 0.05, 5);
  }
  if (p.shells) {
    for (let i = 0; i < Math.round(W * 0.6); i++) {
      const x = (r() - 0.5) * W * 0.95, z = hiZ(x) + (r() - 0.5) * 2.2, y = h(x, z);
      if (r() < 0.45) props.solid.push({ g: new THREE.IcosahedronGeometry(0.16 + r() * 0.2, 0).scale(1.6, 0.25, 0.7).rotateY(r() * 3).translate(x, y + 0.03, z), c: C.weed, n: 'wrack' });
      else if (r() < 0.5) props.solid.push({ g: new THREE.ConeGeometry(0.035, 0.1, 5).rotateZ(Math.PI / 2).rotateY(r() * 6).translate(x, y + 0.03, z), c: C.shell, n: 'shell' });
      else props.solid.push({ g: new THREE.IcosahedronGeometry(0.045, 0).scale(1, 0.35, 0.8).rotateY(r() * 6).translate(x, y + 0.015, z), c: C.shell, n: 'clam' });
    }
  }

  // Vegetation (sways in the sea breeze)
  const veg = P.sub('vegetation', [0, 0, 0]);
  const swayPush = (items, ph, y0, y1) => { for (const it of items) veg.sway.push({ g: swayify(it.g, ph, y0, y1), c: it.c, n: it.n }); };
  if (p.vegetation === 'dunegrass' || p.vegetation === 'mixed') {
    for (let i = 0; i < Math.round(W * 0.7); i++) {
      const x = (r() - 0.5) * W * 0.95, z = shoreZ(x) + 17 + r() * (hd - shoreZ(x) - 18), y = h(x, z);
      if (y < 1.3) continue;
      const tmp = [];
      addReeds(tmp, x, y - 0.05, z, 7, 0.75, [C.grass, C.grassDark, C.dune], p.seed + i, 0.35);
      swayPush(tmp, r() * 6.28, y, y + 2.4);
    }
  }
  if (p.vegetation === 'palms' || p.vegetation === 'mixed') {
    const n = Math.max(2, Math.round(W / 14));
    for (let i = 0; i < n; i++) {
      const x = -hw + (i + 0.5 + (r() - 0.5) * 0.6) * (W / n), z = shoreZ(x) + 13 + r() * 9, y = h(x, z), ph = 7 + r() * 4;
      const tmp = [];
      addPalm(tmp, x, y, z, ph, [C.palm, C.frond, C.grassDark], p.seed + i * 3, 0.12 + r() * 0.12);
      swayPush(tmp, r() * 6.28, y, y + ph * 1.1);
    }
  }

  const waterMat = makeWaterMaterial({ waves, opacity: 0.84, foam: C.foam, streakAlong: 0.35, streakAcross: 0.05, roughness: 0.14, cap: [Qs * 0.9, Qs * 1.15] });
  const swayMat = makeSwayMaterial({ amp: 0.35, freq: 1.4, dir: [0.3, 1] });
  finalize(g, P, p, C, { waterMat, swayMat, ground: { h, col: terrainCol, w: W, d: D } });
  g.userData.surface = makeSurface(g, (lx, lz, t, wx, wz) => {
    let y = 0;
    for (const w of waves) {
      const k = (2 * Math.PI) / w[3], c = Math.sqrt(9.81 / k);
      y += (w[2] / k) * Math.sin(k * (w[0] * wx + w[1] * wz - c * t));
    }
    return p.tide + y * wWeight(depthAt(lx, lz));
  });
  return g;
}
export default createAsset;
