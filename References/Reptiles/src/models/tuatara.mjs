/*
 * TUATARA — Sphenodon punctatus (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures.
 * Sole survivor of the order Rhynchocephalia — a "living fossil" lineage older than the dinosaurs.
 *
 * QUICK START
 *   import { createAsset } from './tuatara.mjs';
 *   scene.add(createAsset({ mergeForProduction: true }));
 *
 * PARAMS  length 0.4–0.8 m · crest · mouthOpen · tailSway · walk · colorway · per-zone colours
 * SPECS   8,112 triangles · 9 draw calls merged · 0.23 x 0.100 x 0.60 m (W x H x D, default params).
 *         Swept body, extruded nuchal/dorsal spine crest, beaked overbite skull, speckle-baked scales.
 * PARTS   animate: jaw, head, tail, legFL, legFR, legHL, legHR
 *         detach:  tail
 * LICENSE CC0 1.0 — public domain, free for any use.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const SURFACE = { roughness: 0.85, metalness: 0 };

const BASE = { skin: '#6b6a4a', speckle: '#c9c39a', belly: '#9a9472', spine: '#e6e0c4', mouth: '#d99a90', claw: '#2a2a1e', iris: '#3a2a1a', pupil: '#050505' };
export const COLORWAYS = {
  default:  { ...BASE },
  slate:    { skin: '#5e625e', speckle: '#b4b8b0', belly: '#8e928a', spine: '#dcdcd2', mouth: '#d99a90', claw: '#222220', iris: '#3a2e22', pupil: '#050505' },
  rust:     { skin: '#7e4e36', speckle: '#d0a682', belly: '#a27a5e', spine: '#ecd6be', mouth: '#d99a90', claw: '#2a1e16', iris: '#3a2418', pupil: '#050505' },
  brothers: { skin: '#7a7240', speckle: '#e0d48a', belly: '#a89c66', spine: '#f0e6b8', mouth: '#d99a90', claw: '#2a2618', iris: '#40301a', pupil: '#050505' }
};
export const presets = COLORWAYS;

export const info = {
  name: 'Tuatara', scientific: 'Sphenodon punctatus', class: 'Reptilia', order: 'Rhynchocephalia', group: 'Tuatara', family: 'Sphenodontidae',
  habitat: 'Burrows on predator-free offshore islands, New Zealand', environment: 'forest', size: '0.45–0.8 m', status: 'Least Concern (protected)',
  fact: 'Not a lizard at all: the last rhynchocephalian, with a light-sensitive parietal "third eye" and a lifespan beyond 100 years.'
};

export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'Merge each rig bone into one draw call; off = selectable meshes.' },
  colorway:  { type: 'choice', default: 'default', label: 'Colorway', affects: 'colors', options: Object.keys(COLORWAYS), describe: 'Colour form.' },
  length:    { type: 'range', default: 0.6, min: 0.4, max: 0.8, step: 0.01, label: 'Length (m)', affects: 'geometry', describe: 'Snout-to-tail length.' },
  crest:     { type: 'range', default: 1.0, min: 0.2, max: 1.8, step: 0.05, label: 'Spine Crest', affects: 'geometry', describe: 'Height of the soft dorsal spines.' },
  mouthOpen: { type: 'range', default: 0, min: 0, max: 35, step: 1, label: 'Mouth Open (°)', affects: 'geometry', describe: 'Jaw gape.' },
  tailSway:  { type: 'range', default: 0.5, min: -1, max: 1, step: 0.05, label: 'Tail Curve', affects: 'geometry', describe: 'Lateral curve of the tail.' },
  walk:      { type: 'range', default: 0.3, min: -1, max: 1, step: 0.05, label: 'Stride', affects: 'geometry', describe: 'Walking stride pose.' },
  skin:      { type: 'color', default: BASE.skin, label: 'Scales', affects: 'colors', describe: 'Base colour.' },
  speckle:   { type: 'color', default: BASE.speckle, label: 'Speckles', affects: 'colors', describe: 'Pale speckle colour.' },
  spine:     { type: 'color', default: BASE.spine, label: 'Crest', affects: 'colors', describe: 'Crest spine colour.' }
};

export const rig = {
  jaw:   { axis: 'x', range: [0, 22], speed: 0.9 },
  head:  { axis: 'y', range: [-10, 10], speed: 0.5 },
  tail:  { axis: 'y', range: [-12, 12], speed: 0.7 },
  legFL: { axis: 'y', range: [-14, 14], speed: 1.3, phase: 0 },
  legHR: { axis: 'y', range: [-14, 14], speed: 1.3, phase: 0 },
  legFR: { axis: 'y', range: [-14, 14], speed: 1.3, phase: Math.PI },
  legHL: { axis: 'y', range: [-14, 14], speed: 1.3, phase: Math.PI }
};
export const detach = ['tail'];
export const night = { eyes: { color: '#ffd9a0', intensity: 1.3, describe: 'Nocturnal eyeshine' } };

// ═══════════════════════════════════════════════════════════════════════════
//  INLINE TOOLKIT — everything below is local to this file (no shared imports)
// ═══════════════════════════════════════════════════════════════════════════

const ZONE_KEYS = Object.keys(BASE);
const hexOf = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v & 0xFFFFFF;
  if (typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v)) return parseInt(v.replace('#', ''), 16);
  return null;
};

/** Resolve a colorway + overrides into unique per-zone hex integers. */
function zonesFor(name, o = {}) {
  const cw = COLORWAYS[name] || COLORWAYS['default'];
  const used = new Set(), out = {};
  for (const k of ZONE_KEYS) {
    let hex = (hexOf(o[k]) ?? hexOf(cw[k]) ?? hexOf(BASE[k]) ?? 0x888888) & 0xFFFFFF;
    while (used.has(hex)) hex = (hex + 1) & 0xFFFFFF;
    used.add(hex); out[k] = hex;
  }
  return out;
}

