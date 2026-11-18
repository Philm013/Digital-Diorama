/*
 * BIRD RIG (High Detail) — procedural, skinned, swept-surface birds
 * A parametric low-poly generator for three.js: one import, no loader, no textures.
 * Family-specific torso lofts, S-curved necks, anatomical skulls (occiput, cranium, brow and
 * lores) whose face section flows unbroken into the upper mandible, hinged jaws (cone, hook,
 * flat, dagger, pouch, giant), feathered wing planforms with serrated trailing edges
 * and slotted primaries, fanned/forked/train tails with eyespots, crests, combs and
 * wattles, and perching, webbed, zygodactyl, taloned or ratite feet.
 * Each wing exists twice — folded on the flank and spread on humerus/forearm/hand
 * bones — and the clips swap them with bone-scale keys for clean silhouettes.
 *
 * QUICK START
 *   import { createAsset, createClips } from './bird-rig.mjs';
 *   const eagle = createAsset({ species: 'eagle', mergeForProduction: true });
 *   const mixer = new THREE.AnimationMixer(eagle);
 *   mixer.clipAction(createClips(eagle).find(c => c.name === 'flap')).play();
 *
 * SPECIES  32 presets with species-specific torso and skull lofts: songbirds, pigeons, woodpeckers,
 *          kingfishers, parrots, owls, raptors, waders, waterfowl, alcids, ratites, galliforms,
 *          hummingbirds, pelicans, toucans, hornbills, albatrosses and gulls.
 * SPECS    6,412-9,016 triangles at standard detail; 1 solid
 *          material (+1 translucent for glass parts); merged = 1-2 draw calls.
 *          Real-world L x H x W (m): House Sparrow 0.138x0.114x0.048; European Robin
 *          0.128x0.111x0.05; Carrion Crow 0.41x0.315x0.131; Northern Cardinal
 *          0.189x0.161x0.058.
 *          +Z forward, +Y up, ground at y = 0; exact bounds in asset.userData.dimensions.
 * OPTIONS  species, size, age, body/leg/neck/head proportions, neck curve, beak length/
 *          depth/hook, eye size, wingspan, wing breadth, wing tip, tail length/spread/
 *          style, crest, feet, talons, variation, detail, rig mode, pose, colourway.
 * RIG      Root > Hips > Chest > Neck1 > Neck2 > Head > Jaw; Chest > WingL/R > Humerus >
 *          Forearm > Hand; Chest > WingFoldL/R; Hips > Tail; Hips > Thigh > Shin > Tarsus > Toe.
 * CLIPS    perch, walk, hop, peck, flap, glide. createClips(asset), setPose(asset, name, phase).
 * PARTS    animate: see `rig`; detach: crest, wings, wings-folded, tail, beak, eyes, legs, feet.
 * LICENSE  CC0 1.0 Universal — this module and all generated geometry.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ════════════════════════════════════════════════════════════════════════════
 *  INLINE SWEEP ENGINE  (self-contained; duplicated verbatim in every rig file)
 *  Bodies are lofted superellipse sections swept along transported frames,
 *  membranes are thickened parametric sheets, and every vertex carries
 *  four-bone skin weights so the same geometry poses, animates or bakes.
 * ════════════════════════════════════════════════════════════════════════════ */
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / ((b - a) || 1e-9), 0, 1); return t * t * (3 - 2 * t); };
const bell = (x, c, w) => { const d = (x - c) / w; return d * d >= 1 ? 0 : (1 - d * d) * (1 - d * d); };
const fract = (x) => x - Math.floor(x);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const vec = (p) => (p && p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2]));
const asFn = (f, d = 0) => (typeof f === 'function' ? f : f === undefined || f === null ? () => d : () => f);
const ang = (deg) => deg * DEG;
const dirYZ = (deg) => V3(0, Math.sin(deg * DEG), Math.cos(deg * DEG));

/** Monotone cubic (Fritsch–Carlson) profile through [[t, value], ...]: smooth bulges, never overshoots. */
function prof(keys) {
  const k = keys.filter(Boolean).slice().sort((a, b) => a[0] - b[0]);
  const n = k.length;
  if (n === 0) return () => 0;
  if (n === 1) return () => k[0][1];
  const xs = k.map(e => e[0]), ys = k.map(e => e[1]), d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / Math.max(1e-9, xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(d[i]) < 1e-12) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (t) => {
    if (t <= xs[0]) return ys[0];
    if (t >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (i < n - 2 && t > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], s = (t - xs[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * ys[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * ys[i + 1] + (s3 - s2) * h * m[i + 1];
  };
}

function mulberry(seed) {
  let a = (Math.floor(seed) >>> 0) ^ 0x9e3779b9;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash3(x, y, z, s) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x9e3779b1) ^ Math.imul((s | 0) + 1013, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
/** Smooth value noise in [0, 1]. */
function vnoise(x, y, z, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  let r = 0;
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) {
    r += hash3(ix + dx, iy + dy, iz + dz, s) * (dx ? ux : 1 - ux) * (dy ? uy : 1 - uy) * (dz ? uz : 1 - uz);
  }
  return r;
}
function fbm(x, y, z, s = 0, oct = 3) {
  let a = 0.5, f = 1, r = 0, n = 0;
  for (let i = 0; i < oct; i++) { r += a * vnoise(x * f, y * f, z * f, s + i * 31); n += a; a *= 0.5; f *= 2.03; }
  return r / n;
}
/** Cellular (Worley) noise: [nearest, second nearest] feature distances. */
function worley(x, y, z, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let f1 = 9, f2 = 9;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    const cx = ix + dx, cy = iy + dy, cz = iz + dz;
    const px = cx + hash3(cx, cy, cz, s), py = cy + hash3(cx, cy, cz, s + 7), pz = cz + hash3(cx, cy, cz, s + 13);
    const d = Math.hypot(px - x, py - y, pz - z);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return [f1, f2];
}

/* ── colour helpers (sRGB hex space, independent of renderer colour management) ── */
const hexOf = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v & 0xffffff;
  if (typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v.trim())) return parseInt(v.trim().replace('#', ''), 16);
  return null;
};
const hexStr = (h) => '#' + ((h ?? 0) & 0xffffff).toString(16).padStart(6, '0');
function rgbOf(h) { return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]; }
function hexRGB(r, g, b) { return (clamp(Math.round(r * 255), 0, 255) << 16) | (clamp(Math.round(g * 255), 0, 255) << 8) | clamp(Math.round(b * 255), 0, 255); }
function hslOf(h) {
  const [r, g, b] = rgbOf(h), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hh / 6, s, l];
}
function hexHSL(h, s, l) {
  h = fract(h); s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  if (s === 0) return hexRGB(l, l, l);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = fract(t); return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return hexRGB(f(h + 1 / 3), f(h), f(h - 1 / 3));
}
function mixHex(a, b, t) { const A = rgbOf(hexOf(a)), B = rgbOf(hexOf(b)); return hexRGB(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); }
function tone(hex, { dh = 0, s = 1, l = 1, la = 0 } = {}) { const [h, ss, ll] = hslOf(hexOf(hex)); return hexHSL(h + dh, ss * s, ll * l + la); }

/* ── geometry accumulation: non-indexed triangles, one zone per face, 4 skin influences per vertex ── */
const NO_W = [[0, 1]];
class Part {
  constructor(name, opt = {}) {
    this.name = name; this.glass = !!opt.glass; this.group = opt.group || name;
    this.p = []; this.z = []; this.si = []; this.sw = [];
  }
  get count() { return this.p.length / 3; }
  v(P, W) {
    this.p.push(P.x, P.y, P.z);
    const w = W || NO_W;
    for (let i = 0; i < 4; i++) { const e = w[i]; this.si.push(e ? e[0] : 0); this.sw.push(e ? e[1] : 0); }
  }
  tri(a, b, c, zone, wa, wb, wc) {
    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z, vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * cx + cy * cy + cz * cz < 1e-26) return;
    this.v(a, wa); this.v(b, wb || wa); this.v(c, wc || wa); this.z.push(zone);
  }
}

/** Centripetal Catmull-Rom path, arc-length parameterised. */
function makePath(points, closed = false) {
  const clean = [];
  for (const p of points) { const v = vec(p); if (!clean.length || v.distanceToSquared(clean[clean.length - 1]) > 1e-14) clean.push(v); }
  if (clean.length === 1) clean.push(clean[0].clone().add(V3(0, 0, 1e-4)));
  const c = clean.length === 2 && !closed ? new THREE.LineCurve3(clean[0], clean[1]) : new THREE.CatmullRomCurve3(clean, closed, 'centripetal');
  c.arcLengthDivisions = Math.max(200, clean.length * 48);
  return c;
}
/** Arc-length parameters (0..1) of each control point of a Catmull-Rom path. */
function knotUs(curve, n) {
  if (n < 2) return [0];
  if (curve.isLineCurve3) return [0, 1];
  const per = 24, L = curve.getLengths((n - 1) * per), tot = L[L.length - 1] || 1;
  return Array.from({ length: n }, (_, i) => L[i * per] / tot);
}

const capOf = (c, d) => (c === undefined || c === null ? d : typeof c === 'string' ? { type: c } : c);
/** Superellipse point: a=0 side(+S), a=PI/2 up(+U). Separate top/bottom half-heights and exponents. */
function sePoint(a, w, ht, hb, nt, nb) {
  const c = Math.cos(a), s = Math.sin(a), e = 2 / (s >= 0 ? nt : nb);
  return [w * Math.sign(c) * Math.abs(c) ** e, (s >= 0 ? ht : hb) * Math.sign(s) * Math.abs(s) ** e];
}

/**
 * Loft: sweeps superelliptic sections along a path with parallel-transported frames.
 * Tangents are smoothed over a window proportional to the local section size, and
 * rings are kept monotone so thick bodies never fold inside tight bends.
 */
function loft(o) {
  const curve = o.curve || makePath(o.pts, !!o.closed);
  const closed = !!o.closed;
  const K = Math.max(2, Math.round(o.seg || 16)), R = Math.max(3, Math.round(o.rad || 12));
  const u0 = o.u0 ?? 0, u1 = o.u1 ?? 1;
  const W = asFn(o.w, 0.1), HT = asFn(o.ht ?? o.w, 0.1), HB = asFn(o.hb ?? o.ht ?? o.w, 0.1);
  const NT = asFn(o.nt, 2), NB = asFn(o.nb ?? o.nt, 2), OY = asFn(o.oy, 0), OX = asFn(o.ox, 0), ROLL = asFn(o.roll, 0);
  const dist = o.dist || ((t) => t), bump = o.bump || null;
  const len = curve.getLength();
  const sizeAt = (u) => Math.max(Math.abs(W(u)), Math.abs(HT(u)), Math.abs(HB(u)));
  const NF = Math.max(48, K * 3), fs = [], ft = [];
  for (let i = 0; i <= NF; i++) { const u = u0 + (u1 - u0) * i / NF; fs.push(u * len); ft.push(curve.getTangentAt(clamp(u, 0, 1))); }
  const bendK = o.bend ?? 0.9;
  const tangentAt = (u) => {
    const raw = curve.getTangentAt(clamp(u, 0, 1));
    if (bendK <= 0 || closed) return raw;
    // bendMax caps the window as a fraction of the loft length. On a short loft (a songbird or parrot neck)
    // a window wider than the loft tilts the rings beside a shared boundary ring, folding a collar crease.
    const s = u * len, sig = Math.max(len * 0.004, Math.min(bendK * sizeAt(u), len * (o.bendMax ?? 1e9))), acc = V3();
    for (let i = 0; i <= NF; i++) { const d = (fs[i] - s) / sig; if (d * d < 9) acc.addScaledVector(ft[i], Math.exp(-d * d)); }
    return acc.lengthSq() < 1e-12 ? raw : acc.normalize();
  };
  const us = [], C = [], T = [];
  const KK = closed ? K - 1 : K;
  for (let k = 0; k <= KK; k++) {
    const u = closed ? k / K : u0 + (u1 - u0) * dist(k / K);
    us.push(u); C.push(curve.getPointAt(clamp(u, 0, 1))); T.push(tangentAt(u));
  }
  const hint = vec(o.up || [0, 1, 0]);
  let up = hint.clone().addScaledVector(T[0], -hint.dot(T[0]));
  if (up.lengthSq() < 1e-8) { up = Math.abs(T[0].z) < 0.9 ? V3(0, 0, 1) : V3(0, 1, 0); up.addScaledVector(T[0], -up.dot(T[0])); }
  up.normalize();
  const Ups = [], Sides = [], q = new THREE.Quaternion();
  for (let k = 0; k < us.length; k++) {
    if (k > 0) { q.setFromUnitVectors(T[k - 1], T[k]); up.applyQuaternion(q); up.addScaledVector(T[k], -up.dot(T[k])).normalize(); }
    const uu = up.clone(), ss = new THREE.Vector3().crossVectors(uu, T[k]).normalize();
    const r = ROLL(us[k]);
    if (r) { uu.applyAxisAngle(T[k], r); ss.applyAxisAngle(T[k], r); }
    Ups.push(uu); Sides.push(ss);
  }
  const rows = [];
  for (let k = 0; k < us.length; k++) {
    const u = us[k], w = W(u), ht = HT(u), hb = HB(u), nt = NT(u), nb = NB(u), oy = OY(u), ox = OX(u), row = [];
    for (let j = 0; j < R; j++) {
      const a = (j / R) * TAU;
      let [x, y] = sePoint(a, w, ht, hb, nt, nb);
      if (bump) { const f = 1 + bump(u, a, x, y); x *= f; y *= f; }
      row.push(C[k].clone().addScaledVector(Sides[k], x + ox).addScaledVector(Ups[k], y + oy));
    }
    rows.push(row);
  }
  if (!closed && o.antifold !== false) for (let k = 1; k < rows.length; k++) {
    const step = C[k].distanceTo(C[k - 1]) * 0.18;
    for (let j = 0; j < R; j++) {
      const d = rows[k][j].clone().sub(rows[k - 1][j]).dot(T[k]);
      if (d < step) rows[k][j].addScaledVector(T[k], step - d);
    }
  }
  const g = { rows, us: us.slice(), R, closed, C, T, Ups, Sides, tip0: null, tip1: null, main: [0, rows.length - 1], len };
  if (!closed) {
    const mkCap = (k, sign, spec) => {
      const base = rows[k], ctr = base.reduce((s, p) => s.add(p), V3()).divideScalar(R);
      const Td = T[k].clone().multiplyScalar(sign);
      let rm = 0; for (const p of base) rm += p.distanceTo(ctr); rm /= R;
      if (spec.type === 'open') return { rings: [], tip: null };
      if (spec.type === 'flat') return { rings: [], tip: ctr };
      if (spec.type === 'point') return { rings: [], tip: ctr.clone().addScaledVector(Td, (spec.len ?? 1) * rm) };
      const n = Math.max(2, spec.n ?? 3), L = (spec.len ?? 1) * rm, rings = [];
      for (let i = 1; i < n; i++) {
        const phi = (i / n) * Math.PI / 2, sc = Math.cos(phi), off = Math.sin(phi) * L;
        rings.push(base.map(p => ctr.clone().addScaledVector(p.clone().sub(ctr), sc).addScaledVector(Td, off)));
      }
      return { rings, tip: ctr.clone().addScaledVector(Td, L) };
    };
    const a0 = mkCap(0, -1, capOf(o.cap0, { type: 'round', len: 0.8 })), a1 = mkCap(rows.length - 1, 1, capOf(o.cap1, { type: 'round', len: 0.8 }));
    const pre = a0.rings.slice().reverse(), post = a1.rings;
    g.rows = [...pre, ...rows, ...post];
    g.us = [...pre.map(() => us[0]), ...us, ...post.map(() => us[us.length - 1])];
    g.main = [pre.length, pre.length + rows.length - 1];
    g.tip0 = a0.tip; g.tip1 = a1.tip;
  }
  /** Surface query on the main rows: point & outward normal at (u, a). */
  g.at = (u, a) => {
    const [m0, m1] = g.main, R_ = g.R;
    let k = m0; while (k < m1 - 1 && g.us[k + 1] < u) k++;
    const span = (g.us[k + 1] - g.us[k]) || 1, t = clamp((u - g.us[k]) / span, 0, 1);
    const fa = ((a / TAU) % 1 + 1) % 1 * R_, j0 = Math.floor(fa) % R_, j1 = (j0 + 1) % R_, ta = fa - Math.floor(fa);
    const P = (kk, jj) => g.rows[kk][jj];
    const pt = (kk) => P(kk, j0).clone().lerp(P(kk, j1), ta);
    const p = pt(k).lerp(pt(Math.min(k + 1, m1)), t);
    const du = pt(Math.min(k + 1, m1)).sub(pt(k));
    const ja = (j0 + R_ - 1) % R_, jb = (j1 + 1) % R_;
    const da = P(k, jb).clone().lerp(P(Math.min(k + 1, m1), jb), t).sub(P(k, ja).clone().lerp(P(Math.min(k + 1, m1), ja), t));
    const n = new THREE.Vector3().crossVectors(da, du);
    if (n.lengthSq() < 1e-20) n.copy(p).sub(g.C[Math.min(k - m0, g.C.length - 1)] || p);
    return { p, n: n.normalize(), t: g.T[clamp(k - m0, 0, g.T.length - 1)].clone() };
  };
  /** Centre and frame at u (main stations, interpolated). */
  g.frame = (u) => {
    let k = 0; while (k < us.length - 2 && us[k + 1] < u) k++;
    const t = clamp((u - us[k]) / ((us[k + 1] - us[k]) || 1), 0, 1);
    return { c: C[k].clone().lerp(C[k + 1], t), t: T[k].clone().lerp(T[k + 1], t).normalize(), up: Ups[k].clone().lerp(Ups[k + 1], t).normalize(), side: Sides[k].clone().lerp(Sides[k + 1], t).normalize() };
  };
  return g;
}

/** Emits a loft grid into a part. zone: key | fn(u, a, centroid); skin: weights | fn(u, a, P). */
function emit(part, g, zone, skin) {
  const zf = typeof zone === 'function' ? zone : () => zone;
  const sf = typeof skin === 'function' ? skin : () => skin;
  const rows = g.rows, us = g.us, R = g.R, nr = rows.length;
  const Wt = rows.map((row, k) => row.map((P, j) => sf(us[k], (j / R) * TAU, P)));
  const ctr = V3();
  const kEnd = g.closed ? nr : nr - 1;
  for (let k = 0; k < kEnd; k++) {
    const k1 = (k + 1) % nr, uk = us[k], uk1 = g.closed && k1 === 0 ? 1 : us[k1];
    for (let j = 0; j < R; j++) {
      const j1 = (j + 1) % R, A = rows[k][j], B = rows[k1][j], Cc = rows[k1][j1], D = rows[k][j1];
      // One zone per quad: splitting colours per triangle produced sawtooth fringes on sliver quads and
      // starbursts at eyeball poles. Patterns stay clean by being defined in surface (u, a) space instead.
      ctr.copy(A).add(B).add(Cc).add(D).multiplyScalar(0.25);
      const zn = zf((uk + uk1) / 2, ((j + 0.5) / R) * TAU, ctr);
      part.tri(A, Cc, B, zn, Wt[k][j], Wt[k1][j1], Wt[k1][j]);
      part.tri(A, D, Cc, zn, Wt[k][j], Wt[k][j1], Wt[k1][j1]);
    }
  }
  const fan = (tip, row, u, start, ws) => {
    const wt = sf(u, 0, tip);
    for (let j = 0; j < R; j++) {
      const j1 = (j + 1) % R;
      ctr.copy(tip).add(row[j]).add(row[j1]).multiplyScalar(1 / 3);
      const zn = zf(u, ((j + 0.5) / R) * TAU, ctr);
      if (start) part.tri(tip, row[j1], row[j], zn, wt, ws[j1], ws[j]);
      else part.tri(tip, row[j], row[j1], zn, wt, ws[j], ws[j1]);
    }
  };
  if (!g.closed && g.tip0) fan(g.tip0, rows[0], us[0], true, Wt[0]);
  if (!g.closed && g.tip1) fan(g.tip1, rows[nr - 1], us[nr - 1], false, Wt[nr - 1]);
  return g;
}

