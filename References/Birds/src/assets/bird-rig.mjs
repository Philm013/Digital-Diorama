/*
 * BIRD RIG — procedural, skinned birds for three.js (Digital Diorama revision 11: rewritten from scratch)
 * Every bird is laid out from field-guide measurements of an adult — total length, wingspan, wing chord, tail, tarsus,
 * bill length and depth, head width and the neck as carried — and its family's measured outline. Body, neck and head
 * are one continuous skin; the bill grows from the face; the folded wing lies on the flank as a feathered blade whose
 * primaries reach over the tail, and a spread wing (coverts, secondaries, primaries, slotted fingers) replaces it in
 * flight; the tail is a fan of rectrices; legs and toes follow the foot type. Plumage is painted by region (crown,
 * nape, mantle, rump, throat, breast, belly, flank, cheek, lores, mask, collar) and feather tract (coverts, wing bars,
 * speculum, secondaries, primaries) into one texture. Posture comes from the legs: the torso hangs from the hips at the
 * species' pitch; where it would reach the ground the legs straighten, and only then does it tilt less (a penguin sits
 * back on its tail instead). Tails fold like a roof (flat on most birds, nearly upright on a rooster) and grow from
 * their coverts; long tails rest their tips on the ground.
 *
 * QUICK START
 *   import { createAsset, createClips } from './bird-rig.mjs';
 *   const owl = createAsset({ species: 'owl', mergeForProduction: true });
 *   scene.add(owl);
 *   const mixer = new THREE.AnimationMixer(owl);
 *   mixer.clipAction(createClips(owl).find(c => c.name === 'perch')).play();
 *
 * SPECIES  37: sparrow, robin, american-robin, blue-jay, crow, cardinal, pigeon, mourning-dove, woodpecker,
 *          downy-woodpecker, kingfisher, macaw, cockatoo, owl, barn-owl, eagle, falcon, flamingo, heron, crane, spoonbill,
 *          stilt, swan, duck, puffin, penguin, ostrich, kiwi, turkey, rooster, peacock, hummingbird, pelican, toucan,
 *          hornbill, albatross, seagull.
 * RIG      Root > Hips > Chest > Neck1 > Neck2 > Head > Jaw; Chest > WingL/R > Humerus > Forearm > Hand;
 *          Chest > WingFoldL/R; Hips > Tail; Hips > Thigh > Shin > Tarsus > Toe (L/R).
 * CLIPS    perch (idle: saccadic head turns), walk (planted feet; head-bobbing pigeons, doves and fowl), hop, peck,
 *          alert, flap, glide. The walk carries userData { gait, stride, speed, hipH }. createClips(asset),
 *          setPose(asset, name, phase).
 * OPTIONS  species, size, leg / neck / bill / tail length, head size, wingspan, colourway, painted plumage, feather
 *          grain, seed, detail, rig mode, pose, shading, hide parts; specOverride deep-merges changes onto the species
 *          preset (measurements M, palette, plume, bill, eye, wing, tail, extras).
 * TEST     node tools/test-bird-rig.mjs — every species in every pose above the ground, clips, planted walk feet.
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
/**
 * Cellular (Worley) noise: [nearest, second nearest] feature distances. (Digital Diorama revision 8: the home cell is
 * searched first and a neighbouring cell is skipped when even its nearest corner is no closer than the second-nearest
 * point found so far; the same result, about twice as fast.)
 */
