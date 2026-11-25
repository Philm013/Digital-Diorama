/*
 * MAMMAL RIG (High Detail) — procedural, skinned, swept-surface mammals
 * A parametric low-poly generator for three.js: one import, no loader, no textures.
 * Bodies are one continuous loft (rump > barrel > chest > neck) of superelliptic
 * sections on transported frames; skulls are lofted with a hinged jaw; limbs are
 * swept through anatomical joints; ears, manes and palms are thickened membranes.
 * Every vertex is skinned to one shared skeleton driven by procedural gaits.
 *
 * QUICK START
 *   import { createAsset, createClips } from './mammal-rig.mjs';
 *   const horse = createAsset({ species: 'horse', mergeForProduction: true });
 *   scene.add(horse);
 *   const mixer = new THREE.AnimationMixer(horse);
 *   mixer.clipAction(createClips(horse).find(c => c.name === 'gallop')).play();
 *
 * SPECIES  43 presets: horse, zebra, donkey, cow, deer, wolf, cat, lion, tiger,
 *          elephant, giraffe, bear, pig, rabbit, dog, fox, hyena, cheetah, leopard,
 *          lynx, polarBear, panda, raccoon, badger, otter, hedgehog, squirrel, beaver,
 *          capybara, sheep, bighorn, goat, bison, gazelle, moose, reindeer, camel,
 *          llama, rhino, hippo, boar, anteater, mouse.
 * SPECS    ~9,500-17,500 triangles at standard detail (draft ~0.4x, high ~2.4x); 1 solid
 *          material (+1 translucent for glass parts); merged = 1-2 draw calls.
 *          Real-world L x H x W (m): Horse 2.78x2.10x0.57; Dairy Cow 2.38x1.43x0.74;
 *          African Elephant 4.71x3.01x2.28; House Mouse 0.15x0.04x0.03.
 *          +Z forward, +Y up, ground at y = 0; exact bounds in asset.userData.dimensions.
 * OPTIONS  species, size, age, body/leg/neck/head/muzzle proportions, ear/tail/horn/
 *          mane/hump/foot/stance styles, tusks, trunk, fangs, claws, quills, coat
 *          pattern, countershading, variation seed, detail, rig mode, pose, colourway.
 * RIG      Root > Hips > Spine1 > Spine2 > Chest > Neck1 > Neck2 > Head > Jaw | EarL/R |
 *          Trunk1-5; Chest > Scapula > Arm > Forearm > Hand > Finger (L/R);
 *          Hips > Thigh > Shin > Foot > Toe (L/R); Hips > Tail1..n.
 * CLIPS    idle, walk, trot, gallop, graze, alert, roar, sit (procedural phase-offset
 *          gaits). createClips(asset), setPose(asset, name, phase).
 * PARTS    animate: see `rig` (bone names); detach: horns, tusks, trunk, mane, tail,
 *          ears, eyes, eyelids, nose, teeth, spines, jaw, feet.
 * LICENSE  CC0 1.0 Universal — this module and all generated geometry.
 *
 * REVISION 2 (anatomy review)
 *   - The published file was cut off inside tetraMane(). Rebuilt the manes, quills, coat painter,
 *     zones / palettes, all 43 species presets, params / rig / detach / night metadata,
 *     createAsset, createClips and setPose.
 *   - Rear torso: the croup now slopes to the tail head, the buttocks curve under, a long 0.95x
 *     elliptical rump cap and a hamstring bulge replace the flat-disc rear.
 *   - Torso sections: broad back / keeled chest / rounded belly instead of a uniform tube.
 *   - Rear legs: the quarter (thigh) is sized from the body, flush with the flank, rooted under the
 *     croup and narrowing to the stifle at the flank fold. Stifle offset scales with hip height,
 *     and crouched hocks tuck under the rump.
 *   - Skull: rounded occiput, egg-shaped braincase, supraorbital brow ridge. The neck tapers
 *     near-linearly into the skull (no collar on short-necked species).
 *   - Ears: tubular conch at the root plus an auricular mound, and fan ears hang properly.
 *
 * REVISION 3 (Digital Diorama: realism)
 *   - Coat atlas: painters are rasterised into one texture per asset instead of one colour per
 *     quad, so stripes, spots, rosettes, masks and patch edges are smooth curves (see COAT ATLAS).
 *   - Smooth, crease-aware normals and glossy eyes. Options: coat, coatGrain, shading.
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
    // coat atlas: per-vertex (s, t) inside each face's patch, and the patch per face (null = flat colour)
    this.uv = []; this.pt = []; this.coat = false;
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
  // Digital Diorama revision: a painted loft becomes a coat-atlas patch (see COAT ATLAS)
  const pt = part.coat && typeof zone === 'function' ? loftPatch(g, zf) : null, T = pt && pt.t, L0 = pt ? pt.lead : 0;
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
  for (const part of parts) for (const pt of part.pt) if (pt && !seen.has(pt)) { seen.add(pt); patches.push(pt); }
  if (!patches.length) return null;
  const mn = V3(Infinity, Infinity, Infinity), mx = V3(-Infinity, -Infinity, -Infinity), q = V3();
  for (const part of parts) for (let i = 0; i < part.p.length; i += 3) { q.set(part.p[i], part.p[i + 1], part.p[i + 2]); mn.min(q); mx.max(q); }
  const D = Math.max(1e-6, mx.distanceTo(mn));
  let tau = D / (cfg.res || 420), AW = 256, AH = 0, place = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    let area = 0;
    for (const pt of patches) {
      pt.tw = clamp(Math.ceil(pt.per / tau), 2, COAT_MAX - 2 * COAT_PAD);
      pt.th = clamp(Math.ceil(pt.len / tau), 2, COAT_MAX - 2 * COAT_PAD);
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
  for (const pt of patches) paintPatch(pt, place.get(pt), data, AW, shade, cfg.soft !== false);
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
function paintPatch(pt, tile, data, AW, shade, soft) {
  const { grid, K, J, t, at, zoneAt, wrap } = pt, { x: X0, y: Y0, w, h } = tile;
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
  for (let by = 0; by < ch; by++) for (let bx = 0; bx < cw; bx++) {
    const z = lat[by * lw + bx], uni = z === lat[by * lw + bx + 1] && z === lat[(by + 1) * lw + bx] && z === lat[(by + 1) * lw + bx + 1];
    for (let y = by * B; y < Math.min(h, by * B + B); y++) for (let x = bx * B; x < Math.min(w, bx * B + B); x++) {
      let zz = z;
      if (uni) pos(x, y); else zz = zoneOf(x, y);
      shade(zz, P, rgb, (y * w + x) * 3);
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
    data[di] = clamp(Math.round(rgb[si]), 0, 255); data[di + 1] = clamp(Math.round(rgb[si + 1]), 0, 255); data[di + 2] = clamp(Math.round(rgb[si + 2]), 0, 255); data[di + 3] = 255;
  }
}

/** Smooth vertex normals for non-indexed triangles: faces meeting at a point share a normal unless they crease more than `deg`. */
function smoothNormals(geo, deg = COAT_CREASE) {
  const pos = geo.attributes.position.array, n = pos.length / 3;
  geo.computeBoundingBox();
  const bb = geo.boundingBox, eps = Math.max(1e-9, bb.max.distanceTo(bb.min) * 2e-6);
  const fn = new Float32Array(n), keys = new Array(n), groups = new Map();
  for (let f = 0; f < n; f += 3) {
    const ax = pos[f * 3], ay = pos[f * 3 + 1], az = pos[f * 3 + 2];
    const ux = pos[f * 3 + 3] - ax, uy = pos[f * 3 + 4] - ay, uz = pos[f * 3 + 5] - az, vx = pos[f * 3 + 6] - ax, vy = pos[f * 3 + 7] - ay, vz = pos[f * 3 + 8] - az;
    fn[f] = uy * vz - uz * vy; fn[f + 1] = uz * vx - ux * vz; fn[f + 2] = ux * vy - uy * vx;
    for (let k = 0; k < 3; k++) {
      const i = f + k, key = `${Math.round(pos[i * 3] / eps)},${Math.round(pos[i * 3 + 1] / eps)},${Math.round(pos[i * 3 + 2] / eps)}`;
      keys[i] = key;
      const g = groups.get(key);
      if (g) g.push(f); else groups.set(key, [f]);
    }
  }
  const cosC = Math.cos(deg * DEG), nor = new Float32Array(n * 3);
  const unit = (f) => { const l = Math.hypot(fn[f], fn[f + 1], fn[f + 2]) || 1; return [fn[f] / l, fn[f + 1] / l, fn[f + 2] / l]; };
  for (let i = 0; i < n; i++) {
    const f = i - (i % 3), me = unit(f);
    let sx = 0, sy = 0, sz = 0;
    for (const g of groups.get(keys[i])) {
      const o = unit(g);
      if (o[0] * me[0] + o[1] * me[1] + o[2] * me[2] < cosC) continue;
      sx += fn[g]; sy += fn[g + 1]; sz += fn[g + 2];
    }
    const l = Math.hypot(sx, sy, sz);
    if (l > 1e-20) { nor[i * 3] = sx / l; nor[i * 3 + 1] = sy / l; nor[i * 3 + 2] = sz / l; } else { nor[i * 3] = me[0]; nor[i * 3 + 1] = me[1]; nor[i * 3 + 2] = me[2]; }
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
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
  let solid = MAT, eyeMat = null;
  if (coat || smooth) {
    solid = MAT.clone(); solid.flatShading = !smooth; solid.name = 'coat'; if (coat) solid.map = coat.tex;
    // wet, glossy eyes that catch a highlight
    eyeMat = solid.clone(); eyeMat.roughness = 0.16; eyeMat.name = 'eyes';
  }
  const isEye = (p) => !!eyeMat && !p.glass && p.name === 'eyes';
  for (const kind of ['solid', 'eyes', 'glass']) {
    const glass = kind === 'glass';
    const list = live.filter(p => (glass ? p.glass : !p.glass && isEye(p) === (kind === 'eyes')));
    if (!list.length) continue;
    const mat = glass ? GLASS_MAT : kind === 'eyes' ? eyeMat : solid;
    if (merge) {
      const geos = list.map(toGeo), merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (geos.length > 1) geos.forEach(g => g.dispose());
      if (!merged) continue;
      merged.computeBoundingBox(); merged.computeBoundingSphere();
      root.add(meshOf(merged, mat, kind, { merged: true, parts: list.map(p => p.name) }));
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
 *  TETRAPOD BUILDER — +Z forward, +Y up, animal's left = +X, ground at y = 0.
 *  One continuous loft carries rump → barrel → chest → neck; the head, jaw,
 *  limbs and tail are separate sweeps rooted inside it.
 * ════════════════════════════════════════════════════════════════════════════ */
function tetraLayout(S) {
  const H = S.H, D = S.depth * H, Lt = S.len * H, hw = (S.width * D) / 2;
  const zF = Lt / 2, zB = -Lt / 2, yR = S.rump * H, Dr = D * S.rumpDepth;
  const sag = (S.sag || 0) * D, tuck = S.tuck || 0, belly = S.belly || 0;
  // REVISED REAR: the old rump station sat 4% behind the haunch with a 30% width step and a 0.32 cap,
  // which read as a flat disc. The rump station now sits ~10% forward of the point of buttock, the
  // croup slopes down to the tail-head, the buttocks curve under toward the gaskin, and a long
  // elliptical cap (see tetraTorso) closes the quarters into a rounded rear.
  const hipW = S.hipW || 1;
  const keys = [
    { n: 'rump', z: zB + 0.1 * Lt, top: yR - (S.croupSlope ?? 0.17) * Dr, bot: yR - 0.8 * Dr, w: 0.78 * hw * hipW },
    { n: 'haunch', z: zB + 0.23 * Lt, top: yR, bot: yR - 0.98 * Dr, w: 0.97 * hw * hipW },
    { n: 'loin', z: zB + 0.44 * Lt, top: lerp(yR, H, 0.42) - sag, bot: lerp(yR - Dr, H - D, 0.45) + tuck * 0.34 * D - belly * 0.05 * D, w: 0.9 * hw },
    { n: 'barrel', z: zB + 0.66 * Lt, top: lerp(yR, H, 0.74) - sag * 0.55, bot: H - D * (1.0 + belly * 0.1) + tuck * 0.06 * D, w: hw },
    { n: 'chest', z: zF - 0.19 * Lt, top: H, bot: H - D, w: 0.9 * hw * (S.chestW || 1) },
  ];
  for (const k of keys) { k.c = V3(0, (k.top + k.bot) / 2, k.z); k.ht = (k.top - k.bot) / 2; k.hb = k.ht; }
  // humps / withers prominence add to the top half-height only
  const nrC = V3(0, H - (0.45 + (S.neckLow || 0)) * D, zF - 0.035 * Lt);
  const nA = S.neckAng * DEG, nd = V3(0, Math.sin(nA), Math.cos(nA)), nUp = V3(0, Math.cos(nA), -Math.sin(nA));
  const nT = (S.neckThk * D) / 2, nW = S.neckW;
  // minimum neck run: the section must taper from the chest root to the skull over a sane distance
  const LhPre = S.headLen * H, rootHt = 0.44 * D * (S.chestOut || 1), skullHt = S.headD * LhPre;
  const Ln = Math.max(0.02 * H, S.neckLen * H, 1.25 * Math.max(0, rootHt - skullHt));
  const arch = (S.neckArch || 0) * Ln;
  const neck = [
    { n: 'neckRoot', c: nrC, ht: 0.43 * D * (S.chestOut || 1), hb: 0.45 * D * (S.chestOut || 1), w: 0.78 * hw },
    { n: 'neck1', c: nrC.clone().addScaledVector(nd, 0.34 * Ln).addScaledVector(nUp, arch * 0.6), ht: nT * 1.05, hb: nT * 1.05, w: nT * nW * 1.1 },
    { n: 'neck2', c: nrC.clone().addScaledVector(nd, 0.68 * Ln).addScaledVector(nUp, arch), ht: nT * 0.86, hb: nT * 0.84, w: nT * nW * 0.92 },
    { n: 'neckTop', c: nrC.clone().addScaledVector(nd, Ln).addScaledVector(nUp, arch * 0.5), ht: nT * 0.72, hb: nT * 0.7, w: nT * nW * 0.82 },
  ];
  const all = [...keys, ...neck];
  const hA = S.headAng * DEG, hd = V3(0, -Math.sin(hA), Math.cos(hA)), hu = V3(0, Math.cos(hA), Math.sin(hA));
  const Lh = S.headLen * H, ch = S.headD * Lh, cw = S.headW * Lh;
  const poll = neck[3].c.clone().addScaledVector(nUp, nT * 0.35);
  const headO = poll.clone().addScaledVector(hd, -0.02 * Lh).addScaledVector(hu, -0.08 * ch);
  // REVISED NECK→SKULL: the throat-latch stations may not exceed the skull section, otherwise short,
  // thick necks (pig, bear, hippo, boar) end in a visible disc / collar around the back of the head.
  const capH = ch * 1.02, capW = cw * 1.08;
  neck[3].ht = Math.min(neck[3].ht, capH); neck[3].hb = Math.min(neck[3].hb, capH * 1.05); neck[3].w = Math.min(neck[3].w, capW);
  neck[2].ht = Math.min(neck[2].ht, Math.max(capH * 1.3, lerp(neck[3].ht, neck[1].ht, 0.5))); neck[2].hb = Math.min(neck[2].hb, Math.max(capH * 1.35, lerp(neck[3].hb, neck[1].hb, 0.5)));
  neck[2].w = Math.min(neck[2].w, Math.max(capW * 1.3, lerp(neck[3].w, neck[1].w, 0.5)));
  // near-linear taper root → skull: no station may sit far above the straight cone between them
  for (const [i, t] of [[1, 0.34], [2, 0.68]]) for (const k of ['ht', 'hb', 'w']) neck[i][k] = Math.min(neck[i][k], lerp(neck[0][k], neck[3][k], t) * 1.12);
  return { H, D, Lt, hw, zF, zB, yR, Dr, keys: all, nd, nUp, Ln, nT, hd, hu, Lh, ch, cw, poll, headO, elbowY: H - D, limbs: [] };
}

/** Torso + neck loft with profile keys; creates the axial skeleton. */
function tetraTorso(B, S, L) {
  const det = B.det, rig = B.rig, keys = L.keys;
  const curve = makePath(keys.map(k => k.c));
  const ku = knotUs(curve, keys.length);
  keys.forEach((k, i) => { k.u = ku[i]; });
  const humps = S.humps || [];
  const pW = prof(keys.map(k => [k.u, k.w])), pHT = prof(keys.map(k => [k.u, k.ht])), pHB = prof(keys.map(k => [k.u, k.hb]));
  const by = (n) => keys.find(k => k.n === n);
  const uTop = by('neckTop').u, uRoot = by('neckRoot').u;
  const ht = (u) => pHT(u) + humps.reduce((s, h) => s + h.h * L.H * bell(u, h.u * by('chest').u, h.w * by('chest').u), 0) + (S.withers || 0) * L.D * bell(u, by('chest').u - 0.02, 0.24);
  // Sections: broad back (nt > 2), keeled chest / rounded belly (nb < 2) so the barrel is not a tube.
  const ntB = S.nt || 2.35, nbB = S.nb || 1.85;
  const nt = prof([[0, ntB * 0.92], [by('haunch').u, ntB], [by('chest').u, ntB], [uRoot + 0.02, 2], [1, 2]]);
  const nb = prof([[0, 2.1], [by('haunch').u, 2.0], [by('barrel').u, nbB], [by('chest').u, nbB * 0.95], [uRoot + 0.02, 2], [1, 2]]);
  const seg = Math.round((28 + 10 * (S.neckLen || 0)) * det), rad = 2 * Math.round(9 * det + 3);
  // Hamstring / buttock mass: swells the lower-lateral rear quadrant so the rear outline bulges at the
  // point of buttock and turns under into the thigh instead of ending in a vertical plate.
  const uH = by('haunch').u, hams = S.hams ?? 0.12;
  const hamBump = (u, a) => hams * (1 - sstep(uH * 0.35, uH * 1.25, u)) * bell(Math.sin(a), -0.28, 0.95) * (0.55 + 0.45 * Math.abs(Math.cos(a)));
  const bump = S.bumpFn ? (u, a, x, y) => hamBump(u, a) + S.bumpFn(u, a, x, y) : hamBump;
  const g = loft({ curve, seg, rad, w: pW, ht, hb: pHB, nt, nb, cap0: { type: 'round', len: S.rumpCap ?? 0.95, n: 5 }, cap1: { type: 'round', len: 0.62, n: 3 }, bend: 0.85, bump });
  L.torso = g; L.torsoCurve = curve; L.uOf = Object.fromEntries(keys.map(k => [k.n, k.u]));
  // axial bones (dorsal bias so bending stretches the belly, not the back)
  const at = (u, bias = 0.25) => { const f = g.frame(u); return f.c.addScaledVector(f.up, bias * ht(u)); };
  const U = L.uOf;
  rig.add('Root', null, [0, 0, 0]);
  rig.add('Hips', 'Root', at(U.haunch));
  rig.add('Spine1', 'Hips', at(U.loin));
  rig.add('Spine2', 'Spine1', at(U.barrel));
  rig.add('Chest', 'Spine2', at(U.chest));
  rig.add('Neck1', 'Chest', at(U.neckRoot, 0.1));
  rig.add('Neck2', 'Neck1', at(lerp(U.neck1, U.neck2, 0.5), 0));
  rig.add('Head', 'Neck2', L.poll);
  L.axial = rig.spec(['Hips', 'Spine1', 'Spine2', 'Chest', 'Neck1', 'Neck2', 'Head'], [0, U.loin, U.barrel, U.chest, U.neckRoot + 0.02, lerp(U.neck1, U.neck2, 0.5), uTop - 0.01], 0.32);
  L.torsoHt = ht; L.torsoW = pW; L.torsoHb = pHB;
  return g;
}

/** Skin weights for torso vertices: axial chain blended with nearby limb roots so haunches follow thighs. */
function tetraTorsoSkin(B, L) {
  const rig = B.rig;
  return (u, a, P) => {
    let W = rig.chain(L.axial, u);
    for (const lm of L.limbs) {
      if (P.x * lm.side < 0) continue;
      const a0 = lm.joints[lm.inf[0]].p, a1 = lm.joints[lm.inf[1]].p;
      const d = V3().subVectors(a1, a0), t = clamp(V3().subVectors(P, a0).dot(d) / Math.max(1e-9, d.lengthSq()), 0, 1);
      const dist = P.distanceTo(a0.clone().addScaledVector(d, t));
      const f = (1 - sstep(lm.reach * 0.55, lm.reach * 1.25, dist)) * lm.pull * (1 - 0.6 * Math.max(0, Math.sin(a)));
      if (f > 0.01) W = mixW(W, rig.W(lm.bones[lm.inf[2]]), f);
    }
    return W;
  };
}

/** Head: skull loft + hinged jaw loft (real mouth opening), eyes, nose, teeth and membrane ears. */
function tetraHead(B, S, L) {
  const det = B.det, rig = B.rig, Lh = L.Lh, ch = L.ch, cw = L.cw, hd = L.hd, hu = L.hu, O = L.headO;
  const sn = S.snout, s0 = 1 - sn, sw = S.snoutW, sd = S.snoutD, stop = S.stop || 0, dome = S.dome || 1, cheek = S.cheek || 1;
  const sEye = clamp(S.eyeS ?? (s0 - 0.05), 0.2, 0.8);
  const mt = sd * ch, mt2 = lerp(sd * ch, 0.85 * ch, 0.3);
  // REVISED SKULL: braincase is egg-shaped (wider just behind the eyes, rounded occiput via a long
  // back cap), with a supraorbital brow shelf over the eyes and a zygomatic flare below them, so the
  // skull no longer reads as a straight tapered tube.
  const brow = S.brow ?? 0.05;
  const W0 = prof([[0, 0.66 * cw], [0.1, 0.92 * cw], [0.22, cw], [sEye, cheek * cw], [s0, lerp(cheek * cw, sw * cw, 0.42)], [s0 + 0.55 * sn, lerp(cw, sw * cw, 0.86)], [1, sw * cw]]);
  const W = (s) => W0(s) + brow * 1.2 * cw * bell(s, sEye - 0.01, 0.13);
  const HT = (s) => prof([[0, 0.62 * ch * dome], [0.12, 0.9 * ch * dome], [0.24, ch * dome], [sEye, 0.93 * ch], [s0, lerp(0.86 * ch, mt2, stop)], [s0 + 0.55 * sn, lerp(mt2, mt, 0.55)], [1, mt]])(s)
    + (S.roman || 0) * 0.14 * ch * bell(s, s0 + 0.45 * sn, 0.4 * sn) + (S.casque || 0) * 0.3 * ch * bell(s, S.casqueS ?? 0.12, S.casqueW ?? 0.2)
    + brow * ch * bell(s, sEye - 0.03, 0.12);
  const HB = prof([[0, 0.52 * ch], [0.14, 0.72 * ch], [sEye, 0.7 * ch * (S.jowl || 1)], [s0, 0.5 * ch], [1, 0.4 * mt]]);
  const OY = prof([[0, 0], [Math.max(0.05, s0 - 0.12), 0], [1, -(S.drop || 0) * ch]]);
  const nMuz = S.muzzleN || 2.2;
  const NT = prof([[0, 2], [s0, 2.05], [1, nMuz]]), NB = prof([[0, 2], [s0, 2.1], [1, nMuz + 0.2]]);
  const tip = O.clone().addScaledVector(hd, Lh);
  const g = loft({ pts: [O, tip], seg: Math.round(18 * det), rad: 2 * Math.round(8 * det + 3), w: W, ht: HT, hb: HB, oy: OY, nt: NT, nb: NB, up: hu,
    cap0: { type: 'round', len: S.occiput ?? 0.72, n: 3 }, cap1: S.nose === 'disc' ? { type: 'flat' } : { type: 'round', len: S.noseCap ?? 0.5, n: 3 }, bend: 0, antifold: false });
  L.head = g; L.headS = { s0, sEye, sn, W, HT, HB, OY };
  const headW = rig.W('Head');
  const paint = B.paint;
  const palate = (s, a) => s > s0 - 0.08 && s < 0.97 && Math.abs(a - 1.5 * Math.PI) < 0.55;
  // eyes: ray-cast a yaw/elevation direction from the skull centre onto the lofted surface
  const eyeR = S.eye * Lh, yaw = (S.eyeYaw ?? 55) * DEG, el = (S.eyeEl ?? 18) * DEG;
  const eFr = g.frame(sEye), eC = eFr.c.clone().addScaledVector(hu, OY(sEye) + (HT(sEye) - HB(sEye)) * 0.5);
  L.eyes = [1, -1].map((side) => {
    const dir = hd.clone().multiplyScalar(Math.cos(yaw) * Math.cos(el)).add(V3(side * Math.sin(yaw) * Math.cos(el), 0, 0)).addScaledVector(hu, Math.sin(el)).normalize();
    const hit = surfaceToward(g, eC, dir, Math.max(0.05, sEye - 0.3), Math.min(0.97, sEye + 0.25));
    return { c: hit.p.clone().addScaledVector(hit.n, -eyeR * (S.eyeInset ?? 0.58)), dir: hit.n.clone().lerp(dir, 0.5).normalize(), side };
  });
  emit(B.part('head', { group: 'head' }), g, (s, a, P) => palate(s, a) ? 'mouth' : (S.nose === 'disc' && s >= 0.999) ? 'nose' : paint({ part: 'head', u: s, a, P, s0 }), headW);
  // ── jaw: hinged at the temporomandibular joint, its top hidden inside the skull until it opens
  const sJ0 = 0.14, sJ1 = 0.955;
  const jawExtra = (S.jaw ?? 0.5) * ch * 0.55, lip = 0.22 * mt + 0.002 * L.H;
  const jTop = (s) => OY(s) - HB(s) * 0.3;
  const jBot = (s) => OY(s) - HB(s) - lerp(jawExtra, lip, sstep(sJ0 + 0.12, sJ1, s)) * (S.chin ? 1 + S.chin * bell(s, 0.9, 0.14) : 1);
  const jw = (s) => W(s) * lerp(0.74, 0.66, sstep(0.3, 1, s)) * (S.jawW || 1);
  const jpts = [];
  for (let i = 0; i <= 8; i++) { const s = lerp(sJ0, sJ1, i / 8); jpts.push(O.clone().addScaledVector(hd, s * Lh).addScaledVector(hu, (jTop(s) + jBot(s)) / 2)); }
  const jcurve = makePath(jpts);
  const sOf = (u) => lerp(sJ0, sJ1, u), jh = (u) => (jTop(sOf(u)) - jBot(sOf(u))) / 2;
  const jg = loft({ curve: jcurve, seg: Math.round(12 * det), rad: 2 * Math.round(6 * det + 2), w: (u) => jw(sOf(u)), ht: jh, hb: jh,
    nt: 1.9, nb: 2.2, up: hu, cap0: { type: 'round', len: 0.7, n: 2 }, cap1: { type: 'round', len: 0.5, n: 2 }, bend: 0.5 });
  const tmj = O.clone().addScaledVector(hd, 0.2 * Lh).addScaledVector(hu, OY(0.2) - HB(0.2) * 0.4);
  rig.add('Jaw', 'Head', tmj, tip.clone().addScaledVector(hu, jBot(1)));
  L.jaw = jg;
  emit(B.part('jaw', { group: 'head' }), jg, (u, a, P) => Math.abs(a - Math.PI / 2) < 0.5 && u > 0.1 ? 'mouth' : paint({ part: 'jaw', u: sOf(u), a, P, s0 }), rig.W('Jaw'));
  // ── whisker pads (mystacial pads for felids / carnivores)
  if (S.whiskerPads) {
    const sWp = s0 + 0.55 * sn, wpL = sn * Lh * 0.28;
    for (const side of [1, -1]) {
      const cWp = tip.clone().addScaledVector(hd, -wpL * 0.65).addScaledVector(hu, OY(sWp) + 0.08 * mt).add(V3(side * sw * cw * 0.38, 0, 0));
      const wpg = ellipsoid(cWp, sw * cw * 0.32, mt * 0.22, wpL, hd.clone().add(V3(side * 0.12, 0, 0)).normalize(), hu, 5, 8);
      emit(B.part('head', { group: 'head' }), wpg, (u, a, P) => paint({ part: 'head', u: sWp, a: side > 0 ? 0.05 : Math.PI - 0.05, P, s0 }), headW);
    }
  }
  // ── eyes with pupils and snug lids
  for (const { c, dir, side } of L.eyes) {
    const eg = ellipsoid(c, eyeR, eyeR * (S.eyeSquash || 1), eyeR, dir, hu, Math.round(8 * det + 2), 2 * Math.round(6 * det + 2));
    const pupil = S.pupil || 'round';
    emit(B.part('eyes', { group: 'head' }), eg, (u, a, P) => {
      if (S.turret && u < 0.8) return paint({ part: 'lid', u, a, P });
      const front = u > 0.8;
      if (!front) return 'eye';
      if (pupil === 'slit') return u > 0.82 && Math.abs(Math.cos(a)) < (S.slitW ?? 0.22) ? 'pupil' : 'eye';
      if (pupil === 'bar') return u > 0.84 && Math.abs(Math.sin(a)) < 0.3 ? 'pupil' : 'eye';
      return u > 0.86 ? 'pupil' : 'eye';
    }, headW);
    if (det >= 0.9 && S.lids !== false) {
      const bas = basisFrom(dir, hu), ring = [];
      const lidFwd = S.lidFwd ?? 0.16, lidThk = S.lidThk ?? 0.085;
      const canthal = (S.canthalTilt ?? (S.pupil === 'slit' ? 10 : 0)) * DEG * side;
      const cosC = Math.cos(canthal), sinC = Math.sin(canthal);
      for (let i = 0; i < 14; i++) {
        const t = (i / 14) * TAU;
        const xRaw = Math.cos(t) * eyeR * 0.95;
        const yRaw = Math.sin(t) * eyeR * 0.95 * (S.eyeSquash || 1);
        const xRot = xRaw * cosC - yRaw * sinC;
        const yRot = xRaw * sinC + yRaw * cosC;
        ring.push(c.clone().addScaledVector(dir, eyeR * lidFwd).addScaledVector(bas.s, xRot).addScaledVector(bas.u, yRot));
      }
      const lg = loft({ pts: ring, closed: true, seg: 14, rad: 5, w: eyeR * lidThk, ht: eyeR * lidThk, hb: eyeR * lidThk, up: dir });
      emit(B.part('eyelids', { group: 'head' }), lg, (u, a, P) => paint({ part: 'lid', u, a, P }), headW);
    }
  }
  // ── nose rhinarium
  if (S.nose === 'feline' || S.noseStyle === 'feline') {
    const p = g.at(0.995, Math.PI / 2).p;
    const nw = (S.noseW ?? 0.34) * sw * cw, nh = (S.noseH ?? 0.26) * mt, nd = (S.noseD ?? 0.14) * mt;
    const fwd = hd.clone().addScaledVector(hu, -0.05).normalize();
    const nTop = p.clone().addScaledVector(fwd, nd * 0.2).addScaledVector(hu, -nh * 0.05);
    const nMid = p.clone().addScaledVector(fwd, nd * 0.45).addScaledVector(hu, -nh * 0.45);
    const nBot = p.clone().addScaledVector(fwd, nd * 0.25).addScaledVector(hu, -nh * 0.95);
    const npts = [nTop, nMid, nBot];
    const ng = loft({
      pts: npts, seg: 4, rad: 8,
      w: (u) => nw * (u < 0.25 ? lerp(0.82, 1.0, u / 0.25) : lerp(1.0, 0.18, (u - 0.25) / 0.75)),
      ht: (u) => nd * (0.9 - 0.5 * u), hb: (u) => nd * (0.9 - 0.5 * u),
      up: fwd, cap0: { type: 'round', len: 0.25, n: 2 }, cap1: { type: 'round', len: 0.2, n: 2 },
    });
    emit(B.part('nose', { group: 'head' }), ng, 'nose', headW);
    // nostril hollows
    for (const side of [1, -1]) {
      const nst = nMid.clone().addScaledVector(fwd, nd * 0.12).add(V3(side * nw * 0.65, 0, 0)).addScaledVector(hu, -nh * 0.1);
      const slit = ellipsoid(nst, nw * 0.15, nh * 0.12, nd * 0.22, hd, hu, 3, 5);
      emit(B.part('nose', { group: 'head' }), slit, 'mouth', headW);
    }
  } else if (S.nose === 'pad') {
    const { p } = g.at(0.995, Math.PI / 2);
    const c = tip.clone().addScaledVector(hd, mt * 0.12).addScaledVector(hu, OY(1) + mt * 0.25);
    const ng = ellipsoid(c.lerp(p, 0.38), sw * cw * 0.48, mt * 0.38, mt * 0.22, hd.clone().addScaledVector(hu, 0.25).normalize(), hu, 5, 10);
    emit(B.part('nose', { group: 'head' }), ng, 'nose', headW);
  } else if (S.nose === 'muzzle' || S.nose === 'disc') {
    for (const side of [1, -1]) {
      const nA = S.nostrilA ?? 0.32, { p, n } = g.at(S.nose === 'disc' ? 0.999 : (S.nostrilS ?? 0.975), side > 0 ? nA : Math.PI - nA);
      const r = (S.nostril || 0.28) * Math.min(sw * cw, mt);
      const ng = ellipsoid(p.addScaledVector(n, -r * 0.45), r * 0.7, r, r * 0.55, n, hu, 4, 8);
      emit(B.part('nose', { group: 'head' }), ng, S.nose === 'disc' ? 'mouth' : 'nose', headW);
    }
  }
  // ── rodent / lagomorph incisors
  if (S.incisors > 0) for (const side of [1, -1]) {
    const b = g.at(0.985, 1.5 * Math.PI + side * 0.1).p, dn = hu.clone().multiplyScalar(-1).addScaledVector(hd, 0.1).normalize(), Li = S.incisors * Lh;
    const ig = loft({ pts: [b.clone().addScaledVector(dn, -Li * 0.3), b.clone().addScaledVector(dn, Li)], seg: 2, rad: 6, w: Li * 0.22, ht: Li * 0.12, hb: Li * 0.12, up: hd, cap0: 'flat', cap1: { type: 'round', len: 0.3, n: 2 }, bend: 0 });
    emit(B.part('teeth', { group: 'head' }), ig, 'teeth', headW);
  }
  // ── teeth (canines / fangs)
  if (S.fang > 0) {
    for (const side of [1, -1]) {
      const up = g.at(s0 + 0.66 * sn, 1.5 * Math.PI + side * 0.42);
      const dn = hu.clone().multiplyScalar(-1).addScaledVector(hd, 0.12).normalize(), Lf = S.fang * Lh;
      const tg = tube([up.p.clone().addScaledVector(dn, -Lf * 0.25), up.p.clone().addScaledVector(dn, Lf * 0.5), up.p.clone().addScaledVector(dn, Lf).addScaledVector(hd, -Lf * 0.12)], (u) => Lf * 0.16 * (1 - u * 0.92), 5, 5, { cap1: 'point', cap0: 'flat' });
      emit(B.part('teeth', { group: 'head' }), tg, 'teeth', headW);
      const lo = jg.at(0.82, Math.PI / 2 + side * 0.5), Lb = Lf * 0.75;
      const lg = tube([lo.p.clone().addScaledVector(hu, -Lb * 0.3), lo.p.clone().addScaledVector(hu, Lb * 0.45), lo.p.clone().addScaledVector(hu, Lb).addScaledVector(hd, Lb * 0.08)], (u) => Lb * 0.16 * (1 - u * 0.92), 5, 5, { cap1: 'point', cap0: 'flat' });
      emit(B.part('teeth', { group: 'head' }), lg, 'teeth', rig.W('Jaw'));
    }
  }
  if (S.ear && S.ear.style !== 'none') tetraEars(B, S, L);
  return g;
}

const EAR_PROFILES = {
  pointed: [[0, 0.82], [0.25, 1], [0.62, 0.6], [1, 0.03]],
  prick: [[0, 0.95], [0.22, 1.0], [0.55, 0.65], [0.82, 0.35], [1, 0.04]],
  feline: [[0, 1.0], [0.18, 0.90], [0.45, 0.66], [0.72, 0.40], [0.92, 0.18], [1, 0.03]],
  round: [[0, 0.72], [0.35, 1], [0.72, 0.86], [0.93, 0.48], [1, 0.06]],
  long: [[0, 0.5], [0.25, 0.92], [0.6, 1], [0.86, 0.68], [1, 0.08]],
  floppy: [[0, 0.55], [0.25, 0.95], [0.55, 1.0], [0.82, 0.78], [1, 0.28]],
  hound: [[0, 0.45], [0.2, 0.88], [0.45, 1.0], [0.75, 0.95], [0.92, 0.68], [1, 0.22]],
  semiPrick: [[0, 0.90], [0.28, 1.0], [0.58, 0.72], [0.82, 0.42], [1, 0.05]],
  button: [[0, 0.78], [0.30, 1.0], [0.65, 0.78], [0.90, 0.42], [1, 0.10]],
  rose: [[0, 0.70], [0.35, 1.0], [0.70, 0.72], [1, 0.12]],
  bat: [[0, 0.88], [0.30, 1.05], [0.60, 0.96], [0.85, 0.74], [1, 0.22]],
  fan: [[0, 0.62], [0.28, 1], [0.72, 0.96], [0.94, 0.5], [1, 0.12]],
  tufted: [[0, 0.82], [0.25, 1], [0.62, 0.58], [1, 0.03]],
};
/** Cupped, thickened ear membranes swept along a (possibly drooping or folded) axis. */
function tetraEars(B, S, L) {
  const E = S.ear, rig = B.rig, det = B.det, g = L.head, hd = L.hd, hu = L.hu;
  const Le = E.len * L.Lh, wMax = E.w * Le, wp = prof(EAR_PROFILES[E.style] || EAR_PROFILES.pointed);
  const isHanging = E.style === 'floppy' || E.style === 'hound' || (E.droop ?? 0) > 0.4 || E.hang !== undefined;
  for (const side of [1, -1]) {
    const a = Math.PI / 2 - side * (E.a ?? 0.75);
    const { p, n } = g.at(E.s ?? 0.2, a);
    // The pinna rises from a narrow stalk buried 0.3 wMax inside the skull and flares to full width just
    // above the surface, so the root never floats off a curving skull (the sweep is lengthened to keep
    // the visible ear length unchanged).
    const inset = wMax * 0.3, LeT = Le + inset * 0.4;
    const base = p.clone().addScaledVector(n, -inset);
    const rootF = (u) => lerp(0.42, 1, sstep(0, 0.24, u));
    let axis;
    if (isHanging) {
      // root direction: out to the side by `spread`, pitched down by `hang` (12.5° matches a hound's ear set)
      const hang = (E.hang ?? 12.5) * DEG, spr = (E.spread ?? 20) * DEG;
      axis = V3(side * Math.sin(spr) * Math.cos(hang), -Math.sin(hang), Math.cos(spr) * 0.08 * Math.cos(hang)).normalize();
    } else {
      axis = hu.clone().multiplyScalar(Math.cos((E.spread ?? 25) * DEG)).add(V3(side * Math.sin((E.spread ?? 25) * DEG), 0, 0)).normalize();
      axis.applyAxisAngle(V3(1, 0, 0), -(E.tilt ?? 15) * DEG);
    }
    const down = V3(side * 0.02, -0.99, 0.06).normalize();
    let face = hd.clone().applyAxisAngle(V3(0, 1, 0), side * (E.turn ?? 25) * DEG);
    const N = 12, cs = [base.clone()], dirs = [];
    for (let i = 0; i < N; i++) {
      const u = i / N;
      let d;
      if (E.style === 'semiPrick') {
        const breakU = E.breakU ?? 0.58;
        const tipDir = hd.clone().multiplyScalar(0.7).addScaledVector(hu, -0.45).add(V3(side * 0.1, 0, 0)).normalize();
        const tBreak = clamp((u - breakU) / (1 - breakU), 0, 1);
        d = axis.clone().lerp(tipDir, Math.pow(tBreak, 1.3)).normalize();
      } else if (E.style === 'button') {
        const foldDir = hd.clone().multiplyScalar(0.85).addScaledVector(hu, -0.5).add(V3(side * 0.08, 0, 0)).normalize();
        const tFold = clamp((u - 0.12) / 0.5, 0, 1);
        d = axis.clone().lerp(foldDir, Math.pow(tFold, 1.4)).normalize();
      } else if (E.style === 'rose') {
        const foldDir = hd.clone().multiplyScalar(-0.8).addScaledVector(hu, -0.3).add(V3(side * 0.35, 0, 0)).normalize();
        const tFold = clamp((u - 0.12) / 0.5, 0, 1);
        d = axis.clone().lerp(foldDir, Math.pow(tFold, 1.4)).normalize();
      } else if (isHanging) {
        const droopPower = E.style === 'hound' ? 0.7 : 0.9;
        const droopFactor = clamp((E.droop ?? 0.95) * Math.pow(u, droopPower), 0, 1);
        d = axis.clone().lerp(down, droopFactor).normalize();
      } else {
        d = axis.clone().lerp(down, clamp((E.droop || 0) * Math.pow(u + 0.08, 1.2), 0, 1)).normalize();
      }
      dirs.push(d);
      cs.push(cs[i].clone().addScaledVector(d, LeT / N));
    }
    dirs.push(dirs[N - 1]);
    const at = (u) => {
      const f = u * N, i = Math.min(N - 1, Math.floor(f)), t = f - i;
      return { c: cs[i].clone().lerp(cs[i + 1], t), d: dirs[i].clone().lerp(dirs[i + 1], t).normalize() };
    };
    const bone = side > 0 ? 'EarL' : 'EarR';
    rig.add(bone, 'Head', base, cs[N]);
    // ear-base mound (auricular muscles): hides the pinch where the pinna enters the skull
    if (E.mound !== false) {
      const mr = wMax * (E.moundR ?? 0.36), mc = p.clone().addScaledVector(n, mr * 0.05).addScaledVector(axis, mr * 0.15);
      emit(B.part('head', { group: 'head' }), ellipsoid(mc, mr, mr * 0.7, mr * 1.05, hd, n, 5, 10), (uu, aa, P) => B.paint({ part: 'head', u: E.s ?? 0.2, a: Math.PI / 2, P, s0: L.headS.s0 }), rig.W2('Head', bone, 0.35));
    }
    const cup = E.cup ?? 0.35;
    const innerW = E.innerW ?? 0.55, innerLen = E.innerLen ?? 0.82;
    // offset > 0 moves the flap behind its root line (an elephant's ear hangs back from its front edge)
    const off = E.offset ?? 0, thick = E.thick ?? 1;
    const part = B.part('ears', { group: 'ears' });
    sheet(part, {
      nu: Math.round((E.style === 'long' || E.style === 'fan' || E.style === 'hound' ? 10 : 7) * det + 1),
      nv: Math.round(5 * det + 1),
      f: (u, v) => {
        const { c, d } = at(u);
        const sUp = new THREE.Vector3().crossVectors(face, d).normalize();
        let s;
        if (isHanging) {
          // Pendant ear flap hangs against the cheek: width runs fore-aft in WORLD space (not along
          // the muzzle axis, which on a steeply angled head such as an elephant's points downward and
          // would turn the flap into a vertical fin); the normal faces laterally outward.
          let sHang = V3(0, 0, -side);
          sHang.addScaledVector(d, -sHang.dot(d)).normalize();
          const hangT = E.style === 'fan' ? 1 : clamp(0.45 + Math.pow(u, 0.5) * 1.2, 0, 1);
          s = sUp.clone().lerp(sHang, hangT).normalize();
        } else {
          s = sUp;
        }
        const fc = new THREE.Vector3().crossVectors(d, s).normalize();
        const w = wMax * wp(u) * rootF(u), x = 2 * v - 1;
        const cupU = lerp(cup, Math.max(cup, 0.95), 1 - sstep(0.04, 0.42, u)) * (isHanging ? 0.7 : 1);
        return c.addScaledVector(s, w * (x + off) * side).addScaledVector(fc, cupU * w * (x * x - 0.35));
      },
      th: (u, v) => Math.max(0.0006, thick * wMax * 0.14 * (1 - 0.7 * (2 * v - 1) ** 2) * (1 - 0.55 * u)),
      zone: (u, v, face) => (face > 0) === (side > 0) && Math.abs(2 * v - 1) < innerW && u < innerLen && u > 0.05 ? 'skin' : B.paint({ part: 'ear', u, a: v * TAU, P: at(u).c }),
      skin: (u) => u < 0.18 ? rig.W2('Head', bone, u / 0.18) : rig.W(bone),
    });
    if (E.style === 'tufted') {
      const { c, d } = at(1);
      emit(B.part('ears', { group: 'ears' }), tube([c.clone().addScaledVector(d, -LeT * 0.05), c.clone().addScaledVector(d, LeT * 0.35)], (u) => wMax * 0.12 * (1 - u), 4, 4, { cap1: 'point' }), 'marking', rig.W(bone));
    }
  }
}

/**
 * Limb joint layouts. Each template returns joints top → ground ({p, w, d} with lateral / fore-aft
 * half-thickness) for a stance. Joint heights derive from body depth so leg length is a real rebuild.
 */
function tetraLimbJoints(S, L, front, side) {
  const H = L.H, D = L.D, Lt = L.Lt, U = L.uOf;
  const st = front ? (S.foreStance || S.stance) : (S.hindStance || S.stance);
  const th = (front ? S.foreThk : S.hindThk) || S.legThk || 1;
  const fr = L.torso.frame(front ? lerp(U.chest, U.neckRoot, 0.4) : U.haunch);
  const halfW = front ? L.torsoW(lerp(U.chest, U.neckRoot, 0.4)) : L.torsoW(U.haunch);
  const sx = side * Math.max(0.2 * halfW, halfW * (S.legInset ?? 0.62));
  const sp = (S.splay || 0) * H * side;
  const C = Math.max(0.05 * H, L.elbowY);
  const J = (x, y, z, w, d) => ({ p: V3(x, Math.max(0, y), z), w: w * H * th, d: (d ?? w) * H * th });
  const kneeLift = S.kneeLift || 0;
  if (front) {
    const sz = L.zF - (S.shoulderBack ?? 0.07) * Lt;
    const top = J(sx * 0.32, H - 0.2 * D, L.zF - 0.25 * Lt, 0.034, 0.088);
    const sh = J(sx * 0.8, H - 0.6 * D, sz, 0.055, 0.1);
    if (st === 'sprawl') {
      const lu = (S.limbLen ?? 0.3) * Lt * (S.foreLimb ?? 1), y0 = fr.c.y - 0.05 * D, spl = S.limbSplay ?? 1, k = th;
      const Jl = (x, y, z, w, d) => ({ p: V3(x, Math.max(0, y), z), w: w * lu * k, d: (d ?? w) * lu * k });
      const s1 = Jl(sx * 0.85, y0, sz, 0.17), e1 = Jl(sx * 0.85 + side * lu * 0.92 * spl, Math.max(y0 - lu * 0.15, 0.32 * lu), sz + lu * 0.12, 0.12);
      const w1 = Jl(e1.p.x + side * 0.12 * lu * spl, 0.14 * lu, e1.p.z + 0.05 * lu, 0.085), p1 = Jl(w1.p.x + side * 0.1 * lu * spl, 0.045 * lu, w1.p.z + 0.18 * lu, 0.075, 0.04);
      return { st, foot: S.flippers ? 'flipper' : 'hand', lu, joints: [Jl(sx * 0.4, y0 + 0.12 * D, sz - 0.08 * Lt, 0.13), s1, e1, w1, p1, Jl(p1.p.x + side * 0.18 * lu * spl, 0.01 * lu, p1.p.z + 0.42 * lu, 0.03)] };
    }
    if (st === 'arm') {
      const y0 = H - 0.55 * D, a = S.armLen || 0.4;
      return { st, foot: 'hand', joints: [top, J(sx, y0, sz, 0.05), J(sx + side * 0.03 * H, y0 - 0.45 * a * H, sz - 0.1 * a * H, 0.042), J(sx + side * 0.05 * H, y0 - 0.65 * a * H, sz + 0.28 * a * H, 0.03), J(sx + side * 0.05 * H, y0 - 0.72 * a * H, sz + 0.42 * a * H, 0.022), J(sx + side * 0.05 * H, y0 - 0.8 * a * H, sz + 0.52 * a * H, 0.012)] };
    }
    const el = J(sx * 0.98 + sp * 0.3, C + 0.03 * H, sz - 0.075 * H, 0.058, 0.07);
    if (st === 'ungulate') {
      const ca = J(sx * 0.93 + sp * 0.6, 0.53 * C, el.p.z + 0.01 * H, 0.04, 0.045), fe = J(sx * 0.9 + sp, 0.11 * C, ca.p.z + 0.005 * H, 0.032, 0.04);
      const co = J(sx * 0.9 + sp, 0.035 * H, fe.p.z + 0.045 * H, 0.03, 0.032);
      return { st, foot: 'hoof', joints: [top, sh, el, ca, fe, co, J(sx * 0.9 + sp, 0, co.p.z + 0.012 * H, 0.03)] };
    }
    if (st === 'plantigrade') {
      const wr = J(sx * 0.95 + sp, 0.075 * H, el.p.z + 0.03 * H, 0.04, 0.042);
      return { st, foot: 'sole', joints: [top, sh, el, wr, J(sx * 0.95 + sp, 0.03 * H, wr.p.z + 0.1 * H * (S.footLen || 1), 0.042, 0.02), J(sx * 0.95 + sp, 0.012 * H, wr.p.z + 0.17 * H * (S.footLen || 1), 0.035, 0.012)] };
    }
    if (st === 'graviportal') {
      const wr = J(sx * 0.95 + sp, 0.22 * C, el.p.z + 0.02 * H, 0.05, 0.052);
      return { st, foot: 'pad', joints: [top, sh, el, wr, J(sx * 0.95 + sp, 0.045 * H, wr.p.z + 0.01 * H, 0.056, 0.058), J(sx * 0.95 + sp, 0, wr.p.z + 0.012 * H, 0.06)] };
    }
    // digitigrade
    const wr = J(sx * 0.94 + sp, 0.26 * C, el.p.z + 0.005 * H, 0.038, 0.04);
    const pw = J(sx * 0.93 + sp, 0.045 * H, wr.p.z + 0.045 * H, 0.034, 0.033);
    return { st, foot: 'paw', joints: [top, sh, el, wr, pw, J(sx * 0.93 + sp, 0.012 * H, pw.p.z + 0.075 * H * (S.footLen || 1), 0.022, 0.012)] };
  }
  // Hip (acetabulum) sits mid-pelvis, well inside the haunch mass: the thigh root is buried in the
  // rump (no exposed cap behind the quarters) and the femur angles forward-down to a stifle at the
  // flank, so the quarters read as one continuous muscle from croup to gaskin. The upper thigh is a
  // deep (fore-aft) but narrow (lateral) slab that lies flush with the flank.
  // REVISED HIND ROOT: the thigh is no longer a 0.06H tube poked into the underside of the rump. The
  // quarter is a deep (fore-aft) but laterally slim mass sized from the BODY (rump depth / haunch
  // half-width), whose outer face lies flush with the flank. It rises from an ilium root buried under
  // the croup (`pre`, emitted only as part of the leg sweep), passes the hip joint and narrows to the
  // stifle at the flank fold, so croup → buttock → gaskin reads as one continuous muscle.
  const grav = st === 'graviportal';
  const hz = L.zB + (S.hipFwd ?? 0.22) * Lt;
  const hy = L.yR - (S.hipDrop ?? 0.4) * L.Dr;
  const thighW = (S.thighW ?? (grav ? 0.42 : 0.36)) * halfW * Math.sqrt(th);
  const thighD = (S.thighD ?? (grav ? 0.4 : 0.42)) * L.Dr * Math.sqrt(th);
  const hipX = side * Math.max(0.2 * halfW, halfW * 1.03 - thighW);
  const hip = { p: V3(hipX, hy, hz - 0.035 * Lt), w: thighW, d: thighD };
  const pre = { p: V3(hipX * 0.72, L.yR - 0.17 * L.Dr, hz - 0.06 * Lt), w: thighW * 0.82, d: thighD * 0.82 };
  const cr = S.crouch || 0;
  if (st === 'sprawl' || st === 'frog') {
    const lu = (S.limbLen ?? 0.3) * Lt * (S.hindLimb ?? 1.15), spl = S.limbSplay ?? 1, k = th, fy = hy;
    const Jl = (x, y, z, w, d) => ({ p: V3(x, Math.max(0, y), z), w: w * lu * k, d: (d ?? w) * lu * k });
    if (st === 'frog') {
      // folded jumping leg: thigh forward-out, shin back, long tarsus forward along the ground
      const h0 = Jl(sx * 0.6, fy, hz, 0.2), kn2 = Jl(sx * 0.6 + side * lu * 0.55 * spl, Math.max(fy * 0.55, 0.22 * lu), hz + lu * 0.85, 0.15);
      const an = Jl(kn2.p.x + side * lu * 0.12, 0.16 * lu, hz - lu * 0.05, 0.1), so = Jl(an.p.x + side * lu * 0.05, 0.05 * lu, an.p.z + lu * 0.55, 0.075, 0.04);
      return { st, foot: S.flippers ? 'flipper' : 'hand', lu, joints: [h0, kn2, an, so, Jl(so.p.x + side * lu * 0.15, 0.01 * lu, so.p.z + lu * 0.7, 0.03)] };
    }
    const h0 = Jl(sx * 0.6, hy, hz, 0.19), kn2 = Jl(sx * 0.6 + side * lu * spl, Math.max(hy - 0.1 * lu, 0.3 * lu), hz + 0.3 * lu, 0.13);
    const an = Jl(kn2.p.x + side * 0.12 * lu * spl, 0.13 * lu, kn2.p.z - 0.25 * lu, 0.09), so = Jl(an.p.x + side * 0.12 * lu * spl, 0.045 * lu, an.p.z + 0.12 * lu, 0.075, 0.04);
    return { st, foot: S.flippers ? 'flipper' : 'hand', lu, joints: [h0, kn2, an, so, Jl(so.p.x + side * 0.3 * lu * spl, 0.01 * lu, so.p.z + 0.5 * lu, 0.03)] };
  }
  // stifle: at the flank line, forward of the hip (femur ~40-50° from vertical), lateral face proud of the belly
  const kn = J(sx * 1.04 + sp * 0.2, L.yR - (0.97 + 0.1 * cr) * L.Dr + 0.02 * H, hz + (0.1 * Math.min(H, Lt) + 0.3 * cr * L.yR), 0.06, 0.1);
  // hock: the tibia slopes back from the stifle at a fixed anatomical angle (tan 0.95 ≈ 43°; giraffes
  // and camels are steeper), which keeps the hock under the point of the buttock for every body
  // length / leg length ratio; crouching species fold it back under the rump instead
  const hockZ = (y) => lerp(kn.p.z - (kn.p.y - y) * (S.tibiaSlope ?? (st === 'ungulate' ? 0.92 : 0.8)), L.zB + 0.13 * Lt, cr);
  if (st === 'ungulate') {
    const hky = 0.48 * (L.yR - 0.45 * L.Dr);
    const hk = J(sx * 0.9 + sp * 0.6, hky, Math.max(hockZ(hky), L.zB + 0.03 * Lt), 0.034, 0.055), fe = J(sx * 0.88 + sp, 0.11 * C, hk.p.z + 0.03 * H, 0.032, 0.04);
    const co = J(sx * 0.88 + sp, 0.035 * H, fe.p.z + 0.045 * H, 0.03, 0.032);
    return { st, foot: 'hoof', pre, joints: [hip, kn, hk, fe, co, J(sx * 0.88 + sp, 0, co.p.z + 0.012 * H, 0.03)] };
  }
  if (st === 'plantigrade') {
    const an = J(sx * 0.95 + sp, 0.075 * H, hz - (0.11 + 0.06 * cr) * H, 0.042, 0.052);
    return { st, foot: 'sole', pre, joints: [hip, J(sx * 1.02 + sp * 0.2, kn.p.y - 0.04 * H, hz + (0.08 + 0.08 * cr) * H, 0.06, 0.09), an, J(sx * 0.95 + sp, 0.03 * H, an.p.z + 0.13 * H * (S.footLen || 1), 0.045, 0.02), J(sx * 0.95 + sp, 0.012 * H, an.p.z + 0.21 * H * (S.footLen || 1), 0.038, 0.012)] };
  }
  if (st === 'graviportal') {
    const an = J(sx * 0.95 + sp, 0.24 * (L.yR - 0.45 * L.Dr), hz - 0.03 * H, 0.05, 0.055);
    return { st, foot: 'pad', pre, joints: [hip, J(sx + sp * 0.2, kn.p.y, hz + 0.03 * H, 0.068, 0.085), an, J(sx * 0.95 + sp, 0.045 * H, an.p.z + 0.01 * H, 0.056, 0.06), J(sx * 0.95 + sp, 0, an.p.z + 0.012 * H, 0.06)] };
  }
  if (st === 'biped') {
    const hk = J(sx * 0.95 + sp, (S.hockH ?? 0.3) * (L.yR - 0.45 * L.Dr), hz - 0.16 * H, 0.04, 0.05), pw = J(sx * 0.95 + sp, 0.035 * H, hk.p.z + 0.06 * H, 0.032, 0.03);
    return { st, foot: S.foot || 'talon', joints: [hip, J(sx * 1.05 + sp * 0.2, hy * 0.85, hz + 0.16 * H, 0.08, 0.1), hk, pw, J(sx * 0.95 + sp, 0.01 * H, pw.p.z + 0.13 * H * (S.footLen || 1), 0.025, 0.012)] };
  }
  // digitigrade: the stifle hangs below the belly line (not at it) and well forward of the hip, and the
  // hock never trails behind the point of buttock, so feet stand under the quarters, not behind them
  const knD = { ...kn, p: kn.p.clone() };
  if (cr < 0.5) { knD.p.y = Math.min(kn.p.y, lerp(kn.p.y, 0.6 * L.yR, 1 - cr * 2)); knD.p.z = Math.max(kn.p.z, hz + 0.12 * L.yR * (1 - cr)); }
  const hky = (S.hockH ?? 0.27) * H * (1 - 0.35 * cr);
  const hkZd = Math.max(lerp(knD.p.z - (knD.p.y - hky) * (S.tibiaSlope ?? 0.8), L.zB + 0.13 * Lt, cr), L.zB + 0.07 * Lt);
  const hk = J(sx * 0.92 + sp * 0.6, hky, hkZd, 0.036, 0.05);
  const pw = J(sx * 0.9 + sp, 0.045 * H, hk.p.z + 0.04 * H, 0.034, 0.033);
  return { st, foot: 'paw', pre, joints: [hip, knD, hk, pw, J(sx * 0.9 + sp, 0.012 * H, pw.p.z + 0.08 * H * (S.footLen || 1), 0.022, 0.012)] };
}

const LIMB_BONES = { front: ['Scapula', 'Arm', 'Forearm', 'Hand', 'Finger'], hind: ['Thigh', 'Shin', 'Foot', 'Toe'] };
/** Lays out all four limbs (before torso emission so torso skin can follow limb roots). */
function tetraLimbLayout(B, S, L) {
  for (const front of [true, false]) for (const side of [1, -1]) {
    if (front && S.noForelimbs) continue;
    const lay = tetraLimbJoints(S, L, front, side), sfx = side > 0 ? 'L' : 'R';
    const names = (front ? LIMB_BONES.front : LIMB_BONES.hind).map(n => n + sfx);
    const nb = Math.min(names.length, lay.joints.length - 1);
    const bones = names.slice(0, nb);
    const rj = lay.joints[front ? 1 : 0], reach = Math.max(rj.w, rj.d * 0.7) * 2.4;
    L.limbs.push({ front, side, sfx, ...lay, bones, inf: front ? [1, 2, 1] : [0, 1, 0], reach, pull: lay.st === 'sprawl' || lay.st === 'arm' || lay.st === 'frog' ? 0.25 : 0.55 });
  }
}
function tetraLimbBones(B, L) {
  for (const lm of L.limbs) {
    const parent = lm.front ? 'Chest' : 'Hips';
    lm.bones.forEach((n, i) => B.rig.add(n, i === 0 ? parent : lm.bones[i - 1], lm.joints[i].p, lm.joints[i + 1].p));
  }
}
/** Leg sweeps through every joint with muscle bulges, then a swept foot. */
function tetraLimbs(B, S, L) {
  const det = B.det, rig = B.rig;
  for (const lm of L.limbs) {
    const J = lm.joints, n = J.length;
    const foot = lm.foot === 'hand' || lm.foot === 'talon' || lm.foot === 'flipper' ? lm.foot : ((lm.front ? S.foreFoot : S.hindFoot) || S.foot || lm.foot);
    lm.footType = foot;
    const endIdx = foot === 'sole' ? n - 3 : n - 2;
    const off = lm.pre ? 1 : 0;
    const jl = [...(lm.pre ? [lm.pre] : []), ...J.slice(0, endIdx + 1)];
    const pts = jl.map(j => j.p);
    const curve = makePath(pts), kuAll = knotUs(curve, pts.length);
    // hind: ilium root → quarter (biggest mass just below the hip) → gaskin bulge above the hock
    const bulge = lm.front ? [1.05, 1.16, 1.08, 1.0, 1.0] : lm.pre ? [1.06, 1.06, 1.12, 1.0, 1.0, 1.0] : [1.2, 1.12, 1.0, 1.0, 1.0];
    const wk = [], dk = [];
    for (let i = 0; i < pts.length; i++) {
      wk.push([kuAll[i], jl[i].w]); dk.push([kuAll[i], jl[i].d]);
      if (i < pts.length - 1) { const um = (kuAll[i] + kuAll[i + 1]) / 2, b = bulge[i] || 1; wk.push([um, (jl[i].w + jl[i + 1].w) / 2 * b]); dk.push([um, (jl[i].d + jl[i + 1].d) / 2 * b * (S.muscle || 1)]); }
    }
    const pw = prof(wk), pd = prof(dk);
    const ku = kuAll.slice(off);
    const nb = Math.min(lm.bones.length, pts.length - 1 - off);
    const spec = rig.spec(lm.bones.slice(0, nb), [0, ...ku.slice(1, nb)], 0.28);
    const g = loft({ curve, seg: Math.round((10 + 3 * pts.length) * det), rad: 2 * Math.round(5 * det + 2), w: pw, ht: pd, hb: pd, nt: 2.1, nb: 2.1, up: [0, 0, 1],
      cap0: { type: 'round', len: off ? 0.6 : 0.35, n: 3 }, cap1: { type: 'round', len: 0.45, n: 2 }, bend: 0.6 });
    lm.grid = g; lm.us = ku;
    const nm = `leg-${lm.front ? 'front' : 'hind'}-${lm.side > 0 ? 'left' : 'right'}`;
    const legSkin = !lm.front
      ? (u) => { const t = sstep(off ? ku[0] * 0.35 : 0, lerp(ku[0], ku[1], 0.6), u); return t >= 1 ? rig.chain(spec, u) : mixW(rig.W('Hips'), rig.chain(spec, u), lerp(off ? 0 : 0.35, 1, t)); }
      : (u) => rig.chain(spec, u);
    emit(B.part(nm, { group: 'legs' }), g, (u, a, P) => B.paint({ part: 'leg', u, a, P, front: lm.front, side: lm.side }), legSkin);
    tetraFoot(B, S, L, lm, foot, nm);
  }
}

function tetraFoot(B, S, L, lm, foot, nm) {
  const rig = B.rig, det = B.det, J = lm.joints, n = J.length, H = L.H, bl = lm.bones, last = bl[bl.length - 1], prevB = bl[bl.length - 2];
  const W = rig.W(last), part = B.part(`foot-${nm.slice(4)}`, { group: 'feet' });
  const footPaint = (u, a, P) => B.paint({ part: 'foot', u, a, P, front: lm.front, side: lm.side });
  if (foot === 'hoof' || foot === 'cloven') {
    const c = J[n - 2].p, r = J[n - 2].w * 1.05, top = c.y + r * 0.3;
    const halves = foot === 'cloven' ? [-1, 1] : [0];
    for (const hx of halves) {
      const k = foot === 'cloven' ? 0.52 : 1, x = c.x + hx * r * 0.5;
      const g = loft({ pts: [V3(x, top, c.z), V3(x, 0, c.z)], seg: 4, rad: 2 * Math.round(5 * det + 2), up: [0, 0, 1],
        w: (u) => lerp(0.92, 1.2, u) * r * k, ht: (u) => lerp(1.0, 1.6, u) * r, hb: (u) => lerp(0.9, 1.0, u) * r, oy: (u) => lerp(0, 0.45, u) * r,
        nt: foot === 'cloven' ? 1.6 : 2.2, nb: 2.6, cap0: { type: 'round', len: 0.4, n: 2 }, cap1: 'flat', bend: 0, antifold: false });
      emit(part, g, 'hoof', W);
    }
    if (foot === 'cloven' && S.dewclaws !== false) for (const hx of [-1, 1]) {
      const f = J[n - 3].p;
      emit(part, tube([f.clone().add(V3(hx * r * 0.5, -r * 0.2, -r * 0.7)), f.clone().add(V3(hx * r * 0.6, -r * 0.75, -r * 1.05))], (u) => r * 0.26 * (1 - u * 0.6), 3, 5, { cap1: 'point' }), 'hoof', W);
    }
    return;
  }
  if (foot === 'pad') {
    const c = J[n - 2].p, r = Math.max(J[n - 2].w, J[n - 2].d);
    const g = loft({ pts: [c.clone().add(V3(0, r * 0.6, 0)), V3(c.x, 0, c.z + r * 0.05)], seg: 4, rad: 2 * Math.round(7 * det + 2), up: [0, 0, 1],
      w: (u) => lerp(1.0, 1.16, u) * r, ht: (u) => lerp(1.0, 1.2, u) * r, hb: (u) => lerp(1.0, 1.08, u) * r, cap0: { type: 'round', len: 0.4, n: 2 }, cap1: 'flat', bend: 0, antifold: false });
    emit(part, g, footPaint, W);
    const nails = S.nails ?? 4;
    for (let i = 0; i < nails; i++) {
      const t = nails === 1 ? 0 : (i / (nails - 1) - 0.5) * 1.5, P = V3(c.x + Math.sin(t) * r * 1.08, r * 0.2, c.z + 0.05 * r + Math.cos(t) * r * 1.12);
      emit(part, ellipsoid(P, r * 0.22, r * 0.18, r * 0.12, V3(Math.sin(t), 0, Math.cos(t)), [0, 1, 0], 4, 8), 'hoof', W);
    }
    return;
  }
  if (foot === 'paw' || foot === 'sole') {
    const sole = foot === 'sole', hj = sole ? J[n - 3] : J[n - 2];
    const heel = hj.p, toe = J[n - 1].p, r = Math.max(hj.w, 0.018 * H * (S.legThk || 1));
    const fwd = V3(toe.x - heel.x, 0, toe.z - heel.z).normalize();
    const pawW = r * (sole ? 1.12 : 1.1) * (S.pawW || 1), pawH = r * (sole ? 0.75 : 0.95), yMid = pawH * 0.55;
    const back = V3(heel.x, yMid + (sole ? 0 : 0.3 * r), heel.z).addScaledVector(fwd, -(sole ? 0.45 : 0.55) * r);
    const front = V3(toe.x, yMid * 0.9, toe.z);
    const len = back.distanceTo(front);
    front.addScaledVector(fwd, -0.22 * len);
    const g = loft({ pts: [back, front], seg: 6, rad: 2 * Math.round(6 * det + 2), up: [0, 1, 0],
      w: (u) => pawW * lerp(0.8, 1.0, sstep(0, 0.6, u)), ht: (u) => pawH * lerp(0.75, 0.55, u), hb: () => yMid * 0.95, nt: 2.2, nb: 3.4,
      cap0: { type: 'round', len: 0.6, n: 2 }, cap1: { type: 'round', len: 0.55, n: 3 }, bend: 0, antifold: false });
    emit(part, g, footPaint, sole ? (u) => rig.W2(prevB, last, sstep(0.5, 0.85, u)) : (u) => rig.W2(prevB, last, sstep(0, 0.35, u)));
    const toes = S.toes ?? (sole ? 5 : 4), tl = (S.toeLen ?? (sole ? 0.24 : 0.3)) * len;
    const yaw = Math.atan2(fwd.x, fwd.z), lat = V3(Math.cos(yaw), 0, -Math.sin(yaw));
    for (let i = 0; i < toes; i++) {
      const t = toes === 1 ? 0 : i / (toes - 1) - 0.5, spread = t * pawW * 1.5;
      const base = front.clone().addScaledVector(lat, spread).addScaledVector(fwd, -Math.abs(t) * 0.3 * len - 0.05 * len); base.y = yMid * 0.8;
      const tipP = base.clone().addScaledVector(fwd, tl * (1 - Math.abs(t) * 0.45)).addScaledVector(lat, spread * 0.15); tipP.y = yMid * 0.45;
      const tr = pawW * (toes > 4 ? 0.25 : 0.3);
      emit(part, loft({ pts: [base, tipP], seg: 3, rad: 8, w: tr, ht: tr * 0.85, hb: tr * 0.75, cap0: { type: 'round', len: 0.5, n: 2 }, cap1: { type: 'round', len: 0.9, n: 3 }, bend: 0, up: [0, 1, 0], antifold: false }), footPaint, W);
      if (S.claws) {
        const cl = S.claws * tr, cs = tipP.clone().addScaledVector(fwd, tr * 0.55).add(V3(0, tr * 0.15, 0));
        emit(part, tube([cs, cs.clone().addScaledVector(fwd, cl * 0.6).add(V3(0, -cl * 0.08, 0)), cs.clone().addScaledVector(fwd, cl).add(V3(0, -cl * 0.42, 0))], (u) => tr * 0.33 * (1 - u * 0.9), 4, 4, { cap1: 'point' }), 'hoof', W);
      }
    }
    return;
  }
  if (foot === 'flipper') {
    const root = J[n - 3].p, palm = J[n - 2].p, end = J[n - 1].p, ax = end.clone().sub(root), Lf = ax.length() * (S.flipperLen ?? 1.6) * (lm.front ? 1 : (S.hindFlipper ?? 0.6));
    const d = (lm.front ? V3(lm.side, -0.12, -0.42) : V3(lm.side * 0.55, -0.08, -0.85)).normalize(), fwdv = new THREE.Vector3().crossVectors(V3(0, 1, 0), d).multiplyScalar(lm.side).normalize(), chord = Lf * (S.flipperW ?? 0.32);
    sheet(part, { nu: Math.round(8 * det), nv: Math.round(4 * det),
      f: (u, v) => { const cw = chord * Math.sin(Math.PI * clamp(0.15 + u * 0.85, 0, 1)) ** 0.7 * (1 - 0.35 * u); const q = root.clone().addScaledVector(d, u * Lf).addScaledVector(fwdv, (v - 0.62) * cw); q.y = Math.max(q.y, chord * 0.12); return q; },
      th: (u, v) => chord * 0.16 * (1 - 0.75 * u) * (1 - 0.6 * (2 * v - 1) ** 2), zone: (u, v) => footPaint(u, v * TAU, palm), skin: (u) => u < 0.3 ? rig.W(prevB) : W });
    return;
  }
  // hands / talons: digits fan out from the palm (J[n-2]) toward J[n-1]
  const palm = J[n - 2].p, end = J[n - 1].p, d0 = end.clone().sub(palm), dl = d0.length() * ((lm.front ? S.foreDigitLen : null) ?? S.digitLen ?? 1);
  const d = d0.normalize(), r = J[n - 2].w;
  const digits = S.digits ?? (foot === 'talon' ? 3 : 5);
  for (let i = 0; i < digits; i++) {
    const t = digits === 1 ? 0 : i / (digits - 1) - 0.5, fan = t * (S.digitFan ?? 1.3);
    const dir = d.clone().applyAxisAngle(V3(0, 1, 0), fan);
    const len = dl * (1 - Math.abs(t) * 0.4);
    const a = palm.clone().addScaledVector(dir, r * 0.2), e = palm.clone().addScaledVector(dir, len);
    if (palm.y < 0.06 * H) e.y = Math.max(r * 0.25, e.y * 0.5);
    const m = a.clone().lerp(e, 0.5); m.y = Math.max(m.y, Math.min(a.y, e.y) + r * 0.25);
    const thick = r * (S.digitThk ?? 0.42);
    emit(part, tube([a, m, e], (u) => thick * (1 - u * 0.5) * (S.digitPads && u > 0.82 ? 1.5 : 1), 5, 6, { cap1: { type: 'round', len: 0.8, n: 2 } }), footPaint, W);
    if (S.claws) emit(part, tube([e, e.clone().addScaledVector(dir, thick * S.claws * 0.6).add(V3(0, thick * 0.2, 0)), e.clone().addScaledVector(dir, thick * S.claws * 1.2).add(V3(0, -thick * 0.5, 0))], (u) => thick * 0.42 * (1 - u * 0.9), 4, 4, { cap1: 'point' }), 'hoof', W);
  }
  if ((S.webbed === true || (S.webbed === 'hind' && !lm.front)) && digits > 1) {
    const tips = [], bases = [];
    for (let i = 0; i < digits; i++) {
      const t = i / (digits - 1) - 0.5, dir = d.clone().applyAxisAngle(V3(0, 1, 0), t * (S.digitFan ?? 1.3)), len = dl * (1 - Math.abs(t) * 0.4) * 0.92;
      const e = palm.clone().addScaledVector(dir, len); if (palm.y < 0.06 * H) e.y = Math.max(r * 0.25, e.y * 0.5);
      tips.push(e); bases.push(palm.clone().addScaledVector(dir, r * 0.3));
    }
    sheet(part, { nu: 3, nv: (digits - 1) * 3,
      f: (u, v) => { const x = v * (digits - 1), i = Math.min(digits - 2, Math.floor(x)), t = x - i, tip = tips[i].clone().lerp(tips[i + 1], t), b = bases[i].clone().lerp(bases[i + 1], t); const scallop = 1 - 0.28 * Math.sin(Math.PI * t) * u; return b.lerp(tip, u * scallop); },
      th: r * 0.08, zone: 'web', skin: W });
  }
  if (foot === 'talon' && S.hallux !== false) {
    const back = palm.clone().addScaledVector(d, -dl * 0.45); back.y = Math.max(r * 0.2, back.y * 0.4);
    emit(part, tube([palm, back], (u) => r * 0.36 * (1 - u * 0.5), 4, 6), footPaint, W);
  }
}

/** Tail: a tapered sweep rooted inside the rump, with a bone chain for sway. */
function tetraTail(B, S, L) {
  const T = S.tail;
  if (!T || T.style === 'none' || !(T.len > 0)) return;
  const rig = B.rig, det = B.det, H = L.H, len = T.len * H, uR = L.uOf.rump, fr = L.torso.frame(uR);
  const r0 = T.match ? T.match * Math.min(L.torsoW(uR), L.torsoHt(uR)) * (T.thkMul ?? 1) : T.thk * H;
  const root = fr.c.clone().addScaledVector(fr.up, L.torsoHt(uR) * (T.rootUp ?? (T.match ? 0.05 : 0.5))).addScaledVector(fr.t, -0.05 * L.Dr);
  const N = 14, pts = [root.clone().addScaledVector(fr.t, 0.35 * r0 + 0.04 * L.Dr)];
  let elev = (T.set ?? -20) * DEG;
  const dz = len / N;
  for (let i = 1; i <= N; i++) {
    const s = i / N;
    const e = elev + (T.curl ?? 0) * DEG * s + (T.tipCurl ?? 0) * DEG * sstep(0.55, 1, s) * 2.2;
    const prev = pts[i - 1];
    if (T.style === 'curly') {
      const turns = T.turns ?? 1.6, ra = len * 0.12, a = s * TAU * turns;
      pts.push(root.clone().add(V3(Math.sin(a) * ra, ra - Math.cos(a) * ra + s * len * 0.1, -0.15 * len - s * len * 0.12)));
    } else pts.push(prev.clone().add(V3((T.side || 0) * dz * s, Math.sin(e) * dz, -Math.cos(e) * dz)));
  }
  const curve = makePath(pts);
  const style = T.style, bush = T.bush ?? 0.8;
  const R = style === 'bushy' ? (u) => r0 * (0.7 + bush * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.95)), 0.7)) * (1 - 0.35 * u)
    : style === 'tuft' ? (u) => r0 * (1 - 0.7 * u) + r0 * (T.tuft ?? 1.8) * bell(u, 0.93, 0.12)
      : style === 'flat' ? (u) => r0 * (0.5 + 0.5 * Math.sin(Math.PI * clamp(u * 1.1, 0, 1)))
        : style === 'fluffy' ? (u) => r0 * (0.6 + 0.6 * Math.sin(Math.PI * u))
          : (u) => r0 * (1 - 0.82 * Math.pow(u, 0.9));
  const flat = style === 'flat' ? (T.flat ?? 3) : 1 / (T.aspect ?? 1);
  const g = loft({ curve, seg: Math.round(20 * det), rad: 2 * Math.round(5 * det + 2), w: (u) => R(u) * flat, ht: (u) => R(u) / Math.sqrt(flat), hb: (u) => R(u) / Math.sqrt(flat),
    bump: S.tailBump || (style === 'bushy' && det >= 1 ? (u, a) => 0.06 * Math.sin(a * 5 + u * 23) : null),
    cap0: { type: 'round', len: 0.5, n: 2 }, cap1: { type: 'round', len: style === 'thin' ? 0.9 : 0.7, n: 3 }, bend: 0.4 });
  const nb = T.bones ?? (len > 0.6 * H ? 6 : 4), names = [], us = [];
  for (let i = 0; i < nb; i++) { const u = i / nb; names.push('Tail' + (i + 1)); us.push(u); rig.add('Tail' + (i + 1), i ? 'Tail' + i : 'Hips', curve.getPointAt(u), curve.getPointAt(Math.min(1, (i + 1) / nb))); }
  const spec = rig.spec(names, us, 0.4);
  L.tail = { grid: g, curve, bones: names, len, spec };
  emit(B.part('tail', { group: 'tail' }), g, (u, a, P) => style === 'tuft' && u > 0.82 ? 'mane' : B.paint({ part: 'tail', u, a, P }), (u) => u < 0.06 ? rig.W2('Hips', 'Tail1', u / 0.06) : rig.chain(spec, u));
  if (style === 'hair') {
    const hl = (T.hair ?? 1.6) * len, hw = (T.hairW ?? 2.4) * r0, end = curve.getPointAt(1), d1 = curve.getTangentAt(1);
    const hp = [curve.getPointAt(0.05), curve.getPointAt(0.5), end.clone().addScaledVector(d1, hl * 0.08),
      end.clone().add(V3(0, -hl * 0.3, -hl * (T.hairBack ?? 0.2) * 0.8)), end.clone().add(V3(0, -hl * 0.62, -hl * (T.hairBack ?? 0.2))), end.clone().add(V3(0, -hl * 0.92, -hl * (T.hairBack ?? 0.2) * 0.85))];
    const hg = loft({ pts: hp, seg: Math.round(16 * det), rad: 2 * Math.round(5 * det + 2), up: [0, 0, -1],
      w: (u) => hw * 0.55 * (0.35 + 0.75 * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.08))), ht: (u) => hw * (0.4 + 0.9 * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.05))) * 0.55, hb: (u) => hw * (0.4 + 0.9 * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.05))) * 0.55,
      bump: det >= 1 ? (u, a) => 0.12 * Math.sin(a * 5 + u * 11) * u : null, cap0: { type: 'round', len: 0.6 }, cap1: { type: 'point', len: 1.2 }, bend: 0.3 });
    emit(B.part('tail', { group: 'tail' }), hg, 'mane', (u, a, P) => rig.near(P, names, hw * 2));
  }
}