/** Ellipsoid as a lofted body (cosine-spaced rings, closed poles). axis: direction of rz. */
function ellipsoid(center, rx, ry, rz, axis = [0, 0, 1], up = [0, 1, 0], seg = 8, rad = 10, bump = null) {
  const c = vec(center), ax = vec(axis).normalize();
  const s = (u) => 2 * Math.sqrt(Math.max(0, u * (1 - u)));
  return loft({
    pts: [c.clone().addScaledVector(ax, -rz), c.clone().addScaledVector(ax, rz)], seg, rad, up,
    dist: (t) => (1 - Math.cos(Math.PI * t)) / 2, w: (u) => rx * s(u), ht: (u) => ry * s(u), hb: (u) => ry * s(u),
    cap0: 'open', cap1: 'open', bend: 0, antifold: false, bump,
  });
}
/** Tapered round tube through points. r: number | fn(u). */
function tube(pts, r, seg = 10, rad = 6, o = {}) {
  const R = asFn(r, 0.01);
  return loft({ pts, seg, rad, w: R, ht: R, hb: R, cap0: o.cap0 ?? { type: 'round', len: 0.6, n: 2 }, cap1: o.cap1 ?? { type: 'round', len: 0.6, n: 2 }, up: o.up || [0, 1, 0], bend: o.bend ?? 0.5, ...o });
}

/**
 * Thickened parametric membrane (ears, fins, webs, wings, frills, feathers, sails).
 * f(u, v) → Vector3 on the mid-surface; th(u, v) total thickness. Front faces follow du × dv.
 */
function sheet(part, o) {
  const nu = Math.max(1, Math.round(o.nu || 6)), nv = Math.max(1, Math.round(o.nv || 4));
  const TH = typeof o.th === 'function' ? o.th : () => (o.th ?? 0.004);
  const zf = typeof o.zone === 'function' ? o.zone : (u, v, face) => (face < 0 && o.zoneBack ? o.zoneBack : o.zone);
  const sf = typeof o.skin === 'function' ? o.skin : () => o.skin;
  const P = [], F = [], B = [], Wt = [];
  for (let i = 0; i <= nu; i++) { P.push([]); for (let j = 0; j <= nv; j++) P[i].push(o.f(i / nu, j / nv)); }
  const hint = o.normal ? vec(o.normal) : null;
  for (let i = 0; i <= nu; i++) {
    F.push([]); B.push([]); Wt.push([]);
    for (let j = 0; j <= nv; j++) {
      const du = P[Math.min(i + 1, nu)][j].clone().sub(P[Math.max(i - 1, 0)][j]);
      const dv = P[i][Math.min(j + 1, nv)].clone().sub(P[i][Math.max(j - 1, 0)]);
      let n = new THREE.Vector3().crossVectors(du, dv);
      if (n.lengthSq() < 1e-24) n = hint ? hint.clone() : V3(0, 1, 0);
      n.normalize();
      const t = TH(i / nu, j / nv) / 2;
      F[i].push(P[i][j].clone().addScaledVector(n, t)); B[i].push(P[i][j].clone().addScaledVector(n, -t));
      Wt[i].push(sf(i / nu, j / nv, P[i][j]));
    }
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const um = (i + 0.5) / nu, vm = (j + 0.5) / nv, zF = zf(um, vm, 1), zB = zf(um, vm, -1);
    const w = [Wt[i][j], Wt[i + 1][j], Wt[i + 1][j + 1], Wt[i][j + 1]];
    part.tri(F[i][j], F[i + 1][j], F[i + 1][j + 1], zF, w[0], w[1], w[2]);
    part.tri(F[i][j], F[i + 1][j + 1], F[i][j + 1], zF, w[0], w[2], w[3]);
    part.tri(B[i][j], B[i + 1][j + 1], B[i + 1][j], zB, w[0], w[2], w[1]);
    part.tri(B[i][j], B[i][j + 1], B[i + 1][j + 1], zB, w[0], w[3], w[2]);
  }
  const edge = (a0, a1, b0, b1, wa, wb, zn) => { part.tri(a0, b0, b1, zn, wa, wa, wb); part.tri(a0, b1, a1, zn, wa, wb, wb); };
  for (let i = 0; i < nu; i++) {
    edge(F[i][0], F[i + 1][0], B[i][0], B[i + 1][0], Wt[i][0], Wt[i + 1][0], zf((i + 0.5) / nu, 0, 0));
    edge(B[i][nv], B[i + 1][nv], F[i][nv], F[i + 1][nv], Wt[i][nv], Wt[i + 1][nv], zf((i + 0.5) / nu, 1, 0));
  }
  for (let j = 0; j < nv; j++) {
    edge(B[0][j], B[0][j + 1], F[0][j], F[0][j + 1], Wt[0][j], Wt[0][j + 1], zf(0, (j + 0.5) / nv, 0));
    edge(F[nu][j], F[nu][j + 1], B[nu][j], B[nu][j + 1], Wt[nu][j], Wt[nu][j + 1], zf(1, (j + 0.5) / nv, 0));
  }
  return { P, F, B };
}

/** Orthonormal frame helpers. */
function basisFrom(fwd, upHint = [0, 1, 0]) {
  const f = vec(fwd).normalize();
  let u = vec(upHint); u.addScaledVector(f, -u.dot(f));
  if (u.lengthSq() < 1e-10) { u = Math.abs(f.y) < 0.9 ? V3(0, 1, 0) : V3(0, 0, 1); u.addScaledVector(f, -u.dot(f)); }
  u.normalize();
  const s = new THREE.Vector3().crossVectors(u, f).normalize();
  return { f, u, s };
}
/** Rotates vector v about axis by angle (radians), returning a new vector. */
const rot = (v, axis, a) => vec(v).applyAxisAngle(vec(axis).normalize(), a);

/** Point on a loft surface whose direction from c best matches dir (coarse search + refinement). */
function surfaceToward(g, c, dir, s0, s1) {
  let best = null, bd = -2;
  const test = (s, a) => { const r = g.at(s, a), d = r.p.clone().sub(c).normalize().dot(dir); if (d > bd) { bd = d; best = { ...r, s, a }; } };
  for (let i = 0; i <= 24; i++) for (let j = 0; j < 40; j++) test(lerp(s0, s1, i / 24), (j / 40) * TAU);
  const ds = (s1 - s0) / 24, da = TAU / 40, b0 = { ...best };
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) test(clamp(b0.s + i * ds / 3, s0, s1), b0.a + j * da / 3);
  return best;
}
/** Tapered cone spike from p along dir (spines, teeth, thorns, claws). */
function spike(part, p, dir, h, r, zone, W, rad = 4) {
  const g = tube([p.clone().addScaledVector(dir, -h * 0.25), p.clone().addScaledVector(dir, h)], (u) => r * (1 - u), 2, rad, { cap0: 'flat', cap1: 'point', bend: 0 });
  emit(part, g, zone, W);
}

/* ── skeleton: rest bones carry identity rotation, so clip angles are world-aligned ── */
class Rig {
  constructor() { this.list = []; this.by = {}; }
  add(name, parent, head, tail = null) {
    const bone = new THREE.Bone(); bone.name = name;
    const h = vec(head), par = parent ? this.by[parent] : null;
    if (parent && !par) throw new Error(`Unknown parent bone ${parent}`);
    bone.position.copy(par ? h.clone().sub(par.head) : h);
    if (par) par.bone.add(bone);
    const e = { name, bone, head: h, tail: tail ? vec(tail) : null, parent: par, kids: [], index: this.list.length };
    if (par) par.kids.push(e);
    this.list.push(e); this.by[name] = e;
    return e;
  }
  has(n) { return !!this.by[n]; }
  i(n) { const e = this.by[n]; if (!e) throw new Error(`Unknown bone ${n}`); return e.index; }
  head(n) { return this.by[n].head.clone(); }
  tailOf(e) {
    if (e.tail) return e.tail;
    if (e.kids.length) return e.kids.reduce((s, k) => s.add(k.head), V3()).divideScalar(e.kids.length);
    return e.head.clone().add(V3(0, 0.01, 0));
  }
  /** Rigid weight to one bone. */
  W(n) { return [[this.i(n), 1]]; }
  /** Two-bone blend (t = weight of b). */
  W2(a, b, t) { t = clamp(t, 0, 1); return normW([[this.i(a), 1 - t], [this.i(b), t]]); }
  /**
   * Partition-of-unity chain weights along a sweep parameter.
   * chain: [[boneName, uStart, blendHalfWidth], ...] ascending by uStart.
   */
  chain(chain, u) {
    const out = [];
    for (let j = 0; j < chain.length; j++) {
      const [n, a, ba] = chain[j];
      const lo = j === 0 ? 1 : sstep(a - ba, a + ba, u);
      const hi = j === chain.length - 1 ? 0 : sstep(chain[j + 1][1] - chain[j + 1][2], chain[j + 1][1] + chain[j + 1][2], u);
      const w = lo - hi;
      if (w > 1e-4) out.push([this.i(n), w]);
    }
    return normW(out.length ? out : [[this.i(chain[0][0]), 1]]);
  }
  /** Chain spec from bone names and their u positions; blend is a fraction of neighbouring spans. */
  spec(names, us, blend = 0.3) {
    return names.map((n, j) => {
      const prev = j > 0 ? us[j] - us[j - 1] : 1, next = j < us.length - 1 ? us[j + 1] - us[j] : prev;
      return [n, us[j], j === 0 ? 0 : Math.max(1e-4, blend * Math.min(prev, next))];
    });
  }
  /** Inverse-distance weights to bone segments (for attachments spanning several bones). */
  near(P, names, radius, sharp = 4) {
    const pool = [], d = V3();
    for (const n of names) {
      const e = this.by[n]; if (!e) continue;
      const a = e.head, b = this.tailOf(e);
      d.subVectors(b, a); const L2 = d.lengthSq();
      const t = L2 < 1e-14 ? 0 : clamp(((P.x - a.x) * d.x + (P.y - a.y) * d.y + (P.z - a.z) * d.z) / L2, 0, 1);
      const dist = P.distanceTo(a.clone().addScaledVector(d, t)) / Math.max(1e-6, radius);
      pool.push([e.index, 1 / (1e-4 + dist ** sharp)]);
    }
    return normW(pool);
  }
}
function normW(list) {
  const l = list.filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const tot = l.reduce((s, e) => s + e[1], 0) || 1;
  return l.map(e => [e[0], e[1] / tot]);
}
/** Blends two weight sets: (1-t)·A + t·B. */
function mixW(A, B, t) {
  const m = new Map();
  for (const [i, w] of A) m.set(i, (m.get(i) || 0) + w * (1 - t));
  for (const [i, w] of B) m.set(i, (m.get(i) || 0) + w * t);
  return normW([...m.entries()]);
}

/* ── clips & poses: samples are { Bone: [rx, ry, rz] degrees | { r: [...], p: [dx, dy, dz] } } ── */
const _e = new THREE.Euler(), _q = new THREE.Quaternion();
function bakeClip(info, name, duration, frames, sample, loop = true) {
  const times = [], samples = [];
  for (let i = 0; i < frames; i++) { const u = i / (frames - 1); times.push(u * duration); samples.push(sample(loop ? u % 1 : u) || {}); }
  if (loop) samples[frames - 1] = samples[0];
  const tracks = [];
  for (const b of info.bones) {
    const rq = [], pv = [];
    let hasP = info.moving.includes(b);
    for (const s of samples) {
      const v = s[b], r = !v ? null : Array.isArray(v) ? v : v.r;
      _e.set((r ? r[0] : 0) * DEG, (r ? r[1] : 0) * DEG, (r ? r[2] : 0) * DEG, 'YXZ');
      _q.setFromEuler(_e); rq.push(_q.x, _q.y, _q.z, _q.w);
      const p = v && !Array.isArray(v) ? v.p : null;
      if (p) hasP = true;
      const rest = info.rest[b];
      pv.push(rest[0] + (p ? p[0] : 0), rest[1] + (p ? p[1] : 0), rest[2] + (p ? p[2] : 0));
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, times, rq));
    if (hasP) tracks.push(new THREE.VectorKeyframeTrack(`${b}.position`, times, pv));
    if ((info.scaled || []).includes(b)) tracks.push(new THREE.VectorKeyframeTrack(`${b}.scale`, times, samples.flatMap(s => { const v = s[b], k = v && !Array.isArray(v) && v.s !== undefined ? v.s : 1; return [k, k, k]; })));
  }
  const clip = new THREE.AnimationClip(name, duration, tracks);
  clip.userData = { loop };
  return clip;
}
function applySample(rig, sample) {
  for (const e of rig.list) {
    const v = sample[e.name], r = !v ? null : Array.isArray(v) ? v : v.r, p = v && !Array.isArray(v) ? v.p : null;
    _e.set((r ? r[0] : 0) * DEG, (r ? r[1] : 0) * DEG, (r ? r[2] : 0) * DEG, 'YXZ');
    e.bone.quaternion.setFromEuler(_e);
    const rest = e.parent ? e.head.clone().sub(e.parent.head) : e.head.clone();
    e.bone.position.copy(rest);
    if (p) e.bone.position.add(V3(p[0], p[1], p[2]));
    const sc = v && !Array.isArray(v) && v.s !== undefined ? v.s : 1;
    e.bone.scale.set(sc, sc, sc);
  }
}

/* ── shared materials (vertex colours, flat shading, double sided membranes) ── */
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82, metalness: 0.0, side: THREE.DoubleSide });
const GLASS_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });

/**
 * Converts accumulated parts into meshes.
 *   merge=true  → one mesh per material (1 solid + optional 1 glass draw call)
 *   merge=false → one selectable named mesh per anatomical part
 *   skinned     → SkinnedMesh bound to one shared skeleton (clips, poses, IK-ready)
 *   static      → pose baked into plain geometry, no skeleton
 */
function finish(build, opt) {
  const { name, merge, skinned, zones, pose } = opt;
  const root = new THREE.Group(); root.name = name;
  const rig = build.rig;
  const armature = new THREE.Object3D(); armature.name = 'Armature';
  for (const e of rig.list) if (!e.parent) armature.add(e.bone);
  root.add(armature);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(rig.list.map(e => e.bone));
  if (pose) applySample(rig, pose);
  root.updateMatrixWorld(true);
  let bake = null;
  if (!skinned) {
    skeleton.update();
    bake = rig.list.map((e, i) => new THREE.Matrix4().multiplyMatrices(e.bone.matrixWorld, skeleton.boneInverses[i]));
  }
  const colorCache = new Map();
  const colorOf = (z) => {
    if (!colorCache.has(z)) { const al = opt.alias || {}; const h = zones[z] ?? zones[al[z]] ?? zones[al[al[z]]] ?? zones[Object.keys(zones)[0]]; colorCache.set(z, new THREE.Color(h)); }
    return colorCache.get(z);
  };
  const toGeo = (part) => {
    const n = part.count, geo = new THREE.BufferGeometry(), col = new Float32Array(n * 3);
    let pos = new Float32Array(part.p);
    for (let t = 0; t < n / 3; t++) {
      const c = colorOf(part.z[t]);
      for (let k = 0; k < 3; k++) { const o = (t * 3 + k) * 3; col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b; }
    }
    if (bake) {
      const v = V3(), acc = V3(), tmp = V3();
      for (let i = 0; i < n; i++) {
        v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); acc.set(0, 0, 0);
        for (let k = 0; k < 4; k++) { const w = part.sw[i * 4 + k]; if (w > 0) acc.addScaledVector(tmp.copy(v).applyMatrix4(bake[part.si[i * 4 + k]]), w); }
        pos[i * 3] = acc.x; pos[i * 3 + 1] = acc.y; pos[i * 3 + 2] = acc.z;
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (skinned) {
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(part.si, 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(part.sw, 4));
    }
    geo.computeVertexNormals();
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    return geo;
  };
  const meshOf = (geo, mat, nm, data) => {
    const m = skinned ? new THREE.SkinnedMesh(geo, mat) : new THREE.Mesh(geo, mat);
    m.name = nm; m.castShadow = mat !== GLASS_MAT; m.receiveShadow = true; m.userData = data;
    if (skinned) { m.bind(skeleton, new THREE.Matrix4()); m.frustumCulled = false; }
    return m;
  };
  const live = build.parts.filter(p => p.count > 0);
  for (const glass of [false, true]) {
    const list = live.filter(p => p.glass === glass);
    if (!list.length) continue;
    const mat = glass ? GLASS_MAT : MAT;
    if (merge) {
      const geos = list.map(toGeo), merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (geos.length > 1) geos.forEach(g => g.dispose());
      if (!merged) continue;
      merged.computeBoundingBox(); merged.computeBoundingSphere();
      root.add(meshOf(merged, mat, glass ? 'glass' : 'solid', { merged: true, parts: list.map(p => p.name) }));
    } else {
      const used = new Map();
      for (const p of list) {
        const k = used.get(p.name) || 0; used.set(p.name, k + 1);
        root.add(meshOf(toGeo(p), mat, k ? `${p.name}-${k + 1}` : p.name, { part: p.name, group: p.group, glass }));
      }
    }
  }
  if (!skinned) root.remove(armature);
  root.updateMatrixWorld(true);
  return { root, skeleton: skinned ? skeleton : null };
}

/** Bounding dimensions of a finished asset as posed (meters); skinned meshes are measured through their bones. */
function measure(root) {
  const box = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverse((m) => {
    if (!m.isMesh) return;
    if (!m.isSkinnedMesh) { box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); return; }
    // Vertices bound to scale-0 bones (hidden alternate meshes) collapse and so do not count.
    const sk = m.skeleton, g = m.geometry, pa = g.attributes.position.array, si = g.attributes.skinIndex.array, sw = g.attributes.skinWeight.array;
    const E = sk.bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(m.matrixWorld, new THREE.Matrix4().multiplyMatrices(b.matrixWorld, sk.boneInverses[i])).elements);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0, n = pa.length / 3; i < n; i++) {
      const x = pa[i * 3], y = pa[i * 3 + 1], z = pa[i * 3 + 2]; let ax = 0, ay = 0, az = 0;
      for (let k = 0; k < 4; k++) {
        const w = sw[i * 4 + k]; if (!(w > 0)) continue;
        const e = E[si[i * 4 + k]];
        ax += w * (e[0] * x + e[4] * y + e[8] * z + e[12]); ay += w * (e[1] * x + e[5] * y + e[9] * z + e[13]); az += w * (e[2] * x + e[6] * y + e[10] * z + e[14]);
      }
      if (ax < lo[0]) lo[0] = ax; if (ay < lo[1]) lo[1] = ay; if (az < lo[2]) lo[2] = az;
      if (ax > hi[0]) hi[0] = ax; if (ay > hi[1]) hi[1] = ay; if (az > hi[2]) hi[2] = az;
    }
    if (lo[0] <= hi[0]) box.union(new THREE.Box3(V3(...lo), V3(...hi)));
  });
  const s = box.getSize(V3());
  return { length: +s.z.toFixed(3), height: +s.y.toFixed(3), width: +s.x.toFixed(3), min: box.min.toArray().map(v => +v.toFixed(3)), max: box.max.toArray().map(v => +v.toFixed(3)) };
}

/* ── colourways: role-aware transforms of each species' natural palette ── */
const SCHEMES = {
  natural: { label: 'Natural', fn: (c) => c },
  albino: { label: 'Albino', fn: (c, r) => r === 'eye' ? 0xc8495a : r === 'soft' ? mixHex(c, 0xf0a3a3, 0.7) : r === 'body' ? mixHex(c, 0xf6f1e7, 0.9) : r === 'keratin' ? mixHex(c, 0xefe4cc, 0.7) : c },
  melanistic: { label: 'Melanistic', fn: (c, r) => r === 'body' ? tone(c, { s: 0.55, l: 0.26 }) : r === 'eye' ? 0xd7b04a : r === 'keratin' ? tone(c, { l: 0.45 }) : c },
  arctic: { label: 'Arctic', fn: (c, r) => r === 'body' ? tone(c, { s: 0.3, l: 0.42, la: 0.5 }) : r === 'keratin' ? tone(c, { s: 0.6, l: 0.8 }) : c },
  golden: { label: 'Golden', fn: (c, r) => r === 'body' ? (() => { const [, s, l] = hslOf(c); return hexHSL(0.105, clamp(0.35 + s * 0.6, 0, 0.85), clamp(l * 0.9 + 0.08, 0.08, 0.86)); })() : c },
  twilight: { label: 'Twilight', fn: (c, r) => r === 'body' ? (() => { const [, s, l] = hslOf(c); return hexHSL(0.68 + l * 0.12, clamp(0.25 + s * 0.4, 0, 0.7), clamp(l * 0.85 + 0.05, 0.06, 0.8)); })() : r === 'eye' ? 0xffd166 : c },
  toy: { label: 'Toy', fn: (c, r) => r === 'body' || r === 'soft' ? (() => { const [h, s, l] = hslOf(c); return hexHSL(h, clamp(s * 1.6 + 0.2, 0, 0.95), clamp(0.3 + l * 0.6, 0.18, 0.88)); })() : c },
  porcelain: { label: 'Porcelain', fn: (c, r, k) => r === 'body' ? (k === 'marking' || k === 'pattern' ? 0x2f5597 : mixHex(0xf3f1ec, c, 0.06)) : r === 'keratin' ? 0xc9a34a : r === 'eye' ? 0x22355e : r === 'soft' ? 0x7f97c6 : c },
  bronze: { label: 'Bronze', fn: (c, r) => { const [, , l] = hslOf(c); return r === 'eye' ? 0x2a1d10 : hexHSL(0.085, 0.55, clamp(0.18 + l * 0.42, 0.12, 0.62)); } },
};
const COLORWAY_KEYS = Object.keys(SCHEMES);