const WORLEY_ORDER = [0, -1, 1];
function worley(x, y, z, s = 0) {
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
    const s = u * len, sig = Math.max(len * 0.004, bendK * sizeAt(u)), acc = V3();
    for (let i = 0; i <= NF; i++) { const d = (fs[i] - s) / sig; if (d * d < 9) acc.addScaledVector(ft[i], Math.exp(-d * d)); }
    const t = acc.lengthSq() < 1e-12 ? raw : acc.normalize();
    // Digital Diorama revision 10: `level(u)` (0..1) stands a section upright, its tangent turned level along the
    // path's heading: a body measured as vertical slices keeps them so where the path rises into a steep neck
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
      // Digital Diorama extension: `sect` reshapes a section in its own plane (the torso's keeled chest,
      // hanging belly and flat croup), returning the new [side, up] offsets
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
function emit(part, g, zone, skin) {
  const zf = typeof zone === 'function' ? zone : () => zone;
  const sf = typeof skin === 'function' ? skin : () => skin;
  const rows = g.rows, us = g.us, R = g.R, nr = rows.length;
  const Wt = rows.map((row, k) => row.map((P, j) => sf(us[k], (j / R) * TAU, P)));
  // Digital Diorama revision: a painted loft becomes a coat-atlas patch (see COAT ATLAS)
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
  // Digital Diorama revision: a painted membrane becomes two coat-atlas patches, one per face
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
/** Bakes a clip from sample(u), 0..1, at `frames` even keys; with `refine`, also wherever the joints turn fast (see below). */
function bakeClip(info, name, duration, frames, sample, loop = true, refine = false) {
  const times = [], samples = [];
  let us = Array.from({ length: frames }, (_, i) => i / (frames - 1)), ss = us.map(u => sample(loop ? u % 1 : u) || {});
  if (loop) ss[frames - 1] = ss[0];
  // Digital Diorama revision 8: a key half way between two keys wherever the joints turn so fast between them (a leg near
  // full stretch at the end of a gallop's stance swung its thigh 22° in one key) that interpolating their rotations moves
  // a planted foot off its place (a giraffe's sank 2 cm); up to three times, so a fast stretch gets up to seven keys more
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
/* ════════════════════════════════════════════════════════════════════════════
 *  COAT ATLAS  (Digital Diorama revision — shared verbatim by the mammal and bird rigs)
 *  Painters used to be sampled once per quad, so stripes, spots, masks and patch
 *  edges followed the mesh grid in staircases. Every painted loft and membrane now
 *  records its grid as a patch; finish() paints each patch into one texture per
 *  asset at an even texel size (adaptive sampling, softened edges and a faint coat
 *  grain on fur and feathers) and the triangles carry UVs into it. Parts with one
 *  constant colour keep plain vertex colours. Normals are smoothed across faces
 *  (keeping creases sharper than COAT_CREASE degrees).
 * ════════════════════════════════════════════════════════════════════════════ */
const COAT_RES = { draft: 300, standard: 420, high: 560 }; // texels across the model's bounding diagonal
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
 * Digital Diorama revision 8: a periodic 2D net of creases (the cell edges of a jittered grid, Worley f2 - f1), exact and
 * built once. paintPatch draws it over a patch's texels for creased skin (`cfg.crease`: elephants): a patch's texels are
 * laid out at an even spacing over the surface, so the net needs no 3D noise per texel, only one read.
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
 * Digital Diorama revision 10 (herp rig): scales. A periodic tile of a staggered lattice of rounded scales (rows offset by
 * half a scale, a little jittered), storing for each texel its distance to the nearest scale's edge (f2 - f1) and to its
 * centre (f1). paintPatch darkens the seams between scales and lightens their crowns. `kind`: 'granular' (round beads:
 * geckos, chameleons, Gila-like lizards), 'keeled' (scales longer than wide, rows along the body: snakes, iguanas, most
 * lizards), 'plates' (large squarish shields: crocodilian backs, tortoise legs, snake bellies).
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
  // (Digital Diorama revision 8: vertices are grouped by their quantised position through an integer hash with chains,
  // not string keys; the same groups, about three times faster. fn: each face's normal, un: its unit normal, both
  // stored in the slots of the face's first vertex)
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
 * Digital Diorama revision 5: blends normals across the seams where limbs leave the body. Body and legs are
 * separate surfaces, so even where they meet smoothly their normals jump and the join shades as a hard crease.
 * Each vertex of either surface that lies within `radius` of the other bends its normal toward the nearest
 * vertex of the other one (half way at contact, none at the radius), so the shading runs on across the join.
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
  // Digital Diorama revision: painted patches go into one coat texture (see COAT ATLAS)
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
    // (Digital Diorama revision 8: other parts that meet along a shared row, such as the elephant's face and trunk;
    // revision 9: the skull where it meets the neck, so the join behind the ears shades as one surface)
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
 *  BIRD RIG — +Z forward, +Y up, the bird's left = +X, ground at y = 0. Every species is laid out from field-guide
 *  measurements of an adult (cm; see SPECIES): the torso, head, bill, legs, tail and wings in true proportion.
 * ════════════════════════════════════════════════════════════════════════════ */
const BASE = {
  body: '#7a6a52', belly: '#e8e0d0', wing: '#6a5a44', flight: '#3e3428', head: '#7a6a52', face: '#e8e0d0', accent: '#c8a040',
  beak: '#3a3530', jaw: '#3a3530', leg: '#c49a7a', eye: '#1a120a', pupil: '#050505',
};
const ZONE_KEYS = Object.keys(BASE);
const ZONE_ROLES = { body: 'body', belly: 'body', wing: 'body', flight: 'body', head: 'body', face: 'body', accent: 'body', beak: 'keratin', jaw: 'keratin', leg: 'keratin', eye: 'eye', pupil: 'pupil' };
const ZONE_LABELS = { body: 'Back / mantle', belly: 'Belly / underparts', wing: 'Wing coverts', flight: 'Flight & tail feathers', head: 'Head / crown', face: 'Face / throat / mask', accent: 'Accent (crest, comb, breast, patches)', beak: 'Bill / claws', jaw: 'Lower mandible', leg: 'Legs / feet', eye: 'Iris', pupil: 'Pupil' };
const pal = (o) => ({ ...BASE, jaw: o.beak ?? BASE.jaw, ...o });

/* ── small vector helpers ── */
const X = (v) => V3(v[0], v[1], v[2]);
const smooth01 = (t) => t * t * (3 - 2 * t);
const along = (a, b, t) => a.clone().lerp(b, t);

/**
 * A two-bone limb solved in model space: shoulder S, target T for the end of the second bone, lengths la and lb, and a pole
 * direction p (where the middle joint should point). Returns the middle joint.
 */
function twoBone(S, T, la, lb, pole) {
  const d0 = T.clone().sub(S), dist = clamp(d0.length(), Math.abs(la - lb) + 1e-6, la + lb - 1e-6), dir = d0.normalize();
  const x = (la * la - lb * lb + dist * dist) / (2 * dist), y = Math.sqrt(Math.max(0, la * la - x * x));
  const perp = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (perp.lengthSq() < 1e-12) perp.set(0, 1, 0).addScaledVector(dir, -dir.y);
  perp.normalize();
  return S.clone().addScaledVector(dir, x).addScaledVector(perp, y);
}
/** Rotation taking the frame (a0, n0) onto (a1, n1): a = bone direction, n = bend-plane normal (both re-orthogonalised). */
const _m0 = new THREE.Matrix4(), _m1 = new THREE.Matrix4();
function frameRot(a0, n0, a1, n1) {
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
const qDeg = (q) => { _eu.setFromQuaternion(q, 'YXZ'); return [_eu.x / DEG, _eu.y / DEG, _eu.z / DEG]; };
const degQ = (r) => new THREE.Quaternion().setFromEuler(_eu.set((r ? r[0] : 0) * DEG, (r ? r[1] : 0) * DEG, (r ? r[2] : 0) * DEG, 'YXZ'));

/**
 * Forward kinematics of a sample: world rotation and world head position of every bone (rest bones carry identity rotation,
 * so a bone's world rotation is the product of its chain's local rotations). Memoised per bone.
 */
function fkOf(info, s) {
  const memo = new Map();
  const get = (name) => {
    if (memo.has(name)) return memo.get(name);
    const par = info.parent[name], v = s[name], r = !v ? null : Array.isArray(v) ? v : v.r, p = v && !Array.isArray(v) ? v.p : null;
    const qL = degQ(r), rest = info.rest[name];
    let out;
    if (!par) out = { q: qL, p: V3(rest[0] + (p ? p[0] : 0), rest[1] + (p ? p[1] : 0), rest[2] + (p ? p[2] : 0)) };
    else {
      const P = get(par), off = V3(rest[0] + (p ? p[0] : 0), rest[1] + (p ? p[1] : 0), rest[2] + (p ? p[2] : 0)).applyQuaternion(P.q);
      out = { q: P.q.clone().multiply(qL), p: P.p.clone().add(off) };
    }
    memo.set(name, out);
    return out;
  };
  return get;
}
/** A rest point carried by one bone in a sample (model space). */
const posed = (info, fk, bone, P) => { const b = fk(bone); return P.clone().sub(info.headV[bone]).applyQuaternion(b.q).add(b.p); };
/** Sets a bone's local rotation in a sample so that its world rotation becomes qW. */
function setWorld(info, s, fk, bone, qW) {
  const par = info.parent[bone], qP = par ? fk(par).q : new THREE.Quaternion();
  const v = s[bone], loc = qP.clone().invert().multiply(qW), r = qDeg(loc);
  if (v && !Array.isArray(v)) v.r = r; else s[bone] = r;
}
const addRot = (s, b, r) => { const v = s[b]; if (!v) s[b] = r.slice(); else if (Array.isArray(v)) { v[0] += r[0]; v[1] += r[1]; v[2] += r[2]; } else { v.r = v.r || [0, 0, 0]; v.r[0] += r[0]; v.r[1] += r[1]; v.r[2] += r[2]; } };
const setPos = (s, b, p) => { const v = s[b]; if (!v) s[b] = { r: [0, 0, 0], p }; else if (Array.isArray(v)) s[b] = { r: v, p }; else v.p = p; };

/** Deep merge of plain objects (arrays and functions are replaced, not merged). */
function mergeDeep(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) out[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? mergeDeep(a[k], v) : v;
  return out;
}

/* ════════════════════════════════════════════════════════════════════════════
 *  PLUMAGE — the surface is divided into the regions a field guide names (crown, forehead, nape, mantle, rump, throat,
 *  breast, belly, flank, vent, cheek, lores, the mask through the eye, collar), the folded wing into its feather tracts
 *  (scapulars, coverts with their wing bars, the speculum, secondaries and tertials, primaries) and the tail into its
 *  rectrices; each species says which zone colours each region and adds marks (streaks, bars, spots, scaling, edging).
 * ════════════════════════════════════════════════════════════════════════════ */
function makeBirdPainter(S, L) {
  const Pl = S.plume || {}, seed = (S.seed ?? 7) + 11;
  const R = { crown: 'head', forehead: null, nape: 'head', mantle: 'body', rump: 'body', throat: 'face', foreneck: null, breast: 'belly', belly: 'belly', flank: null, vent: null, cheek: 'head', lores: null, neckSide: null, thigh: null, uppertail: null, undertail: null, ...(Pl.regions || {}) };
  const reg = (k) => R[k] ?? (k === 'forehead' ? R.crown : k === 'foreneck' ? R.throat : k === 'flank' ? R.belly : k === 'vent' ? R.belly : k === 'lores' ? R.cheek : k === 'neckSide' ? R.nape : k === 'thigh' ? R.belly : 'body');
  const marks = Pl.marks || [];
  const mark = (region, z0, P) => {
    if (!P || !marks.length) return z0;
    const q = P.clone().divideScalar(L.Lt);
    for (const m of marks) {
      if (m.on && !m.on.includes(region)) continue;
      const f = m.f ?? 8, w = m.w ?? 0.2;
      let hit = false;
      switch (m.type) {
        case 'streaks': { const [d] = worley(q.x * f, q.y * f * 1.6, q.z * f * 0.35, seed + 1); hit = d < w; break; }
        case 'bars': { const n = vnoise(q.x * 3, q.y * 3, q.z * 3, seed + 2) - 0.5; hit = Math.cos(TAU * (q.y * f + n * 0.4 + (m.slant ?? 0) * q.z * f)) > 1 - 2 * w; break; }
        case 'spots': { const [d] = worley(q.x * f, q.y * f, q.z * f, seed + 3); hit = d < w; break; }
        case 'scaled': { const [d1, d2] = worley(q.x * f, q.y * f * 1.4, q.z * f, seed + 4); hit = d2 - d1 < w; break; }
        case 'speckle': hit = hash3(Math.floor(q.x * f), Math.floor(q.y * f), Math.floor(q.z * f), seed + 5) < w; break;
        case 'mottle': hit = fbm(q.x * f, q.y * f, q.z * f, seed + 6, 3) > 1 - w; break;
        default: break;
      }
      if (hit) return m.zone;
    }
    return z0;
  };
  // head coordinates: u along the head (occiput 0 → bill base 1), r up and x out (× head width)
  const eye = L.eyes && L.eyes[0];
  return (c) => {
    const part = c.part, P = c.P;
    switch (part) {
      case 'head': {
        const d = P.clone().sub(L.O), hu = d.dot(L.hd) / L.Hl, r = d.dot(L.hu) / L.Hw, x = Math.abs(d.dot(L.hside)) / L.Hw;
        const up = Math.sin(c.a);
        const eR = eye ? eye.c.clone().sub(L.O).dot(L.hu) / L.Hw : 0.1, eU = eye ? eye.c.clone().sub(L.O).dot(L.hd) / L.Hl : 0.55;
        // the facial disc (owls): the flat front of the face seen head-on, an ellipse round both eyes edged by a dark rim
        if (Pl.disc && hu > (Pl.disc.u0 ?? 0.6)) {
          const dd = Math.hypot(x / (Pl.disc.wx ?? 0.5), (r - (Pl.disc.cy ?? -0.02)) / (Pl.disc.ry ?? 0.5) * (r > (Pl.disc.cy ?? -0.02) ? 1 + (Pl.disc.heart ?? 0) * (1 - x / (Pl.disc.wx ?? 0.5)) : 1));
          if (dd < 1) return dd > (Pl.disc.rimAt ?? 0.86) ? (Pl.disc.rim ?? 'accent') : (Pl.disc.zone ?? 'face');
        }
        if (Pl.mask && Math.abs(r - eR - (Pl.mask.dy ?? 0)) < (Pl.mask.w ?? 0.12) && hu > (Pl.mask.from ?? 0.15) && x > 0.15) return Pl.mask.zone;
        if (Pl.eyebrow && r > eR + 0.08 && r < eR + 0.08 + Pl.eyebrow.w && x > 0.2 && hu > 0.15) return Pl.eyebrow.zone;
        let z;
        if (up < -(Pl.throatUp ?? 0.4)) z = reg('throat');
        else if (up > 0.5) z = hu > 0.82 ? reg('forehead') : reg('crown');
        else if (hu > eU + 0.05 && Math.abs(r - eR) < 0.12) z = reg('lores');
        else if (r < eR - 0.04) z = reg('cheek');
        else z = Pl.headSide ?? reg('crown');
        if (Pl.malar && r < eR - 0.12 && r > eR - 0.12 - Pl.malar.w && x > 0.2 && hu > 0.3) z = Pl.malar.zone;
        return mark('head', z, P);
      }
      case 'neck': {
        const up = Math.sin(c.a);
        if (Pl.collar && Math.abs(c.s - Pl.collar.at) < Pl.collar.w && (Pl.collar.full || up > -0.3)) return Pl.collar.zone;
        const rg = up > 0.15 ? 'nape' : up < -0.15 ? 'foreneck' : 'neckSide';
        return mark(rg, reg(rg), P);
      }
      case 'torso': {
        const up = Math.sin(c.a), s = c.s;
        let rg;
        if (up > (Pl.backUp ?? 0.15)) rg = s < 0.25 ? 'rump' : 'mantle';
        else if (up < -0.25) rg = s > 0.62 ? 'breast' : s < 0.18 ? 'vent' : 'belly';
        else rg = s > 0.66 && Pl.breastWide !== false ? 'breast' : 'flank';
        if (Pl.bib && rg === 'breast' && s > 1 - Pl.bib.len) return Pl.bib.zone;
        return mark(rg, reg(rg), P);
      }
      case 'coverts': {
        // the tail coverts: the rump's colour above and the vent's below unless the species says otherwise
        const rg = Math.sin(c.a) > -0.1 ? 'uppertail' : 'undertail';
        return mark(rg, R[rg] ?? reg(rg === 'uppertail' ? 'rump' : 'vent'), P);
      }
      case 'thigh': return mark('thigh', reg('thigh'), P);
      case 'fold': {
        const u = c.u, v = c.v;
        if (c.face === -1) return Pl.underwing ?? 'wing';
        if (u < 0.5 && v < 0.2) return Pl.scapulars ?? reg('mantle');
        for (const b of Pl.wingbars || []) if (Math.abs(u - b.at) < (b.w ?? 0.035) && v < 0.85) return b.zone;
        if (Pl.speculum && u > Pl.speculum.from && u < Pl.speculum.to && v > 0.4) return Pl.speculum.zone;
        let z = u < 0.42 ? (Pl.coverts ?? 'wing') : u < 0.62 ? (Pl.secondaries ?? 'flight') : (Pl.primaries ?? 'flight');
        if (Pl.wingTip && u > Pl.wingTip.from) z = Pl.wingTip.zone;
        if (Pl.edged && u > 0.2 && fract(u * (u < 0.42 ? 9 : 13) + v * 0.3) < 0.16) z = Pl.edged;
        if (Pl.wingSpots && u < 0.6 && Math.cos(TAU * u * 10) > 0.55 && Math.cos(TAU * v * 5) > 0.5) z = Pl.wingSpots;
        return z;
      }
      case 'wing': {
        const u = c.u, v = c.v;
        if (c.face < 0) return v < 0.4 ? (Pl.underwing ?? reg('belly')) : (Pl.underFlight ?? 'flight');
        if (Pl.wingTip && u > Pl.wingTip.spread) return Pl.wingTip.zone;
        if (Pl.speculum && u > 0.25 && u < 0.5 && v > 0.55) return Pl.speculum.zone;
        return v < 0.36 ? (Pl.coverts ?? 'wing') : u > 0.62 ? (Pl.primaries ?? 'flight') : (Pl.secondaries ?? 'flight');
      }
      case 'tail': {
        const u = c.u, at = Math.abs(c.t ?? 0) * 2;
        if (c.face === -1 && Pl.underTail) return Pl.underTail;
        if (Pl.tailTip && u > 1 - Pl.tailTip.w) return Pl.tailTip.zone;
        if (Pl.tailOuter && at > Pl.tailOuter.from) return Pl.tailOuter.zone;
        if (Pl.tailBars && Math.cos(TAU * u * Pl.tailBars.n) > 1 - 2 * (Pl.tailBars.w ?? 0.2)) return Pl.tailBars.zone;
        return Pl.tail ?? 'flight';
      }
      default: return 'body';
    }
  };
}

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
const SIDES = [[1, 'L'], [-1, 'R']];

/** Bill shapes: depth d(u) and width w(u) along the bill (0 base → 1 tip, × its base depth / width), the culmen's drop
 *  curve(u) (× bill length), the lower mandible's share of the depth (lowK) and length (lowLen), and the tip. */
const BILLS = {
  cone: { d: (u) => (1 - u) ** 0.85, w: (u) => (1 - u) ** 0.9, curve: (u) => 0.04 * u * u, lowK: 0.46, lowLen: 0.97, tip: 'point' },
  thin: { d: (u) => (1 - u) ** 0.7 * (1 - 0.25 * u), w: (u) => (1 - u) ** 0.75, curve: (u) => 0.05 * u ** 3, lowK: 0.42, lowLen: 0.97, tip: 'point' },
  corvid: { d: (u) => (1 - u) ** 0.8, w: (u) => (1 - u) ** 0.85, curve: (u) => 0.08 * u * u, lowK: 0.42, lowLen: 0.95, tip: 'point' },
  dagger: { d: (u) => (1 - u) ** 0.85, w: (u) => (1 - u) ** 0.9, curve: () => 0, lowK: 0.48, lowLen: 1.0, tip: 'point' },
  chisel: { d: (u) => (1 - u * 0.9) ** 1.1, w: (u) => (1 - u * 0.8) ** 1.2, curve: () => 0, lowK: 0.45, lowLen: 0.98, tip: 'point' },
  probe: { d: (u) => 0.32 + 0.68 * (1 - u) ** 3, w: (u) => 0.32 + 0.68 * (1 - u) ** 3, curve: (u) => 0.06 * u * u, lowK: 0.46, lowLen: 0.99, tip: 'round' },
  needle: { d: (u) => 0.25 + 0.75 * (1 - u) ** 4, w: (u) => 0.25 + 0.75 * (1 - u) ** 4, curve: (u) => 0.02 * u * u, lowK: 0.46, lowLen: 0.99, tip: 'point' },
  hook: { d: (u) => lerp(1, 0.45, u ** 1.4), w: (u) => lerp(1, 0.4, u), curve: (u) => 0.42 * u ** 3.2, lowK: 0.3, lowLen: 0.72, tip: 'point', cere: 0.28 },
  owl: { d: (u) => lerp(1, 0.4, u ** 1.3), w: (u) => lerp(1, 0.35, u), curve: (u) => 0.42 * u ** 2.2, lowK: 0.3, lowLen: 0.6, tip: 'point', cere: 0.3 },
  parrot: { d: (u) => lerp(1, 0.32, u ** 1.1), w: (u) => lerp(1, 0.38, u), curve: (u) => 0.62 * u ** 2.1, lowK: 0.55, lowLen: 0.55, tip: 'point', scoop: true, cere: 0.12 },
  chicken: { d: (u) => (1 - u) ** 0.65, w: (u) => (1 - u) ** 0.75, curve: (u) => 0.14 * u * u, lowK: 0.4, lowLen: 0.9, tip: 'point' },
  pigeon: { d: (u) => lerp(0.9, 0.42, u) * (u > 0.85 ? 1 - (u - 0.85) * 2.5 : 1), w: (u) => lerp(1, 0.4, u), curve: (u) => 0.06 * u ** 3, lowK: 0.4, lowLen: 0.95, tip: 'round', cere: 0.35 },
  flat: { d: (u) => lerp(1, 0.32, u), w: (u) => 1 - 0.12 * u - (u > 0.86 ? ((u - 0.86) / 0.14) ** 2 * 0.45 : 0), curve: (u) => -0.03 * u + (u > 0.9 ? 0.06 * (u - 0.9) / 0.1 : 0), lowK: 0.38, lowLen: 1.0, tip: 'round', nail: true },
  spoon: { d: (u) => lerp(0.8, 0.18, u), w: (u) => (u < 0.55 ? lerp(1, 0.7, u / 0.55) : lerp(0.7, 2.2, sstep(0.55, 0.85, u)) * (u > 0.85 ? Math.sqrt(1 - ((u - 0.85) / 0.15) ** 2 * 0.9) : 1)), curve: (u) => 0.02 * u, lowK: 0.42, lowLen: 0.99, tip: 'round' },
  pouch: { d: (u) => lerp(0.9, 0.3, u), w: (u) => lerp(1, 0.62, u), curve: (u) => (u > 0.94 ? 0.12 * ((u - 0.94) / 0.06) ** 2 : 0), lowK: 0.3, lowLen: 0.96, tip: 'round', pouch: 1.6 },
  toucan: { d: (u) => lerp(1, 0.28, u ** 1.25), w: (u) => lerp(1, 0.3, u), curve: (u) => 0.14 * u * u, lowK: 0.42, lowLen: 0.98, tip: 'point' },
  hornbill: { d: (u) => lerp(1, 0.25, u ** 1.1), w: (u) => lerp(1, 0.3, u), curve: (u) => 0.24 * u * u, lowK: 0.4, lowLen: 0.98, tip: 'point', casque: true },
  bent: { d: (u) => lerp(1, 0.5, u), w: (u) => lerp(1, 0.55, u), curve: (u) => (u < 0.42 ? 0.02 * u : 0.0084 + 0.7 * (u - 0.42) ** 1.3), lowK: 0.6, lowLen: 0.98, tip: 'round' },
  gull: { d: (u) => lerp(1, 0.8, u) * (u > 0.92 ? 1 - (u - 0.92) * 6 : 1), w: (u) => lerp(1, 0.42, u), curve: (u) => 0.16 * u ** 6, lowK: 0.42, lowLen: 0.9, tip: 'point', gonys: 0.28 },
  albatross: { d: (u) => lerp(1, 0.72, u) + 0.22 * sstep(0.84, 0.95, u) * (1 - sstep(0.95, 1, u)), w: (u) => lerp(1, 0.5, u), curve: (u) => 0.16 * Math.max(0, (u - 0.86) / 0.14) ** 2, lowK: 0.42, lowLen: 0.94, tip: 'point' },
  penguin: { d: (u) => lerp(1, 0.28, u), w: (u) => lerp(1, 0.3, u), curve: (u) => 0.08 * u * u, lowK: 0.45, lowLen: 0.97, tip: 'point' },
  puffin: { d: (u) => lerp(1, 0.18, u ** 0.9), w: (u) => lerp(1, 0.4, u), curve: (u) => 0.12 * u * u, lowK: 0.5, lowLen: 0.98, tip: 'point' },
  ostrich: { d: (u) => lerp(1, 0.55, u), w: (u) => 1 - 0.2 * u - (u > 0.8 ? ((u - 0.8) / 0.2) ** 2 * 0.5 : 0), curve: (u) => 0.03 * u * u, lowK: 0.42, lowLen: 0.98, tip: 'round' },
};

/** Feathers that would pass through the ground rest on it instead (a loft's rings and tips flattened at y0). */
function restOnGround(g, y0 = 0.002) {
  for (const row of g.rows) for (const P of row) if (P.y < y0) P.y = y0;
  for (const q of [g.tip0, g.tip1]) if (q && q.y < y0) q.y = y0;
  return g;
}

function birdBuild(B, S, L) {
  const rig = B.rig, det = B.det, M = S.M, paint = B.paint;
  const Lt = S.L, Hw = M.Hw, Hl = S.headLen, fam = S.fam;
  Object.assign(L, { Lt, Hw, Hl });
  /* ── posture: legs set the hip height, the torso hangs from the hips at its pitch ── */
  const Ts = M.Ts, Tib = Ts * (S.tibK ?? fam.tibK ?? 1.1), Fem = Ts * 0.45;
  const depth = Lt * (S.depth ?? fam.depth), width = Lt * (S.width ?? fam.width);
  const sHip = fam.sHip ?? 0.4;
  // posture: the hips at the legs' height; if the torso's lowest point (its rear on an upright bird) would reach the
  // ground, the legs straighten to lift it, and failing that the body tilts less until it clears
  let hipH = (Tib + Ts) * (S.crouch ?? fam.crouch ?? 0.72) + Fem * 0.3, pitch = S.pitch;
  const hipMax = (Tib + Ts) * 0.97 + Fem * 0.3, clear = 0.02 * Lt;
  const lowY = (pd, h) => {
    const p = pd * DEG, f = V3(0, Math.sin(p), Math.cos(p)), ub = V3(0, Math.cos(p), -Math.sin(p));
    let low = Infinity;
    for (const [s0, , , hb] of fam.torso) low = Math.min(low, h + 0.12 * depth * ub.y + f.y * (s0 - sHip) * Lt - hb * depth * ub.y);
    return Math.min(low, h + 0.12 * depth * ub.y + f.y * (0 - sHip) * Lt - 0.55 * fam.torso[0][3] * depth * Math.abs(f.y) - fam.torso[0][3] * depth * ub.y * 0.6);
  };
  let low = lowY(pitch, hipH);
  // (a penguin rests its weight on its tail and feet: its legs stay flexed, the body's underside meets the ground)
  if (low < clear && !S.restsOnTail) { hipH = Math.min(hipMax, hipH + (clear - low)); low = lowY(pitch, hipH); }
  while (low < clear && pitch > 4 && !S.restsOnTail) { pitch -= 2; low = lowY(pitch, hipH); }
  S.pitch = pitch;
  const P = pitch * DEG, fwd = V3(0, Math.sin(P), Math.cos(P)), upb = V3(0, Math.cos(P), -Math.sin(P));
  // torso centre-line: s = 0 at the tail base, 1 at the neck root; the hip joint sits at sHip, below the centre
  const C0 = V3(0, 0, 0);
  const tp = (s) => C0.clone().addScaledVector(fwd, (s - sHip) * Lt);
  const hipOff = upb.clone().multiplyScalar(-0.12 * depth);
  C0.y = hipH - hipOff.y;
  /* ── one loft: torso → neck → head ── */
  const T = (fam.torso).map(([s, w, ht, hb]) => [s, w * width, ht * depth, hb * depth]);
  const neckLen = S.neckLen, hr = Hw / 2;
  // the neck's centre-line, integrated from the torso's direction to the neck's carriage (and an S for long necks)
  const N0 = tp(1), nkShape = S.neckShape || [[0, S.neckAng], [1, S.neckAng]];
  const thAt = prof(nkShape.map(([u, d]) => [u, d]));
  const NSEG = 24, npts = [N0.clone()];
  const th0 = S.pitch;
  for (let i = 0; i < NSEG; i++) {
    const uu = (i + 0.5) / NSEG, th = lerp(th0, thAt(uu), sstep(0, 0.35, uu)) * DEG;
    npts.push(npts[i].clone().add(V3(0, Math.sin(th), Math.cos(th)).multiplyScalar(neckLen / NSEG)));
  }
  const O = npts[NSEG].clone();
  const hA = S.headAng * DEG, hd = V3(0, -Math.sin(hA), Math.cos(hA)), hu = V3(0, Math.cos(hA), Math.sin(hA));
  const hside = new THREE.Vector3().crossVectors(hu, hd).normalize();
  // the face ends on the bill's own base: a big bill (toucan, hornbill, macaw) widens and deepens the face to meet it
  const sk0 = (S.skull || fam.skull), Bi0 = S.bill, st0 = BILLS[Bi0.style] || BILLS.cone, lowK0 = Bi0.lowK ?? st0.lowK;
  const Wb0 = (Bi0.w ?? 0.62) * M.Bd * (Bi0.wK ?? 1) + (Bi0.wAdd ?? 0) * Hw;
  const sk = sk0.map((r, i) => (i < sk0.length - 1 ? r : [r[0], Math.max(r[1], (Wb0 / 2 / Hw) * 1.08), Math.max(r[2], (M.Bd * (1 - lowK0) / Hw) * 1.02), Math.max(r[3], (M.Bd * lowK0 / Hw) * 1.1), r[4]]));
  // (and the stations before it blend toward it, so the face doesn't pinch behind a big bill)
  for (let i = sk.length - 2; i >= 0 && i >= sk.length - 3; i--) { const t = i === sk.length - 2 ? 0.55 : 0.25, e = sk[sk.length - 1]; sk[i] = [sk[i][0], Math.max(sk[i][1], lerp(sk[i][1], e[1], t)), Math.max(sk[i][2], lerp(sk[i][2], e[2], t)), Math.max(sk[i][3], lerp(sk[i][3], e[3], t)), sk[i][4]]; }
  const keysP = [], keysW = [], keysT = [], keysB = [];
  const push = (p, w, t, b) => { if (keysP.length && keysP[keysP.length - 1].distanceTo(p) < 1e-5) return; keysP.push(p); keysW.push(w); keysT.push(t); keysB.push(b); };
  for (const [s, w, ht, hb] of T) push(tp(s), w, ht, hb);
  const nr0 = Math.min(T[T.length - 1][1], T[T.length - 1][2]), nrN = hr * (S.neckR ?? fam.neckR ?? 0.78), nrTop = hr * (S.napeR ?? 0.9);
  for (let i = 2; i <= NSEG; i += 2) {
    const uu = i / NSEG, r = uu < 0.5 ? lerp(nr0, nrN, sstep(0, 0.5, uu)) : lerp(nrN, nrTop, sstep(0.55, 1, uu));
    push(npts[i], r * 0.95, r, r * 1.02);
  }
  const head0 = keysP.length;
  for (const [u, w, top, bot, rise] of sk) if (u > 0) push(O.clone().addScaledVector(hd, u * Hl).addScaledVector(hu, (rise || 0) * Hw), w * Hw, top * Hw, bot * Hw);
  const curve = makePath(keysP), ku = knotUs(curve, keysP.length);
  const uNeck = ku[T.length - 1], uHead = ku[head0 - 1];
  const g = loft({ curve, seg: Math.round(det * (34 + 24 * Math.min(1, neckLen / Lt))), rad: 2 * Math.round(9 * det + 3), up: upb,
    w: prof(keysW.map((v, i) => [ku[i], v])), ht: prof(keysT.map((v, i) => [ku[i], v])), hb: prof(keysB.map((v, i) => [ku[i], v])),
    nt: (u) => (u < uNeck ? 2.2 : u < uHead ? 2 : 2.25), nb: (u) => (u < uNeck ? 2.0 : u < uHead ? 2 : 2.6),
    cap0: { type: 'round', len: 0.55, n: 3 }, cap1: 'flat', bend: 0.35, bump: S.fluff ? (u, a) => S.fluff * (vnoise(u * 30, a * 4, 0, 5) - 0.5) : null });
  if (S.restsOnTail) restOnGround(g, 0.002);
  Object.assign(L, { g, uNeck, uHead, hd, hu, hside, O, headO: O, fwd, upb, tp, depth, width, C0, torsoRear: [T[1][1], T[1][2], T[1][3]] });

  /* ── skeleton ── */
  rig.add('Root', null, V3(0, 0, 0));
  rig.add('Hips', 'Root', tp(sHip).add(hipOff));
  rig.add('Chest', 'Hips', tp(0.72));
  const nc = makePath(npts);
  rig.add('Neck1', 'Chest', nc.getPointAt(0.12)); rig.add('Neck2', 'Neck1', nc.getPointAt(0.6));
  rig.add('Head', 'Neck2', O.clone().addScaledVector(hd, -0.05 * Hl), O.clone().addScaledVector(hd, Hl));
  const uN1 = lerp(uNeck, uHead, 0.12), uN2 = lerp(uNeck, uHead, 0.6), uH = lerp(uNeck, uHead, 0.97);
  const spec = rig.spec(['Hips', 'Chest', 'Neck1', 'Neck2', 'Head'], [0, uNeck * 0.6, uN1, uN2, uH], 0.35);
  const skin = (u) => rig.chain(spec, u);
  L.skin = skin;
  const sOf = (u) => (u <= uNeck ? (u / uNeck) : u <= uHead ? 1 + (u - uNeck) / (uHead - uNeck) : 2 + (u - uHead) / (1 - uHead));
  emit(B.part('body', { group: 'body' }), g, (u, a, P) => { const s = sOf(u); return paint({ part: s < 1 ? 'torso' : s < 2 ? 'neck' : 'head', s: s % 1 + (s >= 3 ? 1 : 0), u, a, P }); }, skin);
  L.torsoAt = (s, a) => g.at(clamp(s, 0, 1) * uNeck, a);
  L.headAt = (u, a) => g.at(lerp(uHead, 1, clamp(u, 0, 1)), a);

  /* ── bill ── */
  const HWt = rig.W('Head');
  billBuild(B, S, L, HWt);
  /* ── eyes (set on the skull: [across, up] as fractions of its half-width and crown height) ── */
  const E = S.eye, er = E.r * Hw, eyes = [];
  const skW = prof(sk.map(k => [k[0], k[1]])), skT = prof(sk.map(k => [k[0], k[2]])), skR = prof(sk.map(k => [k[0], k[4] || 0]));
  for (const [sd] of SIDES) {
    const eu = E.u, c = O.clone().addScaledVector(hd, eu * Hl).addScaledVector(hu, (skR(eu) + E.at[1] * skT(eu)) * Hw).addScaledVector(hside, sd * E.at[0] * skW(eu) * Hw);
    const look = hside.clone().multiplyScalar(sd * Math.sin((E.yaw ?? 80) * DEG)).addScaledVector(hd, Math.cos((E.yaw ?? 80) * DEG)).addScaledVector(hu, E.up ?? 0.05).normalize();
    const eb = ellipsoid(c, er, er, er * 0.85, look, hu, Math.round(6 * det + 2), 2 * Math.round(5 * det + 2));
    const bas = basisFrom(look, hu);
    emit(B.part('eyes', { group: 'head' }), eb, (u, a, P) => { if (u < 0.7) return 'eye'; const q = P.clone().sub(c); return Math.hypot(q.dot(bas.s), q.dot(bas.u)) < er * (E.pupil ?? 0.45) ? 'pupil' : 'eye'; }, HWt);
    if (E.ring) {
      const ring = [];
      for (let i = 0; i < 14; i++) { const t = (i / 14) * TAU; ring.push(c.clone().addScaledVector(look, er * 0.42).addScaledVector(bas.s, Math.cos(t) * er * 1.04).addScaledVector(bas.u, Math.sin(t) * er * 1.04)); }
      emit(B.part('eyes', { group: 'head' }), loft({ pts: ring, closed: true, seg: 14, rad: 5, w: er * E.ring, ht: er * E.ring * 0.5, hb: er * E.ring * 0.5, up: look }), E.ringZone ?? 'face', HWt);
    }
    eyes.push({ c, r: er, look, sd });
  }
  L.eyes = eyes;
  /* ── crest, comb, wattles, tufts, casque, knob ── */
  birdExtras(B, S, L, HWt);
  /* ── tail, wings, legs ── */
  tailBuild(B, S, L);
  foldedWings(B, S, L);
  spreadWings(B, S, L);
  legsBuild(B, S, L, hipOff);
  return L;
}

/** The bill: an upper mandible continuing the face, a lower one on the Jaw bone, shaped by the style table. */
function billBuild(B, S, L, HWt) {
  const rig = B.rig, det = B.det, Bi = S.bill, st = BILLS[Bi.style] || BILLS.cone;
  const Lb = S.M.C, Db = S.M.Bd, Wb = (Bi.w ?? 0.62) * Db * (Bi.wK ?? 1) + (Bi.wAdd ?? 0) * L.Hw;
  // the bill base: the loft's front ring, a little inside the face
  const base = L.headAt(1, 0).p.clone().lerp(L.headAt(1, Math.PI).p, 0.5).addScaledVector(L.hu, -(Bi.drop ?? 0.08) * L.Hw).addScaledVector(L.hd, -0.03 * Lb);
  const bd = L.hd.clone().applyAxisAngle(L.hside, -(Bi.tilt ?? 0) * DEG).normalize(), bu = new THREE.Vector3().crossVectors(bd, L.hside).normalize();
  const cl = (u, k = 0) => base.clone().addScaledVector(bd, u * Lb).addScaledVector(bu, -st.curve(u) * Lb + k);
  const lowK = Bi.lowK ?? st.lowK, upH = (u) => Db * (1 - lowK) * st.d(u), loH = (u) => Db * lowK * st.d(u);
  const wU = (u) => Math.max(Wb * 0.5 * st.w(u), Lb * 0.01);
  const N = Math.round((Bi.seg ?? 14) * det), up = [];
  for (let i = 0; i <= 8; i++) up.push(cl(i / 8));
  const tipCap = st.tip === 'round' ? { type: 'round', len: 0.5, n: 2 } : { type: 'point', len: 0.35 };
  const upper = loft({ pts: up, seg: N, rad: 2 * Math.round(6 * det + 2), up: bu, w: (u) => wU(u), ht: (u) => Math.max(upH(u), Lb * 0.008), hb: (u) => Math.max(upH(u) * 0.18, Lb * 0.004), nt: (u) => lerp(1.7, 2.2, u), nb: 3, cap0: 'flat', cap1: tipCap, bend: 0 });
  const bz = (u) => (Bi.tipZone && Bi.tipUpper !== false && u > (Bi.tipFrom ?? 0.75) ? Bi.tipZone : st.cere && u < st.cere * (Bi.cereK ?? 1) && Bi.cereZone ? Bi.cereZone : 'beak');
  emit(B.part('beak', { group: 'head' }), upper, (u) => bz(u), HWt);
  // lower mandible, hinged at the gape just inside the face
  const hingeP = base.clone().addScaledVector(bu, -upH(0) * 0.15).addScaledVector(bd, -0.06 * Lb);
  rig.add('Jaw', 'Head', hingeP, cl(st.lowLen));
  const lowLen = Bi.lowLen ?? st.lowLen, lo = [];
  for (let i = 0; i <= 8; i++) { const u = (i / 8) * lowLen; lo.push(cl(u).addScaledVector(bu, -upH(u) * 0.12 - (st.scoop ? -Db * 0.25 * u * u : 0))); }
  const pouch = st.pouch ? (u) => st.pouch * Db * sstep(0.04, 0.2, u) * (1 - sstep(0.55, 0.95, u)) : () => 0;
  const gonys = st.gonys ? (u) => Db * 0.35 * Math.max(0, 1 - Math.abs(u - 0.82) / 0.12) : () => 0;
  const lower = loft({ pts: lo, seg: Math.round(N * 0.8), rad: 2 * Math.round(5 * det + 2), up: bu, w: (u) => wU(u * lowLen) * (st.scoop ? 1.05 : 0.94),
    ht: (u) => Math.max(loH(u * lowLen) * 0.25, Lb * 0.004), hb: (u) => Math.max(loH(u * lowLen) * (st.scoop ? 1.2 : 1) + pouch(u) + gonys(u * lowLen), Lb * 0.006), nt: 3, nb: 2, cap0: { type: 'round', len: 0.4 }, cap1: st.scoop ? { type: 'round', len: 0.6, n: 2 } : tipCap, bend: 0 });
  emit(B.part('beak', { group: 'head' }), lower, (u) => (st.pouch && u > 0.05 && u < 0.9 ? Bi.pouchZone ?? 'jaw' : Bi.tipZone && u * lowLen > (Bi.tipFrom ?? 0.75) && Bi.tipLower !== false ? Bi.tipZone : 'jaw'), rig.W('Jaw'));
  // duck's nail, swan's knob, hornbill's casque
  if (st.nail) emit(B.part('beak', { group: 'head' }), ellipsoid(cl(0.95, upH(0.95) * 0.8), wU(0.95) * 0.55, upH(0.95) * 0.35, Lb * 0.05, bd, bu, 3, 8), Bi.nailZone ?? 'jaw', HWt);
  if (Bi.knob) emit(B.part('beak', { group: 'head' }), ellipsoid(cl(0.02, upH(0) * 1.1), wU(0) * 0.6, Db * Bi.knob, Lb * 0.12, bd, bu, 4, 10), Bi.knobZone ?? 'jaw', HWt);
  if (st.casque || Bi.casque) {
    const cq = Bi.casque || {}, cl0 = cq.len ?? 0.65, cH = Db * (cq.h ?? 0.7);
    const pts = [0, 0.2, 0.45, 0.7, 0.9, 1].map(f => cl(f * cl0, upH(f * cl0) + cH * 0.45 * Math.sin(Math.PI * clamp(f * 0.85 + 0.12, 0, 1))));
    emit(B.part('beak', { group: 'head' }), loft({ pts, seg: Math.round(10 * det), rad: 12, up: bu, w: (u) => wU(u * cl0) * 0.85, ht: (u) => cH * 0.5 * Math.sin(Math.PI * clamp(u * 0.9 + 0.08, 0, 1)) ** 0.6, hb: (u) => upH(u * cl0) * 0.4, nt: 2.6, cap0: 'round', cap1: { type: 'round', len: 0.6 }, bend: 0.2 }), cq.zone ?? 'accent', HWt);
  }
  L.bill = { base, bd, bu, Lb, Db, cl };
}

/** Crests, combs, wattles, ear tufts and the like. */
function birdExtras(B, S, L, HWt) {
  const rig = B.rig, det = B.det, Hw = L.Hw, Hl = L.Hl, hd = L.hd, hu = L.hu, part = B.part('crest', { group: 'head' });
  const X = S.extras || {};
  if (X.crest) {
    const C = X.crest, n = C.n ?? 7, h = C.h * Hw;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      if (C.style === 'peak') {
        // one laterally flattened tuft swept up and back from the crown (cardinal)
        if (i) break;
        const root = L.headAt(C.at ?? 0.45, Math.PI / 2), dir = hu.clone().multiplyScalar(Math.cos((C.sweep ?? 40) * DEG)).addScaledVector(hd, -Math.sin((C.sweep ?? 40) * DEG)).normalize();
        emit(part, loft({ pts: [root.p.clone().addScaledVector(root.n, -Hw * 0.2), root.p, root.p.clone().addScaledVector(dir, h * 0.5), root.p.clone().addScaledVector(dir, h)], seg: 8, rad: 10, up: hd,
          w: (u) => Hw * (C.thk ?? 0.12) * (1 - u) ** 0.7, ht: (u) => Hw * (C.base ?? 0.3) * (1 - u) ** 1.1, hb: (u) => Hw * (C.base ?? 0.3) * 0.8 * (1 - u) ** 0.85, cap0: 'round', cap1: 'point', bend: 0.3 }), C.zone ?? 'head', HWt);
        continue;
      }
      // feathers rooted along the crown (fan: cockatoo; plumes: peacock's wire crest; lay: heron's nape plumes)
      const uR = C.style === 'lay' ? lerp(0.2, 0.05, t) : lerp(C.from ?? 0.62, C.to ?? 0.2, t), aR = Math.PI / 2 + ((i % 2 ? 1 : -1) * (C.spread ?? 0.15) * t);
      const q = L.headAt(uR, aR);
      const back = hd.clone().multiplyScalar(-1);
      let dir = C.style === 'lay' ? back.clone().addScaledVector(hu, 0.15) : q.n.clone().lerp(back, C.lean ?? 0.6).normalize();
      if (C.style === 'fan') dir = hu.clone().multiplyScalar(Math.cos(lerp(-0.3, 1.1, t))).addScaledVector(hd, Math.sin(lerp(-0.3, 1.1, t)) * -1).normalize();
      if (C.style === 'recurve') {
        // a cockatoo's crest at rest: broad feathers rooted from the forehead back over the crown, lying back along it
        // and curling up at the tips, the forward ones longest
        const ur = lerp(C.from ?? 0.85, C.to ?? 0.3, t), qa = L.headAt(ur, Math.PI / 2 + (i % 2 ? 1 : -1) * 0.12 * (1 - t)), L0 = h * lerp(1, 0.45, t);
        const b0 = qa.p.clone().addScaledVector(qa.n, -Hw * 0.04), bk = hd.clone().multiplyScalar(-1);
        const pts = [b0, b0.clone().addScaledVector(bk, L0 * 0.4).addScaledVector(hu, L0 * 0.08), b0.clone().addScaledVector(bk, L0 * 0.72).addScaledVector(hu, L0 * 0.28), b0.clone().addScaledVector(bk, L0 * 0.86).addScaledVector(hu, L0 * (C.curl ?? 0.62))];
        const path = makePath(pts);
        sheet(part, { nu: 6, nv: 2, f: (u, v) => path.getPointAt(u).addScaledVector(L.hside, (v - 0.5) * Hw * (C.vane ?? 0.24) * Math.sin(Math.PI * clamp(u * 0.85 + 0.15, 0, 1)) ** 0.5), th: Hw * 0.02, zone: (u) => (C.baseZone && u < 0.25 ? C.baseZone : C.zone ?? 'accent'), skin: HWt });
        continue;
      }
      const len = h * (C.style === 'lay' ? 1 - 0.3 * t : 0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, 0.15 + t)));
      const p0 = q.p.clone().addScaledVector(q.n, -Hw * 0.05), p1 = p0.clone().addScaledVector(dir, len * 0.55).addScaledVector(hu, len * (C.curl ?? 0.1)), p2 = p0.clone().addScaledVector(dir, len).addScaledVector(hu, len * (C.curl ?? 0.1) * 2.2);
      if (C.style === 'plumes') emit(part, tube([p0, p1, p2], Hw * 0.012, 4, 4, { cap1: 'point' }), 'accent', HWt), emit(part, ellipsoid(p2, Hw * 0.05, Hw * 0.08, Hw * 0.035, dir, hd, 3, 8), C.tipZone ?? 'accent', HWt);
      else sheet(part, { nu: 4, nv: 2, f: (u, v) => { const b = makePath([p0, p1, p2]).getPointAt(u); return b.addScaledVector(L.hside, (v - 0.5) * Hw * (C.vane ?? 0.14) * Math.sin(Math.PI * clamp(u * 0.9 + 0.1, 0, 1)) ** 0.6); }, th: Hw * 0.015, zone: (u) => (C.tipZone && u > 0.75 ? C.tipZone : C.zone ?? 'accent'), skin: HWt });
    }
  }
  if (X.tufts) for (const [sd] of SIDES) {
    // ear tufts (great horned owl): feather horns at the brow's corners
    // (a fan of soft feathers, flattened front to back and leaning back a little, not a horn)
    const q = L.headAt(X.tufts.u ?? 0.7, Math.PI / 2 - sd * 0.62), dir = q.n.clone().addScaledVector(hd, -0.45).addScaledVector(L.hside, sd * 0.3).normalize(), h = X.tufts.h * Hw;
    sheet(part, { nu: 4, nv: 2, f: (u, v) => q.p.clone().addScaledVector(q.n, -Hw * 0.05).addScaledVector(dir, u * h).addScaledVector(L.hside, (v - 0.5) * Hw * 0.22 * (1 - u * 0.75)).addScaledVector(hd, -u * u * h * 0.2), th: Hw * 0.05, zone: (u) => (u > 0.5 ? 'flight' : X.tufts.zone ?? 'head'), skin: HWt });
  }
  if (X.comb) {
    // rooster's comb: a serrated blade along the crown and forehead
    const C = X.comb;
    sheet(part, { nu: 12, nv: 2, f: (u, v) => { const q = L.headAt(lerp(C.from ?? 0.25, C.to ?? 0.95, u), Math.PI / 2).p; return q.addScaledVector(hu, v * C.h * Hw * (0.55 + 0.45 * Math.abs(Math.sin(u * Math.PI * (C.points ?? 4.5)))) * Math.sin(Math.PI * clamp(u * 0.9 + 0.1, 0, 1)) ** 0.4 - Hw * 0.05); }, th: Hw * 0.08, zone: C.zone ?? 'accent', skin: HWt });
  }
  if (X.wattle) for (const [sd] of SIDES) {
    // wattles hang from the throat at the gape; turkeys' snood droops over the bill
    const W0 = X.wattle, p = L.bill.base.clone().addScaledVector(L.bill.bu, -L.bill.Db * 0.5).addScaledVector(L.hside, sd * L.bill.Db * 0.25).addScaledVector(L.bill.bd, L.bill.Lb * 0.05), l = W0.len * Hw;
    emit(part, loft({ pts: [p, p.clone().add(V3(0, -l * 0.5, 0)), p.clone().add(V3(0, -l, -l * 0.15))], seg: 6, rad: 10, up: hd, w: (u) => l * 0.2 * (0.6 + Math.sin(Math.PI * u)), ht: (u) => l * 0.14 * (0.6 + Math.sin(Math.PI * u)), hb: (u) => l * 0.14 * (0.6 + Math.sin(Math.PI * u)), cap1: 'round' }), W0.zone ?? 'accent', rig.W('Jaw'));
  }
  if (X.snood) {
    const p = L.bill.base.clone().addScaledVector(L.bill.bu, L.bill.Db * 0.6), l = X.snood * Hw;
    emit(part, tube([p, p.clone().addScaledVector(L.bill.bd, l * 0.4).addScaledVector(L.bill.bu, l * 0.1), p.clone().addScaledVector(L.bill.bd, l * 0.5).addScaledVector(L.bill.bu, -l * 0.6)], (u) => Hw * 0.05 * (1 - 0.3 * u), 6, 6, { cap1: 'round' }), 'accent', HWt);
  }
}

/** The tail: a fan of rectrices from the tail base along the line of the back (raised by `lift`). */
function tailBuild(B, S, L) {
  const rig = B.rig, det = B.det, Tl = S.M.T, Ts = S.tail, part = B.part('tail', { group: 'tail', coatK: 1.4 });
  const base = L.tp(0.04).addScaledVector(L.upb, 0.12 * L.depth);
  let tdir = L.fwd.clone().multiplyScalar(-1).addScaledVector(L.upb, Math.tan((Ts.lift ?? 8) * DEG)).normalize();
  // (an upright bird on the ground rests its tail tip just above it rather than through it)
  const floor = 0.015 * L.Lt + Tl * 0.03;
  if (base.y + tdir.y * Tl < floor) { const y = clamp((floor - base.y) / Tl, -0.999, 0.999), h = Math.sqrt(1 - y * y), hz = V3(tdir.x, 0, tdir.z).normalize(); tdir = hz.multiplyScalar(h).add(V3(0, y, 0)).normalize(); }
  rig.add('Tail', 'Hips', base, base.clone().addScaledVector(tdir, Tl));
  L.tail = { base, tdir };
  if (Ts.hidden) return;
  const n = Ts.n ?? 12, width = Tl * (Ts.w ?? 0.32), fan = (Ts.fan ?? 14) * DEG, Wt = rig.W('Tail');
  const shape = Ts.shape ?? 'square';
  // the tail's two halves fold down from the midline like a roof: nearly flat on most birds, nearly vertical on a
  // rooster or a hen (roof ≈ 60-70°), whose sickles then arch over in that plane
  const tu = L.upb.clone().addScaledVector(tdir, -L.upb.dot(tdir)).normalize(), roof = (Ts.roof ?? 6) * DEG, down = V3(0, -1, 0);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5, at = Math.abs(t) * 2;
    const len = Tl * (shape === 'fork' ? 0.72 + 0.4 * at : shape === 'wedge' ? 1 - 0.55 * at : shape === 'round' ? 1 - 0.18 * at * at : shape === 'graduated' ? 1 - 0.75 * at ** 1.2 : shape === 'train' ? 0.85 + 0.15 * Math.cos(at * 2) : 1);
    const ax = tu.clone().applyAxisAngle(tdir, -(t < 0 ? -1 : 1) * roof * sstep(0, 0.3, at));
    const d = tdir.clone().applyAxisAngle(ax, t * fan * 2), sd = new THREE.Vector3().crossVectors(ax, d).normalize();
    const fw = Math.min(width * 2.2 / n, len * 0.35) * (Ts.featherW ?? 1), droop = (Ts.droop ?? 0) * len;
    // the outer feathers lie under the central ones (stacked a little lower)
    const stack = -at * fw * 0.08;
    sheet(part, { nu: Math.round(5 * det + 1), nv: 2,
      f: (u, v) => { const p = base.clone().addScaledVector(d, u * len).addScaledVector(sd, (v - 0.5) * fw * Math.sin(Math.PI * clamp(0.1 + u * 0.95, 0, 1)) ** 0.45).addScaledVector(ax, stack).addScaledVector(down, droop * u * u); p.y = Math.max(p.y, 0.004 + at * 0.002); return p; },
      th: (u) => fw * 0.07 * (1 - 0.5 * u), zone: (u, v, face) => B.paint({ part: 'tail', u, v, face, t, P: base }), skin: (u) => (u < 0.08 ? rig.W2('Hips', 'Tail', u / 0.08) : Wt) });
  }
  // the tail coverts: the rump's and the vent's feathers run on over the tail's root, so the tail grows out of the
  // body as one tapering mass instead of a fan stuck on at a seam
  if ((Ts.coverts ?? 1) > 0) {
    const T0 = L.torsoRear, cl = Tl * 0.42 * (Ts.coverts ?? 1), root = L.tp(0.12).addScaledVector(L.upb, 0.1 * L.depth);
    const pts = [root, base, base.clone().addScaledVector(tdir, cl * 0.5), base.clone().addScaledVector(tdir, cl)];
    for (const q of pts) q.y = Math.max(q.y, 0.004 + T0[2] * 0.25);
    const wE = Math.min(width * 0.45, T0[0] * 0.8), steep = roof > 30 * DEG;
    emit(part, restOnGround(loft({ pts, seg: Math.round(8 * det + 2), rad: 2 * Math.round(6 * det + 3), up: tu,
      w: (u) => lerp(T0[0] * (steep ? 0.7 : 0.92), wE * (steep ? 0.35 : 0.7), sstep(0.1, 1, u)), ht: (u) => lerp(T0[1] * 0.85, T0[1] * 0.12, sstep(0.15, 1, u)), hb: (u) => lerp(T0[2] * 0.9, T0[2] * 0.15, sstep(0.25, 1, u) ** 0.8),
      nt: steep ? 1.5 : 2.2, nb: 2, cap0: 'flat', cap1: { type: 'round', len: 0.4, n: 2 }, bend: 0.3 }), 0.003),
    (u, a, P) => B.paint({ part: 'coverts', s: 0.02, a, P }), (u) => (u < 0.35 ? rig.W2('Hips', 'Tail', u / 0.35) : Wt));
  }
  // the train (peafowl): long upper-tail coverts lying back over the tail and along the ground, in tiers of graded
  // length, each feather ending in an eyespot, so the eyes cover the whole train
  if (Ts.train) {
    const tr = Ts.train, m = tr.n ?? 24, len0 = tr.len, tiers = tr.tiers ?? [1, 0.8, 0.6, 0.42];
    for (let i = 0; i < m; i++) {
      const t = i / (m - 1) - 0.5, tier = tiers[i % tiers.length], d = tdir.clone().applyAxisAngle(L.upb, t * (tr.fan ?? 10) * DEG * 2), sd = new THREE.Vector3().crossVectors(L.upb, d).normalize();
      const len = len0 * tier * (1 - 0.18 * Math.abs(t) * 2), b0 = base.clone().addScaledVector(L.upb, (0.03 + 0.02 * (1 - tier)) * L.depth), fwT = len0 * (tr.w ?? 0.05);
      const sag = (u) => -Math.max(0, (b0.y + d.y * u * len) - 0.01) * sstep(0.15, 1, u) * 0.95;
      sheet(part, { nu: Math.round(8 * det + 2), nv: 2,
        f: (u, v) => { const p = b0.clone().addScaledVector(d, u * len).addScaledVector(sd, (v - 0.5) * fwT * Math.sin(Math.PI * clamp(0.1 + u, 0, 1)) ** 0.4); p.y = Math.max(p.y + sag(u), 0.004 + 0.002 * u + (1 - tier) * 0.006 + i * 0.0002); return p; },
        th: len0 * 0.004, zone: (u, v) => { const e = Math.hypot((u - 0.93) * len / fwT, (v - 0.5) * 1.2); return e < 0.18 ? (tr.heart ?? 'body') : e < 0.32 ? (tr.ring ?? 'accent') : e < 0.42 ? (tr.zone ?? 'flight') : u > 0.8 && e < 0.5 ? (tr.rim ?? 'wing') : (tr.zone ?? 'flight'); },
        skin: (u) => (u < 0.06 ? rig.W2('Hips', 'Tail', u / 0.06) : Wt) });
    }
  }
  L.tail = { base, tdir };
}

