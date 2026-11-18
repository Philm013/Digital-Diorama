/*
 * WATER WORLD — scene engine. Composes the standalone water assets into continuous landscapes: one terrain, one sea,
 * every asset embedded so that land, river beds and water surfaces run on across the seams.
 *
 *   import { SCENES, createScene } from './scene.mjs';
 *   const world = await createScene('source-to-sea', { base: './assets/', scenes: './scenes/', onProgress });
 *   scene.add(world.root);
 *   renderer.setAnimationLoop((ms) => world.update(ms / 1000));
 *   world.setNight(0.8);      // lamps, beams, windows, bioluminescence
 *   world.spots               // camera bookmarks [{ id, title, target: [x, y, z], radius }]
 *   world.items               // every placed asset [{ id, name, title, group, object, night, params, follow }]
 *   world.env                 // suggested sky / fog / sun for the scene
 *   world.heightAt(x, z)      // ground height under any point (asset grounds first, then terrain)
 *   world.waterAt(x, z, t)    // water surface height (rivers, lakes, the sea) or null
 *
 * HOW THE SEAMS CLOSE
 *  · Chains: an asset's port (inlet / outlet / tributary…) is laid exactly onto another's: same position, same flow
 *    direction. Assets built with chainEnds share one river cross-section at their ends, so beds, banks and water
 *    levels continue across the join.
 *  · Terrain: every asset with a ground tile (userData.ground) is cut out of one world heightfield; around it the
 *    terrain takes the tile's own edge heights and colours and eases back into the landscape, so there is no step
 *    and no overlap (no z-fighting) at any tile border. Asset flanges hide hairline cracks.
 *  · Sea: one ocean for the whole coast, shoaled and tinted by the real depth of every beach, reef and river mouth
 *    (setShore); assets that bring their own sea cut holes in it (setHoles) and share its swell (matchWaves).
 *  · Dressing: groves, boulders and reed beds drape onto whatever lies beneath them; clumps that would land in deep
 *    water or on dry ground are culled.
 *  · Floating things ride the water they are on (waterSurface + matchWaves) and ring it (onWaterEvent → addRipple).
 *
 * Needs an import map resolving 'three' (the assets also import 'three/addons/'). MIT licence, like the assets.
 */
import * as THREE from 'three';

export const SCENES = [
  { id: 'source-to-sea', title: 'Source to Sea', blurb: 'One river from glacier to delta: meltwater, a waterfall and rapids, a meandering river fed by a mill stream, a beaver valley and a hot-spring creek, an oxbow lake, a marsh and the sea — with a cave, a geyser and an aquifer cut-away along the way.' },
  { id: 'harbour-town', title: 'Harbour Town', blurb: 'A reservoir dam, an old aqueduct, a canal lock and a bridge carry the river through a town of wells, pumps, fountains and puddles to a harbour with a beach, sea cliffs, tide pools, a lighthouse, piers, boats and a whirlpool off the headland.' },
  { id: 'tropical-island', title: 'Tropical Island', blurb: 'A volcanic island: a rainforest stream and waterfall, rice terraces, a mangrove estuary, a reef lagoon behind a palm beach, a sea arch, and a waterspout out on the open sea.' },
  { id: 'polar-fjord', title: 'Polar Fjord', blurb: 'A glacier feeding an outwash delta at the head of a fjord: icebergs calving and drifting, a frozen tarn on the shelf, orcas, a trawler and sea smoke.' },
];

// ─── Noise for terrain functions (deterministic, shared with scene specs) ───────────────────────────────
const fract = (v) => v - Math.floor(v);
const hash2 = (x, z, s = 0) => fract(Math.sin(x * 127.1 + z * 311.7 + s * 74.7) * 43758.5453123);
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function noise2(x, z, s = 0) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi, s), b = hash2(xi + 1, zi, s), c = hash2(xi, zi + 1, s), d = hash2(xi + 1, zi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, s = 0, oct = 4) {
  let f = 0, amp = 0.5, fr = 1, tot = 0;
  for (let i = 0; i < oct; i++) { f += amp * noise2(x * fr, z * fr, s + i * 17); tot += amp; amp *= 0.5; fr *= 2.03; }
  return f / tot;
}
/** Ridged multifractal (sharp crests) in 0..1. */
function ridged(x, z, s = 0, oct = 4) {
  let f = 0, amp = 0.5, fr = 1, tot = 0;
  for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(noise2(x * fr, z * fr, s + i * 13) * 2 - 1); f += amp * n * n; tot += amp; amp *= 0.5; fr *= 2.1; }
  return f / tot;
}
/** Distance from (x, z) to a polyline [[x, z], …] plus the arclength there: { d, s, t (0..1) }. */
function polyDist(pts, x, z) {
  let best = Infinity, bs = 0, acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9, l = Math.sqrt(l2);
    const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), px = ax + dx * t - x, pz = az + dz * t - z, d = px * px + pz * pz;
    if (d < best) { best = d; bs = acc + t * l; }
    acc += l;
  }
  return { d: Math.sqrt(best), s: bs, t: acc ? bs / acc : 0 };
}
const hexRGB = (h) => { const n = typeof h === 'number' ? h : parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
/** Mix two colours ('#rrggbb' or 0xrrggbb) → 0xrrggbb. */
function mixHex(a, b, t) { const A = hexRGB(a), B = hexRGB(b), k = clamp(t, 0, 1); return (Math.round(lerp(A[0], B[0], k)) << 16) | (Math.round(lerp(A[1], B[1], k)) << 8) | Math.round(lerp(A[2], B[2], k)); }
export const N = { noise2, fbm, ridged, hash2, smooth, lerp, clamp, polyDist, mix: mixHex };

const nextFrame = () => new Promise((res) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => res()) : setTimeout(res, 0)));
const KNOT = 0.5144;
const DEG = Math.PI / 180;

