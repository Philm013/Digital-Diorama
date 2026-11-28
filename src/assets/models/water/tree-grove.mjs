/*
 * TREE GROVE (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A stand of trees for lakeshores, riverbanks and islands — pines, broadleaves, white birches,
 * weeping willows trailing curtains of strands, or coconut palms, mixed or pure — with canopies
 * that sway in the wind, an understorey of bushes, ferns and grass, mossy fallen logs and a ground
 * patch. Seasonal colourways from spring blossom to autumn gold and winter snow.
 *
 * QUICK START
 *   import { createAsset } from './tree-grove.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // ground: false → just the trees, planted at y = 0 (or use heightAt)
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | autumn | winter | spring | tropical — Theme
 *   species             mixed | pine | broadleaf | birch | willow | palm — Trees
 *   count               1–60 (default 14) — Trees
 *   radius              2–40 m (default 10) — Radius
 *   height              2–30 m (default 9) — Height
 *   variation           0–1 (default 0.35) — Variation
 *   undergrowth         on/off (default on) — Undergrowth
 *   logs                0–6 (default 2) — Fallen Logs
 *   wind                0–1 (default 0.35) — Wind
 *   showGround          on/off (default on) — Ground
 *   seed                1–999 (default 9) — Seed
 *   trunk               colour (default #6a5038) — Trunk Colour
 *   bark                colour (default #eeeae2) — Bark Colour
 *   mark                colour (default #2a2a2a) — Mark Colour
 *   leaf                colour (default #4f8a3a) — Leaf Colour
 *   leafDark            colour (default #3a6f2f) — Leaf Dark Colour
 *   leafLight           colour (default #7ab04a) — Leaf Light Colour
 *   needle              colour (default #2f5f3a) — Needle Colour
 *   needleDark          colour (default #244a2e) — Needle Dark Colour
 *   frond               colour (default #5a9a3a) — Frond Colour
 *   ground              colour (default #5f8a3a) — Ground Colour
 *   groundDark          colour (default #4f7a32) — Ground Dark Colour
 *   soil                colour (default #4a3a2a) — Soil Colour
 *   log                 colour (default #7a5a3a) — Log Colour
 *   moss                colour (default #5a7a3a) — Moss Colour
 *   fern                colour (default #4f9a3a) — Fern Colour
 *   berry               colour (default #c8302a) — Berry Colour
 *
 * SPECS  6,075 triangles at defaults, 2 materials, 5 draw calls when merged,
 *        24.0 x 10.6 x 24.0 m (W x H x D, real-world scale).
 * PARTS animate: water shader, particles
 *        detach: trees, undergrowth, ground
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.heightAt(x, z) · userData.drape(heightAt, keep?) — with Ground off, each tree and plant settles rigidly on the ground below it; keep(x, z, y, kind) culls any that would stand in water
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  rng, noise2, fbm2, heightField, dioramaSkirt, makeSwayMaterial, swayify, addPine, addBroadleaf, addPalm,
  addBirch, addWillow, swayCanopy, anchorMark, anchorTag, partsBag, bindModule
} from './kit.mjs';

const BASE = {
  trunk: '#6a5038', bark: '#eeeae2', mark: '#2a2a2a', leaf: '#4f8a3a', leafDark: '#3a6f2f', leafLight: '#7ab04a', needle: '#2f5f3a', needleDark: '#244a2e', frond: '#5a9a3a',
  ground: '#5f8a3a', groundDark: '#4f7a32', soil: '#4a3a2a', log: '#7a5a3a', moss: '#5a7a3a', fern: '#4f9a3a', berry: '#c8302a',
};
export const COLORWAYS = {
  'default': { ...BASE },
  autumn: { ...BASE, leaf: '#d8802a', leafDark: '#b8502a', leafLight: '#e8b83a', ground: '#8a7a3a', groundDark: '#7a6a32', fern: '#a88a3a', frond: '#8a9a3a' },
  winter: { ...BASE, leaf: '#9a9a8a', leafDark: '#8a8a7a', leafLight: '#c8ccc8', needle: '#2a4a3a', ground: '#e8eef2', groundDark: '#d8e0e8', fern: '#7a8a7a', moss: '#e0e6ea' },
  spring: { ...BASE, leaf: '#8ac85a', leafDark: '#6aa84a', leafLight: '#f0c8d8', fern: '#7ac85a' },
  tropical: { ...BASE, leaf: '#3a9a3a', leafDark: '#2a7a2a', frond: '#4aa83a', ground: '#6a9a4a', trunk: '#8a7050' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  species: { type: 'choice', default: 'mixed', options: ['mixed', 'pine', 'broadleaf', 'birch', 'willow', 'palm'], label: 'Trees', affects: 'geometry', describe: 'Species (mixed = pines, broadleaves and birches).' },
  count: { type: 'range', default: 14, min: 1, max: 60, step: 1, label: 'Trees', affects: 'geometry', describe: 'Number of trees.' },
  radius: { type: 'range', default: 10, min: 2, max: 40, step: 0.5, unit: 'm', label: 'Radius', affects: 'geometry', describe: 'Size of the grove.' },
  height: { type: 'range', default: 9, min: 2, max: 30, step: 0.5, unit: 'm', label: 'Height', affects: 'geometry', describe: 'Typical tree height.' },
  variation: { type: 'range', default: 0.35, min: 0, max: 1, step: 0.05, label: 'Variation', affects: 'geometry', describe: 'Height variation.' },
  undergrowth: { type: 'toggle', default: true, label: 'Undergrowth', affects: 'geometry', describe: 'Bushes, ferns and grass.' },
  logs: { type: 'range', default: 2, min: 0, max: 6, step: 1, label: 'Fallen Logs', affects: 'geometry', describe: 'Mossy fallen trunks.' },
  wind: { type: 'range', default: 0.35, min: 0, max: 1, step: 0.05, label: 'Wind', affects: 'geometry', describe: 'Canopy sway.' },
  showGround: { type: 'toggle', default: true, label: 'Ground', affects: 'geometry', describe: 'Ground patch under the grove (off for placing on terrain).' },
  seed: { type: 'range', default: 9, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {};
export const detach = ['trees', 'undergrowth', 'ground'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'tree-grove';
  const P = partsBag();
  const r = rng(p.seed), Rg = p.radius, S = Rg * 2 + 4;
  const hG = (x, z) => (p.showGround ? 0.25 * (fbm2(x * 0.08, z * 0.08, p.seed) - 0.5) : 0);
  if (p.showGround) {
    const gp = P.sub('ground', [0, 0, 0]), n = Math.max(16, Math.round(S / 0.8));
    gp.solid.push({ g: heightField(S, S, n, n, hG, (x, y, z) => (noise2(x * 0.3, z * 0.3, p.seed) > 0.5 ? C.ground : C.groundDark)), c: null, n: 'ground' });
    dioramaSkirt(gp.solid, null, S, S, n, n, hG, -1, [C.groundDark, C.soil, C.soil]);
  }
  const spots = [];
  for (let tries = 0; tries < p.count * 40 && spots.length < p.count; tries++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * Rg, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (spots.some((q) => Math.hypot(q[0] - x, q[1] - z) < p.height * 0.28)) continue;
    spots.push([x, z]);
  }
  const tr = P.sub('trees', [0, 0, 0]), anchors = [];
  spots.forEach(([x, z], i) => {
    const mk = anchorMark(tr), ai = anchors.length;
    anchors.push([x, z, 'tree']);
    const kind = p.species === 'mixed' ? ['pine', 'broadleaf', 'birch', 'pine', 'broadleaf'][Math.floor(r() * 5)] : p.species;
    const ht = p.height * (1 - p.variation * 0.5 + r() * p.variation), y = hG(x, z), from = tr.solid.length, ph = x * 0.3 + z * 0.2, sd = p.seed * 31 + i;
    if (kind === 'pine') addPine(tr.solid, x, y, z, ht, [C.trunk, C.needle, C.needleDark], sd);
    else if (kind === 'birch') addBirch(tr.solid, x, y, z, ht, [C.bark, C.mark, C.leafLight, C.leaf], sd);
    else if (kind === 'willow') addWillow(tr.solid, tr.sway, x, y, z, ht, [C.trunk, C.leaf, C.leafDark], sd);
    else if (kind === 'palm') addPalm(tr.solid, x, y, z, ht, [C.trunk, C.frond, C.leafDark], sd);
    else addBroadleaf(tr.solid, x, y, z, ht, [C.trunk, C.leaf, C.leafDark], sd);
    swayCanopy(tr.solid, tr.sway, from, y + ht * 0.3, y + ht * 1.1, ph);
    anchorTag(tr, mk, ai);
  });
  if (p.undergrowth) {
    const ug = P.sub('undergrowth', [0, 0, 0]);
    for (let i = 0; i < Math.round(Rg * Rg * 0.35); i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * (Rg + 1), x = Math.cos(a) * d, z = Math.sin(a) * d, y = hG(x, z), k = r(), ph = x * 0.4 + z * 0.3, mk = anchorMark(ug), ai = anchors.length;
      anchors.push([x, z, 'plant']);
      if (k < 0.3) { const rr = 0.35 + r() * 0.5; ug.sway.push({ g: swayify(new THREE.IcosahedronGeometry(rr, 0).scale(1.2, 0.8, 1).translate(x, y + rr * 0.6, z), ph, y, y + rr * 2), c: r() < 0.5 ? C.leaf : C.leafDark, n: 'bush' }); if (r() < 0.3) ug.solid.push({ g: new THREE.IcosahedronGeometry(0.05, 0).translate(x + rr * 0.6, y + rr * 0.9, z), c: C.berry, n: 'berries' }); }
      else if (k < 0.6) { for (let f = 0; f < 6; f++) { const fa = (f / 6) * 6.28 + r(), L = 0.5 + r() * 0.4; ug.sway.push({ g: swayify(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([x, y, z, x + Math.cos(fa) * L, y + L * 0.55, z + Math.sin(fa) * L, x + Math.cos(fa + 0.25) * L * 0.6, y + L * 0.7, z + Math.sin(fa + 0.25) * L * 0.6], 3)), ph, y, y + L), c: C.fern, n: 'fern' }); } }
      else { const ht = 0.3 + r() * 0.3; for (let b = 0; b < 3; b++) ug.sway.push({ g: swayify(new THREE.ConeGeometry(0.035, ht, 3, 1, true).translate(0, ht / 2, 0).rotateZ((b - 1) * 0.35).rotateY(r() * 6.28).translate(x, y, z), ph, y, y + ht), c: C.groundDark, n: 'grass' }); }
      anchorTag(ug, mk, ai);
    }
    for (let i = 0; i < p.logs; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * Rg * 0.8, x = Math.cos(a) * d, z = Math.sin(a) * d, L = p.height * (0.35 + r() * 0.3), rr = 0.12 + r() * 0.12, rot = r() * 6.28, mk = anchorMark(ug), ai = anchors.length;
      anchors.push([x, z, 'plant']);
      ug.solid.push({ g: new THREE.CylinderGeometry(rr, rr * 1.1, L, 8).rotateZ(Math.PI / 2).rotateY(rot).translate(x, hG(x, z) + rr * 0.8, z), c: C.log, n: 'log' });
      for (let m = 0; m < 3; m++) { const t = (m / 2 - 0.5) * L * 0.7; ug.solid.push({ g: new THREE.IcosahedronGeometry(rr * 0.75, 0).scale(1.2, 0.5, 1).translate(x + Math.cos(-rot) * t, hG(x, z) + rr * 1.55, z + Math.sin(-rot) * t), c: C.moss, n: 'moss' }); }
      anchorTag(ug, mk, ai);
    }
  }
  const swayMat = makeSwayMaterial({ amp: 0.08 + p.wind * 0.35, freq: 0.9 + p.wind, dir: [1, 0.3] });
  g.userData.heightAt = hG;
  g.userData.view = { target: [0, p.height * 0.4, 0], radius: Math.max(Rg * 2.4, p.height * 2.5) };
  return finalize(g, P, p, C, { swayMat, drape: p.showGround ? null : anchors });
}
export default createAsset;
