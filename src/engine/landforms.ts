import { Noise2D, clamp, smoothstep, lerp, rng } from './util';
import { GROUND_INDEX as G } from './ground';
import { MAX_HEIGHT, MIN_HEIGHT, type GridRect, type Terrain } from './Terrain';
import type { AreaField } from './areaShape';

export type { AreaRect } from './areaShape';

/**
 * Landforms for the Build mode land tools:
 *  - ground styles: rules that choose a kind of ground from the shape of the land (rock on
 *    cliffs, snow on peaks, sand or mud at the water's edge…), per habitat;
 *  - stamps: a single landform placed at a point (hill, volcano, canyon, lake…);
 *  - area generators: a whole landscape grown inside a selected area (a box, an oval, or any
 *    shape drawn with the lasso or painted with the selection brush), built from the same stamps.
 * Every edit fades into the land around it (smooth height blends, ragged noisy rims), so new
 * landforms sit in the diorama instead of on top of it.
 */

/* ============================== helpers ============================== */
/** smooth maximum / minimum: no crease where two surfaces meet */
const smax = (a: number, b: number, k: number) => (a + b + Math.sqrt((a - b) * (a - b) + k * k)) / 2;
const smin = (a: number, b: number, k: number) => (a + b - Math.sqrt((a - b) * (a - b) + k * k)) / 2;
const dome = (r: number) => (r >= 1 ? 0 : Math.pow(Math.cos(r * Math.PI * 0.5), 2));
/** layered rock: a different kind of ground every `thick` metres of height (canyon & mesa walls) */
const band = (h: number, n: number, list: number[], thick = 0.55) => list[((Math.floor((h + 60 + n * 0.3) / thick) % list.length) + list.length) % list.length];
/** steps with steep risers: canyon terraces */
const terrace = (t: number, steps = 3) => { const s = t * steps, i = Math.floor(s); return (i + smoothstep(0.72, 1, s - i)) / steps; };

/** metres from every grid vertex to the nearest underwater vertex (chamfer distance transform) */
export function waterDistance(t: Terrain): Float32Array {
  const { nx, nz } = t;
  const INF = 1e9;
  const d = new Float32Array(nx * nz).fill(INF);
  const wl = t.waterLevel;
  if (wl === null) return d;
  for (let k = 0; k < d.length; k++) if (t.heights[k] < wl) d[k] = 0;
  const a = t.dx, b = Math.hypot(t.dx, t.dz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (i > 0) d[k] = Math.min(d[k], d[k - 1] + a);
    if (j > 0) d[k] = Math.min(d[k], d[k - nx] + a);
    if (i > 0 && j > 0) d[k] = Math.min(d[k], d[k - nx - 1] + b);
    if (i < nx - 1 && j > 0) d[k] = Math.min(d[k], d[k - nx + 1] + b);
  }
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i;
    if (i < nx - 1) d[k] = Math.min(d[k], d[k + 1] + a);
    if (j < nz - 1) d[k] = Math.min(d[k], d[k + nx] + a);
    if (i < nx - 1 && j < nz - 1) d[k] = Math.min(d[k], d[k + nx + 1] + b);
    if (i > 0 && j < nz - 1) d[k] = Math.min(d[k], d[k + nx - 1] + b);
  }
  return d;
}

/* ============================== ground styles ============================== */
export interface GroundCtx {
  x: number; z: number; h: number;
  /** metres above the landform's base (or the diorama's typical ground level) */
  above: number;
  /** 0 at the landform's foot … 1 at its top */
  rel: number;
  /** rise over run */
  slope: number;
  /** < 0: depth under water; otherwise 0.2 per metre to the nearest water (99 = no water) */
  wet: number;
  /** smooth noise, large and small scale (−1…1) */
  n1: number; n2: number;
}
export interface GroundStyle { id: string; name: string; emoji: string; pick(c: GroundCtx): number }

const steepRock = (c: GroundCtx, g: number, at = 0.9) => (c.slope > at * 1.65 ? G.cliff : c.slope > at ? G.rock : g);

export const GROUND_STYLES: GroundStyle[] = [
  { id: 'meadow', name: 'Meadow', emoji: '🌼', pick: (c) => {
    let g = c.n1 > 0.2 ? G.meadow : G.grass;
    if (c.wet < 0.25) g = c.wet < -0.1 ? G.mud : G.soil;
    return steepRock(c, g);
  } },
  { id: 'forest', name: 'Forest', emoji: '🌳', pick: (c) => {
    let g = c.n1 > 0.12 ? G.forest : c.n1 > -0.25 ? G.grass : G.meadow;
    if (c.above > 5 + c.n2) g = G.moss;
    if (c.wet < 0.2) g = c.wet < -0.2 ? G.mud : G.soil;
    return steepRock(c, g, 0.85);
  } },
  { id: 'taiga', name: 'Taiga', emoji: '🌲', pick: (c) => {
    let g = c.n1 > 0 ? G.forest : c.n1 > -0.3 ? G.moss : G.grass;
    if (c.above > 3.2 + c.n2) g = G.snow;
    if (c.wet < 0.25) g = c.wet < -0.15 ? G.gravel : G.soil;
    return steepRock(c, g, 0.8);
  } },
  { id: 'grassland', name: 'Prairie', emoji: '🌾', pick: (c) => {
    let g = c.n1 > 0.3 ? G.dry : c.n1 > -0.2 ? G.meadow : G.grass;
    if (c.wet < 0.25) g = c.wet < -0.1 ? G.mud : G.soil;
    return steepRock(c, g);
  } },
  { id: 'savanna', name: 'Savanna', emoji: '🦁', pick: (c) => {
    let g = c.n1 > 0.62 ? G.soil : G.dry;
    if (c.n2 > 0.75) g = G.grass;
    if (c.wet < 0.3) g = c.wet < -0.1 ? G.mud : G.soil;
    return steepRock(c, g);
  } },
  { id: 'rainforest', name: 'Rainforest', emoji: '🦜', pick: (c) => {
    let g = c.n1 > -0.1 ? G.jungle : G.forest;
    if (c.wet < 0.25) g = c.wet < -0.1 ? G.mud : G.soil;
    return steepRock(c, g, 1.0);
  } },
  { id: 'desert', name: 'Desert', emoji: '🌵', pick: (c) => {
    let g = c.n1 > 0.35 ? G.sand : G.redsand;
    if (c.slope > 0.65) g = band(c.h, c.n2, [G.clay, G.redsand, G.rock, G.clay, G.sand]);
    if (c.wet < 0.35) g = c.wet < -0.05 ? G.mud : (c.n2 > 0 ? G.grass : G.soil);
    return c.slope > 1.4 ? G.cliff : g;
  } },
  { id: 'badlands', name: 'Badlands', emoji: '🏜️', pick: (c) => {
    let g = c.n1 > 0.25 ? G.dry : c.n1 > -0.2 ? G.redsand : G.clay;
    if (c.slope > 0.38) g = band(c.h, c.n2, [G.clay, G.redsand, G.clay, G.sand, G.clay, G.rock]);
    else if (c.rel < 0.12 && c.slope > 0.15) g = G.scree;
    if (c.wet < 0.25) g = c.wet < -0.05 ? G.mud : G.sand;
    return g;
  } },
  { id: 'arctic', name: 'Tundra', emoji: '🐻‍❄️', pick: (c) => {
    let g = c.n1 > 0.3 ? G.moss : G.snow;
    if (c.above < 1 && c.n2 > 0.4) g = G.moss;
    if (c.wet < 0.15) g = c.wet < -0.1 ? G.gravel : G.ice;
    return steepRock(c, g);
  } },
  { id: 'wetland', name: 'Wetland', emoji: '🦩', pick: (c) => {
    let g = c.n1 > 0.15 ? G.meadow : G.grass;
    if (c.wet < 0.6) g = c.n2 > 0.1 ? G.marsh : G.mud;
    if (c.wet < -0.1) g = G.mud;
    return steepRock(c, g);
  } },
  { id: 'mountain', name: 'Mountain', emoji: '🏔️', pick: (c) => {
    let g = c.rel > 0.7 + c.n2 * 0.06 && c.above > 3 ? G.snow : c.rel > 0.42 + c.n2 * 0.06 ? G.scree : c.n1 > 0.15 ? G.forest : G.meadow;
    if (c.slope > 0.7 && g !== G.snow) g = c.slope > 1.25 ? G.cliff : G.rock;
    if (c.wet < 0.2) g = c.wet < -0.1 ? G.gravel : G.soil;
    return g;
  } },
  { id: 'volcanic', name: 'Volcanic', emoji: '🌋', pick: (c) => {
    let g = c.rel > 0.45 ? G.ash : c.n1 > 0.35 ? G.moss : c.n1 > -0.05 ? G.scree : G.ash;
    if (c.slope > 0.85) g = c.slope > 1.4 ? G.cliff : G.rock;
    if (c.wet < 0.2) g = c.wet < -0.1 ? G.ash : G.gravel;
    return g;
  } },
  { id: 'heath', name: 'Moorland', emoji: '🪻', pick: (c) => {
    let g = c.n1 > 0.1 ? G.heath : c.n1 > -0.3 ? G.moss : G.grass;
    if (c.wet < 0.3) g = c.wet < -0.1 ? G.mud : G.marsh;
    return steepRock(c, g, 0.8);
  } },
  { id: 'beach', name: 'Beach', emoji: '🏖️', pick: (c) => {
    let g = c.n1 > 0.25 ? G.dry : c.n1 > -0.1 ? G.sand : G.grass;
    if (c.wet < 0.6) g = c.n2 > 0.55 ? G.shingle : G.sand;
    if (c.wet < -0.5) g = G.sand;
    return steepRock(c, g, 0.85);
  } },
  { id: 'garden', name: 'Garden', emoji: '🏡', pick: (c) => {
    let g = c.n1 > 0.42 ? G.meadow : G.grass;
    if (c.wet < 0.2) g = G.gravel;
    return steepRock(c, g);
  } },
];
export const STYLE_BY_ID: Record<string, GroundStyle> = Object.fromEntries(GROUND_STYLES.map((s) => [s.id, s]));
/** the ground style that suits a diorama's biome */
export function styleForBiome(biome: string): GroundStyle {
  const id = ({ forest: 'forest', taiga: 'taiga', grassland: 'grassland', savanna: 'savanna', rainforest: 'rainforest', desert: 'desert', tundra: 'arctic', wetland: 'wetland', mountain: 'mountain', garden: 'garden', shore: 'beach', reef: 'beach', kelp: 'beach' } as Record<string, string>)[biome] ?? 'meadow';
  return STYLE_BY_ID[id];
}