/** Each zone receives a unique hex so colour pickers and zone splitters can always isolate it. */
function zonesFor(name, overrides = {}, natural = BASE) {
  const sch = (SCHEMES[name] || SCHEMES.natural).fn, used = new Set(), out = {};
  for (const k of ZONE_KEYS) {
    const user = hexOf(overrides[k]), dflt = user !== null && params[k] ? hexOf(params[k].default) : null;
    const base = hexOf(natural[k]) ?? hexOf(BASE[k]) ?? 0x888888;
    let hex = (user !== null && user !== dflt ? user : sch(base, ZONE_ROLES[k] || 'body', k)) & 0xffffff;
    while (used.has(hex)) hex = (hex + 1) & 0xffffff;
    used.add(hex); out[k] = hex;
  }
  return out;
}
function colorwaysFor(natural) {
  return Object.fromEntries(COLORWAY_KEYS.map((n) => [n, Object.fromEntries(Object.entries(zonesFor(n, {}, natural)).map(([k, v]) => [k, hexStr(v)]))]));
}

/** Validates user input against the exported schema (viewer UIs pass strings for every control). */
function normalize(input) {
  const src = input && typeof input === 'object' ? input : {}, p = {};
  for (const [k, s] of Object.entries(params)) {
    let v = src[k];
    if (s.type === 'range') { v = typeof v === 'string' && v.trim() !== '' ? Number(v) : v; p[k] = typeof v === 'number' && Number.isFinite(v) ? clamp(v, s.min, s.max) : s.default; }
    else if (s.type === 'toggle') p[k] = typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : s.default;
    else if (s.type === 'choice') p[k] = s.options.includes(v) ? v : s.default;
    else if (s.type === 'color') p[k] = hexOf(v) !== null ? v : s.default;
    else p[k] = v ?? s.default;
  }
  for (const k of Object.keys(src)) if (!(k in p)) p[k] = src[k];
  return p;
}
const DETAIL = { draft: 0.6, standard: 1, high: 1.55 };
/** Appends one colour control per zone (throws on any name clash) and keeps mergeForProduction last. */
function withZones(geo, labels, base) {
  const out = { ...geo }, merge = out.mergeForProduction;
  delete out.mergeForProduction;
  for (const k of ZONE_KEYS) {
    if (k in out) throw new Error(`param/zone name clash: ${k}`);
    out[k] = { type: 'color', default: hexStr(hexOf(base[k]) ?? 0x888888), label: labels[k] || k, affects: 'colors', describe: `Override for the ${k} zone (leave at default to keep the species palette).` };
  }
  out.mergeForProduction = merge;
  return out;
}

/* ════════════════════════════════════════════════════════════════════════════
 *  TORSO PROFILES — posterior to anterior stations: [u, half-width, back, belly,
 *  centre height]. Width is relative to bodyW/2; heights are relative to bodyH.
 *  These are anatomical silhouettes, not a scale transform of one universal egg.
 * ════════════════════════════════════════════════════════════════════════════ */
const BODY_FORMS = {
  songbird: [[0,.22,.22,.24,-.02],[.2,.74,.37,.47,-.02],[.44,.96,.43,.56,0],[.68,1,.42,.54,0],[.85,.78,.36,.45,.02],[1,.43,.29,.38,.04]],
  robin: [[0,.26,.26,.31,-.03],[.2,.84,.42,.55,-.02],[.47,1.05,.49,.64,0],[.69,.98,.46,.63,.01],[.86,.76,.4,.5,.03],[1,.43,.31,.42,.05]],
  corvid: [[0,.2,.22,.2,-.02],[.18,.64,.37,.39,0],[.4,.87,.42,.48,0],[.67,1.08,.46,.57,0],[.85,.93,.39,.53,.02],[1,.46,.29,.39,.03]],
  cardinal: [[0,.19,.2,.23,-.02],[.22,.75,.38,.47,0],[.46,.99,.47,.58,0],[.7,1.05,.46,.63,.01],[.86,.83,.38,.53,.02],[1,.44,.3,.4,.04]],
  parrot: [[0,.23,.26,.23,0],[.23,.82,.43,.42,0],[.48,1.02,.52,.53,0],[.72,.98,.51,.6,0],[.87,.79,.42,.55,.01],[1,.46,.31,.42,.03]],
  owl: [[0,.39,.36,.37,-.01],[.18,.76,.48,.53,0],[.43,1.03,.55,.6,0],[.67,1.04,.55,.62,0],[.85,.86,.47,.55,.02],[1,.55,.35,.43,.04]],
  raptor: [[0,.21,.23,.23,-.01],[.19,.68,.37,.39,0],[.42,.88,.46,.5,0],[.68,1.08,.52,.67,0],[.85,.96,.46,.68,.02],[1,.5,.34,.5,.04]],
  wader: [[0,.21,.21,.2,0],[.2,.65,.36,.31,0],[.48,.94,.42,.37,0],[.69,1,.39,.41,0],[.86,.73,.32,.39,.02],[1,.38,.25,.3,.03]],
  flamingo: [[0,.32,.29,.25,0],[.19,.82,.42,.38,0],[.44,1.04,.45,.47,0],[.67,.99,.43,.5,0],[.85,.78,.37,.44,.02],[1,.43,.27,.32,.04]],
  spoonbill: [[0,.25,.25,.24,0],[.2,.74,.37,.39,0],[.47,1.02,.43,.47,0],[.71,1.07,.41,.51,0],[.87,.77,.34,.45,.02],[1,.43,.27,.33,.04]],
  waterfowl: [[0,.32,.26,.3,0],[.18,.87,.37,.45,-.02],[.46,1.07,.43,.54,0],[.69,1,.42,.56,0],[.87,.76,.34,.49,.02],[1,.44,.26,.39,.04]],
  swan: [[0,.37,.31,.32,0],[.18,.86,.42,.49,0],[.42,1.06,.43,.55,0],[.68,1.02,.4,.58,0],[.86,.8,.36,.55,.01],[1,.44,.28,.42,.04]],
  penguin: [[0,.34,.27,.29,-.02],[.19,.75,.41,.48,0],[.42,1.07,.49,.58,0],[.65,1.04,.51,.61,0],[.85,.76,.4,.49,0],[1,.44,.3,.35,.02]],
  ratite: [[0,.33,.26,.3,0],[.2,.87,.42,.52,0],[.42,1.18,.51,.61,0],[.63,1.08,.5,.57,0],[.83,.67,.37,.41,.02],[1,.37,.24,.31,.04]],
  galliform: [[0,.28,.3,.3,0],[.18,.81,.42,.45,0],[.42,1.1,.51,.55,0],[.68,1.03,.49,.62,0],[.86,.84,.4,.58,.02],[1,.49,.3,.46,.04]],
  peafowl: [[0,.27,.28,.29,0],[.18,.81,.42,.46,0],[.43,1.05,.49,.53,0],[.69,.98,.46,.59,0],[.86,.77,.37,.49,.02],[1,.43,.28,.38,.04]],
  hummingbird: [[0,.19,.17,.17,0],[.22,.67,.31,.32,0],[.46,.95,.42,.43,0],[.71,.99,.44,.5,0],[.86,.72,.32,.41,.02],[1,.39,.24,.31,.03]],
  pelican: [[0,.31,.29,.29,0],[.17,.81,.41,.43,0],[.42,1.07,.45,.59,0],[.68,1.1,.48,.72,0],[.86,.86,.39,.65,.02],[1,.45,.29,.45,.04]],
  toucan: [[0,.22,.23,.23,0],[.2,.72,.38,.42,0],[.45,1,.45,.53,0],[.7,1.02,.45,.6,0],[.86,.8,.39,.54,.01],[1,.44,.3,.39,.03]],
  gull: [[0,.19,.22,.2,0],[.18,.7,.35,.37,0],[.44,1,.42,.47,0],[.68,.98,.39,.48,0],[.85,.76,.33,.43,.02],[1,.43,.27,.33,.03]],
};

/* ════════════════════════════════════════════════════════════════════════════
 *  SKULL PROFILES — occiput (0) to bill base (1): [u, half-width, crown, cheek,
 *  centreline]. Units are multiples of the head radius; the final station is
 *  appended from the bill's own cross-section so the culmen runs unbroken from
 *  forehead to bill tip. `len` is the occiput→bill-base distance in head radii.
 * ════════════════════════════════════════════════════════════════════════════ */
const SKULL_FORMS = {
  songbird:    { len: 1.5,  p: [[0,.6,.58,.58,0],[.3,.95,.95,.82,.03],[.6,.86,.84,.7,0],[.84,.66,.6,.46,-.06]] },
  robin:       { len: 1.42, p: [[0,.62,.6,.6,0],[.3,.99,.99,.88,.04],[.6,.88,.88,.74,.01],[.85,.66,.6,.48,-.05]] },
  corvid:      { len: 1.78, p: [[0,.62,.58,.58,0],[.28,.92,.86,.8,.02],[.58,.84,.78,.68,-.01],[.85,.62,.52,.44,-.08]] },
  cardinal:    { len: 1.46, p: [[0,.6,.6,.58,0],[.3,.96,1,.84,.04],[.62,.86,.88,.7,.01],[.85,.64,.6,.46,-.05]] },
  parrot:      { len: 1.34, p: [[0,.64,.62,.62,0],[.26,1,1.02,.92,.04],[.5,.98,.98,.88,.02],[.72,.86,.8,.74,-.06],[.88,.72,.56,.58,-.16]] },
  owl:         { len: 1.32, faceMax: 1.9, p: [[0,.72,.66,.66,0],[.26,1.02,1,.96,.02],[.56,1.04,.98,.98,0],[.82,.88,.82,.82,-.04]] },
  raptor:      { len: 1.62, p: [[0,.64,.6,.62,0],[.26,.98,.92,.88,.02],[.52,.96,.92,.8,.01],[.74,.8,.74,.62,-.06],[.9,.6,.5,.44,-.14]] },
  wader:       { len: 1.86, p: [[0,.56,.52,.54,0],[.28,.88,.78,.74,.01],[.58,.8,.7,.62,-.02],[.85,.6,.48,.4,-.08]] },
  flamingo:    { len: 1.6,  p: [[0,.58,.56,.58,0],[.28,.9,.84,.8,.02],[.56,.86,.78,.76,0],[.84,.72,.62,.62,-.08]] },
  spoonbill:   { len: 1.84, p: [[0,.56,.54,.56,0],[.28,.88,.76,.76,.01],[.58,.82,.68,.66,-.02],[.86,.64,.5,.46,-.09]] },
  waterfowl:   { len: 1.76, p: [[0,.62,.56,.6,0],[.28,.92,.8,.82,0],[.6,.86,.72,.72,-.02],[.85,.7,.56,.52,-.08]] },
  swan:        { len: 1.88, p: [[0,.6,.56,.6,0],[.28,.9,.78,.82,0],[.58,.86,.7,.74,-.02],[.86,.74,.56,.58,-.06]] },
  penguin:     { len: 1.82, p: [[0,.66,.6,.62,0],[.28,.96,.88,.86,.01],[.58,.9,.8,.76,-.01],[.85,.7,.58,.52,-.08]] },
  ratite:      { len: 1.62, p: [[0,.58,.54,.56,0],[.3,.9,.78,.78,0],[.62,.82,.68,.66,-.02],[.86,.64,.5,.46,-.08]] },
  galliform:   { len: 1.5,  p: [[0,.6,.58,.58,0],[.28,.94,.9,.8,.02],[.58,.84,.8,.68,0],[.84,.64,.56,.44,-.08]] },
  peafowl:     { len: 1.52, p: [[0,.6,.58,.58,0],[.28,.92,.9,.78,.03],[.6,.84,.8,.66,0],[.85,.64,.56,.44,-.07]] },
  hummingbird: { len: 1.38, p: [[0,.58,.56,.56,0],[.3,.94,.92,.84,.02],[.62,.82,.78,.66,-.01],[.86,.58,.48,.4,-.06]] },
  pelican:     { len: 1.84, p: [[0,.62,.56,.6,0],[.26,.9,.78,.8,0],[.58,.84,.7,.72,-.02],[.86,.72,.56,.56,-.08]] },
  hornbill:    { len: 1.48, p: [[0,.6,.58,.58,0],[.28,.94,.88,.8,.02],[.56,.88,.82,.72,0],[.84,.74,.7,.56,-.05]] },
  toucan:      { len: 1.3,  p: [[0,.6,.58,.58,0],[.26,.94,.94,.82,.03],[.52,.9,.9,.76,.01],[.74,.82,.8,.62,-.03],[.9,.74,.68,.5,-.08]] },
  gull:        { len: 1.7,  p: [[0,.6,.56,.58,0],[.28,.92,.84,.78,.02],[.58,.84,.76,.66,0],[.85,.64,.54,.44,-.08]] },
};

/* ════════════════════════════════════════════════════════════════════════════
 *  BIRD BUILDER — +Z forward, +Y up, left = +X, ground at y = 0. Lengths are
 *  multiples of the body length L (tail base → breast). Wings exist twice: a
 *  folded wing lying on the flank and a spread planform skinned to humerus /
 *  forearm / hand; clips swap them with bone-scale keys.
 * ════════════════════════════════════════════════════════════════════════════ */
