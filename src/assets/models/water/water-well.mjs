/*
 * VILLAGE WELL (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A stone well with a shingled roof and windlass. On its cycle the crank turns, the rope pays out
 * and the bucket drops down the shaft, splashes into the water far below (a ripple ring spreads
 * across the dark surface), then winds back up dripping all the way.
 *
 * QUICK START
 *   import { createAsset } from './water-well.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // look straight down the shaft to see the water and the ripples
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | brick | whitewashed | mossy | desert — Theme
 *   radius              0.5–1.6 m (default 0.9) — Shaft Radius
 *   wellDepth           2–20 m (default 6) — Water Depth
 *   showRoof            on/off (default on) — Roof
 *   automatic           on/off (default on) — Draw Water
 *   cycleTime           6–30 s (default 12) — Cycle Time
 *   diorama             on/off (default on) — Diorama Sides
 *   seed                1–999 (default 5) — Seed
 *   stone               colour (default #9a9284) — Stone Colour
 *   stoneDark           colour (default #7a7266) — Stone Dark Colour
 *   mortar              colour (default #b8b0a0) — Mortar Colour
 *   wood                colour (default #8a6a45) — Wood Colour
 *   woodDark            colour (default #5f4632) — Wood Dark Colour
 *   roof                colour (default #6a4a35) — Roof Colour
 *   rope                colour (default #c8b088) — Rope Colour
 *   iron                colour (default #3a3a3a) — Iron Colour
 *   bucket              colour (default #9a7a52) — Bucket Colour
 *   water               colour (default #2f5a62) — Water Colour
 *   deep                colour (default #132a30) — Deep Colour
 *   foam                colour (default #e8f4f6) — Foam Colour
 *   ground              colour (default #8aa060) — Ground Colour
 *   soil                colour (default #5a4634) — Soil Colour
 *
 * SPECS  5,092 triangles at defaults, 3 materials, 7 draw calls when merged,
 *        6.0 x 9.6 x 6.0 m (W x H x D, real-world scale).
 * PARTS animate: windlass (rotate x 0…360°), bucket (translate y -20…0 m), rope (scale y 0.05…25)
 *        detach: roof, windlass, bucket, rope
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  addCylinder, addWire, rng, noise2, mixC, faceTint, heightField, makeWaterMaterial, waterify, waterDisc,
  tileEdge, partsBag, makeEmitter, addLathe, addGableRoof, bindModule
} from './kit.mjs';

const BASE = {
  stone: '#9a9284', stoneDark: '#7a7266', mortar: '#b8b0a0', wood: '#8a6a45', woodDark: '#5f4632', roof: '#6a4a35', rope: '#c8b088', iron: '#3a3a3a',
  bucket: '#9a7a52', water: '#2f5a62', deep: '#132a30', foam: '#e8f4f6', ground: '#8aa060', soil: '#5a4634',
};
export const COLORWAYS = {
  'default': { ...BASE },
  brick: { ...BASE, stone: '#a8583f', stoneDark: '#884530', mortar: '#d0c0a8' },
  whitewashed: { ...BASE, stone: '#e8e4dc', stoneDark: '#c8c4bc', roof: '#3f5f8a', wood: '#6a5a4a' },
  mossy: { ...BASE, stone: '#7a826e', stoneDark: '#5a6450', ground: '#6f8f4f', roof: '#4a5a3a' },
  desert: { ...BASE, stone: '#d0b088', stoneDark: '#b09068', ground: '#d8c090', roof: '#8a6a4a' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  radius: { type: 'range', default: 0.9, min: 0.5, max: 1.6, step: 0.05, unit: 'm', label: 'Shaft Radius', affects: 'geometry', describe: 'Inside radius of the well.' },
  wellDepth: { type: 'range', default: 6, min: 2, max: 20, step: 0.5, unit: 'm', label: 'Water Depth', affects: 'geometry', describe: 'Rim to water surface.' },
  showRoof: { type: 'toggle', default: true, label: 'Roof', affects: 'geometry', describe: 'Shingled roof on posts over the windlass.' },
  automatic: { type: 'toggle', default: true, label: 'Draw Water', affects: 'geometry', describe: 'Run the lower-and-raise bucket cycle.' },
  cycleTime: { type: 'range', default: 12, min: 6, max: 30, step: 0.5, unit: 's', label: 'Cycle Time', affects: 'geometry', describe: 'Seconds per draw.' },
  diorama: { type: 'toggle', default: true, label: 'Diorama Sides', affects: 'geometry', describe: 'Cut-away soil sections. Off: a short flange so the patch can sit in surrounding terrain.' },
  seed: { type: 'range', default: 5, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {
  windlass: { axis: 'x', range: [0, 360], describe: 'Crank and drum rotation.' },
  bucket: { type: 'translate', axis: 'y', range: [-20, 0], describe: 'Bucket depth below its rest position.' },
  rope: { type: 'scale', axis: 'y', range: [0.05, 25], describe: 'Rope length (scale).' },
};
export const detach = ['roof', 'windlass', 'bucket', 'rope'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'water-well';
  const P = partsBag();
  const ri = p.radius, ro = ri + 0.35, rimY = 0.85, D = p.wellDepth, wy = rimY - D, r = rng(p.seed), S = 6;
  const h = (x, z) => (Math.hypot(x, z) < ro + 0.05 ? -0.05 : 0.04 * (noise2(x * 0.8, z * 0.8, p.seed) - 0.5));
  const terrainCol = (x, y, z) => (Math.hypot(x, z) < ro + 0.6 ? C.stoneDark : noise2(x, z, p.seed) > 0.5 ? C.ground : mixC(C.ground, C.soil, 0.3).getHex());
  P.solid.push({ g: heightField(S, S, 40, 40, h, terrainCol), c: null, n: 'ground' });
  tileEdge(p, P.solid, null, S, S, 40, 40, h, Math.min(-2, wy - 1.2), [C.ground, C.soil, C.stoneDark]);
  const ring = new THREE.LatheGeometry([[ri, wy - 1], [ri, rimY], [ri + 0.05, rimY + 0.08], [ro, rimY + 0.08], [ro, 0], [ro + 0.06, -0.05]].map((q) => new THREE.Vector2(q[0], q[1])), 20);
  P.solid.push({ g: faceTint(ring, (x, y, z) => { const b = Math.floor((y - wy) / 0.3), a = Math.floor((Math.atan2(z, x) + Math.PI) * 3 + (b % 2) * 0.5); return (a + b) % 3 === 0 ? C.stoneDark : (a + b) % 3 === 1 ? C.stone : C.mortar; }), c: null, n: 'well-wall' });
  P.water.push({ g: waterify(waterDisc(ri + 0.02, 6, wy), (x, y, z) => ({ s: x, u: z, speed: 0, ripple: 1, color: mixC(C.water, C.deep, 0.5) })), c: null, n: 'well-water' });
  // Posts, crossbeam, roof
  const postX = ro + 0.1, hb = 2.3;
  for (const sx of [-1, 1]) { P.solid.push({ g: new THREE.BoxGeometry(0.16, hb + 0.2, 0.16).translate(sx * postX, (hb + 0.2) / 2, 0), c: C.wood, n: 'post' }); }
  if (p.showRoof) {
    const rf = P.sub('roof', [0, hb, 0]);
    rf.solid.push({ g: new THREE.BoxGeometry(postX * 2 + 0.3, 0.14, 0.18).translate(0, hb + 0.27, 0), c: C.woodDark, n: 'ridge-beam' });
    addGableRoof(rf.solid, postX * 2 + 0.7, ro * 2 + 0.6, 0.7, 0.15, 0.08, C.roof, 0, hb + 0.2, 0);
  }
  // Windlass (drum + crank) — rotates about X
  const ay = 1.55, drumR = 0.1, wl = P.sub('windlass', [0, ay, 0]);
  addCylinder(wl.solid, drumR, drumR, postX * 2 + 0.3, 10, 0, ay, 0, 0, 0, Math.PI / 2, C.woodDark);
  addCylinder(wl.solid, drumR + 0.04, drumR + 0.04, 0.5, 10, 0, ay, 0, 0, 0, Math.PI / 2, C.rope);
  addWire(wl.solid, [postX + 0.2, ay, 0], [postX + 0.2, ay + 0.35, 0], C.iron, 0.025, 5);
  addWire(wl.solid, [postX + 0.2, ay + 0.35, 0], [postX + 0.45, ay + 0.35, 0], C.iron, 0.03, 5);
  // Rope (scaled in Y from the drum) and bucket (translated)
  const rope = P.sub('rope', [0, ay - drumR, -drumR - 0.03]);
  rope.solid.push({ g: new THREE.CylinderGeometry(0.015, 0.015, 1, 4).translate(0, ay - drumR - 0.5, -drumR - 0.03), c: C.rope, n: 'rope' });
  const restY = ay - drumR - 0.6, bk = P.sub('bucket', [0, restY, -drumR - 0.03]);
  addLathe(bk.solid, [[0, -0.3], [0.17, -0.3], [0.2, 0], [0.19, 0.01], [0.16, -0.27], [0, -0.27]], 10, C.bucket, 0, restY, -drumR - 0.03);
  bk.solid.push({ g: new THREE.TorusGeometry(0.2, 0.012, 3, 10, Math.PI).translate(0, restY, -drumR - 0.03), c: C.iron, n: 'bail' });
  const drips = makeEmitter('drips', { count: 18, shape: 'drop', color: C.water, stretch: 0.6, parent: 'bucket', seed: p.seed, emit: 0,
    spawn: (i, rr) => ({ p: [(rr() - 0.5) * 0.3, -0.3, (rr() - 0.5) * 0.3], v: [0, -0.3, 0], life: 0.8, size: 0.02 }) });
  const waterMat = makeWaterMaterial({ opacity: 0.9, foam: C.foam, roughness: 0.05 });
  const U = waterMat.userData.uniforms, depthToWater = restY - wy - 0.15;
  let lastDip = -1;
  g.userData.view = { target: [0, 1.0, 0], radius: 7.5 };
  return finalize(g, P, p, C, {
    waterMat, emitters: [drips], ground: { h, col: terrainCol, w: S, d: S },
    tick: (t, dt, drive) => {
      if (!p.automatic) return;
      const T = p.cycleTime, k = (t % T) / T, cyc = Math.floor(t / T);
      const down = k < 0.35 ? ease(k / 0.35) : k < 0.45 ? 1 : k < 0.85 ? 1 - ease((k - 0.45) / 0.4) : 0;
      function ease(v) { return v * v * (3 - 2 * v); }
      const d = down * depthToWater;
      drive('bucket', -d); drive('rope', 0.6 + d); drive('windlass', ((d / drumR) * 180) / Math.PI);
      drips.userData.uniforms.uEmit.value = k > 0.45 && k < 0.95 ? 1 : 0;
      if (k >= 0.35 && lastDip !== cyc) { lastDip = cyc; U.uRip.value[0].set(0, -drumR - 0.03, t, 0.05); U.uRipCount.value = 1; }
    },
  });
}
export default createAsset;
