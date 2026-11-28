/*
 * HERP RIG — procedural, skinned reptiles and amphibians for three.js
 * One rig for every reptile and amphibian (Digital Diorama revision 11). Each animal is laid out from a measured
 * reference — proportions taken from photographs, skeletons and field-guide measurements, written as fractions of
 * its snout–vent, total or carapace length — built from swept surfaces with a painted skin (scales, scutes and
 * markings rasterised into one texture), skinned to one skeleton and animated by clips that plant its feet.
 *
 * QUICK START
 *   import { createAsset, createClips } from './herp-rig.mjs';
 *   const croc = createAsset({ species: 'nile-crocodile', mergeForProduction: true });
 *   scene.add(croc);
 *   const mixer = new THREE.AnimationMixer(croc);
 *   mixer.clipAction(createClips(croc).find(c => c.name === 'walk')).play();
 *
 * BODY PLANS
 *   saurian    lizards, the tuatara, chameleons, crocodilians, salamanders and newts: one loft from inside the skull
 *              to the tail tip through measured sections; sprawling limbs solved from each girdle joint to where the
 *              hand or foot rests; crests, dewlaps, frills, casques, osteoderms, teeth, gills, fins and skin folds.
 *   ophidian   snakes and the caecilian: a chain of 30-45 bones under one loft, resting in a serpenoid S; hoods,
 *              rattles and horns.
 *   chelonian  tortoises, box turtles and sea turtles: a thick polar shell with painted scutes (vertebrals, costals,
 *              marginals, growth rings), plastron and bridges; legs or flippers; a neck that withdraws.
 *   anuran     frogs and toads: sitting nose-up on propped forelegs, hind legs folded in a Z, protruding eyes, a
 *              throat that pumps, parotoid glands and warts.
 * SPECIES  28: green-iguana, komodo-dragon, frilled-lizard, leopard-gecko, tuatara, panther-chameleon, nile-crocodile,
 *          american-alligator, sand-lizard, green-anole, fire-salamander, chinese-giant-salamander, axolotl,
 *          alpine-newt, reticulated-python, king-cobra, sidewinder, common-garter-snake, caecilian,
 *          galapagos-tortoise, green-sea-turtle, eastern-box-turtle, american-bullfrog, cane-toad, common-toad,
 *          poison-dart-frog, red-eyed-tree-frog, glass-frog.
 * SPECS    ~8,500-18,000 triangles at standard detail; one solid material carrying the painted skin (+ gloss for wet
 *          amphibian skin and eyes in its alpha); merged = 1 draw call. +Z forward, +Y up, ground at y = 0; exact
 *          bounds in asset.userData.dimensions.
 * RIG      saurian: Root > Hips > Spine1 > Spine2 > Chest > Neck > Head > Jaw (> Tongue > TongueTip); Hips > Tail1..n;
 *          Chest > UpperArm > Forearm > Hand, Hips > Thigh > Shin > Foot (L/R); Dewlap, Frill*, Eye*, Gill*.
 *          ophidian: Root > Spine1..n > Tail1..m, Head > Jaw on Spine1; HoodL/R. chelonian: Root > Hips (shell) >
 *          Neck1-3 > Head > Jaw; Tail1-2; legs or flippers on Hips. anuran: Root > Hips > Spine > Chest > Head > Jaw
 *          (Throat, Tongue); Chest > UpperArm > Forearm > Hand; Hips > Thigh > Shin > Tarsus > Foot.
 * CLIPS    lizards, crocodilians and salamanders: idle, walk, trot (the frilled lizard runs on its hind legs), alert,
 *          graze, peck (the chameleon's tongue), roar (frill, dewlap, gape), sit (basking), swim (crocodilians,
 *          salamanders, newts); snakes: idle, walk (lateral undulation, or sidewinding), alert, peck (a strike),
 *          roar (the cobra rears and spreads its hood; the rattler rattles); turtles: idle, walk, alert, graze,
 *          peck, roar, sit (withdrawn into the shell), swim (sea turtle); frogs: idle (throat pumping), walk and trot
 *          (hops; toads walk), alert, peck (tongue), roar (the call), sit, hop (once). Gait and swim clips carry
 *          userData { gait, stride, speed, hipH } so playback can match ground speed. createClips(asset),
 *          setPose(asset, name, phase).
 * OPTIONS  species, size, tail / leg length, head size, colourway, painted skin, scale relief, skin grain, variation
 *          seed, detail, rig mode, pose, shading, hide parts.
 * PARTS    detach: crest, dewlap, frill, spines, fins, gills, eyes, eyelids, tongue, teeth, jaw, feet, shell.
 * LICENSE  CC0 1.0 Universal — this module and all generated geometry.
 */
import * as THREE from 'three';
import {
  TAU, DEG, clamp, lerp, sstep, bell, fract, V3, prof, vnoise, fbm, worley, hexStr, Part, makePath, knotUs, loft,
  emit, ellipsoid, tube, sheet, basisFrom, surfaceToward, spike, Rig, normW, mixW, bakeClip, applySample,
  COAT_RES, finish, measure, COLORWAY_KEYS, DETAIL, smooth01, twoBone, frameRot, qDeg, degQ, posed, setWorld,
  setPos, SIDES, bindModule
} from './kit.mjs';

/* ════════════════════════════════════════════════════════════════════════════
 *  HERP RIG  — +Z forward, +Y up, the animal's left = +X, ground at y = 0. Species tables are fractions of a reference
 *  length V: the snout–vent length of lizards, crocodilians, salamanders and frogs, the total length of snakes and the
 *  straight carapace length of turtles. Every vertex is skinned to one skeleton driven by the clips below.
 * ════════════════════════════════════════════════════════════════════════════ */

const BASE = {
  body: '#6a7a40', belly: '#d6cfa4', pattern: '#2e3220', marking: '#8a8a52', accent: '#d8b040', accent2: '#3a6ab0',
  skin: '#d89a90', lid: '#4a4a30', claw: '#2a261c', eye: '#c8a040', pupil: '#060504', mouth: '#e0a09a', tongue: '#c03a4a',
  teeth: '#f2ead6', shell: '#6a5f4a', seam: '#3a3226', plastron: '#c8b88a', web: '#5a5a3a',
};
const ZONE_ROLES = {
  body: 'body', belly: 'body', pattern: 'body', marking: 'body', accent: 'body', accent2: 'body', skin: 'soft', lid: 'soft', claw: 'keratin',
  eye: 'eye', pupil: 'pupil', mouth: 'soft', tongue: 'soft', teeth: 'keratin', shell: 'keratin', seam: 'keratin', plastron: 'keratin', web: 'soft',
};
// colour zones and parameter checks, bound to this rig's own zones and params
const { zonesFor, colorwaysFor, normalize, withZones } = bindModule({ BASE, ZONE_ROLES, params: () => params });
const ZONE_LABELS = {
  body: 'Back / skin', belly: 'Belly', pattern: 'Pattern (dark)', marking: 'Markings', accent: 'Accent (dewlap, frill, bars)', accent2: 'Second accent',
  skin: 'Soft skin / toe pads', lid: 'Eyelids / lips', claw: 'Claws / nails', eye: 'Iris', pupil: 'Pupil', mouth: 'Mouth', tongue: 'Tongue', teeth: 'Teeth',
  shell: 'Shell / scutes', seam: 'Scute seams', plastron: 'Plastron', web: 'Webbing',
};
const pal = (o) => ({ ...BASE, ...o });

/**
 * Forward kinematics of a sample: world rotation and world head position of every bone (rest bones carry identity rotation,
 * so a bone's world rotation is the product of its chain's local rotations). Memoised per bone.
 */
function fkOf(info, s) {
  const memo = new Map();
  const get = (name) => {
    if (memo.has(name)) return memo.get(name);
    const par = info.parent[name], v = s[name], r = !v ? null : Array.isArray(v) ? v : v.r, p = v && !Array.isArray(v) ? v.p : null;
    const qL = degQ(r), rest = info.rest[name];
    let out;
    if (!par) out = { q: qL, p: V3(rest[0] + (p ? p[0] : 0), rest[1] + (p ? p[1] : 0), rest[2] + (p ? p[2] : 0)) };
    else {
      const P = get(par), off = V3(rest[0] + (p ? p[0] : 0), rest[1] + (p ? p[1] : 0), rest[2] + (p ? p[2] : 0)).applyQuaternion(P.q);
      out = { q: P.q.clone().multiply(qL), p: P.p.clone().add(off) };
    }
    memo.set(name, out);
    return out;
  };
  return get;
}
const addRot = (s, b, r) => { const v = s[b]; if (!v) s[b] = r.slice(); else if (Array.isArray(v)) { v[0] += r[0]; v[1] += r[1]; v[2] += r[2]; } else { v.r = v.r || [0, 0, 0]; v.r[0] += r[0]; v.r[1] += r[1]; v.r[2] += r[2]; } };

/* ════════════════════════════════════════════════════════════════════════════
 *  SHARED PARTS
 * ════════════════════════════════════════════════════════════════════════════ */

/**
 * Body loft through measured stations [s, half-width, half-height above, half-height below] (× V) along a centre path
 * (s = distance from the snout tip, × V), skinned along an axial bone chain. `path(s)` gives the centre; `sect` and `bump`
 * shape sections. Returns the loft with `sOf(u)`, the body coordinate of loft parameter u.
 */
function bodyLoft(B, o) {
  const { keys, path, V } = o;
  const pts = keys.map(k => path(k[0])), curve = makePath(pts), ku = knotUs(curve, pts.length);
  const pW = prof(keys.map((k, i) => [ku[i], k[1] * V])), pT = prof(keys.map((k, i) => [ku[i], k[2] * V])), pB = prof(keys.map((k, i) => [ku[i], k[3] * V]));
  const sOf = prof(keys.map((k, i) => [ku[i], k[0]]));
  const g = loft({ curve, seg: o.seg, rad: o.rad, w: pW, ht: pT, hb: pB, nt: o.nt ?? 2.1, nb: o.nb ?? 1.9, up: o.up ?? [0, 1, 0],
    cap0: o.cap0 ?? { type: 'round', len: 0.5, n: 3 }, cap1: o.cap1 ?? { type: 'round', len: 0.9, n: 3 }, bend: o.bend ?? 0.7, bump: o.bump, sect: o.sect, level: o.level, dist: o.dist });
  g.sOf = sOf; g.ku = ku; g.keyS = keys.map(k => k[0]);
  return g;
}

/**
 * Head: a skull loft from the occiput to the snout tip through sections [u, half-width, top, bottom, rise] (× head length;
 * `rise` lifts the section's centre), and a lower jaw hinged under the back of the skull through [u, half-width, depth,
 * drop] (u along the jaw from the hinge to the chin). The jaw's top fits inside the skull's lower edge, so the mouth reads
 * as a closed line that opens on the Jaw bone.
 */
function buildHead(B, S, L, o) {
  const det = B.det, rig = B.rig, H = o.len, O = o.occiput, hd = o.dir.clone().normalize(), hu = o.up.clone().normalize();
  const side = new THREE.Vector3().crossVectors(hu, hd).normalize();
  const at = (u, rise = 0, x = 0) => O.clone().addScaledVector(hd, u * H).addScaledVector(hu, rise * H).addScaledVector(side, x * H);
  const sk = o.skull;
  const pts = sk.map(k => at(k[0], k[4] || 0)), curve = makePath(pts), ku = knotUs(curve, pts.length);
  const pW = prof(sk.map((k, i) => [ku[i], k[1] * H])), pT = prof(sk.map((k, i) => [ku[i], k[2] * H])), pB = prof(sk.map((k, i) => [ku[i], k[3] * H]));
  // (a flat-bottomed skull and a flat-topped jaw: their lip lines meet flush along the side of the closed mouth)
  const g = loft({ curve, seg: Math.round((o.seg ?? 20) * det), rad: 2 * Math.round((o.rad ?? 9) * det + 3), w: pW, ht: pT, hb: pB, nt: o.nt ?? 2.2, nb: o.nb ?? 3.2, up: hu,
    cap0: o.cap0 ?? { type: 'round', len: 0.55, n: 3 }, cap1: o.cap1 ?? { type: 'round', len: o.tipCap ?? 0.5, n: 3 }, bend: 0.3, bump: o.bump, sect: o.sect });
  g.scales = o.scales;
  const headBone = o.bone ?? 'Head';
  rig.add(headBone, o.parent, O.clone().addScaledVector(hd, 0.08 * H), at(1));
  const HW = rig.W(headBone);
  emit(B.part('head', { group: 'head' }), g, (u, a, P) => B.paint({ part: 'head', u, a, P, head: o }), HW);
  // lower jaw: hinged under the back of the skull, its top tucked just inside the skull's lower edge (the lip line) all
  // the way to the chin, so the closed mouth reads as one line; [k (hinge 0 → chin 1), half-width, depth, extra drop]
  let jaw = null;
  if (o.jaw) {
    const jk = o.jaw, hingeU = jk.hinge ?? 0.12, tipU = jk.tip ?? 0.98, ov = jk.overlap ?? 0.03;
    const bot = prof(sk.map(k => [k[0], k[3]])), rise = prof(sk.map(k => [k[0], k[4] || 0]));
    const cl = (k, depth, drop = 0) => { const hu = lerp(hingeU, tipU, k); return at(hu, rise(hu) - bot(hu) + ov - 0.45 * depth - drop); };
    const jpts = jk.p.map(k => cl(k[0], k[2], k[3] ?? 0));
    const hinge = jpts[0].clone().addScaledVector(hu, (jk.hingeUp ?? 0.1) * H);
    const jc = makePath(jpts), jku = knotUs(jc, jpts.length);
    jaw = loft({ curve: jc, seg: Math.round((o.seg ?? 20) * 0.8 * det), rad: 2 * Math.round(6 * det + 2), w: prof(jk.p.map((k, i) => [jku[i], k[1] * H])),
      ht: prof(jk.p.map((k, i) => [jku[i], k[2] * H * 0.45])), hb: prof(jk.p.map((k, i) => [jku[i], k[2] * H * 0.55])), nt: jk.nt ?? 3.2, nb: jk.nb ?? 2.0, up: hu,
      cap0: { type: 'round', len: 0.6, n: 2 }, cap1: { type: 'round', len: jk.tipCap ?? 0.6, n: 2 }, bend: 0.4 });
    jaw.scales = o.scales;
    rig.add(o.jawBone ?? 'Jaw', headBone, hinge, jpts[jpts.length - 1]);
    // (frogs: the floor of the mouth, the throat, rides a Throat bone that pumps air and swells into the vocal sac)
    let jawSkin = rig.W(o.jawBone ?? 'Jaw');
    if (o.throat) {
      const tc = at(lerp(hingeU, tipU, 0.4), -0.3);
      rig.add('Throat', headBone, tc, tc.clone().addScaledVector(hu, -0.2 * H));
      const WJ = rig.W(o.jawBone ?? 'Jaw'), WT = rig.W('Throat');
      jawSkin = (u, a) => { const k = clamp((-Math.sin(a) - 0.2) / 0.6, 0, 1) * Math.sin(Math.PI * clamp(u * 1.1, 0, 1)); return k > 0.01 ? mixW(WJ, WT, k * 0.9) : WJ; };
    }
    emit(B.part('jaw', { group: 'head' }), jaw, (u, a, P) => (Math.sin(a) > 0.93 ? 'mouth' : B.paint({ part: 'jaw', u: lerp(hingeU, tipU, u), a, P, head: o })), jawSkin);
    jaw.cl = cl;
  }
  // eyes
  const eyes = [];
  if (o.eye) {
    const e = o.eye, r = e.r * H, ctr = at(e.u ?? 0.55, e.rise ?? 0.05);
    for (const sd of [1, -1]) {
      const dir = hd.clone().multiplyScalar(Math.cos((e.yaw ?? 75) * DEG)).addScaledVector(side, sd * Math.sin((e.yaw ?? 75) * DEG)).addScaledVector(hu, e.up ?? 0.25).normalize();
      let c, look;
      if (e.at) {
        // placed on the skull directly: `at` = [across, up] as fractions of the half-width and the crown's height at u,
        // looking out at `elev` degrees above the side (frogs: the two eyes stand apart on top of the flat head)
        const eu = e.u ?? 0.55, wU = prof(sk.map(k => [k[0], k[1]]))(eu), tU = prof(sk.map(k => [k[0], k[2]]))(eu), rU = prof(sk.map(k => [k[0], k[4] || 0]))(eu);
        c = at(eu, rU + e.at[1] * tU, sd * e.at[0] * wU);
        const el = (e.elev ?? 35) * DEG;
        look = side.clone().multiplyScalar(sd * Math.cos(el)).addScaledVector(hu, Math.sin(el)).addScaledVector(hd, Math.cos((e.yaw ?? 75) * DEG)).normalize();
      } else {
        const hit = surfaceToward(g, ctr, dir, clamp((e.u ?? 0.55) - 0.25, 0.02, 0.95), clamp((e.u ?? 0.55) + 0.25, 0.05, 0.98));
        c = hit.p.clone().addScaledVector(hit.n, -r * (e.inset ?? 0.45) + (e.bulge ?? 0) * r); look = hit.n.clone().lerp(dir, 0.5).normalize();
      }
      const pupil = e.pupil ?? 'round';
      // (independently turning eyes, chameleons: each eye, and its turret, on its own bone)
      const EW = e.bones ? rig.W(rig.add(sd > 0 ? 'EyeL' : 'EyeR', headBone, c, c.clone().addScaledVector(look, r)).name) : HW;
      const eb = ellipsoid(c, r, r, r, look, hu, Math.round(6 * det + 2), 2 * Math.round(5 * det + 2));
      const bas = basisFrom(look, hu);
      emit(B.part('eyes', { group: 'head' }), eb, (u, a, P) => {
        if (u < 0.72) return 'eye';
        const q = P.clone().sub(c), x = q.dot(bas.s) / r, y = q.dot(bas.u) / r;
        // slit (vertical), bar (horizontal: toads, sheep-eyed frogs) or round pupils
        const inP = pupil === 'slit' ? Math.abs(x) < 0.12 && Math.abs(y) < 0.55 : pupil === 'bar' ? Math.abs(y) < 0.16 && Math.abs(x) < 0.5 : Math.hypot(x, y) < (e.pupilR ?? 0.42);
        return inP ? 'pupil' : 'eye';
      }, EW);
      // lids: a ring round the eye (turret lids for chameleons: a cone of skin leaving a small hole)
      if (e.turret) {
        const tl = loft({ pts: [c.clone().addScaledVector(look, -r * 0.4), c.clone().addScaledVector(look, r * 0.55)], seg: 4, rad: 2 * Math.round(5 * det + 3), up: hu,
          w: (u) => r * lerp(1.15, 0.42, u * u), ht: (u) => r * lerp(1.15, 0.42, u * u), hb: (u) => r * lerp(1.15, 0.42, u * u), cap0: 'open', cap1: 'open', bend: 0 });
        tl.scales = o.scales;
        emit(B.part('eyelids', { group: 'head' }), tl, (u, a, P) => B.paint({ part: 'head', u: e.u ?? 0.55, a, P, head: o, lid: true }), EW);
      } else if (e.lid !== false && det >= 0.8) {
        const ring = [];
        for (let i = 0; i < 14; i++) { const t = (i / 14) * TAU; ring.push(c.clone().addScaledVector(look, r * 0.25).addScaledVector(bas.s, Math.cos(t) * r * 1.02).addScaledVector(bas.u, Math.sin(t) * r * (e.lidH ?? 0.95))); }
        emit(B.part('eyelids', { group: 'head' }), loft({ pts: ring, closed: true, seg: 14, rad: 5, w: r * 0.2, ht: r * 0.2, hb: r * 0.2, up: look }), 'lid', HW);
      }
      eyes.push({ c, r, look, side: sd });
    }
  }
  return { g, jaw, eyes, at, hd, hu, side, H, O, bone: headBone };
}

/**
 * Tongue: at rest it lies along the floor of the closed mouth on two bones, Tongue (the root) and TongueTip (the forked
 * or clubbed tip). The clips flick it out by moving TongueTip forward, which stretches the shaft between them (linear
 * blend skinning keeps its girth): a snake's or monitor's forked flick, a chameleon's or frog's projectile tongue.
 */
function buildTongue(B, S, L, head, o) {
  const rig = B.rig, H = head.H, det = B.det;
  const root = head.at(o.root ?? 0.3, o.rise ?? -0.1), tip = head.at(o.tip ?? 0.86, o.rise ?? -0.1);
  const par = rig.has('Jaw') ? 'Jaw' : head.bone, fork = o.fork ?? 0, club = o.club ?? 0;
  const forkAt = root.clone().lerp(tip, fork ? 1 - fork : 0.92);
  rig.add('Tongue', par, root, forkAt);
  rig.add('TongueTip', 'Tongue', forkAt, tip);
  const w = (o.w ?? 0.035) * H, part = B.part('tongue', { group: 'head' }), Wt = rig.W('TongueTip');
  emit(part, tube([root, forkAt], (u) => w * (1 - 0.25 * u), Math.round(4 * det + 2), 6), 'tongue', (u) => rig.W2('Tongue', 'TongueTip', u));
  if (fork) for (const sd of [1, -1]) emit(part, tube([forkAt, tip.clone().addScaledVector(head.side, sd * fork * H * 0.22)], (u) => w * 0.62 * (1 - 0.8 * u), 3, 5, { cap1: 'point' }), 'tongue', Wt);
  if (club) emit(part, ellipsoid(forkAt.clone().lerp(tip, 0.5), club * H, club * H * 0.8, forkAt.distanceTo(tip) * 0.6, head.hd, head.hu, 4, 8), 'tongue', Wt);
  L.tongue = { ext: (o.ext ?? 0.6) * H, dir: head.hd.clone(), up: head.hu.clone() };
}

/**
 * Digits from a palm: each [angle (deg, + = toward the animal's left of the limb's forward), length, base offset across,
 * thickness]; they arch off the palm and run down to touch the ground at the tip, ending in a claw, a pad or nothing.
 */
function buildDigits(B, S, L, o) {
  const { part, base, fwd, lat, side, W, digits } = o, det = B.det;
  const r0 = o.r, groundY = o.ground ?? 0, out = [];
  for (const [ang, len, off, thk] of digits) {
    // (+ angles turn a digit toward the outside of the limb on either side, so the specs mirror)
    const a = ang * DEG, dir = fwd.clone().multiplyScalar(Math.cos(a)).addScaledVector(lat, Math.sin(a)).normalize();
    const b = base.clone().addScaledVector(lat, off * r0).addScaledVector(dir, r0 * 0.2);
    // (a thick digit's root sits high enough on the palm that its underside clears the ground)
    b.y = Math.max(b.y, groundY + r0 * (thk ?? 0.5) * 1.02);
    const e = b.clone().addScaledVector(dir, len);
    const m = b.clone().lerp(e, 0.45); m.y = Math.max(m.y, Math.max(b.y, e.y) + len * (o.arch ?? 0.12));
    const tipY = groundY + r0 * (thk ?? 0.5) * 0.9;
    e.y = o.lift !== undefined ? b.y + o.lift : tipY;
    const t = r0 * (thk ?? 0.5);
    const pts = [b, m, e];
    emit(part, tube(pts, (u) => t * (1 - 0.35 * u) * (o.pad && u > 0.82 ? o.pad : 1), Math.round(5 * det + 2), 2 * Math.round(2 * det + 2), { cap1: { type: 'round', len: 0.8, n: 2 } }), (u, a2, P) => (o.pad && u > 0.85 ? 'skin' : B.paint({ part: 'foot', u, a: a2, P, front: o.front, side })), W);
    let tip = e.clone().addScaledVector(dir, t);
    if (o.claw) {
      const cl = o.claw * t, cs = e.clone().addScaledVector(dir, t * 0.6);
      // (curved down toward the ground, but never into it)
      tip = cs.clone().addScaledVector(dir, cl).add(V3(0, -Math.min(cl * 0.45, cs.y - groundY - t * 0.06), 0));
      emit(part, tube([cs, cs.clone().addScaledVector(dir, cl * 0.7).add(V3(0, cl * 0.1, 0)), tip], (u) => t * 0.42 * (1 - u * 0.9), 4, 4, { cap1: 'point' }), 'claw', W);
    }
    out.push({ b, e, dir, t, tip });
  }
  // webbing between neighbouring digits (aquatic frogs, crocodilian hind feet, turtles)
  if (o.web && out.length > 1) {
    for (let i = 0; i < out.length - 1; i++) {
      const A = out[i], Bd = out[i + 1];
      sheet(part, { nu: 3, nv: 3, f: (u, v) => { const p0 = A.b.clone().lerp(A.e, u * o.web), p1 = Bd.b.clone().lerp(Bd.e, u * o.web); const q = p0.lerp(p1, v); q.y = Math.max(q.y - 0.15 * Math.sin(Math.PI * v) * (A.t + Bd.t) * u * 0.5, groundY + (A.t + Bd.t) * 0.12); return q; },
        th: (A.t + Bd.t) * 0.12, zone: 'web', skin: W });
    }
  }
  return out;
}

/**
 * A limb lofted through its joints with a muscle profile, ending at a hand / foot palm with digits. `J` are the joints
 * (girdle, middle, end, palm), `R` radii at stations along the limb, bones the limb's bones (upper, lower, autopod).
 */
function buildLimb(B, S, L, lm) {
  const det = B.det, rig = B.rig, J = lm.J;
  // bones
  lm.bones.forEach((n, i) => rig.add(n, i === 0 ? lm.parent : lm.bones[i - 1], J[i], J[i + 1]));
  // surface: girdle (inside the body) → middle joint → end joint, with bulges
  const pts = [J[0].clone().lerp(J[1], -0.15), J[0], J[0].clone().lerp(J[1], 0.5), J[1], J[1].clone().lerp(J[2], 0.5), J[2]];
  const curve = makePath(pts), ku = knotUs(curve, pts.length);
  const R = lm.R; // [girdle, upper mid, middle joint, lower mid, end joint]
  const pr = prof([[ku[0], R[0] * 0.7], [ku[1], R[0]], [ku[2], R[1]], [ku[3], R[2]], [ku[4], R[3]], [ku[5], R[4]]]);
  const g = loft({ curve, seg: Math.round(14 * det), rad: 2 * Math.round(5 * det + 2), w: pr, ht: (u) => pr(u) * (lm.flat ?? 1), hb: (u) => pr(u) * (lm.flat ?? 1), nt: 2, nb: 2,
    up: lm.up ?? [0, 1, 0], cap0: { type: 'round', len: 0.6, n: 2 }, cap1: { type: 'round', len: 0.6, n: 2 }, bend: 0.5 });
  g.scales = lm.scales;
  const spec = rig.spec(lm.bones.slice(0, 2), [ku[1], ku[3]], 0.35);
  const skin = (u) => (u < ku[1] ? rig.W2(lm.parent, lm.bones[0], sstep(ku[0], ku[1], u)) : rig.chain(spec, u));
  const nm = `leg-${lm.front ? 'front' : 'hind'}-${lm.side > 0 ? 'left' : 'right'}`;
  emit(B.part(nm, { group: 'legs' }), g, (u, a, P) => B.paint({ part: 'leg', u, a, P, front: lm.front, side: lm.side }), skin);
  lm.grid = g;
  // palm and digits
  const foot = B.part(`foot-${nm.slice(4)}`, { group: 'feet' }), Wf = rig.W(lm.bones[2]);
  const fwd = V3(J[3].x - J[2].x, 0, J[3].z - J[2].z); if (fwd.lengthSq() < 1e-12) fwd.set(0, 0, 1); fwd.normalize();
  const lat = V3(fwd.z, 0, -fwd.x).multiplyScalar(lm.side); // toward the animal's outside
  const pr2 = lm.palm;
  const palmC = J[2].clone().lerp(J[3], 0.55); palmC.y = Math.max(pr2.h, palmC.y);
  const pg = ellipsoid(palmC, pr2.w, pr2.h, pr2.l, fwd, [0, 1, 0], 5, 2 * Math.round(5 * det + 2));
  pg.scales = lm.scales;
  emit(foot, pg, (u, a, P) => B.paint({ part: 'foot', u, a, P, front: lm.front, side: lm.side }), Wf);
  const base = palmC.clone().addScaledVector(fwd, pr2.l * 0.55); base.y = pr2.h * 1.1;
  lm.digits = buildDigits(B, S, L, { part: foot, base, fwd, lat: lat.clone().multiplyScalar(-1).multiplyScalar(-1), side: lm.side, W: Wf, r: pr2.w, digits: lm.digitSpec, claw: lm.claw, pad: lm.pad, web: lm.web, front: lm.front, arch: lm.arch, ground: 0 });
  // surface points for poses that keep the limb above the ground
  lm.surf = [];
  for (let k = 0; k < g.rows.length; k += 2) for (let j = 0; j < g.R; j += 2) { const P = g.rows[k][j]; lm.surf.push({ P: P.clone(), W: skin(g.us[k]) }); }
  for (const row of pg.rows) for (const P of row) lm.surf.push({ P: P.clone(), W: Wf });
  return lm;
}

/**
 * Scales of a part, from the species: cells of `cell` texels; kinds 'granular' | 'keeled' | 'plates'; null for smooth skin.
 * Smaller scales on the head and legs.
 */
function scalesOf(S, part) {
  const sc = S.scales;
  if (!sc) return null;
  const k = part === 'head' ? sc.headK ?? 0.7 : part === 'leg' ? sc.legK ?? 0.8 : part === 'tail' ? sc.tailK ?? 1 : 1;
  const kind = part === 'belly' ? sc.belly ?? 'plates' : part === 'leg' && sc.legKind ? sc.legKind : sc.kind;
  return { kind, cell: Math.max(2.2, sc.cell * k), width: sc.width ?? 0.11, dark: sc.dark ?? 0.72, light: sc.light ?? 0.1, stretch: sc.stretch, zones: sc.zones ?? null };
}

/* ════════════════════════════════════════════════════════════════════════════
 *  PAINTER — every painted surface asks it for a zone at a point: the part, the body station s (× V from the snout
 *  tip; heads map their own length onto it, so a pattern runs on from the neck), the section angle a (π/2 = the
 *  top, 3π/2 = the belly) and the rest position P. Species list pattern layers, applied in order (a later layer
 *  paints over an earlier one):
 *    belly    { k }                         the underside below sin(a) = -k, edge broken by a little noise
 *    bands    { from, to, period, duty, top, bottom, wobble }    crossbands (tail rings with top = -1)
 *    bars     { ... same, on the flanks only }                    vertical flank bars
 *    stripe   { a0, w, from, to }           a stripe along the body at a0 degrees from the dorsal midline (±)
 *    spots    { f, r, from, to, top }       round spots (cells of 1/f × V), radius r of a cell
 *    mottle   { f, k, from, to, top }       blotchy mottling (fBm above k)
 *    net      { f, w, from, to, top }       a reticulated net (python, giant salamander)
 *    saddles  { period, from, to, w, l, edge }   dorsal saddles or diamonds
 *    grooves  { from, to, n, w, top, bottom }    costal grooves
 *    ocelli   { f, r, ring, from, to, top } light-centred eyespots
 *  Every layer takes `zone`, and `parts` (the parts it paints: body, neck, tail, head, jaw, leg, foot, ...).
 * ════════════════════════════════════════════════════════════════════════════ */
