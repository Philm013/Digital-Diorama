import * as THREE from 'three';
import { GROUND_TYPES, type GroundType } from './ground';
import type { Terrain } from './Terrain';
import type { Quality, Season } from './types';
import { rng } from './util';
import { applyWind } from './wind';

function tuftGeometry(blades: number, R: () => number) {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  for (let b = 0; b < blades; b++) {
    const a = R() * Math.PI * 2, lean = 0.12 + R() * 0.25;
    const h = 0.22 + R() * 0.28, w = 0.018 + R() * 0.014;
    const ox = (R() - 0.5) * 0.12, oz = (R() - 0.5) * 0.12;
    const dx = Math.cos(a), dz = Math.sin(a);
    const px = -dz * w, pz = dx * w;
    const base = pos.length / 3;
    const mid = h * 0.55;
    pos.push(ox + px, 0, oz + pz, ox - px, 0, oz - pz,
      ox + dx * lean * 0.35 + px * 0.6, mid, oz + dz * lean * 0.35 + pz * 0.6, ox + dx * lean * 0.35 - px * 0.6, mid, oz + dz * lean * 0.35 - pz * 0.6,
      ox + dx * lean, h, oz + dz * lean);
    const dark = 0.62, midc = 0.92, tip = 1.18;
    col.push(dark, dark, dark, dark, dark, dark, midc, midc, midc, midc, midc, midc, tip, tip, tip);
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // grass looks best lit from above regardless of blade orientation
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) { n.setXYZ(i, n.getX(i) * 0.3, 1, n.getZ(i) * 0.3); }
  n.needsUpdate = true;
  return g;
}

function flowerGeometry() {
  const g1 = new THREE.CylinderGeometry(0.006, 0.008, 0.28, 3).translate(0, 0.14, 0);
  const head = new THREE.IcosahedronGeometry(0.045, 0).scale(1, 0.55, 1).translate(0, 0.29, 0);
  const cols = (g: THREE.BufferGeometry, c: number) => {
    const a = new Float32Array(g.attributes.position.count * 3).fill(c);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  };
  // stem stays green via colour < 0: we encode stem as 0.0 and petals as 1.0, then tint per instance
  const stem = cols(g1.index ? g1.toNonIndexed() : g1, 0.0);
  const petals = cols(head.index ? head.toNonIndexed() : head, 1.0);
  const merged = new THREE.BufferGeometry();
  const p = new Float32Array([...stem.attributes.position.array, ...petals.attributes.position.array]);
  const c = new Float32Array([...stem.attributes.color.array, ...petals.attributes.color.array]);
  merged.setAttribute('position', new THREE.BufferAttribute(p, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(c, 3));
  merged.computeVertexNormals();
  return merged;
}

const SEASON_TINT: Record<Season, string> = { spring: '#b8e07a', summer: '#ffffff', autumn: '#e0b060', winter: '#c9c2a8' };

/** where groundcover can grow: the diorama's terrain, or a chunk of the endless world */
export interface CoverSource {
  heightAt(x: number, z: number): number;
  groundAt(x: number, z: number): GroundType;
  slopeAt(x: number, z: number): number;
  waterLevel: number | null;
}

/** geometries and materials for one season & quality, shared by every patch that uses them */
export class CoverKit {
  tuft: THREE.BufferGeometry;
  grassMat: THREE.MeshLambertMaterial;
  flowerGeo: THREE.BufferGeometry;
  flowerMat: THREE.MeshLambertMaterial;
  pebbleGeo: THREE.BufferGeometry;
  pebbleMat: THREE.MeshLambertMaterial;
  leafGeo: THREE.BufferGeometry;
  leafMat: THREE.MeshLambertMaterial;
  constructor(public quality: Quality, public season: Season, seed: number) {
    this.tuft = tuftGeometry(quality === 'low' ? 3 : 5, rng(seed));
    this.grassMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    // blades are lit like the ground beneath them: keep the up-facing normal on both faces
    this.grassMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize( vNormal );');
    };
    this.grassMat.customProgramCacheKey = () => 'grassUpNormal';
    applyWind(this.grassMat, 0.45, 2.2, true);
    this.flowerGeo = flowerGeometry();
    this.flowerMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    // stems: tint the instance colour toward green on vertices flagged 0
    this.flowerMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
          #ifdef USE_INSTANCING_COLOR
          float petal = color.r;
          vColor.rgb = mix(vec3(0.27, 0.45, 0.2), instanceColor.rgb, petal);
          #endif`);
    };
    this.flowerMat.customProgramCacheKey = () => 'flowerStem';
    applyWind(this.flowerMat, 0.32, 2, true);
    this.pebbleGeo = new THREE.IcosahedronGeometry(0.07, 0).scale(1, 0.55, 0.8);
    this.pebbleMat = new THREE.MeshLambertMaterial({ flatShading: true });
    this.leafGeo = new THREE.CircleGeometry(0.035, 5).scale(1, 0.6, 1).rotateX(-Math.PI / 2).translate(0, 0.012, 0);
    this.leafMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  }
  dispose() {
    for (const g of [this.tuft, this.flowerGeo, this.pebbleGeo, this.leafGeo]) g.dispose();
    for (const m of [this.grassMat, this.flowerMat, this.pebbleMat, this.leafMat]) m.dispose();
  }
}

