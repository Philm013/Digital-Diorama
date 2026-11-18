import JSZip from 'jszip';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createScene } from './assets/scene.mjs';
import terrainSource from './assets/terrain.mjs?raw';
import pineSource from './assets/alpine-pine.mjs?raw';
import rockSource from './assets/field-rock.mjs?raw';
import sceneSource from './assets/scene.mjs?raw';
import previewSource from './assets/preview.html?raw';
import { serializeProject } from './studio';
import type { ProjectState } from './studio';

export type ExportFormat = 'source' | 'glb' | 'project';

export function download(data: Blob | string, filename: string, type = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 20000);
}

export function filenameFor(name: string) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'terra-landscape'; }

function bakeTerrain(state: ProjectState, merge: boolean) {
  return terrainSource.replace('const DEFAULT_OPTIONS = {};', `const DEFAULT_OPTIONS = ${JSON.stringify({ ...state.params, mergeForProduction: merge })};`).replace('const BAKED_HEIGHTS = null;', `const BAKED_HEIGHTS = ${JSON.stringify(state.heights)};`);
}

export function exportTerrainModule(name: string, state: ProjectState, merge: boolean) {
  download(bakeTerrain(state, merge), `${filenameFor(name)}.mjs`, 'text/javascript');
}

export async function exportProject(format: ExportFormat, name: string, state: ProjectState, includeProps: boolean, merge: boolean) {
  const fileName = filenameFor(name);
  if (format === 'project') { download(serializeProject(name, state), `${fileName}.terra.json`, 'application/json'); return; }
  const exportState = { ...state, params: { ...state.params, vegetation: includeProps && state.params.vegetation, rocks: includeProps && state.params.rocks } };
  if (format === 'source') {
    const zip = new JSZip();
    zip.file('terrain.mjs', bakeTerrain(exportState, merge));
    zip.file('alpine-pine.mjs', pineSource); zip.file('field-rock.mjs', rockSource);
    const initialOptions = JSON.stringify({ ...exportState.params, mergeForProduction: merge });
    zip.file('scene.mjs', sceneSource.replace('const DEFAULT_SCENE_OPTIONS = {};', `const DEFAULT_SCENE_OPTIONS = ${initialOptions};`));
    zip.file('preview.html', previewSource.replace('const INITIAL_OPTIONS = {};', `const INITIAL_OPTIONS = ${initialOptions};`));
    zip.file(`${fileName}.terra.json`, serializeProject(name, state));
    zip.file('README.md', `# ${name}\n\nMade with Terra. All geometry is procedural and texture-free.\n\n## Preview\n\nServe this directory using any local HTTP server (for example, \`npx serve .\`), then open preview.html. The preview uses Three.js 0.180.0 from unpkg and requires internet access for that dependency. Do not open the HTML with file:// because browsers restrict ES module imports.\n\n## Use in your app\n\nInstall three@0.180.0. Import createScene from './scene.mjs' and add createScene() to your Three.js scene. Your settings and sculpted height field are already included.\n\nEvery asset module is independent: import createAsset from terrain.mjs, alpine-pine.mjs, or field-rock.mjs. Each has inline helpers, parameter schemas, palettes, rig, detach, and night metadata.\n\nSet mergeForProduction to false for named, selectable meshes. Set it to true to merge geometry by material within each asset. A terrain with water uses two draw calls; each pine or rock uses one. Geometrical coordinates use meters and Y-up.\n\nRestore the .terra.json file through Terra's project menu to keep editing.\n\n## License\n\nMIT. Use and modify the modules and generated geometry for personal or commercial work.\n`);
    download(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), `${fileName}.zip`);
    return;
  }
  const scene = new THREE.Scene(), landscape = createScene({ ...exportState.params, mergeForProduction: merge }, state.heights);
  // Runtime height samplers and object references are not serializable glTF metadata.
  landscape.traverse((object) => { object.userData = {}; }); scene.add(landscape);
  try {
    const binary = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true });
    if (!(binary instanceof ArrayBuffer)) throw new Error('The model could not be encoded as a binary glTF file.');
    download(new Blob([binary], { type: 'model/gltf-binary' }), `${fileName}.glb`);
  } finally {
    const materials = new Set<THREE.Material>();
    landscape.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material)); } });
    materials.forEach((material) => material.dispose());
  }
}