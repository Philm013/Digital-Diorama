import type { AssetDef } from './types';
import { MODULE_PATHS as P } from './modules';

/**
 * Better models for some Wildform species.
 *
 * Wildform's generic body plans are fine for invertebrates, but a few vertebrates came out
 * wrong in the asset review (tools/review-assets.mjs): parrot beaks on songbirds, dog-shaped
 * rabbits and camels, a harp seal with a shark's dorsal fin. Those species are rebuilt on the
 * rigged mammal / bird / amphibian modules (with clips and gaits) or on our own procedural
 * models, using colours and anatomy taken from field guides. Asset ids stay the same, so
 * saved dioramas keep working.
 */
const MAMMAL_HIDDEN = ['species', 'rigMode', 'pose', 'posePhase', 'detail', 'mergeForProduction', 'hide', 'specOverride', 'coat', 'coatGrain', 'shading'];
const BIRD_HIDDEN = ['species', 'rigMode', 'pose', 'posePhase', 'detail', 'mergeForProduction', 'bodyForm', 'specOverride', 'coat', 'coatGrain', 'shading'];

const mammal = (species: string, extra: Record<string, unknown>): Partial<AssetDef> => ({
  family: 'mammal', path: P.mammal, yaw: 0, hidden: MAMMAL_HIDDEN,
  params: { species, rigMode: 'skinned', mergeForProduction: true, ...extra },
});
const bird = (species: string, extra: Record<string, unknown>): Partial<AssetDef> => ({
  family: 'bird', path: P.bird, yaw: 0, hidden: BIRD_HIDDEN,
  params: { species, rigMode: 'skinned', mergeForProduction: true, ...extra },
});
const builtin = (kind: string, extra: Record<string, unknown> = {}): Partial<AssetDef> => ({
  family: 'builtin', path: `builtin:${kind}`, yaw: 0, hidden: [], params: extra,
});

