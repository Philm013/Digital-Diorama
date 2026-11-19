import { Noise2D, clamp, smoothstep, lerp } from './util';
import { GROUND_INDEX as G } from './ground';
import { MAX_HEIGHT, MIN_HEIGHT, type GridRect, type Terrain } from './Terrain';

/**
 * Landforms for the Build mode land tools:
 *  - ground styles: rules that choose a kind of ground from the shape of the land (rock on
 *    cliffs, snow on peaks, sand or mud at the water's edge…), per habitat;
 *  - stamps: a single landform placed at a point (hill, volcano, canyon, lake…);
 *  - area generators: a whole landscape grown inside a selected box or oval.
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
  water?: boolean;
  /** default relief (m) for an area whose shorter side is `s` metres */
  relief(s: number): number;
}
export const AREA_KINDS: AreaKindDef[] = [
  { id: 'mountains', name: 'Mountains', emoji: '🏔️', hint: 'Jagged peaks and ridges', style: 'mountain', relief: (s) => clamp(s * 0.32, 2.5, 16) },
  { id: 'hills', name: 'Hills', emoji: '⛰️', hint: 'Soft rolling hills', style: 'biome', relief: (s) => clamp(s * 0.09, 0.8, 4) },
  { id: 'plains', name: 'Plains', emoji: '🌾', hint: 'Flat, open ground', style: 'biome', relief: () => 0.35 },
  { id: 'dunes', name: 'Dunes', emoji: '🐪', hint: 'Rippling sand dunes', style: 'desert', relief: (s) => clamp(s * 0.11, 1, 3.5) },
  { id: 'canyons', name: 'Canyons', emoji: '🏜️', hint: 'Gorges cut into layered rock', style: 'badlands', relief: (s) => clamp(s * 0.14, 1.5, 7) },
  { id: 'mesas', name: 'Mesas', emoji: '🟫', hint: 'Flat-topped buttes', style: 'badlands', relief: (s) => clamp(s * 0.14, 1.5, 6) },
  { id: 'volcanic', name: 'Volcanoes', emoji: '🌋', hint: 'A volcano and cinder cones', style: 'volcanic', relief: (s) => clamp(s * 0.3, 2.5, 14) },
  { id: 'lake', name: 'Lake', emoji: '💧', hint: 'A lake filling the area', style: 'biome', water: true, relief: (s) => clamp(s * 0.06, 0.8, 3) },
  { id: 'river', name: 'River', emoji: '🏞️', hint: 'A winding river through a valley', style: 'biome', water: true, relief: (s) => clamp(s * 0.05, 0.6, 2) },
  { id: 'marsh', name: 'Marsh', emoji: '🦩', hint: 'Soggy ground with pools and reeds', style: 'wetland', water: true, relief: () => 0.3 },
  { id: 'islands', name: 'Islands', emoji: '🏝️', hint: 'Islands in open water', style: 'beach', water: true, relief: (s) => clamp(s * 0.06, 0.8, 3) },
  { id: 'coast', name: 'Coast', emoji: '🌊', hint: 'A beach sloping into the sea', style: 'beach', water: true, relief: (s) => clamp(s * 0.05, 0.6, 2) },
];
export const AREA_BY_ID: Record<string, AreaKindDef> = Object.fromEntries(AREA_KINDS.map((a) => [a.id, a]));

export interface AreaRect { minX: number; minZ: number; maxX: number; maxZ: number }
export interface AreaOpts {
  kind: AreaKind;
  rect: AreaRect;
  oval: boolean;
  /** width (m) of the soft edge */
  feather: number;
  /** relief in metres */
  height: number;
  /** 0 smooth … 1 rugged */
  rough: number;
  style: GroundStyle;
  seed: number;
  paint: boolean;
}