/** Horns, antlers, ossicones and tusks: tapered sweeps rooted on the skull surface. */
function tetraHorns(B, S, L) {
  const Hn = S.horns, rig = B.rig, det = B.det;
  if (!Hn || Hn.style === 'none' || !(Hn.len > 0)) return;
  const g = L.head, hd = L.hd, hu = L.hu, Lh = L.Lh, len = Hn.len * Lh, r0 = (Hn.thk ?? 0.07) * Lh;
  const part = B.part('horns', { group: 'horns' }), HW = rig.W('Head');
  const ridged = (k) => (u, a) => k * 0.07 * Math.max(0, Math.sin(u * (Hn.rings ?? 34) * Math.PI)) * (1 - u);
  const horn = (pts, r, zone = 'horn', bump = null, tipCap = 'point') => {
    const hg = loft({ pts, seg: Math.round(Math.max(6, pts.length * 3) * det), rad: 2 * Math.round(3 * det + 2), w: r, ht: r, hb: r, bump, cap0: { type: 'round', len: 0.3, n: 2 }, cap1: tipCap === 'point' ? { type: 'point', len: 0.8 } : { type: 'round', len: 0.9, n: 3 }, bend: 0.4 });
    emit(part, hg, typeof zone === 'function' ? zone : zone, HW);
    return hg;
  };
  const st = Hn.style;
  if (st === 'rhino' || st === 'unicorn') {
    const list = st === 'unicorn' ? [[0.42, 1, 0.9]] : [[0.9, 1, 1], ...(Hn.count === 1 ? [] : [[0.72, 0.45, 0.8]])];
    for (const [s, k, kr] of list) {
      const { p, n } = g.at(s, Math.PI / 2), base = p.addScaledVector(n, -r0 * kr * 0.4), L1 = len * k;
      const up = st === 'unicorn' ? n.clone().lerp(hd, 0.3).normalize() : n.clone().multiplyScalar(0.35).add(V3(0, 0.65, 0)).normalize(), back = V3(0, 0, -1);
      const pts = st === 'unicorn' ? [base, base.clone().addScaledVector(up, L1 * 0.5).addScaledVector(hd, L1 * 0.25), base.clone().addScaledVector(up, L1 * 0.8).addScaledVector(hd, L1 * 0.55)]
        : [base, base.clone().addScaledVector(up, L1 * 0.55).addScaledVector(back, L1 * 0.05), base.clone().addScaledVector(up, L1).addScaledVector(back, L1 * (Hn.curl ?? 0.3))];
      horn(pts, (u) => r0 * kr * (1.2 - u) * (st === 'rhino' ? 1.6 : 1), 'horn', st === 'unicorn' ? (u, a) => 0.12 * Math.sin(a * 2 - u * 30) : null);
    }
    return;
  }
  for (const side of [1, -1]) {
    const a = Math.PI / 2 - side * (Hn.a ?? 0.55);
    const { p, n } = g.at(Hn.s ?? 0.24, a);
    const base = p.clone().addScaledVector(n, -r0 * 0.5);
    const out = V3(side, 0, 0), up = hu.clone(), back = hd.clone().multiplyScalar(-1), fwd = hd.clone();
    const P = (o, u, b, f = 0) => base.clone().addScaledVector(out, o * len).addScaledVector(up, u * len).addScaledVector(back, b * len).addScaledVector(fwd, f * len);
    const taper = (k = 1) => (u) => r0 * k * Math.max(0.04, 1 - Math.pow(u, 1.15));
    if (st === 'cattle') horn([P(0, 0, 0), P(0.4, 0.04, 0.02), P(0.74, 0.26, -0.04), P(0.84, 0.6, -0.1)], taper());
    else if (st === 'buffalo') {
      horn([P(-0.12, 0.05, 0.05), P(0.3, 0.02, 0.06), P(0.66, -0.14, 0.1), P(0.86, 0.14, 0.04), P(0.8, 0.42, -0.05)], (u) => r0 * (1.7 * (1 - sstep(0, 0.35, u)) + 1) * Math.max(0.05, 1 - u));
    } else if (st === 'ram') {
      const turns = Hn.curl ?? 1.7, R0 = len * 0.36, pts = [];
      // Digital Diorama revision: curl in world axes (back over the crown, down behind the ear, forward past the
      // cheek); in head axes a down-pitched head turned the spiral into loops on top of the skull
      const upT = V3(0, 1, 0).applyAxisAngle(V3(0, 0, 1), -side * 0.32), bk = V3(0, 0, -1);
      for (let i = 0; i <= 18; i++) {
        const th = (i / 18) * turns * Math.PI, R = R0 * Math.exp(-0.17 * th);
        pts.push(base.clone().addScaledVector(upT, -R0 + R * Math.cos(th) + R0 * 0.0).addScaledVector(bk, R * Math.sin(th)).addScaledVector(out, (0.12 + 0.28 * i / 18) * len));
      }
      horn(pts, (u) => r0 * 1.45 * Math.max(0.12, 1 - 0.82 * u), 'horn', ridged(1.4));
    } else if (st === 'goat') horn([P(0.02, 0, 0), P(0.06, 0.45, 0.12), P(0.12, 0.75, 0.45), P(0.16, 0.82, 0.85)], taper(1.1), 'horn', ridged(1.2));
    else if (st === 'antelope') horn([P(0, 0, 0), P(0.06, 0.5, 0.32), P(0.1, 0.95, 0.62)], taper(0.85), 'horn', ridged(1));
    else if (st === 'lyre') horn([P(0, 0, 0), P(0.18, 0.35, 0.12), P(0.22, 0.65, 0.3), P(0.1, 0.92, 0.2)], taper(0.8), 'horn', ridged(1));
    else if (st === 'spiral') {
      const pts = [], ax = up.clone().multiplyScalar(0.75).add(back.clone().multiplyScalar(0.45)).add(out.clone().multiplyScalar(0.45)).normalize();
      const e1 = basisFrom(ax, out).u, e2 = new THREE.Vector3().crossVectors(ax, e1);
      for (let i = 0; i <= 20; i++) { const t = i / 20, a2 = t * TAU * (Hn.curl ?? 2.2) * side; pts.push(base.clone().addScaledVector(ax, t * len).addScaledVector(e1, (Math.cos(a2) - 1) * len * 0.09 * (1 - 0.4 * t)).addScaledVector(e2, Math.sin(a2) * len * 0.09 * (1 - 0.4 * t))); }
      horn(pts, taper(0.9));
    } else if (st === 'ossicones') {
      const og = horn([P(0, 0, 0), P(0.04, 0.6, 0.12), P(0.05, 0.95, 0.15)], (u) => r0 * (1 - 0.25 * u) + r0 * 0.35 * bell(u, 1, 0.3), (u, a2, Pp) => u > 0.8 ? 'mane' : B.paint({ part: 'head', u: 0.2, a: Math.PI / 2, P: Pp }), null, 'round');
    } else if (st === 'whitetail') {
      // Digital Diorama revision: a white-tailed deer's main beam curves out and back, then sweeps forward
      // over the brow, with a short brow tine and tall tines rising straight up from the beam
      const W = (o, y, z) => base.clone().addScaledVector(out, o * len).add(V3(0, y * len, z * len));
      const beam = [W(0, 0, 0), W(0.16, 0.2, -0.12), W(0.36, 0.38, -0.12), W(0.46, 0.5, 0.06), W(0.4, 0.56, 0.3), W(0.22, 0.57, 0.48)];
      horn(beam, (u) => r0 * (1 - 0.55 * u), 'horn', null, 'round');
      const bc = makePath(beam), n = Hn.tines ?? 4;
      for (let i = 0; i < n; i++) {
        const u = i === 0 ? 0.1 : 0.36 + (i - 1) * (0.5 / Math.max(1, n - 1)), b0 = bc.getPointAt(u);
        const tl = len * (i === 0 ? 0.2 : 0.46 - (i - 1) * 0.08), dir = V3(side * 0.06, 1, i === 0 ? 0.3 : 0.12).normalize();
        horn([b0, b0.clone().addScaledVector(dir, tl * 0.55).add(V3(0, 0, tl * 0.04)), b0.clone().addScaledVector(dir, tl)], (uu) => r0 * 0.55 * (1 - 0.88 * uu));
      }
    } else if (st === 'antlers' || st === 'palmate') {
      const beam = st === 'palmate' ? [P(0, 0, 0), P(0.35, 0.12, 0.06), P(0.55, 0.22, 0.1)] : [P(0, 0, 0), P(0.16, 0.3, 0.2), P(0.3, 0.62, 0.22), P(0.34, 0.88, 0.06), P(0.3, 1.02, -0.12)];
      const bg = horn(beam, (u) => r0 * (1 - 0.6 * u), 'horn', null, 'round');
      const bc = makePath(beam);
      if (st === 'antlers') {
        const tines = Hn.tines ?? 3;
        for (let i = 0; i < tines; i++) {
          const u = 0.12 + (i / Math.max(1, tines)) * 0.75, b0 = bc.getPointAt(u), tl = len * (i === 0 ? 0.3 : 0.38 - i * 0.03);
          const dir = (i === 0 ? fwd.clone().multiplyScalar(0.9).add(up.clone().multiplyScalar(0.45)) : up.clone().multiplyScalar(0.9).add(fwd.clone().multiplyScalar(0.35)).add(out.clone().multiplyScalar(0.12))).normalize();
          horn([b0, b0.clone().addScaledVector(dir, tl * 0.55).addScaledVector(up, tl * 0.08), b0.clone().addScaledVector(dir, tl)], (uu) => r0 * 0.62 * (1 - 0.9 * uu));
        }
      } else {
        const e0 = bc.getPointAt(0.55), pal = len * 0.75;
        sheet(part, { nu: Math.round(6 * det), nv: Math.round(4 * det),
          f: (u, v) => { const span = (v - 0.35) * 1.4; return e0.clone().addScaledVector(out, u * pal * 0.85 + Math.abs(span) * pal * 0.1).addScaledVector(up, u * pal * 0.25 + span * pal * 0.42 * Math.sin(Math.PI * (0.25 + 0.75 * u))).addScaledVector(back, span * pal * 0.35); },
          th: (u) => r0 * 0.7 * (1 - 0.5 * u), zone: 'horn', skin: HW });
        for (let i = 0; i < 6; i++) {
          const t = i / 5, b0 = e0.clone().addScaledVector(out, pal * (0.6 + 0.3 * Math.sin(t * Math.PI))).addScaledVector(up, pal * (0.35 * (t - 0.4) + 0.3)).addScaledVector(back, pal * (t - 0.3) * 0.5);
          horn([b0, b0.clone().addScaledVector(out, len * 0.08).addScaledVector(up, len * 0.12)], (uu) => r0 * 0.45 * (1 - uu));
        }
      }
    }
  }
}

