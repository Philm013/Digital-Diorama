/**
 * Diet data for the food web: how big each animal is (so predators only take prey they can
 * really catch and swallow), how far above its own size a hunter can reach (pack hunters and
 * ambush predators take much bigger prey), and corrections to the species tables' diets.
 * Masses are typical adult masses in kg — rough, but the right order of magnitude is what matters.
 */
import type { AssetDef, Diet } from './types';

/** typical adult mass (kg) of vertebrates and other animals the length formula gets wrong */
export const MASS: Record<string, number> = {
  // mammals
  'mammal/horse': 500, 'mammal/zebra': 350, 'mammal/donkey': 250, 'mammal/cow': 600, 'mammal/deer': 70, 'mammal/wolf': 40,
  'mammal/cat': 4, 'mammal/lion': 190, 'mammal/tiger': 220, 'mammal/elephant': 5000, 'mammal/giraffe': 900, 'mammal/bear': 250,
  'mammal/pig': 100, 'mammal/rabbit': 1.8, 'mammal/dog': 25, 'mammal/fox': 6, 'mammal/hyena': 60, 'mammal/cheetah': 50,
  'mammal/leopard': 60, 'mammal/lynx': 20, 'mammal/polarBear': 450, 'mammal/panda': 100, 'mammal/raccoon': 7, 'mammal/badger': 12,
  'mammal/otter': 9, 'mammal/hedgehog': 0.8, 'mammal/squirrel': 0.4, 'mammal/beaver': 20, 'mammal/capybara': 50, 'mammal/sheep': 70,
  'mammal/bighorn': 90, 'mammal/goat': 80, 'mammal/bison': 700, 'mammal/gazelle': 25, 'mammal/moose': 450, 'mammal/reindeer': 120,
  'mammal/camel': 500, 'mammal/llama': 140, 'mammal/rhino': 2000, 'mammal/hippo': 1500, 'mammal/boar': 90, 'mammal/anteater': 30,
  'mammal/mouse': 0.02,
  'wild/arctic-fox': 4, 'wild/fennec-fox': 1.2, 'wild/coyote': 14, 'wild/golden-jackal': 10, 'wild/snow-leopard': 45, 'wild/pronghorn': 50,
  'wild/bactrian-camel': 600, 'wild/harp-seal': 130, 'wild/bottlenose-dolphin': 300, 'wild/humpback-whale': 30000,
  'wild/eastern-gray-squirrel': 0.5, 'wild/eastern-chipmunk': 0.1, 'wild/eastern-cottontail': 1.2, 'wild/virginia-opossum': 3,
  'water/whale': 30000,
  // birds
  'bird/sparrow': 0.03, 'bird/robin': 0.08, 'bird/crow': 0.45, 'bird/cardinal': 0.045, 'bird/pigeon': 0.35, 'bird/woodpecker': 0.07,
  'bird/kingfisher': 0.04, 'bird/macaw': 1.1, 'bird/owl': 1.5, 'bird/eagle': 5, 'bird/falcon': 0.9, 'bird/flamingo': 3, 'bird/heron': 2,
  'bird/crane': 5, 'bird/spoonbill': 1.5, 'bird/stilt': 0.17, 'bird/swan': 10, 'bird/duck': 1.1, 'bird/puffin': 0.45, 'bird/penguin': 30,
  'bird/ostrich': 110, 'bird/kiwi': 2.5, 'bird/turkey': 8, 'bird/rooster': 3, 'bird/peacock': 5, 'bird/hummingbird': 0.004,
  'bird/pelican': 7, 'bird/toucan': 0.6, 'bird/cockatoo': 0.8, 'bird/hornbill': 3, 'bird/albatross': 9, 'bird/seagull': 1,
  'wild/barn-owl': 0.5, 'wild/blue-jay': 0.09, 'wild/downy-woodpecker': 0.027, 'wild/american-robin': 0.08, 'wild/mourning-dove': 0.13,
  'water/duck-family': 1.1, 'water/seagull-flock': 1,
  // reptiles & amphibians
  'reptile/american-bullfrog': 0.5, 'reptile/axolotl': 0.1, 'reptile/caecilian': 0.1, 'reptile/cane-toad': 0.8,
  'reptile/chinese-giant-salamander': 25, 'reptile/fire-salamander': 0.04, 'reptile/frilled-lizard': 0.6, 'reptile/galapagos-tortoise': 250,
  'reptile/green-iguana': 5, 'reptile/green-sea-turtle': 150, 'reptile/king-cobra': 6, 'reptile/komodo-dragon': 80, 'reptile/leopard-gecko': 0.07,
  'reptile/nile-crocodile': 400, 'reptile/panther-chameleon': 0.15, 'reptile/poison-dart-frog': 0.003, 'reptile/red-eyed-tree-frog': 0.01,
  'reptile/reticulated-python': 75, 'reptile/sidewinder': 0.2, 'reptile/tuatara': 0.8,
  'wild/sand-lizard': 0.02, 'wild/american-alligator': 360, 'wild/common-toad': 0.08, 'wild/glass-frog': 0.003, 'wild/alpine-newt': 0.007,
  'wild/common-garter-snake': 0.15, 'wild/green-anole': 0.005, 'wild/eastern-box-turtle': 0.5,
  // fish
  'wild/clownfish': 0.03, 'wild/great-white-shark': 1100, 'wild/manta-ray': 1500, 'wild/yellow-tang': 0.15, 'wild/seahorse': 0.01,
  'wild/lionfish': 1, 'water/fish-school': 0.05, 'aqua/angelfish': 0.02, 'aqua/neon-school': 0.001,
  // invertebrates the length formula gets wrong
  'wild/giant-pacific-octopus': 30, 'wild/giant-clam': 200, 'wild/nautilus': 1.2, 'wild/cuttlefish': 4, 'wild/american-lobster': 2,
  'wild/blue-crab': 0.4, 'wild/horseshoe-crab': 2, 'aqua/cleaner-shrimp': 0.01, 'aqua/hermit-crab': 0.05, 'feature/termite-mound': 0.001,
  // insects and spiders (wingspans make the length formula far too heavy)
  'wild/blue-morpho': 0.0005, 'wild/monarch-butterfly': 0.0005, 'wild/atlas-moth': 0.025, 'wild/dragonfly': 0.001, 'wild/honeybee': 0.0001,
  'wild/bumblebee': 0.0003, 'wild/praying-mantis': 0.003, 'wild/stag-beetle': 0.006, 'wild/seven-spot-ladybird': 0.00004,
  'wild/field-cricket': 0.0008, 'wild/firefly': 0.00002, 'wild/jumping-spider': 0.00005, 'wild/garden-orbweaver': 0.0005,
  'wild/velvet-worm': 0.002, 'wild/garden-snail': 0.005, 'wild/earthworm': 0.005, 'wild/tarantula': 0.06, 'wild/emperor-scorpion': 0.03, 'wild/giant-centipede': 0.05, 'wild/pill-bug': 0.0001,
  'aqua/anemone': 0.3, 'wild/rose-anemone': 0.3, 'wild/portuguese-man-o-war': 1.5, 'wild/ochre-sea-star': 0.5,
};

