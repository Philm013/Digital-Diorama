/*
 * FISHING BOAT (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A working inshore trawler: flared lofted hull with bulwarks, boot-top and rubbing strake, and an
 * enterable wheelhouse — real door and window openings, console, wheel, chair and chart table
 * inside, an interior lamp for night. Outrigger booms hinge down to fish with their stays and tow
 * wires, a net drum turns on the stern gantry (or a longliner's buoy flags / a crabber's pot
 * stack), the propeller spins and the exhaust puffs smoke. Navigation and deck lights, fenders,
 * life rings, a windlass and anchor, and the boat's name on bows and transom. Bow waves and prop
 * wash trail astern.
 *
 * QUICK START
 *   import { createAsset } from './fishing-boat.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   boat.userData.waterSurface = sea.userData.surface; boat.userData.matchWaves(sea);
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | redTrawler | seaGreen | weathered | yellowBlue — Theme
 *   length              8–24 m (default 12) — Length
 *   boatName            text (default "MARGARET") — Boat Name
 *   outriggers          fishing | stowed | none — Outriggers
 *   gear                trawler | longliner | crabber — Gear
 *   speed               0–11 kn (default 6) — Speed
 *   showSmoke           on/off (default on) — Exhaust Smoke
 *   deckLights          on/off (default on) — Deck Lights
 *   swell               0–2.5 m (default 0.8) — Swell
 *   waterPatch          on/off (default on) — Water Patch
 *   hull                colour (default #1f3a5f) — Hull Colour
 *   bottom              colour (default #8a2a20) — Bottom Colour
 *   boot                colour (default #f2f2ec) — Boot Colour
 *   deck                colour (default #8a8a82) — Deck Colour
 *   deckDark            colour (default #7c7c74) — Deck Dark Colour
 *   bulwark             colour (default #e8e4da) — Bulwark Colour
 *   trim                colour (default #f4f4ee) — Trim Colour
 *   house               colour (default #f2f0ea) — House Colour
 *   houseTrim           colour (default #1f3a60) — House Trim Colour
 *   window              colour (default #2a3a48) — Window Colour
 *   roof                colour (default #c8c4bc) — Roof Colour
 *   steel               colour (default #5a6068) — Steel Colour
 *   net                 colour (default #3a7a5a) — Net Colour
 *   float               colour (default #f28a1a) — Float Colour
 *   drum                colour (default #c8302a) — Drum Colour
 *   tyre                colour (default #1e1e22) — Tyre Colour
 *   text                colour (default #fafaf4) — Text Colour
 *   smoke               colour (default #5a5a5e) — Smoke Colour
 *   crate               colour (default #2f7fc8) — Crate Colour
 *   interior            colour (default #b8a890) — Interior Colour
 *   lightRed            colour (default #ff3a2a) — Light Red Colour
 *   lightGreen          colour (default #2aff6a) — Light Green Colour
 *   lightWhite          colour (default #fff4d8) — Light White Colour
 *   lamp                colour (default #ffe0a0) — Lamp Colour
 *   water               colour (default #2f7f99) — Water Colour
 *   deep                colour (default #164c66) — Deep Colour
 *   foam                colour (default #f8fcff) — Foam Colour
 *   seabed              colour (default #55605a) — Seabed Colour
 *
 * SPECS  13,758 triangles at defaults, 6 materials, 21 draw calls when merged,
 *        48.0 x 9.9 x 75.8 m (W x H x D, real-world scale).
 * PARTS animate: door (rotate y 0…-105°), outrigger-port (rotate z 0…85°), outrigger-starboard
 * (rotate z -85…0°), net-drum (rotate x 0…360°), propeller (rotate z 0…360°), radar (rotate y
 * 0…360°), rudder (rotate y -35…35°)
 *        detach: house, outrigger-port, outrigger-starboard, gear, net-drum, wake, water-patch
 *        night: house-light
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.waterSurface · userData.surface · userData.matchWaves(asset)
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = {
  hull: '#1f3a5f', bottom: '#8a2a20', boot: '#f2f2ec', deck: '#8a8a82', deckDark: '#7c7c74', bulwark: '#e8e4da', trim: '#f4f4ee', house: '#f2f0ea', houseTrim: '#1f3a60', window: '#2a3a48',
  roof: '#c8c4bc', steel: '#5a6068', net: '#3a7a5a', float: '#f28a1a', drum: '#c8302a', tyre: '#1e1e22', text: '#fafaf4', smoke: '#5a5a5e', crate: '#2f7fc8', interior: '#b8a890',
  lightRed: '#ff3a2a', lightGreen: '#2aff6a', lightWhite: '#fff4d8', lamp: '#ffe0a0', water: '#2f7f99', deep: '#164c66', foam: '#f8fcff', seabed: '#55605a',
};
export const COLORWAYS = {
  'default': { ...BASE },
  redTrawler: { ...BASE, hull: '#a8302a', houseTrim: '#a8302b', bottom: '#2a2a2a', drum: '#2f5f8f' },
  seaGreen: { ...BASE, hull: '#2f6a5a', houseTrim: '#2f6a5b', bottom: '#7a2a20', boot: '#f2c81e' },
  weathered: { ...BASE, hull: '#5a6a72', house: '#d8d2c4', houseTrim: '#8a5a3a', bulwark: '#c8c2b4', trim: '#d8d2c5', deck: '#6a6a62', deckDark: '#5f5f58' },
  yellowBlue: { ...BASE, hull: '#e8c84a', houseTrim: '#2f5f8f', bottom: '#2f5f90', boot: '#1e1e22', text: '#2f5f91' },
};
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  length: { type: 'range', default: 12, min: 8, max: 24, step: 0.5, unit: 'm', label: 'Length', affects: 'geometry', describe: 'Length overall (everything scales with it).' },
  boatName: { type: 'text', default: 'MARGARET', maxLength: 12, label: 'Boat Name', affects: 'geometry', describe: 'Name lettered on both bows and the transom.' },
  outriggers: { type: 'choice', default: 'fishing', options: ['fishing', 'stowed', 'none'], label: 'Outriggers', affects: 'geometry', describe: 'Booms lowered to fish (tow wires in the water), raised, or none.' },
  gear: { type: 'choice', default: 'trawler', options: ['trawler', 'longliner', 'crabber'], label: 'Gear', affects: 'geometry', describe: 'Stern gantry + net drum, buoy flags + line tubs, or a stack of crab pots.' },
  speed: { type: 'range', default: 6, min: 0, max: 11, step: 0.25, unit: 'kn', label: 'Speed', affects: 'geometry', describe: 'Speed through the water (wake, propeller, smoke drift).' },
  showSmoke: { type: 'toggle', default: true, label: 'Exhaust Smoke', affects: 'geometry', describe: 'Puffs from the stack.' },
  deckLights: { type: 'toggle', default: true, label: 'Deck Lights', affects: 'geometry', describe: 'Work floodlights on the gantry and mast (glow at night).' },
  swell: { type: 'range', default: 0.8, min: 0, max: 2.5, step: 0.05, unit: 'm', label: 'Swell', affects: 'geometry', describe: 'Wave height of the preview water patch.' },
  waterPatch: { type: 'toggle', default: true, label: 'Water Patch', affects: 'geometry', describe: 'Own patch of water to float on (turn off when placing on another water asset).' },
  ...zoneParams(),
};
export const rig = {
  door: { axis: 'y', range: [0, -105], describe: 'Wheelhouse door.' },
  'outrigger-port': { axis: 'z', range: [0, 85], describe: 'Port outrigger boom (0 = horizontal, 85 = stowed upright).' },
  'outrigger-starboard': { axis: 'z', range: [-85, 0], describe: 'Starboard outrigger boom (0 = horizontal, −85 = stowed upright).' },
  'net-drum': { axis: 'x', range: [0, 360], describe: 'Net drum rotation.' },
  propeller: { axis: 'z', range: [0, 360], describe: 'Propeller (spun automatically when underway).' },
  radar: { axis: 'y', range: [0, 360], describe: 'Radar scanner (spun automatically).' },
  rudder: { axis: 'y', range: [-35, 35], describe: 'Rudder.' },
};
export const detach = ['house', 'outrigger-port', 'outrigger-starboard', 'gear', 'net-drum', 'wake', 'water-patch'];
export const night = { 'house-light': { color: '#ffe0a0', intensity: 0.7, distance: 8, offset: [0, 3, 2], describe: 'Wheelhouse lamp (anchored to the house-light node); nav and deck lights glow.' } };
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
 * n stretchy rods (arms, stays, tow wires, mooring chain) as ONE InstancedMesh (1 draw call).
 * mesh.userData.set(i, a, b) spans rod i between points a, b given in the mesh's parent space.
 */
