import type * as THREE from 'three';

export interface ParamSpec {
  type: 'choice' | 'range' | 'toggle' | 'color' | 'text';
  default: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  label: string;
  affects: 'geometry' | 'colors';
  describe?: string;
}
export const params: Record<string, ParamSpec>;
export const species: Record<string, string>;
export const COLORWAYS: Record<string, Record<string, string>>;
export const presets: Record<string, Record<string, string>>;
export const POSES: string[];
export const rig: Record<string, { axis: string; range: [number, number]; describe?: string }>;
export const detach: string[];
export const night: Record<string, unknown>;
export function createAsset(params?: Record<string, unknown>): THREE.Group;
export function createClips(asset: THREE.Object3D): THREE.AnimationClip[];
export function setPose(asset: THREE.Object3D, name?: string, phase?: number): void;
export default createAsset;
