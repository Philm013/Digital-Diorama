import type { Group, Material, Mesh, BufferGeometry, MeshStandardMaterial, Color } from 'three';

export interface BiomeSpeciesWeights { [species: string]: number }

export interface Biome {
  id: string; name: string; index?: number;
  floor: number; r: number; s: number; d: number; f: number;
  carve: number; cold: number; arid: number; canopy: number; scree: number;
  species: BiomeSpeciesWeights;
  colors: { low: string; mid: string; high: string; steep: string };
}

export interface WorldPreset {
  name: string; biomeScale: number; relief: number; feature: number;
  roughness: number; erosion: number; waterLevel: number; snowline: number;
  colorway: string; mix: string[];
}

export interface ParamSchema {
  type: 'choice' | 'range' | 'toggle' | 'color';
  default: string | number | boolean;
  label: string; affects: 'geometry' | 'colors'; describe: string;
  min?: number; max?: number; step?: number; options?: (string | number)[];
}

export interface Stroke {
  mode: string; r: number; k: number; y?: number; linear?: boolean; points: number[]; step?: number;
}

export interface WorldParams {
  [key: string]: unknown;
  world: string; seed: number; relief: number; biomeScale: number; feature: number;
  roughness: number; erosion: number; waterLevel: number; oceanDepth: number; snowline: number;
  canopy: number; scree: number; chunkSize: number; segments: number; colorway: string;
  waterSurface: boolean; skirt: boolean; mergeForProduction: boolean; patchChunks: number;
  mix: number[]; zones: Record<string, number>; overrides: Record<string, number>;
  strokes: Stroke[];
}

export interface ChunkMesh extends Mesh<BufferGeometry, Material> {
  userData: {
    chunk?: { cx: number; cz: number; size: number; key: string };
    grid: { heights: Float32Array; colors: Float32Array; segs: number; n: number; step: number; x0: number; z0: number };
    triangles?: number; fade?: number; opacity?: number;
  };
}

export interface WaterMesh extends Mesh<BufferGeometry, MeshStandardMaterial> {
  userData: { baseY: number; wave: (time: number, x?: number, z?: number) => void };
}

export interface BiomeReport {
  primary: string; primaryName: string; weight: number; transition?: number;
  blend: { id: string; name: string; weight: number } | null;
  weights: { id: string; name: string; weight: number }[];
}

export interface Ecology {
  tree: number; rock: number; species: BiomeSpeciesWeights;
  cold: number; arid: number; canopy: number; above: number;
}

export const BIOMES: Biome[];
export const GENERATOR_VERSION: number;
export const COORDINATE_LIMIT: number;
export function validateStroke(stroke: Stroke): Stroke;
export const biomeById: Record<string, Biome>;
export const biomeNames: Record<string, string>;
export const WORLDS: Record<string, WorldPreset>;
export const worldPresets: Record<string, WorldPreset>;
export const COLORWAYS: Record<string, Record<string, string>>;
export const presets: Record<string, Record<string, string>>;
export const params: Record<string, ParamSchema>;
export const rig: Record<string, { axis: string; range: number[] | string; describe: string }>;
export const detach: string[];
export const night: Record<string, { color: string; intensity: number; distance: number; describe: string }>;

export function createParams(overrides?: Record<string, unknown>): WorldParams;
export function worldDefaults(id?: string): Record<string, unknown>;
export function buildChunk(p: WorldParams, cx: number, cz: number, options?: { segments?: number; merge?: boolean; material?: Material; skirt?: boolean }): ChunkMesh;
export function createWater(p: WorldParams, span?: number, material?: Material): WaterMesh;
export function sampleHeight(x: number, z: number, p: WorldParams): number;
export function sampleHeightWith(x: number, z: number, p: WorldParams, strokes: Stroke[] | null): number;
export function sampleBiomes(x: number, z: number, p: WorldParams): BiomeReport;
export function sampleSurface(x: number, z: number, p: WorldParams): {
  height: number; slope: number; cold: number; arid: number; canopy: number; scree: number;
  species: BiomeSpeciesWeights; biomes: BiomeReport;
};
export function ecologyAt(x: number, z: number, p: WorldParams, height: number, slope: number): Ecology;
export function canopyAt(x: number, z: number, p: WorldParams): number;
export function screeAt(x: number, z: number, p: WorldParams): number;
export function sampleColor(x: number, z: number, height: number, slope: number, p: WorldParams, out?: Color): Color;
export function hash2(x: number, z: number, seed: number): number;
export function heightOnGrid(grid: ChunkMesh['userData']['grid'], x: number, z: number): number;
export function createAsset(options?: Record<string, unknown>): Group;
export default createAsset;
