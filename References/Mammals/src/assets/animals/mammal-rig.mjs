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
 * CLIPS    idle, walk, trot, gallop, graze, alert, roar, sit — footfall-accurate gaits with
 *          planted feet (foot paths + leg IK); gait clips carry userData { gait, stride,
 *          speed, hipH }. createClips(asset), setPose(asset, name, phase).
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
 *
 * REVISION 4 (Digital Diorama: hind legs and motion, checked against skeletons and photos)
 *   - Hind joints come from real proportions (HIND LIMB LAYOUT): fetlocks at 12-19 % of the hip
 *     height (they sat at 4-7 %, leaving no pasterns), stifles high in the flank on deep-bodied
 *     ungulates, plantigrade shins upright over the heel, crouched rodent and rabbit legs folded
 *     inside the haunch. Species tune them with `hind: {...}` / `hindShape: {...}`.
 *   - The hind leg is lofted through its side-view outline (HIND LEG SURFACE): a broad thigh from
 *     flank fold to point of buttock, gaskin, Achilles and point of hock, skinned by joint planes.
 *   - Real hooves (coronary band, sloped toe wall, cloven claws) and compact paws.
 *   - Clips rewritten (CLIPS & POSES): planted feet on foot paths solved by leg IK, each family's
 *     real footfalls, Froude-scaled timing and stride metadata; lying down for hoofed animals.
 *
 * REVISION 5 (Digital Diorama: body shapes; bodies read as barrels on sticks)
 *   - Torso: a flank station and a section shape per station (`st`): narrow withers and a keeled
 *     chest, a belly that hangs in grazers and tucks up in hunters, a broad flat back and croup;
 *     the breastbone rises to the base of the neck (no box front). Seen from above: chest narrower
 *     than the ribs, a waist, broad quarters. Family values: keel, waist, chestNarrow, withersTop,
 *     quarters, croupFlat, backFlat, arch (the cats' arched loin), breast.
 *   - Surface anatomy: shoulder blade, triceps and point of shoulder sculpted into the chest wall;
 *     `marks` (points of hip, flank hollow, ribs, girth groove, breast, withers, spine).
 *   - Forelegs lofted through their side-view outline (FORELEG SURFACE) instead of a tube;
 *     `foreBulk` / `hindBulk` give big cats and bears their massive limbs.
 *   - The thigh's ilium root sits inside the hip (it poked out as knobs on the croup); normals are
 *     blended across the body / leg seams (blendSeamNormals) so the joins shade as one surface.
 *
 * REVISION 6 (Digital Diorama: heads)
 *   - The jaw hung below the whole head as a narrow strap (a crocodile's mouth). Behind the corner of
 *     the mouth (`mouthS`, under the eye in hunters, far forward in grazers and rodents) the cheek now
 *     covers the jaw; the lips meet only in front of it. The mouth still opens (roar).
 *   - A real stop: the forehead rises over the eyes and the nasal bridge drops in front by `stop`.
 *     Cats: deeper, rounder skulls and blunt muzzles; dogs: a broad skull and deep muzzle.
 *   - Ear-base mounds sunk into the skull (they stood out as knobs); hanging ears lie against the
 *     side of the head instead of standing off as discs or sinking into the cheek.
 *   - Elephant: the head re-aimed (it was a flat 1.5 m helmet) and a dedicated fan ear (tetraFanEar)
 *     draped behind the eye over the neck and shoulder; hippo and camel heads reshaped.
 *   - Grazing reaches the grass in front of the forefeet (the neck pivots about its base, not
 *     mid-chest); lying elephants lift the head and curl the trunk; wolves' saddles fade raggedly.
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
  // Digital Diorama revision 5 (body shapes): every section used to be the same oval, so bodies read as barrels.
  // The underline is now measured from the chest floor (the brisket, deepest just behind the elbows): `tuck`
  // lifts the flank in front of the thigh and the abdomen (dogs, cats, deer), `belly` lets it hang (cattle, pigs).
  // A flank station carries the tuck-up and the waist seen from above (`waist`), `arch` raises the loin, and each
  // station has its own section shape `st` = [width high on the side, width low on the side] (fractions of the
  // half-width): a keeled chest narrowing to the sternum (`keel`), a belly widest low down in grazers (`pear`),
  // a broad flat croup and back on hoofed animals (`croupFlat`, `backFlat`).
  const floor = H - D, up = (f) => floor + f * D;
  const keel = S.keel ?? 0.3, waist = S.waist ?? 0.05, pear = S.pear ?? clamp(belly * 1.5, 0, 0.8), arch = (S.arch || 0) * D;
  const croup = S.croupFlat ?? 0.88, back = S.backFlat ?? 0.92, quarters = S.quarters ?? 0.85;
  // Seen from above the body is not a tube: the chest between the shoulders is narrower than the ribs
  // (`chestNarrow`), the top of the chest narrows into the withers between the shoulder blades (`withersTop`),
  // and the hindquarters stay broad all the way down to the thighs (`quarters`), so the thighs read as the
  // sides of one mass instead of lumps on the end of a barrel.
  const keys = [
    // from above the hindquarters are U-shaped, broad right to the buttocks (a narrow rump left the thighs poking out)
    { n: 'rump', z: zB + 0.1 * Lt, top: yR - (S.croupSlope ?? 0.17) * Dr, bot: yR - 0.8 * Dr, w: lerp(0.78, 0.93, quarters) * hw * hipW, st: [croup * 0.9, quarters * 0.9] },
    // the body's skin wraps the upper thigh down to the stifle (where the leg leaves the body at the flank fold),
    // so croup, quarters and thigh read as one mass; the flank in front of it is tucked up
    { n: 'haunch', z: zB + 0.23 * Lt, top: yR, bot: yR - 0.98 * Dr, w: 0.97 * hw * hipW, st: [croup, quarters] },
    { n: 'flank', z: zB + 0.34 * Lt, top: lerp(yR, H, 0.22) - sag * 0.45 + arch * 0.7, bot: up(0.1 + 0.85 * tuck - 0.12 * belly), w: hw * (0.94 - waist), st: [back, lerp(0.66, 0.94, pear)] },
    { n: 'loin', z: zB + 0.46 * Lt, top: lerp(yR, H, 0.42) - sag + arch, bot: up(0.04 + 0.45 * tuck - 0.3 * belly), w: hw * (0.97 - 0.6 * waist), st: [back, lerp(0.74, 1.08, pear)] },
    { n: 'barrel', z: zB + 0.66 * Lt, top: lerp(yR, H, 0.74) - sag * 0.55 + arch * 0.35, bot: up(0.12 * tuck - 0.3 * belly), w: hw, st: [back * 1.02, lerp(0.8, 1.0, pear)] },
    { n: 'chest', z: zF - 0.19 * Lt, top: H, bot: floor + 0.1 * belly * D, w: (S.chestNarrow ?? 0.9) * hw * (S.chestW || 1), st: [S.withersTop ?? 0.95, 1 - keel] },
  ];
  for (const k of keys) { k.c = V3(0, (k.top + k.bot) / 2, k.z); k.ht = (k.top - k.bot) / 2; k.hb = k.ht; }
  // humps / withers prominence add to the top half-height only
  const nrC = V3(0, H - (0.45 + (S.neckLow || 0)) * D, zF - 0.035 * Lt);
  const nA = S.neckAng * DEG, nd = V3(0, Math.sin(nA), Math.cos(nA)), nUp = V3(0, Math.cos(nA), -Math.sin(nA));
  const nT = (S.neckThk * D) / 2, nW = S.neckW;
  // minimum neck run: the section must taper from the chest root to the skull over a sane distance
  const LhPre = S.headLen * H, rootHt = 0.44 * D * (S.chestOut || 1), skullHt = S.headD * LhPre;
  const Ln = Math.max(0.02 * H, S.neckLen * H, 1.25 * Math.max(0, rootHt - skullHt));
  const nArch = (S.neckArch || 0) * Ln;
  const neck = [
    // the breastbone rises from the girth to the base of the neck just below the points of the shoulders, so the upper
    // arms form the front of the body there (the section reached 90 % of the chest depth: a flat box front)
    { n: 'neckRoot', c: nrC, ht: 0.43 * D * (S.chestOut || 1), hb: (S.breast ?? 0.3) * D * (S.chestOut || 1), w: (S.neckRootW ?? 0.78) * hw * Math.sqrt(S.chestW || 1), st: [0.88, 1 - keel * 0.6] },
    { n: 'neck1', c: nrC.clone().addScaledVector(nd, 0.34 * Ln).addScaledVector(nUp, nArch * 0.6), ht: nT * 1.05, hb: nT * 1.05, w: nT * nW * 1.1, st: [0.95, 0.9] },
    { n: 'neck2', c: nrC.clone().addScaledVector(nd, 0.68 * Ln).addScaledVector(nUp, nArch), ht: nT * 0.86, hb: nT * 0.84, w: nT * nW * 0.92, st: [0.97, 0.94] },
    { n: 'neckTop', c: nrC.clone().addScaledVector(nd, Ln).addScaledVector(nUp, nArch * 0.5), ht: nT * 0.72, hb: nT * 0.7, w: nT * nW * 0.82, st: [1, 1] },
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
  const ntB = S.nt || 2.15, nbB = S.nb || 1.85;
  const nt = prof([[0, ntB * 0.92], [by('haunch').u, ntB], [by('chest').u, ntB], [uRoot + 0.02, 2], [1, 2]]);
  const nb = prof([[0, 2.1], [by('haunch').u, S.quartersBox ?? 2.0], [by('barrel').u, nbB], [by('chest').u, nbB * 0.95], [uRoot + 0.02, 2], [1, 2]]);
  const seg = Math.round((32 + 10 * (S.neckLen || 0)) * det), rad = 2 * Math.round(9 * det + 3);
  // Hamstring / buttock mass: swells the lower-lateral rear quadrant so the rear outline bulges at the
  // point of buttock and turns under into the thigh instead of ending in a vertical plate.
  // (Digital Diorama revision 5: much smaller now the hind leg is lofted through its real outline; the old bulge sat
  // beside the thigh as a second lump)
  const uH = by('haunch').u, hams = S.hams ?? 0.04;
  const hamBump = (u, a) => hams * (1 - sstep(uH * 0.35, uH * 1.25, u)) * bell(Math.sin(a), -0.28, 0.95) * (0.55 + 0.45 * Math.abs(Math.cos(a)));
  // Digital Diorama revision 5: the shoulder is sculpted into the chest wall (it was a smooth barrel with the
  // forelegs plugged in underneath): muscle over the shoulder blade, sloping back from the point of shoulder to
  // the withers, the triceps mass filling the angle above the elbow, and the point of shoulder itself. Landmarks
  // match the foreleg layout (tetraLimbJoints); the bulge acts on the sides of the ribcage only.
  const sz = L.zF - (S.shoulderBack ?? 0.07) * L.Lt, scT = [L.zF - 0.25 * L.Lt, L.H - 0.2 * L.D], scJ = [sz, L.H - 0.6 * L.D];
  const elb = [sz - 0.075 * L.H, Math.max(0.05 * L.H, L.elbowY) + 0.03 * L.H], tri = [lerp(scJ[0], elb[0], 0.5) - 0.05 * L.D, lerp(scJ[1], elb[1], 0.45)];
  const shAmp = S.shoulder ?? 0.09, sideOf = (a) => Math.abs(Math.cos(a)) ** 1.4;
  const segD = (z, y, A, Bp) => { const dz = Bp[0] - A[0], dy = Bp[1] - A[1], t = clamp(((z - A[0]) * dz + (y - A[1]) * dy) / (dz * dz + dy * dy), 0, 1); return Math.hypot(z - A[0] - t * dz, y - A[1] - t * dy); };
  const shoulderBump = (u, x, y, a) => {
    if (u > uRoot + 0.04 || u < by('barrel').u - 0.05) return 0;
    const c = curve.getPointAt(clamp(u, 0, 1)), z = c.z, yy = c.y + y, D = L.D;
    const blade = Math.exp(-((segD(z, yy, scT, scJ) / (0.17 * D)) ** 2));
    const tr = Math.exp(-(((z - tri[0]) / (0.2 * D)) ** 2 + ((yy - tri[1]) / (0.2 * D)) ** 2));
    const pt = Math.exp(-(((z - scJ[0] - 0.05 * D) / (0.1 * D)) ** 2 + ((yy - scJ[1]) / (0.1 * D)) ** 2));
    return shAmp * (0.8 * blade + 1.0 * tr + 0.55 * pt) * sideOf(a);
  };
  // Surface anatomy (Digital Diorama revision 5): a smooth tube reads as a barrel however it is proportioned. Real
  // bodies show their skeleton and muscles: the withers ridge and shoulder blades, the spring of the ribs, the hollow
  // behind the elbow, the forechest, the "hunger hollow" in the flank and the points of the hips. Each mark is a soft
  // bump at a station and a height round the section (sin a: 1 = top, -1 = belly); amounts per family in `marks`.
  const mk = Object.fromEntries(Object.entries(S.marks || {}).map(([k, v]) => [k, v * (S.markGain ?? 1)])), uAt = (n0, n1, t) => lerp(by(n0).u, by(n1).u, t), gap = (n0, n1) => Math.abs(by(n1).u - by(n0).u);
  const marks = [
    { u: uAt('haunch', 'flank', 0.35), du: 0.45 * gap('haunch', 'flank'), s: 0.52, ds: 0.26, amp: mk.hooks ?? 0 },
    { u: uAt('flank', 'loin', 0.55), du: 0.6 * gap('flank', 'loin'), s: 0.3, ds: 0.36, amp: -(mk.fossa ?? 0) },
    { u: by('barrel').u, du: 0.5 * gap('loin', 'chest'), s: -0.05, ds: 0.55, amp: mk.ribs ?? 0 },
    { u: uAt('barrel', 'chest', 0.62), du: 0.28 * gap('barrel', 'chest'), s: -0.6, ds: 0.24, amp: -(mk.girth ?? 0) },
    { u: uAt('chest', 'neckRoot', 0.72), du: 0.38 * gap('chest', 'neckRoot'), s: -0.5, ds: 0.32, amp: mk.breast ?? 0 },
    { u: by('chest').u - 0.01, du: 0.5 * gap('barrel', 'chest'), s: 1, ds: 0.12, amp: mk.withers ?? 0 },
    { u: by('chest').u, du: 0.4 * gap('barrel', 'chest'), s: 0.8, ds: 0.16, amp: mk.scapula ?? 0 },
    { u: (by('haunch').u + by('chest').u) / 2, du: 0.55 * gap('haunch', 'chest'), s: 1, ds: 0.08, amp: mk.spine ?? 0 },
  ].filter(m => m.amp);
  const markBump = (u, a) => {
    const sa = Math.sin(a); let f = 0;
    for (const m of marks) { const du = (u - m.u) / m.du, ds = (sa - m.s) / m.ds; if (du * du < 9 && ds * ds < 9) f += m.amp * Math.exp(-du * du - ds * ds); }
    return f;
  };
  const bump0 = (u, a, x, y) => hamBump(u, a) + shoulderBump(u, x, y, a) + markBump(u, a);
  const bump = S.bumpFn ? (u, a, x, y) => bump0(u, a, x, y) + S.bumpFn(u, a, x, y) : bump0;
  // section shape (see tetraLayout): the side narrows toward the top / bottom by each station's `st` factors
  const stT = prof(keys.map(k => [k.u, (k.st || [1, 1])[0]])), stB = prof(keys.map(k => [k.u, (k.st || [1, 1])[1]]));
  const sect = (u, a, x, y, h1, h2) => {
    const yn = Math.min(1, Math.abs(y) / Math.max(1e-9, y >= 0 ? h1 : h2));
    return [x * lerp(1, y >= 0 ? stT(u) : stB(u), sstep(0.04, 0.92, yn)), y];
  };
  const g = loft({ curve, seg, rad, w: pW, ht, hb: pHB, nt, nb, cap0: { type: 'round', len: S.rumpCap ?? 0.95, n: 5 }, cap1: { type: 'round', len: 0.62, n: 3 }, bend: 0.85, bump, sect });
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
      let f = (1 - sstep(lm.reach * 0.55, lm.reach * 1.25, dist)) * lm.pull * (1 - 0.6 * Math.max(0, Math.sin(a)));
      // Digital Diorama revision 5: the body wraps the upper thigh, so below the hip joint it moves with the femur
      // (fully by the stifle) and the thigh inside never shows through as the leg swings
      if (lm.pull > 0.5 && dist < lm.reach * 1.25) f = Math.max(f, (lm.front ? 0.8 : 0.9) * sstep(a0.y, lerp(a0.y, a1.y, 0.75), P.y) * (1 - sstep(lm.reach * 0.7, lm.reach * 1.25, dist)));
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
  // Digital Diorama revision 6: the stop was a 1-2 cm slope (a Labrador's is 3-4 cm): the forehead now rises over the
  // eyes and the nasal bridge drops in front of them, both by `stop`
  const HT = (s) => prof([[0, 0.62 * ch * dome], [0.12, 0.9 * ch * dome], [0.24, ch * dome], [sEye, (0.93 + 0.1 * stop) * ch], [s0, lerp(0.86 * ch, mt2 * (1 - 0.08 * stop), stop)], [s0 + 0.55 * sn, lerp(mt2, mt, 0.55)], [1, mt]])(s)
    + (S.roman || 0) * 0.14 * ch * bell(s, s0 + 0.45 * sn, 0.4 * sn) + (S.casque || 0) * 0.3 * ch * bell(s, S.casqueS ?? 0.12, S.casqueW ?? 0.2)
    + brow * ch * bell(s, sEye - 0.03, 0.12);
  // HBl: the skull's underside along the upper lip (the mouth line); the jaw hangs below it
  const HBl = prof([[0, 0.52 * ch], [0.14, 0.72 * ch], [sEye, 0.7 * ch * (S.jowl || 1)], [s0, 0.5 * ch], [1, 0.4 * mt]]);
  const OY = prof([[0, 0], [Math.max(0.05, s0 - 0.12), 0], [1, -(S.drop || 0) * ch]]);
  // Digital Diorama revision 6: behind the corner of the mouth (sC) the cheek and its masseter muscle cover the jaw, so
  // the skull's surface comes down to the bottom of the jaw there (the jaw hung below the whole head as a strap: a
  // crocodile's mouth). Hunters' mouths run back to below the eye; grazers' and rodents' corners lie far forward.
  const sJ0 = 0.14, sJ1 = 0.955;
  const jawExtra = (S.jaw ?? 0.5) * ch * 0.55, lip = 0.22 * mt + 0.002 * L.H;
  const jDrop = (s) => lerp(jawExtra, lip, sstep(sJ0 + 0.12, sJ1, s)) * (S.chin ? 1 + S.chin * bell(s, 0.9, 0.14) : 1);
  const hunter = S.fang > 0 || S.nose === 'feline' || S.stance === 'plantigrade';
  const sC = clamp(S.mouthS ?? (hunter ? sEye + 0.04 : S.incisors > 0 ? lerp(sEye, 1, 0.42) : lerp(sEye, 1, 0.5)), sJ0 + 0.12, 0.93);
  const cover = (s) => 1 - sstep(sC - 0.05, sC + 0.03, s);
  const HB = (s) => HBl(s) + cover(s) * (jDrop(s) + 0.04 * ch);
  const nMuz = S.muzzleN || 2.2;
  const NT = prof([[0, 2], [s0, 2.05], [1, nMuz]]), NB = prof([[0, 2], [s0, 2.1], [1, nMuz + 0.2]]);
  const tip = O.clone().addScaledVector(hd, Lh);
  const g = loft({ pts: [O, tip], seg: Math.round(18 * det), rad: 2 * Math.round(8 * det + 3), w: W, ht: HT, hb: HB, oy: OY, nt: NT, nb: NB, up: hu,
    cap0: { type: 'round', len: S.occiput ?? 0.72, n: 3 }, cap1: S.nose === 'disc' ? { type: 'flat' } : { type: 'round', len: S.noseCap ?? 0.5, n: 3 }, bend: 0, antifold: false });
  L.head = g; L.headS = { s0, sEye, sn, W, HT, HB: HBl, OY, sC };
  const headW = rig.W('Head');
  const paint = B.paint;
  const palate = (s, a) => s > s0 - 0.08 && s < 0.97 && Math.abs(a - 1.5 * Math.PI) < 0.55;
  // eyes: ray-cast a yaw/elevation direction from the skull centre onto the lofted surface
  const eyeR = S.eye * Lh, yaw = (S.eyeYaw ?? 55) * DEG, el = (S.eyeEl ?? 18) * DEG;
  const eFr = g.frame(sEye), eC = eFr.c.clone().addScaledVector(hu, OY(sEye) + (HT(sEye) - HBl(sEye)) * 0.5);
  L.eyes = [1, -1].map((side) => {
    const dir = hd.clone().multiplyScalar(Math.cos(yaw) * Math.cos(el)).add(V3(side * Math.sin(yaw) * Math.cos(el), 0, 0)).addScaledVector(hu, Math.sin(el)).normalize();
    const hit = surfaceToward(g, eC, dir, Math.max(0.05, sEye - 0.3), Math.min(0.97, sEye + 0.25));
    return { c: hit.p.clone().addScaledVector(hit.n, -eyeR * (S.eyeInset ?? 0.58)), dir: hit.n.clone().lerp(dir, 0.5).normalize(), side };
  });
  emit(B.part('head', { group: 'head' }), g, (s, a, P) => palate(s, a) ? 'mouth' : (S.nose === 'disc' && s >= 0.999) ? 'nose' : paint({ part: 'head', u: s, a, P, s0 }), headW);
  // ── jaw: hinged at the temporomandibular joint, its top hidden inside the skull until it opens
  const jTop = (s) => OY(s) - HBl(s) * 0.3;
  const jBot = (s) => OY(s) - HBl(s) - jDrop(s);
  // inside the cheek behind the mouth corner; in front, the lower lip sits just inside the upper lip
  const jw = (s) => W(s) * lerp(0.7, 0.8, sstep(sC - 0.06, sC + 0.04, s)) * lerp(1, 0.9, sstep(sC, 1, s)) * (S.jawW || 1);
  const jpts = [];
  for (let i = 0; i <= 8; i++) { const s = lerp(sJ0, sJ1, i / 8); jpts.push(O.clone().addScaledVector(hd, s * Lh).addScaledVector(hu, (jTop(s) + jBot(s)) / 2)); }
  const jcurve = makePath(jpts);
  const sOf = (u) => lerp(sJ0, sJ1, u), jh = (u) => (jTop(sOf(u)) - jBot(sOf(u))) / 2;
  const jg = loft({ curve: jcurve, seg: Math.round(12 * det), rad: 2 * Math.round(6 * det + 2), w: (u) => jw(sOf(u)), ht: jh, hb: jh,
    nt: 1.9, nb: 2.2, up: hu, cap0: { type: 'round', len: 0.7, n: 2 }, cap1: { type: 'round', len: 0.5, n: 2 }, bend: 0.5 });
  const tmj = O.clone().addScaledVector(hd, 0.2 * Lh).addScaledVector(hu, OY(0.2) - HBl(0.2) * 0.4);
  rig.add('Jaw', 'Head', tmj, tip.clone().addScaledVector(hu, jBot(1)));
  L.jaw = jg;
  // (the lining only inside the mouth: the front of the jaw is the lower lip, coat-coloured)
  emit(B.part('jaw', { group: 'head' }), jg, (u, a, P) => Math.abs(a - Math.PI / 2) < 0.5 && u > 0.1 && u < 0.88 ? 'mouth' : paint({ part: 'jaw', u: sOf(u), a, P, s0 }), rig.W('Jaw'));
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
/**
 * Elephant ear (Digital Diorama revision 6): a great fan hung from the side of the head just behind the eye and draped
 * back over the neck and shoulder, outside the body (the generic pinna sweep left it buried inside the neck). The
 * outline follows an African elephant's: the top edge level with the crown, the back edge curving down to a lobe at the
 * lower front. Sizes are fractions of the shoulder height: fanH (height), fanW (width), fanTop (how much of it rises
 * above the eye), fanGap (front edge behind the eye), fanClear (gap to the body).
 */
function tetraFanEar(B, S, L, side) {
  const E = S.ear, rig = B.rig, det = B.det, H = L.H;
  const eye = (L.eyes.find(e => e.side === side) || L.eyes[0]).c;
  const hgt = (E.fanH ?? 0.55) * H, wid = (E.fanW ?? 0.36) * H;
  const top = eye.y + (E.fanTop ?? 0.32) * hgt, zF = eye.z - (E.fanGap ?? 0.07) * H;
  let headX = 0;
  for (const row of L.head.rows) for (const q of row) if (Math.abs(q.z - zF) < 0.15 * L.Lh) headX = Math.max(headX, Math.abs(q.x));
  // outline: how far back the back edge and the front edge lie at each height (fractions of the width); the top-back
  // corner is rounded, the back edge sweeps down and forward to the lobe, the free front edge falls back below the
  // attachment and curves forward again into the lobe
  const backP = prof([[0, 0.5], [0.08, 0.82], [0.25, 1], [0.5, 0.97], [0.72, 0.78], [0.88, 0.45], [1, 0.12]]);
  const frontP = prof([[0, 0.08], [0.1, 0], [0.45, 0.02], [0.72, 0.1], [0.9, 0.09], [1, 0.05]]);
  const topY = prof([[0, 0], [0.5, 0.02], [0.8, 0.07], [1, 0.16]]);
  const clear = (E.fanClear ?? 0.03) * H;
  const f = (u, v) => {
    const y = top - hgt * (v + topY(u) * (1 - v));
    const z = lerp(zF - wid * frontP(v), zF - wid * backP(v), u);
    const body = sideXAt(L, z, y);
    // a rolled rim along the top and a gentle wave across the fan
    const rim = 0.05 * wid * (1 - sstep(0, 0.1, v)), wave = 0.025 * wid * Math.sin(3.2 * u + 5 * v) * u;
    const x = Math.max(headX * 0.9, body > 0 ? body + clear : 0) + 0.06 * wid * Math.sin(Math.PI * u) * (1 - 0.6 * v) + rim + wave;
    return V3(side * x, y, z);
  };
  const bone = side > 0 ? 'EarL' : 'EarR';
  rig.add(bone, 'Head', f(0, 0.04), f(0.15, 1));
  sheet(B.part('ears', { group: 'ears' }), { nu: Math.round(8 * det + 2), nv: Math.round(10 * det + 2), f,
    th: (u) => H * lerp(0.016, 0.006, u),
    zone: (u, v, face) => face !== 0 && (face === 1) === (side > 0) ? 'skin' : B.paint({ part: 'ear', u: v, a: u * TAU, P: f(u, v) }),
    skin: (u) => u < 0.16 ? rig.W2('Head', bone, u / 0.16) : rig.W(bone) });
}

/** Half-width of the head, jaw and neck at a height and a fore-aft position (for things that lie against them). */
function headSideX(L) {
  if (L.headSideX) return L.headSideX;
  const cell = 0.04 * L.Lh, m = new Map();
  const key = (y, z) => `${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (const g of [L.head, L.jaw, L.torso]) if (g) for (const row of g.rows) for (const q of row) { const k = key(q.y, q.z); if (Math.abs(q.x) > (m.get(k) || 0)) m.set(k, Math.abs(q.x)); }
  L.headSideX = (y, z) => {
    const cy = Math.floor(y / cell), cz = Math.floor(z / cell); let best = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) best = Math.max(best, m.get(`${cy + dy},${cz + dz}`) || 0);
    return best;
  };
  return L.headSideX;
}

/** Cupped, thickened ear membranes swept along a (possibly drooping or folded) axis. */
function tetraEars(B, S, L) {
  const E = S.ear, rig = B.rig, det = B.det, g = L.head, hd = L.hd, hu = L.hu;
  const Le = E.len * L.Lh, wMax = E.w * Le, wp = prof(EAR_PROFILES[E.style] || EAR_PROFILES.pointed);
  const isHanging = E.style === 'floppy' || E.style === 'hound' || (E.droop ?? 0) > 0.4 || E.hang !== undefined;
  for (const side of [1, -1]) {
    if (E.style === 'fan') { tetraFanEar(B, S, L, side); continue; }
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
      // Digital Diorama revision 6: sunk mostly inside the skull, so it only fills the crease round the ear root
      // (it stood out as a knob, and with a hanging ear read as a ram's horn)
      const mr = wMax * (E.moundR ?? 0.3), mc = p.clone().addScaledVector(n, -mr * 0.5).addScaledVector(axis, mr * 0.1);
      emit(B.part('head', { group: 'head' }), ellipsoid(mc, mr, mr * 0.7, mr * 1.05, hd, n, 5, 10), (uu, aa, P) => B.paint({ part: 'head', u: E.s ?? 0.2, a: Math.PI / 2, P, s0: L.headS.s0 }), rig.W2('Head', bone, 0.35));
    }
    const cup = E.cup ?? 0.35;
    const innerW = E.innerW ?? 0.55, innerLen = E.innerLen ?? 0.82;
    // offset > 0 moves the flap behind its root line (an elephant's ear hangs back from its front edge)
    const off = E.offset ?? 0, thick = E.thick ?? 1;
    const part = B.part('ears', { group: 'ears' });
    // Digital Diorama revision 6: a hanging ear lies against the side of the head; below its root it is kept outside the
    // skull, cheek and neck (it either stood off the head as a disc or, hung steeply, sank into the cheek)
    const outside = isHanging ? headSideX(L) : null, clear = 0.025 * L.Lh + 0.5 * wMax * 0.14;
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
        const q = c.addScaledVector(s, w * (x + off) * side).addScaledVector(fc, cupU * w * (x * x - 0.35));
        if (outside) { const sx = outside(q.y, q.z), k = sstep(0.06, 0.22, u); if (sx > 0 && Math.abs(q.x) < sx + clear) q.x = side * lerp(Math.abs(q.x), sx + clear, k); }
        return q;
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

/* ════════════════════════════════════════════════════════════════════════════
 *  HIND LIMB LAYOUT (Digital Diorama revision 4: hind legs checked against skeletons and photos)
 *  The old layout put the stifle on the belly line and derived the hock from body depth, so deep-bodied
 *  ungulates stood on posts with a kink, fetlocks sat at 4-7 % of the height (no pasterns), plantigrade
 *  shins sloped back ~30° and folded rodent legs hung below the body as a "V". Landmarks are now
 *  fractions of the hip-joint height h, read off real skeletons: stifle (kY, kZ), hock / ankle (aY, aZ),
 *  fetlock / paw joint (fY, fZ) and coronet (cY); Z is forward of the hip joint. Plantigrade and crouched
 *  feet give the heel → toe length (`foot`), digitigrade paws the paw-joint → toe length (`toe`).
 *  Species override any of these with `hind: {...}`.
 * ════════════════════════════════════════════════════════════════════════════ */
const HIND_LAYOUT = {
  // horse: hip joint 1.3 m, stifle 0.9, hock 0.6 (under the point of buttock), fetlock 0.24, coronet 0.08
  ungulate: { kY: 0.70, kZ: 0.15, aY: 0.46, aZ: -0.09, fY: 0.17, fZ: -0.075, cY: 0.062, pastern: 55, wall: 52 },
  // wolf: stifle in the flank fold well forward of the hip, hock a third of the way up, upright rear pastern
  digitigrade: { kY: 0.67, kZ: 0.19, aY: 0.31, aZ: -0.12, fY: 0.075, fZ: -0.095, toe: 0.13 },
  // bear: knee about half way up, shin near vertical, heel under the hip, a long sole reaching forward
  plantigrade: { kY: 0.48, kZ: 0.11, aY: 0.1, aZ: -0.035, foot: 0.36 },
  // elephant: a straight column, the knee low on the leg, the ankle a fifth of the way up
  graviportal: { kY: 0.52, kZ: 0.08, aY: 0.2, aZ: -0.03, fY: 0.06 },
  // rabbit / squirrel / mouse at rest: the knee folded forward inside the flank, heel at the rear, long foot flat
  crouch: { kY: 0.52, kZ: 0.38, aY: 0.07, aZ: -0.19, foot: 0.62 },
};
/** Merged hind layout for a species (`kind` = the HIND_LAYOUT entry it starts from). */
function hindLayoutFor(S, st) {
  const kind = st === 'digitigrade' && (S.crouch || 0) >= 0.5 ? 'crouch' : HIND_LAYOUT[st] ? st : 'digitigrade';
  return { kind, ...HIND_LAYOUT[kind], ...(S.hind || {}) };
}
/** Hip-joint height: the leg root sits this far below the croup. */
const hipHeightOf = (S, L) => L.yR - (S.hipDrop ?? 0.4) * L.Dr;
/**
 * Hoof proportions from the coronet radius r and the coronet height cy: ground half-length a / half-width b,
 * coronary band half-sizes, and how far ahead of the coronet the toe meets the ground (the toe wall slopes
 * forward at `wall` degrees from the ground). Cloven hooves are two claws of half-width b/2.
 */
function hoofDims(S, r, cy, wall = 52) {
  const a = 1.55 * r * (S.hoofLen ?? 1), b = 1.45 * r * (S.hoofW ?? 1), ac = r * 1.05, bc = r * 1.08;
  const toeH = cy + 0.22 * r;
  return { a, b, ac, bc, toeH, heelH: cy * 0.58, toe: ac + toeH / Math.tan(wall * DEG) };
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
      // Digital Diorama revision 4: the fetlock and coronet match the hind leg's (they sat at 4-7 % of the height,
      // leaving no pastern); the front pastern slopes a little flatter than the hind (~50° from the ground)
      const hl = hindLayoutFor(S, 'ungulate'), h = hipHeightOf(S, L), fy = (hl.fFY ?? hl.fY) * h, cy = hl.cY * h;
      const ca = J(sx * 0.93 + sp * 0.6, Math.max(0.53 * C, fy + 0.14 * h), el.p.z + 0.01 * H, 0.04, 0.045);
      const fe = J(sx * 0.9 + sp, fy, ca.p.z + 0.005 * H, 0.032, 0.04);
      const co = J(sx * 0.9 + sp, cy, fe.p.z + (fy - cy) / Math.tan((hl.pasternF ?? 50) * DEG), 0.03, 0.032);
      const hd = hoofDims(S, co.w * 1.05, cy, hl.wall);
      return { st, foot: 'hoof', joints: [top, sh, el, ca, fe, co, J(sx * 0.9 + sp, 0, co.p.z + hd.toe, 0.03)] };
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
  // the ilium root sits well below the croup (at the croup's surface its rounded end poked out as a knob on the rump)
  const pre = { p: V3(hipX * 0.62, L.yR - 0.3 * L.Dr, hz - 0.06 * Lt), w: thighW * 0.72, d: thighD * 0.72 };
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
  if (st === 'biped') {
    const kn = J(sx * 1.04 + sp * 0.2, L.yR - (0.97 + 0.1 * cr) * L.Dr + 0.02 * H, hz + (0.1 * Math.min(H, Lt) + 0.3 * cr * L.yR), 0.06, 0.1);
    const hk = J(sx * 0.95 + sp, (S.hockH ?? 0.3) * (L.yR - 0.45 * L.Dr), hz - 0.16 * H, 0.04, 0.05), pw = J(sx * 0.95 + sp, 0.035 * H, hk.p.z + 0.06 * H, 0.032, 0.03);
    return { st, foot: S.foot || 'talon', joints: [hip, J(sx * 1.05 + sp * 0.2, hy * 0.85, hz + 0.16 * H, 0.08, 0.1), hk, pw, J(sx * 0.95 + sp, 0.01 * H, pw.p.z + 0.13 * H * (S.footLen || 1), 0.025, 0.012)] };
  }
  return tetraHindJoints(S, L, side, st, { J, hip, pre, sx, sp, th, thighW, thighD });
}

/**
 * Hind joints from the HIND_LAYOUT landmarks (Digital Diorama revision 4). Every joint is placed relative
 * to the hip joint, so the leg keeps real proportions whatever the body depth or length.
 */
function tetraHindJoints(S, L, side, st, o) {
  const { J, hip, pre, sx, sp, th, thighW, thighD } = o;
  const lay = hindLayoutFor(S, st), kind = lay.kind, h = hip.p.y, z0 = hip.p.z, H = L.H;
  const kx = sx * 1.03 + sp * 0.2, ax = sx * 0.93 + sp * 0.6, fx = sx * 0.9 + sp;
  // a folded knee stays inside the flank (it hung below the belly)
  const ky = kind === 'crouch' ? Math.max(lay.kY * h, L.yR - 0.98 * L.Dr + 0.1 * h) : lay.kY * h;
  const kn = kind === 'crouch' ? J(kx, ky, z0 + lay.kZ * h, 0.085, 0.13) : J(kx, ky, z0 + lay.kZ * h, 0.06, 0.1);
  const an = J(ax, lay.aY * h, z0 + lay.aZ * h, kind === 'plantigrade' || kind === 'crouch' ? 0.042 : 0.036, 0.05);
  const base = { st, kind, h, lay, pre, thighW, thighD };
  if (kind === 'ungulate') {
    const fe = J(fx, lay.fY * h, z0 + lay.fZ * h, 0.032, 0.04);
    const cy = lay.cY * h, co = J(fx, cy, fe.p.z + (fe.p.y - cy) / Math.tan((lay.pastern ?? 55) * DEG), 0.03, 0.032);
    const hd = hoofDims(S, co.w * 1.05, cy, lay.wall);
    return { ...base, foot: 'hoof', joints: [hip, kn, an, fe, co, J(fx, 0, co.p.z + hd.toe, 0.03)] };
  }
  if (kind === 'graviportal') {
    const pt = J(fx, lay.fY * h, an.p.z + 0.01 * h, 0.056, 0.06);
    return { ...base, foot: 'pad', joints: [hip, kn, an, pt, J(fx, 0, pt.p.z + 0.012 * h, 0.06)] };
  }
  if (kind === 'plantigrade' || kind === 'crouch') {
    // ankle above the heel; ball of the foot about 60 % of the way to the toe tips
    const fl = (lay.foot ?? 0.36) * h;
    return { ...base, foot: 'sole', joints: [hip, kn, an, J(fx, Math.min(an.p.y * 0.42, 0.03 * H), an.p.z + 0.6 * fl, 0.045, 0.02), J(fx, Math.min(an.p.y * 0.16, 0.012 * H), an.p.z + fl, 0.038, 0.012)] };
  }
  // digitigrade: hock a third of the way up, rear pastern near vertical, toes ahead of the paw joint
  const pw = J(fx, lay.fY * h, z0 + lay.fZ * h, 0.034, 0.033);
  return { ...base, foot: 'paw', joints: [hip, kn, an, pw, J(fx, 0.012 * H, pw.p.z + (lay.toe ?? 0.13) * h, 0.022, 0.012)] };
}

/* ════════════════════════════════════════════════════════════════════════════
 *  HIND LEG SURFACE (Digital Diorama revision 4)
 *  A tube swept round the bones made the thigh a narrow pipe hanging under the body with a human-like
 *  knee. Real hind legs are shaped by muscle, not bone: seen from the side the thigh is a broad slab whose
 *  front edge runs from the flank fold to the stifle and whose back edge (the breeches) falls from the
 *  point of buttock to the gaskin, then the Achilles tendon runs straight to the point of hock. The leg is
 *  lofted through that OUTLINE (section centres midway between the front and back edges), so the path is
 *  nearly straight and the quarters read as one mass from croup to hock; it is skinned by joint planes.
 *  Extents are fractions of the hip height h (thigh: × √thickness, lower leg: × thickness).
 * ════════════════════════════════════════════════════════════════════════════ */
const HIND_SHAPE = {
  ungulate: { thighF: 0.16, patella: 0.05, breech: 0.13, hams: 0.035, kneeW: 0.058, gaskF: 0.042, gaskW: 0.055, hockF: 0.04, hockB: 0.068, hockW: 0.042, canF: 0.026, canB: 0.036, canW: 0.026, fetF: 0.036, fetB: 0.05, fetW: 0.034, pastR: 0.026, corR: 0.029, inset: 0.035 },
  digitigrade: { thighF: 0.17, patella: 0.05, breech: 0.11, hams: 0.035, kneeW: 0.062, gaskF: 0.04, gaskW: 0.06, hockF: 0.035, hockB: 0.062, hockW: 0.04, canF: 0.027, canB: 0.032, canW: 0.032, fetF: 0.032, fetB: 0.034, fetW: 0.036, inset: 0.035 },
  plantigrade: { thighF: 0.16, patella: 0.06, breech: 0.08, hams: 0.035, kneeW: 0.095, gaskF: 0.06, gaskW: 0.09, hockF: 0.055, hockB: 0.075, hockW: 0.072, inset: 0.04 },
  crouch: { thighF: 0.2, patella: 0.07, breech: 0, hams: 0, kneeW: 0.1, gaskF: 0.06, gaskW: 0.08, hockF: 0.05, hockB: 0.08, hockW: 0.06, inset: 0.04 },
  graviportal: { thighF: 0.14, patella: 0.06, breech: 0.04, hams: 0.02, kneeW: 0.12, gaskF: 0.07, gaskW: 0.1, hockF: 0.07, hockB: 0.08, hockW: 0.09, canF: 0.075, canB: 0.075, canW: 0.085, fetF: 0.08, fetB: 0.08, fetW: 0.09, inset: 0.04 },
};
/** The torso's rear surface (smallest z) at height y near lateral position x. */
function rearZAt(L, y, x) {
  let best = Infinity;
  const tol = 0.07 * L.Dr, band = 0.45 * L.hw;
  for (const row of L.torso.rows) for (const p of row) if (Math.abs(p.y - y) < tol && Math.abs(p.x - x) < band && p.z < best) best = p.z;
  return best === Infinity ? L.zB : best;
}
/**
 * Skin weights by joint planes: bone i owns the leg between the planes that bisect the joint angles at its
 * two ends (blended over `blend[i]` either side); the top of the thigh shares with the Hips so the quarters
 * stay attached as the leg swings.
 */
function planeSkin(rig, joints, bones, blend, hipsTo = null, rootBone = 'Hips') {
  const J = joints.map(j => j.clone()), n = bones.length, dirs = [];
  for (let i = 0; i < n; i++) dirs.push(J[i + 1].clone().sub(J[i]).normalize());
  const planes = [];
  for (let i = 1; i < n; i++) planes.push({ p: J[i], n: dirs[i - 1].clone().add(dirs[i]).normalize(), w: blend[i - 1] });
  const L0 = J[1].distanceTo(J[0]), d = V3();
  return (u, a, P) => {
    let c = 1;
    const out = [];
    let prev = 1;
    for (let i = 0; i < planes.length; i++) {
      const pl = planes[i];
      c = Math.min(c, sstep(-pl.w, pl.w, d.subVectors(P, pl.p).dot(pl.n)));
      if (prev - c > 1e-4) out.push([rig.i(bones[i]), prev - c]);
      prev = c;
    }
    if (prev > 1e-4) out.push([rig.i(bones[n - 1]), prev]);
    let W = normW(out);
    if (hipsTo) {
      const s = d.subVectors(P, J[0]).dot(dirs[0]) / Math.max(1e-6, L0);
      const leg = sstep(hipsTo[0], hipsTo[1], s);
      if (leg < 1) W = mixW(rig.W(rootBone), W, leg);
    }
    return W;
  };
}
/** Hind leg lofted through its side-view outline (see HIND LEG SURFACE); returns the loft. */
function tetraHindLeg(B, S, L, lm, nm) {
  const det = B.det, rig = B.rig, J = lm.joints, h = lm.h, k = lm.kind;
  const th = (S.hindThk || S.legThk || 1) * (S.hindBulk ?? S.limbBulk ?? 1), tq = Math.sqrt(th);
  const sh = { ...HIND_SHAPE[k], ...(S.hindShape || {}) };
  const hip = J[0].p, K = J[1].p, A = J[2].p, F = k === 'plantigrade' || k === 'crouch' ? null : J[3].p;
  const butt = Math.min(rearZAt(L, hip.y, hip.x) + sh.inset * h, hip.z - 0.08 * h);
  const buttK = Math.min(butt + sh.breech * h, K.z - 0.14 * h);
  // lateral centre: joint x interpolated by height
  const xs = [[lm.pre.p.y, lm.pre.p.x], [hip.y, hip.x], [K.y, K.x], [A.y, A.x], ...(F ? [[F.y, F.x]] : [])];
  const xAt = (y) => { for (let i = 0; i < xs.length - 1; i++) if (y <= xs[i][0] && y >= xs[i + 1][0]) return lerp(xs[i][1], xs[i + 1][1], (xs[i][0] - y) / Math.max(1e-9, xs[i][0] - xs[i + 1][0])); return y > xs[0][0] ? xs[0][1] : xs[xs.length - 1][1]; };
  const st = [];
  // the upper thigh lies within the hip's own surface (it stood out like a saddlebag where the torso narrows)
  const at = (y, zf, zb, w, flush = 0) => {
    const zc = (zf + zb) / 2; let x = xAt(y);
    if (flush) { const wall = sideXAt(L, zc, y); if (wall > 0) x = lm.side * clamp(wall + flush * w - w, 0.15 * L.hw, Math.abs(x)); }
    st.push({ c: V3(x, y, zc), d: Math.max(1e-4, (zf - zb) / 2), w });
  };
  const hT = h * th, achB = A.z - sh.hockB * hT;
  at(lm.pre.p.y, lm.pre.p.z + 0.82 * lm.thighD, lm.pre.p.z - 0.82 * lm.thighD, 0.82 * lm.thighW, -0.1);
  if (k === 'crouch') {
    // folded leg at rest (rabbits, squirrels, mice): one wedge-shaped haunch from the hip down to the heel,
    // its front edge the folded knee and the shin, its back edge the rump falling to the heel
    const heelB = A.z - sh.hockB * hT;
    at(hip.y, hip.z + sh.thighF * h * tq, butt, lm.thighW, 0.1);
    at(lerp(hip.y, K.y, 0.55), lerp(hip.z + sh.thighF * h * tq, K.z + sh.patella * hT, 0.62), lerp(butt, heelB, 0.25), lm.thighW * 0.95, 0.2);
    at(K.y, K.z + sh.patella * hT, lerp(butt, heelB, 0.55), lm.thighW * 0.82);
    at(lerp(K.y, A.y, 0.5), lerp(K.z, A.z, 0.5) + sh.gaskF * hT, lerp(butt, heelB, 0.85), lm.thighW * 0.6);
    at(A.y, A.z + sh.hockF * hT, heelB, sh.hockW * hT);
  } else {
  at(hip.y, hip.z + sh.thighF * h * tq, butt, lm.thighW, -0.15);
  at(lerp(hip.y, K.y, 0.5), lerp(hip.z + sh.thighF * h * tq, K.z + sh.patella * hT, 0.62), lerp(butt, buttK, 0.5) - sh.hams * h * tq, lm.thighW * 0.86, -0.1);
  at(K.y, K.z + sh.patella * hT, buttK, sh.kneeW * hT);
  // gaskin: muscle bulge high on the tibia, then the Achilles tendon straight to the point of hock
  const g1 = lerp(buttK, achB, 0.42);
  at(lerp(K.y, A.y, 0.36), lerp(K.z, A.z, 0.36) + sh.gaskF * hT, g1, sh.gaskW * hT);
  at(lerp(K.y, A.y, 0.72), lerp(K.z, A.z, 0.72) + sh.gaskF * 0.88 * hT, lerp(g1, achB, 0.62), lerp(sh.gaskW, sh.hockW, 0.6) * hT);
  at(A.y, A.z + sh.hockF * hT, achB, sh.hockW * hT);
  if (F) {
    for (const f of [0.3, 0.72]) { const z = lerp(A.z, F.z, f); at(lerp(A.y, F.y, f), z + sh.canF * hT, z - sh.canB * hT, sh.canW * hT); }
    at(F.y, F.z + sh.fetF * hT, F.z - sh.fetB * hT, sh.fetW * hT);
  }
  }
  if (k === 'ungulate') {
    // pastern sections stand square to the pastern
    const C = J[4].p;
    st.push({ c: F.clone().lerp(C, 0.5).add(V3(0, 0, -0.004 * hT)), d: sh.pastR * hT, w: sh.pastR * hT * 0.92, perp: true });
    st.push({ c: C.clone(), d: sh.corR * hT, w: sh.corR * hT, perp: true });
  }
  const pts = st.map(s => s.c), curve = makePath(pts), ku = knotUs(curve, pts.length);
  // horizontal outline extents → extents square to the (slightly tilted) path
  const cosT = st.map((s, i) => { if (s.perp) return 1; const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const t = b.clone().sub(a); return clamp(Math.abs(t.y) / Math.max(1e-9, t.length()), 0.45, 1); });
  const pw = prof(st.map((s, i) => [ku[i], s.w])), pd = prof(st.map((s, i) => [ku[i], s.d * cosT[i]]));
  const g = loft({ curve, seg: Math.round((14 + 2.6 * pts.length) * det), rad: 2 * Math.round(5 * det + 2), w: pw, ht: pd, hb: pd, nt: 2.15, nb: 2.15, up: [0, 0, 1],
    cap0: { type: 'round', len: 0.3, n: 3 }, cap1: { type: 'round', len: 0.45, n: 2 }, bend: 0.5 });
  lm.grid = g; lm.us = ku;
  // joints for skinning: hip, stifle, hock, fetlock / paw joint, coronet
  const nb = lm.bones.length, sj = J.slice(0, nb + 1).map(j => j.p);
  // a folded haunch bends over a wide band at the knee (a narrow one creased it into a corner as the leg stretched)
  const skin = planeSkin(rig, sj, lm.bones, k === 'crouch' ? [0.3 * h, 0.07 * h, 0.04 * h] : [0.11 * h, 0.05 * h, 0.03 * h], k === 'crouch' ? [-0.4, 0.75] : [-0.25, 0.5]);
  emit(B.part(nm, { group: 'legs' }), g, (u, a, P) => B.paint({ part: 'leg', u, a, P, front: false, side: lm.side }), skin);
  return g;
}

/* ════════════════════════════════════════════════════════════════════════════
 *  FORELEG SURFACE (Digital Diorama revision 5)
 *  Forelegs were tubes plugged into the underside of the chest, which made every body read as a barrel.
 *  Seen from the side, the shoulder is a big sloping triangle on the ribcage: the shoulder blade lies back
 *  from the withers to the point of shoulder, and the triceps fill the angle behind the upper arm down to the
 *  point of elbow, which sits against the chest. The foreleg is lofted through that outline, then the
 *  forearm (muscular above, tapering to the knee), knee, cannon, fetlock and pastern; skinned by joint planes.
 *  Extents are fractions of the hip height h × foreleg thickness.
 * ════════════════════════════════════════════════════════════════════════════ */
const FORE_SHAPE = {
  ungulate: { scapF: 0.06, scapB: 0.08, scapW: 0.045, ptSh: 0.065, armF: 0.05, triceps: 0.1, armW: 0.06, elbowB: 0.072, elbowW: 0.052, fore: [0.044, 0.04], foreW: 0.046, knee: [0.034, 0.04], kneeW: 0.038, can: [0.025, 0.032], canW: 0.025, fet: [0.034, 0.046], fetW: 0.032, pastR: 0.025, corR: 0.028 },
  digitigrade: { scapF: 0.06, scapB: 0.08, scapW: 0.05, ptSh: 0.065, armF: 0.05, triceps: 0.1, armW: 0.065, elbowB: 0.07, elbowW: 0.055, fore: [0.048, 0.046], foreW: 0.05, knee: [0.03, 0.034], kneeW: 0.034, can: [0.027, 0.03], canW: 0.031, fet: [0.03, 0.032], fetW: 0.035 },
  plantigrade: { scapF: 0.07, scapB: 0.09, scapW: 0.06, ptSh: 0.07, armF: 0.06, triceps: 0.12, armW: 0.08, elbowB: 0.08, elbowW: 0.075, fore: [0.065, 0.06], foreW: 0.07, knee: [0.05, 0.05], kneeW: 0.06 },
  graviportal: { scapF: 0.06, scapB: 0.07, scapW: 0.06, ptSh: 0.06, armF: 0.06, triceps: 0.1, armW: 0.09, elbowB: 0.07, elbowW: 0.085, fore: [0.075, 0.07], foreW: 0.085, knee: [0.07, 0.07], kneeW: 0.08, can: [0.072, 0.072], canW: 0.08, fet: [0.078, 0.078], fetW: 0.085 },
};
/** Half-width of the torso surface near (z, y), from the loft's rings. */
function sideXAt(L, z, y) {
  let best = 0;
  const tz = 0.035 * L.Lt, ty = 0.07 * L.D, g = L.torso;
  for (let k = g.main[0]; k <= g.main[1]; k++) for (const p of g.rows[k]) if (Math.abs(p.z - z) < tz && Math.abs(p.y - y) < ty && Math.abs(p.x) > best) best = Math.abs(p.x);
  return best;
}
/** Foreleg lofted through its side-view outline (see FORELEG SURFACE); returns the loft. */
function tetraForeLeg(B, S, L, lm, nm) {
  const det = B.det, rig = B.rig, J = lm.joints, st = lm.st, sh = { ...FORE_SHAPE[st], ...(S.foreShape || {}) };
  // `foreBulk` / `hindBulk`: muscle round the bones (big cats and bears have massive forearms; legs read as stilts without it)
  const th = (S.foreThk || S.legThk || 1) * (S.foreBulk ?? S.limbBulk ?? 1), h = hipHeightOf(S, L), hT = h * th;
  const T0 = J[0].p, Sh = J[1].p, E = J[2].p, C = J[3].p, F = st === 'plantigrade' ? null : J[4].p;
  const xs = [[T0.y, T0.x], [Sh.y, Sh.x], [E.y, E.x], [C.y, C.x], ...(F ? [[F.y, F.x]] : [])];
  const xAt = (y) => { for (let i = 0; i < xs.length - 1; i++) if (y <= xs[i][0] && y >= xs[i + 1][0]) return lerp(xs[i][1], xs[i + 1][1], (xs[i][0] - y) / Math.max(1e-9, xs[i][0] - xs[i + 1][0])); return y > xs[0][0] ? xs[0][1] : xs[xs.length - 1][1]; };
  const stn = [];
  // `flush`: the shoulder and upper arm lie on the ribcage, their outer face just proud of the chest wall
  const at = (y, zf, zb, w, flush = 0) => {
    const zc = (zf + zb) / 2; let x = xAt(y);
    if (flush) { const wall = sideXAt(L, zc, y); if (wall > 0) x = lm.side * Math.max(Math.abs(x), wall + flush * w - w); }
    stn.push({ c: V3(x, y, zc), d: Math.max(1e-4, (zf - zb) / 2), w });
  };
  // the triceps line: from the back of the shoulder blade down to the point of elbow, bellying out between
  const yM = lerp(T0.y, Sh.y, 0.5), zM = lerp(T0.z, Sh.z, 0.5), scapBack = zM - sh.scapB * hT, olec = E.z - sh.elbowB * hT;
  const triceps = (y) => { const t = clamp((yM - y) / Math.max(1e-9, yM - E.y), 0, 1); return lerp(scapBack, olec, t) - sh.triceps * 0.32 * hT * Math.sin(Math.PI * t); };
  at(T0.y, T0.z + sh.scapF * hT * 0.6, T0.z - sh.scapB * hT * 0.6, sh.scapW * hT * 0.8);
  at(yM, zM + sh.scapF * hT, triceps(yM), sh.scapW * hT);
  at(Sh.y, Sh.z + sh.ptSh * hT, triceps(Sh.y), sh.armW * hT);
  const yA = lerp(Sh.y, E.y, 0.55);
  at(yA, lerp(Sh.z, E.z, 0.55) + sh.armF * hT, triceps(yA), sh.armW * hT * 0.95);
  at(E.y, E.z + sh.fore[0] * hT * 1.04, olec, sh.elbowW * hT);
  for (const [f, k] of [[0.28, 1], [0.72, 0.8]]) { const z = lerp(E.z, C.z, f); at(lerp(E.y, C.y, f), z + sh.fore[0] * hT * k, z - sh.fore[1] * hT * k, sh.foreW * hT * k); }
  at(C.y, C.z + sh.knee[0] * hT, C.z - sh.knee[1] * hT, sh.kneeW * hT);
  if (F) {
    for (const f of [0.3, 0.72]) { const z = lerp(C.z, F.z, f); at(lerp(C.y, F.y, f), z + sh.can[0] * hT, z - sh.can[1] * hT, sh.canW * hT); }
    at(F.y, F.z + sh.fet[0] * hT, F.z - sh.fet[1] * hT, sh.fetW * hT);
  }
  if (st === 'ungulate') {
    const Co = J[5].p;
    stn.push({ c: F.clone().lerp(Co, 0.5).add(V3(0, 0, -0.004 * hT)), d: sh.pastR * hT, w: sh.pastR * hT * 0.92, perp: true });
    stn.push({ c: Co.clone(), d: sh.corR * hT, w: sh.corR * hT, perp: true });
  }
  const pts = stn.map(q => q.c), curve = makePath(pts), ku = knotUs(curve, pts.length);
  const cosT = stn.map((q, i) => { if (q.perp) return 1; const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const t = b.clone().sub(a); return clamp(Math.abs(t.y) / Math.max(1e-9, t.length()), 0.45, 1); });
  const pw = prof(stn.map((q, i) => [ku[i], q.w])), pd = prof(stn.map((q, i) => [ku[i], q.d * cosT[i]]));
  const g = loft({ curve, seg: Math.round((14 + 2.6 * pts.length) * det), rad: 2 * Math.round(5 * det + 2), w: pw, ht: pd, hb: pd, nt: 2.15, nb: 2.15, up: [0, 0, 1],
    cap0: { type: 'round', len: 0.6, n: 3 }, cap1: { type: 'round', len: 0.45, n: 2 }, bend: 0.5 });
  lm.grid = g; lm.us = ku;
  const nb = lm.bones.length, sj = J.slice(0, nb + 1).map(j => j.p);
  const skin = planeSkin(rig, sj, lm.bones, [0.07 * h, 0.05 * h, 0.03 * h, 0.025 * h], [-0.3, 0.45], 'Chest');
  emit(B.part(nm, { group: 'legs' }), g, (u, a, P) => B.paint({ part: 'leg', u, a, P, front: true, side: lm.side }), skin);
  return g;
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
    if (!lm.front && lm.kind && HIND_SHAPE[lm.kind]) {
      const nm = `leg-hind-${lm.side > 0 ? 'left' : 'right'}`;
      tetraHindLeg(B, S, L, lm, nm);
      tetraFoot(B, S, L, lm, foot, nm);
      continue;
    }
    if (lm.front && FORE_SHAPE[lm.st] && J.length >= (lm.st === 'ungulate' ? 7 : 6)) {
      const nm = `leg-front-${lm.side > 0 ? 'left' : 'right'}`;
      tetraForeLeg(B, S, L, lm, nm);
      tetraFoot(B, S, L, lm, foot, nm);
      continue;
    }
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
    // Digital Diorama revision 4: a real hoof wall (it was a cylinder pushed forward at the bottom: a wedge / boot)
    const C = J[n - 2].p, T = J[n - 1].p, r = J[n - 2].w * 1.05, cloven = foot === 'cloven';
    const hd = hoofDims(S, r, C.y, hindLayoutFor(S, 'ungulate').wall);
    const f = V3(T.x - C.x, 0, T.z - C.z); if (f.lengthSq() < 1e-12) f.set(0, 0, 1); f.normalize();
    const sd = V3(f.z, 0, -f.x), R = 2 * Math.round(6 * det + 3), NR = 5;
    for (const cl of cloven ? [-1, 1] : [0]) {
      // per claw: ground outline (bearing edge) and coronary band; angle a = π/2 is the toe
      const gap = cloven ? 0.06 * hd.b : 0, bw = cloven ? hd.b * 0.5 : hd.b, bwc = cloven ? hd.bc * 0.52 : hd.bc;
      const gC = T.clone().addScaledVector(f, -hd.a).addScaledVector(sd, cl * (bw + gap)), cC = C.clone().addScaledVector(sd, cl * bwc * 0.92);
      const ring = (ctr, hl, hw, yOf) => Array.from({ length: R }, (_, j) => {
        const a = (j / R) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        let x = hw * ca, z = hl * sa;
        if (cloven) {
          if (ca * cl < 0) x *= 0.58;                       // the flatter inner wall faces the cleft
          x *= 1 - 0.38 * Math.max(0, sa) ** 3;             // claws taper to a point at the toe
          z = hl * Math.sign(sa) * Math.abs(sa) ** 0.85;
        }
        return ctr.clone().addScaledVector(sd, x).addScaledVector(f, z).setY(yOf(sa));
      });
      const top = ring(cC, hd.ac, bwc, (sa) => lerp(hd.heelH, hd.toeH, (1 + sa) / 2));
      const bot = ring(gC, hd.a, bw, () => 0);
      const rows = [];
      for (let k = 0; k < NR; k++) { const t = k / (NR - 1), fl = 1 + 0.05 * Math.sin(Math.PI * t * 0.9); rows.push(top.map((p, j) => { const q = p.clone().lerp(bot[j], t), c = (k === NR - 1 ? gC : cC.clone().lerp(gC, t)).clone().setY(q.y); return c.add(q.sub(c).multiplyScalar(fl)); })); }
      const capTop = cC.clone().setY(lerp(hd.heelH, hd.toeH, 0.5) + r * 0.25);
      emit(part, { rows, us: rows.map((_, k) => k / (NR - 1)), R, closed: false, tip0: capTop, tip1: gC.clone().setY(0), main: [0, NR - 1] }, 'hoof', W);
    }
    if (cloven && S.dewclaws !== false) for (const hx of [-1, 1]) {
      const fj = J[n - 3].p;
      emit(part, tube([fj.clone().add(V3(hx * r * 0.5, -r * 0.35, -r * 0.85)), fj.clone().add(V3(hx * r * 0.6, -r * 0.9, -r * 1.15))], (u) => r * 0.26 * (1 - u * 0.6), 3, 5, { cap1: 'point' }), 'hoof', W);
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
  if (foot === 'paw') {
    // Digital Diorama revision 4: a compact paw — a rounded pad under the paw joint and arched toe bulbs in an arc
    // ahead of it, the middle toes longest (it was a long flat slipper with stubs on the front)
    const P = J[n - 2].p, T = J[n - 1].p, r = Math.max(J[n - 2].w, 0.018 * H * (S.legThk || 1)) * ((lm.front ? S.foreBulk : S.hindBulk) ?? S.limbBulk ?? 1) ** 0.75;
    const fwd = V3(T.x - P.x, 0, T.z - P.z); if (fwd.lengthSq() < 1e-12) fwd.set(0, 0, 1); fwd.normalize();
    const lat = V3(fwd.z, 0, -fwd.x), len = Math.max(Math.hypot(T.x - P.x, T.z - P.z), r);
    const pw = r * 1.08 * (S.pawW || 1), padH = Math.max(P.y, r * 0.7);
    const pc = P.clone().addScaledVector(fwd, len * 0.12); pc.y = padH * 0.5;
    emit(part, ellipsoid(pc, pw * 0.88, padH * 0.56, Math.max(len * 0.38, r * 0.85), fwd, [0, 1, 0], 6, 2 * Math.round(6 * det + 2)), footPaint, rig.W2(prevB, last, 0.7));
    const toes = S.toes ?? 4, tr = pw * (toes > 4 ? 0.3 : 0.37);
    for (let i = 0; i < toes; i++) {
      const t = toes === 1 ? 0 : i / (toes - 1) - 0.5, at = Math.abs(t) * 2;
      const dir = fwd.clone().addScaledVector(lat, t * 0.45).normalize();
      const c = P.clone().addScaledVector(fwd, len * (0.66 - 0.2 * at * at)).addScaledVector(lat, t * pw * 1.45); c.y = tr * 0.92;
      emit(part, ellipsoid(c, tr, tr * 0.92, tr * 1.3, dir, [0, 1, 0], 5, 8), footPaint, W);
      if (S.claws) {
        const cl = S.claws * tr, cs = c.clone().addScaledVector(dir, tr * 1.1).add(V3(0, tr * 0.1, 0));
        emit(part, tube([cs, cs.clone().addScaledVector(dir, cl * 0.55).add(V3(0, -cl * 0.1, 0)), cs.clone().addScaledVector(dir, cl * 0.85).add(V3(0, -cl * 0.55, 0))], (u) => tr * 0.3 * (1 - u * 0.9), 4, 4, { cap1: 'point' }), 'hoof', W);
      }
    }
    return;
  }
  if (foot === 'sole') {
    const sole = true, hj = J[n - 3];
    const heel = hj.p, toe = J[n - 1].p, r = Math.max(hj.w, 0.018 * H * (S.legThk || 1)) * ((lm.front ? S.foreBulk : S.hindBulk) ?? S.limbBulk ?? 1) ** 0.75;
    const fwd = V3(toe.x - heel.x, 0, toe.z - heel.z).normalize();
    const pawW = r * (sole ? 1.12 : 1.1) * (S.pawW || 1), pawH = r * (sole ? 0.75 : 0.95), yMid = pawH * 0.55;
    const back = V3(heel.x, yMid + (sole ? 0 : 0.3 * r), heel.z).addScaledVector(fwd, -(sole ? 0.45 : 0.55) * r);
    const front = V3(toe.x, yMid * 0.9, toe.z);
    const len = back.distanceTo(front);
    front.addScaledVector(fwd, -0.22 * len);
    // Digital Diorama revision 4: the heel rises to the ankle, so the leg flows into the foot (a board under a cone)
    const heelTop = Math.max(pawH * 0.75, heel.y - yMid + 0.35 * r);
    const g = loft({ pts: [back, front], seg: 8, rad: 2 * Math.round(6 * det + 2), up: [0, 1, 0],
      w: (u) => pawW * lerp(0.82, 1.0, sstep(0, 0.6, u)), ht: (u) => lerp(heelTop, pawH * 0.55, sstep(0, 0.75, u)), hb: () => yMid * 0.95, nt: 2.2, nb: 3.4,
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
    // (Digital Diorama revision 6: a ragged edge; the hard-edged rectangle made the rump read as a separate block)
    if (torso && S.saddle) {
      const nz = fbm(x * 6, y * 6, z * 6, seed + 21) - 0.5;
      if (sa > lerp(0.9, 0.35, S.saddle) + 0.35 * nz && u > U.haunch * 0.7 + 0.12 * nz && u < U.neckRoot + 0.06 * nz) zone = 'marking';
    }
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
const UNGULATE = { stance: 'ungulate', foreBulk: 1.15, hindBulk: 1.05, marks: { hooks: 0.045, fossa: 0.04, ribs: 0.025, girth: 0.035, breast: 0.06, withers: 0.04 }, keel: 0.42, waist: 0.04, croupFlat: 0.97, backFlat: 0.98, chestNarrow: 0.74, neckRootW: 0.62, withersTop: 0.55, quarters: 1.0, quartersBox: 2.2, nose: 'muzzle', pupil: 'bar', eyeYaw: 64, eyeEl: 14, foot: 'cloven', ear: { style: 'pointed', s: 0.08, a: 0.62, spread: 40, tilt: 4, turn: 30 } };
const CANID = { stance: 'digitigrade', hindShape: { thighF: 0.14, breech: 0.075, hams: 0.015, kneeW: 0.055, patella: 0.04 }, foreBulk: 1.15, hindBulk: 1.05, marks: { hooks: 0.012, fossa: 0.025, ribs: 0.035, girth: 0.04, breast: 0.08, withers: 0.025, scapula: 0.025 }, keel: 0.46, waist: 0.17, croupFlat: 0.86, backFlat: 0.9, chestNarrow: 0.8, neckRootW: 0.66, withersTop: 0.72, quarters: 0.96, quartersBox: 2.1, nose: 'pad', whiskerPads: false, claws: 0.9, toes: 4, fang: 0.07, stop: 0.55, noseCap: 0.4, eyeYaw: 38, eyeEl: 14,
  ear: { style: 'pointed', len: 0.36, w: 0.62, s: 0.2, a: 0.6, spread: 18, tilt: 10, turn: 18, cup: 0.5 }, tail: { style: 'bushy', len: 0.55, thk: 0.045, set: -55, curl: 15, bush: 0.7 } };
const FELID = { stance: 'digitigrade', arch: 0.06, noseCap: 0.3, muzzleN: 2.5, occiput: 0.85, foreBulk: 1.45, hindBulk: 1.12, marks: { hooks: 0.01, fossa: 0.02, ribs: 0.02, girth: 0.035, breast: 0.05, scapula: 0.07 }, keel: 0.38, waist: 0.13, croupFlat: 0.88, backFlat: 0.9, chestNarrow: 0.76, neckRootW: 0.64, withersTop: 0.6, quarters: 0.98, quartersBox: 2.1, nose: 'feline', whiskerPads: true, pupil: 'slit', claws: 0.6, toes: 4, fang: 0.06, stop: 0.55, dome: 1.16, eyeYaw: 30, eyeEl: 12, snout: 0.3, snoutW: 0.72, snoutD: 0.76, cheek: 1.18,
  ear: { style: 'feline', len: 0.26, w: 0.85, s: 0.26, a: 0.66, spread: 26, tilt: 6, turn: 12, cup: 0.55 }, tail: { style: 'thin', len: 0.85, thk: 0.035, set: -40, curl: 30, tipCurl: 12 } };
const URSID = { stance: 'plantigrade', foreBulk: 1.35, hindBulk: 1.2, marks: { girth: 0.025, breast: 0.04, scapula: 0.03 }, keel: 0.2, waist: 0.03, croupFlat: 0.92, backFlat: 0.94, chestNarrow: 0.92, neckRootW: 0.76, withersTop: 0.88, quarters: 0.98, quartersBox: 2.1, nose: 'pad', claws: 1.1, toes: 5, footLen: 1.1, dome: 1.1, stop: 0.35, eyeYaw: 32, eye: 0.04, neckThk: 0.85,
  ear: { style: 'round', len: 0.2, w: 0.95, s: 0.24, a: 0.78, spread: 28, tilt: 4, turn: 12, cup: 0.5 }, tail: { style: 'thin', len: 0.1, thk: 0.06, set: -40 } };
const RODENT = { stance: 'digitigrade', keel: 0.14, waist: 0.02, nose: 'pad', incisors: 0.09, whiskerPads: true, claws: 0.6, toes: 4, eye: 0.11, eyeYaw: 70, stop: 0.2, crouch: 0.8, hockH: 0.13, footLen: 1.6, thighW: 0.5, thighD: 0.52 };

const SPECIES_DEFS = {
  horse: { label: 'Horse', fam: UNGULATE, foreBulk: 1.22, hindBulk: 1.1, H: 1.6, len: 1.02, depth: 0.44, width: 0.8, rump: 0.99, hipW: 1.06, tuck: 0.18, belly: 0.25, withers: 0.14,
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
  cow: { label: 'Dairy Cow', fam: UNGULATE, marks: { hooks: 0.11, fossa: 0.06, ribs: 0.02, girth: 0.03, breast: 0.05, withers: 0.025, spine: 0.03 }, keel: 0.3, hind: { kY: 0.72, kZ: 0.14, aY: 0.45, aZ: -0.05, fY: 0.15, fZ: -0.04, cY: 0.058 }, H: 1.42, len: 1.16, depth: 0.58, width: 0.86, rump: 1.0, hipW: 1.1, rumpDepth: 0.95, tuck: 0.05, belly: 0.4,
    neckAng: 22, neckLen: 0.3, neckThk: 0.75, neckW: 0.72, headAng: 62, headLen: 0.39, headD: 0.27, headW: 0.25, snout: 0.5, snoutW: 0.8, snoutD: 0.66, stop: 0.05, cheek: 1.12, jowl: 1.2, muzzleN: 2.0, eye: 0.045, eyeS: 0.3,
    ear: { style: 'pointed', len: 0.3, w: 0.55, s: 0.12, a: 1.15, spread: 75, tilt: -10, turn: 40, cup: 0.4 }, horns: { style: 'cattle', len: 0.32, thk: 0.06, s: 0.04, a: 0.95 },
    tail: { style: 'tuft', len: 0.62, thk: 0.022, set: -84, tuft: 2.4 }, pattern: 'patches', countershade: 0.1, muzzle: 'light', muzzleS: 0.8, udder: 0.13,
    palette: pal({ body: '#f1ede4', belly: '#f4f0e8', pattern: '#1c1a19', marking: '#1c1a19', nose: '#d99a96', skin: '#d99a96', horn: '#e2d6b6', hoof: '#3b3330' }) },
  deer: { label: 'White-tailed Deer', fam: UNGULATE, marks: { hooks: 0.06, fossa: 0.06, ribs: 0.03, girth: 0.04, breast: 0.06, withers: 0.04 }, hind: { kY: 0.73, kZ: 0.15, aY: 0.5, aZ: -0.12, fY: 0.13, fZ: -0.1, cY: 0.05, wall: 48 }, H: 1.0, len: 1.0, depth: 0.42, width: 0.78, rump: 1.02, tuck: 0.3, neckAng: 52, neckLen: 0.48, neckThk: 0.55, neckW: 0.7,
    headAng: 55, headLen: 0.31, headD: 0.26, headW: 0.22, snout: 0.55, snoutW: 0.5, snoutD: 0.5, stop: 0.15, eye: 0.06, eyeS: 0.32, legThk: 0.72,
    ear: { style: 'pointed', len: 0.5, w: 0.56, s: 0.1, a: 0.85, spread: 45, tilt: 4, turn: 35, cup: 0.6 }, horns: { style: 'whitetail', len: 1.15, thk: 0.075, s: 0.09, a: 0.5, tines: 4 },
    tail: { style: 'flat', len: 0.2, thk: 0.035, set: -20, flat: 2 }, tailUnder: true, rumpPatch: true, countershade: 0.55, muzzle: 'dark', muzzleS: 0.9,
    palette: pal({ body: '#9a6b42', belly: '#efe7da', marking: '#2a1d14', nose: '#1d1715', horn: '#cbb48c' }) },
  // Digital Diorama revision: a deeper chest, thick ruff and fuller tail (it looked shaved), grizzled agouti coat
  // with a dark saddle, tawny legs, pale lips and cheeks under a dark nose (not a white nose tip), dark tail tip
  wolf: { label: 'Gray Wolf', fam: CANID, arch: 0.03, H: 0.8, len: 1.15, depth: 0.46, width: 0.8, rump: 0.97, tuck: 0.36, neckAng: 30, neckLen: 0.32, neckThk: 1.0,
    headAng: 22, headLen: 0.32, headD: 0.27, headW: 0.34, snout: 0.5, snoutW: 0.46, snoutD: 0.5, eye: 0.045, legThk: 1.02, saddle: 0.26, countershade: 0.6, muzzle: 'light', muzzleS: 0.45, muzzleLow: true, cheeks: true,
    tail: { style: 'bushy', len: 0.55, thk: 0.07, set: -62, curl: 12, bush: 0.85 }, tailTip: 0.12, tailTipZone: 'marking', legZone: 'mane', grain: 2.4,
    palette: pal({ body: '#8b8276', belly: '#e6dfd1', marking: '#57504a', mane: '#b09673', eye: '#b9892c', nose: '#1a1817' }) },
  cat: { label: 'Domestic Cat', fam: FELID, arch: 0.09, belly: 0.18, H: 0.25, len: 1.45, depth: 0.46, width: 0.7, rump: 1.04, tuck: 0.25, neckAng: 34, neckLen: 0.3, neckThk: 0.75,
    // Digital Diorama revision: a brown mackerel tabby, eyes set into the face (they bulged from the sides)
    headAng: 12, headLen: 0.34, headD: 0.44, headW: 0.42, snout: 0.25, eye: 0.092, eyeInset: 0.74, eyeYaw: 26, legThk: 1.05, footLen: 1.1, hockH: 0.26, neckThk: 0.85,
    ear: { len: 0.36, w: 0.78 }, tail: { len: 1.1, thk: 0.034, set: 20, curl: 45, tipCurl: 20 }, pattern: 'tabby', countershade: 0.55, cheeks: true, grain: 1.6,
    palette: pal({ body: '#8f7b5e', belly: '#dccfb6', pattern: '#2e2419', marking: '#2e2419', eye: '#a9a83c', nose: '#c27c72', skin: '#d99a92' }) },
  // Digital Diorama revision (big cats): heavier forelimbs, a broader, deeper body and a broader head
  lion: { label: 'Lion', fam: FELID, foreBulk: 1.55, hindBulk: 1.15, belly: 0.25, H: 1.15, len: 1.35, depth: 0.52, width: 0.86, rump: 0.98, tuck: 0.15, neckAng: 22, neckLen: 0.3, neckThk: 0.95,
    headAng: 18, headLen: 0.32, headD: 0.43, headW: 0.35, snout: 0.4, snoutW: 0.7, snoutD: 0.64, stop: 0.4, eye: 0.042, legThk: 1.28,
    ear: { style: 'round', len: 0.17, w: 0.95, s: 0.24, a: 0.8 }, tail: { style: 'tuft', len: 0.8, thk: 0.028, set: -60, curl: 20, tuft: 2.6 }, mane: { style: 'lion', size: 0.72 }, countershade: 0.45, cheeks: true, earTip: 0.4,
    palette: pal({ body: '#c09356', belly: '#e9d4ae', marking: '#3a2a1c', mane: '#6b4425', eye: '#b8862a', nose: '#6a3d35' }) },
  tiger: { label: 'Bengal Tiger', fam: FELID, foreBulk: 1.55, hindBulk: 1.15, belly: 0.28, H: 1.0, len: 1.55, depth: 0.55, width: 0.88, rump: 1.0, tuck: 0.12, neckAng: 22, neckLen: 0.28, neckThk: 0.98,
    headAng: 15, headLen: 0.33, headD: 0.43, headW: 0.37, snout: 0.36, eye: 0.042, legThk: 1.32, cheek: 1.32, ear: { style: 'round', len: 0.17, w: 0.95, s: 0.24, a: 0.82 },
    tail: { style: 'thin', len: 0.95, thk: 0.045, set: -45, curl: 25, tipCurl: 15 }, pattern: 'tiger', countershade: 0.55, cheeks: true, earZone: 'pattern',
    palette: pal({ body: '#d27a2c', belly: '#f3ead8', pattern: '#1b1310', marking: '#1b1310', eye: '#c8a034', nose: '#c07a72' }) },
  elephant: { label: 'African Elephant', fam: { stance: 'graviportal', nose: 'none' }, keel: 0.2, waist: 0.02, hind: { kY: 0.5, kZ: 0.06, aY: 0.19, aZ: -0.02 }, H: 3.0, len: 1.02, depth: 0.5, width: 0.92, rump: 0.93, rumpDepth: 0.92, tuck: 0, belly: 0.15,
    // Digital Diorama revision: a big domed head; ears hang back over the shoulders from their front edge
    // (they used to spread both ways from the root and jut forward over the face); a longer, thicker trunk;
    // the back dips behind the shoulders
    neckAng: 12, neckLen: 0.08, neckThk: 0.95, neckW: 0.9, headAng: 42, headLen: 0.38, headD: 0.7, headW: 0.46, snout: 0.28, snoutW: 0.62, snoutD: 0.62, stop: 0, dome: 1.2, eye: 0.025, eyeS: 0.6, eyeYaw: 78, eyeEl: 0, legThk: 1.2, nails: 4, sag: 0.06,
    ear: { style: 'fan', fanH: 0.62, fanW: 0.4, fanTop: 0.4, fanGap: 0.09, len: 1.12, w: 0.42, s: 0.2, a: 1.05 }, trunk: { len: 0.78, thk: 0.19, curl: 0.6 }, tusks: { style: 'elephant', len: 0.42, thk: 0.1, s: 0.78, a: 0.75 },
    tail: { style: 'tuft', len: 0.38, thk: 0.02, set: -80, tuft: 1.8 }, countershade: 0,
    palette: pal({ body: '#7f7a74', belly: '#77726c', marking: '#5d5853', mane: '#2b2826', skin: '#8f7d78', hoof: '#cfc6b6', teeth: '#efe5cc' }) },
  giraffe: { label: 'Giraffe', fam: UNGULATE, hind: { kY: 0.78, kZ: 0.12, aY: 0.53, aZ: -0.07, fY: 0.12, fZ: -0.06, cY: 0.045 }, hindShape: { breech: 0.08, hams: 0, inset: 0.06 }, H: 3.0, len: 0.62, depth: 0.34, width: 0.82, rump: 0.82, rumpDepth: 0.9, tuck: 0.2, withers: 0.25,
    neckAng: 62, neckLen: 0.66, neckThk: 0.5, neckW: 0.62, headAng: 60, headLen: 0.19, headD: 0.24, headW: 0.2, snout: 0.55, snoutW: 0.6, snoutD: 0.5, stop: 0.1, eye: 0.06, eyeS: 0.3, legThk: 0.55, tibiaSlope: 0.7,
    ear: { style: 'pointed', len: 0.4, w: 0.42, s: 0.12, a: 1.05, spread: 70, tilt: -5, turn: 35 }, horns: { style: 'ossicones', len: 0.45, thk: 0.07, s: 0.1, a: 0.42 },
    tail: { style: 'tuft', len: 0.3, thk: 0.012, set: -80, tuft: 2.5 }, mane: { style: 'crest', h: 0.025 }, pattern: 'giraffe', countershade: 0,
    palette: pal({ body: '#e5cf9e', belly: '#efe0bd', pattern: '#9b5a2a', mane: '#6a3b1c', hoof: '#2e2724', horn: '#5a3a1f', nose: '#4a3a32' }) },
  bear: { label: 'Brown Bear', fam: URSID, H: 1.1, len: 1.3, depth: 0.56, width: 0.95, rump: 0.97, tuck: 0.05, belly: 0.3, withers: 0.18, neckAng: 14, neckLen: 0.26,
    headAng: 22, headLen: 0.33, headD: 0.32, headW: 0.34, snout: 0.42, snoutW: 0.5, snoutD: 0.55, legThk: 1.25, countershade: 0.1, muzzle: 'light', muzzleS: 0.7,
    palette: pal({ body: '#6b4a2e', belly: '#5d3f27', marking: '#3a2818', hoof: '#2a2420', nose: '#161210' }) },
  pig: { label: 'Domestic Pig', fam: UNGULATE, marks: { breast: 0.03 }, keel: 0.1, waist: 0, hind: { kY: 0.66, kZ: 0.17, aY: 0.38, aZ: -0.06, fY: 0.13, fZ: -0.035, cY: 0.05 }, H: 0.8, len: 1.4, depth: 0.62, width: 0.92, rump: 1.02, hipW: 1.08, tuck: 0, belly: 0.4, neckAng: 8, neckLen: 0.06, neckThk: 0.92, neckW: 0.95,
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
    headAng: 15, headLen: 0.4, headD: 0.36, headW: 0.4, snout: 0.42, snoutW: 0.74, snoutD: 0.8, muzzleN: 2.7, noseCap: 0.32, stop: 0.95, brow: 0.1, dome: 1.06, eye: 0.045, jowl: 1.3, legThk: 1.18,
    ear: { style: 'floppy', len: 0.44, w: 0.56, s: 0.2, a: 1.0, spread: 40, droop: 0.97, hang: 58, cup: 0.08, innerW: 0 }, tail: { style: 'thin', len: 0.6, thk: 0.07, set: -10, curl: -10 },
    countershade: 0.15, palette: pal({ body: '#e2c38c', belly: '#ecd4a8', nose: '#2a1d18', eye: '#5a3a1c' }) },
  fox: { label: 'Red Fox', fam: CANID, hindBulk: 0.92, hindShape: { thighF: 0.12, breech: 0.06, hams: 0.01, kneeW: 0.05, patella: 0.035 }, arch: 0.04, H: 0.4, len: 1.4, depth: 0.42, width: 0.7, rump: 1.0, tuck: 0.4, neckAng: 32, neckLen: 0.3, neckThk: 0.72,
    headAng: 18, headLen: 0.36, headD: 0.24, headW: 0.3, snout: 0.55, snoutW: 0.36, snoutD: 0.42, eye: 0.05, legThk: 0.8, pupil: 'slit', slitW: 0.3,
    ear: { len: 0.45, w: 0.58 }, tail: { style: 'bushy', len: 0.95, thk: 0.1, set: -35, curl: 10, bush: 1.0 }, points: 0.55, tailTip: 0.14, tailTipZone: 'belly', earTip: 0.0, earZone: 'marking', countershade: 0.6, cheeks: true, grain: 1.5, neckThk: 0.85,
    palette: pal({ body: '#c4561e', belly: '#efe6da', marking: '#231a16', eye: '#c08c2a', nose: '#181412' }) },
  hyena: { label: 'Spotted Hyena', fam: CANID, foreBulk: 1.3, hindBulk: 1.05, waist: 0.1, hind: { aY: 0.33 }, H: 0.85, len: 1.1, depth: 0.5, width: 0.72, rump: 0.8, rumpDepth: 0.85, withers: 0.15, neckAng: 25, neckLen: 0.34, neckThk: 0.9,
    headAng: 20, headLen: 0.36, headD: 0.32, headW: 0.34, snout: 0.4, snoutW: 0.55, snoutD: 0.6, eye: 0.04,
    ear: { style: 'round', len: 0.27, w: 0.85 }, tail: { style: 'bushy', len: 0.38, thk: 0.035, set: -70, bush: 0.6 }, mane: { style: 'crest', h: 0.05 }, pattern: 'hyena', countershade: 0.2, muzzle: 'dark', muzzleS: 0.6,
    palette: pal({ body: '#b49a6c', belly: '#c8b38a', pattern: '#3a2b1e', marking: '#2d241b', mane: '#3a2b1e', nose: '#151110' }) },
  cheetah: { label: 'Cheetah', fam: FELID, arch: 0.12, marks: { hooks: 0.04, fossa: 0.03, ribs: 0.04, girth: 0.05, breast: 0.05, scapula: 0.06, spine: 0.015 }, foreBulk: 1.15, hindBulk: 1.0, waist: 0.22, keel: 0.5, hind: { kY: 0.68, kZ: 0.18, aY: 0.34, aZ: -0.11, fY: 0.07, fZ: -0.09, toe: 0.12 }, H: 0.8, len: 1.25, depth: 0.44, width: 0.62, rump: 0.98, tuck: 0.65, chestW: 0.95, neckAng: 25, neckLen: 0.3, neckThk: 0.72,
    headAng: 12, headLen: 0.24, headD: 0.42, headW: 0.37, snout: 0.3, eye: 0.06, legThk: 0.84, claws: 0.4, ear: { style: 'round', len: 0.2, w: 0.95, s: 0.26, a: 0.85 },
    tail: { style: 'thin', len: 0.85, thk: 0.032, set: -55, curl: 30, tipCurl: 25 }, pattern: 'spots', tearMark: true, countershade: 0.55, cheeks: true,
    palette: pal({ body: '#d9a856', belly: '#f2e6cc', pattern: '#1d1712', marking: '#1d1712', eye: '#b8862a', nose: '#2a1f1a' }) },
  leopard: { label: 'Leopard', fam: FELID, foreBulk: 1.5, hindBulk: 1.12, belly: 0.2, H: 0.65, len: 1.5, depth: 0.5, width: 0.8, rump: 1.0, tuck: 0.18, neckAng: 24, neckLen: 0.3, neckThk: 0.92,
    headAng: 14, headLen: 0.32, headD: 0.43, headW: 0.37, snout: 0.33, eye: 0.045, legThk: 1.18, ear: { style: 'round', len: 0.2, w: 0.95, s: 0.24, a: 0.8 },
    tail: { style: 'thin', len: 1.2, thk: 0.035, set: -40, curl: 30, tipCurl: 20 }, pattern: 'rosettes', countershade: 0.55, cheeks: true,
    palette: pal({ body: '#d6a54e', belly: '#f2e5c8', pattern: '#1f1611', marking: '#a86a26', eye: '#b8a03a', nose: '#b07a6a' }) },
  lynx: { label: 'Eurasian Lynx', fam: FELID, H: 0.62, len: 1.12, depth: 0.48, width: 0.72, rump: 1.06, tuck: 0.3, neckAng: 28, neckLen: 0.28, neckThk: 0.82,
    headAng: 14, headLen: 0.3, headD: 0.43, headW: 0.38, snout: 0.28, cheek: 1.45, eye: 0.055, legThk: 1.05, footLen: 1.15, pawW: 1.25,
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
  raccoon: { label: 'Raccoon', fam: { ...URSID, stance: 'plantigrade' }, hind: { kY: 0.5, foot: 0.38 }, H: 0.3, len: 1.3, depth: 0.66, width: 0.95, rump: 1.2, tuck: 0.1, neckAng: 25, neckLen: 0.22, neckThk: 0.95, legThk: 1.2, grain: 2.2,
    headAng: 15, headLen: 0.42, headD: 0.3, headW: 0.42, snout: 0.45, snoutW: 0.35, snoutD: 0.4, stop: 0.45, eye: 0.05, cheek: 1.35, claws: 0.6,
    ear: { style: 'round', len: 0.26, w: 0.85, s: 0.22, a: 0.68, spread: 20 }, tail: { style: 'bushy', len: 0.85, thk: 0.085, set: -30, bush: 0.5 }, pattern: 'raccoon', countershade: 0.3, earTip: 0.0, earZone: 'belly',
    palette: pal({ body: '#8a847b', belly: '#cfc8bb', pattern: '#1e1c1a', marking: '#2b2825', nose: '#121010' }) },
  badger: { label: 'European Badger', fam: URSID, hind: { kY: 0.44, kZ: 0.12, foot: 0.42 }, H: 0.28, len: 2.1, depth: 0.7, width: 1.25, grain: 1.8, rump: 1.0, tuck: 0, belly: 0.2, neckAng: 10, neckLen: 0.3, neckThk: 0.85,
    headAng: 18, headLen: 0.55, headD: 0.24, headW: 0.32, snout: 0.5, snoutW: 0.4, snoutD: 0.45, stop: 0.05, dome: 0.9, eye: 0.03, legThk: 1.4, claws: 1.4,
    ear: { style: 'round', len: 0.14, w: 1.0, s: 0.22, a: 0.95 }, tail: { style: 'bushy', len: 0.45, thk: 0.06, set: -20, bush: 0.4 }, pattern: 'badger', countershade: 0,
    palette: pal({ body: '#8f8a84', belly: '#ece8df', pattern: '#1a1918', marking: '#1a1918', nose: '#121010' }) },
  otter: { label: 'River Otter', fam: { stance: 'plantigrade', nose: 'pad', whiskerPads: true, claws: 0.3 }, hind: { kY: 0.46, foot: 0.46 }, H: 0.3, len: 2.4, depth: 0.58, width: 0.92, rump: 1.02, tuck: 0.05, neckAng: 18, neckLen: 0.42, neckThk: 0.92,
    headAng: 8, headLen: 0.42, headD: 0.24, headW: 0.38, snout: 0.35, snoutW: 0.6, snoutD: 0.55, stop: 0.25, dome: 0.9, eye: 0.045, eyeEl: 30, legThk: 1.2, footLen: 1.1, webbed: true, toes: 5,
    ear: { style: 'round', len: 0.12, w: 1.0, s: 0.24, a: 1.0 }, tail: { style: 'thin', len: 1.35, match: 0.75, set: -15 }, countershade: 0.45, cheeks: true,
    palette: pal({ body: '#5e432c', belly: '#a68e72', nose: '#121010', web: '#3a2a1e' }) },
  // Digital Diorama revision: a round body under a dense coat of short spines laid back (painted between the
  // modelled quills), rather than sparse long spikes on a long body
  hedgehog: { label: 'Hedgehog', fam: { stance: 'plantigrade', nose: 'pad', claws: 0.5 }, hind: { kY: 0.42, kZ: 0.1, foot: 0.46 }, H: 0.115, len: 1.35, depth: 0.86, width: 1.2, rump: 1.0, tuck: 0, neckAng: 15, neckLen: 0.12, neckThk: 0.95,
    headAng: 25, headLen: 0.5, headD: 0.3, headW: 0.36, snout: 0.5, snoutW: 0.3, snoutD: 0.32, stop: 0.1, eye: 0.06, legThk: 1.4, quills: { len: 0.2, count: 560, lay: 1.35 }, spinyBack: true,
    ear: { style: 'round', len: 0.2, w: 1.0, s: 0.25, a: 0.95 }, tail: { style: 'thin', len: 0.12, thk: 0.06, set: -30 }, countershade: 0.6,
    palette: pal({ body: '#7d6a55', belly: '#cbb59a', marking: '#c9b996', pattern: '#4f3e2d', nose: '#121010', skin: '#d4a090' }) },
  // Digital Diorama revision: a compact, crouched body low on short legs (it stood on stilts like a cat) and a
  // tail as bushy as the body is deep, arching up behind the back
  squirrel: { label: 'Red Squirrel', fam: RODENT, hind: { kZ: 0.34, aZ: -0.16, foot: 0.68 }, H: 0.095, len: 1.9, depth: 0.74, width: 0.85, rump: 1.12, rumpDepth: 1.15, tuck: 0.15, neckAng: 40, neckLen: 0.18, neckThk: 0.9,
    headAng: 15, headLen: 0.5, headD: 0.38, headW: 0.44, snout: 0.32, eye: 0.12, legThk: 1.25,
    ear: { style: 'tufted', len: 0.42, w: 0.55, s: 0.2, a: 0.55, spread: 15 }, tail: { style: 'bushy', len: 1.8, thk: 0.24, set: 62, curl: -8, tipCurl: -22, bush: 0.9 },
    countershade: 0.65, palette: pal({ body: '#b5561f', belly: '#f2e4cc', marking: '#7a3812', nose: '#3a2a22', eye: '#140e0b' }) },
  beaver: { label: 'Beaver', fam: { ...RODENT, stance: 'plantigrade', crouch: 0 }, hind: { kY: 0.45, kZ: 0.15, foot: 0.62 }, H: 0.32, len: 2.0, depth: 0.72, width: 1.0, rump: 1.15, rumpDepth: 1.1, tuck: 0, neckAng: 20, neckLen: 0.22, neckThk: 0.95,
    headAng: 15, headLen: 0.45, headD: 0.3, headW: 0.38, snout: 0.38, snoutW: 0.62, snoutD: 0.6, eye: 0.04, incisors: 0.12, webbed: 'hind', toes: 5, legThk: 1.25,
    ear: { style: 'round', len: 0.12, w: 1.0, s: 0.22, a: 0.95 }, tail: { style: 'flat', len: 0.95, thk: 0.15, set: -12, flat: 3.4 }, countershade: 0.2,
    palette: pal({ body: '#6a4426', belly: '#7a5232', marking: '#2c2420', web: '#2c2420', nose: '#151110', teeth: '#d8862a' }) },
  capybara: { label: 'Capybara', fam: { ...RODENT, crouch: 0.2, hockH: 0.2, footLen: 1.4, eye: 0.04 }, hind: { kY: 0.62, kZ: 0.2, aY: 0.24, aZ: -0.14, fY: 0.05, toe: 0.22 }, H: 0.52, len: 1.6, depth: 0.6, width: 0.85, rump: 1.06, tuck: 0.05, neckAng: 20, neckLen: 0.2, neckThk: 0.9,
    headAng: 30, headLen: 0.48, headD: 0.36, headW: 0.33, snout: 0.5, snoutW: 0.82, snoutD: 0.82, stop: 0.0, dome: 0.92, eyeEl: 30, nose: 'muzzle', nostril: 0.18,
    ear: { style: 'round', len: 0.12, w: 1.0, s: 0.12, a: 0.75 }, tail: { style: 'none', len: 0 }, countershade: 0.1,
    palette: pal({ body: '#8a6440', belly: '#9a744e', nose: '#2a1d16', skin: '#5a4030' }) },
  sheep: { label: 'Sheep', fam: UNGULATE, hind: { kY: 0.72, aY: 0.46, aZ: -0.08, fY: 0.15, fZ: -0.065, cY: 0.055 }, H: 0.8, len: 1.15, depth: 0.62, width: 1.0, rump: 1.0, tuck: 0, belly: 0.2, neckAng: 32, neckLen: 0.26, neckThk: 0.85,
    headAng: 55, headLen: 0.34, headD: 0.27, headW: 0.26, snout: 0.5, snoutW: 0.6, snoutD: 0.58, stop: 0.1, roman: 0.6, eye: 0.05, legThk: 0.85, wool: 0.06,
    ear: { style: 'pointed', len: 0.32, w: 0.42, s: 0.12, a: 1.2, spread: 80, tilt: -15, turn: 40 }, tail: { style: 'thin', len: 0.2, thk: 0.05, set: -80 },
    faceZone: 'marking', legZone: 'marking', countershade: 0, earZone: 'marking',
    palette: pal({ body: '#ece2cc', belly: '#e6dbc2', marking: '#2c2623', nose: '#1d1917', skin: '#2c2623' }) },
  bighorn: { label: 'Bighorn Sheep', fam: UNGULATE, hind: { kY: 0.72, aY: 0.46, aZ: -0.08, fY: 0.15, fZ: -0.065, cY: 0.055 }, H: 1.0, len: 1.1, depth: 0.52, width: 0.88, rump: 1.0, tuck: 0.2, neckAng: 40, neckLen: 0.3, neckThk: 0.85,
    headAng: 50, headLen: 0.3, headD: 0.29, headW: 0.27, snout: 0.5, snoutW: 0.58, snoutD: 0.55, stop: 0.15, roman: 0.4, eye: 0.05, legThk: 0.95,
    ear: { style: 'pointed', len: 0.3, w: 0.45, s: 0.14, a: 1.05, spread: 60, tilt: 0 }, horns: { style: 'ram', len: 1.45, thk: 0.17, s: 0.1, a: 0.5, curl: 1.85 },
    tail: { style: 'thin', len: 0.12, thk: 0.035, set: -60 }, rumpPatch: true, muzzle: 'light', muzzleS: 0.85, countershade: 0.35,
    palette: pal({ body: '#7a5f45', belly: '#eee4d4', horn: '#bfa77e', nose: '#2b2320' }) },
  goat: { label: 'Domestic Goat', fam: UNGULATE, marks: { hooks: 0.07, fossa: 0.05, ribs: 0.03, girth: 0.03, breast: 0.05, withers: 0.04, spine: 0.02 }, hind: { kY: 0.72, aY: 0.46, aZ: -0.08, fY: 0.15, fZ: -0.065, cY: 0.055 }, H: 0.75, len: 1.15, depth: 0.5, width: 0.8, rump: 1.02, tuck: 0.15, neckAng: 45, neckLen: 0.34, neckThk: 0.68,
    headAng: 55, headLen: 0.32, headD: 0.26, headW: 0.24, snout: 0.5, snoutW: 0.55, snoutD: 0.5, stop: 0.2, eye: 0.055, legThk: 0.85,
    ear: { style: 'pointed', len: 0.42, w: 0.38, s: 0.12, a: 1.1, spread: 75, tilt: -10, turn: 40 }, horns: { style: 'goat', len: 0.8, thk: 0.07, s: 0.08, a: 0.35 },
    tail: { style: 'flat', len: 0.16, thk: 0.03, set: 55 }, mane: { style: 'none', beard: 0.45 }, countershade: 0.1,
    palette: pal({ body: '#e8e1d2', belly: '#efe9dc', marking: '#8a7a68', mane: '#d8d0bf', horn: '#a39478', nose: '#9a7d74', eye: '#c8a034' }) },
  bison: { label: 'American Bison', fam: UNGULATE, marks: { hooks: 0.06, fossa: 0.03, breast: 0.04 }, hind: { kY: 0.68, kZ: 0.13, aY: 0.42, aZ: -0.05, fY: 0.14, fZ: -0.04, cY: 0.058 }, H: 1.8, len: 1.15, depth: 0.6, width: 0.85, rump: 0.8, rumpDepth: 0.8, tuck: 0.15, withers: 0.32, chestW: 1.15,
    neckAng: -5, neckLen: 0.2, neckThk: 0.95, neckW: 0.95, neckLow: 0.15, headAng: 78, headLen: 0.3, headD: 0.36, headW: 0.33, snout: 0.38, snoutW: 0.75, snoutD: 0.7, stop: 0.1, dome: 1.2, eye: 0.035,
    ear: { style: 'pointed', len: 0.2, w: 0.5, s: 0.16, a: 1.25, spread: 85, tilt: -10, turn: 40 }, horns: { style: 'cattle', len: 0.22, thk: 0.07, s: 0.1, a: 1.15 },
    tail: { style: 'tuft', len: 0.3, thk: 0.02, set: -70, tuft: 2.5 }, mane: { style: 'none', beard: 0.6 }, frontMane: 0.35, countershade: 0,
    palette: pal({ body: '#5a3d26', belly: '#4f3420', mane: '#2e1f14', horn: '#1e1a17', nose: '#151210' }) },
  gazelle: { label: "Thomson's Gazelle", fam: UNGULATE, marks: { hooks: 0.06, fossa: 0.06, ribs: 0.03, girth: 0.04, breast: 0.05, withers: 0.03 }, hind: { kY: 0.73, kZ: 0.15, aY: 0.5, aZ: -0.12, fY: 0.13, fZ: -0.1, cY: 0.05, wall: 48 }, H: 0.65, len: 1.0, depth: 0.42, width: 0.74, rump: 1.03, tuck: 0.4, neckAng: 52, neckLen: 0.42, neckThk: 0.52,
    headAng: 50, headLen: 0.32, headD: 0.26, headW: 0.24, snout: 0.5, snoutW: 0.5, snoutD: 0.48, stop: 0.15, eye: 0.07, legThk: 0.6,
    ear: { style: 'pointed', len: 0.45, w: 0.45, s: 0.12, a: 0.85, spread: 45 }, horns: { style: 'lyre', len: 0.95, thk: 0.06, s: 0.13, a: 0.32 },
    tail: { style: 'thin', len: 0.2, thk: 0.02, set: -40 }, tailTip: 0.5, flankStripe: true, rumpPatch: true, countershade: 0.6,
    palette: pal({ body: '#c58c4f', belly: '#f3ece0', marking: '#231a14', horn: '#3b302a', nose: '#1d1715' }) },
  moose: { label: 'Moose', fam: UNGULATE, hind: { kY: 0.72, aY: 0.49, aZ: -0.11, fY: 0.14, fZ: -0.095, cY: 0.055 }, H: 1.9, len: 0.98, depth: 0.45, width: 0.8, rump: 0.92, rumpDepth: 0.9, tuck: 0.15, withers: 0.18, neckAng: 25, neckLen: 0.28, neckThk: 0.8,
    headAng: 62, headLen: 0.36, headD: 0.24, headW: 0.2, snout: 0.62, snoutW: 0.75, snoutD: 0.8, stop: 0.05, roman: 0.9, drop: 0.25, eye: 0.03, legThk: 0.9,
    ear: { style: 'pointed', len: 0.38, w: 0.48, s: 0.12, a: 1.0, spread: 60, tilt: 0 }, horns: { style: 'palmate', len: 0.95, thk: 0.07, s: 0.12, a: 0.65 },
    tail: { style: 'thin', len: 0.06, thk: 0.03, set: -60 }, socks: 0.75, countershade: 0,
    palette: pal({ body: '#3e2b1d', belly: '#a0896d', marking: '#2a1d14', horn: '#c7b086', nose: '#1d1612' }) },
  reindeer: { label: 'Reindeer', fam: UNGULATE, hind: { kY: 0.72, aY: 0.48, aZ: -0.1, fY: 0.13, fZ: -0.085, cY: 0.05 }, H: 1.1, len: 1.05, depth: 0.5, width: 0.84, rump: 1.0, tuck: 0.15, neckAng: 35, neckLen: 0.35, neckThk: 0.75,
    headAng: 55, headLen: 0.33, headD: 0.25, headW: 0.22, snout: 0.55, snoutW: 0.7, snoutD: 0.6, stop: 0.08, eye: 0.045, legThk: 0.95, pawW: 1.2,
    ear: { style: 'pointed', len: 0.3, w: 0.5, s: 0.12, a: 0.95, spread: 55 }, horns: { style: 'antlers', len: 1.3, thk: 0.05, s: 0.1, a: 0.42, tines: 5 },
    tail: { style: 'flat', len: 0.12, thk: 0.035, set: -40 }, frontMane: 0.7, maneTop: 0.25, maneHead: false, rumpPatch: true, countershade: 0.3, muzzle: 'dark', muzzleS: 0.6, grain: 1.6,
    palette: pal({ body: '#7a6a58', belly: '#e4dccb', mane: '#ece4d4', marking: '#3d3127', horn: '#d0bc96', nose: '#2b2320' }) },
  camel: { label: 'Dromedary Camel', fam: { ...UNGULATE, foot: 'pad', nose: 'muzzle', pupil: 'round' }, marks: { hooks: 0.06, fossa: 0.04, girth: 0.03, breast: 0.08 }, hind: { kY: 0.62, kZ: 0.2, aY: 0.5, aZ: -0.07, fY: 0.13, fZ: -0.065, cY: 0.05 }, hindShape: { thighF: 0.08, breech: 0.13, hams: 0, kneeW: 0.05, gaskW: 0.045 }, thighW: 0.3, thighD: 0.3, H: 1.85, len: 0.82, depth: 0.42, width: 0.78, rump: 0.92, tuck: 0.22, humps: [{ u: 0.55, h: 0.2, w: 0.42 }],
    neckAng: 15, neckLen: 0.55, neckThk: 0.48, neckW: 0.6, neckArch: -0.12, headAng: 25, headLen: 0.3, headD: 0.27, headW: 0.21, snout: 0.5, snoutW: 0.5, snoutD: 0.68, muzzleN: 2.4, noseCap: 0.45, stop: 0.3, dome: 1.08, brow: 0.12, eye: 0.055, jaw: 0.7, chin: 0.3, legThk: 0.72, tibiaSlope: 0.7,
    ear: { style: 'round', len: 0.18, w: 0.8, s: 0.12, a: 0.8, spread: 40 }, tail: { style: 'tuft', len: 0.3, thk: 0.018, set: -80, tuft: 1.6 }, countershade: 0.1,
    palette: pal({ body: '#c9a06b', belly: '#d6b585', mane: '#8a6438', hoof: '#5a4a3a', nose: '#4a3a30' }) },
  llama: { label: 'Llama', fam: UNGULATE, hind: { kY: 0.7, aY: 0.47, aZ: -0.08, fY: 0.12, fZ: -0.06, cY: 0.05 }, H: 1.15, len: 0.95, depth: 0.5, width: 0.82, rump: 1.0, tuck: 0.15, neckAng: 78, neckLen: 0.62, neckThk: 0.55, neckW: 0.7,
    headAng: 30, headLen: 0.3, headD: 0.26, headW: 0.24, snout: 0.45, snoutW: 0.55, snoutD: 0.6, stop: 0.25, eye: 0.06, legThk: 0.85, wool: 0.05,
    ear: { style: 'long', len: 0.52, w: 0.38, s: 0.1, a: 0.5, spread: 18, tilt: 0, turn: 30, droop: 0.15 }, tail: { style: 'fluffy', len: 0.2, thk: 0.05, set: 30 },
    countershade: 0, palette: pal({ body: '#efe3cc', belly: '#efe3cc', marking: '#7a5a3a', nose: '#3a2b24' }) },
  rhino: { label: 'White Rhinoceros', fam: { stance: 'graviportal', nose: 'muzzle', pupil: 'round', nails: 3 }, keel: 0.2, waist: 0.02, hind: { kY: 0.55, kZ: 0.12, aY: 0.25, aZ: -0.05 }, H: 1.7, len: 1.45, depth: 0.62, width: 0.92, rump: 0.96, tuck: 0.05, belly: 0.3, withers: 0.25,
    neckAng: 0, neckLen: 0.18, neckThk: 0.95, neckW: 0.9, headAng: 55, headLen: 0.48, headD: 0.26, headW: 0.24, snout: 0.5, snoutW: 0.9, snoutD: 0.7, stop: 0, dome: 0.9, eye: 0.02, eyeYaw: 80, legThk: 1.25,
    ear: { style: 'pointed', len: 0.26, w: 0.42, s: 0.08, a: 0.55, spread: 30, tilt: 0, turn: 30, cup: 0.9 }, horns: { style: 'rhino', len: 0.75, thk: 0.09 },
    tail: { style: 'tuft', len: 0.3, thk: 0.03, set: -80, tuft: 1.6 }, countershade: 0,
    palette: pal({ body: '#8a847c', belly: '#827c74', horn: '#6a6058', hoof: '#57514b', skin: '#7a6e68', nose: '#4a4440' }) },
  hippo: { label: 'Hippopotamus', fam: { stance: 'graviportal', nose: 'muzzle', pupil: 'round', nails: 4 }, marks: { breast: 0.03 }, keel: 0.05, waist: 0, hind: { kY: 0.5, kZ: 0.12, aY: 0.22, aZ: -0.04 }, H: 1.5, len: 1.55, depth: 0.72, width: 1.05, rump: 1.0, tuck: 0, belly: 0.3,
    neckAng: 5, neckLen: 0.12, neckThk: 0.95, neckW: 0.95, headAng: 22, headLen: 0.5, headD: 0.42, headW: 0.36, snout: 0.52, snoutW: 1.25, snoutD: 1.0, muzzleN: 3.2, noseCap: 0.3, stop: 0.45, dome: 0.85, jaw: 0.85, jawW: 0.92, mouthS: 0.5, eye: 0.045, eyeYaw: 40, eyeEl: 58, turret: true, legThk: 1.4, nostrilA: 1.1,
    ear: { style: 'round', len: 0.1, w: 1.0, s: 0.1, a: 0.6 }, tail: { style: 'flat', len: 0.18, thk: 0.04, set: -70, flat: 2 }, countershade: 0.3,
    palette: pal({ body: '#6e605e', belly: '#c49088', skin: '#c49088', nose: '#4a3e3c', mouth: '#c47a78' }) },
  boar: { label: 'Wild Boar', fam: UNGULATE, marks: { breast: 0.04 }, keel: 0.15, waist: 0, hind: { kY: 0.66, kZ: 0.17, aY: 0.4, aZ: -0.06, fY: 0.13, fZ: -0.035, cY: 0.05 }, H: 0.85, len: 1.25, depth: 0.58, width: 0.75, rump: 0.86, rumpDepth: 0.9, tuck: 0.1, withers: 0.3, chestW: 1.08, neckAng: 5, neckLen: 0.08, neckThk: 0.95, neckW: 0.95,
    headAng: 35, headLen: 0.48, headD: 0.26, headW: 0.26, snout: 0.6, snoutW: 0.42, snoutD: 0.42, stop: 0.0, dome: 0.85, jowl: 1.3, eye: 0.025, nose: 'disc', muzzleN: 2.6,
    ear: { style: 'pointed', len: 0.28, w: 0.55, s: 0.14, a: 0.75, spread: 35, tilt: 10 }, tusks: { style: 'boar', len: 0.08, thk: 0.15, s: 0.85, a: 0.95 },
    tail: { style: 'tuft', len: 0.3, thk: 0.012, set: -70, tuft: 2.2 }, mane: { style: 'crest', h: 0.07 }, countershade: 0,
    palette: pal({ body: '#4a3a2e', belly: '#3e3026', mane: '#241c16', nose: '#3a2e28', hoof: '#1d1814' }) },
  anteater: { label: 'Giant Anteater', fam: { stance: 'plantigrade', nose: 'pad', claws: 2.2, toes: 4 }, hind: { kY: 0.5, kZ: 0.1, foot: 0.3 }, H: 0.75, len: 1.5, depth: 0.55, width: 0.65, rump: 1.02, tuck: 0.05, neckAng: 15, neckLen: 0.38, neckThk: 0.7,
    headAng: 25, headLen: 0.5, headD: 0.14, headW: 0.16, snout: 0.78, snoutW: 0.35, snoutD: 0.4, stop: 0, eye: 0.022, legThk: 1.1,
    ear: { style: 'round', len: 0.1, w: 1.0, s: 0.12, a: 0.9 }, tail: { style: 'hair', len: 0.75, thk: 0.07, set: -10, hair: 1.15, hairW: 5, hairBack: 0.9 }, pattern: 'anteater', countershade: 0, grain: 2,
    palette: pal({ body: '#5e4e3e', belly: '#d9cfbd', pattern: '#121010', mane: '#4a3c30', nose: '#121010' }) },
  // Digital Diorama revision: a low, rounded body on short legs (it stood on stilts)
  mouse: { label: 'House Mouse', fam: RODENT, hind: { kZ: 0.3, aZ: -0.15, foot: 0.66 }, H: 0.03, len: 2.4, depth: 0.82, width: 0.85, rump: 1.25, rumpDepth: 1.1, tuck: 0.1, neckAng: 30, neckLen: 0.16, neckThk: 0.9, legThk: 1.15,
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
 *  CLIPS & POSES (Digital Diorama revision 4: rewritten)
 *  The old gaits swung every joint on a sine wave, so feet slid, dipped below the ground and never planted,
 *  and every species moved alike. Now each foot follows a path — planted and carried back at body speed in
 *  stance, lifted and swung forward in swing, the hoof breaking over at push-off and flipping in the swing —
 *  and each leg is solved to reach it: hind legs as a pantograph (the cannon / rear pastern stays parallel to
 *  the thigh, as in real legs), forelegs swinging the shoulder blade with the forearm and keeping the knee
 *  straight in stance. Footfalls follow each family's real gaits (lateral walk; trot, or pace for camels and
 *  giraffes; transverse or rotary gallop; half-bound for rabbits, squirrels and mustelids; an amble for
 *  elephants), the body vaults over walking legs and bounces on running ones, and the spine flexes in gallops
 *  and bounds. Clips are timed by dynamic similarity (the Froude number, from hip height), and each gait clip
 *  records its stride so playback can match ground speed. Idle, graze, alert and roar keep the feet planted;
 *  sit is a sit for carnivores and rodents and lying down for hoofed animals and elephants.
 * ════════════════════════════════════════════════════════════════════════════ */
/* Digital Diorama revision 4: clips rewritten (see CLIPS & POSES above).
 * Footfall patterns: phase of each foot's touchdown in the cycle (LH = left hind …), duty = fraction of the
 * cycle a foot is on the ground (number, or { hind, front }), lambda = distance travelled per cycle in hip
 * heights, fr = Froude number v² / (g·h) the clip is timed for, lift = swing height (× hip height),
 * bob = body rise and fall (× hip height), spine = spine flexion in degrees (bounds and gallops), and the
 * hoof / paw motion: sink (fetlock giving under load), roll (breakover at push-off), toe (digit flexion in
 * swing), flexH / flexF (hock / knee flexion in swing), heel (plantigrade heel lift). */
const GAIT_LIB = {
  // lateral-sequence walk: left hind, left fore, right hind, right fore, a quarter cycle apart (timed as a relaxed,
  // grazing pace; faster walking plays it quicker)
  walk: { ph: { LH: 0, LF: 0.25, RH: 0.5, RF: 0.75 }, duty: 0.66, lambda: 1.3, fr: 0.14, lift: 0.075, bob: 0.012, run: false, sink: 6, roll: 22, toe: 45, flexH: 34, flexF: 52, heel: 30 },
  // camels, llamas and giraffes walk with the legs of one side almost together
  paceWalk: { ph: { LH: 0, LF: 0.12, RH: 0.5, RF: 0.62 }, duty: 0.64, lambda: 1.3, fr: 0.14, lift: 0.07, bob: 0.012, run: false, sink: 6, roll: 20, toe: 40, flexH: 32, flexF: 50, heel: 30 },
  // diagonal pairs together, a moment of suspension between them
  trot: { ph: { LH: 0, RF: 0, RH: 0.5, LF: 0.5 }, duty: 0.42, lambda: 2.15, fr: 1.0, lift: 0.15, bob: 0.028, run: true, sink: 12, roll: 28, toe: 65, flexH: 50, flexF: 88, heel: 38 },
  // the legs of one side together (camels, giraffes, llamas)
  pace: { ph: { LH: 0, LF: 0, RH: 0.5, RF: 0.5 }, duty: 0.45, lambda: 2.15, fr: 0.9, lift: 0.13, bob: 0.024, run: true, sink: 10, roll: 26, toe: 55, flexH: 45, flexF: 75, heel: 35 },
  // elephants never leave the ground: a fast lateral-sequence walk with shorter stance
  amble: { ph: { LH: 0, LF: 0.22, RH: 0.5, RF: 0.72 }, duty: 0.52, lambda: 1.8, fr: 0.55, lift: 0.07, bob: 0.014, run: false, sink: 3, roll: 14, toe: 20, flexH: 30, flexF: 45, heel: 20 },
  // transverse gallop (horses, cattle, rhinos): hinds then fores, the leading leg on the same side
  transverse: { ph: { LH: 0, RH: 0.12, LF: 0.42, RF: 0.54 }, duty: { hind: 0.3, front: 0.3 }, lambda: 3.0, fr: 4, lift: 0.2, bob: 0.045, run: true, spine: 3, sink: 16, roll: 32, toe: 80, flexH: 62, flexF: 100, heel: 40 },
  // rotary gallop (cats, dogs, deer, antelope): the lead changes side between hinds and fores; big spine flexion
  rotary: { ph: { LH: 0, RH: 0.1, RF: 0.44, LF: 0.54 }, duty: { hind: 0.28, front: 0.26 }, lambda: 3.3, fr: 4, lift: 0.22, bob: 0.05, run: true, spine: 10, sink: 14, roll: 30, toe: 70, flexH: 60, flexF: 95, heel: 40 },
  // half-bound (rabbits, squirrels, mice, otters): hind feet land together, fore feet one after the other
  bound: { ph: { LH: 0, RH: 0.03, LF: 0.5, RF: 0.6 }, duty: { hind: 0.3, front: 0.26 }, lambda: 3.0, fr: 3, lift: 0.2, bob: 0.06, run: true, spine: 16, sink: 0, roll: 30, toe: 40, flexH: 55, flexF: 70, heel: 45 },
  // a slow hop (rabbits and squirrels rarely walk): fore feet in turn, hind feet together
  hop: { ph: { LH: 0, RH: 0.02, LF: 0.45, RF: 0.62 }, duty: { hind: 0.52, front: 0.42 }, lambda: 1.25, hindO: -0.1, fr: 0.25, lift: 0.1, bob: 0.03, run: true, spine: 7, sink: 0, roll: 22, toe: 30, flexH: 40, flexF: 50, heel: 40 },
};
/** How each kind of foot rolls, sinks and flexes (multipliers on the gait's hoof values). */
const FOOT_MOTION = {
  hoof: { sink: 0, roll: 1, toe: 1 }, cloven: { sink: 0, roll: 1, toe: 0.9 },
  paw: { sink: 0, roll: 0.9, toe: 0.55 }, sole: { sink: 0, roll: 0.55, toe: 0.4 }, pad: { sink: 0, roll: 0.45, toe: 0.3 },
};
/** Gaits of each family: which footfall pattern each clip uses (null = no such clip). */
function gaitSetFor(S, p) {
  const st = S.stance, sp = p.species;
  if (S.gaits) return S.gaits;
  if (st === 'graviportal') return sp === 'rhino' ? { walk: 'walk', trot: 'trot', gallop: 'transverse' } : { walk: 'walk', trot: 'amble', gallop: null };
  if (sp === 'camel' || sp === 'llama' || sp === 'giraffe') return { walk: 'paceWalk', trot: 'pace', gallop: sp === 'giraffe' ? 'rotary' : 'transverse' };
  if (S.crouch >= 0.5 && st === 'digitigrade') return sp === 'mouse' ? { walk: 'walk', trot: 'trot', gallop: 'bound' } : { walk: 'hop', trot: 'hop', gallop: 'bound' };
  if (sp === 'hedgehog') return { walk: 'walk', trot: 'trot', gallop: null };
  if (sp === 'otter' || sp === 'beaver' || sp === 'badger') return { walk: 'walk', trot: 'trot', gallop: 'bound' };
  if (st === 'ungulate') return { walk: 'walk', trot: 'trot', gallop: ['deer', 'gazelle', 'reindeer', 'moose', 'goat', 'bighorn'].includes(sp) ? 'rotary' : 'transverse' };
  return { walk: 'walk', trot: 'trot', gallop: 'rotary' };
}
const GAIT_TUNE = { cheetah: { gallop: { lambda: 3.8, spine: 15, bob: 0.04 } }, rabbit: { trot: { lambda: 2.2, fr: 0.7 }, gallop: { lambda: 2.6 } }, squirrel: { trot: { lambda: 2.2, fr: 0.7 } } };
const RIGS = new WeakMap();

/* ── planar helpers in a bone's (z, y) plane: ψ = atan2(z, y); a rotation about +X by δ adds δ to ψ ── */
const v2 = (z, y) => ({ z, y });
const P2 = (v) => ({ z: v.z, y: v.y });
const add2 = (a, b) => v2(a.z + b.z, a.y + b.y), sub2 = (a, b) => v2(a.z - b.z, a.y - b.y), sc2 = (a, k) => v2(a.z * k, a.y * k);
const len2 = (a) => Math.hypot(a.z, a.y), psi2 = (a) => Math.atan2(a.z, a.y), unit2 = (p) => v2(Math.sin(p), Math.cos(p));
const rot2 = (a, d) => { const c = Math.cos(d), s = Math.sin(d); return v2(a.z * c + a.y * s, a.y * c - a.z * s); };
const cross2 = (a, b) => a.z * b.y - a.y * b.z;
const wrapA = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
/** Two-bone IK: the middle joint for root R and target T, bone lengths a and b, on side `side` of R→T. */
function ik2(R, T, a, b, side) {
  const d0 = sub2(T, R), L = Math.max(1e-9, len2(d0)), d = clamp(L, Math.abs(a - b) + 1e-6, a + b - 1e-6);
  const A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)), base = psi2(d0);
  const m1 = add2(R, sc2(unit2(base + A), a)), m2 = add2(R, sc2(unit2(base - A), a));
  return Math.sign(cross2(d0, sub2(m1, R))) === side ? m1 : m2;
}

/** World (model-space) matrices of bones for a sample, memoised per call. */
function fkOf(info, s) {
  const M = {};
  const get = (b) => {
    if (M[b]) return M[b];
    const v = s[b], r = !v ? null : Array.isArray(v) ? v : v.r, p = v && !Array.isArray(v) ? v.p : null, rest = info.rest[b];
    _e.set((r ? r[0] : 0) * DEG, (r ? r[1] : 0) * DEG, (r ? r[2] : 0) * DEG, 'YXZ');
    const local = new THREE.Matrix4().compose(V3(rest[0] + (p ? p[0] : 0), rest[1] + (p ? p[1] : 0), rest[2] + (p ? p[2] : 0)), new THREE.Quaternion().setFromEuler(_e), V3(1, 1, 1));
    const par = info.parent[b];
    M[b] = par ? get(par).clone().multiply(local) : local;
    return M[b];
  };
  return get;
}

/**
 * Solves one leg so its ground contact (hoof toe, toe tips or sole) reaches target T.c (model space), and adds
 * the bone rotations to sample s. T: { c, toe, heel, flex } in degrees — toe: the hoof / toes rotated backward
 * (flexion; negative = fetlock sinking under load), heel: plantigrade heel lift, flex: extra hock / knee flexion.
 * Hind legs work as a pantograph (the cannon / rear pastern keeps parallel to the thigh); forelegs swing the
 * shoulder blade with the forearm and keep the knee (carpus) straight unless flexed.
 */
function solveLeg(info, fk, lm, T, s) {
  const par = lm.front ? 'Chest' : 'Hips', M = fk(par), inv = M.clone().invert(), ph = info.headV[par];
  const up = V3(0, 1, 0).transformDirection(M), theta = Math.atan2(up.z, up.y);
  const J = lm.J.map(p => P2(p.clone().sub(ph))), n = J.length, tip = J[n - 1], b = lm.bones;
  const c = T.c ? P2(T.c.clone().applyMatrix4(inv)) : null;
  const toeA = (T.toe || 0) * DEG - theta, heelA = (T.heel || 0) * DEG - theta, flexA = (T.flex || 0) * DEG;
  const put = (name, d) => { if (!name || !info.has[name]) return; const v = s[name], arr = !v ? [0, 0, 0] : Array.isArray(v) ? v : v.r; const r = [arr[0] + d / DEG, arr[1], arr[2]]; s[name] = v && !Array.isArray(v) ? { ...v, r } : r; };
  const sole = lm.chain === 'sole';
  if (!lm.front) {
    const H0 = J[0], K0 = J[1], A0 = J[2], D0 = J[3];
    const lf = len2(sub2(K0, H0)), lt = len2(sub2(A0, K0)), lm3 = len2(sub2(D0, A0));
    const pf0 = psi2(sub2(K0, H0)), pt0 = psi2(sub2(A0, K0)), pm0 = psi2(sub2(D0, A0));
    if (sole) {
      const At = sub2(sub2(c, rot2(sub2(tip, D0), toeA)), rot2(sub2(D0, A0), heelA));
      const K = ik2(H0, At, lf, lt, lm.kneeSide), A = add2(K, sc2(unit2(psi2(sub2(At, K))), lt));
      const dF = wrapA(psi2(sub2(K, H0)) - pf0), dT = wrapA(psi2(sub2(A, K)) - pt0);
      put(b[0], dF); put(b[1], dT - dF); put(b[2], heelA - dT); put(b[3], toeA - heelA);
      return Math.max(0, len2(sub2(At, H0)) - (lf + lt) * 0.995);
    }
    if (T.A) {
      // folded (lying): the hock rests where asked, the cannon lies at T.mt, the digit flexed T.toeRel past it
      const At = P2(T.A.clone().applyMatrix4(inv)), K = ik2(H0, At, lf, lt, lm.kneeSide), A = add2(K, sc2(unit2(psi2(sub2(At, K))), lt));
      const dF = wrapA(psi2(sub2(K, H0)) - pf0), dT = wrapA(psi2(sub2(A, K)) - pt0), dM = wrapA(T.mt * DEG - theta - pm0);
      put(b[0], dF); put(b[1], dT - dF); put(b[2], dM - dT); put(b[3], (T.toeRel || 0) * DEG);
      return 0;
    }
    const D = sub2(c, rot2(sub2(tip, D0), toeA));
    let pf = pf0, pm = pm0, K = K0, A = A0, At = A0;
    for (let it = 0; it < 8; it++) {
      pm = T.mt !== undefined ? T.mt * DEG - theta : pm0 + lm.kp * wrapA(pf - pf0) + flexA;
      At = sub2(D, sc2(unit2(pm), lm3));
      K = ik2(H0, At, lf, lt, lm.kneeSide);
      pf = psi2(sub2(K, H0));
      A = add2(K, sc2(unit2(psi2(sub2(At, K))), lt));
    }
    const dF = wrapA(pf - pf0), dT = wrapA(psi2(sub2(A, K)) - pt0), dM = wrapA(pm - pm0);
    put(b[0], dF); put(b[1], dT - dF); put(b[2], dM - dT); put(b[3], wrapA(toeA - dM));
    return Math.max(0, len2(sub2(At, H0)) - (lf + lt) * 0.995);
  }
  // foreleg: shoulder blade (J0 → J1), humerus, radius, metacarpus, digit
  const S0 = J[0], Sh0 = J[1], E0 = J[2], C0 = J[3], D0 = J[4];
  const ls = len2(sub2(Sh0, S0)), lh = len2(sub2(E0, Sh0)), lr = len2(sub2(C0, E0)), lmc = len2(sub2(D0, C0));
  const ps0 = psi2(sub2(Sh0, S0)), ph0 = psi2(sub2(E0, Sh0)), pr0 = psi2(sub2(C0, E0)), pmc0 = psi2(sub2(D0, C0));
  if (T.C) {
    // folded (lying): the knee (carpus) rests where asked, the cannon folds back to T.mc, the digit flexed T.toeRel
    const Ct = P2(T.C.clone().applyMatrix4(inv)), dS = (T.scap || 0) * DEG, Sh = add2(S0, sc2(unit2(ps0 + dS), ls));
    const E = ik2(Sh, Ct, lh, lr, lm.elbowSide), dH = wrapA(psi2(sub2(E, Sh)) - ph0), dR = wrapA(psi2(sub2(Ct, E)) - pr0), dMC = wrapA(T.mc * DEG - theta - pmc0);
    put(b[0], dS); put(b[1], dH - dS); put(b[2], dR - dH); put(b[3], dMC - dR); put(b[4], (T.toeRel || 0) * DEG);
    return 0;
  }
  let target, Lv, beta, carp = 0;
  if (sole) { target = sub2(sub2(c, rot2(sub2(tip, D0), toeA)), rot2(sub2(D0, C0), heelA)); Lv = lr; beta = 0; }
  else {
    target = sub2(c, rot2(sub2(tip, D0), toeA));
    carp = wrapA(pmc0 - pr0) + flexA;
    const vf = add2(unit2(0), sc2(unit2(carp), lmc / lr));
    Lv = len2(vf) * lr; beta = psi2(vf);
  }
  // the shoulder blade swings with the forearm (kept within ±12°: a short forearm would otherwise wind it round),
  // turning about a point part way down the blade as it glides over the ribs, so the shoulder does not rise as it reaches
  const blade = (d) => clamp(lm.ks * d, -0.21, 0.21), pivot = add2(S0, sc2(sub2(Sh0, S0), 0.45));
  let dR = 0, Sh = Sh0, E = E0, pr = pr0;
  for (let it = 0; it < 8; it++) {
    Sh = add2(pivot, rot2(sub2(Sh0, pivot), blade(dR)));
    E = ik2(Sh, target, lh, Lv, lm.elbowSide);
    pr = psi2(sub2(target, E)) - beta;
    dR = wrapA(pr - pr0);
  }
  const dS = blade(dR), dH = wrapA(psi2(sub2(E, Sh)) - ph0);
  put(b[0], dS); put(b[1], dH - dS); put(b[2], dR - dH);
  if (info.has[b[0]]) { const top = sub2(add2(pivot, rot2(sub2(S0, pivot), dS)), S0), v = s[b[0]]; s[b[0]] = { r: Array.isArray(v) ? v : v.r, p: [0, top.y, top.z] }; }
  if (sole) { put(b[3], heelA - dR); put(b[4], toeA - heelA); }
  else { const dMC = wrapA(pr + carp - pmc0); put(b[3], dMC - dR); put(b[4], wrapA(toeA - dMC)); }
  return Math.max(0, len2(sub2(target, Sh)) - (lh + Lv) * 0.995);
}

/** Foot path through one cycle: planted and carried back at body speed in stance, lifted and swung forward. */
function footTrack(G, lm, u, h, fm) {
  const key = (lm.side > 0 ? 'L' : 'R') + (lm.front ? 'F' : 'H');
  const duty = typeof G.duty === 'number' ? G.duty : G.duty[lm.front ? 'front' : 'hind'];
  const ph = fract(u - G.ph[key] + 1);
  const S = G.lambda * h * duty, roll = G.roll * fm.roll, flex = lm.front ? G.flexF : G.flexH, o = S * (lm.front ? (G.frontO ?? -0.12) : (G.hindO ?? 0.04));
  if (ph < duty) {
    const s = ph / duty;
    return { dz: o + S * (0.5 - s), dy: 0, toe: -G.sink * fm.sink * Math.sin(Math.PI * s) + roll * sstep(0.7, 1, s), heel: G.heel * sstep(0.55, 1, s), flex: 0, load: Math.sin(Math.PI * s) };
  }
  const s = (ph - duty) / (1 - duty), e = s * s * s * (10 - 15 * s + 6 * s * s);
  const toe = (roll + (G.toe * fm.toe - roll) * sstep(0, 0.3, s)) * (1 - sstep(0.55, 0.95, s));
  return { dz: o + S * (-0.5 + e), dy: G.lift * h * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.8)), 1.3), toe, heel: G.heel * (1 - sstep(0.35, 0.85, s)), flex: flex * Math.sin(Math.PI * s), load: 0 };
}

/** Adds rotations to a bone in a sample ([rx, ry, rz] degrees). */
function addRot(info, s, b, r) {
  if (!info.has[b]) return;
  const v = s[b], cur = !v ? [0, 0, 0] : Array.isArray(v) ? v : v.r, nr = [cur[0] + r[0], cur[1] + r[1], cur[2] + r[2]];
  s[b] = v && !Array.isArray(v) ? { ...v, r: nr } : nr;
}
const rootAt = (s, p, r = [0, 0, 0]) => { s.Root = { r, p }; };
/** Turns the whole spine so the chest rises by dy (pivot at the hips). */
const pitchFor = (info, dy) => -Math.atan2(dy, info.hipToShoulder) / DEG;

/** Plants every foot at its rest place (offset per leg by `move`), then solves the legs. */
function plantFeet(info, s, move = () => null) {
  const fk = fkOf(info, s);
  for (const lm of info.limbs) {
    if (!lm.chain) continue;
    const m = move(lm) || {};
    solveLeg(info, fk, lm, { c: lm.tip.clone().add(V3(0, m.dy || 0, m.dz || 0)), toe: m.toe || 0, heel: m.heel || 0, flex: m.flex || 0, mt: m.mt }, s);
  }
}
/**
 * Grazing posture: the neck swings down from its root (Neck1, with Neck2 following) until the poll is about a
 * head's length above the ground, then the head hangs nose-down so the muzzle meets the grass. Short-necked
 * animals that cannot reach also dip the forehand (the forelegs bend under the lowered chest).
 */
function reachGround(info, s, h) {
  if (!info.snout || !info.has.Head) return;
  // The neck swings down nearly straight, a little arched behind the poll, about the base of the neck vertebrae: low in
  // the neck at about the height of the shoulder joint, not the Neck1 joint high in the chest. About Neck1 even a straight
  // neck could only put the poll a third of a metre ahead of the chest on a horse, so the head curled back between the
  // forelegs; real grazers reach well in front of their forefeet. The pivot is applied as a position offset on Neck1.
  const target = info.headLen * 0.92 + 0.015 * info.H, MAX = 115, N2 = 0.12;
  const fore = info.limbs.find(l => l.front && l.J && l.J[1]), Pw = info.headV.Neck1, Cw = info.headV.Chest;
  const Qw = fore ? V3(0, Math.min(Pw.y, fore.J[1].y + 0.03 * info.H), Math.max(Pw.z, fore.J[1].z + 0.04 * info.H)) : Pw;
  const Py = Pw.y - Cw.y, Pz = Pw.z - Cw.z, Qy = Qw.y - Cw.y, Qz = Qw.z - Cw.z;
  const neckAt = (t, a) => {
    addRot(info, t, 'Neck1', [a, 0, 0]); addRot(info, t, 'Neck2', [a * N2, 0, 0]);
    const c = Math.cos(a * DEG), sn = Math.sin(a * DEG), dy = Py - Qy, dz = Pz - Qz, v = t.Neck1;
    t.Neck1 = { r: Array.isArray(v) ? v : v.r, p: [0, Qy + dy * c - dz * sn - Py, Qz + dy * sn + dz * c - Pz] };
  };
  const pollY = (t) => new THREE.Vector3().setFromMatrixPosition(fkOf(info, t)('Head')).y;
  const trial = (a, dip) => { const t = { ...s }; addRot(info, t, 'Hips', [dip, 0, 0]); neckAt(t, a); return t; };
  let dip = 0, a = MAX;
  if (pollY(trial(MAX, 0)) > target) dip = clamp((pollY(trial(MAX, 0)) - target) / Math.max(1e-6, info.hipToShoulder) / DEG, 0, 9);
  if (pollY(trial(0, dip)) > target) {
    let lo = 0, hi = MAX;
    for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (pollY(trial(m, dip)) > target) lo = m; else hi = m; }
    a = hi;
  } else a = 0;
  addRot(info, s, 'Hips', [dip, 0, 0]); neckAt(s, a);
  // hang the head about 72° nose-down
  const fk = fkOf(info, s), q = new THREE.Quaternion().setFromRotationMatrix(fk('Head'));
  const d = info.snout.clone().sub(info.headV.Head).applyQuaternion(q), now = Math.atan2(-d.y, Math.hypot(d.z, d.x)) / DEG;
  addRot(info, s, 'Head', [clamp(72 - now, -40, 60), 0, 0]);
}
const tailWave = (info, s, yaw, lift = 0, f = 1, u = 0, lag = 0.6) => info.tail.forEach((b, i) => addRot(info, s, b, [lift / info.tail.length, Math.sin(TAU * f * u - i * lag) * yaw / info.tail.length, 0]));
const earsTo = (info, s, a) => { addRot(info, s, 'EarL', [0, 0, a]); addRot(info, s, 'EarR', [0, 0, -a]); };

function gaitSample(info, name, u) {
  const G = info.gaits[name], s = {}, h = info.hipH;
  const fmOf = (lm) => FOOT_MOTION[lm.foot] || FOOT_MOTION.paw;
  // feet first (their loads drive the body's rise and fall)
  const tracks = info.limbs.map(lm => ({ lm, tr: lm.chain ? footTrack(G, lm, u, h, fmOf(lm)) : null }));
  const load = (front) => tracks.reduce((a, t) => a + (t.tr && t.lm.front === front ? t.tr.load : 0), 0);
  // walking vaults over each straight leg (body high at mid-stance); running legs act as springs (low at mid-stance)
  const lh = load(false), lf = load(true);
  const yH0 = G.run ? G.bob * h * (0.45 - Math.min(1, lh)) : G.bob * h * (lh - 0.75), yF0 = G.run ? G.bob * h * (0.45 - Math.min(1, lf)) : G.bob * h * (lf - 0.75);
  const swayX = G.run ? 0 : 0.008 * h * Math.sin(TAU * u - Math.PI / 2);
  // spine: flexed when the legs gather under the body, extended as they stretch out (gallops and bounds)
  let flexS = 0;
  if (G.spine) {
    const front = typeof G.duty === 'number' ? G.duty : G.duty.front, gather = fract((Math.max(G.ph.LF, G.ph.RF) + front + 1) / 2 + 0.02);
    flexS = G.spine * Math.cos(TAU * (u - gather));
  }
  const trunkAt = (t, yH, pitch) => {
    rootAt(t, [swayX, yH, 0]);
    addRot(info, t, 'Hips', [pitch, 0, G.run ? 0 : 1.5 * Math.sin(TAU * u)]);
    if (G.spine) { addRot(info, t, 'Spine1', [flexS * 0.55, 0, 0]); addRot(info, t, 'Spine2', [flexS * 0.45, 0, 0]); }
    else { addRot(info, t, 'Spine1', [0, 1.2 * Math.sin(TAU * u), 0]); addRot(info, t, 'Chest', [0, -1.2 * Math.sin(TAU * u), 0]); }
  };
  // the girdles drop where the planted legs could not otherwise reach (double support): the body vaults
  let dropH = 0, dropF = 0;
  for (let pass = 0; pass < 4; pass++) {
    const t = {}, yH = yH0 - dropH, yF = yF0 - dropF;
    trunkAt(t, yH, pitchFor(info, yF - yH));
    const fk = fkOf(info, t);
    let shortH = 0, shortF = 0;
    for (const { lm, tr } of tracks) if (tr && tr.load > 0) {
      const sh = solveLeg(info, fk, lm, { c: lm.tip.clone().add(V3(0, tr.dy, tr.dz)), toe: tr.toe, heel: tr.heel * (lm.foot === 'sole' ? 1 : 0), flex: tr.flex }, {});
      if (lm.front) shortF = Math.max(shortF, sh); else shortH = Math.max(shortH, sh);
    }
    if (shortH < 1e-4 * h && shortF < 1e-4 * h) break;
    dropH = Math.min(0.2 * h, dropH + shortH * 1.15); dropF = Math.min(0.2 * h, dropF + shortF * 1.15);
  }
  const yH = yH0 - dropH, yF = yF0 - dropF, pitch = pitchFor(info, yF - yH);
  s.__drop = Math.max(dropH, dropF) / h;
  trunkAt(s, yH, pitch);
  // keep the head steady (counter the body's pitch); walkers nod with each fore footfall
  const nod = G.run ? 0 : (info.nod ?? 3) * Math.cos(2 * TAU * (u - G.ph.LF - 0.08));
  const pumpN = G.spine ? -0.5 * flexS : 0;
  addRot(info, s, 'Neck1', [-(pitch + flexS) * 0.6 + nod + pumpN, 0, 0]); addRot(info, s, 'Head', [-(pitch + flexS) * 0.3 - nod * 0.4, 0, 0]);
  if (info.trunk.length) info.trunk.forEach((b, i) => addRot(info, s, b, [Math.sin(TAU * u * (G.run ? 2 : 1) - i * 0.7) * 5, 0, Math.sin(TAU * u - i * 0.5) * 4]));
  tailWave(info, s, G.run ? 8 : 16, G.spine ? 18 : G.run ? 8 : 0, 1, u);
  if (G.run) earsTo(info, s, -6);
  const fk = fkOf(info, s);
  for (const { lm, tr } of tracks) if (tr) solveLeg(info, fk, lm, { c: lm.tip.clone().add(V3(0, tr.dy, tr.dz)), toe: tr.toe, heel: tr.heel * (lm.foot === 'sole' ? 1 : 0), flex: tr.flex }, s);
  return s;
}

function sampleFor(info, name, u) {
  if (info.gaits[name]) { adaptStrides(info); return gaitSample(info, name, u); }
  const s = {}, h = info.hipH, H = info.H;
  switch (name) {
    case 'idle': {
      // breathing, a slow weight shift over planted feet, looking about, ear flicks and a swishing tail
      const br = Math.sin(TAU * u);
      rootAt(s, [0.006 * h * Math.sin(TAU * u), -0.004 * h * (1 - Math.cos(TAU * u)) / 2, 0.005 * h * Math.sin(TAU * u + 1.1)]);
      addRot(info, s, 'Spine2', [br * 0.8, 0, 0]); addRot(info, s, 'Chest', [-br * 0.6, 0, 0]);
      addRot(info, s, 'Neck1', [Math.sin(TAU * u + 1) * 2, Math.sin(TAU * u) * 9, 0]); addRot(info, s, 'Head', [Math.sin(TAU * u * 2) * 1.5, Math.sin(TAU * u - 0.6) * 6, Math.sin(TAU * u) * 2]);
      earsTo(info, s, Math.pow(Math.max(0, Math.sin(TAU * u * 3)), 4) * 14);
      tailWave(info, s, 18, 0, 1, u);
      if (info.trunk.length) info.trunk.forEach((b, i) => addRot(info, s, b, [Math.sin(TAU * u - i * 0.7) * 6, 0, Math.sin(TAU * u * 0.5 - i) * 4]));
      plantFeet(info, s);
      break;
    }
    case 'graze': {
      // head down to the ground, one foreleg forward (hoofed animals), chewing; giraffes browse, elephants pluck with the trunk
      const nb = Math.sin(TAU * u) * 2;
      if (info.browse) {
        addRot(info, s, 'Neck1', [-14, Math.sin(TAU * u) * 6, 0]); addRot(info, s, 'Neck2', [-8, 0, 0]); addRot(info, s, 'Head', [-22 + nb, 0, 0]);
        addRot(info, s, 'Jaw', [Math.max(0, Math.sin(TAU * u * 4)) * 8, 0, 0]);
      } else if (info.trunk.length) {
        const k = 0.5 - 0.5 * Math.cos(TAU * u);
        addRot(info, s, 'Neck1', [6, 0, 0]); addRot(info, s, 'Head', [4, 0, 0]);
        info.trunk.forEach((b, i) => addRot(info, s, b, [lerp(10, -38, k) * (i + 1) / info.trunk.length * 1.6, 0, 0]));
      } else {
        reachGround(info, s, h);
        addRot(info, s, 'Neck1', [nb, Math.sin(TAU * u) * 5, 0]); addRot(info, s, 'Head', [-nb * 0.5, 0, 0]);
        addRot(info, s, 'Jaw', [Math.max(0, Math.sin(TAU * u * 4)) * 8, 0, 0]);
      }
      earsTo(info, s, -8); tailWave(info, s, 12, 0, 1, u);
      plantFeet(info, s, (lm) => lm.front && lm.side > 0 && info.hoofed ? { dz: 0.12 * h } : null);
      break;
    }
    case 'alert': {
      // head high, ears pricked toward the sound, tail raised; deer and antelope lift a forefoot
      addRot(info, s, 'Neck1', [-14, 0, 0]); addRot(info, s, 'Neck2', [-6, 0, 0]); addRot(info, s, 'Head', [-8, Math.sin(TAU * u) * 10, 0]);
      earsTo(info, s, -14); tailWave(info, s, 3, 15, 1, u);
      if (info.trunk.length) info.trunk.forEach((b) => addRot(info, s, b, [-14, 0, 0]));
      rootAt(s, [0, 0.004 * h, -0.006 * h]);
      plantFeet(info, s, (lm) => lm.front && lm.side > 0 && info.footLift ? { dy: 0.1 * h, dz: 0.02 * h, toe: 55, flex: 70 } : null);
      break;
    }
    case 'roar': {
      const o = sstep(0, 0.3, u) * (1 - sstep(0.75, 1, u));
      rootAt(s, [0, -0.015 * h * o, -0.03 * h * o]);
      addRot(info, s, 'Neck1', [-12 * o, 0, 0]); addRot(info, s, 'Head', [-14 * o, 0, 0]); addRot(info, s, 'Jaw', [32 * o, 0, 0]); earsTo(info, s, -20 * o); addRot(info, s, 'Chest', [-4 * o, 0, 0]);
      if (info.trunk.length) info.trunk.forEach((b) => addRot(info, s, b, [-24 * o, 0, 0]));
      tailWave(info, s, 8, 10 * o, 2, u);
      plantFeet(info, s);
      break;
    }
    case 'sit': {
      const t = sstep(0, 0.65, u);
      if (info.lies) lieDown(info, s, t);
      else sitDown(info, s, t);
      break;
    }
    default: break;
  }
  return s;
}

/** Dogs, cats, bears and rodents sit on their haunches: rump down, hocks and feet flat, forelegs straight. */
function sitDown(info, s, t) {
  const h = info.hipH, up = info.sitUp;
  const pitch = (up ? 48 : info.hindHigh ? 26 : 34) * t;
  const drop = (up ? 0.62 : 0.6) * h * t;
  rootAt(s, [0, -drop, -0.08 * h * t]);
  addRot(info, s, 'Hips', [-pitch, 0, 0]);
  addRot(info, s, 'Neck1', [pitch * 0.45, 0, 0]); addRot(info, s, 'Head', [pitch * 0.3, 0, 0]);
  tailWave(info, s, 3, -18 * t, 1, 0);
  const fk = fkOf(info, s);
  for (const lm of info.limbs) {
    if (!lm.chain) continue;
    if (!lm.front) {
      // the cannon / rear pastern lies flat along the ground under the hock
      solveLeg(info, fk, lm, { c: lm.tip.clone().add(V3(0, 0, 0.05 * h * t)), toe: 0, heel: 0, mt: lm.chain === 'sole' ? undefined : lerp(lm.mtRest, 90, t) }, s);
    } else if (up) {
      // squirrels and rabbits sit up with the forepaws held to the chest
      addRot(info, s, lm.bones[1], [-40 * t, 0, 0]); addRot(info, s, lm.bones[2], [80 * t, 0, 0]); if (lm.bones[3]) addRot(info, s, lm.bones[3], [30 * t, 0, 0]);
    } else solveLeg(info, fk, lm, { c: lm.tip.clone(), toe: 0 }, s);
  }
}

/** Hoofed animals and elephants lie down instead (sternal recumbency): belly on the ground, the forelegs folded at
 *  the knee with the cannons tucked back underneath, the hind legs folded with the hock on the ground. */
function lieDown(info, s, t) {
  const h = info.hipH, drop = Math.max(0, info.bellyH - 0.03 * h) * t;
  rootAt(s, [0, -drop, 0]);
  addRot(info, s, 'Hips', [1.5 * t, 0, 0]);
  addRot(info, s, 'Neck1', [-6 * t, 0, 0]); addRot(info, s, 'Head', [8 * t, 0, 0]);
  // an elephant lying down lifts its head and curls its trunk forward along the ground (they went into the ground)
  if (info.trunk.length) { addRot(info, s, 'Neck1', [-14 * t, 0, 0]); addRot(info, s, 'Head', [-10 * t, 0, 0]); info.trunk.forEach((b) => addRot(info, s, b, [-21 * t, 0, 0])); }
  tailWave(info, s, 2, -10 * t, 1, 0);
  const fk = fkOf(info, s);
  for (const lm of info.limbs) {
    if (!lm.chain) continue;
    const J = lm.J, rest = { c: lm.tip.clone() };
    if (lm.front) {
      if (lm.chain === 'sole') { solveLeg(info, fk, lm, rest, s); continue; }
      // the knee settles on the ground a forearm's reach ahead of where the elbow stood
      const lr = J[3].distanceTo(J[2]), C = V3(J[3].x, lerp(J[3].y, 0.05 * h, t), lerp(J[3].z, J[2].z + 0.45 * lr, t));
      solveLeg(info, fk, lm, { C, mc: lerp(lm.mcRest, -84, t), toeRel: 70 * t, scap: -6 * t }, s);
    } else if (lm.chain === 'sole') solveLeg(info, fk, lm, rest, s);
    else {
      // the hock rests on the ground behind the hip, the cannon lies forward under the belly
      const A = V3(J[2].x, lerp(J[2].y, 0.06 * h, t), lerp(J[2].z, J[0].z - 0.1 * h, t));
      solveLeg(info, fk, lm, { A, mt: lerp(lm.mtRest, 96, t), toeRel: 45 * t }, s);
    }
  }
}

const CLIP_SPEC = { idle: [3.2, 49, true], graze: [2.4, 37, true], alert: [2.2, 33, true], roar: [1.8, 37, false], sit: [1.6, 25, false] };

/**
 * Short-legged animals (hedgehogs, mice, otters) take shorter, quicker steps: each gait's stride is shortened until
 * the body need not sink more than 12 % of the leg length for the planted feet to reach the ground. Runs once.
 */
function adaptStrides(info) {
  if (info.adapted) return;
  info.adapted = true;
  for (const name of Object.keys(info.gaits)) {
    for (let k = 0; k < 6; k++) {
      let worst = 0;
      for (let i = 0; i < 16; i++) worst = Math.max(worst, gaitSample(info, name, i / 16).__drop || 0);
      if (worst <= 0.12) break;
      info.gaits[name] = { ...info.gaits[name], lambda: info.gaits[name].lambda * 0.85 };
    }
  }
}

/** Builds every clip for an asset made by createAsset (skinned mode). Gait clips carry { gait, stride, speed, hipH }. */
export function createClips(asset) {
  const R = RIGS.get(asset); if (!R) return [];
  const info = R.info, h = info.hipH, out = [];
  adaptStrides(info);
  for (const name of ['walk', 'trot', 'gallop']) {
    const G = info.gaits[name]; if (!G) continue;
    const v = Math.sqrt(G.fr * 9.81 * h), stride = G.lambda * h, dur = stride / v, frames = clamp(Math.round(dur * 40), 21, 41);
    const clip = bakeClip(info, name, dur, frames, (u) => sampleFor(info, name, u), true);
    clip.userData = { loop: true, gait: G.id, stride, speed: v, hipH: h, fr: G.fr };
    out.push(clip);
  }
  for (const [n, [d, f, loop]] of Object.entries(CLIP_SPEC)) out.push(bakeClip(info, n, d, f, (u) => sampleFor(info, n, u), loop));
  return out;
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
/** What the clip solver needs to know about the skeleton and the species (Digital Diorama revision 4). */
function motionInfo(S, p, L, rig) {
  const P2r = (v) => ({ z: v.z, y: v.y });
  const limbs = L.limbs.map(lm => {
    const J = lm.joints.map(j => j.p.clone()), n = J.length, std = ['ungulate', 'digitigrade', 'plantigrade', 'graviportal'].includes(lm.st);
    const foot = lm.footType || lm.foot, chain = !std || n < 5 ? null : foot === 'sole' ? 'sole' : 'panto';
    const out = { front: lm.front, side: lm.side, bones: lm.bones, st: lm.st, foot, chain, J, tip: J[n - 1].clone() };
    if (!chain) return out;
    const W = J.map(P2r), sub = (a, b) => ({ z: a.z - b.z, y: a.y - b.y }), cr = (a, b) => a.z * b.y - a.y * b.z;
    if (lm.front) {
      out.elbowSide = Math.sign(cr(sub(chain === 'sole' ? W[3] : W[4], W[1]), sub(W[2], W[1]))) || -1;
      out.mcRest = Math.atan2(W[4].z - W[3].z, W[4].y - W[3].y) / DEG;
      out.ks = lm.st === 'graviportal' || chain === 'sole' ? 0.25 : 0.45;
    } else {
      out.kneeSide = Math.sign(cr(sub(W[2], W[0]), sub(W[1], W[0]))) || 1;
      out.kp = lm.st === 'graviportal' ? 0.4 : 0.9;
      out.mtRest = Math.atan2(W[3].z - W[2].z, W[3].y - W[2].y) / DEG;
    }
    return out;
  });
  const hind = limbs.filter(l => !l.front), gaits = {};
  for (const [clip, id] of Object.entries(gaitSetFor(S, p))) if (id) gaits[clip] = { ...GAIT_LIB[id], ...((GAIT_TUNE[p.species] || {})[clip] || {}), id };
  let bellyH = Infinity;
  for (let k = L.torso.main[0]; k <= L.torso.main[1]; k++) if (L.torso.us[k] < L.uOf.neckRoot) for (const q of L.torso.rows[k]) bellyH = Math.min(bellyH, q.y);
  const hoofed = S.stance === 'ungulate', fore = limbs.filter(l => l.front && l.chain);
  // legs scale the stride: the hind legs' hip height, unless the forelegs are much shorter (mice, rabbits, squirrels)
  const hipJ = hind.length ? hind.reduce((a, l) => a + l.J[0].y, 0) / hind.length : S.H * 0.6;
  const shJ = fore.length ? fore.reduce((a, l) => a + l.J[1].y, 0) / fore.length : hipJ;
  return {
    limbs, gaits, hipH: Math.min(hipJ, 1.15 * shJ),
    parent: Object.fromEntries(rig.list.map(e => [e.name, e.parent ? e.parent.name : null])),
    headV: Object.fromEntries(rig.list.map(e => [e.name, e.head.clone()])),
    snout: L.headO ? L.headO.clone().addScaledVector(L.hd, L.Lh) : null, headLen: L.Lh,
    bellyH: Number.isFinite(bellyH) ? bellyH : S.H * 0.5,
    hoofed, nod: hoofed ? 4 : 2, browse: p.species === 'giraffe',
    footLift: ['deer', 'gazelle', 'reindeer', 'moose', 'goat', 'bighorn'].includes(p.species),
    lies: hoofed || S.stance === 'graviportal', sitUp: S.stance === 'digitigrade' && (S.crouch || 0) >= 0.5,
  };
}
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
    tail: rigB.list.filter(e => /^Tail\d/.test(e.name)).map(e => e.name), trunk: rigB.list.filter(e => /^Trunk\d/.test(e.name)).map(e => e.name),
    longNeck: S.neckLen > 0.45, hindHigh: S.rump > 1.1,
    hipToShoulder: rigB.head('Chest').distanceTo(rigB.head('Hips')),
    ...motionInfo(S, p, L, rigB),
  };
  const pose = p.pose !== 'stand' ? sampleFor(info, p.pose, p.posePhase) : null;
  const coat = { res: COAT_RES[p.detail] ?? COAT_RES.standard, grain: p.coatGrain * (S.grain ?? 1), grainOf: (z) => ZONE_ROLES[z] === 'body', smooth: p.shading !== 'flat' };
  const { root, skeleton } = finish(build, { name: `mammal-${p.species}`, merge: p.mergeForProduction, skinned: p.rigMode === 'skinned', zones, pose, coat: coatOn || coat.smooth ? coat : null, seamRadius: 0.05 * S.H });
  let tris = 0; root.traverse(m => { if (m.isMesh) tris += m.geometry.attributes.position.count / 3; });
  root.userData = {
    species: p.species, label: S.label, params: p, dimensions: measure(root), triangles: tris, zones: Object.fromEntries(Object.entries(zones).map(([k, v]) => [k, hexStr(v)])),
    bones: info.bones, parts: build.parts.map(pt => pt.name), stance: S.stance,
  };
  RIGS.set(root, { rig: rigB, info, skeleton });
  return root;
}

export default createAsset;