interface PaintPass {
  style: GroundStyle;
  /** height of the landform's foot, and how tall it is (for `above` and `rel`) */
  base: number;
  H: number;
  seed: number;
  /** distances to water, if already known */
  dist?: Float32Array;
  /** 0…1 per vertex: how strongly to repaint (the edges fade out raggedly) */
  weight: (k: number, x: number, z: number) => number;
  /** a landform's own choice of ground; null falls back to the style */
  override?: (c: GroundCtx, k: number) => number | null;
}

/** paint the ground inside a grid rectangle from a style */
function paintRect(t: Terrain, r: GridRect, p: PaintPass) {
  const N = new Noise2D(p.seed * 13 + 1);
  const dist = p.dist ?? waterDistance(t);
  const wl = t.waterLevel;
  const { nx } = t;
  for (let j = r.j0; j <= r.j1; j++) for (let i = r.i0; i <= r.i1; i++) {
    const x = t.xOf(i), z = t.zOf(j), k = j * nx + i;
    const w = p.weight(k, x, z);
    if (w <= 0) continue;
    // a ragged edge: the new ground reaches further in some places than others
    if (w < 1 && w < 0.42 + 0.3 * N.noise(x * 0.9 + 7, z * 0.9)) continue;
    const h = t.heights[k];
    const hx = t.h(i + 1, j) - t.h(i - 1, j), hz = t.h(i, j + 1) - t.h(i, j - 1);
    const c: GroundCtx = {
      x, z, h, above: h - p.base, rel: p.H > 0.05 ? clamp((h - p.base) / p.H, 0, 1) : 0,
      slope: Math.hypot(hx / (2 * t.dx), hz / (2 * t.dz)),
      wet: wl === null ? 99 : h < wl ? h - wl : dist[k] * 0.2,
      n1: N.fbm(x * 0.08, z * 0.08, 3), n2: N.noise(x * 0.3, z * 0.3),
    };
    t.paint[k] = p.override?.(c, k) ?? p.style.pick(c);
  }
}

/** the typical ground level of a diorama and how far its highest point rises above it */
export function terrainLevels(t: Terrain) {
  const sorted = Float32Array.from(t.heights).sort();
  const base = sorted[Math.floor(sorted.length / 2)];
  return { base, H: Math.max(1, sorted[sorted.length - 1] - base) };
}

/** repaint a whole diorama to match its shape */
export function autoPaint(t: Terrain, style: GroundStyle, seed = 1) {
  const { base, H } = terrainLevels(t);
  paintRect(t, { i0: 0, i1: t.nx - 1, j0: 0, j1: t.nz - 1 }, { style, base, H, seed, weight: () => 1 });
}

/** paint with a style under a round brush (the ✨ Auto ground); `levels` and `dist` are worked out once per stroke */
export function autoPaintBrush(t: Terrain, style: GroundStyle, x: number, z: number, radius: number, levels: { base: number; H: number }, dist: Float32Array, seed = 1): GridRect {
  const r = t.rectFor(x - radius, z - radius, x + radius, z + radius);
  paintRect(t, r, { style, base: levels.base, H: levels.H, seed, dist, weight: (_k, px, pz) => {
    const d = Math.hypot(px - x, pz - z) / radius;
    return d > 1 ? 0 : d < 0.7 ? 1 : 1 - (d - 0.7) / 0.3;
  } });
  return r;
}

/* ============================== stamps ============================== */
export interface StampCtx {
  /** footprint coordinates: u along the landform, v across; the rim is at r = 1 */
  u: number; v: number; r: number;
  /** ground height before the stamp, and the average height around the footprint's rim */
  h0: number; base: number;
  /** the stamp's height (or depth) in metres */
  H: number;
  /** water level (the stamp may have just created it) */
  wl: number;
  /** smooth noise (−1…1) and ridged noise (0…1) at this spot */
  n: number; ridge: number;
}
export interface StampDef {
  id: string;
  name: string;
  emoji: string;
  hint: string;
  /** default footprint radius (m) and height (m) on a 40 m-wide diorama */
  radius: number;
  height: number;
  maxHeight: number;
  /** length ÷ width: stretched landforms can be turned */
  aspect?: number;
  /** creates water if the diorama has none */
  water?: boolean;
  /** how far beyond the rim (r = 1) the landform reaches */
  reach?: number;
  shape(c: StampCtx): number;
  ground?(c: GroundCtx & StampCtx, style: GroundStyle): number | null;
}

