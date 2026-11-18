/* Ready-made scripts kids can drop in with one tap, then remix. */
type B = Record<string, unknown>;
const num = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
const txt = (t: string) => ({ shadow: { type: 'text', fields: { TEXT: t } } });
const obj = (v: string, type = 'dd_obj') => ({ shadow: { type, fields: { OBJ: v } } });
const blk = (type: string, inputs: B = {}, fields: B = {}): B => ({ type, ...(Object.keys(inputs).length ? { inputs } : {}), ...(Object.keys(fields).length ? { fields } : {}) });
/** link blocks with `next` */
export function chain(...list: B[]): B {
  for (let i = list.length - 2; i >= 0; i--) list[i] = { ...list[i], next: { block: list[i + 1] } };
  return list[0];
}
const sub = (...list: B[]) => ({ block: chain(...list) });
const reporter = (type: string, fields: B = {}) => ({ block: { type, ...(Object.keys(fields).length ? { fields } : {}) } });

export interface Recipe { id: string; label: string; emoji: string; world?: boolean; build: (name: string) => B }

export const RECIPES: Recipe[] = [
  { id: 'wander', label: 'Wander about', emoji: '🚶', build: () => chain(blk('dd_when_start'), blk('dd_forever', { DO: sub(blk('dd_wander', { SECS: num(4) }), blk('dd_wait', { SECS: num(1) })) })) },
  { id: 'hello', label: 'Say hello when tapped', emoji: '💬', build: (n) => chain(blk('dd_when_tapped'), blk('dd_animal_call'), blk('dd_say_for', { TEXT: txt(`Hi! I'm a ${n}.`), SECS: num(2) })) },
  { id: 'eat', label: 'Find food', emoji: '🍽️', build: () => chain(blk('dd_when_start'), blk('dd_forever', { DO: sub(blk('dd_eat', { TARGET: { ...obj('@random'), block: { type: 'dd_nearest_food' } } }), blk('dd_sleep', { SECS: num(3) }), blk('dd_wander', { SECS: num(3) })) })) },
  { id: 'flee', label: 'Run from predators', emoji: '🏃', build: () => chain(blk('dd_when_start'), blk('dd_forever', { DO: sub(blk('dd_if_else', { COND: { block: { type: 'dd_predator_near', inputs: { D: num(5) } } }, DO: sub(blk('dd_say', { TEXT: txt('Eek!') }), blk('dd_flee', { TARGET: { ...obj('@camera'), block: { type: 'dd_nearest_predator' } }, SECS: num(3) }), blk('dd_say', { TEXT: txt('') })), ELSE: sub(blk('dd_wander', { SECS: num(2) })) })) })) },
  { id: 'circle', label: 'Fly in circles', emoji: '🦅', build: () => chain(blk('dd_when_start'), blk('dd_fly_height', { H: num(4) }), blk('dd_forever', { DO: sub(blk('dd_circle', { TARGET: obj('@self', 'dd_obj_self'), R: num(4), SECS: num(10) })) })) },
  { id: 'night', label: 'Sleep at night', emoji: '🌙', build: () => chain(blk('dd_when_time', {}, { WHEN: 'night' }), blk('dd_say_for', { TEXT: txt('Goodnight!'), SECS: num(2) }), blk('dd_sleep', { SECS: num(12) })) },
  { id: 'camo', label: 'Change colour (camouflage)', emoji: '🎨', build: () => chain(blk('dd_when_tapped'), blk('dd_set_tint', { C: { shadow: { type: 'dd_color', fields: { C: 'green' } } } }), blk('dd_think_for', { TEXT: txt('Can you still see me?'), SECS: num(2) }), blk('dd_wait', { SECS: num(2) }), blk('dd_clear_tint')) },
  { id: 'quiz', label: 'Quiz question', emoji: '❓', build: (n) => chain(blk('dd_when_tapped'), blk('dd_ask', { TEXT: txt(`Is a ${n} a producer or a consumer?`) }), blk('dd_if_else', { COND: { block: { type: 'logic_compare', fields: { OP: 'EQ' }, inputs: { A: reporter('dd_answer'), B: { block: { type: 'text', fields: { TEXT: 'consumer' } } } } } }, DO: sub(blk('dd_sound', {}, { S: 'yay' }), blk('dd_say_for', { TEXT: txt('Correct! 🎉'), SECS: num(2) })), ELSE: sub(blk('dd_say_for', { TEXT: txt('Not quite — try again!'), SECS: num(2) })) })) },
  { id: 'family', label: 'Grow the family', emoji: '👶', build: () => chain(blk('dd_when_tapped'), blk('dd_say_for', { TEXT: txt('A baby!'), SECS: num(1) }), blk('dd_baby')) },
  // world
  { id: 'daynight', label: 'Day–night cycle', emoji: '🌗', world: true, build: () => chain(blk('dd_when_start'), blk('dd_caption', { TEXT: txt('Watch a whole day go by…'), SECS: num(3) }), blk('dd_day_cycle', { S: num(6) })) },
  { id: 'storm', label: 'Storm show', emoji: '⛈️', world: true, build: () => chain(blk('dd_when_start'), blk('dd_caption', { TEXT: txt('A storm is coming!'), SECS: num(3) }), blk('dd_weather', {}, { W: 'cloudy' }), blk('dd_wait', { SECS: num(3) }), blk('dd_weather', {}, { W: 'storm' }), blk('dd_wait', { SECS: num(8) }), blk('dd_weather', {}, { W: 'clear' }), blk('dd_caption', { TEXT: txt('The sun comes out again.'), SECS: num(3) })) },
  { id: 'seasons', label: 'Cycle the seasons', emoji: '🍂', world: true, build: () => chain(blk('dd_when_start'), blk('dd_forever', { DO: sub(...(['spring', 'summer', 'autumn', 'winter'] as const).flatMap((s) => [blk('dd_season', {}, { S: s }), blk('dd_caption', { TEXT: txt(s[0].toUpperCase() + s.slice(1)), SECS: num(2) }), blk('dd_wait', { SECS: num(5) })])) })) },
  { id: 'intro', label: 'Narrated introduction', emoji: '🎤', world: true, build: (n) => chain(blk('dd_when_start'), blk('dd_cam_overview'), blk('dd_caption', { TEXT: txt(`Welcome to ${n}!`), SECS: num(4) }), blk('dd_speak', { TEXT: txt(`Welcome to ${n}. Tap the animals to meet them.`) })) },
];

/** Place a recipe stack into a workspace state at a free spot. */
export function recipeBlock(r: Recipe, name: string, x: number, y: number) {
  return { ...r.build(name), x, y };
}

/** Workspace JSON for one or more recipes stacked vertically (used by biome templates). */
export function scriptsFor(ids: string[], name: string) {
  const blocks = ids.map((id, i) => {
    const r = RECIPES.find((x) => x.id === id);
    return r ? recipeBlock(r, name, 40, 40 + i * 260) : null;
  }).filter(Boolean);
  return { blocks: { languageVersion: 0, blocks } };
}
