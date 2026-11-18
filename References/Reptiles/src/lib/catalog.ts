import type * as THREE from 'three';
import type { NightCfg, RigCfg } from './viewer';

export type ParamDef = {
  type: 'choice' | 'range' | 'toggle' | 'color';
  default: string | number | boolean;
  label: string;
  affects: 'geometry' | 'colors';
  describe?: string;
  min?: number; max?: number; step?: number;
  options?: string[];
};
export type SpeciesInfo = {
  name: string; scientific: string; class: string; order: string; group: string; family: string;
  habitat: string; environment: string; size: string; status: string; fact: string;
};
export type AssetModule = {
  createAsset: (p?: Record<string, unknown>) => THREE.Group;
  params: Record<string, ParamDef>;
  rig: Record<string, RigCfg>;
  detach: string[];
  night: NightCfg;
  info: SpeciesInfo;
  COLORWAYS: Record<string, Record<string, string>>;
};
export type Species = { id: string; file: string; mod: AssetModule; source: string };

const mods = import.meta.glob('../models/*.mjs', { eager: true }) as Record<string, AssetModule>;
const raws = import.meta.glob('../models/*.mjs', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

export const GROUP_ORDER = ['Lizards', 'Snakes', 'Turtles & Tortoises', 'Crocodilians', 'Tuatara', 'Frogs & Toads', 'Salamanders & Newts', 'Caecilians'];

export const SPECIES: Species[] = Object.entries(mods)
  .map(([path, mod]) => {
    const file = path.split('/').pop()!;
    return { id: file.replace('.mjs', ''), file, mod, source: raws[path] ?? '' };
  })
  .sort((a, b) => GROUP_ORDER.indexOf(a.mod.info.group) - GROUP_ORDER.indexOf(b.mod.info.group) || a.mod.info.name.localeCompare(b.mod.info.name));

export function groupsByClass() {
  const out: { cls: string; groups: { group: string; order: string; items: Species[] }[] }[] = [];
  for (const sp of SPECIES) {
    let c = out.find((x) => x.cls === sp.mod.info.class);
    if (!c) { c = { cls: sp.mod.info.class, groups: [] }; out.push(c); }
    let g = c.groups.find((x) => x.group === sp.mod.info.group);
    if (!g) { g = { group: sp.mod.info.group, order: sp.mod.info.order, items: [] }; c.groups.push(g); }
    g.items.push(sp);
  }
  return out;
}

export function defaultsOf(mod: AssetModule) {
  const v: Record<string, string | number | boolean> = {};
  for (const [k, p] of Object.entries(mod.params)) v[k] = p.default;
  return v;
}

export const STATUS_TONE: Record<string, string> = {
  'Least Concern': 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  Vulnerable: 'bg-amber-500/15 text-amber-300 ring-amber-400/30',
  Endangered: 'bg-orange-500/15 text-orange-300 ring-orange-400/30',
  'Critically Endangered': 'bg-rose-500/15 text-rose-300 ring-rose-400/30'
};
export const statusTone = (s: string) => STATUS_TONE[Object.keys(STATUS_TONE).find((k) => s.startsWith(k)) || 'Least Concern'];