function birdBuild(B, S) {
  const rig = B.rig, det = B.det, L = S.L, paint = B.paint;
  const P = S.pitch * DEG, fwd = V3(0, Math.sin(P), Math.cos(P)), upb = V3(0, Math.cos(P), -Math.sin(P));
  const legH = S.legLen * L + S.thigh * L * 0.5, bodyH = S.bodyH * L, bodyW = S.bodyW * L;
  const C0 = V3(0, legH + bodyH * 0.42, 0);
  const bp = (s, k = 0) => C0.clone().addScaledVector(fwd, (s - 0.5) * L).addScaledVector(upb, k * bodyH);
  const profile = BODY_FORMS[S.bodyForm] || BODY_FORMS.songbird;
  const W = prof(profile.map(k => [k[0], k[1]])), HT = prof(profile.map(k => [k[0], k[2]]));
  const HB = prof(profile.map(k => [k[0], k[3]])), CY = prof(profile.map(k => [k[0], k[4]]));
  const ringRes = 2 * Math.round(8 * det + 3);
  const nl = S.neckLen * L, hr = S.headR * L;
  const nc = S.neckCurve || 0, na = S.neckAng;
  // Derived necks curl forward at the top toward the head's carriage; otherwise the skull would have to turn
  // ~60 degrees within one head radius and its rings would fold into a crease at the throat.
  // A short neck takes as much of the neck-to-head turn as it can afford without folding (about its length
  // over 1.35x its radius), spread evenly along it, so the skull is left a gentler bend; long necks keep their
  // S-profile with a partial curl at the top.
  const shortTurn = S.neckLen < 0.3 ? Math.min((na + S.headAng) * (S.neckCurl ?? 0.6), (nl / (1.35 * hr * (S.neckThin ?? (S.neckLen < .15 ? .86 : .66)))) / DEG) : 0;
  const shapeKeys = S.neckShape ? S.neckShape.map(k => k.slice())
    : S.neckLen < 0.3 ? [[0, na - 18 * nc], [1, na - 18 * nc - Math.max(0, shortTurn)]]
    : [[0, na - 18 * nc], [0.45, na + 22 * nc], [1, lerp(na - 25 * nc, -S.headAng, (S.neckCurl ?? 0.4) * sstep(0.25, 0.6, S.neckLen))]];
  const meanAng = shapeKeys.reduce((s, k) => s + k[1], 0) / shapeKeys.length, amp = 1 + (S.neckCurveAdj || 0);
  const thetaAt = prof(shapeKeys.map(([s, d]) => [s, meanAng + (d - meanAng) * amp]));
  // Short-necked birds carry thick necks, but only the very shortest (owls, penguins) are as wide as
  // the skull; at 0.2 the neck is clearly visible and must stay narrower than the head it supports.
  const nr1 = hr * (S.neckThin ?? (S.neckLen < .15 ? .86 : S.neckLen < .45 ? .66 : .52));
  const baseFactor = S.neckBase ?? (S.neckLen < .45 ? 1.15 : S.neckLen > .8 ? 1.32 : 1.48);
  // a short neck finishes close to the skull's size (raptor and corvid hackles), so the head flows into it
  const nrBase = nr1 * baseFactor, nrTop = Math.max(nr1 * (S.neckNape ?? 1.08), S.neckLen < 0.3 ? hr * 0.84 : 0);
  const rootR = Math.min(Math.max(nrBase * 1.05, Math.min(bodyH, bodyW) * (S.neckRootR ?? 0.25)), bodyW * .43);
  const flareU = clamp((S.neckFlare ?? 0.32) * Math.max(1, 0.55 / Math.max(S.neckLen, 0.05)), 0.2, 0.75);
  const neckR = (u) => {
    // a short neck is only a fairing between shoulder and skull: any waist on it reads as a collar groove
    if (S.neckLen < 0.3) return lerp(rootR, nrTop, sstep(0, 1, u));
    const taper = lerp(nrBase, nr1, sstep(flareU * 0.6, 0.72, u));
    return u < flareU ? lerp(rootR, taper, sstep(0, flareU, u)) : lerp(taper, nrTop, sstep(0.78, 1, u));
  };
  // The last body station and first neck station share a centre, radius, radial frame, and vertices.
  // Its tangent starts at the anterior shoulder, preventing a welded-looking collar.
  const rootAngle = thetaAt(0) * DEG;
  const neckStart = () => bp(S.neckRootU ?? .84, CY(S.neckRootU ?? .84))
    .add(V3(0, Math.sin(rootAngle), Math.cos(rootAngle)).multiplyScalar(L * (S.neckJoinLength ?? (S.neckLen < .45 ? lerp(.07, .11, clamp(Math.abs(rootAngle - P) / (45 * DEG), 0, 1)) : .18))));
  // The egg profile's front cap would narrow below the neck before widening back to it, cutting a collar
  // groove round the neck base; near the junction the body never shrinks below the neck root.
  // smooth max: a hard max would stop the taper dead and leave a convex kink ring
  const smax = (x, y, k) => 0.5 * (x + y + Math.sqrt((x - y) * (x - y) + k * k));
  const floorN = (v, nv, u) => smax(v, nv * sstep(0.6, 0.85, u), nv * 0.12);
  const mkBody = () => loft({ pts: [0, .25, .5, .75, .84].map(u => bp(u, CY(u))).concat([neckStart()]), seg: Math.round(26 * det), rad: ringRes, up: upb,
    w: (u) => lerp(floorN(W(u) * bodyW * 0.5, neckR(0) * .92, u), neckR(0) * .92, sstep(.7, 1, u)),
    ht: (u) => lerp(floorN(HT(u) * bodyH, neckR(0), u), neckR(0), sstep(.7, 1, u)),
    hb: (u) => lerp(floorN(HB(u) * bodyH, neckR(0) * 1.02, u), neckR(0) * 1.02, sstep(.7, 1, u)),
    cap0: { type: 'round', len: 0.65, n: 3 }, cap1: 'open', bend: 0,
    bump: S.fluff ? (u, a) => S.fluff * (vnoise(u * 30, a * 4, 0, 5) - 0.5) : null });
  let body = mkBody();
  // Ground clearance: upright or steeply pitched bodies (penguins, owls) must rest on their legs, not
  // sink through the floor. Raise the body until its lowest point and its tail tip clear the ground;
  // the legs are built afterwards, so they automatically span the real gap.
  {
    let low = Infinity; for (const row of body.rows) for (const p of row) low = Math.min(low, p.y);
    const T0 = S.tail, lift = (T0.lift ?? Math.max(0, S.pitch * 0.8 + 2)) * DEG;
    const td = fwd.clone().multiplyScalar(-1).addScaledVector(upb, Math.tan(lift)).normalize();
    const tailLow = bp(0, 0.12).y + Math.min(0, td.y) * Math.min(T0.len, 0.6) * L; // long trains/sickles may brush the ground
    const clear = (S.groundClear ?? 0.02) * L, need = Math.max(clear - low, clear * 0.5 - tailLow);
    if (need > 0) { C0.y += need; body = mkBody(); }
  }
  rig.add('Root', null, [0, 0, 0]);
  rig.add('Hips', 'Root', bp(0.3, 0.1));
  rig.add('Chest', 'Hips', bp(0.72, 0.15));
  // The S-curve's tangent is integrated along arc length from the body's anterior shoulder.
  const N0 = neckStart(), NSEG = 28, npts = [N0.clone()];
  for (let i = 0; i < NSEG; i++) {
    const th = thetaAt((i + 0.5) / NSEG) * DEG;
    npts.push(npts[i].clone().add(V3(0, Math.sin(th), Math.cos(th)).multiplyScalar(nl / NSEG)));
  }
  const neck = loft({
    pts: npts, seg: Math.round((14 + 12 * S.neckLen) * det), rad: ringRes,
    w: (u) => neckR(u) * 0.92, ht: (u) => neckR(u), hb: (u) => neckR(u) * 1.02,
    // the integrated theta(s) path is already smooth; raw tangents keep the shared end rings untilted
    up: [0, 1, 0], cap0: 'open', cap1: 'open', bend: 0
  });
  neck.rows[neck.main[0]] = body.rows[body.main[1]];
  const nc1 = makePath(npts);
  rig.add('Neck1', 'Chest', nc1.getPointAt(0.3)); rig.add('Neck2', 'Neck1', nc1.getPointAt(0.68));
  // skull: one swept surface from the occiput through the cranium, brow and lores that ends on the
  // exact cross-section of the bill base. The upper mandible then reuses that ring vertex-for-vertex,
  // so the culmen is a single unbroken line from forehead to bill tip instead of a cone in a sphere.
  const ha = S.headAng * DEG, hd = V3(0, -Math.sin(ha), Math.cos(ha)), hu = V3(0, Math.cos(ha), Math.sin(ha));
  const neckEnd = npts[npts.length - 1];
  const tEnd = neckEnd.clone().sub(npts[npts.length - 2]).normalize();
  rig.add('Head', 'Neck2', neckEnd);
  const Bk = S.beak, bl = Bk.len * hr, bw = Bk.w * hr, bh = Bk.h * hr;
  const spoonWidth = Bk.spoon ?? 1.8, lowerK = Bk.style === 'spoon' ? 0.42 : 0.25;
  // flat: parallel-sided, rounding off over the last few percent (duck nail, pelican hook) rather than a
  // square-cut end. spoon: narrow shaft, then a rounded spatula widest just before the tip.
  const flatTip = (u) => lerp(1, 1 - (Bk.tipTaper ?? 0.45), sstep(1 - (Bk.tipLen ?? 0.14), 1, u));
  const spoonW = (u) => {
    const shaft = 1 - 0.35 * Math.min(u, 0.55), peak = 0.86;
    if (u <= peak) return lerp(shaft, spoonWidth, sstep(0.5, peak, u));
    const t = (u - peak) / (1 - peak); return spoonWidth * Math.sqrt(Math.max(0.12, 1 - t * t * 0.88));
  };
  const bwP = Bk.style === 'flat' ? (u) => bw * (1 - 0.25 * u) * flatTip(u) : Bk.style === 'big' ? (u) => bw * (1 - 0.72 * Math.pow(u, 1.15)) : Bk.style === 'spoon' ? (u) => bw * spoonW(u) : (u) => bw * Math.pow(1 - u, 0.8);
  const bhP = Bk.style === 'big' ? (u) => bh * (1 - 0.76 * Math.pow(u, 1.3)) : Bk.style === 'spoon' ? (u) => bh * lerp(0.62, 0.34, sstep(0.5, 0.86, u)) : (u) => bh * Math.pow(1 - u, Bk.style === 'flat' ? 0.25 : 0.9);
  const beakCap = Bk.style === 'flat' || Bk.style === 'spoon' ? { type: 'round', len: 0.3 } : { type: 'point', len: Bk.style === 'big' ? 0.55 : 0.3 };
  const billW0 = bwP(0), billT0 = bhP(0), billB0 = billT0 * lowerK, faceDrop = hr * (Bk.y ?? 0.1);
  const SKF = SKULL_FORMS[S.skullForm] || SKULL_FORMS[S.bodyForm] || SKULL_FORMS.songbird;
  const sl = hr * (SKF.len ?? 1.5) * (S.skullLen ?? 1);
  // Deep-billed birds (toucans, macaws) would balloon the whole face if it had to reach the full bill
  // section in one station, so the face adopts most of it and the bill flares the remainder itself.
  // A face only carries the bill section through when the two are a similar size. Bills much smaller
  // than the face (owls) would pinch it into a cone, and much larger ones (toucans) would balloon it,
  // so in both cases the face keeps its own shape and the bill does the flaring.
  // The face section is kept within a bounded factor of the bill's, so neither surface has to deform
  // violently at the junction; whatever difference remains is resolved over the bill's first few percent.
  const lore = SKF.p[SKF.p.length - 1];
  // Width and forehead are drawn close to the bill, so a small bill grows out of a tapering face
  // (songbirds) unless the skull keeps a broad facial disc (owls). The chin keeps more room because the
  // lower mandible hangs below the upper's underside and the chin has to cover its root.
  const join = (loreV, billV, maxK) => {
    const m = Bk.join ?? clamp(1 - Math.abs(1 - billV / Math.max(loreV, 1e-9)) * 1.1, 0.3, 0.88);
    return clamp(lerp(loreV, billV, m), billV * 0.8, billV * maxK);
  };
  const loreW = lore[1] * hr * (S.headW ?? 0.92), loreT = lore[2] * hr, loreB = lore[3] * hr, faceMax = SKF.faceMax ?? 1.35;
  const endW = join(loreW, billW0, faceMax), endT = join(loreT, billT0, faceMax), endB = join(loreB, billB0, 1.8);
  // Station tables carry absolute radii, with the bill-base cross-section appended as the last station.
  // When the bill is taller or wider than the face (parrots, toucans), the forehead rises into the culmen
  // rather than dipping into a notch in front of it.
  const skW = prof(SKF.p.map(s => [s[0], Math.max(s[1] * hr * (S.headW ?? 0.92), endW * sstep(0.5, 1, s[0]))]).concat([[1, endW]]));
  const skT = prof(SKF.p.map(s => [s[0], Math.max(s[2] * hr, endT * sstep(0.5, 1, s[0]))]).concat([[1, endT]]));
  const skB = prof(SKF.p.map(s => [s[0], s[3] * hr]).concat([[1, endB]]));
  const skY = prof(SKF.p.map(s => [s[0], s[4] * hr]).concat([[1, -faceDrop]]));
  // The skull axis leaves the neck along its end tangent and turns toward the head direction no faster than
  // the section on the inside of the turn allows: bending tighter than that radius folds the throat into a
  // crease. The turn is taken as early as possible, so the face and bill still finish exactly on the head
  // direction (a pelican's neck rises steeply while its head angles down).
  // the occiput never narrows below the neck it leaves; the floor fades in from zero so ring 1 still matches
  const nFloor = (v, nv, u) => smax(v, nv * sstep(0, 0.12, u) * (1 - sstep(0.25, 0.55, u)), nv * 0.1);
  const headHT = (u) => nFloor(lerp(neckR(1), skT(u) * (1 + (S.headCrest || 0) * bell(u, 0.32, 0.4)), sstep(0, .34, u)), neckR(1), u);
  const headHB = (u) => nFloor(lerp(neckR(1) * 1.02, skB(u), sstep(0, .34, u)), neckR(1) * 1.02, u);
  const elev = (v) => Math.atan2(v.y, v.z), thHead = elev(hd), NSK = 24, dsk = sl / NSK, sPts = [neckEnd.clone()];
  let thSk = elev(tEnd);
  const turn = Math.abs(thHead - thSk), inner0 = Math.max(thHead < thSk ? headHB(0.15) : headHT(0.15), hr * 0.15);
  const kBend = clamp((0.85 * sl) / Math.max(turn * inner0, 1e-9), 1.2, 2.4);
  for (let i = 0; i < NSK; i++) {
    const uu = (i + 0.5) / NSK, inner = Math.max(thHead < thSk ? headHB(uu) : headHT(uu), hr * 0.15);
    thSk += clamp(thHead - thSk, -dsk / (inner * kBend), dsk / (inner * kBend));
    sPts.push(sPts[i].clone().add(V3(0, Math.sin(thSk), Math.cos(thSk)).multiplyScalar(dsk)));
  }
  const head = loft({
    pts: sPts, seg: Math.round(20 * det), rad: ringRes, up: hu,
    w: (u) => nFloor(lerp(neckR(1) * .92, skW(u), sstep(0, .34, u)), neckR(1) * .92, u), ht: headHT, hb: headHB,
    oy: (u) => skY(u) * sstep(0, .3, u), nb: (u) => lerp(2, 3, sstep(.78, 1, u)),
    cap0: 'open', cap1: 'open', bend: 0
  });
  head.rows[head.main[0]] = neck.rows[neck.main[1]];
  const HW = rig.W('Head');
  const ringAt = (g, u) => { const [m0, m1] = g.main; return g.rows[clamp(Math.round(m0 + (m1 - m0) * u), m0, m1)]; };
  const centreOf = (ring) => ring.reduce((s, p) => s.clone().add(p), V3()).divideScalar(ring.length);
  const hc = centreOf(ringAt(head, 0.32));
  // The bill continues along the skull's own end frame, so there is no kink at the junction.
  const billRing = head.rows[head.main[1]];
  const b0 = centreOf(billRing), bd = head.T[head.T.length - 1].clone(), bu = head.Ups[head.Ups.length - 1].clone();
  // eyes sit in the orbit, just behind the lores, rather than on a sphere's equator
  const eyeR = S.eye * hr, yaw = (S.eyeYaw ?? 72) * DEG, eyeU = S.eyeU ?? 0.52;
  const eyes = [1, -1].map((side) => {
    const dir = hd.clone().multiplyScalar(Math.cos(yaw)).add(V3(side * Math.sin(yaw), 0, 0)).addScaledVector(hu, 0.22).normalize();
    const hit = surfaceToward(head, hc, dir, clamp(eyeU - 0.16, 0.08, 0.9), clamp(eyeU + 0.16, 0.12, 0.95));
    return { c: hit.p.clone().addScaledVector(hit.n, -eyeR * (S.eyeInset ?? 0.6)), dir: hit.n.clone().lerp(dir, 0.5).normalize(), u: hit.s, a: hit.a };
  });
  // beak: upper mandible continues the skull, lower mandible hangs from the Jaw bone
  // droop: straight proximal half then a smooth downward bend (flamingo-style filter bill)
  const hookBend = (u) => (Bk.hook || 0) * bl * Math.pow(u, Bk.hookPow ?? 2.5);
  const bend = (u) => hookBend(u) + (Bk.decurve || 0) * bl * 0.3 * u * u + (Bk.curve || 0) * bl * Math.sin(Math.PI * u) * 0.25 + (Bk.droop || 0) * bl * 0.55 * Math.pow(Math.max(0, u - 0.38) / 0.62, 1.6);
  const bpts = [0, 0.2, 0.4, 0.55, 0.7, 0.85, 1].map(u => b0.clone().addScaledVector(bd, u * bl * (1 - 0.18 * (Bk.droop || 0) * Math.max(0, u - 0.4))).addScaledVector(bu, -bend(u)));
  // The bill leaves the face at the skull's end section and reaches its own in the first few percent.
  const fix = (end, start) => (u) => lerp(end / Math.max(start, 1e-9), 1, sstep(0, 0.14, u));
  const wFix = fix(endW, billW0), tFix = fix(endT, billT0), bFix = fix(endB, billB0);
  // Cone and flat profiles reach zero at the tip, which collapses the last ring onto the cap and
  // leaves non-manifold edges. A small floor keeps the tip a real (if tiny) section.
  const tipW = bw * 0.05, tipH = bh * 0.05;
  const billSeg = Bk.style === 'spoon' ? 24 : 12;
  const upper = loft({ pts: bpts, seg: Math.round(billSeg * det), rad: ringRes, up: bu, w: (u) => Math.max(bwP(u) * wFix(u), tipW), ht: (u) => Math.max(bhP(u) * tFix(u), tipH), hb: (u) => Math.max(bhP(u) * lowerK * bFix(u), tipH * 0.6), nt: (u) => lerp(2, lerp(2, 1.3, Bk.keel ?? 0), sstep(0, 0.2, u)), nb: 3, cap0: 'open', cap1: beakCap, bend: 0 });
  upper.rows[upper.main[0]] = billRing; // shared with the skull: one continuous culmen
  // The gape starts just inside the cheek so the jaw is never a floating slab.
  const jawP = b0.clone().addScaledVector(bu, -bh * 0.15).addScaledVector(bd, -hr * 0.06);
  rig.add('Jaw', 'Head', jawP, jawP.clone().addScaledVector(bd, bl));
  // A pouch bulges the underside only: displacing the whole jaw would drag its top edge away from the
  // upper mandible and open a gap at the gape.
  // scoop (parrots): a deep, broad, blunt lower mandible whose front edge rises into the upper hook.
  // pouch (pelicans): skin hangs deepest near the base and tapers away before the tip.
  const scoop = Bk.lowerStyle === 'scoop', lowerLen = Bk.lower ?? 0.92;
  const pouchAt = (u) => sstep(0, 0.15, u) * (1 - sstep(0.4, 0.95, u));
  const lpts = [0, 0.25, 0.5, 0.75, 1].map(u => jawP.clone().addScaledVector(bd, u * bl * lowerLen)
    .addScaledVector(bu, scoop ? bh * 0.34 * u * u : -(bend(u * lowerLen) - hookBend(u * lowerLen) * 0.4)));
  const lower = loft({ pts: lpts, seg: Math.round((Bk.style === 'spoon' ? 16 : 7) * det), rad: 2 * Math.round(4 * det + 1), up: bu,
    w: scoop ? (u) => bw * 0.9 * (1 - 0.32 * u) : (u) => Math.max(bwP(u) * 0.9, tipW),
    ht: scoop ? (u) => bh * 0.26 * (1 - 0.3 * u) : (u) => Math.max(bhP(u) * 0.2, tipH * 0.6),
    hb: scoop ? (u) => bh * 0.6 * (1 - 0.42 * u) : (u) => Math.max(bhP(u) * ((Bk.lowerDepth ?? 0.55) + (Bk.pouch || 0) * 1.6 * pouchAt(u)), tipH * 0.6),
    nt: 3, cap0: { type: 'round', len: 0.4 }, cap1: scoop ? { type: 'round', len: 0.55, n: 3 } : beakCap, bend: 0 });
  const tipFrom = Bk.tipFrom ?? 0.72, tipLower = Bk.tipLower ?? true;
  emit(B.part('beak', { group: 'head' }), upper, (u) => Bk.tip && (Bk.tipUpper ?? true) && u > tipFrom ? Bk.tip : 'beak', HW);
  emit(B.part('beak', { group: 'head' }), lower, (u) => Bk.tip && tipLower && u > tipFrom ? Bk.tip : 'jaw', rig.W('Jaw'));
  if (Bk.casque) {
    // Hornbill casque: a helmet riding the culmen. Its spine follows the culmen line and its base is
    // buried in the upper mandible, so it reads as part of the bill instead of a block glued on top.
    const Cq = Bk.casque, cl = Cq.len ?? 0.6, cH = bh * (Cq.h ?? 0.6);
    const culmen = (u) => b0.clone().addScaledVector(bd, u * bl).addScaledVector(bu, -bend(u) + bhP(u) * tFix(u));
    const H = (f) => cH * sstep(0, 0.3, f) * (1 - 0.55 * sstep(0.7, 1, f));
    const cpts = [0, 0.15, 0.32, 0.5, 0.68, 0.84, 1].map(f => culmen(f * cl).addScaledVector(bu, H(f) * 0.45 + cH * 0.18 * sstep(0.55, 1, f)));
    const casque = loft({ pts: cpts, seg: Math.round(12 * det), rad: ringRes, up: bu,
      w: (f) => Math.max(bwP(f * cl) * wFix(f * cl) * (Cq.w ?? 0.85), tipW), ht: (f) => Math.max(H(f) * 0.55, tipH), hb: (f) => H(f) * 0.55 + bh * 0.3,
      nt: Cq.flat ?? 3, cap0: { type: 'round', len: 0.3 }, cap1: { type: 'round', len: 0.6, n: 3 }, bend: 0.3 });
    emit(B.part('beak', { group: 'head' }), casque, (f) => f > 0.88 && Cq.tipZone ? Cq.tipZone : (Cq.zone ?? 'beak'), HW);
  }
  // head & neck painting needs eye positions
  emit(B.part('head', { group: 'head' }), head, (u, a, P2) => u < .08 ? paint({ part: 'neck', u: 1, a, P: P2 }) : paint({ part: 'head', u, a, P: P2, eyes, hd, billBase: b0 }), HW);
  emit(B.part('neck', { group: 'body' }), neck, (u, a, P2) => u < .08 ? paint({ part: 'body', u: 1, a, P: P2 }) : paint({ part: 'neck', u, a, P: P2 }), (u) => u < 0.3 ? rig.W2('Chest', 'Neck1', u / 0.3) : u < 0.7 ? rig.W2('Neck1', 'Neck2', (u - 0.3) / 0.4) : rig.W2('Neck2', 'Head', sstep(0.75, 1, u)));
  emit(B.part('body', { group: 'body' }), body, (u, a, P2) => paint({ part: 'body', u, a, P: P2 }), (u) => rig.W2('Hips', 'Chest', sstep(0.35, 0.75, u)));
  for (const e of eyes) {
    const eg = ellipsoid(e.c, eyeR, eyeR, eyeR, e.dir, hu, Math.round(5 * det + 2), 2 * Math.round(4 * det + 2));
    emit(B.part('eyes', { group: 'head' }), eg, (u) => u > (S.pupilBig ? 0.78 : 0.86) ? 'pupil' : 'eye', HW);
    if (S.eyeRing) { const bas = basisFrom(e.dir, hu), ring = []; for (let i = 0; i < 12; i++) { const t = (i / 12) * TAU; ring.push(e.c.clone().addScaledVector(e.dir, eyeR * 0.3).addScaledVector(bas.s, Math.cos(t) * eyeR * 1.05).addScaledVector(bas.u, Math.sin(t) * eyeR * 1.05)); }
      emit(B.part('eyes', { group: 'head' }), loft({ pts: ring, closed: true, seg: 12, rad: 4, w: eyeR * S.eyeRing, ht: eyeR * S.eyeRing * 0.5, hb: eyeR * S.eyeRing * 0.5, up: e.dir }), 'face', HW); }
  }
  // crests, combs and wattles
  if (S.crest && S.crest.h > 0) {
    const Cr = S.crest, ch = Cr.h * hr, part = B.part('crest', { group: 'head' });
    if (Cr.style === 'comb') {
      // The comb's base follows the crown itself; a straight base line would lift off the curved skull.
      sheet(part, { nu: 10, nv: 2, f: (u, v) => head.at(lerp(0.1, 0.66, u), Math.PI / 2).p
        .addScaledVector(hu, v * ch * (0.55 + 0.45 * Math.abs(Math.sin(u * Math.PI * 3.5))) - hr * 0.05), th: hr * 0.12, zone: Cr.zone ?? 'accent', skin: HW });
    } else if (Cr.style === 'peak') {
      // Cardinal-type crest: one solid, laterally compressed tuft swept up and back from the crown. Its
      // root is buried in the skull, so it grows out of the head rather than standing on it as quills.
      const raise = clamp(S.crestRaise ?? 0.3, 0, 1), sweep = (Cr.sweep ?? 38) * lerp(1.3, 0.45, raise) * DEG;
      const root = head.at(Cr.at ?? 0.46, Math.PI / 2), chR = ch * lerp(0.8, 1.15, raise);
      const dirC = hu.clone().multiplyScalar(Math.cos(sweep)).addScaledVector(hd, -Math.sin(sweep)).normalize();
      const pts = [root.p.clone().addScaledVector(root.n, -hr * 0.4), root.p.clone(),
        root.p.clone().addScaledVector(dirC, chR * 0.45).addScaledVector(hd, chR * 0.06), root.p.clone().addScaledVector(dirC, chR)];
      const base = hr * (Cr.base ?? 0.5), thk = hr * (Cr.thk ?? 0.2);
      emit(part, loft({ pts, seg: Math.round(9 * det), rad: 2 * Math.round(4 * det + 2), up: hd,
        w: (u) => thk * Math.pow(1 - u, 0.7), ht: (u) => base * Math.pow(1 - u, 1.1), hb: (u) => base * 0.85 * Math.pow(1 - u, 0.85),
        cap0: { type: 'round', len: 0.3 }, cap1: 'point', bend: 0.3 }), Cr.zone ?? 'accent', HW);
    } else if (Cr.style === 'recurve') {
      // Cockatoo crest: long, flat feathers rooted along the crown midline. Relaxed, they lie back over
      // the crown with up-curled tips; raised, they fan upward and curl forward toward the bill.
      const n = Cr.n ?? 8, raise = clamp(S.crestRaise ?? 0.2, 0, 1), NP = 7;
      for (let i = 0; i < n; i++) {
        // feathers alternate either side of the midline, so the crest has width from the front
        const t = n === 1 ? 0.5 : i / (n - 1), side = i % 2 ? 1 : -1;
        const uR = lerp(0.62, 0.24, t), aR = Math.PI / 2 + side * (Cr.spread ?? 0.22) * (0.35 + 0.65 * t);
        const { p, n: nr } = head.at(uR, aR);
        const len = ch * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, 0.2 + t * 0.85)));
        const lat = V3(side * (Cr.splay ?? 0.16) * (0.3 + 0.7 * t), 0, 0), curl = Cr.curl ?? 0.9;
        // relaxed: hug the crown back toward the occiput, then lift off into an up-curled tip
        const uEnd = Math.max(0.02, uR - 0.45 * len / sl), relax = [];
        for (let k = 0; k <= 3; k++) { const q = head.at(lerp(uR, uEnd, k / 3), aR); relax.push(q.p.addScaledVector(q.n, hr * (0.02 + 0.05 * k)).addScaledVector(lat, hr * 0.25 * k)); }
        let hug = 0; for (let k = 1; k <= 3; k++) hug += relax[k].distanceTo(relax[k - 1]);
        const rest = Math.max(len - hug, len * 0.3);
        const back = relax[3].clone().sub(relax[2]).normalize().addScaledVector(hu, 0.25).add(lat).normalize();
        const tipDir = back.clone().addScaledVector(hu, curl * 0.9).normalize();
        relax.push(relax[3].clone().addScaledVector(back, rest * 0.4));
        relax.push(relax[4].clone().addScaledVector(tipDir, rest * 0.35));
        relax.push(relax[5].clone().addScaledVector(tipDir.clone().addScaledVector(hu, 0.3).normalize(), rest * 0.25));
        // raised: fan up from the root and curl forward toward the bill
        const fanA = lerp(32, -38, t) * DEG;
        const up0 = hu.clone().multiplyScalar(Math.cos(fanA)).addScaledVector(hd, Math.sin(fanA)).addScaledVector(lat, 1.4).normalize();
        const raised = [p.clone()];
        for (let k = 1; k < NP; k++) { const f = k / (NP - 1); raised.push(raised[k - 1].clone().addScaledVector(up0.clone().addScaledVector(hd, curl * 0.7 * f * f).normalize(), len / (NP - 1))); }
        const pts = [p.clone().addScaledVector(nr, -hr * 0.12), ...relax.map((q, k) => q.lerp(raised[k], raise))];
        const vane = hr * (Cr.vane ?? 0.15), thk = hr * (Cr.thk ?? 0.035);
        // vanes lie flat on the head when relaxed and turn into the sagittal plane as the fan opens
        emit(part, loft({ pts, seg: 10, rad: 6, up: hu.clone().lerp(V3(1, 0, 0), raise).normalize(),
          w: (u) => vane * Math.pow(Math.sin(Math.PI * clamp(0.15 + u * 0.85, 0, 1)), 0.6), ht: thk, hb: thk, cap0: 'round', cap1: 'point', bend: 0.5 }),
          (u) => u < 0.22 || t < 0.15 ? (Cr.baseZone ?? 'head') : (Cr.zone ?? 'accent'), HW);
      }
    } else {
      const n = Cr.n ?? 7;
      for (let i = 0; i < n; i++) {
        // laid plumes root at the nape (back of the skull); upright crests root along the crown
        const t = n === 1 ? 0.5 : i / (n - 1), { p, n: nr } = Cr.pair ? head.at(0.34, Math.PI / 2 + (i % 2 ? 1 : -1) * 0.75) : Cr.lay ? head.at(lerp(0.16, 0.05, t), Math.PI / 2 + 0.25 + (t - 0.5) * 0.4) : head.at(lerp(0.52, 0.14, t), Math.PI / 2 + (Cr.style === 'fan' ? 0 : (t - 0.5) * 0.3));
        let dir = nr.clone().addScaledVector(hd, Cr.style === 'fan' ? 0.4 - t * 1.2 : -0.9 - t * 0.6).normalize();
        // lay: plumes swept back along the nape (herons, egrets) instead of standing upright
        if (Cr.lay) dir = dir.lerp(hd.clone().multiplyScalar(-1).addScaledVector(hu, 0.12 - t * 0.1), Cr.lay).normalize();
        const l = ch * (Cr.style === 'fan' ? 0.75 + 0.25 * Math.sin(Math.PI * t) : 1 - 0.35 * Math.abs(t - 0.3)), dr = (Cr.droop || 0) * l;
        const pts = [p.clone().addScaledVector(nr, -hr * 0.1), p.clone().addScaledVector(dir, l * 0.55).addScaledVector(hu, -dr * 0.2), p.clone().addScaledVector(dir, l).addScaledVector(hd, -l * (Cr.curl ?? 0.15)).addScaledVector(hu, -dr)];
        emit(part, tube(pts, (u) => hr * (Cr.thk ?? 0.09) * (1 - 0.6 * u) * (Cr.ball && u > 0.85 ? 2.4 : 1), 4, 5, { cap1: { type: 'round', len: 0.8 } }), (u) => Cr.tipZone && u > 0.8 ? Cr.tipZone : 'accent', HW);
      }
    }
  }
  if (S.wattle > 0) for (const side of [1, -1]) {
    const p = jawP.clone().addScaledVector(hd, bl * 0.15).add(V3(side * bw * 0.4, 0, 0)), l = S.wattle * hr;
    emit(B.part('crest', { group: 'head' }), loft({ pts: [p, p.clone().addScaledVector(hu, -l * 0.5), p.clone().addScaledVector(hu, -l).addScaledVector(hd, -l * 0.15)], seg: 5, rad: 8, w: (u) => l * 0.22 * (0.6 + Math.sin(Math.PI * u)), ht: (u) => l * 0.12 * (0.6 + Math.sin(Math.PI * u)), up: hd }), S.wattleZone ?? 'accent', rig.W('Jaw'));
  }
  // tail fan
  const T = S.tail, tb = bp(0, 0.12), defLift = Math.max(0, S.pitch * 0.8 + 2);
  const tdir = fwd.clone().multiplyScalar(-1).addScaledVector(upb, Math.tan((T.lift ?? defLift) * DEG)).normalize();
  rig.add('Tail', 'Hips', tb);
  const tl = T.len * L, nT = T.n ?? 10, tpart = B.part('tail', { group: 'tail' });
  const side = new THREE.Vector3().crossVectors(upb, tdir).normalize();
  for (let i = 0; i < nT; i++) {
    const t = nT === 1 ? 0 : i / (nT - 1) - 0.5, ang = t * (T.fan ?? 40) * DEG, d = tdir.clone().applyAxisAngle(upb, ang);
    let fl = tl * (T.style === 'fork' ? 0.7 + 1.2 * Math.abs(t) : T.style === 'wedge' ? 1 - 0.7 * Math.abs(t) : T.style === 'long' ? (Math.abs(t) < 0.12 ? 1 : 0.45) : 1) * (0.94 + 0.06 * Math.cos(i * 2.1));
    const fw = Math.min(tl * 0.16, L * 0.09) * (T.style === 'train' ? 1.6 : 1) * (T.wide ?? 1), sd = new THREE.Vector3().crossVectors(upb, d).normalize();
    const droop = (T.droop || 0) * fl;
    sheet(tpart, { nu: Math.round(5 * det), nv: 2,
      f: (u, v) => tb.clone().addScaledVector(d, u * fl).addScaledVector(sd, (v - 0.5) * fw * Math.sin(Math.PI * clamp(0.12 + u * 0.95, 0, 1)) ** 0.5 * (T.style === 'train' ? 0.6 + 0.8 * u : 1)).addScaledVector(upb, i * 0.0015 * L - droop * u * u + (v - 0.5) * 0.0 * fw),
      th: (u) => fw * 0.06 * (1 - 0.6 * u), zone: (u, v) => (T.eyespots && u > 0.78 && Math.abs(v - 0.5) < 0.3 + 0.1 * Math.sin(u * 30)) ? (u > 0.88 ? 'face' : 'accent') : (T.tip && u > 0.82 ? T.tip : paint({ part: 'tail', u, a: v, P: tb })), skin: (u) => u < 0.1 ? rig.W2('Hips', 'Tail', u / 0.1) : rig.W('Tail') });
  }
  // wings: spread planform (WingL/R → Humerus → Forearm → Hand) and folded wing (WingFoldL/R).
  // Built in the body's (X, upb, fwd) frame with the root station buried inside the chest and
  // skinned to WingL/R, so pitching Hips into flight levels the wings with the torso and flapping
  // Humerus/Forearm/Hand hinges cleanly at the shoulder without ever detaching the wing root.
  const Wg = S.wing, span = Wg.span * L, chord = Wg.chord * L;
  const shoulderY = bp(0.68, 0.20), foldShoulderY = bp(0.68, 0.38);
  const wPt = (base, dx, dy, dz) => base.clone().add(V3(dx, 0, 0)).addScaledVector(upb, dy).addScaledVector(fwd, dz);
  for (const sd of [1, -1]) {
    const sfx = sd > 0 ? 'L' : 'R';
    const rootP = wPt(shoulderY, sd * bodyW * 0.04, -bodyH * 0.03, 0);
    const sh = wPt(shoulderY, sd * bodyW * 0.25, 0, 0);
    const el = wPt(sh, sd * span * 0.27, span * 0.02, -span * 0.03);
    const wr = wPt(el, sd * span * 0.3, span * 0.01, span * 0.03);
    const tipP = wPt(wr, sd * span * 0.43, -span * 0.01, -span * (Wg.sweep ?? 0.12));
    rig.add('Wing' + sfx, 'Chest', sh); rig.add('Humerus' + sfx, 'Wing' + sfx, sh, el); rig.add('Forearm' + sfx, 'Humerus' + sfx, el, wr); rig.add('Hand' + sfx, 'Forearm' + sfx, wr, tipP);
    const le = makePath([rootP, sh, el, wr, tipP]), ku = knotUs(le, 5);
    const spec = rig.spec(['Wing' + sfx, 'Humerus' + sfx, 'Forearm' + sfx, 'Hand' + sfx], [0, ku[1], ku[2], ku[3]], 0.24);
    const slotted = Wg.tip === 'slotted', tipK = Wg.tip === 'pointed' ? 0.12 : 0.45;
    const rootChord = Math.min(0.72, (0.45 * L) / Math.max(chord, 1e-6));
    const cP = prof([[0, rootChord], [ku[1], 0.94], [ku[2], 0.96], [ku[3], 0.88], [0.86, slotted ? 0.55 : 0.7], [1, slotted ? 0.3 : tipK]]);
    const wpart = B.part('wings', { group: 'wingSpread' });
    sheet(wpart, { nu: Math.round(18 * det), nv: Math.round(4 * det),
      f: (u, v) => {
        const p = le.getPointAt(u), c = chord * cP(u) * (1 - 0.07 * Math.abs(Math.sin(u * Math.PI * (Wg.feathers ?? 9))) * v ** 3);
        const rootTuck = 1 - sstep(0, ku[2], u);
        return wPt(p, -sd * bodyW * 0.08 * rootTuck * v, Math.sin(Math.PI * v) * c * 0.06 * (1 - u * 0.5) - bodyH * 0.04 * rootTuck * v, -v * c + (u > 0.85 ? -(u - 0.85) * c * 0.8 * v : 0));
      },
      th: (u, v) => (chord * 0.038 * (1 - 0.5 * u) + bodyH * 0.09 * Math.pow(1 - sstep(0, ku[2], u), 2)) * (1 - 0.68 * v),
      zone: (u, v) => paint({ part: 'wing', u, a: v, P: sh }), skin: (u) => rig.chain(spec, u) });
    if (slotted) for (let i = 0; i < 6; i++) {
      const t = i / 5, base = le.getPointAt(lerp(0.8, 0.98, t)), d = wPt(V3(), sd * (0.6 + 0.4 * t), 0, -(1 - t) * 0.8).normalize(), fl = chord * (0.65 - 0.15 * Math.abs(t - 0.5));
      sheet(wpart, { nu: 4, nv: 2, f: (u, v) => wPt(base, 0, u * u * fl * 0.08, -chord * 0.15 + (v - 0.5) * chord * 0.12 * Math.sin(Math.PI * clamp(u * 0.9 + 0.1, 0, 1))).addScaledVector(d, u * fl), th: chord * 0.02, zone: 'flight', skin: rig.W('Hand' + sfx) });
    }
    // folded wing lying on the flank, primaries crossing over the tail
    rig.add('WingFold' + sfx, 'Chest', foldShoulderY.clone().add(V3(sd * bodyW * 0.45, 0, 0)));
    const fl = (Wg.foldLength ?? (0.62 + (Wg.fold ?? 0.35))) * L, fh = bodyH * (Wg.foldH ?? 0.5);
    sheet(B.part('wings-folded', { group: 'wingFold' }), { nu: Math.round(10 * det), nv: Math.round(4 * det),
      f: (u, v) => { const s = clamp(0.72 - u * (Wg.foldReach ?? 0.95), -0.45, 1), env = Math.pow(Math.sin(Math.PI * clamp(u * 0.92 + 0.06, 0, 1)), 0.5), ang = lerp(1.15, 1.15 - (Wg.foldH ?? 0.5) * 2.1 * env, v);
        const hit = body.at(clamp(s, 0.03, 0.97), sd > 0 ? ang : Math.PI - ang), P2 = hit.p.addScaledVector(hit.n, bodyW * 0.035);
        if (s < 0.03) P2.addScaledVector(fwd, (s - 0.03) * L).addScaledVector(upb, (0.03 - s) * L * 0.15);
        return P2; },
      th: (u, v) => bodyH * 0.06 * (1 - 0.6 * u), zone: (u, v) => paint({ part: 'fold', u, a: v, P: shoulderY }), skin: rig.W('WingFold' + sfx) });
  }
  // legs: hidden thigh, feathered drumstick, scaly tarsus and toes
  const lp = B.part('legs', { group: 'legs' }), fpart = B.part('feet', { group: 'feet' });
  // Anatomical order: femur + knee hidden inside the body contour → feathered drumstick that
  // emerges from the belly (started inside the body so the seam is buried) → optional bare tibia
  // (waders) → intertarsal joint ("backwards knee", heel behind the foot) → tarsus → toes.
  const bare = clamp(S.bareTibia ?? 0, 0, 0.9);
  for (const sd of [1, -1]) {
    const sfx = sd > 0 ? 'L' : 'R', hip = bp(0.44, -0.05).add(V3(sd * bodyW * 0.2, 0, 0));
    const lr = S.legThk * L;
    const belly = surfaceToward(body, hip, V3(sd * 0.3, -1, 0.05).normalize(), 0.2, 0.8).p;
    const foot = V3(hip.x + sd * bodyW * 0.03, 0.012 * L, C0.z + (S.footFwd ?? 0.04) * L);
    const tA = (S.heelAng ?? 14) * DEG, tLen = Math.max(S.legLen * L, lr * 2.5);
    const ankle = V3(foot.x, foot.y + tLen * Math.cos(tA), foot.z - tLen * Math.sin(tA));
    const knee = hip.clone().lerp(belly, 0.55).add(V3(0, 0, 0.05 * L * Math.max(0.2, Math.cos(P))));
    if (knee.y < ankle.y + lr * 3) knee.y = ankle.y + lr * 3;
    rig.add('Thigh' + sfx, 'Hips', hip, knee); rig.add('Shin' + sfx, 'Thigh' + sfx, knee, ankle); rig.add('Tarsus' + sfx, 'Shin' + sfx, ankle, foot); rig.add('Toe' + sfx, 'Tarsus' + sfx, foot, foot.clone().add(V3(0, 0, 0.1 * L)));
    // drumstick / tibia: one continuous loft from inside the body to the heel
    const tibDir = knee.clone().sub(ankle), tibLen = tibDir.length(); tibDir.normalize();
    const ext = Math.min(tibLen * 0.4, bodyH * 0.32), top = knee.clone().addScaledVector(tibDir, ext);
    const uK = ext / (ext + tibLen), uF = bare > 0 ? uK + (1 - uK) * (1 - bare) : 1;
    const rTop = Math.min(bodyW * 0.17, bodyH * 0.24) * (S.thighK ?? 1);
    const rFe = S.feathered ? lr * 2.3 : bare > 0 ? lr * 1.45 : lr * 1.7;
    // teardrop drumstick: full where it leaves the belly, tapering quickly toward the hock
    const keys = [[0, rTop * 0.9], [uK, rTop], [uK + (uF - uK) * 0.3, lerp(rTop, rFe, 0.45)], [uK + (uF - uK) * 0.65, lerp(rTop, rFe, 0.85)], [uF, rFe]];
    if (bare > 0) keys.push([Math.min(0.999, uF + (1 - uF) * 0.12), lr * 1.12], [1, lr * 1.08]);
    const tibR = prof(keys);
    const tib = loft({ pts: [top, knee, knee.clone().lerp(ankle, 0.5), ankle], seg: Math.round(12 * det), rad: 2 * Math.round(4 * det + 2), up: [1, 0, 0], w: tibR, ht: tibR, hb: tibR, cap0: { type: 'round', len: 0.5 }, cap1: { type: 'round', len: 0.4 }, bend: 0.3 });
    emit(lp, tib, (u) => (bare <= 0 || u < uF) ? paint({ part: 'thigh', u, a: 0, P: knee }) : 'leg', (u) => rig.W2('Thigh' + sfx, 'Shin' + sfx, sstep(uK * 0.6, uK + (1 - uK) * 0.3, u)));
    // intertarsal joint knob: readable heel where the bare tibia meets the tarsus
    if (!S.feathered) {
      const jr = lr * (S.jointK ?? 1.32);
      emit(lp, ellipsoid(ankle, jr, jr, jr * 1.12, tibDir, [0, 0, 1], Math.round(4 * det + 2), 2 * Math.round(3 * det + 2)), 'leg', rig.W2('Shin' + sfx, 'Tarsus' + sfx, 0.5));
    }
    // tarsus: laterally compressed, feathered "boot" on raptors and owls
    const tarR = S.feathered ? prof([[0, lr * 2.0], [0.55, lr * 1.55], [0.75, lr * 1.05], [1, lr * 0.95]]) : (u) => lr * (1.02 - 0.1 * u);
    const tar = loft({ pts: [ankle, ankle.clone().lerp(foot, 0.5), foot], seg: Math.round(7 * det), rad: 2 * Math.round(3 * det + 2), up: [0, 0, 1], w: (u) => tarR(u) * 0.86, ht: tarR, hb: tarR, cap0: { type: 'round', len: 0.4 }, cap1: { type: 'round', len: 0.5 }, bend: 0.3 });
    emit(lp, tar, (u) => S.feathered && u < 0.62 ? paint({ part: 'thigh', u: 1, a: 0, P: ankle }) : 'leg', rig.W('Tarsus' + sfx));
    const F = S.feet, toeL = (S.toeLen ?? 0.28) * L, tr = lr * 0.8;
    // foot pad hides the toe convergence
    emit(fpart, ellipsoid(foot.clone().add(V3(0, tr * 0.5, 0)), tr * 1.45, tr * 1.05, tr * 1.6, [0, 0, 1], [0, 1, 0], 4, 8), 'leg', rig.W('Toe' + sfx));
    const dirs = F === 'zygo' ? [[-0.35, 1], [0.15, 1], [-2.8, 0.75], [2.6, 0.6]] : F === 'ratite' ? [[0.08, 1.2], [0.6, 0.75]] : [[-0.55, 0.9], [0, 1], [0.55, 0.9], [Math.PI, F === 'webbed' ? 0.3 : 0.6]];
    const tips = [];
    for (const [ang, k] of dirs) {
      const d = V3(Math.sin(ang * sd), 0, Math.cos(ang)), e = foot.clone().addScaledVector(d, toeL * k); e.y = tr * 0.8;
      tips.push(e);
      emit(fpart, tube([foot, foot.clone().lerp(e, 0.5).add(V3(0, tr * 0.6, 0)), e], (u) => tr * (1 - 0.35 * u), 4, 5, { cap1: { type: 'round', len: 0.7 } }), 'leg', rig.W('Toe' + sfx));
      if (S.talons) emit(fpart, tube([e, e.clone().addScaledVector(d, tr * S.talons * 1.4).add(V3(0, tr * 0.5, 0)), e.clone().addScaledVector(d, tr * S.talons * 2.2).add(V3(0, -tr * 1.2, 0))], (u) => tr * 0.55 * (1 - u * 0.9), 4, 4, { cap1: 'point' }), 'beak', rig.W('Toe' + sfx));
    }
    if (F === 'webbed') sheet(fpart, { nu: 2, nv: 6, f: (u, v) => { const x = v * 2, i = Math.min(1, Math.floor(x)), t = x - i; return foot.clone().lerp(tips[i].clone().lerp(tips[i + 1], t), u * (1 - 0.25 * Math.sin(Math.PI * t) * u)); }, th: tr * 0.25, zone: 'leg', skin: rig.W('Toe' + sfx) });
  }
  return { L, C0, fwd, upb, hd, hu, hr, bodyH, legH, body, neck, head, eyes, spanP: span };
}

