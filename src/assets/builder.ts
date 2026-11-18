import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { ANIMALS as WILDFORM } from '@ref/Animals/src/data/catalog';
import type { AssetDef } from './types';
import { loadModule, type AssetModule } from './modules';
import { BUILTINS } from './builtin/fungi';
import type { Quality } from '../engine/types';

export type RigRole = 'head' | 'tail' | 'wing' | 'leg' | 'jaw' | 'body' | 'other';
export interface RigNode {
  name: string;
  node: THREE.Object3D;
  axis: 'x' | 'y' | 'z';
  min: number; // degrees (or scale)
  max: number;
  speed: number;
  phase: number;
  scale: boolean;
  role: RigRole;
  base: number;
  /** user/script override in degrees (or scale); null = automatic */
  hold: number | null;
}

export interface BuiltModel {
  /** wrapper: yaw-corrected, exhibit-scaled, centred */
  object: THREE.Group;
  raw: THREE.Object3D;
  clips: THREE.AnimationClip[];
  rig: RigNode[];
  update?: (t: number) => void;
  setNight?: (v: number) => void;
  height: number;
  radius: number;
  /** half the footprint across the body (local x) */
  halfWidth: number;
  length: number;
  exhibitScale: number;
  skinned: boolean;
  triangles: number;
  schema: Record<string, import('./modules').ParamSpec>;
}

const WILD_BY_ID = Object.fromEntries(WILDFORM.map((a) => [a.id, a]));

export function exhibitScale(length: number) {
  if (!(length > 0)) return 1;
  const target = Math.max(length, 0.3 + 0.7 * Math.sqrt(length));
  return target / length;
}

function roleOf(name: string): RigRole {
  const n = name.toLowerCase();
  if (n.includes('wing') || n.startsWith('humerus') || n.includes('flipper') || n === 'fin') return 'wing';
  if (n.startsWith('leg') || n.startsWith('thigh') || n.startsWith('shin') || n.startsWith('arm') || n.startsWith('forearm')) return 'leg';
  if (n.includes('tail') || n === 'rattle' || n.includes('fluke')) return 'tail';
  if (n.includes('head') || n.includes('neck') || n.includes('cranium')) return 'head';
  if (n.includes('jaw') || n.includes('tongue') || n.includes('throat') || n.includes('dewlap') || n.includes('valve')) return 'jaw';
  if (n === 'body' || n === 'shell') return 'body';
  return 'other';
}

/** Merge sibling meshes that share a material so each animated pivot costs one draw call. */
export function consolidate(root: THREE.Object3D) {
  const parents = new Set<THREE.Object3D>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh && o.parent && !Array.isArray(m.material)) parents.add(o.parent);
  });
  for (const parent of parents) {
    const meshes = parent.children.filter((c) => (c as THREE.Mesh).isMesh && !(c as THREE.SkinnedMesh).isSkinnedMesh && c.children.length === 0 && !Array.isArray((c as THREE.Mesh).material)) as THREE.Mesh[];
    if (meshes.length < 2) continue;
    const byMat = new Map<THREE.Material, THREE.Mesh[]>();
    for (const m of meshes) {
      const mat = m.material as THREE.Material;
      if (!byMat.has(mat)) byMat.set(mat, []);
      byMat.get(mat)!.push(m);
    }
    for (const [mat, list] of byMat) {
      if (list.length < 2) continue;
      const names = Object.keys(list[0].geometry.attributes).filter((k) => list.every((m) => k in m.geometry.attributes && m.geometry.attributes[k].itemSize === list[0].geometry.attributes[k].itemSize));
      if (!names.includes('position')) continue;
      const anyIndexed = list.some((m) => m.geometry.index), allIndexed = list.every((m) => m.geometry.index);
      const geos = list.map((m) => {
        let g = m.geometry.clone();
        if (anyIndexed && !allIndexed && g.index) g = g.toNonIndexed();
        for (const k of Object.keys(g.attributes)) if (!names.includes(k)) g.deleteAttribute(k);
        for (const k of Object.keys(g.morphAttributes)) delete (g.morphAttributes as Record<string, unknown>)[k];
        m.updateMatrix();
        g.applyMatrix4(m.matrix);
        return g;
      });
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = `${parent.name || 'part'}-merged`;
      mesh.castShadow = list.some((m) => m.castShadow);
      mesh.receiveShadow = true;
      mesh.renderOrder = list[0].renderOrder;
      for (const m of list) { parent.remove(m); m.geometry.dispose(); }
      parent.add(mesh);
    }
  }
}

