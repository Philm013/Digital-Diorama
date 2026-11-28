/*
 * HAND PUMP & TROUGH (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A cast-iron pitcher pump on a stone plinth: the lever rocks, the plunger rod rides up and down
 * and every stroke gushes a stream from the spout into a trough, whose surface ripples where it
 * lands; the brimming trough overflows through a notch into a puddle.
 *
 * QUICK START
 *   import { createAsset } from './hand-pump-trough.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // set pumpRate to 0 to stop pumping
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | red | black | blue | rustic — Theme
 *   troughLength        1–4 m (default 2) — Trough Length
 *   trough              wood | stone | metal — Trough Type
 *   pumpRate            0–2 strokes/s (default 0.8) — Pump Rate
 *   overflow            on/off (default on) — Overflow
 *   diorama             on/off (default on) — Diorama Sides
 *   seed                1–999 (default 3) — Seed
 *   iron                colour (default #2f5a3a) — Iron Colour
 *   ironDark            colour (default #1f3a28) — Iron Dark Colour
 *   brass               colour (default #c8a050) — Brass Colour
 *   plinth              colour (default #9a948a) — Plinth Colour
 *   wood                colour (default #8a6a45) — Wood Colour
 *   woodDark            colour (default #5f4632) — Wood Dark Colour
 *   stoneTrough         colour (default #a8a296) — Stone Trough Colour
 *   water               colour (default #4f8f9a) — Water Colour
 *   deep                colour (default #2a5a66) — Deep Colour
 *   foam                colour (default #f2fafc) — Foam Colour
 *   ground              colour (default #8aa060) — Ground Colour
 *   mud                 colour (default #6a5640) — Mud Colour
 *   soil                colour (default #5a4634) — Soil Colour
 *
 * SPECS  4,224 triangles at defaults, 3 materials, 8 draw calls when merged,
 *        4.5 x 2.1 x 4.5 m (W x H x D, real-world scale).
 * PARTS animate: lever (rotate z -25…25°), rod (translate y -0.12…0.12 m)
 *        detach: lever, rod, stream, trough
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  sweep, rng, noise2, smooth, lerp, mixC, heightField, makeWaterMaterial, waterify, waterGrid, waterDisc,
  waterRibbon, tileEdge, partsBag, makeEmitter, addLathe, bindModule
} from './kit.mjs';

const BASE = {
  iron: '#2f5a3a', ironDark: '#1f3a28', brass: '#c8a050', plinth: '#9a948a', wood: '#8a6a45', woodDark: '#5f4632', stoneTrough: '#a8a296',
  water: '#4f8f9a', deep: '#2a5a66', foam: '#f2fafc', ground: '#8aa060', mud: '#6a5640', soil: '#5a4634',
};
export const COLORWAYS = {
  'default': { ...BASE },
  red: { ...BASE, iron: '#8a2a20', ironDark: '#5a1a14' },
  black: { ...BASE, iron: '#2a2a2c', ironDark: '#141416' },
  blue: { ...BASE, iron: '#2a4a7a', ironDark: '#1a2f52' },
  rustic: { ...BASE, iron: '#6a4a35', ironDark: '#4a3424', ground: '#a89a6a' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  troughLength: { type: 'range', default: 2, min: 1, max: 4, step: 0.1, unit: 'm', label: 'Trough Length', affects: 'geometry', describe: 'Length of the trough.' },
  trough: { type: 'choice', default: 'wood', options: ['wood', 'stone', 'metal'], label: 'Trough Type', affects: 'geometry', describe: 'Trough construction.' },
  pumpRate: { type: 'range', default: 0.8, min: 0, max: 2, step: 0.05, unit: 'strokes/s', label: 'Pump Rate', affects: 'geometry', describe: 'Lever strokes per second (0 = idle).' },
  overflow: { type: 'toggle', default: true, label: 'Overflow', affects: 'geometry', describe: 'Trough overflows through a notch into a puddle.' },
  diorama: { type: 'toggle', default: true, label: 'Diorama Sides', affects: 'geometry', describe: 'Cut-away soil sections. Off: a short flange so the patch can sit in surrounding terrain.' },
  seed: { type: 'range', default: 3, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = { lever: { axis: 'z', range: [-25, 25], describe: 'Pump handle (auto-pumped).' }, rod: { type: 'translate', axis: 'y', range: [-0.12, 0.12], describe: 'Plunger rod.' } };
export const detach = ['lever', 'rod', 'stream', 'trough'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'hand-pump-trough';
  const P = partsBag();
  const TL = p.troughLength, S = Math.max(4, TL + 2.5), r = rng(p.seed);
  const pz = -0.55, tx = -0.45, tz0 = -0.3, tw = 0.6, tH = 0.55, cx = tx + TL / 2, cz = tz0 + tw / 2, zImp = pz + 0.43, puddle = [tx + TL + 0.55, cz];
  const h = (x, z) => 0.03 * (noise2(x * 1.3, z * 1.3, p.seed) - 0.5) - (p.overflow ? 0.05 * smooth(0.9, 0.3, Math.hypot(x - puddle[0], z - puddle[1])) : 0);
  const terrainCol = (x, y, z) => (y < -0.02 ? C.mud : noise2(x * 2, z * 2, p.seed) > 0.5 ? C.ground : mixC(C.ground, C.mud, 0.3).getHex());
  P.solid.push({ g: heightField(S, S, 36, 36, h, terrainCol, cx, 0), c: null, n: 'ground' });
  tileEdge(p, P.solid, null, S, S, 36, 36, h, -0.6, [C.ground, C.soil, C.soil], null, 0, cx, 0);
  // Pump: plinth, fluted column, spout, cap
  P.solid.push({ g: new THREE.BoxGeometry(0.5, 0.25, 0.5).translate(0, 0.125, pz), c: C.plinth, n: 'plinth' });
  addLathe(P.solid, [[0.12, 0.25], [0.11, 0.3], [0.09, 0.32], [0.08, 0.9], [0.1, 0.95], [0.1, 1.15], [0.07, 1.2], [0, 1.22]], 10, C.iron, 0, 0, pz);
  P.solid.push({ g: sweep([[0, 0.95, pz + 0.08], [0, 0.98, pz + 0.25], [0, 0.9, pz + 0.4], [0, 0.82, zImp]], (t) => 0.035 * (1 - t * 0.2), 6, 6, true), c: C.ironDark, n: 'spout' });
  P.solid.push({ g: new THREE.TorusGeometry(0.09, 0.015, 4, 12).rotateX(Math.PI / 2).translate(0, 0.6, pz), c: C.brass, n: 'band' });
  const lv = P.sub('lever', [0.02, 1.2, pz]);
  lv.solid.push({ g: sweep([[0.02, 1.2, pz], [-0.3, 1.27, pz], [-0.7, 1.22, pz]], () => 0.025, 6, 6, true), c: C.ironDark, n: 'handle' });
  lv.solid.push({ g: new THREE.SphereGeometry(0.045, 8, 6).translate(-0.72, 1.22, pz), c: C.ironDark, n: 'knob' });
  const rod = P.sub('rod', [0, 1.3, pz]);
  rod.solid.push({ g: new THREE.CylinderGeometry(0.015, 0.015, 0.3, 5).translate(0.06, 1.33, pz), c: C.brass, n: 'plunger-rod' });
  // Trough
  const tr = P.sub('trough', [cx, 0, cz]), col = p.trough === 'stone' ? C.stoneTrough : p.trough === 'metal' ? C.ironDark : C.wood;
  const wallT = p.trough === 'stone' ? 0.1 : 0.05, notch = 0.08;
  tr.solid.push({ g: new THREE.BoxGeometry(TL, wallT, tw).translate(cx, 0.12, cz), c: col, n: 'trough-bottom' });
  for (const s2 of [-1, 1]) tr.solid.push({ g: new THREE.BoxGeometry(TL, tH, wallT).translate(cx, 0.12 + tH / 2, cz + s2 * (tw / 2 - wallT / 2)), c: col, n: 'trough-side' });
  tr.solid.push({ g: new THREE.BoxGeometry(wallT, tH, tw).translate(tx + wallT / 2, 0.12 + tH / 2, cz), c: col, n: 'trough-end' });
  tr.solid.push({ g: new THREE.BoxGeometry(wallT, tH - notch, tw).translate(tx + TL - wallT / 2, 0.12 + (tH - notch) / 2, cz), c: col, n: 'trough-end' });
  if (p.trough === 'wood') for (const s2 of [-1, 1]) for (const e of [0, 1]) tr.solid.push({ g: new THREE.BoxGeometry(0.08, 0.14, 0.08).translate(tx + 0.1 + e * (TL - 0.2), 0.07, cz + s2 * (tw / 2 - 0.06)), c: C.woodDark, n: 'leg' });
  if (p.trough !== 'stone') for (const e of [0.2, 0.8]) tr.solid.push({ g: new THREE.BoxGeometry(0.03, tH + 0.02, tw + 0.04).translate(tx + e * TL, 0.12 + tH / 2, cz), c: C.ironDark, n: 'hoop' });
  const ww = 0.12 + tH - notch - 0.01;
  tr.water.push({ g: waterify(waterGrid(TL - 2 * wallT, tw - 2 * wallT, 12, 5, ww, cx, cz), (x, y, z) => ({ s: x, u: z, speed: 0.15 * p.pumpRate, foam: 0.25 * smooth(0.3, 0, Math.hypot(x, z - zImp)), ripple: 1, color: mixC(C.water, C.deep, 0.3) })), c: null, n: 'trough-water' });
  // Stream from the spout (pulses with the strokes)
  const st = P.sub('stream', [0, 0.82, zImp]), sp = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; sp.push([0, lerp(0.8, ww + 0.01, t), zImp + 0.04 * t]); }
  st.water.push({ g: waterify(waterRibbon(sp, 0.03, 2, [1, 0, 0]), (x, y, z, s3, u) => ({ s: s3, u, speed: 2.5, mode: 1, foam: 0.4, color: mixC(C.water, C.foam, 0.2) })), c: null, n: 'stream' });
  const emitters = [makeEmitter('splash', { count: 30, shape: 'drop', color: C.foam, floor: ww - 0.01, seed: p.seed, cycle: [1 / Math.max(0.05, p.pumpRate), 0.55, 0.3], spawn: (i, rr) => { const a = rr() * 6.28, s4 = 0.3 + rr() * 0.5; return { p: [0, ww + 0.02, zImp + 0.04], v: [Math.cos(a) * s4, 0.6 + rr() * 0.6, Math.sin(a) * s4], life: 0.35, size: 0.012 }; } })];
  if (p.overflow) {
    const op = []; for (let i = 0; i <= 6; i++) { const t = i / 6; op.push([tx + TL + 0.02 + t * 0.15, lerp(ww + 0.005, 0.02, t * t), cz]); }
    P.water.push({ g: waterify(waterRibbon(op, 0.05, 2, [0, 0, 1]), (x, y, z, s3, u) => ({ s: s3, u, speed: 1, mode: 1, foam: 0.3, color: mixC(C.water, C.foam, 0.2) })), c: null, n: 'overflow' });
    P.water.push({ g: waterify(waterDisc(0.75, 4, -0.012, puddle[0], puddle[1]), (x, y, z) => ({ s: x, u: z, ripple: 1, color: mixC(C.water, C.mud, 0.35) })), c: null, n: 'puddle' });
  }
  // Ripple sources: the trough water lives in the 'trough' sub, so its coordinates are pivot-relative.
  const waterMat = makeWaterMaterial({ opacity: 0.82, foam: C.foam, roughness: 0.05, streakAlong: 2, streakAcross: 3, ripples: [[0 - cx, zImp + 0.04 - cz, -0.25, 0.006], ...(p.overflow ? [[tx + TL + 0.17, cz, -0.3, 0.004]] : [])] });
  return finalize(g, P, p, C, {
    waterMat, emitters, ground: { h, col: terrainCol, w: S, d: S, cx },
    tick: (t, dt, drive) => {
      const rate = p.pumpRate, ph = rate > 0 ? Math.sin(t * rate * Math.PI * 2) : 0;
      drive('lever', ph * 22); drive('rod', ph * 0.1);
      const st2 = g.getObjectByName('stream'); if (st2) st2.visible = rate > 0 && ph < 0.2;
      waterMat.userData.uniforms.uRip.value[0].w = rate > 0 && ph < 0.2 ? 0.006 : 0;
    },
  });
}
export default createAsset;
