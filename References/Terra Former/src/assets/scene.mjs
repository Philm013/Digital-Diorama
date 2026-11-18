/**
 * TERRA / STREAMED WORLD COMPOSITION
 * Composes independent terrain, tree, and stone modules. MIT license.
 * const world = createWorld({ world: 'alpine-frontier', seed: 4829 });
 * scene.add(world.group); world.update(worldX, worldZ); world.tick(seconds);
 * World coordinates remain double precision. setRenderOrigin keeps GPU coordinates small.
 * Generated tiles are disposable; the seed and every world-space edit are retained.
 */
import * as THREE from 'three';
import { createParams, buildChunk, createWater, ecologyAt, sampleHeight, heightOnGrid, hash2, addStrokePoint, setFieldStrokes, validateStroke, COORDINATE_LIMIT } from './infinite-terrain.mjs';
import { createAsset as createTree, SPECIES } from './tree.mjs';
import { createAsset as createRock, SHAPES } from './field-rock.mjs';

export const sceneParams = {
  radius: { type:'range',default:3,min:2,max:6,step:1,label:'Stream radius',affects:'geometry',describe:'Active tiles in each direction. Distant tiles are released without losing their edits.' },
  skip: { type:'range',default:1,min:1,max:4,step:1,label:'Planting spacing',affects:'geometry',describe:'World-space vegetation spacing, independent of terrain resolution.' },
  vegetation: { type:'toggle',default:true,label:'Trees and shrubs',affects:'geometry',describe:'Deterministic biome-appropriate vegetation.' },
  rocks: { type:'toggle',default:true,label:'Surface rocks',affects:'geometry',describe:'Deterministic boulders, bluffs, and shards.' },
  propBudget: { type:'range',default:2800,min:300,max:6000,step:100,label:'Prop budget',affects:'geometry',describe:'Maximum visible props; the underlying distribution remains deterministic.' }
};
const DEFAULT_SCENE_OPTIONS = {};
const DEFAULT_WORLD_OPTIONS = {};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function sceneOptionsFor(raw){const out={};for(const [k,s]of Object.entries(sceneParams)){const v=raw[k];out[k]=s.type==='toggle'?(typeof v==='boolean'?v:s.default):Math.round(clamp(Number.isFinite(Number(v))?Number(v):s.default,s.min,s.max));}return out;}
function disposeGeometry(object){object.traverse((o)=>{if(o.isMesh&&!o.isInstancedMesh)o.geometry.dispose();});}