/**
 * How much heavier than itself a hunter's prey can be. Most predators take prey up to about
 * their own size; pack hunters (wolves, lions, hyenas) and ambush predators (crocodiles, komodo
 * dragons, pythons) bring down far bigger animals. Invertebrate hunters subdue prey a few times
 * their weight with venom or webs.
 */
export const REACH: Record<string, number> = {
  'mammal/wolf': 15, 'mammal/lion': 6, 'mammal/hyena': 8, 'mammal/tiger': 4, 'mammal/leopard': 1.6, 'wild/snow-leopard': 2,
  'mammal/lynx': 1.5, 'mammal/cheetah': 1.1, 'wild/coyote': 1.5, 'reptile/nile-crocodile': 2, 'wild/american-alligator': 2,
  'reptile/komodo-dragon': 3, 'reptile/reticulated-python': 1.2, 'reptile/king-cobra': 1, 'bird/eagle': 1.5, 'bird/falcon': 1.4,
  'wild/great-white-shark': 1.5, 'mammal/polarBear': 1.5,
  'aqua/anemone': 0.5, 'wild/rose-anemone': 0.5,
  // firefly larvae inject venom into snails and worms many times their size
  'wild/firefly': 300,
  // velvet worms squirt sticky slime nets over insects bigger than themselves
  'wild/velvet-worm': 6,
};
export const DEFAULT_REACH = 1.2;
export const INVERTEBRATE_REACH = 4;

/**
 * Corrections and additions to diets: specialists that eat one particular species, larvae that
 * eat something different from the adults, scavenging habits, and parasites' hosts.
 */
