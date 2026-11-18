import { ReactNode } from 'react';
import { cn } from '../utils/cn';
import { BrushMode } from '../terrain/TerrainField';
import { SkyMode } from '../terrain/WorldViewer';
import { BIOMES } from '../terrain/biomes';
import { TEMPLATES, TEMPLATE_GROUPS } from '../terrain/presets';
import { Btn, Grid2, Section, Segmented, Select, Slider, Toggle } from './ui';

export type Tool = BrushMode | 'inspect';
export type Mode = 'studio' | 'endless';

export interface AppConfig {
  templateId: string;
  seed: number;
  scale: number;
  amplitude: number;
  seaLevelPct: number;
  water: boolean;
  ridge: number;
  detail: number;
  warp: number;
  smoothing: number;
  // studio
  resolution: number;
  size: number;
  tool: Tool;
  radiusPct: number;
  strength: number;
  falloff: number;
  erosionIters: number;
  // scenery
  sky: SkyMode;
  props: number;
  propsOn: boolean;
  flatShading: boolean;
  wireframe: boolean;
  autoRotate: boolean;
  // endless
  viewRadius: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  templateId: 'realms',
  seed: 20260,
  scale: 1400,
  amplitude: 96,
  seaLevelPct: -0.06,
  water: true,
  ridge: 1.0,
  detail: 1.0,
  warp: 0.75,
  smoothing: 0.7,
  resolution: 129,
  size: 240,
  tool: 'raise',
  radiusPct: 7,
  strength: 0.35,
  falloff: 0.6,
  erosionIters: 18000,
  sky: 'day',
  props: 0.6,
  propsOn: true,
  flatShading: false,
  wireframe: false,
  autoRotate: false,
  viewRadius: 5,
};

export const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'raise', label: 'Raise', icon: '▲' },
  { id: 'lower', label: 'Lower', icon: '▼' },
  { id: 'smooth', label: 'Smooth', icon: '≈' },
  { id: 'flatten', label: 'Flatten', icon: '▤' },
  { id: 'noise', label: 'Noise', icon: '≋' },
  { id: 'sharpen', label: 'Sharpen', icon: '◆' },
  { id: 'erode', label: 'Erode', icon: '⤓' },
  { id: 'plateau', label: 'Terrace', icon: '▥' },
  { id: 'inspect', label: 'Orbit', icon: '✋' },
];

export interface Actions {
  applyTemplate: (id: string) => void;
  randomize: () => void;
  generate: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  erode: () => void;
  thermal: () => void;
  terrace: () => void;
  smooth: () => void;
  normalize: () => void;
  invert: () => void;
  scatter: () => void;
  travel: (biomeId: string) => void;
  teleportRandom: () => void;
  frameReset: () => void;
  clearCache: () => void;
  exportMjs: () => void;
  exportObj: () => void;
  exportPng: () => void;
  exportJson: () => void;
}

export const studioTabs = [
  { id: 'landscape', label: 'Landscape', icon: '🏔' },
  { id: 'shape', label: 'Shape', icon: '🎛' },
  { id: 'terrain', label: 'Tile', icon: '📐' },
  { id: 'sculpt', label: 'Sculpt', icon: '🖌' },
  { id: 'process', label: 'Erosion', icon: '🌊' },
  { id: 'scenery', label: 'Scene', icon: '🌲' },
  { id: 'export', label: 'Export', icon: '⬇' },
] as const;

export const endlessTabs = [
  { id: 'landscape', label: 'World', icon: '🌐' },
  { id: 'shape', label: 'Shape', icon: '🎛' },
  { id: 'travel', label: 'Travel', icon: '🧭' },
  { id: 'stream', label: 'Stream', icon: '🗺' },
  { id: 'scenery', label: 'Scene', icon: '🌲' },
  { id: 'export', label: 'Export', icon: '⬇' },
] as const;

export type TabId = (typeof studioTabs)[number]['id'] | (typeof endlessTabs)[number]['id'];

