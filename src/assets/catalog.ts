import { ANIMALS as WILDFORM } from '@ref/Animals/src/data/catalog';
import type { AssetDef, Locomotion, SpeciesInfo } from './types';
import { MODULE_PATHS as P } from './modules';
import { MAMMALS } from './data-mammals';
import { BIRDS, GROUND_BIRDS } from './data-birds';
import { REPTILES } from './data-reptiles';
import { WILDFORM_AUG, WILDFORM_FACTS, WILDFORM_STATUS, wildformGroup } from './data-wildform';
import { WILDFORM_REMAP } from './data-remap';
import { DIET_FIX, MASS, massFromLength } from './data-diet';

const defs: AssetDef[] = [];
const add = (d: AssetDef) => { defs.push({ living: d.category === 'animals' || d.category === 'plants' || d.category === 'fungi', ...d }); };

/* ---------------- animals: rigged mammals ---------------- */
/** per-species tweaks to the rig presets (from the asset review) */
const MAMMAL_EXTRA: Record<string, Record<string, unknown>> = {
  // the rig's goat is a domestic goat; the Rocky Mountain goat has short black dagger horns, a beard and a shaggy white coat
  goat: { size: 1.25, specOverride: { wool: 0.035, horns: { style: 'antelope', len: 0.42, thk: 0.065, s: 0.1, a: 0.3 }, palette: { body: '#f1eee6', belly: '#f4f1ea', mane: '#ece7dc', horn: '#161514', hoof: '#1d1b19', nose: '#1f1c1a', eye: '#2a2118' } } },
};
const MAMMAL_SPEED: Record<string, number> = { cheetah: 2.4, horse: 2, zebra: 1.8, gazelle: 2.2, deer: 1.6, wolf: 1.8, lion: 1.4, mouse: 0.6, hedgehog: 0.4, rabbit: 1.0, squirrel: 0.9, elephant: 1.2, giraffe: 1.4, hippo: 0.9, polarBear: 1.2 };
for (const m of MAMMALS) {
  add({
    id: `mammal/${m.key}`, name: m.name, emoji: m.emoji, category: 'animals', group: 'Mammals', family: 'mammal', path: P.mammal,
    params: { species: m.key, rigMode: 'skinned', mergeForProduction: true, ...MAMMAL_EXTRA[m.key] },
    hidden: ['species', 'rigMode', 'pose', 'posePhase', 'detail', 'mergeForProduction', 'hide', 'specOverride'],
    loco: m.key === 'otter' || m.key === 'beaver' || m.key === 'hippo' ? 'walk' : 'walk', biomes: m.biomes, info: m.info,
    speed: MAMMAL_SPEED[m.key] ?? 1.2,
  });
}
/* ---------------- animals: rigged birds ---------------- */
for (const b of BIRDS) {
  const ground = GROUND_BIRDS.has(b.key);
  add({
    id: `bird/${b.key}`, name: b.name, emoji: b.emoji, category: 'animals', group: 'Birds', family: 'bird', path: P.bird,
    params: { species: b.key, rigMode: 'skinned', mergeForProduction: true },
    hidden: ['species', 'rigMode', 'pose', 'posePhase', 'detail', 'mergeForProduction', 'bodyForm'],
    loco: ground ? 'walk' : 'fly', biomes: b.biomes, info: b.info, speed: ground ? 0.8 : 3.5, lift: ground ? 0 : 0,
  });
}
/* ---------------- reptiles & amphibians ---------------- */
for (const r of REPTILES) {
  add({
    id: `reptile/${r.id}`, name: r.name, emoji: r.emoji, category: 'animals', group: r.info.class === 'Amphibia' ? 'Amphibians' : 'Reptiles', family: 'reptile',
    path: P.reptile(r.id), params: { mergeForProduction: true }, hidden: ['mergeForProduction'], loco: r.loco, biomes: r.biomes, info: r.info,
    speed: r.loco === 'hop' ? 0.6 : r.loco === 'slither' ? 0.5 : 0.45, water: r.loco === 'swim' ? 'column' : undefined,
  });
}
/* ---------------- Wildform: fish, invertebrates, microscopic life and more ---------------- */
const CLASS_BY_CAT: Record<string, string> = { Mammals: 'Mammalia', Birds: 'Aves', Reptiles: 'Reptilia', Amphibians: 'Amphibia' };
for (const a of WILDFORM) {
  const aug = WILDFORM_AUG[a.id];
  if (!aug) continue;
  const [emoji, cls, diet, biomes, loco, eats, tags, groupOverride] = aug;
  const group = wildformGroup(a.category, a.phylum, groupOverride);
  const swim = loco === 'swim';
  const info: SpeciesInfo = {
    scientific: a.scientific, kingdom: 'Animalia', phylum: a.phylum, class: cls || CLASS_BY_CAT[a.category], diet,
    habitat: a.habitat, fact: WILDFORM_FACTS[a.id] ?? a.description, status: WILDFORM_STATUS[a.id], eats: eats ? eats.split(' ') : [], tags: tags.split(' '),
    size: a.length < 0.01 ? `${(a.length * 1000).toFixed(a.length < 0.001 ? 2 : 1)} mm` : a.length < 1 ? `${Math.round(a.length * 100)} cm` : `${a.length} m`,
  };
  add({
    id: `wild/${a.id}`, name: a.name, emoji, category: 'animals', group, family: 'wildform', path: P.wildform,
    params: { __animal: a.id }, hidden: ['__animal', 'detailLevel', 'mergeForProduction'],
    loco: loco as Locomotion, biomes: biomes.split(' '), info, yaw: -Math.PI / 2, realLength: a.length,
    speed: loco === 'fly' ? (a.length < 0.1 ? 1.2 : 3) : swim ? 0.8 : loco === 'crawl' ? 0.25 : 1,
    water: swim ? 'column' : ['blue-crab', 'american-lobster', 'horseshoe-crab', 'ochre-sea-star', 'purple-sea-urchin', 'crown-of-thorns-starfish', 'sea-cucumber', 'sea-hare', 'giant-clam', 'staghorn-coral', 'rose-anemone', 'barrel-sponge', 'venus-flower-basket', 'glass-sponge', 'peacock-worm', 'moss-animal'].includes(a.id) ? 'bed' : undefined,
    // species the asset review found inaccurate are rebuilt on better models (same id)
    ...WILDFORM_REMAP[a.id],
  });
}

/* ---------------- water-world life (flocks, schools, families) ---------------- */
add({ id: 'water/duck-family', name: 'Duck family', emoji: '🦆', category: 'animals', group: 'Birds', family: 'water', path: P.water('duck-family'), params: { waterPatch: false, mergeForProduction: true, pathRadius: 2.5 }, hidden: ['waterPatch', 'mergeForProduction'], loco: 'scenery', biomes: ['wetland', 'garden'], water: 'surface', info: { scientific: 'Anas platyrhynchos', kingdom: 'Animalia', phylum: 'Chordata', class: 'Aves', order: 'Anseriformes', family: 'Anatidae', diet: 'omnivore', status: 'Least Concern', fact: 'Ducklings follow the first moving thing they see after hatching — usually their mother.', eats: ['aquatic-plants', 'insect', 'seeds'], tags: ['bird'] } });
add({ id: 'water/fish-school', name: 'School of fish', emoji: '🐟', category: 'animals', group: 'Fish', family: 'water', path: P.water('fish-school'), params: { tank: false, mergeForProduction: true, count: 40, radius: 3, depth: 1.5, species: 'sardine' }, hidden: ['tank', 'mergeForProduction'], loco: 'scenery', biomes: ['reef', 'kelp', 'shore', 'wetland', 'tundra'], water: 'column', info: { scientific: 'Sardina pilchardus', kingdom: 'Animalia', phylum: 'Chordata', class: 'Actinopterygii', diet: 'filter feeder', fact: 'Swimming in a school confuses predators and saves energy — like cyclists drafting.', eats: ['plankton'], tags: ['fish'] } });
add({ id: 'water/seagull-flock', name: 'Seagull flock', emoji: '🕊️', category: 'animals', group: 'Birds', family: 'water', path: P.water('seagull-flock'), params: { waterPatch: false, posts: 0, flying: 8, floating: 0, radius: 12, height: 9, mergeForProduction: true }, hidden: ['waterPatch', 'mergeForProduction'], loco: 'scenery', biomes: ['shore'], info: { scientific: 'Larus argentatus', kingdom: 'Animalia', phylum: 'Chordata', class: 'Aves', diet: 'omnivore', fact: 'Gulls can drink salt water — special glands near their eyes remove the salt.', eats: ['fish', 'shellfish', 'carrion'], tags: ['bird'] } });
add({ id: 'water/whale', name: 'Whale (surfacing)', emoji: '🐋', category: 'animals', group: 'Mammals', family: 'water', path: P.water('whale'), params: { waterPatch: false, mergeForProduction: true, behaviour: 'cruise' }, hidden: ['waterPatch', 'mergeForProduction'], loco: 'scenery', biomes: ['tundra', 'shore', 'kelp'], water: 'surface', heavy: true, info: { scientific: 'Megaptera novaeangliae', kingdom: 'Animalia', phylum: 'Chordata', class: 'Mammalia', order: 'Artiodactyla', diet: 'filter feeder', status: 'Least Concern', fact: 'Whales breathe air through a blowhole on top of their head.', eats: ['plankton', 'fish'], tags: ['whale'] } });

