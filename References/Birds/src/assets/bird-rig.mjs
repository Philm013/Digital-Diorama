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
 *
 * REVISION (Digital Diorama: realism)
 *   - Coat atlas: the plumage painter is rasterised into one texture per asset instead of one
 *     colour per quad, so caps, masks, bars and breast patches have smooth edges (see COAT ATLAS).
 *   - Smooth, crease-aware normals and glossy eyes. Options: coat, coatGrain, shading.
 *
 * REVISION 8 (Digital Diorama: planted feet)
 *   - The walk plants its feet: each toe tip stays put through the stance (the heel rolling up onto it at the
 *     end), then the foot is picked up, carried forward with its toes hanging and set down flat. The hip
 *     (protraction, retraction and abduction), knee and intertarsal joint reach it by inverse kinematics,
 *     the pelvis rolls and yaws by family (waddling waterfowl and penguins), and the head keeps its attitude,
 *     head-bobbers holding it still between thrusts. Stride and timing follow the leg (WALK_STYLE).
 *   - The walk clip carries { gait, stride, speed, hipH } like the mammals' gaits, so the app plays it at the
 *     rate that keeps the feet still (they slid about 1.8 hip heights a step).
 *   - Toes rest on the ground instead of 2-30 mm in it (ostrich, turkey, penguin worst).
 *
 * REVISION 10 (Digital Diorama: postures, faces and proportions checked against the species photos)
 *   - Perching birds stood like vultures, the body near level and the head hung forward of the chest on a forward neck.
 *     Raptors, parrots, the cockatoo, hornbill and toucan now stand upright (pitch 44-60°), the eagle and falcon with the
 *     head carried over the chest on an upright neck, and long tails raised to clear the ground.
 *   - Bills: the eagle's, falcon's, macaw's and cockatoo's were a third too big (the eagle's drooped like a toucan's).
 *   - Owls: the eyes were placed on the skull's middle ring, which a short, flat face does not reach forward, so they
 *     looked out sideways like a frog's from behind a parrot's bill; they now sit forward in the facial disc (`eyeU`), bigger,
 *     over a small bill.
 *   - The albatross has a short thick neck (it was a goose's), the pelican's neck is drawn into an S over a bigger body, and
 *     the ostrich's body is a big plumed mass instead of a small bag on long legs.
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
  // Digital Diorama revision: a painted loft becomes a coat-atlas patch (see COAT ATLAS)
  const pt = part.coat && typeof zone === 'function' ? loftPatch(g, zf) : null, T = pt && pt.t, L0 = pt ? pt.lead : 0;
  const ctr = V3();
  const kEnd = g.closed ? nr : nr - 1;
  for (let k = 0; k < kEnd; k++) {
    const k1 = (k + 1) % nr, uk = us[k], uk1 = g.closed && k1 === 0 ? 1 : us[k1];
    const t0 = pt ? T[k + L0] : 0, t1 = pt ? T[k + 1 + L0] : 0;
    for (let j = 0; j < R; j++) {
      const j1 = (j + 1) % R, A = rows[k][j], B = rows[k1][j], Cc = rows[k1][j1], D = rows[k][j1], s0 = j / R, s1 = (j + 1) / R;
      // One zone per quad for the flat-colour fallback; painted lofts are rasterised into the coat atlas,
      // so their patterns follow the surface (u, a) space instead of the mesh grid.
      ctr.copy(A).add(B).add(Cc).add(D).multiplyScalar(0.25);
      const zn = zf((uk + uk1) / 2, ((j + 0.5) / R) * TAU, ctr);
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
  for (const part of parts) for (const pt of part.pt) if (pt && !seen.has(pt)) { seen.add(pt); pt.k = part.coatK || 1; pt.gloss = part.name === 'eyes' ? 0.2 : 1; patches.push(pt); }
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
  if (crease) {
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
    // (Digital Diorama revision 8: other parts that meet along a shared row, such as the elephant's face and trunk)
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
  const tl = T.len * L, nT = T.n ?? 10, tpart = B.part('tail', { group: 'tail', coatK: 1.6 });
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
    const wpart = B.part('wings', { group: 'wingSpread', coatK: 3 });
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
      th: (u, v) => bodyH * 0.06 * (1 - 0.6 * u), zone: (u, v, face, Pp) => paint({ part: 'fold', u, a: v, P: Pp || shoulderY }), skin: rig.W('WingFold' + sfx) });
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
    // Digital Diorama revision 8: the toes rest on the ground rather than in it. Their roots ran along the Toe bone's
    // head (1.2 % of the body length up) at a radius of up to 4 % of it, the tarsus ended there in a round cap, and the
    // talons hooked below the ground, so every bird stood sunk 2-30 mm (ostrich, turkey and penguin the most). They now
    // start from a point raised by the toe's radius; the bone stays where it was.
    const F = S.feet, toeL = (S.toeLen ?? 0.28) * L, tr = lr * 0.8;
    const base = foot.clone(); base.y = Math.max(foot.y, tr * 1.04);
    const tar = loft({ pts: [ankle, ankle.clone().lerp(base, 0.5), base], seg: Math.round(7 * det), rad: 2 * Math.round(3 * det + 2), up: [0, 0, 1], w: (u) => tarR(u) * 0.86, ht: tarR, hb: tarR, cap0: { type: 'round', len: 0.4 }, cap1: { type: 'round', len: 0.5 }, bend: 0.3 });
    emit(lp, tar, (u) => S.feathered && u < 0.62 ? paint({ part: 'thigh', u: 1, a: 0, P: ankle }) : 'leg', rig.W('Tarsus' + sfx));
    // foot pad hides the toe convergence
    emit(fpart, ellipsoid(V3(foot.x, Math.max(foot.y + tr * 0.5, tr * 1.1), foot.z), tr * 1.45, tr * 1.05, tr * 1.6, [0, 0, 1], [0, 1, 0], 4, 8), 'leg', rig.W('Toe' + sfx));
    const dirs = F === 'zygo' ? [[-0.35, 1], [0.15, 1], [-2.8, 0.75], [2.6, 0.6]] : F === 'ratite' ? [[0.08, 1.2], [0.6, 0.75]] : [[-0.55, 0.9], [0, 1], [0.55, 0.9], [Math.PI, F === 'webbed' ? 0.3 : 0.6]];
    const tips = [];
    for (const [ang, k] of dirs) {
      const d = V3(Math.sin(ang * sd), 0, Math.cos(ang)), e = foot.clone().addScaledVector(d, toeL * k); e.y = tr * 0.8;
      tips.push(e);
      emit(fpart, tube([base, base.clone().lerp(e, 0.5).add(V3(0, tr * 0.6, 0)), e], (u) => tr * (1 - 0.35 * u), 4, 5, { cap1: { type: 'round', len: 0.7 } }), 'leg', rig.W('Toe' + sfx));
      if (S.talons) emit(fpart, tube([e, e.clone().addScaledVector(d, tr * S.talons * 1.4).add(V3(0, tr * 0.5, 0)), e.clone().addScaledVector(d, tr * S.talons * 2.2).add(V3(0, Math.max(-tr * 1.2, tr * 0.06 - e.y), 0))], (u) => tr * 0.55 * (1 - u * 0.9), 4, 4, { cap1: 'point' }), 'beak', rig.W('Toe' + sfx));
    }
    if (F === 'webbed') sheet(fpart, { nu: 2, nv: 6, f: (u, v) => { const x = v * 2, i = Math.min(1, Math.floor(x)), t = x - i; return base.clone().lerp(tips[i].clone().lerp(tips[i + 1], t), u * (1 - 0.25 * Math.sin(Math.PI * t) * u)); }, th: tr * 0.25, zone: 'leg', skin: rig.W('Toe' + sfx) });
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
    // Digital Diorama revision: black-streaked brown back and edged wing feathers
    marks: { back: 'streaks', wing: 'edged', zone: 'face', light: 'accent', freq: 1.3 },
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
    // Digital Diorama revision: pale grey wings with two black bars (not dark bands), green-purple sheen only on the lower neck
    pattern: { neck: 'accent', wingBands: false }, marks: { wing: 'bars', zone: 'flight', freq: 0.45 },
    palette: BP('#8d949c', '#b5b9bd', '#a5abb1', '#3d4148', '#7e858d', '#d8d5c8', '#5b7d72', '#4a4b50', '#c66f75', '#e86f44') },
  woodpecker: { label: 'Great Spotted Woodpecker', sci: 'Dendrocopos major', bodyForm: 'corvid', skullForm: 'corvid', L: 0.15, pitch: 50, bodyH: 0.56, bodyW: 0.54, headR: 0.22, neckLen: 0.12, neckThin: 0.72,
    beak: { len: 1.65, w: 0.22, h: 0.25, style: 'cone' }, eye: 0.16, feet: 'zygo', legLen: 0.18, crest: { h: 0.45, style: 'peak', base: 0.25, thk: 0.12, sweep: 22 }, wing: { span: 1.85, chord: 0.6, tip: 'round', fold: 0.34 }, tail: { len: 0.9, fan: 20, n: 10, style: 'wedge', lift: 35 },
    pattern: { mask: 'face', maskShape: 'stripe', wingBar: true, cheek: 'belly' }, marks: { wing: 'spots', tail: 'bars', light: 'belly', zone: 'body', freq: 1.2 },
    palette: BP('#171719', '#eeeae0', '#202024', '#f0ece2', '#171719', '#171719', '#d12b27', '#343338', '#65616a', '#a13b32') },
  kingfisher: { label: 'Common Kingfisher', sci: 'Alcedo atthis', bodyForm: 'songbird', skullForm: 'wader', L: 0.14, pitch: 28, bodyH: 0.54, bodyW: 0.58, headR: 0.25, neckLen: 0.08, neckThin: 0.8,
    beak: { len: 2.25, w: 0.2, h: 0.22, style: 'cone' }, eye: 0.17, legLen: 0.12, wing: { span: 1.65, chord: 0.55, tip: 'round', fold: 0.35 }, tail: { len: 0.35, fan: 26, n: 8 },
    pattern: { headAll: true, face: 'belly', breast: 'accent' }, palette: BP('#147da0', '#e8a14d', '#1687ad', '#205c79', '#146e91', '#f0e5d0', '#d97f32', '#25292c', '#c56d52', '#2a1b12') },
  macaw: { label: 'Scarlet Macaw', sci: 'Ara macao', bodyForm: 'parrot', L: 0.26, pitch: 50, bodyH: 0.55, headR: 0.28, headAng: 20, neckLen: 0.14, neckThin: 0.8, maskW: 0.5, maskWBill: 0.8, beak: { len: 0.85, w: 0.55, h: 1.0, style: 'hook', hook: 0.42, lower: 0.62, lowerStyle: 'scoop', keel: 0.15, y: 0.05 }, feet: 'zygo', legLen: 0.18,
    wing: { span: 1.9, chord: 0.62, tip: 'pointed', fold: 0.55 }, tail: { len: 2.8, fan: 16, n: 8, style: 'long', lift: 45 }, eye: 0.16, pattern: { face: 'face', faceU: 0.5, faceTop: 0.8, faceSlope: 0.25, mask: 'face', maskShape: 'stripe', wingBands: true, tail: 'body' },
    palette: BP('#d8241e', '#d8241e', '#f2c21a', '#2a5ad8', '#d8241e', '#f2ede6', '#2a8a3a', '#efe6d0', '#5a5a60', '#e8e0b0', { flight: '#2a5ad8', jaw: '#1d1a1a' }),
    // Digital Diorama revision 10: checked against the species photo (posture, bill and proportions)
    pitch: 56, beak: { len: 0.74, w: 0.5, h: 0.88, style: 'hook', hook: 0.42, lower: 0.62, lowerStyle: 'scoop', keel: 0.15, y: 0.05 },
    // (revision 10) the tail raised to clear the ground under the more upright body
    tail: { len: 2.8, fan: 16, n: 8, style: 'long', lift: 51 },
    // (revision 10)
    tail: { len: 2.8, fan: 16, n: 8, style: 'long', lift: 53 }, },
  // Digital Diorama revision: eyes set into the facial disc (huge bulging black eyes), barred underparts, mottled back
  owl: { label: 'Great Horned Owl', sci: 'Bubo virginianus', bodyForm: 'owl', L: 0.32, pitch: 72, bodyH: 0.85, bodyW: 0.8, neckLen: 0.08, headR: 0.44, headW: 1.0, headAng: -4, eye: 0.22, eyeYaw: 16, eyeInset: 0.55, eyeRing: 0.4,
    marks: { belly: 'bars', back: 'streaks', wing: 'bars', tail: 'bars', freq: 1.6, zone: 'accent', light: 'face' },
    beak: { len: 0.32, w: 0.22, h: 0.3, style: 'hook', hook: 0.5, y: 0.25 }, crest: { h: 0.75, n: 2, style: 'tuft', thk: 0.16, curl: -0.3, pair: true }, feet: 'zygo', talons: 1.4, feathered: true, legLen: 0.12, fluff: 0.05,
    wing: { span: 1.9, chord: 0.75, tip: 'round', fold: 0.25 }, tail: { len: 0.6, fan: 40, n: 10, lift: 35 }, pattern: { mask: 'face', throat: 'belly', barred: true },
    palette: BP('#7a5e40', '#c9b08a', '#6a5034', '#4a3a28', '#7a5e40', '#d8b88a', '#3a2c1e', '#3a3632', '#c9b08a', '#f2a81a'),
    // Digital Diorama revision 10: checked against the species photo (posture, bill and proportions)
    eye: 0.3, eyeYaw: 10, beak: { len: 0.2, w: 0.15, h: 0.2, style: 'hook', hook: 0.5, y: 0.2 },
    // (revision 10) the eyes looked out sideways from the middle of the skull: they sit forward in the flat facial disc
    eyeU: 0.84, eyeInset: 0.5, },
  eagle: { label: 'Bald Eagle', sci: 'Haliaeetus leucocephalus', bodyForm: 'raptor', L: 0.45, pitch: 35, headR: 0.24, beak: { len: 1.05, w: 0.42, h: 0.62, style: 'hook', hook: 0.42 }, eye: 0.15, eyeYaw: 50, talons: 1.6, feathered: true, legLen: 0.22,
    wing: { span: 2.4, chord: 0.75, tip: 'slotted', fold: 0.45 }, tail: { len: 0.75, fan: 36, n: 12 }, pattern: { headAll: true, neck: 'head', tail: 'head' },
    palette: BP('#3a2a1c', '#3e2e20', '#3a2a1c', '#2a1e14', '#f4f2ec', '#f4f2ec', '#f4f2ec', '#f2c21a', '#f2c21a', '#f2d24a'),
    // Digital Diorama revision 10: checked against the species photo (posture, bill and proportions)
    pitch: 56, neckLen: 0.16, beak: { len: 0.84, w: 0.4, h: 0.56, style: 'hook', hook: 0.36 },
    // (revision 10) the head carried over the chest on an upright neck, as perched raptors hold it
    neckAng: 84, headAng: 0, },
  falcon: { label: 'Peregrine Falcon', sci: 'Falco peregrinus', bodyForm: 'raptor', L: 0.38, pitch: 34, bodyH: 0.55, bodyW: 0.54, headR: 0.22, neckLen: 0.14, neckThin: 0.68,
    beak: { len: 0.72, w: 0.34, h: 0.5, style: 'hook', hook: 0.55 }, eye: 0.16, eyeYaw: 48, talons: 1.55, feathered: true, legLen: 0.24, wing: { span: 2.85, chord: 0.52, tip: 'pointed', fold: 0.62, sweep: 0.25 }, tail: { len: 0.78, fan: 28, n: 10 },
    // Digital Diorama revision: a black hood and moustache over a white throat and cheek, finely barred underparts
    pattern: { mask: 'face', throat: 'belly', cheek: 'belly', barred: true }, maskR: 0.5, marks: { belly: 'bars', back: 'bars', tail: 'bars', freq: 3.2, barW: 0.13, zone: 'accent', throatPlain: true },
    palette: BP('#5a6672', '#f0ebe0', '#4f5a66', '#2a3036', '#262b31', '#171b20', '#4a5058', '#60636a', '#e3b52b', '#33251a'),
    // Digital Diorama revision 10: checked against the species photo (posture, bill and proportions)
    pitch: 56, headR: 0.2, beak: { len: 0.56, w: 0.32, h: 0.46, style: 'hook', hook: 0.5 },
    // (revision 10) the head carried over the chest on an upright neck, as perched raptors hold it
    neckAng: 84, headAng: 0, },
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
    pattern: { neck: 'head', forehead: 'accent', cheek: 'face', headAll: true }, marks: { back: 'scaled', wing: 'edged', zone: 'flight', light: 'belly', freq: 0.9 },
    palette: BP('#97948c', '#b8b5ae', '#8f8c84', '#3a3b3d', '#9a9b96', '#e8e0d2', '#b92f2c', '#565453', '#333638', '#c9883b') },
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
    beak: { len: 0.82, w: 0.28, h: 0.78, style: 'big', decurve: 0.12, tip: 'face', tipFrom: 0.75 }, eye: 0.15, feet: 'webbed', legLen: 0.1, wing: { span: 1.45, chord: 0.48, tip: 'pointed', fold: 0.3 }, tail: { len: 0.22, fan: 30, n: 8 },
    pattern: { headAll: true, face: 'belly', bellyFront: true }, palette: BP('#1b2024', '#f0eee5', '#22282d', '#31363b', '#171a1d', '#ded9ca', '#e46d35', '#e8832f', '#e36b3d', '#59402d') },
  penguin: { label: 'Emperor Penguin', sci: 'Aptenodytes forsteri', bodyForm: 'penguin', L: 0.78, pitch: 84, bodyH: 0.52, bodyW: 0.5, legLen: 0.03, thigh: 0.12, footFwd: 0.2, heelAng: 40, bareTibia: 0, thighK: 1.7, groundClear: 0.01, legThk: 0.05, neckLen: 0.14, neckAng: 85, headR: 0.17, headAng: 10, beak: { len: 1.5, w: 0.3, h: 0.32, style: 'cone', curve: -0.4 }, eye: 0.12,
    feet: 'webbed', toeLen: 0.12, wing: { span: 0.62, chord: 0.24, tip: 'round', fold: 0.0, foldH: 0.6, foldReach: 0.55 }, tail: { len: 0.12, fan: 30, n: 6 }, pattern: { headAll: true, neck: 'head', face: 'face', bellyFront: true },
    palette: BP('#1d2228', '#f4f2ea', '#1d2228', '#1d2228', '#15181c', '#f2b23a', '#f2b23a', '#1d1d20', '#1d1d20', '#1a120a', { jaw: '#e8923a' }) },
  ostrich: { label: 'Ostrich', sci: 'Struthio camelus', bodyForm: 'ratite', L: 0.72, pitch: 12, bodyH: 0.72, bodyW: 0.68, legLen: 1.0, thigh: 0.9, legThk: 0.075, thighK: 1.25, heelAng: 10, neckLen: 1.25, neckAng: 78, neckThin: 0.5, neckRootR: 0.26,
    neckShape: [[0, 64], [0.4, 84], [0.8, 92], [1, 86]], headR: 0.13, headAng: 6, beak: { len: 1.6, w: 0.55, h: 0.32, style: 'flat' }, eye: 0.3,
    feet: 'ratite', toeLen: 0.28, wing: { span: 0.75, chord: 0.45, tip: 'round', fold: 0.15 }, tail: { len: 0.4, fan: 60, n: 10, droop: 0.3 }, fluff: 0.06, pattern: { neck: 'face', thigh: 'leg', headAll: true },
    palette: BP('#1d1b1a', '#1d1b1a', '#1d1b1a', '#f2f0ea', '#c8a49a', '#d8b0a4', '#f2f0ea', '#c89a7a', '#d8a098'),
    // Digital Diorama revision 10: checked against the species photo (posture, bill and proportions)
    L: 0.95, legLen: 0.78, thigh: 0.72, neckLen: 1.0, bodyH: 0.74, bodyW: 0.72, },
  kiwi: { label: 'North Island Brown Kiwi', sci: 'Apteryx mantelli', bodyForm: 'ratite', skullForm: 'wader', L: 0.35, pitch: 22, bodyH: 0.78, bodyW: 0.72, legLen: 0.32, thigh: 0.65, legThk: 0.065, neckLen: 0.2, neckAng: 55, headR: 0.16, headW: 0.78,
    beak: { len: 3.1, w: 0.18, h: 0.2, style: 'cone', curve: 0.12 }, eye: 0.13, feet: 'ratite', toeLen: 0.42, wing: { span: 0.12, chord: 0.12, tip: 'round', fold: 0, foldLength: 0.14, foldH: 0.2 }, tail: { len: 0, fan: 20, n: 1 }, fluff: 0.08,
    pattern: { headAll: true, neck: 'head' }, marks: { back: 'streaks', belly: 'streaks', zone: 'flight', freq: 1.5 },
    palette: BP('#65503c', '#755e47', '#594532', '#493929', '#6c5540', '#705944', '#8b7459', '#b79b79', '#8f7b64', '#2b2118') },
  turkey: { label: 'Wild Turkey', sci: 'Meleagris gallopavo', bodyForm: 'galliform', skullForm: 'galliform', L: 0.68, pitch: 24, bodyH: 0.76, bodyW: 0.75, headR: 0.17, neckLen: 0.48, neckAng: 70, neckThin: 0.48, legLen: 0.42, legThk: 0.06, bareTibia: 0.25,
    beak: { len: 0.75, w: 0.38, h: 0.42, style: 'cone', hook: 0.12 }, eye: 0.16, wattle: 1.5, wattleZone: 'face', wing: { span: 1.75, chord: 0.7, tip: 'round', fold: 0.25 }, tail: { len: 1.0, fan: 110, n: 18, lift: 65 },
    pattern: { neck: 'face', headAll: true, barred: true }, marks: { back: 'scaled', belly: 'chevrons', wing: 'bars', tail: 'bars', zone: 'flight', light: 'jaw', freq: 2.2 },
    palette: BP('#3b2b21', '#46352a', '#514031', '#2a2420', '#4c6e83', '#9c3c3c', '#c09a55', '#d6b45f', '#b66d63', '#2a1a12', { jaw: '#7a5a34' }) },
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
    palette: BP('#6a6a6a', '#5a5a5c', '#7a766e', '#2a2826', '#f2eed8', '#5a3a2a', '#e8d870', '#a89a8a', '#3a3a3a'),
    // Digital Diorama revision 10: checked against the species photo (posture, bill and proportions)
    neckLen: 0.62, bodyH: 0.62, bodyW: 0.64, neckShape: [[0, 72], [0.4, 100], [0.78, 70], [1, 30]], headAng: 40, },
  toucan: { label: 'Toco Toucan', sci: 'Ramphastos toco', bodyForm: 'toucan', L: 0.3, pitch: 40, headR: 0.22, beak: { len: 3.8, w: 0.5, h: 1.25, style: 'big', curve: 0.1, decurve: 0.22, keel: 0.6, lowerDepth: 0.75, tip: 'face', tipFrom: 0.88, tipLower: false }, eye: 0.17, eyeRing: 0.5, feet: 'zygo', legLen: 0.2,
    wing: { span: 1.4, chord: 0.6, tip: 'round', fold: 0.2 }, tail: { len: 0.95, fan: 20, n: 8, lift: 25 }, pattern: { throat: 'belly', mask: 'accent', bellyFront: true },
    palette: BP('#141416', '#f4f2ea', '#141416', '#141416', '#141416', '#1d1d1d', '#3ab8e8', '#f28a1a', '#4a6ab8'),
    // Digital Diorama revision 10: checked against the species photo (posture, bill and proportions)
    pitch: 50,
    // (revision 10) the tail raised to clear the ground under the more upright body
    tail: { len: 0.95, fan: 20, n: 8, lift: 42 }, },
  cockatoo: { label: 'Sulphur-crested Cockatoo', sci: 'Cacatua galerita', bodyForm: 'parrot', L: 0.24, pitch: 46, bodyH: 0.58, headR: 0.27, headAng: 18, neckLen: 0.12, neckThin: 0.82, eye: 0.15, eyeRing: 0.4,
    beak: { len: 0.72, w: 0.54, h: 0.92, style: 'hook', hook: 0.44, lower: 0.62, lowerStyle: 'scoop', keel: 0.15, y: 0.06 }, crest: { h: 2.3, n: 8, style: 'recurve', vane: 0.16, thk: 0.035, curl: 0.9 },
    feet: 'zygo', legLen: 0.18, wing: { span: 2.1, chord: 0.66, tip: 'round', fold: 0.45 }, tail: { len: 1.15, fan: 24, n: 10, style: 'wedge', lift: 30 }, pattern: { headAll: true },
    palette: BP('#f3f2ec', '#f1f0ea', '#efeee8', '#f2ead0', '#f6f5f0', '#dfe8f0', '#f4cd2b', '#2b2c30', '#4f5054', '#1a1410'),
    // Digital Diorama revision 10: checked against the species photo (posture, bill and proportions)
    pitch: 60, beak: { len: 0.58, w: 0.48, h: 0.76, style: 'hook', hook: 0.44, lower: 0.62, lowerStyle: 'scoop', keel: 0.15, y: 0.06 },
    // (revision 10) the tail raised to clear the ground under the more upright body
    tail: { len: 1.15, fan: 24, n: 10, style: 'wedge', lift: 48 }, },
  hornbill: { label: 'Great Hornbill', sci: 'Buceros bicornis', bodyForm: 'corvid', skullForm: 'hornbill', L: 0.42, pitch: 28, headR: 0.17, neckLen: 0.4, neckAng: 60, neckThin: 0.62, eye: 0.17, maskW: 0.45, maskWBill: 0.9,
    beak: { len: 4.1, w: 0.4, h: 0.8, style: 'big', decurve: 0.42, keel: 0.35, casque: { len: 0.6, h: 0.85, w: 0.92, zone: 'beak', tipZone: 'face' } },
    feet: 'perch', legLen: 0.2, legThk: 0.045, wing: { span: 2.5, chord: 0.78, tip: 'slotted', fold: 0.4 }, tail: { len: 1.5, fan: 24, n: 10 }, pattern: { neck: 'accent', headAll: true, mask: 'face', maskShape: 'stripe' },
    palette: BP('#17181b', '#ece8dc', '#1b1c1f', '#efe9d6', '#1b1c1f', '#101012', '#ede0a2', '#f0c033', '#55524c', '#c8352a', { jaw: '#efd57c' }),
    // Digital Diorama revision 10: checked against the species photo (posture, bill and proportions)
    pitch: 44, },
  albatross: { label: 'Wandering Albatross', sci: 'Diomedea exulans', bodyForm: 'gull', skullForm: 'pelican', L: 0.62, pitch: 12, bodyH: 0.52, bodyW: 0.58, headR: 0.18, neckLen: 0.38, neckAng: 58,
    beak: { len: 1.9, w: 0.34, h: 0.42, style: 'flat', hook: 0.2, hookPow: 8, tip: 'face', tipFrom: 0.88 }, eye: 0.14, feet: 'webbed', legLen: 0.16, wing: { span: 3.8, chord: 0.44, tip: 'pointed', fold: 0.72, sweep: 0.3 }, tail: { len: 0.48, fan: 28, n: 10 },
    pattern: { headAll: true, neck: 'head', wingTips: true }, marks: { wing: 'edged', light: 'belly', freq: 1 },
    palette: BP('#f4f2e9', '#f7f5ed', '#4a4b4e', '#24262a', '#f7f5ed', '#f5f1e6', '#d6c7ab', '#e1c7a8', '#c8b59c', '#3c2c20'),
    // Digital Diorama revision 10: checked against the species photo (posture, bill and proportions)
    neckLen: 0.2, neckAng: 52, headR: 0.2, bodyH: 0.6, bodyW: 0.62, },
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
/* ── planted-foot walk (Digital Diorama revision 8) ─────────────────────────────────────────────────────────────
 * The walk used to swing each leg on a sine (birdLegs) while the app moved the bird at a speed the clip knew nothing
 * about, so its feet slid (1.8 hip heights a step on average) and dipped up to 4 cm into the ground. Now each foot
 * is planted for `duty` of the cycle, drawn back under the body at the pace the clip walks at, then lifted, its toes
 * hanging, and carried forward to land flat. The hip (a little protraction and retraction, and the abduction that
 * keeps the foot on its line while the pelvis rolls and yaws), the knee and the intertarsal joint reach it; the toes
 * stay level whatever the leg above does. The head keeps its attitude in the world, and head-bobbers (pigeons,
 * fowl) hold it still between thrusts. createClips stores the stride (the distance one cycle covers), so the app
 * plays the walk at the rate its feet need, as it does the mammals' gaits.
 */
