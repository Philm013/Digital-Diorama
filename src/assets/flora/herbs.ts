/**
 * WILDFLOWERS, GRASSES, FERNS, LICHENS & WATER PLANTS — Digital Diorama flora library (CC0).
 *
 * Patches and clumps of herbaceous plants at diorama scale: composite flowers
 * (sunflower, daisy, coneflower, dandelion), cups (poppy), spikes (lupine,
 * foxglove, heather), umbels (milkweed), plumes (goldenrod), nodding bells
 * (bluebells), grasses with seed heads, bracken, lichen and moss mats, cushion
 * plants, prickly pear, papyrus, lotus, seagrass and giant kelp.
 *
 * createAsset({ species, height, spread, density, bloom, season, detail, seed })
 */
import * as THREE from 'three';
import type { ParamSpec } from '../modules';
import { blob, bentPath, wobble, spline, fbm3, noise3, type RGB } from '../proc/kit';
import { type Ctx, type Season, makeCtx, finish, defaults, pick, rnd, blossom, bromeliad, V, TAU, clamp, lerp, sstep, rgb, mixc, shade, jitter, sweep, leaf, LEAF, along, sideOf } from './common';

interface Herb { label: string; height: [number, number, number]; bloom?: string; build: (ctx: Ctx) => void }
const S: Record<string, Herb> = {};

export const params: Record<string, ParamSpec> = {
  species: { type: 'choice', default: 'oxeye-daisy', options: [], label: 'Species' },
  height: { type: 'range', default: 0.5, min: 0.02, max: 12, step: 0.01, unit: 'm', label: 'Height' },
  spread: { type: 'range', default: 1, min: 0.4, max: 2.5, step: 0.01, label: 'Patch size' },
  density: { type: 'range', default: 1, min: 0.3, max: 2, step: 0.01, label: 'Plants' },
  bloom: { type: 'color', default: '#f4f1e6', label: 'Flower colour' },
  season: { type: 'choice', default: 'summer', options: ['spring', 'summer', 'autumn', 'winter'], label: 'Season', describe: 'Set automatically from the diorama’s season.' },
  detail: { type: 'choice', default: 'medium', options: ['low', 'medium', 'high'], label: 'Detail' },
  seed: { type: 'range', default: 5, min: 1, max: 999, step: 1, label: 'Variation' },
};
export function getSchema(cfg: { species?: string } = {}) {
  const sp = S[String(cfg.species)] ?? S['oxeye-daisy'];
  const out: Record<string, ParamSpec> = { ...params, species: { ...params.species, options: Object.keys(S) }, height: { ...params.height, default: sp.height[1], min: sp.height[0], max: sp.height[2] } };
  if (sp.bloom) out.bloom = { ...params.bloom, default: sp.bloom };
  else delete out.bloom;
  return out;
}
export function createAsset(p: Record<string, unknown> = {}) {
  const sp = S[String(p.species)] ?? S['oxeye-daisy'];
  const P = defaults(params, { height: sp.height[1], bloom: sp.bloom ?? '#ffffff', ...p });
  if (!/^#?[0-9a-f]{6}$/i.test(String(P.bloom))) P.bloom = sp.bloom ?? '#ffffff';
  const ctx = makeCtx(P);
  sp.build(ctx);
  const g = finish(ctx, `herb-${P.species}`, { leafRough: 0.7 });
  g.userData.species = P.species;
  return g;
}

/* ---------------- helpers ---------------- */
const H_ = (ctx: Ctx) => Number(ctx.P.height);
const SP = (ctx: Ctx) => Number(ctx.P.spread);
const count = (ctx: Ctx, n: number) => Math.max(1, Math.round(n * Number(ctx.P.density) * lerp(0.55, 1, ctx.q)));
/** random spots in a disc, kept apart */
function spots(ctx: Ctx, n: number, r: number) {
  const R = ctx.R, out: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    let p = V();
    for (let k = 0; k < 12; k++) {
      const a = R() * TAU, d = i === 0 ? 0 : Math.sqrt(R()) * r;
      p = V(Math.cos(a) * d, 0, Math.sin(a) * d);
      if (out.every((q) => q.distanceTo(p) > r * 0.12)) break;
    }
    out.push(p);
  }
  return out;
}
/** a herbaceous stem: returns its points */
function stem(ctx: Ctx, base: THREE.Vector3, len: number, r: number, color: RGB, o: { lean?: number; nod?: number; dir?: THREE.Vector3 } = {}) {
  const R = ctx.R;
  const d = o.dir ?? wobble(V(0, 1, 0), o.lean ?? 0.15, R);
  const pts = bentPath(base, d, len, 6, { pull: V(0, -(o.nod ?? 0), 0), pullAmt: 1, gnarl: 0.04, R });
  sweep(ctx.bark, pts, (t) => r * (1 - t * 0.35), { sides: ctx.q < 0.6 ? 3 : 4, color: () => color, capEnd: true });
  return pts;
}
/** blades of grass / strap leaves from one point */
function blades(ctx: Ctx, base: THREE.Vector3, n: number, len: number, width: number, cols: RGB[], o: { spread?: number; curl?: number; tip?: RGB; shape?: (t: number) => number; up?: number } = {}) {
  const R = ctx.R;
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, el = Math.PI / 2 - (o.spread ?? 0.5) * Math.sqrt(R());
    const d = V(Math.cos(a) * Math.cos(el), Math.sin(el) * (o.up ?? 1), Math.sin(a) * Math.cos(el)).normalize();
    const col = jitter(cols[Math.floor(R() * cols.length)], R, 0.1);
    leaf(ctx.leaf, base.clone().add(V((R() - 0.5) * 0.02, 0, (R() - 0.5) * 0.02)), d, V(-Math.sin(a), 0, Math.cos(a)), len * (0.6 + R() * 0.5), width, { shape: o.shape ?? LEAF.strap, segs: ctx.q < 0.6 ? 2 : 3, color: col, tip: o.tip, curl: (o.curl ?? 0.8) * (0.6 + R() * 0.8), fold: 0.25, bias: V(0, 1, 0), biasAmt: 0.45, flat: ctx.q < 0.6 });
  }
}
/** leaves along a stem (alternate) */
function stemLeaves(ctx: Ctx, pts: THREE.Vector3[], n: number, len: number, width: number, cols: RGB[], o: { from?: number; to?: number; shape?: keyof typeof LEAF | ((t: number) => number); droop?: number; opposite?: boolean } = {}) {
  const R = ctx.R;
  const shape = typeof o.shape === 'function' ? o.shape : LEAF[o.shape ?? 'lance'];
  for (let i = 0; i < n; i++) {
    const t = lerp(o.from ?? 0.1, o.to ?? 0.75, n === 1 ? 0.5 : i / (n - 1));
    const at = along(pts, t);
    for (const sg of o.opposite ? [0, Math.PI] : [0]) {
      const az = i * (o.opposite ? 1.5708 : 2.39996) + sg + R() * 0.3;
      const out = sideOf(at.d).applyAxisAngle(at.d, az);
      const d = out.clone().multiplyScalar(0.85).addScaledVector(at.d, 0.5).normalize();
      const L = len * (1 - t * 0.4);
      leaf(ctx.leaf, at.p, d, V().crossVectors(d, V(0, 1, 0)).normalize(), L, L * width, { shape, segs: ctx.q < 0.6 ? 2 : 3, color: jitter(cols[Math.floor(R() * cols.length)], R, 0.08), curl: o.droop ?? 0.5, fold: 0.25, bias: V(0, 1, 0), biasAmt: 0.5, flat: ctx.q < 0.6 });
    }
  }
}
/** a composite flower head: disc + ring of rays */
function composite(ctx: Ctx, at: THREE.Vector3, face: THREE.Vector3, o: { rays: number; rayLen: number; rayW: number; ray: RGB; disc: RGB; discR: number; droop?: number; cone?: number; rings?: number }) {
  const R = ctx.R;
  const n = face.clone().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n);
  blob(ctx.bark, at.clone().addScaledVector(n, o.discR * (o.cone ? 0.35 : 0.1)), o.discR, o.discR * (o.cone ?? 0.32), o.discR, (nn) => mixc(o.disc, shade(o.disc, 0.6), sstep(0.2, 1, nn.y) * 0.5 + (noise3(nn.x * 9, nn.y * 9, nn.z * 9, 3) > 0.6 ? 0.25 : 0)), { w: 9, h: 5, rot: q, bump: o.cone ? (nn) => 0.08 * Math.max(0, Math.sin(nn.x * 30) * Math.sin(nn.z * 30)) : undefined });
  const e1 = sideOf(n), e2 = V().crossVectors(n, e1);
  const rings = o.rings ?? 1;
  for (let r = 0; r < rings; r++) for (let i = 0; i < o.rays; i++) {
    const a = (i / o.rays) * TAU + r * (Math.PI / o.rays) + (R() - 0.5) * 0.1;
    const out = e1.clone().multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a));
    const d = out.clone().addScaledVector(n, -(o.droop ?? 0.05) + r * 0.25).normalize();
    leaf(ctx.leaf, at.clone().addScaledVector(out, o.discR * 0.75), d, V().crossVectors(out, n), o.rayLen * (1 - r * 0.15) * (0.9 + R() * 0.2), o.rayW, { shape: LEAF.ellipse, segs: 2, color: jitter(o.ray, R, 0.05), curl: (o.droop ?? 0.05) * 2, fold: 0.15, bias: n, biasAmt: 0.6, flat: true });
  }
}
const GREEN = ['#3f7a34', '#4a8a3a', '#56963f'].map(rgb);
const DRY = ['#a08a5a', '#8a7448', '#b09a64'].map(rgb);
function greens(ctx: Ctx, list0: (RGB | string)[] = GREEN, autumn?: string[], winter?: string[]): RGB[] {
  const list = list0.map((c) => (typeof c === 'string' ? rgb(c) : c));
  if (ctx.season === 'autumn' && autumn) return autumn.map(rgb);
  if (ctx.season === 'winter') return (winter ?? ['#8a7a58', '#7a6a4a']).map(rgb);
  if (ctx.season === 'spring') return list.map((c) => mixc(c, rgb('#9ccf5a'), 0.25));
  return list;
}
const blooming = (ctx: Ctx, ...when: Season[]) => when.includes(ctx.season);

