import type { SpeciesInfo } from './types';

type Row = [string, string, string, string, string, SpeciesInfo['diet'], string, string, string, string, string];
const R: Row[] = [
  ['sparrow', 'House sparrow', '🐦', 'Passeriformes', 'Passeridae', 'omnivore', 'Least Concern', 'garden grassland', 'House sparrows take dust baths to keep their feathers clean.', 'seeds insect', 'small-bird'],
  ['robin', 'European robin', '🐦', 'Passeriformes', 'Muscicapidae', 'insectivore', 'Least Concern', 'garden forest', 'Robins sometimes sing at night near bright street lights.', 'worm insect fruit', 'small-bird'],
  ['crow', 'Carrion crow', '🐦‍⬛', 'Passeriformes', 'Corvidae', 'omnivore', 'Least Concern', 'forest grassland garden', 'Crows can recognise individual human faces — and remember them for years.', 'carrion insect seeds egg worm', 'bird'],
  ['cardinal', 'Northern cardinal', '🐦', 'Passeriformes', 'Cardinalidae', 'omnivore', 'Least Concern', 'garden forest', 'Both male and female cardinals sing.', 'seeds fruit insect', 'small-bird'],
  ['pigeon', 'Rock pigeon', '🕊️', 'Columbiformes', 'Columbidae', 'herbivore', 'Least Concern', 'garden', 'Pigeons can find their way home from over 1,000 km away.', 'seeds', 'bird'],
  ['woodpecker', 'Great spotted woodpecker', '🐦', 'Piciformes', 'Picidae', 'omnivore', 'Least Concern', 'forest taiga garden', 'A woodpecker can peck about 20 times a second without getting a headache.', 'insect seeds', 'small-bird'],
  ['kingfisher', 'Common kingfisher', '🐦', 'Coraciiformes', 'Alcedinidae', 'piscivore', 'Least Concern', 'wetland forest', 'Kingfishers dive into water at up to 40 km/h to snatch fish.', 'fish insect', 'small-bird'],
  ['macaw', 'Scarlet macaw', '🦜', 'Psittaciformes', 'Psittacidae', 'frugivore', 'Least Concern', 'rainforest', 'Macaws eat clay from riverbanks, which may help them digest tough seeds.', 'fruit seeds', 'bird'],
  ['owl', 'Great horned owl', '🦉', 'Strigiformes', 'Strigidae', 'carnivore', 'Least Concern', 'forest taiga desert grassland', 'Owls can turn their heads about 270 degrees.', 'small-mammal small-bird amphibian', 'predator'],
  ['eagle', 'Bald eagle', '🦅', 'Accipitriformes', 'Accipitridae', 'carnivore', 'Least Concern', 'forest wetland taiga mountain shore', 'A bald eagle nest can weigh more than a tonne.', 'fish small-mammal bird carrion', 'apex'],
  ['falcon', 'Peregrine falcon', '🦅', 'Falconiformes', 'Falconidae', 'carnivore', 'Least Concern', 'mountain shore grassland tundra', 'In a dive the peregrine is the fastest animal on Earth — over 300 km/h.', 'bird small-bird', 'apex'],
  ['flamingo', 'Greater flamingo', '🦩', 'Phoenicopteriformes', 'Phoenicopteridae', 'filter feeder', 'Least Concern', 'wetland shore', 'Flamingos are pink because of pigments in the shrimp and algae they eat.', 'algae shellfish', 'bird'],
  ['heron', 'Grey heron', '🪶', 'Pelecaniformes', 'Ardeidae', 'carnivore', 'Least Concern', 'wetland', 'Herons stand perfectly still for ages, then strike like lightning.', 'fish amphibian insect small-mammal', 'predator'],
  ['crane', 'Sandhill crane', '🪶', 'Gruiformes', 'Gruidae', 'omnivore', 'Least Concern', 'wetland grassland', 'Cranes perform leaping, wing-flapping dances.', 'seeds insect amphibian', 'bird'],
  ['spoonbill', 'Roseate spoonbill', '🦩', 'Pelecaniformes', 'Threskiornithidae', 'carnivore', 'Least Concern', 'wetland', 'It sweeps its spoon-shaped bill side to side to feel for food.', 'fish shellfish insect', 'bird'],
  ['stilt', 'Black-necked stilt', '🪶', 'Charadriiformes', 'Recurvirostridae', 'carnivore', 'Least Concern', 'wetland shore', 'For its size, the stilt has some of the longest legs of any bird.', 'insect shellfish', 'bird'],
  ['swan', 'Mute swan', '🦢', 'Anseriformes', 'Anatidae', 'herbivore', 'Least Concern', 'wetland', 'Swan pairs often stay together for life.', 'aquatic-plants', 'bird'],
  ['duck', 'Mallard', '🦆', 'Anseriformes', 'Anatidae', 'omnivore', 'Least Concern', 'wetland garden', 'Ducks spread oil from a gland near their tail to waterproof their feathers.', 'aquatic-plants seeds insect', 'bird'],
  ['puffin', 'Atlantic puffin', '🐧', 'Charadriiformes', 'Alcidae', 'piscivore', 'Vulnerable', 'shore tundra', 'Puffins can carry more than ten fish crosswise in their beaks.', 'fish', 'bird'],
  ['penguin', 'Emperor penguin', '🐧', 'Sphenisciformes', 'Spheniscidae', 'piscivore', 'Near Threatened', 'tundra', 'Emperor penguins huddle together to survive −60 °C winds in Antarctica.', 'fish shellfish', 'bird'],
  ['ostrich', 'Ostrich', '🪶', 'Struthioniformes', 'Struthionidae', 'omnivore', 'Least Concern', 'savanna desert', 'Ostriches lay the biggest eggs of any living bird.', 'seeds leaves insect', 'bird'],
  ['kiwi', 'North Island brown kiwi', '🥝', 'Apterygiformes', 'Apterygidae', 'omnivore', 'Vulnerable', 'forest', 'Kiwis have nostrils at the tip of their beak to sniff out worms.', 'worm insect fruit', 'bird'],
  ['turkey', 'Wild turkey', '🦃', 'Galliformes', 'Phasianidae', 'omnivore', 'Least Concern', 'forest grassland', 'Wild turkeys can fly in short bursts at around 90 km/h.', 'seeds insect fruit', 'bird'],
  ['rooster', 'Chicken (rooster)', '🐓', 'Galliformes', 'Phasianidae', 'omnivore', 'Domesticated', 'garden', 'Chickens are the closest living relatives of Tyrannosaurus rex.', 'seeds insect worm', 'bird'],
  ['peacock', 'Indian peafowl', '🦚', 'Galliformes', 'Phasianidae', 'omnivore', 'Least Concern', 'forest garden', 'A peacock’s train has about 200 shimmering “eyespot” feathers.', 'seeds insect fruit', 'bird'],
  ['hummingbird', 'Ruby-throated hummingbird', '🐦', 'Apodiformes', 'Trochilidae', 'nectarivore', 'Least Concern', 'forest garden', 'Hummingbirds beat their wings over 50 times a second and can fly backwards.', 'nectar insect', 'small-bird'],
  ['pelican', 'Brown pelican', '🪶', 'Pelecaniformes', 'Pelecanidae', 'piscivore', 'Least Concern', 'shore wetland', 'Brown pelicans plunge-dive from 20 m to scoop up fish.', 'fish', 'bird'],
  ['toucan', 'Toco toucan', '🐦', 'Piciformes', 'Ramphastidae', 'frugivore', 'Least Concern', 'rainforest', 'A toucan’s huge bill is mostly hollow and helps it stay cool.', 'fruit insect egg', 'bird'],
  ['cockatoo', 'Sulphur-crested cockatoo', '🦜', 'Psittaciformes', 'Cacatuidae', 'herbivore', 'Least Concern', 'forest rainforest', 'Cockatoos can live for more than 70 years.', 'seeds fruit', 'bird'],
  ['hornbill', 'Great hornbill', '🐦', 'Bucerotiformes', 'Bucerotidae', 'frugivore', 'Vulnerable', 'rainforest', 'A nesting female hornbill seals herself inside a tree hole while raising chicks.', 'fruit insect reptile', 'bird'],
  ['albatross', 'Wandering albatross', '🪶', 'Procellariiformes', 'Diomedeidae', 'piscivore', 'Vulnerable', 'shore', 'It has the longest wingspan of any bird — up to 3.5 m.', 'fish squid', 'bird'],
  ['seagull', 'Herring gull', '🐦', 'Charadriiformes', 'Laridae', 'omnivore', 'Least Concern', 'shore', 'Gulls drop shellfish onto rocks to crack them open.', 'fish shellfish carrion insect', 'bird'],
];

