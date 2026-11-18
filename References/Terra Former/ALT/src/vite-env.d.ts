/// <reference types="vite/client" />

declare module '*.mjs' {
  import type { Group } from 'three';
  export interface ParameterSchema {
    type: 'choice' | 'range' | 'toggle' | 'color';
    default: string | number | boolean;
    label: string;
    affects: 'geometry' | 'colors';
    describe: string;
    min?: number;
    max?: number;
    step?: number;
    options?: (string | number)[];
  }
  export const params: Record<string, ParameterSchema>;
  export const sceneParams: Record<string, ParameterSchema>;
  export const COLORWAYS: Record<string, Record<string, string>>;
  export const presets: Record<string, Record<string, string>>;
  export const night: Record<string, { color: string; intensity: number; distance: number; describe: string }>;
  export const rig: Record<string, { axis: string; range: number[]; describe: string }>;
  export const detach: string[];
  export function createAsset(options?: Record<string, unknown>): Group;
  export function createScene(options?: Record<string, unknown>, heights?: number[] | null): Group;
  export default createAsset;
}