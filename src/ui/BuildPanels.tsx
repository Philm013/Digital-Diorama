import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Search, Copy, Trash2, Crosshair, Blocks, Mountain, ArrowDown, Waves, Paintbrush, Eraser, Sparkles, Wand2, Sun, Moon, RotateCcw, RotateCw, PanelLeftClose, PanelRightClose } from 'lucide-react';
import { CATALOG, CATEGORY_META, getDef } from '../assets/catalog';
import type { AssetDef } from '../assets/types';
import { getSchema } from '../assets/builder';
import type { ParamSpec } from '../assets/modules';
import { roleOf, ROLE_META } from '../assets/foodweb';
import { BACKDROPS } from '../engine/backdropPainter';
import { GROUND_TYPES, type SculptTool } from '../engine/Terrain';
import type { FrameStyle, Season, Weather } from '../engine/types';
import { BIOME_BY_ID } from '../biomes/templates';
import { useEngine, useEngineVersion, useEngineEvent } from './store';
import { Btn, Chip, IconBtn, Section, Segmented, Slider, Toggle, statusColor } from './common';
import { AssetThumb } from './AssetThumb';
import { useProfile } from './game/useGame';
import { notePlaced } from '../game/progress';
import { confetti } from './game/Celebrate';
import { haptic, uiSound } from './feedback';

const CATS = ['animals', 'plants', 'fungi', 'land', 'water', 'sky', 'finds', 'human', 'habitats'] as const;