/* =============================== wildflowers =============================== */
S.sunflower = {
  label: 'Sunflower', height: [0.8, 1.7, 3], bloom: '#f2b81c',
  build: (ctx) => {
    const H = H_(ctx), R = ctx.R, ray = rgb(String(ctx.P.bloom));
    const dead = ctx.season === 'winter' || ctx.season === 'spring';
    const n = Math.max(1, Math.round(3 * Number(ctx.P.density) * SP(ctx)));
    for (const b of spots(ctx, n, 0.35 * SP(ctx))) {
      const h = H * rnd(R, 0.8, 1.1);
      const pts = stem(ctx, b, h, 0.018, dead ? rgb('#6a5a3a') : rgb('#5a7a34'), { lean: 0.05, nod: 0.2 });
      if (!dead) stemLeaves(ctx, pts, Math.round(lerp(6, 10, ctx.q)), 0.26, 0.85, greens(ctx), { shape: 'heart', from: 0.08, to: 0.85, droop: 0.7 });
      const top = pts[pts.length - 1];
      // mature heads face east-ish (+Z, the viewer) and nod a little
      const face = V((R() - 0.5) * 0.3, dead ? -0.8 : 0.25, 1).normalize();
      composite(ctx, top.clone().addScaledVector(face, 0.03), face, dead
        ? { rays: 0, rayLen: 0, rayW: 0, ray, disc: rgb('#4a3a28'), discR: 0.13, cone: 0.3 }
        : { rays: Math.round(lerp(16, 26, ctx.q)), rayLen: 0.11, rayW: 0.035, ray, disc: rgb('#4a2e18'), discR: 0.12, rings: 2, cone: 0.25 });
    }
  },
};
S['oxeye-daisy'] = {
  label: 'Oxeye daisies', height: [0.2, 0.55, 1], bloom: '#f6f4ec',
  build: (ctx) => {
    const H = H_(ctx), R = ctx.R, ray = rgb(String(ctx.P.bloom));
    for (const b of spots(ctx, count(ctx, 9), 0.45 * SP(ctx))) {
      blades(ctx, b, 4, 0.12, 0.04, greens(ctx), { spread: 1.2, curl: 0.6, shape: (t) => Math.sin(Math.PI * Math.pow(t, 0.6)) });
      const k = pick(R, [1, 3]);
      for (let j = 0; j < k; j++) {
        const pts = stem(ctx, b, H * rnd(R, 0.7, 1.05), 0.005, rgb('#4f7a34'), { lean: 0.25 });
        stemLeaves(ctx, pts, 3, 0.07, 0.3, greens(ctx), { from: 0.1, to: 0.5 });
        if (blooming(ctx, 'spring', 'summer')) composite(ctx, pts[pts.length - 1], V((R() - 0.5) * 0.6, 1, (R() - 0.5) * 0.6 + 0.3), { rays: Math.round(lerp(12, 20, ctx.q)), rayLen: 0.04, rayW: 0.012, ray, disc: rgb('#f2c21e'), discR: 0.013, cone: 0.4 });
      }
    }
  },
};
S.poppy = {
  label: 'Red poppies', height: [0.2, 0.55, 0.9], bloom: '#d8241c',
  build: (ctx) => {
    const H = H_(ctx), R = ctx.R, red = rgb(String(ctx.P.bloom));
    for (const b of spots(ctx, count(ctx, 10), 0.45 * SP(ctx))) {
      blades(ctx, b, 4, 0.13, 0.05, greens(ctx), { spread: 1.1, curl: 0.5, shape: (t) => (Math.round(t * 8) % 2 ? 1 : 0.5) * Math.sin(Math.PI * t) });
      const pts = stem(ctx, b, H * rnd(R, 0.7, 1.05), 0.004, rgb('#5f8a3a'), { lean: 0.3 });
      const top = pts[pts.length - 1];
      if (!blooming(ctx, 'spring', 'summer')) { if (ctx.season === 'autumn') blob(ctx.bark, top, 0.012, 0.016, 0.012, () => rgb('#8a7a4a')); continue; }
      if (R() < 0.18) { blob(ctx.bark, top.clone().add(V(0.01, -0.02, 0)), 0.01, 0.016, 0.01, () => rgb('#6a8a3a')); continue; } // a nodding bud
      const f = V((R() - 0.5) * 0.5, 1, (R() - 0.5) * 0.5).normalize();
      const e1 = sideOf(f), e2 = V().crossVectors(f, e1);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + R() * 0.2;
        const out = e1.clone().multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a));
        const d = out.clone().addScaledVector(f, 0.9).normalize();
        leaf(ctx.leaf, top, d, V().crossVectors(out, f), 0.045, 0.055, { shape: (t) => Math.sin(Math.PI * Math.pow(t, 0.7)) * 1.1, segs: 3, color: jitter(red, R, 0.05), tip: shade(red, 1.1), curl: -0.35, fold: 0.1, bias: out, biasAmt: 0.4 });
      }
      blob(ctx.bark, top.clone().addScaledVector(f, 0.012), 0.008, 0.01, 0.008, () => rgb('#1a1a1c'));
    }
  },
};
S.lupine = {
  label: 'Lupines', height: [0.4, 0.95, 1.5], bloom: '#6a4ac0',
  build: (ctx) => {
    const H = H_(ctx), R = ctx.R;
    const base = rgb(String(ctx.P.bloom));
    const palette = [base, rgb('#4a6ad0'), rgb('#d06aa8'), rgb('#f2eef2')];
    for (const b of spots(ctx, count(ctx, 5), 0.4 * SP(ctx))) {
      // palmate leaves on long stalks
      for (let k = 0; k < Math.round(lerp(3, 6, ctx.q)); k++) {
        const pts = stem(ctx, b, H * rnd(R, 0.25, 0.4), 0.004, rgb('#4f7a34'), { lean: 0.6 });
        const top = pts[pts.length - 1];
        for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; const d = V(Math.cos(a), 0.15, Math.sin(a)).normalize(); leaf(ctx.leaf, top, d, V(-Math.sin(a), 0, Math.cos(a)), 0.09, 0.022, { shape: LEAF.lance, segs: 2, color: jitter(greens(ctx)[0], R, 0.08), curl: 0.3, flat: true, bias: V(0, 1, 0) }); }
      }
      if (!blooming(ctx, 'spring', 'summer')) continue;
      const col = R() < 0.55 ? base : palette[Math.floor(R() * palette.length)];
      const pts = stem(ctx, b, H * rnd(R, 0.8, 1.1), 0.008, rgb('#4a7034'), { lean: 0.1 });
      const nf = Math.round(lerp(18, 34, ctx.q));
      for (let i = 0; i < nf; i++) {
        const t = lerp(0.45, 0.98, i / nf), at = along(pts, t);
        const a = i * 2.4, out = V(Math.cos(a), 0, Math.sin(a));
        const s = 0.016 * (1 - t * 0.5);
        const fc = mixc(col, rgb('#f6f0f8'), t > 0.9 ? 0.4 : 0);
        blob(ctx.leaf, at.p.clone().addScaledVector(out, s * 1.2), s, s * 0.8, s, () => jitter(fc, R, 0.06), { w: 5, h: 3 });
      }
    }
  },
};
S.foxglove = {
  label: 'Foxgloves', height: [0.6, 1.3, 2], bloom: '#c45a9e',
  build: (ctx) => {
    const H = H_(ctx), R = ctx.R, bloom = rgb(String(ctx.P.bloom));
    for (const b of spots(ctx, count(ctx, 3), 0.3 * SP(ctx))) {
      blades(ctx, b, Math.round(lerp(6, 10, ctx.q)), 0.32, 0.11, greens(ctx), { spread: 1.25, curl: 0.5, shape: LEAF.lance });
      if (!blooming(ctx, 'spring', 'summer')) continue;
      const pts = stem(ctx, b, H * rnd(R, 0.85, 1.1), 0.012, rgb('#4a6a34'), { lean: 0.08, nod: 0.08 });
      stemLeaves(ctx, pts, 4, 0.14, 0.3, greens(ctx), { from: 0.1, to: 0.4 });
      const nf = Math.round(lerp(12, 26, ctx.q));
      const face = R() * TAU;
      for (let i = 0; i < nf; i++) {
        const t = lerp(0.42, 0.97, i / nf), at = along(pts, t);
        const a = face + (R() - 0.5) * 1.6, out = V(Math.cos(a), -0.6, Math.sin(a)).normalize();
        const s = 0.045 * (1 - t * 0.45);
        // a drooping tubular bell, pale and spotted inside the mouth
        const tube = [at.p.clone(), at.p.clone().addScaledVector(out, s * 0.6), at.p.clone().addScaledVector(out, s * 1.3)];
        sweep(ctx.leaf, tube, (u) => s * (0.18 + u * 0.32), { sides: 6, color: (u, ang) => u > 0.85 && Math.sin(ang) < 0 ? rgb('#f6e8f0') : mixc(bloom, shade(bloom, 0.8), u), capEnd: false });
      }
    }
  },
};
S.coneflower = {
  label: 'Purple coneflowers', height: [0.4, 0.9, 1.4], bloom: '#c45a96',
  build: (ctx) => {
    const H = H_(ctx), R = ctx.R, ray = rgb(String(ctx.P.bloom));
    for (const b of spots(ctx, count(ctx, 6), 0.4 * SP(ctx))) {
      const pts = stem(ctx, b, H * rnd(R, 0.8, 1.1), 0.006, rgb('#4a6a34'), { lean: 0.15 });
      stemLeaves(ctx, pts, 4, 0.14, 0.32, greens(ctx), { from: 0.05, to: 0.55 });
      const winter = ctx.season === 'winter' || ctx.season === 'autumn';
      composite(ctx, pts[pts.length - 1], V((R() - 0.5) * 0.4, 1, (R() - 0.5) * 0.4), winter
        ? { rays: 0, rayLen: 0, rayW: 0, ray, disc: rgb('#3a2a1a'), discR: 0.03, cone: 0.9 }
        : { rays: Math.round(lerp(10, 15, ctx.q)), rayLen: 0.06, rayW: 0.016, ray, disc: rgb('#b8641e'), discR: 0.025, droop: 0.55, cone: 0.85 });
    }
  },
};
S.milkweed = {
  label: 'Common milkweed', height: [0.5, 1.1, 1.8], bloom: '#d98aa8',
  build: (ctx) => {
    const H = H_(ctx), R = ctx.R, pink = rgb(String(ctx.P.bloom));
    for (const b of spots(ctx, count(ctx, 4), 0.35 * SP(ctx))) {
      const pts = stem(ctx, b, H * rnd(R, 0.8, 1.1), 0.011, rgb('#5a7a44'), { lean: 0.08 });
      if (ctx.season !== 'winter') stemLeaves(ctx, pts, Math.round(lerp(4, 7, ctx.q)), 0.18, 0.48, greens(ctx, ['#4f7a4a', '#5a8650'], ['#b8a43a', '#a8943a']), { opposite: true, from: 0.15, to: 0.85, shape: 'oval', droop: 0.3 });
      const top = pts[pts.length - 1];
      if (blooming(ctx, 'summer')) {
        // umbels: domed balls of small pink flowers
        for (let u = 0; u < 3; u++) {
          const at = along(pts, 0.75 + u * 0.1).p.add(V((R() - 0.5) * 0.08, 0.02, (R() - 0.5) * 0.08));
          for (let k = 0; k < Math.round(lerp(10, 22, ctx.q)); k++) { const d = wobble(V(0, 1, 0), 1.3, R); blob(ctx.leaf, at.clone().addScaledVector(d, 0.04), 0.008, 0.008, 0.008, () => jitter(pink, R, 0.08), { w: 4, h: 3 }); }
        }
      } else if (ctx.season === 'autumn' || ctx.season === 'winter') {
        // warty pods splitting to release silky seeds
        for (let k = 0; k < 3; k++) {
          const at = along(pts, 0.6 + k * 0.12).p;
          const d = V((R() - 0.5), 0.8, (R() - 0.5)).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d);
          blob(ctx.bark, at.clone().addScaledVector(d, 0.05), 0.018, 0.05, 0.018, () => rgb(ctx.season === 'winter' ? '#8a7a5a' : '#6a7a3a'), { w: 6, h: 5, rot: q });
          if (ctx.season === 'winter') blob(ctx.leaf, at.clone().addScaledVector(d, 0.1), 0.03, 0.03, 0.03, () => rgb('#f4f2ec'), { w: 6, h: 4, bump: (n) => 0.3 * Math.max(0, Math.sin(n.x * 20) * Math.sin(n.y * 20)) });
        }
      }
      void top;
    }
  },
};
S.goldenrod = {
  label: 'Goldenrod', height: [0.5, 1.1, 1.8], bloom: '#e8b81c',
  build: (ctx) => {
    const H = H_(ctx), R = ctx.R, gold = rgb(String(ctx.P.bloom));
    const head = ctx.season === 'autumn' || ctx.season === 'summer' ? (ctx.season === 'summer' ? mixc(gold, rgb('#8aa040'), 0.45) : gold) : ctx.season === 'winter' ? rgb('#b0a088') : rgb('#7a9a40');
    for (const b of spots(ctx, count(ctx, 7), 0.4 * SP(ctx))) {
      const pts = stem(ctx, b, H * rnd(R, 0.8, 1.1), 0.006, rgb(ctx.season === 'winter' ? '#7a6a4a' : '#5a7a3a'), { lean: 0.15, nod: 0.15 });
      if (ctx.season !== 'winter') stemLeaves(ctx, pts, Math.round(lerp(6, 10, ctx.q)), 0.1, 0.2, greens(ctx), { from: 0.1, to: 0.7 });
      // arching plume: side branches with florets along their upper side
      for (let k = 0; k < Math.round(lerp(4, 7, ctx.q)); k++) {
        const at = along(pts, 0.68 + k * 0.045);
        const out = V(Math.cos(k * 2.4), 0.2, Math.sin(k * 2.4)).normalize();
        const br = bentPath(at.p, out.clone().add(V(0, 0.6, 0)).normalize(), 0.12, 4, { pull: V(0, -0.8, 0), pullAmt: 1 });
        sweep(ctx.bark, br, () => 0.002, { sides: 3, color: () => rgb('#6a7a3a'), smooth: false });
        for (let m = 0; m < 6; m++) blob(ctx.leaf, along(br, 0.2 + m * 0.14).p.add(V(0, 0.008, 0)), 0.009, 0.007, 0.009, () => jitter(head, R, 0.08), { w: 4, h: 3 });
      }
    }
  },
};
S.bluebells = {
  label: 'Bluebells', height: [0.15, 0.35, 0.5], bloom: '#4f5fd0',
  build: (ctx) => {
    const H = H_(ctx), R = ctx.R, blue = rgb(String(ctx.P.bloom));
    if (ctx.season === 'winter') return blades(ctx, V(), 1, 0.01, 0.01, DRY);
    for (const b of spots(ctx, count(ctx, 16), 0.55 * SP(ctx))) {
      blades(ctx, b, 4, 0.26, 0.022, greens(ctx), { spread: 0.9, curl: 1.0 });
      if (!blooming(ctx, 'spring')) continue;
      const pts = stem(ctx, b, H * rnd(R, 0.8, 1.1), 0.003, rgb('#4a7a3a'), { lean: 0.2, nod: 0.6 });
      const side = V(Math.cos(R() * TAU), 0, Math.sin(R() * TAU));
      for (let i = 0; i < Math.round(lerp(5, 9, ctx.q)); i++) {
        const at = along(pts, 0.45 + i * 0.065).p;
        const d = side.clone().add(V(0, -1.2, 0)).normalize();
        sweep(ctx.leaf, [at, at.clone().addScaledVector(d, 0.012), at.clone().addScaledVector(d, 0.022)], (u) => 0.0045 + u * 0.004, { sides: 6, color: () => jitter(blue, R, 0.06), capEnd: false });
      }
    }
  },
};
S.dandelion = {
  label: 'Dandelions', height: [0.06, 0.2, 0.4], bloom: '#f2c21c',
  build: (ctx) => {
    const H = H_(ctx), R = ctx.R, yellow = rgb(String(ctx.P.bloom));
    for (const b of spots(ctx, count(ctx, 6), 0.45 * SP(ctx))) {
      blades(ctx, b, Math.round(lerp(6, 9, ctx.q)), 0.15, 0.035, greens(ctx), { spread: 1.35, curl: 0.4, shape: (t) => (Math.round(t * 8) % 2 ? 1 : 0.4) * Math.sin(Math.PI * Math.pow(t, 0.7)) });
      if (ctx.season === 'winter') continue;
      for (let k = 0; k < pick(R, [1, 3]); k++) {
        const pts = stem(ctx, b, H * rnd(R, 0.7, 1.15), 0.003, rgb('#7a9a4a'), { lean: 0.3 });
        const top = pts[pts.length - 1];
        if (R() < (ctx.season === 'autumn' ? 0.6 : 0.3)) blob(ctx.leaf, top.clone().add(V(0, 0.02, 0)), 0.026, 0.026, 0.026, (n) => mixc(rgb('#f8f6f0'), rgb('#d8d4c8'), n.y < 0 ? 0.5 : 0), { w: 8, h: 6, bump: (n) => 0.18 * Math.max(0, Math.sin(n.x * 24) * Math.sin(n.y * 24) * Math.sin(n.z * 24)) });
        else composite(ctx, top, V((R() - 0.5) * 0.4, 1, (R() - 0.5) * 0.4), { rays: Math.round(lerp(14, 22, ctx.q)), rayLen: 0.018, rayW: 0.006, ray: yellow, disc: yellow, discR: 0.011, rings: 2, cone: 0.4 });
      }
    }
  },
};
S.clover = {
  label: 'White clover', height: [0.05, 0.12, 0.25], bloom: '#f4f0ea',
  build: (ctx) => {
    const H = H_(ctx), R = ctx.R, white = rgb(String(ctx.P.bloom));
    const lf = greens(ctx, ['#3f7a34', '#4a8a3a']);
    for (const b of spots(ctx, count(ctx, 40), 0.5 * SP(ctx))) {
      const pts = stem(ctx, b, H * rnd(R, 0.5, 0.9), 0.0025, rgb('#6a8a4a'), { lean: 0.5 });
      const top = pts[pts.length - 1];
      const a0 = R() * TAU;
      for (let i = 0; i < 3; i++) {
        const a = a0 + (i / 3) * TAU, d = V(Math.cos(a), 0.15, Math.sin(a)).normalize();
        leaf(ctx.leaf, top, d, V(-Math.sin(a), 0, Math.cos(a)), 0.045, 0.04, { shape: LEAF.heart, segs: 2, color: jitter(lf[i % lf.length], R, 0.06), edge: mixc(lf[0], rgb('#dfe8c8'), 0.4), curl: 0.1, bias: V(0, 1, 0), flat: true });
      }
    }
    if (blooming(ctx, 'spring', 'summer')) for (const b of spots(ctx, count(ctx, 9), 0.45 * SP(ctx))) {
      const pts = stem(ctx, b, H * rnd(R, 1.1, 1.5), 0.002, rgb('#7a9a5a'), { lean: 0.3 });
      blob(ctx.leaf, pts[pts.length - 1].clone().add(V(0, 0.008, 0)), 0.012, 0.011, 0.012, (n) => mixc(white, rgb('#e8b0c0'), n.y < -0.2 ? 0.5 : 0), { w: 6, h: 5, bump: (n) => 0.12 * Math.max(0, Math.sin(n.x * 22) * Math.sin(n.z * 22)) });
    }
  },
};
S.edelweiss = {
  label: 'Edelweiss', height: [0.06, 0.15, 0.25], bloom: '#f4f2ea',
  build: (ctx) => {
    const H = H_(ctx), R = ctx.R, white = rgb(String(ctx.P.bloom)), wool = rgb('#a8b0a0');
    for (const b of spots(ctx, count(ctx, 5), 0.25 * SP(ctx))) {
      blades(ctx, b, 7, 0.06, 0.012, [wool, shade(wool, 0.9)], { spread: 1.2, curl: 0.4, shape: LEAF.lance });
      if (!blooming(ctx, 'summer', 'spring')) continue;
      const pts = stem(ctx, b, H * rnd(R, 0.75, 1.1), 0.0025, wool, { lean: 0.2 });
      const top = pts[pts.length - 1];
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + R() * 0.2, d = V(Math.cos(a), 0.15, Math.sin(a)).normalize(); leaf(ctx.leaf, top, d, V(-Math.sin(a), 0, Math.cos(a)), 0.024, 0.009, { shape: LEAF.lance, segs: 2, color: jitter(white, R, 0.03), curl: 0.05, flat: true, bias: V(0, 1, 0) }); }
      for (let k = 0; k < 5; k++) blob(ctx.leaf, top.clone().add(V((R() - 0.5) * 0.008, 0.003, (R() - 0.5) * 0.008)), 0.0035, 0.003, 0.0035, () => rgb('#e8d890'), { w: 4, h: 3 });
    }
  },
};

