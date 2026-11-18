import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { BIOMES, WORLDS, createParams, buildChunk, createAsset, sampleHeight, sampleBiomes, sampleColor, hash2 } from '../src/assets/infinite-terrain.mjs';
import { createWorld } from '../src/assets/scene.mjs';
import { createAsset as createTree, SPECIES } from '../src/assets/tree.mjs';
import { createAsset as createRock } from '../src/assets/field-rock.mjs';

function dispose(asset){const materials=new Set();asset.traverse((o)=>{if(o.isMesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach((m)=>materials.add(m));}});materials.forEach((m)=>m.dispose());}
function near(a,b,epsilon=1e-8){assert.ok(Math.abs(a-b)<epsilon,`${a} differs from ${b}`);}

test('18 recipes, 20 biomes, and valid individual asset metadata',async()=>{
  assert.equal(Object.keys(WORLDS).length,18);assert.equal(BIOMES.length,20);
  for(const name of ['infinite-terrain','tree','field-rock']){
    const module=await import(`../src/assets/${name}.mjs`),text=await readFile(new URL(`../src/assets/${name}.mjs`,import.meta.url),'utf8');
    for(const key of ['createAsset','params','presets','rig','detach','night'])assert.ok(key in module,`${name} lacks ${key}`);
    assert.ok(Object.keys(module.presets).length>=3);assert.equal(module.params.mergeForProduction.type,'toggle');
    const imports=[...text.matchAll(/^import[^;]+from\s+['"]([^'"]+)['"]/gm)].map((m)=>m[1]);
    assert.ok(imports.every((path)=>path==='three'||path==='three/addons/utils/BufferGeometryUtils.js'));
    assert.ok(!text.includes('TextureLoader')&&!text.includes('GLTFLoader'));
  }
});

test('deterministic heights, normalized biome weights, and finite colors everywhere',()=>{
  for(const world of Object.keys(WORLDS)){
    const p=createParams({world,seed:7823}),other=createParams({world,seed:991});
    for(let i=0;i<24;i++){
      const x=(hash2(i,9,51)-.5)*200000,z=(hash2(i,19,83)-.5)*200000;
      const first=sampleHeight(x,z,p);assert.ok(Number.isFinite(first));sampleHeight(x+18,z-12,other);assert.equal(sampleHeight(x,z,p),first);
      const weights=sampleBiomes(x,z,p).weights;near(weights.reduce((sum,b)=>sum+b.weight,0),1,1e-12);
      assert.ok(weights.every((b)=>b.weight>=0&&WORLDS[world].mix.includes(b.id)));
      const color=sampleColor(x,z,first,.5,p);assert.ok([color.r,color.g,color.b].every(Number.isFinite));
    }
  }
});

test('shared tile edges have identical height AND color, including negative coordinates',()=>{
  const p=createParams({world:'shifting-wilds',seed:36,segments:16,skirt:false});
  for(const [cx,cz] of [[0,0],[-4,-7],[73018,-80234]]){
    const a=buildChunk(p,cx,cz),b=buildChunk(p,cx+1,cz),c=buildChunk(p,cx,cz+1),A=a.userData.grid,B=b.userData.grid,C=c.userData.grid,N=A.segs,n=A.n;
    for(let j=0;j<=N;j++){
      assert.equal(A.heights[j*n+N],B.heights[j*n]);assert.equal(A.heights[N*n+j],C.heights[j]);
      for(let k=0;k<3;k++){assert.equal(A.colors[(j*n+N)*3+k],B.colors[j*n*3+k]);assert.equal(A.colors[(N*n+j)*3+k],C.colors[j*3+k]);}
    }
    const normals=a.geometry.getAttribute('normal');for(let i=0;i<normals.count;i++)assert.ok(normals.getY(i)>0,'Surface triangle faces downward');
    dispose(a);dispose(b);dispose(c);
  }
});

test('biome and height functions have no hard cell-boundary jumps',()=>{
  const p=createParams({world:'shifting-wilds',seed:4811});
  for(let i=-30;i<=30;i++){
    const x=i*p.biomeScale,z=i*173.71+97,epsilon=1e-5;
    assert.ok(Math.abs(sampleHeight(x-epsilon,z,p)-sampleHeight(x+epsilon,z,p))<.003);
    const left=sampleBiomes(x-epsilon,z,p),right=sampleBiomes(x+epsilon,z,p);
    for(const b of BIOMES)near(left.weights.find((w)=>w.id===b.id)?.weight||0,right.weights.find((w)=>w.id===b.id)?.weight||0,1e-5);
  }
});

