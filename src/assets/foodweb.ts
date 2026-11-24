/**
 * The food web: who eats whom, and why.
 *
 * Diets are written as food words ("small-mammal", "fish", "nectar") or exact species. Each
 * organism counts as some foods: its own tags plus what its class and size make it (a 1.8 kg
 * rabbit is a mammal and a small mammal; a 900 kg giraffe is a big grazing animal). A predator
 * only takes animal prey within its reach — about its own size, much bigger for pack hunters and
 * ambush predators, and not so tiny it isn't worth catching. Scavengers eat the remains of
 * bigger animals, nest raiders eat eggs, parasites live on hosts of any size.
 *
 * The web also has food that is in every habitat without being placed: dead matter (fallen
 * leaves, droppings and remains, which decomposers recycle into nutrients for plants) and, in
 * water, drifting plankton and algae on the rocks. Sunlight powers the producers.
 *
 * Everything — the diagram, the info card, ecosystem health, quests and the code blocks — uses
 * this one model, so they always agree.
 */
import type { AssetDef } from './types';
import { CATALOG } from './catalog';
import { DEFAULT_REACH, INVERTEBRATE_REACH, PARTNERS, REACH } from './data-diet';

/* ======================================================================== */
/*  food words                                                              */
/* ======================================================================== */
/** friendly names for food words */
export const FOOD_LABEL: Record<string, string> = {
  grass: 'grass', leaves: 'leaves', fruit: 'fruit', seeds: 'seeds & nuts', nectar: 'nectar', bark: 'bark & twigs', algae: 'algae',
  'aquatic-plants': 'water plants', cactus: 'cactus', lichen: 'lichen', fungi: 'mushrooms', insect: 'insects', spider: 'spiders',
  worm: 'worms', snail: 'snails & slugs', shellfish: 'shellfish & crabs', squid: 'squid & octopus', jellyfish: 'jellyfish', coral: 'coral',
  urchin: 'sea urchins & stars', anemone: 'sea anemones', sponge: 'sponges', micro: 'tiny animals', plankton: 'plankton', fish: 'fish', amphibian: 'frogs & salamanders',
  reptile: 'reptiles', bird: 'birds', 'small-bird': 'small birds', mammal: 'mammals', 'small-mammal': 'small mammals',
  'large-herbivore': 'big grazing animals', megaherbivore: 'giant plant-eaters', seal: 'seals', whale: 'whales', egg: 'eggs',
  carrion: 'dead animals', detritus: 'dead leaves & remains', clam: 'clams & mussels', crab: 'crabs & shrimp', aphids: 'aphids',
};
/** foods that come from plants, algae and plankton */
const PLANT_FOODS = new Set(['grass', 'leaves', 'fruit', 'seeds', 'nectar', 'bark', 'algae', 'aquatic-plants', 'cactus', 'lichen', 'plankton']);
const isPlantId = (s: string) => /^(plant|tree|grove|aqua\/vallisneria)/.test(s);
const VERTEBRATE = new Set(['Mammalia', 'Aves', 'Reptilia', 'Amphibia', 'Actinopterygii', 'Chondrichthyes']);
const FISH = new Set(['Actinopterygii', 'Chondrichthyes']);
/** foods that mean "a big animal" (predators are never these) */
const HERBIVORE_KINDS = new Set(['large-herbivore', 'megaherbivore']);
const SIZE_KINDS = new Set(['large-herbivore', 'megaherbivore', 'small-mammal', 'small-bird']);

export function isVertebrate(d: AssetDef) { return VERTEBRATE.has(d.info.class ?? ''); }
const tagged = (d: AssetDef, t: string) => (d.info.tags ?? []).includes(t);
const isApex = (d: AssetDef) => tagged(d, 'apex');
const isPredator = (d: AssetDef) => tagged(d, 'apex') || tagged(d, 'predator');
const isParasite = (d: AssetDef) => d.info.diet === 'parasite';