export const STAMPS: StampDef[] = [
  {
    id: 'hill', name: 'Hill', emoji: '🟢', hint: 'A smooth, rounded hill', radius: 4, height: 2, maxHeight: 10,
    shape: (c) => c.h0 + c.H * dome(c.r) * (0.92 + 0.08 * c.n),
    ground: (c) => (c.slope > 1 ? G.rock : null),
  },
  {
    id: 'mountain', name: 'Mountain', emoji: '🏔️', hint: 'A rocky peak — snow-capped when tall', radius: 6, height: 7, maxHeight: 22,
    shape: (c) => {
      const peak = Math.pow(Math.max(0, 1 - c.r), 1.45) * (0.68 + 0.42 * c.ridge) + 0.05 * c.n * (1 - c.r);
      return smax(c.h0, c.base + c.H * Math.max(0, peak), 0.35);
    },
    ground: (c) => {
      if (c.H > 3.2 && c.rel > 0.7 + c.n2 * 0.06 && c.slope < 1.4) return G.snow;
      if (c.slope > 1.25) return G.cliff;
      if (c.slope > 0.62) return G.rock;
      if (c.rel > 0.38) return G.scree;
      if (c.rel > 0.16 && c.slope > 0.32) return c.n2 > 0 ? G.scree : G.rock;
      return null;
    },
  },
  {
    id: 'volcano', name: 'Volcano', emoji: '🌋', hint: 'A cone of ash with a crater on top', radius: 6, height: 6, maxHeight: 20,
    shape: (c) => {
      const rc = 0.2;
      let p: number;
      if (c.r < rc) p = 1 - 0.32 * (1 - (c.r / rc) * (c.r / rc));
      else p = Math.pow(Math.max(0, 1 - c.r) / (1 - rc), 1.3);
      p *= 1 + 0.07 * c.n * Math.min(1, c.r * 3);
      return smax(c.h0, c.base + c.H * p, 0.3);
    },
    ground: (c) => {
      if (c.r < 0.2) return c.n2 > 0.3 ? G.cliff : G.ash;
      if (c.slope > 1.3) return G.cliff;
      if (c.rel > 0.5) return G.ash;
      if (c.rel > 0.18) return c.n2 > 0.2 ? G.scree : G.ash;
      return c.rel > 0.04 ? (c.n1 > 0 ? G.scree : null) : null;
    },
  },
  {
    id: 'mesa', name: 'Mesa', emoji: '🟫', hint: 'A flat-topped hill with layered cliffs', radius: 5, height: 3.5, maxHeight: 14,
    shape: (c) => {
      const wall = 1 - smoothstep(0.6, 0.76, c.r + c.n * 0.04);
      const apron = 0.2 * smoothstep(1.0, 0.72, c.r);
      return smax(c.h0, c.base + c.H * Math.max(wall * (0.98 + 0.02 * c.n), apron), 0.2);
    },
    ground: (c, style) => {
      if (c.slope > 0.55) return band(c.h, c.n2, [G.clay, G.redsand, G.clay, G.sand, G.rock]);
      if (c.rel > 0.9) return style.id === 'desert' || style.id === 'badlands' ? (c.n1 > 0.2 ? G.dry : G.redsand) : null;
      if (c.rel > 0.04 && c.r > 0.7) return G.scree;
      return null;
    },
  },
  {
    id: 'plateau', name: 'Plateau', emoji: '🟩', hint: 'High, flat land with cliff edges', radius: 7, height: 2.5, maxHeight: 12,
    shape: (c) => {
      const top = 1 - smoothstep(0.72, 0.92, c.r + c.n * 0.05);
      return smax(c.h0, c.base + c.H * top + 0.12 * c.n * top, 0.25);
    },
    ground: (c) => (c.slope > 1.2 ? G.cliff : c.slope > 0.6 ? G.rock : null),
  },
  {
    id: 'ridge', name: 'Ridge', emoji: '〰️', hint: 'A long mountain ridge — drag to point it', radius: 4, height: 4.5, maxHeight: 18, aspect: 3,
    shape: (c) => {
      const along = Math.pow(Math.max(0, 1 - c.u * c.u), 0.7);
      const across = Math.pow(Math.max(0, 1 - Math.abs(c.v)), 1.6);
      return smax(c.h0, c.base + c.H * along * across * (0.68 + 0.45 * c.ridge), 0.3);
    },
    ground: (c) => {
      if (c.H > 3.5 && c.rel > 0.78 && c.slope < 1.3) return G.snow;
      if (c.slope > 1.2) return G.cliff;
      if (c.slope > 0.6) return G.rock;
      if (c.rel > 0.4) return G.scree;
      return null;
    },
  },
  {
    id: 'cliff', name: 'Cliff', emoji: '🧗', hint: 'A raised shelf with a steep cliff face', radius: 5, height: 3, maxHeight: 14, aspect: 1.8,
    shape: (c) => {
      const face = smoothstep(0.1, -0.1, c.v + 0.12 * c.n);
      const back = smoothstep(-1.0, -0.7, c.v);
      const ends = 1 - smoothstep(0.65, 1.0, Math.abs(c.u));
      return c.h0 + c.H * face * back * ends;
    },
    ground: (c) => (c.slope > 1.1 ? G.cliff : c.slope > 0.5 ? G.rock : c.v > 0 && c.v < 0.35 && c.rel < 0.15 && c.n2 > -0.3 ? G.scree : null),
  },
  {
    id: 'canyon', name: 'Canyon', emoji: '🏜️', hint: 'A deep gorge with terraced walls', radius: 4, height: 3, maxHeight: 12, aspect: 3.5,
    shape: (c) => {
      const av = Math.abs(c.v + 0.08 * c.n);
      const floor = 0.2, rim = 0.55;
      const prof = av < floor ? 1 : av < rim ? terrace(1 - (av - floor) / (rim - floor)) : 0;
      const ends = 1 - smoothstep(0.75, 1.0, Math.abs(c.u));
      return c.h0 - c.H * prof * ends;
    },
    ground: (c) => {
      if (c.rel < -0.02 && c.slope > 0.45) return band(c.h, c.n2, [G.clay, G.redsand, G.rock, G.clay, G.sand]);
      if (c.rel < -0.85) return c.n2 > 0.2 ? G.gravel : G.sand;
      return null;
    },
  },
  {
    id: 'valley', name: 'Valley', emoji: '🏞️', hint: 'A wide, gentle valley — drag to point it', radius: 5, height: 2, maxHeight: 10, aspect: 2.5,
    shape: (c) => {
      const across = dome(Math.abs(c.v));
      const along = Math.max(0, 1 - Math.pow(Math.abs(c.u), 3));
      return c.h0 - c.H * across * along;
    },
  },
  {
    id: 'crater', name: 'Crater', emoji: '🕳️', hint: 'A bowl with a raised rim', radius: 3.5, height: 1.8, maxHeight: 8,
    shape: (c) => {
      const bowl = c.r < 0.72 ? -0.62 * (1 - (c.r / 0.72) * (c.r / 0.72)) : 0;
      const rim = 0.38 * Math.exp(-Math.pow((c.r - 0.76) / 0.13, 2));
      return c.h0 + c.H * (bowl + rim * (0.85 + 0.15 * c.n));
    },
    ground: (c) => (c.r < 0.7 ? (c.n2 > 0.1 ? G.scree : G.gravel) : c.r < 0.95 && c.slope > 0.3 ? (c.n2 > -0.2 ? G.rock : G.scree) : null),
  },
  {
    id: 'lake', name: 'Lake', emoji: '💧', hint: 'Dig a lake with gentle shores (adds water)', radius: 4.5, height: 1.4, maxHeight: 6, water: true, reach: 1.3,
    shape: (c) => {
      const wob = c.r + 0.06 * c.n;
      const bed = c.wl - c.H * Math.pow(Math.max(0, 1 - (wob / 0.85) * (wob / 0.85)), 0.75);
      const bank = c.wl + 0.06 + Math.max(0, wob - 0.85) * 0.9;
      return smin(c.h0, wob < 0.85 ? Math.min(bed, c.wl - 0.04) : bank, 0.12);
    },
    ground: (c, style) => {
      if (c.wet < -0.04) return style.id === 'arctic' || style.id === 'taiga' || style.id === 'mountain' ? G.gravel : c.wet < -0.6 ? G.mud : G.sand;
      if (c.wet < 0.12) return style.id === 'wetland' ? G.marsh : style.id === 'desert' || style.id === 'beach' ? G.sand : style.id === 'arctic' ? G.ice : style.id === 'mountain' || style.id === 'taiga' ? G.gravel : G.mud;
      return null;
    },
  },
  {
    id: 'island', name: 'Island', emoji: '🏝️', hint: 'Land surrounded by water (adds water)', radius: 5, height: 1.5, maxHeight: 8, water: true, reach: 1.2,
    shape: (c) => {
      // open water all around, and land rising out of it in the middle
      const sea = c.wl - 0.9 * smoothstep(1.15, 0.85, c.r);
      const land = c.wl - 0.9 + (c.H + 0.9) * Math.pow(dome(c.r / 0.62), 0.8) * (0.9 + 0.1 * c.n);
      return lerp(c.h0, Math.max(land, sea), smoothstep(1.2, 0.95, c.r));
    },
    ground: (c, style) => {
      if (c.wet < -0.05) return G.sand;
      if (c.above < 0.35) return c.n2 > 0.6 ? G.shingle : G.sand;
      return style.id === 'rainforest' || style.id === 'beach' ? (c.n1 > -0.2 ? G.jungle : G.grass) : style.pick(c);
    },
  },
  {
    id: 'dune', name: 'Dune', emoji: '🐪', hint: 'A crescent sand dune — drag to set the wind', radius: 3.5, height: 1.5, maxHeight: 6, aspect: 1.6,
    shape: (c) => {
      const crest = 0.25 + 0.5 * c.v * c.v;
      const along = c.u < crest ? Math.pow(smoothstep(-1, crest, c.u), 1.3) : 1 - smoothstep(crest, crest + 0.35, c.u);
      const across = dome(Math.abs(c.v));
      return c.h0 + c.H * along * across * (0.9 + 0.1 * c.n);
    },
    ground: (c, style) => (c.rel > 0.04 ? (style.id === 'desert' || style.id === 'badlands' ? G.redsand : G.sand) : null),
  },
];
export const STAMP_BY_ID: Record<string, StampDef> = Object.fromEntries(STAMPS.map((s) => [s.id, s]));

export interface StampOpts { id: string; x: number; z: number; radius: number; height: number; angle: number; paint: boolean; style: GroundStyle; seed: number }

/** footprint geometry shared by stamping and its preview */
function footprint(d: StampDef, o: StampOpts) {
  const aspect = d.aspect ?? 1;
  const ru = o.radius * aspect, rv = o.radius;
  const reach = d.reach ?? 1;
  const ext = Math.max(ru, rv) * reach * 1.1;
  const cos = Math.cos(o.angle), sin = Math.sin(o.angle);
  return { aspect, ru, rv, reach, ext, cos, sin };
}

/** average ground height around a stamp's rim: where the landform sits */
export function stampBase(t: Terrain, d: StampDef, o: StampOpts) {
  const f = footprint(d, o);
  let s = 0;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const lu = Math.cos(a) * f.ru, lv = Math.sin(a) * f.rv;
    s += t.heightAt(o.x + lu * f.cos - lv * f.sin, o.z + lu * f.sin + lv * f.cos);
  }
  return s / 24;
}

/**
 * The level for a diorama's first water: just below the rim of the new lake (or river, marsh…).
 * The diorama has one water level, so deep hollows elsewhere fill up too, like a real water
 * table; but if that would drown much of the land, the water settles lower instead.
 */
