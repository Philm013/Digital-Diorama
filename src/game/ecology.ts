import type { Engine } from '../engine/Engine';
import type { Actor } from '../engine/Actor';
import { buildFoodWeb, eats, roleOf, type Role } from '../assets/foodweb';
import { BIOME_BY_ID } from '../biomes/templates';
import { isDiscovered } from './progress';

/* ======================================================================== */
/*  ecosystem health                                                        */
/* ======================================================================== */
export interface Health {
  score: number;
  label: string;
  color: string;
  parts: { name: string; got: number; max: number }[];
  tips: string[];
  species: number;
  roles: Record<Role, number>;
  maxLevel: number;
}

const living = (e: Engine) => e.actorList.filter((a) => !a.isClone && a.def.living !== false && a.def.category !== 'habitats');

export function hasWater(e: Engine) {
  return e.terrain ? e.terrain.waterLevel !== null && e.terrain.minHeight() < e.terrain.waterLevel : e.doc.base.kind === 'asset' || e.actorList.some((a) => a.def.category === 'water');
}

/**
 * A 0–100 score for how complete and balanced the food web is. It rewards
 * variety, every trophic role, food for every consumer, a plausible pyramid
 * (more producers than plant-eaters, more prey than predators) and water.
 */
export function ecosystemHealth(e: Engine): Health {
  const acts = living(e);
  const roles: Record<Role, number> = { producer: 0, primary: 0, secondary: 0, tertiary: 0, decomposer: 0, abiotic: 0 };
  for (const a of acts) roles[roleOf(a.def)]++;
  const species = new Set(acts.map((a) => a.def.id)).size;
  const web = buildFoodWeb(acts.map((a) => ({ id: a.id, def: a.def, name: a.name })));
  const maxLevel = Math.max(0, ...web.nodes.map((n) => n.level));
  const tips: string[] = [];
  const parts: Health['parts'] = [];
  // variety
  const variety = Math.min(25, Math.round((species / 14) * 25));
  parts.push({ name: 'Variety of species', got: variety, max: 25 });
  if (species < 8) tips.push(`Add more kinds of living things — you have ${species} species.`);
  // every role
  let rolePts = 0;
  if (roles.producer) rolePts += 8; else tips.push('Add producers — plants or algae make the food everything else needs.');
  if (roles.primary) rolePts += 6; else tips.push('Add a plant-eater (primary consumer), like a rabbit, deer or snail.');
  if (roles.secondary + roles.tertiary) rolePts += 6; else tips.push('Add a predator to keep plant-eaters in check.');
  if (roles.decomposer) rolePts += 5; else tips.push('Add a decomposer — mushrooms, a rotting log or earthworms recycle nutrients.');
  parts.push({ name: 'Producers, consumers & decomposers', got: rolePts, max: 25 });
  // food for every consumer
  const consumers = acts.filter((a) => { const r = roleOf(a.def); return r === 'primary' || r === 'secondary' || r === 'tertiary'; });
  const fed = consumers.filter((c) => acts.some((o) => o !== c && eats(c.def, o.def)));
  const hungry = consumers.filter((c) => !fed.includes(c));
  const fedPts = consumers.length ? Math.round((fed.length / consumers.length) * 20) : 0;
  parts.push({ name: 'Food for every animal', got: fedPts, max: 20 });
  if (hungry.length) {
    const names = [...new Set(hungry.map((h) => h.def.name))].slice(0, 2).join(' and ');
    tips.push(`${names} ${hungry.length === 1 ? 'has' : 'have'} nothing to eat here. Check the info card to see what ${hungry.length === 1 ? 'it eats' : 'they eat'}.`);
  }
  // pyramid balance
  let bal = 15;
  const plantEaters = roles.primary, predators = roles.secondary + roles.tertiary;
  if (roles.producer && plantEaters > roles.producer * 2) { bal -= 7; tips.push('Too many plant-eaters for the plants — add more producers.'); }
  if (predators && predators > Math.max(1, plantEaters)) { bal -= 7; tips.push('More predators than prey! Real food pyramids have fewer animals at the top.'); }
  if (!roles.producer) bal = 0;
  parts.push({ name: 'Balanced food pyramid', got: Math.max(0, bal), max: 15 });
  // chain length
  const chainPts = maxLevel >= 4 ? 5 : maxLevel >= 3 ? 4 : maxLevel >= 2 ? 2 : 0;
  parts.push({ name: 'Long food chains', got: chainPts, max: 5 });
  if (maxLevel < 3 && roles.producer && plantEaters) tips.push('Make a 3-link food chain: plant → plant-eater → predator.');
  // water
  const water = hasWater(e) ? 10 : 0;
  parts.push({ name: 'Water', got: water, max: 10 });
  if (!water) tips.push('Every habitat needs water — dig a pond (Build → Land tools → Water).');
  const score = Math.max(0, Math.min(100, parts.reduce((s, p) => s + p.got, 0)));
  const label = score >= 85 ? 'Thriving' : score >= 65 ? 'Healthy' : score >= 40 ? 'Growing' : score >= 15 ? 'Struggling' : 'Barren';
  const color = score >= 85 ? '#28c76f' : score >= 65 ? '#7bc043' : score >= 40 ? '#f0b429' : score >= 15 ? '#f08c2e' : '#e5484d';
  return { score, label, color, parts, tips, species, roles, maxLevel };
}