/* =============================== grasses & sedges =============================== */
function tussock(ctx: Ctx, o: { blades: number; len: number; width: number; cols: RGB[]; tip?: RGB; heads: number; headLen: number; head: (ctx: Ctx, pts: THREE.Vector3[]) => void; stemCol: RGB; clumps?: number; spread?: number }) {
  const R = ctx.R, H = H_(ctx);
  for (const b of spots(ctx, Math.max(1, Math.round((o.clumps ?? 3) * Number(ctx.P.density) * SP(ctx))), (o.spread ?? 0.4) * SP(ctx))) {
    blades(ctx, b, Math.round(o.blades * lerp(0.5, 1, ctx.q)), o.len * H, o.width, o.cols, { spread: 0.75, curl: 1.1, tip: o.tip });
    for (let k = 0; k < Math.round(o.heads * lerp(0.6, 1, ctx.q)); k++) {
      const pts = stem(ctx, b.clone().add(V((R() - 0.5) * 0.06, 0, (R() - 0.5) * 0.06)), H * rnd(R, 0.85, 1.1), 0.0035, o.stemCol, { lean: 0.22, nod: 0.12 });
      o.head(ctx, pts);
    }
  }
}
S['prairie-grass'] = {
  label: 'Big bluestem grass', height: [0.8, 1.8, 2.6],
  build: (ctx) => {
    const R = ctx.R;
    const summer = ['#6a8a6a', '#7a9a72', '#5f8060'].map(rgb), autumn = ['#b0623a', '#c07a44', '#9a5232'].map(rgb), winter = ['#b8a07a', '#a8906a'].map(rgb);
    const cols = ctx.season === 'autumn' ? autumn : ctx.season === 'winter' ? winter : ctx.season === 'spring' ? ['#6f9a5a', '#7aa862'].map(rgb) : summer;
    tussock(ctx, {
      blades: 46, len: 0.55, width: 0.016, cols, heads: 8, headLen: 0.12, stemCol: mixc(cols[0], rgb('#8a5a6a'), 0.4), clumps: 3,
      head: (c, pts) => {
        // "turkey foot": three purple-bronze racemes spreading from the tip
        const top = pts[pts.length - 1];
        for (let i = 0; i < 3; i++) { const a = i * 2.1 + R(), d = V(Math.cos(a) * 0.45, 1, Math.sin(a) * 0.45).normalize(); leaf(c.leaf, top, d, sideOf(d), 0.08, 0.01, { shape: (t) => (Math.round(t * 8) % 2 ? 1 : 0.5) * (1 - t * 0.4), segs: 4, color: jitter(rgb('#7a4a5a'), R, 0.1), curl: 0.4, flat: true }); }
      },
    });
  },
};
S['red-oat-grass'] = {
  label: 'Red oat grass', height: [0.4, 0.9, 1.5],
  build: (ctx) => {
    const R = ctx.R;
    const wet = ['#8a9a4a', '#9aa652', '#7a8a40'].map(rgb), dry = ['#c9a45a', '#d6b46a', '#b8904a'].map(rgb);
    const cols = ctx.season === 'summer' || ctx.season === 'spring' ? wet : dry;
    tussock(ctx, {
      blades: 40, len: 0.6, width: 0.012, cols, tip: rgb('#c9a45a'), heads: 9, headLen: 0.08, stemCol: rgb('#a8803a'), clumps: 4,
      head: (c, pts) => {
        const top = pts[pts.length - 1];
        for (let i = 0; i < 4; i++) { const d = V((R() - 0.5) * 0.8, -0.6, (R() - 0.5) * 0.8).normalize(); leaf(c.leaf, top.clone().add(V(0, -i * 0.02, 0)), d, sideOf(d), 0.05, 0.012, { shape: LEAF.lance, segs: 2, color: jitter(rgb('#a8462a'), R, 0.12), curl: 0.2, flat: true }); }
      },
    });
  },
};
S['cotton-grass'] = {
  label: 'Cotton grass', height: [0.2, 0.4, 0.7],
  build: (ctx) => {
    const R = ctx.R;
    tussock(ctx, {
      blades: 30, len: 0.55, width: 0.008, cols: greens(ctx, ['#6a8a4a', '#7a9a52'], ['#b8783a', '#a86a32']), heads: 10, headLen: 0.05, stemCol: rgb('#6a7a44'), clumps: 4,
      head: (c, pts) => {
        if (c.season === 'winter') return;
        const top = pts[pts.length - 1];
        // the "cotton" is a tuft of silky seed hairs
        blob(c.leaf, top.clone().add(V(0, 0.022, 0)), 0.024, 0.03, 0.024, (n) => mixc(rgb('#fbfaf6'), rgb('#e6e2d6'), n.y < 0 ? 0.6 : 0), { w: 8, h: 6, bump: (n) => 0.25 * Math.max(0, noise3(n.x * 6, n.y * 6, n.z * 6, 2) - 0.4) });
        void R;
      },
    });
  },
};
S.papyrus = {
  label: 'Papyrus', height: [1, 2.6, 4],
  build: (ctx) => {
    const H = H_(ctx), R = ctx.R;
    const culm = rgb('#4f8a3a'), ray = rgb('#6aa040');
    for (const b of spots(ctx, count(ctx, 18), 0.5 * SP(ctx))) {
      const d = wobble(V(0, 1, 0), 0.25, R);
      const pts = bentPath(b, d, H * rnd(R, 0.75, 1.05), 7, { pull: V(d.x, -0.15, d.z), pullAmt: 1 });
      // papyrus stems are triangular in section
      sweep(ctx.bark, pts, (t) => 0.018 * (1 - t * 0.5), { sides: 3, color: (t) => mixc(rgb('#8a6a3a'), culm, sstep(0, 0.12, t)), capEnd: true, smooth: false });
      const top = pts[pts.length - 1];
      const n = Math.round(lerp(28, 70, ctx.q));
      for (let i = 0; i < n; i++) {
        const rd = wobble(V(0, 1, 0), 1.35, R);
        const len = rnd(R, 0.22, 0.38);
        leaf(ctx.leaf, top, rd, sideOf(rd), len, 0.012, { shape: (t) => (1 - t * 0.6) * Math.min(1, t * 9), segs: 3, color: jitter(ray, R, 0.1), curl: 1.4, flat: true, bias: rd, biasAmt: 0.3 });
      }
    }
  },
};
S['seagrass'] = {
  label: 'Seagrass meadow', height: [0.2, 0.55, 1],
  build: (ctx) => {
    const R = ctx.R, H = H_(ctx);
    const cols = ['#3f8a3a', '#4f9a40', '#5aa046', '#6a9a3a'].map(rgb);
    for (const b of spots(ctx, count(ctx, 26), 0.9 * SP(ctx))) blades(ctx, b, Math.round(lerp(3, 6, ctx.q)), H, 0.012, cols, { spread: 0.35, curl: 0.4, tip: rgb('#8a9a4a') });
    void R;
  },
};

