import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Mountain, ArrowDown, Waves, Eraser, Sparkles, Map as MapIcon, Box, Dices, X, Wand2, Ruler, Paintbrush } from 'lucide-react';
import { GROUND_TYPES } from '../engine/ground';
import { AREA_KINDS, GROUND_STYLES, STAMPS, STAMP_BY_ID, styleForBiome } from '../engine/landforms';
import type { LandTool } from '../engine/Engine';
import type { AreaSelect } from '../engine/LandEditor';
import { Engine } from '../engine/Engine';
import { DIORAMA_SIZES, MAX_DEPTH, MAX_WIDTH, MIN_SIZE } from '../engine/sizes';
import type { SculptTool } from '../engine/Terrain';
import { useEngine, useEngineVersion } from './store';
import { Btn, Section, Segmented, Slider, Toggle } from './common';
import { haptic, uiSound } from './feedback';
import { areaKindUnlocked, isUnlocked, showLocked, sizeUnlocked, stampFeature, stampUnlocked, type FeatureId } from '../game/unlocks';
import { useProfile } from './game/useGame';
import { LockBadge } from './game/Locked';

type Tab = 'sculpt' | 'landforms' | 'area' | 'paint';
const TABS: { id: Tab; label: string; emoji: string; needs?: FeatureId }[] = [
  { id: 'landforms', label: 'Landforms', emoji: '🏔️' },
  { id: 'area', label: 'Area', emoji: '⬚', needs: 'area' },
  { id: 'sculpt', label: 'Sculpt', emoji: '✋', needs: 'sculpt' },
  { id: 'paint', label: 'Paint', emoji: '🎨' },
];
const SCULPT: { tool: SculptTool; label: string; icon: React.ReactNode }[] = [
  { tool: 'raise', label: 'Raise', icon: <Mountain size={15} /> }, { tool: 'lower', label: 'Dig', icon: <ArrowDown size={15} /> },
  { tool: 'smooth', label: 'Smooth', icon: <Waves size={15} /> }, { tool: 'flatten', label: 'Flatten', icon: <Eraser size={15} /> },
  { tool: 'roughen', label: 'Rocky', icon: <Sparkles size={15} /> },
];
const tabOf = (t: LandTool | null): Tab | null => (t === 'stamp' ? 'landforms' : t === 'area' ? 'area' : t === 'paint' ? 'paint' : t ? 'sculpt' : null);
let lastTab: Tab = 'landforms';

