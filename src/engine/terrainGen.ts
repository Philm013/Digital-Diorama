import { Noise2D, clamp, lerp, smoothstep, rng } from './util';
import { GROUND_INDEX, Terrain } from './Terrain';
import { waterDistance } from './landforms';

export interface TerrainRecipe {
  width?: number;
  depth?: number;
  cell?: number;
  seed?: number;
  relief?: number;
  scale?: number;
  backRise?: number;
  ridges?: number;
  dunes?: number;
  ponds?: { x: number; z: number; r: number; depth: number }[];
  river?: { points: [number, number][]; width: number; depth: number };
  flats?: { x: number; z: number; r: number; h?: number }[];
  hills?: { x: number; z: number; r: number; h: number }[];
  waterLevel?: number | null;
  strata?: string;
  paint?: PaintPreset;
}

export type PaintPreset = 'forest' | 'taiga' | 'savanna' | 'rainforest' | 'desert' | 'arctic' | 'wetland' | 'mountain' | 'meadow' | 'garden' | 'beach' | 'blank';

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const vx = bx - ax, vz = bz - az, wx = px - ax, wz = pz - az;
  const t = clamp((wx * vx + wz * vz) / (vx * vx + vz * vz || 1), 0, 1);
  return Math.hypot(px - (ax + t * vx), pz - (az + t * vz));
}

/** Catmull-Rom resample of a control polyline for smooth river beds. */
function smoothPath(pts: [number, number][], steps = 10): [number, number][] {
  if (pts.length < 3) return pts;
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** what a terrain was generated from, so new land can carry on in the same character */
export interface TerrainGen { recipe: TerrainRecipe; norm: number }

/** biome recipes are laid out for a 40 × 28 m box */
const REF_W = 40, REF_D = 28;

/**
 * A recipe fitted to another box size: rivers, ponds, hills and flats move with the box (so a
 * creek still crosses it and a pond stays in the same place), and grow a little with it.
 * The noise keeps its scale in metres, so a bigger box simply holds more hills.
 */
export function scaleRecipe(r: TerrainRecipe, width: number, depth: number): TerrainRecipe {
  const sx = width / REF_W, sz = depth / REF_D, sa = Math.sqrt(sx * sz);
  const fs = clamp(sa, 0.6, 1.8);
  return {
    ...r, width, depth,
    backRise: r.backRise ? r.backRise * clamp(Math.sqrt(sz), 0.75, 1.5) : r.backRise,
    ponds: r.ponds?.map((p) => ({ x: p.x * sx, z: p.z * sz, r: p.r * fs, depth: p.depth * clamp(sa, 0.8, 1.3) })),
    river: r.river && { points: r.river.points.map(([x, z]) => [x * sx, z * sz] as [number, number]), width: r.river.width * clamp(sa, 0.75, 1.6), depth: r.river.depth * clamp(sa, 0.85, 1.3) },
    flats: r.flats?.map((f) => ({ ...f, x: f.x * sx, z: f.z * sz, r: f.r * fs })),
    hills: r.hills?.map((h) => ({ x: h.x * sx, z: h.z * sz, r: h.r * fs, h: h.h * clamp(sa, 0.8, 1.4) })),
  };
}

/** a river's control points carried on past both ends, meandering, for land beyond the box */
function extendRiver(pts: [number, number][], len: number, seed: number): [number, number][] {
  if (pts.length < 2 || len <= 0) return pts;
  const N = new Noise2D(seed * 5 + 77);
  const STEP = 9;
  const grow = (a: [number, number], b: [number, number], side: number) => {
    const out: [number, number][] = [];
    let ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const base = ang;
    let [x, z] = b;
    for (let k = 1; k * STEP <= len; k++) {
      // wander, but keep heading roughly away from the box
      ang += 0.45 * N.noise(k * 0.37, side * 11.3);
      ang = base + clamp(ang - base, -0.9, 0.9);
      x += Math.cos(ang) * STEP; z += Math.sin(ang) * STEP;
      out.push([x, z]);
    }
    return out;
  };
  const n = pts.length;
  const tail = grow(pts[n - 2], pts[n - 1], 1);
  const head = grow(pts[1], pts[0], 2).reverse();
  return [...head, ...pts, ...tail];
}

/** segments of a polyline bucketed on a grid, for fast "how far to the river" queries */
class SegIndex {
  private cells = new Map<number, number[]>();
  private segs: Float64Array;
  constructor(path: [number, number][], private reach: number, private cell = 12) {
    this.segs = new Float64Array((path.length - 1) * 4);
    for (let k = 0; k < path.length - 1; k++) {
      const [ax, az] = path[k], [bx, bz] = path[k + 1];
      this.segs.set([ax, az, bx, bz], k * 4);
      const i0 = Math.floor((Math.min(ax, bx) - reach) / cell), i1 = Math.floor((Math.max(ax, bx) + reach) / cell);
      const j0 = Math.floor((Math.min(az, bz) - reach) / cell), j1 = Math.floor((Math.max(az, bz) + reach) / cell);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const key = (i + 32768) * 65536 + (j + 32768);
        const l = this.cells.get(key);
        if (l) l.push(k); else this.cells.set(key, [k]);
      }
    }
  }
  /** distance to the nearest segment, or Infinity when none is within reach */
  dist(x: number, z: number) {
    const l = this.cells.get((Math.floor(x / this.cell) + 32768) * 65536 + (Math.floor(z / this.cell) + 32768));
    if (!l) return Infinity;
    let d = Infinity;
    const s = this.segs;
    for (const k of l) d = Math.min(d, distToSegment(x, z, s[k * 4], s[k * 4 + 1], s[k * 4 + 2], s[k * 4 + 3]));
    return d <= this.reach ? d : Infinity;
  }
}

