/*
 * LIGHTHOUSE (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A striped lighthouse on a wave-washed islet. The tower is truly hollow — the door and window
 * slots are real openings through the wall, and a spiral stair winds up the inside around a newel
 * — topped by a gallery, a glazed lantern room and a cupola. At night the lamp blazes and twin
 * beams sweep the sea; by day swell rolls in, foam collars the rocks and spray bursts against
 * them.
 *
 * QUICK START
 *   import { createAsset } from './lighthouse.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // night: asset.userData.setNight(1) lights the lamp and beams
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | blackWhite | allWhite | stone | blueBands — Theme
 *   height              10–60 m (default 24) — Tower Height
 *   radius              2–8 m (default 3.2) — Base Radius
 *   taper               0–0.5 (default 0.25) — Taper
 *   stripes             0–8 (default 3) — Stripes
 *   stripeStyle         bands | spiral — Stripe Style
 *   beamSpeed           1–20 rpm (default 6) — Beam Rotation
 *   islet               on/off (default on) — Rocky Islet
 *   seaPatch            on/off (default on) — Own Sea
 *   swell               0–2 m (default 0.6) — Swell
 *   waterDepth          2–40 m (default 4) — Water Depth
 *   seed                1–999 (default 4) — Seed
 *   white               colour (default #f4f2ee) — White Colour
 *   stripe              colour (default #c8302a) — Stripe Colour
 *   base                colour (default #8a8478) — Base Colour
 *   iron                colour (default #2a2e34) — Iron Colour
 *   lantern             colour (default #3a4048) — Lantern Colour
 *   glass               colour (default #bfe0ee) — Glass Colour
 *   interior            colour (default #d8d0c0) — Interior Colour
 *   stair               colour (default #7a7068) — Stair Colour
 *   lamp                colour (default #fff2c0) — Lamp Colour
 *   beam                colour (default #fff6d8) — Beam Colour
 *   rock                colour (default #6a645c) — Rock Colour
 *   rockDark            colour (default #4a4640) — Rock Dark Colour
 *   water               colour (default #2f7f99) — Water Colour
 *   deep                colour (default #164c66) — Deep Colour
 *   foam                colour (default #f8fcff) — Foam Colour
 *   door                colour (default #2f4f6f) — Door Colour
 *
 * SPECS  12,046 triangles at defaults, 6 materials, 10 draw calls when merged,
 *        161.2 x 38.0 x 40.0 m (W x H x D, real-world scale).
 * PARTS animate: lamp (rotate y 0…360°), door (rotate y 0…-100°)
 *        detach: lamp, door, interior, islet, lantern-room
 *        night: lamp
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.surface.heightAt(x, z, t)   // the swell around the islet
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  addCylinder, addWire, rng, clamp01, smooth, lerp, mixC, faceTint, addRock, makeWaterMaterial, waterify,
  waterDisc, waterSkirt, matchWavesFrom, partsBag, makeSurface, swellAt, makeEmitter, makeGlowMaterial, addQuad,
  bindModule
} from './kit.mjs';

const BASE = {
  white: '#f4f2ee', stripe: '#c8302a', base: '#8a8478', iron: '#2a2e34', lantern: '#3a4048', glass: '#bfe0ee', interior: '#d8d0c0', stair: '#7a7068',
  lamp: '#fff2c0', beam: '#fff6d8', rock: '#6a645c', rockDark: '#4a4640', water: '#2f7f99', deep: '#164c66', foam: '#f8fcff', door: '#2f4f6f',
};
export const COLORWAYS = {
  'default': { ...BASE },
  blackWhite: { ...BASE, stripe: '#1e1e22', lantern: '#1e1e23', door: '#1e1e24' },
  allWhite: { ...BASE, stripe: '#ecebe6', lantern: '#c8302a', door: '#c8302b' },
  stone: { ...BASE, white: '#b8b0a2', stripe: '#9a9284', base: '#7a7266', lantern: '#2f5a3a' },
  blueBands: { ...BASE, stripe: '#2f5fa8', door: '#2f5fa9' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  height: { type: 'range', default: 24, min: 10, max: 60, step: 1, unit: 'm', label: 'Tower Height', affects: 'geometry', describe: 'Base to gallery.' },
  radius: { type: 'range', default: 3.2, min: 2, max: 8, step: 0.1, unit: 'm', label: 'Base Radius', affects: 'geometry', describe: 'Radius at the foot of the tower.' },
  taper: { type: 'range', default: 0.25, min: 0, max: 0.5, step: 0.01, label: 'Taper', affects: 'geometry', describe: 'How much the tower narrows toward the top.' },
  stripes: { type: 'range', default: 3, min: 0, max: 8, step: 1, label: 'Stripes', affects: 'colors', describe: 'Number of painted bands.' },
  stripeStyle: { type: 'choice', default: 'bands', options: ['bands', 'spiral'], label: 'Stripe Style', affects: 'colors', describe: 'Horizontal bands or a barber-pole spiral.' },
  beamSpeed: { type: 'range', default: 6, min: 1, max: 20, step: 0.5, unit: 'rpm', label: 'Beam Rotation', affects: 'geometry', describe: 'Lens revolutions per minute.' },
  islet: { type: 'toggle', default: true, label: 'Rocky Islet', affects: 'geometry', describe: 'Rocks, surrounding sea and breaking spray (off: a concrete pad for placing on a headland).' },
  seaPatch: { type: 'toggle', default: true, label: 'Own Sea', affects: 'geometry', describe: 'The islet’s own sea disc and seabed (turn off when the islet stands in another water asset).' },
  swell: { type: 'range', default: 0.6, min: 0, max: 2, step: 0.05, unit: 'm', label: 'Swell', affects: 'geometry', describe: 'Wave height around the islet.' },
  waterDepth: { type: 'range', default: 4, min: 2, max: 40, step: 0.5, unit: 'm', label: 'Water Depth', affects: 'geometry', describe: 'Depth of the sea around the islet: the rock plinth reaches down to the seabed (match the ocean it stands in).' },
  seed: { type: 'range', default: 4, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = { lamp: { axis: 'y', range: [0, 360], describe: 'Rotating lens and beams (auto-spun at beamSpeed).' }, door: { axis: 'y', range: [0, -100], describe: 'Tower door.' } };
export const detach = ['lamp', 'door', 'interior', 'islet', 'lantern-room'];
export const night = { lamp: { color: '#fff2c0', intensity: 3, distance: 60, offset: [0, 28, 0], describe: 'Main light (anchored to the lamp node); beams fade in as the sky darkens.' } };

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'lighthouse';
  const P = partsBag();
  const H = p.height, R0 = p.radius, Rt = R0 * (1 - p.taper), wt = 0.35, r = rng(p.seed);
  const yB = p.islet ? 2.2 : 0.4, yG = yB + H;
  const rAt = (y) => lerp(R0, Rt, clamp01((y - yB) / H));
  const paint = (x, y, z) => {
    if (!p.stripes) return C.white;
    const k = p.stripeStyle === 'spiral' ? ((y - yB) / H) * p.stripes * 2 + Math.atan2(z, x) / Math.PI : ((y - yB) / H) * (p.stripes * 2 + 1);
    return Math.floor(k) % 2 ? C.stripe : C.white;
  };
  // Openings: the door and staggered window slots cut right through the wall
  const doorA = Math.PI / 2, doorW = 1.1 / R0, cuts = [{ y0: yB, y1: yB + 2.3, a: doorA, w: doorW, door: true }];
  const nWin = Math.max(2, Math.floor(H / 6));
  for (let i = 0; i < nWin; i++) { const y0 = yB + 4 + i * ((H - 7) / nWin); cuts.push({ y0, y1: y0 + 1.2, a: doorA + Math.PI * (i % 2 ? 1 : 0.85) + 0.4 * i, w: 0.7 / rAt(y0) }); }
  // Horizontal wall bands: split at every opening edge and stripe edge (crisp paint), or every metre for spirals
  const ys = new Set([yB, yG]), cutYs = [];
  for (const c of cuts) { ys.add(c.y0); ys.add(c.y1); cutYs.push(c.y0, c.y1); }
  const extra = [];
  if (p.stripes && p.stripeStyle === 'bands') for (let k = 1; k <= p.stripes * 2; k++) extra.push(yB + (H * k) / (p.stripes * 2 + 1));
  else for (let yy = yB + 1; yy < yG - 0.2; yy += 1) extra.push(yy);
  for (const yy of extra) if (!cutYs.some((c) => Math.abs(c - yy) < 0.06)) ys.add(yy);
  const Y = [...ys].sort((a, b) => a - b);
  const wallCol = (x, y, z) => { const d = Math.hypot(x, z), ro = rAt(y); return d > ro - wt * 0.25 ? paint(x, y, z) : d < ro - wt * 0.75 ? C.interior : C.base; };
  for (let i = 0; i < Y.length - 1; i++) {
    const y0 = Y[i], y1 = Y[i + 1], cut = cuts.find((c) => c.y0 <= y0 + 1e-6 && c.y1 >= y1 - 1e-6);
    const prof = [[rAt(y0), y0], [rAt(y1), y1], [rAt(y1) - wt, y1], [rAt(y0) - wt, y0], [rAt(y0), y0]].map((q) => new THREE.Vector2(q[0], q[1]));
    const phiL = cut ? Math.PI * 2 - cut.w : Math.PI * 2, phiS = cut ? Math.PI / 2 - (cut.a + cut.w / 2) - phiL : 0;
    const geo = new THREE.LatheGeometry(prof, cut ? Math.max(8, Math.round((40 * phiL) / (Math.PI * 2))) : 40, phiS, phiL);
    P.solid.push({ g: faceTint(geo, wallCol), c: null, n: cut ? 'tower-band-open' : 'tower-band' });
    if (cut) for (const s of [-1, 1]) {
      const a = cut.a + (s * cut.w) / 2, ca = Math.cos(a), sa = Math.sin(a);
      addQuad(P.solid, [ca * rAt(y0), y0, sa * rAt(y0)], [ca * rAt(y1), y1, sa * rAt(y1)], [ca * (rAt(y1) - wt), y1, sa * (rAt(y1) - wt)], [ca * (rAt(y0) - wt), y0, sa * (rAt(y0) - wt)], C.base);
    }
  }
  // Lintels, sills and the door step
  for (const c of cuts) {
    const a = c.a, rot = -a + Math.PI / 2;
    const at = (yy, dr) => [Math.cos(a) * (rAt(yy) - wt / 2 + dr), yy, Math.sin(a) * (rAt(yy) - wt / 2 + dr)];
    const L = at(c.y1 + 0.12, 0.04);
    P.solid.push({ g: new THREE.BoxGeometry(c.w * rAt(c.y1) + 0.3, 0.25, wt + 0.12).rotateY(rot).translate(L[0], L[1], L[2]), c: C.base, n: 'lintel' });
    if (!c.door) { const Sl = at(c.y0 - 0.05, 0.08); P.solid.push({ g: new THREE.BoxGeometry(c.w * rAt(c.y0) + 0.25, 0.1, wt + 0.24).rotateY(rot).translate(Sl[0], Sl[1], Sl[2]), c: C.base, n: 'sill' }); }
    else { const St = [Math.cos(a) * (R0 + 0.25), yB - 0.075, Math.sin(a) * (R0 + 0.25)]; P.solid.push({ g: new THREE.BoxGeometry(c.w * R0 + 0.5, 0.15, 0.7).rotateY(rot).translate(St[0], St[1], St[2]), c: C.base, n: 'step' }); }
  }
  // Door (hinged at one jamb)
  const dr = P.sub('door', [Math.cos(doorA + doorW / 2) * (R0 - wt / 2), yB, Math.sin(doorA + doorW / 2) * (R0 - wt / 2)]);
  dr.solid.push({ g: new THREE.BoxGeometry(1.05, 2.25, 0.07).rotateY(-doorA + Math.PI / 2).translate(Math.cos(doorA) * (R0 - wt / 2), yB + 1.13, Math.sin(doorA) * (R0 - wt / 2)), c: C.door, n: 'door-leaf' });
  // Interior: floor, newel and a spiral stair that clears the doorway
  const inn = P.sub('interior', [0, yB, 0]);
  inn.solid.push({ g: new THREE.CylinderGeometry(R0 - wt, R0 - wt, 0.15, 24).translate(0, yB + 0.07, 0), c: C.stair, n: 'floor' });
  addCylinder(inn.solid, 0.25, 0.25, H, 10, 0, yB + H / 2, 0, 0, 0, 0, C.stair);
  const nSteps = Math.floor((H - 0.4) / 0.22);
  for (let i = 0; i < nSteps; i++) {
    const yy = yB + 0.2 + i * 0.22, a = doorA + 0.7 + i * 0.42, rr = rAt(yy) - wt - 0.05, len = rr - 0.25;
    inn.solid.push({ g: new THREE.BoxGeometry(len, 0.06, 0.42).translate(0.25 + len / 2, 0, 0).rotateY(-a).translate(0, yy, 0), c: C.stair, n: 'step' });
  }
  // Gallery + railing, lantern room, cupola
  const Rg = Rt + 1.0;
  P.solid.push({ g: new THREE.CylinderGeometry(Rg, Rt, 0.5, 24).translate(0, yG + 0.25, 0), c: C.base, n: 'gallery' });
  for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2; addWire(P.solid, [Math.cos(a) * (Rg - 0.1), yG + 0.5, Math.sin(a) * (Rg - 0.1)], [Math.cos(a) * (Rg - 0.1), yG + 1.5, Math.sin(a) * (Rg - 0.1)], C.iron, 0.03, 4); }
  P.solid.push({ g: new THREE.TorusGeometry(Rg - 0.1, 0.05, 4, 48).rotateX(Math.PI / 2).translate(0, yG + 1.5, 0), c: C.iron, n: 'rail' });
  const lr = P.sub('lantern-room', [0, yG, 0]), Rl = Rt * 0.72, Lh = 2.6, sides = 8;
  lr.solid.push({ g: new THREE.CylinderGeometry(Rl + 0.1, Rl + 0.1, 0.9, sides).translate(0, yG + 0.95, 0), c: C.lantern, n: 'lantern-base' });
  for (let k = 0; k < sides; k++) {
    const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2;
    lr.glass.push({ g: addQuad([], [Math.cos(a0) * Rl, yG + 1.4, Math.sin(a0) * Rl], [Math.cos(a1) * Rl, yG + 1.4, Math.sin(a1) * Rl], [Math.cos(a1) * Rl, yG + 1.4 + Lh, Math.sin(a1) * Rl], [Math.cos(a0) * Rl, yG + 1.4 + Lh, Math.sin(a0) * Rl], C.glass), c: C.glass, n: 'pane' });
    addWire(lr.solid, [Math.cos(a0) * Rl, yG + 1.4, Math.sin(a0) * Rl], [Math.cos(a0) * Rl, yG + 1.4 + Lh, Math.sin(a0) * Rl], C.lantern, 0.05, 4);
  }
  lr.solid.push({ g: new THREE.ConeGeometry(Rl + 0.4, 1.5, sides).translate(0, yG + 1.4 + Lh + 0.75, 0), c: C.lantern, n: 'cupola' });
  lr.solid.push({ g: new THREE.SphereGeometry(0.28, 10, 8).translate(0, yG + 1.4 + Lh + 1.65, 0), c: C.lantern, n: 'vent-ball' });
  addWire(lr.solid, [0, yG + 1.4 + Lh + 1.9, 0], [0, yG + 1.4 + Lh + 2.8, 0], C.iron, 0.03, 4);
  // Lamp + lens (rotating rig); the beams are an additive cone pair that fades in at night
  const yL = yG + 1.4 + Lh * 0.5, lamp = P.sub('lamp', [0, yL, 0]), glowMat = makeGlowMaterial();
  lamp.glow.push({ g: new THREE.IcosahedronGeometry(0.45, 1).translate(0, yL, 0), c: C.lamp, n: 'lamp' });
  for (const s of [-1, 1]) lamp.glow.push({ g: new THREE.CylinderGeometry(0.5, 0.5, 0.15, 12).rotateZ(Math.PI / 2).translate(s * 0.55, yL, 0), c: C.lamp, n: 'lens' });
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(C.beam), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  beamMat.name = 'beam';
  const beamLen = 80, bg = [];
  for (const s of [-1, 1]) bg.push(new THREE.ConeGeometry(4.5, beamLen, 16, 1, true).rotateZ((s * Math.PI) / 2).translate(s * (beamLen / 2 + 0.6), 0, 0));
  const beams = new THREE.Mesh(mergeGeometries(bg), beamMat);
  beams.name = 'beams';
  // Islet: rocks, sea with a foam collar and cut-away water walls, bursts of spray — or a plain pad
  const emitters = [];
  let waterMat = null, waves = [];
  const Ri = R0 + 4.5;
  if (p.islet) {
    const isl = P.sub('islet', [0, 0, 0]), Rs = Ri * 2.6;
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + r() * 0.3, d = Ri * (0.55 + r() * 0.5), s = 1.4 + r() * 2.4; addRock(isl.solid, s, Math.cos(a) * d, yB - s * 0.55, Math.sin(a) * d, r() < 0.5 ? C.rock : C.rockDark, p.seed + i, 0.6); }
    const WD = p.waterDepth;
    isl.solid.push({ g: new THREE.CylinderGeometry(R0 + 1.2, Ri * 0.95 + WD * 0.12, yB + WD, 14, Math.max(1, Math.round(WD / 3))).translate(0, (yB - WD) / 2, 0), c: C.rock, n: 'plinth-rock' });
    isl.solid.push({ g: new THREE.CylinderGeometry(R0 + 0.6, R0 + 0.8, 0.4, 24).translate(0, yB - 0.2, 0), c: C.base, n: 'plinth' });
    const Lw = 16, kw = (2 * Math.PI) / Lw;
    waves = [[1, 0.3, Math.min(0.5, (p.swell / 2) * kw), Lw], [-0.4, 1, Math.min(0.2, (p.swell / 6) * kw * 2), Lw * 0.5]];
    waterMat = makeWaterMaterial({ waves, opacity: 0.86, foam: C.foam, streakAlong: 0.4, streakAcross: 0.4, roughness: 0.12 });
    if (p.seaPatch) {
      isl.solid.push({ g: new THREE.CylinderGeometry(Rs, Rs, 0.6, 48).translate(0, -WD - 0.3, 0), c: C.rockDark, n: 'seabed' });
      const sea = waterify(waterDisc(Rs, 16, 0, 0, 0, 0, 1.2), (x, y, z) => { const d = Math.hypot(x, z); return { s: x, u: z, speed: 0.6, foam: 0.85 * smooth(Ri * 1.5, Ri * 0.9, d) + 0.03, ocean: smooth(Ri * 0.8, Ri * 1.4, d) * 0.7 + 0.3, ripple: 1, color: mixC(C.water, C.deep, smooth(Ri, Rs, d) * 0.6) }; });
      isl.water.push({ g: sea, c: null, n: 'sea' });
      waterSkirt(isl.water, sea, -WD, (x, y) => mixC(C.water, C.deep, smooth(0, -WD, y)));
    } else {
      isl.water.push({ g: waterify(waterDisc(Ri * 1.5, 6, 0.04, 0, 0, Ri * 0.55), (x, y, z) => ({ s: Math.atan2(z, x) * 4, u: Math.hypot(x, z) * 2, speed: 0.6, foam: 0.85 * smooth(Ri * 1.5, Ri * 0.9, Math.hypot(x, z)), ocean: 1, mode: 3 })), c: null, n: 'foam-collar' });
    }
    emitters.push(makeEmitter('spray', {
      count: Math.round(180 * Math.min(1, p.swell + 0.2)), shape: 'drop', color: C.foam, stretch: 0.05, floor: -0.3, cycle: [6, 0.3, 0.6], seed: p.seed, parent: 'islet',
      spawn: (i, rr) => { const a = rr() * 6.28, d = Ri * 1.05; return { p: [Math.cos(a) * d, 0.2, Math.sin(a) * d], v: [Math.cos(a) * (0.5 + rr()), 3 + rr() * 5 * (0.4 + p.swell * 0.4), Math.sin(a) * (0.5 + rr())], life: 2, size: 0.1 + rr() * 0.16 }; },
    }));
  } else {
    P.solid.push({ g: new THREE.CylinderGeometry(R0 + 1.5, R0 + 1.8, 0.4, 32).translate(0, 0.2, 0), c: C.base, n: 'pad' });
  }
  g.userData.view = { target: [0, (yG + 6) * 0.45, 0], radius: Math.max((yG + 8) * 1.45, 34) };
  finalize(g, P, p, C, {
    waterMat, glowMat, emitters,
    onNight: (k) => { beamMat.opacity = 0.16 * k; glowMat.color.setScalar(0.6 + 1.6 * k); },
    tick: (t, dt, drive) => drive('lamp', (t * p.beamSpeed * 6) % 360),
  });
  const lampNode = g.getObjectByName('lamp');
  if (lampNode) lampNode.add(beams);
  if (p.islet && p.seaPatch) g.userData.surface = makeSurface(g, (lx, lz, t, wx, wz) => (Math.hypot(lx, lz) < Ri * 0.9 ? null : swellAt(waves, wx, wz, t, waterMat.userData.uniforms.uWaveAmp.value)));
  if (waterMat) g.userData.matchWaves = (src) => matchWavesFrom(waterMat, src);
  return g;
}
export default createAsset;