/** Build mode's land tools: landform stamps, area generation, sculpt brushes and ground paint */
export function LandTools() {
  const engine = useEngine();
  useEngineVersion();
  const profile = useProfile();
  const t = engine.terrain!;
  const brush = engine.brush;
  const open = (k: Tab) => { const n = TABS.find((x) => x.id === k)?.needs; return !n || isUnlocked(n, profile); };
  const [tab, setTabState] = useState<Tab>(() => { const k = tabOf(brush.tool) ?? lastTab; return open(k) ? k : 'landforms'; });
  useEffect(() => { const k = tabOf(brush.tool); if (k && k !== tab) setTabState(k); }, [brush.tool]); // eslint-disable-line react-hooks/exhaustive-deps
  const setTab = (k: Tab) => {
    const needs = TABS.find((x) => x.id === k)?.needs;
    if (needs && !isUnlocked(needs)) { showLocked(needs); return; }
    lastTab = k;
    setTabState(k);
    uiSound('tick');
    // Area and Paint have one tool each: switching to them picks it up straight away
    engine.setLandTool(k === 'area' ? 'area' : k === 'paint' ? 'paint' : null);
  };
  const arm = (tool: LandTool) => { engine.setLandTool(brush.tool === tool ? null : tool); haptic(6); uiSound('tick'); };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-black/[0.05] p-1">
        {TABS.map((x) => (
          <button key={x.id} data-landtab={x.id} onClick={() => setTab(x.id)} className={clsx('relative flex h-12 flex-col items-center justify-center rounded-xl font-display text-[11.5px] font-semibold leading-tight transition', tab === x.id ? 'bg-white text-ink shadow-sm' : 'text-ink/60 hover:text-ink', !open(x.id) && 'opacity-55')}>
            <span className="text-[17px] leading-none">{x.emoji}</span>{x.label}
            {!open(x.id) && <LockBadge className="absolute right-1 top-1" />}
          </button>
        ))}
      </div>
      {tab === 'landforms' && <StampTools />}
      {tab === 'area' && <AreaTools />}
      {tab === 'sculpt' && (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            {SCULPT.map((x) => <Btn key={x.tool} size="sm" active={brush.tool === x.tool} onClick={() => arm(x.tool)}>{x.icon}{x.label}</Btn>)}
          </div>
          <p className="text-[11px] text-ink/55">{brush.tool && brush.tool !== 'paint' ? 'Press and hold on the land to keep working one spot, or drag to shape it. Tap the tool again to stop.' : 'Pick a brush, then press and drag on the land.'}</p>
          <Slider label="Brush size" value={brush.radius} min={0.5} max={Math.max(8, t.width / 5)} step={0.1} unit="m" onChange={(v) => { brush.radius = v; engine.changed(false); }} />
          <Slider label="Strength" value={brush.strength} min={0.01} max={0.2} step={0.005} format={(v) => `${Math.round(v * 500)}%`} onChange={(v) => { brush.strength = v; engine.changed(false); }} />
        </>
      )}
      {tab === 'paint' && <PaintTools />}
      <div className="flex gap-1.5">
        <Btn size="sm" className="flex-1" active={engine.topView} onClick={() => { engine.setTopView(!engine.topView); uiSound('tick'); }} title="Look straight down (T)">
          {engine.topView ? <Box size={15} /> : <MapIcon size={15} />}{engine.topView ? '3D view' : 'Top view'}
        </Btn>
        {brush.tool && <Btn size="sm" onClick={() => engine.setLandTool(null)} title="Put the tool away (Esc)"><X size={15} /> Done</Btn>}
      </div>
      <Toggle label="Water" checked={t.waterLevel !== null} onChange={(v) => engine.setWaterLevel(v ? -0.2 : null)} />
      {t.waterLevel !== null && <Slider label="Water level" value={t.waterLevel} min={-6} max={6} step={0.05} unit="m" onChange={(v) => { t.setWaterLevel(v); engine.water?.sync(); engine.changed(false); }} onCommit={(v) => engine.setWaterLevel(v)} />}
      <Slider label="Grass" value={engine.env.grass} min={0} max={1.5} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => engine.setEnv({ grass: v }, false)} onCommit={(v) => engine.setEnv({ grass: v })} />
    </div>
  );
}

