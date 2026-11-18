import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TerrainField } from './terrain/TerrainField';
import { TerrainViewer, ViewerStats } from './terrain/TerrainViewer';
import { WorldViewer, WorldStats } from './terrain/WorldViewer';
import { WorldSampler } from './terrain/world';
import { TEMPLATE_BY_ID } from './terrain/presets';
import { CHUNK_M, idbClear, idbCount } from './terrain/chunks';
import { buildHeightmapPNG, buildJSON, buildOBJ, buildStandaloneModule, download } from './terrain/exporters';
import { AppConfig, Actions, ControlPanel, DEFAULT_CONFIG, IconButton, TabId } from './components/ControlPanel';
import { MiniMap } from './components/MiniMap';
import { Segmented } from './components/ui';
import { cn } from './utils/cn';

const CURSOR_COLORS: Record<string, string> = {
  raise: '#4ade80',
  lower: '#fb923c',
  smooth: '#60a5fa',
  flatten: '#f472b6',
  noise: '#a78bfa',
  sharpen: '#facc15',
  erode: '#22d3ee',
  plateau: '#f87171',
};

type Sheet = 'peek' | 'half' | 'full';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const studioRef = useRef<TerrainViewer | null>(null);
  const worldRef = useRef<WorldViewer | null>(null);
  const fieldRef = useRef<TerrainField | null>(null);
  const samplerRef = useRef<WorldSampler>(new WorldSampler());
  const undoRef = useRef<Float32Array[]>([]);
  const redoRef = useRef<Float32Array[]>([]);
  const bootRef = useRef(true);

  const [mode, setMode] = useState<'studio' | 'endless'>('endless');
  const [cfg, setCfg] = useState<AppConfig>(DEFAULT_CONFIG);
  const [tab, setTab] = useState<TabId>('landscape');
  const [sheet, setSheet] = useState<Sheet>('peek');
  const [tileStats, setTileStats] = useState<ViewerStats>({ triangles: 0, vertices: 0, minH: 0, maxH: 1, fps: 60 });
  const [worldStats, setWorldStats] = useState<WorldStats>({
    chunks: 0, pending: 0, generated: 0, cached: 0, saved: 0, tris: 0, fps: 60, biome: '—', x: 0, z: 0, elev: 0,
  });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [shiftDown, setShiftDown] = useState(false);
  const [field, setField] = useState<TerrainField | null>(null);
  const [tick, setTick] = useState(0);
  const [storage, setStorage] = useState({ chunks: 0 });
  const [hud, setHud] = useState(true);

  const set = useCallback((patch: Partial<AppConfig>) => setCfg((c) => ({ ...c, ...patch })), []);
  const tpl = TEMPLATE_BY_ID[cfg.templateId] ?? TEMPLATE_BY_ID.realms;

  /* ---------------------------- world config --------------------------- */

  const worldCfg = useMemo(
    () => ({
      seed: cfg.seed,
      scale: cfg.scale,
      amplitude: cfg.amplitude,
      seaLevel: cfg.seaLevelPct * cfg.amplitude,
      baseBias: tpl.baseBias,
      ridge: cfg.ridge,
      detail: cfg.detail,
      warp: cfg.warp,
      smoothing: cfg.smoothing,
      forceBiome: tpl.forceBiome,
      landmark: mode === 'studio' ? (tpl.landmark ?? 'none') : 'none',
      latitude: Math.max(3000, cfg.scale * 6),
      water: cfg.water,
    }),
    [cfg.seed, cfg.scale, cfg.amplitude, cfg.seaLevelPct, cfg.ridge, cfg.detail, cfg.warp, cfg.smoothing, cfg.water, tpl, mode]
  );

  const worldKey = useMemo(
    () =>
      [
        cfg.seed, cfg.scale, cfg.amplitude, cfg.seaLevelPct, cfg.water ? 1 : 0,
        cfg.ridge, cfg.detail, cfg.warp, cfg.smoothing, tpl.forceBiome ?? 'all', worldCfg.landmark,
      ].join('|'),
    [cfg, tpl.forceBiome, worldCfg.landmark]
  );

  /* ------------------------------- history ----------------------------- */

  const syncHistory = useCallback(() => {
    setCanUndo(undoRef.current.length > 0);
    setCanRedo(redoRef.current.length > 0);
  }, []);

  const pushUndo = useCallback(() => {
    const f = fieldRef.current;
    if (!f) return;
    undoRef.current.push(f.snapshot());
    if (undoRef.current.length > 30) undoRef.current.shift();
    redoRef.current = [];
    syncHistory();
  }, [syncHistory]);

  const undo = useCallback(() => {
    const f = fieldRef.current;
    if (!f || !undoRef.current.length) return;
    redoRef.current.push(f.snapshot());
    f.restore(undoRef.current.pop()!);
    studioRef.current?.syncAll();
    syncHistory();
  }, [syncHistory]);

  const redo = useCallback(() => {
    const f = fieldRef.current;
    if (!f || !redoRef.current.length) return;
    undoRef.current.push(f.snapshot());
    f.restore(redoRef.current.pop()!);
    studioRef.current?.syncAll();
    syncHistory();
  }, [syncHistory]);

  /* ------------------------------ tile build --------------------------- */

  const buildTile = useCallback(
    (n: number, size: number) => {
      const s = samplerRef.current;
      const f = fieldRef.current;
      if (!f) return;
      // keep features legible on small tiles: clamp the master wavelength
      s.set({ scale: Math.min(cfg.scale, size * 2.4) });
      const grid = s.generateGrid(n, size, 0, 0);
      s.set({ scale: cfg.scale });
      f.heights.set(grid.heights);
      f.colorFn = (x, z, h, slope, out) => s.colorAndBiome(x, z, h, slope, out);
      f.waterLevel = cfg.seaLevelPct * cfg.amplitude;
      f.waterTint = cfg.water;
      f.amplitude = cfg.amplitude;
      f.detail = cfg.detail;
      f.refreshColors();
      studioRef.current?.syncAll();
    },
    [cfg.scale, cfg.amplitude, cfg.seaLevelPct, cfg.water, cfg.detail]
  );

  /* --------------------------- viewer lifecycle ------------------------ */

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const s = samplerRef.current;
    s.set(worldCfg);

    if (mode === 'studio') {
      const f = new TerrainField(
        cfg.resolution,
        cfg.size,
        cfg.amplitude,
        cfg.seaLevelPct * cfg.amplitude,
        'temperate',
        cfg.seed
      );
      fieldRef.current = f;
      setField(f);
      const viewer = new TerrainViewer(el, f, {
        onStats: (st) => {
          setTileStats(st);
          setTick((t) => t + 1);
        },
        onStrokeStart: () => pushUndo(),
      });
      studioRef.current = viewer;
      viewer.setWaterVisible(cfg.water);
      buildTile(cfg.resolution, cfg.size);
      viewer.scatter(cfg.props * 0.8, cfg.props * 0.6);
      viewer.frameCamera();
      undoRef.current = [];
      redoRef.current = [];
      syncHistory();
      return () => {
        viewer.dispose();
        studioRef.current = null;
        fieldRef.current = null;
      };
    }

    const wv = new WorldViewer(el, s, setWorldStats);
    worldRef.current = wv;
    wv.chunks.propsEnabled = cfg.propsOn;
    wv.chunks.propDensity = cfg.props;
    wv.chunks.setFlatShading(cfg.flatShading);
    wv.chunks.setWireframe(cfg.wireframe);
    wv.setWaterVisible(cfg.water);
    wv.setSky(cfg.sky);
    wv.autoRotate = cfg.autoRotate;
    wv.frameReset();
    void idbCount().then((c) => setStorage({ chunks: c }));
    return () => {
      wv.dispose();
      worldRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /* --------------------------- reactive sync --------------------------- */

  // world parameter changes (debounced so sliders stay fluid)
  useEffect(() => {
    if (bootRef.current) return;
    const t = setTimeout(() => {
      const s = samplerRef.current;
      if (mode === 'endless') {
        worldRef.current?.reconfigure(worldCfg, true);
        worldRef.current?.applyWaterColor();
      } else {
        s.set(worldCfg);
        buildTile(cfg.resolution, cfg.size);
        studioRef.current?.setWaterLevel(cfg.seaLevelPct * cfg.amplitude);
        studioRef.current?.setWaterVisible(cfg.water);
        studioRef.current?.scatter(cfg.props * 0.8, cfg.props * 0.6);
      }
    }, 260);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldKey]);

  // studio: tile resolution / size
  useEffect(() => {
    if (bootRef.current || mode !== 'studio') return;
    const f = fieldRef.current;
    const v = studioRef.current;
    if (!f || !v) return;
    const t = setTimeout(() => {
      if (f.n !== cfg.resolution) {
        f.resample(cfg.resolution);
        f.size = cfg.size;
        f.step = cfg.size / (f.n - 1);
        v.rebuild();
        buildTile(cfg.resolution, cfg.size);
      } else if (f.size !== cfg.size) {
        f.size = cfg.size;
        f.step = cfg.size / (f.n - 1);
        v.rebuild();
        buildTile(cfg.resolution, cfg.size);
      }
      v.scatter(cfg.props * 0.8, cfg.props * 0.6);
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.resolution, cfg.size, mode]);

  // brush
  useEffect(() => {
    const v = studioRef.current;
    if (!v || mode !== 'studio') return;
    if (cfg.tool === 'inspect') {
      v.setBrush(null);
      return;
    }
    const brush = {
      mode: cfg.tool,
      radius: (cfg.radiusPct / 100) * cfg.size,
      strength: cfg.strength,
      falloff: cfg.falloff,
      invert: shiftDown && (cfg.tool === 'raise' || cfg.tool === 'lower'),
    };
    v.setBrush(brush);
    v.setCursor(brush.radius, CURSOR_COLORS[cfg.tool] ?? '#7dd3fc', true);
  }, [cfg.tool, cfg.radiusPct, cfg.strength, cfg.falloff, cfg.size, shiftDown, mode]);

  // scenery + appearance
  useEffect(() => {
    if (mode === 'studio') {
      const v = studioRef.current;
      if (!v) return;
      v.setFlatShading(cfg.flatShading);
      v.setWireframe(cfg.wireframe);
      v.setScatterVisible(cfg.propsOn);
      v.autoRotate = cfg.autoRotate;
      v.setSky(cfg.sky);
    } else {
      const w = worldRef.current;
      if (!w) return;
      w.chunks.setFlatShading(cfg.flatShading);
      w.chunks.setWireframe(cfg.wireframe);
      w.chunks.propsEnabled = cfg.propsOn;
      w.chunks.propDensity = cfg.props;
      w.autoRotate = cfg.autoRotate;
      w.setSky(cfg.sky);
      w.setWaterVisible(cfg.water);
      w.chunks.maxRadius = cfg.viewRadius;
    }
  }, [cfg.flatShading, cfg.wireframe, cfg.propsOn, cfg.props, cfg.autoRotate, cfg.sky, cfg.water, cfg.viewRadius, mode]);

  // re-evaluate the streaming ring when the view distance changes
  useEffect(() => {
    if (mode !== 'endless') return;
    const t = setTimeout(() => worldRef.current?.refresh(), 0);
    return () => clearTimeout(t);
  }, [cfg.viewRadius, mode]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftDown(true);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftDown(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    const t = setTimeout(() => {
      bootRef.current = false;
      setHud(false);
    }, 1200);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onUp);
    };
  }, [undo, redo]);

  /* ------------------------------ processes ---------------------------- */

  const runProcess = useCallback((fn: () => void) => {
    pushUndo();
    fn();
    studioRef.current?.syncAll();
  }, [pushUndo]);

  const erode = useCallback(async () => {
    const f = fieldRef.current;
    const v = studioRef.current;
    if (!f || !v || busy) return;
    pushUndo();
    setBusy(true);
    setProgress(0);
    const chunks = 14;
    for (let c = 0; c < chunks; c++) {
      await new Promise((r) => setTimeout(r, 10));
      f.hydraulicErosion({ iterations: Math.floor(cfg.erosionIters / chunks) });
      v.syncAll();
      setProgress((c + 1) / chunks);
    }
    setBusy(false);
  }, [busy, cfg.erosionIters, pushUndo]);

  /* ------------------------------- export ------------------------------ */

  const exportField = useCallback((): TerrainField | null => {
    if (mode === 'studio') return fieldRef.current;
    const w = worldRef.current;
    if (!w) return null;
    // bake the region around the camera into a tile
    const n = 193;
    const size = CHUNK_M * 2;
    const ox = w.controls.target.x;
    const oz = w.controls.target.z;
    const s = samplerRef.current;
    const grid = s.generateGrid(n, size, ox, oz);
    const f = new TerrainField(n, size, cfg.amplitude, cfg.seaLevelPct * cfg.amplitude, 'temperate', cfg.seed);
    f.heights.set(grid.heights);
    f.colors.set(grid.colors);
    f.colorFn = (x, z, h, slope, out) => s.colorAndBiome(x + ox, z + oz, h, slope, out);
    f.recomputeRange();
    f.recomputeShading();
    return f;
  }, [mode, cfg.amplitude, cfg.seaLevelPct, cfg.seed]);

  const actions: Actions = useMemo(
    () => ({
      applyTemplate: (id: string) => {
        const t = TEMPLATE_BY_ID[id];
        if (!t) return;
        setCfg((c) => ({
          ...c,
          templateId: id,
          scale: t.scale,
          amplitude: t.amplitude,
          seaLevelPct: t.seaLevelPct,
          water: t.water,
          ridge: t.ridge,
          detail: t.detail,
          warp: t.warp,
          smoothing: t.smoothing,
          props: Math.max(0.2, t.trees + t.rocks),
        }));
        if (mode === 'endless') setTab('travel');
      },
      randomize: () => {
        setCfg((c) => ({ ...c, seed: Math.floor(Math.random() * 99999) + 1 }));
      },
      generate: () => {
        if (mode === 'endless') {
          worldRef.current?.reconfigure(worldCfg, true);
          worldRef.current?.frameReset();
        } else {
          samplerRef.current.set(worldCfg);
          buildTile(cfg.resolution, cfg.size);
          studioRef.current?.scatter(cfg.props * 0.8, cfg.props * 0.6);
        }
      },
      undo,
      redo,
      reset: () => {
        undoRef.current = [];
        redoRef.current = [];
        syncHistory();
        samplerRef.current.set(worldCfg);
        buildTile(cfg.resolution, cfg.size);
        studioRef.current?.frameCamera();
      },
      erode,
      thermal: () => runProcess(() => fieldRef.current?.thermalErosion(6, 0.5, 0.35)),
      terrace: () => runProcess(() => fieldRef.current?.terraceAll(9, 0.65)),
      smooth: () => runProcess(() => fieldRef.current?.smoothAll(2, 0.5)),
      normalize: () => runProcess(() => fieldRef.current?.normalize()),
      invert: () => runProcess(() => fieldRef.current?.invert()),
      scatter: () => studioRef.current?.scatter(cfg.props * 0.8, cfg.props * 0.6),
      travel: (biomeId: string) => worldRef.current?.travelToBiome(biomeId),
      teleportRandom: () => {
        const w = worldRef.current;
        if (!w) return;
        const a = Math.random() * Math.PI * 2;
        const r = 600 + Math.random() * 4000;
        w.teleport(Math.cos(a) * r, Math.sin(a) * r);
      },
      frameReset: () => worldRef.current?.frameReset(),
      clearCache: () => {
        const w = worldRef.current;
        void idbClear(w ? `${w.chunks.prefix}` : undefined).then(() => {
          w?.chunks.clearAll();
          void idbCount().then((c) => setStorage({ chunks: c }));
        });
      },
      exportMjs: () => {
        const f = exportField();
        if (!f) return;
        download(`${cfg.templateId}-terrain.mjs`, buildStandaloneModule(f, `${cfg.templateId}-terrain`), 'text/javascript');
      },
      exportObj: () => {
        const f = exportField();
        if (!f) return;
        download(`${cfg.templateId}-terrain.obj`, buildOBJ(f), 'model/obj');
      },
      exportPng: () => {
        const f = exportField();
        if (!f) return;
        const a = document.createElement('a');
        a.href = buildHeightmapPNG(f);
        a.download = `${cfg.templateId}-heightmap.png`;
        a.click();
      },
      exportJson: () => {
        const f = exportField();
        if (!f) return;
        download(`${cfg.templateId}-heightfield.json`, buildJSON(f), 'application/json');
      },
    }),
    [mode, cfg, worldCfg, buildTile, undo, redo, syncHistory, erode, runProcess, exportField]
  );

  /* ------------------------------ sheet drag --------------------------- */

  const dragRef = useRef<{ y: number; active: boolean }>({ y: 0, active: false });
  const onHandleDown = (e: React.PointerEvent) => {
    dragRef.current = { y: e.clientY, active: true };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dy = e.clientY - dragRef.current.y;
    if (dy < -40) {
      setSheet('full');
      dragRef.current.active = false;
    } else if (dy > 40) {
      setSheet('peek');
      dragRef.current.active = false;
    }
  };

  const sheetH = sheet === 'peek' ? 'h-[168px]' : sheet === 'half' ? 'h-[58dvh]' : 'h-[90dvh]';

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* header */}
      <header className="z-30 flex shrink-0 items-center gap-2 border-b border-white/10 bg-slate-900/90 px-3 py-2 backdrop-blur">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 text-base shadow-lg shadow-emerald-900/40">
          🌐
        </div>
        <div className="hidden leading-tight sm:block">
          <div className="text-sm font-semibold tracking-tight">Terraformer</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">endless world studio</div>
        </div>

        <div className="mx-1 w-[136px] shrink-0 sm:w-[188px]">
          <Segmented
            size="sm"
            value={mode}
            onChange={(v) => setMode(v as 'studio' | 'endless')}
            options={[
              { value: 'endless', label: 'Endless', icon: '🌐' },
              { value: 'studio', label: 'Tile', icon: '🧱' },
            ]}
          />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {mode === 'endless' ? (
            <>
              <div className="hidden w-44 sm:block">
                <Segmented
                  size="sm"
                  value={cfg.sky}
                  onChange={(v) => set({ sky: v })}
                  options={[
                    { value: 'day', label: 'Day' },
                    { value: 'dusk', label: 'Dusk' },
                    { value: 'night', label: 'Night' },
                  ]}
                />
              </div>
              <IconButton title="Random drop" onClick={actions.teleportRandom}>
                🎲
              </IconButton>
              <IconButton title="Back to origin" onClick={actions.frameReset}>
                ⌂
              </IconButton>
            </>
          ) : (
            <>
              <IconButton title="Undo" onClick={actions.undo}>
                ↶
              </IconButton>
              <IconButton title="Redo" onClick={actions.redo}>
                ↷
              </IconButton>
              <IconButton title="Frame tile" onClick={() => studioRef.current?.frameCamera()}>
                ⤢
              </IconButton>
              <IconButton title="Top view" onClick={() => studioRef.current?.topView()}>
                ⬒
              </IconButton>
            </>
          )}
          <button
            onClick={actions.exportMjs}
            className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            Export
          </button>
        </div>
      </header>

      {/* body */}
      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-0 flex-1">
          <div ref={containerRef} className="absolute inset-0" />

          <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-2">
            <div className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-1.5 text-xs backdrop-blur">
              <span className="text-slate-400">{mode === 'studio' ? 'Template' : 'World'}</span>{' '}
              <span className="font-semibold text-emerald-300">{tpl.label}</span>
              {mode === 'endless' && (
                <>
                  <span className="mx-2 text-slate-700">|</span>
                  <span className="text-slate-400">Here</span>{' '}
                  <span className="font-semibold text-sky-300">{worldStats.biome}</span>
                </>
              )}
            </div>
            <div className="w-fit rounded-lg border border-white/10 bg-slate-950/70 px-3 py-1 font-mono text-[11px] text-slate-400 backdrop-blur">
              {mode === 'studio'
                ? `${(tileStats.triangles / 1000).toFixed(1)}k tris · ${tileStats.fps} fps`
                : `${worldStats.chunks} chunks · ${(worldStats.tris / 1000).toFixed(0)}k tris · ${worldStats.fps} fps`}
              {worldStats.pending > 0 && mode === 'endless' ? ` · loading ${worldStats.pending}` : ''}
            </div>
          </div>

          {mode === 'studio' && (
            <div className="absolute bottom-3 right-3 hidden lg:block">
              <MiniMap field={field} tick={tick} />
            </div>
          )}

          <div
            className={cn(
              'pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/75 px-4 py-1.5 text-[11px] text-slate-300 backdrop-blur transition-opacity duration-700',
              hud ? 'opacity-100' : 'opacity-0'
            )}
          >
            {mode === 'endless'
              ? 'Drag to orbit · two-finger drag (or right-drag) to travel · scroll to zoom'
              : 'Drag on the terrain to sculpt · right-drag to orbit'}
          </div>
        </div>

        {/* bottom sheet / sidebar */}
        <aside
          className={cn(
            'z-20 flex shrink-0 flex-col overflow-hidden rounded-t-2xl border-t border-white/10 bg-slate-900 shadow-2xl transition-[height] duration-300 ease-out',
            sheetH,
            'absolute inset-x-0 bottom-0',
            'lg:static lg:h-full lg:w-[356px] lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none'
          )}
        >
          <div
            className="flex shrink-0 cursor-grab touch-none items-center justify-center py-2 lg:hidden"
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={() => (dragRef.current.active = false)}
            onClick={() => setSheet((s) => (s === 'peek' ? 'half' : 'peek'))}
          >
            <div className="h-1.5 w-10 rounded-full bg-slate-600" />
            <span className="ml-3 text-[10px] uppercase tracking-widest text-slate-500">
              {sheet === 'peek' ? 'tap for controls' : sheet === 'half' ? 'drag to expand' : 'drag to close'}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <ControlPanel
              cfg={cfg}
              set={set}
              actions={actions}
              tab={tab}
              setTab={setTab}
              mode={mode}
              busy={busy}
              progress={progress}
              canUndo={canUndo}
              canRedo={canRedo}
              tileStats={tileStats}
              worldStats={worldStats}
              storage={storage}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