/* ════════════════════════════════════════════════════════════════════════════
 *  BIRD SPECIES — L = body length (m); other lengths are multiples of L.
 * ════════════════════════════════════════════════════════════════════════════ */
const BDEF = {
  L: 0.1, bodyH: 0.6, bodyW: 0.6, pitch: 25, legLen: 0.28, thigh: 0.35, legThk: 0.028, neckLen: 0.2, neckAng: 62, neckCurve: 0, headR: 0.26, headAng: 4, headW: 0.92,
  beak: { len: 0.8, w: 0.36, h: 0.4, style: 'cone' }, eye: 0.2, eyeYaw: 72, wing: { span: 1.6, chord: 0.55, tip: 'round', fold: 0.3, sweep: 0.12 },
  tail: { len: 0.7, fan: 34, n: 10, style: 'fan' }, feet: 'perch', toeLen: 0.26, pattern: {},
};
const BP = (body, belly, wing, flight, head, face, accent, beak, leg, eye = '#1a120a', extra = {}) => ({ body, belly, wing, flight, head, face, accent, beak, leg, eye, pupil: '#050505', jaw: beak, ...extra });
const SPECIES = {
  sparrow: { label: 'House Sparrow', sci: 'Passer domesticus', bodyForm: 'songbird', L: 0.075, headR: 0.21, neckLen: 0.08, neckThin: 0.8, neckNape: 1.0, neckAng: 70, eye: 0.21, maskW: 0.16, maskWBill: 0.5,
    beak: { len: 0.75, w: 0.24, h: 0.32, style: 'cone' }, pattern: { mask: true, maskShape: 'stripe', throat: 'face', cap: 'head', cheek: 'accent', nape: 'body', wingBar: true },
    palette: BP('#8a6a48', '#c9c0b0', '#7a5432', '#4a3a2a', '#7d7d78', '#2a2420', '#e8e0d0', '#3a3530', '#c49a7a') },
  robin: { label: 'European Robin', sci: 'Erithacus rubecula', bodyForm: 'robin', L: 0.07, bodyH: 0.68, bodyW: 0.66, headR: 0.21, neckLen: 0.08, neckThin: 0.82, neckNape: 1.0, neckAng: 72, eye: 0.22,
    beak: { len: 0.88, w: 0.15, h: 0.17, style: 'cone' }, pattern: { breast: 'accent', face: 'accent', faceU: 0.4, faceTop: 0.45, forehead: 'accent', foreheadU: 0.72, throat: 'accent' },
    palette: BP('#7a6a4a', '#e8e2d6', '#6e5e40', '#5a4a34', '#7a6a4a', '#d9762e', '#d9762e', '#2a2420', '#b08a6a') },
  crow: { label: 'Carrion Crow', sci: 'Corvus corone', bodyForm: 'corvid', L: 0.2, headR: 0.24, beak: { len: 1.3, w: 0.38, h: 0.48, style: 'cone', hook: 0.06 }, wing: { span: 2.2, chord: 0.62, tip: 'slotted', fold: 0.4 }, tail: { len: 0.85, fan: 30, n: 12 }, legLen: 0.35,
    palette: BP('#1a1a1e', '#1d1d22', '#1e1e24', '#141418', '#16161a', '#16161a', '#2a2a36', '#111114', '#1d1d20', '#1a1208') },
  cardinal: { label: 'Northern Cardinal', sci: 'Cardinalis cardinalis', bodyForm: 'cardinal', L: 0.09, headR: 0.22, neckLen: 0.08, neckThin: 0.8, neckNape: 1.0, neckAng: 70, maskW: 0.42, maskWBill: 0.95,
    crest: { h: 1.25, style: 'peak', base: 0.52, thk: 0.2, sweep: 40 }, beak: { len: 0.85, w: 0.3, h: 0.42, style: 'cone' }, tail: { len: 1.0, fan: 26, n: 10 },
    pattern: { mask: true, maskShape: 'stripe', chin: 'face', chinU: 0.55 }, palette: BP('#c22a24', '#d63a2c', '#a8221e', '#8a1c18', '#c8261f', '#141010', '#d8322a', '#e8742c', '#9a6a5a') },
  pigeon: { label: 'Rock Pigeon', sci: 'Columba livia', bodyForm: 'waterfowl', skullForm: 'songbird', L: 0.2, pitch: 24, bodyH: 0.62, bodyW: 0.66, headR: 0.2, neckLen: 0.3, neckAng: 66, neckThin: 0.7,
    beak: { len: 0.72, w: 0.25, h: 0.28, style: 'cone' }, eye: 0.17, legLen: 0.24, legThk: 0.035, wing: { span: 2.2, chord: 0.64, tip: 'pointed', fold: 0.38 }, tail: { len: 0.62, fan: 34, n: 10 },
    pattern: { neck: 'accent', wingBands: true }, palette: BP('#78808a', '#aeb2b6', '#707780', '#3d4148', '#7e858d', '#d8d5c8', '#367b68', '#4a4b50', '#c66f75', '#e86f44') },
  woodpecker: { label: 'Great Spotted Woodpecker', sci: 'Dendrocopos major', bodyForm: 'corvid', skullForm: 'corvid', L: 0.15, pitch: 50, bodyH: 0.56, bodyW: 0.54, headR: 0.22, neckLen: 0.12, neckThin: 0.72,
    beak: { len: 1.65, w: 0.22, h: 0.25, style: 'cone' }, eye: 0.16, feet: 'zygo', legLen: 0.18, crest: { h: 0.45, style: 'peak', base: 0.25, thk: 0.12, sweep: 22 }, wing: { span: 1.85, chord: 0.6, tip: 'round', fold: 0.34 }, tail: { len: 0.9, fan: 20, n: 10, style: 'wedge', lift: 35 },
    pattern: { mask: 'face', maskShape: 'stripe', wingBar: true, cheek: 'belly' }, palette: BP('#171719', '#eeeae0', '#202024', '#f0ece2', '#171719', '#171719', '#d12b27', '#343338', '#65616a', '#a13b32') },
  kingfisher: { label: 'Common Kingfisher', sci: 'Alcedo atthis', bodyForm: 'songbird', skullForm: 'wader', L: 0.14, pitch: 28, bodyH: 0.54, bodyW: 0.58, headR: 0.25, neckLen: 0.08, neckThin: 0.8,
    beak: { len: 2.25, w: 0.2, h: 0.22, style: 'cone' }, eye: 0.17, legLen: 0.12, wing: { span: 1.65, chord: 0.55, tip: 'round', fold: 0.35 }, tail: { len: 0.35, fan: 26, n: 8 },
    pattern: { headAll: true, face: 'belly', breast: 'accent' }, palette: BP('#147da0', '#e8a14d', '#1687ad', '#205c79', '#146e91', '#f0e5d0', '#d97f32', '#25292c', '#c56d52', '#2a1b12') },
  macaw: { label: 'Scarlet Macaw', sci: 'Ara macao', bodyForm: 'parrot', L: 0.26, pitch: 50, bodyH: 0.55, headR: 0.28, headAng: 20, neckLen: 0.14, neckThin: 0.8, maskW: 0.5, maskWBill: 0.8, beak: { len: 0.85, w: 0.55, h: 1.0, style: 'hook', hook: 0.42, lower: 0.62, lowerStyle: 'scoop', keel: 0.15, y: 0.05 }, feet: 'zygo', legLen: 0.18,
    wing: { span: 1.9, chord: 0.62, tip: 'pointed', fold: 0.55 }, tail: { len: 2.8, fan: 16, n: 8, style: 'long', lift: 45 }, eye: 0.16, pattern: { face: 'face', faceU: 0.5, faceTop: 0.8, faceSlope: 0.25, mask: 'face', maskShape: 'stripe', wingBands: true },
    palette: BP('#d8241e', '#d8241e', '#f2c21a', '#2a5ad8', '#d8241e', '#f2ede6', '#2a8a3a', '#efe6d0', '#5a5a60', '#e8e0b0', { flight: '#2a5ad8', jaw: '#1d1a1a' }) },
  owl: { label: 'Great Horned Owl', sci: 'Bubo virginianus', bodyForm: 'owl', L: 0.32, pitch: 72, bodyH: 0.85, bodyW: 0.8, neckLen: 0.08, headR: 0.44, headW: 1.0, headAng: -4, eye: 0.3, eyeYaw: 16, eyeInset: 0.35, pupilBig: true, eyeRing: 0.55,
    beak: { len: 0.45, w: 0.28, h: 0.4, style: 'hook', hook: 0.5, y: 0.25 }, crest: { h: 0.75, n: 2, style: 'tuft', thk: 0.16, curl: -0.3, pair: true }, feet: 'zygo', talons: 1.4, feathered: true, legLen: 0.12, fluff: 0.05,
    wing: { span: 1.9, chord: 0.75, tip: 'round', fold: 0.25 }, tail: { len: 0.6, fan: 40, n: 10, lift: 35 }, pattern: { mask: 'face', throat: 'belly', barred: true },
    palette: BP('#7a5e40', '#c9b08a', '#6a5034', '#4a3a28', '#7a5e40', '#d8b88a', '#3a2c1e', '#3a3632', '#c9b08a', '#f2a81a') },
  eagle: { label: 'Bald Eagle', sci: 'Haliaeetus leucocephalus', bodyForm: 'raptor', L: 0.45, pitch: 35, headR: 0.24, beak: { len: 1.05, w: 0.42, h: 0.62, style: 'hook', hook: 0.42 }, eye: 0.15, eyeYaw: 50, talons: 1.6, feathered: true, legLen: 0.22,
    wing: { span: 2.4, chord: 0.75, tip: 'slotted', fold: 0.45 }, tail: { len: 0.75, fan: 36, n: 12 }, pattern: { headAll: true, neck: 'head', tail: 'head' },
    palette: BP('#3a2a1c', '#3e2e20', '#3a2a1c', '#2a1e14', '#f4f2ec', '#f4f2ec', '#f4f2ec', '#f2c21a', '#f2c21a', '#f2d24a') },
  falcon: { label: 'Peregrine Falcon', sci: 'Falco peregrinus', bodyForm: 'raptor', L: 0.38, pitch: 34, bodyH: 0.55, bodyW: 0.54, headR: 0.22, neckLen: 0.14, neckThin: 0.68,
    beak: { len: 0.72, w: 0.34, h: 0.5, style: 'hook', hook: 0.55 }, eye: 0.16, eyeYaw: 48, talons: 1.55, feathered: true, legLen: 0.24, wing: { span: 2.85, chord: 0.52, tip: 'pointed', fold: 0.62, sweep: 0.25 }, tail: { len: 0.78, fan: 28, n: 10 },
    pattern: { mask: 'face', throat: 'belly', barred: true }, palette: BP('#46515d', '#e6dfcf', '#3e4853', '#252b31', '#3f4852', '#1d252c', '#c9b68e', '#60636a', '#e3b52b', '#33251a') },
  flamingo: { label: 'Greater Flamingo', sci: 'Phoenicopterus roseus', bodyForm: 'flamingo', L: 0.36, pitch: 8, legLen: 1.1, thigh: 2.1, legThk: 0.036, bareTibia: 0.78, heelAng: 5, footFwd: 0.02, neckLen: 1.6, neckAng: 70, neckThin: 0.42, neckBase: 1.4, neckNape: 1.2,
    neckShape: [[0, 30], [0.22, 78], [0.5, 116], [0.74, 98], [0.9, 58], [1, 32]], headR: 0.16, headAng: 8, headW: 0.84,
    beak: { len: 1.95, w: 0.56, h: 0.78, style: 'cone', droop: 0.8, tip: 'face', y: 0.18 }, eye: 0.18, feet: 'webbed', wing: { span: 2.0, chord: 0.62, tip: 'round', fold: 0.35 }, tail: { len: 0.4, fan: 30, n: 8 },
    palette: BP('#f2a0a8', '#f4b0b6', '#e8707e', '#1d1a1a', '#f2a0a8', '#1d1a1a', '#e8707e', '#f2e6d6', '#e88a96', '#f2d24a') },
  heron: { label: 'Grey Heron', sci: 'Ardea cinerea', bodyForm: 'wader', L: 0.32, pitch: 18, legLen: 0.66, thigh: 1.4, legThk: 0.04, bareTibia: 0.55, heelAng: 8, neckLen: 1.05, neckAng: 66, neckBase: 1.45, neckThin: 0.46, neckNape: 1.15,
    neckShape: [[0, 42], [0.25, 92], [0.52, 112], [0.78, 82], [1, 40]], headR: 0.17, headW: 0.82, headAng: 2, beak: { len: 2.6, w: 0.32, h: 0.38, style: 'cone' },
    crest: { h: 2.6, n: 2, style: 'tuft', thk: 0.05, curl: 0.0, lay: 1, droop: 0.3 }, eye: 0.2, wing: { span: 2.2, chord: 0.7, tip: 'round', fold: 0.35 }, tail: { len: 0.45, fan: 30, n: 8 }, pattern: { neck: 'belly', cap: 'face' },
    palette: BP('#8a8e94', '#e8e8e4', '#7a7e84', '#2a2c30', '#f0f0ec', '#1d1d20', '#1d1d20', '#d8b03a', '#b8a060', '#f2d24a') },
  crane: { label: 'Sandhill Crane', sci: 'Antigone canadensis', bodyForm: 'wader', skullForm: 'wader', L: 0.48, pitch: 15, bodyH: 0.58, bodyW: 0.58, legLen: 0.75, thigh: 1.25, legThk: 0.04, bareTibia: 0.55, neckLen: 1.35, neckAng: 78, neckThin: 0.42, neckBase: 1.35,
    neckShape: [[0, 54], [0.4, 82], [0.75, 88], [1, 70]], headR: 0.14, headW: 0.78, beak: { len: 2.4, w: 0.28, h: 0.3, style: 'cone' }, eye: 0.19, wing: { span: 2.5, chord: 0.7, tip: 'slotted', fold: 0.4 }, tail: { len: 0.45, fan: 35, n: 10 },
    pattern: { neck: 'head', forehead: 'accent', headAll: true }, palette: BP('#8d9295', '#b8b5ae', '#83898d', '#3a3b3d', '#9a9b96', '#e8e0d2', '#b92f2c', '#565453', '#333638', '#c9883b') },
  spoonbill: { label: 'Roseate Spoonbill', sci: 'Platalea ajaja', bodyForm: 'spoonbill', L: 0.4, pitch: 14, bodyH: 0.6, bodyW: 0.66, legLen: 0.42, thigh: 1.15, legThk: 0.042, bareTibia: 0.5, heelAng: 9, neckLen: 0.9, neckAng: 67, neckBase: 1.25, neckThin: 0.46, neckRootR: 0.27, neckFlare: 0.24,
    neckShape: [[0, 40], [0.35, 84], [0.7, 88], [1, 52]], headR: 0.16, headW: 0.8, headAng: 16,
    beak: { len: 3.6, w: 0.24, h: 0.25, style: 'spoon', spoon: 2.9, curve: 0.08, tip: 'beak' }, eye: 0.19, feet: 'webbed', toeLen: 0.3, wing: { span: 2.05, chord: 0.66, tip: 'round', fold: 0.38 }, tail: { len: 0.42, fan: 32, n: 8 }, pattern: { neck: 'head', headAll: true },
    palette: BP('#ef91a5', '#f6b6bd', '#dd6f91', '#bd496b', '#f19bad', '#f4a1b0', '#e56e88', '#8b8b82', '#d9959c', '#f6db81') },
  stilt: { label: 'Black-necked Stilt', sci: 'Himantopus mexicanus', bodyForm: 'wader', L: 0.17, pitch: 17, bodyH: 0.5, bodyW: 0.5, legLen: 0.78, thigh: 1.25, legThk: 0.03, bareTibia: 0.62, heelAng: 6, neckLen: 0.55, neckAng: 68, neckThin: 0.55,
    neckShape: [[0, 52], [0.5, 76], [1, 64]], headR: 0.15, headW: 0.78, headAng: 4,
    beak: { len: 2.1, w: 0.2, h: 0.22, style: 'cone' }, eye: 0.18, feet: 'perch', toeLen: 0.36, wing: { span: 1.9, chord: 0.58, tip: 'pointed', fold: 0.4 }, tail: { len: 0.5, fan: 24, n: 8 }, pattern: { neck: 'head', headAll: true },
    palette: BP('#17191c', '#f4f1ea', '#1c1d20', '#242529', '#17191c', '#f4f1ea', '#f4f1ea', '#1e2022', '#ee7f82', '#d94f54') },
  swan: { label: 'Mute Swan', sci: 'Cygnus olor', bodyForm: 'swan', L: 0.62, pitch: -2, bodyH: 0.55, bodyW: 0.62, legLen: 0.16, thigh: 0.4, footFwd: -0.08, heelAng: 22, neckLen: 1.3, neckAng: 74, neckThin: 0.5, neckBase: 1.6, neckNape: 1.12, neckRootU: 0.84,
    neckShape: [[0, 24], [0.2, 64], [0.45, 100], [0.68, 104], [0.86, 72], [1, 44]], headR: 0.15, headAng: 24, beak: { len: 1.7, w: 0.5, h: 0.42, style: 'flat', tip: 'face' }, eye: 0.16,
    feet: 'webbed', toeLen: 0.22, wing: { span: 2.0, chord: 0.7, tip: 'round', fold: 0.2, foldH: 0.65 }, tail: { len: 0.35, fan: 40, n: 10, lift: 12 },
    palette: BP('#f6f4ee', '#f2f0ea', '#f4f2ec', '#eceae4', '#f6f4ee', '#1d1d1d', '#f6f4ee', '#e8742c', '#2a2826') },
  duck: { label: 'Mallard', sci: 'Anas platyrhynchos', bodyForm: 'waterfowl', L: 0.36, pitch: 4, bodyH: 0.55, bodyW: 0.62, legLen: 0.16, thigh: 0.36, footFwd: -0.06, heelAng: 20, neckLen: 0.4, neckAng: 70, neckShape: [[0, 32], [0.35, 74], [0.75, 72], [1, 46]], headR: 0.2, headAng: 8, beak: { len: 1.15, w: 0.55, h: 0.4, style: 'flat' }, eye: 0.16,
    feet: 'webbed', toeLen: 0.22, wing: { span: 1.7, chord: 0.6, tip: 'pointed', fold: 0.25 }, tail: { len: 0.35, fan: 44, n: 10, lift: 15 }, crest: { h: 0.0 },
    pattern: { headAll: true, neck: 'head', collar: true, breast: 'accent', speculum: true }, palette: BP('#8a8a86', '#d8d4cc', '#7a766e', '#5a5650', '#1e6a3a', '#f4f2ec', '#6a3a2a', '#e8c43a', '#e8823a') },
  puffin: { label: 'Atlantic Puffin', sci: 'Fratercula arctica', bodyForm: 'penguin', skullForm: 'parrot', L: 0.25, pitch: 58, bodyH: 0.64, bodyW: 0.58, headR: 0.27, neckLen: 0.1, neckThin: 0.84,
    beak: { len: 1.05, w: 0.32, h: 0.95, style: 'big', decurve: 0.12, tip: 'face', tipFrom: 0.75 }, eye: 0.15, feet: 'webbed', legLen: 0.1, wing: { span: 1.45, chord: 0.48, tip: 'pointed', fold: 0.3 }, tail: { len: 0.22, fan: 30, n: 8 },
    pattern: { headAll: true, face: 'belly', bellyFront: true }, palette: BP('#1b2024', '#f0eee5', '#22282d', '#31363b', '#171a1d', '#ded9ca', '#e46d35', '#e8832f', '#e36b3d', '#59402d') },
  penguin: { label: 'Emperor Penguin', sci: 'Aptenodytes forsteri', bodyForm: 'penguin', L: 0.78, pitch: 84, bodyH: 0.52, bodyW: 0.5, legLen: 0.03, thigh: 0.12, footFwd: 0.2, heelAng: 40, bareTibia: 0, thighK: 1.7, groundClear: 0.01, legThk: 0.05, neckLen: 0.14, neckAng: 85, headR: 0.17, headAng: 10, beak: { len: 1.5, w: 0.3, h: 0.32, style: 'cone', curve: -0.4 }, eye: 0.12,
    feet: 'webbed', toeLen: 0.12, wing: { span: 0.62, chord: 0.24, tip: 'round', fold: 0.0, foldH: 0.6, foldReach: 0.55 }, tail: { len: 0.12, fan: 30, n: 6 }, pattern: { headAll: true, neck: 'head', face: 'face', bellyFront: true },
    palette: BP('#1d2228', '#f4f2ea', '#1d2228', '#1d2228', '#15181c', '#f2b23a', '#f2b23a', '#1d1d20', '#1d1d20', '#1a120a', { jaw: '#e8923a' }) },
  ostrich: { label: 'Ostrich', sci: 'Struthio camelus', bodyForm: 'ratite', L: 0.72, pitch: 12, bodyH: 0.72, bodyW: 0.68, legLen: 1.0, thigh: 0.9, legThk: 0.075, thighK: 1.25, heelAng: 10, neckLen: 1.25, neckAng: 78, neckThin: 0.5, neckRootR: 0.26,
    neckShape: [[0, 64], [0.4, 84], [0.8, 92], [1, 86]], headR: 0.13, headAng: 6, beak: { len: 1.6, w: 0.55, h: 0.32, style: 'flat' }, eye: 0.3,
    feet: 'ratite', toeLen: 0.28, wing: { span: 0.75, chord: 0.45, tip: 'round', fold: 0.15 }, tail: { len: 0.4, fan: 60, n: 10, droop: 0.3 }, fluff: 0.06, pattern: { neck: 'face', thigh: 'leg', headAll: true },
    palette: BP('#1d1b1a', '#1d1b1a', '#1d1b1a', '#f2f0ea', '#c8a49a', '#d8b0a4', '#f2f0ea', '#c89a7a', '#d8a098') },
  kiwi: { label: 'North Island Brown Kiwi', sci: 'Apteryx mantelli', bodyForm: 'ratite', skullForm: 'wader', L: 0.35, pitch: 22, bodyH: 0.78, bodyW: 0.72, legLen: 0.32, thigh: 0.65, legThk: 0.065, neckLen: 0.2, neckAng: 55, headR: 0.16, headW: 0.78,
    beak: { len: 3.1, w: 0.18, h: 0.2, style: 'cone', curve: 0.12 }, eye: 0.13, feet: 'ratite', toeLen: 0.42, wing: { span: 0.12, chord: 0.12, tip: 'round', fold: 0, foldLength: 0.14, foldH: 0.2 }, tail: { len: 0, fan: 20, n: 1 }, fluff: 0.08,
    pattern: { headAll: true, neck: 'head' }, palette: BP('#65503c', '#755e47', '#594532', '#493929', '#6c5540', '#705944', '#8b7459', '#b79b79', '#8f7b64', '#2b2118') },
  turkey: { label: 'Wild Turkey', sci: 'Meleagris gallopavo', bodyForm: 'galliform', skullForm: 'galliform', L: 0.68, pitch: 24, bodyH: 0.76, bodyW: 0.75, headR: 0.17, neckLen: 0.48, neckAng: 70, neckThin: 0.48, legLen: 0.42, legThk: 0.06, bareTibia: 0.25,
    beak: { len: 0.75, w: 0.38, h: 0.42, style: 'cone', hook: 0.12 }, eye: 0.16, wattle: 1.5, wattleZone: 'face', wing: { span: 1.75, chord: 0.7, tip: 'round', fold: 0.25 }, tail: { len: 1.0, fan: 110, n: 18, lift: 65 },
    pattern: { neck: 'face', headAll: true, barred: true }, palette: BP('#3b2b21', '#46352a', '#514031', '#2a2420', '#4c6e83', '#9c3c3c', '#c09a55', '#d6b45f', '#b66d63', '#2a1a12') },
  rooster: { label: 'Rooster', sci: 'Gallus gallus domesticus', bodyForm: 'galliform', L: 0.38, pitch: 28, bodyH: 0.7, headR: 0.2, beak: { len: 0.8, w: 0.4, h: 0.5, style: 'cone', hook: 0.12 }, crest: { h: 1.2, style: 'comb', zone: 'face' }, wattle: 1.0, wattleZone: 'face', maskR: 0.42, eye: 0.16,
    wing: { span: 1.6, chord: 0.62, tip: 'round', fold: 0.2 }, tail: { len: 1.6, fan: 40, n: 10, style: 'long', lift: 28, droop: 0.5 }, legLen: 0.4, legThk: 0.05, thigh: 0.5, thighK: 1.15, bareTibia: 0.2,
    pattern: { neck: 'accent', headAll: true, mask: 'face' }, palette: BP('#a8381e', '#1d2a22', '#8a2a14', '#1d2a22', '#d8742a', '#d8241e', '#e88a2a', '#e8c43a', '#e8c43a', '#d8742a', { tail: '#1d3a2a' }) },
  peacock: { label: 'Indian Peafowl', sci: 'Pavo cristatus', bodyForm: 'peafowl', L: 0.45, pitch: 22, headR: 0.17, neckLen: 0.75, neckAng: 72, neckShape: [[0, 58], [0.5, 80], [1, 76]], bareTibia: 0.3, beak: { len: 0.8, w: 0.36, h: 0.4, style: 'cone' }, crest: { h: 1.1, n: 7, style: 'fan', thk: 0.04, ball: true }, eye: 0.17,
    wing: { span: 1.7, chord: 0.62, tip: 'round', fold: 0.3 }, tail: { len: 2.6, fan: 60, n: 18, style: 'train', droop: 0.15, eyespots: true }, legLen: 0.55, legThk: 0.05,
    pattern: { neck: 'head', headAll: true, mask: 'face' }, palette: BP('#1e5ac8', '#1a3a7a', '#c8b48a', '#6a4a2a', '#1e5ac8', '#f2f0ea', '#e8c43a', '#d8c8b0', '#a8a098', '#1a120a', { flight: '#2a8a4a' }) },
  hummingbird: { label: 'Ruby-throated Hummingbird', sci: 'Archilochus colubris', bodyForm: 'hummingbird', L: 0.05, bodyH: 0.55, bodyW: 0.5, pitch: 30, legLen: 0.06, thigh: 0.18, legThk: 0.018, headR: 0.21, neckLen: 0.07, neckThin: 0.8, neckNape: 1.0, neckAng: 66, beak: { len: 1.75, w: 0.12, h: 0.12, style: 'cone' }, eye: 0.23,
    wing: { span: 1.6, chord: 0.32, tip: 'pointed', fold: 0.45 }, tail: { len: 0.55, fan: 30, n: 8, style: 'fork' }, pattern: { throat: 'accent' }, palette: BP('#2a8a4a', '#d8d8d0', '#2a6a3a', '#3a3a3a', '#2a8a4a', '#2a2a2a', '#d8241e', '#1d1d1d', '#2a2a2a') },
  pelican: { label: 'Brown Pelican', sci: 'Pelecanus occidentalis', bodyForm: 'pelican', L: 0.55, pitch: 15, neckLen: 0.95, neckAng: 60, neckBase: 1.5, footFwd: -0.02,
    neckShape: [[0, 46], [0.35, 96], [0.7, 104], [1, 62]], headR: 0.16, headAng: 30, beak: { len: 4.2, w: 0.42, h: 0.3, style: 'flat', hook: 0.06, hookPow: 9, tipTaper: 0.55, tipLen: 0.1, pouch: 1.2 }, eye: 0.15,
    feet: 'webbed', legLen: 0.18, wing: { span: 2.4, chord: 0.62, tip: 'slotted', fold: 0.3 }, tail: { len: 0.4, fan: 30, n: 10 }, pattern: { headAll: true, neck: 'face' },
    palette: BP('#6a6a6a', '#5a5a5c', '#7a766e', '#2a2826', '#f2eed8', '#5a3a2a', '#e8d870', '#a89a8a', '#3a3a3a') },
  toucan: { label: 'Toco Toucan', sci: 'Ramphastos toco', bodyForm: 'toucan', L: 0.3, pitch: 40, headR: 0.22, beak: { len: 3.8, w: 0.5, h: 1.25, style: 'big', curve: 0.1, decurve: 0.22, keel: 0.6, lowerDepth: 0.75, tip: 'face', tipFrom: 0.88, tipLower: false }, eye: 0.17, eyeRing: 0.5, feet: 'zygo', legLen: 0.2,
    wing: { span: 1.4, chord: 0.6, tip: 'round', fold: 0.2 }, tail: { len: 0.95, fan: 20, n: 8, lift: 25 }, pattern: { throat: 'belly', mask: 'accent', bellyFront: true },
    palette: BP('#141416', '#f4f2ea', '#141416', '#141416', '#141416', '#1d1d1d', '#3ab8e8', '#f28a1a', '#4a6ab8') },
  cockatoo: { label: 'Sulphur-crested Cockatoo', sci: 'Cacatua galerita', bodyForm: 'parrot', L: 0.24, pitch: 46, bodyH: 0.58, headR: 0.27, headAng: 18, neckLen: 0.12, neckThin: 0.82, eye: 0.15, eyeRing: 0.4,
    beak: { len: 0.72, w: 0.54, h: 0.92, style: 'hook', hook: 0.44, lower: 0.62, lowerStyle: 'scoop', keel: 0.15, y: 0.06 }, crest: { h: 2.3, n: 8, style: 'recurve', vane: 0.16, thk: 0.035, curl: 0.9 },
    feet: 'zygo', legLen: 0.18, wing: { span: 2.1, chord: 0.66, tip: 'round', fold: 0.45 }, tail: { len: 1.15, fan: 24, n: 10, style: 'wedge', lift: 30 }, pattern: { headAll: true },
    palette: BP('#f3f2ec', '#f1f0ea', '#efeee8', '#f2ead0', '#f6f5f0', '#dfe8f0', '#f4cd2b', '#2b2c30', '#4f5054', '#1a1410') },
  hornbill: { label: 'Great Hornbill', sci: 'Buceros bicornis', bodyForm: 'corvid', skullForm: 'hornbill', L: 0.42, pitch: 28, headR: 0.17, neckLen: 0.4, neckAng: 60, neckThin: 0.62, eye: 0.17, maskW: 0.45, maskWBill: 0.9,
    beak: { len: 4.1, w: 0.4, h: 0.8, style: 'big', decurve: 0.42, keel: 0.35, casque: { len: 0.6, h: 0.85, w: 0.92, zone: 'beak', tipZone: 'face' } },
    feet: 'perch', legLen: 0.2, legThk: 0.045, wing: { span: 2.5, chord: 0.78, tip: 'slotted', fold: 0.4 }, tail: { len: 1.5, fan: 24, n: 10 }, pattern: { neck: 'accent', headAll: true, mask: 'face', maskShape: 'stripe' },
    palette: BP('#17181b', '#ece8dc', '#1b1c1f', '#efe9d6', '#1b1c1f', '#101012', '#ede0a2', '#f0c033', '#55524c', '#c8352a', { jaw: '#efd57c' }) },
  albatross: { label: 'Wandering Albatross', sci: 'Diomedea exulans', bodyForm: 'gull', skullForm: 'pelican', L: 0.62, pitch: 12, bodyH: 0.52, bodyW: 0.58, headR: 0.18, neckLen: 0.38, neckAng: 58,
    beak: { len: 1.9, w: 0.34, h: 0.42, style: 'flat', hook: 0.2, hookPow: 8, tip: 'face', tipFrom: 0.88 }, eye: 0.14, feet: 'webbed', legLen: 0.16, wing: { span: 3.8, chord: 0.44, tip: 'pointed', fold: 0.72, sweep: 0.3 }, tail: { len: 0.48, fan: 28, n: 10 },
    pattern: { headAll: true, neck: 'head', wingTips: true }, palette: BP('#f4f2e9', '#f7f5ed', '#ece9df', '#24262a', '#f7f5ed', '#f5f1e6', '#d6c7ab', '#e1c7a8', '#c8b59c', '#3c2c20') },
  seagull: { label: 'Herring Gull', sci: 'Larus argentatus', bodyForm: 'gull', L: 0.32, pitch: 15, headR: 0.22, beak: { len: 1.2, w: 0.3, h: 0.38, style: 'cone', hook: 0.12, tip: 'accent', tipUpper: false }, eye: 0.14, feet: 'webbed', legLen: 0.32,
    wing: { span: 2.6, chord: 0.55, tip: 'pointed', fold: 0.6 }, tail: { len: 0.6, fan: 36, n: 10 }, pattern: { headAll: true, neck: 'head', wingTips: true },
    palette: BP('#a8b0b8', '#f6f6f4', '#a8b0b8', '#1d1d20', '#f6f6f4', '#f6f6f4', '#d8241e', '#f2c21a', '#e8a8a0', '#f2e6a0') },
};

