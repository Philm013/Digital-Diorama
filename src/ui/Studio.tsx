import { useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, Play, Square, Undo2, Redo2, Compass, Hammer, Blocks, MoreHorizontal, Save, Download, Camera, Maximize, Volume2, VolumeX, HelpCircle, Settings2, FileImage, BookOpen, Plus, Trophy, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { Engine } from '../engine/Engine';
import type { DioramaDoc, Mode } from '../engine/types';
import { ScriptRuntime } from '../code/runtime';
import { Ambience, audio, playSound } from '../code/sound';
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
import { BottomSheet } from './BottomSheet';
import { ContextBar } from './ContextBar';
import { Celebrations } from './game/Celebrate';
import { HealthChip, XpChip, QuestTracker, QuestLog, Stars } from './game/Hud';
import { Journal } from './game/Journal';
import { useGame, useProfile } from './game/useGame';
import { awardBadge } from '../game/progress';
import { flag } from '../game/ecology';
import { haptic, uiSound, setUiSound } from './feedback';

export interface Toast { id: number; text: string; kind: 'info' | 'error' | 'success' }

const MODES = [['explore', 'Explore', Compass], ['build', 'Build', Hammer], ['code', 'Code', Blocks]] as const;

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
  const [journal, setJournal] = useState(false);
  const [questLog, setQuestLog] = useState(false);
  const [title, setTitle] = useState(doc.title);
  const [, force] = useState(0);
  const [libOpen, setLibOpen] = useState(true);
  const [inspOpen, setInspOpen] = useState(true);
  const wide = useMedia('(min-width: 1024px)');
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => { setUiSound(settings.sound); }, [settings.sound]);

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
      if (e.type === 'thunder' && settingsRef.current.sound) playSound('thunder');
    });
    runtime.onState = () => {
      setPlaying(runtime.running);
      if (runtime.running && (engine.actorList.some((a) => a.doc.scripts) || engine.doc.worldScripts)) awardBadge('coder');
    };
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
  const version = useSyncExternalStore(engine?.subscribe ?? noopSub, engine?.getVersion ?? zero);
  const game = useGame(engine, version, !!engine && !loading);
  const profile = useProfile();

  const setMode = useCallback((m: Mode) => {
    if (!engine) return;
    if (engine.walk?.active) engine.walk.exit();
    engine.setMode(m);
    setModeState(m);
    setMenu(false);
    uiSound('tab');
    haptic(6);
    // panels change the viewport shape: re-frame once the layout has settled
    setTimeout(() => { engine.resize(); if (!engine.selectedId) engine.frameCamera(); }, 60);
  }, [engine]);

  const togglePlay = useCallback(() => {
    if (!runtime) return;
    audio();
    haptic(12);
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
  // walking in counts towards quests and badges
  useEffect(() => {
    const fn = (e: Event) => {
      if (!engine) return;
      const eye = (e as CustomEvent<number>).detail;
      if (flag(engine, 'walk')) engine.changed();
      if (eye <= 0.05) awardBadge('tiny-explorer');
    };
    document.addEventListener('dd-walk', fn);
    return () => document.removeEventListener('dd-walk', fn);
  }, [engine]);

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
      if (!mod && !runtime.running && ['1', '2', '3'].includes(e.key)) { setMode(MODES[Number(e.key) - 1][0]); return; }
      const sel = engine.selectedId;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel && mode === 'build' && !runtime.running) { e.preventDefault(); engine.removeActor(sel); uiSound('trash'); }
      else if (e.key.toLowerCase() === 'd' && sel && mode === 'build' && !runtime.running) void engine.duplicateActor(sel);
      else if (e.key.toLowerCase() === 'f' && sel) engine.focusActor(sel);
      else if ((e.key.toLowerCase() === 'r' || e.key === '+' || e.key === '=' || e.key === '-') && sel && mode === 'build' && !runtime.running) {
        // R / Shift+R turn by 45°, + and − resize the selected object
        const a = engine.getActor(sel);
        if (a) {
          engine.pushUndo();
          if (e.key.toLowerCase() === 'r') a.root.rotation.y += (e.shiftKey ? 1 : -1) * Math.PI / 4;
          else { a.root.scale.setScalar(Math.min(4, Math.max(0.25, a.root.scale.x * (e.key === '-' ? 1 / 1.15 : 1.15)))); a.syncLabel(); a.updateRing(); }
          engine.commitTransform(a); engine.changed(); uiSound('tick');
        }
      }
      else if (e.key === 'Escape') { if (runtime.running) runtime.stop(); else engine.select(null); }
      else if (e.key.toLowerCase() === 'l' && !mod) engine.setEnv({ labels: !engine.env.labels }, false);
      else if (e.key.toLowerCase() === 'o' && !mod) engine.frameCamera();
      else if (e.key.toLowerCase() === 'j' && !mod) setJournal((v) => !v);
      else if (e.key.toLowerCase() === 'q' && !mod && mode !== 'code') setQuestLog((v) => !v);
    };
    const up = (e: KeyboardEvent) => runtime.key(e.key === ' ' ? ' ' : e.key, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [engine, runtime, mode, saveNow, setMode]);

  const biome = BIOME_BY_ID[doc.biome];
  const ctx = useMemo(() => api, [api]);
  const [sheetIdx, setSheetIdx] = useState(1);
  const [sheetH, setSheetH] = useState(0);
  // keep the scene centred in the part of the view the phone sheet leaves visible
  useEffect(() => { engine?.setBottomInset(!wide && (mode === 'build' || mode === 'code') ? sheetH : 0); }, [engine, wide, mode, sheetH]);
  const selected = engine?.getActor(engine.selectedId);
  const showContext = !!ctx && mode === 'build' && !playing && !!selected && !selected.isClone && !engine?.walk?.active;
  const goCode = useCallback(() => { if (engine && selected) { engine.select(selected.id); setMode('code'); } }, [engine, selected, setMode]);

  return (
    <div className="dd-studio flex h-full flex-col" style={{ ['--accent' as string]: biome?.accent ?? '#3f7d3a' }}>
      {/* ---------------- top HUD ---------------- */}
      <header className="dd-topbar pt-safe z-40 flex h-[60px] shrink-0 items-center gap-1.5 px-2 sm:gap-2 sm:px-3">
        <IconBtn label="Back to all dioramas" onClick={() => void exit()} className="text-white hover:bg-white/10"><ArrowLeft size={21} /></IconBtn>
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-2xl text-2xl sm:grid" style={{ background: 'color-mix(in srgb, var(--accent) 45%, transparent)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.15)' }}>{biome?.emoji ?? '📦'}</span>
          <div className="min-w-0">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => { if (engine && title.trim() && title !== engine.doc.title) { engine.doc.title = title.trim(); engine.frame.setTitle(engine.doc.title, engine.doc.author ? `by ${engine.doc.author}` : ''); engine.changed(); } }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="block w-[30vw] min-w-0 max-w-[240px] truncate rounded-lg bg-transparent px-1.5 font-display text-[15px] font-semibold leading-tight text-white outline-none hover:bg-white/10 focus:bg-white/15 sm:text-lg"
              aria-label="Diorama title"
            />
            <button onClick={() => setQuestLog(true)} className="flex items-center gap-1 px-1.5 text-[11px] font-bold text-white/55 hover:text-white/85" title="Quests (Q)">
              <Stars n={game.stars} size={10} /> <span className="tabular-nums">{game.done}/{game.quests.length || 16} quests</span>
            </button>
          </div>
        </div>
        {wide && <ModeTabs mode={mode} onMode={setMode} />}
        <div className="flex-1" />
        {engine && mode === 'build' && wide && <UndoRedo engine={engine} />}
        {engine && !loading && <HealthChip game={game} compact={!wide} />}
        <XpChip profile={profile} compact={!wide} onClick={() => setJournal(true)} />
        <button onClick={togglePlay} className={clsx('dd-3d flex h-11 min-w-[48px] items-center justify-center gap-1.5 rounded-2xl px-3.5 font-display text-[15px] font-bold text-white', playing ? 'bg-[#e8453c] [--edge:#a5241e]' : 'bg-[#3bb34a] [--edge:#23802f]')} title={playing ? 'Stop and reset (Esc)' : 'Run all code'}>
          {playing ? <Square size={16} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
          <span className="hidden sm:inline">{playing ? 'Stop' : 'Play'}</span>
        </button>
        <div className="relative">
          <IconBtn label="More" onClick={() => setMenu((v) => !v)} className="text-white hover:bg-white/10"><MoreHorizontal size={21} /></IconBtn>
          {menu && engine && (
            <div className="dd-glass dd-pop absolute right-0 top-12 z-50 w-64 rounded-3xl p-2 text-sm text-white" onMouseLeave={() => setMenu(false)}>
              <MenuItem icon={<BookOpen size={16} />} label="Field journal" hint="J" onClick={() => { setMenu(false); setJournal(true); }} />
              <MenuItem icon={<Trophy size={16} />} label="Quests" hint="Q" onClick={() => { setMenu(false); setQuestLog(true); }} />
              <div className="my-1 h-px bg-white/10" />
              <MenuItem icon={<Save size={16} />} label="Save now" hint="Ctrl+S" onClick={() => { setMenu(false); void saveNow(); }} />
              <MenuItem icon={<Download size={16} />} label="Download project file" onClick={() => { setMenu(false); exportProject(engine.serialize()); }} />
              <MenuItem icon={<FileImage size={16} />} label="Save a picture" onClick={() => { setMenu(false); downloadDataUrl(`${fileSafe(engine.doc.title)}.png`, engine.screenshot()); }} />
              <MenuItem icon={<Camera size={16} />} label="Reset camera" hint="O" onClick={() => { setMenu(false); engine.frameCamera(); }} />
              <MenuItem icon={<Maximize size={16} />} label="Full screen" onClick={() => { setMenu(false); if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); }} />
              <MenuItem icon={api?.ambience.enabled ? <VolumeX size={16} /> : <Volume2 size={16} />} label={api?.ambience.enabled ? 'Turn off nature sounds' : 'Play nature sounds'} onClick={() => { setMenu(false); audio(); if (api?.ambience.enabled) api.ambience.stop(); else api?.ambience.start(); force((x) => x + 1); }} />
              <MenuItem icon={<Settings2 size={16} />} label="Settings" onClick={() => { setMenu(false); setSettingsOpen(true); }} />
              <MenuItem icon={<HelpCircle size={16} />} label="How to play" onClick={() => { setMenu(false); setHelp(true); }} />
            </div>
          )}
        </div>
      </header>

      {/* ---------------- body ---------------- */}
      <div className="relative flex min-h-0 flex-1">
        {ctx && (
          <StudioContext.Provider value={ctx}>
            {wide && mode === 'build' && libOpen && <aside className="dd-side z-20 w-[340px] shrink-0 overflow-hidden border-r border-black/10"><LibraryPanel onCollapse={() => setLibOpen(false)} /></aside>}
            {wide && mode === 'code' && <aside className="dd-side z-20 w-[56%] min-w-[460px] max-w-[980px] shrink-0 overflow-hidden border-r border-black/10"><CodePanel /></aside>}
          </StudioContext.Provider>
        )}
        <div className="relative min-w-0 flex-1">
          <div ref={hostRef} className="absolute inset-0 overflow-hidden bg-[#d8cfc2]" />
          {ctx && (
            <StudioContext.Provider value={ctx}>
              <Viewport mode={mode} playing={playing} toast={toast} />
              {mode === 'explore' && <ExploreLayer wide={wide} playing={playing} onJournal={() => setJournal(true)} />}
              {!loading && mode !== 'code' && !(mode === 'build' && !wide) && !engine?.walk?.active && (
                <div className={clsx('pointer-events-none absolute z-20', wide ? 'left-3 top-3' : 'left-2 top-2')}>
                  <QuestTracker game={game} mobile={!wide || mode === 'build'} onOpen={() => setQuestLog(true)} />
                </div>
              )}
              {wide && mode === 'build' && !libOpen && (
                <button onClick={() => setLibOpen(true)} className="dd-3d absolute bottom-5 left-4 z-20 flex h-14 items-center gap-2 rounded-2xl bg-[#7c5cff] px-5 font-display text-base font-bold text-white [--edge:#4b33b8]"><Plus size={20} /> Add things</button>
              )}
              {wide && mode === 'build' && !inspOpen && (
                <button onClick={() => setInspOpen(true)} className="dd-3d absolute bottom-5 right-4 z-20 flex h-12 items-center gap-2 rounded-2xl bg-white px-4 font-display text-sm font-bold text-ink [--edge:rgba(0,0,0,.2)]"><Settings2 size={18} /> {selected ? 'Edit' : 'Diorama'}</button>
              )}
              {showContext && <ContextBar docked={!wide} bottom={wide ? 0 : sheetH} onCode={goCode} />}
            </StudioContext.Provider>
          )}
          {loading && <LoadingScreen biome={biome} loading={loading} />}
        </div>
        {ctx && wide && mode === 'build' && inspOpen && (
          <StudioContext.Provider value={ctx}>
            <aside className="dd-side z-20 w-[330px] shrink-0 overflow-hidden border-l border-black/10"><InspectorPanel onCollapse={() => setInspOpen(false)} /></aside>
          </StudioContext.Provider>
        )}
        {ctx && !wide && (mode === 'build' || mode === 'code') && (
          <StudioContext.Provider value={ctx}>
            <MobileSheet mode={mode} index={sheetIdx} setIndex={setSheetIdx} onHeight={setSheetH} />
          </StudioContext.Provider>
        )}
      </div>

      {/* ---------------- mobile bottom nav ---------------- */}
      {!wide && (
        <nav className="dd-bottomnav pb-safe z-40 flex shrink-0 justify-around gap-1 px-2 pt-1.5">
          {MODES.map(([m, label, Icon]) => (
            <button key={m} onClick={() => { setMode(m); if (m !== 'explore') setSheetIdx(1); }} className={clsx('flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl font-display text-[12px] font-semibold transition', mode === m ? 'bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12)]' : 'text-white/60 active:bg-white/10')}>
              <Icon size={22} strokeWidth={mode === m ? 2.4 : 2} />{label}
            </button>
          ))}
          <button onClick={() => setJournal(true)} className="flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl font-display text-[12px] font-semibold text-white/60 active:bg-white/10">
            <BookOpen size={22} />Journal
          </button>
        </nav>
      )}

      <Celebrations sound={settings.sound} />

      {/* ---------------- toasts ---------------- */}
      <div className="pointer-events-none fixed left-1/2 top-[72px] z-50 flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={clsx('dd-toast rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-lg', t.kind === 'error' ? 'bg-red-600 text-white' : t.kind === 'success' ? 'bg-leaf text-white' : 'dd-glass text-white')}>{t.text}</div>
        ))}
      </div>

      {settings.tips && !loading && <Briefing biome={biome?.name ?? 'diorama'} onHelp={() => setHelp(true)} onDone={() => { const s = { ...settings, tips: false }; setSettings(s); saveSettings(s); uiSound('pop'); }} />}
      <Modal open={help} onClose={() => setHelp(false)} title="How to play" wide>
        <HelpContent />
      </Modal>
      <Modal open={journal} onClose={() => setJournal(false)} title="📖 Field journal" wide>
        <Journal />
      </Modal>
      <Modal open={questLog} onClose={() => setQuestLog(false)} title={<span className="flex items-center gap-2"><Trophy size={20} className="text-amber-500" /> Quests for this diorama</span>} wide>
        <QuestLog game={game} />
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

