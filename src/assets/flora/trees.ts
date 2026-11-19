/**
 * TREES & WOODY PLANTS — Digital Diorama flora library (CC0).
 *
 * Species-specific procedural trees built for the diorama scale: conifers grown
 * as whorls of needle sprays, broadleaf crowns grown recursively with leaf
 * clusters, palms with arching pinnate fronds, plus the special forms (saguaro,
 * Joshua tree, baobab, kapok with buttresses and lianas, mangrove on stilt roots,
 * banana, tree fern, bamboo). Two materials per tree (wood + foliage), vertex
 * coloured, seasons (blossom, autumn colour, bare winters), three detail tiers.
 *
 * createAsset({ species, height, spread, density, season, detail, seed, ...colours })
 */
import * as THREE from 'three';
import type { ParamSpec } from '../modules';
import { blob, bentPath, wobble, spline, lathe, fbm3, noise3, type RGB } from '../proc/kit';
import {
  type Ctx, type Arch, type BarkLook, type LeafLook, type Season, makeCtx, finish, defaults, pick, rnd, barkPaint, grow, leafTwig, crownShade, trunkPath, flare, blossom, seasonal, bromeliad,
  V, TAU, clamp, lerp, sstep, rgb, mixc, shade, jitter, sweep, leaf, LEAF, along, sideOf,
} from './common';

/* ======================================================================== */
/*  species table                                                           */
/* ======================================================================== */
interface Species { label: string; height: [number, number, number]; spread?: number; build: (ctx: Ctx) => void; seasonal?: boolean }
const S: Record<string, Species> = {};

export const params: Record<string, ParamSpec> = {
  species: { type: 'choice', default: 'norway-spruce', options: [], label: 'Species' },
  height: { type: 'range', default: 9, min: 1, max: 24, step: 0.1, unit: 'm', label: 'Height' },
  spread: { type: 'range', default: 1, min: 0.5, max: 1.6, step: 0.01, label: 'Crown width' },
  density: { type: 'range', default: 1, min: 0.4, max: 1.6, step: 0.01, label: 'Leaf density' },
  lean: { type: 'range', default: 0.03, min: 0, max: 0.25, step: 0.01, label: 'Lean' },
  season: { type: 'choice', default: 'summer', options: ['spring', 'summer', 'autumn', 'winter'], label: 'Season', describe: 'Set automatically from the diorama’s season.' },
  detail: { type: 'choice', default: 'medium', options: ['low', 'medium', 'high'], label: 'Detail' },
  seed: { type: 'range', default: 7, min: 1, max: 999, step: 1, label: 'Variation' },
};

export function getSchema(cfg: { species?: string } = {}) {
  const sp = S[String(cfg.species)] ?? S['norway-spruce'];
  return { ...params, species: { ...params.species, options: Object.keys(S) }, height: { ...params.height, default: sp.height[1], min: sp.height[0], max: sp.height[2] } };
}
export const SPECIES_LIST = () => Object.fromEntries(Object.entries(S).map(([k, v]) => [k, v.label]));

export function createAsset(p: Record<string, unknown> = {}): THREE.Group {
  if (p.kinds) return createGrove(p);
  const sp = S[String(p.species)] ?? S['norway-spruce'];
  const P = defaults(params, { height: sp.height[1], ...p });
  P.height = clamp(Number(P.height), sp.height[0] * 0.5, sp.height[2] * 1.5);
  const ctx = makeCtx(P);
  sp.build(ctx);
  const g = finish(ctx, `tree-${P.species}`);
  g.userData.species = P.species;
  return g;
}

/* ======================================================================== */
/*  conifers                                                                */
/* ======================================================================== */
type Foliage = 'spruce' | 'fir' | 'pine' | 'cedar' | 'larch' | 'redwood' | 'cypress';
interface Conifer {
  r0: number; crownBase: number; width: number; shape: (u: number) => number;
  whorl: number; perWhorl: [number, number]; tilt: number; tiltTop: number; droop: number; tipUp: number;
  foliage: Foliage; colors: Partial<Record<Season, string[]>> & { summer: string[] };
  bark: BarkLook; upperBark?: string;
  cones?: { color: string; len: number; mode: 'hang' | 'up' | 'side'; count: number };
  sprayLen: number; sprayW: number;
  flareAmt?: number; lobes?: number;
  /** the height the width/spray sizes were tuned for */
  refH?: number;
}
const comb = (t: number) => { const k = Math.round(t * 6); return (k % 2 ? 1 : 0.52) * (1 - t * 0.45) * Math.min(1, t * 4 + 0.35); };
const feather = (t: number) => { const k = Math.round(t * 8); return (k % 2 ? 1 : 0.4) * Math.sin(Math.PI * Math.min(1, t * 1.05)); };

function conifer(ctx: Ctx, c0: Conifer) {
  let c = c0;
  const { R, P } = ctx;
  const H = Number(P.height), dens = Number(P.density);
  // crowns (and sprays) scale with the tree, so a young tree is narrower — not a squat copy
  const k = clamp(H / (c.refH ?? H), 0.3, 2);
  const W = c.width * Number(P.spread) * Math.pow(k, 0.85);
  c = { ...c, sprayLen: c.sprayLen * Math.pow(k, 0.45), sprayW: c.sprayW * Math.pow(k, 0.45) };
  const trunk = trunkPath(ctx, H, Number(P.lean) * 0.4, 12, 0.012);
  const rAt = (t: number) => c.r0 * Math.pow(1 - t, 0.85) + 0.004;
  const lower = barkPaint(c.bark, ctx.seed, H);
  const upper = c.upperBark ? rgb(c.upperBark) : null;
  const paint = (t: number, a: number, p: THREE.Vector3, level = 0): RGB => {
    const col = lower(t, a, p, level);
    return upper && level === 0 ? mixc(col, upper, sstep(0.45, 0.75, p.y / H)) : col;
  };
  sweep(ctx.bark, trunk, rAt, { sides: ctx.q > 0.6 ? 10 : 7, color: (t, a, p) => paint(t, a, p, 0), radial: c.flareAmt ? flare(c.flareAmt, c.lobes ?? 6, ctx.seed) : undefined, capStart: true });
  const colors = seasonal(ctx, c.colors);
  const tipCol = colors ? mixc(colors[colors.length - 1], rgb('#d8f0a0'), 0.18) : null;
  const leaf0 = ctx.leaf.vcount;
  const yb = c.crownBase * H;
  const step = c.whorl * H / 9;
  let wi = 0;
  const cones: { p: THREE.Vector3; d: THREE.Vector3 }[] = [];
  for (let y = yb; y < H * 0.975; y += step * (0.8 + R() * 0.4), wi++) {
    const u = (y - yb) / Math.max(0.01, H - yb);
    const tt = y / H;
    const at = along(trunk, tt).p;
    const n = pick(R, c.perWhorl);
    const reach = W * 0.5 * c.shape(u) * (0.82 + R() * 0.36);
    if (reach < 0.08) continue;
    const tilt = lerp(c.tilt, c.tiltTop, u);
    for (let k = 0; k < n; k++) {
      const az = wi * 2.2 + (k / n) * TAU + (R() - 0.5) * 0.7;
      const d = V(Math.cos(az) * Math.cos(tilt), Math.sin(tilt), Math.sin(az) * Math.cos(tilt));
      const start = at.clone().addScaledVector(V(d.x, 0, d.z).normalize(), rAt(tt) * 0.8);
      const len = reach / Math.max(0.35, Math.cos(tilt));
      const segs = 5;
      const pts = [start.clone()];
      const h = d.clone();
      for (let s2 = 0; s2 < segs; s2++) {
        const f = s2 / segs;
        h.y -= c.droop * (0.4 + f) / segs;
        if (f > 0.6) h.y += c.tipUp / segs * 2.2;
        h.normalize();
        pts.push(pts[pts.length - 1].clone().addScaledVector(h, len / segs));
      }
      const rb = Math.max(0.01, c.r0 * 0.32 * Math.pow(1 - u, 0.6) * clamp(len / (W * 0.5), 0.4, 1.1));
      sweep(ctx.bark, pts, (t) => rb * lerp(1, 0.2, t), { sides: 4, color: (t, a, p) => paint(t, a, p, 2) });
      if (colors) coniferFoliage(ctx, c, pts, len, colors, tipCol!, dens, u);
      if (c.cones && u > 0.55 && R() < c.cones.count / 30) cones.push(along(pts, 0.6 + R() * 0.35));
    }
  }
  // the leader: a final spray / tuft at the very top
  if (colors) {
    const top = trunk[trunk.length - 1];
    if (c.foliage === 'pine') tuft(ctx, top, V(0, 1, 0), 0.32, colors, tipCol!);
    else for (let k = 0; k < 4; k++) leaf(ctx.leaf, top.clone().add(V(0, -0.35, 0)), V(Math.cos(k * 1.57) * 0.25, 1, Math.sin(k * 1.57) * 0.25), V(Math.cos(k * 1.57 + 1.57), 0, Math.sin(k * 1.57 + 1.57)), 0.5, 0.18, { shape: comb, segs: 5, color: colors[0], tip: tipCol!, curl: -0.1, fold: 0.1 });
    crownShade(ctx.leaf, leaf0, V(0, lerp(yb, H, 0.45), 0), W * 0.5, H - yb, c.foliage === 'pine' ? 0.35 : 0.5);
  }
  if (c.cones) for (const cn of cones) {
    const cc = rgb(c.cones.color), L = c.cones.len;
    const d = c.cones.mode === 'hang' ? V(0, -1, 0) : c.cones.mode === 'up' ? V(0, 1, 0) : cn.d;
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
    blob(ctx.bark, cn.p.clone().addScaledVector(d, L * 0.5), L * 0.24, L * 0.5, L * 0.24, (nn) => mixc(cc, shade(cc, 0.6), (Math.sin(nn.y * 20) + 1) * 0.25), { w: 7, h: 6, rot: q });
  }
}

