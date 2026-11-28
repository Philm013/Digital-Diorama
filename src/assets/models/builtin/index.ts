import type * as THREE from 'three';
import type { ParamSpec } from '../../modules';
import { FUNGI_BUILTINS } from './fungi';
import { createSeal, SEAL_PARAMS, SEAL_RIG, createCetacean, CETACEAN_PARAMS, CETACEAN_RIG, createManOWar, MANOWAR_PARAMS, MANOWAR_RIG, createSeaHare, SEAHARE_PARAMS } from './marine';
import { createFish, FISH_PARAMS, FISH_RIG } from './fish';

export type RigSpec = Record<string, { axis: string; range: [number, number]; type?: string; speed?: number; phase?: number }>;
export interface Builtin { createAsset: (p?: Record<string, unknown>) => THREE.Object3D; params: Record<string, ParamSpec>; rig?: RigSpec }

/** Procedural assets that live in this app (path `builtin:<key>`). */
export const BUILTINS: Record<string, Builtin> = {
  ...FUNGI_BUILTINS,
  seal: { createAsset: createSeal, params: SEAL_PARAMS, rig: SEAL_RIG as unknown as RigSpec },
  cetacean: { createAsset: createCetacean, params: CETACEAN_PARAMS, rig: CETACEAN_RIG as unknown as RigSpec },
  'man-o-war': { createAsset: createManOWar, params: MANOWAR_PARAMS, rig: MANOWAR_RIG as unknown as RigSpec },
  'sea-hare': { createAsset: createSeaHare, params: SEAHARE_PARAMS },
  fish: { createAsset: createFish, params: FISH_PARAMS, rig: FISH_RIG as unknown as RigSpec },
};
