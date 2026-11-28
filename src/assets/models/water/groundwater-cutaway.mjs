/*
 * GROUNDWATER CUT-AWAY (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * An educational block diagram of the hidden half of the water cycle: rain soaks through the
 * unsaturated zone down to the water table, groundwater creeps through the saturated aquifer
 * toward a gaining river, a confining clay layer seals a deeper confined aquifer above bedrock, a
 * pumped well draws the water table into a cone of depression and a spring seeps out where the
 * table meets the hillside. Animated recharge, flow and labelled layers.
 *
 * QUICK START
 *   import { createAsset } from './groundwater-cutaway.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // the cut faces +Z; labels use the built-in stroke font (text param `title` goes on the sign)
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | arid | karst | tropical | blueprint — Theme
 *   width               20–80 m (default 40) — Block Width
 *   depth               10–40 m (default 18) — Block Depth
 *   waterTable          0.2–0.8 (default 0.45) — Water Table Depth
 *   pumping             0–1 (default 0.5) — Well Pumping
 *   recharge            0–1 (default 0.6) — Rain Recharge
 *   labels              on/off (default on) — Labels
 *   title               text (default "AQUIFER") — Sign Text
 *   chainEnds           on/off (default off) — Standard River Inlet
 *   seed                1–999 (default 2) — Seed
 *   grass               colour (default #7fa457) — Grass Colour
 *   grassDark           colour (default #5f8a3f) — Grass Dark Colour
 *   soil                colour (default #6a4e36) — Soil Colour
 *   vadose              colour (default #b08a5a) — Vadose Colour
 *   aquifer             colour (default #8aa0a8) — Aquifer Colour
 *   saturated           colour (default #5f8fb0) — Saturated Colour
 *   clay                colour (default #7a7f6a) — Clay Colour
 *   confined            colour (default #4f7a9a) — Confined Colour
 *   bedrock             colour (default #55504c) — Bedrock Colour
 *   table               colour (default #2f9fe0) — Table Colour
 *   water               colour (default #3f9ab0) — Water Colour
 *   deep                colour (default #1f5f78) — Deep Colour
 *   foam                colour (default #f2fbff) — Foam Colour
 *   label               colour (default #1d2230) — Label Colour
 *   pipe                colour (default #8a9096) — Pipe Colour
 *   roof                colour (default #8a3a2a) — Roof Colour
 *   wall                colour (default #d8cbb0) — Wall Colour
 *   glass               colour (default #9fd0e8) — Glass Colour
 *   cloud               colour (default #f2f4f6) — Cloud Colour
 *   drop                colour (default #4fb0e8) — Drop Colour
 *
 * SPECS  15,570 triangles at defaults, 7 materials, 10 draw calls when merged,
 *        40.0 x 29.8 x 18.3 m (W x H x D, real-world scale).
 * PARTS animate: water shader, particles
 *        detach: labels, pumphouse, cloud, flow
 *        night: pumphouse
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  addCylinder, addWire, rng, noise2, fbm2, smooth, lerp, mixC, heightField, makeWaterMaterial, waterify,
  waterRibbon, chainEnds, partsBag, makeEmitter, makeGlowMaterial, addLathe, textWidth, addText, wallGeo,
  frameOpening, paneGeo, wallMtx, addGableRoof, bindModule
} from './kit.mjs';

const BASE = {
  grass: '#7fa457', grassDark: '#5f8a3f', soil: '#6a4e36', vadose: '#b08a5a', aquifer: '#8aa0a8', saturated: '#5f8fb0', clay: '#7a7f6a', confined: '#4f7a9a',
  bedrock: '#55504c', table: '#2f9fe0', water: '#3f9ab0', deep: '#1f5f78', foam: '#f2fbff', label: '#1d2230', pipe: '#8a9096', roof: '#8a3a2a', wall: '#d8cbb0', glass: '#9fd0e8', cloud: '#f2f4f6', drop: '#4fb0e8',
};
export const COLORWAYS = {
  'default': { ...BASE },
  arid: { ...BASE, grass: '#b8a46a', grassDark: '#9a8a55', vadose: '#c89a62', aquifer: '#a89a80', saturated: '#7f9aa8' },
  karst: { ...BASE, aquifer: '#b8b4a6', saturated: '#7fa8c0', clay: '#8a8a7a', bedrock: '#9a958c' },
  tropical: { ...BASE, grass: '#4f9a40', grassDark: '#3f7a32', vadose: '#a0603a', soil: '#7a3f28' },
  blueprint: { ...BASE, grass: '#3f5f8a', grassDark: '#2f4f7a', soil: '#22344f', vadose: '#2a4268', aquifer: '#304f78', saturated: '#3f6f9f', clay: '#2a3a55', confined: '#4f80b0', bedrock: '#1a2438', label: '#e8f0ff' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  width: { type: 'range', default: 40, min: 20, max: 80, step: 1, unit: 'm', label: 'Block Width', affects: 'geometry', describe: 'Block length along X (hill → river).' },
  depth: { type: 'range', default: 18, min: 10, max: 40, step: 1, unit: 'm', label: 'Block Depth', affects: 'geometry', describe: 'Block extent along Z.' },
  waterTable: { type: 'range', default: 0.45, min: 0.2, max: 0.8, step: 0.01, label: 'Water Table Depth', affects: 'geometry', describe: 'How deep the water table lies (fraction of the upper aquifer).' },
  pumping: { type: 'range', default: 0.5, min: 0, max: 1, step: 0.05, label: 'Well Pumping', affects: 'geometry', describe: 'Depth of the cone of depression around the well.' },
  recharge: { type: 'range', default: 0.6, min: 0, max: 1, step: 0.05, label: 'Rain Recharge', affects: 'geometry', describe: 'Rain and infiltration intensity.' },
  labels: { type: 'toggle', default: true, label: 'Labels', affects: 'geometry', describe: 'Layer names on the cut face.' },
  title: { type: 'text', default: 'AQUIFER', maxLength: 14, label: 'Sign Text', affects: 'geometry', describe: 'Text on the signboard by the well.' },
  chainEnds: { type: 'toggle', default: false, label: 'Standard River Inlet', affects: 'geometry', describe: 'The gaining river enters at the back (−Z) in the shared river cross-section, so a brook or reach can feed it seamlessly.' },
  seed: { type: 'range', default: 2, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {};
export const detach = ['labels', 'pumphouse', 'cloud', 'flow'];
export const night = { pumphouse: { color: '#ffcf80', intensity: 0.6, distance: 10, offset: [0, 2, 0], describe: 'Pump-house window light.' } };

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'groundwater-cutaway';
  const P = partsBag();
  const W = p.width, D = p.depth, hw = W / 2, hd = D / 2, r = rng(p.seed);
  const xr = hw * 0.62, xw = -hw * 0.18, bottom = -14;
  const ground0 = (x, z) => 4.5 * (1 - smooth(-hw, hw * 0.9, x)) + 0.6 + (fbm2(x * 0.08, z * 0.08, p.seed, 3) - 0.5) * 0.6 - 1.8 * Math.exp(-(((x - xr) / 2.6) ** 2));
  const riverLvl = ground0(xr, 0) + 0.9;
  const ground = p.chainEnds ? chainEnds(ground0, { axis: 'z', lo: -hd, hi: hd, c: xr, inlet: { w: 4, wl: riverLvl }, len: 8 }) : ground0;
  const clayTop = (x) => -5.5 - x * 0.03 + Math.sin(x * 0.15) * 0.3, clayBot = (x) => clayTop(x) - 1.6, rockTop = (x) => -10.5 + Math.sin(x * 0.11 + 1) * 0.5;
  const wt = (x) => {
    const g0 = ground(x, hd), base = lerp(g0, clayTop(x), p.waterTable) * 0.55 + riverLvl * 0.45 + (riverLvl - lerp(g0, clayTop(x), p.waterTable)) * smooth(xr - 8, xr, x) * 0.55;
    return Math.min(g0 - 0.05, base - p.pumping * 3.2 * Math.exp(-(((x - xw) / 5) ** 2)));
  };
  const n = Math.max(40, Math.round(W / 0.6)), nz = Math.max(20, Math.round(D / 0.6));
  const terrainCol = (x, y, z, sl) => (Math.abs(x - xr) < 3 ? C.soil : noise2(x * 0.3, z * 0.3, p.seed) > 0.5 ? C.grass : C.grassDark);
  P.solid.push({ g: heightField(W, D, n, nz, ground, terrainCol), c: null, n: 'surface' });
  // Cut faces: layer bands between the same layer curves on every side
  const layers = [[(x, z) => ground(x, z), (x, z) => ground(x, z) - 0.5, C.soil], [(x, z) => ground(x, z) - 0.5, (x) => wt(x), C.vadose], [(x) => wt(x), clayTop, C.saturated], [clayTop, clayBot, C.clay], [clayBot, rockTop, C.confined], [rockTop, () => bottom, C.bedrock]];
  const edges = [Array.from({ length: n + 1 }, (_, i) => [-hw + (i / n) * W, hd]), Array.from({ length: n + 1 }, (_, i) => [-hw + (i / n) * W, -hd]), Array.from({ length: nz + 1 }, (_, j) => [hw, -hd + (j / nz) * D]), Array.from({ length: nz + 1 }, (_, j) => [-hw, -hd + (j / nz) * D])];
  for (const e of edges) {
    for (const [top, bot, hex] of layers) {
      const v = [];
      for (let k = 0; k < e.length - 1; k++) {
        const [ax, az] = e[k], [bx, bz] = e[k + 1];
        const at = top(ax, az), ab = Math.min(at, bot(ax, az)), bt = top(bx, bz), bb = Math.min(bt, bot(bx, bz));
        if (at - ab < 1e-3 && bt - bb < 1e-3) continue;
        v.push(ax, at, az, bx, bt, bz, bx, bb, bz, ax, at, az, bx, bb, bz, ax, ab, az);
      }
      if (v.length) { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); P.solid.push({ g: gg, c: hex, n: 'stratum' }); }
    }
  }
  P.solid.push({ g: new THREE.PlaneGeometry(W, D).rotateX(Math.PI / 2).translate(0, bottom, 0), c: C.bedrock, n: 'base' });
  // Water-table line and pore dots on the front face
  for (let i = 0; i < n; i++) {
    const x0 = -hw + (i / n) * W, x1 = x0 + W / n, y0 = wt(x0), y1 = wt(x1), l = Math.hypot(x1 - x0, y1 - y0);
    P.solid.push({ g: new THREE.BoxGeometry(l, 0.12, 0.06).rotateZ(Math.atan2(y1 - y0, x1 - x0)).translate((x0 + x1) / 2, (y0 + y1) / 2, hd + 0.03), c: C.table, n: 'water-table' });
  }
  for (let i = 0; i < 260; i++) {
    const x = -hw + 0.3 + r() * (W - 0.6), confined = r() < 0.4, yT = confined ? clayBot(x) : wt(x), yB = confined ? rockTop(x) : clayTop(x);
    if (yT - yB < 0.3) continue;
    P.solid.push({ g: new THREE.CircleGeometry(0.06 + r() * 0.06, 6).translate(x, yB + r() * (yT - yB), hd + 0.02), c: C.drop, n: 'pore' });
  }
  // River (gaining stream) along Z
  const rp = []; for (let z = -hd; z <= hd + 0.01; z += 0.8) rp.push([xr, riverLvl, z]);
  P.water.push({ g: waterify(waterRibbon(rp, 2.4, 5), (x, y, z, s, u) => ({ s, u, speed: 0.7 * (1 - 0.5 * (u / 2.4) ** 2), foam: 0.03, mode: 2, ripple: 1, color: mixC(C.water, C.deep, 0.3) })), c: null, n: 'river' });
  const sect = []; for (let k = 0; k < 8; k++) { const x0 = xr - 2.4 + k * 0.6, x1 = x0 + 0.6; const b0 = Math.min(riverLvl, ground(x0, hd)), b1 = Math.min(riverLvl, ground(x1, hd)); sect.push(x0, riverLvl, hd + 0.01, x1, riverLvl, hd + 0.01, x1, b1, hd + 0.01, x0, riverLvl, hd + 0.01, x1, b1, hd + 0.01, x0, b0, hd + 0.01); }
  const gs = new THREE.BufferGeometry(); gs.setAttribute('position', new THREE.Float32BufferAttribute(sect, 3));
  P.water.push({ g: waterify(gs, () => ({ color: C.deep })), c: null, n: 'river-section' });
  // Well: half-section casing in the cut face, water column inside at the drawn-down level
  const gw = ground(xw, hd - 0.4), wellBot = clayTop(xw) + 0.3;
  addLathe(P.solid, [[0.32, wellBot], [0.32, gw + 0.6], [0.26, gw + 0.6], [0.26, wellBot]], 12, C.pipe, xw, 0, hd - 0.02, -Math.PI / 2, Math.PI);
  P.water.push({ g: waterify(new THREE.PlaneGeometry(0.5, wt(xw) - wellBot).translate(xw, (wt(xw) + wellBot) / 2, hd + 0.025), () => ({ color: C.table })), c: null, n: 'well-water' });
  // Pump house (hollow: door + window openings, interior floor)
  const ph = P.sub('pumphouse', [xw, gw, hd - 2.6]), bx = xw - 1.4, bz = hd - 3.8, bw = 2.8, bd = 2.4, bh = 2.4, t = 0.12;
  const door = { x: bw / 2, w: 0.9, h: 2.0 }, win = { x: bd / 2, y: 1.0, w: 0.7, h: 0.6 };
  const fm = wallMtx(bx, gw, bz + bd, 0), bm = wallMtx(bx + bw, gw, bz, Math.PI), lm = wallMtx(bx, gw, bz, -Math.PI / 2), rm = wallMtx(bx + bw, gw, bz + bd, Math.PI / 2);
  ph.solid.push({ g: wallGeo(bw, bh, t, [door]).applyMatrix4(fm), c: C.wall, n: 'front-wall' });
  ph.solid.push({ g: wallGeo(bw, bh, t, []).applyMatrix4(bm), c: C.wall, n: 'back-wall' });
  ph.solid.push({ g: wallGeo(bd, bh, t, [win], 0.8).applyMatrix4(lm), c: C.wall, n: 'gable-wall' });
  ph.solid.push({ g: wallGeo(bd, bh, t, [win], 0.8).applyMatrix4(rm), c: C.wall, n: 'gable-wall' });
  frameOpening(ph.solid, door, t, C.roof, fm); frameOpening(ph.solid, win, t, C.roof, lm); frameOpening(ph.solid, win, t, C.roof, rm);
  ph.glass.push({ g: paneGeo(win, t, lm), c: C.glass, n: 'pane' }); ph.glass.push({ g: paneGeo(win, t, rm), c: C.glass, n: 'pane' });
  ph.solid.push({ g: new THREE.BoxGeometry(bw, 0.1, bd).translate(bx + bw / 2, gw + 0.05, bz + bd / 2), c: C.soil, n: 'floor' });
  addGableRoof(ph.solid, bw, bd, 0.8, 0.3, 0.1, C.roof, bx + bw / 2, gw + bh, bz + bd / 2);
  addCylinder(ph.solid, 0.25, 0.3, 1.0, 8, xw, gw + 0.5, bz + bd / 2, 0, 0, 0, C.pipe);
  const glowMat = makeGlowMaterial();
  ph.glow.push({ g: paneGeo(win, t * 0.4, lm), c: 0xffcf80, n: 'window-light' });
  // Sign with the title text
  const sx = xw + 3, sz = hd - 1.2, sy = ground(sx, sz);
  addWire(P.solid, [sx, sy, sz], [sx, sy + 2.2, sz], C.soil, 0.06, 5);
  P.solid.push({ g: new THREE.BoxGeometry(Math.max(1.6, textWidth(p.title, 0.32) + 0.4), 0.6, 0.06).translate(sx, sy + 2.1, sz), c: C.wall, n: 'sign' });
  addText(P.solid, p.title, 0.32, sx, sy + 1.95, C.label, 0.03, new THREE.Matrix4().makeTranslation(0, 0, sz + 0.05));
  if (p.labels) {
    const lb = P.sub('labels', [0, 0, 0]), at = (txt, x, y) => addText(lb.solid, txt, 0.42, x, y, C.label, 0.03, new THREE.Matrix4().makeTranslation(0, 0, hd + 0.06));
    at('UNSATURATED ZONE', -hw * 0.55, (ground(-hw * 0.55, hd) + wt(-hw * 0.55)) / 2 - 0.2);
    at('WATER TABLE', -hw * 0.55 + 7, wt(-hw * 0.55 + 7) + 0.25);
    at('AQUIFER', hw * 0.15, (wt(hw * 0.15) + clayTop(hw * 0.15)) / 2 - 0.2);
    at('CLAY', -hw * 0.3, (clayTop(-hw * 0.3) + clayBot(-hw * 0.3)) / 2 - 0.2);
    at('CONFINED AQUIFER', -hw * 0.25, (clayBot(-hw * 0.25) + rockTop(-hw * 0.25)) / 2 - 0.2);
    at('BEDROCK', 0, (rockTop(0) + bottom) / 2);
    at('WELL', xw - 0.9, wellBot - 0.7);
  }
  // Rain cloud
  const cl = P.sub('cloud', [-hw * 0.45, 13, 0]);
  for (let i = 0; i < 9; i++) cl.solid.push({ g: new THREE.IcosahedronGeometry(1.6 + r() * 1.4, 1).scale(1.3, 0.7, 1).translate(-hw * 0.45 + (r() - 0.5) * 9, 13 + r() * 1.2, (r() - 0.5) * 5), c: C.cloud, n: 'cloud' });
  // Animated water: rain → infiltration → groundwater flow (to river and into the well)
  const emitters = [], flowOK = (x) => wt(x) - clayTop(x) > 0.6;
  emitters.push(makeEmitter('rain', { count: Math.round(160 * p.recharge) + 1, shape: 'streak', color: C.drop, stretch: 2.0, seed: p.seed, emit: p.recharge > 0 ? 1 : 0,
    spawn: (i, rr) => { const x = -hw * 0.45 + (rr() - 0.5) * 12, z = (rr() - 0.5) * D * 0.8, y0 = 12.2, gy = ground(x, z); return { p: [x, y0, z], v: [0, -8, 0], life: (y0 - gy) / 8 + 0.02, size: 0.03 }; } }));
  emitters.push(makeEmitter('infiltration', { count: Math.round(70 * p.recharge) + 1, shape: 'drop', color: C.drop, gravity: [0, 0, 0], seed: p.seed + 1, emit: p.recharge > 0 ? 1 : 0,
    spawn: (i, rr) => { const x = -hw + 1 + rr() * (xr - 4 + hw), y0 = ground(x, hd) - 0.4, sp = 0.35 + rr() * 0.2; return { p: [x, y0, hd + 0.05], v: [0, -sp, 0], life: Math.max(0.2, (y0 - wt(x)) / sp), size: 0.07 }; } }));
  emitters.push(makeEmitter('flow', { count: 120, shape: 'streak', color: C.table, gravity: [0, 0, 0], stretch: 6, seed: p.seed + 2,
    spawn: (i, rr) => {
      const toWell = i % 3 === 0, x0 = toWell ? xw + (rr() < 0.5 ? -9 : 9) : -hw + 1 + rr() * (xr - hw - 2 + hw * 0.4);
      const yy = (x) => lerp(wt(x), clayTop(x), 0.2 + rr() * 0.6), y0 = yy(x0), x1 = toWell ? xw : xr - 1, sp = 0.6;
      const dx = x1 - x0, dy = (toWell ? wellBot + 0.4 : yy(x1)) - y0, L = Math.hypot(dx, dy) || 1;
      return { p: [x0, flowOK(x0) ? y0 : clayTop(x0) + 0.4, hd + 0.06], v: [(dx / L) * sp, (dy / L) * sp, 0], life: L / sp, size: 0.05 };
    } }));
  const waterMat = makeWaterMaterial({ opacity: 0.86, foam: C.foam, streakAlong: 0.4, streakAcross: 1, roughness: 0.1 });
  g.userData.view = { target: [0, -3, 0], radius: W * 1.15 };
  return finalize(g, P, p, C, {
    waterMat, glowMat, emitters, ground: { h: ground, col: terrainCol, w: W, d: D },
    ports: p.chainEnds ? { inlet: { position: [xr, riverLvl, -hd], direction: [0, 0, 1], width: 4, level: riverLvl, s: 0 } } : undefined,
  });
}
export default createAsset;
