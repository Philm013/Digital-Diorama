/** Live data the block menus read from (set by the code panel / runtime). */
export interface CodeContext {
  objects: () => { id: string; name: string; emoji: string }[];
  joints: () => string[];
  clips: () => string[];
  params: () => { key: string; label: string }[];
  species: () => { id: string; name: string }[];
  isWorld: () => boolean;
}
export const codeContext: CodeContext = {
  objects: () => [],
  joints: () => [],
  clips: () => [],
  params: () => [],
  species: () => [],
  isWorld: () => false,
};

export const COLORS: Record<string, string> = {
  red: '#e8453c', orange: '#f28c28', yellow: '#f7d038', green: '#4caf50', blue: '#3b82f6', purple: '#8e5cd9',
  pink: '#ff7eb6', white: '#ffffff', black: '#202020', brown: '#8b5a2b', gold: '#e2b13c', grey: '#9aa0a6',
};
export const COLOR_EMOJI: Record<string, string> = {
  red: '🟥', orange: '🟧', yellow: '🟨', green: '🟩', blue: '🟦', purple: '🟪', pink: '🩷', white: '⬜', black: '⬛', brown: '🟫', gold: '🌟', grey: '🩶',
};