// ─── Small geometry helpers ─────────────────────────────────────────────────────────────────────────────
/** Clip a convex polygon [[x, z], …] to the half-plane n·(p − a) ≤ 0 (keep = 'in') or > 0 ('out'). */
function clipHalf(poly, ax, az, nx, nz, keepOut) {
  const out = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    const dp = (p[0] - ax) * nx + (p[1] - az) * nz, dq = (q[0] - ax) * nx + (q[1] - az) * nz;
    const pin = keepOut ? dp > 0 : dp <= 0, qin = keepOut ? dq > 0 : dq <= 0;
    if (pin) out.push(p);
    if (pin !== qin) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, true]); }
  }
  return out;
}
/** Convex polygon minus a convex CCW polygon (footprint) → list of convex pieces outside it. */
function subtractConvex(poly, fp) {
  const pieces = [];
  let cur = poly;
  for (let i = 0; i < fp.length; i++) {
    const a = fp[i], b = fp[(i + 1) % fp.length], ex = b[0] - a[0], ez = b[1] - a[1];
    const nx = ez, nz = -ex; // outward normal for a CCW polygon in the x-z plane (z down the screen)
    const outside = clipHalf(cur, a[0], a[1], nx, nz, true);
    if (outside.length >= 3) pieces.push(outside);
    cur = clipHalf(cur, a[0], a[1], nx, nz, false);
    if (cur.length < 3) break;
  }
  return pieces;
}
const polyArea = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };

function solidMat(name = 'solid') {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  m.name = name;
  return m;
}

/**
 * Build a scene. `id` names a spec in SCENES (loaded from opts.scenes + id + '.mjs') or is a spec object itself.
 * opts: base ('./assets/'), scenes ('./scenes/'), merge (true), quality ('high' | 'medium' | 'low'), onProgress(done, total, label)
 */