const _tc = new THREE.Color();
/** Strip uv/normal, de-index, and bake a flat vertex colour (or keep a baked colour buffer when hex == null). */
function prep(geo, hex) {
  if (geo.index) geo = geo.toNonIndexed();
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  if (hex == null && geo.attributes.color) return geo;
  _tc.set(hex == null ? 0x888888 : hex);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = _tc.r; col[i * 3 + 1] = _tc.g; col[i * 3 + 2] = _tc.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

const MAT = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: true, roughness: SURFACE.roughness, metalness: SURFACE.metalness ?? 0, side: THREE.DoubleSide
});
MAT.userData.zone = 'skin';
const EYE_MAT = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: true, roughness: 0.08, metalness: 0.15, emissive: 0x000000
});
EYE_MAT.userData.zone = 'eyes';
const GLASS_MAT = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: true, roughness: 0.3, metalness: 0.0, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false
});
GLASS_MAT.userData.zone = 'membrane';

function finish(list, material = MAT, name = 'solid', merge = true) {
  if (list.length === 0) return null;
  if (merge) {
    const merged = mergeGeometries(list.map((p) => prep(p.g, p.c)));
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
    m.name = `${name}_part_${i + 1}`;
    m.castShadow = true; m.receiveShadow = true;
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
  if (dist < 1e-6) return;
  const geo = new THREE.CylinderGeometry(r, r, dist, radialSegments);
  const mid = v1.clone().lerp(v2, 0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v2.clone().sub(v1).normalize());
  geo.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
  parts.push({ g: geo, c: hex });
}

/** Exact-vertex quad (optionally thickened) — neighbours share bit-identical corners. */
function addQuad(parts, a, b, c, d, hex, t = 0) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), Cc = new THREE.Vector3(...c), D = new THREE.Vector3(...d);
  const v = [];
  const tri = (p, q, r) => v.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
  tri(A, B, Cc); tri(A, Cc, D);
  if (t > 0) {
    const n = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(D, A)).normalize().multiplyScalar(t);
    const A2 = A.clone().add(n), B2 = B.clone().add(n), C2 = Cc.clone().add(n), D2 = D.clone().add(n);
    tri(D2, C2, B2); tri(D2, B2, A2);
    tri(A, A2, B2); tri(A, B2, B); tri(B, B2, C2); tri(B, C2, Cc);
    tri(Cc, C2, D2); tri(Cc, D2, D); tri(D, D2, A2); tri(D, A2, A);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  parts.push({ g, c: hex });
}

// ── scalar helpers ──────────────────────────────────────────────────────────
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);
const h3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** Smooth piecewise profile through [t, value] keys. */
function prof(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
        return lerp(v0, v1, smooth((t - t0) / Math.max(1e-6, t1 - t0)));
      }
    }
    return keys[keys.length - 1][1];
  };
}

