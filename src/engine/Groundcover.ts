import * as THREE from 'three';
import { GROUND_TYPES, Terrain } from './Terrain';
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

export class Groundcover {
  group = new THREE.Group();
  private meshes: THREE.InstancedMesh[] = [];
  count = 0;
  constructor() { this.group.name = 'groundcover'; }

  build(terrain: Terrain, density: number, quality: Quality, season: Season, seed: number, avoid?: (x: number, z: number) => boolean) {
    this.clear();
    if (density <= 0) return;
    const R = rng(seed * 17 + 5);
    const q = quality === 'high' ? 1 : quality === 'medium' ? 0.6 : 0.32;
    const k = density * q;
    const grassPts: number[] = [], grassCol: THREE.Color[] = [];
    const flowerPts: number[] = [], flowerCol: THREE.Color[] = [];
    const pebblePts: number[] = [], pebbleCol: THREE.Color[] = [];
    const litterPts: number[] = [], litterCol: THREE.Color[] = [];
    const tint = new THREE.Color(SEASON_TINT[season]);
    const flowerPalette = ['#f7f3e8', '#ffd84a', '#c88ae0', '#ff8fb1', '#e8505b', '#7fb2ff', '#ffb347'].map((c) => new THREE.Color(c));
    const litterPalette = (season === 'autumn' ? ['#c7652b', '#d99a2b', '#a8432a', '#8a5a2b'] : ['#7a5a32', '#8b6a3a', '#6b4f2a', '#9a7a42']).map((c) => new THREE.Color(c));
    const cell = 0.5;
    const wl = terrain.waterLevel;
    for (let z = -terrain.depth / 2 + 0.15; z < terrain.depth / 2 - 0.15; z += cell) {
      for (let x = -terrain.width / 2 + 0.15; x < terrain.width / 2 - 0.15; x += cell) {
        const gt = terrain.groundAt(x, z);
        const area = cell * cell;
        const tries = [
          [gt.grass ?? 0, grassPts, 'grass'],
          [gt.flowers ?? 0, flowerPts, 'flower'],
          [gt.pebbles ?? 0, pebblePts, 'pebble'],
          [gt.litter ?? 0, litterPts, 'litter'],
        ] as const;
        for (const [dens, arr, kind] of tries) {
          let n = dens * area * k * (kind === 'pebble' ? 0.6 : 1);
          while (n > 0) {
            if (R() < n) {
              const px = x + (R() - 0.5) * cell, pz = z + (R() - 0.5) * cell;
              const h = terrain.heightAt(px, pz);
              if (wl !== null && h < wl + (kind === 'pebble' ? -0.6 : 0.03)) { n -= 1; continue; }
              if (kind !== 'pebble' && terrain.slopeAt(px, pz) > 1.3) { n -= 1; continue; }
              if (avoid && kind !== 'pebble' && avoid(px, pz)) { n -= 1; continue; }
              arr.push(px, h, pz, R() * Math.PI * 2, 0.7 + R() * 0.6);
              if (kind === 'grass') {
                const base = new THREE.Color(gt.grassColor ?? '#6a9a3c');
                base.offsetHSL((R() - 0.5) * 0.04, (R() - 0.5) * 0.1, (R() - 0.5) * 0.08);
                if (gt.id !== 'dry') base.multiply(tint);
                grassCol.push(base);
              } else if (kind === 'flower') flowerCol.push(flowerPalette[Math.floor(R() * flowerPalette.length)]);
              else if (kind === 'pebble') { const c = new THREE.Color(GROUND_TYPES[GROUND_TYPES.indexOf(gt)].color2).lerp(new THREE.Color('#8a8580'), 0.6); c.offsetHSL(0, 0, (R() - 0.5) * 0.15); pebbleCol.push(c); }
              else litterCol.push(litterPalette[Math.floor(R() * litterPalette.length)]);
            }
            n -= 1;
          }
        }
      }
    }
    const tuft = tuftGeometry(quality === 'low' ? 3 : 5, rng(seed));
    const grassMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    // blades are lit like the ground beneath them: keep the up-facing normal on both faces
    grassMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize( vNormal );');
    };
    grassMat.customProgramCacheKey = () => 'grassUpNormal';
    applyWind(grassMat, 0.45, 2.2, true);
    this.add(tuft, grassMat, grassPts, grassCol, 1, false);
    if (season !== 'winter') {
      const fmat = new THREE.MeshLambertMaterial({ vertexColors: true });
      // stems: tint the instance colour toward green on vertices flagged 0
      fmat.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
          #ifdef USE_INSTANCING_COLOR
          float petal = color.r;
          vColor.rgb = mix(vec3(0.27, 0.45, 0.2), instanceColor.rgb, petal);
          #endif`);
      };
      fmat.customProgramCacheKey = () => 'flowerStem';
      applyWind(fmat, 0.32, 2, true);
      this.add(flowerGeometry(), fmat, flowerPts, flowerCol, 1, false);
    }
    const peb = new THREE.IcosahedronGeometry(0.07, 0).scale(1, 0.55, 0.8);
    this.add(peb, new THREE.MeshLambertMaterial({ flatShading: true }), pebblePts, pebbleCol, 1, true);
    const leaf = new THREE.CircleGeometry(0.035, 5).scale(1, 0.6, 1).rotateX(-Math.PI / 2).translate(0, 0.012, 0);
    this.add(leaf, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), litterPts, litterCol, 1, false);
  }

  private add(geo: THREE.BufferGeometry, mat: THREE.Material, pts: number[], cols: THREE.Color[], scale: number, castShadow: boolean) {
    const n = pts.length / 5;
    if (!n) { geo.dispose(); mat.dispose(); return; }
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      p.set(pts[i * 5], pts[i * 5 + 1], pts[i * 5 + 2]);
      q.setFromAxisAngle(up, pts[i * 5 + 3]);
      s.setScalar(pts[i * 5 + 4] * scale);
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
    for (const m of this.meshes) { this.group.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); m.dispose(); }
    this.meshes = [];
    this.count = 0;
  }
}