/**
 * A recipe as a function of position, defined everywhere (not just inside its box): `raw` is the
 * land before levelling, `finish` levels it and lifts low ground that isn't a pond or river just
 * above the water, so only carved features hold water. `extend` carries the river on that far
 * past the box, for land added around it.
 */
export function makeField(r: TerrainRecipe, extend = 0) {
  const depth = r.depth ?? REF_D;
  const seed = r.seed ?? 7;
  const N = new Noise2D(seed);
  const relief = r.relief ?? 1.2, scale = r.scale ?? 0.06;
  const path = r.river ? smoothPath(extendRiver(r.river.points, extend, seed)) : null;
  const rw = r.river?.width ?? 0;
  const rivers = path ? new SegIndex(path, rw * 1.4 + 0.5) : null;
  const waterLevel = r.waterLevel === undefined ? (r.ponds || r.river ? -0.25 : null) : r.waterLevel;
  const keepWet = waterLevel !== null && !!(r.ponds?.length || r.river);
  const raw = (x: number, z: number) => {
    let h = relief * N.fbm(x * scale, z * scale, 4);
    h += relief * 0.15 * N.noise(x * scale * 5, z * scale * 5);
    if (r.backRise) {
      const t = smoothstep(depth * 0.1, -depth / 2, z);
      h += r.backRise * t * t * (0.65 + 0.35 * N.ridged(x * 0.05 + 3, z * 0.05, 4) + 0.25 * N.noise(x * 0.12, 7));
    }
    if (r.ridges) h += r.ridges * (N.ridged(x * 0.045, z * 0.045, 5) - 0.35);
    if (r.dunes) {
      const w = x * 0.16 + N.fbm(x * 0.03, z * 0.03, 2) * 3.2;
      const crest = Math.pow(0.5 + 0.5 * Math.sin(w + z * 0.05), 2.2);
      h += r.dunes * (crest * (0.7 + 0.3 * N.noise(x * 0.05, z * 0.09)) - 0.3);
    }
    if (r.hills) for (const hl of r.hills) {
      const d = Math.hypot(x - hl.x, z - hl.z) / hl.r;
      if (d < 1) h += hl.h * Math.pow(Math.cos(d * Math.PI * 0.5), 2) * (0.85 + 0.15 * N.noise(x * 0.3, z * 0.3));
    }
    if (r.ponds) for (const p of r.ponds) {
      const wob = 1 + 0.18 * N.noise(x * 0.25 + p.x, z * 0.25 + p.z);
      const d = Math.hypot(x - p.x, z - p.z) / (p.r * wob);
      if (d < 1.6) {
        const bowl = d < 1 ? (1 - d * d) : 0;
        const rim = smoothstep(1.6, 0.9, d);
        h = h * (1 - rim * 0.85) - p.depth * bowl - 0.05 * rim;
      }
    }
    if (rivers && r.river) {
      const dmin = rivers.dist(x, z);
      const hw = r.river.width / 2 * (1 + 0.15 * N.noise(x * 0.2, z * 0.2));
      if (dmin < hw * 2.4) {
        const bank = smoothstep(hw * 2.4, hw, dmin);
        const bed = dmin < hw ? 1 - (dmin / hw) * (dmin / hw) : 0;
        h = h * (1 - bank * 0.8) - r.river.depth * bed - 0.12 * bank;
      }
    }
    if (r.flats) for (const f of r.flats) {
      const d = Math.hypot(x - f.x, z - f.z);
      const t = smoothstep(f.r, f.r * 0.5, d);
      h = h + ((f.h ?? 0) - h) * t;
    }
    return h;
  };
  /** 1 inside a pond or river, falling to 0 at its banks */
  const wet = (x: number, z: number) => {
    let w = 0;
    if (r.ponds) for (const p of r.ponds) w = Math.max(w, smoothstep(p.r * 1.25, p.r * 0.75, Math.hypot(x - p.x, z - p.z)));
    if (rivers && r.river) w = Math.max(w, smoothstep(rw * 0.95, rw * 0.45, rivers.dist(x, z)));
    return w;
  };
  const finish = (h: number, x: number, z: number) => {
    if (!keepWet) return h;
    const floor = waterLevel! + 0.18 + 0.12 * N.noise(x * 0.4, z * 0.4);
    if (h >= floor) return h;
    const w = wet(x, z);
    return w < 1 ? h * w + floor * (1 - w) : h;
  };
  /** how far a point is from the river's centre line (Infinity when far) */
  const riverDist = (x: number, z: number) => (rivers ? rivers.dist(x, z) : Infinity);
  /** metres to the nearest pond's edge (negative inside one) */
  const pondDist = (x: number, z: number) => {
    let d = Infinity;
    if (r.ponds) for (const p of r.ponds) d = Math.min(d, Math.hypot(x - p.x, z - p.z) - p.r);
    return d;
  };
  return { raw, finish, wet, waterLevel, riverDist, pondDist, riverWidth: rw, riverDepth: r.river?.depth ?? 0 };
}