function makePainter(S, L) {
  const layers = S.paint || [], seed = S.seed ?? 7, V = S.V;
  const hd = S.headPaint || null;
  const inS = (ly, s) => (ly.from === undefined || s >= ly.from) && (ly.to === undefined || s <= ly.to);
  const inA = (ly, up) => (ly.top === undefined || up >= ly.top) && (ly.bottom === undefined || up <= ly.bottom);
  return (c) => {
    if (c.lid) return 'lid';
    const part = c.part;
    if (part === 'frill' && S.frillPaint) return S.frillPaint(c);
    const P = c.P || V3(), q = P.clone().divideScalar(V);
    // the station: bodies pass theirs; heads and jaws map the head's length onto it (u = 0 at the occiput)
    let s = c.s;
    if (s === undefined) s = part === 'head' || part === 'jaw' ? (1 - (c.u ?? 0)) * (L.T ? L.T.head.len : 0.2) : part === 'leg' || part === 'foot' ? (c.front ? (L.T ? L.T.sh : 0.35) : (L.T ? L.T.hip : 0.9)) : 0.5;
    // the up-ness of the surface: limbs and heads from their section angle too
    const up = c.a !== undefined ? Math.sin(c.a) : 0;
    if (part === 'head' || part === 'jaw') {
      const fz = faceZone(S, L, c); if (fz) return fz;
      if (hd) { const z = hd(c, L, q); if (z) return z; }
    }
    let z = 'body';
    for (const ly of layers) {
      if (ly.parts && !ly.parts.includes(part)) continue;
      if (!inS(ly, s) || !inA(ly, up)) continue;
      const zn = ly.zone ?? 'pattern';
      switch (ly.type) {
        case 'belly': {
          const k = (ly.k ?? 0.45) + (ly.noise ?? 0.08) * (vnoise(q.x * 14, q.y * 14, q.z * 14, seed + 3) - 0.5) * 2;
          if (up < -k) z = zn;
          break;
        }
        case 'bands': case 'bars': case 'rings': {
          const per = ly.period, w = (ly.wobble ?? 0) * (vnoise(q.x * 8, q.y * 8, q.z * 8, seed + 11) - 0.5);
          const ph = fract((s - (ly.from ?? 0)) / per + w + (ly.phase ?? 0));
          if (ph < (ly.duty ?? 0.4)) {
            if (ly.type === 'bars') { if (Math.abs(up) < (ly.flank ?? 0.75)) z = zn; } else z = zn;
          }
          break;
        }
        case 'stripe': {
          // angle from the dorsal midline (0) round to the belly (180), either side
          const ad = Math.abs(((c.a ?? Math.PI / 2) - Math.PI / 2 + 3 * Math.PI) % TAU - Math.PI) / DEG;
          const w = ly.w * (1 + (ly.wobble ?? 0) * (vnoise(s * 9, 0, 0, seed + 5) - 0.5));
          if (Math.abs(ad - ly.a0) < w / 2) z = zn;
          break;
        }
        case 'spots': case 'ocelli': {
          const f = ly.f, [d1] = worley(q.x * f, q.y * f * (ly.fy ?? 1), q.z * f, seed + (ly.seed ?? 21));
          if (d1 < ly.r) z = ly.type === 'ocelli' && d1 < ly.r * (ly.ring ?? 0.45) ? ly.inner ?? 'marking' : zn;
          break;
        }
        case 'mottle': {
          const v = fbm(q.x * ly.f, q.y * ly.f, q.z * ly.f, seed + (ly.seed ?? 31), 3);
          if (v > ly.k) z = zn;
          break;
        }
        case 'net': {
          const [d1, d2] = worley(q.x * ly.f, q.y * ly.f * (ly.fy ?? 1), q.z * ly.f * (ly.fz ?? 1), seed + (ly.seed ?? 41));
          if (d2 - d1 < ly.w) z = zn;
          break;
        }
        case 'saddles': {
          const per = ly.period, ph = fract((s - ly.from) / per + (ly.phase ?? 0)) - 0.5;
          const ad = Math.abs(((c.a ?? Math.PI / 2) - Math.PI / 2 + 3 * Math.PI) % TAU - Math.PI) / DEG;
          // a lozenge: half-length l (of the period) on the midline, narrowing to half-width w degrees round the body
          const r = Math.abs(ph) / (ly.l ?? 0.3) + ad / (ly.w ?? 60) * (ly.diamond ? 1 : 0.0) + (ly.diamond ? 0 : (ad / (ly.w ?? 60)) ** 2);
          if (r < 1) z = ly.edge && r > (ly.core ?? 0.72) ? ly.edge : zn;
          break;
        }
        case 'grooves': {
          const n = ly.n, t = (s - ly.from) / (ly.to - ly.from), ph = fract(t * n);
          if (ph < (ly.w ?? 0.12) && Math.abs(up) < (ly.flank ?? 0.7)) z = zn;
          break;
        }
        case 'fn': { const r = ly.fn(c, s, up, q, L); if (r) z = r; break; }
        default: break;
      }
    }
    return z;
  };
}

/**
 * Face details in head coordinates (u along the head from the occiput, r up, x out to the side, all × head length):
 * the ear (tympanum), nostrils and lip scales, from the species' `face` spec.
 */
function faceZone(S, L, c) {
  const F = S.face;
  if (!F || !L.headO || !c.P) return null;
  const d = c.P.clone().sub(L.headO), u = d.dot(L.hd) / L.Hl, r = d.dot(L.hu) / L.Hl, x = Math.abs(d.dot(L.hside)) / L.Hl;
  if (F.ear && (u - F.ear.u) ** 2 + ((r - F.ear.r) / (F.ear.k ?? 1)) ** 2 < F.ear.R ** 2 && x > (F.ear.x ?? 0.15)) return F.ear.zone ?? 'lid';
  if (F.nostril && (u - F.nostril.u) ** 2 + (r - F.nostril.r) ** 2 + (x - F.nostril.x) ** 2 < F.nostril.R ** 2) return F.nostril.zone ?? 'pupil';
  if (F.lips && c.a !== undefined) {
    const sa = Math.sin(c.a);
    if (c.part === 'head' && sa < -F.lips[0] && sa > -F.lips[1] && u > (F.lips[3] ?? 0.1)) return F.lipZone ?? 'lid';
    if (c.part === 'jaw' && sa > F.lips[2] && u > (F.lips[3] ?? 0.1)) return F.lipZone ?? 'lid';
  }
  if (F.fn) return F.fn({ u, r, x, c }) || null;
  return null;
}

/** A thin triangular blade standing on `base` (crest spines, crocodilian tail scutes, fin rays): `fwd` along its base. */
function blade(part, base, up, fwd, h, len, th, zone, W, lean = 0) {
  const u = up.clone().normalize(), f = fwd.clone().normalize();
  const tipDir = u.clone().multiplyScalar(Math.cos(lean)).addScaledVector(f, -Math.sin(lean));
  sheet(part, { nu: 1, nv: 2, f: (a, b) => base.clone().addScaledVector(f, (b - 0.5) * len * (1 - a)).addScaledVector(tipDir, h * a), th: (a) => th * (1 - 0.7 * a), zone, skin: W });
}

/** Chameleon tail: straight back from the vent, then coiling down and under in a tightening spiral (curvature rising along it). */
function tailCurl(T, V, zOf, yOf, HB) {
  const c = T.curl, s0 = 1 + (c.from ?? 0.25) * T.tail, sE = 1 + T.tail, n = 240;
  let pts, ss;
  // (the coil's start is tipped up until no part of it, at its own thickness, reaches the ground)
  for (let lift = 0; lift < 90; lift += 3) {
    pts = []; ss = [];
    let p = V3(0, yOf(s0), zOf(s0)), th = ((c.pitch0 ?? 8) - lift) * DEG; // heading in the sagittal plane: 0 = straight back, + = turning down
    const k0 = (c.k0 ?? 1.2) / V, k1 = (c.k1 ?? 14) / V, ds = ((sE - s0) * V) / n;
    let low = Infinity;
    for (let i = 0; i <= n; i++) {
      const sg = s0 + (i / n) * (sE - s0);
      pts.push(p.clone()); ss.push(sg);
      low = Math.min(low, p.y - (HB(sg) + 0.004) * V);
      const k = lerp(k0, k1, (i / n) ** 1.6);
      th += k * ds;
      p = p.clone().add(V3(0, -Math.sin(th) * ds, -Math.cos(th) * ds));
    }
    if (low >= 0) break;
  }
  const at = (s) => { const f = clamp((s - s0) / (sE - s0), 0, 1) * n, i = Math.min(n - 1, Math.floor(f)); return pts[i].clone().lerp(pts[i + 1], f - i); };
  return { s0, at };
}

function saurianBuild(B, S, p, L) {
  const T = S.T, V = S.V, rig = B.rig, det = B.det;
  Object.assign(L, { plan: 'saurian', V, T, limbs: [] });
  const sMid = (T.sh + T.hip) / 2, sEnd = 1 + T.tail;
  const W = prof(T.body.map(k => [k[0], k[1]])), HT = prof(T.body.map(k => [k[0], k[2]])), HB = prof(T.body.map(k => [k[0], k[3]]));
  const yTab = prof(T.axis), sTouch = 1 + (T.tailTouch ?? 0.3) * T.tail;
  const zOf = (s) => (sMid - s) * V;
  // (a fin under the tail keeps it that much higher where it lies on the ground)
  const finB = T.finBelly ? prof(T.finBelly.h) : () => 0;
  const yOf = (s) => {
    if (s <= 1) return yTab(s) * V;
    const t = smooth01(clamp((s - 1) / Math.max(1e-6, sTouch - 1), 0, 1));
    return lerp(yTab(1) * V, (HB(s) + (s >= (T.finBelly ? T.finBelly.from : 9) ? finB(s) : 0) + 0.004) * V, t);
  };
  const curl = T.curl ? tailCurl(T, V, zOf, yOf, HB) : null;
  const path = (s) => (curl && s > curl.s0 ? curl.at(s) : V3(0, yOf(s), zOf(s)));
  Object.assign(L, { path, W, HT, HB, zOf, yOf, sEnd });

  /* ── axial skeleton: the chain runs forward from the hips (each bone owns the body from its head forward to its
     child's), the tail backward from the vent ── */
  const tr = T.hip - T.sh;
  const st = { Hips: T.hip, Spine1: T.hip - 0.12 * tr, Spine2: T.hip - 0.45 * tr, Chest: T.sh + 0.16 * tr, Neck: T.sh - 0.05 };
  rig.add('Root', null, V3(0, 0, 0));
  rig.add('Hips', 'Root', path(st.Hips));
  rig.add('Spine1', 'Hips', path(st.Spine1));
  rig.add('Spine2', 'Spine1', path(st.Spine2));
  rig.add('Chest', 'Spine2', path(st.Chest));
  rig.add('Neck', 'Chest', path(st.Neck), path(T.head.len));
  const nT = T.tailBones ?? 10, tailS = [];
  for (let i = 0; i < nT; i++) { const x = i / nT; tailS.push(1.02 + (T.tail - 0.02) * (0.45 * x + 0.55 * (1 - (1 - x) ** 1.45))); }
  const tailNames = tailS.map((_, i) => `Tail${i + 1}`);
  tailNames.forEach((n, i) => rig.add(n, i ? tailNames[i - 1] : 'Hips', path(tailS[i]), path(i < nT - 1 ? tailS[i + 1] : sEnd)));
  L.tailNames = tailNames; L.tailS = tailS; L.st = st;

  /* ── head ── */
  const hT = T.head, Hl = hT.len * V, pitch = (hT.pitch ?? 0) * DEG;
  const hd = V3(0, Math.sin(pitch), Math.cos(pitch)), hu = V3(0, Math.cos(pitch), -Math.sin(pitch));
  const O = path(hT.len).add(V3(0, (hT.dy ?? 0) * V, 0));
  // (the painter reads these to place the ear, nostrils and lips in head coordinates)
  Object.assign(L, { headO: O, hd, hu, Hl, hside: new THREE.Vector3().crossVectors(hu, hd).normalize() });
  const head = buildHead(B, S, L, { ...hT, len: Hl, occiput: O, dir: hd, up: hu, parent: 'Neck', scales: scalesOf(S, 'head'), seg: hT.seg ?? 22, rad: hT.rad ?? 9 });
  L.head = head;
  st.Head = hT.len - 0.08 * hT.len;
  if (hT.tongue) buildTongue(B, S, L, head, hT.tongue);

  /* ── body loft (neck → tail tip) ── */
  const seg = Math.round(det * (40 + 16 * T.tail) * (T.segK ?? 1)), rad = 2 * Math.round((T.rad ?? 9) * det + 3);
  const g = bodyLoft(B, { keys: T.body, path, V, seg, rad, nt: T.nt ?? 2.1, nb: T.nb ?? 2.3, cap0: { type: 'round', len: 0.4, n: 2 }, cap1: { type: 'point', len: 0.6 }, bend: 0.5, bump: T.bump ? T.bump(V) : undefined, sect: T.sect });
  g.scales = scalesOf(S, 'body');
  const uOf = prof(g.keyS.map((s, i) => [s, g.ku[i]]));
  const order = ['Head', 'Neck', 'Chest', 'Spine2', 'Spine1', 'Hips', ...tailNames];
  const startS = [0, st.Head, st.Neck, st.Chest, st.Spine2, st.Spine1, ...tailS];
  const spec = rig.spec(order, startS.map(s => uOf(s)), 0.32);
  const skinAx = (u) => rig.chain(spec, u);
  const skinAt = (s) => skinAx(uOf(s));
  Object.assign(L, { body: g, uOf, skinAx, skinAt });
  /** point and outward normal on the body surface at station s, section angle a (π/2 = top) */
  L.on = (s, a) => g.at(uOf(s), a);

  /* ── limbs ── */
  for (const [front, lm0, sG, parent] of [[true, T.fore, T.sh, 'Chest'], [false, T.hind, T.hip, 'Hips']]) {
    if (!lm0) continue;
    for (const [side, sx] of SIDES) {
      const c = path(sG);
      const J0 = V3(side * W(sG) * V * (lm0.inset ?? 0.6), c.y - (lm0.drop ?? 0.25) * HB(sG) * V, c.z + (lm0.dz ?? 0) * V);
      const ph = lm0.palm.h * V;
      const Tend = V3(side * lm0.foot[0] * V, (lm0.endH ?? 1.3) * ph, zOf(sG) + lm0.foot[1] * V);
      const la = lm0.upper * V, lb = lm0.lower * V;
      const J1 = twoBone(J0, Tend, la, lb, V3(side * lm0.pole[0], lm0.pole[1], lm0.pole[2]));
      const J2 = J1.clone().add(Tend.clone().sub(J1).setLength(lb));
      const yaw = (lm0.yaw ?? 20) * DEG, fwd = V3(side * Math.sin(yaw), 0, Math.cos(yaw));
      const J3 = J2.clone().addScaledVector(fwd, lm0.palm.l * V); J3.y = ph * 0.9;
      const names = (front ? ['UpperArm', 'Forearm', 'Hand'] : ['Thigh', 'Shin', 'Foot']).map(n => n + sx);
      const lm = buildLimb(B, S, L, {
        J: [J0, J1, J2, J3], bones: names, parent, R: lm0.R.map(r => r * V), flat: lm0.flat, up: [0, 1, 0], scales: scalesOf(S, 'leg'),
        palm: { w: lm0.palm.w * V, h: ph, l: lm0.palm.l * V * 0.5 }, digitSpec: lm0.digits.map(d => [d[0], d[1] * V, d[2], d[3]]),
        claw: lm0.claw, pad: lm0.pad, web: lm0.web, arch: lm0.arch, front, side,
      });
      Object.assign(lm, { la, lb, fwd0: fwd.clone(), yaw0: yaw * side, girdleS: sG, tipH: J2.y, pole: V3(side * lm0.pole[0], lm0.pole[1], lm0.pole[2]).normalize() });
      L.limbs.push(lm);
    }
  }

  /* ── the body itself (after the limbs, so their bones exist for nothing but order's sake) ── */
  const bodyPart = B.part('body', { group: 'body' });
  emit(bodyPart, g, (u, a, P) => { const s = g.sOf(u); return B.paint({ part: s > 1.02 ? 'tail' : s < T.sh - 0.03 ? 'neck' : 'body', s, u, a, P }); }, skinAx);

  saurianExtras(B, S, L);
  return L;
}

/* ── species features on the saurian body ── */
function saurianExtras(B, S, L) {
  const T = S.T, V = L.V, rig = B.rig, det = B.det, head = L.head;
  // dorsal crest (iguanas, the tuatara, frilled lizards' nuchal crest): flattened spines along the midline
  if (T.crest) {
    const c = T.crest, hp = prof(c.h), part = B.part('crest', { group: 'spines' }), n = Math.max(4, Math.round((c.to - c.from) / c.gap));
    for (let i = 0; i <= n; i++) {
      const s = lerp(c.from, c.to, i / n), h = hp(s) * V; if (h <= 0.002 * V) continue;
      const q = L.on(s, Math.PI / 2), f = L.path(s - 0.01).sub(L.path(s + 0.01)).normalize();
      const base = q.p.clone().addScaledVector(q.n, -h * 0.12);
      blade(part, base, q.n, f, h, c.gap * V * (c.base ?? 0.95), c.gap * V * (c.th ?? 0.22), c.zone ?? 'marking', L.skinAt(s), (c.lean ?? 28) * DEG);
    }
  }
  // dewlap (iguanas, anoles): a fold of throat skin on the hyoid; its free edge rides the Dewlap bone, which the display
  // clips swing forward and down to fan it out
  if (T.dewlap) {
    const d = T.dewlap, dp = prof(d.depth), part = B.part('dewlap', { group: 'head' });
    const hy = L.on(d.from + 0.3 * (d.to - d.from), 1.5 * Math.PI).p;
    rig.add('Dewlap', 'Head', hy, hy.clone().add(V3(0, -dp(lerp(d.from, d.to, 0.4)) * V, 0)));
    const Wd = rig.W('Dewlap');
    // its top edge follows the underside of the throat: the jaw's under the head, the neck's behind it
    const tops = new Map(), down = head.hu.clone().multiplyScalar(-1);
    const topAt = (s) => {
      if (tops.has(s)) return tops.get(s).clone();
      let q = L.on(s, 1.5 * Math.PI).p;
      if (head.jaw && s < T.head.len) {
        const hu = 1 - s / T.head.len, k = clamp((hu - (T.head.jaw.hinge ?? 0.12)) / ((T.head.jaw.tip ?? 0.98) - (T.head.jaw.hinge ?? 0.12)), 0, 1);
        const hit = surfaceToward(head.jaw, head.at(hu, -0.1), down, clamp(k - 0.08, 0, 1), clamp(k + 0.08, 0, 1));
        if (hit.p.y < q.y) q = hit.p;
      }
      q.x = 0; tops.set(s, q.clone());
      return q;
    };
    sheet(part, {
      nu: Math.round(10 * det + 4), nv: 4,
      f: (u, v) => { const s = lerp(d.from, d.to, u); return topAt(s).add(V3(0, -(dp(s) * V) * v + 0.004 * V, 0)); },
      th: 0.006 * V, zone: (u, v) => (v > 0.55 && d.edge ? d.edge : d.zone ?? 'accent'),
      skin: (u, v) => mixW(L.skinAt(lerp(d.from, d.to, u)), Wd, smooth01(clamp(v * 1.4, 0, 1)) * (d.free ?? 0.85)),
      scales: scalesOf(S, 'head'),
    });
    // a comb of small spines along its leading edge (green iguanas)
    if (d.comb) for (let i = 0; i < d.comb; i++) {
      const s = lerp(d.from + 0.03, d.from + (d.to - d.from) * 0.5, i / Math.max(1, d.comb - 1)), q = topAt(s);
      q.y -= dp(s) * V * 0.98;
      spike(part, q, V3(0, -0.6, 0.8).normalize(), 0.012 * V, 0.004 * V, 'marking', mixW(L.skinAt(s), Wd, d.free ?? 0.85), 4);
    }
    L.dewlap = { bone: 'Dewlap' };
  }
  // subtympanic shield (green iguanas): one big round pale scale on the jowl below the ear
  if (T.shield) {
    const sh = T.shield, part = B.part('head-scales', { group: 'head' });
    for (const sd of [1, -1]) {
      const c = head.at(sh.u, sh.rise, 0), dir = head.side.clone().multiplyScalar(sd);
      const hit = surfaceToward(head.jaw || head.g, c, dir, 0.0, 0.5);
      emit(part, ellipsoid(hit.p.clone().addScaledVector(hit.n, -sh.r * head.H * 0.25), sh.r * head.H, sh.r * head.H * 0.9, sh.r * head.H * 0.28, hit.n, head.hu, 3, 10), sh.zone ?? 'marking', rig.W(head.jaw ? 'Jaw' : head.bone));
    }
  }
  // dorsal fin (newts, axolotls) and the tail's ventral fin: thin sheets standing on the midlines
  for (const f of [T.fin, T.finBelly].filter(Boolean)) {
    const hp = prof(f.h), part = B.part('fins', { group: 'fins' }), a = f === T.finBelly ? 1.5 * Math.PI : Math.PI / 2, sg = a > Math.PI ? -1 : 1;
    sheet(part, {
      nu: Math.round(((f.to - f.from) / 0.03) * det + 4), nv: 2,
      f: (u, v) => { const s = lerp(f.from, f.to, u), q = L.on(s, a); return q.p.clone().addScaledVector(V3(0, sg, 0), hp(s) * V * v - 0.004 * V); },
      th: (u, v) => 0.006 * V * (1 - 0.6 * v), zone: (u, v) => (v > 0.6 && f.edge ? f.edge : f.zone ?? 'accent'), skin: (u) => L.skinAt(lerp(f.from, f.to, u)), scales: null,
    });
  }
  // external gills (axolotls): three rami a side, each a tapering stalk with a fringe of filaments
  if (T.gills) {
    const gT = T.gills, part = B.part('gills', { group: 'gills' });
    for (const [sd, sx] of SIDES) for (let r = 0; r < 3; r++) {
      const base = head.at(gT.u, gT.rise + r * gT.dr, 0).addScaledVector(head.side, sd * head.H * gT.x);
      const ang = (gT.fan[r] ?? 0) * DEG, len = gT.len[r] * head.H;
      const dir = V3(sd * Math.cos(ang) * 0.55, Math.sin(ang), -0.8).normalize();
      const name = `Gill${sx}${r + 1}`;
      rig.add(name, 'Head', base, base.clone().addScaledVector(dir, len));
      const Wg = rig.W(name);
      const mid = base.clone().addScaledVector(dir, len * 0.5).add(V3(0, len * 0.08, 0)), tip = base.clone().addScaledVector(dir, len);
      emit(part, tube([base, mid, tip], (u) => gT.w * head.H * (1 - 0.6 * u), Math.round(4 * det + 2), 6, { cap1: 'point' }), gT.zone ?? 'accent', (u) => rig.W2('Head', name, clamp(u * 2, 0, 1)));
      const nf = Math.round(gT.fil * det);
      for (let k = 0; k < nf; k++) {
        const t = 0.15 + 0.85 * (k / Math.max(1, nf - 1)), q = makePath([base, mid, tip]).getPointAt(t);
        const fd = V3(0, 1, 0.25).normalize().addScaledVector(dir, -0.2).normalize();
        emit(part, tube([q, q.clone().addScaledVector(fd, gT.fl * head.H * (1 - 0.5 * t))], gT.w * head.H * 0.32, 2, 4, { cap1: 'point' }), gT.zone ?? 'accent', Wg);
      }
    }
  }
  // costal skin folds (giant salamanders): a wavy frill along each flank between the limbs
  if (T.folds) {
    const fo = T.folds, part = B.part('folds', { group: 'body' });
    for (const [sd] of SIDES) sheet(part, {
      nu: Math.round(((fo.to - fo.from) / 0.02) * det + 6), nv: 2,
      f: (u, v) => { const s = lerp(fo.from, fo.to, u), q = L.on(s, sd > 0 ? 0 : Math.PI); const w = fo.h * V * Math.sin(Math.PI * u) ** 0.4 * (0.75 + 0.25 * Math.sin(u * fo.waves * TAU)); return q.p.clone().addScaledVector(q.n, w * v - 0.003 * V).add(V3(0, -fo.drop * V * v, 0)); },
      th: 0.008 * V, zone: fo.zone ?? 'body', skin: (u) => L.skinAt(lerp(fo.from, fo.to, u)), scales: null,
    });
  }
  // parotoid glands (fire salamanders): swollen ridges behind the eyes
  if (T.parotoid) {
    const pa = T.parotoid, part = B.part('glands', { group: 'head' });
    for (const [sd] of SIDES) {
      const q = L.on(pa.s, sd > 0 ? pa.a * DEG : Math.PI - pa.a * DEG);
      emit(part, ellipsoid(q.p.clone().addScaledVector(q.n, -pa.r * V * 0.25), pa.r * V * 0.75, pa.r * V * 0.45, pa.r * V * 1.2, L.path(pa.s - 0.02).sub(L.path(pa.s + 0.02)).normalize(), q.n, 4, 10), (u, a, P) => B.paint({ part: 'gland', u, a, P, s: pa.s }), L.skinAt(pa.s));
    }
  }
  // crocodilian armour: keeled osteoderms in transverse rows over the neck and back, and the tail's double, then single, crest
  if (T.scutes) {
    const sc = T.scutes, part = B.part('scutes', { group: 'spines' });
    for (const row of sc.rows) {
      const n = Math.max(1, Math.round((row.to - row.from) / row.gap));
      for (let i = 0; i <= n; i++) {
        const s = lerp(row.from, row.to, i / n), wS = L.W(s) * V;
        for (const x of row.x) {
          // angle of the scute's place across the back, from its lateral offset (× the half-width)
          const a = Math.PI / 2 - Math.asin(clamp(x, -0.98, 0.98)) * (row.wrap ?? 1);
          const q = L.on(s, a), f = L.path(s - 0.01).sub(L.path(s + 0.01)).normalize(), side = new THREE.Vector3().crossVectors(q.n, f).normalize();
          const len = row.gap * V * 0.82, wd = (row.w ?? 0.6) * row.gap * V, h = (row.h ?? 0.18) * row.gap * V;
          // a low keeled plate: a lofted lozenge on the surface
          const ctr = q.p.clone().addScaledVector(q.n, -h * 0.25);
          emit(part, loft({ pts: [ctr.clone().addScaledVector(f, -len / 2), ctr.clone().addScaledVector(f, len / 2)], seg: 2, rad: 6, up: q.n, w: (u) => wd * 0.5 * (0.7 + 0.3 * Math.sin(Math.PI * u)), ht: (u) => h * (0.6 + 0.4 * Math.sin(Math.PI * u)), hb: h * 0.3, nt: 1.1, nb: 2, cap0: 'flat', cap1: 'flat', bend: 0 }), row.zone ?? 'pattern', L.skinAt(s));
          void side; void wS;
        }
      }
    }
    // tail crest: paired keels, merging into one median crest
    if (sc.tail) {
      const tc = sc.tail, n = Math.round((tc.to - tc.from) / tc.gap);
      for (let i = 0; i <= n; i++) {
        const s = lerp(tc.from, tc.to, i / n), single = s > tc.merge, h = prof(tc.h)(s) * V;
        const f = L.path(s - 0.01).sub(L.path(s + 0.01)).normalize();
        for (const x of single ? [0] : [-tc.x, tc.x]) {
          const a = Math.PI / 2 - Math.asin(clamp(x, -0.98, 0.98)), q = L.on(s, a);
          const up = single ? q.n : q.n.clone().lerp(V3(0, 1, 0), 0.6).normalize();
          blade(part, q.p.clone().addScaledVector(q.n, -h * 0.1), up, f, h, tc.gap * V * 0.9, tc.gap * V * 0.3, tc.zone ?? 'pattern', L.skinAt(s), 12 * DEG);
        }
      }
    }
  }
  // crocodilian teeth along the jaw margins
  if (T.teeth && head.jaw) {
    const tt = T.teeth, part = B.part('teeth', { group: 'head' }), H = head.H;
    for (const [sd] of SIDES) for (let i = 0; i < tt.n; i++) {
      const u = lerp(tt.from, tt.to, i / (tt.n - 1)), big = tt.big && tt.big.includes(i) ? 1.7 : 1, hgt = tt.h * H * big * (0.75 + 0.25 * Math.sin(i * 2.3));
      // upper row, hanging from the skull's lower edge just outside the lower jaw
      const q = surfaceToward(head.g, head.at(u, -0.02), head.side.clone().multiplyScalar(sd).addScaledVector(head.hu, -0.9).normalize(), clamp(u - 0.1, 0, 1), clamp(u + 0.1, 0, 1));
      spike(part, q.p.clone().addScaledVector(head.side, -sd * H * 0.006), head.hu.clone().multiplyScalar(-1).addScaledVector(head.side, sd * 0.12).normalize(), hgt, hgt * 0.32, 'teeth', rig.W(head.bone), 4);
      // lower row, rising from the jaw's edge
      const k = clamp((u - (T.head.jaw.hinge ?? 0.1)) / ((T.head.jaw.tip ?? 0.98) - (T.head.jaw.hinge ?? 0.1)), 0, 1);
      const qj = surfaceToward(head.jaw, head.at(u, -0.08), head.side.clone().multiplyScalar(sd).addScaledVector(head.hu, 0.9).normalize(), clamp(k - 0.1, 0, 1), clamp(k + 0.1, 0, 1));
      spike(part, qj.p.clone().addScaledVector(head.side, -sd * H * 0.008), head.hu.clone().addScaledVector(head.side, sd * 0.1).normalize(), hgt * 0.9, hgt * 0.3, 'teeth', rig.W('Jaw'), 4);
    }
  }
  // chameleon casque: a keeled ridge rising from above the eyes back over the neck
  if (T.casque) {
    const cq = T.casque, part = B.part('casque', { group: 'head' }), H = head.H;
    const a = head.at(cq.u0, cq.r0), b = head.at(cq.u1, cq.r1), m = a.clone().lerp(b, 0.5).addScaledVector(head.hu, cq.bulge * H);
    emit(part, loft({ pts: [a, m, b], seg: 8, rad: 8, up: head.hu, w: (u) => cq.w * H * Math.sin(Math.PI * clamp(u * 0.9 + 0.08, 0, 1)) ** 0.6, ht: (u) => cq.h * H * (0.3 + 0.7 * Math.sin(Math.PI * u)), hb: cq.h * H * 0.5, nt: 1.25, nb: 2, cap0: 'round', cap1: 'round', bend: 0.3 }), (u, aa, P) => B.paint({ part: 'head', u: 0.2, a: aa, P }), rig.W(head.bone));
  }
  // frilled lizard: the frill, a ruff of skin on cartilage rods from the hyoid, folded back over the shoulders like a
  // cape; each side on three bones hinged where it meets the neck, which the display swings forward into a disc
  if (T.frill) frillBuild(B, S, L);
}

function frillBuild(B, S, L) {
  const F = S.T.frill, V = L.V, rig = B.rig, det = B.det, head = L.head, part = B.part('frill', { group: 'frill' });
  const sA = F.s;                                         // station of the attachment ring (behind the jaw angle)
  const ctr = L.path(sA), back = L.path(sA + 0.02).sub(L.path(sA - 0.02)).normalize();
  const nBones = 5;
  for (const [sd, sx] of SIDES) {
    // hinge bones along the attachment arc
    const names = [];
    for (let b = 0; b < nBones; b++) {
      const t = (b + 0.5) / nBones, ang = F.a0 + (Math.PI - F.a0) * t;
      const dirR = V3(sd * Math.sin(ang), Math.cos(ang), 0);
      const at = ctr.clone().add(V3(dirR.x * L.W(sA) * V, dirR.y > 0 ? dirR.y * L.HT(sA) * V : dirR.y * L.HB(sA) * V, 0));
      const nm = `Frill${sx}${b + 1}`; names.push(nm);
      rig.add(nm, 'Neck', at, at.clone().addScaledVector(back, F.len * V));
    }
    const nu = Math.round(8 * det + 3), nv = Math.round(10 * det + 4);
    sheet(part, {
      nu, nv,
      // u: from the attachment (0) back to the rim (1); v: round the neck from near the top (0) to under the throat (1).
      // Folded, the rods lie back over the neck and shoulders and the skin drapes on the body like a cape, pleated
      f: (u, v) => {
        const ang = F.a0 + (Math.PI - F.a0) * v, len = F.len * (0.55 + 0.45 * Math.sin(Math.PI * clamp(v * 0.9 + 0.05, 0, 1)));
        const a = sd > 0 ? Math.PI / 2 - ang : Math.PI / 2 + ang;
        const q = L.on(sA + len * u, a), pleat = Math.max(0, Math.sin(v * F.pleats * Math.PI)) * F.pleat * V * smooth01(u);
        return q.p.addScaledVector(q.n, 0.006 * V + F.lift * V * u + pleat);
      },
      th: 0.005 * V,
      zone: (u, v, face) => B.paint({ part: 'frill', u, v, face, sd, P: null }),
      skin: (u, v) => {
        const fb = v * nBones - 0.5, i0 = clamp(Math.floor(fb), 0, nBones - 1), i1 = clamp(i0 + 1, 0, nBones - 1), t = clamp(fb - i0, 0, 1);
        const Wf = i0 === i1 ? rig.W(names[i0]) : rig.W2(names[i0], names[i1], smooth01(t));
        return mixW(L.skinAt(sA), Wf, smooth01(clamp(u * 3, 0, 1)));
      },
      scales: scalesOf(S, 'head'),
    });
    L.frill = L.frill || {}; L.frill[sx] = names;
  }
  L.frill.back = back; L.frill.F = F;
}

/* ════════════════════════════════════════════════════════════════════════════
 *  OPHIDIAN BODY PLAN — snakes and the caecilian
 *  One loft from inside the skull to the tail tip through measured sections [s, half-width, half-height above,
 *  half-height below] (s from the snout tip, × the total length V; the vent at `vent`). At rest the body lies on its
 *  belly in a serpenoid S (heading θ(σ) = α sin(2πσ/λ), α = `rest.a` degrees, λ = `rest.l` × V), the head lifted a
 *  little. Skeleton: Root > Spine1 (the neck) > Spine2 > … > SpineN > Tail1 … TailM, the Head (> Jaw > Tongue) on
 *  Spine1; each bone owns the body from its head back to the next. Clips lay the chain along computed curves.
 * ════════════════════════════════════════════════════════════════════════════ */

/** A planar serpenoid curve from the head back: points every `ds` of arc, heading turning as α·sin(2πσ/λ + φ). */
function serpenoid(len, a, l, ph = 0, ds = 0.002, straight = 0) {
  const n = Math.max(8, Math.ceil(len / ds)), pts = [V3(0, 0, 0)];
  let x = 0, z = 0;
  for (let i = 1; i <= n; i++) {
    // (the first `straight` of the length runs straight back from the head, so the neck carries the head's line)
    const sg = (i - 0.5) * (len / n), th = a * Math.sin((TAU * sg) / l + ph) * sstep(straight * 0.5, straight * 1.6, sg);
    // the body runs back (−z) from the head, the heading swinging it from side to side
    x += Math.sin(th) * (len / n); z -= Math.cos(th) * (len / n);
    pts.push(V3(x, 0, z));
  }
  return pts;
}

