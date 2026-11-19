import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';
import { codeContext, COLORS, COLOR_EMOJI } from './context';

/** A dropdown that accepts any stored value, so menus whose options change (objects, joints…) never lose data. */
class FieldDynamic extends Blockly.FieldDropdown {
  protected override doClassValidation_(v?: string) { return v ?? null; }
}
type Opt = [string, string];
function dyn(gen: () => Opt[]): Blockly.Field<string | undefined> {
  return new FieldDynamic(function (this: Blockly.FieldDropdown) {
    const opts = gen();
    const cur = this.getValue?.();
    if (cur && !opts.some((o) => o[1] === cur)) opts.push([cur.startsWith('@') ? cur.slice(1) : '(missing) ' + cur, cur]);
    return opts.length ? opts : [['—', '']];
  } as Blockly.MenuGeneratorFunction) as unknown as Blockly.Field<string | undefined>;
}
const objOpts = (extra: Opt[]) => () => [...extra, ...codeContext.objects().map((o): Opt => [`${o.emoji} ${o.name}`, o.id])];

/** menu shadow blocks take on their parent block's colour, like Scratch */
function adoptParentStyle(this: Blockly.Block) {
  const p = this.getParent();
  if (p && this.isShadow() && p.getStyleName() !== this.getStyleName()) this.setStyle(p.getStyleName());
}
function menuBlock(type: string, field: string, gen: () => Opt[], output: string) {
  Blockly.Blocks[type] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(dyn(gen), field);
      this.setOutput(true, output);
      this.setStyle('sensing_blocks');
      this.setOnChange(adoptParentStyle.bind(this));
    },
  };
}

const KEYS: Opt[] = [['space', ' '], ['↑ up', 'arrowup'], ['↓ down', 'arrowdown'], ['← left', 'arrowleft'], ['→ right', 'arrowright'], ['any', 'any'],
  ...'abcdefghijklmnopqrstuvwxyz0123456789'.split('').map((k): Opt => [k, k])];
const ANIMS: Opt[] = [['idle', 'idle'], ['walk', 'walk'], ['trot', 'trot'], ['gallop', 'gallop'], ['graze / peck', 'graze'], ['alert', 'alert'], ['roar', 'roar'], ['sit', 'sit'], ['flap wings', 'flap'], ['glide', 'glide'], ['hop', 'hop']];
const SOUNDS: Opt[] = [['🐦 chirp', 'chirp'], ['🎵 tweet', 'tweet'], ['🦉 hoot', 'hoot'], ['🐸 croak', 'croak'], ['🐺 howl', 'howl'], ['🦁 roar', 'roar'], ['🐘 trumpet', 'trumpet'],
  ['🐝 buzz', 'buzz'], ['🦗 cricket', 'cricket'], ['💦 splash', 'splash'], ['🫧 bubbles', 'bubble'], ['🎈 pop', 'pop'], ['🔔 chime', 'chime'], ['🥁 drum', 'drum'], ['⛈️ thunder', 'thunder'],
  ['😋 munch', 'munch'], ['💨 whoosh', 'whoosh'], ['🦆 quack', 'quack'], ['🐄 moo', 'moo'], ['🐑 baa', 'baa'], ['🐭 squeak', 'squeak'], ['🐍 hiss', 'hiss'], ['🐦‍⬛ caw', 'caw'], ['🐴 neigh', 'neigh'], ['🐗 grunt', 'grunt'], ['🎉 yay', 'yay']];
const WEATHER: Opt[] = [['☀️ clear', 'clear'], ['⛅ cloudy', 'cloudy'], ['🌧️ rain', 'rain'], ['⛈️ storm', 'storm'], ['❄️ snow', 'snow'], ['🌫️ fog', 'fog']];
const SEASONS: Opt[] = [['🌱 spring', 'spring'], ['☀️ summer', 'summer'], ['🍂 autumn', 'autumn'], ['❄️ winter', 'winter']];
const COLOR_OPTS: Opt[] = Object.keys(COLORS).map((c): Opt => [`${COLOR_EMOJI[c]} ${c}`, c]);

menuBlock('dd_obj', 'OBJ', objOpts([['🎲 random spot', '@random'], ['🎥 the camera', '@camera']]), 'Object');
menuBlock('dd_obj_self', 'OBJ', objOpts([['🙂 myself', '@self']]), 'Object');
menuBlock('dd_obj_any', 'OBJ', objOpts([['✨ anything', '@any']]), 'Object');
menuBlock('dd_color', 'C', () => COLOR_OPTS, 'Colour');
menuBlock('dd_species', 'S', () => codeContext.species().map((s): Opt => [s.name, s.id]), 'Species');

