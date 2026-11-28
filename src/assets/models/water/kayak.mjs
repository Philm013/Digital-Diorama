/*
 * SEA KAYAK (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A touring sea kayak: a slim lofted hull with strong rocker, crowned deck, a smooth oval cockpit
 * with a raised coaming and spray deck, fore and aft hatches, perimeter lines and bungees, carry
 * toggles and a skeg. A paddler drives a feathered double-bladed paddle in a continuous left-right
 * rhythm — each blade dips mid-stroke, rings spread where it enters — while the torso rotates with
 * the stroke, the hull rolls gently and bow waves and a slim wake follow.
 *
 * QUICK START
 *   import { createAsset } from './kayak.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   kayak.userData.waterSurface = river.userData.surface; kayak.userData.matchWaves(river);
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | lime | ocean | stealth | redWhite — Theme
 *   length              2.8–5.8 m (default 4.6) — Length
 *   beam                0.5–0.8 m (default 0.6) — Beam
 *   paddler             on/off (default on) — Paddler
 *   paddling            on/off (default on) — Paddling
 *   strokeRate          20–80 spm (default 46) — Stroke Rate
 *   hatches             on/off (default on) — Hatches & Lines
 *   swell               0–1.2 m (default 0.25) — Swell
 *   waterPatch          on/off (default on) — Water Patch
 *   hull                colour (default #ff8a1a) — Hull Colour
 *   deck                colour (default #f2f2ec) — Deck Colour
 *   stripe              colour (default #1e1e22) — Stripe Colour
 *   coaming             colour (default #26262c) — Coaming Colour
 *   hatch               colour (default #2a2a30) — Hatch Colour
 *   lines               colour (default #1a1a1e) — Lines Colour
 *   shaft               colour (default #2e2e34) — Shaft Colour
 *   blade               colour (default #f2c81e) — Blade Colour
 *   skin                colour (default #c8946a) — Skin Colour
 *   vest                colour (default #d8342a) — Vest Colour
 *   shirt               colour (default #2f8fd0) — Shirt Colour
 *   pants               colour (default #3a3f4a) — Pants Colour
 *   hat                 colour (default #f4f2ee) — Hat Colour
 *   water               colour (default #3d8ea6) — Water Colour
 *   deep                colour (default #185a74) — Deep Colour
 *   foam                colour (default #f6fcff) — Foam Colour
 *   seabed              colour (default #6a6a5c) — Seabed Colour
 *
 * SPECS  5,072 triangles at defaults, 3 materials, 7 draw calls when merged,
 *        14.7 x 3.2 x 22.4 m (W x H x D, real-world scale).
 * PARTS animate: paddle-yaw (rotate y -45…45°), paddle (rotate z -35…35°), paddler (rotate y
 * -25…25°)
 *        detach: paddler, paddle-yaw, wake, water-patch
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.waterSurface · userData.surface · userData.matchWaves(asset)
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  addWire, makeWaterMaterial, matchWavesFrom, partsBag, fireRipple, boatHull, wakeParts, patchWaves, waterPatch,
  addQuad, makeLinks, localTo, seatedFigure, setArm, floatOn, bindModule
} from './kit.mjs';

const BASE = {
  hull: '#ff8a1a', deck: '#f2f2ec', stripe: '#1e1e22', coaming: '#26262c', hatch: '#2a2a30', lines: '#1a1a1e', shaft: '#2e2e34', blade: '#f2c81e',
  skin: '#c8946a', vest: '#d8342a', shirt: '#2f8fd0', pants: '#3a3f4a', hat: '#f4f2ee', water: '#3d8ea6', deep: '#185a74', foam: '#f6fcff', seabed: '#6a6a5c',
};
export const COLORWAYS = {
  'default': { ...BASE },
  lime: { ...BASE, hull: '#8fd03a', deck: '#f2f2ed', blade: '#1e1e23' },
  ocean: { ...BASE, hull: '#2f8fd0', deck: '#f2f2ed', blade: '#f2c81f', vest: '#ff7a1a' },
  stealth: { ...BASE, hull: '#3a4a3a', deck: '#4a5a4a', blade: '#5a6a5a', vest: '#5a6a3a' },
  redWhite: { ...BASE, hull: '#d8342a', deck: '#f2f2ed', blade: '#d8342b', vest: '#f2c81e' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  length: { type: 'range', default: 4.6, min: 2.8, max: 5.8, step: 0.1, unit: 'm', label: 'Length', affects: 'geometry', describe: 'Length overall.' },
  beam: { type: 'range', default: 0.6, min: 0.5, max: 0.8, step: 0.01, unit: 'm', label: 'Beam', affects: 'geometry', describe: 'Maximum width.' },
  paddler: { type: 'toggle', default: true, label: 'Paddler', affects: 'geometry', describe: 'Paddler in the cockpit (with spray deck).' },
  paddling: { type: 'toggle', default: true, label: 'Paddling', affects: 'geometry', describe: 'Animate the paddle stroke (and trail a wake).' },
  strokeRate: { type: 'range', default: 46, min: 20, max: 80, step: 1, unit: 'spm', label: 'Stroke Rate', affects: 'geometry', describe: 'Blade strokes per minute (left + right).' },
  hatches: { type: 'toggle', default: true, label: 'Hatches & Lines', affects: 'geometry', describe: 'Fore/aft hatches, deck lines and bungees.' },
  swell: { type: 'range', default: 0.25, min: 0, max: 1.2, step: 0.05, unit: 'm', label: 'Swell', affects: 'geometry', describe: 'Wave height of the preview water patch.' },
  waterPatch: { type: 'toggle', default: true, label: 'Water Patch', affects: 'geometry', describe: 'Own patch of water to float on (turn off when placing on another water asset).' },
  ...zoneParams(),
};
export const rig = {
  'paddle-yaw': { axis: 'y', range: [-45, 45], describe: 'Paddle sweep (− = port blade forward).' },
  paddle: { axis: 'z', range: [-35, 35], describe: 'Paddle roll (− = port blade down).' },
  paddler: { axis: 'y', range: [-25, 25], describe: 'Torso rotation.' },
};
export const detach = ['paddler', 'paddle-yaw', 'wake', 'water-patch'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'kayak';
  const P = partsBag();
  const L = p.length, Bm = p.beam, hs = P.sub('hull', [0, 0, 0]), zc = -L * 0.04, hl = 0.42, hwF = 0.56;
  const hole = (t) => { const z = (t - 0.5) * L - zc, e = 1 - (z / hl) ** 2; return e > 0 ? hwF * Math.sqrt(e) : 0; };
  const H = boatHull({
    len: L, beam: Bm, draft: 0.11, freeboard: 0.17, sheerRise: 0.07, stern: 'pointed', tm: 0.48, bowFine: 0.75, fullness: 2.2, vee: 0.25, rocker: 0.85, flare: 0.05,
    stations: 32, ribs: 8, thick: 0.01, rubRail: 0.012, deck: { y: 'sheer', crown: 0.32, hole },
    cols: { bottom: C.hull, hull: C.hull, trim: C.stripe, deck: C.deck },
  });
  hs.solid.push(...H.parts);
  // Coaming wall + lip around the oval opening (exact to the deck's hole edge)
  const edge = [];
  for (let i = 0; i < H.nS; i++) { const t = i / (H.nS - 1), hh = hole(t), hn = hole(Math.min(1, t + 1 / (H.nS - 1))), hp = hole(Math.max(0, t - 1 / (H.nS - 1))); if (hh > 0 || hn > 0 || hp > 0) edge.push([t, hh]); }
  const loop = [...edge.map(([t, hh]) => H.deckAt(t, hh)), ...edge.slice().reverse().map(([t, hh]) => H.deckAt(t, -hh))];
  const ctr = loop.reduce((a, q) => [a[0] + q[0] / loop.length, a[1] + q[1] / loop.length, a[2] + q[2] / loop.length], [0, 0, 0]);
  for (let k = 0; k < loop.length; k++) {
    const a = loop[k], b = loop[(k + 1) % loop.length];
    if (Math.hypot(a[0] - b[0], a[2] - b[2]) < 1e-4) continue;
    const oa = Math.hypot(a[0] - ctr[0], a[2] - ctr[2]) || 1, ob = Math.hypot(b[0] - ctr[0], b[2] - ctr[2]) || 1;
    const A2 = [a[0] + ((a[0] - ctr[0]) / oa) * 0.035, a[1] + 0.05, a[2] + ((a[2] - ctr[2]) / oa) * 0.035], B2 = [b[0] + ((b[0] - ctr[0]) / ob) * 0.035, b[1] + 0.05, b[2] + ((b[2] - ctr[2]) / ob) * 0.035];
    addQuad(hs.solid, a, b, up(b, 0.05), up(a, 0.05), C.coaming);
    addQuad(hs.solid, up(a, 0.05), up(b, 0.05), B2, A2, C.coaming);
  }
  function up(q, dy) { return [q[0], q[1] + dy, q[2]]; }
  // Seat + backband inside the cockpit; skeg; carry toggles
  const tS = H.T(zc - 0.12), ySeat = H.keel(tS) + 0.05;
  hs.solid.push({ g: new THREE.BoxGeometry(0.38, 0.03, 0.36).translate(0, ySeat, zc - 0.1), c: C.coaming, n: 'seat' });
  hs.solid.push({ g: new THREE.BoxGeometry(0.34, 0.16, 0.03).rotateX(-0.3).translate(0, ySeat + 0.14, zc - 0.32), c: C.coaming, n: 'backband' });
  hs.solid.push({ g: new THREE.BoxGeometry(0.012, 0.14, 0.3).translate(0, H.keel(0.06) - 0.06, H.Z(0.06)), c: C.stripe, n: 'skeg' });
  for (const t of [0.004, 0.996]) hs.solid.push({ g: new THREE.TorusGeometry(0.045, 0.01, 4, 8).translate(0, H.sheer(t) + 0.03, H.Z(t) + (t > 0.5 ? -0.03 : 0.03)), c: C.lines, n: 'toggle' });
  if (p.hatches) {
    for (const [t, rz] of [[0.76, 0.17], [0.24, 0.2]]) { const q = H.deckAt(t, 0), w = H.deckW(t); hs.solid.push({ g: new THREE.CylinderGeometry(1, 1, 0.025, 18).scale(w * 0.62, 1, rz * L / 4.6).translate(q[0], q[1] + 0.008, q[2]), c: C.hatch, n: 'hatch' }); }
    for (const sg of [1, -1]) { const pts = []; for (let i = 0; i <= 16; i++) { const t = 0.08 + (i / 16) * 0.84; if (hole(t) > 0) continue; pts.push(up(H.deckAt(t, sg * 0.86), 0.012)); } for (let k = 0; k < pts.length - 1; k++) if (Math.abs(pts[k + 1][2] - pts[k][2]) < L * 0.1) addWire(hs.solid, pts[k], pts[k + 1], C.lines, 0.005, 3); }
    for (const tc of [0.63, 0.67, 0.37]) { addWire(hs.solid, up(H.deckAt(tc - 0.03, 0.8), 0.015), up(H.deckAt(tc + 0.03, -0.8), 0.015), C.lines, 0.006, 3); addWire(hs.solid, up(H.deckAt(tc - 0.03, -0.8), 0.015), up(H.deckAt(tc + 0.03, 0.8), 0.015), C.lines, 0.006, 3); }
  }
  // Paddler + spray deck; paddle (yaw sub → roll sub); arms as stretchy links
  let sh = null, arms = null;
  const pPiv = [0, ySeat + 0.03, zc - 0.05], padPiv = [0, ySeat + 0.5, zc + 0.16];
  if (p.paddler) {
    const pd = P.sub('paddler', pPiv, 'hull');
    sh = seatedFigure(pd.solid, [], { x: 0, y: ySeat + 0.02, z: zc - 0.05, facing: 1, footY: ySeat - 0.05, reach: 0.9, cols: { skin: C.skin, vest: C.vest, shirt: C.shirt, pants: C.pants, hat: C.hat } });
    const cy = H.deckAt(H.T(zc), 0)[1] + 0.035;
    hs.solid.push({ g: new THREE.CylinderGeometry(1, 1, 0.02, 20).scale(H.deckW(H.T(zc)) * hwF + 0.02, 1, hl + 0.02).translate(0, cy, zc), c: C.coaming, n: 'spray-deck' });
    arms = makeLinks('paddler-arms', 4, 0.042, C.shirt, 6);
    arms.userData.parent = 'hull';
  }
  P.sub('paddle-yaw', padPiv, 'hull');
  const pdl = P.sub('paddle', padPiv, 'paddle-yaw'), half = 1.1;
  pdl.solid.push({ g: new THREE.CylinderGeometry(0.016, 0.016, half * 2 - 0.3, 6).rotateZ(Math.PI / 2).translate(padPiv[0], padPiv[1], padPiv[2]), c: C.shaft, n: 'shaft' });
  for (const sg of [1, -1]) {
    pdl.solid.push({ g: new THREE.BoxGeometry(0.46, 0.17, 0.012).rotateX(sg > 0 ? 0 : Math.PI / 6).translate(padPiv[0] + sg * (half - 0.2), padPiv[1], padPiv[2]), c: C.blade, n: 'blade' });
    pdl.solid.push({ g: new THREE.TorusGeometry(0.035, 0.008, 4, 8).rotateY(Math.PI / 2).translate(padPiv[0] + sg * 0.62, padPiv[1], padPiv[2]), c: C.shaft, n: 'drip-ring' });
  }
  // Water
  const waves = patchWaves(p.swell), spd = p.paddling ? 1.7 : 0;
  const waterMat = makeWaterMaterial({ waves, cap: [0.5, 0.78], opacity: 0.82, foam: C.foam, roughness: 0.1, streakAlong: 0.45, streakAcross: 0.7, ripples: [[0, 0, -L * 0.3, 0.005], [0, 0, 0, 0], [0, 0, 0, 0]] });
  if (p.waterPatch) g.userData.waterSurface = g.userData.surface = waterPatch(P.sub('water-patch', [0, 0, 0]), g, { r: Math.max(6, L * 1.6), depth: 2, waves, water: C.water, deep: C.deep, floor: C.seabed, mat: waterMat });
  if (spd > 0) wakeParts(P.sub('wake', [0, 0, 0]).water, { len: L, beam: Bm, speed: spd, sideAt: (z) => H.beamAt(H.T(z), 0) });
  const U = waterMat.userData.uniforms, Tc = (60 / p.strokeRate) * 2;
  let hullN = null, padN = null, pdN = null, prev = 0;
  g.userData.view = { target: [0, 0.35, 0], radius: L * 1.5 };
  finalize(g, P, p, C, {
    waterMat, objects: arms ? [arms] : [],
    tick: (t, dt, drive) => {
      if (!hullN) { hullN = g.getObjectByName('hull'); padN = g.getObjectByName('paddle'); pdN = g.getObjectByName('paddler'); }
      const ph = p.paddling ? (t / Tc) % 1 : 0.25;
      const yaw = p.paddling ? -40 * Math.cos(2 * Math.PI * ph) : 0, roll = p.paddling ? -30 * Math.sin(2 * Math.PI * ph) : 0;
      drive('paddle-yaw', yaw); drive('paddle', roll); drive('paddler', yaw * 0.45);
      floatOn(g, hullN, t, dt, { len: L, beam: Bm, amp: 0.04, period: 3.2, response: 4, heel: (roll * Math.PI) / 180 * 0.06 });
      g.updateMatrixWorld(true);
      if (p.paddling) {
        for (const [ph0, slot, sg] of [[0.08, 1, 1], [0.58, 2, -1]]) if (prev < ph0 && ph >= ph0) { const q = localTo(padN, [sg * (half - 0.2), 0, 0], g); U.uRip.value[slot].set(q[0], q[2], t, 0.025); fireRipple(g, q[0], q[2], t, 0.025); }
        prev = ph;
      }
      if (arms && pdN && sh) {
        const sL = [sh[0][0] - pPiv[0], sh[0][1] - pPiv[1], sh[0][2] - pPiv[2]], sR = [sh[1][0] - pPiv[0], sh[1][1] - pPiv[1], sh[1][2] - pPiv[2]];
        setArm(arms, 0, localTo(pdN, sL, hullN), localTo(padN, [0.34, 0, 0], hullN), 1);
        setArm(arms, 2, localTo(pdN, sR, hullN), localTo(padN, [-0.34, 0, 0], hullN), -1);
      }
    },
  });
  g.userData.matchWaves = (src) => matchWavesFrom(waterMat, src);
  return g;
}
export default createAsset;