function makeLinks(name, n, r, hex, segs = 5) {
  const geo = prep(new THREE.CylinderGeometry(r, r, 1, segs, 1, false).translate(0, 0.5, 0), hex);
  geo.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(geo, MAT, n);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  const Y = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), m = new THREE.Matrix4(), pa = new THREE.Vector3();
  mesh.userData.set = (i, a, b) => {
    d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = d.length();
    if (len < 1e-6) m.makeScale(1e-6, 1e-6, 1e-6).setPosition(a[0], a[1], a[2]);
    else { q.setFromUnitVectors(Y, d.multiplyScalar(1 / len)); s.set(1, len, 1); pa.set(a[0], a[1], a[2]); m.compose(pa, q, s); }
    mesh.setMatrixAt(i, m);
    mesh.instanceMatrix.needsUpdate = true;
  };
  for (let i = 0; i < n; i++) mesh.userData.set(i, [0, 0, 0], [0, 0, 0]);
  return mesh;
}
/** Point p (array) in node-local space → array in ref-local space (world matrices must be current). */
function localTo(node, p, ref) {
  const v = new THREE.Vector3(p[0], p[1], p[2]);
  node.localToWorld(v);
  ref.worldToLocal(v);
  return [v.x, v.y, v.z];
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

/**
 * Buoyancy: bob / pitch / roll `hull` on g.userData.waterSurface (assign any water asset's userData.surface),
 * falling back to a gentle built-in swell. o: { len, beam, amp, period, phase, response, trim, heel, at: [x, z] hull centre, yaw }.
 */
function floatOn(g, hull, t, dt, o) {
  const st = hull.userData.float || (hull.userData.float = { y: 0, px: 0, rz: 0 });
  let y, px, rz;
  const s = g.userData.waterSurface;
  const ox = o.at ? o.at[0] : 0, oz = o.at ? o.at[1] : 0, cyw = Math.cos(o.yaw || 0), syw = Math.sin(o.yaw || 0);
  if (s && s.heightAt) {
    g.updateWorldMatrix(true, false);
    const gy = g.matrixWorld.elements[13], v = new THREE.Vector3();
    const lv = o.level || 0; // local rest water level (non-zero when the asset's own surface sits above its origin)
    const H = (lx, lz) => { v.set(ox + lx * cyw + lz * syw, 0, oz - lx * syw + lz * cyw).applyMatrix4(g.matrixWorld); const h = s.heightAt(v.x, v.z, t); return h === null ? 0 : h - gy - lv; };
    const bow = H(0, o.len / 2), stern = H(0, -o.len / 2), port = H(-o.beam / 2, 0), stbd = H(o.beam / 2, 0);
    y = (bow + stern + port + stbd) / 4;
    px = -Math.atan2(bow - stern, o.len);
    rz = Math.atan2(stbd - port, o.beam);
  } else {
    const a = o.amp ?? 0.08, w = (Math.PI * 2) / (o.period ?? 4.5), ph = (o.phase ?? 0) + ox * 0.37 + oz * 0.23;
    y = a * Math.sin(w * t + ph);
    px = (a * 0.6 * Math.sin(w * t * 0.83 + ph + 1.3)) / Math.max(1, o.len * 0.25);
    rz = (a * 1.1 * Math.sin(w * t * 0.71 + ph + 2.1)) / Math.max(1, o.beam * 0.3);
  }
  const k = dt > 0 ? 1 - Math.exp(-dt * (o.response ?? 4)) : 1;
  st.y += (y - st.y) * k; st.px += (px - st.px) * k; st.rz += (rz - st.rz) * k;
  hull.position.y = (hull.userData.rest ? hull.userData.rest.y : 0) + st.y;
  hull.rotation.x = st.px + (o.trim ?? 0);
  hull.rotation.z = st.rz + (o.heel ?? 0);
}

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'fishing-boat';
  const P = partsBag();
  const L = p.length, k = L / 12, Bm = L * 0.32, hs = P.sub('hull', [0, 0, 0]), deckY = 0.55 * k, r = rng(7);
  const H = boatHull({
    len: L, beam: Bm, draft: 1.15 * k, freeboard: 1.45 * k, sheerRise: 0.55 * k, stern: 'transom', transomBeam: 0.82, tm: 0.45, bowFine: 0.5, fullness: 3.2, vee: 0.5, rocker: 0.35, flare: 0.32,
    stations: 28, ribs: 9, thick: 0.08 * k, inner: true, rubRail: 0.07 * k, bootTop: 0.24 * k, deck: { y: deckY, plank: true },
    cols: { bottom: C.bottom, boot: C.boot, hull: C.hull, inside: C.bulwark, trim: C.trim, deck: C.deck, deckDark: C.deckDark, transom: C.hull },
  });
  hs.solid.push(...H.parts);
  const up = (q, dy) => [q[0], q[1] + dy, q[2]], inner = (t, y) => H.beamAt(t, y, 0.08 * k);
  // Keel bar, skeg, shaft, rudder, propeller
  { const pts = []; for (let i = 0; i <= 10; i++) { const t = 0.08 + (i / 10) * 0.7; pts.push([0, H.keel(t) - 0.1 * k, H.Z(t)]); } hs.solid.push({ g: sweep(pts, () => 0.12 * k, 4, 20, true), c: C.bottom, n: 'keel-bar' }); }
  const zP = H.Z(0.055), yP = H.keel(0.1) + 0.5 * k, rd = P.sub('rudder', [0, yP, H.Z(0.02)], 'hull');
  addWire(hs.solid, [0, yP, zP + 0.25 * k], [0, yP + 0.25 * k, H.Z(0.16)], C.steel, 0.06 * k, 6);
  rd.solid.push({ g: new THREE.BoxGeometry(0.08 * k, 1.1 * k, 0.7 * k).translate(0, yP, H.Z(0.02) - 0.3 * k), c: C.bottom, n: 'rudder-blade' });
  const pr = P.sub('propeller', [0, yP, zP], 'hull');
  pr.solid.push({ g: new THREE.CylinderGeometry(0.1 * k, 0.12 * k, 0.3 * k, 8).rotateX(Math.PI / 2).translate(0, yP, zP), c: C.steel, n: 'hub' });
  for (let i = 0; i < 4; i++) pr.solid.push({ g: new THREE.BoxGeometry(0.32 * k, 0.5 * k, 0.04 * k).rotateY(0.5).translate(0, 0.3 * k, 0).rotateZ((i * Math.PI) / 2).translate(0, yP, zP), c: C.drum, n: 'blade' });
  // Wheelhouse (hollow, enterable): walls with real openings, interior fit-out, roof, mast, radar, lights
  const zB = H.Z(0.5), zF = H.Z(0.73), Dh = zF - zB, Wh = Math.min(inner(0.62, deckY + 0.5) * 2 - 0.5 * k, Bm * 0.62), y0 = deckY + 0.02, wallH = 2.1 * Math.sqrt(k), t = 0.1, house = P.sub('house', [0, 0, 0], 'hull');
  const f = wallMtx(-Wh / 2, y0, zF - t, 0), b = wallMtx(Wh / 2, y0, zB + t, Math.PI), wl = wallMtx(-Wh / 2 + t, y0, zB, -Math.PI / 2), wr = wallMtx(Wh / 2 - t, y0, zF, Math.PI / 2);
  const winF = [0.2, 0.5, 0.8].map((x) => ({ x: Wh * x, y: 1.05, w: Wh * 0.24, h: 0.72 }));
  const door = { x: Wh * 0.3, w: 0.76, h: 1.92 }, winB = [{ x: Wh * 0.73, y: 1.1, w: 0.6, h: 0.55 }], winS = [{ x: Dh * 0.3, y: 1.1, w: 0.62, h: 0.55 }, { x: Dh * 0.72, y: 1.1, w: 0.62, h: 0.55 }];
  for (const [m, len, ops] of [[f, Wh, winF], [b, Wh, [door, ...winB]], [wl, Dh, winS], [wr, Dh, winS]]) {
    house.solid.push({ g: wallGeo(len, wallH, t, ops).applyMatrix4(m), c: C.house, n: 'wall' });
    for (const o of ops) { frameOpening(house.solid, o, t, C.houseTrim, m, 0.06); if ((o.y ?? 0) > 0) house.glass.push({ g: paneGeo(o, t, m), c: C.window, n: 'pane' }); }
  }
  const dx = Wh / 2 - door.x, dr = P.sub('door', [dx + door.w / 2, y0, zB + t / 2], 'house');
  dr.solid.push({ g: new THREE.BoxGeometry(door.w - 0.03, door.h - 0.02, 0.045).translate(dx, y0 + door.h / 2, zB + t / 2), c: C.houseTrim, n: 'door-leaf' });
  dr.glass.push({ g: new THREE.BoxGeometry(door.w * 0.55, 0.45, 0.05).translate(dx, y0 + 1.45, zB + t / 2), c: C.window, n: 'door-light' });
  house.solid.push({ g: new THREE.BoxGeometry(Wh - 2 * t, 0.03, Dh - 2 * t).translate(0, y0 + 0.015, (zB + zF) / 2), c: C.interior, n: 'floor' });
  house.solid.push({ g: new THREE.BoxGeometry(Wh - 0.4, 0.95, 0.5).translate(0, y0 + 0.48, zF - t - 0.27), c: C.interior, n: 'console' });
  house.solid.push({ g: new THREE.BoxGeometry(0.5, 0.3, 0.05).rotateX(-0.5).translate(-Wh * 0.18, y0 + 1.02, zF - t - 0.35), c: C.window, n: 'screen' });
  house.solid.push({ g: new THREE.TorusGeometry(0.28, 0.025, 4, 14).translate(Wh * 0.12, y0 + 1.15, zF - t - 0.62), c: C.drum, n: 'wheel' });
  addWire(house.solid, [Wh * 0.12, y0 + 1.15, zF - t - 0.62], [Wh * 0.12, y0 + 0.95, zF - t - 0.3], C.steel, 0.025, 5);
  addCylinder(house.solid, 0.05, 0.08, 0.6, 6, Wh * 0.12, y0 + 0.3, zF - t - 1.25, 0, 0, 0, C.steel);
  house.solid.push({ g: new THREE.BoxGeometry(0.45, 0.08, 0.45).translate(Wh * 0.12, y0 + 0.62, zF - t - 1.25), c: C.drum, n: 'chair' });
  house.solid.push({ g: new THREE.BoxGeometry(0.45, 0.5, 0.08).translate(Wh * 0.12, y0 + 0.9, zF - t - 1.47), c: C.drum, n: 'chair-back' });
  house.solid.push({ g: new THREE.BoxGeometry(0.55, 0.05, 0.9).translate(-Wh / 2 + t + 0.3, y0 + 0.85, (zB + zF) / 2), c: C.interior, n: 'chart-table' });
  house.solid.push({ g: new THREE.BoxGeometry(Wh - 2 * t, 0.04, Dh - 2 * t).translate(0, y0 + wallH - 0.03, (zB + zF) / 2), c: C.interior, n: 'ceiling' });
  const yR = y0 + wallH;
  house.solid.push({ g: new THREE.BoxGeometry(Wh + 0.3, 0.12, Dh + 0.45).translate(0, yR + 0.06, (zB + zF) / 2 + 0.1), c: C.roof, n: 'roof' });
  house.solid.push({ g: new THREE.BoxGeometry(Wh + 0.3, 0.06, 0.45).rotateX(0.35).translate(0, yR - 0.02, zF + 0.28), c: C.houseTrim, n: 'visor' });
  for (const sg of [1, -1]) house.solid.push({ g: new THREE.TorusGeometry(0.3, 0.07, 6, 14).translate(sg * Wh * 0.28, y0 + 1.55, zB - 0.03), c: C.float, n: 'life-ring' });
  const glowMat = makeGlowMaterial();
  const hl = P.sub('house-light', [0, yR - 0.08, (zB + zF) / 2], 'house');
  hl.glow.push({ g: new THREE.CylinderGeometry(0.16, 0.16, 0.04, 10).translate(0, yR - 0.08, (zB + zF) / 2), c: C.lamp, n: 'cabin-lamp' });
  for (const sg of [1, -1]) house.glow.push({ g: new THREE.BoxGeometry(0.06, 0.16, 0.22).translate(sg * (Wh / 2 + 0.06), yR - 0.3, zF - 0.4), c: sg > 0 ? C.lightRed : C.lightGreen, n: 'sidelight' });
  const mY = yR + 3.4 * k, zMa = (zB + zF) / 2 - 0.2;
  addWire(house.solid, [0, yR + 0.1, zMa], [0, mY, zMa], C.trim, 0.07 * k, 6);
  addWire(house.solid, [-0.7 * k, mY - 0.6 * k, zMa], [0.7 * k, mY - 0.6 * k, zMa], C.trim, 0.04 * k, 5);
  house.glow.push({ g: new THREE.IcosahedronGeometry(0.09, 0).translate(0, mY + 0.1, zMa), c: C.lightWhite, n: 'masthead' });
  const rad = P.sub('radar', [0, yR + 0.55, zF - 0.4], 'house');
  addCylinder(house.solid, 0.12, 0.15, 0.4, 8, 0, yR + 0.32, zF - 0.4, 0, 0, 0, C.trim);
  rad.solid.push({ g: new THREE.BoxGeometry(1.3 * k, 0.12, 0.18).translate(0, yR + 0.6, zF - 0.4), c: C.trim, n: 'scanner' });
  const stack = [Wh * 0.32, yR + 1.3 * k, zB + 0.35];
  addCylinder(house.solid, 0.16 * k, 0.2 * k, 1.3 * k, 8, stack[0], yR + 0.65 * k, stack[2], 0, 0, 0, C.steel);
  // Foredeck: windlass, bollards, anchor; fenders; fish hold, crates
  const tW = 0.86, dW = up([0, deckY, H.Z(tW)], 0);
  addCylinder(hs.solid, 0.18 * k, 0.18 * k, 0.6 * k, 10, 0, deckY + 0.35 * k, dW[2], 0, 0, Math.PI / 2, C.steel);
  hs.solid.push({ g: new THREE.BoxGeometry(0.8 * k, 0.25 * k, 0.4 * k).translate(0, deckY + 0.12 * k, dW[2]), c: C.drum, n: 'windlass-base' });
  for (const sg of [1, -1]) for (const tt of [0.8, 0.3]) { const x = sg * (inner(tt, deckY + 0.3) - 0.3 * k); addCylinder(hs.solid, 0.09 * k, 0.11 * k, 0.4 * k, 8, x, deckY + 0.2 * k, H.Z(tt), 0, 0, 0, C.steel); }
  { const ta = 0.94, q = H.sec(ta, H.nP - 1), x = q[0] + 0.12, y = q[1] - 0.55 * k, z = H.Z(ta); addWire(hs.solid, [x, y + 0.45 * k, z], [x, y - 0.25 * k, z - 0.05], C.steel, 0.05 * k, 5); hs.solid.push({ g: new THREE.TorusGeometry(0.28 * k, 0.05 * k, 4, 10, Math.PI).rotateZ(Math.PI).rotateY(Math.PI / 2).translate(x, y - 0.22 * k, z), c: C.steel, n: 'anchor-fluke' }); }
  for (const sg of [1, -1]) for (const tt of [0.25, 0.4, 0.58, 0.72]) { const q = H.sec(tt, H.nP - 1); hs.solid.push({ g: new THREE.TorusGeometry(0.22 * k, 0.09 * k, 6, 12).rotateY(Math.PI / 2).translate(sg * (q[0] + 0.1 * k), q[1] - 0.65 * k, H.Z(tt)), c: C.tyre, n: 'fender' }); addWire(hs.solid, [sg * q[0], q[1] + 0.02, H.Z(tt)], [sg * (q[0] + 0.1 * k), q[1] - 0.45 * k, H.Z(tt)], C.tyre, 0.012, 3); }
  hs.solid.push({ g: new THREE.BoxGeometry(1.5 * k, 0.35 * k, 1.3 * k).translate(0, deckY + 0.17 * k, H.Z(0.38)), c: C.steel, n: 'hold-hatch' });
  for (let i = 0; i < 6; i++) { const x = (i % 3 - 1) * 0.62 * k - Bm * 0.12, z = H.Z(0.3) + (i < 3 ? 0 : 0.45 * k); hs.solid.push({ g: new THREE.BoxGeometry(0.58 * k, 0.32 * k, 0.4 * k).translate(x, deckY + 0.16 * k + (i === 1 ? 0.32 * k : 0), z), c: i % 2 ? C.crate : C.drum, n: 'fish-box' }); }
  // Gear
  const gearS = P.sub('gear', [0, 0, 0], 'hull'), zG = H.Z(0.1);
  if (p.gear === 'trawler') {
    const gy = deckY + 3.4 * k, gx = inner(0.06, deckY + 0.5) - 0.2 * k;
    for (const sg of [1, -1]) addWire(gearS.solid, [sg * gx, deckY, H.Z(0.04)], [sg * gx * 0.85, gy, H.Z(0.06)], C.drum, 0.11 * k, 6);
    addWire(gearS.solid, [-gx * 0.85, gy, H.Z(0.06)], [gx * 0.85, gy, H.Z(0.06)], C.drum, 0.12 * k, 6);
    const nd = P.sub('net-drum', [0, deckY + 0.95 * k, zG + 0.3 * k], 'gear'), dl = gx * 1.2, drR = 0.55 * k, dc = [0, deckY + 0.95 * k, zG + 0.3 * k];
    nd.solid.push({ g: new THREE.CylinderGeometry(drR * 0.55, drR * 0.55, dl, 12).rotateZ(Math.PI / 2).translate(dc[0], dc[1], dc[2]), c: C.drum, n: 'drum-core' });
    for (const sg of [1, -1]) nd.solid.push({ g: new THREE.CylinderGeometry(drR, drR, 0.06, 16).rotateZ(Math.PI / 2).translate(sg * dl / 2, dc[1], dc[2]), c: C.drum, n: 'flange' });
    nd.solid.push({ g: faceTint(new THREE.CylinderGeometry(drR * 0.88, drR * 0.88, dl - 0.1, 14, 3).rotateZ(Math.PI / 2).translate(dc[0], dc[1], dc[2]), (x, y, z, i) => (i % 5 ? C.net : mixC(C.net, C.tyre, 0.3).getHex())), c: null, n: 'net-wound' });
    for (let i = 0; i < 7; i++) { const a = r() * 6.28, x = (r() - 0.5) * dl * 0.8; nd.solid.push({ g: new THREE.IcosahedronGeometry(0.11 * k, 0).translate(x, dc[1] + Math.cos(a) * drR * 0.9, dc[2] + Math.sin(a) * drR * 0.9), c: C.float, n: 'float' }); }
    for (const sg of [1, -1]) addWire(gearS.solid, [sg * dl / 2, dc[1], dc[2]], [sg * dl / 2, deckY, dc[2]], C.drum, 0.08 * k, 4);
    if (p.outriggers === 'fishing') { const ny = H.sheer(0) + 0.05; gearS.solid.push({ g: new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-0.5 * k, ny, H.Z(0), 0.5 * k, ny, H.Z(0), 0.9 * k, -0.4, H.Z(0) - 3.5 * k, -0.5 * k, ny, H.Z(0), 0.9 * k, -0.4, H.Z(0) - 3.5 * k, -0.9 * k, -0.4, H.Z(0) - 3.5 * k], 3)), c: C.net, n: 'net-out' }); }
    if (p.deckLights) for (const sg of [1, -1]) gearS.glow.push({ g: new THREE.BoxGeometry(0.22, 0.16, 0.12).translate(sg * gx * 0.6, gy - 0.18, H.Z(0.07)), c: C.lamp, n: 'flood' });
  } else if (p.gear === 'longliner') {
    for (let i = 0; i < 6; i++) { const x = -Bm * 0.2 + (i % 3) * 0.3 * k, z = zG + 0.6 * k + Math.floor(i / 3) * 0.35 * k; addWire(gearS.solid, [x, deckY, z], [x + 0.1, deckY + 3.2 * k, z - 0.3], C.trim, 0.025 * k, 4); gearS.solid.push({ g: new THREE.BoxGeometry(0.02, 0.35 * k, 0.5 * k).translate(x + 0.1, deckY + 3.0 * k, z - 0.55), c: i % 2 ? C.drum : C.float, n: 'flag' }); gearS.solid.push({ g: new THREE.IcosahedronGeometry(0.2 * k, 0).translate(x, deckY + 0.3 * k, z), c: C.float, n: 'buoy' }); }
    for (let i = 0; i < 4; i++) gearS.solid.push({ g: new THREE.CylinderGeometry(0.3 * k, 0.26 * k, 0.4 * k, 10).translate(Bm * 0.15 + (i % 2) * 0.65 * k, deckY + 0.2 * k, zG + 0.5 * k + Math.floor(i / 2) * 0.65 * k), c: C.crate, n: 'line-tub' });
    addCylinder(gearS.solid, 0.3 * k, 0.3 * k, 0.12 * k, 12, inner(0.45, deckY + 0.8) - 0.25 * k, deckY + 0.95 * k, H.Z(0.45), 0, 0, Math.PI / 2, C.drum);
  } else {
    for (let i = 0; i < 9; i++) {
      const bx = ((i % 3) - 1) * 0.95 * k, by = deckY + Math.floor(i / 3) * 0.62 * k, bz = zG + 0.75 * k, w2 = 0.45 * k, h2 = 0.3 * k;
      gearS.solid.push({ g: new THREE.BoxGeometry(w2 * 2, 0.04, w2 * 2).translate(bx, by + 0.02, bz), c: C.steel, n: 'pot-base' });
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) addWire(gearS.solid, [bx + sx * w2, by, bz + sz * w2], [bx + sx * w2, by + h2 * 2, bz + sz * w2], C.steel, 0.015 * k, 3);
      for (const yy of [h2, h2 * 2]) { addWire(gearS.solid, [bx - w2, by + yy, bz - w2], [bx + w2, by + yy, bz - w2], C.net, 0.012 * k, 3); addWire(gearS.solid, [bx - w2, by + yy, bz + w2], [bx + w2, by + yy, bz + w2], C.net, 0.012 * k, 3); addWire(gearS.solid, [bx - w2, by + yy, bz - w2], [bx - w2, by + yy, bz + w2], C.net, 0.012 * k, 3); addWire(gearS.solid, [bx + w2, by + yy, bz - w2], [bx + w2, by + yy, bz + w2], C.net, 0.012 * k, 3); }
    }
    for (let i = 0; i < 5; i++) gearS.solid.push({ g: new THREE.IcosahedronGeometry(0.2 * k, 0).translate(-Bm * 0.3 + i * 0.12 * k, deckY + 0.25 * k + (i % 2) * 0.2 * k, zG + 2.2 * k), c: i % 2 ? C.float : C.drum, n: 'buoy' });
  }
  // Outriggers hinged on a post behind the wheelhouse; stays + tow wires are stretchy links
  const zO = zB - 0.55 * k, postY = deckY + 4.6 * k, hy = deckY + 1.25 * k, Lb = 0.62 * L, ang = p.outriggers === 'fishing' ? 16 : 76;
  const links = makeLinks('stays', 4, 0.012 * k + 0.004, C.steel, 4);
  links.userData.parent = 'hull';
  if (p.outriggers !== 'none') {
    addWire(hs.solid, [0, deckY, zO], [0, postY, zO], C.trim, 0.1 * k, 6);
    addWire(hs.solid, [-0.35 * k, hy, zO], [0.35 * k, hy, zO], C.trim, 0.08 * k, 6);
    if (p.deckLights) hs.glow.push({ g: new THREE.BoxGeometry(0.22, 0.16, 0.12).translate(0, postY - 0.6 * k, zO - 0.1), c: C.lamp, n: 'flood' });
    for (const [side, sg] of [['port', 1], ['starboard', -1]]) {
      const ob = P.sub(`outrigger-${side}`, [sg * 0.35 * k, hy, zO], 'hull');
      ob.solid.push({ g: sweep([[sg * 0.35 * k, hy, zO], [sg * (0.35 * k + Lb * 0.5), hy, zO], [sg * (0.35 * k + Lb), hy, zO]], (tt) => (0.09 - 0.05 * tt) * k, 6, 6, true), c: C.trim, n: 'boom' });
      ob.solid.push({ g: new THREE.BoxGeometry(0.2 * k, 0.3 * k, 0.16 * k).translate(sg * (0.35 * k + Lb), hy - 0.18 * k, zO), c: C.steel, n: 'block' });
    }
  }
  // Names (bent onto both bows) + transom
  const nm = p.boatName, ts = Math.min(0.42 * k, (L * 0.22) / Math.max(1, nm.length * 0.8));
  for (const sg of [1, -1]) {
    const tmp = [];
    addText(tmp, nm, ts, 0, 0, C.text, 0.03);
    for (const it of tmp) {
      const pa = it.g.attributes.position;
      for (let i = 0; i < pa.count; i++) { const u = pa.getX(i), v = pa.getY(i), dz = pa.getZ(i), z = H.Z(0.84) - sg * u, y = H.sheer(H.T(z)) - 0.42 * k - ts + v; pa.setXYZ(i, sg * (H.beamAt(H.T(z), y) + 0.02 + dz), y, z); }
      it.n = 'name';
      hs.solid.push(it);
    }
  }
  addText(hs.solid, nm, ts * 0.8, 0, H.sheer(0) - 0.55 * k, C.text, 0.03, new THREE.Matrix4().makeRotationY(Math.PI).setPosition(0, 0, H.Z(0) - 0.03));
  hs.glow.push({ g: new THREE.BoxGeometry(0.12, 0.12, 0.1).translate(0, H.sheer(0) + 0.15, H.Z(0) + 0.15), c: C.lightWhite, n: 'sternlight' });
  // Water, wake, smoke
  const waves = patchWaves(p.swell), spd = p.speed * 0.514;
  const waterMat = makeWaterMaterial({ waves, cap: [0.5, 0.78], opacity: 0.85, foam: C.foam, roughness: 0.12, streakAlong: 0.4, streakAcross: 0.6, ripples: [[0, 0, -L * 0.4, spd > 0 ? 0 : 0.006]] });
  if (p.waterPatch) g.userData.waterSurface = g.userData.surface = waterPatch(P.sub('water-patch', [0, 0, 0]), g, { r: Math.max(14, L * 2), depth: 3.5 * k, waves, water: C.water, deep: C.deep, floor: C.seabed, mat: waterMat });
  if (spd > 0) wakeParts(P.sub('wake', [0, 0, 0]).water, { len: L, beam: Bm, speed: spd, sideAt: (z) => H.beamAt(H.T(z), 0) });
  const emitters = [];
  if (p.showSmoke) emitters.push(makeEmitter('smoke', {
    count: 40, shape: 'puff', color: C.smoke, opacity: 0.55, gravity: [0, 0.5, 0], grow: [0.5, 2.6], drag: 0.7, pulse: true, sway: [0.15, 0.6], parent: 'hull', seed: 11,
    spawn: (i, rr) => ({ p: [stack[0], stack[1], stack[2]], v: [(rr() - 0.5) * 0.3, 0.9 + rr() * 0.4, -spd * 0.7 - 0.2], life: 5, size: 0.25 * k }),
  }));
  const rpm = spd > 0 ? 160 + spd * 40 : 0;
  let hullN = null;
  g.userData.view = { target: [0, 2.2 * k, 0], radius: L * 2.3 };
  finalize(g, P, p, C, {
    waterMat, glowMat, emitters, objects: [links],
    onNight: (kk) => glowMat.color.setScalar(0.3 + 1.7 * kk),
    tick: (tt, dt, drive) => {
      if (!hullN) hullN = g.getObjectByName('hull');
      drive('propeller', (tt * rpm * 6) % 360); drive('radar', (tt * 150) % 360); drive('rudder', Math.sin(tt * 0.3) * 3);
      drive('outrigger-port', ang); drive('outrigger-starboard', -ang); drive('net-drum', p.outriggers === 'fishing' ? (tt * 4) % 360 : 0);
      floatOn(g, hullN, tt, dt, { len: L, beam: Bm, amp: 0.12, period: 5, response: 2.2, trim: -0.004 * spd });
      if (p.outriggers === 'none') { for (let i = 0; i < 4; i++) links.userData.set(i, [0, 0, 0], [0, 0, 0]); return; }
      g.updateMatrixWorld(true);
      const top = [0, postY - 0.1, zO], ports = [['outrigger-port', 1], ['outrigger-starboard', -1]];
      ports.forEach(([n, sg], i) => {
        const node = g.getObjectByName(n), tip = localTo(node, [sg * Lb, 0, 0], hullN);
        links.userData.set(i, top, tip);
        links.userData.set(i + 2, tip, p.outriggers === 'fishing' ? [tip[0] * 1.05, -1.5 * k, tip[2] - 7 * k] : tip);
      });
    },
  });
  g.userData.matchWaves = (src) => matchWavesFrom(waterMat, src);
  return g;
}
export default createAsset;
