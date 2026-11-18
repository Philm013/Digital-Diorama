/*
 * TECH FILTRATION (High Detail)
 * Parametric aquarium life-support for three.js. Sleek Glassware (lily-pipe inflow/outflow swept
 * over the rim, slotted strainer, CO2 diffuser with live bubble stream, glass heater), Industrial
 * Plastic (hollow comb-tooth overflow box, wavemaker with spinning impeller, slotted heater guard,
 * loc-line return) or Invisible/Sump-fed (slim slot overflow + flush nozzle).
 * Origin = inner face of the rear glass at floor level; +Z points into the tank.
 *
 * QUICK START
 *   import { createAsset } from './tech-filtration.mjs';
 *   const tech = createAsset({ techStyle: 'glassware', waterDepth: 0.45, tankHeight: 0.5 });
 *   scene.add(tech); // loop: tech.userData.update(t, dt)
 *
 * PARAMS  techStyle: invisible | glassware | industrial ; flowRate 0-1 ; co2Bubbles toggle
 *         waterDepth, tankHeight, glassT, span ; colorway
 * SPECS  ~1,500-4,000 triangles, 4 materials, spans ~0.35 x tank height.
 * PARTS  animate: impellerBlades (spin), co2Bubbles (rise)
 *        detach: co2Bubbles, heater, hoses
 * LICENSE MIT - procedural geometry, free for commercial use.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = { glass: '#d8f4f0', hose: '#2a5a3a', plastic: '#141518', plasticLight: '#3a3d42', ceramic: '#f2f2ee', metal: '#a8acb0', suction: '#e0eee8', bubble: '#eefaff', element: '#c8a070' };

export const COLORWAYS = {
  'default':  { ...BASE },
  'clear':    { ...BASE },
  'reef':     { glass: '#d8ecff', hose: '#101010', plastic: '#0e0f11', plasticLight: '#2a2c30', ceramic: '#e8e8e8', metal: '#9098a0', suction: '#d0d8e0', bubble: '#eef6ff', element: '#a07040' },
  'white':    { glass: '#e8f8f8', hose: '#e0e0e0', plastic: '#e8e8e6', plasticLight: '#c8c8c6', ceramic: '#ffffff', metal: '#c0c4c8', suction: '#f0f4f4', bubble: '#ffffff', element: '#d0a870' },
  'cyber':    { glass: '#e8e0ff', hose: '#6020c0', plastic: '#1a1a24', plasticLight: '#30f0ff', ceramic: '#c040ff', metal: '#d0d4e0', suction: '#e0d8ff', bubble: '#e0f8ff', element: '#ff40c8' }
};

export const presets = COLORWAYS;

export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'Merge per material or keep selectable components.' },
  colorway:   { type: 'choice', default: 'default', options: Object.keys(COLORWAYS), label: 'Palette', affects: 'colors', describe: 'Equipment finish.' },
  techStyle:  { type: 'choice', default: 'glassware', options: ['invisible', 'glassware', 'industrial'], label: 'Tech Style', affects: 'geometry', describe: 'Invisible/sump-fed, sleek glassware, industrial plastic.' },
  flowRate:   { type: 'range', default: 0.5, min: 0, max: 1, step: 0.05, label: 'Flow Rate', affects: 'geometry', describe: 'Gentle ripple to turbulent.' },
  co2Bubbles: { type: 'toggle', default: true, label: 'CO2 Bubbles', affects: 'geometry', describe: 'Diffuser bubble stream.' },
  waterDepth: { type: 'range', default: 0.45, min: 0.15, max: 1.0, step: 0.01, label: 'Water Depth', affects: 'geometry', describe: 'Floor to water surface (m).' },
  tankHeight: { type: 'range', default: 0.5, min: 0.2, max: 1.2, step: 0.01, label: 'Tank Height', affects: 'geometry', describe: 'Floor to glass rim (m).' },
  glassT:     { type: 'range', default: 0.012, min: 0.004, max: 0.02, step: 0.001, label: 'Glass Thickness', affects: 'geometry', describe: 'Rear pane thickness for rim hooks.' },
  span:       { type: 'range', default: 0.34, min: 0.15, max: 0.8, step: 0.01, label: 'Span', affects: 'geometry', describe: 'Spacing between inflow and outflow (m).' }
};

export const rig = {
  impellerBlades: { axis: 'x', range: [0, 360], describe: 'Wavemaker impeller spin.' },
  co2Bubbles:     { axis: 'y', range: [0, 1], describe: 'Bubbles stream upward.' }
};
export const detach = ['co2Bubbles', 'heater', 'hoses'];
export const night = { heater: { color: '#ff3a1a', intensity: 0.2, distance: 0.1, describe: 'Heater indicator LED.' } };

const ZONE_KEYS = Object.keys(BASE);
const hexOf = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v & 0xFFFFFF;
  if (typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v)) return parseInt(v.replace('#', ''), 16);
  return null;
};

function zonesFor(name, o = {}) {
  const cw = COLORWAYS[name] || COLORWAYS['default'];
  const used = new Set(), out = {};
  for (const k of ZONE_KEYS) {
    let hex = (hexOf(o[k]) ?? hexOf(cw[k]) ?? hexOf(BASE[k])) & 0xFFFFFF;
    while (used.has(hex)) hex = (hex + 1) & 0xFFFFFF;
    used.add(hex); out[k] = hex;
  }
  return out;
}

function prep(geo, hex) {
  if (geo.index) geo = geo.toNonIndexed();
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  if (geo.attributes.normal) geo.deleteAttribute('normal');
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide });
const GLASS_MAT = new THREE.MeshPhysicalMaterial({ vertexColors: true, flatShading: true, roughness: 0.03, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.8 });
const HOSE_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.3, transparent: true, opacity: 0.75, side: THREE.DoubleSide });

function finish(list, material = MAT, name = 'solid', merge = true) {
  if (list.length === 0) return null;
  if (merge) {
    const merged = mergeGeometries(list.map(p => prep(p.g, p.c)));
    if (!merged) return null;
    merged.computeVertexNormals();
    const m = new THREE.Mesh(merged, material);
    m.name = name; m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  const g = new THREE.Group();
  g.name = name;
  list.forEach((p, i) => {
    const geo = prep(p.g, p.c);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material);
    m.name = p.n ? `${name}_${p.n}_${i + 1}` : `${name}_part_${i + 1}`;
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  });
  return g;
}

function box(w, h, d, x = 0, y = 0, z = 0) { return new THREE.BoxGeometry(w, h, d).translate(x, y, z); }

function addCylinder(parts, rTop, rBot, h, segs, x, y, z, rx = 0, ry = 0, rz = 0, hex = '#888888') {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  if (rx) geo.rotateX(rx); if (ry) geo.rotateY(ry); if (rz) geo.rotateZ(rz);
  geo.translate(x, y, z); parts.push({ g: geo, c: hex });
}

function addWire(parts, p1, p2, hex, r = 0.01, radialSegments = 5) {
  const v1 = new THREE.Vector3(...p1), v2 = new THREE.Vector3(...p2);
  const dist = v1.distanceTo(v2); if (dist < 1e-5) return;
  const geo = new THREE.CylinderGeometry(r, r, dist, radialSegments);
  const mid = v1.clone().lerp(v2, 0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v2.clone().sub(v1).normalize());
  geo.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
  parts.push({ g: geo, c: hex });
}

function addPipe(parts, pts, r, hex, segs = 40, radial = 10, ribs = 0, n = 'pipe') {
  const curve = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q)), false, 'catmullrom', 0.1);
  const geo = new THREE.TubeGeometry(curve, segs, r, radial, false);
  if (ribs) {
    const pos = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) { const c = curve.getPointAt(i / segs), k = 1 + 0.35 * Math.max(0, Math.sin(i / segs * Math.PI * ribs)); for (let j = 0; j <= radial; j++) { const id = i * (radial + 1) + j; v.fromBufferAttribute(pos, id).sub(c).multiplyScalar(k).add(c); pos.setXYZ(id, v.x, v.y, v.z); } }
  }
  parts.push({ g: geo, c: hex, n });
  return curve;
}

export function createAsset(userParams = {}) {
  const p = {};
  for (const k of Object.keys(params)) p[k] = params[k].default;
  Object.assign(p, userParams);
  const C = zonesFor(p.colorway, userParams);
  const merge = !!p.mergeForProduction;
  const Hw = p.waterDepth, Ht = p.tankHeight, gT = p.glassT, sp = p.span;

  const g = new THREE.Group(); g.name = 'tech-filtration';
  const solid = [], glass = [], hoses = [], heater = [];
  let impeller = null;
  const bubbleSources = [];
  let outlet = [sp / 2, Hw - 0.03, 0.05], flowDir = [1, 0, 0.4];

  if (p.techStyle === 'glassware') {
    const xi = -sp / 2, xo = sp / 2, r = 0.0085, zIn = 0.022;
    // inflow: strainer + J-pipe over the rim
    addPipe(glass, [[xi, 0.09, zIn], [xi, Ht * 0.5, zIn], [xi, Ht - 0.02, zIn], [xi, Ht + 0.022, zIn * 0.4], [xi, Ht + 0.024, -gT - 0.012], [xi, Ht - 0.02, -gT - 0.022], [xi, Ht - 0.07, -gT - 0.024]], r, C.glass, 48, 10, 0, 'inflowPipe');
    const strainer = [new THREE.Vector2(0.0001, 0), new THREE.Vector2(0.013, 0.002)];
    for (let i = 0; i <= 10; i++) strainer.push(new THREE.Vector2(i % 2 ? 0.0125 : 0.0135, 0.004 + i * 0.0045));
    strainer.push(new THREE.Vector2(r, 0.055), new THREE.Vector2(r, 0.06));
    glass.push({ g: new THREE.LatheGeometry(strainer, 14).translate(xi, 0.035, zIn), c: C.glass, n: 'slottedStrainer' });
    for (let i = 0; i < 6; i++) addWire(solid, [xi + Math.cos(i) * 0.013, 0.04, zIn + Math.sin(i) * 0.013], [xi + Math.cos(i) * 0.013, 0.085, zIn + Math.sin(i) * 0.013], C.metal, 0.0006, 3);
    // outflow: lily pipe with flared bell just below the surface
    const yl = Hw - 0.035;
    addPipe(glass, [[xo, yl, zIn + 0.012], [xo, yl + 0.03, zIn], [xo, Ht - 0.02, zIn], [xo, Ht + 0.022, zIn * 0.4], [xo, Ht + 0.024, -gT - 0.012], [xo, Ht - 0.02, -gT - 0.022], [xo, Ht - 0.07, -gT - 0.024]], r, C.glass, 48, 10, 0, 'outflowPipe');
    const lily = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; lily.push(new THREE.Vector2(r + Math.pow(t, 2.2) * 0.02, t * 0.05)); }
    glass.push({ g: new THREE.LatheGeometry(lily, 18).rotateX(Math.PI / 2).rotateY(Math.PI / 2 - 0.35).translate(xo, yl, zIn + 0.012), c: C.glass, n: 'lilyBell' });
    outlet = [xo + 0.05, Hw, zIn + 0.03]; flowDir = [1, 0, 0.35];
    // suction cups
    [[xi, Ht * 0.45], [xo, Ht * 0.6]].forEach(([x, y]) => { addCylinder(solid, 0.006, 0.01, 0.006, 12, x, y, 0.004, Math.PI / 2, 0, 0, C.suction); addWire(solid, [x, y, 0.006], [x, y, zIn - r], C.suction, 0.0025, 6); });
    // hoses down the back to the canister
    addPipe(hoses, [[xi, Ht - 0.07, -gT - 0.024], [xi, Ht - 0.2, -gT - 0.04], [xi - 0.02, -0.3, -gT - 0.06], [xi - 0.03, -0.75, -gT - 0.05]], 0.009, C.hose, 30, 8, 0, 'inflowHose');
    addPipe(hoses, [[xo, Ht - 0.07, -gT - 0.024], [xo, Ht - 0.2, -gT - 0.04], [xo + 0.02, -0.3, -gT - 0.06], [xo + 0.03, -0.75, -gT - 0.05]], 0.009, C.hose, 30, 8, 0, 'outflowHose');
    // CO2 diffuser: glass cup + ceramic disc, airline from above
    const xd = 0, yd = 0.11;
    glass.push({ g: new THREE.LatheGeometry([new THREE.Vector2(0.0001, 0), new THREE.Vector2(0.004, 0.0), new THREE.Vector2(0.004, 0.025), new THREE.Vector2(0.016, 0.04), new THREE.Vector2(0.017, 0.046), new THREE.Vector2(0.0001, 0.046)], 16).translate(xd, yd - 0.04, 0.03), c: C.glass, n: 'diffuserCup' });
    solid.push({ g: new THREE.CylinderGeometry(0.0155, 0.0155, 0.003, 16).translate(xd, yd + 0.0045, 0.03), c: C.ceramic, n: 'ceramicDisc' });
    addCylinder(solid, 0.006, 0.01, 0.006, 12, xd, yd - 0.03, 0.004, Math.PI / 2, 0, 0, C.suction);
    addPipe(hoses, [[xd, yd - 0.04, 0.03], [xd + 0.01, yd - 0.07, 0.012], [xd + 0.02, Ht * 0.6, 0.006], [xd + 0.02, Ht + 0.015, 0.0], [xd + 0.02, Ht + 0.015, -gT - 0.01], [xd + 0.02, Ht - 0.1, -gT - 0.015]], 0.002, C.hose, 30, 5, 0, 'co2Line');
    bubbleSources.push([xd, yd + 0.008, 0.03, 0.013]);
    // glass heater
    heater.push({ g: new THREE.CapsuleGeometry(0.009, Ht * 0.42, 4, 10).translate(-sp * 0.25, Ht * 0.35, 0.016), c: C.glass, n: 'heaterTube' });
    heater.push({ g: new THREE.CylinderGeometry(0.004, 0.004, Ht * 0.36, 8).translate(-sp * 0.25, Ht * 0.33, 0.016), c: C.element, n: 'heaterCoil' });
  } else if (p.techStyle === 'industrial') {
    // hollow overflow box with comb teeth
    const ow = 0.14, od = 0.08, oh = Hw + 0.005, t = 0.004, ox = -sp / 2;
    solid.push({ g: box(ow, oh - 0.025, t, ox, (oh - 0.025) / 2, od), c: C.plastic, n: 'overflowFront' });
    solid.push({ g: box(t, oh - 0.025, od, ox - ow / 2, (oh - 0.025) / 2, od / 2), c: C.plastic, n: 'overflowSide' });
    solid.push({ g: box(t, oh - 0.025, od, ox + ow / 2, (oh - 0.025) / 2, od / 2), c: C.plastic, n: 'overflowSide' });
    const teeth = 14;
    for (let i = 0; i < teeth; i++) solid.push({ g: box(ow / teeth * 0.55, 0.025, t, ox - ow / 2 + (i + 0.5) * ow / teeth, oh - 0.0125, od), c: C.plasticLight, n: 'combTooth' });
    for (let i = 0; i < 5; i++) solid.push({ g: box(t, 0.025, od / 5 * 0.55, ox - ow / 2, oh - 0.0125, (i + 0.5) * od / 5), c: C.plasticLight, n: 'combTooth' });
    addCylinder(solid, 0.012, 0.012, oh - 0.04, 12, ox - 0.03, (oh - 0.04) / 2, od / 2, 0, 0, 0, C.plasticLight);
    addCylinder(solid, 0.009, 0.009, oh - 0.03, 12, ox + 0.035, (oh - 0.03) / 2, od / 2, 0, 0, 0, C.plasticLight);
    // loc-line return nozzle
    const ry = Hw - 0.06;
    addPipe(solid, [[ox + 0.035, oh - 0.01, od / 2], [ox + 0.06, oh + 0.01, od / 2 + 0.01], [ox + 0.1, ry + 0.02, od + 0.02], [ox + 0.13, ry, od + 0.04]], 0.008, C.plasticLight, 30, 8, 7, 'locLine');
    addCylinder(solid, 0.004, 0.008, 0.016, 8, ox + 0.14, ry - 0.004, od + 0.046, 0, 0, Math.PI / 2 + 0.3, C.plastic);
    outlet = [ox + 0.2, Hw, od + 0.06]; flowDir = [1, -0.1, 0.3];
    // wavemaker: magnet pad + body + grill + impeller (rigged)
    const wx = sp / 2, wy = Hw - 0.09, wz = 0.035;
    addCylinder(solid, 0.025, 0.025, 0.008, 18, wx, wy, 0.004, Math.PI / 2, 0, 0, C.plastic);
    addWire(solid, [wx, wy, 0.008], [wx, wy, wz - 0.02], C.plasticLight, 0.008, 8);
    solid.push({ g: new THREE.LatheGeometry([new THREE.Vector2(0.0001, -0.03), new THREE.Vector2(0.018, -0.03), new THREE.Vector2(0.024, -0.015), new THREE.Vector2(0.026, 0.02), new THREE.Vector2(0.028, 0.03), new THREE.Vector2(0.024, 0.031)], 18).rotateZ(-Math.PI / 2).translate(wx, wy, wz), c: C.plastic, n: 'wavemakerBody' });
    solid.push({ g: new THREE.TorusGeometry(0.026, 0.0025, 6, 24).rotateY(Math.PI / 2).translate(wx - 0.031, wy, wz), c: C.plasticLight, n: 'grillRing' });
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI; addWire(solid, [wx - 0.031, wy + Math.cos(a) * 0.025, wz + Math.sin(a) * 0.025], [wx - 0.031, wy - Math.cos(a) * 0.025, wz - Math.sin(a) * 0.025], C.plasticLight, 0.0012, 3); }
    impeller = new THREE.Group(); impeller.name = 'impellerBlades'; impeller.position.set(wx - 0.022, wy, wz);
    const bl = [];
    for (let i = 0; i < 5; i++) bl.push({ g: box(0.002, 0.02, 0.007).translate(0, 0.011, 0).rotateY(0.5).rotateX(i / 5 * Math.PI * 2), c: C.ceramic, n: 'blade' });
    addCylinder(bl, 0.005, 0.005, 0.006, 10, 0, 0, 0, 0, 0, Math.PI / 2, C.plasticLight);
    const im = finish(bl, MAT, 'impeller', merge); if (im) impeller.add(im);
    g.add(impeller);
    addPipe(hoses, [[wx, wy, 0.004], [wx, Ht - 0.02, 0.004], [wx, Ht + 0.01, -gT / 2], [wx, Ht - 0.05, -gT - 0.01], [wx + 0.02, -0.6, -gT - 0.03]], 0.0025, C.plastic, 30, 6, 0, 'powerCord');
    // slotted heater guard
    const hx = -sp / 2 + 0.03;
    heater.push({ g: new THREE.CylinderGeometry(0.012, 0.012, Ht * 0.45, 12, 1, true).translate(hx, Ht * 0.3, od + 0.03), c: C.plastic, n: 'heaterGuard' });
    for (let i = 0; i < 8; i++) heater.push({ g: new THREE.TorusGeometry(0.0125, 0.0015, 4, 14).rotateX(Math.PI / 2).translate(hx, Ht * 0.1 + i * Ht * 0.055, od + 0.03), c: C.plasticLight, n: 'guardRib' });
    if (p.co2Bubbles) bubbleSources.push([ox, 0.04, od / 2, 0.02]);
  } else {
    // INVISIBLE: slim slot overflow + flush nozzle + hidden nano pump
    solid.push({ g: box(0.025, Hw, 0.012, -sp / 2, Hw / 2, 0.006), c: C.plastic, n: 'slotOverflow' });
    for (let i = 0; i < 10; i++) solid.push({ g: box(0.0035, 0.018, 0.002, -sp / 2 - 0.009 + i * 0.002, Hw - 0.012, 0.0125), c: C.plasticLight, n: 'slot' });
    addCylinder(solid, 0.005, 0.007, 0.012, 10, sp / 2, Hw - 0.05, 0.006, Math.PI / 2, 0, 0, C.plastic);
    outlet = [sp / 2 + 0.03, Hw, 0.04]; flowDir = [0.6, 0, 1];
    impeller = new THREE.Group(); impeller.name = 'impellerBlades'; impeller.position.set(sp / 2, Hw - 0.05, 0.013);
    const bl = []; for (let i = 0; i < 4; i++) bl.push({ g: box(0.001, 0.005, 0.0015).translate(0, 0.0028, 0).rotateZ(i * Math.PI / 2), c: C.plasticLight, n: 'blade' });
    const im = finish(bl, MAT, 'impeller', merge); if (im) impeller.add(im); impeller.rotation.x = Math.PI / 2; g.add(impeller);
  }

  const s1 = finish(solid, MAT, 'equipment', merge); if (s1) g.add(s1);
  const s2 = finish(glass, GLASS_MAT, 'glassware', merge); if (s2) { s2.renderOrder = 2; g.add(s2); }
  const hg = new THREE.Group(); hg.name = 'hoses'; const s3 = finish(hoses, HOSE_MAT, 'hoses', merge); if (s3) hg.add(s3); g.add(hg);
  const htg = new THREE.Group(); htg.name = 'heater'; const s4 = finish(heater, p.techStyle === 'glassware' ? GLASS_MAT : MAT, 'heater', merge); if (s4) htg.add(s4); g.add(htg);

  // CO2 / air bubbles (instanced)
  const bubbleGroup = new THREE.Group(); bubbleGroup.name = 'co2Bubbles';
  const NB = p.co2Bubbles ? 70 : 0;
  let bubbles = null; const bstate = [];
  if (NB && bubbleSources.length) {
    const bm = new THREE.MeshStandardMaterial({ color: C.bubble, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.6, envMapIntensity: 2 });
    bubbles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), bm, NB);
    bubbles.name = 'bubbleStream'; bubbles.frustumCulled = false;
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < NB; i++) bubbles.setMatrixAt(i, hide);
    for (let i = 0; i < NB; i++) { const s = bubbleSources[i % bubbleSources.length]; bstate.push({ s, y: s[1] + Math.random() * (Hw - s[1]), ox: (Math.random() - 0.5) * s[3], oz: (Math.random() - 0.5) * s[3], r: 0.0008 + Math.random() * 0.0012, sp: 0.06 + Math.random() * 0.05, ph: Math.random() * 6 }); }
    bubbleGroup.add(bubbles);
  }
  g.add(bubbleGroup);
  const m4 = new THREE.Matrix4(), qI = new THREE.Quaternion(), vS = new THREE.Vector3(), vP = new THREE.Vector3();

  g.userData = {
    outlet, flowDir, flowRate: p.flowRate,
    setRig(name, v) { if (name === 'co2Bubbles') bubbleGroup.visible = !!v; if (name === 'impellerBlades' && impeller) impeller.rotation.x = THREE.MathUtils.degToRad(v); },
    update(t, dt = 0.016) {
      if (impeller) impeller.children.forEach(c => { c.rotation.x += dt * (20 + 60 * p.flowRate); });
      if (bubbles) {
        for (let i = 0; i < bstate.length; i++) {
          const b = bstate[i]; b.y += b.sp * dt * (1 + (b.y - b.s[1]) * 2);
          if (b.y > Hw - 0.004) { b.y = b.s[1]; b.ox = (Math.random() - 0.5) * b.s[3]; b.oz = (Math.random() - 0.5) * b.s[3]; }
          const drift = (b.y - b.s[1]) * 0.15 * p.flowRate;
          vP.set(b.s[0] + b.ox + Math.sin(t * 6 + b.ph) * 0.002 + drift * flowDir[0], b.y, b.s[2] + b.oz + drift * flowDir[2]);
          vS.setScalar(b.r * (1 + (b.y - b.s[1]) * 0.8));
          m4.compose(vP, qI, vS); bubbles.setMatrixAt(i, m4);
        }
        bubbles.instanceMatrix.needsUpdate = true;
      }
    }
  };
  return g;
}

export default createAsset;
