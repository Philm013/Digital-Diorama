/*
 * WATER MILL (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A working grist mill. Water runs along a timber flume on trestles and pours onto an overshot
 * wheel (or a stream drives the paddles of an undershot wheel); the wheel's speed follows the flow
 * (ω = v / r), filled buckets spill as they descend and the tailrace churns away. The
 * stone-and-timber mill house is hollow and enterable: real door and window openings, plank
 * floors, an upper storey, millstones and pit wheel turning on the same axle inside, and glowing
 * windows at night.
 *
 * QUICK START
 *   import { createAsset } from './water-mill.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // wheel on the −X wall; tailrace flows toward +Z
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | whitewashed | redBrick | weathered | autumn — Theme
 *   wheelType           overshot | undershot — Wheel Type
 *   wheelDiameter       3–10 m (default 6) — Wheel Diameter
 *   flow                0.3–3 m/s (default 1.5) — Flow Speed
 *   buildingWidth       6–14 m (default 9) — Mill Width
 *   buildingDepth       5–10 m (default 7) — Mill Depth
 *   floors              1–3 (default 2) — Storeys
 *   roofPitch           0.3–1 (default 0.6) — Roof Pitch
 *   chimney             on/off (default on) — Chimney
 *   signText            text (default "GRIST MILL") — Sign Text
 *   diorama             on/off (default on) — Diorama Sides
 *   chainEnds           on/off (default off) — Standard Ends
 *   seed                1–999 (default 6) — Seed
 *   stone               colour (default #9a8f80) — Stone Colour
 *   stoneDark           colour (default #7a7062) — Stone Dark Colour
 *   timber              colour (default #d9c9a8) — Timber Colour
 *   beam                colour (default #5f4632) — Beam Colour
 *   roof                colour (default #7a4a35) — Roof Colour
 *   wood                colour (default #8a6a45) — Wood Colour
 *   woodDark            colour (default #5f4632) — Wood Dark Colour
 *   iron                colour (default #3a3a3a) — Iron Colour
 *   glass               colour (default #8fb8cc) — Glass Colour
 *   millstone           colour (default #b8b2a6) — Millstone Colour
 *   ground              colour (default #7fa057) — Ground Colour
 *   dirt                colour (default #8a7458) — Dirt Colour
 *   water               colour (default #4f8f9a) — Water Colour
 *   deep                colour (default #2a5f6a) — Deep Colour
 *   foam                colour (default #f4fbff) — Foam Colour
 *   lamp                colour (default #ffcf7a) — Lamp Colour
 *   soil                colour (default #5a4634) — Soil Colour
 *   sign                colour (default #2a2018) — Sign Colour
 *
 * SPECS  14,048 triangles at defaults, 5 materials, 12 draw calls when merged,
 *        20.4 x 12.5 x 25.0 m (W x H x D, real-world scale).
 * PARTS animate: wheel (rotate x 0…360°), door (rotate y 0…-100°), sluice (translate y 0…0.6 m)
 *        detach: wheel, door, flume, roof, interior, sluice, spill
 *        night: windows
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.ports.{inlet, outlet}
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  addCylinder, addWire, noise2, smooth, lerp, mixC, heightField, makeWaterMaterial, waterify, waterRibbon,
  chainEnds, tileEdge, partsBag, makeEmitter, makeGlowMaterial, textWidth, addText, wallGeo, frameOpening,
  paneGeo, wallMtx, addGableRoof, bindModule
} from './kit.mjs';

const BASE = {
  stone: '#9a8f80', stoneDark: '#7a7062', timber: '#d9c9a8', beam: '#5f4632', roof: '#7a4a35', wood: '#8a6a45', woodDark: '#5f4632', iron: '#3a3a3a',
  glass: '#8fb8cc', millstone: '#b8b2a6', ground: '#7fa057', dirt: '#8a7458', water: '#4f8f9a', deep: '#2a5f6a', foam: '#f4fbff', lamp: '#ffcf7a', soil: '#5a4634', sign: '#2a2018',
};
export const COLORWAYS = {
  'default': { ...BASE },
  whitewashed: { ...BASE, stone: '#e8e4dc', stoneDark: '#c8c2b6', timber: '#f2eee6', roof: '#4a4e55' },
  redBrick: { ...BASE, stone: '#a0503a', stoneDark: '#7a3a2a', timber: '#e0d2b8', roof: '#3f3f44' },
  weathered: { ...BASE, stone: '#8a8a84', stoneDark: '#6a6a64', timber: '#a8a090', roof: '#5a5a55', wood: '#7a7468', woodDark: '#5a564e' },
  autumn: { ...BASE, ground: '#a89a50', roof: '#8a3a2a' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  wheelType: { type: 'choice', default: 'overshot', options: ['overshot', 'undershot'], label: 'Wheel Type', affects: 'geometry', describe: 'Overshot: fed from a flume above. Undershot: paddles dip into the stream.' },
  wheelDiameter: { type: 'range', default: 6, min: 3, max: 10, step: 0.25, unit: 'm', label: 'Wheel Diameter', affects: 'geometry', describe: 'Outer diameter of the water wheel.' },
  flow: { type: 'range', default: 1.5, min: 0.3, max: 3, step: 0.05, unit: 'm/s', label: 'Flow Speed', affects: 'geometry', describe: 'Water speed; the wheel turns at v / r.' },
  buildingWidth: { type: 'range', default: 9, min: 6, max: 14, step: 0.5, unit: 'm', label: 'Mill Width', affects: 'geometry', describe: 'Mill house length (X).' },
  buildingDepth: { type: 'range', default: 7, min: 5, max: 10, step: 0.5, unit: 'm', label: 'Mill Depth', affects: 'geometry', describe: 'Mill house depth (Z).' },
  floors: { type: 'range', default: 2, min: 1, max: 3, step: 1, label: 'Storeys', affects: 'geometry', describe: 'Number of storeys (3 m each).' },
  roofPitch: { type: 'range', default: 0.6, min: 0.3, max: 1, step: 0.05, label: 'Roof Pitch', affects: 'geometry', describe: 'Roof rise per half-span.' },
  chimney: { type: 'toggle', default: true, label: 'Chimney', affects: 'geometry', describe: 'Stone chimney on the east gable.' },
  signText: { type: 'text', default: 'GRIST MILL', maxLength: 16, label: 'Sign Text', affects: 'geometry', describe: 'Lettering on the board above the door.' },
  diorama: { type: 'toggle', default: true, label: 'Diorama Sides', affects: 'geometry', describe: 'Cut-away soil and tailrace sections. Off: a short flange so the yard can sit in surrounding terrain.' },
  chainEnds: { type: 'toggle', default: false, label: 'Standard Ends', affects: 'geometry', describe: 'Blend the tailrace ends (and the undershot inlet) to the shared river cross-section so a brook can feed the mill and a river carry its water on seamlessly.' },
  seed: { type: 'range', default: 6, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {
  wheel: { axis: 'x', range: [0, 360], describe: 'Water wheel + axle + pit wheel (auto-driven by the flow).' },
  door: { axis: 'y', range: [0, -100], describe: 'Front door swings inward.' },
  sluice: { type: 'translate', axis: 'y', range: [0, 0.6], describe: 'Flume sluice board.' },
};
export const detach = ['wheel', 'door', 'flume', 'roof', 'interior', 'sluice', 'spill'];
export const night = { windows: { color: '#ffcf7a', intensity: 0.8, distance: 12, offset: [4.5, 1.5, 0], describe: 'Warm lamplight in the windows and a lantern by the door.' } };

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'water-mill';
  const P = partsBag();
  const BW = p.buildingWidth, BD = p.buildingDepth, FH = 3, WH = p.floors * FH, t = 0.45, R = p.wheelDiameter / 2, over = p.wheelType === 'overshot';
  const xw = -t - 0.95, wlT = -0.6, yc = over ? R + wlT + 0.25 : R + wlT - 0.75;
  const X0 = xw - 6, X1 = BW + 4, Z0 = -BD / 2 - 9, Z1 = BD / 2 + 9, TW = X1 - X0, TD = Z1 - Z0, cxT = (X0 + X1) / 2, czT = (Z0 + Z1) / 2;
  const h0 = (x, z) => {
    const d = Math.abs(x - xw);
    let y = 0.02 * (noise2(x * 0.3, z * 0.3, p.seed) - 0.5);
    if (over && z < -R * 0.9) y = Math.max(y, 0);
    const ch = over ? smooth(-R * 1.1, -R * 0.6, z) : 1;
    return lerp(y, wlT - 0.9 + 0.5 * (d / 1.4) ** 2, smooth(1.9, 1.2, d) * ch);
  };
  const h = p.chainEnds ? chainEnds(h0, { axis: 'z', lo: Z0, hi: Z1, c: xw, inlet: over ? null : { w: 3, wl: wlT }, outlet: { w: 3, wl: wlT }, len: 7 }) : h0;
  const terrainCol = (x, y, z) => (y < -0.2 ? C.dirt : x > -0.2 && x < BW + 0.2 && Math.abs(z) < BD / 2 + 1.4 ? C.dirt : C.ground);
  const nx = Math.round(TW / 0.4), nz = Math.round(TD / 0.4);
  P.solid.push({ g: heightField(TW, TD, nx, nz, h, terrainCol, cxT, czT), c: null, n: 'yard' });
  tileEdge(p, P.solid, P.water, TW, TD, nx, nz, h, -2.5, [C.ground, C.soil, C.stoneDark], (x, z) => (Math.abs(x - xw) < 1.6 && (!over || z > -R * 0.9) ? wlT : null), C.deep, cxT, czT);
  // Tailrace / millrace
  const trPts = []; for (let z = over ? -R * 0.85 : Z0; z <= Z1 + 0.01; z += 0.5) trPts.push([xw, wlT, z]);
  P.water.push({ g: waterify(waterRibbon(trPts, 1.5, 5), (x, y, z, s, u) => ({ s, u, speed: p.flow * (over ? 0.8 : 1) * (1 - 0.4 * (u / 1.4) ** 2), foam: 0.06 + 0.75 * smooth(R * 1.6, 0, Math.abs(z - (over ? R * 0.3 : 0))), mode: 2, ripple: 1, bump: over ? 0 : 0.12 * Math.exp(-(((z + 0.4) / 0.6) ** 2)), color: mixC(C.water, C.deep, 0.3) })), c: null, n: 'tailrace' });

  // ── Mill house: storeys of walls with REAL openings, floors, joists, gable roof ──
  const door = { x: BW * 0.55, w: 1.2, h: 2.3 }, winA = (y0) => [{ x: BW * 0.2, y: y0, w: 0.9, h: 1.1 }, { x: BW * 0.85, y: y0, w: 0.9, h: 1.1 }];
  const rise = (BD / 2) * p.roofPitch, glowMat = makeGlowMaterial();
  for (let f = 0; f < p.floors; f++) {
    const y = f * FH, top = f === p.floors - 1, col = f === 0 ? C.stone : C.timber, tt = f === 0 ? t : 0.25;
    const front = wallMtx(0, y, BD / 2 - tt, 0), back = wallMtx(BW, y, -BD / 2 + tt, Math.PI), west = wallMtx(tt, y, -BD / 2, -Math.PI / 2), east = wallMtx(BW - tt, y, BD / 2, Math.PI / 2);
    const fo = f === 0 ? [door, winA(1.0)[0], winA(1.0)[1]] : winA(0.9), bo = winA(f === 0 ? 1.0 : 0.9);
    const fa = Math.min(p.floors - 1, Math.max(0, Math.floor(yc / FH))), ay0 = Math.max(0.15, Math.min(FH - 0.75, yc - y - 0.3));
    const wo = f === fa ? [{ x: BD / 2, y: ay0, w: 0.55, h: 0.6 }] : f === 0 ? [] : [{ x: BD / 2 + 1.6, y: 0.9, w: 0.8, h: 1.0 }];
    const eo = [{ x: BD / 2, y: 0.9, w: 0.8, h: 1.0 }];
    P.solid.push({ g: wallGeo(BW, FH, tt, fo).applyMatrix4(front), c: col, n: 'front-wall' });
    P.solid.push({ g: wallGeo(BW, FH, tt, bo).applyMatrix4(back), c: col, n: 'back-wall' });
    P.solid.push({ g: wallGeo(BD, FH, tt, wo, top ? rise : 0).applyMatrix4(west), c: col, n: 'west-wall' });
    P.solid.push({ g: wallGeo(BD, FH, tt, eo, top ? rise : 0).applyMatrix4(east), c: col, n: 'east-wall' });
    for (const [mtx, list] of [[front, fo], [back, bo], [west, wo], [east, eo]]) for (const o of list) {
      frameOpening(P.solid, o, tt, C.beam, mtx);
      if ((o.y ?? 0) > 0.01) { P.glass.push({ g: paneGeo(o, tt, mtx), c: C.glass, n: 'pane' }); P.glow.push({ g: paneGeo(o, tt * 0.3, mtx), c: C.lamp, n: 'window-glow' }); }
    }
    if (f > 0) for (const s of [-1, 1]) P.solid.push({ g: new THREE.BoxGeometry(0.22, FH, 0.22).translate(s < 0 ? 0.11 : BW - 0.11, y + FH / 2, BD / 2 - 0.11), c: C.beam, n: 'corner-post' });
  }
  const interior = P.sub('interior', [BW / 2, 0, 0]);
  interior.solid.push({ g: new THREE.BoxGeometry(BW - 2 * t, 0.08, BD - 2 * t).translate(BW / 2, 0.04, 0), c: C.wood, n: 'ground-floor' });
  for (let f = 1; f < p.floors; f++) {
    for (let k = 0; k < Math.round(BW / 0.9); k++) interior.solid.push({ g: new THREE.BoxGeometry(0.16, 0.24, BD - 0.4).translate(0.5 + k * 0.9, f * FH - 0.14, 0), c: C.beam, n: 'joist' });
    interior.solid.push({ g: new THREE.BoxGeometry(BW - 2.4, 0.06, BD - 0.5).translate(BW / 2 + 0.9, f * FH + 0.02, 0), c: C.wood, n: 'upper-floor' });
    for (let k = 0; k < 10; k++) interior.solid.push({ g: new THREE.BoxGeometry(0.9, 0.06, 0.28).translate(0.9, (f - 1) * FH + 0.3 * (k + 1), -BD / 2 + 0.8 + k * 0.3), c: C.woodDark, n: 'stair-tread' });
  }
  for (let k = 0; k < Math.round(BW / 1.2); k++) interior.solid.push({ g: new THREE.BoxGeometry(0.14, 0.18, BD - 0.3).translate(0.6 + k * 1.2, WH - 0.09, 0), c: C.beam, n: 'tie-beam' });
  interior.solid.push({ g: new THREE.CylinderGeometry(0.75, 0.75, 0.22, 16).translate(2.2, 1.15, 0), c: C.millstone, n: 'bedstone' });
  interior.solid.push({ g: new THREE.CylinderGeometry(0.75, 0.75, 0.22, 16).translate(2.2, 1.39, 0), c: C.millstone, n: 'runner-stone' });
  interior.solid.push({ g: new THREE.BoxGeometry(2, 1.0, 2).translate(2.2, 0.5, 0), c: C.woodDark, n: 'hurst-frame' });
  interior.solid.push({ g: new THREE.ConeGeometry(0.6, 0.7, 4).rotateX(Math.PI).rotateY(Math.PI / 4).translate(2.2, 2.0, 0), c: C.wood, n: 'hopper' });
  // Roof (ridge along X) + chimney
  const roof = P.sub('roof', [BW / 2, WH, 0]);
  addGableRoof(roof.solid, BW, BD, rise, 0.45, 0.14, C.roof, BW / 2, WH, 0);
  roof.solid.push({ g: new THREE.BoxGeometry(BW + 1, 0.12, 0.25).translate(BW / 2, WH + rise + 0.06, 0), c: C.beam, n: 'ridge' });
  if (p.chimney) roof.solid.push({ g: new THREE.BoxGeometry(0.8, rise + 1.6, 0.8).translate(BW - 1.1, WH + (rise + 1.6) / 2 + 0.3, -BD * 0.15), c: C.stoneDark, n: 'chimney' });
  // Door (hinged on its left jamb) + sign + lantern
  const dr = P.sub('door', [door.x - door.w / 2, 0, BD / 2 - t / 2]);
  dr.solid.push({ g: new THREE.BoxGeometry(door.w - 0.04, door.h - 0.03, 0.06).translate(door.x, door.h / 2, BD / 2 - t / 2), c: C.woodDark, n: 'door-leaf' });
  dr.solid.push({ g: new THREE.BoxGeometry(0.06, 0.06, 0.12).translate(door.x + door.w * 0.35, 1.1, BD / 2 - t / 2 + 0.06), c: C.iron, n: 'handle' });
  const sw = Math.max(1.6, textWidth(p.signText, 0.28) + 0.4);
  P.solid.push({ g: new THREE.BoxGeometry(sw, 0.5, 0.05).translate(door.x, door.h + 0.55, BD / 2 + 0.03), c: C.timber, n: 'signboard' });
  addText(P.solid, p.signText, 0.28, door.x, door.h + 0.41, C.sign, 0.03, new THREE.Matrix4().makeTranslation(0, 0, BD / 2 + 0.07));
  P.glow.push({ g: new THREE.IcosahedronGeometry(0.1, 1).translate(door.x + door.w / 2 + 0.35, 2.2, BD / 2 + 0.15), c: C.lamp, n: 'lantern' });
  // ── Water wheel (+ axle + pit wheel inside), rotating about X ──
  const wheel = P.sub('wheel', [xw, yc, 0]), wd = 1.0, nB = Math.round((2 * Math.PI * R) / 0.5);
  for (const s of [-1, 1]) {
    wheel.solid.push({ g: new THREE.TorusGeometry(R, 0.07, 4, 40).rotateY(Math.PI / 2).translate(xw + (s * wd) / 2, yc, 0), c: C.wood, n: 'rim' });
    wheel.solid.push({ g: new THREE.TorusGeometry(R * 0.82, 0.05, 4, 36).rotateY(Math.PI / 2).translate(xw + (s * wd) / 2, yc, 0), c: C.wood, n: 'shroud' });
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; addWire(wheel.solid, [xw + (s * wd) / 2, yc, 0], [xw + (s * wd) / 2, yc + Math.cos(a) * R, Math.sin(a) * R], C.woodDark, 0.06, 4); }
  }
  for (let k = 0; k < nB; k++) {
    const a = (k / nB) * Math.PI * 2, cy = Math.cos(a), sz = Math.sin(a), rr = over ? R * 0.9 : R * 0.88;
    const b = new THREE.BoxGeometry(wd, 0.05, over ? R * 0.2 : R * 0.26).translate(0, 0, 0).rotateX(-a + (over ? 0.5 : 0)).translate(xw, yc + cy * rr, sz * rr);
    wheel.solid.push({ g: b, c: C.wood, n: over ? 'bucket' : 'paddle' });
  }
  addCylinder(wheel.solid, 0.18, 0.18, wd + 0.3, 10, xw, yc, 0, 0, 0, Math.PI / 2, C.woodDark);
  addCylinder(wheel.solid, 0.11, 0.11, t + 2.2 - xw * 0 + Math.abs(xw), 8, (xw + t + 1.4) / 2, yc, 0, 0, 0, Math.PI / 2, C.iron);
  if (yc > 0.9 && yc < WH - 0.6) {
    wheel.solid.push({ g: new THREE.TorusGeometry(Math.min(1.1, yc - Math.floor(yc / FH) * FH - 0.15), 0.07, 4, 24).rotateY(Math.PI / 2).translate(t + 1.2, yc, 0), c: C.woodDark, n: 'pit-wheel' });
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, rr = Math.min(1.1, yc - Math.floor(yc / FH) * FH - 0.15); wheel.solid.push({ g: new THREE.BoxGeometry(0.14, 0.1, 0.1).translate(t + 1.25, yc + Math.cos(a) * rr, Math.sin(a) * rr), c: C.wood, n: 'cog' }); }
  }
  // ── Flume on trestles (overshot) ──
  const emitters = [];
  const yF = yc + R + 0.55, zEnd = R * 0.18;
  if (over) {
    const fl = P.sub('flume', [xw, yF, 0]), z0 = Z0;
    fl.solid.push({ g: new THREE.BoxGeometry(1.1, 0.08, zEnd - z0).translate(xw, yF - 0.3, (z0 + zEnd) / 2), c: C.wood, n: 'flume-bottom' });
    for (const s of [-1, 1]) fl.solid.push({ g: new THREE.BoxGeometry(0.08, 0.45, zEnd - z0).translate(xw + s * 0.55, yF - 0.1, (z0 + zEnd) / 2), c: C.wood, n: 'flume-side' });
    for (let z = z0 + 1; z < -R * 0.9; z += 2.6) {
      const gy = h(xw, z);
      for (const s of [-1, 1]) addWire(fl.solid, [xw + s * 0.9, gy, z], [xw + s * 0.45, yF - 0.34, z], C.woodDark, 0.08, 4);
      addWire(fl.solid, [xw - 0.7, (gy + yF) / 2, z], [xw + 0.7, (gy + yF) / 2, z], C.woodDark, 0.05, 4);
    }
    const fpts = []; for (let z = z0; z <= zEnd + 0.01; z += 0.5) fpts.push([xw, yF - 0.18, z]);
    fl.water.push({ g: waterify(waterRibbon(fpts, 0.5, 3), (x, y, z, s, u) => ({ s, u, speed: p.flow, foam: 0.05 + 0.4 * smooth(zEnd - 2, zEnd, z), mode: 2, color: mixC(C.water, C.deep, 0.2) })), c: null, n: 'flume-water' });
    const sl = P.sub('sluice', [xw, yF, z0 + 2]);
    sl.solid.push({ g: new THREE.BoxGeometry(1.0, 0.7, 0.06).translate(xw, yF + 0.05, z0 + 2), c: C.woodDark, n: 'sluice-board' });
    const tf = Math.sqrt((2 * 0.7) / 9.81), pour = [];
    for (let i = 0; i <= 8; i++) { const tt = (i / 8) * tf; pour.push([xw, yF - 0.18 - 0.5 * 9.81 * tt * tt, zEnd + p.flow * tt]); }
    P.water.push({ g: waterify(waterRibbon(pour, 0.45, 3, [1, 0, 0]), (x, y, z, s, u) => ({ s, u, speed: p.flow + 1.5, mode: 1, foam: 0.5, color: mixC(C.water, C.foam, 0.2) })), c: null, n: 'pour' });
    emitters.push(makeEmitter('spill', {
      count: 140, shape: 'drop', color: C.water, stretch: 0.05, floor: wlT, seed: p.seed,
      spawn: (i, rr) => { const a = 0.6 + rr() * 1.9, x = xw + (rr() - 0.5) * wd * 0.9; return { p: [x, yc + Math.cos(a) * R * 0.88, Math.sin(a) * R * 0.88], v: [0, -(p.flow / R) * R * Math.sin(a) * 0.6, (p.flow / R) * R * Math.cos(a) * 0.6], life: 1.6, size: 0.05 + rr() * 0.06 }; },
    }));
  } else {
    emitters.push(makeEmitter('spill', {
      count: 90, shape: 'drop', color: C.foam, stretch: 0.04, floor: wlT, seed: p.seed,
      spawn: (i, rr) => ({ p: [xw + (rr() - 0.5) * wd, wlT + 0.05, (rr() - 0.3) * R * 0.8], v: [(rr() - 0.5) * 0.6, 0.8 + rr() * 1.4, 0.6 + rr()], life: 0.6, size: 0.04 + rr() * 0.05 }),
    }));
  }
  const waterMat = makeWaterMaterial({ opacity: 0.86, foam: C.foam, streakAlong: 0.5, streakAcross: 1.5, roughness: 0.1 });
  const omega = ((over ? 1 : -1) * p.flow * (over ? 0.8 : 1)) / R;
  return finalize(g, P, p, C, {
    waterMat, glowMat, emitters,
    tick: (t, dt, drive) => drive('wheel', ((omega * t * 180) / Math.PI) % 360),
    ground: { h, col: terrainCol, w: TW, d: TD, cx: cxT, cz: czT },
    ports: { inlet: { position: [xw, over ? yF - 0.18 : wlT, Z0], direction: [0, 0, 1], width: over ? 1.0 : 3, level: over ? yF - 0.18 : wlT, s: 0 }, outlet: { position: [xw, wlT, Z1], direction: [0, 0, 1], width: 3, level: wlT, s: 0 } },
  });
}
export default createAsset;