function qualityParams(def: AssetDef, q: Quality): Record<string, unknown> {
  switch (def.family) {
    case 'mammal': case 'bird': return { detail: q === 'high' ? 'standard' : 'draft' };
    case 'wildform': return { detailLevel: q === 'high' ? 'Studio' : 'Draft', mergeForProduction: false };
    case 'conifer': return {};
    case 'deciduous': return { leafDetailLevel: 'low', foliageDensity: q === 'low' ? 0.3 : undefined };
    case 'water': return q === 'low' ? { resolution: 'low' } : {};
    // Worldflora plants are very detailed; trim plumes/flowers/foliage on lower tiers
    case 'plant': return q === 'high' ? {} : q === 'medium'
      ? { grassPlumeFullness: 0.3, flowerDensity: 0.35, foliageCharacter: 0.45, branchingDensity: 0.35, flowering: 0.25 }
      : { flowering: 0.08, grassPlumeFullness: 0.2, flowerDensity: 0.2, foliageCharacter: 0.25, maturity: 0.65, branchingDensity: 0.25 };
    default: return {};
  }
}

interface Proto { raw: THREE.Object3D; clips: THREE.AnimationClip[]; schema: Record<string, import('./modules').ParamSpec>; rigSpec: Record<string, { axis: string; range: [number, number]; type?: string; speed?: number; phase?: number }>; }
const protoCache = new Map<string, Promise<Proto>>();
/** families whose objects carry their own update closures — never cloned */
const UNIQUE = new Set(['water', 'aquarium', 'builtin']);

async function buildRaw(def: AssetDef, params: Record<string, unknown>): Promise<Proto> {
  if (def.path.startsWith('builtin:')) {
    const b = BUILTINS[def.path.slice(8)];
    return { raw: b.createAsset(params), clips: [], schema: b.params, rigSpec: {} };
  }
  const mod: AssetModule = await loadModule(def.path);
  const p = { ...params };
  let schema = mod.params ?? {};
  if (def.family === 'wildform') {
    const cfg = WILD_BY_ID[String(p.__animal)];
    p.__animal = cfg;
    if (mod.getSchema) schema = mod.getSchema(cfg);
  }
  const raw = mod.createAsset(p);
  let clips: THREE.AnimationClip[] = [];
  if ((def.family === 'mammal' || def.family === 'bird') && mod.createClips) clips = mod.createClips(raw);
  else if (raw.animations?.length) clips = raw.animations;
  let rigSpec = (mod.rig ?? {}) as Proto['rigSpec'];
  if (def.family === 'wildform') rigSpec = (raw.userData.rig ?? {}) as Proto['rigSpec'];
  if (def.family === 'wildform' || def.family === 'reptile') consolidate(raw);
  return { raw, clips, schema, rigSpec };
}

