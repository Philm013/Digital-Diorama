/**
 * Asset review harness (dev only — not part of the production build).
 *
 * Renders catalog assets through the same builder the app uses (yaw correction,
 * quality tiers, clips, rig pivots) and lays them out as contact sheets so each
 * model can be checked by eye: orientation (the red marker shows +Z, the way
 * every animal must face), proportions, colours and detail.
 *
 *   review.html?cat=animals&group=Mammals&page=0&per=12
 *   review.html?ids=mammal/lion,bird/owl&views=front34,side,top&clip=walk
 *   review.html?family=plant&q=high
 *
 * tools/review-assets.mjs drives it with Playwright and saves the sheets as PNGs.
 */
import * as THREE from 'three';
import { CATALOG } from '../assets/catalog';
import { buildModel, exhibitScale, type BuiltModel } from '../assets/builder';
import type { AssetDef } from '../assets/types';
import type { Quality } from '../engine/types';

type Win = Window & { __REVIEW_DONE__?: boolean; __REVIEW_ERRORS__?: string[]; __REVIEW_PAGES__?: number; __REVIEW_LIST__?: string[] };
const win = window as Win;
const P = new URLSearchParams(location.search);
const ids = (P.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const cat = P.get('cat');
const group = P.get('group');
const family = P.get('family');
const match = P.get('match')?.toLowerCase();
const page = Number(P.get('page') ?? 0);
const per = Number(P.get('per') ?? 12);
const views = (P.get('views') ?? 'front34,side,top').split(',');
const W = Number(P.get('w') ?? 300), H = Number(P.get('h') ?? 240);
const wantClip = P.get('clip');
const clipTime = Number(P.get('t') ?? 0.6);
const quality = (P.get('q') ?? 'medium') as Quality;
const season = P.get('season');
document.documentElement.style.setProperty('--cols', P.get('cols') ?? '3');

// ?base=<catalog id>&v=[{...params}, ...] renders parameter variants of one asset (for tuning)
const variantBase = P.get('base');
const variants: Record<string, unknown>[] = P.get('v') ? JSON.parse(P.get('v')!) : [];
const variantParams = new Map<AssetDef, Record<string, unknown>>();
let list: AssetDef[] = variantBase ? variants.map((v, i) => {
  const b = CATALOG.find((d) => d.id === variantBase)!;
  const d: AssetDef = { ...b, id: `${b.id}#${i}`, name: `${b.name} · ${JSON.stringify(v).slice(1, -1).slice(0, 70)}` };
  variantParams.set(d, v);
  return d;
}) : ids.length ? ids.map((id) => CATALOG.find((d) => d.id === id)).filter((d): d is AssetDef => !!d) : CATALOG.filter((d) =>
  (!cat || d.category === cat) && (!group || d.group === group) && (!family || d.family === family) && (!match || (d.id + ' ' + d.name).toLowerCase().includes(match)));
const pages = Math.max(1, Math.ceil(list.length / per));
win.__REVIEW_PAGES__ = pages;
win.__REVIEW_LIST__ = list.map((d) => d.id);
if (!ids.length && !variantBase) list = list.slice(page * per, page * per + per);
win.__REVIEW_ERRORS__ = [];
document.getElementById('title')!.textContent = `— ${ids.length ? `${list.length} assets` : `page ${page + 1}/${pages}`} · ${[cat, group, family, match].filter(Boolean).join(' / ') || 'all'} · q=${quality}${wantClip ? ' · clip=' + wantClip : ''}`;
const status = document.getElementById('status')!;
const grid = document.getElementById('grid')!;

/* ---------------- studio ---------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(2);
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e9e4d8');
scene.add(new THREE.HemisphereLight('#dbe9f7', '#7a6a52', 1.15));
const key = new THREE.DirectionalLight('#fff3df', 2.4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight('#cfe0ff', 0.7);
scene.add(rim);
const ground = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d9d1c0', roughness: 1 }));
ground.receiveShadow = true;
scene.add(ground);
const camera = new THREE.PerspectiveCamera(30, W / H, 0.001, 5000);

const VIEW_DIRS: Record<string, THREE.Vector3> = {
  front34: new THREE.Vector3(0.85, 0.42, 1),
  front: new THREE.Vector3(0, 0.18, 1),
  side: new THREE.Vector3(1, 0.1, 0),
  back34: new THREE.Vector3(-0.85, 0.42, -1),
  top: new THREE.Vector3(0, 1, 0.0001),
  low: new THREE.Vector3(0.9, 0.05, 0.7),
};

function niceStep(size: number) {
  const raw = size / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n < 2 ? 1 : n < 5 ? 2 : 5) * p;
}

function disposeTree(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.geometry?.dispose();
      // materials may be shared by the prototype cache; leave them
    }
  });
}

async function shoot(def: AssetDef, idx: number) {
  const card = document.createElement('div');
  card.className = 'card';
  grid.appendChild(card);
  const head = document.createElement('div');
  head.className = 'head';
  head.innerHTML = `<span class="idx">${page * per + idx + 1}</span><b>${def.emoji} ${def.name}</b><small>${def.id}<br>${def.info.scientific ?? ''}</small>`;
  card.appendChild(head);
  let model: BuiltModel | null = null;
  const extra: THREE.Object3D[] = [];
  try {
    const params: Record<string, unknown> = { ...(variantParams.get(def) ?? {}) };
    if (season && def.family === 'deciduous') params.leafHueAndSeason = season;
    model = await buildModel(def, params, quality, true);
    const obj = model.object;
    scene.add(obj);
    let clipName = '';
    let mixer: THREE.AnimationMixer | null = null;
    if (model.clips.length) {
      mixer = new THREE.AnimationMixer(model.raw);
      const names = model.clips.map((c) => c.name);
      clipName = wantClip && names.includes(wantClip) ? wantClip : names.includes('idle') ? 'idle' : names.includes('perch') ? 'perch' : names[0];
      mixer.clipAction(model.clips.find((c) => c.name === clipName)!).play();
      mixer.update(clipTime);
    }
    model.update?.(clipTime + 1);
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj, model.skinned);
    if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const r = Math.max(sphere.radius, 1e-4);
    // ground + scale grid + front marker
    ground.scale.setScalar(r * 6);
    ground.position.y = Math.min(0, box.min.y) - r * 0.002;
    const step = niceStep(Math.max(size.x, size.z, size.y));
    const gridSize = step * 12;
    const gh = new THREE.GridHelper(gridSize, 12, '#b5aa94', '#c9c0ad');
    gh.position.y = ground.position.y + r * 0.001;
    scene.add(gh); extra.push(gh);
    const marker = new THREE.Mesh(new THREE.ConeGeometry(r * 0.06, r * 0.18, 3).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#e0342b' }));
    marker.position.set(center.x, ground.position.y + r * 0.02, box.max.z + r * 0.14);
    scene.add(marker); extra.push(marker);
    // lights follow the model size
    key.position.set(center.x + r * 2.2, center.y + r * 3.4, center.z + r * 2.6);
    key.target.position.copy(center);
    const sc = key.shadow.camera as THREE.OrthographicCamera;
    sc.left = sc.bottom = -r * 2; sc.right = sc.top = r * 2; sc.near = r * 0.1; sc.far = r * 10;
    sc.updateProjectionMatrix();
    rim.position.set(center.x - r * 3, center.y + r, center.z - r * 2);
    const imgs = document.createElement('div');
    imgs.className = 'imgs';
    card.appendChild(imgs);
    for (const v of views) {
      const dir = (VIEW_DIRS[v] ?? VIEW_DIRS.front34).clone().normalize();
      const dist = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * (v === 'top' ? 0.92 : 0.98);
      camera.position.copy(center).addScaledVector(dir, dist);
      camera.near = dist / 100; camera.far = dist * 10;
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      const fig = document.createElement('figure');
      const img = document.createElement('img');
      img.src = renderer.domElement.toDataURL('image/png');
      const cap = document.createElement('figcaption');
      cap.textContent = v;
      fig.append(img, cap);
      imgs.appendChild(fig);
    }
    const len = Math.max(size.x, size.z);
    const ex = def.scale ?? (def.category === 'animals' && def.family !== 'water' && def.family !== 'aquarium' ? exhibitScale(len) : 1);
    const meta = document.createElement('div');
    meta.className = 'meta';
    const fmt = (n: number) => (n >= 1 ? n.toFixed(2) + ' m' : n >= 0.01 ? (n * 100).toFixed(1) + ' cm' : (n * 1000).toFixed(2) + ' mm');
    meta.textContent = `${def.family} · ${def.loco}${def.water ? '/' + def.water : ''} · ${model.triangles.toLocaleString()} tris · L${fmt(size.z)} W${fmt(size.x)} H${fmt(size.y)} · shown ×${ex.toFixed(ex < 10 ? 1 : 0)}` +
      (clipName ? ` · clip ${clipName} [${model.clips.map((c) => c.name).join(' ')}]` : '') + (model.rig.length ? ` · rig ${model.rig.length}` : '') + ` · biomes: ${def.biomes.join(' ') || '—'}`;
    card.appendChild(meta);
    mixer?.stopAllAction();
  } catch (e) {
    card.classList.add('err');
    const msg = document.createElement('div');
    msg.className = 'msg';
    msg.textContent = String((e as Error)?.stack ?? e).slice(0, 600);
    card.appendChild(msg);
    win.__REVIEW_ERRORS__!.push(`${def.id}: ${(e as Error)?.message ?? e}`);
  } finally {
    if (model) { scene.remove(model.object); disposeTree(model.object); }
    for (const x of extra) { scene.remove(x); disposeTree(x); }
  }
}

(async () => {
  for (let i = 0; i < list.length; i++) {
    status.textContent = `Rendering ${i + 1}/${list.length}: ${list[i].name}`;
    await shoot(list[i], i);
    await new Promise((r) => setTimeout(r, 0));
  }
  status.textContent = `Done — ${list.length} assets, ${win.__REVIEW_ERRORS__!.length} errors`;
  win.__REVIEW_DONE__ = true;
})();