export function newWaterLevel(t: Terrain, wanted: number, inside: (x: number, z: number) => boolean) {
  const hs: number[] = [];
  for (let j = 0; j < t.nz; j += 2) for (let i = 0; i < t.nx; i += 2) {
    if (inside(t.xOf(i), t.zOf(j))) continue;
    hs.push(t.heights[j * t.nx + i]);
  }
  if (!hs.length) return wanted;
  let flooded = 0;
  for (const h of hs) if (h < wanted) flooded++;
  if (flooded <= hs.length * 0.1) return wanted;
  hs.sort((a, b) => a - b);
  return Math.min(wanted, hs[Math.floor(hs.length * 0.02)] - 0.05);
}

/** a water level for a lake or island stamp on a diorama without water */
export function waterForStamp(t: Terrain, d: StampDef, o: StampOpts) {
  if (t.waterLevel !== null || !d.water) return t.waterLevel;
  const f = footprint(d, o);
  return newWaterLevel(t, stampBase(t, d, o) - 0.12, (x, z) => Math.hypot(x - o.x, z - o.z) < f.ext * 1.1);
}

function stampCtxFactory(d: StampDef, o: StampOpts, base: number, wl: number) {
  const f = footprint(d, o);
  const N = new Noise2D(o.seed * 31 + 7);
  return (x: number, z: number, h0: number): StampCtx | null => {
    const dx = x - o.x, dz = z - o.z;
    const lu = dx * f.cos + dz * f.sin, lv = -dx * f.sin + dz * f.cos;
    const u = lu / f.ru, v = lv / f.rv;
    // an organic, lumpy outline rather than a perfect circle
    const ang = Math.atan2(v, u);
    const wob = 1 + 0.09 * N.noise(Math.cos(ang) * 1.3 + 5, Math.sin(ang) * 1.3 + 5);
    const r = Math.hypot(u, v) / wob;
    if (r > f.reach * 1.05) return null;
    const sc = 1.6 / Math.max(1.5, Math.min(f.ru, f.rv));
    return { u, v, r, h0, base, H: o.height, wl, n: N.fbm(x * 0.35, z * 0.35, 3), ridge: clamp(N.ridged(lu * sc * 0.7 + 11, lv * sc * 0.7 + 3, 4) * 1.5, 0, 1) };
  };
}

/** apply a stamp to the terrain; returns the grid rectangle it changed and the water level it needs */
export function applyStamp(t: Terrain, o: StampOpts): { rect: GridRect; waterLevel: number | null } {
  const d = STAMP_BY_ID[o.id];
  const f = footprint(d, o);
  const wl = waterForStamp(t, d, o);
  if (wl !== t.waterLevel) t.setWaterLevel(wl, false);
  const base = stampBase(t, d, o);
  const ctxAt = stampCtxFactory(d, o, base, wl ?? base - 0.12);
  const rect = t.rectFor(o.x - f.ext, o.z - f.ext, o.x + f.ext, o.z + f.ext);
  const { nx } = t;
  const ctxs: (StampCtx | null)[] = [];
  for (let j = rect.j0; j <= rect.j1; j++) for (let i = rect.i0; i <= rect.i1; i++) {
    const k = j * nx + i;
    const c = ctxAt(t.xOf(i), t.zOf(j), t.heights[k]);
    ctxs.push(c);
    if (!c) continue;
    let h = d.shape(c);
    // fade into the surrounding land at the very edge of the footprint
    h = lerp(c.h0, h, smoothstep(f.reach * 1.05, f.reach * 0.9, c.r));
    t.heights[k] = clamp(h, MIN_HEIGHT, MAX_HEIGHT);
  }
  if (o.paint && d.ground) {
    let q = 0;
    const byKey = new Map<number, StampCtx>();
    for (let j = rect.j0; j <= rect.j1; j++) for (let i = rect.i0; i <= rect.i1; i++) { const c = ctxs[q++]; if (c) byKey.set(j * nx + i, c); }
    const H = Math.max(0.1, Math.abs(o.height));
    const digs = d.id === 'canyon' || d.id === 'valley';
    paintRect(t, rect, {
      style: o.style, base, H, seed: o.seed,
      weight: (k) => { const c = byKey.get(k); return c ? smoothstep(f.reach, f.reach * 0.82, c.r) : 0; },
      // landforms that dig get a negative `rel`: −1 at the bottom of the canyon
      override: (g, k) => { const c = byKey.get(k)!; const rel = (g.h - base) / H; return d.ground!({ ...g, ...c, rel: digs ? Math.min(0, rel) : clamp(rel, 0, 1) }, o.style) ?? t.paint[k]; },
    });
  }
  return { rect, waterLevel: wl };
}

/**
 * The surface a stamp would make, on a small grid over its footprint (for the see-through
 * preview). Each vertex: x, new height, z, and how much the height changes.
 */
export function previewStamp(t: Terrain, o: StampOpts, res = 44) {
  const d = STAMP_BY_ID[o.id];
  const f = footprint(d, o);
  const wl = waterForStamp(t, d, o);
  const base = stampBase(t, d, o);
  const ctxAt = stampCtxFactory(d, o, base, wl ?? base - 0.12);
  const pos = new Float32Array(res * res * 3), delta = new Float32Array(res * res);
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const x = clamp(o.x - f.ext + (2 * f.ext * i) / (res - 1), -t.width / 2, t.width / 2);
    const z = clamp(o.z - f.ext + (2 * f.ext * j) / (res - 1), -t.depth / 2, t.depth / 2);
    const h0 = t.heightAt(x, z);
    const c = ctxAt(x, z, h0);
    let h = h0;
    if (c) h = clamp(lerp(c.h0, d.shape(c), smoothstep(f.reach * 1.05, f.reach * 0.9, c.r)), MIN_HEIGHT, MAX_HEIGHT);
    const k = j * res + i;
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    delta[k] = h - h0;
  }
  return { pos, delta, res, waterLevel: wl };
}

/* ============================== area generation ============================== */
export type AreaKind = 'mountains' | 'hills' | 'plains' | 'dunes' | 'canyons' | 'mesas' | 'volcanic' | 'lake' | 'river' | 'marsh' | 'islands' | 'coast';
export interface AreaKindDef {
  id: AreaKind; name: string; emoji: string; hint: string;
  /** default ground style ('biome' = the diorama's own) */
  style: string;
  /** with ✨ Suits the landform, only the landforms are painted (as stamps do); the rest of the ground stays as it is */
  keep?: boolean;
  water?: boolean;
  /** default relief (m) for an area whose widest part is `s` metres across */
  relief(s: number): number;
}
export const AREA_KINDS: AreaKindDef[] = [
  { id: 'mountains', name: 'Mountains', emoji: '🏔️', hint: 'A range of rocky peaks', style: 'mountain', keep: true, relief: (s) => clamp(s * 0.5, 2.5, 18) },
  { id: 'hills', name: 'Hills', emoji: '⛰️', hint: 'Soft rolling hills', style: 'biome', keep: true, relief: (s) => clamp(s * 0.13, 0.8, 5) },
  { id: 'plains', name: 'Plains', emoji: '🌾', hint: 'Flat, open ground', style: 'biome', relief: () => 0.35 },
  { id: 'dunes', name: 'Dunes', emoji: '🐪', hint: 'A field of crescent sand dunes', style: 'desert', relief: (s) => clamp(s * 0.11, 1, 3.5) },
  { id: 'canyons', name: 'Canyon', emoji: '🏜️', hint: 'A winding gorge with layered walls, along the area', style: 'badlands', keep: true, relief: (s) => clamp(s * 0.14, 1.5, 7) },
  { id: 'mesas', name: 'Mesas', emoji: '🟫', hint: 'Flat-topped buttes', style: 'badlands', keep: true, relief: (s) => clamp(s * 0.25, 1.5, 9) },
  { id: 'volcanic', name: 'Volcanoes', emoji: '🌋', hint: 'A volcano and cinder cones', style: 'volcanic', keep: true, relief: (s) => clamp(s * 0.45, 2.5, 16) },
  { id: 'lake', name: 'Lake', emoji: '💧', hint: 'A lake filling the area', style: 'biome', water: true, relief: (s) => clamp(s * 0.06, 0.8, 3) },
  { id: 'river', name: 'River', emoji: '🏞️', hint: 'A winding river along the area', style: 'biome', water: true, relief: (s) => clamp(s * 0.05, 0.6, 2) },
  { id: 'marsh', name: 'Marsh', emoji: '🦩', hint: 'Soggy ground with pools and reeds', style: 'wetland', water: true, relief: () => 0.3 },
  { id: 'islands', name: 'Islands', emoji: '🏝️', hint: 'Islands in open water', style: 'beach', water: true, relief: (s) => clamp(s * 0.06, 0.8, 3) },
  { id: 'coast', name: 'Coast', emoji: '🌊', hint: 'A beach sloping into the sea', style: 'beach', water: true, relief: (s) => clamp(s * 0.05, 0.6, 2) },
];
export const AREA_BY_ID: Record<string, AreaKindDef> = Object.fromEntries(AREA_KINDS.map((a) => [a.id, a]));

