import type { AssetDef } from './types';

const PRODUCER_TAGS = new Set(['grass', 'leaves', 'fruit', 'seeds', 'nectar', 'bark', 'algae', 'aquatic-plants', 'cactus', 'lichen']);

/** does organism a eat organism b? */
export function eats(a: AssetDef, b: AssetDef) {
  if (a.id === b.id) return false;
  const want = a.info.eats ?? [];
  if (!want.length) return false;
  const tags = b.info.tags ?? [];
  if (want.includes(b.id)) return true;
  for (const t of want) if (tags.includes(t)) return true;
  // generic links so common prey types connect
  if (want.includes('carrion') && b.category === 'animals' && (tags.includes('large-herbivore') || tags.includes('megaherbivore'))) return true;
  if (want.includes('plankton') && tags.includes('plankton')) return true;
  return false;
}

export type Role = 'producer' | 'primary' | 'secondary' | 'tertiary' | 'decomposer' | 'abiotic';
export function roleOf(d: AssetDef): Role {
  const diet = d.info.diet;
  if (!d.living && d.category !== 'fungi') return 'abiotic';
  if (d.category === 'fungi' || diet === 'decomposer' || diet === 'detritivore') return 'decomposer';
  if (d.category === 'plants' || diet === 'producer') return 'producer';
  if (diet === 'carnivorous plant') return 'producer';
  const tags = d.info.tags ?? [];
  if (tags.includes('apex')) return 'tertiary';
  if (diet === 'herbivore' || diet === 'frugivore' || diet === 'nectarivore' || (d.info.eats ?? []).every((e) => PRODUCER_TAGS.has(e))) return 'primary';
  if (diet === 'filter feeder') return 'primary';
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

export interface WebNode { id: string; def: AssetDef; name: string; level: number; role: Role; count: number; ids: string[] }
export interface WebEdge { from: string; to: string }
/** Build a food web over placed organisms (energy flows from → to, i.e. prey → eater). */
export function buildFoodWeb(items: { id: string; def: AssetDef; name: string }[]) {
  // one node per species (with a count) keeps the diagram readable
  const bySpecies = new Map<string, { id: string; def: AssetDef; name: string; ids: string[] }>();
  for (const i of items) {
    if (i.def.living === false || i.def.category === 'habitats') continue;
    const s = bySpecies.get(i.def.id);
    if (s) s.ids.push(i.id); else bySpecies.set(i.def.id, { id: i.id, def: i.def, name: i.def.name, ids: [i.id] });
  }
  const living = [...bySpecies.values()];
  const nodes = new Map<string, WebNode>();
  for (const i of living) nodes.set(i.id, { id: i.id, def: i.def, name: i.ids.length > 1 ? i.def.name : (items.find((x) => x.id === i.id)?.name ?? i.name), role: roleOf(i.def), level: 0, count: i.ids.length, ids: i.ids });
  const edges: WebEdge[] = [];
  for (const a of living) for (const b of living) if (a.id !== b.id && eats(a.def, b.def)) edges.push({ from: b.id, to: a.id });
  // decomposers recycle everything that dies — one representative link per decomposer
  // trophic levels: producers 1, then longest chain from a producer
  for (const n of nodes.values()) n.level = n.role === 'producer' ? 1 : n.role === 'decomposer' ? 0 : n.role === 'abiotic' ? -1 : 2;
  for (let pass = 0; pass < 6; pass++) {
    for (const e of edges) {
      const from = nodes.get(e.from)!, to = nodes.get(e.to)!;
      if (to.role === 'decomposer' || to.role === 'producer') continue;
      if (from.level >= 1 && to.level < from.level + 1) to.level = Math.min(5, from.level + 1);
    }
  }
  return { nodes: [...nodes.values()], edges };
}