function coniferFoliage(ctx: Ctx, c: Conifer, pts: THREE.Vector3[], len: number, colors: RGB[], tip: RGB, dens: number, u: number) {
  const R = ctx.R;
  const lk = 1 / Math.sqrt(lerp(0.55, 1, ctx.q));
  if (c.foliage === 'pine' || c.foliage === 'larch') {
    // pines: needle tufts at the ends of short side shoots; larches: soft rosettes along drooping twigs
    const shoots = Math.max(2, Math.round(len * (c.foliage === 'pine' ? 3.2 : 3) * dens * lerp(0.6, 1, ctx.q)));
    for (let i = 0; i < shoots; i++) {
      const t = c.foliage === 'pine' ? lerp(0.45, 1, i / Math.max(1, shoots - 1)) : lerp(0.15, 1, (i + R() * 0.5) / shoots);
      const at = along(pts, t);
      const side = V(-at.d.z, 0, at.d.x).normalize().multiplyScalar(R() < 0.5 ? -1 : 1);
      const sd = at.d.clone().addScaledVector(side, 0.8).add(V(0, c.foliage === 'pine' ? 0.6 : -0.25, 0)).normalize();
      const sl = (c.foliage === 'pine' ? 0.28 : 0.16) * (0.7 + R() * 0.6);
      const end = at.p.clone().addScaledVector(sd, sl);
      sweep(ctx.bark, [at.p, end], (t2) => 0.012 * (1 - t2 * 0.6), { sides: 3, color: () => rgb(c.foliage === 'pine' ? '#6a4a33' : '#5a4636'), capEnd: false, smooth: false });
      if (c.foliage === 'pine') tuft(ctx, end, sd.clone().add(V(0, 0.8, 0)).normalize(), 0.42 * lk, colors, tip);
      else rosette(ctx, end, 0.1 * lk, colors, tip);
    }
    if (c.foliage === 'pine') tuft(ctx, pts[pts.length - 1], along(pts, 1).d.clone().add(V(0, 0.9, 0)).normalize(), 0.46 * lk, colors, tip);
    return;
  }
  // flat sprays (fir, spruce, redwood, cedar, cypress)
  const gap = (c.foliage === 'cedar' ? 0.16 : 0.2) / (dens * lerp(0.6, 1, ctx.q));
  const count = Math.max(2, Math.ceil(len / gap));
  const shapeFn = c.foliage === 'cypress' || c.foliage === 'redwood' ? feather : comb;
  for (let i = 0; i < count; i++) {
    const t = lerp(0.1, 1, i / (count - 1));
    const at = along(pts, t);
    const perp = V(-at.d.z, 0, at.d.x).normalize();
    for (const sgn of [-1, 1]) {
      if (c.foliage !== 'cedar' && R() < 0.12) continue;
      const drop = c.foliage === 'spruce' ? 0.85 : c.foliage === 'redwood' ? 0.55 : c.foliage === 'cypress' ? 0.45 : c.foliage === 'cedar' ? -0.05 : 0.12;
      const sd = at.d.clone().multiplyScalar(0.75).addScaledVector(perp, sgn * 0.75).add(V(0, -drop * (0.4 + t * 0.6), 0)).normalize();
      const L = c.sprayLen * lk * (1 - t * 0.35) * (0.8 + R() * 0.4) * (u > 0.85 ? 0.7 : 1);
      const Wd = c.sprayW * lk;
      const col = jitter(colors[Math.floor(R() * colors.length)], R, 0.08);
      const up = c.foliage === 'cedar' ? V(0, 1, 0) : V(0, 1, 0).addScaledVector(perp, sgn * 0.3).normalize();
      const sideV = V().crossVectors(up, sd).normalize();
      leaf(ctx.leaf, at.p, sd, sideV, L, Wd, { shape: shapeFn, segs: ctx.q < 0.6 ? 4 : 6, color: col, tip, curl: c.foliage === 'spruce' ? 0.25 : 0.12, fold: 0.18, bias: up, biasAmt: 0.5, flat: ctx.q < 0.9 });
      if (c.foliage === 'spruce' && ctx.q > 0.8) {
        // spruce shoots are bottle-brushes: a second, crossed ribbon gives them volume
        leaf(ctx.leaf, at.p, sd, up, L * 0.85, Wd * 0.75, { shape: comb, segs: 4, color: shade(col, 0.9), tip, curl: 0.15, fold: 0.1, bias: V(0, 1, 0), biasAmt: 0.5, flat: true });
      }
    }
  }
  // terminal spray in the branch direction
  const end = along(pts, 1);
  leaf(ctx.leaf, end.p, end.d.clone().add(V(0, c.foliage === 'spruce' ? -0.2 : 0.05, 0)).normalize(), V(-end.d.z, 0, end.d.x), c.sprayLen * lk * 0.9, c.sprayW * lk, { shape: shapeFn, segs: 5, color: colors[0], tip, curl: 0.1, fold: 0.15, bias: V(0, 1, 0) });
}

/** pine needle tuft: a fan of long needles around `d` */
export function tuft(ctx: Ctx, at: THREE.Vector3, d: THREE.Vector3, len: number, colors: RGB[], tip: RGB) {
  const R = ctx.R;
  const n = Math.round(lerp(12, 24, ctx.q));
  for (let i = 0; i < n; i++) {
    const nd = wobble(d, 1.15, R);
    const col = jitter(colors[Math.floor(R() * colors.length)], R, 0.08);
    leaf(ctx.leaf, at, nd, sideOf(nd), len * (0.75 + R() * 0.4), len * 0.24, { shape: LEAF.needle, segs: 2, color: col, tip, curl: 0.3, fold: 0, flat: true, bias: nd, biasAmt: 0.45 });
  }
}
/** larch short-shoot: a small soft rosette */
function rosette(ctx: Ctx, at: THREE.Vector3, len: number, colors: RGB[], tip: RGB) {
  const R = ctx.R;
  const n = Math.round(lerp(5, 9, ctx.q));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const nd = V(Math.cos(a), 0.6 + R() * 0.4, Math.sin(a)).normalize();
    leaf(ctx.leaf, at, nd, sideOf(nd), len * (0.8 + R() * 0.4), 0.12, { shape: LEAF.needle, segs: 1, color: colors[Math.floor(R() * colors.length)], tip, flat: true, curl: 0.2, bias: V(0, 1, 0), biasAmt: 0.5 });
  }
}

const cone = (_k = 1) => (u: number) => Math.pow(1 - u, 0.92) * sstep(-0.05, 0.12, u) + 0.02;