const N = (name: string) => ({ type: 'input_value', name, check: 'Number' });
const T = (name: string) => ({ type: 'input_value', name });
const O = (name: string) => ({ type: 'input_value', name, check: 'Object' });
const B = (name: string) => ({ type: 'input_value', name, check: 'Boolean' });
const DD = (name: string, options: Opt[]) => ({ type: 'field_dropdown', name, options });
const stmt = (style: string, tooltip: string) => ({ previousStatement: null, nextStatement: null, style, tooltip, inputsInline: true });
const hat = (tooltip: string) => ({ nextStatement: null, style: 'events_blocks', tooltip });
const rep = (style: string, check: string | null, tooltip: string) => ({ output: check, style, tooltip, inputsInline: true });

const defs: unknown[] = [
  /* ---------------- events ---------------- */
  { type: 'dd_when_start', message0: 'when %1 clicked', args0: [{ type: 'field_label', text: '▶️' }], ...hat('Runs when you press the green Play button.') },
  { type: 'dd_when_tapped', message0: 'when this is tapped', ...hat('Runs when someone clicks or taps this object while playing.') },
  { type: 'dd_when_key', message0: 'when %1 key pressed', args0: [DD('KEY', KEYS)], ...hat('Runs when a keyboard key is pressed.') },
  { type: 'dd_when_receive', message0: 'when I receive %1', args0: [{ type: 'field_input', name: 'MSG', text: 'message1' }], ...hat('Runs when this message is broadcast.') },
  { type: 'dd_when_every', message0: 'every %1 seconds', args0: [{ type: 'field_number', name: 'SECS', value: 2, min: 0.1 }], ...hat('Runs again and again on a timer.') },
  { type: 'dd_when_time', message0: 'when it becomes %1', args0: [DD('WHEN', [['🌙 night', 'night'], ['🌅 day', 'day']])], ...hat('Runs at sunset or sunrise.') },
  { type: 'dd_broadcast', message0: 'broadcast %1', args0: [{ type: 'field_input', name: 'MSG', text: 'message1' }], ...stmt('events_blocks', 'Send a message to every object.') },
  { type: 'dd_broadcast_wait', message0: 'broadcast %1 and wait', args0: [{ type: 'field_input', name: 'MSG', text: 'message1' }], ...stmt('events_blocks', 'Send a message and wait until everyone who receives it finishes.') },

  /* ---------------- motion ---------------- */
  { type: 'dd_move', message0: 'move %1 m', args0: [N('DIST')], ...stmt('motion_blocks', 'Walk, swim or fly forward this many metres (negative = backwards).') },
  { type: 'dd_turn_right', message0: 'turn ↻ %1 degrees', args0: [N('DEG')], ...stmt('motion_blocks', 'Turn clockwise (seen from above).') },
  { type: 'dd_turn_left', message0: 'turn ↺ %1 degrees', args0: [N('DEG')], ...stmt('motion_blocks', 'Turn anticlockwise (seen from above).') },
  { type: 'dd_point_dir', message0: 'point in direction %1', args0: [N('DIR')], ...stmt('motion_blocks', 'Compass direction: 0 = back (north), 90 = right (east), 180 = front, 270 = left.') },
  { type: 'dd_point_towards', message0: 'point towards %1', args0: [O('TARGET')], ...stmt('motion_blocks', 'Turn to face something.') },
  { type: 'dd_go_to', message0: 'go to %1', args0: [O('TARGET')], ...stmt('motion_blocks', 'Jump straight to a place.') },
  { type: 'dd_go_xy', message0: 'go to x: %1 y: %2', args0: [N('X'), N('Y')], ...stmt('motion_blocks', 'x = left/right, y = back/front (metres from the centre of the diorama).') },
  { type: 'dd_glide_to', message0: 'glide %1 secs to %2', args0: [N('SECS'), O('TARGET')], ...stmt('motion_blocks', 'Slide smoothly to a place.') },
  { type: 'dd_glide_xy', message0: 'glide %1 secs to x: %2 y: %3', args0: [N('SECS'), N('X'), N('Y')], ...stmt('motion_blocks', 'Slide smoothly to a spot on the map.') },
  { type: 'dd_walk_to', message0: '%1 to %2', args0: [DD('GAIT', [['walk', 'walk'], ['run', 'run']]), O('TARGET')], ...stmt('motion_blocks', 'Travel to something at a natural speed, with walking or running animation.') },
  { type: 'dd_wander', message0: 'wander for %1 secs', args0: [N('SECS')], ...stmt('motion_blocks', 'Roam around nearby like a real animal.') },
  { type: 'dd_follow', message0: 'follow %1 for %2 secs', args0: [O('TARGET'), N('SECS')], ...stmt('motion_blocks', 'Stay close behind something.') },
  { type: 'dd_flee', message0: 'run away from %1 for %2 secs', args0: [O('TARGET'), N('SECS')], ...stmt('motion_blocks', 'Escape from something!') },
  { type: 'dd_circle', message0: 'circle around %1 radius %2 for %3 secs', args0: [O('TARGET'), N('R'), N('SECS')], ...stmt('motion_blocks', 'Fly, swim or walk in a circle around something.') },
  { type: 'dd_fly_height', message0: 'fly to height %1 m', args0: [N('H')], ...stmt('motion_blocks', 'Rise or sink to a height above the ground (or water depth for swimmers).') },
  { type: 'dd_change_height', message0: 'change height by %1', args0: [N('H')], ...stmt('motion_blocks', 'Move up or down instantly.') },
  { type: 'dd_jump', message0: 'jump %1 m high', args0: [N('H')], ...stmt('motion_blocks', 'Hop up and land again.') },
  { type: 'dd_spin', message0: 'spin around %1 times', args0: [N('N')], ...stmt('motion_blocks', 'Twirl on the spot.') },
  { type: 'dd_bounce', message0: 'if on edge, bounce', ...stmt('motion_blocks', 'Turn back if you reach the edge of the diorama.') },
  { type: 'dd_x', message0: 'x position', ...rep('motion_blocks', 'Number', 'Left/right position in metres.') },
  { type: 'dd_y', message0: 'y position', ...rep('motion_blocks', 'Number', 'Back/front position in metres.') },
  { type: 'dd_height', message0: 'height above ground', ...rep('motion_blocks', 'Number', 'How high I am above the ground.') },
  { type: 'dd_direction', message0: 'direction', ...rep('motion_blocks', 'Number', 'Which way I face (compass degrees).') },

  /* ---------------- looks ---------------- */
  { type: 'dd_say_for', message0: 'say %1 for %2 seconds', args0: [T('TEXT'), N('SECS')], ...stmt('looks_blocks', 'Show a speech bubble for a while.') },
  { type: 'dd_say', message0: 'say %1', args0: [T('TEXT')], ...stmt('looks_blocks', 'Show a speech bubble (empty text hides it).') },
  { type: 'dd_think_for', message0: 'think %1 for %2 seconds', args0: [T('TEXT'), N('SECS')], ...stmt('looks_blocks', 'Show a thought bubble.') },
  { type: 'dd_show', message0: 'show', ...stmt('looks_blocks', 'Appear.') },
  { type: 'dd_hide', message0: 'hide', ...stmt('looks_blocks', 'Disappear.') },
  { type: 'dd_set_size', message0: 'set size to %1 %%', args0: [N('P')], ...stmt('looks_blocks', 'Grow or shrink (100% = normal).') },
  { type: 'dd_change_size', message0: 'change size by %1', args0: [N('P')], ...stmt('looks_blocks', 'Grow or shrink by a percentage.') },
  { type: 'dd_play_anim', message0: 'play animation %1', args0: [DD('ANIM', ANIMS)], ...stmt('looks_blocks', 'Play a body animation, if this animal has it.') },
  { type: 'dd_auto_anim', message0: 'animate automatically', ...stmt('looks_blocks', 'Go back to choosing animations by speed.') },
  { type: 'dd_set_tint', message0: 'set colour to %1', args0: [T('C')], ...stmt('looks_blocks', 'Tint the colours — great for camouflage or chameleons!') },
  { type: 'dd_clear_tint', message0: 'clear colour', ...stmt('looks_blocks', 'Back to natural colours.') },
  { type: 'dd_glow', message0: 'glow %1', args0: [T('C')], ...stmt('looks_blocks', 'Light up like a firefly or glowing fungus.') },
  { type: 'dd_glow_off', message0: 'stop glowing', ...stmt('looks_blocks', 'Turn the glow off.') },
  { type: 'dd_ghost', message0: 'set see-through to %1 %%', args0: [N('P')], ...stmt('looks_blocks', '0% = solid, 100% = invisible.') },
  { type: 'dd_set_label', message0: 'set label to %1', args0: [T('TEXT')], ...stmt('looks_blocks', 'Change the text on my toothpick flag.') },

  /* ---------------- sound ---------------- */
  { type: 'dd_sound', message0: 'play sound %1', args0: [DD('S', SOUNDS)], ...stmt('sound_blocks', 'Start a sound.') },
  { type: 'dd_sound_wait', message0: 'play sound %1 until done', args0: [DD('S', SOUNDS)], ...stmt('sound_blocks', 'Play a sound and wait for it to finish.') },
  { type: 'dd_animal_call', message0: 'make my animal sound', ...stmt('sound_blocks', 'A call that fits this species.') },
  { type: 'dd_speak', message0: 'speak %1', args0: [T('TEXT')], ...stmt('sound_blocks', 'Read text out loud.') },
  { type: 'dd_volume', message0: 'set volume to %1 %%', args0: [N('P')], ...stmt('sound_blocks', 'How loud sounds are.') },

  /* ---------------- control ---------------- */
  { type: 'dd_wait', message0: 'wait %1 seconds', args0: [N('SECS')], ...stmt('control_blocks', 'Pause this script.') },
  { type: 'dd_repeat', message0: 'repeat %1', args0: [N('TIMES')], message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }], ...stmt('control_blocks', 'Do the blocks inside several times.') },
  { type: 'dd_forever', message0: 'forever', message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }], previousStatement: null, style: 'control_blocks', tooltip: 'Keep doing the blocks inside until Stop.' },
  { type: 'dd_if', message0: 'if %1 then', args0: [B('COND')], message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }], ...stmt('control_blocks', 'Only run the blocks inside if the condition is true.') },
  { type: 'dd_if_else', message0: 'if %1 then', args0: [B('COND')], message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }], message2: 'else %1', args2: [{ type: 'input_statement', name: 'ELSE' }], ...stmt('control_blocks', 'Choose between two sets of blocks.') },
  { type: 'dd_wait_until', message0: 'wait until %1', args0: [B('COND')], ...stmt('control_blocks', 'Pause until the condition is true.') },
  { type: 'dd_repeat_until', message0: 'repeat until %1', args0: [B('COND')], message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }], ...stmt('control_blocks', 'Keep repeating until the condition is true.') },
  { type: 'dd_stop', message0: 'stop %1', args0: [DD('WHAT', [['all', 'all'], ['this script', 'this'], ['my other scripts', 'other']])], previousStatement: null, style: 'control_blocks', tooltip: 'Stop scripts.' },
  { type: 'dd_when_clone', message0: 'when I start as a clone', nextStatement: null, style: 'control_blocks', tooltip: 'Runs in each new clone.' },
  { type: 'dd_clone', message0: 'create clone of %1', args0: [O('TARGET')], ...stmt('control_blocks', 'Make a copy that runs its own scripts.') },
  { type: 'dd_delete_clone', message0: 'delete this clone', previousStatement: null, style: 'control_blocks', tooltip: 'Remove this copy.' },

  /* ---------------- sensing ---------------- */
  { type: 'dd_touching', message0: 'touching %1 ?', args0: [O('TARGET')], ...rep('sensing_blocks', 'Boolean', 'Am I bumping into it?') },
  { type: 'dd_distance', message0: 'distance to %1', args0: [O('TARGET')], ...rep('sensing_blocks', 'Number', 'How far away it is in metres.') },
  { type: 'dd_ask', message0: 'ask %1 and wait', args0: [T('TEXT')], ...stmt('sensing_blocks', 'Ask the player a question. Their reply goes into “answer”.') },
  { type: 'dd_answer', message0: 'answer', ...rep('sensing_blocks', null as unknown as string, 'The last reply typed by the player.') },
  { type: 'dd_key_pressed', message0: 'key %1 pressed?', args0: [DD('KEY', KEYS)], ...rep('sensing_blocks', 'Boolean', 'Is this key held down?') },
  { type: 'dd_is_night', message0: 'is it night?', ...rep('sensing_blocks', 'Boolean', 'True after sunset.') },
  { type: 'dd_time_of_day', message0: 'time of day', ...rep('sensing_blocks', 'Number', 'Hours, 0–24.') },
  { type: 'dd_in_water', message0: 'in water?', ...rep('sensing_blocks', 'Boolean', 'Am I standing or swimming in water?') },
  { type: 'dd_timer', message0: 'timer', ...rep('sensing_blocks', 'Number', 'Seconds since Play (or reset).') },
  { type: 'dd_reset_timer', message0: 'reset timer', ...stmt('sensing_blocks', 'Set the timer back to 0.') },
  { type: 'dd_my_name', message0: 'my name', ...rep('sensing_blocks', 'String', 'This object’s name.') },
  { type: 'dd_prop_of', message0: '%1 of %2', args0: [DD('PROP', [['x position', 'x'], ['y position', 'y'], ['height', 'height'], ['direction', 'dir'], ['size', 'size'], ['name', 'name'], ['energy', 'energy']]), O('TARGET')], ...rep('sensing_blocks', null as unknown as string, 'Look up something about another object.') },
  { type: 'dd_nearest', message0: 'nearest %1', args0: [DD('KIND', [['animal', 'animal'], ['plant', 'plant'], ['food', 'food'], ['predator', 'predator'], ['same kind', 'same']])], ...rep('sensing_blocks', 'Object', 'Find the closest thing of a kind.') },

  /* ---------------- world ---------------- */
  { type: 'dd_set_time', message0: 'set time of day to %1 o’clock', args0: [N('H')], ...stmt('world_blocks', '0–24 hours. 6 = sunrise, 12 = noon, 19 = sunset.') },
  { type: 'dd_change_time', message0: 'change time by %1 hours', args0: [N('H')], ...stmt('world_blocks', 'Move the clock forward or back.') },
  { type: 'dd_day_cycle', message0: 'day–night cycle speed %1', args0: [N('S')], ...stmt('world_blocks', 'Game hours per real minute. 0 stops the clock.') },
  { type: 'dd_weather', message0: 'set weather to %1', args0: [DD('W', WEATHER)], ...stmt('world_blocks', 'Change the weather.') },
  { type: 'dd_season', message0: 'set season to %1', args0: [DD('S', SEASONS)], ...stmt('world_blocks', 'Change the season.') },
  { type: 'dd_fog', message0: 'set fog to %1 %%', args0: [N('P')], ...stmt('world_blocks', 'Misty or clear.') },
  { type: 'dd_wind', message0: 'set wind to %1 %%', args0: [N('P')], ...stmt('world_blocks', 'How hard the grass and trees sway.') },
  { type: 'dd_water_level', message0: 'set water level to %1 m', args0: [N('H')], ...stmt('world_blocks', 'Flood or drain the land (sculpted terrain only).') },
  { type: 'dd_caption', message0: 'show caption %1 for %2 secs', args0: [T('TEXT'), N('SECS')], ...stmt('world_blocks', 'Big subtitle across the screen — great for presentations.') },
  { type: 'dd_cam_look', message0: 'camera look at %1', args0: [O('TARGET')], ...stmt('world_blocks', 'Point the camera at something.') },
  { type: 'dd_cam_follow', message0: 'camera follow %1', args0: [O('TARGET')], ...stmt('world_blocks', 'Keep the camera with something as it moves.') },
  { type: 'dd_cam_overview', message0: 'camera show whole diorama', ...stmt('world_blocks', 'Zoom back out.') },
  { type: 'dd_spawn', message0: 'add a new %1 at %2', args0: [T('SPECIES'), O('TARGET')], ...stmt('world_blocks', 'Bring a new plant or animal into the diorama (while playing).') },
  { type: 'dd_set_shared', message0: 'set shared %1 to %2', args0: [{ type: 'field_input', name: 'NAME', text: 'score' }, T('V')], ...stmt('world_blocks', 'A value every object can read.') },
  { type: 'dd_change_shared', message0: 'change shared %1 by %2', args0: [{ type: 'field_input', name: 'NAME', text: 'score' }, N('V')], ...stmt('world_blocks', 'Add to a shared value.') },
  { type: 'dd_get_shared', message0: 'shared %1', args0: [{ type: 'field_input', name: 'NAME', text: 'score' }], ...rep('world_blocks', null as unknown as string, 'Read a shared value.') },

  /* ---------------- ecosystem ---------------- */
  { type: 'dd_eat', message0: 'eat %1', args0: [O('TARGET')], ...stmt('eco_blocks', 'Go to the food and eat it (plants shrink, animals disappear while playing).') },
  { type: 'dd_nearest_food', message0: 'nearest food', ...rep('eco_blocks', 'Object', 'The closest thing I eat (from the food web).') },
  { type: 'dd_nearest_predator', message0: 'nearest predator', ...rep('eco_blocks', 'Object', 'The closest thing that eats me.') },
  { type: 'dd_predator_near', message0: 'predator within %1 m?', args0: [N('D')], ...rep('eco_blocks', 'Boolean', 'Is something that eats me close by?') },
  { type: 'dd_energy', message0: 'energy', ...rep('eco_blocks', 'Number', 'My energy, 0–100. It drops as I move.') },
  { type: 'dd_change_energy', message0: 'change energy by %1', args0: [N('E')], ...stmt('eco_blocks', 'Gain or lose energy.') },
  { type: 'dd_grow', message0: 'grow by %1 %%', args0: [N('P')], ...stmt('eco_blocks', 'Slowly get bigger, like a growing plant.') },
  { type: 'dd_baby', message0: 'have a baby', ...stmt('eco_blocks', 'A young copy appears and grows up.') },
  { type: 'dd_sleep', message0: 'sleep for %1 secs', args0: [N('SECS')], ...stmt('eco_blocks', 'Rest — zzz!') },
];
Blockly.common.defineBlocksWithJsonArray(defs as object[]);
// the touch hat needs a live object menu, so it is defined in code