/** the level a recipe is shifted by: the median of the front half of its box */
function levelOf(r: TerrainRecipe, raw: (x: number, z: number) => number, stride: number) {
  const width = r.width ?? REF_W, depth = r.depth ?? REF_D;
  const sample: number[] = [];
  for (let z = 0; z <= depth / 2 + 1e-6; z += stride) for (let x = -width / 2; x <= width / 2 + 1e-6; x += stride) sample.push(raw(x, z));
  sample.sort((a, b) => a - b);
  const median = sample[Math.floor(sample.length / 2)] ?? 0;
  return r.ponds?.length || r.river ? Math.max(0, median) * 0.5 : median;
}

/** the generator behind a terrain made before it was recorded: the habitat's recipe at the size it was made */
export function inferGen(recipe: TerrainRecipe, width?: number, depth?: number): TerrainGen {
  const r = width && depth && !recipe.ponds && !recipe.river && !recipe.hills && !recipe.flats ? { ...recipe, width, depth } : { width: REF_W, depth: REF_D, ...recipe };
  return { recipe: r, norm: levelOf(r, makeField(r).raw, 0.75) };
}

/** height of a generator's land at any point, inside its box or far beyond it */
export function fieldHeight(gen: TerrainGen, extend = 0) {
  const f = makeField(gen.recipe, extend);
  return { ...f, height: (x: number, z: number) => f.finish(f.raw(x, z) - gen.norm, x, z) };
}