/** 0 outside the area, rising through the soft, slightly wobbly edge to 1 inside */
export function areaMask(o: Pick<AreaOpts, 'rect' | 'oval' | 'feather' | 'seed'>) {
  const { rect } = o;
  const cx = (rect.minX + rect.maxX) / 2, cz = (rect.minZ + rect.maxZ) / 2;
  const hw = Math.max(0.05, (rect.maxX - rect.minX) / 2), hd = Math.max(0.05, (rect.maxZ - rect.minZ) / 2);
  const N = new Noise2D(o.seed * 5 + 3);
  const fe = Math.max(0.2, o.feather);
  return (x: number, z: number) => {
    let d: number;
    if (o.oval) d = (Math.hypot((x - cx) / hw, (z - cz) / hd) - 1) * Math.min(hw, hd);
    else { const qx = Math.abs(x - cx) - hw, qz = Math.abs(z - cz) - hd; d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0); }
    d += N.fbm(x * 0.12, z * 0.12, 3) * fe * 0.8;
    return smoothstep(0, fe, -d);
  };
}

/** repaint an area from a ground style without changing its shape */
export function repaintArea(t: Terrain, style: GroundStyle, o: Pick<AreaOpts, 'rect' | 'oval' | 'feather' | 'seed'>): GridRect {
  const mask = areaMask(o);
  const r = o.rect, pad = o.feather * 0.6;
  const rect = t.rectFor(r.minX - pad, r.minZ - pad, r.maxX + pad, r.maxZ + pad);
  const { base, H } = terrainLevels(t);
  paintRect(t, rect, { style, base, H, seed: o.seed, weight: (_k, x, z) => mask(x, z) });
  return rect;
}

/** the water level an area generator needs */
function areaWater(t: Terrain, o: AreaOpts, base: number) {
  if (t.waterLevel !== null) return t.waterLevel;
  const r = o.rect, f = o.feather;
  return newWaterLevel(t, base - (o.kind === 'coast' || o.kind === 'islands' ? 0.25 : 0.12), (x, z) => x > r.minX - f && x < r.maxX + f && z > r.minZ - f && z < r.maxZ + f);
}