/* ---------------- aquarium kit (corals, reef fish, shrimp) ---------------- */
const AQ = (id: string, name: string, emoji: string, module: string, params: Record<string, unknown>, info: SpeciesInfo, biomes: string[], group: string, cat: 'animals' | 'plants' = 'animals', loco: Locomotion = 'sessile') =>
  add({ id: `aqua/${id}`, name, emoji, category: cat, group, family: 'aquarium', path: P.aquarium(module), params: { mergeForProduction: true, ...params }, hidden: ['mergeForProduction'], loco, biomes, info, scale: 4, water: 'bed' });
AQ('soft-coral', 'Soft coral colony', '🪸', 'coral-soft', { coralType: 'xenia' }, { kingdom: 'Animalia', phylum: 'Cnidaria', class: 'Octocorallia', diet: 'filter feeder', fact: 'Pulsing xenia corals wave their polyps to stir water and gather food.', eats: ['plankton'], tags: ['coral'] }, ['reef'], 'Corals');
AQ('anemone', 'Sea anemone', '🌺', 'coral-soft', { coralType: 'anemone' }, { kingdom: 'Animalia', phylum: 'Cnidaria', class: 'Hexacorallia', diet: 'carnivore', fact: 'Clownfish shelter among anemone tentacles — a classic example of mutualism.', eats: ['plankton', 'fish'], tags: ['coral'] }, ['reef', 'shore'], 'Corals');
AQ('stony-coral', 'Stony coral', '🪸', 'coral-sps', { growthForm: 'branching' }, { kingdom: 'Animalia', phylum: 'Cnidaria', class: 'Hexacorallia', diet: 'filter feeder', fact: 'Reef-building corals get most of their food from algae living inside their tissues.', eats: ['plankton'], tags: ['coral'] }, ['reef'], 'Corals');
AQ('plate-coral', 'Plate coral', '🪸', 'coral-sps', { growthForm: 'plating' }, { kingdom: 'Animalia', phylum: 'Cnidaria', class: 'Hexacorallia', diet: 'filter feeder', fact: 'Plating corals grow flat to catch as much sunlight as possible.', eats: ['plankton'], tags: ['coral'] }, ['reef'], 'Corals');
AQ('cleaner-shrimp', 'Cleaner shrimp', '🦐', 'fauna-bottom-dwellers', { species: 'shrimp', population: 6 }, { kingdom: 'Animalia', phylum: 'Arthropoda', class: 'Malacostraca', diet: 'omnivore', fact: 'Cleaner shrimp pick parasites off fish — even inside their mouths!', eats: ['detritus', 'algae'], tags: ['shellfish'] }, ['reef'], 'Sea invertebrates');
AQ('hermit-crab', 'Hermit crabs', '🐚', 'fauna-bottom-dwellers', { species: 'hermit', population: 5 }, { kingdom: 'Animalia', phylum: 'Arthropoda', class: 'Malacostraca', diet: 'detritivore', fact: 'Hermit crabs move into bigger empty shells as they grow.', eats: ['detritus', 'algae'], tags: ['shellfish'] }, ['reef', 'shore'], 'Sea invertebrates');
AQ('angelfish', 'Angelfish pair', '🐠', 'fauna-hero-fish', { species: 'angelfish', count: 2, colorway: 'angel-silver' }, { scientific: 'Pterophyllum scalare', kingdom: 'Animalia', phylum: 'Chordata', class: 'Actinopterygii', order: 'Cichliformes', family: 'Cichlidae', diet: 'omnivore', status: 'Not evaluated', fact: 'Black bars help angelfish hide among reeds and roots in Amazon rivers; pairs take turns fanning their eggs.', eats: ['plankton', 'insect'], tags: ['fish'] }, ['rainforest', 'wetland'], 'Fish', 'animals', 'swim');
AQ('neon-school', 'Neon tetras', '🐟', 'fauna-schooling-fish', { species: 'neon', schoolSize: 30 }, { kingdom: 'Animalia', phylum: 'Chordata', class: 'Actinopterygii', diet: 'omnivore', fact: 'Neon tetras shimmer so the school stays together in dark rainforest rivers.', eats: ['plankton', 'insect'], tags: ['fish'] }, ['rainforest', 'wetland'], 'Fish', 'animals', 'swim');
AQ('vallisneria', 'Eelgrass (Vallisneria)', '🌿', 'flora-background', { plantSpecies: 'vallisneria' }, { kingdom: 'Plantae', phylum: 'Tracheophyta', class: 'Liliopsida', diet: 'producer', fact: 'Underwater plants release oxygen bubbles you can sometimes see rising.', tags: ['aquatic-plants'] }, ['wetland'], 'Water plants', 'plants');

