/**
 * TERRA / FIELD ROCK (High Detail)
 * A continuous weathered stone with procedural facet colors and no textures.
 * QUICK START  import { createAsset } from './field-rock.mjs'; scene.add(createAsset());
 * SPECS  Default: approximately 2.7 x 1.5 x 2.2 m. 80 triangles, one material.
 * OPTIONS  Radius 0.3-3 m, height 0.3-4 m, seed, three colorways.
 * PARTS  animate: stone (Y). detach: stone. LICENSE  MIT.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const BASE = { stone: '#a4a599', shadow: '#7c8476', moss: '#7c8b60' };
export const COLORWAYS = { default: { ...BASE }, autumn: { stone: '#baab92', shadow: '#92866f', moss: '#91915f' }, moonstone: { stone: '#a2adb0', shadow: '#77888c', moss: '#708d82' } };
export const presets = COLORWAYS;
export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for production', affects: 'geometry', describe: 'Output one optimized mesh when enabled.' },
  colorway: { type: 'choice', default: 'default', options: Object.keys(COLORWAYS), label: 'Colorway', affects: 'colors', describe: 'Curated stone and moss palette.' },
  radius: { type: 'range', default: 1.2, min: 0.3, max: 3, step: 0.1, label: 'Radius', affects: 'geometry', describe: 'Stone footprint radius, rebuilt from the surface vertices.' },
  height: { type: 'range', default: 1.5, min: 0.3, max: 4, step: 0.1, label: 'Height', affects: 'geometry', describe: 'Stone height in meters.' },
  seed: { type: 'range', default: 12, min: 1, max: 99999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Deterministic weathering pattern.' },
  ...Object.fromEntries(Object.entries(BASE).map(([key, value]) => [key, { type: 'color', default: value, label: `${key} color`, affects: 'colors', describe: `Albedo of the ${key} zone.` }]))
};
export const rig = { stone: { axis: 'y', range: [0, 360], describe: 'Rotate the stone.' } };
export const detach = ['stone'];
export const night = {};
const ZONE_KEYS = Object.keys(BASE);
const hexOf = (v) => typeof v === 'number' && Number.isFinite(v) ? v & 0xffffff : typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v) ? parseInt(v.replace('#', ''), 16) : null;
function zonesFor(name, overrides = {}) { const cw = COLORWAYS[name] || COLORWAYS.default, out = {}, used = new Set(); for (const key of ZONE_KEYS) { let hex = hexOf(overrides[key]) ?? hexOf(cw[key]); while (used.has(hex)) hex = (hex + 1) & 0xffffff; used.add(hex); out[key] = hex; } return out; }
function prep(geometry, hex) { let geo = geometry; if (geo.index) { geo = geo.toNonIndexed(); geometry.dispose(); } geo.deleteAttribute('uv'); geo.deleteAttribute('normal'); if (hex !== null || !geo.getAttribute('color')) { const c = new THREE.Color(hex ?? 0xffffff), colors = new Float32Array(geo.attributes.position.count * 3); for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); } return geo; }
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0, side: THREE.DoubleSide });
const GLASS_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
function finish(list, material = MAT, name = 'solid', merge = true) { if (!list.length) return null; if (merge) { const prepared = list.map((p) => prep(p.g, p.c)), geo = mergeGeometries(prepared); prepared.forEach((item) => item.dispose()); if (!geo) return null; geo.computeVertexNormals(); const mesh = new THREE.Mesh(geo, material); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; return mesh; } const group = new THREE.Group(); group.name = name; list.forEach((p, i) => { const geo = prep(p.g, p.c); geo.computeVertexNormals(); const mesh = new THREE.Mesh(geo, material); mesh.name = p.name || `${name}_part_${i + 1}`; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); }); return group; }
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
  p.radius = Math.max(0.3, Math.min(3, Number(p.radius) || 1.2)); p.height = Math.max(0.3, Math.min(4, Number(p.height) || 1.5));
  const C = zonesFor(p.colorway, userParams), g = new THREE.Group(); g.name = 'field-rock';
  const geo = new THREE.IcosahedronGeometry(1, 1), position = geo.getAttribute('position'), colors = [];
  for (let i = 0; i < position.count; i++) { const x = position.getX(i), y = position.getY(i), z = position.getZ(i), warp = 1 + Math.sin(x * 5 + z * 3 + p.seed) * 0.14; position.setXYZ(i, x * p.radius * warp * 1.1, Math.max(0, (y + 0.82) * p.height * 0.55), z * p.radius * warp * 0.9); }
  for (let i = 0; i < position.count; i += 3) { const y = (position.getY(i) + position.getY(i + 1) + position.getY(i + 2)) / (3 * p.height), c = new THREE.Color(C.shadow).lerp(new THREE.Color(C.stone), Math.min(1, y + 0.3)); if (y < 0.18) c.lerp(new THREE.Color(C.moss), 0.36); c.multiplyScalar(0.96 + Math.sin(i * 3.7 + p.seed) * 0.08); for (let j = 0; j < 3; j++) colors.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const solid = finish([{ g: geo, c: null, name: 'stone' }], MAT.clone(), 'solid', p.mergeForProduction); if (solid) g.add(solid); g.userData.params = p; return g;
}
export default createAsset;