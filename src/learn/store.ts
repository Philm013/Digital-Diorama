/**
 * Ranger training progress: which lessons are done, the lesson being followed (it carries on
 * after a reload — and a lesson picked on the home screen starts as soon as a diorama opens), one
 * put aside with ✕ (the Learn button offers to carry on with it), one-time tips already shown,
 * and whether the studio's welcome has been answered. Stored on this device next to the ranger
 * profile; without storage it lives in memory.
 */
import { useSyncExternalStore } from 'react';
import { addXp } from '../game/progress';

export interface LessonPlace { id: string; step: number }
export interface LearnState {
  /** completed lesson ids */
  done: string[];
  /** the lesson being followed */
  active: LessonPlace | null;
  /** a lesson put aside before its end */
  paused: LessonPlace | null;
  /** the studio's welcome has been answered (either way) */
  welcomed: boolean;
  /** one-time tips already shown */
  seen: string[];
}

const KEY = 'dd-learn';
const EMPTY: LearnState = { done: [], active: null, paused: null, welcomed: false, seen: [] };

let state: LearnState = load();
let version = 0;
const subs = new Set<() => void>();

function load(): LearnState {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<LearnState>) } : { ...EMPTY };
  } catch { return { ...EMPTY }; }
}
function set(patch: Partial<LearnState>) {
  state = { ...state, ...patch };
  version++;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: keep in memory */ }
  for (const fn of subs) fn();
}

export const subscribeLearn = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };
const learnVersion = () => version;
/** re-render when lessons start, move on or finish */
export function useLearn() {
  useSyncExternalStore(subscribeLearn, learnVersion);
  return state;
}

/** begin a lesson (or carry on with it from a step); it runs in the studio, now or when a diorama opens */
export function startLesson(id: string, step = 0) {
  // a different lesson that was under way is put aside, to carry on with later
  const aside = state.active && state.active.id !== id ? state.active : state.paused?.id === id ? null : state.paused;
  set({ active: { id, step }, paused: aside, welcomed: true });
}
export function setLessonStep(step: number) {
  if (state.active) set({ active: { ...state.active, step } });
}
/** put the lesson aside: the Learn button offers to carry on from the same step */
export function pauseLesson() {
  if (state.active) set({ paused: state.active, active: null });
}
/** the lesson is over: counted as done (with its XP the first time) */
export function finishLesson(id: string, xp: number, title: string) {
  const first = !state.done.includes(id);
  set({ done: first ? [...state.done, id] : state.done, active: null, paused: state.paused?.id === id ? null : state.paused });
  if (first) addXp(xp, `Lesson: ${title}`);
  return first;
}

export const hasSeen = (tip: string) => state.seen.includes(tip);
export function markSeen(...tips: string[]) {
  const fresh = tips.filter((t) => !state.seen.includes(t));
  if (fresh.length) set({ seen: [...state.seen, ...fresh] });
}
export function setWelcomed() { if (!state.welcomed) set({ welcomed: true }); }