function ophidianBuild(B, S, p, L) {
  const T = S.T, V = S.V, rig = B.rig, det = B.det;
  Object.assign(L, { plan: 'ophidian', V, T, limbs: [] });
  const W = prof(T.body.map(k => [k[0], k[1]])), HT = prof(T.body.map(k => [k[0], k[2]])), HB = prof(T.body.map(k => [k[0], k[3]]));
  // rest curve on the ground, centred on its middle, the head toward +z
  const pts = serpenoid(V, (T.rest.a ?? 30) * DEG, (T.rest.l ?? 0.5) * V, T.rest.ph ?? 0, V / 600, T.head.len * 2.2 * V);
  const n = pts.length - 1, mid = pts.reduce((a, q) => a.add(q), V3()).divideScalar(pts.length);
  for (const q of pts) q.sub(mid).setY(0);
  const lift = prof(T.rest.lift || [[0, 0.02], [T.head.len * 2.2, 0.004], [T.head.len * 4, 0]]);
  const path = (s) => {
    const f = clamp(s, 0, 1) * n, i = Math.min(n - 1, Math.floor(f)), q = pts[i].clone().lerp(pts[i + 1], f - i);
    q.y = (HB(s) + 0.0015) * V + lift(s) * V;
    return q;
  };
  Object.assign(L, { path, W, HT, HB, restPts: pts });

  /* ── skeleton ── */
  rig.add('Root', null, V3(0, 0, 0));
  const nB = T.bones ?? 30, nT = T.tailBones ?? 8, vent = T.vent, s0 = T.head.len * 0.96;
  const spineS = [], tailS = [];
  for (let i = 0; i < nB; i++) spineS.push(s0 + (vent - s0) * (i / nB) ** (T.neckDense ?? 1.15));
  for (let i = 0; i < nT; i++) tailS.push(vent + (1 - vent) * (0.6 * (i / nT) + 0.4 * (1 - (1 - i / nT) ** 1.6)));
  const names = [...spineS.map((_, i) => `Spine${i + 1}`), ...tailS.map((_, i) => `Tail${i + 1}`)], ss = [...spineS, ...tailS];
  names.forEach((nm, i) => rig.add(nm, i ? names[i - 1] : 'Root', path(ss[i]), path(i < names.length - 1 ? ss[i + 1] : 1)));
  Object.assign(L, { chain: names, chainS: ss, tailNames: names.slice(nB), spineNames: names.slice(0, nB) });

  /* ── head: built along the rest curve's front, a little raised ── */
  const hT = T.head, Hl = hT.len * V, O = path(hT.len), F = path(0);
  const hd = F.clone().sub(O).normalize(), pitch = (hT.pitch ?? 0) * DEG;
  hd.y += Math.sin(pitch); hd.normalize();
  const side0 = new THREE.Vector3().crossVectors(V3(0, 1, 0), hd).normalize(), hu = new THREE.Vector3().crossVectors(hd, side0).normalize();
  Object.assign(L, { headO: O, hd, hu, Hl, hside: new THREE.Vector3().crossVectors(hu, hd).normalize() });
  const head = buildHead(B, S, L, { ...hT, len: Hl, occiput: O, dir: hd, up: hu, parent: 'Spine1', scales: scalesOf(S, 'head'), seg: hT.seg ?? 18, rad: hT.rad ?? 9 });
  L.head = head;
  if (hT.tongue) buildTongue(B, S, L, head, hT.tongue);

  /* ── body ── */
  const seg = Math.round(det * (T.seg ?? 150)), rad = 2 * Math.round((T.rad ?? 7) * det + 3);
  const keys = T.body.filter(k => k[0] >= hT.len * 0.55);
  const g = bodyLoft(B, { keys, path, V, seg, rad, nt: T.nt ?? 2.2, nb: T.nb ?? 2.8, cap0: { type: 'round', len: 0.4, n: 2 }, cap1: { type: 'point', len: 0.8 }, bend: 0.3 });
  g.scales = scaleSet(S);
  const uOf = prof(g.keyS.map((s, i) => [s, g.ku[i]]));
  const spec = rig.spec(['Head', ...names], [0, ...ss.map(s => uOf(s))], 0.35);
  let skinAx = (u) => rig.chain(spec, u);
  // the hood: ribs behind the head that swing out; its skin rides HoodL / HoodR, which the display clip moves apart
  if (T.hood) {
    const h = T.hood, at = path((h.from + h.to) / 2), parent = names[spineS.findIndex(x => x > (h.from + h.to) / 2) - 1] || 'Spine1';
    rig.add('HoodL', parent, at.clone().add(V3(0.001, 0, 0))); rig.add('HoodR', parent, at.clone().add(V3(-0.001, 0, 0)));
    const base = skinAx, iL = rig.i('HoodL'), iR = rig.i('HoodR');
    skinAx = (u, a) => {
      const s = g.sOf(u), w = base(u), k = bell(s, (h.from + h.to) / 2 + (h.shift ?? 0), (h.to - h.from) / 2) * Math.max(0, Math.abs(Math.cos(a)) - 0.1) / 0.9;
      if (k <= 0.001) return w;
      return normW([...w.map(([i, x]) => [i, x * (1 - k)]), [Math.cos(a) > 0 ? iL : iR, k]]);
    };
    L.hood = { spread: h.spread * V };
  }
  const skinAt = (s) => rig.chain(spec, uOf(s));
  Object.assign(L, { body: g, uOf, skinAx, skinAt, on: (s, a) => g.at(uOf(s), a) });
  emit(B.part('body', { group: 'body' }), g, (u, a, P) => { const s = g.sOf(u); return B.paint({ part: s > vent ? 'tail' : 'body', s, u, a, P }); }, (u, a) => skinAx(u, a));

  /* ── extras ── */
  // supraocular horns (sidewinders)
  if (T.horns) for (const e of head.eyes) {
    const base = e.c.clone().addScaledVector(head.hu, e.r * 0.8);
    spike(B.part('horns', { group: 'head' }), base, head.hu.clone().addScaledVector(head.side, e.side * 0.25).addScaledVector(head.hd, -0.2).normalize(), T.horns * head.H, T.horns * head.H * 0.35, 'body', rig.W('Head'), 5);
  }
  // rattle: loose interlocking keratin segments at the tail tip, each a little smaller
  if (T.rattle) {
    const rt = T.rattle, part = B.part('rattle', { group: 'tail' }), last = names[names.length - 1];
    const tip = path(1), back = path(1).sub(path(0.985)).normalize();
    let c = path(0.985).addScaledVector(back, 0.002 * V);
    for (let i = 0; i < rt.n; i++) {
      const r = rt.r * V * (1 - 0.06 * i), l = rt.l * V;
      emit(part, ellipsoid(c.clone().addScaledVector(back, l * 0.5), r, r * 0.55, l * 0.62, back, [0, 1, 0], 4, 10), 'claw', rig.W(last));
      c.addScaledVector(back, l * 0.72);
    }
    void tip;
    L.rattle = true;
  }
  // tentacle pits and countersunk mouth of the caecilian are painted
  return L;
}

/** Snakes: keeled or smooth dorsal scales and wide ventral plates, on one loft (the atlas takes several sets per patch). */
function scaleSet(S) {
  const sc = S.scales;
  if (!sc) return null;
  return [
    { kind: sc.kind, cell: sc.cell, width: sc.width ?? 0.12, dark: sc.dark ?? 0.74, light: sc.light ?? 0.1, zones: (sc.dorsalZones ?? ['body', 'pattern', 'marking', 'accent', 'accent2']) },
    { kind: 'plates', cell: sc.cell * (sc.plateK ?? 2.2), stretch: sc.plateStretch ?? 3.2, width: 0.06, dark: 0.8, light: 0.05, zones: ['belly'] },
  ];
}

/* ════════════════════════════════════════════════════════════════════════════
 *  CHELONIAN BODY PLAN — tortoises, box turtles and sea turtles (V = straight carapace length)
 *  The carapace is a thick shell, polar over its outline (r from the top of the dome to the rim, θ round from the
 *  front): a superelliptic outline (half-width w, half-lengths front and back), a dome whose height falls off as
 *  (1 - r^p)^q to the marginal rim, the rim raised over the neck (nuchal) and flared or saw-edged behind. Scutes are
 *  painted per texel: 5 vertebrals, 4 costals a side and a ring of 24 marginals, with growth rings round each areola.
 *  The plastron is a flat slab of paired scutes joined to the carapace by bridges between the legs; inside, a body of
 *  skin fills the openings. Skeleton: Root > Hips (the shell) > Neck1 > Neck2 > Neck3 > Head > Jaw; Hips > Tail1-2;
 *  Hips > UpperArm > Forearm > Hand and Thigh > Shin > Foot (L/R). Flippers are paddles on the same bones.
 * ════════════════════════════════════════════════════════════════════════════ */

/** Scute layout in normalised carapace coordinates (x across −1..1, z along, −1 back .. 1 front). */
const SCUTES_IN = [
  [0, 0.66, 1.0], [0, 0.33, 1.0], [0, 0.0, 1.0], [0, -0.33, 1.0], [0, -0.64, 1.0],
  [0.58, 0.5, 0.9], [0.66, 0.17, 0.9], [0.66, -0.17, 0.9], [0.58, -0.5, 0.9],
  [-0.58, 0.5, 0.9], [-0.66, 0.17, 0.9], [-0.66, -0.17, 0.9], [-0.58, -0.5, 0.9],
];

function chelonianBuild(B, S, p, L) {
  const T = S.T, V = S.V, rig = B.rig, det = B.det, sh = T.shell;
  Object.assign(L, { plan: 'chelonian', V, T, limbs: [] });
  const yP = sh.plastronY * V, yRim = sh.rimY * V, Hd = sh.dome * V, Wd = sh.w * V, Lf = sh.front * V, Lb = sh.back * V;
  const n = sh.n ?? 2.4;
  // rim outline at angle θ (0 = front, + toward the left)
  const rim = (th) => {
    const c = Math.cos(th), s = Math.sin(th), e = 2 / n;
    let x = Wd * Math.sign(s) * Math.abs(s) ** e, z = (c >= 0 ? Lf : Lb) * Math.sign(c) * Math.abs(c) ** e;
    // a waist behind the forelegs on sea turtles (the outline narrows toward the tail)
    if (sh.taper && c < 0) x *= 1 - sh.taper * (-c) ** 1.5;
    return [x, z];
  };
  const rimH = (th) => {
    const c = Math.cos(th);
    // nuchal rise over the neck, flare or droop over the tail, saddle lift
    return yRim + (c > 0 ? (sh.nuchal ?? 0.03) * V * c ** 4 + (sh.saddle ?? 0) * V * c ** 2 : (sh.rear ?? 0) * V * (-c) ** 3);
  };
  const domeY = (r, th) => {
    const base = rimH(th), top = yRim + Hd + (sh.saddle ?? 0) * V * Math.max(0, Math.cos(th)) ** 2 * r;
    return base + (top - base) * (1 - r ** (sh.p ?? 2.2)) ** (sh.q ?? 0.62);
  };
  const flare = (r, th) => (r > 0.86 ? (sh.flare ?? 0.02) * V * ((r - 0.86) / 0.14) ** 2 * (Math.cos(th) < 0 ? 1.4 : 0.6) : 0);
  const shellAt = (r, th) => {
    const [x, z] = rim(th), f = flare(r, th), k = r + f / Math.max(1e-6, Math.hypot(x, z));
    return V3(x * k, domeY(r, th) - (f > 0 ? f * 0.6 : 0), z * k + (sh.dz ?? 0) * V);
  };
  // (scutes are laid out by distance over the dome from its top, not by the outline's radius: on a high dome the side
  // wall is a narrow band of r)
  const rho = [0];
  for (let i = 1; i <= 64; i++) rho.push(rho[i - 1] + shellAt(i / 64, Math.PI / 2).distanceTo(shellAt((i - 1) / 64, Math.PI / 2)));
  const rhoOf = (r) => { const f = clamp(r, 0, 1) * 64, i = Math.min(63, Math.floor(f)); return lerp(rho[i], rho[i + 1], f - i) / rho[64]; };
  Object.assign(L, { shellAt, rim, rimH, yP, rhoOf });

  rig.add('Root', null, V3(0, 0, 0));
  rig.add('Hips', 'Root', V3(0, yP + 0.1 * V, 0));
  const Wsh = rig.W('Hips');

  /* ── carapace ── */
  const part = B.part('shell', { group: 'shell' });
  const nu = Math.round(14 * det + 4), nv = 2 * Math.round(30 * det + 6);
  sheet(part, {
    nu, nv, f: (u, v) => shellAt(Math.max(u, 0.0005), v * TAU), th: (sh.th ?? 0.03) * V,
    zone: (u, v, face) => (face === 1 ? scuteZone(S, L.rhoOf(u), v * TAU) : face === -1 ? 'seam' : 'shell'), skin: Wsh, scales: null,
  });
  /* ── plastron: a flat slab of paired scutes, lifted a little at the front lobe ── */
  const pl = T.plastron, pW = pl.w * V, pF = pl.front * V, pB = pl.back * V;
  const plOut = (z) => { const t = z >= 0 ? z / pF : -z / pB; return pW * Math.sqrt(Math.max(0, 1 - Math.abs(t) ** (pl.n ?? 3))); };
  sheet(B.part('plastron', { group: 'shell' }), {
    nu: Math.round(10 * det + 4), nv: Math.round(8 * det + 4),
    f: (u, v) => { const z = lerp(-pB, pF, u), x = (v - 0.5) * 2 * plOut(z) * 0.98; return V3(x, yP + (pl.lift ?? 0.02) * V * Math.max(0, (z / pF - 0.6) / 0.4) ** 2 + 0.015 * V, z + (sh.dz ?? 0) * V); },
    th: 0.03 * V, normal: [0, -1, 0],
    zone: (u, v, face) => { if (face !== -1 && face !== 1) return 'plastron'; const z = lerp(-1, 1, u), x = (v - 0.5) * 2; if (Math.abs(x) < 0.025) return 'seam'; for (const sz of pl.seams) if (Math.abs(z - sz) < 0.018) return 'seam'; return 'plastron'; },
    skin: Wsh, scales: null,
  });
  /* ── bridges: the shell's sides joining carapace rim to plastron between the legs ── */
  for (const sd of [1, -1]) {
    const a0 = Math.PI / 2 - (pl.bridge[1] ?? 0.45), a1 = Math.PI / 2 + (pl.bridge[0] ?? 0.4);
    sheet(part, {
      nu: Math.round(6 * det + 3), nv: 2,
      f: (u, v) => { const th = sd * lerp(a0, a1, u), top = shellAt(0.985, th), z = top.z, bot = V3(sd * plOut(z - (sh.dz ?? 0) * V) * 0.98, yP + 0.03 * V, z); return top.clone().lerp(bot, v); },
      th: 0.02 * V, zone: 'shell', skin: Wsh, scales: null,
    });
  }
  /* ── body of skin inside, filling the openings ── */
  const bd = T.body;
  emit(B.part('body', { group: 'body' }), ellipsoid(V3(0, yP + bd.y * V, (bd.z ?? 0) * V), bd.w * V, bd.h * V, bd.l * V, [0, 0, 1], [0, 1, 0], Math.round(8 * det + 3), 2 * Math.round(7 * det + 3)), (u, a, P) => B.paint({ part: 'skin', u, a, P }), Wsh);

  /* ── neck and head ── */
  const nk = T.neck, n0 = V3(0, yP + nk.y0 * V, nk.z0 * V), n1 = V3(0, yP + nk.y1 * V, nk.z1 * V);
  const hT = T.head, Hl = hT.len * V, pitch = (hT.pitch ?? 0) * DEG;
  const hd = V3(0, Math.sin(pitch), Math.cos(pitch)), hu = V3(0, Math.cos(pitch), -Math.sin(pitch));
  const nPts = [n0, n0.clone().lerp(n1, 0.5).add(V3(0, nk.arch * V, 0)), n1];
  const nc = makePath(nPts), nks = [0, 0.38, 0.72].map(t => nc.getPointAt(t));
  rig.add('Neck1', 'Hips', nks[0]); rig.add('Neck2', 'Neck1', nks[1]); rig.add('Neck3', 'Neck2', nks[2], n1);
  const O = n1.clone();
  Object.assign(L, { headO: O, hd, hu, Hl, hside: new THREE.Vector3().crossVectors(hu, hd).normalize() });
  const head = buildHead(B, S, L, { ...hT, len: Hl, occiput: O, dir: hd, up: hu, parent: 'Neck3', scales: scalesOf(S, 'head'), seg: hT.seg ?? 16, rad: hT.rad ?? 8 });
  L.head = head;
  const ng = loft({ curve: nc, seg: Math.round(12 * det + 4), rad: 2 * Math.round(6 * det + 3), w: (u) => lerp(nk.r0, nk.r1, u) * V, ht: (u) => lerp(nk.r0, nk.r1, u) * V * 0.95, hb: (u) => lerp(nk.r0, nk.r1, u) * V, nt: 2, nb: 2, up: [0, 1, 0], cap0: 'round', cap1: { type: 'round', len: 0.3 }, bend: 0.4 });
  ng.scales = scalesOf(S, 'neck');
  const nspec = rig.spec(['Neck1', 'Neck2', 'Neck3', 'Head'], [0, 0.38, 0.72, 0.97], 0.35);
  emit(B.part('neck', { group: 'body' }), ng, (u, a, P) => B.paint({ part: 'skin', u, a, P }), (u) => (u < 0.12 ? rig.W2('Hips', 'Neck1', u / 0.12) : rig.chain(nspec, u)));
  /* ── tail ── */
  const tl = T.tail, t0 = V3(0, yP + tl.y * V, -tl.z * V), t1 = t0.clone().add(V3(0, -tl.drop * V, -tl.len * V));
  rig.add('Tail1', 'Hips', t0); rig.add('Tail2', 'Tail1', t0.clone().lerp(t1, 0.5), t1);
  emit(B.part('tail', { group: 'tail' }), tube([t0.clone().add(V3(0, 0.01 * V, 0.03 * V)), t0.clone().lerp(t1, 0.5), t1], (u) => tl.r * V * (1 - 0.85 * u), Math.round(5 * det + 2), 8, { cap1: 'point' }), (u, a, P) => B.paint({ part: 'skin', u, a, P }), (u) => rig.W2('Tail1', 'Tail2', u));
  L.tailNames = ['Tail1', 'Tail2'];

  /* ── limbs: walking legs, or flippers ── */
  for (const [front, lm0] of [[true, T.fore], [false, T.hind]]) {
    for (const [side, sx] of SIDES) {
      const names = (front ? ['UpperArm', 'Forearm', 'Hand'] : ['Thigh', 'Shin', 'Foot']).map(n => n + sx);
      const X0 = (v) => V3(side * v[0] * V, v[1] * V, v[2] * V);
      if (lm0.flipper) { L.limbs.push(flipperBuild(B, S, L, lm0, names, side, front, X0)); continue; }
      const J0 = X0(lm0.J0), J1 = X0(lm0.J1), J2 = X0(lm0.J2);
      const yaw = (lm0.yaw ?? 0) * DEG, fwd = V3(side * Math.sin(yaw), 0, Math.cos(yaw));
      const J3 = J2.clone().addScaledVector(fwd, lm0.palm.l * V); J3.y = lm0.palm.h * V * 0.9;
      const lm = buildLimb(B, S, L, {
        J: [J0, J1, J2, J3], bones: names, parent: 'Hips', R: lm0.R.map(r => r * V), flat: lm0.flat, up: [0, 1, 0], scales: scalesOf(S, 'leg'),
        palm: { w: lm0.palm.w * V, h: lm0.palm.h * V, l: lm0.palm.l * V * 0.5 }, digitSpec: lm0.digits.map(d => [d[0], d[1] * V, d[2], d[3]]),
        claw: lm0.claw, arch: lm0.arch ?? 0.15, front, side,
      });
      Object.assign(lm, { la: J0.distanceTo(J1), lb: J1.distanceTo(J2), pole: J1.clone().sub(J0.clone().lerp(J2, 0.5)).normalize() });
      L.limbs.push(lm);
    }
  }
  return L;
}

/** A sea turtle's flipper: a short upper bone inside the shell's edge, then a long flat paddle on the forearm and hand. */
function flipperBuild(B, S, L, F, names, side, front, X0) {
  const rig = B.rig, V = L.V, det = B.det;
  const J0 = X0(F.J0), J1 = X0(F.J1), J2 = X0(F.J2), J3 = X0(F.J3);
  rig.add(names[0], 'Hips', J0); rig.add(names[1], names[0], J1); rig.add(names[2], names[1], J2, J3);
  const part = B.part(`leg-${front ? 'front' : 'hind'}-${side > 0 ? 'left' : 'right'}`, { group: 'legs' });
  emit(part, tube([J0, J1], (u) => F.r * V * (1 - 0.2 * u), 4, 8), (u, a, P) => B.paint({ part: 'skin', u, a, P }), (u) => rig.W2(names[0], names[1], sstep(0.5, 1, u)));
  // the paddle: a thick sheet from the elbow to the tip, broad at the wrist, its leading edge straight, the trailing edge curved
  const c = makePath([J1, J2, J3]), chord = F.chord * V;
  const lead = new THREE.Vector3().crossVectors(V3(0, 1, 0), J3.clone().sub(J1)).normalize().multiplyScalar(front ? side : side);
  sheet(part, {
    nu: Math.round(10 * det + 4), nv: Math.round(4 * det + 2),
    f: (u, v) => { const q = c.getPointAt(u), w = chord * Math.sin(Math.PI * clamp(u * 0.92 + 0.08, 0, 1)) ** 0.7 * (1 - 0.35 * u); return q.addScaledVector(lead, (v - 0.75) * w); },
    th: (u, v) => F.thick * V * (1 - 0.6 * u) * (0.4 + 0.6 * Math.sin(Math.PI * v)),
    zone: (u, v, face) => B.paint({ part: 'flipper', u, v, face: face * side, P: c.getPointAt(u).addScaledVector(lead, (v - 0.75) * chord) }),
    skin: (u) => (u < 0.45 ? rig.W2(names[1], names[2], sstep(0.25, 0.45, u)) : rig.W(names[2])), scales: scalesOf(S, 'leg'),
  });
  if (F.claw) spike(part, c.getPointAt(0.55).addScaledVector(lead, chord * 0.22), J3.clone().sub(J1).normalize(), 0.02 * V, 0.006 * V, 'claw', rig.W(names[2]));
  return { front, side, bones: names, J: [J0, J1, J2, J3], flipper: true, la: J0.distanceTo(J1), lb: J1.distanceTo(J2), digits: [], surf: [] };
}

/** The zone of the carapace's top at (r, θ): seams of the scute mosaic, growth rings, the species' markings. */
function scuteZone(S, r, th) {
  const sc = S.T.scutes || {}, rM = sc.rM ?? 0.86, sw = sc.seam ?? 0.022;
  // marginal ring: 24 plates (12 a side counting the nuchal and supracaudals), divided by radial seams
  if (r > rM) {
    if (r - rM < sw * 0.7) return 'seam';
    const k = 24, a = ((th / TAU) * k + 0.5) % 1;
    if (Math.min(a, 1 - a) * (TAU / k) * r < sw * 0.9) return 'seam';
    return S.marginPaint ? S.marginPaint(r, th, a) : 'shell';
  }
  // the inner scutes, nearest-centre cells over the projected outline (weighted to their sizes)
  const x = Math.sin(th) * r * 1.02, z = Math.cos(th) * r;
  let d1 = 9, d2 = 9, best = -1;
  for (let i = 0; i < SCUTES_IN.length; i++) {
    const [cx, cz, k] = SCUTES_IN[i], d = Math.hypot((x - cx) * 1.12, z - cz) / k;
    if (d < d1) { d2 = d1; d1 = d; best = i; } else if (d < d2) d2 = d;
  }
  if (d2 - d1 < sw * 1.6) return 'seam';
  const [cx, cz] = SCUTES_IN[best], dc = Math.hypot(x - cx, z - cz), edge = d2 - d1;
  if (S.scutePaint) { const zz = S.scutePaint({ r, th, x, z, cx, cz, dc, edge, i: best }); if (zz) return zz; }
  // growth rings: concentric bands parallel to the seams, the areola at the centre
  if (sc.rings && edge > 0.06 && fract(edge / sc.rings) < 0.18) return 'pattern';
  return 'shell';
}

/* ════════════════════════════════════════════════════════════════════════════
 *  ANURAN BODY PLAN — frogs and toads (V = snout–vent length)
 *  Sitting: the trunk tilted nose-up over propped forelegs, hunched at the sacrum; a broad, flat head with protruding
 *  eyes on top, the tympanum behind them, a wide mouth and a throat that pumps (and swells into a vocal sac). The hind
 *  legs fold in a Z beside the body: the thigh forward to the knee, the shank back to the heel, the long tarsus
 *  forward again and the webbed foot flat on the ground. Skeleton: Root > Hips > Spine > Chest > Head > Jaw (> Tongue)
 *  and Throat; Chest > UpperArm > Forearm > Hand; Hips > Thigh > Shin > Tarsus > Foot (L/R).
 * ════════════════════════════════════════════════════════════════════════════ */
function anuranBuild(B, S, p, L) {
  const T = S.T, V = S.V, rig = B.rig, det = B.det;
  Object.assign(L, { plan: 'anuran', V, T, limbs: [] });
  const W = prof(T.body.map(k => [k[0], k[1]])), HT = prof(T.body.map(k => [k[0], k[2]])), HB = prof(T.body.map(k => [k[0], k[3]]));
  const yTab = prof(T.axis), zOf = (s) => (0.55 - s) * V * Math.cos((T.tilt ?? 18) * DEG);
  const path = (s) => V3(0, yTab(s) * V, zOf(s));
  Object.assign(L, { path, W, HT, HB });

  rig.add('Root', null, V3(0, 0, 0));
  rig.add('Hips', 'Root', path(0.92));
  rig.add('Spine', 'Hips', path(0.66));
  rig.add('Chest', 'Spine', path(0.42));

  /* ── head ── */
  const hT = T.head, Hl = hT.len * V, pitch = (hT.pitch ?? 0) * DEG;
  const hd = V3(0, Math.sin(pitch), Math.cos(pitch)), hu = V3(0, Math.cos(pitch), -Math.sin(pitch));
  const O = path(hT.len).add(V3(0, (hT.dy ?? 0) * V, 0));
  Object.assign(L, { headO: O, hd, hu, Hl, hside: new THREE.Vector3().crossVectors(hu, hd).normalize() });
  const head = buildHead(B, S, L, { ...hT, len: Hl, occiput: O, dir: hd, up: hu, parent: 'Chest', scales: scalesOf(S, 'head'), seg: hT.seg ?? 16, rad: hT.rad ?? 10, throat: true });
  L.head = head;
  if (hT.tongue) buildTongue(B, S, L, head, hT.tongue);

  /* ── body: from inside the skull to the vent, hunched over the sacrum ── */
  const keys = T.body;
  const g = bodyLoft(B, { keys, path, V, seg: Math.round(det * (T.bodySeg ?? 30)), rad: 2 * Math.round((T.bodyRad ?? 10) * det + 3), nt: T.nt ?? 2.0, nb: T.nb ?? 2.2, cap0: { type: 'round', len: 0.5, n: 2 }, cap1: { type: 'round', len: 0.75, n: 3 }, bend: 0.6, bump: T.warts ? wartBump(T.warts, V) : undefined });
  g.scales = scalesOf(S, 'body');
  const uOf = prof(g.keyS.map((s, i) => [s, g.ku[i]]));
  const spec = rig.spec(['Head', 'Chest', 'Spine', 'Hips'], [0, uOf(hT.len * 0.92), uOf(0.5), uOf(0.8)], 0.4);
  const skinAx = (u) => rig.chain(spec, u), skinAt = (s) => skinAx(uOf(s));
  Object.assign(L, { body: g, uOf, skinAx, skinAt, on: (s, a) => g.at(uOf(s), a) });
  emit(B.part('body', { group: 'body' }), g, (u, a, P) => B.paint({ part: 'body', s: g.sOf(u), u, a, P }), skinAx);

  /* ── forelegs: short props under the head, hands turned in ── */
  for (const [side, sx] of SIDES) {
    const F = T.fore, X0 = (v) => V3(side * v[0] * V, v[1] * V, zOf(0) + v[2] * V);
    const J0 = X0(F.J0), J2 = X0(F.J2), J1 = twoBone(J0, J2, F.upper * V, F.lower * V, V3(side * F.pole[0], F.pole[1], F.pole[2]));
    const yaw = (F.yaw ?? -20) * DEG, fwd = V3(side * Math.sin(yaw), 0, Math.cos(yaw));
    const J3 = J2.clone().addScaledVector(fwd, F.palm.l * V); J3.y = F.palm.h * V * 0.9;
    const lm = buildLimb(B, S, L, { J: [J0, J1, J2, J3], bones: ['UpperArm', 'Forearm', 'Hand'].map(n => n + sx), parent: 'Chest', R: F.R.map(r => r * V), up: [0, 1, 0], scales: scalesOf(S, 'leg'),
      palm: { w: F.palm.w * V, h: F.palm.h * V, l: F.palm.l * V * 0.5 }, digitSpec: F.digits.map(d => [d[0], d[1] * V, d[2], d[3]]), pad: F.pad, web: F.web, arch: F.arch ?? 0.2, front: true, side });
    Object.assign(lm, { la: F.upper * V, lb: F.lower * V, pole: V3(side * F.pole[0], F.pole[1], F.pole[2]).normalize() });
    L.limbs.push(lm);
  }
  /* ── hind legs, folded in a Z ── */
  for (const [side, sx] of SIDES) L.limbs.push(frogHindLeg(B, S, L, side, sx, zOf));
  // warts and parotoid glands (toads)
  if (T.parotoid) {
    const pa = T.parotoid, part = B.part('glands', { group: 'head' });
    for (const [sd] of SIDES) {
      const c = head.at(pa.u, pa.rise).addScaledVector(head.side, sd * pa.x * Hl);
      emit(part, ellipsoid(c, pa.w * Hl, pa.h * Hl, pa.l * Hl, hd.clone().addScaledVector(head.side, sd * 0.35).normalize(), hu, 4, 10), (u, a, P) => B.paint({ part: 'gland', u, a, P }), rig.W2('Head', 'Chest', 0.4));
    }
  }
  return L;
}

/** Warty skin as a bump on the loft's surface: rounded bumps on a jittered lattice (toads). */
function wartBump(w, V) {
  return (u, a) => {
    const up = Math.sin(a);
    if (up < (w.below ?? -0.3)) return 0;
    const [d1] = worley(u * w.f, Math.cos(a) * w.f * 0.3, Math.sin(a) * w.f * 0.3, 77);
    return d1 < w.r ? w.h * (1 - (d1 / w.r) ** 2) : 0;
  };
}

/** A frog's hind leg: femur, tibiofibula, tarsus and foot, lofted through the hip, knee, heel and tarsal joint. */
function frogHindLeg(B, S, L, side, sx, zOf) {
  const H = S.T.hind, V = L.V, rig = B.rig, det = B.det;
  const X0 = (v) => V3(side * v[0] * V, v[1] * V, zOf(1.0) + v[2] * V);
  const hip = X0(H.hip), knee = X0(H.knee), heel = X0(H.heel), tm = X0(H.tm);
  const names = ['Thigh', 'Shin', 'Tarsus', 'Foot'].map(n => n + sx);
  const yaw = (H.yaw ?? 25) * DEG, fwd = V3(side * Math.sin(yaw), 0, Math.cos(yaw));
  const toeEnd = tm.clone().addScaledVector(fwd, H.palm.l * V); toeEnd.y = H.palm.h * V;
  rig.add(names[0], 'Hips', hip); rig.add(names[1], names[0], knee); rig.add(names[2], names[1], heel); rig.add(names[3], names[2], tm, toeEnd);
  // the leg's surface: a loft through the joints (the folds tucked tight), muscle profile from the radii
  const pts = [hip.clone().lerp(knee, -0.12), hip, hip.clone().lerp(knee, 0.5), knee, knee.clone().lerp(heel, 0.5), heel, heel.clone().lerp(tm, 0.5), tm];
  const curve = makePath(pts), ku = knotUs(curve, pts.length), R = H.R.map(r => r * V);
  const pr = prof([[ku[0], R[0] * 0.7], [ku[1], R[0]], [ku[2], R[1]], [ku[3], R[2]], [ku[4], R[3]], [ku[5], R[4]], [ku[6], R[5]], [ku[7], R[6]]]);
  const g = loft({ curve, seg: Math.round(26 * det), rad: 2 * Math.round(5 * det + 2), w: pr, ht: pr, hb: pr, nt: 2, nb: 2, up: [0, 1, 0], cap0: { type: 'round', len: 0.6, n: 2 }, cap1: { type: 'round', len: 0.5, n: 2 }, bend: 0.25 });
  g.scales = scalesOf(S, 'leg');
  const spec = rig.spec(names.slice(0, 3), [ku[1], ku[3], ku[5]], 0.22);
  const skin = (u) => (u < ku[1] ? rig.W2('Hips', names[0], sstep(ku[0], ku[1], u)) : rig.chain(spec, u));
  const nm = `leg-hind-${side > 0 ? 'left' : 'right'}`;
  emit(B.part(nm, { group: 'legs' }), g, (u, a, P) => B.paint({ part: 'leg', u, a, P, front: false, side }), skin);
  // the foot: a slim sole and long toes, webbed
  const foot = B.part(`foot-hind-${side > 0 ? 'left' : 'right'}`, { group: 'feet' }), Wf = rig.W(names[3]);
  const lat = V3(fwd.z, 0, -fwd.x).multiplyScalar(side);
  const palmC = tm.clone().addScaledVector(fwd, H.palm.l * V * 0.4); palmC.y = H.palm.h * V;
  emit(foot, ellipsoid(palmC, H.palm.w * V, H.palm.h * V, H.palm.l * V * 0.5, fwd, [0, 1, 0], 4, 10), (u, a, P) => B.paint({ part: 'foot', u, a, P, front: false, side }), Wf);
  const base = palmC.clone().addScaledVector(fwd, H.palm.l * V * 0.4); base.y = H.palm.h * V * 1.05;
  const digits = buildDigits(B, S, L, { part: foot, base, fwd, lat, side, W: Wf, r: H.palm.w * V, digits: H.digits.map(d => [d[0], d[1] * V, d[2], d[3]]), pad: H.pad, web: H.web, front: false, arch: H.arch ?? 0.08, ground: 0 });
  const surf = [];
  for (let k = 0; k < g.rows.length; k += 2) for (let j = 0; j < g.R; j += 2) surf.push({ P: g.rows[k][j].clone(), W: skin(g.us[k]) });
  return { front: false, side, bones: names, J: [hip, knee, heel, tm, toeEnd], digits, surf, frogHind: true, la: hip.distanceTo(knee), lb: knee.distanceTo(heel), lc: heel.distanceTo(tm), pole: V3(side, 0.4, 0.6).normalize() };
}

