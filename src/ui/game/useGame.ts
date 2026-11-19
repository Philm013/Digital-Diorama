import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { Engine } from '../../engine/Engine';
import { ecosystemHealth, quests, starsFor, flag, type Health, type Quest } from '../../game/ecology';
import { awardBadge, noteBiome, questDone, recordStars, getProfile, subscribeProfile, profileVersion } from '../../game/progress';
import { roleOf } from '../../assets/foodweb';

export interface GameState { health: Health; quests: Quest[]; stars: number; done: number }

/** re-render on profile changes (XP, discoveries, badges) */
export function useProfile() {
  useSyncExternalStore(subscribeProfile, profileVersion);
  return getProfile();
}

/**
 * The "game director": recomputes health and quests whenever the diorama changes,
 * hands out quest XP (once per diorama), stars and badges, and records moments
 * like visiting at night. Quests already complete when a diorama first opens are
 * recorded silently so templates don't shower free XP.
 */
export function useGame(engine: Engine | undefined, version: number, loaded: boolean): GameState {
  const profileV = useSyncExternalStore(subscribeProfile, profileVersion);
  const state = useMemo<GameState>(() => {
    if (!loaded || !engine?.doc) return { health: ecosystemHealthEmpty(), quests: [], stars: 0, done: 0 };
    const health = ecosystemHealth(engine);
    const list = quests(engine, health);
    return { health, quests: list, stars: starsFor(list), done: list.filter((q) => q.done).length };
  }, [engine, version, loaded, profileV]); // eslint-disable-line react-hooks/exhaustive-deps
  const baselined = useRef(false);
  useEffect(() => {
    if (!loaded || !engine?.doc || !state.quests.length) return;
    const p = (engine.doc.progress ??= {});
    const doneIds = (p.quests ??= []);
    if (!baselined.current) {
      baselined.current = true;
      awardBadge('first-steps');
      noteBiome(engine.doc.biome);
      if (!engine.doc.progress.flags) {
        // first time this diorama opens: count what's already there as the starting point
        for (const q of state.quests) if (q.done && !doneIds.includes(q.id)) doneIds.push(q.id);
        engine.doc.progress.flags = [];
        recordStars(engine.doc.id, engine.doc.biome, state.stars, true);
        return;
      }
    }
    let any = false;
    for (const q of state.quests) if (q.done && !doneIds.includes(q.id)) { doneIds.push(q.id); questDone(q.id, q.title, q.xp); any = true; }
    if (any) engine.changed();
    recordStars(engine.doc.id, engine.doc.biome, state.stars);
    // badges from the state of this diorama
    const h = state.health;
    if (h.maxLevel >= 4) awardBadge('food-chain');
    if (h.score >= 90) awardBadge('balanced');
    if (h.species >= 25) awardBadge('biodiversity');
    const decomposers = new Set(engine.actorList.filter((a) => !a.isClone && roleOf(a.def) === 'decomposer').map((a) => a.def.id));
    if (decomposers.size >= 3) awardBadge('decomposer');
  }, [state, loaded, engine]);
  // moments from the environment
  useEffect(() => {
    if (!loaded || !engine?.doc) return;
    const env = engine.env;
    if ((env.time >= 21 || env.time < 5) && flag(engine, 'night')) { awardBadge('night-owl'); engine.changed(false); }
    if (env.weather === 'storm') awardBadge('storm-chaser');
    const p = (engine.doc.progress ??= {});
    const seasons = (p.seasons ??= []);
    if (!seasons.includes(env.season)) { seasons.push(env.season); if (seasons.length >= 4) awardBadge('seasons'); }
  }, [version, loaded, engine]);
  return state;
}

function ecosystemHealthEmpty(): Health {
  return { score: 0, label: '—', color: '#888', parts: [], tips: [], species: 0, roles: { producer: 0, primary: 0, secondary: 0, tertiary: 0, decomposer: 0, abiotic: 0 }, maxLevel: 0 };
}