export const DIET_FIX: Record<string, { eats?: string[]; addEats?: string[]; diet?: Diet; tags?: string[] }> = {
  // specialists
  'mammal/panda': { eats: ['tree/bamboo'] },
  'wild/monarch-butterfly': { eats: ['nectar', 'plant/milkweed'] }, // caterpillars eat only milkweed
  'wild/atlas-moth': { eats: ['leaves'], diet: 'herbivore' }, // the adults never eat; the caterpillars eat leaves
  'wild/humpback-whale': { eats: ['plankton', 'water/fish-school'] }, // krill and small schooling fish
  'water/whale': { eats: ['plankton', 'water/fish-school'] },
  'wild/water-bear': { eats: ['algae', 'plant/moss'] },
  // scavenging and opportunism
  'mammal/bear': { addEats: ['carrion'] }, 'mammal/wolf': { addEats: ['carrion'] }, 'mammal/lion': { addEats: ['carrion'] },
  'mammal/polarBear': { addEats: ['carrion'] }, 'wild/arctic-fox': { addEats: ['carrion'] }, 'wild/great-white-shark': { addEats: ['carrion'] },
  'mammal/hedgehog': { addEats: ['egg'] }, 'mammal/badger': { addEats: ['amphibian', 'egg'] }, 'mammal/raccoon': { addEats: ['shellfish'] },
  'mammal/mouse': { addEats: ['fruit'] }, 'reptile/american-bullfrog': { addEats: ['amphibian'] }, 'bird/heron': { addEats: ['reptile'] },
  'wild/blue-dragon': { eats: ['jellyfish', 'wild/portuguese-man-o-war'] }, // it even stores the man o' war's stings
  'wild/dragonfly': { addEats: ['plankton'] }, // the nymphs hunt water fleas under water
  'mammal/capybara': { addEats: ['fruit'] },
  'wild/field-cricket': { eats: ['leaves', 'seeds', 'aphids'] }, // plant food, and the odd small insect
  'wild/planarian': { addEats: ['micro'] }, // flatworms hunt rotifers and other tiny animals
  // anemones are relatives of corals, but not coral: crown-of-thorns sea stars don't eat them
  'aqua/anemone': { tags: ['anemone'] }, 'wild/rose-anemone': { tags: ['anemone'] },
  // clams and crabs are both "shellfish", but most shellfish-eaters prefer one of them
  'wild/horseshoe-crab': { eats: ['worm', 'clam'] },
  'wild/ochre-sea-star': { eats: ['clam', 'snail', 'urchin', 'sponge'] },
  'wild/seven-spot-ladybird': { eats: ['aphids'] },
  // parasites and their hosts
  'wild/dicyemid': { eats: ['wild/giant-pacific-octopus', 'wild/cuttlefish', 'wild/nautilus'] }, // lives in cephalopod kidneys
  'wild/orthonectid': { eats: ['worm', 'snail', 'shellfish'] },
  'wild/thorny-headed-worm': { eats: ['fish', 'bird', 'shellfish'] },
  'wild/leech': { eats: ['fish', 'amphibian', 'mammal'] },
};

/** mass from body length for animals not in the table (invertebrates): mass ≈ k·L³, k by body plan */
export function massFromLength(d: AssetDef): number | undefined {
  const L = d.realLength;
  if (!L) return undefined;
  const tags = d.info.tags ?? [];
  const k = tags.includes('worm') ? 0.3 : tags.includes('squid') ? 1 : tags.includes('jellyfish') ? 8 : 40;
  return k * L * L * L;
}

/**
 * Partners: pairs that live together and help each other (mutualism). The first never eats the
 * second, whatever their diets say, and the food web shows them as partners.
 */
export const PARTNERS: { a: string; b: string; how: string }[] = [
  { a: 'aqua/anemone', b: 'wild/clownfish', how: 'The clownfish hides in the anemone’s stinging tentacles, and keeps it clean and fed with scraps.' },
  { a: 'wild/rose-anemone', b: 'wild/clownfish', how: 'The clownfish hides in the anemone’s stinging tentacles, and keeps it clean and fed with scraps.' },
  { a: 'aqua/cleaner-shrimp', b: 'wild/yellow-tang', how: 'Cleaner shrimp pick parasites off fish — a free meal for the shrimp, a clean-up for the fish.' },
  { a: 'aqua/cleaner-shrimp', b: 'wild/lionfish', how: 'Cleaner shrimp pick parasites off fish — a free meal for the shrimp, a clean-up for the fish.' },
];