function tetraTusks(B, S, L) {
  const T = S.tusks;
  if (!T || T.style === 'none' || !(T.len > 0)) return;
  const g = L.head, hd = L.hd, hu = L.hu, len = T.len * L.H, r0 = (T.thk ?? 0.12) * len, part = B.part('tusks', { group: 'horns' });
  for (const side of [1, -1]) {
    const { p, n } = g.at(T.s ?? 0.82, 1.5 * Math.PI + side * (T.a ?? 0.9));
    const base = p.clone().addScaledVector(n, -r0 * 0.8), out = V3(side * (T.spread ?? 0.25), 0, 0);
    const pts = T.style === 'boar'
      ? [base, base.clone().addScaledVector(n, len * 0.3).addScaledVector(hd, len * 0.1), base.clone().addScaledVector(hu, len * 0.55).addScaledVector(hd, len * 0.2).add(out.clone().multiplyScalar(len)), base.clone().addScaledVector(hu, len * 0.8).addScaledVector(hd, -len * 0.05).add(out.clone().multiplyScalar(len * 1.2))]
      : [base, base.clone().addScaledVector(hu, -len * 0.3).addScaledVector(hd, len * 0.2).add(out.clone().multiplyScalar(len * 0.6)), base.clone().addScaledVector(hu, -len * 0.45).addScaledVector(hd, len * 0.62).add(out.clone().multiplyScalar(len)), base.clone().addScaledVector(hu, -len * (0.3 - (T.curl ?? 0.35))).addScaledVector(hd, len * 0.92).add(out.clone().multiplyScalar(len * 0.9))];
    const tg = loft({ pts, seg: Math.round(10 * B.det), rad: 8, w: (u) => r0 * (1 - 0.75 * u), ht: (u) => r0 * (1 - 0.75 * u), hb: (u) => r0 * (1 - 0.75 * u), cap0: 'flat', cap1: { type: 'round', len: 1, n: 2 }, bend: 0.3 });
    emit(part, tg, 'teeth', B.rig.W(T.style === 'boar' ? 'Jaw' : 'Head'));
  }
}