/* ---------------- plants (Worldflora) ---------------- */
type PlantRow = [string, string, string, string, string, string, string, string];
const PLANTS: PlantRow[] = [
  ['Monstera', '🪴', 'Monstera deliciosa', 'Araceae', 'rainforest', 'Holes in its leaves may let wind and light pass through to lower leaves.', 'leaves fruit', 'Rainforest plants'],
  ['Bird-of-paradise', '🌺', 'Strelitzia reginae', 'Strelitziaceae', 'rainforest garden', 'Sunbirds landing on the flower get dusted with pollen on their feet.', 'nectar leaves', 'Rainforest plants'],
  ['Maidenhair fern', '🌿', 'Adiantum capillus-veneris', 'Pteridaceae', 'forest rainforest', 'Ferns have no flowers or seeds — they reproduce with spores.', 'leaves', 'Ferns'],
  ['Fiddle-leaf fig', '🌳', 'Ficus lyrata', 'Moraceae', 'rainforest', 'Each fig is pollinated by its own tiny species of wasp.', 'leaves fruit', 'Rainforest plants'],
  ['Echeveria', '🌵', 'Echeveria elegans', 'Crassulaceae', 'desert', 'Its rosette shape funnels rain to the roots.', 'leaves', 'Desert plants'],
  ['Agave', '🌵', 'Agave americana', 'Asparagaceae', 'desert', 'The “century plant” grows for decades, flowers once, then dies.', 'leaves nectar', 'Desert plants'],
  ['Barrel cactus', '🌵', 'Ferocactus wislizeni', 'Cactaceae', 'desert', 'Spines are modified leaves that shade the cactus and stop thirsty animals.', 'cactus fruit', 'Desert plants'],
  ['Columnar cactus', '🌵', 'Carnegiea gigantea', 'Cactaceae', 'desert', 'A young saguaro: it grows only a few centimetres a year and sprouts its first arm at 50–75 years old.', 'cactus fruit nectar', 'Desert plants'],
  ['Nepenthes pitcher plant', '🏺', 'Nepenthes sp.', 'Nepenthaceae', 'rainforest', 'Insects slip into its pitcher and are digested — it lives in nutrient-poor soil.', 'leaves', 'Carnivorous plants'],
  ['Venus flytrap', '🪤', 'Dionaea muscipula', 'Droseraceae', 'wetland', 'Its trap snaps shut only if two trigger hairs are touched within about 20 seconds.', 'leaves', 'Carnivorous plants'],
  ['Sundew', '💧', 'Drosera sp.', 'Droseraceae', 'wetland', 'Sticky “dew” drops glue insects to its leaves.', 'leaves', 'Carnivorous plants'],
  ['Haworthia zebra', '🌵', 'Haworthiopsis attenuata', 'Asphodelaceae', 'desert', 'Its white stripes are bumps that may help reflect harsh sunlight.', 'leaves', 'Desert plants'],
  ['Jade plant', '🌱', 'Crassula ovata', 'Crassulaceae', 'desert', 'Jade plants open their pores at night to save water.', 'leaves', 'Desert plants'],
  ['Aloe vera', '🌵', 'Aloe vera', 'Asphodelaceae', 'desert', 'Thick leaves store gel-like water for dry seasons.', 'leaves nectar', 'Desert plants'],
  ['Fountain grass', '🌾', 'Pennisetum setaceum', 'Poaceae', 'savanna grassland', 'Grasses grow from their base, so they survive grazing and fire.', 'grass seeds', 'Grasses'],
  ['Pampas grass', '🌾', 'Cortaderia selloana', 'Poaceae', 'grassland wetland', 'Its feathery plumes release seeds that float away on the wind.', 'grass seeds', 'Grasses'],
  ['Lavender shrub', '💜', 'Lavandula angustifolia', 'Lamiaceae', 'garden grassland', 'Bees love lavender — its scent also keeps some pests away.', 'nectar leaves', 'Garden plants'],
  ['Hydrangea shrub', '💐', 'Hydrangea macrophylla', 'Hydrangeaceae', 'garden', 'Acidic soil turns some hydrangea flowers blue; alkaline soil turns them pink.', 'nectar leaves', 'Garden plants'],
  ['Geranium', '🌸', 'Pelargonium sp.', 'Geraniaceae', 'garden', 'Geranium leaves are fragrant when touched.', 'nectar leaves', 'Garden plants'],
  ['Marigold', '🌼', 'Tagetes erecta', 'Asteraceae', 'garden grassland', 'Each marigold “flower” is really hundreds of tiny flowers packed together.', 'nectar leaves', 'Garden plants'],
  ['Boxwood topiary', '🌳', 'Buxus sempervirens', 'Buxaceae', 'garden', 'Topiary is the art of clipping shrubs into shapes.', 'leaves', 'Garden plants'],
  ['Rosemary topiary', '🌿', 'Salvia rosmarinus', 'Lamiaceae', 'garden', 'Rosemary’s needle-like leaves lose little water in dry summers.', 'leaves nectar', 'Garden plants'],
];
/** display names that differ from the Worldflora species key */
const PLANT_NAMES: Record<string, string> = { 'Columnar cactus': 'Young saguaro' };
for (const [species, emoji, sci, fam, biomes, fact, tags, group] of PLANTS) {
  add({
    id: `plant/${species.toLowerCase().replace(/[^a-z]+/g, '-')}`, name: PLANT_NAMES[species] ?? species, emoji, category: 'plants', group, family: 'plant', path: P.plant,
    params: { species, potStyle: 'none', mergeForProduction: true }, hidden: ['species', 'mergeForProduction', 'advancedColorOverrides', 'hangingLength', 'hangingCordCount', 'hangerSway'],
    loco: 'sessile', biomes: biomes.split(' '), heavy: true,
    info: { scientific: sci, kingdom: 'Plantae', phylum: group === 'Ferns' ? 'Tracheophyta (ferns)' : 'Tracheophyta', class: group === 'Grasses' ? 'Liliopsida' : group === 'Ferns' ? 'Polypodiopsida' : 'Magnoliopsida', family: fam, diet: group === 'Carnivorous plants' ? 'carnivorous plant' : 'producer', fact, tags: tags.split(' '), eats: group === 'Carnivorous plants' ? ['insect'] : [] },
  });
}

/* ---------------- trees ---------------- */
const TREE = (id: string, name: string, emoji: string, family: 'deciduous' | 'conifer' | 'terraTree', params: Record<string, unknown>, biomes: string, info: SpeciesInfo, heavy = false, group = 'Trees') =>
  add({ id: `tree/${id}`, name, emoji, category: 'plants', group, family, path: family === 'deciduous' ? P.deciduous : family === 'conifer' ? P.conifer : P.terraTree, params: { mergeForProduction: true, ...params }, hidden: ['mergeForProduction', 'speciesProfile', 'species'], loco: 'sessile', biomes: biomes.split(' '), info: { kingdom: 'Plantae', phylum: 'Tracheophyta', diet: 'producer', ...info }, heavy });
const DECID = { leafDetailLevel: 'low', groundDebrisVisible: false, fallingLeavesVisible: false };
TREE('oak', 'Oak tree', '🌳', 'deciduous', { ...DECID, speciesProfile: 'oak', treeHeight: 9, canopyWidth: 8.5, foliageDensity: 0.5 }, 'forest garden', { scientific: 'Quercus robur', class: 'Magnoliopsida', order: 'Fagales', family: 'Fagaceae', fact: 'A single old oak can support over 2,000 other species.', tags: ['leaves', 'seeds', 'bark'] }, true);
TREE('maple', 'Maple tree', '🍁', 'deciduous', { ...DECID, speciesProfile: 'maple', treeHeight: 9, canopyWidth: 8, foliageDensity: 0.45 }, 'forest', { scientific: 'Acer saccharum', class: 'Magnoliopsida', order: 'Sapindales', family: 'Sapindaceae', fact: 'Maple seeds (samaras) spin like helicopter blades as they fall.', tags: ['leaves', 'seeds', 'bark'] }, true);
TREE('aspen', 'Aspen tree', '🌳', 'deciduous', { ...DECID, speciesProfile: 'aspen', treeHeight: 10, canopyWidth: 4.5, foliageDensity: 0.45 }, 'taiga forest mountain', { scientific: 'Populus tremuloides', class: 'Magnoliopsida', order: 'Malpighiales', family: 'Salicaceae', fact: 'An aspen grove can be one giant organism joined by its roots.', tags: ['leaves', 'bark'] }, true);
TREE('willow', 'Weeping willow', '🌳', 'deciduous', { ...DECID, speciesProfile: 'willow', treeHeight: 8, canopyWidth: 8, foliageDensity: 0.25 }, 'wetland', { scientific: 'Salix babylonica', class: 'Magnoliopsida', order: 'Malpighiales', family: 'Salicaceae', fact: 'Willow bark contains salicin — the natural origin of aspirin.', tags: ['leaves', 'bark'] }, true);
TREE('broadleaf', 'Broadleaf tree', '🌳', 'deciduous', { ...DECID, speciesProfile: 'stylized', treeHeight: 8.5, canopyWidth: 7.5, foliageDensity: 0.6 }, 'forest garden wetland grassland', { scientific: 'Angiospermae', class: 'Magnoliopsida', fact: 'Broadleaf trees drop their leaves in autumn to save water through the winter.', tags: ['leaves', 'seeds', 'fruit'] });
/* ---- our own high-detail flora (src/assets/flora): replaces the low-poly placeholders ---- */
const FLORA_HIDDEN = ['species', 'detail', 'season', 'kinds'];
const FL = (id: string, name: string, emoji: string, species: string, biomes: string, info: SpeciesInfo, o: { group?: string; params?: Record<string, unknown>; seasonal?: boolean; heavy?: boolean; module?: 'trees' | 'herbs'; water?: AssetDef['water'] } = {}) =>
  add({
    id, name, emoji, category: 'plants', group: o.group ?? 'Trees', family: 'flora', path: P.flora(o.module ?? 'trees'), params: { species, ...o.params }, hidden: FLORA_HIDDEN,
    loco: 'sessile', biomes: biomes.split(' '), seasonal: o.seasonal, heavy: o.heavy ?? (o.module ?? 'trees') === 'trees', water: o.water,
    info: { kingdom: 'Plantae', phylum: 'Tracheophyta', diet: 'producer', ...info },
  });