export function ControlPanel({
  cfg,
  set,
  actions,
  tab,
  setTab,
  mode,
  busy,
  progress,
  canUndo,
  canRedo,
  tileStats,
  worldStats,
  storage,
}: {
  cfg: AppConfig;
  set: (patch: Partial<AppConfig>) => void;
  actions: Actions;
  tab: TabId;
  setTab: (t: TabId) => void;
  mode: Mode;
  busy: boolean;
  progress: number;
  canUndo: boolean;
  canRedo: boolean;
  tileStats: { triangles: number; vertices: number; minH: number; maxH: number; fps: number };
  worldStats: {
    chunks: number; pending: number; generated: number; cached: number; saved: number;
    tris: number; fps: number; biome: string; x: number; z: number; elev: number;
  };
  storage: { chunks: number };
}) {
  const tabs = mode === 'studio' ? studioTabs : endlessTabs;
  // mobile: one tab at a time · desktop: every section stacked in the sidebar
  const show = (id: string) => (tab === id ? 'block' : 'hidden lg:block');
  const tpl = TEMPLATES.find((t) => t.id === cfg.templateId);

  return (
    <div className="flex h-full flex-col bg-slate-900">
      {/* tab rail */}
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/5 px-2 py-2 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as TabId)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-medium transition active:scale-95',
              tab === t.id ? 'bg-emerald-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-400'
            )}
          >
            <span className="text-xs leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-8">
        {/* ---------------- LANDSCAPE ---------------- */}
        <Section
          title={mode === 'studio' ? 'Landscape Template' : 'World Template'}
          hint={`${TEMPLATES.length} templates`}
          className={show('landscape')}
        >
          {TEMPLATE_GROUPS.map((g) => (
            <div key={g.id}>
              <div className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-500">{g.label}</div>
              <div className="mb-3 grid grid-cols-2 gap-1.5">
                {TEMPLATES.filter((t) => t.group === g.id).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => actions.applyTemplate(t.id)}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-left transition active:scale-[0.98]',
                      cfg.templateId === t.id
                        ? 'border-emerald-400/60 bg-emerald-500/15 text-white'
                        : 'border-white/5 bg-slate-800/50 text-slate-300'
                    )}
                  >
                    <div className="text-sm leading-none">{t.icon}</div>
                    <div className="mt-1 text-[11px] font-medium leading-tight">{t.label}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="rounded-lg bg-slate-800/60 p-2 text-[11px] leading-relaxed text-slate-400">{tpl?.blurb}</p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Slider
                label="Seed"
                value={cfg.seed}
                min={1}
                max={99999}
                step={1}
                onChange={(v) => set({ seed: Math.round(v) })}
                format={(v) => String(Math.round(v))}
              />
            </div>
            <Btn onClick={actions.randomize} className="mb-0.5" title="New random seed">
              🎲
            </Btn>
          </div>
          <Btn variant="primary" onClick={actions.generate} className="w-full">
            {mode === 'studio' ? 'Regenerate Tile' : 'Restart World'}
          </Btn>
        </Section>

        {/* ---------------- SHAPE ---------------- */}
        <Section title="Terrain Shaping" hint="world-space" className={show('shape')}>
          <Slider
            label="Biome Region Size"
            value={cfg.scale}
            min={180}
            max={4000}
            step={20}
            onChange={(v) => set({ scale: v })}
            format={(v) => `${v.toFixed(0)} m`}
          />
          <Slider
            label="Peak Height"
            value={cfg.amplitude}
            min={4}
            max={180}
            step={1}
            onChange={(v) => set({ amplitude: v })}
            format={(v) => `${v.toFixed(0)} m`}
          />
          <Slider
            label="Sea Level"
            value={cfg.seaLevelPct}
            min={-0.9}
            max={0.6}
            step={0.01}
            onChange={(v) => set({ seaLevelPct: v })}
            format={(v) => `${(v * cfg.amplitude).toFixed(1)} m`}
          />
          <Toggle label="Water" checked={cfg.water} onChange={(v) => set({ water: v })} />
          <Slider
            label="Mountain Belts"
            value={cfg.ridge}
            min={0}
            max={1.8}
            step={0.02}
            onChange={(v) => set({ ridge: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            label="Surface Detail"
            value={cfg.detail}
            min={0.3}
            max={1.8}
            step={0.02}
            onChange={(v) => set({ detail: v })}
            format={(v) => `${v.toFixed(2)}×`}
          />
          <Slider
            label="Domain Warp"
            value={cfg.warp}
            min={0}
            max={1.6}
            step={0.02}
            onChange={(v) => set({ warp: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            label="Crest Rounding"
            value={cfg.smoothing}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => set({ smoothing: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <p className="rounded-lg bg-slate-800/60 p-2 text-[11px] leading-relaxed text-slate-400">
            <span className="text-slate-200">Too spiky?</span> Raise Crest Rounding to smooth ridge crests and
            lower Surface Detail to remove high-frequency noise.
          </p>
        </Section>

        {/* ---------------- TILE (studio) ---------------- */}
        {mode === 'studio' && (
          <Section title="Tile Field" hint="real-world metres" className={show('terrain')}>
            <Select
              label="Grid Resolution"
              value={String(cfg.resolution)}
              onChange={(v) => set({ resolution: parseInt(v, 10) })}
              options={[
                { value: '65', label: '65 × 65 (fast · 8k tris)' },
                { value: '97', label: '97 × 97 (18k tris)' },
                { value: '129', label: '129 × 129 (33k tris)' },
                { value: '193', label: '193 × 193 (74k tris)' },
                { value: '257', label: '257 × 257 (131k tris)' },
              ]}
            />
            <Slider
              label="Tile Size"
              value={cfg.size}
              min={40}
              max={600}
              step={10}
              onChange={(v) => set({ size: v })}
              format={(v) => `${v.toFixed(0)} m`}
            />
            <div className="flex gap-2 pt-1">
              <Btn onClick={actions.undo} disabled={!canUndo} className="flex-1">
                ↶ Undo
              </Btn>
              <Btn onClick={actions.redo} disabled={!canRedo} className="flex-1">
                ↷ Redo
              </Btn>
              <Btn variant="danger" onClick={actions.reset}>
                Reset
              </Btn>
            </div>
          </Section>
        )}

        {/* ---------------- SCULPT (studio) ---------------- */}
        {mode === 'studio' && (
          <Section title="Sculpt Brush" hint="drag on terrain · shift inverts" className={show('sculpt')}>
            <div className="grid grid-cols-3 gap-1.5">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => set({ tool: t.id })}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2.5 text-[10px] transition active:scale-95',
                    cfg.tool === t.id
                      ? 'border-emerald-400/60 bg-emerald-500/15 text-white'
                      : 'border-white/5 bg-slate-800/50 text-slate-400'
                  )}
                >
                  <span className="text-sm leading-none">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
            <Slider
              label="Brush Radius"
              value={cfg.radiusPct}
              min={0.5}
              max={30}
              step={0.5}
              onChange={(v) => set({ radiusPct: v })}
              format={(v) => `${((v / 100) * cfg.size).toFixed(1)} m`}
            />
            <Slider
              label="Strength"
              value={cfg.strength}
              min={0.02}
              max={1}
              step={0.01}
              onChange={(v) => set({ strength: v })}
              format={(v) => `${Math.round(v * 100)}%`}
            />
            <Slider
              label="Falloff"
              value={cfg.falloff}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => set({ falloff: v })}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          </Section>
        )}

        {/* ---------------- PROCESS (studio) ---------------- */}
        {mode === 'studio' && (
          <Section title="Erosion & Processes" className={show('process')}>
            <Slider
              label="Hydraulic Droplets"
              value={cfg.erosionIters}
              min={1000}
              max={120000}
              step={1000}
              onChange={(v) => set({ erosionIters: v })}
              format={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Btn variant="primary" onClick={actions.erode} disabled={busy} className="w-full">
              {busy ? `Eroding… ${Math.round(progress * 100)}%` : 'Run Hydraulic Erosion'}
            </Btn>
            {busy && (
              <div className="h-1 w-full overflow-hidden rounded-full bg-slate-700">
                <div className="h-full bg-emerald-400 transition-all" style={{ width: `${progress * 100}%` }} />
              </div>
            )}
            <Grid2>
              <Btn onClick={actions.thermal}>Thermal Talus</Btn>
              <Btn onClick={actions.smooth}>Smooth All</Btn>
              <Btn onClick={actions.terrace}>Terrace</Btn>
              <Btn onClick={actions.normalize}>Normalize</Btn>
            </Grid2>
            <Btn onClick={actions.invert} className="w-full">
              Invert Relief
            </Btn>
          </Section>
        )}

        {/* ---------------- TRAVEL (endless) ---------------- */}
        {mode === 'endless' && (
          <Section title="Travel" hint="seamless streaming" className={show('travel')}>
            <div className="rounded-lg border border-white/5 bg-slate-800/60 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Current position</div>
              <div className="mt-1 font-mono text-xs text-emerald-300">
                x {worldStats.x.toFixed(0)}m · z {worldStats.z.toFixed(0)}m
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-300">
                <span className="rounded bg-slate-900/70 px-2 py-0.5">
                  {BIOMES.find((b) => b.id === worldStats.biome)?.icon}{' '}
                  {BIOMES.find((b) => b.id === worldStats.biome)?.label ?? worldStats.biome}
                </span>
                <span className="text-slate-500">{worldStats.elev.toFixed(1)} m</span>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Drag with two fingers (or right-drag) to pan across the world — new terrain streams in and is saved as
              you go. Tap a biome to fly to the nearest one.
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {BIOMES.filter((b) => b.id !== 'ocean' && b.id !== 'coast').map((b) => (
                <button
                  key={b.id}
                  onClick={() => actions.travel(b.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-slate-800/50 px-2 py-2 text-left text-[11px] text-slate-300 transition active:scale-[0.98] hover:bg-slate-800"
                >
                  <span>{b.icon}</span>
                  {b.label}
                </button>
              ))}
            </div>
            <Grid2>
              <Btn onClick={actions.teleportRandom}>🎲 Random Drop</Btn>
              <Btn onClick={actions.frameReset}>⌂ Origin</Btn>
            </Grid2>
          </Section>
        )}

        {/* ---------------- STREAM (endless) ---------------- */}
        {mode === 'endless' && (
          <Section title="Streaming & Storage" className={show('stream')}>
            <Slider
              label="View Distance"
              value={cfg.viewRadius}
              min={2}
              max={8}
              step={1}
              onChange={(v) => set({ viewRadius: v })}
              format={(v) => `${(v * 160).toFixed(0)} m`}
            />
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Live Chunks" value={String(worldStats.chunks)} />
              <Stat label="Queued" value={String(worldStats.pending)} />
              <Stat label="Generated" value={String(worldStats.generated)} />
              <Stat label="From Cache" value={String(worldStats.cached)} />
              <Stat label="Saved (IDB)" value={String(storage.chunks)} />
              <Stat label="Triangles" value={`${(worldStats.tris / 1000).toFixed(0)}k`} />
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Every chunk you visit is written to IndexedDB, so revisiting is instant and offline-friendly.
            </p>
            <Btn variant="danger" onClick={actions.clearCache} className="w-full">
              Clear Saved World Cache
            </Btn>
          </Section>
        )}

        {/* ---------------- SCENERY ---------------- */}
        <Section title="Scenery & Lighting" className={show('scenery')}>
          <Segmented
            value={cfg.sky}
            onChange={(v) => set({ sky: v })}
            options={[
              { value: 'day', label: 'Day', icon: '☀' },
              { value: 'dusk', label: 'Dusk', icon: '🌇' },
              { value: 'night', label: 'Night', icon: '🌙' },
            ]}
          />
          <Toggle label="Trees & Rocks" checked={cfg.propsOn} onChange={(v) => set({ propsOn: v })} />
          <Slider
            label="Prop Density"
            value={cfg.props}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => set({ props: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          {mode === 'studio' && (
            <Btn onClick={actions.scatter} className="w-full">
              Rescatter Props
            </Btn>
          )}
          <Grid2>
            <Toggle label="Low-poly Facets" checked={cfg.flatShading} onChange={(v) => set({ flatShading: v })} />
            <Toggle label="Wireframe" checked={cfg.wireframe} onChange={(v) => set({ wireframe: v })} />
          </Grid2>
          <Toggle label="Auto Orbit" checked={cfg.autoRotate} onChange={(v) => set({ autoRotate: v })} />
        </Section>

        {/* ---------------- EXPORT ---------------- */}
        <Section title="Export" hint="zero dependencies" className={show('export')}>
          <Grid2>
            <Btn variant="primary" onClick={actions.exportMjs}>
              ⬇ .mjs Asset
            </Btn>
            <Btn onClick={actions.exportObj}>⬇ .obj Mesh</Btn>
            <Btn onClick={actions.exportPng}>⬇ Heightmap.png</Btn>
            <Btn onClick={actions.exportJson}>⬇ .json Field</Btn>
          </Grid2>
          <p className="text-[11px] leading-relaxed text-slate-500">
            The <span className="text-slate-300">.mjs</span> export is a complete standalone three.js module with
            baked terrain data, colourways, parametric rebuild helpers, animation rig and night lighting.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {mode === 'studio' ? (
              <>
                <Stat label="Triangles" value={tileStats.triangles.toLocaleString()} />
                <Stat label="Vertices" value={tileStats.vertices.toLocaleString()} />
                <Stat label="Min Height" value={`${tileStats.minH.toFixed(1)} m`} />
                <Stat label="Max Height" value={`${tileStats.maxH.toFixed(1)} m`} />
                <Stat label="Relief" value={`${(tileStats.maxH - tileStats.minH).toFixed(1)} m`} />
                <Stat label="FPS" value={String(tileStats.fps)} />
              </>
            ) : (
              <>
                <Stat label="FPS" value={String(worldStats.fps)} />
                <Stat label="Chunks" value={String(worldStats.chunks)} />
                <Stat label="Triangles" value={`${(worldStats.tris / 1000).toFixed(0)}k`} />
                <Stat label="Region" value={`${cfg.scale.toFixed(0)} m`} />
              </>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-slate-800/50 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono text-xs text-emerald-300">{value}</div>
    </div>
  );
}

export function IconButton({ children, onClick, title, active }: { children: ReactNode; onClick?: () => void; title?: string; active?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        'flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-xs font-medium transition active:scale-95',
        active
          ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
          : 'border-white/10 bg-slate-800/70 text-slate-300'
      )}
    >
      {children}
    </button>
  );
}
