/**
 * Where an animal's code lives.
 *
 * Every catalog animal is built by one asset module plus some app-side data. This file
 * lists, for one asset, the source files that shape it and the regions inside them worth
 * jumping to (its species preset, the family defaults it inherits, the painter that colours
 * it, its catalog row, a remap onto a better rig...). Regions are found by searching the
 * current text, so they stay correct while the file is being edited.
 */
import type { AssetDef } from '../assets/types';
import { BUILTINS } from '../assets/models/builtin';

export interface Region {
  label: string;
  /** returns [start, end) offsets in the file text, or null if it can't be found */
  find: (text: string) => [number, number] | null;
}
export interface SourceFile {
  /** repo-relative path (no leading slash) */
  path: string;
  title: string;
  regions: Region[];
  /** re-imported in place after a save (otherwise the page reloads) */
  hot: boolean;
}

const rel = (p: string) => p.replace(/^\//, '');
/** files the page re-imports in place after a save (devServer.ts HOT_SWAPPABLE); others reload the page */
const HOT = /^src\/assets\/models\/(.+\.mjs|builtin\/[^/]+\.ts)$/;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Index just past the bracket that closes the one at `open` ({, [ or ( ), skipping strings,
 * template literals, comments and (heuristically) regex literals.
 */
export function matchBracket(text: string, open: number): number {
  const pairs: Record<string, string> = { '{': '}', '[': ']', '(': ')' };
  const stack: string[] = [];
  let i = open;
  const n = text.length;
  let prevSig = '';
  while (i < n) {
    const c = text[i];
    const c2 = text[i + 1];
    if (c === '/' && c2 === '/') { i = text.indexOf('\n', i); if (i < 0) return n; continue; }
    if (c === '/' && c2 === '*') { i = text.indexOf('*/', i + 2); if (i < 0) return n; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < n && text[i] !== q) { if (text[i] === '\\') i++; i++; }
      i++; prevSig = 'a'; continue;
    }
    if (c === '/' && /[(,=:[!&|?{};+\-*%<>~^]|^$/.test(prevSig)) {
      // regex literal
      i++;
      let cls = false;
      while (i < n && (cls || text[i] !== '/')) { if (text[i] === '\\') i++; else if (text[i] === '[') cls = true; else if (text[i] === ']') cls = false; else if (text[i] === '\n') break; i++; }
      i++; prevSig = 'a'; continue;
    }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === '}' || c === ']' || c === ')') {
      if (stack.pop() !== c) return i + 1;
      if (!stack.length) return i + 1;
    }
    if (!/\s/.test(c)) prevSig = /[\w$]/.test(c) ? 'a' : c;
    i++;
  }
  return n;
}

/** `key: { ... }` inside the object literal that follows `container` (e.g. 'const SPECIES_DEFS = {') */
function objectEntry(container: string | RegExp, key: string): Region['find'] {
  return (text) => {
    const at = typeof container === 'string' ? text.indexOf(container) : text.search(container);
    if (at < 0) return null;
    const open = text.indexOf('{', at + (typeof container === 'string' ? container.length - 1 : 0));
    const end = matchBracket(text, open);
    const re = new RegExp(`\\n(\\s*)(['"]?)${esc(key)}\\2\\s*:\\s*`, 'g');
    re.lastIndex = open;
    const m = re.exec(text);
    if (!m || m.index > end) return null;
    const start = m.index + 1;
    const valStart = m.index + m[0].length;
    const ch = text[valStart];
    // a call such as `mammal('leopard', { ... })` spans to its closing parenthesis
    const callee = /^[\w$.]+\s*\(/.exec(text.slice(valStart, valStart + 80));
    const valEnd = ch === '{' || ch === '[' || ch === '(' ? matchBracket(text, valStart)
      : callee ? matchBracket(text, valStart + callee[0].length - 1)
      : text.indexOf('\n', valStart);
    // include a trailing comma
    const stop = text[valEnd] === ',' ? valEnd + 1 : valEnd;
    return [start, stop];
  };
}
/** a whole top-level declaration: `function name(`, `const NAME =`, `export function name(` ... */
function declaration(name: string): Region['find'] {
  return (text) => {
    const re = new RegExp(`(^|\\n)(export\\s+)?(async\\s+)?(function\\s+${esc(name)}\\s*\\(|const\\s+${esc(name)}\\s*[:=])`);
    const m = re.exec(text);
    if (!m) return null;
    const start = m.index + (m[1] ? 1 : 0);
    // a function: skip its parameter list, then match the body
    let i = m.index + m[0].length;
    if (/function/.test(m[4])) i = matchBracket(text, i - 1);
    const open = text.slice(i).search(/[{[(`'"]/);
    if (open < 0) return [start, text.indexOf('\n', i)];
    const at = i + open;
    const end = text[at] === '{' || text[at] === '[' || text[at] === '(' ? matchBracket(text, at) : text.indexOf('\n', at);
    const semi = text.slice(end, end + 2).match(/^\s*;/);
    return [start, end + (semi ? semi[0].length : 0)];
  };
}
/** the line(s) of a call like `animal('red-fox', ...)` */
function call(prefix: string): Region['find'] {
  return (text) => {
    const at = text.indexOf(prefix);
    if (at < 0) return null;
    const lineStart = text.lastIndexOf('\n', at) + 1;
    const open = text.indexOf('(', at + prefix.length - 1);
    const end = matchBracket(text, open);
    const tail = text.slice(end).match(/^[,;)]*/)?.[0] ?? '';
    return [lineStart, end + tail.length];
  };
}
/** one table row `['key', ...],` */
function row(key: string): Region['find'] {
  return (text) => {
    const m = new RegExp(`\\n(\\s*)\\[\\s*'${esc(key)}'\\s*,`).exec(text);
    if (!m) return null;
    const open = m.index + 1 + m[1].length;
    const end = matchBracket(text, open);
    return [m.index + 1, end + (text[end] === ',' ? 1 : 0)];
  };
}
/** first `if (... === 'value')` branch for a species switch */
function branch(cond: string): Region['find'] {
  return (text) => {
    const at = text.indexOf(cond);
    if (at < 0) return null;
    const lineStart = text.lastIndexOf('\n', at) + 1;
    const open = text.indexOf('{', at);
    return [lineStart, matchBracket(text, open)];
  };
}
const region = (label: string, find: Region['find']): Region => ({ label, find });

const FAMILY_CONSTS = ['UNGULATE', 'CANID', 'FELID', 'URSID', 'RODENT'];
const WILD_PLAN_FN: Record<string, string> = {
  beetle: 'arthropod', spider: 'arthropod', crab: 'arthropod', scorpion: 'arthropod', octopus: 'mollusk', snail: 'mollusk', slug: 'mollusk',
  jellyfish: 'radialAnimal', combJelly: 'radialAnimal', anemone: 'radialAnimal', starfish: 'radialAnimal', urchin: 'radialAnimal',
  waterBear: 'lobopod', velvetWorm: 'lobopod', centipede: 'lobopod', coral: 'colony',
};
const WILD_CATALOG = 'src/assets/models/wildform/species.ts';
const WILD_ENGINE = 'src/assets/models/wildform/wildform.mjs';

/** Source files and regions for one catalog asset. `extra` carries what only the loaded module knows. */
export function sourcesFor(def: AssetDef, extra: { wildPlan?: string } = {}): SourceFile[] {
  const files: SourceFile[] = [];
  const add = (path: string, title: string, regions: Region[]) => {
    const p = rel(path);
    const f = files.find((x) => x.path === p);
    if (f) f.regions.push(...regions);
    else files.push({ path: p, title, regions, hot: HOT.test(p) });
  };
  const wildId = def.id.startsWith('wild/') ? def.id.slice(5) : null;
  const species = String(def.params.species ?? '');
  switch (def.family) {
    case 'mammal': {
      const preset = objectEntry('const SPECIES_DEFS = {', species);
      // the family defaults the preset inherits (`fam: FELID` → const FELID = {...})
      const family: Region['find'] = (text) => {
        const at = preset(text);
        const fam = at && /\bfam:\s*(\w+)/.exec(text.slice(at[0], at[1]))?.[1];
        return fam && FAMILY_CONSTS.includes(fam) ? declaration(fam)(text) : null;
      };
      // the measured reference table the preset is laid out from (`ref: REF.equid` → equid: {...} in const REF)
      const refTable: Region['find'] = (text) => {
        const at = preset(text);
        const ref = at && [...text.slice(at[0], at[1]).matchAll(/\bref:\s*REF\.(\w+)/g)].pop()?.[1];
        return ref ? objectEntry('const REF = {', ref)(text) : null;
      };
      // (Digital Diorama revision 8: the elephant has its own builder and clips; every mammal shares the limb-root blend,
      // the feet's line keeping, the girdle-drop smoothing and the gait tables. Revision 10: the others are laid out from
      // measured reference tables)
      const measured = species === 'elephant' ? [] : [
        region('Reference table (measured layout)', refTable),
        region('Measured layout (refLayout)', declaration('refLayout')),
        region('Measured legs (refLeg)', declaration('refLeg')),
        region('Leg profiles (LEG)', declaration('LEG')),
        region('Ground clearance (sit, lie)', declaration('clearGround')),
        region('Tail on the ground', declaration('tailOnGround')),
      ];
      const body = species === 'elephant' ? [
        region('Elephant builder', declaration('elephantBuild')),
        region('Elephant layout', declaration('eleLayout')),
        region('Elephant torso', declaration('eleTorso')),
        region('Elephant legs', declaration('eleLeg')),
        region('Elephant leg joints', declaration('eleLimbLayout')),
        region('Elephant head & trunk', declaration('eleHead')),
        region('Elephant ears', declaration('eleEars')),
        region('Elephant tusks', declaration('eleTusks')),
        region('Elephant tail', declaration('eleTail')),
        region('Elephant skin painter', declaration('elePainter')),
        region('Skin creases (tile)', declaration('creaseTile')),
        region('Elephant clips', declaration('eleSample')),
        region('Lying down', declaration('eleLieDown')),
        region('Elephant clip set-up', declaration('eleMotionSetup')),
      ] : [
        region('Coat painter', declaration('makePainter')),
        region('Head', declaration('tetraHead')),
        region('Ears', declaration('tetraEars')),
        region('Torso', declaration('tetraTorso')),
        region('Limbs', declaration('tetraLimbJoints')),
        region('Hind leg layout', declaration('HIND_LAYOUT')),
        region('Hind leg surface', declaration('tetraHindLeg')),
        region('Foreleg surface', declaration('tetraForeLeg')),
        region('Tail', declaration('tetraTail')),
        region('Horns & antlers', declaration('tetraHorns')),
        region('Mane', declaration('tetraMane')),
      ];
      add(def.path, 'mammal-rig.mjs', [
        region(`Species preset · ${species}`, preset),
        region('Family defaults', family),
        ...measured,
        region('Defaults (DEF)', declaration('DEF')),
        ...body,
        region('Limb roots (blendLimbRoots)', declaration('blendLimbRoots')),
        region('Gaits', declaration('GAIT_LIB')),
        region('Gait tuning', declaration('GAIT_TUNE')),
        region('Foot paths', declaration('footTrack')),
        region('Leg solver (IK)', declaration('solveLeg')),
        region('Feet on their line (keepOnLine)', declaration('keepOnLine')),
        region('Girdle drop (dropCurve)', declaration('dropCurve')),
        region('Clip baking', declaration('bakeClip')),
        region('Proportion sliders (specFor)', declaration('specFor')),
        region('Mesh output (finish)', declaration('finish')),
      ]);
      if (!wildId) add('src/assets/data-mammals.ts', 'data-mammals.ts', [region(`Row · ${species}`, row(species))]);
      if (!wildId) add('src/assets/catalog.ts', 'catalog.ts', [region('Mammal catalog tweaks', declaration('MAMMAL_EXTRA'))]);
      break;
    }
    case 'bird':
      // (Digital Diorama revision 11: the bird rig rewritten from field measurements)
      add(def.path, 'bird-rig.mjs', [
        region(`Species preset · ${species}`, objectEntry('const SPECIES = {', species)),
        region('Families (torso, skull, legs)', declaration('FAMILIES')),
        region('Bill shapes', declaration('BILLS')),
        region('Plumage painter', declaration('makeBirdPainter')),
        region('Builder (posture, body, eyes)', declaration('birdBuild')),
        region('Bill', declaration('billBuild')),
        region('Crests, tufts, combs, wattles', declaration('birdExtras')),
        region('Tail', declaration('tailBuild')),
        region('Folded wings', declaration('foldedWings')),
        region('Spread wings', declaration('spreadWings')),
        region('Legs and feet', declaration('legsBuild')),
        region('Clips', declaration('BIRD_CLIPS')),
        region('Clip poses', declaration('birdSample')),
        region('Walk set-up', declaration('birdMotion')),
        region('Leg solver (IK)', declaration('birdLeg')),
        region('Spec from measurements (specFor)', declaration('specFor')),
        region('Mesh output (finish)', declaration('finish')),
      ]);
      if (!wildId) add('src/assets/data-birds.ts', 'data-birds.ts', [region(`Row · ${species}`, row(species))]);
      break;
    case 'reptile': {
      // (Digital Diorama revision 11: reptiles and amphibians on the herp rig: preset, its measured table, its body plan)
      if (def.path.endsWith('herp-rig.mjs')) {
        const preset = objectEntry('const SPECIES = {', species);
        const fromPreset = (re: RegExp, wrap: (m: string) => string): Region['find'] => (text) => {
          const at = preset(text), m = at && re.exec(text.slice(at[0], at[1]))?.[1];
          return m ? declaration(wrap(m))(text) : null;
        };
        add(def.path, 'herp-rig.mjs', [
          region(`Species preset · ${species}`, preset),
          region('Measured table', fromPreset(/\bT:\s*(T_\w+)/, (m) => m)),
          region('Body plan', fromPreset(/\bplan:\s*'(\w+)'/, (m) => `${m}Build`)),
          region('Head', declaration('buildHead')),
          region('Limbs', declaration('buildLimb')),
          region('Painter', declaration('makePainter')),
          region('Gaits (planted feet)', declaration('gaitSample')),
          region('Snake clips', declaration('snakeSample')),
          region('Turtle clips', declaration('cheloSample')),
          region('Frog clips', declaration('frogSample')),
          region('Parameters', declaration('params')),
        ]);
        if (!wildId) add('src/assets/data-reptiles.ts', 'data-reptiles.ts', [region(`Row · ${def.id.slice(8)}`, row(def.id.slice(8)))]);
        break;
      }
      add(def.path, def.path.split('/').pop()!, [
        region('Colours', declaration('BASE')),
        region('Colourways', declaration('COLORWAYS')),
        region('Parameters', declaration('params')),
        region('Rig', declaration('rig')),
        region('Build (createAsset)', declaration('createAsset')),
      ]);
      if (!wildId) add('src/assets/data-reptiles.ts', 'data-reptiles.ts', [region(`Row · ${def.id.slice(8)}`, row(def.id.slice(8)))]);
      break;
    }
    case 'wildform': {
      const plan = extra.wildPlan;
      add(WILD_CATALOG, 'wildform/species.ts', [region(`Species · ${wildId}`, call(`animal('${wildId}'`))]);
      add(WILD_ENGINE, 'wildform.mjs', [
        ...(plan ? [region(`Body plan · ${plan}`, declaration(WILD_PLAN_FN[plan] ?? plan))] : []),
        region('Parameters (getSchema)', declaration('getSchema')),
        region('Rig (getRig)', declaration('getRig')),
        region('Build (createAsset)', declaration('createAsset')),
      ]);
      break;
    }
    case 'builtin': {
      const key = def.path.slice(8);
      const fn = BUILTINS[key]?.createAsset?.name;
      const file = key === 'fish' ? 'src/assets/models/builtin/fish.ts' : ['seal', 'cetacean', 'man-o-war', 'sea-hare'].includes(key) ? 'src/assets/models/builtin/marine.ts' : 'src/assets/models/builtin/fungi.ts';
      add(file, file.split('/').pop()!, fn ? [region(`Model · ${fn}`, declaration(fn))] : []);
      add('src/assets/models/builtin/index.ts', 'builtin/index.ts', [region('Registry', declaration('BUILTINS'))]);
      break;
    }
    case 'aquarium':
      add(def.path, def.path.split('/').pop()!, [
        ...(species ? [region(`Species · ${species}`, branch(`P.species === '${species}'`))] : []),
        region('Parameters', declaration('params')),
        region('Build (createAsset)', declaration('createAsset')),
      ]);
      break;
    default:
      add(def.path, def.path.split('/').pop()!, [region('Parameters', declaration('params')), region('Build (createAsset)', declaration('createAsset'))]);
  }
  if (wildId) {
    add('src/assets/data-remap.ts', 'data-remap.ts', [region(`Remap · ${wildId}`, objectEntry('export const WILDFORM_REMAP', wildId))]);
    add('src/assets/data-wildform.ts', 'data-wildform.ts', [region(`Library row · ${wildId}`, objectEntry('export const WILDFORM_AUG', wildId))]);
  }
  add('src/assets/tuning.json', 'tuning.json', []);
  return files;
}