/* ════════════════════════════════════════════════════════════════════════════
 *  SPECIES — each laid out from a measured reference animal (proportions from photographs, skeletons and field-guide
 *  measurements). `length` is the default real length in metres: the total length of lizards, crocodilians,
 *  salamanders and snakes, the snout–vent length of frogs and the straight carapace length of turtles.
 *  T is the body plan's table, in fractions of V (see each plan).
 * ════════════════════════════════════════════════════════════════════════════ */

/* green iguana (Iguana iguana), adult male: SVL 0.40 m, tail 2.75 × SVL; head 0.20 SVL with heavy jowls; forelimb 0.45,
   hind limb 0.72 SVL with a very long fourth toe; spines from the nape to the first third of the tail; dewlap to 0.12 SVL */
const T_IGUANA = {
  tail: 2.75, sh: 0.34, hip: 0.93, tailTouch: 0.16, tailBones: 10,
  body: [
    [0.15, 0.05, 0.045, 0.06], [0.22, 0.068, 0.056, 0.085], [0.28, 0.074, 0.062, 0.088], [0.34, 0.088, 0.078, 0.092],
    [0.5, 0.1, 0.092, 0.1], [0.68, 0.102, 0.092, 0.098], [0.84, 0.09, 0.083, 0.082], [0.94, 0.075, 0.07, 0.064],
    [1.03, 0.062, 0.06, 0.05], [1.3, 0.048, 0.052, 0.044], [1.8, 0.031, 0.036, 0.03], [2.5, 0.017, 0.02, 0.016],
    [3.2, 0.008, 0.009, 0.008], [3.75, 0.002, 0.002, 0.002],
  ],
  axis: [[0.1, 0.25], [0.22, 0.215], [0.34, 0.165], [0.6, 0.135], [0.93, 0.12], [1.0, 0.11]],
  head: {
    // a deep head: jowls 0.66 of its length deep, a blunt snout; the mouth runs back to below the back of the eye
    len: 0.22, pitch: 12,
    skull: [[0, 0.3, 0.24, 0.1, 0], [0.15, 0.32, 0.26, 0.1, 0], [0.32, 0.29, 0.25, 0.1, 0], [0.5, 0.25, 0.22, 0.09, 0], [0.68, 0.21, 0.19, 0.085, -0.01], [0.84, 0.16, 0.15, 0.08, -0.02], [0.95, 0.11, 0.11, 0.07, -0.025], [1, 0.07, 0.07, 0.05, -0.03]],
    jaw: { hinge: 0.04, tip: 0.97, p: [[0, 0.29, 0.33], [0.12, 0.31, 0.35], [0.3, 0.27, 0.27], [0.5, 0.22, 0.18], [0.69, 0.18, 0.135], [0.86, 0.13, 0.1], [1, 0.07, 0.065]] },
    eye: { r: 0.085, u: 0.55, rise: 0.1, yaw: 75, up: 0.25, inset: 0.5, pupil: 'round', pupilR: 0.36 },
    tongue: { root: 0.3, tip: 0.85, rise: -0.14, w: 0.05, ext: 0.12 },
  },
  fore: {
    upper: 0.14, lower: 0.12, foot: [0.24, 0.1], pole: [1, 0.45, -0.6], yaw: 22, drop: 0.3, inset: 0.6,
    R: [0.042, 0.032, 0.021, 0.022, 0.014], palm: { w: 0.024, h: 0.012, l: 0.045 },
    digits: [[-38, 0.035, -0.85, 0.42], [-16, 0.055, -0.42, 0.42], [2, 0.068, 0, 0.42], [20, 0.072, 0.42, 0.4], [52, 0.045, 0.85, 0.38]], claw: 1.6, arch: 0.25,
  },
  hind: {
    upper: 0.19, lower: 0.17, foot: [0.33, 0.03], pole: [1, 0.6, 0.35], yaw: 45, drop: 0.3, inset: 0.6,
    R: [0.062, 0.047, 0.028, 0.027, 0.016], palm: { w: 0.028, h: 0.013, l: 0.09 },
    digits: [[-30, 0.04, -0.85, 0.4], [-14, 0.07, -0.42, 0.4], [0, 0.1, 0, 0.4], [14, 0.15, 0.42, 0.4], [62, 0.065, 0.85, 0.38]], claw: 1.6, arch: 0.25,
  },
  crest: { from: 0.19, to: 1.9, gap: 0.022, h: [[0.19, 0.035], [0.24, 0.062], [0.32, 0.055], [0.5, 0.04], [0.8, 0.032], [1.0, 0.026], [1.4, 0.017], [1.9, 0.006]], lean: 30, zone: 'marking' },
  // the dewlap: from the chin, deepest under the throat behind the jaw, back up to the chest between the forelegs
  dewlap: { from: 0.05, to: 0.38, depth: [[0.05, 0], [0.09, 0.04], [0.15, 0.085], [0.21, 0.1], [0.27, 0.075], [0.33, 0.03], [0.38, 0]], comb: 9, zone: 'body', free: 0.85 },
  shield: { u: 0.12, rise: -0.22, r: 0.09, zone: 'accent2' },
};

/* ── digit sets: [angle (deg, + toward the outside), length (× V), offset across the palm, thickness] ── */
const scaleD = (ds, k) => ds.map(d => [d[0], d[1] * k, d[2], d[3]]);
// lizard hand: five clawed fingers, III and IV longest; foot: the fourth toe much the longest, the fifth set out to the side
const LIZ_HAND = [[-40, 0.035, -0.85, 0.42], [-17, 0.055, -0.42, 0.42], [2, 0.068, 0, 0.42], [20, 0.07, 0.42, 0.4], [52, 0.045, 0.85, 0.38]];
const LIZ_FOOT = [[-30, 0.04, -0.85, 0.4], [-14, 0.07, -0.42, 0.4], [0, 0.1, 0, 0.4], [14, 0.15, 0.42, 0.4], [62, 0.065, 0.85, 0.38]];
// salamander: four fingers, five toes, blunt and clawless
const SAL_HAND = [[-38, 0.03, -0.7, 0.55], [-10, 0.045, -0.22, 0.55], [14, 0.045, 0.25, 0.55], [42, 0.03, 0.72, 0.52]];
const SAL_FOOT = [[-40, 0.03, -0.8, 0.55], [-17, 0.045, -0.4, 0.55], [4, 0.055, 0, 0.55], [24, 0.05, 0.4, 0.52], [50, 0.032, 0.8, 0.5]];
// crocodilian: five short fingers (the inner three clawed), four long webbed toes
const CROC_HAND = [[-38, 0.028, -0.85, 0.55], [-16, 0.038, -0.42, 0.55], [4, 0.04, 0, 0.52], [24, 0.034, 0.42, 0.48], [48, 0.024, 0.85, 0.44]];
const CROC_FOOT = [[-22, 0.045, -0.75, 0.5], [-6, 0.06, -0.25, 0.5], [8, 0.068, 0.25, 0.48], [22, 0.062, 0.75, 0.44]];
// chameleon mitts: hands with three fingers bound inward and two outward; feet two inward, three outward
const CHAM_HAND = [[-62, 0.075, -0.4, 0.95], [58, 0.07, 0.4, 0.85]];
const CHAM_FOOT = [[-58, 0.07, -0.4, 0.85], [62, 0.078, 0.4, 0.95]];
const sauLimb = (o) => ({ inset: 0.6, drop: 0.3, endH: 1.3, arch: 0.25, ...o });

/* Komodo dragon (Varanus komodoensis): SVL 1.3 m of 2.6 m; a long neck, long flat-topped head, heavy bowed limbs with
   big claws; beaded scales; a forked yellow tongue */
const T_KOMODO = {
  tail: 1.0, sh: 0.36, hip: 0.92, tailTouch: 0.22, tailBones: 9,
  body: [[0.15, 0.05, 0.045, 0.06], [0.21, 0.062, 0.052, 0.07], [0.29, 0.07, 0.058, 0.078], [0.37, 0.09, 0.07, 0.088], [0.55, 0.112, 0.08, 0.095], [0.75, 0.11, 0.078, 0.092], [0.9, 0.09, 0.07, 0.075], [1.0, 0.075, 0.064, 0.058], [1.15, 0.062, 0.058, 0.05], [1.4, 0.045, 0.05, 0.04], [1.65, 0.028, 0.038, 0.028], [1.85, 0.014, 0.022, 0.015], [2.0, 0.003, 0.003, 0.003]],
  axis: [[0.1, 0.19], [0.21, 0.165], [0.36, 0.14], [0.6, 0.128], [0.92, 0.115], [1.0, 0.105]],
  head: {
    len: 0.19, pitch: 4,
    skull: [[0, 0.24, 0.17, 0.08, 0], [0.2, 0.25, 0.18, 0.08, 0], [0.4, 0.22, 0.17, 0.07, 0], [0.6, 0.18, 0.14, 0.065, -0.01], [0.8, 0.14, 0.11, 0.06, -0.02], [0.93, 0.1, 0.085, 0.055, -0.025], [1, 0.06, 0.06, 0.045, -0.03]],
    jaw: { hinge: 0.04, tip: 0.97, p: [[0, 0.23, 0.25], [0.18, 0.24, 0.25], [0.39, 0.21, 0.2], [0.6, 0.17, 0.155], [0.81, 0.13, 0.13], [1, 0.07, 0.09]] },
    eye: { r: 0.058, u: 0.6, rise: 0.08, yaw: 72, up: 0.25, inset: 0.5, pupil: 'round', pupilR: 0.4 },
    tongue: { root: 0.3, tip: 0.85, rise: -0.12, w: 0.04, fork: 0.3, ext: 0.85 },
  },
  fore: sauLimb({ upper: 0.15, lower: 0.12, foot: [0.22, 0.06], pole: [1, 0.5, -0.55], yaw: 18, R: [0.05, 0.04, 0.026, 0.026, 0.018], palm: { w: 0.026, h: 0.014, l: 0.05 }, digits: scaleD(LIZ_HAND, 0.85), claw: 2.2 }),
  hind: sauLimb({ upper: 0.18, lower: 0.14, foot: [0.27, 0.0], pole: [1, 0.6, 0.35], yaw: 38, R: [0.068, 0.052, 0.03, 0.03, 0.02], palm: { w: 0.03, h: 0.015, l: 0.075 }, digits: scaleD(LIZ_FOOT, 0.7), claw: 2.2 }),
};

/* frilled lizard (Chlamydosaurus kingii): SVL 0.25 m, tail 2.4 × SVL; long hind legs (it runs on them); the frill a
   ruff of skin on hyoid rods, 0.45 SVL from neck to rim, folded back over the shoulders at rest */
const T_FRILLED = {
  tail: 2.4, sh: 0.34, hip: 0.93, tailTouch: 0.15, tailBones: 10,
  body: [[0.17, 0.05, 0.045, 0.055], [0.25, 0.062, 0.05, 0.065], [0.34, 0.08, 0.062, 0.075], [0.5, 0.095, 0.07, 0.08], [0.7, 0.092, 0.068, 0.076], [0.88, 0.078, 0.062, 0.062], [0.98, 0.062, 0.054, 0.048], [1.1, 0.048, 0.046, 0.04], [1.5, 0.03, 0.032, 0.027], [2.2, 0.016, 0.017, 0.015], [3.0, 0.007, 0.008, 0.007], [3.4, 0.002, 0.002, 0.002]],
  axis: [[0.1, 0.2], [0.25, 0.17], [0.34, 0.15], [0.6, 0.125], [0.93, 0.115], [1.0, 0.105]],
  head: {
    len: 0.25, pitch: 10,
    skull: [[0, 0.24, 0.16, 0.08, 0], [0.2, 0.25, 0.18, 0.08, 0.01], [0.42, 0.22, 0.18, 0.075, 0.01], [0.62, 0.18, 0.15, 0.07, -0.005], [0.8, 0.13, 0.12, 0.065, -0.015], [0.93, 0.09, 0.085, 0.055, -0.025], [1, 0.05, 0.05, 0.04, -0.03]],
    jaw: { hinge: 0.04, tip: 0.97, p: [[0, 0.22, 0.24], [0.18, 0.23, 0.23], [0.4, 0.2, 0.18], [0.62, 0.16, 0.14], [0.82, 0.12, 0.11], [1, 0.06, 0.07]] },
    eye: { r: 0.07, u: 0.58, rise: 0.09, yaw: 74, up: 0.25, inset: 0.5, pupil: 'round', pupilR: 0.36 },
    tongue: { root: 0.3, tip: 0.85, rise: -0.12, w: 0.045, ext: 0.12 },
  },
  fore: sauLimb({ upper: 0.17, lower: 0.15, foot: [0.24, 0.09], pole: [1, 0.5, -0.55], yaw: 20, R: [0.038, 0.03, 0.019, 0.019, 0.012], palm: { w: 0.022, h: 0.011, l: 0.045 }, digits: scaleD(LIZ_HAND, 1.05), claw: 1.5 }),
  hind: sauLimb({ upper: 0.27, lower: 0.26, foot: [0.42, -0.1], pole: [1, 0.35, 0.45], yaw: 40, R: [0.052, 0.04, 0.022, 0.02, 0.013], palm: { w: 0.026, h: 0.012, l: 0.1 }, digits: scaleD(LIZ_FOOT, 1.15), claw: 1.5 }),
  crest: { from: 0.2, to: 0.45, gap: 0.02, h: [[0.2, 0.012], [0.26, 0.022], [0.35, 0.016], [0.45, 0.004]], lean: 35, zone: 'body' },
  frill: { s: 0.2, a0: 0.42, len: 0.36, lift: 0.012, pleats: 7, pleat: 0.012, open: 100 },
};

/* leopard gecko (Eublepharis macularius): SVL 0.12 m, a fat tail 0.85 × SVL; a big broad head with large eyes and real
   eyelids, slit pupils; slender legs held high; granular skin studded with tubercles */
const T_GECKO = {
  tail: 0.85, sh: 0.34, hip: 0.9, tailTouch: 0.3, tailBones: 7,
  body: [[0.2, 0.08, 0.05, 0.06], [0.27, 0.085, 0.055, 0.065], [0.36, 0.1, 0.065, 0.07], [0.55, 0.115, 0.07, 0.074], [0.75, 0.11, 0.068, 0.07], [0.9, 0.09, 0.06, 0.058], [1.0, 0.08, 0.06, 0.055], [1.15, 0.085, 0.07, 0.06], [1.35, 0.07, 0.06, 0.05], [1.55, 0.045, 0.04, 0.035], [1.75, 0.018, 0.017, 0.015], [1.85, 0.003, 0.003, 0.003]],
  axis: [[0.1, 0.17], [0.27, 0.15], [0.34, 0.135], [0.6, 0.12], [0.9, 0.115], [1.0, 0.1]],
  head: {
    len: 0.28, pitch: 6,
    skull: [[0, 0.3, 0.16, 0.06, 0], [0.18, 0.34, 0.2, 0.06, 0.01], [0.4, 0.33, 0.22, 0.06, 0.02], [0.6, 0.27, 0.19, 0.055, 0.01], [0.78, 0.2, 0.15, 0.05, -0.005], [0.92, 0.13, 0.1, 0.045, -0.015], [1, 0.07, 0.06, 0.04, -0.02]],
    jaw: { hinge: 0.05, tip: 0.97, p: [[0, 0.29, 0.2], [0.2, 0.32, 0.18], [0.42, 0.3, 0.15], [0.62, 0.25, 0.12], [0.82, 0.17, 0.09], [1, 0.07, 0.06]] },
    eye: { r: 0.11, u: 0.55, rise: 0.08, yaw: 70, up: 0.3, inset: 0.45, pupil: 'slit', lidH: 1.0 },
    tongue: { root: 0.3, tip: 0.8, rise: -0.1, w: 0.06, ext: 0.08 },
  },
  fore: sauLimb({ upper: 0.13, lower: 0.12, foot: [0.24, 0.06], pole: [1, 0.55, -0.5], yaw: 25, R: [0.034, 0.026, 0.016, 0.015, 0.011], palm: { w: 0.02, h: 0.01, l: 0.04 }, digits: scaleD(LIZ_HAND, 0.95), claw: 0.9 }),
  hind: sauLimb({ upper: 0.16, lower: 0.15, foot: [0.28, -0.01], pole: [1, 0.6, 0.35], yaw: 42, R: [0.042, 0.032, 0.018, 0.017, 0.012], palm: { w: 0.022, h: 0.011, l: 0.06 }, digits: scaleD(LIZ_FOOT, 0.7), claw: 0.9 }),
};

/* tuatara (Sphenodon punctatus): SVL 0.3 m, tail 0.95 × SVL; a big blunt head with a beak-like snout, large dark eyes,
   a crest of soft white spines on the nape and back; stout limbs, partly webbed toes */
const T_TUATARA = {
  tail: 0.95, sh: 0.35, hip: 0.92, tailTouch: 0.2, tailBones: 8,
  body: [[0.17, 0.06, 0.05, 0.06], [0.25, 0.075, 0.06, 0.07], [0.35, 0.095, 0.07, 0.08], [0.55, 0.11, 0.08, 0.088], [0.75, 0.108, 0.078, 0.084], [0.9, 0.09, 0.068, 0.068], [1.0, 0.075, 0.062, 0.055], [1.2, 0.058, 0.056, 0.046], [1.45, 0.04, 0.045, 0.033], [1.7, 0.022, 0.028, 0.02], [1.95, 0.003, 0.003, 0.003]],
  axis: [[0.1, 0.18], [0.25, 0.16], [0.35, 0.14], [0.6, 0.125], [0.92, 0.115], [1.0, 0.105]],
  head: {
    len: 0.24, pitch: 6,
    skull: [[0, 0.28, 0.2, 0.09, 0], [0.2, 0.3, 0.23, 0.09, 0.01], [0.42, 0.27, 0.23, 0.085, 0.01], [0.62, 0.22, 0.2, 0.08, 0], [0.8, 0.17, 0.16, 0.08, -0.01], [0.93, 0.12, 0.12, 0.075, -0.02], [1, 0.07, 0.08, 0.06, -0.03]],
    jaw: { hinge: 0.04, tip: 0.96, p: [[0, 0.26, 0.26], [0.18, 0.28, 0.25], [0.4, 0.25, 0.2], [0.62, 0.2, 0.16], [0.82, 0.15, 0.13], [1, 0.08, 0.09]] },
    eye: { r: 0.095, u: 0.56, rise: 0.09, yaw: 72, up: 0.25, inset: 0.45, pupil: 'slit', lidH: 0.95 },
  },
  fore: sauLimb({ upper: 0.13, lower: 0.11, foot: [0.23, 0.07], pole: [1, 0.5, -0.55], yaw: 20, R: [0.042, 0.034, 0.022, 0.022, 0.015], palm: { w: 0.026, h: 0.013, l: 0.045 }, digits: scaleD(LIZ_HAND, 0.8), claw: 1.2, web: 0.35 }),
  hind: sauLimb({ upper: 0.15, lower: 0.13, foot: [0.27, 0.0], pole: [1, 0.6, 0.35], yaw: 38, R: [0.055, 0.042, 0.025, 0.024, 0.016], palm: { w: 0.028, h: 0.014, l: 0.06 }, digits: scaleD(LIZ_FOOT, 0.62), claw: 1.2, web: 0.35 }),
  crest: { from: 0.2, to: 1.6, gap: 0.026, h: [[0.2, 0.04], [0.26, 0.075], [0.33, 0.06], [0.38, 0.03], [0.42, 0.05], [0.7, 0.045], [0.95, 0.034], [1.2, 0.03], [1.6, 0.01]], lean: 18, base: 0.9, th: 0.3, zone: 'marking' },
};

/* panther chameleon (Furcifer pardalis): SVL 0.22 m, tail 1.0 × SVL coiled; a tall, flattened body arched over long
   upright legs; zygodactyl mitts; a low casque; turret eyes that turn on their own; a tongue shot 1.2 × SVL */
const T_CHAMELEON = {
  tail: 1.0, sh: 0.33, hip: 0.86, tailBones: 12,
  curl: { from: 0.18, pitch0: -12, k0: 0.3, k1: 26 },
  body: [[0.16, 0.05, 0.065, 0.065], [0.25, 0.055, 0.075, 0.08], [0.34, 0.062, 0.105, 0.11], [0.5, 0.066, 0.13, 0.125], [0.66, 0.064, 0.13, 0.12], [0.8, 0.058, 0.105, 0.1], [0.92, 0.05, 0.072, 0.066], [1.0, 0.045, 0.055, 0.048], [1.2, 0.036, 0.04, 0.035], [1.5, 0.025, 0.027, 0.024], [1.8, 0.014, 0.015, 0.013], [2.0, 0.004, 0.004, 0.004]],
  axis: [[0.1, 0.39], [0.25, 0.37], [0.34, 0.35], [0.5, 0.35], [0.66, 0.35], [0.86, 0.34], [1.0, 0.32]],
  head: {
    len: 0.27, pitch: -2,
    skull: [[0, 0.2, 0.26, 0.1, 0], [0.2, 0.24, 0.25, 0.1, 0], [0.42, 0.22, 0.22, 0.09, 0], [0.62, 0.17, 0.18, 0.085, -0.02], [0.8, 0.12, 0.14, 0.08, -0.04], [0.94, 0.08, 0.1, 0.07, -0.05], [1, 0.05, 0.06, 0.05, -0.05]],
    jaw: { hinge: 0.05, tip: 0.96, p: [[0, 0.18, 0.3], [0.2, 0.21, 0.28], [0.42, 0.19, 0.22], [0.62, 0.15, 0.16], [0.82, 0.11, 0.12], [1, 0.06, 0.08]] },
    eye: { r: 0.12, u: 0.58, rise: 0.08, yaw: 85, up: 0.15, inset: 0.3, bulge: 0.25, pupil: 'round', pupilR: 0.3, turret: true, bones: true },
    tongue: { root: 0.25, tip: 0.85, rise: -0.14, w: 0.06, club: 0.07, ext: 0.3 },
  },
  casque: { u0: 0.62, r0: 0.17, u1: -0.12, r1: 0.34, bulge: 0.05, w: 0.06, h: 0.07 },
  fore: sauLimb({ upper: 0.2, lower: 0.19, foot: [0.15, 0.05], pole: [0.6, 0.2, -1], yaw: 8, drop: 0.5, inset: 0.7, R: [0.038, 0.029, 0.019, 0.019, 0.014], palm: { w: 0.022, h: 0.013, l: 0.03 }, digits: CHAM_HAND, claw: 0.5, arch: 0.35, endH: 1.2 }),
  hind: sauLimb({ upper: 0.2, lower: 0.2, foot: [0.16, -0.03], pole: [0.6, 0.25, 1], yaw: 10, drop: 0.5, inset: 0.7, R: [0.042, 0.032, 0.02, 0.019, 0.014], palm: { w: 0.022, h: 0.013, l: 0.03 }, digits: CHAM_FOOT, claw: 0.5, arch: 0.35, endH: 1.2 }),
  crest: { from: 0.3, to: 0.95, gap: 0.03, h: [[0.3, 0.012], [0.4, 0.016], [0.7, 0.012], [0.95, 0.004]], lean: 10, base: 0.6, th: 0.5, zone: 'marking' },
};

/* Nile crocodile (Crocodylus niloticus): SVL 2.3 m, tail 0.95 × SVL; a long, flat head 0.29 SVL with a tapering snout,
   eyes and nostrils raised on top, teeth showing along the closed jaws; a broad, low body armoured with keeled
   osteoderms; a tail crested in two rows, then one, and flattened from side to side */
const CROC_ROWS = (nuchal, dorsal, k = 1) => [
  { from: 0.33, to: 0.37, gap: 0.035 * k, x: nuchal, h: 0.4, w: 0.7 },
  { from: 0.44, to: 0.98, gap: 0.034 * k, x: dorsal, h: 0.32, w: 0.66 },
];
const T_CROC = {
  tail: 0.95, sh: 0.42, hip: 0.93, tailTouch: 0.12, tailBones: 9, rad: 11,
  body: [[0.24, 0.1, 0.05, 0.06], [0.3, 0.115, 0.055, 0.07], [0.4, 0.13, 0.062, 0.08], [0.55, 0.15, 0.07, 0.095], [0.75, 0.152, 0.07, 0.095], [0.9, 0.13, 0.066, 0.08], [1.0, 0.1, 0.062, 0.062], [1.15, 0.078, 0.07, 0.055], [1.4, 0.052, 0.07, 0.045], [1.65, 0.03, 0.055, 0.03], [1.85, 0.013, 0.03, 0.014], [1.95, 0.003, 0.003, 0.003]],
  axis: [[0.1, 0.075], [0.3, 0.075], [0.42, 0.088], [0.6, 0.1], [0.93, 0.095], [1.0, 0.085]],
  nb: 2.6,
  head: {
    len: 0.29, pitch: 0, dy: 0.0,
    skull: [[0, 0.21, 0.1, 0.06, 0], [0.12, 0.24, 0.11, 0.055, 0], [0.26, 0.22, 0.115, 0.05, 0.005], [0.4, 0.17, 0.08, 0.045, -0.012], [0.6, 0.13, 0.065, 0.04, -0.022], [0.8, 0.1, 0.055, 0.035, -0.028], [0.92, 0.105, 0.058, 0.035, -0.028], [1, 0.06, 0.04, 0.03, -0.03]],
    jaw: { hinge: 0.02, tip: 0.98, p: [[0, 0.2, 0.18], [0.12, 0.22, 0.17], [0.27, 0.2, 0.12], [0.4, 0.16, 0.09], [0.6, 0.12, 0.08], [0.8, 0.095, 0.075], [1, 0.06, 0.06]] },
    eye: { r: 0.058, u: 0.27, rise: 0.13, yaw: 55, up: 0.85, inset: 0.1, bulge: 0.55, pupil: 'slit', lidH: 0.7 },
  },
  fore: sauLimb({ upper: 0.12, lower: 0.085, foot: [0.24, 0.05], pole: [1, 0.45, -0.6], yaw: 20, drop: 0.35, R: [0.045, 0.036, 0.025, 0.024, 0.017], palm: { w: 0.026, h: 0.013, l: 0.04 }, digits: CROC_HAND, claw: 1.1 }),
  hind: sauLimb({ upper: 0.14, lower: 0.115, foot: [0.28, -0.02], pole: [1, 0.55, 0.35], yaw: 30, drop: 0.35, R: [0.06, 0.048, 0.03, 0.028, 0.02], palm: { w: 0.03, h: 0.014, l: 0.065 }, digits: CROC_FOOT, claw: 1.1, web: 0.55 }),
  scutes: { rows: CROC_ROWS([-0.4, -0.13, 0.13, 0.4], [-0.62, -0.38, -0.13, 0.13, 0.38, 0.62]), tail: { from: 1.02, to: 1.92, merge: 1.4, gap: 0.035, x: 0.45, h: [[1.02, 0.03], [1.3, 0.04], [1.42, 0.045], [1.7, 0.035], [1.92, 0.01]] } },
  teeth: { n: 15, from: 0.2, to: 0.97, h: 0.045, big: [3, 9] },
};

/* American alligator: SVL 1.9 m, a broad, rounded U-shaped snout, darker; otherwise built like the crocodile */
const T_GATOR = { ...T_CROC,
  head: { ...T_CROC.head, len: 0.27,
    skull: [[0, 0.24, 0.1, 0.06, 0], [0.12, 0.27, 0.11, 0.055, 0], [0.26, 0.25, 0.115, 0.05, 0.005], [0.4, 0.21, 0.08, 0.045, -0.012], [0.6, 0.18, 0.065, 0.04, -0.022], [0.8, 0.16, 0.058, 0.036, -0.028], [0.93, 0.13, 0.055, 0.034, -0.028], [1, 0.07, 0.04, 0.03, -0.03]],
    jaw: { hinge: 0.02, tip: 0.98, p: [[0, 0.23, 0.18], [0.12, 0.25, 0.17], [0.27, 0.23, 0.12], [0.4, 0.2, 0.09], [0.6, 0.17, 0.08], [0.8, 0.15, 0.072], [1, 0.07, 0.06]] } },
  teeth: { n: 15, from: 0.2, to: 0.97, h: 0.035, big: [3] },
};

/* sand lizard (Lacerta agilis): SVL 0.085 m, tail 1.4 × SVL; stocky, short-legged, a short deep head */
const T_SANDLIZ = {
  tail: 1.4, sh: 0.34, hip: 0.92, tailTouch: 0.2, tailBones: 9,
  body: [[0.18, 0.06, 0.05, 0.06], [0.26, 0.072, 0.058, 0.068], [0.34, 0.088, 0.066, 0.074], [0.55, 0.1, 0.072, 0.076], [0.75, 0.098, 0.07, 0.072], [0.9, 0.082, 0.062, 0.06], [1.0, 0.068, 0.056, 0.05], [1.2, 0.052, 0.048, 0.042], [1.6, 0.033, 0.032, 0.028], [2.0, 0.017, 0.017, 0.015], [2.3, 0.006, 0.006, 0.006], [2.4, 0.002, 0.002, 0.002]],
  axis: [[0.1, 0.15], [0.26, 0.135], [0.34, 0.12], [0.6, 0.105], [0.92, 0.1], [1.0, 0.09]],
  head: {
    len: 0.24, pitch: 4,
    skull: [[0, 0.25, 0.17, 0.07, 0], [0.2, 0.27, 0.2, 0.07, 0.01], [0.42, 0.24, 0.2, 0.065, 0.01], [0.62, 0.19, 0.17, 0.06, 0], [0.8, 0.14, 0.13, 0.055, -0.015], [0.93, 0.09, 0.09, 0.05, -0.025], [1, 0.05, 0.05, 0.04, -0.03]],
    jaw: { hinge: 0.04, tip: 0.97, p: [[0, 0.24, 0.22], [0.18, 0.25, 0.2], [0.4, 0.22, 0.17], [0.62, 0.17, 0.13], [0.82, 0.12, 0.1], [1, 0.06, 0.065]] },
    eye: { r: 0.075, u: 0.58, rise: 0.09, yaw: 74, up: 0.25, inset: 0.5, pupil: 'round', pupilR: 0.38 },
    tongue: { root: 0.3, tip: 0.85, rise: -0.12, w: 0.04, fork: 0.25, ext: 0.4 },
  },
  fore: sauLimb({ upper: 0.11, lower: 0.095, foot: [0.2, 0.06], pole: [1, 0.5, -0.55], yaw: 22, R: [0.034, 0.026, 0.017, 0.017, 0.012], palm: { w: 0.02, h: 0.01, l: 0.04 }, digits: scaleD(LIZ_HAND, 0.85), claw: 1.2 }),
  hind: sauLimb({ upper: 0.14, lower: 0.13, foot: [0.25, 0.0], pole: [1, 0.6, 0.35], yaw: 40, R: [0.044, 0.034, 0.02, 0.019, 0.013], palm: { w: 0.022, h: 0.011, l: 0.065 }, digits: scaleD(LIZ_FOOT, 0.75), claw: 1.2 }),
};

/* green anole (Anolis carolinensis): SVL 0.065 m, tail 1.8 × SVL; slender with a long pointed head; the male's pink
   dewlap lies folded under the throat until displayed; toe pads */
