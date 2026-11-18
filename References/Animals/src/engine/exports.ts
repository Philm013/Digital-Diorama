import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { strToU8, zipSync } from 'fflate';
import assetSource from './animal.mjs?raw';
import { createAsset } from './animal.mjs';
import { ANIMALS, TAXONOMY_NOTE, type Animal, type AnimalOptions } from '../data/catalog';
import { disposeObject, downloadBlob, getColorways, makeAnimal } from './studio';

const ZONES = ['skin', 'underside', 'dark', 'accent', 'detail', 'glass'];
const BUILDERS: Record<string, string> = {
  mammal: 'mammal', bird: 'bird', fish: 'fish', reptile: 'reptile', frog: 'frog', snake: 'snake', butterfly: 'butterfly',
  beetle: 'arthropod', spider: 'arthropod', crab: 'arthropod', scorpion: 'arthropod',
  octopus: 'mollusk', snail: 'mollusk', slug: 'mollusk', jellyfish: 'radialAnimal', combJelly: 'radialAnimal',
  anemone: 'radialAnimal', starfish: 'radialAnimal', urchin: 'radialAnimal', sponge: 'sponge', worm: 'worm',
  waterBear: 'lobopod', velvetWorm: 'lobopod', centipede: 'lobopod', colony: 'colony', coral: 'colony',
  bivalve: 'bivalve', microscopic: 'microscopic', arrowWorm: 'arrowWorm', placozoan: 'placozoan',
};
export type ExportFormat = 'bundle' | 'module' | 'glb' | 'collection';

