import type { Locomotion, SpeciesInfo } from './types';

/**
 * Wildform species included in the library (rigged mammals/birds/reptiles cover the
 * rest). id → [emoji, class, diet, biomes, loco, eats, tags, group override?]
 */
type Aug = [string, string, SpeciesInfo['diet'], string, Locomotion, string, string, string?];
export const WILDFORM_AUG: Record<string, Aug> = {
  // mammals
  'arctic-fox': ['🦊', 'Mammalia', 'omnivore', 'tundra', 'walk', 'small-mammal bird egg fish', 'predator'],
  'fennec-fox': ['🦊', 'Mammalia', 'omnivore', 'desert', 'walk', 'insect small-mammal fruit reptile', 'predator'],
  coyote: ['🐺', 'Mammalia', 'omnivore', 'grassland desert', 'walk', 'small-mammal fruit insect reptile', 'predator'],
  'golden-jackal': ['🐺', 'Mammalia', 'omnivore', 'savanna grassland', 'walk', 'small-mammal fruit carrion', 'predator'],
  'snow-leopard': ['🐆', 'Mammalia', 'carnivore', 'mountain', 'walk', 'large-herbivore small-mammal', 'apex'],
  pronghorn: ['🦌', 'Mammalia', 'herbivore', 'grassland', 'walk', 'grass leaves', 'large-herbivore'],
  'bactrian-camel': ['🐫', 'Mammalia', 'herbivore', 'desert', 'walk', 'grass leaves', 'large-herbivore'],
  'harp-seal': ['🦭', 'Mammalia', 'piscivore', 'tundra shore', 'swim', 'fish shellfish', 'seal'],
  'bottlenose-dolphin': ['🐬', 'Mammalia', 'piscivore', 'reef shore', 'swim', 'fish squid', 'predator'],
  'humpback-whale': ['🐋', 'Mammalia', 'filter feeder', 'tundra shore kelp', 'swim', 'plankton fish', 'whale'],
  'eastern-gray-squirrel': ['🐿️', 'Mammalia', 'herbivore', 'forest garden', 'walk', 'seeds fruit', 'small-mammal'],
  'eastern-chipmunk': ['🐿️', 'Mammalia', 'omnivore', 'forest garden', 'walk', 'seeds insect fruit', 'small-mammal'],
  'eastern-cottontail': ['🐰', 'Mammalia', 'herbivore', 'garden grassland forest', 'hop', 'grass leaves', 'small-mammal'],
  'virginia-opossum': ['🐀', 'Mammalia', 'omnivore', 'forest garden', 'walk', 'insect fruit carrion egg worm', 'small-mammal'],
  // birds
  'barn-owl': ['🦉', 'Aves', 'carnivore', 'grassland garden forest', 'fly', 'small-mammal', 'predator'],
  'blue-jay': ['🐦', 'Aves', 'omnivore', 'forest garden', 'fly', 'seeds insect egg', 'small-bird'],
  'downy-woodpecker': ['🐦', 'Aves', 'insectivore', 'forest garden', 'fly', 'insect seeds', 'small-bird'],
  'american-robin': ['🐦', 'Aves', 'omnivore', 'garden forest', 'fly', 'worm insect fruit', 'small-bird'],
  'mourning-dove': ['🕊️', 'Aves', 'herbivore', 'garden grassland desert', 'fly', 'seeds', 'bird'],
  // reptiles & amphibians
  'sand-lizard': ['🦎', 'Reptilia', 'insectivore', 'grassland', 'walk', 'insect spider', 'reptile'],
  'american-alligator': ['🐊', 'Reptilia', 'carnivore', 'wetland', 'swim', 'fish bird small-mammal amphibian reptile', 'apex'],
  'green-anole': ['🦎', 'Reptilia', 'insectivore', 'garden forest', 'walk', 'insect spider', 'reptile'],
  'eastern-box-turtle': ['🐢', 'Reptilia', 'omnivore', 'forest garden', 'crawl', 'worm insect fruit fungi', 'reptile'],
  'common-garter-snake': ['🐍', 'Reptilia', 'carnivore', 'garden grassland wetland forest', 'slither', 'amphibian worm fish', 'reptile'],
  'common-toad': ['🐸', 'Amphibia', 'insectivore', 'garden forest', 'hop', 'insect worm snail', 'amphibian'],
  'glass-frog': ['🐸', 'Amphibia', 'insectivore', 'rainforest', 'hop', 'insect', 'amphibian'],
  'alpine-newt': ['🦎', 'Amphibia', 'carnivore', 'mountain wetland', 'swim', 'insect worm', 'amphibian'],
  // fish
  clownfish: ['🐠', 'Actinopterygii', 'omnivore', 'reef', 'swim', 'plankton algae', 'fish'],
  'great-white-shark': ['🦈', 'Chondrichthyes', 'carnivore', 'reef kelp shore', 'swim', 'seal fish', 'apex'],
  'manta-ray': ['🐟', 'Chondrichthyes', 'filter feeder', 'reef', 'swim', 'plankton', 'fish'],
  'yellow-tang': ['🐠', 'Actinopterygii', 'herbivore', 'reef', 'swim', 'algae', 'fish'],
  seahorse: ['🐴', 'Actinopterygii', 'carnivore', 'reef kelp', 'swim', 'plankton', 'fish'],
  lionfish: ['🐟', 'Actinopterygii', 'carnivore', 'reef', 'swim', 'fish shellfish', 'predator'],
  // arthropods
  'monarch-butterfly': ['🦋', 'Insecta', 'nectarivore', 'grassland garden forest', 'fly', 'nectar', 'insect'],
  'blue-morpho': ['🦋', 'Insecta', 'frugivore', 'rainforest', 'fly', 'fruit', 'insect'],
  'stag-beetle': ['🪲', 'Insecta', 'detritivore', 'forest', 'crawl', 'detritus fruit', 'insect'],
  'seven-spot-ladybird': ['🐞', 'Insecta', 'insectivore', 'garden grassland forest', 'fly', 'insect', 'insect'],
  'jumping-spider': ['🕷️', 'Arachnida', 'carnivore', 'garden forest', 'crawl', 'insect', 'spider'],
  'blue-crab': ['🦀', 'Malacostraca', 'omnivore', 'shore wetland', 'crawl', 'shellfish fish algae carrion', 'shellfish'],
  'emperor-scorpion': ['🦂', 'Arachnida', 'carnivore', 'rainforest desert', 'crawl', 'insect spider', 'spider'],
  'giant-centipede': ['🐛', 'Chilopoda', 'carnivore', 'rainforest forest', 'crawl', 'insect spider small-mammal', 'insect'],
  honeybee: ['🐝', 'Insecta', 'nectarivore', 'garden grassland forest', 'fly', 'nectar', 'insect'],
  dragonfly: ['🪰', 'Insecta', 'insectivore', 'wetland', 'fly', 'insect', 'insect'],
  'praying-mantis': ['🦗', 'Insecta', 'carnivore', 'garden grassland rainforest', 'crawl', 'insect', 'insect'],
  'atlas-moth': ['🦋', 'Insecta', 'none', 'rainforest', 'fly', '', 'insect'],
  tarantula: ['🕷️', 'Arachnida', 'carnivore', 'desert rainforest', 'crawl', 'insect small-mammal amphibian', 'spider'],
  'horseshoe-crab': ['🦀', 'Merostomata', 'carnivore', 'shore', 'crawl', 'worm shellfish', 'shellfish'],
  'american-lobster': ['🦞', 'Malacostraca', 'omnivore', 'shore kelp', 'crawl', 'shellfish fish worm', 'shellfish'],
  bumblebee: ['🐝', 'Insecta', 'nectarivore', 'garden grassland tundra', 'fly', 'nectar', 'insect'],
  firefly: ['✨', 'Insecta', 'carnivore', 'forest garden wetland', 'fly', 'snail worm', 'insect'],
  'field-cricket': ['🦗', 'Insecta', 'omnivore', 'grassland garden', 'hop', 'leaves seeds insect', 'insect'],
  'garden-orbweaver': ['🕷️', 'Arachnida', 'carnivore', 'garden forest', 'crawl', 'insect', 'spider'],
  'pill-bug': ['🐛', 'Malacostraca', 'detritivore', 'garden forest', 'crawl', 'detritus', 'insect'],
  // molluscs
  'giant-pacific-octopus': ['🐙', 'Cephalopoda', 'carnivore', 'kelp shore', 'swim', 'shellfish fish', 'squid'],
  'garden-snail': ['🐌', 'Gastropoda', 'herbivore', 'garden forest', 'crawl', 'leaves fungi', 'snail'],
  'blue-dragon': ['🐉', 'Gastropoda', 'carnivore', 'reef', 'swim', 'jellyfish', 'snail'],
  nautilus: ['🐚', 'Cephalopoda', 'carnivore', 'reef', 'swim', 'shellfish carrion', 'squid'],
  cuttlefish: ['🦑', 'Cephalopoda', 'carnivore', 'reef kelp', 'swim', 'shellfish fish', 'squid'],
  'giant-clam': ['🦪', 'Bivalvia', 'filter feeder', 'reef', 'sessile', 'plankton', 'shellfish'],
  'sea-hare': ['🐌', 'Gastropoda', 'herbivore', 'kelp shore', 'crawl', 'algae', 'snail'],
  // cnidarians, echinoderms, sponges, comb jellies
  'moon-jellyfish': ['🪼', 'Scyphozoa', 'carnivore', 'reef kelp shore', 'swim', 'plankton', 'jellyfish'],
  'rose-anemone': ['🌺', 'Anthozoa', 'carnivore', 'shore reef', 'sessile', 'plankton fish', 'coral'],
  'staghorn-coral': ['🪸', 'Anthozoa', 'filter feeder', 'reef', 'sessile', 'plankton', 'coral'],
  'portuguese-man-o-war': ['🪼', 'Hydrozoa', 'carnivore', 'reef shore', 'swim', 'fish plankton', 'jellyfish'],
  'ochre-sea-star': ['⭐', 'Asteroidea', 'carnivore', 'shore kelp', 'crawl', 'shellfish', 'urchin'],
  'purple-sea-urchin': ['🟣', 'Echinoidea', 'herbivore', 'kelp shore', 'crawl', 'algae', 'urchin'],
  'crown-of-thorns-starfish': ['⭐', 'Asteroidea', 'carnivore', 'reef', 'crawl', 'coral', 'urchin'],
  'sea-cucumber': ['🥒', 'Holothuroidea', 'detritivore', 'reef kelp', 'crawl', 'detritus', 'urchin'],
  'barrel-sponge': ['🧽', 'Demospongiae', 'filter feeder', 'reef', 'sessile', 'plankton', 'sponge'],
  'venus-flower-basket': ['🧺', 'Hexactinellida', 'filter feeder', 'reef', 'sessile', 'plankton', 'sponge'],
  'glass-sponge': ['🧽', 'Hexactinellida', 'filter feeder', 'kelp', 'sessile', 'plankton', 'sponge'],
  'sea-walnut': ['🫧', 'Tentaculata', 'carnivore', 'shore kelp', 'swim', 'plankton', 'jellyfish'],
  // worms & relatives
  earthworm: ['🪱', 'Clitellata', 'detritivore', 'garden forest grassland', 'crawl', 'detritus', 'worm'],
  'peacock-worm': ['🪱', 'Polychaeta', 'filter feeder', 'shore reef', 'sessile', 'plankton', 'worm'],
  leech: ['🪱', 'Clitellata', 'parasite', 'wetland', 'swim', 'fish amphibian', 'worm'],
  'velvet-worm': ['🐛', 'Udeonychophora', 'carnivore', 'rainforest', 'crawl', 'insect', 'worm'],
  planarian: ['🪱', 'Rhabditophora', 'carnivore', 'wetland', 'crawl', 'worm insect', 'worm'],
  'ribbon-worm': ['🪱', 'Pilidiophora', 'carnivore', 'shore', 'crawl', 'worm shellfish', 'worm'],
  'acorn-worm': ['🪱', 'Enteropneusta', 'detritivore', 'shore', 'crawl', 'detritus', 'worm'],
  'peanut-worm': ['🥜', 'Sipunculidea', 'detritivore', 'reef shore', 'crawl', 'detritus', 'worm'],
  'horsehair-worm': ['🧵', 'Gordioida', 'parasite', 'wetland', 'swim', 'insect', 'worm'],
  'priapulid-worm': ['🪱', 'Priapulimorpha', 'carnivore', 'shore', 'crawl', 'worm', 'worm'],
  'lamp-shell': ['🐚', 'Rhynchonellata', 'filter feeder', 'shore', 'sessile', 'plankton', 'shellfish'],
  'moss-animal': ['🌿', 'Gymnolaemata', 'filter feeder', 'kelp reef', 'sessile', 'plankton', 'coral'],
  'horseshoe-worm': ['🪱', 'Phoronida', 'filter feeder', 'shore', 'sessile', 'plankton', 'worm'],
  'arrow-worm': ['🏹', 'Sagittoidea', 'carnivore', 'reef kelp', 'swim', 'plankton', 'plankton'],
  xenoturbella: ['🪱', 'Xenoturbellida', 'carnivore', 'shore', 'crawl', 'shellfish', 'worm'],
  tapeworm: ['🎗️', 'Cestoda', 'parasite', 'grassland', 'crawl', 'large-herbivore', 'worm'],
  // microscopic life
  'water-bear': ['🐻', 'Eutardigrada', 'herbivore', 'garden forest wetland tundra', 'crawl', 'algae', 'micro', 'Microscopic'],
  roundworm: ['🪱', 'Chromadorea', 'detritivore', 'garden forest grassland', 'crawl', 'detritus', 'micro', 'Microscopic'],
  'wheel-animal': ['🎡', 'Eurotatoria', 'filter feeder', 'wetland', 'swim', 'algae', 'micro', 'Microscopic'],
  hairyback: ['🦠', 'Gastrotricha', 'detritivore', 'wetland', 'crawl', 'detritus', 'micro', 'Microscopic'],
  'mud-dragon': ['🐉', 'Kinorhyncha', 'detritivore', 'shore', 'crawl', 'detritus', 'micro', 'Microscopic'],
  'brush-head': ['🖌️', 'Loricifera', 'detritivore', 'shore', 'crawl', 'detritus', 'micro', 'Microscopic'],
  'jaw-worm': ['🦠', 'Gnathostomulida', 'detritivore', 'shore', 'crawl', 'detritus', 'micro', 'Microscopic'],
  'little-jaw-animal': ['🦠', 'Micrognathozoa', 'detritivore', 'tundra', 'crawl', 'detritus', 'micro', 'Microscopic'],
  symbion: ['🦠', 'Eucycliophora', 'filter feeder', 'shore', 'sessile', 'plankton', 'micro', 'Microscopic'],
  dicyemid: ['🦠', 'Rhombozoa', 'parasite', 'reef', 'swim', '', 'micro', 'Microscopic'],
  orthonectid: ['🦠', 'Orthonectida', 'parasite', 'shore', 'swim', '', 'micro', 'Microscopic'],
  'plate-animal': ['🦠', 'Placozoa', 'herbivore', 'reef', 'crawl', 'algae', 'micro', 'Microscopic'],
  'goblet-worm': ['🍷', 'Entoprocta', 'filter feeder', 'shore', 'sessile', 'plankton', 'micro', 'Microscopic'],
  'thorny-headed-worm': ['🦠', 'Palaeacanthocephala', 'parasite', 'wetland', 'swim', '', 'micro', 'Microscopic'],
};

/** Which Wildform species are marine/aquatic invertebrates vs land — used for library grouping. */
export function wildformGroup(category: string, phylum: string, override?: string) {
  if (override) return override;
  if (category === 'Mammals' || category === 'Birds' || category === 'Reptiles' || category === 'Amphibians' || category === 'Fish') return category;
  if (phylum === 'Arthropoda') return 'Insects & arthropods';
  if (category === 'Marine') return 'Sea invertebrates';
  return 'Invertebrates';
}