/**
 * The folded wing: a feathered blade lying on the flank from the wrist (at the front of the breast) back to the
 * primary tips, which reach past the tail base and rest on the tail. Over the body it follows the flank just outside
 * the feathers; past the body it carries on as a tapering blade toward the midline.
 */
function foldedWings(B, S, L) {
  const rig = B.rig, det = B.det, Wg = S.wing, Lt = L.Lt, part = B.part('wings-folded', { group: 'wingFold' });
  const sW = Wg.wrist ?? 0.82, fl = S.M.W * (Wg.foldK ?? 1.0), s1 = sW - fl / Lt;
  const aTop = Wg.top ?? 1.15, aBot = Wg.bot ?? -0.25;
  for (const [sd, sx] of SIDES) {
    const shoulder = L.torsoAt(sW, sd > 0 ? 0.6 : Math.PI - 0.6).p;
    rig.add('WingFold' + sx, 'Chest', shoulder);
    if (Wg.hidden) continue;     // (kiwis: the vestigial wing is lost in the plumage)
    const Wf = rig.W('WingFold' + sx);
    const lastS = 0.03, edge = (s, a) => { const q = L.torsoAt(s, sd > 0 ? a : Math.PI - a); return q.p.addScaledVector(q.n, (Wg.loft ?? 0.03) * L.depth); };
    sheet(part, {
      nu: Math.round(14 * det + 4), nv: Math.round(5 * det + 2),
      f: (u, v) => {
        const s = lerp(sW, s1, u);
        // the outline: round at the wrist, deepest a third of the way back, tapering to the primaries' tip
        const env = Math.sin(Math.PI * clamp(u * 0.92 + 0.05, 0, 1)) ** 0.55 * (u > 0.6 ? 1 - (u - 0.6) / 0.4 * (Wg.tip === 'round' ? 0.55 : 0.8) : 1);
        const a = lerp(aTop, lerp(aTop, aBot, env), v);
        if (s >= lastS) return edge(s, a);
        // past the body: on from the last ring, converging over the tail
        // (along the tail, just above it: on an upright bird straight back would run into the ground)
        const p0 = edge(lastS, lerp(aTop, lerp(aTop, aBot, env), v)), back = (lastS - s) * Lt, td = L.tail ? L.tail.tdir : L.fwd.clone().multiplyScalar(-1);
        const q = p0.addScaledVector(td, back).add(V3(-sd * back * (Wg.cross ?? 0.12), 0, 0)).addScaledVector(L.upb, back * 0.04);
        q.y = Math.max(q.y, 0.02 * Lt + L.depth * 0.08);
        return q;
      },
      th: (u, v) => L.depth * 0.05 * (1 - 0.65 * u) * (0.5 + 0.5 * Math.sin(Math.PI * clamp(v, 0, 1))), zone: (u, v, face) => B.paint({ part: 'fold', u, v, face, P: shoulder }), skin: Wf,
    });
  }
}