S['norway-spruce'] = {
  label: 'Norway spruce', height: [3, 10, 20],
  build: (ctx) => conifer(ctx, {
    refH: 10, r0: Number(ctx.P.height) * 0.024, crownBase: 0.07, width: 4.4, shape: cone(1), whorl: 0.34, perWhorl: [5, 7], tilt: -0.05, tiltTop: 0.5, droop: 0.55, tipUp: 0.32,
    foliage: 'spruce', colors: { summer: ['#173f2c', '#1f4b33', '#24553a'], spring: ['#1d4a32', '#24553a', '#3f7a3c'], winter: ['#173a2a', '#1b4130'], autumn: ['#183f2c', '#1f4a33'] },
    bark: { base: '#5c4636', dark: '#3a2c22', furrow: 0.5, moss: 0.4 }, cones: { color: '#7a5034', len: 0.22, mode: 'hang', count: 7 }, sprayLen: 0.55, sprayW: 0.3,
  }),
};
S['balsam-fir'] = {
  label: 'Balsam fir', height: [3, 9, 18],
  build: (ctx) => conifer(ctx, {
    refH: 9, r0: Number(ctx.P.height) * 0.02, crownBase: 0.05, width: 3.4, shape: (u) => Math.pow(1 - u, 1.05) * sstep(-0.05, 0.08, u) + 0.02, whorl: 0.3, perWhorl: [4, 6], tilt: 0.08, tiltTop: 0.55, droop: 0.12, tipUp: 0.1,
    foliage: 'fir', colors: { summer: ['#1b4733', '#245a3e', '#2a6143'], spring: ['#245a3e', '#3a7a46'], winter: ['#1a4230', '#20503a'], autumn: ['#1c4733', '#245a3e'] },
    bark: { base: '#6f6a62', dark: '#4a4640', furrow: 0.15, moss: 0.3 }, cones: { color: '#4f3a5a', len: 0.18, mode: 'up', count: 9 }, sprayLen: 0.5, sprayW: 0.26,
  }),
};
S['scots-pine'] = {
  label: 'Scots pine', height: [3, 10, 22],
  build: (ctx) => {
    const H = Number(ctx.P.height), young = H < 6;
    conifer(ctx, {
      refH: young ? H : 10, r0: H * 0.024, crownBase: young ? 0.12 : 0.5, width: young ? 3.2 : 5.2, shape: young ? cone(1) : (u) => (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.1))) * (1 - u * 0.25), whorl: young ? 0.5 : 0.65, perWhorl: [3, 5],
      tilt: young ? 0.15 : 0.32, tiltTop: 0.65, droop: 0.15, tipUp: 0.3, foliage: 'pine',
      colors: { summer: ['#2c5a45', '#35634a', '#3e6e4d'], spring: ['#35634a', '#4a7d50'], winter: ['#2a5442', '#33604a'], autumn: ['#2e5a45', '#38654c'] },
      bark: { base: '#5a4334', dark: '#382a20', furrow: 0.6, moss: 0.2 }, upperBark: '#c2703c', cones: { color: '#8a6440', len: 0.12, mode: 'side', count: 6 }, sprayLen: 0.3, sprayW: 0.1,
    });
  },
};
S['atlas-cedar'] = {
  label: 'Blue Atlas cedar', height: [4, 11, 22],
  build: (ctx) => conifer(ctx, {
    refH: 11, r0: Number(ctx.P.height) * 0.03, crownBase: 0.1, width: 6.4, shape: (u) => Math.pow(1 - u, 0.75) * sstep(-0.05, 0.1, u) + 0.03, whorl: 0.42, perWhorl: [4, 6], tilt: 0.04, tiltTop: 0.6, droop: 0.06, tipUp: 0.05,
    foliage: 'cedar', colors: { summer: ['#4f7f7f', '#5d8e8a', '#6b9c95'], spring: ['#5d8e8a', '#76a59a'], winter: ['#4a7878', '#57888a'], autumn: ['#4f7f7f', '#5d8e8a'] },
    bark: { base: '#615a54', dark: '#3d3733', furrow: 0.35 }, cones: { color: '#8a7a5a', len: 0.16, mode: 'up', count: 10 }, sprayLen: 0.62, sprayW: 0.55,
  }),
};
S.larch = {
  label: 'European larch', height: [4, 11, 22], seasonal: true,
  build: (ctx) => conifer(ctx, {
    refH: 11, r0: Number(ctx.P.height) * 0.021, crownBase: 0.18, width: 4.2, shape: cone(1), whorl: 0.45, perWhorl: [4, 6], tilt: 0.12, tiltTop: 0.6, droop: 0.4, tipUp: 0.2,
    foliage: 'cypress', colors: { summer: ['#5f9a46', '#6fa84e', '#7fb45a'], spring: ['#8cc45c', '#a3d36a'], autumn: ['#d9a52e', '#e2b542', '#c98a26'] },
    bark: { base: '#6a5040', dark: '#45332a', furrow: 0.5 }, cones: { color: '#8a6a4a', len: 0.06, mode: 'up', count: 14 }, sprayLen: 0.6, sprayW: 0.3,
  }),
};
S['coast-redwood'] = {
  label: 'Coast redwood', height: [6, 18, 24],
  build: (ctx) => conifer(ctx, {
    refH: 18, r0: Number(ctx.P.height) * 0.05, crownBase: 0.3, width: 6.4, shape: (u) => Math.pow(1 - u, 0.7) * (0.75 + 0.25 * sstep(0, 0.2, u)) + 0.04, whorl: 0.3, perWhorl: [5, 7], tilt: -0.12, tiltTop: 0.35, droop: 0.45, tipUp: 0.22,
    foliage: 'redwood', colors: { summer: ['#2f5a2e', '#3a6834', '#466f36'], spring: ['#3a6834', '#557d3c'], winter: ['#2c552c', '#355f30'], autumn: ['#2f5a2e', '#3a6834'] },
    bark: { base: '#8a4a2e', dark: '#5a2e1c', furrow: 0.9, moss: 0.25 }, cones: { color: '#6a4a30', len: 0.06, mode: 'hang', count: 8 }, sprayLen: 0.85, sprayW: 0.36, flareAmt: 0.5, lobes: 7,
  }),
};
S['bald-cypress'] = {
  label: 'Bald cypress', height: [5, 13, 22], seasonal: true,
  build: (ctx) => {
    const H = Number(ctx.P.height);
    conifer(ctx, {
      refH: 13, r0: H * 0.04, crownBase: 0.28, width: 6.6, shape: (u) => Math.sin(Math.PI * Math.min(1, 0.2 + u * 0.8)) * (1 - u * 0.4) + 0.05, whorl: 0.38, perWhorl: [4, 6], tilt: 0.05, tiltTop: 0.45, droop: 0.25, tipUp: 0.1,
      foliage: 'cypress', colors: { summer: ['#5e8f3e', '#6b9a44', '#79a64c'], spring: ['#86b856', '#98c463'], autumn: ['#b85a2a', '#c9692e', '#a84e24'] },
      bark: { base: '#8d7560', dark: '#5f4d3e', furrow: 0.7, moss: 0.3 }, cones: { color: '#6f7a4a', len: 0.07, mode: 'side', count: 6 }, sprayLen: 0.7, sprayW: 0.34, flareAmt: 1.6, lobes: 6,
    });
    // cypress "knees": woody bumps that rise from the roots around the tree
    const R = ctx.R;
    for (let i = 0; i < 9; i++) {
      const a = R() * TAU, d = rnd(R, 1, 2.6), h = rnd(R, 0.2, 0.6);
      const b = V(Math.cos(a) * d, 0, Math.sin(a) * d);
      sweep(ctx.bark, [b.clone().add(V(0, -0.05, 0)), b.clone().add(V(0, h * 0.6, 0)), b.clone().add(V(0.02, h, 0))], (t) => 0.09 * (1 - t * 0.6), { sides: 6, color: (_t, aa, p) => barkPaint({ base: '#8d7560', dark: '#5f4d3e' }, ctx.seed, H)(0, aa, p) });
    }
    // Spanish moss hanging from the lower limbs (an epiphyte, not a moss)
    if (ctx.season !== 'winter' || true) {
      const moss = rgb('#9aa58e');
      for (let i = 0; i < Math.round(14 * ctx.q); i++) {
        const y = rnd(R, 0.38, 0.7) * H, a = R() * TAU, r = rnd(R, 0.8, 2.6);
        const top = V(Math.cos(a) * r, y, Math.sin(a) * r);
        const len = rnd(R, 0.6, 1.6);
        for (let k = 0; k < 3; k++) leaf(ctx.leaf, top.clone().add(V((R() - 0.5) * 0.2, 0, (R() - 0.5) * 0.2)), V((R() - 0.5) * 0.2, -1, (R() - 0.5) * 0.2), V(Math.cos(a + k), 0, Math.sin(a + k)), len, 0.12, { shape: (t) => (Math.round(t * 6) % 2 ? 1 : 0.4) * (1 - t * 0.7), segs: 6, color: jitter(moss, R, 0.1), curl: 0, fold: 0, flat: true });
      }
    }
  },
};

/* ======================================================================== */
/*  palms                                                                   */
/* ======================================================================== */
interface Palm { r: number; curve: number; fronds: number; frondLen: number; pinnae: number; pinnaLen: number; pinnaW: number; droop: number; stiff: number; boots: boolean; trunk: [string, string]; leaves: string[]; dead: number; fruit?: { color: string; r: number; count: number; long?: boolean } }
function palm(ctx: Ctx, s: Palm) {
  const { R, P } = ctx;
  const H = Number(P.height), sp = Number(P.spread);
  const az = R() * TAU, lean = s.curve + Number(P.lean);
  const trunk: THREE.Vector3[] = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; trunk.push(V(Math.cos(az) * lean * H * t * t, t * H, Math.sin(az) * lean * H * t * t)); }
  const c0 = rgb(s.trunk[0]), c1 = rgb(s.trunk[1]);
  const ring = 0.11;
  sweep(ctx.bark, trunk, (t) => s.r * (1.45 - 0.45 * sstep(0, 0.12, t)) * (1 - t * 0.12), {
    sides: ctx.q > 0.6 ? 10 : 7, capStart: true,
    color: (t, a, p) => {
      const f = (p.y / ring) % 1;
      let c = mixc(c0, c1, f < 0.3 ? 0.85 : 0.1 + fbm3(Math.cos(a), p.y * 3, Math.sin(a), 2, ctx.seed) * 0.4);
      if (s.boots) c = mixc(c, shade(c0, 0.75), Math.abs(Math.sin(a * 6 + p.y * 9)) > 0.75 ? 0.6 : 0);
      return shade(c, lerp(0.8, 1, t));
    },
    radial: s.boots ? (t, a) => 1 + 0.12 * Math.max(0, Math.sin(a * 6 + t * H * 9)) * sstep(0.1, 0.4, t) : (t) => 1 + 0.04 * Math.sin(t * H / ring * TAU),
  });
  const top = trunk[trunk.length - 1];
  const leaves = s.leaves.map(rgb), yellow = rgb('#c9b25a'), brown = rgb('#8a6a3c');
  const nf = Math.round(s.fronds * lerp(0.75, 1, ctx.q));
  const pinnae = Math.round(s.pinnae * lerp(0.55, 1, ctx.q));
  const lk = 1 / Math.sqrt(lerp(0.55, 1, ctx.q));
  const frond = (i: number, dead: boolean) => {
    const f = i / nf;
    const elev = dead ? -1.35 + R() * 0.15 : lerp(1.15, -0.55, f) + (R() - 0.5) * 0.2;
    const a = i * 2.39996 + R() * 0.3;
    const d = V(Math.cos(a) * Math.cos(elev), Math.sin(elev), Math.sin(a) * Math.cos(elev));
    const L = s.frondLen * sp * (dead ? 0.7 : 0.85 + R() * 0.3);
    const pts = bentPath(top.clone().add(V(0, -0.15, 0)), d, L, 8, { pull: V(0, -(s.droop * (0.5 + f)), 0), pullAmt: 1 });
    sweep(ctx.bark, pts, (t) => 0.045 * (1 - t * 0.8) * Math.max(0.4, L / 4), { sides: 4, color: (t) => dead ? brown : mixc(yellow, leaves[0], t * 0.6), smooth: false });
    const np = Math.round(pinnae * (dead ? 0.5 : 1));
    for (let j = 0; j < np; j++) {
      const t = lerp(0.1, 0.99, j / (np - 1));
      const at = along(pts, t);
      const side = V().crossVectors(at.d, V(0, 1, 0)).normalize();
      const upv = V().crossVectors(side, at.d).normalize();
      for (const sg of [-1, 1]) {
        const pd = at.d.clone().multiplyScalar(0.55).addScaledVector(side, sg).addScaledVector(upv, s.stiff * 0.6 - 0.15).normalize();
        const len = s.pinnaLen * sp * Math.sin(Math.PI * (0.12 + 0.86 * t)) * (0.85 + R() * 0.3) * lk;
        const col = dead ? jitter(brown, R, 0.15) : jitter(leaves[Math.floor(R() * leaves.length)], R, 0.08);
        leaf(ctx.leaf, at.p, pd, at.d, len, s.pinnaW * lk, { shape: LEAF.lance, segs: 3, color: col, tip: dead ? brown : shade(col, 1.12), curl: dead ? 0.9 : (1 - s.stiff) * 0.9, fold: 0.3, bias: upv, biasAmt: 0.45, flat: ctx.q < 0.9 });
      }
    }
  };
  for (let i = 0; i < nf; i++) frond(i, false);
  for (let i = 0; i < s.dead; i++) frond(i, true);
  // crownshaft / boots at the top
  blob(ctx.bark, top.clone().add(V(0, -0.1, 0)), s.r * 1.3, 0.35, s.r * 1.3, () => s.boots ? brown : mixc(yellow, leaves[0], 0.4), { w: 8, h: 5 });
  if (s.fruit && ctx.season !== 'winter') {
    const fc = rgb(s.fruit.color);
    for (let k = 0; k < s.fruit.count; k++) {
      const a = R() * TAU, r = s.r * rnd(R, 1.1, 1.7);
      const p = top.clone().add(V(Math.cos(a) * r, -0.35 - R() * (s.fruit.long ? 0.8 : 0.35), Math.sin(a) * r));
      if (s.fruit.long) {
        // date bunches: a strand of small oval fruits
        sweep(ctx.bark, [top.clone().add(V(0, -0.2, 0)), p], () => 0.015, { sides: 3, color: () => rgb('#c9a44a'), smooth: false });
        for (let m = 0; m < 6; m++) blob(ctx.bark, p.clone().add(V((R() - 0.5) * 0.18, -R() * 0.4, (R() - 0.5) * 0.18)), s.fruit.r, s.fruit.r * 1.4, s.fruit.r, () => jitter(fc, R, 0.1), { w: 5, h: 4 });
      } else blob(ctx.bark, p, s.fruit.r, s.fruit.r * 1.08, s.fruit.r, (nn) => mixc(fc, shade(fc, 0.7), nn.y < 0 ? 0.4 : 0), { w: 8, h: 6 });
    }
  }
}
S['coconut-palm'] = {
  label: 'Coconut palm', height: [3, 8, 16],
  build: (ctx) => palm(ctx, { r: 0.16, curve: 0.12, fronds: 16, frondLen: 3.6, pinnae: 34, pinnaLen: 0.85, pinnaW: 0.07, droop: 1.1, stiff: 0.15, boots: false, trunk: ['#8a7660', '#5f5040'], leaves: ['#3e7a32', '#4b8a38', '#5a963e'], dead: 3, fruit: { color: '#5b7a2e', r: 0.13, count: 9 } }),
};
S['date-palm'] = {
  label: 'Date palm', height: [3, 8, 16],
  build: (ctx) => palm(ctx, { r: 0.22, curve: 0.02, fronds: 26, frondLen: 3.2, pinnae: 30, pinnaLen: 0.55, pinnaW: 0.05, droop: 0.55, stiff: 0.75, boots: true, trunk: ['#8d7454', '#5a4632'], leaves: ['#5f7f5a', '#6d8c64', '#7a9a6c'], dead: 4, fruit: { color: '#d07a26', r: 0.04, count: 7, long: true } }),
};