export interface AreaOpts {
  kind: AreaKind;
  /** the selected area: its outline (as a distance) and size */
  field: AreaField;
  /** width (m) of the soft edge */
  feather: number;
  /** relief in metres */
  height: number;
  /** 0 smooth … 1 rugged */
  rough: number;
  style: GroundStyle;
  /** paint only what the landforms' own rules paint, keeping the rest of the ground (see AreaKindDef.keep) */
  keepGround?: boolean;
  seed: number;
  paint: boolean;
}

/** 0 outside the area, rising through the soft, slightly wobbly edge to 1 inside */
export function areaMask(o: Pick<AreaOpts, 'field' | 'feather' | 'seed'>) {
  const N = new Noise2D(o.seed * 5 + 3);
  const fe = Math.max(0.2, o.feather);
  const sd = o.field.sd;
  return (x: number, z: number) => smoothstep(0, fe, -(sd(x, z) + N.fbm(x * 0.12, z * 0.12, 3) * fe * 0.8));
}

/** grid vertices an area (and its soft edge) can change */
function areaGridRect(t: Terrain, o: Pick<AreaOpts, 'field' | 'feather'>) {
  const r = o.field.rect, pad = o.feather * 0.6;
  return t.rectFor(r.minX - pad, r.minZ - pad, r.maxX + pad, r.maxZ + pad);
}

/** repaint an area from a ground style without changing its shape */
export function repaintArea(t: Terrain, style: GroundStyle, o: Pick<AreaOpts, 'field' | 'feather' | 'seed'>): GridRect {
  const mask = areaMask(o);
  const rect = areaGridRect(t, o);
  const { base, H } = terrainLevels(t);
  paintRect(t, rect, { style, base, H, seed: o.seed, weight: (_k, x, z) => mask(x, z) });
  return rect;
}

/** the water level an area generator needs */
function areaWater(t: Terrain, o: AreaOpts, base: number) {
  if (t.waterLevel !== null) return t.waterLevel;
  return newWaterLevel(t, base - (o.kind === 'coast' || o.kind === 'islands' ? 0.25 : 0.12), (x, z) => o.field.sd(x, z) < o.feather);
}

/** the average height of the land along the area's outline: where its new landforms stand */
function outlineHeight(t: Terrain, F: AreaField, rect: GridRect) {
  const band = 1.5 * Math.max(t.dx, t.dz);
  let s = 0, n = 0, si = 0, ni = 0;
  for (let j = rect.j0; j <= rect.j1; j++) for (let i = rect.i0; i <= rect.i1; i++) {
    const h = t.heights[j * t.nx + i], d = F.sd(t.xOf(i), t.zOf(j));
    if (Math.abs(d) < band) { s += h; n++; } else if (d < 0) { si += h; ni++; }
  }
  return n ? s / n : ni ? si / ni : 0;
}

/* ---------- laying out landforms inside an area ---------- */
interface Spot { x: number; z: number; room: number }
interface Disc { x: number; z: number; r: number }

/** points spread over the area, each with the radius of the biggest circle around it that stays inside the area and the diorama */
function areaSpots(t: Terrain, F: AreaField, R: () => number, n = 1400): Spot[] {
  const B = F.rect, w = B.maxX - B.minX, d = B.maxZ - B.minZ;
  const cs = Math.max(0.2, Math.sqrt((w * d) / n));
  const spots: Spot[] = [];
  for (let z = B.minZ + cs / 2; z < B.maxZ; z += cs) for (let x = B.minX + cs / 2; x < B.maxX; x += cs) {
    const px = x + (R() - 0.5) * cs * 0.9, pz = z + (R() - 0.5) * cs * 0.9;
    const room = Math.min(-F.sd(px, pz), t.width / 2 - Math.abs(px), t.depth / 2 - Math.abs(pz));
    if (room > 0.05) spots.push({ x: px, z: pz, room });
  }
  return spots;
}

interface PackOpts {
  /** radius of the first (biggest) landform */
  first: number;
  /** the smallest worth adding after it */
  min: number;
  /** centres stay at least sep × (r1 + r2) apart: below 1 the landforms overlap */
  sep: number;
  count: number;
  /** the size of each later landform, at most this range of fractions of the first */
  next: [number, number];
  /** how far a footprint may reach toward the outline (× room) */
  fit?: number;
  /** ground already taken */
  avoid?: Disc[];
}
/** place landforms one by one where there is the most room left (with a little chance, so every variation differs) */
function pack(spots: Spot[], R: () => number, o: PackOpts): Disc[] {
  const fit = o.fit ?? 1;
  const out: Disc[] = [], taken: Disc[] = [...(o.avoid ?? [])];
  for (let n = 0; n < o.count; n++) {
    const cap = n === 0 ? o.first : Math.max(o.min, o.first * lerp(o.next[0], o.next[1], R()));
    const min = n === 0 ? 0 : o.min;
    let best: Spot | null = null, bestRoom = 0, bestScore = -1;
    for (const s of spots) {
      let room = s.room * fit;
      if (room <= min) continue;
      for (const f of taken) {
        const v = Math.hypot(s.x - f.x, s.z - f.z) / o.sep - f.r;
        if (v < room) { room = v; if (room <= min) break; }
      }
      if (room <= min) continue;
      const score = Math.min(room, cap) * (n === 0 ? 0.92 + 0.16 * R() : 0.7 + 0.6 * R());
      if (score > bestScore) { bestScore = score; best = s; bestRoom = room; }
    }
    if (!best) break;
    // (never smaller than the smallest allowed: there is room for that here)
    const f = { x: best.x, z: best.z, r: n === 0 ? Math.min(bestRoom, cap) : Math.max(min, Math.min(bestRoom, cap) * (0.9 + 0.1 * R())) };
    out.push(f);
    taken.push(f);
  }
  return out;
}

/** a landform stamp placed by an area generator */
interface Feature {
  id: string; x: number; z: number; r: number; h: number; angle: number; seed: number;
  /** stands on the landforms placed before it (cinder cones on a volcano's flank) rather than on the land as it was */
  perch?: boolean;
  /** a shape of its own instead of the stamp's (islands rise straight from the lagoon floor) */
  shape?: (c: StampCtx) => number;
  base?: number;
  ctxAt?: (x: number, z: number, h0: number) => StampCtx | null;
}
const featureOpts = (f: Feature, style: GroundStyle): StampOpts => ({ id: f.id, x: f.x, z: f.z, radius: f.r, height: f.h, angle: f.angle, paint: false, style, seed: f.seed });

/**
 * Stamp each landform into the land, exactly as the Landforms tool would (`union` and `add`
 * follow the stamps' own rules; `max` never lowers what is there). Each vertex remembers the
 * landform that shaped it most, so it can be painted with that landform's own ground.
 */
function stampFeatures(t: Terrain, rect: GridRect, feats: Feature[], wl: number, mode: 'union' | 'add' | 'max', owner: Int16Array, gain: Float32Array, style: GroundStyle, smooth: number) {
  const { nx } = t;
  // most landforms stand on the land as it was (overlapping ones don't stack up)
  for (const f of feats) if (!f.perch) f.base = stampBase(t, STAMP_BY_ID[f.id], featureOpts(f, style));
  feats.forEach((f, fi) => {
    const d = STAMP_BY_ID[f.id], shape = f.shape ?? d.shape;
    const so = featureOpts(f, style);
    const fp = footprint(d, so);
    if (f.base === undefined) f.base = stampBase(t, d, so);
    const ctxAt = stampCtxFactory(d, so, f.base, wl);
    // smooth areas: rounder landforms with fewer crags
    f.ctxAt = smooth < 1 ? (x, z, h0) => { const c = ctxAt(x, z, h0); if (c) { c.ridge = lerp(0.55, c.ridge, smooth); c.n *= smooth; } return c; } : ctxAt;
    const r = t.rectFor(f.x - fp.ext, f.z - fp.ext, f.x + fp.ext, f.z + fp.ext);
    const i0 = Math.max(r.i0, rect.i0), i1 = Math.min(r.i1, rect.i1), j0 = Math.max(r.j0, rect.j0), j1 = Math.min(r.j1, rect.j1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * nx + i, h = t.heights[k];
      const c = f.ctxAt(t.xOf(i), t.zOf(j), h);
      if (!c) continue;
      let nh = lerp(h, shape(c), smoothstep(fp.reach * 1.05, fp.reach * 0.9, c.r));
      if (mode === 'max' && nh < h) nh = h;
      const up = nh - h;
      if (up > 0.03 && (mode !== 'add' || up > gain[k])) { owner[k] = fi; gain[k] = up; }
      t.heights[k] = nh;
    }
  });
}

