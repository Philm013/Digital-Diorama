import type * as THREE from 'three';

/** Shape shared by every procedural asset module in References/. */
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

// Lazy loaders — Vite turns every reference module into its own chunk.
const LOADERS = import.meta.glob<AssetModule>([
  '/References/water-world/assets/*.mjs',
  '/References/Mammals/src/assets/animals/mammal-rig.mjs',
  '/References/Birds/src/assets/bird-rig.mjs',
  '/References/Animals/src/engine/animal.mjs',
  '/References/Reptiles/src/models/*.mjs',
  '/References/plants .mjs',
  '/References/parametric-deciduous.mjs',
  '/References/parametric-conifer.mjs',
  '/References/Terra Former/src/assets/tree.mjs',
  '/References/Terra Former/src/assets/field-rock.mjs',
  '/References/Beach/src/assets/*.mjs',
  '/References/Fish Tank/src/aquarium/coral-*.mjs',
  '/References/Fish Tank/src/aquarium/fauna-*.mjs',
  '/References/Fish Tank/src/aquarium/hardscape-*.mjs',
  '/References/Fish Tank/src/aquarium/flora-*.mjs',
  '/src/assets/flora/trees.ts',
  '/src/assets/flora/herbs.ts',
]);

export const MODULE_PATHS = {
  mammal: '/References/Mammals/src/assets/animals/mammal-rig.mjs',
  bird: '/References/Birds/src/assets/bird-rig.mjs',
  wildform: '/References/Animals/src/engine/animal.mjs',
  plant: '/References/plants .mjs',
  deciduous: '/References/parametric-deciduous.mjs',
  conifer: '/References/parametric-conifer.mjs',
  terraTree: '/References/Terra Former/src/assets/tree.mjs',
  rock: '/References/Terra Former/src/assets/field-rock.mjs',
  reptile: (id: string) => `/References/Reptiles/src/models/${id}.mjs`,
  water: (id: string) => `/References/water-world/assets/${id}.mjs`,
  beach: (id: string) => `/References/Beach/src/assets/${id}.mjs`,
  aquarium: (id: string) => `/References/Fish Tank/src/aquarium/${id}.mjs`,
  flora: (id: 'trees' | 'herbs') => `/src/assets/flora/${id}.ts`,
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