/* ======================================================================== */
/*  broadleaf trees                                                         */
/* ======================================================================== */
/** scaffold limbs from a list of attachment points on the trunk */
function scaffolds(ctx: Ctx, a: Arch, trunk: THREE.Vector3[], rAt: (t: number) => number, from: number, to: number, n: number, angle: number, len: (u: number) => number, paint: (t: number, ang: number, p: THREE.Vector3, level?: number) => RGB, twig: (pts: THREE.Vector3[], level: number, r: number) => void) {
  const R = ctx.R;
  const ph = R() * TAU;
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 1 : i / (n - 1);
    const t = lerp(from, to, u);
    const at = along(trunk, t);
    const az = ph + i * 2.39996 + (R() - 0.5) * 0.4;
    const out = V(Math.cos(az), 0, Math.sin(az));
    const ang = angle * (0.85 + R() * 0.3);
    const d = at.d.clone().multiplyScalar(Math.cos(ang)).addScaledVector(out, Math.sin(ang)).normalize();
    grow(ctx, a, at.p.clone().addScaledVector(out, rAt(t) * 0.6), d, len(u) * (0.85 + R() * 0.3), rAt(t) * a.rRatio, 1, paint, twig);
  }
}

function broadleaf(ctx: Ctx, o: {
  trunkH: number; r0: number; lean?: number; arch: Arch; bark: BarkLook; leaf: LeafLook; pal: Partial<Record<Season, string[]>> & { summer: string[] };
  scaff: { from: number; to: number; n: number; angle: number; len: (u: number) => number; top?: boolean };
  flowers?: (pts: THREE.Vector3[]) => void; flare?: number; stems?: number; stemSpread?: number; leader?: number;
}) {
  const { P, R } = ctx;
  const H = Number(P.height), sp = Number(P.spread);
  const paint = barkPaint(o.bark, ctx.seed, H);
  const cols = seasonal(ctx, o.pal);
  const leaf0 = ctx.leaf.vcount;
  const center = V(0, lerp(o.trunkH, H, 0.55), 0);
  const look: LeafLook = { ...o.leaf, colors: cols ?? [rgb('#000000')] };
  const dens = Number(P.density);
  const twig = (pts: THREE.Vector3[]) => {
    if (cols) leafTwig(ctx, pts, look, center, dens);
    o.flowers?.(pts);
  };
  const stems = o.stems ?? 1;
  for (let s = 0; s < stems; s++) {
    const off = stems === 1 ? V() : V(Math.cos(s * 2.4 + R()) * (o.stemSpread ?? 0.15), 0, Math.sin(s * 2.4 + R()) * (o.stemSpread ?? 0.15));
    const lead = o.leader ?? 1; // trunk length as a fraction of H (excurrent birches run the trunk to the top)
    const tH = (stems > 1 ? 0.85 + R() * 0.2 : 1) * H * lead;
    const tr = trunkPath(ctx, tH, (o.lean ?? 0.03) + Number(P.lean) + (stems > 1 ? 0.08 : 0), 10, 0.015).map((p) => p.add(off));
    if (stems > 1) { const az = s * 2.4 + R(); for (const p of tr) { p.x += Math.cos(az) * p.y * 0.12; p.z += Math.sin(az) * p.y * 0.12; } }
    const r0 = o.r0 * (stems > 1 ? 0.7 : 1);
    const rAt = (t: number) => r0 * lerp(1, 0.28, Math.pow(t, 0.8));
    sweep(ctx.bark, tr, rAt, { sides: ctx.q > 0.6 ? 9 : 7, capStart: true, color: (t, a, p) => paint(t, a, p, 0), radial: o.flare ? flare(o.flare, 5, ctx.seed + s) : undefined });
    const sc = o.scaff;
    scaffolds(ctx, o.arch, tr, rAt, sc.from, sc.to, Math.round(sc.n / Math.sqrt(stems)), sc.angle, (u) => sc.len(u) * sp, paint, twig);
  }
  if (cols) crownShade(ctx.leaf, leaf0, center, Math.max(1, H * 0.35 * sp), H - o.trunkH, 0.4);
}

const BIRCH_ARCH: Arch = { levels: 3, kids: [[0, 0], [3, 5], [3, 4]], angle: [0, 0.75, 0.7], ratio: [0, 0.55, 0.5], start: 0.2, up: 0.25, sag: 1.6, gnarl: 0.08, rRatio: 0.55, segs: 6 };
S['paper-birch'] = {
  label: 'Paper birch', height: [4, 11, 20], seasonal: true,
  build: (ctx) => {
    const H = Number(ctx.P.height);
    broadleaf(ctx, {
      trunkH: H * 0.35, r0: H * 0.016, arch: BIRCH_ARCH, stems: ctx.seed % 3 === 0 ? 2 : 1, leader: 0.95,
      bark: { base: '#ece8de', dark: '#cfc8ba', furrow: 0.05, lenticels: '#1e1a18', twig: '#4a3326' },
      leaf: { shape: 'oval', len: 0.17, width: 0.72, per: 6, clusters: 4, droop: 0.45, colors: [] },
      pal: { summer: ['#4f8a34', '#5c9a3c', '#6aa646'], spring: ['#8cc45a', '#9fd06a'], autumn: ['#e2b52e', '#d9a326', '#eac44a'] },
      scaff: { from: 0.32, to: 0.92, n: 12, angle: 0.75, len: (u) => H * 0.32 * (1 - u * 0.6) },
      flowers: (pts) => {
        if (ctx.season !== 'spring' || ctx.R() > 0.35) return;
        const at = pts[pts.length - 1];
        sweep(ctx.leaf, [at, at.clone().add(V(0.01, -0.12, 0))], () => 0.012, { sides: 4, color: () => rgb('#c9b45a') });
      },
    });
  },
};
const CHERRY_ARCH: Arch = { levels: 3, kids: [[0, 0], [3, 4], [3, 4]], angle: [0, 0.6, 0.7], ratio: [0, 0.6, 0.55], start: 0.25, up: 0.35, sag: 0.5, gnarl: 0.12, rRatio: 0.6, segs: 5 };
S.cherry = {
  label: 'Japanese cherry', height: [3, 7, 12], seasonal: true,
  build: (ctx) => {
    const H = Number(ctx.P.height), spring = ctx.season === 'spring';
    const pink = rgb('#f4b3cc'), pink2 = rgb('#fbd3e2'), dark = rgb('#c04878');
    broadleaf(ctx, {
      trunkH: H * 0.28, r0: H * 0.03, arch: CHERRY_ARCH,
      bark: { base: '#5a3a30', dark: '#3a2620', furrow: 0.15, bands: '#9a7a66', twig: '#5a3a30' },
      leaf: { shape: 'ellipse', len: 0.22, width: 0.5, per: spring ? 2 : 7, clusters: spring ? 2 : 4, droop: 0.4, colors: [] },
      pal: { summer: ['#3f7a34', '#4a8a3a', '#55963e'], spring: ['#8aa84a', '#9ab85a'], autumn: ['#c9502a', '#d9732e', '#b84028', '#e09a3a'] },
      scaff: { from: 0.28, to: 0.42, n: 5, angle: 0.75, len: (u) => H * 0.55 * (1 - u * 0.2) },
      flowers: (pts) => {
        if (!spring) return;
        const n = Math.round(lerp(4, 9, ctx.q));
        for (let k = 0; k < n; k++) {
          const at = along(pts, 0.25 + ctx.R() * 0.75);
          const nd = V((ctx.R() - 0.5) * 1.2, 0.8, (ctx.R() - 0.5) * 1.2).normalize();
          blossom(ctx, at.p.clone().addScaledVector(nd, 0.04), nd, 0.07 / Math.sqrt(lerp(0.6, 1, ctx.q)), ctx.R() < 0.5 ? pink : pink2, dark);
        }
      },
    });
  },
};
const APPLE_ARCH: Arch = { levels: 3, kids: [[0, 0], [3, 4], [3, 4]], angle: [0, 0.75, 0.8], ratio: [0, 0.55, 0.5], start: 0.2, up: 0.2, sag: 0.7, gnarl: 0.25, rRatio: 0.6, segs: 5 };
S.apple = {
  label: 'Apple tree', height: [2.5, 5.5, 9], seasonal: true,
  build: (ctx) => {
    const H = Number(ctx.P.height), season = ctx.season;
    const white = rgb('#f8eef0'), blush = rgb('#efc6d4'), apple = rgb(season === 'autumn' ? '#c4322a' : '#8fb33a');
    broadleaf(ctx, {
      trunkH: H * 0.3, r0: H * 0.035, arch: APPLE_ARCH, lean: 0.06,
      bark: { base: '#6a5444', dark: '#433428', furrow: 0.55, moss: 0.3 },
      leaf: { shape: 'oval', len: 0.21, width: 0.62, per: 7, clusters: 4, droop: 0.4, colors: [] },
      pal: { summer: ['#3f7a34', '#4c8a3a', '#5a9640'], spring: ['#7aae4a', '#8cbc56'], autumn: ['#8aa83a', '#b8a83a', '#c9962e'] },
      scaff: { from: 0.28, to: 0.6, n: 7, angle: 0.9, len: (u) => H * 0.6 * (1 - u * 0.25) },
      flowers: (pts) => {
        const R = ctx.R;
        if (season === 'spring') {
          for (let k = 0; k < Math.round(lerp(2, 5, ctx.q)); k++) {
            const at = along(pts, 0.4 + R() * 0.6);
            const nd = V((R() - 0.5), 0.9, (R() - 0.5)).normalize();
            blossom(ctx, at.p.clone().addScaledVector(nd, 0.03), nd, 0.06 / Math.sqrt(lerp(0.6, 1, ctx.q)), R() < 0.6 ? white : blush, rgb('#e8c84a'));
          }
        } else if ((season === 'summer' || season === 'autumn') && R() < 0.4) {
          const at = along(pts, 0.6 + R() * 0.4);
          blob(ctx.bark, at.p.clone().add(V(0, -0.07, 0)), 0.06, 0.055, 0.06, (nn) => mixc(apple, shade(apple, 0.7), nn.x * 0.5 + 0.5), { w: 8, h: 6 });
        }
      },
    });
  },
};

