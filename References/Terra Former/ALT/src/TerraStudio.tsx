import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlignVerticalSpaceAround, ArrowDownToLine, ArrowRight, ArrowUpFromLine, Box, Camera,
  Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Download, FileJson,
  Focus, FolderOpen, FolderPlus, Grid2X2, Hand, Keyboard, Layers3, LoaderCircle,
  Maximize2, Minus, Moon, Mountain, Mouse, Move, Package, Palette, PanelLeftOpen,
  Plus, Redo2, RefreshCw, RotateCcw, Search, Settings2, Shuffle, SlidersHorizontal,
  Sparkles, Sprout, Sun, TreePine, Undo2, Waves, X,
} from 'lucide-react';
import { TerrainViewport } from './components/TerrainViewport';
import type { ViewportHandle } from './components/TerrainViewport';
import { PresetArt } from './components/PresetArt';
import { IconButton, Modal, PanelSection, RangeControl, Toggle } from './components/Controls';
import { COLORWAYS, params as terrainMetadata } from './assets/terrain.mjs';
import { sceneParams as sceneMetadata } from './assets/scene.mjs';
import { download, exportProject, exportTerrainModule, filenameFor } from './export-project';
import type { ExportFormat } from './export-project';
import { DEFAULT_BRUSH, DEFAULT_PARAMS, DEFAULT_VIEW, PRESETS, loadProject, serializeProject, validateProject } from './studio';
import type { BrushSettings, ProjectState, SceneStats, StudioParams, Tab, TerrainKind, Tool, ViewSettings } from './studio';

type HistoryState = { past: ProjectState[]; present: ProjectState; future: ProjectState[]; lastKey: string; lastTime: number };
type ModalType = 'presets' | 'export' | 'guide' | 'new' | null;
const PARAM_METADATA = { ...terrainMetadata, ...sceneMetadata };
const GEOMETRY_KEYS = ['terrainType', 'size', 'elevation', 'roughness', 'resolution', 'seed'];
const TOOLS = [
  { id: 'orbit' as Tool, name: 'Orbit', description: 'Find a new perspective', icon: Hand, key: '1' },
  { id: 'raise' as Tool, name: 'Raise', description: 'Bring new peaks to life', icon: ArrowUpFromLine, key: '2' },
  { id: 'lower' as Tool, name: 'Lower', description: 'Carve out a quiet valley', icon: ArrowDownToLine, key: '3' },
  { id: 'smooth' as Tool, name: 'Smooth', description: 'Soften the edges', icon: Waves, key: '4' },
  { id: 'flatten' as Tool, name: 'Flatten', description: 'Make a little level ground', icon: AlignVerticalSpaceAround, key: '5' },
];
const FORMAT_OPTIONS = [
  { id: 'source' as ExportFormat, title: 'Three.js source', extension: '.zip', description: 'Editable models + an interactive web preview', icon: Package },
  { id: 'glb' as ExportFormat, title: '3D model', extension: '.glb', description: 'Take your landscape into Blender, Unity, and more', icon: Box },
  { id: 'project' as ExportFormat, title: 'Terra project', extension: '.json', description: 'Save your settings and come back to creating', icon: FileJson },
];

function Logo() {
  return <div className="brand"><svg width="35" height="35" viewBox="0 0 36 36" fill="none" aria-hidden="true"><rect width="36" height="36" rx="10" fill="#32664b" /><path d="M7.5 23.5 15.3 11.2a3.2 3.2 0 0 1 5.4 0L28.5 23.5" stroke="#ecf2e6" strokeWidth="1.65" strokeLinecap="round" /><path d="m10.9 25.1 5.6-8.9a1.8 1.8 0 0 1 3 0l5.6 8.9M14.3 26.6l3-4.8a.8.8 0 0 1 1.4 0l3 4.8" stroke="#c5d9b5" strokeWidth="1.6" strokeLinecap="round" /></svg><span>terra<span className="brand-period">.</span></span></div>;
}

function ParamRange({ param, values, onChange, label, display }: { param: keyof StudioParams; values: StudioParams; onChange: <K extends keyof StudioParams>(key: K, value: StudioParams[K]) => void; label?: string; display?: string }) {
  const schema = PARAM_METADATA[param];
  return <RangeControl label={label || schema.label} value={Number(values[param])} min={schema.min ?? 0} max={schema.max ?? 100} step={schema.step ?? 1} display={display} onChange={(value) => onChange(param, value)} />;
}