/** The spread wing (flight): coverts and secondaries on the arm, primaries on the hand; slotted tips separate. */
function spreadWings(B, S, L) {
  const rig = B.rig, det = B.det, Wg = S.wing, M = S.M, part = B.part('wings', { group: 'wingSpread', coatK: 2.5 });
  const half = Math.max(M.W * 1.15, M.Sp / 2 - L.width * 0.45), chord = M.W * (Wg.chordK ?? 0.62);
  const seg = Wg.segs ?? [0.25, 0.32, 0.43];
  const wPt = (b, dx, dy, dz) => b.clone().add(V3(dx, 0, 0)).addScaledVector(L.upb, dy).addScaledVector(L.fwd, dz);
  for (const [sd, sx] of SIDES) {
    const sh = L.torsoAt(0.74, sd > 0 ? 0.55 : Math.PI - 0.55).p.addScaledVector(L.upb, -0.05 * L.depth);
    const el = wPt(sh, sd * half * seg[0], half * 0.02, -half * 0.03), wr = wPt(el, sd * half * seg[1], half * 0.01, half * 0.03), tip = wPt(wr, sd * half * seg[2], -half * 0.01, -half * (Wg.sweep ?? 0.12));
    rig.add('Wing' + sx, 'Chest', sh); rig.add('Humerus' + sx, 'Wing' + sx, sh, el); rig.add('Forearm' + sx, 'Humerus' + sx, el, wr); rig.add('Hand' + sx, 'Forearm' + sx, wr, tip);
    if (Wg.hidden) continue;
    const le = makePath([sh.clone().add(V3(-sd * L.width * 0.2, 0, 0)), sh, el, wr, tip]), ku = knotUs(le, 5);
    const spec = rig.spec(['Wing' + sx, 'Humerus' + sx, 'Forearm' + sx, 'Hand' + sx], [0, ku[1], ku[2], ku[3]], 0.22);
    const slotted = Wg.tip === 'slotted', pointed = Wg.tip === 'pointed';
    const cP = prof([[0, 0.7], [ku[1], 0.95], [ku[2], 1], [ku[3], 0.95], [0.88, slotted ? 0.75 : pointed ? 0.45 : 0.7], [1, slotted ? 0.55 : pointed ? 0.08 : 0.35]]);
    sheet(part, { nu: Math.round(20 * det), nv: Math.round(4 * det),
      f: (u, v) => { const p = le.getPointAt(u), c = chord * cP(u); return wPt(p, 0, Math.sin(Math.PI * v) * c * 0.06 * (1 - u * 0.5), -v * c + (u > 0.85 ? -(u - 0.85) * c * 0.6 * v : 0)); },
      th: (u, v) => chord * 0.04 * (1 - 0.55 * u) * (1 - 0.7 * v), zone: (u, v, face) => B.paint({ part: 'wing', u, v, face, P: sh }), skin: (u) => rig.chain(spec, u) });
    if (slotted) for (let i = 0; i < 6; i++) {
      // the "fingers": emarginated outer primaries standing apart
      const t = i / 5, b0 = le.getPointAt(lerp(0.82, 0.99, t)), d = wPt(V3(), sd * (0.55 + 0.45 * t), 0, -(1 - t) * 0.75).normalize(), fl = chord * (0.62 - 0.12 * Math.abs(t - 0.5));
      sheet(part, { nu: 4, nv: 2, f: (u, v) => wPt(b0, 0, u * u * fl * 0.06, -chord * 0.12 + (v - 0.5) * chord * 0.11 * Math.sin(Math.PI * clamp(u * 0.9 + 0.1, 0, 1))).addScaledVector(d, u * fl), th: chord * 0.018, zone: 'flight', skin: rig.W('Hand' + sx) });
    }
  }
  L.span = half;
}

/** Legs: the feathered drumstick, the bare or feathered tarsus, toes by foot type (perching, zygodactyl, webbed, ...). */
function legsBuild(B, S, L, hipOff) {
  const rig = B.rig, det = B.det, M = S.M, Ts = M.Ts, Tib = Ts * (S.tibK ?? S.fam.tibK ?? 1.1), lr = Ts * (S.legThk ?? 0.075);
  const lp = B.part('legs', { group: 'legs' }), fp = B.part('feet', { group: 'feet' }), F = S.feet;
  for (const [sd, sx] of SIDES) {
    const hip = L.tp(S.fam.sHip ?? 0.4).add(hipOff).add(V3(sd * L.width * 0.28, 0, 0));
    const knee = hip.clone().addScaledVector(L.fwd, Ts * 0.32).add(V3(sd * L.width * 0.04, -Ts * 0.22, 0));
    const foot = V3(hip.x + sd * L.width * 0.03, 0, hip.z + (S.footFwd ?? 0.02) * L.Lt);
    foot.y = lr * 0.9;
    const ankle = twoBone(knee, foot, Tib, Ts, L.fwd.clone().multiplyScalar(-1).setY(0).normalize());
    const toeDir = V3(0, 0, 1);
    rig.add('Thigh' + sx, 'Hips', hip, knee); rig.add('Shin' + sx, 'Thigh' + sx, knee, ankle); rig.add('Tarsus' + sx, 'Shin' + sx, ankle, foot); rig.add('Toe' + sx, 'Tarsus' + sx, foot, foot.clone().addScaledVector(toeDir, Ts * 0.4));
    // drumstick: from inside the belly to the heel, feathered (bare below `bare` on waders)
    const top = knee.clone().addScaledVector(L.upb, L.depth * 0.25), bare = S.bareTibia ?? 0;
    const rTop = Math.min(L.width * 0.16, L.depth * 0.2) * (S.thighK ?? 1), rLow = lr * (S.feathered ? 2.1 : 1.35);
    const tib = loft({ pts: [top, knee, knee.clone().lerp(ankle, 0.5), ankle], seg: Math.round(12 * det), rad: 2 * Math.round(4 * det + 2), up: [1, 0, 0],
      w: (u) => lerp(rTop, rLow, sstep(0.15, bare > 0 ? 1 - bare : 0.9, u)), ht: (u) => lerp(rTop, rLow, sstep(0.15, bare > 0 ? 1 - bare : 0.9, u)), hb: (u) => lerp(rTop, rLow, sstep(0.15, bare > 0 ? 1 - bare : 0.9, u)), cap0: 'round', cap1: { type: 'round', len: 0.4 }, bend: 0.3 });
    emit(lp, tib, (u, a, P) => (bare > 0 && u > 1 - bare * 0.9 ? 'leg' : B.paint({ part: 'thigh', u, a, P })), (u) => rig.W2('Thigh' + sx, 'Shin' + sx, sstep(0.1, 0.45, u)));
    if (!S.feathered) emit(lp, ellipsoid(ankle, lr * 1.25, lr * 1.25, lr * 1.35, ankle.clone().sub(knee).normalize(), [0, 0, 1], 4, 8), 'leg', rig.W2('Shin' + sx, 'Tarsus' + sx, 0.5));
    const tr = loft({ pts: [ankle, ankle.clone().lerp(foot, 0.5), foot], seg: Math.round(7 * det), rad: 2 * Math.round(3 * det + 2), up: [0, 0, 1], w: (u) => lr * (S.feathered && u < 0.7 ? 1.9 : 0.88), ht: (u) => lr * (S.feathered && u < 0.7 ? 2.0 : 1.02), hb: (u) => lr * (S.feathered && u < 0.7 ? 2.0 : 1.02), cap0: 'round', cap1: 'round', bend: 0.3 });
    emit(lp, tr, (u, a, P) => (S.feathered && u < 0.65 ? B.paint({ part: 'thigh', u: 1, a, P }) : 'leg'), rig.W('Tarsus' + sx));
    // toes: [angle from forward (deg, + outward), length × tarsus, thickness × leg radius]
    const toes = F === 'zygo' ? [[-12, 0.42, 1], [14, 0.5, 1], [170, 0.38, 0.95], [-160, 0.36, 0.95]]
      : F === 'ratite' ? [[6, 0.42, 1.6], [34, 0.26, 1.2]]
      : F === 'webbed' ? [[-28, 0.62, 0.9], [0, 0.7, 0.9], [28, 0.64, 0.9], [175, 0.14, 0.7]]
      : F === 'raptor' ? [[-26, 0.42, 1.25], [0, 0.48, 1.25], [24, 0.4, 1.25], [180, 0.36, 1.3]]
      : F === 'galliform' ? [[-28, 0.48, 1.1], [0, 0.58, 1.1], [28, 0.48, 1.1], [180, 0.2, 0.9]]
      : F === 'wader' ? [[-30, 0.5, 0.75], [0, 0.6, 0.75], [30, 0.5, 0.75], [180, 0.18, 0.6]]
      : F === 'tiny' ? [[-22, 0.4, 0.8], [0, 0.48, 0.8], [22, 0.4, 0.8], [180, 0.3, 0.8]]
      : [[-26, 0.48, 0.9], [0, 0.6, 0.9], [26, 0.48, 0.9], [180, 0.48, 0.9]];
    const tips = [], k = S.toeK ?? 1, Wt = rig.W('Toe' + sx);
    // (the longest toe with its claw: the walk lifts the foot clear of the ground by more than its curled toes hang)
    L.toeLen = Math.max(...toes.map(([, len, thk]) => len * Ts * k + lr * 0.72 * thk * (S.talons ?? 1.4)));
    const pad = foot.clone(); pad.y = lr * 0.85;
    emit(fp, ellipsoid(pad, lr * 1.35, lr * 0.9, lr * 1.5, [0, 0, 1], [0, 1, 0], 4, 8), 'leg', Wt);
    for (const [ang, len, thk] of toes) {
      const a = ang * DEG, d = V3(sd * Math.sin(a), 0, Math.cos(a)), tl = len * Ts * k, t = lr * 0.72 * thk;
      const e = pad.clone().addScaledVector(d, tl); e.y = t * 0.95;
      const m = pad.clone().lerp(e, 0.5); m.y = Math.max(e.y, pad.y) + t * 0.6;
      emit(fp, tube([pad, m, e], (u) => t * (1 - 0.3 * u), Math.round(4 * det + 2), 6, { cap1: { type: 'round', len: 0.7 } }), 'leg', Wt);
      const cl = t * (S.talons ?? 1.4), cs = e.clone().addScaledVector(d, t * 0.5);
      emit(fp, tube([cs, cs.clone().addScaledVector(d, cl * 0.65).add(V3(0, cl * 0.15, 0)), cs.clone().addScaledVector(d, cl).add(V3(0, -Math.min(cl * 0.5, cs.y - t * 0.08), 0))], (u) => t * 0.45 * (1 - 0.9 * u), 4, 4, { cap1: 'point' }), 'beak', Wt);
      tips.push({ e, d, t });
    }
    if (F === 'webbed') sheet(fp, { nu: 2, nv: 4, f: (u, v) => { const i = Math.min(1, Math.floor(v * 2)), f = v * 2 - i, A = tips[i].e, Bp = tips[i + 1].e; const q = pad.clone().lerp(A.clone().lerp(Bp, f), u * (1 - 0.18 * Math.sin(Math.PI * f) * u)); q.y = Math.max(q.y, lr * 0.25); return q; }, th: lr * 0.22, zone: 'leg', skin: Wt });
    if (S.spur) emit(fp, tube([foot.clone().lerp(ankle, 0.22), foot.clone().lerp(ankle, 0.22).addScaledVector(V3(0, 0.2, -1).normalize(), lr * 2.4)], (u) => lr * 0.5 * (1 - 0.9 * u), 3, 4, { cap1: 'point' }), 'beak', rig.W('Tarsus' + sx));
  }
}

/* ════════════════════════════════════════════════════════════════════════════
 *  FAMILIES — the torso's outline at stations s (0 tail base → 1 neck root) as [s, half-width, half-height above,
 *  half-height below], normalised (× width and depth, which are fractions of the torso length L); the skull's at u
 *  (0 occiput → 1 bill base) as [u, half-width, crown, chin, rise] × head width; the legs' tibia (× tarsus) and how far
 *  they are straightened (crouch), and where the hip sits along the torso.
 * ════════════════════════════════════════════════════════════════════════════ */
