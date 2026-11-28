import * as THREE from 'three';
import type { ParamSpec } from '../../modules';
import { Geo, V, TAU, clamp, lerp, sstep, mulberry, rgb, mixc, shade, jitter, fbm3, noise3, sweep, leaf, LEAF, along, bentPath, sideOf, vcMaterial, meshOf, type RGB, type RNG } from '../proc/kit';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** build context shared by every flora generator */
export interface Ctx {
  R: RNG;
  seed: number;
  bark: Geo;
  leaf: Geo;
  /** detail multiplier: ~0.45 phones, 0.75 balanced, 1 detailed */
  q: number;
  season: Season;
  P: Record<string, any>;
}

export function makeCtx(P: Record<string, any>): Ctx {
  const q = P.detail === 'low' ? 0.45 : P.detail === 'high' ? 1 : 0.75;
  const season = (SEASONS.includes(P.season) ? P.season : 'summer') as Season;
  return { R: mulberry(Number(P.seed) || 1), seed: Number(P.seed) || 1, bark: new Geo(), leaf: new Geo(), q, season, P };
}

/** wrap the geometry into a group: woody parts (front-sided) + foliage (double-sided) */
export function finish(ctx: Ctx, name: string, o: { leafRough?: number; barkRough?: number; glow?: Geo; glowColor?: string } = {}) {
  const g = new THREE.Group();
  g.name = name;
  if (ctx.bark.triangles) g.add(meshOf(ctx.bark, vcMaterial({ roughness: o.barkRough ?? 0.92, name: 'bark' }), 'wood'));
  if (ctx.leaf.triangles) g.add(meshOf(ctx.leaf, vcMaterial({ roughness: o.leafRough ?? 0.78, side: THREE.DoubleSide, name: 'leaves' }), 'foliage'));
  if (o.glow && o.glow.triangles) g.add(meshOf(o.glow, vcMaterial({ roughness: 0.6, emissive: o.glowColor ?? '#ffffff', emissiveIntensity: 0.05, name: 'glow' }), 'glow', false));
  let tris = 0;
  g.traverse((m) => { const mm = m as THREE.Mesh; if (mm.isMesh) tris += (mm.geometry.index?.count ?? 0) / 3; });
  g.userData.triangles = tris;
  return g;
}

export const defaults = (schema: Record<string, ParamSpec>, p: Record<string, unknown>) =>
  ({ ...Object.fromEntries(Object.entries(schema).map(([k, v]) => [k, v.default])), ...p }) as Record<string, any>;

export const pick = (R: RNG, [a, b]: [number, number]) => Math.round(a + R() * (b - a));
export const rnd = (R: RNG, a: number, b: number) => a + R() * (b - a);

/* ---------------- bark ---------------- */
export interface BarkLook {
  base: string; dark: string;
  /** vertical furrow strength 0..1 */
  furrow?: number;
  /** moss on the shady lower side */
  moss?: number;
  /** birch-style white bark with dark lenticels */
  lenticels?: string;
  /** cherry-style horizontal light lenticels */
  bands?: string;
  /** colour of the youngest twigs */
  twig?: string;
}
export function barkPaint(look: BarkLook, seed: number, height = 10) {
  const base = rgb(look.base), dark = rgb(look.dark), moss = rgb('#5b7a32');
  const len = look.lenticels ? rgb(look.lenticels) : null, band = look.bands ? rgb(look.bands) : null;
  const twig = look.twig ? rgb(look.twig) : null;
  return (t: number, a: number, p: THREE.Vector3, level = 0): RGB => {
    const ca = Math.cos(a), sa = Math.sin(a);
    const n = fbm3(ca * 1.6 + p.x * 0.6, p.y * 0.9, sa * 1.6 + p.z * 0.6, 3, seed);
    const fur = Math.abs(noise3(ca * 3 + p.x, p.y * 0.25, sa * 3 + p.z, seed + 3) - 0.5) * 2;
    let c = mixc(base, dark, clamp(n * 0.6 + (1 - fur) * (look.furrow ?? 0.4) * 0.7, 0, 1));
    if (len) {
      // white birch: short horizontal black dashes, black blotches near the base
      const dash = noise3(ca * 2.2 + p.x * 3, p.y * 26, sa * 2.2 + p.z * 3, seed + 9);
      if (dash > 0.74) c = mixc(c, len, 0.85);
      if (p.y < height * 0.08 && noise3(ca * 3, p.y * 6, sa * 3, seed + 4) > 0.45) c = mixc(c, len, 0.7);
    }
    if (band) {
      const b = noise3(ca * 4 + p.x * 2, p.y * 30, sa * 4 + p.z * 2, seed + 11);
      if (b > 0.72) c = mixc(c, band, 0.55);
    }
    if (look.moss && p.y < height * 0.25 && ca * 0.8 + sa * 0.6 > 0.15 && n > 0.45 - look.moss * 0.25) c = mixc(c, moss, 0.65 * look.moss);
    // darker at the root, lighter towards thin twigs
    c = shade(c, lerp(0.72, 1, sstep(0, 0.6, p.y)));
    if (twig && level >= 2) c = mixc(c, twig, clamp(0.35 + t * 0.4, 0, 1));
    return c;
  };
}

