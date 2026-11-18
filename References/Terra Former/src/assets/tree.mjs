/**
 * TERRA / WORLD TREE (High Detail)
 * Six biome-grown species: pine, fir, palm, acacia, broadleaf, and shrub.
 * Continuous swept silhouettes, vertex-coloured, no textures, no loaders.
 *
 * QUICK START
 *   import { createAsset } from './tree.mjs';
 *   scene.add(createAsset({ species: 'fir', height: 9, colorway: 'moonstone', mergeForProduction: true }));
 *
 * SPECS  pine/fir 1.8-4.2 x 2.4-16 m · palm 3.4 x 3-8 m · acacia 6 x 3.4-6 m · shrub 1.6 x 0.9 m.
 *        120-420 triangles per instance, 1 material, 1 unit = 1 meter, Y-up.
 * PARTS  animate: crown (y).  detach: crown, trunk, fronds, canopy, branches.
 * USE    Ideal as an InstancedMesh source — per-instance colour multiplies the baked vertex colours.
 * LICENSE  MIT.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = { foliage: '#4d7048', tips: '#71915b', bark: '#6a573d', fruit: '#b7623f' };

export const COLORWAYS = {
  verdant:   { ...BASE },
  autumn:    { foliage: '#8f8342', tips: '#bda85c', bark: '#6c5539', fruit: '#c07a34' },
  moonstone: { foliage: '#42685f', tips: '#6d9084', bark: '#5b5f56', fruit: '#8fa2b0' },
  dusk:      { foliage: '#46604f', tips: '#6c7f68', bark: '#5a4e4a', fruit: '#a2694f' }
};
export const presets = COLORWAYS;

const mix01 = (a, b, t) => a + (b - a) * t;

export const SPECIES = {
  pine:     { height: 6.4, radius: 1.5, label: 'Pine' },
  fir:      { height: 9.2, radius: 1.7, label: 'Fir' },
  palm:     { height: 5.4, radius: 2.6, label: 'Palm' },
  acacia:   { height: 4.4, radius: 3.4, label: 'Acacia' },
  broadleaf:{ height: 7.8, radius: 3.2, label: 'Broadleaf' },
  shrub:    { height: 1.3, radius: 1.6, label: 'Shrub' }
};
export const speciesDefaults = SPECIES;

export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for production', affects: 'geometry', describe: 'One merged mesh and draw call when true; individually selectable crown/trunk/fronds when false.' },
  species: { type: 'choice', default: 'pine', options: Object.keys(SPECIES), label: 'Species', affects: 'geometry', describe: 'Rebuilds the silhouette from profile curves per species — never a uniform scale.' },
  colorway: { type: 'choice', default: 'verdant', options: Object.keys(COLORWAYS), label: 'Colorway', affects: 'colors', describe: 'Curated foliage palette.' },
  height: { type: 'range', default: 6.4, min: 1, max: 16, step: 0.2, label: 'Height', affects: 'geometry', describe: 'Top of silhouette above ground in meters.' },
  radius: { type: 'range', default: 1.5, min: 0.4, max: 4.2, step: 0.1, label: 'Crown radius', affects: 'geometry', describe: 'Maximum branch reach in meters.' },
  tiers: { type: 'range', default: 4, min: 2, max: 7, step: 1, label: 'Branch tiers', affects: 'geometry', describe: 'Number of foliage tiers recalcuated along the profile.' },
  seed: { type: 'range', default: 7, min: 1, max: 99999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Deterministic lean, frond count and facet tint variation.' },
  ...Object.fromEntries(Object.entries(BASE).map(([key, value]) => [key, { type: 'color', default: value, label: `${key[0].toUpperCase()}${key.slice(1)} color`, affects: 'colors', describe: `Albedo of the ${key} material zone.` }]))
};

export const rig = { crown: { axis: 'y', range: [-10, 10], describe: 'Turn the crown in degrees.' }, trunk: { axis: 'z', range: [-4, 4], describe: 'Wind lean.' } };
export const detach = ['crown', 'trunk', 'fronds', 'canopy', 'branches'];
export const night = {};

const ZONE_KEYS = Object.keys(BASE);
const hexOf = (v) => typeof v === 'number' && Number.isFinite(v) ? v & 0xffffff : typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v) ? parseInt(v.replace('#', ''), 16) : null;

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

function prep(geo, hex) {
  let g = geo;
  if (g.index) { g = g.toNonIndexed(); geo.dispose(); }
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  if (hex !== null || !g.getAttribute('color')) {
    const c = new THREE.Color(hex ?? 0xffffff), n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
  return g;
}

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.94, metalness: 0, side: THREE.DoubleSide });
const GLASS_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });

function finish(list, material = MAT, name = 'solid', merge = true) {
  if (!list.length) return null;
  if (merge) {
    const prepared = list.map((p) => prep(p.g, p.c));
    const merged = mergeGeometries(prepared);
    prepared.forEach((g) => g.dispose());
    if (!merged) return null;
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
  const group = new THREE.Group(); group.name = name;
  const crownRoot = new THREE.Group(); crownRoot.name = 'crown'; group.add(crownRoot);
  const zones = new Map();
  for (const zone of ['fronds', 'canopy', 'branches']) { const child = new THREE.Group(); child.name = zone; crownRoot.add(child); zones.set(zone, child); }
  list.forEach((part, i) => {
    const geo = prep(part.g, part.c); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = part.zone === 'trunk' ? 'trunk' : `${part.name || 'crown'}_part_${i + 1}`;
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.zone = part.zone || name;
    if (part.zone === 'trunk') group.add(mesh);
    else (zones.get(part.zone) || crownRoot).add(mesh);
  });
  return group;
}

function box(w, h, d, x = 0, y = 0, z = 0) { return new THREE.BoxGeometry(w, h, d).translate(x, y, z); }

function addCylinder(parts, rTop, rBot, h, segs, x, y, z, rx = 0, ry = 0, rz = 0, hex = '#888888', name) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  geo.rotateX(rx); geo.rotateY(ry); geo.rotateZ(rz); geo.translate(x, y, z);
  parts.push({ g: geo, c: hex, name, zone: name });
}

function addWire(parts, p1, p2, hex, r = 0.01, radialSegments = 5, name) {
  const a = new THREE.Vector3(...p1), b = new THREE.Vector3(...p2), dist = a.distanceTo(b);
  if (dist < 1e-5) return;
  const geo = new THREE.CylinderGeometry(r, r, dist, radialSegments);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  geo.translate(...a.lerp(b, 0.5).toArray());
  parts.push({ g: geo, c: hex, name, zone: name });
}

function addExtrusion(parts, shape, depth, hex, name) {
  parts.push({ g: new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1, curveSegments: 8 }), c: hex, name, zone: name });
}

function addBlob(parts, r, detail, x, y, z, hex, sx = 1, sy = 1, sz = 1, name = 'crown') {
  const geo = new THREE.IcosahedronGeometry(r, detail);
  geo.scale(sx, sy, sz); geo.translate(x, y, z);
  parts.push({ g: geo, c: hex, name, zone: name });
}

const rnd = (seed, i) => { const n = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return n - Math.floor(n); };

/** Vertical gradient on a lathed crown: darker shaded interior, brighter tips. */
function shadeCrown(parts, zones, height, seed) {
  if (!parts.length) return;
  const low = new THREE.Color(zones.foliage), high = new THREE.Color(zones.tips);
  for (const part of parts) {
    if (part.zone !== 'crown' && part.zone !== 'canopy') continue;
    const geo = part.g.index ? part.g.toNonIndexed() : part.g;
    if (geo !== part.g) { part.g.dispose(); part.g = geo; }
    const pos = geo.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 3) {
      const average = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / (3 * height);
      c.copy(low).lerp(high, Math.min(1, Math.max(0, average * 1.15))).multiplyScalar(0.9 + rnd(seed + i, 3) * 0.16);
      for (let j = 0; j < 3; j++) { colors[(i + j) * 3] = c.r; colors[(i + j) * 3 + 1] = c.g; colors[(i + j) * 3 + 2] = c.b; }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    part.c = null;
  }
}

