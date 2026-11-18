import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignVerticalSpaceAround, ArrowDownToLine, ArrowRight, ArrowUpFromLine, Box, Camera,
  Check, CheckCircle2, ChevronDown, CircleHelp, Compass, Download, FileJson,
  Focus, FolderOpen, FolderPlus, Globe2, Grid2X2, Hand, Keyboard, Layers3, Leaf, LoaderCircle,
  Maximize2, Minus, Moon, Mountain, Mouse, Navigation, Package, Palette, PanelLeftOpen, Plus,
  Redo2, RefreshCw, RotateCcw, Search, Settings2, Shuffle, SlidersHorizontal, Sparkles, Sprout,
  Sun, Trees, Droplets, Undo2, Waves, X, Eye, MapPin, BookmarkPlus
} from 'lucide-react';
import { TerrainViewport } from './components/TerrainViewport';
import type { ViewportHandle } from './components/TerrainViewport';
import { WorldArt } from './components/WorldArt';
import { WorldMap } from './components/WorldMap';
import { TravelPad } from './components/TravelPad';
import { IconButton, Modal, PanelSection, RangeControl, Toggle } from './components/Controls';
import { COLORWAYS, BIOMES, WORLDS, COORDINATE_LIMIT, createParams, sampleBiomes, params as terrainMeta } from './assets/infinite-terrain';
import { download, exportProject, exportTerrainModule, filenameFor } from './export-project';
import type { ExportFormat } from './export-project';
import {
  BIOME_SWATCHES, DEFAULT_PARAMS, BIOME_LORE, PARAM_META,
  SCENE_META, TOOLS, WORLD_PRESETS, findBiome, formatDistance, loadProject, serializeProject,
  validateProject, worldDefaults, newId, resetPalette, emptyState
} from './studio';
import { saveWorld, restoreWorld, savedWorlds, emergencySave } from './storage';
import type { Bookmark, BrushSettings, CameraView, ProjectState, SceneOptions, SceneStats, Stroke, Tab, Tool, TravelReport, ViewSettings, WorldParams, WorldDocument } from './studio';

type Undoable = Pick<ProjectState, 'params' | 'scene' | 'strokes'>;
type History = { past: Undoable[]; present: Undoable; future: Undoable[]; lastKey: string; lastTime: number };
type ModalType = 'guide' | 'export' | 'new' | 'biomes' | 'saved' | null;

const FORMAT_OPTIONS: { id: ExportFormat; title: string; extension: string; blurb: string; icon: typeof Box }[] = [
  { id: 'source', title: 'Three.js world', extension: '.zip', blurb: 'Standalone modules, your baked settings, and a live roaming preview', icon: Package },
  { id: 'glb', title: '3D snapshot', extension: '.glb', blurb: 'The loaded region as one model for Blender, Unity, or a game engine', icon: Box },
  { id: 'project', title: 'Terra world', extension: '.json', blurb: 'Everything, so you can pick this world up again later', icon: FileJson }
];

const WORLD_NUM_FIELDS = ['relief', 'biomeScale', 'feature', 'roughness', 'erosion'] as const;
const LIFE_FIELDS = ['canopy', 'scree'] as const;
const WATER_FIELDS = ['waterLevel', 'oceanDepth'] as const;

function Logo() {
  return (
    <div className="brand">
      <svg width="34" height="34" viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <rect width="36" height="36" rx="10" fill="#2f5f46" />
        <path d="M4 26.5 12 13.5l5.5 8 4-6.5L32 26.5" stroke="#eef4e6" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M4 30.5h28" stroke="#a8c69c" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="26.5" cy="9" r="2.6" fill="#f2dfae" />
      </svg>
      <span>terra<span className="brand-period">.</span></span>
    </div>
  );
}

function ParamSlider({ name, values, onPatch, display, label }: {
  name: string; values: WorldParams; onPatch: (patch: Partial<WorldParams>, key: string) => void;
  display?: (value: number) => string; label?: string;
}) {
  const schema = PARAM_META[name];
  const value = Number(values[name as keyof WorldParams]);
  return (
    <RangeControl
      label={label || schema.label}
      value={Number.isFinite(value) ? value : 0}
      min={schema.min ?? 0}
      max={schema.max ?? 1}
      step={schema.step ?? 0.01}
      display={display ? display(value) : String(value)}
      onChange={(next) => onPatch({ [name]: next } as Partial<WorldParams>, `param:${name}`)}
    />
  );
}

function SceneSlider({ name, values, onPatch, display, label }: {
  name: string; values: SceneOptions; onPatch: (patch: Partial<SceneOptions>) => void; display?: (value: number) => string; label?: string;
}) {
  const schema = SCENE_META[name];
  const value = Number(values[name as keyof SceneOptions]);
  return (
    <RangeControl
      label={label || schema.label}
      value={value}
      min={schema.min ?? 0}
      max={schema.max ?? 10}
      step={schema.step ?? 1}
      display={display ? display(value) : String(value)}
      onChange={(next) => onPatch({ [name]: next } as Partial<SceneOptions>)}
    />
  );
}