/** Elephant trunk (or tapir proboscis): ridged sweep with its own bone chain. */
function tetraTrunk(B, S, L) {
  const T = S.trunk;
  if (!T || !(T.len > 0)) return;
  const rig = B.rig, g = L.head, hd = L.hd, hu = L.hu, len = T.len * L.H, r0 = (T.thk ?? 0.2) * L.Lh;
  const fr = g.frame(0.97), base = fr.c.clone().addScaledVector(hu, -0.15 * L.ch).addScaledVector(hd, -0.12 * L.Lh);
  const pts = [base];
  const down = V3(0, -1, 0.08).normalize();
  for (let i = 1; i <= 10; i++) {
    const s = i / 10, d = hd.clone().lerp(down, sstep(0, 0.35, s)).normalize();
    if (s > 0.75) d.lerp(hd, (s - 0.75) * (T.curl ?? 1.4)).normalize();
    const q = pts[i - 1].clone().addScaledVector(d, len / 10); q.y = Math.max(q.y, 0.06 * L.H + r0 * 0.5); pts.push(q);
  }
  const curve = makePath(pts), nb = 5, names = [], us = [];
  for (let i = 0; i < nb; i++) { names.push('Trunk' + (i + 1)); us.push(i / nb); rig.add('Trunk' + (i + 1), i ? 'Trunk' + i : 'Head', curve.getPointAt(i / nb), curve.getPointAt((i + 1) / nb)); }
  const spec = rig.spec(names, us, 0.4);
  const tg = loft({ curve, seg: Math.round(26 * B.det), rad: 2 * Math.round(5 * B.det + 3), w: (u) => r0 * (1 - 0.62 * u), ht: (u) => r0 * (1 - 0.62 * u), hb: (u) => r0 * (1 - 0.62 * u) * 0.92,
    bump: (u, a) => (T.ridges ?? 1) * 0.07 * Math.max(0, Math.sin(u * 70)) * (Math.sin(a) > -0.2 ? 1 : 0.3), cap0: { type: 'round', len: 0.5 }, cap1: { type: 'round', len: 0.45, n: 3 }, bend: 0.4 });
  emit(B.part('trunk', { group: 'head' }), tg, (u, a, P) => u > 0.97 ? 'nose' : B.paint({ part: 'trunk', u, a, P }), (u) => u < 0.08 ? rig.W2('Head', 'Trunk1', u / 0.08) : rig.chain(spec, u));
}


