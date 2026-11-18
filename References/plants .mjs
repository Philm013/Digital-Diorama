/**
 * WORLDFLORA — Nursery & Conservatory Studies
 * Twenty-five procedural botanical identities with optional designed containers.
 * Standalone Three.js module; meters, Y up; no textures or loaders.
 *
 * QUICK START
 *   const specimen = createAsset({
 *     species: 'String of hearts',
 *     potStyle: 'hanging basket',
 *     mergeForProduction: false
 *   });
 *   scene.add(specimen);
 *   const controls = getRelevantParams(specimen.userData.parameters, {
 *     usedZones: specimen.userData.usedZones
 *   });
 *
 * PARAMETERS
 *   Botanical parameters retain their original names and defaults.
 *   potStyle defaults to none for backward compatibility.
 *   potScale and potHeight are proportional multipliers; potRimThickness is
 *   a fraction of opening radius. Container coordinates are rebuilt, not scaled.
 *
 * SPECS
 *   Reference mature vegetative heights: Monstera 1.45 m, bird-of-paradise
 *   1.85 m, fern 0.48 m, fig 2.35 m, echeveria 0.13 m, agave 0.68 m,
 *   barrel cactus 0.62 m, columnar cactus 1.80 m, Nepenthes 0.95 m,
 *   flytrap 0.12 m, sundew 0.07 m, haworthia 0.15 m, jade 0.85 m,
 *   aloe 0.65 m, fountain grass 0.95 m, pampas 2.10 m, lavender 0.65 m,
 *   hydrangea 1.05 m, geranium 0.38 m, marigold 0.48 m,
 *   boxwood 1.55 m, rosemary topiary 1.35 m.
 *   Generated exact dimensions, bounds, triangles and pot measurements:
 *   userData.specs. Typical plants 8k–100k triangles; containers 2k–15k.
 *   Production uses one mesh per used material, at most four materials.
 *
 * EDITING / CONFIGURATION
 *   Unmerged meshes retain semantic components and articulated idle animation.
 *   pot contains potBody, potRim, potDetails, potSoil and optional potHanger.
 *   Production bakes the rest pose and retains semantic vertex partRanges.
 *   Rebuild unmerged for independent animation, visibility and detachment.
 *   Ordinary potted trailing strands turn gently outward near the ground.
 *   Hanging specimens retain their full drop and are grounded at the lowest
 *   strand; basket elevation and suspension dimensions are reported in specs.
 *
 *   visibleWhen uses declarative all/any/not, param comparison, reproductive,
 *   and zoneUsed predicates. getRelevantParams tolerates partial input.
 *   Color relevance is exact when supplied usedZones or after a matching build;
 *   otherwise it uses conservative species/style zone eligibility.
 *   advancedColorOverrides exposes every color without deleting metadata.
 *
 *   root.animations: seamless eight-second category-aware idle clip.
 *   userData.setNight(amount), setComponentVisible(name, visible), dispose().
 *
 * LICENSE
 *   Original procedural implementation and generated geometry: CC0-1.0.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = {
  bark:'#806044',stem:'#587344',wireStem:'#382e31',root:'#655044',
  soil:'#39342d',leaf:'#286a42',leafYoung:'#77a34f',leafBack:'#527d56',
  vein:'#a0b96b',wax:'#a1bcb2',cactus:'#629481',rib:'#86ad91',
  areole:'#e5d8b5',spine:'#ac895b',trap:'#86ab52',trapInterior:'#a63f4b',
  trapMark:'#853b48',rim:'#cc7970',petal:'#f1ddc4',petalAccent:'#ed7548',
  floralBlue:'#486cbb',pollen:'#e8b959',fruit:'#765273',dew:'#c8e9ec',
  mucilage:'#efa7b4',insect:'#423833',glow:'#f3dea1',band:'#eee9d6',
  silver:'#9faa95',violet:'#8060b7',pink:'#df8da6',
  hydrangeaBlue:'#799ed8',hydrangeaLilac:'#b098ce',
  marigoldGold:'#edb234',marigoldOrange:'#e47a29',spent:'#988064',
  grass:'#879668',plume:'#dfcfb0',moss:'#677b46',
  potBody:'#b97654',potRim:'#d0946d',potDetail:'#80664c',potCord:'#c8b18b'
};
export const COLORWAYS = {
  'Botanical Conservatory':{...BASE},
  'Arid Mineral':{...BASE,bark:'#97745b',stem:'#7b8460',soil:'#786657',
    leaf:'#668469',leafYoung:'#a6b78c',leafBack:'#7b927b',vein:'#c4cba0',
    wax:'#bac7c8',cactus:'#839e91',rib:'#a4b4a0',areole:'#f2e1bc',
    spine:'#b58153',trap:'#9fa873',trapInterior:'#a65b61',rim:'#c98d76',
    petal:'#fff0d5',petalAccent:'#e68b60',floralBlue:'#797fa9',
    fruit:'#986b77',glow:'#ffe4ac',plume:'#d7c1a4'},
  'Rainforest Humidity':{...BASE,bark:'#57473a',stem:'#497b48',soil:'#302f29',
    leaf:'#176444',leafYoung:'#74b45b',leafBack:'#387b61',vein:'#9bce77',
    wax:'#81b1a4',cactus:'#458d79',rib:'#79b694',trap:'#77ad4f',
    trapInterior:'#a73353',trapMark:'#742442',rim:'#d05f6f',
    petal:'#f3eccd',petalAccent:'#f38a43',floralBlue:'#4858c0',
    dew:'#bceee5',glow:'#d5efbd'},
  'Moonlit Herbarium':{...BASE,bark:'#66616c',stem:'#6d8590',soil:'#464750',
    leaf:'#4b7978',leafYoung:'#9fbdb0',leafBack:'#658793',vein:'#b9d7ca',
    wax:'#c0cbd9',cactus:'#7c9baa',rib:'#a5b9c7',areole:'#e7e4db',
    spine:'#a9a2b8',trap:'#8da99d',trapInterior:'#936984',
    trapMark:'#70506b',rim:'#c697b6',petal:'#eef0ed',petalAccent:'#bf91be',
    floralBlue:'#858ed0',pollen:'#d6cba1',fruit:'#81779c',dew:'#d6eafa',
    glow:'#c6e8ff',silver:'#b6c6c6',plume:'#c9bfd1'},
  'Cottage Bloom':{...BASE,bark:'#977162',stem:'#8a7058',soil:'#695344',
    leaf:'#537d51',leafYoung:'#91b75f',leafBack:'#80977a',silver:'#a9b49a',
    violet:'#9272be',petal:'#fff0c5',petalAccent:'#eb8769',pink:'#e9a1b5',
    floralBlue:'#7b8bc3',hydrangeaBlue:'#87a9d0',hydrangeaLilac:'#b999d0',
    marigoldGold:'#efc154',marigoldOrange:'#e6883e',plume:'#e7d4bd'},
  'Desert Jewel':{...BASE,bark:'#97725b',soil:'#9b7258',leaf:'#427f74',
    leafYoung:'#8cb8a1',leafBack:'#71918b',cactus:'#6c9d99',wax:'#a6bec3',
    band:'#f5eee2',rib:'#c3d1bd',rim:'#c77e75',petalAccent:'#ed906c',
    petal:'#ffe3bb',violet:'#9977b2',marigoldGold:'#eeb24d',marigoldOrange:'#d47b40'},
  'Trailing Conservatory':{...BASE,bark:'#645143',soil:'#3c3634',stem:'#658966',
    leaf:'#216c50',leafYoung:'#9bceb0',leafBack:'#825e75',vein:'#bdd3a0',
    band:'#eee7cf',trapMark:'#6e4965',rim:'#b78491',pink:'#e9b6c4',
    petal:'#f5e8d6',petalAccent:'#e69481',violet:'#9476b8',plume:'#d4c9bb'},
  'Formal Moon Garden':{...BASE,bark:'#687075',soil:'#34373c',stem:'#677f7b',
    leaf:'#4c7770',leafYoung:'#a2bcb0',leafBack:'#809a97',vein:'#c6d9c5',
    silver:'#c2caca',grass:'#a1b4ac',band:'#edf1e6',wax:'#b1c7ce',
    petal:'#f3eedb',floralBlue:'#a2c8e6',violet:'#a69acb',pink:'#c6abc7',
    hydrangeaBlue:'#a7c8e7',hydrangeaLilac:'#c1b4dc',plume:'#d7d0df',
    petalAccent:'#e0ab83',marigoldGold:'#dfba68',marigoldOrange:'#c88751',glow:'#dcecff'}
};
export const presets = COLORWAYS;
const SPECIES = [
  'Monstera','Bird-of-paradise','Maidenhair fern','Fiddle-leaf fig',
  'Echeveria','Agave','Barrel cactus','Columnar cactus','Nepenthes pitcher plant',
  'Venus flytrap','Sundew','String of pearls','String of hearts','String of turtles',
  'Haworthia zebra','Jade plant','Aloe vera','Fountain grass','Pampas grass',
  'Lavender shrub','Hydrangea shrub','Geranium','Marigold','Boxwood topiary','Rosemary topiary'
];
const TRAILING = SPECIES.filter(s=>s.startsWith('String of'));
const ROSETTES = ['Echeveria','Agave','Haworthia zebra','Aloe vera'];
const TOPIARY = ['Boxwood topiary','Rosemary topiary'];
const GRASSES = ['Fountain grass','Pampas grass'];
const SHRUBS = ['Lavender shrub','Hydrangea shrub','Geranium','Marigold'];
const DENSITY_FLOWERS = [...TRAILING,'Haworthia zebra','Aloe vera','Jade plant',...GRASSES,...SHRUBS,...TOPIARY];
const POT_STYLES = ['none','terracotta nursery','ceramic round','ceramic tapered','concrete planter','metal cachepot','hanging basket','stone bowl'];
const POT_DEFAULTS = {
  'terracotta nursery':['#b97654','#d0946d','#8e5139',0.87,0],
  'ceramic round':['#dce2d7','#f0eee3','#7b9992',0.23,0],
  'ceramic tapered':['#72908b','#b0bfb2','#dddfcc',0.24,0],
  'concrete planter':['#aaa89d','#c2bfb3','#777c76',0.97,0],
  'metal cachepot':['#8c9a97','#d2d9d1','#555f5b',0.29,0.88],
  'hanging basket':['#9e7850','#bf9864','#785637',0.9,0],
  'stone bowl':['#9a9885','#b5b099','#727463',0.96,0]
};
const range = (label,value,min,max,step,describe)=>({type:'range',default:value,min,max,step,label,affects:'geometry',describe});
const choice = (label,value,options,describe,affects='geometry')=>({type:'choice',default:value,options,label,affects,describe});
export const params = {
  species:choice('Species','Monstera',SPECIES,'One coherent botanical identity per asset.'),
  growthForm:choice('Growth form','single',['single','cluster'],'Single specimen or rooted neighboring members.'),
  maturity:range('Maturity',0.85,0.15,1,0.01,'Juvenile-to-mature proportions and reproductive readiness.'),
  clusterDensity:range('Cluster members',3,1,7,1,'Member count; woody groupings are limited to four.'),
  foliageCharacter:range('Foliage character',0.65,0,1,0.01,'Species-aware blade breadth, fullness and anatomy.'),
  imperfectionAndWildness:range('Imperfection & wildness',0.35,0,1,0.01,'Seeded asymmetry, leaning and restrained wear.'),
  flowering:range('Reproduction',0.35,0,1,0.01,'Maturity-gated flowers, figs or sori; traps remain independent.'),
  moisture:range('Moisture / dew',0.25,0,1,0.01,'Dew and soil moss. Sundew adhesive remains present at zero.'),
  seed:range('Specimen seed',17,1,99999,1,'Repeatable arrangement and embellishments.'),
  scale:range('Botanical scale',1,0.3,3,0.01,'Rebuild dimensions in meters without object scaling.'),
  trailingLength:range('Trailing length',1,0.25,2.4,0.01,'Vine drop before maturity and botanical scale.'),
  strandDensity:range('Trailing strand density',0.65,0,1,0.01,'Independently posed vines and crown runners.'),
  rosetteCompactness:range('Rosette compactness',0.6,0,1,0.01,'Leaf elevation, spacing and lance length.'),
  flowerDensity:range('Flower density',0.65,0,1,0.01,'Reproductive density for supported nursery species.'),
  bloomStage:range('Bloom stage',0.68,0,1,0.01,'Buds through peak bloom and restrained spent flowers.'),
  grassPlumeFullness:range('Grass plume fullness',0.65,0,1,0.01,'Feathery branches, spread and maturity.'),
  branchingDensity:range('Shrub branching density',0.6,0,1,0.01,'Structural forks and canopy shoots.'),
  branchingAndPruning:range('Branching & pruning',0.75,0,1,0.01,'Natural growth to a tightly sculpted topiary.'),
  topiarySilhouette:choice('Topiary silhouette','species default',['species default','sphere','cone','cube','tiered','column'],'Rosemary interprets cone/column as columnar and other choices as rounded.'),
  pruningNeatness:range('Pruning neatness',0.86,0,1,0.01,'Clipped boundary precision and escaped shoots.'),
  variegationStrength:range('Variegation / banding',0.65,0,1,0.01,'Zebra bands, aloe stripes, heart markings, turtle seams and geranium bands.'),
  hydrangeaMood:choice('Hydrangea bloom mood','palette',['palette','blue','pink','cream','lilac'],'Hydrangea floret colors.','colors'),
  colorway:choice('Colorway','Botanical Conservatory',Object.keys(COLORWAYS),'Curated botanical palettes.','colors'),
  floatingPollinators:{type:'toggle',default:false,label:'Visiting insects',affects:'geometry',describe:'Tiny winged visitors and optional airborne pollen.'},
  potStyle:choice('Container','none',POT_STYLES,'Optional proportional procedural container; none preserves the original bare study.'),
  potScale:range('Container size',1,0.75,1.8,0.01,'Desired opening size relative to the specimen; never smaller than its root bed.'),
  potHeight:range('Container height',1,0.65,1.5,0.01,'Style-relative vessel height multiplier, rebuilt from its profile.'),
  potRimThickness:range('Rim thickness',0.065,0.025,0.14,0.005,'Rim section as a fraction of opening radius; thin metal styles temper this value.'),
  potPattern:choice('Container detail','rings',['none','rings','fluted'],'Optional turned bands or continuous fluting.'),
  potDetail:range('Detail strength',0.65,0,1,0.01,'Band relief, fluting, woven structure or mineral variation.'),
  potRoughness:range('Surface roughness',0.5,0,1,0.01,'Style-relative roughness adjustment; 0.5 uses the curated finish.'),
  potMetalness:range('Metal reflectivity',0.88,0,1,0.01,'Metal cachepot reflectivity.'),
  hangingLength:range('Suspension length',1,0.6,1.8,0.01,'Suspension length relative to basket diameter and plant clearance.'),
  hangingCordCount:choice('Suspension cords',4,[3,4],'Three or four load-bearing cords.'),
  hangerSway:range('Hanger motion',0,0,0.35,0.01,'Tiny hook-only idle movement in degrees; basket and cords remain static.'),
  advancedColorOverrides:{type:'toggle',default:false,label:'All color overrides',affects:'colors',describe:'Expose every preserved color key, including currently unused zones.'},
  mergeForProduction:{type:'toggle',default:true,label:'Merge for production',affects:'geometry',describe:'One mesh per material; disable for selection, component visibility and animation.'}
};
params.potRoughness.affects='colors';
params.potMetalness.affects='colors';
for(const [key,color] of Object.entries(BASE)) params[key]={
  type:'color',default:color,label:key.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()),
  affects:'colors',group:key.startsWith('pot')?'Container colors':'Botanical colors',
  advancedOverride:true,describe:`Override the ${key} zone. Container defaults are style-aware unless explicitly overridden.`
};
const eq=(param,value)=>({param,eq:value});
const isin=(param,values)=>({param,in:values});
const gt=(param,value)=>({param,gt:value});
const all=(...conditions)=>({all:conditions});
const any=(...conditions)=>({any:conditions});
const speciesIn=values=>isin('species',values);
const potOn={not:eq('potStyle','none')};
const floweringContext={reproductive:true};
for(const [key,s] of Object.entries(params)) {
  if(!s.group) s.group=key.startsWith('pot')||key.startsWith('hanging')||key==='hangerSway'?'Container':'Botanical';
  s.visibleWhen={all:[]};
}
Object.assign(params.clusterDensity,{visibleWhen:eq('growthForm','cluster')});
for(const key of ['trailingLength','strandDensity']) params[key].visibleWhen=speciesIn(TRAILING);
params.rosetteCompactness.visibleWhen=speciesIn(ROSETTES);
params.variegationStrength.visibleWhen=speciesIn(['Haworthia zebra','Aloe vera',...TRAILING,'Geranium']);
params.flowerDensity.visibleWhen=all(speciesIn(DENSITY_FLOWERS),floweringContext);
params.bloomStage.visibleWhen=all(speciesIn(DENSITY_FLOWERS),floweringContext,gt('flowerDensity',0));
params.hydrangeaMood.visibleWhen=all(eq('species','Hydrangea shrub'),floweringContext,gt('flowerDensity',0));
params.grassPlumeFullness.visibleWhen=all(speciesIn(GRASSES),floweringContext,gt('flowerDensity',0));
params.branchingDensity.visibleWhen=speciesIn(['Jade plant',...SHRUBS,...TOPIARY]);
for(const key of ['branchingAndPruning','topiarySilhouette','pruningNeatness']) params[key].visibleWhen=speciesIn(TOPIARY);
params.floatingPollinators.visibleWhen=all(
  {not:speciesIn(['Maidenhair fern','Fiddle-leaf fig'])},floweringContext,
  any({not:speciesIn(DENSITY_FLOWERS)},gt('flowerDensity',0))
);
for(const key of ['potScale','potHeight','potRimThickness','potDetail','potRoughness']) params[key].visibleWhen=potOn;
params.potPattern.visibleWhen=isin('potStyle',['terracotta nursery','ceramic round','ceramic tapered','concrete planter','metal cachepot']);
params.potDetail.visibleWhen=all(potOn,any(isin('potStyle',['hanging basket','stone bowl']),{not:eq('potPattern','none')}));
params.potMetalness.visibleWhen=eq('potStyle','metal cachepot');
for(const key of ['hangingLength','hangingCordCount']) params[key].visibleWhen=eq('potStyle','hanging basket');
params.hangerSway.visibleWhen=all(eq('potStyle','hanging basket'),eq('mergeForProduction',false));
for(const key of Object.keys(BASE)) params[key].visibleWhen=any(eq('advancedColorOverrides',true),{zoneUsed:key});

export const rig={
  trunkOrCrown:{axis:'z',range:[-1,1],describe:'Structural editorial pose.'},
  primaryLeaves:{axis:'z',range:[-3,3],describe:'Broadleaf and fern sway.'},
  secondaryLeaves:{axis:'x',range:[-2,2],describe:'Juvenile foliage.'},
  clusterOffsets:{axis:'y',range:[-10,10],describe:'Rooted member connections.'},
  flowersOrReproductiveParts:{axis:'z',range:[-2,2],describe:'Original inflorescences.'},
  carnivorousTraps:{axis:'z',range:[-3,3],describe:'Pitcher nods and sundew shimmer.'},
  flytrapJaw:{axis:'z',range:[-78,78],describe:'Mirrored local hinges; exact targets in userData.rigTargets.'},
  floatingPollinators:{axis:'y',range:[-12,12],describe:'Visitor hover.'},
  trailingStrands:{axis:'z',range:[-3,3],describe:'Individual hanging pendulums.'},
  succulentRosetteLeaves:{axis:'x',range:[-0.5,0.5],describe:'Restrained succulent motion.'},
  flowerHeads:{axis:'z',range:[-3,3],describe:'Flower nods.'},
  flowerScapes:{axis:'z',range:[-2,2],describe:'Scape sway.'},
  grassBlades:{axis:'z',range:[-4,4],describe:'Fountain ripple.'},
  grassPlumes:{axis:'z',range:[-3,3],describe:'Seedhead lag.'},
  shrubBranches:{axis:'z',range:[-1.5,1.5],describe:'Woody sway.'},
  topiaryCrown:{axis:'z',range:[-0.4,0.4],describe:'Almost stationary clipped crown.'},
  topiaryTrunk:{axis:'y',range:[-5,5],describe:'Structural pruning form.'},
  potHanger:{axis:'z',range:[-0.35,0.35],describe:'Optional tiny hook-only motion; unmerged hanging basket only.'}
};
const BOTANICAL_DETACH=[
  'rootCrown','trunkOrCrown','primaryLeaves','secondaryLeaves','clusterOffsets',
  'flowersOrReproductiveParts','carnivorousTraps','surfaceDetails','floatingPollinators',
  'trailingStrands','succulentRosetteLeaves','flowerHeads','flowerScapes','grassBlades',
  'grassPlumes','shrubBranches','topiaryCrown','topiaryTrunk','budsAndSpentBlooms'
];
export const detach=[...BOTANICAL_DETACH,'pot','potBody','potRim','potDetails','potSoil','potHanger'];
export const night={pollenGlow:{material:'pollenGlow',color:'#f3dea1',intensity:0.8,distance:0,describe:'Airborne pollen only; living foliage and containers do not emit light.'}};

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const UP=V(0,1,0),TAU=Math.PI*2,GOLD=2.399963229728653;
const {lerp,clamp,degToRad:rad}=THREE.MathUtils;
const hexOf=v=>typeof v==='number'&&Number.isFinite(v)?v&0xffffff:
  typeof v==='string'&&/^#?[0-9a-f]{6}$/i.test(v)?parseInt(v.replace('#',''),16):null;
function normalize(values={}) {
  const supplied=values&&typeof values==='object'?values:{},p={};
  for(const [key,s] of Object.entries(params)){
    p[key]=Object.prototype.hasOwnProperty.call(supplied,key)?supplied[key]:s.default;
    if(s.type==='range') p[key]=clamp(Number.isFinite(Number(p[key]))?Number(p[key]):s.default,s.min,s.max);
    if(s.type==='choice'&&!s.options.includes(p[key])) p[key]=s.default;
    if(s.type==='toggle'&&typeof p[key]!=='boolean') p[key]=s.default;
    if(s.type==='color'&&hexOf(p[key])===null) p[key]=s.default;
  }
  p.seed=Math.round(p.seed);p.clusterDensity=Math.round(p.clusterDensity);return p;
}
function zonesFor(name,overrides={}){
  const palette=COLORWAYS[name]||COLORWAYS['Botanical Conservatory'],used=new Set(),out={};
  for(const key of Object.keys(BASE)){
    let h=hexOf(overrides[key])??hexOf(palette[key])??hexOf(BASE[key]);
    while(used.has(h))h=(h+1)&0xffffff;used.add(h);out[key]=h;
  }
  return out;
}
const zoneCache=new Map();
const relevanceKey=p=>JSON.stringify(Object.fromEntries(Object.keys(params).filter(k=>
  params[k].type!=='color'&&!['advancedColorOverrides','mergeForProduction','potRoughness','potMetalness'].includes(k)
).map(k=>[k,p[k]])));
function eligibleZones(p){
  const s=p.species,z=new Set(['soil','root']);
  const put=(...a)=>a.flat().forEach(k=>z.add(k));
  const reproductive=p.flowering>0&&p.maturity>(s==='Agave'?0.949:s==='Monstera'?0.76:0.64);
  if(p.moisture>0.55)put('moss');
  if(['Monstera','Bird-of-paradise','Fiddle-leaf fig'].includes(s)){
    put('stem','leaf','leafYoung','leafBack','vein');
    if(p.moisture>0)put('dew');
    if(s==='Fiddle-leaf fig')put('bark');
    if(reproductive)put(s==='Fiddle-leaf fig'?['fruit']:s==='Bird-of-paradise'?['trapMark','petalAccent','floralBlue']:['petal','pollen']);
  } else if(s==='Maidenhair fern'){
    put('wireStem','leaf','leafYoung','leafBack');if(reproductive)put('spine');
  } else if(ROSETTES.includes(s)){
    put('stem');
    if(s==='Haworthia zebra'){put('leaf','leafYoung','wireStem','dew');if(p.variegationStrength>0)put('band');}
    if(s==='Aloe vera'){put('cactus','leafYoung','band','rim');if(p.variegationStrength>0)put('rib');}
    if(s==='Agave')put('cactus','wax','rib','spine');
    if(s==='Echeveria'){put('wax','leafBack','rim');if(p.moisture>0.65)put('dew');}
    if(reproductive&&(!DENSITY_FLOWERS.includes(s)||p.flowerDensity>0))put('stem','leafBack','leafYoung','petal','petalAccent','pollen','rim');
  } else if(s.includes('cactus')){
    put('cactus','rib','areole','spine');if(reproductive)put('trap','petal','petalAccent','pollen');
  } else if(s==='Nepenthes pitcher plant'){
    put('stem','leaf','leafYoung','vein','rim','trap','trapInterior','trapMark','petalAccent');
    if(p.moisture>0)put('dew');if(reproductive)put('pollen');
  } else if(s==='Venus flytrap'||s==='Sundew'){
    put('stem','leafYoung','trapInterior','trapMark','rim');
    if(s==='Venus flytrap')put('leaf','leafBack','trap');else put('mucilage');
    if(reproductive)put('petal','pollen','leafBack');
  } else if(TRAILING.includes(s)){
    put('stem','leaf','leafYoung','leafBack');
    if(s==='String of pearls'){put('cactus');if(p.variegationStrength>0.2)put('rib');if(p.moisture>0.8)put('dew');}
    if(s==='String of hearts'){put('wireStem');if(p.variegationStrength>0)put('silver');}
    if(s==='String of turtles'&&p.variegationStrength>0)put('vein');
    if(reproductive&&p.flowerDensity>0)put('petal','pink','pollen','trapMark','leafBack');
  } else if(s==='Jade plant'){
    put('bark','stem','leaf','leafYoung','rim');if(reproductive&&p.flowerDensity>0)put('pink','petal','pollen','leafBack');
  } else if(GRASSES.includes(s)){
    put('grass','silver','leafYoung','leafBack','spent');
    if(reproductive&&p.flowerDensity>0)put('stem','plume',s==='Pampas grass'?'petal':'pink');
  } else if(SHRUBS.includes(s)){
    put('stem','leafYoung','leafBack');
    if(s==='Lavender shrub'){put('bark','silver');if(reproductive&&p.flowerDensity>0)put('violet','spent');}
    if(s==='Hydrangea shrub'){put('bark','leaf','vein');if(p.moisture>0)put('dew');
      if(reproductive&&p.flowerDensity>0){
        const mood=p.hydrangeaMood==='palette'?(p.colorway==='Cottage Bloom'||p.colorway==='Trailing Conservatory'?'pink':p.colorway.includes('Moon')?'lilac':'blue'):p.hydrangeaMood;
        put({blue:'hydrangeaBlue',pink:'pink',cream:'petal',lilac:'hydrangeaLilac'}[mood],'petal','pollen','spent');
      }}
    if(s==='Geranium'){put('leaf','vein');if(p.variegationStrength>0.12)put('trapMark');if(reproductive&&p.flowerDensity>0)put('pink','petalAccent','pollen');}
    if(s==='Marigold'){put('leaf');if(reproductive&&p.flowerDensity>0)put('marigoldGold','marigoldOrange','spent');}
  } else if(TOPIARY.includes(s)){
    put('bark','stem','spent','leaf','leafYoung',s==='Rosemary topiary'?'silver':'leafBack');
    if(reproductive&&p.flowerDensity>0)put('leafBack','pollen',s==='Rosemary topiary'?'floralBlue':'leafYoung');
  }
  if(p.floatingPollinators){put('insect','dew');if(p.flowering>0&&s!=='Maidenhair fern')put('glow');}
  if(p.potStyle!=='none'){
    put('potBody','potRim','potDetail','soil');
    if(p.potStyle==='hanging basket')put('potCord');
  }
  return z;
}
export const conditionSchema={
  version:1,operators:['all','any','not','param:eq','param:in','param:gt','reproductive','zoneUsed'],
  describe:'Empty all is true. Missing values use validated defaults. zoneUsed accepts an exact built-zone set or conservative prebuild eligibility.'
};
export function evaluateCondition(condition,values={},context={}){
  const p=normalize(values);
  const used=context.usedZones?new Set(context.usedZones):zoneCache.get(relevanceKey(p))||eligibleZones(p);
  const test=c=>{
    if(!c)return true;
    if(c.all)return c.all.every(test);
    if(c.any)return c.any.some(test);
    if(c.not)return !test(c.not);
    if(c.zoneUsed)return used.has(c.zoneUsed);
    if(c.reproductive)return p.flowering>0&&p.maturity>(p.species==='Agave'?0.949:p.species==='Monstera'?0.76:0.64);
    if(c.param){
      if(Object.hasOwn(c,'eq'))return p[c.param]===c.eq;
      if(c.in)return c.in.includes(p[c.param]);
      if(Object.hasOwn(c,'gt'))return p[c.param]>c.gt;
    }
    return false;
  };
  return test(condition);
}
export function getRelevantParams(values={},options={}){
  const p=normalize(values);
  if(options.advancedColors===true)p.advancedColorOverrides=true;
  const used=options.usedZones?new Set(options.usedZones):zoneCache.get(relevanceKey(p))||eligibleZones(p);
  return Object.fromEntries(Object.entries(params).filter(([,s])=>evaluateCondition(s.visibleWhen,p,{usedZones:used})));
}
export const getVisibleParams=getRelevantParams;

function seededRandom(seed){
  let s=seed>>>0;return()=>{s=(s+0x6d2b79f5)>>>0;let t=Math.imul(s^s>>>15,s|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
}
function prep(geometry,hex){
  let g=geometry;if(g.index){g=geometry.toNonIndexed();geometry.dispose();}
  for(const key of Object.keys(g.attributes))if(key!=='position')g.deleteAttribute(key);
  g.clearGroups();const c=new THREE.Color(hex),a=new Float32Array(g.attributes.position.count*3);
  for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}
  g.setAttribute('color',new THREE.BufferAttribute(a,3));return g;
}
function finish(list,material,name='solid',merge=true){
  if(!list.length)return null;
  if(merge){
    let vertexStart=0;const ranges=[],gs=list.map(part=>{
      const g=prep(part.g,part.c);ranges.push({name:part.name,component:part.component,member:part.member,zone:part.zone,vertexStart,vertexCount:g.attributes.position.count});
      vertexStart+=g.attributes.position.count;return g;
    });
    const g=mergeGeometries(gs,false);gs.forEach(a=>a.dispose());
    if(!g)throw new Error('Worldflora: incompatible procedural attributes.');
    g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    const mesh=new THREE.Mesh(g,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.partRanges=ranges;return mesh;
  }
  const group=new THREE.Group();group.name=name;
  for(const part of list){
    const g=prep(part.g,part.c);g.computeVertexNormals();g.computeBoundingSphere();
    const mesh=new THREE.Mesh(g,material);mesh.name=part.name;mesh.castShadow=mesh.receiveShadow=true;
    mesh.userData={zone:part.zone,component:part.component,member:part.member};group.add(mesh);
  }
  return group;
}
function box(w,h,d,x=0,y=0,z=0){return new THREE.BoxGeometry(w,h,d).translate(x,y,z);}
function addCylinder(parts,rt,rb,h,seg,x,y,z,rx=0,ry=0,rz=0,hex=0x888888){
  const g=new THREE.CylinderGeometry(rt,rb,h,seg);g.rotateX(rx).rotateY(ry).rotateZ(rz).translate(x,y,z);parts.push({g,c:hex});
}
function addWire(parts,a,b,hex,radius=0.01,sides=5){
  const A=V(...a),B=V(...b),D=B.clone().sub(A);if(D.lengthSq()<1e-16)return;
  const g=new THREE.CylinderGeometry(radius,radius,D.length(),sides);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP,D.normalize()));
  g.translate(...A.lerp(B,0.5).toArray());parts.push({g,c:hex});
}
function addExtrusion(parts,shape,depth,hex,matrix=new THREE.Matrix4()){
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:10,steps:1});g.applyMatrix4(matrix);parts.push({g,c:hex});
}
function geometryOf(vertices,indices){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);return g;
}
function frame(direction,normal=UP){
  const D=direction.clone().normalize();if(D.lengthSq()<1e-10)D.copy(UP);
  let N=normal.clone().addScaledVector(D,-normal.dot(D));
  if(N.lengthSq()<1e-8){N=Math.abs(D.z)<0.85?V(0,0,1):V(1,0,0);N.addScaledVector(D,-N.dot(D));}
  N.normalize();return{D,N,W:new THREE.Vector3().crossVectors(D,N).normalize()};
}
function sweepGeometry(points,r0,r1,segments=12,sides=6){
  const curve=new THREE.CatmullRomCurve3(points,false,'centripetal'),fs=curve.computeFrenetFrames(segments,false),vs=[],ix=[];
  for(let i=0;i<=segments;i++){
    const t=i/segments,center=curve.getPointAt(t),r=lerp(r0,r1,t);
    for(let j=0;j<sides;j++){const a=j/sides*TAU;vs.push(...center.clone().addScaledVector(fs.normals[i],Math.cos(a)*r).addScaledVector(fs.binormals[i],Math.sin(a)*r).toArray());}
  }
  for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;ix.push(a,b,a+sides,b,b+sides,a+sides);}
  const c=vs.length/3;vs.push(...points[0].toArray(),...points[points.length-1].toArray());
  for(let j=0;j<sides;j++){const n=(j+1)%sides;ix.push(c,n,j,c+1,segments*sides+j,segments*sides+n);}
  return geometryOf(vs,ix);
}
function bladeGeometry(base,direction,length,width,o={}){
  const{style='lance',rows=18,columns=6,normal=UP,bend=0,curl=0,wild=0,phase=0,fenestration=0}=o;
  const{D,N,W}=frame(direction,normal);
  const outline=t=>{
    const s=Math.max(0,Math.sin(Math.PI*t));let w=Math.pow(s,0.72);
    if(style==='paddle'||style==='oval')w=Math.pow(s,0.48);
    if(style==='fig')w=Math.pow(s,0.48)*(1-0.36*Math.exp(-Math.pow((t-0.48)/0.16,2)));
    if(style==='spoon')w=Math.pow(s,0.55)*(0.35+0.78*t);
    if(style==='monstera'){w=Math.pow(s,0.64)*(1.13-0.35*t);const row=Math.round(t*rows);if(fenestration>0.2&&row>5&&row<rows-3&&row%5===0)w*=1-0.66*fenestration;}
    if(style==='serrate')w*=1+0.07*Math.sin(Math.PI*t*rows);
    return w*(1+wild*0.045*Math.sin(t*31+phase));
  };
  const sample=(t,u=0)=>base.clone().addScaledVector(D,length*t).addScaledVector(W,width*0.5*outline(t)*u)
    .addScaledVector(N,bend*Math.sin(t*Math.PI*0.8)+curl*t**3+width*0.065*Math.sin(Math.PI*t)*(1-u*u)+wild*width*0.022*Math.sin(t*29+phase)*u*u);
  const vs=[],ix=[];
  for(let i=0;i<=rows;i++)for(let j=0;j<=columns;j++)vs.push(...sample(i/rows,j/columns*2-1).toArray());
  for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){
    const t=(i+0.5)/rows,u=(j+0.5)/columns*2-1;let hole=false;
    if(style==='monstera'&&fenestration>0.25)for(const center of[0.30,0.49,0.68])
      if(((t-center)/(0.044+0.012*fenestration))**2+((Math.abs(u)-0.48)/(0.14+0.035*fenestration))**2<1)hole=true;
    if(style==='paddle'&&wild>0.45&&i>rows*0.52&&i<rows-2&&i%7===0&&Math.abs(u)>0.70)hole=true;
    if(!hole){const a=i*(columns+1)+j,b=a+columns+1;ix.push(a,b,a+1,a+1,b,b+1);}
  }
  return{geometry:geometryOf(vs,ix),sample,D,N,W};
}
function fleshyGeometry(base,direction,length,width,thickness,o={}){
  const{agave=false,bend=0,curl=0,normal=UP,character=0.5,rows=18,sides=10}=o;
  const{D,N,W}=frame(direction,normal);
  const profile=t=>Math.pow(Math.max(0,Math.sin(Math.PI*t)),0.62)*(agave?1.12-0.82*t:0.48+0.82*t);
  const center=t=>base.clone().addScaledVector(D,length*t).addScaledVector(N,bend*Math.sin(Math.PI*t*0.8)+curl*t**3);
  const surface=(t,a)=>center(t).addScaledVector(W,Math.cos(a)*width*0.5*profile(t))
    .addScaledVector(N,Math.sin(a)*thickness*0.5*profile(t)*(Math.sin(a)>0?1+character*0.12*Math.cos(a*4):1));
  const vs=[],ix=[];
  for(let i=0;i<=rows;i++)for(let j=0;j<sides;j++)vs.push(...surface(i/rows,j/sides*TAU).toArray());
  for(let i=0;i<rows;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;ix.push(a,b,a+sides,b,b+sides,a+sides);}
  return{geometry:geometryOf(vs,ix),center,surface,edge:(t,side)=>surface(t,side>0?0:Math.PI),D,N,W};
}
function roundLeafGeometry(base,direction,length,width,style,normal=UP,cup=0.06){
  const{D,N,W}=frame(direction,normal),seg=style==='heart'?40:30,rings=5,center=base.clone().addScaledVector(D,length*0.48);
  const edge=a=>{
    if(style==='heart'){const x=Math.sin(a)**3,y=(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))/17;return[x*width*0.5,-y*length*0.55];}
    const scallop=style==='scallop'?1+0.09*Math.cos(a*9):1;return[Math.sin(a)*width*0.5*scallop,Math.cos(a)*length*0.5*scallop];
  };
  const sample=(r,a)=>{const[x,y]=edge(a);return center.clone().addScaledVector(W,x*r).addScaledVector(D,y*r).addScaledVector(N,length*cup*(1-r*r));};
  const vs=[],ix=[];
  for(let i=0;i<=rings;i++)for(let j=0;j<seg;j++)vs.push(...sample(i/rings,j/seg*TAU).toArray());
  for(let i=0;i<rings;i++)for(let j=0;j<seg;j++){const a=i*seg+j,b=i*seg+(j+1)%seg;ix.push(a,b,a+seg,b,b+seg,a+seg);}
  return{geometry:geometryOf(vs,ix),sample,center,D,N,W};
}
const INFO={
  'Monstera':[1.45,0.42,'rhizomatous clump'],'Bird-of-paradise':[1.85,0.34,'rhizomatous fan clump'],
  'Maidenhair fern':[0.48,0.23,'fern crowns'],'Fiddle-leaf fig':[2.35,0.52,'woody grove'],
  'Echeveria':[0.13,0.16,'rosette pups'],'Agave':[0.68,0.38,'basal rosette pups'],
  'Barrel cactus':[0.62,0.25,'basal cactus offsets'],'Columnar cactus':[1.8,0.20,'basal cactus offsets'],
  'Nepenthes pitcher plant':[0.95,0.23,'pitcher-bearing climbing clump'],
  'Venus flytrap':[0.12,0.09,'dividing rhizome colony'],'Sundew':[0.07,0.067,'sundew colony'],
  'String of pearls':[0.07,0.13,'rooted cascading succulent crowns'],
  'String of hearts':[0.06,0.12,'tuberous trailing crowns'],
  'String of turtles':[0.055,0.115,'rooted trailing epiphyte mats'],
  'Haworthia zebra':[0.15,0.10,'compact rosette offsets'],'Jade plant':[0.85,0.32,'woody succulent neighbors'],
  'Aloe vera':[0.65,0.32,'basal succulent pups'],'Fountain grass':[0.95,0.38,'tillering fountain clumps'],
  'Pampas grass':[2.1,0.65,'architectural tussocks'],'Lavender shrub':[0.65,0.33,'neighboring woody mounds'],
  'Hydrangea shrub':[1.05,0.52,'rooted branching shrubs'],'Geranium':[0.38,0.23,'basal branching neighbors'],
  'Marigold':[0.48,0.23,'neighboring annual plants'],'Boxwood topiary':[1.55,0.52,'individually trained standards'],
  'Rosemary topiary':[1.35,0.40,'trained woody standards']
};

export function createAsset(userParams={}){
  const supplied=userParams&&typeof userParams==='object'?userParams:{},p=normalize(supplied);
  const colorOverrides={...supplied};
  if(p.potStyle!=='none'){
    const defaults=POT_DEFAULTS[p.potStyle];
    for(const [i,key] of ['potBody','potRim','potDetail'].entries())
      if(hexOf(supplied[key])===null)colorOverrides[key]=defaults[i];
  }
  const C=zonesFor(p.colorway,colorOverrides),random=seededRandom(p.seed),rnd=(a,b)=>lerp(a,b,random());
  const wild=p.imperfectionAndWildness,character=p.foliageCharacter;
  const root=new THREE.Group();root.name=`Worldflora_${p.species.replace(/[^a-z0-9]+/gi,'_')}`;
  const MAT=new THREE.MeshStandardMaterial({name:'botanical',vertexColors:true,flatShading:true,side:THREE.DoubleSide,roughness:0.72});
  const DEW=new THREE.MeshPhysicalMaterial({name:'dewAndMucilage',vertexColors:true,roughness:0.06,metalness:0,transparent:true,opacity:0.74,clearcoat:1,clearcoatRoughness:0.04,depthWrite:false,side:THREE.DoubleSide});
  const GLOW=new THREE.MeshStandardMaterial({name:'pollenGlow',vertexColors:true,roughness:0.5,emissive:C.glow,emissiveIntensity:0.03});
  const materials={solid:MAT,dew:DEW,glow:GLOW};
  if(p.potStyle!=='none'){
    const ceramic=p.potStyle.startsWith('ceramic'),d=POT_DEFAULTS[p.potStyle];
    materials.pot=new THREE.MeshPhysicalMaterial({
      name:'containerFinish',vertexColors:true,flatShading:!ceramic,side:THREE.DoubleSide,
      roughness:clamp(d[3]+(p.potRoughness-0.5)*0.65,0.06,1),
      metalness:p.potStyle==='metal cachepot'?p.potMetalness:0,
      clearcoat:ceramic?0.75:0,clearcoatRoughness:0.13
    });
  }
  const components={},records=[],motions=[],rigTargets=[],memberSpecs=[];let serial=0;
  const unique=s=>`${s}_${++serial}`;
  for(const name of BOTANICAL_DETACH){
    const g=new THREE.Group();g.name=name;g.userData={component:name,detachable:true,rig:rig[name]||null};
    root.add(g);components[name]=g;
  }
  function node(parent,label,position=V(),component){
    const g=new THREE.Group();g.name=unique(label);g.position.copy(position);
    g.userData={component:component||parent.userData.component,member:parent.userData.member,detachable:true};parent.add(g);return g;
  }
  function detail(parent,label='surfaceDetails'){return node(parent,label,V(),label);}
  function add(parent,geometry,zone,label,material='solid'){
    records.push({g:geometry,c:C[zone],zone,name:unique(label),material,node:parent,component:parent.userData.component,member:parent.userData.member});return geometry;
  }
  function stem(parent,points,r0,r1,zone='stem',label='stem',segments=12,sides=6){return add(parent,sweepGeometry(points,r0,r1,segments,sides),zone,label);}
  function line(parent,a,b,r,zone,label){
    const list=[];addWire(list,a.toArray(),b.toArray(),C[zone],r,5);for(const part of list)add(parent,part.g,zone,label);
  }
  function bead(parent,at,radius,zone,label,stretch=[1,1,1],material='solid',d=1){
    const g=new THREE.IcosahedronGeometry(radius,d);g.scale(...stretch).translate(...at.toArray());return add(parent,g,zone,label,material);
  }
  function ellipsoid(parent,at,direction,radius,stretch,zone,label,segments=10){
    const g=new THREE.SphereGeometry(radius,segments,6);g.scale(...stretch);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP,direction.clone().normalize()));g.translate(...at.toArray());add(parent,g,zone,label);
  }
  function motion(target,axis,degrees,phase=0,kind='sway',harmonic=1){
    motions.push({target,axis,amplitude:rad(degrees),phase,base:target.rotation[axis],kind,harmonic});
    rigTargets.push({name:target.name,component:target.userData.component,axis,kind,restRadians:target.rotation[axis],amplitudeDegrees:degrees,
      rangeDegrees:[THREE.MathUtils.radToDeg(target.rotation[axis])-Math.abs(degrees)*2,THREE.MathUtils.radToDeg(target.rotation[axis])+Math.abs(degrees)*2]});
  }
  function leaf(parent,base,dir,L,W,zone,label,o={}){
    const b=bladeGeometry(base,dir,L,W,{wild,phase:rnd(0,TAU),...o});add(parent,b.geometry,zone,label);
    if(o.veins){
      const d=detail(parent);
      stem(d,[0,0.2,0.45,0.7,0.96].map(t=>b.sample(t).addScaledVector(b.N,L*0.003)),L*0.005,L*0.001,'vein',`${label}_midrib`,9,5);
      const pairs=o.style==='fig'?6:4;
      for(let i=1;i<=pairs;i++)for(const sign of[-1,1]){
        const t=i/(pairs+1)*0.76;
        stem(d,[b.sample(t),b.sample(t+0.07,sign*0.43),b.sample(t+0.13,sign*0.88)].map(v=>v.addScaledVector(b.N,L*0.0035)),L*0.0018,L*0.0005,'vein','lateral_vein',5,4);
      }
    }
    if(o.dew&&p.moisture>0)for(let i=0;i<Math.ceil(p.moisture*3);i++)
      bead(parent,b.sample(0.25+i*0.19,i%2?-0.25:0.23).addScaledVector(b.N,L*0.014),L*(0.008+p.moisture*0.009),'dew','leaf_dew',[1,0.8,1],'dew');
    return b;
  }
  function flesh(parent,base,dir,L,W,T,zone,label,o={}){
    const f=fleshyGeometry(base,dir,L,W,T,o);add(parent,f.geometry,zone,label);return f;
  }
  function diskFlower(parent,center,axis,size,petals=5,zone='petal',layers=1,stage=1){
    const A=axis.clone().normalize(),basis=frame(A);
    for(let layer=0;layer<layers;layer++){
      const L=size*(1-layer/Math.max(2,layers)*0.55);
      for(let j=0;j<petals;j++){
        const a=j/petals*TAU+layer*GOLD,D=basis.N.clone().multiplyScalar(Math.cos(a)*(0.35+stage*0.65))
          .addScaledVector(basis.W,Math.sin(a)*(0.35+stage*0.65)).addScaledVector(A,0.12+layer*0.13+(1-stage)*1.8);
        leaf(parent,center.clone().addScaledVector(A,layer*size*0.07),D,L,L*(petals>8?0.36:0.75),zone,'corolla_petal',
          {normal:A,bend:size*0.12,curl:-size*0.07,rows:7,columns:4,wild:0});
      }
    }
    bead(parent,center.clone().addScaledVector(A,size*0.08),size*0.16,'pollen','flower_center',[1,0.55,1],'solid',0);
  }
  function bell(parent,top,size,zone='petalAccent',axis=V(0,-1,0),slim=false){
    const{D,N,W}=frame(axis),vs=[],ix=[],rows=9,sides=20;
    for(let i=0;i<=rows;i++){
      const t=i/rows,r=size*(slim?0.12+0.055*Math.sin(t*Math.PI)+0.055*t**5:0.2+0.38*Math.sin(t*Math.PI*0.68)**1.1);
      for(let j=0;j<sides;j++){
        const a=j/sides*TAU,scallop=1+0.10*t**5*Math.cos(5*a);
        vs.push(...top.clone().addScaledVector(D,size*(t+0.045*t**5*Math.cos(5*a))).addScaledVector(N,Math.cos(a)*r*scallop).addScaledVector(W,Math.sin(a)*r*scallop).toArray());
      }
    }
    for(let i=0;i<rows;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;ix.push(a,b,a+sides,b,b+sides,a+sides);}
    add(parent,geometryOf(vs,ix),zone,slim?'open_tubular_corolla':'open_bell_corolla');
    for(let j=0;j<3;j++){
      const a=j/3*TAU,end=top.clone().addScaledVector(D,size*0.94).addScaledVector(N,Math.cos(a)*size*0.055).addScaledVector(W,Math.sin(a)*size*0.055);
      line(parent,top.clone().addScaledVector(D,size*0.45),end,size*0.012,'pollen','bell_filament');
      bead(parent,end,size*0.027,'pollen','bell_anther',[1,1,1],'solid',0);
    }
  }
  function bud(parent,at,size,zone='leafYoung',dir=UP,label='unopened_bud'){
    ellipsoid(parent,at,dir,size,[0.65,1.2,0.65],zone,label,8);
    for(let q=0;q<3;q++){
      const a=q/3*TAU,f=frame(dir);
      leaf(parent,at.clone().addScaledVector(f.D,-size),f.D.clone().addScaledVector(f.N,Math.cos(a)*0.4).addScaledVector(f.W,Math.sin(a)*0.4),
        size*1.45,size*0.40,'leafBack','bud_sepal',{rows:4,columns:2,wild:0});
    }
  }
  function rootFlare(G,k,radius,woody=false){
    for(let q=0;q<5;q++){
      const a=q*GOLD;stem(G.rootCrown,[V(0,radius*0.65,0),V(Math.cos(a)*radius*0.8,0.027*k,Math.sin(a)*radius*0.8),
        V(Math.cos(a)*radius*1.8,0.010*k,Math.sin(a)*radius*1.8)],radius*0.23,radius*0.025,woody?'bark':'root','root_contact',7,6);
    }
  }
  const topiary=p.species.includes('topiary');
  const isWoody=topiary||['Fiddle-leaf fig','Jade plant','Lavender shrub','Hydrangea shrub'].includes(p.species);
  const isTrailing=p.species.startsWith('String of'),isCactus=p.species.includes('cactus');
  const isRosette=['Echeveria','Agave','Aloe vera','Haworthia zebra','Venus flytrap','Sundew'].includes(p.species);
  const memberCount=p.growthForm==='cluster'?Math.min(p.clusterDensity,isWoody?4:7):1;
  function createMember(index){
    const m=index?Math.max(0.15,p.maturity*rnd(0.32,isWoody?0.80:0.66)):p.maturity,k=p.scale*(0.25+0.75*m);
    const a=index*GOLD+rnd(-0.15,0.15),spread=INFO[p.species][1]*p.scale;
    const radius=index?spread*rnd(isCactus?0.9:1.05,topiary?2.5:isWoody?2.1:1.45):0;
    const offset=V(Math.cos(a)*radius,0,Math.sin(a)*radius),yaw=index?rnd(0,TAU):rnd(-0.12,0.12),G={};
    for(const component of BOTANICAL_DETACH){
      const g=node(components[component],`member${index}_${component}`,offset);
      g.rotation.y=yaw;g.userData.member=index;G[component]=g;
    }
    const foot=INFO[p.species][1]*k*(isTrailing?0.92:isWoody?0.40:isCactus?0.70:0.58);
    const profile=[[0,0],[foot*0.86,0],[foot,0.007*k],[foot*0.78,0.020*k],[0,0.026*k]].map(([x,y])=>new THREE.Vector2(x,y));
    const soil=new THREE.LatheGeometry(profile,24),pos=soil.attributes.position;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=pos.getZ(i),rr=Math.hypot(x,z);
      if(rr>0.001){const aa=Math.atan2(z,x),f=1+0.035*Math.sin(aa*5+index)+0.022*Math.cos(aa*9);pos.setXYZ(i,x*f,pos.getY(i),z*f);}
    }
    add(G.rootCrown,soil,'soil','irregular_root_bed');
    for(let q=0;q<9;q++){
      const aa=q*GOLD,r=foot*rnd(0.38,0.88),at=V(Math.cos(aa)*r,0.019*k,Math.sin(aa)*r);
      bead(G.rootCrown,at,foot*rnd(0.018,0.036),q%3?'root':'soil','soil_crumb',[1.4,0.55,1],'solid',0);
      if(p.moisture>0.55&&q%2===0)bead(G.rootCrown,at.clone().add(V(0,0.002*k,0)),foot*0.085,'moss','restrained_moss_patch',[1,0.16,0.8],'solid',1);
    }
    if(index&&!isWoody&&!['Marigold','Geranium','String of turtles'].includes(p.species)){
      const connector=node(components.clusterOffsets,`offset_runner_${index}`);connector.userData.member=index;
      const end=offset.clone().multiplyScalar(0.84);
      stem(connector,[V(0,0.011*p.scale,0),end.clone().multiplyScalar(0.52).add(V(0,0.018*p.scale,0)),end.clone().add(V(0,0.011*p.scale,0))],
        0.006*k,0.003*k,'root','rooted_offset_connection',10,6);
    }
    memberSpecs.push({index,maturity:m,position:offset.toArray(),yaw,species:p.species,habit:index?INFO[p.species][2]:'primary specimen'});
    return{index,m,k,G,foot,ready:m>0.64&&p.flowering>0,offset,yaw};
  }

  function broadleafPlant(ctx,kind){
    const{G,k,m,ready}=ctx,fig=kind==='fig',bird=kind==='bird',H=(fig?2.35:bird?1.85:1.45)*k;
    const count=Math.round((fig?10:bird?6:7)+character*4+m*2);
    const trunkAt=t=>V(Math.sin(t*(fig?4:5))*(fig?0.06*wild:0.07)*k,H*t*(fig?1:0.56),Math.sin(t*3.3)*0.045*k*wild);
    if(!bird){
      stem(G.trunkOrCrown,[0,0.22,0.52,0.8,1].map(trunkAt),(fig?0.058:0.039)*k,0.012*k,fig?'bark':'stem',fig?'fig_trunk':'monstera_cane',30,10);
      for(let i=0;i<6;i++){
        const t=0.1+i*0.14,scar=new THREE.TorusGeometry((fig?0.04:0.032)*k*(1-t*0.55),0.0027*k,4,12);
        scar.rotateX(Math.PI/2).translate(...trunkAt(t).toArray());add(G.surfaceDetails,scar,fig?'root':'leafBack','old_leaf_node');
      }
      if(fig)rootFlare(G,k,0.10*k,true);
      else for(let j=0;j<3;j++){
        const a=trunkAt(0.25+j*0.17),b=V((j-1)*0.12*k,0.016*k,0.11*k);
        stem(G.rootCrown,[a,a.clone().lerp(b,0.45).add(V(0.04*k,0,0)),b],0.012*k,0.003*k,'root','monstera_aerial_root',18,6);
      }
    }else for(let j=0;j<3;j++)flesh(G.trunkOrCrown,V((j-1)*0.028*k,0.04*k,0),V((j-1)*0.1,1,0),0.22*k,0.07*k,0.045*k,'leafBack','overlapping_basal_sheath');
    for(let i=0;i<count;i++){
      const t=i/(count-1),a=i*GOLD+wild*rnd(-0.16,0.16);let start,end,D,L,W;
      if(bird){
        const fan=-1+2*t;start=V(fan*0.035*k,0.025*k,(i%2?1:-1)*0.018*k);
        end=V(fan*0.47*k,H*(0.48+0.16*(1-Math.abs(fan))),rnd(-0.095,0.095)*k);
        D=V(fan*0.60,0.95,rnd(-0.16,0.16));L=(0.65+0.25*(1-Math.abs(fan)))*k;W=(0.18+character*0.085)*k;
      }else if(fig){
        start=trunkAt(0.38+t*0.56);const reach=(0.15+0.23*Math.sin(t*Math.PI))*k;
        end=start.clone().add(V(Math.cos(a)*reach,0.07*k,Math.sin(a)*reach));
        stem(G.trunkOrCrown,[start,start.clone().lerp(end,0.5).add(V(0,-0.03*k,0)),end],0.020*k*(1-t*0.45),0.006*k,'bark','fig_lateral_branch',12,7);
        start=end.clone();end.add(V(Math.cos(a)*0.035*k,0.024*k,Math.sin(a)*0.035*k));
        D=V(Math.cos(a),0.15+0.6*t,Math.sin(a));L=(0.40+0.14*m)*k*rnd(0.85,1.06);W=L*(0.49+character*0.15);
      }else{
        start=trunkAt(0.13+t*0.84);end=start.clone().add(V(Math.cos(a)*(0.18+t*0.08)*k,(0.15+t*0.18)*k,Math.sin(a)*(0.18+t*0.08)*k));
        D=V(Math.cos(a),0.27+0.27*t,Math.sin(a));L=rnd(0.39,0.58)*k*(0.75+m*0.25);W=L*(0.66+character*0.23);
      }
      const pivot=node(i<2?G.secondaryLeaves:G.primaryLeaves,`${kind}_leaf`,start),e=end.clone().sub(start);
      stem(pivot,[V(),e.clone().multiplyScalar(0.55).add(V(0,0.025*k,0)),e],(bird?0.014:fig?0.005:0.009)*k,0.0038*k,'stem','leaf_petiole',12,6);
      leaf(pivot,e,D,L,W,i===count-1?'leafYoung':'leaf',bird?'paddle_lamina':fig?'violin_lamina':'fenestrated_lamina',{
        style:bird?'paddle':fig?'fig':'monstera',rows:bird?28:fig?24:32,columns:bird?8:16,
        bend:L*0.10,curl:-L*(0.08+wild*rnd(0.04,0.15)),fenestration:!bird&&!fig?clamp((m-0.3)*1.55,0,1)*(0.45+character*0.55):0,
        veins:true,dew:i%3===0});
      motion(pivot,bird?'z':'x',bird?1:fig?0.7:1.6,i*0.7);
    }
    if(!ready)return;
    if(fig){
      const n=Math.ceil(p.flowering*6);
      for(let i=0;i<n;i++){
        const a=i*GOLD,start=trunkAt(0.48+i/n*0.4),end=start.clone().add(V(Math.cos(a)*0.07*k,-0.025*k,Math.sin(a)*0.07*k));
        line(G.flowersOrReproductiveParts,start,end,0.003*k,'stem','fig_fruit_pedicel');
        bead(G.flowersOrReproductiveParts,end,0.023*k,i%3?'leafYoung':'fruit','fig_syconium',[0.95,1.12,0.95]);
        bead(G.flowersOrReproductiveParts,end.clone().add(V(0,-0.024*k,0)),0.003*k,'root','fig_ostiole',[1,0.4,1],'solid',0);
      }
    }else if(bird){
      for(let i=0;i<Math.ceil(p.flowering*2);i++){
        const g=node(G.flowersOrReproductiveParts,'bird_inflorescence',V((i?-0.12:0.12)*k,0,0.09*k)),top=V((i?-0.12:0.16)*k,H*0.65,0);
        stem(g,[V(),top.clone().multiplyScalar(0.55),top],0.012*k,0.008*k,'stem','bird_flower_scape',17,7);
        flesh(g,top.clone().add(V(-0.08*k,0,0)),V(1,0.09,0),0.36*k,0.073*k,0.066*k,'trapMark','horizontal_boat_spathe',{bend:0.027*k});
        for(let j=0;j<3;j++){
          const b=top.clone().add(V(j*0.044*k,0.019*k,0));
          leaf(g,b,V(-0.35+j*0.3,1,(j-1)*0.08),(0.22+j*0.025)*k,0.040*k,'petalAccent','orange_bird_sepal',{normal:V(0,0,1),bend:0.025*k,rows:15,columns:4,wild:0});
          leaf(g,b,V(0.85,0.45+j*0.2,0.12),0.18*k,0.024*k,'floralBlue','blue_arrow_petal',{normal:V(0,0,1),rows:12,columns:4,wild:0});
        }motion(g,'z',0.65,i);
      }
    }else if(m>0.76){
      const g=node(G.flowersOrReproductiveParts,'monstera_inflorescence',trunkAt(0.6)),top=V(0.12*k,0.24*k,0.05*k),axis=V(0.12,1,0).normalize();
      stem(g,[V(),top.clone().multiplyScalar(0.6),top],0.009*k,0.007*k,'stem','spadix_peduncle');
      stem(g,[top,top.clone().addScaledVector(axis,0.11*k),top.clone().addScaledVector(axis,0.22*k)],0.030*k,0.019*k,'petal','cream_spadix',14,12);
      const vs=[],ix=[];
      for(let i=0;i<=18;i++)for(let j=0;j<=16;j++){
        const t=i/18,r=0.078*k*Math.sin(Math.PI*t)**0.7,a=0.30+j/16*(TAU-0.60);
        vs.push(top.x+Math.cos(a)*r,top.y-0.03*k+t*0.29*k,top.z+Math.sin(a)*r);
      }
      for(let i=0;i<18;i++)for(let j=0;j<16;j++){const a=i*17+j;ix.push(a,a+1,a+17,a+1,a+18,a+17);}
      add(g,geometryOf(vs,ix),'petal','open_cupped_spathe');
      for(let i=0;i<32;i++)bead(g,top.clone().addScaledVector(axis,(0.02+i/32*0.18)*k).add(V(Math.cos(i*GOLD)*0.025*k,0,Math.sin(i*GOLD)*0.025*k)),0.0045*k,'pollen','spadix_floret',[1,1,1],'solid',0);
    }
  }
  function maidenhair({G,k,m,ready}){
    bead(G.trunkOrCrown,V(0,0.027*k,0),0.041*k,'root','fern_rhizome',[1,0.6,1]);
    function fan(g,at,D,L,W,zone,sori){
      const f=frame(D),vs=[...at.toArray()],ix=[];
      for(let j=0;j<=18;j++){
        const a=lerp(-1,1,j/18),sc=1+0.065*Math.cos(j/18*Math.PI*10);
        vs.push(...at.clone().addScaledVector(f.D,L*Math.cos(a)*sc).addScaledVector(f.W,Math.sin(a)*W*0.6*sc).addScaledVector(f.N,L*0.12*Math.sin(j/18*Math.PI)).toArray());
      }
      for(let j=1;j<=18;j++)ix.push(0,j+1,j);add(g,geometryOf(vs,ix),zone,'maidenhair_fan_pinnule');
      for(let j=0;j<3;j++){
        const a=(j-1)*0.62,end=at.clone().addScaledVector(f.D,L*Math.cos(a)*0.85).addScaledVector(f.W,Math.sin(a)*W*0.5).addScaledVector(f.N,L*0.035);
        line(g,at,end,L*0.009,'leafBack','fan_radiating_vein');
        if(sori)bead(g,end.clone().addScaledVector(f.N,-L*0.045),L*0.052,'spine','marginal_sorus',[1.6,0.45,0.7],'solid',0);
      }
    }
    const n=Math.round(5+m*3+character*3);
    for(let j=0;j<n;j++){
      const a=j*GOLD,g=node(G.primaryLeaves,'maidenhair_frond',V(0,0.022*k,0)),D=V(Math.cos(a),0,Math.sin(a)),W=V(-Math.sin(a),0,Math.cos(a)),L=rnd(0.29,0.46)*k;
      const pts=[V(),D.clone().multiplyScalar(L*0.18).add(V(0,L*0.55,0)),D.clone().multiplyScalar(L*0.61).add(V(0,L*0.85,0)),D.clone().multiplyScalar(L).add(V(0,L*0.71,0))];
      const curve=new THREE.CatmullRomCurve3(pts);stem(g,pts,0.0032*k,0.0006*k,'wireStem','black_wiry_rachis',22,5);
      const pairs=Math.round(5+character*3);
      for(let row=0;row<pairs;row++)for(const sign of[-1,1]){
        const t=0.25+row/pairs*0.67,at=curve.getPoint(t),D2=W.clone().multiplyScalar(sign).addScaledVector(D,0.28).normalize(),end=at.clone().addScaledVector(D2,L*(0.28-0.18*t));
        stem(g,[at,at.clone().lerp(end,0.5).add(V(0,0.012*k,0)),end],0.0012*k,0.0004*k,'wireStem','fern_pinna_stalk',7,4);
        for(let q=0;q<3;q++){
          const l=(0.027+0.014*(1-t))*k;
          fan(g,at.clone().lerp(end,(q+1)/3),D2.clone().addScaledVector(D,q%2?0.65:-0.65),l,l*1.45,row===pairs-1?'leafYoung':'leaf',ready&&row<2&&q===2);
        }
      }
      fan(g,pts[3],D,0.030*k,0.045*k,'leafYoung',false);motion(g,'z',1.4,j*0.58);
    }
    for(let j=0;j<2;j++){
      const pts=[V(j*0.016*k,0.03*k,0)];
      for(let i=0;i<=16;i++){const t=i/16,a=t*Math.PI*1.8;pts.push(V((j*0.016+Math.sin(a)*0.026*(1-t*0.65))*k,(0.045+t*0.12+Math.cos(a)*0.022*(1-t))*k,0));}
      stem(G.secondaryLeaves,pts,0.0028*k,0.001*k,'wireStem','unfurling_crozier',24,5);
    }
  }
  function rosette(ctx,type){
    const{G,k,m,ready}=ctx,agave=type==='agave',eche=type==='echeveria',haw=type==='haworthia',aloe=type==='aloe',added=haw||aloe,compact=p.rosetteCompactness;
    const count=Math.round((eche?23:haw?19:aloe?12:14)+character*(eche?11:haw?9:7)),y=(agave||aloe?0.032:0.018)*k;
    bead(G.trunkOrCrown,V(0,y,0),(agave||aloe?0.058:0.026)*k,'stem','compact_rosette_crown',[1,0.8,1]);
    for(let i=0;i<count;i++){
      const t=i/(count-1),a=i*GOLD+wild*rnd(-0.06,0.06);
      const L=(eche?lerp(0.20,0.053,t):haw?lerp(0.135,0.065,t):aloe?lerp(0.63,0.29,t):lerp(0.65,0.27,t))*k*(1.12-compact*0.20);
      const rise=lerp(eche?0.035:haw?0.6:0.20,haw?3:2.4,t*t)+(compact-0.6)*0.8,D=V(Math.cos(a),Math.max(0.025,rise),Math.sin(a));
      const W=L*(eche?0.43+character*0.16:haw?0.27:aloe?0.15+character*0.035:0.13+character*0.065),T=W*(haw?0.60:eche?0.34+character*0.19:aloe?0.53:0.31);
      const base=V(Math.cos(a)*0.006*k*(1-t),y+t*(agave||aloe?0.042:0.027)*k,Math.sin(a)*0.006*k*(1-t));
      const parent=added?node(G.succulentRosetteLeaves,`${type}_living_leaf`,base):(i>count*0.75?G.secondaryLeaves:G.primaryLeaves);
      const b=flesh(parent,added?V():base,D,L,W,T,haw?(i>count*0.75?'leafYoung':'leaf'):aloe?(i%4?'cactus':'leafYoung'):agave?(i%4?'cactus':'wax'):i%5?'wax':'leafBack',
        `${type}_closed_fleshy_leaf`,{agave:!eche,bend:L*0.14,curl:-L*(agave?0.10:0.035),character});
      const d=added?detail(parent):G.surfaceDetails;
      if(added)motion(parent,'x',haw?0.07:0.18,i*0.45,'succulent stillness');
      if(haw){
        const bands=3+Math.round(6*p.variegationStrength);
        if(p.variegationStrength>0)for(let row=0;row<bands;row++){
          const tt=0.19+row/bands*0.61;
          for(const underside of[false,true]){
            const pts=[];for(let q=0;q<=8;q++){const aa=(underside?Math.PI:0)+0.08+q/8*(Math.PI-0.16);pts.push(b.surface(tt+0.012*Math.sin(q*0.9+row),aa).addScaledVector(b.N,(underside?-1:1)*0.00035*k));}
            stem(d,pts,(0.0003+0.00055*p.variegationStrength)*k,0.00035*k,'band','raised_zebra_transverse_band',10,4);
          }
        }
        stem(d,[b.center(0.95),b.center(1),b.center(1).addScaledVector(b.D,0.003*k)],0.0012*k,0.00008*k,'wireStem','dark_haworthia_tip',4,4);
        if(i<3)bead(d,b.surface(0.85,Math.PI/2),0.002*k,'dew','subtle_leaf_window',[0.7,0.3,1.4],'dew',1);
      }else if(agave||aloe){
        for(const side of aloe?[-0.38,0,0.38]:[0]){
          if(aloe&&p.variegationStrength===0)continue;
          const aa=Math.acos(side),pts=[0.08,0.28,0.5,0.73,0.94].map(tt=>b.surface(tt,aa).addScaledVector(b.N,0.0008*k));
          stem(d,pts,(aloe?0.0008+p.variegationStrength*0.0013:0.0015)*k,0.0004*k,'rib','longitudinal_leaf_stripe',14,4);
        }
        if(m>0.35)for(let j=1;j<=(aloe?14:9);j++)for(const sign of[-1,1]){
          const at=b.edge(j/(aloe?16:11),sign),end=at.clone().addScaledVector(b.W,sign*(aloe?0.005:0.009)*k).addScaledVector(b.D,-0.003*k).addScaledVector(b.N,0.002*k);
          stem(d,[at,at.clone().lerp(end,0.6),end],(aloe?0.0012:0.0015)*k,0.00008*k,aloe?'band':'spine','marginal_leaf_tooth',3,4);
        }
        stem(d,[b.center(0.97),b.center(1),b.center(1).addScaledVector(b.D,(aloe?0.009:0.024)*k)],0.002*k,0.0001*k,aloe?'rim':'spine','pointed_leaf_tip',4,5);
      }else if(i<count*0.7){
        bead(d,b.center(1),0.0025*k,'rim','blushed_leaf_tip',[1,0.8,1.2],'solid',0);
        if(p.moisture>0.65&&i%8===0)bead(d,b.surface(0.58,Math.PI/2).addScaledVector(b.N,0.003*k),0.003*k,'dew','succulent_dew',[1,0.85,1],'dew');
      }
    }
    if(!ready||(agave&&m<0.95)||(added&&p.flowerDensity===0))return;
    if(aloe||haw){
      const g=node(G.flowerScapes,`${type}_flower_scape`),H=(aloe?1.0:0.34)*k,top=V((aloe?0.065:0.028)*k,H,0);
      stem(g,[V(0,y,0),V(top.x*0.35,H*0.6,0),top],(aloe?0.007:0.0017)*k,(aloe?0.003:0.0007)*k,'stem','succulent_scape',24,7);
      const n=Math.round((aloe?15:4)+p.flowerDensity*p.flowering*(aloe?28:9));
      for(let j=0;j<n;j++){
        const t=j/n,aa=j*GOLD,at=V(top.x*(0.78+t*0.22),H*(0.69+t*0.30),0);
        const end=at.clone().add(V(Math.cos(aa)*(aloe?0.029:0.012)*k,0.004*k,Math.sin(aa)*(aloe?0.029:0.012)*k));
        line(g,at,end,(aloe?0.0012:0.00045)*k,'stem','raceme_pedicel');
        if(p.bloomStage<0.25||t>0.80+p.bloomStage*0.15)bud(detail(g,'budsAndSpentBlooms'),end,(aloe?0.010:0.003)*k,'leafYoung');
        else bell(g,end,(aloe?0.05:0.013)*k,aloe?'petalAccent':'petal',V(Math.cos(aa)*0.35,-1,Math.sin(aa)*0.35),true);
      }motion(g,'z',aloe?0.85:1.15,0.4,'scape arch');
    }else if(agave){
      const g=node(G.flowersOrReproductiveParts,'agave_panicle'),H=1.65*k;
      stem(g,[V(0,y,0),V(0.025*k,H*0.55,0),V(0,H,0)],0.023*k,0.006*k,'stem','agave_mast',25,8);
      const n=4+Math.round(p.flowering*3);
      for(let j=0;j<n;j++){
        const t=j/n,a=j*GOLD,at=V(0.015*k,H*(0.48+t*0.47),0),end=at.clone().add(V(Math.cos(a)*(0.29-t*0.16)*k,0.075*k,Math.sin(a)*(0.29-t*0.16)*k));
        stem(g,[at,at.clone().lerp(end,0.6),end],0.009*k,0.003*k,'stem','panicle_branch',8,6);
        for(let q=0;q<5;q++){
          const aa=q/5*TAU,top=end.clone().add(V(Math.cos(aa)*0.045*k,0.04*k,Math.sin(aa)*0.045*k));
          line(g,end,top,0.002*k,'stem','agave_floret_stalk');diskFlower(g,top,UP,0.023*k,6,'leafYoung');
        }
      }
    }else{
      const g=node(G.flowersOrReproductiveParts,'echeveria_scape'),H=(0.32+p.flowering*0.11)*k;
      const curve=new THREE.CatmullRomCurve3([V(0.022*k,0.03*k,0),V(0.035*k,H*0.72,0),V(0.12*k,H,0.015*k),V(0.17*k,H-0.025*k,0.015*k)]);
      stem(g,curve.points,0.004*k,0.0013*k,'rim','arching_echeveria_scape',22,6);
      const n=3+Math.round(p.flowering*5);
      for(let j=0;j<n;j++){
        const at=curve.getPoint(0.46+j/n*0.49),end=at.clone().add(V((j%2?1:-1)*0.034*k,0.008*k,0.015*k));
        stem(g,[at,at.clone().lerp(end,0.6),end],0.0016*k,0.0008*k,'rim','echeveria_pedicel',5,4);bell(g,end,0.032*k);
      }motion(g,'z',1,0.4);
    }
  }
  function cactus({G,k,m,ready},columnar){
    const H=(columnar?1.8*(0.75+m*0.25):0.62)*k,R=(columnar?0.14:0.285)*k*(0.9+character*0.1);
    const ribs=Math.round(columnar?8+character*4:12+character*6),sides=ribs*6,rows=columnar?34:28,lean=wild*rnd(-0.06,0.06)*H;
    function radius(t){
      if(!columnar)return R*Math.sin(Math.PI*t)**0.62;
      if(t<0.08)return R*Math.sqrt(Math.max(0,1-(1-t/0.08)**2));
      if(t>0.90)return R*Math.sqrt(Math.max(0,1-((t-0.90)/0.10)**2));
      return R*(1+0.035*Math.sin(t*8));
    }
    const surface=(t,a,extra=0)=>{const r=radius(t)*(1+(0.10+character*0.075)*Math.cos(a*ribs))+extra;return V(Math.cos(a)*r+lean*t*t,0.015*k+H*t,Math.sin(a)*r);};
    const vs=[],ix=[];
    for(let i=0;i<=rows;i++)for(let j=0;j<sides;j++)vs.push(...surface(i/rows,j/sides*TAU).toArray());
    for(let i=0;i<rows;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;ix.push(a,a+sides,b,b,a+sides,b+sides);}
    add(G.trunkOrCrown,geometryOf(vs,ix),'cactus',columnar?'continuous_ribbed_column':'water_storing_barrel');
    const n=Math.round(columnar?9+m*5:6+m*3);
    for(let j=0;j<ribs;j++){
      const a=j/ribs*TAU;
      stem(G.surfaceDetails,Array.from({length:19},(_,i)=>surface(0.06+i/18*0.89,a,0.0008*k)),0.0015*k,0.0006*k,'rib','rib_highlight',24,4);
      for(let row=0;row<n;row++){
        const t=0.1+row/(n-1)*0.8,at=surface(t,a,0.0018*k),out=V(Math.cos(a),columnar?0.04:(t-0.45)*0.55,Math.sin(a)).normalize(),tangent=V(-Math.sin(a),0,Math.cos(a));
        ellipsoid(G.surfaceDetails,at,out,(columnar?0.007:0.009)*k,[1,0.35,1.3],'areole','felted_areole',8);
        for(let q=0;q<(columnar?4:6);q++){
          const aa=q/(columnar?4:6)*TAU,L=(columnar?0.020:0.033)*k*rnd(0.8,1.2);
          const end=at.clone().addScaledVector(out,L*0.62).addScaledVector(tangent,Math.cos(aa)*L*0.6).add(V(0,Math.sin(aa)*L*0.65,0));
          stem(G.surfaceDetails,[at,at.clone().lerp(end,0.6),end],0.0011*k,0.00008*k,'spine','radial_spine',3,4);
        }
        const end=at.clone().addScaledVector(out,(columnar?0.034:0.046)*k).add(V(0,-0.008*k,0));
        stem(G.surfaceDetails,[at,at.clone().lerp(end,0.6).add(V(0,0.004*k,0)),end],0.0016*k,0.00008*k,'spine','central_spine',5,4);
      }
    }
    bead(G.surfaceDetails,V(lean,H+0.011*k,0),R*0.25,'areole','apical_wool',[1,0.2,1]);
    if(!ready)return;
    const nF=Math.ceil(p.flowering*(columnar?2:5));
    for(let j=0;j<nF;j++){
      const a=j*GOLD+0.4,at=surface(columnar?0.83-j*0.11:0.93,a,0.008*k),axis=V(Math.cos(a)*(columnar?1:0.25),columnar?0.65:1,Math.sin(a)*(columnar?1:0.25)).normalize();
      const end=at.clone().addScaledVector(axis,(columnar?0.10:0.028)*k);
      stem(G.flowersOrReproductiveParts,[at,at.clone().lerp(end,0.5),end],(columnar?0.022:0.010)*k,0.011*k,'trap','cactus_flower_tube',8,8);
      diskFlower(G.flowersOrReproductiveParts,end,axis,(columnar?0.12:0.064)*k,columnar?15:12,columnar?'petal':'petalAccent',3);
    }
  }
  function nepenthes({G,k,m,ready}){
    const H=0.95*k,cane=t=>V(0.06*k*Math.sin(t*4),0.025*k+H*t,0.025*k*Math.sin(t*5));
    stem(G.trunkOrCrown,[0,0.3,0.65,1].map(cane),0.011*k,0.004*k,'stem','climbing_cane',25,7);
    const count=Math.round(6+character*3+m*2);
    for(let j=0;j<count;j++){
      const a=j*GOLD,base=cane(0.12+j/count*0.83),D=V(Math.cos(a),0.13,Math.sin(a)),L=rnd(0.23,0.34)*k,g=node(G.primaryLeaves,'pitcher_bearing_shoot',base);
      const b=leaf(g,V(),D,L,L*(0.20+character*0.065),j>count-3?'leafYoung':'leaf','pitcher_bearing_lamina',{bend:0.023*k,curl:-0.036*k,veins:true,dew:j%3===0,rows:20,columns:6});
      const tip=b.sample(1),traps=detail(g,'carnivorousTraps');
      if(j%4===3&&j!==count-1){
        const pts=Array.from({length:19},(_,q)=>{const t=q/18;return tip.clone().add(V(Math.cos(a)*0.07*k*t+Math.sin(t*TAU)*0.025*k*t,0.02*k*Math.sin(t*Math.PI),Math.sin(a)*0.07*k*t));});
        stem(traps,pts,0.002*k,0.0005*k,'rim','coiling_unloaded_tendril',22,5);motion(g,'z',0.45,j*0.8);continue;
      }
      const h=(0.17+character*0.055)*k*rnd(0.78,1.12),r=h*(j<3?0.28:0.23),mouth=tip.clone().add(V(Math.cos(a)*0.07*k,-0.09*k,Math.sin(a)*0.07*k));
      const pitcher=node(traps,'nepenthes_pitcher',mouth);pitcher.rotation.y=-a+Math.PI*0.5;pitcher.rotation.z=rnd(-0.055,0.055)*wild;pitcher.updateMatrix();
      const posterior=V(0,0,-r),attachment=posterior.clone().applyMatrix4(pitcher.matrix);
      stem(traps,[tip,tip.clone().lerp(attachment,0.45).add(V(0,0.025*k,0)),attachment],0.0027*k,0.0018*k,'rim','load_bearing_tendril',16,5);
      const profile=[[0,-1],[0.48,-0.97],[0.94,-0.84],[1.08,-0.65],[0.99,-0.43],[0.79,-0.20],[0.88,-0.055],[1,0]].map(([x,y])=>new THREE.Vector2(x*r,y*h));
      add(pitcher,new THREE.LatheGeometry(profile,24),'trap','hollow_pitcher_outer_wall');
      const wall=0.003*k,inner=[...profile].reverse().map((v,i)=>new THREE.Vector2(Math.max(0,v.x-wall),v.y+(i===profile.length-1?wall:0)));
      add(pitcher,new THREE.LatheGeometry(inner,24),'trapInterior','visible_pitcher_inner_cavity');
      const lip=new THREE.TorusGeometry(r,0.006*k,7,36);lip.rotateX(Math.PI/2);add(pitcher,lip,'rim','open_rolled_peristome');
      const d=detail(pitcher);
      for(let q=0;q<32;q++){
        const aa=q/32*TAU;line(d,V(Math.cos(aa)*(r-0.005*k),0.003*k,Math.sin(aa)*(r-0.005*k)),V(Math.cos(aa)*(r+0.005*k),0.003*k,Math.sin(aa)*(r+0.005*k)),0.00075*k,'petalAccent','peristome_radial_rib');
      }
      const radiusAt=t=>{
        const y=-h+t*h;
        for(let q=0;q<profile.length-1;q++)if(y<=profile[q+1].y)return lerp(profile[q].x,profile[q+1].x,(y-profile[q].y)/(profile[q+1].y-profile[q].y));
        return r;
      };
      for(let q=0;q<20;q++){
        const t=rnd(0.17,0.91),aa=q*GOLD,rr=radiusAt(t)+0.0008*k,mark=new THREE.IcosahedronGeometry(0.005*k,0);
        mark.scale(rnd(0.5,1),rnd(1.1,2.3),0.16).rotateY(Math.PI/2-aa).translate(Math.cos(aa)*rr,-h+t*h,Math.sin(aa)*rr);add(d,mark,'trapMark','pitcher_mottling');
      }
      for(const sign of[-1,1]){
        const aa=Math.PI/2+sign*0.33,pts=Array.from({length:13},(_,q)=>{const t=0.12+q/12*0.76,rr=radiusAt(t)+0.002*k;return V(Math.cos(aa)*rr,-h+t*h,Math.sin(aa)*rr);});
        stem(d,pts,0.0025*k,0.0015*k,'rim','pitcher_frontal_wing',16,4);
        for(let q=1;q<12;q++)line(d,pts[q],pts[q].clone().add(V(sign*0.003*k,0.003*k,0.009*k)),0.0008*k,'rim','wing_fringe');
      }
      const lid=node(pitcher,'pitcher_lid_hinge',posterior);
      stem(lid,[V(),V(0,0.015*k,-0.006*k),V(0,0.022*k,-0.014*k)],0.003*k,0.0017*k,'rim','lid_neck',7,5);
      leaf(lid,V(0,0.014*k,-0.005*k),V(0,0.50,-1),r*2,r*1.8,'trap','raised_pitcher_lid',{style:'paddle',normal:V(0,1,0.5),bend:0.01*k,rows:16,columns:8,veins:true,wild:0});
      motion(g,'z',0.45,j*0.8);motion(pitcher,'z',1.1,j*0.61,'pitcher nod');motion(lid,'x',0.65,j*0.61+0.4,'lid tremor');
    }
    if(ready){
      const g=node(G.flowersOrReproductiveParts,'nepenthes_raceme',cane(0.94)),top=V(0.04*k,0.32*k,0);
      stem(g,[V(),V(0.02*k,0.17*k,0),top],0.003*k,0.0009*k,'stem','pitcher_flower_raceme',16,5);
      const n=6+Math.round(p.flowering*10);
      for(let j=0;j<n;j++){
        const a=j*GOLD,at=top.clone().multiplyScalar(0.2+j/n*0.75),end=at.clone().add(V(Math.cos(a)*0.025*k,-0.008*k,Math.sin(a)*0.025*k));
        line(g,at,end,0.0007*k,'stem','raceme_pedicel');diskFlower(g,end,V(Math.cos(a),0.25,Math.sin(a)),0.009*k,4,'leafYoung');
      }motion(g,'z',1,0.6);
    }
  }
  function carnivoreFlowers({G,k,ready},sundew){
    if(!ready)return;
    const H=(sundew?0.25:0.29)*k,g=node(G.flowersOrReproductiveParts,sundew?'sundew_scape':'flytrap_scape'),top=V(0.026*k,H,0.006*k);
    stem(g,[V(0,0.015*k,0),V(0.013*k,H*0.6,0),top],0.0018*k,0.00065*k,sundew?'rim':'stem','elevated_flower_scape',20,5);
    const n=2+Math.round(p.flowering*4);
    for(let j=0;j<n;j++){
      const a=j*GOLD,at=top.clone().add(V(0,-j*0.013*k,0)),end=at.clone().add(V(Math.cos(a)*0.025*k,0.012*k,Math.sin(a)*0.025*k));
      stem(g,[at,at.clone().lerp(end,0.5),end],0.0007*k,0.0004*k,'stem','flower_pedicel',5,4);
      if(j<Math.ceil(n*p.flowering))diskFlower(g,end,V(0.1,1,0.15),(sundew?0.012:0.018)*k,5);else bud(g,end,0.004*k);
    }motion(g,'z',1.1,0.4);
  }
  function flytrap(ctx){
    const{G,k,m}=ctx;bead(G.trunkOrCrown,V(0,0.013*k,0),0.016*k,'leafBack','flytrap_rhizome',[1,0.7,1]);
    const n=Math.round(6+character*4+m*2);
    for(let j=0;j<n;j++){
      const a=j*GOLD,D=V(Math.cos(a),0.2+j/n*0.45,Math.sin(a)),L=rnd(0.060,0.096)*k;
      const b=leaf(G.primaryLeaves,V(0,0.014*k,0),D,L,L*(0.30+character*0.14),j>n-3?'leafYoung':'leaf','winged_flytrap_petiole',{style:'spoon',bend:0.009*k,curl:-0.004*k,rows:15,columns:6});
      const hinge=node(G.carnivorousTraps,'flytrap_hinge',b.sample(1));hinge.rotation.y=Math.PI/2-a;hinge.rotation.x=rnd(-0.09,0.09)*wild;
      const l=(0.022+character*0.008)*k*rnd(0.87,1.1),w=l*1.03;
      stem(hinge,[V(0,0,-w),V(),V(0,0,w)],0.0012*k,0.0012*k,'leafYoung','trap_midrib_hinge',8,5);
      for(const sign of[-1,1]){
        const jaw=node(hinge,sign>0?'flytrap_right_jaw':'flytrap_left_jaw');jaw.rotation.z=sign*rad(23+j%3*5);
        const makeJaw=underside=>{
          const vs=[],ix=[],rows=7,sides=20;
          for(let q=0;q<=rows;q++)for(let s=0;s<=sides;s++){const r=q/rows,aa=-Math.PI/2+s/sides*Math.PI;vs.push(sign*l*r*Math.cos(aa),l*0.13*r*r-(underside?0.0012*k:0),w*r*Math.sin(aa));}
          for(let q=0;q<rows;q++)for(let s=0;s<sides;s++){const a0=q*(sides+1)+s,b0=a0+sides+1;ix.push(a0,b0,a0+1,a0+1,b0,b0+1);}return geometryOf(vs,ix);
        };
        add(jaw,makeJaw(false),'trapInterior','sensitive_red_inner_lobe');add(jaw,makeJaw(true),'trap','green_outer_lobe');
        stem(jaw,Array.from({length:21},(_,q)=>{const aa=-Math.PI/2+q/20*Math.PI;return V(sign*l*Math.cos(aa),l*0.13,w*Math.sin(aa));}),0.0012*k,0.0012*k,'leafYoung','living_trap_margin',24,5);
        for(let q=0;q<13;q++){
          const aa=-1.43+(q+(sign>0?0.12:0.5))/13*2.86,at=V(sign*l*Math.cos(aa),l*0.13,w*Math.sin(aa)),e=(0.009+character*0.005)*k*Math.cos(aa)**0.25;
          const end=at.clone().add(V(sign*Math.cos(aa)*e*0.45,e*0.92,Math.sin(aa)*e*0.55));
          stem(jaw,[at,at.clone().lerp(end,0.55).add(V(sign*e*0.18,0,0)),end],0.00065*k,0.00006*k,'leafYoung','interlocking_marginal_cilium',5,4);
        }
        for(let q=0;q<3;q++){
          const at=V(sign*l*(q===1?0.58:0.38),l*0.038,(q-1)*w*0.40);
          stem(jaw,[at,at.clone().add(V(0,0.003*k,0)),at.clone().add(V(-sign*0.0008*k,0.0055*k,0))],0.00032*k,0.00005*k,'trapMark','sensory_trigger_hair',3,4);
        }
        motion(jaw,'z',sign*5,j*0.55,sign>0?'right jaw opening':'left jaw opening');
      }
    }carnivoreFlowers(ctx,false);
  }
  function sundew(ctx){
    const{G,k,m}=ctx;bead(G.trunkOrCrown,V(0,0.009*k,0),0.011*k,'stem','sundew_growth_point',[1,0.7,1]);
    const n=Math.round(9+character*5+m*3);
    for(let j=0;j<n;j++){
      const a=j*GOLD,D=V(Math.cos(a),0.10+(j/n)**3*0.85,Math.sin(a)).normalize(),base=V(0,0.01*k,0),L=rnd(0.030,0.052)*k;
      const petiole=leaf(G.primaryLeaves,base,D,L,0.005*k,'leafYoung','narrow_sundew_petiole',{rows:10,columns:2,bend:0.004*k,wild:0});
      const g=node(G.carnivorousTraps,'sundew_spatulate_trap',petiole.sample(1)),h=rnd(0.026,0.037)*k;
      const b=leaf(g,V(),D,h,h*(0.66+character*0.14),'trapInterior','glandular_spoon_lamina',{style:'spoon',rows:16,columns:8,bend:0.003*k,curl:j>n-3?0.009*k:0.001*k,wild:0});
      const count=Math.round(24+character*16);
      for(let q=0;q<count;q++){
        const edge=q<20,t=edge?0.14+q%10/9*0.75:rnd(0.25,0.87),u=edge?q<10?-0.94:0.94:rnd(-0.7,0.7);
        const at=b.sample(t,u).addScaledVector(b.N,0.0004*k),l=(edge?rnd(0.007,0.012):rnd(0.003,0.006))*k;
        const out=b.W.clone().multiplyScalar(u).addScaledVector(b.D,(t-0.5)*0.7),tip=at.clone().addScaledVector(out,l*(edge?0.48:0.12)).addScaledVector(b.N,l);
        stem(g,[at,at.clone().lerp(tip,0.55).addScaledVector(out,l*0.12),tip],0.00036*k,0.00017*k,'rim','red_glandular_tentacle',5,4);
        bead(g,tip,0.00067*k,'trapMark','tentacle_gland',[1,1,1],'solid',0);
        bead(g,tip.clone().addScaledVector(b.N,0.0004*k),(0.00115+p.moisture*0.00065)*k,'mucilage','adhesive_mucilage_drop',[1,1.12,1],'dew');
      }motion(g,'z',0.65,j*0.48,'sundew shimmer');
    }carnivoreFlowers(ctx,true);
  }
  function trailing(ctx,type){
    const{G,k,m,ready,foot}=ctx,pearls=type==='pearls',hearts=type==='hearts';
    rootFlare(G,k,foot*0.27);
    if(hearts)for(let q=0;q<3;q++)bead(G.rootCrown,V(Math.cos(q*GOLD)*foot*0.23,0.025*k,Math.sin(q*GOLD)*foot*0.23),0.014*k,'root','tuberous_root_crown',[1.2,0.8,1]);
    const n=Math.round(5+p.strandDensity*13+m*3);
    for(let j=0;j<n;j++){
      const a=j*GOLD+rnd(-0.15,0.15),radial=V(Math.cos(a),0,Math.sin(a)),side=V(-Math.sin(a),0,Math.cos(a)),short=j%6===0;
      const anchor=radial.clone().multiplyScalar(foot*rnd(0.15,0.38)).add(V(0,0.026*k,0));
      const drop=p.trailingLength*k*(short?rnd(0.10,0.22):rnd(0.53,1.04)),reach=foot*rnd(1.15,1.9),twist=rnd(-1,1)*(0.035+wild*0.06)*k;
      const pts=[V(),radial.clone().multiplyScalar(foot*0.5).add(V(0,0.014*k,0)),
        radial.clone().multiplyScalar(reach*0.86).add(V(0,-drop*0.16,0)),
        radial.clone().multiplyScalar(reach).addScaledVector(side,twist).add(V(0,-drop*0.60,0)),
        radial.clone().multiplyScalar(reach*(0.92+wild*0.16)).addScaledVector(side,twist*0.4).add(V(0,-drop,0))];
      const g=node(G.trailingStrands,`${type}_trailing_strand`,anchor),curve=new THREE.CatmullRomCurve3(pts,false,'centripetal');
      stem(g,pts,(pearls?0.0018:0.0011)*k,0.0004*k,hearts?'wireStem':'stem','continuous_trailing_vine',30,5);
      const d=detail(g),length=curve.getLength(),spacing=(pearls?0.035:hearts?0.060:0.036)*k,count=Math.max(5,Math.floor(length/spacing)),bareAt=0.28+(j%4)*0.12;
      for(let q=0;q<count;q++){
        const t=(q+0.6)/count;if(j%3===0&&Math.abs(t-bareAt)<0.044)continue;
        const at=curve.getPointAt(t),tangent=curve.getTangentAt(t),youth=t>0.82?lerp(1,0.43,(t-0.82)/0.18):1;
        if(pearls){
          const rr=(0.010+character*0.004)*k*youth*rnd(0.88,1.08),out=frame(tangent).N.multiplyScalar(q%2?1:-1),center=at.clone().addScaledVector(out,rr*0.65);
          line(g,at,center,0.00065*k,'stem','pearl_pedicel');
          add(g,new THREE.SphereGeometry(rr,12,8).translate(...center.toArray()),youth<0.8?'leafYoung':q%7?'leaf':'cactus','plump_spherical_pearl');
          if(p.variegationStrength>0.2&&q%3===0){
            const f=frame(out),ps=[];for(let s=0;s<=7;s++){const aa=-0.85+s/7*1.7;ps.push(center.clone().addScaledVector(out,Math.cos(aa)*rr*1.012).addScaledVector(f.W,Math.sin(aa)*rr));}
            stem(d,ps,rr*0.025*p.variegationStrength,rr*0.014,'rib','pearl_epidermal_window',8,4);
          }
          if(p.moisture>0.8&&q===3&&j%4===0)bead(d,center.clone().add(V(0,rr,0)),rr*0.18,'dew','pearl_dew',[1,0.8,1],'dew');
        }else{
          const pairs=hearts?2:1;
          for(let s=0;s<pairs;s++){
            const sign=s?-1:1,aa=a+q*0.81,D=V(Math.cos(aa)*sign,0.20-(q%3)*0.22,Math.sin(aa)*sign).normalize(),base=at.clone().addScaledVector(D,0.006*k);
            line(g,at,base,0.00045*k,'stem','trailing_leaf_petiole');
            const normal=radial.clone().add(V(0,q%4===0?-0.8:0.65,0)).normalize(),L=(hearts?0.029:0.024)*k*youth*rnd(0.9,1.12);
            const b=roundLeafGeometry(base,D,L,L*(hearts?0.96:0.92),hearts?'heart':'disk',normal,hearts?0.06:0.11);
            add(g,b.geometry,q%9===0?'leafBack':youth<0.7?'leafYoung':'leaf',hearts?'paired_cordate_leaf':'domed_turtle_shell_leaf');
            if(!hearts){
              const back=roundLeafGeometry(base.clone().addScaledVector(b.N,-L*0.025),D,L,L*0.92,'disk',normal,-0.04);
              add(g,back.geometry,'leafBack','turtle_leaf_underside');
            }
            if(p.variegationStrength>0){
              if(hearts){
                for(let z=0;z<5;z++){
                  const aa2=0.35+z/5*TAU,ps=[0.18,0.43,0.76].map(r=>b.sample(r,aa2).addScaledVector(b.N,L*0.006));
                  stem(d,ps,L*0.010*p.variegationStrength,L*0.003,'silver','heart_silver_vein',5,4);
                }
              }else{
                const ps=Array.from({length:19},(_,z)=>b.sample(0.48,z/18*TAU).addScaledVector(b.N,L*0.01));
                stem(d,ps,L*0.014*p.variegationStrength,L*0.014*p.variegationStrength,'vein','turtle_polygon_ring',18,4);
                for(let z=0;z<6;z++){
                  const aa2=z/6*TAU;stem(d,[b.sample(0.46,aa2+0.15),b.sample(0.68,aa2+0.24),b.sample(0.93,aa2+0.19)].map(v=>v.addScaledVector(b.N,L*0.008)),
                    L*0.012*p.variegationStrength,L*0.005,'vein','turtle_shell_seam',4,4);
                }
              }
            }
          }
        }
        if(!pearls&&q%11===4&&j%3===0){
          const end=at.clone().add(V(0.009*k,-0.026*k,0.004*k));
          stem(d,[at,at.clone().lerp(end,0.55).add(V(0.005*k,0,0)),end],0.00055*k,0.00008*k,'root','fine_aerial_root',7,4);
          if(hearts&&q%2===0)bead(d,at,0.004*k,'root','aerial_tuber',[1,0.8,1]);
        }
      }
      if(ready&&p.flowerDensity>0&&j<Math.ceil(p.flowering*p.flowerDensity*5)){
        const f=detail(g,'flowerHeads'),at=curve.getPointAt(0.18+j*0.07),end=at.clone().add(V(0,0.035*k,0));
        line(f,at,end,0.0008*k,'stem','trailing_inflorescence_stalk');
        if(p.bloomStage<0.22)bud(detail(f,'budsAndSpentBlooms'),end,0.004*k,hearts?'pink':'leafYoung');
        else if(hearts){
          bell(f,end,0.020*k,'pink',V(0.25,1,0.1),true);
          for(let z=0;z<5;z++){
            const aa=z/5*TAU;
            stem(f,[end.clone().add(V(Math.cos(aa)*0.003*k,0.02*k,Math.sin(aa)*0.003*k)),end.clone().add(V(Math.cos(aa)*0.005*k,0.026*k,Math.sin(aa)*0.005*k)),end.clone().add(V(0,0.030*k,0))],
              0.00055*k,0.00025*k,'trapMark','heart_flower_cage_lobe',5,4);
          }
        }else if(pearls){
          for(let z=0;z<12;z++){
            const aa=z*GOLD,rr=Math.sqrt((z+0.5)/12)*0.007*k;
            diskFlower(f,end.clone().add(V(Math.cos(aa)*rr,0.006*k*(1-rr/(0.009*k)),Math.sin(aa)*rr)),UP,0.0025*k,5,'petal');
          }
        }else stem(f,[end,end.clone().add(V(0.005*k,0.02*k,0)),end.clone().add(V(0.008*k,0.036*k,0))],0.0014*k,0.0005*k,'petal','peperomia_rat_tail_spike',10,5);
      }
      motion(g,'z',short?0.45:1.15,j*0.43,'hanging pendulum');motion(g,'x',short?0.2:0.65,j*0.43+0.8,'hanging pendulum');
    }
  }
  function jade(ctx){
    const{G,k,m,ready}=ctx;rootFlare(G,k,0.065*k,true);
    const trunk=[V(0,0.025*k,0),V(-0.014*k,0.17*k,0.015*k),V(0.018*k,0.36*k,0)];
    stem(G.trunkOrCrown,trunk,0.052*k,0.023*k,'bark','jade_succulent_trunk',18,10);
    const n=Math.round(4+p.branchingDensity*6+m*2);
    for(let j=0;j<n;j++){
      const a=j*GOLD,t=j/n,at=V(0.006*k,(0.16+t*0.20)*k,0),g=node(G.shrubBranches,'jade_branch_fork',at);
      const end=V(Math.cos(a)*(0.18+0.07*(1-t))*k,(0.24+t*0.18)*k,Math.sin(a)*(0.18+0.07*(1-t))*k),fork=end.clone().multiplyScalar(0.53).add(V(0,0.025*k,0));
      stem(g,[V(),fork,end],0.024*k*(1-t*0.3),0.007*k,'bark','thick_woody_jade_branch',15,8);const d=detail(g);
      for(let s=0;s<2;s++){
        const tip=end.clone().add(V(Math.cos(a+(s?0.8:-0.8))*0.07*k,0.07*k,Math.sin(a+(s?0.8:-0.8))*0.07*k)),curve=new THREE.CatmullRomCurve3([fork,end,tip]);
        stem(g,curve.points,0.012*k,0.004*k,'stem','jade_green_terminal_shoot',10,7);
        for(let q=0;q<4;q++){
          const tt=0.12+q/4*0.8,base=curve.getPoint(tt),axis=curve.getTangent(tt),f=frame(axis);
          for(const sign of[-1,1]){
            const dir=(q%2?f.N:f.W).clone().multiplyScalar(sign).addScaledVector(axis,0.25),L=(0.075-q*0.009)*k*rnd(0.9,1.1);
            const b=flesh(g,base,dir,L,L*0.57,L*0.22,q===3?'leafYoung':'leaf','opposite_fleshy_jade_leaf',{rows:12,sides:10,bend:L*0.05});
            if(m>0.4)for(const side of[-1,1])stem(d,[0.13,0.35,0.62,0.85,0.99].map(t2=>b.edge(t2,side)),0.0007*k,0.0003*k,'rim','reddish_jade_margin',12,4);
          }
          if(q<3){
            const scar=new THREE.TorusGeometry((0.008-q*0.001)*k,0.0008*k,4,10);
            scar.rotateX(Math.PI/2).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP,axis)).translate(...base.toArray());add(d,scar,'root','jade_node_scar');
          }
        }
        if(ready&&p.flowerDensity>0&&j<Math.ceil(p.flowering*p.flowerDensity*n)){
          const flowers=node(g,'jade_flower_cluster',tip,'flowerHeads');
          for(let q=0;q<7;q++){
            const aa=q*GOLD,rr=Math.sqrt((q+0.5)/7)*0.024*k,c=V(Math.cos(aa)*rr,(0.026-rr*0.35)*k/Math.max(k,0.01),Math.sin(aa)*rr);
            line(flowers,V(),c,0.0007*k,'stem','jade_cyme_pedicel');
            if(p.bloomStage<0.25||q===6)bud(detail(flowers,'budsAndSpentBlooms'),c,0.003*k,'pink');
            else diskFlower(flowers,c,UP,0.007*k,5,q%3?'petal':'pink',1,p.bloomStage);
          }motion(flowers,'z',0.4,j,'small cyme nod');
        }
      }motion(g,'z',0.35,j*0.6,'succulent branch sway');
    }
  }
  function grassRibbon(points,width,zone,parent,label,phase=0){
    const curve=new THREE.CatmullRomCurve3(points),rows=26,vs=[],ix=[],fs=curve.computeFrenetFrames(rows,false);
    for(let i=0;i<=rows;i++){
      const t=i/rows,c=curve.getPointAt(t),w=width*(0.3+0.7*Math.sin(Math.PI*t)**0.45)*(1-t**8);
      const W=fs.normals[i].clone().multiplyScalar(Math.cos(0.18*Math.sin(t*5+phase))).addScaledVector(fs.binormals[i],Math.sin(0.18*Math.sin(t*5+phase)));
      for(let q=0;q<3;q++)vs.push(...c.clone().addScaledVector(W,(q-1)*w*0.5).addScaledVector(fs.binormals[i],q===1?w*0.16:0).toArray());
    }
    for(let i=0;i<rows;i++)for(let q=0;q<2;q++){const a=i*3+q;ix.push(a,a+3,a+1,a+1,a+3,a+4);}
    add(parent,geometryOf(vs,ix),zone,label);return curve;
  }
  function grasses(ctx,pampas){
    const{G,k,m,ready}=ctx,H=(pampas?1.42:0.69)*k,reach=(pampas?0.78:0.48)*k;
    rootFlare(G,k,(pampas?0.10:0.065)*k);
    const n=Math.round((pampas?55:48)+character*48+m*15);
    for(let j=0;j<n;j++){
      const a=j*GOLD,inner=j/n,D=V(Math.cos(a),0,Math.sin(a)),base=D.clone().multiplyScalar((0.02+(1-inner)*0.055)*k).add(V(0,0.02*k,0));
      const g=node(G.grassBlades,'arching_grass_blade',base),h=H*rnd(0.68,1.08)*(0.85+inner*0.15),r=reach*rnd(0.72,1.16)*(1-inner*0.55);
      const pts=[V(),D.clone().multiplyScalar(r*0.11).add(V(0,h*0.52,0)),D.clone().multiplyScalar(r*0.52).add(V(0,h*0.91,0)),D.clone().multiplyScalar(r).add(V(0,h*(inner>0.78?0.87:rnd(0.32,0.63)),0))];
      grassRibbon(pts,(pampas?0.021:0.009)*k*rnd(0.65,1.2),j%9===0?'silver':j%6===0?'leafYoung':'grass',g,'folded_tapering_grass_ribbon',j);
      if(j<9)grassRibbon([V(),D.clone().multiplyScalar(0.025*k).add(V(0,0.11*k,0)),D.clone().multiplyScalar(0.07*k).add(V(0,0.16*k,0))],0.012*k,j%3?'leafBack':'spent',g,'basal_grass_sheath');
      motion(g,'z',pampas?1.2:1.7,0.3*Math.sin(a)+inner*0.7,'coordinated grass ripple');
      if(j%3===0)motion(g,'x',0.6,0.4+a*0.13,'crosswind ripple');
    }
    if(!ready||p.flowerDensity===0)return;
    const plumes=Math.round((pampas?3:4)+p.flowering*p.flowerDensity*(pampas?7:13));
    for(let j=0;j<plumes;j++){
      const a=j*GOLD+0.5,D=V(Math.cos(a),0,Math.sin(a)),stemH=(pampas?1.45:0.80)*k*rnd(0.88,1.14),lean=(j===1?0.37:0.13+wild*rnd(0,0.14))*k;
      const top=D.clone().multiplyScalar(lean).add(V(0,stemH,0)),g=node(G.grassPlumes,'grass_plume_culm',V(0,0.02*k,0));
      stem(g,[V(),D.clone().multiplyScalar(lean*0.2).add(V(0,stemH*0.55,0)),top],(pampas?0.006:0.003)*k,(pampas?0.003:0.0015)*k,'grass','flexible_flowering_culm',24,6);
      const head=node(g,'independent_seedhead',top,'grassPlumes'),emerging=j===plumes-1||p.bloomStage<0.22,fullness=p.grassPlumeFullness*(emerging?0.35:1);
      const L=(pampas?0.49:0.20)*k*(emerging?0.64:rnd(0.85,1.1)),axis=D.clone().multiplyScalar(j===1?0.7:0.22).add(UP).normalize(),f=frame(axis),tip=axis.clone().multiplyScalar(L);
      stem(head,[V(),axis.clone().multiplyScalar(L*0.5),tip],(pampas?0.003:0.0018)*k,0.0003*k,'stem','seedhead_rachis',15,5);
      const count=Math.round((pampas?65:45)+fullness*(pampas?105:90)),zone=emerging?'leafYoung':pampas?'plume':p.bloomStage>0.84?'spent':'plume';
      for(let q=0;q<count;q++){
        const t=(q+0.5)/count,aa=q*GOLD,center=axis.clone().multiplyScalar(L*t),out=f.N.clone().multiplyScalar(Math.cos(aa)).addScaledVector(f.W,Math.sin(aa));
        const spread=L*(pampas?0.25:0.20)*Math.sin(Math.PI*t)**0.55*(0.45+fullness*0.75),end=center.clone().addScaledVector(out,spread).addScaledVector(axis,L*(pampas?0.12:0.045));
        if(pampas){
          stem(head,[center,center.clone().lerp(end,0.6),end],0.0008*k,0.00009*k,zone,'feather_primary_branch',4,4);
          for(let s=0;s<4;s++){
            const tt=0.26+s*0.18,at=center.clone().lerp(end,tt),side=new THREE.Vector3().crossVectors(axis,out).normalize();
            for(const sign of[-1,1]){
              const featherEnd=at.clone().addScaledVector(axis,L*rnd(0.045,0.09)).addScaledVector(side,sign*spread*0.22).addScaledVector(out,spread*0.17);
              leaf(head,at,featherEnd.clone().sub(at),at.distanceTo(featherEnd),0.0023*k,q%13===0?'petal':zone,'pampas_silky_secondary_feather',{normal:out,rows:3,columns:2,wild:0,bend:0.002*k});
            }
          }
        }else{
          stem(head,[center,center.clone().lerp(end,0.6),end],0.00055*k,0.00008*k,zone,'bottlebrush_awn',4,4);
          ellipsoid(head,center.clone().lerp(end,0.38),axis,0.0023*k,[0.6,1.9,0.6],q%7===0?'pink':'spent','grass_spikelet',6);
          if(fullness>0.35)line(head,center.clone().lerp(end,0.3),end.clone().addScaledVector(axis,L*0.045),0.00025*k,zone,'fine_seedhead_bristle');
        }
      }motion(g,'z',pampas?0.85:1.3,j*0.31,'culm breathing');motion(head,'z',pampas?0.8:1.2,j*0.31+0.6,'seedhead lag');
    }
  }
  function needlePair(parent,at,axis,length,width,zone,phase=0){
    const f=frame(axis);
    for(const sign of[-1,1]){
      const D=f.N.clone().multiplyScalar(Math.cos(phase)*sign).addScaledVector(f.W,Math.sin(phase)*sign).addScaledVector(f.D,0.45);
      leaf(parent,at,D,length,width,zone,'opposite_narrow_leaf',{normal:f.W,bend:length*0.035,rows:5,columns:2,wild:0});
    }
  }
  function lavenderSpike(parent,length,k,stage,phase){
    stem(parent,[V(),V(0.002*k,length*0.55,0),V(0,length,0)],0.0017*k,0.00055*k,'stem','lavender_spike_axis',12,5);
    const whorls=6+Math.round(p.flowerDensity*3),buds=detail(parent,'budsAndSpentBlooms');
    for(let row=0;row<whorls;row++){
      const t=0.08+row/whorls*0.82,young=stage<0.23||row>whorls-2,rr=0.006*k*(1-t*0.45);
      for(let q=0;q<5;q++){
        const a=q/5*TAU+row*0.63+phase,at=V(Math.cos(a)*rr,t*length,Math.sin(a)*rr),end=at.clone().add(V(Math.cos(a)*0.004*k,0.004*k,Math.sin(a)*0.004*k));
        ellipsoid(parent,at,UP,0.0026*k,[0.8,1.4,0.8],'leafBack','lavender_calyx',6);
        if(young)bead(buds,end,0.003*k,stage<0.1?'leafYoung':'violet','unopened_lavender_floret',[0.7,1.2,0.7],'solid',0);
        else if(stage>0.9&&row===0&&q%2===0)bead(buds,end,0.0026*k,'spent','spent_lavender_calyx',[0.7,1,0.7],'solid',0);
        else{
          const axis=V(Math.cos(a),0.45,Math.sin(a));
          leaf(parent,at,axis,0.009*k,0.005*k,'violet','lavender_lower_lip',{rows:5,columns:3,bend:0.002*k,wild:0});
          leaf(parent,end,axis.clone().add(V(0,0.7,0)),0.005*k,0.003*k,'violet','lavender_upper_lip',{rows:4,columns:2,wild:0});
        }
      }
    }
  }
  function hydrangeaHead(g,radius,k,stage,zone){
    const n=Math.round(32+p.flowerDensity*48),buds=detail(g,'budsAndSpentBlooms');
    for(let q=0;q<n;q++){
      const y=1-1.83*(q+0.5)/n,rr=Math.sqrt(Math.max(0,1-y*y)),a=q*GOLD,out=V(Math.cos(a)*rr,y,Math.sin(a)*rr),at=out.clone().multiplyScalar(radius*(0.88+rnd(0,0.10)));
      stem(g,[V(0,-radius*0.52,0),at.clone().multiplyScalar(0.65),at],0.0011*k,0.00035*k,'stem','hydrangea_corymb_pedicel',4,4);
      if(stage<0.24||q%17===0)bud(buds,at,radius*0.072,stage<0.16?'leafYoung':zone,out);
      else{const spent=stage>0.86&&q%11===0;diskFlower(spent?buds:g,at,out,radius*(0.24+p.flowerDensity*0.025),4,spent?'spent':q%9===0?'petal':zone,1,clamp(stage*1.7,0.2,1));}
    }
  }
  function geraniumHead(g,radius,k,stage,zone){
    const n=Math.round(7+p.flowerDensity*10),buds=detail(g,'budsAndSpentBlooms');
    for(let q=0;q<n;q++){
      const a=q*GOLD,t=(q+0.5)/n,rr=radius*Math.sqrt(t),at=V(Math.cos(a)*rr,radius*(0.60+0.65*(1-t)),Math.sin(a)*rr);
      line(g,V(),at,0.001*k,'stem','geranium_umbel_pedicel');const axis=V(Math.cos(a)*0.35,1,Math.sin(a)*0.35);
      if(stage<0.22||q%9===0)bud(buds,at,0.004*k,zone,axis);else diskFlower(g,at,axis,radius*0.40,5,zone,1,clamp(stage*1.6,0.2,1));
    }
  }
  function marigoldHead(g,radius,k,stage){
    const spent=stage>0.92;ellipsoid(g,V(0,-radius*0.18,0),UP,radius*0.42,[0.8,1.1,0.8],'leafBack','marigold_involucre',10);
    if(stage<0.20){bud(detail(g,'budsAndSpentBlooms'),V(0,radius*0.25,0),radius*0.44,'leafYoung');return;}
    const layers=5+Math.round(p.flowerDensity*3);
    for(let row=0;row<layers;row++){
      const t=row/layers,count=Math.round(14-t*6),rr=radius*(0.74-t*0.54),elevation=radius*(0.05+t*0.72);
      for(let q=0;q<count;q++){
        const a=q/count*TAU+row*GOLD,at=V(Math.cos(a)*rr,elevation,Math.sin(a)*rr),D=V(Math.cos(a),0.40+t*1.8+(1-stage)*1.4,Math.sin(a));
        const b=leaf(g,at,D,radius*(0.63-t*0.24),radius*(0.38-t*0.10),spent&&q%7===0?'spent':row%3===0?'marigoldOrange':'marigoldGold',
          'ruffled_marigold_ray_floret',{style:'paddle',rows:10,columns:6,bend:radius*0.19,curl:-radius*0.12,wild:0.8,phase:a,normal:UP});
        if(row<2&&q%3===0)stem(detail(g),[0.45,0.65,0.85].map(tt=>b.sample(tt).addScaledVector(b.N,radius*0.006)),0.0006*k,0.0002*k,'marigoldOrange','petal_fold',4,4);
      }
    }
    for(let q=0;q<8;q++)bead(g,V(Math.cos(q*GOLD)*radius*0.10,radius*0.84,Math.sin(q*GOLD)*radius*0.10),radius*0.065,'marigoldGold','central_tubular_floret',[0.65,1.6,0.65],'solid',0);
  }
  function gardenShrub(ctx,type){
    const{G,k,m,ready}=ctx,lavender=type==='lavender',hydrangea=type==='hydrangea',geranium=type==='geranium',marigold=type==='marigold';
    const H=(lavender?0.57:hydrangea?0.95:geranium?0.31:0.43)*k,R=(lavender?0.25:hydrangea?0.38:geranium?0.20:0.19)*k;
    rootFlare(G,k,(hydrangea?0.07:0.045)*k,!marigold&&!geranium);
    const branches=Math.round((lavender?16:hydrangea?6:7)+p.branchingDensity*(lavender?22:9)+m*3);
    const bloomCount=ready&&p.flowerDensity>0?Math.max(1,Math.round(branches*p.flowering*(0.3+p.flowerDensity*0.9))):0;
    let flowerZone='hydrangeaBlue';
    if(hydrangea){
      const mood=p.hydrangeaMood==='palette'?p.colorway==='Cottage Bloom'||p.colorway==='Trailing Conservatory'?'pink':p.colorway.includes('Moon')?'lilac':'blue':p.hydrangeaMood;
      flowerZone={blue:'hydrangeaBlue',pink:'pink',cream:'petal',lilac:'hydrangeaLilac'}[mood];
    }
    for(let j=0;j<branches;j++){
      const a=j*GOLD,t=(j+0.5)/branches,r=R*Math.sqrt(t)*rnd(0.88,1.06),h=H*(0.60+0.38*Math.sqrt(1-t))*rnd(0.91,1.05);
      const start=V(Math.cos(a)*0.014*k,0.027*k,Math.sin(a)*0.014*k),g=node(G.shrubBranches,`${type}_branch`,start),end=V(Math.cos(a)*r,h,Math.sin(a)*r);
      const midpoint=end.clone().multiplyScalar(0.53).add(V(wild*rnd(-0.024,0.024)*k,0.014*k,0)),curve=new THREE.CatmullRomCurve3([V(),midpoint,end]);
      stem(g,curve.points,(hydrangea?0.014:lavender?0.004:0.006)*k,(hydrangea?0.004:0.0015)*k,lavender||hydrangea?'bark':'stem','branching_garden_shoot',16,7);
      const leaves=detail(g,'primaryLeaves'),d=detail(g),rows=lavender?8:hydrangea?3:geranium?3:5;
      for(let q=0;q<rows;q++){
        const tt=0.28+q/rows*0.64,at=curve.getPoint(tt),axis=curve.getTangent(tt);
        if(lavender){
          needlePair(leaves,at,axis,(0.047-q*0.0025)*k,(0.006+character*0.002)*k,q===rows-1?'leafYoung':'silver',q*Math.PI/2);
          if(q%3===1){
            const sideEnd=at.clone().add(V(Math.cos(a+0.8)*0.042*k,0.035*k,Math.sin(a+0.8)*0.042*k));
            line(g,at,sideEnd,0.001*k,'stem','lavender_side_shoot');needlePair(leaves,sideEnd,axis,0.025*k,0.004*k,'silver',q);
          }
        }else for(const sign of[-1,1]){
          const aa=a+sign*Math.PI*0.48+q*0.7,D=V(Math.cos(aa),0.1+q*0.08,Math.sin(aa)),petioleEnd=at.clone().addScaledVector(D,(hydrangea?0.032:geranium?0.035:0.016)*k);
          stem(leaves,[at,at.clone().lerp(petioleEnd,0.5).add(V(0,0.008*k,0)),petioleEnd],(hydrangea?0.002:0.0015)*k,0.0008*k,'stem','visible_leaf_petiole',5,5);
          if(hydrangea){
            const L=(0.16-q*0.021)*k*(0.9+character*0.2);
            leaf(leaves,petioleEnd,D,L,L*0.76,q===rows-1&&j%3===0?'leafYoung':'leaf','serrated_hydrangea_lamina',
              {style:'serrate',rows:24,columns:8,veins:true,bend:L*0.06,curl:-L*0.1,dew:j%5===0&&q===0});
          }else if(geranium){
            const L=(0.078-q*0.008)*k,b=roundLeafGeometry(petioleEnd,D,L,L*1.07,'scallop');add(leaves,b.geometry,q===rows-1?'leafYoung':'leaf','rounded_scalloped_geranium_leaf');
            for(let z=0;z<7;z++){
              const aa2=z/7*TAU;stem(d,[b.sample(0.05,aa2),b.sample(0.5,aa2),b.sample(0.9,aa2)].map(v=>v.addScaledVector(b.N,L*0.006)),0.00055*k,0.00015*k,'vein','palmate_geranium_vein',5,4);
            }
            if(p.variegationStrength>0.12){
              const ps=Array.from({length:29},(_,z)=>b.sample(0.66,z/28*TAU).addScaledVector(b.N,L*0.007));
              stem(d,ps,L*0.014*p.variegationStrength,L*0.014*p.variegationStrength,'trapMark','geranium_zonal_band',28,4);
            }
          }else{
            const L=(0.11-q*0.009)*k,f=frame(D),tip=petioleEnd.clone().addScaledVector(f.D,L);
            stem(leaves,[petioleEnd,petioleEnd.clone().lerp(tip,0.5),tip],0.001*k,0.00025*k,'stem','pinnate_marigold_rachis',8,4);
            for(let row=0;row<5;row++)for(const s of[-1,1]){
              const t2=0.14+row*0.15,b=petioleEnd.clone().lerp(tip,t2),dd=f.W.clone().multiplyScalar(s).addScaledVector(f.D,0.4),l=L*(0.33-row*0.035);
              leaf(leaves,b,dd,l,l*0.28,row===4?'leafYoung':'leaf','serrated_aromatic_marigold_leaflet',{style:'serrate',rows:10,columns:2,wild:0});
            }
            leaf(leaves,tip.clone().addScaledVector(f.D,-L*0.16),f.D,L*0.27,L*0.07,'leafYoung','terminal_marigold_leaflet',{rows:8,columns:2,style:'serrate',wild:0});
          }
        }
      }
      if(j<bloomCount){
        const scapeLength=(lavender?0.09:hydrangea?0.038:0.08)*k,scapeEnd=end.clone().add(V(Math.cos(a)*0.009*k,scapeLength,Math.sin(a)*0.009*k));
        stem(g,[end,end.clone().lerp(scapeEnd,0.5),scapeEnd],(hydrangea?0.004:0.0018)*k,(hydrangea?0.003:0.0012)*k,'stem','elevated_flower_peduncle',7,5);
        const head=node(g,`${type}_flower_head`,scapeEnd,'flowerHeads');head.rotation.z=j===1?0.12:rnd(-0.07,0.07)*wild;
        const stage=j===bloomCount-1&&bloomCount>2?p.bloomStage*0.35:p.bloomStage;
        if(lavender)lavenderSpike(head,(0.075+character*0.025)*k,k,stage,j);
        if(hydrangea)hydrangeaHead(head,(0.115+character*0.025)*k,k,stage,flowerZone);
        if(geranium)geraniumHead(head,0.047*k,k,stage,j%3?'pink':'petalAccent');
        if(marigold)marigoldHead(head,(0.040+character*0.013)*k,k,stage);
        motion(head,'z',hydrangea?0.6:lavender?1.2:1.1,j*0.71,'flower nod');
      }else if(ready&&p.flowerDensity>0&&j===bloomCount)bud(detail(g,'budsAndSpentBlooms'),end,(hydrangea?0.019:0.008)*k,lavender?'violet':'leafYoung');
      motion(g,'z',hydrangea?0.4:lavender?0.75:0.6,j*0.37,'woody mound sway');
    }
    if(ready&&p.flowerDensity>0&&p.bloomStage>0.74)for(let q=0;q<3;q++){
      const a=q*GOLD+1,r=ctx.foot*rnd(0.35,0.85);
      leaf(G.budsAndSpentBlooms,V(Math.cos(a)*r,0.027*k,Math.sin(a)*r),V(Math.sin(a),0.03,Math.cos(a)),(lavender?0.009:0.016)*k,0.007*k,
        marigold?'marigoldOrange':lavender?'violet':hydrangea?flowerZone:'pink','fallen_petal',{rows:5,columns:3,bend:0.001*k,wild:0});
    }
  }
  function formalTopiary(ctx,rosemary){
    const{G,k,m,ready}=ctx;let shape=p.topiarySilhouette==='species default'?'sphere':p.topiarySilhouette;
    if(rosemary)shape=shape==='column'||shape==='cone'?'column':'sphere';
    const H=(rosemary?1.35:1.55)*k,trunkH=(shape==='cone'||shape==='column'?0.31:0.56)*k,R=(rosemary?0.31:0.43)*k;
    rootFlare(G,k,(rosemary?0.055:0.075)*k,true);
    const trunkPts=[V(0,0.02*k,0),V(-0.025*k*wild,trunkH*0.45,0.012*k),V(0.013*k*wild,trunkH,0)];
    stem(G.topiaryTrunk,trunkPts,(rosemary?0.032:0.046)*k,(rosemary?0.014:0.021)*k,'bark','visible_trained_trunk',24,9);
    const crown=node(G.topiaryCrown,'unified_clipped_crown',trunkPts[2]),depthH=H-trunkH,prune=p.branchingAndPruning,neat=p.pruningNeatness,tiers=shape==='tiered'?3:1,shapeName=shape;
    const form=(tier,u,a,inset=1)=>{
      const yUnit=1-2*u;let point,normal;
      if(shapeName==='sphere'||shapeName==='tiered'){
        const rr=R*(shapeName==='tiered'?1-tier*0.21:1),yR=shapeName==='tiered'?rr*0.60:Math.min(R,depthH*0.48);
        const cy=shapeName==='tiered'?tier*R*1.04+yR*0.60:yR*0.94,t=Math.sqrt(Math.max(0,1-yUnit*yUnit));
        point=V(Math.cos(a)*rr*t*inset,cy+yUnit*yR*inset,Math.sin(a)*rr*t*inset);normal=V(Math.cos(a)*t,yUnit,Math.sin(a)*t).normalize();
      }else if(shapeName==='cube'){
        const n=V(Math.cos(a)*Math.sqrt(1-yUnit*yUnit),yUnit,Math.sin(a)*Math.sqrt(1-yUnit*yUnit)),mx=Math.max(Math.abs(n.x),Math.abs(n.y),Math.abs(n.z),1e-5);
        point=n.clone().multiplyScalar(R*0.82/mx*inset).add(V(0,R*0.82,0));
        normal=Math.abs(n.x)===mx?V(Math.sign(n.x),0,0):Math.abs(n.y)===mx?V(0,Math.sign(n.y),0):V(0,0,Math.sign(n.z));
      }else{
        const t=u,r=shapeName==='cone'?R*(1-t)+0.012*k:R*0.63,cap=shapeName==='column'?Math.min(1,Math.sqrt(Math.max(0,Math.sin(Math.PI*t)))*2.2):1;
        point=V(Math.cos(a)*r*cap*inset,depthH*t,Math.sin(a)*r*cap*inset);
        normal=V(Math.cos(a),shapeName==='cone'?0.4:t>0.9?0.4:0,Math.sin(a)).normalize();
      }
      const rough=(1-neat)*0.023*k+(1-prune)*0.055*k;
      point.addScaledVector(normal,rough*(Math.sin(a*7+u*23)*0.55+Math.cos(a*3-u*15)*0.45));return{point,normal};
    };
    for(let tier=0;tier<tiers;tier++){
      const tierGroup=node(crown,`clipped_${shape}_tier${tier}`,V(),'topiaryCrown'),count=Math.round((rosemary?190:290)+character*200+p.branchingDensity*130),branchN=Math.round(10+p.branchingDensity*13);
      for(let j=0;j<branchN;j++){
        const a=j*GOLD,u=(j+0.6)/branchN,{point}=form(tier,u,a,0.72),base=V(0,Math.max(0,point.y*0.45),0),mid=base.clone().lerp(point,0.6).add(V(0,0.025*k,0));
        stem(tierGroup,[base,mid,point],(rosemary?0.005:0.009)*k,0.0015*k,'bark','interior_topiary_branch',10,6);
        if(j<5){
          const cut=point.clone().multiplyScalar(0.88),dir=point.clone().sub(mid).normalize();
          stem(G.topiaryTrunk,[base.clone().add(trunkPts[2]),cut.clone().add(trunkPts[2])],0.006*k,0.004*k,'bark','clipped_branch_stub',5,6);
          const scar=new THREE.CircleGeometry(0.0042*k,9);scar.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,0,1),dir));
          scar.translate(...cut.clone().add(trunkPts[2]).addScaledVector(dir,0.0005*k).toArray());add(G.surfaceDetails,scar,'spent','visible_pruning_cut');
        }
      }
      for(let j=0;j<count;j++){
        const u=(j+0.5)/count,a=j*GOLD,{point,normal}=form(tier,u,a,j%9===0?0.87:1),f=frame(normal);
        const tangent=f.N.clone().multiplyScalar(Math.cos(j*1.17)).addScaledVector(f.W,Math.sin(j*1.17)),shootL=(rosemary?0.045:0.032)*k*(1+(1-prune)*0.8);
        const start=point.clone().addScaledVector(normal,-shootL*0.65),end=start.clone().addScaledVector(normal,shootL*(j%31===0?1+(1-neat):1));
        if(j%3===0||rosemary)line(tierGroup,start,end,(rosemary?0.00065:0.00085)*k,'stem','terminal_clipped_shoot');
        const leaves=rosemary?3:2;
        for(let q=0;q<leaves;q++)for(const sign of[-1,1]){
          const at=start.clone().lerp(end,0.30+q/leaves*0.64),dir=tangent.clone().multiplyScalar(sign).addScaledVector(normal,0.30);
          if(rosemary)leaf(tierGroup,at,dir,(0.022+character*0.009)*k,0.0032*k,j%7===0?'silver':j%17===0?'leafYoung':'leaf','rolled_rosemary_needle',{normal,rows:5,columns:2,bend:0.0015*k,wild:0});
          else flesh(tierGroup,at,dir,(0.023+character*0.009)*k,0.014*k,0.0022*k,j%11===0?'leafYoung':j%7===0?'leafBack':'leaf','opposite_boxwood_leaf',{normal,rows:6,sides:6,bend:0.001*k,character:0});
        }
        if(ready&&p.flowerDensity>0&&j%(rosemary?47:97)===0&&j/count<p.flowering){
          const fG=node(tierGroup,rosemary?'rosemary_axillary_flowers':'boxwood_axillary_flowers',end,'flowerHeads');
          if(p.bloomStage<0.22)bud(detail(fG,'budsAndSpentBlooms'),V(),0.0025*k,rosemary?'floralBlue':'leafYoung',normal);
          else if(rosemary){
            for(let q=0;q<2;q++){
              const at=tangent.clone().multiplyScalar((q?1:-1)*0.004*k);
              leaf(fG,at,normal.clone().addScaledVector(tangent,0.35),0.008*k,0.006*k,'floralBlue','rosemary_lower_flower_lip',{normal:UP,rows:5,columns:3,bend:0.002*k,wild:0});
              leaf(fG,at,normal.clone().add(V(0,0.65,0)),0.005*k,0.0035*k,'floralBlue','rosemary_upper_flower_hood',{normal:tangent,rows:4,columns:2,wild:0});
            }
          }else for(let q=0;q<4;q++)diskFlower(fG,tangent.clone().multiplyScalar((q-1.5)*0.003*k),normal,0.003*k,4,'leafYoung');
        }
      }
    }motion(crown,'z',rosemary?0.16:0.10,0.25,'formal crown stillness');root.userData.pruningForm=shape;
  }

  const members=[];
  for(let index=0;index<memberCount;index++){
    const ctx=createMember(index);members.push(ctx);
    switch(p.species){
      case'Monstera':broadleafPlant(ctx,'monstera');break;
      case'Bird-of-paradise':broadleafPlant(ctx,'bird');break;
      case'Fiddle-leaf fig':broadleafPlant(ctx,'fig');break;
      case'Maidenhair fern':maidenhair(ctx);break;
      case'Echeveria':rosette(ctx,'echeveria');break;
      case'Agave':rosette(ctx,'agave');break;
      case'Haworthia zebra':rosette(ctx,'haworthia');break;
      case'Aloe vera':rosette(ctx,'aloe');break;
      case'Barrel cactus':cactus(ctx,false);break;
      case'Columnar cactus':cactus(ctx,true);break;
      case'Nepenthes pitcher plant':nepenthes(ctx);break;
      case'Venus flytrap':flytrap(ctx);break;
      case'Sundew':sundew(ctx);break;
      case'String of pearls':trailing(ctx,'pearls');break;
      case'String of hearts':trailing(ctx,'hearts');break;
      case'String of turtles':trailing(ctx,'turtles');break;
      case'Jade plant':jade(ctx);break;
      case'Fountain grass':grasses(ctx,false);break;
      case'Pampas grass':grasses(ctx,true);break;
      case'Lavender shrub':gardenShrub(ctx,'lavender');break;
      case'Hydrangea shrub':gardenShrub(ctx,'hydrangea');break;
      case'Geranium':gardenShrub(ctx,'geranium');break;
      case'Marigold':gardenShrub(ctx,'marigold');break;
      case'Boxwood topiary':formalTopiary(ctx,false);break;
      case'Rosemary topiary':formalTopiary(ctx,true);break;
    }
  }
  if(p.floatingPollinators){
    const{G,k}=members[0],tiny=['Sundew','Venus flytrap'].includes(p.species);
    const size=(tiny?0.0025:['Echeveria','Haworthia zebra'].includes(p.species)||isTrailing?0.004:0.009)*k,H=INFO[p.species][0]*k,reach=INFO[p.species][1]*k*1.4;
    for(let j=0;j<2;j++){
      const a=j*2.7+0.8,at=V(Math.cos(a)*reach,H*(0.7+j*0.12)+size*5,Math.sin(a)*reach),g=node(G.floatingPollinators,'visiting_fly',at);g.rotation.y=a;
      bead(g,V(),size,'insect','visitor_abdomen',[0.65,0.65,1.5]);bead(g,V(0,0,size*1.45),size*0.58,'insect','visitor_head');
      for(const sign of[-1,1]){
        const wing=bladeGeometry(V(0,size*0.3,size*0.3),V(sign,0.23,-0.25),size*2.7,size*1.2,{style:'paddle',rows:8,columns:4});
        add(g,wing.geometry,'dew','transparent_visitor_wing','dew');
        for(let q=0;q<3;q++)line(g,V(0,-size*0.1,(q-1)*size*0.6),V(sign*size*1.4,-size*0.8,(q-1)*size),size*0.065,'insect','visitor_leg');
      }motion(g,'y',8,j*1.2,'visitor hover');
    }
    if(p.flowering>0&&p.species!=='Maidenhair fern')for(let j=0;j<9;j++){
      const a=j*GOLD;bead(G.floatingPollinators,V(Math.cos(a)*reach*0.7,H*rnd(0.75,1.05)+size*2,Math.sin(a)*reach*0.7),size*0.18,'glow','airborne_pollen',[1,1,1],'glow',0);
    }
  }

  // Containers are appended after botanical construction so adding one never
  // consumes the plant's random stream or changes its species arrangement.
  let potSpecs={style:'none',present:false},plantElevation=0;
  function recordBounds(list){
    root.updateMatrixWorld(true);
    const bounds=new THREE.Box3(),v=V();
    for(const part of list){
      const a=part.g.attributes.position;
      for(let i=0;i<a.count;i++)bounds.expandByPoint(v.fromBufferAttribute(a,i).applyMatrix4(part.node.matrixWorld));
    }
    return bounds;
  }
  function createPot(){
    const style=p.potStyle;if(style==='none')return;
    const ceramic=style.startsWith('ceramic'),round=style==='ceramic round',stone=style==='stone bowl';
    const concrete=style==='concrete planter',metal=style==='metal cachepot',hanging=style==='hanging basket',clay=style==='terracotta nursery';
    const botanicalRecords=[...records],plantBounds=recordBounds(botanicalRecords),k=members[0].k;
    const size=plantBounds.getSize(V());
    const bedRadius=Math.max(...members.map(m=>Math.hypot(m.offset.x,m.offset.z)+m.foot*1.10));
    const canopyRadius=Math.max(size.x,size.z)*0.5;
    const reference=INFO[p.species][1]*k;
    const desired=isTrailing?bedRadius*1.08:Math.max(reference*0.72,Math.min(canopyRadius*0.48,reference*1.5));
    const opening=Math.max(bedRadius*1.075,desired*p.potScale)*(stone?1.12:1);
    const wall=opening*p.potRimThickness*(metal?0.38:concrete?1.25:stone?1.4:1);
    const R=opening+wall;
    const vesselH=R*(stone?0.58:hanging?0.95:round?1.35:concrete?1.55:metal?1.60:1.70)*p.potHeight;
    const footH=metal?R*0.13:hanging?0:stone?R*0.035:R*0.055;
    const bottom=footH,H=bottom+vesselH;
    const lipSection=wall*(clay?0.82:metal?0.72:0.60);
    // A shallow fill recess keeps low rosettes visible without burying crowns.
    const recess=Math.min(vesselH*0.06,0.006*k+wall*0.35);
    const soilY=H-recess;
    plantElevation=soilY-0.007*k;
    const basketLift=hanging?Math.max(R*0.25,-plantBounds.min.y-plantElevation+R*0.045):0;
    plantElevation+=basketLift;
    for(const component of Object.values(components))component.position.y+=plantElevation;
    const pot=new THREE.Group();pot.name='pot';pot.position.y=basketLift;
    pot.userData={component:'pot',detachable:true};root.add(pot);components.pot=pot;
    const sub={};
    for(const name of ['potBody','potRim','potDetails','potSoil']){
      const g=new THREE.Group();g.name=name;g.userData={component:name,detachable:true};pot.add(g);sub[name]=g;
    }
    const put=(target,g,zone,label,material='pot')=>add(sub[target],g,zone,label,material);
    const radiusAt=t=>{
      if(round)return R*(0.52+0.50*Math.sin((0.11+0.79*t)*Math.PI/2)+0.065*Math.sin(Math.PI*t));
      if(stone)return R*(0.43+0.57*Math.sin(t*Math.PI/2));
      if(hanging)return R*(0.36+0.64*Math.sin(t*Math.PI/2));
      if(concrete)return R*(0.84+0.16*t);
      if(metal)return R*(0.80+0.20*t);
      return R*((clay?0.66:0.63)+(clay?0.34:0.37)*t);
    };
    const radialFactor=(a,t)=>{
      if(concrete)return Math.pow(Math.abs(Math.cos(a))**6+Math.abs(Math.sin(a))**6,-1/6);
      if(stone)return 1+p.potDetail*(0.021*Math.sin(a*5+0.7)+0.012*Math.cos(a*9-0.8));
      if(p.potPattern==='fluted'&&!hanging){
        return 1+0.025*p.potDetail*Math.sin(Math.PI*clamp(t,0,1))**0.65*Math.cos(a*32);
      }
      return 1;
    };
    const segments=concrete?48:stone?56:80;
    function vesselLathe(profile){
      const g=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),segments);
      const a=g.attributes.position;
      for(let i=0;i<a.count;i++){
        const x=a.getX(i),z=a.getZ(i),angle=Math.atan2(z,x),t=(a.getY(i)-bottom)/vesselH;
        const f=radialFactor(angle,t);a.setXYZ(i,x*f,a.getY(i),z*f);
      }
      return g;
    }
    const drain=R*(metal?0.055:0.075),floorT=Math.min(vesselH*0.17,wall*(metal?1.6:1.35));
    const profile=[[drain,bottom],[radiusAt(0)*0.94,bottom],[radiusAt(0),bottom+vesselH*0.026]];
    for(let i=1;i<=16;i++){const t=i/16;profile.push([radiusAt(t),bottom+vesselH*t]);}
    profile.push([R-wall,H],[radiusAt(0.98)-wall,H-vesselH*0.02]);
    for(let i=15;i>=1;i--){const t=i/16;profile.push([Math.max(drain*1.8,radiusAt(t)-wall),Math.max(bottom+floorT,bottom+vesselH*t)]);}
    profile.push([radiusAt(0)-wall,bottom+floorT],[drain,bottom+floorT],[drain,bottom]);
    put('potBody',vesselLathe(profile),'potBody','continuous_open_vessel_with_drain');
    function ring(target,r,y,tube,zone,label,vertical=1){
      const profile=[];
      for(let q=0;q<=8;q++){const a=q/8*TAU;profile.push([r+Math.cos(a)*tube,y+Math.sin(a)*tube*vertical]);}
      put(target,vesselLathe(profile),zone,label);
    }
    ring('potRim',R-wall*0.36,H,lipSection,'potRim','rounded_open_lip',clay?1.4:0.85);
    if(clay){
      const bandProfile=[[R-wall*0.10,H-vesselH*0.14],[R+wall*0.53,H-vesselH*0.135],[R+wall*0.64,H-vesselH*0.04],
        [R+wall*0.38,H+lipSection*0.2],[R-wall*0.1,H],[R-wall*0.1,H-vesselH*0.14]];
      put('potRim',vesselLathe(bandProfile),'potRim','fired_clay_rolled_collar');
      ring('potDetails',radiusAt(0.12),bottom+vesselH*0.12,wall*0.18,'potDetail','potter_foot_groove');
    }
    if(concrete){
      ring('potDetails',radiusAt(0.10),bottom+vesselH*0.10,wall*0.19,'potDetail','recessed_plinth_reveal',0.62);
    }
    if(metal){
      ring('potDetails',radiusAt(0.035),bottom+vesselH*0.035,wall*0.65,'potRim','rolled_lower_seam',0.65);
    }
    if(ceramic||clay||stone){
      const fr=radiusAt(0)*0.78;
      put('potDetails',vesselLathe([[fr-wall,0],[fr,0],[fr+wall*0.25,footH*0.6],[fr,footH+floorT*0.4],
        [fr-wall,footH+floorT*0.4],[fr-wall,0]]),'potDetail','annular_drainage_foot');
    }
    if(metal||concrete){
      const count=metal?3:4;
      for(let q=0;q<count;q++){
        const a=q/count*TAU+(concrete?Math.PI/4:0),rr=radiusAt(0)*0.76;
        const g=new THREE.CylinderGeometry(R*0.060,R*0.075,footH,10);
        g.translate(Math.cos(a)*rr,footH/2,Math.sin(a)*rr);
        put('potDetails',g,'potDetail','isolated_drainage_foot');
      }
    }
    if(!hanging&&!stone&&p.potPattern==='rings'&&p.potDetail>0){
      for(const t of ceramic?[0.68,0.72,0.76]:metal?[0.83,0.87]:[0.24,0.29]){
        ring('potDetails',radiusAt(t)+wall*0.08,bottom+vesselH*t,wall*(0.13+p.potDetail*0.15),'potDetail','turned_inlay_band',0.65);
      }
    }
    if(stone&&p.potDetail>0){
      const rng=seededRandom(p.seed^0x8f343bd);
      for(let q=0;q<Math.round(15+p.potDetail*32);q++){
        const a=q*GOLD,t=0.18+rng()*0.62,rr=radiusAt(t)*radialFactor(a,t);
        const g=new THREE.IcosahedronGeometry(R*(0.004+rng()*0.006),0);
        g.scale(1,0.5,0.35).rotateY(Math.PI/2-a).translate(Math.cos(a)*rr,bottom+vesselH*t,Math.sin(a)*rr);
        put('potDetails',g,q%3?'potDetail':'potRim','mineral_inclusion');
      }
    }
    if(hanging){
      const weaveRows=10+Math.round(p.potDetail*12),stakes=24;
      for(let row=0;row<weaveRows;row++){
        const t=0.06+row/(weaveRows-1)*0.88,points=[];
        for(let q=0;q<=96;q++){
          const a=q/96*TAU,rr=radiusAt(t)+R*0.008+R*0.004*p.potDetail*Math.sin(a*stakes/2+row*Math.PI);
          points.push(V(Math.cos(a)*rr,bottom+vesselH*t,Math.sin(a)*rr));
        }
        put('potDetails',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),96,R*(0.010+p.potDetail*0.004),5,false),
          row%3?'potBody':'potRim','interwoven_horizontal_willow');
      }
      for(let q=0;q<stakes;q++){
        const a=q/stakes*TAU,points=[];
        for(let row=0;row<=18;row++){
          const t=0.035+row/18*0.94,rr=radiusAt(t)+R*0.009+R*0.005*p.potDetail*Math.sin(row*weaveRows/18*Math.PI);
          points.push(V(Math.cos(a)*rr,bottom+vesselH*t,Math.sin(a)*rr));
        }
        put('potDetails',sweepGeometry(points,R*0.012,R*0.009,22,5),'potDetail','vertical_willow_stake');
      }
    }
    // A separate shallow fill surface leaves the inner wall and open rim visible.
    const soilRadius=Math.min(opening-wall*0.18,radiusAt((soilY-bottom)/vesselH)-wall*1.04);
    put('potSoil',vesselLathe([[0,soilY-0.018*k],[soilRadius,soilY-0.018*k],[soilRadius,soilY],[soilRadius*0.7,soilY+0.001*k],[0,soilY+0.002*k]]),
      'soil','continuous_container_soil','solid');
    const soilRng=seededRandom(p.seed^0x574db);
    for(let q=0;q<24;q++){
      const a=q*GOLD,r=soilRadius*Math.sqrt(0.15+soilRng()*0.79),rr=r*radialFactor(a,1);
      const g=new THREE.IcosahedronGeometry(R*(0.009+soilRng()*0.012),0);
      g.scale(1.2,0.35,0.85).translate(Math.cos(a)*rr,soilY+R*0.004,Math.sin(a)*rr);
      put('potSoil',g,q%4?'soil':'root','loose_potting_granule','solid');
    }

    // Map complete trailing hierarchies across the lip, including their pivots,
    // instead of allowing long vines to intersect a wider cluster container.
    root.updateMatrixWorld(true);
    if(isTrailing){
      for(const ctx of members)for(const strand of ctx.G.trailingStrands.children){
        if(!strand.isGroup)continue;
        const origin=strand.getWorldPosition(V()),original=origin.clone();
        const outward=V(strand.position.x,0,strand.position.z).normalize().applyAxisAngle(UP,ctx.yaw);
        if(outward.lengthSq()<0.1)outward.set(1,0,0);
        const d=V(origin.x,0,origin.z),projection=d.dot(outward);
        const targetR=R+wall+0.025*k;
        const travel=Math.max(0,-projection+Math.sqrt(Math.max(0,projection*projection+targetR*targetR-d.lengthSq())));
        const delta=outward.clone().multiplyScalar(travel);
        // Place the first descending section just beyond the rim. Root runners
        // connect the original crown to the lifted lip anchor.
        origin.add(delta);origin.y=Math.max(origin.y,H+basketLift+lipSection+0.008*k);
        const local=ctx.G.trailingStrands.worldToLocal(origin.clone());
        strand.position.copy(local);strand.updateMatrixWorld(true);
        const inv=new THREE.Matrix4().copy(ctx.G.trailingStrands.matrixWorld).invert();
        const a=original.clone().applyMatrix4(inv),b=origin.clone().applyMatrix4(inv);
        stem(ctx.G.trailingStrands,[a,a.clone().lerp(b,0.45).add(V(0,0.005*k,0)),b],
          0.0015*k,0.0011*k,p.species==='String of hearts'?'wireStem':'stem','container_lip_crown_runner',16,5);
      }
      root.updateMatrixWorld(true);
      if(!hanging){
        const floor=R*0.055,knee=R*0.18;
        const deform=v=>{
          if(v.y<floor+knee){
            const depth=floor+knee-v.y,r=Math.hypot(v.x,v.z),extra=depth*0.58;
            v.y=floor+knee*Math.exp(-depth/knee);
            if(r>1e-8){v.x*=1+extra/r;v.z*=1+extra/r;}
          }return v;
        };
        const targets=new Set();
        for(const ctx of members)ctx.G.trailingStrands.traverse(o=>targets.add(o));
        const oldWorld=new Map([...targets].map(o=>[o,o.matrixWorld.clone()]));
        const newWorld=new Map();
        for(const o of targets){
          const m=oldWorld.get(o).clone(),position=V().setFromMatrixPosition(m);
          m.setPosition(deform(position));newWorld.set(o,m);
        }
        for(const o of targets){
          const parentWorld=newWorld.get(o.parent)||o.parent.matrixWorld;
          const local=new THREE.Matrix4().copy(parentWorld).invert().multiply(newWorld.get(o));
          local.decompose(o.position,o.quaternion,o.scale);
        }
        for(const part of records){
          if(!targets.has(part.node))continue;
          const old=oldWorld.get(part.node),inv=new THREE.Matrix4().copy(newWorld.get(part.node)).invert(),a=part.g.attributes.position,v=V();
          for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(old);deform(v).applyMatrix4(inv);a.setXYZ(i,v.x,v.y,v.z);}
          a.needsUpdate=true;
        }
        root.updateMatrixWorld(true);
      }
    }
    let suspension=0,hookTop=H;
    if(hanging){
      // Rim-adjacent vertical sections keep cords outside most foliage before
      // they converge above the measured canopy.
      const canopyTop=Math.max(plantBounds.max.y+plantElevation-basketLift,H+R);
      const shoulder=canopyTop+R*0.12;
      const apex=Math.max(H+R*2.4*p.hangingLength,shoulder+R*1.05*p.hangingLength);
      suspension=apex-H;
      const count=p.hangingCordCount,cordR=R*0.012;
      for(let q=0;q<count;q++){
        const a=q/count*TAU+Math.PI/4,c=Math.cos(a),s=Math.sin(a),anchor=V(c*(R+wall),H,s*(R+wall));
        const outer=Math.max(R*1.16,Math.min(canopyRadius*1.08,R*3.5));
        const points=[anchor,V(c*outer,H+(shoulder-H)*0.35,s*outer),V(c*outer,shoulder,s*outer),V(c*R*0.12,apex-R*0.1,s*R*0.12),V(0,apex,0)];
        put('potDetails',sweepGeometry(points,cordR,cordR*0.88,34,6),'potCord','load_bearing_suspension_cord','solid');
        const loop=new THREE.TorusGeometry(R*0.045,cordR*0.7,5,16);
        loop.rotateY(-a).translate(...anchor.toArray());
        put('potDetails',loop,'potDetail','basket_suspension_eyelet');
        for(let n=0;n<3;n++){
          const ring=new THREE.TorusGeometry(cordR*1.3,cordR*0.40,4,10);
          ring.rotateX(Math.PI/2).translate(c*(R+wall),H+R*(0.045+n*0.025),s*(R+wall));
          put('potDetails',ring,'potCord','bound_cord_wrap','solid');
        }
      }
      const hanger=new THREE.Group();hanger.name='potHanger';hanger.position.set(0,apex,0);
      hanger.userData={component:'potHanger',detachable:true};pot.add(hanger);sub.potHanger=hanger;
      const hookPoints=[V(0,-R*0.035,0),V(0,R*0.10,0)];
      for(let q=0;q<=20;q++){
        const a=Math.PI-q/20*Math.PI*1.70;
        hookPoints.push(V(R*0.10+Math.cos(a)*R*0.10,R*0.15+Math.sin(a)*R*0.10,0));
      }
      put('potHanger',sweepGeometry(hookPoints,R*0.013,R*0.011,30,7),'potDetail','forged_open_hanging_hook');
      if(p.hangerSway>0)motion(hanger,'z',p.hangerSway,0,'hook stillness');
      hookTop=apex+R*0.25;
    }
    const containerRecords=records.filter(r=>{
      let n=r.node;while(n){if(n===pot)return true;n=n.parent;}return false;
    });
    const containerBounds=recordBounds(containerRecords);
    potSpecs={
      present:true,style,openingDiameter:opening*2,nominalOuterDiameter:R*2,
      bodyHeight:vesselH,height:H+lipSection,wallThickness:wall,rimThickness:lipSection*2,
      footHeight:footH,soilSurfaceHeight:soilY+basketLift,baseElevation:basketLift,
      plantElevation,rootBedRadius:bedRadius,fitClamped:desired*p.potScale<bedRadius*1.075,
      pattern:hanging?'woven':stone?'mineral':p.potPattern,
      suspensionLength:suspension,cordCount:hanging?p.hangingCordCount:0,
      hangerTopHeight:hanging?hookTop+basketLift:null,
      dimensions:containerBounds.getSize(V()).toArray(),
      bounds:{min:containerBounds.min.toArray(),max:containerBounds.max.toArray()},
      roughness:materials.pot.roughness,metalness:materials.pot.metalness,
      trailingGroundTreatment:isTrailing&&!hanging?'outward ground drape':'none'
    };
  }
  createPot();

  root.updateMatrixWorld(true);
  const usedMaterialNames=new Set(records.map(part=>part.material));
  const usedZones=[...new Set(records.map(part=>part.zone))];
  if(p.mergeForProduction){
    const buckets=Object.fromEntries(Object.keys(materials).map(k=>[k,[]]));
    for(const part of records){part.g.applyMatrix4(part.node.matrixWorld);buckets[part.material].push(part);}
    root.clear();
    for(const[key,list]of Object.entries(buckets)){
      const mesh=finish(list,materials[key],key==='solid'?'botanical':materials[key].name,true);if(mesh)root.add(mesh);
    }root.animations=[];
  }else{
    const buckets=new Map();
    for(const part of records){
      if(!buckets.has(part.node))buckets.set(part.node,Object.fromEntries(Object.keys(materials).map(k=>[k,[]])));
      buckets.get(part.node)[part.material].push(part);
    }
    for(const[target,lists]of buckets)for(const[key,list]of Object.entries(lists)){
      const group=finish(list,materials[key],unique(`${target.name}_${key}`),false);if(group)target.add(group);
    }
    const prune=object=>{
      for(const child of [...object.children])if(!child.isMesh){prune(child);if(!child.children.length)object.remove(child);}
    };prune(root);
    const existingNames=new Set();root.traverse(o=>existingNames.add(o.name));
    const tracks=[],times=Array.from({length:33},(_,i)=>i*0.25);
    for(const data of motions){
      const{target,axis,amplitude,phase,base,harmonic}=data;if(!existingNames.has(target.name))continue;
      const values=times.map(t=>base+amplitude*(Math.sin(t/8*TAU*harmonic+phase)-Math.sin(phase)));
      const track=new THREE.NumberKeyframeTrack(`${target.name}.rotation[${axis}]`,times,values);
      track.setInterpolation(THREE.InterpolateSmooth);tracks.push(track);
    }
    root.animations=tracks.length?[new THREE.AnimationClip('Worldflora_Species_Idle',8,tracks)]:[];
  }
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root),groundOffset=Number.isFinite(bounds.min.y)?-bounds.min.y:0;
  for(const child of root.children)child.position.y+=groundOffset;
  root.updateMatrixWorld(true);bounds.setFromObject(root);
  if(potSpecs.present){
    potSpecs.baseElevation+=groundOffset;potSpecs.soilSurfaceHeight+=groundOffset;potSpecs.plantElevation+=groundOffset;
    if(potSpecs.hangerTopHeight!==null)potSpecs.hangerTopHeight+=groundOffset;
    potSpecs.bounds.min[1]+=groundOffset;potSpecs.bounds.max[1]+=groundOffset;
  }
  let triangles=0,meshes=0;
  const ownedGeometries=new Set();
  root.traverse(o=>{
    if(!o.isMesh)return;meshes++;ownedGeometries.add(o.geometry);
    triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;
  });
  root.userData.specs={
    species:p.species,growthHabit:p.growthForm==='cluster'?INFO[p.species][2]:
      isTrailing?'suspended rooted cascading crown':topiary?'clipped woody standard':isCactus?'water-storing ribbed stem':isRosette?'basal rosette':INFO[p.species][2],
    dimensions:bounds.getSize(V()).toArray(),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    triangles,meshes,materialCount:usedMaterialNames.size,memberCount,units:'meters',pose:'resting',groundOffset,
    soilCrownHeight:groundOffset+plantElevation+0.026*members[0].k,
    suspendedStudy:p.potStyle==='hanging basket'||isTrailing&&p.potStyle==='none',
    potStyle:p.potStyle,pot:potSpecs
  };
  root.userData.parameters={...p};
  // Resolved defaults prevent a metadata-driven UI from displaying terracotta
  // swatches on an automatically selected ceramic or metal container.
  for(const key of Object.keys(BASE))root.userData.parameters[key]=`#${C[key].toString(16).padStart(6,'0')}`;
  root.userData.zones={...C};root.userData.usedZones=usedZones;
  root.userData.members=memberSpecs.map(m=>({...m,position:[m.position[0],m.position[1]+plantElevation+groundOffset,m.position[2]]}));
  root.userData.singleSpecies=true;root.userData.rigAvailable=!p.mergeForProduction;
  root.userData.rigTargets=rigTargets;root.userData.detach=p.potStyle==='none'?[...BOTANICAL_DETACH]:detach.filter(n=>n!=='potHanger'||p.potStyle==='hanging basket');
  root.userData.night=night;root.userData.catalog=[...SPECIES];root.userData.conditionSchema=conditionSchema;
  const key=relevanceKey(p);zoneCache.delete(key);zoneCache.set(key,new Set(usedZones));
  while(zoneCache.size>16)zoneCache.delete(zoneCache.keys().next().value);
  root.userData.getRelevantParams=(values=root.userData.parameters,options={})=>
    getRelevantParams(values,{...options,...(relevanceKey(normalize(values))===key?{usedZones}: {})});
  root.userData.setComponentVisible=(component,visible)=>{
    if(p.mergeForProduction)return false;
    root.traverse(object=>{if(object.userData.component===component)object.visible=Boolean(visible);});return true;
  };
  root.userData.setNight=amount=>{
    const value=clamp(Number(amount)||0,0,1);GLOW.emissive.setHex(C.glow);GLOW.emissiveIntensity=lerp(0.03,night.pollenGlow.intensity,value);
  };
  let disposed=false;
  root.userData.dispose=()=>{
    if(disposed)return;disposed=true;
    // Capture ownership before editing so detached meshes are released as well.
    ownedGeometries.forEach(g=>g.dispose());Object.values(materials).forEach(m=>m.dispose());
  };
  return root;
}
export default createAsset;