// lambda: stride / hip height; duty: share of the cycle a foot is planted; lift: toe clearance in the swing / hip
// height; fr: the Froude number v²/(g·h) of the clip's own pace (the step rate is held below a leg pendulum's);
// femur: hip swing (±degrees); rise: the hips' rise and fall / hip height; heel: how far the foot
// rolls onto its toes before lifting (degrees); toe: how far the toes hang in the swing (degrees); roll, yaw: pelvis
// waddle (degrees); sway: sideways shift / hip height; bob: head bob (1 = the head holds still in the world between
// thrusts); nod: head nod (degrees)
const WALK_STYLE = {
  base: { lambda: 0.85, duty: 0.6, lift: 0.09, fr: 0.16, femur: 6, heel: 18, toe: 40, roll: 2, yaw: 2, sway: 0.012, rise: 0.012, bob: 0, nod: 2 },
  songbird: { bob: 0.35 }, robin: { bob: 0.35 }, cardinal: { bob: 0.35 }, corvid: { bob: 0.55, lambda: 0.9 },
  galliform: { lambda: 0.95, bob: 0.9, roll: 2.5 }, peafowl: { lambda: 0.95, bob: 0.8 },
  wader: { lambda: 0.8, duty: 0.64, lift: 0.07, fr: 0.11, heel: 15, toe: 50, bob: 0.45 }, flamingo: { lambda: 0.75, duty: 0.64, lift: 0.06, fr: 0.1, heel: 15, toe: 50, bob: 0.2 },
  spoonbill: { lambda: 0.8, duty: 0.64, lift: 0.07, fr: 0.11, heel: 15, toe: 45, bob: 0.4 },
  waterfowl: { lambda: 0.7, heel: 14, toe: 30, roll: 6, yaw: 4, sway: 0.03, nod: 3 }, swan: { lambda: 0.65, heel: 12, toe: 28, roll: 5, yaw: 3, sway: 0.025 },
  penguin: { lambda: 0.42, duty: 0.7, lift: 0.05, fr: 0.08, femur: 4, heel: 8, toe: 15, roll: 4, yaw: 7, sway: 0.03, rise: 0.003, nod: 1 },
  ratite: { lambda: 1.15, duty: 0.58, lift: 0.07, fr: 0.2, femur: 8, heel: 22, toe: 35, roll: 1.5, yaw: 1.5, nod: 1.5 },
  raptor: { lambda: 0.75, heel: 12, toe: 22, roll: 3, yaw: 2.5, sway: 0.02 }, owl: { lambda: 0.7, heel: 12, toe: 22, roll: 3, yaw: 2.5, sway: 0.02 },
  parrot: { lambda: 0.7, heel: 14, toe: 28, roll: 3.5, yaw: 3, sway: 0.025 },
};
const FLIGHTLESS = new Set(['penguin', 'ostrich', 'kiwi']);
// pigeons borrow the waterfowl torso but walk like pigeons
const WALK_SPECIES = { pigeon: { lambda: 0.85, heel: 16, toe: 38, roll: 2.5, yaw: 2.5, sway: 0.015, bob: 1, nod: 2 }, kiwi: { lambda: 0.95, bob: 0.3 } };
const _gX = V3(1, 0, 0), _gE = new THREE.Euler(), _gQh = new THREE.Quaternion(), _gQ1 = new THREE.Quaternion(), _gM = new THREE.Quaternion(), _gMi = new THREE.Quaternion(), _gQa = new THREE.Quaternion(), _gQb = new THREE.Quaternion();
const _gP = V3(), _gJ = V3(), _gK = V3(), _gF = V3(), _gf = V3(), _gd = V3();
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const mjerk = (t) => t * t * t * (10 + t * (6 * t - 15));   // minimum-jerk 0 → 1
const hermite = (w, p0, p1, m0, m1) => { const w2 = w * w, w3 = w2 * w; return (2 * w3 - 3 * w2 + 1) * p0 + (w3 - 2 * w2 + w) * m0 + (-2 * w3 + 3 * w2) * p1 + (w3 - w2) * m1; };
const eulerOf = (q) => { _gE.setFromQuaternion(q, 'YXZ'); return [_gE.x / DEG, _gE.y / DEG, _gE.z / DEG]; };
/**
 * Two links of lengths l1, l2 in a bone's (Y, Z) plane reaching (ty, tz) from the first joint: the first link's
 * angle atan2(y, z) and the elbow, bending to the side `sign` (that of the rest pose; out of reach, the chain points
 * at the target).
 */
