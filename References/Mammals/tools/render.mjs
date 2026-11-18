// Headless review renderer: software z-buffer rasterizer -> PNG contact sheets (no browser / WebGL needed).
// usage: node tools/render.mjs out.png species1,species2,... [views]   views: side,rear,front,top,q34,head,hind
import * as THREE from 'three';
import zlib from 'node:zlib';
import fs from 'node:fs';
import { createAsset, species as SPECIES } from '../src/assets/animals/mammal-rig.mjs';

const [, , out = 'review.png', list = 'horse', viewArg = 'side,rear,q34,head,hind', cellArg = '300'] = process.argv;
const names = list === 'all' ? Object.keys(SPECIES) : list.split(',');
const views = viewArg.split(',');
const CW = +cellArg, CH = Math.round(CW * 0.78), SS = 2, LABEL = 18;

const GLYPHS = { A: '003a60|1454', B: '000a4a59574606|4655514000', C: '684a2a0802204062', D: '000a3a67633000', E: '6a0a0060|0545', F: '6a0a00|0545', G: '684a2a08022040626434', H: '000a|606a|0565', I: '1a5a|3a30|1050', J: '5a52301002', K: '000a|6a04|2660', L: '0a0060', M: '000a356a60', N: '000a606a', O: '204062684a2a080220', P: '000a4a68674505', Q: '204062684a2a080220|4360', R: '000a4a68674505|3560', S: '694a2a080725456362402001', T: '0a6a|3a30', U: '0a022040626a', V: '0a306a', W: '0a1036506a', X: '006a|0a60', Y: '0a356a|3530', Z: '0a6a0060', '0': '204062684a2a080220', '1': '183a30|1050', '2': '082a4a68670060', '3': '0a6a36566562402002', '4': '404a0464', '5': '6a0a06466462402001', '6': '694a2a070220406264462604', '7': '0a6a20', '8': '2507082a4a6867452503022040626345', '9': '01204063684a2a0806244466', '-': '1555', '.': '2030312120', '/': '105a', ':': '2333342423|2636372726' };