export async function buildModel(def: AssetDef, userParams: Record<string, unknown>, quality: Quality, trueScale: boolean): Promise<BuiltModel> {
  const params = { ...def.params, ...stripUndefined(qualityParams(def, quality)), ...userParams };
  const key = def.id + '|' + JSON.stringify(params);
  let proto: Proto;
  let raw: THREE.Object3D;
  if (UNIQUE.has(def.family)) {
    proto = await buildRaw(def, params);
    raw = proto.raw;
  } else {
    let pp = protoCache.get(key);
    if (!pp) { pp = buildRaw(def, params); protoCache.set(key, pp); pp.catch(() => protoCache.delete(key)); }
    proto = await pp;
    let skinned = false;
    proto.raw.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true; });
    raw = skinned ? skeletonClone(proto.raw) : proto.raw.clone(true);
    raw.userData = { ...proto.raw.userData };
  }
  const object = new THREE.Group();
  object.name = 'model';
  const yawWrap = new THREE.Group();
  yawWrap.rotation.y = def.yaw ?? 0;
  yawWrap.add(raw);
  object.add(yawWrap);
  object.updateMatrixWorld(true);
  let hasSkin = false;
  raw.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) hasSkin = true; });
  const box = new THREE.Box3().setFromObject(object, hasSkin);
  if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
  const size = box.getSize(new THREE.Vector3());
  // centre animals and small things on their footprint so they turn on the spot
  if (def.category === 'animals' || def.category === 'finds') {
    const c = box.getCenter(new THREE.Vector3());
    yawWrap.position.x -= c.x;
    yawWrap.position.z -= c.z;
  }
  const length = Math.max(size.x, size.z);
  let ex = 1;
  if (!trueScale) {
    if (def.scale) ex = def.scale;
    else if (def.category === 'animals' && def.family !== 'water' && def.family !== 'aquarium') ex = exhibitScale(length);
  }
  object.scale.setScalar(ex);
  let skinned = false, tris = 0;
  raw.traverse((o) => {
    const m = o as THREE.Mesh;
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) { skinned = true; (o as THREE.SkinnedMesh).frustumCulled = false; }
    if (m.isMesh) {
      // small potted-scale plants skip the shadow pass (they are the heaviest meshes)
      m.castShadow = def.family === 'plant' || def.family === 'aquarium' ? false : m.castShadow || def.category !== 'habitats';
      m.receiveShadow = true;
      const g = m.geometry;
      tris += (g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3;
    }
  });
  // rig nodes for procedural idle / gait animation
  const rig: RigNode[] = [];
  if (!skinned) {
    for (const [name, spec] of Object.entries(proto.rigSpec ?? {})) {
      const node = raw.getObjectByName(name);
      if (!node || !spec || !Array.isArray(spec.range)) continue;
      const axis = (['x', 'y', 'z'].includes(spec.axis) ? spec.axis : 'y') as 'x' | 'y' | 'z';
      const isScale = spec.type === 'scale' || spec.axis === 'scale';
      rig.push({
        name, node, axis, min: spec.range[0], max: spec.range[1], speed: spec.speed ?? 0.6, phase: spec.phase ?? Math.random() * 6,
        scale: isScale, role: roleOf(name), base: isScale ? node.scale[axis] : node.rotation[axis], hold: null,
      });
    }
  }
  const ud = raw.userData as { update?: (t: number) => void; setNight?: (v: number) => void };
  return {
    object, raw, clips: proto.clips, rig,
    update: typeof ud.update === 'function' ? ud.update.bind(ud) : undefined,
    setNight: typeof ud.setNight === 'function' ? ud.setNight.bind(ud) : undefined,
    height: Math.max(0.05, box.max.y * ex), radius: Math.max(0.05, (length / 2) * ex), halfWidth: Math.max(0.03, (size.x / 2) * ex), length: length * ex,
    exhibitScale: ex, skinned, triangles: Math.round(tris), schema: proto.schema,
  };
}

function stripUndefined(o: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out;
}

export async function getSchema(def: AssetDef) {
  if (def.path.startsWith('builtin:')) return BUILTINS[def.path.slice(8)].params;
  const mod = await loadModule(def.path);
  if (def.family === 'wildform' && mod.getSchema) return mod.getSchema(WILD_BY_ID[String(def.params.__animal)]);
  return mod.params ?? {};
}

export function clearModelCache() { protoCache.clear(); }