/* ---------------- recursive broadleaf architecture ---------------- */
export interface Arch {
  /** deepest branch level (scaffolds are level 1) */
  levels: number;
  /** children per branch at each level (index = parent level) */
  kids: [number, number][];
  /** branching angle from the parent at each level (radians) */
  angle: number[];
  /** child length / parent length at each level */
  ratio: number[];
  /** where on the parent children start / end (0..1) */
  start: number;
  end?: number;
  /** phototropism (+ up) and gravity on thin limbs (+ down) */
  up: number;
  sag: number;
  gnarl: number;
  /** child base radius as a fraction of the parent radius at the joint */
  rRatio: number;
  segs?: number;
}

export interface TwigHook { (pts: THREE.Vector3[], level: number, r: number): void }

export function grow(ctx: Ctx, a: Arch, p0: THREE.Vector3, dir: THREE.Vector3, len: number, r0: number, level: number, paint: (t: number, ang: number, p: THREE.Vector3, level?: number) => RGB, twig: TwigHook) {
  const R = ctx.R;
  const segs = Math.max(2, Math.round((a.segs ?? 6) * (1 - level * 0.18)));
  const frac = level / Math.max(1, a.levels);
  const pts = bentPath(p0, dir, len, segs, { pull: V(0, a.up - a.sag * frac * frac, 0), pullAmt: 1, gnarl: a.gnarl * (0.6 + frac), R });
  const tipR = level >= a.levels ? 0.25 : 0.42;
  const rAt = (t: number) => r0 * lerp(1, tipR, Math.pow(t, 0.9));
  const sides = Math.max(3, Math.round((level === 1 ? 7 : level === 2 ? 5 : 4) * (ctx.q > 0.6 ? 1 : 0.8)));
  if (r0 > 0.004) sweep(ctx.bark, pts, rAt, { sides, color: (t, ang, p) => paint(t, ang, p, level), capEnd: true });
  if (level >= a.levels) { twig(pts, level, r0); return; }
  const [k0, k1] = a.kids[level] ?? [2, 3];
  // fewer sub-branches on low quality, but keep the outline
  const n = Math.max(1, Math.round(pick(R, [k0, k1]) * (level >= a.levels - 1 ? lerp(0.6, 1, ctx.q) : 1)));
  const d0 = V().subVectors(pts[pts.length - 1], pts[0]).normalize();
  const phase = R() * TAU;
  for (let i = 0; i < n; i++) {
    const t = lerp(a.start, a.end ?? 0.92, (i + 0.3 + R() * 0.5) / n);
    const at = along(pts, t);
    const pd = at.d;
    const s = sideOf(pd).applyAxisAngle(pd, phase + i * 2.39996 + (R() - 0.5) * 0.6);
    const ang = (a.angle[level] ?? 0.6) * (0.8 + R() * 0.4);
    const cd = pd.clone().multiplyScalar(Math.cos(ang)).addScaledVector(s, Math.sin(ang)).normalize();
    const cl = len * (a.ratio[level] ?? 0.6) * (1 - t * 0.45) * (0.8 + R() * 0.4);
    grow(ctx, a, at.p, cd, cl, Math.max(0.003, rAt(t) * a.rRatio), level + 1, paint, twig);
  }
  // twiggy leaves along the outer half of mid-level limbs keep crowns full
  if (level === a.levels - 1) twig(pts.slice(Math.floor(pts.length / 2)), level, r0);
  void d0;
}

/* ---------------- foliage ---------------- */
export interface LeafLook {
  shape: keyof typeof LEAF | ((t: number) => number);
  len: number;
  width: number;
  /** leaves per cluster */
  per: number;
  /** clusters per twig */
  clusters: number;
  droop?: number;
  fold?: number;
  colors: RGB[];
  /** spread of leaf directions away from the twig (radians) */
  spread?: number;
}

/** leaf clusters along a twig; `center` is the crown centre used to face leaves outward */
export function leafTwig(ctx: Ctx, pts: THREE.Vector3[], look: LeafLook, center: THREE.Vector3, density = 1) {
  const R = ctx.R;
  const shape = typeof look.shape === 'function' ? look.shape : LEAF[look.shape];
  const k = Math.max(1, Math.round(look.clusters * density * lerp(0.55, 1, ctx.q)));
  const scale = 1 / Math.sqrt(lerp(0.6, 1, ctx.q));
  for (let c = 0; c < k; c++) {
    const t = k === 1 ? 1 : lerp(0.3, 1, c / (k - 1));
    const at = along(pts, t);
    const out = V().subVectors(at.p, center);
    out.y *= 0.6;
    out.normalize().add(V(0, 0.35, 0)).normalize();
    const per = Math.max(2, Math.round(look.per * lerp(0.7, 1, ctx.q)));
    const ph = R() * TAU;
    for (let i = 0; i < per; i++) {
      const az = ph + (i / per) * TAU + (R() - 0.5) * 0.5;
      const s = sideOf(at.d).applyAxisAngle(at.d, az);
      const spread = look.spread ?? 0.9;
      const d = at.d.clone().multiplyScalar(Math.cos(spread)).addScaledVector(s, Math.sin(spread)).addScaledVector(out, 0.35).normalize();
      const L = look.len * scale * (0.75 + R() * 0.5);
      const base = at.p.clone().addScaledVector(d, look.len * 0.08);
      const col = jitter(look.colors[Math.floor(R() * look.colors.length)], R, 0.1);
      leaf(ctx.leaf, base, d, V().crossVectors(d, out).normalize(), L, L * look.width, { shape, color: col, curl: look.droop ?? 0.35, fold: look.fold ?? 0.25, segs: 2, bias: out, biasAmt: 0.6, flat: ctx.q < 0.9 });
    }
  }
}