const SKULL_SONG = [[0, 0.4, 0.4, 0.38, 0], [0.22, 0.5, 0.5, 0.44, 0.02], [0.5, 0.5, 0.5, 0.42, 0.03], [0.74, 0.43, 0.44, 0.36, 0.01], [0.9, 0.32, 0.32, 0.28, -0.02], [1, 0.25, 0.25, 0.22, -0.04]];
const FAMILIES = {
  passerine: { torso: [[0, 0.32, 0.3, 0.32], [0.15, 0.68, 0.7, 0.78], [0.4, 0.95, 0.92, 1.0], [0.62, 1.0, 0.95, 1.05], [0.82, 0.86, 0.82, 0.9], [1, 0.56, 0.58, 0.6]], depth: 0.27, width: 0.26, tibK: 1.25, crouch: 0.72, sHip: 0.42, neckR: 0.82, skull: SKULL_SONG },
  corvid: { torso: [[0, 0.3, 0.28, 0.3], [0.15, 0.66, 0.68, 0.74], [0.4, 0.94, 0.9, 0.98], [0.62, 1.0, 0.94, 1.04], [0.82, 0.86, 0.82, 0.9], [1, 0.56, 0.56, 0.6]], depth: 0.26, width: 0.25, tibK: 1.25, crouch: 0.78, sHip: 0.42, neckR: 0.8,
    skull: [[0, 0.4, 0.4, 0.38, 0], [0.22, 0.5, 0.48, 0.44, 0.02], [0.5, 0.48, 0.44, 0.4, 0.01], [0.75, 0.4, 0.36, 0.33, -0.01], [0.92, 0.32, 0.3, 0.27, -0.03], [1, 0.28, 0.27, 0.24, -0.04]] },
  columbid: { torso: [[0, 0.3, 0.28, 0.3], [0.15, 0.66, 0.66, 0.74], [0.4, 0.95, 0.9, 1.02], [0.64, 1.0, 0.95, 1.12], [0.84, 0.86, 0.85, 1.0], [1, 0.52, 0.55, 0.6]], depth: 0.3, width: 0.27, tibK: 1.45, crouch: 0.8, sHip: 0.42, neckR: 0.72, skull: SKULL_SONG },
  raptor: { torso: [[0, 0.32, 0.3, 0.3], [0.15, 0.66, 0.7, 0.74], [0.4, 0.94, 0.94, 1.0], [0.64, 1.0, 0.98, 1.12], [0.84, 0.88, 0.86, 1.0], [1, 0.6, 0.6, 0.65]], depth: 0.28, width: 0.27, tibK: 1.2, crouch: 0.78, sHip: 0.42, neckR: 0.84,
    skull: [[0, 0.4, 0.38, 0.4, 0], [0.22, 0.5, 0.46, 0.44, 0.02], [0.5, 0.5, 0.46, 0.42, 0.02], [0.72, 0.44, 0.42, 0.36, 0], [0.88, 0.36, 0.34, 0.3, -0.02], [1, 0.3, 0.3, 0.26, -0.03]] },
  owl: { torso: [[0, 0.4, 0.35, 0.38], [0.15, 0.75, 0.72, 0.8], [0.4, 0.98, 0.95, 1.02], [0.65, 1.0, 0.98, 1.05], [0.85, 0.92, 0.9, 0.95], [1, 0.75, 0.72, 0.75]], depth: 0.32, width: 0.33, tibK: 1.0, crouch: 0.75, sHip: 0.4, neckR: 0.9,
    skull: [[0, 0.44, 0.44, 0.42, 0], [0.3, 0.5, 0.52, 0.48, 0.02], [0.6, 0.5, 0.5, 0.47, 0], [0.85, 0.47, 0.46, 0.44, -0.01], [1, 0.42, 0.4, 0.38, -0.02]] },
  parrot: { torso: [[0, 0.32, 0.3, 0.3], [0.15, 0.66, 0.7, 0.74], [0.4, 0.94, 0.94, 1.0], [0.64, 1.0, 0.98, 1.1], [0.84, 0.88, 0.86, 1.0], [1, 0.6, 0.6, 0.65]], depth: 0.28, width: 0.27, tibK: 2.0, crouch: 0.68, sHip: 0.42, neckR: 0.86,
    skull: [[0, 0.42, 0.42, 0.4, 0], [0.25, 0.52, 0.54, 0.46, 0.03], [0.5, 0.52, 0.54, 0.44, 0.04], [0.75, 0.46, 0.5, 0.4, 0.03], [0.9, 0.4, 0.46, 0.36, 0.02], [1, 0.36, 0.44, 0.33, 0.01]] },
  wader: { torso: [[0, 0.3, 0.26, 0.26], [0.15, 0.62, 0.62, 0.62], [0.4, 0.92, 0.9, 0.9], [0.65, 1.0, 0.92, 0.98], [0.85, 0.85, 0.8, 0.86], [1, 0.5, 0.5, 0.52]], depth: 0.22, width: 0.22, tibK: 1.25, crouch: 0.93, sHip: 0.42, neckR: 0.72,
    skull: [[0, 0.38, 0.38, 0.36, 0], [0.25, 0.46, 0.44, 0.4, 0.01], [0.55, 0.44, 0.4, 0.36, 0], [0.8, 0.36, 0.32, 0.28, -0.02], [1, 0.28, 0.24, 0.22, -0.03]] },
  anatid: { torso: [[0, 0.36, 0.32, 0.34], [0.15, 0.75, 0.66, 0.78], [0.4, 0.97, 0.86, 1.0], [0.65, 1.0, 0.88, 1.02], [0.85, 0.88, 0.8, 0.92], [1, 0.55, 0.55, 0.58]], depth: 0.25, width: 0.3, tibK: 1.0, crouch: 0.74, sHip: 0.36, neckR: 0.72,
    skull: [[0, 0.4, 0.38, 0.38, 0], [0.25, 0.48, 0.46, 0.42, 0.02], [0.55, 0.46, 0.42, 0.38, 0.01], [0.8, 0.38, 0.32, 0.3, -0.02], [1, 0.32, 0.24, 0.22, -0.04]] },
  seabird: { torso: [[0, 0.3, 0.28, 0.3], [0.15, 0.68, 0.66, 0.74], [0.4, 0.96, 0.9, 1.0], [0.64, 1.0, 0.92, 1.04], [0.84, 0.86, 0.8, 0.88], [1, 0.56, 0.55, 0.58]], depth: 0.24, width: 0.25, tibK: 1.1, crouch: 0.76, sHip: 0.4, neckR: 0.8,
    skull: [[0, 0.4, 0.4, 0.38, 0], [0.25, 0.48, 0.47, 0.42, 0.02], [0.55, 0.46, 0.44, 0.38, 0.01], [0.8, 0.38, 0.34, 0.3, -0.02], [1, 0.3, 0.27, 0.24, -0.04]] },
  penguin: { torso: [[0, 0.34, 0.3, 0.3], [0.15, 0.72, 0.74, 0.8], [0.4, 0.98, 0.96, 1.02], [0.62, 1.0, 0.96, 1.04], [0.82, 0.84, 0.82, 0.88], [1, 0.58, 0.56, 0.6]], depth: 0.2, width: 0.2, tibK: 0.6, crouch: 0.6, sHip: 0.22, neckR: 0.95,
    skull: [[0, 0.42, 0.4, 0.4, 0], [0.3, 0.46, 0.44, 0.42, 0.01], [0.6, 0.42, 0.38, 0.36, 0], [0.85, 0.32, 0.28, 0.26, -0.02], [1, 0.24, 0.2, 0.19, -0.03]] },
  ratite: { torso: [[0, 0.4, 0.38, 0.4], [0.15, 0.8, 0.8, 0.82], [0.4, 1.0, 1.0, 1.0], [0.65, 0.98, 0.98, 0.98], [0.85, 0.8, 0.8, 0.8], [1, 0.42, 0.42, 0.42]], depth: 0.3, width: 0.3, tibK: 1.05, crouch: 0.92, sHip: 0.45, neckR: 0.62,
    skull: [[0, 0.38, 0.34, 0.34, 0], [0.3, 0.46, 0.4, 0.36, 0.01], [0.6, 0.44, 0.34, 0.3, 0], [0.85, 0.38, 0.24, 0.22, -0.02], [1, 0.34, 0.16, 0.16, -0.03]] },
  kiwi: { torso: [[0, 0.45, 0.42, 0.46], [0.15, 0.8, 0.78, 0.84], [0.4, 1.0, 0.98, 1.02], [0.65, 0.95, 0.94, 0.98], [0.85, 0.72, 0.7, 0.74], [1, 0.45, 0.44, 0.46]], depth: 0.35, width: 0.33, tibK: 1.0, crouch: 0.7, sHip: 0.42, neckR: 0.85,
    skull: [[0, 0.42, 0.4, 0.4, 0], [0.3, 0.48, 0.44, 0.42, 0], [0.6, 0.44, 0.38, 0.36, -0.01], [0.85, 0.3, 0.24, 0.22, -0.03], [1, 0.14, 0.12, 0.12, -0.04]] },
  galliform: { torso: [[0, 0.36, 0.34, 0.34], [0.15, 0.72, 0.74, 0.8], [0.4, 0.97, 0.96, 1.04], [0.64, 1.0, 0.98, 1.12], [0.84, 0.86, 0.86, 1.0], [1, 0.52, 0.55, 0.6]], depth: 0.3, width: 0.27, tibK: 1.1, crouch: 0.86, sHip: 0.42, neckR: 0.76,
    skull: [[0, 0.38, 0.38, 0.36, 0], [0.25, 0.46, 0.46, 0.4, 0.02], [0.55, 0.46, 0.44, 0.38, 0.01], [0.8, 0.38, 0.36, 0.3, -0.01], [1, 0.3, 0.3, 0.26, -0.03]] },
  hummingbird: { torso: [[0, 0.3, 0.28, 0.28], [0.15, 0.64, 0.66, 0.7], [0.4, 0.94, 0.92, 0.98], [0.64, 1.0, 0.95, 1.04], [0.84, 0.86, 0.82, 0.88], [1, 0.58, 0.56, 0.6]], depth: 0.26, width: 0.25, tibK: 1.9, crouch: 0.55, sHip: 0.42, neckR: 0.82, skull: SKULL_SONG },
  bigbill: { torso: [[0, 0.32, 0.3, 0.3], [0.15, 0.66, 0.7, 0.74], [0.4, 0.94, 0.94, 1.0], [0.64, 1.0, 0.97, 1.08], [0.84, 0.88, 0.86, 0.96], [1, 0.6, 0.6, 0.64]], depth: 0.27, width: 0.26, tibK: 1.1, crouch: 0.72, sHip: 0.42, neckR: 0.86,
    skull: [[0, 0.42, 0.42, 0.4, 0], [0.25, 0.5, 0.5, 0.44, 0.02], [0.5, 0.5, 0.52, 0.44, 0.03], [0.75, 0.46, 0.54, 0.44, 0.04], [0.9, 0.42, 0.58, 0.44, 0.05], [1, 0.4, 0.62, 0.45, 0.06]] },
};

const BP = (body, belly, wing, flight, head, face, accent, beak, leg, eye = '#1a120a', extra = {}) => ({ body, belly, wing, flight, head, face, accent, beak, leg, eye, pupil: '#050505', jaw: beak, ...extra });
const E = (o = {}) => ({ r: 0.14, u: 0.6, at: [0.88, 0.22], yaw: 82, up: 0.04, pupil: 0.48, ...o });

/* ════════════════════════════════════════════════════════════════════════════
 *  SPECIES — M: field measurements of an adult, cm: [total length, wingspan, wing chord, tail, tarsus, culmen, bill depth,
 *  head width, carried neck]; pitch: the torso's tilt (°, front up); neckAng / neckShape: the neck's carriage (° above
 *  level, or [u, °] keys along it); headAng: the bill's tilt below level.
 * ════════════════════════════════════════════════════════════════════════════ */
