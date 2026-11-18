import * as M from '../src/assets/animals/mammal-rig.mjs';
const t0 = Date.now();
for (const k of Object.keys(M.species)) {
  try { const a = M.createAsset({ species: k, rigMode: 'static', mergeForProduction: true }); const d = a.userData.dimensions; console.log(k.padEnd(10), String(a.userData.triangles).padStart(6), 'L', d.length, 'H', d.height, 'W', d.width, 'miny', d.min[1]); }
  catch (e) { console.log('FAIL', k, e.message, e.stack.split('\n')[1]); }
}
const h = M.createAsset({ species: 'horse' }); console.log('clips', M.createClips(h).map(c => c.name + ':' + c.tracks.length).join(' '));
console.log('ms', Date.now() - t0);
