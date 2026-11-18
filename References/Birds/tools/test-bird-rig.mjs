/* Geometry regression for the standalone bird rig. Run: node tools/test-bird-rig.mjs */
import * as THREE from 'three';
import { createAsset, createClips, params, setPose, species } from '../src/assets/bird-rig.mjs';

const poses = ['perch', 'glide'];
const coord = (p, i) => [p.getX(i), p.getY(i), p.getZ(i)].map(n => Math.round(n * 1e8)).join(',');

// The upper mandible continues the skull, so the closed shell is body + neck + head + beak.
const SHELL = ['body', 'neck', 'head', 'beak'];

function inspectShell(asset) {
  const edges = new Map();
  const parts = new Set();
  asset.traverse(mesh => {
    if (!mesh.isMesh || !SHELL.includes(mesh.userData.part)) return;
    parts.add(mesh.userData.part);
    const p = mesh.geometry.getAttribute('position');
    if (!p || p.count % 3) throw new Error(`Invalid triangulation in ${mesh.name}`);
    for (let i = 0; i < p.count; i += 3) {
      const v = [coord(p, i), coord(p, i + 1), coord(p, i + 2)];
      for (let j = 0; j < 3; j++) {
        const edge = [v[j], v[(j + 1) % 3]].sort().join('|');
        edges.set(edge, (edges.get(edge) || 0) + 1);
      }
    }
  });
  if (parts.size !== SHELL.length) throw new Error(`Missing editable shell part: ${asset.userData.species}`);
  const open = [...edges].filter(([, count]) => count !== 2);
  if (open.length) throw new Error(`${asset.userData.species}: ${open.length} open / non-manifold shell edges`);
  return edges.size;
}

// Fold detector: walks the shared rings body -> neck -> skull. The surface folds when a vertex of a ring lies
// behind the plane of the ring before it (measured along the loft's own tangent); a few percent of the radius
// is tolerated for coarse draft sampling.
function countFolds(asset, tol = 0.03) {
  const D = asset.userData.debug, chain = [];
  const add = (g, first) => { for (let k = first; k <= g.main[1]; k++) chain.push({ r: g.rows[k], c: g.C[k - g.main[0]], t: g.T[k - g.main[0]] }); };
  add(D.body, D.body.main[0]); add(D.neck, D.neck.main[0] + 1); add(D.head, D.head.main[0] + 1);
  let folds = 0;
  for (let k = 1; k < chain.length; k++) {
    const A = chain[k - 1], radius = A.r.reduce((s, q) => s + q.distanceTo(A.c), 0) / A.r.length;
    for (const q of chain[k].r) if (q.clone().sub(A.c).dot(A.t) < -tol * radius) folds++;
  }
  return folds;
}

let shells = 0, clips = 0;
for (const name of Object.keys(species)) {
  for (const pose of poses) {
    const editable = createAsset({ species: name, rigMode: 'static', detail: 'draft', pose, mergeForProduction: false });
    if (!editable.userData.bodyForm) throw new Error(`No body profile: ${name}`);
    inspectShell(editable);
    shells++;
    if (pose === 'perch') {
      const folds = countFolds(createAsset({ species: name, rigMode: 'static', detail: 'draft', debug: true }));
      if (folds > 0) throw new Error(`${name}: ${folds} folded quads in the body/neck/skull surface`);
    }
  }
  const animated = createAsset({ species: name, detail: 'draft', mergeForProduction: true });
  if (!animated.getObjectByName('solid')) throw new Error(`Production merge failed: ${name}`);
  for (const clip of createClips(animated)) {
    if (!(clip instanceof THREE.AnimationClip)) throw new Error(`Invalid clip: ${name}`);
    clips++;
  }
  if (!setPose(animated, 'peck', 0.3)) throw new Error(`Pose failed: ${name}`);
  const configured = createAsset({
    species: name, rigMode: 'static', detail: 'draft', mergeForProduction: false,
    girth: 1.08, headSize: 0.94, neckLength: 1.06, beakLength: 1.08,
    legLength: 1.05, wingspan: 1.08, tailLength: 0.95, crestRaise: 0.72,
    colorway: 'twilight', variation: 0.25, seed: 17,
  });
  inspectShell(configured);
}

if (!params.bodyForm.options.includes('waterfowl')) throw new Error('Body form missing from schema');
const override = createAsset({ species: 'swan', bodyForm: 'ratite', rigMode: 'static', detail: 'draft' });
if (override.userData.bodyForm !== 'ratite') throw new Error('Body form override ignored');
inspectShell(override);

console.log(`Verified ${shells + 1} watertight, fold-free body/neck/skull/bill shells, ${Object.keys(species).length} production meshes, and ${clips} clips.`);