const kindsCache = new WeakMap<AssetDef, Set<string>>();
/** the foods an organism counts as when something eats it */
export function kindsOf(d: AssetDef): Set<string> {
  const hit = kindsCache.get(d);
  if (hit) return hit;
  // (size classes come from the animal's mass, not from hand-written tags)
  const k = new Set((d.info.tags ?? []).filter((t) => t !== 'predator' && t !== 'apex' && (d.category !== 'animals' || !SIZE_KINDS.has(t))));
  if (d.category === 'animals') {
    const cls = d.info.class ?? '', m = d.mass ?? 0;
    if (cls === 'Mammalia') {
      k.add('mammal');
      if (m && m < 5) k.add('small-mammal');
      if (!isPredator(d) && m >= 20) k.add('large-herbivore');
      if (!isPredator(d) && m >= 1000) k.add('megaherbivore');
    }
    if (cls === 'Aves') { k.add('bird'); if (m && m < 0.3) k.add('small-bird'); }
    // (animals without a class or mass keep their hand-written size tags)
    if (!m) for (const t of d.info.tags ?? []) if (SIZE_KINDS.has(t)) k.add(t);
    if (cls === 'Reptilia') k.add('reptile');
    if (cls === 'Amphibia') k.add('amphibian');
    if (FISH.has(cls)) k.add('fish');
    if (cls === 'Insecta' || cls === 'Chilopoda') k.add('insect');
    if (cls === 'Arachnida') k.add('spider');
    if (cls === 'Bivalvia' || cls === 'Rhynchonellata') k.add('clam');
    if (cls === 'Malacostraca' || cls === 'Merostomata') k.add('crab');
    if (isPredator(d)) for (const h of HERBIVORE_KINDS) k.delete(h);
  }
  kindsCache.set(d, k);
  return k;
}

export type LinkKind = 'eats' | 'scavenges' | 'eggs' | 'parasite' | 'recycles';
export interface FoodLink { kind: LinkKind; /** the food word (or species) that makes the link */ food: string }

/** smallest prey worth hunting, as a share of the hunter's own mass */
const minShare = (food: string) => (food === 'fish' ? 0.0001 : 0.002);
/** can a hunter of this size take this prey? */
function catchable(a: AssetDef, b: AssetDef, food: string) {
  const ma = a.mass, mb = b.mass;
  if (!ma || !mb || b.category !== 'animals' || a.category !== 'animals') return true;
  // grazers nibble corals, sponges and other fixed colonies: their size doesn't matter
  if (b.loco === 'sessile') return true;
  if (isVertebrate(b)) {
    const reach = REACH[a.id] ?? (isVertebrate(a) ? DEFAULT_REACH : INVERTEBRATE_REACH);
    return mb <= ma * reach && (!isVertebrate(a) || mb >= ma * minShare(food));
  }
  // invertebrate prey: anything not much bigger than the hunter (venomous hunters reach further)
  return mb <= ma * (REACH[a.id] ?? (isVertebrate(a) ? 3 : 2));
}
/** eggs worth raiding: birds' and reptiles' nests (not raptors', which are out of reach) */
const laysRaidableEggs = (d: AssetDef) => (d.info.class === 'Aves' && !isPredator(d)) || d.info.class === 'Reptilia';

/**
 * How `a` feeds on `b`, or null if it doesn't. An exact species in the diet always counts;
 * food words count when `b` is that food and (for animal prey) small enough to catch.
 */
export function feedsOn(a: AssetDef, b: AssetDef): FoodLink | null {
  if (a.id === b.id || b.living === false && b.category !== 'fungi') return null;
  const want = a.info.eats ?? [];
  if (!want.length) return null;
  const para = isParasite(a);
  if (partnersOf(a.id).some((p) => p.other === b.id)) return null;
  if (want.includes(b.id)) return { kind: para ? 'parasite' : 'eats', food: b.id };
  const kinds = kindsOf(b);
  // apex predators are nobody's prey (but parasites live on them too)
  if (!isApex(b) || para) {
    for (const w of want) {
      if (w === 'egg' || w === 'carrion' || w === 'detritus' || !kinds.has(w)) continue;
      if (para || catchable(a, b, w)) return { kind: para ? 'parasite' : 'eats', food: w };
    }
  }
  if (want.includes('egg') && laysRaidableEggs(b) && b.category === 'animals') return { kind: 'eggs', food: 'egg' };
  if (want.includes('carrion') && isVertebrate(b) && (b.mass ?? 0) >= 2 && b.category === 'animals') return { kind: 'scavenges', food: 'carrion' };
  return null;
}
/** the partners (mutualism) of a species */
export function partnersOf(id: string) {
  return PARTNERS.filter((p) => p.a === id || p.b === id).map((p) => ({ other: p.a === id ? p.b : p.a, how: p.how }));
}

