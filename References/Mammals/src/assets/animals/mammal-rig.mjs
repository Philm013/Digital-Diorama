/*
 * MAMMAL RIG (High Detail) — procedural, skinned, swept-surface mammals
 * A parametric low-poly generator for three.js: one import, no loader, no textures.
 * Bodies are one continuous loft (rump > barrel > chest > neck) of superelliptic
 * sections on transported frames; skulls are lofted with a hinged jaw; limbs are
 * swept through anatomical joints; ears, manes and palms are thickened membranes.
 * Every vertex is skinned to one shared skeleton driven by procedural gaits.
 *
 * QUICK START
 *   import { createAsset, createClips } from './mammal-rig.mjs';
 *   const horse = createAsset({ species: 'horse', mergeForProduction: true });
 *   scene.add(horse);
 *   const mixer = new THREE.AnimationMixer(horse);
 *   mixer.clipAction(createClips(horse).find(c => c.name === 'gallop')).play();
 *
 * SPECIES  43 presets (Digital Diorama revision 10: laid out from measured reference animals): horse, zebra, donkey,
 *          cow, deer, wolf, cat, lion, tiger,
 *          elephant, giraffe, bear, pig, rabbit, dog, fox, hyena, cheetah, leopard,
 *          lynx, polarBear, panda, raccoon, badger, otter, hedgehog, squirrel, beaver,
 *          capybara, sheep, bighorn, goat, bison, gazelle, moose, reindeer, camel,
 *          llama, rhino, hippo, boar, anteater, mouse.
 * SPECS    ~9,500-17,500 triangles at standard detail (draft ~0.4x, high ~2.4x); 1 solid
 *          material (+1 translucent for glass parts); merged = 1-2 draw calls.
 *          Real-world L x H x W (m): Horse 2.78x2.10x0.57; Dairy Cow 2.38x1.43x0.74;
 *          African Elephant 4.71x3.01x2.28; House Mouse 0.15x0.04x0.03.
 *          +Z forward, +Y up, ground at y = 0; exact bounds in asset.userData.dimensions.
 * OPTIONS  species, size, age, body/leg/neck/head/muzzle proportions, ear/tail/horn/
 *          mane/hump/foot/stance styles, tusks, trunk, fangs, claws, quills, coat
 *          pattern, countershading, variation seed, detail, rig mode, pose, colourway.
 * RIG      Root > Hips > Spine1 > Spine2 > Chest > Neck1 > Neck2 > Head > Jaw | EarL/R |
 *          Trunk1-5; Chest > Scapula > Arm > Forearm > Hand > Finger (L/R);
 *          Hips > Thigh > Shin > Foot > Toe (L/R); Hips > Tail1..n.
 * CLIPS    idle, walk, trot, gallop, graze, alert, roar, sit — footfall-accurate gaits with
 *          planted feet (foot paths + leg IK); gait clips carry userData { gait, stride,
 *          speed, hipH }. createClips(asset), setPose(asset, name, phase).
 * PARTS    animate: see `rig` (bone names); detach: horns, tusks, trunk, mane, tail,
 *          ears, eyes, eyelids, nose, teeth, spines, jaw, feet.
 * LICENSE  CC0 1.0 Universal — this module and all generated geometry.
 *
 * REVISION 2 (anatomy review)
 *   - The published file was cut off inside tetraMane(). Rebuilt the manes, quills, coat painter,
 *     zones / palettes, all 43 species presets, params / rig / detach / night metadata,
 *     createAsset, createClips and setPose.
 *   - Rear torso: the croup now slopes to the tail head, the buttocks curve under, a long 0.95x
 *     elliptical rump cap and a hamstring bulge replace the flat-disc rear.
 *   - Torso sections: broad back / keeled chest / rounded belly instead of a uniform tube.
 *   - Rear legs: the quarter (thigh) is sized from the body, flush with the flank, rooted under the
 *     croup and narrowing to the stifle at the flank fold. Stifle offset scales with hip height,
 *     and crouched hocks tuck under the rump.
 *   - Skull: rounded occiput, egg-shaped braincase, supraorbital brow ridge. The neck tapers
 *     near-linearly into the skull (no collar on short-necked species).
 *   - Ears: tubular conch at the root plus an auricular mound, and fan ears hang properly.
 *
 * REVISION 3 (Digital Diorama: realism)
 *   - Coat atlas: painters are rasterised into one texture per asset instead of one colour per
 *     quad, so stripes, spots, rosettes, masks and patch edges are smooth curves (see COAT ATLAS).
 *   - Smooth, crease-aware normals and glossy eyes. Options: coat, coatGrain, shading.
 *
 * REVISION 4 (Digital Diorama: hind legs and motion, checked against skeletons and photos)
 *   - Hind joints come from real proportions (HIND LIMB LAYOUT): fetlocks at 12-19 % of the hip
 *     height (they sat at 4-7 %, leaving no pasterns), stifles high in the flank on deep-bodied
 *     ungulates, plantigrade shins upright over the heel, crouched rodent and rabbit legs folded
 *     inside the haunch. Species tune them with `hind: {...}` / `hindShape: {...}`.
 *   - The hind leg is lofted through its side-view outline (HIND LEG SURFACE): a broad thigh from
 *     flank fold to point of buttock, gaskin, Achilles and point of hock, skinned by joint planes.
 *   - Real hooves (coronary band, sloped toe wall, cloven claws) and compact paws.
 *   - Clips rewritten (CLIPS & POSES): planted feet on foot paths solved by leg IK, each family's
 *     real footfalls, Froude-scaled timing and stride metadata; lying down for hoofed animals.
 *
 * REVISION 5 (Digital Diorama: body shapes; bodies read as barrels on sticks)
 *   - Torso: a flank station and a section shape per station (`st`): narrow withers and a keeled
 *     chest, a belly that hangs in grazers and tucks up in hunters, a broad flat back and croup;
 *     the breastbone rises to the base of the neck (no box front). Seen from above: chest narrower
 *     than the ribs, a waist, broad quarters. Family values: keel, waist, chestNarrow, withersTop,
 *     quarters, croupFlat, backFlat, arch (the cats' arched loin), breast.
 *   - Surface anatomy: shoulder blade, triceps and point of shoulder sculpted into the chest wall;
 *     `marks` (points of hip, flank hollow, ribs, girth groove, breast, withers, spine).
 *   - Forelegs lofted through their side-view outline (FORELEG SURFACE) instead of a tube;
 *     `foreBulk` / `hindBulk` give big cats and bears their massive limbs.
 *   - The thigh's ilium root sits inside the hip (it poked out as knobs on the croup); normals are
 *     blended across the body / leg seams (blendSeamNormals) so the joins shade as one surface.
 *
 * REVISION 6 (Digital Diorama: heads)
 *   - The jaw hung below the whole head as a narrow strap (a crocodile's mouth). Behind the corner of
 *     the mouth (`mouthS`, under the eye in hunters, far forward in grazers and rodents) the cheek now
 *     covers the jaw; the lips meet only in front of it. The mouth still opens (roar).
 *   - A real stop: the forehead rises over the eyes and the nasal bridge drops in front by `stop`.
 *     Cats: deeper, rounder skulls and blunt muzzles; dogs: a broad skull and deep muzzle.
 *   - Ear-base mounds sunk into the skull (they stood out as knobs); hanging ears lie against the
 *     side of the head instead of standing off as discs or sinking into the cheek.
 *   - Elephant: the head re-aimed (it was a flat 1.5 m helmet) and a dedicated fan ear (tetraFanEar)
 *     draped behind the eye over the neck and shoulder; hippo and camel heads reshaped.
 *   - Grazing reaches the grass in front of the forefeet (the neck pivots about its base, not
 *     mid-chest); lying elephants lift the head and curl the trunk; wolves' saddles fade raggedly.
 *
 * REVISION 7 (Digital Diorama: humps, heads, limb roots, elephants and planted feet)
 *   - Humps: the withers bump falls steeply in front (`withersFront`) and slopes gradually back to the loin (`withersBack`),
 *     and over a real hump (`humpTop`, `humpN`) the section keeps its width up to a rounded top instead of narrowing to a
 *     ridge (the bison's front was a tall tent, the boar's withers a peak). The bison has a shaggy cape (`shag`) whose edge
 *     runs back over the hump and frays (`maneSlant`, `maneRag`) and runs down the forearms (`maneLegs`); the boar's
 *     bristle crest runs on along the spine (`mane.back`).
 *   - Heads: pad noses sit on the front of the rounded muzzle (they were buried in it, so wolves, bears, otters and rodents
 *     had none); big erect ears move out round the skull, then spread, until they stop crossing over the crown; hanging ears
 *     are pushed clear of the head row by row and smoothed (they kinked); a camel's thick split upper lip hangs over the
 *     lower (`lipOver`, `cleft`, `jawEnd`) above slit nostrils (`nostrilSlit`); a sheep's wool cap (`woolCap`); broad
 *     beaver incisors (`incisorW`); moose palms cupped and tilted up and back with tines round their edges; new otter,
 *     beaver, polar bear and camel heads. Pad-nose sizes: `padW`, `padH`, `padD`, `padUp`.
 *   - Limb roots (blendLimbRoots): above the stifle and the upper arm the body is the outer surface, so leg points that stood
 *     out of it are tucked inside (the thigh's top showed on the croup as a slab), and below that the leg flares into the
 *     body by the soft-union amount (`fillet`), so the join no longer shows as a hard crease. Legs and torso are emitted
 *     after this blend.
 *   - Elephant: high shoulders over a back sloping to a lower, rounded rump, a deep round belly and a compact body; fan ears
 *     with a curled top rim, a curved front edge and soft folds; pad feet flat on the ground, their contact at the pad's
 *     front edge (rolling over its middle sank them 2-5 cm into the ground), as for rhinos and hippos.
 *   - Gaits: the girdles' drop is smoothed round the cycle (dropCurve; the body jumped by the whole drop, up to a quarter of
 *     a metre, when a straining foot lifted); feet stay on their line across the body and level (keepOnLine; pelvic roll
 *     and body sway slid them 5-15 cm sideways a step); the swing starts and ends moving back with the ground, so feet set
 *     down instead of skidding; the foreleg solve no longer misses at touchdown; 41-65 keys a cycle. Elephants take shorter
 *     steps; rabbits' and squirrels' hind feet land under the chest in the bound (their haunches stretched at push-off).
 *   - Graze: carnivores, bears and rodents sniff the ground in front of their forefeet with a shallower neck; grazers that
 *     must dip the forehand (short necks) step their forefeet forward instead of folding the elbows.
 *
 * REVISION 8 (Digital Diorama: the African elephant rebuilt, faster builds, keys where joints turn fast)
 *   - Elephant: its own builder (`builder: 'elephant'` → elephantBuild, see ELEPHANT), reusing loft, sheet, emit, the Rig,
 *     the skin helpers, the coat painter and blendLimbRoots. Torso highest at the withers, dipping and rising to the hips,
 *     belly 0.42-0.48 H; pillar legs (elbow and stifle low, the stifle bulging forward), round fore and oval hind pads
 *     with flat toenails (4 / 3); one loft for head and trunk (single dome, low eye with the temporal hollow, trunk ringed
 *     and two-fingered on Trunk1-Trunk5, a hand above the ground); tusks from skin sheaths; Africa-shaped ears hung from
 *     above the eye to the mouth's corner as a curved shell with a rolled top edge, flapping on EarL / EarR and kept clear
 *     of the body (earGuard); wrinkled skin from a tiling crease pattern (creaseTile) plus real rings on trunk and legs.
 *     Its own idle, graze (the trunk plucks grass and brings it to the mouth), alert, roar (trumpet) and sit (lying down,
 *     clear of the ground) clips (ELE_CLIP_SPEC, eleSample); walk and amble through the shared gait machinery with
 *     straight stance legs (a pantograph that keeps the stifle straight) and flexing knees in the swing. Ids, params, bone
 *     and clip names are unchanged.
 *   - Clips: a gait clip gains keys where a joint turns more than 1.5° between two (bakeClip refine, sampleGap), so fast
 *     feet no longer dip between keys (giraffe and llama gallops sank 1.5 cm); dropCurve's smoothing width per gait (dropK).
 *   - Speed: smoothNormals hashes quantised positions instead of string keys, the coat painter skips the grain where it
 *     is off; an elephant builds in about 140 ms instead of 230.
 *
 * REVISION 9 (Digital Diorama: faces, heads and bodies checked against the species photos)
 *   - The lower jaw was a narrow oval hung below the skull's rounded underside, so a shelf ran along the lips and the jaw
 *     read as a separate strap (a duck's bill on cats, a crocodile's on wolves). Its widest part now lies at the edge of the
 *     upper lips (`lipDepth`), as wide as the muzzle there less the lips' thickness (`lipInset`), fitted inside the cheek
 *     behind the mouth corner, with a rounded chin (`chinN`); the upper lips hang down the sides of the muzzle (`lipN`)
 *     and can carry a dark lip line (`lipZone`). Canines are rooted inside the lips.
 *   - Heads were tapered tubes: each station now shapes its upper and lower halves apart (`crownW` between the ears,
 *     `browW` over the eyes, `bridgeW` along the nose, `cheekLow` below the eyes, `lipW` across the lips), so a cat's face
 *     is round and broad-cheeked, a horse's forehead broad over a narrow face, a dog's nose narrower than its lips.
 *   - Eyes stay at the stop (`eyeReach`; a short face slid them onto the muzzle) and can look forward (`eyeFwd`); pale
 *     cheeks rise from the throat to the whisker pads (`cheekFrom`) instead of a level band along the jaw.
 *   - A narrow throatlatch behind the jowls (`throat`); the neck's end no wider than the back of the skull (`neckCapW`,
 *     it stood round short necks as a collar) and a fuller occiput; normals blended across the head / neck seam.
 *   - Family faces: cats (round, short-faced, eyes forward), dogs (domed forehead over a real stop, narrow nose bridge,
 *     broad lips, eyes high and forward), hoofed animals (throatlatch, broad forehead, fuller lips), bears (dark lips).
 *     Species: the horse, cow, pig, Labrador, wolf, fox, hyena, brown bear, badger, panda, big cats, bison (a massive head
 *     and short beard), boar (deep body, sturdy legs), hippo (a head a third longer), camel and giraffe (lean quarters
 *     under a falling croup), rabbit, mouse, capybara and hedgehog.
 *   - Horns: the rhino's sweeps back with a concave taper over an oval base; the ram's curl wraps the ear instead of
 *     hanging below the jaw (`curlR`); ossicones stand upright in world axes; new `pronghorn` (a forward prong, the tip
 *     hooked back) and `dagger` (a mountain goat's) styles. A beard is built without a mane (`beardW`, its width).
 *
 * REVISION 10 (Digital Diorama: every quadruped laid out like the elephant, from a measured reference animal)
 *   - The parametric layout made tubes on sticks however it was tuned (thin necks on horses and wolves, pencil forearms on
 *     big cats, a giraffe's body a pinched wedge, a bear with no hump). Each body plan is now laid out from a measured
 *     reference animal, as the elephant was (see MEASURED LAYOUTS and REF): its body and neck outline at stations, its
 *     joints and each leg's front and back edges and width down to the hoof or paw, in fractions of its shoulder height,
 *     from conformation measurements, skeletons and side and front photographs. Tables: equid (a 1.60 m riding horse),
 *     bovine, bison, cervid, moose, caprine, camelid, llama, giraffe, suid, boar, rhino, hippo, felid (a lion), cheetah,
 *     canid (a wolf), hyena, ursid (a brown bear), polar, procyonid, mustelid (a badger), otter, rabbit, leaper (a
 *     squirrel), capybara, beaver and anteater; species tune them with `refLen`, `refDepth`, `refW`, `refNeck`,
 *     `foreBulkR` and `hindBulkR`. Hoofed, paw and sole legs share profiles measured on a horse, a lion and a bear (LEG).
 *     The layout feeds the shared machinery, so heads, ears, horns, manes, tails, feet, the painter, bones and clip names
 *     are unchanged; the mouse, hedgehog and elephant keep their own builders.
 *   - A loft can stand its sections upright (`level`): a body measured as vertical slices keeps them where its path rises
 *     into a steep neck (the chest's section leaned back into a fin at the withers).
 *   - Lying down and sitting clear the ground (clearGround, after the elephant's lying down): the body settles only as far
 *     as the folded legs' surfaces, hooves, pads and paws stay above it (hoofed animals lying down sank 10 cm on average,
 *     the giraffe 23; now under 1.3), and tails lie along the ground instead of through it (tailOnGround; a sitting lion's
 *     tail went 65 cm under). Gaits are within a few millimetres of before, and the deepest foot in any gait is 0.9 cm.
 *   - The panda's saddle sits over its shoulder blades; the hair of a low-set tail sweeps back along the ground.
 *
 * REVISION 11 (Digital Diorama)
 *   - The mouse and hedgehog, the last two on the generic layout, are laid out from measured references too (REF.mouse:
 *     a crouched rodent on high, round haunches, a short low neck and big ears; REF.hedgehog: a dome of spines 1.34 U
 *     high on short plantigrade legs, the head carried low).
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ════════════════════════════════════════════════════════════════════════════
 *  INLINE SWEEP ENGINE  (self-contained; duplicated verbatim in every rig file)
 *  Bodies are lofted superellipse sections swept along transported frames,
 *  membranes are thickened parametric sheets, and every vertex carries
 *  four-bone skin weights so the same geometry poses, animates or bakes.
 * ════════════════════════════════════════════════════════════════════════════ */
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / ((b - a) || 1e-9), 0, 1); return t * t * (3 - 2 * t); };
const bell = (x, c, w) => { const d = (x - c) / w; return d * d >= 1 ? 0 : (1 - d * d) * (1 - d * d); };
const fract = (x) => x - Math.floor(x);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const vec = (p) => (p && p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2]));
const asFn = (f, d = 0) => (typeof f === 'function' ? f : f === undefined || f === null ? () => d : () => f);
const ang = (deg) => deg * DEG;
const dirYZ = (deg) => V3(0, Math.sin(deg * DEG), Math.cos(deg * DEG));

/** Monotone cubic (Fritsch–Carlson) profile through [[t, value], ...]: smooth bulges, never overshoots. */
function prof(keys) {
  const k = keys.filter(Boolean).slice().sort((a, b) => a[0] - b[0]);
  const n = k.length;
  if (n === 0) return () => 0;
  if (n === 1) return () => k[0][1];
  const xs = k.map(e => e[0]), ys = k.map(e => e[1]), d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / Math.max(1e-9, xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(d[i]) < 1e-12) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (t) => {
    if (t <= xs[0]) return ys[0];
    if (t >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (i < n - 2 && t > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], s = (t - xs[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * ys[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * ys[i + 1] + (s3 - s2) * h * m[i + 1];
  };
}

function mulberry(seed) {
  let a = (Math.floor(seed) >>> 0) ^ 0x9e3779b9;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash3(x, y, z, s) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x9e3779b1) ^ Math.imul((s | 0) + 1013, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
/** Smooth value noise in [0, 1]. */
function vnoise(x, y, z, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  let r = 0;
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) {
    r += hash3(ix + dx, iy + dy, iz + dz, s) * (dx ? ux : 1 - ux) * (dy ? uy : 1 - uy) * (dz ? uz : 1 - uz);
  }
  return r;
}
function fbm(x, y, z, s = 0, oct = 3) {
  let a = 0.5, f = 1, r = 0, n = 0;
  for (let i = 0; i < oct; i++) { r += a * vnoise(x * f, y * f, z * f, s + i * 31); n += a; a *= 0.5; f *= 2.03; }
  return r / n;
}
/**
 * Cellular (Worley) noise: [nearest, second nearest] feature distances. (Digital Diorama revision 8: the home cell is
 * searched first and a neighbouring cell is skipped when even its nearest corner is no closer than the second-nearest
 * point found so far; the same result, about twice as fast.)
 */
const WORLEY_ORDER = [0, -1, 1];
function worley(x, y, z, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  let f1 = 9, f2 = 9;
  for (const dx of WORLEY_ORDER) for (const dy of WORLEY_ORDER) for (const dz of WORLEY_ORDER) {
    const bx = dx < 0 ? fx : dx > 0 ? 1 - fx : 0, by = dy < 0 ? fy : dy > 0 ? 1 - fy : 0, bz = dz < 0 ? fz : dz > 0 ? 1 - fz : 0;
    if (bx * bx + by * by + bz * bz >= f2 * f2) continue;
    const cx = ix + dx, cy = iy + dy, cz = iz + dz;
    const px = cx + hash3(cx, cy, cz, s), py = cy + hash3(cx, cy, cz, s + 7), pz = cz + hash3(cx, cy, cz, s + 13);
    const d = Math.hypot(px - x, py - y, pz - z);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return [f1, f2];
}

/* ── colour helpers (sRGB hex space, independent of renderer colour management) ── */
const hexOf = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v & 0xffffff;
  if (typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v.trim())) return parseInt(v.trim().replace('#', ''), 16);
  return null;
};
const hexStr = (h) => '#' + ((h ?? 0) & 0xffffff).toString(16).padStart(6, '0');
function rgbOf(h) { return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]; }
function hexRGB(r, g, b) { return (clamp(Math.round(r * 255), 0, 255) << 16) | (clamp(Math.round(g * 255), 0, 255) << 8) | clamp(Math.round(b * 255), 0, 255); }
function hslOf(h) {
  const [r, g, b] = rgbOf(h), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hh / 6, s, l];
}
function hexHSL(h, s, l) {
  h = fract(h); s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  if (s === 0) return hexRGB(l, l, l);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = fract(t); return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return hexRGB(f(h + 1 / 3), f(h), f(h - 1 / 3));
}
function mixHex(a, b, t) { const A = rgbOf(hexOf(a)), B = rgbOf(hexOf(b)); return hexRGB(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); }
function tone(hex, { dh = 0, s = 1, l = 1, la = 0 } = {}) { const [h, ss, ll] = hslOf(hexOf(hex)); return hexHSL(h + dh, ss * s, ll * l + la); }

/* ── geometry accumulation: non-indexed triangles, one zone per face, 4 skin influences per vertex ── */
const NO_W = [[0, 1]];
class Part {
  constructor(name, opt = {}) {
    this.name = name; this.glass = !!opt.glass; this.group = opt.group || name;
    this.p = []; this.z = []; this.si = []; this.sw = [];
    // coat atlas: per-vertex (s, t) inside each face's patch, and the patch per face (null = flat colour);
    // coatK > 1 paints this part's patches coarser (parts only seen briefly, such as spread wings)
    this.uv = []; this.pt = []; this.coat = false; this.coatK = opt.coatK ?? 1;
  }
  get count() { return this.p.length / 3; }
  v(P, W) {
    this.p.push(P.x, P.y, P.z);
    const w = W || NO_W;
    for (let i = 0; i < 4; i++) { const e = w[i]; this.si.push(e ? e[0] : 0); this.sw.push(e ? e[1] : 0); }
  }
  tri(a, b, c, zone, wa, wb, wc, uv = null, patch = null) {
    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z, vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * cx + cy * cy + cz * cz < 1e-26) return;
    this.v(a, wa); this.v(b, wb || wa); this.v(c, wc || wa); this.z.push(zone);
    if (patch) { this.uv.push(uv[0], uv[1], uv[2], uv[3], uv[4], uv[5]); this.pt.push(patch); }
    else { this.uv.push(0, 0, 0, 0, 0, 0); this.pt.push(null); }
  }
}

/** Centripetal Catmull-Rom path, arc-length parameterised. */
function makePath(points, closed = false) {
  const clean = [];
  for (const p of points) { const v = vec(p); if (!clean.length || v.distanceToSquared(clean[clean.length - 1]) > 1e-14) clean.push(v); }
  if (clean.length === 1) clean.push(clean[0].clone().add(V3(0, 0, 1e-4)));
  const c = clean.length === 2 && !closed ? new THREE.LineCurve3(clean[0], clean[1]) : new THREE.CatmullRomCurve3(clean, closed, 'centripetal');
  c.arcLengthDivisions = Math.max(200, clean.length * 48);
  return c;
}
/** Arc-length parameters (0..1) of each control point of a Catmull-Rom path. */
function knotUs(curve, n) {
  if (n < 2) return [0];
  if (curve.isLineCurve3) return [0, 1];
  const per = 24, L = curve.getLengths((n - 1) * per), tot = L[L.length - 1] || 1;
  return Array.from({ length: n }, (_, i) => L[i * per] / tot);
}

const capOf = (c, d) => (c === undefined || c === null ? d : typeof c === 'string' ? { type: c } : c);
/** Superellipse point: a=0 side(+S), a=PI/2 up(+U). Separate top/bottom half-heights and exponents. */
function sePoint(a, w, ht, hb, nt, nb) {
  const c = Math.cos(a), s = Math.sin(a), e = 2 / (s >= 0 ? nt : nb);
  return [w * Math.sign(c) * Math.abs(c) ** e, (s >= 0 ? ht : hb) * Math.sign(s) * Math.abs(s) ** e];
}

/**
 * Loft: sweeps superelliptic sections along a path with parallel-transported frames.
 * Tangents are smoothed over a window proportional to the local section size, and
 * rings are kept monotone so thick bodies never fold inside tight bends.
 */
function loft(o) {
  const curve = o.curve || makePath(o.pts, !!o.closed);
  const closed = !!o.closed;
  const K = Math.max(2, Math.round(o.seg || 16)), R = Math.max(3, Math.round(o.rad || 12));
  const u0 = o.u0 ?? 0, u1 = o.u1 ?? 1;
  const W = asFn(o.w, 0.1), HT = asFn(o.ht ?? o.w, 0.1), HB = asFn(o.hb ?? o.ht ?? o.w, 0.1);
  const NT = asFn(o.nt, 2), NB = asFn(o.nb ?? o.nt, 2), OY = asFn(o.oy, 0), OX = asFn(o.ox, 0), ROLL = asFn(o.roll, 0);
  const dist = o.dist || ((t) => t), bump = o.bump || null;
  const len = curve.getLength();
  const sizeAt = (u) => Math.max(Math.abs(W(u)), Math.abs(HT(u)), Math.abs(HB(u)));
  const NF = Math.max(48, K * 3), fs = [], ft = [];
  for (let i = 0; i <= NF; i++) { const u = u0 + (u1 - u0) * i / NF; fs.push(u * len); ft.push(curve.getTangentAt(clamp(u, 0, 1))); }
  const bendK = o.bend ?? 0.9;
  const tangentAt = (u) => {
    const raw = curve.getTangentAt(clamp(u, 0, 1));
    if (bendK <= 0 || closed) return raw;
    const s = u * len, sig = Math.max(len * 0.004, bendK * sizeAt(u)), acc = V3();
    for (let i = 0; i <= NF; i++) { const d = (fs[i] - s) / sig; if (d * d < 9) acc.addScaledVector(ft[i], Math.exp(-d * d)); }
    const t = acc.lengthSq() < 1e-12 ? raw : acc.normalize();
    // Digital Diorama revision 10: `level(u)` (0..1) stands a section upright, its tangent turned level along the
    // path's heading: a body measured as vertical slices keeps them so where the path rises into a steep neck
    const lv = o.level ? o.level(u) : 0;
    if (lv > 0) { const hz = V3(t.x, 0, t.z); if (hz.lengthSq() > 1e-12) t.lerp(hz.normalize(), lv).normalize(); }
    return t;
  };
  const us = [], C = [], T = [];
  const KK = closed ? K - 1 : K;
  for (let k = 0; k <= KK; k++) {
    const u = closed ? k / K : u0 + (u1 - u0) * dist(k / K);
    us.push(u); C.push(curve.getPointAt(clamp(u, 0, 1))); T.push(tangentAt(u));
  }
  const hint = vec(o.up || [0, 1, 0]);
  let up = hint.clone().addScaledVector(T[0], -hint.dot(T[0]));
  if (up.lengthSq() < 1e-8) { up = Math.abs(T[0].z) < 0.9 ? V3(0, 0, 1) : V3(0, 1, 0); up.addScaledVector(T[0], -up.dot(T[0])); }
  up.normalize();
  const Ups = [], Sides = [], q = new THREE.Quaternion();
  for (let k = 0; k < us.length; k++) {
    if (k > 0) { q.setFromUnitVectors(T[k - 1], T[k]); up.applyQuaternion(q); up.addScaledVector(T[k], -up.dot(T[k])).normalize(); }
    const uu = up.clone(), ss = new THREE.Vector3().crossVectors(uu, T[k]).normalize();
    const r = ROLL(us[k]);
    if (r) { uu.applyAxisAngle(T[k], r); ss.applyAxisAngle(T[k], r); }
    Ups.push(uu); Sides.push(ss);
  }
  const rows = [];
  for (let k = 0; k < us.length; k++) {
    const u = us[k], w = W(u), ht = HT(u), hb = HB(u), nt = NT(u), nb = NB(u), oy = OY(u), ox = OX(u), row = [];
    for (let j = 0; j < R; j++) {
      const a = (j / R) * TAU;
      let [x, y] = sePoint(a, w, ht, hb, nt, nb);
      if (bump) { const f = 1 + bump(u, a, x, y); x *= f; y *= f; }
      // Digital Diorama extension: `sect` reshapes a section in its own plane (the torso's keeled chest,
      // hanging belly and flat croup), returning the new [side, up] offsets
      if (o.sect) [x, y] = o.sect(u, a, x, y, ht, hb);
      row.push(C[k].clone().addScaledVector(Sides[k], x + ox).addScaledVector(Ups[k], y + oy));
    }
    rows.push(row);
  }
  if (!closed && o.antifold !== false) for (let k = 1; k < rows.length; k++) {
    const step = C[k].distanceTo(C[k - 1]) * 0.18;
    for (let j = 0; j < R; j++) {
      const d = rows[k][j].clone().sub(rows[k - 1][j]).dot(T[k]);
      if (d < step) rows[k][j].addScaledVector(T[k], step - d);
    }
  }
  const g = { rows, us: us.slice(), R, closed, C, T, Ups, Sides, tip0: null, tip1: null, main: [0, rows.length - 1], len };
  if (!closed) {
    const mkCap = (k, sign, spec) => {
      const base = rows[k], ctr = base.reduce((s, p) => s.add(p), V3()).divideScalar(R);
      const Td = T[k].clone().multiplyScalar(sign);
      let rm = 0; for (const p of base) rm += p.distanceTo(ctr); rm /= R;
      if (spec.type === 'open') return { rings: [], tip: null };
      if (spec.type === 'flat') return { rings: [], tip: ctr };
      if (spec.type === 'point') return { rings: [], tip: ctr.clone().addScaledVector(Td, (spec.len ?? 1) * rm) };
      const n = Math.max(2, spec.n ?? 3), L = (spec.len ?? 1) * rm, rings = [];
      for (let i = 1; i < n; i++) {
        const phi = (i / n) * Math.PI / 2, sc = Math.cos(phi), off = Math.sin(phi) * L;
        rings.push(base.map(p => ctr.clone().addScaledVector(p.clone().sub(ctr), sc).addScaledVector(Td, off)));
      }
      return { rings, tip: ctr.clone().addScaledVector(Td, L) };
    };
    const a0 = mkCap(0, -1, capOf(o.cap0, { type: 'round', len: 0.8 })), a1 = mkCap(rows.length - 1, 1, capOf(o.cap1, { type: 'round', len: 0.8 }));
    const pre = a0.rings.slice().reverse(), post = a1.rings;
    g.rows = [...pre, ...rows, ...post];
    g.us = [...pre.map(() => us[0]), ...us, ...post.map(() => us[us.length - 1])];
    g.main = [pre.length, pre.length + rows.length - 1];
    g.tip0 = a0.tip; g.tip1 = a1.tip;
  }
  /** Surface query on the main rows: point & outward normal at (u, a). */
  g.at = (u, a) => {
    const [m0, m1] = g.main, R_ = g.R;
    let k = m0; while (k < m1 - 1 && g.us[k + 1] < u) k++;
    const span = (g.us[k + 1] - g.us[k]) || 1, t = clamp((u - g.us[k]) / span, 0, 1);
    const fa = ((a / TAU) % 1 + 1) % 1 * R_, j0 = Math.floor(fa) % R_, j1 = (j0 + 1) % R_, ta = fa - Math.floor(fa);
    const P = (kk, jj) => g.rows[kk][jj];
    const pt = (kk) => P(kk, j0).clone().lerp(P(kk, j1), ta);
    const p = pt(k).lerp(pt(Math.min(k + 1, m1)), t);
    const du = pt(Math.min(k + 1, m1)).sub(pt(k));
    const ja = (j0 + R_ - 1) % R_, jb = (j1 + 1) % R_;
    const da = P(k, jb).clone().lerp(P(Math.min(k + 1, m1), jb), t).sub(P(k, ja).clone().lerp(P(Math.min(k + 1, m1), ja), t));
    const n = new THREE.Vector3().crossVectors(da, du);
    if (n.lengthSq() < 1e-20) n.copy(p).sub(g.C[Math.min(k - m0, g.C.length - 1)] || p);
    return { p, n: n.normalize(), t: g.T[clamp(k - m0, 0, g.T.length - 1)].clone() };
  };
  /** Centre and frame at u (main stations, interpolated). */
  g.frame = (u) => {
    let k = 0; while (k < us.length - 2 && us[k + 1] < u) k++;
    const t = clamp((u - us[k]) / ((us[k + 1] - us[k]) || 1), 0, 1);
    return { c: C[k].clone().lerp(C[k + 1], t), t: T[k].clone().lerp(T[k + 1], t).normalize(), up: Ups[k].clone().lerp(Ups[k + 1], t).normalize(), side: Sides[k].clone().lerp(Sides[k + 1], t).normalize() };
  };
  return g;
}

/** Emits a loft grid into a part. zone: key | fn(u, a, centroid); skin: weights | fn(u, a, P). */
function emit(part, g, zone, skin) {
  const zf = typeof zone === 'function' ? zone : () => zone;
  const sf = typeof skin === 'function' ? skin : () => skin;
  const rows = g.rows, us = g.us, R = g.R, nr = rows.length;
  const Wt = rows.map((row, k) => row.map((P, j) => sf(us[k], (j / R) * TAU, P)));
  // Digital Diorama revision: a painted loft becomes a coat-atlas patch (see COAT ATLAS)
  const pt = part.coat && typeof zone === 'function' ? loftPatch(g, zf) : null, T = pt && pt.t, L0 = pt ? pt.lead : 0;
  const ctr = V3();
  const kEnd = g.closed ? nr : nr - 1;
  for (let k = 0; k < kEnd; k++) {
    const k1 = (k + 1) % nr, um = g.closed && k1 === 0 ? (us[k] + 1) / 2 : (us[k] + us[k1]) / 2;
    const t0 = pt ? T[k + L0] : 0, t1 = pt ? T[k + 1 + L0] : 0;
    for (let j = 0; j < R; j++) {
      const j1 = (j + 1) % R, A = rows[k][j], B = rows[k1][j], Cc = rows[k1][j1], D = rows[k][j1], s0 = j / R, s1 = (j + 1) / R;
      ctr.copy(A).add(B).add(Cc).add(D).multiplyScalar(0.25);
      const zn = zf(um, ((j + 0.5) / R) * TAU, ctr);
      part.tri(A, Cc, B, zn, Wt[k][j], Wt[k1][j1], Wt[k1][j], pt && [s0, t0, s1, t1, s0, t1], pt);
      part.tri(A, D, Cc, zn, Wt[k][j], Wt[k][j1], Wt[k1][j1], pt && [s0, t0, s1, t0, s1, t1], pt);
    }
  }
  const fan = (tip, row, u, start, ws, tTip, tRow) => {
    const wt = sf(u, 0, tip);
    for (let j = 0; j < R; j++) {
      const j1 = (j + 1) % R, s0 = j / R, s1 = (j + 1) / R, sm = (j + 0.5) / R;
      ctr.copy(tip).add(row[j]).add(row[j1]).multiplyScalar(1 / 3);
      const zn = zf(u, ((j + 0.5) / R) * TAU, ctr);
      if (start) part.tri(tip, row[j1], row[j], zn, wt, ws[j1], ws[j], pt && [sm, tTip, s1, tRow, s0, tRow], pt);
      else part.tri(tip, row[j], row[j1], zn, wt, ws[j], ws[j1], pt && [sm, tTip, s0, tRow, s1, tRow], pt);
    }
  };
  if (!g.closed && g.tip0) fan(g.tip0, rows[0], us[0], true, Wt[0], pt ? T[0] : 0, pt ? T[L0] : 0);
  if (!g.closed && g.tip1) fan(g.tip1, rows[nr - 1], us[nr - 1], false, Wt[nr - 1], pt ? T[T.length - 1] : 0, pt ? T[nr - 1 + L0] : 0);
  return g;
}

/** Ellipsoid as a lofted body (cosine-spaced rings, closed poles). axis: direction of rz. */
function ellipsoid(center, rx, ry, rz, axis = [0, 0, 1], up = [0, 1, 0], seg = 8, rad = 10, bump = null) {
  const c = vec(center), ax = vec(axis).normalize();
  const s = (u) => 2 * Math.sqrt(Math.max(0, u * (1 - u)));
  return loft({
    pts: [c.clone().addScaledVector(ax, -rz), c.clone().addScaledVector(ax, rz)], seg, rad, up,
    dist: (t) => (1 - Math.cos(Math.PI * t)) / 2, w: (u) => rx * s(u), ht: (u) => ry * s(u), hb: (u) => ry * s(u),
    cap0: 'open', cap1: 'open', bend: 0, antifold: false, bump,
  });
}
/** Tapered round tube through points. r: number | fn(u). */
function tube(pts, r, seg = 10, rad = 6, o = {}) {
  const R = asFn(r, 0.01);
  return loft({ pts, seg, rad, w: R, ht: R, hb: R, cap0: o.cap0 ?? { type: 'round', len: 0.6, n: 2 }, cap1: o.cap1 ?? { type: 'round', len: 0.6, n: 2 }, up: o.up || [0, 1, 0], bend: o.bend ?? 0.5, ...o });
}

/**
 * Thickened parametric membrane (ears, fins, webs, wings, frills, feathers, sails).
 * f(u, v) → Vector3 on the mid-surface; th(u, v) total thickness. Front faces follow du × dv.
 */
function sheet(part, o) {
  const nu = Math.max(1, Math.round(o.nu || 6)), nv = Math.max(1, Math.round(o.nv || 4));
  const TH = typeof o.th === 'function' ? o.th : () => (o.th ?? 0.004);
  const zf = typeof o.zone === 'function' ? o.zone : (u, v, face) => (face < 0 && o.zoneBack ? o.zoneBack : o.zone);
  const sf = typeof o.skin === 'function' ? o.skin : () => o.skin;
  const P = [], F = [], B = [], Wt = [];
  for (let i = 0; i <= nu; i++) { P.push([]); for (let j = 0; j <= nv; j++) P[i].push(o.f(i / nu, j / nv)); }
  const hint = o.normal ? vec(o.normal) : null;
  for (let i = 0; i <= nu; i++) {
    F.push([]); B.push([]); Wt.push([]);
    for (let j = 0; j <= nv; j++) {
      const du = P[Math.min(i + 1, nu)][j].clone().sub(P[Math.max(i - 1, 0)][j]);
      const dv = P[i][Math.min(j + 1, nv)].clone().sub(P[i][Math.max(j - 1, 0)]);
      let n = new THREE.Vector3().crossVectors(du, dv);
      if (n.lengthSq() < 1e-24) n = hint ? hint.clone() : V3(0, 1, 0);
      n.normalize();
      const t = TH(i / nu, j / nv) / 2;
      F[i].push(P[i][j].clone().addScaledVector(n, t)); B[i].push(P[i][j].clone().addScaledVector(n, -t));
      Wt[i].push(sf(i / nu, j / nv, P[i][j]));
    }
  }
  // Digital Diorama revision: a painted membrane becomes two coat-atlas patches, one per face
  const pF = part.coat && typeof o.zone === 'function' ? sheetPatch(F, zf, 1) : null, pB = pF && sheetPatch(B, zf, -1);
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const um = (i + 0.5) / nu, vm = (j + 0.5) / nv, zF = zf(um, vm, 1), zB = zf(um, vm, -1);
    const w = [Wt[i][j], Wt[i + 1][j], Wt[i + 1][j + 1], Wt[i][j + 1]];
    const sa = j / nv, sb = (j + 1) / nv, fa = pF ? pF.t[i] : 0, fb = pF ? pF.t[i + 1] : 0, ba = pB ? pB.t[i] : 0, bb = pB ? pB.t[i + 1] : 0;
    part.tri(F[i][j], F[i + 1][j], F[i + 1][j + 1], zF, w[0], w[1], w[2], pF && [sa, fa, sa, fb, sb, fb], pF);
    part.tri(F[i][j], F[i + 1][j + 1], F[i][j + 1], zF, w[0], w[2], w[3], pF && [sa, fa, sb, fb, sb, fa], pF);
    part.tri(B[i][j], B[i + 1][j + 1], B[i + 1][j], zB, w[0], w[2], w[1], pB && [sa, ba, sb, bb, sa, bb], pB);
    part.tri(B[i][j], B[i][j + 1], B[i + 1][j + 1], zB, w[0], w[3], w[2], pB && [sa, ba, sb, ba, sb, bb], pB);
  }
  const edge = (a0, a1, b0, b1, wa, wb, zn) => { part.tri(a0, b0, b1, zn, wa, wa, wb); part.tri(a0, b1, a1, zn, wa, wb, wb); };
  for (let i = 0; i < nu; i++) {
    edge(F[i][0], F[i + 1][0], B[i][0], B[i + 1][0], Wt[i][0], Wt[i + 1][0], zf((i + 0.5) / nu, 0, 0));
    edge(B[i][nv], B[i + 1][nv], F[i][nv], F[i + 1][nv], Wt[i][nv], Wt[i + 1][nv], zf((i + 0.5) / nu, 1, 0));
  }
  for (let j = 0; j < nv; j++) {
    edge(B[0][j], B[0][j + 1], F[0][j], F[0][j + 1], Wt[0][j], Wt[0][j + 1], zf(0, (j + 0.5) / nv, 0));
    edge(F[nu][j], F[nu][j + 1], B[nu][j], B[nu][j + 1], Wt[nu][j], Wt[nu][j + 1], zf(1, (j + 0.5) / nv, 0));
  }
  return { P, F, B };
}

/** Orthonormal frame helpers. */
function basisFrom(fwd, upHint = [0, 1, 0]) {
  const f = vec(fwd).normalize();
  let u = vec(upHint); u.addScaledVector(f, -u.dot(f));
  if (u.lengthSq() < 1e-10) { u = Math.abs(f.y) < 0.9 ? V3(0, 1, 0) : V3(0, 0, 1); u.addScaledVector(f, -u.dot(f)); }
  u.normalize();
  const s = new THREE.Vector3().crossVectors(u, f).normalize();
  return { f, u, s };
}
/** Rotates vector v about axis by angle (radians), returning a new vector. */
const rot = (v, axis, a) => vec(v).applyAxisAngle(vec(axis).normalize(), a);

/** Point on a loft surface whose direction from c best matches dir (coarse search + refinement). */
function surfaceToward(g, c, dir, s0, s1) {
  let best = null, bd = -2;
  const test = (s, a) => { const r = g.at(s, a), d = r.p.clone().sub(c).normalize().dot(dir); if (d > bd) { bd = d; best = { ...r, s, a }; } };
  for (let i = 0; i <= 24; i++) for (let j = 0; j < 40; j++) test(lerp(s0, s1, i / 24), (j / 40) * TAU);
  const ds = (s1 - s0) / 24, da = TAU / 40, b0 = { ...best };
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) test(clamp(b0.s + i * ds / 3, s0, s1), b0.a + j * da / 3);
  return best;
}
/** Tapered cone spike from p along dir (spines, teeth, thorns, claws). */
function spike(part, p, dir, h, r, zone, W, rad = 4) {
  const g = tube([p.clone().addScaledVector(dir, -h * 0.25), p.clone().addScaledVector(dir, h)], (u) => r * (1 - u), 2, rad, { cap0: 'flat', cap1: 'point', bend: 0 });
  emit(part, g, zone, W);
}

/* ── skeleton: rest bones carry identity rotation, so clip angles are world-aligned ── */
class Rig {
  constructor() { this.list = []; this.by = {}; }
  add(name, parent, head, tail = null) {
    const bone = new THREE.Bone(); bone.name = name;
    const h = vec(head), par = parent ? this.by[parent] : null;
    if (parent && !par) throw new Error(`Unknown parent bone ${parent}`);
    bone.position.copy(par ? h.clone().sub(par.head) : h);
    if (par) par.bone.add(bone);
    const e = { name, bone, head: h, tail: tail ? vec(tail) : null, parent: par, kids: [], index: this.list.length };
    if (par) par.kids.push(e);
    this.list.push(e); this.by[name] = e;
    return e;
  }
  has(n) { return !!this.by[n]; }
  i(n) { const e = this.by[n]; if (!e) throw new Error(`Unknown bone ${n}`); return e.index; }
  head(n) { return this.by[n].head.clone(); }
  tailOf(e) {
    if (e.tail) return e.tail;
    if (e.kids.length) return e.kids.reduce((s, k) => s.add(k.head), V3()).divideScalar(e.kids.length);
    return e.head.clone().add(V3(0, 0.01, 0));
  }
  /** Rigid weight to one bone. */
  W(n) { return [[this.i(n), 1]]; }
  /** Two-bone blend (t = weight of b). */
  W2(a, b, t) { t = clamp(t, 0, 1); return normW([[this.i(a), 1 - t], [this.i(b), t]]); }
  /**
   * Partition-of-unity chain weights along a sweep parameter.
   * chain: [[boneName, uStart, blendHalfWidth], ...] ascending by uStart.
   */
  chain(chain, u) {
    const out = [];
    for (let j = 0; j < chain.length; j++) {
      const [n, a, ba] = chain[j];
      const lo = j === 0 ? 1 : sstep(a - ba, a + ba, u);
      const hi = j === chain.length - 1 ? 0 : sstep(chain[j + 1][1] - chain[j + 1][2], chain[j + 1][1] + chain[j + 1][2], u);
      const w = lo - hi;
      if (w > 1e-4) out.push([this.i(n), w]);
    }
    return normW(out.length ? out : [[this.i(chain[0][0]), 1]]);
  }
  /** Chain spec from bone names and their u positions; blend is a fraction of neighbouring spans. */
  spec(names, us, blend = 0.3) {
    return names.map((n, j) => {
      const prev = j > 0 ? us[j] - us[j - 1] : 1, next = j < us.length - 1 ? us[j + 1] - us[j] : prev;
      return [n, us[j], j === 0 ? 0 : Math.max(1e-4, blend * Math.min(prev, next))];
    });
  }
  /** Inverse-distance weights to bone segments (for attachments spanning several bones). */
  near(P, names, radius, sharp = 4) {
    const pool = [], d = V3();
    for (const n of names) {
      const e = this.by[n]; if (!e) continue;
      const a = e.head, b = this.tailOf(e);
      d.subVectors(b, a); const L2 = d.lengthSq();
      const t = L2 < 1e-14 ? 0 : clamp(((P.x - a.x) * d.x + (P.y - a.y) * d.y + (P.z - a.z) * d.z) / L2, 0, 1);
      const dist = P.distanceTo(a.clone().addScaledVector(d, t)) / Math.max(1e-6, radius);
      pool.push([e.index, 1 / (1e-4 + dist ** sharp)]);
    }
    return normW(pool);
  }
}
function normW(list) {
  const l = list.filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const tot = l.reduce((s, e) => s + e[1], 0) || 1;
  return l.map(e => [e[0], e[1] / tot]);
}
/** Blends two weight sets: (1-t)·A + t·B. */
function mixW(A, B, t) {
  const m = new Map();
  for (const [i, w] of A) m.set(i, (m.get(i) || 0) + w * (1 - t));
  for (const [i, w] of B) m.set(i, (m.get(i) || 0) + w * t);
  return normW([...m.entries()]);
}

/* ── clips & poses: samples are { Bone: [rx, ry, rz] degrees | { r: [...], p: [dx, dy, dz] } } ── */
const _e = new THREE.Euler(), _q = new THREE.Quaternion();
/** Bakes a clip from sample(u), 0..1, at `frames` even keys; with `refine`, also wherever the joints turn fast (see below). */
function bakeClip(info, name, duration, frames, sample, loop = true, refine = false) {
  const times = [], samples = [];
  let us = Array.from({ length: frames }, (_, i) => i / (frames - 1)), ss = us.map(u => sample(loop ? u % 1 : u) || {});
  if (loop) ss[frames - 1] = ss[0];
  // Digital Diorama revision 8: a key half way between two keys wherever the joints turn so fast between them (a leg near
  // full stretch at the end of a gallop's stance swung its thigh 22° in one key) that interpolating their rotations moves
  // a planted foot off its place (a giraffe's sank 2 cm); up to three times, so a fast stretch gets up to seven keys more
  if (refine) {
    // intervals to check: every one at first, then only the halves of those just split
    let todo = us.slice(0, -1).map((_, i) => i);
    for (let pass = 0; pass < 3 && todo.length; pass++) {
      const add = [];
      for (const i of todo) { const m = (us[i] + us[i + 1]) / 2, sm = sample(loop ? m % 1 : m) || {}; if (sampleGap(info, ss[i], ss[i + 1], sm) > 1.5) add.push([i, m, sm]); }
      // insert from the end so the earlier indices stay valid, and list the two halves for the next pass
      const next = [];
      for (let k = add.length - 1; k >= 0; k--) { const [i, m, sm] = add[k]; us.splice(i + 1, 0, m); ss.splice(i + 1, 0, sm); }
      add.forEach(([i], k) => { const at = i + k; next.push(at, at + 1); });
      todo = next;
    }
  }
  for (let i = 0; i < us.length; i++) { times.push(us[i] * duration); samples.push(ss[i]); }
  const tracks = [];
  for (const b of info.bones) {
    const rq = [], pv = [];
    let hasP = info.moving.includes(b);
    for (const s of samples) {
      const v = s[b], r = !v ? null : Array.isArray(v) ? v : v.r;
      _e.set((r ? r[0] : 0) * DEG, (r ? r[1] : 0) * DEG, (r ? r[2] : 0) * DEG, 'YXZ');
      _q.setFromEuler(_e); rq.push(_q.x, _q.y, _q.z, _q.w);
      const p = v && !Array.isArray(v) ? v.p : null;
      if (p) hasP = true;
      const rest = info.rest[b];
      pv.push(rest[0] + (p ? p[0] : 0), rest[1] + (p ? p[1] : 0), rest[2] + (p ? p[2] : 0));
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, times, rq));
    if (hasP) tracks.push(new THREE.VectorKeyframeTrack(`${b}.position`, times, pv));
    if ((info.scaled || []).includes(b)) tracks.push(new THREE.VectorKeyframeTrack(`${b}.scale`, times, samples.flatMap(s => { const v = s[b], k = v && !Array.isArray(v) && v.s !== undefined ? v.s : 1; return [k, k, k]; })));
  }
  const clip = new THREE.AnimationClip(name, duration, tracks);
  clip.userData = { loop };
  return clip;
}
/** The most any bone's rotation in sample `m` differs (degrees) from half way between samples `a` and `b`. */
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qm = new THREE.Quaternion();
function sampleGap(info, a, b, m) {
  const quat = (s, n, q) => { const v = s[n], r = !v ? null : Array.isArray(v) ? v : v.r; _e.set((r ? r[0] : 0) * DEG, (r ? r[1] : 0) * DEG, (r ? r[2] : 0) * DEG, 'YXZ'); return q.setFromEuler(_e); };
  let worst = 0;
  for (const n of info.bones) { quat(a, n, _qa).slerp(quat(b, n, _qb), 0.5); worst = Math.max(worst, _qa.angleTo(quat(m, n, _qm)) / DEG); }
  return worst;
}
function applySample(rig, sample) {
  for (const e of rig.list) {
    const v = sample[e.name], r = !v ? null : Array.isArray(v) ? v : v.r, p = v && !Array.isArray(v) ? v.p : null;
    _e.set((r ? r[0] : 0) * DEG, (r ? r[1] : 0) * DEG, (r ? r[2] : 0) * DEG, 'YXZ');
    e.bone.quaternion.setFromEuler(_e);
    const rest = e.parent ? e.head.clone().sub(e.parent.head) : e.head.clone();
    e.bone.position.copy(rest);
    if (p) e.bone.position.add(V3(p[0], p[1], p[2]));
    const sc = v && !Array.isArray(v) && v.s !== undefined ? v.s : 1;
    e.bone.scale.set(sc, sc, sc);
  }
}

/* ── shared materials (vertex colours, flat shading, double sided membranes) ── */
/* ════════════════════════════════════════════════════════════════════════════
 *  COAT ATLAS  (Digital Diorama revision — shared verbatim by the mammal and bird rigs)
 *  Painters used to be sampled once per quad, so stripes, spots, masks and patch
 *  edges followed the mesh grid in staircases. Every painted loft and membrane now
 *  records its grid as a patch; finish() paints each patch into one texture per
 *  asset at an even texel size (adaptive sampling, softened edges and a faint coat
 *  grain on fur and feathers) and the triangles carry UVs into it. Parts with one
 *  constant colour keep plain vertex colours. Normals are smoothed across faces
 *  (keeping creases sharper than COAT_CREASE degrees).
 * ════════════════════════════════════════════════════════════════════════════ */
const COAT_RES = { draft: 300, standard: 420, high: 560 }; // texels across the model's bounding diagonal
const COAT_PAD = 2, COAT_BLOCK = 4, COAT_CREASE = 62, COAT_MAX = 2048;

/** A paintable grid of points grid[row][col]; `wrap` closes the columns into rings (lofts). */
function makePatch(grid, wrap, zoneAt) {
  const K = grid.length - 1, J = wrap ? grid[0].length : grid[0].length - 1;
  const at = wrap ? (row, j) => row[j % row.length] : (row, j) => row[j];
  const t = [0];
  let len = 0, per = 0;
  for (let k = 1; k <= K; k++) {
    let d = 0;
    for (let j = 0; j <= (wrap ? J - 1 : J); j++) d += grid[k][j].distanceTo(grid[k - 1][j]);
    len += d / (wrap ? J : J + 1); t.push(len);
  }
  for (let k = 0; k <= K; k++) t[k] = len > 1e-12 ? t[k] / len : k / Math.max(1, K);
  for (let k = 0; k <= K; k++) { let p = 0; for (let j = 0; j < J; j++) p += at(grid[k], j + 1).distanceTo(grid[k][j]); per = Math.max(per, p); }
  return { grid, wrap, K, J, t, len, per, zoneAt, at };
}
/** Patch over a loft, its capped tips added as degenerate rows (`lead` = rows before the loft's own). */
function loftPatch(g, zf) {
  const R = g.R, rows = g.rows.slice(), us = g.us.slice();
  const lead = !g.closed && g.tip0 ? 1 : 0;
  if (lead) { rows.unshift(new Array(R).fill(g.tip0)); us.unshift(us[0]); }
  if (!g.closed && g.tip1) { rows.push(new Array(R).fill(g.tip1)); us.push(us[us.length - 1]); }
  if (g.closed) { rows.push(rows[0]); us.push(1); }
  const p = makePatch(rows, true, (s, k, f, P) => zf(lerp(us[k], us[k + 1], f), s * TAU, P));
  p.lead = lead;
  return p;
}
/** Patch over one face of a membrane (rows along u, columns along v). */
function sheetPatch(G, zf, face) {
  const nu = G.length - 1;
  return makePatch(G, false, (s, k, f, P) => zf((k + f) / nu, s, face, P));
}

/** Paints every patch used by `parts` into one atlas; returns the texture and each patch's tile. */
function paintAtlas(parts, cfg, hexOf) {
  const patches = [], seen = new Set();
  for (const part of parts) for (const pt of part.pt) if (pt && !seen.has(pt)) { seen.add(pt); pt.k = part.coatK || 1; pt.gloss = part.name === 'eyes' ? 0.2 : 1; patches.push(pt); }
  if (!patches.length) return null;
  const mn = V3(Infinity, Infinity, Infinity), mx = V3(-Infinity, -Infinity, -Infinity), q = V3();
  for (const part of parts) for (let i = 0; i < part.p.length; i += 3) { q.set(part.p[i], part.p[i + 1], part.p[i + 2]); mn.min(q); mx.max(q); }
  // texel size: from a reference length when the rig gives one (birds: the body, since the spread wings that
  // are hidden while perched would otherwise set it), else from the bounding diagonal
  const D = cfg.ref ?? Math.max(1e-6, mx.distanceTo(mn));
  let tau = D / (cfg.res || 420), AW = 256, AH = 0, place = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    let area = 0;
    for (const pt of patches) {
      pt.tw = clamp(Math.ceil(pt.per / (tau * pt.k)), 2, COAT_MAX - 2 * COAT_PAD);
      pt.th = clamp(Math.ceil(pt.len / (tau * pt.k)), 2, COAT_MAX - 2 * COAT_PAD);
      area += (pt.tw + 2 * COAT_PAD) * (pt.th + 2 * COAT_PAD);
    }
    AW = clamp(2 ** Math.ceil(Math.log2(Math.sqrt(area * 1.2) + 1)), 128, COAT_MAX);
    const items = [{ tw: 4, th: 4, white: true }, ...patches.slice().sort((a, b) => b.th - a.th)];
    let x = 0, y = 0, sh = 0;
    place = new Map();
    for (const it of items) {
      it.tw = Math.min(it.tw, AW - 2 * COAT_PAD);
      const W = it.tw + 2 * COAT_PAD, H = it.th + 2 * COAT_PAD;
      if (x + W > AW) { x = 0; y += sh; sh = 0; }
      place.set(it, { x: x + COAT_PAD, y: y + COAT_PAD, w: it.tw, h: it.th });
      x += W; sh = Math.max(sh, H);
    }
    AH = Math.ceil((y + sh) / 4) * 4;
    if (AH <= COAT_MAX) break;
    tau *= 1.3;
  }
  const data = new Uint8Array(AW * AH * 4).fill(255);
  const f1 = 1 / (tau * 2.4), f2 = 1 / (D * 0.045), grain = cfg.grain ?? 0.06;
  const cache = new Map();
  const shade = (z, P, out, o) => {
    let c = cache.get(z);
    if (!c) { const h = hexOf(z); c = [(h >> 16) & 255, (h >> 8) & 255, h & 255, cfg.grainOf && cfg.grainOf(z) ? 1 : 0]; cache.set(z, c); }
    let m = 1;
    if (c[3] && grain > 0) m = 1 + grain * ((0.6 * vnoise(P.x * f1, P.y * f1, P.z * f1 * 0.4, 17) + 0.4 * vnoise(P.x * f2, P.y * f2, P.z * f2, 29)) - 0.5) * 2;
    out[o] = c[0] * m; out[o + 1] = c[1] * m; out[o + 2] = c[2] * m;
  };
  for (const pt of patches) paintPatch(pt, place.get(pt), data, AW, shade, cfg.soft !== false, cfg.crease);
  let white = null;
  for (const [it, pl] of place) if (it.white) white = [(pl.x + 2) / AW, (pl.y + 2) / AH];
  const tex = new THREE.DataTexture(data, AW, AH, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.flipY = false;
  tex.name = 'coat-atlas';
  tex.needsUpdate = true;
  const tiles = new Map();
  for (const pt of patches) tiles.set(pt, place.get(pt));
  return { tex, tiles, AW, AH, white, texels: AW * AH };
}

/** Rasterises one patch's painter into its tile (lattice-sampled; uniform blocks skip the painter). */
/**
 * Digital Diorama revision 8: a periodic 2D net of creases (the cell edges of a jittered grid, Worley f2 - f1), exact and
 * built once. paintPatch draws it over a patch's texels for creased skin (`cfg.crease`: elephants): a patch's texels are
 * laid out at an even spacing over the surface, so the net needs no 3D noise per texel, only one read.
 */
const CREASE_TILE = 128, CREASE_CELLS = 10;
let CREASE2 = null;
function creaseTile() {
  if (CREASE2) return CREASE2;
  const N = CREASE_TILE, C = CREASE_CELLS, F = new Float32Array(N * N), wr = (i) => ((i % C) + C) % C;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const px = ((x + 0.5) / N) * C, py = ((y + 0.5) / N) * C, cx = Math.floor(px), cy = Math.floor(py);
    let f1 = 9, f2 = 9;
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
      const i = cx + dx, j = cy + dy, d = Math.hypot(i + 0.1 + 0.8 * hash3(wr(i), wr(j), 0, 81) - px, j + 0.1 + 0.8 * hash3(wr(i), wr(j), 0, 82) - py);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    F[y * N + x] = f2 - f1;
  }
  return (CREASE2 = F);
}

function paintPatch(pt, tile, data, AW, shade, soft, crease = null) {
  const { grid, K, J, t, at, zoneAt, wrap } = pt, { x: X0, y: Y0, w, h } = tile, A = Math.round(255 * (pt.gloss ?? 1));
  const rowK = new Int32Array(h), rowF = new Float32Array(h), colJ = new Int32Array(w), colF = new Float32Array(w);
  let k = 0;
  for (let y = 0; y < h; y++) {
    const tt = (y + 0.5) / h;
    while (k < K - 1 && t[k + 1] < tt) k++;
    rowK[y] = k; rowF[y] = clamp((tt - t[k]) / ((t[k + 1] - t[k]) || 1), 0, 1);
  }
  for (let x = 0; x < w; x++) { const c = ((x + 0.5) / w) * J, j = Math.min(J - 1, Math.floor(c)); colJ[x] = j; colF[x] = c - j; }
  const P = V3();
  const pos = (x, y) => {
    const r0 = grid[rowK[y]], r1 = grid[rowK[y] + 1], j = colJ[x], fs = colF[x], ft = rowF[y];
    const a = at(r0, j), b = at(r0, j + 1), c = at(r1, j), d = at(r1, j + 1);
    const w00 = (1 - fs) * (1 - ft), w10 = fs * (1 - ft), w01 = (1 - fs) * ft, w11 = fs * ft;
    P.set(a.x * w00 + b.x * w10 + c.x * w01 + d.x * w11, a.y * w00 + b.y * w10 + c.y * w01 + d.y * w11, a.z * w00 + b.z * w10 + c.z * w01 + d.z * w11);
  };
  const zoneOf = (x, y) => { pos(x, y); return zoneAt((x + 0.5) / w, rowK[y], rowF[y], P); };
  const B = COAT_BLOCK, cw = Math.ceil(w / B), ch = Math.ceil(h / B), lw = cw + 1;
  const lat = new Array(lw * (ch + 1));
  for (let cy = 0; cy <= ch; cy++) for (let cx = 0; cx <= cw; cx++) lat[cy * lw + cx] = zoneOf(Math.min(cx * B, w - 1), Math.min(cy * B, h - 1));
  const rgb = new Float32Array(w * h * 3);
  // creases (see creaseTile): cells about `crease.cell` texels across; round a loft a whole number of tiles, so the net
  // closes on itself; offset per patch
  let ct = null, sx = 1, sy = 1, ox = 0, oy = 0, cwid = 0, cdark = 1;
  if (crease) {
    ct = creaseTile(); const N = CREASE_TILE, s = (N / CREASE_CELLS) / crease.cell;
    sy = s; sx = wrap ? (N * Math.max(1, Math.round((w * s) / N))) / w : s;
    ox = (pt.K * 37 + pt.J * 11) % N; oy = (pt.K * 13 + pt.J * 29) % N; cwid = crease.width; cdark = crease.dark;
  }
  for (let by = 0; by < ch; by++) for (let bx = 0; bx < cw; bx++) {
    const z = lat[by * lw + bx], uni = z === lat[by * lw + bx + 1] && z === lat[(by + 1) * lw + bx] && z === lat[(by + 1) * lw + bx + 1];
    for (let y = by * B; y < Math.min(h, by * B + B); y++) for (let x = bx * B; x < Math.min(w, bx * B + B); x++) {
      let zz = z;
      if (uni) pos(x, y); else zz = zoneOf(x, y);
      shade(zz, P, rgb, (y * w + x) * 3);
      if (ct && crease.zones.includes(zz) && ct[((Math.floor(y * sy) + oy) % CREASE_TILE) * CREASE_TILE + ((Math.floor(x * sx) + ox) % CREASE_TILE)] < cwid) {
        const o = (y * w + x) * 3; rgb[o] *= cdark; rgb[o + 1] *= cdark; rgb[o + 2] *= cdark;
      }
    }
  }
  if (soft && w > 2 && h > 2) {
    // a 1-2-1 blur softens zone edges by about a texel, like fur or feather margins
    const tmp = new Float32Array(rgb.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const xl = x > 0 ? x - 1 : wrap ? w - 1 : 0, xr = x < w - 1 ? x + 1 : wrap ? 0 : w - 1;
      for (let c = 0; c < 3; c++) tmp[(y * w + x) * 3 + c] = 0.25 * rgb[(y * w + xl) * 3 + c] + 0.5 * rgb[(y * w + x) * 3 + c] + 0.25 * rgb[(y * w + xr) * 3 + c];
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const yu = Math.max(0, y - 1), yd = Math.min(h - 1, y + 1);
      for (let c = 0; c < 3; c++) rgb[(y * w + x) * 3 + c] = 0.25 * tmp[(yu * w + x) * 3 + c] + 0.5 * tmp[(y * w + x) * 3 + c] + 0.25 * tmp[(yd * w + x) * 3 + c];
    }
  }
  for (let y = -COAT_PAD; y < h + COAT_PAD; y++) for (let x = -COAT_PAD; x < w + COAT_PAD; x++) {
    const sx = wrap ? ((x % w) + w) % w : clamp(x, 0, w - 1), sy = clamp(y, 0, h - 1);
    const si = (sy * w + sx) * 3, di = ((Y0 + y) * AW + (X0 + x)) * 4;
    data[di] = clamp(Math.round(rgb[si]), 0, 255); data[di + 1] = clamp(Math.round(rgb[si + 1]), 0, 255); data[di + 2] = clamp(Math.round(rgb[si + 2]), 0, 255); data[di + 3] = A;
  }
}

/**
 * Gloss rides in the coat texture's alpha and scales the material's roughness, so wet eyes catch a highlight
 * without a second material (or draw call). Opaque materials ignore the alpha otherwise. Clones keep the hook.
 */
function coatGloss(m) {
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n#ifdef USE_MAP\n\troughnessFactor *= texture2D( map, vMapUv ).a;\n#endif'); };
  m.customProgramCacheKey = () => 'coat-gloss';
  const clone = m.clone.bind(m);
  m.clone = () => coatGloss(clone());
  return m;
}

/** Smooth vertex normals for non-indexed triangles: faces meeting at a point share a normal unless they crease more than `deg`. */
function smoothNormals(geo, deg = COAT_CREASE) {
  const pos = geo.attributes.position.array, n = pos.length / 3;
  geo.computeBoundingBox();
  const bb = geo.boundingBox, eps = Math.max(1e-9, bb.max.distanceTo(bb.min) * 2e-6);
  // (Digital Diorama revision 8: vertices are grouped by their quantised position through an integer hash with chains,
  // not string keys; the same groups, about three times faster. fn: each face's normal, un: its unit normal, both
  // stored in the slots of the face's first vertex)
  const fn = new Float32Array(n), un = new Float32Array(n), q = new Int32Array(n * 3), hs = new Int32Array(n), next = new Int32Array(n), head = new Map();
  for (let f = 0; f < n; f += 3) {
    const ax = pos[f * 3], ay = pos[f * 3 + 1], az = pos[f * 3 + 2];
    const ux = pos[f * 3 + 3] - ax, uy = pos[f * 3 + 4] - ay, uz = pos[f * 3 + 5] - az, vx = pos[f * 3 + 6] - ax, vy = pos[f * 3 + 7] - ay, vz = pos[f * 3 + 8] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
    fn[f] = nx; fn[f + 1] = ny; fn[f + 2] = nz; un[f] = nx / l; un[f + 1] = ny / l; un[f + 2] = nz / l;
  }
  for (let i = 0; i < n; i++) {
    const qx = Math.round(pos[i * 3] / eps), qy = Math.round(pos[i * 3 + 1] / eps), qz = Math.round(pos[i * 3 + 2] / eps);
    q[i * 3] = qx; q[i * 3 + 1] = qy; q[i * 3 + 2] = qz;
    const h = hs[i] = Math.imul(qx, 73856093) ^ Math.imul(qy, 19349663) ^ Math.imul(qz, 83492791), first = head.get(h);
    next[i] = first === undefined ? -1 : first; head.set(h, i);
  }
  const cosC = Math.cos(deg * DEG), nor = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const f = i - (i % 3), mx = un[f], my = un[f + 1], mz = un[f + 2], qx = q[i * 3], qy = q[i * 3 + 1], qz = q[i * 3 + 2];
    let sx = 0, sy = 0, sz = 0;
    for (let j = head.get(hs[i]); j !== -1; j = next[j]) {
      if (q[j * 3] !== qx || q[j * 3 + 1] !== qy || q[j * 3 + 2] !== qz) continue;
      const g = j - (j % 3);
      if (un[g] * mx + un[g + 1] * my + un[g + 2] * mz < cosC) continue;
      sx += fn[g]; sy += fn[g + 1]; sz += fn[g + 2];
    }
    const l = Math.hypot(sx, sy, sz);
    if (l > 1e-20) { nor[i * 3] = sx / l; nor[i * 3 + 1] = sy / l; nor[i * 3 + 2] = sz / l; } else { nor[i * 3] = mx; nor[i * 3 + 1] = my; nor[i * 3 + 2] = mz; }
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
}

/**
 * Digital Diorama revision 5: blends normals across the seams where limbs leave the body. Body and legs are
 * separate surfaces, so even where they meet smoothly their normals jump and the join shades as a hard crease.
 * Each vertex of either surface that lies within `radius` of the other bends its normal toward the nearest
 * vertex of the other one (half way at contact, none at the radius), so the shading runs on across the join.
 */
function blendSeamNormals(geoA, geoB, radius) {
  const pa = geoA.attributes.position.array, pb = geoB.attributes.position.array, na = geoA.attributes.normal.array, nb = geoB.attributes.normal.array;
  const inv = 1 / radius, r2 = radius * radius;
  const hk = (cx, cy, cz) => ((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) | 0;
  const boxOf = (p) => { const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { if (p[i + k] < b[k]) b[k] = p[i + k]; if (p[i + k] > b[k + 3]) b[k + 3] = p[i + k]; } return b; };
  const ba = boxOf(pa), bb = boxOf(pb);
  const inBox = (b, x, y, z) => x > b[0] - radius && x < b[3] + radius && y > b[1] - radius && y < b[4] + radius && z > b[2] - radius && z < b[5] + radius;
  // hash grid of one surface's vertices near the other surface's bounds
  const grid = (p, b) => { const m = new Map(); for (let i = 0; i < p.length; i += 3) { if (!inBox(b, p[i], p[i + 1], p[i + 2])) continue; const k = hk(Math.floor(p[i] * inv), Math.floor(p[i + 1] * inv), Math.floor(p[i + 2] * inv)); const l = m.get(k); if (l) l.push(i); else m.set(k, [i]); } return m; };
  const blend = (p, n, b, m, po, no) => {
    const out = n.slice(), memo = new Map();
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      if (!inBox(b, x, y, z)) continue;
      // non-indexed geometry repeats each position; search once per position
      const pk = `${x},${y},${z}`;
      let hit = memo.get(pk);
      if (hit === undefined) {
        let best = -1, bd = r2;
        const cx = Math.floor(x * inv), cy = Math.floor(y * inv), cz = Math.floor(z * inv);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          const l = m.get(hk(cx + dx, cy + dy, cz + dz)); if (!l) continue;
          for (const j of l) { const ex = po[j] - x, ey = po[j + 1] - y, ez = po[j + 2] - z, d = ex * ex + ey * ey + ez * ez; if (d < bd) { bd = d; best = j; } }
        }
        hit = best < 0 ? null : [best, Math.sqrt(bd)];
        memo.set(pk, hit);
      }
      if (!hit) continue;
      const [j, d] = hit;
      if (n[i] * no[j] + n[i + 1] * no[j + 1] + n[i + 2] * no[j + 2] < 0.2) continue;
      const w = 0.5 * (1 - d / radius) ** 2;
      const nx = n[i] * (1 - w) + no[j] * w, ny = n[i + 1] * (1 - w) + no[j + 1] * w, nz = n[i + 2] * (1 - w) + no[j + 2] * w, l = Math.hypot(nx, ny, nz) || 1;
      out[i] = nx / l; out[i + 1] = ny / l; out[i + 2] = nz / l;
    }
    return out;
  };
  const outA = blend(pa, na, bb, grid(pb, ba), pb, nb), outB = blend(pb, nb, ba, grid(pa, bb), pa, na);
  na.set(outA); nb.set(outB);
  geoA.attributes.normal.needsUpdate = true; geoB.attributes.normal.needsUpdate = true;
}

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82, metalness: 0.0, side: THREE.DoubleSide });
const GLASS_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });

/**
 * Converts accumulated parts into meshes.
 *   merge=true  → one mesh per material (1 solid + optional 1 glass draw call)
 *   merge=false → one selectable named mesh per anatomical part
 *   skinned     → SkinnedMesh bound to one shared skeleton (clips, poses, IK-ready)
 *   static      → pose baked into plain geometry, no skeleton
 */
function finish(build, opt) {
  const { name, merge, skinned, zones, pose } = opt;
  const root = new THREE.Group(); root.name = name;
  const rig = build.rig;
  const armature = new THREE.Object3D(); armature.name = 'Armature';
  for (const e of rig.list) if (!e.parent) armature.add(e.bone);
  root.add(armature);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(rig.list.map(e => e.bone));
  if (pose) applySample(rig, pose);
  root.updateMatrixWorld(true);
  let bake = null;
  if (!skinned) {
    skeleton.update();
    bake = rig.list.map((e, i) => new THREE.Matrix4().multiplyMatrices(e.bone.matrixWorld, skeleton.boneInverses[i]));
  }
  const colorCache = new Map();
  const colorOf = (z) => {
    if (!colorCache.has(z)) { const al = opt.alias || {}; const h = zones[z] ?? zones[al[z]] ?? zones[al[al[z]]] ?? zones[Object.keys(zones)[0]]; colorCache.set(z, new THREE.Color(h)); }
    return colorCache.get(z);
  };
  // Digital Diorama revision: painted patches go into one coat texture (see COAT ATLAS)
  const hexOfZone = (z) => { const al = opt.alias || {}; return zones[z] ?? zones[al[z]] ?? zones[al[al[z]]] ?? zones[Object.keys(zones)[0]]; };
  const coat = opt.coat ? paintAtlas(build.parts.filter(p => p.count > 0 && !p.glass), opt.coat, hexOfZone) : null;
  const smooth = !!(opt.coat && opt.coat.smooth !== false);
  const WHITE = new THREE.Color(1, 1, 1);
  const toGeo = (part) => {
    const n = part.count, geo = new THREE.BufferGeometry(), col = new Float32Array(n * 3);
    let pos = new Float32Array(part.p);
    const uv = coat && !part.glass ? new Float32Array(n * 2) : null;
    for (let t = 0; t < n / 3; t++) {
      const tile = uv && part.pt[t] ? coat.tiles.get(part.pt[t]) : null;
      const c = tile ? WHITE : colorOf(part.z[t]);
      for (let k = 0; k < 3; k++) {
        const o = (t * 3 + k) * 3; col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
        if (!uv) continue;
        const i = (t * 3 + k) * 2;
        if (tile) { uv[i] = (tile.x + part.uv[i] * tile.w) / coat.AW; uv[i + 1] = (tile.y + part.uv[i + 1] * tile.h) / coat.AH; }
        else { uv[i] = coat.white[0]; uv[i + 1] = coat.white[1]; }
      }
    }
    if (bake) {
      const v = V3(), acc = V3(), tmp = V3();
      for (let i = 0; i < n; i++) {
        v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); acc.set(0, 0, 0);
        for (let k = 0; k < 4; k++) { const w = part.sw[i * 4 + k]; if (w > 0) acc.addScaledVector(tmp.copy(v).applyMatrix4(bake[part.si[i * 4 + k]]), w); }
        pos[i * 3] = acc.x; pos[i * 3 + 1] = acc.y; pos[i * 3 + 2] = acc.z;
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (skinned) {
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(part.si, 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(part.sw, 4));
    }
    if (smooth && !part.glass) smoothNormals(geo); else geo.computeVertexNormals();
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    return geo;
  };
  const meshOf = (geo, mat, nm, data) => {
    const m = skinned ? new THREE.SkinnedMesh(geo, mat) : new THREE.Mesh(geo, mat);
    m.name = nm; m.castShadow = mat !== GLASS_MAT; m.receiveShadow = true; m.userData = data;
    if (skinned) { m.bind(skeleton, new THREE.Matrix4()); m.frustumCulled = false; }
    return m;
  };
  const live = build.parts.filter(p => p.count > 0);
  let solid = MAT;
  if (coat || smooth) {
    solid = MAT.clone(); solid.flatShading = !smooth; solid.name = 'coat';
    if (coat) { solid.map = coat.tex; coatGloss(solid); }
  }
  // geometries per part, with normals blended across the body / limb seams (see blendSeamNormals)
  const geoOf = new Map(live.map(p => [p, toGeo(p)]));
  if (smooth && opt.seamRadius) {
    const body = live.find(p => p.name === 'body' && !p.glass);
    if (body) for (const p of live) if (/^leg-/.test(p.name) && !p.glass) blendSeamNormals(geoOf.get(body), geoOf.get(p), opt.seamRadius);
    // (Digital Diorama revision 8: other parts that meet along a shared row, such as the elephant's face and trunk;
    // revision 9: the skull where it meets the neck, so the join behind the ears shades as one surface)
    for (const [a, b] of opt.seams || []) { const A = live.find(p => p.name === a && !p.glass), Bp = live.find(p => p.name === b && !p.glass); if (A && Bp) blendSeamNormals(geoOf.get(A), geoOf.get(Bp), opt.seamRadius * 0.5); }
  }
  for (const glass of [false, true]) {
    const list = live.filter(p => p.glass === glass);
    if (!list.length) continue;
    const mat = glass ? GLASS_MAT : solid;
    if (merge) {
      const geos = list.map(p => geoOf.get(p)), merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (geos.length > 1) geos.forEach(g => g.dispose());
      if (!merged) continue;
      merged.computeBoundingBox(); merged.computeBoundingSphere();
      root.add(meshOf(merged, mat, glass ? 'glass' : 'solid', { merged: true, parts: list.map(p => p.name) }));
    } else {
      const used = new Map();
      for (const p of list) {
        const k = used.get(p.name) || 0; used.set(p.name, k + 1);
        root.add(meshOf(geoOf.get(p), mat, k ? `${p.name}-${k + 1}` : p.name, { part: p.name, group: p.group, glass }));
      }
    }
  }
  if (!skinned) root.remove(armature);
  root.updateMatrixWorld(true);
  return { root, skeleton: skinned ? skeleton : null };
}

/** Bounding dimensions of a finished asset as posed (meters); skinned meshes are measured through their bones. */
function measure(root) {
  const box = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverse((m) => {
    if (!m.isMesh) return;
    if (!m.isSkinnedMesh) { box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); return; }
    // Vertices bound to scale-0 bones (hidden alternate meshes) collapse and so do not count.
    const sk = m.skeleton, g = m.geometry, pa = g.attributes.position.array, si = g.attributes.skinIndex.array, sw = g.attributes.skinWeight.array;
    const E = sk.bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(m.matrixWorld, new THREE.Matrix4().multiplyMatrices(b.matrixWorld, sk.boneInverses[i])).elements);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0, n = pa.length / 3; i < n; i++) {
      const x = pa[i * 3], y = pa[i * 3 + 1], z = pa[i * 3 + 2]; let ax = 0, ay = 0, az = 0;
      for (let k = 0; k < 4; k++) {
        const w = sw[i * 4 + k]; if (!(w > 0)) continue;
        const e = E[si[i * 4 + k]];
        ax += w * (e[0] * x + e[4] * y + e[8] * z + e[12]); ay += w * (e[1] * x + e[5] * y + e[9] * z + e[13]); az += w * (e[2] * x + e[6] * y + e[10] * z + e[14]);
      }
      if (ax < lo[0]) lo[0] = ax; if (ay < lo[1]) lo[1] = ay; if (az < lo[2]) lo[2] = az;
      if (ax > hi[0]) hi[0] = ax; if (ay > hi[1]) hi[1] = ay; if (az > hi[2]) hi[2] = az;
    }
    if (lo[0] <= hi[0]) box.union(new THREE.Box3(V3(...lo), V3(...hi)));
  });
  const s = box.getSize(V3());
  return { length: +s.z.toFixed(3), height: +s.y.toFixed(3), width: +s.x.toFixed(3), min: box.min.toArray().map(v => +v.toFixed(3)), max: box.max.toArray().map(v => +v.toFixed(3)) };
}

/* ── colourways: role-aware transforms of each species' natural palette ── */
const SCHEMES = {
  natural: { label: 'Natural', fn: (c) => c },
  albino: { label: 'Albino', fn: (c, r) => r === 'eye' ? 0xc8495a : r === 'soft' ? mixHex(c, 0xf0a3a3, 0.7) : r === 'body' ? mixHex(c, 0xf6f1e7, 0.9) : r === 'keratin' ? mixHex(c, 0xefe4cc, 0.7) : c },
  melanistic: { label: 'Melanistic', fn: (c, r) => r === 'body' ? tone(c, { s: 0.55, l: 0.26 }) : r === 'eye' ? 0xd7b04a : r === 'keratin' ? tone(c, { l: 0.45 }) : c },
  arctic: { label: 'Arctic', fn: (c, r) => r === 'body' ? tone(c, { s: 0.3, l: 0.42, la: 0.5 }) : r === 'keratin' ? tone(c, { s: 0.6, l: 0.8 }) : c },
  golden: { label: 'Golden', fn: (c, r) => r === 'body' ? (() => { const [, s, l] = hslOf(c); return hexHSL(0.105, clamp(0.35 + s * 0.6, 0, 0.85), clamp(l * 0.9 + 0.08, 0.08, 0.86)); })() : c },
  twilight: { label: 'Twilight', fn: (c, r) => r === 'body' ? (() => { const [, s, l] = hslOf(c); return hexHSL(0.68 + l * 0.12, clamp(0.25 + s * 0.4, 0, 0.7), clamp(l * 0.85 + 0.05, 0.06, 0.8)); })() : r === 'eye' ? 0xffd166 : c },
  toy: { label: 'Toy', fn: (c, r) => r === 'body' || r === 'soft' ? (() => { const [h, s, l] = hslOf(c); return hexHSL(h, clamp(s * 1.6 + 0.2, 0, 0.95), clamp(0.3 + l * 0.6, 0.18, 0.88)); })() : c },
  porcelain: { label: 'Porcelain', fn: (c, r, k) => r === 'body' ? (k === 'marking' || k === 'pattern' ? 0x2f5597 : mixHex(0xf3f1ec, c, 0.06)) : r === 'keratin' ? 0xc9a34a : r === 'eye' ? 0x22355e : r === 'soft' ? 0x7f97c6 : c },
  bronze: { label: 'Bronze', fn: (c, r) => { const [, , l] = hslOf(c); return r === 'eye' ? 0x2a1d10 : hexHSL(0.085, 0.55, clamp(0.18 + l * 0.42, 0.12, 0.62)); } },
};
const COLORWAY_KEYS = Object.keys(SCHEMES);

/** Each zone receives a unique hex so colour pickers and zone splitters can always isolate it. */
function zonesFor(name, overrides = {}, natural = BASE) {
  const sch = (SCHEMES[name] || SCHEMES.natural).fn, used = new Set(), out = {};
  for (const k of ZONE_KEYS) {
    const user = hexOf(overrides[k]), dflt = user !== null && params[k] ? hexOf(params[k].default) : null;
    const base = hexOf(natural[k]) ?? hexOf(BASE[k]) ?? 0x888888;
    let hex = (user !== null && user !== dflt ? user : sch(base, ZONE_ROLES[k] || 'body', k)) & 0xffffff;
    while (used.has(hex)) hex = (hex + 1) & 0xffffff;
    used.add(hex); out[k] = hex;
  }
  return out;
}
function colorwaysFor(natural) {
  return Object.fromEntries(COLORWAY_KEYS.map((n) => [n, Object.fromEntries(Object.entries(zonesFor(n, {}, natural)).map(([k, v]) => [k, hexStr(v)]))]));
}

/** Validates user input against the exported schema (viewer UIs pass strings for every control). */
function normalize(input) {
  const src = input && typeof input === 'object' ? input : {}, p = {};
  for (const [k, s] of Object.entries(params)) {
    let v = src[k];
    if (s.type === 'range') { v = typeof v === 'string' && v.trim() !== '' ? Number(v) : v; p[k] = typeof v === 'number' && Number.isFinite(v) ? clamp(v, s.min, s.max) : s.default; }
    else if (s.type === 'toggle') p[k] = typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : s.default;
    else if (s.type === 'choice') p[k] = s.options.includes(v) ? v : s.default;
    else if (s.type === 'color') p[k] = hexOf(v) !== null ? v : s.default;
    else p[k] = v ?? s.default;
  }
  for (const k of Object.keys(src)) if (!(k in p)) p[k] = src[k];
  return p;
}
const DETAIL = { draft: 0.6, standard: 1, high: 1.55 };
/** Appends one colour control per zone (throws on any name clash) and keeps mergeForProduction last. */
function withZones(geo, labels, base) {
  const out = { ...geo }, merge = out.mergeForProduction;
  delete out.mergeForProduction;
  for (const k of ZONE_KEYS) {
    if (k in out) throw new Error(`param/zone name clash: ${k}`);
    out[k] = { type: 'color', default: hexStr(hexOf(base[k]) ?? 0x888888), label: labels[k] || k, affects: 'colors', describe: `Override for the ${k} zone (leave at default to keep the species palette).` };
  }
  out.mergeForProduction = merge;
  return out;
}

/* ════════════════════════════════════════════════════════════════════════════
 *  TETRAPOD BUILDER — +Z forward, +Y up, animal's left = +X, ground at y = 0.
 *  One continuous loft carries rump → barrel → chest → neck; the head, jaw,
 *  limbs and tail are separate sweeps rooted inside it.
 * ════════════════════════════════════════════════════════════════════════════ */
function tetraLayout(S) {
  const H = S.H, D = S.depth * H, Lt = S.len * H, hw = (S.width * D) / 2;
  const zF = Lt / 2, zB = -Lt / 2, yR = S.rump * H, Dr = D * S.rumpDepth;
  const sag = (S.sag || 0) * D, tuck = S.tuck || 0, belly = S.belly || 0;
  // REVISED REAR: the old rump station sat 4% behind the haunch with a 30% width step and a 0.32 cap,
  // which read as a flat disc. The rump station now sits ~10% forward of the point of buttock, the
  // croup slopes down to the tail-head, the buttocks curve under toward the gaskin, and a long
  // elliptical cap (see tetraTorso) closes the quarters into a rounded rear.
  const hipW = S.hipW || 1;
  // Digital Diorama revision 5 (body shapes): every section used to be the same oval, so bodies read as barrels.
  // The underline is now measured from the chest floor (the brisket, deepest just behind the elbows): `tuck`
  // lifts the flank in front of the thigh and the abdomen (dogs, cats, deer), `belly` lets it hang (cattle, pigs).
  // A flank station carries the tuck-up and the waist seen from above (`waist`), `arch` raises the loin, and each
  // station has its own section shape `st` = [width high on the side, width low on the side] (fractions of the
  // half-width): a keeled chest narrowing to the sternum (`keel`), a belly widest low down in grazers (`pear`),
  // a broad flat croup and back on hoofed animals (`croupFlat`, `backFlat`).
  const floor = H - D, up = (f) => floor + f * D;
  const keel = S.keel ?? 0.3, waist = S.waist ?? 0.05, pear = S.pear ?? clamp(belly * 1.5, 0, 0.8), arch = (S.arch || 0) * D;
  const croup = S.croupFlat ?? 0.88, back = S.backFlat ?? 0.92, quarters = S.quarters ?? 0.85;
  // Seen from above the body is not a tube: the chest between the shoulders is narrower than the ribs
  // (`chestNarrow`), the top of the chest narrows into the withers between the shoulder blades (`withersTop`),
  // and the hindquarters stay broad all the way down to the thighs (`quarters`), so the thighs read as the
  // sides of one mass instead of lumps on the end of a barrel.
  const keys = [
    // from above the hindquarters are U-shaped, broad right to the buttocks (a narrow rump left the thighs poking out)
    { n: 'rump', z: zB + 0.1 * Lt, top: yR - (S.croupSlope ?? 0.17) * Dr, bot: yR - 0.8 * Dr, w: lerp(0.78, 0.93, quarters) * hw * hipW, st: [croup * 0.9, quarters * 0.9] },
    // the body's skin wraps the upper thigh down to the stifle (where the leg leaves the body at the flank fold),
    // so croup, quarters and thigh read as one mass; the flank in front of it is tucked up
    { n: 'haunch', z: zB + 0.23 * Lt, top: yR, bot: yR - 0.98 * Dr, w: 0.97 * hw * hipW, st: [croup, quarters] },
    { n: 'flank', z: zB + 0.34 * Lt, top: lerp(yR, H, 0.22) - sag * 0.45 + arch * 0.7, bot: up(0.1 + 0.85 * tuck - 0.12 * belly), w: hw * (0.94 - waist), st: [back, lerp(0.66, 0.94, pear)] },
    { n: 'loin', z: zB + 0.46 * Lt, top: lerp(yR, H, 0.42) - sag + arch, bot: up(0.04 + 0.45 * tuck - 0.3 * belly), w: hw * (0.97 - 0.6 * waist), st: [back, lerp(0.74, 1.08, pear)] },
    { n: 'barrel', z: zB + 0.66 * Lt, top: lerp(yR, H, 0.74) - sag * 0.55 + arch * 0.35, bot: up(0.12 * tuck - 0.3 * belly), w: hw, st: [back * 1.02, lerp(0.8, 1.0, pear)] },
    { n: 'chest', z: zF - 0.19 * Lt, top: H, bot: floor + 0.1 * belly * D, w: (S.chestNarrow ?? 0.9) * hw * (S.chestW || 1), st: [S.withersTop ?? 0.95, 1 - keel] },
  ];
  for (const k of keys) { k.c = V3(0, (k.top + k.bot) / 2, k.z); k.ht = (k.top - k.bot) / 2; k.hb = k.ht; }
  // humps / withers prominence add to the top half-height only
  const nrC = V3(0, H - (0.45 + (S.neckLow || 0)) * D, zF - 0.035 * Lt);
  const nA = S.neckAng * DEG, nd = V3(0, Math.sin(nA), Math.cos(nA)), nUp = V3(0, Math.cos(nA), -Math.sin(nA));
  const nT = (S.neckThk * D) / 2, nW = S.neckW;
  // minimum neck run: the section must taper from the chest root to the skull over a sane distance
  const LhPre = S.headLen * H, rootHt = 0.44 * D * (S.chestOut || 1), skullHt = S.headD * LhPre;
  const Ln = Math.max(0.02 * H, S.neckLen * H, 1.25 * Math.max(0, rootHt - skullHt));
  const nArch = (S.neckArch || 0) * Ln;
  const neck = [
    // the breastbone rises from the girth to the base of the neck just below the points of the shoulders, so the upper
    // arms form the front of the body there (the section reached 90 % of the chest depth: a flat box front)
    { n: 'neckRoot', c: nrC, ht: 0.43 * D * (S.chestOut || 1), hb: (S.breast ?? 0.3) * D * (S.chestOut || 1), w: (S.neckRootW ?? 0.78) * hw * Math.sqrt(S.chestW || 1), st: [0.88, 1 - keel * 0.6] },
    { n: 'neck1', c: nrC.clone().addScaledVector(nd, 0.34 * Ln).addScaledVector(nUp, nArch * 0.6), ht: nT * 1.05, hb: nT * 1.05, w: nT * nW * 1.1, st: [0.95, 0.9] },
    { n: 'neck2', c: nrC.clone().addScaledVector(nd, 0.68 * Ln).addScaledVector(nUp, nArch), ht: nT * 0.86, hb: nT * 0.84, w: nT * nW * 0.92, st: [0.97, 0.94] },
    { n: 'neckTop', c: nrC.clone().addScaledVector(nd, Ln).addScaledVector(nUp, nArch * 0.5), ht: nT * 0.72, hb: nT * 0.7, w: nT * nW * 0.82, st: [1, 1] },
  ];
  const all = [...keys, ...neck];
  const hA = S.headAng * DEG, hd = V3(0, -Math.sin(hA), Math.cos(hA)), hu = V3(0, Math.cos(hA), Math.sin(hA));
  const Lh = S.headLen * H, ch = S.headD * Lh, cw = S.headW * Lh;
  const poll = neck[3].c.clone().addScaledVector(nUp, nT * 0.35);
  const headO = poll.clone().addScaledVector(hd, -0.02 * Lh).addScaledVector(hu, -0.08 * ch);
  // REVISED NECK→SKULL: the throat-latch stations may not exceed the skull section, otherwise short,
  // thick necks (pig, bear, hippo, boar) end in a visible disc / collar around the back of the head.
  // (Digital Diorama revision 9: the neck's end no wider than the back of the skull (it was 1.08 × the skull's half-width,
  // so on short necks it stood round the occiput as a collar); `neckCapW` overrides)
  const capH = ch * 1.02, capW = cw * (S.neckCapW ?? 0.86);
  neck[3].ht = Math.min(neck[3].ht, capH); neck[3].hb = Math.min(neck[3].hb, capH * 1.05); neck[3].w = Math.min(neck[3].w, capW);
  neck[2].ht = Math.min(neck[2].ht, Math.max(capH * 1.3, lerp(neck[3].ht, neck[1].ht, 0.5))); neck[2].hb = Math.min(neck[2].hb, Math.max(capH * 1.35, lerp(neck[3].hb, neck[1].hb, 0.5)));
  neck[2].w = Math.min(neck[2].w, Math.max(capW * 1.3, lerp(neck[3].w, neck[1].w, 0.5)));
  // Digital Diorama revision 9: the throatlatch. The neck's end was as deep as the back of the skull, and on a long head
  // carried low (horses, cattle, deer, camels) it swallowed the jowls, so the head's lower line ran straight on into the
  // neck. `throat` narrows the neck's underside toward the head (its lower half-height × (1 - throat) at the end, the taper
  // below then follows) and slims its sides a little, so the round jowls stand out in front of a narrow throat.
  if (S.throat) { neck[3].hb *= 1 - S.throat; neck[3].w *= 1 - 0.25 * S.throat; neck[2].hb *= 1 - 0.3 * S.throat; }
  // near-linear taper root → skull: no station may sit far above the straight cone between them
  for (const [i, t] of [[1, 0.34], [2, 0.68]]) for (const k of ['ht', 'hb', 'w']) neck[i][k] = Math.min(neck[i][k], lerp(neck[0][k], neck[3][k], t) * 1.12);
  return { H, D, Lt, hw, zF, zB, yR, Dr, keys: all, nd, nUp, Ln, nT, hd, hu, Lh, ch, cw, poll, headO, elbowY: H - D, limbs: [] };
}

/** Torso + neck loft with profile keys; creates the axial skeleton. */
function tetraTorso(B, S, L) {
  const det = B.det, rig = B.rig, keys = L.keys;
  const curve = makePath(keys.map(k => k.c));
  const ku = knotUs(curve, keys.length);
  keys.forEach((k, i) => { k.u = ku[i]; });
  const humps = S.humps || [];
  const pW = prof(keys.map(k => [k.u, k.w])), pHT = prof(keys.map(k => [k.u, k.ht])), pHB = prof(keys.map(k => [k.u, k.hb]));
  const by = (n) => keys.find(k => k.n === n);
  const uTop = by('neckTop').u, uRoot = by('neckRoot').u;
  // Digital Diorama revision 7: a hump, not a ridge. The withers bump was a narrow symmetric bell added to the top
  // half-height of a narrow-topped chest section, so a big one (bison, boar) rose as a tent or a sharp peak. It now
  // falls steeply in front (`withersFront`) and slopes gradually back to the loin (`withersBack`), and where it is a
  // real hump (withers above ~0.2, or `humpTop` given) the section keeps its width up to a rounded, flatter top
  // (`humpTop`: width high on the side, `humpN`: superellipse exponent of the top) instead of narrowing to a ridge.
  const wAmt = S.withers || 0, uW = by('chest').u - 0.02 + (S.withersAt ?? 0);
  const wFront = S.withersFront ?? 0.24, wBack = S.withersBack ?? 0.24;
  const withersBell = (u) => bell(u, uW, u < uW ? wBack : wFront);
  const humpK = S.humpTop !== undefined ? 1 : sstep(0.2, 0.3, wAmt);
  const humpW = (u) => humpK * withersBell(u);
  const ht = (u) => pHT(u) + humps.reduce((s, h) => s + h.h * L.H * bell(u, h.u * by('chest').u, h.w * by('chest').u), 0) + wAmt * L.D * withersBell(u);
  // Sections: broad back (nt > 2), keeled chest / rounded belly (nb < 2) so the barrel is not a tube.
  const ntB = S.nt || 2.15, nbB = S.nb || 1.85;
  const nt0 = prof([[0, ntB * 0.92], [by('haunch').u, ntB], [by('chest').u, ntB], [uRoot + 0.02, 2], [1, 2]]);
  const nt = humpK > 0 ? (u) => lerp(nt0(u), S.humpN ?? 2.5, humpW(u)) : nt0;
  const nb = prof([[0, 2.1], [by('haunch').u, S.quartersBox ?? 2.0], [by('barrel').u, nbB], [by('chest').u, nbB * 0.95], [uRoot + 0.02, 2], [1, 2]]);
  const seg = Math.round((32 + 10 * (S.neckLen || 0)) * det), rad = 2 * Math.round(9 * det + 3);
  // Hamstring / buttock mass: swells the lower-lateral rear quadrant so the rear outline bulges at the
  // point of buttock and turns under into the thigh instead of ending in a vertical plate.
  // (Digital Diorama revision 5: much smaller now the hind leg is lofted through its real outline; the old bulge sat
  // beside the thigh as a second lump)
  const uH = by('haunch').u, hams = S.hams ?? 0.04;
  const hamBump = (u, a) => hams * (1 - sstep(uH * 0.35, uH * 1.25, u)) * bell(Math.sin(a), -0.28, 0.95) * (0.55 + 0.45 * Math.abs(Math.cos(a)));
  // Digital Diorama revision 5: the shoulder is sculpted into the chest wall (it was a smooth barrel with the
  // forelegs plugged in underneath): muscle over the shoulder blade, sloping back from the point of shoulder to
  // the withers, the triceps mass filling the angle above the elbow, and the point of shoulder itself. Landmarks
  // match the foreleg layout (tetraLimbJoints); the bulge acts on the sides of the ribcage only.
  // (Digital Diorama revision 10: a measured layout gives the landmarks themselves, from its joints)
  const SM = L.shoulderMarks, sz = L.zF - (S.shoulderBack ?? 0.07) * L.Lt, scT = SM ? SM.scT : [L.zF - 0.25 * L.Lt, L.H - 0.2 * L.D], scJ = SM ? SM.scJ : [sz, L.H - 0.6 * L.D];
  const elb = SM ? SM.elb : [sz - 0.075 * L.H, Math.max(0.05 * L.H, L.elbowY) + 0.03 * L.H], tri = [lerp(scJ[0], elb[0], 0.5) - 0.05 * L.D, lerp(scJ[1], elb[1], 0.45)];
  const shAmp = S.shoulder ?? 0.09, sideOf = (a) => Math.abs(Math.cos(a)) ** 1.4;
  const segD = (z, y, A, Bp) => { const dz = Bp[0] - A[0], dy = Bp[1] - A[1], t = clamp(((z - A[0]) * dz + (y - A[1]) * dy) / (dz * dz + dy * dy), 0, 1); return Math.hypot(z - A[0] - t * dz, y - A[1] - t * dy); };
  const shoulderBump = (u, x, y, a) => {
    if (u > uRoot + 0.04 || u < by('barrel').u - 0.05) return 0;
    const c = curve.getPointAt(clamp(u, 0, 1)), z = c.z, yy = c.y + y, D = L.D;
    const blade = Math.exp(-((segD(z, yy, scT, scJ) / (0.17 * D)) ** 2));
    const tr = Math.exp(-(((z - tri[0]) / (0.2 * D)) ** 2 + ((yy - tri[1]) / (0.2 * D)) ** 2));
    const pt = Math.exp(-(((z - scJ[0] - 0.05 * D) / (0.1 * D)) ** 2 + ((yy - scJ[1]) / (0.1 * D)) ** 2));
    return shAmp * (0.8 * blade + 1.0 * tr + 0.55 * pt) * sideOf(a);
  };
  // Surface anatomy (Digital Diorama revision 5): a smooth tube reads as a barrel however it is proportioned. Real
  // bodies show their skeleton and muscles: the withers ridge and shoulder blades, the spring of the ribs, the hollow
  // behind the elbow, the forechest, the "hunger hollow" in the flank and the points of the hips. Each mark is a soft
  // bump at a station and a height round the section (sin a: 1 = top, -1 = belly); amounts per family in `marks`.
  const mk = Object.fromEntries(Object.entries(S.marks || {}).map(([k, v]) => [k, v * (S.markGain ?? 1)])), uAt = (n0, n1, t) => lerp(by(n0).u, by(n1).u, t), gap = (n0, n1) => Math.abs(by(n1).u - by(n0).u);
  const marks = [
    { u: uAt('haunch', 'flank', 0.35), du: 0.45 * gap('haunch', 'flank'), s: 0.52, ds: 0.26, amp: mk.hooks ?? 0 },
    { u: uAt('flank', 'loin', 0.55), du: 0.6 * gap('flank', 'loin'), s: 0.3, ds: 0.36, amp: -(mk.fossa ?? 0) },
    { u: by('barrel').u, du: 0.5 * gap('loin', 'chest'), s: -0.05, ds: 0.55, amp: mk.ribs ?? 0 },
    { u: uAt('barrel', 'chest', 0.62), du: 0.28 * gap('barrel', 'chest'), s: -0.6, ds: 0.24, amp: -(mk.girth ?? 0) },
    { u: uAt('chest', 'neckRoot', 0.72), du: 0.38 * gap('chest', 'neckRoot'), s: -0.5, ds: 0.32, amp: mk.breast ?? 0 },
    // (Digital Diorama revision 7: no withers ridge on a hump)
    { u: by('chest').u - 0.01, du: 0.5 * gap('barrel', 'chest'), s: 1, ds: 0.12, amp: (mk.withers ?? 0) * (1 - humpK) },
    { u: by('chest').u, du: 0.4 * gap('barrel', 'chest'), s: 0.8, ds: 0.16, amp: mk.scapula ?? 0 },
    { u: (by('haunch').u + by('chest').u) / 2, du: 0.55 * gap('haunch', 'chest'), s: 1, ds: 0.08, amp: mk.spine ?? 0 },
  ].filter(m => m.amp);
  const markBump = (u, a) => {
    const sa = Math.sin(a); let f = 0;
    for (const m of marks) { const du = (u - m.u) / m.du, ds = (sa - m.s) / m.ds; if (du * du < 9 && ds * ds < 9) f += m.amp * Math.exp(-du * du - ds * ds); }
    return f;
  };
  // Digital Diorama revision 7: a shaggy cape (`shag`, bison): over the front mane the coat stands out in rough tufts,
  // thickest over the hump and shoulders (no extra triangles: the surface is displaced)
  const capeU = { barrel: by('barrel').u, chest: by('chest').u };
  const shagBump = S.shag && S.frontMane ? (u, a) => {
    const sa = Math.sin(a), e = capeEdgeU(S, capeU, sa);
    return S.shag * sstep(e - 0.04, e + 0.05, u) * (0.45 + 0.55 * Math.max(0, sa)) * (0.3 + 2 * (fbm(Math.cos(a) * 7 + u * 19, sa * 7, u * 15, 9) - 0.5));
  } : null;
  const bump0 = shagBump ? (u, a, x, y) => hamBump(u, a) + shoulderBump(u, x, y, a) + markBump(u, a) + shagBump(u, a)
    : (u, a, x, y) => hamBump(u, a) + shoulderBump(u, x, y, a) + markBump(u, a);
  const bump = S.bumpFn ? (u, a, x, y) => bump0(u, a, x, y) + S.bumpFn(u, a, x, y) : bump0;
  // section shape (see tetraLayout): the side narrows toward the top / bottom by each station's `st` factors
  const stT0 = prof(keys.map(k => [k.u, (k.st || [1, 1])[0]])), stB = prof(keys.map(k => [k.u, (k.st || [1, 1])[1]]));
  const stT = humpK > 0 ? (u) => lerp(stT0(u), S.humpTop ?? 0.98, humpW(u)) : stT0;
  const sect = (u, a, x, y, h1, h2) => {
    const yn = Math.min(1, Math.abs(y) / Math.max(1e-9, y >= 0 ? h1 : h2));
    return [x * lerp(1, y >= 0 ? stT(u) : stB(u), sstep(0.04, 0.92, yn)), y];
  };
  // (Digital Diorama revision 10: a measured body's stations are upright slices up to the chest, turning into the neck's
  // own sections by the neck root)
  const level = L.ref ? (u) => 1 - sstep(by('chest').u, uRoot, u) : null;
  const g = loft({ curve, seg, rad, w: pW, ht, hb: pHB, nt, nb, cap0: { type: 'round', len: S.rumpCap ?? 0.95, n: 5 }, cap1: { type: 'round', len: 0.62, n: 3 }, bend: 0.85, bump, sect, level });
  L.torso = g; L.torsoCurve = curve; L.uOf = Object.fromEntries(keys.map(k => [k.n, k.u]));
  // axial bones (dorsal bias so bending stretches the belly, not the back)
  const at = (u, bias = 0.25) => { const f = g.frame(u); return f.c.addScaledVector(f.up, bias * ht(u)); };
  const U = L.uOf;
  rig.add('Root', null, [0, 0, 0]);
  rig.add('Hips', 'Root', at(U.haunch));
  rig.add('Spine1', 'Hips', at(U.loin));
  rig.add('Spine2', 'Spine1', at(U.barrel));
  rig.add('Chest', 'Spine2', at(U.chest));
  rig.add('Neck1', 'Chest', at(U.neckRoot, 0.1));
  rig.add('Neck2', 'Neck1', at(lerp(U.neck1, U.neck2, 0.5), 0));
  rig.add('Head', 'Neck2', L.poll);
  L.axial = rig.spec(['Hips', 'Spine1', 'Spine2', 'Chest', 'Neck1', 'Neck2', 'Head'], [0, U.loin, U.barrel, U.chest, U.neckRoot + 0.02, lerp(U.neck1, U.neck2, 0.5), uTop - 0.01], 0.32);
  L.torsoHt = ht; L.torsoW = pW; L.torsoHb = pHB;
  return g;
}

/** Skin weights for torso vertices: axial chain blended with nearby limb roots so haunches follow thighs. */
function tetraTorsoSkin(B, L) {
  const rig = B.rig;
  return (u, a, P) => {
    let W = rig.chain(L.axial, u);
    for (const lm of L.limbs) {
      if (P.x * lm.side < 0) continue;
      const a0 = lm.joints[lm.inf[0]].p, a1 = lm.joints[lm.inf[1]].p;
      const d = V3().subVectors(a1, a0), t = clamp(V3().subVectors(P, a0).dot(d) / Math.max(1e-9, d.lengthSq()), 0, 1);
      const dist = P.distanceTo(a0.clone().addScaledVector(d, t));
      let f = (1 - sstep(lm.reach * 0.55, lm.reach * 1.25, dist)) * lm.pull * (1 - 0.6 * Math.max(0, Math.sin(a)));
      // Digital Diorama revision 5: the body wraps the upper thigh, so below the hip joint it moves with the femur
      // (fully by the stifle) and the thigh inside never shows through as the leg swings
      if (lm.pull > 0.5 && dist < lm.reach * 1.25) f = Math.max(f, (lm.front ? 0.8 : 0.9) * sstep(a0.y, lerp(a0.y, a1.y, 0.75), P.y) * (1 - sstep(lm.reach * 0.7, lm.reach * 1.25, dist)));
      if (f > 0.01) W = mixW(W, rig.W(lm.bones[lm.inf[2]]), f);
    }
    return W;
  };
}

/** Head: skull loft + hinged jaw loft (real mouth opening), eyes, nose, teeth and membrane ears. */
function tetraHead(B, S, L) {
  const det = B.det, rig = B.rig, Lh = L.Lh, ch = L.ch, cw = L.cw, hd = L.hd, hu = L.hu, O = L.headO;
  const sn = S.snout, s0 = 1 - sn, sw = S.snoutW, sd = S.snoutD, stop = S.stop || 0, dome = S.dome || 1, cheek = S.cheek || 1;
  const sEye = clamp(S.eyeS ?? (s0 - 0.05), 0.2, 0.8);
  const mt = sd * ch, mt2 = lerp(sd * ch, 0.85 * ch, 0.3);
  // REVISED SKULL: braincase is egg-shaped (wider just behind the eyes, rounded occiput via a long
  // back cap), with a supraorbital brow shelf over the eyes and a zygomatic flare below them, so the
  // skull no longer reads as a straight tapered tube.
  const brow = S.brow ?? 0.05;
  // (Digital Diorama revision 9: a fuller occiput, 0.76 × the half-width (0.66 left the neck's end standing round it))
  const W0 = prof([[0, 0.76 * cw], [0.1, 0.94 * cw], [0.22, cw], [sEye, cheek * cw], [s0, lerp(cheek * cw, sw * cw, 0.42)], [s0 + 0.55 * sn, lerp(cw, sw * cw, 0.86)], [1, sw * cw]]);
  const W = (s) => W0(s) + brow * 1.2 * cw * bell(s, sEye - 0.01, 0.13);
  // Digital Diorama revision 6: the stop was a 1-2 cm slope (a Labrador's is 3-4 cm): the forehead now rises over the
  // eyes and the nasal bridge drops in front of them, both by `stop`
  const HT = (s) => prof([[0, 0.62 * ch * dome], [0.12, 0.9 * ch * dome], [0.24, ch * dome], [sEye, (0.93 + 0.1 * stop) * ch], [s0, lerp(0.86 * ch, mt2 * (1 - 0.08 * stop), stop)], [s0 + 0.55 * sn, lerp(mt2, mt, 0.55)], [1, mt]])(s)
    + (S.roman || 0) * 0.14 * ch * bell(s, s0 + 0.45 * sn, 0.4 * sn) + (S.casque || 0) * 0.3 * ch * bell(s, S.casqueS ?? 0.12, S.casqueW ?? 0.2)
    + brow * ch * bell(s, sEye - 0.03, 0.12);
  // HBl: the skull's underside along the upper lip (the mouth line); the jaw hangs below it
  const HBl = prof([[0, 0.52 * ch], [0.14, 0.72 * ch], [sEye, 0.7 * ch * (S.jowl || 1)], [s0, 0.5 * ch], [1, 0.4 * mt]]);
  const OY = prof([[0, 0], [Math.max(0.05, s0 - 0.12), 0], [1, -(S.drop || 0) * ch]]);
  // Digital Diorama revision 6: behind the corner of the mouth (sC) the cheek and its masseter muscle cover the jaw, so
  // the skull's surface comes down to the bottom of the jaw there (the jaw hung below the whole head as a strap: a
  // crocodile's mouth). Hunters' mouths run back to below the eye; grazers' and rodents' corners lie far forward.
  // (Digital Diorama revision 7: `jawEnd` shortens the jaw so the upper lip can hang over its tip)
  const sJ0 = 0.14, sJ1 = S.jawEnd ?? 0.955;
  const jawExtra = (S.jaw ?? 0.5) * ch * 0.55, lip = 0.22 * mt + 0.002 * L.H;
  const jDrop = (s) => lerp(jawExtra, lip, sstep(sJ0 + 0.12, sJ1, s)) * (S.chin ? 1 + S.chin * bell(s, 0.9, 0.14) : 1);
  const hunter = S.fang > 0 || S.nose === 'feline' || S.stance === 'plantigrade';
  const sC = clamp(S.mouthS ?? (hunter ? sEye + 0.04 : S.incisors > 0 ? lerp(sEye, 1, 0.42) : lerp(sEye, 1, 0.5)), sJ0 + 0.12, 0.93);
  const cover = (s) => 1 - sstep(sC - 0.05, sC + 0.03, s);
  // Digital Diorama revision 7: a camel's long upper lip overhangs the lower: the muzzle's underside drops in front of the
  // jaw's tip (`lipOver`, × muzzle height), and a cleft (`cleft`) splits it down the middle; the jaw keeps the plain lip line
  const lipOver = (s) => (S.lipOver || 0) * mt * sstep(sJ1 - 0.1, Math.min(0.99, sJ1 + 0.06), s);
  const HB = (s) => HBl(s) + lipOver(s) + cover(s) * (jDrop(s) + 0.04 * ch);
  const cleftBump = S.cleft ? (s, a) => -S.cleft * sstep(0.86, 1, s) * Math.exp(-((Math.cos(a) / 0.16) ** 2)) * sstep(0.2, 0.7, -Math.sin(a)) : null;
  const nMuz = S.muzzleN || 2.2;
  // Digital Diorama revision 9: the upper lips hang straight down the sides of the muzzle in front of the mouth corner
  // (`lipN`, the exponent of the muzzle's lower half), so the lower jaw fits up inside them instead of hanging below a
  // rounded shelf
  const lipN = S.lipN ?? nMuz + 0.2;
  const NT = prof([[0, 2], [s0, 2.05], [1, nMuz]]), NB = prof([[0, 2], [Math.min(s0, sC), 2.1], [Math.min(0.97, Math.max(s0, sC) + 0.08), lipN], [1, lipN]]);
  // Digital Diorama revision 9: one superellipse per station made every head a tapered tube. The section's upper half
  // (braincase, forehead, bridge of the nose) and lower half (cheeks and jowls, upper lips) now have their own widths, as
  // factors on the profile W: `crownW` the top of the braincase between the ears, `browW` the forehead over the eyes,
  // `bridgeW` the bridge of the nose, `cheekLow` the cheeks and jowls below the eyes, `lipW` the upper lips. A cat's
  // round face is narrow over the crown and broad across the cheeks; a horse's forehead is broad and flat over a narrow
  // face; a dog's nose bridge is narrower than its lips.
  const kTop = prof([[0, S.crownW ?? 1], [0.2, S.crownW ?? 1], [sEye, S.browW ?? 1], [Math.min(0.97, s0 + 0.4 * sn), S.bridgeW ?? 1], [1, S.bridgeW ?? 1]]);
  const kBot = prof([[0.08, 1], [sEye, S.cheekLow ?? 1], [Math.max(sEye + 0.01, sC), S.cheekLow ?? 1], [Math.min(0.98, Math.max(sEye, sC) + 0.16), S.lipW ?? 1], [1, S.lipW ?? 1]]);
  const kOf = (s, up, yn) => lerp(1, up ? kTop(s) : kBot(s), sstep(0, 1, yn));
  const headSect = (s, a, x, y, h1, h2) => { const up = y >= 0; return [x * kOf(s, up, Math.min(1, Math.abs(y) / Math.max(1e-9, up ? h1 : h2))), y]; };
  const tip = O.clone().addScaledVector(hd, Lh);
  const g = loft({ pts: [O, tip], seg: Math.round(18 * det), rad: 2 * Math.round(8 * det + 3), w: W, ht: HT, hb: HB, oy: OY, nt: NT, nb: NB, up: hu, bump: cleftBump, sect: headSect,
    cap0: { type: 'round', len: S.occiput ?? 0.72, n: 3 }, cap1: S.nose === 'disc' ? { type: 'flat' } : { type: 'round', len: S.noseCap ?? 0.5, n: 3 }, bend: 0, antifold: false });
  L.head = g; L.headS = { s0, sEye, sn, W, HT, HB: HBl, OY, sC };
  const headW = rig.W('Head');
  const paint = B.paint;
  const palate = (s, a) => s > s0 - 0.08 && s < 0.97 && Math.abs(a - 1.5 * Math.PI) < 0.55;
  // eyes: ray-cast a yaw/elevation direction from the skull centre onto the lofted surface
  const eyeR = S.eye * Lh, yaw = (S.eyeYaw ?? 55) * DEG, el = (S.eyeEl ?? 18) * DEG;
  const eFr = g.frame(sEye), eC = eFr.c.clone().addScaledVector(hu, OY(sEye) + (HT(sEye) - HBl(sEye)) * 0.5);
  // (Digital Diorama revision 9: `eyeReach` limits how far in front of the eye station the eye may land, so the eyes of a
  // short-faced cat stay at the stop instead of sliding onto the muzzle; `eyeFwd` how far the gaze turns from the surface
  // toward the eye's own direction, more for animals that look forward)
  L.eyes = [1, -1].map((side) => {
    const dir = hd.clone().multiplyScalar(Math.cos(yaw) * Math.cos(el)).add(V3(side * Math.sin(yaw) * Math.cos(el), 0, 0)).addScaledVector(hu, Math.sin(el)).normalize();
    const hit = surfaceToward(g, eC, dir, Math.max(0.05, sEye - 0.3), Math.min(0.97, sEye + (S.eyeReach ?? 0.25)));
    return { c: hit.p.clone().addScaledVector(hit.n, -eyeR * (S.eyeInset ?? 0.58)), dir: hit.n.clone().lerp(dir, S.eyeFwd ?? 0.5).normalize(), side };
  });
  emit(B.part('head', { group: 'head' }), g, (s, a, P) => palate(s, a) ? 'mouth' : (S.nose === 'disc' && s >= 0.999) ? 'nose' : paint({ part: 'head', u: s, a, P, s0 }), headW);
  // ── jaw: hinged at the temporomandibular joint, its top hidden inside the skull until it opens
  // Digital Diorama revision 9: the jaw was a narrow oval hung below the skull's rounded underside, so a shelf ran along
  // the lips and the lower jaw read as a separate strap (a duck's bill on cats, a crocodile's on dogs). Its widest part now
  // lies at the edge of the upper lips (`lipDepth` above the skull's underside, × its lower half-height), as wide as the
  // muzzle there less the lip's thickness (`lipInset`), so the sides of the face run on down the lower jaw to the chin;
  // behind the mouth corner it is fitted inside the cheek. `chinN` rounds the lower jaw's underside (2: a narrow U).
  const eps = S.lipDepth ?? 0.25, lipIn = S.lipInset ?? 0.06, jnB = S.chinN ?? 2.2;
  // the skull's half-width at height y below its section centre (as lofted: superellipse, then the section factors)
  const skullX = (s, y) => {
    const h = HB(s), n = NB(s), t = clamp(Math.abs(y) / Math.max(1e-9, h), 0, 1);
    return W(s) * Math.pow(Math.max(0, 1 - Math.pow(t, n)), 1 / n) * kOf(s, false, t);
  };
  const jc = (s) => -(1 - eps) * HBl(s);
  const jhT = (s) => 0.55 * (1 - eps) * HBl(s), jhB = (s) => eps * HBl(s) + jDrop(s);
  const jawSh = (t) => Math.pow(Math.max(0, 1 - Math.pow(t, jnB)), 1 / jnB);
  // behind the corner: the widest jaw that stays inside the cheek at every height of its lower half (with a margin)
  const jwIn = (s) => { let m = Infinity; for (let i = 0; i < 10; i++) { const t = i / 10; m = Math.min(m, skullX(s, jc(s) - t * jhB(s)) / Math.max(1e-6, jawSh(t))); } return 0.9 * m; };
  const jwOut = (s) => skullX(s, jc(s)) * (1 - lipIn);
  const jw = (s) => Math.max(1e-4, lerp(Math.min(jwIn(s), jwOut(s)), jwOut(s), sstep(sC - 0.06, sC + 0.02, s))) * (S.jawW || 1);
  const jBot = (s) => OY(s) + jc(s) - jhB(s);
  const jpts = [];
  for (let i = 0; i <= 8; i++) { const s = lerp(sJ0, sJ1, i / 8); jpts.push(O.clone().addScaledVector(hd, s * Lh).addScaledVector(hu, OY(s) + jc(s))); }
  const jcurve = makePath(jpts);
  const sOf = (u) => lerp(sJ0, sJ1, u);
  const jg = loft({ curve: jcurve, seg: Math.round(12 * det), rad: 2 * Math.round(6 * det + 2), w: (u) => jw(sOf(u)), ht: (u) => jhT(sOf(u)), hb: (u) => jhB(sOf(u)),
    nt: 2, nb: jnB, up: hu, cap0: { type: 'round', len: 0.7, n: 2 }, cap1: { type: 'round', len: 0.5, n: 2 }, bend: 0.5 });
  const tmj = O.clone().addScaledVector(hd, 0.2 * Lh).addScaledVector(hu, OY(0.2) - HBl(0.2) * 0.4);
  rig.add('Jaw', 'Head', tmj, tip.clone().addScaledVector(hu, jBot(1)));
  L.jaw = jg;
  // (the lining only inside the mouth: the front of the jaw is the lower lip, coat-coloured)
  // (Digital Diorama revision 7: the lining starts just in front of the mouth corner; at the corner it peeked out as a pink line)
  // (Digital Diorama revision 9: `lipZone` paints the lips' edge, a thin dark line where the lower lip meets the upper)
  emit(B.part('jaw', { group: 'head' }), jg, (u, a, P) => {
    if (Math.abs(a - Math.PI / 2) < 0.5 && sOf(u) > sC + 0.02 && u < 0.88) return 'mouth';
    if (S.lipZone && Math.abs(Math.sin(a)) < 0.16 && sOf(u) > sC - 0.03) return S.lipZone;
    return paint({ part: 'jaw', u: sOf(u), a, P, s0 });
  }, rig.W('Jaw'));
  // ── whisker pads (mystacial pads for felids / carnivores)
  if (S.whiskerPads) {
    const sWp = s0 + 0.55 * sn, wpL = sn * Lh * 0.28;
    for (const side of [1, -1]) {
      const cWp = tip.clone().addScaledVector(hd, -wpL * 0.65).addScaledVector(hu, OY(sWp) + 0.08 * mt).add(V3(side * sw * cw * 0.38, 0, 0));
      const wpg = ellipsoid(cWp, sw * cw * 0.32, mt * 0.22, wpL, hd.clone().add(V3(side * 0.12, 0, 0)).normalize(), hu, 5, 8);
      emit(B.part('head', { group: 'head' }), wpg, (u, a, P) => paint({ part: 'head', u: sWp, a: side > 0 ? 0.05 : Math.PI - 0.05, P, s0 }), headW);
    }
  }
  // ── eyes with pupils and snug lids
  for (const { c, dir, side } of L.eyes) {
    const eg = ellipsoid(c, eyeR, eyeR * (S.eyeSquash || 1), eyeR, dir, hu, Math.round(8 * det + 2), 2 * Math.round(6 * det + 2));
    const pupil = S.pupil || 'round';
    emit(B.part('eyes', { group: 'head' }), eg, (u, a, P) => {
      if (S.turret && u < 0.8) return paint({ part: 'lid', u, a, P });
      const front = u > 0.8;
      if (!front) return 'eye';
      if (pupil === 'slit') return u > 0.82 && Math.abs(Math.cos(a)) < (S.slitW ?? 0.22) ? 'pupil' : 'eye';
      if (pupil === 'bar') return u > 0.84 && Math.abs(Math.sin(a)) < 0.3 ? 'pupil' : 'eye';
      return u > 0.86 ? 'pupil' : 'eye';
    }, headW);
    if (det >= 0.9 && S.lids !== false) {
      const bas = basisFrom(dir, hu), ring = [];
      const lidFwd = S.lidFwd ?? 0.16, lidThk = S.lidThk ?? 0.085;
      const canthal = (S.canthalTilt ?? (S.pupil === 'slit' ? 10 : 0)) * DEG * side;
      const cosC = Math.cos(canthal), sinC = Math.sin(canthal);
      for (let i = 0; i < 14; i++) {
        const t = (i / 14) * TAU;
        const xRaw = Math.cos(t) * eyeR * 0.95;
        const yRaw = Math.sin(t) * eyeR * 0.95 * (S.eyeSquash || 1);
        const xRot = xRaw * cosC - yRaw * sinC;
        const yRot = xRaw * sinC + yRaw * cosC;
        ring.push(c.clone().addScaledVector(dir, eyeR * lidFwd).addScaledVector(bas.s, xRot).addScaledVector(bas.u, yRot));
      }
      const lg = loft({ pts: ring, closed: true, seg: 14, rad: 5, w: eyeR * lidThk, ht: eyeR * lidThk, hb: eyeR * lidThk, up: dir });
      emit(B.part('eyelids', { group: 'head' }), lg, (u, a, P) => paint({ part: 'lid', u, a, P }), headW);
    }
  }
  // ── nose rhinarium
  if (S.nose === 'feline' || S.noseStyle === 'feline') {
    const p = g.at(0.995, Math.PI / 2).p;
    const nw = (S.noseW ?? 0.34) * sw * cw, nh = (S.noseH ?? 0.26) * mt, nd = (S.noseD ?? 0.14) * mt;
    const fwd = hd.clone().addScaledVector(hu, -0.05).normalize();
    const nTop = p.clone().addScaledVector(fwd, nd * 0.2).addScaledVector(hu, -nh * 0.05);
    const nMid = p.clone().addScaledVector(fwd, nd * 0.45).addScaledVector(hu, -nh * 0.45);
    const nBot = p.clone().addScaledVector(fwd, nd * 0.25).addScaledVector(hu, -nh * 0.95);
    const npts = [nTop, nMid, nBot];
    const ng = loft({
      pts: npts, seg: 4, rad: 8,
      w: (u) => nw * (u < 0.25 ? lerp(0.82, 1.0, u / 0.25) : lerp(1.0, 0.18, (u - 0.25) / 0.75)),
      ht: (u) => nd * (0.9 - 0.5 * u), hb: (u) => nd * (0.9 - 0.5 * u),
      up: fwd, cap0: { type: 'round', len: 0.25, n: 2 }, cap1: { type: 'round', len: 0.2, n: 2 },
    });
    emit(B.part('nose', { group: 'head' }), ng, 'nose', headW);
    // nostril hollows
    for (const side of [1, -1]) {
      const nst = nMid.clone().addScaledVector(fwd, nd * 0.12).add(V3(side * nw * 0.65, 0, 0)).addScaledVector(hu, -nh * 0.1);
      const slit = ellipsoid(nst, nw * 0.15, nh * 0.12, nd * 0.22, hd, hu, 3, 5);
      emit(B.part('nose', { group: 'head' }), slit, 'mouth', headW);
    }
  } else if (S.nose === 'pad') {
    // Digital Diorama revision 7: the pad sits on the front of the rounded muzzle cap, its upper part level with the top of
    // the muzzle (it was placed from the end of the skull's path, so the longer caps of wolves, bears, otters and rodents
    // swallowed it and they had no nose)
    // (`padW`, `padH`, `padD`: its size, multipliers; `padUp`: its centre above the cap's apex, × muzzle height)
    const rz = mt * 0.22 * (S.padD ?? 1), A = g.tip1 || tip;
    const c = A.clone().addScaledVector(hu, mt * (S.padUp ?? 0.2)).addScaledVector(hd, -rz * 0.3);
    const ng = ellipsoid(c, sw * cw * 0.48 * (S.padW ?? 1), mt * 0.38 * (S.padH ?? 1), rz, hd.clone().addScaledVector(hu, 0.25).normalize(), hu, 5, 10);
    emit(B.part('nose', { group: 'head' }), ng, 'nose', headW);
  } else if (S.nose === 'muzzle' || S.nose === 'disc') {
    for (const side of [1, -1]) {
      const nA = S.nostrilA ?? 0.32, { p, n } = g.at(S.nose === 'disc' ? 0.999 : (S.nostrilS ?? 0.975), side > 0 ? nA : Math.PI - nA);
      const r = (S.nostril || 0.28) * Math.min(sw * cw, mt);
      // (Digital Diorama revision 7: `nostrilSlit`, closable slits slanting down and out, a camel's)
      const ng = S.nostrilSlit ? ellipsoid(p.addScaledVector(n, -r * 0.3), r * 0.2, r * 1.25, r * 0.4, n, hu.clone().applyAxisAngle(n, side * S.nostrilSlit * DEG), 4, 8)
        : ellipsoid(p.addScaledVector(n, -r * 0.45), r * 0.7, r, r * 0.55, n, hu, 4, 8);
      emit(B.part('nose', { group: 'head' }), ng, S.nose === 'disc' ? 'mouth' : 'nose', headW);
    }
  }
  // ── rodent / lagomorph incisors
  if (S.incisors > 0) for (const side of [1, -1]) {
    const b = g.at(0.985, 1.5 * Math.PI + side * 0.1).p, dn = hu.clone().multiplyScalar(-1).addScaledVector(hd, 0.1).normalize(), Li = S.incisors * Lh;
    // (Digital Diorama revision 7: `incisorW`, the width × length; a beaver's are broad chisels)
    const ig = loft({ pts: [b.clone().addScaledVector(dn, -Li * 0.3), b.clone().addScaledVector(dn, Li)], seg: 2, rad: 6, w: Li * (S.incisorW ?? 0.22), ht: Li * 0.12, hb: Li * 0.12, up: hd, cap0: 'flat', cap1: { type: 'round', len: 0.3, n: 2 }, bend: 0 });
    emit(B.part('teeth', { group: 'head' }), ig, 'teeth', headW);
  }
  // ── teeth (canines / fangs)
  if (S.fang > 0) {
    for (const side of [1, -1]) {
      const up = g.at(s0 + 0.66 * sn, 1.5 * Math.PI + side * 0.42);
      // (Digital Diorama revision 9: rooted inside the upper lip, so with the mouth closed the canines are covered by the lips
      // and the lower jaw instead of jutting out at the corners of the mouth)
      up.p.x *= (1 - lipIn) * 0.8;
      const dn = hu.clone().multiplyScalar(-1).addScaledVector(hd, 0.12).normalize(), Lf = S.fang * Lh;
      const tg = tube([up.p.clone().addScaledVector(dn, -Lf * 0.25), up.p.clone().addScaledVector(dn, Lf * 0.5), up.p.clone().addScaledVector(dn, Lf).addScaledVector(hd, -Lf * 0.12)], (u) => Lf * 0.16 * (1 - u * 0.92), 5, 5, { cap1: 'point', cap0: 'flat' });
      emit(B.part('teeth', { group: 'head' }), tg, 'teeth', headW);
      const lo = jg.at(0.82, Math.PI / 2 + side * 0.5), Lb = Lf * 0.75;
      const lg = tube([lo.p.clone().addScaledVector(hu, -Lb * 0.3), lo.p.clone().addScaledVector(hu, Lb * 0.45), lo.p.clone().addScaledVector(hu, Lb).addScaledVector(hd, Lb * 0.08)], (u) => Lb * 0.16 * (1 - u * 0.92), 5, 5, { cap1: 'point', cap0: 'flat' });
      emit(B.part('teeth', { group: 'head' }), lg, 'teeth', rig.W('Jaw'));
    }
  }
  // Digital Diorama revision 7: a woolly cap over the crown and forehead (`woolCap`, its size; sheep), set into the skull
  // with a curly surface in the fleece colour (the face was a plain dark tube)
  if (S.woolCap) {
    const sCap = Math.max(0.12, sEye * 0.62), top = g.at(sCap, Math.PI / 2).p, k = S.woolCap;
    const ry = HT(sCap) * 0.5 * k, c = top.clone().addScaledVector(hu, -ry * 0.78).addScaledVector(hd, -0.06 * Lh);
    emit(B.part('head', { group: 'head' }), ellipsoid(c, W(sCap) * 0.98 * k, ry, (sEye + 0.04) * Lh * 0.6 * k, hd, hu, Math.round(6 * det + 2), 2 * Math.round(6 * det + 2),
      (u, a) => 0.16 * (fbm(Math.cos(a) * 5 + u * 9, Math.sin(a) * 5, u * 7, 13) - 0.5) * 2 * Math.sin(Math.PI * u)), 'body', headW);
  }
  if (S.ear && S.ear.style !== 'none') tetraEars(B, S, L);
  return g;
}

const EAR_PROFILES = {
  pointed: [[0, 0.82], [0.25, 1], [0.62, 0.6], [1, 0.03]],
  prick: [[0, 0.95], [0.22, 1.0], [0.55, 0.65], [0.82, 0.35], [1, 0.04]],
  feline: [[0, 1.0], [0.18, 0.90], [0.45, 0.66], [0.72, 0.40], [0.92, 0.18], [1, 0.03]],
  round: [[0, 0.72], [0.35, 1], [0.72, 0.86], [0.93, 0.48], [1, 0.06]],
  long: [[0, 0.5], [0.25, 0.92], [0.6, 1], [0.86, 0.68], [1, 0.08]],
  floppy: [[0, 0.55], [0.25, 0.95], [0.55, 1.0], [0.82, 0.78], [1, 0.28]],
  hound: [[0, 0.45], [0.2, 0.88], [0.45, 1.0], [0.75, 0.95], [0.92, 0.68], [1, 0.22]],
  semiPrick: [[0, 0.90], [0.28, 1.0], [0.58, 0.72], [0.82, 0.42], [1, 0.05]],
  button: [[0, 0.78], [0.30, 1.0], [0.65, 0.78], [0.90, 0.42], [1, 0.10]],
  rose: [[0, 0.70], [0.35, 1.0], [0.70, 0.72], [1, 0.12]],
  bat: [[0, 0.88], [0.30, 1.05], [0.60, 0.96], [0.85, 0.74], [1, 0.22]],
  fan: [[0, 0.62], [0.28, 1], [0.72, 0.96], [0.94, 0.5], [1, 0.12]],
  tufted: [[0, 0.82], [0.25, 1], [0.62, 0.58], [1, 0.03]],
};
/**
 * Elephant ear (Digital Diorama revision 6): a great fan hung from the side of the head just behind the eye and draped
 * back over the neck and shoulder, outside the body (the generic pinna sweep left it buried inside the neck). The
 * outline follows an African elephant's: the top edge level with the crown, the back edge curving down to a lobe at the
 * lower front. Sizes are fractions of the shoulder height: fanH (height), fanW (width), fanTop (how much of it rises
 * above the eye), fanGap (front edge behind the eye), fanClear (gap to the body).
 */
function tetraFanEar(B, S, L, side) {
  const E = S.ear, rig = B.rig, det = B.det, H = L.H;
  const eye = (L.eyes.find(e => e.side === side) || L.eyes[0]).c;
  const hgt = (E.fanH ?? 0.55) * H, wid = (E.fanW ?? 0.36) * H;
  const top = eye.y + (E.fanTop ?? 0.32) * hgt, zF = eye.z - (E.fanGap ?? 0.07) * H;
  let headX = 0;
  for (const row of L.head.rows) for (const q of row) if (Math.abs(q.z - zF) < 0.15 * L.Lh) headX = Math.max(headX, Math.abs(q.x));
  // outline: how far back the back edge and the front edge lie at each height (fractions of the width); the top-back
  // corner is rounded, the back edge sweeps down and forward to the lobe, the free front edge falls back below the
  // attachment and curves forward again into the lobe
  // Digital Diorama revision 7: the front edge was a straight vertical line and the fan one flat sheet. The front edge now
  // rounds over at the top, bulges forward where the ear joins the temple and falls back to the lobe; the top margin is
  // rolled outward and down (a curled rim), the back margin turns out a little, and two soft folds run from the root
  // toward the lower back edge. Every point stays outside the head and body.
  const backP = prof([[0, 0.5], [0.08, 0.82], [0.25, 1], [0.5, 0.97], [0.72, 0.78], [0.88, 0.45], [1, 0.12]]);
  const frontP = prof([[0, 0.16], [0.07, 0.04], [0.2, 0], [0.38, 0.03], [0.58, 0.12], [0.76, 0.17], [0.9, 0.13], [1, 0.06]]);
  const topY = prof([[0, 0], [0.5, 0.02], [0.8, 0.07], [1, 0.16]]);
  const clear = (E.fanClear ?? 0.03) * H;
  const f = (u, v) => {
    const curl = 1 - sstep(0, 0.16, v);
    const y = top - hgt * (v + topY(u) * (1 - v)) + 0.03 * wid * curl * curl * Math.sin(Math.PI * clamp(u * 1.2, 0, 1));
    const z = lerp(zF - wid * frontP(v), zF - wid * backP(v), u);
    const body = sideXAt(L, z, y), base = Math.max(headX * 0.9, body > 0 ? body + clear : 0);
    const belly = 0.06 * wid * Math.sin(Math.PI * u) * (1 - 0.6 * v);
    const rim = 0.11 * wid * curl * curl * sstep(0, 0.12, u) + 0.04 * wid * sstep(0.82, 1, u) * (1 - 0.5 * v);
    const folds = 0.032 * wid * Math.sin(TAU * (1.45 * u + 0.75 * v) - 0.6) * sstep(0.12, 0.45, u) * (1 - 0.35 * v);
    const x = Math.max(base + belly + rim + folds, body > 0 ? body + clear * 0.6 : 0, headX * 0.88);
    return V3(side * x, y, z);
  };
  const bone = side > 0 ? 'EarL' : 'EarR';
  rig.add(bone, 'Head', f(0, 0.04), f(0.15, 1));
  sheet(B.part('ears', { group: 'ears' }), { nu: Math.round(10 * det + 2), nv: Math.round(10 * det + 2), f,
    th: (u, v) => H * lerp(0.016, 0.006, u) * (1 + 0.6 * (1 - sstep(0, 0.12, v))),
    zone: (u, v, face) => face !== 0 && (face === 1) === (side > 0) ? 'skin' : B.paint({ part: 'ear', u: v, a: u * TAU, P: f(u, v) }),
    skin: (u) => u < 0.16 ? rig.W2('Head', bone, u / 0.16) : rig.W(bone) });
}

/** Half-width of the head, jaw and neck at a height and a fore-aft position (for things that lie against them). */
function headSideX(L) {
  if (L.headSideX) return L.headSideX;
  const cell = 0.04 * L.Lh, m = new Map();
  const key = (y, z) => `${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (const g of [L.head, L.jaw, L.torso]) if (g) for (const row of g.rows) for (const q of row) { const k = key(q.y, q.z); if (Math.abs(q.x) > (m.get(k) || 0)) m.set(k, Math.abs(q.x)); }
  L.headSideX = (y, z) => {
    const cy = Math.floor(y / cell), cz = Math.floor(z / cell); let best = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) best = Math.max(best, m.get(`${cy + dy},${cz + dz}`) || 0);
    return best;
  };
  return L.headSideX;
}

/** Cupped, thickened ear membranes swept along a (possibly drooping or folded) axis. */
function tetraEars(B, S, L) {
  const E = S.ear, rig = B.rig, det = B.det, g = L.head, hd = L.hd, hu = L.hu;
  const Le = E.len * L.Lh, wMax = E.w * Le, wp = prof(EAR_PROFILES[E.style] || EAR_PROFILES.pointed);
  const isHanging = E.style === 'floppy' || E.style === 'hound' || (E.droop ?? 0) > 0.4 || E.hang !== undefined;
  for (const side of [1, -1]) {
    if (E.style === 'fan') { tetraFanEar(B, S, L, side); continue; }
    // The pinna rises from a narrow stalk buried 0.3 wMax inside the skull and flares to full width just
    // above the surface, so the root never floats off a curving skull (the sweep is lengthened to keep
    // the visible ear length unchanged).
    const inset = wMax * 0.3, LeT = Le + inset * 0.4;
    const rootF = (u) => lerp(0.42, 1, sstep(0, 0.24, u));
    const down = V3(side * 0.02, -0.99, 0.06).normalize();
    const face = hd.clone().applyAxisAngle(V3(0, 1, 0), side * (E.turn ?? 25) * DEG);
    const cup = E.cup ?? 0.35;
    const innerW = E.innerW ?? 0.55, innerLen = E.innerLen ?? 0.82;
    // offset > 0 moves the flap behind its root line (an elephant's ear hangs back from its front edge)
    const off = E.offset ?? 0, thick = E.thick ?? 1;
    // the ear for a root set `aR` radians round the skull from the crown: its root, axis path and flap surface
    const build = (aR, sprAdd = 0) => {
      const { p, n } = g.at(E.s ?? 0.2, Math.PI / 2 - side * aR);
      const base = p.clone().addScaledVector(n, -inset);
      let axis;
      if (isHanging) {
        // root direction: out to the side by `spread`, pitched down by `hang` (12.5° matches a hound's ear set)
        const hang = (E.hang ?? 12.5) * DEG, spr = (E.spread ?? 20) * DEG;
        axis = V3(side * Math.sin(spr) * Math.cos(hang), -Math.sin(hang), Math.cos(spr) * 0.08 * Math.cos(hang)).normalize();
      } else {
        const spr = (E.spread ?? 25) + sprAdd;
        axis = hu.clone().multiplyScalar(Math.cos(spr * DEG)).add(V3(side * Math.sin(spr * DEG), 0, 0)).normalize();
        axis.applyAxisAngle(V3(1, 0, 0), -(E.tilt ?? 15) * DEG);
      }
      const N = 12, cs = [base.clone()], dirs = [];
      for (let i = 0; i < N; i++) {
        const u = i / N;
        let d;
        if (E.style === 'semiPrick') {
          const breakU = E.breakU ?? 0.58;
          const tipDir = hd.clone().multiplyScalar(0.7).addScaledVector(hu, -0.45).add(V3(side * 0.1, 0, 0)).normalize();
          const tBreak = clamp((u - breakU) / (1 - breakU), 0, 1);
          d = axis.clone().lerp(tipDir, Math.pow(tBreak, 1.3)).normalize();
        } else if (E.style === 'button') {
          const foldDir = hd.clone().multiplyScalar(0.85).addScaledVector(hu, -0.5).add(V3(side * 0.08, 0, 0)).normalize();
          const tFold = clamp((u - 0.12) / 0.5, 0, 1);
          d = axis.clone().lerp(foldDir, Math.pow(tFold, 1.4)).normalize();
        } else if (E.style === 'rose') {
          const foldDir = hd.clone().multiplyScalar(-0.8).addScaledVector(hu, -0.3).add(V3(side * 0.35, 0, 0)).normalize();
          const tFold = clamp((u - 0.12) / 0.5, 0, 1);
          d = axis.clone().lerp(foldDir, Math.pow(tFold, 1.4)).normalize();
        } else if (isHanging) {
          const droopPower = E.style === 'hound' ? 0.7 : 0.9;
          const droopFactor = clamp((E.droop ?? 0.95) * Math.pow(u, droopPower), 0, 1);
          d = axis.clone().lerp(down, droopFactor).normalize();
        } else {
          d = axis.clone().lerp(down, clamp((E.droop || 0) * Math.pow(u + 0.08, 1.2), 0, 1)).normalize();
        }
        dirs.push(d);
        cs.push(cs[i].clone().addScaledVector(d, LeT / N));
      }
      dirs.push(dirs[N - 1]);
      const at = (u) => {
        const f = u * N, i = Math.min(N - 1, Math.floor(f)), t = f - i;
        return { c: cs[i].clone().lerp(cs[i + 1], t), d: dirs[i].clone().lerp(dirs[i + 1], t).normalize() };
      };
      const flap = (u, v) => {
        const { c, d } = at(u);
        const sUp = new THREE.Vector3().crossVectors(face, d).normalize();
        let s;
        if (isHanging) {
          // Pendant ear flap hangs against the cheek: width runs fore-aft in WORLD space (not along
          // the muzzle axis, which on a steeply angled head such as an elephant's points downward and
          // would turn the flap into a vertical fin); the normal faces laterally outward.
          let sHang = V3(0, 0, -side);
          sHang.addScaledVector(d, -sHang.dot(d)).normalize();
          const hangT = E.style === 'fan' ? 1 : clamp(0.45 + Math.pow(u, 0.5) * 1.2, 0, 1);
          s = sUp.clone().lerp(sHang, hangT).normalize();
        } else {
          s = sUp;
        }
        const fc = new THREE.Vector3().crossVectors(d, s).normalize();
        const w = wMax * wp(u) * rootF(u), x = 2 * v - 1;
        const cupU = lerp(cup, Math.max(cup, 0.95), 1 - sstep(0.04, 0.42, u)) * (isHanging ? 0.7 : 1);
        return c.addScaledVector(s, w * (x + off) * side).addScaledVector(fc, cupU * w * (x * x - 0.35));
      };
      return { p, n, base, axis, cs, at, flap, N };
    };
    let aR = E.a ?? 0.75, sprAdd = 0, ear = build(aR);
    // Digital Diorama revision 7: big erect ears set close together crossed over the crown (coyotes, wolves, foxes): the
    // root moves out round the skull until the inner edge, where the ear reaches its full width, clears the midline, and
    // ears too big for the skull (a fennec's) also spread outward
    if (!isHanging && E.style !== 'rose' && E.style !== 'button') {
      const innerX = (e) => { let m = Infinity; for (const u of [0.1, 0.18, 0.26, 0.36]) for (const v of [0, 1]) m = Math.min(m, side * e.flap(u, v).x); return m; };
      for (let k = 0; k < 16 && innerX(ear) < 0.08 * wMax; k++) { if (aR < (E.a ?? 0.75) + 0.35) aR += 0.035; else if (sprAdd < 15) sprAdd += 2.5; else break; ear = build(aR, sprAdd); }
    }
    const { p, n, base, axis, cs, at, flap, N } = ear;
    const bone = side > 0 ? 'EarL' : 'EarR';
    rig.add(bone, 'Head', base, cs[N]);
    // ear-base mound (auricular muscles): hides the pinch where the pinna enters the skull
    if (E.mound !== false) {
      // Digital Diorama revision 6: sunk mostly inside the skull, so it only fills the crease round the ear root
      // (it stood out as a knob, and with a hanging ear read as a ram's horn)
      const mr = wMax * (E.moundR ?? 0.3), mc = p.clone().addScaledVector(n, -mr * 0.5).addScaledVector(axis, mr * 0.1);
      emit(B.part('head', { group: 'head' }), ellipsoid(mc, mr, mr * 0.7, mr * 1.05, hd, n, 5, 10), (uu, aa, P) => B.paint({ part: 'head', u: E.s ?? 0.2, a: Math.PI / 2, P, s0: L.headS.s0 }), rig.W2('Head', bone, 0.35));
    }
    const part = B.part('ears', { group: 'ears' });
    // Digital Diorama revision 6: a hanging ear lies against the side of the head; below its root it is kept outside the
    // skull, cheek and neck (it either stood off the head as a disc or, hung steeply, sank into the cheek).
    // Digital Diorama revision 7: pushed out row by row (the most any point of a row needs), spread over the neighbouring rows
    // and smoothed along the ear, so the flap lies flat and bends smoothly (pushed point by point, it followed the coarse
    // grid of headSideX and kinked)
    let pushAt = null;
    if (isHanging) {
      const outside = headSideX(L), clear = 0.025 * L.Lh + 0.5 * wMax * 0.14, NU = 32, NV = 8, need = [];
      for (let i = 0; i <= NU; i++) {
        const u = i / NU, k = sstep(0.06, 0.22, u);
        let m = 0;
        for (let j = 0; j <= NV; j++) { const q = flap(u, j / NV), sx = outside(q.y, q.z); if (sx > 0) m = Math.max(m, (sx + clear - Math.abs(q.x)) * k); }
        need.push(m);
      }
      const R = 3, dil = need.map((_, i) => Math.max(...need.slice(Math.max(0, i - R), i + R + 1)));
      const sm = dil.map((_, i) => { let t = 0; for (let d = -R; d <= R; d++) t += dil[clamp(i + d, 0, NU)]; return t / (2 * R + 1); });
      pushAt = (u) => { const f = clamp(u, 0, 1) * NU, i = Math.min(NU - 1, Math.floor(f)); return lerp(sm[i], sm[i + 1], f - i) * sstep(0.02, 0.16, u); };
    }
    sheet(part, {
      nu: Math.round((E.style === 'long' || E.style === 'fan' || E.style === 'hound' ? 10 : 7) * det + 1),
      nv: Math.round(5 * det + 1),
      f: (u, v) => { const q = flap(u, v); if (pushAt) q.x += side * pushAt(u); return q; },
      th: (u, v) => Math.max(0.0006, thick * wMax * 0.14 * (1 - 0.7 * (2 * v - 1) ** 2) * (1 - 0.55 * u)),
      zone: (u, v, face) => (face > 0) === (side > 0) && Math.abs(2 * v - 1) < innerW && u < innerLen && u > 0.05 ? 'skin' : B.paint({ part: 'ear', u, a: v * TAU, P: at(u).c }),
      skin: (u) => u < 0.18 ? rig.W2('Head', bone, u / 0.18) : rig.W(bone),
    });
    if (E.style === 'tufted') {
      const { c, d } = at(1);
      emit(B.part('ears', { group: 'ears' }), tube([c.clone().addScaledVector(d, -LeT * 0.05), c.clone().addScaledVector(d, LeT * 0.35)], (u) => wMax * 0.12 * (1 - u), 4, 4, { cap1: 'point' }), 'marking', rig.W(bone));
    }
  }
}

/* ════════════════════════════════════════════════════════════════════════════
 *  HIND LIMB LAYOUT (Digital Diorama revision 4: hind legs checked against skeletons and photos)
 *  The old layout put the stifle on the belly line and derived the hock from body depth, so deep-bodied
 *  ungulates stood on posts with a kink, fetlocks sat at 4-7 % of the height (no pasterns), plantigrade
 *  shins sloped back ~30° and folded rodent legs hung below the body as a "V". Landmarks are now
 *  fractions of the hip-joint height h, read off real skeletons: stifle (kY, kZ), hock / ankle (aY, aZ),
 *  fetlock / paw joint (fY, fZ) and coronet (cY); Z is forward of the hip joint. Plantigrade and crouched
 *  feet give the heel → toe length (`foot`), digitigrade paws the paw-joint → toe length (`toe`).
 *  Species override any of these with `hind: {...}`.
 * ════════════════════════════════════════════════════════════════════════════ */
const HIND_LAYOUT = {
  // horse: hip joint 1.3 m, stifle 0.9, hock 0.6 (under the point of buttock), fetlock 0.24, coronet 0.08
  ungulate: { kY: 0.70, kZ: 0.15, aY: 0.46, aZ: -0.09, fY: 0.17, fZ: -0.075, cY: 0.062, pastern: 55, wall: 52 },
  // wolf: stifle in the flank fold well forward of the hip, hock a third of the way up, upright rear pastern
  digitigrade: { kY: 0.67, kZ: 0.19, aY: 0.31, aZ: -0.12, fY: 0.075, fZ: -0.095, toe: 0.13 },
  // bear: knee about half way up, shin near vertical, heel under the hip, a long sole reaching forward
  plantigrade: { kY: 0.48, kZ: 0.11, aY: 0.1, aZ: -0.035, foot: 0.36 },
  // elephant: a straight column, the knee low on the leg, the ankle a fifth of the way up
  graviportal: { kY: 0.52, kZ: 0.08, aY: 0.2, aZ: -0.03, fY: 0.06 },
  // rabbit / squirrel / mouse at rest: the knee folded forward inside the flank, heel at the rear, long foot flat
  crouch: { kY: 0.52, kZ: 0.38, aY: 0.07, aZ: -0.19, foot: 0.62 },
};
/** Merged hind layout for a species (`kind` = the HIND_LAYOUT entry it starts from). */
function hindLayoutFor(S, st) {
  const kind = st === 'digitigrade' && (S.crouch || 0) >= 0.5 ? 'crouch' : HIND_LAYOUT[st] ? st : 'digitigrade';
  return { kind, ...HIND_LAYOUT[kind], ...(S.hind || {}) };
}
/** How far ahead of its joint a pad foot's front edge meets the ground (matches the pad loft in tetraFoot). */
const padReach = (j) => 1.2 * Math.max(j.w, j.d);
/** Hip-joint height: the leg root sits this far below the croup. */
const hipHeightOf = (S, L) => L.yR - (S.hipDrop ?? 0.4) * L.Dr;
/**
 * Hoof proportions from the coronet radius r and the coronet height cy: ground half-length a / half-width b,
 * coronary band half-sizes, and how far ahead of the coronet the toe meets the ground (the toe wall slopes
 * forward at `wall` degrees from the ground). Cloven hooves are two claws of half-width b/2.
 */
function hoofDims(S, r, cy, wall = 52) {
  const a = 1.55 * r * (S.hoofLen ?? 1), b = 1.45 * r * (S.hoofW ?? 1), ac = r * 1.05, bc = r * 1.08;
  const toeH = cy + 0.22 * r;
  return { a, b, ac, bc, toeH, heelH: cy * 0.58, toe: ac + toeH / Math.tan(wall * DEG) };
}

/**
 * Limb joint layouts. Each template returns joints top → ground ({p, w, d} with lateral / fore-aft
 * half-thickness) for a stance. Joint heights derive from body depth so leg length is a real rebuild.
 */
function tetraLimbJoints(S, L, front, side) {
  const H = L.H, D = L.D, Lt = L.Lt, U = L.uOf;
  const st = front ? (S.foreStance || S.stance) : (S.hindStance || S.stance);
  const th = (front ? S.foreThk : S.hindThk) || S.legThk || 1;
  const fr = L.torso.frame(front ? lerp(U.chest, U.neckRoot, 0.4) : U.haunch);
  const halfW = front ? L.torsoW(lerp(U.chest, U.neckRoot, 0.4)) : L.torsoW(U.haunch);
  const sx = side * Math.max(0.2 * halfW, halfW * (S.legInset ?? 0.62));
  const sp = (S.splay || 0) * H * side;
  const C = Math.max(0.05 * H, L.elbowY);
  const J = (x, y, z, w, d) => ({ p: V3(x, Math.max(0, y), z), w: w * H * th, d: (d ?? w) * H * th });
  const kneeLift = S.kneeLift || 0;
  if (front) {
    const sz = L.zF - (S.shoulderBack ?? 0.07) * Lt;
    const top = J(sx * 0.32, H - 0.2 * D, L.zF - 0.25 * Lt, 0.034, 0.088);
    const sh = J(sx * 0.8, H - 0.6 * D, sz, 0.055, 0.1);
    if (st === 'sprawl') {
      const lu = (S.limbLen ?? 0.3) * Lt * (S.foreLimb ?? 1), y0 = fr.c.y - 0.05 * D, spl = S.limbSplay ?? 1, k = th;
      const Jl = (x, y, z, w, d) => ({ p: V3(x, Math.max(0, y), z), w: w * lu * k, d: (d ?? w) * lu * k });
      const s1 = Jl(sx * 0.85, y0, sz, 0.17), e1 = Jl(sx * 0.85 + side * lu * 0.92 * spl, Math.max(y0 - lu * 0.15, 0.32 * lu), sz + lu * 0.12, 0.12);
      const w1 = Jl(e1.p.x + side * 0.12 * lu * spl, 0.14 * lu, e1.p.z + 0.05 * lu, 0.085), p1 = Jl(w1.p.x + side * 0.1 * lu * spl, 0.045 * lu, w1.p.z + 0.18 * lu, 0.075, 0.04);
      return { st, foot: S.flippers ? 'flipper' : 'hand', lu, joints: [Jl(sx * 0.4, y0 + 0.12 * D, sz - 0.08 * Lt, 0.13), s1, e1, w1, p1, Jl(p1.p.x + side * 0.18 * lu * spl, 0.01 * lu, p1.p.z + 0.42 * lu, 0.03)] };
    }
    if (st === 'arm') {
      const y0 = H - 0.55 * D, a = S.armLen || 0.4;
      return { st, foot: 'hand', joints: [top, J(sx, y0, sz, 0.05), J(sx + side * 0.03 * H, y0 - 0.45 * a * H, sz - 0.1 * a * H, 0.042), J(sx + side * 0.05 * H, y0 - 0.65 * a * H, sz + 0.28 * a * H, 0.03), J(sx + side * 0.05 * H, y0 - 0.72 * a * H, sz + 0.42 * a * H, 0.022), J(sx + side * 0.05 * H, y0 - 0.8 * a * H, sz + 0.52 * a * H, 0.012)] };
    }
    const el = J(sx * 0.98 + sp * 0.3, C + 0.03 * H, sz - 0.075 * H, 0.058, 0.07);
    if (st === 'ungulate') {
      // Digital Diorama revision 4: the fetlock and coronet match the hind leg's (they sat at 4-7 % of the height,
      // leaving no pastern); the front pastern slopes a little flatter than the hind (~50° from the ground)
      const hl = hindLayoutFor(S, 'ungulate'), h = hipHeightOf(S, L), fy = (hl.fFY ?? hl.fY) * h, cy = hl.cY * h;
      const ca = J(sx * 0.93 + sp * 0.6, Math.max(0.53 * C, fy + 0.14 * h), el.p.z + 0.01 * H, 0.04, 0.045);
      const fe = J(sx * 0.9 + sp, fy, ca.p.z + 0.005 * H, 0.032, 0.04);
      const co = J(sx * 0.9 + sp, cy, fe.p.z + (fy - cy) / Math.tan((hl.pasternF ?? 50) * DEG), 0.03, 0.032);
      const hd = hoofDims(S, co.w * 1.05, cy, hl.wall);
      return { st, foot: 'hoof', joints: [top, sh, el, ca, fe, co, J(sx * 0.9 + sp, 0, co.p.z + hd.toe, 0.03)] };
    }
    if (st === 'plantigrade') {
      const wr = J(sx * 0.95 + sp, 0.075 * H, el.p.z + 0.03 * H, 0.04, 0.042);
      return { st, foot: 'sole', joints: [top, sh, el, wr, J(sx * 0.95 + sp, 0.03 * H, wr.p.z + 0.1 * H * (S.footLen || 1), 0.042, 0.02), J(sx * 0.95 + sp, 0.012 * H, wr.p.z + 0.17 * H * (S.footLen || 1), 0.035, 0.012)] };
    }
    if (st === 'graviportal') {
      const wr = J(sx * 0.95 + sp, 0.22 * C, el.p.z + 0.02 * H, 0.05, 0.052);
      // Digital Diorama revision 7: the ground contact is the front edge of the pad (it was 1 cm ahead of the wrist, near the
      // pad's middle, so rolling over it at push-off sank the front of the foot 2-5 cm into the ground)
      const pj = J(sx * 0.95 + sp, 0.045 * H, wr.p.z + 0.01 * H, 0.056, 0.058);
      return { st, foot: 'pad', joints: [top, sh, el, wr, pj, J(sx * 0.95 + sp, 0, pj.p.z + padReach(pj), 0.06)] };
    }
    // digitigrade
    const wr = J(sx * 0.94 + sp, 0.26 * C, el.p.z + 0.005 * H, 0.038, 0.04);
    const pw = J(sx * 0.93 + sp, 0.045 * H, wr.p.z + 0.045 * H, 0.034, 0.033);
    return { st, foot: 'paw', joints: [top, sh, el, wr, pw, J(sx * 0.93 + sp, 0.012 * H, pw.p.z + 0.075 * H * (S.footLen || 1), 0.022, 0.012)] };
  }
  // Hip (acetabulum) sits mid-pelvis, well inside the haunch mass: the thigh root is buried in the
  // rump (no exposed cap behind the quarters) and the femur angles forward-down to a stifle at the
  // flank, so the quarters read as one continuous muscle from croup to gaskin. The upper thigh is a
  // deep (fore-aft) but narrow (lateral) slab that lies flush with the flank.
  // REVISED HIND ROOT: the thigh is no longer a 0.06H tube poked into the underside of the rump. The
  // quarter is a deep (fore-aft) but laterally slim mass sized from the BODY (rump depth / haunch
  // half-width), whose outer face lies flush with the flank. It rises from an ilium root buried under
  // the croup (`pre`, emitted only as part of the leg sweep), passes the hip joint and narrows to the
  // stifle at the flank fold, so croup → buttock → gaskin reads as one continuous muscle.
  const grav = st === 'graviportal';
  const hz = L.zB + (S.hipFwd ?? 0.22) * Lt;
  const hy = L.yR - (S.hipDrop ?? 0.4) * L.Dr;
  const thighW = (S.thighW ?? (grav ? 0.42 : 0.36)) * halfW * Math.sqrt(th);
  const thighD = (S.thighD ?? (grav ? 0.4 : 0.42)) * L.Dr * Math.sqrt(th);
  const hipX = side * Math.max(0.2 * halfW, halfW * 1.03 - thighW);
  const hip = { p: V3(hipX, hy, hz - 0.035 * Lt), w: thighW, d: thighD };
  // the ilium root sits well below the croup (at the croup's surface its rounded end poked out as a knob on the rump)
  const pre = { p: V3(hipX * 0.62, L.yR - 0.3 * L.Dr, hz - 0.06 * Lt), w: thighW * 0.72, d: thighD * 0.72 };
  const cr = S.crouch || 0;
  if (st === 'sprawl' || st === 'frog') {
    const lu = (S.limbLen ?? 0.3) * Lt * (S.hindLimb ?? 1.15), spl = S.limbSplay ?? 1, k = th, fy = hy;
    const Jl = (x, y, z, w, d) => ({ p: V3(x, Math.max(0, y), z), w: w * lu * k, d: (d ?? w) * lu * k });
    if (st === 'frog') {
      // folded jumping leg: thigh forward-out, shin back, long tarsus forward along the ground
      const h0 = Jl(sx * 0.6, fy, hz, 0.2), kn2 = Jl(sx * 0.6 + side * lu * 0.55 * spl, Math.max(fy * 0.55, 0.22 * lu), hz + lu * 0.85, 0.15);
      const an = Jl(kn2.p.x + side * lu * 0.12, 0.16 * lu, hz - lu * 0.05, 0.1), so = Jl(an.p.x + side * lu * 0.05, 0.05 * lu, an.p.z + lu * 0.55, 0.075, 0.04);
      return { st, foot: S.flippers ? 'flipper' : 'hand', lu, joints: [h0, kn2, an, so, Jl(so.p.x + side * lu * 0.15, 0.01 * lu, so.p.z + lu * 0.7, 0.03)] };
    }
    const h0 = Jl(sx * 0.6, hy, hz, 0.19), kn2 = Jl(sx * 0.6 + side * lu * spl, Math.max(hy - 0.1 * lu, 0.3 * lu), hz + 0.3 * lu, 0.13);
    const an = Jl(kn2.p.x + side * 0.12 * lu * spl, 0.13 * lu, kn2.p.z - 0.25 * lu, 0.09), so = Jl(an.p.x + side * 0.12 * lu * spl, 0.045 * lu, an.p.z + 0.12 * lu, 0.075, 0.04);
    return { st, foot: S.flippers ? 'flipper' : 'hand', lu, joints: [h0, kn2, an, so, Jl(so.p.x + side * 0.3 * lu * spl, 0.01 * lu, so.p.z + 0.5 * lu, 0.03)] };
  }
  if (st === 'biped') {
    const kn = J(sx * 1.04 + sp * 0.2, L.yR - (0.97 + 0.1 * cr) * L.Dr + 0.02 * H, hz + (0.1 * Math.min(H, Lt) + 0.3 * cr * L.yR), 0.06, 0.1);
    const hk = J(sx * 0.95 + sp, (S.hockH ?? 0.3) * (L.yR - 0.45 * L.Dr), hz - 0.16 * H, 0.04, 0.05), pw = J(sx * 0.95 + sp, 0.035 * H, hk.p.z + 0.06 * H, 0.032, 0.03);
    return { st, foot: S.foot || 'talon', joints: [hip, J(sx * 1.05 + sp * 0.2, hy * 0.85, hz + 0.16 * H, 0.08, 0.1), hk, pw, J(sx * 0.95 + sp, 0.01 * H, pw.p.z + 0.13 * H * (S.footLen || 1), 0.025, 0.012)] };
  }
  return tetraHindJoints(S, L, side, st, { J, hip, pre, sx, sp, th, thighW, thighD });
}

/**
 * Hind joints from the HIND_LAYOUT landmarks (Digital Diorama revision 4). Every joint is placed relative
 * to the hip joint, so the leg keeps real proportions whatever the body depth or length.
 */
function tetraHindJoints(S, L, side, st, o) {
  const { J, hip, pre, sx, sp, th, thighW, thighD } = o;
  const lay = hindLayoutFor(S, st), kind = lay.kind, h = hip.p.y, z0 = hip.p.z, H = L.H;
  const kx = sx * 1.03 + sp * 0.2, ax = sx * 0.93 + sp * 0.6, fx = sx * 0.9 + sp;
  // a folded knee stays inside the flank (it hung below the belly)
  const ky = kind === 'crouch' ? Math.max(lay.kY * h, L.yR - 0.98 * L.Dr + 0.1 * h) : lay.kY * h;
  const kn = kind === 'crouch' ? J(kx, ky, z0 + lay.kZ * h, 0.085, 0.13) : J(kx, ky, z0 + lay.kZ * h, 0.06, 0.1);
  const an = J(ax, lay.aY * h, z0 + lay.aZ * h, kind === 'plantigrade' || kind === 'crouch' ? 0.042 : 0.036, 0.05);
  const base = { st, kind, h, lay, pre, thighW, thighD };
  if (kind === 'ungulate') {
    const fe = J(fx, lay.fY * h, z0 + lay.fZ * h, 0.032, 0.04);
    const cy = lay.cY * h, co = J(fx, cy, fe.p.z + (fe.p.y - cy) / Math.tan((lay.pastern ?? 55) * DEG), 0.03, 0.032);
    const hd = hoofDims(S, co.w * 1.05, cy, lay.wall);
    return { ...base, foot: 'hoof', joints: [hip, kn, an, fe, co, J(fx, 0, co.p.z + hd.toe, 0.03)] };
  }
  if (kind === 'graviportal') {
    // (Digital Diorama revision 7: the toe at the front edge of the pad, as for the forefoot)
    const pt = J(fx, lay.fY * h, an.p.z + 0.01 * h, 0.056, 0.06);
    return { ...base, foot: 'pad', joints: [hip, kn, an, pt, J(fx, 0, pt.p.z + padReach(pt), 0.06)] };
  }
  if (kind === 'plantigrade' || kind === 'crouch') {
    // ankle above the heel; ball of the foot about 60 % of the way to the toe tips
    const fl = (lay.foot ?? 0.36) * h;
    return { ...base, foot: 'sole', joints: [hip, kn, an, J(fx, Math.min(an.p.y * 0.42, 0.03 * H), an.p.z + 0.6 * fl, 0.045, 0.02), J(fx, Math.min(an.p.y * 0.16, 0.012 * H), an.p.z + fl, 0.038, 0.012)] };
  }
  // digitigrade: hock a third of the way up, rear pastern near vertical, toes ahead of the paw joint
  const pw = J(fx, lay.fY * h, z0 + lay.fZ * h, 0.034, 0.033);
  return { ...base, foot: 'paw', joints: [hip, kn, an, pw, J(fx, 0.012 * H, pw.p.z + (lay.toe ?? 0.13) * h, 0.022, 0.012)] };
}

/* ════════════════════════════════════════════════════════════════════════════
 *  HIND LEG SURFACE (Digital Diorama revision 4)
 *  A tube swept round the bones made the thigh a narrow pipe hanging under the body with a human-like
 *  knee. Real hind legs are shaped by muscle, not bone: seen from the side the thigh is a broad slab whose
 *  front edge runs from the flank fold to the stifle and whose back edge (the breeches) falls from the
 *  point of buttock to the gaskin, then the Achilles tendon runs straight to the point of hock. The leg is
 *  lofted through that OUTLINE (section centres midway between the front and back edges), so the path is
 *  nearly straight and the quarters read as one mass from croup to hock; it is skinned by joint planes.
 *  Extents are fractions of the hip height h (thigh: × √thickness, lower leg: × thickness).
 * ════════════════════════════════════════════════════════════════════════════ */
const HIND_SHAPE = {
  ungulate: { thighF: 0.16, patella: 0.05, breech: 0.13, hams: 0.035, kneeW: 0.058, gaskF: 0.042, gaskW: 0.055, hockF: 0.04, hockB: 0.068, hockW: 0.042, canF: 0.026, canB: 0.036, canW: 0.026, fetF: 0.036, fetB: 0.05, fetW: 0.034, pastR: 0.026, corR: 0.029, inset: 0.035 },
  digitigrade: { thighF: 0.17, patella: 0.05, breech: 0.11, hams: 0.035, kneeW: 0.062, gaskF: 0.04, gaskW: 0.06, hockF: 0.035, hockB: 0.062, hockW: 0.04, canF: 0.027, canB: 0.032, canW: 0.032, fetF: 0.032, fetB: 0.034, fetW: 0.036, inset: 0.035 },
  plantigrade: { thighF: 0.16, patella: 0.06, breech: 0.08, hams: 0.035, kneeW: 0.095, gaskF: 0.06, gaskW: 0.09, hockF: 0.055, hockB: 0.075, hockW: 0.072, inset: 0.04 },
  crouch: { thighF: 0.2, patella: 0.07, breech: 0, hams: 0, kneeW: 0.1, gaskF: 0.06, gaskW: 0.08, hockF: 0.05, hockB: 0.08, hockW: 0.06, inset: 0.04 },
  graviportal: { thighF: 0.14, patella: 0.06, breech: 0.04, hams: 0.02, kneeW: 0.12, gaskF: 0.07, gaskW: 0.1, hockF: 0.07, hockB: 0.08, hockW: 0.09, canF: 0.075, canB: 0.075, canW: 0.085, fetF: 0.08, fetB: 0.08, fetW: 0.09, inset: 0.04 },
};
/** The torso's rear surface (smallest z) at height y near lateral position x. */
function rearZAt(L, y, x) {
  let best = Infinity;
  const tol = 0.07 * L.Dr, band = 0.45 * L.hw;
  for (const row of L.torso.rows) for (const p of row) if (Math.abs(p.y - y) < tol && Math.abs(p.x - x) < band && p.z < best) best = p.z;
  return best === Infinity ? L.zB : best;
}
/**
 * Skin weights by joint planes: bone i owns the leg between the planes that bisect the joint angles at its
 * two ends (blended over `blend[i]` either side); the top of the thigh shares with the Hips so the quarters
 * stay attached as the leg swings.
 */
function planeSkin(rig, joints, bones, blend, hipsTo = null, rootBone = 'Hips') {
  const J = joints.map(j => j.clone()), n = bones.length, dirs = [];
  for (let i = 0; i < n; i++) dirs.push(J[i + 1].clone().sub(J[i]).normalize());
  const planes = [];
  for (let i = 1; i < n; i++) planes.push({ p: J[i], n: dirs[i - 1].clone().add(dirs[i]).normalize(), w: blend[i - 1] });
  const L0 = J[1].distanceTo(J[0]), d = V3();
  return (u, a, P) => {
    let c = 1;
    const out = [];
    let prev = 1;
    for (let i = 0; i < planes.length; i++) {
      const pl = planes[i];
      c = Math.min(c, sstep(-pl.w, pl.w, d.subVectors(P, pl.p).dot(pl.n)));
      if (prev - c > 1e-4) out.push([rig.i(bones[i]), prev - c]);
      prev = c;
    }
    if (prev > 1e-4) out.push([rig.i(bones[n - 1]), prev]);
    let W = normW(out);
    if (hipsTo) {
      const s = d.subVectors(P, J[0]).dot(dirs[0]) / Math.max(1e-6, L0);
      const leg = sstep(hipsTo[0], hipsTo[1], s);
      if (leg < 1) W = mixW(rig.W(rootBone), W, leg);
    }
    return W;
  };
}
/** Hind leg lofted through its side-view outline (see HIND LEG SURFACE); returns the loft. */
function tetraHindLeg(B, S, L, lm, nm) {
  const det = B.det, rig = B.rig, J = lm.joints, h = lm.h, k = lm.kind;
  const th = (S.hindThk || S.legThk || 1) * (S.hindBulk ?? S.limbBulk ?? 1), tq = Math.sqrt(th);
  const sh = { ...HIND_SHAPE[k], ...(S.hindShape || {}) };
  const hip = J[0].p, K = J[1].p, A = J[2].p, F = k === 'plantigrade' || k === 'crouch' ? null : J[3].p;
  const butt = Math.min(rearZAt(L, hip.y, hip.x) + sh.inset * h, hip.z - 0.08 * h);
  const buttK = Math.min(butt + sh.breech * h, K.z - 0.14 * h);
  // lateral centre: joint x interpolated by height
  const xs = [[lm.pre.p.y, lm.pre.p.x], [hip.y, hip.x], [K.y, K.x], [A.y, A.x], ...(F ? [[F.y, F.x]] : [])];
  const xAt = (y) => { for (let i = 0; i < xs.length - 1; i++) if (y <= xs[i][0] && y >= xs[i + 1][0]) return lerp(xs[i][1], xs[i + 1][1], (xs[i][0] - y) / Math.max(1e-9, xs[i][0] - xs[i + 1][0])); return y > xs[0][0] ? xs[0][1] : xs[xs.length - 1][1]; };
  const st = [];
  // the upper thigh lies within the hip's own surface (it stood out like a saddlebag where the torso narrows)
  const at = (y, zf, zb, w, flush = 0) => {
    const zc = (zf + zb) / 2; let x = xAt(y);
    if (flush) { const wall = sideXAt(L, zc, y); if (wall > 0) x = lm.side * clamp(wall + flush * w - w, 0.15 * L.hw, Math.abs(x)); }
    st.push({ c: V3(x, y, zc), d: Math.max(1e-4, (zf - zb) / 2), w });
  };
  const hT = h * th, achB = A.z - sh.hockB * hT;
  at(lm.pre.p.y, lm.pre.p.z + 0.82 * lm.thighD, lm.pre.p.z - 0.82 * lm.thighD, 0.82 * lm.thighW, -0.1);
  if (k === 'crouch') {
    // folded leg at rest (rabbits, squirrels, mice): one wedge-shaped haunch from the hip down to the heel,
    // its front edge the folded knee and the shin, its back edge the rump falling to the heel
    const heelB = A.z - sh.hockB * hT;
    at(hip.y, hip.z + sh.thighF * h * tq, butt, lm.thighW, 0.1);
    at(lerp(hip.y, K.y, 0.55), lerp(hip.z + sh.thighF * h * tq, K.z + sh.patella * hT, 0.62), lerp(butt, heelB, 0.25), lm.thighW * 0.95, 0.2);
    at(K.y, K.z + sh.patella * hT, lerp(butt, heelB, 0.55), lm.thighW * 0.82);
    at(lerp(K.y, A.y, 0.5), lerp(K.z, A.z, 0.5) + sh.gaskF * hT, lerp(butt, heelB, 0.85), lm.thighW * 0.6);
    at(A.y, A.z + sh.hockF * hT, heelB, sh.hockW * hT);
  } else {
  at(hip.y, hip.z + sh.thighF * h * tq, butt, lm.thighW, -0.15);
  at(lerp(hip.y, K.y, 0.5), lerp(hip.z + sh.thighF * h * tq, K.z + sh.patella * hT, 0.62), lerp(butt, buttK, 0.5) - sh.hams * h * tq, lm.thighW * 0.86, -0.1);
  at(K.y, K.z + sh.patella * hT, buttK, sh.kneeW * hT);
  // gaskin: muscle bulge high on the tibia, then the Achilles tendon straight to the point of hock
  const g1 = lerp(buttK, achB, 0.42);
  at(lerp(K.y, A.y, 0.36), lerp(K.z, A.z, 0.36) + sh.gaskF * hT, g1, sh.gaskW * hT);
  at(lerp(K.y, A.y, 0.72), lerp(K.z, A.z, 0.72) + sh.gaskF * 0.88 * hT, lerp(g1, achB, 0.62), lerp(sh.gaskW, sh.hockW, 0.6) * hT);
  at(A.y, A.z + sh.hockF * hT, achB, sh.hockW * hT);
  if (F) {
    for (const f of [0.3, 0.72]) { const z = lerp(A.z, F.z, f); at(lerp(A.y, F.y, f), z + sh.canF * hT, z - sh.canB * hT, sh.canW * hT); }
    at(F.y, F.z + sh.fetF * hT, F.z - sh.fetB * hT, sh.fetW * hT);
  }
  }
  if (k === 'ungulate') {
    // pastern sections stand square to the pastern
    const C = J[4].p;
    st.push({ c: F.clone().lerp(C, 0.5).add(V3(0, 0, -0.004 * hT)), d: sh.pastR * hT, w: sh.pastR * hT * 0.92, perp: true });
    st.push({ c: C.clone(), d: sh.corR * hT, w: sh.corR * hT, perp: true });
  }
  const pts = st.map(s => s.c), curve = makePath(pts), ku = knotUs(curve, pts.length);
  // horizontal outline extents → extents square to the (slightly tilted) path
  const cosT = st.map((s, i) => { if (s.perp) return 1; const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const t = b.clone().sub(a); return clamp(Math.abs(t.y) / Math.max(1e-9, t.length()), 0.45, 1); });
  const pw = prof(st.map((s, i) => [ku[i], s.w])), pd = prof(st.map((s, i) => [ku[i], s.d * cosT[i]]));
  const g = loft({ curve, seg: Math.round((14 + 2.6 * pts.length) * det), rad: 2 * Math.round(5 * det + 2), w: pw, ht: pd, hb: pd, nt: 2.15, nb: 2.15, up: [0, 0, 1],
    cap0: { type: 'round', len: 0.3, n: 3 }, cap1: { type: 'round', len: 0.45, n: 2 }, bend: 0.5 });
  lm.grid = g; lm.us = ku;
  // joints for skinning: hip, stifle, hock, fetlock / paw joint, coronet
  const nb = lm.bones.length, sj = J.slice(0, nb + 1).map(j => j.p);
  // a folded haunch bends over a wide band at the knee (a narrow one creased it into a corner as the leg stretched)
  const skin = planeSkin(rig, sj, lm.bones, k === 'crouch' ? [0.3 * h, 0.07 * h, 0.04 * h] : [0.11 * h, 0.05 * h, 0.03 * h], k === 'crouch' ? [-0.4, 0.75] : [-0.25, 0.5]);
  // (emitted once every limb root has been blended into the body: blendLimbRoots)
  lm.emitLeg = () => emit(B.part(nm, { group: 'legs' }), g, (u, a, P) => B.paint({ part: 'leg', u, a, P, front: false, side: lm.side }), skin);
  return g;
}

/* ════════════════════════════════════════════════════════════════════════════
 *  FORELEG SURFACE (Digital Diorama revision 5)
 *  Forelegs were tubes plugged into the underside of the chest, which made every body read as a barrel.
 *  Seen from the side, the shoulder is a big sloping triangle on the ribcage: the shoulder blade lies back
 *  from the withers to the point of shoulder, and the triceps fill the angle behind the upper arm down to the
 *  point of elbow, which sits against the chest. The foreleg is lofted through that outline, then the
 *  forearm (muscular above, tapering to the knee), knee, cannon, fetlock and pastern; skinned by joint planes.
 *  Extents are fractions of the hip height h × foreleg thickness.
 * ════════════════════════════════════════════════════════════════════════════ */
const FORE_SHAPE = {
  ungulate: { scapF: 0.06, scapB: 0.08, scapW: 0.045, ptSh: 0.065, armF: 0.05, triceps: 0.1, armW: 0.06, elbowB: 0.072, elbowW: 0.052, fore: [0.044, 0.04], foreW: 0.046, knee: [0.034, 0.04], kneeW: 0.038, can: [0.025, 0.032], canW: 0.025, fet: [0.034, 0.046], fetW: 0.032, pastR: 0.025, corR: 0.028 },
  digitigrade: { scapF: 0.06, scapB: 0.08, scapW: 0.05, ptSh: 0.065, armF: 0.05, triceps: 0.1, armW: 0.065, elbowB: 0.07, elbowW: 0.055, fore: [0.048, 0.046], foreW: 0.05, knee: [0.03, 0.034], kneeW: 0.034, can: [0.027, 0.03], canW: 0.031, fet: [0.03, 0.032], fetW: 0.035 },
  plantigrade: { scapF: 0.07, scapB: 0.09, scapW: 0.06, ptSh: 0.07, armF: 0.06, triceps: 0.12, armW: 0.08, elbowB: 0.08, elbowW: 0.075, fore: [0.065, 0.06], foreW: 0.07, knee: [0.05, 0.05], kneeW: 0.06 },
  graviportal: { scapF: 0.06, scapB: 0.07, scapW: 0.06, ptSh: 0.06, armF: 0.06, triceps: 0.1, armW: 0.09, elbowB: 0.07, elbowW: 0.085, fore: [0.075, 0.07], foreW: 0.085, knee: [0.07, 0.07], kneeW: 0.08, can: [0.072, 0.072], canW: 0.08, fet: [0.078, 0.078], fetW: 0.085 },
};
/** Half-width of the torso surface near (z, y), from the loft's rings. */
function sideXAt(L, z, y) {
  let best = 0;
  const tz = 0.035 * L.Lt, ty = 0.07 * L.D, g = L.torso;
  for (let k = g.main[0]; k <= g.main[1]; k++) for (const p of g.rows[k]) if (Math.abs(p.z - z) < tz && Math.abs(p.y - y) < ty && Math.abs(p.x) > best) best = Math.abs(p.x);
  return best;
}
/** Foreleg lofted through its side-view outline (see FORELEG SURFACE); returns the loft. */
function tetraForeLeg(B, S, L, lm, nm) {
  const det = B.det, rig = B.rig, J = lm.joints, st = lm.st, sh = { ...FORE_SHAPE[st], ...(S.foreShape || {}) };
  // `foreBulk` / `hindBulk`: muscle round the bones (big cats and bears have massive forearms; legs read as stilts without it)
  const th = (S.foreThk || S.legThk || 1) * (S.foreBulk ?? S.limbBulk ?? 1), h = hipHeightOf(S, L), hT = h * th;
  const T0 = J[0].p, Sh = J[1].p, E = J[2].p, C = J[3].p, F = st === 'plantigrade' ? null : J[4].p;
  const xs = [[T0.y, T0.x], [Sh.y, Sh.x], [E.y, E.x], [C.y, C.x], ...(F ? [[F.y, F.x]] : [])];
  const xAt = (y) => { for (let i = 0; i < xs.length - 1; i++) if (y <= xs[i][0] && y >= xs[i + 1][0]) return lerp(xs[i][1], xs[i + 1][1], (xs[i][0] - y) / Math.max(1e-9, xs[i][0] - xs[i + 1][0])); return y > xs[0][0] ? xs[0][1] : xs[xs.length - 1][1]; };
  const stn = [];
  // `flush`: the shoulder and upper arm lie on the ribcage, their outer face just proud of the chest wall
  const at = (y, zf, zb, w, flush = 0) => {
    const zc = (zf + zb) / 2; let x = xAt(y);
    if (flush) { const wall = sideXAt(L, zc, y); if (wall > 0) x = lm.side * Math.max(Math.abs(x), wall + flush * w - w); }
    stn.push({ c: V3(x, y, zc), d: Math.max(1e-4, (zf - zb) / 2), w });
  };
  // the triceps line: from the back of the shoulder blade down to the point of elbow, bellying out between
  const yM = lerp(T0.y, Sh.y, 0.5), zM = lerp(T0.z, Sh.z, 0.5), scapBack = zM - sh.scapB * hT, olec = E.z - sh.elbowB * hT;
  const triceps = (y) => { const t = clamp((yM - y) / Math.max(1e-9, yM - E.y), 0, 1); return lerp(scapBack, olec, t) - sh.triceps * 0.32 * hT * Math.sin(Math.PI * t); };
  at(T0.y, T0.z + sh.scapF * hT * 0.6, T0.z - sh.scapB * hT * 0.6, sh.scapW * hT * 0.8);
  at(yM, zM + sh.scapF * hT, triceps(yM), sh.scapW * hT);
  at(Sh.y, Sh.z + sh.ptSh * hT, triceps(Sh.y), sh.armW * hT);
  const yA = lerp(Sh.y, E.y, 0.55);
  at(yA, lerp(Sh.z, E.z, 0.55) + sh.armF * hT, triceps(yA), sh.armW * hT * 0.95);
  at(E.y, E.z + sh.fore[0] * hT * 1.04, olec, sh.elbowW * hT);
  for (const [f, k] of [[0.28, 1], [0.72, 0.8]]) { const z = lerp(E.z, C.z, f); at(lerp(E.y, C.y, f), z + sh.fore[0] * hT * k, z - sh.fore[1] * hT * k, sh.foreW * hT * k); }
  at(C.y, C.z + sh.knee[0] * hT, C.z - sh.knee[1] * hT, sh.kneeW * hT);
  if (F) {
    for (const f of [0.3, 0.72]) { const z = lerp(C.z, F.z, f); at(lerp(C.y, F.y, f), z + sh.can[0] * hT, z - sh.can[1] * hT, sh.canW * hT); }
    at(F.y, F.z + sh.fet[0] * hT, F.z - sh.fet[1] * hT, sh.fetW * hT);
  }
  if (st === 'ungulate') {
    const Co = J[5].p;
    stn.push({ c: F.clone().lerp(Co, 0.5).add(V3(0, 0, -0.004 * hT)), d: sh.pastR * hT, w: sh.pastR * hT * 0.92, perp: true });
    stn.push({ c: Co.clone(), d: sh.corR * hT, w: sh.corR * hT, perp: true });
  }
  const pts = stn.map(q => q.c), curve = makePath(pts), ku = knotUs(curve, pts.length);
  const cosT = stn.map((q, i) => { if (q.perp) return 1; const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const t = b.clone().sub(a); return clamp(Math.abs(t.y) / Math.max(1e-9, t.length()), 0.45, 1); });
  const pw = prof(stn.map((q, i) => [ku[i], q.w])), pd = prof(stn.map((q, i) => [ku[i], q.d * cosT[i]]));
  const g = loft({ curve, seg: Math.round((14 + 2.6 * pts.length) * det), rad: 2 * Math.round(5 * det + 2), w: pw, ht: pd, hb: pd, nt: 2.15, nb: 2.15, up: [0, 0, 1],
    cap0: { type: 'round', len: 0.6, n: 3 }, cap1: { type: 'round', len: 0.45, n: 2 }, bend: 0.5 });
  lm.grid = g; lm.us = ku;
  const nb = lm.bones.length, sj = J.slice(0, nb + 1).map(j => j.p);
  const skin = planeSkin(rig, sj, lm.bones, [0.07 * h, 0.05 * h, 0.03 * h, 0.025 * h], [-0.3, 0.45], 'Chest');
  lm.emitLeg = () => emit(B.part(nm, { group: 'legs' }), g, (u, a, P) => B.paint({ part: 'leg', u, a, P, front: true, side: lm.side }), skin);
  return g;
}

/**
 * Radial depth of a point below the torso surface (Digital Diorama revision 7): positive outside, with the outward radial
 * direction. The point is referred to the nearest station along the body's path (or the rounded rump cap behind it) and
 * compared with the lofted surface in its own direction round that section.
 */
function torsoDepth(L, P) {
  const g = L.torso, m0 = g.main[0], C = g.C;
  if (!g.ctr) g.ctr = g.rows.slice(m0, g.main[1] + 1).map(row => row.reduce((s, q) => s.add(q), V3()).divideScalar(row.length));
  let bk = 0, bt = 0, bd = Infinity, behind = 0;
  const ab = V3(), ap = V3();
  for (let k = 0; k < C.length - 1; k++) {
    ab.subVectors(C[k + 1], C[k]); ap.subVectors(P, C[k]);
    const t0 = ap.dot(ab) / Math.max(1e-12, ab.lengthSq()), t = clamp(t0, 0, 1);
    const d = ap.addScaledVector(ab, -t).length();
    if (d < bd) { bd = d; bk = k; bt = t; behind = k === 0 && t0 < 0 ? -t0 * ab.length() : 0; }
  }
  const u = lerp(g.us[m0 + bk], g.us[m0 + bk + 1], bt), f = g.frame(u);
  const ctr = g.ctr[bk].clone().lerp(g.ctr[Math.min(bk + 1, g.ctr.length - 1)], bt);
  const v = P.clone().sub(ctr);
  if (behind > 0) v.addScaledVector(f.t, behind);
  const a = Math.atan2(v.dot(f.up), v.dot(f.side));
  let rS = g.at(u, a).p.sub(ctr).length();
  if (behind > 0 && g.tip0) { const Lc = Math.max(1e-6, g.tip0.distanceTo(g.ctr[0])); rS *= Math.sqrt(Math.max(0, 1 - (behind / Lc) ** 2)); }
  const n = P.clone().sub(ctr).normalize();
  return { d: v.length() - rS, n };
}

/**
 * Digital Diorama revision 7: where the limbs leave the body. Body and legs are separate surfaces; the thigh's top poked
 * out through the croup as a slab and every leg met the body along a hard crease (normal blending alone could not hide
 * the angle). Two steps on each leg's grid before it is emitted:
 *  - tuck: above the stifle (hind) and the upper arm (fore) the body is the outer surface, so leg points that stand out of
 *    it are pulled just inside (fading out toward the knee / elbow);
 *  - flare: below that, where the leg leaves the body, its surface swells outward by the soft-union amount
 *    k/4 · (1 − d/k)² (d: distance outside the body, k = `fillet` × height), so it runs into the body instead of meeting
 *    it at an angle. Displacements stay within k/4, so nothing folds into flaps.
 */
function blendLimbRoots(B, S, L) {
  const k = (S.fillet ?? (L.ref ? L.ref.fillet : null) ?? 0.1) * L.H, m = 0.004 * L.H;
  if (!(k > 0)) return;
  for (const lm of L.limbs) {
    if (!lm.emitLeg || !lm.grid || !lm.us) continue;
    const g = lm.grid, rows = g.rows, R = g.R, ku = lm.us;
    // tuck from the mid-thigh to the stifle (hind), from the middle of the upper arm to the elbow (fore)
    // (Digital Diorama revision 8: a limb may set its own range, `tuck`: the elephant's)
    const [uIn, uOut] = lm.tuck ?? (lm.front ? [ku[3], lerp(ku[3], ku[4], 0.8)] : [ku[2], lerp(ku[2], ku[3], 0.8)]);
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r], tuck = 1 - sstep(uIn, uOut, g.us[r]);
      const ctr = row.reduce((s, q) => s.add(q), V3()).divideScalar(R);
      // rows hanging well clear of the body are left alone (most of the leg)
      if (tuck <= 0) { let rad = 0; for (const q of row) rad = Math.max(rad, q.distanceTo(ctr)); if (torsoDepth(L, ctr).d > k + rad) continue; }
      for (let j = 0; j < R; j++) {
        const P = row[j], t = torsoDepth(L, P);
        if (tuck > 0 && t.d > -m) { P.addScaledVector(t.n, -(t.d + m) * tuck); continue; }
        // flare (after any partial tuck): along the leg's own outward direction
        const d = tuck > 0 ? torsoDepth(L, P).d : t.d;
        const f = (1 - tuck) * (k / 4) * (d >= 0 ? (1 - Math.min(1, d / k)) ** 2 : sstep(-k / 3, 0, d));
        if (f > 1e-6) P.addScaledVector(P.clone().sub(ctr).normalize(), f);
      }
    }
  }
}

const LIMB_BONES = { front: ['Scapula', 'Arm', 'Forearm', 'Hand', 'Finger'], hind: ['Thigh', 'Shin', 'Foot', 'Toe'] };
/** Lays out all four limbs (before torso emission so torso skin can follow limb roots). */
function tetraLimbLayout(B, S, L) {
  for (const front of [true, false]) for (const side of [1, -1]) {
    if (front && S.noForelimbs) continue;
    const lay = L.ref ? refLimbJoints(S, L, front, side) : tetraLimbJoints(S, L, front, side), sfx = side > 0 ? 'L' : 'R';
    const names = (front ? LIMB_BONES.front : LIMB_BONES.hind).map(n => n + sfx);
    const nb = Math.min(names.length, lay.joints.length - 1);
    const bones = names.slice(0, nb);
    const rj = lay.joints[front ? 1 : 0], reach = Math.max(rj.w, rj.d * 0.7) * 2.4;
    L.limbs.push({ front, side, sfx, ...lay, bones, inf: front ? [1, 2, 1] : [0, 1, 0], reach, pull: lay.st === 'sprawl' || lay.st === 'arm' || lay.st === 'frog' ? 0.25 : 0.55 });
  }
}
function tetraLimbBones(B, L) {
  for (const lm of L.limbs) {
    const parent = lm.front ? 'Chest' : 'Hips';
    lm.bones.forEach((n, i) => B.rig.add(n, i === 0 ? parent : lm.bones[i - 1], lm.joints[i].p, lm.joints[i + 1].p));
  }
}
/** Leg sweeps through every joint with muscle bulges, then a swept foot. */
function tetraLimbs(B, S, L) {
  const det = B.det, rig = B.rig;
  for (const lm of L.limbs) {
    const J = lm.joints, n = J.length;
    const foot = lm.foot === 'hand' || lm.foot === 'talon' || lm.foot === 'flipper' ? lm.foot : ((lm.front ? S.foreFoot : S.hindFoot) || S.foot || lm.foot);
    lm.footType = foot;
    if (lm.ref) {
      const nm = `leg-${lm.front ? 'front' : 'hind'}-${lm.side > 0 ? 'left' : 'right'}`;
      refLeg(B, S, L, lm, nm);
      tetraFoot(B, S, L, lm, foot, nm);
      continue;
    }
    if (!lm.front && lm.kind && HIND_SHAPE[lm.kind]) {
      const nm = `leg-hind-${lm.side > 0 ? 'left' : 'right'}`;
      tetraHindLeg(B, S, L, lm, nm);
      tetraFoot(B, S, L, lm, foot, nm);
      continue;
    }
    if (lm.front && FORE_SHAPE[lm.st] && J.length >= (lm.st === 'ungulate' ? 7 : 6)) {
      const nm = `leg-front-${lm.side > 0 ? 'left' : 'right'}`;
      tetraForeLeg(B, S, L, lm, nm);
      tetraFoot(B, S, L, lm, foot, nm);
      continue;
    }
    const endIdx = foot === 'sole' ? n - 3 : n - 2;
    const off = lm.pre ? 1 : 0;
    const jl = [...(lm.pre ? [lm.pre] : []), ...J.slice(0, endIdx + 1)];
    const pts = jl.map(j => j.p);
    const curve = makePath(pts), kuAll = knotUs(curve, pts.length);
    // hind: ilium root → quarter (biggest mass just below the hip) → gaskin bulge above the hock
    const bulge = lm.front ? [1.05, 1.16, 1.08, 1.0, 1.0] : lm.pre ? [1.06, 1.06, 1.12, 1.0, 1.0, 1.0] : [1.2, 1.12, 1.0, 1.0, 1.0];
    const wk = [], dk = [];
    for (let i = 0; i < pts.length; i++) {
      wk.push([kuAll[i], jl[i].w]); dk.push([kuAll[i], jl[i].d]);
      if (i < pts.length - 1) { const um = (kuAll[i] + kuAll[i + 1]) / 2, b = bulge[i] || 1; wk.push([um, (jl[i].w + jl[i + 1].w) / 2 * b]); dk.push([um, (jl[i].d + jl[i + 1].d) / 2 * b * (S.muscle || 1)]); }
    }
    const pw = prof(wk), pd = prof(dk);
    const ku = kuAll.slice(off);
    const nb = Math.min(lm.bones.length, pts.length - 1 - off);
    const spec = rig.spec(lm.bones.slice(0, nb), [0, ...ku.slice(1, nb)], 0.28);
    const g = loft({ curve, seg: Math.round((10 + 3 * pts.length) * det), rad: 2 * Math.round(5 * det + 2), w: pw, ht: pd, hb: pd, nt: 2.1, nb: 2.1, up: [0, 0, 1],
      cap0: { type: 'round', len: off ? 0.6 : 0.35, n: 3 }, cap1: { type: 'round', len: 0.45, n: 2 }, bend: 0.6 });
    lm.grid = g; lm.us = ku;
    const nm = `leg-${lm.front ? 'front' : 'hind'}-${lm.side > 0 ? 'left' : 'right'}`;
    const legSkin = !lm.front
      ? (u) => { const t = sstep(off ? ku[0] * 0.35 : 0, lerp(ku[0], ku[1], 0.6), u); return t >= 1 ? rig.chain(spec, u) : mixW(rig.W('Hips'), rig.chain(spec, u), lerp(off ? 0 : 0.35, 1, t)); }
      : (u) => rig.chain(spec, u);
    emit(B.part(nm, { group: 'legs' }), g, (u, a, P) => B.paint({ part: 'leg', u, a, P, front: lm.front, side: lm.side }), legSkin);
    tetraFoot(B, S, L, lm, foot, nm);
  }
  blendLimbRoots(B, S, L);
  for (const lm of L.limbs) if (lm.emitLeg) lm.emitLeg();
}

function tetraFoot(B, S, L, lm, foot, nm) {
  const rig = B.rig, det = B.det, J = lm.joints, n = J.length, H = L.H, bl = lm.bones, last = bl[bl.length - 1], prevB = bl[bl.length - 2];
  const W = rig.W(last), part = B.part(`foot-${nm.slice(4)}`, { group: 'feet' });
  const footPaint = (u, a, P) => B.paint({ part: 'foot', u, a, P, front: lm.front, side: lm.side });
  if (foot === 'hoof' || foot === 'cloven') {
    // Digital Diorama revision 4: a real hoof wall (it was a cylinder pushed forward at the bottom: a wedge / boot)
    const C = J[n - 2].p, T = J[n - 1].p, r = J[n - 2].w * 1.05, cloven = foot === 'cloven';
    const hd = hoofDims(S, r, C.y, hindLayoutFor(S, 'ungulate').wall);
    const f = V3(T.x - C.x, 0, T.z - C.z); if (f.lengthSq() < 1e-12) f.set(0, 0, 1); f.normalize();
    const sd = V3(f.z, 0, -f.x), R = 2 * Math.round(6 * det + 3), NR = 5;
    for (const cl of cloven ? [-1, 1] : [0]) {
      // per claw: ground outline (bearing edge) and coronary band; angle a = π/2 is the toe
      const gap = cloven ? 0.06 * hd.b : 0, bw = cloven ? hd.b * 0.5 : hd.b, bwc = cloven ? hd.bc * 0.52 : hd.bc;
      const gC = T.clone().addScaledVector(f, -hd.a).addScaledVector(sd, cl * (bw + gap)), cC = C.clone().addScaledVector(sd, cl * bwc * 0.92);
      const ring = (ctr, hl, hw, yOf) => Array.from({ length: R }, (_, j) => {
        const a = (j / R) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        let x = hw * ca, z = hl * sa;
        if (cloven) {
          if (ca * cl < 0) x *= 0.58;                       // the flatter inner wall faces the cleft
          x *= 1 - 0.38 * Math.max(0, sa) ** 3;             // claws taper to a point at the toe
          z = hl * Math.sign(sa) * Math.abs(sa) ** 0.85;
        }
        return ctr.clone().addScaledVector(sd, x).addScaledVector(f, z).setY(yOf(sa));
      });
      const top = ring(cC, hd.ac, bwc, (sa) => lerp(hd.heelH, hd.toeH, (1 + sa) / 2));
      const bot = ring(gC, hd.a, bw, () => 0);
      // (Digital Diorama revision 10: points of the hoof wall for poses that keep the feet above the ground)
      if (lm.surf) for (const P of [...top, ...bot]) lm.surf.push({ P: P.clone(), W });
      const rows = [];
      for (let k = 0; k < NR; k++) { const t = k / (NR - 1), fl = 1 + 0.05 * Math.sin(Math.PI * t * 0.9); rows.push(top.map((p, j) => { const q = p.clone().lerp(bot[j], t), c = (k === NR - 1 ? gC : cC.clone().lerp(gC, t)).clone().setY(q.y); return c.add(q.sub(c).multiplyScalar(fl)); })); }
      const capTop = cC.clone().setY(lerp(hd.heelH, hd.toeH, 0.5) + r * 0.25);
      emit(part, { rows, us: rows.map((_, k) => k / (NR - 1)), R, closed: false, tip0: capTop, tip1: gC.clone().setY(0), main: [0, NR - 1] }, 'hoof', W);
    }
    if (cloven && S.dewclaws !== false) for (const hx of [-1, 1]) {
      const fj = J[n - 3].p;
      emit(part, tube([fj.clone().add(V3(hx * r * 0.5, -r * 0.35, -r * 0.85)), fj.clone().add(V3(hx * r * 0.6, -r * 0.9, -r * 1.15))], (u) => r * 0.26 * (1 - u * 0.6), 3, 5, { cap1: 'point' }), 'hoof', W);
    }
    return;
  }
  if (foot === 'pad') {
    // (Digital Diorama revision 7: a vertical sweep, so the sole is flat on the ground; slanted 2° forward, its front edge sank 1 cm)
    const c = J[n - 2].p, r = Math.max(J[n - 2].w, J[n - 2].d);
    const g = loft({ pts: [V3(c.x, c.y + r * 0.6, c.z + r * 0.05), V3(c.x, 0, c.z + r * 0.05)], seg: 4, rad: 2 * Math.round(7 * det + 2), up: [0, 0, 1],
      w: (u) => lerp(1.0, 1.16, u) * r, ht: (u) => lerp(1.0, 1.2, u) * r, hb: (u) => lerp(1.0, 1.08, u) * r, cap0: { type: 'round', len: 0.4, n: 2 }, cap1: 'flat', bend: 0, antifold: false });
    emit(part, g, footPaint, W);
    // (Digital Diorama revision 10: points of the pad for poses that keep the feet above the ground)
    if (lm.surf) for (const row of g.rows) for (const P of row) lm.surf.push({ P: P.clone(), W });
    const nails = S.nails ?? 4;
    for (let i = 0; i < nails; i++) {
      const t = nails === 1 ? 0 : (i / (nails - 1) - 0.5) * 1.5, P = V3(c.x + Math.sin(t) * r * 1.08, r * 0.2, c.z + 0.05 * r + Math.cos(t) * r * 1.12);
      emit(part, ellipsoid(P, r * 0.22, r * 0.18, r * 0.12, V3(Math.sin(t), 0, Math.cos(t)), [0, 1, 0], 4, 8), 'hoof', W);
    }
    return;
  }
  if (foot === 'paw') {
    // Digital Diorama revision 4: a compact paw — a rounded pad under the paw joint and arched toe bulbs in an arc
    // ahead of it, the middle toes longest (it was a long flat slipper with stubs on the front)
    // (Digital Diorama revision 10: a measured leg's paw is as wide as its paw joint)
    const P = J[n - 2].p, T = J[n - 1].p, r = lm.ref ? J[n - 2].w : Math.max(J[n - 2].w, 0.018 * H * (S.legThk || 1)) * ((lm.front ? S.foreBulk : S.hindBulk) ?? S.limbBulk ?? 1) ** 0.75;
    const fwd = V3(T.x - P.x, 0, T.z - P.z); if (fwd.lengthSq() < 1e-12) fwd.set(0, 0, 1); fwd.normalize();
    const lat = V3(fwd.z, 0, -fwd.x), len = Math.max(Math.hypot(T.x - P.x, T.z - P.z), r);
    const pw = r * 1.08 * (S.pawW || 1), padH = Math.max(P.y, r * 0.7);
    const pc = P.clone().addScaledVector(fwd, len * 0.12); pc.y = padH * 0.5;
    const padG = ellipsoid(pc, pw * 0.88, padH * 0.56, Math.max(len * 0.38, r * 0.85), fwd, [0, 1, 0], 6, 2 * Math.round(6 * det + 2)), padW = rig.W2(prevB, last, 0.7);
    emit(part, padG, footPaint, padW);
    // (Digital Diorama revision 10: points of the paw for poses that keep the feet above the ground)
    if (lm.surf) for (const row of padG.rows) for (const P of row) lm.surf.push({ P: P.clone(), W: padW });
    const toes = S.toes ?? 4, tr = pw * (toes > 4 ? 0.3 : 0.37);
    for (let i = 0; i < toes; i++) {
      const t = toes === 1 ? 0 : i / (toes - 1) - 0.5, at = Math.abs(t) * 2;
      const dir = fwd.clone().addScaledVector(lat, t * 0.45).normalize();
      const c = P.clone().addScaledVector(fwd, len * (0.66 - 0.2 * at * at)).addScaledVector(lat, t * pw * 1.45); c.y = tr * 0.92;
      const toeG = ellipsoid(c, tr, tr * 0.92, tr * 1.3, dir, [0, 1, 0], 5, 8);
      emit(part, toeG, footPaint, W);
      if (lm.surf) for (const row of toeG.rows) for (const P of row) lm.surf.push({ P: P.clone(), W });
      if (S.claws) {
        const cl = S.claws * tr, cs = c.clone().addScaledVector(dir, tr * 1.1).add(V3(0, tr * 0.1, 0));
        emit(part, tube([cs, cs.clone().addScaledVector(dir, cl * 0.55).add(V3(0, -cl * 0.1, 0)), cs.clone().addScaledVector(dir, cl * 0.85).add(V3(0, -cl * 0.55, 0))], (u) => tr * 0.3 * (1 - u * 0.9), 4, 4, { cap1: 'point' }), 'hoof', W);
      }
    }
    return;
  }
  if (foot === 'sole') {
    const sole = true, hj = J[n - 3];
    const heel = hj.p, toe = J[n - 1].p, r = lm.ref ? hj.w : Math.max(hj.w, 0.018 * H * (S.legThk || 1)) * ((lm.front ? S.foreBulk : S.hindBulk) ?? S.limbBulk ?? 1) ** 0.75;
    const fwd = V3(toe.x - heel.x, 0, toe.z - heel.z).normalize();
    const pawW = r * (sole ? 1.12 : 1.1) * (S.pawW || 1), pawH = r * (sole ? 0.75 : 0.95), yMid = pawH * 0.55;
    const back = V3(heel.x, yMid + (sole ? 0 : 0.3 * r), heel.z).addScaledVector(fwd, -(sole ? 0.45 : 0.55) * r);
    const front = V3(toe.x, yMid * 0.9, toe.z);
    const len = back.distanceTo(front);
    front.addScaledVector(fwd, -0.22 * len);
    // Digital Diorama revision 4: the heel rises to the ankle, so the leg flows into the foot (a board under a cone)
    const heelTop = Math.max(pawH * 0.75, heel.y - yMid + 0.35 * r);
    const g = loft({ pts: [back, front], seg: 8, rad: 2 * Math.round(6 * det + 2), up: [0, 1, 0],
      w: (u) => pawW * lerp(0.82, 1.0, sstep(0, 0.6, u)), ht: (u) => lerp(heelTop, pawH * 0.55, sstep(0, 0.75, u)), hb: () => yMid * 0.95, nt: 2.2, nb: 3.4,
      cap0: { type: 'round', len: 0.6, n: 2 }, cap1: { type: 'round', len: 0.55, n: 3 }, bend: 0, antifold: false });
    const soleW = sole ? (u) => rig.W2(prevB, last, sstep(0.5, 0.85, u)) : (u) => rig.W2(prevB, last, sstep(0, 0.35, u));
    emit(part, g, footPaint, soleW);
    if (lm.surf) g.rows.forEach((row, k) => { for (const P of row) lm.surf.push({ P: P.clone(), W: soleW(g.us[k]) }); });
    const toes = S.toes ?? (sole ? 5 : 4), tl = (S.toeLen ?? (sole ? 0.24 : 0.3)) * len;
    const yaw = Math.atan2(fwd.x, fwd.z), lat = V3(Math.cos(yaw), 0, -Math.sin(yaw));
    for (let i = 0; i < toes; i++) {
      const t = toes === 1 ? 0 : i / (toes - 1) - 0.5, spread = t * pawW * 1.5;
      const base = front.clone().addScaledVector(lat, spread).addScaledVector(fwd, -Math.abs(t) * 0.3 * len - 0.05 * len); base.y = yMid * 0.8;
      const tipP = base.clone().addScaledVector(fwd, tl * (1 - Math.abs(t) * 0.45)).addScaledVector(lat, spread * 0.15); tipP.y = yMid * 0.45;
      const tr = pawW * (toes > 4 ? 0.25 : 0.3);
      emit(part, loft({ pts: [base, tipP], seg: 3, rad: 8, w: tr, ht: tr * 0.85, hb: tr * 0.75, cap0: { type: 'round', len: 0.5, n: 2 }, cap1: { type: 'round', len: 0.9, n: 3 }, bend: 0, up: [0, 1, 0], antifold: false }), footPaint, W);
      if (S.claws) {
        const cl = S.claws * tr, cs = tipP.clone().addScaledVector(fwd, tr * 0.55).add(V3(0, tr * 0.15, 0));
        emit(part, tube([cs, cs.clone().addScaledVector(fwd, cl * 0.6).add(V3(0, -cl * 0.08, 0)), cs.clone().addScaledVector(fwd, cl).add(V3(0, -cl * 0.42, 0))], (u) => tr * 0.33 * (1 - u * 0.9), 4, 4, { cap1: 'point' }), 'hoof', W);
      }
    }
    return;
  }
  if (foot === 'flipper') {
    const root = J[n - 3].p, palm = J[n - 2].p, end = J[n - 1].p, ax = end.clone().sub(root), Lf = ax.length() * (S.flipperLen ?? 1.6) * (lm.front ? 1 : (S.hindFlipper ?? 0.6));
    const d = (lm.front ? V3(lm.side, -0.12, -0.42) : V3(lm.side * 0.55, -0.08, -0.85)).normalize(), fwdv = new THREE.Vector3().crossVectors(V3(0, 1, 0), d).multiplyScalar(lm.side).normalize(), chord = Lf * (S.flipperW ?? 0.32);
    sheet(part, { nu: Math.round(8 * det), nv: Math.round(4 * det),
      f: (u, v) => { const cw = chord * Math.sin(Math.PI * clamp(0.15 + u * 0.85, 0, 1)) ** 0.7 * (1 - 0.35 * u); const q = root.clone().addScaledVector(d, u * Lf).addScaledVector(fwdv, (v - 0.62) * cw); q.y = Math.max(q.y, chord * 0.12); return q; },
      th: (u, v) => chord * 0.16 * (1 - 0.75 * u) * (1 - 0.6 * (2 * v - 1) ** 2), zone: (u, v) => footPaint(u, v * TAU, palm), skin: (u) => u < 0.3 ? rig.W(prevB) : W });
    return;
  }
  // hands / talons: digits fan out from the palm (J[n-2]) toward J[n-1]
  const palm = J[n - 2].p, end = J[n - 1].p, d0 = end.clone().sub(palm), dl = d0.length() * ((lm.front ? S.foreDigitLen : null) ?? S.digitLen ?? 1);
  const d = d0.normalize(), r = J[n - 2].w;
  const digits = S.digits ?? (foot === 'talon' ? 3 : 5);
  for (let i = 0; i < digits; i++) {
    const t = digits === 1 ? 0 : i / (digits - 1) - 0.5, fan = t * (S.digitFan ?? 1.3);
    const dir = d.clone().applyAxisAngle(V3(0, 1, 0), fan);
    const len = dl * (1 - Math.abs(t) * 0.4);
    const a = palm.clone().addScaledVector(dir, r * 0.2), e = palm.clone().addScaledVector(dir, len);
    if (palm.y < 0.06 * H) e.y = Math.max(r * 0.25, e.y * 0.5);
    const m = a.clone().lerp(e, 0.5); m.y = Math.max(m.y, Math.min(a.y, e.y) + r * 0.25);
    const thick = r * (S.digitThk ?? 0.42);
    emit(part, tube([a, m, e], (u) => thick * (1 - u * 0.5) * (S.digitPads && u > 0.82 ? 1.5 : 1), 5, 6, { cap1: { type: 'round', len: 0.8, n: 2 } }), footPaint, W);
    if (S.claws) emit(part, tube([e, e.clone().addScaledVector(dir, thick * S.claws * 0.6).add(V3(0, thick * 0.2, 0)), e.clone().addScaledVector(dir, thick * S.claws * 1.2).add(V3(0, -thick * 0.5, 0))], (u) => thick * 0.42 * (1 - u * 0.9), 4, 4, { cap1: 'point' }), 'hoof', W);
  }
  if ((S.webbed === true || (S.webbed === 'hind' && !lm.front)) && digits > 1) {
    const tips = [], bases = [];
    for (let i = 0; i < digits; i++) {
      const t = i / (digits - 1) - 0.5, dir = d.clone().applyAxisAngle(V3(0, 1, 0), t * (S.digitFan ?? 1.3)), len = dl * (1 - Math.abs(t) * 0.4) * 0.92;
      const e = palm.clone().addScaledVector(dir, len); if (palm.y < 0.06 * H) e.y = Math.max(r * 0.25, e.y * 0.5);
      tips.push(e); bases.push(palm.clone().addScaledVector(dir, r * 0.3));
    }
    sheet(part, { nu: 3, nv: (digits - 1) * 3,
      f: (u, v) => { const x = v * (digits - 1), i = Math.min(digits - 2, Math.floor(x)), t = x - i, tip = tips[i].clone().lerp(tips[i + 1], t), b = bases[i].clone().lerp(bases[i + 1], t); const scallop = 1 - 0.28 * Math.sin(Math.PI * t) * u; return b.lerp(tip, u * scallop); },
      th: r * 0.08, zone: 'web', skin: W });
  }
  if (foot === 'talon' && S.hallux !== false) {
    const back = palm.clone().addScaledVector(d, -dl * 0.45); back.y = Math.max(r * 0.2, back.y * 0.4);
    emit(part, tube([palm, back], (u) => r * 0.36 * (1 - u * 0.5), 4, 6), footPaint, W);
  }
}

/** Tail: a tapered sweep rooted inside the rump, with a bone chain for sway. */
function tetraTail(B, S, L) {
  const T = S.tail;
  if (!T || T.style === 'none' || !(T.len > 0)) return;
  const rig = B.rig, det = B.det, H = L.H, len = T.len * H, uR = L.uOf.rump, fr = L.torso.frame(uR);
  const r0 = T.match ? T.match * Math.min(L.torsoW(uR), L.torsoHt(uR)) * (T.thkMul ?? 1) : T.thk * H;
  const root = fr.c.clone().addScaledVector(fr.up, L.torsoHt(uR) * (T.rootUp ?? (T.match ? 0.05 : 0.5))).addScaledVector(fr.t, -0.05 * L.Dr);
  const N = 14, pts = [root.clone().addScaledVector(fr.t, 0.35 * r0 + 0.04 * L.Dr)];
  let elev = (T.set ?? -20) * DEG;
  const dz = len / N;
  for (let i = 1; i <= N; i++) {
    const s = i / N;
    const e = elev + (T.curl ?? 0) * DEG * s + (T.tipCurl ?? 0) * DEG * sstep(0.55, 1, s) * 2.2;
    const prev = pts[i - 1];
    if (T.style === 'curly') {
      const turns = T.turns ?? 1.6, ra = len * 0.12, a = s * TAU * turns;
      pts.push(root.clone().add(V3(Math.sin(a) * ra, ra - Math.cos(a) * ra + s * len * 0.1, -0.15 * len - s * len * 0.12)));
    } else pts.push(prev.clone().add(V3((T.side || 0) * dz * s, Math.sin(e) * dz, -Math.cos(e) * dz)));
  }
  const curve = makePath(pts);
  const style = T.style, bush = T.bush ?? 0.8;
  const R = style === 'bushy' ? (u) => r0 * (0.7 + bush * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.95)), 0.7)) * (1 - 0.35 * u)
    : style === 'tuft' ? (u) => r0 * (1 - 0.7 * u) + r0 * (T.tuft ?? 1.8) * bell(u, 0.93, 0.12)
      : style === 'flat' ? (u) => r0 * (0.5 + 0.5 * Math.sin(Math.PI * clamp(u * 1.1, 0, 1)))
        : style === 'fluffy' ? (u) => r0 * (0.6 + 0.6 * Math.sin(Math.PI * u))
          : (u) => r0 * (1 - 0.82 * Math.pow(u, 0.9));
  const flat = style === 'flat' ? (T.flat ?? 3) : 1 / (T.aspect ?? 1);
  const g = loft({ curve, seg: Math.round(20 * det), rad: 2 * Math.round(5 * det + 2), w: (u) => R(u) * flat, ht: (u) => R(u) / Math.sqrt(flat), hb: (u) => R(u) / Math.sqrt(flat),
    bump: S.tailBump || (style === 'bushy' && det >= 1 ? (u, a) => 0.06 * Math.sin(a * 5 + u * 23) : null),
    cap0: { type: 'round', len: 0.5, n: 2 }, cap1: { type: 'round', len: style === 'thin' ? 0.9 : 0.7, n: 3 }, bend: 0.4 });
  const nb = T.bones ?? (len > 0.6 * H ? 6 : 4), names = [], us = [];
  for (let i = 0; i < nb; i++) { const u = i / nb; names.push('Tail' + (i + 1)); us.push(u); rig.add('Tail' + (i + 1), i ? 'Tail' + i : 'Hips', curve.getPointAt(u), curve.getPointAt(Math.min(1, (i + 1) / nb))); }
  const spec = rig.spec(names, us, 0.4);
  // (its widest radius: a tuft or bush, for poses that rest the tail on the ground)
  let rMax = 0; for (let k = 0; k <= 20; k++) rMax = Math.max(rMax, R(k / 20));
  L.tail = { grid: g, curve, bones: names, len, spec, r: rMax * Math.max(1, 1 / Math.sqrt(flat)) };
  emit(B.part('tail', { group: 'tail' }), g, (u, a, P) => style === 'tuft' && u > 0.82 ? 'mane' : B.paint({ part: 'tail', u, a, P }), (u) => u < 0.06 ? rig.W2('Hips', 'Tail1', u / 0.06) : rig.chain(spec, u));
  if (style === 'hair') {
    const hl = (T.hair ?? 1.6) * len, hw = (T.hairW ?? 2.4) * r0, end = curve.getPointAt(1), d1 = curve.getTangentAt(1);
    const hp = [curve.getPointAt(0.05), curve.getPointAt(0.5), end.clone().addScaledVector(d1, hl * 0.08),
      end.clone().add(V3(0, -hl * 0.3, -hl * (T.hairBack ?? 0.2) * 0.8)), end.clone().add(V3(0, -hl * 0.62, -hl * (T.hairBack ?? 0.2))), end.clone().add(V3(0, -hl * 0.92, -hl * (T.hairBack ?? 0.2) * 0.85))];
    // (Digital Diorama revision 10: the hair sweeps back along the ground rather than through it on a low-set tail)
    const floorY = hw * 0.6 + 0.01 * H;
    for (const q of hp) if (q.y < floorY) { q.z -= (floorY - q.y) * 0.6; q.y = floorY; }
    // the bottom of the hair is what a lying animal must keep off the ground
    L.tail.tipLow = hp[hp.length - 1].clone(); L.tail.r = Math.max(L.tail.r, hw * 0.6);
    const hg = loft({ pts: hp, seg: Math.round(16 * det), rad: 2 * Math.round(5 * det + 2), up: [0, 0, -1],
      w: (u) => hw * 0.55 * (0.35 + 0.75 * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.08))), ht: (u) => hw * (0.4 + 0.9 * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.05))) * 0.55, hb: (u) => hw * (0.4 + 0.9 * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.05))) * 0.55,
      bump: det >= 1 ? (u, a) => 0.12 * Math.sin(a * 5 + u * 11) * u : null, cap0: { type: 'round', len: 0.6 }, cap1: { type: 'point', len: 1.2 }, bend: 0.3 });
    emit(B.part('tail', { group: 'tail' }), hg, 'mane', (u, a, P) => rig.near(P, names, hw * 2));
    // (Digital Diorama revision 10: points of the hair with their weights, for poses that rest the tail on the ground)
    L.tail.surf = [];
    for (let k = 0; k < hg.rows.length; k += 2) for (let j = 0; j < hg.R; j += 3) { const P = hg.rows[k][j]; L.tail.surf.push({ P: P.clone(), W: rig.near(P, names, hw * 2) }); }
  }
}

/** Horns, antlers, ossicones and tusks: tapered sweeps rooted on the skull surface. */
function tetraHorns(B, S, L) {
  const Hn = S.horns, rig = B.rig, det = B.det;
  if (!Hn || Hn.style === 'none' || !(Hn.len > 0)) return;
  const g = L.head, hd = L.hd, hu = L.hu, Lh = L.Lh, len = Hn.len * Lh, r0 = (Hn.thk ?? 0.07) * Lh;
  const part = B.part('horns', { group: 'horns' }), HW = rig.W('Head');
  const ridged = (k) => (u, a) => k * 0.07 * Math.max(0, Math.sin(u * (Hn.rings ?? 34) * Math.PI)) * (1 - u);
  const horn = (pts, r, zone = 'horn', bump = null, tipCap = 'point') => {
    const hg = loft({ pts, seg: Math.round(Math.max(6, pts.length * 3) * det), rad: 2 * Math.round(3 * det + 2), w: r, ht: r, hb: r, bump, cap0: { type: 'round', len: 0.3, n: 2 }, cap1: tipCap === 'point' ? { type: 'point', len: 0.8 } : { type: 'round', len: 0.9, n: 3 }, bend: 0.4 });
    emit(part, hg, typeof zone === 'function' ? zone : zone, HW);
    return hg;
  };
  const st = Hn.style;
  if (st === 'rhino' || st === 'unicorn') {
    const list = st === 'unicorn' ? [[0.42, 1, 0.9]] : [[0.9, 1, 1], ...(Hn.count === 1 ? [] : [[0.72, 0.45, 0.8]])];
    for (const [s, k, kr] of list) {
      const { p, n } = g.at(s, Math.PI / 2), base = p.addScaledVector(n, -r0 * kr * 0.4), L1 = len * k;
      const up = st === 'unicorn' ? n.clone().lerp(hd, 0.3).normalize() : n.clone().multiplyScalar(0.35).add(V3(0, 0.65, 0)).normalize(), back = V3(0, 0, -1);
      // (Digital Diorama revision 9: a rhino's horn sweeps back toward the forehead and tapers concavely, broad over the nose and
      // slender at the tip (it was a straight cone, read from a distance as a blade); its base is longer than it is wide)
      const pts = st === 'unicorn' ? [base, base.clone().addScaledVector(up, L1 * 0.5).addScaledVector(hd, L1 * 0.25), base.clone().addScaledVector(up, L1 * 0.8).addScaledVector(hd, L1 * 0.55)]
        : [base, base.clone().addScaledVector(up, L1 * 0.4).addScaledVector(back, L1 * 0.02), base.clone().addScaledVector(up, L1 * 0.75).addScaledVector(back, L1 * (Hn.curl ?? 0.3) * 0.45), base.clone().addScaledVector(up, L1).addScaledVector(back, L1 * (Hn.curl ?? 0.3))];
      if (st === 'unicorn') horn(pts, (u) => r0 * kr * (1.2 - u), 'horn', (u, a) => 0.12 * Math.sin(a * 2 - u * 30));
      else {
        const rr = (u) => r0 * kr * 1.5 * Math.max(0.06, Math.pow(1 - u, 1.25));
        const hg = loft({ pts, seg: Math.round(12 * det), rad: 2 * Math.round(5 * det + 2), w: (u) => rr(u) * 0.82, ht: (u) => rr(u) * (1.1 - 0.1 * u), hb: (u) => rr(u) * (1.1 - 0.1 * u), up: hd,
          cap0: { type: 'round', len: 0.3, n: 2 }, cap1: { type: 'round', len: 0.8, n: 2 }, bend: 0.4 });
        emit(part, hg, 'horn', HW);
      }
    }
    return;
  }
  for (const side of [1, -1]) {
    const a = Math.PI / 2 - side * (Hn.a ?? 0.55);
    const { p, n } = g.at(Hn.s ?? 0.24, a);
    const base = p.clone().addScaledVector(n, -r0 * 0.5);
    const out = V3(side, 0, 0), up = hu.clone(), back = hd.clone().multiplyScalar(-1), fwd = hd.clone();
    const P = (o, u, b, f = 0) => base.clone().addScaledVector(out, o * len).addScaledVector(up, u * len).addScaledVector(back, b * len).addScaledVector(fwd, f * len);
    const taper = (k = 1) => (u) => r0 * k * Math.max(0.04, 1 - Math.pow(u, 1.15));
    if (st === 'cattle') horn([P(0, 0, 0), P(0.4, 0.04, 0.02), P(0.74, 0.26, -0.04), P(0.84, 0.6, -0.1)], taper());
    else if (st === 'buffalo') {
      horn([P(-0.12, 0.05, 0.05), P(0.3, 0.02, 0.06), P(0.66, -0.14, 0.1), P(0.86, 0.14, 0.04), P(0.8, 0.42, -0.05)], (u) => r0 * (1.7 * (1 - sstep(0, 0.35, u)) + 1) * Math.max(0.05, 1 - u));
    } else if (st === 'ram') {
      // (Digital Diorama revision 9: the curl about as deep as the head (0.36 × the length hung its lowest turn below the jaw
      // and swung the tip forward past the muzzle like a tusk); `curlR` sets its radius)
      const turns = Hn.curl ?? 1.7, R0 = len * (Hn.curlR ?? 0.28), pts = [];
      // Digital Diorama revision: curl in world axes (back over the crown, down behind the ear, forward past the
      // cheek); in head axes a down-pitched head turned the spiral into loops on top of the skull
      const upT = V3(0, 1, 0).applyAxisAngle(V3(0, 0, 1), -side * 0.32), bk = V3(0, 0, -1);
      for (let i = 0; i <= 18; i++) {
        const th = (i / 18) * turns * Math.PI, R = R0 * Math.exp(-0.17 * th);
        pts.push(base.clone().addScaledVector(upT, -R0 + R * Math.cos(th) + R0 * 0.0).addScaledVector(bk, R * Math.sin(th)).addScaledVector(out, (0.12 + 0.28 * i / 18) * len));
      }
      horn(pts, (u) => r0 * 1.45 * Math.max(0.12, 1 - 0.82 * u), 'horn', ridged(1.4));
    } else if (st === 'goat') horn([P(0.02, 0, 0), P(0.06, 0.45, 0.12), P(0.12, 0.75, 0.45), P(0.16, 0.82, 0.85)], taper(1.1), 'horn', ridged(1.2));
    else if (st === 'antelope') horn([P(0, 0, 0), P(0.06, 0.5, 0.32), P(0.1, 0.95, 0.62)], taper(0.85), 'horn', ridged(1));
    else if (st === 'lyre') horn([P(0, 0, 0), P(0.18, 0.35, 0.12), P(0.22, 0.65, 0.3), P(0.1, 0.92, 0.2)], taper(0.8), 'horn', ridged(1));
    else if (st === 'spiral') {
      const pts = [], ax = up.clone().multiplyScalar(0.75).add(back.clone().multiplyScalar(0.45)).add(out.clone().multiplyScalar(0.45)).normalize();
      const e1 = basisFrom(ax, out).u, e2 = new THREE.Vector3().crossVectors(ax, e1);
      for (let i = 0; i <= 20; i++) { const t = i / 20, a2 = t * TAU * (Hn.curl ?? 2.2) * side; pts.push(base.clone().addScaledVector(ax, t * len).addScaledVector(e1, (Math.cos(a2) - 1) * len * 0.09 * (1 - 0.4 * t)).addScaledVector(e2, Math.sin(a2) * len * 0.09 * (1 - 0.4 * t))); }
      horn(pts, taper(0.9));
    } else if (st === 'ossicones') {
      // (Digital Diorama revision 9: upright and leaning a little back in world axes; in head axes a head held face-down
      // turned them forward over the eyes)
      const Wd = V3(0, 1, 0), Bk = V3(0, 0, -1), O3 = (o, y, z) => base.clone().addScaledVector(out, o * len).addScaledVector(Wd, y * len).addScaledVector(Bk, z * len);
      horn([O3(0, 0, 0), O3(0.05, 0.55, 0.1), O3(0.07, 0.95, 0.16)], (u) => r0 * (1 - 0.25 * u) + r0 * 0.35 * bell(u, 1, 0.3), (u, a2, Pp) => u > 0.8 ? 'mane' : B.paint({ part: 'head', u: 0.2, a: Math.PI / 2, P: Pp }), null, 'round');
    } else if (st === 'pronghorn') {
      // (Digital Diorama revision 9) a pronghorn buck's horn: black, rising straight up over the eye, flattened side to side,
      // with a forward-pointing prong half way up and the tip hooked back and in. Built in world axes.
      const Wd = V3(0, 1, 0), Fw = V3(0, 0, 1), O3 = (o, y, z) => base.clone().addScaledVector(out, o * len).addScaledVector(Wd, y * len).addScaledVector(Fw, z * len);
      const main = [O3(0, 0, 0), O3(0.04, 0.4, 0.04), O3(0.06, 0.72, 0.02), O3(0.03, 0.92, -0.1), O3(-0.04, 0.98, -0.2)];
      const mg = loft({ pts: main, seg: Math.round(12 * det), rad: 2 * Math.round(3 * det + 2), w: (u) => r0 * 0.72 * Math.max(0.08, 1 - 0.85 * u), ht: (u) => r0 * (1.35 - 0.9 * sstep(0.3, 0.6, u)) * Math.max(0.1, 1 - 0.7 * u), hb: (u) => r0 * (1.35 - 0.9 * sstep(0.3, 0.6, u)) * Math.max(0.1, 1 - 0.7 * u),
        up: Fw, cap0: { type: 'round', len: 0.3, n: 2 }, cap1: { type: 'point', len: 0.8 }, bend: 0.4 });
      emit(part, mg, 'horn', HW);
      const pb = O3(0.04, 0.44, 0.08);
      horn([pb, O3(0.05, 0.5, 0.2), O3(0.05, 0.56, 0.3)], (q) => r0 * 0.5 * (1 - 0.85 * q));
    } else if (st === 'dagger') {
      // (Digital Diorama revision 9) slender, smooth horns rising from the forehead and curving gently back (a mountain goat's)
      horn([P(0.01, 0, 0), P(0.03, 0.5, 0.12), P(0.05, 0.82, 0.32), P(0.06, 0.98, 0.56)], taper(0.95));
    } else if (st === 'whitetail') {
      // Digital Diorama revision: a white-tailed deer's main beam curves out and back, then sweeps forward
      // over the brow, with a short brow tine and tall tines rising straight up from the beam
      const W = (o, y, z) => base.clone().addScaledVector(out, o * len).add(V3(0, y * len, z * len));
      const beam = [W(0, 0, 0), W(0.16, 0.2, -0.12), W(0.36, 0.38, -0.12), W(0.46, 0.5, 0.06), W(0.4, 0.56, 0.3), W(0.22, 0.57, 0.48)];
      horn(beam, (u) => r0 * (1 - 0.55 * u), 'horn', null, 'round');
      const bc = makePath(beam), n = Hn.tines ?? 4;
      for (let i = 0; i < n; i++) {
        const u = i === 0 ? 0.1 : 0.36 + (i - 1) * (0.5 / Math.max(1, n - 1)), b0 = bc.getPointAt(u);
        const tl = len * (i === 0 ? 0.2 : 0.46 - (i - 1) * 0.08), dir = V3(side * 0.06, 1, i === 0 ? 0.3 : 0.12).normalize();
        horn([b0, b0.clone().addScaledVector(dir, tl * 0.55).add(V3(0, 0, tl * 0.04)), b0.clone().addScaledVector(dir, tl)], (uu) => r0 * 0.55 * (1 - 0.88 * uu));
      }
    } else if (st === 'palmate') {
      // Digital Diorama revision 7: moose antlers (they were flat planks held out sideways). A short, thick beam runs out from
      // the skull to a broad palm that rises outward and back, cupped upward like an open hand, with tines along its outer
      // and back edges and a small brow tine forward. Built in world axes, like the whitetail's (the head is pitched down).
      const Wd = V3(0, 1, 0), Bk = V3(0, 0, -1);
      const e0 = base.clone().addScaledVector(out, 0.2 * len).addScaledVector(Wd, 0.07 * len).addScaledVector(Bk, 0.03 * len);
      horn([base, base.clone().lerp(e0, 0.55).addScaledVector(Wd, 0.015 * len), e0], (u) => r0 * (1.15 - 0.3 * u), 'horn', null, 'round');
      const A = out.clone().multiplyScalar(0.84).addScaledVector(Wd, 0.44).addScaledVector(Bk, 0.3).normalize();
      const Bv = Bk.clone().multiplyScalar(0.84).addScaledVector(Wd, 0.54); Bv.addScaledVector(A, -Bv.dot(A)).normalize();
      const Nn = new THREE.Vector3().crossVectors(A, Bv).normalize(); if (Nn.y < 0) Nn.negate();
      const pal = 0.78 * len, cupK = Hn.cup ?? 0.16;
      const wid = (u) => len * (0.2 + 0.52 * sstep(0, 0.6, u));
      const palm = (u, v) => e0.clone().addScaledVector(A, u * pal).addScaledVector(Bv, (v - 0.32) * wid(u))
        .addScaledVector(Nn, cupK * len * (0.55 * (2 * v - 1) ** 2 + 0.4 * u * u) * sstep(0, 0.35, u));
      sheet(part, { nu: Math.round(7 * det), nv: Math.round(5 * det), f: palm, th: (u) => r0 * 0.7 * (1 - 0.4 * u), zone: 'horn', skin: HW });
      // tines: along the outer edge, then down the back edge; they point out of the edge and curl up out of the cup
      const nT = Hn.tines ?? 8;
      for (let i = 0; i < nT; i++) {
        const t = i / (nT - 1), outer = t < 0.62, uu = outer ? 1 : lerp(1, 0.42, (t - 0.62) / 0.38), vv = outer ? lerp(0.06, 1, t / 0.62) : 1;
        const b0 = palm(uu, vv), edge = (outer ? A.clone().addScaledVector(Bv, (vv - 0.5) * 0.5) : Bv.clone().addScaledVector(A, 0.25)).normalize();
        const dir = edge.addScaledVector(Nn, 0.55).normalize(), tl = len * (0.15 + 0.07 * Math.sin(Math.PI * t));
        horn([b0.clone().addScaledVector(dir, -tl * 0.15), b0.clone().addScaledVector(dir, tl)], (q) => r0 * 0.4 * (1 - 0.88 * q));
      }
      // brow tine: forward and up from the front edge of the palm
      const bf = palm(0.22, 0), bdir = Bk.clone().negate().addScaledVector(out, 0.35).addScaledVector(Wd, 0.6).normalize();
      horn([bf, bf.clone().addScaledVector(bdir, 0.14 * len), bf.clone().addScaledVector(bdir, 0.24 * len).addScaledVector(Wd, 0.04 * len)], (q) => r0 * 0.45 * (1 - 0.85 * q));
    } else if (st === 'antlers') {
      const beam = [P(0, 0, 0), P(0.16, 0.3, 0.2), P(0.3, 0.62, 0.22), P(0.34, 0.88, 0.06), P(0.3, 1.02, -0.12)];
      horn(beam, (u) => r0 * (1 - 0.6 * u), 'horn', null, 'round');
      const bc = makePath(beam);
      const tines = Hn.tines ?? 3;
      for (let i = 0; i < tines; i++) {
        const u = 0.12 + (i / Math.max(1, tines)) * 0.75, b0 = bc.getPointAt(u), tl = len * (i === 0 ? 0.3 : 0.38 - i * 0.03);
        const dir = (i === 0 ? fwd.clone().multiplyScalar(0.9).add(up.clone().multiplyScalar(0.45)) : up.clone().multiplyScalar(0.9).add(fwd.clone().multiplyScalar(0.35)).add(out.clone().multiplyScalar(0.12))).normalize();
        horn([b0, b0.clone().addScaledVector(dir, tl * 0.55).addScaledVector(up, tl * 0.08), b0.clone().addScaledVector(dir, tl)], (uu) => r0 * 0.62 * (1 - 0.9 * uu));
      }
    }
  }
}

function tetraTusks(B, S, L) {
  const T = S.tusks;
  if (!T || T.style === 'none' || !(T.len > 0)) return;
  const g = L.head, hd = L.hd, hu = L.hu, len = T.len * L.H, r0 = (T.thk ?? 0.12) * len, part = B.part('tusks', { group: 'horns' });
  for (const side of [1, -1]) {
    const { p, n } = g.at(T.s ?? 0.82, 1.5 * Math.PI + side * (T.a ?? 0.9));
    const base = p.clone().addScaledVector(n, -r0 * 0.8), out = V3(side * (T.spread ?? 0.25), 0, 0);
    const pts = T.style === 'boar'
      ? [base, base.clone().addScaledVector(n, len * 0.3).addScaledVector(hd, len * 0.1), base.clone().addScaledVector(hu, len * 0.55).addScaledVector(hd, len * 0.2).add(out.clone().multiplyScalar(len)), base.clone().addScaledVector(hu, len * 0.8).addScaledVector(hd, -len * 0.05).add(out.clone().multiplyScalar(len * 1.2))]
      : [base, base.clone().addScaledVector(hu, -len * 0.3).addScaledVector(hd, len * 0.2).add(out.clone().multiplyScalar(len * 0.6)), base.clone().addScaledVector(hu, -len * 0.45).addScaledVector(hd, len * 0.62).add(out.clone().multiplyScalar(len)), base.clone().addScaledVector(hu, -len * (0.3 - (T.curl ?? 0.35))).addScaledVector(hd, len * 0.92).add(out.clone().multiplyScalar(len * 0.9))];
    const tg = loft({ pts, seg: Math.round(10 * B.det), rad: 8, w: (u) => r0 * (1 - 0.75 * u), ht: (u) => r0 * (1 - 0.75 * u), hb: (u) => r0 * (1 - 0.75 * u), cap0: 'flat', cap1: { type: 'round', len: 1, n: 2 }, bend: 0.3 });
    emit(part, tg, 'teeth', B.rig.W(T.style === 'boar' ? 'Jaw' : 'Head'));
  }
}

/** Elephant trunk (or tapir proboscis): ridged sweep with its own bone chain. */
function tetraTrunk(B, S, L) {
  const T = S.trunk;
  if (!T || !(T.len > 0)) return;
  const rig = B.rig, g = L.head, hd = L.hd, hu = L.hu, len = T.len * L.H, r0 = (T.thk ?? 0.2) * L.Lh;
  const fr = g.frame(0.97), base = fr.c.clone().addScaledVector(hu, -0.15 * L.ch).addScaledVector(hd, -0.12 * L.Lh);
  const pts = [base];
  const down = V3(0, -1, 0.08).normalize();
  for (let i = 1; i <= 10; i++) {
    const s = i / 10, d = hd.clone().lerp(down, sstep(0, 0.35, s)).normalize();
    if (s > 0.75) d.lerp(hd, (s - 0.75) * (T.curl ?? 1.4)).normalize();
    const q = pts[i - 1].clone().addScaledVector(d, len / 10); q.y = Math.max(q.y, 0.06 * L.H + r0 * 0.5); pts.push(q);
  }
  const curve = makePath(pts), nb = 5, names = [], us = [];
  for (let i = 0; i < nb; i++) { names.push('Trunk' + (i + 1)); us.push(i / nb); rig.add('Trunk' + (i + 1), i ? 'Trunk' + i : 'Head', curve.getPointAt(i / nb), curve.getPointAt((i + 1) / nb)); }
  const spec = rig.spec(names, us, 0.4);
  const tg = loft({ curve, seg: Math.round(26 * B.det), rad: 2 * Math.round(5 * B.det + 3), w: (u) => r0 * (1 - 0.62 * u), ht: (u) => r0 * (1 - 0.62 * u), hb: (u) => r0 * (1 - 0.62 * u) * 0.92,
    bump: (u, a) => (T.ridges ?? 1) * 0.07 * Math.max(0, Math.sin(u * 70)) * (Math.sin(a) > -0.2 ? 1 : 0.3), cap0: { type: 'round', len: 0.5 }, cap1: { type: 'round', len: 0.45, n: 3 }, bend: 0.4 });
  emit(B.part('trunk', { group: 'head' }), tg, (u, a, P) => u > 0.97 ? 'nose' : B.paint({ part: 'trunk', u, a, P }), (u) => u < 0.08 ? rig.W2('Head', 'Trunk1', u / 0.08) : rig.chain(spec, u));
}


/** Manes: horse/zebra crests as hair sheets along the neck crest; lion ruff as a shaggy collar loft; beards. */
function tetraMane(B, S, L) {
  const M = S.mane;
  // (Digital Diorama revision 9: a beard without a mane is still built; the goat's and bison's never were)
  if (!M || (M.style === 'none' && !M.beard)) return;
  const rig = B.rig, det = B.det, U = L.uOf, part = B.part('mane', { group: 'mane' });
  if (M.style === 'horse' || M.style === 'crest') {
    // (Digital Diorama revision 7: `back` carries a crest on along the spine toward the loin, like a boar's bristles)
    const u0 = lerp(lerp(U.chest, U.neckRoot, 0.45), U.loin, M.back || 0), u1 = lerp(U.neck2, U.neckTop, 0.85);
    const hgt = (M.h ?? 0.12) * L.H, fall = M.style === 'horse' ? (M.fall ?? 1.05) : 0.05;
    sheet(part, { nu: Math.round(16 * det), nv: 3,
      f: (u, v) => {
        const uu = lerp(u1, u0, u), { p, n } = L.torso.at(uu, Math.PI / 2), fr = L.torso.frame(uu);
        const dir = n.clone().applyAxisAngle(fr.t, fall * v).normalize();
        const lock = M.style === 'horse' ? 1 + 0.25 * Math.sin(u * 37) * v : 1, env = Math.pow(Math.sin(Math.PI * clamp(u * 1.08, 0, 1)), 0.45);
        return p.addScaledVector(n, -0.2 * hgt).addScaledVector(dir, (0.15 + v * env) * hgt * lock);
      },
      th: (u, v) => hgt * 0.22 * (1 - 0.7 * v), skin: (u) => rig.chain(L.axial, lerp(u1, u0, u)),
      // a striped coat carries its stripes up into the mane (zebras); other manes are one colour
      zone: S.pattern === 'stripes' ? (u, v, face, P) => (P && v < 0.86 ? B.paint({ part: 'mane', u, a: 0, P }) : 'mane') : 'mane' });
    if (M.forelock !== false && M.style === 'horse') {
      const { p, n } = L.head.at(0.12, Math.PI / 2);
      sheet(part, { nu: 4, nv: 2, f: (u, v) => p.clone().addScaledVector(n, hgt * 0.1 * (1 - u)).addScaledVector(L.hd, u * hgt * 1.3).addScaledVector(V3(1, 0, 0), (v - 0.5) * hgt * 0.5 * (1 - u * 0.6)),
        th: (u) => hgt * 0.15 * (1 - 0.7 * u), zone: 'mane', skin: rig.W('Head') });
    }
  } else if (M.style === 'lion') {
    // Ruff: frames the face from just behind the eyes, swells over the neck and wraps the shoulders.
    const hfr0 = L.head.frame(0.08), sz = (M.size ?? 0.74);
    const pts = [hfr0.c.clone().addScaledVector(L.hd, -0.02 * L.Lh), L.poll.clone().addScaledVector(L.nd, -0.15 * L.Ln), L.torso.frame(lerp(L.uOf.neck1, L.uOf.neckRoot, 0.5)).c, L.torso.frame(lerp(L.uOf.neckRoot, L.uOf.chest, 0.35)).c];
    const R0 = Math.max(L.cw * 1.9, L.ch * 2.0, L.nT * 1.6) * sz;
    const mg = loft({ pts, seg: Math.round(14 * det), rad: 2 * Math.round(8 * det + 3), up: L.hu,
      w: (u) => R0 * lerp(0.92, 1.0, Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.1))), ht: (u) => R0 * lerp(0.88, 0.98, u), hb: (u) => R0 * lerp(0.95, 1.3, u), oy: () => -R0 * 0.12,
      bump: (u, a) => 0.22 * (fbm(Math.cos(a) * 3 + u * 5, Math.sin(a) * 3, u * 4, 11) - 0.45) + 0.08 * Math.sin(a * 9 + u * 7),
      cap0: { type: 'round', len: 0.35, n: 3 }, cap1: { type: 'round', len: 0.55, n: 3 }, bend: 0.5 });
    // Digital Diorama revision: streaks of hair, a tawny fringe round the face darkening toward the shoulders
    const dark = M.dark ?? 0.65;
    const maneZone = (u, a) => {
      const st = fbm(Math.cos(a) * 5.5 + 3, Math.sin(a) * 5.5, u * 1.3, 23) + 0.12 * (fbm(Math.cos(a) * 18, Math.sin(a) * 18, u * 4, 31) - 0.5);
      if (st < lerp(0.62, 0.3, sstep(0.0, 0.42, u))) return 'body';
      return st > lerp(0.78, 0.52, sstep(0.3, 1, u) * dark) ? 'marking' : 'mane';
    };
    emit(part, mg, maneZone, (u, a, P) => rig.near(P, ['Head', 'Neck2', 'Neck1', 'Chest'], R0 * 1.2));
  }
  if (M.beard) {
    // chin beard (goat, bison): a tapered lock hanging from under the jaw
    // (Digital Diorama revision 9: `beardW`, its width × its length; a bison's is short and broad)
    const j = L.jaw.at(0.72, -Math.PI / 2), bl = M.beard * L.Lh, bw = bl * (M.beardW ?? 0.22);
    const pts = [j.p.clone().addScaledVector(j.n, -bw * 0.6), j.p.clone().add(V3(0, -bl * 0.45, -bl * 0.08)), j.p.clone().add(V3(0, -bl, -bl * 0.18))];
    emit(part, tube(pts, (u) => bw * (1 - 0.75 * u), 6, 8, { cap1: 'point', bump: (u, a) => 0.15 * Math.sin(a * 5 + u * 9) }), 'mane', rig.W('Jaw'));
  }
}

/** Udder with four teats under the rear belly (dairy cattle). Digital Diorama revision. */
function tetraUdder(B, S, L) {
  if (!(S.udder > 0)) return;
  const u = lerp(L.uOf.haunch, L.uOf.loin, 0.3), bot = L.torso.at(u, -Math.PI / 2).p, r = S.udder * L.H;
  const c = bot.clone().add(V3(0, -r * 0.35, 0)), part = B.part('udder', { group: 'body' }), W = B.rig.W('Hips');
  emit(part, ellipsoid(c, r * 0.95, r * 0.72, r * 1.15, [0, 0, 1], [0, 1, 0], Math.round(6 * B.det + 2), 2 * Math.round(5 * B.det + 2)), 'skin', W);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const t = c.clone().add(V3(sx * r * 0.42, -r * 0.5, sz * r * 0.5));
    emit(part, tube([t, t.clone().add(V3(0, -r * 0.45, 0))], r * 0.11, 3, 6, { cap1: { type: 'round', len: 0.6, n: 2 } }), 'skin', W);
  }
}

/** Quills / spines (hedgehog, porcupine): cones scattered over the dorsal half of the torso loft and crown. */
function tetraQuills(B, S, L) {
  const Q = S.quills;
  if (!Q) return;
  const rig = B.rig, part = B.part('spines', { group: 'spines' }), U = L.uOf, rnd = mulberry(S.seed ?? 3);
  const len = (Q.len ?? 0.32) * L.D, r = len * (Q.r ?? 0.09), n = Math.round((Q.count ?? 260) * B.det);
  for (let i = 0; i < n; i++) {
    const u = lerp(0.04, U.neckRoot + 0.04, Math.sqrt(rnd())), a = lerp(-0.25, Math.PI + 0.25, rnd());
    const { p, n: nn, t } = L.torso.at(u, a);
    const dir = nn.clone().addScaledVector(t, -(Q.lay ?? 0.85)).normalize();
    spike(part, p.clone().addScaledVector(nn, -len * 0.15), dir, len * lerp(0.7, 1.15, rnd()), r, rnd() > 0.55 ? 'marking' : 'pattern', rig.chain(L.axial, u), 4);
  }
}

/** Digital Diorama revision 7: where a front mane / cape begins along the torso (u), at height sin(a) round the section. */
function capeEdgeU(S, U, sa) {
  return lerp(U.barrel, U.chest, S.frontMane || 0) - (S.maneSlant || 0) * (sa + 0.2) * (U.chest - U.barrel);
}

/* ════════════════════════════════════════════════════════════════════════════
 *  ELEPHANT  (Digital Diorama revision 8: a dedicated builder)
 *  The generic tetrapod path made a grey lump of the African elephant: head and neck one shapeless mass with a bump
 *  over the shoulders, ears hanging off the head like curtains, a bulbous rump overhanging hind legs that pinched
 *  below it, thin legs ending in cylinders with dot toenails, a thin trunk. It is now built on its own, laid out from
 *  an adult bush elephant bull (fractions of its shoulder height U, 3 m) and checked against the species photo, side
 *  and front photographs and mounted skeletons:
 *   - body: one loft from the steep rump to the short neck, highest at the withers, the back dipping behind them and
 *     rising a little at the hips (0.9) before the rump falls to the tail; 1.1 long from the point of shoulder to the
 *     point of buttock; a deep chest, the belly line lowest (0.44) just behind the forelegs;
 *   - head and trunk: one loft, so the forehead slopes forward and down into the trunk (one dome, no saddle); the head
 *     carried low, its top level with the shoulders; a small low eye about half way between the ear and the trunk
 *     with the temporal hollow behind it; a pointed lower lip under the trunk; the trunk as wide as the face at its
 *     base, tapering steadily to a two-fingered tip about 0.1 above the ground, with ring folds;
 *   - ears: shells 0.58 tall and 0.43 wide shaped like the map of Africa, hung from a curved root line from above
 *     and behind the eye down to the corner of the mouth and laid back over the neck and shoulder outside the body
 *     (concave toward it), with a rolled top edge and a thickened rim; they fan about that root line;
 *   - legs: pillars (elbow 0.47, carpus 0.2; hip joint 0.7, stifle 0.4 with its fold bulging forward where the leg
 *     meets the belly, hock 0.16), lofted with their feet (round fore, 0.16 across; oval hind), which flare a little
 *     at the ground, with ring folds at the carpus, hock and ankle and broad flat pale toenails (4 fore, 3 hind);
 *   - tusks from skin sheaths beside the trunk base, curving down, forward and up; a tail with a flat black tuft;
 *     grey-brown skin with its creases and folds painted into the coat atlas.
 *  Body heights are remapped between the belly line and the withers and leg heights scale with the legs, so `legLen`
 *  lengthens the legs and keeps the body; `bodyLen`, `headSize`, `earSize` and `muzzleLen` (the trunk) scale their
 *  parts. Bone names, clip names and the clip solver are the tetrapod rig's.
 * ════════════════════════════════════════════════════════════════════════════ */
/** Scales and landmark maps of the elephant builder; also the fields the shared helpers read (painter, skins, clips). */
function eleLayout(S, p) {
  const ref = SPECIES.elephant, legK = Math.sqrt(p.legLen || 1), H = S.H, U = H / legK, D = S.depth * H, floor = H - D;
  const L = { elephant: true, H, U, D, limbs: [] };
  L.kLen = (S.len * H) / (ref.len * U);              // bodyLen
  L.hs = S.headLen / ref.headLen / legK;              // headSize (× 1.3 for calves)
  L.es = (S.ear.len || ref.ear.len) / ref.ear.len;    // earSize (× 1.15 for calves)
  L.ts = S.snout / ref.snout;                         // muzzleLen: the trunk (× 0.8 for calves)
  L.yb = (y) => floor + ((y - 0.425) / 0.575) * D;    // a height of the reference bull's body, between belly line and withers
  L.yl = (y) => (y / 0.425) * floor;                  // a height below its belly line (scales with the legs)
  L.zb = (z) => z * L.kLen * U;
  L.neckK = (S.neckLen / ref.neckLen - 1) * 0.05 * U;   // neckLen: the head a little further forward or back
  const A = V3(0, L.yb(0.8), L.zb(0.62) + L.neckK), R = U * L.hs;
  /** A point of the reference bull's head (z, y; x across), scaled by the head size about the poll. */
  L.hp = (z, y, x = 0) => V3(x * R, A.y + (y - 0.8) * R, A.z + (z - 0.62) * R);
  L.R = R;
  L.Lt = S.len * H; L.zF = L.zb(0.54); L.zB = L.zb(-0.56); L.yR = L.yb(0.73); L.Dr = L.yb(0.73) - L.yb(0.545); L.hw = 0.273 * U;
  L.elbowY = L.yl(0.47); L.nd = V3(0, 0.15, 1).normalize(); L.Lh = 0.4 * R; L.ch = 0.4 * R; L.cw = 0.3 * R;
  return L;
}

/** Torso and neck: one loft through the stations of the reference bull; creates the axial bones. */
function eleTorso(B, S, L) {
  const det = B.det, rig = B.rig, U = L.U;
  // station: name, z, top, bottom, half-width (× U), side narrowing toward the top and toward the belly
  const keys = [
    ['rump', -0.505, 0.665, 0.5, 0.17, 0.72, 0.8],
    ['haunch', -0.37, 0.935, 0.465, 0.236, 0.76, 0.86],
    ['flank', -0.21, 0.925, 0.448, 0.258, 0.66, 0.9],
    ['loin', -0.05, 0.912, 0.432, 0.272, 0.62, 0.92],
    ['barrel', 0.11, 0.952, 0.425, 0.276, 0.6, 0.92],
    ['chest', 0.27, 1.0, 0.435, 0.26, 0.56, 0.88],
    ['shoulder', 0.41, 0.988, 0.46, 0.232, 0.6, 0.86],
    ['neckRoot', 0.515, 0.945, 0.495, 0.2, 0.7, 0.84],
    ['neck1', 0.585, 0.91, 0.53, 0.178, 0.82, 0.86],
    ['neckTop', 0.655, 0.9, 0.55, 0.162, 0.9, 0.9],
  ].map(([n, z, top, bot, w, sT, sB]) => { const t = L.yb(top), b = L.yb(bot), c = lerp(b, t, 0.4); return { n, c: V3(0, c, L.zb(z) + (n === 'neckTop' ? 1 : n === 'neck1' ? 0.5 : 0) * L.neckK), ht: t - c, hb: c - b, w: w * U, sT, sB }; });
  const curve = makePath(keys.map(k => k.c)), ku = knotUs(curve, keys.length);
  keys.forEach((k, i) => { k.u = ku[i]; });
  const Uo = Object.fromEntries(keys.map(k => [k.n, k.u]));
  const pW = prof(keys.map(k => [k.u, k.w])), pHT = prof(keys.map(k => [k.u, k.ht])), pHB = prof(keys.map(k => [k.u, k.hb]));
  const stT = prof(keys.map(k => [k.u, k.sT])), stB = prof(keys.map(k => [k.u, k.sB]));
  // the side narrows over the back and under the belly: widest about 40 % of the way up, a rounded roof over the spine
  const sect = (u, a, x, y, h1, h2) => { const yn = Math.min(1, Math.abs(y) / Math.max(1e-9, y >= 0 ? h1 : h2)); return [x * lerp(1, y >= 0 ? stT(u) : stB(u), sstep(0.04, 0.92, yn)), y]; };
  // surface anatomy (radial factors): the spine along the back, the points of the hips, the shoulder blade and the
  // triceps over the elbow, the hollow of the flank in front of the thigh
  const G = (v, c, w) => Math.exp(-(((v - c) / w) ** 2));
  const uSc = lerp(Uo.chest, Uo.shoulder, 0.35), uEl = lerp(Uo.chest, Uo.shoulder, 0.75), uHo = lerp(Uo.haunch, Uo.flank, 0.8);
  const bump = (u, a) => {
    const sa = Math.sin(a), ca = Math.abs(Math.cos(a));
    let f = 0.014 * G(ca, 0, 0.09) * (sa > 0 ? 1 : 0) * sstep(Uo.rump, Uo.haunch, u) * (1 - sstep(Uo.shoulder, Uo.neckRoot, u));
    f += 0.03 * G(u, Uo.haunch, 0.045) * G(ca, 0.66, 0.15) * (sa > 0 ? 1 : 0);
    f += 0.026 * G(u, uSc, 0.06) * G(sa, 0.52, 0.28);
    f += 0.022 * G(u, uEl, 0.05) * G(sa, -0.42, 0.28);
    f -= 0.02 * G(u, uHo, 0.05) * G(sa, 0.02, 0.32);
    return f;
  };
  const g = loft({ curve, seg: Math.round(44 * det), rad: 2 * Math.round(13 * det + 3), w: pW, ht: pHT, hb: pHB, nt: 2.05, nb: 2.3,
    cap0: { type: 'round', len: 0.36, n: 4 }, cap1: { type: 'round', len: 0.6, n: 3 }, bend: 0.85, bump, sect });
  L.torso = g; L.torsoCurve = curve; L.uOf = { ...Uo, neck2: lerp(Uo.neck1, Uo.neckTop, 0.5) };
  L.torsoW = pW; L.torsoHt = pHT; L.torsoHb = pHB;
  const at = (u, bias = 0.25) => { const f = g.frame(u); return f.c.addScaledVector(f.up, bias * pHT(u)); };
  rig.add('Root', null, [0, 0, 0]);
  rig.add('Hips', 'Root', at(Uo.haunch));
  rig.add('Spine1', 'Hips', at(Uo.loin));
  rig.add('Spine2', 'Spine1', at(Uo.barrel));
  rig.add('Chest', 'Spine2', at(Uo.chest));
  rig.add('Neck1', 'Chest', at(Uo.neckRoot, 0.1));
  rig.add('Neck2', 'Neck1', at(L.uOf.neck2, 0));
  L.axial = rig.spec(['Hips', 'Spine1', 'Spine2', 'Chest', 'Neck1', 'Neck2', 'Head'], [0, Uo.loin, Uo.barrel, Uo.chest, Uo.neckRoot + 0.02, L.uOf.neck2, Uo.neckTop - 0.01], 0.32);
  return g;
}

/** Leg joints for the clip solver (graviportal: pillars, pad feet touching down at their front edge). */
function eleLimbLayout(B, S, L) {
  const U = L.U, z = L.zb;
  for (const front of [true, false]) for (const side of [1, -1]) {
    const x = side * (front ? 0.14 : 0.145) * U, J = (xx, y, zz, w, d) => ({ p: V3(xx, Math.max(0, y), zz), w: w * U, d: (d ?? w) * U });
    // fore: top of the shoulder blade, shoulder joint, elbow, carpus, pad joint, front edge of the sole
    // hind: hip joint, stifle, hock, pad joint, front edge of the sole
    const joints = front
      ? [J(x * 0.55, L.yb(0.9), z(0.31), 0.05, 0.07), J(x, L.yb(0.655), z(0.455), 0.085, 0.115), J(x, L.yl(0.47), z(0.35), 0.09, 0.11), J(x, L.yl(0.205), z(0.37), 0.078), J(x, L.yl(0.062), z(0.377), 0.079), J(x, 0, z(0.377) + 0.082 * U, 0.082)]
      : [J(x, L.yb(0.7), z(-0.36), 0.1, 0.165), J(x * 1.03, L.yl(0.4), z(-0.322), 0.095, 0.12), J(x, L.yl(0.16), z(-0.35), 0.076, 0.08), J(x, L.yl(0.06), z(-0.341), 0.068, 0.076), J(x, 0, z(-0.341) + 0.081 * U, 0.069)];
    const sfx = side > 0 ? 'L' : 'R', bones = (front ? LIMB_BONES.front : LIMB_BONES.hind).map(n => n + sfx);
    const rj = joints[front ? 1 : 0], reach = Math.max(rj.w, rj.d * 0.7) * 2.4;
    L.limbs.push({ front, side, sfx, st: 'graviportal', kind: 'graviportal', foot: 'pad', footType: 'pad', joints, bones, inf: front ? [1, 2, 1] : [0, 1, 0], reach, pull: 0.55 });
  }
}

/** A leg lofted with its foot through its side-view outline; ring folds, a flat sole, toenails. */
function eleLeg(B, S, L, lm) {
  const det = B.det, rig = B.rig, U = L.U, yb = L.yb, yl = L.yl, J = lm.joints.map(j => j.p), side = lm.side, x = J[1].x;
  // station: height, z (× U), front and back half-depths, half-width (× U)
  const st = lm.front ? [
    [yb(0.88), 0.33, 0.06, 0.065, 0.05], [yb(0.77), 0.395, 0.1, 0.11, 0.078], [yb(0.655), 0.43, 0.115, 0.13, 0.095], [yb(0.555), 0.39, 0.115, 0.135, 0.1],
    [yl(0.47), 0.355, 0.1, 0.135, 0.1], [yl(0.4), 0.36, 0.096, 0.105, 0.096], [yl(0.31), 0.365, 0.088, 0.093, 0.09], [yl(0.245), 0.368, 0.082, 0.085, 0.085],
    [yl(0.205), 0.37, 0.085, 0.085, 0.087], [yl(0.16), 0.372, 0.079, 0.079, 0.08], [yl(0.11), 0.374, 0.075, 0.075, 0.076], [yl(0.07), 0.376, 0.077, 0.077, 0.078],
    [yl(0.03), 0.377, 0.081, 0.081, 0.081], [0, 0.377, 0.082, 0.082, 0.082],
  ] : [
    [yb(0.82), -0.37, 0.1, 0.11, 0.065], [yb(0.7), -0.365, 0.17, 0.19, 0.108], [yb(0.57), -0.355, 0.165, 0.188, 0.112], [yl(0.415), -0.3, 0.13, 0.175, 0.104],
    [yl(0.34), -0.325, 0.102, 0.135, 0.094], [yl(0.27), -0.338, 0.091, 0.108, 0.087], [yl(0.205), -0.344, 0.083, 0.09, 0.082], [yl(0.16), -0.348, 0.08, 0.096, 0.081],
    [yl(0.115), -0.345, 0.075, 0.079, 0.072], [yl(0.07), -0.342, 0.077, 0.08, 0.07], [yl(0.03), -0.341, 0.08, 0.083, 0.07], [0, -0.341, 0.081, 0.083, 0.069],
  ];
  const pts = st.map((s, i) => V3(i === 0 ? x * 0.6 : x, s[0], L.zb(s[1])));
  const curve = makePath(pts), ku = knotUs(curve, pts.length);
  const pF = prof(st.map((s, i) => [ku[i], s[2] * U])), pB = prof(st.map((s, i) => [ku[i], s[3] * U])), pW = prof(st.map((s, i) => [ku[i], s[4] * U]));
  const yAt = prof(st.map((s, i) => [ku[i], s[0]]));
  // rows three times denser on the lower leg, so the ring folds there are real creases
  const uLow = ku[st.findIndex(s => s[0] <= yl(0.27))], NT = 240, cdf = [0];
  for (let i = 1; i <= NT; i++) cdf.push(cdf[i - 1] + ((i - 0.5) / NT >= uLow ? 3.2 : 1));
  const dist = (t) => { const c = t * cdf[NT]; let i = 1; while (i < NT && cdf[i] < c) i++; return (i - 1 + (c - cdf[i - 1]) / Math.max(1e-9, cdf[i] - cdf[i - 1])) / NT; };
  const rings = lm.front ? [0.045, 0.08, 0.115, 0.18, 0.215, 0.25] : [0.045, 0.08, 0.115, 0.135, 0.17, 0.205], sig = 0.0065 * U;
  const bump = (u) => { const y = yAt(u); let f = 0; for (const r of rings) { const d = (y - yl(r)) / sig; if (d * d < 9) f += Math.exp(-d * d); } return -0.04 * f; };
  const g = loft({ curve, seg: Math.round(40 * det), rad: 2 * Math.round(7 * det + 2), dist, w: pW, ht: pF, hb: pB, nt: 2.1, nb: 2.1, up: [0, 0, 1], bump,
    cap0: { type: 'round', len: 0.5, n: 3 }, cap1: 'flat', bend: 0.4, antifold: false });
  // the sole flat on the ground
  for (const q of g.rows[g.main[1]]) q.y = 0;
  if (g.tip1) g.tip1.y = 0;
  lm.grid = g; lm.us = ku;
  // only the top of the shoulder blade / ilium is tucked into the body; the elephant's thigh and upper arm are the
  // outline of the body there (tucked into the narrower rump they pinched)
  lm.tuck = lm.front ? [ku[1], ku[2]] : [ku[0], ku[1]];
  // skin by joint planes; the foot below a level plane at the pad joint, so it stays flat as the leg tilts
  const nb = lm.bones.length, sj = J.slice(0, nb).concat([J[nb - 1].clone().add(V3(0, -0.05 * U, 0))]);
  const h = lm.front ? J[1].y : J[0].y;
  const skin = planeSkin(rig, sj, lm.bones, lm.front ? [0.07 * h, 0.06 * h, 0.035 * h, 0.03 * h] : [0.1 * h, 0.05 * h, 0.03 * h], lm.front ? [-0.3, 0.45] : [-0.25, 0.5], lm.front ? 'Chest' : 'Hips');
  const nm = `leg-${lm.front ? 'front' : 'hind'}-${side > 0 ? 'left' : 'right'}`;
  lm.emitLeg = () => emit(B.part(nm, { group: 'legs' }), g, (u, a, P) => B.paint({ part: P.y < yl(0.1) ? 'foot' : 'leg', u, a, P, front: lm.front, side }), skin);
  // points of its surface, with their skin weights, for poses that must keep a thick leg above the ground (lying down)
  lm.surf = [];
  for (let r = g.main[0]; r <= g.main[1]; r++) for (let j = 0; j < g.R; j += 2) lm.surf.push({ P: g.rows[r][j].clone(), W: skin(g.us[r], (j / g.R) * TAU, g.rows[r][j]) });
  // broad flat pale toenails round the front edge of the foot: four on the fore feet, three on the hind
  const part = B.part(`foot-${nm.slice(4)}`, { group: 'feet' }), W = rig.W(lm.bones[nb - 1]), yN = 0.025 * U;
  let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (yAt(m) > yN) lo = m; else hi = m; }
  for (const th of lm.front ? [-0.98, -0.33, 0.33, 0.98] : [-0.62, 0, 0.62]) {
    const { p, n } = g.at(lo, Math.PI / 2 - th), nn = V3(n.x, 0, n.z).normalize(), c = p.clone().addScaledVector(nn, -0.003 * U); c.y = yN;
    emit(part, ellipsoid(c, 0.03 * U, 0.023 * U, 0.011 * U, nn, [0, 1, 0], 3, 2 * Math.round(3 * det + 1)), 'hoof', W);
  }
  return g;
}

/** Head and trunk: one loft from the back of the skull over the brow, down the forehead and along the trunk. */
function eleHead(B, S, L) {
  const det = B.det, rig = B.rig, U = L.U, R = L.R, hp = L.hp;
  const head = [[0.6, 0.79], [0.7, 0.8], [0.81, 0.775], [0.905, 0.715], [0.965, 0.635]].map(([z, y]) => hp(z, y)), base = head[4];
  // the trunk hangs from its base (× muzzleLen about the base), its tip a little forward and clear of the ground
  const yMin = 0.06 * L.H;
  const trunk = [[1.0, 0.53], [1.012, 0.42], [1.016, 0.31], [1.012, 0.21], [1.02, 0.135], [1.042, 0.098]].map(([z, y]) => base.clone().lerp(hp(z, y), L.ts));
  for (const q of trunk) if (q.y < yMin) { q.z += (yMin - q.y) * 0.8; q.y = yMin; }
  const path = [...head, ...trunk], curve = makePath(path), ku = knotUs(curve, path.length), uB = ku[4];
  const tOf = (u) => clamp((u - uB) / (1 - uB), 0, 1);
  // head sections at the five head stations: half-width, forehead and underside half-heights (× head scale)
  const hk = [[0.158, 0.13, 0.2], [0.175, 0.178, 0.222], [0.168, 0.165, 0.2], [0.128, 0.117, 0.127], [0.085, 0.084, 0.085]].map(k => k.map(v => v * R));
  const hW = prof(hk.map((k, i) => [ku[i], k[0]])), hT = prof(hk.map((k, i) => [ku[i], k[1]])), hBt = prof(hk.map((k, i) => [ku[i], k[2]]));
  const rTip = 0.026 * R, tr = (t, r0) => lerp(r0, rTip, Math.pow(t, 0.9));
  const W = (u) => u <= uB ? hW(u) : tr(tOf(u), hk[4][0]) * lerp(1, 1.03, sstep(0, 0.1, tOf(u)));
  const HT = (u) => u <= uB ? hT(u) : tr(tOf(u), hk[4][1]);
  const HB = (u) => u <= uB ? hBt(u) : tr(tOf(u), hk[4][2]) * lerp(1, 0.9, sstep(0, 0.1, tOf(u)));
  const NT = prof([[ku[0], 2.2], [ku[1], 2.45], [ku[2], 2.5], [ku[3], 2.45], [uB, 2.05], [1, 2.0]]), NB = prof([[ku[0], 2.2], [ku[2], 2.2], [ku[3], 2.1], [uB, 2.0], [lerp(uB, 1, 0.1), 2.35], [1, 2.3]]);
  // rows: the head, then three a ring fold along the trunk (a crease row between two plain ones)
  const nR = det >= 0.9 ? 16 : 10, Kh = Math.max(8, Math.round(18 * det)), Kt = 3 * nR, K = Kh + Kt;
  const dist = (t) => { const k = t * K; return k <= Kh ? (k / Kh) * uB : uB + ((k - Kh) / Kt) * (1 - uB); };
  // the temporal hollow above and behind the eye; the trunk's ring folds, deeper over its top
  const uF = lerp(ku[2], ku[3], 0.12);
  const bump = (u, a) => {
    const sa = Math.sin(a);
    if (u <= uB) { const e = Math.atan2(sa, Math.abs(Math.cos(a))); return -0.09 * Math.exp(-(((u - uF) / 0.035) ** 2) - ((e - 0.36) / 0.2) ** 2); }
    const t = tOf(u);
    return -0.07 * Math.pow(Math.abs(Math.cos(Math.PI * t * nR)), 12) * (0.45 + 0.55 * Math.max(0, sa)) * sstep(0.04, 0.12, t) * (1 - sstep(0.9, 0.97, t));
  };
  const g = loft({ curve, seg: K, dist, rad: 2 * Math.round(9 * det + 3), w: W, ht: HT, hb: HB, nt: NT, nb: NB, up: [0, 1, 0], bump,
    cap0: { type: 'round', len: 0.7, n: 3 }, cap1: 'flat', bend: 0.25, antifold: false });
  L.trunkTipRest = trunk[trunk.length - 1].clone();
  L.head = g; L.headO = head[0].clone(); L.hd = base.clone().sub(head[0]).normalize(); L.hu = V3(0, 1, 0); L.Lh = head[0].distanceTo(base);
  L.headS = { s0: 0.6, sEye: 0.5, uB, ku };
  rig.add('Head', 'Neck2', hp(0.61, 0.775));
  // trunk bones along the trunk, from its base
  const tcurve = makePath([base, ...trunk]), names = [], tus = [];
  for (let i = 0; i < 5; i++) { names.push('Trunk' + (i + 1)); tus.push(i / 5); rig.add('Trunk' + (i + 1), i ? 'Trunk' + i : 'Head', tcurve.getPointAt(i / 5), tcurve.getPointAt((i + 1) / 5)); }
  const spec = rig.spec(names, tus, 0.4), headW = rig.W('Head');
  const skin = (u) => { const w = sstep(uB - 0.04, uB + 0.06, u); return w <= 0 ? headW : mixW(headW, rig.chain(spec, tOf(u)), w); };
  // two parts sharing the row at the trunk base (the trunk can be hidden; finish blends their normals across it)
  const kb = g.main[0] + Kh, nr = g.rows.length;
  const sub = (k0, k1, tip0, tip1) => ({ rows: g.rows.slice(k0, k1 + 1), us: g.us.slice(k0, k1 + 1), R: g.R, closed: false, tip0, tip1, main: [0, k1 - k0] });
  const uE = lerp(ku[2], ku[3], 0.3);
  const mouth = (u, a) => u > lerp(ku[2], ku[3], 0.85) && u < uB - 0.01 && Math.abs(a - 1.5 * Math.PI) < 0.32;
  emit(B.part('head', { group: 'head' }), sub(0, kb, g.tip0, null), (u, a, P) => mouth(u, a) ? 'mouth' : B.paint({ part: 'head', u, a, P, s0: 0.6 }), skin);
  emit(B.part('trunk', { group: 'head' }), sub(kb, nr - 1, null, g.tip1), (u, a, P) => tOf(u) > 0.995 ? 'nose' : B.paint({ part: 'trunk', u: tOf(u), a, P, rings: nR * 2.5 }), skin);
  // the trunk's two fingers: lips of its tip, front and back
  const tipF = g.frame(1), tPart = B.part('trunk', { group: 'head' }), T5 = rig.W('Trunk5');
  for (const s of [1, -1]) {
    const c = tipF.c.clone().addScaledVector(tipF.up, s * HT(1) * 0.7).addScaledVector(tipF.t, -0.004 * R);
    emit(tPart, ellipsoid(c.addScaledVector(tipF.t, 0.012 * R), 0.011 * R, 0.008 * R, 0.017 * R, tipF.t, tipF.up, 3, 2 * Math.round(3 * det + 1)), (u, a, P) => B.paint({ part: 'trunk', u: 1, a, P }), T5);
  }
  // ── the jaw: short and deep, ending in the pointed lower lip under the trunk; hinged under the ear
  // (its top tucked inside the cheeks and the trunk base; the lip ends just behind and below the trunk)
  const jp = [hp(0.72, 0.64), hp(0.79, 0.6), hp(0.85, 0.574), hp(0.895, 0.552)];
  const jk = [[0.074, 0.03, 0.046], [0.066, 0.028, 0.044], [0.044, 0.02, 0.031], [0.016, 0.01, 0.012]].map(k => k.map(v => v * R));
  const jc = makePath(jp), jku = knotUs(jc, jp.length);
  const jg = loft({ curve: jc, seg: Math.round(12 * det), rad: 2 * Math.round(6 * det + 2), w: prof(jk.map((k, i) => [jku[i], k[0]])), ht: prof(jk.map((k, i) => [jku[i], k[1]])), hb: prof(jk.map((k, i) => [jku[i], k[2]])),
    nt: 1.9, nb: 2.2, up: [0, 1, 0], cap0: { type: 'round', len: 0.6, n: 2 }, cap1: { type: 'round', len: 1.1, n: 2 }, bend: 0.5 });
  rig.add('Jaw', 'Head', hp(0.72, 0.655), jp[3]);
  L.jaw = jg; L.lipRest = jp[3].clone();
  emit(B.part('jaw', { group: 'head' }), jg, (u, a, P) => Math.sin(a) > 0.85 && u > 0.3 && u < 0.78 ? 'mouth' : B.paint({ part: 'jaw', u, a, P, s0: 0.6 }), rig.W('Jaw'));
  // ── small eyes set low on the side of the head, with heavy lids
  const eyeR = 0.0118 * R * (S.eye / SPECIES.elephant.eye);
  L.eyes = [1, -1].map((side) => {
    const dir = V3(side * 0.93, -0.16, 0.33).normalize(), hit = surfaceToward(g, g.frame(uE).c, dir, ku[1], ku[3]);
    return { c: hit.p.clone().addScaledVector(hit.n, -eyeR * 0.45), dir: hit.n.clone().lerp(dir, 0.35).normalize(), side };
  });
  for (const { c, dir } of L.eyes) {
    emit(B.part('eyes', { group: 'head' }), ellipsoid(c, eyeR, eyeR * 0.85, eyeR, dir, V3(0, 1, 0), Math.round(6 * det + 2), 2 * Math.round(5 * det + 2)), (u) => u > 0.86 ? 'pupil' : 'eye', headW);
    if (det >= 0.9) {
      const bas = basisFrom(dir, V3(0, 1, 0)), ring = [];
      for (let i = 0; i < 14; i++) { const t = (i / 14) * TAU; ring.push(c.clone().addScaledVector(dir, eyeR * 0.2).addScaledVector(bas.s, Math.cos(t) * eyeR * 1.0).addScaledVector(bas.u, Math.sin(t) * eyeR * 0.85)); }
      emit(B.part('eyelids', { group: 'head' }), loft({ pts: ring, closed: true, seg: 14, rad: 5, w: eyeR * 0.24, ht: eyeR * 0.24, hb: eyeR * 0.24, up: dir }), 'lid', headW);
    }
  }
  return g;
}

/** Max |x| of the head, jaw and torso near (z, y): what an ear must lie outside of. */
function eleSideX(L) {
  const cell = 0.012 * L.U, m = new Map(), key = (y, z) => `${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (const g of [L.head, L.jaw, L.torso]) for (const row of g.rows) for (const q of row) { const k = key(q.y, q.z); if (Math.abs(q.x) > (m.get(k) || 0)) m.set(k, Math.abs(q.x)); }
  return (y, z) => { const cy = Math.floor(y / cell), cz = Math.floor(z / cell); let b = 0; for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) b = Math.max(b, m.get(`${cy + dy},${cz + dz}`) || 0); return b; };
}

/** Ears: an Africa-shaped shell hung from a curved root line on the side of the head and laid back over the neck and shoulder. */
function eleEars(B, S, L) {
  const det = B.det, rig = B.rig, U = L.U, E = L.es * U, sideX = eleSideX(L);
  // outline (z forward, y up; × ear size) from the top of the root: front edge (the top corner, down the root to its
  // bottom at the corner of the mouth), top edge, back edge (bulging high up, then sweeping down and forward), and the
  // free lower edge from the root to the pointed lobe
  const P = (a) => a.map(([z, y]) => V3(0, y, z));
  const cF = makePath(P([[-0.004, 0.1], [-0.008, 0.055], [0, 0], [0.006, -0.135], [0.01, -0.27]]));
  const cT = makePath(P([[-0.004, 0.1], [-0.11, 0.118], [-0.23, 0.112], [-0.33, 0.08]]));
  const cB = makePath(P([[-0.33, 0.08], [-0.385, 0.015], [-0.402, -0.07], [-0.377, -0.17], [-0.31, -0.27], [-0.2, -0.355], [-0.08, -0.4]]));
  const cL = makePath(P([[0.01, -0.27], [0.004, -0.33], [-0.03, -0.375], [-0.08, -0.4]]));
  const c00 = cF.getPointAt(0), c10 = cB.getPointAt(0), c01 = cF.getPointAt(1), c11 = cB.getPointAt(1);
  const coons = (u, v) => cT.getPointAt(u).multiplyScalar(1 - v).add(cL.getPointAt(u).multiplyScalar(v)).add(cF.getPointAt(v).multiplyScalar(1 - u)).add(cB.getPointAt(v).multiplyScalar(u))
    .sub(c00.clone().multiplyScalar((1 - u) * (1 - v))).sub(c10.clone().multiplyScalar(u * (1 - v))).sub(c01.clone().multiplyScalar((1 - u) * v)).sub(c11.clone().multiplyScalar(u * v));
  const nu = Math.round(16 * det) + 2, nv = Math.round(14 * det) + 2;
  L.earInfo = {};
  for (const side of [1, -1]) {
    const rt = L.hp(0.748, 0.872), rb = L.hp(0.772, 0.61);
    const RT = V3(side * sideX(rt.y, rt.z), rt.y, rt.z), RB = V3(side * sideX(rb.y, rb.z), rb.y, rb.z);
    // the outline laid out on the body: z, y from the outline; x outside the head, neck and shoulder, a little further
    // off toward the free back edge and the lobe, then smoothed so the shell bends evenly (concave toward the body)
    const grid = [], xs = [];
    for (let i = 0; i <= nu; i++) {
      grid.push([]); xs.push([]);
      for (let j = 0; j <= nv; j++) {
        const u = i / nu, v = j / nv, q = coons(u, v), y = RT.y + q.y * E, z = RT.z + q.z * E;
        grid[i].push(V3(0, y, z));
        xs[i].push(sideX(y, z) + U * (0.008 + 0.042 * sstep(0.04, 1, u) + 0.03 * sstep(0.45, 1, v)));
      }
    }
    const K = 3, sm = (a, i, j) => { let s = 0, n = 0; for (let di = -K; di <= K; di++) for (let dj = -K; dj <= K; dj++) { const ii = clamp(i + di, 0, nu), jj = clamp(j + dj, 0, nv); s += a[ii][jj]; n++; } return s / n; };
    const dil = xs.map((row, i) => row.map((_, j) => { let m = 0; for (let di = -K; di <= K; di++) for (let dj = -K; dj <= K; dj++) m = Math.max(m, xs[clamp(i + di, 0, nu)][clamp(j + dj, 0, nv)]); return m; }));
    const xsm = dil.map((row, i) => row.map((_, j) => sm(dil, i, j)));
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const u = i / nu, v = j / nv, q = grid[i][j], curl = (1 - sstep(0, 0.14, v)) ** 2;
      // the top margin rolls outward and over; the back margin turns out a little; soft folds run down the ear
      const x = xsm[i][j] + E * (0.026 * curl * Math.pow(Math.sin(Math.PI * clamp(u * 1.08, 0, 1)), 0.6) + 0.02 * sstep(0.8, 1, u) * (1 - 0.5 * v) + 0.009 * Math.sin(TAU * (1.4 * u + 0.6 * v) - 0.5) * sstep(0.15, 0.45, u));
      q.x = side * x; q.y -= E * 0.012 * curl;
    }
    const bone = side > 0 ? 'EarL' : 'EarR', pivot = RT.clone().lerp(RB, 0.5);
    rig.add(bone, 'Head', pivot, grid[Math.round(nu * 0.6)][Math.round(nv * 0.45)]);
    // which face of the sheet looks toward the body (the pinker inner skin)
    const n0 = new THREE.Vector3().crossVectors(grid[nu][Math.round(nv / 2)].clone().sub(grid[0][Math.round(nv / 2)]), grid[Math.round(nu / 2)][nv].clone().sub(grid[Math.round(nu / 2)][0]));
    const inner = n0.x * side < 0 ? 1 : -1;
    sheet(B.part('ears', { group: 'ears' }), { nu, nv, f: (u, v) => grid[Math.round(u * nu)][Math.round(v * nv)].clone(),
      th: (u, v) => E * (0.009 + 0.018 * (1 - sstep(0, 0.14, u)) + 0.009 * Math.max(sstep(0.86, 1, u), sstep(0.88, 1, v), 1 - sstep(0, 0.1, v))),
      zone: (u, v, face) => face === inner && v > 0.13 && u > 0.1 ? 'skin' : B.paint({ part: 'ear', u, a: v * TAU, P: grid[Math.round(u * nu)][Math.round(v * nv)] }),
      skin: (u) => u < 0.14 ? rig.W2('Head', bone, u / 0.14) : rig.W(bone) });
    // what the clips need: the fan axis (the root line, upward) and points along the free edges to keep clear of the body
    const edge = [];
    for (const [u, v] of [[1, 0.1], [1, 0.3], [1, 0.5], [0.85, 0.8], [0.55, 0.95], [0.3, 1], [0.7, 0.05], [0.4, 0.02]]) edge.push(grid[Math.round(u * nu)][Math.round(v * nv)].clone());
    L.earInfo[bone] = { axis: RT.clone().sub(RB).normalize(), pivot, edge, side };
  }
}

/** Tusks from skin sheaths beside the trunk base, curving down, forward and up. */
function eleTusks(B, S, L) {
  const T = S.tusks;
  if (!T || T.style === 'none' || !(T.len > 0)) return;
  const det = B.det, U = L.U, len = T.len * U, r0 = (T.thk ?? 0.064) * len, part = B.part('tusks', { group: 'horns' }), W = B.rig.W('Head');
  for (const side of [1, -1]) {
    const I0 = L.hp(0.89, 0.65, 0.08 * side), E = L.hp(0.935, 0.6, 0.1 * side);
    const d0 = V3(side * 0.12, -0.9, 0.4).normalize(), d1 = V3(-side * 0.06, 0.5, 0.86).normalize(), N = 10, pts = [I0, E];
    let q = E.clone();
    for (let i = 1; i <= N; i++) { const t = (i - 0.5) / N; q = q.clone().addScaledVector(d0.clone().lerp(d1, sstep(0, 1, t) * 0.7 + t * 0.3).normalize(), len / N); pts.push(q); }
    const c = makePath(pts), uE = knotUs(c, pts.length)[1];
    emit(part, loft({ curve: c, seg: Math.round(14 * det), rad: 2 * Math.round(4 * det + 2), w: (u) => r0 * (u < uE ? 1.05 : 1 - 0.42 * Math.pow((u - uE) / (1 - uE), 1.6)), ht: (u) => r0 * (u < uE ? 1.05 : 1 - 0.42 * Math.pow((u - uE) / (1 - uE), 1.6)), hb: (u) => r0 * (u < uE ? 1.05 : 1 - 0.42 * Math.pow((u - uE) / (1 - uE), 1.6)),
      cap0: 'flat', cap1: { type: 'round', len: 1.2, n: 3 }, bend: 0.3 }), 'teeth', W);
    // the sheath of skin the tusk leaves the face through, with its folds
    const sg = loft({ pts: [E.clone().addScaledVector(d0, -0.03 * U), E.clone().addScaledVector(d0, 0.042 * U)], seg: Math.round(5 * det + 1), rad: 2 * Math.round(5 * det + 2),
      w: (u) => r0 * lerp(1.6, 1.13, u), ht: (u) => r0 * lerp(1.6, 1.13, u), hb: (u) => r0 * lerp(1.6, 1.13, u), bump: (u) => -0.06 * Math.pow(Math.abs(Math.cos(Math.PI * u * 3)), 8), cap0: 'flat', cap1: 'open', bend: 0 });
    emit(part, sg, (u, a, P) => B.paint({ part: 'head', u: 0.9, a, P }), W);
  }
}

/** Tail: hangs close down the rump, its flat tuft of black bristles at the end. */
function eleTail(B, S, L) {
  const T = S.tail;
  if (!T || T.style === 'none' || !(T.len > 0)) return;
  if (T.style !== 'tuft') return tetraTail(B, S, L);
  const rig = B.rig, det = B.det, U = L.U, len = T.len * U, r0 = (T.thk ?? 0.017) * U;
  const y0 = L.yb(0.705), clearZ = (y) => rearZAt(L, y, 0) - r0 - 0.008 * U;
  const pts = [V3(0, y0 + 0.01 * U, rearZAt(L, y0, 0) + 0.02 * U)];
  for (let i = 1; i <= 8; i++) {
    const t = i / 8, y = y0 - t * len * 0.97, yMin = 0.05 * U, low = Math.max(0, yMin - y);
    pts.push(V3(0, Math.max(y, yMin), Math.min(rearZAt(L, y0, 0) - 0.02 * U - 0.035 * U * Math.sin(Math.PI * Math.min(1, t * 1.6)), y > L.yb(0.5) ? clearZ(y) : Infinity) - low));
  }
  const curve = makePath(pts);
  const g = loft({ curve, seg: Math.round(16 * det), rad: 2 * Math.round(4 * det + 2), w: (u) => r0 * (1 - 0.5 * u), ht: (u) => r0 * (1 - 0.5 * u), hb: (u) => r0 * (1 - 0.5 * u),
    cap0: { type: 'round', len: 0.5, n: 2 }, cap1: { type: 'round', len: 0.7, n: 2 }, bend: 0.4 });
  const nb = T.bones ?? 4, names = [], us = [];
  for (let i = 0; i < nb; i++) { names.push('Tail' + (i + 1)); us.push(i / nb); rig.add('Tail' + (i + 1), i ? 'Tail' + i : 'Hips', curve.getPointAt(i / nb), curve.getPointAt(Math.min(1, (i + 1) / nb))); }
  const spec = rig.spec(names, us, 0.4);
  L.tail = { grid: g, curve, bones: names, len, spec };
  emit(B.part('tail', { group: 'tail' }), g, (u, a, P) => B.paint({ part: 'tail', u, a, P }), (u) => u < 0.06 ? rig.W2('Hips', 'Tail1', u / 0.06) : rig.chain(spec, u));
  // the tuft: stiff black bristles in a flat fan either side of the tip
  const t0 = curve.getPointAt(0.84), t1 = curve.getPointAt(1).clone().add(V3(0, -0.07 * U, -0.004 * U));
  if (t1.y < 0.035 * U) { t1.z -= 0.035 * U - t1.y; t1.y = 0.035 * U; }
  const hg = loft({ pts: [t0, t0.clone().lerp(t1, 0.5), t1], seg: Math.round(8 * det), rad: 2 * Math.round(4 * det + 2), up: [0, 0, -1],
    w: (u) => U * (0.008 + 0.03 * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.05))), ht: (u) => U * 0.007 * (1 - 0.5 * u), hb: (u) => U * 0.007 * (1 - 0.5 * u),
    bump: (u, a) => 0.25 * Math.max(0, Math.sin(a * 9 + u * 13)) * u, cap0: { type: 'round', len: 0.5, n: 2 }, cap1: { type: 'round', len: 0.4, n: 2 }, bend: 0.3 });
  emit(B.part('tail', { group: 'tail' }), hg, 'mane', (u, a, P) => rig.near(P, names.slice(-2), 0.06 * U));
}

/** Coat painter: the species' zones, then the folds of an elephant's skin (the fine net of creases between them is drawn
 *  by the coat atlas itself: `crease` in the species preset, see creaseTile). */
function elePainter(S, L) {
  const generic = makePainter(S, L), U = L.U, yFoot = L.yl(0.1), sd = (S.seed ?? 7) | 0, kn = 3 / U;
  // a fold: a narrow wavy band round a part (phase ph), broken where the noise is low
  const fold = (ph, width) => Math.abs(fract(ph) - 0.5) > 0.5 - width;
  return (q) => {
    const zone = generic(q);
    if (zone !== 'body') return zone;
    const { part, P } = q, u = q.u ?? 0, a = q.a ?? 0, n = vnoise(P.x * kn, P.y * kn, P.z * kn, sd + 3);
    switch (part) {
      case 'trunk':
        // ring folds round the trunk, deeper over its top
        return fold(u * (q.rings ?? 40) + 0.7 * (n - 0.5), 0.09) ? (Math.sin(a) > -0.3 ? 'pattern' : 'marking') : zone;
      case 'leg': case 'foot':
        // rings of folds round the legs, the feet a little darker with dust and mud
        if (fold(P.y / (0.028 * U) + 1.6 * (n - 0.5), 0.07) && vnoise(P.x * kn * 3, P.y * kn, P.z * kn * 3, sd + 5) > 0.38) return 'pattern';
        return P.y < yFoot ? 'belly' : zone;
      case 'torso': case 'neck':
        // long upright folds down the flanks behind the shoulder and in front of the thigh
        return Math.abs(Math.sin(a)) < 0.75 && fold(P.z / (0.06 * U) + 2.2 * (n - 0.5), 0.05) && vnoise(P.x * kn, P.y * kn * 0.4, P.z * kn * 2, sd + 7) > 0.56 ? 'marking' : zone;
      default: return zone;
    }
  };
}

/** Builds an elephant (torso, legs, head and trunk, ears, tusks, tail) into B; returns its layout. */
function elephantBuild(B, S, p) {
  const L = eleLayout(S, p);
  eleTorso(B, S, L);
  B.paint = elePainter(S, L);
  eleLimbLayout(B, S, L);
  tetraLimbBones(B, L);
  eleHead(B, S, L);
  if (S.ear && S.ear.style !== 'none') { if (S.ear.style === 'fan') eleEars(B, S, L); else tetraEars(B, S, L); }
  for (const lm of L.limbs) eleLeg(B, S, L, lm);
  // (the limb roots are blended into the body before either is emitted)
  blendLimbRoots(B, S, L);
  for (const lm of L.limbs) lm.emitLeg();
  emit(B.part('body', { group: 'body' }), L.torso, (u, a, P) => B.paint({ part: u > L.uOf.neckRoot ? 'neck' : 'torso', u, a, P }), tetraTorsoSkin(B, L));
  eleTail(B, S, L);
  eleTusks(B, S, L);
  return L;
}

/* ════════════════════════════════════════════════════════════════════════════
 *  MEASURED LAYOUTS  (Digital Diorama revision 10: every quadruped laid out like the elephant)
 *  The parametric layout (tetraLayout) derives a body from a dozen proportions, and however they were tuned the bodies
 *  stayed tubes and the legs pipes: thin necks on horses and wolves, pencil forearms under big cats, a giraffe's body a
 *  pinched wedge, a bear with no hump. Like the elephant (revision 8), each body plan is now laid out from a measured
 *  reference animal (REF, below): the side and top outline of its body and neck at stations, its joints, and each leg's
 *  outline (front and back edges and width) down to the hoof or paw, all in fractions of its shoulder height U, read off
 *  side and front photographs, mounted skeletons and conformation measurements. The layout is handed to the shared
 *  machinery (the torso loft with its surface anatomy, head, ears, horns, mane and tail, hooves and paws, the coat
 *  painter, skinning and every clip), so a species changes its proportions, never its rig:
 *   - heights above the reference's chest floor (`belly`) stretch with the body's depth, heights below it with the legs,
 *     so `legLen` lengthens the legs and keeps the body (as for the elephant);
 *   - body stations spread along the body with `bodyLen`; the neck and each leg keep their own shape, anchored at the
 *     neck root and at the shoulder or hip joint, and the neck lengthens with `neckLen`;
 *   - body stations are [name, z, top, bottom, half-width, side narrowing toward the top, toward the bottom] (a body is
 *     near level, so its outline is read as heights); neck stations [name, z, y, depth above, depth below, half-width],
 *     square to the neck (a neck is steep);
 *   - joints are [x, y, z, half-width, half-depth]; a hoofed leg's toe is placed from its coronet by the hoof's own shape
 *     (hoofDims), a pad foot's at the front edge of its pad;
 *   - leg stations are [height, z, front half-depth, back half-depth, half-width] from the top of the shoulder blade or
 *     the ilium down to the coronet, paw joint or ankle, where the foot takes over (tetraFoot); a leg lies at its joints'
 *     lateral positions by height. `tuck` lists the stations whose surface the body covers (blendLimbRoots).
 *  A species tunes its table with `refLen`, `refDepth`, `refW` (body length, depth and width), `refNeck` and `foreBulk`
 *  / `hindBulk` (leg thickness), or gives a table of its own.
 * ════════════════════════════════════════════════════════════════════════════ */
function refLayout(S, p) {
  const R = S.ref, legK = Math.sqrt(p.legLen || 1), H = S.H, U = H / legK, Rb = R.belly;
  const D = (1 - Rb) * U * (S.refDepth ?? 1), floor = H - D;
  const kLen = (p.bodyLen ?? 1) * (S.refLen ?? 1), kW = S.refW ?? 1, kN = (p.neckLen ?? 1) * (S.refNeck ?? 1);
  // a height of the reference: above its chest floor, between floor and withers; below it, a height on the legs
  const Y = (y) => (y >= Rb ? floor + ((y - Rb) / (1 - Rb)) * D : (y / Rb) * floor);
  const Z = (z) => z * kLen * U;
  const body = R.body.map(([n, z, top, bot, w, sT, sB]) => {
    const t = Y(top), b = Y(bot), c = lerp(b, t, R.cAt ?? 0.45);
    return { n, c: V3(0, c, Z(z)), ht: t - c, hb: c - b, w: w * U * kW, st: [sT ?? 0.95, sB ?? 0.9] };
  });
  // the neck keeps its shape, anchored at its root
  const [, z0, y0] = R.neck[0], root = V3(0, Y(y0), Z(z0));
  const neck = R.neck.map(([n, z, y, up, dn, w, sT, sB]) => ({ n, c: V3(0, root.y + (y - y0) * U * kN, root.z + (z - z0) * U * kN), ht: up * U, hb: dn * U, w: w * U * kW, st: [sT ?? 0.96, sB ?? 0.93] }));
  const nRoot = neck[0], nTop = neck[neck.length - 1], n1 = neck[1];
  const nd = nTop.c.clone().sub(nRoot.c).normalize(), nUp = V3(0, nd.z, -nd.y);
  const Ln = nTop.c.distanceTo(nRoot.c), nT = (n1.ht + n1.hb) / 2;
  const hA = S.headAng * DEG, hd = V3(0, -Math.sin(hA), Math.cos(hA)), hu = V3(0, Math.cos(hA), Math.sin(hA));
  const Lh = (S.headLen / legK) * U, ch = S.headD * Lh, cw = S.headW * Lh;
  // the neck's end no bigger than the back of the skull, so no collar stands round it (see tetraLayout)
  const capH = ch * 1.02, capW = cw * (S.neckCapW ?? 0.86);
  nTop.ht = Math.min(nTop.ht, capH); nTop.hb = Math.min(nTop.hb, capH * 1.05); nTop.w = Math.min(nTop.w, capW);
  const poll = nTop.c.clone().addScaledVector(nUp, nTop.ht * (R.pollUp ?? 0.45));
  const headO = poll.clone().addScaledVector(hd, -0.02 * Lh).addScaledVector(hu, -0.08 * ch);
  const fJ = R.fore.J, zF = Z(R.zF), zB = Z(R.zB), yR = Y(R.croup), keys = [...body, ...neck];
  const L = { ref: R, U, Y, Z, kLen, kW, H, D, Lt: zF - zB, hw: Math.max(...body.map(k => k.w)), zF, zB, yR, Dr: yR - Y(R.rumpBot),
    keys, nd, nUp, Ln, nT, hd, hu, Lh, ch, cw, poll, headO, elbowY: Y(fJ[2][1]), limbs: [] };
  // landmarks of the shoulder sculpted into the chest wall (tetraTorso): the top of the shoulder blade, the point of
  // shoulder and the point of elbow
  const P2z = (j) => [Z(fJ[1][2]) + (j[2] - fJ[1][2]) * U, Y(j[1])];
  L.shoulderMarks = { scT: P2z(fJ[0]), scJ: P2z(fJ[1]), elb: [P2z(fJ[2])[0] - 0.045 * U, P2z(fJ[2])[1] + 0.03 * U] };
  return L;
}

/** A limb's joints from the reference table (left side = +x), in the generic layout's format (see tetraLimbJoints). */
function refLimbJoints(S, L, front, side) {
  const leg = front ? L.ref.fore : L.ref.hind, U = L.U, A = leg.J[leg.anchor ?? (front ? 1 : 0)];
  const bulk = (front ? S.foreBulkR : S.hindBulkR) ?? 1;
  const P = (x, y, z) => V3(side * x * U * L.kW, L.Y(y), L.Z(A[2]) + (z - A[2]) * U);
  const kk = leg.prof ? leg.k ?? 1 : 1;
  const joints = leg.J.map(([x, y, z, w, d]) => ({ p: P(x, y, z), w: w * U * bulk * kk, d: (d ?? w) * U * bulk * kk }));
  // (the foot the species is built with, as tetraLimbs chooses it)
  const last = joints[joints.length - 1], foot = (front ? S.foreFoot : S.hindFoot) || S.foot || leg.foot;
  if (foot === 'hoof' || foot === 'cloven') {
    // the toe meets the ground where the hoof wall sloping down from the coronet reaches it
    const hd = hoofDims(S, last.w * 1.05, last.p.y, leg.wall ?? 52);
    joints.push({ p: V3(last.p.x, 0, last.p.z + hd.toe), w: last.w, d: last.w });
  } else if (foot === 'pad') joints.push({ p: V3(last.p.x, 0, last.p.z + padReach(last)), w: last.w, d: last.w });
  return { st: leg.st, foot, joints, ref: leg, kind: leg.st };
}

/** A leg lofted through its measured outline (see MEASURED LAYOUTS); its foot is added by tetraFoot. */
function refLeg(B, S, L, lm, nm) {
  const det = B.det, rig = B.rig, leg = lm.ref, U = L.U, J = lm.joints, A = leg.J[leg.anchor ?? (lm.front ? 1 : 0)];
  const bulk = (lm.front ? S.foreBulkR : S.hindBulkR) ?? 1;
  // lateral position by height, between the joints
  const xs = J.map(j => [j.p.y, j.p.x]);
  const xAt = (y) => { for (let i = 0; i < xs.length - 1; i++) if (y <= xs[i][0] && y >= xs[i + 1][0]) return lerp(xs[i][1], xs[i + 1][1], (xs[i][0] - y) / Math.max(1e-9, xs[i][0] - xs[i + 1][0])); return y > xs[0][0] ? xs[0][1] : xs[xs.length - 1][1]; };
  // stations given outright ([height, z, front, back, width, x]), or along the joints by a shared profile ([segment, t, front,
  // back, width, z offset, fraction of the joints' lateral position]) scaled by the table's thickness `k`
  const rows = leg.leg ? leg.leg.map(([y, z, f, b, w, x]) => ({ y, z, f, b, w, x }))
    : leg.prof.map(([i, t, f, b, w, dz = 0, xf = 1]) => { const a = leg.J[i], c = leg.J[i + 1], k = leg.k ?? 1; return { y: lerp(a[1], c[1], t), z: lerp(a[2], c[2], t) + dz, f: f * k, b: b * k, w: w * k, xf }; });
  const st = rows.map(({ y, z, f, b, w, x, xf }) => { const yy = L.Y(y); return { c: V3(x !== undefined ? lm.side * x * U * L.kW : xAt(yy) * (xf ?? 1), yy, L.Z(A[2]) + (z - A[2]) * U), f: f * U * bulk, b: b * U * bulk, w: w * U * bulk }; });
  const pts = st.map(s => s.c), curve = makePath(pts), ku = knotUs(curve, pts.length);
  const pF = prof(st.map((s, i) => [ku[i], s.f])), pB = prof(st.map((s, i) => [ku[i], s.b])), pW = prof(st.map((s, i) => [ku[i], s.w]));
  const g = loft({ curve, seg: Math.round((16 + 2.4 * pts.length) * det), rad: 2 * Math.round(6 * det + 2), w: pW, ht: pF, hb: pB, nt: leg.nt ?? 2.1, nb: leg.nb ?? 2.1, up: [0, 0, 1],
    cap0: { type: 'round', len: 0.5, n: 3 }, cap1: { type: 'round', len: 0.45, n: 2 }, bend: 0.5 });
  lm.grid = g; lm.us = ku;
  if (leg.tuck) lm.tuck = [ku[leg.tuck[0]], ku[leg.tuck[1]]];
  const nb = lm.bones.length, sj = J.slice(0, nb + 1).map(j => j.p), h = L.Y(L.ref.hind.J[0][1]);
  const skin = lm.front ? planeSkin(rig, sj, lm.bones, leg.blend ? leg.blend.map(b => b * h) : [0.07 * h, 0.05 * h, 0.03 * h, 0.025 * h], [-0.3, 0.45], 'Chest')
    : planeSkin(rig, sj, lm.bones, leg.blend ? leg.blend.map(b => b * h) : [0.11 * h, 0.05 * h, 0.03 * h], leg.hipsTo ?? [-0.25, 0.5]);
  lm.emitLeg = () => emit(B.part(nm, { group: 'legs' }), g, (u, a, P) => B.paint({ part: 'leg', u, a, P, front: lm.front, side: lm.side }), skin);
  // points of its surface with their skin weights, for poses that keep the legs above the ground (lying down)
  lm.surf = [];
  for (let r = 0; r < g.rows.length; r += (r < g.main[0] || r >= g.main[1] - 1 ? 1 : 2)) for (let j = 0; j < g.R; j += 2) lm.surf.push({ P: g.rows[r][j].clone(), W: skin(g.us[r], (j / g.R) * TAU, g.rows[r][j]) });
  return g;
}

/* ════════════════════════════════════════════════════════════════════════════
 *  COAT PAINTER — maps (part, u, a, P) to a zone key. Patterns are evaluated in
 *  rest space scaled by body height, so stripes / spots scale with the animal.
 * ════════════════════════════════════════════════════════════════════════════ */
function makePainter(S, L) {
  const pat = S.pattern || 'none', seed = (S.seed ?? 7) | 0, H = L.H;
  const cs = clamp(S.countershade ?? 0.4, 0, 1);
  const k = 1 / (H * (S.patternScale ?? 1));
  const bellyLine = lerp(-1.1, -0.1, cs);
  const legPts = (S.points ?? 0) * L.elbowY, socks = (S.socks ?? 0) * L.elbowY;
  const U = L.uOf, eyeR = S.eye * L.Lh;
  const eyeNear = (P, f) => !!L.eyes && L.eyes.some(e => P.distanceTo(e.c) < f * eyeR);
  const capeEdge = (sa, x, y, z) => capeEdgeU(S, U, sa) + (S.maneRag || 0) * (fbm(x * 5, y * 5, z * 5, seed + 37) - 0.5);
  return (q) => {
    const { part, P } = q, u = q.u ?? 0, a = q.a ?? 0, sa = Math.sin(a), ca = Math.cos(a);
    const x = P.x * k, y = P.y * k, z = P.z * k;
    if (part === 'lid') return 'lid';
    const torso = part === 'torso' || part === 'neck';
    const head = part === 'head' || part === 'jaw';
    const limb = part === 'leg' || part === 'foot';
    const s0 = q.s0 ?? 0.6;
    let zone = 'body';
    if (torso && sa < bellyLine) zone = 'belly';
    if (part === 'jaw' && cs >= 0.3 && sa < 0.25) zone = 'belly';
    // (Digital Diorama revision 9: pale lower cheeks bounded by a line that rises from the throat at the back of the head
    // to the whisker pads (`cheekFrom`: where it starts to rise); a level band from below the ear to the muzzle read as a
    // strap along the jaw)
    if (head && S.cheeks && part === 'head' && Math.abs(ca) > 0.2 && u < s0 + 0.2 && sa < lerp(-0.8, 0.02, sstep(S.cheekFrom ?? 0.18, s0 + 0.12, u))) zone = 'belly';
    if (head && S.muzzle && u > s0 + 0.45 * (1 - s0) * 0 + (S.muzzleS ?? 0.62) * (1 - s0) && (!S.muzzleLow || sa < 0.05)) zone = S.muzzle === 'dark' ? 'marking' : 'belly';
    if (head && S.faceZone) zone = S.faceZone;
    if (part === 'ear') {
      if (S.earZone) zone = S.earZone;
      if (S.earTip && u > 1 - S.earTip) zone = 'marking';
    }
    if (limb) {
      if (S.legZone && P.y < L.elbowY * 1.02) zone = S.legZone; // lower legs only: the quarter mass stays coat-coloured
      if (P.y < socks) zone = 'belly';
      if (P.y < legPts) zone = 'marking';
    }
    if (part === 'tail' && S.tailTip && u > 1 - S.tailTip) return S.tailTipZone || 'marking';
    if (part === 'tail' && S.tailUnder && sa < -0.3) zone = 'belly';
    if (torso && S.dorsal && sa > 0.975 && u < U.neckRoot + 0.05) zone = 'marking';
    // (Digital Diorama revision 6: a ragged edge; the hard-edged rectangle made the rump read as a separate block)
    if (torso && S.saddle) {
      const nz = fbm(x * 6, y * 6, z * 6, seed + 21) - 0.5;
      if (sa > lerp(0.9, 0.35, S.saddle) + 0.35 * nz && u > U.haunch * 0.7 + 0.12 * nz && u < U.neckRoot + 0.06 * nz) zone = 'marking';
    }
    if (torso && S.rumpPatch && u < U.haunch + 0.05 && sa > -0.7 && Math.abs(ca) < 0.7) zone = 'belly';
    // (Digital Diorama revision 7: a bison's cape reaches further back over the hump than at the elbow, with a ragged
    // edge (`maneSlant`, `maneRag`), and its long hair runs down the forearms (`maneLegs`: above this fraction of the elbow height))
    if (torso && S.frontMane && u > capeEdge(sa, x, y, z) && sa < (S.maneTop ?? 2)) zone = 'mane';
    if (limb && S.maneLegs && q.front && P.y > S.maneLegs * L.elbowY + 0.15 * L.elbowY * (fbm(x * 7, y * 7, z * 7, seed + 41) - 0.5)) zone = 'mane';
    if (head && S.frontMane && S.maneHead !== false && part === 'head' && u < s0 + 0.1) zone = 'mane';
    // dense spines painted between the modelled quills: dark bands and cream tips streaked along the body
    // (the hind quarters are part of the leg lofts, so the upper legs carry spines too)
    if (S.spinyBack && ((torso && sa > -0.15 && u < U.neckRoot + 0.06) || (part === 'head' && u < 0.35 && sa > -0.15) || (limb && P.y > L.elbowY + 0.4 * L.D))) return vnoise(x * 44, y * 44, z * 14, seed + 5) > 0.52 ? 'marking' : 'pattern';
    if (torso && S.flankStripe && Math.abs(sa + 0.38) < 0.11 && u > U.haunch && u < U.chest) zone = 'marking';
    // ── patterns
    switch (pat) {
      case 'stripes': { // plains zebra (Digital Diorama revision: stripe spacing, rump arcs, leg rings, belly line)
        // Black and white bands of about equal width, ~10 cm apart on the barrel. Upright on the barrel,
        // square to the neck on the neck, sweeping into broad arcs round the thigh on the rump, rings on the
        // legs (finer toward the hooves); a dark line runs along the belly; the muzzle is dark.
        const f = S.stripeFreq ?? 12, warp = fbm(x * 1.6, y * 1.6, z * 1.6, seed) - 0.5;
        let ph;
        if (torso) {
          if (sa < -0.93 && u > U.haunch && u < U.chest + 0.04) return 'pattern';
          if (u > U.neckRoot - 0.02) ph = (P.x * L.nd.x + P.y * L.nd.y + P.z * L.nd.z) * k * f * 0.8 + warp * 0.7;
          else {
            const zr = (P.z - (L.zB + 0.12 * L.Lt)) * k, yr = (P.y - (L.yR - 0.75 * L.Dr)) * k;
            const arc = Math.hypot(zr * 1.05, yr) * f * 0.72, bar = z * f;
            ph = lerp(arc, bar, sstep(U.haunch - 0.02, U.loin + 0.06, u)) + warp * 0.9;
            if (sa < bellyLine && sa > -0.93) return Math.sin(TAU * ph) > 0.55 ? 'pattern' : 'body';
          }
        } else if (limb) {
          if (P.y < 0.07 * L.elbowY) return 'pattern';
          const t = clamp(P.y / L.elbowY, 0, 1.4);
          ph = y * f * lerp(2.1, 1.25, Math.min(1, t)) + warp * 0.35;
        } else if (head) {
          if (u > s0 + 0.5 * (1 - s0)) return 'marking';
          ph = u * 16 + (part === 'jaw' ? 0.35 : 0) + Math.abs(ca) * 1.2 + warp * 0.4;
        } else if (part === 'tail') { if (u > 0.8) return 'mane'; ph = u * 8; }
        else if (part === 'ear') return u > 0.72 ? 'pattern' : zone;
        else if (part === 'mane') ph = (P.x * L.nd.x + P.y * L.nd.y + P.z * L.nd.z) * k * f * 0.8 + warp * 0.7;
        if (ph === undefined) return zone;
        return Math.sin(TAU * ph) > (S.stripeGap ?? -0.04) ? 'pattern' : zone === 'belly' ? 'body' : zone;
      }
      case 'tiger': { // Digital Diorama revision: narrow, tapering, broken stripes; white cheeks and brows
        // Tigers carry 100+ narrow dark stripes: thick along the spine, tapering to points down the flank,
        // often forked or broken. White belly, inner legs, cheeks and a spot over each eye; ringed tail, black tip.
        if (zone === 'marking') return zone;
        const f = S.stripeFreq ?? 9.5;
        const n1 = fbm(x * 2.3, y * 2.3, z * 2.3, seed) - 0.5, n2 = fbm(x * 7, y * 7, z * 7, seed + 3);
        if (torso) {
          if (sa < -0.62) return zone;
          const along = u > U.neckRoot - 0.02 ? (P.x * L.nd.x + P.y * L.nd.y + P.z * L.nd.z) * k : z;
          // stripes waver down the flank, vary in spacing, split into pairs and break into pieces
          const n3 = fbm(x * 3.5 + 7, y * 3.5, z * 3.5, seed + 11);
          const ph = along * f * (0.85 + 0.3 * n3) + n1 * 2.3 + 0.3 * Math.sin(TAU * (y * 1.2 + n1)) - sa * 0.2;
          const w = lerp(0.06, 0.3, sstep(-0.6, 0.95, sa)) * (0.45 + 1.1 * n2);
          const c = 0.5 + 0.5 * Math.cos(TAU * ph);
          const split = n3 > 0.55 && c > 1 - w * 0.35;
          if (c > 1 - w && !split && n2 > 0.27 && n3 > 0.2) return 'pattern';
          return zone;
        }
        if (limb) {
          if (P.y < 0.3 * L.elbowY) return zone;
          if (sa < -0.2 && Math.abs(ca) < 0.6) return 'belly';
          const ph = y * f * 1.25 + n1 * 1.2 + x * 0.6;
          return 0.5 + 0.5 * Math.cos(TAU * ph) > 1 - 0.22 * (0.6 + n2) && n2 > 0.32 ? 'pattern' : zone;
        }
        if (part === 'head') {
          if (eyeNear(P, 2.2) && sa > 0.1) return 'belly';
          if (u > s0 - 0.05 && sa < 0.25) return 'belly';
          if (u < s0 && Math.abs(ca) > 0.4 && sa > -0.5 && Math.cos(TAU * (u * 10 + n1)) > 0.55) return 'pattern';
          if (u < s0 * 0.7 && sa > 0.55 && Math.cos(TAU * (Math.abs(ca) * 4 + n1)) > 0.5) return 'pattern';
          return zone;
        }
        if (part === 'tail') return u > 0.9 || Math.cos(TAU * u * 7) > 0.35 ? 'pattern' : zone;
        if (part === 'ear') return sa > 0 && u > 0.35 ? 'pattern' : zone;
        return zone;
      }
      case 'spots': case 'hyena': { // Digital Diorama revision: dense small solid spots (cheetah) / blotches (hyena)
        if (zone === 'marking' || (zone === 'belly' && sa < -0.75)) return zone;
        const hy = pat === 'hyena';
        const f = (S.spotFreq ?? (hy ? 10 : 19)) * (head ? 1.7 : 1), th = S.spotSize ?? (hy ? 0.3 : 0.29);
        if (torso || limb || part === 'tail' || (head && u < s0 + 0.1)) {
          if (part === 'tail' && !hy && u > 0.62) return u > 0.93 ? 'belly' : Math.cos(TAU * u * 10) > 0.25 ? 'pattern' : zone;
          if (limb && P.y < (hy ? 0.12 : 0.2) * L.elbowY) return zone;
          const sc = limb ? lerp(1.45, 1, clamp(P.y / L.elbowY, 0, 1)) : 1;
          const wx = hy ? (fbm(x * 4, y * 4, z * 4, seed + 9) - 0.5) * 0.5 : 0;
          const [f1] = worley((x + wx) * f * sc, y * f * sc, (z - wx) * f * sc, seed);
          if (f1 < th * (hy && torso && u > U.neckRoot ? 0.8 : 1)) return 'pattern';
        }
        if (head && S.tearMark && part === 'head' && Math.abs(ca) > 0.55 && Math.abs(ca) < 0.85 && u > L.headS.sEye && u < s0 + 0.35 * (1 - s0) && sa < 0.2) return 'marking';
        return zone;
      }
      case 'rosettes': { // Digital Diorama revision: small rosettes (broken rings round a darker centre)
        // Body: rosettes ~6 cm across; head, legs, belly and tail base: solid spots; the tail ends in rings.
        if (zone === 'belly' && sa < -0.82) return zone;
        const f = S.spotFreq ?? 11.5, n = fbm(x * 9, y * 9, z * 9, seed + 1);
        if (torso && sa > -0.55) {
          const [f1] = worley(x * f, y * f, z * f, seed);
          if (f1 > 0.22 && f1 < 0.36 && n > 0.36) return 'pattern';
          if (f1 < 0.2) return 'marking';
          return zone;
        }
        if (part === 'tail' && u > 0.7) return Math.cos(TAU * u * 9) > 0.3 || u > 0.95 ? 'pattern' : zone;
        if (torso || limb || (head && u < s0 + 0.1) || part === 'tail') {
          if (limb && P.y < 0.12 * L.elbowY) return zone;
          const g = f * (head ? 2.4 : 1.6), [g1] = worley(x * g, y * g, z * g, seed + 2);
          if (g1 < 0.27) return 'pattern';
        }
        return zone;
      }
      case 'giraffe': { // Digital Diorama revision: fine reticulated network of pale lines between polygonal patches
        if (limb && P.y < 0.5 * L.elbowY) return 'belly';
        if (head && u > s0 + 0.1 * (1 - s0)) return 'belly';
        if (torso || limb || head) {
          const neck = torso && u > U.neckRoot;
          const f = (head ? 24 : neck ? 15 : 11) * (S.patchFreq ?? 1) * (limb ? 1.25 : 1);
          const w = (fbm(x * 2.5, y * 2.5, z * 2.5, seed + 5) - 0.5) * 0.4;
          const [f1, f2] = worley(x * f + w, y * f * (neck ? 0.75 : 1), z * f - w, seed);
          return f2 - f1 < (S.netWidth ?? 0.16) * (limb ? 1.3 : 1) ? 'belly' : 'pattern';
        }
        return zone;
      }
      case 'patches': { // Digital Diorama revision: Holstein — large ragged black patches, white legs, belly and blaze
        if (limb && P.y < 0.55 * L.elbowY) return 'body';
        if (torso && sa < -0.7) return 'body';
        if (part === 'tail') return u > 0.6 ? 'body' : zone;
        if (head && part === 'head') return u > s0 * 0.55 && Math.abs(ca) < 0.28 && sa > -0.2 ? 'body' : u > s0 + 0.35 * (1 - s0) ? zone : 'pattern';
        const w = (fbm(x * 3.5, y * 3.5, z * 3.5, seed + 4) - 0.5) * 0.55;
        if (fbm(x * 1.5 + w, y * 1.5, z * 1.5 - w, seed, 4) > 0.5) return 'pattern';
        return zone;
      }
      case 'chipmunk': { // Digital Diorama revision: five dark back stripes with pale bands, a dark eye stripe framed in pale
        if (torso && u > U.haunch - 0.02 && u < U.chest + 0.02) {
          const th = Math.abs(Math.atan2(ca, sa)), fade = sstep(U.haunch - 0.02, U.haunch + 0.06, u) * (1 - sstep(U.chest - 0.06, U.chest + 0.02, u));
          if (fade > 0.3) {
            if (th < 0.09) return 'marking';
            if (th > 0.42 && th < 0.52) return 'marking';
            if (th > 0.52 && th < 0.66) return 'belly';
            if (th > 0.66 && th < 0.76) return 'marking';
          }
          return zone;
        }
        if (part === 'head' && L.eyes && Math.abs(ca) > 0.35 && u < s0 + 0.25) {
          const e = L.eyes.reduce((m, ee) => (P.distanceTo(ee.c) < P.distanceTo(m.c) ? ee : m));
          const dy = (P.y - e.c.y) / eyeR;
          if (Math.abs(dy) < 0.42 && u < s0 + 0.1) return 'marking';
          if (Math.abs(dy) > 0.6 && Math.abs(dy) < 1.15) return 'belly';
        }
        return zone;
      }
      case 'panda': {
        if (limb) return 'pattern';
        if (part === 'ear') return 'pattern';
        if (torso) {
          // the black saddle runs over the shoulders and joins the forelegs
          // (Digital Diorama revision 10: centred over the shoulder blade of a measured layout)
          const fz = (P.z - (L.shoulderMarks ? lerp(L.shoulderMarks.scT[0], L.shoulderMarks.scJ[0], 0.4) : L.zF - 0.3 * L.Lt)) / (0.25 * L.Lt);
          if (Math.abs(fz) < 0.55 - Math.max(0, sa) * 0.12 && u < U.neckRoot + 0.06) return 'pattern';
        }
        // eye patches: drooping teardrops, larger than the eye
        if (head && part === 'head' && L.eyes && L.eyes.some(e => { const dx = P.x - e.c.x, dy = P.y - e.c.y + eyeR * 0.9, dz = P.z - e.c.z; return Math.hypot(dx * 0.85, dy * 0.75, dz) < 3.1 * eyeR; })) return 'pattern';
        return zone === 'belly' ? 'body' : zone;
      }
      case 'raccoon': {
        if (head && part === 'head' && eyeNear(P, 2.9) && u < s0 + 0.3 * (1 - s0)) return 'pattern';
        if (head && part === 'head' && u > s0 + 0.3 * (1 - s0)) return 'belly';
        if (part === 'tail') return u > 0.94 || Math.sin(TAU * u * 5.5) > 0 ? 'pattern' : 'body';
        if (limb && P.y < 0.5 * L.elbowY) return 'pattern';
        return zone;
      }
      case 'badger': {
        if (head) { const ac = Math.abs(ca); return part === 'head' && sa > -0.35 && ac > 0.14 && ac < 0.6 ? 'pattern' : 'belly'; }
        if (part === 'ear') return 'belly';
        if (limb) return 'pattern';
        return zone;
      }
      case 'anteater': {
        if (torso && Math.abs((P.z - L.zF + 0.25 * L.Lt) / L.Lt + (P.y - L.H * 0.6) / L.Lt * 0.9) < 0.05 && sa > -0.6) return 'pattern';
        if (torso && Math.abs((P.z - L.zF + 0.25 * L.Lt) / L.Lt + (P.y - L.H * 0.6) / L.Lt * 0.9) < 0.075 && sa > -0.6) return 'belly';
        // pale forelegs with a black band at the wrist
        if (limb && q.front) return P.y < 0.28 * L.elbowY && P.y > 0.12 * L.elbowY ? 'pattern' : P.y < L.elbowY * 1.05 ? 'belly' : zone;
        return zone;
      }
      case 'tabby': { // Digital Diorama revision: mackerel tabby — dorsal line, narrow ribs of stripes, ringed legs and tail, forehead M
        if (zone === 'belly') return zone;
        const n = fbm(x * 3, y * 3, z * 3, seed) - 0.5;
        if (torso) {
          if (sa > 0.93) return 'pattern';
          const along = u > U.neckRoot - 0.02 ? (P.x * L.nd.x + P.y * L.nd.y + P.z * L.nd.z) * k : z;
          return sa > -0.5 && Math.cos(TAU * (along * (S.stripeFreq ?? 13) + n * 1.2 - sa * 0.3)) > 0.45 ? 'pattern' : zone;
        }
        if (part === 'tail') return u > 0.92 || Math.cos(TAU * u * 9) > 0.3 ? 'pattern' : zone;
        if (limb) return P.y > 0.2 * L.elbowY && Math.cos(TAU * (y * 14 + n)) > 0.5 && !(sa < -0.2 && Math.abs(ca) < 0.6) ? 'pattern' : zone;
        if (part === 'head') {
          if (u < s0 && sa > 0.5 && Math.cos(TAU * (Math.abs(ca) * 3.2 + u * 2)) > 0.55) return 'pattern';
          if (u < s0 && Math.abs(ca) > 0.6 && sa > -0.4 && Math.cos(TAU * (u * 7 + sa)) > 0.6) return 'pattern';
        }
        return zone;
      }
      default: return zone;
    }
  };
}

/* ════════════════════════════════════════════════════════════════════════════
 *  ZONES, PALETTES & SPECIES
 * ════════════════════════════════════════════════════════════════════════════ */
const BASE = {
  body: '#8a6a4a', belly: '#d9c7a8', marking: '#3a2a1e', pattern: '#22190f', mane: '#3b2a1f',
  skin: '#c98d82', lid: '#2a1d17', hoof: '#3a3230', horn: '#d8c9a6', eye: '#5a3a1c',
  pupil: '#0c0a09', nose: '#2b2321', mouth: '#6e3434', teeth: '#efe8d8', web: '#4a3c32',
};
const ZONE_KEYS = Object.keys(BASE);
const ZONE_ROLES = { body: 'body', belly: 'body', marking: 'body', pattern: 'body', mane: 'body', skin: 'soft', lid: 'soft', hoof: 'keratin', horn: 'keratin', eye: 'eye', pupil: 'pupil', nose: 'soft', mouth: 'soft', teeth: 'keratin', web: 'soft' };
const ZONE_LABELS = { body: 'Coat', belly: 'Belly / light coat', marking: 'Markings', pattern: 'Pattern', mane: 'Mane / hair', skin: 'Inner ear / skin', lid: 'Eyelids', hoof: 'Hooves / claws', horn: 'Horns / antlers', eye: 'Iris', pupil: 'Pupil', nose: 'Nose', mouth: 'Mouth', teeth: 'Teeth / tusks', web: 'Webbing' };

function mergeDeep(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof v !== 'function' && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? mergeDeep(a[k], v) : v;
  }
  return out;
}
const pal = (o) => ({ ...BASE, ...o });

/** Defaults shared by every tetrapod (overridden per family, then per species). */
const DEF = {
  H: 1, len: 1, depth: 0.45, width: 0.8, rump: 1, rumpDepth: 1, hipW: 1, chestW: 1, sag: 0, tuck: 0.2, belly: 0.1, withers: 0,
  neckAng: 40, neckLen: 0.35, neckThk: 0.62, neckW: 0.8, neckArch: 0.05,
  headAng: 30, headLen: 0.3, headD: 0.3, headW: 0.26, snout: 0.45, snoutW: 0.55, snoutD: 0.55, stop: 0.3, dome: 1, cheek: 1.05, jowl: 1, brow: 0.05,
  eye: 0.05, eyeYaw: 52, eyeEl: 16, nose: 'pad', pupil: 'round', jaw: 0.5,
  ear: { style: 'pointed', len: 0.35, w: 0.5, s: 0.16, a: 0.62, spread: 22, tilt: 12, turn: 22, cup: 0.45 },
  stance: 'digitigrade', legThk: 1, tail: { style: 'thin', len: 0.5, thk: 0.03, set: -30 },
  pattern: 'none', countershade: 0.4, palette: pal({}),
};
const UNGULATE = { stance: 'ungulate', foreBulk: 1.15, hindBulk: 1.05, marks: { hooks: 0.045, fossa: 0.04, ribs: 0.025, girth: 0.035, breast: 0.06, withers: 0.04 }, keel: 0.42, waist: 0.04, croupFlat: 0.97, backFlat: 0.98, chestNarrow: 0.74, neckRootW: 0.62, withersTop: 0.55, quarters: 1.0, quartersBox: 2.2, nose: 'muzzle', pupil: 'bar', eyeYaw: 64, eyeEl: 14, foot: 'cloven', ear: { style: 'pointed', s: 0.08, a: 0.62, spread: 40, tilt: 4, turn: 30 },
  // (Digital Diorama revision 9: a narrow throatlatch behind round jowls, a broad flat forehead over a narrower face, fuller lips)
  throat: 0.35, browW: 1.06, bridgeW: 0.85, cheekLow: 1.04, lipW: 1.08, lipDepth: 0.3 };
const CANID = { stance: 'digitigrade', hindShape: { thighF: 0.14, breech: 0.075, hams: 0.015, kneeW: 0.055, patella: 0.04 }, foreBulk: 1.15, hindBulk: 1.05, marks: { hooks: 0.012, fossa: 0.025, ribs: 0.035, girth: 0.04, breast: 0.08, withers: 0.025, scapula: 0.025 }, keel: 0.46, waist: 0.17, croupFlat: 0.86, backFlat: 0.9, chestNarrow: 0.8, neckRootW: 0.66, withersTop: 0.72, quarters: 0.96, quartersBox: 2.1, nose: 'pad', whiskerPads: false, claws: 0.9, toes: 4, fang: 0.07, stop: 0.75, noseCap: 0.4, eyeYaw: 34, eyeEl: 22, dome: 1.15,
  // (Digital Diorama revision 9: a domed forehead over a real stop, a narrow nose bridge between broad lips and cheeks, eyes set
  // high and forward, dark lips)
  bridgeW: 0.8, cheekLow: 1.1, lipW: 1.05, lipZone: 'lid', lipInset: 0.1, eyeReach: 0.12,
  ear: { style: 'pointed', len: 0.36, w: 0.62, s: 0.2, a: 0.6, spread: 18, tilt: 10, turn: 18, cup: 0.5 }, tail: { style: 'bushy', len: 0.55, thk: 0.045, set: -55, curl: 15, bush: 0.7 } };
const FELID = { stance: 'digitigrade', arch: 0.06, noseCap: 0.3, muzzleN: 2.5, occiput: 0.85, foreBulk: 1.45, hindBulk: 1.12, marks: { hooks: 0.01, fossa: 0.02, ribs: 0.02, girth: 0.035, breast: 0.05, scapula: 0.07 }, keel: 0.38, waist: 0.13, croupFlat: 0.88, backFlat: 0.9, chestNarrow: 0.76, neckRootW: 0.64, withersTop: 0.6, quarters: 0.98, quartersBox: 2.1, nose: 'feline', whiskerPads: true, pupil: 'slit', claws: 0.6, toes: 4, fang: 0.06, stop: 0.55, dome: 1.16, eyeYaw: 30, eyeEl: 16, snout: 0.3, snoutW: 0.56, snoutD: 0.62, cheek: 1.18,
  // (Digital Diorama revision 9: a round face, narrow over the crown and broad across the cheeks, eyes kept at the stop,
  // whisker pads overhanging a small recessed chin, dark lips)
  crownW: 0.86, browW: 0.9, bridgeW: 0.8, cheekLow: 1.1, eyeReach: 0.06, lipZone: 'lid', lipInset: 0.22, chinN: 2, jaw: 0.35, jawEnd: 0.92, cheekFrom: 0.3,
  ear: { style: 'feline', len: 0.26, w: 0.85, s: 0.26, a: 0.66, spread: 26, tilt: 6, turn: 12, cup: 0.55 }, tail: { style: 'thin', len: 0.85, thk: 0.035, set: -40, curl: 30, tipCurl: 12 } };
const URSID = { stance: 'plantigrade', foreBulk: 1.35, hindBulk: 1.2, marks: { girth: 0.025, breast: 0.04, scapula: 0.03 }, keel: 0.2, waist: 0.03, croupFlat: 0.92, backFlat: 0.94, chestNarrow: 0.92, neckRootW: 0.76, withersTop: 0.88, quarters: 0.98, quartersBox: 2.1, nose: 'pad', claws: 1.1, toes: 5, footLen: 1.1, dome: 1.1, stop: 0.35, eyeYaw: 32, eye: 0.04, neckThk: 0.85, lipZone: 'lid', lipInset: 0.1,
  ear: { style: 'round', len: 0.2, w: 0.95, s: 0.24, a: 0.78, spread: 28, tilt: 4, turn: 12, cup: 0.5 }, tail: { style: 'thin', len: 0.1, thk: 0.06, set: -40 } };
const RODENT = { stance: 'digitigrade', keel: 0.14, waist: 0.02, nose: 'pad', incisors: 0.09, whiskerPads: true, claws: 0.6, toes: 4, eye: 0.11, eyeYaw: 70, stop: 0.2, crouch: 0.8, hockH: 0.13, footLen: 1.6, thighW: 0.5, thighD: 0.52 };

/* ════════════════════════════════════════════════════════════════════════════
 *  REFERENCE ANIMALS  (Digital Diorama revision 10; see MEASURED LAYOUTS)
 *  Fractions of the reference's shoulder height U; z from the middle of the body, + forward; y up from the ground.
 *  body: [name, z, top, bottom, half-width, side narrowing toward the top, toward the bottom]
 *  neck: [name, z, y, depth above, depth below (square to the neck), half-width]
 *  J:    [x, y, z, half-width, half-depth]; leg: [height, z, front half-depth, back half-depth, half-width]
 * ════════════════════════════════════════════════════════════════════════════ */
/** Hoofed legs: the horse's measured outlines along its joints ([segment, t, front, back, half-width, z offset, share of the
 *  joints' lateral position]; segments: shoulder blade, upper arm, forearm, cannon, pastern / thigh, gaskin, cannon,
 *  pastern), scaled by each table's thickness `k`. */
const LEG = {
  foreHoof: [
    [0, 0.08, 0.05, 0.06, 0.04, 0, 0.78], [0, 0.53, 0.08, 0.1, 0.06, -0.02, 0.84], [1, 0.04, 0.12, 0.12, 0.075, -0.07, 0.78], [1, 0.6, 0.105, 0.105, 0.08, -0.04, 0.85],
    [2, 0.02, 0.065, 0.065, 0.07, 0.005, 0.92], [2, 0.25, 0.05, 0.048, 0.045], [2, 0.55, 0.042, 0.04, 0.04], [2, 0.85, 0.032, 0.03, 0.033],
    [3, 0, 0.036, 0.036, 0.036], [3, 0.24, 0.026, 0.03, 0.028], [3, 0.55, 0.023, 0.023, 0.018, -0.009], [3, 0.83, 0.022, 0.025, 0.018, -0.009],
    [4, 0, 0.028, 0.034, 0.025, -0.008], [4, 0.38, 0.02, 0.021, 0.02, -0.006], [4, 0.7, 0.02, 0.02, 0.021, -0.003], [4, 1, 0.024, 0.024, 0.026],
  ],
  hindHoof: [
    [0, -0.62, 0.08, 0.08, 0.06, 0.12, 0.6], [0, 0, 0.15, 0.15, 0.1, 0.01, 0.75], [0, 0.51, 0.165, 0.165, 0.1, -0.05, 0.75], [1, 0, 0.155, 0.155, 0.085, -0.115, 0.78],
    [1, 0.32, 0.115, 0.115, 0.062, -0.063, 0.88], [1, 0.61, 0.085, 0.085, 0.05, -0.042], [1, 0.85, 0.06, 0.065, 0.042, -0.024], [2, 0.02, 0.048, 0.055, 0.04, -0.015],
    [2, 0.22, 0.03, 0.04, 0.03, -0.005], [2, 0.5, 0.022, 0.03, 0.02, -0.005], [2, 0.81, 0.022, 0.029, 0.019, -0.003],
    [3, 0, 0.028, 0.036, 0.026], [3, 0.4, 0.02, 0.021, 0.02], [3, 0.71, 0.02, 0.02, 0.021, -0.003], [3, 1, 0.024, 0.024, 0.026],
  ],
};
/** Digitigrade legs from a lion's (segments: shoulder blade, upper arm, forearm, metacarpus / thigh, shin, metatarsus) and
 *  plantigrade legs from a brown bear's (down to the wrist / ankle, where the sole begins). */
Object.assign(LEG, {
  forePaw: [
    [0, 0.1, 0.05, 0.06, 0.04, 0, 0.78], [0, 0.55, 0.08, 0.1, 0.06, -0.02, 0.84], [1, 0.05, 0.11, 0.12, 0.075, -0.06, 0.8], [1, 0.6, 0.1, 0.11, 0.08, -0.04, 0.86],
    [2, 0.03, 0.07, 0.075, 0.07, 0, 0.92], [2, 0.2, 0.065, 0.06, 0.058], [2, 0.45, 0.055, 0.05, 0.05], [2, 0.75, 0.045, 0.04, 0.043], [2, 0.95, 0.04, 0.036, 0.04],
    [3, 0, 0.038, 0.035, 0.042], [3, 0.5, 0.034, 0.03, 0.045], [3, 1, 0.032, 0.028, 0.048],
  ],
  hindPaw: [
    [0, -0.6, 0.07, 0.07, 0.055, 0.1, 0.6], [0, 0, 0.14, 0.14, 0.095, 0, 0.75], [0, 0.5, 0.15, 0.15, 0.095, -0.05, 0.76], [1, 0, 0.13, 0.14, 0.08, -0.1, 0.8],
    [1, 0.3, 0.09, 0.1, 0.06, -0.06, 0.9], [1, 0.6, 0.065, 0.07, 0.048, -0.035], [1, 0.85, 0.045, 0.05, 0.04, -0.02],
    [2, 0, 0.04, 0.05, 0.036, -0.01], [2, 0.4, 0.03, 0.032, 0.032], [2, 0.8, 0.028, 0.028, 0.034], [2, 1, 0.028, 0.026, 0.038],
  ],
  foreSole: [
    [0, 0.1, 0.06, 0.07, 0.05, 0, 0.78], [0, 0.55, 0.09, 0.11, 0.07, -0.02, 0.84], [1, 0.05, 0.12, 0.13, 0.085, -0.06, 0.8], [1, 0.6, 0.11, 0.12, 0.09, -0.04, 0.86],
    [2, 0.03, 0.085, 0.09, 0.085, 0, 0.92], [2, 0.25, 0.08, 0.075, 0.075], [2, 0.5, 0.07, 0.065, 0.068], [2, 0.75, 0.062, 0.058, 0.062], [2, 1, 0.058, 0.055, 0.06],
  ],
  hindSole: [
    [0, -0.6, 0.08, 0.08, 0.06, 0.1, 0.6], [0, 0, 0.15, 0.15, 0.11, 0, 0.75], [0, 0.5, 0.15, 0.15, 0.11, -0.04, 0.78], [1, 0, 0.12, 0.13, 0.1, -0.06, 0.82],
    [1, 0.35, 0.09, 0.1, 0.085, -0.03], [1, 0.7, 0.07, 0.075, 0.07, -0.015], [1, 1, 0.06, 0.065, 0.062],
  ],
});
const pawFore = (J, k = 1, o = {}) => ({ st: 'digitigrade', foot: 'paw', tuck: [3, 4], J, prof: LEG.forePaw, k, ...o });
const pawHind = (J, k = 1, o = {}) => ({ st: 'digitigrade', foot: 'paw', tuck: [2, 3], J, prof: LEG.hindPaw, k, ...o });
const soleFore = (J, k = 1, o = {}) => ({ st: 'plantigrade', foot: 'sole', tuck: [3, 4], J, prof: LEG.foreSole, k, ...o });
const soleHind = (J, k = 1, o = {}) => ({ st: 'plantigrade', foot: 'sole', tuck: [2, 3], J, prof: LEG.hindSole, k, ...o });
const hoofFore = (J, k = 1, o = {}) => ({ st: 'ungulate', foot: 'hoof', wall: 52, tuck: [3, 4], J, prof: LEG.foreHoof, k, ...o });
const hoofHind = (J, k = 1, o = {}) => ({ st: 'ungulate', foot: 'hoof', wall: 54, tuck: [2, 3], J, prof: LEG.hindHoof, k, ...o });

const REF = {
  // A 1.60 m riding horse (conformation measurements): body 1.03 U from the point of shoulder to the point of buttock,
  // the chest 0.48 U deep (the girth at 0.52), the back dipping 7 cm behind high withers and rising to a rounded croup
  // level with them; a deep, muscular neck rising at about 30-45° (0.36 U deep where it leaves the chest, 0.15 at the
  // throatlatch) with the poll 1.17 U up; elbow at the girth line, knee 0.3, fetlock 0.155, coronet 0.06, pasterns
  // sloping at 55°; hip joint 0.78, stifle 0.585 well forward in the flank, hock 0.38 under the point of buttock. The
  // forearm is 0.11 U deep below the elbow, the knee flat and broad, the cannon a thin bone with the tendons behind it;
  // the gaskin 0.17 U deep, the hock 0.1 with its point standing out behind. Hooves about 0.17 U apart.
  equid: {
    belly: 0.515, len: 1.03, zF: 0.52, zB: -0.51, croup: 0.995, rumpBot: 0.62, fillet: 0.045,
    body: [
      ['rump', -0.42, 0.955, 0.62, 0.15, 0.86, 0.84],
      ['haunch', -0.3, 0.995, 0.585, 0.18, 0.94, 0.88],
      ['flank', -0.17, 0.975, 0.565, 0.182, 0.95, 0.8],
      ['loin', -0.04, 0.958, 0.515, 0.19, 0.95, 0.86],
      ['barrel', 0.11, 0.955, 0.5, 0.198, 0.9, 0.86],
      ['chest', 0.27, 1.0, 0.515, 0.172, 0.76, 0.72],
    ],
    neck: [
      ['neckRoot', 0.445, 0.818, 0.18, 0.18, 0.13, 0.88, 0.8],
      ['neck1', 0.55, 0.9, 0.135, 0.118, 0.098, 0.92, 0.88],
      ['neck2', 0.64, 0.99, 0.105, 0.09, 0.078],
      ['neckTop', 0.72, 1.07, 0.08, 0.068, 0.064],
    ],
    fore: hoofFore([[0.06, 0.95, 0.27, 0.03, 0.05], [0.115, 0.705, 0.475, 0.055, 0.07], [0.12, 0.565, 0.34, 0.058, 0.07], [0.097, 0.3, 0.355, 0.035], [0.09, 0.155, 0.36, 0.025, 0.03], [0.09, 0.062, 0.415, 0.027]]),
    hind: hoofHind([[0.1, 0.78, -0.36, 0.09, 0.12], [0.125, 0.585, -0.215, 0.055, 0.07], [0.098, 0.38, -0.425, 0.04, 0.05], [0.092, 0.158, -0.425, 0.025, 0.03], [0.092, 0.062, -0.365, 0.027]]),
  },
  // A 1.42 m Holstein cow: body 1.16 U long and 0.24 U wide each side over the rumen, a straight topline from the withers
  // to the hip bones (level with them), the rump sloping a little to the pin bones; the belly hanging to 0.415, the
  // brisket below the elbows; a short thick neck carried forward at 25° with a dewlap below; short legs (knee 0.26,
  // fetlock 0.115) a little thicker than a horse's, upright pasterns and broad cloven hooves.
  bovine: {
    belly: 0.415, len: 1.16, zF: 0.58, zB: -0.58, croup: 1.0, rumpBot: 0.58, fillet: 0.045,
    body: [
      ['rump', -0.5, 0.96, 0.6, 0.125, 0.8, 0.8],
      ['haunch', -0.36, 1.0, 0.54, 0.19, 0.94, 0.86],
      ['flank', -0.2, 0.99, 0.47, 0.215, 0.95, 0.82],
      ['loin', -0.03, 0.98, 0.42, 0.24, 0.95, 0.9],
      ['barrel', 0.14, 0.98, 0.415, 0.235, 0.93, 0.88],
      ['chest', 0.3, 1.0, 0.44, 0.18, 0.72, 0.7],
    ],
    neck: [
      ['neckRoot', 0.5, 0.72, 0.21, 0.22, 0.15, 0.9, 0.8],
      ['neck1', 0.62, 0.765, 0.16, 0.18, 0.12],
      ['neck2', 0.72, 0.805, 0.13, 0.14, 0.1],
      ['neckTop', 0.8, 0.845, 0.1, 0.1, 0.085],
    ],
    fore: hoofFore([[0.06, 0.95, 0.3, 0.03, 0.05], [0.13, 0.65, 0.5, 0.06, 0.07], [0.13, 0.47, 0.38, 0.06, 0.07], [0.1, 0.26, 0.39, 0.035], [0.095, 0.115, 0.395, 0.025, 0.03], [0.095, 0.05, 0.43, 0.027]], 1.12),
    hind: hoofHind([[0.11, 0.72, -0.36, 0.09, 0.12], [0.135, 0.5, -0.24, 0.055, 0.07], [0.1, 0.33, -0.44, 0.04, 0.05], [0.095, 0.115, -0.42, 0.025, 0.03], [0.095, 0.05, -0.385, 0.027]], 1.12),
  },
  // A 1.8 m bison bull (at the hump): the hump over the shoulders, the back falling to hips at 0.8 U and a small rump; a
  // vast deep chest (floor 0.42); the massive head carried low on a short, deep neck that runs down and forward from the
  // hump; heavy forelegs, lighter hind legs.
  bison: {
    belly: 0.42, len: 1.12, zF: 0.56, zB: -0.56, croup: 0.8, rumpBot: 0.5, fillet: 0.045,
    body: [
      ['rump', -0.48, 0.74, 0.52, 0.11, 0.84, 0.8],
      ['haunch', -0.35, 0.8, 0.48, 0.155, 0.92, 0.86],
      ['flank', -0.2, 0.83, 0.47, 0.18, 0.93, 0.84],
      ['loin', -0.04, 0.875, 0.45, 0.2, 0.93, 0.88],
      ['barrel', 0.12, 0.95, 0.43, 0.215, 0.92, 0.86],
      ['chest', 0.28, 1.0, 0.42, 0.205, 0.9, 0.72],
    ],
    neck: [
      ['neckRoot', 0.46, 0.7, 0.25, 0.22, 0.17, 0.94, 0.82],
      ['neck1', 0.57, 0.64, 0.2, 0.17, 0.15],
      ['neck2', 0.65, 0.6, 0.165, 0.145, 0.13],
      ['neckTop', 0.71, 0.575, 0.135, 0.12, 0.115],
    ],
    fore: hoofFore([[0.06, 0.93, 0.28, 0.03, 0.05], [0.13, 0.62, 0.48, 0.06, 0.07], [0.135, 0.44, 0.36, 0.065, 0.075], [0.1, 0.23, 0.37, 0.038], [0.095, 0.1, 0.375, 0.026, 0.03], [0.095, 0.045, 0.41, 0.028]], 1.25),
    hind: hoofHind([[0.1, 0.62, -0.36, 0.09, 0.11], [0.12, 0.44, -0.25, 0.055, 0.065], [0.095, 0.29, -0.43, 0.04, 0.05], [0.09, 0.1, -0.41, 0.025, 0.03], [0.09, 0.045, -0.38, 0.027]], 1.1),
  },
  // A 0.95 m white-tailed deer: a short, deep-chested body (floor 0.54) tucked up at the flank, withers and croup level, a
  // slender neck rising at 50°; long slender legs (knee 0.3, fetlock 0.13) with small hooves.
  cervid: {
    belly: 0.54, len: 1.04, zF: 0.52, zB: -0.52, croup: 1.0, rumpBot: 0.64, fillet: 0.04,
    body: [
      ['rump', -0.44, 0.955, 0.66, 0.115, 0.84, 0.82],
      ['haunch', -0.31, 1.0, 0.6, 0.145, 0.94, 0.86],
      ['flank', -0.17, 0.975, 0.6, 0.15, 0.95, 0.78],
      ['loin', -0.03, 0.96, 0.56, 0.16, 0.95, 0.84],
      ['barrel', 0.12, 0.96, 0.54, 0.165, 0.9, 0.82],
      ['chest', 0.28, 1.0, 0.55, 0.135, 0.72, 0.66],
    ],
    neck: [
      ['neckRoot', 0.45, 0.83, 0.16, 0.15, 0.1, 0.88, 0.8],
      ['neck1', 0.55, 0.94, 0.11, 0.1, 0.075],
      ['neck2', 0.63, 1.04, 0.085, 0.08, 0.06],
      ['neckTop', 0.7, 1.13, 0.068, 0.062, 0.05],
    ],
    fore: hoofFore([[0.05, 0.95, 0.29, 0.025, 0.04], [0.1, 0.71, 0.47, 0.045, 0.06], [0.105, 0.56, 0.35, 0.05, 0.06], [0.085, 0.3, 0.37, 0.03], [0.08, 0.13, 0.372, 0.022, 0.026], [0.08, 0.05, 0.41, 0.024]], 0.82),
    hind: hoofHind([[0.09, 0.79, -0.36, 0.08, 0.1], [0.105, 0.58, -0.21, 0.05, 0.06], [0.085, 0.38, -0.44, 0.035, 0.045], [0.08, 0.13, -0.42, 0.022, 0.026], [0.08, 0.05, -0.38, 0.024]], 0.82),
  },
  // A 1.9 m bull moose: a hump over very high shoulders, the back falling to a lower rump (0.9 U), a short deep body on
  // long legs (floor 0.6), a short thick neck carried forward at 25°.
  moose: {
    belly: 0.6, len: 1.0, zF: 0.5, zB: -0.5, croup: 0.9, rumpBot: 0.66, fillet: 0.04,
    body: [
      ['rump', -0.42, 0.85, 0.68, 0.11, 0.84, 0.82],
      ['haunch', -0.3, 0.9, 0.64, 0.14, 0.93, 0.85],
      ['flank', -0.16, 0.91, 0.62, 0.155, 0.95, 0.8],
      ['loin', -0.02, 0.93, 0.6, 0.165, 0.95, 0.85],
      ['barrel', 0.13, 0.97, 0.59, 0.17, 0.92, 0.84],
      ['chest', 0.28, 1.0, 0.6, 0.15, 0.84, 0.7],
    ],
    neck: [
      ['neckRoot', 0.44, 0.83, 0.16, 0.14, 0.11, 0.9, 0.8],
      ['neck1', 0.55, 0.88, 0.12, 0.11, 0.09],
      ['neck2', 0.63, 0.93, 0.1, 0.09, 0.075],
      ['neckTop', 0.7, 0.98, 0.085, 0.075, 0.065],
    ],
    fore: hoofFore([[0.05, 0.95, 0.29, 0.025, 0.04], [0.1, 0.74, 0.46, 0.045, 0.06], [0.105, 0.61, 0.35, 0.05, 0.06], [0.085, 0.32, 0.37, 0.03], [0.08, 0.13, 0.37, 0.022, 0.026], [0.08, 0.05, 0.41, 0.024]], 0.88),
    hind: hoofHind([[0.09, 0.76, -0.33, 0.08, 0.1], [0.105, 0.56, -0.2, 0.05, 0.06], [0.085, 0.37, -0.42, 0.035, 0.045], [0.08, 0.13, -0.4, 0.022, 0.026], [0.08, 0.05, -0.36, 0.024]], 0.88),
  },
  // A 0.95 m bighorn ram: a stocky, deep body (floor 0.5) 1.15 U long, a thick neck rising at 40°, strong short legs.
  caprine: {
    belly: 0.5, len: 1.15, zF: 0.575, zB: -0.575, croup: 0.99, rumpBot: 0.6, fillet: 0.045,
    body: [
      ['rump', -0.49, 0.95, 0.62, 0.13, 0.84, 0.82],
      ['haunch', -0.35, 0.99, 0.56, 0.17, 0.94, 0.86],
      ['flank', -0.2, 0.975, 0.53, 0.18, 0.95, 0.82],
      ['loin', -0.04, 0.965, 0.5, 0.19, 0.95, 0.88],
      ['barrel', 0.13, 0.97, 0.49, 0.19, 0.92, 0.86],
      ['chest', 0.3, 1.0, 0.5, 0.155, 0.78, 0.7],
    ],
    neck: [
      ['neckRoot', 0.48, 0.8, 0.17, 0.16, 0.12, 0.9, 0.8],
      ['neck1', 0.58, 0.89, 0.12, 0.115, 0.09],
      ['neck2', 0.66, 0.97, 0.095, 0.09, 0.072],
      ['neckTop', 0.73, 1.04, 0.075, 0.07, 0.06],
    ],
    fore: hoofFore([[0.05, 0.95, 0.31, 0.025, 0.045], [0.11, 0.68, 0.5, 0.05, 0.065], [0.115, 0.52, 0.38, 0.055, 0.065], [0.09, 0.28, 0.39, 0.032], [0.085, 0.12, 0.39, 0.024, 0.028], [0.085, 0.05, 0.42, 0.026]], 1.0),
    hind: hoofHind([[0.1, 0.76, -0.38, 0.085, 0.11], [0.12, 0.55, -0.25, 0.05, 0.065], [0.09, 0.35, -0.46, 0.038, 0.048], [0.085, 0.12, -0.44, 0.024, 0.028], [0.085, 0.05, -0.405, 0.026]], 1.0),
  },
  // A 1.85 m dromedary (at the withers; the hump is added by `humps`): a short, deep body (0.85 U long, floor 0.58) high on
  // long legs; the neck leaves low on the chest, runs forward and down and curves up to the head; the thigh hangs free
  // below the body with the stifle low (0.48); broad padded feet.
  camelid: {
    belly: 0.58, len: 0.85, zF: 0.42, zB: -0.43, croup: 0.93, rumpBot: 0.64, fillet: 0.035,
    body: [
      ['rump', -0.36, 0.88, 0.66, 0.1, 0.82, 0.8],
      ['haunch', -0.26, 0.93, 0.62, 0.125, 0.92, 0.84],
      ['flank', -0.14, 0.95, 0.6, 0.14, 0.94, 0.8],
      ['loin', -0.02, 0.97, 0.58, 0.15, 0.94, 0.84],
      ['barrel', 0.1, 0.98, 0.575, 0.15, 0.92, 0.84],
      ['chest', 0.23, 1.0, 0.58, 0.13, 0.78, 0.72],
    ],
    neck: [
      ['neckRoot', 0.4, 0.76, 0.14, 0.13, 0.085, 0.9, 0.82],
      ['neck1', 0.56, 0.7, 0.1, 0.095, 0.065],
      ['neck2', 0.71, 0.76, 0.08, 0.075, 0.052],
      ['neckTop', 0.8, 0.9, 0.066, 0.06, 0.045],
    ],
    fore: hoofFore([[0.05, 0.94, 0.22, 0.025, 0.04], [0.1, 0.72, 0.38, 0.045, 0.055], [0.11, 0.6, 0.27, 0.045, 0.055], [0.085, 0.32, 0.3, 0.03], [0.08, 0.1, 0.31, 0.022, 0.026], [0.08, 0.045, 0.36, 0.055, 0.06]], 0.82, { foot: 'pad' }),
    hind: hoofHind([[0.09, 0.72, -0.31, 0.075, 0.095], [0.105, 0.48, -0.19, 0.045, 0.055], [0.085, 0.31, -0.36, 0.033, 0.04], [0.08, 0.1, -0.35, 0.022, 0.026], [0.08, 0.045, -0.31, 0.055, 0.06]], 0.8, { foot: 'pad', tuck: [1, 2] }),
  },
  // A 1.15 m llama: a level body (floor 0.52) on medium legs, the long neck held nearly upright (70°).
  llama: {
    belly: 0.52, len: 1.0, zF: 0.5, zB: -0.5, croup: 0.98, rumpBot: 0.64, fillet: 0.04,
    body: [
      ['rump', -0.42, 0.93, 0.66, 0.11, 0.84, 0.8],
      ['haunch', -0.3, 0.98, 0.6, 0.14, 0.93, 0.84],
      ['flank', -0.16, 0.97, 0.57, 0.15, 0.95, 0.8],
      ['loin', -0.02, 0.965, 0.53, 0.16, 0.95, 0.84],
      ['barrel', 0.13, 0.97, 0.52, 0.16, 0.92, 0.84],
      ['chest', 0.28, 1.0, 0.54, 0.13, 0.78, 0.72],
    ],
    neck: [
      ['neckRoot', 0.44, 0.88, 0.13, 0.12, 0.085, 0.9, 0.82],
      ['neck1', 0.5, 1.06, 0.09, 0.09, 0.065],
      ['neck2', 0.545, 1.24, 0.075, 0.072, 0.055],
      ['neckTop', 0.58, 1.4, 0.065, 0.062, 0.048],
    ],
    fore: hoofFore([[0.05, 0.95, 0.27, 0.025, 0.04], [0.1, 0.72, 0.44, 0.045, 0.055], [0.105, 0.58, 0.33, 0.045, 0.055], [0.085, 0.31, 0.35, 0.03], [0.08, 0.11, 0.355, 0.022, 0.026], [0.08, 0.045, 0.39, 0.028]], 0.85),
    hind: hoofHind([[0.09, 0.76, -0.34, 0.075, 0.095], [0.105, 0.55, -0.21, 0.045, 0.055], [0.085, 0.36, -0.41, 0.033, 0.04], [0.08, 0.11, -0.4, 0.022, 0.026], [0.08, 0.045, -0.36, 0.028]], 0.85),
  },
  // A 3 m giraffe (at the withers): a short body (0.62 U) sloping steeply from the withers to a croup at 0.8, its chest
  // floor 0.65 up; the neck rising at 60° from the shoulders, 0.21 U deep at its base; very long slender legs, the forelegs
  // longer (elbow 0.68), the hind stifle tucked to the belly at 0.52.
  giraffe: {
    belly: 0.6, len: 0.62, zF: 0.31, zB: -0.31, croup: 0.8, rumpBot: 0.62, fillet: 0.03,
    body: [
      ['rump', -0.26, 0.76, 0.62, 0.09, 0.8, 0.8],
      ['haunch', -0.18, 0.8, 0.6, 0.12, 0.9, 0.84],
      ['flank', -0.09, 0.85, 0.6, 0.14, 0.93, 0.8],
      ['loin', 0.0, 0.9, 0.6, 0.155, 0.94, 0.84],
      ['barrel', 0.09, 0.95, 0.595, 0.16, 0.92, 0.84],
      ['chest', 0.18, 1.0, 0.6, 0.14, 0.8, 0.72],
    ],
    neck: [
      ['neckRoot', 0.3, 0.9, 0.105, 0.1, 0.075, 0.9, 0.84],
      ['neck1', 0.41, 1.09, 0.075, 0.072, 0.056],
      ['neck2', 0.52, 1.28, 0.058, 0.056, 0.045],
      ['neckTop', 0.62, 1.46, 0.046, 0.044, 0.037],
    ],
    fore: hoofFore([[0.04, 0.96, 0.17, 0.02, 0.03], [0.08, 0.8, 0.28, 0.035, 0.045], [0.085, 0.68, 0.19, 0.035, 0.045], [0.065, 0.34, 0.215, 0.022], [0.06, 0.1, 0.215, 0.016, 0.019], [0.06, 0.035, 0.245, 0.018]], 0.62, { foot: 'cloven' }),
    hind: hoofHind([[0.075, 0.68, -0.21, 0.06, 0.075], [0.09, 0.52, -0.11, 0.038, 0.045], [0.07, 0.33, -0.3, 0.026, 0.032], [0.06, 0.1, -0.28, 0.016, 0.019], [0.06, 0.035, -0.25, 0.018]], 0.62, { foot: 'cloven' }),
  },
  // A 0.8 m pig: a long barrel (1.45 U) slung low (floor 0.38), broad shoulders and hams, no visible neck (the jowls run
  // into the shoulders), short stout legs.
  suid: {
    belly: 0.38, len: 1.45, zF: 0.72, zB: -0.72, croup: 1.0, rumpBot: 0.5, fillet: 0.045,
    body: [
      ['rump', -0.62, 0.94, 0.5, 0.15, 0.86, 0.84],
      ['haunch', -0.45, 1.0, 0.44, 0.2, 0.94, 0.88],
      ['flank', -0.25, 1.0, 0.4, 0.21, 0.95, 0.86],
      ['loin', -0.05, 1.0, 0.37, 0.215, 0.95, 0.9],
      ['barrel', 0.17, 0.99, 0.36, 0.21, 0.94, 0.88],
      ['chest', 0.38, 1.0, 0.38, 0.19, 0.86, 0.78],
    ],
    neck: [
      ['neckRoot', 0.55, 0.7, 0.26, 0.26, 0.17, 0.92, 0.84],
      ['neck1', 0.63, 0.7, 0.22, 0.22, 0.15],
      ['neck2', 0.69, 0.69, 0.19, 0.19, 0.13],
      ['neckTop', 0.74, 0.68, 0.16, 0.16, 0.115],
    ],
    fore: hoofFore([[0.07, 0.92, 0.4, 0.035, 0.06], [0.14, 0.62, 0.6, 0.06, 0.08], [0.15, 0.42, 0.48, 0.06, 0.07], [0.12, 0.2, 0.5, 0.035], [0.11, 0.09, 0.51, 0.025, 0.03], [0.11, 0.04, 0.55, 0.028]], 1.3, { foot: 'cloven' }),
    hind: hoofHind([[0.12, 0.7, -0.5, 0.09, 0.12], [0.14, 0.45, -0.38, 0.055, 0.07], [0.11, 0.25, -0.55, 0.04, 0.05], [0.105, 0.09, -0.53, 0.025, 0.03], [0.105, 0.04, -0.5, 0.028]], 1.3, { foot: 'cloven' }),
  },
  // A 0.85 m wild boar: massive forequarters under high withers, the back falling to a narrow, lower rump (0.88 U), a deep
  // chest (floor 0.42), the wedge-shaped head low on a short thick neck; longer legs than a pig's.
  boar: {
    belly: 0.42, len: 1.2, zF: 0.6, zB: -0.6, croup: 0.88, rumpBot: 0.52, fillet: 0.045,
    body: [
      ['rump', -0.52, 0.82, 0.54, 0.11, 0.84, 0.82],
      ['haunch', -0.38, 0.88, 0.5, 0.15, 0.92, 0.86],
      ['flank', -0.22, 0.9, 0.46, 0.17, 0.93, 0.84],
      ['loin', -0.05, 0.93, 0.43, 0.185, 0.93, 0.86],
      ['barrel', 0.13, 0.97, 0.42, 0.19, 0.9, 0.84],
      ['chest', 0.32, 1.0, 0.43, 0.17, 0.8, 0.74],
    ],
    neck: [
      ['neckRoot', 0.5, 0.72, 0.25, 0.24, 0.16, 0.92, 0.84],
      ['neck1', 0.6, 0.7, 0.21, 0.2, 0.14],
      ['neck2', 0.67, 0.67, 0.18, 0.17, 0.12],
      ['neckTop', 0.73, 0.64, 0.15, 0.14, 0.105],
    ],
    fore: hoofFore([[0.06, 0.94, 0.32, 0.03, 0.05], [0.12, 0.66, 0.52, 0.055, 0.07], [0.13, 0.47, 0.4, 0.055, 0.065], [0.1, 0.24, 0.42, 0.032], [0.095, 0.1, 0.425, 0.023, 0.027], [0.095, 0.045, 0.46, 0.025]], 1.05, { foot: 'cloven' }),
    hind: hoofHind([[0.1, 0.68, -0.42, 0.08, 0.1], [0.12, 0.48, -0.3, 0.05, 0.065], [0.095, 0.3, -0.48, 0.036, 0.046], [0.09, 0.1, -0.46, 0.023, 0.027], [0.09, 0.045, -0.425, 0.025]], 1.05, { foot: 'cloven' }),
  },
  // A 1.7 m white rhino: a long barrel (1.42 U) on short pillar legs (floor 0.42), the hump of the neck rising level with
  // the withers in front of them, the back dipping and the rump rounded; the long head hung low on a short thick neck;
  // three-toed padded feet.
  rhino: {
    belly: 0.42, len: 1.42, zF: 0.7, zB: -0.72, croup: 0.97, rumpBot: 0.55, fillet: 0.05,
    body: [
      ['rump', -0.62, 0.92, 0.55, 0.14, 0.86, 0.84],
      ['haunch', -0.47, 0.97, 0.49, 0.2, 0.94, 0.88],
      ['flank', -0.3, 0.96, 0.45, 0.235, 0.95, 0.86],
      ['loin', -0.1, 0.94, 0.42, 0.25, 0.95, 0.9],
      ['barrel', 0.12, 0.95, 0.41, 0.25, 0.93, 0.88],
      ['chest', 0.34, 1.0, 0.43, 0.21, 0.86, 0.76],
    ],
    neck: [
      ['neckRoot', 0.55, 0.72, 0.28, 0.25, 0.18, 0.92, 0.84],
      ['neck1', 0.66, 0.68, 0.24, 0.2, 0.16],
      ['neck2', 0.75, 0.62, 0.2, 0.17, 0.14],
      ['neckTop', 0.82, 0.57, 0.17, 0.15, 0.125],
    ],
    fore: { st: 'graviportal', foot: 'pad', tuck: [2, 3],
      J: [[0.07, 0.92, 0.36, 0.04, 0.06], [0.15, 0.62, 0.56, 0.07, 0.09], [0.16, 0.42, 0.44, 0.08, 0.09], [0.14, 0.16, 0.47, 0.065, 0.07], [0.14, 0.055, 0.48, 0.075, 0.08]],
      leg: [[0.9, 0.38, 0.06, 0.07, 0.05, 0.07], [0.75, 0.46, 0.1, 0.12, 0.08, 0.1], [0.62, 0.5, 0.12, 0.14, 0.095, 0.12], [0.52, 0.47, 0.12, 0.13, 0.1, 0.13], [0.42, 0.45, 0.1, 0.11, 0.095],
        [0.34, 0.455, 0.085, 0.09, 0.085], [0.26, 0.46, 0.075, 0.08, 0.078], [0.19, 0.465, 0.072, 0.075, 0.075], [0.16, 0.468, 0.075, 0.077, 0.077], [0.11, 0.472, 0.074, 0.076, 0.076], [0.075, 0.476, 0.078, 0.08, 0.08], [0.055, 0.48, 0.082, 0.083, 0.083]] },
    hind: { st: 'graviportal', foot: 'pad', tuck: [2, 3],
      J: [[0.13, 0.72, -0.48, 0.1, 0.13], [0.15, 0.45, -0.36, 0.08, 0.09], [0.13, 0.2, -0.5, 0.065, 0.07], [0.13, 0.055, -0.48, 0.072, 0.08]],
      leg: [[0.88, -0.46, 0.08, 0.08, 0.06, 0.08], [0.72, -0.48, 0.16, 0.17, 0.11, 0.1], [0.58, -0.45, 0.17, 0.17, 0.115, 0.11], [0.45, -0.42, 0.13, 0.15, 0.1, 0.13], [0.36, -0.45, 0.1, 0.11, 0.085],
        [0.27, -0.48, 0.08, 0.09, 0.075], [0.2, -0.495, 0.072, 0.08, 0.07], [0.14, -0.49, 0.068, 0.072, 0.068], [0.09, -0.485, 0.07, 0.073, 0.07], [0.055, -0.48, 0.074, 0.076, 0.073]] },
  },
  // A 1.5 m hippopotamus: a vast barrel 1.75 U long and 0.62 U wide slung low (floor 0.33) on very short, thick legs; the
  // huge head carried level on a short neck as thick as the body.
  hippo: {
    belly: 0.33, len: 1.75, zF: 0.86, zB: -0.88, croup: 1.0, rumpBot: 0.45, fillet: 0.05,
    body: [
      ['rump', -0.76, 0.93, 0.42, 0.18, 0.88, 0.86],
      ['haunch', -0.58, 1.0, 0.37, 0.27, 0.95, 0.9],
      ['flank', -0.36, 1.0, 0.34, 0.3, 0.96, 0.9],
      ['loin', -0.12, 0.99, 0.32, 0.31, 0.96, 0.92],
      ['barrel', 0.14, 0.99, 0.32, 0.31, 0.95, 0.92],
      ['chest', 0.42, 1.0, 0.34, 0.27, 0.9, 0.84],
    ],
    neck: [
      ['neckRoot', 0.68, 0.66, 0.32, 0.3, 0.22, 0.94, 0.88],
      ['neck1', 0.78, 0.66, 0.3, 0.27, 0.2],
      ['neck2', 0.86, 0.65, 0.27, 0.24, 0.185],
      ['neckTop', 0.93, 0.64, 0.24, 0.21, 0.17],
    ],
    fore: { st: 'graviportal', foot: 'pad', tuck: [2, 3],
      J: [[0.1, 0.9, 0.45, 0.05, 0.07], [0.2, 0.55, 0.7, 0.08, 0.1], [0.21, 0.36, 0.6, 0.08, 0.09], [0.19, 0.14, 0.62, 0.07, 0.075], [0.19, 0.05, 0.63, 0.07, 0.075]],
      leg: [[0.88, 0.48, 0.08, 0.09, 0.06, 0.12], [0.72, 0.6, 0.13, 0.15, 0.1, 0.15], [0.55, 0.65, 0.15, 0.17, 0.11, 0.17], [0.44, 0.62, 0.13, 0.14, 0.11, 0.19], [0.36, 0.6, 0.11, 0.11, 0.1],
        [0.28, 0.61, 0.09, 0.09, 0.09], [0.2, 0.615, 0.08, 0.08, 0.08], [0.14, 0.62, 0.075, 0.077, 0.077], [0.09, 0.625, 0.074, 0.076, 0.076], [0.05, 0.63, 0.076, 0.078, 0.078]] },
    hind: { st: 'graviportal', foot: 'pad', tuck: [2, 3],
      J: [[0.18, 0.7, -0.6, 0.1, 0.13], [0.2, 0.38, -0.48, 0.08, 0.09], [0.18, 0.16, -0.62, 0.065, 0.07], [0.18, 0.05, -0.6, 0.07, 0.075]],
      leg: [[0.86, -0.58, 0.09, 0.09, 0.07, 0.12], [0.7, -0.6, 0.18, 0.19, 0.12, 0.15], [0.55, -0.57, 0.19, 0.19, 0.13, 0.17], [0.42, -0.55, 0.15, 0.16, 0.12, 0.19], [0.32, -0.57, 0.11, 0.12, 0.095],
        [0.23, -0.6, 0.085, 0.09, 0.08], [0.16, -0.62, 0.075, 0.08, 0.072], [0.1, -0.61, 0.072, 0.075, 0.072], [0.05, -0.6, 0.074, 0.076, 0.074]] },
  },
  // A 1.15 m lion: a long body (1.16 U) with a deep chest (floor 0.48) tucked up at the flank, the shoulder blades high,
  // the back level to a rounded croup; a thick neck carried forward; massive forearms (0.14 U deep below the elbow) on
  // low elbows, a long forearm to a low wrist (0.13) and broad paws; the hock low (0.2) on a long, sloping metatarsus.
  felid: {
    belly: 0.48, len: 1.16, zF: 0.58, zB: -0.58, croup: 0.96, rumpBot: 0.6, fillet: 0.045,
    body: [
      ['rump', -0.5, 0.92, 0.62, 0.12, 0.84, 0.82],
      ['haunch', -0.37, 0.96, 0.57, 0.16, 0.93, 0.84],
      ['flank', -0.22, 0.94, 0.565, 0.155, 0.95, 0.78],
      ['loin', -0.06, 0.93, 0.525, 0.165, 0.95, 0.82],
      ['barrel', 0.12, 0.94, 0.485, 0.175, 0.92, 0.82],
      ['chest', 0.3, 1.0, 0.47, 0.155, 0.74, 0.68],
    ],
    neck: [
      ['neckRoot', 0.47, 0.78, 0.19, 0.18, 0.13, 0.9, 0.8],
      ['neck1', 0.58, 0.82, 0.15, 0.14, 0.11],
      ['neck2', 0.67, 0.85, 0.12, 0.11, 0.095],
      ['neckTop', 0.74, 0.87, 0.1, 0.09, 0.085],
    ],
    fore: pawFore([[0.06, 0.94, 0.28, 0.03, 0.05], [0.13, 0.68, 0.46, 0.06, 0.07], [0.14, 0.49, 0.34, 0.065, 0.07], [0.11, 0.13, 0.39, 0.042, 0.04], [0.105, 0.045, 0.43, 0.06, 0.04], [0.105, 0.012, 0.52, 0.03, 0.012]]),
    hind: pawHind([[0.11, 0.74, -0.38, 0.09, 0.11], [0.13, 0.52, -0.22, 0.055, 0.065], [0.1, 0.2, -0.45, 0.04, 0.045], [0.1, 0.045, -0.4, 0.055, 0.04], [0.1, 0.012, -0.31, 0.03, 0.012]]),
  },
  // A 0.8 m cheetah: a short, very deep chest (floor 0.5) and a waist tucked up to 0.68, a slender back arching over the
  // loin; long thin legs and small, tight paws.
  cheetah: {
    belly: 0.5, len: 1.06, zF: 0.53, zB: -0.53, croup: 0.97, rumpBot: 0.64, fillet: 0.04,
    body: [
      ['rump', -0.46, 0.93, 0.66, 0.09, 0.84, 0.8],
      ['haunch', -0.34, 0.97, 0.62, 0.115, 0.93, 0.82],
      ['flank', -0.2, 0.97, 0.68, 0.1, 0.95, 0.72],
      ['loin', -0.05, 0.96, 0.62, 0.11, 0.95, 0.76],
      ['barrel', 0.11, 0.95, 0.53, 0.13, 0.9, 0.74],
      ['chest', 0.27, 1.0, 0.5, 0.115, 0.72, 0.62],
    ],
    neck: [
      ['neckRoot', 0.44, 0.8, 0.15, 0.14, 0.095, 0.9, 0.8],
      ['neck1', 0.54, 0.85, 0.11, 0.105, 0.075],
      ['neck2', 0.62, 0.89, 0.09, 0.085, 0.062],
      ['neckTop', 0.69, 0.92, 0.075, 0.07, 0.054],
    ],
    fore: pawFore([[0.05, 0.94, 0.26, 0.025, 0.045], [0.1, 0.69, 0.43, 0.05, 0.06], [0.105, 0.51, 0.31, 0.05, 0.055], [0.085, 0.14, 0.36, 0.034, 0.032], [0.08, 0.045, 0.4, 0.062, 0.032], [0.08, 0.012, 0.47, 0.026, 0.012]], 0.68),
    hind: pawHind([[0.085, 0.76, -0.36, 0.075, 0.09], [0.1, 0.55, -0.2, 0.045, 0.055], [0.08, 0.22, -0.44, 0.032, 0.036], [0.08, 0.045, -0.39, 0.058, 0.032], [0.08, 0.012, -0.31, 0.026, 0.012]], 0.72),
  },
  // A 0.8 m grey wolf: a narrow, deep chest (floor 0.53) tucked up at the flank, a level back, the neck carried at 35°;
  // long slim legs with the hock a third of the way up and compact paws.
  canid: {
    belly: 0.53, len: 1.1, zF: 0.55, zB: -0.55, croup: 0.97, rumpBot: 0.64, fillet: 0.04,
    body: [
      ['rump', -0.47, 0.93, 0.66, 0.1, 0.84, 0.82],
      ['haunch', -0.34, 0.97, 0.6, 0.13, 0.93, 0.84],
      ['flank', -0.2, 0.95, 0.64, 0.13, 0.95, 0.74],
      ['loin', -0.05, 0.94, 0.6, 0.14, 0.95, 0.8],
      ['barrel', 0.12, 0.95, 0.55, 0.15, 0.9, 0.76],
      ['chest', 0.29, 1.0, 0.53, 0.125, 0.72, 0.62],
    ],
    neck: [
      ['neckRoot', 0.46, 0.8, 0.17, 0.16, 0.11, 0.9, 0.8],
      ['neck1', 0.56, 0.88, 0.13, 0.12, 0.09],
      ['neck2', 0.64, 0.94, 0.105, 0.1, 0.076],
      ['neckTop', 0.71, 0.99, 0.085, 0.08, 0.064],
    ],
    fore: pawFore([[0.05, 0.94, 0.28, 0.025, 0.045], [0.1, 0.7, 0.46, 0.05, 0.06], [0.105, 0.52, 0.33, 0.05, 0.055], [0.085, 0.16, 0.37, 0.032, 0.03], [0.08, 0.05, 0.41, 0.066, 0.03], [0.08, 0.012, 0.49, 0.024, 0.012]], 0.8),
    hind: pawHind([[0.09, 0.76, -0.38, 0.075, 0.09], [0.11, 0.54, -0.22, 0.045, 0.055], [0.08, 0.27, -0.46, 0.032, 0.036], [0.08, 0.05, -0.41, 0.062, 0.03], [0.08, 0.012, -0.33, 0.024, 0.012]], 0.8),
  },
  // A 0.85 m spotted hyena: high, heavy shoulders and a back sloping to a low rump (0.82 U), a thick neck carried forward,
  // strong forelegs and lighter, shorter hind legs.
  hyena: {
    belly: 0.5, len: 1.1, zF: 0.55, zB: -0.55, croup: 0.82, rumpBot: 0.56, fillet: 0.04,
    body: [
      ['rump', -0.47, 0.78, 0.56, 0.11, 0.84, 0.82],
      ['haunch', -0.34, 0.82, 0.53, 0.14, 0.92, 0.84],
      ['flank', -0.2, 0.85, 0.57, 0.14, 0.94, 0.76],
      ['loin', -0.05, 0.89, 0.55, 0.15, 0.94, 0.8],
      ['barrel', 0.12, 0.95, 0.51, 0.16, 0.9, 0.78],
      ['chest', 0.29, 1.0, 0.5, 0.14, 0.78, 0.66],
    ],
    neck: [
      ['neckRoot', 0.46, 0.8, 0.18, 0.16, 0.12, 0.9, 0.8],
      ['neck1', 0.57, 0.85, 0.14, 0.13, 0.1],
      ['neck2', 0.65, 0.88, 0.115, 0.105, 0.085],
      ['neckTop', 0.72, 0.9, 0.095, 0.088, 0.072],
    ],
    fore: pawFore([[0.05, 0.94, 0.28, 0.025, 0.045], [0.11, 0.7, 0.46, 0.05, 0.06], [0.115, 0.5, 0.33, 0.05, 0.055], [0.09, 0.15, 0.37, 0.032, 0.03], [0.085, 0.05, 0.41, 0.07, 0.03], [0.085, 0.012, 0.49, 0.024, 0.012]], 0.85),
    hind: pawHind([[0.09, 0.62, -0.38, 0.075, 0.09], [0.11, 0.44, -0.24, 0.045, 0.055], [0.08, 0.22, -0.45, 0.032, 0.036], [0.08, 0.05, -0.41, 0.066, 0.03], [0.08, 0.012, -0.33, 0.024, 0.012]], 0.72),
  },
  // A 1.1 m brown bear: the hump of the shoulder muscles the highest point, the back falling to the rump (0.9 U), a broad
  // body slung low (floor 0.42) on thick legs; a short, deep neck carrying the big head forward and low; plantigrade, the
  // wrists and heels just above the ground and long soles forward of them.
  ursid: {
    belly: 0.42, len: 1.2, zF: 0.58, zB: -0.62, croup: 0.9, rumpBot: 0.5, fillet: 0.05,
    body: [
      ['rump', -0.52, 0.86, 0.5, 0.15, 0.86, 0.84],
      ['haunch', -0.38, 0.9, 0.45, 0.2, 0.94, 0.88],
      ['flank', -0.22, 0.9, 0.44, 0.21, 0.95, 0.86],
      ['loin', -0.06, 0.91, 0.42, 0.22, 0.95, 0.88],
      ['barrel', 0.12, 0.95, 0.42, 0.22, 0.93, 0.86],
      ['chest', 0.28, 1.0, 0.45, 0.19, 0.88, 0.76],
    ],
    neck: [
      ['neckRoot', 0.46, 0.75, 0.21, 0.2, 0.15, 0.92, 0.84],
      ['neck1', 0.57, 0.75, 0.165, 0.16, 0.13],
      ['neck2', 0.65, 0.74, 0.14, 0.135, 0.115],
      ['neckTop', 0.72, 0.73, 0.12, 0.115, 0.1],
    ],
    fore: soleFore([[0.07, 0.92, 0.28, 0.035, 0.05], [0.14, 0.64, 0.46, 0.07, 0.08], [0.15, 0.42, 0.33, 0.075, 0.08], [0.13, 0.085, 0.38, 0.06, 0.055], [0.13, 0.03, 0.46, 0.06, 0.03], [0.13, 0.012, 0.53, 0.045, 0.012]]),
    hind: soleHind([[0.12, 0.66, -0.42, 0.1, 0.12], [0.14, 0.36, -0.32, 0.07, 0.08], [0.12, 0.08, -0.44, 0.06, 0.06], [0.12, 0.03, -0.31, 0.06, 0.03], [0.12, 0.012, -0.23, 0.045, 0.012]]),
  },
  // A 1.3 m polar bear: the hips higher than the shoulders (1.02 U), a long body and a long neck carrying a small head
  // forward; longer legs than a brown bear's.
  polar: {
    belly: 0.42, len: 1.25, zF: 0.6, zB: -0.65, croup: 1.02, rumpBot: 0.52, fillet: 0.05,
    body: [
      ['rump', -0.55, 0.97, 0.52, 0.14, 0.86, 0.84],
      ['haunch', -0.4, 1.02, 0.47, 0.19, 0.94, 0.88],
      ['flank', -0.24, 1.0, 0.45, 0.2, 0.95, 0.86],
      ['loin', -0.07, 0.98, 0.43, 0.21, 0.95, 0.88],
      ['barrel', 0.12, 0.98, 0.43, 0.21, 0.93, 0.86],
      ['chest', 0.29, 1.0, 0.45, 0.18, 0.86, 0.76],
    ],
    neck: [
      ['neckRoot', 0.47, 0.77, 0.19, 0.18, 0.13, 0.92, 0.84],
      ['neck1', 0.6, 0.8, 0.14, 0.14, 0.105],
      ['neck2', 0.71, 0.82, 0.115, 0.11, 0.088],
      ['neckTop', 0.8, 0.83, 0.095, 0.09, 0.075],
    ],
    fore: soleFore([[0.07, 0.92, 0.29, 0.035, 0.05], [0.14, 0.65, 0.47, 0.07, 0.08], [0.15, 0.43, 0.34, 0.075, 0.08], [0.13, 0.085, 0.39, 0.065, 0.055], [0.13, 0.03, 0.47, 0.065, 0.03], [0.13, 0.012, 0.55, 0.05, 0.012]], 0.95),
    hind: soleHind([[0.12, 0.74, -0.46, 0.1, 0.12], [0.14, 0.42, -0.35, 0.07, 0.08], [0.12, 0.08, -0.48, 0.065, 0.06], [0.12, 0.03, -0.34, 0.065, 0.03], [0.12, 0.012, -0.26, 0.05, 0.012]], 0.95),
  },
  // A 0.3 m raccoon (at the shoulder): hunched, the hindquarters standing high (1.18 U) over longer hind legs, a deep
  // round body, a short neck; plantigrade feet with long, nimble toes.
  procyonid: {
    belly: 0.46, len: 1.35, zF: 0.66, zB: -0.68, croup: 1.18, rumpBot: 0.58, fillet: 0.05,
    body: [
      ['rump', -0.58, 1.08, 0.6, 0.14, 0.86, 0.84],
      ['haunch', -0.43, 1.18, 0.52, 0.19, 0.94, 0.86],
      ['flank', -0.26, 1.18, 0.5, 0.2, 0.95, 0.84],
      ['loin', -0.07, 1.12, 0.48, 0.2, 0.95, 0.86],
      ['barrel', 0.13, 1.05, 0.46, 0.19, 0.93, 0.84],
      ['chest', 0.32, 1.0, 0.46, 0.16, 0.84, 0.74],
    ],
    neck: [
      ['neckRoot', 0.5, 0.78, 0.18, 0.17, 0.13, 0.92, 0.84],
      ['neck1', 0.61, 0.8, 0.14, 0.13, 0.11],
      ['neck2', 0.69, 0.81, 0.12, 0.11, 0.095],
      ['neckTop', 0.76, 0.81, 0.1, 0.095, 0.085],
    ],
    fore: soleFore([[0.07, 0.94, 0.3, 0.035, 0.05], [0.14, 0.66, 0.48, 0.065, 0.075], [0.15, 0.44, 0.35, 0.07, 0.075], [0.13, 0.1, 0.4, 0.055, 0.05], [0.13, 0.035, 0.49, 0.055, 0.03], [0.13, 0.012, 0.56, 0.04, 0.012]], 0.9),
    hind: soleHind([[0.12, 0.82, -0.46, 0.1, 0.12], [0.14, 0.5, -0.32, 0.07, 0.08], [0.12, 0.1, -0.5, 0.06, 0.06], [0.12, 0.035, -0.34, 0.06, 0.03], [0.12, 0.012, -0.26, 0.045, 0.012]], 0.9),
  },
  // A 0.28 m badger: long, low and broad (0.6 U across), a wedge from the low, broad hindquarters forward to the pointed
  // head on a neck as thick as the body; short, very thick legs with long digging claws.
  mustelid: {
    belly: 0.42, len: 1.85, zF: 0.9, zB: -0.92, croup: 1.02, rumpBot: 0.52, fillet: 0.05,
    body: [
      ['rump', -0.8, 0.95, 0.52, 0.2, 0.86, 0.84],
      ['haunch', -0.6, 1.02, 0.46, 0.27, 0.94, 0.88],
      ['flank', -0.36, 1.03, 0.44, 0.29, 0.95, 0.88],
      ['loin', -0.1, 1.02, 0.42, 0.3, 0.95, 0.9],
      ['barrel', 0.18, 1.0, 0.42, 0.29, 0.93, 0.88],
      ['chest', 0.44, 1.0, 0.44, 0.24, 0.88, 0.8],
    ],
    neck: [
      ['neckRoot', 0.66, 0.74, 0.24, 0.24, 0.2, 0.92, 0.86],
      ['neck1', 0.78, 0.72, 0.2, 0.2, 0.17],
      ['neck2', 0.87, 0.7, 0.17, 0.17, 0.15],
      ['neckTop', 0.95, 0.68, 0.15, 0.15, 0.13],
    ],
    fore: soleFore([[0.1, 0.92, 0.44, 0.05, 0.07], [0.2, 0.62, 0.66, 0.08, 0.09], [0.22, 0.4, 0.52, 0.085, 0.09], [0.2, 0.1, 0.58, 0.07, 0.065], [0.2, 0.035, 0.7, 0.075, 0.035], [0.2, 0.012, 0.8, 0.055, 0.012]], 1.25),
    hind: soleHind([[0.17, 0.72, -0.66, 0.12, 0.14], [0.2, 0.42, -0.5, 0.085, 0.09], [0.18, 0.1, -0.7, 0.07, 0.07], [0.18, 0.035, -0.52, 0.07, 0.035], [0.18, 0.012, -0.42, 0.055, 0.012]], 1.25),
  },
  // A 0.3 m river otter: a long, supple body (2.1 U) arched over the loin, a thick neck as wide as the head, short legs
  // set wide, webbed plantigrade feet.
  otter: {
    belly: 0.42, len: 2.1, zF: 1.0, zB: -1.05, croup: 1.08, rumpBot: 0.5, fillet: 0.05,
    body: [
      ['rump', -0.92, 0.98, 0.5, 0.17, 0.86, 0.84],
      ['haunch', -0.7, 1.08, 0.44, 0.23, 0.94, 0.88],
      ['flank', -0.42, 1.1, 0.43, 0.25, 0.95, 0.88],
      ['loin', -0.12, 1.08, 0.42, 0.25, 0.95, 0.9],
      ['barrel', 0.2, 1.03, 0.42, 0.24, 0.93, 0.88],
      ['chest', 0.5, 1.0, 0.43, 0.21, 0.88, 0.8],
    ],
    neck: [
      ['neckRoot', 0.74, 0.74, 0.22, 0.22, 0.18, 0.92, 0.86],
      ['neck1', 0.9, 0.75, 0.19, 0.19, 0.16],
      ['neck2', 1.03, 0.75, 0.17, 0.17, 0.145],
      ['neckTop', 1.14, 0.74, 0.15, 0.15, 0.13],
    ],
    fore: soleFore([[0.1, 0.9, 0.5, 0.045, 0.065], [0.18, 0.6, 0.72, 0.07, 0.08], [0.2, 0.38, 0.6, 0.075, 0.08], [0.18, 0.1, 0.66, 0.06, 0.055], [0.18, 0.035, 0.77, 0.06, 0.03], [0.18, 0.012, 0.87, 0.045, 0.012]]),
    hind: soleHind([[0.16, 0.76, -0.72, 0.11, 0.13], [0.19, 0.45, -0.56, 0.08, 0.085], [0.17, 0.1, -0.76, 0.065, 0.065], [0.17, 0.035, -0.56, 0.065, 0.035], [0.17, 0.012, -0.44, 0.05, 0.012]]),
  },
  // A European rabbit at rest (U = its 0.15 m shoulder): hunched, the back rising from low shoulders to haunches 1.25 U
  // high, round hindquarters reaching the ground over the folded hind legs (only the long hind feet show, flat under
  // them), short straight forelegs, the head held up on a short thick neck. Also a squirrel on all fours (longer).
  leaper: {
    belly: 0.35, len: 1.95, zF: 0.95, zB: -1.0, croup: 1.25, rumpBot: 0.3, fillet: 0.04,
    body: [
      ['rump', -0.85, 1.0, 0.25, 0.32, 0.9, 0.9],
      ['haunch', -0.6, 1.25, 0.2, 0.42, 0.94, 0.9],
      ['flank', -0.3, 1.22, 0.3, 0.4, 0.95, 0.88],
      ['loin', -0.05, 1.13, 0.33, 0.36, 0.95, 0.88],
      ['barrel', 0.25, 1.05, 0.35, 0.33, 0.93, 0.86],
      ['chest', 0.55, 1.0, 0.36, 0.27, 0.86, 0.8],
    ],
    neck: [
      ['neckRoot', 0.8, 0.72, 0.25, 0.25, 0.2, 0.92, 0.86],
      ['neck1', 0.95, 0.8, 0.21, 0.2, 0.18],
      ['neck2', 1.06, 0.88, 0.19, 0.18, 0.165],
      ['neckTop', 1.15, 0.95, 0.17, 0.16, 0.15],
    ],
    fore: pawFore([[0.12, 0.92, 0.6, 0.06, 0.09], [0.2, 0.6, 0.8, 0.1, 0.12], [0.2, 0.42, 0.65, 0.1, 0.11], [0.17, 0.1, 0.72, 0.065, 0.06], [0.16, 0.04, 0.8, 0.1, 0.05], [0.16, 0.012, 0.92, 0.05, 0.012]], 1.6),
    hind: { st: 'digitigrade', foot: 'sole', tuck: [2, 3], blend: [0.3, 0.07, 0.04], hipsTo: [-0.4, 0.75],
      J: [[0.25, 0.85, -0.55, 0.15, 0.2], [0.33, 0.55, -0.2, 0.12, 0.15], [0.3, 0.1, -0.75, 0.065, 0.06], [0.3, 0.03, -0.3, 0.07, 0.03], [0.3, 0.012, -0.05, 0.05, 0.012]],
      leg: [[0.85, -0.55, 0.15, 0.15, 0.12, 0.2], [0.6, -0.42, 0.2, 0.2, 0.14, 0.25], [0.36, -0.52, 0.18, 0.18, 0.12, 0.28], [0.16, -0.66, 0.1, 0.1, 0.08, 0.29], [0.09, -0.73, 0.065, 0.065, 0.065, 0.3]] },
  },
  // A European rabbit at rest (U = its 0.15 m shoulder): egg-shaped, highest over the hips (1.32 U) and rounding down to a
  // rump almost on the ground, the back curving down to low shoulders and a low chest (floor 0.3) on short, thin forelegs;
  // the folded hind legs inside the haunch, only the long hind feet showing flat beneath it; the head held up.
  rabbit: {
    belly: 0.3, len: 1.6, zF: 0.75, zB: -0.85, croup: 1.32, rumpBot: 0.25, fillet: 0.04,
    body: [
      ['rump', -0.72, 0.95, 0.2, 0.3, 0.9, 0.9],
      ['haunch', -0.5, 1.32, 0.16, 0.42, 0.94, 0.9],
      ['flank', -0.22, 1.28, 0.26, 0.4, 0.95, 0.88],
      ['loin', 0.02, 1.15, 0.3, 0.36, 0.95, 0.88],
      ['barrel', 0.28, 1.0, 0.3, 0.32, 0.93, 0.86],
      ['chest', 0.52, 0.9, 0.3, 0.26, 0.86, 0.8],
    ],
    neck: [
      ['neckRoot', 0.72, 0.68, 0.24, 0.24, 0.2, 0.92, 0.86],
      ['neck1', 0.86, 0.78, 0.21, 0.2, 0.18],
      ['neck2', 0.97, 0.87, 0.19, 0.18, 0.165],
      ['neckTop', 1.06, 0.95, 0.17, 0.16, 0.15],
    ],
    fore: pawFore([[0.12, 0.82, 0.55, 0.06, 0.09], [0.19, 0.55, 0.72, 0.1, 0.12], [0.19, 0.38, 0.58, 0.1, 0.11], [0.16, 0.09, 0.64, 0.065, 0.06], [0.15, 0.035, 0.72, 0.1, 0.05], [0.15, 0.012, 0.84, 0.05, 0.012]], 1.45),
    hind: { st: 'digitigrade', foot: 'sole', tuck: [2, 3], blend: [0.3, 0.07, 0.04], hipsTo: [-0.4, 0.75],
      J: [[0.25, 0.9, -0.48, 0.15, 0.2], [0.33, 0.58, -0.15, 0.12, 0.15], [0.3, 0.1, -0.7, 0.065, 0.06], [0.3, 0.03, -0.25, 0.07, 0.03], [0.3, 0.012, 0.0, 0.05, 0.012]],
      leg: [[0.9, -0.48, 0.15, 0.15, 0.12, 0.2], [0.62, -0.36, 0.2, 0.2, 0.14, 0.25], [0.36, -0.47, 0.18, 0.18, 0.12, 0.28], [0.16, -0.62, 0.1, 0.1, 0.08, 0.29], [0.09, -0.68, 0.065, 0.065, 0.065, 0.3]] },
  },
  // A 0.52 m capybara: a heavy barrel (1.55 U) on short legs (floor 0.42), the rump a little higher than the shoulders,
  // a thick short neck under the big blunt head; hoof-like claws.
  capybara: {
    belly: 0.42, len: 1.55, zF: 0.77, zB: -0.78, croup: 1.05, rumpBot: 0.45, fillet: 0.045,
    body: [
      ['rump', -0.68, 0.98, 0.42, 0.2, 0.86, 0.84],
      ['haunch', -0.5, 1.05, 0.38, 0.27, 0.94, 0.88],
      ['flank', -0.28, 1.04, 0.4, 0.28, 0.95, 0.88],
      ['loin', -0.04, 1.01, 0.4, 0.28, 0.95, 0.88],
      ['barrel', 0.22, 0.99, 0.4, 0.27, 0.93, 0.86],
      ['chest', 0.46, 1.0, 0.42, 0.23, 0.86, 0.78],
    ],
    neck: [
      ['neckRoot', 0.68, 0.75, 0.24, 0.24, 0.18, 0.92, 0.86],
      ['neck1', 0.8, 0.79, 0.2, 0.2, 0.16],
      ['neck2', 0.9, 0.82, 0.18, 0.17, 0.145],
      ['neckTop', 0.98, 0.84, 0.16, 0.15, 0.13],
    ],
    fore: pawFore([[0.1, 0.92, 0.48, 0.05, 0.075], [0.18, 0.64, 0.68, 0.085, 0.1], [0.19, 0.44, 0.55, 0.085, 0.09], [0.16, 0.12, 0.6, 0.055, 0.05], [0.15, 0.045, 0.66, 0.08, 0.04], [0.15, 0.012, 0.76, 0.04, 0.012]], 1.15),
    hind: pawHind([[0.17, 0.78, -0.55, 0.13, 0.16], [0.2, 0.5, -0.38, 0.08, 0.095], [0.16, 0.16, -0.6, 0.055, 0.06], [0.15, 0.045, -0.48, 0.075, 0.04], [0.15, 0.012, -0.34, 0.04, 0.012]], 1.15),
  },
  // A 0.32 m beaver (at the shoulder): humped, the back rising to haunches 1.2 U high and rounding down to the tail, a low
  // broad body, a short thick neck; short plantigrade legs, the hind feet big and webbed.
  beaver: {
    belly: 0.38, len: 1.9, zF: 0.92, zB: -0.98, croup: 1.2, rumpBot: 0.35, fillet: 0.05,
    body: [
      ['rump', -0.85, 1.0, 0.32, 0.27, 0.88, 0.86],
      ['haunch', -0.6, 1.2, 0.28, 0.36, 0.94, 0.88],
      ['flank', -0.3, 1.22, 0.33, 0.37, 0.95, 0.88],
      ['loin', 0.0, 1.15, 0.36, 0.35, 0.95, 0.88],
      ['barrel', 0.3, 1.06, 0.38, 0.32, 0.93, 0.86],
      ['chest', 0.58, 1.0, 0.4, 0.26, 0.88, 0.8],
    ],
    neck: [
      ['neckRoot', 0.82, 0.72, 0.25, 0.25, 0.2, 0.92, 0.86],
      ['neck1', 0.95, 0.74, 0.21, 0.21, 0.18],
      ['neck2', 1.05, 0.75, 0.19, 0.19, 0.165],
      ['neckTop', 1.13, 0.75, 0.17, 0.17, 0.15],
    ],
    fore: soleFore([[0.12, 0.92, 0.6, 0.05, 0.075], [0.2, 0.62, 0.8, 0.08, 0.09], [0.22, 0.42, 0.66, 0.085, 0.09], [0.2, 0.1, 0.72, 0.06, 0.055], [0.2, 0.035, 0.82, 0.06, 0.03], [0.2, 0.012, 0.92, 0.045, 0.012]], 0.95),
    hind: soleHind([[0.22, 0.85, -0.6, 0.12, 0.14], [0.28, 0.5, -0.38, 0.085, 0.09], [0.25, 0.1, -0.7, 0.075, 0.065], [0.25, 0.035, -0.4, 0.085, 0.035], [0.25, 0.012, -0.2, 0.06, 0.012]], 1.1),
  },
  // A 0.75 m giant anteater: a deep, level body 1.5 U long, high at the shoulders; the neck tapering forward and down into
  // the long tubular head; strong forelegs walking on the knuckles of their curled claws.
  anteater: {
    belly: 0.42, len: 1.5, zF: 0.72, zB: -0.78, croup: 1.0, rumpBot: 0.45, fillet: 0.045,
    body: [
      ['rump', -0.68, 0.95, 0.45, 0.16, 0.86, 0.84],
      ['haunch', -0.5, 1.0, 0.42, 0.2, 0.94, 0.88],
      ['flank', -0.28, 1.0, 0.42, 0.21, 0.95, 0.86],
      ['loin', -0.05, 0.99, 0.42, 0.21, 0.95, 0.86],
      ['barrel', 0.2, 1.0, 0.42, 0.2, 0.93, 0.84],
      ['chest', 0.44, 1.0, 0.44, 0.17, 0.84, 0.76],
    ],
    neck: [
      ['neckRoot', 0.64, 0.75, 0.2, 0.2, 0.13, 0.92, 0.84],
      ['neck1', 0.8, 0.72, 0.15, 0.15, 0.1],
      ['neck2', 0.92, 0.68, 0.11, 0.11, 0.075],
      ['neckTop', 1.02, 0.64, 0.085, 0.085, 0.058],
    ],
    fore: soleFore([[0.08, 0.93, 0.42, 0.04, 0.06], [0.15, 0.63, 0.62, 0.065, 0.08], [0.16, 0.43, 0.5, 0.07, 0.075], [0.14, 0.1, 0.55, 0.05, 0.05], [0.14, 0.035, 0.63, 0.05, 0.03], [0.14, 0.012, 0.72, 0.04, 0.012]]),
    hind: soleHind([[0.14, 0.74, -0.55, 0.1, 0.12], [0.17, 0.42, -0.4, 0.065, 0.075], [0.14, 0.09, -0.6, 0.05, 0.05], [0.14, 0.035, -0.45, 0.05, 0.03], [0.14, 0.012, -0.36, 0.04, 0.012]], 0.9),
  },
};
// Digital Diorama revision 11: a house mouse and a hedgehog, each laid out from its own measurements (U = shoulder height).
// The mouse (U 2.4 cm): head and body 8 cm, the body pear-shaped, highest (3.2 cm, 1.34 U) over the hips and narrowing
// to the shoulders; no neck to speak of, the big head (2.4 cm) carried low straight off the chest; short forelegs
// under the chest, the long hind feet (1.8 cm) flat on the ground, the thighs inside the round haunches.
REF.mouse = {
  belly: 0.28, len: 2.2, zF: 1.0, zB: -1.15, croup: 1.32, rumpBot: 0.3, fillet: 0.05,
  body: [
    ['rump', -1.05, 1.0, 0.34, 0.48, 0.9, 0.9],
    ['haunch', -0.78, 1.32, 0.22, 0.66, 0.94, 0.9],
    ['flank', -0.4, 1.34, 0.22, 0.7, 0.95, 0.88],
    ['loin', -0.02, 1.22, 0.25, 0.66, 0.95, 0.88],
    ['barrel', 0.36, 1.05, 0.28, 0.58, 0.93, 0.86],
    ['chest', 0.74, 0.92, 0.28, 0.5, 0.9, 0.82],
  ],
  // (the neck no higher than the shoulders: the back runs on in one line from the haunches down over the head)
  neck: [['neckRoot', 0.86, 0.6, 0.33, 0.31, 0.46, 0.94, 0.9], ['neck1', 0.92, 0.61, 0.32, 0.3, 0.44], ['neck2', 0.97, 0.62, 0.31, 0.29, 0.42], ['neckTop', 1.01, 0.62, 0.3, 0.28, 0.4]],
  fore: soleFore([[0.15, 0.82, 0.58, 0.09, 0.11], [0.25, 0.52, 0.7, 0.14, 0.16], [0.26, 0.3, 0.62, 0.13, 0.14], [0.23, 0.1, 0.66, 0.09, 0.085], [0.22, 0.035, 0.72, 0.085, 0.045], [0.22, 0.012, 0.79, 0.05, 0.012]], 1.15),
  hind: soleHind([[0.33, 0.82, -0.75, 0.2, 0.24], [0.44, 0.46, -0.42, 0.14, 0.16], [0.4, 0.12, -0.88, 0.08, 0.08], [0.4, 0.035, -0.45, 0.085, 0.04], [0.4, 0.012, -0.12, 0.055, 0.012]], 1.0),
};
// The hedgehog (U 6 cm): a dome of spines 15 cm long and 12 cm (2 U) high over the loins, 13 cm across, its skirt coming
// down to 2 cm off the ground all round so the short legs hardly show; the furry face comes out low in front.
REF.hedgehog = {
  belly: 0.3, len: 2.5, zF: 1.0, zB: -1.2, croup: 1.75, rumpBot: 0.4, fillet: 0.06,
  body: [
    ['rump', -1.15, 1.2, 0.4, 0.75, 0.9, 0.92],
    ['haunch', -0.85, 1.75, 0.3, 1.0, 0.95, 0.9],
    ['flank', -0.45, 2.0, 0.28, 1.08, 0.96, 0.9],
    ['loin', -0.05, 2.0, 0.3, 1.08, 0.96, 0.9],
    ['barrel', 0.35, 1.8, 0.33, 1.0, 0.95, 0.88],
    ['chest', 0.72, 1.4, 0.38, 0.8, 0.9, 0.84],
  ],
  neck: [['neckRoot', 0.95, 0.78, 0.34, 0.3, 0.42, 0.94, 0.9], ['neck1', 1.05, 0.72, 0.3, 0.27, 0.37], ['neck2', 1.14, 0.68, 0.27, 0.25, 0.33], ['neckTop', 1.22, 0.65, 0.25, 0.23, 0.3]],
  fore: soleFore([[0.25, 0.85, 0.5, 0.12, 0.14], [0.36, 0.55, 0.58, 0.15, 0.16], [0.38, 0.32, 0.52, 0.14, 0.14], [0.37, 0.1, 0.56, 0.11, 0.1], [0.37, 0.035, 0.62, 0.1, 0.05], [0.37, 0.012, 0.68, 0.06, 0.012]], 1.2),
  hind: soleHind([[0.4, 0.8, -0.7, 0.2, 0.22], [0.48, 0.45, -0.55, 0.15, 0.16], [0.45, 0.12, -0.7, 0.11, 0.1], [0.45, 0.035, -0.5, 0.1, 0.05], [0.45, 0.012, -0.34, 0.06, 0.012]], 1.2),
};

const SPECIES_DEFS = {
  horse: { label: 'Horse', fam: UNGULATE, ref: REF.equid, withers: 0, marks: { hooks: 0.022, fossa: 0.03, ribs: 0.015, girth: 0.025, breast: 0.05, withers: 0.01 }, H: 1.6,
    neckAng: 48, neckLen: 0.5, neckThk: 0.7, neckW: 0.64, neckArch: 0.1, headAng: 60, headLen: 0.4, headD: 0.24, headW: 0.17, snout: 0.6, snoutW: 0.62, snoutD: 0.55, stop: 0.08, cheek: 1.3, jowl: 1.4, eye: 0.046, eyeS: 0.3, eyeEl: 24,
    throat: 0.45, browW: 1.1, bridgeW: 0.82, cheekLow: 1.05, lipW: 1.12, muzzleN: 2.5, noseCap: 0.42, nostril: 0.34, nostrilA: 0.45, lipDepth: 0.32,
    foot: 'hoof', ear: { style: 'pointed', len: 0.26, w: 0.42, s: 0.07, a: 0.42, spread: 12, tilt: 6, turn: 30, cup: 0.6 },
    tail: { style: 'hair', len: 0.26, thk: 0.035, set: -50, hair: 2.7, hairW: 3.2 }, mane: { style: 'horse', h: 0.1 }, points: 0.45, countershade: 0.1,
    palette: pal({ body: '#7b4a2a', belly: '#9a6a46', marking: '#24170f', mane: '#1e1410', hoof: '#2e2724', nose: '#3a2d29', skin: '#3d302b' }) },
  zebra: { label: 'Plains Zebra', fam: UNGULATE, H: 1.33, len: 1.0, depth: 0.47, width: 0.84, rump: 0.99, hipW: 1.05, belly: 0.3, withers: 0.08,
    neckAng: 44, neckLen: 0.46, neckThk: 0.66, neckW: 0.62, neckArch: 0.06, headAng: 58, headLen: 0.39, headD: 0.25, headW: 0.18, snout: 0.58, snoutW: 0.64, snoutD: 0.56, stop: 0.08, cheek: 1.3, jowl: 1.4, eye: 0.042, eyeS: 0.3,
    foot: 'hoof', ear: { style: 'pointed', len: 0.33, w: 0.5, s: 0.07, a: 0.42, spread: 16, tilt: 4, turn: 30, cup: 0.6 },
    tail: { style: 'tuft', len: 0.36, thk: 0.022, set: -70, tuft: 2.2 }, mane: { style: 'crest', h: 0.09 }, pattern: 'stripes', countershade: 0.3,
    palette: pal({ body: '#f2efe6', belly: '#f6f3ec', marking: '#1b1a19', pattern: '#161515', mane: '#1a1918', hoof: '#2a2725', nose: '#1e1c1b', skin: '#3a3533' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.equid, withers: 0, refDepth: 1.05, refW: 1.04, foreBulkR: 1.04, hindBulkR: 1.04, marks: { hooks: 0.02, fossa: 0.025, ribs: 0.015, girth: 0.025, breast: 0.05, withers: 0.01 }, },
  donkey: { label: 'Donkey', fam: UNGULATE, H: 1.2, len: 1.0, depth: 0.48, width: 0.84, rump: 1.0, belly: 0.3, withers: 0.02,
    neckAng: 42, neckLen: 0.44, neckThk: 0.66, neckW: 0.66, headAng: 56, headLen: 0.42, headD: 0.25, headW: 0.18, snout: 0.55, snoutW: 0.66, snoutD: 0.6, stop: 0.05, cheek: 1.3, jowl: 1.45, eye: 0.04, eyeS: 0.3,
    foot: 'hoof', ear: { style: 'long', len: 0.55, w: 0.36, s: 0.07, a: 0.42, spread: 20, tilt: 6, turn: 30, cup: 0.6 },
    tail: { style: 'tuft', len: 0.42, thk: 0.02, set: -72, tuft: 2 }, mane: { style: 'crest', h: 0.07 }, muzzle: 'light', muzzleS: 0.55, dorsal: true, countershade: 0.45,
    palette: pal({ body: '#8b847c', belly: '#d9d3c8', marking: '#2a2622', mane: '#2a2622', hoof: '#33302d', nose: '#2b2826' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.equid, withers: 0, refNeck: 0.95, foreBulkR: 0.92, hindBulkR: 0.92, marks: { hooks: 0.03, fossa: 0.03, ribs: 0.02, girth: 0.025, breast: 0.04, withers: 0.005 }, },
  cow: { label: 'Dairy Cow', fam: UNGULATE, marks: { hooks: 0.11, fossa: 0.06, ribs: 0.02, girth: 0.03, breast: 0.05, withers: 0.025, spine: 0.03 }, keel: 0.3, hind: { kY: 0.72, kZ: 0.14, aY: 0.45, aZ: -0.05, fY: 0.15, fZ: -0.04, cY: 0.058 }, H: 1.42, len: 1.16, depth: 0.58, width: 0.86, rump: 1.0, hipW: 1.1, rumpDepth: 0.95, tuck: 0.05, belly: 0.4,
    neckAng: 22, neckLen: 0.3, neckThk: 0.75, neckW: 0.72, headAng: 62, headLen: 0.39, headD: 0.27, headW: 0.27, snout: 0.5, snoutW: 0.8, snoutD: 0.72, stop: 0.05, cheek: 1.12, jowl: 1.2, muzzleN: 2.7, eye: 0.05, eyeS: 0.3, eyeEl: 20,
    // (Digital Diorama revision 9: a broad flat poll and forehead between the horns, a broad square muzzle)
    crownW: 1.2, browW: 1.2, lipW: 1.2, bridgeW: 0.92, dome: 0.88, throat: 0.25,
    ear: { style: 'pointed', len: 0.3, w: 0.55, s: 0.12, a: 1.15, spread: 75, tilt: -10, turn: 40, cup: 0.4 }, horns: { style: 'cattle', len: 0.32, thk: 0.06, s: 0.04, a: 0.95 },
    tail: { style: 'tuft', len: 0.62, thk: 0.022, set: -84, tuft: 2.4 }, pattern: 'patches', countershade: 0.1, muzzle: 'light', muzzleS: 0.8, udder: 0.13,
    palette: pal({ body: '#f1ede4', belly: '#f4f0e8', pattern: '#1c1a19', marking: '#1c1a19', nose: '#d99a96', skin: '#d99a96', horn: '#e2d6b6', hoof: '#3b3330' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.bovine, withers: 0, },
  deer: { label: 'White-tailed Deer', fam: UNGULATE, marks: { hooks: 0.06, fossa: 0.06, ribs: 0.03, girth: 0.04, breast: 0.06, withers: 0.04 }, hind: { kY: 0.73, kZ: 0.15, aY: 0.5, aZ: -0.12, fY: 0.13, fZ: -0.1, cY: 0.05, wall: 48 }, H: 1.0, len: 1.0, depth: 0.42, width: 0.78, rump: 1.02, tuck: 0.3, neckAng: 52, neckLen: 0.48, neckThk: 0.55, neckW: 0.7,
    headAng: 55, headLen: 0.31, headD: 0.26, headW: 0.22, snout: 0.55, snoutW: 0.5, snoutD: 0.5, stop: 0.15, eye: 0.06, eyeS: 0.32, legThk: 0.72,
    ear: { style: 'pointed', len: 0.5, w: 0.56, s: 0.1, a: 0.85, spread: 45, tilt: 4, turn: 35, cup: 0.6 }, horns: { style: 'whitetail', len: 1.15, thk: 0.075, s: 0.09, a: 0.5, tines: 4 },
    tail: { style: 'flat', len: 0.2, thk: 0.035, set: -20, flat: 2 }, tailUnder: true, rumpPatch: true, countershade: 0.55, muzzle: 'dark', muzzleS: 0.9,
    palette: pal({ body: '#9a6b42', belly: '#efe7da', marking: '#2a1d14', nose: '#1d1715', horn: '#cbb48c' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.cervid, withers: 0, },
  // Digital Diorama revision: a deeper chest, thick ruff and fuller tail (it looked shaved), grizzled agouti coat
  // with a dark saddle, tawny legs, pale lips and cheeks under a dark nose (not a white nose tip), dark tail tip
  wolf: { label: 'Gray Wolf', fam: CANID, arch: 0.03, H: 0.8, len: 1.15, depth: 0.46, width: 0.8, rump: 0.97, tuck: 0.36, neckAng: 30, neckLen: 0.32, neckThk: 1.0,
    headAng: 22, headLen: 0.32, headD: 0.27, headW: 0.34, snout: 0.5, snoutW: 0.46, snoutD: 0.5, eye: 0.05, legThk: 1.02, saddle: 0.26, countershade: 0.6, muzzle: 'light', muzzleS: 0.45, muzzleLow: true, cheeks: true,
    tail: { style: 'bushy', len: 0.55, thk: 0.07, set: -62, curl: 12, bush: 0.85 }, tailTip: 0.12, tailTipZone: 'marking', legZone: 'mane', grain: 2.4,
    palette: pal({ body: '#8b8276', belly: '#e6dfd1', marking: '#57504a', mane: '#b09673', eye: '#b9892c', nose: '#1a1817' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.canid, withers: 0,
    // (revision 10) heavier limbs and head to match the measured body
    headLen: 0.35, },
  cat: { label: 'Domestic Cat', fam: FELID, arch: 0.09, belly: 0.18, H: 0.25, len: 1.45, depth: 0.46, width: 0.7, rump: 1.04, tuck: 0.25, neckAng: 34, neckLen: 0.3, neckThk: 0.75,
    // Digital Diorama revision: a brown mackerel tabby, eyes set into the face (they bulged from the sides)
    headAng: 12, headLen: 0.34, headD: 0.38, headW: 0.42, snout: 0.25, snoutW: 0.5, snoutD: 0.55, stop: 0.8, eye: 0.105, eyeInset: 0.74, legThk: 1.05, footLen: 1.1, hockH: 0.26, neckThk: 0.85,
    ear: { len: 0.36, w: 0.78 }, tail: { len: 1.1, thk: 0.034, set: 20, curl: 45, tipCurl: 20 }, pattern: 'tabby', countershade: 0.55, cheeks: true, grain: 1.6,
    palette: pal({ body: '#8f7b5e', belly: '#dccfb6', pattern: '#2e2419', marking: '#2e2419', eye: '#a9a83c', nose: '#c27c72', skin: '#d99a92' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.felid, withers: 0, refLen: 1.05, foreBulkR: 0.82, hindBulkR: 0.9, },
  // Digital Diorama revision (big cats): heavier forelimbs, a broader, deeper body and a broader head
  lion: { label: 'Lion', fam: FELID, foreBulk: 1.55, hindBulk: 1.15, belly: 0.25, H: 1.15, len: 1.35, depth: 0.52, width: 0.86, rump: 0.98, tuck: 0.15, neckAng: 22, neckLen: 0.3, neckThk: 0.95,
    headAng: 18, headLen: 0.32, headD: 0.37, headW: 0.35, snout: 0.38, snoutW: 0.62, snoutD: 0.6, stop: 0.3, eye: 0.052, legThk: 1.28,
    ear: { style: 'round', len: 0.17, w: 0.95, s: 0.24, a: 0.8 }, tail: { style: 'tuft', len: 0.8, thk: 0.028, set: -60, curl: 20, tuft: 2.6 }, mane: { style: 'lion', size: 0.72 }, countershade: 0.45, cheeks: true, earTip: 0.4,
    palette: pal({ body: '#c09356', belly: '#e9d4ae', marking: '#3a2a1c', mane: '#6b4425', eye: '#b8862a', nose: '#6a3d35' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.felid, withers: 0,
    // (revision 10) heavier limbs and head to match the measured body
    headLen: 0.36, foreBulkR: 1.2, hindBulkR: 1.12, mane: { style: 'lion', size: 0.95 }, },
  tiger: { label: 'Bengal Tiger', fam: FELID, foreBulk: 1.55, hindBulk: 1.15, belly: 0.28, H: 1.0, len: 1.55, depth: 0.55, width: 0.88, rump: 1.0, tuck: 0.12, neckAng: 22, neckLen: 0.28, neckThk: 0.98,
    headAng: 15, headLen: 0.33, headD: 0.37, headW: 0.37, snout: 0.33, snoutD: 0.6, stop: 0.45, eye: 0.052, legThk: 1.32, cheek: 1.2, cheekLow: 1.2, ear: { style: 'round', len: 0.17, w: 0.95, s: 0.24, a: 0.82 },
    tail: { style: 'thin', len: 0.95, thk: 0.045, set: -45, curl: 25, tipCurl: 15 }, pattern: 'tiger', countershade: 0.55, cheeks: true, earZone: 'pattern',
    palette: pal({ body: '#d27a2c', belly: '#f3ead8', pattern: '#1b1310', marking: '#1b1310', eye: '#c8a034', nose: '#c07a72' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.felid, withers: 0, refLen: 1.12, refDepth: 1.04, headLen: 0.36,
    // (revision 10) heavier limbs and head to match the measured body
    headLen: 0.38, foreBulkR: 1.2, hindBulkR: 1.12,
    // (revision 10) a deep, heavy body slung low
    refDepth: 1.1, },
  // Digital Diorama revision 8: built by its own builder (see ELEPHANT); these numbers are its scales: len, the torso from
  // the point of shoulder to the point of buttock, depth, withers to belly line (× shoulder height); headLen, snout, eye,
  // ear.len, tusks and tail are the reference sizes the headSize, muzzleLen, earSize and tail sliders scale
  elephant: { label: 'African Elephant', builder: 'elephant', fam: { stance: 'graviportal', nose: 'none' }, H: 3.0, len: 1.1, depth: 0.575, width: 1, rump: 0.84,
    neckLen: 0.08, headLen: 0.4, snout: 0.5, eye: 0.03, legThk: 1.2, nails: 4, countershade: 0, grain: 0, crease: { cell: 9, width: 0.07, dark: 0.78, zones: ['body', 'belly', 'skin', 'marking'] },
    ear: { style: 'fan', len: 1 }, trunk: { len: 1 }, tusks: { style: 'elephant', len: 0.45, thk: 0.07 },
    tail: { style: 'tuft', len: 0.37, thk: 0.017 }, gaits: { walk: 'walk', trot: 'amble', gallop: null }, pantograph: 1,
    palette: pal({ body: '#867f77', belly: '#776f68', marking: '#6c665f', pattern: '#57524c', mane: '#22201e', skin: '#8f7d77', hoof: '#d4cbba', teeth: '#efe6cf', nose: '#4b4542', lid: '#59524c', eye: '#3c2a1e', mouth: '#a27270' }) },
  giraffe: { label: 'Giraffe', fam: UNGULATE, hind: { kY: 0.78, kZ: 0.12, aY: 0.53, aZ: -0.07, fY: 0.12, fZ: -0.06, cY: 0.045 }, hindShape: { breech: 0, hams: 0, inset: 0.06, thighF: 0.12 }, thighW: 0.3, thighD: 0.3, H: 3.0, len: 0.62, depth: 0.36, width: 0.82, rump: 0.82, rumpDepth: 0.72, tuck: 0.2, withers: 0.25,
    // (Digital Diorama revision 9: the croup slopes steeply from the high withers to slender quarters; they hung as a ball)
    hipW: 0.88, rumpCap: 0.55, croupSlope: 0.28,
    neckAng: 62, neckLen: 0.66, neckThk: 0.5, neckW: 0.62, headAng: 60, headLen: 0.19, headD: 0.24, headW: 0.2, snout: 0.55, snoutW: 0.6, snoutD: 0.5, stop: 0.1, eye: 0.06, eyeS: 0.3, legThk: 0.55, tibiaSlope: 0.7,
    ear: { style: 'pointed', len: 0.4, w: 0.42, s: 0.12, a: 1.05, spread: 70, tilt: -5, turn: 35 }, horns: { style: 'ossicones', len: 0.45, thk: 0.07, s: 0.1, a: 0.42 },
    tail: { style: 'tuft', len: 0.3, thk: 0.012, set: -80, tuft: 2.5 }, mane: { style: 'crest', h: 0.025 }, pattern: 'giraffe', countershade: 0,
    palette: pal({ body: '#e5cf9e', belly: '#efe0bd', pattern: '#9b5a2a', mane: '#6a3b1c', hoof: '#2e2724', horn: '#5a3a1f', nose: '#4a3a32' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.giraffe, withers: 0, },
  bear: { label: 'Brown Bear', fam: URSID, H: 1.1, len: 1.3, depth: 0.56, width: 0.95, rump: 0.97, tuck: 0.05, belly: 0.3, withers: 0.18, neckAng: 14, neckLen: 0.26,
    headAng: 22, headLen: 0.37, headD: 0.32, headW: 0.42, snout: 0.42, snoutW: 0.5, snoutD: 0.5, legThk: 1.25, countershade: 0.1, muzzle: 'light', muzzleS: 0.7,
    // (Digital Diorama revision 9: a big, broad head with a high forehead over a dished face; it was small and narrow)
    stop: 0.7, dome: 1.25, crownW: 1.05, cheekLow: 1.18, bridgeW: 0.82, eye: 0.045,
    palette: pal({ body: '#6b4a2e', belly: '#5d3f27', marking: '#3a2818', hoof: '#2a2420', nose: '#161210' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.ursid, withers: 0.08, humpTop: 0.95, withersFront: 0.2, withersBack: 0.4,
    // (revision 10) heavier limbs and head to match the measured body
    headLen: 0.42, headW: 0.46, },
  pig: { label: 'Domestic Pig', fam: UNGULATE, marks: { breast: 0.03 }, keel: 0.1, waist: 0, hind: { kY: 0.66, kZ: 0.17, aY: 0.38, aZ: -0.06, fY: 0.13, fZ: -0.035, cY: 0.05 }, H: 0.8, len: 1.4, depth: 0.62, width: 0.92, rump: 1.02, hipW: 1.08, tuck: 0, belly: 0.4, neckAng: 8, neckLen: 0.06, neckThk: 0.92, neckW: 0.95,
    headAng: 28, headLen: 0.38, headD: 0.31, headW: 0.38, snout: 0.48, snoutW: 0.4, snoutD: 0.5, stop: 0.12, dome: 0.9, jowl: 1.7, eye: 0.035, nose: 'disc', muzzleN: 2.6, eyeYaw: 50,
    // (Digital Diorama revision 9: fat jowls running into the neck, a straight cylindrical snout; the head was a narrow cone)
    cheekLow: 1.3, crownW: 1.05, throat: 0,
    legThk: 1.25, ear: { style: 'semiPrick', len: 0.42, w: 0.58, s: 0.2, a: 0.75, spread: 30, tilt: 8, turn: 10, cup: 0.18, breakU: 0.62 }, tail: { style: 'curly', len: 0.3, thk: 0.018, turns: 1.6 },
    countershade: 0, palette: pal({ body: '#eab3a4', belly: '#ebb8aa', skin: '#e39a8c', nose: '#d98b80', mouth: '#9c4c4a', hoof: '#a08070' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.suid, withers: 0, },
  // Digital Diorama revision: a compact body under a larger head (the body dwarfed it)
  rabbit: { label: 'Rabbit', fam: RODENT, H: 0.2, len: 1.22, depth: 0.7, width: 0.78, rump: 1.2, rumpDepth: 1.15, hipW: 1.1, tuck: 0.05, neckAng: 35, neckLen: 0.18, neckThk: 0.9,
    headAng: 18, headLen: 0.53, headD: 0.36, headW: 0.38, snout: 0.32, snoutW: 0.62, snoutD: 0.7, noseCap: 0.35, muzzleN: 2.4, cheekLow: 1.15, padW: 0.8, eye: 0.1, eyeYaw: 75, legThk: 1.1, crouch: 0.9, hockH: 0.08, footLen: 2.6, incisors: 0.07,
    ear: { style: 'long', len: 0.95, w: 0.32, s: 0.18, a: 0.5, spread: 14, tilt: 22, turn: 18, cup: 0.6 }, tail: { style: 'fluffy', len: 0.22, thk: 0.07, set: 40 },
    countershade: 0.5, tailTip: 1, tailTipZone: 'belly', palette: pal({ body: '#9a8068', belly: '#eee4d6', skin: '#dba59a', nose: '#c98b84', eye: '#2a1b12' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.rabbit, H: 0.15, headLen: 0.62, },
  // Digital Diorama revision: a stocky retriever (it read as a whippet): deep, broad chest, thick legs and neck,
  // broad skull and muzzle, thick "otter" tail; pale yellow coat
  dog: { label: 'Labrador Dog', fam: CANID, H: 0.58, len: 1.18, depth: 0.54, width: 0.92, rump: 0.98, tuck: 0.18, neckAng: 36, neckLen: 0.3, neckThk: 0.98,
    headAng: 15, headLen: 0.4, headD: 0.32, headW: 0.4, snout: 0.46, snoutW: 0.6, snoutD: 0.72, muzzleN: 2.4, noseCap: 0.32, stop: 0.95, brow: 0.06, dome: 0.92, eye: 0.045, jowl: 1.15, legThk: 1.18, padW: 0.7, padH: 0.7,
    // (Digital Diorama revision 9: a broad, flat-topped skull and a long, deep muzzle with hanging flews; it was a ball)
    crownW: 1.05, browW: 1.04, bridgeW: 0.9, lipW: 1.08, lipDepth: 0.38, lipInset: 0.04,
    ear: { style: 'floppy', len: 0.44, w: 0.56, s: 0.22, a: 1.05, spread: 10, droop: 0.97, hang: 70, cup: 0.08, innerW: 0 }, tail: { style: 'thin', len: 0.6, thk: 0.07, set: -10, curl: -10 },
    countershade: 0.15, palette: pal({ body: '#e2c38c', belly: '#ecd4a8', nose: '#2a1d18', eye: '#5a3a1c' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.canid, withers: 0, refDepth: 1.06, refW: 1.18, refLen: 0.98, foreBulkR: 1.15, hindBulkR: 1.12,
    // (revision 10) heavier limbs and head to match the measured body
    refDepth: 1.12, refW: 1.28, foreBulkR: 1.3, hindBulkR: 1.25, },
  fox: { label: 'Red Fox', fam: CANID, hindBulk: 0.92, hindShape: { thighF: 0.12, breech: 0.06, hams: 0.01, kneeW: 0.05, patella: 0.035 }, arch: 0.04, H: 0.4, len: 1.4, depth: 0.46, width: 0.72, rump: 1.0, tuck: 0.4, neckAng: 32, neckLen: 0.3, neckThk: 0.72,
    headAng: 18, headLen: 0.36, headD: 0.26, headW: 0.31, snout: 0.53, snoutW: 0.38, snoutD: 0.44, eye: 0.055, dome: 1.2, legThk: 0.8, pupil: 'slit', slitW: 0.3,
    ear: { len: 0.45, w: 0.58 }, tail: { style: 'bushy', len: 0.95, thk: 0.1, set: -35, curl: 10, bush: 1.0 }, points: 0.55, tailTip: 0.14, tailTipZone: 'belly', earTip: 0.0, earZone: 'marking', countershade: 0.6, cheeks: true, grain: 1.5, neckThk: 0.85,
    palette: pal({ body: '#c4561e', belly: '#efe6da', marking: '#231a16', eye: '#c08c2a', nose: '#181412' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.canid, withers: 0, refLen: 1.14, foreBulkR: 0.88, hindBulkR: 0.9, },
  hyena: { label: 'Spotted Hyena', fam: CANID, foreBulk: 1.3, hindBulk: 1.05, waist: 0.1, hind: { aY: 0.33 }, H: 0.85, len: 1.1, depth: 0.5, width: 0.72, rump: 0.8, rumpDepth: 0.85, withers: 0.15, neckAng: 25, neckLen: 0.34, neckThk: 0.9,
    headAng: 20, headLen: 0.36, headD: 0.32, headW: 0.38, snout: 0.42, snoutW: 0.52, snoutD: 0.66, eye: 0.04, dome: 1.25, stop: 0.45, cheekLow: 1.18, noseCap: 0.3, padW: 0.8, padH: 0.8,
    ear: { style: 'round', len: 0.27, w: 0.85 }, tail: { style: 'bushy', len: 0.38, thk: 0.035, set: -70, bush: 0.6 }, mane: { style: 'crest', h: 0.05 }, pattern: 'hyena', countershade: 0.2, muzzle: 'dark', muzzleS: 0.4,
    palette: pal({ body: '#b49a6c', belly: '#c8b38a', pattern: '#3a2b1e', marking: '#2d241b', mane: '#3a2b1e', nose: '#151110' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.hyena, withers: 0,
    // (revision 10) heavier limbs and head to match the measured body
    foreBulkR: 1.12, hindBulkR: 1.05, },
  cheetah: { label: 'Cheetah', fam: FELID, arch: 0.12, marks: { hooks: 0.04, fossa: 0.03, ribs: 0.04, girth: 0.05, breast: 0.05, scapula: 0.06, spine: 0.015 }, foreBulk: 1.15, hindBulk: 1.0, waist: 0.22, keel: 0.5, hind: { kY: 0.68, kZ: 0.18, aY: 0.34, aZ: -0.11, fY: 0.07, fZ: -0.09, toe: 0.12 }, H: 0.8, len: 1.25, depth: 0.44, width: 0.62, rump: 0.98, tuck: 0.65, chestW: 0.95, neckAng: 25, neckLen: 0.3, neckThk: 0.72,
    headAng: 12, headLen: 0.24, headD: 0.38, headW: 0.37, snout: 0.27, snoutW: 0.52, snoutD: 0.58, stop: 0.7, eye: 0.072, legThk: 0.84, claws: 0.4, ear: { style: 'round', len: 0.2, w: 0.95, s: 0.26, a: 0.85 },
    tail: { style: 'thin', len: 0.85, thk: 0.032, set: -55, curl: 30, tipCurl: 25 }, pattern: 'spots', tearMark: true, countershade: 0.55, cheeks: true,
    palette: pal({ body: '#d9a856', belly: '#f2e6cc', pattern: '#1d1712', marking: '#1d1712', eye: '#b8862a', nose: '#2a1f1a' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.cheetah, withers: 0, },
  leopard: { label: 'Leopard', fam: FELID, foreBulk: 1.5, hindBulk: 1.12, belly: 0.2, H: 0.65, len: 1.5, depth: 0.5, width: 0.8, rump: 1.0, tuck: 0.18, neckAng: 24, neckLen: 0.3, neckThk: 0.92,
    headAng: 14, headLen: 0.32, headD: 0.37, headW: 0.37, snout: 0.3, snoutW: 0.55, snoutD: 0.6, stop: 0.6, eye: 0.058, legThk: 1.18, ear: { style: 'round', len: 0.2, w: 0.95, s: 0.24, a: 0.8 },
    tail: { style: 'thin', len: 1.2, thk: 0.035, set: -40, curl: 30, tipCurl: 20 }, pattern: 'rosettes', countershade: 0.55, cheeks: true,
    palette: pal({ body: '#d6a54e', belly: '#f2e5c8', pattern: '#1f1611', marking: '#a86a26', eye: '#b8a03a', nose: '#b07a6a' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.felid, withers: 0, refLen: 1.1, refDepth: 1.05, foreBulkR: 0.92, hindBulkR: 0.95,
    // (revision 10) heavier limbs and head to match the measured body
    headLen: 0.35, foreBulkR: 1.05, hindBulkR: 1.05, },
  lynx: { label: 'Eurasian Lynx', fam: FELID, H: 0.62, len: 1.12, depth: 0.48, width: 0.72, rump: 1.06, tuck: 0.3, neckAng: 28, neckLen: 0.28, neckThk: 0.82,
    headAng: 14, headLen: 0.3, headD: 0.38, headW: 0.38, snout: 0.26, snoutW: 0.52, snoutD: 0.58, stop: 0.65, cheek: 1.45, eye: 0.068, legThk: 1.05, footLen: 1.15, pawW: 1.25,
    ear: { style: 'tufted', len: 0.34, w: 0.7, s: 0.26, a: 0.66, spread: 20 }, tail: { style: 'thin', len: 0.18, thk: 0.04, set: -30 }, tailTip: 0.35, earTip: 0.25,
    pattern: 'spots', patternScale: 0.95, spotSize: 0.24, countershade: 0.6, cheeks: true, grain: 1.5,
    palette: pal({ body: '#b8936a', belly: '#efe4d2', pattern: '#6e5038', marking: '#1d1714', eye: '#b8a03a', nose: '#b07a6a' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.felid, withers: 0, refLen: 0.9, refDepth: 0.92, foreBulkR: 0.85, hindBulkR: 0.9, },
  // Digital Diorama revision: heavier limbs and body (it looked slender)
  polarBear: { label: 'Polar Bear', fam: URSID, H: 1.3, len: 1.45, depth: 0.58, width: 1.0, rump: 1.02, tuck: 0.06, belly: 0.25, neckAng: 22, neckLen: 0.38, neckThk: 0.85,
    // Digital Diorama revision 7: a long head with a slight Roman nose and a deep lower jaw flush with the cheek
    headAng: 14, headLen: 0.32, headD: 0.32, headW: 0.3, snout: 0.48, snoutW: 0.58, snoutD: 0.52, stop: 0.15, roman: 0.3, jaw: 0.35, dome: 0.95, legThk: 1.55, pawW: 1.25, countershade: 0,
    ear: { len: 0.15 }, palette: pal({ body: '#ece6d6', belly: '#e6dfcd', marking: '#d6ceb8', nose: '#121010', hoof: '#2a2420', skin: '#2a2420' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.polar, withers: 0, },
  panda: { label: 'Giant Panda', fam: URSID, H: 0.75, len: 1.3, depth: 0.6, width: 1.0, rump: 1.0, tuck: 0.05, belly: 0.3, neckAng: 18, neckLen: 0.22, neckThk: 0.9,
    headAng: 16, headLen: 0.38, headD: 0.36, headW: 0.46, snout: 0.27, snoutW: 0.5, snoutD: 0.55, stop: 0.5, dome: 1.15, cheek: 1.35, cheekLow: 1.15, lipInset: 0.12, legThk: 1.3,
    ear: { style: 'round', len: 0.22, w: 1.0, s: 0.2, a: 0.82 }, pattern: 'panda', countershade: 0,
    palette: pal({ body: '#f1ede4', belly: '#f1ede4', pattern: '#1b1a1a', marking: '#1b1a1a', nose: '#121010', skin: '#1b1a1a' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.ursid, withers: 0, refLen: 0.92, refDepth: 1.1, refW: 1.12,
    // (revision 10) heavier limbs and head to match the measured body
    headLen: 0.42, },
  // Digital Diorama revision: a hunched, stocky body (it was long and stretched) and a grizzled coat
  raccoon: { label: 'Raccoon', fam: { ...URSID, stance: 'plantigrade' }, hind: { kY: 0.5, foot: 0.38 }, H: 0.3, len: 1.3, depth: 0.66, width: 0.95, rump: 1.2, tuck: 0.1, neckAng: 25, neckLen: 0.22, neckThk: 0.95, legThk: 1.2, grain: 2.2,
    headAng: 15, headLen: 0.42, headD: 0.3, headW: 0.42, snout: 0.45, snoutW: 0.35, snoutD: 0.4, stop: 0.45, eye: 0.05, cheek: 1.35, claws: 0.6,
    ear: { style: 'round', len: 0.26, w: 0.85, s: 0.22, a: 0.68, spread: 20 }, tail: { style: 'bushy', len: 0.85, thk: 0.085, set: -30, bush: 0.5 }, pattern: 'raccoon', countershade: 0.3, earTip: 0.0, earZone: 'belly',
    palette: pal({ body: '#8a847b', belly: '#cfc8bb', pattern: '#1e1c1a', marking: '#2b2825', nose: '#121010' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.procyonid, withers: 0, },
  badger: { label: 'European Badger', fam: URSID, hind: { kY: 0.44, kZ: 0.12, foot: 0.42 }, H: 0.28, len: 2.1, depth: 0.7, width: 1.25, grain: 1.8, rump: 1.0, tuck: 0, belly: 0.2, neckAng: 10, neckLen: 0.3, neckThk: 0.85,
    headAng: 18, headLen: 0.5, headD: 0.28, headW: 0.32, snout: 0.45, snoutW: 0.46, snoutD: 0.5, stop: 0.05, dome: 1.05, cheekLow: 1.1, eye: 0.03, legThk: 1.4, claws: 1.4,
    ear: { style: 'round', len: 0.14, w: 1.0, s: 0.22, a: 0.95 }, tail: { style: 'bushy', len: 0.45, thk: 0.06, set: -20, bush: 0.4 }, pattern: 'badger', countershade: 0,
    palette: pal({ body: '#8f8a84', belly: '#ece8df', pattern: '#1a1918', marking: '#1a1918', nose: '#121010' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.mustelid, withers: 0, },
  otter: { label: 'River Otter', fam: { stance: 'plantigrade', nose: 'pad', whiskerPads: true, claws: 0.3 }, hind: { kY: 0.46, foot: 0.46 }, H: 0.3, len: 2.4, depth: 0.58, width: 0.92, rump: 1.02, tuck: 0.05, neckAng: 18, neckLen: 0.42, neckThk: 0.92,
    // Digital Diorama revision 7: a broad flat skull, a short blunt muzzle with big whisker pads, small eyes set high and
    // tiny round ears (the head was long and flat: a duck's bill)
    headAng: 8, headLen: 0.36, headD: 0.3, headW: 0.4, snout: 0.27, snoutW: 0.75, snoutD: 0.55, muzzleN: 2.6, noseCap: 0.3, stop: 0.25, dome: 0.88, eye: 0.04, eyeEl: 36, eyeYaw: 48, legThk: 1.2, footLen: 1.1, webbed: true, toes: 5,
    ear: { style: 'round', len: 0.1, w: 1.0, s: 0.22, a: 1.08 }, tail: { style: 'thin', len: 1.35, match: 0.75, set: -15 }, countershade: 0.45, cheeks: true,
    palette: pal({ body: '#5e432c', belly: '#a68e72', nose: '#121010', web: '#3a2a1e' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.otter, withers: 0, },
  // Digital Diorama revision: a round body under a dense coat of short spines laid back (painted between the
  // modelled quills), rather than sparse long spikes on a long body
  hedgehog: { label: 'Hedgehog', fam: { stance: 'plantigrade', nose: 'pad', claws: 0.5 }, hind: { kY: 0.42, kZ: 0.1, foot: 0.46 }, H: 0.115, len: 1.35, depth: 0.86, width: 1.2, rump: 1.0, tuck: 0, neckAng: 15, neckLen: 0.12, neckThk: 0.95,
    headAng: 25, headLen: 0.45, headD: 0.32, headW: 0.38, snout: 0.42, snoutW: 0.32, snoutD: 0.36, stop: 0.15, eye: 0.065, legThk: 1.4, quills: { len: 0.2, count: 560, lay: 1.35 }, spinyBack: true,
    ear: { style: 'round', len: 0.2, w: 1.0, s: 0.25, a: 0.95 }, tail: { style: 'thin', len: 0.12, thk: 0.06, set: -30 }, countershade: 0.6,
    palette: pal({ body: '#7d6a55', belly: '#cbb59a', marking: '#c9b996', pattern: '#4f3e2d', nose: '#121010', skin: '#d4a090' }),
    // Digital Diorama revision 11: laid out from the measured low, humped body of the beaver's reference (the back rising
    // to round haunches, short plantigrade legs half hidden under it); it stood on long legs like a small bear
    ref: REF.hedgehog, H: 0.06, headLen: 0.8, headAng: 12, headD: 0.42, headW: 0.46, snout: 0.56, snoutW: 0.26, snoutD: 0.28, stop: 0.08, eye: 0.06,
    quills: { len: 0.26, count: 700, lay: 1.05 } },
  // Digital Diorama revision: a compact, crouched body low on short legs (it stood on stilts like a cat) and a
  // tail as bushy as the body is deep, arching up behind the back
  squirrel: { label: 'Red Squirrel', fam: RODENT, hind: { kZ: 0.34, aZ: -0.16, foot: 0.68 }, H: 0.095, len: 1.9, depth: 0.74, width: 0.85, rump: 1.12, rumpDepth: 1.15, tuck: 0.15, neckAng: 40, neckLen: 0.18, neckThk: 0.9,
    headAng: 15, headLen: 0.5, headD: 0.38, headW: 0.44, snout: 0.32, eye: 0.12, legThk: 1.25,
    ear: { style: 'tufted', len: 0.42, w: 0.55, s: 0.2, a: 0.55, spread: 15 }, tail: { style: 'bushy', len: 1.8, thk: 0.24, set: 62, curl: -8, tipCurl: -22, bush: 0.9 },
    countershade: 0.65, palette: pal({ body: '#b5561f', belly: '#f2e4cc', marking: '#7a3812', nose: '#3a2a22', eye: '#140e0b' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.leaper, refLen: 1.02, refW: 0.88, foreBulkR: 0.85, hindBulkR: 0.9, },
  beaver: { label: 'Beaver', fam: { ...RODENT, stance: 'plantigrade', crouch: 0 }, hind: { kY: 0.45, kZ: 0.15, foot: 0.62 }, H: 0.32, len: 2.0, depth: 0.72, width: 1.0, rump: 1.15, rumpDepth: 1.1, tuck: 0, neckAng: 20, neckLen: 0.22, neckThk: 0.95,
    // Digital Diorama revision 7: a big, blunt, rounded head with a short deep muzzle and broad orange incisors
    headAng: 15, headLen: 0.45, headD: 0.36, headW: 0.4, snout: 0.3, snoutW: 0.66, snoutD: 0.75, noseCap: 0.35, eye: 0.04, incisors: 0.1, incisorW: 0.42, webbed: 'hind', toes: 5, legThk: 1.25,
    ear: { style: 'round', len: 0.12, w: 1.0, s: 0.22, a: 0.95 }, tail: { style: 'flat', len: 0.95, thk: 0.15, set: -12, flat: 3.4 }, countershade: 0.2,
    palette: pal({ body: '#6a4426', belly: '#7a5232', marking: '#2c2420', web: '#2c2420', nose: '#151110', teeth: '#d8862a' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.beaver, },
  capybara: { label: 'Capybara', fam: { ...RODENT, crouch: 0.2, hockH: 0.2, footLen: 1.4, eye: 0.04 }, hind: { kY: 0.62, kZ: 0.2, aY: 0.24, aZ: -0.14, fY: 0.05, toe: 0.22 }, H: 0.52, len: 1.6, depth: 0.6, width: 0.85, rump: 1.06, tuck: 0.05, neckAng: 20, neckLen: 0.2, neckThk: 0.9,
    headAng: 30, headLen: 0.48, headD: 0.36, headW: 0.33, snout: 0.5, snoutW: 0.82, snoutD: 0.82, stop: 0.0, dome: 0.92, eyeEl: 30, nose: 'muzzle', nostril: 0.18, legThk: 1.3,
    ear: { style: 'round', len: 0.12, w: 1.0, s: 0.12, a: 0.75 }, tail: { style: 'none', len: 0 }, countershade: 0.1,
    palette: pal({ body: '#8a6440', belly: '#9a744e', nose: '#2a1d16', skin: '#5a4030' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.capybara, },
  sheep: { label: 'Sheep', fam: UNGULATE, hind: { kY: 0.72, aY: 0.46, aZ: -0.08, fY: 0.15, fZ: -0.065, cY: 0.055 }, H: 0.8, len: 1.15, depth: 0.62, width: 1.0, rump: 1.0, tuck: 0, belly: 0.2, neckAng: 32, neckLen: 0.26, neckThk: 0.85,
    // Digital Diorama revision 7: a Roman nose and a wool cap on the forehead (the face was a plain dark tube)
    headAng: 55, headLen: 0.34, headD: 0.27, headW: 0.26, snout: 0.5, snoutW: 0.6, snoutD: 0.58, stop: 0.1, roman: 1.5, eye: 0.05, legThk: 0.85, wool: 0.06, woolCap: 1,
    ear: { style: 'pointed', len: 0.32, w: 0.42, s: 0.12, a: 1.2, spread: 80, tilt: -15, turn: 40 }, tail: { style: 'thin', len: 0.2, thk: 0.05, set: -80 },
    faceZone: 'marking', legZone: 'marking', countershade: 0, earZone: 'marking',
    palette: pal({ body: '#ece2cc', belly: '#e6dbc2', marking: '#2c2623', nose: '#1d1917', skin: '#2c2623' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.caprine, withers: 0, refDepth: 1.08, refW: 1.12, refLen: 0.95, },
  bighorn: { label: 'Bighorn Sheep', fam: UNGULATE, hind: { kY: 0.72, aY: 0.46, aZ: -0.08, fY: 0.15, fZ: -0.065, cY: 0.055 }, H: 1.0, len: 1.1, depth: 0.52, width: 0.88, rump: 1.0, tuck: 0.2, neckAng: 40, neckLen: 0.3, neckThk: 0.85,
    headAng: 50, headLen: 0.3, headD: 0.29, headW: 0.27, snout: 0.5, snoutW: 0.58, snoutD: 0.55, stop: 0.15, roman: 0.4, eye: 0.05, legThk: 0.95,
    ear: { style: 'pointed', len: 0.3, w: 0.45, s: 0.14, a: 1.05, spread: 60, tilt: 0 }, horns: { style: 'ram', len: 1.45, thk: 0.17, s: 0.1, a: 0.5, curl: 1.85 },
    tail: { style: 'thin', len: 0.12, thk: 0.035, set: -60 }, rumpPatch: true, muzzle: 'light', muzzleS: 0.85, countershade: 0.35,
    palette: pal({ body: '#7a5f45', belly: '#eee4d4', horn: '#bfa77e', nose: '#2b2320' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.caprine, withers: 0, },
  goat: { label: 'Domestic Goat', fam: UNGULATE, marks: { hooks: 0.07, fossa: 0.05, ribs: 0.03, girth: 0.03, breast: 0.05, withers: 0.04, spine: 0.02 }, hind: { kY: 0.72, aY: 0.46, aZ: -0.08, fY: 0.15, fZ: -0.065, cY: 0.055 }, H: 0.75, len: 1.15, depth: 0.5, width: 0.8, rump: 1.02, tuck: 0.15, neckAng: 45, neckLen: 0.34, neckThk: 0.68,
    headAng: 55, headLen: 0.32, headD: 0.26, headW: 0.24, snout: 0.5, snoutW: 0.55, snoutD: 0.5, stop: 0.2, eye: 0.055, legThk: 0.85,
    ear: { style: 'pointed', len: 0.42, w: 0.38, s: 0.12, a: 1.1, spread: 75, tilt: -10, turn: 40 }, horns: { style: 'goat', len: 0.8, thk: 0.07, s: 0.08, a: 0.35 },
    tail: { style: 'flat', len: 0.16, thk: 0.03, set: 55 }, mane: { style: 'none', beard: 0.45 }, countershade: 0.1,
    palette: pal({ body: '#e8e1d2', belly: '#efe9dc', marking: '#8a7a68', mane: '#d8d0bf', horn: '#a39478', nose: '#9a7d74', eye: '#c8a034' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.caprine, H: 0.95, withers: 0.1, refDepth: 1.05, refW: 1.05, foreBulkR: 1.08, hindBulkR: 1.05,
    // (revision 10) a rounded hump over the shoulders
    withers: 0.07, humpTop: 0.96, withersFront: 0.22, withersBack: 0.36, },
  bison: { label: 'American Bison', fam: UNGULATE, marks: { hooks: 0.06, fossa: 0.03, breast: 0.04 }, hind: { kY: 0.68, kZ: 0.13, aY: 0.42, aZ: -0.05, fY: 0.14, fZ: -0.04, cY: 0.058 }, H: 1.8, len: 1.15, depth: 0.6, width: 0.85, rump: 0.8, rumpDepth: 0.8, tuck: 0.15, withers: 0.22, chestW: 1.15,
    // Digital Diorama revision 7: a broad, rounded hump over the shoulders, falling steeply to the low-carried head and
    // sloping gradually back to the loin (it rose as a tall narrow tent)
    withersFront: 0.15, withersBack: 0.36, humpTop: 1.0, humpN: 2.5, chestNarrow: 0.82, legThk: 1.3, shag: 0.07, maneSlant: 0.9, maneRag: 0.08, maneLegs: 0.4,
    neckAng: -5, neckLen: 0.2, neckThk: 0.95, neckW: 0.95, neckLow: 0.15, headAng: 78, headLen: 0.36, headD: 0.36, headW: 0.38, snout: 0.38, snoutW: 0.75, snoutD: 0.7, stop: 0.1, dome: 1.3, eye: 0.035,
    // (Digital Diorama revision 9: a massive head, its broad forehead matted with hair, and a short shaggy beard)
    crownW: 1.15, browW: 1.15, throat: 0.1,
    ear: { style: 'pointed', len: 0.2, w: 0.5, s: 0.16, a: 1.25, spread: 85, tilt: -10, turn: 40 }, horns: { style: 'cattle', len: 0.22, thk: 0.07, s: 0.1, a: 1.15 },
    tail: { style: 'tuft', len: 0.3, thk: 0.02, set: -70, tuft: 2.5 }, mane: { style: 'none', beard: 0.42, beardW: 0.4 }, frontMane: 0.35, countershade: 0,
    palette: pal({ body: '#5a3d26', belly: '#4f3420', mane: '#2e1f14', horn: '#1e1a17', nose: '#151210' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.bison, withers: 0, },
  gazelle: { label: "Thomson's Gazelle", fam: UNGULATE, marks: { hooks: 0.06, fossa: 0.06, ribs: 0.03, girth: 0.04, breast: 0.05, withers: 0.03 }, hind: { kY: 0.73, kZ: 0.15, aY: 0.5, aZ: -0.12, fY: 0.13, fZ: -0.1, cY: 0.05, wall: 48 }, H: 0.65, len: 1.0, depth: 0.42, width: 0.74, rump: 1.03, tuck: 0.4, neckAng: 52, neckLen: 0.42, neckThk: 0.52,
    headAng: 50, headLen: 0.32, headD: 0.26, headW: 0.24, snout: 0.5, snoutW: 0.5, snoutD: 0.48, stop: 0.15, eye: 0.07, legThk: 0.6,
    ear: { style: 'pointed', len: 0.45, w: 0.45, s: 0.12, a: 0.85, spread: 45 }, horns: { style: 'lyre', len: 0.95, thk: 0.06, s: 0.13, a: 0.32 },
    tail: { style: 'thin', len: 0.2, thk: 0.02, set: -40 }, tailTip: 0.5, flankStripe: true, rumpPatch: true, countershade: 0.6,
    palette: pal({ body: '#c58c4f', belly: '#f3ece0', marking: '#231a14', horn: '#3b302a', nose: '#1d1715' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.cervid, withers: 0, refW: 0.88, refDepth: 0.96, foreBulkR: 0.86, hindBulkR: 0.86, },
  moose: { label: 'Moose', fam: UNGULATE, hind: { kY: 0.72, aY: 0.49, aZ: -0.11, fY: 0.14, fZ: -0.095, cY: 0.055 }, H: 1.9, len: 0.98, depth: 0.45, width: 0.8, rump: 0.92, rumpDepth: 0.9, tuck: 0.15, withers: 0.18, neckAng: 25, neckLen: 0.28, neckThk: 0.8,
    headAng: 62, headLen: 0.36, headD: 0.24, headW: 0.2, snout: 0.62, snoutW: 0.75, snoutD: 0.8, stop: 0.05, roman: 0.9, drop: 0.25, eye: 0.03, legThk: 0.9,
    ear: { style: 'pointed', len: 0.38, w: 0.48, s: 0.12, a: 1.0, spread: 60, tilt: 0 }, horns: { style: 'palmate', len: 0.95, thk: 0.07, s: 0.12, a: 0.65 },
    tail: { style: 'thin', len: 0.06, thk: 0.03, set: -60 }, socks: 0.75, countershade: 0,
    palette: pal({ body: '#3e2b1d', belly: '#a0896d', marking: '#2a1d14', horn: '#c7b086', nose: '#1d1612' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.moose, withers: 0,
    // (revision 10) a rounded hump over the shoulders
    withers: 0.12, humpTop: 0.95, withersFront: 0.18, withersBack: 0.42, },
  reindeer: { label: 'Reindeer', fam: UNGULATE, hind: { kY: 0.72, aY: 0.48, aZ: -0.1, fY: 0.13, fZ: -0.085, cY: 0.05 }, H: 1.1, len: 1.05, depth: 0.5, width: 0.84, rump: 1.0, tuck: 0.15, neckAng: 35, neckLen: 0.35, neckThk: 0.75,
    headAng: 55, headLen: 0.33, headD: 0.25, headW: 0.22, snout: 0.55, snoutW: 0.7, snoutD: 0.6, stop: 0.08, eye: 0.045, legThk: 0.95, pawW: 1.2,
    ear: { style: 'pointed', len: 0.3, w: 0.5, s: 0.12, a: 0.95, spread: 55 }, horns: { style: 'antlers', len: 1.3, thk: 0.05, s: 0.1, a: 0.42, tines: 5 },
    tail: { style: 'flat', len: 0.12, thk: 0.035, set: -40 }, frontMane: 0.7, maneTop: 0.25, maneHead: false, rumpPatch: true, countershade: 0.3, muzzle: 'dark', muzzleS: 0.6, grain: 1.6,
    palette: pal({ body: '#7a6a58', belly: '#e4dccb', mane: '#ece4d4', marking: '#3d3127', horn: '#d0bc96', nose: '#2b2320' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.cervid, withers: 0, refDepth: 1.12, refLen: 1.08, refW: 1.1, foreBulkR: 1.12, hindBulkR: 1.12, },
  camel: { label: 'Dromedary Camel', fam: { ...UNGULATE, foot: 'pad', nose: 'muzzle', pupil: 'round' }, marks: { hooks: 0.06, fossa: 0.04, girth: 0.03, breast: 0.08 }, hind: { kY: 0.62, kZ: 0.2, aY: 0.5, aZ: -0.07, fY: 0.13, fZ: -0.065, cY: 0.05 }, hindShape: { thighF: 0.07, breech: 0.03, hams: 0, kneeW: 0.05, gaskW: 0.045 }, thighW: 0.24, thighD: 0.24, H: 1.85, len: 0.82, depth: 0.42, width: 0.78, rump: 0.92, tuck: 0.35,
    // (Digital Diorama revision 9: lean, narrow quarters under a croup that falls away behind the hump; they were a deep round mass)
    rumpDepth: 0.7, hipW: 0.85, rumpCap: 0.55, croupSlope: 0.3, humps: [{ u: 0.55, h: 0.2, w: 0.42 }],
    // Digital Diorama revision 7: a long, slender head (it read as a donkey's): domed forehead, heavy brows over large eyes,
    // slit nostrils, and a thick split upper lip hanging over the lower one
    neckAng: 15, neckLen: 0.55, neckThk: 0.48, neckW: 0.6, neckArch: -0.12, headAng: 22, headLen: 0.33, headD: 0.24, headW: 0.2, snout: 0.56, snoutW: 0.52, snoutD: 0.66, muzzleN: 2.3, noseCap: 0.5, stop: 0.18, dome: 1.14, brow: 0.15, eye: 0.055, jaw: 0.6, chin: 0.2, jawEnd: 0.86, lipOver: 0.32, cleft: 0.12, nostrilSlit: 28, nostril: 0.26, nostrilA: 0.5, legThk: 0.72, tibiaSlope: 0.7,
    ear: { style: 'round', len: 0.14, w: 0.8, s: 0.12, a: 0.8, spread: 40, innerW: 0.4 }, tail: { style: 'tuft', len: 0.3, thk: 0.018, set: -80, tuft: 1.6 }, countershade: 0.1,
    palette: pal({ body: '#c9a06b', belly: '#d6b585', mane: '#8a6438', hoof: '#5a4a3a', nose: '#4a3a30', skin: '#a88458' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.camelid, withers: 0,
    // (revision 10) a lean thigh hanging free of the body
    hindBulkR: 0.8, },
  llama: { label: 'Llama', fam: UNGULATE, hind: { kY: 0.7, aY: 0.47, aZ: -0.08, fY: 0.12, fZ: -0.06, cY: 0.05 }, H: 1.15, len: 0.95, depth: 0.5, width: 0.82, rump: 1.0, tuck: 0.15, neckAng: 78, neckLen: 0.62, neckThk: 0.55, neckW: 0.7,
    headAng: 30, headLen: 0.3, headD: 0.26, headW: 0.24, snout: 0.45, snoutW: 0.55, snoutD: 0.6, stop: 0.25, eye: 0.06, legThk: 0.85, wool: 0.05,
    ear: { style: 'long', len: 0.52, w: 0.38, s: 0.1, a: 0.5, spread: 18, tilt: 0, turn: 30, droop: 0.15 }, tail: { style: 'fluffy', len: 0.2, thk: 0.05, set: 30 },
    countershade: 0, palette: pal({ body: '#efe3cc', belly: '#efe3cc', marking: '#7a5a3a', nose: '#3a2b24' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.llama, withers: 0, },
  rhino: { label: 'White Rhinoceros', fam: { stance: 'graviportal', nose: 'muzzle', pupil: 'round', nails: 3 }, keel: 0.2, waist: 0.02, hind: { kY: 0.55, kZ: 0.12, aY: 0.25, aZ: -0.05 }, H: 1.7, len: 1.45, depth: 0.62, width: 0.92, rump: 0.96, tuck: 0.05, belly: 0.3, withers: 0.25,
    neckAng: 0, neckLen: 0.18, neckThk: 0.95, neckW: 0.9, headAng: 55, headLen: 0.48, headD: 0.26, headW: 0.24, snout: 0.5, snoutW: 0.9, snoutD: 0.7, stop: 0, dome: 0.9, eye: 0.02, eyeYaw: 80, legThk: 1.25,
    ear: { style: 'pointed', len: 0.26, w: 0.42, s: 0.08, a: 0.55, spread: 30, tilt: 0, turn: 30, cup: 0.9 }, horns: { style: 'rhino', len: 0.75, thk: 0.09 },
    tail: { style: 'tuft', len: 0.3, thk: 0.03, set: -80, tuft: 1.6 }, countershade: 0,
    palette: pal({ body: '#8a847c', belly: '#827c74', horn: '#6a6058', hoof: '#57514b', skin: '#7a6e68', nose: '#4a4440' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.rhino, withers: 0, },
  hippo: { label: 'Hippopotamus', fam: { stance: 'graviportal', nose: 'muzzle', pupil: 'round', nails: 4 }, marks: { breast: 0.03 }, keel: 0.05, waist: 0, hind: { kY: 0.5, kZ: 0.12, aY: 0.22, aZ: -0.04 }, H: 1.5, len: 1.55, depth: 0.72, width: 1.05, rump: 1.0, tuck: 0, belly: 0.3,
    neckAng: 5, neckLen: 0.12, neckThk: 1.0, neckW: 0.95, headAng: 22, headLen: 0.6, headD: 0.42, headW: 0.4, snout: 0.52, snoutW: 1.25, snoutD: 1.0, muzzleN: 3.2, noseCap: 0.3, stop: 0.45, dome: 0.85, jaw: 0.85, jawW: 0.92, mouthS: 0.5, eye: 0.045, eyeYaw: 40, eyeEl: 58, turret: true, legThk: 1.4, nostrilA: 1.1,
    ear: { style: 'round', len: 0.1, w: 1.0, s: 0.1, a: 0.6 }, tail: { style: 'flat', len: 0.18, thk: 0.04, set: -70, flat: 2 }, countershade: 0.3,
    palette: pal({ body: '#6e605e', belly: '#c49088', skin: '#c49088', nose: '#4a3e3c', mouth: '#c47a78' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.hippo, withers: 0, },
  boar: { label: 'Wild Boar', fam: UNGULATE, marks: { breast: 0.04 }, keel: 0.15, waist: 0, hind: { kY: 0.66, kZ: 0.17, aY: 0.4, aZ: -0.06, fY: 0.13, fZ: -0.035, cY: 0.05 }, H: 0.85, len: 1.25, depth: 0.64, width: 0.75, rump: 0.86, rumpDepth: 0.9, tuck: 0.1, withers: 0.24, chestW: 1.08,
    // Digital Diorama revision 7: high, rounded shoulders under the bristle crest (the withers rose to a sharp peak)
    withersFront: 0.32, withersBack: 0.4, humpTop: 0.92, humpN: 2.4, neckAng: 5, neckLen: 0.08, neckThk: 0.95, neckW: 0.95,
    // a deep wedge of a head (it was a thin tube), slender legs a little stouter
    headAng: 35, headLen: 0.52, headD: 0.32, headW: 0.3, snout: 0.6, snoutW: 0.4, snoutD: 0.4, stop: 0.0, dome: 0.85, jowl: 1.3, eye: 0.025, nose: 'disc', muzzleN: 2.6, legThk: 1.3,
    ear: { style: 'pointed', len: 0.28, w: 0.55, s: 0.14, a: 0.75, spread: 35, tilt: 10 }, tusks: { style: 'boar', len: 0.08, thk: 0.15, s: 0.85, a: 0.95 },
    tail: { style: 'tuft', len: 0.3, thk: 0.012, set: -70, tuft: 2.2 }, mane: { style: 'crest', h: 0.06, back: 0.55 }, countershade: 0,
    palette: pal({ body: '#4a3a2e', belly: '#3e3026', mane: '#241c16', nose: '#3a2e28', hoof: '#1d1814' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.boar, withers: 0,
    // (revision 10) a rounded hump over the shoulders
    withers: 0.07, humpTop: 0.95, withersFront: 0.2, withersBack: 0.4, },
  anteater: { label: 'Giant Anteater', fam: { stance: 'plantigrade', nose: 'pad', claws: 2.2, toes: 4 }, hind: { kY: 0.5, kZ: 0.1, foot: 0.3 }, H: 0.75, len: 1.5, depth: 0.55, width: 0.65, rump: 1.02, tuck: 0.05, neckAng: 15, neckLen: 0.38, neckThk: 0.7,
    headAng: 25, headLen: 0.5, headD: 0.14, headW: 0.16, snout: 0.78, snoutW: 0.35, snoutD: 0.4, stop: 0, eye: 0.022, legThk: 1.1,
    ear: { style: 'round', len: 0.1, w: 1.0, s: 0.12, a: 0.9 }, tail: { style: 'hair', len: 0.75, thk: 0.07, set: -10, hair: 1.15, hairW: 5, hairBack: 0.9 }, pattern: 'anteater', countershade: 0, grain: 2,
    palette: pal({ body: '#5e4e3e', belly: '#d9cfbd', pattern: '#121010', mane: '#4a3c30', nose: '#121010' }),
    // Digital Diorama revision 10: built from its measured reference (see MEASURED LAYOUTS)
    ref: REF.anteater,
    // (revision 10) the long-haired tail carried low, its hair hanging toward the ground
    tail: { style: 'hair', len: 0.8, thk: 0.07, set: -8, hair: 0.85, hairW: 5.5, hairBack: 1.1 }, },
  // Digital Diorama revision: a low, rounded body on short legs (it stood on stilts)
  mouse: { label: 'House Mouse', fam: RODENT, hind: { kZ: 0.3, aZ: -0.15, foot: 0.66 }, H: 0.03, len: 2.1, depth: 0.86, width: 0.85, rump: 1.25, rumpDepth: 1.1, tuck: 0.1, neckAng: 30, neckLen: 0.16, neckThk: 0.9, legThk: 1.15,
    headAng: 20, headLen: 0.55, headD: 0.32, headW: 0.38, snout: 0.45, snoutW: 0.35, snoutD: 0.38, stop: 0.15, eye: 0.09,
    ear: { style: 'round', len: 0.48, w: 0.95, s: 0.22, a: 0.6, spread: 30, tilt: 8, cup: 0.35 }, tail: { style: 'thin', len: 2.0, thk: 0.012, set: -10, curl: 18 },
    countershade: 0.4, palette: pal({ body: '#8d8478', belly: '#c9c0b2', skin: '#e2a8a0', nose: '#e2a8a0', eye: '#0c0a09' }),
    // Digital Diorama revision 11: laid out from the measured crouching rodent (the rabbit's reference: haunches high and
    // round, forelegs short under the chest, long hind feet flat on the ground); it was a long, low slug of a body
    ref: REF.mouse, H: 0.024, headLen: 1.0, headAng: 10, headD: 0.5, headW: 0.56, neckCapW: 1.0, snout: 0.42, snoutW: 0.42, snoutD: 0.46, eye: 0.1,
    ear: { style: 'round', len: 0.6, w: 1.05, s: 0.22, a: 0.62, spread: 32, tilt: 8, cup: 0.35 } },
};
const SPECIES = Object.fromEntries(Object.entries(SPECIES_DEFS).map(([k, v]) => {
  const { fam, ...own } = v;
  return [k, mergeDeep(mergeDeep(DEF, fam || {}), own)];
}));
const SPECIES_KEYS = Object.keys(SPECIES);

/** Applies user proportions / style overrides to a species spec (true rebuilds, never uniform scaling). */
function specFor(base, p) {
  // Digital Diorama extension: `specOverride` deep-merges anatomy/palette changes onto the preset
  // (e.g. a Bactrian camel's second hump), so related species can share one rig.
  if (p.specOverride && typeof p.specOverride === 'object') base = mergeDeep(base, p.specOverride);
  const S = mergeDeep(base, {});
  S.ear = { ...base.ear }; S.tail = { ...base.tail };
  const juv = p.age === 'juvenile';
  S.H = base.H * p.size * (juv ? 0.55 : 1) * p.legLen ** 0.5;
  S.depth = base.depth / Math.sqrt(p.legLen);
  S.len = base.len * p.bodyLen / Math.sqrt(p.legLen);
  S.neckLen = base.neckLen * p.neckLen;
  S.headLen = base.headLen * p.headSize * (juv ? 1.3 : 1) * Math.sqrt(p.legLen);
  S.snout = clamp(base.snout * p.muzzleLen * (juv ? 0.8 : 1), 0.15, 0.85);
  S.eye = base.eye * (juv ? 1.25 : 1);
  S.ear.len = base.ear.len * p.earSize * (juv ? 1.15 : 1);
  if (p.earStyle !== 'species') S.ear.style = p.earStyle;
  S.tail.len = (base.tail.len || 0) * p.tailLen;
  if (p.tailStyle !== 'species') { S.tail.style = p.tailStyle; if (!S.tail.len) S.tail.len = 0.4; if (!S.tail.thk && !S.tail.match) S.tail.thk = 0.03; }
  if (p.coatPattern !== 'species') S.pattern = p.coatPattern;
  if (p.countershading >= 0) S.countershade = p.countershading;
  S.seed = p.seed;
  if (juv) { S.horns = S.horns ? { ...S.horns, len: S.horns.len * 0.3 } : S.horns; S.tusks = null; S.mane = S.mane && S.mane.style === 'lion' ? null : S.mane; }
  if (!p.showHorns) S.horns = null;
  if (!p.showTusks) S.tusks = null;
  if (S.wool) S.bumpFn = (u, a) => S.wool * (fbm(Math.cos(a) * 4 + u * 9, Math.sin(a) * 4, u * 7, 5) - 0.5) * 2;
  return S;
}

/* ════════════════════════════════════════════════════════════════════════════
 *  EXPORTED METADATA
 * ════════════════════════════════════════════════════════════════════════════ */
export const COLORWAYS = colorwaysFor(BASE);
export const presets = COLORWAYS;
export const species = Object.fromEntries(SPECIES_KEYS.map(k => [k, SPECIES[k].label]));
export const POSES = ['stand', 'idle', 'walk', 'trot', 'gallop', 'graze', 'alert', 'roar', 'sit'];

export const params = withZones({
  species: { type: 'choice', default: 'horse', options: SPECIES_KEYS, label: 'Species', affects: 'geometry', describe: 'Species preset (43 mammals).' },
  colorway: { type: 'choice', default: 'natural', options: COLORWAY_KEYS, label: 'Colourway', affects: 'colors', describe: 'Role-aware transform of the species palette.' },
  detail: { type: 'choice', default: 'standard', options: Object.keys(DETAIL), label: 'Detail', affects: 'geometry', describe: 'Loft resolution (draft / standard / high).' },
  rigMode: { type: 'choice', default: 'skinned', options: ['skinned', 'static'], label: 'Rig mode', affects: 'geometry', describe: 'Skinned meshes with a skeleton, or pose baked into static geometry.' },
  pose: { type: 'choice', default: 'stand', options: POSES, label: 'Pose', affects: 'geometry', describe: 'Rest pose or a frozen frame of a clip.' },
  posePhase: { type: 'range', default: 0.25, min: 0, max: 1, step: 0.01, label: 'Pose phase', affects: 'geometry', describe: 'Clip phase used for the frozen pose.' },
  size: { type: 'range', default: 1, min: 0.5, max: 1.6, step: 0.01, label: 'Size', affects: 'geometry', describe: 'Overall body scale (rebuilds every station).' },
  age: { type: 'choice', default: 'adult', options: ['adult', 'juvenile'], label: 'Age', affects: 'geometry', describe: 'Juveniles: smaller, bigger head, eyes and ears, no tusks / mane.' },
  bodyLen: { type: 'range', default: 1, min: 0.75, max: 1.35, step: 0.01, label: 'Body length', affects: 'geometry', describe: 'Torso length multiplier.' },
  legLen: { type: 'range', default: 1, min: 0.7, max: 1.4, step: 0.01, label: 'Leg length', affects: 'geometry', describe: 'Leg length vs body depth.' },
  neckLen: { type: 'range', default: 1, min: 0.5, max: 1.6, step: 0.01, label: 'Neck length', affects: 'geometry', describe: 'Neck length multiplier.' },
  headSize: { type: 'range', default: 1, min: 0.75, max: 1.35, step: 0.01, label: 'Head size', affects: 'geometry', describe: 'Skull length multiplier.' },
  muzzleLen: { type: 'range', default: 1, min: 0.6, max: 1.5, step: 0.01, label: 'Muzzle length', affects: 'geometry', describe: 'Snout fraction of the skull.' },
  earSize: { type: 'range', default: 1, min: 0.5, max: 1.8, step: 0.01, label: 'Ear size', affects: 'geometry', describe: 'Pinna length multiplier.' },
  earStyle: { type: 'choice', default: 'species', options: ['species', ...Object.keys(EAR_PROFILES)], label: 'Ear style', affects: 'geometry', describe: 'Ear outline / carriage override.' },
  tailLen: { type: 'range', default: 1, min: 0, max: 2, step: 0.01, label: 'Tail length', affects: 'geometry', describe: 'Tail length multiplier.' },
  tailStyle: { type: 'choice', default: 'species', options: ['species', 'thin', 'bushy', 'tuft', 'hair', 'flat', 'fluffy', 'curly', 'none'], label: 'Tail style', affects: 'geometry', describe: 'Tail style override.' },
  coatPattern: { type: 'choice', default: 'species', options: ['species', 'none', 'stripes', 'tiger', 'spots', 'hyena', 'rosettes', 'giraffe', 'patches', 'panda', 'raccoon', 'badger', 'tabby', 'anteater', 'chipmunk'], label: 'Coat pattern', affects: 'colors', describe: 'Coat pattern override.' },
  countershading: { type: 'range', default: -1, min: -1, max: 1, step: 0.01, label: 'Countershading', affects: 'colors', describe: '-1 keeps the species value; 0..1 sets how far the light belly climbs the flank.' },
  seed: { type: 'range', default: 7, min: 1, max: 999, step: 1, label: 'Variation seed', affects: 'colors', describe: 'Seed for spots, stripes and quills.' },
  showHorns: { type: 'toggle', default: true, label: 'Horns / antlers', affects: 'geometry', describe: 'Build horns, antlers and ossicones.' },
  showTusks: { type: 'toggle', default: true, label: 'Tusks', affects: 'geometry', describe: 'Build tusks.' },
  coat: { type: 'toggle', default: true, label: 'Painted coat', affects: 'colors', describe: 'Paint markings into a coat texture (crisp stripes, spots and patch edges); off: one colour per mesh face.' },
  coatGrain: { type: 'range', default: 0.06, min: 0, max: 0.25, step: 0.01, label: 'Coat grain', affects: 'colors', describe: 'Faint tonal variation in fur or feathers (painted coat only).' },
  shading: { type: 'choice', default: 'smooth', options: ['smooth', 'flat'], label: 'Shading', affects: 'geometry', describe: 'Smooth, rounded shading or flat low-poly facets.' },
  hide: { type: 'text', default: '', label: 'Hide parts', affects: 'geometry', describe: 'Comma list of detachable parts to omit (see `detach`).' },
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'One mesh per material (1-2 draw calls) instead of one selectable mesh per anatomical part.' },
}, ZONE_LABELS, BASE);

export const rig = {
  Hips: { axis: 'x', range: [-30, 20], describe: 'pelvis pitch (sit / rear)' },
  Spine1: { axis: 'x', range: [-15, 15] }, Spine2: { axis: 'x', range: [-15, 15] }, Chest: { axis: 'x', range: [-20, 15] },
  Neck1: { axis: 'x', range: [-30, 45], describe: 'neck raise / lower' }, Neck2: { axis: 'x', range: [-25, 35] },
  Head: { axis: 'x', range: [-35, 40], describe: 'nod' }, Jaw: { axis: 'x', range: [0, 35], describe: 'mouth open' },
  EarL: { axis: 'z', range: [-30, 30], describe: 'ear swivel' }, EarR: { axis: 'z', range: [-30, 30] },
  ScapulaL: { axis: 'x', range: [-25, 25] }, ArmL: { axis: 'x', range: [-50, 40] }, ForearmL: { axis: 'x', range: [0, 120] }, HandL: { axis: 'x', range: [-20, 90] },
  ThighL: { axis: 'x', range: [-60, 40] }, ShinL: { axis: 'x', range: [-20, 120] }, FootL: { axis: 'x', range: [-90, 30] },
  Tail1: { axis: 'y', range: [-30, 30], describe: 'tail swish' }, Trunk1: { axis: 'x', range: [-40, 60], describe: 'trunk curl' },
};
export const detach = ['horns', 'tusks', 'trunk', 'mane', 'tail', 'ears', 'eyes', 'eyelids', 'nose', 'teeth', 'spines', 'jaw', 'feet', 'udder'];
export const night = { eye: { color: '#9cff6a', intensity: 0.35, describe: 'tapetum eyeshine on the iris zone' } };

/* ════════════════════════════════════════════════════════════════════════════
 *  CLIPS & POSES (Digital Diorama revision 4: rewritten)
 *  The old gaits swung every joint on a sine wave, so feet slid, dipped below the ground and never planted,
 *  and every species moved alike. Now each foot follows a path — planted and carried back at body speed in
 *  stance, lifted and swung forward in swing, the hoof breaking over at push-off and flipping in the swing —
 *  and each leg is solved to reach it: hind legs as a pantograph (the cannon / rear pastern stays parallel to
 *  the thigh, as in real legs), forelegs swinging the shoulder blade with the forearm and keeping the knee
 *  straight in stance. Footfalls follow each family's real gaits (lateral walk; trot, or pace for camels and
 *  giraffes; transverse or rotary gallop; half-bound for rabbits, squirrels and mustelids; an amble for
 *  elephants), the body vaults over walking legs and bounces on running ones, and the spine flexes in gallops
 *  and bounds. Clips are timed by dynamic similarity (the Froude number, from hip height), and each gait clip
 *  records its stride so playback can match ground speed. Idle, graze, alert and roar keep the feet planted;
 *  sit is a sit for carnivores and rodents and lying down for hoofed animals and elephants.
 * ════════════════════════════════════════════════════════════════════════════ */
/* Digital Diorama revision 4: clips rewritten (see CLIPS & POSES above).
 * Footfall patterns: phase of each foot's touchdown in the cycle (LH = left hind …), duty = fraction of the
 * cycle a foot is on the ground (number, or { hind, front }), lambda = distance travelled per cycle in hip
 * heights, fr = Froude number v² / (g·h) the clip is timed for, lift = swing height (× hip height),
 * bob = body rise and fall (× hip height), spine = spine flexion in degrees (bounds and gallops), and the
 * hoof / paw motion: sink (fetlock giving under load), roll (breakover at push-off), toe (digit flexion in
 * swing), flexH / flexF (hock / knee flexion in swing), heel (plantigrade heel lift). */
const GAIT_LIB = {
  // lateral-sequence walk: left hind, left fore, right hind, right fore, a quarter cycle apart (timed as a relaxed,
  // grazing pace; faster walking plays it quicker)
  walk: { ph: { LH: 0, LF: 0.25, RH: 0.5, RF: 0.75 }, duty: 0.66, lambda: 1.3, fr: 0.14, lift: 0.075, bob: 0.012, run: false, sink: 6, roll: 22, toe: 45, flexH: 34, flexF: 52, heel: 30 },
  // camels, llamas and giraffes walk with the legs of one side almost together
  paceWalk: { ph: { LH: 0, LF: 0.12, RH: 0.5, RF: 0.62 }, duty: 0.64, lambda: 1.3, fr: 0.14, lift: 0.07, bob: 0.012, run: false, sink: 6, roll: 20, toe: 40, flexH: 32, flexF: 50, heel: 30 },
  // diagonal pairs together, a moment of suspension between them
  trot: { ph: { LH: 0, RF: 0, RH: 0.5, LF: 0.5 }, duty: 0.42, lambda: 2.15, fr: 1.0, lift: 0.15, bob: 0.028, run: true, sink: 12, roll: 28, toe: 65, flexH: 50, flexF: 88, heel: 38 },
  // the legs of one side together (camels, giraffes, llamas)
  pace: { ph: { LH: 0, LF: 0, RH: 0.5, RF: 0.5 }, duty: 0.45, lambda: 2.15, fr: 0.9, lift: 0.13, bob: 0.024, run: true, sink: 10, roll: 26, toe: 55, flexH: 45, flexF: 75, heel: 35 },
  // elephants never leave the ground: a fast lateral-sequence walk with shorter stance
  amble: { ph: { LH: 0, LF: 0.22, RH: 0.5, RF: 0.72 }, duty: 0.52, lambda: 1.8, fr: 0.55, lift: 0.07, bob: 0.014, run: false, sink: 3, roll: 14, toe: 20, flexH: 30, flexF: 45, heel: 20 },
  // transverse gallop (horses, cattle, rhinos): hinds then fores, the leading leg on the same side
  transverse: { ph: { LH: 0, RH: 0.12, LF: 0.42, RF: 0.54 }, duty: { hind: 0.3, front: 0.3 }, lambda: 3.0, fr: 4, lift: 0.2, bob: 0.045, run: true, spine: 3, sink: 16, roll: 32, toe: 80, flexH: 62, flexF: 100, heel: 40 },
  // rotary gallop (cats, dogs, deer, antelope): the lead changes side between hinds and fores; big spine flexion
  rotary: { ph: { LH: 0, RH: 0.1, RF: 0.44, LF: 0.54 }, duty: { hind: 0.28, front: 0.26 }, lambda: 3.3, fr: 4, lift: 0.22, bob: 0.05, run: true, spine: 10, sink: 14, roll: 30, toe: 70, flexH: 60, flexF: 95, heel: 40 },
  // half-bound (rabbits, squirrels, mice, otters): hind feet land together, fore feet one after the other
  bound: { ph: { LH: 0, RH: 0.03, LF: 0.5, RF: 0.6 }, duty: { hind: 0.3, front: 0.26 }, lambda: 3.0, fr: 3, lift: 0.2, bob: 0.06, run: true, spine: 16, sink: 0, roll: 30, toe: 40, flexH: 55, flexF: 70, heel: 45 },
  // a slow hop (rabbits and squirrels rarely walk): fore feet in turn, hind feet together
  hop: { ph: { LH: 0, RH: 0.02, LF: 0.45, RF: 0.62 }, duty: { hind: 0.52, front: 0.42 }, lambda: 1.25, hindO: -0.1, fr: 0.25, lift: 0.1, bob: 0.03, run: true, spine: 7, sink: 0, roll: 22, toe: 30, flexH: 40, flexF: 50, heel: 40 },
};
/** How each kind of foot rolls, sinks and flexes (multipliers on the gait's hoof values). */
const FOOT_MOTION = {
  hoof: { sink: 0, roll: 1, toe: 1 }, cloven: { sink: 0, roll: 1, toe: 0.9 },
  paw: { sink: 0, roll: 0.9, toe: 0.55 }, sole: { sink: 0, roll: 0.55, toe: 0.4 }, pad: { sink: 0, roll: 0.45, toe: 0.3 },
};
/** Gaits of each family: which footfall pattern each clip uses (null = no such clip). */
function gaitSetFor(S, p) {
  const st = S.stance, sp = p.species;
  if (S.gaits) return S.gaits;
  if (st === 'graviportal') return sp === 'rhino' ? { walk: 'walk', trot: 'trot', gallop: 'transverse' } : { walk: 'walk', trot: 'amble', gallop: null };
  if (sp === 'camel' || sp === 'llama' || sp === 'giraffe') return { walk: 'paceWalk', trot: 'pace', gallop: sp === 'giraffe' ? 'rotary' : 'transverse' };
  if (S.crouch >= 0.5 && st === 'digitigrade') return sp === 'mouse' ? { walk: 'walk', trot: 'trot', gallop: 'bound' } : { walk: 'hop', trot: 'hop', gallop: 'bound' };
  if (sp === 'hedgehog') return { walk: 'walk', trot: 'trot', gallop: null };
  if (sp === 'otter' || sp === 'beaver' || sp === 'badger') return { walk: 'walk', trot: 'trot', gallop: 'bound' };
  if (st === 'ungulate') return { walk: 'walk', trot: 'trot', gallop: ['deer', 'gazelle', 'reindeer', 'moose', 'goat', 'bighorn'].includes(sp) ? 'rotary' : 'transverse' };
  return { walk: 'walk', trot: 'trot', gallop: 'rotary' };
}
// (Digital Diorama revision 7: elephants walk with short steps and hardly bob; their columnar legs could only follow the
// standard strides by sinking the body a quarter of a metre)
const GAIT_TUNE = { cheetah: { gallop: { lambda: 3.8, spine: 15, bob: 0.04 } }, rabbit: { trot: { lambda: 2.2, fr: 0.7 }, gallop: { lambda: 2.6 } }, squirrel: { trot: { lambda: 2.2, fr: 0.7 } },
  // (Digital Diorama revision 8: walk duty 0.65 and an amble that never leaves the ground (duty 0.55); short, slow steps (a
  // pillar leg cannot lengthen, so long ones made the body sink and the other legs fold); each foot's stance centred under
  // its girdle; the feet lifted ~0.06 of the height; the carpus folding back in the swing)
  elephant: { walk: { lambda: 0.85, fr: 0.09, duty: 0.65, lift: 0.09, bob: 0.008, hindO: -0.12, frontO: 0.05, flexF: 55, flexH: 12, dropK: 4 }, trot: { lambda: 1.15, fr: 0.4, duty: 0.55, lift: 0.09, bob: 0.02, hindO: -0.1, frontO: 0.05, flexF: 62, flexH: 16, dropK: 5 } }, otter: { walk: { lift: 0.1 } } };
const RIGS = new WeakMap();

/* ── planar helpers in a bone's (z, y) plane: ψ = atan2(z, y); a rotation about +X by δ adds δ to ψ ── */
const v2 = (z, y) => ({ z, y });
const P2 = (v) => ({ z: v.z, y: v.y });
const add2 = (a, b) => v2(a.z + b.z, a.y + b.y), sub2 = (a, b) => v2(a.z - b.z, a.y - b.y), sc2 = (a, k) => v2(a.z * k, a.y * k);
const len2 = (a) => Math.hypot(a.z, a.y), psi2 = (a) => Math.atan2(a.z, a.y), unit2 = (p) => v2(Math.sin(p), Math.cos(p));
const rot2 = (a, d) => { const c = Math.cos(d), s = Math.sin(d); return v2(a.z * c + a.y * s, a.y * c - a.z * s); };
const cross2 = (a, b) => a.z * b.y - a.y * b.z;
const wrapA = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
/** Two-bone IK: the middle joint for root R and target T, bone lengths a and b, on side `side` of R→T. */
function ik2(R, T, a, b, side) {
  const d0 = sub2(T, R), L = Math.max(1e-9, len2(d0)), d = clamp(L, Math.abs(a - b) + 1e-6, a + b - 1e-6);
  const A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)), base = psi2(d0);
  const m1 = add2(R, sc2(unit2(base + A), a)), m2 = add2(R, sc2(unit2(base - A), a));
  return Math.sign(cross2(d0, sub2(m1, R))) === side ? m1 : m2;
}

/** World (model-space) matrices of bones for a sample, memoised per call. */
function fkOf(info, s) {
  const M = {};
  const get = (b) => {
    if (M[b]) return M[b];
    const v = s[b], r = !v ? null : Array.isArray(v) ? v : v.r, p = v && !Array.isArray(v) ? v.p : null, rest = info.rest[b];
    _e.set((r ? r[0] : 0) * DEG, (r ? r[1] : 0) * DEG, (r ? r[2] : 0) * DEG, 'YXZ');
    const local = new THREE.Matrix4().compose(V3(rest[0] + (p ? p[0] : 0), rest[1] + (p ? p[1] : 0), rest[2] + (p ? p[2] : 0)), new THREE.Quaternion().setFromEuler(_e), V3(1, 1, 1));
    const par = info.parent[b];
    M[b] = par ? get(par).clone().multiply(local) : local;
    return M[b];
  };
  return get;
}

/**
 * Digital Diorama revision 7: keeps a foot on its line across the body. Legs are solved in their girdle's (z, y) plane, so a
 * rolling pelvis, a turning spine or a body swaying over its feet (walks) carried planted feet sideways, 5-15 cm a step,
 * and tipped them onto their edges. The leg now abducts at the hip (hind) or shoulder (fore) just enough to bring the foot
 * back over its mark, and the foot is turned back level about the direction of travel.
 */
function keepOnLine(info, lm, target, s) {
  const b = lm.bones, rb = lm.front ? b[1] : b[0], last = b[b.length - 1];
  if (!rb || !info.has[rb] || !info.has[last]) return;
  const fk = fkOf(info, s), par = info.parent[rb];
  const tipW = lm.tip.clone().sub(info.headV[last]).applyMatrix4(fk(last));
  const v = tipW.applyMatrix4(fk(rb).clone().invert());            // the foot in the abducting bone's own frame
  const X = target.clone().applyMatrix4(fk(par).clone().invert()).x - info.rest[rb][0];
  const rho = Math.hypot(v.x, v.y);
  if (rho < 1e-6) return;
  // x in the parent's frame after a turn φ about the bone's z axis (applied first in its YXZ euler): v.x cos φ − v.y sin φ
  const beta = Math.atan2(v.y, v.x), ac = Math.acos(clamp(X / rho, -1, 1));
  const p1 = wrapA(ac - beta), p2 = wrapA(-ac - beta), phi = Math.abs(p1) < Math.abs(p2) ? p1 : p2;
  if (!(Math.abs(phi) < 0.3)) return;
  addRot(info, s, rb, [0, 0, phi / DEG]);
  const up = V3(0, 1, 0).applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(fkOf(info, s)(last)));
  addRot(info, s, last, [0, 0, Math.atan2(up.x, up.y) / DEG]);
}

/**
 * Solves one leg so its ground contact (hoof toe, toe tips or sole) reaches target T.c (model space), and adds
 * the bone rotations to sample s. T: { c, toe, heel, flex } in degrees — toe: the hoof / toes rotated backward
 * (flexion; negative = fetlock sinking under load), heel: plantigrade heel lift, flex: extra hock / knee flexion.
 * Hind legs work as a pantograph (the cannon / rear pastern keeps parallel to the thigh); forelegs swing the
 * shoulder blade with the forearm and keep the knee (carpus) straight unless flexed.
 */
function solveLeg(info, fk, lm, T, s, lateral = true) {
  const par = lm.front ? 'Chest' : 'Hips', M = fk(par), inv = M.clone().invert(), ph = info.headV[par];
  const up = V3(0, 1, 0).transformDirection(M), theta = Math.atan2(up.z, up.y);
  const J = lm.J.map(p => P2(p.clone().sub(ph))), n = J.length, tip = J[n - 1], b = lm.bones;
  const c = T.c ? P2(T.c.clone().applyMatrix4(inv)) : null;
  const toeA = (T.toe || 0) * DEG - theta, heelA = (T.heel || 0) * DEG - theta, flexA = (T.flex || 0) * DEG;
  const put = (name, d) => { if (!name || !info.has[name]) return; const v = s[name], arr = !v ? [0, 0, 0] : Array.isArray(v) ? v : v.r; const r = [arr[0] + d / DEG, arr[1], arr[2]]; s[name] = v && !Array.isArray(v) ? { ...v, r } : r; };
  const sole = lm.chain === 'sole';
  if (!lm.front) {
    const H0 = J[0], K0 = J[1], A0 = J[2], D0 = J[3];
    const lf = len2(sub2(K0, H0)), lt = len2(sub2(A0, K0)), lm3 = len2(sub2(D0, A0));
    const pf0 = psi2(sub2(K0, H0)), pt0 = psi2(sub2(A0, K0)), pm0 = psi2(sub2(D0, A0));
    if (sole) {
      const At = sub2(sub2(c, rot2(sub2(tip, D0), toeA)), rot2(sub2(D0, A0), heelA));
      const K = ik2(H0, At, lf, lt, lm.kneeSide), A = add2(K, sc2(unit2(psi2(sub2(At, K))), lt));
      const dF = wrapA(psi2(sub2(K, H0)) - pf0), dT = wrapA(psi2(sub2(A, K)) - pt0);
      put(b[0], dF); put(b[1], dT - dF); put(b[2], heelA - dT); put(b[3], toeA - heelA);
      if (lateral && T.c) keepOnLine(info, lm, T.c, s);
      return Math.max(0, len2(sub2(At, H0)) - (lf + lt) * 0.995);
    }
    if (T.A) {
      // folded (lying): the hock rests where asked, the cannon lies at T.mt, the digit flexed T.toeRel past it
      const At = P2(T.A.clone().applyMatrix4(inv)), K = ik2(H0, At, lf, lt, lm.kneeSide), A = add2(K, sc2(unit2(psi2(sub2(At, K))), lt));
      const dF = wrapA(psi2(sub2(K, H0)) - pf0), dT = wrapA(psi2(sub2(A, K)) - pt0), dM = wrapA(T.mt * DEG - theta - pm0);
      put(b[0], dF); put(b[1], dT - dF); put(b[2], dM - dT); put(b[3], (T.toeRel || 0) * DEG);
      return 0;
    }
    const D = sub2(c, rot2(sub2(tip, D0), toeA));
    let pf = pf0, pm = pm0, K = K0, A = A0, At = A0;
    for (let it = 0; it < 8; it++) {
      pm = T.mt !== undefined ? T.mt * DEG - theta : pm0 + lm.kp * wrapA(pf - pf0) + flexA;
      At = sub2(D, sc2(unit2(pm), lm3));
      K = ik2(H0, At, lf, lt, lm.kneeSide);
      pf = psi2(sub2(K, H0));
      A = add2(K, sc2(unit2(psi2(sub2(At, K))), lt));
    }
    const dF = wrapA(pf - pf0), dT = wrapA(psi2(sub2(A, K)) - pt0), dM = wrapA(pm - pm0);
    put(b[0], dF); put(b[1], dT - dF); put(b[2], dM - dT); put(b[3], wrapA(toeA - dM));
    if (lateral && T.c) keepOnLine(info, lm, T.c, s);
    return Math.max(0, len2(sub2(At, H0)) - (lf + lt) * 0.995);
  }
  // foreleg: shoulder blade (J0 → J1), humerus, radius, metacarpus, digit
  const S0 = J[0], Sh0 = J[1], E0 = J[2], C0 = J[3], D0 = J[4];
  const ls = len2(sub2(Sh0, S0)), lh = len2(sub2(E0, Sh0)), lr = len2(sub2(C0, E0)), lmc = len2(sub2(D0, C0));
  const ps0 = psi2(sub2(Sh0, S0)), ph0 = psi2(sub2(E0, Sh0)), pr0 = psi2(sub2(C0, E0)), pmc0 = psi2(sub2(D0, C0));
  if (T.C) {
    // folded (lying): the knee (carpus) rests where asked, the cannon folds back to T.mc, the digit flexed T.toeRel
    const Ct = P2(T.C.clone().applyMatrix4(inv)), dS = (T.scap || 0) * DEG, Sh = add2(S0, sc2(unit2(ps0 + dS), ls));
    const E = ik2(Sh, Ct, lh, lr, lm.elbowSide), dH = wrapA(psi2(sub2(E, Sh)) - ph0), dR = wrapA(psi2(sub2(Ct, E)) - pr0), dMC = wrapA(T.mc * DEG - theta - pmc0);
    put(b[0], dS); put(b[1], dH - dS); put(b[2], dR - dH); put(b[3], dMC - dR); put(b[4], (T.toeRel || 0) * DEG);
    return 0;
  }
  let target, Lv, beta, carp = 0;
  if (sole) { target = sub2(sub2(c, rot2(sub2(tip, D0), toeA)), rot2(sub2(D0, C0), heelA)); Lv = lr; beta = 0; }
  else {
    target = sub2(c, rot2(sub2(tip, D0), toeA));
    carp = wrapA(pmc0 - pr0) + flexA;
    const vf = add2(unit2(0), sc2(unit2(carp), lmc / lr));
    Lv = len2(vf) * lr; beta = psi2(vf);
  }
  // the shoulder blade swings with the forearm (kept within ±12°: a short forearm would otherwise wind it round),
  // turning about a point part way down the blade as it glides over the ribs, so the shoulder does not rise as it reaches
  const blade = (d) => clamp(lm.ks * d, -0.21, 0.21), pivot = add2(S0, sc2(sub2(Sh0, S0), 0.45));
  // (Digital Diorama revision 7: the blade is posed at the angle that placed the shoulder for the final elbow; it was posed
  // from the next estimate, so where the iteration had not settled (touchdown) blade, arm and forearm disagreed and the foot
  // missed its mark by up to a few centimetres. The estimate is also damped so that it settles.)
  let dR = 0, Sh = Sh0, E = E0, pr = pr0, dS = 0;
  for (let it = 0; it < 10; it++) {
    dS = blade(dR);
    Sh = add2(pivot, rot2(sub2(Sh0, pivot), dS));
    E = ik2(Sh, target, lh, Lv, lm.elbowSide);
    pr = psi2(sub2(target, E)) - beta;
    dR = lerp(dR, wrapA(pr - pr0), it < 2 ? 1 : 0.6);
  }
  dR = wrapA(pr - pr0);
  const dH = wrapA(psi2(sub2(E, Sh)) - ph0);
  put(b[0], dS); put(b[1], dH - dS); put(b[2], dR - dH);
  if (info.has[b[0]]) { const top = sub2(add2(pivot, rot2(sub2(S0, pivot), dS)), S0), v = s[b[0]]; s[b[0]] = { r: Array.isArray(v) ? v : v.r, p: [0, top.y, top.z] }; }
  if (sole) { put(b[3], heelA - dR); put(b[4], toeA - heelA); }
  else { const dMC = wrapA(pr + carp - pmc0); put(b[3], dMC - dR); put(b[4], wrapA(toeA - dMC)); }
  if (lateral && T.c) keepOnLine(info, lm, T.c, s);
  return Math.max(0, len2(sub2(target, Sh)) - (lh + Lv) * 0.995);
}

/** Foot path through one cycle: planted and carried back at body speed in stance, lifted and swung forward. */
function footTrack(G, lm, u, h, fm) {
  const key = (lm.side > 0 ? 'L' : 'R') + (lm.front ? 'F' : 'H');
  const duty = typeof G.duty === 'number' ? G.duty : G.duty[lm.front ? 'front' : 'hind'];
  const ph = fract(u - G.ph[key] + 1);
  const S = G.lambda * h * duty, roll = G.roll * fm.roll, flex = lm.front ? G.flexF : G.flexH, o = S * (lm.front ? (G.frontO ?? -0.12) : (G.hindO ?? 0.04));
  if (ph < duty) {
    const s = ph / duty;
    return { dz: o + S * (0.5 - s), dy: 0, toe: -G.sink * fm.sink * Math.sin(Math.PI * s) + roll * sstep(0.7, 1, s), heel: G.heel * sstep(0.55, 1, s), flex: 0, load: Math.sin(Math.PI * s) };
  }
  // Digital Diorama revision 7: the swing starts and ends moving back with the ground (swing-leg retraction), so the foot
  // lifts off and sets down nearly vertically; with zero speed at both ends relative to the body, it skidded forward at
  // the body's speed for its last centimetre above the ground (the end slope is capped, so runs overshoot at most ~7 %)
  const s = (ph - duty) / (1 - duty), m = -Math.min((1 - duty) / duty, 1.4) * (G.retract ?? 1);
  const e = 3 * s * s - 2 * s * s * s + m * (2 * s * s * s - 3 * s * s + s);
  const toe = (roll + (G.toe * fm.toe - roll) * sstep(0, 0.3, s)) * (1 - sstep(0.55, 0.95, s));
  // (Digital Diorama revision 7: the foot leaves and meets the ground a little more crisply: exponent 1, was 1.3)
  return { dz: o + S * (-0.5 + e), dy: G.lift * h * Math.sin(Math.PI * Math.pow(s, 0.8)), toe, heel: G.heel * (1 - sstep(0.35, 0.85, s)), flex: flex * Math.sin(Math.PI * s), load: 0 };
}

/** Adds rotations to a bone in a sample ([rx, ry, rz] degrees). */
function addRot(info, s, b, r) {
  if (!info.has[b]) return;
  const v = s[b], cur = !v ? [0, 0, 0] : Array.isArray(v) ? v : v.r, nr = [cur[0] + r[0], cur[1] + r[1], cur[2] + r[2]];
  s[b] = v && !Array.isArray(v) ? { ...v, r: nr } : nr;
}
const rootAt = (s, p, r = [0, 0, 0]) => { s.Root = { r, p }; };
/** Turns the whole spine so the chest rises by dy (pivot at the hips). */
const pitchFor = (info, dy) => -Math.atan2(dy, info.hipToShoulder) / DEG;

/** Plants every foot at its rest place (offset per leg by `move`), then solves the legs. */
function plantFeet(info, s, move = () => null) {
  const fk = fkOf(info, s);
  for (const lm of info.limbs) {
    if (!lm.chain) continue;
    const m = move(lm) || {};
    solveLeg(info, fk, lm, { c: lm.tip.clone().add(V3(0, m.dy || 0, m.dz || 0)), toe: m.toe || 0, heel: m.heel || 0, flex: m.flex || 0, mt: m.mt }, s);
  }
}
/**
 * Grazing posture: the neck swings down from its root (Neck1, with Neck2 following) until the poll is about a
 * head's length above the ground, then the head hangs nose-down so the muzzle meets the grass. Short-necked
 * animals that cannot reach also dip the forehand (the forelegs bend under the lowered chest).
 */
function reachGround(info, s, h, o = {}) {
  if (!info.snout || !info.has.Head) return 0;
  // The neck swings down nearly straight, a little arched behind the poll, about the base of the neck vertebrae: low in
  // the neck at about the height of the shoulder joint, not the Neck1 joint high in the chest. About Neck1 even a straight
  // neck could only put the poll a third of a metre ahead of the chest on a horse, so the head curled back between the
  // forelegs; real grazers reach well in front of their forefeet. The pivot is applied as a position offset on Neck1.
  // (Digital Diorama revision 7, options: `hang`, the head's pitch nose-down; `target`, the poll's height; `max`, the most the
  // neck swings down; `maxDip`, the most the forehand dips. Returns the dip, in degrees.)
  const hang = o.hang ?? 72, target = o.target ?? info.headLen * 0.92 + 0.015 * info.H, MAX = o.max ?? 115, N2 = 0.12;
  const fore = info.limbs.find(l => l.front && l.J && l.J[1]), Pw = info.headV.Neck1, Cw = info.headV.Chest;
  const Qw = fore ? V3(0, Math.min(Pw.y, fore.J[1].y + 0.03 * info.H), Math.max(Pw.z, fore.J[1].z + 0.04 * info.H)) : Pw;
  const Py = Pw.y - Cw.y, Pz = Pw.z - Cw.z, Qy = Qw.y - Cw.y, Qz = Qw.z - Cw.z;
  const neckAt = (t, a) => {
    addRot(info, t, 'Neck1', [a, 0, 0]); addRot(info, t, 'Neck2', [a * N2, 0, 0]);
    const c = Math.cos(a * DEG), sn = Math.sin(a * DEG), dy = Py - Qy, dz = Pz - Qz, v = t.Neck1;
    t.Neck1 = { r: Array.isArray(v) ? v : v.r, p: [0, Qy + dy * c - dz * sn - Py, Qz + dy * sn + dz * c - Pz] };
  };
  const pollY = (t) => new THREE.Vector3().setFromMatrixPosition(fkOf(info, t)('Head')).y;
  const trial = (a, dip) => { const t = { ...s }; addRot(info, t, 'Hips', [dip, 0, 0]); neckAt(t, a); return t; };
  let dip = 0, a = MAX;
  if (pollY(trial(MAX, 0)) > target) dip = clamp((pollY(trial(MAX, 0)) - target) / Math.max(1e-6, info.hipToShoulder) / DEG, 0, o.maxDip ?? 9);
  if (pollY(trial(0, dip)) > target) {
    let lo = 0, hi = MAX;
    for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (pollY(trial(m, dip)) > target) lo = m; else hi = m; }
    a = hi;
  } else a = 0;
  addRot(info, s, 'Hips', [dip, 0, 0]); neckAt(s, a);
  // hang the head about 72° nose-down (grazing)
  const fk = fkOf(info, s), q = new THREE.Quaternion().setFromRotationMatrix(fk('Head'));
  const d = info.snout.clone().sub(info.headV.Head).applyQuaternion(q), now = Math.atan2(-d.y, Math.hypot(d.z, d.x)) / DEG;
  addRot(info, s, 'Head', [clamp(hang - now, -40, 60), 0, 0]);
  return dip;
}
const tailWave = (info, s, yaw, lift = 0, f = 1, u = 0, lag = 0.6) => info.tail.forEach((b, i) => addRot(info, s, b, [lift / info.tail.length, Math.sin(TAU * f * u - i * lag) * yaw / info.tail.length, 0]));
/**
 * Digital Diorama revision 10: a tail that a pose lowers to the ground lies along it instead of passing through it (a sitting
 * lion's went 65 cm into the ground). Each tail bone, from the root, is pitched up just enough (bisection) that the joint at
 * its end stays a tail's radius above the ground.
 */
function tailOnGround(info, s) {
  const n = info.tail.length;
  if (!n) return;
  const floor = info.tailR * 1.05, q = V3();
  const endY = (i, smp = s) => {
    const fk = fkOf(info, smp), b = info.tail[i];
    const end = i + 1 < n ? info.headV[info.tail[i + 1]] : info.tailTip || info.headV[b];
    return q.copy(end).sub(info.headV[b]).applyMatrix4(fk(b)).y;
  };
  // which way each bone's pitch raises the tail, decided once from the rest pose (deciding it per frame could flip it between
  // two keys, and the interpolation between them swung the tail through the ground)
  if (!info.tailUp) info.tailUp = info.tail.map((b, i) => { const r = {}; r[b] = [10, 0, 0]; const up = endY(i, r); r[b] = [-10, 0, 0]; return up >= endY(i, r) ? 1 : -1; });
  for (let i = 0; i < n; i++) {
    if (endY(i) >= floor) continue;
    const b = info.tail[i], base = s[b] ? (Array.isArray(s[b]) ? s[b].slice() : s[b].r.slice()) : [0, 0, 0];
    const set = (d) => { const r = [base[0] + d, base[1], base[2]]; if (s[b] && !Array.isArray(s[b])) s[b].r = r; else s[b] = r; };
    const sg = info.tailUp[i];
    let lo = 0, hi = 120;
    for (let k = 0; k < 10; k++) { const m = (lo + hi) / 2; set(sg * m); if (endY(i) < floor) lo = m; else hi = m; }
    set(sg * hi);
  }
  // a long-haired tail (horses): its hair hangs below the dock, so the whole tail is raised evenly until the hair clears
  const H = info.tailSurf;
  if (!H || !H.length) return;
  const hairLow = () => {
    const fk = fkOf(info, s);
    let low = Infinity;
    for (const { P, W } of H) { let y = 0; for (const [bi, w] of W) { const b = info.bones[bi]; y += w * q.copy(P).sub(info.headV[b]).applyMatrix4(fk(b)).y; } low = Math.min(low, y); }
    return low;
  };
  const hf = 0.01 * info.hipH;
  if (hairLow() >= hf) return;
  const base = info.tail.map(b => (s[b] ? (Array.isArray(s[b]) ? s[b].slice() : s[b].r.slice()) : [0, 0, 0]));
  const setAll = (d) => info.tail.forEach((b, i) => { const r = [base[i][0] + d / n, base[i][1], base[i][2]]; if (s[b] && !Array.isArray(s[b])) s[b].r = r; else s[b] = r; });
  const sg = info.tailUp[0];
  let lo = 0, hi = 150;
  for (let k = 0; k < 10; k++) { const m = (lo + hi) / 2; setAll(sg * m); if (hairLow() < hf) lo = m; else hi = m; }
  setAll(sg * hi);
}
const earsTo = (info, s, a) => { addRot(info, s, 'EarL', [0, 0, a]); addRot(info, s, 'EarR', [0, 0, -a]); };

function gaitSample(info, name, u, raw = false) {
  const G = info.gaits[name], s = {}, h = info.hipH;
  const fmOf = (lm) => FOOT_MOTION[lm.foot] || FOOT_MOTION.paw;
  // feet first (their loads drive the body's rise and fall)
  const tracks = info.limbs.map(lm => ({ lm, tr: lm.chain ? footTrack(G, lm, u, h, fmOf(lm)) : null }));
  const load = (front) => tracks.reduce((a, t) => a + (t.tr && t.lm.front === front ? t.tr.load : 0), 0);
  // walking vaults over each straight leg (body high at mid-stance); running legs act as springs (low at mid-stance)
  const lh = load(false), lf = load(true);
  const yH0 = G.run ? G.bob * h * (0.45 - Math.min(1, lh)) : G.bob * h * (lh - 0.75), yF0 = G.run ? G.bob * h * (0.45 - Math.min(1, lf)) : G.bob * h * (lf - 0.75);
  const swayX = G.run ? 0 : 0.008 * h * Math.sin(TAU * u - Math.PI / 2);
  // spine: flexed when the legs gather under the body, extended as they stretch out (gallops and bounds)
  let flexS = 0;
  if (G.spine) {
    const front = typeof G.duty === 'number' ? G.duty : G.duty.front, gather = fract((Math.max(G.ph.LF, G.ph.RF) + front + 1) / 2 + 0.02);
    flexS = G.spine * Math.cos(TAU * (u - gather));
  }
  const trunkAt = (t, yH, pitch) => {
    rootAt(t, [swayX, yH, 0]);
    addRot(info, t, 'Hips', [pitch, 0, G.run ? 0 : 1.5 * Math.sin(TAU * u)]);
    if (G.spine) { addRot(info, t, 'Spine1', [flexS * 0.55, 0, 0]); addRot(info, t, 'Spine2', [flexS * 0.45, 0, 0]); }
    else { addRot(info, t, 'Spine1', [0, 1.2 * Math.sin(TAU * u), 0]); addRot(info, t, 'Chest', [0, -1.2 * Math.sin(TAU * u), 0]); }
  };
  // the girdles drop where the planted legs could not otherwise reach (double support): the body vaults
  let dropH = 0, dropF = 0;
  // Digital Diorama revision 7: a smooth drop (see dropCurve); the raw one is only measured for it and for adaptStrides
  const dc = raw ? null : dropCurve(info, name);
  if (dc) { dropH = dc.at(u, 'H'); dropF = dc.at(u, 'F'); }
  else for (let pass = 0; pass < 4; pass++) {
    const t = {}, yH = yH0 - dropH, yF = yF0 - dropF;
    trunkAt(t, yH, pitchFor(info, yF - yH));
    const fk = fkOf(info, t);
    let shortH = 0, shortF = 0;
    for (const { lm, tr } of tracks) if (tr && tr.load > 0) {
      const sh = solveLeg(info, fk, lm, { c: lm.tip.clone().add(V3(0, tr.dy, tr.dz)), toe: tr.toe, heel: tr.heel * (lm.foot === 'sole' ? 1 : 0), flex: tr.flex }, {}, false);
      if (lm.front) shortF = Math.max(shortF, sh); else shortH = Math.max(shortH, sh);
    }
    if (shortH < 1e-4 * h && shortF < 1e-4 * h) break;
    dropH = Math.min(0.2 * h, dropH + shortH * 1.15); dropF = Math.min(0.2 * h, dropF + shortF * 1.15);
  }
  const yH = yH0 - dropH, yF = yF0 - dropF, pitch = pitchFor(info, yF - yH);
  s.__drop = Math.max(dropH, dropF) / h; s.__dropH = dropH; s.__dropF = dropF;
  trunkAt(s, yH, pitch);
  // keep the head steady (counter the body's pitch); walkers nod with each fore footfall
  const nod = G.run ? 0 : (info.nod ?? 3) * Math.cos(2 * TAU * (u - G.ph.LF - 0.08));
  const pumpN = G.spine ? -0.5 * flexS : 0;
  addRot(info, s, 'Neck1', [-(pitch + flexS) * 0.6 + nod + pumpN, 0, 0]); addRot(info, s, 'Head', [-(pitch + flexS) * 0.3 - nod * 0.4, 0, 0]);
  if (info.trunk.length) info.trunk.forEach((b, i) => addRot(info, s, b, [Math.sin(TAU * u * (G.run ? 2 : 1) - i * 0.7) * 5, 0, Math.sin(TAU * u - i * 0.5) * 4]));
  tailWave(info, s, G.run ? 8 : 16, G.spine ? 18 : G.run ? 8 : 0, 1, u);
  if (G.run) earsTo(info, s, -6);
  const fk = fkOf(info, s);
  for (const { lm, tr } of tracks) if (tr) solveLeg(info, fk, lm, { c: lm.tip.clone().add(V3(0, tr.dy, tr.dz)), toe: tr.toe, heel: tr.heel * (lm.foot === 'sole' ? 1 : 0), flex: tr.flex }, s);
  // (Digital Diorama revision 8: an elephant's ears move gently with its steps, and are kept clear of the body)
  if (info.elephant && !raw) { earFan(info, s, 'EarL', 6 + 4 * Math.sin(TAU * u * 2 + 0.6)); earFan(info, s, 'EarR', 6 + 4 * Math.sin(TAU * u * 2 + 2.2)); earGuard(info, s); }
  return s;
}

function sampleFor(info, name, u) {
  if (info.gaits[name]) { adaptStrides(info); return gaitSample(info, name, u); }
  if (info.elephant && ELE_CLIP_SPEC[name]) return eleSample(info, name, u);
  const s = {}, h = info.hipH, H = info.H;
  switch (name) {
    case 'idle': {
      // breathing, a slow weight shift over planted feet, looking about, ear flicks and a swishing tail
      const br = Math.sin(TAU * u);
      rootAt(s, [0.006 * h * Math.sin(TAU * u), -0.004 * h * (1 - Math.cos(TAU * u)) / 2, 0.005 * h * Math.sin(TAU * u + 1.1)]);
      addRot(info, s, 'Spine2', [br * 0.8, 0, 0]); addRot(info, s, 'Chest', [-br * 0.6, 0, 0]);
      addRot(info, s, 'Neck1', [Math.sin(TAU * u + 1) * 2, Math.sin(TAU * u) * 9, 0]); addRot(info, s, 'Head', [Math.sin(TAU * u * 2) * 1.5, Math.sin(TAU * u - 0.6) * 6, Math.sin(TAU * u) * 2]);
      earsTo(info, s, Math.pow(Math.max(0, Math.sin(TAU * u * 3)), 4) * 14);
      tailWave(info, s, 18, 0, 1, u);
      if (info.trunk.length) info.trunk.forEach((b, i) => addRot(info, s, b, [Math.sin(TAU * u - i * 0.7) * 6, 0, Math.sin(TAU * u * 0.5 - i) * 4]));
      plantFeet(info, s);
      break;
    }
    case 'graze': {
      // head down to the ground, one foreleg forward (hoofed animals), chewing; giraffes browse, elephants pluck with the trunk
      const nb = Math.sin(TAU * u) * 2;
      let dip = 0;
      if (info.browse) {
        addRot(info, s, 'Neck1', [-14, Math.sin(TAU * u) * 6, 0]); addRot(info, s, 'Neck2', [-8, 0, 0]); addRot(info, s, 'Head', [-22 + nb, 0, 0]);
        addRot(info, s, 'Jaw', [Math.max(0, Math.sin(TAU * u * 4)) * 8, 0, 0]);
      } else if (info.trunk.length) {
        const k = 0.5 - 0.5 * Math.cos(TAU * u);
        addRot(info, s, 'Neck1', [6, 0, 0]); addRot(info, s, 'Head', [4, 0, 0]);
        info.trunk.forEach((b, i) => addRot(info, s, b, [lerp(10, -38, k) * (i + 1) / info.trunk.length * 1.6, 0, 0]));
      } else if (!info.grazer) {
        // Digital Diorama revision 7: carnivores, bears and rodents sniff and nibble at the ground rather than graze: the neck
        // swings down less, the head points down at about 50° and the nose works over the ground in front of the forefeet
        const sh = Math.sin(TAU * u * 2) * 3;
        dip = reachGround(info, s, h, { hang: 50, target: info.headLen * 0.72 + 0.035 * info.H, max: 80, maxDip: 5 });
        addRot(info, s, 'Neck1', [nb * 0.6, Math.sin(TAU * u) * 9, 0]); addRot(info, s, 'Head', [sh, Math.sin(TAU * u + 0.8) * 6, 0]);
        addRot(info, s, 'Jaw', [Math.max(0, Math.sin(TAU * u * 3)) * 5, 0, 0]);
      } else {
        dip = reachGround(info, s, h);
        addRot(info, s, 'Neck1', [nb, Math.sin(TAU * u) * 5, 0]); addRot(info, s, 'Head', [-nb * 0.5, 0, 0]);
        addRot(info, s, 'Jaw', [Math.max(0, Math.sin(TAU * u * 4)) * 8, 0, 0]);
      }
      earsTo(info, s, -8); tailWave(info, s, 12, 0, 1, u);
      // (Digital Diorama revision 7: where the forehand has to dip (short necks: pigs, bears, bison), the forefeet step forward
      // with it, so the forelegs slant instead of folding at the elbow)
      const fwd = 0.2 * h * (dip / 9);
      plantFeet(info, s, (lm) => !lm.front ? null : { dz: fwd + (lm.side > 0 && info.hoofed ? 0.12 * h : 0) });
      break;
    }
    case 'alert': {
      // head high, ears pricked toward the sound, tail raised; deer and antelope lift a forefoot
      addRot(info, s, 'Neck1', [-14, 0, 0]); addRot(info, s, 'Neck2', [-6, 0, 0]); addRot(info, s, 'Head', [-8, Math.sin(TAU * u) * 10, 0]);
      earsTo(info, s, -14); tailWave(info, s, 3, 15, 1, u);
      if (info.trunk.length) info.trunk.forEach((b) => addRot(info, s, b, [-14, 0, 0]));
      rootAt(s, [0, 0.004 * h, -0.006 * h]);
      plantFeet(info, s, (lm) => lm.front && lm.side > 0 && info.footLift ? { dy: 0.1 * h, dz: 0.02 * h, toe: 55, flex: 70 } : null);
      break;
    }
    case 'roar': {
      const o = sstep(0, 0.3, u) * (1 - sstep(0.75, 1, u));
      rootAt(s, [0, -0.015 * h * o, -0.03 * h * o]);
      addRot(info, s, 'Neck1', [-12 * o, 0, 0]); addRot(info, s, 'Head', [-14 * o, 0, 0]); addRot(info, s, 'Jaw', [32 * o, 0, 0]); earsTo(info, s, -20 * o); addRot(info, s, 'Chest', [-4 * o, 0, 0]);
      if (info.trunk.length) info.trunk.forEach((b) => addRot(info, s, b, [-24 * o, 0, 0]));
      tailWave(info, s, 8, 10 * o, 2, u);
      plantFeet(info, s);
      break;
    }
    case 'sit': {
      const t = sstep(0, 0.65, u);
      if (info.lies) lieDown(info, s, t);
      else sitDown(info, s, t);
      break;
    }
    default: break;
  }
  return s;
}

/** Dogs, cats, bears and rodents sit on their haunches: rump down, hocks and feet flat, forelegs straight. */
function sitDown(info, s, t) {
  const h = info.hipH, up = info.sitUp;
  const pitch = (up ? 48 : info.hindHigh ? 26 : 34) * t;
  const drop = (up ? 0.62 : 0.6) * h * t;
  const pose = (lift) => {
    for (const k of Object.keys(s)) delete s[k];
    rootAt(s, [0, -drop + lift, -0.08 * h * t]);
    addRot(info, s, 'Hips', [-pitch, 0, 0]);
    addRot(info, s, 'Neck1', [pitch * 0.45, 0, 0]); addRot(info, s, 'Head', [pitch * 0.3, 0, 0]);
    tailWave(info, s, 3, -18 * t, 1, 0);
    const fk = fkOf(info, s);
    for (const lm of info.limbs) {
      if (!lm.chain) continue;
      if (!lm.front) {
        // the cannon / rear pastern lies flat along the ground under the hock (raised with the body by `lift`, so it rests
        // on its own skin rather than its bone)
        solveLeg(info, fk, lm, { c: lm.tip.clone().add(V3(0, lift, 0.05 * h * t)), toe: 0, heel: 0, mt: lm.chain === 'sole' ? undefined : lerp(lm.mtRest, 90, t) }, s);
      } else if (up) {
        // squirrels and rabbits sit up with the forepaws held to the chest
        addRot(info, s, lm.bones[1], [-40 * t, 0, 0]); addRot(info, s, lm.bones[2], [80 * t, 0, 0]); if (lm.bones[3]) addRot(info, s, lm.bones[3], [30 * t, 0, 0]);
      } else solveLeg(info, fk, lm, { c: lm.tip.clone(), toe: 0 }, s);
    }
  };
  // (Digital Diorama revision 10: the haunches settle only as far as the folded hind legs stay on top of the ground, and the
  // tail lies along it)
  clearGround(info, s, pose, 'sit' + t.toFixed(5), 0.15 * h);
  tailOnGround(info, s);
}

/**
 * Digital Diorama revision 10 (after the elephant's lying down, revision 8): poses `pose(lift)` with the least lift that keeps
 * every leg's surface points (legs measured with MEASURED LAYOUTS, their hooves and pads) a hair above the ground.
 * Bisection on every third point, then checked against all of them; remembered per pose.
 */
function clearGround(info, s, pose, key, maxLift) {
  if (!info.limbs.some(l => l.surf)) { pose(0); return; }
  const h = info.hipH, q = V3(), lowest = (step = 1) => {
    const fk = fkOf(info, s);
    let low = Infinity;
    for (const lm of info.limbs) { const S = lm.surf || []; for (let k = 0; k < S.length; k += step) {
      const { P, W } = S[k];
      let y = 0;
      for (const [bi, w] of W) { const b = info.bones[bi]; y += w * q.copy(P).sub(info.headV[b]).applyMatrix4(fk(b)).y; }
      low = Math.min(low, y);
    } }
    return low;
  };
  const margin = 0.002 * h, memo = info.clearMemo || (info.clearMemo = new Map());
  if (memo.has(key)) { pose(memo.get(key)); return; }
  pose(0);
  if (lowest() >= margin) { memo.set(key, 0); return; }
  let lo = 0, hi = maxLift;
  for (let i = 0; i < 9; i++) { const m = (lo + hi) / 2; pose(m); if (lowest(3) < margin) lo = m; else hi = m; }
  pose(hi);
  for (let i = 0; i < 6 && lowest() < margin; i++) { hi += 0.003 * h; pose(hi); }
  memo.set(key, hi);
}

/** Hoofed animals and elephants lie down instead (sternal recumbency): belly on the ground, the forelegs folded at
 *  the knee with the cannons tucked back underneath, the hind legs folded with the hock on the ground. */
function lieDown(info, s, t) {
  const h = info.hipH, drop = Math.max(0, info.bellyH - 0.03 * h) * t;
  const pose = (lift) => {
    for (const k of Object.keys(s)) delete s[k];
    rootAt(s, [0, -drop + lift, 0]);
    addRot(info, s, 'Hips', [1.5 * t, 0, 0]);
    addRot(info, s, 'Neck1', [-6 * t, 0, 0]); addRot(info, s, 'Head', [8 * t, 0, 0]);
    // an elephant lying down lifts its head and curls its trunk forward along the ground (they went into the ground)
    if (info.trunk.length) { addRot(info, s, 'Neck1', [-14 * t, 0, 0]); addRot(info, s, 'Head', [-10 * t, 0, 0]); info.trunk.forEach((b) => addRot(info, s, b, [-21 * t, 0, 0])); }
    tailWave(info, s, 2, -10 * t, 1, 0);
    const fk = fkOf(info, s);
    for (const lm of info.limbs) {
      if (!lm.chain) continue;
      const J = lm.J, rest = { c: lm.tip.clone() };
      if (lm.front) {
        if (lm.chain === 'sole') { solveLeg(info, fk, lm, rest, s); continue; }
        // the knee settles on the ground a forearm's reach ahead of where the elbow stood
        const lr = J[3].distanceTo(J[2]), C = V3(J[3].x, lerp(J[3].y, 0.05 * h + lift, t), lerp(J[3].z, J[2].z + 0.45 * lr, t));
        solveLeg(info, fk, lm, { C, mc: lerp(lm.mcRest, -84, t), toeRel: 70 * t, scap: -6 * t }, s);
      } else if (lm.chain === 'sole') solveLeg(info, fk, lm, rest, s);
      else {
        // the hock rests on the ground behind the hip, the cannon lies forward under the belly
        const A = V3(J[2].x, lerp(J[2].y, 0.06 * h + lift, t), lerp(J[2].z, J[0].z - 0.1 * h, t));
        solveLeg(info, fk, lm, { A, mt: lerp(lm.mtRest, 96, t), toeRel: 45 * t }, s);
      }
    }
  };
  // Digital Diorama revision 10: the body is lowered only as far as the folded legs' own surfaces (and hooves) stay above
  // the ground, as for the elephant (revision 8); the knees, hocks and cannons used to sink 10-14 cm into it
  clearGround(info, s, pose, 'lie' + t.toFixed(5), drop + 0.15 * h);
  tailOnGround(info, s);
}

/* ── Elephant clips (Digital Diorama revision 8) ──
 * An elephant's ears fan about their root lines (earFan) and never touch the body: earGuard fans an ear further out
 * whenever a pose would bring its free edge within a few centimetres of the shoulder or neck (a turned or lowered head
 * swings the ear behind it into the shoulder). Idle shifts the weight from side to side over planted feet while the
 * trunk swings and curls and the ears fan; graze reaches the trunk down to the grass in front of the forefeet, curls it
 * round a tuft and swings it up to the mouth; alert spreads the ears wide and lifts the head; roar is a trumpet, the
 * trunk raised up and forward, the ears spread and the mouth open; sit is lying down. */
const ELE_CLIP_SPEC = { idle: [6, 73, true], graze: [4.8, 61, true], alert: [3.2, 41, true], roar: [2.4, 49, false], sit: [2.4, 37, false] };
/** Sets an elephant's ear to `deg` degrees fanned out about its root line (in the head's frame). */
function earFan(info, s, bone, deg) {
  const E = info.ears && info.ears[bone];
  if (!E || !info.has[bone]) return;
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromAxisAngle(E.axis, -E.side * deg * DEG), 'YXZ');
  s[bone] = [e.x / DEG, e.y / DEG, e.z / DEG];
  (s.__fan || (s.__fan = {}))[bone] = deg;
}
/** Fans each ear further out until its free edges clear the body (see the note above). */
function earGuard(info, s) {
  if (!info.ears) return;
  const clr = 0.014 * info.U;
  for (const [bone, E] of Object.entries(info.ears)) {
    if (!info.has[bone]) continue;
    let fan = (s.__fan && s.__fan[bone]) ?? 0;
    for (let it = 0; it < 8; it++) {
      const fk = fkOf(info, s), Me = fk(bone), inv = { Chest: fk('Chest').clone().invert(), Neck1: fk('Neck1').clone().invert() };
      let need = 0;
      for (const P of E.edge) {
        const W = P.clone().sub(info.headV[bone]).applyMatrix4(Me), ref = P.z < info.neckZ ? 'Chest' : 'Neck1';
        const R = W.applyMatrix4(inv[ref]).add(info.headV[ref]);
        const r = Math.max(0.05 * info.U, Math.hypot(P.x - E.pivot.x, P.z - E.pivot.z));
        need = Math.max(need, (clr - info.depthAt(R)) / r);
      }
      if (need <= 1e-3) break;
      fan += (need / DEG) * 1.15 + 0.5;
      earFan(info, s, bone, fan);
    }
  }
}
/** The trunk tip's place in a sample (model space). */
const trunkTip = (info, s) => info.trunkTip.clone().sub(info.headV.Trunk5).applyMatrix4(fkOf(info, s)('Trunk5'));
/** The elephant's own clips (gaits are the shared ones: see gaitSample). */
function eleSample(info, name, u) {
  const s = {}, h = info.hipH, n = info.trunk.length;
  const trunk = (f) => info.trunk.forEach((b, i) => addRot(info, s, b, f(i)));
  switch (name) {
    case 'idle': {
      // the weight shifts from side to side over planted feet (the body rocking a little), the head turns and nods,
      // the trunk swings and twice curls its tip up, the ears fan
      const w = Math.sin(TAU * u), curl = Math.max(0, Math.sin(TAU * u * 2 - 1)) ** 2;
      rootAt(s, [0.022 * h * w, -0.003 * h * (1 - Math.cos(2 * TAU * u)) / 2, 0.004 * h * Math.sin(TAU * u + 1)]);
      addRot(info, s, 'Hips', [0, 0, 1.2 * w]); addRot(info, s, 'Chest', [0, 0, -0.8 * w]);
      addRot(info, s, 'Neck1', [1.5 * Math.sin(TAU * u * 2), 4 * Math.sin(TAU * u - 0.5), 0]); addRot(info, s, 'Head', [1.5 * Math.sin(TAU * u * 2 + 1), 2 * Math.sin(TAU * u), 0]);
      trunk((i) => [(i < 2 ? 4 : 2) * Math.sin(TAU * u - i * 0.6) + curl * [0, 5, 16, 30, 38][i], 0, 7 * Math.sin(TAU * u - i * 0.7)]);
      earFan(info, s, 'EarL', 6 + 24 * Math.max(0, Math.sin(TAU * u * 3)) ** 2); earFan(info, s, 'EarR', 6 + 24 * Math.max(0, Math.sin(TAU * u * 3 - 0.6)) ** 2);
      tailWave(info, s, 16, 0, 2, u);
      plantFeet(info, s);
      break;
    }
    case 'graze': {
      // reach (the head dips and the trunk reaches the grass in front), grasp (the tip curls round a tuft), lift it to the
      // mouth (the trunk curls back under itself), chew, and reach again
      const reach = sstep(0, 0.2, u) * (1 - sstep(0.34, 0.52, u)) + sstep(0.86, 1, u);
      const grasp = sstep(0.22, 0.34, u) * (1 - sstep(0.7, 0.8, u)), mouth = sstep(0.34, 0.56, u) * (1 - sstep(0.72, 0.9, u));
      const dip = info.grazeDip * reach;
      addRot(info, s, 'Neck1', [3 + dip * 0.5 - 4 * mouth, 2 * Math.sin(TAU * u), 0]); addRot(info, s, 'Head', [3 + dip * 0.5 - 5 * mouth, 0, 0]);
      trunk((i) => [[-4, -3, -2, -2, -2][i] * reach + [0, 0, 6, 22, 34][i] * grasp * (1 - mouth) + info.mouthCurl[i] * mouth, 0, 2 * Math.sin(TAU * u - i * 0.6)]);
      addRot(info, s, 'Jaw', [mouth * (6 + 4 * Math.max(0, Math.sin(TAU * u * 6))), 0, 0]);
      earFan(info, s, 'EarL', 8 + 6 * Math.sin(TAU * u)); earFan(info, s, 'EarR', 8 + 6 * Math.sin(TAU * u + 1));
      tailWave(info, s, 12, 0, 1, u);
      plantFeet(info, s);
      break;
    }
    case 'alert': {
      // ears spread wide, the head raised, the trunk lifted forward with its tip curled up to test the air
      const k = sstep(0, 0.25, u) * (1 - sstep(0.85, 1, u)) * 0.3 + 0.7;
      addRot(info, s, 'Neck1', [-9 * k, 3 * Math.sin(TAU * u), 0]); addRot(info, s, 'Neck2', [-4 * k, 0, 0]); addRot(info, s, 'Head', [-9 * k, 4 * Math.sin(TAU * u + 0.5), 0]);
      trunk((i) => [[-12, -8, -4, 10, 20][i] * k + 3 * Math.sin(TAU * u * 2 - i * 0.5), 0, 3 * Math.sin(TAU * u - i)]);
      const fan = 50 + 5 * Math.sin(TAU * u * 2);
      earFan(info, s, 'EarL', fan); earFan(info, s, 'EarR', fan);
      tailWave(info, s, 5, 22, 1, u);
      rootAt(s, [0, 0.004 * h, -0.006 * h]);
      plantFeet(info, s);
      break;
    }
    case 'roar': {
      // a trumpet: the head thrown up, the trunk raised up and forward, the ears spread and the mouth open
      const o = sstep(0, 0.28, u) * (1 - sstep(0.78, 1, u));
      rootAt(s, [0, -0.01 * h * o, -0.025 * h * o]);
      addRot(info, s, 'Chest', [-3 * o, 0, 0]);
      addRot(info, s, 'Neck1', [-12 * o, 0, 0]); addRot(info, s, 'Head', [-14 * o, 0, 0]); addRot(info, s, 'Jaw', [24 * o, 0, 0]);
      trunk((i) => [[-36, -34, -30, -22, -12][i] * o + 3 * o * Math.sin(TAU * u * 3 - i), 0, 0]);
      earFan(info, s, 'EarL', 10 + 58 * o); earFan(info, s, 'EarR', 10 + 58 * o);
      tailWave(info, s, 10, 20 * o, 2, u);
      plantFeet(info, s);
      break;
    }
    case 'sit': {
      eleLieDown(info, s, sstep(0, 0.7, u));
      break;
    }
    default: break;
  }
  earGuard(info, s);
  return s;
}
/** Lying down (sternal): the body lowered onto the folded legs, the forelegs reaching forward along the ground, the hind
 *  legs stretched back with the soles turned up, the tail laid back, the head held up and the trunk laid forward on the
 *  ground. The legs are thick: points of their surface are posed through the skeleton, and the body is lowered only as
 *  far as none of them dips below the ground (the footholds move with the body, so the lowest lift is found by bisection). */
function eleLieDown(info, s, t) {
  const U = info.U, drop = Math.max(0, info.bellyH - 0.025 * U) * t;
  const pose = (lift) => {
    for (const k of Object.keys(s)) delete s[k];
    const dy = -drop + lift;
    rootAt(s, [0, dy, 0]);
    addRot(info, s, 'Neck1', [-6 * t, 0, 0]); addRot(info, s, 'Head', [-4 * t, 0, 0]);
    info.trunk.forEach((b, i) => addRot(info, s, b, [info.lieCurl[i] * t, 0, 0]));
    earFan(info, s, 'EarL', 6); earFan(info, s, 'EarR', 6);
    tailWave(info, s, 2, 75 * t, 1, 0);
    const fk = fkOf(info, s);
    for (const lm of info.limbs) {
      if (!lm.chain) continue;
      const J = lm.J;
      if (lm.front) {
        // the carpus a forearm's reach ahead of the lowered elbow, half way down to the ground
        const lr = J[3].distanceTo(J[2]), ey = J[2].y + dy, C = V3(J[3].x, lerp(J[3].y + dy, Math.max(0.1 * U, ey * 0.5), t), lerp(J[3].z, J[2].z + 0.85 * lr, t));
        solveLeg(info, fk, lm, { C, mc: lerp(lm.mcRest, 95, t), toeRel: 0, scap: -4 * t }, s);
      } else {
        const reach = J[1].distanceTo(J[0]) + J[2].distanceTo(J[1]), hy = J[0].y + dy;
        const A = V3(J[2].x, lerp(J[2].y + dy, Math.max(0.12 * U, hy - 0.45 * reach), t), lerp(J[2].z, J[0].z - 0.85 * reach, t));
        solveLeg(info, fk, lm, { A, mt: lerp(lm.mtRest, -92, t), toeRel: 0 }, s);
      }
    }
  };
  const q = V3(), lowest = (step = 1) => {
    const fk = fkOf(info, s);
    let low = Infinity;
    for (const lm of info.limbs) { const S = lm.surf || []; for (let k = 0; k < S.length; k += step) {
      const { P, W } = S[k];
      let y = 0;
      for (const [bi, w] of W) { const b = info.bones[bi]; y += w * q.copy(P).sub(info.headV[b]).applyMatrix4(fk(b)).y; }
      low = Math.min(low, y);
    } }
    return low;
  };
  // (the surface is sampled every other point round the leg: a small margin covers what lies between. Digital Diorama
  // revision 8: a lift once found is kept for that stage of lying down, the bisection reads every third surface point and
  // the result is checked against all of them; the sit clip baked six times faster)
  const margin = 0.0017 * U, memo = info.lieMemo || (info.lieMemo = new Map()), key = t.toFixed(5);
  if (memo.has(key)) { pose(memo.get(key)); return; }
  pose(0);
  if (lowest() >= margin) { memo.set(key, 0); return; }
  let lo = 0, hi = drop + 0.1 * U;
  for (let i = 0; i < 9; i++) { const m = (lo + hi) / 2; pose(m); if (lowest(3) < margin) lo = m; else hi = m; }
  pose(hi);
  for (let i = 0; i < 6 && lowest() < margin; i++) { hi += 0.002 * U; pose(hi); }
  memo.set(key, hi);
}
/** Once per asset: the head dip that lets the trunk reach the grass, the curl that brings its tip to the mouth, and the
 *  forward curl that keeps a lying elephant's trunk on the ground (solved through the skeleton, so every size works). */
function eleMotionSetup(info) {
  const U = info.U, rad = [0.085, 0.07, 0.055, 0.042, 0.032].map(r => r * U * info.headScale);
  const trunkLow = (s) => { const fk = fkOf(info, s); let m = trunkTip(info, s).y - 0.026 * U * info.headScale; info.trunk.forEach((b, i) => { m = Math.min(m, V3().applyMatrix4(fk(b)).y - rad[i]); }); return m; };
  const pose = (f) => { const s = {}; f(s); return s; };
  // graze: the dip (split between neck and head) that puts the tip just above the ground in front
  let lo = 0, hi = 40;
  for (let i = 0; i < 18; i++) {
    const d = (lo + hi) / 2, s = pose((s) => { addRot(info, s, 'Neck1', [3 + d * 0.5, 0, 0]); addRot(info, s, 'Head', [3 + d * 0.5, 0, 0]); info.trunk.forEach((b, j) => addRot(info, s, b, [[-4, -3, -2, -2, -2][j], 0, 0])); });
    if (trunkTip(info, s).y > (0.026 * info.headScale + 0.01) * U) lo = d; else hi = d;
  }
  info.grazeDip = hi;
  // to the mouth: the curl (a fixed shape, scaled) whose tip comes closest to the lower lip
  const shape = [2, 16, 32, 46, 52];
  let best = 1, bd = Infinity;
  for (let k = 0.6; k <= 2.2; k += 0.02) {
    const s = pose((s) => { addRot(info, s, 'Neck1', [-1, 0, 0]); addRot(info, s, 'Head', [-2, 0, 0]); info.trunk.forEach((b, j) => addRot(info, s, b, [shape[j] * k, 0, 0])); });
    const d = trunkTip(info, s).distanceTo(info.mouthP.clone().sub(info.headV.Jaw).applyMatrix4(fkOf(info, s)('Jaw')));
    if (d < bd) { bd = d; best = k; }
  }
  info.mouthCurl = shape.map(a => a * best);
  info.mouthMiss = bd;
  // lying down: the forward curl that keeps the trunk off the ground with the body lowered
  const lie = [-40, -28, -18, -10, -4];
  let k = 0;
  for (; k <= 2; k += 0.05) {
    const s = pose((s) => { rootAt(s, [0, -Math.max(0, info.bellyH - 0.025 * U), 0]); addRot(info, s, 'Neck1', [-6, 0, 0]); addRot(info, s, 'Head', [-4, 0, 0]); info.trunk.forEach((b, j) => addRot(info, s, b, [lie[j] * k, 0, 0])); });
    if (trunkLow(s) >= 0.005 * U) break;
  }
  info.lieCurl = lie.map(a => a * k);
}

const CLIP_SPEC = { idle: [3.2, 49, true], graze: [2.4, 37, true], alert: [2.2, 33, true], roar: [1.8, 37, false], sit: [1.6, 25, false] };

/**
 * Short-legged animals (hedgehogs, mice, otters) take shorter, quicker steps: each gait's stride is shortened until
 * the body need not sink more than 12 % of the leg length for the planted feet to reach the ground. Runs once.
 */
/**
 * Digital Diorama revision 7: the girdles' drop through a gait cycle, smoothed. Where planted legs cannot reach (double
 * support) the hips and shoulders sink, and they sprang back the instant the straining foot lifted: the body jumped by
 * the whole drop between two frames (9 cm in a horse's walk, 26 cm in an elephant's), and the other legs flipped between
 * a bent and a straight solution. The needed drop is sampled round the cycle, then given an upper envelope and blurred:
 * never less than the legs need, so every planted foot still reaches, and the body eases down and up.
 */
function dropCurve(info, name) {
  const G = info.gaits[name];
  if (G.drops) return G.drops;
  // (Digital Diorama revision 8: `dropK`, the smoothing window, wider for the elephant's heavy, slow body)
  const N = 48, K = G.dropK ?? 3, raw = { H: [], F: [] };
  for (let i = 0; i < N; i++) { const t = gaitSample(info, name, i / N, true); raw.H.push(t.__dropH); raw.F.push(t.__dropF); }
  const smooth = (a) => {
    const dil = a.map((_, i) => { let m = 0; for (let d = -K; d <= K; d++) m = Math.max(m, a[(i + d + N) % N]); return m; });
    return dil.map((_, i) => { let t = 0; for (let d = -K; d <= K; d++) t += dil[(i + d + N) % N]; return t / (2 * K + 1); });
  };
  const H = smooth(raw.H), F = smooth(raw.F);
  G.drops = { at: (u, k) => { const a = k === 'H' ? H : F, f = fract(u) * N, i = Math.floor(f) % N; return lerp(a[i], a[(i + 1) % N], f - Math.floor(f)); } };
  return G.drops;
}

function adaptStrides(info) {
  if (info.adapted) return;
  info.adapted = true;
  for (const name of Object.keys(info.gaits)) {
    for (let k = 0; k < 6; k++) {
      let worst = 0;
      for (let i = 0; i < 16; i++) worst = Math.max(worst, gaitSample(info, name, i / 16, true).__drop || 0);
      if (worst <= 0.12) break;
      info.gaits[name] = { ...info.gaits[name], lambda: info.gaits[name].lambda * 0.85 };
    }
  }
}

/** Builds every clip for an asset made by createAsset (skinned mode). Gait clips carry { gait, stride, speed, hipH }. */
export function createClips(asset) {
  const R = RIGS.get(asset); if (!R) return [];
  const info = R.info, h = info.hipH, out = [];
  adaptStrides(info);
  for (const name of ['walk', 'trot', 'gallop']) {
    const G = info.gaits[name]; if (!G) continue;
    // (Digital Diorama revision 7: 41-65 keys a cycle; with 21-41, the joints' interpolation between keys sank fast feet
    // 1-2 cm into the ground at touchdown, though every baked pose was exact)
    const v = Math.sqrt(G.fr * 9.81 * h), stride = G.lambda * h, dur = stride / v, frames = clamp(Math.round(dur * 64), 41, 65);
    const clip = bakeClip(info, name, dur, frames, (u) => sampleFor(info, name, u), true, true);
    clip.userData = { loop: true, gait: G.id, stride, speed: v, hipH: h, fr: G.fr };
    out.push(clip);
  }
  for (const [n, [d, f, loop]] of Object.entries(info.elephant ? ELE_CLIP_SPEC : CLIP_SPEC)) out.push(bakeClip(info, n, d, f, (u) => sampleFor(info, n, u), loop));
  return out;
}
/** Poses a skinned asset at a clip phase (no mixer needed). */
export function setPose(asset, name = 'stand', phase = 0) {
  const R = RIGS.get(asset); if (!R) return;
  applySample(R.rig, name === 'stand' ? {} : sampleFor(R.info, name, clamp(phase, 0, 1)));
  asset.updateMatrixWorld(true);
}

/* ════════════════════════════════════════════════════════════════════════════
 *  ASSET
 * ════════════════════════════════════════════════════════════════════════════ */
/** What the clip solver needs to know about the skeleton and the species (Digital Diorama revision 4). */
function motionInfo(S, p, L, rig) {
  const P2r = (v) => ({ z: v.z, y: v.y });
  const limbs = L.limbs.map(lm => {
    const J = lm.joints.map(j => j.p.clone()), n = J.length, std = ['ungulate', 'digitigrade', 'plantigrade', 'graviportal'].includes(lm.st);
    const foot = lm.footType || lm.foot, chain = !std || n < 5 ? null : foot === 'sole' ? 'sole' : 'panto';
    const out = { front: lm.front, side: lm.side, bones: lm.bones, st: lm.st, foot, chain, J, tip: J[n - 1].clone(), surf: lm.surf || null };
    if (!chain) return out;
    const W = J.map(P2r), sub = (a, b) => ({ z: a.z - b.z, y: a.y - b.y }), cr = (a, b) => a.z * b.y - a.y * b.z;
    if (lm.front) {
      out.elbowSide = Math.sign(cr(sub(chain === 'sole' ? W[3] : W[4], W[1]), sub(W[2], W[1]))) || -1;
      out.mcRest = Math.atan2(W[4].z - W[3].z, W[4].y - W[3].y) / DEG;
      out.ks = lm.st === 'graviportal' || chain === 'sole' ? 0.25 : 0.45;
    } else {
      out.kneeSide = Math.sign(cr(sub(W[2], W[0]), sub(W[1], W[0]))) || 1;
      // (Digital Diorama revision 8: `pantograph`, how far the cannon follows the thigh; 1 tilts a pillar leg as one piece over
      // its flat foot, so the elephant's knee stays straight through the stance)
      out.kp = S.pantograph ?? (lm.st === 'graviportal' ? 0.4 : 0.9);
      out.mtRest = Math.atan2(W[3].z - W[2].z, W[3].y - W[2].y) / DEG;
    }
    return out;
  });
  const hind = limbs.filter(l => !l.front), gaits = {};
  // (Digital Diorama revision 7: in a crouched animal's bound the hind feet land well forward, under the chest, and push off
  // below the hips; planted further back the folded haunch stretched into a long wedge at push-off)
  const crouched = S.stance === 'digitigrade' && (S.crouch || 0) >= 0.5;
  for (const [clip, id] of Object.entries(gaitSetFor(S, p))) if (id) gaits[clip] = { ...GAIT_LIB[id], ...(crouched && id === 'bound' ? { hindO: 0.3 } : {}), ...((GAIT_TUNE[p.species] || {})[clip] || {}), id };
  let bellyH = Infinity;
  for (let k = L.torso.main[0]; k <= L.torso.main[1]; k++) if (L.torso.us[k] < L.uOf.neckRoot) for (const q of L.torso.rows[k]) bellyH = Math.min(bellyH, q.y);
  const hoofed = S.stance === 'ungulate', fore = limbs.filter(l => l.front && l.chain);
  // legs scale the stride: the hind legs' hip height, unless the forelegs are much shorter (mice, rabbits, squirrels)
  const hipJ = hind.length ? hind.reduce((a, l) => a + l.J[0].y, 0) / hind.length : S.H * 0.6;
  const shJ = fore.length ? fore.reduce((a, l) => a + l.J[1].y, 0) / fore.length : hipJ;
  return {
    limbs, gaits, hipH: Math.min(hipJ, 1.15 * shJ),
    parent: Object.fromEntries(rig.list.map(e => [e.name, e.parent ? e.parent.name : null])),
    headV: Object.fromEntries(rig.list.map(e => [e.name, e.head.clone()])),
    snout: L.headO ? L.headO.clone().addScaledVector(L.hd, L.Lh) : null, headLen: L.Lh,
    bellyH: Number.isFinite(bellyH) ? bellyH : S.H * 0.5,
    hoofed, nod: hoofed ? 4 : 2, browse: p.species === 'giraffe', grazer: hoofed || S.stance === 'graviportal' || S.grazer === true,
    footLift: ['deer', 'gazelle', 'reindeer', 'moose', 'goat', 'bighorn'].includes(p.species),
    lies: hoofed || S.stance === 'graviportal', sitUp: S.stance === 'digitigrade' && (S.crouch || 0) >= 0.5,
  };
}
export function createAsset(input = {}) {
  const p = normalize(input);
  const base = SPECIES[p.species] || SPECIES.horse;
  const S = specFor(base, p);
  const det = DETAIL[p.detail] ?? 1;
  const rigB = new Rig(), parts = [], byName = new Map();
  const coatOn = p.coat !== false;
  const B = { det, rig: rigB, parts, paint: null,
    part(name, opt = {}) { if (!byName.has(name)) { const pt = new Part(name, opt); pt.coat = coatOn && !pt.glass; byName.set(name, pt); parts.push(pt); } return byName.get(name); } };
  // (Digital Diorama revision 8: the elephant has its own builder; see ELEPHANT)
  // (Digital Diorama revision 10: every other quadruped from its measured reference table; see MEASURED LAYOUTS)
  const L = S.builder === 'elephant' ? elephantBuild(B, S, p) : S.ref ? refLayout(S, p) : tetraLayout(S);
  if (!L.elephant) {
    tetraTorso(B, S, L);
    B.paint = makePainter(S, L);
    tetraLimbLayout(B, S, L);
    tetraLimbBones(B, L);
    tetraHead(B, S, L);
    // (the torso is emitted after the limbs, whose roots are blended into it first: blendLimbRoots)
    tetraLimbs(B, S, L);
    emit(B.part('body', { group: 'body' }), L.torso, (u, a, P) => B.paint({ part: u > L.uOf.neckRoot ? 'neck' : 'torso', u, a, P }), tetraTorsoSkin(B, L));
    tetraTail(B, S, L);
    tetraHorns(B, S, L);
    tetraTusks(B, S, L);
    tetraTrunk(B, S, L);
    tetraMane(B, S, L);
    tetraQuills(B, S, L);
    tetraUdder(B, S, L);
  }

  const hidden = new Set(String(p.hide || '').split(',').map(s => s.trim()).filter(Boolean));
  const keep = (pt) => !hidden.has(pt.name) && !hidden.has(pt.group) && !(hidden.has('feet') && pt.group === 'feet');
  const build = { rig: rigB, parts: parts.filter(keep) };
  const zones = zonesFor(p.colorway, p, S.palette);

  const info = {
    H: S.H, bones: rigB.list.map(e => e.name), has: Object.fromEntries(rigB.list.map(e => [e.name, true])),
    rest: Object.fromEntries(rigB.list.map(e => [e.name, (e.parent ? e.head.clone().sub(e.parent.head) : e.head.clone()).toArray()])),
    moving: ['Root'], scaled: [],
    tailTip: L.tail && L.tail.curve ? L.tail.curve.getPointAt(1) : null, tailSurf: L.tail && L.tail.surf ? L.tail.surf : null, tailR: L.tail && L.tail.r ? L.tail.r : 0.01 * S.H,
    tail: rigB.list.filter(e => /^Tail\d/.test(e.name)).map(e => e.name), trunk: rigB.list.filter(e => /^Trunk\d/.test(e.name)).map(e => e.name),
    longNeck: S.neckLen > 0.45, hindHigh: S.rump > 1.1,
    hipToShoulder: rigB.head('Chest').distanceTo(rigB.head('Hips')),
    ...motionInfo(S, p, L, rigB),
    // (Digital Diorama revision 8) the elephant's clips fan its ears about their root lines and keep them off the body
    ...(L.elephant ? { elephant: true, ears: L.earInfo || {}, depthAt: (P) => torsoDepth(L, P).d, U: L.U, headScale: L.hs, trunkTip: L.trunkTipRest, mouthP: L.lipRest, neckZ: L.torso.frame(L.uOf.neckRoot).c.z } : {}),
  };
  if (info.elephant) eleMotionSetup(info);
  const pose = p.pose !== 'stand' ? sampleFor(info, p.pose, p.posePhase) : null;
  const coat = { res: COAT_RES[p.detail] ?? COAT_RES.standard, grain: p.coatGrain * (S.grain ?? 1), grainOf: (z) => ZONE_ROLES[z] === 'body', smooth: p.shading !== 'flat', crease: S.crease || null };
  const { root, skeleton } = finish(build, { name: `mammal-${p.species}`, merge: p.mergeForProduction, skinned: p.rigMode === 'skinned', zones, pose, coat: coatOn || coat.smooth ? coat : null, seamRadius: 0.05 * S.H, seams: L.elephant ? [['head', 'trunk']] : [['head', 'body']] });
  let tris = 0; root.traverse(m => { if (m.isMesh) tris += m.geometry.attributes.position.count / 3; });
  root.userData = {
    species: p.species, label: S.label, params: p, dimensions: measure(root), triangles: tris, zones: Object.fromEntries(Object.entries(zones).map(([k, v]) => [k, hexStr(v)])),
    bones: info.bones, parts: build.parts.map(pt => pt.name), stance: S.stance,
  };
  RIGS.set(root, { rig: rigB, info, skeleton });
  return root;
}

export default createAsset;
