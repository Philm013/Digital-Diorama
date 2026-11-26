import * as THREE from 'three';
import { getDef } from '../assets/catalog';
import { buildModel } from '../assets/builder';

/**
 * Little 3D portraits of catalog assets for the library and field cards.
 * Rendered one at a time in the background with a private renderer, then kept
 * in memory and in IndexedDB so they appear instantly next time.
 */
const VERSION = 'v6';
const SIZE = 168;
const mem = new Map<string, string>();
const waiting = new Map<string, Set<(url: string) => void>>();
const queue: string[] = [];
let running = false;
let R: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; key: THREE.DirectionalLight } | null = null;

function studio() {
  if (R) return R;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#e4effa', '#7a6a52', 1.35));
  const key = new THREE.DirectionalLight('#fff4e2', 2.3);
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#cfe0ff', 0.9);
  rim.position.set(-3, 2, -4);
  scene.add(rim);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.001, 5000);
  R = { renderer, scene, camera, key };
  return R;
}

/* ---------------- tiny IndexedDB cache ---------------- */
let dbp: Promise<IDBDatabase | null> | null = null;
function db() {
  if (!dbp) dbp = new Promise((res) => {
    try {
      const r = indexedDB.open('dd-thumbs', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('t');
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch { res(null); }
  });
  return dbp;
}
async function idbGet(k: string): Promise<string | undefined> {
  const d = await db();
  if (!d) return undefined;
  return new Promise((res) => { try { const q = d.transaction('t').objectStore('t').get(k); q.onsuccess = () => res(q.result as string | undefined); q.onerror = () => res(undefined); } catch { res(undefined); } });
}
async function idbPut(k: string, v: string) {
  const d = await db();
  if (!d) return;
  try { d.transaction('t', 'readwrite').objectStore('t').put(v, k); } catch { /* full or blocked */ }
}

async function render(id: string): Promise<string> {
  const def = getDef(id);
  if (!def) return '';
  const S = studio();
  const model = await buildModel(def, {}, 'low', true, false);
  const obj = model.object;
  if (model.clips.length) {
    const mixer = new THREE.AnimationMixer(model.raw);
    const clip = model.clips.find((c) => c.name === 'idle') ?? model.clips.find((c) => c.name === 'perch') ?? model.clips[0];
    mixer.clipAction(clip).play();
    mixer.update(0.6);
  }
  model.update?.(1.5);
  S.scene.add(obj);
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj, model.skinned);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const r = Math.max(1e-4, sphere.radius);
  const dir = new THREE.Vector3(0.9, 0.45, 1).normalize();
  const dist = r / Math.sin(THREE.MathUtils.degToRad(S.camera.fov / 2)) * 0.92;
  S.camera.position.copy(sphere.center).addScaledVector(dir, dist);
  S.camera.near = dist / 100; S.camera.far = dist * 10;
  S.camera.lookAt(sphere.center);
  S.camera.updateProjectionMatrix();
  S.key.position.copy(sphere.center).add(new THREE.Vector3(r * 2, r * 3.5, r * 2.5));
  S.key.target.position.copy(sphere.center);
  S.renderer.render(S.scene, S.camera);
  const url = S.renderer.domElement.toDataURL('image/webp', 0.86);
  S.scene.remove(obj);
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry?.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (!mat) continue;
      // per-model textures (the rigs' painted coats) go too
      for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
      mat.dispose();
    }
  });
  return url;
}

async function pump() {
  if (running) return;
  running = true;
  while (queue.length) {
    const id = queue.pop()!;
    const subs = waiting.get(id);
    if (!subs || !subs.size || mem.has(id)) { if (mem.has(id) && subs) for (const cb of subs) cb(mem.get(id)!); waiting.delete(id); continue; }
    let url = await idbGet(`${VERSION}:${id}`);
    if (!url) {
      try { url = await render(id); } catch (e) { console.warn('thumb failed', id, e); url = ''; }
      if (url) void idbPut(`${VERSION}:${id}`, url);
      await new Promise((r) => setTimeout(r, 24));
    }
    mem.set(id, url);
    for (const cb of waiting.get(id) ?? []) cb(url);
    waiting.delete(id);
  }
  running = false;
}

export const cachedThumb = (id: string) => mem.get(id);

/** ask for a thumbnail; the newest request is served first. Returns a cancel function. */
export function requestThumb(id: string, cb: (url: string) => void) {
  const hit = mem.get(id);
  if (hit !== undefined) { cb(hit); return () => {}; }
  let set = waiting.get(id);
  if (!set) { set = new Set(); waiting.set(id, set); }
  set.add(cb);
  const i = queue.indexOf(id);
  if (i >= 0) queue.splice(i, 1);
  queue.push(id);
  void pump();
  return () => { waiting.get(id)?.delete(cb); };
}