function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function writePNG(file, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

function collect(root, filter) {
  const tris = [];
  root.updateMatrixWorld(true);
  root.traverse((m) => {
    if (!m.isMesh || (filter && !filter(m))) return;
    const pa = m.geometry.attributes.position, ca = m.geometry.attributes.color, v = new THREE.Vector3();
    for (let i = 0; i < pa.count; i += 3) {
      const t = [];
      for (let k = 0; k < 3; k++) { v.fromBufferAttribute(pa, i + k).applyMatrix4(m.matrixWorld); t.push(v.x, v.y, v.z); }
      tris.push({ p: t, c: [ca.getX(i), ca.getY(i), ca.getZ(i)], name: m.name });
    }
  });
  return tris;
}
function boxOf(tris) { const b = new THREE.Box3(); const v = new THREE.Vector3(); for (const t of tris) for (let k = 0; k < 9; k += 3) b.expandByPoint(v.set(t.p[k], t.p[k + 1], t.p[k + 2])); return b; }

const VIEWS = {
  side: { f: [1, 0, 0] }, left: { f: [-1, 0, 0] }, rear: { f: [0, 0, 1] }, front: { f: [0, 0, -1] }, top: { f: [0, -1, 0.0001], up: [0, 0, 1] },
  q34: { f: [0.75, -0.32, -0.58] }, head: { f: [0.8, -0.2, -0.56], focus: ['head', 'jaw', 'ears', 'eyes', 'eyelids', 'nose', 'horns', 'teeth', 'mane'], pad: 0.12 },
  headside: { f: [1, 0, 0], focus: ['head', 'jaw', 'ears', 'eyes', 'eyelids', 'nose', 'teeth'], pad: 0.1 },
  hind: { f: [0.62, -0.12, 0.78], focus: ['leg-hind-left', 'foot-hind-left', 'leg-hind-right', 'foot-hind-right'], pad: 0.12, grow: true },
  hindside: { f: [1, 0, 0], focus: ['leg-hind-right', 'foot-hind-right'], pad: 0.15, grow: true },
};

function renderCell(tris, view, img, ox, oy, W, H) {
  const V = VIEWS[view];
  const f = new THREE.Vector3(...V.f).normalize(), up0 = new THREE.Vector3(...(V.up || [0, 1, 0]));
  const r = new THREE.Vector3().crossVectors(f, up0).normalize(), u = new THREE.Vector3().crossVectors(r, f).normalize();
  let fb = boxOf(tris);
  if (V.focus) {
    const ft = tris.filter(t => V.focus.some(n => t.name === n || t.name.startsWith(n + '-')));
    if (ft.length) { fb = boxOf(ft); const s = fb.getSize(new THREE.Vector3()), m = Math.max(s.x, s.y, s.z) * V.pad; fb.expandByScalar(m); if (V.grow) { fb.max.y += s.y * 0.15; fb.min.z -= s.y * 0.1; } }
  }
  // project the focus box corners to fit
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; const cv = new THREE.Vector3();
  for (let i = 0; i < 8; i++) { cv.set(i & 1 ? fb.max.x : fb.min.x, i & 2 ? fb.max.y : fb.min.y, i & 4 ? fb.max.z : fb.min.z); const sx = cv.dot(r), sy = cv.dot(u); x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
  const w = W * SS, h = H * SS, sc = Math.min(w / (x1 - x0), h / (y1 - y0)) * 0.92, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const zb = new Float32Array(w * h).fill(Infinity), cb = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { const g = 0.93 - 0.12 * (Math.floor(i / w) / h); cb[i * 3] = g; cb[i * 3 + 1] = g; cb[i * 3 + 2] = g * 1.02; }
  const Ld = new THREE.Vector3(0.45, 0.8, 0.35).normalize(), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (const t of tris) {
    A.set(t.p[0], t.p[1], t.p[2]); B.set(t.p[3], t.p[4], t.p[5]); C.set(t.p[6], t.p[7], t.p[8]);
    n.crossVectors(e1.subVectors(B, A), e2.subVectors(C, A)); if (n.lengthSq() < 1e-30) continue; n.normalize();
    if (n.dot(f) > 0) n.negate();
    const lam = 0.38 + 0.52 * Math.max(0, n.dot(Ld)) + 0.18 * Math.max(0, -n.dot(f));
    const col = t.c.map(c => Math.pow(Math.min(1, c * lam), 1 / 2.2));
    const P = [A, B, C].map(p => [(p.dot(r) - cx) * sc + w / 2, h / 2 - (p.dot(u) - cy) * sc, p.dot(f)]);
    const minX = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0]))), maxX = Math.min(w - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])));
    const minY = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1]))), maxY = Math.min(h - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])));
    const den = (P[1][1] - P[2][1]) * (P[0][0] - P[2][0]) + (P[2][0] - P[1][0]) * (P[0][1] - P[2][1]); if (Math.abs(den) < 1e-12) continue;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const a = ((P[1][1] - P[2][1]) * (px - P[2][0]) + (P[2][0] - P[1][0]) * (py - P[2][1])) / den;
      const b = ((P[2][1] - P[0][1]) * (px - P[2][0]) + (P[0][0] - P[2][0]) * (py - P[2][1])) / den, c = 1 - a - b;
      if (a < -1e-6 || b < -1e-6 || c < -1e-6) continue;
      const z = a * P[0][2] + b * P[1][2] + c * P[2][2], i = y * w + x;
      if (z < zb[i]) { zb[i] = z; cb[i * 3] = col[0]; cb[i * 3 + 1] = col[1]; cb[i * 3 + 2] = col[2]; }
    }
  }
  // silhouette edges from depth discontinuities
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, z = zb[i]; let edge = false;
    for (const j of [i - 1, i + 1, i - w, i + w]) { const zj = zb[j]; if ((z === Infinity) !== (zj === Infinity) || (z !== Infinity && Math.abs(z - zj) > 0.06 / sc * 40)) { edge = true; break; } }
    if (edge && z !== Infinity) { cb[i * 3] *= 0.45; cb[i * 3 + 1] *= 0.45; cb[i * 3 + 2] *= 0.45; }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let rr = 0, gg = 0, bb = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) { const i = (y * SS + sy) * w + x * SS + sx; rr += cb[i * 3]; gg += cb[i * 3 + 1]; bb += cb[i * 3 + 2]; }
    const o = ((oy + y) * img.w + ox + x) * 3, k = 255 / (SS * SS);
    img.d[o] = Math.min(255, rr * k); img.d[o + 1] = Math.min(255, gg * k); img.d[o + 2] = Math.min(255, bb * k);
  }
}
function text(img, str, x, y, size, col = [30, 30, 30]) {
  const u = size / 10; let cx = x;
  for (const ch of String(str).toUpperCase()) {
    const gl = GLYPHS[ch];
    if (gl) for (const sub of gl.split('|')) {
      const pts = []; for (let i = 0; i < sub.length; i += 2) pts.push([cx + parseInt(sub[i], 16) * u, y + size - parseInt(sub[i + 1], 16) * u]);
      for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2) + 1; for (let k = 0; k <= n; k++) { const px = Math.round(ax + (bx - ax) * k / n), py = Math.round(ay + (by - ay) * k / n); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) { const qx = px + dx, qy = py + dy; if (qx >= 0 && qy >= 0 && qx < img.w && qy < img.h) { const o = (qy * img.w + qx) * 3; img.d[o] = col[0]; img.d[o + 1] = col[1]; img.d[o + 2] = col[2]; } } } }
    }
    cx += 8 * u;
  }
}

const img = { w: CW * views.length, h: (CH + LABEL) * names.length };
img.d = Buffer.alloc(img.w * img.h * 3, 255);
names.forEach((sp, row) => {
  const a = createAsset({ species: sp, rigMode: 'static', mergeForProduction: false });
  const tris = collect(a);
  text(img, `${sp}  ${a.userData.triangles} TRIS  L${a.userData.dimensions.length} H${a.userData.dimensions.height}`, 6, row * (CH + LABEL) + 3, 11);
  views.forEach((v, col) => renderCell(tris, v, img, col * CW, row * (CH + LABEL) + LABEL, CW, CH));
});
writePNG(out, img.w, img.h, img.d);
console.log('wrote', out, img.w, 'x', img.h);
