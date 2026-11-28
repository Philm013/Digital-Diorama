// Build fingerprints (dev tool): builds every catalog asset through the app's own builder (src/assets/builder.ts) in
// Node, at each graphics tier, and hashes what comes out: hierarchy and transforms, geometry buffers, materials (with
// their textures and shader patches), skeletons, clips, rig pivots, schema and userData, then the scene again after
// setNight() and update(). A refactor that keeps every fingerprint changed nothing the app builds.
//
//   node tools/fingerprint-check.mjs --save base.json          build everything and keep the fingerprints
//   node tools/fingerprint-check.mjs --compare base.json       …and list every build that differs (exits non-zero)
//   node tools/fingerprint-check.mjs --only mammal/lion,bird/owl --tiers high
//   node tools/fingerprint-check.mjs --jobs 2                  worker processes (default: CPU count, at most 4)
//
// Math.random is seeded per build (three.js uuids draw from a stream of their own), so modules that scatter things
// randomly are reproducible too, whatever order the builds run in.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => { if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true]); return acc; }, []));
const TIERS = String(args.tiers ?? 'low,medium,high').split(',');
const ONLY = args.only ? new Set(String(args.only).split(',')) : null;

/* ───────────────────────── hashing ───────────────────────── */
const sha = () => crypto.createHash('sha1');
const hex = (s) => sha().update(s).digest('hex').slice(0, 16);
function bytes(a) { return a ? `${a.constructor.name}:${a.length}:${hex(Buffer.from(a.buffer, a.byteOffset, a.byteLength))}` : 'null'; }