const CONE = { class: 'Pinopsida', order: 'Pinales' };
FL('tree/spruce', 'Norway spruce', '🌲', 'norway-spruce', 'taiga mountain forest', { ...CONE, scientific: 'Picea abies', family: 'Pinaceae', fact: 'Spruce cones hang down; their branches droop so heavy snow slides off instead of snapping them.', tags: ['leaves', 'seeds', 'bark'] });
FL('tree/pine', 'Scots pine', '🌲', 'scots-pine', 'taiga forest mountain', { ...CONE, scientific: 'Pinus sylvestris', family: 'Pinaceae', fact: 'Pine needles grow in bundles (two for a Scots pine); its upper bark peels in thin orange flakes.', tags: ['leaves', 'seeds', 'bark'] });
FL('tree/fir', 'Balsam fir', '🌲', 'balsam-fir', 'taiga mountain', { ...CONE, scientific: 'Abies balsamea', family: 'Pinaceae', fact: 'Fir cones stand upright on the branch and fall apart on the tree to release their seeds.', tags: ['leaves', 'seeds', 'bark'] });
FL('tree/small-pine', 'Young pine', '🌲', 'scots-pine', 'taiga forest mountain tundra', { ...CONE, scientific: 'Pinus sylvestris', family: 'Pinaceae', fact: 'Young pines grow fastest in sunny gaps; each year adds one new whorl of branches.', tags: ['leaves', 'seeds'] }, { params: { height: 4.2 }, heavy: false });
FL('tree/small-fir', 'Young fir', '🌲', 'balsam-fir', 'taiga mountain', { ...CONE, scientific: 'Abies balsamea', family: 'Pinaceae', fact: 'Firs are shade tolerant — they can wait for decades under taller trees until a gap opens.', tags: ['leaves', 'seeds'] }, { params: { height: 4.8 }, heavy: false });
FL('tree/cedar', 'Blue Atlas cedar', '🌲', 'atlas-cedar', 'mountain', { ...CONE, scientific: 'Cedrus atlantica', family: 'Pinaceae', fact: 'Its flat, layered branches catch light like shelves; the waxy blue needles reflect harsh mountain sun.', tags: ['leaves', 'seeds', 'bark'] });
FL('tree/larch', 'European larch', '🌲', 'larch', 'taiga mountain', { ...CONE, scientific: 'Larix decidua', family: 'Pinaceae', fact: 'A conifer that turns gold and drops its needles every autumn — saving water through frozen winters.', tags: ['leaves', 'seeds', 'bark'] }, { seasonal: true });
FL('tree/redwood', 'Coast redwood', '🌲', 'coast-redwood', 'forest', { ...CONE, scientific: 'Sequoia sempervirens', family: 'Cupressaceae', status: 'Endangered', fact: 'The tallest trees on Earth (over 115 m). Their thick, spongy bark has little resin, so it resists fire.', tags: ['leaves', 'seeds', 'bark'] });
FL('tree/bald-cypress', 'Bald cypress', '🌲', 'bald-cypress', 'wetland', { ...CONE, scientific: 'Taxodium distichum', family: 'Cupressaceae', fact: 'Woody “knees” poke up from its roots in swamps; the grey Spanish moss hanging from it is a flowering plant, not a moss.', tags: ['leaves', 'seeds', 'bark'] }, { seasonal: true });
FL('tree/palm', 'Coconut palm', '🌴', 'coconut-palm', 'rainforest shore', { class: 'Liliopsida', order: 'Arecales', family: 'Arecaceae', scientific: 'Cocos nucifera', fact: 'Coconuts float — they can drift across oceans and sprout on a new island’s beach.', tags: ['leaves', 'fruit'] });
FL('tree/date-palm', 'Date palm', '🌴', 'date-palm', 'desert', { class: 'Liliopsida', order: 'Arecales', family: 'Arecaceae', scientific: 'Phoenix dactylifera', fact: 'Date palms grow where groundwater reaches the surface, creating desert oases; people have farmed them for 6,000 years.', tags: ['leaves', 'fruit'] });
FL('tree/acacia', 'Umbrella thorn acacia', '🌳', 'umbrella-acacia', 'savanna', { class: 'Magnoliopsida', order: 'Fabales', family: 'Fabaceae', scientific: 'Vachellia tortilis', fact: 'Its flat crown shades the ground, and long thorns guard the leaves — giraffes strip them off with 50 cm tongues anyway.', tags: ['leaves', 'seeds'] });
FL('tree/baobab', 'African baobab', '🌳', 'baobab', 'savanna', { class: 'Magnoliopsida', order: 'Malvales', family: 'Malvaceae', scientific: 'Adansonia digitata', fact: 'Its swollen trunk stores up to 100,000 litres of water; it stands leafless through the dry season like an upside-down tree.', tags: ['leaves', 'fruit', 'bark'] }, { seasonal: true });
FL('tree/jungle', 'Kapok tree', '🌳', 'kapok', 'rainforest', { class: 'Magnoliopsida', order: 'Malvales', family: 'Malvaceae', scientific: 'Ceiba pentandra', fact: 'An emergent giant that rises above the canopy on wing-like buttress roots; vines and bromeliads live on its branches.', tags: ['leaves', 'fruit', 'seeds'] });
FL('tree/mangrove', 'Red mangrove', '🌳', 'mangrove', 'wetland shore rainforest', { class: 'Magnoliopsida', order: 'Malpighiales', family: 'Rhizophoraceae', scientific: 'Rhizophora mangle', fact: 'Arching stilt roots hold it up in salty tidal mud and shelter baby fish; its seeds sprout while still on the tree.', tags: ['leaves', 'aquatic-plants'] });
FL('tree/birch', 'Paper birch', '🌳', 'paper-birch', 'forest taiga', { class: 'Magnoliopsida', order: 'Fagales', family: 'Betulaceae', scientific: 'Betula papyrifera', fact: 'Its white bark reflects sunlight so the trunk doesn’t overheat and crack on sunny winter days.', tags: ['leaves', 'seeds', 'bark'] }, { seasonal: true });
FL('tree/cherry', 'Japanese cherry', '🌸', 'cherry', 'garden forest', { class: 'Magnoliopsida', order: 'Rosales', family: 'Rosaceae', scientific: 'Prunus serrulata', fact: 'Cherry blossoms open for only a week or two in spring — bees race to collect their nectar and pollen.', tags: ['leaves', 'nectar', 'fruit'] }, { seasonal: true });
FL('tree/apple', 'Apple tree', '🍎', 'apple', 'garden', { class: 'Magnoliopsida', order: 'Rosales', family: 'Rosaceae', scientific: 'Malus domestica', fact: 'Bees carry pollen between apple blossoms; every seed in an apple would grow into a different kind of apple tree.', tags: ['leaves', 'nectar', 'fruit'] }, { seasonal: true });
FL('tree/shrub', 'Hawthorn shrub', '🌿', 'hawthorn', 'forest garden grassland taiga mountain', { class: 'Magnoliopsida', order: 'Rosales', family: 'Rosaceae', scientific: 'Crataegus monogyna', fact: 'Its thorny tangle hides nesting birds, and its red winter berries (haws) feed thrushes and mice.', tags: ['leaves', 'fruit', 'nectar'] }, { seasonal: true, heavy: false });
FL('tree/creosote', 'Creosote bush', '🌿', 'creosote-bush', 'desert', { class: 'Magnoliopsida', order: 'Zygophyllales', family: 'Zygophyllaceae', scientific: 'Larrea tridentata', fact: 'Waxy, bitter leaves lose little water; one creosote ring in the Mojave has been growing for about 11,000 years.', tags: ['leaves', 'seeds'] }, { heavy: false });
FL('tree/arctic-willow', 'Arctic willow', '🌿', 'arctic-willow', 'tundra mountain', { class: 'Magnoliopsida', order: 'Malpighiales', family: 'Salicaceae', scientific: 'Salix arctica', fact: 'A “tree” only ankle-high: it creeps along the ground, out of the freezing wind. Caribou and hares browse it.', tags: ['leaves', 'bark'] }, { seasonal: true, heavy: false });
FL('tree/saguaro', 'Saguaro', '🌵', 'saguaro', 'desert', { class: 'Magnoliopsida', order: 'Caryophyllales', family: 'Cactaceae', scientific: 'Carnegiea gigantea', fact: 'Saguaros grow their first arm at 50–75 years old; Gila woodpeckers carve nest holes that elf owls later move into.', tags: ['cactus', 'fruit', 'nectar'] }, { seasonal: true, group: 'Desert plants' });
FL('tree/joshua-tree', 'Joshua tree', '🌵', 'joshua-tree', 'desert', { class: 'Liliopsida', order: 'Asparagales', family: 'Asparagaceae', scientific: 'Yucca brevifolia', fact: 'A giant yucca, not a tree. Only one tiny moth — the yucca moth — pollinates its flowers.', tags: ['leaves', 'seeds', 'nectar'] }, { seasonal: true, group: 'Desert plants' });
FL('tree/banana', 'Banana plant', '🍌', 'banana', 'rainforest garden', { class: 'Liliopsida', order: 'Zingiberales', family: 'Musaceae', scientific: 'Musa acuminata', fact: 'The world’s largest herb: its “trunk” is just tightly rolled leaf stalks. Wind tears the huge leaves into strips.', tags: ['leaves', 'fruit', 'nectar'] }, { group: 'Rainforest plants' });
FL('tree/tree-fern', 'Tree fern', '🌿', 'tree-fern', 'rainforest forest', { phylum: 'Tracheophyta (ferns)', class: 'Polypodiopsida', order: 'Cyatheales', family: 'Dicksoniaceae', scientific: 'Dicksonia antarctica', fact: 'Ferns were growing like this before the dinosaurs; new fronds unroll from tight “fiddleheads”.', tags: ['leaves'] }, { group: 'Ferns' });
FL('tree/bamboo', 'Bamboo grove', '🎋', 'bamboo', 'forest rainforest mountain', { class: 'Liliopsida', order: 'Poales', family: 'Poaceae', scientific: 'Phyllostachys edulis', fact: 'Bamboo is a giant grass — some kinds grow almost a metre in a day. Giant pandas eat little else.', tags: ['leaves', 'grass'] }, { group: 'Grasses' });
FL('tree/blueberry', 'Blueberry bush', '🫐', 'blueberry', 'forest taiga mountain tundra', { class: 'Magnoliopsida', order: 'Ericales', family: 'Ericaceae', scientific: 'Vaccinium angustifolium', fact: 'Bears, foxes and birds eat the berries and spread the seeds in their droppings; the leaves blaze red in autumn.', tags: ['fruit', 'leaves', 'nectar'] }, { seasonal: true, heavy: false, group: 'Shrubs' });
/* ---- wildflowers, grasses, ferns, lichens & water plants (src/assets/flora/herbs.ts) ---- */
const HB = (id: string, name: string, emoji: string, species: string, biomes: string, group: string, info: SpeciesInfo, o: { params?: Record<string, unknown>; water?: AssetDef['water']; category?: AssetDef['category'] } = {}) => {
  FL(`plant/${id}`, name, emoji, species, biomes, info, { group, module: 'herbs', params: o.params, seasonal: true, heavy: false, water: o.water });
  if (o.category) CATALOG_FIX.push([`plant/${id}`, o.category]);
};
const CATALOG_FIX: [string, AssetDef['category']][] = [];
const DICOT = { class: 'Magnoliopsida' }, MONOCOT = { class: 'Liliopsida' };
HB('sunflower', 'Sunflower', '🌻', 'sunflower', 'grassland garden', 'Wildflowers', { ...DICOT, order: 'Asterales', family: 'Asteraceae', scientific: 'Helianthus annuus', fact: 'Young sunflowers follow the sun across the sky; grown-up flowers stop and face east, warming up fast to attract morning bees.', tags: ['nectar', 'seeds', 'leaves'] });
HB('daisies', 'Oxeye daisies', '🌼', 'oxeye-daisy', 'grassland garden forest mountain', 'Wildflowers', { ...DICOT, order: 'Asterales', family: 'Asteraceae', scientific: 'Leucanthemum vulgare', fact: 'Each “flower” is a team: white ray florets around hundreds of tiny yellow disc florets.', tags: ['nectar', 'leaves'] });
HB('poppies', 'Red poppies', '🌺', 'poppy', 'grassland garden', 'Wildflowers', { ...DICOT, order: 'Ranunculales', family: 'Papaveraceae', scientific: 'Papaver rhoeas', fact: 'Poppy seeds can wait in the soil for 80 years and sprout when the ground is disturbed.', tags: ['nectar', 'seeds', 'leaves'] });
HB('lupines', 'Lupines', '🪻', 'lupine', 'grassland mountain garden', 'Wildflowers', { ...DICOT, order: 'Fabales', family: 'Fabaceae', scientific: 'Lupinus polyphyllus', fact: 'Bacteria in lupine roots turn nitrogen from the air into fertiliser, so lupines can grow in poor, rocky soil.', tags: ['nectar', 'leaves', 'seeds'] });
HB('foxglove', 'Foxgloves', '🪻', 'foxglove', 'forest garden', 'Wildflowers', { ...DICOT, order: 'Lamiales', family: 'Plantaginaceae', scientific: 'Digitalis purpurea', fact: 'Poisonous to eat, but a medicine made from it (digoxin) helps weak hearts. Bumblebees climb right into the bells.', tags: ['nectar'] });
HB('coneflower', 'Purple coneflowers', '🌸', 'coneflower', 'grassland garden', 'Wildflowers', { ...DICOT, order: 'Asterales', family: 'Asteraceae', scientific: 'Echinacea purpurea', fact: 'Butterflies sip nectar from the spiky cone, and goldfinches eat its seeds in winter.', tags: ['nectar', 'seeds', 'leaves'] });
HB('milkweed', 'Common milkweed', '🌸', 'milkweed', 'grassland garden', 'Wildflowers', { ...DICOT, order: 'Gentianales', family: 'Apocynaceae', scientific: 'Asclepias syriaca', fact: 'The only food monarch caterpillars eat. Its milky sap is toxic, and the caterpillars store it to become poisonous to birds.', tags: ['nectar', 'leaves'] });
HB('goldenrod', 'Goldenrod', '🌾', 'goldenrod', 'grassland garden', 'Wildflowers', { ...DICOT, order: 'Asterales', family: 'Asteraceae', scientific: 'Solidago canadensis', fact: 'A late-summer feast for bees and butterflies stocking up before winter.', tags: ['nectar', 'leaves', 'seeds'] });
HB('bluebells', 'Bluebells', '🔔', 'bluebells', 'forest', 'Wildflowers', { ...MONOCOT, order: 'Asparagales', family: 'Asparagaceae', scientific: 'Hyacinthoides non-scripta', fact: 'Bluebells flower in spring before the trees above leaf out and shade the woodland floor.', tags: ['nectar', 'leaves'] });
HB('dandelions', 'Dandelions', '🌼', 'dandelion', 'grassland garden mountain', 'Wildflowers', { ...DICOT, order: 'Asterales', family: 'Asteraceae', scientific: 'Taraxacum officinale', fact: 'Each “clock” holds up to 200 seeds on tiny parachutes that can drift for kilometres.', tags: ['nectar', 'leaves', 'seeds'] });
HB('clover', 'White clover', '☘️', 'clover', 'grassland garden', 'Wildflowers', { ...DICOT, order: 'Fabales', family: 'Fabaceae', scientific: 'Trifolium repens', fact: 'Rabbits graze it and bees love it; like lupines, it fertilises the soil with nitrogen.', tags: ['leaves', 'nectar', 'grass'] });
HB('edelweiss', 'Edelweiss', '⭐', 'edelweiss', 'mountain', 'Wildflowers', { ...DICOT, order: 'Asterales', family: 'Asteraceae', scientific: 'Leontopodium nivale', fact: 'Its woolly white hairs work like a sunscreen against strong ultraviolet light high in the mountains.', tags: ['nectar', 'leaves'] });
HB('prairie-grass', 'Big bluestem grass', '🌾', 'prairie-grass', 'grassland', 'Grasses', { ...MONOCOT, order: 'Poales', family: 'Poaceae', scientific: 'Andropogon gerardi', fact: 'Its roots reach 3 m deep, holding prairie soil together; the three-pronged seed heads are called “turkey feet”.', tags: ['grass', 'seeds'] });
HB('red-oat-grass', 'Red oat grass', '🌾', 'red-oat-grass', 'savanna grassland', 'Grasses', { ...MONOCOT, order: 'Poales', family: 'Poaceae', scientific: 'Themeda triandra', fact: 'A favourite food of zebras and wildebeest; it regrows quickly after grazing and fire.', tags: ['grass', 'seeds'] });
HB('cotton-grass', 'Cotton grass', '🌾', 'cotton-grass', 'tundra wetland taiga', 'Grasses', { ...MONOCOT, order: 'Poales', family: 'Cyperaceae', scientific: 'Eriophorum vaginatum', fact: 'Not a grass but a sedge. The cotton tufts carry its seeds away on the tundra wind.', tags: ['grass', 'seeds'] });
HB('papyrus', 'Papyrus', '🌾', 'papyrus', 'wetland savanna', 'Water plants', { ...MONOCOT, order: 'Poales', family: 'Cyperaceae', scientific: 'Cyperus papyrus', fact: 'Ancient Egyptians made paper, boats and baskets from its triangular stems.', tags: ['aquatic-plants', 'grass'] });
HB('seagrass', 'Seagrass meadow', '🌱', 'seagrass', 'reef shore kelp', 'Water plants', { ...MONOCOT, order: 'Alismatales', family: 'Zosteraceae', scientific: 'Zostera marina', fact: 'A true flowering plant that lives underwater; sea turtles and manatees graze its meadows, which store huge amounts of carbon.', tags: ['aquatic-plants'] }, { water: 'bed' });
HB('lotus', 'Sacred lotus', '🪷', 'lotus', 'wetland garden', 'Water plants', { ...DICOT, order: 'Proteales', family: 'Nelumbonaceae', scientific: 'Nelumbo nucifera', fact: 'Tiny bumps make lotus leaves self-cleaning: water beads up and rolls off, carrying the dirt away.', tags: ['aquatic-plants', 'seeds'] }, { water: 'surface' });
add({ id: 'plant/kelp', name: 'Giant kelp', emoji: '🌿', category: 'plants', group: 'Water plants', family: 'flora', path: P.flora('herbs'), params: { species: 'giant-kelp' }, hidden: FLORA_HIDDEN, loco: 'sessile', biomes: ['kelp', 'shore'], water: 'bed', heavy: true, info: { scientific: 'Macrocystis pyrifera', kingdom: 'Chromista', phylum: 'Ochrophyta', class: 'Phaeophyceae', order: 'Laminariales', family: 'Laminariaceae', diet: 'producer', fact: 'Not a plant but a brown alga: gas-filled bladders hold its blades up to the light, and it can grow 60 cm in one day.', tags: ['algae'] } });
HB('bracken', 'Bracken fern', '🌿', 'bracken', 'forest taiga', 'Ferns', { phylum: 'Tracheophyta (ferns)', class: 'Polypodiopsida', order: 'Polypodiales', family: 'Dennstaedtiaceae', scientific: 'Pteridium aquilinum', fact: 'One of the most widespread plants on Earth; it spreads by underground stems and turns rusty-brown in autumn.', tags: ['leaves'] });
HB('reindeer-lichen', 'Reindeer lichen', '🩶', 'reindeer-lichen', 'tundra taiga mountain', 'Lichens & mosses', { kingdom: 'Fungi', phylum: 'Ascomycota', class: 'Lecanoromycetes', order: 'Lecanorales', family: 'Cladoniaceae', scientific: 'Cladonia rangiferina', fact: 'A partnership: a fungus houses algae that make food from sunlight. Reindeer and caribou sniff it out under the snow.', tags: ['lichen'] });
HB('moss', 'Moss cushions', '🟢', 'moss', 'forest taiga wetland rainforest mountain', 'Lichens & mosses', { phylum: 'Bryophyta', class: 'Polytrichopsida', order: 'Polytrichales', family: 'Polytrichaceae', scientific: 'Polytrichum commune', fact: 'Mosses have no roots or flowers; they soak up water like a sponge and spread by spores from tiny capsules on stalks.', tags: ['leaves'] });
HB('purple-saxifrage', 'Purple saxifrage', '🌸', 'purple-saxifrage', 'tundra mountain', 'Wildflowers', { ...DICOT, order: 'Saxifragales', family: 'Saxifragaceae', scientific: 'Saxifraga oppositifolia', fact: 'One of the first flowers of the Arctic spring; its low cushion traps warmth and stays out of the wind.', tags: ['nectar', 'leaves'] });
HB('heather', 'Heather', '🪻', 'heather', 'mountain grassland', 'Shrubs', { ...DICOT, order: 'Ericales', family: 'Ericaceae', scientific: 'Calluna vulgaris', fact: 'Purple heather moors feed bees in late summer; grouse eat its young shoots.', tags: ['nectar', 'leaves'] });
HB('prickly-pear', 'Prickly pear cactus', '🌵', 'prickly-pear', 'desert', 'Desert plants', { ...DICOT, order: 'Caryophyllales', family: 'Cactaceae', scientific: 'Opuntia engelmannii', fact: 'Its flat pads are stems; the purple fruits (“tunas”) feed tortoises, birds and javelinas.', tags: ['cactus', 'fruit', 'nectar'] });
HB('bromeliad', 'Bromeliad', '🌺', 'bromeliad', 'rainforest', 'Rainforest plants', { ...MONOCOT, order: 'Poales', family: 'Bromeliaceae', scientific: 'Guzmania lingulata', fact: 'Rainwater pools in its central cup — a tiny pond where poison dart frogs raise their tadpoles.', tags: ['leaves', 'nectar'] });
HB('heliconia', 'Heliconia', '🌺', 'heliconia', 'rainforest', 'Rainforest plants', { ...MONOCOT, order: 'Zingiberales', family: 'Heliconiaceae', scientific: 'Heliconia rostrata', fact: 'Its red “lobster claws” are leaf-like bracts; hummingbirds with curved beaks drink the nectar hidden inside.', tags: ['nectar', 'leaves'] });
for (const [id, cat] of CATALOG_FIX) { const d = defs.find((x) => x.id === id); if (d) d.category = cat; }
const GROVE = (id: string, name: string, emoji: string, kinds: string, biomes: string, fact: string, extra: Record<string, unknown> = {}) =>
  FL(`grove/${id}`, name, emoji, kinds.split(',')[0], biomes, { fact, tags: ['leaves', 'seeds', 'fruit'] }, { group: 'Groves', params: { kinds, count: 6, radius: 4.5, ...extra }, seasonal: true });
