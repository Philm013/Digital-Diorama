/**
 * Ranger training: short lessons that teach the studio by doing. Each lesson is a few steps; a
 * step points at a real control (by its `data-tour` name), says what to do, and is done when the
 * diorama shows it was done — the camera turned, a producer was added, a hill was stamped, Play
 * was pressed — not when a button is read. Steps without a check are read and then moved on with
 * Next. Lessons are grouped in units and open along the ranger path with the tools they teach.
 */
import type { Engine } from '../engine/Engine';
import type { ScriptRuntime } from '../code/runtime';
import type { Mode, Season, Weather } from '../engine/types';
import { roleOf, type Role } from '../assets/foodweb';
import { BIOME_BY_ID } from '../biomes/templates';
import { isUnlocked, type FeatureId } from '../game/unlocks';
import { getProfile, type Profile } from '../game/progress';

/* ================================ the situation a step is checked against ================================ */
export interface Snapshot {
  /** placed objects as saved: position, turn, size, label and notes (clones aside) */
  actors: Map<string, { x: number; z: number; rot: number; scale: number; label: string; note: string }>;
  /** living things by their place in the food web */
  roles: Record<Role, number>;
  living: number;
  /** size of all scripts (objects and World), and whether any has an event block to start it */
  scriptSize: number;
  title: string;
  env: { time: number; weather: Weather; season: Season; wind: number; daySpeed: number };
  topView: boolean;
  walk: { active: boolean; endless: boolean; eye: number; x: number; z: number; home: number };
  selected: string | null;
  running: boolean;
}

export interface LearnCtx {
  engine: Engine;
  runtime: ScriptRuntime;
  mode: Mode;
  /** desktop layout (side panels; the Journal sits in the Explore bar) */
  wide: boolean;
  /** fingers rather than a mouse */
  touch: boolean;
  /** moments since the step began: tap-living, discover, land:<tool>, land:stamp:<id>, overview, undo, web-focus… */
  seen: Set<string>;
  /** how the camera has moved since the step began: radians turned, zoom (log of the distance), metres slid */
  moved: { orbit: number; zoom: number; pan: number };
  /** the diorama when the step began, and now */
  start: Snapshot;
  now: Snapshot;
  /** the longest food chain and the ecosystem score, as the studio worked them out */
  chain: number;
  /** a `data-tour` element is on screen */
  shown: (tour: string) => boolean;
}

export function snapshot(engine: Engine, runtime: ScriptRuntime): Snapshot {
  const roles: Record<Role, number> = { producer: 0, primary: 0, secondary: 0, tertiary: 0, decomposer: 0, abiotic: 0 };
  const actors: Snapshot['actors'] = new Map();
  let living = 0, scriptSize = 0;
  for (const a of engine.actorList) {
    if (a.isClone) continue;
    const d = a.doc;
    actors.set(a.id, { x: d.pos[0], z: d.pos[2], rot: d.rotY, scale: d.scale, label: (d.label?.text ?? '').trim(), note: (d.note ?? '').trim() });
    if (d.scripts) scriptSize += JSON.stringify(d.scripts).length;
    if (a.def.living === false || a.def.category === 'habitats') continue;
    living++;
    roles[roleOf(a.def)]++;
  }
  if (engine.doc?.worldScripts) scriptSize += JSON.stringify(engine.doc.worldScripts).length;
  const env = engine.env;
  const w = engine.walk;
  return {
    actors, roles, living, scriptSize,
    title: engine.doc?.title ?? '',
    env: { time: env.time, weather: env.weather, season: env.season, wind: env.wind, daySpeed: env.daySpeed },
    topView: engine.topView,
    walk: { active: !!w?.active, endless: !!w?.endless, eye: w?.eye ?? 1.6, x: w?.pos.x ?? 0, z: w?.pos.z ?? 0, home: w?.active ? w.homeVector.dist : 0 },
    selected: engine.getActor(engine.selectedId) ? engine.selectedId : null,
    running: runtime.running,
  };
}

/* ================================ lessons ================================ */
/** a control to point at; later ones in a step's list are the way there, with a "first, …" hint */
export interface Target { tour: string; hint?: string; when?: (c: LearnCtx) => boolean }
export type Text = string | ((c: LearnCtx) => string);
export type Gesture = 'drag' | 'pinch' | 'pan' | 'tap' | 'hold';
export interface Step {
  id: string;
  title: Text;
  body: Text;
  targets?: Target[];
  /** the mode this step happens in: in another mode the coach points at its tab first */
  mode?: Mode;
  /** a hand over the 3D view showing the gesture */
  gesture?: Gesture;
  /** where the hand goes: over a living thing on screen (to tap it), or the middle of the view */
  gestureAt?: 'living';
  /** done when this is true; without it the step is read, then Next */
  done?: (c: LearnCtx) => boolean;
  /** when the step begins (e.g. put the selection down so World & land shows) */
  enter?: (c: LearnCtx) => void;
  /** darken the screen around the control (on by default; off for steps in the 3D view) */
  dim?: boolean;
}
export interface Unit { id: string; emoji: string; title: string; blurb: string }
export interface Lesson {
  id: string;
  unit: string;
  emoji: string;
  title: string;
  blurb: string;
  minutes: number;
  xp: number;
  /** opens along the ranger path with this tool */
  needs?: FeatureId;
  /** something this diorama needs first (and the lesson that helps) */
  requires?: (c: LearnCtx) => { text: string; lesson?: string } | null;
  steps: Step[];
  /** what was learned, for the end of the lesson */
  recap: string[];
}