Blockly.Blocks['dd_when_touch'] = {
  init(this: Blockly.Block) {
    this.appendDummyInput().appendField('when I touch').appendField(dyn(objOpts([['✨ anything', '@any']])), 'OBJ');
    this.setNextStatement(true);
    this.setStyle('events_blocks');
    this.setTooltip('Runs when I bump into something.');
  },
};
// joint / parameter menus read the selected object
for (const [type, label, field, gen, tail] of [
  ['dd_set_joint', 'turn joint', 'JOINT', () => codeContext.joints().map((j): Opt => [j, j]), 'deg'],
  ['dd_relax_joint', 'relax joint', 'JOINT', () => codeContext.joints().map((j): Opt => [j, j]), ''],
] as const) {
  Blockly.Blocks[type] = {
    init(this: Blockly.Block) {
      const inp = this.appendDummyInput().appendField(label).appendField(dyn(gen), field);
      void inp;
      if (tail === 'deg') { this.appendValueInput('DEG').setCheck('Number').appendField('to'); this.appendDummyInput().appendField('°'); }
      this.setPreviousStatement(true); this.setNextStatement(true); this.setInputsInline(true);
      this.setStyle('looks_blocks');
      this.setTooltip('Pose a body part. Works on rigged animals (head, tail, jaw, wings, legs).');
    },
  };
}
Blockly.Blocks['dd_set_param'] = {
  init(this: Blockly.Block) {
    this.appendDummyInput().appendField('set').appendField(dyn(() => codeContext.params().map((p): Opt => [p.label, p.key])), 'PARAM');
    this.appendValueInput('V').appendField('to');
    this.setPreviousStatement(true); this.setNextStatement(true); this.setInputsInline(true);
    this.setStyle('looks_blocks');
    this.setTooltip('Change one of my design settings, e.g. coral bleaching or lake size (rebuilds the model).');
  },
};

