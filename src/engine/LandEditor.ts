import * as THREE from 'three';
import type { Engine } from './Engine';
import { GROUND_UNIFORMS } from './ground';
import type { GridRect } from './Terrain';
import {
  AREA_BY_ID, STAMP_BY_ID, STYLE_BY_ID, applyStamp, areaMask, autoPaint, generateArea, previewStamp, repaintArea, styleForBiome,
  type AreaKind, type AreaRect, type GroundStyle,
} from './landforms';
import { CATALOG } from '../assets/catalog';
import type { AssetDef } from '../assets/types';
import { clamp, rng } from './util';

export interface StampSettings { id: string; radius: number; height: number; angle: number; paint: boolean }
export interface AreaSettings {
  rect: AreaRect | null;
  oval: boolean;
  /** width of the soft edge (m) */
  feather: number;
  kind: AreaKind;
  /** 'auto' = the landform's own look, 'biome' = the diorama's habitat, or a style id */
  style: string;
  /** relief multiplier (1 = the landform's natural height for the area's size) */
  relief: number;
  rough: number;
  plants: 'none' | 'some' | 'lots';
  seed: number;
}

/** biomes whose plants suit a ground style */
const STYLE_BIOME: Record<string, string> = {
  meadow: 'grassland', forest: 'forest', taiga: 'taiga', grassland: 'grassland', savanna: 'savanna', rainforest: 'rainforest', desert: 'desert', badlands: 'desert',
  arctic: 'tundra', wetland: 'wetland', mountain: 'mountain', volcanic: 'mountain', heath: 'tundra', beach: 'shore', garden: 'garden',
};

/**
 * Build-mode land editing beyond the brushes: landform stamps (with a see-through preview of
 * the new shape), a selected area that can be grown into a landscape, auto-paint, and the
 * outlines drawn on the ground by the terrain shader.
 */
export class LandEditor {
  stamp: StampSettings = { id: 'mountain', radius: 6, height: 7, angle: 0, paint: true };
  area: AreaSettings = { rect: null, oval: false, feather: 2.5, kind: 'hills', style: 'auto', relief: 1, rough: 0.5, plants: 'none', seed: 1 };
  /** the last area generation, so "Try another" can replace it */
  private lastGen: { heights: Float32Array; paint: Uint8Array; water: number | null; actors: string[]; rect: AreaRect } | null = null;
  private ghost: THREE.Mesh;
  private ghostWire: THREE.LineSegments;

