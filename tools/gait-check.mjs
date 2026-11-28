// Ground contact through every mammal clip (dev tool): how far feet sink into the ground and how far planted feet slip.
//
//   node tools/gait-check.mjs                         every species, every clip; prints a table
//   node tools/gait-check.mjs --only horse,lion        some species
//   node tools/gait-check.mjs --save base.json         keep the numbers…
//   node tools/gait-check.mjs --compare base.json      …and list what got worse since (exits non-zero if anything did)
//
// For each clip the asset is posed at 160 phases (between the keys too, where interpolation can dip a fast foot) and each
// leg's lowest skinned point is followed: `depth` is the deepest any foot goes below y = 0 (cm), `lift` the highest a
// planted foot floats above it at mid-stance; `slip` follows the point that touched down first through the stance and
// measures how far it strays from where the ground carries it (back at the clip's speed): along the walk (`slipZ`) and
// sideways (`slipX`), the worst stance of the cycle, in cm; `tail` is how far the tail goes below the ground.
import * as THREE from 'three';
import { createAsset, createClips, species as SPECIES } from '../src/assets/models/rigs/mammal-rig.mjs';
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => { if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true]); return acc; }, []));
const ids = args.only ? String(args.only).split(',') : Object.keys(SPECIES);
const N = Number(args.n ?? 160);
const CLIPS = String(args.clips ?? 'walk,trot,gallop,idle,graze,alert,roar,sit').split(',');

const v = new THREE.Vector3();
function limbsOf(root, H) {
  // the lower part of each leg (and its foot): the only vertices that can meet the ground
  const out = [];
  for (const side of ['left', 'right']) for (const end of ['front', 'hind']) {
    const meshes = [`leg-${end}-${side}`, `foot-${end}-${side}`].map(n => root.getObjectByName(n)).filter(Boolean);
    const verts = [];
    for (const m of meshes) {
      const pa = m.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) if (pa.getY(i) < 0.3 * H) verts.push([m, i]);
    }
    if (verts.length) out.push({ name: `${end[0].toUpperCase()}${side[0].toUpperCase()}`, verts });
  }
  return out;
}

function measure(sp) {
  const root = createAsset({ species: sp, rigMode: 'skinned', mergeForProduction: false, detail: 'standard' });
  const H = root.userData.dimensions.height;
  const clips = createClips(root), mixer = new THREE.AnimationMixer(root), limbs = limbsOf(root, H), res = {};
  // the tail too (every 7th vertex): a pose that lowers the body must not push it into the ground
  const tm = root.getObjectByName('tail'), tail = tm ? { m: tm, idx: Array.from({ length: Math.ceil(tm.geometry.attributes.position.count / 7) }, (_, k) => k * 7) } : null;
  for (const clip of clips) {
    if (!CLIPS.includes(clip.name)) continue;
    mixer.stopAllAction();
    const act = mixer.clipAction(clip); act.reset().play();
    const speed = clip.userData.speed ?? 0, loop = clip.userData.loop !== false, dur = clip.duration;
    const track = limbs.map(() => []);
    let tailLow = Infinity;
    for (let s = 0; s < N; s++) {
      const t = (s / N) * dur;
      mixer.setTime(t); root.updateMatrixWorld(true);
      if (tail && s % 4 === 0) for (const i of tail.idx) { tail.m.getVertexPosition(i, v); tailLow = Math.min(tailLow, v.y); }
      limbs.forEach((lm, k) => {
        let best = null;
        for (const [m, i] of lm.verts) { m.getVertexPosition(i, v); if (!best || v.y < best.y) best = { y: v.y, x: v.x, z: v.z, m, i }; }
        track[k].push({ t, ...best });
      });
    }
    let depth = Infinity, lift = 0, slipZ = 0, slipX = 0;
    const ground = 0.006 * H;
    track.forEach((tr) => {
      for (const p of tr) depth = Math.min(depth, p.y);
      // stance runs (cyclic for looping clips): the lowest point within `ground` of the ground
      const on = tr.map(p => p.y < ground);
      const n = tr.length;
      if (on.every(Boolean) && speed === 0) {
        // never lifts: a standing clip; the planted point must stay put
        const p0 = tr[0], q = new THREE.Vector3();
        for (const p of tr) { mixer.setTime(p.t); root.updateMatrixWorld(true); p0.m.getVertexPosition(p0.i, q); slipZ = Math.max(slipZ, Math.abs(q.z - p0.z)); slipX = Math.max(slipX, Math.abs(q.x - p0.x)); }
        return;
      }
      for (let s = 0; s < n; s++) {
        const prev = on[(s - 1 + n) % n];
        if (!on[s] || (prev && (loop || s > 0))) continue;
        // touchdown at s: follow that point while it stays near the ground
        const p0 = tr[s], q = new THREE.Vector3();
        let len = 0;
        while (len < n && on[(s + len) % n]) len++;
        const mid = tr[(s + Math.floor(len / 2)) % n];
        lift = Math.max(lift, mid.y);
        for (let k = 0; k < len; k++) {
          const idx = (s + k) % n, p = tr[idx];
          let dt = p.t - p0.t; if (dt < 0) dt += dur;
          mixer.setTime(p.t); root.updateMatrixWorld(true); p0.m.getVertexPosition(p0.i, q);
          if (q.y > 0.012 * H) break;
          slipZ = Math.max(slipZ, Math.abs(q.z - (p0.z - speed * dt)));
          slipX = Math.max(slipX, Math.abs(q.x - p0.x));
        }
      }
    });
    res[clip.name] = { depth: +(Math.min(0, depth) * 100).toFixed(2), lift: +(lift * 100).toFixed(2), slipZ: +(slipZ * 100).toFixed(2), slipX: +(slipX * 100).toFixed(2), tail: tail ? +(Math.min(0, tailLow) * 100).toFixed(2) : 0 };
  }
  return { H: +H.toFixed(3), clips: res };
}

