/**
 * Biome palettes + generation templates.
 *
 * A template no longer owns a bespoke generator: every template configures the
 * shared continuous WorldSampler (base relief + blended biome surface detail),
 * which is what makes biomes — and chunks — blend seamlessly.
 */

export interface PaletteStop {
  t: number;
  c: string;
}

export interface Palette {
  id: string;
  label: string;
  stops: PaletteStop[];
  deep: string;
  shallow: string;
  rock: string;
  snow: string;
  rockSlope: number;
  snowLine: number;
  water: string;
}

const P = (
  id: string,
  label: string,
  stops: PaletteStop[],
  deep: string,
  shallow: string,
  rock: string,
  snow: string,
  rockSlope: number,
  snowLine: number,
  water: string
): Palette => ({ id, label, stops, deep, shallow, rock, snow, rockSlope, snowLine, water });

export const PALETTES: Palette[] = [
  P('temperate', 'Temperate', [
    { t: 0, c: '#c8bd93' }, { t: 0.1, c: '#93a95c' }, { t: 0.32, c: '#5f8a44' },
    { t: 0.58, c: '#4a6b3c' }, { t: 0.8, c: '#7a7b62' }, { t: 1, c: '#b9b6ae' },
  ], '#123a5c', '#3f88a8', '#6e6a60', '#f2f5f7', 0.58, 0.82, '#2b6f8f'),

  P('forest', 'Forest', [
    { t: 0, c: '#8a8c5c' }, { t: 0.15, c: '#4f7a3e' }, { t: 0.4, c: '#33602f' },
    { t: 0.66, c: '#2d4f2c' }, { t: 0.85, c: '#5c5f4a' }, { t: 1, c: '#a7a79c' },
  ], '#123a5c', '#3f88a8', '#5a5548', '#eef4f0', 0.6, 0.86, '#2a6a80'),

  P('alpine', 'Alpine', [
    { t: 0, c: '#6d7a5a' }, { t: 0.25, c: '#57614c' }, { t: 0.5, c: '#7c7a72' },
    { t: 0.72, c: '#9b978f' }, { t: 1, c: '#dcdcd6' },
  ], '#0f3550', '#4f9fb8', '#5b5a55', '#ffffff', 0.44, 0.5, '#286b8c'),

  P('peaks', 'High Peaks', [
    { t: 0, c: '#7d7f78' }, { t: 0.3, c: '#8e8d88' }, { t: 0.58, c: '#a9a8a2' },
    { t: 0.8, c: '#d3d3ce' }, { t: 1, c: '#ffffff' },
  ], '#0d2f4c', '#4a95b0', '#565650', '#ffffff', 0.4, 0.34, '#25678a'),

  P('desert', 'Desert', [
    { t: 0, c: '#e2c48a' }, { t: 0.2, c: '#d9ae6f' }, { t: 0.45, c: '#c98f52' },
    { t: 0.7, c: '#a86a3c' }, { t: 1, c: '#8d5a34' },
  ], '#1d5c72', '#57a7b5', '#8a5a3a', '#f4e6cf', 0.62, 1.2, '#2f7f92'),

  P('dunes', 'Dune Sea', [
    { t: 0, c: '#f0d9a4' }, { t: 0.25, c: '#e3c07d' }, { t: 0.55, c: '#cfa05b' },
    { t: 0.8, c: '#b07f45' }, { t: 1, c: '#96693a' },
  ], '#1d5c72', '#57a7b5', '#a07a48', '#f7ead0', 0.7, 1.25, '#2f8b96'),

  P('savanna', 'Savanna', [
    { t: 0, c: '#c9b276' }, { t: 0.18, c: '#bfa863' }, { t: 0.42, c: '#9c9450' },
    { t: 0.68, c: '#7d7d44' }, { t: 1, c: '#9a8f68' },
  ], '#173f52', '#3d8f95', '#8a7c52', '#efe6cc', 0.6, 1.15, '#2c7d84'),

  P('tropical', 'Tropical', [
    { t: 0, c: '#f0e0ae' }, { t: 0.08, c: '#dcc87e' }, { t: 0.22, c: '#6fae4a' },
    { t: 0.55, c: '#3f7a34' }, { t: 0.82, c: '#6b6a4c' }, { t: 1, c: '#a8a294' },
  ], '#0b3f63', '#3fc8d4', '#7d6a52', '#ffffff', 0.6, 1.3, '#1fa3bd'),

  P('canyon', 'Canyon', [
    { t: 0, c: '#b9744a' }, { t: 0.18, c: '#c98a56' }, { t: 0.38, c: '#a75f39' },
    { t: 0.6, c: '#8c4c30' }, { t: 0.82, c: '#6d3c28' }, { t: 1, c: '#8f6a4c' },
  ], '#173f52', '#3d8f95', '#7d4a30', '#e9dcc6', 0.5, 1.1, '#2c7d84'),

  P('badlands', 'Badlands', [
    { t: 0, c: '#c08a63' }, { t: 0.22, c: '#b0704c' }, { t: 0.45, c: '#8f5638' },
    { t: 0.66, c: '#7a4a54' }, { t: 0.85, c: '#6b4550' }, { t: 1, c: '#9c7a6a' },
  ], '#173f52', '#3d8f95', '#7a4a44', '#e6d6c2', 0.48, 1.15, '#2c7d84'),

  P('mesa', 'Mesa', [
    { t: 0, c: '#c98f5c' }, { t: 0.2, c: '#b8743f' }, { t: 0.45, c: '#96562f' },
    { t: 0.7, c: '#77432a' }, { t: 1, c: '#a2714a' },
  ], '#173f52', '#3d8f95', '#7a4c30', '#e9dcc6', 0.46, 1.2, '#2c7d84'),

  P('tundra', 'Tundra', [
    { t: 0, c: '#8d8f76' }, { t: 0.22, c: '#7d8266' }, { t: 0.48, c: '#69755a' },
    { t: 0.72, c: '#7d7d70' }, { t: 1, c: '#c3c2b4' },
  ], '#102f47', '#3d7f9c', '#5f6154', '#eef2f4', 0.55, 0.72, '#256a86'),

  P('glacier', 'Glacier', [
    { t: 0, c: '#8fa3ab' }, { t: 0.2, c: '#a9c0c6' }, { t: 0.45, c: '#c9dbe0' },
    { t: 0.7, c: '#e4eef1' }, { t: 1, c: '#ffffff' },
  ], '#0a2c46', '#4fa8c9', '#5d6a72', '#ffffff', 0.64, 0.3, '#2e86a8'),

  P('volcanic', 'Volcanic', [
    { t: 0, c: '#2b2724' }, { t: 0.2, c: '#3a332e' }, { t: 0.42, c: '#4b4038' },
    { t: 0.62, c: '#5a4a3e' }, { t: 0.85, c: '#6b5341' }, { t: 1, c: '#8a6a4e' },
  ], '#0d1a1f', '#2d5a63', '#332d29', '#c9c2b8', 0.38, 0.88, '#2a4b52'),

  P('karst', 'Karst', [
    { t: 0, c: '#9fb08a' }, { t: 0.2, c: '#7e9a6a' }, { t: 0.45, c: '#6a8a63' },
    { t: 0.7, c: '#8d9683' }, { t: 1, c: '#c2c4b6' },
  ], '#0f3550', '#3f9aa8', '#8a8f80', '#eef4f0', 0.5, 1.1, '#2b7f8f'),

  P('salt', 'Salt Flats', [
    { t: 0, c: '#f2eee6' }, { t: 0.25, c: '#e6dccd' }, { t: 0.5, c: '#d8c9b4' },
    { t: 0.75, c: '#c0ab93' }, { t: 1, c: '#b09a80' },
  ], '#1d5c72', '#7fc0c8', '#b9a88a', '#ffffff', 0.75, 1.3, '#57b6c0'),

  P('marsh', 'Marsh', [
    { t: 0, c: '#8f9163' }, { t: 0.16, c: '#7d8a52' }, { t: 0.4, c: '#5f7742' },
    { t: 0.66, c: '#4a6338' }, { t: 1, c: '#7d7d5e' },
  ], '#16283a', '#4a8a70', '#5f6046', '#e8eef0', 0.7, 1.1, '#3c7a68'),

  P('mars', 'Cratered', [
    { t: 0, c: '#8c4a2f' }, { t: 0.25, c: '#a45a36' }, { t: 0.5, c: '#b96c40' },
    { t: 0.75, c: '#c9835a' }, { t: 1, c: '#dcae8a' },
  ], '#3a2318', '#7a4a30', '#6d3a26', '#e8dfd5', 0.55, 1.25, '#7a4a30'),

  P('alien', 'Alien', [
    { t: 0, c: '#2a1d47' }, { t: 0.25, c: '#41306b' }, { t: 0.5, c: '#5e4b96' },
    { t: 0.72, c: '#7f6fb5' }, { t: 1, c: '#c0b3e8' },
  ], '#120a26', '#3fa3a8', '#3b2f5e', '#d6f0ff', 0.5, 0.82, '#3fd0c0'),
];