const SPECIES = {
  sparrow: { label: 'House sparrow', sci: 'Passer domesticus', fam: 'passerine', M: [15.5, 23, 7.6, 5.8, 1.9, 1.15, 0.85, 1.65, 0.7], pitch: 28, neckAng: 62, headAng: 6,
    eye: E(), bill: { style: 'cone', w: 0.78 }, wing: { tip: 'round' }, tail: { shape: 'square', lift: 6 }, feet: 'perch',
    palette: BP('#8a6a48', '#c9c0b0', '#7a5432', '#4a3a2a', '#7d7d78', '#2a2420', '#e8e0d0', '#3a3530', '#c49a7a'),
    plume: { regions: { crown: 'head', nape: 'wing', cheek: 'accent', throat: 'face', lores: 'face', breast: 'belly', flank: 'belly' }, headSide: 'wing', mask: { zone: 'face', w: 0.05, from: 0.62 }, bib: { zone: 'face', len: 0.14 },
      wingbars: [{ at: 0.33, zone: 'accent' }], edged: 'body', marks: [{ type: 'streaks', on: ['mantle'], zone: 'flight', f: 26, w: 0.22 }] } },
  robin: { label: 'European robin', sci: 'Erithacus rubecula', fam: 'passerine', M: [14, 21, 7.2, 5.9, 2.5, 1.1, 0.45, 1.55, 0.6], pitch: 30, neckAng: 65, headAng: 4,
    eye: E({ r: 0.16 }), bill: { style: 'thin', w: 0.8 }, wing: { tip: 'round' }, tail: { shape: 'square', lift: 10 }, feet: 'perch', depth: 0.3, width: 0.28, fluff: 0.02,
    palette: BP('#7a6a4a', '#e8e2d6', '#6e5e40', '#5a4a34', '#7a6a4a', '#d9762e', '#a8a8a0', '#2a2420', '#b08a6a'),
    plume: { regions: { crown: 'head', cheek: 'face', throat: 'face', lores: 'face', forehead: 'face', breast: 'face', flank: 'body', belly: 'belly' }, eyebrow: { zone: 'accent', w: 0.06 } } },
  'american-robin': { label: 'American robin', sci: 'Turdus migratorius', fam: 'passerine', M: [25, 36, 13, 10, 3.2, 2.0, 0.65, 2.3, 1.2], pitch: 26, neckAng: 62, headAng: 4,
    eye: E({ r: 0.15, ring: 0.3, ringZone: 'belly' }), bill: { style: 'thin', w: 0.8 }, wing: { tip: 'round' }, tail: { shape: 'square', lift: 6 }, feet: 'perch',
    palette: BP('#5a5650', '#f2efe8', '#55514a', '#3e3b37', '#232120', '#232120', '#c8622e', '#e2b13a', '#7a6a5a'),
    plume: { regions: { crown: 'head', cheek: 'head', nape: 'head', throat: 'belly', breast: 'accent', flank: 'accent', belly: 'accent', vent: 'belly' }, marks: [{ type: 'streaks', on: ['throat', 'foreneck'], zone: 'head', f: 40, w: 0.18 }] } },
  'blue-jay': { label: 'Blue jay', sci: 'Cyanocitta cristata', fam: 'corvid', M: [28, 40, 13, 12.5, 3.4, 2.5, 1.0, 2.6, 1.2], pitch: 25, neckAng: 62, headAng: 4,
    eye: E({ r: 0.13 }), bill: { style: 'corvid', w: 0.8 }, wing: { tip: 'round' }, tail: { shape: 'round', lift: 6, n: 12 }, feet: 'perch',
    extras: { crest: { style: 'peak', h: 0.75, at: 0.4, sweep: 48, thk: 0.15, base: 0.34, zone: 'head' } },
    palette: BP('#5b86c4', '#eeeef0', '#3d6fbe', '#2f5cb0', '#6b97d4', '#f2f2f2', '#16181d', '#202226', '#2e3138'),
    plume: { regions: { crown: 'head', nape: 'head', cheek: 'face', throat: 'face', breast: 'belly', flank: 'belly' }, collar: { zone: 'accent', at: 0.3, w: 0.14, full: true }, mask: { zone: 'accent', w: 0.04, from: 0.68 },
      wingbars: [{ at: 0.34, zone: 'face', w: 0.025 }], tailBars: { zone: 'accent', n: 7, w: 0.12 }, tailTip: { zone: 'face', w: 0.1 }, marks: [{ type: 'bars', on: [], zone: 'accent' }] } },
  crow: { label: 'Carrion crow', sci: 'Corvus corone', fam: 'corvid', M: [48, 98, 32, 18, 6, 5.2, 2.0, 4.2, 2.2], pitch: 22, neckAng: 58, headAng: 5,
    eye: E({ r: 0.11 }), bill: { style: 'corvid', w: 0.78 }, wing: { tip: 'slotted' }, tail: { shape: 'round', lift: 4, n: 12 }, feet: 'perch', crouch: 0.72,
    palette: BP('#1a1a1e', '#1d1d22', '#1e1e24', '#141418', '#16161a', '#16161a', '#2a2a36', '#111114', '#1d1d20', '#1a1208'),
    plume: { marks: [{ type: 'scaled', on: ['mantle', 'breast'], zone: 'accent', f: 30, w: 0.05 }] } },
  cardinal: { label: 'Northern cardinal', sci: 'Cardinalis cardinalis', fam: 'passerine', M: [22, 28, 9.0, 10.2, 2.5, 1.7, 1.45, 2.1, 0.8], pitch: 30, neckAng: 66, headAng: 5,
    eye: E({ r: 0.13 }), bill: { style: 'cone', w: 0.85 }, wing: { tip: 'round' }, tail: { shape: 'round', lift: 8 }, feet: 'perch',
    extras: { crest: { style: 'peak', h: 0.95, at: 0.42, sweep: 42, thk: 0.14, base: 0.36, zone: 'head' } },
    palette: BP('#b82a24', '#d63a2c', '#a8221e', '#8a1c18', '#c8261f', '#141010', '#d8322a', '#e8742c', '#9a6a5a'),
    plume: { regions: { crown: 'head', throat: 'face', lores: 'face', breast: 'belly', flank: 'belly' }, mask: { zone: 'face', w: 0.1, from: 0.55 }, bib: { zone: 'face', len: 0.06 } } },
  pigeon: { label: 'Rock pigeon', sci: 'Columba livia', fam: 'columbid', M: [32, 66, 22, 11, 3.0, 1.8, 0.6, 2.7, 3.0], pitch: 14, neckAng: 60, headAng: 2,
    eye: E({ r: 0.12 }), bill: { style: 'pigeon', w: 0.7, cereZone: 'face' }, wing: { tip: 'pointed' }, tail: { shape: 'round', lift: 2, n: 12 }, feet: 'perch',
    palette: BP('#8d949c', '#b5b9bd', '#a5abb1', '#3d4148', '#7e858d', '#d8d5c8', '#5b7d72', '#4a4b50', '#c66f75', '#e86f44'),
    plume: { regions: { crown: 'head', nape: 'accent', foreneck: 'accent', neckSide: 'accent', throat: 'head', breast: 'head', flank: 'belly', belly: 'belly', rump: 'belly' }, wingbars: [{ at: 0.38, zone: 'flight', w: 0.03 }, { at: 0.5, zone: 'flight', w: 0.03 }], tailTip: { zone: 'flight', w: 0.15 }, primaries: 'flight' } },
  'mourning-dove': { label: 'Mourning dove', sci: 'Zenaida macroura', fam: 'columbid', M: [30, 45, 14.5, 14, 2.2, 1.4, 0.45, 2.0, 1.5], pitch: 14, neckAng: 58, headAng: 2,
    eye: E({ r: 0.13, ring: 0.3, ringZone: 'accent' }), bill: { style: 'pigeon', w: 0.62 }, wing: { tip: 'pointed' }, tail: { shape: 'wedge', lift: 2, n: 14, w: 0.26 }, feet: 'perch',
    palette: BP('#a28c72', '#d9c3a6', '#9c8a76', '#5b5550', '#b6a894', '#d5c0a6', '#7fa1b0', '#262426', '#c1756f', '#1f1a1a'),
    plume: { regions: { crown: 'accent', breast: 'belly' }, wingSpots: 'flight', tailOuter: { zone: 'face', from: 0.7 } } },
  woodpecker: { label: 'Great spotted woodpecker', sci: 'Dendrocopos major', fam: 'passerine', M: [23, 38, 13, 8.5, 2.4, 2.8, 0.9, 2.4, 1.2], pitch: 55, neckAng: 72, headAng: 4,
    eye: E({ r: 0.12 }), bill: { style: 'chisel', w: 0.75 }, wing: { tip: 'round' }, tail: { shape: 'wedge', lift: -6, n: 12 }, feet: 'zygo', crouch: 0.55,
    palette: BP('#171719', '#eeeae0', '#202024', '#202024', '#171719', '#eeeae0', '#d12b27', '#343338', '#65616a', '#a13b32'),
    plume: { regions: { crown: 'head', nape: 'accent', cheek: 'face', throat: 'face', breast: 'belly', flank: 'belly', vent: 'accent' }, malar: { zone: 'head', w: 0.06 }, scapulars: 'face', wingSpots: 'face' } },
  'downy-woodpecker': { label: 'Downy woodpecker', sci: 'Dryobates pubescens', fam: 'passerine', M: [16, 28, 9.5, 6, 1.5, 1.6, 0.55, 1.6, 0.6], pitch: 55, neckAng: 72, headAng: 4,
    eye: E({ r: 0.13 }), bill: { style: 'chisel', w: 0.7 }, wing: { tip: 'round' }, tail: { shape: 'wedge', lift: -6, n: 12 }, feet: 'zygo', crouch: 0.55,
    palette: BP('#1b1b1e', '#f3f1ec', '#1f1f23', '#1c1c20', '#1b1b1e', '#f3f1ec', '#d0332c', '#2a2a2e', '#55525a', '#2a1a14'),
    plume: { regions: { crown: 'head', nape: 'accent', cheek: 'face', throat: 'face', breast: 'belly', flank: 'belly', mantle: 'face' }, mask: { zone: 'head', w: 0.07, from: 0.1 }, eyebrow: { zone: 'face', w: 0.05 }, wingSpots: 'face', tailOuter: { zone: 'face', from: 0.75 } } },
  kingfisher: { label: 'Common kingfisher', sci: 'Alcedo atthis', fam: 'passerine', M: [16, 25, 7.7, 3.5, 1.0, 3.8, 1.0, 2.1, 0.6], pitch: 38, neckAng: 60, headAng: 5,
    eye: E({ r: 0.12, u: 0.62 }), bill: { style: 'dagger', w: 0.85 }, wing: { tip: 'round' }, tail: { shape: 'round', lift: 0 }, feet: 'tiny', crouch: 0.45, depth: 0.3, width: 0.28,
    palette: BP('#2a96c0', '#e8a14d', '#1678a0', '#205c79', '#147aa0', '#f0e5d0', '#d97f32', '#25292c', '#c56d52', '#2a1b12'),
    plume: { regions: { crown: 'head', cheek: 'accent', throat: 'face', breast: 'belly', flank: 'belly', belly: 'belly' }, mask: { zone: 'accent', w: 0.07, from: 0.35 }, malar: { zone: 'head', w: 0.06 }, marks: [{ type: 'spots', on: ['crown'], zone: 'body', f: 60, w: 0.18 }] } },
  macaw: { label: 'Scarlet macaw', sci: 'Ara macao', fam: 'parrot', M: [84, 100, 39, 50, 3.2, 7.0, 6.5, 6.0, 2.5], Lt: 21, pitch: 56, tibK: 2.2, crouch: 0.8, neckAng: 78, headAng: 8,
    eye: E({ r: 0.1, u: 0.55, ring: 0.9, ringZone: 'face' }), bill: { style: 'parrot', w: 0.62, tipZone: null }, wing: { tip: 'pointed' }, tail: { shape: 'graduated', lift: 30, n: 12, w: 0.2 }, feet: 'zygo',
    palette: BP('#d8241e', '#d8241e', '#f2c21a', '#2a5ad8', '#d8241e', '#f2ede6', '#2a8a3a', '#efe6d0', '#5a5a60', '#e8e0b0', { jaw: '#1d1a1a' }),
    plume: { regions: { cheek: 'face', lores: 'face' }, coverts: 'wing', secondaries: 'flight', primaries: 'flight', wingbars: [{ at: 0.44, zone: 'accent', w: 0.05 }], tail: 'body', tailTip: { zone: 'flight', w: 0.25 } } },
  cockatoo: { label: 'Sulphur-crested cockatoo', sci: 'Cacatua galerita', fam: 'parrot', M: [48, 100, 32, 20, 2.8, 4.0, 3.8, 5.0, 2.0], pitch: 58, neckAng: 76, headAng: 8,
    eye: E({ r: 0.1, u: 0.56, ring: 0.5, ringZone: 'face' }), bill: { style: 'parrot', w: 0.62 }, wing: { tip: 'round' }, tail: { shape: 'round', lift: -8, n: 12 }, feet: 'zygo',
    extras: { crest: { style: 'recurve', n: 9, h: 1.9, from: 0.9, to: 0.35, zone: 'accent', vane: 0.26, curl: 0.7 } },
    palette: BP('#f3f2ec', '#f1f0ea', '#efeee8', '#f2ead0', '#f6f5f0', '#dfe8f0', '#f4cd2b', '#2b2c30', '#4f5054', '#1a1410'),
    plume: {} },
  owl: { label: 'Great horned owl', sci: 'Bubo virginianus', fam: 'owl', M: [55, 120, 36, 21, 6.5, 2.2, 2.2, 10, 1.5], Hl: 0.78, pitch: 72, neckAng: 85, headAng: 4,
    eye: E({ r: 0.17, u: 0.86, at: [0.48, 0.2], yaw: 18, pupil: 0.6 }), bill: { style: 'owl', w: 0.7, drop: 0.12 }, wing: { tip: 'round', top: 1.0 }, tail: { shape: 'round', lift: -6 }, feet: 'raptor', feathered: true, talons: 2.2,
    extras: { tufts: { h: 0.42, u: 0.72, zone: 'head' } },
    palette: BP('#6e6252', '#bfae92', '#62584a', '#4a4034', '#6e6252', '#c8a878', '#3a2e22', '#3a3632', '#bfae92', '#f2a81a'),
    plume: { disc: { wx: 0.5, ry: 0.46, cy: -0.04, zone: 'face', rim: 'accent' }, regions: { throat: 'belly' }, bib: { zone: 'belly', len: 0.08 }, marks: [{ type: 'bars', on: ['breast', 'belly', 'flank', 'thigh'], zone: 'accent', f: 34, w: 0.14 }, { type: 'mottle', on: ['mantle', 'crown', 'nape', 'rump'], zone: 'flight', f: 22, w: 0.45 }], tailBars: { zone: 'flight', n: 6, w: 0.2 } } },
  'barn-owl': { label: 'Barn owl', sci: 'Tyto alba', fam: 'owl', M: [35, 95, 29, 12, 6.5, 1.3, 1.2, 7.0, 1.5], Hl: 0.75, pitch: 68, neckAng: 82, headAng: 8,
    eye: E({ r: 0.135, u: 0.9, at: [0.42, 0.18], yaw: 14, pupil: 0.95 }), bill: { style: 'owl', w: 0.6, drop: 0.14 }, wing: { tip: 'round', top: 1.0 }, tail: { shape: 'square', lift: -4 }, feet: 'raptor', talons: 2.0, tibK: 1.25, crouch: 0.72,
    palette: BP('#c79a58', '#f5f0e7', '#cfa263', '#dccaa6', '#c79a58', '#f8f5ee', '#8a6440', '#dccdb6', '#cfbba3', '#120c08'),
    plume: { disc: { wx: 0.52, ry: 0.56, cy: -0.06, heart: 0.35, zone: 'face', rim: 'accent' }, regions: { throat: 'belly', breast: 'belly', flank: 'belly' }, marks: [{ type: 'spots', on: ['breast', 'belly', 'mantle', 'crown'], zone: 'accent', f: 40, w: 0.1 }] } },
  eagle: { label: 'Bald eagle', sci: 'Haliaeetus leucocephalus', fam: 'raptor', M: [82, 200, 58, 29, 9.5, 5.6, 4.0, 7.0, 6], pitch: 60, neckAng: 74, headAng: 8,
    eye: E({ r: 0.13, u: 0.6, at: [0.86, 0.32], yaw: 70 }), bill: { style: 'hook', w: 0.68 }, wing: { tip: 'slotted', foldK: 0.86 }, tail: { shape: 'wedge', lift: -8, n: 12, w: 0.36 }, feet: 'raptor', talons: 2.4, feathered: true,
    palette: BP('#3a2a1c', '#3e2e20', '#3a2a1c', '#2a1e14', '#f4f2ec', '#f4f2ec', '#f4f2ec', '#f2c21a', '#f2c21a', '#f2d24a'),
    plume: { regions: { crown: 'head', nape: 'head', throat: 'head', foreneck: 'head', neckSide: 'head', cheek: 'head', uppertail: 'accent', undertail: 'accent' }, tail: 'accent' } },
  falcon: { label: 'Peregrine falcon', sci: 'Falco peregrinus', fam: 'raptor', M: [42, 105, 31, 15, 5.0, 2.3, 2.0, 4.8, 2.5], pitch: 60, neckAng: 76, headAng: 6,
    eye: E({ r: 0.15, u: 0.6, at: [0.86, 0.28], yaw: 70, ring: 0.35, ringZone: 'leg' }), bill: { style: 'hook', w: 0.72, cereZone: 'leg' }, wing: { tip: 'pointed' }, tail: { shape: 'square', lift: -8 }, feet: 'raptor', talons: 1.8,
    palette: BP('#5a6672', '#f0ebe0', '#4f5a66', '#2a3036', '#262b31', '#f0ebe0', '#4a5058', '#60636a', '#e3b52b', '#33251a'),
    plume: { regions: { crown: 'head', nape: 'head', cheek: 'face', throat: 'face' }, malar: { zone: 'head', w: 0.16 }, marks: [{ type: 'bars', on: ['belly', 'flank', 'thigh'], zone: 'accent', f: 40, w: 0.16 }, { type: 'spots', on: ['breast'], zone: 'accent', f: 46, w: 0.1 }], tailBars: { zone: 'flight', n: 6, w: 0.18 } } },
  flamingo: { label: 'Greater flamingo', sci: 'Phoenicopterus roseus', fam: 'wader', M: [130, 150, 40, 14, 32, 12, 4.5, 4.5, 55], pitch: 6, neckShape: [[0, 40], [0.38, 100], [0.75, 70], [1, 12]], headAng: 30,
    eye: E({ r: 0.12 }), bill: { style: 'bent', w: 0.85, tipZone: 'flight', tipFrom: 0.62 }, wing: { tip: 'pointed', foldK: 0.95 }, tail: { shape: 'round', lift: 0 }, feet: 'webbed', bareTibia: 0.62, tibK: 1.15,
    palette: BP('#f2a0a8', '#f4b0b6', '#e8707e', '#1d1a1a', '#f2a0a8', '#1d1a1a', '#e8707e', '#f2e6d6', '#e88a96', '#f2d24a'),
    plume: { coverts: 'accent', secondaries: 'flight', primaries: 'flight' } },
  heron: { label: 'Grey heron', sci: 'Ardea cinerea', fam: 'wader', M: [95, 175, 45, 18, 16, 12, 2.6, 4.4, 30], pitch: 24, neckShape: [[0, 30], [0.35, 100], [0.72, 62], [1, 18]], headAng: 6,
    eye: E({ r: 0.11 }), bill: { style: 'dagger', w: 0.7 }, wing: { tip: 'round' }, tail: { shape: 'square', lift: -6 }, feet: 'wader', bareTibia: 0.45,
    extras: { crest: { style: 'lay', n: 3, h: 1.6, zone: 'face', vane: 0.08 } },
    palette: BP('#8a8e94', '#e8e8e4', '#7a7e84', '#2a2c30', '#f0f0ec', '#1d1d20', '#1d1d20', '#d8b03a', '#b8a060', '#f2d24a'),
    plume: { regions: { crown: 'head', foreneck: 'head', breast: 'belly' }, eyebrow: { zone: 'face', w: 0.12 }, marks: [{ type: 'streaks', on: ['foreneck'], zone: 'face', f: 18, w: 0.16 }] } },
  crane: { label: 'Sandhill crane', sci: 'Antigone canadensis', fam: 'wader', M: [110, 190, 52, 20, 23, 11, 2.8, 5.2, 34], pitch: 10, neckShape: [[0, 55], [0.6, 82], [1, 66]], headAng: 10,
    eye: E({ r: 0.1 }), bill: { style: 'dagger', w: 0.7 }, wing: { tip: 'round', foldK: 1.05, droop: 0.2 }, tail: { shape: 'round', lift: -12 }, feet: 'wader', bareTibia: 0.5,
    palette: BP('#97948c', '#b8b5ae', '#8f8c84', '#3a3b3d', '#9a9b96', '#e8e0d2', '#b92f2c', '#565453', '#333638', '#c9883b'),
    plume: { regions: { crown: 'accent', forehead: 'accent', cheek: 'face', throat: 'face' } } },
  spoonbill: { label: 'Roseate spoonbill', sci: 'Platalea ajaja', fam: 'wader', M: [80, 125, 36, 11, 12, 17, 2.4, 4.6, 18], pitch: 14, neckShape: [[0, 35], [0.5, 75], [1, 30]], headAng: 22,
    eye: E({ r: 0.1 }), bill: { style: 'spoon', w: 0.9 }, wing: { tip: 'round' }, tail: { shape: 'round', lift: -6 }, feet: 'wader', bareTibia: 0.42,
    palette: BP('#ef91a5', '#f6b6bd', '#dd6f91', '#bd496b', '#f19bad', '#f4a1b0', '#e56e88', '#8b8b82', '#d9959c', '#f6db81'),
    plume: { regions: { crown: 'face', throat: 'face', foreneck: 'belly', neckSide: 'belly', nape: 'belly', mantle: 'belly' }, coverts: 'accent' } },
  stilt: { label: 'Black-necked stilt', sci: 'Himantopus mexicanus', fam: 'wader', M: [36, 70, 22, 8, 10.5, 6.2, 0.6, 2.2, 4.5], pitch: 10, neckAng: 55, headAng: 4,
    eye: E({ r: 0.12, u: 0.62 }), bill: { style: 'needle', w: 0.9 }, wing: { tip: 'pointed', foldK: 1.05 }, tail: { shape: 'square', lift: 0 }, feet: 'wader', bareTibia: 0.62, tibK: 1.4,
    palette: BP('#17191c', '#f4f1ea', '#1c1d20', '#242529', '#17191c', '#f4f1ea', '#f4f1ea', '#1e2022', '#ee7f82', '#d94f54'),
    plume: { regions: { crown: 'head', nape: 'head', cheek: 'head', throat: 'face', foreneck: 'face', breast: 'belly' }, eyebrow: { zone: 'face', w: 0.06 } } },
  swan: { label: 'Mute swan', sci: 'Cygnus olor', fam: 'anatid', M: [150, 220, 59, 23, 11, 10, 4.0, 7.0, 52], pitch: 2, neckShape: [[0, 60], [0.35, 100], [0.75, 76], [1, 16]], headAng: 26,
    eye: E({ r: 0.09 }), bill: { style: 'flat', w: 0.95, knob: 0.55, knobZone: 'face', nailZone: 'face' }, wing: { tip: 'round', top: 1.3, loft: 0.08 }, tail: { shape: 'wedge', lift: 12 }, feet: 'webbed', crouch: 0.62,
    palette: BP('#f6f4ee', '#f2f0ea', '#f4f2ec', '#eceae4', '#f6f4ee', '#1d1d1d', '#f6f4ee', '#e8742c', '#2a2826'),
    plume: { regions: { lores: 'face', throat: 'head', foreneck: 'head', neckSide: 'head' } } },
  duck: { label: 'Mallard', sci: 'Anas platyrhynchos', fam: 'anatid', M: [58, 90, 27, 9, 4.4, 5.5, 2.2, 4.6, 9], pitch: 6, neckAng: 72, headAng: 6,
    eye: E({ r: 0.1 }), bill: { style: 'flat', w: 1.05, nailZone: 'leg' }, wing: { tip: 'pointed', top: 1.25 }, tail: { shape: 'round', lift: 14 }, feet: 'webbed',
    palette: BP('#8a8a86', '#d8d4cc', '#7a766e', '#5a5650', '#1e6a3a', '#f4f2ec', '#6a3a2a', '#e8c43a', '#e8823a'),
    plume: { regions: { crown: 'head', nape: 'head', cheek: 'head', throat: 'head', foreneck: 'head', neckSide: 'head', breast: 'accent', mantle: 'wing', rump: 'flight' }, collar: { zone: 'face', at: 0.25, w: 0.07, full: true }, speculum: { zone: 'flight', from: 0.45, to: 0.62 }, wingbars: [{ at: 0.43, zone: 'face', w: 0.02 }, { at: 0.64, zone: 'face', w: 0.02 }], tail: 'belly' } },
  puffin: { label: 'Atlantic puffin', sci: 'Fratercula arctica', fam: 'seabird', M: [30, 55, 16, 5, 2.6, 4.8, 3.8, 3.8, 2.0], pitch: 55, tibK: 2.2, neckAng: 70, headAng: 4,
    eye: E({ r: 0.1, ring: 0.45, ringZone: 'accent' }), bill: { style: 'puffin', w: 0.42, tipZone: 'accent', tipFrom: 0.42, cereZone: 'beak' }, wing: { tip: 'pointed' }, tail: { shape: 'square', lift: 4 }, feet: 'webbed', depth: 0.3, width: 0.3,
    palette: BP('#1b2024', '#f0eee5', '#22282d', '#31363b', '#171a1d', '#ded9ca', '#e46d35', '#8a9298', '#e36b3d', '#59402d'),
    plume: { regions: { crown: 'head', nape: 'head', cheek: 'face', throat: 'head', lores: 'face', foreneck: 'head' }, collar: { zone: 'head', at: 0.4, w: 0.4, full: true } } },
  penguin: { label: 'Emperor penguin', sci: 'Aptenodytes forsteri', fam: 'penguin', M: [115, 60, 33, 7, 5, 11, 2.8, 9.5, 10], pitch: 80, restsOnTail: true, sHip: 0.1, crouch: 0.92, neckAng: 86, headAng: 0,
    eye: E({ r: 0.07, u: 0.62 }), bill: { style: 'penguin', w: 0.7, tipZone: null }, wing: { tip: 'round', flipper: true, top: 0.6, bot: -0.3, foldK: 0.95 }, tail: { shape: 'wedge', lift: -20, n: 10, w: 0.3 }, feet: 'webbed', crouch: 0.6,
    palette: BP('#1d2228', '#f4f2ea', '#1d2228', '#1d2228', '#15181c', '#f2b23a', '#f2b23a', '#1d1d20', '#1d1d20', '#1a120a', { jaw: '#e8923a' }),
    plume: { regions: { crown: 'head', nape: 'head', cheek: 'head', throat: 'face', foreneck: 'accent', breast: 'belly', flank: 'belly' }, backUp: 0.05, bib: { zone: 'face', len: 0.04 } } },
  ostrich: { label: 'Ostrich', sci: 'Struthio camelus', fam: 'ratite', M: [210, 200, 80, 45, 48, 13, 4.5, 9.5, 85], Lt: 98, depth: 0.34, width: 0.3, pitch: 12, neckShape: [[0, 70], [0.5, 88], [1, 80]], headAng: 6,
    eye: E({ r: 0.16, u: 0.6, at: [0.88, 0.3] }), bill: { style: 'ostrich', w: 1.6 }, wing: { tip: 'round', top: 0.8, bot: -0.5, foldK: 0.7 }, tail: { shape: 'round', lift: -28, n: 14, w: 0.6, roof: 35, featherW: 1.6, droop: 0.2 }, feet: 'ratite', bareTibia: 0.85, thighK: 0.8,
    palette: BP('#1d1b1a', '#1d1b1a', '#1d1b1a', '#f2f0ea', '#c8a49a', '#d8b0a4', '#f2f0ea', '#c89a7a', '#d8a098'),
    plume: { regions: { crown: 'head', nape: 'head', throat: 'head', foreneck: 'head', neckSide: 'head', thigh: 'head' }, primaries: 'flight', secondaries: 'flight', wingTip: { zone: 'flight', from: 0.5, spread: 0.6 }, tail: 'flight' } },
  kiwi: { label: 'North Island brown kiwi', sci: 'Apteryx mantelli', fam: 'kiwi', M: [45, 8, 3, 0.5, 7.5, 13, 1.4, 4.6, 4], pitch: 12, neckAng: 30, headAng: 32,
    eye: E({ r: 0.06 }), bill: { style: 'probe', w: 0.9 }, wing: { tip: 'round', hidden: true }, tail: { shape: 'round', n: 1, hidden: true }, feet: 'perch', toeK: 0.7, legThk: 0.2,
    palette: BP('#65503c', '#755e47', '#594532', '#493929', '#6c5540', '#705944', '#8b7459', '#b79b79', '#8f7b64', '#2b2118'),
    fluff: 0.04, plume: { marks: [{ type: 'streaks', on: ['mantle', 'flank', 'rump', 'nape'], zone: 'flight', f: 22, w: 0.16 }] } },
  turkey: { label: 'Wild turkey', sci: 'Meleagris gallopavo', fam: 'galliform', M: [110, 140, 50, 42, 17, 3.5, 2.0, 5.0, 18], pitch: 18, neckAng: 74, headAng: 6,
    eye: E({ r: 0.1 }), bill: { style: 'chicken', w: 0.8 }, wing: { tip: 'round' }, tail: { shape: 'round', lift: -22, n: 18, w: 0.5, roof: 18, fan: 12 }, feet: 'galliform', spur: true,
    extras: { wattle: { len: 0.9, zone: 'face' }, snood: 0.9 },
    palette: BP('#3b2b21', '#46352a', '#514031', '#2a2420', '#4c6e83', '#9c3c3c', '#c09a55', '#d6b45f', '#b66d63', '#2a1a12', { jaw: '#7a5a34' }),
    plume: { regions: { crown: 'head', nape: 'head', cheek: 'head', throat: 'face', foreneck: 'face' }, marks: [{ type: 'scaled', on: ['mantle', 'breast', 'flank', 'belly'], zone: 'flight', f: 30, w: 0.08 }], wingbars: [{ at: 0.5, zone: 'belly', w: 0.04 }, { at: 0.58, zone: 'belly', w: 0.03 }], tailTip: { zone: 'accent', w: 0.12 } } },
  rooster: { label: 'Rooster', sci: 'Gallus gallus domesticus', fam: 'galliform', M: [70, 80, 23, 30, 10, 3.0, 2.0, 4.2, 12], pitch: 24, neckAng: 78, headAng: 4,
    eye: E({ r: 0.11 }), bill: { style: 'chicken', w: 0.78 }, wing: { tip: 'round' }, tail: { shape: 'graduated', lift: 42, n: 16, w: 0.55, fan: 20, roof: 66, droop: 0.62, featherW: 1.5 }, feet: 'galliform', spur: true,
    extras: { comb: { h: 0.75, from: 0.25, to: 0.98, zone: 'face', points: 5.5 }, wattle: { len: 0.8, zone: 'face' } },
    palette: BP('#a8381e', '#1d2a22', '#8a2a14', '#1d2a22', '#d8742a', '#d8241e', '#e88a2a', '#e8c43a', '#e8c43a', '#d8742a'),
    plume: { regions: { crown: 'head', nape: 'accent', neckSide: 'accent', foreneck: 'belly', throat: 'face', cheek: 'face', breast: 'belly', flank: 'belly', rump: 'accent' }, coverts: 'body', tail: 'belly' } },
  peacock: { label: 'Indian peafowl', sci: 'Pavo cristatus', fam: 'galliform', M: [110, 140, 46, 45, 13, 4.0, 1.8, 4.2, 20], pitch: 16, neckAng: 78, headAng: 5,
    eye: E({ r: 0.1, ring: 0.6, ringZone: 'face' }), bill: { style: 'chicken', w: 0.7 }, wing: { tip: 'round' }, tail: { shape: 'square', lift: -4, n: 12, train: { n: 44, len: 1.45, fan: 9, w: 0.055, zone: 'flight', ring: 'accent', heart: 'body', rim: 'wing' } }, feet: 'galliform', spur: true,
    extras: { crest: { style: 'plumes', n: 9, h: 1.3, from: 0.55, to: 0.25, spread: 0.3, lean: 0.1, tipZone: 'head' } },
    palette: BP('#1e5ac8', '#1a3a7a', '#c8b48a', '#6a4a2a', '#1e5ac8', '#f2f0ea', '#e8c43a', '#d8c8b0', '#a8a098', '#1a120a', { flight: '#2a8a4a' }),
    plume: { regions: { crown: 'head', nape: 'head', foreneck: 'head', neckSide: 'head', breast: 'head', mantle: 'flight', rump: 'flight' }, mask: { zone: 'face', w: 0.05, from: 0.2 }, coverts: 'wing', marks: [{ type: 'scaled', on: ['mantle', 'rump'], zone: 'belly', f: 40, w: 0.06 }] } },
  hummingbird: { label: 'Ruby-throated hummingbird', sci: 'Archilochus colubris', fam: 'hummingbird', M: [8.5, 10.5, 4.4, 2.8, 0.5, 1.8, 0.2, 1.05, 0.3], pitch: 55, neckAng: 78, headAng: 0,
    eye: E({ r: 0.15 }), bill: { style: 'needle', w: 0.9 }, wing: { tip: 'pointed', foldK: 1.0 }, tail: { shape: 'fork', lift: 16, n: 10 }, feet: 'tiny', legThk: 0.18, toeK: 1.2,
    palette: BP('#2a8a4a', '#d8d8d0', '#2a6a3a', '#3a3a3a', '#2a8a4a', '#c8202a', '#d8241e', '#1d1d1d', '#2a2a2a'),
    plume: { regions: { crown: 'head', throat: 'face', foreneck: 'face', breast: 'belly', flank: 'body' }, throatUp: 0.1 } },
  pelican: { label: 'Brown pelican', sci: 'Pelecanus occidentalis', fam: 'anatid', M: [125, 220, 52, 15, 7.5, 31, 4.0, 7.0, 25], pitch: 12, neckShape: [[0, 78], [0.5, 100], [1, 108]], headAng: 30,
    eye: E({ r: 0.07 }), bill: { style: 'pouch', w: 1.1, pouchZone: 'flight' }, wing: { tip: 'slotted', top: 1.2 }, tail: { shape: 'round', lift: 0 }, feet: 'webbed', depth: 0.3, width: 0.3,
    palette: BP('#8a8884', '#7a7874', '#9a958c', '#3a3836', '#f2eed8', '#5a3a2a', '#e8d870', '#a89a8a', '#3a3a3a'),
    plume: { regions: { crown: 'accent', cheek: 'head', throat: 'head', nape: 'face', neckSide: 'face', foreneck: 'head' }, marks: [{ type: 'scaled', on: ['mantle', 'flank'], zone: 'flight', f: 24, w: 0.06 }] } },
  toucan: { label: 'Toco toucan', sci: 'Ramphastos toco', fam: 'bigbill', M: [60, 75, 24, 17, 5.0, 19, 7.0, 5.5, 2.5], pitch: 50, neckAng: 80, headAng: -2,
    eye: E({ r: 0.1, u: 0.5, ring: 1.0, ringZone: 'accent' }), bill: { style: 'toucan', w: 0.55, tipZone: 'flight', tipFrom: 0.86 }, wing: { tip: 'round' }, tail: { shape: 'square', lift: -6 }, feet: 'zygo',
    palette: BP('#141416', '#c8242a', '#141416', '#141416', '#141416', '#f4f2ea', '#3ab8e8', '#f28a1a', '#4a6ab8'),
    plume: { regions: { throat: 'face', cheek: 'face', foreneck: 'face', breast: 'body', belly: 'body', flank: 'body', thigh: 'body', vent: 'belly', uppertail: 'face', undertail: 'belly' }, bib: { zone: 'face', len: 0.12 } } },
  hornbill: { label: 'Great hornbill', sci: 'Buceros bicornis', fam: 'bigbill', M: [105, 165, 48, 38, 6.0, 28, 6.0, 7.0, 8], pitch: 36, neckAng: 70, headAng: 6,
    eye: E({ r: 0.09, u: 0.5 }), bill: { style: 'hornbill', w: 0.55, casque: { len: 0.6, h: 0.9, zone: 'accent' } }, wing: { tip: 'slotted' }, tail: { shape: 'graduated', lift: -8, n: 10, w: 0.3 }, feet: 'perch',
    palette: BP('#17181b', '#ece8dc', '#1b1c1f', '#efe9d6', '#1b1c1f', '#101012', '#ede0a2', '#f0c033', '#55524c', '#c8352a', { jaw: '#efd57c' }),
    plume: { regions: { nape: 'accent', neckSide: 'accent', foreneck: 'accent', cheek: 'face', throat: 'face' }, wingbars: [{ at: 0.42, zone: 'accent', w: 0.04 }], tail: 'belly', tailBars: { zone: 'face', n: 1, w: 0.2 } } },
  albatross: { label: 'Wandering albatross', sci: 'Diomedea exulans', fam: 'seabird', M: [115, 310, 66, 20, 12, 16.5, 4.5, 7.5, 8], pitch: 8, neckAng: 48, headAng: 10,
    eye: E({ r: 0.08 }), bill: { style: 'albatross', w: 0.7 }, wing: { tip: 'pointed', segs: [0.3, 0.38, 0.32], chordK: 0.5 }, tail: { shape: 'wedge', lift: 4 }, feet: 'webbed',
    palette: BP('#f4f2e9', '#f7f5ed', '#4a4b4e', '#24262a', '#f7f5ed', '#f5f1e6', '#d6c7ab', '#e1c7a8', '#c8b59c', '#3c2c20'),
    plume: { scapulars: 'wing', marks: [{ type: 'bars', on: ['mantle', 'nape'], zone: 'beak', f: 90, w: 0.06 }] } },
  seagull: { label: 'Herring gull', sci: 'Larus argentatus', fam: 'seabird', M: [60, 140, 42, 17, 6.5, 5.6, 2.0, 4.6, 6], pitch: 14, crouch: 0.86, neckAng: 62, headAng: 5,
    eye: E({ r: 0.1, ring: 0.3, ringZone: 'accent' }), bill: { style: 'gull', w: 0.68, tipZone: 'accent', tipFrom: 0.72, tipUpper: false }, wing: { tip: 'pointed' }, tail: { shape: 'square', lift: 2 }, feet: 'webbed', bareTibia: 0.2,
    palette: BP('#a8b0b8', '#f6f6f4', '#a8b0b8', '#1d1d20', '#f6f6f4', '#f6f6f4', '#d8241e', '#f2c21a', '#e8a8a0', '#f2e6a0'),
    plume: { regions: { mantle: 'body', rump: 'belly' }, scapulars: 'body', coverts: 'body', secondaries: 'body', wingTip: { zone: 'flight', from: 0.72, spread: 0.85 }, tail: 'belly' } },
};