// ── swept-profile engine ────────────────────────────────────────────────────
const _UP = new THREE.Vector3(0, 1, 0);
function frameAt(curve, t, prevN, up = _UP) {
  const C = curve.getPointAt(t), T = curve.getTangentAt(t).normalize();
  let N = up.clone().addScaledVector(T, -up.dot(T));
  if (N.lengthSq() < 0.02) {
    const ref = prevN || new THREE.Vector3(0, 0, -1);
    N = ref.clone().addScaledVector(T, -ref.dot(T));
    if (N.lengthSq() < 1e-8) N = new THREE.Vector3(1, 0, 0).addScaledVector(T, -T.x);
  }
  N.normalize();
  const S = new THREE.Vector3().crossVectors(N, T).normalize();
  return { C, T, N, S };
}
/** Cross-section point: superellipse (n), flattened belly/top, dorsal ridge / ventral keel crest. */
function secXY(s, a) {
  const e = 2 / (s.n || 2), ca = Math.cos(a), sa = Math.sin(a);
  let x = Math.sign(ca) * Math.pow(Math.abs(ca), e) * s.w;
  let y = Math.sign(sa) * Math.pow(Math.abs(sa), e) * s.h;
  if (sa < 0 && s.flat !== undefined) y *= s.flat;
  if (sa > 0 && s.flatTop !== undefined) y *= s.flatTop;
  if (s.ridge) y += s.ridge * Math.pow(Math.max(0, sa), 14);
  if (s.keel) y -= s.keel * Math.pow(Math.max(0, -sa), 14);
  return [x + (s.ox || 0), y + (s.oy || 0)];
}
/** Continuous swept body: a variable cross-section skinned along a Catmull-Rom spine (shared vertices). */
function sweepGeo(pts, sec, o = {}) {
  const seg = o.seg ?? 24, rad = o.rad ?? 12;
  const vs = pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = vs.length === 2 ? new THREE.LineCurve3(vs[0], vs[1]) : new THREE.CatmullRomCurve3(vs, false, 'centripetal');
  const up = o.up ? new THREE.Vector3(...o.up).normalize() : _UP;
  const pos = [], col = [], idx = [];
  let prevN = null;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, F = frameAt(curve, t, prevN, up);
    prevN = F.N;
    const s = sec(t, F.C);
    for (let j = 0; j < rad; j++) {
      const a = (j / rad) * Math.PI * 2;
      const [x, y] = secXY(s, a);
      const P = F.C.clone().addScaledVector(F.S, x).addScaledVector(F.N, y);
      pos.push(P.x, P.y, P.z);
      if (o.color) { _tc.set(o.color(t, a, P)); col.push(_tc.r, _tc.g, _tc.b); }
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
    const a = i * rad + j, b = i * rad + ((j + 1) % rad), c = b + rad, d = a + rad;
    idx.push(a, b, d, b, c, d);
  }
  const cap = (ring, t, sign, ext) => {
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < rad; j++) { const k = (ring * rad + j) * 3; cx += pos[k]; cy += pos[k + 1]; cz += pos[k + 2]; }
    const T = curve.getTangentAt(t), ci = pos.length / 3;
    pos.push(cx / rad + T.x * ext * sign, cy / rad + T.y * ext * sign, cz / rad + T.z * ext * sign);
    if (o.color) { const k = ring * rad * 3; col.push(col[k], col[k + 1], col[k + 2]); }
    for (let j = 0; j < rad; j++) idx.push(ci, ring * rad + j, ring * rad + ((j + 1) % rad));
  };
  if (o.cap0 !== false) cap(0, 0, -1, o.cap0 || 0);
  if (o.cap1 !== false) cap(seg, 1, 1, o.cap1 || 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (o.color) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.userData.sw = { curve, sec, up };
  return g;
}
function addSweep(list, pts, sec, hex, o = {}) {
  const g = sweepGeo(pts, sec, o);
  list.push({ g, c: o.color ? null : hex });
  return g.userData.sw;
}
/** Point on a sweep surface at spine-parameter t and section angle a (0 = +x side, PI/2 = top). */
function surfPt(sw, t, a, lift = 0) {
  const F = frameAt(sw.curve, clamp(t, 0, 1), null, sw.up);
  const [x, y] = secXY(sw.sec(clamp(t, 0, 1), F.C), a);
  const P = F.C.clone().addScaledVector(F.S, x).addScaledVector(F.N, y);
  if (lift) P.addScaledVector(P.clone().sub(F.C).normalize(), lift);
  return [P.x, P.y, P.z];
}
const sideA = (sd, elev) => (sd > 0 ? elev : Math.PI - elev);
/** Tapered tube along a spine (limbs, toes, gills, crests). */
function tube(list, pts, r0, r1, hex, o = {}) {
  const sec = (t) => {
    const r = lerp(r0, r1, t) + (o.bulge || 0) * Math.sin(Math.PI * t);
    return { w: r * (o.sx || 1), h: r * (o.sy || 1), flat: o.flat };
  };
  return addSweep(list, pts, sec, hex, { seg: o.seg ?? 8, rad: o.rad ?? 8, cap0: o.cap0 ?? r0 * 0.5, cap1: o.cap1 ?? r1 * 0.7, color: o.color, up: o.up });
}
function blob(list, r, x, y, z, hex, sx = 1, sy = 1, sz = 1, detail = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  g.scale(sx, sy, sz); g.translate(x, y, z);
  list.push({ g, c: hex });
  return g;
}
function cone(list, p, dir, len, r, hex, segs = 6) {
  const g = new THREE.ConeGeometry(r, len, segs);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_UP, new THREE.Vector3(...dir).normalize()));
  g.translate(p[0], p[1], p[2]);
  list.push({ g, c: hex });
  return g;
}
// smooth continuous pattern helpers — evaluated at vertices, so markings never pixel-step across facets
const _h = (i, j, k) => { const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = smooth(clamp(x - xi, 0, 1)), v = smooth(clamp(y - yi, 0, 1)), w = smooth(clamp(z - zi, 0, 1));
  const L = (a, b, t) => a + (b - a) * t;
  return L(
    L(L(_h(xi, yi, zi), _h(xi + 1, yi, zi), u), L(_h(xi, yi + 1, zi), _h(xi + 1, yi + 1, zi), u), v),
    L(L(_h(xi, yi, zi + 1), _h(xi + 1, yi, zi + 1), u), L(_h(xi, yi + 1, zi + 1), _h(xi + 1, yi + 1, zi + 1), u), v), w);
}
const _px = (P) => (P && P.x !== undefined ? P.x : P[0]);
const _py = (P) => (P && P.y !== undefined ? P.y : P[1]);
const _pz = (P) => (P && P.z !== undefined ? P.z : P[2]);
function fbm(P, s, oct = 3) {
  let a = 0.5, f = s, n = 0, d = 0;
  const x = _px(P), y = _py(P), z = _pz(P);
  for (let i = 0; i < oct; i++) { n += a * noise3(x * f + i * 13.1, y * f + i * 7.7, z * f + i * 3.9); d += a; a *= 0.5; f *= 2.07; }
  return n / d;
}
const _cA = new THREE.Color(), _cB = new THREE.Color();
/** soft pigment blend: returns a hex midway between a and b with a smooth edge */
function mixHex(a, b, u) { _cA.set(a); _cB.set(b); return _cA.clone().lerp(_cB, clamp(u, 0, 1)).getHex(); }
/** continuous soft-edged band, v in metres, returns 0..1 coverage */
function softBand(v, period, width = 0.5) { return smooth(clamp((Math.cos(v / period * Math.PI * 2) + width * 2 - 1) / (width * 2), 0, 1)); }
/** organic blotch field: 0..1 with smoothly warped edges */
function blotch(P, s, seed = 0) { return clamp((fbm([_px(P) + seed, _py(P) - seed, _pz(P) + seed], s, 3) - 0.42) * 3.2, 0, 1); }
/** Glossy eyeball + pupil (slit/round) + optional eyelid ring. */
function eye(b, p, r, iris, pupil, dir, o = {}) {
  const d = new THREE.Vector3(...dir).normalize();
  b.e.push({ g: new THREE.IcosahedronGeometry(r, 2).translate(p[0], p[1], p[2]), c: iris });
  const sl = o.slit || [0.45, 0.45];
  const pg = new THREE.SphereGeometry(r * 0.62, 12, 8);
  pg.scale(sl[0], sl[1], 0.32);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
  pg.applyQuaternion(q);
  pg.translate(p[0] + d.x * r * 0.86, p[1] + d.y * r * 0.86, p[2] + d.z * r * 0.86);
  b.e.push({ g: pg, c: pupil });
  if (o.lid != null) {
    const tg = new THREE.TorusGeometry(r * 0.98, r * (o.lidR ?? 0.25), 6, 18);
    tg.applyQuaternion(q);
    tg.translate(p[0] + d.x * r * (o.lidOut ?? 0.15), p[1] + d.y * r * (o.lidOut ?? 0.15), p[2] + d.z * r * (o.lidOut ?? 0.15));
    b.s.push({ g: tg, c: o.lid });
  }
}
/** Radiating toes with claws or adhesive pads; returns toe tips. heading = angle from +Z toward +X. */
function foot(list, ankle, heading, o) {
  const n = o.n || 5, len = o.len, r = o.r, spread = o.spread ?? 1.2, gy = o.groundY ?? r * 0.8;
  const tips = [];
  for (let k = 0; k < n; k++) {
    const f = n === 1 ? 0 : k / (n - 1) - 0.5;
    const ang = heading + spread * f;
    const tl = len * (o.lens ? o.lens[k] : 1);
    const dx = Math.sin(ang), dz = Math.cos(ang);
    const p1 = [ankle[0] + dx * tl * 0.45, Math.max(gy, lerp(ankle[1], gy, 0.6)) + (o.arch || 0) * tl, ankle[2] + dz * tl * 0.45];
    const p2 = [ankle[0] + dx * tl, gy, ankle[2] + dz * tl];
    tube(list, [ankle, p1, p2], r, r * (o.tipR ?? 0.6), o.hex, { seg: 6, rad: 6 });
    tips.push(p2);
    if (o.claw != null) cone(list, [p2[0] + dx * r * 0.2, gy, p2[2] + dz * r * 0.2], [dx, -0.3, dz], r * 2.4 * (o.clawL || 1), r * 0.42, o.claw, 5);
    if (o.pad != null) blob(list, r * (o.padR || 1.7), p2[0] + dx * r * 0.5, gy - r * 0.15, p2[2] + dz * r * 0.5, o.pad, 1, 0.6, 1);
  }
  return tips;
}
/** Interdigital webbing fan between consecutive toe tips. */
function web(list, base, tips, hex, sag = 0.35) {
  const v = [], B = new THREE.Vector3(...base);
  for (let k = 0; k < tips.length - 1; k++) {
    const A = new THREE.Vector3(...tips[k]), D = new THREE.Vector3(...tips[k + 1]);
    const M = A.clone().lerp(D, 0.5).lerp(B, sag);
    for (const [p, q, r] of [[B, A, M], [B, M, D]]) v.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  list.push({ g, c: hex });
}
/** Smooth 2D outline extruded into a thin bevelled membrane/plate (crests, dewlaps, casques, leaves). */
function fin(list, pts2d, depth, hex, o = {}) {
  const sh = new THREE.Shape();
  sh.moveTo(pts2d[0][0], pts2d[0][1]);
  if (o.smooth) sh.splineThru(pts2d.slice(1).map((q) => new THREE.Vector2(q[0], q[1])));
  else for (let i = 1; i < pts2d.length; i++) sh.lineTo(pts2d[i][0], pts2d[i][1]);
  sh.closePath();
  const bev = o.bevel ?? depth * 0.4;
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, steps: 1, curveSegments: o.curveSegments ?? 6 });
  g.translate(0, 0, -depth / 2);
  if (o.rz) g.rotateZ(o.rz);
  if (o.rx) g.rotateX(o.rx);
  if (o.ry) g.rotateY(o.ry);
  if (o.pos) g.translate(o.pos[0], o.pos[1], o.pos[2]);
  list.push({ g, c: hex });
  return g;
}
function lathe(list, pts2d, segs, hex, o = {}) {
  const g = new THREE.LatheGeometry(pts2d.map((q) => new THREE.Vector2(q[0], q[1])), segs);
  if (o.sx || o.sz) g.scale(o.sx || 1, 1, o.sz || 1);
  if (o.q) g.applyQuaternion(o.q);
  if (o.pos) g.translate(o.pos[0], o.pos[1], o.pos[2]);
  list.push({ g, c: hex });
  return g;
}

