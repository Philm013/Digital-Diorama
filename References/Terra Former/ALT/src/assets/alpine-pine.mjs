/**
 * TERRA / ALPINE PINE (High Detail)
 * A continuous, swept conifer silhouette. No textures, loaders, or shared helpers.
 * QUICK START  import { createAsset } from './alpine-pine.mjs'; scene.add(createAsset());
 * SPECS  Default: up to 2.8 x 5.8 x 2.8 m. 220 triangles, one material.
 * OPTIONS  Height 2-12 m, crown radius 0.5-3 m, branch tiers 3-6, three colorways.
 * PARTS  animate: crown (Y). detach: crown, trunk. One production draw call.
 * LICENSE  MIT. Geometry is free for personal and commercial use.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const BASE = { needles: '#355b41', tips: '#52794d', trunk: '#6b5a40' };
export const COLORWAYS = { default: { ...BASE }, autumn: { needles: '#7b7941', tips: '#a59a50', trunk: '#69513b' }, moonstone: { needles: '#3f685f', tips: '#608877', trunk: '#5e6254' } };
export const presets = COLORWAYS;
export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for production', affects: 'geometry', describe: 'One material and draw call when enabled; individually editable trunk and crown otherwise.' },
  colorway: { type: 'choice', default: 'default', options: Object.keys(COLORWAYS), label: 'Colorway', affects: 'colors', describe: 'Curated foliage palette.' },
  height: { type: 'range', default: 5.8, min: 2, max: 12, step: 0.1, label: 'Height', affects: 'geometry', describe: 'Recalculates the swept silhouette in meters.' },
  radius: { type: 'range', default: 1.4, min: 0.5, max: 3, step: 0.1, label: 'Crown radius', affects: 'geometry', describe: 'Maximum branch reach in meters.' },
  tiers: { type: 'range', default: 4, min: 3, max: 6, step: 1, label: 'Branch tiers', affects: 'geometry', describe: 'Number of branches along the continuous lathed profile.' },
  ...Object.fromEntries(Object.entries(BASE).map(([key, value]) => [key, { type: 'color', default: value, label: `${key} color`, affects: 'colors', describe: `Albedo of the ${key} zone.` }]))
};
export const rig = { crown: { axis: 'y', range: [-8, 8], describe: 'Rotate the crown in degrees.' } };
export const detach = ['crown', 'trunk'];
export const night = {};
const ZONE_KEYS = Object.keys(BASE);
const hexOf = (v) => typeof v === 'number' && Number.isFinite(v) ? v & 0xffffff : typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v) ? parseInt(v.replace('#', ''), 16) : null;
function zonesFor(name, overrides = {}) { const cw = COLORWAYS[name] || COLORWAYS.default, used = new Set(), out = {}; for (const key of ZONE_KEYS) { let hex = hexOf(overrides[key]) ?? hexOf(cw[key]); while (used.has(hex)) hex = (hex + 1) & 0xffffff; used.add(hex); out[key] = hex; } return out; }
function prep(geometry, hex) {
  let geo = geometry; if (geo.index) { geo = geo.toNonIndexed(); geometry.dispose(); }
  geo.deleteAttribute('uv'); geo.deleteAttribute('normal');
  if (hex !== null || !geo.getAttribute('color')) { const c = new THREE.Color(hex ?? 0xffffff), colors = new Float32Array(geo.attributes.position.count * 3); for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); }
  return geo;
}
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
const GLASS_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
function finish(list, material = MAT, name = 'solid', merge = true) {
  if (!list.length) return null;
  if (merge) { const geometries = list.map((p) => prep(p.g, p.c)), geo = mergeGeometries(geometries); geometries.forEach((item) => item.dispose()); if (!geo) return null; geo.computeVertexNormals(); const mesh = new THREE.Mesh(geo, material); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }
  const group = new THREE.Group(); group.name = name;
  list.forEach((p, i) => { const geo = prep(p.g, p.c); geo.computeVertexNormals(); const mesh = new THREE.Mesh(geo, material); mesh.name = p.name || `${name}_part_${i + 1}`; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); }); return group;
}
function box(w, h, d, x = 0, y = 0, z = 0) { return new THREE.BoxGeometry(w, h, d).translate(x, y, z); }
function addCylinder(parts, rTop, rBot, h, segs, x, y, z, rx = 0, ry = 0, rz = 0, hex = '#888888') { const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs); geo.rotateX(rx); geo.rotateY(ry); geo.rotateZ(rz); geo.translate(x, y, z); parts.push({ g: geo, c: hex }); }
function addWire(parts, p1, p2, hex, r = 0.01, radialSegments = 5) { const a = new THREE.Vector3(...p1), b = new THREE.Vector3(...p2), dist = a.distanceTo(b); if (dist < 1e-5) return; const geo = new THREE.CylinderGeometry(r, r, dist, radialSegments); geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())); geo.translate(...a.lerp(b, 0.5).toArray()); parts.push({ g: geo, c: hex }); }
function addExtrusion(parts, shape, depth, hex) { parts.push({ g: new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1, curveSegments: 10 }), c: hex }); }
export function createAsset(userParams = {}) {
  const p = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, value.default])); Object.assign(p, userParams);
  for (const [key, schema] of Object.entries(params)) {
    if (schema.type === 'range') p[key] = Math.max(schema.min, Math.min(schema.max, Number.isFinite(Number(p[key])) ? Number(p[key]) : schema.default));
    if (schema.type === 'choice' && !schema.options.includes(p[key])) p[key] = schema.default;
    if (schema.type === 'toggle' && typeof p[key] !== 'boolean') p[key] = schema.default;
  }
  p.height = Math.max(2, Math.min(12, Number(p.height) || 5.8)); p.radius = Math.max(0.5, Math.min(3, Number(p.radius) || 1.4)); p.tiers = Math.max(3, Math.min(6, Math.round(Number(p.tiers) || 4)));
  const C = zonesFor(p.colorway, userParams), g = new THREE.Group(), parts = []; g.name = 'alpine-pine';
  addCylinder(parts, 0.075, 0.14, p.height * 0.72, 6, 0, p.height * 0.36, 0, 0, 0, 0, C.trunk); parts[0].name = 'trunk';
  const points = [new THREE.Vector2(0, p.height * 0.17), new THREE.Vector2(p.radius * 0.72, p.height * 0.17)];
  for (let i = 0; i < p.tiers; i++) { const t = i / p.tiers, y = p.height * (0.19 + t * 0.65), radius = p.radius * (1 - t * 0.83); points.push(new THREE.Vector2(radius, y), new THREE.Vector2(radius * 0.64, y + p.height * 0.09), new THREE.Vector2(radius * 0.36, y + p.height * 0.18)); }
  points.push(new THREE.Vector2(0, p.height));
  const crown = new THREE.LatheGeometry(points, 7, 0, Math.PI * 2).toNonIndexed();
  const position = crown.getAttribute('position'), colors = new Float32Array(position.count * 3);
  const base = new THREE.Color(C.needles), tip = new THREE.Color(C.tips);
  for (let i = 0; i < position.count; i += 3) { const average = (position.getY(i) + position.getY(i + 1) + position.getY(i + 2)) / (3 * p.height); const c = base.clone().lerp(tip, average * 0.7).multiplyScalar(0.92 + Math.sin(i * 2.81) * 0.07); for (let j = 0; j < 3; j++) { colors[(i + j) * 3] = c.r; colors[(i + j) * 3 + 1] = c.g; colors[(i + j) * 3 + 2] = c.b; } }
  crown.setAttribute('color', new THREE.BufferAttribute(colors, 3)); parts.push({ g: crown, c: null, name: 'crown' });
  const solid = finish(parts, MAT.clone(), 'solid', p.mergeForProduction); if (solid) g.add(solid); g.userData.params = p; return g;
}
export default createAsset;