function StampTools() {
  const engine = useEngine();
  useEngineVersion();
  const st = engine.land.stamp;
  const d = STAMP_BY_ID[st.id];
  const armed = engine.brush.tool === 'stamp';
  const digs = ['canyon', 'valley', 'lake', 'crater'].includes(d.id);
  const t = engine.terrain!;
  useProfile();
  const pick = (id: string) => {
    if (!stampUnlocked(id)) { showLocked(stampFeature(id)!); return; }
    if (armed && st.id === id) { engine.setLandTool(null); return; }
    engine.land.chooseStamp(id);
    engine.setLandTool('stamp');
    haptic(6); uiSound('tick');
  };
  return (
    <>
      <div className="grid grid-cols-4 gap-1.5">
        {STAMPS.map((s) => (
          <button key={s.id} data-stamp={s.id} onClick={() => pick(s.id)} title={s.hint}
            className={clsx('relative flex flex-col items-center gap-0.5 rounded-xl px-1 pb-1.5 pt-1 text-[10.5px] font-bold leading-tight ring-1 transition', armed && st.id === s.id ? 'bg-amber-100 ring-amber-400' : 'bg-white ring-black/10 hover:bg-black/[0.03]', !stampUnlocked(s.id) && 'opacity-50 grayscale')}>
            <span className="text-[22px] leading-none">{s.emoji}</span>
            <span className="truncate">{s.name}</span>
            {!stampUnlocked(s.id) && <LockBadge className="absolute right-0.5 top-0.5" />}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-ink/60">{armed ? <><b>{d.emoji} {d.name}:</b> {d.hint}. Tap the land to place it, or press and drag to size it{d.aspect ? ' and point it' : ''}.</> : 'Pick a landform, then tap the land to stamp it. A see-through preview shows the new shape first.'}</p>
      {armed && (
        <>
          <Slider label="Size" value={st.radius} min={1} max={Math.max(12, Math.min(t.width, t.depth) * 0.55)} step={0.1} unit="m" onChange={(v) => { st.radius = v; engine.changed(false); }} />
          <Slider label={digs ? 'Depth' : 'Height'} value={st.height} min={0.2} max={d.maxHeight} step={0.1} unit="m" onChange={(v) => { st.height = v; engine.changed(false); }} />
          {d.aspect && <Slider label="Direction" value={Math.round(((st.angle * 180) / Math.PI + 360) % 360)} min={0} max={359} step={1} format={(v) => `${v}°`} onChange={(v) => { st.angle = (v * Math.PI) / 180; engine.changed(false); }} />}
          <Toggle label="Paint the ground to match" checked={st.paint} onChange={(v) => { st.paint = v; engine.changed(false); }} hint="Rocky cliffs, snowy peaks, sandy shores…" />
        </>
      )}
    </>
  );
}

/** how dragging on the land selects an area */
const SELECT_TOOLS: { value: AreaSelect; label: React.ReactNode; title: string }[] = [
  { value: 'box', label: '▭ Box', title: 'Drag a box across the land' },
  { value: 'oval', label: '⬭ Oval', title: 'Drag an oval across the land' },
  { value: 'lasso', label: '➰ Lasso', title: 'Draw a loop around the land you want' },
  { value: 'brush', label: '🖌 Brush', title: 'Paint over the land you want' },
];
const HOW_TO: Record<AreaSelect, string> = {
  box: 'Drag across the land to select a box',
  oval: 'Drag across the land to select an oval',
  lasso: 'Draw a loop around the land you want',
  brush: 'Paint over the land you want',
};

function AreaTools() {
  const engine = useEngine();
  useEngineVersion();
  const L = engine.land;
  const a = L.area;
  const size = L.areaSize;
  const t = engine.terrain!;
  const [busy, setBusy] = useState(false);
  const kind = AREA_KINDS.find((k) => k.id === a.kind)!;
  const set = (patch: Partial<typeof a>) => { Object.assign(a, patch); L.syncArea(); engine.changed(false); };
  const run = async (again: boolean) => {
    if (busy) return;
    setBusy(true);
    haptic(12);
    try { await L.generate(again); uiSound('place'); } finally { setBusy(false); }
  };
  const biomeStyle = styleForBiome(engine.doc.biome);
  const armed = engine.brush.tool === 'area';
  return (
    <>
      {!armed ? (
        <Btn variant="solid" className="w-full" onClick={() => { engine.setLandTool('area'); uiSound('tick'); }}>⬚ Select an area</Btn>
      ) : (
        <>
          <div>
            <div className="mb-1 text-[13px] font-semibold text-ink/80">Select with</div>
            <div data-select-tools><Segmented size="sm" value={a.select} onChange={(v) => { L.setSelectTool(v); uiSound('tick'); }} options={SELECT_TOOLS} /></div>
          </div>
          {a.select === 'brush' && (
            <div className="space-y-2 rounded-2xl bg-black/[0.03] p-2.5 ring-1 ring-black/5">
              <Segmented size="sm" value={a.erase ? 'erase' : 'add'} onChange={(v) => { set({ erase: v === 'erase' }); uiSound('tick'); }}
                options={[{ value: 'add', label: '✚ Add land', title: 'Paint to add land to the area' }, { value: 'erase', label: '⌫ Take away', title: 'Paint to take land out of the area (or hold Alt)' }]} />
              <Slider label="Brush size" value={a.brush} min={0.5} max={Math.max(6, Math.min(t.width, t.depth) / 4)} step={0.1} unit="m" onChange={(v) => set({ brush: v })} />
            </div>
          )}
          {!size ? (
            <div className="rounded-2xl bg-amber-50 p-3 text-[12.5px] text-ink/80 ring-1 ring-amber-200">
              <b>{HOW_TO[a.select]}</b>{engine.topView ? '' : ' — the Top view makes this easy'}. Then choose what grows there.
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-[12.5px] ring-1 ring-amber-200">
              <span className="flex-1"><b>Selected:</b> {size.free ? `${Math.max(1, Math.round(size.m2))} m²` : `${size.w.toFixed(1)} × ${size.d.toFixed(1)} m`}</span>
              <button className="rounded-lg px-2 py-1 font-semibold text-ink/60 hover:bg-black/5" onClick={() => { L.clearArea(); uiSound('tick'); }}><X size={14} className="inline" /> Clear</button>
            </div>
          )}
        </>
      )}
      <div className="grid grid-cols-4 gap-1.5">
        {AREA_KINDS.map((k) => (
          <button key={k.id} data-area={k.id} onClick={() => { if (!areaKindUnlocked(k.id)) { showLocked(k.id === 'volcanic' ? 'landforms-4' : ['dunes', 'canyons', 'mesas'].includes(k.id) ? 'landforms-3' : 'landforms-2'); return; } set({ kind: k.id }); uiSound('tick'); }} title={k.hint}
            className={clsx('relative flex flex-col items-center gap-0.5 rounded-xl px-1 pb-1.5 pt-1 text-[10.5px] font-bold leading-tight ring-1 transition', a.kind === k.id ? 'bg-amber-100 ring-amber-400' : 'bg-white ring-black/10 hover:bg-black/[0.03]', !areaKindUnlocked(k.id) && 'opacity-50 grayscale')}>
            <span className="text-[22px] leading-none">{k.emoji}</span><span className="truncate">{k.name}</span>
            {!areaKindUnlocked(k.id) && <LockBadge className="absolute right-0.5 top-0.5" />}
          </button>
        ))}
      </div>
      <p className="-mt-1 text-[11px] text-ink/55">{kind.emoji} {kind.hint}{kind.water ? ' (adds water)' : ''}.</p>
      <label className="block text-[13px]"><span className="font-semibold text-ink/80">Ground</span>
        <select className="dd-input mt-1" value={a.style} onChange={(e) => set({ style: e.target.value })}>
          <option value="auto">✨ Suits the landform</option>
          <option value="biome">{biomeStyle.emoji} This habitat ({biomeStyle.name})</option>
          {GROUND_STYLES.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
        </select>
      </label>
      <Slider label="Height" value={a.relief} min={0.25} max={2.5} step={0.05} format={(v) => (size ? `${L.areaRelief().toFixed(1)} m` : `×${v.toFixed(2)}`)} onChange={(v) => set({ relief: v })} />
      <Slider label="Rugged" value={a.rough} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ rough: v })} />
      <Slider label="Soft edge" value={a.feather} min={0.5} max={8} step={0.1} unit="m" onChange={(v) => set({ feather: v })} />
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-semibold text-ink/80">Plants</span>
        <div className="flex-1"><Segmented size="sm" value={a.plants} onChange={(v) => set({ plants: v })} options={[{ value: 'none', label: 'None' }, { value: 'some', label: 'Some' }, { value: 'lots', label: 'Lots' }]} /></div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Btn variant="solid" data-act="generate" disabled={!size || busy} onClick={() => void run(false)}><Wand2 size={15} /> {busy ? 'Growing…' : 'Generate'}</Btn>
        <Btn data-act="retry" disabled={!L.canRetry || busy} onClick={() => void run(true)} title="Replace the last result with a different one"><Dices size={15} /> Try another</Btn>
      </div>
      <Btn size="sm" className="w-full" disabled={!size} onClick={() => { L.repaintArea(); uiSound('tick'); }}><Paintbrush size={14} /> Repaint the ground only</Btn>
    </>
  );
}

function PaintTools() {
  const engine = useEngine();
  useEngineVersion();
  const brush = engine.brush;
  const t = engine.terrain!;
  const choose = (i: number) => { brush.ground = i; if (brush.tool !== 'paint') engine.setLandTool('paint'); engine.changed(false); uiSound('tick'); };
  const style = styleForBiome(engine.doc.biome);
  return (
    <>
      <div className="grid grid-cols-4 gap-1.5">
        <button onClick={() => choose(-1)} title={`Picks the ground from the shape of the land (${style.name} style): rock on cliffs, sand or mud by water…`}
          className={clsx('flex flex-col items-center gap-0.5 rounded-xl p-1.5 text-[10.5px] font-bold ring-1', brush.ground < 0 ? 'bg-amber-100 ring-amber-400' : 'bg-white ring-black/10')}>
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 via-amber-300 to-slate-400 text-[13px]">✨</span>
          <span className="truncate">Auto</span>
        </button>
        {GROUND_TYPES.map((g, i) => (
          <button key={g.id} onClick={() => choose(i)} title={g.name}
            className={clsx('flex flex-col items-center gap-0.5 rounded-xl p-1.5 text-[10.5px] font-bold ring-1', brush.ground === i ? 'bg-amber-100 ring-amber-400' : 'bg-white ring-black/10')}>
            <span className="h-6 w-6 rounded-lg" style={{ background: `linear-gradient(135deg, ${g.color}, ${g.color2})` }} />
            <span className="w-full truncate text-center">{g.name}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-ink/55">Drag on the land to paint. Different grounds blend into each other at their edges.</p>
      <Slider label="Brush size" value={brush.radius} min={0.5} max={Math.max(8, t.width / 5)} step={0.1} unit="m" onChange={(v) => { brush.radius = v; engine.changed(false); }} />
      <Btn size="sm" className="w-full" onClick={() => { if (confirm(`Repaint the whole diorama to match the shape of the land (${style.name} style)? You can undo this.`)) { engine.land.autoPaintAll('biome'); uiSound('place'); } }}>
        ✨ Auto-paint the whole diorama
      </Btn>
    </>
  );
}

const SIZES = DIORAMA_SIZES;

/** change the diorama's width and depth */
export function SizeSection() {
  const engine = useEngine();
  useEngineVersion();
  const profile = useProfile();
  const custom = isUnlocked('size-custom', profile);
  const t = engine.terrain!;
  const [w, setW] = useState(t.width), [d, setD] = useState(t.depth);
  useEffect(() => { setW(t.width); setD(t.depth); }, [t]);
  const changed = Math.abs(w - t.width) > 0.01 || Math.abs(d - t.depth) > 0.01;
  const apply = () => {
    const lost = engine.actorsOutside(w, d).length;
    if (lost && !confirm(`${lost} thing${lost === 1 ? ' is' : 's are'} outside the new size and will be removed. Continue? (You can undo.)`)) return;
    engine.resizeTerrain(w, d);
    uiSound('place');
    haptic(14);
  };
  const cell = Engine.cellFor(w, d);
  return (
    <Section title={<span className="flex items-center gap-1.5"><Ruler size={14} /> Diorama size</span>} defaultOpen={false}>
      <div className="text-[12.5px] text-ink/70">Now <b>{t.width} × {t.depth} m</b>. Growing adds land around the edges; shrinking trims them.</div>
      <div className="grid grid-cols-4 gap-1.5">
        {SIZES.map((s) => {
          const ok = sizeUnlocked(s.id, profile);
          return (
            <Btn key={s.id} size="sm" active={w === s.w && d === s.d} className={clsx('relative', !ok && 'opacity-55')} title={`${s.w} × ${s.d} m`}
              onClick={() => { if (!ok) { showLocked(s.id === 'huge' ? 'size-huge' : 'size-large'); return; } setW(s.w); setD(s.d); }}>
              {s.label}{!ok && <LockBadge className="absolute -right-1 -top-1" />}
            </Btn>
          );
        })}
      </div>
      {custom ? (
        <>
          <Slider label="Width" value={w} min={MIN_SIZE} max={MAX_WIDTH} step={2} unit="m" onChange={setW} />
          <Slider label="Depth" value={d} min={MIN_SIZE} max={MAX_DEPTH} step={2} unit="m" onChange={setD} />
        </>
      ) : <button type="button" onClick={() => showLocked('size-custom')} className="flex w-full items-center gap-2 rounded-xl bg-black/[0.04] px-3 py-2 text-left text-[12px] font-semibold text-ink/55"><LockBadge /> Any width and depth unlocks later on your ranger path</button>}
      {changed && <p className="text-[12px] text-ink/60">New land around the edges continues this habitat — its hills, ground and streams carry on.</p>}
      {changed && cell > 0.26 && <p className="text-[11px] text-ink/50">Big dioramas use a slightly coarser grid ({Math.round(cell * 100)} cm) to stay smooth.</p>}
      <Btn variant="solid" className="w-full" disabled={!changed} onClick={apply}><Ruler size={15} /> Make it {w} × {d} m</Btn>
    </Section>
  );
}
