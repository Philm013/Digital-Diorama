/*
 * TIDE POOLS (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * Rocky intertidal shelf where swell washes over the seaward lip while the pools behind stay
 * glassy, stirred only by drips and wind ripples. Starfish, anemones with swaying tentacles, sea
 * urchins, mussel beds, barnacles, kelp ribbons and a scuttling crab.
 *
 * QUICK START
 *   import { createAsset } from './tide-pool.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // sea on −Z; raise `tide` to drown the shelf, lower it to expose the pools
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | tropical | granite | volcanic | pastel — Theme
 *   width               12–60 m (default 24) — Width
 *   depth               10–40 m (default 18) — Depth
 *   pools               1–10 (default 5) — Pools
 *   tide                -0.8–0.8 m (default 0) — Tide Level
 *   swell               0–1.2 m (default 0.35) — Swell
 *   life                0–1 (default 0.7) — Marine Life
 *   seaweed             0–1 (default 0.6) — Seaweed
 *   showCrab            on/off (default on) — Crab
 *   seaWater            on/off (default on) — Own Sea
 *   diorama             on/off (default on) — Diorama Sides
 *   seed                1–999 (default 21) — Seed
 *   rock                colour (default #6f6a62) — Rock Colour
 *   rockDark            colour (default #4d4943) — Rock Dark Colour
 *   wetRock             colour (default #3a3833) — Wet Rock Colour
 *   algae               colour (default #5f7b3a) — Algae Colour
 *   pool                colour (default #3f8a8f) — Pool Colour
 *   deep                colour (default #1f5a66) — Deep Colour
 *   water               colour (default #2f7e95) — Water Colour
 *   foam                colour (default #f5fbff) — Foam Colour
 *   starfish            colour (default #e0702f) — Starfish Colour
 *   anemone             colour (default #d9547a) — Anemone Colour
 *   urchin              colour (default #5b2d6e) — Urchin Colour
 *   mussel              colour (default #22252c) — Mussel Colour
 *   barnacle            colour (default #d8d2c2) — Barnacle Colour
 *   kelp                colour (default #6b5a2a) — Kelp Colour
 *   crab                colour (default #c4502d) — Crab Colour
 *   soil                colour (default #5a4a3a) — Soil Colour
 *
 * SPECS  10,351 triangles at defaults, 3 materials, 6 draw calls when merged,
 *        24.0 x 5.8 x 18.0 m (W x H x D, real-world scale).
 * PARTS animate: crab (translate x -1.5…1.5 m)
 *        detach: life, seaweed, crab
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  addWire, sweep, rng, noise2, fbm2, smooth, lerp, mixC, heightField, makeWaterMaterial, waterify, waterGrid,
  waterDisc, makeSwayMaterial, swayify, tileEdge, partsBag, addLathe, bindModule
} from './kit.mjs';

const BASE = {
  rock: '#6f6a62', rockDark: '#4d4943', wetRock: '#3a3833', algae: '#5f7b3a', pool: '#3f8a8f', deep: '#1f5a66',
  water: '#2f7e95', foam: '#f5fbff', starfish: '#e0702f', anemone: '#d9547a', urchin: '#5b2d6e', mussel: '#22252c',
  barnacle: '#d8d2c2', kelp: '#6b5a2a', crab: '#c4502d', soil: '#5a4a3a',
};
export const COLORWAYS = {
  'default': { ...BASE },
  tropical: { ...BASE, rock: '#8b8273', pool: '#3fb6b2', water: '#28a9b8', starfish: '#2f7fe0', anemone: '#9b59d0', algae: '#4f9a4a' },
  granite: { ...BASE, rock: '#9a8a84', rockDark: '#6e625e', wetRock: '#4a403d', starfish: '#a24ab0' },
  volcanic: { ...BASE, rock: '#3a3838', rockDark: '#262525', wetRock: '#1a1919', algae: '#4b6d33', barnacle: '#b9b4a8' },
  pastel: { ...BASE, starfish: '#f08c8c', anemone: '#f3a6d0', urchin: '#7b6fd0', pool: '#6bb8bf' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  width: { type: 'range', default: 24, min: 12, max: 60, step: 1, unit: 'm', label: 'Width', affects: 'geometry', describe: 'Shelf length along the shore (X).' },
  depth: { type: 'range', default: 18, min: 10, max: 40, step: 1, unit: 'm', label: 'Depth', affects: 'geometry', describe: 'Sea-to-shore extent (Z).' },
  pools: { type: 'range', default: 5, min: 1, max: 10, step: 1, label: 'Pools', affects: 'geometry', describe: 'Number of rock pools.' },
  tide: { type: 'range', default: 0, min: -0.8, max: 0.8, step: 0.05, unit: 'm', label: 'Tide Level', affects: 'geometry', describe: 'Sea level relative to the shelf.' },
  swell: { type: 'range', default: 0.35, min: 0, max: 1.2, step: 0.05, unit: 'm', label: 'Swell', affects: 'geometry', describe: 'Height of waves washing the seaward lip.' },
  life: { type: 'range', default: 0.7, min: 0, max: 1, step: 0.05, label: 'Marine Life', affects: 'geometry', describe: 'Density of starfish, anemones, urchins, mussels and barnacles.' },
  seaweed: { type: 'range', default: 0.6, min: 0, max: 1, step: 0.05, label: 'Seaweed', affects: 'geometry', describe: 'Kelp ribbons and algae patches.' },
  showCrab: { type: 'toggle', default: true, label: 'Crab', affects: 'geometry', describe: 'A shore crab scuttling between pools.' },
  seaWater: { type: 'toggle', default: true, label: 'Own Sea', affects: 'geometry', describe: 'The asset’s own patch of sea. Turn it off when the asset sits in an ocean tile, which then supplies (and shoals) the water.' },
  diorama: { type: 'toggle', default: true, label: 'Diorama Sides', affects: 'geometry', describe: 'Cut-away rock sides.' },
  seed: { type: 'range', default: 21, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {
  crab: { type: 'translate', axis: 'x', range: [-1.5, 1.5], describe: 'Crab scuttles sideways (auto-animated).' },
};
export const detach = ['life', 'seaweed', 'crab'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'tide-pool';
  const P = partsBag();
  const W = p.width, D = p.depth, hw = W / 2, hd = D / 2, r = rng(p.seed);
  const pools = [];
  for (let i = 0; i < p.pools * 6 && pools.length < p.pools; i++) {
    const pl = { x: (r() - 0.5) * W * 0.8, z: -hd + 6 + r() * (D - 8), rx: 0.9 + r() * 1.8, rz: 0.7 + r() * 1.4, depth: 0.35 + r() * 0.4 };
    if (pools.every((q) => Math.hypot(q.x - pl.x, q.z - pl.z) > q.rx + pl.rx + 0.8)) pools.push(pl);
  }
  const shelf = (x, z) => {
    const y = 0.55 + (fbm2(x * 0.12, z * 0.12, p.seed, 4) - 0.5) * 1.1 + Math.max(0, z - hd + 4) * 0.25;
    return lerp(-1.7, y, smooth(-hd + 0.5, -hd + 6, z));
  };
  const h = (x, z) => {
    let y = shelf(x, z);
    for (const pl of pools) {
      const d = Math.hypot((x - pl.x) / pl.rx, (z - pl.z) / pl.rz);
      if (d < 1.2) y -= pl.depth * smooth(1.2, 0.5, d);
    }
    return y;
  };
  for (const pl of pools) {
    let rim = Infinity;
    for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2; rim = Math.min(rim, shelf(pl.x + Math.cos(a) * pl.rx * 1.2, pl.z + Math.sin(a) * pl.rz * 1.2)); }
    pl.level = rim - 0.04;
  }
  const nx = Math.max(30, Math.round(W / 0.45)), nz = Math.max(24, Math.round(D / 0.45));
  const terrainCol = (x, y, z, sl) => {
      if (y < p.tide + 0.25) return C.wetRock;
    for (const pl of pools) if (y < pl.level && Math.hypot((x - pl.x) / pl.rx, (z - pl.z) / pl.rz) < 1.2) return noise2(x * 2, z * 2, p.seed) > 0.55 ? C.algae : C.rockDark;
    if (noise2(x * 0.6, z * 0.6, p.seed + 3) > 0.78 - p.seaweed * 0.2) return C.algae;
    return sl > 0.35 ? C.rockDark : C.rock;
  };
  P.solid.push({ g: heightField(W, D, nx, nz, h, terrainCol), c: null, n: 'shelf' });

  // Sea along the seaward lip (Gerstner swell that overtops the low rock) + flat pools (ripples only).
  const zMax = -hd + 8, wdz = zMax + hd;
  const nxW = Math.max(16, Math.round(W / 0.8)), nzW = Math.max(6, Math.round(wdz / ((W / nxW) * 0.866)));
  const Lw = 14, kw = (2 * Math.PI) / Lw;
  const waves = [[0.1, 1, Math.min(0.5, (p.swell / 2) * kw), Lw], [-0.35, 1, Math.min(0.2, (p.swell / 6) * kw * 2), Lw * 0.5]];
  if (p.seaWater) P.water.push({
    g: waterify(waterGrid(W, wdz, nxW, nzW, p.tide, 0, (-hd + zMax) / 2), (x, y, z) => {
      const d = p.tide - h(x, z);
      return { s: z, u: x, speed: 1.8, foam: d < 0.4 ? 0.45 : 0.1 * smooth(2, 0.5, d) + 0.02, ocean: 1, color: mixC(C.water, C.deep, smooth(0.5, 2.5, d)) };
    }),
    c: null, n: 'sea',
  });
  for (const pl of pools) {
    const geo = waterDisc(1, 4, 0).scale(pl.rx * 1.25, 1, pl.rz * 1.25).translate(pl.x, pl.level, pl.z);
    P.water.push({ g: waterify(geo, (x, y, z) => ({ ripple: 1, s: x, u: z, speed: 0.05, color: mixC(C.pool, C.deep, smooth(0, 1.2, Math.hypot((x - pl.x) / pl.rx, (z - pl.z) / pl.rz)) * 0.2) })), c: null, n: 'pool' });
  }
  tileEdge(p, P.solid, p.seaWater ? P.water : null, W, D, nx, nz, h, -4, [C.rockDark, C.rock, C.soil], (x, z) => p.tide, C.deep);

  // Marine life
  const life = P.sub('life', [0, 0, 0]);
  const spot = () => {
    if (pools.length && r() < 0.65) { const pl = pools[Math.floor(r() * pools.length)], a = r() * 6.28, d = Math.sqrt(r()) * 0.85; const x = pl.x + Math.cos(a) * pl.rx * d, z = pl.z + Math.sin(a) * pl.rz * d; return [x, h(x, z), z]; }
    const x = (r() - 0.5) * W * 0.9, z = -hd + 4 + r() * 5; return [x, h(x, z), z];
  };
  const star = new THREE.Shape();
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, rr = k % 2 ? 0.42 : 1; const fn = k ? 'lineTo' : 'moveTo'; star[fn](Math.cos(a) * rr, Math.sin(a) * rr); }
  const nLife = Math.round(p.life * pools.length * 7 + p.life * 6);
  for (let i = 0; i < nLife; i++) {
    const [x, y, z] = spot(), kind = r(), s = 0.6 + r() * 0.6;
    if (kind < 0.3) {
      const geo = new THREE.ExtrudeGeometry(star, { depth: 0.025, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 1 });
      life.solid.push({ g: geo.scale(0.11 * s, 0.11 * s, 1).rotateX(-Math.PI / 2).rotateY(r() * 6).translate(x, y + 0.03, z), c: C.starfish, n: 'starfish' });
    } else if (kind < 0.55) {
      addLathe(life.solid, [[0, 0], [0.07 * s, 0], [0.06 * s, 0.08 * s], [0.075 * s, 0.1 * s], [0, 0.1 * s]], 7, C.anemone, x, y, z);
      const ph = r() * 6.28;
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2, t = new THREE.ConeGeometry(0.012 * s, 0.11 * s, 3).translate(0, 0.055 * s, 0).rotateZ(0.5).rotateY(-a).translate(x + Math.cos(a) * 0.05 * s, y + 0.1 * s, z + Math.sin(a) * 0.05 * s);
        life.sway.push({ g: swayify(t, ph, y + 0.1 * s, y + 0.3 * s), c: C.anemone, n: 'tentacle' });
      }
    } else if (kind < 0.72) {
      life.solid.push({ g: new THREE.IcosahedronGeometry(0.07 * s, 1).scale(1, 0.75, 1).translate(x, y + 0.05 * s, z), c: C.urchin, n: 'urchin' });
      for (let k = 0; k < 10; k++) {
        const d = new THREE.Vector3(r() - 0.5, r() * 0.8 + 0.1, r() - 0.5).normalize();
        addWire(life.solid, [x, y + 0.05 * s, z], [x + d.x * 0.16 * s, y + 0.05 * s + d.y * 0.16 * s, z + d.z * 0.16 * s], C.urchin, 0.006, 3);
      }
    } else if (kind < 0.88) {
      for (let k = 0; k < 6; k++) life.solid.push({ g: new THREE.OctahedronGeometry(0.05, 0).scale(1, 0.45, 0.55).rotateY(r() * 6).rotateZ(r() - 0.5).translate(x + (r() - 0.5) * 0.25, y + 0.02, z + (r() - 0.5) * 0.25), c: C.mussel, n: 'mussel' });
    } else {
      for (let k = 0; k < 8; k++) life.solid.push({ g: new THREE.ConeGeometry(0.025, 0.03, 5).translate(x + (r() - 0.5) * 0.4, y + 0.015, z + (r() - 0.5) * 0.4), c: C.barnacle, n: 'barnacle' });
    }
  }
  const weed = P.sub('seaweed', [0, 0, 0]);
  for (let i = 0; i < Math.round(p.seaweed * W * 0.8); i++) {
    const x = (r() - 0.5) * W * 0.95, z = -hd + 3 + r() * 3.5, y = h(x, z), L = 0.6 + r() * 0.9, a = r() * 6.28, ph = r() * 6.28;
    const pts = [[x, y, z], [x + Math.cos(a) * 0.15, y + L * 0.5, z + Math.sin(a) * 0.15], [x + Math.cos(a) * 0.35, y + L, z - 0.3]];
    weed.sway.push({ g: swayify(sweep(pts, (t) => 0.05 * (1 - t * 0.6), 3, 5, false).scale(1, 1, 1), ph, y, y + L * 1.2), c: C.kelp, n: 'kelp' });
  }

  // Crab (sub-assembly, scuttles sideways)
  if (p.showCrab) {
    const pl = pools[0] || { x: 0, z: 0, rx: 1, rz: 1 };
    const cx = pl.x + pl.rx * 1.3, cz = pl.z, cy = shelf(cx, cz);
    const crab = P.sub('crab', [cx, cy, cz]);
    crab.solid.push({ g: new THREE.IcosahedronGeometry(0.09, 1).scale(1.3, 0.45, 1).translate(cx, cy + 0.07, cz), c: C.crab, n: 'carapace' });
    for (const sgn of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const lz = cz + (k - 1) * 0.05;
        addWire(crab.solid, [cx + sgn * 0.08, cy + 0.07, lz], [cx + sgn * 0.16, cy + 0.09, lz], C.crab, 0.008, 3);
        addWire(crab.solid, [cx + sgn * 0.16, cy + 0.09, lz], [cx + sgn * 0.2, cy, lz + (k - 1) * 0.02], C.crab, 0.007, 3);
      }
      crab.solid.push({ g: new THREE.IcosahedronGeometry(0.035, 0).scale(1, 0.6, 1.4).translate(cx + sgn * 0.07, cy + 0.08, cz + 0.13), c: C.crab, n: 'claw' });
      crab.solid.push({ g: new THREE.IcosahedronGeometry(0.012, 0).translate(cx + sgn * 0.03, cy + 0.12, cz + 0.08), c: C.mussel, n: 'eye' });
    }
  }

  const waterMat = makeWaterMaterial({ waves, opacity: 0.72, foam: C.foam, streakAlong: 0.4, streakAcross: 0.6, roughness: 0.1 });
  const swayMat = makeSwayMaterial({ amp: 0.08, freq: 1.6, dir: [0.2, 1] });
  const U = waterMat.userData.uniforms;
  let nextDrop = 0, slot = 0;
  return finalize(g, P, p, C, {
    waterMat, swayMat, ground: { h, col: terrainCol, w: W, d: D },
    tick: (t, dt, drive) => {
      // wind ripples and drips land in random pools
      if (pools.length && t >= nextDrop) {
        const pl = pools[Math.floor(Math.random() * pools.length)], a = Math.random() * 6.28, d = Math.random() * 0.8;
        U.uRip.value[slot].set(pl.x + Math.cos(a) * pl.rx * d, pl.z + Math.sin(a) * pl.rz * d, t, 0.012 + Math.random() * 0.012);
        slot = (slot + 1) % 8; U.uRipCount.value = Math.max(U.uRipCount.value, slot === 0 ? 8 : slot);
        nextDrop = t + 0.35 + Math.random() * 0.9;
      }
      if (p.showCrab) { const c = Math.sin(t * 0.7); drive('crab', Math.sign(c) * Math.pow(Math.abs(c), 0.6) * 1.2); }
    },
  });
}
export default createAsset;