/** Manes: horse/zebra crests as hair sheets along the neck crest; lion ruff as a shaggy collar loft; beards. */
function tetraMane(B, S, L) {
  const M = S.mane;
  if (!M || M.style === 'none') return;
  const rig = B.rig, det = B.det, U = L.uOf, part = B.part('mane', { group: 'mane' });
  if (M.style === 'horse' || M.style === 'crest') {
    const u0 = lerp(U.chest, U.neckRoot, 0.45), u1 = lerp(U.neck2, U.neckTop, 0.85);
    const hgt = (M.h ?? 0.12) * L.H, fall = M.style === 'horse' ? (M.fall ?? 1.05) : 0.05;
    sheet(part, { nu: Math.round(16 * det), nv: 3,
      f: (u, v) => {
        const uu = lerp(u1, u0, u), { p, n } = L.torso.at(uu, Math.PI / 2), fr = L.torso.frame(uu);
        const dir = n.clone().applyAxisAngle(fr.t, fall * v).normalize();
        const lock = M.style === 'horse' ? 1 + 0.25 * Math.sin(u * 37) * v : 1, env = Math.pow(Math.sin(Math.PI * clamp(u * 1.08, 0, 1)), 0.45);
        return p.addScaledVector(n, -0.2 * hgt).addScaledVector(dir, (0.15 + v * env) * hgt * lock);
      },
      th: (u, v) => hgt * 0.22 * (1 - 0.7 * v), skin: (u) => rig.chain(L.axial, lerp(u1, u0, u)),
      // a striped coat carries its stripes up into the mane (zebras); other manes are one colour
      zone: S.pattern === 'stripes' ? (u, v, face, P) => (P && v < 0.86 ? B.paint({ part: 'mane', u, a: 0, P }) : 'mane') : 'mane' });
    if (M.forelock !== false && M.style === 'horse') {
      const { p, n } = L.head.at(0.12, Math.PI / 2);
      sheet(part, { nu: 4, nv: 2, f: (u, v) => p.clone().addScaledVector(n, hgt * 0.1 * (1 - u)).addScaledVector(L.hd, u * hgt * 1.3).addScaledVector(V3(1, 0, 0), (v - 0.5) * hgt * 0.5 * (1 - u * 0.6)),
        th: (u) => hgt * 0.15 * (1 - 0.7 * u), zone: 'mane', skin: rig.W('Head') });
    }
  } else if (M.style === 'lion') {
    // Ruff: frames the face from just behind the eyes, swells over the neck and wraps the shoulders.
    const hfr0 = L.head.frame(0.08), sz = (M.size ?? 0.74);
    const pts = [hfr0.c.clone().addScaledVector(L.hd, -0.02 * L.Lh), L.poll.clone().addScaledVector(L.nd, -0.15 * L.Ln), L.torso.frame(lerp(L.uOf.neck1, L.uOf.neckRoot, 0.5)).c, L.torso.frame(lerp(L.uOf.neckRoot, L.uOf.chest, 0.35)).c];
    const R0 = Math.max(L.cw * 1.9, L.ch * 2.0, L.nT * 1.6) * sz;
    const mg = loft({ pts, seg: Math.round(14 * det), rad: 2 * Math.round(8 * det + 3), up: L.hu,
      w: (u) => R0 * lerp(0.92, 1.0, Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.1))), ht: (u) => R0 * lerp(0.88, 0.98, u), hb: (u) => R0 * lerp(0.95, 1.3, u), oy: () => -R0 * 0.12,
      bump: (u, a) => 0.22 * (fbm(Math.cos(a) * 3 + u * 5, Math.sin(a) * 3, u * 4, 11) - 0.45) + 0.08 * Math.sin(a * 9 + u * 7),
      cap0: { type: 'round', len: 0.35, n: 3 }, cap1: { type: 'round', len: 0.55, n: 3 }, bend: 0.5 });
    // Digital Diorama revision: streaks of hair, a tawny fringe round the face darkening toward the shoulders
    const dark = M.dark ?? 0.65;
    const maneZone = (u, a) => {
      const st = fbm(Math.cos(a) * 5.5 + 3, Math.sin(a) * 5.5, u * 1.3, 23) + 0.12 * (fbm(Math.cos(a) * 18, Math.sin(a) * 18, u * 4, 31) - 0.5);
      if (st < lerp(0.62, 0.3, sstep(0.0, 0.42, u))) return 'body';
      return st > lerp(0.78, 0.52, sstep(0.3, 1, u) * dark) ? 'marking' : 'mane';
    };
    emit(part, mg, maneZone, (u, a, P) => rig.near(P, ['Head', 'Neck2', 'Neck1', 'Chest'], R0 * 1.2));
  }
  if (M.beard) {
    // chin beard (goat, bison): a tapered lock hanging from under the jaw
    const j = L.jaw.at(0.72, -Math.PI / 2), bl = M.beard * L.Lh, bw = bl * 0.22;
    const pts = [j.p.clone().addScaledVector(j.n, -bw * 0.6), j.p.clone().add(V3(0, -bl * 0.45, -bl * 0.08)), j.p.clone().add(V3(0, -bl, -bl * 0.18))];
    emit(part, tube(pts, (u) => bw * (1 - 0.75 * u), 6, 8, { cap1: 'point', bump: (u, a) => 0.15 * Math.sin(a * 5 + u * 9) }), 'mane', rig.W('Jaw'));
  }
}

/** Udder with four teats under the rear belly (dairy cattle). Digital Diorama revision. */
function tetraUdder(B, S, L) {
  if (!(S.udder > 0)) return;
  const u = lerp(L.uOf.haunch, L.uOf.loin, 0.3), bot = L.torso.at(u, -Math.PI / 2).p, r = S.udder * L.H;
  const c = bot.clone().add(V3(0, -r * 0.35, 0)), part = B.part('udder', { group: 'body' }), W = B.rig.W('Hips');
  emit(part, ellipsoid(c, r * 0.95, r * 0.72, r * 1.15, [0, 0, 1], [0, 1, 0], Math.round(6 * B.det + 2), 2 * Math.round(5 * B.det + 2)), 'skin', W);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const t = c.clone().add(V3(sx * r * 0.42, -r * 0.5, sz * r * 0.5));
    emit(part, tube([t, t.clone().add(V3(0, -r * 0.45, 0))], r * 0.11, 3, 6, { cap1: { type: 'round', len: 0.6, n: 2 } }), 'skin', W);
  }
}

/** Quills / spines (hedgehog, porcupine): cones scattered over the dorsal half of the torso loft and crown. */
function tetraQuills(B, S, L) {
  const Q = S.quills;
  if (!Q) return;
  const rig = B.rig, part = B.part('spines', { group: 'spines' }), U = L.uOf, rnd = mulberry(S.seed ?? 3);
  const len = (Q.len ?? 0.32) * L.D, r = len * (Q.r ?? 0.09), n = Math.round((Q.count ?? 260) * B.det);
  for (let i = 0; i < n; i++) {
    const u = lerp(0.04, U.neckRoot + 0.04, Math.sqrt(rnd())), a = lerp(-0.25, Math.PI + 0.25, rnd());
    const { p, n: nn, t } = L.torso.at(u, a);
    const dir = nn.clone().addScaledVector(t, -(Q.lay ?? 0.85)).normalize();
    spike(part, p.clone().addScaledVector(nn, -len * 0.15), dir, len * lerp(0.7, 1.15, rnd()), r, rnd() > 0.55 ? 'marking' : 'pattern', rig.chain(L.axial, u), 4);
  }
}

/* ════════════════════════════════════════════════════════════════════════════
 *  COAT PAINTER — maps (part, u, a, P) to a zone key. Patterns are evaluated in
 *  rest space scaled by body height, so stripes / spots scale with the animal.
 * ════════════════════════════════════════════════════════════════════════════ */
function makePainter(S, L) {
  const pat = S.pattern || 'none', seed = (S.seed ?? 7) | 0, H = L.H;
  const cs = clamp(S.countershade ?? 0.4, 0, 1);
  const k = 1 / (H * (S.patternScale ?? 1));
  const bellyLine = lerp(-1.1, -0.1, cs);
  const legPts = (S.points ?? 0) * L.elbowY, socks = (S.socks ?? 0) * L.elbowY;
  const U = L.uOf, eyeR = S.eye * L.Lh;
  const eyeNear = (P, f) => !!L.eyes && L.eyes.some(e => P.distanceTo(e.c) < f * eyeR);
  return (q) => {
    const { part, P } = q, u = q.u ?? 0, a = q.a ?? 0, sa = Math.sin(a), ca = Math.cos(a);
    const x = P.x * k, y = P.y * k, z = P.z * k;
    if (part === 'lid') return 'lid';
    const torso = part === 'torso' || part === 'neck';
    const head = part === 'head' || part === 'jaw';
    const limb = part === 'leg' || part === 'foot';
    const s0 = q.s0 ?? 0.6;
    let zone = 'body';
    if (torso && sa < bellyLine) zone = 'belly';
    if (part === 'jaw' && cs >= 0.3 && sa < 0.25) zone = 'belly';
    if (head && S.cheeks && part === 'head' && sa < -0.05 && Math.abs(ca) > 0.35 && u > 0.18 && u < s0 + 0.2) zone = 'belly';
    if (head && S.muzzle && u > s0 + 0.45 * (1 - s0) * 0 + (S.muzzleS ?? 0.62) * (1 - s0) && (!S.muzzleLow || sa < 0.05)) zone = S.muzzle === 'dark' ? 'marking' : 'belly';
    if (head && S.faceZone) zone = S.faceZone;
    if (part === 'ear') {
      if (S.earZone) zone = S.earZone;
      if (S.earTip && u > 1 - S.earTip) zone = 'marking';
    }
    if (limb) {
      if (S.legZone && P.y < L.elbowY * 1.02) zone = S.legZone; // lower legs only: the quarter mass stays coat-coloured
      if (P.y < socks) zone = 'belly';
      if (P.y < legPts) zone = 'marking';
    }
    if (part === 'tail' && S.tailTip && u > 1 - S.tailTip) return S.tailTipZone || 'marking';
    if (part === 'tail' && S.tailUnder && sa < -0.3) zone = 'belly';
    if (torso && S.dorsal && sa > 0.975 && u < U.neckRoot + 0.05) zone = 'marking';
    if (torso && S.saddle && sa > lerp(0.9, 0.35, S.saddle) && u > U.haunch * 0.7 && u < U.neckRoot) zone = 'marking';
    if (torso && S.rumpPatch && u < U.haunch + 0.05 && sa > -0.7 && Math.abs(ca) < 0.7) zone = 'belly';
    if (torso && S.frontMane && u > lerp(U.barrel, U.chest, S.frontMane) && sa < (S.maneTop ?? 2)) zone = 'mane';
    if (head && S.frontMane && S.maneHead !== false && part === 'head' && u < s0 + 0.1) zone = 'mane';
    // dense spines painted between the modelled quills: dark bands and cream tips streaked along the body
    // (the hind quarters are part of the leg lofts, so the upper legs carry spines too)
    if (S.spinyBack && ((torso && sa > -0.15 && u < U.neckRoot + 0.06) || (part === 'head' && u < 0.35 && sa > -0.15) || (limb && P.y > L.elbowY + 0.4 * L.D))) return vnoise(x * 44, y * 44, z * 14, seed + 5) > 0.52 ? 'marking' : 'pattern';
    if (torso && S.flankStripe && Math.abs(sa + 0.38) < 0.11 && u > U.haunch && u < U.chest) zone = 'marking';
    // ── patterns
    switch (pat) {
      case 'stripes': { // plains zebra (Digital Diorama revision: stripe spacing, rump arcs, leg rings, belly line)
        // Black and white bands of about equal width, ~10 cm apart on the barrel. Upright on the barrel,
        // square to the neck on the neck, sweeping into broad arcs round the thigh on the rump, rings on the
        // legs (finer toward the hooves); a dark line runs along the belly; the muzzle is dark.
        const f = S.stripeFreq ?? 12, warp = fbm(x * 1.6, y * 1.6, z * 1.6, seed) - 0.5;
        let ph;
        if (torso) {
          if (sa < -0.93 && u > U.haunch && u < U.chest + 0.04) return 'pattern';
          if (u > U.neckRoot - 0.02) ph = (P.x * L.nd.x + P.y * L.nd.y + P.z * L.nd.z) * k * f * 0.8 + warp * 0.7;
          else {
            const zr = (P.z - (L.zB + 0.12 * L.Lt)) * k, yr = (P.y - (L.yR - 0.75 * L.Dr)) * k;
            const arc = Math.hypot(zr * 1.05, yr) * f * 0.72, bar = z * f;
            ph = lerp(arc, bar, sstep(U.haunch - 0.02, U.loin + 0.06, u)) + warp * 0.9;
            if (sa < bellyLine && sa > -0.93) return Math.sin(TAU * ph) > 0.55 ? 'pattern' : 'body';
          }
        } else if (limb) {
          if (P.y < 0.07 * L.elbowY) return 'pattern';
          const t = clamp(P.y / L.elbowY, 0, 1.4);
          ph = y * f * lerp(2.1, 1.25, Math.min(1, t)) + warp * 0.35;
        } else if (head) {
          if (u > s0 + 0.5 * (1 - s0)) return 'marking';
          ph = u * 16 + (part === 'jaw' ? 0.35 : 0) + Math.abs(ca) * 1.2 + warp * 0.4;
        } else if (part === 'tail') { if (u > 0.8) return 'mane'; ph = u * 8; }
        else if (part === 'ear') return u > 0.72 ? 'pattern' : zone;
        else if (part === 'mane') ph = (P.x * L.nd.x + P.y * L.nd.y + P.z * L.nd.z) * k * f * 0.8 + warp * 0.7;
        if (ph === undefined) return zone;
        return Math.sin(TAU * ph) > (S.stripeGap ?? -0.04) ? 'pattern' : zone === 'belly' ? 'body' : zone;
      }
      case 'tiger': { // Digital Diorama revision: narrow, tapering, broken stripes; white cheeks and brows
        // Tigers carry 100+ narrow dark stripes: thick along the spine, tapering to points down the flank,
        // often forked or broken. White belly, inner legs, cheeks and a spot over each eye; ringed tail, black tip.
        if (zone === 'marking') return zone;
        const f = S.stripeFreq ?? 9.5;
        const n1 = fbm(x * 2.3, y * 2.3, z * 2.3, seed) - 0.5, n2 = fbm(x * 7, y * 7, z * 7, seed + 3);
        if (torso) {
          if (sa < -0.62) return zone;
          const along = u > U.neckRoot - 0.02 ? (P.x * L.nd.x + P.y * L.nd.y + P.z * L.nd.z) * k : z;
          // stripes waver down the flank, vary in spacing, split into pairs and break into pieces
          const n3 = fbm(x * 3.5 + 7, y * 3.5, z * 3.5, seed + 11);
          const ph = along * f * (0.85 + 0.3 * n3) + n1 * 2.3 + 0.3 * Math.sin(TAU * (y * 1.2 + n1)) - sa * 0.2;
          const w = lerp(0.06, 0.3, sstep(-0.6, 0.95, sa)) * (0.45 + 1.1 * n2);
          const c = 0.5 + 0.5 * Math.cos(TAU * ph);
          const split = n3 > 0.55 && c > 1 - w * 0.35;
          if (c > 1 - w && !split && n2 > 0.27 && n3 > 0.2) return 'pattern';
          return zone;
        }
        if (limb) {
          if (P.y < 0.3 * L.elbowY) return zone;
          if (sa < -0.2 && Math.abs(ca) < 0.6) return 'belly';
          const ph = y * f * 1.25 + n1 * 1.2 + x * 0.6;
          return 0.5 + 0.5 * Math.cos(TAU * ph) > 1 - 0.22 * (0.6 + n2) && n2 > 0.32 ? 'pattern' : zone;
        }
        if (part === 'head') {
          if (eyeNear(P, 2.2) && sa > 0.1) return 'belly';
          if (u > s0 - 0.05 && sa < 0.25) return 'belly';
          if (u < s0 && Math.abs(ca) > 0.4 && sa > -0.5 && Math.cos(TAU * (u * 10 + n1)) > 0.55) return 'pattern';
          if (u < s0 * 0.7 && sa > 0.55 && Math.cos(TAU * (Math.abs(ca) * 4 + n1)) > 0.5) return 'pattern';
          return zone;
        }
        if (part === 'tail') return u > 0.9 || Math.cos(TAU * u * 7) > 0.35 ? 'pattern' : zone;
        if (part === 'ear') return sa > 0 && u > 0.35 ? 'pattern' : zone;
        return zone;
      }
      case 'spots': case 'hyena': { // Digital Diorama revision: dense small solid spots (cheetah) / blotches (hyena)
        if (zone === 'marking' || (zone === 'belly' && sa < -0.75)) return zone;
        const hy = pat === 'hyena';
        const f = (S.spotFreq ?? (hy ? 10 : 19)) * (head ? 1.7 : 1), th = S.spotSize ?? (hy ? 0.3 : 0.29);
        if (torso || limb || part === 'tail' || (head && u < s0 + 0.1)) {
          if (part === 'tail' && !hy && u > 0.62) return u > 0.93 ? 'belly' : Math.cos(TAU * u * 10) > 0.25 ? 'pattern' : zone;
          if (limb && P.y < (hy ? 0.12 : 0.2) * L.elbowY) return zone;
          const sc = limb ? lerp(1.45, 1, clamp(P.y / L.elbowY, 0, 1)) : 1;
          const wx = hy ? (fbm(x * 4, y * 4, z * 4, seed + 9) - 0.5) * 0.5 : 0;
          const [f1] = worley((x + wx) * f * sc, y * f * sc, (z - wx) * f * sc, seed);
          if (f1 < th * (hy && torso && u > U.neckRoot ? 0.8 : 1)) return 'pattern';
        }
        if (head && S.tearMark && part === 'head' && Math.abs(ca) > 0.55 && Math.abs(ca) < 0.85 && u > L.headS.sEye && u < s0 + 0.35 * (1 - s0) && sa < 0.2) return 'marking';
        return zone;
      }
      case 'rosettes': { // Digital Diorama revision: small rosettes (broken rings round a darker centre)
        // Body: rosettes ~6 cm across; head, legs, belly and tail base: solid spots; the tail ends in rings.
        if (zone === 'belly' && sa < -0.82) return zone;
        const f = S.spotFreq ?? 11.5, n = fbm(x * 9, y * 9, z * 9, seed + 1);
        if (torso && sa > -0.55) {
          const [f1] = worley(x * f, y * f, z * f, seed);
          if (f1 > 0.22 && f1 < 0.36 && n > 0.36) return 'pattern';
          if (f1 < 0.2) return 'marking';
          return zone;
        }
        if (part === 'tail' && u > 0.7) return Math.cos(TAU * u * 9) > 0.3 || u > 0.95 ? 'pattern' : zone;
        if (torso || limb || (head && u < s0 + 0.1) || part === 'tail') {
          if (limb && P.y < 0.12 * L.elbowY) return zone;
          const g = f * (head ? 2.4 : 1.6), [g1] = worley(x * g, y * g, z * g, seed + 2);
          if (g1 < 0.27) return 'pattern';
        }
        return zone;
      }
      case 'giraffe': { // Digital Diorama revision: fine reticulated network of pale lines between polygonal patches
        if (limb && P.y < 0.5 * L.elbowY) return 'belly';
        if (head && u > s0 + 0.1 * (1 - s0)) return 'belly';
        if (torso || limb || head) {
          const neck = torso && u > U.neckRoot;
          const f = (head ? 24 : neck ? 15 : 11) * (S.patchFreq ?? 1) * (limb ? 1.25 : 1);
          const w = (fbm(x * 2.5, y * 2.5, z * 2.5, seed + 5) - 0.5) * 0.4;
          const [f1, f2] = worley(x * f + w, y * f * (neck ? 0.75 : 1), z * f - w, seed);
          return f2 - f1 < (S.netWidth ?? 0.16) * (limb ? 1.3 : 1) ? 'belly' : 'pattern';
        }
        return zone;
      }
      case 'patches': { // Digital Diorama revision: Holstein — large ragged black patches, white legs, belly and blaze
        if (limb && P.y < 0.55 * L.elbowY) return 'body';
        if (torso && sa < -0.7) return 'body';
        if (part === 'tail') return u > 0.6 ? 'body' : zone;
        if (head && part === 'head') return u > s0 * 0.55 && Math.abs(ca) < 0.28 && sa > -0.2 ? 'body' : u > s0 + 0.35 * (1 - s0) ? zone : 'pattern';
        const w = (fbm(x * 3.5, y * 3.5, z * 3.5, seed + 4) - 0.5) * 0.55;
        if (fbm(x * 1.5 + w, y * 1.5, z * 1.5 - w, seed, 4) > 0.5) return 'pattern';
        return zone;
      }
      case 'chipmunk': { // Digital Diorama revision: five dark back stripes with pale bands, a dark eye stripe framed in pale
        if (torso && u > U.haunch - 0.02 && u < U.chest + 0.02) {
          const th = Math.abs(Math.atan2(ca, sa)), fade = sstep(U.haunch - 0.02, U.haunch + 0.06, u) * (1 - sstep(U.chest - 0.06, U.chest + 0.02, u));
          if (fade > 0.3) {
            if (th < 0.09) return 'marking';
            if (th > 0.42 && th < 0.52) return 'marking';
            if (th > 0.52 && th < 0.66) return 'belly';
            if (th > 0.66 && th < 0.76) return 'marking';
          }
          return zone;
        }
        if (part === 'head' && L.eyes && Math.abs(ca) > 0.35 && u < s0 + 0.25) {
          const e = L.eyes.reduce((m, ee) => (P.distanceTo(ee.c) < P.distanceTo(m.c) ? ee : m));
          const dy = (P.y - e.c.y) / eyeR;
          if (Math.abs(dy) < 0.42 && u < s0 + 0.1) return 'marking';
          if (Math.abs(dy) > 0.6 && Math.abs(dy) < 1.15) return 'belly';
        }
        return zone;
      }
      case 'panda': {
        if (limb) return 'pattern';
        if (part === 'ear') return 'pattern';
        if (torso) {
          // the black saddle runs over the shoulders and joins the forelegs
          const fz = (P.z - (L.zF - 0.3 * L.Lt)) / (0.25 * L.Lt);
          if (Math.abs(fz) < 0.55 - Math.max(0, sa) * 0.12 && u < U.neckRoot + 0.06) return 'pattern';
        }
        // eye patches: drooping teardrops, larger than the eye
        if (head && part === 'head' && L.eyes && L.eyes.some(e => { const dx = P.x - e.c.x, dy = P.y - e.c.y + eyeR * 0.9, dz = P.z - e.c.z; return Math.hypot(dx * 0.85, dy * 0.75, dz) < 3.1 * eyeR; })) return 'pattern';
        return zone === 'belly' ? 'body' : zone;
      }
      case 'raccoon': {
        if (head && part === 'head' && eyeNear(P, 2.9) && u < s0 + 0.3 * (1 - s0)) return 'pattern';
        if (head && part === 'head' && u > s0 + 0.3 * (1 - s0)) return 'belly';
        if (part === 'tail') return u > 0.94 || Math.sin(TAU * u * 5.5) > 0 ? 'pattern' : 'body';
        if (limb && P.y < 0.5 * L.elbowY) return 'pattern';
        return zone;
      }
      case 'badger': {
        if (head) { const ac = Math.abs(ca); return part === 'head' && sa > -0.35 && ac > 0.14 && ac < 0.6 ? 'pattern' : 'belly'; }
        if (part === 'ear') return 'belly';
        if (limb) return 'pattern';
        return zone;
      }
      case 'anteater': {
        if (torso && Math.abs((P.z - L.zF + 0.25 * L.Lt) / L.Lt + (P.y - L.H * 0.6) / L.Lt * 0.9) < 0.05 && sa > -0.6) return 'pattern';
        if (torso && Math.abs((P.z - L.zF + 0.25 * L.Lt) / L.Lt + (P.y - L.H * 0.6) / L.Lt * 0.9) < 0.075 && sa > -0.6) return 'belly';
        // pale forelegs with a black band at the wrist
        if (limb && q.front) return P.y < 0.28 * L.elbowY && P.y > 0.12 * L.elbowY ? 'pattern' : P.y < L.elbowY * 1.05 ? 'belly' : zone;
        return zone;
      }
      case 'tabby': { // Digital Diorama revision: mackerel tabby — dorsal line, narrow ribs of stripes, ringed legs and tail, forehead M
        if (zone === 'belly') return zone;
        const n = fbm(x * 3, y * 3, z * 3, seed) - 0.5;
        if (torso) {
          if (sa > 0.93) return 'pattern';
          const along = u > U.neckRoot - 0.02 ? (P.x * L.nd.x + P.y * L.nd.y + P.z * L.nd.z) * k : z;
          return sa > -0.5 && Math.cos(TAU * (along * (S.stripeFreq ?? 13) + n * 1.2 - sa * 0.3)) > 0.45 ? 'pattern' : zone;
        }
        if (part === 'tail') return u > 0.92 || Math.cos(TAU * u * 9) > 0.3 ? 'pattern' : zone;
        if (limb) return P.y > 0.2 * L.elbowY && Math.cos(TAU * (y * 14 + n)) > 0.5 && !(sa < -0.2 && Math.abs(ca) < 0.6) ? 'pattern' : zone;
        if (part === 'head') {
          if (u < s0 && sa > 0.5 && Math.cos(TAU * (Math.abs(ca) * 3.2 + u * 2)) > 0.55) return 'pattern';
          if (u < s0 && Math.abs(ca) > 0.6 && sa > -0.4 && Math.cos(TAU * (u * 7 + sa)) > 0.6) return 'pattern';
        }
        return zone;
      }
      default: return zone;
    }
  };
}

