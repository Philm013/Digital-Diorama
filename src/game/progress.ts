/**
 * Ranger profile: XP, levels, discovered species, badges and stars.
 * Stored on this device (localStorage); everything degrades gracefully when
 * storage is unavailable. UI listens with `onProgress` for celebrations.
 */
export interface Profile {
  name: string;
  avatar: string;
  xp: number;
  /** species (catalog ids) whose info card has been read */
  discovered: string[];
  /** species ids placed at least once */
  placed: string[];
  badges: string[];
  /** best stars per biome id */
  biomeStars: Record<string, number>;
  /** stars per project id */
  projectStars: Record<string, number>;
  biomesBuilt: string[];
  /** dioramas of the student's own that earned two stars: each unlocks the next step of the path */
  completed: string[];
  /** habitats with a completed expedition (unlocks their example diorama) */
  completedBiomes: string[];
  /** a teacher switched the ranger path off: everything is available */
  unlockAll?: boolean;
  created: number;
}

export type ProgressEvent =
  | { type: 'xp'; amount: number; reason: string; total: number }
  | { type: 'level'; level: number; rank: string }
  | { type: 'discover'; id: string; name: string; emoji: string }
  | { type: 'badge'; id: string }
  | { type: 'quest'; id: string; title: string; xp: number }
  | { type: 'stars'; stars: number; projectId: string }
  /** an expedition was completed: `stage` is the step of the path it opened (null at the end) */
  | { type: 'complete'; projectId: string; biome: string; stage: number | null };

import { LAST_STAGE } from './unlocks';

const KEY = 'dd-profile';
const AVATARS = ['🦊', '🦉', '🐢', '🦋', '🐸', '🦔', '🐼', '🦜', '🐬', '🦁', '🐝', '🦌'];
export { AVATARS };

let profile: Profile = load();
const listeners = new Set<(e: ProgressEvent) => void>();
const subs = new Set<() => void>();
let version = 0;

function load(): Profile {
  const dflt: Profile = { name: '', avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)], xp: 0, discovered: [], placed: [], badges: [], biomeStars: {}, projectStars: {}, biomesBuilt: [], completed: [], completedBiomes: [], created: Date.now() };
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (!raw) return dflt;
    const saved = JSON.parse(raw) as Partial<Profile>;
    const p = { ...dflt, ...saved };
    // profiles from before the ranger path: dioramas that already earned two stars count as completed
    if (!saved.completed) {
      p.completed = Object.entries(p.projectStars).filter(([, n]) => n >= 2).map(([id]) => id);
      p.completedBiomes = Object.entries(p.biomeStars).filter(([, n]) => n >= 2).map(([id]) => id);
    }
    return p;
  } catch { return dflt; }
}
function save() {
  version++;
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* private mode: keep in memory */ }
  for (const fn of subs) fn();
}
function emit(e: ProgressEvent) { for (const fn of listeners) fn(e); }

export function getProfile(): Readonly<Profile> { return profile; }
export function onProgress(fn: (e: ProgressEvent) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export const subscribeProfile = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };
export const profileVersion = () => version;
export function updateProfile(patch: Partial<Profile>) { profile = { ...profile, ...patch }; save(); }

/* ---------------- levels ---------------- */
const THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000, 5000, 6200, 7600, 9200, 11000, 13000, 15500, 18500, 22000];
const RANKS = ['Seedling', 'Sprout', 'Trail Scout', 'Explorer', 'Field Naturalist', 'Wildlife Tracker', 'Habitat Builder', 'Ecologist', 'Biome Expert', 'Conservation Hero', 'Planet Keeper'];
export function levelOf(xp: number) {
  let L = 1;
  while (L < THRESHOLDS.length && xp >= THRESHOLDS[L]) L++;
  const lo = THRESHOLDS[L - 1], hi = THRESHOLDS[L] ?? lo + 4000;
  return { level: L, rank: RANKS[Math.min(RANKS.length - 1, Math.floor((L - 1) / 2))], into: xp - lo, need: hi - lo, frac: Math.min(1, (xp - lo) / (hi - lo)) };
}

export function addXp(amount: number, reason: string) {
  if (!(amount > 0)) return;
  const before = levelOf(profile.xp).level;
  profile = { ...profile, xp: profile.xp + Math.round(amount) };
  save();
  emit({ type: 'xp', amount: Math.round(amount), reason, total: profile.xp });
  const after = levelOf(profile.xp);
  if (after.level > before) emit({ type: 'level', level: after.level, rank: after.rank });
}

/* ---------------- discovery & placement ---------------- */
export function isDiscovered(id: string) { return profile.discovered.includes(id); }
export function discover(id: string, name: string, emoji: string) {
  if (profile.discovered.includes(id)) return false;
  profile = { ...profile, discovered: [...profile.discovered, id] };
  save();
  emit({ type: 'discover', id, name, emoji });
  addXp(15, `Discovered ${name}`);
  checkCollectorBadges();
  return true;
}
export function notePlaced(id: string, name: string) {
  if (profile.placed.includes(id)) { addXp(2, `Placed ${name}`); return; }
  profile = { ...profile, placed: [...profile.placed, id] };
  save();
  addXp(5, `New to your collection: ${name}`);
}
export function noteBiome(biome: string) {
  if (biome === 'blank' || profile.biomesBuilt.includes(biome)) return;
  profile = { ...profile, biomesBuilt: [...profile.biomesBuilt, biome] };
  save();
  if (profile.biomesBuilt.length >= 5) awardBadge('world-traveller');
}

