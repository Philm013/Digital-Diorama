import type { Group } from 'three';
import type { ParamSchema } from './infinite-terrain';

export const SHAPES: Record<string, { radius: number; height: number; label: string }>;
export const shapeDefaults: typeof SHAPES;
export const COLORWAYS: Record<string, Record<string, string>>;
export const presets: Record<string, Record<string, string>>;
export const params: Record<string, ParamSchema>;
export const rig: Record<string, { axis: string; range: number[]; describe: string }>;
export const detach: string[];
export const night: Record<string, never>;
export function createAsset(options?: Record<string, unknown>): Group;
export default createAsset;
