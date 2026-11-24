/**
 * The ranger path: students start with a few habitats and the basic tools, and every expedition
 * they complete (a diorama of their own that earns two stars) unlocks more habitats, land tools,
 * coding, bigger boxes and so on. Finished example dioramas of a habitat unlock once the student
 * has completed their own there. Teachers can switch the whole path off (Settings → Unlock
 * everything). Derived from the ranger profile, so it works offline and per device.
 */
import { getProfile, type Profile } from './progress';

/** stars a diorama needs to count as a completed expedition (10 of its quests) */
export const COMPLETE_STARS = 2;

export type FeatureId =
  | 'code' | 'sculpt' | 'weather' | 'seasons' | 'tour' | 'area' | 'roam'
  | 'size-large' | 'size-huge' | 'size-custom' | 'lib-all' | 'tiles' | 'xr'
  | 'landforms-2' | 'landforms-3' | 'landforms-4';

export interface FeatureMeta { id: FeatureId; emoji: string; name: string; what: string }
export const FEATURES: Record<FeatureId, FeatureMeta> = {
  code: { id: 'code', emoji: '🧩', name: 'Code', what: 'Bring plants and animals to life with Scratch-style blocks' },
  sculpt: { id: 'sculpt', emoji: '✋', name: 'Sculpt brushes', what: 'Raise, dig, smooth and roughen the land by hand' },
  weather: { id: 'weather', emoji: '⛈️', name: 'Weather', what: 'Rain, storms, snow, fog and wind' },
  seasons: { id: 'seasons', emoji: '🍂', name: 'Seasons', what: 'See your habitat in spring, summer, autumn and winter' },
  tour: { id: 'tour', emoji: '🎤', name: 'Guided tour', what: 'Present your diorama with a narrated tour' },
  area: { id: 'area', emoji: '⬚', name: 'Area tool', what: 'Select land and grow whole mountain ranges, rivers and coasts' },
  roam: { id: 'roam', emoji: '🌍', name: 'Roam', what: 'Walk out of the box into an endless landscape' },
  'size-large': { id: 'size-large', emoji: '📐', name: 'Large dioramas', what: 'Boxes up to 64 × 44 m' },
  'size-huge': { id: 'size-huge', emoji: '🗺️', name: 'Huge dioramas', what: 'Boxes up to 96 × 64 m' },
  'size-custom': { id: 'size-custom', emoji: '📏', name: 'Any size', what: 'Choose any width and depth' },
  'lib-all': { id: 'lib-all', emoji: '🌐', name: 'Species from everywhere', what: 'Add any species to any habitat' },
  tiles: { id: 'tiles', emoji: '🪸', name: 'Habitat tiles', what: 'Swap the land for a reef, kelp forest, cave and more' },
  xr: { id: 'xr', emoji: '🥽', name: 'AR & VR', what: 'Put your diorama on a real table, or step into it' },
  'landforms-2': { id: 'landforms-2', emoji: '🏔️', name: 'Mountains & islands', what: 'Mountain, ridge, cliff, plateau and island landforms' },
  'landforms-3': { id: 'landforms-3', emoji: '🏜️', name: 'Desert landforms', what: 'Dune, mesa and canyon landforms' },
  'landforms-4': { id: 'landforms-4', emoji: '🌋', name: 'Volcanoes', what: 'Volcano landforms and volcanic areas' },
};

export interface Stage { n: number; rank: string; emoji: string; habitats: string[]; features: FeatureId[] }
/** stage n opens after n completed expeditions */
export const STAGES: Stage[] = [
  { n: 0, rank: 'New Ranger', emoji: '🌱', habitats: ['garden', 'forest', 'grassland'], features: [] },
  { n: 1, rank: 'Trail Scout', emoji: '🥾', habitats: ['wetland', 'savanna'], features: ['code', 'sculpt', 'weather', 'landforms-2', 'size-large'] },
  { n: 2, rank: 'Explorer', emoji: '🧭', habitats: ['desert', 'taiga', 'blank'], features: ['tour', 'seasons', 'landforms-3'] },
  { n: 3, rank: 'Field Naturalist', emoji: '🔭', habitats: ['rainforest', 'mountain'], features: ['area', 'roam', 'landforms-4', 'size-huge', 'size-custom'] },
  { n: 4, rank: 'Habitat Expert', emoji: '🏅', habitats: ['tundra', 'shore'], features: ['lib-all', 'tiles'] },
  { n: 5, rank: 'Ocean Explorer', emoji: '🐋', habitats: ['reef', 'kelp'], features: ['xr'] },
];
export const LAST_STAGE = STAGES.length - 1;