/** does `a` eat `b` (in any way)? */
export function eats(a: AssetDef, b: AssetDef) { return !!feedsOn(a, b); }

/* ======================================================================== */
/*  roles                                                                   */
/* ======================================================================== */
export type Role = 'producer' | 'primary' | 'secondary' | 'tertiary' | 'decomposer' | 'abiotic';
/** a species' usual place in food webs (in a particular diorama its links can place it differently) */
export function roleOf(d: AssetDef): Role {
  const diet = d.info.diet;
  if (!d.living && d.category !== 'fungi') return 'abiotic';
  if (d.category === 'fungi' || diet === 'decomposer' || diet === 'detritivore') return 'decomposer';
  if (d.category === 'plants' || diet === 'producer' || diet === 'carnivorous plant') return 'producer';
  if (isApex(d)) return 'tertiary';
  const want = d.info.eats ?? [];
  if (diet === 'herbivore' || diet === 'frugivore' || diet === 'nectarivore' || diet === 'filter feeder' || (want.length && want.every((e) => PLANT_FOODS.has(e) || isPlantId(e)))) return 'primary';
  return 'secondary';
}
export const ROLE_META: Record<Role, { label: string; color: string; emoji: string; level: number }> = {
  producer: { label: 'Producer', color: '#3f9b3a', emoji: '🌱', level: 1 },
  primary: { label: 'Primary consumer', color: '#e0a526', emoji: '🐇', level: 2 },
  secondary: { label: 'Secondary consumer', color: '#e0662f', emoji: '🦊', level: 3 },
  tertiary: { label: 'Top predator', color: '#c23b3b', emoji: '🦁', level: 4 },
  decomposer: { label: 'Decomposer', color: '#8a6a4a', emoji: '🍄', level: 0 },
  abiotic: { label: 'Non-living', color: '#7d8a99', emoji: '🪨', level: -1 },
};
export const LINK_META: Record<LinkKind, { label: string; color: string; dash?: string }> = {
  eats: { label: 'eats', color: '#6b5b45' },
  scavenges: { label: 'scavenges (eats remains)', color: '#7a6a8a', dash: '6 4' },
  eggs: { label: 'raids eggs', color: '#c08a2a', dash: '2 4' },
  parasite: { label: 'parasite of', color: '#9a4fb5', dash: '1 3' },
  recycles: { label: 'recycles', color: '#8a6a4a', dash: '4 3' },
};

