/*
 * AMERICAN BULLFROG — Lithobates catesbeianus (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures.
 *
 * QUICK START
 *   import { createAsset } from './american-bullfrog.mjs';
 *   scene.add(createAsset({ mergeForProduction: true }));
 *
 * PARAMS  length 0.09–0.2 m · stretch (sit → leap) · vocalSac · colorway · per-zone colours
 * SPECS   5,994 triangles · 9 draw calls merged · 0.20 x 0.082 x 0.17 m (W x H x D, default params).
 *         Swept head-body, large tympanum discs, swept dorsolateral folds, translucent hind-foot
 *         webbing fans, inflatable vocal sac bone.
 * PARTS   animate: throat, legHL, legHR, legFL, legFR
 *         detach:  throat
 * LICENSE CC0 1.0 — public domain, free for any use.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const SURFACE = { roughness: 0.4, metalness: 0.04 };

// Digital Diorama revision: olive-brown with dark mottling, a greener face (it was bright leaf green)
const BASE = { skin: '#5f6634', head: '#7d8a3e', mottle: '#33331c', belly: '#eee6c4', throat: '#e6d88e', tymp: '#6e5e34', web: '#4e5630', iris: '#c89a3a', pupil: '#080806', lip: '#2a2a18' };
export const COLORWAYS = {
  default: { ...BASE },
  olive:   { skin: '#6a6a3a', head: '#7c7a40', mottle: '#3e3e24', belly: '#ece4c4', throat: '#e0d8a0', tymp: '#5e5430', web: '#5a5a34', iris: '#b8903a', pupil: '#080806', lip: '#2a2a18' },
  bronze:  { skin: '#7a6236', head: '#94783e', mottle: '#4a3a20', belly: '#f0e4c4', throat: '#ecd890', tymp: '#6a5028', web: '#6a5430', iris: '#d0a03a', pupil: '#080806', lip: '#302414' },
  blue:    { skin: '#4a7a8a', head: '#5a9aa8', mottle: '#2a4a54', belly: '#eef0e6', throat: '#d8e4dc', tymp: '#4a6a70', web: '#3e6470', iris: '#c8a24a', pupil: '#080806', lip: '#1a2a30' }
};
export const presets = COLORWAYS;

export const info = {
  name: 'American Bullfrog', scientific: 'Lithobates catesbeianus', class: 'Amphibia', order: 'Anura', group: 'Frogs & Toads', family: 'Ranidae',
  habitat: 'Permanent ponds, lakes & slow rivers, North America', environment: 'wetland', size: '9–20 cm', status: 'Least Concern',
  fact: 'Males defend territories with a deep "jug-o-rum" call; a tympanum larger than the eye marks a male.'
};

export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'Merge each rig bone into one draw call; off = selectable meshes.' },
  colorway: { type: 'choice', default: 'default', label: 'Colorway', affects: 'colors', options: Object.keys(COLORWAYS), describe: 'Colour form.' },
  length:   { type: 'range', default: 0.16, min: 0.09, max: 0.2, step: 0.005, label: 'Length (m)', affects: 'geometry', describe: 'Snout-vent length.' },
  stretch:  { type: 'range', default: 0, min: 0, max: 1, step: 0.02, label: 'Pose: Sit → Leap', affects: 'geometry', describe: 'Limb folding rebuilt from sitting to mid-leap.' },
  vocalSac: { type: 'range', default: 0.3, min: 0, max: 1, step: 0.05, label: 'Vocal Sac', affects: 'geometry', describe: 'Throat inflation.' },
  male:     { type: 'toggle', default: true, label: 'Male (large tympanum)', affects: 'geometry', describe: 'Sexual dimorphism in tympanum size.' },
  skin:     { type: 'color', default: BASE.skin, label: 'Dorsum', affects: 'colors', describe: 'Back colour.' },
  head:     { type: 'color', default: BASE.head, label: 'Head', affects: 'colors', describe: 'Head colour.' },
  belly:    { type: 'color', default: BASE.belly, label: 'Belly', affects: 'colors', describe: 'Ventral colour.' }
};

export const rig = {
  throat: { axis: 'y', type: 'scale', range: [1, 2.6], speed: 1.6, describe: 'Calling' },
  legHL:  { axis: 'y', range: [-6, 6], speed: 0.8, phase: 0 },
  legHR:  { axis: 'y', range: [6, -6], speed: 0.8, phase: 0 },
  legFL:  { axis: 'x', range: [-6, 4], speed: 0.8, phase: 0 },
  legFR:  { axis: 'x', range: [-6, 4], speed: 0.8, phase: Math.PI }
};
export const detach = ['throat'];
export const night = { eyes: { color: '#ffd070', intensity: 1.6, describe: 'Pond-edge eyeshine' } };

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


// ── anuran body plan: one continuous swept head-body, folded Z-legs, webbing, pads, vocal sac ──
function buildAnuran(R, s) {
  const L = s.L, W = s.W, H = s.H, st = s.stretch ?? 0;
  const col = (part) => (s.color ? (t, a, P) => s.color(t, a, P, part) : null);
  const body = R.bone('body');
  const lift = st * L * 0.18;
  const rearY = lerp(L * 0.2, L * 0.3, st) + lift, midY = lerp(L * 0.3, L * 0.31, st) + lift, noseY = lerp(L * 0.38, L * 0.31, st) + lift;
  const pts = [[0, rearY, -L * 0.5], [0, midY, -L * 0.05], [0, noseY, L * 0.5]];
  const bw = prof(s.bw || [[0, 0.3], [0.1, 0.75], [0.38, 1], [0.6, 0.95], [0.78, 0.88], [0.92, 0.62], [1, 0.2]]);
  const bh = prof(s.bh || [[0, 0.3], [0.12, 0.8], [0.4, 1], [0.62, 0.82], [0.82, 0.6], [0.95, 0.36], [1, 0.12]]);
  const sw = addSweep(body.s, pts, (t) => ({ w: W * bw(t), h: H * bh(t), flat: s.flat ?? 0.6 }), s.skin, { seg: 28, rad: 16, color: col('body'), cap0: L * 0.03, cap1: L * 0.02 });
  // eyes
  const et = s.eyeT ?? 0.72;
  for (const sd of [-1, 1]) {
    const P = surfPt(sw, et, sideA(sd, s.eyeElev ?? 1.0), s.eyeR * (s.eyeOut ?? 0.35));
    eye(body, P, s.eyeR, s.iris, s.pupil, [sd * 0.8, 0.5, 0.4], { slit: s.slit || [0.75, 0.4], lid: s.lid, lidR: 0.2, lidOut: -0.1 });
  }
  // mouth line
  const lip = L * 0.004, mp = [];
  for (const t of [0.6, 0.78, 0.92]) mp.push(surfPt(sw, t, sideA(-1, -0.12), lip));
  const Lp = surfPt(sw, 0.975, sideA(-1, -0.12), lip), Rp = surfPt(sw, 0.975, sideA(1, -0.12), lip);
  const F = [0, (Lp[1] + Rp[1]) / 2, Lp[2] + W * bw(0.975) * 0.5];
  const mr = []; for (const t of [0.92, 0.78, 0.6]) mr.push(surfPt(sw, t, sideA(1, -0.12), lip));
  tube(body.s, [...mp, Lp, F, Rp, ...mr], L * 0.006, L * 0.006, s.mouthLine, { seg: 40, rad: 5 });
  // tympanum
  if (s.tymp) for (const sd of [-1, 1]) {
    const P = surfPt(sw, et - (s.tympT ?? 0.13), sideA(sd, 0.45), 0);
    const g = new THREE.CylinderGeometry(s.tymp, s.tymp, L * 0.008, 16);
    g.rotateZ(Math.PI / 2); g.rotateZ(-sd * 0.4); g.translate(P[0], P[1], P[2]);
    body.s.push({ g, c: s.tympHex });
  }
  // nostrils
  for (const sd of [-1, 1]) { const P = surfPt(sw, 0.95, sideA(sd, 1.15), 0); blob(body.s, L * 0.008, P[0], P[1], P[2], s.mouthLine, 1, 0.6, 1); }
  const lr = s.legR ?? L * 0.06;
  // hind legs
  for (const sd of [-1, 1]) {
    const nm = sd > 0 ? 'legHL' : 'legHR';
    const hip = [sd * W * 0.5, rearY + H * 0.02, -L * 0.3];
    const hb = R.bone(nm, hip, 'body');
    const knee = [sd * lerp(W * 0.5 + L * 0.42, W * 0.5 + L * 0.22, st), lerp(rearY * 0.8, rearY * 0.9, st), lerp(-L * 0.04, -L * 0.72, st)];
    const ankle = [sd * lerp(W * 0.42 + L * 0.1, W * 0.35 + L * 0.3, st), lerp(lr * 1.1, rearY * 0.85, st), lerp(-L * 0.52, -L * 1.25, st)];
    tube(hb.s, [hip, lerp3(hip, knee, 0.5), knee], lr * 1.55, lr * 0.95, s.skin, { seg: 10, rad: 10, bulge: lr * 0.25, color: col('leg') });
    tube(hb.s, [knee, lerp3(knee, ankle, 0.5), ankle], lr * 0.95, lr * 0.6, s.skin, { seg: 8, rad: 8, color: col('leg') });
    const hd = sd * lerp(0.55, Math.PI - 0.25, st);
    const tars = [ankle[0] + Math.sin(hd) * L * 0.2, lerp(lr * 0.4, ankle[1], st), ankle[2] + Math.cos(hd) * L * 0.2];
    tube(hb.s, [ankle, tars], lr * 0.6, lr * 0.42, s.skin, { seg: 4, rad: 7, color: col('leg') });
    const lens = [0.45, 0.65, 0.92, 1.18, 0.82];
    const tips = foot(hb.s, tars, hd, { n: 5, len: L * (s.toeL ?? 0.32), r: lr * 0.24, hex: s.toeHex, spread: s.hindSpread ?? 0.95, lens: sd > 0 ? lens : lens.slice().reverse(), pad: s.pad, padR: s.padR, groundY: lerp(lr * 0.25, tars[1], st) });
    if (s.web != null) web(hb.gl, tars, tips, s.web, s.webSag ?? 0.32);
  }
  // fore legs
  for (const sd of [-1, 1]) {
    const nm = sd > 0 ? 'legFL' : 'legFR';
    const shp = surfPt(sw, 0.66, sideA(sd, -0.5), -H * 0.25);
    const fb = R.bone(nm, shp, 'body');
    const elbow = [sd * W * 0.66, lerp(L * 0.15, noseY * 0.6, st), lerp(L * 0.1, -L * 0.02, st)];
    const wrist = [sd * W * 0.56, lerp(lr * 0.4, noseY * 0.35, st), lerp(L * 0.33, L * 0.36, st)];
    tube(fb.s, [shp, elbow, wrist], lr * 0.75, lr * 0.45, s.skin, { seg: 10, rad: 8, color: col('leg') });
    foot(fb.s, wrist, -sd * 0.2, { n: 4, len: L * 0.14, r: lr * 0.2, hex: s.toeHex, spread: 1.6, lens: [0.7, 1, 0.9, 0.6], pad: s.pad, padR: s.padR, groundY: lerp(lr * 0.22, wrist[1] * 0.6, st) });
  }
  // vocal sac / throat (scalable)
  let throat = null;
  if (s.throat != null) {
    const P = surfPt(sw, 0.8, -Math.PI / 2, 0);
    throat = R.bone('throat', P, 'body');
    blob(throat.s, W * 0.36, P[0], P[1] - W * 0.08, P[2], s.throat, 1.15, 0.55, 1, 2);
  }
  return { body, sw, rearY, noseY, throat };
}


export function createAsset(userParams = {}) {
  const p = {};
  for (const k of Object.keys(params)) p[k] = params[k].default;
  Object.assign(p, userParams);
  const C = zonesFor(p.colorway, userParams);
  const R = rigBuilder();
  const L = p.length;

  const color = (t, a, P, part) => {
    const sa = Math.sin(a);
    const m = smooth(clamp((fbm(P, 1 / (0.07 * L), 3) - 0.5) / 0.08, 0, 1));
    if (sa < -0.45) return mixHex(C.belly, C.mottle, m * 0.1);
    if (part === 'leg') return mixHex(C.skin, C.mottle, m * 0.85 + 0.1 * softBand(P.z, 0.026 * L, 0.22));
    if (t > 0.6) return mixHex(mixHex(C.head, C.skin, 0.35), C.mottle, m * 0.35 * (1 - smooth(clamp((t - 0.6) / 0.2, 0, 1))));
    return mixHex(C.skin, C.mottle, m * 0.75);
  };
  const F = buildAnuran(R, {
    L, W: 0.24 * L, H: 0.15 * L, stretch: p.stretch, eyeR: 0.072 * L, eyeT: 0.72, eyeElev: 1.0, legR: 0.082 * L,
    tymp: (p.male ? 0.078 : 0.055) * L, tympHex: C.tymp, tympT: 0.15,
    iris: C.iris, pupil: C.pupil, slit: [0.85, 0.42], lid: C.head, mouthLine: C.lip, toeHex: C.skin, web: C.web, throat: C.throat,
    skin: C.skin, color, toeL: 0.36,
    bw: [[0, 0.3], [0.1, 0.78], [0.38, 1], [0.6, 0.96], [0.78, 0.9], [0.92, 0.65], [1, 0.22]]
  });
  // dorsolateral fold: curls from behind the eye around the tympanum
  for (const sd of [-1, 1]) {
    const pts = [[0.66, 0.95], [0.58, 0.72], [0.52, 0.42], [0.5, 0.15]].map(([t, e]) => surfPt(F.sw, t, sideA(sd, e), 0.002 * L));
    tube(F.body.s, pts, 0.009 * L, 0.005 * L, C.head, { seg: 12, rad: 6 });
    const P = surfPt(F.sw, 0.72 - 0.15, sideA(sd, 0.45), 0.001 * L);
    const ring = new THREE.TorusGeometry((p.male ? 0.08 : 0.058) * L, 0.007 * L, 6, 20);
    ring.rotateY(Math.PI / 2); ring.translate(P[0], P[1], P[2]);
    F.body.s.push({ g: ring, c: C.tymp });
  }

  const g = new THREE.Group();
  g.name = 'american-bullfrog';
  const N = assemble(g, R.bones, p.mergeForProduction);
  N.throat.scale.y = 1 + p.vocalSac * 1.6;
  N.throat.scale.x = 1 + p.vocalSac * 0.5;
  return g;
}

export default createAsset;