const FEATURE_STAGE = new Map<FeatureId, number>(STAGES.flatMap((s) => s.features.map((f) => [f, s.n] as [FeatureId, number])));
const HABITAT_STAGE = new Map<string, number>(STAGES.flatMap((s) => s.habitats.map((h) => [h, s.n] as [string, number])));

/** landform stamps and area kinds by the feature that unlocks them (the rest are there from the start) */
const STAMP_FEATURE: Record<string, FeatureId> = {
  mountain: 'landforms-2', ridge: 'landforms-2', cliff: 'landforms-2', plateau: 'landforms-2', island: 'landforms-2',
  dune: 'landforms-3', mesa: 'landforms-3', canyon: 'landforms-3',
  volcano: 'landforms-4',
};

/** expeditions completed: dioramas of the student's own that earned two stars */
export function completedCount(p: Readonly<Profile> = getProfile()) { return p.completed.length; }
/** how far along the path the student is (everything, for teachers who unlocked it all) */
export function stageOf(p: Readonly<Profile> = getProfile()) { return p.unlockAll ? LAST_STAGE : Math.min(LAST_STAGE, completedCount(p)); }

export function featureStage(f: FeatureId) { return FEATURE_STAGE.get(f) ?? 0; }
export function isUnlocked(f: FeatureId, p: Readonly<Profile> = getProfile()) { return stageOf(p) >= featureStage(f); }
export function habitatStage(id: string) { return HABITAT_STAGE.get(id) ?? 0; }
export function habitatUnlocked(id: string, p: Readonly<Profile> = getProfile()) { return stageOf(p) >= habitatStage(id); }
/** the finished example of a habitat: once the student has completed an expedition there */
export function exampleUnlocked(id: string, p: Readonly<Profile> = getProfile()) { return !!p.unlockAll || p.completedBiomes.includes(id); }
export function stampFeature(id: string): FeatureId | null { return STAMP_FEATURE[id] ?? null; }
export function stampUnlocked(id: string, p: Readonly<Profile> = getProfile()) { const f = stampFeature(id); return !f || isUnlocked(f, p); }
/** area kinds follow the landforms they are made of */
export function areaKindUnlocked(id: string, p: Readonly<Profile> = getProfile()) {
  const f = ({ mountains: 'landforms-2', islands: 'landforms-2', coast: 'landforms-2', dunes: 'landforms-3', canyons: 'landforms-3', mesas: 'landforms-3', volcanic: 'landforms-4' } as Record<string, FeatureId>)[id];
  return !f || isUnlocked(f, p);
}
/** completed expeditions still needed to reach a stage */
export function needFor(stage: number, p: Readonly<Profile> = getProfile()) { return Math.max(0, stage - stageOf(p)); }
export function needText(stage: number, p: Readonly<Profile> = getProfile()) {
  const n = needFor(stage, p);
  return n === 1 ? 'Complete 1 more expedition to unlock' : `Complete ${n} more expeditions to unlock`;
}
/** the next stage to reach, or null at the end of the path */
export function nextStage(p: Readonly<Profile> = getProfile()) { const s = stageOf(p); return s >= LAST_STAGE ? null : STAGES[s + 1]; }

/** a diorama size preset is available */
export function sizeUnlocked(id: string, p: Readonly<Profile> = getProfile()) {
  return id === 'large' ? isUnlocked('size-large', p) : id === 'huge' ? isUnlocked('size-huge', p) : true;
}

/** ask the studio to explain a locked feature (shows the path and what to do next) */
export function showLocked(what: FeatureId | { habitat: string }) {
  document.dispatchEvent(new CustomEvent('dd-locked', { detail: what }));
}
/** run `fn` when a feature is unlocked, otherwise explain how to unlock it */
export function gate(f: FeatureId, fn: () => void) { if (isUnlocked(f)) fn(); else showLocked(f); }