GROVE('birch', 'Birch grove', '🌳', 'paper-birch', 'forest taiga', 'Birches are pioneers: their light seeds blow into clearings and grow fast after fires.');
GROVE('mixed', 'Mixed woodland', '🌳', 'paper-birch,norway-spruce,larch,hawthorn', 'forest taiga garden', 'A mix of tree species makes a forest more resilient to pests and storms.', { count: 7 });
GROVE('pines', 'Pine grove', '🌲', 'scots-pine', 'taiga mountain', 'Pine forests are home to red squirrels, crossbills and owls.');
GROVE('palms', 'Palm grove (oasis)', '🌴', 'date-palm,coconut-palm', 'shore rainforest desert', 'Palm groves around desert springs are called oases.', { count: 5 });
add({ id: 'grove/willows', name: 'Willow grove', emoji: '🌳', category: 'plants', group: 'Groves', family: 'water', path: P.water('tree-grove'), params: { species: 'willow', count: 7, radius: 5, height: 8, showGround: false, logs: 1, mergeForProduction: true }, hidden: ['showGround', 'mergeForProduction', 'species'], loco: 'sessile', biomes: ['wetland'], info: { kingdom: 'Plantae', phylum: 'Tracheophyta', diet: 'producer', fact: 'Willow roots hold riverbanks together and stop erosion.', tags: ['leaves', 'seeds', 'fruit'] } });
add({ id: 'plant/reeds', name: 'Reeds & cattails', emoji: '🌾', category: 'plants', group: 'Water plants', family: 'water', path: P.water('reed-bed'), params: { base: false, showBird: false, width: 6, depth: 4, mergeForProduction: true }, hidden: ['base', 'mergeForProduction'], loco: 'sessile', biomes: ['wetland'], info: { scientific: 'Typha latifolia', kingdom: 'Plantae', phylum: 'Tracheophyta', class: 'Liliopsida', family: 'Typhaceae', diet: 'producer', fact: 'Reed beds filter pollution out of water and shelter nesting birds.', tags: ['aquatic-plants', 'seeds'] } });
add({ id: 'plant/water-lilies', name: 'Water lilies', emoji: '🪷', category: 'plants', group: 'Water plants', family: 'water', path: P.water('water-lilies'), params: { waterPatch: false, spread: 2.5, pads: 30, showFrog: true, dragonflies: 2, mergeForProduction: true }, hidden: ['waterPatch', 'mergeForProduction'], loco: 'sessile', biomes: ['wetland', 'garden'], water: 'surface', info: { scientific: 'Nymphaea alba', kingdom: 'Plantae', phylum: 'Tracheophyta', class: 'Magnoliopsida', family: 'Nymphaeaceae', diet: 'producer', fact: 'Lily pads have air pockets that keep them afloat, and pores on top to breathe.', tags: ['aquatic-plants'] } });