export function generateTerrain(r: TerrainRecipe): Terrain {
  const width = r.width ?? REF_W, depth = r.depth ?? REF_D, cell = r.cell ?? 0.25;
  const nx = Math.round(width / cell) + 1, nz = Math.round(depth / cell) + 1;
  const seed = r.seed ?? 7;
  const recipe: TerrainRecipe = { ...r, width, depth, seed };
  const f = makeField(recipe);
  const heights = new Float32Array(nx * nz);
  const paint = new Uint8Array(nx * nz);
  const xOf = (i: number) => -width / 2 + (i * width) / (nx - 1);
  const zOf = (j: number) => -depth / 2 + (j * depth) / (nz - 1);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) heights[j * nx + i] = f.raw(xOf(i), zOf(j));
  // level: put the median front-half height near 0
  const sample: number[] = [];
  for (let j = Math.floor(nz * 0.5); j < nz; j += 3) for (let i = 0; i < nx; i += 3) sample.push(heights[j * nx + i]);
  sample.sort((a, b) => a - b);
  const median = sample[Math.floor(sample.length / 2)] ?? 0;
  const norm = r.ponds?.length || r.river ? Math.max(0, median) * 0.5 : median;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    heights[k] = f.finish(heights[k] - norm, xOf(i), zOf(j));
  }
  const t = new Terrain({ width, depth, nx, nz, heights, paint, waterLevel: f.waterLevel, strata: r.strata ?? 'loam', seed });
  t.gen = { recipe, norm };
  applyPaint(t, r.paint ?? 'meadow', seed);
  t.rebuild();
  return t;
}

export function applyPaint(t: Terrain, preset: PaintPreset, seed = 1) {
  const N = new Noise2D(seed * 13 + 1);
  const R = rng(seed);
  const G = GROUND_INDEX;
  const wl = t.waterLevel;
  const dist = waterDistance(t);
  for (let j = 0; j < t.nz; j++) {
    for (let i = 0; i < t.nx; i++) {
      const k = j * t.nx + i;
      const x = t.xOf(i), z = t.zOf(j), h = t.heights[k];
      const hx = t.h(i + 1, j) - t.h(i - 1, j), hz = t.h(i, j + 1) - t.h(i, j - 1);
      const slope = Math.hypot(hx, hz) / (2 * t.dx);
      const n1 = N.fbm(x * 0.08, z * 0.08, 3), n2 = N.noise(x * 0.3, z * 0.3);
      // < 0 under water; otherwise roughly 'metres to the shore' scaled so 0.2 ≈ 1 m
      const nearWater = wl === null ? 99 : h < wl ? h - wl : dist[k] * 0.2;
      let g = G.grass;
      switch (preset) {
        case 'forest':
          g = n1 > 0.12 ? G.forest : n1 > -0.25 ? G.grass : G.meadow;
          if (nearWater < 0.2) g = nearWater < -0.2 ? G.mud : G.soil;
          if (slope > 0.85) g = G.rock;
          break;
        case 'taiga':
          g = n1 > 0.0 ? G.forest : n1 > -0.3 ? G.moss : G.grass;
          if (h > 3.2 + n2) g = G.snow;
          if (nearWater < 0.25) g = nearWater < -0.15 ? G.gravel : G.soil;
          if (slope > 0.8) g = G.rock;
          break;
        case 'savanna':
          g = n1 > 0.62 ? G.soil : G.dry;
          if (n2 > 0.75) g = G.grass;
          if (nearWater < 0.3) g = nearWater < -0.1 ? G.mud : G.soil;
          if (slope > 0.9) g = G.rock;
          break;
        case 'rainforest':
          g = n1 > -0.1 ? G.jungle : G.forest;
          if (nearWater < 0.25) g = nearWater < -0.1 ? G.mud : G.soil;
          if (slope > 1.0) g = G.rock;
          break;
        case 'desert':
          g = n1 > 0.35 ? G.sand : G.redsand;
          if (slope > 0.75) g = G.rock;
          if (nearWater < 0.35) g = nearWater < -0.05 ? G.mud : (n2 > 0 ? G.grass : G.soil);
          break;
        case 'arctic':
          g = n1 > 0.3 ? G.moss : G.snow;
          if (slope > 0.9) g = G.rock;
          if (nearWater < 0.15) g = nearWater < -0.1 ? G.gravel : G.ice;
          break;
        case 'wetland':
          g = n1 > 0.15 ? G.meadow : G.grass;
          if (nearWater < 0.45) g = G.mud;
          if (nearWater < -0.1) g = G.mud;
          break;
        case 'mountain':
          g = h > 4.5 + n2 * 0.8 ? G.snow : h > 2.6 + n2 ? G.rock : n1 > 0.15 ? G.forest : G.meadow;
          if (slope > 0.75 && g !== G.snow) g = G.rock;
          if (nearWater < 0.2) g = nearWater < -0.1 ? G.gravel : G.soil;
          break;
        case 'garden':
          g = G.grass;
          if (n1 > 0.42) g = G.meadow;
          if (nearWater < 0.2) g = G.gravel;
          break;
        case 'beach':
          g = z > 2 ? G.sand : n1 > 0.2 ? G.dry : G.grass;
          if (nearWater < 0.4) g = G.sand;
          break;
        case 'blank':
          g = G.grass;
          break;
        case 'meadow':
        default:
          g = n1 > 0.2 ? G.meadow : G.grass;
          if (nearWater < 0.25) g = nearWater < -0.1 ? G.mud : G.soil;
          if (slope > 0.9) g = G.rock;
      }
      if (R() < 0.004 && g !== G.snow && g !== G.ice) g = G.gravel;
      t.paint[k] = g;
    }
  }
}