const noopSub = () => () => {};
const zero = () => 0;

function ModeTabs({ mode, onMode }: { mode: Mode; onMode: (m: Mode) => void }) {
  const i = MODES.findIndex(([m]) => m === mode);
  return (
    <nav className="dd-modes relative ml-2 flex rounded-[18px] p-1" role="tablist">
      <span className="dd-mode-ind absolute bottom-1 top-1 rounded-[14px]" style={{ width: 'calc((100% - 8px) / 3)', transform: `translateX(${i * 100}%)` }} />
      {MODES.map(([m, label, Icon], k) => (
        <button key={m} role="tab" aria-selected={mode === m} onClick={() => onMode(m)} title={`${label} (${k + 1})`} className={clsx('relative z-10 flex h-10 w-[112px] items-center justify-center gap-1.5 rounded-[14px] font-display text-[15px] font-semibold transition-colors', mode === m ? 'text-ink' : 'text-white/75 hover:text-white')}>
          <Icon size={17} strokeWidth={2.3} />{label}
        </button>
      ))}
    </nav>
  );
}

/** subscribes to the engine so the buttons enable as soon as there is something to undo */
function UndoRedo({ engine }: { engine: Engine }) {
  useSyncExternalStore(engine.subscribe, engine.getVersion);
  return (
    <>
      <IconBtn label="Undo (Ctrl+Z)" disabled={!engine.canUndo} onClick={() => void engine.undo()} className="text-white hover:bg-white/10"><Undo2 size={19} /></IconBtn>
      <IconBtn label="Redo (Ctrl+Shift+Z)" disabled={!engine.canRedo} onClick={() => void engine.redo()} className="text-white hover:bg-white/10"><Redo2 size={19} /></IconBtn>
    </>
  );
}