/* ════════════════════════════════════════════════════════════════════════════
 *  BIRD FAMILY — schema, plumage painter, flight & perching clips, assembly
 * ════════════════════════════════════════════════════════════════════════════ */
const DEFAULT_SPECIES = 'eagle';
const ZONE_KEYS = ['body', 'belly', 'wing', 'flight', 'head', 'face', 'accent', 'beak', 'jaw', 'leg', 'eye', 'pupil'];
const ZONE_ROLES = { body: 'body', belly: 'body', wing: 'body', flight: 'body', head: 'body', face: 'body', accent: 'body', beak: 'keratin', jaw: 'keratin', leg: 'keratin', eye: 'eye', pupil: 'pupil' };
const ZONE_LABELS = { body: 'Back / mantle', belly: 'Belly', wing: 'Wing coverts', flight: 'Flight feathers', head: 'Head / neck', face: 'Face / mask / throat', accent: 'Accent (crest, comb, breast, patches)', beak: 'Beak / claws', jaw: 'Lower mandible', leg: 'Legs / feet', eye: 'Iris', pupil: 'Pupil' };
const BASE = { ...SPECIES[DEFAULT_SPECIES].palette };
export const COLORWAYS = colorwaysFor(BASE);
export const presets = COLORWAYS;
export const species = Object.fromEntries(Object.entries(SPECIES).map(([k, v]) => [k, { label: v.label, scientific: v.sci }]));
const R = (label, def, min, max, step, describe, affects = 'geometry') => ({ type: 'range', default: def, min, max, step, label, affects, describe });
const CH = (label, def, options, describe, affects = 'geometry') => ({ type: 'choice', default: def, options, label, affects, describe });

