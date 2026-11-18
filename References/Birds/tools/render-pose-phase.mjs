import * as THREE from 'three';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createAsset } from '../src/assets/bird-rig.mjs';

const [, , out, list, view, pose, phase = '0.5', detail] = process.argv;
const names = list.split(',');
const CELL = 560, cols = Math.min(names.length, 3), rows = Math.ceil(names.length / cols);
const W = CELL * cols, H = CELL * rows;
const img = new Uint8Array(W * H * 3).fill(0), zb = new Float32Array(W * H).fill(-Infinity);
for (let i = 0; i < W * H; i++) { img[i * 3] = 222; img[i * 3 + 1] = 232; img[i * 3 + 2] = 228; }
const views = { side: new THREE.Euler(0, -Math.PI / 2, 0, 'YXZ'), three: new THREE.Euler(-0.32, -Math.PI / 2 + 0.75, 0, 'YXZ'), front: new THREE.Euler(0, 0, 0, 'YXZ') };
const R = new THREE.Matrix4().makeRotationFromEuler(views[view] || views.side).invert();
const light = new THREE.Vector3(-0.4, 0.8, 0.6).normalize();

names.forEach((name, idx) => {
  const asset = createAsset({ species: name, rigMode: 'static', pose, detail, mergeForProduction: false, posePhase: parseFloat(phase) });
  asset.updateMatrixWorld(true);
  const tris = [];
  asset.traverse((m) => {
    if (!m.isMesh) return;
    const p = m.geometry.attributes.position, c = m.geometry.attributes.color;
    const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    for (let i = 0; i < p.count; i += 3) {
      for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(p, i + k).applyMatrix4(m.matrixWorld);
      tris.push({ a: v[0].clone(), b: v[1].clone(), c: v[2].clone(), col: [c.getX(i), c.getY(i), c.getZ(i)], part: m.userData.part });
    }
  });
  const box = new THREE.Box3();
  for (const t of tris) { box.expandByPoint(t.a); box.expandByPoint(t.b); box.expandByPoint(t.c); }
  const corners = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z).applyMatrix4(R));
  const sb = new THREE.Box3().setFromPoints(corners), size = sb.getSize(new THREE.Vector3()), ctr = sb.getCenter(new THREE.Vector3());
  const scale = (CELL * 0.82) / Math.max(size.x, size.y);
  const ox = (idx % cols) * CELL, oy = Math.floor(idx / cols) * CELL;
  const proj = (v) => { const q = v.clone().applyMatrix4(R); return [ox + CELL / 2 + (q.x - ctr.x) * scale, oy + CELL / 2 - (q.y - ctr.y) * scale, q.z]; };
  for (const t of tris) {
    const n = new THREE.Vector3().subVectors(t.b, t.a).cross(new THREE.Vector3().subVectors(t.c, t.a));
    if (n.lengthSq() === 0) continue;
    n.normalize();
    const nv = n.clone().transformDirection(R);
    if (nv.z < 0) n.negate();
    const lam = 0.38 + 0.62 * Math.max(0, n.dot(light));
    const toS = (c) => Math.round(255 * Math.pow(Math.min(1, c * lam), 1 / 2.2));
    const col = [toS(t.col[0]), toS(t.col[1]), toS(t.col[2])];
    const A = proj(t.a), B = proj(t.b), C = proj(t.c);
    const minX = Math.max(ox, Math.floor(Math.min(A[0], B[0], C[0]))), maxX = Math.min(ox + CELL - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
    const minY = Math.max(oy, Math.floor(Math.min(A[1], B[1], C[1]))), maxY = Math.min(oy + CELL - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
    const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    if (Math.abs(area) < 1e-9) continue;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((B[0] - px) * (C[1] - py) - (B[1] - py) * (C[0] - px)) / area;
      const w1 = ((C[0] - px) * (A[1] - py) - (C[1] - py) * (A[0] - px)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * A[2] + w1 * B[2] + w2 * C[2], o = y * W + x;
      if (z <= zb[o]) continue;
      zb[o] = z; img[o * 3] = col[0]; img[o * 3 + 1] = col[1]; img[o * 3 + 2] = col[2];
    }
  }
});

function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
writeFileSync(out, png(W, H, img));
console.log('wrote', out);