// ── rig: named pivot bones; each bone = 1 skin + 1 eye + 1 membrane draw call when merged ──
function rigBuilder() {
  const bones = {};
  const bone = (name, pivot = [0, 0, 0], parent = null) => {
    if (!bones[name]) bones[name] = { name, pivot, parent, s: [], e: [], gl: [] };
    return bones[name];
  };
  return { bones, bone };
}
function assemble(root, bones, merge) {
  const nodes = {};
  for (const b of Object.values(bones)) { const pv = new THREE.Group(); pv.name = b.name; nodes[b.name] = pv; }
  for (const b of Object.values(bones)) {
    const pv = nodes[b.name];
    const par = b.parent && bones[b.parent] ? bones[b.parent] : null;
    const pp = par ? par.pivot : [0, 0, 0];
    pv.position.set(b.pivot[0] - pp[0], b.pivot[1] - pp[1], b.pivot[2] - pp[2]);
    (par ? nodes[par.name] : root).add(pv);
    const shift = (list) => list.map((q) => ({ g: q.g.translate(-b.pivot[0], -b.pivot[1], -b.pivot[2]), c: q.c }));
    const s = finish(shift(b.s), MAT, `${b.name}_skin`, merge); if (s) pv.add(s);
    const e = finish(shift(b.e), EYE_MAT, `${b.name}_eyes`, merge); if (e) pv.add(e);
    const gl = finish(shift(b.gl), GLASS_MAT, `${b.name}_membrane`, merge); if (gl) pv.add(gl);
  }
  return nodes;
}
function transformList(list, m) { for (const q of list) q.g.applyMatrix4(m); return list; }