/* ======================= JavaScript generators ======================= */
const G = javascriptGenerator;
const v = (b: Blockly.Block, name: string, order = Order.NONE, dflt = '0') => G.valueToCode(b, name, order) || dflt;
const vs = (b: Blockly.Block, name: string) => G.valueToCode(b, name, Order.NONE) || "''";
const vo = (b: Blockly.Block, name: string) => G.valueToCode(b, name, Order.NONE) || "'@self'";
const q = (s: string) => G.quote_(s);
const body = (b: Blockly.Block, name: string) => G.statementToCode(b, name);
const S = (code: string) => code + '\n';
const F = G.forBlock;

for (const t of ['dd_obj', 'dd_obj_self', 'dd_obj_any']) F[t] = (b) => [q(b.getFieldValue('OBJ') || '@self'), Order.ATOMIC];
F['dd_color'] = (b) => [q(b.getFieldValue('C') || 'green'), Order.ATOMIC];
F['dd_species'] = (b) => [q(b.getFieldValue('S') || ''), Order.ATOMIC];
// hats generate nothing themselves: the compiler wraps the stack beneath them
for (const t of ['dd_when_start', 'dd_when_tapped', 'dd_when_key', 'dd_when_receive', 'dd_when_every', 'dd_when_time', 'dd_when_touch', 'dd_when_clone']) F[t] = () => '';