const KINDS = ['grass', 'flowers', 'pebbles', 'litter'] as const;
const MAX_DENSITY = Object.fromEntries(KINDS.map((k) => [k, Math.max(...GROUND_TYPES.map((g) => g[k] ?? 0))])) as Record<typeof KINDS[number], number>;

export class Groundcover {
  group = new THREE.Group();
  private meshes: THREE.InstancedMesh[] = [];
  private kit: CoverKit | null = null;
  private ownsKit = true;
  count = 0;
  constructor() { this.group.name = 'groundcover'; }

  build(terrain: Terrain, density: number, quality: Quality, season: Season, seed: number, avoid?: (x: number, z: number) => boolean) {
    this.clear();
    if (density <= 0) return;
    this.kit = new CoverKit(quality, season, seed);
    this.ownsKit = true;
    this.scatter(terrain, -terrain.width / 2 + 0.15, terrain.width / 2 - 0.15, -terrain.depth / 2 + 0.15, terrain.depth / 2 - 0.15, density, seed, avoid);
  }

  /** fill a patch of ground using a shared kit (the endless world's chunks) */
  buildPatch(src: CoverSource, kit: CoverKit, x0: number, x1: number, z0: number, z1: number, density: number, seed: number) {
    this.clear();
    if (density <= 0) return;
    this.kit = kit;
    this.ownsKit = false;
    this.scatter(src, x0, x1, z0, z1, density, seed);
  }

