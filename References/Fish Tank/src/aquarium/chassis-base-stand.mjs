/*
 * CHASSIS BASE STAND (High Detail)
 * A parametric low-poly aquarium cabinet for three.js: one import, no loader, no textures.
 *
 * QUICK START
 *   import { createAsset } from './chassis-base-stand.mjs';
 *   scene.add(createAsset({ mergeForProduction: true, standStyle: 'minimalist' }));
 *
 * PARAMS  standStyle: minimalist | rustic | industrial | ornate | pedestal
 *         colorway (materialFinish): default(matte-black) | gloss-white | oak | walnut | brushed-steel | mahogany
 *         width 0.6-2.4m, depth 0.35-0.9m, height 0.3-1.2m, doorsOpen 0-1, underglow toggle
 * SPECS  ~1,800-4,200 triangles, 3 materials, 1.30 x 0.80 x 0.55 m default (real-world scale).
 *        Hollow carcass: floor, back, divider, shelf, sump with baffles visible when doors open.
 * PARTS  animate: cabinetDoors (y, 0..-95deg)
 *        detach: cabinetDoors, ambientUnderglow, sump
 * LICENSE MIT - procedural geometry, free for commercial use.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = {
  body: '#1d1f22', trim: '#2a2d31', door: '#202326', interior: '#3a3d42',
  metal: '#9aa0a6', sump: '#cfe8f0', water: '#5fa8c8', pump: '#111111', glow: '#3fd0ff'
};

export const COLORWAYS = {
  'default':       { ...BASE },
  'gloss-white':   { body: '#f2f2f0', trim: '#e4e4e2', door: '#fafaf8', interior: '#d8d8d6', metal: '#c0c4c8', sump: '#d6eef5', water: '#8fd0e8', pump: '#2a2a2a', glow: '#ffffff' },
  'oak':           { body: '#b8875a', trim: '#9c6f45', door: '#c4925f', interior: '#8a6440', metal: '#3a3a3a', sump: '#d6eef5', water: '#6fb8d8', pump: '#1a1a1a', glow: '#ffd28a' },
  'walnut':        { body: '#4a2f1f', trim: '#3a2416', door: '#563725', interior: '#2f1e14', metal: '#b08a4a', sump: '#e8dcc0', water: '#a07040', pump: '#151515', glow: '#ffb050' },
  'brushed-steel': { body: '#a8adb3', trim: '#c9ced4', door: '#b5bac0', interior: '#5c6066', metal: '#e0e4e8', sump: '#d0f0ff', water: '#60c0e0', pump: '#202020', glow: '#c040ff' },
  'mahogany':      { body: '#5a1f14', trim: '#43160e', door: '#682519', interior: '#3a140c', metal: '#c8a050', sump: '#e0f0f4', water: '#70b8d8', pump: '#181818', glow: '#7fb8ff' }
};

export const presets = COLORWAYS;

export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'Merge every material into one draw call (true) or keep individually selectable meshes (false).' },
  colorway:   { type: 'choice', default: 'default', options: Object.keys(COLORWAYS), label: 'Material Finish', affects: 'colors', describe: 'Matte black, gloss white, oak, walnut, brushed steel or mahogany.' },
  standStyle: { type: 'choice', default: 'minimalist', options: ['minimalist', 'rustic', 'industrial', 'ornate', 'pedestal'], label: 'Stand Style', affects: 'geometry', describe: 'Overall furniture construction.' },
  width:      { type: 'range', default: 1.3, min: 0.6, max: 2.4, step: 0.05, label: 'Width', affects: 'geometry', describe: 'Cabinet width (m).' },
  depth:      { type: 'range', default: 0.55, min: 0.35, max: 0.9, step: 0.05, label: 'Depth', affects: 'geometry', describe: 'Cabinet depth (m).' },
  height:     { type: 'range', default: 0.8, min: 0.3, max: 1.2, step: 0.05, label: 'Height', affects: 'geometry', describe: 'Low-profile to eye-level (m).' },
  doorsOpen:  { type: 'range', default: 0, min: 0, max: 1, step: 0.01, label: 'Doors Open', affects: 'geometry', describe: 'Door swing amount, reveals the sump.' },
  underglow:  { type: 'toggle', default: true, label: 'Ambient Underglow', affects: 'geometry', describe: 'LED strip and floor halo at the plinth.' },
  glow:       { type: 'color', default: BASE.glow, label: 'Underglow Color', affects: 'colors', describe: 'LED strip color.' }
};

export const rig = {
  cabinetDoors: { axis: 'y', range: [0, -95], describe: 'Cabinet doors swing outward to reveal the sump.' }
};

export const detach = ['cabinetDoors', 'ambientUnderglow', 'sump'];

export const night = {
  ambientUnderglow: { color: '#3fd0ff', intensity: 1.2, distance: 2.5, describe: 'LED strip washes the floor.' }
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
  if (geo.attributes.uv1) geo.deleteAttribute('uv1');
  if (geo.attributes.normal) geo.deleteAttribute('normal');
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide });
const METAL_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.3, metalness: 0.85, side: THREE.DoubleSide });
const GLASS_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });

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

// Molding profile swept along an edge (front: along X facing +Z; left/right: along Z facing -X/+X)
function addMolding(parts, profile, len, side, y, offset, hex) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  profile.forEach(([u, v]) => s.lineTo(u, v));
  s.lineTo(0, profile[profile.length - 1][1]);
  s.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: 6 });
  if (side === 'front') { geo.rotateY(-Math.PI / 2); geo.translate(len / 2, y, offset); }
  else if (side === 'right') { geo.translate(offset, y, -len / 2); }
  else { geo.rotateY(Math.PI); geo.translate(-offset, y, len / 2); }
  parts.push({ g: geo, c: hex });
}

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

export function createAsset(userParams = {}) {
  const p = {};
  for (const k of Object.keys(params)) p[k] = params[k].default;
  Object.assign(p, userParams);
  const C = zonesFor(p.colorway, userParams);
  const merge = !!p.mergeForProduction;
  const W = p.width, D = p.depth, H = p.height, style = p.standStyle;

  const g = new THREE.Group();
  g.name = 'chassis-base-stand';

  const parts = [], metal = [], glass = [], sump = [], sumpGlass = [];
  const add = (geo, c, n) => parts.push({ g: geo, c, n });
  const doorPivots = [];
  const t = 0.018;
  const topT = style === 'rustic' ? 0.045 : 0.03;
  const plinth = style === 'rustic' ? 0.1 : style === 'industrial' ? 0.05 : 0.07;
  const isMetalFinish = p.colorway === 'brushed-steel';
  const bodyList = isMetalFinish ? metal : parts;
  const addB = (geo, c, n) => bodyList.push({ g: geo, c, n });

  // ---------- SUMP (shared by all styles, sits on the interior floor) ----------
  const buildSump = (floorY, maxW, maxD, maxH) => {
    const sw = Math.min(maxW * 0.62, 0.9), sd = Math.min(maxD * 0.62, 0.4), sh = Math.min(maxH * 0.55, 0.32);
    const sz = -0.02;
    const wallT = 0.006;
    // acrylic shell: base + 4 walls (hollow, open top)
    sumpGlass.push({ g: box(sw, wallT, sd, 0, floorY + wallT / 2, sz), c: C.sump, n: 'sumpBase' });
    sumpGlass.push({ g: box(sw, sh, wallT, 0, floorY + sh / 2, sz + sd / 2), c: C.sump, n: 'sumpFront' });
    sumpGlass.push({ g: box(sw, sh, wallT, 0, floorY + sh / 2, sz - sd / 2), c: C.sump, n: 'sumpBack' });
    sumpGlass.push({ g: box(wallT, sh, sd, -sw / 2, floorY + sh / 2, sz), c: C.sump, n: 'sumpSide' });
    sumpGlass.push({ g: box(wallT, sh, sd, sw / 2, floorY + sh / 2, sz), c: C.sump, n: 'sumpSide' });
    // baffles (over-under-over)
    [-0.18, -0.08, 0.02].forEach((f, i) => {
      const bh = i === 1 ? sh * 0.7 : sh * 0.8;
      const by = i === 1 ? floorY + sh - bh / 2 : floorY + bh / 2;
      sumpGlass.push({ g: box(wallT, bh, sd - 0.012, f * sw * 2, by, sz), c: C.sump, n: 'baffle' });
    });
    // water body
    sumpGlass.push({ g: box(sw - 0.014, sh * 0.72, sd - 0.014, 0, floorY + sh * 0.36 + 0.004, sz), c: C.water, n: 'sumpWater' });
    // filter sock + return pump + plumbing
    addCylinder(sump, 0.05, 0.045, sh * 0.6, 12, -sw * 0.38, floorY + sh * 0.6, sz, 0, 0, 0, C.interior);
    addCylinder(sump, 0.045, 0.045, 0.08, 14, sw * 0.32, floorY + 0.045, sz, 0, 0, 0, C.pump);
    addCylinder(sump, 0.012, 0.012, maxH - sh * 0.1, 8, sw * 0.32, floorY + 0.08 + (maxH - sh * 0.1) / 2, sz - 0.05, 0, 0, 0, C.pump);
    addCylinder(sump, 0.018, 0.018, maxH - sh * 0.5, 8, -sw * 0.38, floorY + sh * 0.5 + (maxH - sh * 0.5) / 2, sz - 0.08, 0, 0, 0, C.pump);
    // heater
    addCylinder(sump, 0.012, 0.012, sh * 0.6, 8, sw * 0.12, floorY + sh * 0.4, sz - sd * 0.3, 0, 0, 0, C.pump);
  };

  // ---------- DOOR BUILDER ----------
  const makeDoor = (dw, dh, hingeX, yMid, zFront, dir, kind) => {
    const pivot = new THREE.Group();
    pivot.name = 'cabinetDoors';
    pivot.position.set(hingeX, yMid, zFront);
    pivot.userData.dir = dir;
    const dp = [], dm = [];
    const cx = dir * dw / 2; // door centre relative to hinge
    if (kind === 'minimalist') {
      (isMetalFinish ? dm : dp).push({ g: box(dw, dh, t, cx, 0, 0), c: C.door, n: 'doorPanel' });
      // J-pull groove along top edge (handle-less)
      dp.push({ g: box(dw * 0.9, 0.012, 0.004, cx, dh / 2 - 0.02, t / 2 + 0.002), c: C.trim, n: 'jPull' });
    } else if (kind === 'rustic') {
      const n = 3, pw = (dw - 0.006 * (n - 1)) / n;
      for (let i = 0; i < n; i++) dp.push({ g: box(pw, dh, t, dir * (pw / 2 + i * (pw + 0.006)), 0, 0), c: i % 2 ? C.door : C.body, n: 'plank' });
      dp.push({ g: box(dw * 0.94, 0.06, 0.012, cx, dh * 0.33, t / 2 + 0.006), c: C.trim, n: 'batten' });
      dp.push({ g: box(dw * 0.94, 0.06, 0.012, cx, -dh * 0.33, t / 2 + 0.006), c: C.trim, n: 'batten' });
      const br = Math.hypot(dw * 0.8, dh * 0.6), ba = Math.atan2(dh * 0.6, dw * 0.8 * dir);
      dp.push({ g: box(br, 0.05, 0.01, cx, 0, t / 2 + 0.005).translate(-cx, 0, 0).rotateZ(ba).translate(cx, 0, 0), c: C.trim, n: 'zBrace' });
      const ring = new THREE.TorusGeometry(0.025, 0.004, 6, 14).translate(dir * (dw - 0.06), 0, t / 2 + 0.02);
      dm.push({ g: ring, c: C.metal, n: 'ringPull' });
      addCylinder(dm, 0.01, 0.01, 0.02, 8, dir * (dw - 0.06), 0.025, t / 2 + 0.01, Math.PI / 2, 0, 0, C.metal);
    } else if (kind === 'ornate') {
      dp.push({ g: box(dw, dh, t, cx, 0, 0), c: C.door, n: 'doorPanel' });
      const raised = new THREE.ExtrudeGeometry(roundedRectShape(dw * 0.74, dh * 0.8, 0.04), { depth: 0.008, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.01, bevelSegments: 2, curveSegments: 4 });
      raised.translate(cx, 0, t / 2);
      dp.push({ g: raised, c: C.trim, n: 'raisedPanel' });
      const knob = new THREE.SphereGeometry(0.014, 10, 8).translate(dir * (dw - 0.045), 0, t / 2 + 0.03);
      dm.push({ g: knob, c: C.metal, n: 'knob' });
      addCylinder(dm, 0.005, 0.008, 0.02, 8, dir * (dw - 0.045), 0, t / 2 + 0.012, Math.PI / 2, 0, 0, C.metal);
    } else if (kind === 'industrial') {
      const fb = 0.02;
      dm.push({ g: box(dw, fb, fb, cx, dh / 2 - fb / 2, 0), c: C.metal, n: 'doorFrame' });
      dm.push({ g: box(dw, fb, fb, cx, -dh / 2 + fb / 2, 0), c: C.metal, n: 'doorFrame' });
      dm.push({ g: box(fb, dh, fb, dir * fb / 2, 0, 0), c: C.metal, n: 'doorFrame' });
      dm.push({ g: box(fb, dh, fb, dir * (dw - fb / 2), 0, 0), c: C.metal, n: 'doorFrame' });
      const nx = Math.max(3, Math.round(dw / 0.05)), ny = Math.max(4, Math.round(dh / 0.05));
      for (let i = 1; i < nx; i++) { const x = dir * (i * dw / nx); addWire(dm, [x, -dh / 2 + fb, 0], [x, dh / 2 - fb, 0], C.pump, 0.0015, 3); }
      for (let j = 1; j < ny; j++) { const y = -dh / 2 + j * dh / ny; addWire(dm, [dir * fb, y, 0], [dir * (dw - fb), y, 0], C.pump, 0.0015, 3); }
      addWire(dm, [dir * (dw - 0.04), -0.1, 0.03], [dir * (dw - 0.04), 0.1, 0.03], C.metal, 0.006, 6);
      addWire(dm, [dir * (dw - 0.04), -0.1, 0.0], [dir * (dw - 0.04), -0.1, 0.03], C.metal, 0.005, 5);
      addWire(dm, [dir * (dw - 0.04), 0.1, 0.0], [dir * (dw - 0.04), 0.1, 0.03], C.metal, 0.005, 5);
    }
    const a = finish(dp, MAT, 'door', merge); if (a) pivot.add(a);
    const b = finish(dm, METAL_MAT, 'doorHardware', merge); if (b) pivot.add(b);
    doorPivots.push(pivot);
    g.add(pivot);
  };

  let underglowY = 0.012, underglowZ = D / 2 - 0.03, underglowW = W - 0.08, glowRadius = 0;

  if (style === 'minimalist' || style === 'rustic' || style === 'ornate') {
    // --- plinth or legs ---
    if (style === 'rustic') {
      const lg = 0.08;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => add(box(lg, H - topT, lg, sx * (W / 2 - lg / 2), (H - topT) / 2, sz * (D / 2 - lg / 2)), C.trim, 'leg'));
      add(box(W - 0.16, 0.05, 0.03, 0, plinth * 0.5, D / 2 - 0.04), C.trim, 'stretcher');
      add(box(W - 0.16, 0.05, 0.03, 0, plinth * 0.5, -D / 2 + 0.04), C.trim, 'stretcher');
      const n = 5, pd = (D - 0.004 * (n - 1)) / n;
      for (let i = 0; i < n; i++) add(box(W + 0.04, topT, pd, 0, H - topT / 2, -D / 2 + pd / 2 + i * (pd + 0.004)), i % 2 ? C.body : C.trim, 'topPlank');
      metal.push({ g: box(0.04, 0.003, D + 0.004, -W / 2 + 0.1, H + 0.0015, 0), c: C.metal, n: 'ironStrap' });
      metal.push({ g: box(0.04, 0.003, D + 0.004, W / 2 - 0.1, H + 0.0015, 0), c: C.metal, n: 'ironStrap' });
    } else {
      addB(box(W - 0.06, plinth, D - 0.05, 0, plinth / 2, -0.01), C.trim, 'plinth');
      addB(box(W + (style === 'ornate' ? 0.04 : 0), topT, D + (style === 'ornate' ? 0.03 : 0), 0, H - topT / 2, 0), C.body, 'top');
    }
    const innerTop = H - topT;
    // --- hollow carcass: floor, sides, back, divider, shelf ---
    addB(box(W, t, D, 0, plinth + t / 2, 0), C.body, 'floor');
    addB(box(t, innerTop - plinth, D, -W / 2 + t / 2, (innerTop + plinth) / 2, 0), C.body, 'sideL');
    addB(box(t, innerTop - plinth, D, W / 2 - t / 2, (innerTop + plinth) / 2, 0), C.body, 'sideR');
    add(box(W - 2 * t, innerTop - plinth, t, 0, (innerTop + plinth) / 2, -D / 2 + t / 2), C.interior, 'back');
    add(box(W - 2 * t, t, D - t, 0, innerTop - t / 2, t / 2), C.interior, 'ceiling');
    add(box(W * 0.22 - t, t, D - 2 * t, W / 2 - t - W * 0.11, plinth + (innerTop - plinth) * 0.55, 0), C.interior, 'shelf');
    add(box(t, innerTop - plinth - 2 * t, D - 2 * t, W / 2 - t - W * 0.22, (innerTop + plinth) / 2, 0), C.interior, 'divider');
    // front face frame rails (doors close against them)
    addB(box(W, 0.03, t, 0, innerTop - 0.015, D / 2 - t / 2), C.body, 'rail');
    addB(box(W, 0.03, t, 0, plinth + t + 0.015, D / 2 - t / 2), C.body, 'rail');
    // ornate columns + moldings
    if (style === 'ornate') {
      const ch = innerTop - plinth;
      const prof = [];
      prof.push(new THREE.Vector2(0, 0), new THREE.Vector2(0.045, 0), new THREE.Vector2(0.045, 0.03), new THREE.Vector2(0.036, 0.045));
      for (let i = 0; i <= 6; i++) prof.push(new THREE.Vector2(0.03 - 0.004 * Math.sin(i / 6 * Math.PI), 0.05 + (ch - 0.12) * i / 6));
      prof.push(new THREE.Vector2(0.038, ch - 0.06), new THREE.Vector2(0.046, ch - 0.03), new THREE.Vector2(0.046, ch), new THREE.Vector2(0, ch));
      [-1, 1].forEach(sx => {
        const col = new THREE.LatheGeometry(prof, 16).translate(sx * (W / 2 + 0.005), plinth, D / 2 + 0.01);
        add(col, C.trim, 'flutedColumn');
      });
      const crown = [[0.01, 0], [0.012, 0.01], [0.025, 0.02], [0.035, 0.035], [0.035, 0.045]];
      addMolding(parts, crown, W + 0.06, 'front', innerTop - 0.045, D / 2, C.trim);
      addMolding(parts, crown, D, 'right', innerTop - 0.045, W / 2, C.trim);
      addMolding(parts, crown, D, 'left', innerTop - 0.045, W / 2, C.trim);
      const basem = [[0.02, 0], [0.02, 0.02], [0.012, 0.035], [0.008, 0.05]];
      addMolding(parts, basem, W - 0.02, 'front', 0, D / 2 - 0.035, C.trim);
    }
    buildSump(plinth + t, W - W * 0.22 - 2 * t, D - 2 * t, innerTop - plinth - t);
    // doors
    const openW = W - 2 * t, dh = innerTop - plinth - t - 0.006, dw = openW / 2 - 0.003;
    makeDoor(dw, dh, -W / 2 + t, plinth + t + dh / 2 + 0.003, D / 2 + t / 2, 1, style);
    makeDoor(dw, dh, W / 2 - t, plinth + t + dh / 2 + 0.003, D / 2 + t / 2, -1, style);
    underglowZ = D / 2 - 0.03; underglowY = 0.01;
  } else if (style === 'industrial') {
    // square-tube steel frame with plank shelves, open sides
    const tb = 0.035;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => metal.push({ g: box(tb, H, tb, sx * (W / 2 - tb / 2), H / 2, sz * (D / 2 - tb / 2)), c: C.metal, n: 'post' }));
    [tb / 2 + 0.03, H - tb / 2].forEach(y => {
      metal.push({ g: box(W, tb, tb, 0, y, D / 2 - tb / 2), c: C.metal, n: 'rail' });
      metal.push({ g: box(W, tb, tb, 0, y, -D / 2 + tb / 2), c: C.metal, n: 'rail' });
      metal.push({ g: box(tb, tb, D, -W / 2 + tb / 2, y, 0), c: C.metal, n: 'rail' });
      metal.push({ g: box(tb, tb, D, W / 2 - tb / 2, y, 0), c: C.metal, n: 'rail' });
    });
    // diagonal X-bracing on the sides
    [-1, 1].forEach(sx => {
      addWire(metal, [sx * (W / 2 - tb / 2), 0.06, -D / 2 + tb], [sx * (W / 2 - tb / 2), H - tb, D / 2 - tb], C.metal, 0.006, 4);
      addWire(metal, [sx * (W / 2 - tb / 2), 0.06, D / 2 - tb], [sx * (W / 2 - tb / 2), H - tb, -D / 2 + tb], C.metal, 0.006, 4);
    });
    const n = 4, pd = (D - 0.004 * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      add(box(W - 2 * tb, 0.03, pd, 0, tb + 0.045, -D / 2 + pd / 2 + i * (pd + 0.004)), i % 2 ? C.body : C.trim, 'shelfPlank');
      add(box(W + 0.02, 0.035, pd, 0, H + 0.0175, -D / 2 + pd / 2 + i * (pd + 0.004)), i % 2 ? C.trim : C.body, 'topPlank');
    }
    metal.push({ g: box(W - 2 * tb, 0.004, D - 2 * tb, 0, H - tb - 0.002, 0), c: C.interior, n: 'ceilingSheet' });
    // feet
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => addCylinder(metal, 0.02, 0.025, 0.012, 10, sx * (W / 2 - tb / 2), 0.006, sz * (D / 2 - tb / 2), 0, 0, 0, C.pump));
    buildSump(tb + 0.06, W - 2 * tb, D - 2 * tb, H - tb - 0.1);
    const dh = H - 2 * tb - 0.06, dw = (W - 2 * tb) / 2 - 0.004;
    makeDoor(dw, dh, -W / 2 + tb, 0.03 + tb + dh / 2 + 0.002, D / 2 + 0.012, 1, 'industrial');
    makeDoor(dw, dh, W / 2 - tb, 0.03 + tb + dh / 2 + 0.002, D / 2 + 0.012, -1, 'industrial');
    underglowY = 0.03 + tb + 0.02; underglowZ = D / 2 - tb;
  } else {
    // PEDESTAL: hollow drum with curved hinged door
    const R = Math.max(W, D) / 2 * 0.92, a = 0.62, inner = R - t;
    const bodyH = H - topT - plinth;
    addB(new THREE.CylinderGeometry(R, R, bodyH, 40, 1, true, a, Math.PI * 2 - 2 * a).translate(0, plinth + bodyH / 2, 0), C.body, 'drumShell');
    add(new THREE.CylinderGeometry(inner, inner, bodyH, 40, 1, true, a, Math.PI * 2 - 2 * a).translate(0, plinth + bodyH / 2, 0), C.interior, 'drumLining');
    [a, -a].forEach(th => add(box(t, bodyH, t * 1.2, 0, plinth + bodyH / 2, 0).translate(0, 0, 0).rotateY(th).translate((R - t / 2) * Math.sin(th), 0, (R - t / 2) * Math.cos(th)), C.body, 'jamb'));
    addB(new THREE.CylinderGeometry(R + 0.03, R + 0.03, topT, 40).translate(0, H - topT / 2, 0), C.trim, 'topDisc');
    addB(new THREE.CylinderGeometry(R - 0.03, R - 0.01, plinth, 40).translate(0, plinth / 2, 0), C.trim, 'plinthDisc');
    add(new THREE.CylinderGeometry(inner, inner, t, 40).translate(0, plinth + t / 2, 0), C.interior, 'drumFloor');
    metal.push({ g: new THREE.TorusGeometry(R + 0.004, 0.006, 6, 48).rotateX(Math.PI / 2).translate(0, H - topT - 0.01, 0), c: C.metal, n: 'chromeRing' });
    metal.push({ g: new THREE.TorusGeometry(R + 0.004, 0.006, 6, 48).rotateX(Math.PI / 2).translate(0, plinth + 0.01, 0), c: C.metal, n: 'chromeRing' });
    buildSump(plinth + t, inner * 1.3, inner * 1.3, bodyH - 0.02);
    // curved door, hinge at theta=a
    const hx = R * Math.sin(a), hz = R * Math.cos(a);
    const pivot = new THREE.Group(); pivot.name = 'cabinetDoors'; pivot.userData.dir = -1;
    pivot.position.set(hx, plinth + bodyH / 2, hz);
    const dg = new THREE.CylinderGeometry(R + 0.004, R + 0.004, bodyH - 0.01, 16, 1, false, -a, 2 * a);
    dg.translate(-hx, 0, -hz);
    const dl = [{ g: dg, c: C.door, n: 'curvedDoor' }];
    const hdl = [];
    addWire(hdl, [-2 * hx + 0.03, -0.08, 0.02], [-2 * hx + 0.03, 0.08, 0.02], C.metal, 0.005, 6);
    const d1 = finish(dl, isMetalFinish ? METAL_MAT : MAT, 'door', merge); if (d1) pivot.add(d1);
    const d2 = finish(hdl, METAL_MAT, 'doorHardware', merge); if (d2) pivot.add(d2);
    doorPivots.push(pivot); g.add(pivot);
    glowRadius = R - 0.02; underglowY = 0.01;
  }

  // ---------- assemble ----------
  const s1 = finish(parts, MAT, 'solid', merge); if (s1) g.add(s1);
  const s2 = finish(metal, METAL_MAT, 'metal', merge); if (s2) g.add(s2);
  const s3 = finish(glass, GLASS_MAT, 'glass', merge); if (s3) g.add(s3);
  const sumpGroup = new THREE.Group(); sumpGroup.name = 'sump';
  const s4 = finish(sump, METAL_MAT, 'sumpHardware', merge); if (s4) sumpGroup.add(s4);
  const s5 = finish(sumpGlass, GLASS_MAT, 'sumpAcrylic', merge); if (s5) { s5.renderOrder = 1; sumpGroup.add(s5); }
  g.add(sumpGroup);

  // ---------- underglow ----------
  const glowGroup = new THREE.Group(); glowGroup.name = 'ambientUnderglow';
  const glowCol = new THREE.Color(C.glow);
  const ledMat = new THREE.MeshBasicMaterial({ color: glowCol, toneMapped: false });
  const halo = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: glowCol }, uIntensity: { value: 0.9 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uIntensity; varying vec2 vUv; void main(){ vec2 d = (vUv - 0.5) * 2.0; float f = pow(max(0.0, 1.0 - length(d)), 2.2); gl_FragColor = vec4(uColor * f * uIntensity, f); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  if (glowRadius > 0) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(glowRadius, 0.005, 6, 48).rotateX(Math.PI / 2).translate(0, underglowY, 0), ledMat);
    ring.name = 'ledRing'; glowGroup.add(ring);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(glowRadius * 3.4, glowRadius * 3.4).rotateX(-Math.PI / 2).translate(0, 0.002, 0), halo);
    pl.name = 'floorHalo'; pl.renderOrder = 5; glowGroup.add(pl);
  } else {
    const strip = new THREE.Mesh(box(underglowW, 0.006, 0.006, 0, underglowY, underglowZ), ledMat);
    strip.name = 'ledStrip'; glowGroup.add(strip);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.5, D * 2.4).rotateX(-Math.PI / 2).translate(0, 0.002, D * 0.45), halo);
    pl.name = 'floorHalo'; pl.renderOrder = 5; glowGroup.add(pl);
  }
  glowGroup.visible = !!p.underglow;
  g.add(glowGroup);

  const setDoors = (v) => doorPivots.forEach(pv => { pv.rotation.y = -pv.userData.dir * v * THREE.MathUtils.degToRad(95); });
  setDoors(p.doorsOpen);

  g.userData = {
    topY: H + (style === 'industrial' ? 0.035 : 0),
    footprint: { width: W, depth: D },
    setRig(name, v) {
      if (name === 'cabinetDoors') setDoors(v);
      if (name === 'ambientUnderglow') glowGroup.visible = !!v;
    },
    update() {}
  };
  return g;
}

export default createAsset;
