import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { Engine } from './Engine';
import { EMPTY_SELECTION, GROUND_UNIFORMS, createSelectionTexture } from './ground';
import type { GridRect, Terrain } from './Terrain';
import {
  AREA_BY_ID, STAMP_BY_ID, STYLE_BY_ID, applyStamp, areaMask, autoPaint, generateArea, previewStamp, repaintArea, styleForBiome,
  type AreaKind, type GroundStyle,
} from './landforms';
import { areaField, brushCover, clipRect, coverBounds, coverSdf, lassoCover, toCover, type AreaField, type AreaRect, type AreaShape } from './areaShape';
import { CATALOG } from '../assets/catalog';
import type { AssetDef } from '../assets/types';
import { clamp, lerp, rng } from './util';

export interface StampSettings { id: string; radius: number; height: number; angle: number; paint: boolean }
/** how dragging on the land selects an area: a box, an oval, a lasso drawn around it, or a brush painted over it */
export type AreaSelect = 'box' | 'oval' | 'lasso' | 'brush';
export interface AreaSettings {
  /** the selected area (null: nothing is selected) */
  shape: AreaShape | null;
  select: AreaSelect;
  /** the selection brush: its radius (m), and whether it takes land out of the selection */
  brush: number;
  erase: boolean;
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
 * the new shape), a selected area — a box, an oval, or any shape drawn with the lasso or painted
 * with the selection brush — that can be grown into a landscape, auto-paint, and the outlines
 * drawn on the ground by the terrain shader.
 */
export class LandEditor {
  stamp: StampSettings = { id: 'mountain', radius: 6, height: 7, angle: 0, paint: true };
  area: AreaSettings = { shape: null, select: 'box', brush: 2, erase: false, feather: 2.5, kind: 'hills', style: 'auto', relief: 1, rough: 0.5, plants: 'none', seed: 1 };
  /** goes up whenever the selection changes ("Try another" only replaces a result made on the same selection) */
  private areaVersion = 0;
  /** the last area generation, so "Try another" can replace it */
  private lastGen: { heights: Float32Array; paint: Uint8Array; water: number | null; actors: string[]; version: number } | null = null;
  /** a free shape's distance to its outline at every terrain vertex (the generators read it; the ground shader draws it) */
  private sdf: Float32Array | null = null;
  /** how far the middle of a free shape is from its outline */
  private sdfDepth = 0;
  private sdfTex: THREE.DataTexture | null = null;
  private sdfDirty = false;
  private fieldCache: { version: number; field: AreaField | null } | null = null;
  /** a selection being drawn: where it began, what was selected before (to cancel), the brush's coverage, the lasso's points */
  private gesture: { kind: AreaSelect; prev: AreaShape | null; a: { x: number; z: number }; cover?: Uint8Array; erase?: boolean; last?: { x: number; z: number }; pts?: [number, number][] } | null = null;
  private ghost: THREE.Mesh;
  private ghostWire: THREE.LineSegments;
  private lasso: Line2;