export function createWorld(options={}) {
  let raw={...DEFAULT_WORLD_OPTIONS,...options},p=createParams(raw);
  const sceneOptions=sceneOptionsFor({...DEFAULT_SCENE_OPTIONS,...options});
  const group=new THREE.Group();group.name='terra-world';
  const land=new THREE.Group();land.name='terrain';const props=new THREE.Group();props.name='props';group.add(land,props);
  const landMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0,flatShading:true,side:THREE.DoubleSide});
  const propMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97,flatShading:true,side:THREE.DoubleSide});
  const templates=new Map(),instances=new Map(),descriptors=new Map(),chunks=new Map(),dirty=new Set(),staged=new Map();
  const origin={x:Number(raw.startX)||0,z:Number(raw.startZ)||0},renderOrigin={x:0,z:0},centre={cx:NaN,cz:NaN};
  if(!Number.isFinite(origin.x)||!Number.isFinite(origin.z)||Math.abs(origin.x)>COORDINATE_LIMIT||Math.abs(origin.z)>COORDINATE_LIMIT)throw new RangeError('World position exceeds the safe numeric range.');
  let queue=[],wanted=new Set(),disposed=false,propsDirty=false,activeStroke=null,water=null,waterTime=-1,revision=0,regenerating=false;
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion(),color=new THREE.Color(),up=new THREE.Vector3(0,1,0);

  function buildTemplates(){
    for(const g of templates.values())g.dispose();templates.clear();
    for(const [kind,factory,types]of [['tree',createTree,SPECIES],['rock',createRock,SHAPES]])for(const [type,settings]of Object.entries(types)){
      const asset=factory({...settings,[kind==='tree'?'species':'shape']:type,colorway:p.colorway,seed:13,chips:0,...raw[`${kind}Options`],mergeForProduction:true});
      let geometry=null;const materials=new Set();
      asset.traverse((o)=>{if(o.isMesh){if(!geometry)geometry=o.geometry;else o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach((m)=>materials.add(m));}});
      materials.forEach((m)=>m.dispose());if(geometry)templates.set(`${kind}:${type}`,geometry);
    }
  }
  function refreshWater(){
    if(water){group.remove(water);water.geometry.dispose();water.material.dispose();water=null;}
    if(p.waterSurface){water=createWater(p,(sceneOptions.radius*2+5)*p.chunkSize);group.add(water);}
    waterTime=-1;
  }
  function disposeInstances(){for(const mesh of instances.values()){props.remove(mesh);mesh.dispose();}instances.clear();}
  function chooseSpecies(species,value){const entries=Object.entries(species);let total=entries.reduce((n,[,v])=>n+v,0);if(!total)return 'shrub';let t=value*total;for(const [k,v]of entries){t-=v;if(t<=0)return k;}return entries[entries.length-1][0];}

  function collectProps(tile){
    const grid=tile.userData.grid,out=[];if(!sceneOptions.vegetation&&!sceneOptions.rocks)return out;
    const spacing=11*sceneOptions.skip,x1=grid.x0+p.chunkSize,z1=grid.z0+p.chunkSize;
    for(let j=Math.floor(grid.z0/spacing);j<Math.ceil(z1/spacing);j++)for(let i=Math.floor(grid.x0/spacing);i<Math.ceil(x1/spacing);i++){
      const x=(i+.18+hash2(i,j,p.seed+521)*.64)*spacing,z=(j+.18+hash2(i,j,p.seed+557)*.64)*spacing;
      if(x<grid.x0||x>=x1||z<grid.z0||z>=z1)continue;
      const h=heightOnGrid(grid,x,z),e=Math.min(3,grid.step);
      const slope=Math.hypot(heightOnGrid(grid,x+e,z)-heightOnGrid(grid,x-e,z),heightOnGrid(grid,x,z+e)-heightOnGrid(grid,x,z-e))/(e*2);
      const eco=ecologyAt(x,z,p,h,slope);let key=null;
      if(sceneOptions.vegetation&&hash2(i,j,p.seed+593)<eco.tree)key=`tree:${chooseSpecies(eco.species,hash2(i,j,p.seed+601))}`;
      else if(sceneOptions.rocks&&hash2(i,j,p.seed+619)<eco.rock*.4)key=`rock:${eco.arid>.68?'bluff':slope>.7?'shard':'boulder'}`;
      if(!key||!templates.has(key))continue;
      out.push({key,x,z,y:h-.08,angle:hash2(i,j,p.seed+631)*Math.PI*2,scale:.78+hash2(i,j,p.seed+641)*.62,tint:.88+hash2(i,j,p.seed+647)*.2,rank:hash2(i,j,p.seed+653)});
    }
    return out;
  }
  function rebuildInstances(){
    propsDirty=false;const all=[...descriptors.values()].flat();all.sort((a,b)=>a.rank-b.rank||a.x-b.x||a.z-b.z);
    const buckets=new Map();for(const d of all.slice(0,sceneOptions.propBudget)){if(!buckets.has(d.key))buckets.set(d.key,[]);buckets.get(d.key).push(d);}
    for(const [key,mesh]of instances)if(!buckets.has(key)){props.remove(mesh);mesh.dispose();instances.delete(key);}
    for(const [key,list]of buckets){
      let mesh=instances.get(key);
      if(!mesh||mesh.instanceMatrix.count<list.length){if(mesh){props.remove(mesh);mesh.dispose();}mesh=new THREE.InstancedMesh(templates.get(key),propMaterial,list.length);mesh.name=key.replace(':','-');mesh.castShadow=true;mesh.receiveShadow=true;instances.set(key,mesh);props.add(mesh);}
      mesh.count=list.length;
      list.forEach((d,i)=>{position.set(d.x-renderOrigin.x,d.y,d.z-renderOrigin.z);rotation.setFromAxisAngle(up,d.angle);scale.setScalar(d.scale);matrix.compose(position,rotation,scale);mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.setRGB(d.tint,d.tint,d.tint));});
      mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();
    }
  }
  function removeTile(key){const old=chunks.get(key);if(old){land.remove(old);disposeGeometry(old);chunks.delete(key);}const next=staged.get(key);if(next){disposeGeometry(next.tile);staged.delete(key);}descriptors.delete(key);dirty.delete(key);propsDirty=true;}
  function commitTile(key,tile,items){
    const meta=tile.userData.chunk;tile.position.set(meta.cx*p.chunkSize-renderOrigin.x,0,meta.cz*p.chunkSize-renderOrigin.z);
    const old=chunks.get(key);if(old){land.remove(old);disposeGeometry(old);}
    land.add(tile);chunks.set(key,tile);descriptors.set(key,items);dirty.delete(key);propsDirty=true;revision++;
  }
  function buildTile(cx,cz){
    const key=`${cx}|${cz}`;
    const tile=buildChunk(p,cx,cz,{merge:true,skirt:false,material:landMaterial});
    tile.position.set(cx*p.chunkSize-renderOrigin.x,0,cz*p.chunkSize-renderOrigin.z);
    const items=collectProps(tile);
    if(regenerating){const old=staged.get(key);if(old)disposeGeometry(old.tile);staged.set(key,{tile,items});dirty.delete(key);}
    else commitTile(key,tile,items);
  }
  function schedule(x,z){
    const cx=Math.floor(x/p.chunkSize),cz=Math.floor(z/p.chunkSize),r=sceneOptions.radius;centre.cx=cx;centre.cz=cz;wanted=new Set();
    for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++)wanted.add(`${cx+i}|${cz+j}`);
    for(const key of [...chunks.keys()])if(!wanted.has(key))removeTile(key);
    for(const [key,next]of staged)if(!wanted.has(key)){disposeGeometry(next.tile);staged.delete(key);dirty.delete(key);}
    queue=[];
    for(const key of wanted)if((!chunks.has(key)||dirty.has(key))&&!staged.has(key)){const [tx,tz]=key.split('|').map(Number);queue.push({key,cx:tx,cz:tz,distance:(tx-cx)**2+(tz-cz)**2});}
    queue.sort((a,b)=>a.distance-b.distance||a.cx-b.cx||a.cz-b.cz);
  }
  function update(x=origin.x,z=origin.z,settings={}){
    if(disposed)return {loaded:0,pending:0};if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>COORDINATE_LIMIT||Math.abs(z)>COORDINATE_LIMIT)return {loaded:chunks.size,pending:queue.length};
    origin.x=x;origin.z=z;
    if(Math.floor(x/p.chunkSize)!==centre.cx||Math.floor(z/p.chunkSize)!==centre.cz)schedule(x,z);
    const budget=settings.budget??2,start=performance.now(),time=settings.timeBudget??12;let built=0;
    while(queue.length&&built<budget){const item=queue.shift();if(wanted.has(item.key)){buildTile(item.cx,item.cz);built++;}if(performance.now()-start>time)break;}
    // Edited neighbors swap together, so no frame exposes mismatched old/new edges.
    if(!queue.length&&regenerating){for(const [key,next]of staged)commitTile(key,next.tile,next.items);staged.clear();regenerating=false;}
    if(propsDirty)rebuildInstances();
    if(water)water.position.set(x-renderOrigin.x,p.waterLevel+api.waterOffset,z-renderOrigin.z);
    return {loaded:chunks.size,pending:queue.length};
  }
  function restartStaging(){for(const [key,next]of staged){disposeGeometry(next.tile);if(wanted.has(key))dirty.add(key);}staged.clear();regenerating=true;}
  function markBounds(minX,minZ,maxX,maxZ){
    restartStaging();const pad=p.chunkSize/p.segments*2;minX-=pad;minZ-=pad;maxX+=pad;maxZ+=pad;
    for(const [key,tile]of chunks){const {cx,cz,size}=tile.userData.chunk;if((cx+1)*size>=minX&&cx*size<=maxX&&(cz+1)*size>=minZ&&cz*size<=maxZ)dirty.add(key);}
    schedule(origin.x,origin.z);
  }
  function rebuildTerrain(){restartStaging();for(const key of chunks.keys())dirty.add(key);schedule(origin.x,origin.z);}
  function setRenderOrigin(x,z){
    if(x===renderOrigin.x&&z===renderOrigin.z)return;renderOrigin.x=x;renderOrigin.z=z;
    for(const tile of chunks.values()){const m=tile.userData.chunk;tile.position.set(m.cx*m.size-x,0,m.cz*m.size-z);}
    propsDirty=true;if(water)water.position.set(origin.x-x,p.waterLevel+api.waterOffset,origin.z-z);rebuildInstances();
  }
  const api={
    group,sceneOptions,chunks,origin,centre,renderOrigin,landMaterial,propMaterial,
    get params(){return p;},get water(){return water;},get strokeCount(){return p.strokes.length;},get activeStroke(){return activeStroke;},get revision(){return revision;},
    waterOffset:0,update,setRenderOrigin,rebuildTerrain,
    heightAt:(x,z)=>sampleHeight(x,z,p),
    surfaceAt:(x,z)=>{const tile=chunks.get(`${Math.floor(x/p.chunkSize)}|${Math.floor(z/p.chunkSize)}`);return tile?heightOnGrid(tile.userData.grid,x,z):sampleHeight(x,z,p);},
    tick(time){if(water&&time-waterTime>1/24){water.userData.wave(time,origin.x,origin.z);waterTime=time;}},
    setParams(next={}){
      const previous=p,oldSize=p.chunkSize,oldPalette=p.colorway;raw={...raw,...next};p=createParams({...raw,strokes:p.strokes});
      if(oldPalette!==p.colorway){disposeInstances();buildTemplates();}
      if(oldSize!==p.chunkSize){for(const key of [...chunks.keys()])removeTile(key);centre.cx=NaN;}
      previous.cells.clear();refreshWater();rebuildTerrain();return p;
    },
    setSceneOption(key,value){
      if(key==='treeOptions'||key==='rockOptions'){raw[key]=value||{};disposeInstances();buildTemplates();propsDirty=true;return true;}
      if(!(key in sceneParams))return false;Object.assign(sceneOptions,sceneOptionsFor({...sceneOptions,[key]:value}));
      if(key==='radius'){refreshWater();schedule(origin.x,origin.z);}else if(key==='propBudget')propsDirty=true;else{for(const [id,tile]of chunks)descriptors.set(id,collectProps(tile));propsDirty=true;}
      return true;
    },
    setStrokes(strokes){
      if(p.strokes.length===strokes.length&&p.strokes.every((s,i)=>s===strokes[i]))return strokes.length;
      activeStroke=null;setFieldStrokes(p,strokes);rebuildTerrain();return p.strokes.length;
    },
    beginStroke(stroke){
      if(activeStroke||!Number.isFinite(stroke.x)||!Number.isFinite(stroke.z))return null;
      activeStroke=validateStroke({mode:stroke.mode,r:stroke.r,k:stroke.k,y:stroke.y,linear:stroke.linear,points:[stroke.x,stroke.z]});
      p.strokes.push(activeStroke);addStrokePoint(p.strokeIndex,activeStroke,stroke.x,stroke.z);
      markBounds(stroke.x-stroke.r,stroke.z-stroke.r,stroke.x+stroke.r,stroke.z+stroke.r);return activeStroke;
    },
    extendStroke(x,z){
      if(!activeStroke||!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>COORDINATE_LIMIT||Math.abs(z)>COORDINATE_LIMIT)return null;const s=activeStroke,pts=s.points,ax=pts[pts.length-2],az=pts[pts.length-1],d=Math.hypot(x-ax,z-az),count=Math.max(1,Math.ceil(d/Math.max(2,s.r*.23)));
      if(count>4096)throw new RangeError('End the current stroke before traveling to a distant place.');
      for(let i=1;i<=count;i++){const px=ax+(x-ax)*i/count,pz=az+(z-az)*i/count;pts.push(px,pz);addStrokePoint(p.strokeIndex,s,px,pz);}
      markBounds(Math.min(ax,x)-s.r,Math.min(az,z)-s.r,Math.max(ax,x)+s.r,Math.max(az,z)+s.r);return s;
    },
    endStroke(){const s=activeStroke;activeStroke=null;return s;},
    cancelStroke(){if(!activeStroke)return;const remaining=p.strokes.filter((s)=>s!==activeStroke);activeStroke=null;setFieldStrokes(p,remaining);rebuildTerrain();},
    addStroke(stroke){validateStroke(stroke);p.strokes.push(stroke);for(let i=0;i<stroke.points.length;i+=2)addStrokePoint(p.strokeIndex,stroke,stroke.points[i],stroke.points[i+1]);rebuildTerrain();return p.strokes.length;},
    flush(){let guard=0;while((queue.length||regenerating)&&guard++<1000)update(origin.x,origin.z,{budget:32,timeBudget:Infinity});if(queue.length||regenerating)throw new Error('Streaming queue did not settle.');},
    stats(){let triangles=water?1152:0,count=0;for(const tile of chunks.values())triangles+=tile.userData.triangles;for(const m of instances.values()){count+=m.count;triangles+=(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3*m.count;}return {triangles,chunks:chunks.size,props:count,pending:queue.length,drawCalls:chunks.size+instances.size+(water?1:0)};},
    dispose(){if(disposed)return;disposed=true;for(const key of [...chunks.keys()])removeTile(key);for(const next of staged.values())disposeGeometry(next.tile);staged.clear();disposeInstances();for(const g of templates.values())g.dispose();templates.clear();landMaterial.dispose();propMaterial.dispose();if(water){water.geometry.dispose();water.material.dispose();}p.cells.clear();p.strokeIndex.cells.clear();queue=[];group.clear();}
  };
  buildTemplates();refreshWater();schedule(origin.x,origin.z);
  return api;
}
export default createWorld;