export default function TerraStudio() {
  const [initial] = useState(loadProject);
  const [ready, setReady] = useState(false);
  const [projectId, setProjectId] = useState(initial.state.id);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initial.state.bookmarks);
  const [worldLibrary, setWorldLibrary] = useState<Awaited<ReturnType<typeof savedWorlds>>>([]);
  const [name, setName] = useState(initial.name);
  const [history, setHistory] = useState<History>({ past: [], present: initial.state, future: [], lastKey: '', lastTime: 0 });
  const [view, setView] = useState<ViewSettings>(initial.state.view);
  const [brush, setBrush] = useState<BrushSettings>(initial.state.brush);
  const [travel, setTravel] = useState<{ x: number; z: number }>(initial.state.travel);
  const [tool, setTool] = useState<Tool>('orbit');
  const [tab, setTab] = useState<Tab>('worlds');
  const [stats, setStats] = useState<SceneStats>({ triangles: 0, chunks: 0, props: 0, pending: 0, drawCalls: 0, zoom: 100 });
  const [report, setReport] = useState<TravelReport>({ x: travel.x, z: travel.z, height: 0, biome: '', blend: null, transition: 0, weight: 1, blendWeight: 0, heading: 0 });
  const [modal, setModal] = useState<ModalType>(null);
  const [projectMenu, setProjectMenu] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unavailable'>('saved');
  const [search, setSearch] = useState('');
  const [travelBusy, setTravelBusy] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('source');
  const [includeProps, setIncludeProps] = useState(true);
  const [mergeExport, setMergeExport] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [cameraView, setCameraView] = useState<CameraView>('orbit');
  const viewportRef = useRef<ViewportHandle>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [coordinateX, setCoordinateX] = useState('0');
  const [coordinateZ, setCoordinateZ] = useState('0');

  const project: ProjectState = useMemo(
    () => ({ id: projectId, params: history.present.params, scene: history.present.scene, strokes: history.present.strokes, view, brush, travel, bookmarks }),
    [projectId, history.present, view, brush, travel, bookmarks]
  );
  const latestSave = useRef({name,project});
  latestSave.current = {name,project};
  const values = project.params;
  const scene = project.scene;
  const strokes = project.strokes;

  /** Resolved field for UI samplers (atlas, readout, travel) — the same function the mesh uses. */
  const field = useMemo(() => createParams({ ...values, strokes }), [values, strokes]);
  const activeWorld = WORLDS[values.world];
  const worldCard = WORLD_PRESETS.find((preset) => preset.id === values.world) || WORLD_PRESETS[0];

  const notify = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 3800);
  }, []);

  const openDocument = useCallback((doc:WorldDocument) => {
    setName(doc.name);setProjectId(doc.state.id);setBookmarks(doc.state.bookmarks);
    setHistory({past:[],present:doc.state,future:[],lastKey:'',lastTime:0});
    setView(doc.state.view);setBrush(doc.state.brush);setTravel(doc.state.travel);setTool('orbit');setCameraView('orbit');
  }, []);

  useEffect(() => {
    let cancelled=false;
    void restoreWorld(initial).then((doc)=>{if(cancelled)return;openDocument(doc);setReady(true);if(doc.notice)notify(doc.notice);});
    return ()=>{cancelled=true;};
  }, [initial,openDocument,notify]);

  const commit = useCallback((update: (state: Undoable) => Undoable, key = 'action') => {
    const time = Date.now();
    setHistory((current) => {
      const next = update(current.present);
      if (next === current.present) return current;
      const combine = key.startsWith('param:') && current.lastKey === key && time - current.lastTime < 700;
      return { past: combine ? current.past : [...current.past, current.present].slice(-40), present: next, future: [], lastKey: key, lastTime: time };
    });
  }, []);

  const patchParams = useCallback((patch: Partial<WorldParams>, key = 'params') => commit((state) => ({ ...state, params: { ...state.params, ...patch } }), key), [commit]);
  const patchScene = useCallback((patch: Partial<SceneOptions>) => commit((state) => ({ ...state, scene: { ...state.scene, ...patch } }), 'scene'), [commit]);
  const onStroke = useCallback((stroke: Stroke) => commit((state) => ({ ...state, strokes: [...state.strokes, stroke] }), 'stroke'), [commit]);
  const undo = useCallback(() => setHistory((current) => (!current.past.length ? current : {
    past: current.past.slice(0, -1), present: current.past[current.past.length - 1], future: [current.present, ...current.future], lastKey: '', lastTime: 0
  })), []);
  const redo = useCallback(() => setHistory((current) => (!current.future.length ? current : {
    past: [...current.past, current.present], present: current.future[0], future: current.future.slice(1), lastKey: '', lastTime: 0
  })), []);

  useEffect(() => {
    if(!ready)return;
    setSaveStatus('saving');
    if(saveTimer.current)return;
    saveTimer.current=setTimeout(()=>{
      saveTimer.current=null;const snapshot=latestSave.current;
      void saveWorld(snapshot.name,snapshot.project).then(()=>{if(latestSave.current.project===snapshot.project)setSaveStatus('saved');}).catch(()=>setSaveStatus('unavailable'));
    },800);
  }, [name,project,ready]);

  useEffect(()=>{
    if(!ready)return;
    const flush=()=>{const {name,project}=latestSave.current;emergencySave(name,project);void saveWorld(name,project).catch(()=>{});};
    const hidden=()=>{if(document.hidden)flush();};
    window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',hidden);
    return ()=>{window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',hidden);};
  },[ready]);

  useEffect(()=>()=>{if(saveTimer.current)clearTimeout(saveTimer.current);},[]);

  useEffect(() => {
    if (!projectMenu) return;
    const handler = (event: PointerEvent) => { if (!projectMenuRef.current?.contains(event.target as Node)) setProjectMenu(false); };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [projectMenu]);

  const chooseTool = useCallback((next: Tool) => {
    setTool(next);
    if (next !== 'orbit') setTab((current) => (current === 'worlds' ? 'terraform' : current));
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if(event.defaultPrevented||modal)return;
      if (event.key === 'Escape') { setProjectMenu(false); setRailOpen(false); setSidebarOpen(false); setTool('orbit'); return; }
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const tool = TOOLS.find((item) => item.key === event.key);
      if (tool) { event.preventDefault(); chooseTool(tool.id); return; }
      if (event.key.toLowerCase() === 'f') viewportRef.current?.fit();
      if (event.key.toLowerCase() === 'g') setView((current) => ({ ...current, grid: !current.grid }));
      if (event.key.toLowerCase() === 'm') setRailOpen((current) => !current);
      if (event.key === '?') setModal('guide');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, chooseTool,modal]);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const adoptWorld = (id: string, reseed = false) => {
    if(!ready)return;
    if(reseed){void startFresh(id);return;}
    const patch = worldDefaults(id) as Partial<WorldParams>;
    commit((state) => ({
      ...state,
      params: { ...state.params, ...patch, lowland: undefined, highland: undefined, water: undefined, snow: undefined, sand: undefined, rock: undefined } as WorldParams
    }), `world:${id}`);
    notify(`${WORLDS[id].name}. Your existing sculpting is preserved.`);
    if (window.innerWidth < 1180) setSidebarOpen(false);
  };

  const startFresh = async (world=values.world) => {
    if(!ready)return;
    try{
      await saveWorld(name,project);
      const seed=Math.floor(Math.random()*99999)+1;
      const state=emptyState({...DEFAULT_PARAMS,...worldDefaults(world),seed} as WorldParams);
      await saveWorld(WORLDS[world].name,state);
      openDocument({name:WORLDS[world].name,state});setModal(null);
      notify('New world created. Your previous world is in Saved worlds.');
    }catch(error){notify(error instanceof Error?error.message:'Save or export this world before starting another.');}
  };
  const regenerate = () => { void startFresh(); };

  const travelTo = useCallback((x: number, z: number) => {
    if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>COORDINATE_LIMIT||Math.abs(z)>COORDINATE_LIMIT)return;
    viewportRef.current?.travelTo(x, z);
    setTravel({ x, z });
  }, []);

  const visitBiome = async (biome: string) => {
    setTravelBusy(true);
    // Yield one frame so the cursor can change before the spiral search runs.
    await new Promise((resolve) => setTimeout(resolve, 16));
    try {
      const found = findBiome(field, biome, travel.x, travel.z);
      if (found) {
        setModal(null);setCameraView('orbit');
        travelTo(found.x, found.z);
        const distance = Math.hypot(found.x - travel.x, found.z - travel.z);
        notify(`${(BIOMES.find((item) => item.id === biome)?.name || biome).toLowerCase()} — ${formatDistance(distance)} away.`);
      } else {
        notify('No strong patch nearby. Try Shifting wilds to include every biome.');
      }
    } finally { setTravelBusy(false); }
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error('Choose a world file smaller than 100 MB.');
      const imported = validateProject(JSON.parse(await file.text()));
      await saveWorld(name,project);
      imported.state.id=newId();openDocument(imported);
      setProjectMenu(false);
      notify(imported.notice || 'World restored with all sculpting and saved places.');
    } catch (error) { notify(error instanceof Error ? error.message : 'That world could not be opened.'); }
    if (importRef.current) importRef.current.value = '';
  };

  const handleExport = async () => {
    setExporting(true); setExportError('');
    try {
      await exportProject(format, name, project, includeProps, mergeExport);
      setModal(null);
      notify(format === 'source' ? 'Source package downloaded, with your settings and every edit.' : format === 'glb' ? 'Your terrain region is ready to use.' : 'World file saved.');
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Something went wrong on the way out. Try another format.');
    } finally { setExporting(false); }
  };

  const screenshot = () => {
    const data = viewportRef.current?.screenshot();
    if (!data) { notify('The view is not ready yet.'); return; }
    const link = document.createElement('a');
    link.href = data; link.download = `${filenameFor(name)}.png`; link.click();
    notify('Captured.');
  };

  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        const workspace = document.querySelector('.workspace');
        if (!workspace?.requestFullscreen) throw new Error();
        await workspace.requestFullscreen();
      }
    } catch { notify('Full screen is not available in this browser.'); }
  };

  const biomeRows = useMemo(() => {
    const mix = activeWorld?.mix || [];
    return mix.map((id) => {
      const biome = BIOMES.find((item) => item.id === id)!;
      const here = sampleBiomes(travel.x, travel.z, field);
      return { id, name: biome.name, colors: BIOME_SWATCHES[id], present: here.primary === id || Boolean(here.blend?.id === id) };
    });
  }, [activeWorld, travel.x, travel.z, field]);

  const blendPercent = report.blend ? report.weight / (report.weight + report.blendWeight) * 100 : 100;
  const onTravel = useCallback((next:TravelReport)=>{
    setReport(next);setTravel((current)=>Math.abs(current.x-next.x)<.05&&Math.abs(current.z-next.z)<.05?current:{x:next.x,z:next.z});
  },[]);
  const onMoveAxis = useCallback((x:number,y:number)=>viewportRef.current?.engine()?.setMoveAxis(x,y),[]);
  const showSaved = async ()=>{await saveWorld(name,project).catch(()=>{});setWorldLibrary(await savedWorlds());setProjectMenu(false);setModal('saved');};

  return (
    <div className="studio-app">
      <header className="app-header">
        <div className="header-brand">
          <Logo />
          <span className="brand-divider" />
          <span className="product-name">Endless terrain studio</span>
        </div>
        <div ref={projectMenuRef} className="project-control">
          <button className={`project-trigger ${projectMenu ? 'is-open' : ''}`} onClick={() => setProjectMenu(!projectMenu)} aria-expanded={projectMenu} aria-haspopup="dialog">
            <span>{name}</span><ChevronDown size={13} />
          </button>
          {projectMenu && (
            <div className="project-popover">
              <p className="eyebrow">THIS WORLD</p>
              <label className="project-name-label" htmlFor="project-name">World name</label>
              <input id="project-name" className="text-input" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} onBlur={() => { if (!name.trim()) setName('Untitled world'); }} />
              <div className="popover-divider" />
              <button onClick={() => { setProjectMenu(false); setModal('new'); }}><FolderPlus size={15} />Begin a new world</button>
              <button onClick={() => importRef.current?.click()}><FolderOpen size={15} />Open a world file<span>.json</span></button>
              <button onClick={() => void showSaved()}><Globe2 size={15} />Saved worlds</button>
              <button onClick={() => { download(serializeProject(name, project), `${filenameFor(name)}.terra.json`, 'application/json'); setProjectMenu(false); notify('A copy is in your downloads.'); }}><Download size={15} />Save a copy</button>
              <p className="project-local-note"><span className="status-dot" />Worlds and edits stay in this browser. Export for backup.</p>
            </div>
          )}
        </div>
        <nav className="header-actions" aria-label="Studio actions">
          <button className="header-link" onClick={() => setModal('biomes')}><Globe2 size={14} /><span>Biomes</span></button>
          <IconButton label="Field guide and shortcuts" className="help-button" onClick={() => setModal('guide')}><CircleHelp size={17} /></IconButton>
          <span className="header-actions-divider" />
          <button className="button primary export-button" disabled={!ready} onClick={() => { setExportError(''); setModal('export'); }}><Download size={15} /><span>Export</span><ChevronDown size={12} /></button>
        </nav>
      </header>

      <div className="studio-body" inert={!ready}>
        {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close controls" onClick={() => setSidebarOpen(false)} />}
        <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`} aria-label="World controls">
          <div className="sidebar-tabs" role="tablist" aria-label="Studio sections">
            {([
              { id: 'worlds', label: 'Worlds', icon: Globe2 },
              { id: 'terraform', label: 'Terraform', icon: SlidersHorizontal },
              { id: 'life', label: 'Life', icon: Leaf },
              { id: 'view', label: 'View', icon: Eye }
            ] as const).map((item) => (
              <button key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'selected' : ''} onClick={() => { setTab(item.id); if (item.id !== 'terraform') setTool('orbit'); }}>
                <item.icon size={14} />{item.label}
              </button>
            ))}
            <IconButton label="Close controls" className="mobile-close" onClick={() => setSidebarOpen(false)}><X size={15} /></IconButton>
          </div>

          <div className="sidebar-scroll" key={tab}>
            {tab === 'worlds' && (
              <>
                <div className="panel-intro">
                  <p className="eyebrow">{WORLD_PRESETS.length} WORLDS. ENDLESS POSSIBILITIES.</p>
                  <h2>Pick a world.<br />It never stops.</h2>
                  <p>From alpine peaks to coastal forest. Keep exploring; the landscape changes with you.</p>
                </div>
                <div className="world-search">
                  <Search size={14} />
                  <input type="search" placeholder="Search worlds and biomes" aria-label="Search worlds" value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                <div className="world-list">
                  {WORLD_PRESETS.filter((preset) => `${preset.name} ${preset.blurb} ${preset.mix.join(' ')}`.toLowerCase().includes(search.toLowerCase())).map((preset) => {
                    const active = preset.id === values.world;
                    return (
                      <div key={preset.id} className={`world-card ${active ? 'selected' : ''}`} role="group" aria-label={preset.name}>
                        <button className="world-card-main" onClick={() => adoptWorld(preset.id)} aria-pressed={active}>
                          <WorldArt mix={preset.mix} snow={preset.mix.includes('glacier')} water={!preset.mix.includes('desert')} />
                          <span className="world-card-body">
                            <span className="world-card-title">{preset.name}{active && <em>active</em>}</span>
                            <span className="world-card-blurb">{preset.blurb}</span>
                            <span className="chip-row">
                              {preset.mix.map((biome) => <i key={biome} style={{ background: BIOME_SWATCHES[biome]?.[0] }} title={BIOME_LORE[biome]} />)}
                              <span className="chip-count">{preset.mix.length} biomes</span>
                            </span>
                          </span>
                        </button>
                        <button className="world-card-seed" title="Adopt with a new seed" aria-label={`Start ${preset.name} with a new seed`} onClick={() => adoptWorld(preset.id, true)}><Shuffle size={13} /></button>
                      </div>
                    );
                  })}
                  {!WORLD_PRESETS.some((preset) => `${preset.name} ${preset.blurb} ${preset.mix.join(' ')}`.toLowerCase().includes(search.toLowerCase())) && (
                    <p className="disabled-note">No world by that name. Try “canyon”, “ice”, or “island”.</p>
                  )}
                </div>
              </>
            )}

            {tab === 'terraform' && (
              <>
                <div className="panel-intro">
                  <p className="eyebrow">TERRAFORM</p>
                  <h2>Move the land.<br />It remembers.</h2>
                  <p>Shape a ridge, carve a river, or soften a slope. Your edits stay where you made them.</p>
                </div>
                <section className="tool-grid-wrap">
                   <div className="label-heading"><h2>TOOLS</h2><span className="keyboard-hint">keys 1 - 6</span></div>
                  <div className="tool-grid">
                    {TOOLS.map((item) => {
                      const Icon = item.icon === 'hand' ? Hand : item.icon === 'arrow-up-from-line' ? ArrowUpFromLine : item.icon === 'arrow-down-to-line' ? ArrowDownToLine : item.icon === 'align-vertical-space-around' ? AlignVerticalSpaceAround : item.icon === 'waves' ? Waves : Mountain;
                      return (
                        <button key={item.id} className={`tool-button ${tool === item.id ? 'selected' : ''}`} onClick={() => chooseTool(item.id)} aria-pressed={tool === item.id} title={item.hint}>
                          <Icon size={19} strokeWidth={1.55} />
                          <span>{item.name}</span>
                          {tool === item.id && <Check size={11} className="tool-check" />}
                        </button>
                      );
                    })}
                  </div>
                </section>
                <PanelSection title="Brush" icon={<SlidersHorizontal size={14} />}>
                  <RangeControl label="Brush reach" min={18} max={340} step={2} value={brush.size} display={`${brush.size} m`} onChange={(size) => setBrush((current) => ({ ...current, size }))} />
                  <RangeControl label="Strength" min={0.06} max={1} step={0.01} value={brush.strength} display={`${Math.round(brush.strength * 100)}%`} onChange={(strength) => setBrush((current) => ({ ...current, strength }))} />
                  <div className="segmented" role="group" aria-label="Brush falloff">
                    {(['soft', 'linear'] as const).map((option) => (
                      <button key={option} className={brush.falloff === option ? 'selected' : ''} onClick={() => setBrush((current) => ({ ...current, falloff: option }))}>{option === 'soft' ? 'Rounded' : 'Stamped'}</button>
                    ))}
                  </div>
                </PanelSection>
                <PanelSection title="Terrain field" icon={<Mountain size={14} />}>
                  {WORLD_NUM_FIELDS.map((key) => <ParamSlider key={key} name={key} values={values} onPatch={patchParams} display={key === 'relief' || key === 'biomeScale' || key === 'feature' ? (v) => `${v} m` : (v) => `${Math.round(v * 100)}%`} />)}
                  <ParamSlider name="snowline" values={values} onPatch={patchParams} label="Snowline" display={(v) => `${Math.round(v * 100)}%`} />
                  <div className="seed-row">
                    <label htmlFor="world-seed">Seed<span title="Same seed, same world — anywhere."><CircleHelp size={11} /></span></label>
                    <div>
                      <input id="world-seed" type="number" min={1} max={99999} value={values.seed} onChange={(event) => patchParams({ seed: Math.max(1, Math.min(99999, Math.round(Number(event.target.value)))) }, 'param:seed')} />
                      <IconButton label="Roll a new seed" onClick={regenerate}><Shuffle size={13} /></IconButton>
                    </div>
                  </div>
                </PanelSection>
                <PanelSection title="Sculpt history" icon={<Layers3 size={14} />}>
                  <div className="stroke-meter">
                    <div><span>{strokes.length.toLocaleString()}</span> strokes retained<em>all edits</em></div>
                    <p className="field-note">Traveling never discards older sculpting.</p>
                  </div>
                  <div className="button-row">
                    <button className="button secondary" onClick={() => { viewportRef.current?.calmRegion(); notify('The ground around you is settling.'); }}><Waves size={14} />Calm this region</button>
                    <button className="text-action" disabled={!strokes.length} onClick={() => { commit((state) => ({ ...state, strokes: [] }), 'clear-strokes'); notify('Sculpting cleared. The field is yours again.'); }}><RotateCcw size={13} />Clear all sculpting</button>
                  </div>
                </PanelSection>
              </>
            )}

            {tab === 'life' && (
              <>
                <div className="panel-intro">
                  <p className="eyebrow">WATER &amp; LIFE</p>
                  <h2>Sea level sets<br />everything else.</h2>
                  <p>Raise the water and fjords, marshes and island arcs appear. Canopy and rock scatter follow the blended climate, not a paint layer.</p>
                </div>
                <PanelSection title="Water" icon={<Droplets size={14} />} action={<Toggle label="Water surface" checked={values.waterSurface} onChange={(waterSurface) => patchParams({ waterSurface }, 'param:waterSurface')} />}>
                  {values.waterSurface ? WATER_FIELDS.map((key) => <ParamSlider key={key} name={key} values={values} onPatch={patchParams} display={(v) => `${v} m`} />) : <p className="disabled-note">Water is off. The land keeps its carved rivers and basins regardless.</p>}
                </PanelSection>
                <PanelSection title="Vegetation &amp; stone" icon={<Trees size={14} />}>
                  {LIFE_FIELDS.map((key) => <ParamSlider key={key} name={key} values={values} onPatch={patchParams} display={(v) => `${Math.round(v * 100)}%`} />)}
                  <div className="setting-row"><span>Trees &amp; shrubs</span><Toggle label="Vegetation" checked={scene.vegetation} onChange={(vegetation) => patchScene({ vegetation })} /></div>
                  <div className="setting-row"><span>Surface rock</span><Toggle label="Scattered rocks" checked={scene.rocks} onChange={(rocks) => patchScene({ rocks })} /></div>
                  <SceneSlider name="skip" values={scene} onPatch={patchScene} label="Planting spacing" display={(v) => `${v * 11} m`} />
                  <SceneSlider name="propBudget" values={scene} onPatch={patchScene} display={(v) => `${v} props`} />
                  <p className="field-note"><Sprout size={12} />{Math.round(values.canopy * 100)}% canopy target · species follow the local biome mix.</p>
                </PanelSection>
                <PanelSection title="Colour &amp; palette" icon={<Palette size={14} />}>
                  <div className="palette-options">
                    {Object.keys(COLORWAYS).map((key) => (
                      <button key={key} className={`palette-option ${values.colorway === key ? 'selected' : ''}`} onClick={() => commit((state)=>({...state,params:resetPalette(state.params,key)}),'palette')} aria-pressed={values.colorway === key}>
                        <span className="palette-swatches">{['lowland', 'highland', 'water'].map((zone) => <i key={zone} style={{ background: COLORWAYS[key][zone] }} />)}</span>
                        <span>{key}</span>
                      </button>
                    ))}
                  </div>
                  <div className="colour-rows">
                    {(['lowland', 'highland', 'snow', 'water'] as const).map((zone) => (
                      <div className="colour-row" key={zone}>
                        <label htmlFor={`zone-${zone}`}>{zone}<em>{values[zone] ? 'custom' : 'palette'}</em></label>
                        <input id={`zone-${zone}`} type="color" value={String(values[zone] || COLORWAYS[values.colorway][zone])}
                          onChange={(event) => patchParams({ [zone]: event.target.value } as Partial<WorldParams>, `color:${zone}`)} />
                      </div>
                    ))}
                  </div>
                </PanelSection>
              </>
            )}

            {tab === 'view' && (
              <>
                <div className="panel-intro">
                  <p className="eyebrow">STREAMING &amp; LIGHT</p>
                  <h2>How far you<br />can see.</h2>
                  <p>Nearby terrain stays in memory. The rest returns exactly as you left it when you come back.</p>
                </div>
                <PanelSection title="Streaming" icon={<Navigation size={14} />}>
                  <SceneSlider name="radius" values={scene} onPatch={patchScene} label="Stream radius" display={(v) => `${v} chunks`} />
                  <ParamSlider name="chunkSize" values={values} onPatch={patchParams} display={(v)=>`${v} m`} />
                  <div className="select-control">
                    <label htmlFor="segment-quality">Tile resolution</label>
                    <div className="select-wrapper">
                      <select id="segment-quality" value={values.segments} onChange={(event) => patchParams({ segments: Number(event.target.value) }, 'param:segments')}>
                        {terrainMeta.segments.options?.map((option) => (
                          <option key={String(option)} value={String(option)}>
                            {option === 12 ? 'Draft' : option === 16 ? 'Fast' : option === 24 ? 'Balanced' : option === 32 ? 'Detailed' : 'Fine'} · {option}×{option}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={12} />
                    </div>
                  </div>
                  <div className="setting-row"><span>Cutaway in terrain module</span><Toggle label="Export geological cutaway" checked={values.skirt} onChange={(skirt) => patchParams({ skirt }, 'param:skirt')} /></div>
                </PanelSection>
                <PanelSection title="Atmosphere" icon={<Settings2 size={14} />}>
                  <div className="setting-row"><span>Ground lattice</span><Toggle label="Ground lattice" checked={view.grid} onChange={(grid) => setView((current) => ({ ...current, grid }))} /></div>
                  <div className="setting-row"><span>Soft shadows</span><Toggle label="Soft shadows" checked={view.shadows} onChange={(shadows) => setView((current) => ({ ...current, shadows }))} /></div>
                  <div className="setting-row"><span>Wireframe</span><Toggle label="Wireframe" checked={view.wireframe} onChange={(wireframe) => setView((current) => ({ ...current, wireframe }))} /></div>
                  <div className="setting-row"><span>Drift</span><Toggle label="Auto orbit" checked={view.autoRotate} onChange={(autoRotate) => setView((current) => ({ ...current, autoRotate }))} /></div>
                </PanelSection>
              </>
            )}
          </div>

          <div className="sidebar-footer">
            <button className="button regenerate-button" onClick={regenerate}><RefreshCw size={14} /><span>New world from a fresh seed</span><span className="regenerate-spark"><Sparkles size={12} /></span></button>
            <p>Seed {values.seed} · {formatDistance(values.biomeScale)} biome spacing</p>
          </div>
        </aside>

        <main className={`workspace ${view.night ? 'is-night' : ''}`} aria-label="Landscape workspace">
          {ready && <TerrainViewport
            ref={viewportRef}
            project={project}
            view={view}
            tool={tool}
            brush={brush}
            onStats={setStats}
            onStroke={onStroke}
            onTravel={onTravel}
            paused={Boolean(modal)||projectMenu||sidebarOpen}
          />}
          {!ready && <div className="world-loading"><LoaderCircle className="spinning" size={25}/><span>Restoring your world...</span></div>}
          <div className="canvas-topbar">
            <div className="workspace-title">
              <button className="mobile-controls-button" onClick={() => setSidebarOpen(true)} aria-label="Open world controls"><PanelLeftOpen size={17} /></button>
              <div>
                <p className="eyebrow">ENDLESS WORLD · SEAMLESS BLEND</p>
                <h1>{worldCard.name}<span className="live-dot" title="Streaming live" /></h1>
              </div>
            </div>
            <div className="canvas-top-actions">
              <div className="history-controls">
                <IconButton label="Undo (Ctrl/Cmd Z)" disabled={!history.past.length} onClick={undo}><Undo2 size={16} /></IconButton>
                <IconButton label="Redo (Ctrl/Cmd Shift Z)" disabled={!history.future.length} onClick={redo}><Redo2 size={16} /></IconButton>
              </div>
              <span className="canvas-action-divider" />
              <div className="day-night-control" role="group" aria-label="Lighting">
                <button className={!view.night ? 'selected' : ''} onClick={() => setView((c) => ({ ...c, night: false }))} aria-pressed={!view.night}><Sun size={14} /><span>Day</span></button>
                <button className={view.night ? 'selected' : ''} onClick={() => setView((c) => ({ ...c, night: true }))} aria-pressed={view.night}><Moon size={13} /><span>Night</span></button>
              </div>
              <button className={`atlas-trigger ${railOpen?'active':''}`} title="World atlas (M)" aria-expanded={railOpen} onClick={() => {setRailOpen(!railOpen);setSidebarOpen(false);}}><Compass size={16}/><span>Explore</span></button>
            </div>
          </div>

          <div className="canvas-tool-rail" role="toolbar" aria-label="Terraform tools">
            {TOOLS.map((item, index) => {
              const Icon = item.icon === 'hand' ? Hand : item.icon === 'arrow-up-from-line' ? ArrowUpFromLine : item.icon === 'arrow-down-to-line' ? ArrowDownToLine : item.icon === 'align-vertical-space-around' ? AlignVerticalSpaceAround : item.icon === 'waves' ? Waves : Mountain;
              return (
                <div key={item.id}>
                  {index === 1 && <span className="tool-rail-divider" />}
                  <IconButton label={`${item.name} (${item.key}) — ${item.hint}`} active={tool === item.id} onClick={() => chooseTool(item.id)}><Icon size={18} strokeWidth={1.6} /></IconButton>
                </div>
              );
            })}
            <span className="tool-rail-divider" />
            <IconButton label="Ground lattice (G)" active={view.grid} onClick={() => setView((current) => ({ ...current, grid: !current.grid }))}><Grid2X2 size={16} strokeWidth={1.6} /></IconButton>
          </div>

          {tool !== 'orbit' && (
            <div className="active-tool-hint">
              <span className="status-dot" />{TOOLS.find((item) => item.id === tool)?.name}
              <span className="hint-divider" />{brush.size} m reach
              <span className="hint-divider" /><span>drag on the land</span>
            </div>
          )}

          <div className="place-readout" aria-live="polite">
            <div className="readout-biome">
              <span className="readout-swatch" style={{ background: BIOME_SWATCHES[report.biome ? BIOME_KEY_BY_NAME[report.biome] || 'foothills' : 'foothills']?.[0] || '#8b9a6c' }} />
              <div>
                <strong>{report.biome || 'Finding your bearings'}</strong>
                {report.blend && <span className="readout-blend">blending into {report.blend}</span>}
              </div>
            </div>
            {report.blend && (
              <div className="blend-meter" title="How much of this ground belongs to each biome">
                <i className="blend-a" style={{ width: `${blendPercent}%` }} />
                <i className="blend-b" style={{ width: `${100 - blendPercent}%` }} />
              </div>
            )}
            <div className="readout-numbers">
              <span><span>X</span>{report.x >= 0 ? '+' : ''}{Math.round(report.x).toLocaleString()}</span>
              <span><span>Z</span>{report.z >= 0 ? '+' : ''}{Math.round(report.z).toLocaleString()}</span>
              <span><span>↑</span>{report.height} m</span>
            </div>
          </div>

          <div className="canvas-utility-rail">
            <IconButton label="Save a picture of this view" onClick={screenshot}><Camera size={17} strokeWidth={1.55} /></IconButton>
            <IconButton label="Full screen workspace" onClick={fullscreen}><Maximize2 size={16} strokeWidth={1.55} /></IconButton>
          </div>
          {!railOpen && <div className="touch-travel"><TravelPad onAxis={onMoveAxis}/></div>}

          <div className="navigation-hint">
            <span><Mouse size={13} />drag to orbit</span><i />
            <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to walk</span><i />
            <span>hold <kbd>Shift</kbd> to run</span>
          </div>

          <div className="view-controls">
            <div className="camera-view-control" role="group" aria-label="Camera">
              {(['orbit', 'ground', 'top'] as const).map((option) => (
                <button key={option} className={cameraView === option ? 'selected' : ''} onClick={() => { setCameraView(option); viewportRef.current?.setCameraView(option); }}>{option}</button>
              ))}
            </div>
            <span className="view-control-divider" />
            <IconButton label="Zoom out" onClick={() => viewportRef.current?.zoomBy(1 / 1.18)}><Minus size={14} /></IconButton>
            <span className="zoom-readout">{stats.zoom}%</span>
            <IconButton label="Zoom in" onClick={() => viewportRef.current?.zoomBy(1.18)}><Plus size={14} /></IconButton>
            <span className="view-control-divider" />
            <IconButton label="Fit this region (F)" onClick={() => { viewportRef.current?.fit(); setCameraView('orbit'); }}><Focus size={16} /></IconButton>
          </div>

          {railOpen && (
            <aside className="world-rail" aria-label="World atlas and travel">
              <IconButton label="Close atlas" className="rail-close" onClick={() => setRailOpen(false)}><X size={15} /></IconButton>
              <WorldMap
                field={field}
                travel={travel}
                region={viewportRef.current?.engine()?.regionBounds() || null}
                strokes={strokes}
                night={view.night}
                onPick={travelTo}
                heading={report.heading}
              />
              <div className="rail-block">
                <TravelPad onAxis={onMoveAxis} />
              </div>
              <div className="rail-block">
                <p className="label-mini">GO TO COORDINATES</p>
                <form className="coordinate-form" onSubmit={(event)=>{event.preventDefault();const x=Number(coordinateX),z=Number(coordinateZ);if(Number.isFinite(x)&&Number.isFinite(z)){travelTo(x,z);notify('Position updated.');}else notify('Enter valid X and Z coordinates.');}}>
                  <label>X<input type="number" step="any" min={-COORDINATE_LIMIT} max={COORDINATE_LIMIT} value={coordinateX} onChange={(e)=>setCoordinateX(e.target.value)} required /></label>
                  <label>Z<input type="number" step="any" min={-COORDINATE_LIMIT} max={COORDINATE_LIMIT} value={coordinateZ} onChange={(e)=>setCoordinateZ(e.target.value)} required /></label>
                  <button className="button secondary" type="submit" aria-label="Travel to coordinates"><ArrowRight size={15}/></button>
                </form>
                <button className="button secondary full-width save-place" onClick={()=>{setBookmarks((current)=>[...current,{id:newId(),name:report.biome||'Saved place',x:travel.x,z:travel.z}]);notify('Place bookmarked. You can return after reloading.');}}><BookmarkPlus size={14}/>Save this place</button>
                {bookmarks.length>0&&<div className="bookmark-list">{bookmarks.map((b)=><div key={b.id}><button onClick={()=>travelTo(b.x,b.z)}><MapPin size={13}/><span>{b.name}<small>{Math.round(b.x)}, {Math.round(b.z)}</small></span></button><IconButton label={`Remove ${b.name} bookmark`} onClick={()=>setBookmarks((current)=>current.filter((item)=>item.id!==b.id))}><X size={12}/></IconButton></div>)}</div>}
              </div>
              <div className="rail-block">
                <p className="label-mini">WALK ME SOMEWHERE</p>
                <div className="visit-list">
                  {biomeRows.map((row) => (
                    <button key={row.id} disabled={travelBusy} className={`visit-chip ${row.present ? 'here' : ''}`} onClick={() => void visitBiome(row.id)}>
                      <span className="visit-swatch"><i style={{ background: row.colors[0] }} /><i style={{ background: row.colors[1] }} /></span>
                      <span>{row.name}</span>
                      {row.present ? <span className="visit-here">here</span> : <ArrowRight size={12} />}
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          )}

          <div className="workspace-watermark">{stats.pending>0?<><LoaderCircle size={12} className="spinning"/><span>Exploring new terrain...</span></>:<><Sprout size={12} strokeWidth={1.5}/><span>The horizon keeps going.</span></>}</div>
        </main>
      </div>

      <footer className="studio-statusbar">
        <div className={`save-status ${saveStatus}`}><span className="status-dot" /><span>{!ready?'Restoring world...':saveStatus === 'saved' ? 'World saved locally' : saveStatus === 'saving' ? 'Saving world...' : 'Storage unavailable. Export to save.'}</span></div>
        <div className="scene-stats">
          <span><Box size={11} />{stats.triangles ? `${(stats.triangles / 1000).toFixed(0)}k tris` : 'measuring…'}</span><i />
          <span>{stats.chunks || 0} chunks{stats.pending ? <em className="pending">+{stats.pending}</em> : null}</span><i />
          <span>{stats.props || 0} props</span><i />
          <span>{stats.drawCalls || 0} draw calls</span><i />
          <span>{values.chunkSize} m tiles · {values.segments}²</span><i />
          <button onClick={() => setModal('guide')}><Keyboard size={12} /><span>shortcuts</span></button>
        </div>
        <span className="engine-status"><span />WebGL 2 · meters · Y-up</span>
      </footer>

      <input className="visually-hidden" type="file" ref={importRef} accept=".json,application/json" onChange={(event) => void handleImport(event.target.files?.[0])} aria-label="Open a Terra world file" />
      <div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite"><CheckCircle2 size={16} /><span>{toast}</span><button aria-label="Dismiss" onClick={() => setToast('')}><X size={13} /></button></div>

      {modal === 'biomes' && (
        <Modal title="Twenty biomes. No hard borders." eyebrow="THE ATLAS" description="Find a landscape in your current world, or choose Shifting wilds to explore the full collection." onClose={() => setModal(null)} className="biomes-modal">
          <div className="biome-grid">
            {BIOMES.map((biome) => {
              const swatch = BIOME_SWATCHES[biome.id];
              const here = values.world && activeWorld?.mix.includes(biome.id);
              return (
                  <button key={biome.id} disabled={!here||travelBusy} className={`biome-card ${here ? 'in-world' : ''}`} onClick={() => void visitBiome(biome.id)} title={here ? 'Travel to a nearby patch' : 'Not in this world. Choose Shifting wilds to include it.'}>
                  <span className="biome-strip"><i style={{ background: swatch[0] }} /><i style={{ background: swatch[2] }} /><i style={{ background: swatch[1] }} /></span>
                  <h3>{biome.name}{here && <em>in this world</em>}</h3>
                  <p>{BIOME_LORE[biome.id]}</p>
                  <span className="biome-stats"><span>relief {Math.round(biome.floor * 100)}</span><span>cold {Math.round(biome.cold * 100)}</span><span>canopy {Math.round(biome.canopy * 100)}</span></span>
                </button>
              );
            })}
          </div>
          <p className="modal-footnote">Climate, colour and relief all come from the same weights, which is why the ground changes its mind gradually.</p>
        </Modal>
      )}

      {modal==='saved'&&<Modal title="Your saved worlds." eyebrow="LOCAL LIBRARY" description="Stored on this device. Export a world file to move it elsewhere or keep a backup." onClose={()=>setModal(null)} className="saved-modal">
        {worldLibrary.length===0?<p className="disabled-note">No archived worlds yet. Create another world to add to your library.</p>:<div className="saved-world-list">{worldLibrary.map((item)=><button key={item.id} onClick={()=>{try{const doc=validateProject(JSON.parse(item.json));openDocument(doc);setModal(null);notify('Saved world restored.');}catch(error){notify(error instanceof Error?error.message:'This world could not be loaded.');}}}><Globe2 size={21}/><span><strong>{item.name}</strong><small>{new Date(item.updatedAt).toLocaleDateString()} {item.id===projectId?' / current world':''}</small></span><ArrowRight size={16}/></button>)}</div>}
      </Modal>}

      {modal === 'export' && (
        <Modal title="Take the world with you." eyebrow="EXPORT" description="Source modules keep the endless field and your sculpting. A snapshot freezes the ground currently streamed in." onClose={() => { if (!exporting) setModal(null); }} className="export-modal">
          <div className="export-formats">
            {FORMAT_OPTIONS.map((option) => (
              <button disabled={exporting} key={option.id} className={`export-format ${format === option.id ? 'selected' : ''}`} onClick={() => setFormat(option.id)} aria-pressed={format === option.id}>
                <span className="format-icon"><option.icon size={20} strokeWidth={1.55} /></span>
                <span className="format-copy">
                  <span className="format-title">{option.title}<span className="format-extension">{option.extension}</span></span>
                  <span className="format-description">{option.blurb}</span>
                </span>
                <span className="format-radio">{format === option.id && <span />}</span>
              </button>
            ))}
          </div>
          {format !== 'project' && (
            <div className="export-options">
              <div className="setting-row"><span>Include trees &amp; stone</span><Toggle label="Include props" checked={includeProps} onChange={setIncludeProps} /></div>
              <div className="setting-row"><span>Merge for production<span className="setting-description">One draw call per tile. Turn off to keep surface and skirt selectable.</span></span><Toggle label="Merge for production" checked={mergeExport} onChange={setMergeExport} /></div>
            </div>
          )}
          {format === 'source' && <p className="export-detail"><Package size={14} />Three independent assets, scene composition, and a roaming preview.</p>}
          {format === 'glb' && <p className="export-detail"><Navigation size={14} />{(scene.radius * 2 + 1)}×{(scene.radius * 2 + 1)} chunk region centred at your position.</p>}
          {exportError && <p className="export-error" role="alert">{exportError}</p>}
          <button className="button primary full-width download-button" disabled={exporting} onClick={() => void handleExport()}>
            {exporting ? <LoaderCircle size={16} className="spinning" /> : <Download size={16} />}
            {exporting ? 'Packing…' : format === 'source' ? 'Download world package' : format === 'glb' ? 'Download 3D snapshot' : 'Download world file'}
            <span>{format === 'source' ? '.zip' : format === 'glb' ? '.glb' : '.json'}</span>
          </button>
          {format === 'source' && <button className="text-action terrain-only" disabled={exporting} onClick={() => { exportTerrainModule(name, project, mergeExport); notify('One module, your whole field. '); }}>Just the terrain field (.mjs)<ArrowRight size={12} /></button>}
        </Modal>
      )}

      {modal === 'guide' && (
        <Modal title="How this world works." eyebrow="FIELD GUIDE" description="Five sculpting brushes, one continuous world, and more to explore." onClose={() => setModal(null)} className="guide-modal">
          <div className="guide-section"><Navigation size={20} strokeWidth={1.5} /><div><h3>Roam</h3><p>Drag to orbit, scroll to zoom, right-drag or two fingers to pan. <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> and the arrow keys walk the world; hold <kbd>Shift</kbd> to run. Chunks stream in around you and the atlas follows your position.</p></div></div>
          <div className="guide-section"><SlidersHorizontal size={20} strokeWidth={1.5} /><div><h3>Terraform</h3><p>Pick a brush, then drag across the land. Raise and Carve push height, Flatten levels to the height where your stroke began, Calm wears detail away while keeping the form, Roughen does the opposite. Hold <kbd>Shift</kbd> with Raise to carve instead.</p></div></div>
          <div className="guide-section"><Globe2 size={20} strokeWidth={1.5} /><div><h3>Blend</h3><p>Biomes never switch abruptly: relief, colour, snowline and canopy all come from the same blended weights, so a valley can walk you from salt flat to taiga in a few hundred meters.</p></div></div>
          <div className="shortcut-list">
            <h3>Shortcuts</h3>
            <div><span>Look · Raise · Carve · Flatten · Calm · Roughen</span><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd><kbd>5</kbd><kbd>6</kbd></span></div>
            <div><span>Undo / Redo</span><span><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Shift</kbd>+<kbd>Z</kbd></span></div>
            <div><span>Fit view · Lattice · Atlas · Guide</span><span><kbd>F</kbd><kbd>G</kbd><kbd>M</kbd><kbd>?</kbd></span></div>
          </div>
          <p className="guide-note"><CheckCircle2 size={14} />All strokes, bookmarks, and your position are saved locally. Export a backup before clearing browser data.</p>
          <button className="button primary full-width" onClick={() => setModal(null)}>Go and make something<ArrowRight size={14} /></button>
        </Modal>
      )}

      {modal === 'new' && (
        <Modal title="Start a new world." eyebrow="A FRESH HORIZON" description="Your current world will remain in Saved worlds. A new seed gives you a different landscape to explore." onClose={() => setModal(null)} className="new-project-modal">
          <button className="button secondary full-width" onClick={() => { download(serializeProject(name, project), `${filenameFor(name)}.terra.json`, 'application/json'); notify('Saved. This world is safe in your downloads.'); }}><Download size={15} />Keep a copy of this world</button>
          <div className="confirm-actions">
            <button className="button secondary" onClick={() => setModal(null)}>Stay here</button>
            <button className="button primary" onClick={() => void startFresh('shifting-wilds')}>Begin fresh<ArrowRight size={14} /></button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const BIOME_KEY_BY_NAME: Record<string, string> = Object.fromEntries(BIOMES.map((biome) => [biome.name, biome.id]));
