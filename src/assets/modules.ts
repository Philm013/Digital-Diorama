import type * as THREE from 'three';

/** Shape shared by every procedural asset module in src/assets/models/. */
export interface ParamSpec {
  type: 'range' | 'choice' | 'toggle' | 'color' | 'text';
  default: unknown;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: (string | number)[];
  label?: string;
  affects?: string;
  describe?: string;
  group?: string;
}
export interface AssetModule {
  createAsset: (p?: Record<string, unknown>) => THREE.Object3D;
  params?: Record<string, ParamSpec>;
  rig?: Record<string, { axis: string; range: [number, number]; type?: string; speed?: number; phase?: number; describe?: string }>;
  createClips?: (asset: THREE.Object3D) => THREE.AnimationClip[];
  getSchema?: (config: unknown) => Record<string, ParamSpec>;
  getRig?: (config: unknown) => Record<string, { axis: string; range: [number, number] }>;
  info?: Record<string, string>;
  [k: string]: unknown;
}

// Lazy loaders — Vite turns every asset module into its own chunk (a family's shared kit.mjs is not a module of its own).
const LOADERS = import.meta.glob<AssetModule>([
  '/src/assets/models/rigs/*-rig.mjs',
  '/src/assets/models/wildform/wildform.mjs',
  '/src/assets/models/water/*.mjs',
  '!/src/assets/models/water/kit.mjs',
  '/src/assets/models/beach/*.mjs',
  '/src/assets/models/aquarium/*.mjs',
  '/src/assets/models/plants/*.mjs',
  '/src/assets/models/rocks/*.mjs',
  '/src/assets/models/flora/trees.ts',
  '/src/assets/models/flora/herbs.ts',
]);

const M = '/src/assets/models';
export const MODULE_PATHS = {
  mammal: `${M}/rigs/mammal-rig.mjs`,
  bird: `${M}/rigs/bird-rig.mjs`,
  herp: `${M}/rigs/herp-rig.mjs`,
  wildform: `${M}/wildform/wildform.mjs`,
  plant: `${M}/plants/worldflora.mjs`,
  deciduous: `${M}/plants/deciduous.mjs`,
  rock: `${M}/rocks/field-rock.mjs`,
  water: (id: string) => `${M}/water/${id}.mjs`,
  beach: (id: string) => `${M}/beach/${id}.mjs`,
  aquarium: (id: string) => `${M}/aquarium/${id}.mjs`,
  flora: (id: 'trees' | 'herbs') => `${M}/flora/${id}.ts`,
} as const;

const cache = new Map<string, Promise<AssetModule>>();
const resolved = new Map<string, AssetModule>();

export function loadModule(path: string): Promise<AssetModule> {
  let p = cache.get(path);
  if (!p) {
    const loader = LOADERS[path];
    if (!loader) return Promise.reject(new Error('Unknown asset module: ' + path));
    p = loader().then((m) => { resolved.set(path, m); return m; });
    cache.set(path, p);
  }
  return p;
}
export function loadedModule(path: string) { return resolved.get(path); }
/** Dev tools (the animal workbench) swap in a freshly imported copy after its source is edited. */
export function replaceModule(path: string, mod: AssetModule) {
  cache.set(path, Promise.resolve(mod));
  resolved.set(path, mod);
}
export function hasModule(path: string) { return path in LOADERS; }