export const UNITS: Unit[] = [
  { id: 'start', emoji: '🌱', title: 'Your first habitat', blurb: 'Find your way around, bring the box to life and discover what lives there.' },
  { id: 'eco', emoji: '💚', title: 'Keep it healthy', blurb: 'Ecosystem health, food webs and quests.' },
  { id: 'land', emoji: '🏔️', title: 'Shape the land', blurb: 'Landforms, painting the ground and water.' },
  { id: 'story', emoji: '📝', title: 'Tell its story', blurb: 'Labels and notes, day and night, and walking inside.' },
  { id: 'life', emoji: '🧩', title: 'Bring it to life', blurb: 'Code with blocks, change the weather and sculpt by hand.' },
  { id: 'far', emoji: '🔭', title: 'Present and go further', blurb: 'Guided tours, seasons, the Area tool and roaming the wild.' },
];

/* ---------- helpers ---------- */
const T = (tour: string, hint?: string, when?: Target['when']): Target => ({ tour, hint, when });
export const textOf = (t: Text, c: LearnCtx) => (typeof t === 'function' ? t(c) : t);
const tapWord = (c: LearnCtx) => (c.touch ? 'Tap' : 'Click');
const isNight = (h: number) => h >= 21 || h < 5;
/** more living things with this role than when the step began */
const grew = (c: LearnCtx, ...roles: Role[]) => roles.some((r) => c.now.roles[r] > c.start.roles[r]);
/** an object placed before the step was moved, turned or resized since */
function changed(c: LearnCtx, what: 'move' | 'turn' | 'size') {
  for (const [id, b] of c.now.actors) {
    const a = c.start.actors.get(id);
    if (!a) continue;
    if (what === 'move' && Math.hypot(b.x - a.x, b.z - a.z) > 0.3) return true;
    if (what === 'turn' && Math.abs(b.rot - a.rot) > 0.1) return true;
    if (what === 'size' && Math.abs(b.scale - a.scale) > 0.04) return true;
  }
  return false;
}
/** an object's label (or notes) was written since the step began */
function wrote(c: LearnCtx, field: 'label' | 'note', min: number) {
  for (const [id, b] of c.now.actors) {
    const before = c.start.actors.get(id)?.[field] ?? '';
    if (b[field].length >= min && b[field] !== before) return true;
  }
  return false;
}
function selected(c: LearnCtx) { return c.engine.getActor(c.now.selected); }
function selectedLiving(c: LearnCtx) {
  const a = selected(c);
  return a && !a.isClone && a.def.living !== false && a.def.category !== 'habitats' ? a : undefined;
}
/** put the selection down, so the World & land panel shows */
const deselect = (c: LearnCtx) => { if (c.mode === 'build' && c.engine.selectedId) c.engine.select(null); };

/** the way to the inventory, wherever it is */
const toInventory: Target[] = [
  T('sheet-add', 'Tap ➕ Add things'),
  T('open-inventory', 'Tap ➕ Add things to open the inventory'),
];
/** the way to the land tools: put the selection down, open Edit / the World & land panel */
const toLand: Target[] = [
  T('land-section', 'Open Land tools'),
  T('viewport', 'Tap empty ground so nothing is selected', (c) => c.mode === 'build' && !!c.engine.selectedId),
  T('sheet-edit', 'Tap 🛠️ Edit'),
  T('open-inspector', 'Open the World & land panel'),
];
const inventoryCat = (cat: string, label: string): Target[] => [T(`inv-grid-${cat}`), T(`inv-cat-${cat}`, `Pick ${label}`), ...toInventory];
/** the way to the selected object's quick tools (on phones they are under the panel's Edit tab) */
const toTools: Target[] = [
  T('sheet-edit', 'Tap 🛠️ Edit to see its tools', (c) => !!c.engine.selectedId),
  T('viewport', 'Select something first', (c) => !c.engine.selectedId),
];

const needsLand = (c: LearnCtx) => (c.engine.terrain ? null : { text: 'This diorama is a habitat tile, so its land can’t be reshaped. Try this lesson in a diorama with land, like the Backyard or the Forest.' });
const needsLiving = (n: number) => (c: LearnCtx) => (c.now.living >= n ? null : { text: n === 1 ? 'There’s nothing living in your box yet.' : `Your box needs at least ${n} living things first.`, lesson: 'add' });

