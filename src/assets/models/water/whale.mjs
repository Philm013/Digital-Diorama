/*
 * WHALE (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A humpback, orca or blue whale on a long loop through open water, built from articulated body,
 * tail-stock and fluke segments that beat as it swims, with pectoral flippers, dorsal fin, ventral
 * grooves and markings per species. Its cycle: cruise at depth, rise until the back breaks the
 * surface, blow twice (misty spouts), arch and raise its flukes — water streaming off them — and
 * sound. In breach mode every other cycle it launches clear of the sea, twists and crashes back in
 * a ring of spray.
 *
 * QUICK START
 *   import { createAsset } from './whale.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   whale.userData.onWaterEvent = (x, z, t, a) => ocean.userData.addRipple(x, z, t, a);   // ring another asset's water
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | orca | blue | grey | arctic — Theme
 *   species             humpback | orca | blue — Species
 *   length              5–30 m (default 14) — Length
 *   behaviour           cruise | breach — Behaviour
 *   cycle               20–90 s (default 36) — Cycle
 *   speed               0.5–6 m/s (default 2.4) — Speed
 *   pathRadius          6–80 m (default 24) — Path Radius
 *   depth               2–30 m (default 7) — Cruise Depth
 *   swell               0–2.5 m (default 0.8) — Swell
 *   waterPatch          on/off (default on) — Water Patch
 *   back                colour (default #2a2e34) — Back Colour
 *   belly               colour (default #d8dce0) — Belly Colour
 *   groove              colour (default #9aa0a8) — Groove Colour
 *   fin                 colour (default #e8ecee) — Fin Colour
 *   fluke               colour (default #2a2e35) — Fluke Colour
 *   flukeUnder          colour (default #e4e8ea) — Fluke Under Colour
 *   eye                 colour (default #0a0a0a) — Eye Colour
 *   patch               colour (default #f4f4f0) — Patch Colour
 *   saddle              colour (default #8a9098) — Saddle Colour
 *   spout               colour (default #f4f8fa) — Spout Colour
 *   water               colour (default #1f6f8f) — Water Colour
 *   deep                colour (default #0c3a52) — Deep Colour
 *   foam                colour (default #f6fcff) — Foam Colour
 *   seabed              colour (default #3a4a50) — Seabed Colour
 *
 * SPECS  20,715 triangles at defaults, 6 materials, 11 draw calls when merged,
 *        70.4 x 15.5 x 70.4 m (W x H x D, real-world scale).
 * PARTS animate: tail (rotate x -30…30°), flukes (rotate x -40…40°), flipper-l (rotate z -30…30°),
 * flipper-r (rotate z -30…30°)
 *        detach: whale-body, water-patch
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.onWaterEvent(x, z, t, amp) hook · userData.surface · userData.matchWaves(asset)
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  noise2, clamp01, smooth, lerp, faceTint, makeWaterMaterial, matchWavesFrom, partsBag, fireRipple, makeEmitter,
  patchWaves, waterPatch, bindModule
} from './kit.mjs';

const BASE = {
  back: '#2a2e34', belly: '#d8dce0', groove: '#9aa0a8', fin: '#e8ecee', fluke: '#2a2e35', flukeUnder: '#e4e8ea', eye: '#0a0a0a', patch: '#f4f4f0', saddle: '#8a9098', spout: '#f4f8fa',
  water: '#1f6f8f', deep: '#0c3a52', foam: '#f6fcff', seabed: '#3a4a50',
};
export const COLORWAYS = {
  'default': { ...BASE },
  orca: { ...BASE, back: '#141416', belly: '#f4f4f1', groove: '#e8e8e6', fin: '#141417', fluke: '#141418', flukeUnder: '#f4f4f2', patch: '#f6f6f3', saddle: '#9aa0a8' },
  blue: { ...BASE, back: '#5a6a7a', belly: '#7a8a9a', groove: '#6a7a8a', fin: '#5a6a7b', fluke: '#4a5a6a', flukeUnder: '#6a7a8b', saddle: '#6a7a8c' },
  grey: { ...BASE, back: '#6a6a68', belly: '#8a8a86', groove: '#7a7a76', fin: '#6a6a69', fluke: '#5a5a58', flukeUnder: '#7a7a77', saddle: '#9a9a96' },
  arctic: { ...BASE, water: '#2a6a7a', deep: '#0f3440', seabed: '#4a5a5a' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  species: { type: 'choice', default: 'humpback', options: ['humpback', 'orca', 'blue'], label: 'Species', affects: 'geometry', describe: 'Body shape, fins and markings (with the Default theme, natural colours).' },
  length: { type: 'range', default: 14, min: 5, max: 30, step: 0.5, unit: 'm', label: 'Length', affects: 'geometry', describe: 'Body length.' },
  behaviour: { type: 'choice', default: 'breach', options: ['cruise', 'breach'], label: 'Behaviour', affects: 'geometry', describe: 'Surface-blow-dive cycles, or alternate those with full breaches.' },
  cycle: { type: 'range', default: 36, min: 20, max: 90, step: 1, unit: 's', label: 'Cycle', affects: 'geometry', describe: 'Seconds per dive cycle.' },
  speed: { type: 'range', default: 2.4, min: 0.5, max: 6, step: 0.1, unit: 'm/s', label: 'Speed', affects: 'geometry', describe: 'Swimming speed.' },
  pathRadius: { type: 'range', default: 24, min: 6, max: 80, step: 1, unit: 'm', label: 'Path Radius', affects: 'geometry', describe: 'Radius of the swimming loop.' },
  depth: { type: 'range', default: 7, min: 2, max: 30, step: 0.5, unit: 'm', label: 'Cruise Depth', affects: 'geometry', describe: 'Depth between surfacings.' },
  swell: { type: 'range', default: 0.8, min: 0, max: 2.5, step: 0.05, unit: 'm', label: 'Swell', affects: 'geometry', describe: 'Wave height of the preview water patch.' },
  waterPatch: { type: 'toggle', default: true, label: 'Water Patch', affects: 'geometry', describe: 'Own patch of ocean (turn off when placing in another water asset).' },
  ...zoneParams(),
};
export const rig = {
  tail: { axis: 'x', range: [-30, 30], describe: 'Tail-stock beat (+ = up).' },
  flukes: { axis: 'x', range: [-40, 40], describe: 'Fluke angle.' },
  'flipper-l': { axis: 'z', range: [-30, 30], describe: 'Left pectoral flipper.' },
  'flipper-r': { axis: 'z', range: [-30, 30], describe: 'Right pectoral flipper.' },
};
export const detach = ['whale-body', 'water-patch'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const sp = p.species, cw = p.colorway === 'default' && COLORWAYS[sp] ? sp : p.colorway;
  const C = zonesFor(cw, colorOverrides(userParams, cw));
  const g = new THREE.Group();
  g.name = 'whale';
  const P = partsBag();
  const Lw = p.length, SPC = {
    // (a broad, blunt head)
    humpback: { R: 0.115, prof: [[0, 0.16], [0.12, 0.3], [0.3, 0.62], [0.5, 0.92], [0.65, 1], [0.8, 0.92], [0.9, 0.78], [0.96, 0.52], [1, 0.22]], hu: 0.85, hd: 0.8, wd: 1, flat: 0.35, span: 0.3, flip: 0.3, dorsal: [0.33, 0.04] },
    orca: { R: 0.13, prof: [[0, 0.18], [0.15, 0.4], [0.35, 0.8], [0.55, 1], [0.75, 0.95], [0.9, 0.7], [1, 0.25]], hu: 0.95, hd: 0.9, wd: 1, flat: 0, span: 0.24, flip: 0.12, dorsal: [0.55, 0.14] },
    blue: { R: 0.085, prof: [[0, 0.14], [0.15, 0.28], [0.35, 0.6], [0.55, 0.88], [0.7, 0.98], [0.85, 0.9], [0.95, 0.65], [1, 0.2]], hu: 0.8, hd: 0.75, wd: 1.1, flat: 0.45, span: 0.25, flip: 0.1, dorsal: [0.26, 0.015] },
  }[sp];
  const Rm = SPC.R * Lw, zOf = (u) => (u - 0.5) * Lw;
  const Rf = (u) => { const pr = SPC.prof; for (let i = 0; i < pr.length - 1; i++) if (u <= pr[i + 1][0]) return Rm * lerp(pr[i][1], pr[i + 1][1], (u - pr[i][0]) / (pr[i + 1][0] - pr[i][0])); return Rm * pr[pr.length - 1][1]; };
  const ring = 18, hu = (u) => SPC.hu * (1 - SPC.flat * smooth(0.78, 1, u));
  const colAt = (u, x, y, R, k) => {
    const yr = y / Math.max(1e-6, R), xr = Math.abs(x) / Math.max(1e-6, R);
    if (sp === 'orca') {
      if (u > 0.8 && u < 0.9 && yr > 0.0 && yr < 0.5 && xr > 0.5) return C.patch;
      if (u > 0.42 && u < 0.56 && yr > 0.7) return C.saddle;
      if ((u > 0.3 && yr < -0.25) || (u > 0.18 && u < 0.4 && yr < 0.05 && xr > 0.6)) return C.belly;
      return C.back;
    }
    if (yr < -0.4) return u > 0.55 && u < 0.98 ? (k % 2 ? C.groove : C.belly) : C.belly;
    if (sp === 'blue') return noise2(u * 40, k * 0.7, 3) > 0.62 ? C.saddle : C.back;
    return yr < -0.15 && noise2(u * 30, k, 5) > 0.55 ? C.groove : C.back;
  };
  const loft = (list, u0, u1, nU, name) => {
    const pos = [], col = [], c = new THREE.Color();
    const pt = (u, k) => { const a = (k / ring) * Math.PI * 2, R = Rf(u), cs = Math.cos(a), sn = Math.sin(a); return [cs * R * SPC.wd, sn * R * (sn > 0 ? hu(u) : SPC.hd), zOf(u)]; };
    for (let i = 0; i < nU; i++) for (let k = 0; k < ring; k++) {
      const ua = lerp(u0, u1, i / nU), ub = lerp(u0, u1, (i + 1) / nU), A = pt(ua, k), B = pt(ub, k), Cc = pt(ub, k + 1), Dd = pt(ua, k + 1);
      c.set(colAt((ua + ub) / 2, (A[0] + Cc[0]) / 2, (A[1] + Cc[1]) / 2, Rf((ua + ub) / 2), k));
      for (const q of [A, B, Cc, A, Cc, Dd]) { pos.push(q[0], q[1], q[2]); col.push(c.r, c.g, c.b); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    list.push({ g: geo, c: null, n: name });
  };
  // Segments: front body (whale) → tail stock (beats) → flukes
  const wh = P.sub('whale-body', [0, 0, 0]), uJ = 0.45, tl = P.sub('tail', [0, 0, zOf(uJ)], 'whale-body'), fk = P.sub('flukes', [0, 0, zOf(0)], 'tail');
  loft(wh.solid, uJ - 0.02, 1, 22, 'body');
  loft(tl.solid, 0, uJ + 0.03, 14, 'tail-stock');
  { const pts = []; for (let k = 0; k < ring; k++) { const a = (k / ring) * Math.PI * 2; pts.push(Math.cos(a) * Rf(1) * SPC.wd, Math.sin(a) * Rf(1) * 0.8, zOf(1)); } const v = []; for (let k = 0; k < ring; k++) { const k2 = (k + 1) % ring; v.push(0, 0, zOf(1) + Rf(1) * 0.6, pts[k * 3], pts[k * 3 + 1], pts[k * 3 + 2], pts[k2 * 3], pts[k2 * 3 + 1], pts[k2 * 3 + 2]); } wh.solid.push({ g: new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(v, 3)), c: C.back, n: 'snout' }); }
  // Flukes: notched two-lobed planform, extruded thin, dark above / pale below
  const span = SPC.span * Lw, ch = 0.09 * Lw, fs = new THREE.Shape();
  fs.moveTo(0, 0.02 * Lw);
  fs.quadraticCurveTo(-span * 0.3, -ch * 0.1, -span / 2, -ch * 0.95);
  // (a finely scalloped trailing edge)
  const serr = sp === 'humpback' ? 12 : 1;
  for (let i = 1; i <= serr; i++) { const f = i / serr; fs.lineTo(lerp(-span / 2, -span * 0.06, f), -ch * lerp(0.95, 0.62, f) + (i % 2 ? -0.004 * Lw : 0)); }
  fs.lineTo(0, -ch * 0.52);
  for (let i = serr; i >= 1; i--) { const f = i / serr; fs.lineTo(-lerp(-span / 2, -span * 0.06, f) * 1, -ch * lerp(0.95, 0.62, f) + (i % 2 ? -0.004 * Lw : 0)); }
  fs.lineTo(span / 2, -ch * 0.95);
  fs.quadraticCurveTo(span * 0.3, -ch * 0.1, 0, 0.02 * Lw);
  // (0.012 L thick, its edges in the top colour: coloured by the faces' centres, the side walls would alternate dark
  // and pale triangles)
  const th = 0.012 * Lw, flg = new THREE.ExtrudeGeometry(fs, { depth: th, bevelEnabled: false, curveSegments: 6 }).rotateX(Math.PI / 2).translate(0, th / 2, zOf(0) + 0.02 * Lw);
  fk.solid.push({ g: faceTint(flg, (x, y) => (y < -th * 0.4 ? C.flukeUnder : C.fluke)), c: null, n: 'flukes' });
  // Pectoral flippers (subs), dorsal fin, eyes, blowholes, tubercles
  const uF = sp === 'humpback' ? 0.74 : 0.78, fl = SPC.flip * Lw, fr = sp === 'humpback' ? 0.045 * Lw : 0.06 * Lw;
  // (flat flipper blades held out from the sides, drooping a little and swept back: the humpback's long and narrow
  // with a scalloped leading edge, the orca's a broad paddle, the blue whale's slender)
  const flipShape = (s) => {
    const sh = new THREE.Shape(), n = 16, chord = (t) => fr * (sp === 'orca' ? 2.1 : 1.7) * (sp === 'orca' ? Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)))) : (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, 0.2 + t * 1.1))) * (1 - 0.75 * t));
    const lead = [], trail = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, c = chord(t), knob = sp === 'humpback' && i > 1 && i < n ? 0.12 * fr * Math.max(0, Math.sin(t * 40)) : 0;
      lead.push([s * t * fl, c * 0.45 + knob]); trail.push([s * t * fl, -c * 0.55]);
    }
    sh.moveTo(trail[0][0], trail[0][1]);
    for (const q of trail.slice(1)) sh.lineTo(q[0], q[1]);
    for (const q of lead.reverse()) sh.lineTo(q[0], q[1]);
    sh.closePath();
    return sh;
  };
  const fth = 0.012 * Lw;
  for (const [nm, s] of [['flipper-l', 1], ['flipper-r', -1]]) {
    const at = [s * Rf(uF) * 0.85, -Rf(uF) * 0.35, zOf(uF)], f = P.sub(nm, at, 'whale-body');
    const geo = new THREE.ExtrudeGeometry(flipShape(s), { depth: fth, bevelEnabled: false, curveSegments: 4 }).rotateX(Math.PI / 2).translate(0, fth / 2, 0)
      .rotateZ(-s * 0.42).rotateY(s * (sp === 'humpback' ? 0.55 : 0.75)).translate(at[0], at[1], at[2]);
    f.solid.push({ g: geo, c: sp === 'humpback' ? C.fin : C.back, n: 'flipper' });
  }
  const [uD, hD] = SPC.dorsal, dH = hD * Lw, dS = new THREE.Shape();
  dS.moveTo(0.06 * Lw, 0); dS.quadraticCurveTo(0.02 * Lw, dH * 0.6, -0.02 * Lw, dH); dS.quadraticCurveTo(-0.025 * Lw, dH * 0.4, -0.06 * Lw, 0); dS.lineTo(0.06 * Lw, 0);
  const dg = new THREE.ExtrudeGeometry(dS, { depth: 0.012 * Lw + 0.03, bevelEnabled: false, curveSegments: 5 }).rotateY(-Math.PI / 2).translate((0.006 * Lw + 0.015), Rf(uD) * hu(uD) * 0.92, zOf(uD));
  (uD < uJ ? tl : wh).solid.push({ g: dg, c: C.back, n: 'dorsal' });
  for (const s of [-1, 1]) wh.solid.push({ g: new THREE.SphereGeometry(0.008 * Lw, 6, 4).translate(s * Rf(0.88) * 0.93, -Rf(0.88) * 0.05, zOf(0.88)), c: C.eye, n: 'eye' });
  for (const s of [-1, 1]) wh.solid.push({ g: new THREE.CapsuleGeometry(0.005 * Lw, 0.012 * Lw, 2, 5).rotateX(Math.PI / 2).translate(s * 0.007 * Lw, Rf(0.83) * hu(0.83) + 0.002 * Lw, zOf(0.83)), c: C.eye, n: 'blowhole' });
  if (sp === 'humpback') for (let i = 0; i < 14; i++) { const u = 0.86 + (i % 7) * 0.018, s = i < 7 ? 1 : -1; wh.solid.push({ g: new THREE.IcosahedronGeometry(0.008 * Lw, 0).translate(s * (0.15 + (i % 3) * 0.12) * Rf(u), Rf(u) * hu(u) * 0.95, zOf(u)), c: C.back, n: 'tubercle' }); }
  // Water + effects
  const waves = patchWaves(p.swell), Rp = p.pathRadius, D0 = -Math.max(p.depth, Rm * 1.5), T = p.cycle, ySurf = -Rm * 0.62;
  const waterMat = makeWaterMaterial({ waves, opacity: 0.8, foam: C.foam, roughness: 0.12, streakAlong: 0.4, streakAcross: 0.6, cap: [0.5, 0.78], ripples: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] });
  if (p.waterPatch) g.userData.surface = waterPatch(P.sub('water-patch', [0, 0, 0]), g, { r: Rp + Lw * 0.8, depth: -D0 + Lw * 0.45 + 2, waves, water: C.water, deep: C.deep, floor: C.seabed, mat: waterMat });
  const breach = p.behaviour === 'breach', PE = breach ? 2 * T : T, blowAt = 0.41, blow2 = 0.465, flukeAt = 0.5;
  const bhole = [0, Rf(0.83) * hu(0.83) + 0.05, zOf(0.83)];
  const emitters = [blowAt, blow2].map((ph, i) => makeEmitter(`blow-${i + 1}`, {
    count: 50, shape: 'cloud', color: C.spout, opacity: 0.6, gravity: [0, -2, 0], grow: [0.4, 2.4], drag: 1.2, pulse: true, cycle: [PE, 1.1 / PE, 0], timeOffset: -ph * T, parent: 'whale-body', seed: 30 + i,
    spawn: (k, rr) => ({ p: [bhole[0] + (rr() - 0.5) * 0.2, bhole[1], bhole[2]], v: [(rr() - 0.5) * 1.6, 7 + rr() * 5 * Math.sqrt(Lw / 14), (rr() - 0.5) * 1.6], life: 2.6, size: 0.18 * Math.sqrt(Lw / 14) }),
  }));
  emitters.push(makeEmitter('fluke-drips', {
    count: 120, shape: 'streak', color: C.foam, stretch: 0.12, cycle: [PE, 0.11 * T / PE, 0], timeOffset: -(flukeAt + 0.02) * T, parent: 'flukes', seed: 41,
    spawn: (k, rr) => { const x = (rr() - 0.5) * span * 0.95; return { p: [x, -0.02, 0.02 * Lw - ch * (0.6 + rr() * 0.35)], v: [0, -0.3, 0], life: 1.6, size: 0.05 + rr() * 0.04 }; },
  }));
  let splash = null;
  if (breach) {
    splash = makeEmitter('breach-splash', {
      count: 320, shape: 'drop', color: C.foam, stretch: 0.03, floor: -0.5, cycle: [PE, 0.6 / PE, 0], timeOffset: -(T + 0.505 * T), seed: 52,
      spawn: (k, rr) => { const a = rr() * 6.28, d = rr() * Lw * 0.35, up = 5 + rr() * 9 * Math.sqrt(Lw / 14); return { p: [Math.cos(a) * d, 0.1, Math.sin(a) * d], v: [Math.cos(a) * (2 + rr() * 4), up, Math.sin(a) * (2 + rr() * 4)], life: 3.2, size: 0.12 + rr() * 0.22 }; },
    });
    emitters.push(splash);
  }
  // Motion: loop path + dive / breach profile
  const U = waterMat.userData.uniforms, ease = (v) => v * v * (3 - 2 * v), path = (t) => { const a = (p.speed * t) / Rp; return [Rp * Math.sin(a), Rp * Math.cos(a)]; };
  const prof = (ph, br) => {
    if (!br) {
      if (ph < 0.3) return [D0, 0, 0, 0];
      if (ph < 0.4) { const u = ease((ph - 0.3) / 0.1); return [lerp(D0, ySurf, u), 0.25 * Math.sin(Math.PI * u), 0, 0]; }
      if (ph < 0.5) return [ySurf + 0.08 * Math.sin((ph - 0.4) * 50), 0, 0, 0];
      if (ph < 0.62) { const u = (ph - 0.5) / 0.12; return [lerp(ySurf, ySurf - 0.2 * Lw, u * u), -0.75 * ease(u), 0, 22 * Math.sin(Math.PI * Math.min(1, u * 1.3))]; }
      if (ph < 0.75) { const u = ease((ph - 0.62) / 0.13); return [lerp(ySurf - 0.2 * Lw, D0, u), lerp(-0.75, 0, u), 0, 0]; }
      return [D0, 0, 0, 0];
    }
    if (ph < 0.28) return [D0, 0, 0, 0];
    if (ph < 0.38) { const u = ease((ph - 0.28) / 0.1); return [lerp(D0, D0 - 0.25 * Lw, u), lerp(0, 1.25, u), 0, 0]; }
    if (ph < 0.45) { const u = (ph - 0.38) / 0.07, e2 = 1 - (1 - u) * (1 - u); return [lerp(D0 - 0.25 * Lw, 0.35 * Lw, e2), 1.25, 1.2 * u, 0]; }
    if (ph < 0.51) { const u = (ph - 0.45) / 0.06; return [lerp(0.35 * Lw, -0.15 * Lw, u * u), lerp(1.25, 0.35, u), 1.2 + 0.8 * u, 0]; }
    if (ph < 0.7) { const u = ease((ph - 0.51) / 0.19); return [lerp(-0.15 * Lw, D0, u), lerp(0.35, 0, u), lerp(2.0, 0, u), 0]; }
    return [D0, 0, 0, 0];
  };
  let whN = null, last = 0;
  const events = [];
  const ring2 = (x, z, t, a) => { const s = events.length % 4; events.push(1); U.uRip.value[s].set(x, z, t, a); fireRipple(g, x, z, t, a); };
  g.userData.view = { target: [0, -2, 0], radius: Rp * 1.6 + Lw };
  finalize(g, P, p, C, {
    waterMat, emitters,
    tick: (t, dt, drive) => {
      if (!whN) { whN = g.getObjectByName('whale-body'); whN.rotation.order = 'YXZ'; }
      const cyc = Math.floor(t / T), ph = t / T - cyc, br = breach && cyc % 2 === 1;
      const [y, pitch, roll, lift] = prof(ph, br), [x, z] = path(t), [x2, z2] = path(t + 0.2);
      whN.position.set(x, y, z);
      whN.rotation.set(-pitch, Math.atan2(x2 - x, z2 - z), roll);
      const beat = 2 * Math.PI * t / (3.6 * Math.sqrt(Lw / 14) / Math.max(0.4, p.speed / 2.4));
      drive('tail', 10 * Math.sin(beat) + lift); drive('flukes', 14 * Math.sin(beat - 0.9) + lift * 0.6);
      drive('flipper-l', 6 * Math.sin(beat * 0.5) + (br ? 25 * Math.sin(Math.PI * clamp01((ph - 0.38) / 0.2)) : 0)); drive('flipper-r', -6 * Math.sin(beat * 0.5) - (br ? 25 * Math.sin(Math.PI * clamp01((ph - 0.38) / 0.2)) : 0));
      const cross = (a) => last < a && ph >= a;
      if (!br) { if (cross(0.395)) ring2(x, z, t, 0.05); if (cross(0.56)) { const q = path(t - 4); ring2(q[0], q[1], t, 0.06); } }
      else { if (cross(0.42)) ring2(x, z, t, 0.07); if (cross(0.505)) { ring2(x, z, t, 0.09); ring2(x + 2, z - 1, t + 0.15, 0.06); } }
      if (splash && breach && cyc % 2 === 0 && ph > 0.8) { const q = path((cyc + 1) * T + 0.505 * T); splash.position.set(q[0], 0, q[1]); }
      last = ph;
    },
  });
  g.userData.waterSurface = g.userData.surface || null;
  g.userData.matchWaves = (src) => matchWavesFrom(waterMat, src);
  return g;
}
export default createAsset;