// Swaps spread vs folded wing visibility with bone-scale keys. Scale 0.001 hides without removing
// the bone, so clip scale tracks always reference valid nodes and static-mode part filtering keeps
// only the needed wing set. This prevents wings from appearing detached during fold transitions.
const fold = (s) => ({
  WingL: { r: [0, 0, 0], s: s ? 0.001 : 1 },
  WingR: { r: [0, 0, 0], s: s ? 0.001 : 1 },
  WingFoldL: { r: [0, 0, 0], s: s ? 1 : 0.001 },
  WingFoldR: { r: [0, 0, 0], s: s ? 1 : 0.001 },
});

// Expresses a bone rotation [rx, ry, rz] (defined in the body's aligned [X, upb, fwd] frame)
// in the rest-pose world frame via R_x(-P) · R(rx, ry, rz) · R_x(+P).
const _qp = new THREE.Quaternion(), _qpi = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _eb = new THREE.Euler();
function bodyEuler(rx, ry, rz, pitchDeg) {
  _qp.setFromAxisAngle(V3(1, 0, 0), -pitchDeg * DEG);
  _qpi.copy(_qp).invert();
  _eb.set(rx * DEG, ry * DEG, rz * DEG, 'YXZ');
  _qb.setFromEuler(_eb).premultiply(_qp).multiply(_qpi);
  _eb.setFromQuaternion(_qb, 'YXZ');
  return [_eb.x / DEG, _eb.y / DEG, _eb.z / DEG];
}

// Streamlined flight legs: in Three.js, positive X rotation swings a downward-hanging leg
// backward (-Z) and up (+Y) behind the body. Because Thigh inherits Hips' forward flight pitch
// (bodyPitch), we subtract bodyPitch so the world leg trail angle is consistent across all species.
function flightLegs(o, bodyPitch = 20) {
  const thighRx = clamp(48 - bodyPitch, -25, 52);
  for (const [sfx, k] of [['L', 1], ['R', -1]]) {
    o['Thigh' + sfx] = [thighRx, 0, -k * 3];
    o['Shin' + sfx] = [18, 0, 0];
    o['Tarsus' + sfx] = [14, 0, 0];
    o['Toe' + sfx] = [72, 0, 0];
  }
  return o;
}

