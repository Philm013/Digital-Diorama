import type { AssetDef } from './types';
import { MODULE_PATHS as P } from './modules';

/**
 * Better models for some Wildform species.
 *
 * Wildform's generic body plans suit invertebrates, but not every vertebrate: songbirds, rabbits, camels and seals need
 * anatomy the plans can't draw. Those species are built on the rigged mammal, bird and herp modules (with clips and
 * gaits) or on the app's own models, with colours and anatomy taken from field guides. Asset ids stay the Wildform ones,
 * so saved dioramas keep working.
 */
const MAMMAL_HIDDEN = ['species', 'rigMode', 'pose', 'posePhase', 'detail', 'mergeForProduction', 'hide', 'specOverride', 'coat', 'coatGrain', 'shading'];
const BIRD_HIDDEN = ['species', 'rigMode', 'pose', 'posePhase', 'detail', 'mergeForProduction', 'specOverride', 'coat', 'coatGrain', 'shading'];

const mammal = (species: string, extra: Record<string, unknown>): Partial<AssetDef> => ({
  family: 'mammal', path: P.mammal, yaw: 0, hidden: MAMMAL_HIDDEN,
  params: { species, rigMode: 'skinned', mergeForProduction: true, ...extra },
});
const bird = (species: string, extra: Record<string, unknown>): Partial<AssetDef> => ({
  family: 'bird', path: P.bird, yaw: 0, hidden: BIRD_HIDDEN,
  params: { species, rigMode: 'skinned', mergeForProduction: true, ...extra },
});
// (reptiles and amphibians on the skinned herp rig, with clips)
const HERP_HIDDEN = ['species', 'rigMode', 'pose', 'posePhase', 'detail', 'mergeForProduction', 'coat', 'coatGrain', 'shading'];
const herp = (species: string, extra: Record<string, unknown> = {}): Partial<AssetDef> => ({
  family: 'reptile', path: P.herp, yaw: 0, hidden: HERP_HIDDEN,
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
      // a short face under a high, domed forehead
      snout: 0.27, snoutW: 0.56, snoutD: 0.62, stop: 0.75, dome: 1.22, eye: 0.06,
      palette: { body: '#cdc9be', belly: '#efece5', pattern: '#4b4c50', marking: '#77777a', eye: '#a3b4a2', nose: '#a08c88' },
    },
  }),
  // tan back, white belly, rump and throat, short black horns — no flank stripe (that's a gazelle)
  pronghorn: mammal('gazelle', {
    size: 1.3,
    specOverride: {
      flankStripe: false, rumpPatch: true, countershade: 0.55,
      // a buck's horns: upright over the eyes, a forward prong half way up, tips hooked back
      horns: { style: 'pronghorn', len: 0.75, thk: 0.09, s: 0.2, a: 0.35 },
      palette: { body: '#c08547', belly: '#f6f1e7', marking: '#2a1f17', horn: '#1c1916', nose: '#1c1714' },
    },
  }),
  // two humps, shaggy dark coat, shorter legs than the dromedary
  'bactrian-camel': mammal('camel', {
    size: 1.0, legLen: 0.9,
    specOverride: {
      // (broad, rounded humps)
      humps: [{ u: 0.36, h: 0.18, w: 0.3 }, { u: 0.74, h: 0.17, w: 0.3 }], wool: 0.035,
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
    // (compact and short-legged under a deep winter coat, with a short muzzle and a round face)
    size: 0.95, earSize: 0.5, muzzleLen: 0.68, legLen: 0.78, bodyLen: 0.85, tailLen: 0.95,
    specOverride: { snoutW: 0.44, headD: 0.28, dome: 1.22, cheekLow: 1.2, depth: 0.5, points: 0, tailTip: 0,
      // (on the measured canid body: a deeper, broader body and thicker legs under the winter coat)
      refDepth: 1.18, refW: 1.25, foreBulkR: 1.15, hindBulkR: 1.1, palette: { body: '#f3f1ec', belly: '#fbfaf7', marking: '#e7e4dd', eye: '#ae8a3c', nose: '#1c1a19' } },
  }),
  // tiny sand-coloured desert fox with enormous ears and a black tail tip
  'fennec-fox': mammal('fox', {
    size: 0.52, earSize: 1.8, muzzleLen: 0.78, legLen: 0.86, bodyLen: 0.88,
    // (the huge ears spread outward in a V)
    specOverride: { dome: 1.25, headD: 0.27, cheekLow: 1.15, snoutW: 0.42, points: 0, earZone: 'body', earTip: 0, tailTip: 0.12, tailTipZone: 'marking', ear: { spread: 34, cup: 0.6 }, palette: { body: '#e2c79c', belly: '#f7efe2', marking: '#3a2c20', eye: '#2a1d14', nose: '#1d1715' } },
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
  'blue-jay': bird('blue-jay', {}),
  // a thrush: grey-brown back, blackish head, brick-orange breast, yellow bill
  'american-robin': bird('american-robin', {}),
  // soft buff-brown dove with black wing spots and a long pointed tail
  'mourning-dove': bird('mourning-dove', {}),
  // North America's smallest woodpecker: short bill, black-and-white, red nape patch
  'downy-woodpecker': bird('downy-woodpecker', {}),
  // heart-shaped white face disc, golden-buff back, no ear tufts, long legs, dark eyes
  'barn-owl': bird('barn-owl', {}),
  /* ---------- reptiles & amphibians (the herp rig: measured body plans, skinned, with gaits) ---------- */
  'sand-lizard': herp('sand-lizard'),
  'green-anole': herp('green-anole'),
  'american-alligator': herp('american-alligator'),
  'eastern-box-turtle': herp('eastern-box-turtle'),
  'common-garter-snake': herp('common-garter-snake'),
  'alpine-newt': herp('alpine-newt'),
  'common-toad': herp('common-toad'),
  'glass-frog': herp('glass-frog'),
  /* ---------- marine (our own procedural models) ---------- */
  'harp-seal': builtin('seal'),
  'bottlenose-dolphin': builtin('cetacean', { kind: 'dolphin' }),
  'humpback-whale': builtin('cetacean', { kind: 'humpback' }),
  'portuguese-man-o-war': { ...builtin('man-o-war'), water: 'surface' },
  'sea-hare': builtin('sea-hare'),
  // fish built by the app's own fish model (src/assets/models/builtin/fish.ts)
  'great-white-shark': builtin('fish', { kind: 'shark' }),
  'manta-ray': builtin('fish', { kind: 'manta' }),
  'yellow-tang': builtin('fish', { kind: 'tang' }),
  clownfish: builtin('fish', { kind: 'clownfish' }),
  lionfish: builtin('fish', { kind: 'lionfish' }),
};
