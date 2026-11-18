/**
 * TERRA / LANDSCAPE COMPOSITION
 * Independently reusable terrain, pine, and stone assets. MIT license.
 * Quick start: import { createScene } from './scene.mjs'; scene.add(createScene());
 */
import * as THREE from 'three';
import { createAsset as createTerrain } from './terrain.mjs';
import { createAsset as createPine } from './alpine-pine.mjs';
import { createAsset as createRock } from './field-rock.mjs';

export const sceneParams = {
  vegetation: { type: 'toggle', default: true, label: 'Vegetation', affects: 'geometry', describe: 'Place individually selectable trees on suitable terrain.' },
  density: { type: 'range', default: 0.48, min: 0, max: 1, step: 0.01, label: 'Tree density', affects: 'geometry', describe: 'Density of deterministic forest clusters.' },
  rocks: { type: 'toggle', default: true, label: 'Scattered rocks', affects: 'geometry', describe: 'Place weathered stones along the landscape.' }
};
const DEFAULT_SCENE_OPTIONS = {};
export function createScene(options = {}, heightData = null) {
  const opts = { ...Object.fromEntries(Object.entries(sceneParams).map(([key, schema]) => [key, schema.default])), ...DEFAULT_SCENE_OPTIONS, ...options };
  const group = new THREE.Group(); group.name = 'terra-landscape';
  const terrain = createTerrain(opts); group.add(terrain);
  if (heightData) terrain.userData.setHeightData(heightData);
  const p = terrain.userData.params, trees = new THREE.Group(), rocks = new THREE.Group(); trees.name = 'vegetation'; rocks.name = 'rocks';
  let seed = Number(p.seed) >>> 0;
  const random = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
  const count = Math.round(225 * Math.min(1, Math.max(0, opts.density)) * (p.size / 128));
  const canGrow = opts.vegetation && !['desert', 'volcanic', 'canyon'].includes(p.terrainType);
  let placed = 0;
  if (canGrow) for (let attempt = 0; attempt < count * 15 && placed < count; attempt++) {
    const x = (random() - 0.5) * p.size * 0.96, z = (random() - 0.5) * p.size * 0.96;
    const y = terrain.userData.sampleHeight(x, z), slope = Math.abs(terrain.userData.sampleHeight(x + 1, z) - y) + Math.abs(terrain.userData.sampleHeight(x, z + 1) - y);
    if (y < p.waterLevel + 1.1 || y > p.elevation * 0.49 + 5 || slope > 1.3) continue;
    if (trees.children.some((tree) => Math.hypot(tree.position.x - x, tree.position.z - z) < 3)) continue;
    const height = 3.5 + random() * 3.7;
    const tree = createPine({ height, radius: height * (0.19 + random() * 0.035), tiers: 4, colorway: p.colorway, mergeForProduction: p.mergeForProduction });
    tree.name = `pine_${String(placed + 1).padStart(3, '0')}`; tree.position.set(x, y - 0.07, z); tree.rotation.y = random() * Math.PI * 2; tree.userData.placed = true; trees.add(tree); placed++;
  }
  seed = (Number(p.seed) + 58217) >>> 0;
  if (opts.rocks) for (let i = 0; i < 45; i++) {
    const x = (random() - 0.5) * p.size * 0.96, z = (random() - 0.5) * p.size * 0.96, y = terrain.userData.sampleHeight(x, z);
    if (y < p.waterLevel - 0.3 || y > p.elevation * 0.82) continue;
    const radius = 0.45 + random() * 1.25;
    const rock = createRock({ radius, height: radius * (0.65 + random() * 0.6), seed: Math.floor(random() * 9999), colorway: p.colorway, mergeForProduction: p.mergeForProduction });
    rock.name = `rock_${String(i + 1).padStart(3, '0')}`; rock.position.set(x, y - 0.2, z); rock.rotation.y = random() * Math.PI * 2; rock.userData.placed = true; rocks.add(rock);
  }
  group.add(trees, rocks);
  group.userData.terrain = terrain;
  group.userData.reseatProps = () => {
    for (const parent of [trees, rocks]) for (const item of parent.children) { const y = terrain.userData.sampleHeight(item.position.x, item.position.z); item.position.y = y - 0.1; item.visible = parent === rocks ? y > p.waterLevel - 0.3 : y > p.waterLevel + 0.7; }
  };
  return group;
}
export default createScene;