/* =============================== ferns, mosses, lichens, cushions =============================== */
S.bracken = {
  label: 'Bracken fern', height: [0.4, 1, 1.8],
  build: (ctx) => {
    const H = H_(ctx), R = ctx.R;
    const col = ctx.season === 'autumn' ? ['#b8622a', '#c97a34', '#a85a2a'].map(rgb) : ctx.season === 'winter' ? ['#8a5a32', '#7a4a2a'].map(rgb) : ctx.season === 'spring' ? ['#7aa84a', '#8ab456'].map(rgb) : ['#3f7a32', '#4a8a3a', '#56963f'].map(rgb);
    for (const b of spots(ctx, count(ctx, 6), 0.5 * SP(ctx))) {
      const h = H * rnd(R, 0.7, 1.1);
      const stipe = stem(ctx, b, h * 0.55, 0.006, rgb('#6a5a34'), { lean: 0.15 });
      const top = stipe[stipe.length - 1];
      // the blade bends over into a near-horizontal triangle of pinnae
      const az = R() * TAU, dir = V(Math.cos(az), ctx.season === 'winter' ? -0.8 : 0.2, Math.sin(az)).normalize();
      const rach = bentPath(top, dir, h * 0.6, 6, { pull: V(0, -0.5, 0), pullAmt: 1 });
      sweep(ctx.bark, rach, (t) => 0.005 * (1 - t * 0.7), { sides: 3, color: () => rgb('#6a6a34'), smooth: false });
      const np = Math.round(lerp(6, 11, ctx.q));
      for (let j = 0; j < np; j++) {
        const t = lerp(0.05, 0.95, j / (np - 1)), at = along(rach, t);
        const side = V().crossVectors(at.d, V(0, 1, 0)).normalize();
        for (const sg of [-1, 1]) {
          const pd = at.d.clone().multiplyScalar(0.35).addScaledVector(side, sg).normalize();
          leaf(ctx.leaf, at.p, pd, at.d, h * 0.32 * (1 - t * 0.85), 0.32, { shape: (u) => (Math.round(u * 8) % 2 ? 1 : 0.35) * (1 - u * 0.75), segs: ctx.q < 0.6 ? 5 : 8, color: jitter(col[Math.floor(R() * col.length)], R, 0.08), curl: 0.3, fold: 0.15, bias: V(0, 1, 0), biasAmt: 0.5 });
        }
      }
    }
    if (ctx.season === 'spring') for (const b of spots(ctx, 4, 0.4 * SP(ctx))) {
      // fiddleheads uncurling
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 10; k++) { const u = k / 10, r = 0.05 * (1 - u * 0.8), th = u * 4.5; pts.push(b.clone().add(V(Math.sin(th) * r, 0.2 * u + (1 - Math.cos(th)) * r, 0))); }
      sweep(ctx.bark, pts, (t) => 0.008 * (1 - t * 0.5), { sides: 4, color: () => rgb('#8aa04a') });
    }
  },
};
S['reindeer-lichen'] = {
  label: 'Reindeer lichen', height: [0.03, 0.08, 0.15],
  build: (ctx) => {
    const R = ctx.R, H = H_(ctx);
    const pale = rgb('#d4d6c4'), green = rgb('#b8c4a4'), grey = rgb('#a8ac9a');
    for (const b of spots(ctx, count(ctx, 28), 0.6 * SP(ctx))) {
      const r = rnd(R, 0.04, 0.09) * (H / 0.08);
      blob(ctx.leaf, b.clone().add(V(0, r * 0.35, 0)), r, r * 0.7, r, (n, p) => mixc(mixc(pale, green, noise3(p.x * 40, p.y * 40, p.z * 40, ctx.seed)), grey, n.y < -0.2 ? 0.5 : 0), {
        w: ctx.q < 0.6 ? 10 : 14, h: ctx.q < 0.6 ? 7 : 9, bump: (n) => 0.55 * (noise3(n.x * 11 + b.x * 9, n.y * 11, n.z * 11 + b.z * 9, ctx.seed) - 0.45) + 0.18 * Math.max(0, Math.sin(n.x * 26) * Math.sin(n.z * 26)),
      });
    }
  },
};
S.moss = {
  label: 'Moss cushions', height: [0.02, 0.06, 0.12],
  build: (ctx) => {
    const R = ctx.R, H = H_(ctx);
    const greensM = greens(ctx, ['#4f7a2a', '#5a8a32', '#6a9a3a', '#3f6a26'], ['#5a7a2a', '#6a7a32'], ['#4a6a2a', '#56722e']);
    for (const b of spots(ctx, count(ctx, 14), 0.55 * SP(ctx))) {
      const r = rnd(R, 0.08, 0.18), c = greensM[Math.floor(R() * greensM.length)];
      blob(ctx.leaf, b.clone().add(V(0, -r * 0.2, 0)), r, H * rnd(R, 0.7, 1.2), r * rnd(R, 0.7, 1.1), (n, p) => shade(mixc(c, rgb('#9ab84a'), noise3(p.x * 60, p.y * 60, p.z * 60, ctx.seed) * 0.35), n.y < 0 ? 0.7 : 1), { w: 9, h: 5, bump: (n) => 0.1 * noise3(n.x * 10, n.y * 10, n.z * 10, ctx.seed) });
      // sporophytes: thin stalks with brown capsules
      if (ctx.season !== 'winter') for (let k = 0; k < Math.round(lerp(2, 6, ctx.q)); k++) {
        const a = R() * TAU, d = R() * r * 0.6, p0 = b.clone().add(V(Math.cos(a) * d, H * 0.6, Math.sin(a) * d));
        const top = p0.clone().add(V(0, 0.04, 0));
        sweep(ctx.bark, [p0, top], () => 0.0012, { sides: 3, color: () => rgb('#8a5a2a'), smooth: false });
        blob(ctx.bark, top, 0.0035, 0.006, 0.0035, () => rgb('#6a4a2a'), { w: 4, h: 3 });
      }
    }
  },
};
S['purple-saxifrage'] = {
  label: 'Purple saxifrage', height: [0.02, 0.05, 0.1], bloom: '#a04ab8',
  build: (ctx) => {
    const R = ctx.R, H = H_(ctx), purple = rgb(String(ctx.P.bloom));
    for (const b of spots(ctx, count(ctx, 6), 0.35 * SP(ctx))) {
      const r = rnd(R, 0.1, 0.18);
      blob(ctx.leaf, b, r, H, r, (_n, p) => mixc(rgb('#3a5a2a'), rgb('#5a7a3a'), noise3(p.x * 50, p.y * 50, p.z * 50, ctx.seed)), { w: 10, h: 5, bump: (n) => 0.1 * noise3(n.x * 12, n.y * 12, n.z * 12, ctx.seed) });
      if (!blooming(ctx, 'spring', 'summer')) continue;
      for (let k = 0; k < Math.round(lerp(12, 26, ctx.q)); k++) {
        const a = R() * TAU, d = Math.sqrt(R()) * r * 0.85;
        const at = b.clone().add(V(Math.cos(a) * d, H * (0.75 + 0.25 * (1 - d / r)), Math.sin(a) * d));
        blossom(ctx, at.add(V(0, 0.004, 0)), V(0, 1, 0), 0.022, jitter(purple, R, 0.06), rgb('#f2d8a0'));
      }
    }
  },
};
S.heather = {
  label: 'Heather', height: [0.15, 0.4, 0.8], bloom: '#c46aa8',
  build: (ctx) => {
    const R = ctx.R, H = H_(ctx), pink = rgb(String(ctx.P.bloom));
    const dark = greens(ctx, ['#3f5a2e', '#4a6634'], ['#5a5a32', '#6a5a36'], ['#4a4a2e', '#5a4e34']);
    for (const b of spots(ctx, count(ctx, 6), 0.4 * SP(ctx))) {
      for (let k = 0; k < Math.round(lerp(5, 9, ctx.q)); k++) {
        const pts = stem(ctx, b, H * rnd(R, 0.7, 1.1), 0.004, rgb('#5a3a2a'), { lean: 0.45 });
        // scale-like leaves make each shoot look like a fuzzy green cord
        for (let i = 0; i < 5; i++) { const at = along(pts, 0.2 + i * 0.15); blob(ctx.leaf, at.p, 0.012, 0.03, 0.012, () => jitter(dark[i % dark.length], R, 0.1), { w: 5, h: 4, rot: new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), at.d) }); }
        if (blooming(ctx, 'summer', 'autumn')) for (let i = 0; i < 6; i++) { const at = along(pts, 0.6 + i * 0.07); blob(ctx.leaf, at.p.clone().add(V((R() - 0.5) * 0.01, 0, (R() - 0.5) * 0.01)), 0.008, 0.008, 0.008, () => jitter(pink, R, 0.08), { w: 4, h: 3 }); }
      }
    }
  },
};

