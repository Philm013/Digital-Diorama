export type TerrainKind = 'alpine' | 'hills' | 'desert' | 'islands' | 'canyon' | 'volcanic';
export type Tool = 'orbit' | 'raise' | 'lower' | 'smooth' | 'flatten';
export type Tab = 'terrain' | 'sculpt' | 'scene';
export type StudioParams = {
  terrainType: TerrainKind;
  size: number;
  elevation: number;
  roughness: number;
  resolution: number;
  seed: number;
  water: boolean;
  waterLevel: number;
  vegetation: boolean;
  density: number;
  rocks: boolean;
  base: boolean;
  snow: boolean;
  snowLine: number;
  colorway: 'default' | 'autumn' | 'moonstone';
  meadow?: string;
  waterTint?: string;
};
export type ProjectState = { params: StudioParams; heights: number[] | null };
export type BrushSettings = { size: number; strength: number; falloff: 'soft' | 'linear' | 'hard' };
export type ViewSettings = { night: boolean; grid: boolean; shadows: boolean; wireframe: boolean; autoRotate: boolean };
export type SceneStats = { triangles: number; meshes: number; trees: number; rocks: number; zoom: number };
export const DEFAULT_PARAMS: StudioParams = {
  terrainType: 'alpine', size: 128, elevation: 32, roughness: 0.58, resolution: 80, seed: 4829,
  water: true, waterLevel: 3.8, vegetation: true, density: 0.48, rocks: true, base: true,
  snow: true, snowLine: 0.68, colorway: 'default',
};
export const DEFAULT_VIEW: ViewSettings = { night: false, grid: true, shadows: true, wireframe: false, autoRotate: false };
export const DEFAULT_BRUSH: BrushSettings = { size: 10, strength: 0.55, falloff: 'soft' };
export const PRESETS: { id: TerrainKind; name: string; sceneName: string; description: string; settings: Partial<StudioParams> }[] = [
  { id: 'alpine', name: 'Alpine', sceneName: 'Alpine valley', description: 'Snow-dusted peaks, pine forests, and a river that finds its way.', settings: { elevation: 32, roughness: 0.58, water: true, waterLevel: 3.8, vegetation: true, density: 0.48, snow: true, colorway: 'default' } },
  { id: 'hills', name: 'Rolling hills', sceneName: 'Quiet meadows', description: 'Gentle slopes and open meadows, with a little room to breathe.', settings: { elevation: 24, roughness: 0.25, water: true, waterLevel: 3.8, vegetation: true, density: 0.27, snow: false, colorway: 'default' } },
  { id: 'desert', name: 'Desert dunes', sceneName: 'Amber dunes', description: 'Sculptural dunes and warm sand, shaped by an imagined wind.', settings: { elevation: 28, roughness: 0.2, water: false, vegetation: false, density: 0, snow: false, colorway: 'autumn' } },
  { id: 'islands', name: 'Islands', sceneName: 'Emerald islands', description: 'Small worlds of their own, surrounded by turquoise shallows.', settings: { elevation: 27, roughness: 0.45, water: true, waterLevel: 4.4, vegetation: true, density: 0.37, snow: false, colorway: 'default' } },
  { id: 'canyon', name: 'Red canyon', sceneName: 'The painted canyon', description: 'Layered sandstone and a winding river, a landscape of deep time.', settings: { elevation: 35, roughness: 0.42, water: true, waterLevel: 2.8, vegetation: false, density: 0, snow: false, colorway: 'autumn' } },
  { id: 'volcanic', name: 'Volcanic', sceneName: 'Sleeping volcano', description: 'A dramatic caldera rising from a field of dark volcanic rock.', settings: { elevation: 42, roughness: 0.64, water: false, vegetation: false, density: 0, snow: false, colorway: 'moonstone' } },
];

export function validateProject(value: unknown): { name: string; state: ProjectState } {
  if (!value || typeof value !== 'object') throw new Error('This file is not a Terra project.');
  const data = value as Record<string, unknown>;
  if (data.format !== 'terra-project' || data.version !== 1 || !data.state || typeof data.state !== 'object') throw new Error('Choose a valid Terra project (.json).');
  const state = data.state as Record<string, unknown>;
  if (!state.params || typeof state.params !== 'object') throw new Error('The project is missing terrain settings.');
  const input = state.params as Record<string, unknown>;
  const params = { ...DEFAULT_PARAMS };
  for (const key of Object.keys(DEFAULT_PARAMS) as (keyof StudioParams)[]) {
    if (input[key] !== undefined && typeof input[key] === typeof DEFAULT_PARAMS[key]) Object.assign(params, { [key]: input[key] });
  }
  for (const key of ['meadow', 'waterTint'] as const) if (typeof input[key] === 'string' && /^#[0-9a-f]{6}$/i.test(input[key])) params[key] = input[key];
  if (!PRESETS.some((preset) => preset.id === params.terrainType)) params.terrainType = 'alpine';
  if (!['default', 'autumn', 'moonstone'].includes(params.colorway)) params.colorway = 'default';
  const bounds: Partial<Record<keyof StudioParams, [number, number]>> = { size: [64, 256], elevation: [8, 64], roughness: [0, 1], seed: [1, 99999], waterLevel: [0, 16], density: [0, 1], snowLine: [0.35, 0.95] };
  for (const [key, [min, max]] of Object.entries(bounds)) {
    const current = params[key as keyof StudioParams] as number;
    Object.assign(params, { [key]: Number.isFinite(current) ? Math.min(max, Math.max(min, current)) : DEFAULT_PARAMS[key as keyof StudioParams] });
  }
  if (![40, 64, 80, 112].includes(params.resolution)) params.resolution = 80;
  const heights = state.heights;
  if (heights !== null && heights !== undefined && (!Array.isArray(heights) || heights.length !== (params.resolution + 1) ** 2 || heights.some((height) => typeof height !== 'number' || !Number.isFinite(height) || height < -3.5 || height > 100))) throw new Error('The project contains an invalid sculpted height field.');
  return { name: typeof data.name === 'string' ? data.name.slice(0, 80) || 'Untitled landscape' : 'Untitled landscape', state: { params, heights: (heights as number[] | null) || null } };
}

export function serializeProject(name: string, state: ProjectState) {
  return JSON.stringify({ format: 'terra-project', version: 1, name, updatedAt: new Date().toISOString(), state });
}

export function loadProject() {
  try { const raw = localStorage.getItem('terra-project'); if (raw) return validateProject(JSON.parse(raw)); } catch { /* Start fresh if browser storage is unavailable or outdated. */ }
  return { name: 'Untitled landscape', state: { params: { ...DEFAULT_PARAMS }, heights: null } as ProjectState };
}