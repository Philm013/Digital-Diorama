import { BIOMES, WORLDS, COLORWAYS, COORDINATE_LIMIT, params as terrainParams, worldDefaults, sampleBiomes } from './assets/infinite-terrain';
import type { Stroke, WorldParams } from './assets/infinite-terrain';
import { sceneParams } from './assets/scene';
import { params as treeParams } from './assets/tree';
import { params as rockParams } from './assets/field-rock';

export type { Stroke, WorldParams };
export { worldDefaults };
export type Tool = 'orbit' | 'raise' | 'lower' | 'calm' | 'roughen' | 'flatten';
export type Tab = 'worlds' | 'terraform' | 'life' | 'view';
export type CameraView = 'orbit' | 'top' | 'ground';
export type SceneOptions = { radius: number; skip: number; vegetation: boolean; rocks: boolean; propBudget: number; treeOptions?: Record<string,unknown>; rockOptions?: Record<string,unknown> };
export type ViewSettings = { night: boolean; grid: boolean; shadows: boolean; wireframe: boolean; autoRotate: boolean };
export type BrushSettings = { size: number; strength: number; falloff: 'soft' | 'linear' };
export type TravelReport = { x: number; z: number; height: number; biome: string; blend: string | null; transition: number; weight: number; blendWeight: number; heading: number };
export type SceneStats = { triangles: number; chunks: number; props: number; pending: number; drawCalls: number; zoom: number };
export type Bookmark = { id: string; name: string; x: number; z: number };
export type ProjectState = { id: string; params: WorldParams; scene: SceneOptions; view: ViewSettings; brush: BrushSettings; strokes: Stroke[]; travel: { x: number; z: number }; bookmarks: Bookmark[] };
export type WorldDocument = { name: string; state: ProjectState; updatedAt?: string; notice?: string };