/* ════════════════════════════════════════════════════════════════════════════
 *  CLIPS — perch (idle: the head turning in quick saccades, as birds look about), walk (feet planted, the knee-to-foot
 *  chain solved to each foot's place, the body bobbing; pigeons, doves and fowl hold the head still in the world and
 *  thrust it forward with each step), hop (both feet), peck, alert, flap (a downstroke with the wing spread and swept
 *  forward, an upstroke with it folded and the hand flipped back) and glide. In flight the body levels, the legs tuck
 *  and the spread wings replace the folded ones (bone scale keys). Walk clips carry userData { gait, stride, speed,
 *  hipH } for ground-speed playback.
 * ════════════════════════════════════════════════════════════════════════════ */
function birdMotion(S, p, L, rig) {
  const info = {
    S, L, bones: rig.list.map(e => e.name), has: Object.fromEntries(rig.list.map(e => [e.name, true])),
    rest: Object.fromEntries(rig.list.map(e => [e.name, (e.parent ? e.head.clone().sub(e.parent.head) : e.head.clone()).toArray()])),
    parent: Object.fromEntries(rig.list.map(e => [e.name, e.parent ? e.parent.name : null])),
    headV: Object.fromEntries(rig.list.map(e => [e.name, e.head.clone()])),
    moving: ['Root', 'Hips', 'Head'], scaled: ['WingL', 'WingR', 'WingFoldL', 'WingFoldR'],
  };
  info.legs = SIDES.map(([sd, sx]) => {
    const b = ['Thigh', 'Shin', 'Tarsus', 'Toe'].map(n => n + sx), J = b.map(n => info.headV[n].clone());
    return { sd, sx, bones: b, knee: J[1], ankle: J[2], foot: J[3], lt: J[1].distanceTo(J[2]), ls: J[2].distanceTo(J[3]) };
  });
  info.hipH = info.headV.Hips.y;
  const lg = info.legs[0], reach = 0.95 * (lg.lt + lg.ls), h = lg.knee.y - lg.foot.y;
  const half = Math.sqrt(Math.max(0, reach * reach - h * h)) * 0.7;
  const duty = 0.6, lambda = Math.max(0.05 * S.L, (2 * half) / duty * 0.9);
  const speed = Math.sqrt(0.22 * 9.81 * info.hipH);
  info.walk = { duty, stride: lambda, speed, dur: lambda / speed, bob: S.fam.bob ?? ['columbid', 'galliform'].includes(S.famKey) };
  info.flightless = !!S.flightless;
  return info;
}

/** Solves a leg: the knee rides with the body, the shin and tarsus reach the foot at F (the toes keep world rotation qT). */
function birdLeg(info, s, lg, F, qT) {
  let fk = fkOf(info, s);
  const K = fk(lg.bones[1]).p;
  const back = V3(0, 0, -1).applyQuaternion(fk('Hips').q).setY(0).normalize();
  const A = twoBone(K, F, lg.lt, lg.ls, back);
  const a0u = lg.ankle.clone().sub(lg.knee), a0l = lg.foot.clone().sub(lg.ankle), n0 = a0u.clone().cross(a0l);
  const a1u = A.clone().sub(K), a1l = F.clone().sub(A), n1 = a1u.clone().cross(a1l);
  setWorld(info, s, fk, lg.bones[1], frameRot(a0u, n0, a1u, n1));
  fk = fkOf(info, s);
  setWorld(info, s, fk, lg.bones[2], frameRot(a0l, n0, a1l, n1));
  fk = fkOf(info, s);
  setWorld(info, s, fk, lg.bones[3], qT || new THREE.Quaternion());
}
const plantLegs = (info, s) => { for (const lg of info.legs) birdLeg(info, s, lg, lg.foot.clone()); };
const wingsFolded = (s) => { for (const x of ['L', 'R']) { s['Wing' + x] = { r: [0, 0, 0], s: 0.001 }; s['WingFold' + x] = { r: [0, 0, 0], s: 1 }; } };
const wingsSpread = (s) => { for (const x of ['L', 'R']) { s['Wing' + x] = { r: [0, 0, 0], s: 1 }; s['WingFold' + x] = { r: [0, 0, 0], s: 0.001 }; } };

/** The head's quick looks about: holds at a few headings with fast turns between (`seed` varies the sequence). */
function saccade(u, n = 5, amp = 35, seed = 3) {
  const k = Math.floor(u * n), f = u * n - k, a = (hash3(k, seed, 0, 9) - 0.5) * 2 * amp, b = (hash3(k + 1, seed, 0, 9) - 0.5) * 2 * amp;
  const aa = k === 0 ? 0 : a, bb = k + 1 >= n ? 0 : b;
  return lerp(aa, bb, sstep(0.78, 0.92, f));
}