/* ---------------- umbrella thorn acacia ---------------- */
S['umbrella-acacia'] = {
  label: 'Umbrella thorn acacia', height: [3, 6, 10],
  build: (ctx) => {
    const { R, P } = ctx;
    const H = Number(P.height), sp = Number(P.spread);
    const paint = barkPaint({ base: '#5e5248', dark: '#3a312a', furrow: 0.5 }, ctx.seed, H);
    const cols = seasonal(ctx, { summer: ['#5f7d3a', '#6c8a42', '#7a9648'], winter: ['#7a7a3a', '#8a8442'], autumn: ['#6f803c', '#7c8a44'] })!;
    const forkY = H * 0.22;
    const trunk = trunkPath(ctx, forkY, 0.05 + Number(P.lean), 4, 0.02);
    sweep(ctx.bark, trunk, (t) => H * 0.045 * lerp(1, 0.75, t), { sides: 8, capStart: true, color: (t, a, p) => paint(t, a, p, 0), radial: flare(0.3, 4, ctx.seed) });
    const top = trunk[trunk.length - 1];
    const crownY = H * 0.86, R0 = H * 0.75 * sp;
    const leaf0 = ctx.leaf.vcount;
    const leaders = pick(R, [3, 5]);
    const pad = (c: THREE.Vector3, r: number) => {
      // a flat pad of tiny leaves: acacia crowns are layered like plates
      const n = Math.round(lerp(14, 34, ctx.q) * r * Number(P.density));
      for (let k = 0; k < n; k++) {
        const a = R() * TAU, d = Math.sqrt(R()) * r;
        const p = c.clone().add(V(Math.cos(a) * d, (R() - 0.5) * 0.18, Math.sin(a) * d));
        const dir = V(Math.cos(a + 1.3), 0.12, Math.sin(a + 1.3)).normalize();
        leaf(ctx.leaf, p, dir, V(0, 1, 0).cross(dir).normalize(), rnd(R, 0.2, 0.32), 0.42, { shape: (t) => (Math.round(t * 6) % 2 ? 1 : 0.45) * Math.sin(Math.PI * t), segs: 4, color: jitter(cols[Math.floor(R() * cols.length)], R, 0.1), curl: 0.05, fold: 0.05, bias: V(0, 1, 0), biasAmt: 0.7, flat: true });
      }
    };
    for (let i = 0; i < leaders; i++) {
      const az = (i / leaders) * TAU + R() * 0.6;
      const reach = R0 * rnd(R, 0.35, 0.55);
      const end = V(Math.cos(az) * reach, crownY * rnd(R, 0.82, 0.95), Math.sin(az) * reach);
      const mid = top.clone().lerp(end, 0.5).add(V((R() - 0.5) * 0.4, 0.2, (R() - 0.5) * 0.4));
      const pts = spline([top, mid, end], 7);
      sweep(ctx.bark, pts, (t) => H * 0.03 * lerp(1, 0.35, t), { sides: 6, color: (t, a, p) => paint(t, a, p, 1) });
      // horizontal secondary limbs fan out at the top, each carrying a leaf plate
      const k2 = pick(R, [3, 4]);
      for (let j = 0; j < k2; j++) {
        const a2 = az + (j - (k2 - 1) / 2) * 0.7 + (R() - 0.5) * 0.3;
        const l2 = R0 * rnd(R, 0.2, 0.32);
        const e2 = end.clone().add(V(Math.cos(a2) * l2, rnd(R, -0.1, 0.25), Math.sin(a2) * l2));
        const p2 = spline([end, end.clone().lerp(e2, 0.5).add(V(0, 0.15, 0)), e2], 5);
        sweep(ctx.bark, p2, (t) => H * 0.012 * lerp(1, 0.3, t), { sides: 4, color: (t, a, p) => paint(t, a, p, 2) });
        pad(e2.clone().add(V(0, 0.18, 0)), l2 * 0.75);
        pad(end.clone().lerp(e2, 0.5).add(V(0, 0.25, 0)), l2 * 0.5);
      }
    }
    pad(V(0, crownY + 0.2, 0), R0 * 0.32);
    crownShade(ctx.leaf, leaf0, V(0, crownY - 0.5, 0), R0 * 0.6, 1.2, 0.35);
  },
};

/* ---------------- baobab ---------------- */
S.baobab = {
  label: 'African baobab', height: [5, 12, 20], seasonal: true,
  build: (ctx) => {
    const { R, P } = ctx;
    const H = Number(P.height), sp = Number(P.spread);
    const paint = barkPaint({ base: '#9a8a7c', dark: '#6f6158', furrow: 0.25 }, ctx.seed, H);
    const tH = H * 0.66, r0 = H * 0.115;
    const prof: [number, number][] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      prof.push([r0 * (1.0 + 0.12 * Math.sin(Math.PI * Math.min(1, t * 1.4)) - 0.5 * sstep(0.62, 1, t)) * (t < 0.04 ? 1.12 : 1), t * tH]);
    }
    lathe(ctx.bark, prof, V(), ctx.q > 0.6 ? 24 : 16, (_t, a, p) => paint(p.y / H, a, p, 0), (t, a) => 1 + 0.06 * Math.sin(a * 9 + t * 3) + 0.05 * fbm3(Math.cos(a) * 2, t * 4, Math.sin(a) * 2, 2, ctx.seed));
    const cols = seasonal(ctx, { summer: ['#4f7a34', '#5a8a3c', '#66963f'] });
    const leaf0 = ctx.leaf.vcount;
    const center = V(0, tH + H * 0.15, 0);
    const n = pick(R, [6, 9]);
    const topR = r0 * 0.4;
    for (let i = 0; i < n; i++) {
      const az = (i / n) * TAU + R() * 0.5;
      const ang = rnd(R, 0.6, 1.15);
      const d = V(Math.cos(az) * Math.sin(ang), Math.cos(ang), Math.sin(az) * Math.sin(ang));
      const st = V(Math.cos(az) * topR, tH - 0.3, Math.sin(az) * topR);
      const arch: Arch = { levels: 3, kids: [[0, 0], [2, 3], [2, 3]], angle: [0, 0.6, 0.7], ratio: [0, 0.6, 0.55], start: 0.4, up: 0.1, sag: 0.1, gnarl: 0.28, rRatio: 0.55, segs: 5 };
      grow(ctx, arch, st, d, H * rnd(R, 0.28, 0.4) * sp, H * 0.035, 1, (t, a, p, l) => paint(t, a, p, l), (pts) => {
        if (cols) leafTwig(ctx, pts, { shape: 'lance', len: 0.26, width: 0.38, per: 7, clusters: 2, spread: 1.3, droop: 0.2, colors: cols }, center, Number(P.density));
        if ((ctx.season === 'summer' || ctx.season === 'autumn') && R() < 0.18) {
          const tip = pts[pts.length - 1];
          const pod = tip.clone().add(V(0, -0.45, 0));
          sweep(ctx.bark, [tip, pod], () => 0.01, { sides: 3, color: () => rgb('#6a5a40'), smooth: false });
          blob(ctx.bark, pod.add(V(0, -0.12, 0)), 0.07, 0.15, 0.07, () => rgb('#a8987a'), { w: 7, h: 5 });
        }
      });
    }
    if (cols) crownShade(ctx.leaf, leaf0, center, H * 0.4, H * 0.4, 0.35);
  },
};