/* ---------------- fungi & habitat features (built-in) ---------------- */
const FUNGI: [string, string, string, string, string][] = [
  ['fly-agaric', 'Fly agaric', 'Amanita muscaria', 'forest taiga', 'Beautiful but poisonous. Mushrooms are only the fruit of a huge underground network of threads called mycelium.'],
  ['chanterelle', 'Chanterelles', 'Cantharellus cibarius', 'forest', 'Chanterelles partner with tree roots, trading minerals for sugars.'],
  ['porcini', 'Porcini (cep)', 'Boletus edulis', 'forest taiga', 'Boletes have sponge-like pores under the cap instead of gills.'],
  ['puffball', 'Puffballs', 'Lycoperdon perlatum', 'grassland forest garden', 'A ripe puffball releases a cloud of millions of spores when squeezed.'],
  ['morel', 'Morels', 'Morchella esculenta', 'forest', 'Morels often appear in spring after forest fires.'],
  ['ghost-mycena', 'Glowing mushrooms', 'Mycena chlorophos', 'rainforest forest', 'Some fungi glow in the dark (bioluminescence) — possibly to attract spore-spreading insects.'],
];
for (const [sp, name, sci, biomes, fact] of FUNGI) {
  add({ id: `fungi/${sp}`, name, emoji: sp === 'ghost-mycena' ? '✨' : '🍄', category: 'fungi', group: 'Mushrooms', family: 'builtin', path: 'builtin:mushrooms', params: { species: sp }, hidden: ['species'], loco: 'sessile', biomes: biomes.split(' '), scale: 3.2, info: { scientific: sci, kingdom: 'Fungi', phylum: 'Basidiomycota', class: 'Agaricomycetes', diet: 'decomposer', fact, eats: ['detritus'], tags: ['fungi'] } });
}
add({ id: 'feature/log', name: 'Fallen log', emoji: '🪵', category: 'fungi', group: 'Decomposers & habitat', family: 'builtin', path: 'builtin:log', params: {}, loco: 'sessile', biomes: ['forest', 'taiga', 'rainforest', 'garden', 'wetland'], info: { kingdom: 'Fungi', diet: 'decomposer', fact: 'A rotting log is a nursery: fungi, beetles, worms and salamanders break it down into new soil.', blurb: 'Dead wood recycled by bracket fungi and moss.', eats: ['detritus'], tags: ['fungi'] } });
add({ id: 'feature/termite-mound', name: 'Termite mound', emoji: '🏔️', category: 'animals', group: 'Insects & arthropods', family: 'builtin', path: 'builtin:termite-mound', params: {}, loco: 'sessile', biomes: ['savanna', 'grassland', 'desert'], info: { scientific: 'Macrotermes michaelseni', kingdom: 'Animalia', phylum: 'Arthropoda', class: 'Insecta', order: 'Blattodea', diet: 'decomposer', fact: 'Termite mounds have chimneys that keep the nest air-conditioned. Millions of termites live inside.', eats: ['detritus', 'grass'], tags: ['insect'] } });
add({ id: 'feature/nest', name: 'Bird nest', emoji: '🪺', category: 'animals', group: 'Birds', family: 'builtin', path: 'builtin:nest', params: {}, loco: 'sessile', biomes: ['forest', 'garden', 'taiga', 'wetland', 'grassland', 'rainforest'], scale: 2, living: false, info: { blurb: 'A woven cup of twigs and grass holding eggs.', fact: 'Some birds line their nests with feathers, moss or even spider silk.', tags: ['egg'] } });

