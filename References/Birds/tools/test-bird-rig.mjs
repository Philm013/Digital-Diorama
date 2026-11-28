/* Regression for the standalone bird rig (rewritten from field measurements in Digital Diorama revision 11).
 * Run: node tools/test-bird-rig.mjs
 *
 * Every species builds in every pose with finite geometry; standing poses keep everything above the ground (only
 * toes, claws and a resting tail touch it); the production merge is a handful of meshes; flightless birds have no
 * flight clips; the baked walk keeps each stance foot planted (it moves back at the clip's ground speed and stays
 * on the ground); options, colourways and `specOverride` build. */
import * as THREE from 'three';
import { createAsset, createClips, setPose, species, POSES, COLORWAYS } from '../src/assets/bird-rig.mjs';

const v = new THREE.Vector3();
function lowest(root) {
  root.updateMatrixWorld(true);
  let lo = Infinity;
  root.traverse(m => {
    if (!m.isMesh) return;
    const pa = m.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      if (m.isSkinnedMesh) m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld);
      else v.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld);
      if (!Number.isFinite(v.x + v.y + v.z)) throw new Error(`${root.userData.species}: non-finite vertex in ${m.name}`);
      lo = Math.min(lo, v.y);
    }
  });
  return lo;
}

/** Samples the baked walk through a mixer (as the app plays it) and returns the worst stance slip and lift. */
function walkSlip(asset, clip) {
  const mixer = new THREE.AnimationMixer(asset), act = mixer.clipAction(clip);
  act.play();
  const N = 80, dur = clip.duration, stride = clip.userData.stride, out = { slip: 0, lift: 0 };
  for (const side of ['L', 'R']) {
    const toe = asset.getObjectByName('Toe' + side), track = [];
    for (let i = 0; i <= N; i++) { mixer.setTime((i / N) * dur * 0.9999); asset.updateMatrixWorld(true); track.push(toe.getWorldPosition(new THREE.Vector3())); }
    const yMin = Math.min(...track.map(p => p.y));
    // the stance: samples whose foot is on the ground (within 1% of the hip height) and so are its neighbours
    const tol = 0.01 * clip.userData.hipH;
    for (let i = 1; i < N; i++) {
      if (![track[i - 1], track[i], track[i + 1]].every(p => p.y - yMin < tol)) continue;
      const dzdu = (track[i + 1].z - track[i - 1].z) / (2 / N);
      out.slip = Math.max(out.slip, Math.abs(dzdu + stride) / stride);
      out.lift = Math.max(out.lift, Math.abs(track[i].y - yMin));
    }
  }
  return out;
}

const FLIGHT = new Set(['flap', 'glide']);
const colorways = Object.keys(COLORWAYS);
let builds = 0, clipCount = 0, walks = 0;
for (const name of Object.keys(species)) {
  for (const pose of POSES) {
    const a = createAsset({ species: name, pose, rigMode: 'static', detail: 'draft' });
    const lo = lowest(a), H = a.userData.dimensions.height;
    if (!(H > 0)) throw new Error(`${name}/${pose}: empty model`);
    if (!FLIGHT.has(pose) && pose !== 'hop' && lo < -Math.max(0.002, 0.01 * H)) throw new Error(`${name}/${pose}: ${(lo * 100).toFixed(2)} cm below the ground`);
    builds++;
  }
  const prod = createAsset({ species: name, detail: 'draft', mergeForProduction: true });
  let meshes = 0; prod.traverse(m => { if (m.isMesh) meshes++; });
  if (meshes > 4) throw new Error(`${name}: production merge left ${meshes} meshes`);
  const clips = createClips(prod), names = clips.map(c => c.name);
  for (const c of clips) if (!(c instanceof THREE.AnimationClip) || !(c.duration > 0)) throw new Error(`${name}: invalid clip ${c.name}`);
  const flightless = ['penguin', 'ostrich', 'kiwi'].includes(name);
  for (const need of ['perch', 'walk', 'hop', 'peck', 'alert', ...(flightless ? [] : ['flap', 'glide'])]) if (!names.includes(need)) throw new Error(`${name}: missing clip ${need}`);
  if (flightless && (names.includes('flap') || names.includes('glide'))) throw new Error(`${name}: a flightless bird with flight clips`);
  clipCount += clips.length;
  const walk = clips.find(c => c.name === 'walk'), U = walk.userData;
  if (!(U.stride > 0 && U.speed > 0 && U.hipH > 0) || U.gait !== 'walk') throw new Error(`${name}: walk clip without stride metadata`);
  const { slip, lift } = walkSlip(prod, walk);
  if (slip > 0.06 || lift > 0.01 * U.hipH) throw new Error(`${name}: stance foot slips ${(slip * 100).toFixed(1)}% of the stride, lifts ${(lift * 1000).toFixed(1)} mm`);
  walks++;
  for (const pose of POSES) if (!setPose(prod, pose, 0.3)) throw new Error(`${name}: setPose ${pose} failed`);
  const tuned = createAsset({ species: name, detail: 'draft', size: 1.3, legLength: 1.2, neckLength: 0.8, headSize: 1.1, beakLength: 1.25, tailLength: 0.7, wingspan: 1.2,
    colorway: colorways[builds % colorways.length], coat: builds % 2 === 0, shading: 'flat', seed: 17 });
  lowest(tuned);
}
const red = createAsset({ species: 'crow', specOverride: { palette: { body: '#ff0000' } } });
if (red.userData.zones.body !== '#ff0000') throw new Error('specOverride palette ignored');
const long = createAsset({ species: 'crow', specOverride: { M: [48, 98, 32, 30, 6, 5.2, 2.0, 4.2, 2.2] } });
if (!(long.userData.dimensions.length > createAsset({ species: 'crow' }).userData.dimensions.length)) throw new Error('specOverride measurements ignored');

console.log(`Verified ${builds} posed builds of ${Object.keys(species).length} species above the ground, ${clipCount} clips, ${walks} walks with planted stance feet, options, colourways and specOverride.`);