export const PALETTE_BY_ID: Record<string, Palette> = Object.fromEntries(PALETTES.map((p) => [p.id, p]));

/* ------------------------------------------------------------------ */
/* templates                                                           */
/* ------------------------------------------------------------------ */

export type Landmark = 'none' | 'volcano' | 'craters' | 'island' | 'atoll' | 'mesacity';

export interface Template {
  id: string;
  label: string;
  icon: string;
  blurb: string;
  group: 'classic' | 'new' | 'mega';
  /** metres — master wavelength of the whole relief system */
  scale: number;
  amplitude: number;
  seaLevelPct: number;
  water: boolean;
  /** shifts the continent field up/down: -1 basins, +1 highland */
  baseBias: number;
  /** mountain belt intensity 0..1.6 */
  ridge: number;
  /** high frequency multiplier */
  detail: number;
  /** domain warp amount */
  warp: number;
  /** 0..1 crest rounding (higher = smoother, less spiky) */
  smoothing: number;
  /** restrict to one biome, or blend them all */
  forceBiome?: string;
  /** optional tile-mode focal feature */
  landmark?: Landmark;
  trees: number;
  rocks: number;
  /** optional fixed palette override in tile mode */
  palette?: string;
}

export const TEMPLATES: Template[] = [
  /* --------------------------- classics ---------------------------- */
  {
    id: 'alpine', label: 'Alpine Ridges', icon: '⛰️', group: 'classic',
    blurb: 'Snow-capped ridges and cirques above the treeline.',
    scale: 340, amplitude: 62, seaLevelPct: -0.42, water: false,
    baseBias: 0.42, ridge: 1.35, detail: 1.0, warp: 0.7, smoothing: 0.55,
    forceBiome: 'mountains', trees: 0.15, rocks: 0.55,
  },
  {
    id: 'hills', label: 'Rolling Hills', icon: '🌾', group: 'classic',
    blurb: 'Gentle pastoral hills, wide valleys, soft shoulders.',
    scale: 300, amplitude: 26, seaLevelPct: -0.6, water: false,
    baseBias: 0.12, ridge: 0.2, detail: 0.9, warp: 0.35, smoothing: 0.8,
    forceBiome: 'hills', trees: 0.45, rocks: 0.2,
  },
  {
    id: 'islands', label: 'Archipelago', icon: '🏝️', group: 'classic',
    blurb: 'Tropical islands, reefs and lagoons on a warm shelf.',
    scale: 420, amplitude: 38, seaLevelPct: 0.05, water: true,
    baseBias: -0.1, ridge: 0.45, detail: 1.0, warp: 0.5, smoothing: 0.7,
    forceBiome: 'beach', trees: 0.5, rocks: 0.25,
  },
  {
    id: 'dunes', label: 'Desert Dunes', icon: '🏜️', group: 'classic',
    blurb: 'Transverse dunes with long windward slopes and slip faces.',
    scale: 260, amplitude: 24, seaLevelPct: -0.9, water: false,
    baseBias: 0.05, ridge: 0.15, detail: 1.1, warp: 0.4, smoothing: 0.75,
    forceBiome: 'dunes', trees: 0, rocks: 0.15,
  },
  {
    id: 'canyon', label: 'Canyon Maze', icon: '🪨', group: 'classic',
    blurb: 'Layered plateau sliced by deep dendritic canyons.',
    scale: 380, amplitude: 46, seaLevelPct: -0.8, water: false,
    baseBias: 0.28, ridge: 0.55, detail: 1.0, warp: 0.6, smoothing: 0.5,
    forceBiome: 'canyon', trees: 0.05, rocks: 0.5,
  },
  {
    id: 'volcano', label: 'Volcano', icon: '🌋', group: 'classic',
    blurb: 'A single stratovolcano with caldera and ash aprons.',
    scale: 320, amplitude: 58, seaLevelPct: -0.75, water: false,
    baseBias: 0.1, ridge: 0.5, detail: 0.9, warp: 0.4, smoothing: 0.65,
    forceBiome: 'volcanic', landmark: 'volcano', trees: 0.2, rocks: 0.4,
  },
  {
    id: 'fjord', label: 'Glacial Fjords', icon: '🧊', group: 'classic',
    blurb: 'Steep peaks drowned by deep, twisting inlets.',
    scale: 400, amplitude: 66, seaLevelPct: 0.1, water: true,
    baseBias: 0.3, ridge: 1.15, detail: 1.0, warp: 0.85, smoothing: 0.55,
    forceBiome: 'glacier', trees: 0.1, rocks: 0.45,
  },
  {
    id: 'craters', label: 'Cratered Plain', icon: '🕳️', group: 'classic',
    blurb: 'Ancient impact plain pocked with bowl craters and rims.',
    scale: 300, amplitude: 20, seaLevelPct: -0.85, water: false,
    baseBias: 0.05, ridge: 0.2, detail: 0.9, warp: 0.3, smoothing: 0.7,
    forceBiome: 'craterfield', landmark: 'craters', trees: 0, rocks: 0.6,
  },
  {
    id: 'river', label: 'River Valley', icon: '🏞️', group: 'classic',
    blurb: 'A meandering channel cut through a soft floodplain.',
    scale: 340, amplitude: 30, seaLevelPct: -0.3, water: true,
    baseBias: 0.0, ridge: 0.3, detail: 0.95, warp: 0.5, smoothing: 0.75,
    forceBiome: 'marsh', landmark: 'none', trees: 0.5, rocks: 0.2,
  },
  {
    id: 'badlands', label: 'Badlands', icon: '🧱', group: 'classic',
    blurb: 'Eroded clay spires, gullies and terraced slopes.',
    scale: 300, amplitude: 26, seaLevelPct: -0.85, water: false,
    baseBias: 0.12, ridge: 0.35, detail: 1.25, warp: 0.55, smoothing: 0.45,
    forceBiome: 'badlands', trees: 0.02, rocks: 0.4,
  },
  {
    id: 'plateau', label: 'Mesa Plateau', icon: '🏔️', group: 'classic',
    blurb: 'Flat-topped mesas rising above a broken plain.',
    scale: 420, amplitude: 50, seaLevelPct: -0.85, water: false,
    baseBias: 0.22, ridge: 0.4, detail: 0.95, warp: 0.4, smoothing: 0.5,
    forceBiome: 'mesa', trees: 0.05, rocks: 0.5,
  },
  {
    id: 'marsh', label: 'Marsh Flats', icon: '🪷', group: 'classic',
    blurb: 'Saturated wetlands, oxbow ponds and reed banks.',
    scale: 240, amplitude: 12, seaLevelPct: 0.02, water: true,
    baseBias: -0.05, ridge: 0.1, detail: 1.0, warp: 0.35, smoothing: 0.85,
    forceBiome: 'marsh', trees: 0.3, rocks: 0.1,
  },

  /* ----------------------------- new ------------------------------- */
  {
    id: 'coast', label: 'Coastal Shelf', icon: '🌊', group: 'new',
    blurb: 'Sea cliffs, wave-cut platforms and long sandy bays.',
    scale: 460, amplitude: 44, seaLevelPct: 0.0, water: true,
    baseBias: 0.05, ridge: 0.55, detail: 1.05, warp: 0.6, smoothing: 0.7,
    forceBiome: 'coast', trees: 0.4, rocks: 0.35,
  },
  {
    id: 'lochs', label: 'Highland Lochs', icon: '🏴', group: 'new',
    blurb: 'Moorland plateaux studded with cold freshwater lochs.',
    scale: 380, amplitude: 40, seaLevelPct: -0.16, water: true,
    baseBias: 0.2, ridge: 0.6, detail: 1.0, warp: 0.65, smoothing: 0.7,
    forceBiome: 'tundra', trees: 0.25, rocks: 0.35,
  },
  {
    id: 'savanna', label: 'Savanna Basin', icon: '🦁', group: 'new',
    blurb: 'Golden grasslands broken by rocky kopjes and dry pans.',
    scale: 400, amplitude: 22, seaLevelPct: -0.7, water: false,
    baseBias: 0.08, ridge: 0.25, detail: 0.95, warp: 0.4, smoothing: 0.8,
    forceBiome: 'savanna', trees: 0.18, rocks: 0.35,
  },
  {
    id: 'tundra', label: 'Tundra Expanse', icon: '🦌', group: 'new',
    blurb: 'Frost-shattered permaflats, pingos and braided meltwater.',
    scale: 320, amplitude: 16, seaLevelPct: -0.55, water: true,
    baseBias: 0.02, ridge: 0.18, detail: 1.15, warp: 0.45, smoothing: 0.8,
    forceBiome: 'tundra', trees: 0.05, rocks: 0.3,
  },
  {
    id: 'karst', label: 'Karst Towers', icon: '🗼', group: 'new',
    blurb: 'Steep-sided limestone towers rising from green polje.',
    scale: 340, amplitude: 46, seaLevelPct: -0.6, water: false,
    baseBias: 0.1, ridge: 0.5, detail: 1.1, warp: 0.5, smoothing: 0.6,
    forceBiome: 'karst', landmark: 'mesacity', trees: 0.4, rocks: 0.4,
  },
  {
    id: 'delta', label: 'River Delta', icon: '🐊', group: 'new',
    blurb: 'Braided distributaries fanning into reed-choked mudflats.',
    scale: 300, amplitude: 10, seaLevelPct: 0.0, water: true,
    baseBias: -0.12, ridge: 0.1, detail: 1.2, warp: 0.5, smoothing: 0.85,
    forceBiome: 'marsh', landmark: 'none', trees: 0.35, rocks: 0.08,
  },
  {
    id: 'salt', label: 'Salt Flats', icon: '🧂', group: 'new',
    blurb: 'Cracked mineral pans shimmering under a thin water film.',
    scale: 280, amplitude: 8, seaLevelPct: -0.02, water: true,
    baseBias: -0.14, ridge: 0.1, detail: 1.3, warp: 0.35, smoothing: 0.9,
    forceBiome: 'saltflat', trees: 0, rocks: 0.15,
  },
  {
    id: 'erg', label: 'Erg Dune Sea', icon: '🐪', group: 'new',
    blurb: 'Vast star dunes and long seif ridges in deep desert.',
    scale: 520, amplitude: 46, seaLevelPct: -0.9, water: false,
    baseBias: 0.12, ridge: 0.3, detail: 1.05, warp: 0.5, smoothing: 0.7,
    forceBiome: 'dunes', trees: 0, rocks: 0.12,
  },
  {
    id: 'isles', label: 'Volcanic Isles', icon: '🗻', group: 'new',
    blurb: 'Steam-venting peaks scattered across a warm ocean.',
    scale: 520, amplitude: 54, seaLevelPct: 0.06, water: true,
    baseBias: -0.06, ridge: 0.95, detail: 1.0, warp: 0.6, smoothing: 0.65,
    forceBiome: 'volcanic', landmark: 'island', trees: 0.3, rocks: 0.4,
  },
  {
    id: 'atoll', label: 'Atoll Lagoon', icon: '🐠', group: 'new',
    blurb: 'A coral ring guarding a shallow turquoise lagoon.',
    scale: 360, amplitude: 18, seaLevelPct: -0.02, water: true,
    baseBias: -0.2, ridge: 0.2, detail: 1.1, warp: 0.55, smoothing: 0.85,
    forceBiome: 'beach', landmark: 'atoll', trees: 0.4, rocks: 0.15,
  },

  /* ----------------------------- mega ------------------------------ */
  {
    id: 'realms', label: 'Endless Realms', icon: '🌐', group: 'mega',
    blurb: 'Massive multi-environment world: oceans, deserts, forests, glaciers and peaks blending seamlessly as you travel.',
    scale: 1400, amplitude: 96, seaLevelPct: -0.06, water: true,
    baseBias: 0.05, ridge: 1.0, detail: 1.0, warp: 0.75, smoothing: 0.7,
    trees: 0.5, rocks: 0.4,
  },
];