F['dd_broadcast'] = (b) => S(`api.broadcast(${q(b.getFieldValue('MSG'))});`);
F['dd_broadcast_wait'] = (b) => S(`await api.broadcastWait(${q(b.getFieldValue('MSG'))});`);
F['dd_move'] = (b) => S(`await api.move(${v(b, 'DIST')});`);
F['dd_turn_right'] = (b) => S(`await api.turn(${v(b, 'DEG')});`);
F['dd_turn_left'] = (b) => S(`await api.turn(-(${v(b, 'DEG')}));`);
F['dd_point_dir'] = (b) => S(`api.pointDir(${v(b, 'DIR')});`);
F['dd_point_towards'] = (b) => S(`api.pointTowards(${vo(b, 'TARGET')});`);
F['dd_go_to'] = (b) => S(`api.goTo(${vo(b, 'TARGET')});`);
F['dd_go_xy'] = (b) => S(`api.goXY(${v(b, 'X')}, ${v(b, 'Y')});`);
F['dd_glide_to'] = (b) => S(`await api.glideTo(${v(b, 'SECS')}, ${vo(b, 'TARGET')});`);
F['dd_glide_xy'] = (b) => S(`await api.glideXY(${v(b, 'SECS')}, ${v(b, 'X')}, ${v(b, 'Y')});`);
F['dd_walk_to'] = (b) => S(`await api.walkTo(${vo(b, 'TARGET')}, ${q(b.getFieldValue('GAIT'))});`);
F['dd_wander'] = (b) => S(`await api.wander(${v(b, 'SECS')});`);
F['dd_follow'] = (b) => S(`await api.follow(${vo(b, 'TARGET')}, ${v(b, 'SECS')});`);
F['dd_flee'] = (b) => S(`await api.flee(${vo(b, 'TARGET')}, ${v(b, 'SECS')});`);
F['dd_circle'] = (b) => S(`await api.circle(${vo(b, 'TARGET')}, ${v(b, 'R')}, ${v(b, 'SECS')});`);
F['dd_fly_height'] = (b) => S(`await api.flyTo(${v(b, 'H')});`);
F['dd_change_height'] = (b) => S(`api.changeHeight(${v(b, 'H')});`);
F['dd_jump'] = (b) => S(`await api.jump(${v(b, 'H')});`);
F['dd_spin'] = (b) => S(`await api.spin(${v(b, 'N')});`);
F['dd_bounce'] = () => S(`api.bounce();`);
F['dd_x'] = () => ['api.x()', Order.FUNCTION_CALL];
F['dd_y'] = () => ['api.y()', Order.FUNCTION_CALL];
F['dd_height'] = () => ['api.height()', Order.FUNCTION_CALL];
F['dd_direction'] = () => ['api.direction()', Order.FUNCTION_CALL];

