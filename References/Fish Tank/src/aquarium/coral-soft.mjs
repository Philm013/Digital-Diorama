/*
 * CORAL SOFT (High Detail)
 * Parametric soft corals for three.js: Bubble Tip Anemone, pulsing Xenia, Toadstool Leather and
 * Zoanthid colonies. Smooth lathe bodies; tentacles/polyps carry aRoot + aSway attributes so a
 * vertex shader can contract, pulse and wave them (one draw call), plus fluorescent emissive glow.
 *
 * QUICK START
 *   import { createAsset } from './coral-soft.mjs';
 *   const reef = createAsset({ coralType: 'anemone', colorway: 'hot-pink', anchors: [[0,0,0]] });
 *   scene.add(reef); // loop: reef.userData.update(t)
 *
 * PARAMS  coralType: anemone | xenia | toadstool | zoanthid ; colorway (colorHue): neon-green | hot-pink | deep-purple | cyber-cyan | orange
 *         size 0.5-2, count 1-8, pulseSpeed, glow, seed ; options: anchors [[x,y,z]], heightAt(x,z)
 * SPECS  ~2,000-10,000 triangles, 2 materials, ~0.06-0.2 m per colony.
 * PARTS  animate: tentacles, polyps (vertex pulse/wave)
 *        detach: tentacles
 * LICENSE MIT - procedural geometry, free for commercial use.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = { body: '#7a3a5a', stem: '#c8a090', tentacle: '#ff5aa8', tip: '#ffd0f0', disc: '#ff8ac8', base: '#5a3a3a' };

export const COLORWAYS = {
  'default':     { ...BASE },
  'hot-pink':    { ...BASE },
  'neon-green':  { body: '#2a6a3a', stem: '#a8c890', tentacle: '#5aff7a', tip: '#e0ffa0', disc: '#9aff5a', base: '#3a4a2a' },
  'deep-purple': { body: '#3a1a5a', stem: '#8a70a8', tentacle: '#a04aff', tip: '#f0c0ff', disc: '#c070ff', base: '#2a1a3a' },
  'cyber-cyan':  { body: '#1a3a5a', stem: '#80b0c8', tentacle: '#30f0ff', tip: '#f0ffff', disc: '#40c8ff', base: '#1a2a3a' },
  'orange':      { body: '#8a3a1a', stem: '#e0b890', tentacle: '#ff8a2a', tip: '#ffe0a0', disc: '#ffb040', base: '#4a2a1a' },
  'cream':       { body: '#c8b8a0', stem: '#e8dcc8', tentacle: '#f0e0c0', tip: '#ffffff', disc: '#d8c8a8', base: '#8a7a6a' }
};

export const presets = COLORWAYS;

export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'One mesh per material or selectable parts.' },
  colorway:   { type: 'choice', default: 'hot-pink', options: Object.keys(COLORWAYS), label: 'Color Hue', affects: 'colors', describe: 'Fluorescent hue family.' },
  coralType:  { type: 'choice', default: 'anemone', options: ['anemone', 'xenia', 'toadstool', 'zoanthid'], label: 'Coral Type', affects: 'geometry', describe: 'Soft coral species.' },
  size:       { type: 'range', default: 1, min: 0.5, max: 2, step: 0.05, label: 'Size', affects: 'geometry', describe: 'Small frag to massive colony.' },
  count:      { type: 'range', default: 3, min: 1, max: 8, step: 1, label: 'Colonies', affects: 'geometry', describe: 'Colonies when no anchors given.' },
  pulseSpeed: { type: 'range', default: 1.6, min: 0, max: 5, step: 0.1, label: 'Pulse Speed', affects: 'geometry', describe: 'Tentacle/polyp pulse rate.' },
  glow:       { type: 'range', default: 0.35, min: 0, max: 1.5, step: 0.05, label: 'Fluorescence', affects: 'colors', describe: 'Emissive glow under actinic light.' },
  seed:       { type: 'range', default: 21, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Placement/shape seed.' }
};

export const rig = {
  tentacles: { axis: 'scale', range: [0.55, 1.0], describe: 'Expand / contract pulse.' },
  polyps:    { axis: 'x', range: [-0.01, 0.01], describe: 'Waving in the current.' }
};
export const detach = ['tentacles'];
export const night = { tentacles: { color: '#ff5aa8', intensity: 0.6, distance: 0.3, describe: 'Fluorescent glow.' } };

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

function glowMat(glow, animated) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0.0, side: THREE.DoubleSide });
  const u = { uTime: { value: 0 }, uGlow: { value: glow }, uPulse: { value: 1.6 }, uPulseAmt: { value: 0.4 }, uSway: { value: 0.006 } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    let vs = 'uniform float uTime; uniform float uPulse; uniform float uPulseAmt; uniform float uSway;\n';
    if (animated) vs += 'attribute vec3 aRoot; attribute float aSway;\n';
    sh.vertexShader = vs + sh.vertexShader;
    if (animated) sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 rel = transformed - aRoot;
      float pulse = 0.5 + 0.5 * sin(uTime * uPulse + aRoot.x * 53.0 + aRoot.z * 41.0);
      rel *= mix(1.0, 0.55 + 0.45 * (1.0 - pulse), uPulseAmt * clamp(aSway, 0.0, 1.0));
      transformed = aRoot + rel;
      float s2 = aSway * aSway;
      transformed.x += sin(uTime * 1.3 + aRoot.x * 30.0 + aRoot.y * 20.0) * uSway * s2;
      transformed.z += cos(uTime * 1.1 + aRoot.z * 30.0) * uSway * 0.7 * s2;`);
    sh.fragmentShader = 'uniform float uGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * uGlow;');
  };
  mat.customProgramCacheKey = () => 'coral-soft-' + (animated ? 'a' : 's');
  mat.userData.uniforms = u;
  return mat;
}
const MAT = glowMat(0.2, false);

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

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Animated appendage: lathe profile (y = 0..len) oriented along dir from root, with aRoot/aSway attributes
function addAppendage(list, root, dir, profile, hex, segs = 6, swayBias = 0, n = 'tentacle') {
  let geo = new THREE.LatheGeometry(profile, segs).toNonIndexed();
  const len = profile[profile.length - 1].y || 1;
  const pos = geo.attributes.position, cnt = pos.count;
  const sw = new Float32Array(cnt);
  for (let i = 0; i < cnt; i++) sw[i] = swayBias + pos.getY(i) / len;
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
  geo.translate(root.x, root.y, root.z);
  const rt = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) { rt[i * 3] = root.x; rt[i * 3 + 1] = root.y; rt[i * 3 + 2] = root.z; }
  geo.setAttribute('aSway', new THREE.BufferAttribute(sw, 1));
  geo.setAttribute('aRoot', new THREE.BufferAttribute(rt, 3));
  list.push({ g: geo, c: hex, n });
}

const V2 = (x, y) => new THREE.Vector2(x, y);

export function createAsset(userParams = {}) {
  const p = {};
  for (const k of Object.keys(params)) p[k] = params[k].default;
  Object.assign(p, userParams);
  const C = zonesFor(p.colorway, userParams);
  const merge = !!p.mergeForProduction;
  const rnd = rng(p.seed);
  const heightAt = typeof userParams.heightAt === 'function' ? userParams.heightAt : () => 0;
  const S = p.size;
  const bodyMat = glowMat(p.glow * 0.4, false), tentMat = glowMat(p.glow, true);
  tentMat.userData.uniforms.uPulse.value = p.pulseSpeed;

  let anchors = Array.isArray(userParams.anchors) && userParams.anchors.length ? userParams.anchors : null;
  if (!anchors) { anchors = []; for (let i = 0; i < p.count; i++) { const x = (rnd() - 0.5) * 0.3, z = (rnd() - 0.5) * 0.2; anchors.push([x, heightAt(x, z), z]); } }

  const body = [], tent = [];
  anchors.forEach(([ax, ay, az], ci) => {
    const s = S * (0.75 + rnd() * 0.5);
    if (p.coralType === 'anemone') {
      const R = 0.028 * s, Hc = 0.03 * s;
      body.push({ g: new THREE.LatheGeometry([V2(R * 0.8, -0.004), V2(R * 0.9, 0), V2(R * 0.75, Hc * 0.4), V2(R * 0.7, Hc * 0.8), V2(R * 1.05, Hc), V2(0, Hc + 0.002)], 18).translate(ax, ay, az), c: C.stem, n: 'column' });
      body.push({ g: new THREE.CircleGeometry(R * 0.35, 12).rotateX(-Math.PI / 2).translate(ax, ay + Hc + 0.0035, az), c: C.tip, n: 'mouth' });
      const rings = 4;
      for (let r = 0; r < rings; r++) {
        const n = 10 + r * 7, rr = R * (0.3 + 0.2 * r);
        for (let k = 0; k < n; k++) {
          const a = k / n * Math.PI * 2 + r * 0.3;
          const root = new THREE.Vector3(ax + Math.cos(a) * rr, ay + Hc + 0.001, az + Math.sin(a) * rr);
          const dir = new THREE.Vector3(Math.cos(a) * (0.3 + r * 0.25), 1, Math.sin(a) * (0.3 + r * 0.25));
          const L = 0.022 * s * (0.8 + rnd() * 0.4);
          const prof = [V2(0.0022 * s, 0), V2(0.0026 * s, L * 0.35), V2(0.0042 * s, L * 0.68), V2(0.003 * s, L * 0.9), V2(0.0001, L)];
          addAppendage(tent, root, dir, prof, C.tentacle, 6, 0.1, 'bubbleTentacle');
          const tipPos = root.clone().addScaledVector(dir.clone().normalize(), L * 0.96);
          addAppendage(tent, root, dir, [V2(0.0001, L * 0.86), V2(0.0018 * s, L * 0.92), V2(0.0001, L * 1.01)], C.tip, 5, 0.1, 'tentacleTip');
          void tipPos;
        }
      }
    } else if (p.coralType === 'xenia') {
      const stalks = 3 + Math.floor(rnd() * 4);
      body.push({ g: new THREE.LatheGeometry([V2(0.018 * s, -0.003), V2(0.02 * s, 0.004), V2(0.008 * s, 0.01 * s), V2(0, 0.012 * s)], 12).translate(ax, ay, az), c: C.base, n: 'holdfast' });
      for (let k = 0; k < stalks; k++) {
        const a = rnd() * Math.PI * 2, lean = 0.1 + rnd() * 0.35, h = (0.03 + rnd() * 0.035) * s;
        const top = new THREE.Vector3(ax + Math.cos(a) * lean * h, ay + h, az + Math.sin(a) * lean * h);
        const dir = top.clone().sub(new THREE.Vector3(ax, ay, az));
        addAppendage(body.length ? tent : tent, new THREE.Vector3(ax, ay, az), dir, [V2(0.005 * s, 0), V2(0.004 * s, h * 0.6), V2(0.005 * s, h * 0.95), V2(0, dir.length())], C.stem, 8, -0.2, 'stalk');
        // polyp: 8 arms radiating from the stalk top (pulse open/close)
        for (let arm = 0; arm < 8; arm++) {
          const aa = arm / 8 * Math.PI * 2;
          const adir = new THREE.Vector3(Math.cos(aa), 0.9, Math.sin(aa));
          const L = 0.011 * s;
          addAppendage(tent, top, adir, [V2(0.0012 * s, 0), V2(0.0018 * s, L * 0.5), V2(0.0008 * s, L * 0.9), V2(0, L)], arm % 2 ? C.tentacle : C.disc, 4, 0.3, 'polypArm');
        }
        body.push({ g: new THREE.SphereGeometry(0.003 * s, 8, 6).translate(top.x, top.y, top.z), c: C.tip, n: 'polypMouth' });
      }
    } else if (p.coralType === 'toadstool') {
      const h = 0.045 * s, R = 0.045 * s;
      body.push({ g: new THREE.LatheGeometry([V2(0.02 * s, -0.004), V2(0.022 * s, 0), V2(0.014 * s, h * 0.4), V2(0.013 * s, h * 0.85), V2(0, h)], 14).translate(ax, ay, az), c: C.stem, n: 'stalk' });
      const cap = new THREE.LatheGeometry([V2(0, h + 0.006 * s), V2(R * 0.6, h + 0.007 * s), V2(R, h + 0.001), V2(R * 0.95, h - 0.004 * s), V2(R * 0.4, h - 0.003 * s), V2(0, h - 0.003 * s)], 28);
      const cp = cap.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < cp.count; i++) { v.fromBufferAttribute(cp, i); const r = Math.hypot(v.x, v.z), th = Math.atan2(v.z, v.x); cp.setY(i, v.y + Math.sin(th * 6 + ci) * 0.006 * s * (r / R) ** 2); }
      cap.translate(ax, ay, az);
      body.push({ g: cap, c: C.body, n: 'cap' });
      const np = Math.round(110 * s);
      for (let k = 0; k < np; k++) {
        const r = Math.sqrt(rnd()) * R * 0.92, th = rnd() * Math.PI * 2;
        const y = h + 0.006 * s - (r / R) * 0.004 * s + Math.sin(th * 6 + ci) * 0.006 * s * (r / R) ** 2;
        const root = new THREE.Vector3(ax + Math.cos(th) * r, ay + y, az + Math.sin(th) * r);
        const L = 0.007 * s;
        addAppendage(tent, root, new THREE.Vector3(Math.cos(th) * r / R * 0.5, 1, Math.sin(th) * r / R * 0.5), [V2(0.0007, 0), V2(0.0009, L * 0.7), V2(0.0016, L * 0.85), V2(0, L)], k % 4 ? C.tentacle : C.tip, 4, 0, 'polyp');
      }
    } else {
      // ZOANTHIDS: mat of columns with glowing oral discs
      const np = Math.round(18 * s + rnd() * 10);
      body.push({ g: new THREE.CylinderGeometry(0.035 * s, 0.04 * s, 0.004, 14).translate(ax, ay + 0.001, az), c: C.base, n: 'mat' });
      for (let k = 0; k < np; k++) {
        const r = Math.sqrt(rnd()) * 0.034 * s, th = rnd() * Math.PI * 2;
        const x = ax + Math.cos(th) * r, z = az + Math.sin(th) * r, h = (0.008 + rnd() * 0.01) * s;
        const dir = new THREE.Vector3(Math.cos(th) * 0.3, 1, Math.sin(th) * 0.3);
        const root = new THREE.Vector3(x, ay + 0.002, z);
        addAppendage(tent, root, dir, [V2(0.0032 * s, 0), V2(0.003 * s, h * 0.8), V2(0.0052 * s, h * 0.95), V2(0.006 * s, h), V2(0.0045 * s, h * 1.02), V2(0, h * 1.01)], C.body, 8, -0.3, 'column');
        const top = root.clone().addScaledVector(dir.clone().normalize(), h * 1.01);
        addAppendage(tent, top, dir, [V2(0.0056 * s, 0), V2(0.0042 * s, 0.0009), V2(0.0015 * s, 0.0012), V2(0, 0.0012)], C.disc, 10, 0.6, 'oralDisc');
        addAppendage(tent, top, dir, [V2(0.0016 * s, 0.0011), V2(0.0008 * s, 0.0016), V2(0, 0.0017)], C.tip, 6, 0.6, 'mouth');
      }
    }
  });

  const g = new THREE.Group(); g.name = 'coral-soft';
  const m1 = finish(body, bodyMat, 'body', merge); if (m1) g.add(m1);
  const tg = new THREE.Group(); tg.name = 'tentacles';
  const m2 = finish(tent, tentMat, 'tentacles', merge); if (m2) tg.add(m2);
  g.add(tg);
  g.userData = {
    anchors,
    setRig(name, v) { if (name === 'tentacles') tentMat.userData.uniforms.uPulseAmt.value = v; if (name === 'polyps') tentMat.userData.uniforms.uSway.value = v; },
    setGlow(v) { tentMat.userData.uniforms.uGlow.value = v; bodyMat.userData.uniforms.uGlow.value = v * 0.4; },
    update(t) { tentMat.userData.uniforms.uTime.value = t; }
  };
  return g;
}

export default createAsset;
