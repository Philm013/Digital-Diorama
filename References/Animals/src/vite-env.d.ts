/// <reference types="vite/client" />

declare module '*.mjs' {
  import type { Group } from 'three';
  export interface Parameter {
    type: 'choice' | 'range' | 'toggle' | 'color';
    default: string | number | boolean;
    label: string;
    affects: 'geometry' | 'colors';
    describe: string;
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
  }
  export function createAsset(options?: Record<string, unknown>): Group;
  export function getSchema(config?: Record<string, unknown>): Record<string, Parameter>;
  export function getColorways(config?: Record<string, unknown>): Record<string, Record<string, string>>;
  export function getRig(config?: Record<string, unknown>): Record<string, { axis: 'x' | 'y' | 'z'; range: number[]; describe: string }>;
  export const params: Record<string, Parameter>;
  export const COLORWAYS: Record<string, Record<string, string>>;
  export const presets: typeof COLORWAYS;
  export const rig: Record<string, { axis: 'x' | 'y' | 'z'; range: number[]; describe: string }>;
  export const detach: string[];
  export const night: Record<string, { color: string; intensity: number; distance: number; describe: string }>;
  export default createAsset;
}