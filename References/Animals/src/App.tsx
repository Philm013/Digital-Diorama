import { useCallback, useDeferredValue, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDownToLine, ArrowRight, Bookmark, Box, Camera, Check, ChevronDown, CircleHelp, Code2, Compass, Download, Expand, Eye, FileCode2, Grid2X2, Layers3, Leaf, LoaderCircle, Menu, Moon, MousePointer2, Move, Network, Package, Pause, Play, Redo2, Rotate3D, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Sun, Undo2, X } from 'lucide-react';
import { ANIMALS, DEFAULT_ANIMAL, PHYLA, TAXONOMY_NOTE, type Animal, type AnimalOptions } from './data/catalog';
import Library, { type SavedVariant } from './components/Library';
import Inspector, { type InspectorTab } from './components/Inspector';
import Viewport, { type CameraView, type ViewportHandle } from './components/Viewport';
import Modal from './components/Modal';
import { downloadDataUrl, formatLength, type ModelStats } from './engine/studio';
import { exportAnimal, validateCollection, type ExportFormat } from './engine/exports';
import { useHistory } from './hooks/useHistory';

const DRAFT_KEY = 'wildform-studio-draft-v1';
const COLLECTION_KEY = 'wildform-collection-v1';
type ModalType = 'export' | 'save' | 'phyla' | 'about' | 'help' | null;

function getInitialDraft(): { animal: Animal; options: AnimalOptions } {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    const animal = ANIMALS.find(item => item.id === draft?.animalId);
    if (animal && draft.options && typeof draft.options === 'object') return { animal, options: draft.options };
  } catch { /* An unavailable or old draft should not prevent a fresh session. */ }
  return { animal: DEFAULT_ANIMAL, options: {} };
}

function getInitialCollection(): SavedVariant[] {
  try {
    const saved = JSON.parse(localStorage.getItem(COLLECTION_KEY) || '[]');
    if (Array.isArray(saved)) return saved.filter(item => typeof item.id === 'string' && typeof item.name === 'string' && ANIMALS.some(animal => animal.id === item.animalId) && item.options && typeof item.options === 'object');
  } catch { /* Local collections are optional; modeling still works without storage. */ }
  return [];
}

function FoxMark({ small = false }: { small?: boolean }) {
  return <svg className={small ? 'fox-mark small' : 'fox-mark'} viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M5 6L17 13L34 5L30 25L20 35L8 23L5 6Z" fill="currentColor" /><path d="M5 6L20 22L17 13L5 6Z" fill="#9daa8d" /><path d="M34 5L20 22L30 25L34 5Z" fill="#87977a" /><path d="M8 23L20 22L20 35L8 23Z" fill="#cdd5bc" /><path d="M30 25L20 22L20 35L30 25Z" fill="#e2e6d6" /><path d="M17 27L22 27L20 31L17 27Z" fill="#344330" /></svg>;
}

function ToolButton({ children, label, active = false, onClick, shortcut }: { children: ReactNode; label: string; active?: boolean; onClick: () => void; shortcut?: string }) {
  return <button className={`viewport-tool ${active ? 'active' : ''}`} onClick={onClick} aria-label={label} aria-pressed={active} title={`${label}${shortcut ? ` (${shortcut})` : ''}`}>{children}</button>;
}