function reach2(ty, tz, l1, l2, sign) {
  const d = clamp(Math.hypot(ty, tz), Math.abs(l1 - l2) * 1.001 + 1e-9, (l1 + l2) * 0.9995);
  const af = Math.atan2(ty, tz), b = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const at = (a) => ({ a, ey: l1 * Math.sin(a), ez: l1 * Math.cos(a) }), e = at(af + b);
  return Math.sign(e.ez * (ty - e.ey) - e.ey * (tz - e.ez)) === sign ? e : at(af - b);
}
/** The hips' sway, rise and turn at walk phase u (shared by the walk and its set-up). */
function walkHips(G, u) {
  const c1 = Math.cos(TAU * (u - G.duty / 2)), c2 = Math.cos(2 * TAU * (u - G.duty / 2));   // c1: +1 left mid-stance, −1 right; c2: +1 at either
  const k = fract(u) * G.fix.length, i = Math.floor(k), f = k - i, fix = G.fix.length ? lerp(G.fix[i % G.fix.length], G.fix[(i + 1) % G.fix.length], f) : 0;
  // (the pelvis rocks over the stance foot, not about its middle: the swing side rises, the stance hip keeps its height)
  const roll = -G.roll * c1;
  return { c1, c2, dy: -G.drop + G.bobA * c2 + fix + G.hipX * Math.abs(Math.sin(roll * DEG)), roll, yaw: G.yaw * c1, sway: G.sway * c1 };
}
/**
 * The lowest points of a bird's body and tail at rest (a few per part, legs and feet aside), and how far the walk takes
 * them down: returns, for 32 phases, how much to lift the hips so the body never sinks below where it stood (or below
 * the ground), and how far to raise the tail so it stays clear too.
 */