/* ---------------- badges ---------------- */
export interface BadgeDef { id: string; emoji: string; name: string; how: string; color: string }
export const BADGES: BadgeDef[] = [
  { id: 'first-steps', emoji: '🥾', name: 'First Steps', how: 'Open your first diorama', color: '#6aa84f' },
  { id: 'naturalist-10', emoji: '🔎', name: 'Curious Naturalist', how: 'Discover 10 species', color: '#3d85c6' },
  { id: 'naturalist-50', emoji: '📗', name: 'Field Guide Author', how: 'Discover 50 species', color: '#2f6fb0' },
  { id: 'naturalist-100', emoji: '🏅', name: 'Living Encyclopedia', how: 'Discover 100 species', color: '#c27c0e' },
  { id: 'food-chain', emoji: '🔗', name: 'Food Chain Champ', how: 'Build a food chain with 4 links', color: '#e06c2f' },
  { id: 'decomposer', emoji: '🍄', name: 'Recycler', how: 'Add 3 different decomposers to one habitat', color: '#8a6a4a' },
  { id: 'balanced', emoji: '💚', name: 'In Balance', how: 'Reach ecosystem health 90', color: '#2e9e5b' },
  { id: 'biodiversity', emoji: '🌈', name: 'Biodiversity Boost', how: 'Have 25 different species in one diorama', color: '#8e44ad' },
  { id: 'night-owl', emoji: '🌙', name: 'Night Owl', how: 'Visit a habitat at night', color: '#3b3f8f' },
  { id: 'storm-chaser', emoji: '⛈️', name: 'Storm Chaser', how: 'Summon a storm', color: '#5b6f86' },
  { id: 'seasons', emoji: '🍂', name: 'Four Seasons', how: 'See one habitat in every season', color: '#c9752e' },
  { id: 'coder', emoji: '🧩', name: 'Code Wrangler', how: 'Bring something to life with code', color: '#7c5cff' },
  { id: 'tour-guide', emoji: '🎤', name: 'Tour Guide', how: 'Give a guided tour', color: '#d6336c' },
  { id: 'tiny-explorer', emoji: '🐜', name: 'Ant’s-Eye View', how: 'Walk in at an ant’s eye level', color: '#a0522d' },
  { id: 'three-stars', emoji: '⭐', name: 'Superstar Habitat', how: 'Earn 3 stars on a diorama', color: '#e0a800' },
  { id: 'world-traveller', emoji: '🧭', name: 'World Traveller', how: 'Build dioramas in 5 different biomes', color: '#0b8a8a' },
];
export const BADGE_BY_ID = Object.fromEntries(BADGES.map((b) => [b.id, b]));
export function hasBadge(id: string) { return profile.badges.includes(id); }
export function awardBadge(id: string) {
  if (profile.badges.includes(id) || !BADGE_BY_ID[id]) return false;
  profile = { ...profile, badges: [...profile.badges, id] };
  save();
  emit({ type: 'badge', id });
  addXp(50, `Badge: ${BADGE_BY_ID[id].name}`);
  return true;
}
function checkCollectorBadges() {
  const n = profile.discovered.length;
  if (n >= 10) awardBadge('naturalist-10');
  if (n >= 50) awardBadge('naturalist-50');
  if (n >= 100) awardBadge('naturalist-100');
}

/* ---------------- quests & stars ---------------- */
export function questDone(id: string, title: string, xp: number) {
  emit({ type: 'quest', id, title, xp });
  addXp(xp, `Quest: ${title}`);
}
/**
 * Best stars for a diorama. `counts` says whether it is the student's own work (not a finished
 * example): reaching two stars then completes the expedition and moves the ranger path on.
 */
export function recordStars(projectId: string, biome: string, stars: number, silent = false, counts = true) {
  const prev = profile.projectStars[projectId] ?? 0;
  if (stars <= prev) return;
  profile = { ...profile, projectStars: { ...profile.projectStars, [projectId]: stars }, biomeStars: { ...profile.biomeStars, [biome]: Math.max(profile.biomeStars[biome] ?? 0, stars) } };
  const completes = counts && stars >= 2 && !profile.completed.includes(projectId);
  if (completes) {
    profile = { ...profile, completed: [...profile.completed, projectId], completedBiomes: profile.completedBiomes.includes(biome) ? profile.completedBiomes : [...profile.completedBiomes, biome] };
  }
  save();
  if (silent) return;
  emit({ type: 'stars', stars, projectId });
  if (completes) {
    const n = profile.completed.length;
    emit({ type: 'complete', projectId, biome, stage: !profile.unlockAll && n <= LAST_STAGE ? n : null });
    addXp(100, 'Expedition complete');
  }
  if (stars >= 3) awardBadge('three-stars');
}
