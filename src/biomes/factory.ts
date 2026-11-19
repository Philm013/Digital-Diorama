import { generateTerrain } from '../engine/terrainGen';
import { cellFor } from '../engine/sizes';
import { DEFAULT_ENV, type ActorDoc, type DioramaDoc, type Quality } from '../engine/types';
import { rng, uid, clamp } from '../engine/util';
import { getDef } from '../assets/catalog';
import type { BiomeTemplate } from './types';
import { BIOME_BY_ID } from './templates';
import { scriptsFor } from '../code/recipes';

export function newDoc(biome: BiomeTemplate, quality: Quality, opts: { title?: string; author?: string; size?: { width: number; depth: number } } = {}): DioramaDoc {
  const now = Date.now();
  const R = rng((biome.terrain?.seed ?? 5) * 101 + 7);
  let groundAt = (_x: number, _z: number) => 0;
  let wetAt = (_x: number, _z: number) => false;
  let bounds = { minX: -14, maxX: 14, minZ: -14, maxZ: 14 };
  let base: DioramaDoc['base'];
  if (biome.terrain) {
    // a chosen size (blank dioramas) also picks a grid fine enough to sculpt, coarse enough to stay smooth
    const sized = opts.size ? { width: opts.size.width, depth: opts.size.depth, cell: cellFor(opts.size.width, opts.size.depth) } : {};
    const t = generateTerrain({ ...biome.terrain, ...sized });
    groundAt = (x, z) => t.heightAt(x, z);
    wetAt = (x, z) => t.isUnderwater(x, z, 0.05);
    bounds = { minX: -t.width / 2, maxX: t.width / 2, minZ: -t.depth / 2, maxZ: t.depth / 2 };
    base = { kind: 'terrain', terrain: t.toDoc() };
    t.dispose();
  } else {
    const p = biome.base!.params;
    const w = Number(p.size ?? p.width ?? 24), d = Number(p.size ?? p.depth ?? 24);
    bounds = { minX: -w / 2, maxX: w / 2, minZ: -d / 2, maxZ: d / 2 };
    const under = !!biome.env.underwater;
    wetAt = () => under;
    base = { kind: 'asset', asset: biome.base!.asset, params: { ...p } };
  }
  const placed: { x: number; z: number; r: number }[] = [];
  const actors: ActorDoc[] = [];
  const names = new Map<string, number>();
  const labelled = new Set<string>();
  const nameFor = (n: string) => {
    const c = (names.get(n) ?? 0) + 1;
    names.set(n, c);
    return c === 1 ? n : `${n} ${c}`;
  };
  for (const pl of biome.placements) {
    if (pl.skipOnLow && quality === 'low') continue;
    const def = getDef(pl.asset);
    if (!def) { console.warn('Unknown asset in template', pl.asset); continue; }
    const count = pl.count ?? 1;
    const spacing = pl.spacing ?? (def.category === 'plants' ? 1.5 : 1.2);
    for (let i = 0; i < count; i++) {
      let x = 0, z = 0;
      if (pl.at && count === 1) { [x, z] = pl.at; }
      else {
        let ok = false;
        for (let k = 0; k < 80 && !ok; k++) {
          if (pl.area) {
            const a = R() * Math.PI * 2, d = Math.sqrt(R()) * pl.area[2];
            x = pl.area[0] + Math.cos(a) * d; z = pl.area[1] + Math.sin(a) * d;
          } else if (pl.at) {
            x = pl.at[0] + (R() - 0.5) * spacing * 3; z = pl.at[1] + (R() - 0.5) * spacing * 3;
          } else {
            x = bounds.minX + 1.5 + R() * (bounds.maxX - bounds.minX - 3);
            z = bounds.minZ + 1.5 + R() * (bounds.maxZ - bounds.minZ - 3);
          }
          x = clamp(x, bounds.minX + 1, bounds.maxX - 1);
          z = clamp(z, bounds.minZ + 1, bounds.maxZ - 1);
          const wet = wetAt(x, z);
          const where = pl.where ?? 'any';
          if (where === 'dry' && (wet || wetAt(x + 0.8, z) || wetAt(x - 0.8, z) || wetAt(x, z + 0.8) || wetAt(x, z - 0.8))) continue;
          if (where === 'wet' && !wet) continue;
          if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < Math.max(p.r, spacing))) continue;
          ok = true;
        }
      }
      placed.push({ x, z, r: spacing });
      const s = pl.scale === undefined ? 1 : Array.isArray(pl.scale) ? pl.scale[0] + R() * (pl.scale[1] - pl.scale[0]) : pl.scale;
      const isFlyer = def.loco === 'fly';
      const lift = pl.lift ?? (isFlyer ? 3.5 : def.loco === 'swim' || def.water === 'column' ? 1.2 : 0);
      actors.push({
        id: uid('a'), asset: def.id, name: nameFor(pl.name ?? def.name), params: { ...(pl.params ?? {}) },
        pos: [x, groundAt(x, z) + (isFlyer ? lift : 0), z],
        rotY: pl.rotY ?? (R() - 0.5) * 2.4, scale: s, lift, grounded: pl.grounded ?? true,
        // one toothpick flag per species keeps the scene readable; more can be switched on in Build
        label: pl.label ? { show: true, text: pl.label } : { show: !labelled.has(def.id) && (labelled.add(def.id), true) },
        note: pl.note, scripts: pl.scripts,
      });
    }
  }
  return {
    format: 'digital-diorama', version: 1, id: uid('d'),
    title: opts.title ?? biome.name, author: opts.author ?? '', description: biome.tagline,
    biome: biome.id, created: now, updated: now, base,
    env: { ...DEFAULT_ENV, ...biome.env, frame: biome.env.frame ?? 'shoebox' },
    actors,
    worldScripts: biome.worldRecipes?.length ? scriptsFor(biome.worldRecipes, opts.title ?? biome.name) : undefined,
  };
}

export function newDocById(id: string, quality: Quality, opts?: { title?: string; author?: string }) {
  return newDoc(BIOME_BY_ID[id] ?? BIOME_BY_ID.blank, quality, opts);
}