// ── swept skull + hinged jaw (mouth lining, teeth, fangs, forked tongue, eyes, nostrils) ──
function buildHead(R, s) {
  const [px, py, pz] = s.pivot;
  const head = R.bone(s.name || 'head', s.pivot, s.parent || null);
  const za = pz - s.L * 0.08, zb = pz + s.L;
  const ya = py + s.H * 0.04, yb = py - s.H * (s.drop ?? 0.2);
  const lineAt = (u) => [px, lerp(ya, yb, u), lerp(za, zb, u)];
  const hw = prof(s.hw || [[0, 0.8], [0.25, 1], [0.6, 0.78], [0.9, 0.5], [1, 0.22]]);
  const hh = prof(s.hh || [[0, 0.9], [0.3, 1], [0.65, 0.7], [0.92, 0.42], [1, 0.18]]);
  const jh = prof(s.jh || [[0, 1], [0.5, 0.75], [1, 0.35]]);
  const colr = (part) => (s.color ? (t, a, P) => s.color(t, a, P, part) : null);
  const hsw = addSweep(head.s, [lineAt(0), lineAt(1)], (t) => ({ w: s.W * hw(t), h: s.H * hh(t), flat: 0, n: s.n || 2, ridge: (s.ridge || 0) * s.H }), s.skin,
    { seg: s.seg || 16, rad: 16, color: colr('head'), cap1: s.L * 0.02 });
  const jaw = R.bone(s.jawName || 'jaw', lineAt(0.06), head.name);
  const j0 = 0.03, j1 = 0.975;
  addSweep(jaw.s, [lineAt(j0), lineAt(j1)], (t) => ({ w: s.W * (s.jawW ?? 0.9) * hw(lerp(j0, j1, t)), h: s.H * (s.jawH ?? 0.45) * jh(t), flatTop: 0, n: s.n || 2 }),
    s.jawSkin ?? s.skin, { seg: 12, rad: 16, color: colr('jaw'), cap1: s.L * 0.015 });
  const mh = Math.max(s.L * 0.004, 0.0003);
  addSweep(head.s, [lineAt(0.06), lineAt(0.93)], (t) => ({ w: s.W * 0.84 * hw(lerp(0.06, 0.93, t)), h: mh, oy: -mh * 1.4 }), s.mouth, { seg: 8, rad: 8 });
  addSweep(jaw.s, [lineAt(0.1), lineAt(0.9)], (t) => ({ w: s.W * 0.7 * hw(lerp(0.1, 0.9, t)), h: mh, oy: mh * 1.4 }), s.mouth, { seg: 8, rad: 8 });
  const at = (t) => { const P = lineAt(t); return { x: P[0], y: P[1], z: P[2], w: s.W * hw(t), h: s.H * hh(t) }; };
  if (s.eye) {
    const e = s.eye, A = at(e.t ?? 0.35);
    for (const sd of [-1, 1]) {
      const up = e.up ?? 0.6, out = Math.sqrt(Math.max(0, 1 - up * up));
      eye(head, [A.x + sd * A.w * out * (e.inset ?? 1), A.y + A.h * up, A.z], e.r, e.iris, e.pupil, [sd * (e.dx ?? 1), e.dy ?? 0.35, e.dz ?? 0.2],
        { slit: e.slit, lid: e.lid, lidR: e.lidR, lidOut: e.lidOut });
      if (e.brow != null) tube(head.s, [[A.x + sd * A.w * out * 0.7, A.y + A.h * up + e.r * 0.9, A.z - e.r * 1.4], [A.x + sd * A.w * out * 0.95, A.y + A.h * up + e.r * 1.05, A.z], [A.x + sd * A.w * out * 0.75, A.y + A.h * up + e.r * 0.7, A.z + e.r * 1.4]], e.r * 0.35, e.r * 0.25, e.brow, { seg: 6, rad: 6 });
    }
  }
  if (s.nostril != null) {
    const A = at(s.nostrilT ?? 0.93);
    for (const sd of [-1, 1]) blob(head.s, s.L * 0.018, A.x + sd * A.w * 0.42, A.y + A.h * 0.82, A.z, s.nostril, 1, 0.55, 1.4);
  }
  if (s.teeth) {
    const T = s.teeth, n = T.count || 10;
    for (let i = 0; i < n; i++) {
      const t = lerp(T.from ?? 0.2, T.to ?? 0.95, i / (n - 1));
      const A = at(t), len = T.len * (0.7 + 0.5 * Math.sin(i * 1.7) ** 2);
      for (const sd of [-1, 1]) {
        cone(head.s, [A.x + sd * A.w * 0.86, A.y + len * 0.2, A.z], [sd * 0.15, -1, 0], len, len * 0.28, T.hex, 4);
        const B = at(t + 0.5 / n);
        cone(jaw.s, [B.x + sd * B.w * (s.jawW ?? 0.9) * 0.82, B.y - len * 0.2, B.z], [sd * 0.15, 1, 0], len * 0.85, len * 0.26, T.hex, 4);
      }
    }
  }
  if (s.fangs) {
    const A = at(s.fangs.t ?? 0.82);
    for (const sd of [-1, 1]) cone(head.s, [A.x + sd * A.w * 0.55, A.y + s.fangs.len * 0.15, A.z], [0, -1, -0.35], s.fangs.len, s.fangs.len * 0.18, s.fangs.hex, 5);
  }
  let tongue = null;
  if (s.tongue) {
    const T = s.tongue, base = lineAt(0.35);
    base[1] += mh * 2;
    tongue = R.bone(s.tongueName || 'tongue', base, jaw.name);
    const tip = [base[0], base[1] + (T.lift || 0), base[2] + T.len];
    const mid = lerp3(base, tip, 0.5); mid[1] += (T.arc || 0);
    tube(tongue.s, [base, mid, tip], T.r, T.r * 0.6, T.hex, { seg: 10, rad: 6 });
    if (T.fork) for (const sd of [-1, 1]) tube(tongue.s, [tip, [tip[0] + sd * T.fork * 0.5, tip[1], tip[2] + T.fork * 0.6], [tip[0] + sd * T.fork, tip[1], tip[2] + T.fork]], T.r * 0.6, T.r * 0.2, T.hex, { seg: 5, rad: 5 });
    if (T.club) blob(tongue.s, T.club, tip[0], tip[1], tip[2] + T.club * 0.5, T.clubHex ?? T.hex, 1.1, 0.9, 1.2, 1);
  }
  return { head, jaw, tongue, at, lineAt, hsw };
}