/* ---------------- kapok (rainforest emergent) ---------------- */
S.kapok = {
  label: 'Kapok tree', height: [8, 16, 24],
  build: (ctx) => {
    const { R, P } = ctx;
    const H = Number(P.height), sp = Number(P.spread);
    const paint = barkPaint({ base: '#8f8a7e', dark: '#6a665c', furrow: 0.15, moss: 0.7 }, ctx.seed, H);
    const trunk = trunkPath(ctx, H * 0.8, 0.01 + Number(P.lean) * 0.3, 12, 0.006);
    const r0 = H * 0.032;
    const rAt = (t: number) => r0 * lerp(1, 0.7, t);
    // buttress roots: thin radial fins that flare out at the base
    sweep(ctx.bark, trunk, rAt, { sides: ctx.q > 0.6 ? 16 : 12, capStart: true, color: (t, a, p) => paint(t, a, p, 0), radial: (t, a) => 1 + 3.2 * Math.pow(Math.max(0, 1 - t * 6), 2.2) * Math.pow(Math.max(0, Math.cos(a * 5 + ctx.seed)), 6) });
    const top = trunk[trunk.length - 1];
    const cols = seasonal(ctx, { summer: ['#2f6a2e', '#3a7832', '#468436'], winter: ['#2f6a2e', '#3a7832'], autumn: ['#3a7230', '#4a7e34'], spring: ['#4a8a3a', '#5a9a40'] })!;
    const leaf0 = ctx.leaf.vcount;
    const center = V(0, H * 0.9, 0);
    const n = pick(R, [5, 7]);
    const limbs: THREE.Vector3[][] = [];
    for (let i = 0; i < n; i++) {
      const az = (i / n) * TAU + R() * 0.5;
      const d = V(Math.cos(az), rnd(R, 0.35, 0.6), Math.sin(az)).normalize();
      const arch: Arch = { levels: 3, kids: [[0, 0], [4, 5], [3, 4]], angle: [0, 0.8, 0.85], ratio: [0, 0.55, 0.55], start: 0.3, up: 0.6, sag: 0.25, gnarl: 0.1, rRatio: 0.55, segs: 5 };
      grow(ctx, arch, top.clone().add(V(0, -0.3 * i / n, 0)), d, H * 0.46 * sp * rnd(R, 0.85, 1.1), r0 * 0.6, 1, (t, a, p, l) => paint(t, a, p, l), (pts, lv) => {
        // palmate leaves: five to seven leaflets fanned from one stalk
        leafTwig(ctx, pts, { shape: 'lance', len: 0.48, width: 0.32, per: 7, clusters: 3, spread: 1.35, droop: 0.35, colors: cols }, center, Number(P.density));
        if (lv === 1) limbs.push(pts);
      });
      limbs.push(bentPath(top, d, H * 0.25, 4, {}));
    }
    crownShade(ctx.leaf, leaf0, center, H * 0.42 * sp, H * 0.25, 0.4);
    // lianas hanging from the limbs and epiphytes (bromeliads) perched on them
    const vine = rgb('#5a6a3a');
    for (let i = 0; i < Math.round(lerp(4, 9, ctx.q)); i++) {
      const lb = limbs[Math.floor(R() * limbs.length)];
      const at = along(lb, rnd(R, 0.3, 0.9)).p;
      const bottom = V(at.x * 0.9 + (R() - 0.5) * 0.8, 0, at.z * 0.9 + (R() - 0.5) * 0.8);
      const mid = at.clone().lerp(bottom, 0.5).add(V((R() - 0.5) * 1.2, 0, (R() - 0.5) * 1.2));
      sweep(ctx.bark, spline([at, mid, bottom], 10), () => rnd(R, 0.018, 0.035), { sides: 4, color: (t) => mixc(vine, rgb('#6a5a3a'), t) });
    }
    for (let i = 0; i < Math.round(lerp(3, 7, ctx.q)); i++) {
      const lb = limbs[Math.floor(R() * limbs.length)];
      const at = along(lb, rnd(R, 0.2, 0.7)).p.add(V(0, 0.12, 0));
      bromeliad(ctx, at, rnd(R, 0.25, 0.4));
    }
  },
};
/* ---------------- red mangrove ---------------- */
S.mangrove = {
  label: 'Red mangrove', height: [3, 6, 10],
  build: (ctx) => {
    const { R, P } = ctx;
    const H = Number(P.height), sp = Number(P.spread);
    const paint = barkPaint({ base: '#6e5a4a', dark: '#4a3a30', furrow: 0.3 }, ctx.seed, H);
    const base = H * 0.22;
    const trunk = trunkPath(ctx, H * 0.55, Number(P.lean), 6, 0.02).map((p) => p.add(V(0, base, 0)));
    trunk.unshift(V(0, base * 0.6, 0));
    sweep(ctx.bark, trunk, (t) => H * 0.03 * lerp(1, 0.6, t), { sides: 8, capStart: true, color: (t, a, p) => paint(t, a, p, 0) });
    // arching prop roots from the trunk down into the mud
    const nr = Math.round(lerp(8, 14, ctx.q));
    for (let i = 0; i < nr; i++) {
      const az = (i / nr) * TAU + R() * 0.4;
      const startY = rnd(R, base * 0.7, base * 1.9);
      const st = V(Math.cos(az) * 0.08, startY, Math.sin(az) * 0.08);
      const reach = rnd(R, 1.0, 2.2) * sp;
      const end = V(Math.cos(az) * reach, -0.1, Math.sin(az) * reach);
      const mid = V(Math.cos(az) * reach * 0.55, startY + 0.25, Math.sin(az) * reach * 0.55);
      sweep(ctx.bark, spline([st, mid, end], 9), (t) => lerp(0.06, 0.035, t), { sides: 5, color: (t, a, p) => mixc(paint(t, a, p, 1), rgb('#4a3e30'), sstep(0.6, 1, t) * 0.5) });
    }
    const cols = seasonal(ctx, { summer: ['#2a5a2a', '#346a30', '#3e7434'], winter: ['#2a5a2a', '#346a30'], autumn: ['#2f5e2c', '#3a6a30'], spring: ['#3a6e32', '#4a7e38'] })!;
    const center = V(0, H * 0.75, 0);
    const leaf0 = ctx.leaf.vcount;
    const arch: Arch = { levels: 3, kids: [[0, 0], [3, 4], [3, 4]], angle: [0, 0.75, 0.75], ratio: [0, 0.55, 0.5], start: 0.3, up: 0.35, sag: 0.4, gnarl: 0.15, rRatio: 0.6, segs: 5 };
    scaffolds(ctx, arch, trunk, (t) => H * 0.03 * lerp(1, 0.6, t), 0.55, 1, 5, 0.8, () => H * 0.4 * sp, (t, a, p, l) => paint(t, a, p, l), (pts) => {
      leafTwig(ctx, pts, { shape: 'ellipse', len: 0.2, width: 0.5, per: 6, clusters: 2, droop: 0.2, fold: 0.15, colors: cols }, center, Number(P.density));
      if (R() < 0.15) { const tip = pts[pts.length - 1]; sweep(ctx.bark, [tip, tip.clone().add(V(0.02, -0.35, 0))], (t) => 0.012 * (1 - t * 0.5), { sides: 4, color: () => rgb('#5f7a2e') }); }
    });
    crownShade(ctx.leaf, leaf0, center, H * 0.42 * sp, H * 0.4, 0.4);
  },
};

/* ---------------- shrubs ---------------- */
function shrub(ctx: Ctx, o: { stems: [number, number]; angle: number; arch: Arch; bark: BarkLook; leaf: LeafLook; pal: Partial<Record<Season, string[]>> & { summer: string[] }; extra?: (pts: THREE.Vector3[]) => void; prostrate?: boolean }) {
  const { R, P } = ctx;
  const H = Number(P.height), sp = Number(P.spread);
  const paint = barkPaint(o.bark, ctx.seed, H);
  const cols = seasonal(ctx, o.pal);
  const leaf0 = ctx.leaf.vcount;
  const center = V(0, H * (o.prostrate ? 0.1 : 0.55), 0);
  const n = pick(R, o.stems);
  for (let i = 0; i < n; i++) {
    const az = (i / n) * TAU + R() * 0.5;
    const ang = o.angle * rnd(R, 0.6, 1.2);
    const d = V(Math.cos(az) * Math.sin(ang), Math.cos(ang), Math.sin(az) * Math.sin(ang));
    const len = (o.prostrate ? H * 4 : H * 0.75) * sp * rnd(R, 0.8, 1.1);
    grow(ctx, o.arch, V(Math.cos(az) * 0.04, 0, Math.sin(az) * 0.04), d, len, Math.max(0.01, H * 0.018), 1, (t, a, p, l) => paint(t, a, p, l), (pts) => {
      if (cols) leafTwig(ctx, pts, { ...o.leaf, colors: cols }, center, Number(P.density));
      o.extra?.(pts);
    });
  }
  if (cols) crownShade(ctx.leaf, leaf0, center, Math.max(0.3, H * 0.6 * sp), H, 0.45);
}
S.hawthorn = {
  label: 'Hawthorn shrub', height: [1, 2.4, 5], seasonal: true,
  build: (ctx) => {
    const R = ctx.R, s = ctx.season;
    const haw = rgb('#b8221e');
    shrub(ctx, {
      stems: [4, 6], angle: 0.45, arch: { levels: 3, kids: [[0, 0], [3, 4], [2, 4]], angle: [0, 0.7, 0.8], ratio: [0, 0.55, 0.5], start: 0.2, up: 0.3, sag: 0.4, gnarl: 0.2, rRatio: 0.6, segs: 4 },
      bark: { base: '#5a4a3e', dark: '#3a2f28', furrow: 0.3 },
      leaf: { shape: 'heart', len: 0.1, width: 0.85, per: 6, clusters: 3, droop: 0.3, colors: [] },
      pal: { summer: ['#3a6a2c', '#467832', '#528438'], spring: ['#6a9a3e', '#7aaa48'], autumn: ['#b8862e', '#c46a2a', '#9a8a34'] },
      extra: (pts) => {
        if (s === 'spring' && R() < 0.7) {
          const at = along(pts, 0.7 + R() * 0.3);
          for (let k = 0; k < 3; k++) blossom(ctx, at.p.clone().add(V((R() - 0.5) * 0.06, 0.03, (R() - 0.5) * 0.06)), V(0, 1, 0), 0.03, rgb('#f6f2ea'), rgb('#d8a8b8'));
        }
        if ((s === 'autumn' || s === 'winter') && R() < 0.6) {
          const at = along(pts, 0.6 + R() * 0.4).p;
          for (let k = 0; k < 4; k++) blob(ctx.bark, at.clone().add(V((R() - 0.5) * 0.08, -0.02 - R() * 0.05, (R() - 0.5) * 0.08)), 0.018, 0.02, 0.018, () => jitter(haw, R, 0.1), { w: 6, h: 4 });
        }
      },
    });
  },
};
S['creosote-bush'] = {
  label: 'Creosote bush', height: [0.6, 1.5, 3],
  build: (ctx) => {
    const R = ctx.R;
    shrub(ctx, {
      stems: [9, 13], angle: 0.6, arch: { levels: 2, kids: [[0, 0], [4, 6]], angle: [0, 0.6], ratio: [0, 0.45], start: 0.35, up: 0.4, sag: 0.2, gnarl: 0.15, rRatio: 0.6, segs: 4 },
      bark: { base: '#5e5248', dark: '#3f362f', furrow: 0.2 },
      leaf: { shape: 'oval', len: 0.06, width: 0.6, per: 6, clusters: 4, droop: 0.1, colors: [] },
      pal: { summer: ['#5d6e32', '#6a7a3a', '#757f3e'], spring: ['#6a7e38', '#7a8a40'], winter: ['#5a6430', '#646e36'], autumn: ['#5d6a32', '#687238'] },
      extra: (pts) => {
        if (ctx.season === 'spring' && R() < 0.5) blossom(ctx, pts[pts.length - 1].clone().add(V(0, 0.02, 0)), V(0, 1, 0), 0.03, rgb('#f2c62a'), rgb('#c9922a'));
      },
    });
  },
};
S['arctic-willow'] = {
  label: 'Arctic willow', height: [0.08, 0.2, 0.5], spread: 1,
  build: (ctx) => {
    const R = ctx.R;
    shrub(ctx, {
      stems: [6, 9], angle: 1.35, prostrate: true, arch: { levels: 2, kids: [[0, 0], [4, 6]], angle: [0, 0.8], ratio: [0, 0.4], start: 0.2, up: 0.05, sag: 0.3, gnarl: 0.2, rRatio: 0.6, segs: 5 },
      bark: { base: '#6a4a3a', dark: '#4a3228', furrow: 0.1 },
      leaf: { shape: 'oval', len: 0.06, width: 0.75, per: 5, clusters: 3, droop: -0.1, colors: [] },
      pal: { summer: ['#4f7a3a', '#5a8a42'], spring: ['#6a9a48', '#7aa852'], autumn: ['#b88a3a', '#c9a24a', '#a8542a'] },
      extra: (pts) => {
        if ((ctx.season === 'spring' || ctx.season === 'summer') && R() < 0.35) {
          const at = pts[pts.length - 1];
          sweep(ctx.leaf, [at, at.clone().add(V(0, 0.08, 0))], (t) => 0.014 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1)), { sides: 5, color: (t) => mixc(rgb('#f2ece2'), rgb('#c8506a'), t) });
        }
      },
    });
  },
};