/**
 * Heights outside a terrain's box: the land its generator would have made there, carried on from
 * the box's actual edge. The difference between the edge and the generator's land there (from
 * sculpting, landforms, levelling) is blurred along the edge — more the further out — and fades
 * away over some metres, so the join is exact at the edge but nothing gets stretched outward:
 * a few steps out, the land already has its own hills, hollows and creeks.
 */
export class EdgeContinuation {
  private hw: number;
  private hd: number;
  private per: number;
  private ds = 0.5;
  private sum: Float64Array;
  private n: number;
  constructor(private t: Terrain, private field: (x: number, z: number) => number) {
    this.hw = t.width / 2; this.hd = t.depth / 2;
    this.per = 4 * (this.hw + this.hd);
    this.n = Math.ceil(this.per / this.ds);
    this.sum = new Float64Array(this.n + 1);
    for (let k = 0; k < this.n; k++) {
      const [x, z] = this.pointAt(k * this.ds);
      this.sum[k + 1] = this.sum[k] + (t.heightAt(x, z) - field(x, z));
    }
  }
  /** the point on the box outline at perimeter distance s (anticlockwise from the back-left corner) */
  private pointAt(s: number): [number, number] {
    const { hw, hd } = this;
    s = ((s % this.per) + this.per) % this.per;
    if (s < 2 * hw) return [-hw + s, -hd];
    s -= 2 * hw;
    if (s < 2 * hd) return [hw, -hd + s];
    s -= 2 * hd;
    if (s < 2 * hw) return [hw - s, hd];
    s -= 2 * hw;
    return [-hw, hd - s];
  }
  private sOf(cx: number, cz: number) {
    const { hw, hd } = this;
    if (cz <= -hd + 1e-6) return cx + hw;
    if (cx >= hw - 1e-6) return 2 * hw + cz + hd;
    if (cz >= hd - 1e-6) return 2 * hw + 2 * hd + hw - cx;
    return 4 * hw + 2 * hd + hd - cz;
  }
  /** mean edge offset over [s - r, s + r] (wrapping round the corners) */
  private mean(s: number, r: number) {
    const ds = this.ds, n = this.n;
    const k0 = Math.round((s - r) / ds), k1 = Math.max(k0, Math.round((s + r) / ds));
    const count = k1 - k0 + 1;
    const at = (k: number) => { const q = Math.floor(k / n), m = k - q * n; return this.sum[m] + q * this.sum[n]; };
    return (at(k1 + 1) - at(k0)) / count;
  }
  /** distance outside the box (0 inside) */
  outside(x: number, z: number) {
    return Math.hypot(x - clamp(x, -this.hw, this.hw), z - clamp(z, -this.hd, this.hd));
  }
  height(x: number, z: number) {
    const { hw, hd } = this;
    const cx = clamp(x, -hw, hw), cz = clamp(z, -hd, hd);
    const d = Math.hypot(x - cx, z - cz);
    if (d === 0) return this.t.heightAt(x, z);
    const off = this.mean(this.sOf(cx, cz), Math.min(10, 0.25 + d * 0.8));
    const reach = clamp(8 + Math.abs(off) * 3, 8, 30);
    return this.field(x, z) + off * (1 - smoothstep(0, reach, d));
  }
}

/** an outward point's mirror image inside the box, for carrying the ground's pattern across the edge */
export function mirrorInto(x: number, z: number, hw: number, hd: number): [number, number] {
  const m = (v: number, h: number) => (v > h ? 2 * h - v : v < -h ? -2 * h - v : v);
  return [clamp(m(x, hw), -hw, hw), clamp(m(z, hd), -hd, hd)];
}

