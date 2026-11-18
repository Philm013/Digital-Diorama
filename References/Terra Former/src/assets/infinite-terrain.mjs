/**
 * TERRA / CONTINUOUS WORLD FIELD
 * Standalone procedural terrain. No textures, loaders, or shared asset utilities.
 * QUICK START: import { createAsset } from './infinite-terrain.mjs'; scene.add(createAsset());
 * STREAMING: createParams(opts), buildChunk(params, cx, cz), sampleHeight(x, z, params).
 * SPECS: 128 x 128 m per default chunk; 1,152 surface triangles at 24 subdivisions.
 *        Default patch: 640 x 640 m. Height is determined by the seed and relief in meters.
 * MATERIALS: one opaque vertex-color mesh + optional water in production mode.
 * EDITING: mergeForProduction=false returns named surface/skirt/water parts.
 * PARAMS: 20 biomes, 18 world recipes, relief, erosion, water, colors, and mesh density.
 * RIG: water.y [-4, 4]. DETACH: surface, skirt, water. LICENSE: MIT.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = { lowland: '#839c5f', highland: '#969b89', snow: '#eef2e9', sand: '#cfc49c', rock: '#848779', soil: '#8a775d', strata: '#b59d79', bedrock: '#645d50', water: '#62aeb3' };
export const COLORWAYS = {
  verdant: { ...BASE },
  autumn: { ...BASE, lowland: '#baa465', highland: '#b4a483', rock: '#948770', water: '#76a59b', snow: '#f2eee2' },
  moonstone: { ...BASE, lowland: '#849c94', highland: '#99a6a5', sand: '#c3c8bb', water: '#75aebf', snow: '#edf3f4' },
  dusk: { ...BASE, lowland: '#8f956f', highland: '#aaa0a6', rock: '#8a8290', sand: '#cbb29c', water: '#7c9fb1', snow: '#e8e4ef' }
};
export const presets = COLORWAYS;

const bio = (id, name, shape, climate, species, colors) => ({
  id, name, floor: shape[0], r: shape[1], s: shape[2], d: shape[3], f: shape[4], carve: shape[5],
  cold: climate[0], arid: climate[1], canopy: climate[2], scree: climate[3], species,
  colors: { low: colors[0], mid: colors[1], high: colors[2], steep: colors[3] }
});
export const BIOMES = [
  bio('alpine', 'Alpine crown', [.8,.98,.18,0,.16,1.2], [.8,.3,.22,.6], {fir:.8,pine:.2}, ['#81925e','#9da28e','#b5bdb4','#808679']),
  bio('foothills', 'Grass foothills', [.3,.32,.65,0,.07,1], [.3,.3,.35,.12], {pine:.6,shrub:.4}, ['#8ea765','#9aad70','#afb88a','#8f9472']),
  bio('taiga', 'Northern taiga', [.4,.43,.45,0,.1,1], [.88,.25,.85,.2], {fir:.85,pine:.15}, ['#607c53','#78916b','#acb8a5','#72806c']),
  bio('temperate', 'Temperate wood', [.3,.25,.6,0,.08,1], [.35,.2,.75,.1], {pine:.4,broadleaf:.5,shrub:.1}, ['#7b995a','#91a871','#b1b998','#839472']),
  bio('rainforest', 'Cloud forest', [.4,.55,.35,0,.14,1.2], [.1,.03,1,.12], {broadleaf:.85,palm:.1,shrub:.05}, ['#4f7844','#688e56','#90a37b','#607954']),
  bio('savanna', 'Open savanna', [.25,.15,.4,.1,.05,.5], [.1,.7,.25,.1], {acacia:.8,shrub:.2}, ['#b3a45e','#bfaf74','#c6bc92','#9b9367']),
  bio('desert', 'Dune sea', [.18,.06,.1,.9,.025,.25], [.08,.96,.025,.04], {shrub:1}, ['#cdb17c','#dec28d','#e8d3a9','#bd9e70']),
  bio('saltflat', 'Salt flat', [.05,.01,.03,.04,.015,.1], [.3,1,0,.02], {}, ['#d6d2bd','#e2dfca','#eeebdf','#bfc1b1']),
  bio('badlands', 'Painted badlands', [.3,.4,.3,0,.15,.9], [.15,.8,.04,.4], {shrub:1}, ['#b78a66','#c69c73','#d7b492','#a67e61']),
  bio('canyon', 'Red canyon', [.5,.55,.2,0,.06,1.4], [.18,.85,.05,.48], {shrub:.8,acacia:.2}, ['#ab7d59','#c4966c','#d6b082','#997250']),
  bio('volcanic', 'Volcanic field', [.6,.94,.1,0,.23,.85], [.35,.6,.07,.8], {shrub:1}, ['#656b62','#7d8276','#969b8c','#515a53']),
  bio('tundra', 'Cold tundra', [.15,.15,.3,.03,.06,1], [1,.45,.07,.2], {shrub:.8,fir:.2}, ['#939d85','#adb6a2','#d7ded4','#899789']),
  bio('marsh', 'Reed marsh', [-.02,.025,.12,0,.02,1], [.35,.03,.2,.015], {shrub:.8,broadleaf:.2}, ['#718151','#889668','#a5ac85','#657c57']),
  bio('islands', 'Coral islands', [-.2,.5,.25,0,.07,1], [.1,.25,.65,.08], {palm:.85,shrub:.15}, ['#b6bd8d','#83a063','#a9b67f','#9da783']),
  bio('meadow', 'Wildflower meadow', [.1,.08,.5,0,.035,.85], [.3,.2,.1,.03], {broadleaf:.3,shrub:.7}, ['#9baa6a','#b5be85','#c4caa0','#92a17a']),
  bio('redwood', 'Ancient redwood', [.4,.48,.5,0,.09,1.1], [.38,.12,1,.13], {fir:.6,broadleaf:.4}, ['#4f7250','#6b875b','#9ba485','#697b61']),
  bio('mangrove', 'Mangrove coast', [-.1,.045,.18,0,.025,1.4], [.05,.01,.9,.02], {broadleaf:.8,palm:.2}, ['#758f57','#89a06c','#b6bd8f','#6f825a']),
  bio('mesa', 'Sandstone mesas', [.5,.55,.18,0,.045,1.2], [.12,.9,.03,.5], {shrub:1}, ['#c4976e','#d4aa7c','#e1bf97','#ac835d']),
  bio('glacier', 'Glacier icefield', [.6,.8,.2,0,.04,1.3], [1,.3,0,.25], {}, ['#b8cfca','#ccddda','#e5eee9','#91aaa7']),
  bio('moorland', 'Heather moor', [.22,.22,.65,0,.06,1], [.6,.22,.16,.17], {shrub:.85,fir:.15}, ['#959169','#aaa37e','#b8b696','#888d76'])
];
export const biomeById = Object.fromEntries(BIOMES.map((b, index) => [b.id, { ...b, index }]));
export const biomeNames = Object.fromEntries(BIOMES.map((b) => [b.id, b.name]));
const recipe = (name, mix, relief, feature, biomeScale, waterLevel, snowline, colorway = 'verdant', roughness = .58, erosion = .35) => ({ name, mix, relief, feature, biomeScale, waterLevel, snowline, colorway, roughness, erosion });
export const WORLDS = {
  'alpine-frontier': recipe('Alpine frontier', ['alpine','foothills','taiga','temperate'], 210, 360, 1150, 4, .68),
  'emerald-basin': recipe('Emerald basin', ['rainforest','temperate','marsh','foothills'], 150, 380, 1350, 7, 1.1),
  'dune-sea': recipe('Dune sea', ['desert','saltflat','badlands','canyon'], 120, 390, 1800, -3, 1.2, 'autumn', .25),
  'painted-desert': recipe('Painted desert', ['canyon','badlands','desert','mesa'], 200, 340, 1200, 1, 1.2, 'autumn', .68, .55),
  'frozen-expanse': recipe('Frozen expanse', ['tundra','taiga','alpine','glacier'], 190, 370, 1550, 3, .26, 'moonstone'),
  'volcanic-reaches': recipe('Volcanic reaches', ['volcanic','badlands','tundra','savanna'], 245, 300, 1300, 2, .92, 'dusk', .78, .18),
  'thousand-islands': recipe('Thousand islands', ['islands','marsh','mangrove','rainforest'], 95, 320, 1000, 13, 1.2),
  'savanna-winds': recipe('Savanna winds', ['savanna','badlands','desert','meadow'], 110, 420, 1650, 1, 1.2, 'autumn', .35),
  'glacier-fjords': recipe('Glacier fjords', ['alpine','glacier','tundra','taiga'], 295, 340, 1100, 16, .34, 'moonstone', .6, .62),
  'shifting-wilds': recipe('Shifting wilds', BIOMES.map((b) => b.id), 190, 360, 900, 5, .75),
  'meadow-country': recipe('Meadow country', ['meadow','foothills','temperate','marsh'], 80, 470, 1250, 2, 1.1, 'verdant', .24),
  'redwood-coast': recipe('Redwood coast', ['redwood','temperate','moorland','islands'], 175, 400, 1450, 7, .95),
  'mangrove-delta': recipe('Mangrove delta', ['mangrove','marsh','islands','rainforest'], 65, 420, 1150, 5, 1.2, 'verdant', .28, .55),
  'highland-moors': recipe('Highland moors', ['moorland','foothills','meadow','alpine'], 160, 450, 1300, 3, .92, 'dusk', .4),
  'mesa-country': recipe('Mesa country', ['mesa','canyon','badlands','saltflat'], 225, 350, 1400, -1, 1.2, 'autumn', .36, .5),
  'obsidian-shores': recipe('Obsidian shores', ['volcanic','islands','glacier','saltflat'], 185, 330, 1100, 18, .95, 'moonstone', .74),
  'boreal-lakes': recipe('Boreal lakes', ['taiga','tundra','marsh','redwood'], 120, 430, 1400, 11, .72, 'moonstone', .42, .5),
  'monsoon-highlands': recipe('Monsoon highlands', ['rainforest','mangrove','alpine','redwood'], 240, 350, 1300, 8, .98, 'verdant', .6, .48)
};
export const worldPresets = WORLDS;
const range = (value, min, max, step, label, describe) => ({ type: 'range', default: value, min, max, step, label, describe, affects: 'geometry' });
export const params = {
  mergeForProduction: { type: 'toggle', default: true, label: 'Merge for production', affects: 'geometry', describe: 'Merge opaque geometry by material. Disable for individually selectable surface and skirt parts.' },
  world: { type: 'choice', default: 'alpine-frontier', options: Object.keys(WORLDS), label: 'World recipe', affects: 'geometry', describe: 'Biome assortment and its default landscape settings.' },
  seed: range(4829,1,99999,1,'Seed','Reproducible world key, independent of chunk load order.'),
  biomeScale: range(1150,450,4200,25,'Biome scale','Average spacing of biome centers in meters.'),
  relief: range(210,40,620,5,'Relief','Mountain height amplitude in meters.'),
  feature: range(360,90,900,10,'Feature size','Spacing of ridges, dunes, and valleys in meters.'),
  roughness: range(.58,0,1,.01,'Surface detail','Fine geological displacement amplitude.'),
  erosion: range(.35,0,1,.01,'Erosion','Softens relief and broadens continuous river channels.'),
  waterLevel: range(4,-20,60,.5,'Sea level','Water height in meters. Floods the land without moving the terrain.'),
  oceanDepth: range(46,8,140,2,'Ocean depth','Depth of basin and river floors below the natural datum.'),
  snowline: { ...range(.68,.1,1.25,.01,'Snowline','Snow threshold relative to relief, lowered by cold biomes.'), affects: 'colors' },
  canopy: range(.8,0,1.4,.02,'Canopy','Multiplies biome-dependent tree density.'),
  scree: range(.55,0,1.4,.02,'Rock scatter','Multiplies biome-dependent stone density.'),
  chunkSize: range(128,48,192,16,'Chunk size','Tile footprint in meters. Recalculates all vertex coordinates.'),
  segments: { type: 'choice', default: 24, options: [12,16,24,32,48], label: 'Tile resolution', affects: 'geometry', describe: 'Subdivisions per tile edge; neighboring tiles use the same global lattice.' },
  patchChunks: range(5,1,10,1,'Patch width','Number of tiles across a bounded createAsset export.'),
  centerX: range(0,-1e12,1e12,1,'Patch center X','World X coordinate sampled by bounded exports.'),
  centerZ: range(0,-1e12,1e12,1,'Patch center Z','World Z coordinate sampled by bounded exports.'),
  waterSurface: { type: 'toggle', default: true, label: 'Water surface', affects: 'geometry', describe: 'Show the translucent water plane.' },
  skirt: { type: 'toggle', default: false, label: 'Strata skirt', affects: 'geometry', describe: 'Optional geological cutaway on bounded exports. Streamed tiles keep their surface continuous.' },
  colorway: { type: 'choice', default: 'verdant', options: Object.keys(COLORWAYS), label: 'Palette', affects: 'colors', describe: 'Curated biome palette tint.' },
  ...Object.fromEntries(Object.entries(BASE).map(([key, value]) => [key, { type: 'color', default: value, label: `${key} color`, affects: 'colors', describe: `Override the ${key} material zone only.` }]))
};
export const rig = { water: { axis: 'y', range: [-4,4], describe: 'Water level offset in meters.' } };
export const detach = ['surface','skirt','water'];
export const night = { water: { color: '#528b9f', intensity: .22, distance: 0, describe: 'Cool water emission under moonlight.' } };
export const GENERATOR_VERSION = 3;
export const COORDINATE_LIMIT = 1e12;
const BAKED_WORLD = null;
const BAKED_STROKES = null;
const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
const mix = (a,b,t) => a + (b-a)*t;
const smooth = (a,b,v) => { const t=clamp((v-a)/(b-a),0,1); return t*t*(3-2*t); };
const hexOf = (v) => typeof v==='number' && Number.isFinite(v) ? v&0xffffff : typeof v==='string' && /^#?[0-9a-f]{6}$/i.test(v) ? parseInt(v.replace('#',''),16) : null;
function zonesFor(name, overrides = {}) {
  const palette=COLORWAYS[name] || COLORWAYS.verdant, out={}, used=new Set();
  for (const key of Object.keys(BASE)) {
    let value=hexOf(overrides[key]) ?? hexOf(palette[key]);
    while (used.has(value)) value=(value+1)&0xffffff;
    used.add(value); out[key]=value;
  }
  return out;
}
export function worldDefaults(id) {
  const key=WORLDS[id] ? id : params.world.default;
  const { name, mix: assortment, ...settings }=WORLDS[key];
  return { world:key, ...settings };
}
export function createParams(options = {}) {
  const raw={...BAKED_WORLD,...options};
  const p={...Object.fromEntries(Object.entries(params).filter(([,s])=>s.type!=='color').map(([k,s])=>[k,s.default])),...worldDefaults(raw.world),...raw};
  for (const [key,s] of Object.entries(params)) {
    if (s.type==='range') p[key]=clamp(Number.isFinite(Number(p[key]))?Number(p[key]):s.default,s.min,s.max);
    if (s.type==='choice') p[key]=s.options.includes(p[key])?p[key]:s.default;
    if (s.type==='toggle') p[key]=typeof p[key]==='boolean'?p[key]:s.default;
  }
  p.seed=Math.round(p.seed); p.chunkSize=Math.round(p.chunkSize); p.patchChunks=Math.round(p.patchChunks);
  p.mix=WORLDS[p.world].mix.map((id)=>biomeById[id].index);
  p.zones=zonesFor(p.colorway,raw);
  p.overrides=Object.fromEntries(Object.keys(BASE).filter((key)=>hexOf(raw[key])!==null).map((key)=>[key,hexOf(raw[key])]));
  p.strokes=Array.isArray(raw.strokes)?raw.strokes.slice():Array.isArray(BAKED_STROKES)?BAKED_STROKES.slice():[];
  p.strokes.forEach(validateStroke);
  Object.defineProperty(p,'cells',{value:new Map(),enumerable:false});
  Object.defineProperty(p,'strokeIndex',{value:createStrokeIndex(p.strokes),writable:true,enumerable:false});
  return p;
}

// Integer hashing includes high coordinate words; loading order never changes the field.
export function hash2(x,z,seed) {
  let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^Math.imul(seed|0,1442695041);
  h^=Math.imul(Math.floor(x/4294967296),1274126177)^Math.imul(Math.floor(z/4294967296),1911520717);
  h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296;
}
function noise(x,z,seed) {
  const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
  const fade=(t)=>t*t*t*(t*(t*6-15)+10),u=fade(fx),v=fade(fz);
  return mix(mix(hash2(ix,iz,seed),hash2(ix+1,iz,seed),u),mix(hash2(ix,iz+1,seed),hash2(ix+1,iz+1,seed),u),v)*2-1;
}
function fbm(x,z,seed,octaves=4) {
  let out=0,amp=.55,total=0;
  for(let i=0;i<octaves;i++){out+=noise(x,z,seed+i*73)*amp;total+=amp;x*=2.03;z*=2.07;amp*=.46;}
  return out/total;
}
const weights=new Float64Array(BIOMES.length);
function biomeBlend(x,z,p) {
  weights.fill(0);
  const u=x/p.biomeScale,v=z/p.biomeScale;
  const wx=u+noise(u*.63,v*.63,p.seed+31)*.22,wz=v+noise(u*.63,v*.63,p.seed+67)*.22;
  const ix=Math.floor(wx),iz=Math.floor(wz); let total=0;
  // Full compact support: even at a cell boundary every contributing center is included.
  for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
    const cx=ix+dx,cz=iz+dz,key=`${cx},${cz}`; let cell=p.cells.get(key);
    if(!cell){cell=[cx+.5+(hash2(cx,cz,p.seed)-.5)*.55,cz+.5+(hash2(cx,cz,p.seed+9)-.5)*.55,p.mix[Math.floor(hash2(cx,cz,p.seed+21)*p.mix.length)]];if(p.cells.size>4096)p.cells.clear();p.cells.set(key,cell);}
    const r2=(wx-cell[0])**2+(wz-cell[1])**2;
    if(r2>=2.25)continue;
    const t=1-r2/2.25,w=t*t*t;weights[cell[2]]+=w;total+=w;
  }
  for(let i=0;i<weights.length;i++)weights[i]/=total;
  return weights;
}
export function sampleBiomes(x,z,p) {
  const w=biomeBlend(x,z,p),ranked=[];
  for(let i=0;i<w.length;i++)if(w[i]>0)ranked.push({id:BIOMES[i].id,name:BIOMES[i].name,weight:w[i]});
  ranked.sort((a,b)=>b.weight-a.weight);
  const primary=ranked[0],blend=ranked[1]?.weight>.08?ranked[1]:null;
  return {primary:primary.id,primaryName:primary.name,weight:primary.weight,blend,weights:ranked,transition:blend?2*Math.min(primary.weight,blend.weight):0};
}

export function createStrokeIndex(strokes=[]) {
  const index={size:256,cells:new Map()};
  for(const stroke of strokes)for(let i=0;i<stroke.points.length;i+=2)addStrokePoint(index,stroke,stroke.points[i],stroke.points[i+1]);
  return index;
}
export function validateStroke(stroke){
  if(!stroke||!['raise','lower','flatten','calm','roughen'].includes(stroke.mode)||!Number.isFinite(stroke.r)||stroke.r<=0||stroke.r>2048||!Number.isFinite(stroke.k)||stroke.k<0||stroke.k>1||!Array.isArray(stroke.points)||stroke.points.length<2||stroke.points.length%2||stroke.points.some((v)=>!Number.isFinite(v)||Math.abs(v)>COORDINATE_LIMIT))throw new TypeError('Invalid world-space sculpt stroke.');
  if(stroke.y!==undefined&&!Number.isFinite(stroke.y))throw new TypeError('Invalid flatten height.');
  if(stroke.step!==undefined&&(!Number.isFinite(stroke.step)||stroke.step<0))throw new TypeError('Invalid sculpt increment.');
  return stroke;
}
export function addStrokePoint(index,stroke,x,z) {
  const r=stroke.r;if(!Number.isFinite(x)||!Number.isFinite(z)||!(r>0))return;
  const entry={stroke,x,z};
  for(let j=Math.floor((z-r)/index.size);j<=Math.floor((z+r)/index.size);j++)for(let i=Math.floor((x-r)/index.size);i<=Math.floor((x+r)/index.size);i++){
    const key=`${i},${j}`;if(!index.cells.has(key))index.cells.set(key,[]);index.cells.get(key).push(entry);
  }
}
export function setFieldStrokes(p,strokes) { strokes.forEach(validateStroke);p.strokes=strokes.slice();p.strokeIndex=createStrokeIndex(p.strokes); }
function applyEdits(height,detail,x,z,p) {
  const index=p.strokeIndex,entries=index.cells.get(`${Math.floor(x/index.size)},${Math.floor(z/index.size)}`);
  if(!entries)return height;
  let remainingDetail=detail;
  for(const entry of entries){
    const s=entry.stroke,d=Math.hypot(x-entry.x,z-entry.z);if(d>=s.r)continue;
    const t=1-d/s.r,w=(s.linear?t:t*t*(3-2*t))*s.k;
    if(s.mode==='raise')height+=w*(s.step??24);
    else if(s.mode==='lower')height-=w*(s.step??24);
    else if(s.mode==='flatten')height=mix(height,s.y??height,w);
    else if(s.mode==='calm'){height-=remainingDetail*w*.85;remainingDetail*=1-w*.85;}
    else if(s.mode==='roughen')height+=noise(x*.09,z*.09,p.seed+823)*w*12;
  }
  return height;
}
export function sampleHeight(x,z,p) {
  const w=biomeBlend(x,z,p);let floor=0,rw=0,sw=0,dw=0,fw=0,carve=0,arid=0,terrace=0;
  for(let i=0;i<w.length;i++)if(w[i]>0){const b=BIOMES[i],k=w[i];floor+=k*b.floor;rw+=k*b.r;sw+=k*b.s;dw+=k*b.d;fw+=k*b.f;carve+=k*b.carve;arid+=k*b.arid;if(b.id==='mesa'||b.id==='canyon')terrace+=k;}
  const u=x/p.feature,v=z/p.feature;
  const broad=fbm(u*.48,v*.48,p.seed+3,3),ridge=1-Math.abs(fbm(u*.95,v*.95,p.seed+19,4));
  const dune=(Math.sin(u*5.8+v*1.3+broad*2.3)+1)*.5;
  const fine=fbm(u*4.7,v*4.7,p.seed+37,3);
  const detail=p.relief*fw*fine*p.roughness*.32;
  let height=4+p.relief*(floor*.11+rw*Math.pow(ridge,4.2)*(.94-p.erosion*.22)+sw*broad*.36+dw*Math.pow(dune,1.8)*.48)+detail;
  height+=p.relief*fbm(x/1800,z/1800,p.seed+127,3)*.14;
  const terraced=Math.floor(height/14)*14+14*smooth(.5,.94,height/14-Math.floor(height/14));
  height=mix(height,terraced,terrace*.78);
  const lake=smooth(.20,.64,fbm(x/1100,z/1100,p.seed+223,3))*(1-arid*.82);
  height=mix(height,-p.oceanDepth*.42,smooth(.02,.75,lake));
  // Noise zero-contours form a continuous, non-repeating river network in every direction.
  const river=Math.abs(fbm(x/1450,z/1450,p.seed+71,3));
  const bank=1-smooth(.010,.057+p.erosion*.04,river);
  const cut=bank*smooth(.2,.85,carve);
  height=mix(height,Math.min(height,-2-(1-smooth(.003,.019,river))*4),cut);
  height=Math.max(-p.oceanDepth,height);
  return applyEdits(height,detail,x,z,p);
}
export function sampleHeightWith(x,z,p,strokes) { const q=createParams({...p,strokes});return sampleHeight(x,z,q); }
export function ecologyAt(x,z,p,height,slope) {
  const w=biomeBlend(x,z,p),species={};let cold=0,arid=0,canopy=0,scree=0;
  for(let i=0;i<w.length;i++)if(w[i]>0){const b=BIOMES[i],k=w[i];cold+=k*b.cold;arid+=k*b.arid;canopy+=k*b.canopy;scree+=k*b.scree;for(const [name,share]of Object.entries(b.species))species[name]=(species[name]||0)+k*share;}
  const above=height/p.relief,line=1-smooth(p.snowline-cold*.22-.08,p.snowline-cold*.22+.10,above);
  const dry=height>(p.waterSurface?p.waterLevel:0)+1;
  return {tree:dry?clamp(canopy*p.canopy*(1-arid*.6)*(1-smooth(.6,1.4,slope))*line,0,1):0,rock:height>(p.waterSurface?p.waterLevel:0)-1?clamp(scree*p.scree*(.45+slope*.35),0,1):0,species,cold,arid,canopy,above};
}
export function sampleSurface(x,z,p) {const h=sampleHeight(x,z,p),e=2,slope=Math.hypot(sampleHeight(x+e,z,p)-sampleHeight(x-e,z,p),sampleHeight(x,z+e,p)-sampleHeight(x,z-e,p))/(2*e);return {height:h,slope,...ecologyAt(x,z,p,h,slope),biomes:sampleBiomes(x,z,p)};}
export function canopyAt(x,z,p){return sampleSurface(x,z,p).tree;}
export function screeAt(x,z,p){return sampleSurface(x,z,p).rock;}
const paletteColors=BIOMES.map((b)=>Object.fromEntries(Object.entries(b.colors).map(([k,v])=>[k,new THREE.Color(v)])));
const tmpColor=new THREE.Color(),zoneColor=new THREE.Color();
export function sampleColor(x,z,h,slope,p,out=new THREE.Color()) {
  const w=biomeBlend(x,z,p);let cold=0,arid=0;
  out.setRGB(0,0,0);const above=h/p.relief;
  for(let i=0;i<w.length;i++)if(w[i]>0){const pal=paletteColors[i],k=w[i];cold+=k*BIOMES[i].cold;arid+=k*BIOMES[i].arid;tmpColor.copy(pal.low).lerp(pal.mid,smooth(.03,.4,above)).lerp(pal.high,smooth(.45,.85,above));tmpColor.lerp(pal.steep,smooth(.65,1.55,slope)*.78);out.r+=tmpColor.r*k;out.g+=tmpColor.g*k;out.b+=tmpColor.b*k;}
  if(p.colorway==='autumn'){out.r*=1.06;out.g*=.96;out.b*=.84;}
  if(p.colorway==='moonstone'){out.r*=.9;out.g*=.99;out.b*=1.1;}
  if(p.colorway==='dusk'){out.r*=1.04;out.g*=.94;out.b*=1.06;}
  if(p.overrides.lowland!==undefined)out.lerp(zoneColor.setHex(p.overrides.lowland),(1-smooth(.28,.6,above))*.7);
  if(p.overrides.highland!==undefined)out.lerp(zoneColor.setHex(p.overrides.highland),smooth(.28,.6,above)*.7);
  if(p.overrides.rock!==undefined)out.lerp(zoneColor.setHex(p.overrides.rock),smooth(.6,1.5,slope)*.65);
  const shore=p.waterSurface?1-smooth(p.waterLevel-.4,p.waterLevel+3.3,h):0;
  out.lerp(zoneColor.setHex(p.zones.sand),shore*.8);
  const snow=smooth(p.snowline-cold*.26,p.snowline-cold*.26+.14,above+noise(x*.027,z*.027,p.seed+449)*.05)*(1-smooth(1,1.8,slope)*.75)*(1-arid*.55);
  out.lerp(zoneColor.setHex(p.zones.snow),snow);
  return out.multiplyScalar(.96+noise(x*.07,z*.07,p.seed+89)*.035);
}

const MAT=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,metalness:0,flatShading:true,side:THREE.DoubleSide});
const GLASS_MAT=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.26,metalness:.08,transparent:true,opacity:.84,side:THREE.DoubleSide,depthWrite:false,forceSinglePass:true});
function prep(geometry,hex){let g=geometry;if(g.index){g=g.toNonIndexed();geometry.dispose();}g.deleteAttribute('uv');if(hex!==null||!g.getAttribute('color')){const c=new THREE.Color(hex??0xffffff),arr=new Float32Array(g.attributes.position.count*3);for(let i=0;i<arr.length;i+=3){arr[i]=c.r;arr[i+1]=c.g;arr[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(arr,3));}return g;}
function finish(list,material=MAT,name='solid',merge=true){if(!list.length)return null;const items=list.map((p)=>({...p,g:prep(p.g,p.c)}));if(merge){const geo=mergeGeometries(items.map((p)=>p.g));items.forEach((p)=>p.g.dispose());if(!geo)return null;if(!geo.getAttribute('normal'))geo.computeVertexNormals();const m=new THREE.Mesh(geo,material);m.name=name;m.receiveShadow=true;m.castShadow=false;return m;}const g=new THREE.Group();g.name=name;items.forEach((p,i)=>{if(!p.g.getAttribute('normal'))p.g.computeVertexNormals();const m=new THREE.Mesh(p.g,material);m.name=p.name||`${name}_part_${i+1}`;m.receiveShadow=true;g.add(m);});return g;}
function box(w,h,d,x=0,y=0,z=0){return new THREE.BoxGeometry(w,h,d).translate(x,y,z);}
function addCylinder(parts,top,bottom,h,segs,x,y,z,rx=0,ry=0,rz=0,hex='#888888'){const g=new THREE.CylinderGeometry(top,bottom,h,segs);g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);parts.push({g,c:hex});}
function addWire(parts,p1,p2,hex,r=.01,segs=5){const a=new THREE.Vector3(...p1),b=new THREE.Vector3(...p2),d=a.distanceTo(b);if(d<1e-5)return;const g=new THREE.CylinderGeometry(r,r,d,segs);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()));g.translate(...a.lerp(b,.5).toArray());parts.push({g,c:hex});}
function addExtrusion(parts,shape,depth,hex){parts.push({g:new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:10}),c:hex});}

export function buildChunk(p,cx,cz,options={}) {
  const requested=Number(options.segments??p.segments),segs=clamp(Math.round(Number.isFinite(requested)?requested:p.segments),4,96),size=p.chunkSize,step=size/segs,n=segs+1,pad=n+2;
  const heights=new Float32Array(n*n),extended=new Float64Array(pad*pad),colors=new Float32Array(n*n*3);
  const x0=cx*size,z0=cz*size,color=new THREE.Color();
  // Global integer sample indices give bit-identical positions and heights on shared edges.
  for(let j=-1;j<=segs+1;j++)for(let i=-1;i<=segs+1;i++)extended[(j+1)*pad+i+1]=sampleHeight((cx*segs+i)*size/segs,(cz*segs+j)*size/segs,p);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const id=j*n+i,e=(j+1)*pad+i+1,h=extended[e];heights[id]=h;
    const slope=Math.hypot(extended[e+1]-extended[e-1],extended[e+pad]-extended[e-pad])/(2*step);
    sampleColor((cx*segs+i)*size/segs,(cz*segs+j)*size/segs,h,slope,p,color);colors.set([color.r,color.g,color.b],id*3);
  }
  const positions=new Float32Array(segs*segs*18),vertexColors=new Float32Array(positions.length);let cursor=0;
  const tri=(a,b,c)=>{for(const id of [a,b,c]){positions[cursor]=id%n*size/segs;positions[cursor+1]=heights[id];positions[cursor+2]=Math.floor(id/n)*size/segs;vertexColors[cursor]=colors[id*3];vertexColors[cursor+1]=colors[id*3+1];vertexColors[cursor+2]=colors[id*3+2];cursor+=3;}};
  for(let j=0;j<segs;j++)for(let i=0;i<segs;i++){const a=j*n+i,b=a+1,c=a+n,d=c+1;if((i+j)%2){tri(a,c,b);tri(b,c,d);}else{tri(a,d,b);tri(a,c,d);}}
  const surface=new THREE.BufferGeometry();surface.setAttribute('position',new THREE.BufferAttribute(positions,3));surface.setAttribute('color',new THREE.BufferAttribute(vertexColors,3));surface.computeVertexNormals();
  const parts=[{g:surface,c:null,name:'surface'}];
  if(options.skirt??p.skirt){
    const edgePos=[],edgeColors=[],depth=p.oceanDepth+12;
    const wall=(ax,az,ay,bx,bz,by)=>{for(let band=0;band<3;band++){const t0=band/3,t1=(band+1)/3,lo=Math.min(ay,by)-depth,ca=mix(ay,lo,t0),cb=mix(by,lo,t0),na=mix(ay,lo,t1),nb=mix(by,lo,t1);edgePos.push(ax,ca,az,bx,cb,bz,bx,nb,bz,ax,ca,az,bx,nb,bz,ax,na,az);color.setHex(p.zones[['soil','strata','bedrock'][band]]);for(let k=0;k<6;k++)edgeColors.push(color.r,color.g,color.b);}};
    for(let i=0;i<segs;i++){const a=i*step,b=(i+1)*step;wall(a,0,heights[i],b,0,heights[i+1]);wall(b,size,heights[segs*n+i+1],a,size,heights[segs*n+i]);wall(0,b,heights[(i+1)*n],0,a,heights[i*n]);wall(size,a,heights[i*n+segs],size,b,heights[(i+1)*n+segs]);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(edgePos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(edgeColors,3));g.computeVertexNormals();parts.push({g,c:null,name:'skirt'});
  }
  const built=finish(parts,options.material||MAT.clone(),`chunk_${cx}_${cz}`,options.merge??p.mergeForProduction);
  built.position.set(x0,0,z0);
  built.userData.chunk={cx,cz,size,key:`${cx}|${cz}`};built.userData.grid={heights,colors,segs,n,step,x0,z0};
  built.userData.triangles=segs*segs*2+((options.skirt??p.skirt)?segs*24:0);
  return built;
}
export function heightOnGrid(grid,x,z) {
  const u=clamp((x-grid.x0)/grid.step,0,grid.segs),v=clamp((z-grid.z0)/grid.step,0,grid.segs);
  const ix=Math.min(grid.segs-1,Math.floor(u)),iz=Math.min(grid.segs-1,Math.floor(v)),tx=u-ix,tz=v-iz,a=iz*grid.n+ix,h=grid.heights,A=h[a],B=h[a+1],C=h[a+grid.n],D=h[a+grid.n+1];
  if((ix+iz)%2)return tx+tz<=1?A+(B-A)*tx+(C-A)*tz:D+(C-D)*(1-tx)+(B-D)*(1-tz);
  return tx>=tz?A+(B-A)*tx+(D-B)*tz:A+(D-C)*tx+(C-A)*tz;
}
export function createWater(p,span=1200,material=GLASS_MAT) {
  const g=prep(new THREE.PlaneGeometry(span,span,24,24).rotateX(-Math.PI/2),p.zones.water);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,material.clone());mesh.name='water';mesh.position.y=p.waterLevel;mesh.receiveShadow=true;
  mesh.userData.baseY=p.waterLevel;
  mesh.userData.wave=(time,worldX=0,worldZ=0)=>{const a=g.getAttribute('position');for(let i=0;i<a.count;i++)a.setY(i,Math.sin((a.getX(i)+worldX)*.037+time*.7)*.07+Math.cos((a.getZ(i)+worldZ)*.029-time*.5)*.06);a.needsUpdate=true;g.computeVertexNormals();};
  return mesh;
}
export function createAsset(options={}) {
  const p=createParams(options),g=new THREE.Group(),span=p.patchChunks,offset=-Math.floor(span/2),parts=[];
  const centerX=Math.floor(p.centerX/p.chunkSize),centerZ=Math.floor(p.centerZ/p.chunkSize);
  const material=MAT.clone();g.name=`terra-${p.world}`;
  for(let j=0;j<span;j++)for(let i=0;i<span;i++){
    const tile=buildChunk(p,centerX+i+offset,centerZ+j+offset,{merge:p.mergeForProduction,material});
    tile.position.x-=centerX*p.chunkSize;tile.position.z-=centerZ*p.chunkSize;
    if(p.mergeForProduction){tile.geometry.translate(tile.position.x,0,tile.position.z);parts.push({g:tile.geometry,c:null});}else g.add(tile);
  }
  if(p.mergeForProduction){const mesh=finish(parts,material,'surface',true);g.add(mesh);}
  if(p.waterSurface){const water=createWater(p,span*p.chunkSize);water.position.x=(offset+span/2)*p.chunkSize;water.position.z=water.position.x;g.add(water);}
  g.userData.params={...options};return g;
}
export default createAsset;