/**
 * Biome library.
 *
 * Every biome exposes a *world-space continuous* surface-detail function that
 * returns metres of displacement (roughly zero-mean). Because all of them are
 * pure functions of world (x, z), neighbouring chunks and neighbouring LODs
 * agree exactly at shared edges — no seams, no stitching, no skirts required
 * for correctness.
 *
 * Biomes also declare:
 *  - a niche in (temperature, moisture, elevation) space used to blend them
 *  - an optional low-frequency gate field (only evaluated for plausible biomes)
 *  - a palette and prop densities
 */

import { SimplexNoise, billow, clamp, fbm, lerp, ridged, smoothstep } from './noise';

export interface BiomeCtx {
  n: SimplexNoise;
  n2: SimplexNoise;
  n3: SimplexNoise;
  /** master wavelength in metres */
  scale: number;
  /** peak amplitude in metres */
  amp: number;
  /** sea level in metres */
  sea: number;
  detail: number;
  ridge: number;
  warp: number;
  /** 0..1 crest rounding — higher = rounder, less spiky */
  smoothing: number;
  baseH: number;
  /** normalized elevation -1..1 relative to sea level */
  elevN: number;
  temp: number;
  moist: number;
}

export interface Biome {
  id: string;
  label: string;
  icon: string;
  palette: string;
  niche: { t: number; tw: number; m: number; mw: number; e: number; ew: number };
  gate?: (c: BiomeCtx, x: number, z: number) => number;
  detail: (c: BiomeCtx, x: number, z: number) => number;
  trees: number;
  rocks: number;
}

const WIDE = 9; // "don't care" niche width

/* ------------------------------------------------------------------ */
/* shaping helpers                                                     */
/* ------------------------------------------------------------------ */

/** Soft ridge: `soft` rounds the crest instead of sharpening it. */
function crest(v: number, soft: number) {
  const r = 1 - Math.abs(v);
  const sharp = r * r;
  const round = r * r * (3 - 2 * r);
  return lerp(sharp, round, soft);
}

/** Terracing with a soft shoulder (no razor steps). */
function terrace(v: number, steps: number, soft: number) {
  const s = Math.max(1, steps);
  const q = Math.round(v * s) / s;
  return lerp(q, v + (q - v) * 0.35, soft);
}

/** Soft saturation — stops single samples from shooting into spikes. */
function softSat(v: number, limit: number) {
  const t = v / limit;
  return limit * (t / Math.pow(1 + Math.pow(Math.abs(t), 2.4), 1 / 2.4));
}

/* ------------------------------------------------------------------ */
/* biomes                                                              */
/* ------------------------------------------------------------------ */