F['dd_say_for'] = (b) => S(`await api.sayFor(${vs(b, 'TEXT')}, ${v(b, 'SECS')});`);
F['dd_say'] = (b) => S(`api.say(${vs(b, 'TEXT')});`);
F['dd_think_for'] = (b) => S(`await api.sayFor(${vs(b, 'TEXT')}, ${v(b, 'SECS')}, true);`);
F['dd_show'] = () => S('api.show();');
F['dd_hide'] = () => S('api.hide();');
F['dd_set_size'] = (b) => S(`api.setSize(${v(b, 'P')});`);
F['dd_change_size'] = (b) => S(`api.changeSize(${v(b, 'P')});`);
F['dd_play_anim'] = (b) => S(`api.playAnim(${q(b.getFieldValue('ANIM'))});`);
F['dd_auto_anim'] = () => S('api.autoAnim();');
F['dd_set_tint'] = (b) => S(`api.tint(${v(b, 'C', Order.NONE, "'green'")});`);
F['dd_clear_tint'] = () => S('api.tint(null);');
F['dd_glow'] = (b) => S(`api.glow(${v(b, 'C', Order.NONE, "'yellow'")});`);
F['dd_glow_off'] = () => S('api.glow(null);');
F['dd_ghost'] = (b) => S(`api.ghost(${v(b, 'P')});`);
F['dd_set_joint'] = (b) => S(`api.setJoint(${q(b.getFieldValue('JOINT'))}, ${v(b, 'DEG')});`);
F['dd_relax_joint'] = (b) => S(`api.setJoint(${q(b.getFieldValue('JOINT'))}, null);`);
F['dd_set_label'] = (b) => S(`api.setLabel(${vs(b, 'TEXT')});`);
F['dd_set_param'] = (b) => S(`await api.setParam(${q(b.getFieldValue('PARAM'))}, ${v(b, 'V')});`);