const T_ANOLE = {
  tail: 1.8, sh: 0.34, hip: 0.92, tailTouch: 0.18, tailBones: 10,
  body: [[0.2, 0.05, 0.042, 0.05], [0.28, 0.06, 0.048, 0.058], [0.35, 0.074, 0.056, 0.064], [0.55, 0.085, 0.064, 0.068], [0.75, 0.083, 0.062, 0.065], [0.9, 0.07, 0.055, 0.054], [1.0, 0.055, 0.048, 0.042], [1.2, 0.04, 0.04, 0.034], [1.8, 0.022, 0.023, 0.02], [2.4, 0.01, 0.011, 0.009], [2.8, 0.002, 0.002, 0.002]],
  axis: [[0.1, 0.16], [0.28, 0.14], [0.35, 0.125], [0.6, 0.11], [0.92, 0.1], [1.0, 0.09]],
  head: {
    len: 0.3, pitch: 6,
    skull: [[0, 0.2, 0.14, 0.06, 0], [0.2, 0.21, 0.16, 0.06, 0.01], [0.42, 0.18, 0.15, 0.055, 0.01], [0.62, 0.14, 0.12, 0.05, -0.005], [0.8, 0.1, 0.09, 0.045, -0.015], [0.94, 0.06, 0.06, 0.04, -0.02], [1, 0.035, 0.035, 0.03, -0.025]],
    jaw: { hinge: 0.04, tip: 0.97, p: [[0, 0.19, 0.18], [0.18, 0.2, 0.17], [0.4, 0.17, 0.13], [0.62, 0.13, 0.1], [0.82, 0.09, 0.08], [1, 0.045, 0.05]] },
    eye: { r: 0.065, u: 0.58, rise: 0.07, yaw: 74, up: 0.25, inset: 0.5, pupil: 'round', pupilR: 0.38 },
    tongue: { root: 0.3, tip: 0.85, rise: -0.1, w: 0.04, ext: 0.1 },
  },
  fore: sauLimb({ upper: 0.14, lower: 0.12, foot: [0.22, 0.07], pole: [1, 0.5, -0.55], yaw: 22, R: [0.028, 0.022, 0.014, 0.014, 0.01], palm: { w: 0.018, h: 0.009, l: 0.04 }, digits: scaleD(LIZ_HAND, 0.95), claw: 0.8, pad: 1.5 }),
  hind: sauLimb({ upper: 0.18, lower: 0.17, foot: [0.27, 0.0], pole: [1, 0.6, 0.35], yaw: 40, R: [0.036, 0.028, 0.016, 0.015, 0.011], palm: { w: 0.02, h: 0.01, l: 0.075 }, digits: scaleD(LIZ_FOOT, 0.95), claw: 0.8, pad: 1.5 }),
  dewlap: { from: 0.04, to: 0.3, depth: [[0.04, 0], [0.1, 0.015], [0.18, 0.02], [0.26, 0.012], [0.3, 0]], zone: 'accent', free: 1 },
};

/* fire salamander (Salamandra salamandra): SVL 0.115 m, tail 0.75 × SVL; stout, a broad rounded head with big
   parotoid glands, smooth glossy skin, short legs with four fingers and five toes */
const T_FIRESAL = {
  tail: 0.75, sh: 0.3, hip: 0.88, tailTouch: 0.2, tailBones: 7,
  body: [[0.16, 0.08, 0.06, 0.065], [0.24, 0.09, 0.065, 0.07], [0.3, 0.1, 0.07, 0.074], [0.5, 0.11, 0.075, 0.076], [0.7, 0.108, 0.072, 0.074], [0.88, 0.09, 0.066, 0.064], [1.0, 0.07, 0.062, 0.052], [1.2, 0.052, 0.054, 0.042], [1.45, 0.03, 0.035, 0.026], [1.65, 0.012, 0.014, 0.011], [1.75, 0.003, 0.003, 0.003]],
  axis: [[0.1, 0.12], [0.24, 0.11], [0.3, 0.105], [0.6, 0.098], [0.88, 0.094], [1.0, 0.085]],
  head: {
    len: 0.22, pitch: 2,
    skull: [[0, 0.36, 0.16, 0.06, 0], [0.2, 0.38, 0.18, 0.06, 0.005], [0.42, 0.36, 0.18, 0.06, 0.01], [0.62, 0.31, 0.16, 0.055, 0], [0.8, 0.24, 0.13, 0.05, -0.01], [0.93, 0.15, 0.09, 0.045, -0.015], [1, 0.08, 0.05, 0.04, -0.02]],
    jaw: { hinge: 0.05, tip: 0.97, p: [[0, 0.35, 0.2], [0.2, 0.37, 0.18], [0.42, 0.35, 0.15], [0.62, 0.29, 0.12], [0.82, 0.21, 0.09], [1, 0.08, 0.06]] },
    eye: { r: 0.085, u: 0.6, rise: 0.1, yaw: 65, up: 0.35, inset: 0.4, bulge: 0.1, pupil: 'round', pupilR: 0.42, lidH: 0.9 },
    tongue: { root: 0.3, tip: 0.8, rise: -0.1, w: 0.06, club: 0.05, ext: 0.12 },
  },
  fore: sauLimb({ upper: 0.12, lower: 0.1, foot: [0.2, 0.06], pole: [1, 0.55, -0.5], yaw: 25, R: [0.04, 0.032, 0.024, 0.024, 0.018], palm: { w: 0.024, h: 0.012, l: 0.035 }, digits: SAL_HAND, arch: 0.15 }),
  hind: sauLimb({ upper: 0.13, lower: 0.11, foot: [0.22, 0.0], pole: [1, 0.6, 0.3], yaw: 35, R: [0.045, 0.036, 0.025, 0.024, 0.018], palm: { w: 0.026, h: 0.012, l: 0.04 }, digits: SAL_FOOT, arch: 0.15 }),
  parotoid: { s: 0.2, a: 40, r: 0.05 },
};

/* Chinese giant salamander (Andrias davidianus): SVL 0.93 m, tail 0.5 × SVL; very flat, a broad flat head with tiny eyes,
   wrinkled folds of skin along the flanks, short limbs, a tail flattened from side to side with a keel */
const T_GIANTSAL = {
  tail: 0.5, sh: 0.26, hip: 0.86, tailTouch: 0.25, tailBones: 6,
  body: [[0.14, 0.11, 0.04, 0.045], [0.2, 0.12, 0.045, 0.05], [0.26, 0.125, 0.05, 0.052], [0.45, 0.14, 0.055, 0.056], [0.68, 0.135, 0.054, 0.055], [0.86, 0.11, 0.05, 0.05], [0.98, 0.075, 0.05, 0.045], [1.1, 0.05, 0.06, 0.04], [1.3, 0.032, 0.06, 0.032], [1.45, 0.012, 0.035, 0.012], [1.5, 0.003, 0.003, 0.003]],
  axis: [[0.1, 0.06], [0.2, 0.06], [0.26, 0.062], [0.5, 0.064], [0.86, 0.064], [1.0, 0.06]],
  head: {
    len: 0.2, pitch: 0,
    skull: [[0, 0.5, 0.18, 0.06, 0], [0.2, 0.56, 0.18, 0.06, 0], [0.42, 0.56, 0.17, 0.055, 0], [0.62, 0.52, 0.15, 0.05, -0.005], [0.8, 0.44, 0.12, 0.045, -0.01], [0.93, 0.3, 0.09, 0.04, -0.015], [1, 0.14, 0.05, 0.035, -0.02]],
    jaw: { hinge: 0.05, tip: 0.97, p: [[0, 0.48, 0.16], [0.2, 0.54, 0.15], [0.42, 0.53, 0.13], [0.62, 0.48, 0.11], [0.82, 0.38, 0.09], [1, 0.14, 0.06]] },
    eye: { r: 0.03, u: 0.72, rise: 0.12, yaw: 60, up: 0.6, inset: 0.4, pupil: 'round', pupilR: 0.5, lid: false },
  },
  fore: sauLimb({ upper: 0.1, lower: 0.08, foot: [0.22, 0.05], pole: [1, 0.5, -0.5], yaw: 30, R: [0.045, 0.036, 0.026, 0.026, 0.02], palm: { w: 0.03, h: 0.012, l: 0.035 }, digits: scaleD(SAL_HAND, 0.85), arch: 0.12 }),
  hind: sauLimb({ upper: 0.11, lower: 0.09, foot: [0.24, -0.01], pole: [1, 0.55, 0.3], yaw: 40, R: [0.05, 0.04, 0.028, 0.027, 0.02], palm: { w: 0.032, h: 0.012, l: 0.04 }, digits: scaleD(SAL_FOOT, 0.85), arch: 0.12, web: 0.3 }),
  folds: { from: 0.3, to: 0.84, h: 0.028, drop: 0.012, waves: 9 },
  fin: { from: 1.0, to: 1.49, h: [[1.0, 0.0], [1.1, 0.012], [1.3, 0.014], [1.49, 0.002]], zone: 'body' },
};

/* axolotl (Ambystoma mexicanum), leucistic: SVL 0.14 m, tail 0.8 × SVL; a broad head with a wide smile and tiny lidless
   eyes, three feathery gills a side, a fin from behind the head to the tail tip and under the tail; slender legs */
const T_AXOLOTL = {
  tail: 0.8, sh: 0.3, hip: 0.86, tailTouch: 0.4, tailBones: 7,
  body: [[0.16, 0.1, 0.06, 0.06], [0.24, 0.1, 0.064, 0.064], [0.3, 0.1, 0.068, 0.07], [0.5, 0.098, 0.072, 0.074], [0.7, 0.094, 0.07, 0.072], [0.86, 0.08, 0.065, 0.064], [1.0, 0.06, 0.07, 0.058], [1.2, 0.04, 0.07, 0.048], [1.45, 0.025, 0.05, 0.032], [1.7, 0.01, 0.022, 0.014], [1.8, 0.002, 0.003, 0.003]],
  axis: [[0.1, 0.13], [0.24, 0.12], [0.3, 0.115], [0.6, 0.108], [0.86, 0.105], [1.0, 0.1]],
  head: {
    len: 0.25, pitch: 2,
    skull: [[0, 0.4, 0.17, 0.06, 0], [0.2, 0.44, 0.19, 0.06, 0.005], [0.42, 0.44, 0.19, 0.06, 0.01], [0.62, 0.4, 0.17, 0.055, 0], [0.8, 0.32, 0.14, 0.05, -0.01], [0.93, 0.2, 0.1, 0.045, -0.015], [1, 0.1, 0.06, 0.04, -0.02]],
    jaw: { hinge: 0.05, tip: 0.97, p: [[0, 0.39, 0.2], [0.2, 0.43, 0.18], [0.42, 0.42, 0.15], [0.62, 0.37, 0.12], [0.82, 0.28, 0.09], [1, 0.1, 0.06]] },
    eye: { r: 0.045, u: 0.68, rise: 0.12, yaw: 70, up: 0.3, inset: 0.4, pupil: 'round', pupilR: 0.5, lid: false },
  },
  fore: sauLimb({ upper: 0.12, lower: 0.1, foot: [0.2, 0.06], pole: [1, 0.5, -0.5], yaw: 30, R: [0.026, 0.02, 0.014, 0.014, 0.01], palm: { w: 0.018, h: 0.008, l: 0.03 }, digits: scaleD(SAL_HAND, 1.05).map(d => [d[0], d[1], d[2], 0.4]), arch: 0.15 }),
  hind: sauLimb({ upper: 0.13, lower: 0.11, foot: [0.22, 0.0], pole: [1, 0.55, 0.3], yaw: 40, R: [0.03, 0.024, 0.015, 0.015, 0.011], palm: { w: 0.02, h: 0.008, l: 0.035 }, digits: scaleD(SAL_FOOT, 1.05).map(d => [d[0], d[1], d[2], 0.4]), arch: 0.15 }),
  gills: { u: 0.02, rise: 0.1, dr: -0.12, x: 0.36, fan: [35, 10, -15], len: [0.48, 0.42, 0.36], w: 0.03, fil: 9, fl: 0.11, zone: 'accent' },
  fin: { from: 0.32, to: 1.79, h: [[0.32, 0.0], [0.45, 0.012], [0.9, 0.018], [1.1, 0.04], [1.35, 0.05], [1.6, 0.035], [1.79, 0.004]], zone: 'accent2' },
  finBelly: { from: 1.02, to: 1.78, h: [[1.02, 0.0], [1.15, 0.03], [1.4, 0.035], [1.78, 0.004]], zone: 'accent2' },
};

/* alpine newt (Ichthyosaura alpestris), breeding male: SVL 0.054 m, tail 0.85 × SVL; slim, a low crest and tail fins */
const T_NEWT = {
  tail: 0.85, sh: 0.3, hip: 0.87, tailTouch: 0.25, tailBones: 7,
  body: [[0.16, 0.07, 0.05, 0.055], [0.24, 0.078, 0.055, 0.06], [0.3, 0.085, 0.06, 0.064], [0.5, 0.092, 0.066, 0.068], [0.7, 0.09, 0.064, 0.066], [0.87, 0.075, 0.058, 0.056], [1.0, 0.055, 0.055, 0.048], [1.2, 0.035, 0.05, 0.038], [1.45, 0.022, 0.035, 0.026], [1.75, 0.006, 0.01, 0.006], [1.85, 0.002, 0.002, 0.002]],
  axis: [[0.1, 0.12], [0.24, 0.112], [0.3, 0.105], [0.6, 0.098], [0.87, 0.095], [1.0, 0.088]],
  head: {
    len: 0.23, pitch: 2,
    skull: [[0, 0.3, 0.15, 0.055, 0], [0.2, 0.32, 0.17, 0.055, 0.005], [0.42, 0.31, 0.17, 0.055, 0.01], [0.62, 0.27, 0.15, 0.05, 0], [0.8, 0.2, 0.12, 0.045, -0.01], [0.93, 0.13, 0.08, 0.04, -0.015], [1, 0.07, 0.05, 0.035, -0.02]],
    jaw: { hinge: 0.05, tip: 0.97, p: [[0, 0.29, 0.18], [0.2, 0.31, 0.16], [0.42, 0.3, 0.14], [0.62, 0.25, 0.11], [0.82, 0.18, 0.085], [1, 0.07, 0.055]] },
    eye: { r: 0.09, u: 0.62, rise: 0.1, yaw: 68, up: 0.3, inset: 0.4, bulge: 0.1, pupil: 'round', pupilR: 0.45, lidH: 0.9 },
    tongue: { root: 0.3, tip: 0.8, rise: -0.1, w: 0.06, club: 0.05, ext: 0.12 },
  },
  fore: sauLimb({ upper: 0.12, lower: 0.1, foot: [0.19, 0.06], pole: [1, 0.55, -0.5], yaw: 25, R: [0.026, 0.02, 0.015, 0.015, 0.011], palm: { w: 0.018, h: 0.009, l: 0.03 }, digits: SAL_HAND, arch: 0.15 }),
  hind: sauLimb({ upper: 0.13, lower: 0.11, foot: [0.21, 0.0], pole: [1, 0.6, 0.3], yaw: 35, R: [0.03, 0.024, 0.016, 0.016, 0.012], palm: { w: 0.02, h: 0.009, l: 0.035 }, digits: SAL_FOOT, arch: 0.15 }),
  fin: { from: 0.28, to: 1.84, h: [[0.28, 0.0], [0.35, 0.012], [0.85, 0.012], [0.98, 0.006], [1.15, 0.03], [1.5, 0.03], [1.84, 0.002]], zone: 'marking', edge: 'pattern' },
  finBelly: { from: 1.04, to: 1.82, h: [[1.04, 0.0], [1.2, 0.02], [1.5, 0.022], [1.82, 0.002]], zone: 'belly' },
};

/* ── snakes and the caecilian: sections [s, half-width, half-height above, half-height below] × total length ── */
/* reticulated python (Malayopython reticulatus): 6 m; heavy, girth 0.034 of its length at mid-body, a narrow neck and a
   long flat head 0.028; tail 0.12; smooth small scales; heat pits along the lips */
const T_PYTHON = {
  vent: 0.88, bones: 30, tailBones: 7, seg: 220,
  rest: { a: 78, l: 0.3, ph: 0.3 },
  body: [[0.015, 0.0062, 0.0055, 0.005], [0.03, 0.0058, 0.0055, 0.005], [0.06, 0.008, 0.0075, 0.0065], [0.15, 0.012, 0.011, 0.009], [0.35, 0.016, 0.014, 0.0115], [0.55, 0.017, 0.015, 0.012], [0.75, 0.0152, 0.0135, 0.011], [0.88, 0.011, 0.0098, 0.008], [0.95, 0.006, 0.0058, 0.005], [1.0, 0.0008, 0.0008, 0.0008]],
  head: {
    len: 0.032, pitch: 4,
    skull: [[0, 0.3, 0.17, 0.09, 0], [0.25, 0.32, 0.18, 0.08, 0], [0.5, 0.27, 0.17, 0.07, 0], [0.75, 0.21, 0.14, 0.065, -0.01], [0.92, 0.15, 0.1, 0.06, -0.02], [1, 0.08, 0.06, 0.045, -0.02]],
    jaw: { hinge: 0.02, tip: 0.97, p: [[0, 0.28, 0.18], [0.25, 0.3, 0.15], [0.5, 0.25, 0.12], [0.75, 0.19, 0.09], [1, 0.08, 0.06]] },
    eye: { r: 0.07, u: 0.62, rise: 0.08, yaw: 70, up: 0.3, inset: 0.45, pupil: 'slit', lid: false },
    tongue: { root: 0.35, tip: 0.85, rise: -0.1, w: 0.03, fork: 0.3, ext: 0.7 },
  },
  slither: { a: 0.055, l: 0.5, fr: 0.04 },
};
/* king cobra (Ophiophagus hannah): 4 m, slender (girth 0.018), a rounded head 0.028 with big shields, tail 0.2; a long
   narrow hood of ribs behind the head */
const T_COBRA = {
  vent: 0.8, bones: 30, tailBones: 8, seg: 200, neckDense: 1.3,
  rest: { a: 66, l: 0.3, ph: 0.4 },
  body: [[0.015, 0.0068, 0.0062, 0.0055], [0.035, 0.0068, 0.006, 0.0055], [0.08, 0.0078, 0.0068, 0.006], [0.2, 0.0088, 0.0078, 0.0068], [0.45, 0.0095, 0.0084, 0.0072], [0.65, 0.0092, 0.0082, 0.007], [0.8, 0.0075, 0.0068, 0.006], [0.92, 0.0042, 0.004, 0.0036], [1.0, 0.0006, 0.0006, 0.0006]],
  head: {
    len: 0.028, pitch: 6,
    skull: [[0, 0.32, 0.2, 0.08, 0], [0.3, 0.34, 0.21, 0.08, 0], [0.55, 0.3, 0.19, 0.07, 0], [0.8, 0.22, 0.15, 0.065, -0.01], [0.95, 0.14, 0.1, 0.055, -0.02], [1, 0.07, 0.06, 0.04, -0.02]],
    jaw: { hinge: 0.02, tip: 0.97, p: [[0, 0.3, 0.17], [0.3, 0.32, 0.15], [0.55, 0.28, 0.12], [0.8, 0.2, 0.09], [1, 0.07, 0.06]] },
    eye: { r: 0.08, u: 0.62, rise: 0.08, yaw: 70, up: 0.3, inset: 0.45, pupil: 'round', pupilR: 0.42, lid: false },
    tongue: { root: 0.35, tip: 0.85, rise: -0.1, w: 0.03, fork: 0.3, ext: 0.7 },
  },
  hood: { from: 0.035, to: 0.125, spread: 0.011, shift: -0.008 },
  slither: { a: 0.07, l: 0.36, fr: 0.12 },
  raise: 0.28,
};
/* sidewinder (Crotalus cerastes): 0.7 m, stout (girth 0.045), a broad triangular head 0.06 with a horn over each eye,
   a short tail with a rattle */
const T_SIDEWINDER = {
  vent: 0.9, bones: 26, tailBones: 6, seg: 150,
  rest: { a: 82, l: 0.34, ph: 0.2 },
  body: [[0.03, 0.009, 0.008, 0.007], [0.07, 0.0095, 0.009, 0.008], [0.12, 0.015, 0.014, 0.012], [0.3, 0.021, 0.018, 0.015], [0.55, 0.022, 0.019, 0.016], [0.78, 0.018, 0.016, 0.013], [0.9, 0.012, 0.011, 0.009], [0.97, 0.007, 0.0065, 0.006], [1.0, 0.005, 0.005, 0.005]],
  head: {
    len: 0.06, pitch: 3,
    skull: [[0, 0.42, 0.18, 0.1, 0], [0.25, 0.42, 0.2, 0.09, 0], [0.5, 0.33, 0.19, 0.08, 0], [0.75, 0.24, 0.15, 0.07, -0.01], [0.93, 0.15, 0.1, 0.06, -0.02], [1, 0.08, 0.06, 0.045, -0.02]],
    jaw: { hinge: 0.02, tip: 0.96, p: [[0, 0.4, 0.2], [0.25, 0.4, 0.16], [0.5, 0.31, 0.12], [0.75, 0.22, 0.09], [1, 0.08, 0.06]] },
    eye: { r: 0.075, u: 0.6, rise: 0.08, yaw: 72, up: 0.3, inset: 0.45, pupil: 'slit', lid: false },
    tongue: { root: 0.35, tip: 0.85, rise: -0.1, w: 0.03, fork: 0.3, ext: 0.6 },
  },
  horns: 0.11,
  rattle: { n: 7, r: 0.0058, l: 0.006 },
  sidewind: { a: 0.075, b: 0.022, l: 0.42, speed: 0.35 },
};
/* common garter snake (Thamnophis sirtalis): 0.65 m, slender (girth 0.024), head 0.04, tail 0.25, keeled scales */
const T_GARTER = {
  vent: 0.75, bones: 28, tailBones: 8, seg: 160,
  rest: { a: 72, l: 0.28, ph: 0.5 },
  body: [[0.02, 0.0085, 0.0075, 0.0068], [0.05, 0.0085, 0.0078, 0.007], [0.1, 0.0105, 0.0095, 0.0085], [0.3, 0.012, 0.011, 0.0095], [0.55, 0.0118, 0.0108, 0.0093], [0.75, 0.0092, 0.0085, 0.0075], [0.9, 0.0045, 0.0043, 0.004], [1.0, 0.0006, 0.0006, 0.0006]],
  head: {
    len: 0.04, pitch: 5,
    skull: [[0, 0.27, 0.17, 0.08, 0], [0.3, 0.28, 0.18, 0.08, 0], [0.6, 0.23, 0.15, 0.07, 0], [0.85, 0.16, 0.11, 0.06, -0.01], [1, 0.07, 0.05, 0.04, -0.02]],
    jaw: { hinge: 0.02, tip: 0.97, p: [[0, 0.25, 0.15], [0.3, 0.26, 0.13], [0.6, 0.21, 0.1], [0.85, 0.14, 0.08], [1, 0.07, 0.05]] },
    eye: { r: 0.1, u: 0.62, rise: 0.08, yaw: 70, up: 0.3, inset: 0.45, pupil: 'round', pupilR: 0.42, lid: false },
    tongue: { root: 0.35, tip: 0.85, rise: -0.1, w: 0.035, fork: 0.3, ext: 0.6 },
  },
  slither: { a: 0.08, l: 0.3, fr: 0.3 },
};
/* ringed caecilian (Siphonops annulatus): 0.35 m, a stout cylinder (girth 0.032) ringed by grooves, a blunt bullet head
   with tiny eyes under the skin and a countersunk mouth; almost no tail */
const T_CAECILIAN = {
  vent: 0.985, bones: 26, tailBones: 2, seg: 160,
  rest: { a: 60, l: 0.36, ph: 0.6, lift: [[0, 0.004], [0.05, 0.0]] },
  body: [[0.02, 0.0145, 0.0135, 0.0125], [0.06, 0.0155, 0.0148, 0.0138], [0.3, 0.016, 0.0152, 0.014], [0.7, 0.016, 0.0152, 0.014], [0.92, 0.015, 0.0145, 0.0135], [0.985, 0.012, 0.012, 0.011], [1.0, 0.004, 0.004, 0.004]],
  head: {
    len: 0.045, pitch: 0, nt: 2.0, nb: 2.0, tipCap: 0.8,
    skull: [[0, 0.33, 0.31, 0.12, 0], [0.4, 0.32, 0.3, 0.12, 0], [0.7, 0.27, 0.25, 0.11, 0], [0.9, 0.19, 0.17, 0.09, 0], [1, 0.1, 0.09, 0.06, 0]],
    jaw: { hinge: 0.15, tip: 0.86, overlap: 0.05, p: [[0, 0.27, 0.2], [0.4, 0.25, 0.17], [0.75, 0.19, 0.12], [1, 0.1, 0.07]] },
    eye: { r: 0.035, u: 0.72, rise: 0.12, yaw: 70, up: 0.3, inset: 0.75, pupil: 'round', pupilR: 0.6, lid: false },
  },
  slither: { a: 0.045, l: 0.28, fr: 0.05 },
};

/* ── turtles: fractions of the straight carapace length V ── */
/* Galápagos giant tortoise (Chelonoidis niger), domed form: shell 0.8 as wide as long, its top 0.62 above the ground
   standing, the plastron 0.13 up; a long neck; bowed forelegs with big scales and five claws, columnar hind legs */
const T_TORTOISE = {
  shell: { w: 0.4, front: 0.5, back: 0.5, plastronY: 0.13, rimY: 0.25, dome: 0.37, n: 2.4, p: 2.0, q: 0.55, nuchal: 0.06, rear: 0.02, flare: 0.03, th: 0.03 },
  scutes: { rM: 0.87, seam: 0.018, rings: 0.045 },
  plastron: { w: 0.3, front: 0.42, back: 0.43, n: 3, seams: [-0.78, -0.42, 0.05, 0.4, 0.74], bridge: [0.42, 0.38], lift: 0.03 },
  body: { y: 0.16, w: 0.33, h: 0.15, l: 0.44 },
  neck: { y0: 0.17, z0: 0.3, y1: 0.31, z1: 0.62, arch: 0.07, r0: 0.1, r1: 0.072 },
  head: {
    len: 0.17, pitch: 0,
    skull: [[0, 0.3, 0.32, 0.12, 0], [0.3, 0.33, 0.33, 0.12, 0], [0.6, 0.3, 0.28, 0.11, -0.02], [0.82, 0.22, 0.2, 0.1, -0.05], [0.95, 0.12, 0.13, 0.08, -0.07], [1, 0.06, 0.07, 0.05, -0.08]],
    jaw: { hinge: 0.1, tip: 0.95, p: [[0, 0.28, 0.3], [0.4, 0.28, 0.24], [0.75, 0.2, 0.16], [1, 0.08, 0.08]] },
    eye: { r: 0.08, u: 0.62, rise: 0.1, yaw: 72, up: 0.2, inset: 0.45, pupil: 'round', pupilR: 0.45, lidH: 0.9 },
  },
  fore: { J0: [0.2, 0.2, 0.32], J1: [0.4, 0.2, 0.38], J2: [0.38, 0.04, 0.42], yaw: -12, R: [0.07, 0.07, 0.065, 0.07, 0.06], flat: 0.8, palm: { w: 0.06, h: 0.03, l: 0.07 }, digits: [[-50, 0.025, -0.8, 0.5], [-25, 0.03, -0.4, 0.5], [0, 0.032, 0, 0.5], [25, 0.03, 0.4, 0.5], [50, 0.025, 0.8, 0.5]], claw: 1.6 },
  hind: { J0: [0.18, 0.15, -0.3], J1: [0.3, 0.2, -0.36], J2: [0.32, 0.055, -0.36], yaw: 0, R: [0.08, 0.08, 0.072, 0.068, 0.052], palm: { w: 0.07, h: 0.035, l: 0.05 }, digits: [[-40, 0.015, -0.6, 0.5], [-12, 0.018, -0.2, 0.5], [12, 0.018, 0.2, 0.5], [40, 0.015, 0.6, 0.5]], claw: 1.5 },
  tail: { y: 0.12, z: 0.45, len: 0.1, drop: 0.05, r: 0.04 },
};
/* green sea turtle (Chelonia mydas): a low, heart-shaped shell 0.75 as wide as long, its top 0.25 up; a short neck and
   rounded head with big eyes; long front flippers (0.62 of the shell) with one claw, short rounded hind flippers */
const T_SEATURTLE = {
  shell: { w: 0.38, front: 0.47, back: 0.53, taper: 0.42, plastronY: 0.05, rimY: 0.1, dome: 0.15, n: 2.2, p: 2.4, q: 0.7, nuchal: 0.012, rear: -0.01, flare: 0.0, th: 0.025 },
  scutes: { rM: 0.88, seam: 0.014 },
  plastron: { w: 0.3, front: 0.36, back: 0.38, n: 3, seams: [-0.7, -0.3, 0.1, 0.45, 0.78], bridge: [0.5, 0.25], lift: 0.04 },
  body: { y: 0.08, w: 0.3, h: 0.07, l: 0.4 },
  neck: { y0: 0.09, z0: 0.35, y1: 0.12, z1: 0.56, arch: 0.01, r0: 0.075, r1: 0.062 },
  head: {
    len: 0.17, pitch: -2,
    skull: [[0, 0.32, 0.3, 0.12, 0], [0.3, 0.34, 0.32, 0.12, 0], [0.6, 0.3, 0.28, 0.11, -0.02], [0.82, 0.22, 0.21, 0.1, -0.04], [0.95, 0.13, 0.13, 0.08, -0.06], [1, 0.06, 0.07, 0.05, -0.07]],
    jaw: { hinge: 0.1, tip: 0.95, p: [[0, 0.3, 0.28], [0.4, 0.29, 0.22], [0.75, 0.2, 0.15], [1, 0.08, 0.08]] },
    eye: { r: 0.11, u: 0.6, rise: 0.08, yaw: 70, up: 0.15, inset: 0.45, pupil: 'round', pupilR: 0.5, lidH: 0.9 },
  },
  fore: { flipper: true, J0: [0.2, 0.08, 0.3], J1: [0.33, 0.07, 0.3], J2: [0.55, 0.05, 0.18], J3: [0.82, 0.03, -0.08], r: 0.045, chord: 0.2, thick: 0.035, claw: true },
  hind: { flipper: true, J0: [0.15, 0.07, -0.33], J1: [0.22, 0.06, -0.42], J2: [0.3, 0.05, -0.5], J3: [0.36, 0.04, -0.62], r: 0.04, chord: 0.14, thick: 0.025 },
  tail: { y: 0.07, z: 0.48, len: 0.06, drop: 0.01, r: 0.025 },
};
/* eastern box turtle (Terrapene carolina): a high, oval dome 0.5 as tall as long, a big plastron that can close the
   shell; short clawed legs; red eyes (males) */
const T_BOXTURTLE = {
  shell: { w: 0.36, front: 0.5, back: 0.5, plastronY: 0.04, rimY: 0.12, dome: 0.36, n: 2.2, p: 2.4, q: 0.5, nuchal: 0.02, rear: 0.0, flare: 0.012, th: 0.03 },
  scutes: { rM: 0.88, seam: 0.018, rings: 0.05 },
  plastron: { w: 0.32, front: 0.47, back: 0.47, n: 3, seams: [-0.75, -0.4, 0.05, 0.4, 0.75], bridge: [0.3, 0.3], lift: 0.02 },
  body: { y: 0.12, w: 0.3, h: 0.12, l: 0.4 },
  neck: { y0: 0.14, z0: 0.32, y1: 0.18, z1: 0.56, arch: 0.02, r0: 0.07, r1: 0.056 },
  head: {
    len: 0.22, pitch: 0,
    skull: [[0, 0.28, 0.3, 0.12, 0], [0.3, 0.31, 0.31, 0.12, 0], [0.6, 0.28, 0.27, 0.11, -0.02], [0.82, 0.2, 0.2, 0.1, -0.05], [0.95, 0.11, 0.13, 0.08, -0.08], [1, 0.05, 0.07, 0.05, -0.09]],
    jaw: { hinge: 0.1, tip: 0.93, p: [[0, 0.26, 0.28], [0.4, 0.26, 0.22], [0.75, 0.18, 0.15], [1, 0.07, 0.07]] },
    eye: { r: 0.095, u: 0.62, rise: 0.1, yaw: 70, up: 0.2, inset: 0.45, pupil: 'round', pupilR: 0.35, lidH: 0.9 },
  },
  fore: { J0: [0.2, 0.12, 0.28], J1: [0.34, 0.1, 0.34], J2: [0.36, 0.03, 0.38], yaw: 10, R: [0.06, 0.055, 0.045, 0.042, 0.034], palm: { w: 0.045, h: 0.018, l: 0.05 }, digits: [[-50, 0.03, -0.8, 0.45], [-25, 0.035, -0.4, 0.45], [0, 0.038, 0, 0.45], [25, 0.035, 0.4, 0.45], [50, 0.03, 0.8, 0.45]], claw: 1.5 },
  hind: { J0: [0.18, 0.12, -0.28], J1: [0.3, 0.1, -0.34], J2: [0.32, 0.025, -0.36], yaw: 15, R: [0.065, 0.06, 0.05, 0.048, 0.042], palm: { w: 0.05, h: 0.02, l: 0.05 }, digits: [[-40, 0.03, -0.6, 0.45], [-12, 0.035, -0.2, 0.45], [12, 0.035, 0.2, 0.45], [40, 0.03, 0.6, 0.45]], claw: 1.4 },
  tail: { y: 0.1, z: 0.44, len: 0.08, drop: 0.04, r: 0.03 },
};

/* ── frogs and toads: fractions of the snout–vent length V. Hind legs folded beside the body: hip, knee, heel and
   tarsal joint (tm) positions [out, up, along] from the vent; toes [angle, length, offset, thickness] ── */
