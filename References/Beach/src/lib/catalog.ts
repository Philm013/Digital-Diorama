import * as conch from '../assets/gastropod-spiral.mjs';
import * as cowrie from '../assets/gastropod-cowrie.mjs';
import * as auger from '../assets/gastropod-auger.mjs';
import * as scallop from '../assets/bivalve-scallop-cockle.mjs';
import * as oyster from '../assets/bivalve-oyster-mussel.mjs';
import * as razor from '../assets/bivalve-razor-clam.mjs';
import * as urchin from '../assets/echinoderm-urchin-test.mjs';
import * as starfish from '../assets/echinoderm-starfish.mjs';
import * as remnant from '../assets/cephalopod-remnants.mjs';
import * as crab from '../assets/crustacean-carapace.mjs';
import * as artifact from '../assets/elasmobranch-artifacts.mjs';
import * as flora from '../assets/marine-flora-sponges.mjs';
import * as glass from '../assets/beach-glass-and-pottery.mjs';
import * as wood from '../assets/nautical-debris.mjs';

export type ParameterValue = number | string | boolean;
export type ParameterValues = Record<string, ParameterValue>;
export type ParameterMap = Record<string, ParameterValues>;
export type AssetModule = typeof conch;
export type AssetCategory = 'Shells' | 'Ocean life' | 'Found objects';
export type ArtKind = 'conch' | 'cowrie' | 'auger' | 'scallop' | 'oyster' | 'razor' | 'urchin' | 'starfish' | 'cuttlebone' | 'crab' | 'tooth' | 'kelp' | 'glass' | 'wood';

export interface AssetDefinition {
  id: string;
  name: string;
  family: string;
  scientific: string;
  category: AssetCategory;
  description: string;
  kind: ArtKind;
  module: AssetModule;
}

export const ASSETS: AssetDefinition[] = [
  { id: 'gastropod-spiral', name: 'Queen conch', family: 'Gastropod spiral', scientific: 'Aliger gigas', category: 'Shells', description: 'A sculptural spiral with a rose-colored lip and a crown shaped by the sea.', kind: 'conch', module: conch },
  { id: 'gastropod-cowrie', name: 'Porcelain cowrie', family: 'Gastropod cowrie', scientific: 'Cypraeidae', category: 'Shells', description: 'Porcelain-smooth, patterned by nature, with a delicate zipper of hidden teeth.', kind: 'cowrie', module: cowrie },
  { id: 'gastropod-auger', name: 'Turritella auger', family: 'Gastropod auger', scientific: 'Turritellidae', category: 'Shells', description: 'An impossibly fine spiral, recording a lifetime of growth in every whorl.', kind: 'auger', module: auger },
  { id: 'bivalve-scallop-cockle', name: 'Atlantic scallop', family: 'Bivalve fan', scientific: 'Argopecten irradians', category: 'Shells', description: 'A sunburst of coral-pink ridges, opening to reveal an iridescent interior.', kind: 'scallop', module: scallop },
  { id: 'bivalve-oyster-mussel', name: 'Wild oyster', family: 'Bivalve irregular', scientific: 'Ostreidae', category: 'Shells', description: 'A weathered, craggy exterior conceals a luminous bowl of mother-of-pearl.', kind: 'oyster', module: oyster },
  { id: 'bivalve-razor-clam', name: 'Razor clam', family: 'Bivalve elongated', scientific: 'Ensis directus', category: 'Shells', description: 'Paper-thin paired valves, bowed gently by the rhythm of their growth.', kind: 'razor', module: razor },
  { id: 'echinoderm-urchin-test', name: 'Urchin test', family: 'Echinoderm test', scientific: 'Echinoidea', category: 'Ocean life', description: 'A hollow calcium dome, embroidered with five petals of microscopic pores.', kind: 'urchin', module: urchin },
  { id: 'echinoderm-starfish', name: 'Ochre sea star', family: 'Echinoderm star', scientific: 'Pisaster ochraceus', category: 'Ocean life', description: 'Five sculpted arms, scattered with tiny calcium spines and slowly curling tips.', kind: 'starfish', module: starfish },
  { id: 'cephalopod-remnants', name: 'Cuttlebone', family: 'Cephalopod remnant', scientific: 'Sepiida', category: 'Ocean life', description: 'A feather-light chalk sculpture, or a nautilus revealing its inner architecture.', kind: 'cuttlebone', module: remnant },
  { id: 'crustacean-carapace', name: 'Crab carapace', family: 'Crustacean molt', scientific: 'Callinectes sapidus', category: 'Ocean life', description: 'An empty suit of ocean armor, complete with jointed legs and delicate pincers.', kind: 'crab', module: crab },
  { id: 'elasmobranch-artifacts', name: 'Shark tooth', family: 'Elasmobranch artifact', scientific: 'Selachimorpha', category: 'Found objects', description: 'A small, serrated fossil carrying the memory of a much older ocean.', kind: 'tooth', module: artifact },
  { id: 'marine-flora-sponges', name: 'Kelp & sea sponges', family: 'Marine flora', scientific: 'Phaeophyceae / Porifera', category: 'Ocean life', description: 'Ruffled ribbons, branching sea fans, and tiny porous worlds within a sponge.', kind: 'kelp', module: flora },
  { id: 'beach-glass-and-pottery', name: 'Sea glass & pottery', family: 'Tide-tumbled fragments', scientific: 'Anthropogenic treasures', category: 'Found objects', description: 'Once made by hand, then softened, frosted, and reclaimed by the sea.', kind: 'glass', module: glass },
  { id: 'nautical-debris', name: 'Driftwood & float', family: 'Nautical debris', scientific: 'Ocean-worn assemblage', category: 'Found objects', description: 'Sun-bleached timber, salt-worn hemp, and a hand-blown glass fishing float.', kind: 'wood', module: wood },
];

