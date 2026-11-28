/*
 * BOULDER CLUSTER (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * Rocks for shorelines, rivers and coasts: rounded glacial boulders, hexagonal basalt columns or
 * layered sedimentary slabs, with moss and lichen on their tops and pebbles around them. Set them
 * in water and they darken below the waterline, the current wraps foam collars round each rock and
 * drags foamy wakes and ripples downstream (+X), with cut-away water walls showing the bed.
 *
 * QUICK START
 *   import { createAsset } from './boulder-cluster.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // inWater: true + current → rocks in a stream; flow runs toward +X
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | sandstone | basalt | limestone | glacial — Theme
 *   style               boulders | columns | slabs — Rock Form
 *   count               1–40 (default 9) — Rocks
 *   size                0.3–5 m (default 1.6) — Size
 *   spread              1–30 m (default 5) — Spread
 *   mossAmount          0–1 (default 0.4) — Moss
 *   inWater             on/off (default off) — In Water
 *   waterLevel          0.1–3 m (default 0.6) — Water Level
 *   current             0–3 m/s (default 0.8) — Current
 *   pebbles             on/off (default on) — Pebbles
 *   base                on/off (default on) — Base
 *   seed                1–999 (default 13) — Seed
 *   rock                colour (default #8a8478) — Rock Colour
 *   rockDark            colour (default #6e6a62) — Rock Dark Colour
 *   rockLight           colour (default #a8a298) — Rock Light Colour
 *   moss                colour (default #5a7a3a) — Moss Colour
 *   lichen              colour (default #c8b85a) — Lichen Colour
 *   wet                 colour (default #4a4640) — Wet Colour
 *   pebble              colour (default #9a948a) — Pebble Colour
 *   sand                colour (default #c8b890) — Sand Colour
 *   ground              colour (default #7a9a4a) — Ground Colour
 *   soil                colour (default #5a4a38) — Soil Colour
 *   water               colour (default #3f8aa0) — Water Colour
 *   deep                colour (default #1a5a70) — Deep Colour
 *   foam                colour (default #f6fcff) — Foam Colour
 *
 * SPECS  4,542 triangles at defaults, 1 materials, 3 draw calls when merged,
 *        16.2 x 3.4 x 16.2 m (W x H x D, real-world scale).
 * PARTS animate: water shader, particles
 *        detach: rocks, pebbles, base
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.surface.heightAt(x, z, t) (when in water) · userData.drape(heightAt, keep?) — with Base off, each rock settles on the ground below it
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  rng, hash2, noise2, fbm2, smooth, mixC, faceTint, rockGeo, heightField, dioramaSkirt, makeWaterMaterial,
  waterify, waterGrid, anchorMark, anchorTag, partsBag, makeSurface, bindModule
} from './kit.mjs';

const BASE = { rock: '#8a8478', rockDark: '#6e6a62', rockLight: '#a8a298', moss: '#5a7a3a', lichen: '#c8b85a', wet: '#4a4640', pebble: '#9a948a', sand: '#c8b890', ground: '#7a9a4a', soil: '#5a4a38', water: '#3f8aa0', deep: '#1a5a70', foam: '#f6fcff' };
export const COLORWAYS = {
  'default': { ...BASE },
  sandstone: { ...BASE, rock: '#c8945a', rockDark: '#a8744a', rockLight: '#d8b080', pebble: '#c8a070', sand: '#e0c898', wet: '#7a5a3a' },
  basalt: { ...BASE, rock: '#3a3a3e', rockDark: '#2a2a2e', rockLight: '#4a4a50', pebble: '#4a4a4f', sand: '#5a5858', wet: '#1e1e22' },
  limestone: { ...BASE, rock: '#d8d4c8', rockDark: '#b8b4a8', rockLight: '#e8e6dc', pebble: '#c8c4b8', wet: '#8a8678' },
  glacial: { ...BASE, rock: '#7a7a80', rockDark: '#5f5f66', moss: '#6a8a6a', ground: '#9aa890' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  style: { type: 'choice', default: 'boulders', options: ['boulders', 'columns', 'slabs'], label: 'Rock Form', affects: 'geometry', describe: 'Rounded boulders, hexagonal basalt columns or layered slabs.' },
  count: { type: 'range', default: 9, min: 1, max: 40, step: 1, label: 'Rocks', affects: 'geometry', describe: 'Number of rocks (columns: per cluster ring).' },
  size: { type: 'range', default: 1.6, min: 0.3, max: 5, step: 0.05, unit: 'm', label: 'Size', affects: 'geometry', describe: 'Typical rock size.' },
  spread: { type: 'range', default: 5, min: 1, max: 30, step: 0.25, unit: 'm', label: 'Spread', affects: 'geometry', describe: 'Radius of the cluster.' },
  mossAmount: { type: 'range', default: 0.4, min: 0, max: 1, step: 0.05, label: 'Moss', affects: 'colors', describe: 'Moss and lichen cover on top faces.' },
  inWater: { type: 'toggle', default: false, label: 'In Water', affects: 'geometry', describe: 'Stand the rocks in flowing water.' },
  waterLevel: { type: 'range', default: 0.6, min: 0.1, max: 3, step: 0.05, unit: 'm', label: 'Water Level', affects: 'geometry', describe: 'Water depth over the bed.' },
  current: { type: 'range', default: 0.8, min: 0, max: 3, step: 0.05, unit: 'm/s', label: 'Current', affects: 'geometry', describe: 'Flow speed toward +X (foam collars, wakes).' },
  pebbles: { type: 'toggle', default: true, label: 'Pebbles', affects: 'geometry', describe: 'Scattered pebbles.' },
  base: { type: 'toggle', default: true, label: 'Base', affects: 'geometry', describe: 'Ground or stream-bed patch (off for placing on terrain).' },
  seed: { type: 'range', default: 13, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {};
export const detach = ['rocks', 'pebbles', 'base'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'boulder-cluster';
  const P = partsBag();
  const r = rng(p.seed), Sz = p.size, Rs = p.spread, wl = p.inWater ? p.waterLevel : -99, S = Rs * 2 + Sz * 2 + 3;
  const bedY = (x, z) => (p.base ? 0.12 * (fbm2(x * 0.2, z * 0.2, p.seed) - 0.5) : 0);
  const shade = (cx, cy, cz, top, baseCol) => {
    if (cy < wl + 0.06) return C.wet;
    if (cy > top - 0.35 * Sz * (1 - p.mossAmount * 0.5) && hash2(cx * 7.1, cz * 5.3, p.seed) < p.mossAmount) return hash2(cx * 3.3, cy * 9.1, 2) < 0.25 ? C.lichen : C.moss;
    return baseCol;
  };
  const rk = P.sub('rocks', [0, 0, 0]), circles = [], anchors = [];
  const tagRock = (x, z, fn) => { const mk = anchorMark(rk), ai = anchors.length; anchors.push([x, z, 'rock']); fn(); anchorTag(rk, mk, ai); };
  if (p.style === 'columns') {
    const cr = Sz * 0.32, gap = cr * 1.74, nRing = Math.max(1, Math.round(Math.sqrt(p.count) + 1));
    for (let q = -nRing; q <= nRing; q++) for (let s2 = -nRing; s2 <= nRing; s2++) {
      const x = gap * (q + s2 * 0.5), z = gap * s2 * 0.866, d = Math.hypot(x, z);
      if (d > Rs * 0.9 || r() < 0.15) continue;
      const ht = Sz * (0.6 + 2.4 * Math.pow(1 - d / Rs, 1.5) * (0.6 + r() * 0.5)), y0 = bedY(x, z) - 0.4, top = y0 + ht, col = r() < 0.5 ? C.rock : C.rockDark, tx = (r() - 0.5) * 0.24, tz = (r() - 0.5) * 0.2;
      const geo = new THREE.CylinderGeometry(cr, cr * 1.02, ht, 6).rotateY(0.52).translate(x, y0 + ht / 2, z);
      const pa = geo.attributes.position;
      for (let i = 0; i < pa.count; i++) if (pa.getY(i) > top - 1e-3) pa.setY(i, top + (pa.getX(i) - x) * tx + (pa.getZ(i) - z) * tz);
      tagRock(x, z, () => rk.solid.push({ g: faceTint(geo, (cx, cy, cz) => shade(cx, cy, cz, top, col)), c: null, n: 'column' }));
      circles.push([x, z, cr * 1.05]);
    }
  } else if (p.style === 'slabs') {
    for (let i = 0; i < p.count; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * Rs * 0.8, x = Math.cos(a) * d, z = Math.sin(a) * d, layers = 2 + Math.floor(r() * 4), w0 = Sz * (1 + r()), rot = r() * 3;
      let y = bedY(x, z) - 0.15;
      for (let l = 0; l < layers; l++) {
        const th = Sz * (0.18 + r() * 0.2), w = w0 * (1 - l * 0.14), dpt = w * (0.6 + r() * 0.3), col = l % 2 ? C.rockLight : C.rock, top = y + th;
        const geo = rockGeo(1, p.seed + i * 7 + l, 1, 1, 0.12).scale(w / 2, th / 2, dpt / 2).rotateY(rot + l * 0.2).translate(x + (r() - 0.5) * 0.2 * w, y + th / 2, z + (r() - 0.5) * 0.2 * w);
        tagRock(x, z, () => rk.solid.push({ g: faceTint(geo, (cx, cy, cz) => shade(cx, cy, cz, top, col)), c: null, n: 'slab' }));
        y += th * 0.92;
      }
      circles.push([x, z, w0 * 0.5]);
    }
  } else {
    for (let i = 0; i < p.count; i++) {
      const a = r() * 6.28, d = i === 0 ? 0 : Math.sqrt(r()) * Rs * 0.85, x = Math.cos(a) * d, z = Math.sin(a) * d, sz = Sz * (0.45 + r() * 0.75) * (i === 0 ? 1.3 : 1), y = bedY(x, z) + sz * 0.25, top = y + sz * 0.7, col = r() < 0.5 ? C.rock : C.rockDark;
      const rot = r() * 6;
      tagRock(x, z, () => rk.solid.push({ g: faceTint(rockGeo(sz, p.seed + i * 3, 1, 0.72, 0.2).rotateY(rot).translate(x, y, z), (cx, cy, cz) => shade(cx, cy, cz, top, col)), c: null, n: 'boulder' }));
      circles.push([x, z, sz * 0.95]);
    }
  }
  if (p.pebbles) {
    const pb = P.sub('pebbles', [0, 0, 0]);
    for (let i = 0; i < Math.round(Rs * Rs * 2.5); i++) { const a = r() * 6.28, d = Math.sqrt(r()) * (Rs + Sz), x = Math.cos(a) * d, z = Math.sin(a) * d, sz = 0.04 + r() * 0.12; pb.solid.push({ g: rockGeo(sz, i + 1, 0, 0.6, 0.25).translate(x, bedY(x, z) + sz * 0.3, z), c: r() < 0.6 ? C.pebble : C.rockLight, n: 'pebble' }); }
  }
  let waterMat = null;
  if (p.base) {
    const bs = P.sub('base', [0, 0, 0]), n = Math.max(16, Math.round(S / 0.5));
    bs.solid.push({ g: heightField(S, S, n, n, bedY, (x, y, z) => (p.inWater ? (noise2(x * 0.5, z * 0.5, p.seed) > 0.5 ? C.sand : C.pebble) : noise2(x * 0.4, z * 0.4, p.seed) > 0.4 ? C.ground : C.sand)), c: null, n: 'bed' });
    dioramaSkirt(bs.solid, p.inWater ? bs.water : null, S, S, n, n, bedY, -1.2, [p.inWater ? C.sand : C.ground, C.soil, C.rockDark], p.inWater ? () => wl : null, mixC(C.water, C.deep, 0.5).getHex());
    if (p.inWater) {
      const cu = p.current;
      bs.water.push({
        g: waterify(waterGrid(S, S, Math.round(S / 0.4), Math.round(S / 0.36), wl), (x, y, z) => {
          let f = 0.02;
          for (const [cx, cz, cr] of circles) {
            const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
            f = Math.max(f, 0.8 * smooth(cr + 0.5 + cu * 0.2, cr, d));
            if (dx > 0) f = Math.max(f, (0.25 + cu * 0.2) * smooth(cr * 0.9, 0, Math.abs(dz)) * Math.exp(-dx / (1.5 + cu * 2.5)));
          }
          return { s: x, u: z, speed: cu, foam: Math.min(0.9, f), ripple: 1, ocean: 0.3, color: mixC(C.water, C.deep, smooth(0, 1.5, wl - bedY(x, z))) };
        }),
        c: null, n: 'stream',
      });
      waterMat = makeWaterMaterial({ waves: [[1, 0.2, 0.06, 2.2], [0.2, 1, 0.04, 1.4]], opacity: 0.82, foam: C.foam, streakAlong: 0.35, streakAcross: 1.6, roughness: 0.08, ripples: circles.slice(0, 8).map(([x, z, cr]) => [x + cr * 0.6, z, -cr * 0.8, 0.006]) });
    }
  }
  g.userData.view = { target: [0, Sz * 0.4, 0], radius: Math.max(S * 0.9, 6) };
  finalize(g, P, p, C, { waterMat, drape: p.base ? null : anchors });
  if (waterMat) g.userData.surface = makeSurface(g, (lx, lz) => (Math.abs(lx) <= S / 2 && Math.abs(lz) <= S / 2 ? wl : null));
  return g;
}
export default createAsset;
