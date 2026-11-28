/*
 * ROWBOAT (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A clinker-built wooden rowing boat: a lofted lapstrake hull with steamed ribs, keelson, thwarts,
 * floorboards, bronze oarlocks and a painter trailing in the water. A rower pulls a real stroke
 * cycle — blades bite at the catch (ripple rings), drive aft, lift at the finish (swirling
 * puddles) and recover — while the hull bobs, pitches and rolls on the swell and a faint wake
 * trails astern. Floats on its own preview patch or on any water asset.
 *
 * QUICK START
 *   import { createAsset } from './rowboat.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   boat.userData.waterSurface = lake.userData.surface; boat.userData.matchWaves(lake);   // float on another water asset (set waterPatch: false)
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | varnished | harbourBlue | dory | forest — Theme
 *   length              2.6–5 m (default 3.6) — Length
 *   beam                1–1.8 m (default 1.38) — Beam
 *   freeboard           0.32–0.6 m (default 0.42) — Freeboard
 *   rowing              on/off (default on) — Rowing
 *   rower               on/off (default on) — Rower
 *   strokeRate          10–36 spm (default 22) — Stroke Rate
 *   swell               0–1.5 m (default 0.3) — Swell
 *   waterPatch          on/off (default on) — Water Patch
 *   hull                colour (default #f2efe6) — Hull Colour
 *   hullDark            colour (default #e4dfd2) — Hull Dark Colour
 *   bottom              colour (default #8a3b2a) — Bottom Colour
 *   inside              colour (default #b8875a) — Inside Colour
 *   insideDark          colour (default #9f7048) — Inside Dark Colour
 *   trim                colour (default #6a4a30) — Trim Colour
 *   thwart              colour (default #9a7048) — Thwart Colour
 *   oar                 colour (default #c8a878) — Oar Colour
 *   blade               colour (default #2f6f8f) — Blade Colour
 *   bronze              colour (default #a87a3a) — Bronze Colour
 *   rope                colour (default #d8c8a0) — Rope Colour
 *   skin                colour (default #e0b090) — Skin Colour
 *   vest                colour (default #ff7a1a) — Vest Colour
 *   shirt               colour (default #3a5f8a) — Shirt Colour
 *   pants               colour (default #3a3f4a) — Pants Colour
 *   hat                 colour (default #e8e2d0) — Hat Colour
 *   water               colour (default #3f8fa8) — Water Colour
 *   deep                colour (default #1a5a74) — Deep Colour
 *   foam                colour (default #f4fbff) — Foam Colour
 *   seabed              colour (default #6a6a5a) — Seabed Colour
 *
 * SPECS  6,286 triangles at defaults, 3 materials, 8 draw calls when merged,
 *        15.8 x 3.7 x 18.6 m (W x H x D, real-world scale).
 * PARTS animate: oar-port (rotate y -40…30°), oar-port-dip (rotate z -30…5°), oar-starboard
 * (rotate y -30…40°), oar-starboard-dip (rotate z -5…30°), rower (rotate x -30…20°)
 *        detach: oar-port, oar-starboard, rower, wake, water-patch
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.waterSurface (sampler it floats on) · userData.surface (its own patch) · userData.matchWaves(asset)
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  sweep, smooth, lerp, makeWaterMaterial, matchWavesFrom, partsBag, fireRipple, boatHull, wakeParts, patchWaves,
  waterPatch, makeLinks, localTo, seatedFigure, setArm, floatOn, bindModule
} from './kit.mjs';

const BASE = {
  hull: '#f2efe6', hullDark: '#e4dfd2', bottom: '#8a3b2a', inside: '#b8875a', insideDark: '#9f7048', trim: '#6a4a30', thwart: '#9a7048', oar: '#c8a878', blade: '#2f6f8f', bronze: '#a87a3a', rope: '#d8c8a0',
  skin: '#e0b090', vest: '#ff7a1a', shirt: '#3a5f8a', pants: '#3a3f4a', hat: '#e8e2d0', water: '#3f8fa8', deep: '#1a5a74', foam: '#f4fbff', seabed: '#6a6a5a',
};
export const COLORWAYS = {
  'default': { ...BASE },
  varnished: { ...BASE, hull: '#b8875a', hullDark: '#a87a4f', bottom: '#5a3a28', inside: '#c8976a', insideDark: '#b8885b', blade: '#b8875c' },
  harbourBlue: { ...BASE, hull: '#2f5f8f', hullDark: '#28537d', bottom: '#e8e2d1', trim: '#e8e2d2', blade: '#e8e2d3' },
  dory: { ...BASE, hull: '#e8c84a', hullDark: '#d8b83a', bottom: '#4a5a3a', inside: '#8a9a7a', insideDark: '#7a8a6a', blade: '#c83a2a' },
  forest: { ...BASE, hull: '#3f6a4a', hullDark: '#355e40', bottom: '#2a2a2a', trim: '#d8c8a1', blade: '#3f6a4b' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  length: { type: 'range', default: 3.6, min: 2.6, max: 5, step: 0.1, unit: 'm', label: 'Length', affects: 'geometry', describe: 'Length overall.' },
  beam: { type: 'range', default: 1.38, min: 1.0, max: 1.8, step: 0.02, unit: 'm', label: 'Beam', affects: 'geometry', describe: 'Maximum width.' },
  freeboard: { type: 'range', default: 0.42, min: 0.32, max: 0.6, step: 0.01, unit: 'm', label: 'Freeboard', affects: 'geometry', describe: 'Sheer height above the waterline amidships.' },
  rowing: { type: 'toggle', default: true, label: 'Rowing', affects: 'geometry', describe: 'Animate the stroke cycle (and trail a wake).' },
  rower: { type: 'toggle', default: true, label: 'Rower', affects: 'geometry', describe: 'Seated rower pulling the oars.' },
  strokeRate: { type: 'range', default: 22, min: 10, max: 36, step: 1, unit: 'spm', label: 'Stroke Rate', affects: 'geometry', describe: 'Strokes per minute.' },
  swell: { type: 'range', default: 0.3, min: 0, max: 1.5, step: 0.05, unit: 'm', label: 'Swell', affects: 'geometry', describe: 'Wave height of the preview water patch.' },
  waterPatch: { type: 'toggle', default: true, label: 'Water Patch', affects: 'geometry', describe: 'Own patch of water to float on (turn off when placing on another water asset).' },
  ...zoneParams(),
};
export const rig = {
  'oar-port': { axis: 'y', range: [-40, 30], describe: 'Port oar sweep (− = blade toward the bow).' },
  'oar-port-dip': { axis: 'z', range: [-30, 5], describe: 'Port oar dip (− = blade down).' },
  'oar-starboard': { axis: 'y', range: [-30, 40], describe: 'Starboard oar sweep (+ = blade toward the bow).' },
  'oar-starboard-dip': { axis: 'z', range: [-5, 30], describe: 'Starboard oar dip (+ = blade down).' },
  rower: { axis: 'x', range: [-30, 20], describe: 'Rower lean (− = toward the stern, at the catch).' },
};
export const detach = ['oar-port', 'oar-starboard', 'rower', 'wake', 'water-patch'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'rowboat';
  const P = partsBag();
  const L = p.length, Bm = p.beam, hs = P.sub('hull', [0, 0, 0]);
  const H = boatHull({
    len: L, beam: Bm, draft: 0.17, freeboard: p.freeboard, sheerRise: 0.13, stern: 'transom', transomBeam: 0.62, tm: 0.42, bowFine: 0.62, fullness: 2.8, vee: 0.25, rocker: 0.55, flare: 0.28,
    stations: 26, ribs: 8, thick: 0.025, inner: true, strakes: true, rubRail: 0.022,
    cols: { bottom: C.bottom, hull: C.hull, hullDark: C.hullDark, inside: C.inside, insideDark: C.insideDark, trim: C.trim },
  });
  hs.solid.push(...H.parts);
  // Steamed ribs, keelson, risers, thwarts, floorboards
  for (let z = -L / 2 + 0.32; z < L / 2 - 0.45; z += 0.3) {
    const t = H.T(z);
    for (const sg of [1, -1]) { const pts = []; for (let j = 0; j <= 6; j++) { const q = H.sec(t, (j / 6) * (H.nP - 1) * 0.96, 0.04); pts.push([sg * q[0], q[1], z]); } hs.solid.push({ g: sweep(pts, () => 0.013, 3, 8, false), c: C.insideDark, n: 'rib' }); }
  }
  { const pts = []; for (let i = 0; i <= 10; i++) { const t = 0.06 + (i / 10) * 0.86; pts.push([0, H.keel(t) + 0.045, H.Z(t)]); } hs.solid.push({ g: sweep(pts, () => 0.03, 4, 20, false), c: C.insideDark, n: 'keelson' }); }
  const seatY = Math.min(p.freeboard - 0.17, 0.22), fy = -0.085;
  for (const sg of [1, -1]) { const pts = []; for (let i = 0; i <= 12; i++) { const t = 0.1 + (i / 12) * 0.8; pts.push([sg * (H.beamAt(t, seatY - 0.035, 0.025) - 0.012), seatY - 0.035, H.Z(t)]); } hs.solid.push({ g: sweep(pts, () => 0.016, 4, 24, false), c: C.thwart, n: 'riser' }); }
  for (const ts of [0.16, 0.5, 0.8]) hs.solid.push({ g: new THREE.BoxGeometry(H.beamAt(ts, seatY, 0.025) * 2, 0.035, ts === 0.16 ? 0.32 : 0.22).translate(0, seatY, H.Z(ts)), c: C.thwart, n: 'thwart' });
  for (const k of [-2, -1, 0, 1, 2]) {
    const x = k * 0.11, zs = [];
    for (let i = 0; i <= 40; i++) { const t = 0.14 + (i / 40) * 0.72; if (H.beamAt(t, fy, 0.025) > Math.abs(x) + 0.07) zs.push(H.Z(t)); }
    if (zs.length > 2) hs.solid.push({ g: new THREE.BoxGeometry(0.09, 0.018, zs[zs.length - 1] - zs[0]).translate(x, fy, (zs[0] + zs[zs.length - 1]) / 2), c: C.thwart, n: 'floorboard' });
  }
  // Oarlocks + oars (sweep sub → dip sub, pivoting in the oarlock)
  const zTh = H.Z(0.5), zOl = zTh - 0.3, tOl = H.T(zOl), xOl = H.halfW(tOl), yOl = H.sheer(tOl) + 0.05;
  const Lo = Math.min(2.9, Math.max(1.8, Bm * 1.6)), inb = Lo * 0.3, outb = Lo - inb;
  for (const sg of [1, -1]) {
    hs.solid.push({ g: new THREE.CylinderGeometry(0.012, 0.012, 0.1, 5).translate(sg * xOl, yOl - 0.04, zOl), c: C.bronze, n: 'oarlock-pin' });
    hs.solid.push({ g: new THREE.TorusGeometry(0.035, 0.008, 4, 8, Math.PI).rotateZ(Math.PI).rotateY(Math.PI / 2).translate(sg * xOl, yOl + 0.01, zOl), c: C.bronze, n: 'oarlock' });
  }
  for (const [side, sg] of [['port', 1], ['starboard', -1]]) {
    const pv = [sg * xOl, yOl, zOl], o = P.sub(`oar-${side}-dip`, pv, `oar-${side}`);
    P.sub(`oar-${side}`, pv, 'hull');
    const seg = (d0, d1, r, hex, n) => o.solid.push({ g: new THREE.CylinderGeometry(r, r, d1 - d0, 6).rotateZ(Math.PI / 2).translate(pv[0] + sg * (d0 + d1) / 2, yOl, zOl), c: hex, n });
    seg(-inb, -inb + 0.13, 0.019, C.oar, 'grip');
    seg(-inb + 0.13, 0.15, 0.026, C.oar, 'loom');
    seg(0.15, outb - 0.56, 0.021, C.oar, 'shaft');
    o.solid.push({ g: new THREE.BoxGeometry(0.58, 0.13, 0.014).translate(pv[0] + sg * (outb - 0.29), yOl, zOl), c: C.blade, n: 'blade' });
    o.solid.push({ g: new THREE.TorusGeometry(0.03, 0.008, 4, 8).rotateY(Math.PI / 2).translate(pv[0] + sg * 0.03, yOl, zOl), c: C.rope, n: 'leather' });
  }
  // Rower facing the stern, feet on a stretcher; arms are stretchy links re-aimed at the oar grips every frame
  let sh = null, arms = null;
  const seatTop = seatY + 0.018, rPiv = [0, seatTop + 0.05, zTh];
  if (p.rower) {
    const rw = P.sub('rower', rPiv, 'hull');
    sh = seatedFigure(rw.solid, hs.solid, { x: 0, y: seatTop, z: zTh, facing: -1, footY: fy + 0.01, reach: 0.62, cols: { skin: C.skin, vest: C.vest, shirt: C.shirt, pants: C.pants, hat: C.hat } });
    const tSt = H.T(zTh - 0.72);
    hs.solid.push({ g: new THREE.BoxGeometry(Math.max(0.2, H.beamAt(tSt, fy + 0.06, 0.025) * 2 - 0.04), 0.04, 0.05).translate(0, fy + 0.05, zTh - 0.72), c: C.thwart, n: 'stretcher' });
    arms = makeLinks('rower-arms', 4, 0.045, C.shirt, 6);
    arms.userData.parent = 'hull';
  }
  // Painter line from the stem ring trailing into the water
  { const s1 = H.sheer(1), pts = [[0, s1 - 0.06, L / 2 + 0.01], [0.02, s1 - 0.3, L / 2 + 0.22], [0.05, 0.08, L / 2 + 0.55], [0.1, 0.0, L / 2 + 0.95]]; hs.solid.push({ g: sweep(pts, () => 0.009, 4, 12, false), c: C.rope, n: 'painter' }); }
  // Water: preview patch, wake, ripple slots (0 hull ring · 1–2 catches · 3–4 finish puddles)
  const waves = patchWaves(p.swell), sp = p.rowing ? 1.3 : 0;
  const waterMat = makeWaterMaterial({ waves, cap: [0.5, 0.78], opacity: 0.82, foam: C.foam, roughness: 0.1, streakAlong: 0.45, streakAcross: 0.7, ripples: [[0, 0, -L * 0.45, 0.004], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] });
  if (p.waterPatch) g.userData.waterSurface = g.userData.surface = waterPatch(P.sub('water-patch', [0, 0, 0]), g, { r: Math.max(6, L * 2.2), depth: 2.5, waves, water: C.water, deep: C.deep, floor: C.seabed, mat: waterMat });
  if (sp > 0) wakeParts(P.sub('wake', [0, 0, 0]).water, { len: L, beam: Bm, speed: sp, sideAt: (z) => H.beamAt(H.T(z), 0) });
  const U = waterMat.userData.uniforms, Ts = 60 / p.strokeRate, ease = (v) => v * v * (3 - 2 * v);
  const dDrive = (Math.atan2(yOl + 0.05, outb - 0.29) * 180) / Math.PI, dRec = (Math.atan2(Math.max(0.05, yOl - 0.14), outb - 0.29) * 180) / Math.PI;
  let hullN = null, rowN = null, oarP = null, oarS = null, prev = 0;
  g.userData.view = { target: [0, 0.35, 0], radius: L * 2.6 };
  finalize(g, P, p, C, {
    waterMat, objects: arms ? [arms] : [],
    tick: (t, dt, drive) => {
      if (!hullN) { hullN = g.getObjectByName('hull'); rowN = g.getObjectByName('rower'); oarP = g.getObjectByName('oar-port-dip'); oarS = g.getObjectByName('oar-starboard-dip'); }
      floatOn(g, hullN, t, dt, { len: L, beam: Bm, amp: 0.05, period: 3.6, response: 3.5 });
      let ph = 0, sw = -8, dip = dRec, lean = -4;
      if (p.rowing) {
        ph = (t / Ts) % 1;
        const drv = ph < 0.42, u = drv ? ph / 0.42 : (ph - 0.42) / 0.58;
        sw = drv ? lerp(-36, 26, ease(u)) : lerp(26, -36, ease(u));
        dip = lerp(dRec, dDrive, smooth(0, 0.05, ph) * (1 - smooth(0.38, 0.46, ph)));
        lean = drv ? lerp(-22, 12, ease(u)) : lerp(12, -22, ease(u));
      }
      drive('oar-port', sw); drive('oar-port-dip', -dip); drive('oar-starboard', -sw); drive('oar-starboard-dip', dip); drive('rower', lean);
      g.updateMatrixWorld(true);
      if (p.rowing && oarP && oarS) {
        const tip = outb - 0.29;
        if (ph < prev) { const a = localTo(oarP, [tip, 0, 0], g), b = localTo(oarS, [-tip, 0, 0], g); U.uRip.value[1].set(a[0], a[2], t, 0.03); U.uRip.value[2].set(b[0], b[2], t, 0.03); fireRipple(g, a[0], a[2], t, 0.03); fireRipple(g, b[0], b[2], t, 0.03); }
        if (prev < 0.42 && ph >= 0.42) { const a = localTo(oarP, [tip, 0, 0], g), b = localTo(oarS, [-tip, 0, 0], g); U.uRip.value[3].set(a[0], a[2], t, 0.02); U.uRip.value[4].set(b[0], b[2], t, 0.02); fireRipple(g, a[0], a[2], t, 0.02); fireRipple(g, b[0], b[2], t, 0.02); }
        prev = ph;
      }
      if (arms && rowN && sh) {
        const sL = [sh[0][0] - rPiv[0], sh[0][1] - rPiv[1], sh[0][2] - rPiv[2]], sR = [sh[1][0] - rPiv[0], sh[1][1] - rPiv[1], sh[1][2] - rPiv[2]];
        setArm(arms, 0, localTo(rowN, sL, hullN), localTo(oarP, [-inb + 0.06, 0, 0], hullN), 1);
        setArm(arms, 2, localTo(rowN, sR, hullN), localTo(oarS, [inb - 0.06, 0, 0], hullN), -1);
      }
    },
  });
  g.userData.matchWaves = (src) => matchWavesFrom(waterMat, src);
  return g;
}
export default createAsset;
