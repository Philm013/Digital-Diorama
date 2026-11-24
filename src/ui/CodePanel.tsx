import { useEffect, useMemo, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { clsx } from 'clsx';
import { Globe2, Play, Trash2, Lightbulb } from 'lucide-react';
import '../code/blocks';
import { buildToolbox } from '../code/toolbox';
import { dioramaTheme } from '../code/theme';
import { codeContext } from '../code/context';
import { RECIPES, recipeBlock } from '../code/recipes';
import { getSchema } from '../assets/builder';
import { CATALOG } from '../assets/catalog';
import { useStudio, useEngineEvent, useEngineVersion } from './store';
import { Btn } from './common';
import { audio } from '../code/sound';

type Target = string; // actor id, or '' for the World

export function CodePanel({ compact }: { compact?: boolean }) {
  const { engine, runtime } = useStudio();
  useEngineVersion();
  const host = useRef<HTMLDivElement>(null);
  const ws = useRef<Blockly.WorkspaceSvg | null>(null);
  const [target, setTarget] = useState<Target>(() => engine.selectedId && engine.getActor(engine.selectedId) ? engine.selectedId : '');
  const targetRef = useRef(target);
  const loadingRef = useRef(false);
  const saveTimer = useRef(0);
  const [empty, setEmpty] = useState(true);
  const [showRecipes, setShowRecipes] = useState(false);

  const rank = (a: { doc: { scripts?: unknown }; def: { category: string } }) => (a.doc.scripts ? 0 : a.def.category === 'animals' ? 1 : a.def.category === 'plants' || a.def.category === 'fungi' ? 2 : 3);
  const actors = engine.actorList.filter((a) => !a.isClone).sort((a, b) => rank(a) - rank(b));
  const current = target ? engine.getActor(target) : undefined;
  const isWorld = !current;

  /* ---------- live data for block menus ---------- */
  useEffect(() => {
    codeContext.objects = () => engine.actorList.filter((a) => !a.isClone).map((a) => ({ id: a.id, name: a.name, emoji: a.def.emoji }));
    codeContext.joints = () => engine.getActor(targetRef.current)?.rigNames ?? [];
    codeContext.clips = () => engine.getActor(targetRef.current)?.clipNames ?? [];
    codeContext.isWorld = () => !engine.getActor(targetRef.current);
    codeContext.species = () => {
      const seen = new Map<string, string>();
      for (const a of engine.actorList) if (!a.isClone && a.def.category !== 'habitats') seen.set(a.def.id, a.def.name);
      for (const d of CATALOG) if (d.biomes.includes(engine.doc.biome) && (d.category === 'animals' || d.category === 'plants' || d.category === 'fungi')) seen.set(d.id, d.name);
      return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    };
  }, [engine]);
  useEffect(() => {
    let live = true;
    codeContext.params = () => [];
    const def = current ? current.def : engine.base?.def;
    if (def) void getSchema(def).then((s) => {
      if (!live) return;
      const hide = new Set([...(def.hidden ?? []), 'mergeForProduction', 'seed', 'diorama']);
      const list = Object.entries(s).filter(([k, p]) => !hide.has(k) && p && (p.type === 'range' || p.type === 'toggle' || p.type === 'choice')).map(([k, p]) => ({ key: k, label: p.label ?? k }));
      codeContext.params = () => list;
    });
    return () => { live = false; };
  }, [current]);

  /* ---------- inject Blockly once ---------- */
  useEffect(() => {
    const el = host.current!;
    const w = Blockly.inject(el, {
      toolbox: buildToolbox(!current),
      renderer: 'zelos',
      theme: dioramaTheme,
      media: './blockly-media/',
      zoom: { controls: true, wheel: true, startScale: compact ? 0.6 : 0.72, maxScale: 2, minScale: 0.3, scaleSpeed: 1.15 },
      trashcan: true,
      grid: { spacing: 28, length: 3, colour: '#e6decd', snap: false },
      move: { scrollbars: true, drag: true, wheel: false },
      sounds: false,
      toolboxPosition: 'start',
      maxTrashcanContents: 16,
    });
    ws.current = w;
    loadTarget(targetRef.current);
    const onChange = (e: Blockly.Events.Abstract) => {
      if (loadingRef.current) return;
      if (e.type === Blockly.Events.CLICK) {
        const ce = e as Blockly.Events.Click;
        if (ce.targetType === 'block' && ce.blockId) {
          const b = w.getBlockById(ce.blockId);
          const root = b?.getRootBlock();
          if (root && !root.type.startsWith('procedures_def') && !root.isShadow()) {
            audio();
            persist();
            runtime.highlightOwner = targetRef.current;
            runtime.runStack(targetRef.current, Blockly.serialization.workspaces.save(w), root.id);
          }
        }
        return;
      }
      if (e.isUiEvent) return;
      setEmpty(w.getTopBlocks(false).length === 0);
      clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(persist, 500);
    };
    w.addChangeListener(onChange);
    const ro = new ResizeObserver(() => Blockly.svgResize(w));
    ro.observe(el);
    // highlight running blocks of the object being edited
    const timers = new Map<string, number>();
    runtime.onHighlight = (id) => {
      const b = w.getBlockById(id);
      if (!b) return;
      w.highlightBlock(id, true);
      clearTimeout(timers.get(id));
      timers.set(id, window.setTimeout(() => { try { w.highlightBlock(id, false); } catch { /* disposed */ } }, 350));
    };
    return () => {
      persist();
      ro.disconnect();
      runtime.onHighlight = undefined;
      w.dispose();
      ws.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- switching which object we're coding ---------- */
  function persist() {
    const w = ws.current;
    if (!w || loadingRef.current) return;
    const json = w.getTopBlocks(false).length ? Blockly.serialization.workspaces.save(w) : undefined;
    const t = targetRef.current;
    const a = t ? engine.getActor(t) : undefined;
    const prev = JSON.stringify(a ? a.doc.scripts : engine.doc.worldScripts);
    if (JSON.stringify(json) === prev) return;
    if (a) a.doc.scripts = json; else if (!t) engine.doc.worldScripts = json;
    engine.changed();
  }
  function loadTarget(t: Target) {
    const w = ws.current;
    if (!w) return;
    loadingRef.current = true;
    targetRef.current = t;
    runtime.highlightOwner = t;
    const a = t ? engine.getActor(t) : undefined;
    w.updateToolbox(buildToolbox(!a) as Blockly.utils.toolbox.ToolboxDefinition);
    w.clear();
    const json = a ? a.doc.scripts : engine.doc.worldScripts;
    if (json) {
      try { Blockly.serialization.workspaces.load(json as Blockly.serialization.blocks.State, w); } catch (e) { console.error(e); }
    }
    setEmpty(w.getTopBlocks(false).length === 0);
    // frame the scripts in the visible area (beside the toolbox), never zooming in past the default
    requestAnimationFrame(() => {
      try {
        Blockly.svgResize(w);
        if (w.getTopBlocks(false).length) {
          w.zoomToFit();
          const max = compact ? 0.62 : 0.75;
          if (w.scale > max) { w.setScale(max); w.scrollCenter(); }
        } else w.scrollCenter();
      } catch { /* workspace disposed */ }
    });
    setTimeout(() => { loadingRef.current = false; }, 0);
  }
  const choose = (t: Target) => {
    if (t === targetRef.current) return;
    persist();
    setTarget(t);
    loadTarget(t);
    if (t) engine.select(t); else engine.select(null);
  };
  // follow viewport taps
  useEngineEvent((e) => { if (e.type === 'select' && e.id && e.id !== targetRef.current && engine.getActor(e.id) && !engine.getActor(e.id)!.isClone) choose(e.id); });
  useEffect(() => { if (engine.selectedId && engine.selectedId !== targetRef.current) choose(engine.selectedId); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addRecipe = (id: string) => {
    const w = ws.current;
    const r = RECIPES.find((x) => x.id === id);
    if (!w || !r) return;
    const tops = w.getTopBlocks(false);
    const y = tops.reduce((m, b) => Math.max(m, b.getRelativeToSurfaceXY().y + b.getHeightWidth().height), 0) + (tops.length ? 40 : 30);
    Blockly.serialization.blocks.append(recipeBlock(r, current?.name ?? engine.doc.title, 40, y) as Blockly.serialization.blocks.State, w);
    setShowRecipes(false);
    persist();
  };
  const recipes = useMemo(() => RECIPES.filter((r) => !!r.world === isWorld && (r.id !== 'circle' || current?.def.loco === 'fly')), [isWorld, current]);

  return (
    <div className="dd-code flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-black/5 px-2 py-1.5">
        <div className="dd-scroll-x flex min-w-0 flex-1 gap-1 overflow-x-auto py-0.5" data-tour="code-targets">
          <TargetChip active={!target} onClick={() => choose('')} emoji={<Globe2 size={16} />} label="World" coded={!!engine.doc.worldScripts} />
          {actors.map((a) => <TargetChip key={a.id} active={target === a.id} onClick={() => choose(a.id)} emoji={a.def.emoji} label={a.name} coded={!!a.doc.scripts} />)}
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={host} className="absolute inset-0" data-tour="code-workspace" />
        {(empty || showRecipes) && (
          <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center pr-3" style={{ paddingLeft: compact ? 100 : 160 }}>
            <div className="pointer-events-auto max-h-[70%] max-w-md overflow-y-auto rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-black/10" data-tour="code-ideas">
              <div className="flex items-start gap-2 text-[13px] font-semibold leading-snug"><Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-500" /><span>{empty ? <>Coding <b>{current ? current.name : 'the World'}</b>. Drag in a yellow <i>when ▶ clicked</i> block from Events — or start from an idea:</> : 'Add an idea:'}</span></div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {recipes.map((r) => <button key={r.id} onClick={() => addRecipe(r.id)} className="rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-bold text-ink/80 ring-1 ring-amber-200 hover:bg-amber-100">{r.emoji} {r.label}</button>)}
              </div>
            </div>
          </div>
        )}
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-2" style={{ marginLeft: compact ? 30 : 70 }}>
          {!empty && <Btn size="sm" onClick={() => setShowRecipes((v) => !v)} data-tour="code-ideas-btn"><Lightbulb size={14} /> Ideas</Btn>}
          {!empty && <Btn size="sm" variant="ghost" className="bg-white/80" title="Clear all blocks for this object" onClick={() => { if (confirm('Remove all blocks for this object?')) { ws.current?.clear(); persist(); } }}><Trash2 size={14} /></Btn>}
          {compact && <Btn size="sm" variant={runtime.running ? 'stop' : 'go'} data-tour="code-play" onClick={() => { audio(); if (runtime.running) runtime.stop(); else runtime.start(true); }}><Play size={14} /> {runtime.running ? 'Stop' : 'Play'}</Btn>}
        </div>
      </div>
    </div>
  );
}

function TargetChip({ active, onClick, emoji, label, coded }: { active: boolean; onClick: () => void; emoji: React.ReactNode; label: string; coded: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (active) ref.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); }, [active]);
  return (
    <button ref={ref} onClick={onClick} className={clsx('relative flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 font-display text-[13px] font-semibold ring-1 transition-all', active ? 'bg-[#4C97FF] text-white ring-[#3d7fe0]' : 'bg-white text-ink/80 ring-black/10 hover:bg-black/5')}>
      <span className="text-lg leading-none">{emoji}</span><span className="max-w-[110px] truncate">{label}</span>
      {coded && <span className={clsx('absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2', active ? 'bg-amber-300 ring-[#4C97FF]' : 'bg-[#FFAB19] ring-white')} />}
    </button>
  );
}