/* =============================== desert & tropical =============================== */
S['prickly-pear'] = {
  label: 'Prickly pear cactus', height: [0.4, 1.1, 2], bloom: '#f2d22a',
  build: (ctx) => {
    const R = ctx.R, H = H_(ctx), flower = rgb(String(ctx.P.bloom));
    const pad = rgb('#6a9a5a'), padDark = rgb('#4f7a46'), areole = rgb('#d8c89a');
    const padSize = 0.18 * (H / 1.1);
    const tips: { p: THREE.Vector3; d: THREE.Vector3; q: THREE.Quaternion }[] = [];
    const addPad = (at: THREE.Vector3, d: THREE.Vector3, level: number) => {
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), R() * TAU));
      const s = padSize * (1 - level * 0.12) * rnd(R, 0.85, 1.1);
      const c = at.clone().addScaledVector(d, s * 0.95);
      blob(ctx.bark, c, s * 0.72, s, s * 0.16, (n, p) => {
        const dots = Math.sin(p.x * 140) * Math.sin(p.y * 140) * Math.sin(p.z * 140);
        return dots > 0.75 ? areole : mixc(padDark, pad, n.y * 0.4 + 0.6);
      }, { w: 10, h: 7, rot: q });
      const top = c.clone().addScaledVector(d, s * 0.9);
      tips.push({ p: top, d, q });
      if (level < 2) {
        const k = pick(R, [1, 3]);
        for (let i = 0; i < k; i++) {
          const nd = wobble(d.clone().add(V(0, 0.3, 0)).normalize(), 0.75, R);
          if (nd.y < 0.1) nd.y = 0.3;
          addPad(top.clone().addScaledVector(nd, -s * 0.15), nd.normalize(), level + 1);
        }
      }
    };
    for (let i = 0; i < pick(R, [2, 3]); i++) addPad(V((R() - 0.5) * 0.2, 0, (R() - 0.5) * 0.2), wobble(V(0, 1, 0), 0.5, R), 0);
    for (const t of tips) {
      if (blooming(ctx, 'spring') && R() < 0.7) blossom(ctx, t.p, t.d, 0.045, jitter(flower, R, 0.05), rgb('#c8a02a'));
      else if (blooming(ctx, 'summer', 'autumn') && R() < 0.75) for (let k = 0; k < 3; k++) blob(ctx.bark, t.p.clone().add(V((k - 1) * 0.04, 0.03, 0)), 0.022, 0.035, 0.022, () => rgb('#a82a5a'), { w: 6, h: 5 });
    }
  },
};
S.bromeliad = {
  label: 'Bromeliad', height: [0.2, 0.45, 0.8], bloom: '#d8342a',
  build: (ctx) => {
    const H = H_(ctx);
    for (const b of spots(ctx, Math.max(1, Math.round(2 * Number(ctx.P.density))), 0.25 * SP(ctx))) bromeliad(ctx, b, H * 0.9, String(ctx.P.bloom));
  },
};
S.heliconia = {
  label: 'Heliconia (lobster claw)', height: [1, 2, 3.5], bloom: '#d8302a',
  build: (ctx) => {
    const H = H_(ctx), R = ctx.R, red = rgb(String(ctx.P.bloom)), yellow = rgb('#f2c21e');
    const lg = rgb('#3f7a34');
    for (const b of spots(ctx, Math.max(1, Math.round(2 * Number(ctx.P.density))), 0.3 * SP(ctx))) {
      for (let i = 0; i < Math.round(lerp(4, 7, ctx.q)); i++) {
        const pts = stem(ctx, b, H * rnd(R, 0.55, 0.8), 0.012, rgb('#4f7a3a'), { lean: 0.25 });
        const top = pts[pts.length - 1], d = along(pts, 1).d;
        leaf(ctx.leaf, top, d.clone().add(V(0, 0.4, 0)).normalize(), sideOf(d), H * 0.45, H * 0.12, { shape: LEAF.oval, segs: 6, color: jitter(lg, R, 0.08), curl: 0.7, fold: 0.2, bias: V(0, 1, 0), biasAmt: 0.4 });
      }
      // hanging inflorescence: alternating boat-shaped red bracts tipped with yellow
      const st = stem(ctx, b, H * 0.6, 0.01, rgb('#7a2a2a'), { lean: 0.35, nod: 0.9 });
      const top = st[st.length - 1];
      for (let k = 0; k < 8; k++) {
        const at = top.clone().add(V(0, -k * 0.06, 0));
        const sg = k % 2 ? 1 : -1, d = V(sg * 0.8, 0.35, 0.2).normalize();
        leaf(ctx.leaf, at, d, V(0, 0, 1), 0.11 - k * 0.006, 0.035, { shape: LEAF.lance, segs: 3, color: red, tip: yellow, curl: -0.4, fold: 0.6, bias: d });
      }
    }
  },
};
S.lotus = {
  label: 'Sacred lotus', height: [0.3, 0.8, 1.5], bloom: '#f2a6c4',
  build: (ctx) => {
    const R = ctx.R, H = H_(ctx), pink = rgb(String(ctx.P.bloom));
    const pad = rgb('#4a8a42'), padLite = rgb('#7aaa5a');
    for (const b of spots(ctx, count(ctx, 9), 0.9 * SP(ctx))) {
      const raised = R() < 0.55;
      const h = raised ? H * rnd(R, 0.3, 0.75) : 0.02;
      const top = b.clone().add(V((R() - 0.5) * 0.1, h, (R() - 0.5) * 0.1));
      sweep(ctx.bark, [b.clone().add(V(0, -0.6, 0)), b.clone().lerp(top, 0.5), top], () => 0.009, { sides: 4, color: () => rgb('#5a7a3a'), smooth: false });
      // round, slightly cupped pads that shed water (no notch, unlike water lilies)
      const r = rnd(R, 0.16, 0.3);
      const segs = ctx.q < 0.6 ? 10 : 16;
      const c = ctx.leaf.v(top.clone().add(V(0, -0.01, 0)), V(0, 1, 0), padLite);
      const ring: number[] = [];
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * TAU;
        ring.push(ctx.leaf.v(top.clone().add(V(Math.cos(a) * r, (raised ? 0.05 : 0.01) + Math.sin(a * 5 + b.x) * 0.012, Math.sin(a) * r)), V(0, 1, 0), jitter(pad, R, 0.04)));
      }
      for (let i = 0; i < segs; i++) ctx.leaf.tri(c, ring[i + 1], ring[i]);
    }
    if (!blooming(ctx, 'summer', 'autumn')) return;
    for (const b of spots(ctx, Math.max(1, Math.round(3 * Number(ctx.P.density))), 0.6 * SP(ctx))) {
      const top = b.clone().add(V(0, H * rnd(R, 0.85, 1.05), 0));
      sweep(ctx.bark, [b.clone().add(V(0, -0.6, 0)), top], () => 0.008, { sides: 4, color: () => rgb('#5a7a3a'), smooth: false });
      if (ctx.season === 'autumn') { blob(ctx.bark, top.clone().add(V(0, 0.03, 0)), 0.05, 0.035, 0.05, () => rgb('#6a5a3a')); continue; }
      for (let ringI = 0; ringI < 2; ringI++) for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + ringI * 0.4;
        const d = V(Math.cos(a) * (0.55 + ringI * 0.35), 1 - ringI * 0.35, Math.sin(a) * (0.55 + ringI * 0.35)).normalize();
        leaf(ctx.leaf, top, d, V(-Math.sin(a), 0, Math.cos(a)), 0.15 - ringI * 0.015, 0.09, { shape: LEAF.oval, segs: 3, color: mixc(rgb('#fbf2f4'), pink, 0.4 + ringI * 0.4), tip: pink, curl: -0.4, fold: 0.25, bias: d });
      }
      blob(ctx.bark, top.clone().add(V(0, 0.035, 0)), 0.025, 0.02, 0.025, () => rgb('#e8d24a'), { w: 8, h: 4 });
    }
  },
};
S['giant-kelp'] = {
  label: 'Giant kelp', height: [2, 7, 12],
  build: (ctx) => {
    const R = ctx.R, H = H_(ctx);
    const stipeCol = rgb('#7a5a24'), blade = ['#8a6a24', '#9a7a2c', '#7a6a22', '#a0802e'].map(rgb), float = rgb('#b08a3a');
    // holdfast: a tangle of root-like haptera gripping the rock
    for (let i = 0; i < 12; i++) {
      const a = R() * TAU, d = rnd(R, 0.12, 0.3);
      sweep(ctx.bark, spline([V(0, 0.12, 0), V(Math.cos(a) * d * 0.6, 0.08, Math.sin(a) * d * 0.6), V(Math.cos(a) * d, -0.02, Math.sin(a) * d)], 5), (t) => 0.025 * (1 - t * 0.6), { sides: 4, color: () => shade(stipeCol, 0.8) });
    }
    const n = Math.round(lerp(4, 8, ctx.q) * Number(ctx.P.density));
    for (let s = 0; s < n; s++) {
      const a = (s / n) * TAU + R(), h = H * rnd(R, 0.75, 1.05);
      const lean = V(Math.cos(a) * 0.12, 1, Math.sin(a) * 0.12).normalize();
      const pts = bentPath(V(0, 0.1, 0), lean, h, 14, { gnarl: 0.08, R });
      // near the surface the stipes bend over to form a floating canopy
      const last = pts[pts.length - 1];
      pts.push(last.clone().add(V(Math.cos(a) * 0.6, 0.05, Math.sin(a) * 0.6)), last.clone().add(V(Math.cos(a) * 1.3, 0.05, Math.sin(a) * 1.3)));
      sweep(ctx.bark, pts, () => 0.012, { sides: 4, color: () => stipeCol });
      const nb = Math.round(h / 0.38 * lerp(0.6, 1, ctx.q));
      for (let j = 0; j < nb; j++) {
        const at = along(pts, (j + 0.5) / nb);
        const out = V(Math.cos(j * 2.6 + a), 0, Math.sin(j * 2.6 + a));
        const fp = at.p.clone().addScaledVector(out, 0.04);
        blob(ctx.bark, fp, 0.022, 0.032, 0.022, () => jitter(float, R, 0.08), { w: 6, h: 4 }); // gas bladder (pneumatocyst)
        const bd = out.clone().add(V(0, 1.1, 0)).normalize();
        leaf(ctx.leaf, fp.clone().addScaledVector(bd, 0.02), bd, V().crossVectors(bd, out).normalize(), rnd(R, 0.55, 0.85), rnd(R, 0.1, 0.16), { shape: (t) => Math.min(1, t * 5) * (1 - Math.pow(t, 4)) * (1 + 0.15 * Math.sin(t * 40)), segs: ctx.q < 0.6 ? 4 : 6, color: jitter(blade[Math.floor(R() * blade.length)], R, 0.1), curl: 0.5, fold: 0.1, twist: 1.2, bias: out, biasAmt: 0.3 });
      }
    }
  },
};

// unused helpers kept for future species
void [fbm3, spline, clamp, rnd];
