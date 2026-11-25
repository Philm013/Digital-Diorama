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

/** Real facts for species whose Wildform description talks about the 3D model rather than the animal. */
export const WILDFORM_FACTS: Record<string, string> = {
  'harp-seal': 'Harp seals give birth on drifting sea ice; pups are born with white fur and gain up to 2 kg a day on their mother’s fat-rich milk.',
  'bottlenose-dolphin': 'Each bottlenose dolphin has its own “signature whistle” — a sound that works like a name.',
  'humpback-whale': 'Male humpbacks sing long, changing songs that can travel for kilometres underwater; their flippers can be 5 m long.',
  'american-alligator': 'Alligators dig “gator holes” that hold water through droughts, giving fish, turtles and birds a place to survive.',
  'manta-ray': 'Mantas have the largest brain-to-body ratio of any fish, and may recognise themselves in a mirror.',
  'horseshoe-crab': 'Not a true crab: horseshoe crabs are closer to spiders and have barely changed in 450 million years. Their blue blood is used to test medicines.',
  nautilus: 'A nautilus floats by adjusting gas in the chambers of its shell, rising at night to feed and sinking by day.',
  'portuguese-man-o-war': 'It is not one animal but a colony of specialised zooids: a gas-filled float with a sail, plus feeding, stinging and breeding polyps.',
  'sea-cucumber': 'Sea cucumbers vacuum up sand, digest the food in it and leave cleaner sand behind — the reef’s recyclers.',
  tapeworm: 'A tapeworm has no mouth or gut: it absorbs digested food through its skin inside its host’s intestine.',
  'sea-hare': 'When disturbed, a sea hare squirts a cloud of purple ink; its two rolled “ears” are rhinophores that smell the water.',
  'snow-leopard': 'A snow leopard wraps its long, thick tail around its face like a scarf while it sleeps.',
  pronghorn: 'The fastest land animal in the Americas can run 90 km/h — fast enough to outrun predators that went extinct 10,000 years ago.',
  'bactrian-camel': 'Bactrian camels can drink 100 litres of water in 15 minutes and survive from −40 °C winters to 40 °C summers.',
};

/** IUCN Red List categories for the Wildform vertebrates (2025 assessments where they changed). */
export const WILDFORM_STATUS: Record<string, string> = {
  'arctic-fox': 'Least Concern', 'fennec-fox': 'Least Concern', coyote: 'Least Concern', 'golden-jackal': 'Least Concern', 'snow-leopard': 'Vulnerable',
  pronghorn: 'Least Concern', 'bactrian-camel': 'Domesticated', 'harp-seal': 'Near Threatened', 'bottlenose-dolphin': 'Least Concern', 'humpback-whale': 'Least Concern',
  'eastern-gray-squirrel': 'Least Concern', 'eastern-chipmunk': 'Least Concern', 'eastern-cottontail': 'Least Concern', 'virginia-opossum': 'Least Concern',
  'barn-owl': 'Least Concern', 'blue-jay': 'Least Concern', 'downy-woodpecker': 'Least Concern', 'american-robin': 'Least Concern', 'mourning-dove': 'Least Concern',
  'sand-lizard': 'Least Concern', 'american-alligator': 'Least Concern', 'green-anole': 'Least Concern', 'eastern-box-turtle': 'Vulnerable', 'common-garter-snake': 'Least Concern',
  'common-toad': 'Least Concern', 'glass-frog': 'Least Concern', 'alpine-newt': 'Least Concern', 'great-white-shark': 'Vulnerable', 'manta-ray': 'Endangered',
  'yellow-tang': 'Least Concern', seahorse: 'Vulnerable', lionfish: 'Least Concern', 'monarch-butterfly': 'Vulnerable', 'blue-crab': 'Least Concern', 'american-lobster': 'Least Concern',
};

/**
 * Size corrections for Wildform models: a factor on the built model so it matches the real adult. Its builders
 * read `length` as a body unit, and some plans come out much longer than the animal (the lizard plan adds a
 * tail about as long as `length` again, so the "3.4 m" alligator was built 8.3 m long). Measured in the animal
 * workbench; the comment gives the built size and the real one it now matches.
 */
export const WILDFORM_SIZE_FIX: Record<string, number> = {
  'american-alligator': 0.41, // 8.3 m → 3.4 m total
  'green-anole': 0.46, // 0.40 m → 18 cm total
  'sand-lizard': 0.76, // 0.26 m → 20 cm total
  'alpine-newt': 0.56, // 0.20 m → 11 cm
  'common-garter-snake': 0.52, // ~1.25 m along the body → 65 cm
  'manta-ray': 0.57, // 5.3 m across → 3 m disc
  'blue-dragon': 0.59, // 5.1 cm → 3 cm
  'stag-beetle': 0.68, // 9.5 cm → 6.5 cm with mandibles
  clownfish: 0.77, // 12.4 cm → 9.5 cm
  'yellow-tang': 1.68, // 10.7 cm → 18 cm
};
