declare module "*.mjs" {
  import type * as THREE from "three";

  export const species: Record<string, { label: string; scientific: string }>;
  export const params: Record<string, {
    type: "choice" | "range" | "toggle" | "color" | "text";
    default: string | number | boolean;
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
    label: string;
    describe: string;
  }>;
  export function createAsset(options?: Record<string, unknown>): THREE.Group;
  export function createClips(asset: THREE.Object3D): THREE.AnimationClip[];
  export function setPose(asset: THREE.Object3D, name?: string, phase?: number): boolean;
}