function birdSample(info, name, u) {
  const S = info.S, s = {}, P = S.pitch;
  const tw = (a, t, b) => { const x = clamp((u - a) / (t - a), 0, 1), y = clamp((b - u) / (b - t), 0, 1); return smooth01(Math.min(x, y)); };
  switch (name) {
    case 'perch': default: {
      wingsFolded(s);
      setPos(s, 'Root', [0, 0, 0]);
      addRot(s, 'Chest', [1.2 * Math.sin(TAU * u * 4), 0, 0]);
      addRot(s, 'Head', [3 * Math.sin(TAU * u * 2), saccade(u, 6, S.famKey === 'owl' ? 70 : 32, 5), 0]);
      addRot(s, 'Neck2', [0, saccade(u, 6, 10, 5) * 0.3, 0]);
      addRot(s, 'Tail', [3 * Math.max(0, Math.sin(TAU * u * 3)) ** 8, 0, 0]);
      plantLegs(info, s);
      return s;
    }
    case 'alert': {
      wingsFolded(s);
      const k = tw(0, 0.25, 1);
      addRot(s, 'Neck1', [-12 * k, 0, 0]); addRot(s, 'Neck2', [-8 * k, 0, 0]); addRot(s, 'Head', [10 * k, saccade(u, 4, 40, 11) * k, 0]);
      setPos(s, 'Root', [0, 0.02 * S.L * k, 0]);
      plantLegs(info, s);
      return s;
    }
    case 'peck': {
      // down to the ground and back, two quick strikes. Short-necked birds tip the whole body as far as the breast
      // clears the ground and bend the neck for the rest (a penguin, propped on its tail, only bows its head); the
      // neck's bend is scaled back wherever it would drive the bill into the ground.
      const k0 = tw(0.05, 0.3, 0.9), strike0 = Math.max(0, Math.sin(TAU * clamp((u - 0.3) / 0.5, 0, 1) * 2)) * k0;
      const longNeck = S.neckLen > 0.5 * S.L, tipBody = !longNeck && !S.restsOnTail;
      const pose = (mb, mn) => {
        const q = {}, k = k0 * mn, strike = strike0 * mn, more = 1 + (1 - mb) * (tipBody ? 0.8 : 0);
        wingsFolded(q);
        if (tipBody) addRot(q, 'Hips', [Math.min(40, 70 - P) * k0 * mb, 0, 0]);
        addRot(q, 'Neck1', [(longNeck ? 45 : 25) * k * more, 0, 0]); addRot(q, 'Neck2', [((longNeck ? 35 : 20) * k + 10 * strike) * more, 0, 0]); addRot(q, 'Head', [25 * k + 12 * strike, 0, 0]);
        if (info.has.Jaw) addRot(q, 'Jaw', [10 * Math.max(0, Math.sin(TAU * u * 4)) * k, 0, 0]);
        plantLegs(info, q);
        return q;
      };
      // (the bill tip rides on the Head bone, the underside of the breast on the Chest bone)
      const Bl = info.L.bill, jawAt = (f) => Bl.cl(f).addScaledVector(Bl.bu, -0.5 * Bl.Db);
      const bill = [[Bl.cl(1), 'Head', 0.3 * S.M.Bd], ...(info.has.Jaw ? [[jawAt(0.92), 'Jaw', 0.15 * S.M.Bd], [jawAt(0.6), 'Jaw', 0.1 * S.M.Bd]] : [])], breast = [0.6, 0.8, 0.95].map(sv => [info.L.torsoAt(sv, -Math.PI / 2).p, 'Chest', 0.02 * S.L]);
      const clear = (q, probes) => { const fk = fkOf(info, q); return Math.min(...probes.map(([X, b, mg]) => { const T = fk(b); return T.p.y + X.clone().sub(info.headV[b]).applyQuaternion(T.q).y - mg; })); };
      const solve = (f) => { if (f(1)) return 1; let lo = 0, hi = 1; for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (f(m)) lo = m; else hi = m; } return lo; };
      const mb = tipBody ? solve((m) => clear(pose(m, 0), [...bill, ...breast]) >= 0) : 1;
      const mn = solve((m) => clear(pose(mb, m), [...bill, ...breast]) >= 0);
      return pose(mb, mn);
    }
    case 'walk': {
      wingsFolded(s);
      const G = info.walk, V = G.stride;
      if (S.restsOnTail) {
        // a penguin's waddle: the body rocks onto each foot in turn, lifting off its tail as it goes
        const roll = 6 * Math.sin(TAU * u);
        setPos(s, 'Root', [0.01 * S.L * Math.sin(TAU * u), 0.7 * info.L.width * Math.abs(Math.sin(roll * DEG)) + 0.006 * S.L, 0]);
        addRot(s, 'Hips', [0, 5 * Math.sin(TAU * u), roll]);
      } else {
        const bob = Math.abs(Math.sin(TAU * u)) * 0.012 * S.L;
        setPos(s, 'Root', [0.012 * S.L * Math.sin(TAU * u), -bob, 0]);
        addRot(s, 'Hips', [0, 4 * Math.sin(TAU * u), 2 * Math.sin(TAU * u)]);
      }
      for (const lg of info.legs) {
        const td = lg.sd > 0 ? 0 : 0.5, tau = fract(u - td), d = V * G.duty;
        let z, y = 0, curl = 0;
        if (tau < G.duty) z = lg.foot.z + d * (0.5 - tau / G.duty);
        else {
          // the swing: the foot lifted clear by more than its curled toes hang below it, carried forward, set down flat
          const sg = (tau - G.duty) / (1 - G.duty), arc = Math.sin(Math.PI * sg);
          z = lg.foot.z - d / 2 + d * smooth01(Math.min(1, sg / 0.9)); curl = arc;
          y = Math.max(0.12 * info.hipH, (info.L.toeLen || 0) * Math.sin(35 * DEG) * 1.2 + 0.015 * info.hipH) * arc ** 0.7;
        }
        birdLeg(info, s, lg, V3(lg.foot.x, lg.foot.y + y, z), new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), 35 * curl * DEG));
      }
      // pigeons, doves and fowl: the head held still while the body passes under it, then thrust forward
      if (G.bob) {
        const ph = fract(u * 2), hold = ph < 0.7 ? -V * 0.5 * (ph / 0.7 - 0.5) : -V * 0.5 * (0.5 - (ph - 0.7) / 0.3);
        setPos(s, 'Head', info.L.hd.clone().multiplyScalar(hold * 0.6).toArray());
      }
      addRot(s, 'Tail', [0, 3 * Math.sin(TAU * u), 0]);
      return s;
    }
    case 'hop': {
      // both feet together: a crouch, a spring forward, a landing
      wingsFolded(s);
      const up = Math.sin(Math.PI * clamp((u - 0.25) / 0.5, 0, 1)), fw = sstep(0.25, 0.75, u);
      setPos(s, 'Root', [0, up * 0.35 * info.hipH, fw * 0.6 * S.L]);
      addRot(s, 'Hips', [-6 * up, 0, 0]);
      addRot(s, 'Tail', [-10 * up, 0, 0]);
      for (const lg of info.legs) {
        const F = lg.foot.clone(); F.z += fw * 0.6 * S.L; F.y += up * 0.3 * info.hipH;
        birdLeg(info, s, lg, F, new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), 30 * up * DEG));
      }
      return s;
    }
    case 'flap': case 'glide': {
      wingsSpread(s);
      // level the body, tuck the legs, keep the head level
      addRot(s, 'Hips', [P - 4, 0, 0]);
      addRot(s, 'Neck1', [-(P - 4) * 0.5, 0, 0]); addRot(s, 'Head', [-(P - 4) * 0.4, 0, 0]);
      // (long-legged waders and storks trail their legs straight out behind instead of folding them up)
      const trail = S.M.Ts > 0.3 * S.L;
      for (const lg of info.legs) {
        if (trail) { s[lg.bones[0]] = [60, 0, 0]; s[lg.bones[1]] = [22, 0, 0]; s[lg.bones[2]] = [4, 0, 0]; s[lg.bones[3]] = [40, 0, 0]; }
        else { s[lg.bones[0]] = [55, 0, 0]; s[lg.bones[1]] = [-80, 0, 0]; s[lg.bones[2]] = [70, 0, 0]; s[lg.bones[3]] = [60, 0, 0]; }
      }
      const flap = name === 'flap';
      for (const [sd, sx] of SIDES) {
        if (flap) {
          // the downstroke: spread wide, swept a little forward; the upstroke: folded at the wrist, the hand flipped back
          const ph = TAU * u, down = Math.cos(ph), fold = Math.max(0, Math.sin(ph));
          // (from about 48° above level at the top of the stroke to about 32° below it at the bottom)
          s['Humerus' + sx] = [-6 * down, sd * (8 * down - 6), sd * (40 * down + 8)];
          s['Forearm' + sx] = [0, sd * 32 * fold, -sd * 10 * fold];
          s['Hand' + sx] = [-12 * fold, sd * 40 * fold, sd * 14 * Math.cos(ph + 0.6)];
        } else {
          const bank = 4 * Math.sin(TAU * u);
          s['Humerus' + sx] = [0, -sd * 3, sd * (6 + bank * sd)];
          s['Forearm' + sx] = [0, 0, 0];
          s['Hand' + sx] = [0, sd * 4, -sd * 2];
        }
      }
      addRot(s, 'Tail', [-4, 0, 0]);
      setPos(s, 'Hips', [0, flap ? 0.02 * S.L * Math.sin(TAU * u + 1) : 0, 0]);
      return s;
    }
  }
}

const BIRD_CLIPS = {
  perch: { label: 'Perch', loop: true, dur: () => 4.2, frames: 61 },
  walk: { label: 'Walk', loop: true, dur: (I) => I.walk.dur, frames: 41 },
  hop: { label: 'Hop', loop: false, dur: (I) => clamp(0.5 * Math.sqrt(I.S.L / 0.1), 0.3, 1.0), frames: 25 },
  peck: { label: 'Peck', loop: false, dur: () => 1.4, frames: 31 },
  alert: { label: 'Alert', loop: false, dur: () => 3, frames: 37 },
  flap: { label: 'Flap', loop: true, dur: (I) => clamp(0.32 * Math.sqrt(I.L.span / 0.4), 0.08, 1.4), frames: 25 },
  glide: { label: 'Glide', loop: true, dur: () => 3.5, frames: 25 },
};
function birdClips(info) {
  const out = [];
  for (const [name, c] of Object.entries(BIRD_CLIPS)) {
    if (info.flightless && (name === 'flap' || name === 'glide')) continue;
    const dur = c.dur(info), clip = bakeClip(info, name, dur, c.frames, (u) => birdSample(info, name, u), c.loop, name === 'walk');
    if (name === 'walk') clip.userData = { loop: true, gait: 'walk', stride: info.walk.stride, speed: info.walk.stride / dur, hipH: info.hipH };
    out.push(clip);
  }
  return out;
}

/* ════════════════════════════════════════════════════════════════════════════
 *  EXPORTED METADATA & ASSET
 * ════════════════════════════════════════════════════════════════════════════ */
const SPECIES_KEYS = Object.keys(SPECIES), DEFAULT_SPECIES = 'eagle';
export const COLORWAYS = colorwaysFor(BASE);
export const presets = COLORWAYS;
export const species = Object.fromEntries(SPECIES_KEYS.map(k => [k, { label: SPECIES[k].label, scientific: SPECIES[k].sci }]));
export const POSES = ['perch', 'walk', 'hop', 'peck', 'alert', 'flap', 'glide'];
const R_ = (label, def, min, max, step, describe, affects = 'geometry') => ({ type: 'range', default: def, min, max, step, label, affects, describe });
export const params = withZones({
  species: { type: 'choice', default: DEFAULT_SPECIES, options: SPECIES_KEYS, label: 'Species', affects: 'geometry', describe: `Species preset (${SPECIES_KEYS.length} birds, each from field measurements).` },
  colorway: { type: 'choice', default: 'natural', options: COLORWAY_KEYS, label: 'Colourway', affects: 'colors', describe: 'Role-aware transform of the species palette.' },
  detail: { type: 'choice', default: 'standard', options: Object.keys(DETAIL), label: 'Detail', affects: 'geometry', describe: 'Loft resolution (draft / standard / high).' },
  rigMode: { type: 'choice', default: 'skinned', options: ['skinned', 'static'], label: 'Rig mode', affects: 'geometry', describe: 'Skinned meshes with a skeleton, or pose baked into static geometry.' },
  pose: { type: 'choice', default: 'perch', options: POSES, label: 'Pose', affects: 'geometry', describe: 'A frozen frame of a clip (perch folds the wings).' },
  posePhase: R_('Pose phase', 0.25, 0, 1, 0.01, 'Clip phase used for the frozen pose.'),
  size: R_('Size', 1, 0.4, 1.6, 0.01, 'Scale of the species\' measured adult.'),
  legLength: R_('Leg length', 1, 0.6, 1.5, 0.01, 'Tarsus and tibia length multiplier.'),
  neckLength: R_('Neck length', 1, 0.5, 1.6, 0.01, 'Neck length multiplier.'),
  headSize: R_('Head size', 1, 0.75, 1.35, 0.01, 'Head width multiplier.'),
  beakLength: R_('Bill length', 1, 0.5, 1.6, 0.01, 'Bill length multiplier.'),
  tailLength: R_('Tail length', 1, 0.3, 1.8, 0.01, 'Tail length multiplier.'),
  wingspan: R_('Wingspan', 1, 0.6, 1.4, 0.01, 'Wingspan multiplier (spread wings).'),
  seed: R_('Variation seed', 7, 1, 999, 1, 'Seed for streaks, spots and bars.', 'colors'),
  coat: { type: 'toggle', default: true, label: 'Painted plumage', affects: 'colors', describe: 'Paint the plumage regions and marks into a texture; off: one colour per mesh face.' },
  coatGrain: R_('Feather grain', 0.06, 0, 0.25, 0.01, 'Faint tonal variation in the feathers (painted plumage only).', 'colors'),
  shading: { type: 'choice', default: 'smooth', options: ['smooth', 'flat'], label: 'Shading', affects: 'geometry', describe: 'Smooth, rounded shading or flat low-poly facets.' },
  hide: { type: 'text', default: '', label: 'Hide parts', affects: 'geometry', describe: 'Comma list of detachable parts to omit (see `detach`).' },
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'One mesh per material (1-2 draw calls) instead of one selectable mesh per anatomical part.' },
}, ZONE_LABELS, BASE);
export const rig = {
  Hips: { axis: 'x', range: [-20, 40], describe: 'body pitch' }, Neck1: { axis: 'x', range: [-30, 45], describe: 'neck' }, Neck2: { axis: 'x', range: [-30, 45] },
  Head: { axis: 'y', range: [-70, 70], describe: 'head turn' }, Jaw: { axis: 'x', range: [0, 35], describe: 'bill open' }, Tail: { axis: 'x', range: [-20, 25], describe: 'tail' },
  HumerusL: { axis: 'z', range: [-40, 60], describe: 'wing beat' }, HumerusR: { axis: 'z', range: [-60, 40] },
};
export const detach = ['crest', 'wings', 'wings-folded', 'tail', 'beak', 'eyes', 'legs', 'feet'];
export const night = { eyes: { color: '#ffd77a', intensity: 0.2, distance: 1, describe: 'Eyeshine (owls and nightjars)' } };
export const ANIMATIONS = Object.entries(BIRD_CLIPS).map(([name, c]) => ({ name, label: c.label, loop: c.loop, duration: name === 'perch' ? 4.2 : name === 'glide' ? 3.5 : 0.6 }));

/** The builder's spec from the species' measurements (metres) and the user's options. */
function specFor(base, p) {
  const k = p.size, [TL, Sp, W, T, Ts, C, Bd, Hw, Nk] = base.M.map(v => (v * k) / 100);
  const hw = Hw * p.headSize, Hl = (base.Hl ?? 1.15) * hw;
  // (the torso: what the total length leaves after tail, bill, head and neck, unless the species gives it, e.g. the ostrich)
  const Lt = base.Lt ? (base.Lt * k) / 100 : Math.max(0.3 * TL, TL - T - C - Hl * 0.85 - Nk * 0.85);
  const fam = { ...FAMILIES[base.fam] };
  for (const key of ['tibK', 'crouch', 'sHip', 'neckR', 'bob']) if (base[key] !== undefined) fam[key] = base[key];
  // (the posture search may tilt the body less; the spec keeps its own copy)
  if (base.depth) fam.depth = base.depth;
  if (base.width) fam.width = base.width;
  const S = {
    ...base, famKey: base.fam, fam, L: Lt, headLen: Hl, neckLen: Nk * p.neckLength,
    M: { TL, Sp: Sp * p.wingspan, W, T: T * p.tailLength, Ts: Ts * p.legLength, C: C * p.beakLength, Bd, Hw: hw, Nk },
    neckAng: base.neckAng ?? 60, headAng: base.headAng ?? 4, seed: p.seed, flightless: ['penguin', 'ratite', 'kiwi'].includes(base.fam),
    eye: { ...base.eye }, bill: { ...base.bill }, wing: { ...(base.wing || {}) }, tail: { ...(base.tail || {}) }, extras: base.extras || {}, plume: base.plume || {},
  };
  if (S.tail.train) S.tail.train = { ...S.tail.train, len: S.tail.train.len * k };
  return S;
}

const RIGS = new WeakMap();

export function createAsset(input = {}) {
  const p = normalize(input);
  // Digital Diorama extension: `specOverride` deep-merges measurement, anatomy and colour changes onto the preset
  // (e.g. { M: [...], palette: { head: '#...' }, plume: { ... } }), so related species can share one rig
  const base0 = SPECIES[p.species] || SPECIES[DEFAULT_SPECIES];
  const base = p.specOverride && typeof p.specOverride === 'object' ? mergeDeep(base0, p.specOverride) : base0;
  // (an override from the old bird rig, e.g. `eye: 0.34`, can't replace a part's settings with a bare number)
  for (const k of ['eye', 'bill', 'wing', 'tail', 'extras', 'plume', 'palette']) if (base[k] !== undefined && (typeof base[k] !== 'object' || base[k] === null || Array.isArray(base[k]))) base[k] = base0[k];
  if (!Array.isArray(base.M) || base.M.length !== 9 || !base.M.every(v => Number.isFinite(v) && v >= 0)) base.M = base0.M;
  const S = specFor(base, p);
  const det = DETAIL[p.detail] ?? 1;
  const rigB = new Rig(), parts = [], byName = new Map();
  const coatOn = p.coat !== false;
  const B = { det, rig: rigB, parts, paint: null,
    part(name, opt = {}) { if (!byName.has(name)) { const pt = new Part(name, opt); pt.coat = coatOn && !pt.glass; byName.set(name, pt); parts.push(pt); } return byName.get(name); } };
  const L = {};
  B.paint = makeBirdPainter(S, L);
  birdBuild(B, S, L);
  const info = birdMotion(S, p, L, rigB);
  const poseName = POSES.includes(p.pose) ? p.pose : 'perch', flying = poseName === 'flap' || poseName === 'glide';
  const pose = birdSample(info, info.flightless && flying ? 'perch' : poseName, p.posePhase);
  const hidden = new Set(String(p.hide || '').split(',').map(s => s.trim()).filter(Boolean));
  // (a static model keeps only the wings its pose shows)
  const keep = (pt) => !hidden.has(pt.name) && !hidden.has(pt.group) && !(p.rigMode === 'static' && pt.group === (flying && !info.flightless ? 'wingFold' : 'wingSpread'));
  const build = { rig: rigB, parts: parts.filter(keep) };
  const zones = zonesFor(p.colorway, p, S.palette);
  const coat = { res: COAT_RES[p.detail] ?? COAT_RES.standard, ref: S.L * 1.6, grain: p.coatGrain, grainOf: (z) => ZONE_ROLES[z] === 'body', smooth: p.shading !== 'flat' };
  const { root, skeleton } = finish(build, { name: `bird-${p.species}`, merge: p.mergeForProduction, skinned: p.rigMode !== 'static', zones, pose, coat: coatOn || coat.smooth ? coat : null, seamRadius: 0.04 * S.L });
  let tris = 0; root.traverse(m => { if (m.isMesh) tris += m.geometry.attributes.position.count / 3; });
  root.userData = {
    asset: 'bird-rig', species: p.species, label: base.label, scientific: base.sci, params: p, dimensions: measure(root), triangles: tris,
    zones: Object.fromEntries(Object.entries(zones).map(([k, v]) => [k, hexStr(v)])), bones: info.bones, parts: build.parts.map(pt => pt.name),
    units: 'meters', forward: '+Z', up: '+Y', pitch: S.pitch, hipHeight: +info.hipH.toFixed(4), wingspan: +(2 * L.span + S.L * (S.fam.width ?? 0.25) * 2).toFixed(3),
  };
  RIGS.set(root, { rig: rigB, info, skeleton });
  return root;
}
/** AnimationClips (perch, walk, hop, peck, alert, flap, glide); flight clips scale the spread wings in and the folded ones out. */
export function createClips(asset) {
  const R = RIGS.get(asset); if (!R) return [];
  return birdClips(R.info);
}
/** Poses a skinned asset at a clip phase (no mixer needed). */
export function setPose(asset, name = 'perch', phase = 0.25) {
  const R = RIGS.get(asset); if (!R || !BIRD_CLIPS[name]) return false;
  applySample(R.rig, birdSample(R.info, name, clamp(phase, 0, 1)));
  asset.updateMatrixWorld(true);
  return true;
}
export default createAsset;