// ── sprawling tetrapod body plan: swept trunk + swept tail + swept skull + 4 sprawled limbs ──
function sprawlLeg(list, hip, side, fore, L, r, hex, o = {}) {
  const er = o.erect ?? 0, sw = o.swing ?? 0;
  const out = L * 0.48 * (1 - er * 0.6);
  let knee, wrist;
  if (fore) {
    knee = [hip[0] + side * out, hip[1] + L * (0.05 - er * 0.28), hip[2] - L * 0.08 + sw * 0.5];
    wrist = [knee[0] + side * L * 0.06, r * 0.75, knee[2] + L * 0.14 + sw];
  } else {
    knee = [hip[0] + side * out * 1.05, hip[1] + L * (0.03 - er * 0.28), hip[2] + L * 0.16 + sw * 0.5];
    wrist = [knee[0] + side * L * 0.05, r * 0.75, knee[2] - L * 0.08 + sw];
  }
  if (o.wristY != null) wrist[1] = o.wristY;
  if (o.wristX != null) wrist[0] = side * o.wristX;
  tube(list, [hip, knee, wrist], r, r * 0.55, hex, { seg: 12, rad: 8, bulge: r * 0.22, color: o.color });
  return { wrist, knee, heading: fore ? side * (o.foreHead ?? 0.35) : side * (o.hindHead ?? 0.85) };
}