export const BIRD_SCI: Record<string, string> = {
  sparrow: 'Passer domesticus', robin: 'Erithacus rubecula', crow: 'Corvus corone', cardinal: 'Cardinalis cardinalis', pigeon: 'Columba livia',
  woodpecker: 'Dendrocopos major', kingfisher: 'Alcedo atthis', macaw: 'Ara macao', owl: 'Bubo virginianus', eagle: 'Haliaeetus leucocephalus',
  falcon: 'Falco peregrinus', flamingo: 'Phoenicopterus roseus', heron: 'Ardea cinerea', crane: 'Antigone canadensis', spoonbill: 'Platalea ajaja',
  stilt: 'Himantopus mexicanus', swan: 'Cygnus olor', duck: 'Anas platyrhynchos', puffin: 'Fratercula arctica', penguin: 'Aptenodytes forsteri',
  ostrich: 'Struthio camelus', kiwi: 'Apteryx mantelli', turkey: 'Meleagris gallopavo', rooster: 'Gallus gallus domesticus', peacock: 'Pavo cristatus',
  hummingbird: 'Archilochus colubris', pelican: 'Pelecanus occidentalis', toucan: 'Ramphastos toco', cockatoo: 'Cacatua galerita', hornbill: 'Buceros bicornis',
  albatross: 'Diomedea exulans', seagull: 'Larus argentatus',
};
/** birds that mostly stay on the ground or water rather than flying around */
export const GROUND_BIRDS = new Set(['penguin', 'ostrich', 'kiwi', 'turkey', 'rooster', 'peacock', 'flamingo', 'heron', 'crane', 'spoonbill', 'stilt', 'swan', 'duck']);

export const BIRDS = R.map(([key, name, emoji, order, family, diet, status, biomes, fact, eats, tags]) => ({
  key, name, emoji, biomes: biomes.split(' '),
  info: { scientific: BIRD_SCI[key], kingdom: 'Animalia', phylum: 'Chordata', class: 'Aves', order, family, diet, status, fact, eats: eats.split(' '), tags: [...tags.split(' '), 'bird'] } as SpeciesInfo,
}));