/** "grass, leaves and fruit" */
export function dietText(d: AssetDef, max = 5) {
  const words = (d.info.eats ?? []).map((w) => FOOD_LABEL[w] ?? CATALOG.find((c) => c.id === w)?.name.toLowerCase() ?? w);
  const list = [...new Set(words)].slice(0, max);
  return list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/* ======================================================================== */
/*  food that is there without being placed                                 */
/* ======================================================================== */
export interface Source { id: string; food: string; name: string; emoji: string; blurb: string }
export const SOURCES: Record<'plankton' | 'algae' | 'detritus' | 'aphids', Source> = {
  aphids: { id: 'src:aphids', food: 'aphids', name: 'Aphids', emoji: '🐜', blurb: 'Tiny sap-sucking insects found on almost every plant. Too small to place, but a feast for ladybirds.' },
  plankton: { id: 'src:plankton', food: 'plankton', name: 'Plankton', emoji: '🦠', blurb: 'Tiny algae and animals drifting in the water. Phytoplankton make food from sunlight, like plants.' },
  algae: { id: 'src:algae', food: 'algae', name: 'Algae', emoji: '🟢', blurb: 'Green films and seaweeds growing on rocks and plants under water.' },
  detritus: { id: 'src:detritus', food: 'detritus', name: 'Dead matter', emoji: '🍂', blurb: 'Fallen leaves, droppings and the remains of everything that dies. Decomposers turn it back into nutrients that plants take up.' },
};
const SOURCE_BY_ID: Record<string, Source> = Object.fromEntries(Object.values(SOURCES).map((s) => [s.id, s]));
export const isSourceId = (id: string) => id.startsWith('src:');

/* ======================================================================== */
/*  the web of a diorama                                                    */
/* ======================================================================== */
export interface WebNode {
  id: string;
  /** the species (absent for food sources like plankton and dead matter) */
  def?: AssetDef;
  source?: Source;
  name: string;
  emoji: string;
  /** role in this web (from its links, not just its diet) */
  role: Role;
  /** trophic level: 1 producers, +1 per step up (fractional for omnivores) */
  tl: number;
  /** row of the diagram: 1 producers … 4+ top; 0 decomposers */
  level: number;
  count: number;
  ids: string[];
  /** a consumer with nothing to eat here */
  hungry: boolean;
}
export interface WebEdge { from: string; to: string; kind: LinkKind; food: string }
export interface FoodWeb {
  nodes: WebNode[];
  edges: WebEdge[];
  byId: Map<string, WebNode>;
  /** the longest food chains, producer first */
  chains: string[][];
  /** organisms in the longest chain (3 = plant → plant-eater → predator) */
  maxChain: number;
  /** (legacy) highest diagram row */
  maxLevel: number;
  food(id: string): WebEdge[];
  eaters(id: string): WebEdge[];
}

interface Item { id: string; def: AssetDef; name: string }
const FEEDS: LinkKind[] = ['eats', 'eggs', 'scavenges', 'parasite'];

/**
 * The food web of a set of placed organisms: one node per species (with a count), plus dead
 * matter and — when there is water — plankton and algae. Edges run from the food to the eater.
 */
export function buildFoodWeb(items: Item[], opts: { water?: boolean } = {}): FoodWeb {
  const bySpecies = new Map<string, { id: string; def: AssetDef; name: string; ids: string[] }>();
  for (const i of items) {
    if (i.def.living === false && i.def.category !== 'fungi') continue;
    if (i.def.category === 'habitats') continue;
    const s = bySpecies.get(i.def.id);
    if (s) s.ids.push(i.id); else bySpecies.set(i.def.id, { id: i.id, def: i.def, name: i.name, ids: [i.id] });
  }
  const living = [...bySpecies.values()];
  const nodes = new Map<string, WebNode>();
  for (const s of living) {
    nodes.set(s.id, { id: s.id, def: s.def, name: s.ids.length > 1 ? s.def.name : s.name, emoji: s.def.emoji, role: roleOf(s.def), tl: 1, level: 1, count: s.ids.length, ids: s.ids, hungry: false });
  }
  const edges: WebEdge[] = [];
  for (const a of living) for (const b of living) {
    if (a === b) continue;
    const l = feedsOn(a.def, b.def);
    if (l) edges.push({ from: b.id, to: a.id, kind: l.kind, food: l.food });
  }
  // food that is there without being placed
  if (living.length) {
    const want = (food: string) => living.filter((s) => (s.def.info.eats ?? []).includes(food));
    const add = (src: Source, eaters: typeof living, kind: LinkKind) => {
      if (!eaters.length) return;
      const lvl = src.food === 'detritus' ? 0 : src.food === 'aphids' ? 2 : 1;
      nodes.set(src.id, { id: src.id, source: src, name: src.name, emoji: src.emoji, role: lvl === 0 ? 'abiotic' : lvl === 2 ? 'primary' : 'producer', tl: Math.max(1, lvl), level: lvl, count: 1, ids: [], hungry: false });
      for (const e of eaters) edges.push({ from: src.id, to: e.id, kind, food: src.food });
    };
    add(SOURCES.detritus, want('detritus'), 'recycles');
    // aphids live on land plants
    if (living.some((s) => s.def.category === 'plants' && s.def.water === undefined && !(s.def.info.tags ?? []).every((t) => t === 'aquatic-plants' || t === 'algae'))) add(SOURCES.aphids, want('aphids'), 'eats');
    if (opts.water) {
      add(SOURCES.plankton, want('plankton'), 'eats');
      add(SOURCES.algae, want('algae'), 'eats');
    }
  }
  const incoming = new Map<string, WebEdge[]>(), outgoing = new Map<string, WebEdge[]>();
  for (const e of edges) {
    (incoming.get(e.to) ?? incoming.set(e.to, []).get(e.to)!).push(e);
    (outgoing.get(e.from) ?? outgoing.set(e.from, []).get(e.from)!).push(e);
  }
  // trophic levels: producers 1; a consumer is one step above the average of what it eats
  // (carnivorous plants stay producers; decomposers sit with the recycling)
  const fixed = (n: WebNode) => !!n.source || n.role === 'producer' || n.role === 'abiotic';
  for (const n of nodes.values()) n.tl = n.source ? n.tl : fixed(n) ? 1 : 2;
  for (let pass = 0; pass < 24; pass++) {
    for (const n of nodes.values()) {
      if (fixed(n)) continue;
      // (scavenging counts only for animals that have nothing else: remains don't make a lion a top-top predator)
      const all = (incoming.get(n.id) ?? []).filter((e) => FEEDS.includes(e.kind) || e.kind === 'recycles');
      const main = all.filter((e) => e.kind !== 'scavenges');
      const food = main.length ? main : all;
      if (!food.length) continue;
      const mean = food.reduce((s, e) => s + (nodes.get(e.from)!.tl), 0) / food.length;
      n.tl = Math.min(6, 1 + mean);
    }
  }
  for (const n of nodes.values()) {
    if (n.source) continue;
    if (n.role === 'decomposer') { n.level = 0; continue; }
    if (n.role === 'producer') { n.level = 1; continue; }
    const food = (incoming.get(n.id) ?? []).filter((e) => FEEDS.includes(e.kind));
    n.hungry = food.length === 0;
    // a consumer's row: rounded trophic level; whoever nothing here eats and that eats meat is a top predator
    n.level = n.hungry ? Math.max(2, Math.round(roleLevel(n.role))) : Math.max(2, Math.round(n.tl));
    const eaten = (outgoing.get(n.id) ?? []).some((e) => e.kind === 'eats');
    // (a hungry animal keeps its usual role: it has no links here to place it by)
    if (!n.hungry) n.role = n.level <= 2 ? 'primary' : !eaten && n.level >= 3 ? 'tertiary' : 'secondary';
  }
  // food chains: longest paths up the "eats" links from a producer or plankton
  const chains = longestChains(nodes, outgoing);
  const maxChain = chains.length ? chains[0].length : [...nodes.values()].some((n) => n.role === 'producer' && !n.source) ? 1 : 0;
  const list = [...nodes.values()];
  return {
    nodes: list, edges, byId: nodes, chains, maxChain,
    maxLevel: Math.max(0, ...list.filter((n) => !n.source).map((n) => n.level)),
    food: (id) => incoming.get(id) ?? [],
    eaters: (id) => outgoing.get(id) ?? [],
  };
}
const roleLevel = (r: Role) => ROLE_META[r].level;

function longestChains(nodes: Map<string, WebNode>, outgoing: Map<string, WebEdge[]>, keep = 6) {
  const best = new Map<string, string[]>();
  // longest chain starting at each node (memoised DFS, guarding against loops)
  const visiting = new Set<string>();
  const from = (id: string): string[] => {
    const hit = best.get(id);
    if (hit) return hit;
    if (visiting.has(id)) return [id];
    visiting.add(id);
    let longest: string[] = [];
    for (const e of outgoing.get(id) ?? []) {
      if (e.kind !== 'eats') continue;
      const to = nodes.get(e.to)!, me = nodes.get(id)!;
      // chains climb the trophic levels, so two animals that eat each other don't loop
      if (to.role === 'producer' || to.role === 'decomposer' || to.tl <= me.tl) continue;
      const p = from(e.to);
      if (p.length > longest.length) longest = p;
    }
    visiting.delete(id);
    const out = [id, ...longest];
    best.set(id, out);
    return out;
  };
  const starts = [...nodes.values()].filter((n) => n.role === 'producer');
  // the longest chain through each first eater of each producer, so different routes show up
  const all: string[][] = [];
  for (const st of starts) {
    for (const e of outgoing.get(st.id) ?? []) {
      const to = nodes.get(e.to)!;
      if (e.kind !== 'eats' || to.role === 'producer' || to.role === 'decomposer') continue;
      all.push([st.id, ...from(e.to)]);
    }
  }
  all.sort((a, b) => b.length - a.length);
  // variety first: the longest chain to each different top species, then other routes
  const out: string[][] = [];
  const seen = new Set<string>();
  const tops = new Set<string>();
  for (const pass of [0, 1]) {
    for (const c of all) {
      if (out.length >= keep) break;
      const top = c[c.length - 1], k = c.join('>');
      if (seen.has(k) || (pass === 0 && tops.has(top))) continue;
      if (pass === 1 && out.some((o) => o[o.length - 1] === top && o[o.length - 2] === c[c.length - 2])) continue;
      seen.add(k); tops.add(top); out.push(c);
    }
  }
  // longest first
  out.sort((a, b) => b.length - a.length);
  return out;
}

/**
 * What would happen if a species disappeared: consumers left with nothing to eat (and, in a
 * cascade, the ones that ate only them), those that lose one of their foods, and prey that lose
 * a predator (and might grow too many).
 */
export function removalImpact(web: FoodWeb, id: string) {
  const gone = new Set([id]);
  const starve: string[] = [];
  for (let changed = true; changed;) {
    changed = false;
    for (const n of web.nodes) {
      if (gone.has(n.id) || n.source || n.role === 'producer' || n.role === 'decomposer' || n.hungry) continue;
      // (a carcass now and then isn't what keeps a scavenger alive: only real food counts here)
      const food = web.food(n.id).filter((e) => FEEDS.includes(e.kind) && e.kind !== 'scavenges');
      if (food.length && food.every((e) => gone.has(e.from))) { gone.add(n.id); starve.push(n.id); changed = true; }
    }
  }
  const lose = web.eaters(id).filter((e) => FEEDS.includes(e.kind) && e.kind !== 'scavenges' && !starve.includes(e.to)).map((e) => e.to);
  const freed = web.food(id).filter((e) => e.kind === 'eats' && !isSourceId(e.from) && web.byId.get(e.from)?.role !== 'producer').map((e) => e.from);
  return { starve, lose: [...new Set(lose)], freed: [...new Set(freed)] };
}

/**
 * Species of a habitat that would feed a hungry organism, best first: ones that are producers or
 * would themselves find food among what is already there.
 */
export function foodSuggestions(hungry: AssetDef, biome: string, present: AssetDef[], opts: { water?: boolean; allowed?: (d: AssetDef) => boolean } = {}) {
  const have = new Set(present.map((d) => d.id));
  const r = roleOf(hungry);
  const meat = r === 'secondary' || r === 'tertiary';
  const fed = (d: AssetDef) => roleOf(d) === 'producer' || present.some((p) => eats(d, p)) || (opts.water && (d.info.eats ?? []).some((w) => w === 'plankton' || w === 'algae')) || (d.info.eats ?? []).includes('detritus');
  return CATALOG
    .filter((d) => d.living !== false && !have.has(d.id) && (biome === 'blank' || d.biomes.includes(biome)) && (opts.allowed?.(d) ?? true))
    .filter((d) => feedsOn(hungry, d)?.kind === 'eats')
    // a meat-eater is offered prey first (that would itself find food), a plant-eater plants
    .map((d) => ({ d, score: (fed(d) ? 2 : 0) + (meat ? (d.category === 'animals' ? 3 : 0) : roleOf(d) === 'producer' ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || a.d.name.localeCompare(b.d.name))
    .slice(0, 3)
    .map((x) => x.d);
}

/** the name of a node for sentences */
export function nodeName(web: FoodWeb, id: string) {
  const n = web.byId.get(id) ?? (SOURCE_BY_ID[id] ? { name: SOURCE_BY_ID[id].name } : null);
  return n?.name ?? id;
}