export function standaloneSource(animal: Animal, options: AnimalOptions = {}, hiddenParts: string[] = []) {
  const palette = getColorways(animal as unknown as Record<string, unknown>)[String(options.colorway || 'natural')];
  const defaults: AnimalOptions = { ...animal.defaults, ...options, colorway: 'natural' };
  for (const key of ZONES) delete (defaults as AnimalOptions)[key];
  const config = { ...animal, palette: ZONES.map(key => String(options[key] || palette[key])), defaults, hiddenParts };
  const model = createAsset({ __animal: config, mergeForProduction: true });
  const dimensions = (model.userData.dimensions as number[]).map(value => Number(value.toPrecision(5))).join(' x ');
  const triangles = model.userData.triangles, materials = model.userData.materialCount;
  const targets = Object.keys(model.userData.rig).join(', '), detachable = (model.userData.detach as string[]).slice(0, 24).join(', ');
  disposeObject(model);
  const header = `/**
 * WILDFORM / ${animal.name.toUpperCase()} (High Detail)
 * ${animal.scientific} | ${animal.phylum}
 * Parametric wildlife for Three.js. No textures, loaders, or shared modules.
 *
 * QUICK START
 *   import { createAsset } from './${animal.id}.mjs';
 *   scene.add(createAsset({ mergeForProduction: true }));
 *
 * SPECS  ${Math.round(triangles)} triangles at the exported defaults; ${materials} material(s).
 *        Exact default bounds: ${dimensions} m (width x height x depth).
 * OPTIONS  Every configurable value is documented in the exported params schema.
 *          Dimensions rebuild geometry; mergeForProduction defaults to ${String(defaults.mergeForProduction ?? false)}.
 * PARTS  animate: ${targets}
 *        detach: ${detachable}
 *        All individual meshes remain selectable when not merged.
 * LICENSE  Generated geometry and this module: CC0 1.0 Universal.
 * NOTE  Stylized body-plan study, not an anatomical or diagnostic reference.
 */`;
  let source = assetSource.replace(/^\/\*\*[\s\S]*?\*\//, header).replace(/\/\* ASSET_CONFIG_START \*\/[\s\S]*?\/\* ASSET_CONFIG_END \*\//, `const ASSET = ${JSON.stringify(config, null, 2)};`);
  // Keep only this animal's anatomy builder, but retain every helper inline.
  const builder = BUILDERS[animal.bodyPlan];
  for (const other of new Set(Object.values(BUILDERS))) {
    if (other === builder) continue;
    const start = source.indexOf(`\nfunction ${other}(`);
    if (start < 0) continue;
    const next = source.slice(start + 1).search(/\n(?:function|export function) /);
    if (next < 0) throw new Error(`Unable to isolate the ${animal.name} module.`);
    source = source.slice(0, start) + source.slice(start + 1 + next);
  }
  return source.replace(/^  const builders = \{[^\n]+\};/m, `  const builders = { ${JSON.stringify(animal.bodyPlan)}: ${builder} };`);
}

function sceneSource(animals: Animal[]) {
  const imports = animals.map((animal, index) => `import * as asset${index} from './${animal.id}.mjs';`).join('\n');
  return `/** Wildform field collection. Pure composition; each animal is independently reusable. */
import * as THREE from 'three';
${imports}

export const assets = [
${animals.map((animal, index) => `  { id: ${JSON.stringify(animal.id)}, name: ${JSON.stringify(animal.name)}, scientific: ${JSON.stringify(animal.scientific)}, module: asset${index} }`).join(',\n')}
];

export function createScene(scene) {
  const columns = Math.ceil(Math.sqrt(assets.length));
  return assets.map((definition, index) => {
    const model = definition.module.createAsset();
    const bounds = new THREE.Box3().setFromObject(model);
    const dimensions = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const root = new THREE.Group(); root.name = definition.id + '-display';
    const displayScale = 1.75 / Math.max(dimensions.x, dimensions.y, dimensions.z);
    model.position.sub(center); root.add(model); root.scale.setScalar(displayScale);
    root.position.set((index % columns - (columns - 1) / 2) * 2.5, dimensions.y * displayScale / 2, (Math.floor(index / columns) - (Math.ceil(assets.length / columns) - 1) / 2) * 2.5);
    root.userData = { displayScale, note: 'Display normalization only. The model module uses meters.' };
    scene.add(root);
    return { ...definition, model, root, values: {} };
  });
}
export default createScene;
`;
}

function previewHtml(title: string, collection: boolean) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#f4f4ee"><title>${title.replace(/[<>]/g, '')} | Wildform</title>
<style>
*{box-sizing:border-box}body{margin:0;font:13px system-ui,-apple-system,sans-serif;color:#29352d;background:#f4f4ee}button,input,select{font:inherit}button,select,input[type=checkbox],input[type=color]{cursor:pointer}header{height:66px;padding:0 26px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #dedfd6;background:#fff}header strong{font-size:25px;letter-spacing:-1.4px}header small{color:#858b7f;font-size:11px;letter-spacing:1.5px}main{display:grid;grid-template-columns:280px 1fr;height:calc(100dvh - 66px)}aside{background:#fcfcf8;border-right:1px solid #dedfd6;padding:24px;overflow:auto}h1{font-size:21px;letter-spacing:-.5px;margin:0 0 5px}.latin{color:#83877d;font-style:italic;font-size:12px;margin:0 0 24px}h2{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#888d80;margin:27px 0 17px}label.control{display:block;margin:0 0 19px}.label{display:flex;align-items:center;justify-content:space-between;margin:0 0 9px;font-size:12px}.value{color:#828978;font-size:11px;font-variant-numeric:tabular-nums}input[type=range]{width:100%;accent-color:#60734b;height:4px}input[type=color]{width:100%;height:29px;border:1px solid #dce0d3;padding:3px;background:#fff;border-radius:4px}select{width:100%;padding:10px;border:1px solid #dce0d3;border-radius:5px;background:#fff;color:#34412f}.check{display:flex;gap:9px;align-items:center;margin:14px 0}input[type=checkbox]{accent-color:#60734b}.actions{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}button{border:1px solid #d8ddcf;border-radius:5px;padding:9px 13px;background:#fff;color:#35452f}button:hover{background:#ecf0e5}.primary{background:#526748;color:#fff;border-color:#526748}.note{font-size:10px;line-height:1.7;color:#969b8c}#viewport{position:relative;min-width:0;min-height:0}canvas{display:block;width:100%;height:100%;touch-action:none}.hud{position:absolute;pointer-events:none;left:24px;right:24px;bottom:22px;display:flex;justify-content:space-between;color:#89917e;font-size:10px}.toplabel{position:absolute;top:25px;left:25px;font-size:10px;letter-spacing:1.7px;color:#89917e;pointer-events:none}#error{position:absolute;inset:20%;display:none;place-content:center;line-height:1.8;color:#95664e}hr{border:0;border-top:1px solid #e2e5d9;margin:23px 0}@media(max-width:700px){header{height:56px;padding:0 18px}main{height:calc(100dvh - 56px);grid-template-columns:1fr;grid-template-rows:minmax(330px,60%) 1fr}aside{grid-row:2;border-right:0;border-top:1px solid #dedfd6;padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:0 24px}aside>h1,aside>.latin,aside>h2,aside>select,aside>#parameters,aside>hr{grid-column:1/-1}#parameters{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}.hud{left:16px;right:16px;font-size:9px}.toplabel{top:17px;left:17px}}
</style>
<script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.180.0/build/three.module.js","three/addons/":"https://unpkg.com/three@0.180.0/examples/jsm/"}}</script>
</head>
<body>
<header><strong>wildform<span style="color:#789365">.</span></strong><small>THE FIELD STUDIO</small></header>
<main><aside><h1 id="animal-name">${title.replace(/[<>]/g, '')}</h1><p class="latin" id="scientific">A little closer to the wild.</p><h2>Scene parts</h2><select id="animal-select" aria-label="Select an animal"></select><h2>Make it your own</h2><div id="parameters"></div><hr><h2>Studio</h2><label class="check"><input id="assembly" type="checkbox" ${collection ? 'checked' : ''}> Show the collection</label><label class="check"><input id="night" type="checkbox"> Night lighting</label><label class="check"><input id="grid" type="checkbox" checked> Ground grid</label><label class="check"><input id="rotate" type="checkbox"> Auto rotate</label><label class="check"><input id="animate" type="checkbox"> Animate parts</label><label class="check"><input id="wireframe" type="checkbox"> Wireframe</label><div class="actions"><button id="reset">Reset animal</button><button id="frame">Frame view</button><button class="primary" id="snapshot">Save image</button></div><p class="note">Drag to orbit. Scroll or pinch to zoom.<br>Each animal module is authored in meters. The collection view normalizes display sizes for comparison.<br>Generated models: CC0 1.0.</p></aside>
<section id="viewport"><div class="toplabel">${collection ? 'THE ANIMAL KINGDOM' : 'A STUDY IN THE WILD'}</div><div class="hud"><span id="stats"></span><span>PROCEDURAL WILDLIFE / WILDFORM</span></div><div id="error"></div></section></main>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createScene, assets } from './scene.mjs';
const el = id => document.getElementById(id);
const viewport = el('viewport');
try {
const renderer = new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.3; viewport.prepend(renderer.domElement);
const scene = new THREE.Scene(); scene.background=new THREE.Color('#f0f0e9');
const camera = new THREE.PerspectiveCamera(36,1,0.01,300); camera.position.set(4,3,6);
const controls = new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.dampingFactor=.065; controls.maxPolarAngle=Math.PI/2-.02; controls.autoRotateSpeed=.7;
const hemisphere = new THREE.HemisphereLight(0xffffff,0x747a65,1.8);scene.add(hemisphere);
const key = new THREE.DirectionalLight(0xfff5df,2.7);key.position.set(-4,9,6);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-20;key.shadow.camera.right=20;key.shadow.camera.top=20;key.shadow.camera.bottom=-20;key.shadow.camera.far=60;key.shadow.normalBias=.012;scene.add(key);
const fill=new THREE.DirectionalLight(0xc6daed,.8);fill.position.set(5,5,-6);scene.add(fill);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#efefe8',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.012;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(70,140,0xc4cbbb,0xd9dccf);grid.position.y=-.01;scene.add(grid);
const entries=createScene(scene); let selected=0;
const dispose = object => {const gs=new Set(),ms=new Set();object.traverse(o=>{if(o.isMesh){gs.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>ms.add(m));}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());};
for(const [i,entry] of entries.entries()){const option=document.createElement('option');option.value=String(i);option.textContent=entry.name;el('animal-select').append(option);}
function visible(){entries.forEach((e,i)=>e.root.visible=el('assembly').checked||i===selected);}
function frame(){const bounds=new THREE.Box3();entries.forEach(e=>{if(e.root.visible)bounds.expandByObject(e.root)});const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),r=Math.max(size.x,size.y,size.z,1);controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(r*1.05,r*.77,r*1.58));camera.near=.001;camera.far=Math.max(100,r*20);camera.updateProjectionMatrix();controls.update();}
function appearance(){const night=el('night').checked;scene.background.set(night?'#25352f':'#f0f0e9');ground.material.color.set(night?'#25352f':'#efefe8');hemisphere.intensity=night ? .7 : 1.8;key.intensity=night?1.2:2.7;key.color.set(night?'#b7cee9':'#fff5df');grid.visible=el('grid').checked;entries.forEach(entry=>{const cache=new Map(),oldMaterials=new Set();entry.model.traverse(o=>{if(!o.isMesh)return;const zone=o.userData.zone||'mixed',original=o.material,key=(night?zone:'day')+original.transparent;oldMaterials.add(original);let mat=cache.get(key);if(!mat){mat=original.clone();mat.wireframe=el('wireframe').checked;const info=entry.module.night[zone];mat.emissive.set(night&&info?info.color:'#000000');mat.emissiveIntensity=night&&info?info.intensity:0;cache.set(key,mat);}o.material=mat;});oldMaterials.forEach(material=>material.dispose());});}
function rebuild(){const entry=entries[selected];entry.root.remove(entry.model);dispose(entry.model);const model=entry.module.createAsset(entry.values),bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),scale=1.75/Math.max(size.x,size.y,size.z);model.position.sub(center);entry.root.scale.setScalar(scale);entry.root.position.y=size.y*scale/2;entry.root.add(model);entry.model=model;appearance();el('stats').textContent=Math.round(model.userData.triangles).toLocaleString()+' triangles / '+model.userData.materialCount+' material(s)';}
function renderControls(){const entry=entries[selected];el('animal-name').textContent=entry.name;el('scientific').textContent=entry.scientific;el('parameters').replaceChildren();for(const [name,param] of Object.entries(entry.module.params)){const label=document.createElement('label');label.className='control';label.title=param.describe;const top=document.createElement('span');top.className='label';const text=document.createElement('span');text.textContent=param.label;top.append(text);const readout=document.createElement('span');readout.className='value';top.append(readout);label.append(top);let input;if(param.type==='choice'){input=document.createElement('select');param.options.forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=value;input.append(option);});input.value=entry.values[name]??param.default;}else{input=document.createElement('input');input.type=param.type==='range'?'range':param.type==='color'?'color':'checkbox';if(param.type==='range'){input.min=param.min;input.max=param.max;input.step=param.step||.01;input.value=entry.values[name]??param.default;readout.textContent=Number(input.value).toPrecision(3);}else if(param.type==='toggle'){input.checked=entry.values[name]??param.default;}else{const cw=entry.module.presets[entry.values.colorway||entry.module.params.colorway.default];input.value=entry.values[name]??cw[name]??param.default;}}
input.addEventListener(param.type==='range'?'input':'change',()=>{entry.values[name]=param.type==='toggle'?input.checked:param.type==='range'?Number(input.value):input.value;if(param.type==='range')readout.textContent=Number(input.value).toPrecision(3);if(name==='colorway'){Object.keys(entry.module.params).filter(k=>entry.module.params[k].type==='color').forEach(k=>delete entry.values[k]);}rebuild();if(name==='colorway')renderControls();});label.append(input);el('parameters').append(label);}el('stats').textContent=Math.round(entry.model.userData.triangles).toLocaleString()+' triangles / '+entry.model.userData.materialCount+' material(s)';}
el('animal-select').onchange=()=>{selected=Number(el('animal-select').value);renderControls();visible();if(!el('assembly').checked)frame();};el('assembly').onchange=()=>{visible();frame();};el('night').onchange=appearance;el('grid').onchange=appearance;el('wireframe').onchange=appearance;el('reset').onclick=()=>{entries[selected].values={};rebuild();renderControls();};el('frame').onclick=frame;el('snapshot').onclick=()=>{renderer.render(scene,camera);const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download=entries[selected].id+'.png';a.click();};
new ResizeObserver(()=>{const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(viewport);
const clock=new THREE.Clock();function tick(){requestAnimationFrame(tick);const time=clock.getElapsedTime();controls.autoRotate=el('rotate').checked;controls.update();entries.forEach(entry=>{if(!entry.root.visible)return;for(const [name,metadata] of Object.entries(entry.module.rig)){const target=entry.model.getObjectByName(name);if(target&&target.userData.isRig)target.rotation[metadata.axis]=el('animate').checked?Math.sin(time*1.5)*.06:0;}});renderer.render(scene,camera);}visible();renderControls();appearance();frame();tick();
}catch(error){console.error(error);el('error').style.display='grid';el('error').textContent='The 3D view could not start. Use a modern WebGL browser and serve this folder over HTTP. '+error.message;}
</script></body></html>`;
}

export async function exportAnimal(format: ExportFormat, animal: Animal, options: AnimalOptions, merge: boolean, hiddenParts: string[], onProgress: (message: string) => void) {
  const settings = { ...options, mergeForProduction: merge };
  if (format === 'glb') {
    onProgress('Preparing geometry...');
    const model = createAsset({ __animal: animal, ...settings, __hiddenParts: hiddenParts });
    try {
      const output = await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: true });
      if (!(output instanceof ArrayBuffer)) throw new Error('The GLB exporter did not return a binary model.');
      downloadBlob(new Blob([output], { type: 'model/gltf-binary' }), `${animal.id}.glb`);
    } finally { disposeObject(model); }
    return;
  }
  if (format === 'module') {
    onProgress('Writing your Three.js module...');
    downloadBlob(new Blob([standaloneSource(animal, settings, hiddenParts)], { type: 'text/javascript' }), `${animal.id}.mjs`);
    return;
  }
  const collection = format === 'collection', animals = collection ? ANIMALS : [animal];
  const files: Record<string, Uint8Array> = {};
  for (const [index, current] of animals.entries()) {
    onProgress(collection ? `Preparing ${index + 1} of ${animals.length}: ${current.name}` : 'Preparing your preview...');
    await new Promise(resolve => setTimeout(resolve, 0));
    files[`${current.id}.mjs`] = strToU8(standaloneSource(current, collection ? { mergeForProduction: merge } : settings, collection ? [] : hiddenParts));
  }
  files['scene.mjs'] = strToU8(sceneSource(animals));
  files['preview.html'] = strToU8(previewHtml(collection ? 'The animal kingdom' : animal.name, collection));
  files['README.md'] = strToU8(`# Wildform / ${collection ? 'The Animal Kingdom' : animal.name}\n\n## Preview\nServe this folder over HTTP (for example, run \`npx serve .\`) and open preview.html. The preview uses Three.js 0.180.0 from unpkg, so an internet connection is needed for the library, but not for model data.\n\n## Use an Animal\nEach .mjs animal module is self-contained. Its only imports are Three.js and the official mergeGeometries addon. Install three@0.180.0, import createAsset from the file, and add the returned group to your scene.\n\n- createAsset(options): generates a new animal in meters.\n- params: complete editable parameter schema.\n- presets / COLORWAYS: curated palettes.\n- rig: pivot axes and degree ranges. Runtime rotations use radians.\n- detach: named detachable components.\n- night: emissive transition configuration.\n- mergeForProduction: true gives one mesh per material; false retains individually selectable parts and pivots.\n\nScene display wrappers normalize animals for comparison. Original model dimensions remain available in group.userData.dimensions and the module header. scene.mjs composes the animal modules without modifying them.\n\n## Taxonomy\n${TAXONOMY_NOTE}\n\n## License\nGenerated geometry and animal modules: CC0 1.0 Universal. Three.js: MIT, its original license applies.\n`);
  files['LICENSE.txt'] = strToU8('Wildform generated geometry and animal asset modules are dedicated to the public domain under CC0 1.0 Universal: https://creativecommons.org/publicdomain/zero/1.0/\nThe Three.js library is not included in this archive. It is available under the MIT license.\n');
  onProgress('Packing your files...');
  await new Promise(resolve => setTimeout(resolve, 30));
  const data = zipSync(files, { level: 6 });
  downloadBlob(new Blob([new Uint8Array(data).buffer], { type: 'application/zip' }), collection ? 'wildform-animal-kingdom.zip' : `wildform-${animal.id}.zip`);
}