function buildSaurian(R, s) {
  const L = s.L, tailL = L * s.tailFrac, headL = s.headL, neckL = s.neckL;
  const trunkL = L - tailL - headL - neckL;
  const zTail = -L * 0.5, zv = zTail + tailL, zs = zv + trunkL, zn = zs + neckL, zt = zn + headL;
  const hipY = s.hipY, chestY = s.chestY ?? hipY, headY = s.headY ?? chestY;
  const BW = s.bodyW, BH = s.bodyH;
  const col = (part) => (s.color ? (t, a, P) => s.color(t, a, P, part) : null);
  const body = R.bone('body');
  const tw = prof(s.trunkW || [[0, 0.6], [0.15, 0.92], [0.5, 1], [0.75, 0.85], [0.88, 0.6], [1, 0.55]]);
  const th = prof(s.trunkH || [[0, 0.65], [0.18, 0.92], [0.5, 1], [0.78, 0.82], [0.9, 0.66], [1, 0.62]]);
  const z0 = zv - trunkL * 0.05, z1 = zn + headL * 0.22;
  const neckTop = headY + s.headH * (s.neckRise ?? 0.3);
  const trunkPts = [[0, hipY, z0], [0, lerp(hipY, chestY, 0.5) + (s.arch || 0), zv + trunkL * 0.5], [0, chestY, zs], [0, lerp(chestY, neckTop, 0.6), zn], [0, neckTop, z1]];
  const trunk = addSweep(body.s, trunkPts, (t) => ({ w: BW * tw(t), h: BH * th(t), flat: s.bellyFlat ?? 0.6, ridge: (s.ridge || 0) * BH, n: s.trunkN || 2 }), s.skin,
    { seg: s.trunkSeg || 30, rad: s.rad || 16, color: col('trunk'), cap0: false });
  // tail (own pivot for sway)
  const tail = R.bone('tail', [0, hipY, zv], 'body');
  let tp;
  if (s.tailPts) tp = s.tailPts({ zv, zTail, tailL, hipY, trunkL, BW, BH });
  else {
    tp = [];
    for (let i = 0; i <= 9; i++) {
      const u = i / 9;
      tp.push([(s.tailSway || 0) * tailL * 0.32 * Math.sin(u * Math.PI * 1.15) * u, lerp(hipY, s.tailTipY ?? BH * 0.2, Math.pow(u, s.tailDrop ?? 0.7)), lerp(zv + trunkL * 0.06, zTail, u)]);
    }
  }
  const tailR = s.tailR ?? 0.55;
  const tsec = s.tailSec || ((t) => {
    const f = Math.pow(1 - t, s.tailTaper ?? 1.2);
    return { w: BW * tailR * f + L * 0.002, h: BH * tailR * f * (s.tailHR ?? 1) + L * 0.002, flat: 0.8, ridge: (s.tailRidge || 0) * BH * f, keel: (s.tailKeel || 0) * BH * f };
  });
  const tailSw = addSweep(tail.s, tp, tsec, s.skin, { seg: s.tailSeg || 28, rad: s.rad || 16, color: col('tail'), cap1: L * 0.003 });
  // head
  const H = buildHead(R, Object.assign({ parent: 'body', pivot: [0, headY, zn], L: headL, W: s.headW, H: s.headH, skin: s.skin, color: s.color }, s.head || {}));
  // limbs
  const hipZ = zv + trunkL * (s.hipT ?? 0.1), shZ = zs - trunkL * (s.shT ?? 0.06);
  const legs = {};
  for (const [nm, fore, side] of [['legFL', 1, 1], ['legFR', 1, -1], ['legHL', 0, 1], ['legHR', 0, -1]]) {
    const y = fore ? chestY : hipY;
    const hip = [side * BW * (s.hipX ?? 0.62), y - BH * 0.2, fore ? shZ : hipZ];
    const b = R.bone(nm, hip, 'body');
    const Lg = fore ? s.foreL : s.hindL, r = fore ? s.foreR : s.hindR;
    const phase = nm === 'legFL' || nm === 'legHR' ? 1 : -1;
    const lg = sprawlLeg(b.s, hip, side, !!fore, Lg, r, s.skin, { erect: s.erect, swing: (s.walk || 0) * Lg * 0.3 * phase, color: col('leg'), foreHead: s.foreHead, hindHead: s.hindHead, wristY: s.wristY, wristX: s.wristX });
    const tips = foot(b.s, lg.wrist, lg.heading, {
      n: fore ? (s.foreToes ?? 5) : (s.hindToes ?? 5), len: Lg * (s.toeL ?? 0.32) * (fore ? 1 : (s.hindToeK ?? 1.15)), r: r * (s.toeR ?? 0.3), hex: s.toeHex ?? s.skin,
      claw: s.claw, clawL: s.clawL, pad: s.pad, padR: s.padR, spread: fore ? (s.foreSpread ?? 1.3) : (s.hindSpread ?? 1.4), lens: fore ? s.foreLens : s.hindLens,
      groundY: s.toeGround ?? r * 0.3, tipR: s.toeTip
    });
    if (s.web != null && !fore) web(b.gl, lg.wrist, tips, s.web, 0.3);
    legs[nm] = { ...lg, tips, bone: b };
  }
  return { body, tail, H, trunk, tailSw, legs, zv, zs, zn, zt, zTail, hipY, chestY, headY, trunkL, tailL, BW, BH };
}