/** ground for vertices shaped by a landform: the stamp's own rules (snowy peaks, ash cones, layered mesa walls…) */
function featureGround(t: Terrain, feats: Feature[], owner: Int16Array, style: GroundStyle, rangeH: number | null, keep: boolean) {
  const rest = (k: number) => (keep ? t.paint[k] : null);
  return (g: GroundCtx, k: number): number | null => {
    const fi = owner[k];
    if (fi < 0) return rest(k);
    const f = feats[fi], d = STAMP_BY_ID[f.id];
    const c = d.ground && f.ctxAt ? f.ctxAt(g.x, g.z, g.h) : null;
    if (!c) return rest(k);
    // a mountain range shares one snow line; other landforms are painted by their own height
    const H = rangeH ?? Math.max(0.1, f.h);
    return d.ground!({ ...g, ...c, H: rangeH ?? c.H, rel: clamp((g.h - (f.base ?? 0)) / H, 0, 1) }, style) ?? rest(k);
  };
}

/* ---------- a line along an area (rivers and canyons follow it) ---------- */
interface PathPt { x: number; z: number; half: number }

/** a line through the middle of the area along its length */
function areaSpine(t: Terrain, F: AreaField, spots: Spot[], R: () => number): PathPt[] {
  return F.convex ? sliceSpine(t, F, spots, R) : freeSpine(t, F);
}

/**
 * For a box or oval: across each slice of the area's main direction, the middle of the piece of
 * area that carries the line on. A box gets its centre line, from the middle of one end to the other.
 */
function sliceSpine(t: Terrain, F: AreaField, spots: Spot[], R: () => number): PathPt[] {
  if (spots.length < 3) return [];
  let mx = 0, mz = 0;
  for (const s of spots) { mx += s.x; mz += s.z; }
  mx /= spots.length; mz /= spots.length;
  let cxx = 0, czz = 0, cxz = 0;
  for (const s of spots) { const a = s.x - mx, b = s.z - mz; cxx += a * a; czz += b * b; cxz += a * b; }
  const tr = cxx + czz, det = cxx * czz - cxz * cxz;
  const l1 = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det)), l2 = tr - l1;
  // the main direction (a nearly round area can go any way: each variation picks one)
  const ang = l1 < l2 * 1.3 ? R() * Math.PI : 0.5 * Math.atan2(2 * cxz, cxx - czz);
  const ax = Math.cos(ang), az = Math.sin(ang), qx = -az, qz = ax;
  let a0 = Infinity, a1 = -Infinity, c0 = Infinity, c1 = -Infinity;
  for (const s of spots) {
    const a = (s.x - mx) * ax + (s.z - mz) * az, c = (s.x - mx) * qx + (s.z - mz) * qz;
    a0 = Math.min(a0, a); a1 = Math.max(a1, a); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
  }
  const step = Math.max(0.25, (a1 - a0) / 90), cs = Math.max(0.1, step / 2);
  const inside = (x: number, z: number) => Math.abs(x) <= t.width / 2 && Math.abs(z) <= t.depth / 2 && F.sd(x, z) < 0;
  const out: PathPt[] = [], runs: PathPt[][] = [];
  let prev: number | null = null;
  for (let a = a0; a <= a1 + 1e-6; a += step) {
    let best: { c: number; half: number } | null = null;
    let start: number | null = null;
    for (let c = c0 - cs * 2; ; c += cs) {
      // past the far side everything counts as outside, so a piece still open there gets closed
      const done = c > c1 + cs * 2;
      const isIn = !done && inside(mx + ax * a + qx * c, mz + az * a + qz * c);
      if (isIn && start === null) start = c;
      if (!isIn && start !== null) {
        const mid = (start + c - cs) / 2, half = (c - start) / 2;
        // the piece nearest the line so far (or the widest, to begin with)
        const better = !best || (prev === null ? half > best.half : Math.abs(mid - prev) < Math.abs(best.c - prev));
        if (better) best = { c: mid, half };
        start = null;
      }
      if (done) break;
    }
    if (!best) continue;
    // where the area splits into lobes and the line would leap from one to another, start a new run
    if (prev !== null && Math.abs(best.c - prev) > Math.max(1, step * 3)) runs.push(out.splice(0));
    prev = best.c;
    out.push({ x: mx + ax * a + qx * best.c, z: mz + az * a + qz * best.c, half: best.half });
  }
  // the line follows the longest unbroken run
  runs.push(out);
  const span = (r: PathPt[]) => (r.length < 2 ? 0 : Math.hypot(r[r.length - 1].x - r[0].x, r[r.length - 1].z - r[0].z));
  const run = runs.reduce((a, b) => (span(b) > span(a) ? b : a));
  // smooth out the steps of the slices
  return run.map((_, i) => {
    let x = 0, z = 0, h = 0, n = 0;
    for (let k = Math.max(0, i - 3); k <= Math.min(run.length - 1, i + 3); k++) { x += run[k].x; z += run[k].z; h += run[k].half; n++; }
    return { x: x / n, z: z / n, half: h / n };
  });
}

/** a binary min-heap of grid cells by cost (for the shortest paths through a free shape) */
class CellHeap {
  private k: number[] = [];
  private v: number[] = [];
  /** the cost of the cell `pop` returned */
  cost = 0;
  get size() { return this.k.length; }
  push(key: number, val: number) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (v[p] <= val) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = k[0];
    this.cost = v[0];
    const lk = k.pop()!, lv = v.pop()!;
    const n = k.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && v[c + 1] < v[c]) c++;
        if (v[c] >= lv) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

/**
 * For a free shape (a band painted in a curve, a blob drawn with the lasso): from one far end to
 * the other along its middle. The two ends are the points farthest apart travelling inside the
 * shape; the line between them is the shortest path when walking near the outline costs more,
 * so it keeps to the middle and follows every bend.
 */
function freeSpine(t: Terrain, F: AreaField): PathPt[] {
  const B = F.rect;
  const w = B.maxX - B.minX, d = B.maxZ - B.minZ;
  const c = Math.max(t.dx, Math.sqrt((w * d) / 30000));
  const nx = Math.ceil(w / c) + 3, nz = Math.ceil(d / c) + 3, n = nx * nz;
  const x0 = B.minX - c, z0 = B.minZ - c;
  // how deep inside the shape (and the diorama) each cell is; 0 outside
  const D = new Float32Array(n);
  let pole = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * c, z = z0 + j * c, k = j * nx + i;
    const dd = Math.abs(x) <= t.width / 2 && Math.abs(z) <= t.depth / 2 ? -F.sd(x, z) : 0;
    D[k] = dd > 0 ? dd : 0;
    if (D[k] > D[pole]) pole = k;
  }
  if (D[pole] <= 0) return [];
  // (doubles, like the heap: rounding a cost would make the search skip cells)
  const cost = new Float64Array(n), from = new Int32Array(n);
  const heap = new CellHeap();
  const NB: [number, number, number][] = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  /** shortest paths from a cell (centred: steps near the outline cost more); returns the farthest cell */
  const walk = (src: number, centred: boolean) => {
    cost.fill(Infinity); from.fill(-1);
    cost[src] = 0;
    heap.push(src, 0);
    let far = src;
    while (heap.size) {
      const k = heap.pop(), ck = heap.cost;
      if (ck > cost[k]) continue;
      if (ck > cost[far]) far = k;
      const i = k % nx, j = (k - i) / nx;
      for (const [di, dj, len] of NB) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const q = jj * nx + ii;
        if (D[q] <= 0) continue;
        const step = len * c * (centred ? 1 / (Math.min(D[q], D[k]) + c) : 1);
        if (ck + step < cost[q]) { cost[q] = ck + step; from[q] = k; heap.push(q, ck + step); }
      }
    }
    return far;
  };
  const a = walk(walk(pole, false), false);
  const b = walk(a, false);
  walk(a, true);
  const cells: number[] = [];
  for (let k = b; k >= 0; k = from[k]) cells.push(k);
  if (cells.length < 2) return [];
  // the far ends reach into the shape's rounded tips: trim them back to where it is properly wide
  const deep = cells.map((k) => D[k]).sort((p, q) => p - q)[cells.length >> 1];
  let s0 = 0, s1 = cells.length - 1;
  while (s0 < s1 && D[cells[s0]] < deep * 0.35) s0++;
  while (s1 > s0 && D[cells[s1]] < deep * 0.35) s1--;
  const kept = cells.slice(s0, s1 + 1);
  if (kept.length < 2) return [];
  // smooth the grid's staircase into a flowing line
  const win = Math.max(2, Math.round(deep / c));
  return kept.map((_, i) => {
    let x = 0, z = 0, m = 0;
    for (let q = Math.max(0, i - win); q <= Math.min(kept.length - 1, i + win); q++) { const k = kept[q]; x += x0 + (k % nx) * c; z += z0 + Math.floor(k / nx) * c; m++; }
    x /= m; z /= m;
    return { x, z, half: Math.max(c, -F.sd(x, z)) };
  });
}