/* ---------------- land: rocks ---------------- */
for (const [shape, name] of [['boulder', 'Boulder'], ['bluff', 'Flat rock'], ['shard', 'Rock spire']] as const) {
  add({ id: `rock/${shape}`, name, emoji: '🪨', category: 'land', group: 'Rocks', family: 'rock', path: P.rock, params: { shape, mergeForProduction: true }, hidden: ['mergeForProduction', 'shape'], loco: 'sessile', biomes: ['forest', 'taiga', 'grassland', 'savanna', 'desert', 'tundra', 'mountain', 'shore', 'garden'], living: false, info: { blurb: 'Rocks are abiotic (non-living) parts of a habitat — shelter, basking spots and slowly weathering into soil.' } });
}
add({ id: 'rock/cluster', name: 'Boulder cluster', emoji: '🪨', category: 'land', group: 'Rocks', family: 'water', path: P.water('boulder-cluster'), params: { base: false, count: 6, spread: 3, mergeForProduction: true }, hidden: ['base', 'mergeForProduction'], loco: 'sessile', biomes: ['forest', 'taiga', 'mountain', 'tundra', 'grassland', 'wetland', 'shore'], living: false, info: { blurb: 'Lichen and moss slowly break rock down into the first soil.' } });
add({ id: 'rock/columns', name: 'Basalt columns', emoji: '🪨', category: 'land', group: 'Rocks', family: 'water', path: P.water('boulder-cluster'), params: { base: false, style: 'columns', count: 7, spread: 2.5, mergeForProduction: true }, hidden: ['base', 'mergeForProduction'], loco: 'sessile', biomes: ['mountain', 'shore', 'tundra'], living: false, info: { blurb: 'Hexagonal columns form when thick lava cools and cracks slowly.' } });

/* ---------------- water & geothermal features ---------------- */
add({ id: 'feature/geyser', name: 'Geyser', emoji: '♨️', category: 'water', group: 'Water features', family: 'water', path: P.water('geyser'), params: { diorama: false, mergeForProduction: true }, hidden: ['diorama', 'mergeForProduction'], loco: 'scenery', biomes: ['mountain', 'tundra', 'grassland'], living: false, heavy: true, info: { blurb: 'Groundwater heated by magma erupts as a column of water and steam.', fact: 'Old Faithful in Yellowstone erupts about every 90 minutes.' } });
add({ id: 'feature/hot-spring', name: 'Hot spring terraces', emoji: '♨️', category: 'water', group: 'Water features', family: 'water', path: P.water('hot-spring-terraces'), params: { diorama: false, mergeForProduction: true }, hidden: ['diorama', 'mergeForProduction'], loco: 'scenery', biomes: ['mountain'], living: false, heavy: true, info: { blurb: 'Mineral-rich hot water builds stepped travertine pools; colourful microbes live in the warm water.', fact: 'Heat-loving microbes (thermophiles) paint hot springs orange, yellow and green.' } });
add({ id: 'feature/iceberg', name: 'Iceberg', emoji: '🧊', category: 'water', group: 'Water features', family: 'water', path: P.water('iceberg'), stripWater: true, params: { diorama: false, length: 12, freeboard: 3, floes: 0, calving: false, mergeForProduction: true }, hidden: ['diorama', 'mergeForProduction'], loco: 'scenery', biomes: ['tundra'], water: 'surface', living: false, info: { blurb: 'A chunk of freshwater glacier ice floating in the sea.', fact: 'About 90% of an iceberg is hidden under the water.' } });

/* ---------------- sky & weather ---------------- */
add({ id: 'sky/rain-cloud', name: 'Rain cloud', emoji: '🌧️', category: 'sky', group: 'Weather', family: 'water', path: P.water('rain-cloud'), params: { size: 16, altitude: 11, thickness: 6, intensity: 0.6, mergeForProduction: true }, hidden: ['mergeForProduction'], loco: 'scenery', biomes: [], living: false, info: { blurb: 'Water evaporates, condenses into cloud droplets and falls as rain — the water cycle.', fact: 'A single cumulus cloud can hold as much water as 100 elephants weigh.' } });
add({ id: 'sky/rainbow', name: 'Rainbow', emoji: '🌈', category: 'sky', group: 'Weather', family: 'water', path: P.water('rainbow'), params: { radius: 14, mergeForProduction: true }, hidden: ['mergeForProduction'], loco: 'scenery', biomes: [], living: false, info: { blurb: 'Sunlight split into colours by raindrops.', fact: 'You only see a rainbow with the sun behind you and rain in front of you.' } });
add({ id: 'sky/fog-bank', name: 'Fog bank', emoji: '🌫️', category: 'sky', group: 'Weather', family: 'water', path: P.water('fog-bank'), params: { width: 30, depth: 20, height: 2.5, mergeForProduction: true }, hidden: ['mergeForProduction'], loco: 'scenery', biomes: [], living: false, info: { blurb: 'A cloud that touches the ground.', fact: 'Coast redwoods drink fog — up to a third of their water comes from it.' } });

