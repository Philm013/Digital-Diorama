// Food-web accuracy cases (dev tool), run in the app by tools/foodweb-check.mjs.
// [eater, food, expected link kind or null]
export const CASES = [
  // size: hunters take prey they can catch
  ['mammal/lion', 'mammal/zebra', 'eats'], ['mammal/lion', 'mammal/giraffe', 'eats'], ['mammal/lion', 'mammal/elephant', 'scavenges'],
  ['mammal/cheetah', 'mammal/gazelle', 'eats'], ['mammal/cheetah', 'mammal/giraffe', null], ['mammal/cheetah', 'mammal/rhino', null],
  ['mammal/wolf', 'mammal/moose', 'eats'], ['mammal/wolf', 'mammal/rabbit', 'eats'], ['mammal/lynx', 'mammal/rabbit', 'eats'], ['mammal/lynx', 'mammal/moose', null],
  ['mammal/leopard', 'mammal/gazelle', 'eats'], ['mammal/leopard', 'mammal/zebra', null],
  ['reptile/nile-crocodile', 'mammal/zebra', 'eats'], ['reptile/nile-crocodile', 'mammal/hippo', null], ['reptile/nile-crocodile', 'bird/sparrow', null],
  ['bird/eagle', 'mammal/rabbit', 'eats'], ['bird/eagle', 'bird/ostrich', 'scavenges'], ['bird/falcon', 'bird/ostrich', null], ['bird/eagle', 'bird/hummingbird', null], ['bird/eagle', 'bird/duck', 'eats'],
  ['bird/owl', 'mammal/mouse', 'eats'], ['bird/owl', 'mammal/deer', null], ['mammal/cat', 'bird/sparrow', 'eats'], ['mammal/cat', 'bird/eagle', null],
  ['reptile/reticulated-python', 'mammal/gazelle', 'eats'], ['reptile/reticulated-python', 'mammal/elephant', null],
  ['wild/tarantula', 'mammal/mouse', 'eats'], ['wild/tarantula', 'mammal/rabbit', null],
  // apex predators are nobody's prey
  ['mammal/wolf', 'mammal/lion', 'scavenges'], ['mammal/cheetah', 'mammal/lion', null], ['mammal/hyena', 'mammal/lion', 'scavenges'], ['bird/falcon', 'bird/eagle', null],
  // class tags fill gaps
  ['wild/great-white-shark', 'wild/lionfish', 'eats'], ['wild/great-white-shark', 'wild/harp-seal', 'eats'], ['mammal/polarBear', 'wild/harp-seal', 'eats'],
  ['mammal/tiger', 'mammal/boar', 'eats'], ['mammal/fox', 'wild/eastern-cottontail', 'eats'], ['bird/heron', 'reptile/american-bullfrog', 'eats'],
  // specialists
  ['mammal/panda', 'tree/bamboo', 'eats'], ['mammal/panda', 'tree/oak', null], ['wild/monarch-butterfly', 'plant/milkweed', 'eats'],
  ['wild/crown-of-thorns-starfish', 'wild/staghorn-coral', 'eats'], ['wild/blue-dragon', 'wild/portuguese-man-o-war', 'eats'],
  ['wild/humpback-whale', 'water/fish-school', 'eats'], ['wild/humpback-whale', 'wild/great-white-shark', null],
  // plants
  ['mammal/giraffe', 'tree/acacia', 'eats'], ['mammal/rabbit', 'plant/clover', 'eats'], ['wild/honeybee', 'plant/lavender-shrub', 'eats'],
  ['plant/venus-flytrap', 'wild/dragonfly', 'eats'], ['wild/purple-sea-urchin', 'plant/kelp', 'eats'],
  // eggs, carrion, parasites
  ['mammal/raccoon', 'bird/duck', 'eggs'], ['mammal/raccoon', 'wild/american-alligator', 'eggs'], ['bird/crow', 'bird/eagle', 'scavenges'],
  ['wild/dicyemid', 'wild/giant-pacific-octopus', 'parasite'], ['wild/tapeworm', 'mammal/bison', 'parasite'], ['wild/leech', 'mammal/lion', 'parasite'],
  // herbivores don't eat animals
  ['mammal/zebra', 'mammal/rabbit', null],
  ['mammal/fox', 'mammal/raccoon', null], ['mammal/fox', 'mammal/beaver', null], ['wild/crown-of-thorns-starfish', 'aqua/anemone', null],
  ['aqua/anemone', 'wild/lionfish', null], ['aqua/anemone', 'wild/clownfish', null], ['wild/rose-anemone', 'wild/seahorse', 'eats'], ['wild/horseshoe-crab', 'wild/giant-clam', 'eats'], ['wild/ochre-sea-star', 'wild/purple-sea-urchin', 'eats'], ['wild/blue-crab', 'wild/horseshoe-crab', null],
  ['wild/firefly', 'wild/garden-snail', 'eats'], ['bird/kingfisher', 'water/fish-school', null], ['bird/puffin', 'water/fish-school', 'eats'], ['mammal/elephant', 'tree/acacia', 'eats'],
];
