import type { TerrainRecipe } from '../engine/terrainGen';
import type { EnvDoc } from '../engine/types';

export interface Placement {
  asset: string;
  /** fixed position [x, z] */
  at?: [number, number];
  /** scatter: number of copies */
  count?: number;
  /** scatter region [x, z, radius] (defaults to the whole base) */
  area?: [number, number, number];
  where?: 'dry' | 'wet' | 'any' | 'shore';
  params?: Record<string, unknown>;
  scale?: number | [number, number];
  lift?: number;
  name?: string;
  label?: string;
  note?: string;
  rotY?: number;
  /** keep apart from other placements by this distance */
  spacing?: number;
  skipOnLow?: boolean;
  scripts?: unknown;
  grounded?: boolean;
}

export interface BiomeGuide {
  summary: string;
  climate: string;
  where: string;
  adaptations: string[];
  threats: string[];
  vocab: [string, string][];
  questions: string[];
}

export interface BiomeTemplate {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  accent: string;
  terrain?: TerrainRecipe;
  base?: { asset: string; params: Record<string, unknown> };
  env: Partial<EnvDoc>;
  placements: Placement[];
  guide: BiomeGuide;
}