function PhylaBrowser({ onChoose, selected, onExport }: { onChoose: (phylum: string) => void; selected: string; onExport: () => void }) {
  const [query, setQuery] = useState('');
  const filtered = PHYLA.filter(item => {
    const text = `${item.name} ${item.common}`.toLowerCase();
    const terms: Record<string, string[]> = {
      Chordata: ['mammal', 'mammals', 'bird', 'birds', 'reptile', 'reptiles', 'amphibian', 'amphibians', 'fish', 'vertebrate', 'vertebrates', 'frog', 'toad', 'newt', 'salamander', 'caecilian', 'axolotl', 'lizard', 'snake', 'turtle', 'shark', 'whale', 'seal', 'fox', 'wolf', 'deer', 'bear', 'elephant', 'lion', 'puffin', 'eagle', 'owl'],
      Arthropoda: ['insect', 'insects', 'bug', 'bugs', 'spider', 'spiders', 'arachnid', 'arachnids', 'crab', 'crabs', 'crustacean', 'crustaceans', 'butterfly', 'beetle', 'scorpion', 'centipede', 'bee', 'dragonfly', 'mantis', 'moth', 'lobster'],
      Mollusca: ['snail', 'snails', 'slug', 'slugs', 'octopus', 'octopuses', 'squid', 'squids', 'clam', 'clams', 'bivalve', 'bivalves', 'nudibranch', 'nautilus', 'cuttlefish'],
      Cnidaria: ['jellyfish', 'jellyfishes', 'anemone', 'anemones', 'coral', 'corals'],
      Echinodermata: ['starfish', 'starfishes', 'sea star', 'urchin', 'urchins', 'sea cucumber'],
      Porifera: ['sponge', 'sponges'],
      Tardigrada: ['water bear', 'water bears', 'tardigrade', 'tardigrades'],
      Annelida: ['worm', 'worms', 'earthworm', 'earthworms', 'leech', 'leeches']
    };
    const list = terms[item.name] || [];
    return text.includes(query.toLowerCase().trim()) || list.some(term => term.includes(query.toLowerCase().trim()));
  });
  return <><div className="modal-search"><Search size={17} /><input placeholder="Search a phylum or body plan..." value={query} onChange={event => setQuery(event.target.value)} aria-label="Search animal phyla" /></div><div className="phyla-browser"><button className={`phylum-choice all-phyla ${!selected ? 'selected' : ''}`} onClick={() => onChoose('')}><span className="phylum-choice-icon"><Network size={19} /></span><span><strong>The whole animal kingdom</strong><small>{ANIMALS.length} species. A world of possibility.</small></span><ArrowRight size={15} /></button><div className="phyla-grid">{filtered.map(item => <button key={item.name} className={`phylum-choice ${selected === item.name ? 'selected' : ''}`} onClick={() => onChoose(item.name)} title={item.note || item.common}><span><strong>{item.name}{item.note && <sup>*</sup>}</strong><small>{item.common}</small></span><span className="phylum-animal-count">{ANIMALS.filter(animal => animal.phylum === item.name).length}</span></button>)}</div>{!filtered.length && <p className="no-phyla">No matching phyla. Try a common name, like "worms".</p>}</div><div className="taxonomy-note"><CircleHelp size={15} strokeWidth={1.5} /><p>{TAXONOMY_NOTE}</p></div><div className="modal-footer"><span className="footer-note">Curiosity has no boundaries.</span><button className="text-button" onClick={onExport}>Download the collection<ArrowDownToLine size={14} /></button></div></>;
}