test('water changes flood the terrain instead of lifting the whole landscape',()=>{
  const a=createParams({seed:81,waterLevel:0}),b=createParams({seed:81,waterLevel:40});
  for(let i=0;i<30;i++)assert.equal(sampleHeight(i*129,i*77,a),sampleHeight(i*129,i*77,b));
});

test('stream, sculpt, unload, revisit, serialize, and restore with no lost edits',()=>{
  const world=createWorld({world:'alpine-frontier',seed:531,segments:12,radius:2,vegetation:false,rocks:false});
  world.update(0,0);world.flush();assert.equal(world.chunks.size,25);
  const size=world.params.chunkSize,original=world.heightAt(size,10);
  world.beginStroke({mode:'raise',r:32,k:.7,x:size,z:10});world.extendStroke(size+6,18);const stroke=world.endStroke();
  world.flush();const edited=world.heightAt(size,10);assert.ok(edited>original);
  world.update(12480,-9850);world.flush();assert.equal(world.chunks.size,25);assert.ok(!world.chunks.has('0|0'));
  world.setRenderOrigin(12416,-9856);
  world.update(0,0);world.flush();assert.equal(world.heightAt(size,10),edited);
  const wire=JSON.stringify({world:'alpine-frontier',seed:531,strokes:world.params.strokes});
  const restored=createParams(JSON.parse(wire));assert.equal(sampleHeight(size,10,restored),edited);
  world.setStrokes([]);world.flush();assert.equal(world.heightAt(size,10),original);
  world.setStrokes([stroke]);world.flush();assert.equal(world.heightAt(size,10),edited);
  world.setParams({relief:310});world.flush();assert.equal(world.stats().pending,0);world.setSceneOption('radius',3);world.flush();assert.equal(world.chunks.size,49);
  world.dispose();
});

test('older edits remain present after more than 200 strokes',()=>{
  const edits=Array.from({length:260},(_,i)=>({mode:'raise',r:18,k:.5,points:[i*64,0]}));
  const base=createParams({seed:32}),p=createParams({seed:32,strokes:edits});
  assert.equal(p.strokes.length,260);assert.ok(sampleHeight(0,0,p)>sampleHeight(0,0,base));
  const restored=createParams(JSON.parse(JSON.stringify({seed:32,strokes:edits})));assert.equal(sampleHeight(0,0,p),sampleHeight(0,0,restored));
});

test('same-count history replacement replays the new stroke rather than keeping the old one',()=>{
  const w=createWorld({radius:2,segments:12,vegetation:false,rocks:false});
  const first={mode:'raise',r:25,k:.8,points:[0,0]},second={mode:'lower',r:25,k:.8,points:[0,0]};
  w.setStrokes([first]);const high=w.heightAt(0,0);w.setStrokes([second]);assert.ok(w.heightAt(0,0)<high);w.dispose();
});

test('an in-progress rebuild never exposes mismatched neighboring tile edges',()=>{
  const w=createWorld({radius:2,segments:12,vegetation:false,rocks:false});w.flush();
  const size=w.params.chunkSize;w.beginStroke({mode:'raise',r:45,k:.9,x:size,z:20});w.endStroke();
  for(let step=0;step<80&&w.stats().pending;step++){
    w.update(0,0,{budget:1,timeBudget:Infinity});
    const a=w.chunks.get('0|0').userData.grid,b=w.chunks.get('1|0').userData.grid;
    for(let j=0;j<=a.segs;j++)assert.equal(a.heights[j*a.n+a.segs],b.heights[j*b.n]);
  }
  assert.equal(w.stats().pending,0);w.dispose();
});

test('production assets merge while editing assets expose individual parts',()=>{
  const merged=createAsset({mergeForProduction:true,patchChunks:2,skirt:true,segments:12});
  let draws=0;merged.traverse((o)=>{if(o.isMesh)draws++;});assert.equal(draws,2);
  const editable=createAsset({mergeForProduction:false,patchChunks:1,skirt:true,segments:12});assert.ok(editable.getObjectByName('surface'));assert.ok(editable.getObjectByName('skirt'));
  for(const species of Object.keys(SPECIES)){const tree=createTree({species,mergeForProduction:true});tree.traverse((o)=>{if(o.isMesh)assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));});dispose(tree);}
  const rock=createRock({shape:'bluff',mergeForProduction:false});assert.ok(rock.getObjectByName('stone'));dispose(merged);dispose(editable);dispose(rock);
});