export const TEMPLATE_BY_ID: Record<string, Template> = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

export const TEMPLATE_GROUPS: { id: Template['group']; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'new', label: 'New' },
  { id: 'mega', label: 'Multi-Environment' },
];

/* ------------------------------------------------------------------ */
/* colour helpers                                                      */
/* ------------------------------------------------------------------ */

const hexCache = new Map<string, [number, number, number]>();
export function hexToRgb(hex: string): [number, number, number] {
  const cached = hexCache.get(hex);
  if (cached) return cached;
  const v = parseInt(hex.replace('#', ''), 16);
  const out: [number, number, number] = [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
  hexCache.set(hex, out);
  return out;
}

export function sampleStops(stops: PaletteStop[], t: number, out: Float32Array | number[]) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  let i = 0;
  while (i < stops.length - 2 && x > stops[i + 1].t) i++;
  const a = stops[i];
  const b = stops[Math.min(i + 1, stops.length - 1)];
  const span = b.t - a.t || 1e-6;
  const f = Math.min(1, Math.max(0, (x - a.t) / span));
  const ca = hexToRgb(a.c);
  const cb = hexToRgb(b.c);
  out[0] = ca[0] + (cb[0] - ca[0]) * f;
  out[1] = ca[1] + (cb[1] - ca[1]) * f;
  out[2] = ca[2] + (cb[2] - ca[2]) * f;
}