/* ════════════════════════════════════════════════════════════════════════════
 *  ZONES, PALETTES & SPECIES
 * ════════════════════════════════════════════════════════════════════════════ */
const BASE = {
  body: '#8a6a4a', belly: '#d9c7a8', marking: '#3a2a1e', pattern: '#22190f', mane: '#3b2a1f',
  skin: '#c98d82', lid: '#2a1d17', hoof: '#3a3230', horn: '#d8c9a6', eye: '#5a3a1c',
  pupil: '#0c0a09', nose: '#2b2321', mouth: '#6e3434', teeth: '#efe8d8', web: '#4a3c32',
};
const ZONE_KEYS = Object.keys(BASE);
const ZONE_ROLES = { body: 'body', belly: 'body', marking: 'body', pattern: 'body', mane: 'body', skin: 'soft', lid: 'soft', hoof: 'keratin', horn: 'keratin', eye: 'eye', pupil: 'pupil', nose: 'soft', mouth: 'soft', teeth: 'keratin', web: 'soft' };
const ZONE_LABELS = { body: 'Coat', belly: 'Belly / light coat', marking: 'Markings', pattern: 'Pattern', mane: 'Mane / hair', skin: 'Inner ear / skin', lid: 'Eyelids', hoof: 'Hooves / claws', horn: 'Horns / antlers', eye: 'Iris', pupil: 'Pupil', nose: 'Nose', mouth: 'Mouth', teeth: 'Teeth / tusks', web: 'Webbing' };

function mergeDeep(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof v !== 'function' && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? mergeDeep(a[k], v) : v;
  }
  return out;
}
const pal = (o) => ({ ...BASE, ...o });

/** Defaults shared by every tetrapod (overridden per family, then per species). */
const DEF = {
  H: 1, len: 1, depth: 0.45, width: 0.8, rump: 1, rumpDepth: 1, hipW: 1, chestW: 1, sag: 0, tuck: 0.2, belly: 0.1, withers: 0,
  neckAng: 40, neckLen: 0.35, neckThk: 0.62, neckW: 0.8, neckArch: 0.05,
  headAng: 30, headLen: 0.3, headD: 0.3, headW: 0.26, snout: 0.45, snoutW: 0.55, snoutD: 0.55, stop: 0.3, dome: 1, cheek: 1.05, jowl: 1, brow: 0.05,
  eye: 0.05, eyeYaw: 52, eyeEl: 16, nose: 'pad', pupil: 'round', jaw: 0.5,
  ear: { style: 'pointed', len: 0.35, w: 0.5, s: 0.16, a: 0.62, spread: 22, tilt: 12, turn: 22, cup: 0.45 },
  stance: 'digitigrade', legThk: 1, tail: { style: 'thin', len: 0.5, thk: 0.03, set: -30 },
  pattern: 'none', countershade: 0.4, palette: pal({}),
};
const UNGULATE = { stance: 'ungulate', nose: 'muzzle', pupil: 'bar', eyeYaw: 64, eyeEl: 14, foot: 'cloven', ear: { style: 'pointed', s: 0.08, a: 0.62, spread: 40, tilt: 4, turn: 30 } };
const CANID = { stance: 'digitigrade', nose: 'pad', whiskerPads: false, claws: 0.9, toes: 4, fang: 0.07, stop: 0.42, eyeYaw: 38, eyeEl: 14,
  ear: { style: 'pointed', len: 0.36, w: 0.62, s: 0.2, a: 0.6, spread: 18, tilt: 10, turn: 18, cup: 0.5 }, tail: { style: 'bushy', len: 0.55, thk: 0.045, set: -55, curl: 15, bush: 0.7 } };
const FELID = { stance: 'digitigrade', nose: 'feline', whiskerPads: true, pupil: 'slit', claws: 0.6, toes: 4, fang: 0.06, stop: 0.55, dome: 1.08, eyeYaw: 30, eyeEl: 12, snout: 0.3, snoutW: 0.7, snoutD: 0.62, cheek: 1.18,
  ear: { style: 'feline', len: 0.26, w: 0.85, s: 0.26, a: 0.66, spread: 26, tilt: 6, turn: 12, cup: 0.55 }, tail: { style: 'thin', len: 0.85, thk: 0.035, set: -40, curl: 30, tipCurl: 12 } };
const URSID = { stance: 'plantigrade', nose: 'pad', claws: 1.1, toes: 5, footLen: 1.1, dome: 1.1, stop: 0.35, eyeYaw: 32, eye: 0.04, neckThk: 0.85,
  ear: { style: 'round', len: 0.2, w: 0.95, s: 0.24, a: 0.78, spread: 28, tilt: 4, turn: 12, cup: 0.5 }, tail: { style: 'thin', len: 0.1, thk: 0.06, set: -40 } };
const RODENT = { stance: 'digitigrade', nose: 'pad', incisors: 0.09, whiskerPads: true, claws: 0.6, toes: 4, eye: 0.11, eyeYaw: 70, stop: 0.2, crouch: 0.8, hockH: 0.13, footLen: 1.6 };

