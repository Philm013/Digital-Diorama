const num = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
const txt = (t: string) => ({ shadow: { type: 'text', fields: { TEXT: t } } });
const obj = (type = 'dd_obj', v = '@random') => ({ shadow: { type, fields: { OBJ: v } } });
const col = (c: string) => ({ shadow: { type: 'dd_color', fields: { C: c } } });
const b = (type: string, inputs?: Record<string, unknown>, fields?: Record<string, unknown>) => ({ kind: 'block', type, ...(inputs ? { inputs } : {}), ...(fields ? { fields } : {}) });
const sep = { kind: 'sep', gap: 28 };
const label = (text: string) => ({ kind: 'label', text });

export function buildToolbox(isWorld: boolean) {
  const events = { kind: 'category', name: 'Events', categorystyle: 'events', contents: [
    b('dd_when_start'), ...(isWorld ? [] : [b('dd_when_tapped')]), b('dd_when_key'), b('dd_when_every'), b('dd_when_time'),
    ...(isWorld ? [] : [b('dd_when_touch')]), b('dd_when_receive'), sep, b('dd_broadcast'), b('dd_broadcast_wait'),
  ] };
  const motion = { kind: 'category', name: 'Motion', categorystyle: 'motion', contents: [
    b('dd_move', { DIST: num(2) }), b('dd_turn_right', { DEG: num(30) }), b('dd_turn_left', { DEG: num(30) }), sep,
    b('dd_walk_to', { TARGET: obj() }), b('dd_wander', { SECS: num(5) }), b('dd_follow', { TARGET: obj('dd_obj', '@camera'), SECS: num(5) }),
    b('dd_flee', { TARGET: obj('dd_obj', '@camera'), SECS: num(3) }), b('dd_circle', { TARGET: obj('dd_obj_self', '@self'), R: num(3), SECS: num(6) }), sep,
    b('dd_point_dir', { DIR: num(180) }), b('dd_point_towards', { TARGET: obj('dd_obj', '@camera') }), b('dd_go_to', { TARGET: obj() }),
    b('dd_go_xy', { X: num(0), Y: num(0) }), b('dd_glide_to', { SECS: num(1), TARGET: obj() }), b('dd_glide_xy', { SECS: num(1), X: num(0), Y: num(0) }), sep,
    b('dd_fly_height', { H: num(4) }), b('dd_change_height', { H: num(1) }), b('dd_jump', { H: num(1) }), b('dd_spin', { N: num(1) }), b('dd_bounce'), sep,
    b('dd_x'), b('dd_y'), b('dd_height'), b('dd_direction'),
  ] };
  const looks = { kind: 'category', name: 'Looks', categorystyle: 'looks', contents: [
    b('dd_say_for', { TEXT: txt('Hello!'), SECS: num(2) }), b('dd_say', { TEXT: txt('Hello!') }), b('dd_think_for', { TEXT: txt('Hmm…'), SECS: num(2) }), sep,
    b('dd_play_anim'), b('dd_auto_anim'), b('dd_set_joint', { DEG: num(30) }), b('dd_relax_joint'), sep,
    b('dd_set_tint', { C: col('green') }), b('dd_clear_tint'), b('dd_glow', { C: col('yellow') }), b('dd_glow_off'), b('dd_ghost', { P: num(50) }), sep,
    b('dd_set_size', { P: num(100) }), b('dd_change_size', { P: num(10) }), b('dd_show'), b('dd_hide'), sep,
    b('dd_set_label', { TEXT: txt('My label') }), b('dd_set_param', { V: num(1) }),
  ] };
  const sound = { kind: 'category', name: 'Sound', categorystyle: 'sound', contents: [
    ...(isWorld ? [] : [b('dd_animal_call')]), b('dd_sound'), b('dd_sound_wait'), b('dd_speak', { TEXT: txt('Welcome to my habitat!') }), b('dd_volume', { P: num(80) }),
  ] };
  const control = { kind: 'category', name: 'Control', categorystyle: 'control', contents: [
    b('dd_wait', { SECS: num(1) }), sep, b('dd_repeat', { TIMES: num(10) }), b('dd_forever'), sep, b('dd_if'), b('dd_if_else'), b('dd_wait_until'), b('dd_repeat_until'), sep,
    b('dd_stop'), ...(isWorld ? [] : [sep, b('dd_when_clone'), b('dd_clone', { TARGET: obj('dd_obj_self', '@self') }), b('dd_delete_clone')]),
  ] };
  const sensing = { kind: 'category', name: 'Sensing', categorystyle: 'sensing', contents: [
    ...(isWorld ? [] : [b('dd_touching', { TARGET: obj('dd_obj_any', '@any') }), b('dd_distance', { TARGET: obj('dd_obj', '@camera') }), b('dd_in_water')]),
    b('dd_nearest'), b('dd_prop_of', { TARGET: obj('dd_obj', '@camera') }), sep,
    b('dd_ask', { TEXT: txt('What do you know about this habitat?') }), b('dd_answer'), b('dd_key_pressed'), sep,
    b('dd_is_night'), b('dd_time_of_day'), b('dd_timer'), b('dd_reset_timer'), ...(isWorld ? [] : [b('dd_my_name')]),
  ] };
  const operators = { kind: 'category', name: 'Operators', categorystyle: 'operators', contents: [
    b('math_arithmetic', { A: num(1), B: num(1) }, { OP: 'ADD' }), b('math_arithmetic', { A: num(1), B: num(1) }, { OP: 'MULTIPLY' }),
    b('math_random_int', { FROM: num(1), TO: num(10) }), sep,
    b('logic_compare', { A: num(0), B: num(50) }, { OP: 'GT' }), b('logic_compare', { A: num(0), B: num(50) }, { OP: 'LT' }), b('logic_compare', { A: num(0), B: num(50) }, { OP: 'EQ' }),
    b('logic_operation', undefined, { OP: 'AND' }), b('logic_operation', undefined, { OP: 'OR' }), b('logic_negate'), b('logic_boolean'), sep,
    b('text_join'), b('text', undefined, { TEXT: 'apple' }), b('math_round', { NUM: num(3.6) }), b('math_modulo', { DIVIDEND: num(10), DIVISOR: num(3) }), b('math_number', undefined, { NUM: 0 }),
  ] };
  const world = { kind: 'category', name: 'World', categorystyle: 'world', contents: [
    label('Time & weather'), b('dd_set_time', { H: num(20) }), b('dd_change_time', { H: num(1) }), b('dd_day_cycle', { S: num(4) }),
    b('dd_weather'), b('dd_season'), b('dd_fog', { P: num(50) }), b('dd_wind', { P: num(60) }), b('dd_water_level', { H: num(0) }), sep,
    label('Camera & story'), b('dd_caption', { TEXT: txt('Welcome to the savanna!'), SECS: num(3) }), b('dd_cam_look', { TARGET: obj('dd_obj_self', '@self') }),
    b('dd_cam_follow', { TARGET: obj('dd_obj_self', '@self') }), b('dd_cam_overview'), sep,
    label('Shared values'), b('dd_set_shared', { V: num(0) }), b('dd_change_shared', { V: num(1) }), b('dd_get_shared'), sep,
    b('dd_spawn', { SPECIES: { shadow: { type: 'dd_species' } }, TARGET: obj() }),
  ] };
  const eco = { kind: 'category', name: 'Ecosystem', categorystyle: 'eco', contents: [
    b('dd_eat', { TARGET: { shadow: { type: 'dd_obj', fields: { OBJ: '@random' } }, block: { type: 'dd_nearest_food' } } }),
    b('dd_nearest_food'), b('dd_nearest_predator'), b('dd_predator_near', { D: num(5) }), sep,
    b('dd_energy'), b('dd_change_energy', { E: num(-10) }), b('dd_grow', { P: num(20) }), b('dd_baby'), b('dd_sleep', { SECS: num(4) }),
  ] };
  const variables = { kind: 'category', name: 'Variables', categorystyle: 'variables', custom: 'VARIABLE' };
  const myblocks = { kind: 'category', name: 'My Blocks', categorystyle: 'myblocks', custom: 'PROCEDURE' };
  const contents = isWorld
    ? [events, looks, sound, control, sensing, world, operators, variables, myblocks]
    : [events, motion, looks, sound, control, sensing, eco, world, operators, variables, myblocks];
  if (isWorld) looks.contents = [b('dd_set_label', { TEXT: txt('My label') })].slice(0, 0);
  return { kind: 'categoryToolbox', contents: contents.filter((c) => !('contents' in c) || (c.contents as unknown[]).length) };
}