  private scatter(src: CoverSource, x0: number, x1: number, z0: number, z1: number, density: number, seed: number, avoid?: (x: number, z: number) => boolean) {
    const kit = this.kit!;
    const { quality, season } = kit;
    const R = rng(seed * 17 + 5);
    const q = quality === 'high' ? 1 : quality === 'medium' ? 0.6 : 0.32;
    const k = density * q;
    const pts: Record<string, number[]> = { grass: [], flowers: [], pebbles: [], litter: [] };
    const cols: Record<string, THREE.Color[]> = { grass: [], flowers: [], pebbles: [], litter: [] };
    const tint = new THREE.Color(SEASON_TINT[season]);
    const flowerPalette = ['#f7f3e8', '#ffd84a', '#c88ae0', '#ff8fb1', '#e8505b', '#7fb2ff', '#ffb347'].map((c) => new THREE.Color(c));
    const litterPalette = (season === 'autumn' ? ['#c7652b', '#d99a2b', '#a8432a', '#8a5a2b'] : ['#7a5a32', '#8b6a3a', '#6b4f2a', '#9a7a42']).map((c) => new THREE.Color(c));
    const grey = new THREE.Color('#8a8580');
    const cell = 0.5;
    const area = cell * cell;
    const wl = src.waterLevel;
    for (let z = z0; z < z1; z += cell) {
      for (let x = x0; x < x1; x += cell) {
        for (const kind of KINDS) {
          // candidates at the highest density any ground allows; each keeps its chance on the ground it lands on
          let n = MAX_DENSITY[kind] * area * k * (kind === 'pebbles' ? 0.6 : 1);
          while (n > 0) {
            const chance = Math.min(1, n);
            n -= 1;
            if (R() >= chance) continue;
            const px = x + R() * cell, pz = z + R() * cell;
            if (px > x1 || pz > z1) continue;
            const gt = src.groundAt(px, pz);
            const dens = gt[kind] ?? 0;
            if (!dens || R() * MAX_DENSITY[kind] > dens) continue;
            const h = src.heightAt(px, pz);
            if (wl !== null && h < wl + (kind === 'pebbles' ? -0.6 : 0.03)) continue;
            if (kind !== 'pebbles' && src.slopeAt(px, pz) > 1.3) continue;
            if (avoid && kind !== 'pebbles' && avoid(px, pz)) continue;
            pts[kind].push(px, h, pz, R() * Math.PI * 2, 0.7 + R() * 0.6);
            if (kind === 'grass') {
              const base = new THREE.Color(gt.grassColor ?? '#6a9a3c');
              base.offsetHSL((R() - 0.5) * 0.04, (R() - 0.5) * 0.1, (R() - 0.5) * 0.08);
              if (gt.id !== 'dry') base.multiply(tint);
              cols.grass.push(base);
            } else if (kind === 'flowers') cols.flowers.push(flowerPalette[Math.floor(R() * flowerPalette.length)]);
            else if (kind === 'pebbles') { const c = new THREE.Color(gt.color2).lerp(grey, 0.6); c.offsetHSL(0, 0, (R() - 0.5) * 0.15); cols.pebbles.push(c); }
            else cols.litter.push(litterPalette[Math.floor(R() * litterPalette.length)]);
          }
        }
      }
    }
    this.add(kit.tuft, kit.grassMat, pts.grass, cols.grass, false);
    if (season !== 'winter') this.add(kit.flowerGeo, kit.flowerMat, pts.flowers, cols.flowers, false);
    this.add(kit.pebbleGeo, kit.pebbleMat, pts.pebbles, cols.pebbles, true);
    this.add(kit.leafGeo, kit.leafMat, pts.litter, cols.litter, false);
  }

  private add(geo: THREE.BufferGeometry, mat: THREE.Material, pts: number[], cols: THREE.Color[], castShadow: boolean) {
    const n = pts.length / 5;
    if (!n) return;
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      p.set(pts[i * 5], pts[i * 5 + 1], pts[i * 5 + 2]);
      q.setFromAxisAngle(up, pts[i * 5 + 3]);
      s.setScalar(pts[i * 5 + 4]);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, cols[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    this.group.add(mesh);
    this.meshes.push(mesh);
    this.count += n;
  }

  /** keep blades, flowers, pebbles and leaves on the ground inside an area that was just sculpted */
  follow(terrain: Terrain, x0: number, x1: number, z0: number, z1: number) {
    for (const mesh of this.meshes) {
      const attr = mesh.instanceMatrix, a = attr.array as Float32Array;
      let lo = -1, hi = -1;
      for (let i = 0; i < mesh.count; i++) {
        const o = i * 16, x = a[o + 12], z = a[o + 14];
        if (x < x0 || x > x1 || z < z0 || z > z1) continue;
        a[o + 13] = terrain.heightAt(x, z);
        if (lo < 0) lo = i;
        hi = i;
      }
      if (lo < 0) continue;
      attr.clearUpdateRanges();
      attr.addUpdateRange(lo * 16, (hi - lo + 1) * 16); // instances were laid out row by row, so this span is small
      attr.needsUpdate = true;
    }
  }

  clear() {
    for (const m of this.meshes) { this.group.remove(m); m.dispose(); }
    this.meshes = [];
    this.count = 0;
    if (this.kit && this.ownsKit) this.kit.dispose();
    this.kit = null;
  }
}