/* ======================================================================== */
/*  quests                                                                  */
/* ======================================================================== */
export interface Quest { id: string; emoji: string; title: string; hint: string; cur: number; need: number; done: boolean; xp: number }

export function flag(e: Engine, f: string) {
  const p = (e.doc.progress ??= {});
  const flags = (p.flags ??= []);
  if (flags.includes(f)) return false;
  flags.push(f);
  return true;
}
export const hasFlag = (e: Engine, f: string) => !!e.doc.progress?.flags?.includes(f);

export function quests(e: Engine, health?: Health): Quest[] {
  const acts = e.actorList.filter((a) => !a.isClone);
  const h = health ?? ecosystemHealth(e);
  const r = h.roles;
  const biome = BIOME_BY_ID[e.doc.biome];
  const labelled = acts.filter((a) => (a.doc.label?.text ?? '').trim()).length;
  const notes = acts.filter((a) => (a.doc.note ?? '').trim().length > 10).length;
  const coded = acts.some((a) => JSON.stringify(a.doc.scripts ?? '').includes('dd_when')) || JSON.stringify(e.doc.worldScripts ?? '').includes('dd_when');
  const seen = new Set(acts.filter((a: Actor) => a.def.living !== false && isDiscovered(a.def.id)).map((a) => a.def.id)).size;
  const abiotic = hasWater(e) || acts.some((a) => a.def.category === 'land');
  const Q = (id: string, emoji: string, title: string, hint: string, cur: number, need: number, xp = 30): Quest => ({ id, emoji, title, hint, cur: Math.min(cur, need), need, done: cur >= need, xp });
  return [
    Q('title', '✏️', 'Name your diorama', 'Tap the title in the top bar and give it your own name.', e.doc.title.trim() && e.doc.title.trim() !== biome?.name ? 1 : 0, 1, 20),
    Q('discover', '🔎', 'Discover 5 species', 'Explore mode: tap living things to read their field card.', seen, 5, 40),
    Q('producers', '🌱', 'Plant 3 producers', 'Plants and algae make food from sunlight.', r.producer, 3),
    Q('herbivores', '🐇', 'Add 2 plant-eaters', 'Herbivores are primary consumers.', r.primary, 2),
    Q('predator', '🦊', 'Add a predator', 'Secondary and top consumers eat other animals.', r.secondary + r.tertiary, 1),
    Q('decomposer', '🍄', 'Add a decomposer', 'Mushrooms, earthworms or a rotting log.', r.decomposer, 1),
    Q('chain', '🔗', 'Build a 3-link food chain', 'Plant → plant-eater → predator. Check the food web.', h.maxLevel >= 3 ? 1 : 0, 1, 40),
    Q('water', '💧', 'Provide water', 'Dig a pond or add a stream (Build → Land tools).', hasWater(e) ? 1 : 0, 1, 20),
    Q('abiotic', '🪨', 'Add non-living features', 'Rocks, water and soil are abiotic parts of a habitat.', abiotic ? 1 : 0, 1, 20),
    Q('health', '💚', 'Reach ecosystem health 70', 'Open the health meter for tips.', h.score, 70, 60),
    Q('labels', '🏷️', 'Write 3 of your own labels', 'Build → select something → label text.', labelled, 3),
    Q('notes', '📝', 'Research notes on 3 organisms', 'Build → select → My notes. They’re read aloud on the tour.', notes, 3, 40),
    Q('night', '🌙', 'See your habitat at night', 'Set the time to after 21:00.', hasFlag(e, 'night') ? 1 : 0, 1, 20),
    Q('walk', '🥾', 'Walk inside', 'Explore → Walk in.', hasFlag(e, 'walk') ? 1 : 0, 1, 20),
    Q('code', '🧩', 'Bring something to life with code', 'Code → “when ▶ clicked”, then press Play.', coded ? 1 : 0, 1, 50),
    Q('tour', '🎤', 'Give a guided tour', 'Explore → Tour, and watch it to the end.', hasFlag(e, 'tour') ? 1 : 0, 1, 40),
  ];
}
export function starsFor(list: Quest[]) {
  const done = list.filter((q) => q.done).length;
  return done >= list.length ? 3 : done >= 10 ? 2 : done >= 5 ? 1 : 0;
}