const SPECIES_DEFS = {
  horse: { label: 'Horse', fam: UNGULATE, H: 1.6, len: 1.02, depth: 0.44, width: 0.8, rump: 0.99, hipW: 1.06, tuck: 0.18, belly: 0.25, withers: 0.14,
    neckAng: 48, neckLen: 0.5, neckThk: 0.6, neckW: 0.62, neckArch: 0.1, headAng: 60, headLen: 0.37, headD: 0.24, headW: 0.17, snout: 0.6, snoutW: 0.62, snoutD: 0.55, stop: 0.08, cheek: 1.3, jowl: 1.4, eye: 0.04, eyeS: 0.3,
    foot: 'hoof', legThk: 0.95, ear: { style: 'pointed', len: 0.26, w: 0.42, s: 0.07, a: 0.42, spread: 12, tilt: 6, turn: 30, cup: 0.6 },
    tail: { style: 'hair', len: 0.26, thk: 0.035, set: -50, hair: 2.7, hairW: 3.2 }, mane: { style: 'horse', h: 0.1 }, points: 0.45, countershade: 0.1,
    palette: pal({ body: '#7b4a2a', belly: '#9a6a46', marking: '#24170f', mane: '#1e1410', hoof: '#2e2724', nose: '#3a2d29', skin: '#3d302b' }) },
  zebra: { label: 'Plains Zebra', fam: UNGULATE, H: 1.33, len: 1.0, depth: 0.47, width: 0.84, rump: 0.99, hipW: 1.05, belly: 0.3, withers: 0.08,
    neckAng: 44, neckLen: 0.46, neckThk: 0.66, neckW: 0.62, neckArch: 0.06, headAng: 58, headLen: 0.39, headD: 0.25, headW: 0.18, snout: 0.58, snoutW: 0.64, snoutD: 0.56, stop: 0.08, cheek: 1.3, jowl: 1.4, eye: 0.042, eyeS: 0.3,
    foot: 'hoof', ear: { style: 'pointed', len: 0.33, w: 0.5, s: 0.07, a: 0.42, spread: 16, tilt: 4, turn: 30, cup: 0.6 },
    tail: { style: 'tuft', len: 0.36, thk: 0.022, set: -70, tuft: 2.2 }, mane: { style: 'crest', h: 0.09 }, pattern: 'stripes', countershade: 0.3,
    palette: pal({ body: '#f2efe6', belly: '#f6f3ec', marking: '#1b1a19', pattern: '#161515', mane: '#1a1918', hoof: '#2a2725', nose: '#1e1c1b', skin: '#3a3533' }) },
  donkey: { label: 'Donkey', fam: UNGULATE, H: 1.2, len: 1.0, depth: 0.48, width: 0.84, rump: 1.0, belly: 0.3, withers: 0.02,
    neckAng: 42, neckLen: 0.44, neckThk: 0.66, neckW: 0.66, headAng: 56, headLen: 0.42, headD: 0.25, headW: 0.18, snout: 0.55, snoutW: 0.66, snoutD: 0.6, stop: 0.05, cheek: 1.3, jowl: 1.45, eye: 0.04, eyeS: 0.3,
    foot: 'hoof', ear: { style: 'long', len: 0.55, w: 0.36, s: 0.07, a: 0.42, spread: 20, tilt: 6, turn: 30, cup: 0.6 },
    tail: { style: 'tuft', len: 0.42, thk: 0.02, set: -72, tuft: 2 }, mane: { style: 'crest', h: 0.07 }, muzzle: 'light', muzzleS: 0.55, dorsal: true, countershade: 0.45,
    palette: pal({ body: '#8b847c', belly: '#d9d3c8', marking: '#2a2622', mane: '#2a2622', hoof: '#33302d', nose: '#2b2826' }) },
  cow: { label: 'Dairy Cow', fam: UNGULATE, H: 1.42, len: 1.16, depth: 0.58, width: 0.86, rump: 1.0, hipW: 1.1, rumpDepth: 0.95, tuck: 0.05, belly: 0.4,
    neckAng: 22, neckLen: 0.3, neckThk: 0.75, neckW: 0.72, headAng: 62, headLen: 0.39, headD: 0.27, headW: 0.25, snout: 0.5, snoutW: 0.8, snoutD: 0.66, stop: 0.05, cheek: 1.12, jowl: 1.2, muzzleN: 2.0, eye: 0.045, eyeS: 0.3,
    ear: { style: 'pointed', len: 0.3, w: 0.55, s: 0.12, a: 1.15, spread: 75, tilt: -10, turn: 40, cup: 0.4 }, horns: { style: 'cattle', len: 0.32, thk: 0.06, s: 0.04, a: 0.95 },
    tail: { style: 'tuft', len: 0.62, thk: 0.022, set: -84, tuft: 2.4 }, pattern: 'patches', countershade: 0.1, muzzle: 'light', muzzleS: 0.8, udder: 0.13,
    palette: pal({ body: '#f1ede4', belly: '#f4f0e8', pattern: '#1c1a19', marking: '#1c1a19', nose: '#d99a96', skin: '#d99a96', horn: '#e2d6b6', hoof: '#3b3330' }) },
  deer: { label: 'White-tailed Deer', fam: UNGULATE, H: 1.0, len: 1.0, depth: 0.42, width: 0.78, rump: 1.02, tuck: 0.3, neckAng: 52, neckLen: 0.48, neckThk: 0.55, neckW: 0.7,
    headAng: 55, headLen: 0.31, headD: 0.26, headW: 0.22, snout: 0.55, snoutW: 0.5, snoutD: 0.5, stop: 0.15, eye: 0.06, eyeS: 0.32, legThk: 0.72,
    ear: { style: 'pointed', len: 0.5, w: 0.56, s: 0.1, a: 0.85, spread: 45, tilt: 4, turn: 35, cup: 0.6 }, horns: { style: 'whitetail', len: 1.15, thk: 0.075, s: 0.09, a: 0.5, tines: 4 },
    tail: { style: 'flat', len: 0.2, thk: 0.035, set: -20, flat: 2 }, tailUnder: true, rumpPatch: true, countershade: 0.55, muzzle: 'dark', muzzleS: 0.9,
    palette: pal({ body: '#9a6b42', belly: '#efe7da', marking: '#2a1d14', nose: '#1d1715', horn: '#cbb48c' }) },
  // Digital Diorama revision: a deeper chest, thick ruff and fuller tail (it looked shaved), grizzled agouti coat
  // with a dark saddle, tawny legs, pale lips and cheeks under a dark nose (not a white nose tip), dark tail tip
  wolf: { label: 'Gray Wolf', fam: CANID, H: 0.8, len: 1.15, depth: 0.46, width: 0.8, rump: 0.97, tuck: 0.36, neckAng: 30, neckLen: 0.32, neckThk: 1.0,
    headAng: 22, headLen: 0.32, headD: 0.27, headW: 0.34, snout: 0.5, snoutW: 0.46, snoutD: 0.5, eye: 0.045, legThk: 1.02, saddle: 0.26, countershade: 0.6, muzzle: 'light', muzzleS: 0.45, muzzleLow: true, cheeks: true,
    tail: { style: 'bushy', len: 0.55, thk: 0.07, set: -62, curl: 12, bush: 0.85 }, tailTip: 0.12, tailTipZone: 'marking', legZone: 'mane', grain: 2.4,
    palette: pal({ body: '#8b8276', belly: '#e6dfd1', marking: '#57504a', mane: '#b09673', eye: '#b9892c', nose: '#1a1817' }) },
  cat: { label: 'Domestic Cat', fam: FELID, H: 0.25, len: 1.45, depth: 0.46, width: 0.7, rump: 1.04, tuck: 0.35, neckAng: 34, neckLen: 0.3, neckThk: 0.75,
    // Digital Diorama revision: a brown mackerel tabby, eyes set into the face (they bulged from the sides)
    headAng: 12, headLen: 0.34, headD: 0.36, headW: 0.44, snout: 0.25, eye: 0.092, eyeInset: 0.74, eyeYaw: 26, legThk: 1.05, footLen: 1.1, hockH: 0.26, neckThk: 0.85,
    ear: { len: 0.36, w: 0.78 }, tail: { len: 1.1, thk: 0.034, set: 20, curl: 45, tipCurl: 20 }, pattern: 'tabby', countershade: 0.55, cheeks: true, grain: 1.6,
    palette: pal({ body: '#8f7b5e', belly: '#dccfb6', pattern: '#2e2419', marking: '#2e2419', eye: '#a9a83c', nose: '#c27c72', skin: '#d99a92' }) },
  // Digital Diorama revision (big cats): heavier forelimbs, a broader, deeper body and a broader head
  lion: { label: 'Lion', fam: FELID, H: 1.15, len: 1.35, depth: 0.52, width: 0.86, rump: 0.98, tuck: 0.26, neckAng: 22, neckLen: 0.3, neckThk: 0.95,
    headAng: 18, headLen: 0.32, headD: 0.33, headW: 0.38, snout: 0.42, snoutW: 0.66, snoutD: 0.64, stop: 0.4, eye: 0.042, legThk: 1.28,
    ear: { style: 'round', len: 0.17, w: 0.95, s: 0.24, a: 0.8 }, tail: { style: 'tuft', len: 0.8, thk: 0.028, set: -60, curl: 20, tuft: 2.6 }, mane: { style: 'lion', size: 0.72 }, countershade: 0.45, cheeks: true, earTip: 0.4,
    palette: pal({ body: '#c09356', belly: '#e9d4ae', marking: '#3a2a1c', mane: '#6b4425', eye: '#b8862a', nose: '#6a3d35' }) },
  tiger: { label: 'Bengal Tiger', fam: FELID, H: 1.0, len: 1.55, depth: 0.55, width: 0.88, rump: 1.0, tuck: 0.2, neckAng: 22, neckLen: 0.28, neckThk: 0.98,
    headAng: 15, headLen: 0.34, headD: 0.33, headW: 0.4, snout: 0.38, eye: 0.042, legThk: 1.32, cheek: 1.32, ear: { style: 'round', len: 0.17, w: 0.95, s: 0.24, a: 0.82 },
    tail: { style: 'thin', len: 0.95, thk: 0.045, set: -45, curl: 25, tipCurl: 15 }, pattern: 'tiger', countershade: 0.55, cheeks: true, earZone: 'pattern',
    palette: pal({ body: '#d27a2c', belly: '#f3ead8', pattern: '#1b1310', marking: '#1b1310', eye: '#c8a034', nose: '#c07a72' }) },
  elephant: { label: 'African Elephant', fam: { stance: 'graviportal', nose: 'none' }, H: 3.0, len: 1.02, depth: 0.5, width: 0.92, rump: 0.93, rumpDepth: 0.92, tuck: 0, belly: 0.15,
    // Digital Diorama revision: a big domed head; ears hang back over the shoulders from their front edge
    // (they used to spread both ways from the root and jut forward over the face); a longer, thicker trunk;
    // the back dips behind the shoulders
    neckAng: 12, neckLen: 0.08, neckThk: 0.95, neckW: 0.9, headAng: 72, headLen: 0.4, headD: 0.62, headW: 0.62, snout: 0.35, snoutW: 0.6, snoutD: 0.5, stop: 0, dome: 1.3, eye: 0.025, eyeYaw: 70, legThk: 1.2, nails: 4, sag: 0.06,
    ear: { style: 'fan', len: 1.12, w: 0.42, offset: 0.9, thick: 0.3, s: 0.2, a: 1.05, spread: 18, tilt: 0, turn: 10, cup: 0.06, droop: 0.3, hang: 64, moundR: 0.12, innerW: 0 }, trunk: { len: 0.8, thk: 0.16, curl: 0.6 }, tusks: { style: 'elephant', len: 0.42, thk: 0.1, s: 0.78, a: 0.75 },
    tail: { style: 'tuft', len: 0.38, thk: 0.02, set: -80, tuft: 1.8 }, countershade: 0,
    palette: pal({ body: '#7f7a74', belly: '#77726c', marking: '#5d5853', mane: '#2b2826', skin: '#8f7d78', hoof: '#cfc6b6', teeth: '#efe5cc' }) },
  giraffe: { label: 'Giraffe', fam: UNGULATE, H: 3.0, len: 0.62, depth: 0.34, width: 0.82, rump: 0.82, rumpDepth: 0.9, tuck: 0.2, withers: 0.25,
    neckAng: 62, neckLen: 0.66, neckThk: 0.5, neckW: 0.62, headAng: 60, headLen: 0.19, headD: 0.24, headW: 0.2, snout: 0.55, snoutW: 0.6, snoutD: 0.5, stop: 0.1, eye: 0.06, eyeS: 0.3, legThk: 0.55, tibiaSlope: 0.7,
    ear: { style: 'pointed', len: 0.4, w: 0.42, s: 0.12, a: 1.05, spread: 70, tilt: -5, turn: 35 }, horns: { style: 'ossicones', len: 0.45, thk: 0.07, s: 0.1, a: 0.42 },
    tail: { style: 'tuft', len: 0.3, thk: 0.012, set: -80, tuft: 2.5 }, mane: { style: 'crest', h: 0.025 }, pattern: 'giraffe', countershade: 0,
    palette: pal({ body: '#e5cf9e', belly: '#efe0bd', pattern: '#9b5a2a', mane: '#6a3b1c', hoof: '#2e2724', horn: '#5a3a1f', nose: '#4a3a32' }) },
  bear: { label: 'Brown Bear', fam: URSID, H: 1.1, len: 1.3, depth: 0.56, width: 0.95, rump: 0.97, tuck: 0.05, belly: 0.3, withers: 0.18, neckAng: 14, neckLen: 0.26,
    headAng: 22, headLen: 0.33, headD: 0.32, headW: 0.34, snout: 0.42, snoutW: 0.5, snoutD: 0.55, legThk: 1.25, countershade: 0.1, muzzle: 'light', muzzleS: 0.7,
    palette: pal({ body: '#6b4a2e', belly: '#5d3f27', marking: '#3a2818', hoof: '#2a2420', nose: '#161210' }) },
  pig: { label: 'Domestic Pig', fam: UNGULATE, H: 0.8, len: 1.4, depth: 0.62, width: 0.92, rump: 1.02, hipW: 1.08, tuck: 0, belly: 0.4, neckAng: 8, neckLen: 0.06, neckThk: 0.92, neckW: 0.95,
    headAng: 28, headLen: 0.42, headD: 0.27, headW: 0.3, snout: 0.55, snoutW: 0.48, snoutD: 0.48, stop: 0.12, dome: 0.9, jowl: 1.5, eye: 0.03, nose: 'disc', muzzleN: 2.6, eyeYaw: 50,
    ear: { style: 'semiPrick', len: 0.4, w: 0.7, s: 0.2, a: 0.75, spread: 30, tilt: 18, turn: 10, breakU: 0.5 }, tail: { style: 'curly', len: 0.3, thk: 0.018, turns: 1.6 },
    countershade: 0, palette: pal({ body: '#eab3a4', belly: '#ebb8aa', skin: '#e39a8c', nose: '#d98b80', mouth: '#9c4c4a', hoof: '#a08070' }) },
  // Digital Diorama revision: a compact body under a larger head (the body dwarfed it)
  rabbit: { label: 'Rabbit', fam: RODENT, H: 0.2, len: 1.22, depth: 0.7, width: 0.78, rump: 1.2, rumpDepth: 1.15, hipW: 1.1, tuck: 0.05, neckAng: 35, neckLen: 0.18, neckThk: 0.9,
    headAng: 18, headLen: 0.53, headD: 0.36, headW: 0.38, snout: 0.32, snoutW: 0.6, snoutD: 0.6, eye: 0.1, eyeYaw: 75, legThk: 1.1, crouch: 0.9, hockH: 0.08, footLen: 2.6, incisors: 0.07,
    ear: { style: 'long', len: 0.95, w: 0.32, s: 0.18, a: 0.5, spread: 14, tilt: 22, turn: 18, cup: 0.6 }, tail: { style: 'fluffy', len: 0.22, thk: 0.07, set: 40 },
    countershade: 0.5, tailTip: 1, tailTipZone: 'belly', palette: pal({ body: '#9a8068', belly: '#eee4d6', skin: '#dba59a', nose: '#c98b84', eye: '#2a1b12' }) },
  // Digital Diorama revision: a stocky retriever (it read as a whippet): deep, broad chest, thick legs and neck,
  // broad skull and muzzle, thick "otter" tail; pale yellow coat
  dog: { label: 'Labrador Dog', fam: CANID, H: 0.58, len: 1.18, depth: 0.54, width: 0.92, rump: 0.98, tuck: 0.18, neckAng: 36, neckLen: 0.3, neckThk: 0.98,
    headAng: 15, headLen: 0.4, headD: 0.3, headW: 0.38, snout: 0.42, snoutW: 0.7, snoutD: 0.66, stop: 0.55, eye: 0.045, jowl: 1.25, legThk: 1.18,
    ear: { style: 'floppy', len: 0.38, w: 0.62, s: 0.22, a: 0.95, spread: 30, droop: 0.95, hang: 15, innerW: 0 }, tail: { style: 'thin', len: 0.6, thk: 0.07, set: -10, curl: -10 },
    countershade: 0.15, palette: pal({ body: '#e2c38c', belly: '#ecd4a8', nose: '#2a1d18', eye: '#5a3a1c' }) },
  fox: { label: 'Red Fox', fam: CANID, H: 0.4, len: 1.4, depth: 0.42, width: 0.7, rump: 1.0, tuck: 0.4, neckAng: 32, neckLen: 0.3, neckThk: 0.72,
    headAng: 18, headLen: 0.36, headD: 0.24, headW: 0.3, snout: 0.55, snoutW: 0.36, snoutD: 0.42, eye: 0.05, legThk: 0.8, pupil: 'slit', slitW: 0.3,
    ear: { len: 0.45, w: 0.58 }, tail: { style: 'bushy', len: 0.95, thk: 0.1, set: -35, curl: 10, bush: 1.0 }, points: 0.55, tailTip: 0.14, tailTipZone: 'belly', earTip: 0.0, earZone: 'marking', countershade: 0.6, cheeks: true, grain: 1.5, neckThk: 0.85,
    palette: pal({ body: '#c4561e', belly: '#efe6da', marking: '#231a16', eye: '#c08c2a', nose: '#181412' }) },
  hyena: { label: 'Spotted Hyena', fam: CANID, H: 0.85, len: 1.1, depth: 0.5, width: 0.72, rump: 0.8, rumpDepth: 0.85, withers: 0.15, neckAng: 25, neckLen: 0.34, neckThk: 0.9,
    headAng: 20, headLen: 0.36, headD: 0.32, headW: 0.34, snout: 0.4, snoutW: 0.55, snoutD: 0.6, eye: 0.04,
    ear: { style: 'round', len: 0.27, w: 0.85 }, tail: { style: 'bushy', len: 0.38, thk: 0.035, set: -70, bush: 0.6 }, mane: { style: 'crest', h: 0.05 }, pattern: 'hyena', countershade: 0.2, muzzle: 'dark', muzzleS: 0.6,
    palette: pal({ body: '#b49a6c', belly: '#c8b38a', pattern: '#3a2b1e', marking: '#2d241b', mane: '#3a2b1e', nose: '#151110' }) },
  cheetah: { label: 'Cheetah', fam: FELID, H: 0.8, len: 1.25, depth: 0.44, width: 0.62, rump: 0.98, tuck: 0.65, chestW: 0.95, neckAng: 25, neckLen: 0.3, neckThk: 0.72,
    headAng: 12, headLen: 0.24, headD: 0.34, headW: 0.38, snout: 0.32, eye: 0.06, legThk: 0.84, claws: 0.4, ear: { style: 'round', len: 0.2, w: 0.95, s: 0.26, a: 0.85 },
    tail: { style: 'thin', len: 0.85, thk: 0.032, set: -55, curl: 30, tipCurl: 25 }, pattern: 'spots', tearMark: true, countershade: 0.55, cheeks: true,
    palette: pal({ body: '#d9a856', belly: '#f2e6cc', pattern: '#1d1712', marking: '#1d1712', eye: '#b8862a', nose: '#2a1f1a' }) },
  leopard: { label: 'Leopard', fam: FELID, H: 0.65, len: 1.5, depth: 0.5, width: 0.8, rump: 1.0, tuck: 0.3, neckAng: 24, neckLen: 0.3, neckThk: 0.92,
    headAng: 14, headLen: 0.33, headD: 0.34, headW: 0.4, snout: 0.36, eye: 0.045, legThk: 1.18, ear: { style: 'round', len: 0.2, w: 0.95, s: 0.24, a: 0.8 },
    tail: { style: 'thin', len: 1.2, thk: 0.035, set: -40, curl: 30, tipCurl: 20 }, pattern: 'rosettes', countershade: 0.55, cheeks: true,
    palette: pal({ body: '#d6a54e', belly: '#f2e5c8', pattern: '#1f1611', marking: '#a86a26', eye: '#b8a03a', nose: '#b07a6a' }) },
  lynx: { label: 'Eurasian Lynx', fam: FELID, H: 0.62, len: 1.12, depth: 0.48, width: 0.72, rump: 1.06, tuck: 0.3, neckAng: 28, neckLen: 0.28, neckThk: 0.82,
    headAng: 14, headLen: 0.3, headD: 0.35, headW: 0.4, snout: 0.3, cheek: 1.45, eye: 0.055, legThk: 1.05, footLen: 1.15, pawW: 1.25,
    ear: { style: 'tufted', len: 0.34, w: 0.7, s: 0.26, a: 0.66, spread: 20 }, tail: { style: 'thin', len: 0.18, thk: 0.04, set: -30 }, tailTip: 0.35, earTip: 0.25,
    pattern: 'spots', patternScale: 0.95, spotSize: 0.24, countershade: 0.6, cheeks: true, grain: 1.5,
    palette: pal({ body: '#b8936a', belly: '#efe4d2', pattern: '#6e5038', marking: '#1d1714', eye: '#b8a03a', nose: '#b07a6a' }) },
  // Digital Diorama revision: heavier limbs and body (it looked slender)
  polarBear: { label: 'Polar Bear', fam: URSID, H: 1.3, len: 1.45, depth: 0.58, width: 1.0, rump: 1.02, tuck: 0.06, belly: 0.25, neckAng: 22, neckLen: 0.38, neckThk: 0.85,
    headAng: 14, headLen: 0.32, headD: 0.27, headW: 0.3, snout: 0.48, snoutW: 0.58, snoutD: 0.52, stop: 0.15, dome: 0.95, legThk: 1.55, pawW: 1.25, countershade: 0,
    ear: { len: 0.15 }, palette: pal({ body: '#ece6d6', belly: '#e6dfcd', marking: '#d6ceb8', nose: '#121010', hoof: '#2a2420', skin: '#2a2420' }) },
  panda: { label: 'Giant Panda', fam: URSID, H: 0.75, len: 1.3, depth: 0.6, width: 1.0, rump: 1.0, tuck: 0.05, belly: 0.3, neckAng: 18, neckLen: 0.22, neckThk: 0.9,
    headAng: 16, headLen: 0.38, headD: 0.36, headW: 0.46, snout: 0.32, snoutW: 0.5, snoutD: 0.5, stop: 0.5, dome: 1.15, cheek: 1.35, legThk: 1.3,
    ear: { style: 'round', len: 0.22, w: 1.0, s: 0.2, a: 0.82 }, pattern: 'panda', countershade: 0,
    palette: pal({ body: '#f1ede4', belly: '#f1ede4', pattern: '#1b1a1a', marking: '#1b1a1a', nose: '#121010', skin: '#1b1a1a' }) },
  // Digital Diorama revision: a hunched, stocky body (it was long and stretched) and a grizzled coat
  raccoon: { label: 'Raccoon', fam: { ...URSID, stance: 'plantigrade' }, H: 0.3, len: 1.3, depth: 0.66, width: 0.95, rump: 1.2, tuck: 0.1, neckAng: 25, neckLen: 0.22, neckThk: 0.95, legThk: 1.2, grain: 2.2,
    headAng: 15, headLen: 0.42, headD: 0.3, headW: 0.42, snout: 0.45, snoutW: 0.35, snoutD: 0.4, stop: 0.45, eye: 0.05, cheek: 1.35, claws: 0.6,
    ear: { style: 'round', len: 0.26, w: 0.85, s: 0.22, a: 0.68, spread: 20 }, tail: { style: 'bushy', len: 0.85, thk: 0.085, set: -30, bush: 0.5 }, pattern: 'raccoon', countershade: 0.3, earTip: 0.0, earZone: 'belly',
    palette: pal({ body: '#8a847b', belly: '#cfc8bb', pattern: '#1e1c1a', marking: '#2b2825', nose: '#121010' }) },
  badger: { label: 'European Badger', fam: URSID, H: 0.28, len: 2.1, depth: 0.7, width: 1.25, grain: 1.8, rump: 1.0, tuck: 0, belly: 0.2, neckAng: 10, neckLen: 0.3, neckThk: 0.85,
    headAng: 18, headLen: 0.55, headD: 0.24, headW: 0.32, snout: 0.5, snoutW: 0.4, snoutD: 0.45, stop: 0.05, dome: 0.9, eye: 0.03, legThk: 1.4, claws: 1.4,
    ear: { style: 'round', len: 0.14, w: 1.0, s: 0.22, a: 0.95 }, tail: { style: 'bushy', len: 0.45, thk: 0.06, set: -20, bush: 0.4 }, pattern: 'badger', countershade: 0,
    palette: pal({ body: '#8f8a84', belly: '#ece8df', pattern: '#1a1918', marking: '#1a1918', nose: '#121010' }) },
  otter: { label: 'River Otter', fam: { stance: 'plantigrade', nose: 'pad', whiskerPads: true, claws: 0.3 }, H: 0.3, len: 2.4, depth: 0.58, width: 0.92, rump: 1.02, tuck: 0.05, neckAng: 18, neckLen: 0.42, neckThk: 0.92,
    headAng: 8, headLen: 0.42, headD: 0.24, headW: 0.38, snout: 0.35, snoutW: 0.6, snoutD: 0.55, stop: 0.25, dome: 0.9, eye: 0.045, eyeEl: 30, legThk: 1.2, footLen: 1.1, webbed: true, toes: 5,
    ear: { style: 'round', len: 0.12, w: 1.0, s: 0.24, a: 1.0 }, tail: { style: 'thin', len: 1.35, match: 0.75, set: -15 }, countershade: 0.45, cheeks: true,
    palette: pal({ body: '#5e432c', belly: '#a68e72', nose: '#121010', web: '#3a2a1e' }) },
  // Digital Diorama revision: a round body under a dense coat of short spines laid back (painted between the
  // modelled quills), rather than sparse long spikes on a long body
  hedgehog: { label: 'Hedgehog', fam: { stance: 'plantigrade', nose: 'pad', claws: 0.5 }, H: 0.115, len: 1.35, depth: 0.86, width: 1.2, rump: 1.0, tuck: 0, neckAng: 15, neckLen: 0.12, neckThk: 0.95,
    headAng: 25, headLen: 0.5, headD: 0.3, headW: 0.36, snout: 0.5, snoutW: 0.3, snoutD: 0.32, stop: 0.1, eye: 0.06, legThk: 1.4, quills: { len: 0.2, count: 560, lay: 1.35 }, spinyBack: true,
    ear: { style: 'round', len: 0.2, w: 1.0, s: 0.25, a: 0.95 }, tail: { style: 'thin', len: 0.12, thk: 0.06, set: -30 }, countershade: 0.6,
    palette: pal({ body: '#7d6a55', belly: '#cbb59a', marking: '#c9b996', pattern: '#4f3e2d', nose: '#121010', skin: '#d4a090' }) },
  // Digital Diorama revision: a compact, crouched body low on short legs (it stood on stilts like a cat) and a
  // tail as bushy as the body is deep, arching up behind the back
  squirrel: { label: 'Red Squirrel', fam: RODENT, H: 0.095, len: 1.9, depth: 0.74, width: 0.85, rump: 1.12, rumpDepth: 1.15, tuck: 0.15, neckAng: 40, neckLen: 0.18, neckThk: 0.9,
    headAng: 15, headLen: 0.5, headD: 0.38, headW: 0.44, snout: 0.32, eye: 0.12, legThk: 1.25,
    ear: { style: 'tufted', len: 0.42, w: 0.55, s: 0.2, a: 0.55, spread: 15 }, tail: { style: 'bushy', len: 1.8, thk: 0.24, set: 62, curl: -8, tipCurl: -22, bush: 0.9 },
    countershade: 0.65, palette: pal({ body: '#b5561f', belly: '#f2e4cc', marking: '#7a3812', nose: '#3a2a22', eye: '#140e0b' }) },
  beaver: { label: 'Beaver', fam: { ...RODENT, stance: 'plantigrade', crouch: 0 }, H: 0.32, len: 2.0, depth: 0.72, width: 1.0, rump: 1.15, rumpDepth: 1.1, tuck: 0, neckAng: 20, neckLen: 0.22, neckThk: 0.95,
    headAng: 15, headLen: 0.45, headD: 0.3, headW: 0.38, snout: 0.38, snoutW: 0.62, snoutD: 0.6, eye: 0.04, incisors: 0.12, webbed: 'hind', toes: 5, legThk: 1.25,
    ear: { style: 'round', len: 0.12, w: 1.0, s: 0.22, a: 0.95 }, tail: { style: 'flat', len: 0.95, thk: 0.15, set: -12, flat: 3.4 }, countershade: 0.2,
    palette: pal({ body: '#6a4426', belly: '#7a5232', marking: '#2c2420', web: '#2c2420', nose: '#151110', teeth: '#d8862a' }) },
  capybara: { label: 'Capybara', fam: { ...RODENT, crouch: 0.2, hockH: 0.2, footLen: 1.4, eye: 0.04 }, H: 0.52, len: 1.6, depth: 0.6, width: 0.85, rump: 1.06, tuck: 0.05, neckAng: 20, neckLen: 0.2, neckThk: 0.9,
    headAng: 30, headLen: 0.48, headD: 0.36, headW: 0.33, snout: 0.5, snoutW: 0.82, snoutD: 0.82, stop: 0.0, dome: 0.92, eyeEl: 30, nose: 'muzzle', nostril: 0.18,
    ear: { style: 'round', len: 0.12, w: 1.0, s: 0.12, a: 0.75 }, tail: { style: 'none', len: 0 }, countershade: 0.1,
    palette: pal({ body: '#8a6440', belly: '#9a744e', nose: '#2a1d16', skin: '#5a4030' }) },
  sheep: { label: 'Sheep', fam: UNGULATE, H: 0.8, len: 1.15, depth: 0.62, width: 1.0, rump: 1.0, tuck: 0, belly: 0.2, neckAng: 32, neckLen: 0.26, neckThk: 0.85,
    headAng: 55, headLen: 0.34, headD: 0.27, headW: 0.26, snout: 0.5, snoutW: 0.6, snoutD: 0.58, stop: 0.1, roman: 0.6, eye: 0.05, legThk: 0.85, wool: 0.06,
    ear: { style: 'pointed', len: 0.32, w: 0.42, s: 0.12, a: 1.2, spread: 80, tilt: -15, turn: 40 }, tail: { style: 'thin', len: 0.2, thk: 0.05, set: -80 },
    faceZone: 'marking', legZone: 'marking', countershade: 0, earZone: 'marking',
    palette: pal({ body: '#ece2cc', belly: '#e6dbc2', marking: '#2c2623', nose: '#1d1917', skin: '#2c2623' }) },
  bighorn: { label: 'Bighorn Sheep', fam: UNGULATE, H: 1.0, len: 1.1, depth: 0.52, width: 0.88, rump: 1.0, tuck: 0.2, neckAng: 40, neckLen: 0.3, neckThk: 0.85,
    headAng: 50, headLen: 0.3, headD: 0.29, headW: 0.27, snout: 0.5, snoutW: 0.58, snoutD: 0.55, stop: 0.15, roman: 0.4, eye: 0.05, legThk: 0.95,
    ear: { style: 'pointed', len: 0.3, w: 0.45, s: 0.14, a: 1.05, spread: 60, tilt: 0 }, horns: { style: 'ram', len: 1.45, thk: 0.17, s: 0.1, a: 0.5, curl: 1.85 },
    tail: { style: 'thin', len: 0.12, thk: 0.035, set: -60 }, rumpPatch: true, muzzle: 'light', muzzleS: 0.85, countershade: 0.35,
    palette: pal({ body: '#7a5f45', belly: '#eee4d4', horn: '#bfa77e', nose: '#2b2320' }) },
  goat: { label: 'Domestic Goat', fam: UNGULATE, H: 0.75, len: 1.15, depth: 0.5, width: 0.8, rump: 1.02, tuck: 0.15, neckAng: 45, neckLen: 0.34, neckThk: 0.68,
    headAng: 55, headLen: 0.32, headD: 0.26, headW: 0.24, snout: 0.5, snoutW: 0.55, snoutD: 0.5, stop: 0.2, eye: 0.055, legThk: 0.85,
    ear: { style: 'pointed', len: 0.42, w: 0.38, s: 0.12, a: 1.1, spread: 75, tilt: -10, turn: 40 }, horns: { style: 'goat', len: 0.8, thk: 0.07, s: 0.08, a: 0.35 },
    tail: { style: 'flat', len: 0.16, thk: 0.03, set: 55 }, mane: { style: 'none', beard: 0.45 }, countershade: 0.1,
    palette: pal({ body: '#e8e1d2', belly: '#efe9dc', marking: '#8a7a68', mane: '#d8d0bf', horn: '#a39478', nose: '#9a7d74', eye: '#c8a034' }) },
  bison: { label: 'American Bison', fam: UNGULATE, H: 1.8, len: 1.15, depth: 0.6, width: 0.85, rump: 0.8, rumpDepth: 0.8, tuck: 0.15, withers: 0.32, chestW: 1.15,
    neckAng: -5, neckLen: 0.2, neckThk: 0.95, neckW: 0.95, neckLow: 0.15, headAng: 78, headLen: 0.3, headD: 0.36, headW: 0.33, snout: 0.38, snoutW: 0.75, snoutD: 0.7, stop: 0.1, dome: 1.2, eye: 0.035,
    ear: { style: 'pointed', len: 0.2, w: 0.5, s: 0.16, a: 1.25, spread: 85, tilt: -10, turn: 40 }, horns: { style: 'cattle', len: 0.22, thk: 0.07, s: 0.1, a: 1.15 },
    tail: { style: 'tuft', len: 0.3, thk: 0.02, set: -70, tuft: 2.5 }, mane: { style: 'none', beard: 0.6 }, frontMane: 0.35, countershade: 0,
    palette: pal({ body: '#5a3d26', belly: '#4f3420', mane: '#2e1f14', horn: '#1e1a17', nose: '#151210' }) },
  gazelle: { label: "Thomson's Gazelle", fam: UNGULATE, H: 0.65, len: 1.0, depth: 0.42, width: 0.74, rump: 1.03, tuck: 0.4, neckAng: 52, neckLen: 0.42, neckThk: 0.52,
    headAng: 50, headLen: 0.32, headD: 0.26, headW: 0.24, snout: 0.5, snoutW: 0.5, snoutD: 0.48, stop: 0.15, eye: 0.07, legThk: 0.6,
    ear: { style: 'pointed', len: 0.45, w: 0.45, s: 0.12, a: 0.85, spread: 45 }, horns: { style: 'lyre', len: 0.95, thk: 0.06, s: 0.13, a: 0.32 },
    tail: { style: 'thin', len: 0.2, thk: 0.02, set: -40 }, tailTip: 0.5, flankStripe: true, rumpPatch: true, countershade: 0.6,
    palette: pal({ body: '#c58c4f', belly: '#f3ece0', marking: '#231a14', horn: '#3b302a', nose: '#1d1715' }) },
  moose: { label: 'Moose', fam: UNGULATE, H: 1.9, len: 0.98, depth: 0.45, width: 0.8, rump: 0.92, rumpDepth: 0.9, tuck: 0.15, withers: 0.18, neckAng: 25, neckLen: 0.28, neckThk: 0.8,
    headAng: 62, headLen: 0.36, headD: 0.24, headW: 0.2, snout: 0.62, snoutW: 0.75, snoutD: 0.8, stop: 0.05, roman: 0.9, drop: 0.25, eye: 0.03, legThk: 0.9,
    ear: { style: 'pointed', len: 0.38, w: 0.48, s: 0.12, a: 1.0, spread: 60, tilt: 0 }, horns: { style: 'palmate', len: 0.95, thk: 0.07, s: 0.12, a: 0.65 },
    tail: { style: 'thin', len: 0.06, thk: 0.03, set: -60 }, socks: 0.75, countershade: 0,
    palette: pal({ body: '#3e2b1d', belly: '#a0896d', marking: '#2a1d14', horn: '#c7b086', nose: '#1d1612' }) },
  reindeer: { label: 'Reindeer', fam: UNGULATE, H: 1.1, len: 1.05, depth: 0.5, width: 0.84, rump: 1.0, tuck: 0.15, neckAng: 35, neckLen: 0.35, neckThk: 0.75,
    headAng: 55, headLen: 0.33, headD: 0.25, headW: 0.22, snout: 0.55, snoutW: 0.7, snoutD: 0.6, stop: 0.08, eye: 0.045, legThk: 0.95, pawW: 1.2,
    ear: { style: 'pointed', len: 0.3, w: 0.5, s: 0.12, a: 0.95, spread: 55 }, horns: { style: 'antlers', len: 1.3, thk: 0.05, s: 0.1, a: 0.42, tines: 5 },
    tail: { style: 'flat', len: 0.12, thk: 0.035, set: -40 }, frontMane: 0.7, maneTop: 0.25, maneHead: false, rumpPatch: true, countershade: 0.3, muzzle: 'dark', muzzleS: 0.6, grain: 1.6,
    palette: pal({ body: '#7a6a58', belly: '#e4dccb', mane: '#ece4d4', marking: '#3d3127', horn: '#d0bc96', nose: '#2b2320' }) },
  camel: { label: 'Dromedary Camel', fam: { ...UNGULATE, foot: 'pad', nose: 'muzzle', pupil: 'round' }, H: 1.85, len: 0.82, depth: 0.42, width: 0.78, rump: 0.92, tuck: 0.35, humps: [{ u: 0.55, h: 0.2, w: 0.42 }],
    neckAng: 15, neckLen: 0.55, neckThk: 0.48, neckW: 0.6, neckArch: -0.12, headAng: 25, headLen: 0.28, headD: 0.23, headW: 0.22, snout: 0.55, snoutW: 0.6, snoutD: 0.6, stop: 0.2, eye: 0.05, legThk: 0.72, tibiaSlope: 0.7,
    ear: { style: 'round', len: 0.18, w: 0.8, s: 0.12, a: 0.8, spread: 40 }, tail: { style: 'tuft', len: 0.3, thk: 0.018, set: -80, tuft: 1.6 }, countershade: 0.1,
    palette: pal({ body: '#c9a06b', belly: '#d6b585', mane: '#8a6438', hoof: '#5a4a3a', nose: '#4a3a30' }) },
  llama: { label: 'Llama', fam: UNGULATE, H: 1.15, len: 0.95, depth: 0.5, width: 0.82, rump: 1.0, tuck: 0.15, neckAng: 78, neckLen: 0.62, neckThk: 0.55, neckW: 0.7,
    headAng: 30, headLen: 0.3, headD: 0.26, headW: 0.24, snout: 0.45, snoutW: 0.55, snoutD: 0.6, stop: 0.25, eye: 0.06, legThk: 0.85, wool: 0.05,
    ear: { style: 'long', len: 0.52, w: 0.38, s: 0.1, a: 0.5, spread: 18, tilt: 0, turn: 30, droop: 0.15 }, tail: { style: 'fluffy', len: 0.2, thk: 0.05, set: 30 },
    countershade: 0, palette: pal({ body: '#efe3cc', belly: '#efe3cc', marking: '#7a5a3a', nose: '#3a2b24' }) },
  rhino: { label: 'White Rhinoceros', fam: { stance: 'graviportal', nose: 'muzzle', pupil: 'round', nails: 3 }, H: 1.7, len: 1.45, depth: 0.62, width: 0.92, rump: 0.96, tuck: 0.05, belly: 0.3, withers: 0.25,
    neckAng: 0, neckLen: 0.18, neckThk: 0.95, neckW: 0.9, headAng: 55, headLen: 0.48, headD: 0.26, headW: 0.24, snout: 0.5, snoutW: 0.9, snoutD: 0.7, stop: 0, dome: 0.9, eye: 0.02, eyeYaw: 80, legThk: 1.25,
    ear: { style: 'pointed', len: 0.26, w: 0.42, s: 0.08, a: 0.55, spread: 30, tilt: 0, turn: 30, cup: 0.9 }, horns: { style: 'rhino', len: 0.75, thk: 0.09 },
    tail: { style: 'tuft', len: 0.3, thk: 0.03, set: -80, tuft: 1.6 }, countershade: 0,
    palette: pal({ body: '#8a847c', belly: '#827c74', horn: '#6a6058', hoof: '#57514b', skin: '#7a6e68', nose: '#4a4440' }) },
  hippo: { label: 'Hippopotamus', fam: { stance: 'graviportal', nose: 'muzzle', pupil: 'round', nails: 4 }, H: 1.5, len: 1.55, depth: 0.72, width: 1.05, rump: 1.0, tuck: 0, belly: 0.3,
    neckAng: 5, neckLen: 0.12, neckThk: 0.95, neckW: 0.95, headAng: 25, headLen: 0.5, headD: 0.36, headW: 0.38, snout: 0.5, snoutW: 1.2, snoutD: 0.85, stop: 0.35, dome: 0.85, eye: 0.04, eyeYaw: 45, eyeEl: 45, turret: false, legThk: 1.4, nostrilA: 1.1,
    ear: { style: 'round', len: 0.1, w: 1.0, s: 0.1, a: 0.6 }, tail: { style: 'flat', len: 0.18, thk: 0.04, set: -70, flat: 2 }, countershade: 0.3,
    palette: pal({ body: '#6e605e', belly: '#c49088', skin: '#c49088', nose: '#4a3e3c', mouth: '#c47a78' }) },
  boar: { label: 'Wild Boar', fam: UNGULATE, H: 0.85, len: 1.25, depth: 0.58, width: 0.75, rump: 0.86, rumpDepth: 0.9, tuck: 0.1, withers: 0.3, chestW: 1.08, neckAng: 5, neckLen: 0.08, neckThk: 0.95, neckW: 0.95,
    headAng: 35, headLen: 0.48, headD: 0.26, headW: 0.26, snout: 0.6, snoutW: 0.42, snoutD: 0.42, stop: 0.0, dome: 0.85, jowl: 1.3, eye: 0.025, nose: 'disc', muzzleN: 2.6,
    ear: { style: 'pointed', len: 0.28, w: 0.55, s: 0.14, a: 0.75, spread: 35, tilt: 10 }, tusks: { style: 'boar', len: 0.08, thk: 0.15, s: 0.85, a: 0.95 },
    tail: { style: 'tuft', len: 0.3, thk: 0.012, set: -70, tuft: 2.2 }, mane: { style: 'crest', h: 0.07 }, countershade: 0,
    palette: pal({ body: '#4a3a2e', belly: '#3e3026', mane: '#241c16', nose: '#3a2e28', hoof: '#1d1814' }) },
  anteater: { label: 'Giant Anteater', fam: { stance: 'plantigrade', nose: 'pad', claws: 2.2, toes: 4 }, H: 0.75, len: 1.5, depth: 0.55, width: 0.65, rump: 1.02, tuck: 0.05, neckAng: 15, neckLen: 0.38, neckThk: 0.7,
    headAng: 25, headLen: 0.5, headD: 0.14, headW: 0.16, snout: 0.78, snoutW: 0.35, snoutD: 0.4, stop: 0, eye: 0.022, legThk: 1.1,
    ear: { style: 'round', len: 0.1, w: 1.0, s: 0.12, a: 0.9 }, tail: { style: 'hair', len: 0.75, thk: 0.07, set: -10, hair: 1.15, hairW: 5, hairBack: 0.9 }, pattern: 'anteater', countershade: 0, grain: 2,
    palette: pal({ body: '#5e4e3e', belly: '#d9cfbd', pattern: '#121010', mane: '#4a3c30', nose: '#121010' }) },
  // Digital Diorama revision: a low, rounded body on short legs (it stood on stilts)
  mouse: { label: 'House Mouse', fam: RODENT, H: 0.03, len: 2.4, depth: 0.82, width: 0.85, rump: 1.25, rumpDepth: 1.1, tuck: 0.1, neckAng: 30, neckLen: 0.16, neckThk: 0.9, legThk: 1.15,
    headAng: 20, headLen: 0.55, headD: 0.32, headW: 0.38, snout: 0.45, snoutW: 0.35, snoutD: 0.38, stop: 0.15, eye: 0.09,
    ear: { style: 'round', len: 0.48, w: 0.95, s: 0.22, a: 0.6, spread: 30, tilt: 8, cup: 0.35 }, tail: { style: 'thin', len: 2.0, thk: 0.012, set: -10, curl: 18 },
    countershade: 0.4, palette: pal({ body: '#8d8478', belly: '#c9c0b2', skin: '#e2a8a0', nose: '#e2a8a0', eye: '#0c0a09' }) },
};
const SPECIES = Object.fromEntries(Object.entries(SPECIES_DEFS).map(([k, v]) => {
  const { fam, ...own } = v;
  return [k, mergeDeep(mergeDeep(DEF, fam || {}), own)];
}));
const SPECIES_KEYS = Object.keys(SPECIES);