/** darken foliage towards the inside and bottom of a crown (cheap ambient occlusion) */
export function crownShade(g: Geo, from: number, center: THREE.Vector3, radius: number, height: number, amount = 0.45) {
  const P = g.p, C = g.c;
  for (let k = from; k < P.length / 3; k++) {
    const dx = P[k * 3] - center.x, dy = (P[k * 3 + 1] - center.y) * 0.8, dz = P[k * 3 + 2] - center.z;
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz) / Math.max(0.01, radius);
    const up = clamp((P[k * 3 + 1] - (center.y - height * 0.5)) / Math.max(0.01, height), 0, 1);
    const f = lerp(1 - amount, 1.05, sstep(0.15, 1.05, r)) * lerp(0.82, 1.06, up);
    C[k * 3] *= f; C[k * 3 + 1] *= f; C[k * 3 + 2] *= f;
  }
}

/* ---------------- shared bits ---------------- */
/** tapered trunk path with lean and gentle sway */
export function trunkPath(ctx: Ctx, H: number, lean: number, segs = 10, wiggle = 0.04) {
  const R = ctx.R;
  const az = R() * TAU;
  const lx = Math.cos(az) * lean * H, lz = Math.sin(az) * lean * H;
  const ph = R() * 6;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(V(lx * t * t + Math.sin(t * 5 + ph) * wiggle * H * t, t * H, lz * t * t + Math.cos(t * 4 + ph) * wiggle * H * t));
  }
  return pts;
}

/** surface roots / buttress flare: radius multiplier around the trunk base */
export const flare = (amount: number, lobes = 5, seed = 1) => (t: number, a: number) => 1 + amount * Math.pow(Math.max(0, 1 - t * 9), 2) * (0.55 + 0.45 * Math.cos(a * lobes + seed));

/** small five-petal blossom (cherry, apple, hawthorn) */
export function blossom(ctx: Ctx, at: THREE.Vector3, n: THREE.Vector3, size: number, petal: RGB, center: RGB) {
  const R = ctx.R;
  const nn = n.clone().normalize();
  const e1 = sideOf(nn), e2 = V().crossVectors(nn, e1);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + R() * 0.3;
    const d = e1.clone().multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a)).addScaledVector(nn, 0.25).normalize();
    leaf(ctx.leaf, at, d, V().crossVectors(d, nn), size, size * 0.85, { shape: LEAF.oval, color: jitter(petal, R, 0.05), curl: -0.2, fold: 0.05, segs: 1, bias: nn, biasAmt: 0.5, flat: true });
  }
  leaf(ctx.leaf, at.clone().addScaledVector(nn, size * 0.08), e1, e2, size * 0.25, size * 0.25, { shape: LEAF.oval, color: center, segs: 1, flat: true, bias: nn });
}

/** colour helper: season-aware foliage palette */
export function seasonal(ctx: Ctx, pal: Partial<Record<Season, string[]>> & { summer: string[] }): RGB[] | null {
  const list = pal[ctx.season] ?? (ctx.season === 'winter' ? null : pal.summer);
  return list ? list.map(rgb) : null;
}

/** a tank bromeliad rosette (also used on its own in herbs) */
export function bromeliad(ctx: Ctx, at: THREE.Vector3, size: number, bract = '#d8342a') {
  const R = ctx.R;
  const n = Math.round(lerp(8, 14, ctx.q));
  const green = rgb('#3f7a3a'), lite = rgb('#7ea84e');
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R() * 0.3;
    const el = rnd(R, 0.6, 1.2);
    const d = V(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
    leaf(ctx.leaf, at, d, V(-Math.sin(a), 0, Math.cos(a)), size * rnd(R, 0.8, 1.1), 0.18, { shape: LEAF.strap, segs: 3, color: jitter(green, R, 0.1), tip: lite, curl: 0.6, fold: 0.35, bias: V(0, 1, 0), biasAmt: 0.4 });
  }
  const bc = rgb(bract);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const d = V(Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4).normalize();
    leaf(ctx.leaf, at.clone().add(V(0, size * 0.1, 0)), d, V(-Math.sin(a), 0, Math.cos(a)), size * 0.45, 0.35, { shape: LEAF.lance, segs: 2, color: bc, curl: 0.2, fold: 0.3, bias: d });
  }
}


export { V, TAU, clamp, lerp, sstep, rgb, mixc, shade, jitter, sweep, leaf, LEAF, along, sideOf };