function makeHasher(THREE) {
  const num = (v) => (Object.is(v, -0) ? '-0' : String(v));
  function attr(a) {
    if (!a) return 'null';
    if (a.isInterleavedBufferAttribute) return `I(${a.itemSize},${a.offset},${a.data.stride},${a.normalized},${bytes(a.data.array)})`;
    return `A(${a.itemSize},${a.normalized},${bytes(a.array)})`;
  }
  function texture(t) {
    const img = t.image;
    const data = img && img.data ? bytes(img.data) : img ? `${img.width}x${img.height}` : 'none';
    return `T(${t.constructor.name},${data},${img?.width},${img?.height},${t.wrapS},${t.wrapT},${t.magFilter},${t.minFilter},${t.format},${t.type},${t.colorSpace},${t.flipY},${t.generateMipmaps},${t.anisotropy},${t.repeat.toArray()},${t.offset.toArray()},${t.rotation},${t.channel})`;
  }
  // stable text for any value found in materials, uniforms and userData
  function ser(v, seen = [], depth = 0) {
    if (v === null || v === undefined || typeof v === 'boolean') return String(v);
    if (typeof v === 'number') return num(v);
    if (typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'bigint') return v + 'n';
    if (typeof v === 'function') return '[fn]';
    if (ArrayBuffer.isView(v)) return bytes(v);
    if (depth > 14) return '[deep]';
    if (seen.includes(v)) return '[cycle]';
    const s = [...seen, v];
    if (v.isColor) return `C(${num(v.r)},${num(v.g)},${num(v.b)})`;
    if (v.isVector2 || v.isVector3 || v.isVector4 || v.isQuaternion || v.isEuler || v.isMatrix3 || v.isMatrix4) return `V(${v.toArray().map(num)})`;
    if (v.isTexture) return texture(v);
    if (v.isMaterial) return `[mat:${v.type}:${v.name}]`;
    if (v.isObject3D) return `[obj:${v.type}:${v.name}]`;
    if (v.isBufferGeometry) return `[geo:${attr(v.attributes.position)}]`;
    if (v.isBufferAttribute || v.isInterleavedBufferAttribute) return attr(v);
    if (v instanceof Map) return `Map{${[...v.entries()].map(([k, x]) => ser(k, s, depth + 1) + ':' + ser(x, s, depth + 1)).join(',')}}`;
    if (v instanceof Set) return `Set{${[...v].map((x) => ser(x, s, depth + 1)).join(',')}}`;
    if (Array.isArray(v)) return `[${v.map((x) => ser(x, s, depth + 1)).join(',')}]`;
    const keys = Object.keys(v).sort();
    return `{${keys.map((k) => JSON.stringify(k) + ':' + ser(v[k], s, depth + 1)).join(',')}}`;
  }
  const SKIP_MAT = new Set(['uuid', 'id', 'version', '_listeners', 'onBeforeCompile', 'onBeforeRender', 'customProgramCacheKey']);
  const LIB = { MeshStandardMaterial: 'standard', MeshPhysicalMaterial: 'physical', MeshBasicMaterial: 'basic', MeshLambertMaterial: 'lambert', MeshPhongMaterial: 'phong', MeshToonMaterial: 'toon', PointsMaterial: 'points', SpriteMaterial: 'sprite', LineBasicMaterial: 'basic', MeshMatcapMaterial: 'matcap', MeshNormalMaterial: 'normal', MeshDepthMaterial: 'depth', MeshDistanceMaterial: 'distanceRGBA' };
  function material(m) {
    const parts = [m.type];
    for (const k of Object.keys(m).sort()) if (!SKIP_MAT.has(k)) parts.push(k + '=' + ser(m[k]));
    // a shader patch is compared by what it does to the shader, not by its source text
    if (m.onBeforeCompile && m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) {
      try {
        const lib = THREE.ShaderLib[LIB[m.type] ?? 'standard'] ?? THREE.ShaderLib.standard;
        const shader = { uniforms: THREE.UniformsUtils.clone(lib.uniforms), vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, defines: { ...(m.defines ?? {}) } };
        const before = new Set(Object.keys(shader.uniforms));
        m.onBeforeCompile(shader, {});
        const added = Object.keys(shader.uniforms).filter((k) => !before.has(k)).sort();
        parts.push(`obc(${hex(shader.vertexShader)},${hex(shader.fragmentShader)},${added.map((k) => k + ':' + ser(shader.uniforms[k]?.value)).join(';')},${ser(shader.defines)})`);
      } catch (e) { parts.push('obc-error:' + e.message); }
    }
    if (m.customProgramCacheKey && m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) {
      try { parts.push('key=' + m.customProgramCacheKey()); } catch (e) { parts.push('key-error:' + e.message); }
    }
    return parts.join('|');
  }
  function geometry(g) {
    const parts = [];
    for (const k of Object.keys(g.attributes).sort()) parts.push(k + '=' + attr(g.attributes[k]));
    parts.push('index=' + attr(g.index));
    parts.push('groups=' + JSON.stringify(g.groups), 'range=' + num(g.drawRange.start) + ',' + num(g.drawRange.count));
    for (const k of Object.keys(g.morphAttributes).sort()) parts.push('morph.' + k + '=' + g.morphAttributes[k].map(attr).join(','));
    parts.push('rel=' + g.morphTargetsRelative, 'ud=' + ser(g.userData));
    return parts.join('|');
  }
  /** hashes of one object tree: structure (with material/geometry sharing), geometry contents, material contents */
  function scene(root) {
    const tree = sha(), geo = sha(), mat = sha(), ud = sha();
    const mats = new Map(), geos = new Map();
    const matId = (m) => { if (!mats.has(m)) { mats.set(m, 'M' + mats.size); mat.update(material(m) + '\n'); } return mats.get(m); };
    const geoId = (g) => { if (!geos.has(g)) { geos.set(g, 'G' + geos.size); geo.update(geometry(g) + '\n'); } return geos.get(g); };
    (function walk(o, d) {
      const p = [d, o.type, o.name, o.visible, o.castShadow, o.receiveShadow, o.frustumCulled, o.renderOrder, o.matrixAutoUpdate, o.layers.mask,
        o.position.toArray().map(num), o.quaternion.toArray().map(num), o.scale.toArray().map(num)];
      if (o.geometry) p.push(geoId(o.geometry));
      if (o.material) p.push(Array.isArray(o.material) ? o.material.map(matId).join('+') : matId(o.material));
      if (o.isSkinnedMesh) p.push(o.bindMode, o.bindMatrix.toArray().map(num), o.skeleton.bones.map((b) => b.name).join('/'), o.skeleton.boneInverses.map((m) => m.toArray().map(num).join(',')).join(';'));
      if (o.isInstancedMesh) p.push(o.count, bytes(o.instanceMatrix.array), o.instanceColor ? bytes(o.instanceColor.array) : 'nocolor');
      if (o.isLight) p.push(ser(o.color), o.intensity, o.distance, o.decay, o.angle, o.penumbra);
      tree.update(p.join('|') + '\n');
      ud.update(d + ':' + ser(o.userData) + '\n');
      for (const c of o.children) walk(c, d + 1);
    })(root, 0);
    return { tree: tree.digest('hex').slice(0, 16), geo: geo.digest('hex').slice(0, 16), mat: mat.digest('hex').slice(0, 16), ud: ud.digest('hex').slice(0, 16) };
  }
  function clips(list) {
    return hex((list ?? []).map((c) => [c.name, num(c.duration), c.blendMode, ser(c.userData),
      ...c.tracks.map((t) => [t.name, t.constructor.name, t.getInterpolation(), bytes(t.times), bytes(t.values)].join(':'))].join('|')).join('\n'));
  }
  return { scene, clips, ser };
}