/**
 * A terrain of a new size made from an old one, centred on the same spot. Inside the old box
 * heights and ground are resampled. Land added around it is new land of the same habitat — its
 * generator carried on outward, with its creek continuing — joined seamlessly to the old edge;
 * its ground starts as the old edge's pattern and turns into the habitat's own ground further out.
 */
export function resampleTerrain(t: Terrain, width: number, depth: number, cell: number, gen?: TerrainGen): Terrain {
  const nx = Math.round(width / cell) + 1, nz = Math.round(depth / cell) + 1;
  const heights = new Float32Array(nx * nz);
  const paint = new Uint8Array(nx * nz);
  const N = new Noise2D(t.seed * 3 + 11);
  const ow = t.width / 2, od = t.depth / 2;
  const recipe: TerrainRecipe = gen?.recipe ?? { seed: t.seed, relief: 0.4, width: t.width, depth: t.depth };
  const extend = Math.max(width, depth);
  const f = fieldHeight(gen ?? { recipe, norm: 0 }, extend);
  const cont = new EdgeContinuation(t, f.height);
  const wl = t.waterLevel;
  const pg = t.paintGrid;
  const oldPaint = (x: number, z: number) => {
    const ii = Math.round((clamp(x, -ow, ow) + ow) / pg.dx), jj = Math.round((clamp(z, -od, od) + od) / pg.dz);
    return t.paint[clamp(jj, 0, t.nz - 1) * t.nx + clamp(ii, 0, t.nx - 1)];
  };
  const outside = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = -width / 2 + (i * width) / (nx - 1), z = -depth / 2 + (j * depth) / (nz - 1);
      const k = j * nx + i;
      const out = cont.outside(x, z);
      outside[k] = out;
      let h = cont.height(x, z);
      // the creek keeps flowing through the new land, at the water's level
      if (out > 0 && wl !== null && f.riverWidth > 0) h = carveRiver(h, x, z, f, wl, smoothstep(0, 8, out));
      heights[k] = h;
    }
  }
  const nt = new Terrain({ width, depth, nx, nz, heights, paint, waterLevel: wl, strata: t.strata.id, seed: t.seed });
  nt.gen = gen;
  // the habitat's own ground for the new land, from its shape
  const grew = outside.some((o) => o > 0);
  if (grew) applyPaint(nt, recipe.paint ?? 'meadow', t.seed + 1);
  const band = Math.min(6, Math.min(ow, od) * 0.5);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    const x = -width / 2 + (i * width) / (nx - 1), z = -depth / 2 + (j * depth) / (nz - 1);
    const out = outside[k];
    if (out <= 0) { paint[k] = oldPaint(x, z); continue; }
    // near the old edge its ground carries on as a mirror image (no stripes), with a ragged edge
    if (out < band + N.fbm(x * 0.12, z * 0.12, 2) * band * 0.9) {
      const [mx, mz] = mirrorInto(x, z, ow, od);
      // (a pond's muddy shore isn't copied onto dry land, nor a cliff's rock onto gentle ground)
      if (wl !== null && t.heightAt(mx, mz) < wl + 0.45) continue;
      const g = oldPaint(mx, mz);
      if ((g === GROUND_INDEX.rock || g === GROUND_INDEX.cliff) && Math.abs(heights[k] - t.heightAt(mx, mz)) > 0.6) continue;
      paint[k] = g;
    }
  }
  return nt;
}

/** lower land along a (carried-on) river so it holds water: weight 0 leaves it, 1 carves fully */
export function carveRiver(h: number, x: number, z: number, f: { riverDist: (x: number, z: number) => number; riverWidth: number; riverDepth: number }, wl: number, weight: number) {
  if (weight <= 0) return h;
  const d = f.riverDist(x, z);
  const hw = f.riverWidth / 2;
  // the higher the land, the wider the valley the river has worn into it
  const rise = Math.max(0, h - wl);
  const valley = hw * (2.6 + Math.min(14, rise * 2.2));
  if (!(d < valley)) return h;
  const t = smoothstep(valley, hw * 1.1, d);
  const bank = t * t * (3 - 2 * t);
  const bed = d < hw ? 1 - (d / hw) * (d / hw) : 0;
  let c = lerp(h, Math.min(h, wl + 0.22), bank);
  if (d < hw) c = Math.min(c, wl - 0.15 - f.riverDepth * 0.8 * bed);
  return lerp(h, c, weight);
}
