/*
 * RIG KIT — the sweep engine the mammal, bird and herp rigs are built on (CC0 1.0 Universal, like the rigs).
 * Bodies are lofted superellipse sections swept along parallel-transported frames, membranes (ears, fins, webs, wings,
 * frills, feathers) are thickened parametric sheets, and every vertex carries four bone weights, so the same geometry
 * poses, animates or bakes.
 *
 *   maths & noise   clamp, lerp, sstep, bell; monotone profiles (prof); seeded noise (mulberry, hash3, vnoise, fbm,
 *                   worley); sRGB hex colour helpers and colourway schemes (SCHEMES, COLORWAY_KEYS)
 *   surfaces        Part (non-indexed triangles, a zone per face, four skin influences per vertex), Catmull-Rom
 *                   paths, loft / emit, ellipsoid, tube, sheet, spike, surfaceToward
 *   skeleton        Rig (rest bones carry identity rotations, so clip angles are world aligned), weight blending
 *   clips           bakeClip (even keys, plus keys wherever the joints turn fast), sampleGap, applySample
 *   coat atlas      every painted loft and membrane is a patch; paintAtlas paints them all into one texture per asset
 *                   (paintPatch: adaptive sampling, soft edges, coat grain, skin creases and scales), and coatGloss
 *                   keeps gloss in its alpha; normals are smoothed with sharp creases and blended across limb seams
 *   output          MAT / GLASS_MAT, finish (merged per material, or named parts for editing), measure, DETAIL
 *   posing          two-bone IK, frame and quaternion helpers, posed / setWorld / setPos (bird and herp rigs)
 *
 * bindModule(tables) returns the helpers that read a rig's own colour zones (BASE, ZONE_ROLES) and params schema:
 * zonesFor, colorwaysFor, normalize and withZones. A rig calls it once, after its ZONE_ROLES; params is passed as a
 * getter and read only when the helpers run.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2, DEG = Math.PI / 180;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / ((b - a) || 1e-9), 0, 1); return t * t * (3 - 2 * t); };
export const bell = (x, c, w) => { const d = (x - c) / w; return d * d >= 1 ? 0 : (1 - d * d) * (1 - d * d); };
export const fract = (x) => x - Math.floor(x);
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const vec = (p) => (p && p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2]));
const asFn = (f, d = 0) => (typeof f === 'function' ? f : f === undefined || f === null ? () => d : () => f);

/** Monotone cubic (Fritsch–Carlson) profile through [[t, value], ...]: smooth bulges, never overshoots. */
export function prof(keys) {
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

export function mulberry(seed) {
  let a = (Math.floor(seed) >>> 0) ^ 0x9e3779b9;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hash3(x, y, z, s) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x9e3779b1) ^ Math.imul((s | 0) + 1013, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
/** Smooth value noise in [0, 1]. */
export function vnoise(x, y, z, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  let r = 0;
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) {
    r += hash3(ix + dx, iy + dy, iz + dz, s) * (dx ? ux : 1 - ux) * (dy ? uy : 1 - uy) * (dz ? uz : 1 - uz);
  }
  return r;
}
export function fbm(x, y, z, s = 0, oct = 3) {
  let a = 0.5, f = 1, r = 0, n = 0;
  for (let i = 0; i < oct; i++) { r += a * vnoise(x * f, y * f, z * f, s + i * 31); n += a; a *= 0.5; f *= 2.03; }
  return r / n;
}
/**
 * Cellular (Worley) noise: [nearest, second nearest] feature distances. The home cell is searched first, and a
 * neighbouring cell is skipped when even its nearest corner is no closer than the second-nearest point found so far.
 */
const WORLEY_ORDER = [0, -1, 1];
export function worley(x, y, z, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  let f1 = 9, f2 = 9;
  for (const dx of WORLEY_ORDER) for (const dy of WORLEY_ORDER) for (const dz of WORLEY_ORDER) {
    const bx = dx < 0 ? fx : dx > 0 ? 1 - fx : 0, by = dy < 0 ? fy : dy > 0 ? 1 - fy : 0, bz = dz < 0 ? fz : dz > 0 ? 1 - fz : 0;
    if (bx * bx + by * by + bz * bz >= f2 * f2) continue;
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
export const hexStr = (h) => '#' + ((h ?? 0) & 0xffffff).toString(16).padStart(6, '0');
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
export class Part {
  constructor(name, opt = {}) {
    this.name = name; this.glass = !!opt.glass; this.group = opt.group || name;
    this.p = []; this.z = []; this.si = []; this.sw = [];
    // coat atlas: per-vertex (s, t) inside each face's patch, and the patch per face (null = flat colour);
    // coatK > 1 paints this part's patches coarser (parts only seen briefly, such as spread wings)
    this.uv = []; this.pt = []; this.coat = false; this.coatK = opt.coatK ?? 1;
  }
  get count() { return this.p.length / 3; }
  v(P, W) {
    this.p.push(P.x, P.y, P.z);
    const w = W || NO_W;
    for (let i = 0; i < 4; i++) { const e = w[i]; this.si.push(e ? e[0] : 0); this.sw.push(e ? e[1] : 0); }
  }
  tri(a, b, c, zone, wa, wb, wc, uv = null, patch = null) {
    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z, vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * cx + cy * cy + cz * cz < 1e-26) return;
    this.v(a, wa); this.v(b, wb || wa); this.v(c, wc || wa); this.z.push(zone);
    if (patch) { this.uv.push(uv[0], uv[1], uv[2], uv[3], uv[4], uv[5]); this.pt.push(patch); }
    else { this.uv.push(0, 0, 0, 0, 0, 0); this.pt.push(null); }
  }
}

/** Centripetal Catmull-Rom path, arc-length parameterised. */
export function makePath(points, closed = false) {
  const clean = [];
  for (const p of points) { const v = vec(p); if (!clean.length || v.distanceToSquared(clean[clean.length - 1]) > 1e-14) clean.push(v); }
  if (clean.length === 1) clean.push(clean[0].clone().add(V3(0, 0, 1e-4)));
  const c = clean.length === 2 && !closed ? new THREE.LineCurve3(clean[0], clean[1]) : new THREE.CatmullRomCurve3(clean, closed, 'centripetal');
  c.arcLengthDivisions = Math.max(200, clean.length * 48);
  return c;
}
/** Arc-length parameters (0..1) of each control point of a Catmull-Rom path. */
export function knotUs(curve, n) {
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
export function loft(o) {
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
    const s = u * len, sig = Math.max(len * 0.004, bendK * sizeAt(u)), acc = V3();
    for (let i = 0; i <= NF; i++) { const d = (fs[i] - s) / sig; if (d * d < 9) acc.addScaledVector(ft[i], Math.exp(-d * d)); }
    const t = acc.lengthSq() < 1e-12 ? raw : acc.normalize();
    // `level(u)` (0..1) stands a section upright, its tangent turned level along the path's heading: a body measured
    // as vertical slices keeps them so where the path rises into a steep neck
    const lv = o.level ? o.level(u) : 0;
    if (lv > 0) { const hz = V3(t.x, 0, t.z); if (hz.lengthSq() > 1e-12) t.lerp(hz.normalize(), lv).normalize(); }
    return t;
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
      // `sect` reshapes a section in its own plane (the torso's keeled chest, hanging belly and flat croup),
      // returning the new [side, up] offsets
      if (o.sect) [x, y] = o.sect(u, a, x, y, ht, hb);
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
export function emit(part, g, zone, skin) {
  const zf = typeof zone === 'function' ? zone : () => zone;
  const sf = typeof skin === 'function' ? skin : () => skin;
  const rows = g.rows, us = g.us, R = g.R, nr = rows.length;
  const Wt = rows.map((row, k) => row.map((P, j) => sf(us[k], (j / R) * TAU, P)));
  // a painted loft becomes a coat-atlas patch (see COAT ATLAS)
  const pt = part.coat && typeof zone === 'function' ? loftPatch(g, zf) : null, T = pt && pt.t, L0 = pt ? pt.lead : 0;
  // (herp rig: a loft may carry its own scale pattern for the atlas, `g.scales`; null = smooth skin)
  if (pt && g.scales !== undefined) pt.scales = g.scales;
  const ctr = V3();
  const kEnd = g.closed ? nr : nr - 1;
  for (let k = 0; k < kEnd; k++) {
    const k1 = (k + 1) % nr, um = g.closed && k1 === 0 ? (us[k] + 1) / 2 : (us[k] + us[k1]) / 2;
    const t0 = pt ? T[k + L0] : 0, t1 = pt ? T[k + 1 + L0] : 0;
    for (let j = 0; j < R; j++) {
      const j1 = (j + 1) % R, A = rows[k][j], B = rows[k1][j], Cc = rows[k1][j1], D = rows[k][j1], s0 = j / R, s1 = (j + 1) / R;
      ctr.copy(A).add(B).add(Cc).add(D).multiplyScalar(0.25);
      const zn = zf(um, ((j + 0.5) / R) * TAU, ctr);
      part.tri(A, Cc, B, zn, Wt[k][j], Wt[k1][j1], Wt[k1][j], pt && [s0, t0, s1, t1, s0, t1], pt);
      part.tri(A, D, Cc, zn, Wt[k][j], Wt[k][j1], Wt[k1][j1], pt && [s0, t0, s1, t0, s1, t1], pt);
    }
  }
  const fan = (tip, row, u, start, ws, tTip, tRow) => {
    const wt = sf(u, 0, tip);
    for (let j = 0; j < R; j++) {
      const j1 = (j + 1) % R, s0 = j / R, s1 = (j + 1) / R, sm = (j + 0.5) / R;
      ctr.copy(tip).add(row[j]).add(row[j1]).multiplyScalar(1 / 3);
      const zn = zf(u, ((j + 0.5) / R) * TAU, ctr);
      if (start) part.tri(tip, row[j1], row[j], zn, wt, ws[j1], ws[j], pt && [sm, tTip, s1, tRow, s0, tRow], pt);
      else part.tri(tip, row[j], row[j1], zn, wt, ws[j], ws[j1], pt && [sm, tTip, s0, tRow, s1, tRow], pt);
    }
  };
  if (!g.closed && g.tip0) fan(g.tip0, rows[0], us[0], true, Wt[0], pt ? T[0] : 0, pt ? T[L0] : 0);
  if (!g.closed && g.tip1) fan(g.tip1, rows[nr - 1], us[nr - 1], false, Wt[nr - 1], pt ? T[T.length - 1] : 0, pt ? T[nr - 1 + L0] : 0);
  return g;
}

/** Ellipsoid as a lofted body (cosine-spaced rings, closed poles). axis: direction of rz. */
export function ellipsoid(center, rx, ry, rz, axis = [0, 0, 1], up = [0, 1, 0], seg = 8, rad = 10, bump = null) {
  const c = vec(center), ax = vec(axis).normalize();
  const s = (u) => 2 * Math.sqrt(Math.max(0, u * (1 - u)));
  return loft({
    pts: [c.clone().addScaledVector(ax, -rz), c.clone().addScaledVector(ax, rz)], seg, rad, up,
    dist: (t) => (1 - Math.cos(Math.PI * t)) / 2, w: (u) => rx * s(u), ht: (u) => ry * s(u), hb: (u) => ry * s(u),
    cap0: 'open', cap1: 'open', bend: 0, antifold: false, bump,
  });
}
/** Tapered round tube through points. r: number | fn(u). */
export function tube(pts, r, seg = 10, rad = 6, o = {}) {
  const R = asFn(r, 0.01);
  return loft({ pts, seg, rad, w: R, ht: R, hb: R, cap0: o.cap0 ?? { type: 'round', len: 0.6, n: 2 }, cap1: o.cap1 ?? { type: 'round', len: 0.6, n: 2 }, up: o.up || [0, 1, 0], bend: o.bend ?? 0.5, ...o });
}

/**
 * Thickened parametric membrane (ears, fins, webs, wings, frills, feathers, sails).
 * f(u, v) → Vector3 on the mid-surface; th(u, v) total thickness. Front faces follow du × dv.
 */
export function sheet(part, o) {
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
  // a painted membrane becomes two coat-atlas patches, one per face
  const pF = part.coat && typeof o.zone === 'function' ? sheetPatch(F, zf, 1) : null, pB = pF && sheetPatch(B, zf, -1);
  if (pF && o.scales !== undefined) { pF.scales = o.scales; pB.scales = o.scales; }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const um = (i + 0.5) / nu, vm = (j + 0.5) / nv, zF = zf(um, vm, 1), zB = zf(um, vm, -1);
    const w = [Wt[i][j], Wt[i + 1][j], Wt[i + 1][j + 1], Wt[i][j + 1]];
    const sa = j / nv, sb = (j + 1) / nv, fa = pF ? pF.t[i] : 0, fb = pF ? pF.t[i + 1] : 0, ba = pB ? pB.t[i] : 0, bb = pB ? pB.t[i + 1] : 0;
    part.tri(F[i][j], F[i + 1][j], F[i + 1][j + 1], zF, w[0], w[1], w[2], pF && [sa, fa, sa, fb, sb, fb], pF);
    part.tri(F[i][j], F[i + 1][j + 1], F[i][j + 1], zF, w[0], w[2], w[3], pF && [sa, fa, sb, fb, sb, fa], pF);
    part.tri(B[i][j], B[i + 1][j + 1], B[i + 1][j], zB, w[0], w[2], w[1], pB && [sa, ba, sb, bb, sa, bb], pB);
    part.tri(B[i][j], B[i][j + 1], B[i + 1][j + 1], zB, w[0], w[3], w[2], pB && [sa, ba, sb, ba, sb, bb], pB);
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
export function basisFrom(fwd, upHint = [0, 1, 0]) {
  const f = vec(fwd).normalize();
  let u = vec(upHint); u.addScaledVector(f, -u.dot(f));
  if (u.lengthSq() < 1e-10) { u = Math.abs(f.y) < 0.9 ? V3(0, 1, 0) : V3(0, 0, 1); u.addScaledVector(f, -u.dot(f)); }
  u.normalize();
  const s = new THREE.Vector3().crossVectors(u, f).normalize();
  return { f, u, s };
}

/** Point on a loft surface whose direction from c best matches dir (coarse search + refinement). */
export function surfaceToward(g, c, dir, s0, s1) {
  let best = null, bd = -2;
  const test = (s, a) => { const r = g.at(s, a), d = r.p.clone().sub(c).normalize().dot(dir); if (d > bd) { bd = d; best = { ...r, s, a }; } };
  for (let i = 0; i <= 24; i++) for (let j = 0; j < 40; j++) test(lerp(s0, s1, i / 24), (j / 40) * TAU);
  const ds = (s1 - s0) / 24, da = TAU / 40, b0 = { ...best };
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) test(clamp(b0.s + i * ds / 3, s0, s1), b0.a + j * da / 3);
  return best;
}
/** Tapered cone spike from p along dir (spines, teeth, thorns, claws). */
export function spike(part, p, dir, h, r, zone, W, rad = 4) {
  const g = tube([p.clone().addScaledVector(dir, -h * 0.25), p.clone().addScaledVector(dir, h)], (u) => r * (1 - u), 2, rad, { cap0: 'flat', cap1: 'point', bend: 0 });
  emit(part, g, zone, W);
}

/* ── skeleton: rest bones carry identity rotation, so clip angles are world-aligned ── */
export class Rig {
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
export function normW(list) {
  const l = list.filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const tot = l.reduce((s, e) => s + e[1], 0) || 1;
  return l.map(e => [e[0], e[1] / tot]);
}
/** Blends two weight sets: (1-t)·A + t·B. */
export function mixW(A, B, t) {
  const m = new Map();
  for (const [i, w] of A) m.set(i, (m.get(i) || 0) + w * (1 - t));
  for (const [i, w] of B) m.set(i, (m.get(i) || 0) + w * t);
  return normW([...m.entries()]);
}

/* ── clips & poses: samples are { Bone: [rx, ry, rz] degrees | { r: [...], p: [dx, dy, dz] } } ── */
export const _e = new THREE.Euler(), _q = new THREE.Quaternion();
/** Bakes a clip from sample(u), 0..1, at `frames` even keys; with `refine`, also wherever the joints turn fast (see below). */
export function bakeClip(info, name, duration, frames, sample, loop = true, refine = false) {
  const times = [], samples = [];
  let us = Array.from({ length: frames }, (_, i) => i / (frames - 1)), ss = us.map(u => sample(loop ? u % 1 : u) || {});
  if (loop) ss[frames - 1] = ss[0];
  // A key half way between two keys wherever the joints turn so fast between them (a leg near full stretch at the end
  // of a gallop's stance can swing its thigh 22° in one key) that interpolating their rotations would move a planted
  // foot off its place; up to three times, so a fast stretch gets up to seven more keys.
  if (refine) {
    // intervals to check: every one at first, then only the halves of those just split
    let todo = us.slice(0, -1).map((_, i) => i);
    for (let pass = 0; pass < 3 && todo.length; pass++) {
      const add = [];
      for (const i of todo) { const m = (us[i] + us[i + 1]) / 2, sm = sample(loop ? m % 1 : m) || {}; if (sampleGap(info, ss[i], ss[i + 1], sm) > 1.5) add.push([i, m, sm]); }
      // insert from the end so the earlier indices stay valid, and list the two halves for the next pass
      const next = [];
      for (let k = add.length - 1; k >= 0; k--) { const [i, m, sm] = add[k]; us.splice(i + 1, 0, m); ss.splice(i + 1, 0, sm); }
      add.forEach(([i], k) => { const at = i + k; next.push(at, at + 1); });
      todo = next;
    }
  }
  for (let i = 0; i < us.length; i++) { times.push(us[i] * duration); samples.push(ss[i]); }
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
/** The most any bone's rotation in sample `m` differs (degrees) from half way between samples `a` and `b`. */
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qm = new THREE.Quaternion();
function sampleGap(info, a, b, m) {
  const quat = (s, n, q) => { const v = s[n], r = !v ? null : Array.isArray(v) ? v : v.r; _e.set((r ? r[0] : 0) * DEG, (r ? r[1] : 0) * DEG, (r ? r[2] : 0) * DEG, 'YXZ'); return q.setFromEuler(_e); };
  let worst = 0;
  for (const n of info.bones) { quat(a, n, _qa).slerp(quat(b, n, _qb), 0.5); worst = Math.max(worst, _qa.angleTo(quat(m, n, _qm)) / DEG); }
  return worst;
}
export function applySample(rig, sample) {
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
/* ════════════════════════════════════════════════════════════════════════════
 *  COAT ATLAS
 *  Every painted loft and membrane records its grid as a patch; finish() paints each patch into one texture per asset
 *  at an even texel size (adaptive sampling, softened edges and a faint coat grain on fur and feathers) and the
 *  triangles carry UVs into it, so stripes, spots, masks and patch edges are smooth curves rather than following the
 *  mesh grid. Parts with one constant colour keep plain vertex colours. Normals are smoothed across faces (keeping
 *  creases sharper than COAT_CREASE degrees).
 * ════════════════════════════════════════════════════════════════════════════ */
export const COAT_RES = { draft: 300, standard: 420, high: 560 }; // texels across the model's bounding diagonal
const COAT_PAD = 2, COAT_BLOCK = 4, COAT_CREASE = 62, COAT_MAX = 2048;

/** A paintable grid of points grid[row][col]; `wrap` closes the columns into rings (lofts). */
function makePatch(grid, wrap, zoneAt) {
  const K = grid.length - 1, J = wrap ? grid[0].length : grid[0].length - 1;
  const at = wrap ? (row, j) => row[j % row.length] : (row, j) => row[j];
  const t = [0];
  let len = 0, per = 0;
  for (let k = 1; k <= K; k++) {
    let d = 0;
    for (let j = 0; j <= (wrap ? J - 1 : J); j++) d += grid[k][j].distanceTo(grid[k - 1][j]);
    len += d / (wrap ? J : J + 1); t.push(len);
  }
  for (let k = 0; k <= K; k++) t[k] = len > 1e-12 ? t[k] / len : k / Math.max(1, K);
  for (let k = 0; k <= K; k++) { let p = 0; for (let j = 0; j < J; j++) p += at(grid[k], j + 1).distanceTo(grid[k][j]); per = Math.max(per, p); }
  return { grid, wrap, K, J, t, len, per, zoneAt, at };
}
/** Patch over a loft, its capped tips added as degenerate rows (`lead` = rows before the loft's own). */
function loftPatch(g, zf) {
  const R = g.R, rows = g.rows.slice(), us = g.us.slice();
  const lead = !g.closed && g.tip0 ? 1 : 0;
  if (lead) { rows.unshift(new Array(R).fill(g.tip0)); us.unshift(us[0]); }
  if (!g.closed && g.tip1) { rows.push(new Array(R).fill(g.tip1)); us.push(us[us.length - 1]); }
  if (g.closed) { rows.push(rows[0]); us.push(1); }
  const p = makePatch(rows, true, (s, k, f, P) => zf(lerp(us[k], us[k + 1], f), s * TAU, P));
  p.lead = lead;
  return p;
}
/** Patch over one face of a membrane (rows along u, columns along v). */
function sheetPatch(G, zf, face) {
  const nu = G.length - 1;
  return makePatch(G, false, (s, k, f, P) => zf((k + f) / nu, s, face, P));
}

/** Paints every patch used by `parts` into one atlas; returns the texture and each patch's tile. */
function paintAtlas(parts, cfg, hexOf) {
  const patches = [], seen = new Set();
  // (herp rig: `cfg.gloss` makes wet amphibian skin shinier; eyes are always glossy)
  for (const part of parts) for (const pt of part.pt) if (pt && !seen.has(pt)) { seen.add(pt); pt.k = part.coatK || 1; pt.gloss = part.name === 'eyes' ? 0.2 : (cfg.gloss ?? 1); patches.push(pt); }
  if (!patches.length) return null;
  const mn = V3(Infinity, Infinity, Infinity), mx = V3(-Infinity, -Infinity, -Infinity), q = V3();
  for (const part of parts) for (let i = 0; i < part.p.length; i += 3) { q.set(part.p[i], part.p[i + 1], part.p[i + 2]); mn.min(q); mx.max(q); }
  // texel size: from a reference length when the rig gives one (birds: the body, since the spread wings that
  // are hidden while perched would otherwise set it), else from the bounding diagonal
  const D = cfg.ref ?? Math.max(1e-6, mx.distanceTo(mn));
  let tau = D / (cfg.res || 420), AW = 256, AH = 0, place = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    let area = 0;
    for (const pt of patches) {
      pt.tw = clamp(Math.ceil(pt.per / (tau * pt.k)), 2, COAT_MAX - 2 * COAT_PAD);
      pt.th = clamp(Math.ceil(pt.len / (tau * pt.k)), 2, COAT_MAX - 2 * COAT_PAD);
      area += (pt.tw + 2 * COAT_PAD) * (pt.th + 2 * COAT_PAD);
    }
    AW = clamp(2 ** Math.ceil(Math.log2(Math.sqrt(area * 1.2) + 1)), 128, COAT_MAX);
    const items = [{ tw: 4, th: 4, white: true }, ...patches.slice().sort((a, b) => b.th - a.th)];
    let x = 0, y = 0, sh = 0;
    place = new Map();
    for (const it of items) {
      it.tw = Math.min(it.tw, AW - 2 * COAT_PAD);
      const W = it.tw + 2 * COAT_PAD, H = it.th + 2 * COAT_PAD;
      if (x + W > AW) { x = 0; y += sh; sh = 0; }
      place.set(it, { x: x + COAT_PAD, y: y + COAT_PAD, w: it.tw, h: it.th });
      x += W; sh = Math.max(sh, H);
    }
    AH = Math.ceil((y + sh) / 4) * 4;
    if (AH <= COAT_MAX) break;
    tau *= 1.3;
  }
  const data = new Uint8Array(AW * AH * 4).fill(255);
  const f1 = 1 / (tau * 2.4), f2 = 1 / (D * 0.045), grain = cfg.grain ?? 0.06;
  const cache = new Map();
  const shade = (z, P, out, o) => {
    let c = cache.get(z);
    if (!c) { const h = hexOf(z); c = [(h >> 16) & 255, (h >> 8) & 255, h & 255, cfg.grainOf && cfg.grainOf(z) ? 1 : 0]; cache.set(z, c); }
    let m = 1;
    if (c[3] && grain > 0) m = 1 + grain * ((0.6 * vnoise(P.x * f1, P.y * f1, P.z * f1 * 0.4, 17) + 0.4 * vnoise(P.x * f2, P.y * f2, P.z * f2, 29)) - 0.5) * 2;
    out[o] = c[0] * m; out[o + 1] = c[1] * m; out[o + 2] = c[2] * m;
  };
  for (const pt of patches) paintPatch(pt, place.get(pt), data, AW, shade, cfg.soft !== false, cfg.crease);
  let white = null;
  for (const [it, pl] of place) if (it.white) white = [(pl.x + 2) / AW, (pl.y + 2) / AH];
  const tex = new THREE.DataTexture(data, AW, AH, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.flipY = false;
  tex.name = 'coat-atlas';
  tex.needsUpdate = true;
  const tiles = new Map();
  for (const pt of patches) tiles.set(pt, place.get(pt));
  return { tex, tiles, AW, AH, white, texels: AW * AH };
}

/** Rasterises one patch's painter into its tile (lattice-sampled; uniform blocks skip the painter). */
/**
 * A periodic 2D net of creases (the cell edges of a jittered grid, Worley f2 - f1), exact and built once. paintPatch
 * draws it over a patch's texels for creased skin (`cfg.crease`: elephants): a patch's texels are laid out at an even
 * spacing over the surface, so the net needs no 3D noise per texel, only one read.
 */
const CREASE_TILE = 128, CREASE_CELLS = 10;
let CREASE2 = null;
function creaseTile() {
  if (CREASE2) return CREASE2;
  const N = CREASE_TILE, C = CREASE_CELLS, F = new Float32Array(N * N), wr = (i) => ((i % C) + C) % C;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const px = ((x + 0.5) / N) * C, py = ((y + 0.5) / N) * C, cx = Math.floor(px), cy = Math.floor(py);
    let f1 = 9, f2 = 9;
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
      const i = cx + dx, j = cy + dy, d = Math.hypot(i + 0.1 + 0.8 * hash3(wr(i), wr(j), 0, 81) - px, j + 0.1 + 0.8 * hash3(wr(i), wr(j), 0, 82) - py);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    F[y * N + x] = f2 - f1;
  }
  return (CREASE2 = F);
}

/**
 * Scales: a periodic tile of a staggered lattice of rounded scales (rows offset by half a scale, a little jittered),
 * storing for each texel its distance to the nearest scale's edge (f2 - f1) and to its centre (f1). paintPatch darkens
 * the seams between scales and lightens their crowns. `kind`: 'granular' (round beads: geckos, chameleons, Gila-like
 * lizards), 'keeled' (scales longer than wide, rows along the body: snakes, iguanas, most lizards), 'plates' (large
 * squarish shields: crocodilian backs, tortoise legs, snake bellies).
 */
const SCALE_TILE = 128;
const SCALE_TILES = new Map();
function scaleTile(kind) {
  if (SCALE_TILES.has(kind)) return SCALE_TILES.get(kind);
  const N = SCALE_TILE, C = kind === 'plates' ? 6 : 12, F = new Float32Array(N * N * 2);
  // (keeled scales are longer along the body, the patch's rows)
  const ax = kind === 'keeled' ? 0.72 : 1, jit = kind === 'granular' ? 0.22 : kind === 'plates' ? 0.08 : 0.1;
  const wr = (i) => ((i % C) + C) % C;
  // lattice point (i, j): column i, row j, odd rows shifted by half a column ('plates' are not staggered)
  const site = (i, j) => [i + 0.5 + (kind === 'plates' ? 0 : (wr(j) % 2) * 0.5) + jit * (hash3(wr(i), wr(j), 0, 91) - 0.5), j + 0.5 + jit * (hash3(wr(i), wr(j), 0, 92) - 0.5)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const px = ((x + 0.5) / N) * C, py = ((y + 0.5) / N) * C, cx = Math.floor(px), cy = Math.floor(py);
    let f1 = 9, f2 = 9;
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
      const [sx, sy] = site(cx + dx, cy + dy), ddx = sx - px, ddy = (sy - py) * ax;
      const d = kind === 'plates' ? Math.max(Math.abs(ddx), Math.abs(ddy)) : Math.hypot(ddx, ddy);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    F[(y * N + x) * 2] = f2 - f1; F[(y * N + x) * 2 + 1] = f1;
  }
  SCALE_TILES.set(kind, F);
  return F;
}

function paintPatch(pt, tile, data, AW, shade, soft, crease = null) {
  const { grid, K, J, t, at, zoneAt, wrap } = pt, { x: X0, y: Y0, w, h } = tile, A = Math.round(255 * (pt.gloss ?? 1));
  const rowK = new Int32Array(h), rowF = new Float32Array(h), colJ = new Int32Array(w), colF = new Float32Array(w);
  let k = 0;
  for (let y = 0; y < h; y++) {
    const tt = (y + 0.5) / h;
    while (k < K - 1 && t[k + 1] < tt) k++;
    rowK[y] = k; rowF[y] = clamp((tt - t[k]) / ((t[k + 1] - t[k]) || 1), 0, 1);
  }
  for (let x = 0; x < w; x++) { const c = ((x + 0.5) / w) * J, j = Math.min(J - 1, Math.floor(c)); colJ[x] = j; colF[x] = c - j; }
  const P = V3();
  const pos = (x, y) => {
    const r0 = grid[rowK[y]], r1 = grid[rowK[y] + 1], j = colJ[x], fs = colF[x], ft = rowF[y];
    const a = at(r0, j), b = at(r0, j + 1), c = at(r1, j), d = at(r1, j + 1);
    const w00 = (1 - fs) * (1 - ft), w10 = fs * (1 - ft), w01 = (1 - fs) * ft, w11 = fs * ft;
    P.set(a.x * w00 + b.x * w10 + c.x * w01 + d.x * w11, a.y * w00 + b.y * w10 + c.y * w01 + d.y * w11, a.z * w00 + b.z * w10 + c.z * w01 + d.z * w11);
  };
  const zoneOf = (x, y) => { pos(x, y); return zoneAt((x + 0.5) / w, rowK[y], rowF[y], P); };
  const B = COAT_BLOCK, cw = Math.ceil(w / B), ch = Math.ceil(h / B), lw = cw + 1;
  const lat = new Array(lw * (ch + 1));
  for (let cy = 0; cy <= ch; cy++) for (let cx = 0; cx <= cw; cx++) lat[cy * lw + cx] = zoneOf(Math.min(cx * B, w - 1), Math.min(cy * B, h - 1));
  const rgb = new Float32Array(w * h * 3);
  // creases (see creaseTile): cells about `crease.cell` texels across; round a loft a whole number of tiles, so the net
  // closes on itself; offset per patch
  let ct = null, sx = 1, sy = 1, ox = 0, oy = 0, cwid = 0, cdark = 1;
  // (herp rig: a patch may carry its own scale patterns, `pt.scales` (one set, or several each on its own zones), or none)
  const sc0 = pt.scales === undefined ? crease && crease.kind ? crease : null : pt.scales;
  const scs = (Array.isArray(sc0) ? sc0 : sc0 ? [sc0] : []).map((sc) => {
    const st = scaleTile(sc.kind), N = SCALE_TILE, C = sc.kind === 'plates' ? 6 : 12, s = (N / C) / sc.cell;
    return { sc, st, ssy: s * (sc.stretch ?? 1), ssx: wrap ? (N * Math.max(1, Math.round((w * s) / N))) / w : s };
  });
  if (crease && !crease.kind) {
    ct = creaseTile(); const N = CREASE_TILE, s = (N / CREASE_CELLS) / crease.cell;
    sy = s; sx = wrap ? (N * Math.max(1, Math.round((w * s) / N))) / w : s;
    ox = (pt.K * 37 + pt.J * 11) % N; oy = (pt.K * 13 + pt.J * 29) % N; cwid = crease.width; cdark = crease.dark;
  }
  for (let by = 0; by < ch; by++) for (let bx = 0; bx < cw; bx++) {
    const z = lat[by * lw + bx], uni = z === lat[by * lw + bx + 1] && z === lat[(by + 1) * lw + bx] && z === lat[(by + 1) * lw + bx + 1];
    for (let y = by * B; y < Math.min(h, by * B + B); y++) for (let x = bx * B; x < Math.min(w, bx * B + B); x++) {
      let zz = z;
      if (uni) pos(x, y); else zz = zoneOf(x, y);
      shade(zz, P, rgb, (y * w + x) * 3);
      if (ct && crease.zones.includes(zz) && ct[((Math.floor(y * sy) + oy) % CREASE_TILE) * CREASE_TILE + ((Math.floor(x * sx) + ox) % CREASE_TILE)] < cwid) {
        const o = (y * w + x) * 3; rgb[o] *= cdark; rgb[o + 1] *= cdark; rgb[o + 2] *= cdark;
      }
      for (const { sc, st, ssx, ssy } of scs) {
        if (sc.zones && !sc.zones.includes(zz)) continue;
        const i = (((Math.floor(y * ssy) + oy) % SCALE_TILE) * SCALE_TILE + ((Math.floor(x * ssx) + ox) % SCALE_TILE)) * 2;
        const e = st[i], c = st[i + 1], o = (y * w + x) * 3;
        // seams dark, crowns a little lighter
        const k = e < sc.width ? sc.dark : 1 + (sc.light ?? 0.08) * Math.max(0, 1 - c / 0.38);
        rgb[o] *= k; rgb[o + 1] *= k; rgb[o + 2] *= k;
        break;
      }
    }
  }
  if (soft && w > 2 && h > 2) {
    // a 1-2-1 blur softens zone edges by about a texel, like fur or feather margins
    const tmp = new Float32Array(rgb.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const xl = x > 0 ? x - 1 : wrap ? w - 1 : 0, xr = x < w - 1 ? x + 1 : wrap ? 0 : w - 1;
      for (let c = 0; c < 3; c++) tmp[(y * w + x) * 3 + c] = 0.25 * rgb[(y * w + xl) * 3 + c] + 0.5 * rgb[(y * w + x) * 3 + c] + 0.25 * rgb[(y * w + xr) * 3 + c];
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const yu = Math.max(0, y - 1), yd = Math.min(h - 1, y + 1);
      for (let c = 0; c < 3; c++) rgb[(y * w + x) * 3 + c] = 0.25 * tmp[(yu * w + x) * 3 + c] + 0.5 * tmp[(y * w + x) * 3 + c] + 0.25 * tmp[(yd * w + x) * 3 + c];
    }
  }
  for (let y = -COAT_PAD; y < h + COAT_PAD; y++) for (let x = -COAT_PAD; x < w + COAT_PAD; x++) {
    const sx = wrap ? ((x % w) + w) % w : clamp(x, 0, w - 1), sy = clamp(y, 0, h - 1);
    const si = (sy * w + sx) * 3, di = ((Y0 + y) * AW + (X0 + x)) * 4;
    data[di] = clamp(Math.round(rgb[si]), 0, 255); data[di + 1] = clamp(Math.round(rgb[si + 1]), 0, 255); data[di + 2] = clamp(Math.round(rgb[si + 2]), 0, 255); data[di + 3] = A;
  }
}

/**
 * Gloss rides in the coat texture's alpha and scales the material's roughness, so wet eyes catch a highlight
 * without a second material (or draw call). Opaque materials ignore the alpha otherwise. Clones keep the hook.
 */
function coatGloss(m) {
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n#ifdef USE_MAP\n\troughnessFactor *= texture2D( map, vMapUv ).a;\n#endif'); };
  m.customProgramCacheKey = () => 'coat-gloss';
  const clone = m.clone.bind(m);
  m.clone = () => coatGloss(clone());
  return m;
}

/** Smooth vertex normals for non-indexed triangles: faces meeting at a point share a normal unless they crease more than `deg`. */
function smoothNormals(geo, deg = COAT_CREASE) {
  const pos = geo.attributes.position.array, n = pos.length / 3;
  geo.computeBoundingBox();
  const bb = geo.boundingBox, eps = Math.max(1e-9, bb.max.distanceTo(bb.min) * 2e-6);
  // (vertices are grouped by their quantised position through an integer hash with chains; fn: each face's normal,
  // un: its unit normal, both stored in the slots of the face's first vertex)
  const fn = new Float32Array(n), un = new Float32Array(n), q = new Int32Array(n * 3), hs = new Int32Array(n), next = new Int32Array(n), head = new Map();
  for (let f = 0; f < n; f += 3) {
    const ax = pos[f * 3], ay = pos[f * 3 + 1], az = pos[f * 3 + 2];
    const ux = pos[f * 3 + 3] - ax, uy = pos[f * 3 + 4] - ay, uz = pos[f * 3 + 5] - az, vx = pos[f * 3 + 6] - ax, vy = pos[f * 3 + 7] - ay, vz = pos[f * 3 + 8] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
    fn[f] = nx; fn[f + 1] = ny; fn[f + 2] = nz; un[f] = nx / l; un[f + 1] = ny / l; un[f + 2] = nz / l;
  }
  for (let i = 0; i < n; i++) {
    const qx = Math.round(pos[i * 3] / eps), qy = Math.round(pos[i * 3 + 1] / eps), qz = Math.round(pos[i * 3 + 2] / eps);
    q[i * 3] = qx; q[i * 3 + 1] = qy; q[i * 3 + 2] = qz;
    const h = hs[i] = Math.imul(qx, 73856093) ^ Math.imul(qy, 19349663) ^ Math.imul(qz, 83492791), first = head.get(h);
    next[i] = first === undefined ? -1 : first; head.set(h, i);
  }
  const cosC = Math.cos(deg * DEG), nor = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const f = i - (i % 3), mx = un[f], my = un[f + 1], mz = un[f + 2], qx = q[i * 3], qy = q[i * 3 + 1], qz = q[i * 3 + 2];
    let sx = 0, sy = 0, sz = 0;
    for (let j = head.get(hs[i]); j !== -1; j = next[j]) {
      if (q[j * 3] !== qx || q[j * 3 + 1] !== qy || q[j * 3 + 2] !== qz) continue;
      const g = j - (j % 3);
      if (un[g] * mx + un[g + 1] * my + un[g + 2] * mz < cosC) continue;
      sx += fn[g]; sy += fn[g + 1]; sz += fn[g + 2];
    }
    const l = Math.hypot(sx, sy, sz);
    if (l > 1e-20) { nor[i * 3] = sx / l; nor[i * 3 + 1] = sy / l; nor[i * 3 + 2] = sz / l; } else { nor[i * 3] = mx; nor[i * 3 + 1] = my; nor[i * 3 + 2] = mz; }
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
}

/**
 * Blends normals across the seams where limbs leave the body. Body and legs are separate surfaces, so even where they
 * meet smoothly their normals jump and the join would shade as a hard crease. Each vertex of either surface that lies
 * within `radius` of the other bends its normal toward the nearest vertex of the other one (half way at contact, none
 * at the radius), so the shading runs on across the join.
 */
function blendSeamNormals(geoA, geoB, radius) {
  const pa = geoA.attributes.position.array, pb = geoB.attributes.position.array, na = geoA.attributes.normal.array, nb = geoB.attributes.normal.array;
  const inv = 1 / radius, r2 = radius * radius;
  const hk = (cx, cy, cz) => ((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) | 0;
  const boxOf = (p) => { const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { if (p[i + k] < b[k]) b[k] = p[i + k]; if (p[i + k] > b[k + 3]) b[k + 3] = p[i + k]; } return b; };
  const ba = boxOf(pa), bb = boxOf(pb);
  const inBox = (b, x, y, z) => x > b[0] - radius && x < b[3] + radius && y > b[1] - radius && y < b[4] + radius && z > b[2] - radius && z < b[5] + radius;
  // hash grid of one surface's vertices near the other surface's bounds
  const grid = (p, b) => { const m = new Map(); for (let i = 0; i < p.length; i += 3) { if (!inBox(b, p[i], p[i + 1], p[i + 2])) continue; const k = hk(Math.floor(p[i] * inv), Math.floor(p[i + 1] * inv), Math.floor(p[i + 2] * inv)); const l = m.get(k); if (l) l.push(i); else m.set(k, [i]); } return m; };
  const blend = (p, n, b, m, po, no) => {
    const out = n.slice(), memo = new Map();
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      if (!inBox(b, x, y, z)) continue;
      // non-indexed geometry repeats each position; search once per position
      const pk = `${x},${y},${z}`;
      let hit = memo.get(pk);
      if (hit === undefined) {
        let best = -1, bd = r2;
        const cx = Math.floor(x * inv), cy = Math.floor(y * inv), cz = Math.floor(z * inv);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          const l = m.get(hk(cx + dx, cy + dy, cz + dz)); if (!l) continue;
          for (const j of l) { const ex = po[j] - x, ey = po[j + 1] - y, ez = po[j + 2] - z, d = ex * ex + ey * ey + ez * ez; if (d < bd) { bd = d; best = j; } }
        }
        hit = best < 0 ? null : [best, Math.sqrt(bd)];
        memo.set(pk, hit);
      }
      if (!hit) continue;
      const [j, d] = hit;
      if (n[i] * no[j] + n[i + 1] * no[j + 1] + n[i + 2] * no[j + 2] < 0.2) continue;
      const w = 0.5 * (1 - d / radius) ** 2;
      const nx = n[i] * (1 - w) + no[j] * w, ny = n[i + 1] * (1 - w) + no[j + 1] * w, nz = n[i + 2] * (1 - w) + no[j + 2] * w, l = Math.hypot(nx, ny, nz) || 1;
      out[i] = nx / l; out[i + 1] = ny / l; out[i + 2] = nz / l;
    }
    return out;
  };
  const outA = blend(pa, na, bb, grid(pb, ba), pb, nb), outB = blend(pb, nb, ba, grid(pa, bb), pa, na);
  na.set(outA); nb.set(outB);
  geoA.attributes.normal.needsUpdate = true; geoB.attributes.normal.needsUpdate = true;
}

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82, metalness: 0.0, side: THREE.DoubleSide });
const GLASS_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });

/**
 * Converts accumulated parts into meshes.
 *   merge=true  → one mesh per material (1 solid + optional 1 glass draw call)
 *   merge=false → one selectable named mesh per anatomical part
 *   skinned     → SkinnedMesh bound to one shared skeleton (clips, poses, IK-ready)
 *   static      → pose baked into plain geometry, no skeleton
 */
export function finish(build, opt) {
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
  // painted patches go into one coat texture (see COAT ATLAS)
  const hexOfZone = (z) => { const al = opt.alias || {}; return zones[z] ?? zones[al[z]] ?? zones[al[al[z]]] ?? zones[Object.keys(zones)[0]]; };
  const coat = opt.coat ? paintAtlas(build.parts.filter(p => p.count > 0 && !p.glass), opt.coat, hexOfZone) : null;
  const smooth = !!(opt.coat && opt.coat.smooth !== false);
  const WHITE = new THREE.Color(1, 1, 1);
  const toGeo = (part) => {
    const n = part.count, geo = new THREE.BufferGeometry(), col = new Float32Array(n * 3);
    let pos = new Float32Array(part.p);
    const uv = coat && !part.glass ? new Float32Array(n * 2) : null;
    for (let t = 0; t < n / 3; t++) {
      const tile = uv && part.pt[t] ? coat.tiles.get(part.pt[t]) : null;
      const c = tile ? WHITE : colorOf(part.z[t]);
      for (let k = 0; k < 3; k++) {
        const o = (t * 3 + k) * 3; col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
        if (!uv) continue;
        const i = (t * 3 + k) * 2;
        if (tile) { uv[i] = (tile.x + part.uv[i] * tile.w) / coat.AW; uv[i + 1] = (tile.y + part.uv[i + 1] * tile.h) / coat.AH; }
        else { uv[i] = coat.white[0]; uv[i + 1] = coat.white[1]; }
      }
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
    if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (skinned) {
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(part.si, 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(part.sw, 4));
    }
    if (smooth && !part.glass) smoothNormals(geo); else geo.computeVertexNormals();
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
  let solid = MAT;
  if (coat || smooth) {
    solid = MAT.clone(); solid.flatShading = !smooth; solid.name = 'coat';
    if (coat) { solid.map = coat.tex; coatGloss(solid); }
  }
  // geometries per part, with normals blended across the body / limb seams (see blendSeamNormals)
  const geoOf = new Map(live.map(p => [p, toGeo(p)]));
  if (smooth && opt.seamRadius) {
    const body = live.find(p => p.name === 'body' && !p.glass);
    if (body) for (const p of live) if (/^leg-/.test(p.name) && !p.glass) blendSeamNormals(geoOf.get(body), geoOf.get(p), opt.seamRadius);
    // (other parts that meet along a shared row: the elephant's face and trunk, the skull where it meets the neck, so
    // the join behind the ears shades as one surface)
    for (const [a, b] of opt.seams || []) { const A = live.find(p => p.name === a && !p.glass), Bp = live.find(p => p.name === b && !p.glass); if (A && Bp) blendSeamNormals(geoOf.get(A), geoOf.get(Bp), opt.seamRadius * 0.5); }
  }
  for (const glass of [false, true]) {
    const list = live.filter(p => p.glass === glass);
    if (!list.length) continue;
    const mat = glass ? GLASS_MAT : solid;
    if (merge) {
      const geos = list.map(p => geoOf.get(p)), merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (geos.length > 1) geos.forEach(g => g.dispose());
      if (!merged) continue;
      merged.computeBoundingBox(); merged.computeBoundingSphere();
      root.add(meshOf(merged, mat, glass ? 'glass' : 'solid', { merged: true, parts: list.map(p => p.name) }));
    } else {
      const used = new Map();
      for (const p of list) {
        const k = used.get(p.name) || 0; used.set(p.name, k + 1);
        root.add(meshOf(geoOf.get(p), mat, k ? `${p.name}-${k + 1}` : p.name, { part: p.name, group: p.group, glass }));
      }
    }
  }
  if (!skinned) root.remove(armature);
  root.updateMatrixWorld(true);
  return { root, skeleton: skinned ? skeleton : null };
}

/** Bounding dimensions of a finished asset as posed (meters); skinned meshes are measured through their bones. */
export function measure(root) {
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
export const COLORWAY_KEYS = Object.keys(SCHEMES);
export const DETAIL = { draft: 0.6, standard: 1, high: 1.55 };

/* ── posing helpers (bird and herp rigs): easing, two-bone IK, frames and quaternions ── */
export const smooth01 = (t) => t * t * (3 - 2 * t);

/**
 * A two-bone limb solved in model space: shoulder S, target T for the end of the second bone, lengths la and lb, and a pole
 * direction p (where the middle joint should point). Returns the middle joint.
 */
export function twoBone(S, T, la, lb, pole) {
  const d0 = T.clone().sub(S), dist = clamp(d0.length(), Math.abs(la - lb) + 1e-6, la + lb - 1e-6), dir = d0.normalize();
  const x = (la * la - lb * lb + dist * dist) / (2 * dist), y = Math.sqrt(Math.max(0, la * la - x * x));
  const perp = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (perp.lengthSq() < 1e-12) perp.set(0, 1, 0).addScaledVector(dir, -dir.y);
  perp.normalize();
  return S.clone().addScaledVector(dir, x).addScaledVector(perp, y);
}
/** Rotation taking the frame (a0, n0) onto (a1, n1): a = bone direction, n = bend-plane normal (both re-orthogonalised). */
const _m0 = new THREE.Matrix4(), _m1 = new THREE.Matrix4();
export function frameRot(a0, n0, a1, n1) {
  const f = (a, n, m) => {
    const x = a.clone().normalize(), z = n.clone().addScaledVector(x, -n.dot(x));
    if (z.lengthSq() < 1e-12) z.copy(Math.abs(x.y) < 0.9 ? V3(0, 1, 0) : V3(1, 0, 0)).addScaledVector(x, -(Math.abs(x.y) < 0.9 ? x.y : x.x));
    z.normalize();
    const y = new THREE.Vector3().crossVectors(z, x);
    return m.makeBasis(x, y, z);
  };
  f(a0, n0, _m0); f(a1, n1, _m1);
  return new THREE.Quaternion().setFromRotationMatrix(_m1.multiply(_m0.invert()));
}
const _eu = new THREE.Euler();
/** Quaternion → sample angles in degrees (Euler YXZ, as bakeClip and applySample read them). */
export const qDeg = (q) => { _eu.setFromQuaternion(q, 'YXZ'); return [_eu.x / DEG, _eu.y / DEG, _eu.z / DEG]; };
export const degQ = (r) => new THREE.Quaternion().setFromEuler(_eu.set((r ? r[0] : 0) * DEG, (r ? r[1] : 0) * DEG, (r ? r[2] : 0) * DEG, 'YXZ'));
/** A rest point carried by one bone in a sample (model space). */
export const posed = (info, fk, bone, P) => { const b = fk(bone); return P.clone().sub(info.headV[bone]).applyQuaternion(b.q).add(b.p); };
/** Sets a bone's local rotation in a sample so that its world rotation becomes qW. */
export function setWorld(info, s, fk, bone, qW) {
  const par = info.parent[bone], qP = par ? fk(par).q : new THREE.Quaternion();
  const v = s[bone], loc = qP.clone().invert().multiply(qW), r = qDeg(loc);
  if (v && !Array.isArray(v)) v.r = r; else s[bone] = r;
}
export const setPos = (s, b, p) => { const v = s[b]; if (!v) s[b] = { r: [0, 0, 0], p }; else if (Array.isArray(v)) s[b] = { r: v, p }; else v.p = p; };

/* ════════════════════════════════════════════════════════════════════════════
 *  BIRD BODY PLAN
 *  One surface runs from the tail base along the torso, up the neck and out to the bill base, through sections taken
 *  from the family's measured outline (torso as fractions of its length L, neck and skull as fractions of the head's
 *  width), so the body, neck and head are one skin with no seams; the bill grows from the face. The folded wing lies on
 *  the flank as a feathered blade whose primaries reach back over the tail; the spread wing (shown only in flight) is
 *  a planform of coverts, secondaries and primaries on the arm and hand bones; the tail is a fan of rectrices; the
 *  legs are the feathered drumstick, the scaly tarsus and toes arranged by foot type.
 *  Skeleton: Root > Hips > Chest > Neck1 > Neck2 > Head > Jaw; Chest > WingL/R > Humerus > Forearm > Hand;
 *  Chest > WingFoldL/R; Hips > Tail; Hips > Thigh > Shin > Tarsus > Toe (L/R).
 * ════════════════════════════════════════════════════════════════════════════ */
export const SIDES = [[1, 'L'], [-1, 'R']];

export function bindModule({ BASE, ZONE_ROLES, params: paramsOf }) {
  const ZONE_KEYS = Object.keys(BASE);

  /** Each zone receives a unique hex so colour pickers and zone splitters can always isolate it. */
  function zonesFor(name, overrides = {}, natural = BASE) {
    const sch = (SCHEMES[name] || SCHEMES.natural).fn, used = new Set(), out = {};
    for (const k of ZONE_KEYS) {
      const user = hexOf(overrides[k]), dflt = user !== null && paramsOf()[k] ? hexOf(paramsOf()[k].default) : null;
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
    for (const [k, s] of Object.entries(paramsOf())) {
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
  return { ZONE_KEYS, zonesFor, colorwaysFor, normalize, withZones };
}
