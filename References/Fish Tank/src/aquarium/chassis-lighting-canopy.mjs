/*
 * CHASSIS LIGHTING CANOPY (High Detail)
 * Parametric aquarium lighting for three.js: suspended pendants, low-profile LED bar on acrylic
 * brackets, or an enclosed hollow hood. Emissive LED arrays, real SpotLights, spinning cooling
 * fans and additive volumetric god-ray shafts. No loaders, no textures.
 *
 * QUICK START
 *   import { createAsset } from './chassis-lighting-canopy.mjs';
 *   const lamp = createAsset({ fixtureType: 'pendants', lightSpectrum: 'reef-blue' });
 *   lamp.position.y = tankTopY; scene.add(lamp); // loop: lamp.userData.update(t)
 *
 * PARAMS  fixtureType: pendants | bar | hood ; lightSpectrum: daylight | reef-blue | rgb-planted | warm-spot | cyber-neon
 *         intensity 0-2, cableLength 0.2-1.2 m, fanSpeed, godRays toggle, rayLength
 * SPECS  ~1,500-3,500 triangles, 4 materials, 1.20 x 0.10-1.4 x 0.50 m default.
 * PARTS  animate: coolingFans (y spin), suspensionCables (length)
 *        detach: suspensionCables, coolingFans, godRays, hoodLid
 * LICENSE MIT - procedural geometry, free for commercial use.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = {
  housing: '#2b2e33', trim: '#1a1c1f', diffuser: '#e8eef2', cable: '#c8ccd0',
  acrylic: '#e6f4f8', fan: '#101113', grill: '#55595e', wood: '#3a2416', ceiling: '#d8d8d4'
};

export const COLORWAYS = {
  'default':  { ...BASE },
  'aluminum': { housing: '#b8bec4', trim: '#8c9298', diffuser: '#f0f4f6', cable: '#d8dce0', acrylic: '#eaf6fa', fan: '#202224', grill: '#9aa0a6', wood: '#6a4a30', ceiling: '#e0e0dc' },
  'white':    { housing: '#f0f0ee', trim: '#d8d8d6', diffuser: '#ffffff', cable: '#e8e8e8', acrylic: '#f2fafc', fan: '#c8c8c8', grill: '#bcbcbc', wood: '#e8e4dc', ceiling: '#e6e6e2' },
  'walnut':   { housing: '#4a2f1f', trim: '#2f1e14', diffuser: '#f4e8d8', cable: '#2a2a2a', acrylic: '#f4ece0', fan: '#141414', grill: '#3a3a3a', wood: '#563725', ceiling: '#d4cec4' },
  'mahogany': { housing: '#5a1f14', trim: '#3a140c', diffuser: '#f0f4ff', cable: '#c8a050', acrylic: '#e8f0f8', fan: '#121212', grill: '#c8a050', wood: '#682519', ceiling: '#d8d4cc' },
  'chrome':   { housing: '#d0d4dc', trim: '#9098a4', diffuser: '#f0e8ff', cable: '#e0e4ec', acrylic: '#e8e0ff', fan: '#1a1a22', grill: '#b8bcc8', wood: '#a8acb4', ceiling: '#c8c8d0' }
};

export const presets = COLORWAYS;

const SPECTRA = {
  'daylight':    { led: ['#fff6ea', '#ffffff', '#fff1dc'], light: '#fff4e8', ray: '#fff8ea' },
  'reef-blue':   { led: ['#4a6cff', '#ffffff', '#7a4dff', '#2f9bff'], light: '#6f8fff', ray: '#5a8cff' },
  'rgb-planted': { led: ['#ff6a8a', '#7aff8a', '#6a8aff', '#ffffff'], light: '#ffe6f2', ray: '#f2fff0' },
  'warm-spot':   { led: ['#ffb060', '#ffcf8a', '#ff9a40'], light: '#ffb670', ray: '#ffc080' },
  'cyber-neon':  { led: ['#c040ff', '#30f0ff', '#ff40c8'], light: '#a070ff', ray: '#70e8ff' }
};

export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'Merge per material or keep selectable parts.' },
  colorway:      { type: 'choice', default: 'default', options: Object.keys(COLORWAYS), label: 'Finish', affects: 'colors', describe: 'Housing finish.' },
  fixtureType:   { type: 'choice', default: 'pendants', options: ['pendants', 'bar', 'hood'], label: 'Fixture', affects: 'geometry', describe: 'Suspended pendants, low-profile bar, or full hood.' },
  lightSpectrum: { type: 'choice', default: 'daylight', options: Object.keys(SPECTRA), label: 'Spectrum', affects: 'colors', describe: '6500K daylight, 10000K reef blue, RGB planted, warm spot, cyber neon.' },
  intensity:     { type: 'range', default: 1.0, min: 0, max: 2, step: 0.05, label: 'Intensity', affects: 'colors', describe: 'Dim moonlight to midday sun.' },
  width:         { type: 'range', default: 1.2, min: 0.5, max: 2.4, step: 0.05, label: 'Width', affects: 'geometry', describe: 'Tank width to cover (m).' },
  depth:         { type: 'range', default: 0.5, min: 0.3, max: 1.2, step: 0.05, label: 'Depth', affects: 'geometry', describe: 'Tank depth to cover (m).' },
  hangHeight:    { type: 'range', default: 0.28, min: 0.12, max: 0.6, step: 0.01, label: 'Hang Height', affects: 'geometry', describe: 'Pendant height above the glass (m).' },
  cableLength:   { type: 'range', default: 0.7, min: 0.2, max: 1.2, step: 0.05, label: 'Cable Length', affects: 'geometry', describe: 'Suspension cable length (m).' },
  fanSpeed:      { type: 'range', default: 1, min: 0, max: 3, step: 0.1, label: 'Fan Speed', affects: 'geometry', describe: 'Cooling fan RPM multiplier.' },
  godRays:       { type: 'toggle', default: true, label: 'God Rays', affects: 'geometry', describe: 'Volumetric light shafts into the water.' },
  rayLength:     { type: 'range', default: 0.5, min: 0.1, max: 1.2, step: 0.01, label: 'Ray Length', affects: 'geometry', describe: 'Depth the shafts reach (m).' },
  castShadows:   { type: 'toggle', default: true, label: 'Cast Shadows', affects: 'geometry', describe: 'Primary spotlight casts shadows.' },
  seed:          { type: 'range', default: 7, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Ray jitter seed.' }
};

export const rig = {
  coolingFans:      { axis: 'y', range: [0, 360], describe: 'Fans spin continuously.' },
  suspensionCables: { axis: 'y', range: [0.2, 1.2], describe: 'Cable length.' },
  hoodLid:          { axis: 'x', range: [0, -100], describe: 'Hood front flap flips up.' }
};

export const detach = ['suspensionCables', 'coolingFans', 'godRays', 'hoodLid'];

export const night = {
  ledArray: { color: '#3050ff', intensity: 0.15, distance: 2, describe: 'Moonlight channel.' }
};

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

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.45, metalness: 0.5, side: THREE.DoubleSide });
const GLASS_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.1, metalness: 0.0, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
const LED_MAT = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

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

function box(w, h, d, x = 0, y = 0, z = 0) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

function addCylinder(parts, rTop, rBot, h, segs, x, y, z, rx = 0, ry = 0, rz = 0, hex = '#888888') {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  if (rx) geo.rotateX(rx);
  if (ry) geo.rotateY(ry);
  if (rz) geo.rotateZ(rz);
  geo.translate(x, y, z);
  parts.push({ g: geo, c: hex });
}

function addWire(parts, p1, p2, hex, r = 0.01, radialSegments = 5) {
  const v1 = new THREE.Vector3(...p1), v2 = new THREE.Vector3(...p2);
  const dist = v1.distanceTo(v2);
  if (dist < 1e-5) return;
  const geo = new THREE.CylinderGeometry(r, r, dist, radialSegments);
  const mid = v1.clone().lerp(v2, 0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v2.clone().sub(v1).normalize());
  geo.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
  parts.push({ g: geo, c: hex });
}

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

// housing slab: rounded rectangle footprint, bevelled, lying flat (XZ), bottom at y
function slab(w, d, h, r, y) {
  const geo = new THREE.ExtrudeGeometry(roundedRect(w, d, r), { depth: h, bevelEnabled: true, bevelThickness: Math.min(0.006, h * 0.3), bevelSize: Math.min(0.006, r * 0.5), bevelSegments: 2, curveSegments: 5 });
  geo.rotateX(-Math.PI / 2).translate(0, y, 0);
  return geo;
}

function ledGrid(list, w, d, y, cols, rows, colors, r = 0.0045) {
  let k = 0;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = -w / 2 + (i + 0.5) * w / cols, z = -d / 2 + (j + 0.5) * d / rows;
    const g = new THREE.CircleGeometry(r, 8).rotateX(Math.PI / 2).translate(x, y, z);
    list.push({ g, c: colors[k++ % colors.length], n: 'led' });
  }
}

function makeFan(C, merge, r) {
  const fan = new THREE.Group(); fan.name = 'coolingFans';
  const blades = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.quadraticCurveTo(r * 0.5, r * 0.25, r * 0.95, r * 0.12); s.quadraticCurveTo(r * 0.7, -r * 0.12, 0, -r * 0.08);
    const bg = new THREE.ShapeGeometry(s, 4).rotateX(-Math.PI / 2).rotateZ(0.25).rotateY(i * Math.PI * 2 / 7);
    blades.push({ g: bg, c: C.fan, n: 'fanBlade' });
  }
  addCylinder(blades, r * 0.28, r * 0.28, 0.006, 12, 0, 0, 0, 0, 0, 0, C.fan);
  const m = finish(blades, MAT, 'fanRotor', merge); if (m) fan.add(m);
  return fan;
}

export function createAsset(userParams = {}) {
  const p = {};
  for (const k of Object.keys(params)) p[k] = params[k].default;
  Object.assign(p, userParams);
  const C = zonesFor(p.colorway, userParams);
  const merge = !!p.mergeForProduction;
  const SP = SPECTRA[p.lightSpectrum] || SPECTRA.daylight;
  const W = p.width, D = p.depth;
  const rnd = rng(p.seed);

  const g = new THREE.Group(); g.name = 'chassis-lighting-canopy';
  const parts = [], clear = [], leds = [], cables = [];
  const fans = [];
  const sources = []; // [x, y, z, footprintRadius]
  const lights = [];
  const lidPivot = new THREE.Group(); lidPivot.name = 'hoodLid';

  const ledScale = (hex) => { const c = new THREE.Color(hex); c.multiplyScalar(0.4 + p.intensity * 0.8); return c.getHex(); };
  const ledCols = SP.led.map(ledScale);

  if (p.fixtureType === 'pendants') {
    const count = W > 1.5 ? 3 : W > 0.8 ? 2 : 1;
    const pw = Math.min(0.42, W / count * 0.78), pd = Math.min(0.32, D * 0.7), ph = 0.035;
    const y0 = p.hangHeight;
    // ceiling canopy rail
    const ceilY = y0 + ph + p.cableLength;
    parts.push({ g: box(W * 0.85, 0.02, 0.06, 0, ceilY + 0.01, 0), c: C.ceiling, n: 'ceilingRail' });
    for (let i = 0; i < count; i++) {
      const x = -W / 2 + (i + 0.5) * W / count;
      parts.push({ g: slab(pw, pd, ph, 0.03, y0).translate(x, 0, 0), c: C.housing, n: 'pendantHousing' });
      // heat-sink fins on top
      const nf = 9;
      for (let f = 0; f < nf; f++) parts.push({ g: box(0.004, 0.014, pd * 0.7, x - pw * 0.35 + f * pw * 0.7 / (nf - 1), y0 + ph + 0.013, 0), c: C.trim, n: 'heatSinkFin' });
      // diffuser lens recessed in base
      clear.push({ g: box(pw * 0.86, 0.003, pd * 0.8, x, y0 - 0.0035, 0), c: C.diffuser, n: 'diffuser' });
      ledGrid(leds, pw * 0.8, pd * 0.72, y0 - 0.006, 8, 5, ledCols);
      // fan module on top
      const fan = makeFan(C, merge, 0.03);
      fan.position.set(x + pw * 0.28, y0 + ph + 0.024, 0);
      fans.push(fan); g.add(fan);
      addCylinder(parts, 0.036, 0.036, 0.006, 16, x + pw * 0.28, y0 + ph + 0.02, 0, 0, 0, C.grill);
      // cables: two per pendant, V to ceiling
      [-1, 1].forEach(s => {
        addWire(cables, [x + s * pw * 0.38, y0 + ph + 0.008, 0], [x + s * pw * 0.2, ceilY, 0], C.cable, 0.0009, 4);
        addCylinder(parts, 0.006, 0.006, 0.012, 8, x + s * pw * 0.38, y0 + ph + 0.008, 0, 0, 0, C.trim);
      });
      addWire(cables, [x, y0 + ph + 0.01, -pd * 0.3], [x, ceilY, -0.02], C.trim, 0.0018, 5); // power cord
      sources.push([x, y0 - 0.01, 0, Math.min(pw, pd) * 0.45]);
    }
  } else if (p.fixtureType === 'bar') {
    const bw = W * 0.92, bd = 0.11, bh = 0.022, y0 = 0.045;
    parts.push({ g: slab(bw, bd, bh, 0.02, y0), c: C.housing, n: 'ledBar' });
    parts.push({ g: box(bw * 0.98, 0.004, bd * 0.9, 0, y0 + bh + 0.008, 0), c: C.trim, n: 'topCap' });
    clear.push({ g: box(bw * 0.96, 0.003, bd * 0.8, 0, y0 - 0.0035, 0), c: C.diffuser, n: 'lens' });
    ledGrid(leds, bw * 0.94, bd * 0.6, y0 - 0.0055, Math.round(bw / 0.025), 3, ledCols);
    // acrylic brackets resting on front/back glass rims (hollow L-feet)
    [-1, 1].forEach(sx => {
      const x = sx * bw * 0.44;
      clear.push({ g: box(0.035, y0, 0.012, x, y0 / 2, 0), c: C.acrylic, n: 'acrylicLeg' });
      clear.push({ g: box(0.035, 0.008, D * 0.5, x, 0.004, 0), c: C.acrylic, n: 'acrylicRail' });
      [-1, 1].forEach(sz => clear.push({ g: box(0.035, 0.03, 0.006, x, -0.012, sz * (D / 2 + 0.003)), c: C.acrylic, n: 'rimHook' }));
    });
    for (let i = 0; i < 2; i++) {
      const fan = makeFan(C, merge, 0.022);
      fan.position.set((i ? 1 : -1) * bw * 0.22, y0 + bh + 0.014, 0); fans.push(fan); g.add(fan);
      addCylinder(parts, 0.026, 0.026, 0.004, 14, (i ? 1 : -1) * bw * 0.22, y0 + bh + 0.011, 0, 0, 0, C.grill);
    }
    addWire(cables, [bw / 2, y0 + 0.01, 0], [bw / 2 + 0.06, y0 + 0.01, -0.05], C.trim, 0.002, 5);
    addWire(cables, [bw / 2 + 0.06, y0 + 0.01, -0.05], [bw / 2 + 0.08, -0.6, -D / 2 - 0.04], C.trim, 0.002, 5);
    const n = Math.max(2, Math.round(W / 0.45));
    for (let i = 0; i < n; i++) sources.push([-bw / 2 + (i + 0.5) * bw / n, y0 - 0.01, 0, 0.05]);
  } else {
    // HOOD: hollow enclosure (top, 4 walls, open bottom), front flip lid, trim, interior LED strip
    const hw = W + 0.03, hd = D + 0.03, hh = 0.18, t = 0.014;
    const wood = C.wood;
    parts.push({ g: box(hw, t, hd, 0, hh - t / 2, 0), c: wood, n: 'hoodTop' });
    parts.push({ g: box(hw, hh, t, 0, hh / 2, -hd / 2 + t / 2), c: wood, n: 'hoodBack' });
    parts.push({ g: box(t, hh, hd, -hw / 2 + t / 2, hh / 2, 0), c: wood, n: 'hoodSide' });
    parts.push({ g: box(t, hh, hd, hw / 2 - t / 2, hh / 2, 0), c: wood, n: 'hoodSide' });
    parts.push({ g: box(hw, hh * 0.45, t, 0, hh * 0.225, hd / 2 - t / 2), c: wood, n: 'hoodFrontRail' });
    // crown molding swept along front
    const cs = new THREE.Shape(); cs.moveTo(0, 0); cs.lineTo(0.012, 0); cs.quadraticCurveTo(0.012, 0.018, 0.028, 0.024); cs.lineTo(0.028, 0.032); cs.lineTo(0, 0.032); cs.closePath();
    const crown = new THREE.ExtrudeGeometry(cs, { depth: hw + 0.04, bevelEnabled: false, curveSegments: 5 });
    crown.rotateY(-Math.PI / 2).translate((hw + 0.04) / 2, hh - 0.032, hd / 2);
    parts.push({ g: crown, c: C.trim, n: 'crownMolding' });
    parts.push({ g: box(hw + 0.01, 0.02, hd + 0.01, 0, 0.01, 0).translate(0, 0, 0), c: C.trim, n: 'baseTrimRing' });
    // interior lining + LED strip under the top
    parts.push({ g: box(hw - 2 * t, 0.004, hd - 2 * t, 0, hh - t - 0.002, 0), c: C.diffuser, n: 'reflector' });
    ledGrid(leds, hw * 0.85, hd * 0.6, hh - t - 0.006, Math.round(hw / 0.03), 4, ledCols);
    // flip lid (pivot at the top-front edge)
    const lidParts = [];
    const lidH = hh * 0.55 - t;
    lidParts.push({ g: box(hw - 0.004, lidH, t, 0, -lidH / 2, t / 2), c: wood, n: 'flipLid' });
    lidParts.push({ g: box(hw * 0.3, 0.012, 0.012, 0, -lidH + 0.02, t + 0.006), c: C.trim, n: 'lidPull' });
    const lm = finish(lidParts, MAT, 'hoodLidPanel', merge); if (lm) lidPivot.add(lm);
    lidPivot.position.set(0, hh - t, hd / 2 - t);
    g.add(lidPivot);
    // vent fans in the top
    for (let i = 0; i < 2; i++) {
      const fan = makeFan(C, merge, 0.035);
      fan.position.set((i ? 1 : -1) * hw * 0.25, hh + 0.004, -hd * 0.15); fans.push(fan); g.add(fan);
      addCylinder(parts, 0.042, 0.042, 0.004, 16, (i ? 1 : -1) * hw * 0.25, hh + 0.002, -hd * 0.15, 0, 0, 0, C.grill);
    }
    const n = Math.max(2, Math.round(W / 0.4));
    for (let i = 0; i < n; i++) sources.push([-hw * 0.4 + (i + 0.5) * hw * 0.8 / n, hh - t - 0.01, 0, 0.08]);
  }

  const s1 = finish(parts, MAT, 'housing', merge); if (s1) g.add(s1);
  const s2 = finish(clear, GLASS_MAT, 'acrylic', merge); if (s2) g.add(s2);
  const s3 = finish(leds, LED_MAT, 'ledArray', merge); if (s3) { s3.traverse(o => { o.castShadow = false; }); g.add(s3); }
  const cableGroup = new THREE.Group(); cableGroup.name = 'suspensionCables';
  const s4 = finish(cables, MAT, 'cables', merge); if (s4) cableGroup.add(s4);
  g.add(cableGroup);

  // ---------- real lights ----------
  const lightCol = new THREE.Color(SP.light);
  const perLight = (p.intensity * 6) / Math.max(1, sources.length) * (p.fixtureType === 'pendants' ? 1.6 : 1.2);
  sources.forEach((s, i) => {
    const sl = new THREE.SpotLight(lightCol, perLight, 3.0, Math.PI / 3.2, 0.7, 1.2);
    sl.position.set(s[0], s[1], s[2]);
    sl.target.position.set(s[0], s[1] - 1, s[2]);
    sl.castShadow = !!p.castShadows && i === 0;
    if (sl.castShadow) { sl.shadow.mapSize.set(1024, 1024); sl.shadow.bias = -0.0005; sl.shadow.camera.near = 0.05; sl.shadow.camera.far = 3; }
    sl.name = 'spot'; g.add(sl, sl.target); lights.push(sl);
  });

  // ---------- god rays ----------
  const rayGroup = new THREE.Group(); rayGroup.name = 'godRays';
  const rayCol = new THREE.Color(SP.ray);
  const rayMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: rayCol }, uStrength: { value: 0.11 * (0.4 + p.intensity * 0.6) } },
    vertexShader: 'varying vec2 vUv; varying float vSeed; attribute float aSeed; void main(){ vUv = uv; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uTime; uniform vec3 uColor; uniform float uStrength; varying vec2 vUv; varying float vSeed; void main(){ float edge = sin(vUv.x * 3.14159); edge = pow(edge, 1.6); float fade = pow(vUv.y, 1.4) * smoothstep(0.0, 0.08, vUv.y); float fl = 0.65 + 0.35 * sin(uTime * 0.8 + vSeed * 6.28 + vUv.y * 4.0); float dust = 0.85 + 0.15 * sin(vUv.y * 90.0 + uTime * 0.6 + vSeed * 40.0); gl_FragColor = vec4(uColor * edge * fade * fl * dust * uStrength, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
  if (p.godRays) {
    const startY = p.fixtureType === 'pendants' ? -0.01 : -0.02;
    sources.forEach((s) => {
      const nr = p.fixtureType === 'pendants' ? 4 : 2;
      for (let k = 0; k < nr; k++) {
        const len = p.rayLength * (0.7 + rnd() * 0.35);
        const top = 0.01 + rnd() * 0.02, bot = top + 0.04 + rnd() * 0.06;
        const geo = new THREE.CylinderGeometry(top, bot, len, 10, 1, true);
        geo.translate(0, -len / 2, 0);
        geo.rotateZ((rnd() - 0.5) * 0.35); geo.rotateX((rnd() - 0.5) * 0.25);
        geo.translate(s[0] + (rnd() - 0.5) * s[3] * 2, startY, s[2] + (rnd() - 0.5) * D * 0.5);
        const seed = new Float32Array(geo.attributes.position.count).fill(rnd());
        geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
        const m = new THREE.Mesh(geo, rayMat); m.name = 'lightShaft'; m.renderOrder = 6;
        rayGroup.add(m);
      }
    });
  }
  g.add(rayGroup);

  g.userData = {
    lights, sources, spectrum: SP, lightColor: SP.light,
    setRig(name, v) {
      if (name === 'hoodLid') lidPivot.rotation.x = -THREE.MathUtils.degToRad(100) * v;
      if (name === 'godRays') rayGroup.visible = !!v;
    },
    update(t, dt = 0.016) {
      fans.forEach((f, i) => { f.rotation.y += dt * 25 * p.fanSpeed * (i % 2 ? 1 : 0.93); });
      rayMat.uniforms.uTime.value = t;
    }
  };
  return g;
}

export default createAsset;