export const COLORWAYS = [
  { id: 'default', name: 'Gulf Coast Pastels', subtitle: 'Warm sand. Soft shells. Endless summer.', colors: ['#e7bc9e', '#d6b3bf', '#99b5a6', '#e0d6b7'], background: '#ede9df' },
  { id: 'gothic', name: 'Gothic Tideline', subtitle: 'Chalk, charcoal, and the quietly dramatic.', colors: ['#d9d4c9', '#a59baa', '#636371', '#393b40'], background: '#d4d1ce' },
  { id: 'pacific', name: 'Pacific Northwest Storm', subtitle: 'Storm-tossed treasures. Deep coastal color.', colors: ['#886e98', '#ab7357', '#557962', '#ab904f'], background: '#dddcd4' },
  { id: 'bioluminescent', name: 'Bioluminescent Dream', subtitle: 'The shore, after the world falls asleep.', colors: ['#85d8d0', '#c58acb', '#8c7db7', '#d0bee3'], background: '#d6d0df' },
];

export const getAsset = (id: string) => ASSETS.find(asset => asset.id === id) || ASSETS[0];
export const getPalette = (id: string) => COLORWAYS.find(palette => palette.id === id) || COLORWAYS[0];
export const getDefaults = (asset: AssetDefinition): ParameterValues => Object.fromEntries(Object.entries(asset.module.params).map(([key, value]) => [key, value.default]));
export const formatCount = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString();

export function activeComponents(asset: AssetDefinition, values: ParameterValues) {
  return asset.module.detach.filter(name => {
    if (asset.kind === 'starfish' && name.startsWith('arm_')) return Number(name.split('_')[1]) <= Number(values.armCount);
    if (asset.kind === 'kelp') return values.floraType === 'fan' ? name === 'seaFanBranches' : values.floraType === 'sponge' ? name === 'sponge' : ['kelpFronds', 'airBladders'].includes(name);
    if (asset.kind === 'crab') return values.carapaceType === 'horseshoe' ? !['crabClaw', 'walkingLegs'].includes(name) : name !== 'telsonSpike';
    if (asset.kind === 'tooth') return values.artifactType === 'purse' ? name.startsWith('eggCase') : name.startsWith('tooth');
    if (asset.kind === 'cuttlebone') return name !== 'chambers' || values.remnantType === 'nautilus';
    if (asset.kind === 'glass') return name !== 'ceramicPattern' || values.materialType === 'delft';
    if (asset.kind === 'auger') return name !== 'brokenTip' || !values.brokenTip;
    if (asset.kind === 'oyster') return name !== 'pearl' || !!values.showPearl;
    if (asset.kind === 'conch') return name !== 'hermitCrab' || !!values.showHermitCrab;
    return true;
  });
}

export interface StudioSettings {
  colorway: string;
  paramsByAsset: ParameterMap;
  selectedId: string;
  hiddenAssets: string[];
  hiddenParts: Record<string, string[]>;
  density: number;
  wetness: number;
  seed: number;
  additionalAssets: string[];
  sunlight?: number;
}