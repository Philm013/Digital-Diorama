import type * as THREE from 'three';

export interface ModuleInfo { key: string; file: string; label: string; fixed?: boolean }
export interface ThemeInfo {
  label: string; water: string; accent: string; blurb: string;
  palette: Record<string, string>;
  waterTint: string; waterOpacity: number; causticColor: string;
  room: { floor: string; wall: string; sky: string; ground: string; key: number; hemi: number };
  defaults: Record<string, unknown>;
}
export type Opts = Record<string, any> & { modules: Record<string, boolean> };
export interface AquariumBuild {
  root: THREE.Group;
  update: (t: number, dt: number) => void;
  dispose: () => void;
  focus: THREE.Vector3;
  stats: { tris: number; meshes: number };
  audit: { vertices: number; outsideFootprint: number; aboveSurface: number; parts: number };
  dims: { outerW: number; outerD: number; height: number; topY: number };
}
export const MODULES: ModuleInfo[];
export const THEMES: Record<string, ThemeInfo>;
export const COMMON_DEFAULTS: Record<string, unknown>;
export function themeDefaults(key: string): Opts;
export function buildAquarium(themeKey: string, opts: Opts): AquariumBuild;