F['dd_sound'] = (b) => S(`api.sound(${q(b.getFieldValue('S'))});`);
F['dd_sound_wait'] = (b) => S(`await api.soundWait(${q(b.getFieldValue('S'))});`);
F['dd_animal_call'] = () => S('await api.animalCall();');
F['dd_speak'] = (b) => S(`await api.speak(${vs(b, 'TEXT')});`);
F['dd_volume'] = (b) => S(`api.volume(${v(b, 'P')});`);

F['dd_wait'] = (b) => S(`await api.wait(${v(b, 'SECS')});`);
F['dd_repeat'] = (b) => {
  const i = G.nameDB_!.getDistinctName('i', Blockly.Names.NameType.VARIABLE);
  return `for (let ${i} = 0, n${i} = Number(${v(b, 'TIMES')}) || 0; ${i} < n${i}; ${i}++) {\n${body(b, 'DO')}  await api.tick();\n}\n`;
};
F['dd_forever'] = (b) => `while (true) {\n${body(b, 'DO')}  await api.tick();\n}\n`;
F['dd_if'] = (b) => `if (${v(b, 'COND', Order.NONE, 'false')}) {\n${body(b, 'DO')}}\n`;
F['dd_if_else'] = (b) => `if (${v(b, 'COND', Order.NONE, 'false')}) {\n${body(b, 'DO')}} else {\n${body(b, 'ELSE')}}\n`;
F['dd_wait_until'] = (b) => `while (!(${v(b, 'COND', Order.NONE, 'false')})) { await api.frame(); }\n`;
F['dd_repeat_until'] = (b) => `while (!(${v(b, 'COND', Order.NONE, 'false')})) {\n${body(b, 'DO')}  await api.tick();\n}\n`;
F['dd_stop'] = (b) => S(`await api.stop(${q(b.getFieldValue('WHAT'))});`);
F['dd_clone'] = (b) => S(`await api.clone(${vo(b, 'TARGET')});`);
F['dd_delete_clone'] = () => S('await api.deleteClone();');

F['dd_touching'] = (b) => [`api.touching(${vo(b, 'TARGET')})`, Order.FUNCTION_CALL];
F['dd_distance'] = (b) => [`api.distanceTo(${vo(b, 'TARGET')})`, Order.FUNCTION_CALL];
F['dd_ask'] = (b) => S(`await api.ask(${vs(b, 'TEXT')});`);
F['dd_answer'] = () => ['api.answer()', Order.FUNCTION_CALL];
F['dd_key_pressed'] = (b) => [`api.keyPressed(${q(b.getFieldValue('KEY'))})`, Order.FUNCTION_CALL];
F['dd_is_night'] = () => ['api.isNight()', Order.FUNCTION_CALL];
F['dd_time_of_day'] = () => ['api.timeOfDay()', Order.FUNCTION_CALL];
F['dd_in_water'] = () => ['api.inWater()', Order.FUNCTION_CALL];
F['dd_timer'] = () => ['api.timer()', Order.FUNCTION_CALL];
F['dd_reset_timer'] = () => S('api.resetTimer();');
F['dd_my_name'] = () => ['api.myName()', Order.FUNCTION_CALL];
F['dd_prop_of'] = (b) => [`api.propOf(${q(b.getFieldValue('PROP'))}, ${vo(b, 'TARGET')})`, Order.FUNCTION_CALL];
F['dd_nearest'] = (b) => [`api.nearest(${q(b.getFieldValue('KIND'))})`, Order.FUNCTION_CALL];

