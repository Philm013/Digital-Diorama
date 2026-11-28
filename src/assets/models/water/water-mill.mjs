/*
 * WATER MILL (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A working grist mill. Water runs along a timber flume on trestles and pours onto an overshot
 * wheel (or a stream drives the paddles of an undershot wheel); the wheel's speed follows the flow
 * (ω = v / r), filled buckets spill as they descend and the tailrace churns away. The
 * stone-and-timber mill house is hollow and enterable: real door and window openings, plank
 * floors, an upper storey, millstones and pit wheel turning on the same axle inside, and glowing
 * windows at night.
 *
 * QUICK START
 *   import { createAsset } from './water-mill.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // wheel on the −X wall; tailrace flows toward +Z
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | whitewashed | redBrick | weathered | autumn — Theme
 *   wheelType           overshot | undershot — Wheel Type
 *   wheelDiameter       3–10 m (default 6) — Wheel Diameter
 *   flow                0.3–3 m/s (default 1.5) — Flow Speed
 *   buildingWidth       6–14 m (default 9) — Mill Width
 *   buildingDepth       5–10 m (default 7) — Mill Depth
 *   floors              1–3 (default 2) — Storeys
 *   roofPitch           0.3–1 (default 0.6) — Roof Pitch
 *   chimney             on/off (default on) — Chimney
 *   signText            text (default "GRIST MILL") — Sign Text
 *   diorama             on/off (default on) — Diorama Sides
 *   chainEnds           on/off (default off) — Standard Ends
 *   seed                1–999 (default 6) — Seed
 *   stone               colour (default #9a8f80) — Stone Colour
 *   stoneDark           colour (default #7a7062) — Stone Dark Colour
 *   timber              colour (default #d9c9a8) — Timber Colour
 *   beam                colour (default #5f4632) — Beam Colour
 *   roof                colour (default #7a4a35) — Roof Colour
 *   wood                colour (default #8a6a45) — Wood Colour
 *   woodDark            colour (default #5f4632) — Wood Dark Colour
 *   iron                colour (default #3a3a3a) — Iron Colour
 *   glass               colour (default #8fb8cc) — Glass Colour
 *   millstone           colour (default #b8b2a6) — Millstone Colour
 *   ground              colour (default #7fa057) — Ground Colour
 *   dirt                colour (default #8a7458) — Dirt Colour
 *   water               colour (default #4f8f9a) — Water Colour
 *   deep                colour (default #2a5f6a) — Deep Colour
 *   foam                colour (default #f4fbff) — Foam Colour
 *   lamp                colour (default #ffcf7a) — Lamp Colour
 *   soil                colour (default #5a4634) — Soil Colour
 *   sign                colour (default #2a2018) — Sign Colour
 *
 * SPECS  14,048 triangles at defaults, 5 materials, 12 draw calls when merged,
 *        20.4 x 12.5 x 25.0 m (W x H x D, real-world scale).
 * PARTS animate: wheel (rotate x 0…360°), door (rotate y 0…-100°), sluice (translate y 0…0.6 m)
 *        detach: wheel, door, flume, roof, interior, sluice, spill
 *        night: windows
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.ports.{inlet, outlet}
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = {
  stone: '#9a8f80', stoneDark: '#7a7062', timber: '#d9c9a8', beam: '#5f4632', roof: '#7a4a35', wood: '#8a6a45', woodDark: '#5f4632', iron: '#3a3a3a',
  glass: '#8fb8cc', millstone: '#b8b2a6', ground: '#7fa057', dirt: '#8a7458', water: '#4f8f9a', deep: '#2a5f6a', foam: '#f4fbff', lamp: '#ffcf7a', soil: '#5a4634', sign: '#2a2018',
};
export const COLORWAYS = {
  'default': { ...BASE },
  whitewashed: { ...BASE, stone: '#e8e4dc', stoneDark: '#c8c2b6', timber: '#f2eee6', roof: '#4a4e55' },
  redBrick: { ...BASE, stone: '#a0503a', stoneDark: '#7a3a2a', timber: '#e0d2b8', roof: '#3f3f44' },
  weathered: { ...BASE, stone: '#8a8a84', stoneDark: '#6a6a64', timber: '#a8a090', roof: '#5a5a55', wood: '#7a7468', woodDark: '#5a564e' },
  autumn: { ...BASE, ground: '#a89a50', roof: '#8a3a2a' },
};
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  wheelType: { type: 'choice', default: 'overshot', options: ['overshot', 'undershot'], label: 'Wheel Type', affects: 'geometry', describe: 'Overshot: fed from a flume above. Undershot: paddles dip into the stream.' },
  wheelDiameter: { type: 'range', default: 6, min: 3, max: 10, step: 0.25, unit: 'm', label: 'Wheel Diameter', affects: 'geometry', describe: 'Outer diameter of the water wheel.' },
  flow: { type: 'range', default: 1.5, min: 0.3, max: 3, step: 0.05, unit: 'm/s', label: 'Flow Speed', affects: 'geometry', describe: 'Water speed; the wheel turns at v / r.' },
  buildingWidth: { type: 'range', default: 9, min: 6, max: 14, step: 0.5, unit: 'm', label: 'Mill Width', affects: 'geometry', describe: 'Mill house length (X).' },
  buildingDepth: { type: 'range', default: 7, min: 5, max: 10, step: 0.5, unit: 'm', label: 'Mill Depth', affects: 'geometry', describe: 'Mill house depth (Z).' },
  floors: { type: 'range', default: 2, min: 1, max: 3, step: 1, label: 'Storeys', affects: 'geometry', describe: 'Number of storeys (3 m each).' },
  roofPitch: { type: 'range', default: 0.6, min: 0.3, max: 1, step: 0.05, label: 'Roof Pitch', affects: 'geometry', describe: 'Roof rise per half-span.' },
  chimney: { type: 'toggle', default: true, label: 'Chimney', affects: 'geometry', describe: 'Stone chimney on the east gable.' },
  signText: { type: 'text', default: 'GRIST MILL', maxLength: 16, label: 'Sign Text', affects: 'geometry', describe: 'Lettering on the board above the door.' },
  diorama: { type: 'toggle', default: true, label: 'Diorama Sides', affects: 'geometry', describe: 'Cut-away soil and tailrace sections. Off: a short flange so the yard can sit in surrounding terrain.' },
  chainEnds: { type: 'toggle', default: false, label: 'Standard Ends', affects: 'geometry', describe: 'Blend the tailrace ends (and the undershot inlet) to the shared river cross-section so a brook can feed the mill and a river carry its water on seamlessly.' },
  seed: { type: 'range', default: 6, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {
  wheel: { axis: 'x', range: [0, 360], describe: 'Water wheel + axle + pit wheel (auto-driven by the flow).' },
  door: { axis: 'y', range: [0, -100], describe: 'Front door swings inward.' },
  sluice: { type: 'translate', axis: 'y', range: [0, 0.6], describe: 'Flume sluice board.' },
};
export const detach = ['wheel', 'door', 'flume', 'roof', 'interior', 'sluice', 'spill'];
export const night = { windows: { color: '#ffcf7a', intensity: 0.8, distance: 12, offset: [4.5, 1.5, 0], describe: 'Warm lamplight in the windows and a lantern by the door.' } };
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

const GLYPHS = {
  A: '003a60|1454', B: '000a4a59574606|4655514000', C: '684a2a0802204062', D: '000a3a67633000',
  E: '6a0a0060|0545', F: '6a0a00|0545', G: '684a2a08022040626434', H: '000a|606a|0565',
  I: '1a5a|3a30|1050', J: '5a52301002', K: '000a|6a04|2660', L: '0a0060', M: '000a356a60',
  N: '000a606a', O: '204062684a2a080220', P: '000a4a68674505', Q: '204062684a2a080220|4360',
  R: '000a4a68674505|3560', S: '694a2a080725456362402001', T: '0a6a|3a30', U: '0a022040626a',
  V: '0a306a', W: '0a1036506a', X: '006a|0a60', Y: '0a356a|3530', Z: '0a6a0060',
  '0': '204062684a2a080220', '1': '183a30|1050', '2': '082a4a68670060', '3': '0a6a36566562402002',
  '4': '404a0464', '5': '6a0a06466462402001', '6': '694a2a070220406264462604', '7': '0a6a20',
  '8': '2507082a4a6867452503022040626345', '9': '01204063684a2a0806244466',
  '-': '1555', '.': '2030312120', '/': '105a', ':': '2333342423|2636372726', "'": '3a39', ',': '2030312120|2110'
};

function textWidth(str, size) {
  const s = String(str || '').toUpperCase();
  return s.length ? (s.length * 8 - 2) * (size / 10) : 0;
}

function addText(parts, str, size, cx, cy, hex, thick, mtx = null, strokeW = 0) {
  const u = size / 10, adv = 8 * u;
  const s = String(str || '').toUpperCase();
  const sw = strokeW || size * 0.145;
  let x = cx - textWidth(s, size) / 2;

  for (const chr of s) {
    const gl = GLYPHS[chr];
    if (gl) {
      for (const sub of gl.split('|')) {
        const pts = [];
        for (let i = 0; i < sub.length; i += 2) {
          pts.push([x + parseInt(sub[i], 16) * u, cy + parseInt(sub[i + 1], 16) * u]);
        }
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
          if (len < 1e-6) continue;
          const bar = new THREE.BoxGeometry(len + sw * 0.6, sw, thick);
          bar.rotateZ(Math.atan2(dy, dx));
          bar.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0);
          if (mtx) bar.applyMatrix4(mtx);
          parts.push({ g: bar, c: hex });
        }
      }
    }
    x += adv;
  }
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

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'water-mill';
  const P = partsBag();
  const BW = p.buildingWidth, BD = p.buildingDepth, FH = 3, WH = p.floors * FH, t = 0.45, R = p.wheelDiameter / 2, over = p.wheelType === 'overshot';
  const xw = -t - 0.95, wlT = -0.6, yc = over ? R + wlT + 0.25 : R + wlT - 0.75;
  const X0 = xw - 6, X1 = BW + 4, Z0 = -BD / 2 - 9, Z1 = BD / 2 + 9, TW = X1 - X0, TD = Z1 - Z0, cxT = (X0 + X1) / 2, czT = (Z0 + Z1) / 2;
  const h0 = (x, z) => {
    const d = Math.abs(x - xw);
    let y = 0.02 * (noise2(x * 0.3, z * 0.3, p.seed) - 0.5);
    if (over && z < -R * 0.9) y = Math.max(y, 0);
    const ch = over ? smooth(-R * 1.1, -R * 0.6, z) : 1;
    return lerp(y, wlT - 0.9 + 0.5 * (d / 1.4) ** 2, smooth(1.9, 1.2, d) * ch);
  };
  const h = p.chainEnds ? chainEnds(h0, { axis: 'z', lo: Z0, hi: Z1, c: xw, inlet: over ? null : { w: 3, wl: wlT }, outlet: { w: 3, wl: wlT }, len: 7 }) : h0;
  const terrainCol = (x, y, z) => (y < -0.2 ? C.dirt : x > -0.2 && x < BW + 0.2 && Math.abs(z) < BD / 2 + 1.4 ? C.dirt : C.ground);
  const nx = Math.round(TW / 0.4), nz = Math.round(TD / 0.4);
  P.solid.push({ g: heightField(TW, TD, nx, nz, h, terrainCol, cxT, czT), c: null, n: 'yard' });
  tileEdge(p, P.solid, P.water, TW, TD, nx, nz, h, -2.5, [C.ground, C.soil, C.stoneDark], (x, z) => (Math.abs(x - xw) < 1.6 && (!over || z > -R * 0.9) ? wlT : null), C.deep, cxT, czT);
  // Tailrace / millrace
  const trPts = []; for (let z = over ? -R * 0.85 : Z0; z <= Z1 + 0.01; z += 0.5) trPts.push([xw, wlT, z]);
  P.water.push({ g: waterify(waterRibbon(trPts, 1.5, 5), (x, y, z, s, u) => ({ s, u, speed: p.flow * (over ? 0.8 : 1) * (1 - 0.4 * (u / 1.4) ** 2), foam: 0.06 + 0.75 * smooth(R * 1.6, 0, Math.abs(z - (over ? R * 0.3 : 0))), mode: 2, ripple: 1, bump: over ? 0 : 0.12 * Math.exp(-(((z + 0.4) / 0.6) ** 2)), color: mixC(C.water, C.deep, 0.3) })), c: null, n: 'tailrace' });

  // ── Mill house: storeys of walls with REAL openings, floors, joists, gable roof ──
  const door = { x: BW * 0.55, w: 1.2, h: 2.3 }, winA = (y0) => [{ x: BW * 0.2, y: y0, w: 0.9, h: 1.1 }, { x: BW * 0.85, y: y0, w: 0.9, h: 1.1 }];
  const rise = (BD / 2) * p.roofPitch, glowMat = makeGlowMaterial();
  for (let f = 0; f < p.floors; f++) {
    const y = f * FH, top = f === p.floors - 1, col = f === 0 ? C.stone : C.timber, tt = f === 0 ? t : 0.25;
    const front = wallMtx(0, y, BD / 2 - tt, 0), back = wallMtx(BW, y, -BD / 2 + tt, Math.PI), west = wallMtx(tt, y, -BD / 2, -Math.PI / 2), east = wallMtx(BW - tt, y, BD / 2, Math.PI / 2);
    const fo = f === 0 ? [door, winA(1.0)[0], winA(1.0)[1]] : winA(0.9), bo = winA(f === 0 ? 1.0 : 0.9);
    const fa = Math.min(p.floors - 1, Math.max(0, Math.floor(yc / FH))), ay0 = Math.max(0.15, Math.min(FH - 0.75, yc - y - 0.3));
    const wo = f === fa ? [{ x: BD / 2, y: ay0, w: 0.55, h: 0.6 }] : f === 0 ? [] : [{ x: BD / 2 + 1.6, y: 0.9, w: 0.8, h: 1.0 }];
    const eo = [{ x: BD / 2, y: 0.9, w: 0.8, h: 1.0 }];
    P.solid.push({ g: wallGeo(BW, FH, tt, fo).applyMatrix4(front), c: col, n: 'front-wall' });
    P.solid.push({ g: wallGeo(BW, FH, tt, bo).applyMatrix4(back), c: col, n: 'back-wall' });
    P.solid.push({ g: wallGeo(BD, FH, tt, wo, top ? rise : 0).applyMatrix4(west), c: col, n: 'west-wall' });
    P.solid.push({ g: wallGeo(BD, FH, tt, eo, top ? rise : 0).applyMatrix4(east), c: col, n: 'east-wall' });
    for (const [mtx, list] of [[front, fo], [back, bo], [west, wo], [east, eo]]) for (const o of list) {
      frameOpening(P.solid, o, tt, C.beam, mtx);
      if ((o.y ?? 0) > 0.01) { P.glass.push({ g: paneGeo(o, tt, mtx), c: C.glass, n: 'pane' }); P.glow.push({ g: paneGeo(o, tt * 0.3, mtx), c: C.lamp, n: 'window-glow' }); }
    }
    if (f > 0) for (const s of [-1, 1]) P.solid.push({ g: new THREE.BoxGeometry(0.22, FH, 0.22).translate(s < 0 ? 0.11 : BW - 0.11, y + FH / 2, BD / 2 - 0.11), c: C.beam, n: 'corner-post' });
  }
  const interior = P.sub('interior', [BW / 2, 0, 0]);
  interior.solid.push({ g: new THREE.BoxGeometry(BW - 2 * t, 0.08, BD - 2 * t).translate(BW / 2, 0.04, 0), c: C.wood, n: 'ground-floor' });
  for (let f = 1; f < p.floors; f++) {
    for (let k = 0; k < Math.round(BW / 0.9); k++) interior.solid.push({ g: new THREE.BoxGeometry(0.16, 0.24, BD - 0.4).translate(0.5 + k * 0.9, f * FH - 0.14, 0), c: C.beam, n: 'joist' });
    interior.solid.push({ g: new THREE.BoxGeometry(BW - 2.4, 0.06, BD - 0.5).translate(BW / 2 + 0.9, f * FH + 0.02, 0), c: C.wood, n: 'upper-floor' });
    for (let k = 0; k < 10; k++) interior.solid.push({ g: new THREE.BoxGeometry(0.9, 0.06, 0.28).translate(0.9, (f - 1) * FH + 0.3 * (k + 1), -BD / 2 + 0.8 + k * 0.3), c: C.woodDark, n: 'stair-tread' });
  }
  for (let k = 0; k < Math.round(BW / 1.2); k++) interior.solid.push({ g: new THREE.BoxGeometry(0.14, 0.18, BD - 0.3).translate(0.6 + k * 1.2, WH - 0.09, 0), c: C.beam, n: 'tie-beam' });
  interior.solid.push({ g: new THREE.CylinderGeometry(0.75, 0.75, 0.22, 16).translate(2.2, 1.15, 0), c: C.millstone, n: 'bedstone' });
  interior.solid.push({ g: new THREE.CylinderGeometry(0.75, 0.75, 0.22, 16).translate(2.2, 1.39, 0), c: C.millstone, n: 'runner-stone' });
  interior.solid.push({ g: new THREE.BoxGeometry(2, 1.0, 2).translate(2.2, 0.5, 0), c: C.woodDark, n: 'hurst-frame' });
  interior.solid.push({ g: new THREE.ConeGeometry(0.6, 0.7, 4).rotateX(Math.PI).rotateY(Math.PI / 4).translate(2.2, 2.0, 0), c: C.wood, n: 'hopper' });
  // Roof (ridge along X) + chimney
  const roof = P.sub('roof', [BW / 2, WH, 0]);
  addGableRoof(roof.solid, BW, BD, rise, 0.45, 0.14, C.roof, BW / 2, WH, 0);
  roof.solid.push({ g: new THREE.BoxGeometry(BW + 1, 0.12, 0.25).translate(BW / 2, WH + rise + 0.06, 0), c: C.beam, n: 'ridge' });
  if (p.chimney) roof.solid.push({ g: new THREE.BoxGeometry(0.8, rise + 1.6, 0.8).translate(BW - 1.1, WH + (rise + 1.6) / 2 + 0.3, -BD * 0.15), c: C.stoneDark, n: 'chimney' });
  // Door (hinged on its left jamb) + sign + lantern
  const dr = P.sub('door', [door.x - door.w / 2, 0, BD / 2 - t / 2]);
  dr.solid.push({ g: new THREE.BoxGeometry(door.w - 0.04, door.h - 0.03, 0.06).translate(door.x, door.h / 2, BD / 2 - t / 2), c: C.woodDark, n: 'door-leaf' });
  dr.solid.push({ g: new THREE.BoxGeometry(0.06, 0.06, 0.12).translate(door.x + door.w * 0.35, 1.1, BD / 2 - t / 2 + 0.06), c: C.iron, n: 'handle' });
  const sw = Math.max(1.6, textWidth(p.signText, 0.28) + 0.4);
  P.solid.push({ g: new THREE.BoxGeometry(sw, 0.5, 0.05).translate(door.x, door.h + 0.55, BD / 2 + 0.03), c: C.timber, n: 'signboard' });
  addText(P.solid, p.signText, 0.28, door.x, door.h + 0.41, C.sign, 0.03, new THREE.Matrix4().makeTranslation(0, 0, BD / 2 + 0.07));
  P.glow.push({ g: new THREE.IcosahedronGeometry(0.1, 1).translate(door.x + door.w / 2 + 0.35, 2.2, BD / 2 + 0.15), c: C.lamp, n: 'lantern' });
  // ── Water wheel (+ axle + pit wheel inside), rotating about X ──
  const wheel = P.sub('wheel', [xw, yc, 0]), wd = 1.0, nB = Math.round((2 * Math.PI * R) / 0.5);
  for (const s of [-1, 1]) {
    wheel.solid.push({ g: new THREE.TorusGeometry(R, 0.07, 4, 40).rotateY(Math.PI / 2).translate(xw + (s * wd) / 2, yc, 0), c: C.wood, n: 'rim' });
    wheel.solid.push({ g: new THREE.TorusGeometry(R * 0.82, 0.05, 4, 36).rotateY(Math.PI / 2).translate(xw + (s * wd) / 2, yc, 0), c: C.wood, n: 'shroud' });
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; addWire(wheel.solid, [xw + (s * wd) / 2, yc, 0], [xw + (s * wd) / 2, yc + Math.cos(a) * R, Math.sin(a) * R], C.woodDark, 0.06, 4); }
  }
  for (let k = 0; k < nB; k++) {
    const a = (k / nB) * Math.PI * 2, cy = Math.cos(a), sz = Math.sin(a), rr = over ? R * 0.9 : R * 0.88;
    const b = new THREE.BoxGeometry(wd, 0.05, over ? R * 0.2 : R * 0.26).translate(0, 0, 0).rotateX(-a + (over ? 0.5 : 0)).translate(xw, yc + cy * rr, sz * rr);
    wheel.solid.push({ g: b, c: C.wood, n: over ? 'bucket' : 'paddle' });
  }
  addCylinder(wheel.solid, 0.18, 0.18, wd + 0.3, 10, xw, yc, 0, 0, 0, Math.PI / 2, C.woodDark);
  addCylinder(wheel.solid, 0.11, 0.11, t + 2.2 - xw * 0 + Math.abs(xw), 8, (xw + t + 1.4) / 2, yc, 0, 0, 0, Math.PI / 2, C.iron);
  if (yc > 0.9 && yc < WH - 0.6) {
    wheel.solid.push({ g: new THREE.TorusGeometry(Math.min(1.1, yc - Math.floor(yc / FH) * FH - 0.15), 0.07, 4, 24).rotateY(Math.PI / 2).translate(t + 1.2, yc, 0), c: C.woodDark, n: 'pit-wheel' });
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, rr = Math.min(1.1, yc - Math.floor(yc / FH) * FH - 0.15); wheel.solid.push({ g: new THREE.BoxGeometry(0.14, 0.1, 0.1).translate(t + 1.25, yc + Math.cos(a) * rr, Math.sin(a) * rr), c: C.wood, n: 'cog' }); }
  }
  // ── Flume on trestles (overshot) ──
  const emitters = [];
  const yF = yc + R + 0.55, zEnd = R * 0.18;
  if (over) {
    const fl = P.sub('flume', [xw, yF, 0]), z0 = Z0;
    fl.solid.push({ g: new THREE.BoxGeometry(1.1, 0.08, zEnd - z0).translate(xw, yF - 0.3, (z0 + zEnd) / 2), c: C.wood, n: 'flume-bottom' });
    for (const s of [-1, 1]) fl.solid.push({ g: new THREE.BoxGeometry(0.08, 0.45, zEnd - z0).translate(xw + s * 0.55, yF - 0.1, (z0 + zEnd) / 2), c: C.wood, n: 'flume-side' });
    for (let z = z0 + 1; z < -R * 0.9; z += 2.6) {
      const gy = h(xw, z);
      for (const s of [-1, 1]) addWire(fl.solid, [xw + s * 0.9, gy, z], [xw + s * 0.45, yF - 0.34, z], C.woodDark, 0.08, 4);
      addWire(fl.solid, [xw - 0.7, (gy + yF) / 2, z], [xw + 0.7, (gy + yF) / 2, z], C.woodDark, 0.05, 4);
    }
    const fpts = []; for (let z = z0; z <= zEnd + 0.01; z += 0.5) fpts.push([xw, yF - 0.18, z]);
    fl.water.push({ g: waterify(waterRibbon(fpts, 0.5, 3), (x, y, z, s, u) => ({ s, u, speed: p.flow, foam: 0.05 + 0.4 * smooth(zEnd - 2, zEnd, z), mode: 2, color: mixC(C.water, C.deep, 0.2) })), c: null, n: 'flume-water' });
    const sl = P.sub('sluice', [xw, yF, z0 + 2]);
    sl.solid.push({ g: new THREE.BoxGeometry(1.0, 0.7, 0.06).translate(xw, yF + 0.05, z0 + 2), c: C.woodDark, n: 'sluice-board' });
    const tf = Math.sqrt((2 * 0.7) / 9.81), pour = [];
    for (let i = 0; i <= 8; i++) { const tt = (i / 8) * tf; pour.push([xw, yF - 0.18 - 0.5 * 9.81 * tt * tt, zEnd + p.flow * tt]); }
    P.water.push({ g: waterify(waterRibbon(pour, 0.45, 3, [1, 0, 0]), (x, y, z, s, u) => ({ s, u, speed: p.flow + 1.5, mode: 1, foam: 0.5, color: mixC(C.water, C.foam, 0.2) })), c: null, n: 'pour' });
    emitters.push(makeEmitter('spill', {
      count: 140, shape: 'drop', color: C.water, stretch: 0.05, floor: wlT, seed: p.seed,
      spawn: (i, rr) => { const a = 0.6 + rr() * 1.9, x = xw + (rr() - 0.5) * wd * 0.9; return { p: [x, yc + Math.cos(a) * R * 0.88, Math.sin(a) * R * 0.88], v: [0, -(p.flow / R) * R * Math.sin(a) * 0.6, (p.flow / R) * R * Math.cos(a) * 0.6], life: 1.6, size: 0.05 + rr() * 0.06 }; },
    }));
  } else {
    emitters.push(makeEmitter('spill', {
      count: 90, shape: 'drop', color: C.foam, stretch: 0.04, floor: wlT, seed: p.seed,
      spawn: (i, rr) => ({ p: [xw + (rr() - 0.5) * wd, wlT + 0.05, (rr() - 0.3) * R * 0.8], v: [(rr() - 0.5) * 0.6, 0.8 + rr() * 1.4, 0.6 + rr()], life: 0.6, size: 0.04 + rr() * 0.05 }),
    }));
  }
  const waterMat = makeWaterMaterial({ opacity: 0.86, foam: C.foam, streakAlong: 0.5, streakAcross: 1.5, roughness: 0.1 });
  const omega = ((over ? 1 : -1) * p.flow * (over ? 0.8 : 1)) / R;
  return finalize(g, P, p, C, {
    waterMat, glowMat, emitters,
    tick: (t, dt, drive) => drive('wheel', ((omega * t * 180) / Math.PI) % 360),
    ground: { h, col: terrainCol, w: TW, d: TD, cx: cxT, cz: czT },
    ports: { inlet: { position: [xw, over ? yF - 0.18 : wlT, Z0], direction: [0, 0, 1], width: over ? 1.0 : 3, level: over ? yF - 0.18 : wlT, s: 0 }, outlet: { position: [xw, wlT, Z1], direction: [0, 0, 1], width: 3, level: wlT, s: 0 } },
  });
}
export default createAsset;
