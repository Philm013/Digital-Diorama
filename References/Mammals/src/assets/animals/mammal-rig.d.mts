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
/**
 * `userData` of the gait clips (walk, trot, gallop): the distance one cycle covers and the pace it was timed for, so a
 * player can run the clip at the rate that keeps the planted feet still (rate = ground speed × duration / stride, in
 * model units). The bird rig's walk carries the same fields (Digital Diorama revision 8). Other clips carry `{ loop }`.
 */
export interface GaitClipData {
  loop: true;
  /** footfall pattern: walk, trot, pace, amble, gallop, rotary, bound */
  gait: string;
  /** model units per cycle */
  stride: number;
  /** the clip's own pace, stride / duration (model units a second) */
  speed: number;
  /** hip joint height (model units), for Froude-number gait choice */
  hipH: number;
  /** Froude number the clip was timed for (mammals) */
  fr?: number;
}
export function createClips(asset: THREE.Object3D): THREE.AnimationClip[];
export function setPose(asset: THREE.Object3D, name?: string, phase?: number): void;
export default createAsset;
