import JSZip from 'jszip';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createWorld } from './assets/scene';
import { createWater, BIOMES, WORLDS } from './assets/infinite-terrain';
import terrainSource from './assets/infinite-terrain.mjs?raw';
import treeSource from './assets/tree.mjs?raw';
import rockSource from './assets/field-rock.mjs?raw';
import sceneSource from './assets/scene.mjs?raw';
import previewSource from './assets/preview.html?raw';
import { serializeProject, settingsOnly } from './studio';
import type { ProjectState } from './studio';

export type ExportFormat = 'source' | 'glb' | 'project';
export function filenameFor(name:string){return name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'terra-world';}
export function download(data:Blob|string,filename:string,type='application/octet-stream'){
  const url=URL.createObjectURL(data instanceof Blob?data:new Blob([data],{type}));
  const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);
}
const literal=(value:unknown)=>JSON.stringify(value).replace(/</g,'\\u003c');
function bakeTerrain(state:ProjectState,merge:boolean){
  const settings={...settingsOnly(state.params),mergeForProduction:merge,centerX:state.travel.x,centerZ:state.travel.z};
  return terrainSource.replace('const BAKED_WORLD = null;',`const BAKED_WORLD = ${literal(settings)};`).replace('const BAKED_STROKES = null;',`const BAKED_STROKES = ${literal(state.strokes)};`);
}
export function exportTerrainModule(name:string,state:ProjectState,merge:boolean){download(bakeTerrain(state,merge),`${filenameFor(name)}-terrain.mjs`,'text/javascript');}
function disposeObject(root:THREE.Object3D){const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();root.traverse((o)=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach((m)=>materials.add(m));}});geometries.forEach((g)=>g.dispose());materials.forEach((m)=>m.dispose());}

async function exportGlb(state:ProjectState,merge:boolean,includeProps:boolean){
  const world=createWorld({...settingsOnly(state.params),...state.scene,strokes:state.strokes,startX:state.travel.x,startZ:state.travel.z,vegetation:includeProps&&state.scene.vegetation,rocks:includeProps&&state.scene.rocks});
  const output=new THREE.Scene();output.name='Terra landscape';
  try{
    const size=world.params.chunkSize,cx=Math.floor(state.travel.x/size),cz=Math.floor(state.travel.z/size),radius=world.sceneOptions.radius;
    world.setRenderOrigin(cx*size,cz*size);
    const maxIterations=(radius*2+1)**2+1;let iterations=0;
    while(world.stats().pending>0){if(iterations++>maxIterations)throw new Error('The region could not finish loading.');world.update(state.travel.x,state.travel.z,{budget:4,timeBudget:18});await new Promise((resolve)=>setTimeout(resolve,0));}
    world.group.updateMatrixWorld(true);
    output.userData={generator:'Terra',world:state.params.world,seed:state.params.seed,units:'meters',origin:{x:cx*size,z:cz*size},span:(radius*2+1)*size};
    const landPieces:THREE.BufferGeometry[]=[],propPieces:THREE.BufferGeometry[]=[];
    for(const tile of world.chunks.values()){
      const geometry=tile.geometry.clone().applyMatrix4(tile.matrixWorld);
      if(merge)landPieces.push(geometry);else{const mesh=new THREE.Mesh(geometry,world.landMaterial.clone());mesh.name=tile.name;output.add(mesh);}
    }
    const instanceMatrix=new THREE.Matrix4(),tint=new THREE.Color();let part=0;
    for(const child of world.group.getObjectByName('props')?.children||[]){
      if(!(child instanceof THREE.InstancedMesh))continue;
      for(let i=0;i<child.count;i++){
        child.getMatrixAt(i,instanceMatrix);instanceMatrix.premultiply(child.matrixWorld);
        const geometry=child.geometry.clone().applyMatrix4(instanceMatrix),colors=geometry.getAttribute('color');
        if(child.instanceColor){child.getColorAt(i,tint);for(let j=0;j<colors.count;j++)colors.setXYZ(j,colors.getX(j)*tint.r,colors.getY(j)*tint.g,colors.getZ(j)*tint.b);}
        if(merge)propPieces.push(geometry);else{const mesh=new THREE.Mesh(geometry,world.propMaterial.clone());mesh.name=`${child.name}_${++part}`;output.add(mesh);}
      }
    }
    for(const [pieces,material,name] of [[landPieces,world.landMaterial,'terrain'],[propPieces,world.propMaterial,'vegetation-and-rocks']] as const){
      if(!pieces.length)continue;const geometry=mergeGeometries(pieces);pieces.forEach((g)=>g.dispose());if(!geometry)throw new Error('Could not merge terrain geometry.');const mesh=new THREE.Mesh(geometry,material.clone());mesh.name=name;output.add(mesh);
    }
    if(world.params.waterSurface){const water=createWater(world.params,(radius*2+1)*size);water.position.x=size/2;water.position.z=size/2;delete (water.userData as Record<string,unknown>).wave;output.add(water);}
    const result=await new GLTFExporter().parseAsync(output,{binary:true,onlyVisible:true});
    if(!(result instanceof ArrayBuffer))throw new Error('The model could not be encoded as GLB.');return result;
  }finally{disposeObject(output);world.dispose();}
}