const FROG_HAND = [[-35, 0.06, -0.7, 0.4], [-8, 0.08, -0.22, 0.4], [16, 0.09, 0.22, 0.4], [40, 0.06, 0.7, 0.38]];
const FROG_TOES = [[-30, 0.12, -0.8, 0.35], [-15, 0.17, -0.4, 0.35], [0, 0.23, 0, 0.35], [12, 0.3, 0.4, 0.33], [32, 0.2, 0.8, 0.33]];
const frogHead = (o) => ({
  len: 0.36, pitch: 0,
  skull: [[0, 0.5, 0.2, 0.06, 0], [0.3, 0.52, 0.24, 0.06, 0.02], [0.55, 0.46, 0.22, 0.05, 0.01], [0.75, 0.36, 0.17, 0.05, -0.01], [0.9, 0.24, 0.12, 0.045, -0.02], [1, 0.12, 0.07, 0.04, -0.025]],
  jaw: { hinge: 0.04, tip: 0.97, p: [[0, 0.48, 0.22], [0.3, 0.5, 0.2], [0.55, 0.45, 0.16], [0.75, 0.36, 0.12], [0.9, 0.25, 0.08], [1, 0.12, 0.05]] },
  eye: { r: 0.12, u: 0.62, rise: 0.2, yaw: 65, up: 0.7, inset: 0.2, bulge: 0.55, pupil: 'bar', pupilR: 0.4, lidH: 0.7 },
  tongue: { root: 0.78, tip: 0.42, rise: -0.16, w: 0.06, club: 0.07, ext: 0.9 },
  ...o,
});
/* American bullfrog (Lithobates catesbeianus): SVL 0.16 m; a broad flat head, the tympanum bigger than the eye (male),
   a fold of skin curving round it; long, fully webbed hind feet */
const T_BULLFROG = {
  axis: [[0.0, 0.27], [0.15, 0.29], [0.33, 0.3], [0.5, 0.28], [0.7, 0.24], [0.88, 0.17], [1.0, 0.12]],
  body: [[0.2, 0.17, 0.1, 0.1], [0.33, 0.2, 0.11, 0.12], [0.5, 0.22, 0.12, 0.13], [0.7, 0.2, 0.13, 0.12], [0.85, 0.15, 0.1, 0.09], [0.95, 0.1, 0.07, 0.06], [1.0, 0.06, 0.04, 0.04]],
  // (eyes on the top-sides of the flat head, an eye's width apart: 1.2 cm across on a 16 cm frog)
  head: frogHead({ eye: { r: 0.1, u: 0.6, at: [0.56, 0.72], elev: 38, yaw: 80, pupil: 'bar', pupilR: 0.4, lidH: 0.75 } }),
  fore: { J0: [0.14, 0.22, -0.4], J2: [0.2, 0.03, -0.22], upper: 0.19, lower: 0.18, pole: [1, 0.2, -1], yaw: -15, R: [0.05, 0.04, 0.03, 0.03, 0.022], palm: { w: 0.03, h: 0.014, l: 0.04 }, digits: FROG_HAND },
  hind: { hip: [0.08, 0.13, 0], knee: [0.3, 0.14, 0.32], heel: [0.2, 0.05, -0.06], tm: [0.3, 0.025, 0.18], yaw: 15, R: [0.09, 0.085, 0.045, 0.05, 0.03, 0.028, 0.022], palm: { w: 0.04, h: 0.015, l: 0.12 }, digits: FROG_TOES, web: 0.85 },
};
/* cane toad (Rhinella marina): SVL 0.15 m; squat and broad, warty, huge parotoid glands behind the eyes, short legs */
const T_CANETOAD = {
  axis: [[0.0, 0.24], [0.15, 0.26], [0.33, 0.28], [0.5, 0.28], [0.7, 0.25], [0.88, 0.17], [1.0, 0.11]],
  body: [[0.2, 0.18, 0.1, 0.1], [0.35, 0.23, 0.12, 0.13], [0.55, 0.26, 0.13, 0.14], [0.72, 0.24, 0.12, 0.13], [0.88, 0.17, 0.1, 0.09], [0.97, 0.1, 0.06, 0.06], [1.0, 0.06, 0.04, 0.04]],
  head: frogHead({ len: 0.33,
    skull: [[0, 0.55, 0.22, 0.06, 0], [0.3, 0.55, 0.25, 0.06, 0.02], [0.55, 0.48, 0.23, 0.055, 0.01], [0.75, 0.38, 0.18, 0.05, -0.01], [0.9, 0.25, 0.13, 0.045, -0.02], [1, 0.12, 0.08, 0.04, -0.025]],
    eye: { r: 0.095, u: 0.6, at: [0.56, 0.8], elev: 40, yaw: 80, pupil: 'bar', pupilR: 0.4, lidH: 0.75 } }),
  parotoid: { u: 0.06, rise: 0.14, x: 0.36, w: 0.17, h: 0.13, l: 0.3 },
  warts: { f: 15, r: 0.3, h: 0.07, below: -0.25 }, bodySeg: 56, bodyRad: 18,
  fore: { J0: [0.15, 0.21, -0.38], J2: [0.21, 0.03, -0.2], upper: 0.18, lower: 0.17, pole: [1, 0.2, -1], yaw: -20, R: [0.055, 0.045, 0.034, 0.034, 0.025], palm: { w: 0.034, h: 0.016, l: 0.04 }, digits: scaleD(FROG_HAND, 0.8) },
  hind: { hip: [0.09, 0.12, 0], knee: [0.28, 0.12, 0.25], heel: [0.18, 0.05, -0.05], tm: [0.27, 0.025, 0.14], yaw: 20, R: [0.085, 0.08, 0.045, 0.048, 0.032, 0.03, 0.024], palm: { w: 0.04, h: 0.016, l: 0.08 }, digits: scaleD(FROG_TOES, 0.6), web: 0.3 },
};
/* poison dart frog (Dendrobates tinctorius 'azureus'): SVL 0.045 m; a hunched body on long thin legs, broad toe discs,
   no webbing, black eyes */
const T_DARTFROG = {
  axis: [[0.0, 0.3], [0.15, 0.32], [0.33, 0.33], [0.5, 0.32], [0.7, 0.28], [0.88, 0.21], [1.0, 0.15]],
  body: [[0.2, 0.15, 0.09, 0.09], [0.33, 0.17, 0.1, 0.1], [0.5, 0.18, 0.12, 0.11], [0.7, 0.17, 0.13, 0.1], [0.85, 0.13, 0.1, 0.08], [0.95, 0.09, 0.07, 0.05], [1.0, 0.05, 0.04, 0.03]],
  head: frogHead({ len: 0.34,
    skull: [[0, 0.44, 0.22, 0.07, 0], [0.3, 0.46, 0.25, 0.07, 0.02], [0.55, 0.4, 0.23, 0.06, 0.01], [0.75, 0.31, 0.18, 0.055, -0.01], [0.9, 0.2, 0.13, 0.05, -0.02], [1, 0.1, 0.08, 0.04, -0.025]],
    eye: { r: 0.12, u: 0.6, at: [0.66, 0.6], elev: 25, yaw: 78, pupil: 'round', pupilR: 0.7, lidH: 0.8 } }),
  fore: { J0: [0.13, 0.24, -0.4], J2: [0.22, 0.03, -0.2], upper: 0.21, lower: 0.21, pole: [1, 0.2, -1], yaw: -10, R: [0.04, 0.032, 0.024, 0.022, 0.016], palm: { w: 0.024, h: 0.012, l: 0.03 }, digits: scaleD(FROG_HAND, 1.15), pad: 1.9 },
  hind: { hip: [0.08, 0.15, 0], knee: [0.3, 0.16, 0.3], heel: [0.2, 0.06, -0.08], tm: [0.3, 0.025, 0.16], yaw: 15, R: [0.07, 0.065, 0.035, 0.038, 0.024, 0.022, 0.018], palm: { w: 0.03, h: 0.012, l: 0.1 }, digits: scaleD(FROG_TOES, 0.85), pad: 1.8 },
};
/* red-eyed tree frog (Agalychnis callidryas): SVL 0.06 m; slender, huge red eyes with slit pupils, long limbs folded
   tight, orange toe pads, blue flanks barred with cream */
const T_TREEFROG = {
  axis: [[0.0, 0.26], [0.15, 0.28], [0.33, 0.29], [0.5, 0.28], [0.7, 0.25], [0.88, 0.18], [1.0, 0.13]],
  body: [[0.2, 0.15, 0.09, 0.09], [0.33, 0.16, 0.1, 0.1], [0.5, 0.16, 0.11, 0.1], [0.7, 0.14, 0.12, 0.09], [0.85, 0.11, 0.09, 0.07], [0.95, 0.08, 0.06, 0.05], [1.0, 0.05, 0.04, 0.03]],
  head: frogHead({ len: 0.34,
    skull: [[0, 0.46, 0.2, 0.06, 0], [0.3, 0.5, 0.24, 0.06, 0.02], [0.55, 0.44, 0.22, 0.05, 0.01], [0.75, 0.33, 0.17, 0.05, -0.01], [0.9, 0.21, 0.12, 0.045, -0.02], [1, 0.1, 0.07, 0.04, -0.025]],
    eye: { r: 0.15, u: 0.58, at: [0.6, 0.66], elev: 30, yaw: 78, pupil: 'slit', pupilR: 0.4, lidH: 0.75 } }),
  fore: { J0: [0.12, 0.21, -0.4], J2: [0.18, 0.03, -0.22], upper: 0.21, lower: 0.21, pole: [1, 0.25, -1], yaw: -15, R: [0.035, 0.028, 0.02, 0.019, 0.014], palm: { w: 0.022, h: 0.011, l: 0.03 }, digits: scaleD(FROG_HAND, 1.2), pad: 2.0, web: 0.3 },
  hind: { hip: [0.07, 0.13, 0], knee: [0.26, 0.15, 0.32], heel: [0.16, 0.05, -0.06], tm: [0.24, 0.022, 0.18], yaw: 12, R: [0.06, 0.055, 0.03, 0.032, 0.02, 0.019, 0.016], palm: { w: 0.026, h: 0.011, l: 0.1 }, digits: scaleD(FROG_TOES, 0.85), pad: 1.9, web: 0.4 },
};
/* glass frog (Hyalinobatrachium fleischmanni): SVL 0.027 m; lime green dotted yellow, a pale see-through belly, eyes set
   forward, toe discs */
const T_GLASSFROG = {
  ...T_TREEFROG,
  head: frogHead({ len: 0.36,
    skull: [[0, 0.5, 0.18, 0.06, 0], [0.3, 0.54, 0.22, 0.06, 0.02], [0.55, 0.48, 0.2, 0.05, 0.01], [0.75, 0.38, 0.15, 0.05, -0.01], [0.9, 0.25, 0.11, 0.045, -0.02], [1, 0.12, 0.07, 0.04, -0.025]],
    eye: { r: 0.13, u: 0.64, at: [0.54, 0.7], elev: 32, yaw: 55, pupil: 'bar', pupilR: 0.35, lidH: 0.75 } }),
  body: [[0.2, 0.16, 0.08, 0.08], [0.33, 0.18, 0.08, 0.09], [0.5, 0.18, 0.09, 0.09], [0.7, 0.16, 0.1, 0.08], [0.85, 0.12, 0.08, 0.06], [0.95, 0.08, 0.05, 0.04], [1.0, 0.05, 0.035, 0.03]],
};

const SPECIES = {
  'green-iguana': {
    label: 'Green iguana', plan: 'saurian', length: 1.5, T: T_IGUANA,
    scales: { kind: 'keeled', cell: 3.2, headK: 1.4, legK: 0.9, width: 0.12, dark: 0.74, light: 0.1 },
    palette: pal({ body: '#5f9a3a', belly: '#a6c472', pattern: '#344f2a', marking: '#8fb35e', accent: '#7aa84a', accent2: '#d5dcb6', lid: '#47662f', claw: '#2b2a22', eye: '#c99a3a', mouth: '#e8a8a0', tongue: '#d8606a' }),
    face: { ear: { u: 0.07, r: 0.0, R: 0.075, k: 1.2, x: 0.2 }, nostril: { u: 0.92, r: 0.05, x: 0.07, R: 0.03 }, lips: [0.8, 0.99, 0.62, 0.33], lipZone: 'accent2' },
    paint: [
      { type: 'belly', k: 0.42 },
      { type: 'bars', from: 0.38, to: 0.95, period: 0.12, duty: 0.28, flank: 0.6, wobble: 0.3, zone: 'pattern', parts: ['body'] },
      { type: 'rings', from: 1.25, to: 3.65, period: 0.3, duty: 0.42, zone: 'pattern', parts: ['tail'] },
    ],
  },

  'komodo-dragon': {
    label: 'Komodo dragon', plan: 'saurian', length: 2.6, T: T_KOMODO,
    scales: { kind: 'granular', cell: 3.0, headK: 0.9, legK: 0.9, width: 0.14, dark: 0.7, light: 0.12 },
    palette: pal({ body: '#6e6450', belly: '#8a7f66', pattern: '#4c4436', marking: '#8f846a', lid: '#5a5242', claw: '#2a261c', eye: '#c48a2c', mouth: '#d89a8a', tongue: '#e6b93a' }),
    face: { ear: { u: 0.05, r: 0.0, R: 0.05, x: 0.18 }, nostril: { u: 0.9, r: 0.04, x: 0.06, R: 0.025 }, lips: [0.8, 0.99, 0.62, 0.18], lipZone: 'marking' },
    paint: [{ type: 'belly', k: 0.5 }, { type: 'mottle', f: 6, k: 0.6, zone: 'pattern' }, { type: 'spots', f: 22, r: 0.16, zone: 'marking', top: -0.3 }],
    gait: { walk: { rise: 0.035, narrow: 0.35 }, trot: { rise: 0.05, narrow: 0.42 } },
  },
  'frilled-lizard': {
    label: 'Frilled lizard', plan: 'saurian', length: 0.85, T: T_FRILLED,
    scales: { kind: 'keeled', cell: 2.8, headK: 0.9, legK: 0.85, width: 0.12, dark: 0.74, light: 0.1 },
    palette: pal({ body: '#8a7558', belly: '#b8a284', pattern: '#5a4a38', marking: '#a08868', accent: '#e0702c', accent2: '#f2c24a', lid: '#6e5c44', eye: '#b07a3a', mouth: '#f2d06a', tongue: '#e89a6a', web: '#6e2a14' }),
    face: { ear: { u: 0.05, r: 0.0, R: 0.05, x: 0.18 }, nostril: { u: 0.92, r: 0.04, x: 0.06, R: 0.025 }, lips: [0.8, 0.99, 0.62, 0.2], lipZone: 'marking' },
    paint: [{ type: 'belly', k: 0.45 }, { type: 'mottle', f: 7, k: 0.58, zone: 'pattern' }, { type: 'rings', from: 1.2, to: 3.3, period: 0.24, duty: 0.35, zone: 'pattern', parts: ['tail'] }],
    // the frill: mottled like the body outside, orange to a yellow centre inside, a dark rim
    frillPaint: (c) => (c.face === 0 || c.u > 0.9 ? 'web' : c.face * c.sd < 0 ? (c.u < 0.4 ? 'accent2' : 'accent') : (vnoise(c.u * 9, c.v * 11, 0, 5) > 0.6 ? 'pattern' : 'body')),
    gait: { trot: { biped: true, duty: 0.34, fr: 1.4, lambda: 1.6, rise: 0.08, pitch: 34, lift: 0.08 } },
    gape: 50,
  },
  'leopard-gecko': {
    label: 'Leopard gecko', plan: 'saurian', length: 0.22, T: T_GECKO,
    scales: { kind: 'granular', cell: 2.4, headK: 0.85, legK: 0.8, width: 0.16, dark: 0.8, light: 0.16 },
    palette: pal({ body: '#e8c34a', belly: '#f3ecdc', pattern: '#2e2620', marking: '#f2ead0', accent: '#b8a2b8', lid: '#d8b048', claw: '#8a7a60', eye: '#4a4846', mouth: '#f0b8b0', tongue: '#e87a8a' }),
    face: { ear: { u: 0.04, r: 0.0, R: 0.055, x: 0.2 }, nostril: { u: 0.96, r: 0.04, x: 0.06, R: 0.025 }, lips: [0.8, 0.99, 0.62, 0.2], lipZone: 'marking' },
    paint: [{ type: 'belly', k: 0.35 }, { type: 'spots', f: 46, r: 0.33, zone: 'pattern', top: -0.35 }],
  },
  tuatara: {
    label: 'Tuatara', plan: 'saurian', length: 0.6, T: T_TUATARA,
    scales: { kind: 'granular', cell: 2.8, headK: 0.9, legK: 0.85, width: 0.14, dark: 0.72, light: 0.1 },
    palette: pal({ body: '#6b6a4a', belly: '#9a9472', pattern: '#4a4a32', marking: '#e6e0c4', lid: '#56553c', claw: '#2a2820', eye: '#2a2620', mouth: '#d8a8a0', web: '#5a5a40' }),
    face: { ear: null, nostril: { u: 0.95, r: 0.05, x: 0.06, R: 0.025 }, lips: [0.8, 0.99, 0.62, 0.2], lipZone: 'pattern' },
    paint: [{ type: 'belly', k: 0.45 }, { type: 'mottle', f: 5, k: 0.6, zone: 'pattern' }, { type: 'spots', f: 20, r: 0.14, zone: 'marking', top: -0.3 }],
  },
  'panther-chameleon': {
    label: 'Panther chameleon', plan: 'saurian', length: 0.45, T: T_CHAMELEON,
    scales: { kind: 'granular', cell: 2.6, headK: 1.0, legK: 0.9, width: 0.16, dark: 0.78, light: 0.14 },
    // (the common turquoise-green form, as from Nosy Be and Ambanja: paler bars, a white flank stripe, orange about the face)
    palette: pal({ body: '#2f9e7e', belly: '#cfe3a0', pattern: '#7fd0a8', marking: '#f1ecd2', accent: '#e07a3a', lid: '#2a8a6e', claw: '#5a6a4a', eye: '#d8a050', mouth: '#f0b8b0', tongue: '#e88aa0' }),
    face: { lips: [0.8, 0.99, 0.62, 0.2], lipZone: 'marking', fn: ({ u, r }) => (u > 0.55 && r < -0.02 ? 'accent' : null) },
    paint: [{ type: 'belly', k: 0.65 }, { type: 'bars', from: 0.36, to: 0.95, period: 0.13, duty: 0.32, flank: 0.9, wobble: 0.25, zone: 'pattern', parts: ['body'] }, { type: 'stripe', a0: 118, w: 16, from: 0.25, to: 0.95, zone: 'marking', parts: ['body', 'neck', 'head', 'jaw'] }, { type: 'rings', from: 1.05, to: 2.0, period: 0.12, duty: 0.3, zone: 'pattern', parts: ['tail'] }],
    tongueShot: 1.2, gape: 30,
    gait: { walk: { pat: 'walktrot', duty: 0.8, fr: 0.02, bend: 3, rise: 0, lift: 0.06, tail: 0, narrow: 0.1 }, trot: null },
  },
  'nile-crocodile': {
    label: 'Nile crocodile', plan: 'saurian', length: 4.5, T: T_CROC, swims: true,
    scales: { kind: 'plates', cell: 7, headK: 0.6, legK: 0.55, width: 0.1, dark: 0.72, light: 0.06 },
    palette: pal({ body: '#565c34', belly: '#d2c896', pattern: '#3a3e24', marking: '#8a8a4a', lid: '#4a4e2c', claw: '#2a2a1c', eye: '#b8b040', mouth: '#e8d4a0', teeth: '#efe6c8', web: '#6a6c40' }),
    face: { nostril: { u: 0.965, r: 0.055, x: 0.035, R: 0.03 } },
    paint: [{ type: 'belly', k: 0.35 }, { type: 'stripe', a0: 82, w: 34, zone: 'marking', parts: ['body', 'neck', 'tail'] }, { type: 'spots', f: 9, r: 0.2, zone: 'pattern', top: -0.3, bottom: 0.4 }, { type: 'rings', from: 1.0, to: 1.95, period: 0.13, duty: 0.42, top: -0.2, zone: 'pattern', parts: ['tail'] }],
    gait: { walk: { pat: 'lateral', duty: 0.75, fr: 0.06, lambda: 0.5, rise: 0.075, narrow: 0.5, bend: 6, lift: 0.04, tail: 6 }, trot: null },
    gape: 32,
  },
  'american-alligator': {
    label: 'American alligator', plan: 'saurian', length: 3.8, T: T_GATOR, swims: true,
    scales: { kind: 'plates', cell: 7, headK: 0.6, legK: 0.55, width: 0.1, dark: 0.7, light: 0.06 },
    palette: pal({ body: '#2f3326', belly: '#d8d0b0', pattern: '#1e211a', marking: '#4a4e38', lid: '#26291e', claw: '#1a1a14', eye: '#9a9a40', mouth: '#e8d8b0', teeth: '#efe6c8', web: '#3a3e2c' }),
    face: { nostril: { u: 0.965, r: 0.055, x: 0.04, R: 0.032 } },
    paint: [{ type: 'belly', k: 0.35 }, { type: 'rings', from: 1.0, to: 1.95, period: 0.13, duty: 0.3, top: -0.2, zone: 'marking', parts: ['tail'] }],
    gait: { walk: { pat: 'lateral', duty: 0.75, fr: 0.06, lambda: 0.5, rise: 0.075, narrow: 0.5, bend: 6, lift: 0.04, tail: 6 }, trot: null },
    gape: 32,
  },
  'sand-lizard': {
    label: 'Sand lizard', plan: 'saurian', length: 0.2, T: T_SANDLIZ,
    scales: { kind: 'keeled', cell: 2.4, headK: 1.3, legK: 0.85, width: 0.13, dark: 0.75, light: 0.1 },
    palette: pal({ body: '#8a6a44', belly: '#dfe0a8', pattern: '#2e2418', marking: '#efe8d6', accent: '#7fae3a', lid: '#6e5434', claw: '#3a3022', eye: '#6a4a2a' }),
    face: { ear: { u: 0.05, r: 0.0, R: 0.05, x: 0.18 }, nostril: { u: 0.93, r: 0.04, x: 0.06, R: 0.025 }, lips: [0.8, 0.99, 0.62, 0.2], lipZone: 'marking' },
    paint: [{ type: 'belly', k: 0.45 }, { type: 'stripe', a0: 72, w: 62, zone: 'accent', to: 1.05 }, { type: 'ocelli', f: 13, r: 0.3, ring: 0.38, inner: 'marking', zone: 'pattern', top: -0.3, to: 1.4 }],
  },
  'green-anole': {
    label: 'Green anole', plan: 'saurian', length: 0.18, T: T_ANOLE,
    scales: { kind: 'granular', cell: 2.2, headK: 1.2, legK: 0.85, width: 0.12, dark: 0.82, light: 0.08 },
    palette: pal({ body: '#5fae3a', belly: '#e8eedd', pattern: '#3a7a2a', marking: '#c8d8a8', accent: '#e86a8a', lid: '#4f9a30', claw: '#3a3a2a', eye: '#5a4a2a', skin: '#8ab860' }),
    face: { ear: { u: 0.04, r: 0.0, R: 0.045, x: 0.18 }, nostril: { u: 0.95, r: 0.03, x: 0.05, R: 0.022 }, lips: [0.8, 0.99, 0.62, 0.2], lipZone: 'marking' },
    paint: [{ type: 'belly', k: 0.55 }],
  },
  'fire-salamander': {
    label: 'Fire salamander', plan: 'saurian', length: 0.2, T: T_FIRESAL, gloss: 0.45,
    palette: pal({ body: '#141416', belly: '#2a2a2e', pattern: '#0c0c0e', marking: '#f2c41c', lid: '#1a1a1c', eye: '#1a1410', mouth: '#e0a0a0', tongue: '#d88a8a' }),
    face: { lips: [0.8, 0.99, 0.62, 0.2], lipZone: 'pattern' },
    paint: [{ type: 'belly', k: 0.6 }, { type: 'spots', f: 6.5, r: 0.4, zone: 'marking', top: -0.25 }, { type: 'fn', fn: (c) => (c.part === 'gland' ? 'marking' : null) }],
    gait: { walk: { duty: 0.76, fr: 0.05, bend: 15, tail: 12, rise: 0.008 }, trot: null },
  },
  'chinese-giant-salamander': {
    label: 'Chinese giant salamander', plan: 'saurian', length: 1.4, T: T_GIANTSAL, swims: true, gloss: 0.6,
    palette: pal({ body: '#5a4a36', belly: '#8a7a62', pattern: '#3a2e22', marking: '#6e5c44', lid: '#4a3c2c', eye: '#2a2a1a', mouth: '#d8b0a0', web: '#5a4a36' }),
    face: { lips: [0.8, 0.99, 0.62, 0.15], lipZone: 'marking' },
    paint: [{ type: 'belly', k: 0.5 }, { type: 'mottle', f: 5, k: 0.56, zone: 'pattern' }, { type: 'spots', f: 12, r: 0.12, zone: 'pattern', top: -0.3 }],
    gait: { walk: { duty: 0.78, fr: 0.03, bend: 13, tail: 12, rise: 0.006 }, trot: null },
  },
  axolotl: {
    label: 'Axolotl', plan: 'saurian', length: 0.25, T: T_AXOLOTL, swims: true, gloss: 0.5,
    palette: pal({ body: '#f2c8c8', belly: '#f8dede', pattern: '#d89a9a', marking: '#f0b8b8', accent: '#e0507a', accent2: '#f6d6d6', lid: '#e8b0b0', eye: '#2a1a1a', mouth: '#e8a0a0' }),
    face: { lips: [0.82, 0.99, 0.62, 0.05], lipZone: 'marking' },
    paint: [{ type: 'belly', k: 0.6 }, { type: 'spots', f: 18, r: 0.12, zone: 'pattern', top: -0.2 }],
    gait: { walk: { duty: 0.75, fr: 0.04, bend: 12, tail: 10, rise: 0.006 }, trot: null },
  },
  'alpine-newt': {
    label: 'Alpine newt', plan: 'saurian', length: 0.1, T: T_NEWT, swims: true, gloss: 0.55,
    palette: pal({ body: '#4a5260', belly: '#f08a1a', pattern: '#1a1c22', marking: '#e8e2c8', accent: '#6a86b8', lid: '#3a4250', eye: '#c8a040', mouth: '#e0a0a0', tongue: '#d88a8a' }),
    face: { lips: [0.8, 0.99, 0.62, 0.2], lipZone: 'marking' },
    paint: [{ type: 'belly', k: 0.55 }, { type: 'mottle', f: 8, k: 0.58, zone: 'pattern' }, { type: 'stripe', a0: 104, w: 26, zone: 'marking', from: 0.25, to: 1.4 }, { type: 'spots', f: 16, r: 0.24, zone: 'pattern', top: -0.5, bottom: 0.15 }],
    gait: { walk: { duty: 0.75, fr: 0.05, bend: 14, tail: 12, rise: 0.006 }, trot: null },
  },

  'reticulated-python': {
    label: 'Reticulated python', plan: 'ophidian', length: 6.0, T: T_PYTHON,
    scales: { kind: 'granular', cell: 3.2, headK: 1.3, width: 0.12, dark: 0.8, light: 0.1 },
    palette: pal({ body: '#a8884a', belly: '#ebe2c4', pattern: '#1c1812', marking: '#6e6a5a', accent: '#c8a868', accent2: '#e6dcc0', lid: '#8a7040', eye: '#d07a2a', mouth: '#e8c0b0', tongue: '#2a2420' }),
    face: { fn: ({ u, r, x }) => (r < -0.05 && x > 0.18 && u > 0.35 && Math.sin(u * 60) > 0.6 ? 'pattern' : r > 0.1 && x < 0.04 ? 'pattern' : x > 0.2 && Math.abs(r - 0.02 - (0.6 - u) * 0.25) < 0.025 && u < 0.6 ? 'pattern' : 'accent') },
    paint: [{ type: 'belly', k: 0.5 }, { type: 'saddles', from: 0.05, to: 0.98, period: 0.032, l: 0.42, w: 70, zone: 'marking', edge: 'pattern', core: 0.7, diamond: true }, { type: 'net', f: 70, w: 0.07, zone: 'pattern', top: -0.2, parts: ['body', 'tail'] }, { type: 'spots', f: 90, r: 0.22, zone: 'accent2', top: -0.5, bottom: 0.25, parts: ['body', 'tail'] }],
    gape: 55,
  },
  'king-cobra': {
    label: 'King cobra', plan: 'ophidian', length: 4.0, T: T_COBRA,
    scales: { kind: 'keeled', cell: 3.6, headK: 2.2, width: 0.1, dark: 0.8, light: 0.1 },
    palette: pal({ body: '#4a4a32', belly: '#e2d6a0', pattern: '#24241a', marking: '#8e865a', accent: '#e8dcae', lid: '#34341f', eye: '#5a4a2a', mouth: '#e0b0a8', tongue: '#151515' }),
    paint: [{ type: 'belly', k: 0.45 }, { type: 'bands', from: 0.2, to: 0.98, period: 0.05, duty: 0.12, top: -0.4, wobble: 0.15, zone: 'marking' }, { type: 'fn', fn: (c, s, up) => (s < 0.13 && up < 0.1 ? 'accent' : null) }],
    gape: 45,
  },
  sidewinder: {
    label: 'Sidewinder', plan: 'ophidian', length: 0.7, T: T_SIDEWINDER,
    scales: { kind: 'keeled', cell: 2.6, headK: 0.9, width: 0.13, dark: 0.78, light: 0.1 },
    palette: pal({ body: '#d9c49a', belly: '#f0e6cc', pattern: '#7e5c38', marking: '#8a6a44', lid: '#c8b48a', claw: '#c8b48a', eye: '#c8a868', mouth: '#e8c0b0', tongue: '#2a2420' }),
    face: { fn: ({ u, r, x }) => (x > 0.25 && u < 0.62 && Math.abs(r - (u - 0.62) * 0.4) < 0.035 ? 'marking' : null) },
    paint: [{ type: 'belly', k: 0.45 }, { type: 'saddles', from: 0.08, to: 0.98, period: 0.045, l: 0.28, w: 45, zone: 'pattern' }, { type: 'spots', f: 60, r: 0.2, zone: 'marking', top: -0.5, bottom: 0.3, parts: ['body', 'tail'] }],
    gape: 60,
  },
  'common-garter-snake': {
    label: 'Common garter snake', plan: 'ophidian', length: 0.65, T: T_GARTER,
    scales: { kind: 'keeled', cell: 2.6, headK: 1.8, width: 0.12, dark: 0.76, light: 0.1 },
    palette: pal({ body: '#2c3626', belly: '#c8d8a0', pattern: '#141a12', marking: '#e6d860', lid: '#2a3324', eye: '#4a4030', mouth: '#e8b8b0', tongue: '#c02a2a' }),
    paint: [{ type: 'belly', k: 0.6 }, { type: 'spots', f: 70, r: 0.24, zone: 'pattern', top: -0.5 }, { type: 'stripe', a0: 0, w: 18, zone: 'marking', from: 0.05 }, { type: 'stripe', a0: 92, w: 16, zone: 'marking', from: 0.05 }],
    gape: 40,
  },
  caecilian: {
    label: 'Ringed caecilian', plan: 'ophidian', length: 0.35, T: T_CAECILIAN, gloss: 0.5,
    palette: pal({ body: '#3e4550', belly: '#555c68', pattern: '#2a3038', marking: '#dfe3ea', lid: '#3a4048', eye: '#20242a', mouth: '#d8a8a8' }),
    face: { fn: ({ u, r, x }) => (u > 0.8 && u < 0.86 && r > -0.02 && r < 0.06 && x > 0.2 ? 'pattern' : null) },
    paint: [{ type: 'belly', k: 0.55 }, { type: 'rings', from: 0.06, to: 0.99, period: 0.0135, duty: 0.22, zone: 'marking' }],
  },

  'galapagos-tortoise': {
    label: 'Galápagos giant tortoise', plan: 'chelonian', length: 1.3, T: T_TORTOISE,
    scales: { kind: 'plates', cell: 6, headK: 0.6, legK: 0.9, width: 0.12, dark: 0.75, light: 0.08 },
    palette: pal({ shell: '#4a4640', seam: '#26231e', pattern: '#3a3630', marking: '#6a6250', plastron: '#5a5444', body: '#5f5a50', belly: '#6f6a5c', claw: '#2a2822', eye: '#1a1812', mouth: '#d8a8a0', lid: '#4f4a42' }),
    face: { fn: ({ u, r }) => (u > 0.86 && r < 0.02 ? 'claw' : null) },
    paint: [{ type: 'fn', fn: (c, s, up, q) => (c.part === 'skin' && worley(q.x * 30, q.y * 30, q.z * 30, 3)[1] - worley(q.x * 30, q.y * 30, q.z * 30, 3)[0] < 0.07 ? 'belly' : null) }],
    gait: { walk: { pat: 'lateral', duty: 0.85, fr: 0.004, lambda: 0.4, bend: 0, rise: 0, lift: 0.05, tail: 0, narrow: 0, sway: 2.5, head: 0 }, trot: null },
  },
  'green-sea-turtle': {
    label: 'Green sea turtle', plan: 'chelonian', length: 1.1, T: T_SEATURTLE, swims: true,
    scales: { kind: 'plates', cell: 5, headK: 1.4, legK: 1.0, width: 0.16, dark: 0.7, light: 0.12 },
    palette: pal({ shell: '#6e5634', seam: '#3a2e1a', pattern: '#3e301c', marking: '#b8995e', plastron: '#e6dcae', body: '#4e4a32', belly: '#d8d0a8', claw: '#3a3a2a', eye: '#2a2a1a', mouth: '#e0c0a0', lid: '#56603e' }),
    face: { fn: ({ u, r }) => (u > 0.88 && r < 0.0 ? 'claw' : null) },
    // each scute streaked with rays from its centre
    scutePaint: ({ x, z, cx, cz, edge }) => { const a = Math.atan2(z - cz, x - cx), n = fbm(x * 7, z * 7, 0, 4, 3); const v = Math.sin(a * 5 + 7 * n); return v > 0.7 && n > 0.45 ? 'marking' : v < -0.5 && n < 0.55 ? 'pattern' : null; },
    marginPaint: (r, th, a) => (vnoise(th * 9, r * 4, 0, 6) > 0.62 ? 'marking' : 'shell'),
    paint: [{ type: 'fn', fn: (c) => (c.part === 'flipper' && c.face < 0 ? 'belly' : null) }, { type: 'net', f: 26, w: 0.09, zone: 'marking', parts: ['skin', 'flipper', 'head', 'jaw'] }],
    gait: { walk: { flip: 'crawl', stride: 0.18, fr: 0.01 }, trot: null },
  },
  'eastern-box-turtle': {
    label: 'Eastern box turtle', plan: 'chelonian', length: 0.15, T: T_BOXTURTLE,
    scales: { kind: 'granular', cell: 3, headK: 1, legK: 1, width: 0.14, dark: 0.75, light: 0.08 },
    palette: pal({ shell: '#3e3424', seam: '#1e1810', pattern: '#2a2218', marking: '#d8a030', plastron: '#4a3a22', body: '#4a3a2a', belly: '#6a5232', accent: '#e07a2a', claw: '#2a2418', eye: '#c83a2a', mouth: '#d8a8a0', lid: '#3e3226' }),
    face: { fn: ({ u, r }) => (u > 0.88 && r < 0.02 ? 'claw' : null) },
    // radiating yellow-orange flecks on each scute
    scutePaint: ({ x, z, cx, cz, dc }) => { const a = Math.atan2(z - cz, x - cx), n = fbm(x * 9, z * 9, 0, 9, 3), v = Math.sin(a * 6 + 6 * n); return v > 0.55 && dc > 0.05 && n > 0.42 ? 'marking' : null; },
    marginPaint: (r, th, a) => (a > 0.35 && a < 0.55 && vnoise(th * 7, 0, 0, 3) > 0.45 ? 'marking' : 'shell'),
    paint: [{ type: 'spots', f: 40, r: 0.3, zone: 'accent', parts: ['skin', 'head', 'jaw', 'leg'] }],
    gait: { walk: { pat: 'lateral', duty: 0.8, fr: 0.01, lambda: 0.4, bend: 0, rise: 0, lift: 0.06, tail: 0, narrow: 0, sway: 3, head: 0 }, trot: null },
  },

  'american-bullfrog': {
    label: 'American bullfrog', plan: 'anuran', length: 0.16, T: T_BULLFROG, gloss: 0.55, frog: 'frog',
    palette: pal({ body: '#6b6a3a', belly: '#eee6c4', pattern: '#4a4a28', marking: '#7f9a44', accent: '#e6d070', lid: '#7a6a3c', web: '#55562e', eye: '#c8a040', mouth: '#e8b8a8', tongue: '#e8a0a0', skin: '#6b6a3a' }),
    face: { ear: { u: 0.22, r: 0.06, R: 0.11, x: 0.3, zone: 'lid' }, nostril: { u: 0.93, r: 0.1, x: 0.1, R: 0.03 }, fn: ({ u, r }) => (u > 0.45 && r < -0.02 ? 'marking' : null) },
    paint: [{ type: 'belly', k: 0.35 }, { type: 'fn', fn: (c, s, up) => (c.part === 'jaw' && up < -0.3 ? 'accent' : c.part === 'head' && up > 0.2 ? 'marking' : null) }, { type: 'mottle', f: 16, k: 0.64, zone: 'pattern', top: -0.2, parts: ['body', 'leg'] }],
  },
  'cane-toad': {
    label: 'Cane toad', plan: 'anuran', length: 0.15, T: T_CANETOAD, gloss: 0.8, frog: 'toad',
    scales: { kind: 'granular', cell: 4.5, headK: 0.8, legK: 0.8, width: 0.16, dark: 0.82, light: 0.16 },
    palette: pal({ body: '#7a6440', belly: '#e6dcbc', pattern: '#5a4428', marking: '#a8442a', accent: '#8a7048', lid: '#5a4630', web: '#6a5436', eye: '#c8a040', mouth: '#e0b0a0', tongue: '#e0a0a0' }),
    face: { nostril: { u: 0.93, r: 0.1, x: 0.1, R: 0.03 } },
    paint: [{ type: 'belly', k: 0.4 }, { type: 'mottle', f: 6, k: 0.58, zone: 'pattern', top: -0.3 }, { type: 'spots', f: 26, r: 0.14, zone: 'marking', top: -0.1 }, { type: 'fn', fn: (c) => (c.part === 'gland' ? 'accent' : null) }],
  },
  'common-toad': {
    label: 'Common toad', plan: 'anuran', length: 0.1, T: T_CANETOAD, gloss: 0.8, frog: 'toad',
    scales: { kind: 'granular', cell: 4, headK: 0.8, legK: 0.8, width: 0.16, dark: 0.82, light: 0.14 },
    palette: pal({ body: '#86694a', belly: '#d8ccb1', pattern: '#5a4630', marking: '#9a7a55', accent: '#7a5e40', lid: '#5a4630', web: '#6a5436', eye: '#c8702a', mouth: '#e0b0a0', tongue: '#e0a0a0' }),
    face: { nostril: { u: 0.93, r: 0.1, x: 0.1, R: 0.03 } },
    paint: [{ type: 'belly', k: 0.4 }, { type: 'mottle', f: 6, k: 0.6, zone: 'pattern', top: -0.3 }, { type: 'fn', fn: (c) => (c.part === 'gland' ? 'accent' : null) }],
  },
  'poison-dart-frog': {
    label: 'Poison dart frog', plan: 'anuran', length: 0.045, T: T_DARTFROG, gloss: 0.4, frog: 'frog',
    palette: pal({ body: '#2a6ad8', belly: '#2050b0', pattern: '#0e0e14', marking: '#3a7ae8', accent2: '#1a3a9a', skin: '#1a3a9a', web: '#1a3a9a', lid: '#1a3a9a', eye: '#0a0a0e', pupil: '#020204', mouth: '#c0a0a8', tongue: '#e0a0a0' }),
    paint: [{ type: 'belly', k: 0.5 }, { type: 'fn', fn: (c) => (c.part === 'leg' || c.part === 'foot' ? 'accent2' : null) }, { type: 'spots', f: 7, r: 0.3, zone: 'pattern', top: -0.3, parts: ['body', 'head', 'jaw'] }],
  },
  'red-eyed-tree-frog': {
    label: 'Red-eyed tree frog', plan: 'anuran', length: 0.06, T: T_TREEFROG, gloss: 0.45, frog: 'frog',
    palette: pal({ body: '#4cc23a', belly: '#f6f2e0', pattern: '#2a5ac8', marking: '#f2eab0', accent: '#2a5ac8', skin: '#f0802a', web: '#f0a040', lid: '#3aa830', eye: '#e01e1e', mouth: '#f0c8b8', tongue: '#e8a0a0' }),
    paint: [{ type: 'belly', k: 0.4 }, { type: 'stripe', a0: 108, w: 40, from: 0.38, to: 1.0, zone: 'accent', parts: ['body'] }, { type: 'bars', from: 0.42, to: 0.98, period: 0.11, duty: 0.25, flank: 0.6, zone: 'marking', top: -0.55, bottom: 0.0, parts: ['body'] }, { type: 'fn', fn: (c, s, up) => ((c.part === 'leg' && up < -0.2) ? 'accent' : c.part === 'foot' && up < 0.2 ? 'skin' : null) }],
  },
  'glass-frog': {
    label: 'Glass frog', plan: 'anuran', length: 0.027, T: T_GLASSFROG, gloss: 0.4, frog: 'frog',
    palette: pal({ body: '#84b978', belly: '#d8e6c8', pattern: '#5e9a52', marking: '#e8e070', skin: '#a8d090', web: '#9ac884', lid: '#78ac6c', eye: '#d3ca82', mouth: '#e8c8b8', tongue: '#e8b0b0' }),
    paint: [{ type: 'belly', k: 0.3 }, { type: 'spots', f: 22, r: 0.2, zone: 'marking', top: -0.2 }],
  },
};

