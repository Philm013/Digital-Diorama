/**
 * TERRA / LIVING TERRAIN (High Detail)
 * Procedural, texture-free terrain with editable height fields and geological strata.
 *
 * QUICK START
 *   import { createAsset } from './terrain.mjs';
 *   scene.add(createAsset({ terrainType: 'alpine', mergeForProduction: true }));
 *
 * SPECS  Default: 128 x up to 47 x 128 m, approximately 16,600 triangles.
 *        One solid material + one water material; two production draw calls.
 * OPTIONS  Six terrain types, footprint, elevation, roughness, seed, resolution,
 *          water level, snow line, geological base, and three colorways.
 * PARTS  animate: water (Y). detach: terrain, bedrock, water (editing mode).
 * LICENSE  MIT. Generated geometry may be used in personal or commercial projects.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = {
  meadow: '#81985c', forest: '#536e41', summit: '#e9ede4', stone: '#929285',
  shore: '#b4b18b', soil: '#8b775d', strata: '#b09c7d', bedrock: '#695f50', water: '#63b9b2',
  sand: '#d2b183', sandstone: '#b67e5c', basalt: '#676f67'
};
export const COLORWAYS = {
  default: { ...BASE },
  autumn: { ...BASE, meadow: '#b4a166', forest: '#817a42', summit: '#f2e9d8', stone: '#a99b84', water: '#77aca3', sand: '#d4ac75', sandstone: '#c38b63', basalt: '#7b7464' },
  moonstone: { ...BASE, meadow: '#80958b', forest: '#496b61', summit: '#e4ecec', stone: '#858c92', shore: '#b6bab0', water: '#76b7c5', sand: '#c9c4ad', sandstone: '#a69285', basalt: '#687681' }
};
export const presets = COLORWAYS;
export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for production', affects: 'geometry', describe: 'Merge opaque parts into one selectable mesh and water into a second draw call. Disable to edit separate parts.' },
  terrainType: { type: 'choice', default: 'alpine', options: ['alpine', 'hills', 'desert', 'islands', 'canyon', 'volcanic'], label: 'Landscape', affects: 'geometry', describe: 'Mathematical terrain profile and biome.' },
  size: { type: 'range', default: 128, min: 64, max: 256, step: 16, label: 'Terrain size', affects: 'geometry', describe: 'Square footprint in meters. Recalculates vertex coordinates and landscape features.' },
  elevation: { type: 'range', default: 32, min: 8, max: 64, step: 1, label: 'Elevation', affects: 'geometry', describe: 'Height of the main mountain features in meters, above the valley floor.' },
  roughness: { type: 'range', default: 0.58, min: 0, max: 1, step: 0.01, label: 'Roughness', affects: 'geometry', describe: 'Amplitude of multi-octave, seeded geological detail.' },
  resolution: { type: 'choice', default: 80, options: [40, 64, 80, 112], label: 'Mesh resolution', affects: 'geometry', describe: 'Grid subdivisions per axis. Adjacent triangles share exact corner positions.' },
  seed: { type: 'range', default: 4829, min: 1, max: 99999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Deterministic seed for the terrain and river course.' },
  water: { type: 'toggle', default: true, label: 'Water', affects: 'geometry', describe: 'Show the water surface in river channels and low-lying basins.' },
  waterLevel: { type: 'range', default: 3.8, min: 0, max: 16, step: 0.2, label: 'Water level', affects: 'geometry', describe: 'Water elevation in meters. Land occludes the continuous water plane.' },
  snow: { type: 'toggle', default: true, label: 'Snow caps', affects: 'colors', describe: 'Color high alpine elevations with an irregular natural snow line.' },
  snowLine: { type: 'range', default: 0.68, min: 0.35, max: 0.95, step: 0.01, label: 'Snow line', affects: 'colors', describe: 'Snow threshold as a proportion of mountain elevation.' },
  base: { type: 'toggle', default: true, label: 'Terrain base', affects: 'geometry', describe: 'Show the closed, layered geological cutaway beneath the terrain.' },
  colorway: { type: 'choice', default: 'default', options: Object.keys(COLORWAYS), label: 'Color palette', affects: 'colors', describe: 'Curated, collision-free material zone palette.' },
  ...Object.fromEntries(Object.entries(BASE).map(([key, value]) => [key === 'water' ? 'waterTint' : key, { type: 'color', default: value, label: `${key[0].toUpperCase()}${key.slice(1)} color`, affects: 'colors', describe: `Vertex albedo for the ${key} material zone.` }]))
};
export const rig = { water: { axis: 'y', range: [-1, 3], describe: 'Raise or lower water relative to its authored level.' } };
export const detach = ['terrain', 'bedrock', 'water'];
export const night = { water: { color: '#5da9ae', intensity: 0.22, distance: 0, describe: 'A subtle cool glow across the water.' } };

const DEFAULT_OPTIONS = {};
const BAKED_HEIGHTS = null;
const ZONE_KEYS = Object.keys(BASE);
const hexOf = (v) => typeof v === 'number' && Number.isFinite(v) ? v & 0xffffff : typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v) ? parseInt(v.replace('#', ''), 16) : null;
function zonesFor(name, overrides = {}) {
  const cw = COLORWAYS[name] || COLORWAYS.default;
  const used = new Set(), out = {};
  for (const key of ZONE_KEYS) {
    let hex = (hexOf(overrides[key === 'water' ? 'waterTint' : key]) ?? hexOf(cw[key]) ?? 0x888888) & 0xffffff;
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
    const color = new THREE.Color(hex ?? 0xffffff);
    const colors = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  return geo;
}
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.96, metalness: 0, side: THREE.DoubleSide });
const GLASS_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.28, metalness: 0.12, transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false, forceSinglePass: true });
function finish(list, material = MAT, name = 'solid', merge = true) {
  if (!list.length) return null;
  if (merge) {
    const prepared = list.map((part) => prep(part.g, part.c));
    const geometry = mergeGeometries(prepared);
    prepared.forEach((geo) => geo.dispose());
    if (!geometry) return null;
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
  const group = new THREE.Group(); group.name = name;
  list.forEach((part, i) => {
    const geo = prep(part.g, part.c); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = part.name || `${name}_part_${i + 1}`;
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.zone = part.zone || name;
    group.add(mesh);
  });
  return group;
}
function box(w, h, d, x = 0, y = 0, z = 0) { return new THREE.BoxGeometry(w, h, d).translate(x, y, z); }
function addCylinder(parts, rTop, rBot, h, segs, x, y, z, rx = 0, ry = 0, rz = 0, hex = '#888888') {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  geo.rotateX(rx); geo.rotateY(ry); geo.rotateZ(rz); geo.translate(x, y, z); parts.push({ g: geo, c: hex });
}
function addWire(parts, p1, p2, hex, radius = 0.01, segments = 5) {
  const a = new THREE.Vector3(...p1), b = new THREE.Vector3(...p2), distance = a.distanceTo(b);
  if (distance < 1e-5) return;
  const geo = new THREE.CylinderGeometry(radius, radius, distance, segments);
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  geo.applyQuaternion(rotation); geo.translate(...a.lerp(b, 0.5).toArray()); parts.push({ g: geo, c: hex });
}
function addExtrusion(parts, shape, depth, hex) {
  parts.push({ g: new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1, curveSegments: 10 }), c: hex });
}
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hash(x, z, seed) { const n = Math.sin(x * 127.1 + z * 311.7 + seed * 0.0137) * 43758.5453; return n - Math.floor(n); }
function noise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return mix(mix(hash(ix, iz, seed), hash(ix + 1, iz, seed), u), mix(hash(ix, iz + 1, seed), hash(ix + 1, iz + 1, seed), u), v) * 2 - 1;
}
function fbm(x, z, seed) {
  let result = 0, amplitude = 0.57;
  for (let octave = 0; octave < 5; octave++) { result += noise(x, z, seed + octave * 71) * amplitude; x *= 2.08; z *= 2.08; amplitude *= 0.46; }
  return result;
}
export function sampleProceduralHeight(x, z, p) {
  const nx = x / (p.size / 2), nz = z / (p.size / 2);
  const n = fbm(nx * 3.1 + 12, nz * 3.1 + 8, p.seed);
  const shift = noise(1, 3, p.seed) * 0.13;
  const peak = (cx, cz, wx, wz, height) => Math.pow(Math.max(0, 1 - Math.hypot((nx - cx - shift) / wx, (nz - cz) / wz)), 1.12) * height;
  let h;
  if (p.terrainType === 'hills') {
    h = 5.2 + p.elevation * (0.17 + 0.13 * Math.sin(nx * 4.3 + nz * 1.6) + 0.1 * Math.cos(nz * 5.3 - nx) + n * p.roughness * 0.26);
  } else if (p.terrainType === 'desert') {
    const dune = Math.sin(nx * 6.4 + Math.sin(nz * 3.1 + shift) * 1.3);
    h = 4 + p.elevation * (0.13 + Math.pow((dune + 1) / 2, 1.8) * 0.55 + n * p.roughness * 0.13);
  } else if (p.terrainType === 'islands') {
    const land = Math.max(peak(-0.38, -0.28, 0.67, 0.65, 0.95), peak(0.48, 0.24, 0.45, 0.52, 0.6), peak(-0.44, 0.63, 0.33, 0.3, 0.39));
    return Math.max(-1.6, -2.5 + land * p.elevation + n * p.roughness * 3.8);
  } else if (p.terrainType === 'canyon') {
    const channel = Math.abs(nx - Math.sin(nz * 2.5 + shift) * 0.35);
    const terrace = Math.floor(smooth(0.11, 0.7, channel) * 5) / 5;
    h = 2 + p.elevation * terrace * 0.85 + n * p.roughness * 3.8;
  } else if (p.terrainType === 'volcanic') {
    const radius = Math.hypot(nx + 0.05, nz + 0.16);
    h = 3 + p.elevation * Math.max(0, 1 - radius / 1.07) * 1.25;
    h -= Math.exp(-radius * radius / 0.035) * p.elevation * 0.78;
    h += n * p.roughness * 7;
    return Math.max(0.6, h);
  } else {
    const mountains = Math.max(peak(-0.52, -0.24, 0.59, 0.72, 1.05), peak(-0.03, -0.67, 0.48, 0.49, 0.86), peak(0.57, -0.48, 0.44, 0.58, 0.83));
    const foothills = peak(-0.64, 0.57, 0.73, 0.73, 0.27) + peak(0.63, 0.38, 0.56, 0.7, 0.3);
    h = 5.5 + p.elevation * (mountains + foothills + n * p.roughness * 0.3);
  }
  if (p.terrainType !== 'desert') {
    const center = 0.12 + 0.3 * Math.sin(nz * 2.9 + 0.8 + shift);
    const distance = Math.abs(nx - center + n * 0.015);
    const width = p.terrainType === 'canyon' ? 0.085 : 0.052 + 0.017 * (nz + 1);
    const river = 1 - smooth(width, width + 0.077, distance);
    const lakeRadius = Math.hypot((nx - 0.3) / 0.36, (nz - 0.58) / 0.37);
    const lake = p.terrainType === 'alpine' || p.terrainType === 'hills' ? 1 - smooth(0.7, 1.07, lakeRadius) : 0;
    h = mix(h, p.waterLevel - 1.55 + n * 0.4, Math.max(river, lake));
  }
  return Math.max(-2, h);
}

export function createAsset(userParams = {}) {
  const p = Object.fromEntries(Object.entries(params).map(([key, schema]) => [key, schema.default]));
  Object.assign(p, DEFAULT_OPTIONS, userParams);
  for (const [key, schema] of Object.entries(params)) {
    if (schema.type === 'range') p[key] = clamp(Number.isFinite(Number(p[key])) ? Number(p[key]) : schema.default, schema.min, schema.max);
    if (schema.type === 'choice' && !schema.options.includes(p[key])) p[key] = schema.default;
    if (schema.type === 'toggle' && typeof p[key] !== 'boolean') p[key] = schema.default;
  }
  p.resolution = [40, 64, 80, 112].includes(Number(p.resolution)) ? Number(p.resolution) : 80;
  const C = zonesFor(p.colorway, { ...DEFAULT_OPTIONS, ...userParams });
  const colors = Object.fromEntries(Object.entries(C).map(([key, value]) => [key, new THREE.Color(value)]));
  const customSurface = hexOf(userParams.meadow ?? DEFAULT_OPTIONS.meadow) !== null;
  const g = new THREE.Group(); g.name = 'living-terrain';
  const solidMaterial = MAT.clone(), waterMaterial = GLASS_MAT.clone();
  const N = p.resolution, stride = N + 1, half = p.size / 2;
  const heights = new Float32Array(stride * stride);
  for (let iz = 0; iz <= N; iz++) for (let ix = 0; ix <= N; ix++) heights[iz * stride + ix] = sampleProceduralHeight(ix / N * p.size - half, iz / N * p.size - half, p);
  const matchesBakedShape = ['terrainType', 'size', 'elevation', 'roughness', 'resolution', 'seed'].every((key) => p[key] === (DEFAULT_OPTIONS[key] ?? params[key].default));
  if (BAKED_HEIGHTS && BAKED_HEIGHTS.length === heights.length && matchesBakedShape) heights.set(BAKED_HEIGHTS);
  const vertexMap = [];
  let editableSurface = null;
  const sideMaps = [];

  function stratumHeight(id, level, variation) {
    if (level === 0) return -7;
    if (level === 1) return Math.min(-4.7 + variation, heights[id] - 1.8);
    if (level === 2) return Math.min(-1.8 + variation, heights[id] - 1.1);
    return heights[id] - (level === 3 ? 0.65 : 0);
  }

  function colorAt(x, y, z, slope = 0) {
    const detail = noise(x * 0.19, z * 0.19, p.seed);
    let color;
    if (p.terrainType === 'desert') color = (customSurface ? colors.meadow : colors.sand).clone().multiplyScalar(0.88 + clamp(y / p.elevation, 0, 1) * 0.3);
    else if (p.terrainType === 'canyon') color = (customSurface ? colors.meadow : colors.sandstone).clone().multiplyScalar(0.88 + (Math.sin(y * 1.6) + 1) * 0.16);
    else if (p.terrainType === 'volcanic') color = (customSurface ? colors.meadow : colors.basalt).clone().multiplyScalar(0.9 - clamp(y / p.elevation, 0, 1) * 0.25);
    else {
      color = colors.meadow.clone().lerp(colors.forest, clamp((detail + 0.2) * 0.5 + slope * 0.07, 0, 0.65));
      if (y < p.waterLevel + 1.25) color.lerp(colors.shore, 1 - smooth(p.waterLevel - 0.3, p.waterLevel + 1.25, y));
      const rockAmount = smooth(p.elevation * 0.42 + 5, p.elevation * 0.68 + 5, y + detail * 3);
      color.lerp(colors.stone, rockAmount);
      if (p.snow && p.terrainType === 'alpine') color.lerp(colors.summit, smooth(p.elevation * p.snowLine + 3, p.elevation * p.snowLine + 5.8, y + detail * 2.5));
    }
    return color.multiplyScalar(0.96 + hash(Math.round(x * 3), Math.round(z * 3), p.seed) * 0.095);
  }
  function build() {
    g.traverse((object) => { if (object.isMesh) object.geometry.dispose(); });
    g.clear(); vertexMap.length = 0; sideMaps.length = 0;
    const parts = [], glassParts = [], positions = [], vertexColors = [];
    const triangle = (a, b, c) => {
      const ids = [a, b, c];
      const avg = (heights[a] + heights[b] + heights[c]) / 3;
      const cx = ids.reduce((sum, id) => sum + (id % stride) / N * p.size - half, 0) / 3;
      const cz = ids.reduce((sum, id) => sum + Math.floor(id / stride) / N * p.size - half, 0) / 3;
      const slope = Math.max(Math.abs(heights[a] - heights[b]), Math.abs(heights[b] - heights[c])) / (p.size / N);
      const color = colorAt(cx, avg, cz, slope);
      for (const id of ids) {
        positions.push((id % stride) / N * p.size - half, heights[id], Math.floor(id / stride) / N * p.size - half);
        vertexColors.push(color.r, color.g, color.b); vertexMap.push(id);
      }
    };
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const a = z * stride + x, b = a + 1, c = a + stride, d = c + 1;
      if ((x + z) % 2) { triangle(a, c, b); triangle(b, c, d); } else { triangle(a, d, b); triangle(a, c, d); }
    }
    const surface = new THREE.BufferGeometry();
    surface.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    surface.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
    parts.push({ g: surface, c: null, name: 'terrain', zone: 'meadow' });
    const edges = [Array.from({ length: stride }, (_, i) => i), Array.from({ length: stride }, (_, i) => i * stride + N), Array.from({ length: stride }, (_, i) => N * stride + N - i), Array.from({ length: stride }, (_, i) => (N - i) * stride)];
    if (p.base) {
      edges.forEach((edge, side) => {
        const pos = [], cols = [], topIndices = [];
        for (let i = 0; i < N; i++) {
          const a = edge[i], b = edge[i + 1];
          const ax = a % stride / N * p.size - half, az = Math.floor(a / stride) / N * p.size - half;
          const bx = b % stride / N * p.size - half, bz = Math.floor(b / stride) / N * p.size - half;
          const variationA = noise(ax * 0.09, az * 0.09, p.seed) * 0.35;
          const variationB = noise(bx * 0.09, bz * 0.09, p.seed) * 0.35;
          const levelsA = Array.from({ length: 5 }, (_, layer) => stratumHeight(a, layer, variationA));
          const levelsB = Array.from({ length: 5 }, (_, layer) => stratumHeight(b, layer, variationB));
          for (let level = 0; level < 4; level++) {
            const c = (level === 0 ? colors.bedrock : level === 1 ? colors.strata : level === 2 ? colors.soil : colors.forest).clone().multiplyScalar(0.9 + hash(i, side + level, p.seed) * 0.14);
            const vertices = [[ax, levelsA[level], az, a, level], [bx, levelsB[level], bz, b, level], [bx, levelsB[level + 1], bz, b, level + 1], [ax, levelsA[level], az, a, level], [bx, levelsB[level + 1], bz, b, level + 1], [ax, levelsA[level + 1], az, a, level + 1]];
            for (const v of vertices) { if (v[4] >= 1) topIndices.push({ index: pos.length / 3, id: v[3], layer: v[4], variation: v[3] === a ? variationA : variationB }); pos.push(v[0], v[1], v[2]); cols.push(c.r, c.g, c.b); }
          }
        }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        parts.push({ g: geo, c: null, name: `bedrock_${side + 1}`, zone: 'soil' }); sideMaps.push({ geo, indices: topIndices });
      });
      parts.push({ g: box(p.size, 0.22, p.size, 0, -7.11, 0), c: C.bedrock, name: 'bedrock', zone: 'bedrock' });
    }
    if (p.water) {
      const waterGeo = new THREE.PlaneGeometry(p.size, p.size, 24, 24).rotateX(-Math.PI / 2).translate(0, p.waterLevel, 0);
      glassParts.push({ g: waterGeo, c: C.water, name: 'water', zone: 'water' });
      // Clip the visible water cutaway to the exact shoreline on each tile edge.
      edges.forEach((edge, side) => {
        const positions = [];
        for (let i = 0; i < N; i++) {
          const a = edge[i], b = edge[i + 1];
          let ay = heights[a], by = heights[b];
          if (ay >= p.waterLevel && by >= p.waterLevel) continue;
          let ax = a % stride / N * p.size - half, az = Math.floor(a / stride) / N * p.size - half;
          let bx = b % stride / N * p.size - half, bz = Math.floor(b / stride) / N * p.size - half;
          if (ay > p.waterLevel) { const t = (p.waterLevel - ay) / (by - ay); ax = mix(ax, bx, t); az = mix(az, bz, t); ay = p.waterLevel; }
          else if (by > p.waterLevel) { const t = (p.waterLevel - ay) / (by - ay); bx = mix(ax, bx, t); bz = mix(az, bz, t); by = p.waterLevel; }
          positions.push(ax, ay, az, bx, by, bz, bx, p.waterLevel, bz, ax, ay, az, bx, p.waterLevel, bz, ax, p.waterLevel, az);
        }
        if (!positions.length) return;
        const edgeGeo = new THREE.BufferGeometry(); edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        glassParts.push({ g: edgeGeo, c: C.water, name: `water_edge_${side + 1}`, zone: 'water' });
      });
    }
    const solid = finish(parts, solidMaterial, 'solid', p.mergeForProduction);
    if (solid) {
      if (!p.mergeForProduction && p.base) {
        const baseGroup = new THREE.Group(); baseGroup.name = 'bedrock';
        for (const child of [...solid.children]) if (child.name.startsWith('bedrock')) { if (child.name === 'bedrock') child.name = 'bedrock_underside'; baseGroup.add(child); }
        solid.add(baseGroup);
      }
      g.add(solid);
    }
    const water = finish(glassParts, waterMaterial, 'water', p.mergeForProduction);
    if (water) { water.traverse((object) => { if (object.isMesh) { object.castShadow = false; object.receiveShadow = true; } }); g.add(water); }
    editableSurface = p.mergeForProduction ? null : g.getObjectByName('terrain');
  }
  function refresh() {
    if (!editableSurface) { build(); return; }
    const geo = editableSurface.geometry, positions = geo.getAttribute('position'), attrColors = geo.getAttribute('color');
    for (let i = 0; i < vertexMap.length; i += 3) {
      const ids = [vertexMap[i], vertexMap[i + 1], vertexMap[i + 2]];
      const y = (heights[ids[0]] + heights[ids[1]] + heights[ids[2]]) / 3;
      const x = (positions.getX(i) + positions.getX(i + 1) + positions.getX(i + 2)) / 3;
      const z = (positions.getZ(i) + positions.getZ(i + 1) + positions.getZ(i + 2)) / 3;
      const slope = Math.max(Math.abs(heights[ids[0]] - heights[ids[1]]), Math.abs(heights[ids[1]] - heights[ids[2]])) / (p.size / N);
      const color = colorAt(x, y, z, slope);
      for (let j = 0; j < 3; j++) { positions.setY(i + j, heights[ids[j]]); attrColors.setXYZ(i + j, color.r, color.g, color.b); }
    }
    positions.needsUpdate = true; attrColors.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere(); geo.computeBoundingBox();
    sideMaps.forEach(({ geo: sideGeo, indices }) => {
      const attr = sideGeo.getAttribute('position'); indices.forEach(({ index, id, layer, variation }) => attr.setY(index, stratumHeight(id, layer, variation)));
      attr.needsUpdate = true; sideGeo.computeVertexNormals(); sideGeo.computeBoundingSphere();
    });
  }
  function sampleHeight(x, z) {
    const gx = clamp((x + half) / p.size * N, 0, N), gz = clamp((z + half) / p.size * N, 0, N);
    const ix = Math.min(N - 1, Math.floor(gx)), iz = Math.min(N - 1, Math.floor(gz)), a = iz * stride + ix;
    const tx = gx - ix, tz = gz - iz, A = heights[a], B = heights[a + 1], D = heights[a + stride + 1], Cc = heights[a + stride];
    // Match the actual triangle planes so roots and brush outlines never float.
    if ((ix + iz) % 2) return tx + tz <= 1 ? A + (B - A) * tx + (Cc - A) * tz : D + (Cc - D) * (1 - tx) + (B - D) * (1 - tz);
    return tx >= tz ? A + (B - A) * tx + (D - B) * tz : A + (D - Cc) * tx + (Cc - A) * tz;
  }
  build();
  g.userData.params = p;
  g.userData.sampleHeight = sampleHeight;
  g.userData.getHeightData = () => Array.from(heights);
  g.userData.setHeightData = (data) => {
    if (!Array.isArray(data) || data.length !== heights.length || data.some((v) => !Number.isFinite(v))) return false;
    heights.set(data.map((v) => clamp(v, -3.5, 100))); build(); return true;
  };
  g.userData.sculpt = (x, z, radius, strength, mode, targetHeight, falloff = 'soft') => {
    const previous = mode === 'smooth' ? heights.slice() : heights;
    for (let iz = 0; iz <= N; iz++) for (let ix = 0; ix <= N; ix++) {
      const wx = ix / N * p.size - half, wz = iz / N * p.size - half;
      const distance = Math.hypot(wx - x, wz - z); if (distance >= radius) continue;
      const id = iz * stride + ix, linear = 1 - distance / radius;
      const weight = falloff === 'hard' ? 1 : falloff === 'linear' ? linear : linear * linear * (3 - 2 * linear);
      if (mode === 'raise' || mode === 'lower') heights[id] += (mode === 'raise' ? 1 : -1) * strength * weight * 1.3;
      else if (mode === 'flatten') heights[id] = mix(heights[id], targetHeight, weight * strength * 0.32);
      else if (mode === 'smooth') {
        let sum = 0, count = 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const sx = clamp(ix + dx, 0, N), sz = clamp(iz + dz, 0, N); sum += previous[sz * stride + sx]; count++; }
        heights[id] = mix(heights[id], sum / count, weight * strength * 0.65);
      }
      heights[id] = clamp(heights[id], -3.5, 100);
    }
    if (p.water && (Math.abs(x) + radius >= half || Math.abs(z) + radius >= half)) build();
    else refresh();
  };
  return g;
}
export default createAsset;