/* ---------------- human features ---------------- */
const HUM = (id: string, name: string, emoji: string, params: Record<string, unknown>, blurb: string, water?: 'surface') =>
  add({ id: `human/${id}`, name, emoji, category: 'human', group: 'People & structures', family: 'water', path: P.water(id), params: { mergeForProduction: true, ...params }, hidden: ['mergeForProduction', 'diorama', 'waterPatch'], loco: 'scenery', biomes: [], living: false, water, info: { blurb } });
HUM('water-well', 'Village well', '🪣', {}, 'People have dug wells to reach groundwater for thousands of years.');
HUM('hand-pump-trough', 'Hand pump', '🚰', {}, 'A hand pump lifts groundwater using a piston and valves.');
HUM('rowboat', 'Rowboat', '🚣', { waterPatch: false }, 'Boats let people fish and travel on water.', 'surface');
HUM('kayak', 'Sea kayak', '🛶', { waterPatch: false }, 'Kayaks were invented by Arctic peoples for hunting.', 'surface');
HUM('wooden-pier', 'Wooden pier', '🌉', {}, 'Piers and docks change shorelines — and their pilings become homes for mussels and barnacles.');
HUM('lighthouse', 'Lighthouse', '🗼', {}, 'Lighthouses warn ships away from dangerous coasts.');
HUM('water-mill', 'Water mill', '⚙️', {}, 'Flowing water turns the wheel to grind grain — renewable energy from long ago.');

/* ---------------- beach finds ---------------- */
const FIND = (id: string, name: string, emoji: string, module: string, params: Record<string, unknown>, blurb: string, info: SpeciesInfo = {}) =>
  add({ id: `find/${id}`, name, emoji, category: 'finds', group: 'Beach finds', family: 'beach', path: P.beach(module), params: { mergeForProduction: true, ...params }, hidden: ['mergeForProduction'], loco: 'sessile', biomes: ['shore'], scale: 5, living: false, info: { blurb, ...info } });
FIND('conch', 'Queen conch shell', '🐚', 'gastropod-spiral', {}, 'The empty shell of a large sea snail.', { scientific: 'Aliger gigas', phylum: 'Mollusca', class: 'Gastropoda' });
FIND('scallop', 'Scallop shell', '🐚', 'bivalve-scallop-cockle', {}, 'Scallops swim by clapping their two shells together.', { phylum: 'Mollusca', class: 'Bivalvia' });
FIND('mussels', 'Mussels & oysters', '🦪', 'bivalve-oyster-mussel', {}, 'Oysters filter up to 200 litres of water a day.', { phylum: 'Mollusca', class: 'Bivalvia' });
FIND('cowrie', 'Cowrie shell', '🐚', 'gastropod-cowrie', {}, 'Cowrie shells were once used as money.', { phylum: 'Mollusca', class: 'Gastropoda' });
FIND('sand-dollar', 'Sand dollar', '⚪', 'echinoderm-urchin-test', {}, 'The skeleton (test) of a flat sea urchin.', { phylum: 'Echinodermata', class: 'Echinoidea' });
FIND('dried-starfish', 'Dried sea star', '⭐', 'echinoderm-starfish', {}, 'Sea stars can regrow lost arms.', { phylum: 'Echinodermata', class: 'Asteroidea' });
FIND('crab-molt', 'Crab molt', '🦀', 'crustacean-carapace', {}, 'Crabs shed their whole exoskeleton to grow — the empty shell washes up.', { phylum: 'Arthropoda', class: 'Malacostraca' });
FIND('shark-tooth', 'Shark tooth', '🦷', 'elasmobranch-artifacts', { artifactType: 'tooth' }, 'Sharks lose and regrow thousands of teeth in a lifetime.', { phylum: 'Chordata', class: 'Chondrichthyes' });
FIND('mermaids-purse', 'Mermaid’s purse', '👛', 'elasmobranch-artifacts', { artifactType: 'purse' }, 'The empty egg case of a skate or shark.', { phylum: 'Chordata', class: 'Chondrichthyes' });
FIND('cuttlebone', 'Cuttlebone', '🦴', 'cephalopod-remnants', { remnantType: 'cuttlebone' }, 'A cuttlefish uses this gas-filled shell to float.', { phylum: 'Mollusca', class: 'Cephalopoda' });
FIND('driftwood', 'Driftwood & net', '🪵', 'nautical-debris', {}, 'Driftwood is a natural find — but lost nets and floats are marine litter that can trap animals.');
FIND('sea-glass', 'Sea glass', '💎', 'beach-glass-and-pottery', { materialType: 'glass' }, 'Broken glass tumbled smooth by waves over many years.');

/* ---------------- habitat bases (whole diorama tiles) ---------------- */
const BASE = (id: string, name: string, emoji: string, params: Record<string, unknown>, biomes: string[], blurb: string) =>
  add({ id: `habitat/${id}`, name, emoji, category: 'habitats', group: 'Habitat tiles', family: 'water', path: P.water(id), params: { mergeForProduction: true, diorama: true, ...params }, hidden: ['mergeForProduction', 'diorama', 'seaWater', 'chainEnds'], loco: 'scenery', biomes, base: true, living: false, info: { blurb } });
BASE('coral-reef', 'Coral reef', '🪸', { size: 28, depth: 7, fish: 50 }, ['reef'], 'A sunlit reef of brain, staghorn and table corals with fish and caustic light.');
BASE('kelp-forest', 'Kelp forest', '🌿', { size: 28, depth: 12 }, ['kelp'], 'Giant kelp rising from a rocky reef to a floating canopy, with sea otters.');
BASE('tide-pool', 'Tide pools', '🦀', { width: 30, depth: 22 }, ['shore'], 'A rocky shelf where waves wash over pools full of sea stars, anemones and crabs.');
BASE('beach-shore', 'Beach & surf', '🏖️', { width: 40, depth: 44 }, ['shore'], 'A sandy beach with waves rolling up the shore.');
BASE('marsh-wetland', 'Marsh', '🦩', { size: 36 }, ['wetland'], 'Reeds, open water, mud and a heron on the hunt.');
BASE('mangrove-swamp', 'Mangrove swamp', '🌳', { size: 32 }, ['wetland', 'rainforest'], 'Salt-tolerant trees on stilt roots shelter young fish.');
BASE('frozen-lake', 'Frozen lake', '🧊', { size: 40 }, ['tundra', 'taiga'], 'A lake sealed under ice, with snowdrifts and a fishing hole.');
BASE('lake-pond', 'Lake & pond', '🏞️', { size: 40, jetty: false }, ['wetland', 'forest'], 'A freshwater lake with lilies, reeds and leaping fish.');
BASE('cave-pool', 'Cave & drip pool', '🕳️', {}, ['mountain'], 'A limestone cave with stalactites, crystals and glow-worms.');
BASE('groundwater-cutaway', 'Groundwater cut-away', '💧', {}, [], 'A cross-section showing how rain soaks into aquifers underground.');

/* ---------------- diets: corrections, and body size for who can catch whom ---------------- */
for (const d of defs) {
  if (d.category !== 'animals') continue;
  const fix = DIET_FIX[d.id];
  if (fix) {
    d.info = { ...d.info, ...(fix.diet ? { diet: fix.diet } : {}), ...(fix.tags ? { tags: fix.tags } : {}) };
    if (fix.eats) d.info.eats = fix.eats;
    if (fix.addEats) d.info.eats = [...new Set([...(d.info.eats ?? []), ...fix.addEats])];
  }
  d.mass = MASS[d.id] ?? massFromLength(d);
}

export const CATALOG: AssetDef[] = defs;
export const CATALOG_BY_ID: Record<string, AssetDef> = Object.fromEntries(defs.map((d) => [d.id, d]));
export function getDef(id: string): AssetDef | undefined { return CATALOG_BY_ID[id]; }

export const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  animals: { label: 'Animals', emoji: '🦊' },
  plants: { label: 'Plants', emoji: '🌿' },
  fungi: { label: 'Fungi', emoji: '🍄' },
  land: { label: 'Rocks', emoji: '🪨' },
  water: { label: 'Water', emoji: '💧' },
  sky: { label: 'Sky', emoji: '🌦️' },
  finds: { label: 'Beach finds', emoji: '🐚' },
  human: { label: 'People', emoji: '🏠' },
  habitats: { label: 'Habitat tiles', emoji: '🗺️' },
};