/** swing a line from side to side, by up to `amp` metres, in bends about `lam` metres long; both ends carry on `ext` metres */
function meander(line: PathPt[], amp: (p: PathPt) => number, lam: number, N: Noise2D, seed: number, ext: number): PathPt[] {
  if (line.length < 2) return line;
  const at = [0];
  for (let i = 1; i < line.length; i++) at.push(at[i - 1] + Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z));
  const total = at[at.length - 1];
  const res = line.map((p, i) => {
    const a = line[Math.max(0, i - 2)], b = line[Math.min(line.length - 1, i + 2)];
    const tx = b.x - a.x, tz = b.z - a.z, tl = Math.hypot(tx, tz) || 1;
    // the swing fades out toward both ends, so the line leaves the area where its middle does
    const ends = smoothstep(0, Math.min(lam * 0.35, total * 0.12), Math.min(at[i], total - at[i]));
    const off = amp(p) * ends * (Math.sin((at[i] / lam) * Math.PI * 2 + seed) * 0.75 + N.noise(at[i] * 0.13, seed * 0.37) * 0.35);
    return { x: p.x - (tz / tl) * off, z: p.z + (tx / tl) * off, half: p.half };
  });
  // carry both ends on past the area, so the soft edge fades out a channel rather than a rounded end
  const dir = (p: PathPt, q: PathPt) => { const l = Math.hypot(p.x - q.x, p.z - q.z) || 1; return [(p.x - q.x) / l, (p.z - q.z) / l]; };
  const h = res[0], e = res[res.length - 1];
  const [hx, hz] = dir(h, res[1]), [ex, ez] = dir(e, res[res.length - 2]);
  return [{ x: h.x + hx * ext, z: h.z + hz * ext, half: h.half }, ...res, { x: e.x + ex * ext, z: e.z + ez * ext, half: e.half }];
}

/** distance from each vertex to a line (within `reach`), and the nearest point of the line */
function lineDistance(t: Terrain, rect: GridRect, line: PathPt[], reach: number) {
  const n = t.nx * t.nz;
  const dist = new Float32Array(n).fill(Infinity), near = new Int32Array(n).fill(-1);
  for (let a = 0; a < line.length - 1; a++) {
    const p = line[a], q = line[a + 1];
    const r = t.rectFor(Math.min(p.x, q.x) - reach, Math.min(p.z, q.z) - reach, Math.max(p.x, q.x) + reach, Math.max(p.z, q.z) + reach);
    const i0 = Math.max(r.i0, rect.i0), i1 = Math.min(r.i1, rect.i1), j0 = Math.max(r.j0, rect.j0), j1 = Math.min(r.j1, rect.j1);
    const ex = q.x - p.x, ez = q.z - p.z, el = ex * ex + ez * ez || 1e-9;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = t.xOf(i), z = t.zOf(j);
      const s = clamp(((x - p.x) * ex + (z - p.z) * ez) / el, 0, 1);
      const d = Math.hypot(x - p.x - ex * s, z - p.z - ez * s);
      const k = j * t.nx + i;
      if (d < dist[k]) { dist[k] = d; near[k] = s < 0.5 ? a : a + 1; }
    }
  }
  return { dist, near };
}

/** canyon terraces whose risers are never steeper than the grid can show cleanly */
const softTerrace = (x: number, steps: number, riser: number) => { const s = x * steps, i = Math.floor(s); return (i + smoothstep(riser, 1, s - i)) / steps; };

/**
 * Grow a landscape inside the selected area. Mountains, hills, volcanoes, mesas, islands and
 * dunes are made of the same landforms the Landforms tool stamps — laid out to fill the area,
 * shaped and painted by the stamps' own rules — so an area looks like a group of stamps rather
 * than something different. Canyons and rivers follow a line along the area; lakes, marshes,
 * plains and coasts are shaped by how far each point is from the area's outline.
 */