function MenuItem({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void }) {
  return (
    <button onClick={() => { uiSound('tick'); onClick(); }} className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left font-semibold text-white/90 hover:bg-white/10">
      <span className="text-white/60">{icon}</span><span className="flex-1">{label}</span>{hint && <kbd className="rounded-md bg-white/10 px-1.5 text-[11px] text-white/50">{hint}</kbd>}
    </button>
  );
}

function LoadingScreen({ biome, loading }: { biome?: { emoji: string; name: string; guide: { adaptations: string[] } }; loading: { done: number; total: number; label: string } }) {
  const pct = Math.round((loading.done / Math.max(1, loading.total)) * 100);
  const tips = biome?.guide.adaptations ?? ['Every habitat has producers, consumers and decomposers.'];
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-[radial-gradient(120%_100%_at_50%_0%,#2f4a39,#141d18)]">
      <div className="w-[min(88vw,420px)] text-center text-white">
        <div className="dd-bob mx-auto mb-4 grid h-24 w-24 place-items-center rounded-[30px] bg-white/10 text-6xl shadow-[inset_0_1px_0_rgba(255,255,255,.15)]">{biome?.emoji ?? '📦'}</div>
        <div className="font-display text-2xl font-bold">Building {biome?.name ?? 'your diorama'}…</div>
        <div className="mt-1 h-5 text-sm text-white/70">{loading.label}</div>
        <div className="mx-auto mt-4 h-4 overflow-hidden rounded-full bg-black/30 p-0.5 shadow-[inset_0_2px_4px_rgba(0,0,0,.4)]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#ffe066] to-[#ffb020] shadow-[0_0_12px_rgba(255,190,40,.6)] transition-all duration-300" style={{ width: `${Math.max(6, pct)}%` }} />
        </div>
        <div className="mt-1 font-display text-xs font-bold text-white/50">{pct}%</div>
        <div className="mx-auto mt-5 max-w-sm rounded-2xl bg-white/[0.07] p-3 text-left text-[13px] leading-snug text-white/85 ring-1 ring-white/10">
          <div className="mb-0.5 flex items-center gap-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-amber-300"><Sparkles size={13} /> Field fact</div>
          {tips[Math.floor(loading.done / 3) % tips.length]}
        </div>
      </div>
    </div>
  );
}

function Briefing({ biome, onHelp, onDone }: { biome: string; onHelp: () => void; onDone: () => void }) {
  const steps: [string, string, string][] = [
    ['🧭', 'Explore', 'Drag to look around. Tap any living thing to discover it and add it to your field journal.'],
    ['🔨', 'Build', 'Add species from the inventory and sculpt the land. Keep the ecosystem-health heart green!'],
    ['🧩', 'Code', 'Snap blocks together, then press ▶ Play to bring your habitat to life.'],
    ['🏆', 'Quests', 'Complete quests to earn stars, XP and badges.'],
  ];
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-3 backdrop-blur-[2px]">
      <div className="dd-card-dark dd-pop w-[min(94vw,560px)] rounded-[30px] p-5 text-white">
        <div className="font-display text-[12px] font-bold uppercase tracking-[0.18em] text-amber-300">Ranger briefing</div>
        <div className="mt-0.5 font-display text-2xl font-bold">Welcome to your {biome}!</div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {steps.map(([e, h, t]) => (
            <div key={h} className="flex gap-3 rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10">
              <div className="text-3xl">{e}</div>
              <div><div className="font-display font-semibold">{h}</div><div className="text-[13px] leading-snug text-white/75">{t}</div></div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Btn variant="ghost" className="text-white/80 hover:bg-white/10" onClick={onHelp}>More help</Btn>
          <button onClick={onDone} className="dd-cta h-12 rounded-2xl px-6 font-display text-lg font-bold text-white">Let’s go!</button>
        </div>
      </div>
    </div>
  );
}

function MobileSheet({ mode, index, setIndex, onHeight }: { mode: Mode; index: number; setIndex: (i: number) => void; onHeight: (h: number) => void }) {
  const [tab, setTab] = useState<'library' | 'inspector'>('library');
  const engineSel = useRef<string | null>(null);
  const api = useContextSafe();
  // selecting something in the scene flips to the editor
  useEffect(() => {
    if (!api) return;
    const off = api.engine.on((e) => {
      if (e.type === 'select' && e.id && e.id !== engineSel.current) { setTab('inspector'); if (index === 0) setIndex(1); }
      if (e.type === 'select') engineSel.current = e.id;
    });
    return () => { off(); };
  }, [api, index, setIndex]);
  const snaps = mode === 'code' ? [0.1, 0.62, 0.92] : [0.11, 0.48, 0.9];
  return (
    <BottomSheet snaps={snaps} index={index} onIndex={setIndex} onHeight={onHeight}
      header={mode === 'build' ? (
        <div className="flex gap-1 px-3 pb-2">
          {([['library', '➕ Add things'], ['inspector', '🛠️ Edit']] as const).map(([t, l]) => (
            <button key={t} onClick={() => { setTab(t); if (index === 0) setIndex(1); uiSound('tab'); }} className={clsx('h-11 flex-1 rounded-2xl font-display text-[15px] font-semibold transition', tab === t ? 'bg-ink text-white shadow' : 'bg-black/[0.05] text-ink/70')}>{l}</button>
          ))}
        </div>
      ) : <div className="px-4 pb-2 font-display text-sm font-semibold text-ink/60">🧩 Code — drag up for more room</div>}>
      {mode === 'code' ? <CodePanel compact /> : tab === 'library' ? <LibraryPanel compact onAdded={() => { setTab('inspector'); setIndex(0); }} /> : <InspectorPanel />}
    </BottomSheet>
  );
}
function useContextSafe() { return useContext(StudioContext); }

function HelpContent() {
  const rows: [string, string, string][] = [
    ['🧭', 'Explore', 'Drag to orbit, pinch or scroll to zoom, two fingers or right-drag to pan. Tap any plant or animal to discover it — every discovery goes into your field journal and earns XP.'],
    ['🔨', 'Build', 'Open the inventory and tap (or drag) things onto the diorama. Tap an object to select it, then drag it to move. On a phone, twist two fingers to turn it and pinch to resize; long-press picks up anything. Use the Land tools to raise hills, dig ponds and paint the ground.'],
    ['💚', 'Ecosystem health', 'The heart in the top bar scores how complete and balanced your food web is. Open it for tips — every animal needs food, and real food pyramids have fewer predators than prey.'],
    ['🏆', 'Quests & badges', 'Each diorama has 16 quests: finish 5, 10 and all 16 for one, two and three stars. Badges are earned across all your dioramas.'],
    ['🧩', 'Code', 'Choose an object, then snap blocks together like Scratch. Start scripts with “when ▶ clicked”, then press Play. Stop resets everything to how you built it.'],
    ['🎤', 'Present', 'Add notes to your organisms (Build → Edit → My notes). The Tour visits each one in food-chain order and can read your notes aloud.'],
    ['⌨️', 'Shortcuts', '1 2 3 modes · J journal · Q quests · R / Shift+R turn · + − resize · D duplicate · Delete remove · F focus · L labels · O overview · Ctrl+Z undo · Ctrl+Shift+Z redo · Esc stop/deselect · WASD walk'],
  ];
  const challenges = [
    '🐝 Make a bee visit three different flowers, then fly home.',
    '🦁 Code a predator–prey chase: the hunter uses “eat (nearest food)”, the prey uses “predator within 5 m?” and “run away”.',
    '🌙 When it becomes night, make the owl hoot and fly; when it becomes day, make it sleep.',
    '🦎 Use “set colour” to make a chameleon or octopus camouflage itself when tapped.',
    '🌧️ Write a World script that tells the story of the water cycle with captions, rain and a rainbow.',
    '❓ Add a quiz: tap an animal, ask “What do I eat?”, and check the answer.',
    '👶 Population model: each time you tap a rabbit it “has a baby” — what happens to the grass?',
  ];
  return (
    <div className="space-y-3">
      {rows.map(([e, h, t]) => (
        <div key={h} className="flex gap-3 rounded-2xl bg-black/[0.03] p-3">
          <div className="text-2xl">{e}</div>
          <div><div className="font-display font-semibold">{h}</div><div className="text-sm text-ink/75">{t}</div></div>
        </div>
      ))}
      <div className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
        <div className="font-display font-semibold">🧩 Coding challenges</div>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink/80">{challenges.map((c) => <li key={c}>{c}</li>)}</ul>
      </div>
    </div>
  );
}

