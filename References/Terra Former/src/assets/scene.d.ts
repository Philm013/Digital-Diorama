import type { Group, MeshStandardMaterial } from 'three';
import type { ChunkMesh, ParamSchema, Stroke, WaterMesh, WorldParams } from './infinite-terrain';

export interface SceneOptions {
  radius: number; skip: number; vegetation: boolean; rocks: boolean; propBudget: number;
  [key: string]: unknown;
}

export interface WorldStats {
  triangles: number; chunks: number; props: number; pending: number; drawCalls: number;
}

export interface World {
  group: Group;
  params: WorldParams;
  sceneOptions: SceneOptions;
  chunks: Map<string, ChunkMesh>;
  water: WaterMesh | null;
  origin: { x: number; z: number };
  centre: { cx: number; cz: number };
  renderOrigin: { x: number; z: number };
  landMaterial: MeshStandardMaterial;
  propMaterial: MeshStandardMaterial;
  readonly revision: number;
  waterOffset: number;
  activeStroke: Stroke | null;
  readonly strokeCount: number;
  heightAt(x: number, z: number): number;
  update(x: number, z: number, settings?: { budget?: number; timeBudget?: number }): { loaded: number; pending: number };
  surfaceAt(x: number, z: number): number;
  setRenderOrigin(x: number, z: number): void;
  flush(): void;
  tick(time: number): void;
  setSceneOption(key: string, value: unknown): boolean;
  setParams(next: Record<string, unknown>): WorldParams;
  setStrokes(strokes: Stroke[]): number;
  beginStroke(stroke: { mode: string; r: number; k: number; y?: number; linear?: boolean; x: number; z: number }): Stroke | null;
  extendStroke(x: number, z: number): Stroke | null;
  endStroke(): Stroke | null;
  cancelStroke(): void;
  addStroke(stroke: Stroke): number;
  rebuildTerrain(): void;
  stats(): WorldStats;
  dispose(): void;
}

export const sceneParams: Record<string, ParamSchema>;
export function createWorld(options?: Record<string, unknown>): World;
export default createWorld;