export const LESSONS: Lesson[] = [
  /* ---------------- Your first habitat ---------------- */
  {
    id: 'studio', unit: 'start', emoji: '🧰', title: 'Meet your studio', blurb: 'A quick look at the buttons you’ll use most.', minutes: 1, xp: 20,
    steps: [
      { id: 'box', title: 'This is your diorama', body: 'Your habitat lives in this box, in 3D. Everything you add shows up here.', targets: [T('viewport')], dim: false },
      { id: 'modes', title: 'Three ways to work', body: (c) => `🧭 Explore to look and discover · 🔨 Build to add things and shape the land · 🧩 Code to bring it to life${c.wide ? '' : ' · 📖 your Field journal'}.`, targets: [T('modes')] },
      { id: 'health', title: 'The heart', body: 'It scores your ecosystem from 0 to 100. Tap it any time to see what your habitat needs.', targets: [T('health')] },
      { id: 'quests', title: 'Quests', body: 'Every diorama has quests. Finish 10 for ⭐⭐ to complete the expedition — that unlocks new habitats and tools.', targets: [T('quests-link'), T('quest-tracker')] },
      { id: 'learn', title: 'Help is always here', body: 'Tap 🎓 Learn for lessons like this one. ⋯ More has saving, pictures and settings.', targets: [T('learn')] },
    ],
    recap: ['Your box, the three modes and the heart', 'Quests: 10 of them complete an expedition', '🎓 Learn has every lesson'],
  },
  {
    id: 'camera', unit: 'start', emoji: '🎥', title: 'Look around', blurb: 'Turn, zoom and slide the view.', minutes: 1, xp: 25,
    steps: [
      { id: 'orbit', title: 'Turn the box', body: (c) => (c.touch ? 'Drag with one finger to spin around your diorama.' : 'Drag with the mouse to spin around your diorama.'), targets: [T('viewport')], gesture: 'drag', dim: false, done: (c) => c.moved.orbit > 0.5 },
      { id: 'zoom', title: 'Zoom in and out', body: (c) => (c.touch ? 'Pinch with two fingers to zoom in close, then back out.' : 'Scroll the mouse wheel — or pinch the trackpad — to zoom in and out.'), targets: [T('viewport')], gesture: 'pinch', dim: false, done: (c) => c.moved.zoom > 0.25 },
      { id: 'pan', title: 'Slide the view', body: (c) => (c.touch ? 'Drag with two fingers together to slide the view sideways.' : 'Drag with the right mouse button to slide the view sideways.'), targets: [T('viewport')], gesture: 'pan', dim: false, done: (c) => c.moved.pan > 1.2 },
      { id: 'overview', title: 'Back to the whole box', body: (c) => `Tap Overview to see your whole diorama again${c.touch ? '' : ' (or press O)'}.`, mode: 'explore', targets: [T('explore-home')], done: (c) => c.seen.has('overview') },
    ],
    recap: ['Drag to turn the box', 'Pinch or scroll to zoom; two fingers or right-drag to slide', 'Overview (O) brings the whole box back'],
  },
  {
    id: 'add', unit: 'start', emoji: '🌱', title: 'Bring it to life', blurb: 'Add plants and animals from your inventory.', minutes: 2, xp: 30,
    steps: [
      { id: 'build', title: 'Switch to Build', body: 'Build mode is where you add things and shape the land.', targets: [T('tab-build')], done: (c) => c.mode === 'build' },
      { id: 'open', title: 'Your inventory', body: 'It holds every plant, animal, rock and more that lives in this habitat. The stripe on each tile shows its role.', mode: 'build', targets: [T('inventory'), ...toInventory], done: (c) => c.shown('inventory') },
      { id: 'plant', title: 'Add a plant', body: 'Plants are producers: they make food from sunlight. Pick 🌿 Plants, then tap one to add it.', mode: 'build', targets: inventoryCat('plants', '🌿 Plants'), done: (c) => grew(c, 'producer') },
      { id: 'eater', title: 'Add a plant-eater', body: 'Now pick 🦊 Animals and add one that eats plants. A yellow stripe marks plant-eaters.', mode: 'build', targets: inventoryCat('animals', '🦊 Animals'), done: (c) => grew(c, 'primary') },
    ],
    recap: ['Build mode has your inventory', 'Producers make food; plant-eaters (primary consumers) eat them', 'Tap a tile to add it — or drag it onto the land'],
  },
  {
    id: 'edit', unit: 'start', emoji: '✋', title: 'Move, turn & resize', blurb: 'Pick things up and arrange your habitat.', minutes: 2, xp: 30, requires: needsLiving(1),
    steps: [
      { id: 'select', title: 'Select something', body: (c) => `${tapWord(c)} a plant or animal in the box. A ring shows what’s selected.`, mode: 'build', targets: [T('viewport')], gesture: 'tap', gestureAt: 'living', dim: false, done: (c) => !!selected(c) },
      { id: 'move', title: 'Move it', body: (c) => (c.touch ? 'Drag it with one finger to a new spot.' : 'Drag it to a new spot.'), mode: 'build', targets: [T('viewport')], gesture: 'drag', dim: false, done: (c) => changed(c, 'move') },
      { id: 'turn', title: 'Turn it', body: (c) => (c.touch ? 'Tap ↻ to turn it — or twist two fingers on it.' : 'Tap ↻ to turn it (or press R).'), mode: 'build', targets: [T('ctx-turn'), ...toTools], done: (c) => changed(c, 'turn') },
      { id: 'size', title: 'Resize it', body: (c) => `Tap ＋ to make it bigger or − to make it smaller${c.touch ? ' — or pinch two fingers on it' : ''}.`, mode: 'build', targets: [T('ctx-bigger'), ...toTools], done: (c) => changed(c, 'size') },
      { id: 'undo', title: 'Oops? Undo!', body: (c) => `Tap ↶ Undo to take back your last change${c.touch ? '' : ' (Ctrl+Z)'}. It works for everything you build.`, mode: 'build', targets: [T('undo')], done: (c) => c.seen.has('undo') },
    ],
    recap: ['Tap to select, drag to move', 'Turn ↻ and resize ＋ − from the bar on it', 'Undo takes back any change'],
  },
  {
    id: 'discover', unit: 'start', emoji: '🔎', title: 'Discover species', blurb: 'Tap living things to collect them in your journal.', minutes: 2, xp: 30, requires: needsLiving(1),
    steps: [
      { id: 'explore', title: 'Switch to Explore', body: 'Explore is for looking closely and discovering.', targets: [T('tab-explore')], done: (c) => c.mode === 'explore' },
      { id: 'tap', title: 'Tap a living thing', body: (c) => `${tapWord(c)} any plant or animal to open its field card.`, mode: 'explore', targets: [T('viewport')], gesture: 'tap', gestureAt: 'living', dim: false, done: (c) => c.shown('species-card') },
      { id: 'card', title: 'Its field card', body: 'What it eats here, what eats it, its real size and a fact. Tap Read to hear it aloud.', targets: [T('species-card')] },
      { id: 'journal', title: 'Open your Field journal', body: 'Every species you discover is saved here. Ones still to find show as silhouettes.', targets: [T('tab-journal'), T('explore-journal'), T('xp')], done: (c) => c.shown('journal') },
    ],
    recap: ['Tap living things in Explore to discover them', 'Field cards show what eats what', 'Your Field journal collects every species'],
  },

  /* ---------------- Keep it healthy ---------------- */
  {
    id: 'health', unit: 'eco', emoji: '💚', title: 'Ecosystem health', blurb: 'Read the heart, then fill the gaps.', minutes: 3, xp: 35,
    steps: [
      { id: 'open', title: 'Check the heart', body: 'Tap the heart to see how healthy your ecosystem is.', targets: [T('health')], done: (c) => c.shown('health-pop') },
      { id: 'read', title: 'What it needs', body: 'Each bar is one part of a healthy habitat. The tips underneath say what to add next.', targets: [T('health-pop'), T('health', 'Tap the heart again')] },
      { id: 'predator', title: 'Add a predator', body: 'Predators eat other animals. In Build → 🦊 Animals, an orange or red stripe marks hunters.', mode: 'build', targets: inventoryCat('animals', '🦊 Animals'), done: (c) => grew(c, 'secondary', 'tertiary') },
      { id: 'decomposer', title: 'Add a decomposer', body: 'Decomposers recycle dead things into soil. Try a mushroom under 🍄 Fungi — or an earthworm.', mode: 'build', targets: inventoryCat('fungi', '🍄 Fungi'), done: (c) => grew(c, 'decomposer') },
    ],
    recap: ['The heart scores variety, roles, food, balance and water', 'Every habitat needs producers, consumers and decomposers', 'Its tips always say what to add next'],
  },
  {
    id: 'foodweb', unit: 'eco', emoji: '🕸️', title: 'Who eats whom?', blurb: 'Explore the food web and build a food chain.', minutes: 3, xp: 35, requires: needsLiving(1),
    steps: [
      { id: 'open', title: 'Open the food web', body: 'It shows who eats whom among everything in your box.', mode: 'explore', targets: [T('explore-web')], done: (c) => c.shown('foodweb') },
      { id: 'pick', title: 'Pick an organism', body: 'Tap any organism in the web to light up what it eats and what eats it.', targets: [T('foodweb-diagram'), T('explore-web', 'Open the food web')], done: (c) => c.seen.has('web-focus') },
      { id: 'whatif', title: 'What if…?', body: 'Tap What if…? to see who would go hungry if it disappeared.', targets: [T('web-whatif'), T('foodweb-diagram', 'Pick an organism first'), T('explore-web', 'Open the food web')], done: (c) => c.seen.has('web-whatif') },
      { id: 'chain', title: 'Make a food chain', body: 'Link three: a plant → a plant-eater that eats it → a predator that eats the plant-eater. Add whatever is missing in Build.', done: (c) => c.chain >= 3 },
    ],
    recap: ['Arrows point from the food to the eater', '“What if…?” shows who depends on whom', 'A food chain links producers to predators'],
  },
  {
    id: 'quests', unit: 'eco', emoji: '🏆', title: 'Quests & stars', blurb: 'Earn stars and complete your expedition.', minutes: 2, xp: 25,
    steps: [
      { id: 'open', title: 'Open your quests', body: 'Tap the quest count under your diorama’s name.', targets: [T('quests-link'), T('quest-tracker')], done: (c) => c.shown('quest-log') },
      { id: 'stars', title: 'Stars and expeditions', body: '5 quests earn ⭐, 10 earn ⭐⭐ and complete the expedition — that unlocks new habitats and tools. All of them earn ⭐⭐⭐.', targets: [T('quest-log')] },
      { id: 'name', title: 'Name your diorama', body: 'Close the quests, tap the title at the top and type a name of your own.', targets: [T('title')], done: (c) => { const t = c.now.title.trim(); return !!t && t !== (BIOME_BY_ID[c.engine.doc.biome]?.name ?? ''); } },
    ],
    recap: ['5, 10 and all quests earn ⭐, ⭐⭐ and ⭐⭐⭐', '⭐⭐ on your own diorama completes an expedition', 'Each expedition unlocks the next step of the ranger path'],
  },

  /* ---------------- Shape the land ---------------- */
  {
    id: 'landforms', unit: 'land', emoji: '🏔️', title: 'Landforms', blurb: 'Stamp hills and valleys, and look from above.', minutes: 3, xp: 30, requires: needsLand,
    steps: [
      { id: 'open', title: 'Open the land tools', body: (c) => (c.wide ? 'With nothing selected, the panel on the right shows World & land.' : 'With nothing selected, 🛠️ Edit shows World & land.'), mode: 'build', enter: deselect, targets: [T('land-tools'), ...toLand], done: (c) => c.shown('land-tools') },
      { id: 'pick', title: 'Pick a hill', body: 'Under 🏔️ Landforms, tap 🟢 Hill.', mode: 'build', targets: [T('stamp-hill'), T('landtab-landforms', 'Tap 🏔️ Landforms'), ...toLand], done: (c) => c.engine.brush.tool === 'stamp' },
      { id: 'stamp', title: 'Stamp it', body: (c) => `${tapWord(c)} the land to place your hill — or press and drag to make it bigger. A see-through preview shows it first.`, mode: 'build', targets: [T('viewport', undefined, (x) => x.engine.brush.tool === 'stamp'), T('stamp-hill', 'Pick 🟢 Hill again'), ...toLand], gesture: 'tap', dim: false, done: (c) => c.seen.has('land:stamp') },
      { id: 'top', title: 'Look from above', body: 'Tap Top view to look straight down — handy for placing things.', mode: 'build', targets: [T('top-view')], done: (c) => c.now.topView },
      { id: 'back', title: 'Back to 3D', body: (c) => `Tap 3D view to go back. Put a land tool away with Done${c.touch ? '' : ' (or Esc)'}.`, mode: 'build', targets: [T('top-view')], done: (c) => !c.now.topView },
    ],
    recap: ['World & land shows when nothing is selected', 'Pick a landform, then tap or drag on the land', 'Top view (T) looks straight down'],
  },
  {
    id: 'paint', unit: 'land', emoji: '🎨', title: 'Paint & water', blurb: 'Paint the ground and dig a lake.', minutes: 3, xp: 30, requires: needsLand,
    steps: [
      { id: 'open', title: 'Open Paint', body: 'In the land tools, tap 🎨 Paint.', mode: 'build', enter: deselect, targets: [T('landtab-paint'), ...toLand], done: (c) => c.engine.brush.tool === 'paint' },
      { id: 'brush', title: 'Paint the ground', body: 'Pick a ground, like Sand or Mud, then drag across the land to paint it.', mode: 'build', targets: [T('paint-tools'), T('landtab-paint', 'Tap 🎨 Paint'), ...toLand], gesture: 'drag', done: (c) => c.seen.has('land:paint') },
      { id: 'water', title: 'Add water', body: 'Every habitat needs water. Tap 🏔️ Landforms, pick 💧 Lake, then tap the land.', mode: 'build', targets: [T('viewport', undefined, (x) => x.engine.brush.tool === 'stamp' && x.engine.land.stamp.id === 'lake'), T('stamp-lake'), T('landtab-landforms', 'Tap 🏔️ Landforms'), ...toLand], done: (c) => c.seen.has('land:water') || c.seen.has('land:stamp:lake') || c.seen.has('land:stamp:island') },
    ],
    recap: ['🎨 Paint has 22 grounds — ✨ Auto picks one from the shape of the land', 'A 💧 Lake landform digs a lake and adds water', 'The Water switch and slider set the water level'],
  },

  /* ---------------- Tell its story ---------------- */
  {
    id: 'labels', unit: 'story', emoji: '🏷️', title: 'Labels & notes', blurb: 'Write what you learned on toothpick flags.', minutes: 3, xp: 35, requires: needsLiving(1),
    steps: [
      { id: 'select', title: 'Select an organism', body: (c) => `${tapWord(c)} a plant or animal in the box.`, mode: 'build', targets: [T('viewport')], gesture: 'tap', gestureAt: 'living', dim: false, done: (c) => !!selectedLiving(c) },
      { id: 'tab', title: 'Open the Label tab', body: 'In its panel, tap 🏷️ Label.', mode: 'build', targets: [T('label-text'), T('insp-label', 'Tap 🏷️ Label'), T('sheet-edit', 'Tap 🛠️ Edit'), T('open-inspector', 'Open the Edit panel')], done: (c) => c.shown('label-text') },
      { id: 'label', title: 'Write a label', body: 'Type what it is or does, like “Producer: makes food from sunlight”.', mode: 'build', targets: [T('label-text'), T('insp-label', 'Tap 🏷️ Label')], done: (c) => wrote(c, 'label', 2) },
      { id: 'notes', title: 'Add research notes', body: 'Write a sentence about what you found out. Notes show on its field card and are read aloud on tours.', mode: 'build', targets: [T('notes'), T('insp-label', 'Tap 🏷️ Label')], done: (c) => wrote(c, 'note', 11) },
    ],
    recap: ['Labels are paper flags on toothpicks (L shows or hides them)', 'Research notes appear on field cards', 'Tours read your notes aloud'],
  },
  {
    id: 'time', unit: 'story', emoji: '🌙', title: 'Day & night', blurb: 'Change the time and watch the light.', minutes: 2, xp: 25,
    steps: [
      { id: 'open', title: 'Open the clock', body: 'Tap the clock in the Explore bar.', mode: 'explore', targets: [T('explore-time')], done: (c) => c.shown('time-pop') },
      { id: 'night', title: 'Make it night', body: 'Tap 🌙, or drag Time of day past 21:00. Fireflies and glowing fungi light up at night!', mode: 'explore', targets: [T('time-pop'), T('explore-time', 'Open the clock')], done: (c) => isNight(c.now.env.time) },
      { id: 'cycle', title: 'Let time run', body: 'Drag Day–night cycle to the right to watch the days go by on their own.', mode: 'explore', targets: [T('time-pop'), T('explore-time', 'Open the clock')], done: (c) => c.now.env.daySpeed > 0 },
    ],
    recap: ['The clock sets the time of day', 'Night changes what you see (and earns the Night Owl badge)', 'Day–night cycle runs time on its own'],
  },
  {
    id: 'walk', unit: 'story', emoji: '🥾', title: 'Walk inside', blurb: 'See your habitat from the inside.', minutes: 2, xp: 30,
    steps: [
      { id: 'enter', title: 'Walk in', body: 'Tap Walk in to step inside your diorama.', mode: 'explore', targets: [T('explore-walk')], done: (c) => c.now.walk.active },
      { id: 'move', title: 'Walk around', body: (c) => (c.touch ? 'Drag on the left side to walk, and on the right side to look around.' : 'Use W A S D to walk. Click the view to look around with the mouse.'), targets: [T('walk-stick')], dim: false, done: (c) => c.now.walk.active && Math.hypot(c.now.walk.x - c.start.walk.x, c.now.walk.z - c.start.walk.z) > 1.5 },
      { id: 'ant', title: 'Be an ant', body: 'Pick 🐜 to shrink to an ant’s eye level.', targets: [T('walk-eyes')], done: (c) => c.now.walk.active && c.now.walk.eye <= 0.05 },
      { id: 'leave', title: 'Step back out', body: (c) => `Tap Leave${c.touch ? '' : ' (or press Esc)'} to step back out of the box.`, targets: [T('walk-leave')], done: (c) => !c.now.walk.active },
    ],
    recap: ['Walk in at the eye level of a person, fox, frog or ant', 'Fly over it as a 🦅 bird', 'Leave (Esc) steps back out'],
  },

  /* ---------------- Bring it to life ---------------- */
  {
    id: 'code', unit: 'life', emoji: '🧩', title: 'Your first script', blurb: 'Snap blocks together and press Play.', minutes: 3, xp: 40, needs: 'code',
    requires: (c) => (c.engine.actorList.some((a) => !a.isClone && a.def.category === 'animals') ? null : { text: 'Add an animal to your box first — it will star in your script.', lesson: 'add' }),
    steps: [
      { id: 'mode', title: 'Switch to Code', body: 'Code mode gives every plant and animal its own scripts.', targets: [T('tab-code')], done: (c) => c.mode === 'code' },
      { id: 'who', title: 'Choose an animal', body: 'Tap an animal in the row at the top. Each one has its own scripts, like sprites in Scratch.', mode: 'code', targets: [T('code-targets')], done: (c) => selected(c)?.def.category === 'animals' },
      { id: 'blocks', title: 'Add a starter idea', body: 'Tap an idea like 🚶 Wander about — or drag a yellow “when ▶ clicked” block in from Events.', mode: 'code', targets: [T('code-ideas'), T('code-ideas-btn', 'Tap 💡 Ideas'), T('code-workspace')], done: (c) => c.now.scriptSize > c.start.scriptSize + 20 },
      { id: 'play', title: 'Press Play', body: 'Press ▶ Play to run every script in your diorama.', targets: [T('play'), T('code-play')], done: (c) => c.now.running },
      { id: 'stop', title: 'Press Stop', body: 'Stop puts everything back exactly where you built it.', targets: [T('play'), T('code-play')], done: (c) => !c.now.running },
    ],
    recap: ['Every object has its own scripts', 'Scripts start with an Events block, like “when ▶ clicked”', 'Play runs them; Stop resets everything'],
  },
  {
    id: 'weather', unit: 'life', emoji: '⛈️', title: 'Weather', blurb: 'Rain, storms, snow and wind.', minutes: 2, xp: 25, needs: 'weather',
    steps: [
      { id: 'open', title: 'Open the weather', body: 'Tap Weather in the Explore bar.', mode: 'explore', targets: [T('explore-weather')], done: (c) => c.shown('weather-pop') },
      { id: 'rain', title: 'Change the weather', body: 'Pick 🌧️ rain, ⛈️ a storm or ❄️ snow.', mode: 'explore', targets: [T('weather-pop'), T('explore-weather', 'Open the weather')], done: (c) => c.now.env.weather !== c.start.env.weather && ['rain', 'storm', 'snow'].includes(c.now.env.weather) },
      { id: 'wind', title: 'Feel the wind', body: 'Drag the Wind slider and watch the plants sway.', mode: 'explore', targets: [T('weather-pop'), T('explore-weather', 'Open the weather')], done: (c) => Math.abs(c.now.env.wind - c.start.env.wind) > 0.15 },
    ],
    recap: ['Weather: clear, cloudy, rain, storm, snow or fog', 'Wind makes plants and grass sway', 'A storm earns the Storm Chaser badge'],
  },
  {
    id: 'sculpt', unit: 'life', emoji: '✋', title: 'Sculpt by hand', blurb: 'Raise, dig and smooth the land with brushes.', minutes: 3, xp: 30, needs: 'sculpt', requires: needsLand,
    steps: [
      { id: 'open', title: 'Open Sculpt', body: 'In the land tools, tap ✋ Sculpt.', mode: 'build', enter: deselect, targets: [T('sculpt-tools'), T('landtab-sculpt', 'Tap ✋ Sculpt'), ...toLand], done: (c) => c.shown('sculpt-tools') },
      { id: 'raise', title: 'Raise the land', body: 'Tap Raise, then press and hold on the land to build it up.', mode: 'build', targets: [T('viewport', undefined, (x) => x.engine.brush.tool === 'raise'), T('sculpt-raise'), T('landtab-sculpt', 'Tap ✋ Sculpt'), ...toLand], gesture: 'hold', done: (c) => c.seen.has('land:raise') },
      { id: 'dig', title: 'Dig a hole', body: 'Tap Dig, then drag across the land.', mode: 'build', targets: [T('viewport', undefined, (x) => x.engine.brush.tool === 'lower'), T('sculpt-lower'), T('landtab-sculpt', 'Tap ✋ Sculpt'), ...toLand], gesture: 'drag', done: (c) => c.seen.has('land:lower') },
      { id: 'smooth', title: 'Smooth it out', body: 'Tap Smooth and brush over the bumps.', mode: 'build', targets: [T('viewport', undefined, (x) => x.engine.brush.tool === 'smooth'), T('sculpt-smooth'), T('landtab-sculpt', 'Tap ✋ Sculpt'), ...toLand], gesture: 'drag', done: (c) => c.seen.has('land:smooth') },
    ],
    recap: ['Hold still to keep building in one spot, or drag to shape', '[ and ] change the brush size', 'Smooth and Flatten tidy up; Rocky roughens'],
  },

  /* ---------------- Present and go further ---------------- */
  {
    id: 'tour', unit: 'far', emoji: '🎤', title: 'Give a guided tour', blurb: 'Present your diorama with a narrated tour.', minutes: 3, xp: 35, needs: 'tour', requires: needsLiving(2),
    steps: [
      { id: 'start', title: 'Start the tour', body: 'Tap Tour in the Explore bar.', mode: 'explore', targets: [T('explore-tour')], done: (c) => c.shown('tour-panel') },
      { id: 'watch', title: 'Watch it to the end', body: 'It flies to each species in food-chain order and reads your notes. Tap Next to move on, or let it play.', targets: [T('tour-panel'), T('explore-tour', 'Start the tour again')], done: (c) => c.seen.has('tour-end') },
      { id: 'end', title: 'End the tour', body: 'Tap End tour when you’re done. Tours are best with research notes on three or more species.', targets: [T('tour-end')], done: (c) => !c.shown('tour-panel') },
    ],
    recap: ['Tours visit producers, then plant-eaters, then predators', 'They read your research notes aloud', 'A finished tour earns the Tour Guide badge'],
  },
  {
    id: 'seasons', unit: 'far', emoji: '🍂', title: 'Seasons', blurb: 'See your habitat in every season.', minutes: 1, xp: 25, needs: 'seasons',
    steps: [
      { id: 'open', title: 'Open the weather', body: 'Tap Weather in the Explore bar.', mode: 'explore', targets: [T('explore-weather')], done: (c) => c.shown('weather-pop') },
      { id: 'season', title: 'Change the season', body: 'Pick 🍂 autumn or ❄️ winter: leaves change colour, and winter brings snow.', mode: 'explore', targets: [T('season-pick'), T('explore-weather', 'Open the weather')], done: (c) => c.now.env.season !== c.start.env.season },
    ],
    recap: ['Trees blossom, turn and drop their leaves with the seasons', 'Winter brings snow cover', 'All four earn the Four Seasons badge'],
  },
  {
    id: 'area', unit: 'far', emoji: '⬚', title: 'The Area tool', blurb: 'Select land and grow mountains, rivers and coasts.', minutes: 3, xp: 40, needs: 'area', requires: needsLand,
    steps: [
      { id: 'open', title: 'Open the Area tool', body: 'In the land tools, tap ⬚ Area.', mode: 'build', enter: deselect, targets: [T('landtab-area'), ...toLand], done: (c) => c.engine.brush.tool === 'area' },
      { id: 'select', title: 'Select some land', body: (c) => `${c.touch ? 'Drag your finger' : 'Drag'} across the land to draw a box around it.`, mode: 'build', targets: [T('viewport', undefined, (x) => x.engine.brush.tool === 'area'), T('landtab-area', 'Tap ⬚ Area'), ...toLand], gesture: 'drag', dim: false, done: (c) => !!c.engine.land.area.shape },
      { id: 'kind', title: 'Choose what grows', body: 'Pick what the area becomes: mountains, hills, a lake, a river, a coast…', mode: 'build', targets: [T('area-kinds')] },
      { id: 'go', title: 'Generate!', body: 'Tap Generate. Try another swaps it for a new variation.', mode: 'build', targets: [T('area-generate'), T('landtab-area', 'Tap ⬚ Area')], done: (c) => c.seen.has('land:area') },
    ],
    recap: ['Select with a box, oval, lasso or brush', 'Generate grows a landform to fill the shape', 'Try another for a new variation'],
  },
  {
    id: 'roam', unit: 'far', emoji: '🌍', title: 'Roam the wild', blurb: 'Walk out of the box into an endless landscape.', minutes: 3, xp: 40, needs: 'roam', requires: needsLand,
    steps: [
      { id: 'start', title: 'Start roaming', body: 'Tap Roam in the Explore bar.', mode: 'explore', targets: [T('explore-roam')], done: (c) => c.now.walk.active && c.now.walk.endless },
      // (roaming starts just in front of the box, facing it: any 25 m counts, whichever way)
      { id: 'out', title: 'Head out', body: (c) => (c.touch ? 'Push the stick to its rim to run, any way you like. The land goes on and on!' : 'Hold W to walk — add Shift to run — any way you like. The land goes on and on!'), targets: [T('walk-stick')], dim: false, done: (c) => c.now.walk.endless && Math.hypot(c.now.walk.x - c.start.walk.x, c.now.walk.z - c.start.walk.z) > 25 },
      { id: 'home', title: 'Find your way home', body: 'The compass points back to your box. Tap 🏠 Home to jump straight back.', targets: [T('walk-home')], done: (c) => c.seen.has('roam-home') },
      { id: 'leave', title: 'Step back out', body: 'Tap Leave when you’re done exploring.', targets: [T('walk-leave')], done: (c) => !c.now.walk.active },
    ],
    recap: ['Roam carries your habitat on forever', 'The compass always points home', '🦅 Bird flies high to see far'],
  },
];