export async function exportProject(format:ExportFormat,name:string,state:ProjectState,includeProps:boolean,merge:boolean){
  const file=filenameFor(name);
  if(format==='project'){download(serializeProject(name,state),`${file}.terra.json`,'application/json');return;}
  if(format==='glb'){const result=await exportGlb(state,merge,includeProps);download(new Blob([result],{type:'model/gltf-binary'}),`${file}.glb`);return;}
  const zip=new JSZip(),settings={...settingsOnly(state.params),...state.scene,startX:state.travel.x,startZ:state.travel.z,projectId:state.id,bookmarks:state.bookmarks,vegetation:includeProps&&state.scene.vegetation,rocks:includeProps&&state.scene.rocks};
  zip.file('infinite-terrain.mjs',bakeTerrain(state,merge));zip.file('tree.mjs',treeSource);zip.file('field-rock.mjs',rockSource);
  zip.file('scene.mjs',sceneSource.replace('const DEFAULT_SCENE_OPTIONS = {};',`const DEFAULT_SCENE_OPTIONS = ${literal(settings)};`).replace('const DEFAULT_WORLD_OPTIONS = {};',`const DEFAULT_WORLD_OPTIONS = ${literal({...settings,strokes:state.strokes})};`));
  zip.file('preview.html',previewSource.replace('const INITIAL_OPTIONS = {};',`const INITIAL_OPTIONS = ${literal(settings)};`).replace('const INITIAL_STROKES = null;',`const INITIAL_STROKES = ${literal(state.strokes)};`).replace('const INITIAL_POSITION = { x: 0, z: 0 };',`const INITIAL_POSITION = ${literal(state.travel)};`));
  zip.file(`${file}.terra.json`,serializeProject(name,state));
  zip.file('README.md',`# ${name}\n\nA procedural Terra world with ${BIOMES.length} available biomes and ${Object.keys(WORLDS).length} recipes. Your seed, settings, and all ${state.strokes.length} sculpt strokes are included.\n\n## Preview\n\nServe this folder over HTTP (for example, npx serve .) and open preview.html. File URLs cannot load ES modules. The preview imports Three.js 0.180.0 from unpkg and needs internet access for that dependency. It supports keyboard and touch travel, parameter editing, and local sculpt persistence.\n\n## Reuse\n\nInstall three@0.180.0. Import createWorld from scene.mjs, add world.group to your scene, and call world.update(worldX, worldZ) each frame. world.tick(seconds) animates water. world.heightAt(x, z) samples the procedural field. world.surfaceAt(x, z) samples the rendered triangle surface.\n\nEach asset file (infinite-terrain.mjs, tree.mjs, field-rock.mjs) is independent, importing only Three.js and BufferGeometryUtils. scene.mjs is a separate composition layer, not a shared asset helper. All geometry is texture-free, vertex-colored, Y-up, and measured in meters.\n\n## Streaming and Precision\n\nOnly nearby chunks remain in memory. Unloaded chunks are regenerated from their absolute coordinates, seed, and the complete stroke history. No stroke is dropped as you travel. For distant coordinates, call world.setRenderOrigin(x, z) and subtract the same origin from your camera. Geometry uses local tile coordinates, keeping GPU precision high. JS number precision and device storage are the practical limits; there is no fixed map boundary.\n\n## Editing\n\nUse beginStroke, extendStroke, and endStroke for live sculpting, or setStrokes to replay a history. Persist the seed, settings, and all strokes, not generated meshes. Materialize a finite patch with createAsset from infinite-terrain.mjs. mergeForProduction merges that asset's opaque parts into one mesh; false exposes named parts. The streaming compositor batches terrain per chunk and vegetation by species.\n\n## Backup\n\nOpen the .terra.json file in Terra to restore this world, bookmarks, and travel position. Browser storage is device-local and can be cleared; exported files are your portable backup.\n\n## License\n\nMIT. Use, modify, and redistribute the source and generated geometry in personal or commercial work.\n`);
  download(await zip.generateAsync({type:'blob',compression:'DEFLATE'}),`${file}.zip`);
}