function walkClearance(rig, parts, G) {
  const hips = rig.head('Hips'), tailH = rig.has('Tail') ? rig.head('Tail') : null, lows = [];
  for (const pt of parts) {
    if (pt.group === 'legs' || pt.group === 'feet' || pt.glass) continue;
    const idx = [];
    for (let i = 0; i < pt.count; i++) idx.push(i);
    idx.sort((a, b) => pt.p[a * 3 + 1] - pt.p[b * 3 + 1]);
    for (const i of idx.slice(0, 24)) {
      let bi = pt.si[i * 4], bw = pt.sw[i * 4];
      for (let k = 1; k < 4; k++) if (pt.sw[i * 4 + k] > bw) { bw = pt.sw[i * 4 + k]; bi = pt.si[i * 4 + k]; }
      const name = rig.list[bi].name, tail = name === 'Tail';
      if (!tail && !/^(Root|Hips|Chest|WingFold[LR])$/.test(name)) continue;
      lows.push({ tail, P: V3(pt.p[i * 3], pt.p[i * 3 + 1], pt.p[i * 3 + 2]) });
    }
  }
  const margin = 0.004 * G.hipH, low = (set) => Math.min(...lows.filter((l) => l.tail === set).map((l) => l.P.y), Infinity);
  const tBody = Math.min(low(false), margin), tTail = Math.min(low(true), margin);
  const Qh = new THREE.Quaternion(), Qt = new THREE.Quaternion(), e = new THREE.Euler(), v = V3(), N = 32, fix = [], at = [];
  for (let n = 0; n < N; n++) {
    const u = n / N, h = walkHips({ ...G, fix: [] }, u);
    Qh.setFromEuler(e.set(0, h.yaw * DEG, h.roll * DEG, 'YXZ'));
    let m = Infinity;
    for (const l of lows) if (!l.tail) m = Math.min(m, v.copy(l.P).sub(hips).applyQuaternion(Qh).y + hips.y + h.dy);
    fix.push(Math.max(0, tBody - m)); at.push({ u, h });
  }
  // a little smoothing, so the lift has no corners
  const sm = fix.map((f, n) => Math.max(f, 0.25 * fix[(n + N - 1) % N] + 0.5 * f + 0.25 * fix[(n + 1) % N]));
  let tailUp = 0;
  if (tailH) for (; tailUp < 40; tailUp += 1) {
    let ok = true;
    for (const [n, { u, h }] of at.entries()) {
      Qh.setFromEuler(e.set(0, h.yaw * DEG, h.roll * DEG, 'YXZ'));
      Qt.setFromEuler(e.set((tailUp + 2 * h.c2) * DEG, (-1.2 * h.yaw + 3 * Math.sin(TAU * u)) * DEG, 0, 'YXZ'));
      for (const l of lows) if (l.tail && v.copy(l.P).sub(tailH).applyQuaternion(Qt).add(tailH).sub(hips).applyQuaternion(Qh).y + hips.y + h.dy + sm[n] < tTail) { ok = false; break; }
      if (!ok) break;
    }
    if (ok) break;
  }
  return { fix: sm.map((f) => +f.toFixed(5)), tailUp };
}
/** Walk geometry for one bird, from its skeleton (plain numbers, so the asset's userData stays clonable). */
function birdGaitSetup(rig, S, species, parts = []) {
  const st = { ...WALK_STYLE.base, ...(WALK_STYLE[S.bodyForm] || {}), ...(WALK_SPECIES[species] || {}) };
  const rel = (n) => { const e = rig.by[n]; return (e.parent ? e.head.clone().sub(e.parent.head) : e.head.clone()).toArray(); };
  const legs = ['L', 'R'].map((s) => {
    const g = { s, t: rel('Thigh' + s), a: rel('Shin' + s), b: rel('Tarsus' + s), c: rel('Toe' + s), foot: rig.head('Toe' + s).toArray() };
    g.sign = Math.sign(g.b[2] * g.c[1] - g.b[1] * g.c[2]) || 1;
    return g;
  });
  const J = rig.head('ThighL'), hipH = J.y, g0 = legs[0], d1 = st.femur * DEG;
  const l2 = Math.hypot(g0.b[1], g0.b[2]), l3 = Math.hypot(g0.c[1], g0.c[2]);
  // the leg may reach 94 % of its length; legs nearly straight at rest that cannot crouch (penguins, whose knees sit
  // high in a body that almost touches the ground) may straighten a little past where they stand
  const kn = rig.head('ShinL'), extRest = Math.hypot(kn.y - g0.foot[1], kn.z - g0.foot[2]) / (l2 + l3);
  let ext = 0.94;
  const bobA = st.rise * hipH, low = Math.cos(TAU * st.duty);   // the hips' bob, lowest at double support
  // a stride and crouch the leg can reach at both ends of a stance and in its middle without straightening (94 % of its
  // reach), the hips lifted by `lift` where the body or tail would otherwise touch the ground
  const wl = (u) => hipX * Math.abs(Math.sin(st.roll * DEG * Math.cos(TAU * (u - st.duty / 2))));
  let zc = 0;   // where the stance is centred, from the foot's place at rest (moved back if a leg reaches further that way)
  const fits = (stride, drop, lift = [0, 0, 0]) => [[1, -d1, low, lift[0] + wl(0)], [-1, d1, low, lift[1] + wl(st.duty)], [0, 0, 1, lift[2] + wl(st.duty / 2)]].every(([e, th, b, f]) => {
    const ky = J.y - drop + bobA * b + f + g0.a[1] * Math.cos(th) - g0.a[2] * Math.sin(th), kz = J.z + g0.a[1] * Math.sin(th) + g0.a[2] * Math.cos(th);
    return Math.hypot(ky - g0.foot[1], g0.foot[2] + zc + e * st.duty * stride / 2 - kz) <= ext * (l2 + l3);
  });
  const hipX = Math.abs(J.x - rig.head('Hips').x), G = { hipH, hipX, duty: st.duty, bobA, roll: st.roll, yaw: st.yaw, sway: st.sway * hipH, fix: [] };
  const solve = () => {
    let stride = st.lambda * hipH, drop = 0, clr = { fix: [], tailUp: 0 };
    for (let k = 0; k < 24; k++) {
      drop = 0; while (drop < 0.12 * hipH && !fits(stride, drop)) drop += 0.004 * hipH;
      clr = walkClearance(rig, parts, { ...G, drop });
      const fx = (u) => clr.fix.length ? clr.fix[Math.round(fract(u) * clr.fix.length) % clr.fix.length] : 0;
      if (fits(stride, drop, [Math.max(fx(0), fx(0.5)), Math.max(fx(st.duty), fx(st.duty + 0.5)), Math.max(fx(st.duty / 2), fx(st.duty / 2 + 0.5))])) break;
      stride *= 0.92;
    }
    return { stride, drop, clr, zc };
  };
  let best = solve();
  if (best.stride < 0.5 * st.lambda * hipH) {
    ext = clamp(extRest + 0.012, 0.94, 0.995);
    for (const k of [0, -0.1, -0.2, -0.3]) { zc = k * hipH; const r = solve(); if (r.stride > best.stride * 1.03) best = r; }
  }
  const { stride, drop, clr } = best; zc = best.zc;
  // (short strides would otherwise patter: a cycle takes at least 0.38 of the leg's pendulum period, as in fowl and ostriches)
  const T = clamp(Math.max(stride / Math.sqrt(st.fr * 9.81 * hipH), 0.38 * TAU * Math.sqrt(hipH / 9.81)), 0.22, 2.4);
  const tr = S.legThk * S.L * 0.8, toeReach = (S.toeLen ?? 0.28) * S.L * (S.feet === 'ratite' ? 1.2 : 1) + (S.talons ? tr * S.talons * 2.2 : 0);
  // rolling up onto long toes, or hanging them, lifts the foot by toeReach·sin(angle): keep that within a quarter of the hip height
  const tMax = Math.asin(clamp(0.25 * hipH / Math.max(1e-6, toeReach), 0, 1)) / DEG, toeA = Math.min(st.toe, tMax), heelA = Math.min(st.heel, 0.8 * toeA);
  const n2 = rel('Neck2'), n3 = rel('Head');
  return {
    hipH: +hipH.toFixed(4), stride: +stride.toFixed(4), T: +T.toFixed(3), duty: st.duty, lift: st.lift * hipH, drop, bobA, hipX, zc, fix: clr.fix, tailUp: clr.tailUp, femur: d1,
    heel: heelA * DEG, toe: toeA * DEG, toeReach, roll: st.roll, yaw: st.yaw, sway: st.sway * hipH, bob: st.bob, nod: st.nod, hips: rel('Hips'), legs,
    neck: { n2, n3, sign: Math.sign(n2[2] * n3[1] - n2[1] * n3[2]) || 1 },
  };
}
/** One leg reaching its foot target F (model space) from the posed hips, with the toes pitched `toe` (radians) in the world. */
function legReach(o, leg, F, th1, toe) {
  const { t, a, b, c } = leg, xb = b[0] + c[0];
  _gJ.set(t[0], t[1], t[2]).applyQuaternion(_gQh).add(_gP);
  // the abduction that brings the foot target into the plane the knee and intertarsal joint fold in
  const local = (phi) => {
    _gQ1.setFromEuler(_gE.set(th1, 0, phi, 'YXZ'));
    _gM.copy(_gQh).multiply(_gQ1); _gMi.copy(_gM).invert();
    _gK.set(a[0], a[1], a[2]).applyQuaternion(_gM).add(_gJ);
    return _gf.copy(F).sub(_gK).applyQuaternion(_gMi);
  };
  let phi = 0;
  for (let i = 0; i < 6; i++) {
    const g = local(phi).x - xb;
    if (Math.abs(g) < 1e-7) break;
    const dg = (local(phi + 1e-4).x - xb - g) / 1e-4;
    if (Math.abs(dg) < 1e-9) break;
    phi = clamp(phi - g / dg, -0.7, 0.7);
  }
  local(phi);
  const r = reach2(_gf.y, _gf.z, Math.hypot(b[1], b[2]), Math.hypot(c[1], c[2]), leg.sign);
  const th2 = wrapA(Math.atan2(b[1], b[2]) - r.a), th3 = wrapA(Math.atan2(c[1], c[2]) - th2 - Math.atan2(_gf.y - r.ey, _gf.z - r.ez));
  _gQa.copy(_gM).multiply(_gQb.setFromAxisAngle(_gX, th2 + th3)).invert().multiply(_gQb.setFromAxisAngle(_gX, toe));
  o['Thigh' + leg.s] = [th1 / DEG, 0, phi / DEG]; o['Shin' + leg.s] = [th2 / DEG, 0, 0]; o['Tarsus' + leg.s] = [th3 / DEG, 0, 0]; o['Toe' + leg.s] = eulerOf(_gQa);
}
function birdWalk(u, A) {
  const G = A.gait, { duty, stride } = G, D = duty * stride, o = fold(true);
  const { c2, dy, roll, yaw, sway } = walkHips(G, u);
  o.Hips = { r: [0, yaw, roll], p: [sway, dy, 0] };
  _gQh.setFromEuler(_gE.set(0, yaw * DEG, roll * DEG, 'YXZ'));
  _gP.set(G.hips[0] + sway, G.hips[1] + dy, G.hips[2]);
  for (const leg of G.legs) {
    // the foot is placed by its toe tip, which stays put on the ground through the stance (the heel rolling up onto it
    // at the end); in the swing the tip leaves and lands at the ground's speed, rising first and settling last
    const ph = fract(u + (leg.s === 'L' ? 0 : 0.5)), f = leg.foot, R = G.toeReach;
    let tz, ty = 0, p, th1;
    if (ph < duty) { const s = ph / duty; tz = R + G.zc + D * (0.5 - s); p = G.heel * sstep(0.78, 1, s); th1 = -G.femur + 2 * G.femur * s; }
    else {
      const w = (ph - duty) / (1 - duty), mf = 2 * G.femur * (1 - duty) / duty;
      // (the toes are picked up before they move on, and set down before the weight comes onto them)
      tz = R + G.zc - D / 2 + stride * mjerk(clamp((w - 0.08) / 0.77, 0, 1)) - stride * (1 - duty) * w;
      ty = G.lift * sstep(0, 0.25, w) * (1 - sstep(0.62, 1, w));
      p = lerp(G.heel, G.toe, sstep(0, 0.3, w)) * (1 - sstep(0.55, 0.88, w));
      th1 = hermite(w, G.femur, -G.femur, mf, mf);
    }
    legReach(o, leg, _gF.set(f[0], ty + f[1] * Math.cos(p) + R * Math.sin(p), f[2] + tz + f[1] * Math.sin(p) - R * Math.cos(p)), th1, p);
  }
  // head: a hold and a thrust each step (head-bobbers), otherwise carried level; either way it keeps its attitude
  const N = G.neck, tau = fract(2 * u), th = 0.42, half = stride / 2, hold = half * (1 - th), m = -half * th;
  const zr = G.bob * (tau < th ? hermite(tau / th, -hold / 2, hold / 2, m, m) : hold / 2 - half * (tau - th));
  _gQa.copy(_gQh).invert();
  _gd.set(0, -0.6 * G.bobA * c2, zr).applyQuaternion(_gQa);
  const ty = N.n2[1] + N.n3[1] + _gd.y, tz = N.n2[2] + N.n3[2] + _gd.z;
  const r = reach2(ty, tz, Math.hypot(N.n2[1], N.n2[2]), Math.hypot(N.n3[1], N.n3[2]), N.sign);
  const a1 = wrapA(Math.atan2(N.n2[1], N.n2[2]) - r.a), a2 = wrapA(Math.atan2(N.n3[1], N.n3[2]) - a1 - Math.atan2(ty - r.ey, tz - r.ez));
  _gQa.copy(_gQh).multiply(_gQb.setFromAxisAngle(_gX, a1 + a2)).invert().multiply(_gQb.setFromAxisAngle(_gX, G.nod * c2 * DEG));
  o.Neck1 = [a1 / DEG, 0, 0]; o.Neck2 = [a2 / DEG, 0, 0]; o.Head = eulerOf(_gQa);
  o.Tail = [G.tailUp + 2 * c2, -1.2 * yaw + 3 * Math.sin(TAU * u), 0];
  return o;
}
const BIRD_CLIPS = {
  perch: { label: 'Perch / idle', loop: true, dur: () => 4.2, frames: 43, build: (u, A) => {
    const look = Math.sin(TAU * u) * 28 * pulseSq(u, 0.15, 0.45), cock = 10 * pulseSq(u, 0.6, 0.8), breathe = 2 * Math.sin(TAU * 3 * u);
    return Object.assign(fold(true), birdLegs({}, 0, 0), { Hips: { r: [breathe, 0, 0], p: [0, -0.004 * A.L * Math.sin(TAU * 2 * u), 0] }, Neck2: [0, look * 0.4, 0], Head: [-cock * 0.3, look * 0.6, cock], Tail: [-6 * pulseSq(u, 0.85, 0.92), 0, 0] });
  } },
  walk: { label: 'Walk', loop: true, dur: (A) => A.T.walk, frames: 41, build: (u, A) => {
    if (A.gait) return birdWalk(u, A);
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
    // Digital Diorama revision 8: flightless birds (penguins, ostriches, kiwis) flap standing, as they do in display or to
    // keep their balance; they used to lie face down on the ground in the flight posture
    const o = A.flightless ? Object.assign(fold(false), birdLegs({}, 0, 0), { Hips: { r: [2 * s, 0, 0], p: [0, 0.004 * A.L * down, 0] }, Tail: [tailCock, 0, 0] })
      : Object.assign(fold(false), flightLegs({}, bodyPitch), {
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
    // (flightless birds hold their wings out standing, as they do to cool off or to sun themselves)
    const o = A.flightless ? Object.assign(fold(false), birdLegs({}, 0, 0), { Hips: { r: [0, 0, 2 * s], p: [0, 0, 0] }, Head: [0, headDip, 0], Tail: [0, 0, tailRudder * 0.5] })
      : Object.assign(fold(false), flightLegs({}, bodyPitch), {
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
  coat: { type: 'toggle', default: true, label: 'Painted coat', affects: 'colors', describe: 'Paint markings into a coat texture (crisp stripes, spots and patch edges); off: one colour per mesh face.' },
  coatGrain: { type: 'range', default: 0.06, min: 0, max: 0.25, step: 0.01, label: 'Coat grain', affects: 'colors', describe: 'Faint tonal variation in fur or feathers (painted coat only).' },
  shading: { type: 'choice', default: 'smooth', options: ['smooth', 'flat'], label: 'Shading', affects: 'geometry', describe: 'Smooth, rounded shading or flat low-poly facets.' },
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
  // Digital Diorama extension: `specOverride` merges anatomy/pattern/palette changes onto the preset
  // (one level deep), so related species can share one rig.
  const sp0 = SPECIES[p.species] || SPECIES[DEFAULT_SPECIES], ov = p.specOverride && typeof p.specOverride === 'object' ? p.specOverride : null;
  const sp = ov ? { ...sp0, ...Object.fromEntries(Object.entries(ov).map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) && sp0[k] && typeof sp0[k] === 'object' ? { ...sp0[k], ...v } : v])) } : sp0, S = {};
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
/**
 * Plumage markings (Digital Diorama revision). Now that plumage is painted into a texture, fine feather
 * patterns are possible. S.marks = { belly: 'bars' | 'streaks' | 'spots' | 'chevrons', back: 'scaled' |
 * 'streaks' | 'spots' | 'bars', wing: 'edged' | 'spots' | 'bars', tail: 'bars', breast: 'spots', freq, zone }.
 * Coordinates are surface (u, a) plus world position scaled by body length, so marks scale with the bird.
 */
function birdMarks(S, base) {
  const M = S.marks;
  if (!M) return base;
  const k = 1 / Math.max(1e-6, S.L), f = M.freq ?? 1, seed = 7 + (S.seed ?? 1);
  const dark = M.zone ?? 'accent', lightZ = M.light ?? 'face';
  const bars = (t, n, w) => Math.cos(TAU * t * n) > 1 - 2 * w;
  return (c) => {
    const z0 = base(c), { part, u = 0, a = 0, P } = c, sa = typeof a === 'number' ? Math.sin(a) : 0;
    if (!P) return z0;
    // (Digital Diorama revision 8: the wobble noise is only worked out where a mark asks for it; the same marks, a
    // third of the painter's time saved on heavily marked birds)
    const x = P.x * k, y = P.y * k, zz = P.z * k;
    let n0 = null;
    const nz = () => (n0 === null ? (n0 = fbm(x * 4, y * 4, zz * 4, seed) - 0.5) : n0);
    const under = (part === 'body' && sa < 0.05) || (part === 'neck' && sa < -0.15);
    const upper = (part === 'body' || part === 'neck') && !under;
    if (under && (z0 === 'belly' || z0 === S.pattern.breast || z0 === 'body')) {
      if (part === 'neck' && M.throatPlain) return z0;
      switch (M.belly) {
        case 'bars': return bars(y * 7 * f + nz() * 0.5, 1, (M.barW ?? 0.22) + 0.1 * nz()) ? dark : z0;
        case 'chevrons': return bars(y * 7 * f + Math.abs(x) * 2.2 + nz() * 0.4, 1, 0.2) ? dark : z0;
        case 'streaks': { const [d] = worley(x * 9 * f, y * 3 * f, zz * 9 * f, seed); return d < 0.17 + 0.05 * nz() ? dark : z0; }
        case 'spots': { const [d] = worley(x * 11 * f, y * 11 * f, zz * 11 * f, seed); return d < 0.2 ? dark : z0; }
      }
    }
    if (upper && z0 === 'body') {
      switch (M.back) {
        case 'scaled': { const [d1, d2] = worley(x * 10 * f, y * 6 * f, zz * 10 * f, seed + 3); return d2 - d1 < 0.1 ? lightZ : d1 < 0.18 ? dark : z0; }
        case 'streaks': { const [d] = worley(x * 12 * f, y * 9 * f, zz * 3.2 * f, seed + 3); return d < 0.22 + 0.06 * nz() ? dark : z0; }
        case 'spots': { const [d] = worley(x * 12 * f, y * 12 * f, zz * 12 * f, seed + 3); return d < 0.17 ? lightZ : z0; }
        case 'bars': return bars(zz * 8 * f + nz() * 0.4, 1, 0.2) ? dark : z0;
        case 'stripe': return Math.abs(Math.cos(a)) < 0.2 && sa > 0.75 ? lightZ : z0;
      }
    }
    if (part === 'fold' || part === 'wing') {
      const v = a;
      switch (M.wing) {
        case 'edged': return Math.abs(fract(v * (part === 'fold' ? 5 : 9) + nz() * 0.2) - 0.5) > 0.38 && z0 !== 'flight' ? lightZ : z0;
        case 'spots': return Math.cos(TAU * u * 9 * f) > 0.5 && Math.cos(TAU * v * 6) > 0.55 ? (M.spotZone ?? lightZ) : z0;
        case 'bars': return bars(u * 8 * f + v * 0.6 + nz() * 0.3, 1, 0.2) ? dark : z0;
      }
    }
    if (part === 'tail' && M.tail === 'bars') return bars(u * 6 * f + nz() * 0.2, 1, 0.22) ? dark : z0;
    if (part === 'body' && M.breast === 'spots' && sa < 0.2 && u > 0.55) { const [d] = worley(x * 13 * f, y * 13 * f, zz * 13 * f, seed + 5); return d < 0.2 ? dark : z0; }
    return z0;
  };
}

/** Plumage painter: back/belly countershading, caps, masks, collars, wing bars and speculum. */
function birdPaint(S) {
  return birdMarks(S, birdPaintBase(S));
}
function birdPaintBase(S) {
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
  const coatOn = p.coat !== false;
  const parts = [], B = { rig: new Rig(), parts, det: DETAIL[p.detail] ?? 1, part: (n, o) => { const pt = new Part(n, o); pt.coat = coatOn && !pt.glass; parts.push(pt); return pt; }, paint: birdPaint(S) };
  const G = birdBuild(B, S);
  const C = zonesFor(p.colorway, p, S.palette);
  const span = S.wing.span * S.L;
  const A = { L: S.L, pitch: S.pitch, T: { walk: clamp(0.55 * Math.sqrt(S.legLen * S.L / 0.03), 0.25, 1.6), hop: clamp(0.5 * Math.sqrt(S.L / 0.1), 0.3, 1.2), flap: clamp(0.38 * Math.sqrt(span / 0.5), 0.12, 1.4) } };
  // Digital Diorama revision 8: the walk plants its feet; its duration follows from the stride and a Froude-scaled pace
  A.gait = birdGaitSetup(B.rig, S, p.species, parts); A.T.walk = A.gait.T;
  if (S.flightless ?? FLIGHTLESS.has(p.species)) A.flightless = true;
  const clip = BIRD_CLIPS[p.pose] || BIRD_CLIPS.perch, pose = clip.build(clip.loop ? p.posePhase % 1 : p.posePhase, A);
  // Flight clips always use spread wings regardless of instantaneous stroke phase; the bone-scale
  // keys handle the fold/swap for skinned playback, so static mode only needs the clip name.
  const flying = p.pose === 'flap' || p.pose === 'glide' || (pose.WingL && pose.WingL.s > 0.5);
  if (p.rigMode === 'static') B.parts = parts.filter(pt => pt.group !== (flying ? 'wingFold' : 'wingSpread'));
  const coat = { res: COAT_RES[p.detail] ?? COAT_RES.standard, ref: S.L * 1.5, grain: p.coatGrain, grainOf: (z) => ZONE_ROLES[z] === 'body', smooth: p.shading !== 'flat' };
  const { root } = finish(B, { name: `bird-${p.species}`, merge: p.mergeForProduction, skinned: p.rigMode !== 'static', zones: C, pose, coat: coatOn || coat.smooth ? coat : null });
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
  return specs.map((c) => {
    const dur = typeof c.dur === 'function' ? c.dur(ud.anim) : c.dur, clip = bakeClip(ud.rig, c.name, dur, c.frames || 31, (u) => c.build(u, ud.anim), c.loop !== false);
    // Digital Diorama revision 8: stride metadata (distance per cycle, the hip height it was timed for), so the app
    // plays the walk at the rate that keeps the planted feet still, as it does the mammals' gaits
    const G = ud.anim.gait;
    if (c.name === 'walk' && G) clip.userData = { loop: true, gait: 'walk', stride: G.stride, speed: +(G.stride / dur).toFixed(4), hipH: G.hipH };
    return clip;
  });
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