/** Applies user proportions / style overrides to a species spec (true rebuilds, never uniform scaling). */
function specFor(base, p) {
  // Digital Diorama extension: `specOverride` deep-merges anatomy/palette changes onto the preset
  // (e.g. a Bactrian camel's second hump), so related species can share one rig.
  if (p.specOverride && typeof p.specOverride === 'object') base = mergeDeep(base, p.specOverride);
  const S = mergeDeep(base, {});
  S.ear = { ...base.ear }; S.tail = { ...base.tail };
  const juv = p.age === 'juvenile';
  S.H = base.H * p.size * (juv ? 0.55 : 1) * p.legLen ** 0.5;
  S.depth = base.depth / Math.sqrt(p.legLen);
  S.len = base.len * p.bodyLen / Math.sqrt(p.legLen);
  S.neckLen = base.neckLen * p.neckLen;
  S.headLen = base.headLen * p.headSize * (juv ? 1.3 : 1) * Math.sqrt(p.legLen);
  S.snout = clamp(base.snout * p.muzzleLen * (juv ? 0.8 : 1), 0.15, 0.85);
  S.eye = base.eye * (juv ? 1.25 : 1);
  S.ear.len = base.ear.len * p.earSize * (juv ? 1.15 : 1);
  if (p.earStyle !== 'species') S.ear.style = p.earStyle;
  S.tail.len = (base.tail.len || 0) * p.tailLen;
  if (p.tailStyle !== 'species') { S.tail.style = p.tailStyle; if (!S.tail.len) S.tail.len = 0.4; if (!S.tail.thk && !S.tail.match) S.tail.thk = 0.03; }
  if (p.coatPattern !== 'species') S.pattern = p.coatPattern;
  if (p.countershading >= 0) S.countershade = p.countershading;
  S.seed = p.seed;
  if (juv) { S.horns = S.horns ? { ...S.horns, len: S.horns.len * 0.3 } : S.horns; S.tusks = null; S.mane = S.mane && S.mane.style === 'lion' ? null : S.mane; }
  if (!p.showHorns) S.horns = null;
  if (!p.showTusks) S.tusks = null;
  if (S.wool) S.bumpFn = (u, a) => S.wool * (fbm(Math.cos(a) * 4 + u * 9, Math.sin(a) * 4, u * 7, 5) - 0.5) * 2;
  return S;
}

/* ════════════════════════════════════════════════════════════════════════════
 *  EXPORTED METADATA
 * ════════════════════════════════════════════════════════════════════════════ */
export const COLORWAYS = colorwaysFor(BASE);
export const presets = COLORWAYS;
export const species = Object.fromEntries(SPECIES_KEYS.map(k => [k, SPECIES[k].label]));
export const POSES = ['stand', 'idle', 'walk', 'trot', 'gallop', 'graze', 'alert', 'roar', 'sit'];

export const params = withZones({
  species: { type: 'choice', default: 'horse', options: SPECIES_KEYS, label: 'Species', affects: 'geometry', describe: 'Species preset (43 mammals).' },
  colorway: { type: 'choice', default: 'natural', options: COLORWAY_KEYS, label: 'Colourway', affects: 'colors', describe: 'Role-aware transform of the species palette.' },
  detail: { type: 'choice', default: 'standard', options: Object.keys(DETAIL), label: 'Detail', affects: 'geometry', describe: 'Loft resolution (draft / standard / high).' },
  rigMode: { type: 'choice', default: 'skinned', options: ['skinned', 'static'], label: 'Rig mode', affects: 'geometry', describe: 'Skinned meshes with a skeleton, or pose baked into static geometry.' },
  pose: { type: 'choice', default: 'stand', options: POSES, label: 'Pose', affects: 'geometry', describe: 'Rest pose or a frozen frame of a clip.' },
  posePhase: { type: 'range', default: 0.25, min: 0, max: 1, step: 0.01, label: 'Pose phase', affects: 'geometry', describe: 'Clip phase used for the frozen pose.' },
  size: { type: 'range', default: 1, min: 0.5, max: 1.6, step: 0.01, label: 'Size', affects: 'geometry', describe: 'Overall body scale (rebuilds every station).' },
  age: { type: 'choice', default: 'adult', options: ['adult', 'juvenile'], label: 'Age', affects: 'geometry', describe: 'Juveniles: smaller, bigger head, eyes and ears, no tusks / mane.' },
  bodyLen: { type: 'range', default: 1, min: 0.75, max: 1.35, step: 0.01, label: 'Body length', affects: 'geometry', describe: 'Torso length multiplier.' },
  legLen: { type: 'range', default: 1, min: 0.7, max: 1.4, step: 0.01, label: 'Leg length', affects: 'geometry', describe: 'Leg length vs body depth.' },
  neckLen: { type: 'range', default: 1, min: 0.5, max: 1.6, step: 0.01, label: 'Neck length', affects: 'geometry', describe: 'Neck length multiplier.' },
  headSize: { type: 'range', default: 1, min: 0.75, max: 1.35, step: 0.01, label: 'Head size', affects: 'geometry', describe: 'Skull length multiplier.' },
  muzzleLen: { type: 'range', default: 1, min: 0.6, max: 1.5, step: 0.01, label: 'Muzzle length', affects: 'geometry', describe: 'Snout fraction of the skull.' },
  earSize: { type: 'range', default: 1, min: 0.5, max: 1.8, step: 0.01, label: 'Ear size', affects: 'geometry', describe: 'Pinna length multiplier.' },
  earStyle: { type: 'choice', default: 'species', options: ['species', ...Object.keys(EAR_PROFILES)], label: 'Ear style', affects: 'geometry', describe: 'Ear outline / carriage override.' },
  tailLen: { type: 'range', default: 1, min: 0, max: 2, step: 0.01, label: 'Tail length', affects: 'geometry', describe: 'Tail length multiplier.' },
  tailStyle: { type: 'choice', default: 'species', options: ['species', 'thin', 'bushy', 'tuft', 'hair', 'flat', 'fluffy', 'curly', 'none'], label: 'Tail style', affects: 'geometry', describe: 'Tail style override.' },
  coatPattern: { type: 'choice', default: 'species', options: ['species', 'none', 'stripes', 'tiger', 'spots', 'hyena', 'rosettes', 'giraffe', 'patches', 'panda', 'raccoon', 'badger', 'tabby', 'anteater', 'chipmunk'], label: 'Coat pattern', affects: 'colors', describe: 'Coat pattern override.' },
  countershading: { type: 'range', default: -1, min: -1, max: 1, step: 0.01, label: 'Countershading', affects: 'colors', describe: '-1 keeps the species value; 0..1 sets how far the light belly climbs the flank.' },
  seed: { type: 'range', default: 7, min: 1, max: 999, step: 1, label: 'Variation seed', affects: 'colors', describe: 'Seed for spots, stripes and quills.' },
  showHorns: { type: 'toggle', default: true, label: 'Horns / antlers', affects: 'geometry', describe: 'Build horns, antlers and ossicones.' },
  showTusks: { type: 'toggle', default: true, label: 'Tusks', affects: 'geometry', describe: 'Build tusks.' },
  coat: { type: 'toggle', default: true, label: 'Painted coat', affects: 'colors', describe: 'Paint markings into a coat texture (crisp stripes, spots and patch edges); off: one colour per mesh face.' },
  coatGrain: { type: 'range', default: 0.06, min: 0, max: 0.25, step: 0.01, label: 'Coat grain', affects: 'colors', describe: 'Faint tonal variation in fur or feathers (painted coat only).' },
  shading: { type: 'choice', default: 'smooth', options: ['smooth', 'flat'], label: 'Shading', affects: 'geometry', describe: 'Smooth, rounded shading or flat low-poly facets.' },
  hide: { type: 'text', default: '', label: 'Hide parts', affects: 'geometry', describe: 'Comma list of detachable parts to omit (see `detach`).' },
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'One mesh per material (1-2 draw calls) instead of one selectable mesh per anatomical part.' },
}, ZONE_LABELS, BASE);

export const rig = {
  Hips: { axis: 'x', range: [-30, 20], describe: 'pelvis pitch (sit / rear)' },
  Spine1: { axis: 'x', range: [-15, 15] }, Spine2: { axis: 'x', range: [-15, 15] }, Chest: { axis: 'x', range: [-20, 15] },
  Neck1: { axis: 'x', range: [-30, 45], describe: 'neck raise / lower' }, Neck2: { axis: 'x', range: [-25, 35] },
  Head: { axis: 'x', range: [-35, 40], describe: 'nod' }, Jaw: { axis: 'x', range: [0, 35], describe: 'mouth open' },
  EarL: { axis: 'z', range: [-30, 30], describe: 'ear swivel' }, EarR: { axis: 'z', range: [-30, 30] },
  ScapulaL: { axis: 'x', range: [-25, 25] }, ArmL: { axis: 'x', range: [-50, 40] }, ForearmL: { axis: 'x', range: [0, 120] }, HandL: { axis: 'x', range: [-20, 90] },
  ThighL: { axis: 'x', range: [-60, 40] }, ShinL: { axis: 'x', range: [-20, 120] }, FootL: { axis: 'x', range: [-90, 30] },
  Tail1: { axis: 'y', range: [-30, 30], describe: 'tail swish' }, Trunk1: { axis: 'x', range: [-40, 60], describe: 'trunk curl' },
};
export const detach = ['horns', 'tusks', 'trunk', 'mane', 'tail', 'ears', 'eyes', 'eyelids', 'nose', 'teeth', 'spines', 'jaw', 'feet', 'udder'];
export const night = { eye: { color: '#9cff6a', intensity: 0.35, describe: 'tapetum eyeshine on the iris zone' } };

/* ════════════════════════════════════════════════════════════════════════════
 *  CLIPS & POSES
 * ════════════════════════════════════════════════════════════════════════════ */
const GAITS = {
  walk: { ph: { LH: 0, LF: 0.25, RH: 0.5, RF: 0.75 }, duty: 0.62, amp: 17, flex: 45, dur: 1.15, bob: 0.012, spine: 2 },
  trot: { ph: { LF: 0, RH: 0, RF: 0.5, LH: 0.5 }, duty: 0.45, amp: 24, flex: 62, dur: 0.72, bob: 0.02, spine: 3 },
  gallop: { ph: { LH: 0, RH: 0.1, LF: 0.42, RF: 0.52 }, duty: 0.34, amp: 34, flex: 80, dur: 0.52, bob: 0.035, spine: 9 },
};
const RIGS = new WeakMap();

function sampleFor(info, name, u) {
  const s = {}, H = info.H;
  const add = (b, r) => { if (!info.has[b]) return; const v = s[b] || [0, 0, 0]; s[b] = [v[0] + r[0], v[1] + r[1], v[2] + r[2]]; };
  const tail = (amp, f = 1, lift = 0) => info.tail.forEach((b, i) => add(b, [-lift / info.tail.length, Math.sin(TAU * (u * f) - i * 0.6) * amp / info.tail.length, 0]));
  const ears = (a) => { add('EarL', [0, 0, a]); add('EarR', [0, 0, -a]); };
  if (GAITS[name]) {
    const G = GAITS[name];
    for (const lm of info.limbs) {
      const key = (lm.side > 0 ? 'L' : 'R') + (lm.front ? 'F' : 'H');
      const ph = fract(u - G.ph[key]);
      let sw, fl;
      if (ph < G.duty) { sw = lerp(1, -1, ph / G.duty); fl = 0; }
      else { const t = (ph - G.duty) / (1 - G.duty); sw = lerp(-1, 1, sstep(0, 1, t)); fl = Math.sin(Math.PI * t); }
      const b = lm.bones, A = G.amp, F = G.flex;
      if (lm.front) {
        if (lm.st === 'plantigrade' || lm.st === 'graviportal' || lm.st === 'digitigrade') {
          add(b[0], [-sw * A * 0.3, 0, 0]); add(b[1], [-sw * A * 0.55 - fl * F * 0.25, 0, 0]); add(b[2], [fl * F * 0.75, 0, 0]); if (b[3]) add(b[3], [fl * F * 0.35, 0, 0]);
        } else {
          add(b[0], [-sw * A * 0.3, 0, 0]); add(b[1], [-sw * A * 0.5 - fl * F * 0.3, 0, 0]); add(b[2], [fl * F * 0.95, 0, 0]); if (b[3]) add(b[3], [fl * F * 0.45, 0, 0]);
        }
      } else {
        add(b[0], [-sw * A * 0.75 - fl * F * 0.25, 0, 0]); add(b[1], [fl * F * 0.7, 0, 0]); if (b[2]) add(b[2], [-fl * F * 0.55, 0, 0]);
      }
    }
    const c = Math.cos(TAU * u * 2);
    add('Root', [0, 0, 0]); s.Root = { r: [0, 0, 0], p: [0, -G.bob * H * (0.5 + 0.5 * c), 0] };
    add('Spine1', [Math.sin(TAU * u) * G.spine * (name === 'gallop' ? 1 : 0.3), 0, 0]); add('Chest', [-Math.sin(TAU * u) * G.spine * (name === 'gallop' ? 1 : 0.3), 0, 0]);
    add('Neck1', [c * G.spine * 0.6, 0, 0]); add('Head', [-c * G.spine * 0.4, 0, 0]);
    tail(name === 'gallop' ? 6 : 14, 1, name === 'gallop' ? 25 : 0);
    return s;
  }
  switch (name) {
    case 'idle': {
      const br = Math.sin(TAU * u);
      add('Spine2', [br * 0.8, 0, 0]); add('Chest', [-br * 0.6, 0, 0]); add('Neck1', [Math.sin(TAU * u + 1) * 2, Math.sin(TAU * u * 0.5) * 6, 0]); add('Head', [Math.sin(TAU * u * 2) * 1.5, Math.sin(TAU * u * 0.5) * 4, 0]);
      ears(Math.max(0, Math.sin(TAU * u * 3)) * 10); tail(18, 1); if (info.has.Trunk1) info.trunk.forEach((b, i) => add(b, [Math.sin(TAU * u - i * 0.7) * 6, 0, Math.sin(TAU * u * 0.5 - i) * 4]));
      break;
    }
    case 'graze': {
      const nb = Math.sin(TAU * u * 2) * 2;
      add('Neck1', [info.longNeck ? 38 : 28 + nb, 0, 0]); add('Neck2', [info.longNeck ? 22 : 18, 0, 0]); add('Head', [12 - nb, 0, 0]); add('Jaw', [Math.max(0, Math.sin(TAU * u * 4)) * 8, 0, 0]);
      add('Chest', [6, 0, 0]); ears(-8); tail(10, 1);
      for (const lm of info.limbs) if (lm.front) { add(lm.bones[1], [-6, 0, 0]); add(lm.bones[2], [6, 0, 0]); }
      break;
    }
    case 'alert': add('Neck1', [-14, 0, 0]); add('Neck2', [-6, 0, 0]); add('Head', [-8, Math.sin(TAU * u) * 10, 0]); ears(-14); tail(3, 1, 15); if (info.has.Trunk1) info.trunk.forEach((b) => add(b, [-14, 0, 0])); break;
    case 'roar': {
      const o = sstep(0, 0.3, u) * (1 - sstep(0.75, 1, u));
      add('Neck1', [-12 * o, 0, 0]); add('Head', [-14 * o, 0, 0]); add('Jaw', [32 * o, 0, 0]); ears(-20 * o); add('Chest', [-4 * o, 0, 0]);
      if (info.has.Trunk1) info.trunk.forEach((b) => add(b, [-24 * o, 0, 0]));
      tail(8, 2, 10 * o);
      break;
    }
    case 'sit': {
      const t = sstep(0, 0.5, u), pitch = (info.hindHigh ? 22 : 34) * t, dz = info.hipToShoulder;
      s.Root = { r: [0, 0, 0], p: [0, -dz * Math.sin(pitch * DEG) * 0.95, -dz * (1 - Math.cos(pitch * DEG))] };
      add('Hips', [-pitch, 0, 0]); add('Neck1', [pitch * 0.5, 0, 0]); add('Head', [pitch * 0.3, 0, 0]);
      for (const lm of info.limbs) {
        if (lm.front) { add(lm.bones[0], [pitch, 0, 0]); continue; }
        add(lm.bones[0], [-62 * t, 0, 0]); add(lm.bones[1], [118 * t, 0, 0]); if (lm.bones[2]) add(lm.bones[2], [-48 * t, 0, 0]);
      }
      tail(4, 1, -20 * t);
      break;
    }
    default: break;
  }
  return s;
}
const CLIP_SPEC = { idle: [3.2, 49, true], walk: [1.15, 33, true], trot: [0.72, 25, true], gallop: [0.52, 21, true], graze: [2.4, 37, true], alert: [2.2, 33, true], roar: [1.8, 37, false], sit: [1.6, 25, false] };

/** Builds every clip for an asset made by createAsset (skinned mode). */
export function createClips(asset) {
  const R = RIGS.get(asset); if (!R) return [];
  const k = Math.sqrt(R.info.H / 1.5);
  return Object.entries(CLIP_SPEC).map(([n, [d, f, loop]]) => bakeClip(R.info, n, GAITS[n] ? d * clamp(k, 0.45, 1.6) : d, f, (u) => sampleFor(R.info, n, u), loop));
}
/** Poses a skinned asset at a clip phase (no mixer needed). */
export function setPose(asset, name = 'stand', phase = 0) {
  const R = RIGS.get(asset); if (!R) return;
  applySample(R.rig, name === 'stand' ? {} : sampleFor(R.info, name, clamp(phase, 0, 1)));
  asset.updateMatrixWorld(true);
}

/* ════════════════════════════════════════════════════════════════════════════
 *  ASSET
 * ════════════════════════════════════════════════════════════════════════════ */
export function createAsset(input = {}) {
  const p = normalize(input);
  const base = SPECIES[p.species] || SPECIES.horse;
  const S = specFor(base, p);
  const det = DETAIL[p.detail] ?? 1;
  const rigB = new Rig(), parts = [], byName = new Map();
  const coatOn = p.coat !== false;
  const B = { det, rig: rigB, parts, paint: null,
    part(name, opt = {}) { if (!byName.has(name)) { const pt = new Part(name, opt); pt.coat = coatOn && !pt.glass; byName.set(name, pt); parts.push(pt); } return byName.get(name); } };
  const L = tetraLayout(S);
  tetraTorso(B, S, L);
  B.paint = makePainter(S, L);
  tetraLimbLayout(B, S, L);
  tetraLimbBones(B, L);
  tetraHead(B, S, L);
  emit(B.part('body', { group: 'body' }), L.torso, (u, a, P) => B.paint({ part: u > L.uOf.neckRoot ? 'neck' : 'torso', u, a, P }), tetraTorsoSkin(B, L));
  tetraLimbs(B, S, L);
  tetraTail(B, S, L);
  tetraHorns(B, S, L);
  tetraTusks(B, S, L);
  tetraTrunk(B, S, L);
  tetraMane(B, S, L);
  tetraQuills(B, S, L);
  tetraUdder(B, S, L);

  const hidden = new Set(String(p.hide || '').split(',').map(s => s.trim()).filter(Boolean));
  const keep = (pt) => !hidden.has(pt.name) && !hidden.has(pt.group) && !(hidden.has('feet') && pt.group === 'feet');
  const build = { rig: rigB, parts: parts.filter(keep) };
  const zones = zonesFor(p.colorway, p, S.palette);

  const info = {
    H: S.H, bones: rigB.list.map(e => e.name), has: Object.fromEntries(rigB.list.map(e => [e.name, true])),
    rest: Object.fromEntries(rigB.list.map(e => [e.name, (e.parent ? e.head.clone().sub(e.parent.head) : e.head.clone()).toArray()])),
    moving: ['Root'], scaled: [],
    limbs: L.limbs.map(lm => ({ front: lm.front, side: lm.side, bones: lm.bones, st: lm.st })),
    tail: rigB.list.filter(e => /^Tail\d/.test(e.name)).map(e => e.name), trunk: rigB.list.filter(e => /^Trunk\d/.test(e.name)).map(e => e.name),
    longNeck: S.neckLen > 0.45, hindHigh: S.rump > 1.1,
    hipToShoulder: rigB.head('Chest').distanceTo(rigB.head('Hips')),
  };
  const pose = p.pose !== 'stand' ? sampleFor(info, p.pose, p.posePhase) : null;
  const coat = { res: COAT_RES[p.detail] ?? COAT_RES.standard, grain: p.coatGrain * (S.grain ?? 1), grainOf: (z) => ZONE_ROLES[z] === 'body', smooth: p.shading !== 'flat' };
  const { root, skeleton } = finish(build, { name: `mammal-${p.species}`, merge: p.mergeForProduction, skinned: p.rigMode === 'skinned', zones, pose, coat: coatOn || coat.smooth ? coat : null });
  let tris = 0; root.traverse(m => { if (m.isMesh) tris += m.geometry.attributes.position.count / 3; });
  root.userData = {
    species: p.species, label: S.label, params: p, dimensions: measure(root), triangles: tris, zones: Object.fromEntries(Object.entries(zones).map(([k, v]) => [k, hexStr(v)])),
    bones: info.bones, parts: build.parts.map(pt => pt.name), stance: S.stance,
  };
  RIGS.set(root, { rig: rigB, info, skeleton });
  return root;
}

export default createAsset;