/* ════════════════════════════════════════════════════════════════════════════
 *  CLIPS & POSES
 *  Feet are planted: each foot follows a path in the ground's frame (still in stance while the ground carries it back
 *  at the clip's speed, lifted and swung forward in swing) and its limb is solved to reach it (two-bone IK from the
 *  girdle joint, the elbow or knee kept out to the side along the limb's pole, the hand or foot flat and rolling over
 *  its toes as it lifts). Sprawling walkers bend: the pectoral and pelvic girdles turn in antiphase (a standing wave
 *  of the trunk with its nodes at the girdles, which lengthens the stride), the head stays on course and a wave runs
 *  down the tail. Footfalls: lizards and salamanders trot (diagonal pairs, a walking trot at low speed); crocodilians
 *  and tortoises walk in lateral sequence. Clips are timed by the Froude number from the hip height, and gait clips
 *  carry userData { gait, stride, speed, hipH } so playback can match ground speed.
 * ════════════════════════════════════════════════════════════════════════════ */
const FOOTFALL = {
  trot: { LH: 0, RF: 0.03, RH: 0.5, LF: 0.53 },
  walktrot: { LH: 0, RF: 0.08, RH: 0.5, LF: 0.58 },
  lateral: { LH: 0, LF: 0.24, RH: 0.5, RF: 0.74 },
};
const GAIT_DEF = {
  // duty: share of the cycle a foot is down; lambda: distance per cycle (× V); fr: Froude number v²/(g·hipH);
  // bend: girdle yaw (deg); lift: swing height (× V); rise: body lift over the standing height (× V); tail: tail wave (deg)
  // (narrow: how far the feet come in toward the body while moving, a share of their sprawl at rest)
  walk: { pat: 'walktrot', duty: 0.7, lambda: 0.5, fr: 0.12, bend: 13, lift: 0.045, rise: 0.012, tail: 9, head: 0.3, narrow: 0.3 },
  trot: { pat: 'trot', duty: 0.46, lambda: 0.8, fr: 0.9, bend: 17, lift: 0.06, rise: 0.035, tail: 13, head: 0.2, narrow: 0.38 },
};

/** What the clip solver needs to know about the skeleton and the species. */
function motionInfo(S, p, L, rig) {
  const info = {
    V: S.V, plan: S.plan, S, L, bones: rig.list.map(e => e.name), has: Object.fromEntries(rig.list.map(e => [e.name, true])),
    rest: Object.fromEntries(rig.list.map(e => [e.name, (e.parent ? e.head.clone().sub(e.parent.head) : e.head.clone()).toArray()])),
    parent: Object.fromEntries(rig.list.map(e => [e.name, e.parent ? e.parent.name : null])),
    headV: Object.fromEntries(rig.list.map(e => [e.name, e.head.clone()])),
    moving: ['Root', ...(rig.has('TongueTip') ? ['TongueTip'] : [])], scaled: [],
    tail: L.tailNames || [],
  };
  if (S.plan === 'ophidian') { info.limbs = []; info.gaits = {}; snakeInfo(info, S, L); return info; }
  info.limbs = (L.limbs || []).map(lm => {
    if (lm.flipper) return { id: (lm.side > 0 ? 'L' : 'R') + (lm.front ? 'F' : 'H'), front: lm.front, side: lm.side, bones: lm.bones, J: lm.J, flipper: true };
    // (a heel lifts about the tip of the longest digit, which stays planted: the hand and its digits are one bone)
    const fwd = lm.J[3].clone().sub(lm.J[2]).setY(0).normalize();
    const toe = lm.digits.reduce((best, d) => (!best || d.tip.dot(fwd) > best.dot(fwd) ? d.tip.clone() : best), null);
    return { id: (lm.side > 0 ? 'L' : 'R') + (lm.front ? 'F' : 'H'), front: lm.front, side: lm.side, bones: lm.bones, J: lm.J.map(v => v.clone()), la: lm.la, lb: lm.lb, pole: lm.pole.clone(), toe, surf: lm.surf, lat: V3(fwd.z, 0, -fwd.x), digits: lm.digits };
  });
  // how far the belly can come down (basking): the lowest clearance under the trunk
  if (L.path && L.HB) { let c = Infinity; for (let x = S.T.sh; x <= S.T.hip; x += 0.05) c = Math.min(c, L.path(x).y - L.HB(x) * S.V); info.bellyLift = Math.max(0, c - 0.004 * S.V); }
  const hind = info.limbs.filter(l => !l.front);
  info.hipH = hind.length ? hind.reduce((a, l) => a + l.J[0].y, 0) / hind.length : S.V * 0.1;
  info.gaits = {};
  if (rig.has('Throat')) info.moving.push('Throat');
  // frogs hop (a short hop for walking, a long one for running); toads walk, and hop to hurry
  if (S.plan === 'anuran') {
    const hop = (lambda, h) => { const tf = Math.sqrt((8 * h * S.V) / 9.81), dur = tf / 0.35; return { hop: true, lambda, h, stride: lambda * S.V, dur, speed: (lambda * S.V) / dur, pat: 'hop' }; };
    S.gait = S.frog === 'toad'
      ? { walk: { pat: 'lateral', duty: 0.72, fr: 0.03, bend: 0, rise: 0.012, lift: 0.07, tail: 0, narrow: 0.15, head: 0 }, trot: hop(1.4, 0.35) }
      : { walk: hop(0.9, 0.22), trot: hop(2.6, 0.7) };
  }
  for (const [k, g0] of Object.entries(GAIT_DEF)) {
    const sg = S.gait && k in S.gait ? S.gait[k] : {};
    if (sg === null) continue;
    info.gaits[k] = sg && sg.hop ? { ...sg } : { ...g0, ...sg };
  }
  // the longest stride each gait's feet can reach: a foot's stance must stay within its limb's reach from the girdle joint
  for (const G of Object.values(info.gaits)) {
    if (G.flip) { G.speed = Math.sqrt(G.fr * 9.81 * info.hipH); G.stride = G.stride * S.V; G.dur = G.stride / G.speed; G.pat = 'crawl'; continue; }
    if (G.hop) continue;
    let half = Infinity;
    for (const lm of info.limbs) {
      if (lm.flipper) continue;
      const J0 = lm.J[0], J2 = lm.J[2], reach = 0.93 * (lm.la + lm.lb);
      const dy = J0.y + G.rise * S.V - J2.y, dx = (J0.x - J2.x) * (1 - (G.narrow ?? 0.3));
      const dz = Math.sqrt(Math.max(0, reach * reach - dx * dx - dy * dy));
      // (the girdle's turn carries the joint forward or back by about its offset × sin(bend))
      half = Math.min(half, dz + Math.abs(J0.x) * Math.sin(G.bend * DEG) * 0.8);
    }
    const lam = (2 * half) / (G.duty * S.V);
    if (Number.isFinite(lam)) G.lambda = Math.min(G.lambda, lam * 0.94);
    G.speed = Math.sqrt(G.fr * 9.81 * info.hipH);
    G.stride = G.lambda * S.V;
    G.dur = G.stride / G.speed;
  }
  return info;
}

/* ── pose helpers ── */
/** Solves a limb in sample s so its end joint (wrist / ankle) reaches T, the hand or foot taking world rotation qEnd. */
function solveLimb(info, s, lm, T, qEnd) {
  let fk = fkOf(info, s);
  const S0 = fk(lm.bones[0]).p, qPar = fk(info.parent[lm.bones[0]]).q;
  const pole = lm.pole.clone().applyQuaternion(qPar);
  const E = twoBone(S0, T, lm.la, lm.lb, pole);
  const a0u = lm.J[1].clone().sub(lm.J[0]), a0l = lm.J[2].clone().sub(lm.J[1]);
  const n0 = a0u.clone().cross(a0l);
  const a1u = E.clone().sub(S0), a1l = T.clone().sub(E);
  const n1 = a1u.clone().cross(a1l);
  setWorld(info, s, fk, lm.bones[0], frameRot(a0u, n0, a1u, n1));
  fk = fkOf(info, s);
  setWorld(info, s, fk, lm.bones[1], frameRot(a0l, n0, a1l, n1));
  fk = fkOf(info, s);
  setWorld(info, s, fk, lm.bones[2], qEnd || new THREE.Quaternion());
}

/**
 * Where a foot is at phase u of a gait: [position of its end joint, world rotation of the hand / foot]. The foot's
 * path is planted in stance (carried back by the ground) and arcs forward in swing; it rolls over its toes at
 * lift-off. `z0` is the middle of its stance.
 */
function footAt(G, lm, u, td, V, z0) {
  const d = G.lambda * V * G.duty, tau = fract(u - td);
  const J2 = lm.J[2], toe = lm.toe;
  let z, y = 0, roll = 0;
  if (tau < G.duty) {
    const sg = tau / G.duty;
    z = z0 + d * (0.5 - sg);
    // heel-off over the last fifth of the stance: the hand turns about its toes
    roll = sstep(0.78, 1, sg) * (G.roll ?? 20);
  } else {
    // (forward travel done by 92 % of the swing, so the foot comes down onto its place rather than sliding in)
    const sg = (tau - G.duty) / (1 - G.duty), e = smooth01(Math.min(1, sg / 0.92));
    z = z0 - d / 2 + d * e;
    y = G.lift * V * Math.sin(Math.PI * sg) ** 0.8;
    roll = (G.roll ?? 20) * (1 - sstep(0, 0.45, sg)) - 8 * Math.sin(Math.PI * sstep(0.35, 1, sg));
  }
  // the end joint relative to the toe line, turned by the roll about the hand's own lateral axis
  const qr = new THREE.Quaternion().setFromAxisAngle(lm.lat, roll * DEG);
  const toeW = V3(toe.x, toe.y + y, toe.z - J2.z + z);
  const T = J2.clone().sub(toe).applyQuaternion(qr).add(toeW);
  return [T, qr];
}

/** Lays an axial yaw wave along the spine: world yaw of the pelvis and the chest, the neck and head steering back. */
function spineYaw(info, s, psiP, psiC, headK = 0.3) {
  const has = info.has;
  const w1 = lerp(psiP, psiC, 0.3), w2 = lerp(psiP, psiC, 0.66);
  const set = (b, local) => { if (has[b]) addRot(s, b, [0, local, 0]); };
  set('Hips', psiP); set('Spine1', w1 - psiP); set('Spine2', w2 - w1); set('Chest', psiC - w2);
  // the head keeps its heading: the neck takes back most of the chest's turn
  const psiH = psiC * headK;
  set('Neck', (psiH - psiC) * 0.6); set('Head', (psiH - psiC) * 0.4);
  return { psiP, psiC };
}

/** A wave down the tail: amplitude amp (deg) growing toward the tip, k radians of phase per segment. */
function tailWave(info, s, u, amp, k = 0.55, ph = 0) {
  const n = info.tail.length;
  info.tail.forEach((b, i) => addRot(s, b, [0, amp * (0.45 + 0.55 * (i + 1) / n) * Math.sin(TAU * u - k * (i + 1) + ph), 0]));
}

/**
 * Keeps a resting tail on the ground whatever the body does: the tail's base is turned level again (cancelling the
 * pelvis' pitch and roll, keeping its heading), then tipped down (or up) to where it meets the ground (tailDrop).
 */
function tailGround(info, s) {
  if (!info.tail.length || info.S.T.curl || info.plan !== 'saurian') return;
  const fk = fkOf(info, s), q = fk(info.tail[0]).q, e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
  setWorld(info, s, fk, info.tail[0], new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), e.y));
  const lift = fk(info.tail[0]).p.y - info.headV[info.tail[0]].y;
  tailDrop(info, s, lift);
}
function tailDrop(info, s, lift) {
  const L = info.L, T = info.S.T;
  if (!L.path || T.curl || !info.tail.length) return;
  const sT = 1 + (T.tailTouch ?? 0.3) * T.tail, t0 = info.headV[info.tail[0]];
  let k = info.tail.findIndex((b, i) => L.tailS[i] >= sT); if (k < 1) k = 1;
  const at = info.headV[info.tail[k]], a = Math.atan2(lift, Math.max(1e-6, t0.z - at.z)) / DEG;
  addRot(s, info.tail[0], [-a, 0, 0]); addRot(s, info.tail[k], [a, 0, 0]);
}

/** A gait: girdles turned in antiphase with their own legs, feet planted, body raised a little and bobbing. */
function gaitSample(info, G, u) {
  const V = info.V, s = {}, pat = FOOTFALL[G.pat] || FOOTFALL.trot;
  const bob = G.rise * V + 0.15 * G.rise * V * Math.cos(4 * Math.PI * (u - pat.LH));
  setPos(s, 'Root', [0, bob, 0]);
  // girdles: each turned forward on the side of its leg in front (the left hip forward when the left hind foot lands)
  const mid = (td) => td + G.duty / 2;
  const psiP = G.bend * Math.sin(TAU * (u - mid(pat.LH))), psiC = G.bend * Math.sin(TAU * (u - mid(pat.LF)));
  spineYaw(info, s, psiP, psiC, G.head);
  // (a tortoise's shell rolls a little from side to side as its weight shifts)
  if (G.sway) addRot(s, 'Hips', [0, 0, G.sway * Math.sin(TAU * (u - pat.LH))]);
  // tail: its base tipped down by the body's rise and the bone where it meets the ground tipped back, so the rest
  // still lies along the ground; then a wave
  if (info.tail.length) { tailWave(info, s, u - mid(pat.LH), G.tail); tailGround(info, s); }
  for (const lm of info.limbs) {
    const J0 = lm.J[0], z0 = lerp(lm.J[2].z, J0.z, lm.front ? 0.45 : 0.55);
    const [T, q] = footAt(G, lm, u, pat[lm.id], V, z0);
    T.x = lerp(lm.J[2].x, J0.x, G.narrow ?? 0.3);
    solveLimb(info, s, lm, T, q);
  }
  return s;
}

/* ── standing clips: the feet stay where they are ── */
function standLegs(info, s) {
  tailGround(info, s);
  for (const lm of info.limbs) solveLimb(info, s, lm, lm.J[2].clone(), new THREE.Quaternion());
}

function sampleFor(info, name, u) {
  if (info.plan === 'ophidian') return snakeSample(info, name, u);
  if (info.plan === 'chelonian') return cheloSample(info, name, u);
  if (info.plan === 'anuran') return frogSample(info, name, u);
  const V = info.V, s = {}, G = info.gaits[name];
  if (G) return gaitSample(info, G, u);
  const tw = (a, t, b) => { const x = clamp((u - a) / (t - a), 0, 1), y = clamp((b - u) / (b - t), 0, 1); return smooth01(Math.min(x, y)); };
  const flick = (t0, n = 2) => { // tongue flicks: out and back n times from t0
    if (!info.has.TongueTip) return;
    const L = info.L.tongue, x = clamp((u - t0) / 0.18, 0, 1), k = x > 0 && x < 1 ? Math.sin(Math.PI * x) * (0.75 + 0.25 * Math.sin(n * TAU * x)) : 0;
    setPos(s, 'TongueTip', L.dir.clone().multiplyScalar(L.ext * k).toArray());
    addRot(s, 'TongueTip', [8 * Math.sin(6 * TAU * x) * k, 0, 0]);
  };
  switch (name) {
    case 'idle': {
      // breathing, a slow look round, the odd tongue flick
      setPos(s, 'Root', [0, 0.004 * V * Math.sin(TAU * u * 3), 0]);
      addRot(s, 'Neck', [-3 * Math.sin(TAU * u), 10 * Math.sin(TAU * u), 0]);
      addRot(s, 'Head', [2 * Math.sin(TAU * u * 2), 6 * Math.sin(TAU * u + 1), 0]);
      if (info.tail.length) tailWave(info, s, u, 3, 0.4);
      flick(0.55, 2);
      break;
    }
    case 'alert': {
      // up on straightened forelegs, head high, a bob of the head (and the dewlap fanned)
      const k = tw(0, 0.25, 1);
      setPos(s, 'Root', [0, 0.03 * V * k, 0]);
      addRot(s, 'Hips', [-6 * k, 0, 0]);
      addRot(s, 'Chest', [-6 * k, 0, 0]);
      addRot(s, 'Neck', [-14 * k - 10 * k * Math.max(0, Math.sin(TAU * u * 3)), 0, 0]);
      addRot(s, 'Head', [6 * k, 0, 0]);
      if (info.has.Dewlap) addRot(s, 'Dewlap', [-35 * k * (0.5 + 0.5 * Math.sin(TAU * u * 3)), 0, 0]);
      flick(0.35, 3);
      break;
    }
    case 'graze': {
      // head down to the ground, a bite or two (iguanas, tortoises) or tongue flicks (monitors)
      const k = tw(0, 0.3, 1);
      addRot(s, 'Neck', [16 * k, 0, 0]);
      addRot(s, 'Head', [18 * k, 0, 0]);
      if (info.has.Jaw) addRot(s, 'Jaw', [22 * k * Math.max(0, Math.sin(TAU * u * 3)), 0, 0]);
      flick(0.4, 3);
      break;
    }
    case 'peck': {
      // a lunge and snap (a chameleon's tongue shot)
      const k = tw(0.1, 0.4, 0.75);
      addRot(s, 'Chest', [4 * k, 0, 0]);
      addRot(s, 'Neck', [6 * k, 0, 0]);
      if (info.has.Jaw) addRot(s, 'Jaw', [(info.S.tongueShot ? 18 : 30) * tw(0.25, 0.4, 0.55), 0, 0]);
      if (info.S.tongueShot && info.has.TongueTip) setPos(s, 'TongueTip', info.L.tongue.dir.clone().multiplyScalar(info.S.tongueShot * V * tw(0.3, 0.42, 0.62)).toArray());
      break;
    }
    case 'roar': {
      // threat display: head up, mouth agape (the frill or dewlap spread)
      const k = tw(0, 0.2, 1);
      setPos(s, 'Root', [0, 0.02 * V * k, 0]);
      addRot(s, 'Neck', [-16 * k, 0, 0]);
      addRot(s, 'Head', [-6 * k, 0, 0]);
      if (info.has.Jaw) addRot(s, 'Jaw', [(info.S.gape ?? 38) * k, 0, 0]);
      if (info.has.Dewlap) addRot(s, 'Dewlap', [-40 * k, 0, 0]);
      if (info.L.frill) frillOpen(info, s, k);
      if (info.tail.length) tailWave(info, s, u, 8 * k, 0.5);
      break;
    }
    case 'sit': {
      // basking: the belly let down onto the ground, legs relaxed out to the sides, head resting low
      const k = tw(0, 0.35, 1.5);
      const drop = -(info.bellyLift ?? 0.02 * V) * k;
      setPos(s, 'Root', [0, drop, 0]);
      addRot(s, 'Neck', [5 * k, 0, 0]);
      addRot(s, 'Head', [4 * k, 0, 0]);
      tailGround(info, s);
      for (const lm of info.limbs) {
        const T = lm.J[2].clone(); T.x += lm.side * 0.04 * V * k; T.z += (lm.front ? 0.02 : -0.03) * V * k;
        solveLimb(info, s, lm, T, new THREE.Quaternion());
      }
      return s;
    }
    case 'swim': {
      // legs folded back against the body, a wave travelling down the body and tail
      const amp = 9;
      ['Spine1', 'Spine2', 'Chest'].forEach((b, i) => addRot(s, b, [0, amp * 0.5 * Math.sin(TAU * u + 1.2 + i * 0.5), 0]));
      addRot(s, 'Hips', [0, amp * 0.6 * Math.sin(TAU * u + 0.6), 0]);
      addRot(s, 'Neck', [0, -amp * 0.4 * Math.sin(TAU * u + 2.6), 0]);
      if (info.tail.length) tailWave(info, s, u, 22, 0.6, 0);
      for (const lm of info.limbs) {
        const fk = fkOf(info, s), S0 = fk(lm.bones[0]).p;
        const back = V3(lm.side * 0.25, -0.15, -1).normalize();
        const T = S0.clone().addScaledVector(back, (lm.la + lm.lb) * 0.8);
        solveLimb(info, s, lm, T, new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), -50 * DEG));
      }
      return s;
    }
    default: break;
  }
  standLegs(info, s);
  return s;
}

function frillOpen(info, s, k) {
  const F = info.L.frill;
  for (const [sx, sd] of [['L', 1], ['R', -1]]) F[sx].forEach((b, i) => {
    // each sector swings forward about its hinge, out to the side
    // the rods turn from lying back (−z) out to their radial direction r: about (−z) × r, which carries −z onto r
    const t = (i + 0.5) / F[sx].length, ang = F.F.a0 + (Math.PI - F.F.a0) * t;
    const axis = V3(Math.cos(ang), -sd * Math.sin(ang), 0).normalize();
    const q = new THREE.Quaternion().setFromAxisAngle(axis, (F.F.open ?? 105) * DEG * k);
    s[b] = qDeg(q);
  });
}

const CLIP_SPEC = { idle: [6, 61, true], alert: [3, 37, false], graze: [3.2, 41, false], peck: [1.2, 25, false], roar: [2.6, 33, false], sit: [4, 41, false] };
const FROG_CLIPS = { idle: [4, 49, true], alert: [3, 37, false], peck: [0.9, 25, false], roar: [2.4, 41, false], sit: [4, 41, false] };
const SNAKE_CLIPS = { idle: [6, 61, true], alert: [3.5, 41, false], peck: [1.4, 29, false], roar: [3, 41, false] };
function clipsFor(info) {
  const out = [];
  if (info.plan === 'ophidian') {
    const G = info.gaits.walk;
    if (G) {
      const clip = bakeClip(info, 'walk', G.dur, 49, (u) => snakeSample(info, 'walk', u), true);
      clip.userData = { loop: true, gait: G.snake, stride: G.stride, speed: G.speed, hipH: info.hipH };
      out.push(clip);
    }
    for (const [n, [d, f, loop]] of Object.entries(SNAKE_CLIPS)) out.push(bakeClip(info, n, d, f, (u) => snakeSample(info, n, u), loop));
    return out;
  }
  for (const [name, G] of Object.entries(info.gaits)) {
    // (a hop's legs unfold in a few hundredths of a second: it takes many more keys)
    const frames = G.hop ? clamp(Math.round(G.dur * 160), 61, 121) : clamp(Math.round(G.dur * 64), 33, 65);
    const clip = bakeClip(info, name, G.dur, frames, (u) => sampleFor(info, name, u), true, true);
    clip.userData = { loop: true, gait: G.pat, stride: G.stride, speed: G.speed, hipH: info.hipH, fr: G.fr };
    out.push(clip);
  }
  for (const [n, [d, f, loop]] of Object.entries(info.plan === 'anuran' ? FROG_CLIPS : CLIP_SPEC)) out.push(bakeClip(info, n, d, f, (u) => sampleFor(info, n, u), loop));
  // a single long jump, landing where it set off from (as the Actor plays it once)
  if (info.plan === 'anuran') { const G = info.gaits.trot; out.push(bakeClip(info, 'hop', G.dur, 81, (u) => frogSample(info, 'hopOnce', u), false, true)); }
  if (info.S.swims) {
    const stride = (info.plan === 'chelonian' ? 0.9 : 0.55 * (1 + (info.S.T.tail ?? 1))) * info.V, dur = (info.plan === 'chelonian' ? 1.6 : 1.1) * Math.sqrt(info.V);
    const clip = bakeClip(info, 'swim', dur, 41, (u) => sampleFor(info, 'swim', u), true);
    clip.userData = { loop: true, gait: 'swim', stride, speed: stride / dur, hipH: info.hipH };
    out.push(clip);
  }
  return out;
}

/* ════════════════════════════════════════════════════════════════════════════
 *  SNAKE CLIPS — the spine is laid along a curve: each joint where the curve is its bone's length from the last, each
 *  bone turned onto its chord (kept upright). Lateral undulation: every point of the body follows one sine path on the
 *  ground, the path carried back at the clip's speed, so the body slides along its own track without slipping.
 *  Sidewinding: a flattened helix rolling sideways along the ground (its contact points, where the helix is lowest,
 *  stand still while the rest lifts and moves). Displays rear the front of the body up from the coils.
 * ════════════════════════════════════════════════════════════════════════════ */
