// Developer harness: renders a biome directly without the UI (used for automated visual checks).
import { Engine } from './engine/Engine';
import { newDocById } from './biomes/factory';
import type { Quality } from './engine/types';

const root = document.getElementById('root')!;
root.style.position = 'relative';
const params = new URLSearchParams(location.search);
const q = (params.get('q') as Quality) || 'medium';
const engine = new Engine(root, q);
(window as any).__engine = engine;
engine.on((e) => { if (e.type === 'toast') console.log('TOAST', e.text); if (e.type === 'loaded') (window as any).__loaded = true; });
const biome = params.get('biome') || 'forest';
const doc = newDocById(biome, q);
const lineup = params.get('lineup');
if (lineup) {
  const ids = lineup.split(',');
  doc.actors = [];
  doc.env.labels = true;
  const gap = Number(params.get('gap') || 2.6);
  ids.forEach((id, i) => {
    const x = (i - (ids.length - 1) / 2) * gap, z = 4;
    doc.actors.push({ id: 'l' + i, asset: id, name: id.split('/')[1], params: {}, pos: [x, 0, z], rotY: 0, scale: 1, lift: 0, grounded: true, label: { show: true } });
  });
}
const frame = params.get('frame');
if (frame) doc.env.frame = frame as any;
const time = params.get('time');
if (time) doc.env.time = Number(time);
if (params.get('labels')) doc.env.labels = true;
engine.load(doc).then(async () => {
  if (params.get('raw')) {
    const { loadModule } = await import('./assets/modules');
    const m: any = await loadModule('/References/parametric-conifer.mjs');
    const THREE = await import('three');
    const a = m.createAsset({ speciesProfile: 'fir', mergeForProduction: true, needleDetailLevel: 'high', foliageDensity: 1, needleLengthScale: 1.8 });
    a.position.set(-6, 0, 0); engine.scene.add(a);
    const b = m.createAsset({ speciesProfile: 'stylized', mergeForProduction: true, foliageDensity: 1, needleLengthScale: 1.8 });
    b.position.set(0, 0, 0); engine.scene.add(b);
    const c = m.createAsset({ speciesProfile: 'cedar', mergeForProduction: true, needleDetailLevel: 'high', foliageDensity: 1 });
    c.position.set(6, 0, 0); engine.scene.add(c);
    let n = 0; a.traverse((o: any) => { if (o.isMesh) n++; });
    console.log('raw meshes', n, new THREE.Box3().setFromObject(a).getSize(new THREE.Vector3()).toArray());
    engine.camera.position.set(0, 8, 22); engine.controls.target.set(0, 5, 0);
  }
  const focus = params.get('focus');
  if (focus) {
    const a = engine.actorList.find((x) => x.def.id.includes(focus));
    if (a) { engine.ambientOff = true; engine.focusActor(a.id, 0.01); }
  }
}).catch((e) => console.error('LOAD FAILED', e));