export function createAsset(userParams = {}) {
  const p = {};
  for (const key of Object.keys(params)) p[key] = params[key].default;
  Object.assign(p, SPECIES[userParams.species] || {}, userParams);
  for (const [key, s] of Object.entries(params)) {
    if (s.type === 'range') p[key] = Math.max(s.min, Math.min(s.max, Number.isFinite(+p[key]) ? +p[key] : s.default));
    else if (s.type === 'choice') p[key] = s.options.includes(p[key]) ? p[key] : s.default;
    else if (s.type === 'toggle') p[key] = Boolean(p[key]);
  }
  const zones = zonesFor(p.colorway, userParams);
  const g = new THREE.Group();
  g.name = `tree-${p.species}`;
  const parts = [], crown = [];
  const seed = p.seed;
  const H = p.height, R = Math.min(p.radius, H * 0.55);

  if (p.species === 'pine' || p.species === 'fir') {
    const cone = p.species === 'fir';
    addCylinder(parts, H * 0.012, H * 0.028, H * (cone ? 0.34 : 0.42), 6, 0, H * (cone ? 0.17 : 0.21), 0, 0, 0, 0, zones.bark, 'trunk');
    const points = [new THREE.Vector2(0, H * (cone ? 0.12 : 0.2))];
    const tiers = Math.max(2, Math.round(p.tiers + (cone ? 1 : 0)));
    for (let i = 0; i < tiers; i++) {
      const t = i / (tiers - 1 || 1);
      const y = H * (mix01(cone ? 0.16 : 0.24, cone ? 0.74 : 0.84, t));
      const r = R * (1 - t * (cone ? 0.88 : 0.78)) * (0.9 + rnd(seed, i) * 0.2);
      points.push(new THREE.Vector2(Math.max(0.02, r), y));
      points.push(new THREE.Vector2(Math.max(0.02, r * (cone ? 0.5 : 0.62)), y + H * (cone ? 0.07 : 0.11)));
    }
    points.push(new THREE.Vector2(0, H));
    const lathe = new THREE.LatheGeometry(points, cone ? 6 : 7, 0, Math.PI * 2);
    lathe.rotateY(rnd(seed, 9) * Math.PI);
    crown.push({ g: lathe, c: null, name: 'crown', zone: 'crown' });
  } else if (p.species === 'palm') {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(R * 0.06, H * 0.35, R * 0.04),
      new THREE.Vector3(R * 0.16, H * 0.7, -R * 0.05), new THREE.Vector3(R * 0.2, H, 0)
    ]);
    const trunk = new THREE.TubeGeometry(curve, 8, H * 0.026, 6, false);
    parts.push({ g: trunk, c: zones.bark, name: 'trunk', zone: 'trunk' });
    const top = curve.getPoint(1);
    const fronds = 7 + Math.floor(rnd(seed, 2) * 3);
    for (let i = 0; i < fronds; i++) {
      const angle = i / fronds * Math.PI * 2 + rnd(seed, i) * 0.4;
      const length = R * (0.82 + rnd(seed, i + 20) * 0.3);
      const geo = new THREE.CylinderGeometry(H * 0.008, length * 0.22, length, 3, 1, false);
      geo.scale(1, 1, 0.24);
      geo.rotateZ(-0.62 - rnd(seed, i + 40) * 0.3);
      geo.rotateY(-angle);
      geo.translate(top.x + Math.cos(angle) * length * 0.36, top.y - length * 0.1, top.z - Math.sin(angle) * length * 0.36);
      parts.push({ g: geo, c: zones.foliage, name: `frond_${i + 1}`, zone: 'fronds' });
    }
    for (let i = 0; i < 3; i++) {
      const angle = i / 3 * Math.PI * 2;
      addBlob(parts, H * 0.032, 0, top.x + Math.cos(angle) * H * 0.05, top.y - H * 0.045, top.z + Math.sin(angle) * H * 0.05, zones.fruit, 1, 1, 1, 'canopy');
    }
  } else if (p.species === 'acacia') {
    addCylinder(parts, H * 0.03, H * 0.07, H * 0.62, 6, 0, H * 0.31, 0, 0, 0, 0, zones.bark, 'trunk');
    const crownY = H * 0.66;
    for (let i = 0; i < 4; i++) {
      const angle = i / 4 * Math.PI * 2 + 0.4;
      addWire(parts, [0, crownY * 0.86, 0], [Math.cos(angle) * R * 0.5, crownY, Math.sin(angle) * R * 0.5], zones.bark, H * 0.018, 5, 'branches');
    }
    const disc = new THREE.CylinderGeometry(R, R * 0.78, H * 0.12, 9);
    disc.translate(0, crownY + H * 0.09, 0);
    crown.push({ g: disc, c: null, name: 'canopy', zone: 'canopy' });
    addBlob(crown, R * 0.62, 1, R * 0.24, crownY + H * 0.16, -R * 0.18, 0x000000, 1.15, 0.34, 1.1, 'canopy');
  } else if (p.species === 'broadleaf') {
    const profile = [new THREE.Vector2(H * .046, 0), new THREE.Vector2(H * .028, H * .36), new THREE.Vector2(H * .018, H * .67), new THREE.Vector2(0, H * .85)];
    parts.push({ g: new THREE.LatheGeometry(profile, 7), c: zones.bark, name: 'trunk', zone: 'trunk' });
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI * .5 + .35, x = Math.cos(angle) * R * .47, z = Math.sin(angle) * R * .47;
      addWire(parts, [0, H * .36, 0], [x, H * .62, z], zones.bark, H * .014, 5, 'branches');
      addBlob(crown, R * .65, 1, x, H * .68 + (i % 2) * H * .07, z, zones.foliage, 1, 1.1, 1, 'crown');
    }
    addBlob(crown, R * .72, 1, 0, H * .83, 0, zones.tips, .85, .8, .85, 'crown');
  } else {
    const count = 3 + Math.floor(rnd(seed, 4) * 3);
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2 + rnd(seed, i) * 2;
      const r = R * (0.3 + rnd(seed, i + 9) * 0.35);
      addBlob(crown, H * (0.34 + rnd(seed, i + 3) * 0.2), 1, Math.cos(angle) * r, H * (0.42 + rnd(seed, i + 5) * 0.42), Math.sin(angle) * r, 0x000000, 1.1, 0.86, 1.1, 'crown');
    }
    addCylinder(parts, H * 0.03, H * 0.05, H * 0.3, 5, 0, H * 0.15, 0, 0, 0, 0, zones.bark, 'trunk');
  }

  shadeCrown(crown, zones, p.species === 'acacia' ? H * 0.9 : H, seed);
  const list = [...parts, ...crown];
  const solid = finish(list, MAT.clone(), 'tree', p.mergeForProduction);
  if (solid) g.add(solid);
  g.userData.params = p;
  g.userData.species = p.species;
  return g;
}

export default createAsset;
