/*
 * KELP FOREST (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * Giant kelp rising from a rocky reef to a floating canopy. Every stalk, blade and gas bulb leans
 * and streams with the current; fish school through the columns, urchins graze the boulders, light
 * nets ripple across the floor and a sea otter naps on its back at the surface.
 *
 * QUICK START
 *   import { createAsset } from './kelp-forest.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // currentDir/current steer the whole forest; otters ride userData.waterSurface if assigned
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | emerald | crimson | dusk | temperate — Theme
 *   size                16–60 m (default 30) — Patch Size
 *   depth               6–30 m (default 14) — Water Depth
 *   density             0.1–1 (default 0.6) — Kelp Density
 *   current             0–1 (default 0.45) — Current Strength
 *   currentDir          0–360 ° (default 40) — Current Heading
 *   fish                0–150 (default 40) — Fish
 *   otters              0–3 (default 1) — Sea Otters
 *   canopy              on/off (default on) — Surface Canopy
 *   caustics            on/off (default on) — Caustics
 *   clarity             0.2–0.9 (default 0.5) — Surface Opacity
 *   seaWater            on/off (default on) — Own Sea
 *   diorama             on/off (default on) — Diorama Sides
 *   seed                1–999 (default 17) — Seed
 *   rock                colour (default #6b6458) — Rock Colour
 *   rockDark            colour (default #4a453c) — Rock Dark Colour
 *   sand                colour (default #bfae86) — Sand Colour
 *   kelp                colour (default #9a7a2a) — Kelp Colour
 *   blade               colour (default #b08a32) — Blade Colour
 *   bulb                colour (default #c49a3a) — Bulb Colour
 *   urchin              colour (default #4a2a5e) — Urchin Colour
 *   star                colour (default #d05a3a) — Star Colour
 *   fishA               colour (default #c8d0d8) — Fish A Colour
 *   fishB               colour (default #f07a1e) — Fish B Colour
 *   fin                 colour (default #5a6672) — Fin Colour
 *   water               colour (default #2d7f8a) — Water Colour
 *   deep                colour (default #123f4f) — Deep Colour
 *   foam                colour (default #eef9fa) — Foam Colour
 *   otter               colour (default #5a3f2a) — Otter Colour
 *   otterFace           colour (default #c9b39a) — Otter Face Colour
 *   soil                colour (default #5c4f3e) — Soil Colour
 *
 * SPECS  29,703 triangles at defaults, 4 materials, 8 draw calls when merged,
 *        31.4 x 18.4 x 31.7 m (W x H x D, real-world scale).
 * PARTS animate: water shader, particles
 *        detach: kelp, fish-a, fish-b, surface, caustics, otter-1, otter-2, otter-3
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  addWire, sweep, rng, noise2, fbm2, mixC, rockGeo, addRock, heightField, makeWaterMaterial, waterify, waterGrid,
  makeSwayMaterial, swayify, tileEdge, partsBag, makeFishSchool, floatOn, bindModule
} from './kit.mjs';

const BASE = {
  rock: '#6b6458', rockDark: '#4a453c', sand: '#bfae86', kelp: '#9a7a2a', blade: '#b08a32', bulb: '#c49a3a',
  urchin: '#4a2a5e', star: '#d05a3a', fishA: '#c8d0d8', fishB: '#f07a1e', fin: '#5a6672',
  water: '#2d7f8a', deep: '#123f4f', foam: '#eef9fa', otter: '#5a3f2a', otterFace: '#c9b39a', soil: '#5c4f3e',
};
export const COLORWAYS = {
  'default': { ...BASE },
  emerald: { ...BASE, kelp: '#4f7f2f', blade: '#6a9a3a', bulb: '#7fae48', water: '#2f8a7a', deep: '#0f4a42' },
  crimson: { ...BASE, kelp: '#8a3a2a', blade: '#b04a3a', bulb: '#c86a4a', water: '#2a6f86' },
  dusk: { ...BASE, water: '#2a4f6a', deep: '#0c2236', kelp: '#7a6a3a', blade: '#8a7a42', sand: '#8f8670' },
  temperate: { ...BASE, rock: '#7a756c', sand: '#a99f86', water: '#3b7c86' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  size: { type: 'range', default: 30, min: 16, max: 60, step: 2, unit: 'm', label: 'Patch Size', affects: 'geometry', describe: 'Square patch edge length.' },
  depth: { type: 'range', default: 14, min: 6, max: 30, step: 0.5, unit: 'm', label: 'Water Depth', affects: 'geometry', describe: 'Floor to surface; kelp grows the full height.' },
  density: { type: 'range', default: 0.6, min: 0.1, max: 1, step: 0.05, label: 'Kelp Density', affects: 'geometry', describe: 'Number of kelp stalks.' },
  current: { type: 'range', default: 0.45, min: 0, max: 1, step: 0.05, label: 'Current Strength', affects: 'geometry', describe: 'How far the forest leans and streams.' },
  currentDir: { type: 'range', default: 40, min: 0, max: 360, step: 5, unit: '°', label: 'Current Heading', affects: 'geometry', describe: 'Direction the current flows toward (0° = +X).' },
  fish: { type: 'range', default: 40, min: 0, max: 150, step: 5, label: 'Fish', affects: 'geometry', describe: 'Schooling fish.' },
  otters: { type: 'range', default: 1, min: 0, max: 3, step: 1, label: 'Sea Otters', affects: 'geometry', describe: 'Otters floating on their backs in the canopy.' },
  canopy: { type: 'toggle', default: true, label: 'Surface Canopy', affects: 'geometry', describe: 'Stalks trail along the surface as a floating mat.' },
  caustics: { type: 'toggle', default: true, label: 'Caustics', affects: 'geometry', describe: 'Dancing light nets on the floor.' },
  clarity: { type: 'range', default: 0.5, min: 0.2, max: 0.9, step: 0.05, label: 'Surface Opacity', affects: 'colors', describe: 'Opacity of the surface and cut-away.' },
  seaWater: { type: 'toggle', default: true, label: 'Own Sea', affects: 'geometry', describe: 'The asset’s own patch of sea. Turn it off when the asset sits in an ocean tile, which then supplies (and shoals) the water.' },
  diorama: { type: 'toggle', default: true, label: 'Diorama Sides', affects: 'geometry', describe: 'Water-column and rock cut-away.' },
  seed: { type: 'range', default: 17, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {};
export const detach = ['kelp', 'fish-a', 'fish-b', 'surface', 'caustics', 'otter-1', 'otter-2', 'otter-3'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'kelp-forest';
  const P = partsBag();
  const S = p.size, Dp = p.depth, r = rng(p.seed), ca = Math.cos((p.currentDir * Math.PI) / 180), sa = Math.sin((p.currentDir * Math.PI) / 180);
  const h = (x, z) => (fbm2(x * 0.12, z * 0.12, p.seed, 4) - 0.4) * 1.6 + Math.max(0, noise2(x * 0.25, z * 0.25, p.seed + 3) - 0.6) * 4;
  const n = Math.max(30, Math.round(S / 0.7));
  const floorCol = (x, y, z, sl) => (y < -0.2 && sl < 0.2 ? C.sand : sl > 0.4 ? C.rockDark : C.rock);
  P.solid.push({ g: heightField(S, S, n, n, h, floorCol), c: null, n: 'floor' });
  for (let i = 0; i < Math.round(S * S * 0.025); i++) { const x = (r() - 0.5) * S * 0.9, z = (r() - 0.5) * S * 0.9, rr = 0.4 + r() * 1.4; addRock(P.solid, rr, x, h(x, z) + rr * 0.2, z, r() < 0.5 ? C.rock : C.rockDark, p.seed + i, 0.7); }
  tileEdge(p, P.solid, p.seaWater ? P.water : null, S, S, n, n, h, -4, [C.sand, C.rockDark, C.soil], () => Dp, C.deep);

  // Kelp (all in the sway bucket: weight grows with height, so canopies stream the furthest)
  const kelp = P.sub('kelp', [0, 0, 0]);
  const stalks = Math.round(p.density * S * S * 0.07);
  const lean = p.current * 1.5;
  for (let i = 0; i < stalks; i++) {
    const x0 = (r() - 0.5) * S * 0.9, z0 = (r() - 0.5) * S * 0.9, y0 = h(x0, z0), ph = r() * 6.28, top = Dp - 0.12;
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      pts.push([x0 + Math.sin(k * 1.3 + ph) * 0.35 + ca * lean * t * t, y0 + (top - y0) * t, z0 + Math.cos(k * 1.1 + ph) * 0.35 + sa * lean * t * t]);
    }
    if (p.canopy) { const e = pts[6], L = 2 + r() * 3; pts.push([e[0] + ca * L * 0.5, top, e[2] + sa * L * 0.5], [e[0] + ca * L, top, e[2] + sa * L]); }
    const items = [{ g: sweep(pts, () => 0.035, 4, pts.length * 3, false), c: C.kelp, n: 'stipe' }];
    items.push({ g: rockGeo(0.22, i, 0, 0.5, 0.3).translate(x0, y0 + 0.05, z0), c: C.kelp, n: 'holdfast' });
    const curve = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)));
    const nb = Math.round((top - y0) / 0.75) + (p.canopy ? 5 : 0);
    for (let k = 1; k < nb; k++) {
      const t = k / nb, q = curve.getPointAt(t), side = k % 2 ? 1 : -1, a = ph + k * 2.4;
      const dx = Math.cos(a), dz = Math.sin(a), L = 0.55 + r() * 0.35, w = 0.09;
      const v = [q.x, q.y, q.z, q.x + dx * L * 0.5 - dz * w, q.y - 0.1 * side - 0.08, q.z + dz * L * 0.5 + dx * w, q.x + dx * L, q.y - 0.25, q.z + dz * L,
        q.x, q.y, q.z, q.x + dx * L, q.y - 0.25, q.z + dz * L, q.x + dx * L * 0.5 + dz * w, q.y - 0.1 * side - 0.08, q.z + dz * L * 0.5 - dx * w];
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      items.push({ g: bg, c: C.blade, n: 'blade' });
      items.push({ g: new THREE.TetrahedronGeometry(0.05, 0).translate(q.x + dx * 0.05, q.y, q.z + dz * 0.05), c: C.bulb, n: 'bulb' });
    }
    for (const it of items) kelp.sway.push({ g: swayify(it.g, ph, y0, Dp + 1), c: it.c, n: it.n });
  }
  // Urchins & sea stars
  for (let i = 0; i < Math.round(S * 0.8); i++) {
    const x = (r() - 0.5) * S * 0.9, z = (r() - 0.5) * S * 0.9, y = h(x, z);
    if (r() < 0.7) {
      P.solid.push({ g: new THREE.IcosahedronGeometry(0.08, 1).scale(1, 0.7, 1).translate(x, y + 0.05, z), c: C.urchin, n: 'urchin' });
      for (let k = 0; k < 8; k++) { const d = new THREE.Vector3(r() - 0.5, r() * 0.7 + 0.15, r() - 0.5).normalize(); addWire(P.solid, [x, y + 0.05, z], [x + d.x * 0.18, y + 0.05 + d.y * 0.18, z + d.z * 0.18], C.urchin, 0.006, 3); }
    } else {
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + r(); addWire(P.solid, [x, y + 0.03, z], [x + Math.cos(a) * 0.14, y + 0.03, z + Math.sin(a) * 0.14], C.star, 0.025, 4); }
    }
  }
  // Surface + caustics
  const sea = P.sub('surface', [0, Dp, 0]);
  const nW = Math.max(16, Math.round(S / 1.2));
  if (p.seaWater) sea.water.push({ g: waterify(waterGrid(S, S, nW, Math.round(nW / 0.866), Dp), (x, y, z) => ({ s: x * ca + z * sa, u: -x * sa + z * ca, speed: p.current * 0.6, foam: 0.04, ocean: 1, color: mixC(C.water, C.deep, 0.3 + 0.3 * noise2(x * 0.1, z * 0.1, p.seed)) })), c: null, n: 'surface' });
  if (p.caustics) {
    const cau = P.sub('caustics', [0, 0, 0]);
    const geo = heightField(S, S, Math.round(n * 0.7), Math.round(n * 0.7), (x, z) => h(x, z) + 0.06, () => 0xffffff);
    cau.water.push({ g: waterify(geo, (x, y, z) => ({ s: x * 1.2, u: z * 0.42, speed: 0.3 + p.current * 0.3, mode: 4, color: 0xffffff })), c: null, n: 'caustics' });
  }
  // Sea otters (float on their backs)
  for (let i = 0; i < p.otters; i++) {
    const ox = (r() - 0.5) * S * 0.5, oz = (r() - 0.5) * S * 0.5, oy = Dp + 0.05, name = `otter-${i + 1}`, o = P.sub(name, [ox, oy, oz]), a = r() * 6.28;
    const m = new THREE.Matrix4().makeRotationY(a).setPosition(ox, oy, oz);
    const add = (geo, hex, nm) => o.solid.push({ g: geo.applyMatrix4(m), c: hex, n: nm });
    add(new THREE.CapsuleGeometry(0.2, 0.7, 3, 8).rotateZ(Math.PI / 2), C.otter, 'body');
    add(new THREE.IcosahedronGeometry(0.17, 1).translate(0.6, 0.06, 0), C.otterFace, 'head');
    add(new THREE.IcosahedronGeometry(0.04, 0).translate(0.74, 0.12, 0), C.rockDark, 'nose');
    add(new THREE.CapsuleGeometry(0.05, 0.12, 2, 5).rotateZ(1.2).translate(0.32, 0.2, 0.12), C.otter, 'paw');
    add(new THREE.CapsuleGeometry(0.05, 0.12, 2, 5).rotateZ(1.2).translate(0.32, 0.2, -0.12), C.otter, 'paw');
    add(new THREE.CapsuleGeometry(0.06, 0.4, 2, 6).rotateZ(Math.PI / 2).translate(-0.65, 0.04, 0), C.otter, 'tail');
    add(new THREE.IcosahedronGeometry(0.08, 0).scale(1, 0.6, 1).translate(0.3, 0.26, 0), C.urchin, 'snack');
  }
  const objects = [];
  if (p.fish > 0) {
    objects.push(makeFishSchool('fish-a', { count: Math.round(p.fish * 0.8), center: [0, Dp * 0.5, 0], radius: [S * 0.3, S * 0.25], wander: Dp * 0.15, speed: 1.4, size: 0.3, colors: [C.fishA, C.foam, C.fin], spread: 1.6, seed: p.seed }));
    objects.push(makeFishSchool('fish-b', { count: Math.max(1, Math.round(p.fish * 0.1)), center: [S * 0.15, Dp * 0.25, -S * 0.1], radius: [S * 0.18, S * 0.15], wander: 1, speed: 0.7, size: 0.32, colors: [C.fishB, C.fishB, C.fishB], spread: 2.5, seed: p.seed + 3 }));
  }
  const waterMat = makeWaterMaterial({ waves: [[ca, sa, 0.08, 11], [-sa, ca, 0.05, 6]], opacity: p.clarity, foam: C.foam, streakAlong: 0.4, streakAcross: 0.4, roughness: 0.1 });
  const swayMat = makeSwayMaterial({ amp: 0.25 + p.current * 0.6, freq: 0.55 + p.current * 0.35, dir: [ca, sa] });
  return finalize(g, P, p, C, {
    waterMat, swayMat, objects, ground: { h, col: floorCol, w: S, d: S },
    tick: (t, dt) => {
      for (const f of objects) f.userData.swim(t);
      for (let i = 0; i < p.otters; i++) { const o = g.getObjectByName(`otter-${i + 1}`); if (o) floatOn(g, o, t, dt, { len: 1.4, beam: 0.5, amp: 0.06, period: 3.6, phase: i * 2, level: Dp }); }
    },
  });
}
export default createAsset;
