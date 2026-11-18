/* Head/bill proportion report. Run: node tools/measure-heads.mjs species1,species2 */
import * as THREE from 'three';
import { createAsset } from '../src/assets/bird-rig.mjs';
const list = (process.argv[2] || 'sparrow,cardinal,robin,hummingbird,macaw,toucan,pelican').split(',');
const boxOf = (a, names) => { const b = new THREE.Box3(); a.traverse(m => { if (m.isMesh && names.includes(m.userData.part)) { m.geometry.computeBoundingBox(); b.union(m.geometry.boundingBox); } }); return b; };
console.log('species      headW/bodyW headH/bodyH  bill/skull  billDepth/headH billW/billDepth');
for (const sp of list) {
  const a = createAsset({ species: sp, rigMode: 'static', detail: 'standard', mergeForProduction: false });
  const body = boxOf(a, ['body']).getSize(new THREE.Vector3()), head = boxOf(a, ['head']).getSize(new THREE.Vector3());
  const hb = boxOf(a, ['head']), bb = boxOf(a, ['beak']);
  // bill measured in the side plane: length along z beyond the skull, depth in y, width in x
  const billLen = Math.max(0, bb.max.z - hb.max.z) + (hb.max.z - bb.min.z > 0 ? 0 : 0);
  const skullLen = hb.max.z - hb.min.z, bill = bb.getSize(new THREE.Vector3());
  console.log(sp.padEnd(12), (head.x / body.x).toFixed(2).padStart(10), (head.y / body.y).toFixed(2).padStart(11),
    (bill.z / skullLen).toFixed(2).padStart(11), (bill.y / head.y).toFixed(2).padStart(15), (bill.x / bill.y).toFixed(2).padStart(15));
}