S.blueberry = {
  label: 'Blueberry bush', height: [0.3, 0.7, 1.8], seasonal: true,
  build: (ctx) => {
    const R = ctx.R, s = ctx.season;
    const berry = rgb('#3a4a8a'), bloom = rgb('#7a8ac0');
    shrub(ctx, {
      stems: [7, 10], angle: 0.5, arch: { levels: 2, kids: [[0, 0], [4, 6]], angle: [0, 0.7], ratio: [0, 0.5], start: 0.3, up: 0.35, sag: 0.3, gnarl: 0.2, rRatio: 0.6, segs: 4 },
      bark: { base: '#7a3a2a', dark: '#4a2a20', furrow: 0.1, twig: '#a84a2e' },
      leaf: { shape: 'ellipse', len: 0.06, width: 0.5, per: 6, clusters: 4, droop: 0.2, colors: [] },
      pal: { summer: ['#3f7a3a', '#4a8a40'], spring: ['#5a9a48', '#6aaa52'], autumn: ['#c23a2a', '#d0502e', '#a8302a'] },
      extra: (pts) => {
        if (s === 'spring' && R() < 0.5) { const at = pts[pts.length - 1]; for (let k = 0; k < 4; k++) blob(ctx.leaf, at.clone().add(V((R() - 0.5) * 0.04, -0.02 - k * 0.012, (R() - 0.5) * 0.04)), 0.008, 0.012, 0.008, () => rgb('#f2ece6'), { w: 5, h: 4 }); }
        if (s === 'summer' && R() < 0.75) { const at = along(pts, 0.7 + R() * 0.3).p; for (let k = 0; k < 6; k++) blob(ctx.bark, at.clone().add(V((R() - 0.5) * 0.05, -0.015 - R() * 0.03, (R() - 0.5) * 0.05)), 0.011, 0.01, 0.011, (nn) => mixc(berry, bloom, nn.y * 0.5 + 0.3), { w: 6, h: 4 }); }
      },
    });
  },
};