export const WILDFORM_REMAP: Record<string, Partial<AssetDef>> = {
  /* ---------- mammals ---------- */
  // pale smoky coat, grey rosettes and a tail almost as long and thick as the body
  'snow-leopard': mammal('leopard', {
    size: 0.95, legLen: 0.9, tailLen: 1.3,
    specOverride: {
      // larger, open rosettes than a leopard's
      tail: { style: 'bushy', thk: 0.1, bush: 0.6, curl: 40 }, ear: { len: 0.17 }, pawW: 1.25, cheek: 1.25, spotFreq: 7.5,
      palette: { body: '#cdc9be', belly: '#efece5', pattern: '#4b4c50', marking: '#77777a', eye: '#a3b4a2', nose: '#a08c88' },
    },
  }),
  // tan back, white belly, rump and throat, short black horns — no flank stripe (that's a gazelle)
  pronghorn: mammal('gazelle', {
    size: 1.3,
    specOverride: {
      flankStripe: false, rumpPatch: true, countershade: 0.55,
      horns: { style: 'antelope', len: 0.55, thk: 0.075, s: 0.12, a: 0.3 },
      palette: { body: '#c08547', belly: '#f6f1e7', marking: '#2a1f17', horn: '#1c1916', nose: '#1c1714' },
    },
  }),
  // two humps, shaggy dark coat, shorter legs than the dromedary
  'bactrian-camel': mammal('camel', {
    size: 1.0, legLen: 0.9,
    specOverride: {
      humps: [{ u: 0.38, h: 0.21, w: 0.22 }, { u: 0.72, h: 0.19, w: 0.22 }], wool: 0.035,
      palette: { body: '#99714c', belly: '#ae8862', mane: '#5e4128', hoof: '#4a3a2c', nose: '#3a2d24' },
    },
  }),
  // grizzled grey-buff, tawny legs and ears, black-tipped tail; a lighter build than a wolf
  coyote: mammal('wolf', {
    size: 0.74, earSize: 1.25, muzzleLen: 1.12,
    specOverride: { saddle: 0.14, tailTip: 0.13, tailTipZone: 'marking', palette: { body: '#9d8c76', belly: '#ece3d3', marking: '#6f6352', mane: '#b8956a', eye: '#c9a043' } },
  }),
  'golden-jackal': mammal('wolf', {
    size: 0.56, earSize: 1.15, muzzleLen: 1.08,
    specOverride: { saddle: 0, tailTip: 0.14, tailTipZone: 'marking', palette: { body: '#c09a60', belly: '#f0e3cb', marking: '#4a3a2a', eye: '#b98b2e' } },
  }),
  // winter-white coat, small rounded ears, short muzzle and legs, thick tail
  'arctic-fox': mammal('fox', {
    size: 0.95, earSize: 0.62, muzzleLen: 0.82, legLen: 0.84, tailLen: 0.95,
    specOverride: { points: 0, tailTip: 0, palette: { body: '#f3f1ec', belly: '#fbfaf7', marking: '#e7e4dd', eye: '#ae8a3c', nose: '#1c1a19' } },
  }),
  // tiny sand-coloured desert fox with enormous ears and a black tail tip
  'fennec-fox': mammal('fox', {
    size: 0.52, earSize: 1.8,
    specOverride: { points: 0, earZone: 'body', earTip: 0, tailTip: 0.12, tailTipZone: 'marking', palette: { body: '#e2c79c', belly: '#f7efe2', marking: '#3a2c20', eye: '#2a1d14', nose: '#1d1715' } },
  }),
  'eastern-gray-squirrel': mammal('squirrel', {
    size: 1.25, earStyle: 'pointed',
    specOverride: { palette: { body: '#8d8a85', belly: '#f1ede6', marking: '#8a6a50', nose: '#2e2a28', eye: '#120d0a' } },
  }),
  // a small ground squirrel: striped back, white belly, flatter tail
  'eastern-chipmunk': mammal('squirrel', {
    size: 0.72, tailLen: 0.55, earStyle: 'round',
    // five dark back stripes with pale bands between, a dark eye stripe framed in pale, a slimmer tail held up
    specOverride: { pattern: 'chipmunk', tail: { bush: 0.35, thk: 0.13, set: 70, curl: -10 }, palette: { body: '#a8703f', belly: '#f4e9d8', marking: '#2c1f17', nose: '#2e221c' } },
  }),
  // grey-brown agouti coat and the white "cotton" tail
  'eastern-cottontail': mammal('rabbit', {
    size: 1.05,
    specOverride: { palette: { body: '#8b7a66', belly: '#efe8de', skin: '#d8a49a', nose: '#b98078', eye: '#1e130c' } },
  }),
  // grizzled grey body, white face, black ears and legs, long bare tail
  'virginia-opossum': mammal('raccoon', {
    size: 1.05, muzzleLen: 1.35, tailLen: 1.15, tailStyle: 'thin', coatPattern: 'none', earStyle: 'round',
    // black ears, and a bare pink tail (furred only at the base)
    specOverride: { points: 0.5, cheeks: false, earZone: 'marking', tailTip: 0.72, tailTipZone: 'skin', grain: 2, palette: { body: '#a7a39c', belly: '#e9e6e0', marking: '#1d1b1a', skin: '#e1b2aa', nose: '#e4a6a0' } },
  }),
  /* ---------- birds ---------- */
  // crested songbird: blue above, white below, black necklace and eye-line, black bill
  'blue-jay': bird('cardinal', {
    size: 1.28,
    specOverride: {
      beak: { len: 1.0, w: 0.24, h: 0.28, style: 'cone' }, crest: { h: 0.95 },
      pattern: { mask: true, maskShape: 'stripe', chin: false, collar: true, cheek: 'belly', throat: 'belly', wingBar: true, tail: 'wing' },
      // black bars across the wings and tail
      marks: { wing: 'bars', tail: 'bars', zone: 'face', freq: 1.6 },
      palette: { body: '#3e72c2', belly: '#f2f2ee', wing: '#3b70c4', flight: '#2b4d8d', head: '#4a7ed0', face: '#141416', accent: '#3e72c3', beak: '#18181a', jaw: '#18181a', leg: '#2e2f36', eye: '#141010' },
    },
  }),
  // a thrush: grey-brown back, blackish head, brick-orange breast, yellow bill
  'american-robin': bird('robin', {
    size: 1.85, beakLength: 1.1,
    specOverride: {
      pattern: { breast: 'accent', face: false, forehead: false, throat: 'head', headAll: true },
      palette: { body: '#4e4944', belly: '#ebe5dc', wing: '#4a4540', flight: '#3a3633', head: '#25221f', face: '#efeae2', accent: '#c45a27', beak: '#ddb032', jaw: '#ddb032', leg: '#5a4c40', eye: '#140f0c' },
    },
  }),
  // soft buff-brown dove with black wing spots and a long pointed tail
  'mourning-dove': bird('pigeon', {
    size: 0.9, tailLength: 1.65, tailStyle: 'wedge', headSize: 0.86,
    specOverride: {
      pattern: { neck: false, wingBands: false, wingBar: false },
      // black spots on the wing coverts
      marks: { wing: 'spots', spotZone: 'face', freq: 0.8 },
      palette: { body: '#a8917a', belly: '#d9c0a8', wing: '#9e886f', flight: '#6e6357', head: '#a99a87', face: '#c6ae95', accent: '#6a5a4a', beak: '#2b2624', jaw: '#2b2624', leg: '#c97b6b', eye: '#1c1410' },
    },
  }),
  // North America's smallest woodpecker: short bill, black-and-white, red nape patch
  'downy-woodpecker': bird('woodpecker', {
    size: 0.7, beakLength: 0.58,
    specOverride: {
      // a white stripe down the back and white-spotted wings
      marks: { back: 'stripe', wing: 'spots', tail: 'bars', light: 'belly', zone: 'body', freq: 1.4 },
      palette: { body: '#18181b', belly: '#f3f1eb', wing: '#1b1b1f', flight: '#26262b', head: '#18181b', face: '#f2efe8', accent: '#d32f29', beak: '#2b2b2d', jaw: '#2b2b2d', leg: '#5d5a62' },
    },
  }),
  // heart-shaped white face disc, golden-buff back, no ear tufts, long legs, dark eyes
  'barn-owl': bird('owl', {
    size: 1.05, legLength: 1.9, eyeSize: 0.82,
    specOverride: {
      crest: null, eyeRing: 0.75,
      // white underparts with a few small dark spots; golden-buff back finely dotted (not the horned owl's barring)
      marks: { belly: 'spots', back: 'spots', wing: 'spots', tail: 'bars', zone: 'accent', light: 'belly', freq: 2.4 },
      pattern: { mask: 'face', throat: 'belly', barred: false },
      palette: { body: '#c79a58', belly: '#f5f0e7', wing: '#cfa263', flight: '#dccaa6', head: '#c79a58', face: '#f8f5ee', accent: '#8a6440', beak: '#dccdb6', jaw: '#dccdb6', leg: '#cfbba3', eye: '#120c08' },
    },
  }),
  /* ---------- amphibians ---------- */
  // a squat warty toad (shares the cane toad's anatomy, with Bufo bufo's earthy colours)
  'common-toad': {
    family: 'reptile', path: P.reptile('cane-toad'), yaw: 0, hidden: ['mergeForProduction'],
    params: { mergeForProduction: true, length: 0.1, warts: 70, parotoid: 0.85, skin: '#86694a', wart: '#73573a', belly: '#d8ccb1' },
  },
  /* ---------- marine (our own procedural models) ---------- */
  'harp-seal': builtin('seal'),
  'bottlenose-dolphin': builtin('cetacean', { kind: 'dolphin' }),
  'humpback-whale': builtin('cetacean', { kind: 'humpback' }),
  'portuguese-man-o-war': { ...builtin('man-o-war'), water: 'surface' },
  'sea-hare': builtin('sea-hare'),
  // fish the generic plans drew as faceted blobs (src/assets/builtin/fish.ts)
  'great-white-shark': builtin('fish', { kind: 'shark' }),
  'manta-ray': builtin('fish', { kind: 'manta' }),
  'yellow-tang': builtin('fish', { kind: 'tang' }),
  clownfish: builtin('fish', { kind: 'clownfish' }),
  lionfish: builtin('fish', { kind: 'lionfish' }),
};