const all = {};
const t0 = Date.now();
for (const sp of ids) {
  try { all[sp] = measure(sp); } catch (e) { all[sp] = { error: String(e.stack || e).slice(0, 300) }; }
  const r = all[sp];
  if (r.error) { console.log(sp.padEnd(10), 'ERROR', r.error); continue; }
  console.log(sp.padEnd(10), Object.entries(r.clips).map(([c, m]) => `${c}:${m.depth}/${m.slipZ}/${m.slipX}${m.tail < -0.5 ? ` tail ${m.tail}` : ''}`).join('  '));
}
console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s; per clip: depth / slip along / slip sideways, cm)`);
if (args.save) { fs.writeFileSync(String(args.save), JSON.stringify(all, null, 1)); console.log('saved', args.save); }
if (args.compare) {
  const base = JSON.parse(fs.readFileSync(String(args.compare), 'utf8'));
  let worse = 0;
  for (const [sp, r] of Object.entries(all)) {
    const b = base[sp]; if (!b || b.error || r.error) continue;
    for (const [c, m] of Object.entries(r.clips)) {
      const o = b.clips[c]; if (!o) continue;
      // tolerances: a millimetre of depth, a centimetre of slip (or 25 % more)
      const bad = [];
      if (m.depth < o.depth - 0.1) bad.push(`depth ${o.depth}→${m.depth}`);
      if (o.tail !== undefined && m.tail < Math.min(o.tail, 0) - 0.5) bad.push(`tail ${o.tail}→${m.tail}`);
      // (lying down and sitting fold the legs: only their depth counts)
      if (c !== 'sit' && m.slipZ > Math.max(o.slipZ * 1.25, o.slipZ + 1)) bad.push(`slipZ ${o.slipZ}→${m.slipZ}`);
      if (c !== 'sit' && m.slipX > Math.max(o.slipX * 1.25, o.slipX + 1)) bad.push(`slipX ${o.slipX}→${m.slipX}`);
      if (bad.length) { worse++; console.log('WORSE', sp, c, bad.join(', ')); }
    }
  }
  console.log(worse ? `${worse} clip(s) worse than ${args.compare}` : `nothing worse than ${args.compare}`);
  if (worse) process.exitCode = 1;
}