function AxisWidget() {
  return <svg className="axis-widget" width="67" height="65" viewBox="0 0 67 65" aria-label="Y-up coordinate system"><path d="M32 35V11" stroke="#6f906d" strokeWidth="1.5" /><path d="m32 35 22 12" stroke="#b87869" strokeWidth="1.5" /><path d="m32 35-20 13" stroke="#6f91ab" strokeWidth="1.5" /><circle cx="32" cy="35" r="3.4" fill="#fbfcf8" stroke="#b2bfb0" strokeWidth="1.3" /><text x="28" y="8" fill="#648561">Y</text><text x="55" y="54" fill="#ad7264">X</text><text x="4" y="55" fill="#6c8ba3">Z</text></svg>;
}

export default function TerraStudio() {
  const [initial] = useState(loadProject);
  const [name, setName] = useState(initial.name);
  const [history, setHistory] = useState<HistoryState>({ past: [], present: initial.state, future: [], lastKey: '', lastTime: 0 });
  const project = history.present, values = project.params;
  const [tab, setTab] = useState<Tab>('terrain');
  const [tool, setTool] = useState<Tool>('orbit');
  const [brush, setBrush] = useState<BrushSettings>(DEFAULT_BRUSH);
  const [view, setView] = useState<ViewSettings>(DEFAULT_VIEW);
  const [stats, setStats] = useState<SceneStats>({ triangles: 0, meshes: 0, trees: 0, rocks: 0, zoom: 100 });
  const [modal, setModal] = useState<ModalType>(null);
  const [projectMenu, setProjectMenu] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unavailable'>('saved');
  const [regenerating, setRegenerating] = useState(false);
  const [toast, setToast] = useState('');
  const [presetSearch, setPresetSearch] = useState('');
  const [format, setFormat] = useState<ExportFormat>('source');
  const [includeProps, setIncludeProps] = useState(true);
  const [mergeExport, setMergeExport] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [cameraView, setCameraView] = useState<'3d' | 'top'>('3d');
  const viewportRef = useRef<ViewportHandle>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regenerateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activePreset = PRESETS.find((preset) => preset.id === values.terrainType) || PRESETS[0];

  const notify = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message); toastTimer.current = setTimeout(() => setToast(''), 3600);
  }, []);

  const commit = useCallback((update: (state: ProjectState) => ProjectState, key = 'action') => {
    const time = Date.now();
    setHistory((current) => {
      const next = update(current.present); if (next === current.present) return current;
      const combine = key.startsWith('param:') && current.lastKey === key && time - current.lastTime < 650;
      return { past: combine ? current.past : [...current.past, current.present].slice(-35), present: next, future: [], lastKey: key, lastTime: time };
    });
  }, []);

  const updateParam = useCallback(<K extends keyof StudioParams,>(key: K, value: StudioParams[K]) => {
    commit((state) => state.params[key] === value ? state : { params: { ...state.params, [key]: value }, heights: GEOMETRY_KEYS.includes(key) ? null : state.heights }, `param:${key}`);
  }, [commit]);

  const undo = useCallback(() => {
    setHistory((current) => !current.past.length ? current : { past: current.past.slice(0, -1), present: current.past[current.past.length - 1], future: [current.present, ...current.future], lastKey: '', lastTime: 0 });
  }, []);
  const redo = useCallback(() => {
    setHistory((current) => !current.future.length ? current : { past: [...current.past, current.present], present: current.future[0], future: current.future.slice(1), lastKey: '', lastTime: 0 });
  }, []);
  const onSculpt = useCallback((heights: number[]) => commit((state) => ({ ...state, heights }), 'sculpt'), [commit]);
  const chooseTool = useCallback((next: Tool) => { setTool(next); if (next !== 'orbit') setTab('sculpt'); }, []);

  useEffect(() => { if (tab === 'sculpt') setTool((current) => current === 'orbit' ? 'raise' : current); }, [tab]);

  useEffect(() => {
    setSaveStatus('saving');
    const save = () => { try { localStorage.setItem('terra-project', serializeProject(name, project)); setSaveStatus('saved'); } catch { setSaveStatus('unavailable'); } };
    const timer = setTimeout(save, 650);
    window.addEventListener('pagehide', save);
    return () => { clearTimeout(timer); window.removeEventListener('pagehide', save); };
  }, [name, project]);

  useEffect(() => {
    if (!projectMenu) return;
    const handler = (event: PointerEvent) => { if (!projectMenuRef.current?.contains(event.target as Node)) setProjectMenu(false); };
    document.addEventListener('pointerdown', handler); return () => document.removeEventListener('pointerdown', handler);
  }, [projectMenu]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === 'Escape' && !modal) { setProjectMenu(false); setMobileSidebar(false); setTool('orbit'); return; }
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return;
      if (modal) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const next = TOOLS.find((item) => item.key === event.key); if (next) { event.preventDefault(); chooseTool(next.id); }
      if (event.key.toLowerCase() === 'f') { viewportRef.current?.fit(); setCameraView('3d'); }
      if (event.key.toLowerCase() === 'g') setView((current) => ({ ...current, grid: !current.grid }));
      if (event.key === '?') setModal('guide');
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [modal, undo, redo, chooseTool]);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); if (regenerateTimer.current) clearTimeout(regenerateTimer.current); }, []);

  const applyPreset = (id: TerrainKind) => {
    const preset = PRESETS.find((item) => item.id === id); if (!preset) return;
    commit((state) => ({ params: { ...state.params, ...preset.settings, terrainType: id, meadow: undefined, waterTint: undefined }, heights: null }), 'preset');
    setModal(null); setTool('orbit'); setTab('terrain');
    if (window.innerWidth < 760) setMobileSidebar(false);
  };
  const regenerate = () => {
    const seed = Math.floor(Math.random() * 99998) + 1;
    commit((state) => ({ params: { ...state.params, seed }, heights: null }), 'generate');
    setRegenerating(true); if (regenerateTimer.current) clearTimeout(regenerateTimer.current);
    regenerateTimer.current = setTimeout(() => setRegenerating(false), 650);
    notify('A fresh perspective. Your new landscape is ready.');
  };
  const resetTerrain = () => { commit(() => ({ params: { ...DEFAULT_PARAMS }, heights: null }), 'reset'); setTool('orbit'); notify('Back to the original alpine valley.'); };
  const startNew = () => {
    setHistory({ past: [], present: { params: { ...DEFAULT_PARAMS }, heights: null }, future: [], lastKey: '', lastTime: 0 });
    setName('Untitled landscape'); setView(DEFAULT_VIEW); setTool('orbit'); setTab('terrain'); setModal(null); viewportRef.current?.fit(); notify('A new world, a new beginning.');
  };
  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('This file is too large. Terra projects must be smaller than 8 MB.');
      const imported = validateProject(JSON.parse(await file.text()));
      setName(imported.name); commit(() => imported.state, 'import'); setTool('orbit'); setProjectMenu(false); notify('Your landscape is right where you left it.');
    } catch (error) { notify(error instanceof Error ? error.message : 'This project could not be imported.'); }
    if (importRef.current) importRef.current.value = '';
  };
  const handleExport = async () => {
    setExporting(true); setExportError('');
    try { await exportProject(format, name, project, includeProps, mergeExport); setModal(null); notify('Your landscape is packed and ready to go.'); }
    catch (error) { setExportError(error instanceof Error ? error.message : 'Export failed. Please try a different format.'); }
    finally { setExporting(false); }
  };
  const screenshot = () => {
    const data = viewportRef.current?.screenshot(); if (!data) { notify('The viewport is not ready yet.'); return; }
    const link = document.createElement('a'); link.href = data; link.download = `${filenameFor(name)}.png`; link.click(); notify('A little piece of your world, captured.');
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else { const workspace = document.querySelector('.workspace'); if (!workspace?.requestFullscreen) throw new Error(); await workspace.requestFullscreen(); }
    } catch { notify('Fullscreen is not available in this browser.'); }
  };
  const switchView = (key: keyof ViewSettings, value: boolean) => setView((current) => ({ ...current, [key]: value }));
  const setPalette = (colorway: StudioParams['colorway']) => commit((state) => ({ ...state, params: { ...state.params, colorway, meadow: undefined, waterTint: undefined } }), 'palette');

  return <div className="studio-app">
    <header className="app-header">
      <div className="header-brand"><Logo /><span className="brand-divider" /><span className="product-name">Terrain studio</span></div>
      <div ref={projectMenuRef} className="project-control">
        <button className={`project-trigger ${projectMenu ? 'is-open' : ''}`} onClick={() => setProjectMenu(!projectMenu)} aria-expanded={projectMenu} aria-haspopup="dialog"><span>{name}</span><ChevronDown size={14} /></button>
        {projectMenu && <div className="project-popover"><p className="eyebrow">YOUR PROJECT</p><label className="project-name-label" htmlFor="project-name">Landscape name</label><input id="project-name" className="text-input" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} onBlur={() => { if (!name.trim()) setName('Untitled landscape'); }} /><div className="popover-divider" /><button onClick={() => { setProjectMenu(false); setModal('new'); }}><FolderPlus size={16} />New landscape</button><button onClick={() => importRef.current?.click()}><FolderOpen size={16} />Open a project<span>.json</span></button><button onClick={() => { download(serializeProject(name, project), `${filenameFor(name)}.terra.json`, 'application/json'); setProjectMenu(false); notify('Project downloaded. Keep this one close.'); }}><Download size={16} />Save a project copy</button><p className="project-local-note"><span className="status-dot" />Your work is saved in this browser.</p></div>}
      </div>
      <nav className="header-actions" aria-label="Studio actions"><button className="header-link" onClick={() => { setPresetSearch(''); setModal('presets'); }}><Grid2X2 size={15} /><span>Presets</span></button><IconButton label="Quick guide and keyboard shortcuts" className="help-button" onClick={() => setModal('guide')}><CircleHelp size={18} /></IconButton><span className="header-actions-divider" /><button className="button primary export-button" onClick={() => { setExportError(''); setModal('export'); }}><Download size={16} /><span>Export</span><ChevronDown size={13} /></button></nav>
    </header>
    <div className="studio-body">
      {mobileSidebar && <button className="sidebar-backdrop" aria-label="Close controls" onClick={() => setMobileSidebar(false)} />}
      <aside className={`sidebar ${mobileSidebar ? 'mobile-open' : ''}`} aria-label="Terrain controls">
        <div className="sidebar-tabs" role="tablist" aria-label="Editor modes">{([{ id: 'terrain', label: 'Terrain', icon: Mountain }, { id: 'sculpt', label: 'Sculpt', icon: SlidersHorizontal }, { id: 'scene', label: 'Scene', icon: Layers3 }] as const).map((item) => <button key={item.id} id={`tab-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls={`panel-${item.id}`} className={tab === item.id ? 'selected' : ''} onClick={() => { setTab(item.id); if (item.id !== 'sculpt') setTool('orbit'); }}><item.icon size={15} />{item.label}</button>)}<IconButton label="Close controls" className="mobile-close" onClick={() => setMobileSidebar(false)}><X size={16} /></IconButton></div>
        <div className="sidebar-scroll" key={tab} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'terrain' && <>
            <section className="preset-section"><div className="label-heading"><h2>START WITH A LANDSCAPE</h2><button title="Browse all landscapes" onClick={() => { setPresetSearch(''); setModal('presets'); }}><span>View all</span><ChevronRight size={12} /></button></div><div className="preset-grid">{PRESETS.slice(0, 4).map((preset) => <button className={`preset-card ${values.terrainType === preset.id ? 'selected' : ''}`} key={preset.id} onClick={() => applyPreset(preset.id)} aria-pressed={values.terrainType === preset.id}><PresetArt kind={preset.id} /><span className="preset-card-label">{preset.name}{values.terrainType === preset.id && <span className="preset-check"><Check size={10} strokeWidth={2.6} /></span>}</span></button>)}</div></section>
            <PanelSection title="Terrain shape" icon={<Mountain size={15} />} action={<IconButton label="Reset terrain to default" className="section-reset" onClick={resetTerrain}><RotateCcw size={13} /></IconButton>}>
              <ParamRange param="size" values={values} onChange={updateParam} label="Size" display={`${values.size} m`} /><ParamRange param="elevation" values={values} onChange={updateParam} display={`${values.elevation} m`} /><ParamRange param="roughness" values={values} onChange={updateParam} display={`${Math.round(values.roughness * 100)}%`} />
              <div className="seed-control"><label htmlFor="terrain-seed">Seed<span title="The same seed recreates the same landscape."><CircleHelp size={12} /></span></label><div><input id="terrain-seed" type="number" min={1} max={99999} value={values.seed} onChange={(event) => updateParam('seed', Math.max(1, Math.min(99999, Math.round(Number(event.target.value)))))} /><IconButton label="Randomize terrain seed" onClick={regenerate}><Shuffle size={14} /></IconButton></div></div>
            </PanelSection>
            <PanelSection title="Water" icon={<Waves size={16} />} action={<Toggle label="Show water" checked={values.water} onChange={(value) => updateParam('water', value)} />}>{values.water ? <ParamRange param="waterLevel" values={values} onChange={updateParam} label="Water level" display={`${values.waterLevel.toFixed(1)} m`} /> : <p className="disabled-note">A world on dry land. Turn on water to fill its valleys.</p>}</PanelSection>
            <PanelSection title="Vegetation" icon={<TreePine size={16} />} action={<Toggle label="Show vegetation" checked={values.vegetation} onChange={(value) => updateParam('vegetation', value)} />}>{values.vegetation ? <><ParamRange param="density" values={values} onChange={updateParam} label="Density" display={`${Math.round(values.density * 100)}%`} />{['desert', 'volcanic', 'canyon'].includes(values.terrainType) && <p className="disabled-note">Trees grow in alpine, meadow, and island landscapes.</p>}</> : <p className="disabled-note">Leave the land open, or add a little forest.</p>}</PanelSection>
          </>}
          {tab === 'sculpt' && <>
            <div className="panel-intro"><p className="eyebrow">A PERSONAL TOUCH</p><h2>Follow the contours.</h2><p>Big mountains or little moments.<br />Make this landscape your own.</p></div>
            <section className="sculpt-tools"><div className="label-heading"><h2>SCULPTING TOOLS</h2><span className="keyboard-hint">2 - 5</span></div><div className="sculpt-tool-grid">{TOOLS.filter((item) => item.id !== 'orbit').map((item) => <button key={item.id} className={`sculpt-tool ${tool === item.id ? 'selected' : ''}`} onClick={() => chooseTool(item.id)} aria-pressed={tool === item.id}><item.icon size={21} strokeWidth={1.6} /><span>{item.name}</span>{tool === item.id && <Check size={12} className="tool-check" />}</button>)}</div></section>
            <PanelSection title="Brush settings" icon={<SlidersHorizontal size={15} />}><RangeControl label="Brush radius" min={3} max={28} value={brush.size} display={`${brush.size} m`} onChange={(size) => setBrush((current) => ({ ...current, size }))} /><RangeControl label="Strength" min={0.05} max={1} step={0.01} value={brush.strength} display={`${Math.round(brush.strength * 100)}%`} onChange={(strength) => setBrush((current) => ({ ...current, strength }))} /><div className="select-control"><label htmlFor="falloff">Brush falloff</label><div className="select-wrapper"><select id="falloff" value={brush.falloff} onChange={(event) => setBrush((current) => ({ ...current, falloff: event.target.value as BrushSettings['falloff'] }))}><option value="soft">Soft & natural</option><option value="linear">Linear</option><option value="hard">Hard edge</option></select><ChevronDown size={13} /></div></div></PanelSection>
            <div className="sculpt-tip"><Mouse size={18} strokeWidth={1.5} /><p>Click and drag on the landscape to sculpt. Hold <kbd>Shift</kbd> while raising to carve down instead.</p></div>
            <PanelSection title="Finishing touches" icon={<Sparkles size={15} />}><button className="button secondary full-width" onClick={() => { viewportRef.current?.soften(); notify('A softer, more weathered landscape.'); }}><Waves size={15} />Soften entire landscape</button><button className="text-action reset-sculpt" disabled={!project.heights} onClick={() => { commit((state) => ({ ...state, heights: null }), 'reset-sculpt'); notify('Sculpting cleared. Your terrain settings are unchanged.'); }}><RotateCcw size={13} />Reset sculpting</button></PanelSection>
          </>}
          {tab === 'scene' && <>
            <div className="panel-intro"><p className="eyebrow">THE FINISHING TOUCHES</p><h2>A world of details.</h2><p>Set the mood. Find your palette.<br />Let the little things bring it to life.</p></div>
            <section className="scene-layers"><div className="label-heading"><h2>SCENE LAYERS</h2><span className="layer-count">5 layers</span></div><div className="layer-row"><Mountain size={17} /><span>Landscape<span className="layer-description">{values.resolution} x {values.resolution} mesh</span></span><span className="layer-active-dot" /></div><div className="layer-row"><Waves size={17} /><span>Water<span className="layer-description">Rivers & shallows</span></span><Toggle label="Water layer" checked={values.water} onChange={(value) => updateParam('water', value)} /></div><div className="layer-row"><TreePine size={17} /><span>Pine forest<span className="layer-description">{stats.trees} trees</span></span><Toggle label="Pine forest layer" checked={values.vegetation} onChange={(value) => updateParam('vegetation', value)} /></div><div className="layer-row"><Box size={17} /><span>Scattered rocks<span className="layer-description">{stats.rocks} stones</span></span><Toggle label="Rock layer" checked={values.rocks} onChange={(value) => updateParam('rocks', value)} /></div><div className="layer-row"><Layers3 size={17} /><span>Geological base<span className="layer-description">Layers of earth</span></span><Toggle label="Geological base layer" checked={values.base} onChange={(value) => updateParam('base', value)} /></div></section>
            <PanelSection title="Color & atmosphere" icon={<Palette size={15} />}><div className="palette-options">{([{ id: 'default', name: 'Evergreen' }, { id: 'autumn', name: 'Harvest' }, { id: 'moonstone', name: 'Moonstone' }] as const).map((palette) => <button key={palette.id} onClick={() => setPalette(palette.id)} className={`palette-option ${values.colorway === palette.id ? 'selected' : ''}`} aria-pressed={values.colorway === palette.id}><span className="palette-swatches">{['meadow', 'forest', 'water'].map((zone) => <i key={zone} style={{ backgroundColor: COLORWAYS[palette.id][zone] }} />)}</span><span>{palette.name}</span></button>)}</div><div className="color-control"><label htmlFor="meadow-color">Meadow color</label><div><span>{values.meadow || COLORWAYS[values.colorway].meadow}</span><input id="meadow-color" type="color" value={values.meadow || COLORWAYS[values.colorway].meadow} onChange={(event) => updateParam('meadow', event.target.value)} /></div></div><div className="color-control"><label htmlFor="water-color">Water color</label><div><span>{values.waterTint || COLORWAYS[values.colorway].water}</span><input id="water-color" type="color" value={values.waterTint || COLORWAYS[values.colorway].water} onChange={(event) => updateParam('waterTint', event.target.value)} /></div></div><div className="setting-row"><span>Snow caps</span><Toggle label="Snow caps" checked={values.snow} onChange={(value) => updateParam('snow', value)} /></div>{values.snow && values.terrainType === 'alpine' && <ParamRange param="snowLine" values={values} onChange={updateParam} display={`${Math.round(values.snowLine * 100)}%`} />}</PanelSection>
            <PanelSection title="Viewport" icon={<Settings2 size={15} />}>{([{ key: 'grid', label: 'Ground grid' }, { key: 'shadows', label: 'Soft shadows' }, { key: 'wireframe', label: 'Wireframe' }, { key: 'autoRotate', label: 'Auto rotate' }] as const).map((item) => <div className="setting-row" key={item.key}><span>{item.label}</span><Toggle label={item.label} checked={view[item.key]} onChange={(value) => switchView(item.key, value)} /></div>)}<div className="select-control mesh-quality"><label htmlFor="mesh-quality">Mesh quality</label><div className="select-wrapper"><select id="mesh-quality" value={values.resolution} onChange={(event) => updateParam('resolution', Number(event.target.value))}>{(terrainMetadata.resolution.options || []).map((value) => <option key={value} value={value}>{value === 40 ? 'Draft' : value === 64 ? 'Standard' : value === 80 ? 'Balanced' : 'High detail'} ({value} x {value})</option>)}</select><ChevronDown size={13} /></div></div></PanelSection>
          </>}
        </div>
        <div className="sidebar-footer"><button className="button regenerate-button" onClick={regenerate}><RefreshCw size={15} className={regenerating ? 'spinning' : ''} /><span>{regenerating ? 'Shaping your world...' : 'Regenerate terrain'}</span><span className="regenerate-spark"><Sparkles size={13} /></span></button><p>A new seed. A new possibility.</p></div>
      </aside>

      <main className={`workspace ${view.night ? 'is-night' : ''}`} aria-label="Landscape workspace">
        <TerrainViewport ref={viewportRef} project={project} view={view} tool={tool} brush={brush} onStats={setStats} onSculpt={onSculpt} />
        <div className="canvas-topbar"><div className="workspace-title"><button className="mobile-controls-button" onClick={() => setMobileSidebar(true)} aria-label="Open terrain controls"><PanelLeftOpen size={18} /></button><div><p className="eyebrow">A LITTLE WORLD, MADE BY YOU</p><h1>{activePreset.sceneName}<span className="live-dot" title="Live 3D preview" /></h1></div></div><div className="canvas-top-actions"><div className="history-controls"><IconButton label="Undo (Ctrl/Cmd + Z)" disabled={!history.past.length} onClick={undo}><Undo2 size={17} /></IconButton><IconButton label="Redo (Ctrl/Cmd + Shift + Z)" disabled={!history.future.length} onClick={redo}><Redo2 size={17} /></IconButton></div><span className="canvas-action-divider" /><div className="day-night-control" aria-label="Lighting"><button className={!view.night ? 'selected' : ''} onClick={() => switchView('night', false)} aria-pressed={!view.night} title="Daylight"><Sun size={15} /><span>Day</span></button><button className={view.night ? 'selected' : ''} onClick={() => switchView('night', true)} aria-pressed={view.night} title="Night lighting"><Moon size={14} /><span>Night</span></button></div></div></div>
        <div className="canvas-tool-rail" role="toolbar" aria-label="Terrain tools">{TOOLS.map((item, index) => <div key={item.id}>{index === 1 && <span className="tool-rail-divider" />}<IconButton label={`${item.name} (${item.key})`} active={tool === item.id} onClick={() => chooseTool(item.id)}><item.icon size={19} strokeWidth={1.65} /></IconButton></div>)}<span className="tool-rail-divider" /><IconButton label="Toggle ground grid (G)" active={view.grid} onClick={() => switchView('grid', !view.grid)}><Grid2X2 size={17} strokeWidth={1.65} /></IconButton></div>
        {tool !== 'orbit' && <div className="active-tool-hint"><span className="status-dot" />{TOOLS.find((item) => item.id === tool)?.name} brush<span className="hint-divider" />{brush.size} m<span className="hint-divider" /><span>Drag to sculpt</span></div>}
        <div className="canvas-utility-rail"><IconButton label="Capture landscape image" onClick={screenshot}><Camera size={18} strokeWidth={1.6} /></IconButton><IconButton label="Fullscreen workspace" onClick={fullscreen}><Maximize2 size={17} strokeWidth={1.6} /></IconButton></div><AxisWidget />
        <div className="navigation-hint"><span><Mouse size={14} />Drag to orbit</span><i /><span><kbd>Shift</kbd> + drag to pan</span><i /><span><Move size={13} />Scroll to zoom</span></div>
        <div className="view-controls"><div className="camera-view-control"><button className={cameraView === '3d' ? 'selected' : ''} onClick={() => { setCameraView('3d'); viewportRef.current?.setCameraView('3d'); }}>3D</button><button className={cameraView === 'top' ? 'selected' : ''} onClick={() => { setCameraView('top'); viewportRef.current?.setCameraView('top'); }}>Top</button></div><span className="view-control-divider" /><IconButton label="Zoom out" onClick={() => viewportRef.current?.zoom(1 / 1.16)}><Minus size={15} /></IconButton><span className="zoom-readout">{stats.zoom}%</span><IconButton label="Zoom in" onClick={() => viewportRef.current?.zoom(1.16)}><Plus size={15} /></IconButton><span className="view-control-divider" /><IconButton label="Fit landscape in view (F)" onClick={() => { viewportRef.current?.fit(); setCameraView('3d'); }}><Focus size={17} /></IconButton></div>
        <div className="workspace-watermark"><Sprout size={13} strokeWidth={1.5} /><span>Made of possibilities.</span></div>
      </main>
    </div>

    <footer className="studio-statusbar"><div className={`save-status ${saveStatus}`}><span className="status-dot" /><span>{saveStatus === 'saved' ? 'All changes saved locally' : saveStatus === 'saving' ? 'Saving your landscape...' : 'Browser storage full. Export to save.'}</span></div><div className="scene-stats"><span><Box size={12} />{stats.triangles ? `${(stats.triangles / 1000).toFixed(1)}k` : '...'} triangles</span><i /><span>{values.size} x {values.size} m</span><i /><span className="units-label">1 unit = 1 meter</span><i className="units-label" /><button onClick={() => setModal('guide')}><Keyboard size={13} /><span>Shortcuts</span></button></div><span className="engine-status"><span />WebGL 2</span></footer>
    <input className="visually-hidden" type="file" ref={importRef} accept=".json,application/json" onChange={(event) => void handleImport(event.target.files?.[0])} aria-label="Import a Terra project" />
    <div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite"><CheckCircle2 size={17} /><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={14} /></button></div>

    {modal === 'presets' && <Modal title="Every world starts somewhere." eyebrow="FIND YOUR LANDSCAPE" description="A starting point for wherever your imagination takes you." onClose={() => setModal(null)} className="presets-modal"><div className="preset-search"><Search size={17} /><input type="search" placeholder="Find your landscape..." aria-label="Search landscape presets" value={presetSearch} onChange={(event) => setPresetSearch(event.target.value)} /></div><div className="preset-library">{PRESETS.filter((preset) => `${preset.name} ${preset.description}`.toLowerCase().includes(presetSearch.toLowerCase())).map((preset) => <button key={preset.id} className={`library-preset ${values.terrainType === preset.id ? 'selected' : ''}`} onClick={() => applyPreset(preset.id)}><PresetArt kind={preset.id} large /><div className="library-preset-copy"><h3>{preset.name}{values.terrainType === preset.id ? <CheckCircle2 size={16} /> : <ArrowRight size={15} />}</h3><p>{preset.description}</p></div></button>)}</div>{!PRESETS.some((preset) => `${preset.name} ${preset.description}`.toLowerCase().includes(presetSearch.toLowerCase())) && <div className="empty-search"><Mountain size={28} /><h3>No landscapes found</h3><p>Try searching for mountains, islands, or sand.</p><button className="text-action" onClick={() => setPresetSearch('')}>Show all landscapes<ArrowRight size={14} /></button></div>}<p className="modal-footnote">Presets are just the beginning. Every detail is yours to shape.</p></Modal>}

    {modal === 'export' && <Modal title="Your landscape, anywhere." eyebrow="TAKE YOUR WORLD WITH YOU" description="Keep creating, wherever your next idea takes you." onClose={() => { if (!exporting) setModal(null); }} className="export-modal"><div className="export-formats">{FORMAT_OPTIONS.map((option) => <button disabled={exporting} key={option.id} className={`export-format ${format === option.id ? 'selected' : ''}`} onClick={() => setFormat(option.id)} aria-pressed={format === option.id}><span className="format-icon"><option.icon size={22} strokeWidth={1.6} /></span><span className="format-copy"><span className="format-title">{option.title}<span className="format-extension">{option.extension}</span></span><span className="format-description">{option.description}</span></span><span className="format-radio">{format === option.id && <span />}</span></button>)}</div>{format !== 'project' && <div className="export-options"><div className="setting-row"><span>Include trees & rocks</span><Toggle label="Include trees and rocks in export" checked={includeProps} onChange={setIncludeProps} /></div><div className="setting-row"><span>Optimize mesh performance<span className="setting-description">Merge parts by material. Turn off for individual selection.</span></span><Toggle label="Merge geometry for production" checked={mergeExport} onChange={setMergeExport} /></div></div>}{format === 'source' && <p className="export-detail"><Package size={15} />Includes three reusable models and a live HTML preview.</p>}{exportError && <p className="export-error" role="alert">{exportError}</p>}<button className="button primary full-width download-button" disabled={exporting} onClick={() => void handleExport()}>{exporting ? <LoaderCircle size={17} className="spinning" /> : <Download size={17} />}{exporting ? 'Packing up your landscape...' : `Download ${format === 'source' ? 'source package' : format === 'glb' ? '3D model' : 'project'}`}<span>{format === 'source' ? '.zip' : format === 'glb' ? '.glb' : '.json'}</span></button>{format === 'source' && <button className="text-action terrain-only" disabled={exporting} onClick={() => { exportTerrainModule(name, project, mergeExport); notify('Your terrain module is ready for its next world.'); }}>Just the terrain module (.mjs)<ArrowRight size={13} /></button>}</Modal>}

    {modal === 'guide' && <Modal title="A world at your fingertips." eyebrow="A QUICK FIELD GUIDE" description="A few simple tools. A whole landscape of possibilities." onClose={() => setModal(null)} className="guide-modal"><div className="guide-section"><Hand size={22} strokeWidth={1.5} /><div><h3>Find your perspective</h3><p>Drag to orbit your world. Scroll to zoom. Hold Shift and drag, or use the right mouse button, to pan.</p></div></div><div className="guide-section"><SlidersHorizontal size={22} strokeWidth={1.5} /><div><h3>Leave your mark</h3><p>Choose Raise, Lower, Smooth, or Flatten, then drag directly on the land. Adjust the brush radius and strength in Sculpt. Flatten matches the height where you start your stroke.</p></div></div><div className="guide-section"><TreePine size={22} strokeWidth={1.5} /><div><h3>Make it feel like somewhere</h3><p>Start from a preset, find a color palette in Scene, and bring in water and trees. A new seed gives you a fresh variation.</p></div></div><div className="shortcut-list"><h3>A few handy shortcuts</h3><div><span>Orbit / Raise / Lower / Smooth / Flatten</span><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd><kbd>5</kbd></span></div><div><span>Undo / Redo</span><span><kbd>Ctrl</kbd> + <kbd>Z</kbd> / <kbd>Shift</kbd> + <kbd>Z</kbd></span></div><div><span>Fit to view / Toggle grid</span><span><kbd>F</kbd><kbd>G</kbd></span></div></div><p className="guide-note"><CheckCircle2 size={15} />Your project stays in this browser. Export a copy to keep it safe.</p><button className="button primary full-width" onClick={() => setModal(null)}>Let's make something<ArrowRight size={15} /></button></Modal>}

    {modal === 'new' && <Modal title="A fresh patch of possibility." eyebrow="NEW LANDSCAPE" description="Starting a new landscape replaces this browser's saved project. You can download a copy before you begin." onClose={() => setModal(null)} className="new-project-modal"><button className="button secondary full-width" onClick={() => { download(serializeProject(name, project), `${filenameFor(name)}.terra.json`, 'application/json'); notify('Your current landscape is safely downloaded.'); }}><Download size={16} />Save a copy of this landscape</button><div className="confirm-actions"><button className="button secondary" onClick={() => setModal(null)}>Keep creating here</button><button className="button primary" onClick={startNew}>Start fresh<ArrowRight size={15} /></button></div></Modal>}
  </div>;
}