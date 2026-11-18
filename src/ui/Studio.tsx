import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Play, Square, Undo2, Redo2, Compass, Hammer, Blocks, MoreHorizontal, Save, Download, Camera, Maximize, Volume2, VolumeX, HelpCircle, Settings2, FileImage } from 'lucide-react';
import { clsx } from 'clsx';
import { Engine } from '../engine/Engine';
import type { DioramaDoc, Mode } from '../engine/types';
import { ScriptRuntime } from '../code/runtime';
import { Ambience, audio } from '../code/sound';
import { exportProject, saveProject, makeThumb, downloadDataUrl, fileSafe, saveSettings, type Settings } from '../storage/projects';
import { StudioContext, type StudioApi } from './store';
import { Btn, IconBtn, Modal, Segmented, Toggle } from './common';
import { useMedia, isTypingTarget } from './hooks';
import { Viewport } from './Viewport';
import { LibraryPanel, InspectorPanel } from './BuildPanels';
import { ExploreLayer } from './ExplorePanels';
import { CodePanel } from './CodePanel';
import { WalkMode } from '../engine/WalkMode';
import { BIOME_BY_ID } from '../biomes/templates';

export interface Toast { id: number; text: string; kind: 'info' | 'error' | 'success' }

export function Studio({ doc, settings, setSettings, onExit }: { doc: DioramaDoc; settings: Settings; setSettings: (s: Settings) => void; onExit: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<StudioApi | null>(null);
  const [mode, setModeState] = useState<Mode>('explore');
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState<{ done: number; total: number; label: string } | null>({ done: 0, total: 1, label: 'Opening the box…' });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [title, setTitle] = useState(doc.title);
  const [, force] = useState(0);
  const wide = useMedia('(min-width: 1024px)');
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3200);
  }, []);

  /* ---------- engine lifecycle ---------- */
  useEffect(() => {
    const host = hostRef.current!;
    const engine = new Engine(host, settings.quality);
    const runtime = new ScriptRuntime(engine);
    const ambience = new Ambience();
    engine.walk = new WalkMode(engine);
    engine.autosave = (d) => { void saveProject(d); };
    const studio: StudioApi = { engine, runtime, ambience, settings, setSettings };
    (window as unknown as { __engine: Engine }).__engine = engine;
    (window as unknown as { __runtime: ScriptRuntime }).__runtime = runtime;
    const off = engine.on((e) => {
      if (e.type === 'loading') setLoading({ done: e.done, total: e.total, label: e.label });
      if (e.type === 'loaded') { setLoading(null); (window as unknown as { __loaded: boolean }).__loaded = true; }
      if (e.type === 'toast') toast(e.text, e.kind);
      if (e.type === 'thunder' && settingsRef.current.sound) import('../code/sound').then((m) => m.playSound('thunder'));
    });
    runtime.onState = () => setPlaying(runtime.running);
    runtime.onError = (who, msg) => toast(`⚠️ ${who}: ${msg}`, 'error');
    engine.onTick.add((dt) => {
      const env = engine.env;
      ambience.biome = engine.doc?.biome ?? 'forest';
      ambience.night = engine.skyState.night;
      ambience.wind = env.wind;
      ambience.rain = env.weather === 'rain' ? 0.7 : env.weather === 'storm' ? 1 : 0;
      ambience.underwater = !!env.underwater || !!engine.walk?.underwater;
      ambience.water = engine.terrain?.waterLevel != null;
      ambience.update(dt);
    });
    setApi(studio);
    void engine.load(doc).then(() => {
      void saveProject(engine.serialize());
    });
    return () => {
      off();
      runtime.stop();
      ambience.stop();
      engine.walk?.exit();
      const final = engine.doc ? engine.serialize() : null;
      if (final) void saveProject(final);
      engine.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const engine = api?.engine;
  const runtime = api?.runtime;

  const setMode = useCallback((m: Mode) => {
    if (!engine) return;
    if (engine.walk?.active) engine.walk.exit();
    engine.setMode(m);
    setModeState(m);
    setMenu(false);
    // panels change the viewport shape: re-frame once the layout has settled
    setTimeout(() => { engine.resize(); if (!engine.selectedId) engine.frameCamera(); }, 60);
  }, [engine]);

  const togglePlay = useCallback(() => {
    if (!runtime) return;
    audio();
    if (runtime.running) runtime.stop();
    else runtime.start(true);
    setPlaying(runtime.running);
  }, [runtime]);

  const saveNow = useCallback(async () => {
    if (!engine) return;
    const d = engine.serialize();
    const thumb = await makeThumb(engine.screenshot());
    const ok = await saveProject(d, thumb);
    toast(ok ? 'Saved on this device ✓' : 'Could not save — try downloading a copy', ok ? 'success' : 'error');
  }, [engine, toast]);

  const exit = useCallback(async () => {
    if (engine) {
      runtime?.stop();
      const d = engine.serialize();
      const thumb = await makeThumb(engine.screenshot());
      await saveProject(d, thumb);
    }
    onExit();
  }, [engine, runtime, onExit]);

  // the inspector's "Code" button asks to switch modes
  useEffect(() => {
    const fn = (e: Event) => setMode((e as CustomEvent<Mode>).detail);
    document.addEventListener('dd-mode', fn);
    return () => document.removeEventListener('dd-mode', fn);
  }, [setMode]);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    if (!engine || !runtime) return;
    const down = (e: KeyboardEvent) => {
      if (runtime.running) runtime.key(e.key === ' ' ? ' ' : e.key, true);
      if (isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); void (e.shiftKey ? engine.redo() : engine.undo()); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); void engine.redo(); return; }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void saveNow(); return; }
      if (engine.walk?.active) { if (e.key === 'Escape') { engine.walk.exit(); force((x) => x + 1); } return; }
      const sel = engine.selectedId;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel && mode === 'build' && !runtime.running) { e.preventDefault(); engine.removeActor(sel); }
      else if (e.key.toLowerCase() === 'd' && sel && mode === 'build' && !runtime.running) void engine.duplicateActor(sel);
      else if (e.key.toLowerCase() === 'f' && sel) engine.focusActor(sel);
      else if (e.key === 'Escape') { if (runtime.running) runtime.stop(); else engine.select(null); }
      else if (e.key.toLowerCase() === 'l' && !mod) engine.setEnv({ labels: !engine.env.labels }, false);
      else if (e.key.toLowerCase() === 'o' && !mod) engine.frameCamera();
    };
    const up = (e: KeyboardEvent) => runtime.key(e.key === ' ' ? ' ' : e.key, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [engine, runtime, mode, saveNow]);

  const biome = BIOME_BY_ID[doc.biome];
  const ctx = useMemo(() => api, [api]);

  return (
    <div className="dd-studio flex h-full flex-col" style={{ ['--accent' as string]: biome?.accent ?? '#3f7d3a' }}>
      {/* ---------------- top bar ---------------- */}
      <header className="dd-topbar z-30 flex h-14 shrink-0 items-center gap-1.5 px-2 sm:gap-2 sm:px-3">
        <IconBtn label="Back to all dioramas" onClick={() => void exit()} className="text-white hover:bg-white/10"><ArrowLeft size={20} /></IconBtn>
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden text-2xl sm:inline">{biome?.emoji ?? '📦'}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { if (engine && title.trim() && title !== engine.doc.title) { engine.doc.title = title.trim(); engine.frame.setTitle(engine.doc.title, engine.doc.author ? `by ${engine.doc.author}` : ''); engine.changed(); } }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-[34vw] min-w-0 max-w-[260px] truncate rounded-lg bg-transparent px-1.5 py-1 font-display text-base font-semibold text-white outline-none hover:bg-white/10 focus:bg-white/15 sm:text-lg"
            aria-label="Diorama title"
          />
        </div>
        {wide && (
          <nav className="ml-2 flex gap-1 rounded-2xl bg-black/25 p-1">
            {([['explore', 'Explore', Compass], ['build', 'Build', Hammer], ['code', 'Code', Blocks]] as const).map(([m, label, Icon]) => (
              <button key={m} onClick={() => setMode(m)} className={clsx('flex h-9 items-center gap-1.5 rounded-xl px-3.5 font-display text-sm font-semibold transition-all', mode === m ? 'bg-white text-ink shadow' : 'text-white/80 hover:bg-white/10')}>
                <Icon size={16} />{label}
              </button>
            ))}
          </nav>
        )}
        <div className="flex-1" />
        {engine && mode === 'build' && wide && (
          <>
            <IconBtn label="Undo (Ctrl+Z)" disabled={!engine.canUndo} onClick={() => void engine.undo()} className="text-white hover:bg-white/10"><Undo2 size={18} /></IconBtn>
            <IconBtn label="Redo (Ctrl+Shift+Z)" disabled={!engine.canRedo} onClick={() => void engine.redo()} className="text-white hover:bg-white/10"><Redo2 size={18} /></IconBtn>
          </>
        )}
        <Btn variant={playing ? 'stop' : 'go'} onClick={togglePlay} className="min-w-[44px] px-3" title={playing ? 'Stop and reset (Esc)' : 'Run all code'}>
          {playing ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          <span className="hidden sm:inline">{playing ? 'Stop' : 'Play'}</span>
        </Btn>
        <div className="relative">
          <IconBtn label="More" onClick={() => setMenu((v) => !v)} className="text-white hover:bg-white/10"><MoreHorizontal size={20} /></IconBtn>
          {menu && engine && (
            <div className="dd-panel absolute right-0 top-12 z-40 w-64 rounded-2xl p-2 text-sm" onMouseLeave={() => setMenu(false)}>
              <MenuItem icon={<Save size={16} />} label="Save now" hint="Ctrl+S" onClick={() => { setMenu(false); void saveNow(); }} />
              <MenuItem icon={<Download size={16} />} label="Download project file" onClick={() => { setMenu(false); exportProject(engine.serialize()); }} />
              <MenuItem icon={<FileImage size={16} />} label="Save a picture" onClick={() => { setMenu(false); downloadDataUrl(`${fileSafe(engine.doc.title)}.png`, engine.screenshot()); }} />
              <MenuItem icon={<Camera size={16} />} label="Reset camera" hint="O" onClick={() => { setMenu(false); engine.frameCamera(); }} />
              <MenuItem icon={<Maximize size={16} />} label="Full screen" onClick={() => { setMenu(false); if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); }} />
              <MenuItem icon={api?.ambience.enabled ? <VolumeX size={16} /> : <Volume2 size={16} />} label={api?.ambience.enabled ? 'Turn off nature sounds' : 'Play nature sounds'} onClick={() => { setMenu(false); audio(); if (api?.ambience.enabled) api.ambience.stop(); else api?.ambience.start(); force((x) => x + 1); }} />
              <MenuItem icon={<Settings2 size={16} />} label="Settings" onClick={() => { setMenu(false); setSettingsOpen(true); }} />
              <MenuItem icon={<HelpCircle size={16} />} label="How to use" onClick={() => { setMenu(false); setHelp(true); }} />
            </div>
          )}
        </div>
      </header>

      {/* ---------------- body ---------------- */}
      <div className="relative flex min-h-0 flex-1">
        {ctx && (
          <StudioContext.Provider value={ctx}>
            {wide && mode === 'build' && <aside className="dd-side z-20 w-[320px] shrink-0 overflow-hidden border-r border-black/10"><LibraryPanel /></aside>}
            {wide && mode === 'code' && <aside className="dd-side z-20 w-[56%] min-w-[460px] max-w-[980px] shrink-0 overflow-hidden border-r border-black/10"><CodePanel /></aside>}
          </StudioContext.Provider>
        )}
        <div className="relative min-w-0 flex-1">
          <div ref={hostRef} className="absolute inset-0 overflow-hidden bg-[#d8cfc2]" />
          {ctx && (
            <StudioContext.Provider value={ctx}>
              <Viewport mode={mode} playing={playing} toast={toast} />
              {mode === 'explore' && <ExploreLayer wide={wide} playing={playing} />}
            </StudioContext.Provider>
          )}
          {loading && (
            <div className="absolute inset-0 z-40 grid place-items-center bg-[#2a3a2f]/80 backdrop-blur-sm">
              <div className="w-[min(88vw,380px)] text-center text-white">
                <div className="mb-3 animate-bounce text-5xl">{biome?.emoji ?? '📦'}</div>
                <div className="font-display text-xl font-semibold">Building your diorama…</div>
                <div className="mt-1 h-5 text-sm text-white/75">{loading.label}</div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-amber-300 transition-all" style={{ width: `${Math.round((loading.done / Math.max(1, loading.total)) * 100)}%` }} /></div>
                <p className="mt-4 text-xs text-white/70">💡 {biome?.guide.adaptations[Math.floor((loading.done / 3)) % (biome?.guide.adaptations.length || 1)] ?? 'Every habitat has producers, consumers and decomposers.'}</p>
              </div>
            </div>
          )}
        </div>
        {ctx && wide && mode === 'build' && (
          <StudioContext.Provider value={ctx}>
            <aside className="dd-side z-20 w-[320px] shrink-0 overflow-hidden border-l border-black/10"><InspectorPanel /></aside>
          </StudioContext.Provider>
        )}
        {ctx && !wide && (mode === 'build' || mode === 'code') && (
          <StudioContext.Provider value={ctx}>
            <MobileSheet mode={mode} />
          </StudioContext.Provider>
        )}
      </div>

      {/* ---------------- mobile bottom nav ---------------- */}
      {!wide && (
        <nav className="dd-bottomnav z-30 flex shrink-0 justify-around gap-1 px-2 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5">
          {([['explore', 'Explore', Compass], ['build', 'Build', Hammer], ['code', 'Code', Blocks]] as const).map(([m, label, Icon]) => (
            <button key={m} onClick={() => setMode(m)} className={clsx('flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1 font-display text-xs font-semibold', mode === m ? 'bg-white/15 text-white' : 'text-white/65')}>
              <Icon size={20} />{label}
            </button>
          ))}
        </nav>
      )}

      {/* ---------------- toasts ---------------- */}
      <div className="pointer-events-none fixed left-1/2 top-16 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={clsx('dd-toast rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-lg', t.kind === 'error' ? 'bg-red-600 text-white' : t.kind === 'success' ? 'bg-leaf text-white' : 'bg-ink text-white')}>{t.text}</div>
        ))}
      </div>

      {settings.tips && !loading && (
        <div className="fixed bottom-24 left-1/2 z-40 w-[min(94vw,560px)] -translate-x-1/2 sm:bottom-24">
          <div className="dd-panel rounded-3xl p-4">
            <div className="flex items-start gap-3">
              <div className="text-3xl">👋</div>
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-display text-lg font-semibold">Welcome to your diorama!</div>
                <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-ink/80">
                  <li><b>Explore</b>: drag to look around, tap any animal or plant to learn about it.</li>
                  <li><b>Build</b>: add species from the library and sculpt the land.</li>
                  <li><b>Code</b>: snap blocks together, then press <b className="text-[#2f9a3c]">▶ Play</b> to bring it to life.</li>
                  <li>Show it off with the <b>Tour</b>, or <b>Walk in</b> at an ant’s eye level.</li>
                </ol>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Btn size="sm" variant="ghost" onClick={() => setHelp(true)}>More help</Btn>
              <Btn size="sm" variant="solid" onClick={() => { const s = { ...settings, tips: false }; setSettings(s); saveSettings(s); }}>Got it!</Btn>
            </div>
          </div>
        </div>
      )}
      <Modal open={help} onClose={() => setHelp(false)} title="How to use Digital Diorama" wide>
        <HelpContent />
      </Modal>
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings">
        {engine && (
          <div className="space-y-4">
            <div>
              <div className="mb-1 text-[13px] font-semibold text-ink/70">Graphics quality</div>
              <Segmented value={settings.quality} onChange={(q) => { const s = { ...settings, quality: q }; setSettings(s); saveSettings(s); engine.setQuality(q); toast('Reopen the diorama to rebuild models at the new quality.'); }}
                options={[{ value: 'low', label: 'Fast' }, { value: 'medium', label: 'Balanced' }, { value: 'high', label: 'Detailed' }]} />
            </div>
            <Toggle label="Show true sizes (no magnifying of small creatures)" checked={engine.env.trueScale} onChange={(v) => engine.setEnv({ trueScale: v })} />
            <Toggle label="Sound effects" checked={settings.sound} onChange={(v) => { const s = { ...settings, sound: v }; setSettings(s); saveSettings(s); }} />
            <label className="block">
              <span className="text-[13px] font-semibold text-ink/70">Made by</span>
              <input className="dd-input mt-1" defaultValue={engine.doc.author} onBlur={(e) => { engine.doc.author = e.target.value; engine.frame.setTitle(engine.doc.title, e.target.value ? `by ${e.target.value}` : ''); engine.changed(); }} />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-ink/70">About this diorama</span>
              <textarea className="dd-input mt-1 h-24" defaultValue={engine.doc.description} onBlur={(e) => { engine.doc.description = e.target.value; engine.changed(); }} />
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

function MenuItem({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left font-semibold text-ink/85 hover:bg-black/5">
      <span className="text-ink/60">{icon}</span><span className="flex-1">{label}</span>{hint && <kbd className="text-[11px] text-ink/40">{hint}</kbd>}
    </button>
  );
}

function MobileSheet({ mode }: { mode: Mode }) {
  const [tab, setTab] = useState<'library' | 'inspector'>('library');
  const [size, setSize] = useState<'min' | 'half' | 'full'>('half');
  const h = size === 'min' ? '56px' : size === 'half' ? (mode === 'code' ? '62%' : '46%') : '88%';
  return (
    <div className="dd-sheet absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-3xl" style={{ height: h }}>
      <button className="mx-auto mt-1.5 h-1.5 w-12 rounded-full bg-black/20" aria-label="Resize panel" onClick={() => setSize(size === 'half' ? 'full' : size === 'full' ? 'min' : 'half')} />
      {mode === 'build' && (
        <div className="flex gap-1 px-3 pt-1.5">
          <Segmented value={tab} onChange={(t) => { setTab(t); if (size === 'min') setSize('half'); }} options={[{ value: 'library', label: '➕ Add things' }, { value: 'inspector', label: '🛠️ Edit' }]} />
        </div>
      )}
      <div className="min-h-0 flex-1">
        {size !== 'min' && (mode === 'code' ? <CodePanel compact /> : tab === 'library' ? <LibraryPanel compact onAdded={() => setTab('inspector')} /> : <InspectorPanel />)}
      </div>
    </div>
  );
}

function HelpContent() {
  const rows: [string, string, string][] = [
    ['🧭', 'Explore', 'Drag to orbit, pinch or scroll to zoom, right-drag or two fingers to pan. Tap any plant or animal to learn about it. Try “Walk inside”, the food web, and the guided tour.'],
    ['🔨', 'Build', 'Pick things from the library (tap, or drag them onto the diorama). Drag objects to move them. Use the Land tools to raise hills, dig ponds and paint the ground. Delete with the bin or the Delete key.'],
    ['🧩', 'Code', 'Choose an object, then snap blocks together like Scratch. Start scripts with “when ▶ clicked”, then press Play. Stop resets everything to how you built it. Click a stack of blocks to try it.'],
    ['🎤', 'Present', 'Add notes to your organisms (Build → Edit → My notes). The Tour visits each labelled thing in order and can read your notes aloud.'],
    ['⌨️', 'Shortcuts', 'Ctrl+Z undo · Ctrl+Shift+Z redo · Delete remove · D duplicate · F focus · L labels · O overview · Esc stop/deselect · WASD walk'],
  ];
  return (
    <div className="space-y-3">
      {rows.map(([e, h, t]) => (
        <div key={h} className="flex gap-3 rounded-2xl bg-black/[0.03] p-3">
          <div className="text-2xl">{e}</div>
          <div><div className="font-display font-semibold">{h}</div><div className="text-sm text-ink/75">{t}</div></div>
        </div>
      ))}
    </div>
  );
}