F['dd_set_time'] = (b) => S(`api.setTime(${v(b, 'H')});`);
F['dd_change_time'] = (b) => S(`api.changeTime(${v(b, 'H')});`);
F['dd_day_cycle'] = (b) => S(`api.dayCycle(${v(b, 'S')});`);
F['dd_weather'] = (b) => S(`api.weather(${q(b.getFieldValue('W'))});`);
F['dd_season'] = (b) => S(`api.season(${q(b.getFieldValue('S'))});`);
F['dd_fog'] = (b) => S(`api.fog(${v(b, 'P')});`);
F['dd_wind'] = (b) => S(`api.wind(${v(b, 'P')});`);
F['dd_water_level'] = (b) => S(`api.waterLevel(${v(b, 'H')});`);
F['dd_caption'] = (b) => S(`api.caption(${vs(b, 'TEXT')}, ${v(b, 'SECS')});`);
F['dd_cam_look'] = (b) => S(`api.cameraLook(${vo(b, 'TARGET')});`);
F['dd_cam_follow'] = (b) => S(`api.cameraFollow(${vo(b, 'TARGET')});`);
F['dd_cam_overview'] = () => S('api.cameraOverview();');
F['dd_spawn'] = (b) => S(`await api.spawn(${vs(b, 'SPECIES')}, ${vo(b, 'TARGET')});`);
F['dd_set_shared'] = (b) => S(`api.setShared(${q(b.getFieldValue('NAME'))}, ${v(b, 'V')});`);
F['dd_change_shared'] = (b) => S(`api.changeShared(${q(b.getFieldValue('NAME'))}, ${v(b, 'V')});`);
F['dd_get_shared'] = (b) => [`api.getShared(${q(b.getFieldValue('NAME'))})`, Order.FUNCTION_CALL];

F['dd_eat'] = (b) => S(`await api.eat(${vo(b, 'TARGET')});`);
F['dd_nearest_food'] = () => ["api.nearest('food')", Order.FUNCTION_CALL];
F['dd_nearest_predator'] = () => ["api.nearest('predator')", Order.FUNCTION_CALL];
F['dd_predator_near'] = (b) => [`api.predatorNear(${v(b, 'D')})`, Order.FUNCTION_CALL];
F['dd_energy'] = () => ['api.energy()', Order.FUNCTION_CALL];
F['dd_change_energy'] = (b) => S(`api.changeEnergy(${v(b, 'E')});`);
F['dd_grow'] = (b) => S(`await api.grow(${v(b, 'P')});`);
F['dd_baby'] = () => S('await api.baby();');
F['dd_sleep'] = (b) => S(`await api.sleep(${v(b, 'SECS')});`);

/* ---- async procedures ("My Blocks") ---- */
F['procedures_defreturn'] = function (block: Blockly.Block, gen: typeof G) {
  const name = gen.getProcedureName(block.getFieldValue('NAME'));
  let branch = block.getInput('STACK') ? gen.statementToCode(block, 'STACK') : '';
  if (gen.STATEMENT_PREFIX) branch = gen.prefixLines(gen.injectId(gen.STATEMENT_PREFIX, block), gen.INDENT) + branch;
  let ret = block.getInput('RETURN') ? gen.valueToCode(block, 'RETURN', Order.NONE) || '' : '';
  if (ret) ret = gen.INDENT + 'return ' + ret + ';\n';
  const args = (block as Blockly.Block & { getVars(): string[] }).getVars().map((id: string) => gen.getVariableName(id));
  let code = `async function ${name}(${['api', ...args].join(', ')}) {\n${branch}${ret}}`;
  code = gen.scrub_(block, code);
  (gen as unknown as { definitions_: Record<string, string> }).definitions_['%' + name] = code;
  return null;
} as never;
F['procedures_defnoreturn'] = F['procedures_defreturn'];
F['procedures_callreturn'] = function (block: Blockly.Block, gen: typeof G) {
  const name = gen.getProcedureName(block.getFieldValue('NAME'));
  const args = (block as Blockly.Block & { getVars(): string[] }).getVars().map((_: string, i: number) => gen.valueToCode(block, 'ARG' + i, Order.NONE) || 'null');
  return [`(await ${name}(${['api', ...args].join(', ')}))`, Order.AWAIT];
} as never;
F['procedures_callnoreturn'] = function (block: Blockly.Block, gen: typeof G) {
  const name = gen.getProcedureName(block.getFieldValue('NAME'));
  const args = (block as Blockly.Block & { getVars(): string[] }).getVars().map((_: string, i: number) => gen.valueToCode(block, 'ARG' + i, Order.NONE) || 'null');
  return `await ${name}(${['api', ...args].join(', ')});\n`;
} as never;

export const HAT_TYPES = new Set(['dd_when_start', 'dd_when_tapped', 'dd_when_key', 'dd_when_receive', 'dd_when_every', 'dd_when_time', 'dd_when_touch', 'dd_when_clone']);
export { COLORS };