function snakeInfo(info, S, L) {
  const ch = L.chain, hv = info.headV;
  info.chain = ch;
  info.chord = ch.map((b, i) => (i < ch.length - 1 ? hv[ch[i + 1]].clone().sub(hv[b]) : L.path(1).sub(hv[b])));
  info.sNeck = L.chainS[0] * S.V;
  // the rest curve from the snout back, by arc length
  const pts = L.restPts.map((q, i) => { const s = i / (L.restPts.length - 1); const r = L.path(s); return r; });
  info.curve0 = { pts, ds: S.V / (pts.length - 1) };
  info.hd0 = L.hd.clone(); info.hu0 = L.hu.clone();
  const T = S.T;
  if (T.slither) {
    const sl = T.slither, lam = sl.l * S.V, A = sl.a * S.V;
    // arc length of one wave of x = A sin(2πz/λ)
    let Lam = 0; for (let i = 0; i < 400; i++) { const z = (i + 0.5) / 400 * lam; Lam += Math.hypot(1, A * TAU / lam * Math.cos(TAU * z / lam)) * lam / 400; }
    const speed = Math.sqrt(sl.fr * 9.81 * Math.max(0.02, (S.T.body.reduce((m, k) => Math.max(m, k[1]), 0) * 2 * S.V))) + 0.1 * Math.sqrt(S.V);
    info.gaits.walk = { snake: 'slither', A, lam, Lam, stride: lam, speed, dur: lam / speed };
  } else if (T.sidewind) {
    const sw = T.sidewind, lam = sw.l * S.V, A = sw.a * S.V, B = sw.b * S.V, stride = TAU * A, speed = sw.speed;
    info.gaits.walk = { snake: 'sidewind', A, B, lam, stride, speed, dur: stride / speed };
  }
  if (info.gaits.walk) info.gaits.walk.pat = info.gaits.walk.snake;
  info.hipH = Math.max(0.005, S.T.body.reduce((m, k) => Math.max(m, k[1]), 0) * 2 * S.V);
  if (L.hood) info.moving.push('HoodL', 'HoodR');
}

/** Lays the chain along curve C (an array of points from the snout back, `ds` apart): Root moves the neck joint onto it. */
function layChain(info, s, C, ds, headPitch = 0, headYaw = 0) {
  const ch = info.chain, n = C.length;
  // arc position of the neck joint on the curve
  let k = Math.round(info.sNeck / ds);
  const J = [C[Math.min(k, n - 1)].clone()];
  for (let i = 0; i < ch.length; i++) {
    const d = info.chord[i].length(), a = J[i];
    while (k < n - 1 && C[k].distanceTo(a) < d) k++;
    // interpolate between the samples that straddle distance d
    const p0 = C[Math.max(0, k - 1)], p1 = C[k], d0 = p0.distanceTo(a), d1 = p1.distanceTo(a);
    J.push(d1 > d0 + 1e-9 ? p0.clone().lerp(p1, clamp((d - d0) / (d1 - d0), 0, 1)) : p1.clone());
  }
  setPos(s, 'Root', J[0].clone().sub(info.headV[ch[0]]).toArray());
  let qPrev = new THREE.Quaternion();
  for (let i = 0; i < ch.length; i++) {
    const a0 = info.chord[i], a1 = J[i + 1].clone().sub(J[i]);
    const up = Math.abs(a1.clone().normalize().y) > 0.97 ? V3(0, 0, -1) : V3(0, 1, 0);
    const q = frameRot(a0, a0.clone().cross(V3(0, 1, 0)).cross(a0), a1, a1.clone().cross(up).cross(a1));
    s[ch[i]] = qDeg(qPrev.clone().invert().multiply(q));
    qPrev = q;
    if (i === 0) info._q1 = q.clone();
  }
  // the head: along the curve's front, turned by pitch / yaw (degrees)
  const front = C[0].clone().sub(C[Math.min(n - 1, Math.round(info.sNeck / ds))]).normalize();
  const yawed = front.clone().applyAxisAngle(V3(0, 1, 0), headYaw * DEG);
  const sideV = new THREE.Vector3().crossVectors(V3(0, 1, 0), yawed); if (sideV.lengthSq() < 1e-8) sideV.set(1, 0, 0); sideV.normalize();
  const hd = yawed.clone().applyAxisAngle(sideV, -headPitch * DEG).normalize(), hu = new THREE.Vector3().crossVectors(hd, sideV).normalize();
  const qH = frameRot(info.hd0, info.hu0, hd, hu);
  s.Head = qDeg(info._q1.clone().invert().multiply(qH));
  return J;
}

/** Rest curve with the front reared: from the pivot σr it climbs to `rise` (× V) and levels out for the head. */
function rearCurve(info, sr, rise, lean = 0.12) {
  const V = info.V, ds = info.curve0.ds, R = info.curve0.pts, n = R.length, kr = clamp(Math.round((sr * V) / ds), 2, n - 2);
  const back = R[kr + 1].clone().sub(R[kr - 1]).normalize(), fwd = back.clone().multiplyScalar(-1).setY(0).normalize();
  const out = [];
  // the reared part, integrated from the pivot toward the head: pitch up to near vertical, then over to level
  let p = R[kr].clone(), pitch = 0;
  const pts = [p.clone()], steps = kr, maxP = clamp(Math.asin(clamp(rise / Math.max(1e-6, sr), 0, 1)) * 1.35, 0.3, 1.45);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, target = t < 0.75 ? maxP * sstep(0, 0.25, t) : maxP * (1 - sstep(0.75, 1, t)) - lean * sstep(0.85, 1, t);
    pitch += (target - pitch) * 0.35;
    p = p.clone().addScaledVector(fwd, Math.cos(pitch) * ds).add(V3(0, Math.sin(pitch) * ds, 0));
    pts.push(p);
  }
  for (let i = pts.length - 1; i >= 0; i--) out.push(pts[i]);
  for (let i = kr + 1; i < n; i++) out.push(R[i].clone());
  return out;
}

function snakeSample(info, name, u) {
  const V = info.V, s = {}, S = info.S, ds = info.curve0.ds;
  const flick = (t0) => {
    if (!info.has.TongueTip) return;
    const x = clamp((u - t0) / 0.2, 0, 1), k = x > 0 && x < 1 ? Math.sin(Math.PI * x) * (0.7 + 0.3 * Math.sin(3 * TAU * x)) : 0;
    setPos(s, 'TongueTip', info.L.tongue.dir.clone().multiplyScalar(info.L.tongue.ext * k).toArray());
    addRot(s, 'TongueTip', [10 * Math.sin(5 * TAU * x) * k, 0, 0]);
  };
  const tw = (a, t, b) => { const x = clamp((u - a) / (t - a), 0, 1), y = clamp((b - u) / (b - t), 0, 1); return smooth01(Math.min(x, y)); };
  const G = info.gaits.walk;
  if (name === 'walk' && G && G.snake === 'slither') {
    // the sine track, by arc length; head at mean position of the rest head
    const { A, lam, Lam } = G, N = 1200, len = V + 2.5 * lam;
    if (!G.track) {
      const zs = [], xs = [], arc = [0];
      for (let i = 0; i <= N; i++) { const z = -V - lam + (i / N) * len; zs.push(z); xs.push(A * Math.sin(TAU * z / lam)); if (i) arc.push(arc[i - 1] + Math.hypot(z - zs[i - 1], xs[i] - xs[i - 1])); }
      G.track = { zs, xs, arc };
    }
    const { zs, xs, arc } = G.track;
    const at = (S0) => { let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arc[m] < S0) lo = m; else hi = m; } const f = clamp((S0 - arc[lo]) / ((arc[hi] - arc[lo]) || 1), 0, 1); return [lerp(zs[lo], zs[hi], f), lerp(xs[lo], xs[hi], f)]; };
    const z0 = info.curve0.pts[0].z, sHead = (z0 + V + lam) * (Lam / lam) + Lam * u;
    const C = [];
    for (let i = 0; i < info.curve0.pts.length; i++) {
      const [z, x] = at(sHead - i * ds), r = info.curve0.pts[i];
      C.push(V3(x, r.y, z - lam * u));
    }
    layChain(info, s, C, ds, 0, 0);
    flick(0.5);
    return s;
  }
  if (name === 'walk' && G && G.snake === 'sidewind') {
    const { A, B, lam } = G, C = [], n = info.curve0.pts.length;
    // the axis runs along x, head at +x; θ = 2πσ/λ − 2πu; lifted segments ride up B(1 + sin θ)
    let x = 0.42 * V, prev = null;
    for (let i = 0; i < n * 2 && C.length < n; i++) {
      const sg = i * ds * 0.82, th = TAU * sg / lam - TAU * u, r = info.curve0.pts[Math.min(n - 1, C.length)];
      const q = V3(x - sg, r.y + B * (1 + Math.sin(th)), A * Math.cos(th));
      if (!prev || q.distanceTo(prev) >= ds * 0.999) { C.push(q); prev = q; }
    }
    while (C.length < n) C.push(C[C.length - 1].clone().add(V3(-ds, 0, 0)));
    layChain(info, s, C, ds, 0, 50);
    flick(0.4);
    return s;
  }
  switch (name) {
    case 'idle': {
      const C = info.curve0.pts.map((q, i) => { const r = q.clone(); r.y += 0.0015 * V * Math.sin(TAU * u * 2 - i * 0.05); return r; });
      layChain(info, s, C, ds, 4 * Math.sin(TAU * u), 14 * Math.sin(TAU * u + 0.5));
      flick(0.15); flick(0.62);
      break;
    }
    case 'alert': {
      const k = tw(0, 0.25, 1);
      layChain(info, s, rearCurve(info, 0.1 + 0.08 * k, 0.05 * V * k + 0.001 * V), ds, -6 * k, 12 * Math.sin(TAU * u) * k);
      if (info.L.hood) { setPos(s, 'HoodL', [info.L.hood.spread * 0.5 * k, 0, 0]); setPos(s, 'HoodR', [-info.L.hood.spread * 0.5 * k, 0, 0]); }
      flick(0.3); flick(0.7);
      break;
    }
    case 'roar': {
      // cobra: a third of the body reared, hood spread; others rear into a striking S and gape (rattlers rattle)
      const k = tw(0, 0.22, 1), hoodK = info.L.hood ? 1 : 0;
      const sr = hoodK ? (S.T.raise ?? 0.25) : 0.16, rise = hoodK ? sr * 0.8 : 0.07;
      layChain(info, s, rearCurve(info, lerp(0.06, sr, k), rise * V * k + 0.001 * V, hoodK ? 0.15 : 0.35), ds, (hoodK ? -4 : 8) * k, 0);
      if (info.L.hood) { setPos(s, 'HoodL', [info.L.hood.spread * k, 0, 0]); setPos(s, 'HoodR', [-info.L.hood.spread * k, 0, 0]); }
      if (info.has.Jaw && !hoodK) addRot(s, 'Jaw', [(S.gape ?? 40) * k, 0, 0]);
      if (info.L.rattle) { const t = info.chain.length; [info.chain[t - 1], info.chain[t - 2]].forEach((b, j) => addRot(s, b, [0, (j ? 10 : 18) * k * (Math.round(u * 400) % 2 ? 1 : -1), 0])); }
      break;
    }
    case 'peck': {
      // the strike: drawn back into an S, a lunge with the mouth wide, and back
      const coil = tw(0, 0.3, 0.42), lunge = tw(0.3, 0.42, 0.62);
      const C = rearCurve(info, 0.12, 0.04 * V * (coil + lunge * 0.5) + 0.001 * V, 0.1);
      const shift = V3(0, 0, -0.03 * V * coil + 0.08 * V * lunge);
      const n = C.length;
      C.forEach((q, i) => { const w = 1 - sstep(0.05, 0.2, i / n); q.addScaledVector(shift, w); });
      layChain(info, s, C, ds, 6 * coil - 6 * lunge, 0);
      if (info.has.Jaw) addRot(s, 'Jaw', [(S.gape ?? 40) * lunge, 0, 0]);
      break;
    }
    default: layChain(info, s, info.curve0.pts, ds);
  }
  return s;
}

/* ════════════════════════════════════════════════════════════════════════════
 *  TURTLE CLIPS — tortoises walk in lateral sequence on planted feet, the shell rolling with each step; sea turtles fly
 *  through the water on their front flippers (a downstroke swept back, an upstroke feathered, the hind flippers
 *  steering) and haul themselves over land with both at once. Withdrawing folds the neck in an S under the shell.
 * ════════════════════════════════════════════════════════════════════════════ */
function flipperStroke(info, s, u, k = 1, land = false) {
  for (const lm of info.limbs) {
    if (!lm.flipper) continue;
    const sd = lm.side, ph = TAU * u;
    if (lm.front) {
      // up-and-down about the body's long axis, swept back on the downstroke, the paddle feathered on the way up
      // (on land the flippers sweep flat and lift to come forward: they never press down into the ground)
      const stroke = land ? 9 : 42, sweep = land ? 38 : 26, up = land ? Math.max(0, Math.sin(ph)) : Math.sin(ph);
      s[lm.bones[0]] = [0, sd * (sweep * k * Math.cos(ph) - 8), sd * stroke * k * up];
      s[lm.bones[1]] = [(land ? 0 : 28) * k * Math.cos(ph), sd * 8 * k * Math.sin(ph), 0];
      s[lm.bones[2]] = [land ? 0 : 8 * k * Math.cos(ph + 0.6), 0, sd * (land ? 4 : 10) * k * (land ? up : Math.sin(ph + 0.4))];
    } else {
      s[lm.bones[0]] = [0, sd * (land ? 18 : 8) * k * Math.sin(ph + Math.PI), sd * 6 * k * (land ? Math.max(0, Math.sin(ph)) : Math.sin(ph))];
      s[lm.bones[1]] = [land ? 0 : 10 * k * Math.sin(ph + 1), 0, 0];
    }
  }
}
function cheloSample(info, name, u) {
  const V = info.V, s = {}, G = info.gaits[name];
  if (G && !G.flip) return gaitSample(info, G, u);
  const tw = (a, t, b) => { const x = clamp((u - a) / (t - a), 0, 1), y = clamp((b - u) / (b - t), 0, 1); return smooth01(Math.min(x, y)); };
  const flippers = info.limbs.some(l => l.flipper);
  const legs = () => { for (const lm of info.limbs) if (!lm.flipper) solveLimb(info, s, lm, lm.J[2].clone(), new THREE.Quaternion()); };
  switch (name) {
    case 'walk': {
      // a sea turtle on land: both front flippers dig in and drag the body forward, which then settles
      flipperStroke(info, s, u, 1, true);
      setPos(s, 'Root', [0, 0.01 * V * Math.max(0, Math.sin(TAU * u)), 0.02 * V * Math.sin(TAU * u)]);
      addRot(s, 'Neck1', [-6, 0, 0]);
      return s;
    }
    case 'swim': {
      flipperStroke(info, s, u, 1, false);
      addRot(s, 'Hips', [3 * Math.sin(TAU * u + 1), 0, 0]);
      addRot(s, 'Neck1', [-4 * Math.sin(TAU * u), 0, 0]);
      addRot(s, 'Head', [4 * Math.sin(TAU * u + 0.5), 0, 0]);
      return s;
    }
    case 'idle': {
      addRot(s, 'Neck1', [-4 + 3 * Math.sin(TAU * u), 8 * Math.sin(TAU * u * 0.5), 0]);
      addRot(s, 'Neck2', [2 * Math.sin(TAU * u + 1), 6 * Math.sin(TAU * u * 0.5 + 0.4), 0]);
      addRot(s, 'Head', [3 * Math.sin(TAU * u * 2), 10 * Math.sin(TAU * u + 2), 0]);
      if (flippers) flipperStroke(info, s, u, 0.15, true);
      break;
    }
    case 'alert': {
      const k = tw(0, 0.3, 1);
      addRot(s, 'Neck1', [-22 * k, 0, 0]); addRot(s, 'Neck2', [-8 * k, 0, 0]); addRot(s, 'Head', [12 * k, 14 * Math.sin(TAU * u) * k, 0]);
      setPos(s, 'Root', [0, 0.02 * V * k, 0]);
      break;
    }
    case 'graze': {
      // head down to the ground, a bite or two
      const k = tw(0, 0.3, 1);
      addRot(s, 'Neck1', [26 * k, 0, 0]); addRot(s, 'Neck2', [14 * k, 0, 0]); addRot(s, 'Head', [12 * k, 0, 0]);
      if (info.has.Jaw) addRot(s, 'Jaw', [20 * k * Math.max(0, Math.sin(TAU * u * 3)), 0, 0]);
      break;
    }
    case 'peck': case 'roar': {
      const k = tw(0.1, 0.35, 0.8);
      addRot(s, 'Neck1', [-10 * k, 0, 0]); addRot(s, 'Head', [-8 * k, 0, 0]);
      if (info.has.Jaw) addRot(s, 'Jaw', [(name === 'roar' ? 30 : 22) * tw(0.25, 0.4, 0.6), 0, 0]);
      break;
    }
    case 'sit': {
      // withdraw: the neck folds into an S under the shell's front, the legs drawn in, the shell let down onto the ground
      const k = tw(0, 0.3, 1.5);
      addRot(s, 'Neck1', [70 * k, 0, 0]); addRot(s, 'Neck2', [-120 * k, 0, 0]); addRot(s, 'Neck3', [70 * k, 0, 0]);
      setPos(s, 'Root', [0, -info.L.yP * 0.85 * k, 0]);
      for (const lm of info.limbs) {
        if (lm.flipper) { s[lm.bones[0]] = [0, lm.side * -20 * k, 0]; continue; }
        const J0 = lm.J[0], T = lm.J[2].clone().lerp(V3(J0.x, lm.J[2].y, J0.z), 0.45 * k);
        T.y = lm.J[2].y + info.L.yP * 0.85 * k * 0.0;
        solveLimb(info, s, lm, T, new THREE.Quaternion());
      }
      return s;
    }
    default: break;
  }
  legs();
  return s;
}

/* ════════════════════════════════════════════════════════════════════════════
 *  FROG CLIPS — a hop: sitting on planted feet while the ground carries it back, the hind legs unfolding from their Z
 *  into one straight line behind as the body arcs through the air (nose up, then down), forelegs reaching for the
 *  landing, the legs folding again as it settles where it landed. Toads walk on their legs like lizards (the tarsus
 *  and foot kept flat). The throat pumps; the call swells it; the tongue flips out from the front of the mouth.
 * ════════════════════════════════════════════════════════════════════════════ */
function frogLegs(info, s, e) {
  for (const lm of info.limbs) {
    if (lm.front) continue;
    const sd = lm.side, dExt = V3(sd * 0.22, -0.04, -1).normalize(), J = lm.J;
    const put = (x) => {
      // world rotations of each segment, part way (x) from folded to stretched out behind
      for (let k = 0; k < 4; k++) {
        const a0 = J[k + 1].clone().sub(J[k]), qFull = frameRot(a0, a0.clone().cross(V3(sd, 0, 0)).cross(a0), dExt, dExt.clone().cross(V3(sd, 0, 0)).cross(dExt));
        setWorld(info, s, fkOf(info, s), lm.bones[k], new THREE.Quaternion().slerp(qFull, x));
      }
      // lowest toe tip
      const fk = fkOf(info, s);
      return Math.min(...lm.digits.map(d => posed(info, fk, lm.bones[3], d.tip).y));
    };
    // (no further than keeps the toes off the ground: the legs straighten as the body rises)
    let lo = 0, hi = e;
    if (put(hi) < 0) { for (let it = 0; it < 12; it++) { const m = (lo + hi) / 2; if (put(m) < 0) hi = m; else lo = m; } put(lo); }
  }
}
function frogSample(info, name, u) {
  const V = info.V, s = {}, L = info.L, G = info.gaits[name === 'hopOnce' ? 'trot' : name];
  const throat = (k) => setPos(s, 'Throat', L.hu.clone().multiplyScalar(-0.05 * V * k).addScaledVector(L.hd, 0.012 * V * k).toArray());
  const tw = (a, t, b) => { const x = clamp((u - a) / (t - a), 0, 1), y = clamp((b - u) / (b - t), 0, 1); return smooth01(Math.min(x, y)); };
  if (G && G.hop) {
    const to = 0.4, land = 0.75, lam = G.lambda * V, once = name === 'hopOnce';
    let z = 0, y = 0, e = 0, pitch = 0, arm = 0;
    if (u >= to && u < land) {
      const f = (u - to) / (land - to);
      z = lam * f; y = 4 * G.h * V * f * (1 - f);
      e = sstep(0, 0.22, f) * (1 - sstep(0.5, 1, f));
      pitch = -24 * (1 - sstep(0, 0.5, f)) + 16 * sstep(0.5, 1, f) * (1 - sstep(0.85, 1, f));
      arm = sstep(0.35, 0.8, f) * (1 - sstep(0.9, 1, f));
    } else if (u >= land) z = lam;
    // (looping: the ground carries the frog back at the hop's mean speed; once: it stays where it lands)
    setPos(s, 'Root', [0, y, z - (once ? 0 : lam * u)]);
    addRot(s, 'Hips', [pitch, 0, 0]);
    addRot(s, 'Head', [-pitch * 0.4, 0, 0]);
    frogLegs(info, s, e);
    for (const lm of info.limbs) if (lm.front) { s[lm.bones[0]] = [-40 * arm, 0, 0]; s[lm.bones[1]] = [25 * arm, 0, 0]; }
    throat(0.2 * Math.sin(TAU * u));
    return s;
  }
  if (G) return gaitSample(info, G, u);
  switch (name) {
    case 'idle': {
      // buccal pumping, a slow breath, the odd glance
      throat(0.35 * Math.max(0, Math.sin(TAU * u * 4)));
      addRot(s, 'Head', [0, 4 * Math.sin(TAU * u), 0]);
      break;
    }
    case 'alert': {
      const k = tw(0, 0.3, 1);
      addRot(s, 'Hips', [-10 * k, 0, 0]); addRot(s, 'Head', [6 * k, 0, 0]);
      throat(0.2 * k);
      break;
    }
    case 'peck': {
      // the tongue flipped out from the front of the mouth and back
      const k = tw(0.15, 0.35, 0.65);
      addRot(s, 'Hips', [4 * k, 0, 0]);
      if (info.has.Jaw) addRot(s, 'Jaw', [28 * tw(0.1, 0.3, 0.7), 0, 0]);
      if (info.has.TongueTip) setPos(s, 'TongueTip', L.tongue.dir.clone().multiplyScalar(L.tongue.ext * k).addScaledVector(L.tongue.up, 0.1 * L.Hl * k).toArray());
      break;
    }
    case 'roar': {
      // the call: the throat swells into a vocal sac, pulsing
      const k = tw(0, 0.2, 1);
      throat(k * (1.2 + 0.4 * Math.sin(TAU * u * 6)));
      addRot(s, 'Hips', [-4 * k, 0, 0]);
      break;
    }
    case 'sit': {
      // the crouch: legs drawn in, chin to the ground
      const k = tw(0, 0.3, 1.5);
      addRot(s, 'Head', [8 * k, 0, 0]);
      throat(-0.2 * k);
      break;
    }
    default: break;
  }
  // forelegs keep their hands planted
  for (const lm of info.limbs) if (lm.front) solveLimb(info, s, lm, lm.J[2].clone(), new THREE.Quaternion());
  return s;
}

/* ════════════════════════════════════════════════════════════════════════════
 *  EXPORTED METADATA & ASSET
 * ════════════════════════════════════════════════════════════════════════════ */
const PLANS = { saurian: saurianBuild, ophidian: ophidianBuild, chelonian: chelonianBuild, anuran: anuranBuild };
const SPECIES_KEYS = Object.keys(SPECIES);
export const COLORWAYS = colorwaysFor(BASE);
export const presets = COLORWAYS;
export const species = Object.fromEntries(SPECIES_KEYS.map(k => [k, SPECIES[k].label]));
export const POSES = ['stand', 'idle', 'walk', 'trot', 'swim', 'alert', 'graze', 'peck', 'roar', 'sit'];

export const params = withZones({
  species: { type: 'choice', default: 'green-iguana', options: SPECIES_KEYS, label: 'Species', affects: 'geometry', describe: `Species preset (${SPECIES_KEYS.length} reptiles and amphibians).` },
  colorway: { type: 'choice', default: 'natural', options: COLORWAY_KEYS, label: 'Colourway', affects: 'colors', describe: 'Role-aware transform of the species palette.' },
  detail: { type: 'choice', default: 'standard', options: Object.keys(DETAIL), label: 'Detail', affects: 'geometry', describe: 'Loft resolution (draft / standard / high).' },
  rigMode: { type: 'choice', default: 'skinned', options: ['skinned', 'static'], label: 'Rig mode', affects: 'geometry', describe: 'Skinned meshes with a skeleton, or pose baked into static geometry.' },
  pose: { type: 'choice', default: 'stand', options: POSES, label: 'Pose', affects: 'geometry', describe: 'Rest pose or a frozen frame of a clip.' },
  posePhase: { type: 'range', default: 0.25, min: 0, max: 1, step: 0.01, label: 'Pose phase', affects: 'geometry', describe: 'Clip phase used for the frozen pose.' },
  size: { type: 'range', default: 1, min: 0.3, max: 1.6, step: 0.01, label: 'Size', affects: 'geometry', describe: 'Scale of the species\' typical adult length.' },
  tailLen: { type: 'range', default: 1, min: 0.3, max: 1.5, step: 0.01, label: 'Tail length', affects: 'geometry', describe: 'Tail length multiplier (lizards, crocodilians, salamanders).' },
  legLen: { type: 'range', default: 1, min: 0.75, max: 1.3, step: 0.01, label: 'Leg length', affects: 'geometry', describe: 'Limb length multiplier.' },
  headSize: { type: 'range', default: 1, min: 0.8, max: 1.25, step: 0.01, label: 'Head size', affects: 'geometry', describe: 'Head length multiplier.' },
  seed: { type: 'range', default: 7, min: 1, max: 999, step: 1, label: 'Variation seed', affects: 'colors', describe: 'Seed for spots, mottling and net patterns.' },
  coat: { type: 'toggle', default: true, label: 'Painted skin', affects: 'colors', describe: 'Paint markings and scales into a skin texture; off: one colour per mesh face.' },
  coatGrain: { type: 'range', default: 0.05, min: 0, max: 0.25, step: 0.01, label: 'Skin grain', affects: 'colors', describe: 'Faint tonal variation in the skin (painted skin only).' },
  scaleDetail: { type: 'range', default: 1, min: 0, max: 1, step: 0.01, label: 'Scale relief', affects: 'colors', describe: 'How strongly the painted scales show (0 = smooth colour).' },
  shading: { type: 'choice', default: 'smooth', options: ['smooth', 'flat'], label: 'Shading', affects: 'geometry', describe: 'Smooth, rounded shading or flat low-poly facets.' },
  hide: { type: 'text', default: '', label: 'Hide parts', affects: 'geometry', describe: 'Comma list of detachable parts to omit (see `detach`).' },
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'One mesh per material (1-2 draw calls) instead of one selectable mesh per anatomical part.' },
}, ZONE_LABELS, BASE);

export const rig = {
  Hips: { axis: 'y', range: [-15, 15], describe: 'pelvis yaw (walking bends the body)' },
  Spine1: { axis: 'y', range: [-12, 12] }, Spine2: { axis: 'y', range: [-12, 12] }, Chest: { axis: 'y', range: [-15, 15] },
  Neck: { axis: 'x', range: [-30, 25], describe: 'neck raise / lower' }, Head: { axis: 'x', range: [-30, 30], describe: 'nod' },
  Jaw: { axis: 'x', range: [0, 40], describe: 'mouth open' }, Tail1: { axis: 'y', range: [-25, 25], describe: 'tail swing' },
  UpperArmL: { axis: 'y', range: [-50, 50] }, ThighL: { axis: 'y', range: [-50, 50] },
};
export const detach = ['crest', 'dewlap', 'frill', 'spines', 'fins', 'gills', 'eyes', 'eyelids', 'tongue', 'teeth', 'jaw', 'feet', 'shell'];
export const night = { eye: { color: '#ffd27a', intensity: 0.25, describe: 'eyeshine on the iris zone (geckos, crocodilians)' } };

/** The species with the user's options applied (lengths in metres). */
function specFor(base, p) {
  const S = { ...base, T: JSON.parse(JSON.stringify(base.T)), palette: base.palette, paint: base.paint, face: base.face, headPaint: base.headPaint, frillPaint: base.frillPaint };
  // (functions in tables survive the copy by reference)
  for (const k of ['bump', 'sect']) if (base.T[k]) S.T[k] = base.T[k];
  if (base.T.head && base.T.head.bump) S.T.head.bump = base.T.head.bump;
  const T = S.T, len = base.length * p.size;
  if (S.plan !== 'saurian') {
    S.V = len;
    if (S.plan === 'anuran' && T.hind) for (const k of ['femur', 'tibia', 'tarsus', 'foot']) if (T.hind[k]) T.hind[k] *= p.legLen;
    if (T.head) T.head.len *= p.headSize;
    S.seed = p.seed;
    if (S.scales) S.scales = p.scaleDetail > 0 ? { ...S.scales, dark: 1 - (1 - (S.scales.dark ?? 0.72)) * p.scaleDetail, light: (S.scales.light ?? 0.1) * p.scaleDetail } : null;
    return S;
  }
  if (T.tail !== undefined) {
    const t0 = T.tail; T.tail = t0 * p.tailLen;
    // tail stations stretch with it
    if (p.tailLen !== 1 && T.body) for (const k of T.body) if (k[0] > 1) k[0] = 1 + (k[0] - 1) * (T.tail / t0);
    for (const key of ['crest', 'fin', 'finBelly']) if (T[key] && T[key].to > 1) { T[key].to = 1 + (T[key].to - 1) * (T.tail / t0); if (T[key].h) for (const h of T[key].h) if (h[0] > 1) h[0] = 1 + (h[0] - 1) * (T.tail / t0); }
    if (S.paint) S.paint = S.paint.map(ly => ({ ...ly, ...(ly.from > 1 ? { from: 1 + (ly.from - 1) * (T.tail / t0) } : {}), ...(ly.to > 1 ? { to: 1 + (ly.to - 1) * (T.tail / t0) } : {}) }));
    // (the species' length is the total length at its own tail ratio)
    S.V = len / (1 + t0);
  } else S.V = len;
  for (const lm of [T.fore, T.hind]) if (lm) { lm.upper *= p.legLen; lm.lower *= p.legLen; lm.foot = [lm.foot[0] * (0.4 + 0.6 * p.legLen), lm.foot[1]]; }
  if (T.head) T.head.len *= p.headSize;
  S.seed = p.seed;
  if (S.scales) S.scales = p.scaleDetail > 0 ? { ...S.scales, dark: 1 - (1 - (S.scales.dark ?? 0.72)) * p.scaleDetail, light: (S.scales.light ?? 0.1) * p.scaleDetail } : null;
  return S;
}

const RIGS = new WeakMap();

export function createAsset(input = {}) {
  const p = normalize(input);
  const base = SPECIES[p.species] || SPECIES[SPECIES_KEYS[0]];
  const S = specFor(base, p);
  const det = DETAIL[p.detail] ?? 1;
  const rigB = new Rig(), parts = [], byName = new Map();
  const coatOn = p.coat !== false;
  const B = { det, rig: rigB, parts, paint: null,
    part(name, opt = {}) { if (!byName.has(name)) { const pt = new Part(name, opt); pt.coat = coatOn && !pt.glass; byName.set(name, pt); parts.push(pt); } return byName.get(name); } };
  const L = { T: S.T };
  B.paint = makePainter(S, L);
  PLANS[S.plan](B, S, p, L);

  const hidden = new Set(String(p.hide || '').split(',').map(s => s.trim()).filter(Boolean));
  const keep = (pt) => !hidden.has(pt.name) && !hidden.has(pt.group) && !(hidden.has('feet') && pt.group === 'feet');
  const build = { rig: rigB, parts: parts.filter(keep) };
  const zones = zonesFor(p.colorway, p, S.palette);
  const info = motionInfo(S, p, L, rigB);
  const pose = p.pose !== 'stand' ? sampleFor(info, p.pose, p.posePhase) : null;
  const coat = { res: COAT_RES[p.detail] ?? COAT_RES.standard, grain: p.coatGrain, grainOf: (z) => ZONE_ROLES[z] === 'body', smooth: p.shading !== 'flat', ref: S.coatRef ? S.coatRef * S.V : undefined, gloss: S.gloss };
  const { root, skeleton } = finish(build, { name: `herp-${p.species}`, merge: p.mergeForProduction, skinned: p.rigMode === 'skinned', zones, pose, coat: coatOn || coat.smooth ? coat : null, seamRadius: 0.03 * S.V, seams: [['head', 'body']] });
  let tris = 0; root.traverse(m => { if (m.isMesh) tris += m.geometry.attributes.position.count / 3; });
  root.userData = {
    species: p.species, label: S.label, params: p, dimensions: measure(root), triangles: tris, zones: Object.fromEntries(Object.entries(zones).map(([k, v]) => [k, hexStr(v)])),
    bones: info.bones, parts: build.parts.map(pt => pt.name), plan: S.plan,
  };
  RIGS.set(root, { rig: rigB, info, skeleton });
  return root;
}

export function createClips(asset) {
  const R = RIGS.get(asset); if (!R) return [];
  return clipsFor(R.info);
}
/** Poses a skinned asset at a clip phase (no mixer needed). */
export function setPose(asset, name = 'stand', phase = 0) {
  const R = RIGS.get(asset); if (!R) return;
  applySample(R.rig, name === 'stand' ? {} : sampleFor(R.info, name, clamp(phase, 0, 1)));
  asset.updateMatrixWorld(true);
}
export default createAsset;