export const LESSON_BY_ID: Record<string, Lesson> = Object.fromEntries(LESSONS.map((l) => [l.id, l]));

/** quests a lesson teaches: a quest's "Show me" starts it */
export const QUEST_LESSON: Record<string, string> = {
  title: 'quests', discover: 'discover', producers: 'add', herbivores: 'add', predator: 'health', decomposer: 'health',
  chain: 'foodweb', water: 'paint', abiotic: 'paint', health: 'health', labels: 'labels', notes: 'labels',
  night: 'time', walk: 'walk', code: 'code', tour: 'tour',
};
/** tools the ranger path unlocks, and the lesson that teaches each */
export const FEATURE_LESSON: Partial<Record<FeatureId, string>> = { code: 'code', weather: 'weather', sculpt: 'sculpt', tour: 'tour', seasons: 'seasons', area: 'area', roam: 'roam' };

/** the lesson is open on this device's ranger path */
export function lessonOpen(l: Lesson, p: Readonly<Profile> = getProfile()) { return !l.needs || isUnlocked(l.needs, p); }
/** the next lesson to take: the first open one not yet done (after `after`, if given) */
export function nextLesson(done: readonly string[], after?: string, p: Readonly<Profile> = getProfile()): Lesson | null {
  const from = after ? LESSONS.findIndex((l) => l.id === after) + 1 : 0;
  const order = [...LESSONS.slice(from), ...LESSONS.slice(0, from)];
  return order.find((l) => !done.includes(l.id) && lessonOpen(l, p)) ?? null;
}