export function generateArea(t: Terrain, o: AreaOpts): { rect: GridRect; waterLevel: number | null } {
  const def = AREA_BY_ID[o.kind];
  const F = o.field, B = F.rect;
  const rect = areaGridRect(t, o);
  const mask = areaMask(o);
  // the width of the area's widest part
  const s = Math.max(1, F.depth * 2);
  const base = outlineHeight(t, F, rect);
  const wl = def.water ? areaWater(t, o, base) : t.waterLevel;
  if (wl !== t.waterLevel) t.setWaterLevel(wl, false);
  const W = wl ?? base - 0.12;
  const H = o.height;
  const rough = clamp(o.rough, 0, 1);
  const N = new Noise2D(o.seed * 101 + 17);
  const R = rng(o.seed * 7919 + 11);
  const { nx } = t;
  const orig = t.heights.slice();
  const cell = Math.max(t.dx, t.dz);
  const each = (fn: (x: number, z: number, k: number) => void) => {
    for (let j = rect.j0; j <= rect.j1; j++) for (let i = rect.i0; i <= rect.i1; i++) fn(t.xOf(i), t.zOf(j), j * nx + i);
  };
  /** a shape for every vertex (the kinds that are not made of stamps, and backgrounds under the ones that are) */
  let gen: ((x: number, z: number, h0: number, k: number) => number) | null = null;
  let feats: Feature[] = [];
  let mode: 'union' | 'add' | 'max' = 'union';
  let rangeH: number | null = null;
  let ground: ((g: GroundCtx, k: number) => number | null) | null = null;
  const feat = (id: string, d: Disc, h: number, i: number, extra: Partial<Feature> = {}): Feature => ({ id, x: d.x, z: d.z, r: d.r, h, angle: R() * Math.PI * 2, seed: o.seed * 31 + i * 17 + 5, ...extra });
  // rugged areas get more, smaller landforms; long or big areas room for more of them
  const many = (lo: number, hi: number, first?: number) => Math.round(lerp(lo, hi, rough) * (first ? clamp(F.size / (Math.PI * first * first) / 3, 1, 5) : 1));

  switch (o.kind) {
    case 'mountains': {
      const first = Math.min(F.depth, Math.max(2, H / 0.85));
      const discs = pack(areaSpots(t, F, R), R, { first, min: Math.max(1.3, first * 0.3), sep: 0.6, count: many(3, 10, first), next: [lerp(0.5, 0.32, rough), 0.85] });
      // the first is the main peak; the others are lower, the smaller the lower
      feats = discs.map((d, i) => feat('mountain', d, Math.min(d.r * 1.25, i ? H * Math.min(0.92, (d.r / discs[0].r) * (0.85 + 0.25 * R())) : H), i));
      rangeH = feats.length ? Math.max(...feats.map((f) => f.h)) : null;
      break;
    }
    case 'hills': {
      const sc = 1 / Math.max(4, s * 0.45);
      gen = (x, z, h0) => h0 + H * 0.16 * N.fbm(x * sc + 3, z * sc + 9, 2);
      const first = Math.min(F.depth * 1.05, Math.max(2.2, H * 2.4));
      const discs = pack(areaSpots(t, F, R), R, { first, min: Math.max(1.2, first * 0.38), sep: 0.8, count: many(8, 26, first), next: [0.55, 1], fit: 1.05 });
      feats = discs.map((d, i) => feat('hill', d, Math.min(d.r * 0.6, H * (0.65 + 0.35 * R()) * Math.pow(d.r / first, 0.5)), i));
      mode = 'add';
      break;
    }
    case 'volcanic': {
      const spots = areaSpots(t, F, R);
      const r0 = Math.min(F.depth, Math.max(3, H * 1.15));
      const [main] = pack(spots, R, { first: r0, min: 0, sep: 1, count: 1, next: [1, 1] });
      if (!main) break;
      feats = [feat('volcano', main, Math.min(main.r * 1.1, H), 0)];
      // cinder cones on its flanks and around it
      const cones = pack(spots, R, { first: main.r * 0.3, min: Math.max(0.8, main.r * 0.13), sep: 0.8, count: many(1, 6, r0), next: [0.55, 1], avoid: [{ x: main.x, z: main.z, r: main.r * 0.45 }] });
      cones.forEach((c, i) => feats.push(feat('volcano', c, Math.min(c.r * 0.9, H * (0.14 + 0.12 * R())), i + 1, { perch: true })));
      break;
    }
    case 'mesas': {
      const first = Math.min(F.depth, Math.max(2.5, H * 1.6));
      const discs = pack(areaSpots(t, F, R), R, { first, min: Math.max(1.4, first * 0.33), sep: 0.93, count: many(2, 10, first), next: [0.4, 0.95] });
      // buttes cut from the same rock layers stand about as tall as each other
      feats = discs.map((d, i) => feat('mesa', d, Math.min(d.r * 0.8, H * (0.78 + 0.22 * R())), i));
      break;
    }
    case 'islands': {
      // open water over the whole area, deepening away from its shores
      const Ds = Math.max(1, F.depth * 0.6);
      gen = (x, z) => W - 0.35 - (0.5 + H * 0.5) * smoothstep(0, Ds, -F.sd(x, z)) + 0.08 * N.fbm(x * 0.2, z * 0.2, 2);
      const first = Math.min(F.depth * 0.8, Math.max(2.4, (H + 0.9) * 2.2));
      const discs = pack(areaSpots(t, F, R), R, { first, min: Math.max(1.3, first * 0.35), sep: 1.2, count: many(2, 8, first), next: [0.45, 1], fit: 0.85 });
      // each island rises from the lagoon floor, its beach about halfway out, its slopes running on under the water
      const shape = (c: StampCtx) => c.h0 + (c.wl + c.H - c.h0) * Math.pow(dome(c.r), 0.8) * (0.92 + 0.08 * c.n);
      feats = discs.map((d, i) => feat('island', d, Math.min(d.r * 0.6, H * (0.6 + 0.4 * R()) * Math.pow(d.r / first, 0.4)), i, { shape }));
      mode = 'max';
      break;
    }
    case 'dunes': {
      gen = (x, z, h0) => h0 + H * 0.1 * N.fbm(x * 0.06 + 2, z * 0.06, 2);
      // crescent dunes all facing the same wind; a dune's footprint is longer than it is wide
      const wind = R() * Math.PI * 2, PK = 1.3;
      const first = Math.min(F.depth * 0.8, Math.max(1.6, H * 2.2));
      const discs = pack(areaSpots(t, F, R), R, { first: first * PK, min: Math.max(1.2, first * 0.45) * PK, sep: 0.82, count: many(10, 32, first * PK), next: [0.6, 1] });
      feats = discs.map((d, i) => {
        const r = d.r / PK;
        return feat('dune', { ...d, r }, Math.min(r * 0.55, H * (0.6 + 0.4 * R()) * Math.pow(r / first, 0.6)), i, { angle: wind + (R() - 0.5) * 0.5 });
      });
      mode = 'add';
      break;
    }
    case 'canyons': {
      const spine = areaSpine(t, F, areaSpots(t, F, R), R);
      if (spine.length < 2) break;
      // the gorge is about half as wide as the area, and winds within it
      const rvOf = (half: number) => clamp(Math.min(half * 0.95, 2.2 + s * 0.22), 1.6, 14);
      const rvMax = Math.max(...spine.map((p) => rvOf(p.half)));
      const line = meander(spine, (p) => Math.max(0, p.half - 0.55 * rvOf(p.half) - 0.4) * (0.45 + 0.4 * rough), clamp(rvMax * 2.6, 6, 30), N, o.seed, rvMax * 0.6);
      const reach = rvMax * 0.7 + cell * 2;
      const L = lineDistance(t, rect, line, reach);
      // like the canyon stamp, the gorge grows shallow where it ends inside the diorama (it runs on through the diorama's edge)
      const at = [0];
      for (let i = 1; i < line.length; i++) at.push(at[i - 1] + Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z));
      const total = at[at.length - 1], ext = rvMax * 0.6;
      const atEdge = (p: PathPt) => Math.abs(p.x) > t.width / 2 - 1.5 || Math.abs(p.z) > t.depth / 2 - 1.5;
      const open0 = atEdge(line[1]), open1 = atEdge(line[line.length - 2]);
      const taper = line.map((p, i) => Math.min(open0 ? 1 : smoothstep(ext, ext + rvOf(p.half) * 1.4, at[i]), open1 ? 1 : smoothstep(ext, ext + rvOf(p.half) * 1.4, total - at[i])));
      const floor = 0.2, rim = 0.55;
      gen = (x, z, h0, k) => {
        if (L.dist[k] > reach) return h0;
        const p = L.near[k], rv = rvOf(line[p].half);
        const av = L.dist[k] / rv + (0.04 + 0.06 * rough) * N.fbm(x * 0.3, z * 0.3, 2);
        // three terraces down the walls; their risers stay at least a few grid cells wide
        const riser = clamp(1 - (2.5 * cell) / (((rim - floor) * rv) / 3), 0.3, 0.72);
        const prof = av < floor ? 1 : av < rim ? softTerrace(1 - (av - floor) / (rim - floor), 3, riser) : 0;
        return Math.min(h0, lerp(h0, base - H, prof * taper[p]));
      };
      const canyon = STAMP_BY_ID.canyon, keep = !!o.keepGround;
      ground = (g, k) => (L.dist[k] > reach ? (keep ? t.paint[k] : null)
        : canyon.ground!({ ...g, u: 0, v: 0, r: 0, h0: g.h, base, H, wl: W, n: 0, ridge: 0, rel: Math.min(0, (g.h - base) / Math.max(0.1, H)) }, o.style) ?? (keep ? t.paint[k] : null));
      break;
    }
    case 'river': {
      const spine = areaSpine(t, F, areaSpots(t, F, R), R);
      if (spine.length < 2) break;
      const riverW = clamp(s * 0.13, 1.1, 4.2);
      const line = meander(spine, (p) => Math.max(0, p.half - riverW * 1.2) * (0.25 + 0.35 * rough), clamp(riverW * 8, 6, 40), N, o.seed, riverW * 3);
      const reach = riverW * 4.5;
      const L = lineDistance(t, rect, line, reach);
      gen = (_x, _z, h0, k) => {
        const dist = L.dist[k];
        if (dist > reach) return h0;
        // channel below the water, banks rising gently to a valley floor, then back to the land
        const channel = dist < riverW / 2 ? W - H * Math.max(0.08, 1 - Math.pow(dist / (riverW / 2), 2)) : W + 0.06 + (dist - riverW / 2) * 0.22;
        const valleyFloor = Math.max(Math.min(h0, base), W + 0.1);
        return lerp(smin(channel, valleyFloor, 0.2), h0, smoothstep(riverW * 1.4, reach, dist));
      };
      break;
    }
    case 'lake': {
      // a bowl: deepest in the middle of the area, shelving up to its shores
      const Dl = Math.max(o.feather * 1.2, F.depth * 0.75);
      gen = (x, z) => W - 0.05 - H * Math.pow(smoothstep(0.04, 1, -F.sd(x, z) / Dl), 0.75) * (0.85 + 0.15 * N.noise(x * 0.2, z * 0.2));
      break;
    }
    case 'marsh':
      gen = (x, z) => {
        const f = N.fbm(x * 0.32 + 1, z * 0.32 + 2, 3);
        const pools = smoothstep(-0.18, -0.48, f);
        return W + 0.1 + 0.16 * f * (0.5 + rough) - 0.5 * pools;
      };
      break;
    case 'plains':
      gen = (x, z) => base + H * (N.fbm(x * 0.07 + 5, z * 0.07, 3) * (0.4 + rough) + 0.25 * rough * N.fbm(x * 0.3, z * 0.3, 2));
      break;
    case 'coast': {
      // the sea lies toward the nearest edge of the diorama
      const cx = (B.minX + B.maxX) / 2, cz = (B.minZ + B.maxZ) / 2, w = Math.max(0.5, B.maxX - B.minX), d = Math.max(0.5, B.maxZ - B.minZ);
      const toEdge = [B.minX + t.width / 2, t.width / 2 - B.maxX, B.minZ + t.depth / 2, t.depth / 2 - B.maxZ];
      const seaSide = toEdge.indexOf(Math.min(...toEdge));
      gen = (x, z) => {
        // 0 on the landward side … 1 at the seaward edge
        const tt = seaSide === 0 ? (cx + w / 2 - x) / w : seaSide === 1 ? (x - (cx - w / 2)) / w : seaSide === 2 ? (cz + d / 2 - z) / d : (z - (cz - d / 2)) / d;
        const shore = 0.5 + 0.1 * N.fbm(x * 0.12, z * 0.12, 2);
        if (tt < shore) {
          // a beach that rises slowly, then the land behind it
          const a = clamp((shore - tt) / shore, 0, 1);
          return W + 0.04 + (Math.max(base, W + 0.2) - W + H * 0.5) * Math.pow(a, 1.6) + 0.1 * a * N.fbm(x * 0.4, z * 0.4, 2);
        }
        return W + 0.04 - ((tt - shore) / (1 - shore)) * Math.max(1.2, H * 1.5);
      };
      break;
    }
  }

  if (gen) { const g = gen; each((x, z, k) => { t.heights[k] = g(x, z, orig[k], k); }); }
  const owner = new Int16Array(t.heights.length).fill(-1);
  if (feats.length) {
    stampFeatures(t, rect, feats, W, mode, owner, new Float32Array(t.heights.length), o.style, Math.min(1, 0.35 + 1.3 * rough));
    ground = featureGround(t, feats, owner, o.style, rangeH, !!o.keepGround);
  }
  // blend into the land around it through the soft edge
  each((x, z, k) => {
    const m = mask(x, z);
    t.heights[k] = m <= 0 ? orig[k] : clamp(lerp(orig[k], t.heights[k], m), MIN_HEIGHT, MAX_HEIGHT);
  });
  if (o.paint) {
    const relBase = o.kind === 'canyons' ? base - H : o.kind === 'islands' || o.kind === 'coast' ? W : base;
    paintRect(t, rect, { style: o.style, base: relBase, H: Math.max(0.5, H), seed: o.seed, weight: (_k, x, z) => mask(x, z), override: ground ?? undefined });
  }
  return { rect, waterLevel: wl };
}
