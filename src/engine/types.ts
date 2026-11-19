export type Quality = 'low' | 'medium' | 'high';
export type FrameStyle = 'shoebox' | 'museum' | 'island' | 'open';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Mode = 'explore' | 'build' | 'code';

export interface TerrainDoc {
  width: number;
  depth: number;
  nx: number;
  nz: number;
  /** base64 Int16 heights in centimetres */
  heights: string;
  /** base64 Uint8 ground-type index per vertex */
  paint: string;
  waterLevel: number | null;
  strata: string;
  seed: number;
}

export type BaseDoc =
  | { kind: 'terrain'; terrain: TerrainDoc }
  | { kind: 'asset'; asset: string; params: Record<string, unknown> };

export interface EnvDoc {
  time: number;
  daySpeed: number;
  weather: Weather;
  fog: number;
  wind: number;
  season: Season;
  frame: FrameStyle;
  backdrop: string;
  grass: number;
  trueScale: boolean;
  labels: boolean;
  underwater: boolean;
}

export interface ActorDoc {
  id: string;
  asset: string;
  name: string;
  params: Record<string, unknown>;
  pos: [number, number, number];
  rotY: number;
  scale: number;
  /** height above the ground (flyers, swimmers) */
  lift: number;
  /** y follows the ground + lift; false when perched on another object */
  grounded: boolean;
  label?: { show: boolean; text?: string };
  note?: string;
  scripts?: unknown;
  ambient?: boolean;
  hidden?: boolean;
}

export interface DioramaDoc {
  format: 'digital-diorama';
  version: 1;
  id: string;
  title: string;
  author: string;
  description: string;
  biome: string;
  created: number;
  updated: number;
  base: BaseDoc;
  env: EnvDoc;
  actors: ActorDoc[];
  worldScripts?: unknown;
  tour?: string[];
  /** game progress for this diorama: completed quests and one-off moments */
  progress?: { quests?: string[]; flags?: string[]; seasons?: string[] };
}

export const DEFAULT_ENV: EnvDoc = {
  time: 10.5,
  daySpeed: 0,
  weather: 'clear',
  fog: 0,
  wind: 0.35,
  season: 'summer',
  frame: 'shoebox',
  backdrop: 'meadow',
  grass: 1,
  trueScale: false,
  labels: true,
  underwater: false,
};

/* ---------- typed array <-> base64 ---------- */
export function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)));
  return btoa(s);
}
export function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
