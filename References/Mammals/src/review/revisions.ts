export const CRITERIA = [
  { key: 'skull', label: 'Skull', hint: 'Braincase shape, rounded occiput, brow shelf, cheek / zygomatic flare' },
  { key: 'head', label: 'Head shape', hint: 'Muzzle length & taper, stop, jaw / jowl, nose, eye placement' },
  { key: 'ears', label: 'Ears', hint: 'Outline, carriage, conch roll at the root, junction with skull' },
  { key: 'torso', label: 'Torso & rear', hint: 'Topline, keel, waist, croup slope, rounded buttocks (no flat rear)' },
  { key: 'hind', label: 'Rear-leg connection', hint: 'Quarter mass flush with flank, stifle at the flank fold, hock placement' },
  { key: 'overall', label: 'Overall', hint: 'Proportions, silhouette, colouring, tail, horns' },
] as const;

export type CriterionKey = (typeof CRITERIA)[number]['key'];
export type Verdict = 'pending' | 'pass' | 'issue';
export interface Review { verdicts: Partial<Record<CriterionKey, Verdict>>; notes: string; updated?: number }

export const REVISIONS: { area: string; problem: string; fix: string }[] = [
  {
    area: 'Source file',
    problem: 'The published mammal-rig.mjs is cut off at 98,177 bytes, partway through tetraMane(). The species table, palettes, zones, params, coat painter, createAsset, clips and pose code were all missing.',
    fix: 'Rebuilt everything after that point as part of the same standalone module: 43 species presets, 15 colour zones, 14 coat patterns, params / rig / detach / night metadata, createAsset, createClips and setPose.',
  },
  {
    area: 'Torso rear',
    problem: 'The rump station sat only 4% of body length behind the haunch, with a 30% width step and a 0.32× rear cap. The rear read as a flat disc.',
    fix: 'The rump station moved 10% forward of the point of buttock. The croup now slopes to the tail head, the buttocks curve under, the 0.95× cap uses 5 rings, and a hamstring bulge swells the lower-rear quadrant.',
  },
  {
    area: 'Torso section',
    problem: 'Elliptical sections (exponent 2.1) everywhere made the barrel look like a tube.',
    fix: 'The section exponents now vary along the body: a broad back (2.35), a keeled chest and a rounded belly (1.85) that blend to round at the neck and rump.',
  },
  {
    area: 'Rear-leg connection',
    problem: 'The thigh was a 0.06H tube poked into the underside of the rump, so legs looked stuck on.',
    fix: 'The quarter is now sized from the body: 42% of rump depth front-to-back and 36% of haunch half-width side-to-side, with its outer face flush with the flank. It rises from a buried root under the croup and narrows to the stifle at the flank fold. Skin weights blend the quarter from Hips into Thigh.',
  },
  {
    area: 'Stifle / hock',
    problem: "The stifle's forward offset scaled with shoulder height (tiny on small, crouched mammals), and crouched hocks poked out behind the rump.",
    fix: 'The stifle offset now scales with hip height. Crouched hocks tuck under the rump at zB + 13% of body length, and the tibia slope depends on stance (ungulate 0.92, others 0.80).',
  },
  {
    area: 'Skull',
    problem: 'A 0.32× back cap gave a flat occiput, and the braincase was a straight tapered tube.',
    fix: 'The occiput uses a rounded 0.72× cap with 3 rings, the braincase is egg-shaped (wider behind the eyes), and a supraorbital brow ridge adds height and width over the eyes.',
  },
  {
    area: 'Neck to skull',
    problem: 'Short, thick necks (pig, hippo, bear, rhino, elephant) ended in a visible collar or disc around the head.',
    fix: 'The throat-latch sections are capped to the skull size, the neck tapers near-linearly from root to skull, a minimum neck run is enforced, and the cap is rounded (0.62×).',
  },
  {
    area: 'Ears',
    problem: 'The pinna entered the skull at a pinched 42%-width point, and hanging fan ears flattened into horizontal slabs.',
    fix: 'The conch rolls into a tube at the root, an auricular muscle mound blends each ear into the skull, and any explicit hang angle forces the hanging carriage (fixes the elephant).',
  },
];