export const BIOMES: Biome[] = [
  /* ------------------------------ water ---------------------------- */
  {
    id: 'ocean',
    label: 'Ocean',
    icon: '🌊',
    palette: 'temperate',
    niche: { t: 0.5, tw: WIDE, m: 0.5, mw: WIDE, e: -0.6, ew: 0.45 },
    detail: (c, x, z) => {
      const s = c.scale;
      return (
        fbm(c.n, x / (s * 0.55), z / (s * 0.55), { octaves: 3, gain: 0.45 }) * c.amp * 0.02 +
        fbm(c.n, x / (s * 0.12) + 31, z / (s * 0.12) - 17, { octaves: 2 }) * c.amp * 0.006
      );
    },
    trees: 0,
    rocks: 0,
  },
  {
    id: 'beach',
    label: 'Beach',
    icon: '🏖️',
    palette: 'tropical',
    niche: { t: 0.6, tw: WIDE, m: 0.5, mw: WIDE, e: 0.02, ew: 0.055 },
    detail: (c, x, z) => {
      const s = c.scale;
      // flatten hard towards a gentle berm just above the waterline
      const berm = c.sea + c.amp * 0.035;
      const pull = clamp(1 - Math.abs(c.baseH - berm) / (c.amp * 0.075), 0, 1);
      const dune = fbm(c.n, x / (s * 0.09), z / (s * 0.09), { octaves: 3 }) * c.amp * 0.012;
      return (berm + dune - c.baseH) * pull * 0.85;
    },
    trees: 0.35,
    rocks: 0.1,
  },
  {
    id: 'coast',
    label: 'Coastal Cliffs',
    icon: '🧗',
    palette: 'temperate',
    niche: { t: 0.5, tw: 0.4, m: 0.5, mw: 0.4, e: 0.09, ew: 0.1 },
    detail: (c, x, z) => {
      const s = c.scale;
      // wave-cut platform then a cliff notch
      const band = clamp((c.baseH - c.sea) / (c.amp * 0.22), -0.2, 1);
      const notch = Math.exp(-Math.pow((band - 0.12) / 0.18, 2));
      const grit = fbm(c.n, x / (s * 0.06), z / (s * 0.06), { octaves: 3, gain: 0.5 }) * c.amp * 0.02;
      return -notch * c.amp * 0.05 + grit;
    },
    trees: 0.35,
    rocks: 0.4,
  },

  /* ------------------------------ lowland -------------------------- */
  {
    id: 'marsh',
    label: 'Marsh',
    icon: '🪷',
    palette: 'marsh',
    niche: { t: 0.55, tw: 0.3, m: 0.86, mw: 0.24, e: 0.03, ew: 0.12 },
    detail: (c, x, z) => {
      const s = c.scale;
      const ponds = Math.pow(clamp(billow(c.n, x / (s * 0.34) + 3, z / (s * 0.34) - 6, { octaves: 3 }) * 0.5 + 0.5, 0, 1), 3);
      const water = c.sea + c.amp * 0.012;
      const pull = clamp(1 - Math.abs(c.baseH - water) / (c.amp * 0.11), 0, 1);
      const reeds = fbm(c.n, x / (s * 0.05), z / (s * 0.05), { octaves: 2 }) * c.amp * 0.005;
      return (-ponds * c.amp * 0.06 + (water - c.baseH) * 0.25) * pull + reeds;
    },
    trees: 0.3,
    rocks: 0.08,
  },
  {
    id: 'plains',
    label: 'Plains',
    icon: '🌾',
    palette: 'temperate',
    niche: { t: 0.55, tw: 0.28, m: 0.5, mw: 0.28, e: 0.18, ew: 0.22 },
    detail: (c, x, z) => {
      const s = c.scale;
      return (
        fbm(c.n, x / (s * 0.16), z / (s * 0.16), { octaves: 4, gain: 0.45 }) * c.amp * 0.035 * c.detail +
        fbm(c.n, x / (s * 0.04) + 9, z / (s * 0.04) - 4, { octaves: 2 }) * c.amp * 0.008
      );
    },
    trees: 0.3,
    rocks: 0.1,
  },
  {
    id: 'savanna',
    label: 'Savanna',
    icon: '🦁',
    palette: 'savanna',
    niche: { t: 0.8, tw: 0.2, m: 0.3, mw: 0.2, e: 0.18, ew: 0.2 },
    detail: (c, x, z) => {
      const s = c.scale;
      const roll = fbm(c.n, x / (s * 0.3), z / (s * 0.3), { octaves: 4, gain: 0.45 }) * c.amp * 0.045;
      // scattered rocky kopjes
      const k = ridged(c.n2, x / (s * 0.11) + 5, z / (s * 0.11) - 3, { octaves: 3 });
      const kopje = Math.pow(clamp((k - 0.55) / 0.45, 0, 1), 2) * c.amp * 0.14;
      return roll + kopje * c.detail;
    },
    trees: 0.2,
    rocks: 0.4,
  },
  {
    id: 'forest',
    label: 'Forest',
    icon: '🌲',
    palette: 'forest',
    niche: { t: 0.5, tw: 0.26, m: 0.76, mw: 0.26, e: 0.25, ew: 0.25 },
    detail: (c, x, z) => {
      const s = c.scale;
      return (
        fbm(c.n, x / (s * 0.13), z / (s * 0.13), { octaves: 5, gain: 0.46 }) * c.amp * 0.05 * c.detail +
        billow(c.n2, x / (s * 0.05) + 12, z / (s * 0.05) - 8, { octaves: 2 }) * c.amp * 0.012
      );
    },
    trees: 0.95,
    rocks: 0.15,
  },

  /* ------------------------------ upland --------------------------- */
  {
    id: 'hills',
    label: 'Hills',
    icon: '⛰',
    palette: 'temperate',
    niche: { t: 0.5, tw: 0.4, m: 0.5, mw: 0.4, e: 0.42, ew: 0.2 },
    detail: (c, x, z) => {
      const s = c.scale;
      const h = fbm(c.n, x / (s * 0.19), z / (s * 0.19), { octaves: 5, gain: 0.46 }) * c.amp * 0.075;
      const b = billow(c.n2, x / (s * 0.09) + 21, z / (s * 0.09) - 14, { octaves: 3 }) * c.amp * 0.03;
      return (h + b) * c.detail;
    },
    trees: 0.55,
    rocks: 0.2,
  },
  {
    id: 'mountains',
    label: 'Mountains',
    icon: '🏔️',
    palette: 'alpine',
    niche: { t: 0.34, tw: 0.45, m: 0.45, mw: 0.45, e: 0.62, ew: 0.2 },
    detail: (c, x, z) => {
      const s = c.scale;
      const soft = c.smoothing;
      const r = ridged(c.n, x / (s * 0.3), z / (s * 0.3), { octaves: 5, gain: 0.44 });
      const r2 = ridged(c.n2, x / (s * 0.11) + 40, z / (s * 0.11) - 22, { octaves: 3, gain: 0.42 });
      const crestA = (crest(r2 * 2 - 1, soft) - 0.35) * c.amp * 0.15;
      const mass = (r - 0.42) * c.amp * 0.3;
      return softSat(mass + crestA * c.detail, c.amp * 0.55);
    },
    trees: 0.25,
    rocks: 0.55,
  },
  {
    id: 'peaks',
    label: 'High Peaks',
    icon: '🗻',
    palette: 'peaks',
    niche: { t: 0.2, tw: 0.4, m: 0.4, mw: 0.5, e: 0.85, ew: 0.18 },
    detail: (c, x, z) => {
      const s = c.scale;
      const soft = c.smoothing * 0.8;
      const r = ridged(c.n, x / (s * 0.22), z / (s * 0.22), { octaves: 6, gain: 0.42 });
      const r2 = ridged(c.n2, x / (s * 0.07) + 60, z / (s * 0.07) - 31, { octaves: 3, gain: 0.4 });
      const spire = (crest(r2 * 2 - 1, soft) - 0.3) * c.amp * 0.16;
      return softSat((r - 0.45) * c.amp * 0.32 + spire * c.detail, c.amp * 0.6);
    },
    trees: 0,
    rocks: 0.7,
  },
  {
    id: 'glacier',
    label: 'Glacier',
    icon: '🧊',
    palette: 'glacier',
    niche: { t: 0.1, tw: 0.2, m: 0.5, mw: 0.5, e: 0.55, ew: 0.3 },
    detail: (c, x, z) => {
      const s = c.scale;
      const soft = c.smoothing;
      const flow = fbm(c.n, x / (s * 0.26), z / (s * 0.26), { octaves: 4, gain: 0.45 }) * c.amp * 0.06;
      // crevasse fields: fine, shallow, rounded
      const cv = ridged(c.n2, x / (s * 0.035) + 7, z / (s * 0.035) - 19, { octaves: 2 });
      const crevasse = -(crest(cv * 2 - 1, soft) - 0.4) * c.amp * 0.022 * c.detail;
      return flow + crevasse;
    },
    trees: 0,
    rocks: 0.3,
  },
  {
    id: 'tundra',
    label: 'Tundra',
    icon: '🦌',
    palette: 'tundra',
    niche: { t: 0.16, tw: 0.2, m: 0.45, mw: 0.35, e: 0.15, ew: 0.25 },
    detail: (c, x, z) => {
      const s = c.scale;
      const soft = c.smoothing;
      const roll = fbm(c.n, x / (s * 0.22), z / (s * 0.22), { octaves: 4, gain: 0.44 }) * c.amp * 0.03;
      // ice-wedge polygons
      const poly = ridged(c.n2, x / (s * 0.045), z / (s * 0.045), { octaves: 2 });
      const wedge = -(crest(poly * 2 - 1, soft) - 0.5) * c.amp * 0.012 * c.detail;
      const pingo = Math.pow(clamp(billow(c.n3, x / (s * 0.16) + 3, z / (s * 0.16) - 9, { octaves: 2 }) * 0.5 + 0.5, 0, 1), 6) * c.amp * 0.05;
      return roll + wedge + pingo;
    },
    trees: 0.05,
    rocks: 0.3,
  },

  /* ------------------------------ arid ----------------------------- */
  {
    id: 'desert',
    label: 'Desert',
    icon: '🏜️',
    palette: 'desert',
    niche: { t: 0.78, tw: 0.22, m: 0.12, mw: 0.16, e: 0.2, ew: 0.22 },
    detail: (c, x, z) => {
      const s = c.scale;
      const gravel = fbm(c.n, x / (s * 0.2), z / (s * 0.2), { octaves: 4, gain: 0.45 }) * c.amp * 0.03;
      const wash = ridged(c.n2, x / (s * 0.07) + 11, z / (s * 0.07) - 5, { octaves: 3 });
      return gravel - (1 - crest(wash * 2 - 1, 0.7)) * c.amp * 0.02 * c.detail;
    },
    trees: 0.02,
    rocks: 0.25,
  },
  {
    id: 'dunes',
    label: 'Dune Sea',
    icon: '🐪',
    palette: 'dunes',
    niche: { t: 0.85, tw: 0.2, m: 0.08, mw: 0.12, e: 0.16, ew: 0.18 },
    gate: (c, x, z) => smoothstep(-0.35, 0.15, fbm(c.n3, x / (c.scale * 1.6) + 91, z / (c.scale * 1.6) - 47, { octaves: 2 })),
    detail: (c, x, z) => {
      const s = c.scale;
      const ang = 0.42 + fbm(c.n3, x / (s * 1.2), z / (s * 1.2), { octaves: 2 }) * 0.7;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const warp = fbm(c.n, x / (s * 0.3), z / (s * 0.3), { octaves: 3 }) * 0.5;
      const dune = ((x * ca + z * sa) / (s * 0.055) + warp * 2.2);
      let p = dune - Math.floor(dune);
      // long windward slope, short rounded slip face
      const prof = p < 0.78 ? Math.pow(p / 0.78, 1.55) : 1 - Math.pow((p - 0.78) / 0.22, 1.35);
      const mega = fbm(c.n2, x / (s * 0.5) + 9, z / (s * 0.5) - 4, { octaves: 3 }) * 0.5 + 0.5;
      const grain = fbm(c.n2, x / (s * 0.012), z / (s * 0.012), { octaves: 2 }) * 0.03;
      return (prof * (0.35 + mega * 0.75) - 0.32 + grain) * c.amp * 0.19;
    },
    trees: 0,
    rocks: 0.12,
  },
  {
    id: 'saltflat',
    label: 'Salt Flat',
    icon: '🧂',
    palette: 'salt',
    niche: { t: 0.8, tw: 0.2, m: 0.1, mw: 0.14, e: 0.03, ew: 0.1 },
    gate: (c, x, z) => smoothstep(0.1, 0.5, fbm(c.n3, x / (c.scale * 0.9) - 71, z / (c.scale * 0.9) + 33, { octaves: 2 }) + 0.2),
    detail: (c, x, z) => {
      const s = c.scale;
      const pan = c.sea + c.amp * 0.05;
      const pull = clamp(1 - Math.abs(c.baseH - pan) / (c.amp * 0.09), 0, 1);
      const crack = ridged(c.n, x / (s * 0.05), z / (s * 0.05), { octaves: 2 });
      const polygons = -(1 - crest(crack * 2 - 1, 0.9)) * c.amp * 0.006 * c.detail;
      return (pan - c.baseH) * pull * 0.92 + polygons;
    },
    trees: 0,
    rocks: 0.1,
  },
  {
    id: 'canyon',
    label: 'Canyon',
    icon: '🪨',
    palette: 'canyon',
    niche: { t: 0.65, tw: 0.3, m: 0.15, mw: 0.18, e: 0.3, ew: 0.2 },
    gate: (c, x, z) => smoothstep(-0.05, 0.4, fbm(c.n3, x / (c.scale * 1.1) + 55, z / (c.scale * 1.1) + 21, { octaves: 2 })),
    detail: (c, x, z) => {
      const s = c.scale;
      const soft = c.smoothing;
      const cut = ridged(c.n, x / (s * 0.26) + 2, z / (s * 0.26) - 5, { octaves: 5, gain: 0.42 });
      const v = Math.pow(clamp((cut - 0.35) / 0.65, 0, 1), 2.4);
      const steps = terrace((c.baseH - c.sea) / Math.max(1, c.amp * 0.5), 7, soft * 0.8);
      const levelled = steps * Math.max(1, c.amp * 0.5) + c.sea - c.baseH;
      return levelled * 0.55 - v * c.amp * 0.3 * c.detail;
    },
    trees: 0.05,
    rocks: 0.5,
  },
  {
    id: 'badlands',
    label: 'Badlands',
    icon: '🧱',
    palette: 'badlands',
    niche: { t: 0.7, tw: 0.25, m: 0.2, mw: 0.2, e: 0.25, ew: 0.2 },
    gate: (c, x, z) => smoothstep(-0.1, 0.35, fbm(c.n3, x / (c.scale * 0.8) - 39, z / (c.scale * 0.8) - 63, { octaves: 2 })),
    detail: (c, x, z) => {
      const s = c.scale;
      const soft = c.smoothing * 0.7;
      const gully = ridged(c.n, x / (s * 0.13), z / (s * 0.13), { octaves: 4, gain: 0.42 });
      const v = Math.pow(clamp((gully - 0.3) / 0.7, 0, 1), 2.2);
      const steps = terrace((c.baseH - c.sea) / Math.max(1, c.amp * 0.4), 11, soft);
      const levelled = steps * Math.max(1, c.amp * 0.4) + c.sea - c.baseH;
      return levelled * 0.5 - v * c.amp * 0.16 * c.detail;
    },
    trees: 0.02,
    rocks: 0.35,
  },
  {
    id: 'mesa',
    label: 'Mesa',
    icon: '🏔',
    palette: 'mesa',
    niche: { t: 0.72, tw: 0.25, m: 0.18, mw: 0.18, e: 0.38, ew: 0.2 },
    gate: (c, x, z) => smoothstep(-0.05, 0.4, fbm(c.n3, x / (c.scale * 1.3) + 17, z / (c.scale * 1.3) - 88, { octaves: 2 })),
    detail: (c, x, z) => {
      const s = c.scale;
      const soft = c.smoothing * 0.6;
      const cell = fbm(c.n, x / (s * 0.42), z / (s * 0.42), { octaves: 3, gain: 0.45 });
      const stepped = terrace(cell * 0.5 + 0.5, 3, soft);
      const top = smoothstep(0.0, 0.07, stepped - 0.55) * c.amp * 0.2;
      const slope = fbm(c.n2, x / (s * 0.14) + 4, z / (s * 0.14) - 2, { octaves: 4 }) * c.amp * 0.03;
      return top + slope * c.detail - c.amp * 0.06;
    },
    trees: 0.05,
    rocks: 0.5,
  },
  {
    id: 'karst',
    label: 'Karst',
    icon: '🗼',
    palette: 'karst',
    niche: { t: 0.75, tw: 0.25, m: 0.7, mw: 0.3, e: 0.25, ew: 0.2 },
    gate: (c, x, z) => smoothstep(-0.05, 0.4, fbm(c.n3, x / (c.scale * 0.9) - 12, z / (c.scale * 0.9) + 77, { octaves: 2 })),
    detail: (c, x, z) => {
      const s = c.scale;
      // tower clusters: rounded humps carved out of a flat polje floor
      const t = ridged(c.n, x / (s * 0.1) + 8, z / (s * 0.1) - 3, { octaves: 3, gain: 0.42 });
      const tower = Math.pow(clamp((t - 0.42) / 0.58, 0, 1), 1.8) * c.amp * 0.3;
      const floor = c.sea + c.amp * 0.2;
      const pull = clamp(1 - Math.abs(c.baseH - floor) / (c.amp * 0.5), 0, 1);
      const sink = -Math.pow(clamp(billow(c.n2, x / (s * 0.07) + 5, z / (s * 0.07) + 2, { octaves: 2 }) * 0.5 + 0.5, 0, 1), 5) * c.amp * 0.05;
      return softSat(tower * pull * c.detail + sink, c.amp * 0.4);
    },
    trees: 0.4,
    rocks: 0.35,
  },
  {
    id: 'volcanic',
    label: 'Volcanic',
    icon: '🌋',
    palette: 'volcanic',
    niche: { t: 0.5, tw: 0.5, m: 0.5, mw: 0.5, e: 0.5, ew: 0.4 },
    gate: (c, x, z) => smoothstep(0.12, 0.55, fbm(c.n3, x / (c.scale * 1.7) - 23, z / (c.scale * 1.7) + 61, { octaves: 2 })),
    detail: (c, x, z) => {
      const s = c.scale;
      const cone = ridged(c.n, x / (s * 0.36), z / (s * 0.36), { octaves: 4, gain: 0.43 });
      const ash = fbm(c.n2, x / (s * 0.09) + 15, z / (s * 0.09) - 27, { octaves: 3 }) * c.amp * 0.02;
      const flow = -Math.pow(clamp(ridged(c.n2, x / (s * 0.05) - 9, z / (s * 0.05) + 4, { octaves: 2 }), 0, 1), 2) * c.amp * 0.05;
      return softSat((cone - 0.42) * c.amp * 0.3 + ash + flow * c.detail, c.amp * 0.5);
    },
    trees: 0.15,
    rocks: 0.5,
  },
  {
    id: 'craterfield',
    label: 'Crater Field',
    icon: '🕳️',
    palette: 'mars',
    niche: { t: 0.5, tw: WIDE, m: 0.5, mw: WIDE, e: 0.3, ew: 0.55 },
    gate: (c, x, z) => smoothstep(0.05, 0.5, fbm(c.n3, x / (c.scale * 1.4) + 44, z / (c.scale * 1.4) - 52, { octaves: 2 })),
    detail: (c, x, z) => {
      // hash-placed bowls: fully world-space so they tile forever
      const s = c.scale * 0.24;
      const gx = Math.floor(x / s);
      const gz = Math.floor(z / s);
      let out = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const cx = gx + i;
          const cz = gz + j;
          const h1 = fract(Math.sin(cx * 127.1 + cz * 311.7) * 43758.5453);
          const h2 = fract(Math.sin(cx * 269.5 + cz * 183.3) * 24634.6345);
          const px = (cx + 0.15 + h1 * 0.7) * s;
          const pz = (cz + 0.15 + h2 * 0.7) * s;
          const rad = s * (0.12 + h1 * 0.3);
          const d = Math.hypot(x - px, z - pz) / rad;
          if (d > 1.3) continue;
          if (d < 0.85) out -= (1 - (d / 0.85) * (d / 0.85)) * rad * 0.55;
          const rt = (d - 0.9) / 0.34;
          if (rt > -1 && rt < 1) out += (1 - rt * rt) * rad * 0.22;
        }
      }
      return out * c.detail;
    },
    trees: 0,
    rocks: 0.6,
  },
];

function fract(v: number) {
  return v - Math.floor(v);
}

export const BIOME_BY_ID: Record<string, Biome> = Object.fromEntries(BIOMES.map((b) => [b.id, b]));
export const BIOME_INDEX: Record<string, number> = Object.fromEntries(BIOMES.map((b, i) => [b.id, i]));