const MOBILE = typeof window !== 'undefined' && window.innerWidth < 760;
export const DEFAULT_PARAMS = { ...Object.fromEntries(Object.entries(terrainParams).filter(([,s])=>s.type!=='color').map(([k,s])=>[k,s.default])), ...worldDefaults('alpine-frontier'), segments: MOBILE ? 16 : 24 } as unknown as WorldParams;
export const DEFAULT_SCENE: SceneOptions = { radius: 3, skip: 1, vegetation: true, rocks: true, propBudget: MOBILE ? 1400 : 2800 };
export const DEFAULT_VIEW: ViewSettings = { night: false, grid: false, shadows: true, wireframe: false, autoRotate: false };
export const DEFAULT_BRUSH: BrushSettings = { size: 34, strength: .55, falloff: 'soft' };
export const PARAM_META = terrainParams;
export const SCENE_META = sceneParams;
export const BIOME_INDEX = BIOMES.map((biome,index)=>({...biome,index}));
export const BIOME_SWATCHES: Record<string,[string,string,string]> = Object.fromEntries(BIOMES.map((b)=>[b.id,[b.colors.low,b.colors.high,b.colors.steep]]));
export const BIOME_LORE: Record<string,string> = {
  alpine:'Snow-lined peaks, exposed granite, and sheltered pine valleys.', foothills:'Soft grass-covered slopes between forest and mountain.',
  taiga:'Evergreen forests across cold northern hills.', temperate:'Leafy woodland and open clearings beside gentle rivers.',
  rainforest:'Wet valleys, dense broadleaf canopy, and steep green hills.', savanna:'Warm grasslands dotted with wide acacia crowns.',
  desert:'Long wind-shaped dunes in ochre and pale sand.', saltflat:'Wide mineral plains with very little relief.',
  badlands:'Warm clay ridges and branching erosion channels.', canyon:'Terraced sandstone interrupted by deep river valleys.',
  volcanic:'Dark basalt ridges and scattered angular stone.', tundra:'Cold lowland with pale groundcover and scattered shrubs.',
  marsh:'Low reed-filled basins where the land meets water.', islands:'Palm-covered ridges and sheltered turquoise shallows.',
  meadow:'Rolling open grasslands and occasional woodland.', redwood:'Ancient evergreen forests over damp, rugged hills.',
  mangrove:'Subtropical coastal woodland, tidal channels, and low islands.', mesa:'Flat-topped sandstone terraces and dry plateaus.',
  glacier:'Pale blue icefields surrounded by cold rock.', moorland:'Heather-colored hills, quiet streams, and rocky outcrops.'
};
const BLURBS: Record<string,string> = {
  'alpine-frontier':'Snowy peaks, pine forests, and green valleys.', 'emerald-basin':'Cloud forests give way to riverside wetlands.',
  'dune-sea':'Wind-shaped dunes and quiet mineral plains.', 'painted-desert':'Warm sandstone, clay ridges, and deep canyons.',
  'frozen-expanse':'Icefields fading into tundra and northern forest.', 'volcanic-reaches':'Basalt ridges, ash-colored slopes, and dry valleys.',
  'thousand-islands':'Palm islands and wetlands in turquoise shallows.', 'savanna-winds':'Acacia grasslands meeting the edge of the desert.',
  'glacier-fjords':'Snow-covered peaks above cold river channels.', 'shifting-wilds':'All twenty biomes in one ever-changing world.',
  'meadow-country':'Gentle hills, wide meadows, and leafy woods.', 'redwood-coast':'Ancient forests above a wild, rugged coast.',
  'mangrove-delta':'Low coastal forests and winding tidal channels.', 'highland-moors':'Heather hills meeting grassland and alpine rock.',
  'mesa-country':'Sun-warmed plateaus above desert canyons.', 'obsidian-shores':'Dark volcanic ridges and cool coastal shallows.',
  'boreal-lakes':'Northern forests woven around lakes and wetlands.', 'monsoon-highlands':'Lush forest climbing toward mountain peaks.'
};
export const WORLD_PRESETS = Object.entries(WORLDS).map(([id,w])=>({ id,name:w.name,mix:w.mix,blurb:BLURBS[id],settings:worldDefaults(id),swatches:w.mix.map((b)=>BIOME_SWATCHES[b][0]) }));
export const TOOLS: {id:Tool;name:string;hint:string;icon:string;key:string}[] = [
  {id:'orbit',name:'Look around',hint:'Orbit, pan, and travel',icon:'hand',key:'1'},
  {id:'raise',name:'Raise',hint:'Build peaks and ridges',icon:'arrow-up-from-line',key:'2'},
  {id:'lower',name:'Carve',hint:'Cut valleys and basins',icon:'arrow-down-to-line',key:'3'},
  {id:'flatten',name:'Flatten',hint:'Level to the first point in your stroke',icon:'align-vertical-space-around',key:'4'},
  {id:'calm',name:'Calm',hint:'Soften fine terrain detail',icon:'waves',key:'5'},
  {id:'roughen',name:'Roughen',hint:'Add geological surface detail',icon:'mountain',key:'6'}
];
export const newId = () => globalThis.crypto?.randomUUID?.() || `world-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const STORAGE_KEY = 'terra-endless-project';
const isRecord=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
const finite=(v:unknown,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?v:fallback;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function settingsOnly(p: WorldParams): Record<string,unknown> {
  return Object.fromEntries(Object.keys(terrainParams).filter((k)=>p[k]!==undefined).map((k)=>[k,p[k]]));
}
export function sanitizeParams(input:Record<string,unknown>):WorldParams {
  const result={...DEFAULT_PARAMS,...worldDefaults(String(input.world||DEFAULT_PARAMS.world))} as Record<string,unknown>;
  for(const [key,s] of Object.entries(terrainParams)){
    const value=input[key];if(value===undefined)continue;
    if(s.type==='range')result[key]=clamp(finite(value,Number(result[key])),s.min!,s.max!);
    else if(s.type==='choice'&&s.options?.includes(value as string|number))result[key]=value;
    else if(s.type==='toggle'&&typeof value==='boolean')result[key]=value;
    else if(s.type==='color'&&typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value))result[key]=value;
  }
  result.seed=Math.round(Number(result.seed));result.chunkSize=Math.round(Number(result.chunkSize));
  return result as unknown as WorldParams;
}
export function sanitizeScene(input:Record<string,unknown>):SceneOptions {
  const result={...DEFAULT_SCENE};for(const [k,s] of Object.entries(sceneParams)){const v=input[k];if(s.type==='toggle'&&typeof v==='boolean')Object.assign(result,{[k]:v});else if(s.type==='range'&&typeof v==='number')Object.assign(result,{[k]:Math.round(clamp(finite(v,Number(s.default)),s.min!,s.max!))});}
  for(const [key,schemas]of [['treeOptions',treeParams],['rockOptions',rockParams]] as const){
    const source=input[key];if(!isRecord(source))continue;const out:Record<string,unknown>={};
    for(const [k,s]of Object.entries(schemas)){const v=source[k];if(v===undefined||k==='mergeForProduction')continue;if(s.type==='range'&&typeof v==='number')out[k]=clamp(finite(v,Number(s.default)),s.min!,s.max!);else if(s.type==='choice'&&s.options?.includes(v as string|number))out[k]=v;else if(s.type==='toggle'&&typeof v==='boolean')out[k]=v;else if(s.type==='color'&&typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v))out[k]=v;}
    result[key]=out;
  }
  return result;
}
export function emptyState(params:WorldParams={...DEFAULT_PARAMS}):ProjectState {
  return {id:newId(),params,scene:{...DEFAULT_SCENE},view:{...DEFAULT_VIEW},brush:{...DEFAULT_BRUSH},strokes:[],travel:{x:0,z:0},bookmarks:[]};
}
function readStrokes(value:unknown):Stroke[] {
  if(value===undefined)return [];if(!Array.isArray(value))throw new Error('This world contains invalid sculpting data.');
  return value.map((v)=>{
    if(!isRecord(v)||!TOOLS.some((t)=>t.id===v.mode&&t.id!=='orbit')||!Array.isArray(v.points)||v.points.length<2||v.points.length%2||v.points.some((n)=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>COORDINATE_LIMIT)||typeof v.r!=='number'||!(v.r>0)||v.r>2048||typeof v.k!=='number'||!Number.isFinite(v.k)||v.k<0||v.k>1)throw new Error('Invalid stroke data. The existing world has not been replaced.');
    if(v.y!==undefined&&(typeof v.y!=='number'||!Number.isFinite(v.y)))throw new Error('Invalid flatten height.');
    return {mode:String(v.mode),r:v.r,k:v.k,y:v.y as number|undefined,linear:Boolean(v.linear),points:[...v.points] as number[],...(typeof v.step==='number'&&Number.isFinite(v.step)?{step:v.step}:{})};
  });
}
export function validateProject(value:unknown):WorldDocument {
  if(!isRecord(value)||value.format!=='terra-project'||!isRecord(value.state)||!isRecord(value.state.params))throw new Error('Choose a valid Terra world (.terra.json).');
  const version=Number(value.version);if(![1,2,3].includes(version))throw new Error('This world uses an unsupported file version.');
  const raw=value.state,source=raw.params as Record<string,unknown>;let settings=source,notice:string|undefined;
  if(version===1){
    const map:Record<string,string>={alpine:'alpine-frontier',hills:'meadow-country',desert:'dune-sea',islands:'thousand-islands',canyon:'painted-desert',volcanic:'volcanic-reaches'};
    settings={...worldDefaults(map[String(source.terrainType)]||'alpine-frontier'),seed:source.seed,relief:finite(source.elevation,32)*6,roughness:source.roughness};
    if(Array.isArray(raw.heights)&&raw.heights.length)throw new Error('This is a sculpted finite-terrain project. Keep it in the original studio; its heightmap cannot be converted losslessly to an endless world.');
    notice='Loaded the original landscape settings as an endless world. The old project file is unchanged.';
  }
  const state=emptyState(sanitizeParams(settings));state.id=typeof raw.id==='string'?raw.id:'imported-world';
  state.scene=sanitizeScene(isRecord(raw.scene)?raw.scene:{});
  if(isRecord(raw.view))for(const key of Object.keys(DEFAULT_VIEW) as (keyof ViewSettings)[])if(typeof raw.view[key]==='boolean')state.view[key]=raw.view[key] as boolean;
  if(isRecord(raw.brush))state.brush={size:clamp(finite(raw.brush.size,34),6,340),strength:clamp(finite(raw.brush.strength,.55),.05,1),falloff:raw.brush.falloff==='linear'?'linear':'soft'};
  state.strokes=readStrokes(raw.strokes);
  if(isRecord(raw.travel))state.travel={x:finite(raw.travel.x,0),z:finite(raw.travel.z,0)};
  if(Math.abs(state.travel.x)>COORDINATE_LIMIT||Math.abs(state.travel.z)>COORDINATE_LIMIT)throw new Error('Saved position exceeds the supported numeric precision.');
  if(Array.isArray(raw.bookmarks))state.bookmarks=raw.bookmarks.filter(isRecord).map((b)=>({id:typeof b.id==='string'?b.id:newId(),name:typeof b.name==='string'?b.name.slice(0,80):'Saved place',x:finite(b.x,0),z:finite(b.z,0)}));
  if(state.bookmarks.some((b)=>Math.abs(b.x)>COORDINATE_LIMIT||Math.abs(b.z)>COORDINATE_LIMIT))throw new Error('A saved place exceeds the supported numeric precision.');
  return {name:typeof value.name==='string'?value.name.slice(0,80)||'Untitled world':'Untitled world',state,updatedAt:typeof value.updatedAt==='string'?value.updatedAt:undefined,notice};
}
export function serializeProject(name:string,state:ProjectState):string {
  return JSON.stringify({format:'terra-project',version:3,generator:3,name,updatedAt:new Date().toISOString(),state:{...state,params:settingsOnly(state.params)}});
}
export function loadProject():WorldDocument {
  try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)return validateProject(JSON.parse(raw));}catch{/* IndexedDB restore is attempted before editing is enabled. */}
  return {name:'Untitled world',state:emptyState()};
}
export function findBiome(p:WorldParams,id:string,x:number,z:number,reach=60000){
  if(!WORLDS[p.world].mix.includes(id))return null;
  for(let i=0;i<1800;i++){const radius=p.biomeScale*.18*Math.sqrt(i),angle=i*2.399963229728653;if(radius>reach)break;const px=x+Math.cos(angle)*radius,pz=z+Math.sin(angle)*radius;const b=sampleBiomes(px,pz,p);if(b.primary===id&&b.weight>.6)return {x:Math.round(px),z:Math.round(pz),weight:b.weight};}
  return null;
}
export function formatDistance(m:number){return Math.abs(m)>=1000?`${(m/1000).toFixed(1)} km`:`${Math.round(m)} m`;}
export function resetPalette(p:WorldParams,palette:string):WorldParams {const next:WorldParams={...p,colorway:palette};for(const key of Object.keys(COLORWAYS.verdant))delete next[key];return next;}