/* ───────────────────────── one worker: build its share of the catalog ───────────────────────── */
function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function seedOf(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

async function worker(shard, total) {
  const { createServer } = await import('vite');
  const server = await createServer({ root: ROOT, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } });
  const random = Math.random;
  try {
    const THREE = await import('three');
    const { CATALOG } = await server.ssrLoadModule('/src/assets/catalog.ts');
    const { buildModel } = await server.ssrLoadModule('/src/assets/builder.ts');
    const { loadModule } = await server.ssrLoadModule('/src/assets/modules.ts');
    // import every module up front: Vite's module runner draws ids from Math.random the first time it loads one
    for (const p of new Set(CATALOG.map((d) => d.path))) if (!p.startsWith('builtin:')) await loadModule(p);
    const H = makeHasher(THREE);
    const jobs = [];
    CATALOG.forEach((def, i) => { if (i % total === shard && (!ONLY || ONLY.has(def.id))) for (const q of TIERS) jobs.push([def, q]); });
    for (const [def, q] of jobs) {
      const key = `${def.id}|${q}`, t0 = performance.now();
      let out;
      // three.js draws every uuid from Math.random, so a cache filled by an earlier build would shift this build's
      // random numbers; uuids get a stream of their own and the app's and modules' calls see the same sequence however
      // the builds are ordered
      const own = mulberry(seedOf(key)), uuid = mulberry(1);
      Math.random = () => (/generateUUID|module-runner/.test(new Error().stack) ? uuid() : own());
      try {
        const m = await buildModel(def, {}, q, false, false);
        const s = H.scene(m.object);
        const meta = hex([m.height, m.radius, m.halfWidth, m.length, m.exhibitScale, m.legStroke, m.skinned, m.triangles, !!m.update, !!m.setNight].map(String).join('|'));
        const rig = hex(m.rig.map((r) => [r.name, r.node.name, r.axis, r.min, r.max, r.speed, r.phase, r.scale, r.role, r.base, r.hold].map(String).join(':')).join('\n'));
        const schema = hex(H.ser(m.schema));
        // the runtime hooks: night glow, water, swaying plants, emitters, schools and flocks
        if (m.setNight) m.setNight(0.6);
        if (m.update) { m.update(2); m.update(2.25); m.update(2.5); }
        m.object.updateMatrixWorld(true);
        const d = H.scene(m.object);
        const dyn = hex(d.tree + d.mat + d.ud);
        out = { ...s, clips: H.clips(m.clips), rig, schema, meta, dyn, tris: m.triangles };
      } catch (e) {
        out = { err: String(e?.message ?? e).slice(0, 300) };
      }
      Math.random = random;
      out.all = hex(JSON.stringify({ ...out, tris: undefined }));
      out.ms = Math.round(performance.now() - t0);
      process.stdout.write(JSON.stringify({ key, ...out }) + '\n');
    }
  } finally {
    Math.random = random;
    await server.close();
  }
}

/* ───────────────────────── main: fan out, gather, save or compare ───────────────────────── */
async function main() {
  const jobs = Math.max(1, Number(args.jobs ?? Math.min(4, os.cpus().length)));
  const extra = process.argv.slice(2).filter((a, i, all) => !['--save', '--compare', '--jobs'].includes(a) && !['--save', '--compare', '--jobs'].includes(all[i - 1]));
  const t0 = Date.now();
  const results = {};
  let done = 0, failed = false;
  await Promise.all(Array.from({ length: jobs }, (_, i) => new Promise((resolve) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--worker', `${i}/${jobs}`, ...extra], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line.startsWith('{')) continue;
        const r = JSON.parse(line);
        results[r.key] = r;
        if (++done % 50 === 0) process.stderr.write(`  ${done} builds…\n`);
      }
    });
    child.on('exit', (code) => { if (code) failed = true; resolve(); });
  })));
  const keys = Object.keys(results).sort();
  const errs = keys.filter((k) => results[k].err);
  console.log(`${keys.length} builds in ${((Date.now() - t0) / 1000).toFixed(0)} s${errs.length ? `, ${errs.length} failed to build` : ''}`);
  for (const k of errs) console.log(`  ERROR ${k}: ${results[k].err}`);
  const slow = keys.map((k) => [k, results[k].ms]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log('slowest: ' + slow.map(([k, ms]) => `${k} ${ms} ms`).join(', '));
  if (failed) { console.log('a worker exited with an error'); process.exitCode = 2; }
  const strip = (r) => { const { ms, key, ...rest } = r; return rest; };
  if (args.save) {
    fs.writeFileSync(String(args.save), JSON.stringify({ tiers: TIERS, results: Object.fromEntries(keys.map((k) => [k, strip(results[k])])) }, null, 1));
    console.log(`saved ${keys.length} fingerprints to ${args.save}`);
  }
  if (args.compare) {
    const base = JSON.parse(fs.readFileSync(String(args.compare), 'utf8')).results;
    const diff = [];
    for (const k of Object.keys(base).sort()) {
      if (ONLY && !ONLY.has(k.split('|')[0])) continue;
      const a = base[k], b = results[k];
      if (!b) { diff.push(`${k}: not built now`); continue; }
      if (a.all === b.all) continue;
      const parts = ['err', 'tree', 'geo', 'mat', 'ud', 'clips', 'rig', 'schema', 'meta', 'dyn'].filter((p) => a[p] !== b[p]);
      diff.push(`${k}: ${parts.join(', ')} differ${b.err ? ` (now: ${b.err})` : ''}`);
    }
    for (const k of keys) if (!base[k]) diff.push(`${k}: new (not in ${args.compare})`);
    if (diff.length) { console.log(`${diff.length} builds differ from ${args.compare}:`); for (const d of diff) console.log('  ' + d); process.exitCode = 1; }
    else console.log(`all ${keys.length} builds match ${args.compare}`);
  }
}

if (args.worker) {
  const [i, n] = String(args.worker).split('/').map(Number);
  await worker(i, n);
} else {
  await main();
}
