/// <reference types="vite/client" />
declare module '*.mjs' {
  import type { Group, Scene } from 'three';
  export const params: Record<string, { type: 'choice' | 'range' | 'toggle' | 'color' | 'text'; default: string | number | boolean; label: string; affects: 'geometry' | 'colors'; describe: string; min?: number; max?: number; step?: number; options?: string[] }>;
  export const COLORWAYS: Record<string, Record<string, string>>;
  export const presets: typeof COLORWAYS;
  export const rig: Record<string, { axis: string; range: number[]; describe: string }>;
  export const detach: string[];
  export const night: Record<string, { color: string; intensity: number; distance: number; describe: string }>;
  export function createAsset(options?: Record<string, unknown>): Group;
  export function createScene(scene: Scene | Group, options?: Record<string, unknown>): Group;
  export default createAsset;
}