/* ======================================================================== */
/*  special forms                                                           */
/* ======================================================================== */
S.saguaro = {
  label: 'Saguaro', height: [3, 9, 14], seasonal: true,
  build: (ctx) => {
    const { R, P } = ctx;
    const H = Number(P.height);
    const green = rgb('#4e7a52'), pale = rgb('#9fb08a'), spine = rgb('#8a7a62'), dark = rgb('#3a5a3e');
    const ribs = 18;
    const paint = (_t: number, a: number, p: THREE.Vector3): RGB => {
      const rib = Math.cos(a * ribs);
      let c = mixc(dark, green, rib * 0.5 + 0.5);
      if (rib > 0.9 && ((p.y * 22) % 1) < 0.28) c = mixc(pale, spine, 0.4); // areoles with spines along each rib
      return shade(c, lerp(0.85, 1, sstep(0, 1, p.y)));
    };
    const r0 = H * 0.036;
    const col: THREE.Vector3[] = [];
    for (let i = 0; i <= 14; i++) col.push(V(Math.sin(i * 0.5) * 0.03, (i / 14) * H, 0));
    const ribR = (_t: number, a: number) => 1 + 0.085 * Math.cos(a * ribs);
    sweep(ctx.bark, col, (t) => r0 * (0.86 + 0.14 * sstep(0, 0.12, t)) * (t > 0.93 ? Math.sqrt(Math.max(0.05, 1 - (t - 0.93) / 0.07)) : 1), { sides: ribs * 2, color: paint, radial: ribR, capStart: true });
    const tops: THREE.Vector3[] = [col[col.length - 1]];
    const arms = H > 4.5 ? pick(R, [2, 4]) : 0;
    for (let i = 0; i < arms; i++) {
      const y = H * rnd(R, 0.35, 0.6), az = (i / arms) * TAU + R() * 0.8;
      const out = V(Math.cos(az), 0, Math.sin(az));
      const st = V(0, y, 0).addScaledVector(out, r0 * 0.6);
      const elbow = st.clone().addScaledVector(out, r0 * 2.2).add(V(0, r0 * 0.6, 0));
      const up = elbow.clone().add(V(0, r0 * 1.6, 0)).addScaledVector(out, r0 * 0.4);
      const tip = V(up.x, Math.min(H * 0.92, y + H * rnd(R, 0.25, 0.4)), up.z);
      const pts = spline([st, elbow, up, tip], 12);
      sweep(ctx.bark, pts, (t) => r0 * 0.72 * (t > 0.9 ? Math.sqrt(Math.max(0.05, 1 - (t - 0.9) / 0.1)) : 1), { sides: ribs * 2, color: paint, radial: ribR });
      tops.push(pts[pts.length - 1]);
    }
    // white flowers in spring, red fruit splitting open in summer
    if (ctx.season === 'spring' || ctx.season === 'summer') for (const tp of tops) for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + R();
      const at = tp.clone().add(V(Math.cos(a) * r0 * 0.5, -0.02, Math.sin(a) * r0 * 0.5));
      if (ctx.season === 'spring') blossom(ctx, at, V(Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4), 0.07, rgb('#f6f1e2'), rgb('#e8c84a'));
      else blob(ctx.bark, at, 0.03, 0.05, 0.03, () => rgb('#c2263a'), { w: 6, h: 4 });
    }
  },
};
S['joshua-tree'] = {
  label: 'Joshua tree', height: [2, 6, 12], seasonal: true,
  build: (ctx) => {
    const { R, P } = ctx;
    const H = Number(P.height);
    const thatch = rgb('#7a6448'), thatch2 = rgb('#a08458'), blade = rgb('#7f9a66'), blade2 = rgb('#93ad78');
    const paint = (_t: number, a: number, p: THREE.Vector3): RGB => mixc(thatch, thatch2, noise3(Math.cos(a) * 3, p.y * 9, Math.sin(a) * 3, ctx.seed) * 0.9);
    const rosette = (at: THREE.Vector3, d: THREE.Vector3) => {
      const n = Math.round(lerp(34, 64, ctx.q));
      for (let i = 0; i < n; i++) {
        const nd = wobble(d, 1.6, R);
        if (nd.y < -0.35) continue;
        leaf(ctx.leaf, at, nd, sideOf(nd), rnd(R, 0.34, 0.46), 0.16, { shape: LEAF.needle, segs: 2, color: jitter(R() < 0.5 ? blade : blade2, R, 0.08), curl: -0.05, fold: 0.3, flat: ctx.q < 0.6, bias: nd });
      }
      // dead leaves hang down as a skirt below the living rosette
      for (let i = 0; i < Math.round(10 * ctx.q); i++) {
        const a = R() * TAU;
        const nd = V(Math.cos(a) * 0.5, -1, Math.sin(a) * 0.5).normalize();
        leaf(ctx.leaf, at.clone().add(V(0, -0.08, 0)), nd, sideOf(nd), rnd(R, 0.18, 0.28), 0.14, { shape: LEAF.needle, segs: 1, color: jitter(thatch2, R, 0.1), flat: true });
      }
      if (ctx.season === 'spring' && R() < 0.6) blob(ctx.leaf, at.clone().addScaledVector(d, 0.3), 0.09, 0.16, 0.09, (nn) => mixc(rgb('#efe6c8'), rgb('#cfc49a'), nn.y * 0.5 + 0.5), { w: 8, h: 6, bump: (nn) => 0.12 * Math.sin(nn.x * 18) * Math.sin(nn.z * 18) });
    };
    const branch = (p0: THREE.Vector3, d: THREE.Vector3, len: number, r: number, depth: number) => {
      const pts = bentPath(p0, d, len, 5, { pull: V(0, 0.25, 0), pullAmt: 1, gnarl: 0.1, R });
      sweep(ctx.bark, pts, (t) => r * lerp(1, 0.75, t), { sides: 7, color: paint, radial: (t, a) => 1 + 0.12 * noise3(Math.cos(a) * 4, t * 20, Math.sin(a) * 4, ctx.seed) });
      const end = pts[pts.length - 1], ed = along(pts, 1).d;
      if (depth <= 0) { rosette(end, ed); return; }
      const k = pick(R, [2, 3]);
      for (let i = 0; i < k; i++) {
        const az = (i / k) * TAU + R();
        const nd = ed.clone().add(V(Math.cos(az) * 0.9, 0.25, Math.sin(az) * 0.9)).normalize();
        branch(end, nd, len * rnd(R, 0.7, 0.95), r * 0.8, depth - 1);
      }
    };
    branch(V(), V(0, 1, 0), H * 0.38, H * 0.04, H > 4 ? 2 : 1);
  },
};
S.banana = {
  label: 'Banana plant', height: [2, 4, 7],
  build: (ctx) => {
    const { R, P } = ctx;
    const H = Number(P.height), sp = Number(P.spread);
    const stem = rgb('#7a8a4a'), brown = rgb('#7a5a3a'), lg = rgb('#4f8f3a'), lg2 = rgb('#5fa042'), rib = rgb('#a8c070');
    const sH = H * 0.55;
    sweep(ctx.bark, [V(), V(0.02, sH * 0.5, 0), V(0.03, sH, 0)], (t) => H * 0.05 * lerp(1.2, 0.75, t), { sides: 9, capStart: true, color: (_t, a, p) => mixc(stem, brown, noise3(Math.cos(a) * 2, p.y * 3, Math.sin(a) * 2, ctx.seed) > 0.62 ? 0.7 : 0.1) });
    const top = V(0.03, sH, 0);
    const n = pick(R, [7, 9]);
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996;
      const el = lerp(1.3, 0.15, i / n);
      const d = V(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
      const L = H * 0.62 * sp * rnd(R, 0.85, 1.05);
      const petiole = bentPath(top, d, L * 0.18, 2, {});
      sweep(ctx.bark, petiole, () => 0.025, { sides: 4, color: () => rib, smooth: false });
      const st = petiole[petiole.length - 1];
      const ld = along(petiole, 1).d;
      const side = V().crossVectors(ld, V(0, 1, 0)).normalize();
      // the blade: long, blunt, often torn into strips along the side veins
      leaf(ctx.leaf, st, ld, side, L * 0.82, 0.38, { shape: (t) => Math.min(1, t * 7) * (1 - Math.pow(t, 9)) * (1 + 0.15 * Math.sin(t * 40) * (i % 2)), segs: ctx.q < 0.6 ? 6 : 9, color: jitter(i < 2 ? lg2 : lg, R, 0.06), tip: shade(lg, i > n - 3 ? 0.7 : 1.05), curl: 0.9 + i * 0.12, fold: 0.18, bias: V(0, 1, 0), biasAmt: 0.45 });
    }
    // flower stalk with a hand of green bananas and the purple bud
    const s0 = top.clone().add(V(0, 0.1, 0));
    const stalk = spline([s0, s0.clone().add(V(0.35, 0.2, 0)), s0.clone().add(V(0.6, -0.4, 0)), s0.clone().add(V(0.62, -0.95, 0))], 10);
    sweep(ctx.bark, stalk, () => 0.03, { sides: 5, color: () => rgb('#6a7a3a') });
    for (let h = 0; h < 4; h++) {
      const at = along(stalk, 0.45 + h * 0.1).p;
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI - Math.PI / 2;
        const b0 = at.clone().add(V(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05));
        sweep(ctx.bark, spline([b0, b0.clone().add(V(Math.cos(a) * 0.08, 0.06, Math.sin(a) * 0.08)), b0.clone().add(V(Math.cos(a) * 0.1, 0.17, Math.sin(a) * 0.1))], 5), (t) => 0.022 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1)), { sides: 5, color: () => rgb('#8ab03a') });
      }
    }
    blob(ctx.bark, stalk[stalk.length - 1].clone().add(V(0, -0.12, 0)), 0.09, 0.18, 0.09, (nn) => mixc(rgb('#7a2a4a'), rgb('#4a1a30'), nn.x * 0.5 + 0.5), { w: 8, h: 6 });
  },
};
S['tree-fern'] = {
  label: 'Tree fern', height: [1.5, 4, 8],
  build: (ctx) => {
    const { R, P } = ctx;
    const H = Number(P.height), sp = Number(P.spread);
    const fib = rgb('#4a3426'), fib2 = rgb('#6a4a32');
    const trunk = trunkPath(ctx, H * 0.78, 0.04 + Number(P.lean), 8, 0.02);
    sweep(ctx.bark, trunk, (t) => H * 0.045 * lerp(1.2, 0.85, t), { sides: 9, capStart: true, color: (_t, a, p) => mixc(fib, fib2, noise3(Math.cos(a) * 5, p.y * 12, Math.sin(a) * 5, ctx.seed)), radial: (t, a) => 1 + 0.1 * noise3(Math.cos(a) * 6, t * 30, Math.sin(a) * 6, ctx.seed + 1) });
    const top = trunk[trunk.length - 1];
    const fg = rgb('#3f7a32'), fg2 = rgb('#4f8a3a'), rachis = rgb('#5a4a30');
    const n = Math.round(lerp(9, 14, ctx.q));
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996 + R() * 0.2;
      const el = rnd(R, 0.35, 0.9);
      const d = V(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
      const L = H * 0.55 * sp * rnd(R, 0.85, 1.1);
      const pts = bentPath(top, d, L, 8, { pull: V(0, -1.4, 0), pullAmt: 1 });
      sweep(ctx.bark, pts, (t) => 0.025 * (1 - t * 0.8), { sides: 4, color: () => rachis, smooth: false });
      const np = Math.round(lerp(10, 18, ctx.q));
      for (let j = 0; j < np; j++) {
        const t = lerp(0.12, 0.98, j / (np - 1));
        const at = along(pts, t);
        const side = V().crossVectors(at.d, V(0, 1, 0)).normalize();
        for (const sg of [-1, 1]) {
          const pd = at.d.clone().multiplyScalar(0.4).addScaledVector(side, sg).normalize();
          const len = L * 0.26 * Math.sin(Math.PI * (0.1 + 0.88 * t));
          leaf(ctx.leaf, at.p, pd, at.d, len, 0.28, { shape: (u) => (Math.round(u * 8) % 2 ? 1 : 0.35) * (1 - u * 0.7), segs: ctx.q < 0.6 ? 5 : 8, color: jitter(R() < 0.5 ? fg : fg2, R, 0.08), curl: 0.3, fold: 0.1, bias: V(0, 1, 0), biasAmt: 0.5 });
        }
      }
    }
    // fiddleheads: young fronds still coiled at the crown
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + R();
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 12; k++) { const u = k / 12, r = 0.12 * (1 - u * 0.8), th = u * 4; pts.push(top.clone().add(V(Math.cos(a) * (0.1 + Math.sin(th) * r), 0.15 + (1 - Math.cos(th)) * r * 0.8 + u * 0.15, Math.sin(a) * (0.1 + Math.sin(th) * r)))); }
      sweep(ctx.leaf, pts, (t) => 0.02 * (1 - t * 0.5), { sides: 5, color: () => rgb('#8a9a4a') });
    }
  },
};
S.bamboo = {
  label: 'Bamboo grove', height: [3, 8, 14],
  build: (ctx) => {
    const { R, P } = ctx;
    const H = Number(P.height), sp = Number(P.spread);
    const culm = rgb('#6f9a42'), culm2 = rgb('#8aaa4e'), node = rgb('#c9c08a');
    const lv = [rgb('#4f8a34'), rgb('#5c9a3c'), rgb('#6aa846')];
    const n = Math.round(lerp(16, 28, ctx.q) * sp);
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * 0.9 * sp;
      const b = V(Math.cos(a) * d, 0, Math.sin(a) * d);
      const h = H * rnd(R, 0.65, 1.05), r = rnd(R, 0.045, 0.075);
      const lean = V(Math.cos(a) * 0.12, 1, Math.sin(a) * 0.12).normalize();
      const pts = bentPath(b, lean, h, 10, { pull: V(Math.cos(a) * 0.4, -0.35, Math.sin(a) * 0.4), pullAmt: 1 });
      const nodeGap = 0.32;
      sweep(ctx.bark, pts, (t) => r * lerp(1, 0.55, t), { sides: 6, capStart: true, color: (t, _a, p) => ((p.y / nodeGap) % 1) < 0.06 ? node : mixc(culm, culm2, t) });
      // leafy branchlets from the upper nodes
      const k = Math.round(lerp(8, 16, ctx.q));
      for (let j = 0; j < k; j++) {
        const at = along(pts, rnd(R, 0.45, 1));
        const sd = wobble(V(Math.cos(a + (R() - 0.5) * 2), 0.3, Math.sin(a + (R() - 0.5) * 2)).normalize(), 0.4, R);
        const end = at.p.clone().addScaledVector(sd, rnd(R, 0.2, 0.45));
        sweep(ctx.bark, [at.p, end], () => 0.008, { sides: 3, color: () => culm2, smooth: false });
        for (let m = 0; m < 7; m++) {
          const ld = wobble(V(sd.x, -0.4, sd.z).normalize(), 0.9, R);
          leaf(ctx.leaf, end, ld, sideOf(ld), rnd(R, 0.24, 0.34), 0.2, { shape: LEAF.lance, segs: 2, color: jitter(lv[Math.floor(R() * 3)], R, 0.08), curl: 0.3, fold: 0.2, bias: V(0, 1, 0), biasAmt: 0.5, flat: ctx.q < 0.6 });
        }
      }
    }
  },
};

/* ======================================================================== */
/*  groves (several trees of one kind)                                      */
/* ======================================================================== */
export function createGrove(p: Record<string, unknown> = {}) {
  const kinds = String(p.kinds ?? 'paper-birch').split(',');
  const count = Number(p.count ?? 6), radius = Number(p.radius ?? 4);
  const R = (() => { let s = Number(p.seed ?? 3) * 977; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  const g = new THREE.Group();
  g.name = 'grove';
  const placed: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    let x = 0, z = 0;
    for (let k = 0; k < 30; k++) {
      const a = R() * TAU, d = i === 0 ? 0 : Math.sqrt(R()) * radius;
      x = Math.cos(a) * d; z = Math.sin(a) * d;
      if (placed.every(([px, pz]) => Math.hypot(px - x, pz - z) > radius * 0.45)) break;
    }
    placed.push([x, z]);
    const kind = kinds[i % kinds.length];
    const sp = S[kind] ?? S['paper-birch'];
    const h = Number(p.height ?? sp.height[1]) * (0.7 + R() * 0.45);
    // grove members are built one detail tier lower: several trees share one asset's budget
    const detail = p.detail === 'high' ? 'medium' : 'low';
    const t = createAsset({ ...p, kinds: undefined, detail, species: kind, height: h, seed: Number(p.seed ?? 3) + i * 13 });
    t.position.set(x, 0, z);
    t.rotation.y = R() * TAU;
    g.add(t);
  }
  return g;
}

// keep tree-shaking honest about helpers only some species use
void [clamp, rgb, mixc];