export async function createScene(id = 'source-to-sea', opts = {}) {
  const base = opts.base ?? './assets/', scenesBase = opts.scenes ?? './scenes/', merge = opts.merge ?? true;
  const quality = opts.quality ?? 'high', Q = { high: 1, medium: 1.45, low: 2 }[quality] || 1;
  const spec = typeof id === 'string' ? (await import(/* @vite-ignore */ `${scenesBase}${id}.mjs`)).default : id;
  const S = typeof spec === 'function' ? spec({ N }) : spec;
  const root = new THREE.Group();
  root.name = S.id || 'water-world';
  const mods = new Map(), items = [], byId = new Map(), movers = [], spots = [];
  const load = (name) => {
    if (!mods.has(name)) mods.set(name, import(/* @vite-ignore */ `${base}${name}.mjs`));
    return mods.get(name);
  };
  const progress = (d, n, label) => { if (opts.onProgress) opts.onProgress(d, n, label); };
  const defs = [...S.items];
  const seaDef = S.sea ? { id: 'sea', asset: 'ocean-surface', title: S.sea.title || 'Sea', group: S.sea.group || 'Sea', pal: 'sea', ...S.sea.item } : null;
  if (seaDef) defs.unshift(seaDef);
  const total = defs.length + 3;
  let done = 0;

  // ── 1. Build every asset (imported on demand, one frame per asset) ────────────────────────────────────
  const pal = S.palette || {};
  for (const d of defs) {
    const mod = await load(d.asset);
    const P = mod.params || {};
    const params = { mergeForProduction: merge };
    // scene palette: land zones for everything, water zones by kind (fresh / sea)
    const zoneSets = d.pal === false ? [] : [pal.land, d.pal === 'sea' ? pal.sea : pal.fresh, d.zones];
    for (const set of zoneSets) if (set) for (const [k, v] of Object.entries(set)) if (P[k] && P[k].type === 'color') params[k] = v;
    if (P.diorama && d.diorama === undefined) params.diorama = false;
    if (P.waterPatch && (d.float || d.waterPatch === false)) params.waterPatch = false;
    if (P.chainEnds && (d.after || d.attach) && d.chainEnds !== false) params.chainEnds = true;
    if (d === seaDef) {
      const [x0, z0, x1, z1] = S.sea.rect, w = x1 - x0, dz = z1 - z0, cell = (S.sea.cell || 3.2) * Q;
      Object.assign(params, { size: w, aspect: clamp(dz / w, 0.25, 4), resolution: Math.round(clamp(w / cell, 16, 256)), diorama: false, showSeabed: false });
    }
    Object.assign(params, d.params || {});
    const obj = mod.createAsset(params);
    obj.userData.assetName = d.asset;
    const it = { id: d.id, name: d.asset, title: d.title || d.asset, group: d.group || '', object: obj, night: mod.night || {}, params: { ...(d.params || {}) }, follow: false, def: d, mod };
    items.push(it); byId.set(d.id, it);
    root.add(obj);
    progress(++done, total, it.title);
    await nextFrame();
  }

  // ── 2. Place: absolute, chained by ports, or relative to another asset ───────────────────────────────
  const portWorld = (it, name) => {
    const pt = it.object.userData.ports && it.object.userData.ports[name];
    if (!pt) throw new Error(`${it.id}: no port "${name}"`);
    it.object.updateMatrixWorld(true);
    const p = new THREE.Vector3(...pt.position).applyMatrix4(it.object.matrixWorld);
    const dir = new THREE.Vector3(...pt.direction).transformDirection(it.object.matrixWorld);
    return { p, dir, w: pt.width, level: p.y };
  };
  const placed = new Set();
  const placeOne = (it) => {
    const d = it.def, o = it.object;
    const att = d.after ? { to: `${d.after}.outlet`, port: d.port || 'inlet' } : d.attach;
    if (att) {
      const [tid, tport] = att.to.split('.');
      const target = byId.get(tid);
      if (!target) throw new Error(`${d.id}: unknown attach target ${tid}`);
      if (!placed.has(tid)) return false;
      const T = portWorld(target, tport), own = o.userData.ports && o.userData.ports[att.port];
      if (!own) throw new Error(`${d.id}: no port "${att.port}"`);
      const yaw = Math.atan2(own.direction[2], own.direction[0]) - Math.atan2(T.dir.z, T.dir.x);
      o.rotation.y = yaw;
      o.position.set(0, 0, 0);
      o.updateMatrixWorld(true);
      const lp = new THREE.Vector3(...own.position).applyMatrix4(o.matrixWorld);
      o.position.set(T.p.x - lp.x, T.p.y - own.position[1], T.p.z - lp.z);
      if (Math.abs(own.width - T.w) > 0.05) console.warn(`[scene] ${d.id}.${att.port} width ${own.width} ≠ ${tid}.${tport} width ${T.w}`);
    } else if (d.on) {
      const host = byId.get(d.on);
      if (!host) throw new Error(`${d.id}: unknown host ${d.on}`);
      if (!placed.has(d.on)) return false;
      const ho = host.object, l = d.local || [0, 0];
      ho.updateMatrixWorld(true);
      const w = new THREE.Vector3(l[0], 0, l[1]).applyMatrix4(ho.matrixWorld);
      let y = ho.position.y + (d.dy || 0);
      const g = ho.userData.ground;
      if (d.y !== undefined) y = d.y;
      else if (g && d.level !== 'water') { const hy = g.heightAt(l[0], l[1]); if (hy !== null) y = hy + ho.position.y + (d.dy || 0); }
      o.position.set(w.x, y, w.z);
      o.rotation.y = ho.rotation.y + (d.yaw || 0) * DEG;
    } else {
      const a = d.at || [0, 0, 0];
      o.position.set(a[0], typeof d.y === 'number' ? d.y : typeof a[1] === 'number' ? a[1] : 0, a[2]);
      o.rotation.y = (d.yaw || 0) * DEG;
    }
    o.updateMatrixWorld(true);
    placed.add(d.id);
    return true;
  };
  if (seaDef) {
    const [x0, z0, x1, z1] = S.sea.rect;
    seaDef.at = [(x0 + x1) / 2, 0, (z0 + z1) / 2];
  }
  for (let pass = 0; pass < items.length + 2 && placed.size < items.length; pass++) for (const it of items) if (!placed.has(it.id)) placeOne(it);
  if (placed.size < items.length) throw new Error(`[scene] could not place: ${items.filter((i) => !placed.has(i.id)).map((i) => i.id).join(', ')}`);
  root.updateMatrixWorld(true);

  // ── 3. Footprints: every ground tile, as a world polygon with its edge heights and colours ───────────────
  const fps = [];
  const addFp = (it) => {
    const g = it.object.userData.ground;
    if (!g || it.def.footprint === false) return;
    const o = it.object, [x0, z0, x1, z1] = g.bounds, c = Math.cos(o.rotation.y), s = Math.sin(o.rotation.y);
    const toW = (lx, lz) => [o.position.x + lx * c + lz * s, o.position.z - lx * s + lz * c];
    const toL = (wx, wz) => { const dx = wx - o.position.x, dz = wz - o.position.z; return [dx * c - dz * s, dx * s + dz * c]; };
    // CCW in (x, z) with z pointing "down the screen": order the corners so the outward normals (ez, −ex) point out
    let poly = [toW(x0, z0), toW(x1, z0), toW(x1, z1), toW(x0, z1)];
    if (polyArea(poly) < 0) poly = poly.reverse();
    const xs = poly.map((q) => q[0]), zs = poly.map((q) => q[1]);
    const f = {
      it, g, y: o.position.y, x0, z0, x1, z1, toL, toW, poly,
      bb: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)],
      fall: it.def.fall ?? 26, basin: it.def.basin ?? 0, prio: it.def.prio ?? 0, cfall: it.def.colorFall ?? 16,
    };
    // mean edge height (for the broad basin the landscape settles into around big tiles)
    let m = 0, n = 0;
    for (let k = 0; k < 16; k++) {
      const t = k / 16;
      for (const [lx, lz] of [[lerp(x0, x1, t), z0], [lerp(x0, x1, t), z1], [x0, lerp(z0, z1, t)], [x1, lerp(z0, z1, t)]]) { const hy = g.heightAt(lx, lz); if (hy !== null) { m += hy; n++; } }
    }
    f.mean = (n ? m / n : 0) + f.y;
    fps.push(f);
  };
  for (const it of items) if (it.def.y !== 'fit') addFp(it);
  const insideFp = (f, wx, wz) => { const [lx, lz] = f.toL(wx, wz); return lx >= f.x0 - 1e-6 && lx <= f.x1 + 1e-6 && lz >= f.z0 - 1e-6 && lz <= f.z1 + 1e-6; };
  const groundOf = (wx, wz) => {
    let best = null;
    for (const f of fps) {
      if (wx < f.bb[0] || wx > f.bb[2] || wz < f.bb[1] || wz > f.bb[3] || !insideFp(f, wx, wz)) continue;
      if (!best || f.prio > best.prio) best = f;
    }
    return best;
  };

  // ── 4. Terrain function: landscape → basins around big tiles → exact edge heights at every tile border ─
  const B0 = (x, z) => S.terrain.height(x, z, N);
  const EPS = 1e-4;
  /** Influence of the tiles near (x, z): { E (edge height mix), w (0..1), C (nearest edge point for colour) }. */
  const near = (x, z, useColor = false) => {
    let acc = 0, wsum = 0, wmax = 0, bAcc = 0, bSum = 0, bMax = 0, cBest = null, cD = Infinity;
    for (const f of fps) {
      const reach = Math.max(f.fall, f.basin);
      if (x < f.bb[0] - reach || x > f.bb[2] + reach || z < f.bb[1] - reach || z > f.bb[3] + reach) continue;
      const [lx, lz] = f.toL(x, z);
      const dx = Math.max(f.x0 - lx, 0, lx - f.x1), dz = Math.max(f.z0 - lz, 0, lz - f.z1), d = Math.hypot(dx, dz);
      if (f.basin > 0 && d < f.basin) { const sb = smooth(f.basin, 0, d), a = sb / (d * d + 25); bAcc += a * f.mean; bSum += a; bMax = Math.max(bMax, sb); }
      if (d >= f.fall) continue;
      const qx = clamp(lx, f.x0, f.x1), qz = clamp(lz, f.z0, f.z1);
      let E = f.g.heightAt(qx, qz);
      if (E === null) continue;
      E += f.y;
      if (d < EPS) return { E, w: 1, exact: true, f, q: [qx, qz], basin: null };
      const s = smooth(f.fall, 0, d), a = s / (d * d);
      acc += a * E; wsum += a; wmax = Math.max(wmax, s);
      if (useColor && d < f.cfall && d / f.cfall < cD) { cD = d / f.cfall; cBest = { f, q: [qx, qz], d }; }
    }
    return { E: wsum ? acc / wsum : 0, w: wmax, exact: false, c: cBest, basin: bSum ? { M: bAcc / bSum, w: bMax } : null };
  };
  const terrainAt = (x, z) => {
    const r = near(x, z);
    if (r.exact) return r.E;
    let b = B0(x, z);
    if (r.basin) b = lerp(b, r.basin.M + (S.terrain.basinLift || 0), r.basin.w);
    return r.w > 0 ? lerp(b, r.E, r.w) : b;
  };
  /** Ground anywhere: an asset's own ground where there is one, else the terrain. */
  const heightAt = (x, z) => {
    const f = groundOf(x, z);
    if (f) { const [lx, lz] = f.toL(x, z), hy = f.g.heightAt(lx, lz); if (hy !== null) return hy + f.y; }
    return terrainAt(x, z);
  };
  // y: 'fit' sets a tile's height so its edge (all, or one side: '+x' '-x' '+z' '-z') sits on the landscape around it
  for (const it of items) {
    const d = it.def, g = it.object.userData.ground;
    if (d.y !== 'fit') continue;
    if (g) {
      const o = it.object, [x0, z0, x1, z1] = g.bounds, side = d.fitSide || 'all', c = Math.cos(o.rotation.y), s = Math.sin(o.rotation.y);
      let acc = 0, n = 0;
      for (let k = 0; k <= 12; k++) {
        const t = k / 12, pts = [];
        if (side === 'all' || side === '-z') pts.push([lerp(x0, x1, t), z0]);
        if (side === 'all' || side === '+z') pts.push([lerp(x0, x1, t), z1]);
        if (side === 'all' || side === '-x') pts.push([x0, lerp(z0, z1, t)]);
        if (side === 'all' || side === '+x') pts.push([x1, lerp(z0, z1, t)]);
        for (const [lx, lz] of pts) { const hy = g.heightAt(lx, lz); if (hy === null) continue; acc += terrainAt(o.position.x + lx * c + lz * s, o.position.z - lx * s + lz * c) - hy; n++; }
      }
      o.position.y = (n ? acc / n : 0) + (d.dy || 0);
      o.updateMatrixWorld(true);
    }
  }
  for (const it of items) if (it.def.y === 'fit') addFp(it);
  progress(++done, total, 'Terrain');
  await nextFrame();

  // ── 5. Terrain mesh: a grid clipped around every tile, coloured to meet each tile's own colours ────────
  const [WX0, WZ0, WX1, WZ1] = S.bounds;
  const res = (S.terrain.res || 3) * Q, nx = Math.max(8, Math.round((WX1 - WX0) / res)), nz = Math.max(8, Math.round((WZ1 - WZ0) / res));
  const GX = (i) => WX0 + (i / nx) * (WX1 - WX0), GZ = (j) => WZ0 + (j / nz) * (WZ1 - WZ0);
  const Hgrid = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) Hgrid[j * (nx + 1) + i] = terrainAt(GX(i), GZ(j));
  const roads = (S.roads || []).map((r) => ({ ...r, col: new THREE.Color(r.color), bb: [Math.min(...r.pts.map((q) => q[0])) - r.w, Math.min(...r.pts.map((q) => q[1])) - r.w, Math.max(...r.pts.map((q) => q[0])) + r.w, Math.max(...r.pts.map((q) => q[1])) + r.w] }));
  const tcol = new THREE.Color(), ecol = new THREE.Color();
  const colorAt = (x, y, z, slope) => {
    tcol.set(S.terrain.color(x, y, z, slope, N));
    for (const r of roads) {
      if (x < r.bb[0] || x > r.bb[2] || z < r.bb[1] || z > r.bb[3]) continue;
      const d = polyDist(r.pts, x, z).d;
      if (d < r.w / 2) { tcol.copy(r.col); break; }
      if (d < r.w / 2 + 1.2 && r.verge) tcol.lerp(new THREE.Color(r.verge), 0.6);
    }
    const nb = near(x, z, true);
    if (nb.c) {
      const ce = nb.c.f.g.colorAt(nb.c.q[0], nb.c.q[1]);
      if (ce) tcol.lerp(ecol.copy(ce), smooth(nb.c.f.cfall, 0.5, nb.c.d) * 0.9);
    }
    return tcol;
  };
  const tpos = [], tcolArr = [];
  const emit = (a, b, c) => {
    const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2], e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
    const nyv = e1z * e2x - e1x * e2z, nl = Math.hypot(e1y * e2z - e1z * e2y, nyv, e1x * e2y - e1y * e2x) || 1;
    const col = colorAt((a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3, 1 - Math.abs(nyv) / nl);
    tpos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let k = 0; k < 3; k++) tcolArr.push(col.r, col.g, col.b);
  };
  const vtx = (i, j) => [GX(i), Hgrid[j * (nx + 1) + i], GZ(j)];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = vtx(i, j), b = vtx(i + 1, j), c = vtx(i + 1, j + 1), d = vtx(i, j + 1);
      const tris = (i + j) & 1 ? [[a, d, b], [b, d, c]] : [[a, d, c], [a, c, b]];
      const cx0 = a[0], cx1 = b[0], cz0 = a[2], cz1 = d[2];
      const hit = fps.filter((f) => !(cx1 < f.bb[0] || cx0 > f.bb[2] || cz1 < f.bb[1] || cz0 > f.bb[3]));
      for (const t of tris) {
        if (!hit.length) { emit(t[0], t[1], t[2]); continue; }
        let pieces = [t.map((v) => [v[0], v[2], false, v[1]])];
        for (const f of hit) pieces = pieces.flatMap((pc) => subtractConvex(pc, f.poly));
        for (const pc of pieces) {
          if (Math.abs(polyArea(pc)) < 1e-4) continue;
          const v3 = pc.map((q) => [q[0], q[3] !== undefined && q[2] === false ? q[3] : terrainAt(q[0], q[1]), q[1]]);
          for (let k = 1; k < v3.length - 1; k++) emit(v3[0], v3[k], v3[k + 1]);
        }
      }
    }
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(tpos, 3));
  tg.setAttribute('color', new THREE.Float32BufferAttribute(tcolArr, 3));
  tg.computeVertexNormals();
  const terrainMat = solidMat('terrain');
  const terrain = new THREE.Mesh(tg, terrainMat);
  terrain.name = 'terrain'; terrain.receiveShadow = true; terrain.castShadow = true;
  root.add(terrain);

  // World skirt: soil / subsoil / rock bands around the world's edge, water sections where the sea reaches it
  const baseY = S.baseY ?? -30, sk = [], skc = [], wsk = [], skCols = (S.skirt || ['#6b5236', '#57432f', '#4a4a48']).map((h) => new THREE.Color(h));
  const seaRect = S.sea ? S.sea.rect : null, seaLevel = 0;
  const gaps = items.filter((it) => it.def.edgeGap).map((it) => {
    const f = fps.find((q) => q.it === it);
    return { bb: f.bb, bottom: it.object.position.y + it.def.edgeGap.bottom };
  });
  const quad = (list, cl, a, b, ya0, ya1, yb0, yb1, col) => {
    if (ya1 - ya0 < 1e-3 && yb1 - yb0 < 1e-3) return;
    list.push(a[0], ya0, a[1], b[0], yb0, b[1], b[0], yb1, b[1], a[0], ya0, a[1], b[0], yb1, b[1], a[0], ya1, a[1]);
    if (cl) for (let k = 0; k < 6; k++) cl.push(col.r, col.g, col.b);
  };
  const edgeSides = [[nx, (t) => [lerp(WX0, WX1, t), WZ0]], [nz, (t) => [WX1, lerp(WZ0, WZ1, t)]], [nx, (t) => [lerp(WX1, WX0, t), WZ1]], [nz, (t) => [WX0, lerp(WZ1, WZ0, t)]]];
  for (const [n, at] of edgeSides) {
    for (let k = 0; k < n; k++) {
      const a = at(k / n), b = at((k + 1) / n), mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      const gap = gaps.find((gp) => mx >= gp.bb[0] - 0.01 && mx <= gp.bb[2] + 0.01 && mz >= gp.bb[1] - 0.01 && mz <= gp.bb[3] + 0.01);
      let ta = heightAt(a[0], a[1]), tb = heightAt(b[0], b[1]);
      if (gap) { ta = tb = gap.bottom; }
      const sa = ta - 0.6 - noise2(a[0] * 0.3, a[1] * 0.3, 3) * 0.6, sb = tb - 0.6 - noise2(b[0] * 0.3, b[1] * 0.3, 3) * 0.6;
      const ma = Math.max(baseY, ta - 3 - noise2(a[0] * 0.1, a[1] * 0.1, 5) * 3), mb = Math.max(baseY, tb - 3 - noise2(b[0] * 0.1, b[1] * 0.1, 5) * 3);
      if (!gap) quad(sk, skc, a, b, Math.max(sa, baseY), ta, Math.max(sb, baseY), tb, skCols[0]);
      quad(sk, skc, a, b, Math.min(ma, Math.max(sa, baseY)), Math.max(sa, baseY), Math.min(mb, Math.max(sb, baseY)), Math.max(sb, baseY), skCols[1]);
      quad(sk, skc, a, b, baseY, Math.min(ma, Math.max(sa, baseY)), baseY, Math.min(mb, Math.max(sb, baseY)), skCols[2]);
      const inSea = (q) => seaRect && q[0] >= seaRect[0] - 0.5 && q[0] <= seaRect[2] + 0.5 && q[1] >= seaRect[1] - 0.5 && q[1] <= seaRect[3] + 0.5;
      if (!gap && inSea(a) && inSea(b) && (ta < seaLevel || tb < seaLevel)) quad(wsk, null, a, b, ta, Math.max(ta, seaLevel), tb, Math.max(tb, seaLevel));
    }
  }
  const skg = new THREE.BufferGeometry();
  skg.setAttribute('position', new THREE.Float32BufferAttribute(sk, 3));
  skg.setAttribute('color', new THREE.Float32BufferAttribute(skc, 3));
  skg.computeVertexNormals();
  const skirt = new THREE.Mesh(skg, solidMat('skirt'));
  skirt.name = 'world-skirt';
  root.add(skirt);
  const bottom = new THREE.Mesh(new THREE.PlaneGeometry(WX1 - WX0, WZ1 - WZ0).rotateX(Math.PI / 2).translate((WX0 + WX1) / 2, baseY, (WZ0 + WZ1) / 2), new THREE.MeshStandardMaterial({ color: skCols[2], roughness: 1, side: THREE.DoubleSide }));
  bottom.name = 'world-base';
  root.add(bottom);
  let waterSkirt = null;
  if (wsk.length) {
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wsk, 3));
    wg.computeVertexNormals();
    const wm = new THREE.MeshStandardMaterial({ color: new THREE.Color(S.sectionWater || '#1f5d78'), roughness: 0.2, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide });
    wm.name = 'water-section';
    waterSkirt = new THREE.Mesh(wg, wm);
    waterSkirt.name = 'sea-section'; waterSkirt.renderOrder = 1;
    root.add(waterSkirt);
  }
  progress(++done, total, 'Coastline');
  await nextFrame();

  // ── 6. Water: hosts, the sea's shore and holes, floating things ─────────────────────────────────────────
  const sea = seaDef ? byId.get('sea') : null;
  const hosts = items.filter((it) => it.object.userData.surface && it !== sea && !it.def.float);
  for (const h of hosts) { h.bb = new THREE.Box3().setFromObject(h.object); }
  /** Water surface under (x, z): the first asset water found there, else the sea. */
  const waterAt = (x, z, t = 0) => {
    for (const h of hosts) {
      if (x < h.bb.min.x || x > h.bb.max.x || z < h.bb.min.z || z > h.bb.max.z) continue;
      const y = h.object.userData.surface.heightAt(x, z, t);
      if (y !== null) return y;
    }
    if (sea && seaRect && x >= seaRect[0] && x <= seaRect[2] && z >= seaRect[1] && z <= seaRect[3]) { const g = heightAt(x, z); if (g < 0.4) return sea.object.userData.surface.heightAt(x, z, t); }
    return null;
  };
  const hostAt = (x, z) => {
    for (const h of hosts) {
      if (x < h.bb.min.x || x > h.bb.max.x || z < h.bb.min.z || z > h.bb.max.z) continue;
      if (h.object.userData.surface.heightAt(x, z, 0) !== null) return h;
    }
    return sea;
  };
  /** Rest level of the water at (x, z) (no swell). */
  const levelAt = (x, z) => {
    const h = hostAt(x, z);
    if (!h) return 0;
    if (h === sea) return sea.object.position.y;
    const y = h.object.userData.surface.heightAt(x, z, 0);
    return y === null ? 0 : y;
  };
  if (sea) {
    const so = sea.object.userData;
    const calm = S.sea.calm || [];
    const zone = (key, def) => (calm.some((c) => c[key] !== undefined) ? (x, z) => {
      let k = 1;
      for (const c of calm) if (c[key] !== undefined) k *= lerp(c[key], 1, smooth(c.r * 0.45, c.r, Math.hypot(x - c.x, z - c.z)));
      return k;
    } : def);
    so.setShore((x, z) => -heightAt(x, z), zone('k', null), zone('tint', null));
    const holes = [];
    for (const it of items) {
      const d = it.def;
      if (it === sea || d.float) continue;
      if (d.seaHole) {
        const o = it.object, h = d.seaHole === 'auto' ? o.userData.seaHole : d.seaHole;
        const c = Math.cos(o.rotation.y), sn = Math.sin(o.rotation.y), hx = h.x || 0, hz = h.z || 0;
        if (h.r) holes.push({ x: o.position.x + hx * c + hz * sn, z: o.position.z - hx * sn + hz * c, r: h.r });
        else holes.push({ x: o.position.x + hx * c + hz * sn, z: o.position.z - hx * sn + hz * c, w: h.w, d: h.d, yaw: o.rotation.y });
        if (it.object.userData.matchWaves) it.object.userData.matchWaves(sea.object);
        // same surface finish as the ocean, so the patch can't be told apart at its rim
        let seaMat = null;
        sea.object.traverse((q) => { if (!seaMat && q.material && q.material.name === 'water') seaMat = q.material; });
        if (seaMat) it.object.traverse((q) => { if (q.material && q.material.name === 'water') { q.material.opacity = seaMat.opacity; q.material.roughness = seaMat.roughness; } });
        continue;
      }
      if (d.pal === 'sea' || d.noHole) continue;
      const f = fps.find((q) => q.it === it);
      if (!f || !it.object.userData.surface || !seaRect) continue;
      const [bx0, bz0, bx1, bz1] = f.bb;
      if (bx1 < seaRect[0] || bx0 > seaRect[2] || bz1 < seaRect[1] || bz0 > seaRect[3]) continue;
      let lowest = Infinity;
      for (let k = 0; k <= 12; k++) for (let m = 0; m <= 12; m++) { const hy = f.g.heightAt(lerp(f.x0, f.x1, k / 12), lerp(f.z0, f.z1, m / 12)); if (hy !== null) lowest = Math.min(lowest, hy + f.y); }
      if (lowest < 0.3) holes.push({ x: f.toW((f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2)[0], z: f.toW((f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2)[1], w: f.x1 - f.x0, d: f.z1 - f.z0, yaw: it.object.rotation.y });
    }
    if (holes.length > 12) console.warn(`[scene] ${holes.length} sea holes; only 12 are cut`);
    so.setHoles(holes.slice(0, 12));
  }
  // composite sampler for floaters that roam across several waters
  const roaming = { heightAt: (x, z, t) => waterAt(x, z, t) };
  for (const it of items) {
    const d = it.def, o = it.object;
    if (!d.float) continue;
    const host = d.float === 'auto' ? null : d.float === 'sea' ? sea : byId.get(d.float);
    o.userData.waterSurface = host ? host.object.userData.surface : roaming;
    const waveSrc = host || hostAt(o.position.x, o.position.z);
    if (o.userData.matchWaves && waveSrc) o.userData.matchWaves(waveSrc.object);
    o.userData.onWaterEvent = (x, z, t, a) => { const h = host || hostAt(x, z); if (h && h.object.userData.addRipple) h.object.userData.addRipple(x, z, t, a); };
    if (!d.fixedY) o.position.y = levelAt(o.position.x, o.position.z) + (d.dy || 0);
    if (d.course) {
      const c = d.course;
      const m = { obj: o, speed: c.knots ? c.knots * KNOT : c.speed, dir: c.dir || 1, phase: c.phase || 0, dy: d.dy || 0 };
      if (c.along) {
        // follow another asset's channel: its centreline in world space, trimmed to [from, to]
        const host = byId.get(c.along), cl = host && host.object.userData.centerline;
        if (cl) {
          const ho = host.object, cs = Math.cos(ho.rotation.y), sn = Math.sin(ho.rotation.y), n = cl.length;
          const i0 = Math.floor((c.from ?? 0.1) * (n - 1)), i1 = Math.ceil((c.to ?? 0.9) * (n - 1));
          c.pts = cl.slice(i0, i1 + 1).filter((q, k, a) => k === 0 || k === a.length - 1 || k % 3 === 0).map(([lx, lz]) => [ho.position.x + lx * cs + lz * sn, ho.position.z - lx * sn + lz * cs]);
          if (!c.mode) c.mode = 'pingpong';
        }
      }
      if (c.pts) {
        const pts = c.pts, S2 = [0];
        for (let i = 1; i < pts.length; i++) S2.push(S2[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        const closed = c.mode !== 'pingpong';
        const L = S2[S2.length - 1] + (closed ? Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) : 0);
        const at = (s) => {
          s = ((s % L) + L) % L;
          for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length], s0 = S2[i], s1 = i + 1 < pts.length ? S2[i + 1] : L;
            if (s <= s1 || i === pts.length - 1) { const t = clamp((s - s0) / Math.max(1e-6, s1 - s0), 0, 1); return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; }
          }
          return pts[0];
        };
        Object.assign(m, { type: 'path', at, L, pingpong: !closed, Lp: S2[S2.length - 1] });
      } else Object.assign(m, { type: 'ellipse', cx: c.cx, cz: c.cz, rx: c.rx, rz: c.rz, L: Math.PI * (3 * (c.rx + c.rz) - Math.sqrt((3 * c.rx + c.rz) * (c.rx + 3 * c.rz))) });
      movers.push(m);
      it.follow = true;
    }
  }

  // ── 7. Dressing: drape groves, boulders and reed beds over whatever lies beneath ───────────────────────
  for (const it of items) {
    const d = it.def, o = it.object;
    if (!d.drape || !o.userData.drape) continue;
    if (!d.fixedY) { o.position.y = heightAt(o.position.x, o.position.z) + (d.dy || 0); o.updateMatrixWorld(true); }
    const ring = (x, z, r) => { let best = null; for (let k = 0; k < 9; k++) { const a = (k / 8) * Math.PI * 2, px = x + (k ? Math.cos(a) * r : 0), pz = z + (k ? Math.sin(a) * r : 0), w = waterAt(px, pz, 0); if (w !== null && (best === null || w > best)) best = w; } return best; };
    const keep = (x, z, gy, kind) => {
      if (kind === 'reed' || kind === 'iris') {
        const w = ring(x, z, 1.2);
        if (w === null) return false;
        const depth = w - gy;
        return kind === 'iris' ? depth > -0.35 && depth < 0.12 : depth > -0.25 && depth < (d.reedDepth ?? 0.75);
      }
      if (kind === 'rock') return true;
      const w = ring(x, z, kind === 'tree' ? 2.2 : 1);
      return w === null || gy > w + 0.35;
    };
    it.kept = o.userData.drape(heightAt, keep);
  }
  // Items stood on the ground or in the water (no own tile): y follows what is under them
  for (const it of items) {
    const d = it.def, o = it.object;
    if (d.y === 'ground') { o.position.y = heightAt(o.position.x, o.position.z) + (d.dy || 0); o.updateMatrixWorld(true); }
    else if (d.y === 'water') { o.position.y = levelAt(o.position.x, o.position.z) + (d.dy || 0); o.updateMatrixWorld(true); }
  }
  root.updateMatrixWorld(true);

  // ── 8. Camera bookmarks ──────────────────────────────────────────────────────────────────────────────
  const boundsOf = (obj) => {
    const box = new THREE.Box3(), tmp = new THREE.Box3(), m = new THREE.Matrix4();
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.visible) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      if (o.isInstancedMesh) { if (o.frustumCulled === false) return; for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); tmp.copy(o.geometry.boundingBox).applyMatrix4(m).applyMatrix4(o.matrixWorld); box.union(tmp); } }
      else { tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); box.union(tmp); }
    });
    if (box.isEmpty()) box.setFromCenterAndSize(obj.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(10, 10, 10));
    return box;
  };
  const W = Math.max(WX1 - WX0, WZ1 - WZ0);
  /** Pick a camera azimuth / elevation (radians) for a bookmark whose sight line stays above the ground. */
  const pickView = (t, r, az0 = 0.6, el0 = 0.55) => {
    let best = null;
    for (let k = 0; k < 16; k++) {
      const az = az0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
      for (const el of [el0, el0 + 0.2, el0 + 0.4]) {
        let clear = Infinity;
        for (let i = 1; i <= 12; i++) {
          const f = i / 12, x = t[0] + Math.sin(az) * Math.cos(el) * r * f, z = t[2] + Math.cos(az) * Math.cos(el) * r * f, y = t[1] + Math.sin(el) * r * f;
          if (x < WX0 || x > WX1 || z < WZ0 || z > WZ1) continue;
          clear = Math.min(clear, y - heightAt(x, z) - 1.5);
        }
        const score = (clear > 0 ? 0 : -1000 + clear) - Math.ceil(k / 2) * 0.6 - (el - el0) * 4;
        if (!best || score > best.score) best = { az, el, score };
        if (clear > 0) break;
      }
    }
    return { az: best.az, el: best.el };
  };
  spots.push({ id: 'overview', title: 'Overview', target: [(WX0 + WX1) / 2, 0, (WZ0 + WZ1) / 2], radius: W * 0.95 });
  for (const s of S.spots || []) {
    if (s.item) { const it = byId.get(s.item); if (!it) continue; const b = boundsOf(it.object), c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()); spots.push({ id: s.id || s.item, title: s.title, target: [c.x, s.y ?? Math.max(c.y * 0.5, heightAt(c.x, c.z)), c.z], radius: s.radius || Math.max(sz.x, sz.z) * 1.05 }); }
    else spots.push({ id: s.id, title: s.title, target: [s.at[0], s.at[1] ?? heightAt(s.at[0], s.at[2]), s.at[2]], radius: s.radius, ...(s.az !== undefined ? { az: s.az * DEG, el: (s.el ?? 32) * DEG } : {}) });
  }
  for (const it of items) {
    if (spots.some((s) => s.id === it.id)) continue;
    const o = it.object, v = o.userData.view;
    if (v && v.target && it.def.useView !== false) {
      const w = new THREE.Vector3(...v.target).applyMatrix4(o.matrixWorld);
      spots.push({ id: it.id, title: it.title, target: [w.x, w.y, w.z], radius: Math.min(v.radius, 400) * (it.def.zoom || 1), item: true });
    } else {
      const b = boundsOf(o), c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
      spots.push({ id: it.id, title: it.title, target: [c.x, Math.max(c.y * 0.6, heightAt(c.x, c.z)), c.z], radius: clamp(Math.max(sz.x, sz.z, sz.y * 1.3) * 1.1, 12, 400) * (it.def.zoom || 1), item: true });
    }
  }
  for (const s2 of spots) if (s2.az === undefined) Object.assign(s2, pickView(s2.target, s2.radius, s2.id === 'overview' ? 0.5 : 0.6, s2.id === 'overview' ? 0.7 : 0.55));
  progress(++done, total, 'Ready');

  // ── Runtime ─────────────────────────────────────────────────────────────────────────────────────────
  const update = (t) => {
    for (const m of movers) {
      let x, z, hx, hz;
      if (m.type === 'ellipse') {
        const a = m.phase + (m.dir * 2 * Math.PI * m.speed * t) / m.L;
        x = m.cx + m.rx * Math.cos(a); z = m.cz + m.rz * Math.sin(a);
        hx = -m.rx * Math.sin(a) * m.dir; hz = m.rz * Math.cos(a) * m.dir;
      } else {
        let s = m.phase * m.L + m.speed * t * m.dir, back = false;
        if (m.pingpong) { const P2 = 2 * m.Lp, q = ((s % P2) + P2) % P2; back = q > m.Lp; s = back ? P2 - q : q; }
        [x, z] = m.at(s);
        const [ax, az] = m.at(s + (back ? -2.5 : 2.5)), [bx, bz] = m.at(s - (back ? -2.5 : 2.5));
        hx = ax - bx; hz = az - bz;
      }
      m.obj.position.set(x, levelAt(x, z) + m.dy, z);
      m.obj.rotation.y = Math.atan2(hx, hz);
    }
    for (const it of items) it.object.userData.update(t);
  };
  const setNight = (k) => { for (const it of items) it.object.userData.setNight(k); };
  const dispose = () => {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.name !== 'solid' && m.name !== 'glass') m.dispose(); });
    });
    root.removeFromParent();
  };
  const tris = items.reduce((s, i) => s + (i.object.userData.triangles || 0), 0) + tpos.length / 9 + sk.length / 9;
  return {
    id: S.id, title: S.title, blurb: S.blurb, root, update, setNight, dispose, spots,
    items: items.map(({ def, mod, bb, ...rest }) => rest),
    groups: S.groups || [], env: S.env || {}, heightAt, waterAt, terrain, triangles: tris,
  };
}

export default createScene;