export async function validateCollection(onProgress: (message: string) => void) {
  const failures: string[] = [], phyla = new Set<string>();
  let totalTriangles = 0;
  for (const [index, animal] of ANIMALS.entries()) {
    onProgress(`Checking ${index + 1}/${ANIMALS.length}: ${animal.name}`);
    await new Promise(resolve => setTimeout(resolve, 0));
    try {
      const granular = makeAnimal(animal, { mergeForProduction: false });
      const merged = makeAnimal(animal, { mergeForProduction: true });
      const bounds = new THREE.Box3().setFromObject(granular);
      if (bounds.isEmpty() || !Number.isFinite(bounds.min.length() + bounds.max.length())) throw new Error('Non-finite bounds');
      if (merged.userData.partCount !== merged.userData.materialCount) throw new Error('Production draw-call mismatch');
      if (granular.userData.triangles !== merged.userData.triangles) throw new Error('Merged geometry differs');
      if (new Set(Object.values(granular.userData.zones)).size !== 6) throw new Error('Color-zone collision');
      granular.traverse(object => { if (object instanceof THREE.Mesh) { const positions = object.geometry.getAttribute('position'); for (let i = 0; i < positions.count; i++) if (!Number.isFinite(positions.getX(i) + positions.getY(i) + positions.getZ(i))) throw new Error('Non-finite vertex'); } });
      totalTriangles += granular.userData.triangles; phyla.add(animal.phylum);
      disposeObject(granular); disposeObject(merged);
    } catch (error) { failures.push(`${animal.name}: ${error instanceof Error ? error.message : 'Unknown error'}`); }
  }
  return { passed: ANIMALS.length - failures.length, total: ANIMALS.length, failures, phyla: phyla.size, triangles: totalTriangles };
}