  constructor(private e: Engine) {
    const mat = new THREE.MeshBasicMaterial({ color: '#fff6d8', transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, vertexColors: true });
    this.ghost = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    this.ghost.renderOrder = 15;
    this.ghost.visible = false;
    this.ghost.name = 'stamp-preview';
    this.ghostWire = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }));
    this.ghostWire.renderOrder = 16;
    this.ghostWire.visible = false;
    // the line the lasso leaves behind while it is drawn
    this.lasso = new Line2(new LineGeometry(), new LineMaterial({ color: '#ffd84a', linewidth: 3, transparent: true, depthTest: false, depthWrite: false }));
    this.lasso.renderOrder = 20;
    this.lasso.visible = false;
    this.lasso.frustumCulled = false;
    this.lasso.name = 'lasso';
    e.scene.add(this.ghost, this.ghostWire, this.lasso);
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
  /** draw the selection on the ground */
  syncArea() {
    const u = GROUND_UNIFORMS, s = this.area.shape, t = this.e.terrain;
    if (!s || !t) { u.uSelOpt.value.x = 0; return; }
    const r = s.rect;
    u.uSelRect.value.set(r.minX, r.minZ, r.maxX, r.maxZ);
    let mode = s.kind === 'oval' ? 1 : 0, depth = Math.min(r.maxX - r.minX, r.maxZ - r.minZ) / 2;
    if (s.kind === 'free') {
      if (!this.sdf || !this.sdfTex) { u.uSelOpt.value.x = 0; return; }
      mode = 2;
      u.uSelTex.value = this.sdfTex;
      u.uSelMap.value.set(-t.width / 2, -t.depth / 2, 1 / t.dx, 1 / t.dz);
      u.uSelN.value.set(t.nx, t.nz);
      depth = this.sdfDepth;
    }
    u.uSelOpt.value.set(1, mode, Math.min(this.area.feather, depth), u.uSelOpt.value.w);
  }
  /** marching ants, and a free shape's outline catching up with the brush or lasso */
  tick(time: number) {
    GROUND_UNIFORMS.uSelOpt.value.w = time;
    if (this.sdfDirty) { this.updateSdf(); this.syncArea(); }
  }

  /* ---------------- selecting an area ---------------- */
  /** replace the selection (null clears it) */
  setAreaShape(s: AreaShape | null) {
    const t = this.e.terrain;
    if (s?.kind === 'free') {
      const b = t && s.cover && s.cover.length === t.nx * t.nz ? coverBounds(t, s.cover) : null;
      // a dab too small to grow anything is no selection
      s = b && b.maxX - b.minX > 0.6 && b.maxZ - b.minZ > 0.6 ? { ...s, rect: b } : null;
    }
    this.area.shape = s;
    this.areaVersion++;
    this.updateSdf();
    this.syncArea();
    this.e.changed(false);
  }
  /** select a box (or an oval, when that is the selection tool) */
  setAreaRect(r: AreaRect | null) { this.setAreaShape(r ? { kind: this.area.select === 'oval' ? 'oval' : 'box', rect: r } : null); }
  clearArea() {
    this.gesture = null;
    this.lasso.visible = false;
    if (this.area.shape) this.setAreaShape(null);
  }
  /** choose how dragging selects; a selected box turns into an oval (and back) in place */
  setSelectTool(sel: AreaSelect) {
    this.area.select = sel;
    const s = this.area.shape;
    if (s && (s.kind === 'box' || s.kind === 'oval') && (sel === 'box' || sel === 'oval') && s.kind !== sel) this.setAreaShape({ kind: sel, rect: s.rect });
    else this.e.changed(false);
  }
  /** the selection, ready for the generators (worked out once per selection) */
  field(): AreaField | null {
    const t = this.e.terrain, s = this.area.shape;
    if (!t || !s) return null;
    if (this.fieldCache?.version !== this.areaVersion) this.fieldCache = { version: this.areaVersion, field: areaField(t, s, this.sdf) };
    return this.fieldCache.field;
  }
  /** the selected land's size, for the panel */
  get areaSize() {
    const t = this.e.terrain, s = this.area.shape;
    if (!t || !s) return null;
    const r = clipRect(t, s.rect);
    return { w: r.maxX - r.minX, d: r.maxZ - r.minZ, m2: this.field()?.size ?? 0, free: s.kind === 'free' };
  }

  /** start selecting at a point on the land; the selection tool decides how (`flip` turns the brush's add ⇄ erase) */
  selectStart(x: number, z: number, flip = false) {
    const t = this.e.terrain;
    if (!t) return;
    const sel = this.area.select, prev = this.area.shape;
    this.gesture = { kind: sel, prev, a: { x, z } };
    if (sel === 'lasso') this.gesture.pts = [[x, z]];
    if (sel === 'brush') {
      this.gesture.erase = this.area.erase !== flip;
      // painting on a box, oval or lasso selection adds to (or takes from) it
      this.gesture.cover = prev ? toCover(t, prev) : new Uint8Array(t.nx * t.nz);
      this.brushTo(x, z);
    }
  }
  selectMove(x: number, z: number) {
    const g = this.gesture, t = this.e.terrain;
    if (!g || !t) return;
    if (g.kind === 'box' || g.kind === 'oval') {
      this.area.shape = { kind: g.kind, rect: dragRect(t, g.a, { x, z }) };
      this.syncArea();
    } else if (g.kind === 'lasso') {
      const pts = g.pts!, last = pts[pts.length - 1];
      if (Math.hypot(x - last[0], z - last[1]) < Math.max(0.12, t.dx * 0.6)) return;
      pts.push([x, z]);
      this.drawLasso(t, pts);
      // the area it would select, closed back to where the lasso began
      if (pts.length >= 3) { this.area.shape = { kind: 'free', rect: this.area.shape?.rect ?? NO_RECT, cover: lassoCover(t, pts) }; this.sdfDirty = true; }
    } else this.brushTo(x, z);
  }
  /** finish selecting; a tap (the pointer barely moved) clears the selection, except for the brush, which paints a dab */
  selectEnd(tap: boolean) {
    const g = this.gesture, t = this.e.terrain;
    this.gesture = null;
    this.lasso.visible = false;
    if (!g || !t) return;
    // (a free shape's bounds are worked out from its coverage)
    if (g.kind === 'brush') { this.setAreaShape({ kind: 'free', rect: NO_RECT, cover: g.cover }); return; }
    if (tap) { this.setAreaShape(null); return; }
    if (g.kind === 'lasso') {
      this.setAreaShape(g.pts!.length >= 3 ? { kind: 'free', rect: NO_RECT, cover: lassoCover(t, g.pts!) } : null);
      return;
    }
    // a sliver is no selection
    const r = this.area.shape?.rect, c = r && clipRect(t, r);
    this.setAreaShape(r && c && c.maxX - c.minX > 0.8 && c.maxZ - c.minZ > 0.8 ? { kind: g.kind, rect: r } : null);
  }
  /** put the selection back as it was before this drag (a second finger came down) */
  selectCancel() {
    const g = this.gesture;
    this.gesture = null;
    this.lasso.visible = false;
    if (g) this.setAreaShape(g.prev);
  }
  /** paint the selection brush from where it last was to here, in dabs close enough to leave no gaps */
  private brushTo(x: number, z: number) {
    const g = this.gesture!, t = this.e.terrain!;
    const r = this.area.brush;
    const from = g.last ?? { x, z };
    const n = Math.max(1, Math.ceil(Math.hypot(x - from.x, z - from.z) / (r * 0.3)));
    for (let s = g.last ? 1 : 0; s <= n; s++) brushCover(t, g.cover!, lerp(from.x, x, s / n), lerp(from.z, z, s / n), r, g.erase!);
    g.last = { x, z };
    this.area.shape = { kind: 'free', rect: this.area.shape?.rect ?? { minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r }, cover: g.cover };
    this.sdfDirty = true;
  }
  /** a free shape's distance field, uploaded for the ground shader */
  private updateSdf() {
    this.sdfDirty = false;
    const t = this.e.terrain, s = this.area.shape;
    if (!t || !s || s.kind !== 'free' || !s.cover || s.cover.length !== t.nx * t.nz) { this.sdf = null; return; }
    this.sdf = coverSdf(t, s.cover, this.sdf ?? undefined);
    let depth = 0;
    for (const v of this.sdf) if (-v > depth) depth = -v;
    this.sdfDepth = depth;
    const img = this.sdfTex?.image as { width: number; height: number; data: Float32Array } | undefined;
    if (!this.sdfTex || img!.width !== t.nx || img!.height !== t.nz || img!.data !== this.sdf) {
      this.sdfTex?.dispose();
      this.sdfTex = createSelectionTexture(this.sdf, t.nx, t.nz);
    } else this.sdfTex.needsUpdate = true;
  }
  private drawLasso(t: Terrain, pts: [number, number][]) {
    if (pts.length < 2) return;
    const pos: number[] = [];
    for (const [x, z] of pts) pos.push(x, t.heightAt(x, z) + 0.08, z);
    const g = new LineGeometry();
    g.setPositions(pos);
    this.lasso.geometry.dispose();
    this.lasso.geometry = g;
    this.lasso.visible = true;
  }

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
    const F = this.field();
    return F ? AREA_BY_ID[this.area.kind].relief(F.depth * 2) * this.area.relief : 0;
  }

  get canRetry() { return !!this.lastGen && !!this.area.shape && this.lastGen.version === this.areaVersion; }
  /** an undo or redo changed the land: "Try another" has nothing of its own to replace any more */
  forgetLastGeneration() { this.lastGen = null; }

  /** grow the selected landform in the area (again = replace the last result with a new variation) */
  async generate(again = false) {
    const e = this.e, t = e.terrain, F = this.field();
    if (!t || !F) return;
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
    const snap = { heights: t.heights.slice(), paint: t.paint.slice(), water: t.waterLevel, actors: [] as string[], version: this.areaVersion };
    const before = snap.water;
    const kind = this.area.kind;
    const res = generateArea(t, {
      kind, field: F, feather: Math.min(this.area.feather, F.depth),
      height: this.areaRelief(), rough: this.area.rough, style: this.styleFor(this.area.style, kind), seed: this.area.seed, paint: true,
      keepGround: this.area.style === 'auto' && !!AREA_BY_ID[kind].keep,
    });
    const waterChanged = before !== t.waterLevel || again;
    e.afterTerrainEdit(waterChanged ? null : res.rect, waterChanged);
    if (this.area.plants !== 'none') snap.actors = await this.plant(F, this.area.plants);
    this.lastGen = snap;
    e.changed();
  }

  /** repaint the selected area from a ground style without changing its shape */
  repaintArea() {
    const e = this.e, t = e.terrain, F = this.field();
    if (!t || !F) return;
    e.pushUndo();
    const style = this.styleFor(this.area.style, this.area.kind);
    const rect = repaintArea(t, style, { field: F, feather: Math.min(this.area.feather, F.depth), seed: this.area.seed });
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
  private async plant(F: AreaField, amount: 'some' | 'lots') {
    const e = this.e, t = e.terrain!;
    const style = this.styleFor(this.area.style, this.area.kind);
    const biome = STYLE_BIOME[style.id] ?? 'grassland';
    const ok = (d: AssetDef) => d.category === 'plants' && ['flora', 'conifer', 'deciduous', 'terraTree'].includes(d.family) && d.biomes.includes(biome) && !d.water;
    let pool = CATALOG.filter(ok);
    if (!pool.length) pool = CATALOG.filter((d) => d.category === 'plants' && d.family === 'flora' && !d.water);
    const trees = pool.filter((d) => d.group === 'Trees' || d.group === 'Groves'), small = pool.filter((d) => !trees.includes(d));
    const n = Math.round(clamp(F.size / (amount === 'lots' ? 16 : 40), amount === 'lots' ? 6 : 3, amount === 'lots' ? 30 : 14));
    const R = rng(this.area.seed * 977 + 3);
    const mask = areaMask({ field: F, feather: Math.min(this.area.feather, F.depth), seed: this.area.seed });
    const r = F.rect;
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
    this.e.scene.remove(this.ghost, this.ghostWire, this.lasso);
    this.lasso.geometry.dispose(); this.lasso.material.dispose();
    if (GROUND_UNIFORMS.uSelTex.value === this.sdfTex) GROUND_UNIFORMS.uSelTex.value = EMPTY_SELECTION;
    this.sdfTex?.dispose();
    this.ghost.geometry.dispose(); (this.ghost.material as THREE.Material).dispose();
    this.ghostWire.geometry.dispose(); (this.ghostWire.material as THREE.Material).dispose();
    this.setCursor(null);
    GROUND_UNIFORMS.uSelOpt.value.x = 0;
    GROUND_UNIFORMS.uGridOn.value = 0;
  }
}

const NO_RECT: AreaRect = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };

/** the box (or oval) dragged from a to b; past the diorama's edge it carries on a little, so the land changes right up to the edge */
function dragRect(t: Terrain, a: { x: number; z: number }, b: { x: number; z: number }): AreaRect {
  const mx = t.width / 2 + Math.max(2, t.width * 0.15), mz = t.depth / 2 + Math.max(2, t.depth * 0.15);
  return { minX: clamp(Math.min(a.x, b.x), -mx, mx), maxX: clamp(Math.max(a.x, b.x), -mx, mx), minZ: clamp(Math.min(a.z, b.z), -mz, mz), maxZ: clamp(Math.max(a.z, b.z), -mz, mz) };
}

export type { GridRect, AreaShape, AreaRect };