export default function App() {
  const [initial] = useState(getInitialDraft);
  const [animal, setAnimal] = useState<Animal>(initial.animal);
  const history = useHistory(initial.options);
  const options = history.value;
  const deferredOptions = useDeferredValue(options);
  const [variants, setVariants] = useState<SavedVariant[]>(getInitialCollection);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [nav, setNav] = useState<'explore' | 'saved'>('explore');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All animals');
  const [phylum, setPhylum] = useState('');
  const [alphabetical, setAlphabetical] = useState(false);
  const [tab, setTab] = useState<InspectorTab>('Parameters');
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [hiddenParts, setHiddenParts] = useState<string[]>([]);
  const [tool, setTool] = useState<'orbit' | 'select'>('orbit');
  const [night, setNight] = useState(false);
  const [grid, setGrid] = useState(true);
  const [shadows, setShadows] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [environment, setEnvironment] = useState<'studio' | 'habitat'>('studio');
  const [view, setView] = useState<CameraView>('Perspective');
  const [modal, setModal] = useState<ModalType>(null);
  const [mobilePanel, setMobilePanel] = useState<'library' | 'inspector' | null>(null);
  const [draftStatus, setDraftStatus] = useState<'saving' | 'saved' | 'session'>('saved');
  const [toast, setToast] = useState<{ message: string; id: number; action?: () => void; actionLabel?: string } | null>(null);
  const [variantName, setVariantName] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('bundle');
  const [exportMerge, setExportMerge] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState('');
  const [validation, setValidation] = useState<Awaited<ReturnType<typeof validateCollection>> | null>(null);
  const viewportRef = useRef<ViewportHandle>(null);
  const notify = useCallback((message: string) => setToast({ message, id: Date.now() }), []);

  useEffect(() => {
    setDraftStatus('saving');
    const timeout = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ animalId: animal.id, options })); setDraftStatus('saved'); }
      catch { setDraftStatus('session'); }
    }, 500);
    return () => clearTimeout(timeout);
  }, [animal.id, options]);

  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(null), toast.action ? 6500 : 4000); return () => clearTimeout(timeout); }, [toast]);

  const chooseAnimal = useCallback((next: Animal) => {
    setAnimal(next); history.reset({}); setSelectedVariant(null); setSelectedPart(null); setHiddenParts([]); setStats(null); setTab('Parameters'); setTool('orbit'); setPlaying(false); setMobilePanel(null);
  }, [history.reset]);

  const changeParameter = useCallback((key: string, value: string | number | boolean) => {
    const next = { ...options, [key]: value };
    if (key === 'colorway') for (const zone of ['skin', 'underside', 'dark', 'accent', 'detail', 'glass']) delete next[zone];
    if (key === 'mergeForProduction') { setSelectedPart(null); setHiddenParts([]); if (value) setPlaying(false); }
    history.push(next);
  }, [options, history.push]);

  const resetParameters = useCallback(() => { history.push({}); setHiddenParts([]); setSelectedPart(null); notify(`${animal.name} is back to its natural form.`); }, [history.push, animal.name, notify]);
  const openSave = useCallback(() => {
    const existing = variants.find(variant => variant.id === selectedVariant);
    setVariantName(existing?.name || `${animal.name} study`); setModal('save');
  }, [animal.name, variants, selectedVariant]);

  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      if (modal) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 'z') { event.preventDefault(); if (event.shiftKey) history.redo(); else history.undo(); return; }
      if ((event.ctrlKey || event.metaKey) && key === 's') { event.preventDefault(); openSave(); return; }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (key === '/') { event.preventDefault(); if (window.innerWidth <= 1100) setMobilePanel('library'); setTimeout(() => document.querySelector<HTMLInputElement>('.library-search-wrap input')?.focus(), 50); }
      if (key === 'g') setGrid(value => !value);
      if (key === 'w') setWireframe(value => !value);
      if (key === 'n') setNight(value => !value);
      if (key === 'f') { setView('Perspective'); viewportRef.current?.reset(); }
      if (key === 'v') { setTool('select'); setTab('Parts'); }
      if (key === 'o') setTool('orbit');
      if (key === ' ' && !target.closest('button, a')) { event.preventDefault(); setPlaying(value => !value); }
      if (key === '?') setModal('help');
      if (key === 'escape') { setSelectedPart(null); setMobilePanel(null); setTool('orbit'); }
    };
    window.addEventListener('keydown', handleKeys); return () => window.removeEventListener('keydown', handleKeys);
  }, [modal, history.undo, history.redo, openSave]);

  function persistCollection(next: SavedVariant[]) {
    setVariants(next);
    try { localStorage.setItem(COLLECTION_KEY, JSON.stringify(next)); return true; }
    catch { return false; }
  }

  function saveVariant(event: React.FormEvent) {
    event.preventDefault(); const name = variantName.trim(); if (!name) return;
    const existing = variants.find(variant => variant.id === selectedVariant);
    const saved: SavedVariant = { id: existing?.id || crypto.randomUUID(), animalId: animal.id, name, options: { ...options }, savedAt: Date.now() };
    const next = existing ? variants.map(variant => variant.id === existing.id ? saved : variant) : [saved, ...variants];
    const persisted = persistCollection(next); setSelectedVariant(saved.id); setModal(null);
    notify(persisted ? `"${name}" saved to My collection.` : `"${name}" saved for this session. Browser storage is unavailable.`);
  }

  function selectVariant(variant: SavedVariant) {
    const next = ANIMALS.find(item => item.id === variant.animalId); if (!next) return;
    setAnimal(next); history.reset({ ...variant.options }); setSelectedVariant(variant.id); setHiddenParts([]); setSelectedPart(null); setTab('Parameters'); setMobilePanel(null);
  }

  function deleteVariant(id: string) {
    const deleted = variants.find(variant => variant.id === id); if (!deleted) return;
    persistCollection(variants.filter(variant => variant.id !== id)); if (selectedVariant === id) setSelectedVariant(null);
    setToast({ message: `"${deleted.name}" removed.`, id: Date.now(), actionLabel: 'Undo', action: () => { setVariants(previous => { const next = [deleted, ...previous]; try { localStorage.setItem(COLLECTION_KEY, JSON.stringify(next)); } catch { /* The restored item stays available in this session. */ } return next; }); setToast(null); } });
  }

  function showExplore() { setNav('explore'); setQuery(''); setCategory('All animals'); setPhylum(''); }
  function selectPart(name: string | null) { setSelectedPart(name); if (name) setTab('Parts'); }
  function togglePart(name: string) { setHiddenParts(previous => previous.includes(name) ? previous.filter(item => item !== name) : [...previous, name]); }
  function snapshot() { const image = viewportRef.current?.snapshot(); if (image) { downloadDataUrl(image, `wildform-${animal.id}.png`); notify('Your studio image is ready.'); } else notify('The 3D view is still getting ready.'); }
  function frameView() { setView('Perspective'); viewportRef.current?.reset(); }
  function startCollectionExport() { setExportFormat('collection'); setModal('export'); }

  async function download() {
    setExporting(true); setExportProgress('Getting your files ready...');
    try { await new Promise(resolve => setTimeout(resolve, 40)); await exportAnimal(exportFormat, animal, options, exportMerge, hiddenParts, setExportProgress); setModal(null); notify(exportFormat === 'collection' ? 'The complete animal collection is downloading.' : `${animal.name} is ready to go. Your download has started.`); }
    catch (error) { console.error(error); notify(error instanceof Error ? `Export failed: ${error.message}` : 'The export could not be completed. Please try again.'); }
    finally { setExporting(false); setExportProgress(''); }
  }

  async function runValidation() {
    setValidating(true); setValidation(null);
    try { const result = await validateCollection(setValidationProgress); setValidation(result); }
    catch { notify('The collection check was interrupted. Please try again.'); }
    finally { setValidating(false); }
  }

  const saved = Boolean(selectedVariant && variants.some(variant => variant.id === selectedVariant));
  const formats: { id: ExportFormat; title: string; description: string; extension: string; icon: ReactNode }[] = [
    { id: 'bundle', title: 'Model + interactive preview', description: 'Your model, a composed scene, and a browser studio.', extension: '.zip', icon: <Package size={22} /> },
    { id: 'module', title: 'Three.js module', description: 'A self-contained, fully parametric ES module.', extension: '.mjs', icon: <FileCode2 size={22} /> },
    { id: 'glb', title: 'Universal 3D model', description: 'A geometry snapshot for Blender, games, and more.', extension: '.glb', icon: <Box size={22} /> },
    { id: 'collection', title: 'The complete animal kingdom', description: `${ANIMALS.length} independent models across 34 phyla and lineages.`, extension: '.zip', icon: <Network size={22} /> },
  ];

  return <div className="app-shell">
    <motion.header className="app-header" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <button className="brand" aria-label="Wildform home" onClick={showExplore}><FoxMark /><span>wildform<span className="brand-dot">.</span></span></button>
      <nav className="main-nav" aria-label="Main navigation"><button className={nav === 'explore' ? 'active' : ''} onClick={showExplore}>Explore</button><button className={nav === 'saved' ? 'active' : ''} onClick={() => { setNav('saved'); setQuery(''); setCategory('All animals'); setPhylum(''); }}>My collection{variants.length > 0 && <span className="nav-count">{variants.length}</span>}</button><button onClick={() => setModal('about')}>About</button></nav>
      <div className="header-actions"><div className="history-buttons"><button className="icon-button" aria-label="Undo parameter change" title="Undo (Ctrl+Z)" disabled={!history.canUndo} onClick={history.undo}><Undo2 size={16} /></button><button className="icon-button" aria-label="Redo parameter change" title="Redo (Ctrl+Shift+Z)" disabled={!history.canRedo} onClick={history.redo}><Redo2 size={16} /></button></div><span className="save-status"><span className={`status-dot ${draftStatus === 'saving' ? 'saving' : ''}`} />{draftStatus === 'saving' ? 'Saving changes...' : draftStatus === 'session' ? 'Session only' : 'All changes saved'}</span><button className="help-button" aria-label="Help and keyboard shortcuts" onClick={() => setModal('help')}><CircleHelp size={18} strokeWidth={1.5} /></button><button className="primary-button export-button" onClick={() => { setExportFormat('bundle'); setModal('export'); }}><Download size={15} strokeWidth={1.8} /><span>Export asset</span><ChevronDown size={13} /></button></div>
    </motion.header>

    <main className="workspace">
      <Library selected={animal} query={query} onQuery={setQuery} category={category} onCategory={setCategory} phylum={phylum} onClearPhylum={() => setPhylum('')} onPhyla={() => setModal('phyla')} onSelect={chooseAnimal} saved={nav === 'saved'} variants={variants} selectedVariant={selectedVariant} onVariant={selectVariant} onDelete={deleteVariant} onExplore={showExplore} alphabetical={alphabetical} onSort={() => setAlphabetical(!alphabetical)} mobileOpen={mobilePanel === 'library'} onMobileClose={() => setMobilePanel(null)} />

      <section className={`scene-panel ${night ? 'is-night' : ''}`} aria-label="3D animal studio">
        <div className="scene-heading"><div className="scene-heading-title"><button className="icon-button mobile-library-trigger" aria-label="Open animal library" onClick={() => setMobilePanel('library')}><Menu size={18} /></button><Box size={16} strokeWidth={1.5} /><span>Animal studio</span><span className="scene-heading-slash">/</span><span className="scene-heading-model">{animal.name}</span></div><button className="icon-button mobile-inspector-trigger" aria-label="Open animal parameters" onClick={() => setMobilePanel('inspector')}><SlidersHorizontal size={18} /></button></div>
        <div className="scene-stage">
          <Viewport ref={viewportRef} animal={animal} options={deferredOptions} night={night} grid={grid} shadows={shadows} wireframe={wireframe} autoRotate={autoRotate} playing={playing} environment={environment} tool={tool} view={view} hiddenParts={hiddenParts} selectedPart={selectedPart} onSelect={selectPart} onStats={setStats} onError={notify} />
          <div className="scene-top-controls"><div className="stage-left-controls"><div className="camera-view-control"><Box size={14} strokeWidth={1.5} /><select aria-label="Camera view" value={view} onChange={event => setView(event.target.value as CameraView)}>{(['Perspective', 'Front', 'Side', 'Top'] as CameraView[]).map(cameraView => <option key={cameraView}>{cameraView}</option>)}</select><ChevronDown size={12} /></div><div className="viewer-animal-control" title="Switch animal"><Leaf size={14} strokeWidth={1.6} /><select aria-label="Switch animal" value={animal.id} onChange={event => { const next = ANIMALS.find(item => item.id === event.target.value); if (next) chooseAnimal(next); }}>{ANIMALS.filter(a => category === 'All animals' || a.category === category).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div></div><div className="stage-right-controls"><div className="lighting-switch" aria-label="Studio lighting"><button className={!night ? 'active' : ''} aria-label="Day lighting" title="Day lighting" onClick={() => setNight(false)} aria-pressed={!night}><Sun size={16} strokeWidth={1.5} /></button><button className={night ? 'active' : ''} aria-label="Night lighting" title="Night lighting (N)" onClick={() => setNight(true)} aria-pressed={night}><Moon size={15} strokeWidth={1.5} /></button></div><span className="stage-divider" /><button className="stage-icon" aria-label="Toggle fullscreen" title="Fullscreen" onClick={() => viewportRef.current?.fullscreen()}><Expand size={16} strokeWidth={1.5} /></button></div></div>
          <div className="axis-widget" aria-hidden="true"><span className="axis-line axis-y"><b>Y</b></span><span className="axis-line axis-x"><b>X</b></span><span className="axis-line axis-z"><b>Z</b></span><span className="axis-center" /></div>
          <div className="scene-scale"><div className="scale-rule" /><span>{formatLength(Number(options.bodyLength || animal.length), true)}</span><small>BODY LENGTH</small></div>
          <motion.div className="viewport-toolbar" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.25 }}><ToolButton label="Orbit" shortcut="O" active={tool === 'orbit'} onClick={() => setTool('orbit')}><Rotate3D size={18} strokeWidth={1.5} /><span>Orbit</span></ToolButton><ToolButton label="Select parts" shortcut="V" active={tool === 'select'} onClick={() => { setTool('select'); setTab('Parts'); }}><MousePointer2 size={18} strokeWidth={1.5} /><span>Select</span></ToolButton><span className="toolbar-divider" /><ToolButton label="Wireframe" shortcut="W" active={wireframe} onClick={() => setWireframe(!wireframe)}><Box size={18} strokeWidth={1.4} /></ToolButton><ToolButton label="Ground grid" shortcut="G" active={grid} onClick={() => setGrid(!grid)}><Grid2X2 size={17} strokeWidth={1.4} /></ToolButton><ToolButton label="Shadows" active={shadows} onClick={() => setShadows(!shadows)}><Sun size={18} strokeWidth={1.4} /></ToolButton><span className="toolbar-divider" /><ToolButton label="Save a studio image" onClick={snapshot}><Camera size={18} strokeWidth={1.5} /></ToolButton></motion.div>
        </div>
        <div className="scene-bottom-controls"><div className="environment-control"><Layers3 size={15} strokeWidth={1.5} /><select aria-label="Scene environment" value={environment} onChange={event => setEnvironment(event.target.value as 'studio' | 'habitat')}><option value="studio">Studio</option><option value="habitat">Natural habitat</option></select><ChevronDown size={12} /></div><button className={`idle-control ${playing ? 'active' : ''}`} onClick={() => { if (options.mergeForProduction) { changeParameter('mergeForProduction', false); notify('Parts are now editable so the animation can play.'); } setPlaying(!playing); }} title="Toggle idle animation (Space)">{playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}<span>Idle animation</span><span className={`animation-dot ${playing ? 'playing' : ''}`} /></button><div className="scene-view-actions"><button className={`auto-rotate ${autoRotate ? 'active' : ''}`} aria-pressed={autoRotate} onClick={() => setAutoRotate(!autoRotate)} title="Toggle automatic rotation"><Rotate3D size={14} strokeWidth={1.5} /><span>Auto rotate</span></button><span className="controls-divider" /><button className="frame-control" onClick={frameView} title="Reset camera (F)"><RotateCcw size={14} strokeWidth={1.5} /><span>Reset view</span></button></div></div>
        <div className="scene-info-bar"><div className="geometry-info"><span><span className="mesh-dot" />{stats ? stats.triangles.toLocaleString() : '...'} triangles</span><span>{stats?.materials || '...'} material{stats && stats.materials > 1 ? 's' : ''}</span></div><div className="orbit-hint"><Move size={11} /><span>Drag to orbit</span><span className="hint-divider" /><span>Scroll to zoom</span></div></div>
      </section>

      <Inspector animal={animal} options={options} onChange={changeParameter} onAnimal={chooseAnimal} onReset={resetParameters} onSave={openSave} saved={saved} tab={tab} onTab={next => { setTab(next); if (next === 'Parts') setTool('select'); }} stats={stats} selectedPart={selectedPart} onSelectPart={selectPart} hiddenParts={hiddenParts} onTogglePart={togglePart} onShowAll={() => setHiddenParts([])} mobileOpen={mobilePanel === 'inspector'} onMobileClose={() => setMobilePanel(null)} mobileViewer={mobilePanel === 'inspector' ? <Viewport animal={animal} options={deferredOptions} night={night} grid={false} shadows={shadows} wireframe={wireframe} autoRotate={autoRotate} playing={playing} environment={environment} tool={tool} view="Perspective" hiddenParts={hiddenParts} selectedPart={selectedPart} onSelect={selectPart} onStats={() => {}} onError={notify} /> : null} category={category} onCategory={setCategory} onOpenLibrary={() => setMobilePanel('library')} />
    </main>
    <footer className="app-status-bar"><span><Leaf size={11} strokeWidth={1.5} />A little closer to the wild.</span><span>{ANIMALS.length} species<span className="footer-divider" />34 phyla &amp; lineages</span><button onClick={() => setModal('about')}>WILDFORM / V.01<ArrowRight size={10} /></button></footer>
    {mobilePanel && <div className="mobile-panel-backdrop" onClick={() => setMobilePanel(null)} />}

    <AnimatePresence>
      {modal === 'phyla' && <Modal key="phyla" title="One kingdom. Endless possibility." subtitle="From the familiar to the extraordinary. Find a body plan and see where your curiosity takes you." onClose={() => setModal(null)} wide><PhylaBrowser selected={phylum} onChoose={next => { setPhylum(next); if (next) { setCategory('All animals'); } setQuery(''); setNav('explore'); setModal(null); if (window.innerWidth <= 1100) setMobilePanel('library'); }} onExport={startCollectionExport} /></Modal>}
      {modal === 'save' && <Modal key="save" title={saved ? 'A little refinement.' : 'Make it part of your collection.'} subtitle="Save this animal and its current parameters, ready for your next idea." onClose={() => setModal(null)}><form onSubmit={saveVariant}><label className="form-label" htmlFor="variant-name">Variant name</label><input className="variant-name-input" id="variant-name" autoFocus value={variantName} onChange={event => setVariantName(event.target.value)} maxLength={60} required placeholder="Give your animal a name" /><div className="save-preview-line"><FoxMark small /><div><strong>{animal.name}</strong><span>{animal.scientific}</span></div><span className="save-preview-theme">{String(options.colorway || 'natural')}</span></div><p className="storage-note"><Bookmark size={14} />Your collection is saved in this browser, on this device.</p><div className="modal-footer"><button className="secondary-button" type="button" onClick={() => setModal(null)}>Cancel</button><button className="primary-button" type="submit" disabled={!variantName.trim()}><Bookmark size={14} />{saved ? 'Update variant' : 'Save to collection'}</button></div></form></Modal>}
      {modal === 'export' && <Modal key="export" title={exportFormat === 'collection' ? 'Take the whole wild with you.' : `Your ${animal.name.toLowerCase()}, out in the world.`} subtitle="Made here. Ready for wherever you create next." onClose={() => { if (!exporting) setModal(null); }}><div className="export-formats">{formats.map(format => <button key={format.id} className={`export-format ${exportFormat === format.id ? 'selected' : ''}`} aria-pressed={exportFormat === format.id} disabled={exporting} onClick={() => setExportFormat(format.id)}><span className="export-format-icon">{format.icon}</span><span className="export-format-copy"><strong>{format.title}</strong><small>{format.description}</small></span><code>{format.extension}</code><span className="radio-mark">{exportFormat === format.id && <span />}</span></button>)}</div><label className="export-merge"><input type="checkbox" checked={exportMerge} onChange={event => setExportMerge(event.target.checked)} disabled={exporting} /><span><strong>Merge for production</strong><small>One mesh per material. Turn off to keep parts editable and animated.</small></span></label>{exportFormat === 'collection' && <p className="export-note">Includes the full collection in its natural colorways. Your current animal edits stay in this studio.</p>}{exportFormat === 'glb' && <p className="export-note">GLB preserves the current geometry, not the procedural controls. Choose a module or preview bundle to keep the parameters.</p>}<div className="export-license"><ShieldCheck size={14} /><span>Real-world scale</span><span className="small-dot" /><span>CC0 licensed geometry</span></div><div className="modal-footer"><span className="export-progress" role="status">{exporting ? exportProgress : 'A little wild. A lot of potential.'}</span><button className="primary-button export-download" onClick={download} disabled={exporting}>{exporting ? <LoaderCircle className="spinning" size={16} /> : <Download size={16} />}{exporting ? 'Preparing...' : `Download ${formats.find(format => format.id === exportFormat)?.extension}`}</button></div></Modal>}
      {modal === 'help' && <Modal key="help" title="A few field notes." subtitle="A simple studio. A whole world to play with." onClose={() => setModal(null)}><div className="help-intro"><Compass size={29} strokeWidth={1.2} /><p>Pick an animal, adjust its anatomy, and find a form you love. Save a variant to your collection or export it to make something new.</p></div><div className="shortcuts-grid">{[['Orbit the model', 'Drag'], ['Zoom in or out', 'Scroll'], ['Search the collection', '/'], ['Orbit tool', 'O'], ['Select parts', 'V'], ['Toggle grid', 'G'], ['Toggle wireframe', 'W'], ['Switch day / night', 'N'], ['Frame the model', 'F'], ['Play / pause idle', 'Space'], ['Undo a change', 'Ctrl Z'], ['Save a variant', 'Ctrl S']].map(([label, key]) => <div key={label}><span>{label}</span><kbd>{key}</kbd></div>)}</div><p className="help-note">On a touch screen, drag with one finger to orbit and pinch to zoom. Use two fingers to pan. On a Mac, use Command instead of Ctrl.</p><div className="modal-footer"><button className="text-button" onClick={() => setModal('about')}>A little about Wildform<ArrowRight size={14} /></button><button className="primary-button" onClick={() => setModal(null)}>Back to the wild<ArrowRight size={14} /></button></div></Modal>}
      {modal === 'about' && <Modal key="about" title="Made of curiosity." subtitle="A creative field guide to the animal kingdom." onClose={() => setModal(null)} wide><div className="about-brand"><FoxMark /><span>wildform.</span></div><p className="about-description">Small details. Remarkable diversity. Wildform is a living collection of procedural wildlife, built to help artists, developers, and the endlessly curious explore the shapes of the natural world.</p><div className="about-facts"><div><Network size={18} /><span><strong>Every body plan has a place.</strong><small>{ANIMALS.length} species across 34 animal phyla and traditional lineages, from red foxes to water bears.</small></span></div><div><Code2 size={18} /><span><strong>Built from geometry, made to be yours.</strong><small>Real-world dimensions, continuous parametric shapes, named parts, and portable Three.js modules.</small></span></div><div><Leaf size={18} /><span><strong>Free to roam.</strong><small>All generated animal geometry is CC0 licensed. Use it in your personal and commercial projects.</small></span></div></div><details className="about-taxonomy"><summary>A note on taxonomy<ChevronDown size={14} /></summary><p>{TAXONOMY_NOTE}</p><a href="https://www.bio.vu.nl/thb/deb/deblab/add_my_pet/phyla.html" target="_blank" rel="noreferrer">Animal phyla reference<ArrowRight size={12} /></a></details><div className="validation-panel"><div><ShieldCheck size={19} /><span><strong>Collection geometry check</strong><small>{validating ? validationProgress : validation ? `${validation.passed} of ${validation.total} models checked across ${validation.phyla} lineages.` : 'Check bounds, vertices, color zones, and production merging.'}</small></span></div><button className="secondary-button" onClick={runValidation} disabled={validating}>{validating ? <LoaderCircle size={13} className="spinning" /> : validation && !validation.failures.length ? <Check size={13} /> : <Eye size={13} />}{validating ? 'Checking...' : 'Run check'}</button></div>{validation && <div className={`validation-result ${validation.failures.length ? 'has-errors' : ''}`} role="status">{validation.failures.length ? validation.failures.map(failure => <p key={failure}>{failure}</p>) : <p><Check size={14} />All {validation.total} models have finite geometry, distinct color zones, and matching merged and editable versions.</p>}</div>}<div className="modal-footer"><span className="footer-note">A little closer to the wild.</span><button className="primary-button" onClick={startCollectionExport}><Download size={14} />Get the collection</button></div></Modal>}
      {toast && <motion.div className="toast" key={toast.id} role="status" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}><span className="toast-check"><Check size={13} /></span><span>{toast.message}</span>{toast.action && <button className="toast-action" onClick={toast.action}>{toast.actionLabel}</button>}<button className="toast-close" aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={14} /></button></motion.div>}
    </AnimatePresence>
  </div>;
}