/**
 * TERRA / FIELD ROCK (High Detail)
 * Continuous weathered stone with three biome-shaped silhouettes and facet colours.
 * No textures, no loaders, one draw call.
 *
 * QUICK START  import { createAsset } from './field-rock.mjs';
 *              scene.add(createAsset({ shape: 'bluff', colorway: 'autumn' }));
 * SPECS  boulder = rounded glacial till · bluff = flat-topped badlands cap · shard = angular clinker.
 *        80-190 triangles, 1 material, 1 unit = 1 meter, Y-up.
 * PARTS  animate: stone (y).  detach: stone, chips.  Doubles as an InstancedMesh source.
 * LICENSE  MIT.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = { stone: '#a4a599', shadow: '#7c8476', moss: '#7c8b60', iron: '#8c6a53' };

export const COLORWAYS = {
  verdant:   { ...BASE },
  autumn:    { stone: '#baab92', shadow: '#92866f', moss: '#91915f', iron: '#9d6a48' },
  moonstone: { stone: '#a2adb0', shadow: '#77888c', moss: '#708d82', iron: '#7d8794' },
  dusk:      { stone: '#948d99', shadow: '#6e6878', moss: '#71806f', iron: '#8b5f4e' }
};
export const presets = COLORWAYS;

export const SHAPES = {
  boulder: { radius: 1.2, height: 1.4, label: 'Boulder' },
  bluff:   { radius: 2.4, height: 1.1, label: 'Bluff' },
  shard:   { radius: 0.9, height: 2.6, label: 'Shard' }
};
export const shapeDefaults = SHAPES;

export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for production', affects: 'geometry', describe: 'One merged mesh and draw call when true; stone and chips stay individually selectable when false.' },
  shape: { type: 'choice', default: 'boulder', options: Object.keys(SHAPES), label: 'Shape', affects: 'geometry', describe: 'boulder = rounded glacial till · bluff = flat-topped badlands cap · shard = angular volcanic clinker.' },
  colorway: { type: 'choice', default: 'verdant', options: Object.keys(COLORWAYS), label: 'Colorway', affects: 'colors', describe: 'Curated stone, shadow and moss palette.' },
  radius: { type: 'range', default: 1.2, min: 0.3, max: 4, step: 0.1, label: 'Radius', affects: 'geometry', describe: 'Footprint radius in meters. Surface vertices are rebuilt, never uniformly scaled.' },
  height: { type: 'range', default: 1.5, min: 0.25, max: 5, step: 0.1, label: 'Height', affects: 'geometry', describe: 'Stone height in meters.' },
  chips: { type: 'range', default: 3, min: 0, max: 6, step: 1, label: 'Debris chips', affects: 'geometry', describe: 'Satellite fragments scattered around the base.' },
  seed: { type: 'range', default: 12, min: 1, max: 99999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Deterministic weathering and facet tint pattern.' },
  ...Object.fromEntries(Object.entries(BASE).map(([key, value]) => [key, { type: 'color', default: value, label: `${key[0].toUpperCase()}${key.slice(1)} color`, affects: 'colors', describe: `Albedo of the ${key} material zone.` }]))
};

export const rig = { stone: { axis: 'y', range: [0, 360], describe: 'Rotate the stone about its base.' } };
export const detach = ['stone', 'chips'];
export const night = {};

const ZONE_KEYS = Object.keys(BASE);
const hexOf = (v) => typeof v === 'number' && Number.isFinite(v) ? v & 0xffffff : typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v) ? parseInt(v.replace('#', ''), 16) : null;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;

function zonesFor(name, overrides = {}) {
  const cw = COLORWAYS[name] || COLORWAYS.verdant;
  const used = new Set(), out = {};
  for (const key of ZONE_KEYS) {
    let hex = (hexOf(overrides[key]) ?? hexOf(cw[key]) ?? 0x888888) & 0xffffff;
    while (used.has(hex)) hex = (hex + 1) & 0xffffff;
    used.add(hex); out[key] = hex;
  }
  return out;
}

function prep(geometry, hex) {
  let geo = geometry;
  if (geo.index) { geo = geo.toNonIndexed(); geometry.dispose(); }
  geo.deleteAttribute('uv'); geo.deleteAttribute('normal');
  if (hex !== null || !geo.getAttribute('color')) {
    const c = new THREE.Color(hex ?? 0xffffff), colors = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  return geo;
}

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.98, metalness: 0, side: THREE.DoubleSide });

function finish(list, material = MAT, name = 'solid', merge = true) {
  if (!list.length) return null;
  if (merge) {
    const prepared = list.map((p) => prep(p.g, p.c)), geo = mergeGeometries(prepared);
    prepared.forEach((item) => item.dispose());
    if (!geo) return null;
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
  const group = new THREE.Group(); group.name = name;
  const chips = new THREE.Group(); chips.name = 'chips'; group.add(chips);
  list.forEach((part, i) => {
    const geo = prep(part.g, part.c); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = part.name || `${name}_part_${i + 1}`;
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.zone = part.zone || name;
    (part.zone === 'chips' ? chips : group).add(mesh);
  });
  return group;
}

export function createAsset(userParams = {}) {
  const p = {};
  for (const key of Object.keys(params)) p[key] = params[key].default;
  Object.assign(p, userParams);
  for (const [key, s] of Object.entries(params)) {
    if (s.type === 'range') p[key] = Math.max(s.min, Math.min(s.max, Number.isFinite(+p[key]) ? +p[key] : s.default));
    else if (s.type === 'choice') p[key] = s.options.includes(p[key]) ? p[key] : s.default;
    else if (s.type === 'toggle') p[key] = Boolean(p[key]);
  }
  const zones = zonesFor(p.colorway, userParams), g = new THREE.Group();
  g.name = `rock-${p.shape}`;
  const parts = [];
  const hash = (i, j) => { const n = Math.sin(i * 91.7 + j * 47.3 + p.seed * 0.31) * 43758.5453; return n - Math.floor(n); };

  const geo = new THREE.IcosahedronGeometry(1, p.shape === 'shard' ? 0 : 1), pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (p.shape === 'boulder') {
      const warp = 1 + Math.sin(x * 5.1 + z * 3.4 + p.seed) * 0.16;
      pos.setXYZ(i, x * p.radius * warp * 1.08, Math.max(-0.12, (y + 0.8) * p.height * 0.56), z * p.radius * warp * 0.92);
    } else if (p.shape === 'bluff') {
      const level = mix(-p.height * 0.5, p.height * 0.5, clamp01((y + 1) / 2));
      const flare = 1 + (1 - clamp01((y + 1) / 2)) * 0.42;
      const cap = y > 0.12 ? 1 : 0.55 + y * 0.5;
      const warp = .96 + Math.sin(x * 3.7 + y * 2.1 + z * 5.3 + p.seed) * .06;
      pos.setXYZ(i, x * p.radius * flare * warp * cap, y > 0.12 ? p.height * 0.5 : level * 0.72, z * p.radius * flare * warp * cap);
    } else {
      const stretch = 1 + Math.abs(y) * 1.5;
      const warp = .74 + Math.sin(x * 2.5 + y * 4.1 + z * 3.4 + p.seed) * .17;
      pos.setXYZ(i, x * p.radius * warp * stretch * .8, y > 0 ? y * p.height * stretch * .62 : -p.height * .12, z * p.radius * warp * stretch * .8);
    }
  }
  const colors = [];
  const stone = new THREE.Color(zones.stone), shade = new THREE.Color(zones.shadow), moss = new THREE.Color(zones.moss), iron = new THREE.Color(zones.iron);
  for (let i = 0; i < pos.count; i += 3) {
    const average = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const t = clamp01(average / Math.max(0.2, p.height) + 0.5);
    const c = shade.clone().lerp(stone, Math.min(1, t + 0.28));
    if (t < 0.22) c.lerp(moss, 0.36);
    if (p.shape === 'bluff') c.lerp(iron, 0.2 + Math.abs(Math.sin(t * 9.4 + p.seed)) * 0.22);
    c.multiplyScalar(0.94 + hash(i, 7) * 0.12);
    for (let j = 0; j < 3; j++) colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  parts.push({ g: geo, c: null, name: 'stone', zone: 'stone' });

  for (let i = 0; i < p.chips; i++) {
    const angle = hash(i, 11) * Math.PI * 2, dist = p.radius * (1.15 + hash(i, 13) * 0.9);
    const size = p.radius * (0.1 + hash(i, 17) * 0.22);
    const chip = new THREE.IcosahedronGeometry(size, 0);
    chip.scale(1, 0.7 + hash(i, 19) * 0.5, 1);
    chip.translate(Math.cos(angle) * dist, size * 0.3, Math.sin(angle) * dist);
    parts.push({ g: chip, c: hash(i, 23) > 0.62 ? zones.moss : zones.shadow, name: `chip_${i + 1}`, zone: 'chips' });
  }

  const solid = finish(parts, MAT.clone(), 'rock', p.mergeForProduction);
  if (solid) g.add(solid);
  g.userData.params = p;
  return g;
}

export default createAsset;
