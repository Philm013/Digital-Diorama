import { strToU8, zipSync } from 'fflate';
import type { AssetDefinition, ParameterValues, StudioSettings } from './catalog';
import { ASSETS } from './catalog';
import license from '../../LICENSE?raw';

const sources = import.meta.glob('../assets/*.mjs', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportAsset(asset: AssetDefinition, values: ParameterValues, colorway: string, merge: boolean, hiddenParts: string[] = []) {
  const preset = { ...values, colorway, mergeForProduction: merge };
  let source = sources[`../assets/${asset.id}.mjs`];
  if (!source) throw new Error('This specimen module could not be found.');
  source = source.replace('export function createAsset(userParams = {}) {', 'function createBaseAsset(userParams = {}) {');
  source += `

// Studio settings are embedded; the module remains entirely standalone.
export const studioPreset = ${JSON.stringify(preset, null, 2)};
export const studioHiddenParts = ${JSON.stringify(hiddenParts)};
export function createAsset(userParams = {}) {
  const options = { ...studioPreset, ...userParams };
  const root = createBaseAsset({ ...options, mergeForProduction: options.mergeForProduction && !studioHiddenParts.length });
  for (const name of studioHiddenParts) { const part = root.getObjectByName(name); if (part) part.visible = false; }
  if (options.mergeForProduction && studioHiddenParts.length) {
    root.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert(), batches = new Map(), originals = new Set();
    root.traverse(object => { if (object.isMesh) originals.add(object.geometry); });
    root.traverseVisible(object => {
      if (!object.isMesh) return;
      const geometry = object.geometry.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      if (!batches.has(object.material)) batches.set(object.material, []);
      batches.get(object.material).push(geometry);
    });
    root.clear();
    for (const [material, geometries] of batches) {
      const geometry = mergeGeometries(geometries); geometries.forEach(g => g.dispose());
      if (geometry) { const mesh = new THREE.Mesh(geometry, material); mesh.name = 'production_' + (root.children.length + 1); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); }
    }
    originals.forEach(geometry => geometry.dispose());
    root.userData.params.mergeForProduction = true;
  }
  return root;
}
`;
  download(new Blob([source], { type: 'text/javascript' }), `${asset.id}.mjs`);
}

const previewHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tideline / The Wrack Line</title><style>*{box-sizing:border-box}body{margin:0;background:#ede9df;color:#34463c;font:13px system-ui}canvas{display:block}header{position:fixed;top:28px;left:32px;pointer-events:none}h1{font:42px Georgia;margin:10px 0}small{letter-spacing:3px}footer{position:fixed;bottom:24px;left:32px;opacity:.6}#error{padding:40px;max-width:600px}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"}}</script></head>
<body><header><small>TIDELINE / COLLECTION 001</small><h1>The wrack line</h1><p>A world of detail. Not a single texture.</p></header><footer>Drag to orbit. Scroll to explore. Made entirely from geometry.</footer>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createScene, studioSceneSettings } from './scene.mjs';
try {
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFShadowMap; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.18; document.body.appendChild(renderer.domElement);
const background=({default:'#ede9df',gothic:'#d4d1ce',pacific:'#dddcd4',bioluminescent:'#d6d0df'})[studioSceneSettings.colorway]||'#ede9df';
const scene=new THREE.Scene(); scene.background=new THREE.Color(background);
const camera=new THREE.PerspectiveCamera(35.5,innerWidth/innerHeight,.1,120); camera.position.set(4,17,23);
const controls=new OrbitControls(camera,renderer.domElement); controls.target.set(0,.6,0); controls.enableDamping=true; controls.maxPolarAngle=Math.PI*.48; controls.update();
scene.add(new THREE.HemisphereLight('#fffaec','#a99c82',2.4)); const sunlight=studioSceneSettings.sunlight??52,elevation=.25+sunlight/100*.9; const sun=new THREE.DirectionalLight(sunlight<35?'#ffddb0':'#fff1d8',3.25); sun.position.set(-15*Math.cos(elevation),16*Math.sin(elevation),7); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-13,right:13,top:13,bottom:-13,near:.1,far:65}); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.normalBias=.022; sun.shadow.bias=-.00015; sun.shadow.radius=3; scene.add(sun); const fill=new THREE.DirectionalLight('#e9f0eb',.85); fill.position.set(5,8,-7); scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:background,roughness:1})); floor.rotation.x=-Math.PI/2; floor.position.y=-.27; floor.receiveShadow=true; scene.add(floor);
createScene(scene);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera)});
} catch(error) { const message=document.createElement('p');message.id='error';message.textContent='Unable to start WebGL. Please use a WebGL-enabled browser and serve this folder over a local HTTP server. '+error.message;document.body.appendChild(message); }
</script></body></html>`;

export function exportScene(settings: StudioSettings, merge: boolean) {
  const files: Record<string, Uint8Array> = {};
  ASSETS.forEach(asset => { files[`${asset.id}.mjs`] = strToU8(sources[`../assets/${asset.id}.mjs`]); });
  const exported = { ...settings, paramsByAsset: Object.fromEntries(ASSETS.map(asset => [asset.id, { ...settings.paramsByAsset[asset.id], mergeForProduction: merge }])), selectedId: '', editable: !merge, editAll: !merge, magnification: 10 };
  const scene = sources['../assets/scene.mjs'].replace('export function createScene(scene, options = {}) {', `export const studioSceneSettings = ${JSON.stringify(exported, null, 2)};\n\nexport function createScene(scene, options = {}) {\n  options = { ...studioSceneSettings, ...options };`);
  files['scene.mjs'] = strToU8(scene);
  files['preview.html'] = strToU8(previewHtml);
  files['scene-settings.json'] = strToU8(JSON.stringify(exported, null, 2));
  files['LICENSE'] = strToU8(license);
  files['README.md'] = strToU8(`# Tideline / The Wrack Line\n\n14 standalone, texture-free Three.js asset modules. MIT licensed.\n\n## Preview\nServe this folder over HTTP (for example, npx serve .) and open preview.html. The preview uses a pinned Three.js CDN import map; an internet connection is needed for Three.js itself. No textures or external models are loaded.\n\n## Use one asset\nInstall three, import createAsset from a specimen .mjs file, then call scene.add(createAsset({ mergeForProduction: false })). Each file contains its own complete geometry and helpers.\n\n## Editing\nEvery module exports params, presets, COLORWAYS, rig, detach, and night. Range parameters rebuild geometry in meters. Rig rotations use degrees unless their descriptions specify translation in meters. With mergeForProduction false, named components remain editable. With true, components are baked into one mesh per material; rig articulation is intentionally unavailable until rebuilt in editable mode.\n\n## Scale\nSpecimens are modeled at their real-world meter dimensions. scene.mjs presents them together at 10:1 exhibition magnification. Change magnification to 1 for life size.\n\n## Reproducibility\nscene-settings.json records the palette, all parameter overrides, density, wetness, visibility, and deterministic seed. The same settings are embedded into scene.mjs.\n`);
  const zip = zipSync(files, { level: 6 });
  download(new Blob([new Uint8Array(zip).buffer], { type: 'application/zip' }), 'tideline-wrack-line.zip');
}

export function exportSnapshot(dataUrl: string) {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = 'tideline-wrack-line.png';
  anchor.click();
}

export function getModuleSource(id: string) {
  return sources[`../assets/${id}.mjs`] || '';
}