function birdLegs(o, sw, lift, tuck = 0) {
  for (const [sfx, k] of [['L', 1], ['R', -1]]) {
    const s = sw * k, l = Math.max(0, lift * k);
    o['Thigh' + sfx] = [-s + tuck * 40, 0, 0]; o['Shin' + sfx] = [l * 25 + tuck * 30, 0, 0]; o['Tarsus' + sfx] = [-l * 55 + tuck * 75, 0, 0];
    o['Toe' + sfx] = [s - l * 25 + l * 55 - tuck * 140 + tuck * 60, 0, 0];
  }
  return o;
}
const BIRD_CLIPS = {
  perch: { label: 'Perch / idle', loop: true, dur: () => 4.2, frames: 43, build: (u, A) => {
    const look = Math.sin(TAU * u) * 28 * pulseSq(u, 0.15, 0.45), cock = 10 * pulseSq(u, 0.6, 0.8), breathe = 2 * Math.sin(TAU * 3 * u);
    return Object.assign(fold(true), birdLegs({}, 0, 0), { Hips: { r: [breathe, 0, 0], p: [0, -0.004 * A.L * Math.sin(TAU * 2 * u), 0] }, Neck2: [0, look * 0.4, 0], Head: [-cock * 0.3, look * 0.6, cock], Tail: [-6 * pulseSq(u, 0.85, 0.92), 0, 0] });
  } },
  walk: { label: 'Walk', loop: true, dur: (A) => A.T.walk, frames: 33, build: (u, A) => {
    const s = Math.sin(TAU * u), bob = Math.sin(TAU * 2 * u);
    return Object.assign(fold(true), birdLegs({}, 22 * s, Math.sin(TAU * u - 0.6)), { Hips: { r: [0, 3 * s, 2 * s], p: [0, 0.01 * A.L * Math.abs(bob), 0] }, Neck1: [6 * bob, 0, 0], Head: [-6 * bob, 0, 0], Tail: [2 * bob, 4 * s, 0] });
  } },
  hop: { label: 'Hop', loop: true, dur: (A) => A.T.hop, frames: 25, build: (u, A) => {
    const air = bell(u, 0.45, 0.3), crouch = bell(u, 0.1, 0.12) + bell(u, 0.9, 0.12);
    return Object.assign(fold(true), birdLegs({}, 0, 0), { Hips: { r: [5 * air, 0, 0], p: [0, A.L * 0.35 * air - A.L * 0.05 * crouch, 0] }, ThighL: [18 * crouch - 8 * air, 0, 0], ThighR: [18 * crouch - 8 * air, 0, 0], TarsusL: [-24 * crouch, 0, 0], TarsusR: [-24 * crouch, 0, 0], ToeL: [4 * crouch + 24 * air, 0, 0], ToeR: [4 * crouch + 24 * air, 0, 0], Tail: [-10 * air, 0, 0] });
  } },
  peck: { label: 'Peck / forage', loop: true, dur: () => 2.0, frames: 31, build: (u, A) => {
    const d = Math.pow(Math.max(0, Math.sin(TAU * 2 * u)), 3);
    return Object.assign(fold(true), birdLegs({}, 0, 0), { Hips: { r: [10 * d, 0, 0], p: [0, -0.02 * A.L * d, 0] }, Neck1: [28 * d, 0, 0], Neck2: [22 * d, 0, 0], Head: [24 * d, 0, 0], Jaw: [8 * d, 0, 0], Tail: [-8 * d, 0, 0] });
  } },
  flap: { label: 'Fly (flapping)', loop: true, dur: (A) => A.T.flap, frames: 25, build: (u, A) => {
    // Flapping cycle: wing rotations are conjugated into the body's (X, upb, fwd) frame so the wing
    // hinges along the shoulder flank line while the root stays locked to the chest.
    const s = Math.sin(TAU * u), c = Math.cos(TAU * u), down = Math.max(0, -c);
    const humerusX = 3 * c;
    const humerusZ = k => k * (34 * s);
    const forearmY = k => k * 8 * down;
    const forearmZ = k => k * 15 * Math.sin(TAU * u - 0.7);
    const handY = k => k * 12 * down;
    const handZ = k => k * 22 * Math.sin(TAU * u - 1.1);
    const bodyBob = A.L * 0.14 * down;
    const bodyPitch = A.pitch * 0.88 + 4 * s;
    const neckBend = -A.pitch * 0.5;
    const tailCock = 3 * s;
    const o = Object.assign(fold(false), flightLegs({}, bodyPitch), {
      Hips: { r: [bodyPitch, 0, 0], p: [0, bodyBob - 0.03 * A.L * s, 0] },
      Neck1: [neckBend, 0, 0], Head: [neckBend * 0.55, 0, 0], Tail: [tailCock, 0, 0]
    });
    for (const [sfx, k] of [['L', 1], ['R', -1]]) {
      o['Humerus' + sfx] = bodyEuler(humerusX, 0, humerusZ(k), A.pitch);
      o['Forearm' + sfx] = bodyEuler(0, forearmY(k), forearmZ(k), A.pitch);
      o['Hand' + sfx] = bodyEuler(0, handY(k), handZ(k), A.pitch);
    }
    return o;
  } },
  glide: { label: 'Glide / soar', loop: true, dur: () => 3.5, frames: 29, build: (u, A) => {
    // Gliding: wings held steady in a slight dihedral in the body frame, legs streamlined behind.
    const s = Math.sin(TAU * u), c = Math.cos(TAU * u);
    const dihedral = 5 + 2.5 * c;
    const bodyBob = A.L * 0.06 * Math.sin(TAU * 2 * u);
    const bodyPitch = A.pitch * 0.85 + 2.5 * s;
    const neckBend = -A.pitch * 0.45;
    const headDip = -5 * s;
    const tailRudder = 6 * s;
    const o = Object.assign(fold(false), flightLegs({}, bodyPitch), {
      Hips: { r: [bodyPitch, 0, 5 * s], p: [0, bodyBob, 0] },
      Neck1: [neckBend, 0, 0], Head: [neckBend * 0.5, headDip, -6 * s], Tail: [0, 0, tailRudder]
    });
    for (const [sfx, k] of [['L', 1], ['R', -1]]) {
      o['Humerus' + sfx] = bodyEuler(0, 0, k * (dihedral + 1.5 * s * k), A.pitch);
      o['Forearm' + sfx] = bodyEuler(0, 0, -k * 3, A.pitch);
      o['Hand' + sfx] = bodyEuler(0, k * 3, k * 5, A.pitch);
    }
    return o;
  } },
};
function pulseSq(u, a, b) { return sstep(a - 0.05, a + 0.05, u) * (1 - sstep(b - 0.05, b + 0.05, u)); }

export const params = withZones({
  species: CH('Species', DEFAULT_SPECIES, Object.keys(SPECIES), 'Anatomical preset; other controls are relative to it.'),
  bodyForm: CH('Body silhouette', 'auto', ['auto', ...Object.keys(BODY_FORMS)], 'Anatomical torso profile; auto uses the species-specific silhouette.'),
  size: R('Size (× species)', 1, 0.3, 2.5, 0.01, 'Real-world scale multiplier; geometry is recomputed.'),
  age: R('Age (chick → adult)', 1, 0.3, 1, 0.01, 'Chicks: big heads and eyes, short wings, beaks and tails, fluffier bodies.'),
  bodyLength: R('Body length', 1, 0.7, 1.4, 0.01, 'Body loft length.'),
  girth: R('Plumpness', 1, 0.7, 1.5, 0.01, 'Body depth and width.'),
  legLength: R('Leg length', 1, 0.3, 2.5, 0.01, 'Visible tarsus length.'),
  neckLength: R('Neck length', 1, 0.3, 2, 0.01, 'Neck sweep length.'),
  neckCurve: R('Neck S-curve', 0, -1, 1, 0.01, 'Adds to (or removes) the species neck curvature.'),
  headSize: R('Head size', 1, 0.6, 1.6, 0.01, 'Head radius.'),
  beakLength: R('Beak length', 1, 0.4, 2.2, 0.01, 'Mandible length.'),
  beakDepth: R('Beak depth', 1, 0.5, 2, 0.01, 'Mandible height and width.'),
  beakHook: R('Beak hook', 0, -0.5, 1, 0.01, 'Extra downward hook at the tip.'),
  eyeSize: R('Eye size', 1, 0.6, 1.6, 0.01, 'Eyeball radius.'),
  wingspan: R('Wingspan', 1, 0.4, 1.8, 0.01, 'Spread-wing half-span.'),
  wingChord: R('Wing breadth', 1, 0.6, 1.6, 0.01, 'Wing chord.'),
  wingTip: CH('Wing tip', 'auto', ['auto', 'round', 'pointed', 'slotted'], 'Planform tip: rounded, pointed (falcon/gull) or slotted primaries (eagle/crow).'),
  tailLength: R('Tail length', 1, 0, 2.5, 0.01, 'Tail feather length.'),
  tailSpread: R('Tail spread', 1, 0.3, 2.5, 0.01, 'Fan angle of the tail feathers.'),
  tailStyle: CH('Tail style', 'auto', ['auto', 'fan', 'fork', 'wedge', 'long', 'train'], 'Tail feather arrangement.'),
  crestSize: R('Crest / comb', 1, 0, 2.5, 0.01, 'Crest, plume or comb size (species with crests).'),
  crestRaise: R('Crest raise', 0.2, 0, 1, 0.01, 'Erectile crests (cockatoos, cardinals): 0 lies flat, 1 fully raised.'),
  feet: CH('Feet', 'auto', ['auto', 'perch', 'webbed', 'zygo', 'ratite'], 'Toe arrangement.'),
  talons: R('Talons', 1, 0, 2.5, 0.01, 'Claw length.'),
  variation: R('Individual variation', 0, 0, 1, 0.01, 'Random per-individual proportion changes.'),
  seed: R('Seed', 1, 1, 999, 1, 'Seed for variation.'),
  detail: CH('Geometry detail', 'standard', ['draft', 'standard', 'high'], 'Sweep sampling density.'),
  rigMode: CH('Rig mode', 'skinned', ['skinned', 'static'], 'Skinned skeleton with clips, or the pose baked into plain meshes.'),
  pose: CH('Pose', 'perch', Object.keys(BIRD_CLIPS), 'Rest pose (skinned) or baked pose (static). Flight poses swap in the spread wings.'),
  posePhase: R('Pose phase', 0, 0, 1, 0.01, 'Point in the pose cycle.'),
  colorway: CH('Colourway', 'natural', COLORWAY_KEYS, 'Natural plumage or a curated transform.', 'colors'),
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'One skinned mesh per material. Off keeps each anatomical part selectable.' },
}, ZONE_LABELS, BASE);
export const rig = {
  Head: { axis: 'y', range: [-90, 90], describe: 'Head turn' }, Neck1: { axis: 'x', range: [-30, 60], describe: 'Neck bend' }, Jaw: { axis: 'x', range: [0, 35], describe: 'Open beak' },
  HumerusL: { axis: 'z', range: [-45, 60], describe: 'Left wing stroke' }, HumerusR: { axis: 'z', range: [-60, 45], describe: 'Right wing stroke' }, Tail: { axis: 'x', range: [-30, 30], describe: 'Tail cock' },
  ThighL: { axis: 'x', range: [-40, 40], describe: 'Left leg' }, ThighR: { axis: 'x', range: [-40, 40], describe: 'Right leg' },
};
export const detach = ['crest', 'wings', 'wings-folded', 'tail', 'beak', 'eyes', 'legs', 'feet'];
export const night = { eyes: { color: '#ffd77a', intensity: 0.2, distance: 1, describe: 'Eyeshine (owls and nightjars)' } };
export const ANIMATIONS = Object.entries(BIRD_CLIPS).map(([name, c]) => ({ name, label: c.label, loop: c.loop, duration: name === 'perch' ? 4.2 : name === 'glide' ? 3.5 : 0.6 }));

function resolveSpec(p) {
  const sp = SPECIES[p.species] || SPECIES[DEFAULT_SPECIES], S = {};
  for (const [k, v] of Object.entries({ ...BDEF, ...sp })) S[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...(BDEF[k] || {}), ...v } : v;
  if (p.bodyForm !== 'auto') S.bodyForm = p.bodyForm;
  S.palette = { ...BASE, ...sp.palette };
  const rnd = mulberry(p.seed * 4111 + 9), vr = () => 1 + (rnd() * 2 - 1) * 0.08 * p.variation, juv = 1 - sstep(0.3, 1, p.age);
  S.L *= p.size * p.bodyLength * vr() * lerp(1, 0.45, juv);
  S.bodyH *= lerp(1, p.girth, 0.7) * vr() * lerp(1, 1.12, juv); S.bodyW *= p.girth * vr() * lerp(1, 1.12, juv);
  S.legLen *= p.legLength * vr(); S.neckLen *= p.neckLength * vr() * lerp(1, 0.7, juv);
  // Authored neck shapes are amplified/flattened by the slider; derived shapes add to the species curve.
  S.neckCurveAdj = S.neckShape ? p.neckCurve : 0; S.neckCurve = (S.neckCurve || 0) + (S.neckShape ? 0 : p.neckCurve);
  S.headR *= p.headSize * lerp(1, 1.45, juv); S.eye *= p.eyeSize * lerp(1, 1.2, juv); S.fluff = (S.fluff || 0) + juv * 0.08;
  S.beak = { ...S.beak, len: S.beak.len * p.beakLength * lerp(1, 0.55, juv), w: S.beak.w * p.beakDepth, h: S.beak.h * p.beakDepth, hook: (S.beak.hook || 0) + p.beakHook };
  S.wing = { ...S.wing, span: S.wing.span * p.wingspan * lerp(1, 0.45, juv), chord: S.wing.chord * p.wingChord * lerp(1, 0.7, juv) };
  if (p.wingTip !== 'auto') S.wing.tip = p.wingTip;
  S.tail = { ...S.tail, len: S.tail.len * p.tailLength * lerp(1, 0.3, juv), fan: S.tail.fan * p.tailSpread };
  if (p.tailStyle !== 'auto') { S.tail.style = p.tailStyle; if (p.tailStyle === 'train') { S.tail.n = Math.max(S.tail.n, 16); S.tail.eyespots = true; } }
  if (S.crest) S.crest = { ...S.crest, h: S.crest.h * p.crestSize * lerp(1, 0.2, juv) };
  S.crestRaise = p.crestRaise;
  if (S.wattle) S.wattle *= p.crestSize * lerp(1, 0.2, juv);
  if (p.feet !== 'auto') S.feet = p.feet;
  S.talons = (S.talons ?? 0.5) * p.talons;
  S.pattern = { ...(S.pattern || {}) };
  return S;
}
/** Plumage painter: back/belly countershading, caps, masks, collars, wing bars and speculum. */
function birdPaint(S) {
  const P = S.pattern;
  const angDist = (x, y) => Math.abs(Math.atan2(Math.sin(x - y), Math.cos(x - y)));
  return (c) => {
    const { part, u, a } = c, sa = typeof a === 'number' ? Math.sin(a) : 0;
    switch (part) {
      case 'body': if (P.bellyFront && sa < 0.15 && Math.cos(a) * 0 === 0 && (Math.abs(Math.cos(a)) < 0.8 || sa < -0.3)) return 'belly'; if (P.breast && u > 0.62 && sa < 0.2) return P.breast; if (P.barred && sa < 0 && fract(u * 9) < 0.3) return 'body'; return sa < -0.25 ? 'belly' : 'body';
      case 'neck':
        if (P.collar && u > 0.08 && u < 0.2) return 'face';
        if (P.neck) return u > (S.neckLen < 0.3 ? 0 : 0.15) ? P.neck : (sa < -0.2 ? 'belly' : 'body');
        // For songbirds and compact perching birds, carry the breast colour up the neck instead
        // of inserting a contrasting collar between two already-continuous surfaces.
        if (S.neckLen < .35 && P.breast && sa < .2) return P.breast;
        return sa < -0.2 ? (P.throat || 'belly') : 'body';
      case 'head': {
        const hrr = S.headR * S.L;
        if (P.mask && c.eyes) {
          // stripe masks are bands in the skull's (u, angle) space from just behind each eye to the bill base,
          // widening onto the lores; their edges follow the mesh grid instead of zigzagging across it.
          const inMask = P.maskShape === 'stripe'
            ? c.eyes.some(e => u > e.u - (S.maskBack ?? 0.05) && angDist(a, e.a) < lerp(S.maskW ?? 0.3, S.maskWBill ?? 0.7, sstep(e.u, 1, u)))
            : c.eyes.some(e => e.c.distanceTo(c.P) < hrr * (S.maskR ?? 0.62));
          if (inMask) return P.mask === true ? 'face' : P.mask;
        }
        // faceSlope moves the face boundary forward as it climbs, giving a forehead patch instead of a vertical line
        if (P.face && sa > -0.6 && sa < (P.faceTop ?? 0.35) && u > (P.faceU ?? 0.55) + (P.faceSlope ?? 0) * Math.max(0, sa)) return P.face;
        if (P.chin && u > (P.chinU ?? 0.6) && sa < -0.55) return P.chin;
        if (P.forehead && u > (P.foreheadU ?? 0.7) && sa >= 0.35) return P.forehead;
        if (P.cap && sa > 0.55) return P.cap;
        const eu = c.eyes ? c.eyes[0].u : 0.5;
        if (P.cheek && sa > -0.55 && sa < 0.15 && u > eu - 0.14) return P.cheek;
        if (P.throat && sa < -0.4) return P.throat;
        if (P.nape && sa > -0.25 && u < eu - 0.08) return P.nape;
        return P.headAll ? 'head' : sa < -0.5 ? 'belly' : 'head';
      }
      case 'wing': { const v = a; if (P.wingTips && u > 0.82) return 'flight'; if (P.speculum && v > 0.42 && v < 0.62 && u > 0.25 && u < 0.6) return 'accent'; if (P.wingBar && v > 0.3 && v < 0.38) return 'face'; if (P.wingBands) return u < 0.35 ? 'wing' : u < 0.65 && v < 0.5 ? 'accent' : 'flight'; return v < 0.42 && u < 0.78 ? 'wing' : 'flight'; }
      case 'fold': { const v = a; if (P.wingTips && u > 0.75) return 'flight'; if (P.speculum && u > 0.45 && u < 0.65 && v > 0.6) return 'accent'; if (P.wingBar && Math.abs(u - 0.32) < 0.04) return 'face'; if (P.wingBands) return u < 0.3 ? 'wing' : u < 0.55 ? 'accent' : 'flight'; return u < 0.55 ? 'wing' : 'flight'; }
      case 'tail': return P.tail || 'flight';
      case 'thigh': return P.thigh || 'belly';
      default: return 'body';
    }
  };
}

export function createAsset(userParams = {}) {
  const p = normalize(userParams);
  const S = resolveSpec(p);
  const parts = [], B = { rig: new Rig(), parts, det: DETAIL[p.detail] ?? 1, part: (n, o) => { const pt = new Part(n, o); parts.push(pt); return pt; }, paint: birdPaint(S) };
  const G = birdBuild(B, S);
  const C = zonesFor(p.colorway, p, S.palette);
  const span = S.wing.span * S.L;
  const A = { L: S.L, pitch: S.pitch, T: { walk: clamp(0.55 * Math.sqrt(S.legLen * S.L / 0.03), 0.25, 1.6), hop: clamp(0.5 * Math.sqrt(S.L / 0.1), 0.3, 1.2), flap: clamp(0.38 * Math.sqrt(span / 0.5), 0.12, 1.4) } };
  const clip = BIRD_CLIPS[p.pose] || BIRD_CLIPS.perch, pose = clip.build(clip.loop ? p.posePhase % 1 : p.posePhase, A);
  // Flight clips always use spread wings regardless of instantaneous stroke phase; the bone-scale
  // keys handle the fold/swap for skinned playback, so static mode only needs the clip name.
  const flying = p.pose === 'flap' || p.pose === 'glide' || (pose.WingL && pose.WingL.s > 0.5);
  if (p.rigMode === 'static') B.parts = parts.filter(pt => pt.group !== (flying ? 'wingFold' : 'wingSpread'));
  const { root } = finish(B, { name: `bird-${p.species}`, merge: p.mergeForProduction, skinned: p.rigMode !== 'static', zones: C, pose });
  root.userData = {
    asset: 'bird-rig', species: p.species, label: SPECIES[p.species].label, scientific: SPECIES[p.species].sci, dimensions: measure(root),
    bodyForm: S.bodyForm,
    ...(p.debug ? { debug: { body: G.body, neck: G.neck, head: G.head } } : {}),
    zones: Object.fromEntries(Object.entries(C).map(([k, v]) => [k, hexStr(v)])),
    rig: { mode: p.rigMode !== 'static' ? 'skinned' : 'static', bones: B.rig.list.map(e => e.name), rest: Object.fromEntries(B.rig.list.map(e => [e.name, (e.parent ? e.head.clone().sub(e.parent.head) : e.head.clone()).toArray()])), moving: ['Hips'], scaled: ['WingL', 'WingR', 'WingFoldL', 'WingFoldR'] },
    anim: A, params: Object.fromEntries(Object.entries(p).filter(([k]) => params[k] && params[k].type !== 'color')), units: 'meters', forward: '+Z', up: '+Y', wingspan: +(2 * span + S.bodyW * S.L * 0.6).toFixed(3),
  };
  return root;
}
/** AnimationClips (perch, walk, hop, peck, flap, glide); flight clips scale the spread wings in and the folded wings out. */
export function createClips(asset, extra = null) {
  const ud = asset && asset.userData;
  if (!ud || !ud.rig || ud.rig.mode !== 'skinned' || !ud.anim) return [];
  const specs = Object.entries(BIRD_CLIPS).map(([name, c]) => ({ name, ...c }));
  if (Array.isArray(extra)) for (const e of extra) if (e && typeof e.build === 'function' && e.name && !BIRD_CLIPS[e.name]) specs.push({ loop: true, frames: 31, dur: () => e.duration || 2, ...e });
  return specs.map((c) => bakeClip(ud.rig, c.name, typeof c.dur === 'function' ? c.dur(ud.anim) : c.dur, c.frames || 31, (u) => c.build(u, ud.anim), c.loop !== false));
}
export function setPose(asset, name = 'perch', phase = 0.25) {
  const ud = asset && asset.userData, c = BIRD_CLIPS[name];
  if (!ud || !ud.rig || ud.rig.mode !== 'skinned' || !c) return false;
  const sample = c.build(c.loop ? phase % 1 : phase, ud.anim);
  for (const b of ud.rig.bones) {
    const bone = asset.getObjectByName(b); if (!bone || !bone.isBone) continue;
    const v = sample[b], r = !v ? null : Array.isArray(v) ? v : v.r, pp = v && !Array.isArray(v) ? v.p : null, rest = ud.rig.rest[b], sc = v && !Array.isArray(v) && v.s !== undefined ? v.s : 1;
    bone.quaternion.setFromEuler(new THREE.Euler((r ? r[0] : 0) * DEG, (r ? r[1] : 0) * DEG, (r ? r[2] : 0) * DEG, 'YXZ'));
    bone.position.set(rest[0] + (pp ? pp[0] : 0), rest[1] + (pp ? pp[1] : 0), rest[2] + (pp ? pp[2] : 0)); bone.scale.setScalar(sc);
  }
  return true;
}
export default createAsset;