/* =============================== Library (inventory) =============================== */
const CAT_ICON: Record<string, string> = { animals: '🦊', plants: '🌿', fungi: '🍄', land: '🪨', water: '💧', sky: '🌦️', finds: '🐚', human: '🏠', habitats: '🗺️' };
export function LibraryPanel({ compact, onAdded, onCollapse }: { compact?: boolean; onAdded?: () => void; onCollapse?: () => void }) {
  const engine = useEngine();
  useEngineVersion();
  const profile = useProfile();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>(() => { try { return localStorage.getItem('dd-lib-cat') || 'animals'; } catch { return 'animals'; } });
  const [fits, setFits] = useState(true);
  useEffect(() => { try { localStorage.setItem('dd-lib-cat', cat); } catch { /* ignore */ } }, [cat]);
  const biome = engine.doc?.biome ?? 'blank';
  const inScene = useMemo(() => new Set(engine.actorList.map((a) => a.def.id)), [engine, engine.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    return CATALOG.filter((d) => {
      if (s) return (d.name + ' ' + (d.info.scientific ?? '') + ' ' + d.group + ' ' + (d.info.class ?? '') + ' ' + (d.info.phylum ?? '')).toLowerCase().includes(s);
      if (d.category !== cat) return false;
      if (fits && biome !== 'blank' && d.biomes.length && !d.biomes.includes(biome)) return false;
      return true;
    });
  }, [q, cat, fits, biome]);
  const groups = useMemo(() => {
    const m = new Map<string, AssetDef[]>();
    for (const d of items) { if (!m.has(d.group)) m.set(d.group, []); m.get(d.group)!.push(d); }
    return [...m.entries()];
  }, [items]);
  const counts = useMemo(() => Object.fromEntries(CATS.map((c) => [c, CATALOG.filter((d) => d.category === c && (!fits || biome === 'blank' || !d.biomes.length || d.biomes.includes(biome))).length])), [fits, biome]);

  const add = async (d: AssetDef, e?: React.MouseEvent) => {
    if (d.base) {
      if (!confirm(`Replace the whole base of this diorama with the “${d.name}” habitat tile? Your plants and animals stay.`)) return;
      engine.pushUndo();
      engine.doc.base = { kind: 'asset', asset: d.id, params: { ...d.params } };
      if (d.id.includes('reef') || d.id.includes('kelp')) { engine.doc.env.underwater = true; engine.doc.env.backdrop = d.id.includes('kelp') ? 'kelp' : 'underwater'; }
      await engine.load(engine.serialize());
      return;
    }
    uiSound('place');
    haptic(12);
    if (e) confetti(e.clientX, e.clientY, 18);
    const t = engine.controls.target;
    const spot = engine.findSpot(d, t.clone());
    const a = await engine.addActor(d.id, spot);
    if (a) {
      engine.select(a.id);
      engine.focusActor(a.id, 0.9);
      if (d.living !== false) notePlaced(d.id, d.name);
      onAdded?.();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-black/5 p-3 pb-2">
        {!compact && (
          <div className="flex items-center gap-2">
            <div className="font-display text-lg font-bold">Inventory</div>
            <span className="rounded-full bg-black/5 px-2 text-xs font-bold text-ink/55">{CATALOG.length}</span>
            <div className="flex-1" />
            {onCollapse && <IconBtn label="Hide inventory" onClick={onCollapse} className="h-9 w-9 text-ink/50"><PanelLeftClose size={18} /></IconBtn>}
          </div>
        )}
        <div className="flex gap-1.5">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search species & things…" className="dd-input h-11 pl-9 text-[15px]" />
          </div>
          {compact && !q && biome !== 'blank' && ['animals', 'plants', 'fungi'].includes(cat) && (
            <button onClick={() => setFits(!fits)} title={fits ? `Showing only species from the ${BIOME_BY_ID[biome]?.name ?? biome}` : 'Showing everything'} className={clsx('flex h-11 shrink-0 items-center gap-1 rounded-2xl px-3 font-display text-[13px] font-semibold transition', fits ? 'bg-emerald-600 text-white' : 'bg-black/[0.06] text-ink/60')}>
              {BIOME_BY_ID[biome]?.emoji ?? '📍'} {fits ? 'Here' : 'All'}
            </button>
          )}
        </div>
        {!q && (
          <div className="dd-scroll-x -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {CATS.map((c) => (
              <button key={c} onClick={() => { setCat(c); uiSound('tick'); }} className={clsx('flex h-10 shrink-0 items-center gap-1.5 rounded-2xl px-3 font-display text-[13.5px] font-semibold transition', cat === c ? 'dd-3d bg-ink text-white [--edge:#000]' : 'bg-white text-ink/75 ring-1 ring-black/10 hover:bg-black/5')}>
                <span className="text-base">{CAT_ICON[c]}</span>{CATEGORY_META[c].label}<span className={clsx('rounded-full px-1.5 text-[10.5px] tabular-nums', cat === c ? 'bg-white/20' : 'bg-black/5 text-ink/45')}>{counts[c]}</span>
              </button>
            ))}
          </div>
        )}
        {!compact && !q && biome !== 'blank' && ['animals', 'plants', 'fungi'].includes(cat) && (
          <button onClick={() => setFits(!fits)} className={clsx('flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-[13px] font-semibold transition', fits ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'bg-black/[0.04] text-ink/60')}>
            <span className={clsx('grid h-5 w-5 place-items-center rounded-md text-[11px] text-white', fits ? 'bg-emerald-600' : 'bg-black/20')}>{fits ? '✓' : ''}</span>
            Only species that live in the {BIOME_BY_ID[biome]?.name ?? biome}
          </button>
        )}
        {engine.doc?.base.kind === 'asset' && cat === 'habitats' && !q && (
          <Btn size="sm" className="w-full" onClick={async () => {
            if (!confirm('Switch back to sculptable land?')) return;
            const { generateTerrain } = await import('../engine/terrainGen');
            const t = generateTerrain({ seed: 2, relief: 0.4, paint: 'meadow' });
            engine.doc.base = { kind: 'terrain', terrain: t.toDoc() };
            t.dispose();
            engine.doc.env.underwater = false;
            await engine.load(engine.serialize());
          }}><Mountain size={14} /> Use sculptable land instead</Btn>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {groups.length === 0 && <div className="py-10 text-center text-sm text-ink/55">Nothing here — try turning off the habitat filter or searching.</div>}
        {groups.map(([g, list]) => (
          <div key={g} className="mb-4">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">{g} <span className="font-semibold text-ink/30">{list.length}</span></div>
            <div className={clsx('grid gap-2', compact ? 'grid-cols-3 min-[480px]:grid-cols-4' : 'grid-cols-3')}>
              {list.map((d) => {
                const role = d.living !== false ? ROLE_META[roleOf(d)] : null;
                const seen = profile.discovered.includes(d.id);
                return (
                  <button key={d.id} onClick={(e) => void add(d, e)} draggable
                    onDragStart={(e) => { e.dataTransfer.setData('text/x-dd-asset', d.id); e.dataTransfer.effectAllowed = 'copy'; }}
                    className="dd-tile dd-inv-card group relative flex flex-col items-center overflow-hidden rounded-2xl px-1 pb-2 pt-1 text-center"
                    style={{ ['--role' as string]: role?.color ?? '#9aa3ab', borderBottom: `4px solid ${role?.color ?? '#c9c2b4'}` }}
                    title={`${d.name}${d.info.scientific ? ` (${d.info.scientific})` : ''}${role ? ` — ${role.label}` : ''}`}>
                    <span className="dd-inv-glow pointer-events-none absolute inset-0" />
                    <AssetThumb id={d.id} emoji={d.emoji} size={compact ? 60 : 64} />
                    <span className="relative line-clamp-2 text-[11.5px] font-bold leading-tight text-ink/85">{d.name}</span>
                    {inScene.has(d.id) && <span className="absolute left-1 top-1 rounded-full bg-ink/75 px-1.5 text-[9.5px] font-bold text-white">IN</span>}
                    {d.living !== false && seen && <span className="absolute right-1 top-1 text-[11px]" title="In your field journal">📖</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <p className="pb-2 text-center text-[11px] text-ink/45">Tap to add near the middle of your view{compact ? '' : ' — or drag onto the diorama'}.</p>
      </div>
    </div>
  );
}

/* =============================== Inspector =============================== */
export function InspectorPanel({ onCollapse }: { onCollapse?: () => void } = {}) {
  const engine = useEngine();
  useEngineVersion();
  const a = engine.getActor(engine.selectedId);
  if (!a) return <DioramaPanel onCollapse={onCollapse} />;
  return <ActorInspector key={a.id} id={a.id} onCollapse={onCollapse} />;
}

function ActorInspector({ id, onCollapse }: { id: string; onCollapse?: () => void }) {
  const engine = useEngine();
  useEngineVersion();
  const a = engine.getActor(id)!;
  const def = a.def;
  const [schema, setSchema] = useState<Record<string, ParamSpec> | null>(null);
  const [tab, setTab] = useState<'place' | 'label' | 'look' | 'about'>('place');
  const [, bump] = useState(0);
  useEffect(() => { let live = true; void getSchema(def).then((s) => { if (live) setSchema(s); }); return () => { live = false; }; }, [def]);
  useEngineEvent((e) => { if (e.type === 'actors') bump((x) => x + 1); });
  const role = roleOf(def);
  const rm = ROLE_META[role];
  const canFly = def.loco === 'fly' || def.loco === 'swim' || def.water === 'column';
  const setTransform = (fn: () => void) => { fn(); engine.commitTransform(a); engine.changed(); bump((x) => x + 1); };
  const deg = Math.round(((180 - (a.root.rotation.y * 180) / Math.PI) % 360 + 360) % 360);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-black/5 p-3" style={{ background: `linear-gradient(135deg, ${rm.color}1f, transparent 70%)` }}>
        <div className="flex items-start gap-3">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5"><AssetThumb id={def.id} emoji={def.emoji} size={58} /></div>
          <div className="min-w-0 flex-1">
            <input className="w-full rounded-lg bg-transparent px-1 font-display text-lg font-bold outline-none hover:bg-black/5 focus:bg-white" value={a.doc.name}
              onChange={(e) => { a.doc.name = e.target.value; engine.syncActorLabel(a); engine.changed(); bump((x) => x + 1); }} />
            <div className="truncate px-1 text-xs italic text-ink/60">{def.info.scientific ?? def.name}</div>
            <div className="mt-1 flex flex-wrap gap-1 px-1">
              <Chip color={rm.color}>{rm.emoji} {rm.label}</Chip>
              {def.info.status && <Chip color={statusColor(def.info.status)}>{def.info.status}</Chip>}
            </div>
          </div>
          {onCollapse && <IconBtn label="Hide panel" onClick={onCollapse} className="h-9 w-9 text-ink/50"><PanelRightClose size={18} /></IconBtn>}
        </div>
        <div className="mt-3 flex gap-1 rounded-2xl bg-black/[0.05] p-1">
          {([['place', '📍 Place'], ['label', '🏷️ Label'], ['look', '🎨 Look'], ['about', 'ℹ️ Info']] as const).map(([t, l]) => (
            <button key={t} onClick={() => { setTab(t); uiSound('tick'); }} className={clsx('h-9 flex-1 rounded-xl font-display text-[12.5px] font-semibold transition', tab === t ? 'bg-white text-ink shadow-sm' : 'text-ink/55 hover:text-ink')}>{l}</button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {tab === 'place' && (
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-[13px]"><span className="font-semibold text-ink/80">Turn</span><span className="tabular-nums text-ink/60">{deg}°</span></div>
              <div className="flex items-center gap-1.5">
                <Btn size="md" className="w-12" onClick={() => setTransform(() => { a.root.rotation.y += Math.PI / 4; })} title="Turn left 45°"><RotateCcw size={16} /></Btn>
                <input type="range" min={0} max={359} step={1} value={deg} onChange={(e) => setTransform(() => { a.root.rotation.y = Math.PI - (Number(e.target.value) * Math.PI) / 180; })} className="dd-range min-w-0 flex-1" />
                <Btn size="md" className="w-12" onClick={() => setTransform(() => { a.root.rotation.y -= Math.PI / 4; })} title="Turn right 45°"><RotateCw size={16} /></Btn>
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-[13px]"><span className="font-semibold text-ink/80">Size</span><span className="tabular-nums text-ink/60">{Math.round(a.root.scale.x * 100)}%</span></div>
              <div className="grid grid-cols-5 gap-1.5">
                {[0.5, 0.75, 1, 1.5, 2].map((v) => <Btn key={v} size="sm" active={Math.abs(a.root.scale.x - v) < 0.01} onClick={() => setTransform(() => { a.root.scale.setScalar(v); a.syncLabel(); a.updateRing(); })}>{v * 100}%</Btn>)}
              </div>
              <input type="range" min={0.25} max={4} step={0.05} value={a.root.scale.x} onChange={(e) => setTransform(() => { a.root.scale.setScalar(Number(e.target.value)); a.syncLabel(); a.updateRing(); })} className="dd-range mt-1 w-full" />
            </div>
            {(canFly || a.doc.grounded === false) && (
              <Slider label={def.loco === 'fly' ? 'Flying height' : a.doc.grounded === false ? 'Perch height' : 'Swimming height'} value={a.doc.grounded === false ? a.root.position.y : a.lift} min={0} max={a.doc.grounded === false ? 15 : 12} step={0.05} unit="m"
                onChange={(v) => setTransform(() => { if (a.doc.grounded === false) a.root.position.y = v; else { a.lift = v; a.doc.lift = v; a.followGround(engine.worldQuery); } a.syncLabel(); })} />
            )}
            {a.doc.grounded === false && <Btn size="sm" onClick={() => setTransform(() => { a.doc.grounded = true; a.followGround(engine.worldQuery); })}><ArrowDown size={14} /> Put back on the ground</Btn>}
            {a.moves && <Toggle label="Moves around on its own" checked={a.doc.ambient !== false} onChange={(v) => { a.doc.ambient = v; engine.changed(); bump((x) => x + 1); }} hint="Ambient life in Explore mode" />}
            {a.clipNames.length > 0 && (
              <div>
                <div className="mb-1.5 text-[13px] font-semibold text-ink/80">Animation</div>
                <div className="flex flex-wrap gap-1.5">
                  <Btn size="sm" active={!a.forcedClip} onClick={() => { a.forcedClip = null; bump((x) => x + 1); }}><Wand2 size={13} /> Auto</Btn>
                  {a.clipNames.map((c) => <Btn key={c} size="sm" active={a.forcedClip === c} onClick={() => { a.forcedClip = c; a.play(c, 0.2); bump((x) => x + 1); }}>{c}</Btn>)}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <Btn onClick={() => engine.focusActor(id)} title="Zoom the camera to it (F)"><Crosshair size={15} /> Focus</Btn>
              <Btn onClick={() => { void engine.duplicateActor(id); uiSound('pop'); }} title="Duplicate (D)"><Copy size={15} /> Copy</Btn>
              <Btn variant="danger" onClick={() => { engine.removeActor(id); uiSound('trash'); }} title="Delete"><Trash2 size={15} /> Delete</Btn>
              <Btn variant="solid" className="bg-[#7c5cff]" onClick={() => { engine.select(id); document.dispatchEvent(new CustomEvent('dd-mode', { detail: 'code' })); }}><Blocks size={15} /> Code it</Btn>
            </div>
          </div>
        )}
        {tab === 'label' && (
          <div className="space-y-3">
            <Toggle label="Show toothpick label" checked={a.doc.label?.show !== false} onChange={(v) => { a.doc.label = { ...(a.doc.label ?? {}), show: v }; engine.syncActorLabel(a); engine.changed(); bump((x) => x + 1); }} />
            {!engine.env.labels && <p className="-mt-1 text-[11px] text-ink/50">Labels are hidden — turn on “Labels” in Explore or press L.</p>}
            <label className="block text-[13px]"><span className="font-semibold text-ink/80">Label text</span>
              <input className="dd-input mt-1" placeholder={`e.g. “Producer: makes food from sunlight” (default: ${a.doc.name})`} value={a.doc.label?.text ?? ''}
                onChange={(e) => { a.doc.label = { show: a.doc.label?.show !== false, text: e.target.value }; engine.syncActorLabel(a); engine.changed(); bump((x) => x + 1); }} />
            </label>
            <label className="block text-[13px]"><span className="font-semibold text-ink/80">My research notes</span>
              <textarea className="dd-input mt-1 h-32" placeholder="What did you learn about it? Shown in the field card and read aloud on the tour." value={a.doc.note ?? ''}
                onChange={(e) => { a.doc.note = e.target.value; engine.changed(false); bump((x) => x + 1); }} onBlur={() => engine.changed()} />
            </label>
          </div>
        )}
        {tab === 'look' && (!schema ? <div className="text-sm text-ink/50">Loading settings…</div> : <ParamControls def={def} schema={schema} values={a.doc.params} onCommit={(patch) => void engine.updateParams(id, patch)} />)}
        {tab === 'about' && (
          <div className="space-y-2 text-sm">
            {(def.info.fact || def.info.blurb) && <p className="leading-relaxed text-ink/85">💡 {def.info.fact ?? def.info.blurb}</p>}
            <div className="text-xs text-ink/55">{[def.info.kingdom, def.info.phylum, def.info.class, def.info.order, def.info.family].filter(Boolean).join(' › ')}</div>
            <div className="space-y-1 rounded-2xl bg-black/[0.03] p-3 text-xs text-ink/65">
              {a.model && <div>Displayed at <b>×{a.model.exhibitScale >= 1.05 ? a.model.exhibitScale.toFixed(a.model.exhibitScale < 10 ? 1 : 0) : '1'}</b> life size{a.model.exhibitScale >= 1.05 ? ' so you can see it' : ''}.</div>}
              {a.model && <div>{a.model.triangles.toLocaleString()} triangles · {a.model.skinned ? 'skinned rig with clips' : a.model.rig.length ? `${a.model.rig.length} animated joints` : 'static'}</div>}
              <div className="truncate">Source: <code className="text-[10px]">{def.path.replace('/References/', '').replace('/src/assets/', 'app: ')}</code></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const ALWAYS_HIDE = new Set(['mergeForProduction', 'diorama', 'waterPatch', 'seaWater', 'chainEnds', 'flowOffset', 'detail', 'detailLevel', 'rigMode', 'pose', 'posePhase', 'hide', 'advancedColorOverrides', 'leafDetailLevel', 'needleDetailLevel', 'showGround', 'base', 'tank', '__animal']);

export function ParamControls({ def, schema, values, onCommit }: { def: AssetDef; schema: Record<string, ParamSpec>; values: Record<string, unknown>; onCommit: (patch: Record<string, unknown>) => void }) {
  const [local, setLocal] = useState<Record<string, unknown>>({});
  const hidden = new Set([...(def.hidden ?? []), ...ALWAYS_HIDE]);
  const entries = Object.entries(schema).filter(([k, s]) => !hidden.has(k) && s && s.type);
  const main = entries.filter(([, s]) => s.type !== 'color');
  const colors = entries.filter(([, s]) => s.type === 'color');
  const val = (k: string, s: ParamSpec) => (k in local ? local[k] : k in values ? values[k] : k in def.params ? def.params[k] : s.default);
  const set = (k: string, v: unknown, commit = true) => { setLocal((l) => ({ ...l, [k]: v })); if (commit) onCommit({ [k]: v }); };
  const label = (k: string, s: ParamSpec) => s.label ?? k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  return (
    <div className="space-y-3">
      {main.map(([k, s]) => {
        const v = val(k, s);
        if (s.type === 'range') return <Slider key={k} label={label(k, s)} value={Number(v)} min={s.min ?? 0} max={s.max ?? 1} step={s.step ?? 0.01} unit={s.unit} onChange={(x) => set(k, x, false)} onCommit={(x) => set(k, x)} />;
        if (s.type === 'choice') return (
          <label key={k} className="block text-[13px]"><span className="font-semibold text-ink/80">{label(k, s)}</span>
            <select className="dd-input mt-1" value={String(v)} onChange={(e) => { const opt = s.options?.find((o) => String(o) === e.target.value); set(k, opt ?? e.target.value); }}>
              {(s.options ?? []).map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
            </select>
          </label>
        );
        if (s.type === 'toggle') return <Toggle key={k} label={label(k, s)} checked={!!v} onChange={(x) => set(k, x)} hint={s.describe} />;
        if (s.type === 'text') return <label key={k} className="block text-[13px]"><span className="font-semibold text-ink/80">{label(k, s)}</span><input className="dd-input mt-1" defaultValue={String(v ?? '')} onBlur={(e) => set(k, e.target.value)} /></label>;
        return null;
      })}
      {colors.length > 0 && (
        <details className="rounded-xl bg-black/[0.03] p-2">
          <summary className="cursor-pointer text-[13px] font-semibold text-ink/70">🎨 Colour zones ({colors.length})</summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {colors.map(([k, s]) => (
              <label key={k} className="flex items-center gap-2 text-[12px]">
                <input type="color" value={String(val(k, s) ?? '#888888').slice(0, 7)} onChange={(e) => set(k, e.target.value, false)} onBlur={(e) => set(k, e.target.value)} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0" />
                <span className="truncate text-ink/75">{label(k, s)}</span>
              </label>
            ))}
          </div>
          <Btn size="sm" className="mt-2" onClick={() => { const patch: Record<string, unknown> = {}; for (const [k] of colors) patch[k] = undefined; setLocal({}); onCommit(patch); }}>Reset colours</Btn>
        </details>
      )}
      {main.length === 0 && colors.length === 0 && <div className="text-sm text-ink/50">This model has no adjustable settings.</div>}
    </div>
  );
}

/* =============================== Diorama settings =============================== */
const WEATHERS: { value: Weather; label: string }[] = [{ value: 'clear', label: '☀️' }, { value: 'cloudy', label: '⛅' }, { value: 'rain', label: '🌧️' }, { value: 'storm', label: '⛈️' }, { value: 'snow', label: '❄️' }, { value: 'fog', label: '🌫️' }];
const SEASONS: { value: Season; label: string }[] = [{ value: 'spring', label: '🌱 Spring' }, { value: 'summer', label: '☀️ Summer' }, { value: 'autumn', label: '🍂 Autumn' }, { value: 'winter', label: '❄️ Winter' }];
const FRAMES: { value: FrameStyle; label: string }[] = [{ value: 'shoebox', label: '📦 Shoebox' }, { value: 'museum', label: '🏛️ Museum' }, { value: 'island', label: '🏝️ Floating' }];
const TOOLS: { tool: SculptTool | 'paint'; label: string; icon: React.ReactNode }[] = [
  { tool: 'raise', label: 'Raise', icon: <Mountain size={15} /> }, { tool: 'lower', label: 'Dig', icon: <ArrowDown size={15} /> },
  { tool: 'smooth', label: 'Smooth', icon: <Waves size={15} /> }, { tool: 'flatten', label: 'Flatten', icon: <Eraser size={15} /> },
  { tool: 'roughen', label: 'Rocky', icon: <Sparkles size={15} /> }, { tool: 'paint', label: 'Paint', icon: <Paintbrush size={15} /> },
];

export function timeLabel(h: number) {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60) % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function EnvironmentControls() {
  const engine = useEngine();
  useEngineVersion();
  const env = engine.env;
  return (
    <>
      <Slider label={<span className="flex items-center gap-1">{env.time > 6 && env.time < 19 ? <Sun size={14} /> : <Moon size={14} />} Time of day</span>} value={env.time} min={0} max={23.99} step={0.05} format={timeLabel} onChange={(v) => engine.setEnv({ time: v }, false)} onCommit={() => engine.changed()} />
      <Slider label="Day–night cycle speed" value={env.daySpeed} min={0} max={12} step={0.5} format={(v) => (v === 0 ? 'paused' : `${v} h / min`)} onChange={(v) => engine.setEnv({ daySpeed: v }, false)} />
      <div><div className="mb-1 text-[13px] font-semibold text-ink/80">Weather</div><Segmented value={env.weather} onChange={(w) => engine.setEnv({ weather: w })} options={WEATHERS} /></div>
      <div><div className="mb-1 text-[13px] font-semibold text-ink/80">Season</div><Segmented size="sm" value={env.season} onChange={(s) => engine.setEnv({ season: s })} options={SEASONS} /></div>
      <Slider label="Wind" value={env.wind} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => engine.setEnv({ wind: v }, false)} onCommit={() => engine.changed()} />
      <Slider label="Mist" value={env.fog} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => engine.setEnv({ fog: v }, false)} onCommit={() => engine.changed()} />
    </>
  );
}

function DioramaPanel({ onCollapse }: { onCollapse?: () => void }) {
  const engine = useEngine();
  useEngineVersion();
  const env = engine.env;
  const t = engine.terrain;
  const [ground, setGround] = useState(engine.brush.ground);
  const brush = engine.brush;
  const setTool = (tool: SculptTool | 'paint' | null) => { brush.tool = brush.tool === tool ? null : tool; engine.changed(false); };
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-2 border-b border-black/5 p-3">
        <div className="flex-1">
          <div className="font-display text-lg font-bold">World & land</div>
          <div className="text-xs text-ink/55">Tap something in the scene to edit it.</div>
        </div>
        {onCollapse && <IconBtn label="Hide panel" onClick={onCollapse} className="h-9 w-9 text-ink/50"><PanelRightClose size={18} /></IconBtn>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        {t && (
          <Section title="Land tools">
            <div className="grid grid-cols-3 gap-1.5">
              {TOOLS.map((x) => (
                <Btn key={x.tool} size="sm" active={brush.tool === x.tool} onClick={() => setTool(x.tool)}>{x.icon}{x.label}</Btn>
              ))}
            </div>
            {brush.tool && <p className="text-[11px] text-ink/55">Drag on the land to {brush.tool === 'paint' ? 'paint' : 'sculpt'}. Two fingers or right-drag still move the camera. Tap the tool again to stop.</p>}
            {brush.tool === 'paint' && (
              <div className="grid grid-cols-4 gap-1.5">
                {GROUND_TYPES.map((g, i) => (
                  <button key={g.id} onClick={() => { brush.ground = i; setGround(i); }} title={g.name}
                    className={clsx('flex flex-col items-center gap-0.5 rounded-xl p-1.5 text-[10.5px] font-bold ring-1', ground === i ? 'bg-amber-100 ring-amber-400' : 'bg-white ring-black/10')}>
                    <span className="h-6 w-6 rounded-lg" style={{ background: `linear-gradient(135deg, ${g.color}, ${g.color2})` }} />
                    <span className="truncate">{g.name}</span>
                  </button>
                ))}
              </div>
            )}
            {brush.tool && <Slider label="Brush size" value={brush.radius} min={0.5} max={8} step={0.1} unit="m" onChange={(v) => { brush.radius = v; engine.changed(false); }} />}
            {brush.tool && brush.tool !== 'paint' && <Slider label="Strength" value={brush.strength} min={0.01} max={0.2} step={0.005} format={(v) => `${Math.round(v * 500)}%`} onChange={(v) => { brush.strength = v; engine.changed(false); }} />}
            <Toggle label="Water" checked={t.waterLevel !== null} onChange={(v) => engine.setWaterLevel(v ? -0.2 : null)} />
            {t.waterLevel !== null && <Slider label="Water level" value={t.waterLevel} min={-3} max={3} step={0.05} unit="m" onChange={(v) => { t.setWaterLevel(v); engine.water?.sync(); engine.changed(false); }} onCommit={(v) => engine.setWaterLevel(v)} />}
            <Slider label="Grass" value={env.grass} min={0} max={1.5} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => engine.setEnv({ grass: v }, false)} onCommit={(v) => engine.setEnv({ grass: v })} />
          </Section>
        )}
        {engine.base && <BaseTileSection />}
        <Section title="Sky & weather"><EnvironmentControls /></Section>
        <Section title="Display">
          <div><div className="mb-1 text-[13px] font-semibold text-ink/80">Frame</div><Segmented size="sm" value={env.frame === 'open' ? 'island' : env.frame} onChange={(f) => engine.setEnv({ frame: f })} options={FRAMES} /></div>
          <label className="block text-[13px]"><span className="font-semibold text-ink/80">Painted backdrop</span>
            <select className="dd-input mt-1" value={env.backdrop} onChange={(e) => engine.setEnv({ backdrop: e.target.value })}>
              {Object.values(BACKDROPS).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <Toggle label="Labels on toothpicks" checked={env.labels} onChange={(v) => engine.setEnv({ labels: v })} />
          <Toggle label="True sizes (no magnifying)" checked={env.trueScale} onChange={(v) => engine.setEnv({ trueScale: v })} />
        </Section>
        <Section title={`In this diorama (${engine.actorList.filter((x) => !x.isClone).length})`} defaultOpen={false}>
          <div className="space-y-1">
            {engine.actorList.filter((x) => !x.isClone).map((x) => (
              <button key={x.id} onClick={() => { engine.select(x.id); engine.focusActor(x.id); }} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-black/5">
                <span className="text-lg">{x.def.emoji}</span><span className="flex-1 truncate font-semibold">{x.name}</span>
                {x.doc.scripts ? <Blocks size={13} className="text-ink/40" /> : null}
              </button>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function BaseTileSection() {
  const engine = useEngine();
  const base = engine.base!;
  const [schema, setSchema] = useState<Record<string, ParamSpec> | null>(null);
  useEffect(() => { let live = true; void getSchema(base.def).then((x) => { if (live) setSchema(x); }); return () => { live = false; }; }, [base.def]);
  const params = engine.doc.base.kind === 'asset' ? engine.doc.base.params : {};
  return (
    <Section title={<span>{base.def.emoji} Habitat tile</span>}>
      <p className="text-[12px] text-ink/60">{base.def.info.blurb}</p>
      {!schema ? <div className="text-sm text-ink/50">Loading…</div> : <ParamControls def={base.def} schema={schema} values={params} onCommit={(patch) => void engine.rebuildBase(patch)} />}
    </Section>
  );
}

export { getDef };
export function IconSpacer() { return <IconBtn label="" className="invisible" />; }