/** grow a landscape inside the selected area */
export function generateArea(t: Terrain, o: AreaOpts): { rect: GridRect; waterLevel: number | null } {
  const def = AREA_BY_ID[o.kind];
  const R = o.rect;
  const pad = o.feather * 0.6;
  const rect = t.rectFor(R.minX - pad, R.minZ - pad, R.maxX + pad, R.maxZ + pad);
  const mask = areaMask(o);
  const w = R.maxX - R.minX, d = R.maxZ - R.minZ, s = Math.max(1, Math.min(w, d));
  const cx = (R.minX + R.maxX) / 2, cz = (R.minZ + R.maxZ) / 2;
  const hw = w / 2, hd = d / 2;
  // the area grows from the height of the land around it
  let bs = 0, bn = 0;
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    const x = clamp(cx + Math.cos(a) * hw * (o.oval ? 1 : Math.SQRT2), R.minX, R.maxX), z = clamp(cz + Math.sin(a) * hd * (o.oval ? 1 : Math.SQRT2), R.minZ, R.maxZ);
    bs += t.heightAt(x, z); bn++;
  }
  const base = bs / bn;
  const wl = def.water ? areaWater(t, o, base) : t.waterLevel;
  if (wl !== t.waterLevel) t.setWaterLevel(wl, false);
  const H = o.height;
  const rough = clamp(o.rough, 0, 1);
  const N = new Noise2D(o.seed * 101 + 17);
  const lx = (x: number) => (x - cx) / Math.max(0.5, hw), lz = (z: number) => (z - cz) / Math.max(0.5, hd);
  const radial = (x: number, z: number) => Math.hypot(lx(x), lz(z));
  const detail = (x: number, z: number) => N.fbm(x * 0.9, z * 0.9, 3) * (0.04 + rough * 0.22);
  const W = wl ?? base - 0.12;
  // volcano layout
  const RV = new Noise2D(o.seed * 7 + 1);
  const cones: { x: number; z: number; r: number; h: number }[] = [];
  if (o.kind === 'volcanic') {
    cones.push({ x: cx + RV.noise(1, 2) * hw * 0.15, z: cz + RV.noise(3, 4) * hd * 0.15, r: s * 0.42, h: H });
    for (let k = 0; k < 4; k++) {
      const a = k * 2.1 + RV.noise(k, 9) * 1.5, rr = 0.55 + 0.25 * RV.noise(k, 5);
      cones.push({ x: cx + Math.cos(a) * hw * rr, z: cz + Math.sin(a) * hd * rr, r: s * (0.12 + 0.05 * RV.noise(k, 7)), h: H * (0.22 + 0.1 * RV.noise(k, 8)) });
    }
  }
  // river path along the longer side
  const alongX = w >= d;
  const riverW = clamp(s * 0.13, 1.1, 4.2);
  const meanderA = (alongX ? hd : hw) * 0.42;
  const riverCenter = (t1: number) => meanderA * (Math.sin(t1 * 2.2 + o.seed) * 0.75 + N.noise(t1 * 1.3, o.seed * 0.1) * 0.35);
  // coast: the sea lies toward the nearest edge of the diorama
  const toEdge = [R.minX + t.width / 2, t.width / 2 - R.maxX, R.minZ + t.depth / 2, t.depth / 2 - R.maxZ];
  const seaSide = toEdge.indexOf(Math.min(...toEdge));
  const gen = (x: number, z: number, h0: number): number => {
    switch (o.kind) {
      case 'mountains': {
        const sc = 1 / (s * 0.5);
        const rr = clamp(N.ridged(x * sc + 31, z * sc + 17, 5) / 0.62, 0, 1.2);
        const massif = 1 - smoothstep(0.25, 1.05, radial(x, z));
        const peaks = Math.pow(rr, 1.7) * (0.3 + 0.7 * massif);
        return base + H * peaks + detail(x, z) * H * 0.25;
      }
      case 'hills': {
        const sc = 1 / Math.max(3, s * 0.35);
        const v = 0.5 + 0.5 * N.fbm(x * sc + 3, z * sc + 9, 4);
        return base + H * Math.pow(v, 1.4) * 1.2 + detail(x, z) * H * 0.2;
      }
      case 'plains':
        return base + H * N.fbm(x * 0.07 + 5, z * 0.07, 3) * (0.4 + rough) + detail(x, z) * 0.3;
      case 'dunes': {
        const lambda = clamp(s * 0.38, 3.5, 9);
        const wpos = x / lambda + N.fbm(x * 0.03, z * 0.05, 2) * 0.9 + z * 0.06 / lambda;
        const ph = wpos - Math.floor(wpos);
        const prof = ph < 0.72 ? smoothstep(0, 0.72, ph) : 1 - smoothstep(0.72, 1, ph);
        const amp = 0.65 + 0.35 * N.noise(x * 0.05 + 2, z * 0.08);
        return base + H * Math.pow(prof, 1.3) * amp + detail(x, z) * 0.15;
      }
      case 'canyons': {
        // a few winding gorges: flat sandy floors, stepped walls, the plateau between them
        const sc = 1 / Math.max(5, s * 0.62);
        const wx = x + N.fbm(x * 0.05 + 3, z * 0.05, 2) * 3, wz = z + N.fbm(x * 0.05, z * 0.05 + 7, 2) * 3;
        const ch = Math.abs(N.fbm(wx * sc + 8, wz * sc + 2, 2));
        const q = 1 - smoothstep(0.05, 0.3 + 0.08 * rough, ch);
        const steps = q * 3, si = Math.floor(steps);
        const stepped = (si + smoothstep(0.45, 1, steps - si)) / 3;
        return base - H * Math.min(1, stepped) + detail(x, z) * 0.25;
      }
      case 'mesas': {
        // a handful of flat-topped buttes standing on aprons of fallen rock
        const sc = 1 / Math.max(4, s * 0.42);
        const v = 0.5 + 0.5 * N.fbm(x * sc + 4, z * sc + 1, 2) + 0.06 * (1 - radial(x, z));
        const top = smoothstep(0.57, 0.63, v), talus = smoothstep(0.44, 0.6, v) * 0.24;
        return base + H * Math.max(top * (0.98 + 0.02 * N.noise(x * 0.5, z * 0.5)), talus) + detail(x, z) * 0.15;
      }
      case 'volcanic': {
        let hgt = 0;
        for (const c of cones) {
          const r = Math.hypot(x - c.x, z - c.z) / c.r;
          if (r >= 1) continue;
          const rc = 0.2;
          const p = r < rc ? 1 - 0.3 * (1 - (r / rc) * (r / rc)) : Math.pow((1 - r) / (1 - rc), 1.3);
          hgt = smax(hgt, c.h * p, 0.2);
        }
        return base + hgt + N.fbm(x * 0.4, z * 0.4, 3) * (0.1 + rough * 0.25);
      }
      case 'lake': {
        const m = mask(x, z);
        return W - H * Math.pow(smoothstep(0.2, 1, m), 0.8) * (0.85 + 0.15 * N.noise(x * 0.2, z * 0.2)) - 0.05;
      }
      case 'river': {
        const u = alongX ? x : z, vv = alongX ? z - cz : x - cx;
        const tt = (u - (alongX ? cx : cz)) / Math.max(1, alongX ? hw : hd);
        const dist = Math.abs(vv - riverCenter(tt));
        if (dist > riverW * 4.5) return h0;
        // channel below the water, banks rising gently to a valley floor, then back to the land
        const channel = dist < riverW / 2 ? W - H * Math.max(0.08, 1 - Math.pow(dist / (riverW / 2), 2)) : W + 0.06 + (dist - riverW / 2) * 0.22;
        const valleyFloor = Math.max(Math.min(h0, base), W + 0.1);
        return lerp(smin(channel, valleyFloor, 0.2), h0, smoothstep(riverW * 1.4, riverW * 4.5, dist));
      }
      case 'marsh': {
        const f = N.fbm(x * 0.32 + 1, z * 0.32 + 2, 3);
        const pools = smoothstep(-0.18, -0.48, f);
        return W + 0.1 + 0.16 * f * (0.5 + rough) - 0.5 * pools;
      }
      case 'islands': {
        const sc = 1 / Math.max(3, s * 0.32);
        const v = 0.5 + 0.5 * N.fbm(x * sc + 6, z * sc + 3, 4) + 0.12 * (1 - radial(x, z));
        const land = smoothstep(0.55, 0.78, v);
        return W - 1.1 + (H + 1.1) * Math.pow(land, 0.8) + detail(x, z) * 0.2;
      }
      case 'coast': {
        // 0 on the landward side … 1 at the seaward edge
        const tt = seaSide === 0 ? (cx + hw - x) / w : seaSide === 1 ? (x - (cx - hw)) / w : seaSide === 2 ? (cz + hd - z) / d : (z - (cz - hd)) / d;
        const shore = 0.5 + 0.1 * N.fbm(x * 0.12, z * 0.12, 2);
        if (tt < shore) {
          // a beach that rises slowly, then the land behind it
          const a = clamp((shore - tt) / shore, 0, 1);
          return W + 0.04 + (Math.max(base, W + 0.2) - W + H * 0.5) * Math.pow(a, 1.6) + 0.1 * a * N.fbm(x * 0.4, z * 0.4, 2);
        }
        return W + 0.04 - ((tt - shore) / (1 - shore)) * Math.max(1.2, H * 1.5);
      }
    }
  };
  const { nx } = t;
  for (let j = rect.j0; j <= rect.j1; j++) for (let i = rect.i0; i <= rect.i1; i++) {
    const x = t.xOf(i), z = t.zOf(j);
    const m = mask(x, z);
    if (m <= 0) continue;
    const k = j * nx + i, h0 = t.heights[k];
    t.heights[k] = clamp(lerp(h0, gen(x, z, h0), m), MIN_HEIGHT, MAX_HEIGHT);
  }
  if (o.paint) {
    const relBase = o.kind === 'canyons' ? base - H : o.kind === 'islands' || o.kind === 'coast' ? W : base;
    paintRect(t, rect, { style: o.style, base: relBase, H: Math.max(0.5, H), seed: o.seed, weight: (_k, x, z) => mask(x, z) });
  }
  return { rect, waterLevel: wl };
}
