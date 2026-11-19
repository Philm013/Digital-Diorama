import * as Blockly from 'blockly';

export const CAT = {
  events: '#FFBF00', motion: '#4C97FF', looks: '#9966FF', sound: '#CF63CF', control: '#FFAB19', sensing: '#5CB1D6',
  operators: '#59C059', variables: '#FF8C1A', myblocks: '#FF6680', world: '#0FBD8C', eco: '#2E9E6E',
} as const;

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
  return '#' + f((n >> 16) & 255) + f((n >> 8) & 255) + f(n & 255);
};
const style = (c: string) => ({ colourPrimary: c, colourSecondary: shade(c, 0.88), colourTertiary: shade(c, 0.72) });

export const dioramaTheme = Blockly.Theme.defineTheme('diorama', {
  name: 'diorama',
  base: Blockly.Themes.Classic,
  startHats: true,
  blockStyles: {
    events_blocks: style(CAT.events), motion_blocks: style(CAT.motion), looks_blocks: style(CAT.looks), sound_blocks: style(CAT.sound),
    control_blocks: style(CAT.control), sensing_blocks: style(CAT.sensing), operators_blocks: style(CAT.operators),
    world_blocks: style(CAT.world), eco_blocks: style(CAT.eco), variable_blocks: style(CAT.variables), variable_dynamic_blocks: style(CAT.variables),
    procedure_blocks: style(CAT.myblocks), logic_blocks: style(CAT.operators), math_blocks: style(CAT.operators), text_blocks: style(CAT.operators),
    loop_blocks: style(CAT.control), list_blocks: style('#FF661A'), colour_blocks: style(CAT.looks),
  },
  categoryStyles: {
    events: { colour: CAT.events }, motion: { colour: CAT.motion }, looks: { colour: CAT.looks }, sound: { colour: CAT.sound },
    control: { colour: CAT.control }, sensing: { colour: CAT.sensing }, operators: { colour: CAT.operators }, variables: { colour: CAT.variables },
    myblocks: { colour: CAT.myblocks }, world: { colour: CAT.world }, eco: { colour: CAT.eco },
  },
  componentStyles: {
    workspaceBackgroundColour: '#f6f3ec',
    toolboxBackgroundColour: '#ffffff',
    toolboxForegroundColour: '#3b3328',
    flyoutBackgroundColour: '#efeae0',
    flyoutForegroundColour: '#3b3328',
    flyoutOpacity: 0.97,
    scrollbarColour: '#c9bfae',
    scrollbarOpacity: 0.7,
    insertionMarkerColour: '#2b2620',
    insertionMarkerOpacity: 0.3,
    cursorColour: '#d0d0d0',
  },
  fontStyle: { family: 'Nunito, "Helvetica Neue", Arial, sans-serif', weight: '700', size: 12 },
});