  constructor(private e: Engine) {
    const mat = new THREE.MeshBasicMaterial({ color: '#fff6d8', transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, vertexColors: true });
    this.ghost = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    this.ghost.renderOrder = 15;
    this.ghost.visible = false;
    this.ghost.name = 'stamp-preview';
    this.ghostWire = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }));
    this.ghostWire.renderOrder = 16;
    this.ghostWire.visible = false;
    e.scene.add(this.ghost, this.ghostWire);
  }

  /** a default size for a stamp, scaled to the diorama */
  defaultsFor(id: string) {
    const d = STAMP_BY_ID[id];
    const t = this.e.terrain;
    const k = t ? clamp(Math.min(t.width, t.depth * 1.4) / 40, 0.5, 3) : 1;
    return { radius: +(d.radius * k).toFixed(1), height: +Math.min(d.maxHeight, d.height * Math.sqrt(k)).toFixed(1) };
  }
  /** length ÷ width of the chosen stamp (stretched landforms can be pointed) */
  get aspect() { return STAMP_BY_ID[this.stamp.id]?.aspect ?? 1; }
  chooseStamp(id: string) {
    const d = this.defaultsFor(id);
    this.stamp = { ...this.stamp, id, radius: d.radius, height: d.height };
    this.e.changed(false);
  }

  /** the ground style for this diorama, or a chosen one */
  styleFor(choice: string, kind?: AreaKind): GroundStyle {
    if (choice === 'biome' || (choice === 'auto' && (!kind || AREA_BY_ID[kind].style === 'biome'))) return styleForBiome(this.e.doc?.biome ?? 'blank');
    if (choice === 'auto' && kind) return STYLE_BY_ID[AREA_BY_ID[kind].style] ?? styleForBiome(this.e.doc?.biome ?? 'blank');
    return STYLE_BY_ID[choice] ?? styleForBiome(this.e.doc?.biome ?? 'blank');
  }

  /* ---------------- outlines on the ground ---------------- */
  /** a ring (brush) or oval (stamp footprint) drawn on the ground; null hides it */
  setCursor(c: { x: number; z: number; rx: number; rz?: number; angle?: number; color?: string; tick?: boolean } | null) {
    const u = GROUND_UNIFORMS;
    if (!c) { u.uCursorOpt.value.x = 0; return; }
    u.uCursor.value.set(c.x, c.z, c.rx, c.rz ?? c.rx);
    const a = c.angle ?? 0;
    u.uCursorOpt.value.set(1, Math.cos(a), Math.sin(a), c.tick ? 1 : 0);
    u.uCursorCol.value.set(c.color ?? '#ffffff');
  }
  setAreaRect(r: AreaRect | null) {
    this.area.rect = r;
    this.syncArea();
    this.e.changed(false);
  }
  syncArea() {
    const u = GROUND_UNIFORMS, r = this.area.rect;
    if (!r) { u.uSelOpt.value.x = 0; return; }
    u.uSelRect.value.set(r.minX, r.minZ, r.maxX, r.maxZ);
    u.uSelOpt.value.set(1, this.area.oval ? 1 : 0, Math.min(this.area.feather, Math.min(r.maxX - r.minX, r.maxZ - r.minZ) / 2), u.uSelOpt.value.w);
  }
  /** marching ants */
  tick(t: number) { GROUND_UNIFORMS.uSelOpt.value.w = t; }

  /* ---------------- stamps ---------------- */
  private stampOpts(x: number, z: number, radius = this.stamp.radius, angle = this.stamp.angle) {
    const id = this.stamp.id;
    const d = STAMP_BY_ID[id];
    return { id, x, z, radius, height: clamp(this.stamp.height, 0.1, d.maxHeight), angle, paint: this.stamp.paint, style: this.styleFor('biome'), seed: Math.floor(x * 13.7 + z * 7.1) + 1 };
  }

  /** show what a stamp would do at a point (see-through surface + footprint outline) */
  showPreview(p: THREE.Vector3 | null, radius = this.stamp.radius, angle = this.stamp.angle) {
    const t = this.e.terrain;
    if (!t || !p) { this.hidePreview(); return; }
    const d = STAMP_BY_ID[this.stamp.id];
    const o = this.stampOpts(p.x, p.z, radius, angle);
    const pv = previewStamp(t, o);
    const n = pv.res;
    const g = this.ghost.geometry, wg = this.ghostWire.geometry;
    // the preview follows the pointer: reuse its buffers rather than allocating on every move
    const same = (g.attributes.position as THREE.BufferAttribute | undefined)?.count === n * n;
    const pos = same ? (g.attributes.position.array as Float32Array) : new Float32Array(n * n * 3);
    const col = same ? (g.attributes.color.array as Float32Array) : new Float32Array(n * n * 4);
    const wp = same ? (wg.attributes.position.array as Float32Array) : new Float32Array(n * n * 3);
    for (let k = 0; k < n * n; k++) {
      pos[k * 3] = pv.pos[k * 3]; pos[k * 3 + 1] = pv.pos[k * 3 + 1] + 0.05; pos[k * 3 + 2] = pv.pos[k * 3 + 2];
      const dlt = pv.delta[k];
      // warm where the land rises, blue where it is dug away; invisible where nothing changes
      const a = clamp(Math.abs(dlt) / 0.25, 0, 1);
      if (dlt >= 0) { col[k * 4] = 1; col[k * 4 + 1] = 0.93; col[k * 4 + 2] = 0.72; } else { col[k * 4] = 0.55; col[k * 4 + 1] = 0.82; col[k * 4 + 2] = 1; }
      col[k * 4 + 3] = a;
    }
    if (!g.index || g.index.count !== (n - 1) * (n - 1) * 6) {
      const idx: number[] = [];
      for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i; idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1); }
      g.setIndex(idx);
      const wi: number[] = [];
      for (let j = 0; j < n; j += 3) for (let i = 0; i < n - 1; i++) wi.push(j * n + i, j * n + i + 1);
      for (let i = 0; i < n; i += 3) for (let j = 0; j < n - 1; j++) wi.push(j * n + i, (j + 1) * n + i);
      this.ghostWire.geometry.setIndex(wi);
    }
    for (let k = 0; k < n * n; k++) { wp[k * 3] = pos[k * 3]; wp[k * 3 + 1] = pv.delta[k] === 0 ? -1e4 : pos[k * 3 + 1] + 0.01; wp[k * 3 + 2] = pos[k * 3 + 2]; }
    if (same) { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; wg.attributes.position.needsUpdate = true; }
    else {
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 4));
      wg.setAttribute('position', new THREE.BufferAttribute(wp, 3));
    }
    g.computeBoundingSphere();
    wg.computeBoundingSphere();
    this.ghost.visible = this.ghostWire.visible = true;
    const asp = d.aspect ?? 1;
    this.setCursor({ x: p.x, z: p.z, rx: radius * asp, rz: radius, angle, color: '#9be7ff', tick: asp > 1 });
  }
  hidePreview() {
    this.ghost.visible = this.ghostWire.visible = false;
    this.setCursor(null);
  }

  /** stamp a landform; returns false off the land */
  applyStampAt(p: THREE.Vector3, radius = this.stamp.radius, angle = this.stamp.angle) {
    const t = this.e.terrain;
    if (!t || !t.inBounds(p.x, p.z)) return false;
    this.e.pushUndo();
    const before = t.waterLevel;
    const res = applyStamp(t, this.stampOpts(p.x, p.z, radius, angle));
    this.e.afterTerrainEdit(res.rect, before !== t.waterLevel);
    return true;
  }

  /* ---------------- areas ---------------- */
  /** the landform's natural relief for the selected area (m) */
  areaRelief() {
    const r = this.area.rect;
    if (!r) return 0;
    const s = Math.min(r.maxX - r.minX, r.maxZ - r.minZ);
    return AREA_BY_ID[this.area.kind].relief(s) * this.area.relief;
  }

  get canRetry() { return !!this.lastGen && !!this.area.rect && sameRect(this.lastGen.rect, this.area.rect); }

  /** grow the selected landform in the area (again = replace the last result with a new variation) */
  async generate(again = false) {
    const e = this.e, t = e.terrain, r = this.area.rect;
    if (!t || !r) return;
    if (again && this.canRetry) {
      const g = this.lastGen!;
      t.heights.set(g.heights);
      t.paint.set(g.paint);
      t.setWaterLevel(g.water, false);
      for (const id of g.actors) e.removeActor(id, false);
      this.area.seed++;
    } else {
      e.pushUndo();
      this.lastGen = null;
    }
    const snap = { heights: t.heights.slice(), paint: t.paint.slice(), water: t.waterLevel, actors: [] as string[], rect: { ...r } };
    const before = snap.water;
    const kind = this.area.kind;
    const res = generateArea(t, {
      kind, rect: r, oval: this.area.oval, feather: Math.min(this.area.feather, Math.min(r.maxX - r.minX, r.maxZ - r.minZ) / 2),
      height: this.areaRelief(), rough: this.area.rough, style: this.styleFor(this.area.style, kind), seed: this.area.seed, paint: true,
    });
    const waterChanged = before !== t.waterLevel || again;
    e.afterTerrainEdit(waterChanged ? null : res.rect, waterChanged);
    if (this.area.plants !== 'none') snap.actors = await this.plant(r, this.area.plants);
    this.lastGen = snap;
    e.changed();
  }

  /** repaint the selected area from a ground style without changing its shape */
  repaintArea() {
    const e = this.e, t = e.terrain, r = this.area.rect;
    if (!t || !r) return;
    e.pushUndo();
    const style = this.styleFor(this.area.style, this.area.kind);
    const rect = repaintArea(t, style, { rect: r, oval: this.area.oval, feather: this.area.feather, seed: this.area.seed });
    t.paintChanged();
    e.afterTerrainEdit(rect, false);
  }

  /** repaint the whole diorama to match its shape */
  autoPaintAll(styleId = 'biome') {
    const t = this.e.terrain;
    if (!t) return;
    this.e.pushUndo();
    autoPaint(t, this.styleFor(styleId), t.seed);
    t.paintChanged();
    this.e.afterTerrainEdit(null, false);
  }

  /** plant the area with species of its habitat; returns the new actors' ids */
  private async plant(r: AreaRect, amount: 'some' | 'lots') {
    const e = this.e, t = e.terrain!;
    const style = this.styleFor(this.area.style, this.area.kind);
    const biome = STYLE_BIOME[style.id] ?? 'grassland';
    const ok = (d: AssetDef) => d.category === 'plants' && ['flora', 'conifer', 'deciduous', 'terraTree'].includes(d.family) && d.biomes.includes(biome) && !d.water;
    let pool = CATALOG.filter(ok);
    if (!pool.length) pool = CATALOG.filter((d) => d.category === 'plants' && d.family === 'flora' && !d.water);
    const trees = pool.filter((d) => d.group === 'Trees' || d.group === 'Groves'), small = pool.filter((d) => !trees.includes(d));
    const area = (r.maxX - r.minX) * (r.maxZ - r.minZ);
    const n = Math.round(clamp(area / (amount === 'lots' ? 16 : 40), amount === 'lots' ? 6 : 3, amount === 'lots' ? 30 : 14));
    const R = rng(this.area.seed * 977 + 3);
    const mask = areaMask({ rect: r, oval: this.area.oval, feather: this.area.feather, seed: this.area.seed });
    const taken = e.actorList.map((a) => ({ x: a.root.position.x, z: a.root.position.z, r: Math.max(0.6, a.radius) }));
    const ids: string[] = [];
    for (let k = 0; k < n; k++) {
      const list = (R() < 0.38 && trees.length) || !small.length ? trees : small;
      const def = list[Math.floor(R() * list.length)];
      if (!def) continue;
      const gap = def.group === 'Trees' ? 2.6 : 1.2;
      for (let tries = 0; tries < 30; tries++) {
        const x = r.minX + R() * (r.maxX - r.minX), z = r.minZ + R() * (r.maxZ - r.minZ);
        if (mask(x, z) < 0.6 || !t.inBounds(x, z, 0.6)) continue;
        if (t.isUnderwater(x, z, -0.12) || t.slopeAt(x, z) > 0.75) continue;
        if (taken.some((p) => Math.hypot(p.x - x, p.z - z) < Math.max(p.r, gap))) continue;
        taken.push({ x, z, r: gap });
        const a = await e.addActor(def.id, new THREE.Vector3(x, t.heightAt(x, z), z), { label: { show: !e.actorList.some((o) => o.def.id === def.id) } }, false);
        if (a) ids.push(a.id);
        break;
      }
    }
    return ids;
  }

  dispose() {
    this.e.scene.remove(this.ghost, this.ghostWire);
    this.ghost.geometry.dispose(); (this.ghost.material as THREE.Material).dispose();
    this.ghostWire.geometry.dispose(); (this.ghostWire.material as THREE.Material).dispose();
    this.setCursor(null);
    GROUND_UNIFORMS.uSelOpt.value.x = 0;
    GROUND_UNIFORMS.uGridOn.value = 0;
  }
}

function sameRect(a: AreaRect, b: AreaRect) {
  return Math.abs(a.minX - b.minX) < 1e-3 && Math.abs(a.maxX - b.maxX) < 1e-3 && Math.abs(a.minZ - b.minZ) < 1e-3 && Math.abs(a.maxZ - b.maxZ) < 1e-3;
}

export type { GridRect };