export function createAsset(userParams = {}) {
  const p = {};
  for (const k of Object.keys(params)) p[k] = params[k].default;
  Object.assign(p, userParams);
  const C = zonesFor(p.colorway, userParams);
  const R = rigBuilder();
  const k = p.length / 0.6, cell = 0.008 * k;

  const color = (t, a, P, part) => {
    const sa = Math.sin(a);
    if (sa < -0.5) return C.belly;
    const b = fbm(P, 1 / (0.035 * k), 3);
    return mixHex(C.skin, C.speckle, smooth(clamp((b - 0.54) / 0.2, 0, 1)) * 0.9);
  };
  const S = buildSaurian(R, {
    L: p.length, tailFrac: 0.47, headL: 0.088 * k, neckL: 0.043 * k,
    bodyW: 0.048 * k, bodyH: 0.036 * k, hipY: 0.052 * k, chestY: 0.058 * k, headY: 0.052 * k, headW: 0.037 * k, headH: 0.033 * k,
    foreL: 0.082 * k, hindL: 0.092 * k, foreR: 0.014 * k, hindR: 0.017 * k, toeL: 0.3, claw: C.claw,
    tailSway: p.tailSway, walk: p.walk, tailHR: 1.3, tailTaper: 1.15, skin: C.skin, toeHex: C.skin, color,
    head: {
      n: 2.3, drop: 0.32, jawH: 0.45, jawW: 0.86, mouth: C.mouth, nostril: C.claw,
      hw: [[0, 0.85], [0.3, 1], [0.65, 0.8], [0.92, 0.55], [1, 0.32]], hh: [[0, 0.95], [0.3, 1], [0.7, 0.75], [0.95, 0.5], [1, 0.3]],
      eye: { t: 0.42, r: 0.0085 * k, iris: C.iris, pupil: C.pupil, slit: [0.2, 0.75], lid: C.skin, lidR: 0.32, up: 0.55 }
    }
  });
  // soft spine crest (nuchal + dorsal) and low caudal sawtooth
  const spine = (b, sw, t, h, hex) => {
    const P = surfPt(sw, t, Math.PI / 2, -h * 0.2), w = h * 0.3;
    fin(b.s, [[w, 0], [-w * 0.6, h], [-w * 1.1, 0]], h * 0.14, hex, { ry: -Math.PI / 2, pos: P, bevel: h * 0.04 });
  };
  const ch = 0.0115 * k * p.crest * 2.2;
  for (let i = 0; i < 26; i++) { const t = 0.05 + i * 0.036; if (t < 0.97) spine(S.body, S.trunk, t, ch * (t > 0.7 ? 1.25 : 0.85), C.spine); }
  for (let i = 0; i < 22; i++) { const t = 0.03 + i * 0.035; spine(S.tail, S.tailSw, t, ch * 0.9 * (1 - t), C.skin); }

  const g = new THREE.Group();
  g.name = 'tuatara';
  const N = assemble(g, R.bones, p.mergeForProduction);
  N.jaw.rotation.x = THREE.MathUtils.degToRad(p.mouthOpen);
  return g;
}

export default createAsset;
