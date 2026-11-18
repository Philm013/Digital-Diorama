import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { X, Crosshair, Volume2, Footprints, Tag, Network, BookOpen, Presentation, Clock, CloudSun, ChevronLeft, ChevronRight, Pause, Play, Video, Maximize2, CheckCircle2, Circle } from 'lucide-react';
import { useEngine, useEngineEvent, useEngineVersion } from './store';
import { Btn, Chip, IconBtn, Modal, Segmented, Slider, statusColor } from './common';
import { buildFoodWeb, roleOf, ROLE_META, type Role } from '../assets/foodweb';
import { BIOME_BY_ID } from '../biomes/templates';
import { speak, stopSpeech, audio } from '../code/sound';
import { timeLabel } from './BuildPanels';
import type { Actor } from '../engine/Actor';
import type { Engine } from '../engine/Engine';
import type { Weather } from '../engine/types';

export function ExploreLayer({ wide, playing }: { wide: boolean; playing: boolean }) {
  const engine = useEngine();
  useEngineVersion();
  const [card, setCard] = useState<string | null>(null);
  const [web, setWeb] = useState(false);
  const [guide, setGuide] = useState(false);
  const [tour, setTour] = useState(false);
  const [pop, setPop] = useState<'time' | 'weather' | null>(null);
  useEngineEvent((e) => {
    if (e.type === 'tap') setCard(e.id);
    if (e.type === 'select' && e.id === null) setCard(null);
  });
  const walking = !!engine.walk?.active;
  if (tour) return <Tour onExit={() => setTour(false)} />;
  const actor = engine.getActor(card);
  return (
    <>
      {actor && !walking && <InfoCard actor={actor} wide={wide} onClose={() => { setCard(null); engine.select(null); }} />}
      {!walking && (
        <div className={clsx('absolute inset-x-0 z-20 flex justify-center px-2', wide ? 'bottom-4' : 'bottom-2')}>
          <div className="dd-dock relative flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl p-1.5 shadow-xl">
            <DockBtn icon={<Tag size={18} />} label="Labels" active={engine.env.labels} onClick={() => engine.setEnv({ labels: !engine.env.labels }, false)} />
            <DockBtn icon={<Clock size={18} />} label={timeLabel(engine.env.time)} active={pop === 'time'} onClick={() => setPop(pop === 'time' ? null : 'time')} />
            <DockBtn icon={<CloudSun size={18} />} label="Weather" active={pop === 'weather'} onClick={() => setPop(pop === 'weather' ? null : 'weather')} />
            <span className="mx-1 h-7 w-px bg-black/10" />
            <DockBtn icon={<Network size={18} />} label="Food web" onClick={() => setWeb(true)} />
            <DockBtn icon={<BookOpen size={18} />} label="Guide" onClick={() => setGuide(true)} />
            <DockBtn icon={<Presentation size={18} />} label="Tour" onClick={() => { audio(); engine.select(null); setTour(true); }} />
            <DockBtn icon={<Footprints size={18} />} label="Walk in" onClick={() => { engine.walk?.enter(1.6); }} />
            <DockBtn icon={<Maximize2 size={18} />} label="Overview" onClick={() => { engine.follow(null); engine.frameCamera(); }} />
          </div>
          {pop && (
            <div className="dd-panel absolute bottom-[calc(100%+8px)] w-[min(92vw,360px)] rounded-2xl p-3" onMouseLeave={() => setPop(null)}>
              {pop === 'time' && <TimePop />}
              {pop === 'weather' && <WeatherPop />}
            </div>
          )}
        </div>
      )}
      {playing ? null : null}
      <Modal open={web} onClose={() => setWeb(false)} title="🕸️ Food web" wide><FoodWeb onPick={(id) => { setWeb(false); engine.select(id); engine.focusActor(id); setCard(id); }} /></Modal>
      <Modal open={guide} onClose={() => setGuide(false)} title={`${BIOME_BY_ID[engine.doc.biome]?.emoji ?? '📦'} Habitat guide`} wide><Guide /></Modal>
    </>
  );
}

function DockBtn({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className={clsx('flex min-w-[56px] shrink-0 flex-col items-center gap-0.5 rounded-xl px-2 py-1 font-display text-[11px] font-semibold transition-all', active ? 'bg-amber-200 text-ink' : 'text-ink/75 hover:bg-black/5')}>
      {icon}<span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

function TimePop() {
  const engine = useEngine();
  useEngineVersion();
  const env = engine.env;
  return (
    <div className="space-y-3">
      <Slider label="Time of day" value={env.time} min={0} max={23.99} step={0.05} format={timeLabel} onChange={(v) => engine.setEnv({ time: v }, false)} />
      <div className="grid grid-cols-4 gap-1.5">
        {[['🌅', 6.3], ['☀️', 12], ['🌇', 18.7], ['🌙', 22.5]].map(([e, h]) => <Btn key={String(e)} size="sm" onClick={() => engine.setEnv({ time: Number(h) }, false)}>{e}</Btn>)}
      </div>
      <Slider label="Day–night cycle" value={env.daySpeed} min={0} max={12} step={0.5} format={(v) => (v === 0 ? 'paused' : `${v} h/min`)} onChange={(v) => engine.setEnv({ daySpeed: v }, false)} />
    </div>
  );
}
function WeatherPop() {
  const engine = useEngine();
  useEngineVersion();
  const W: { value: Weather; label: string }[] = [{ value: 'clear', label: '☀️' }, { value: 'cloudy', label: '⛅' }, { value: 'rain', label: '🌧️' }, { value: 'storm', label: '⛈️' }, { value: 'snow', label: '❄️' }, { value: 'fog', label: '🌫️' }];
  return (
    <div className="space-y-3">
      <Segmented value={engine.env.weather} onChange={(w) => engine.setEnv({ weather: w }, false)} options={W} />
      <Segmented size="sm" value={engine.env.season} onChange={(s) => engine.setEnv({ season: s }, false)} options={[{ value: 'spring', label: '🌱' }, { value: 'summer', label: '☀️' }, { value: 'autumn', label: '🍂' }, { value: 'winter', label: '❄️' }]} />
      <Slider label="Wind" value={engine.env.wind} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => engine.setEnv({ wind: v }, false)} />
    </div>
  );
}

/* ---------------- info card ---------------- */
function factText(a: Actor) {
  const d = a.def;
  return [a.doc.note, d.info.fact ?? d.info.blurb].filter(Boolean).join(' ');
}
function InfoCard({ actor, wide, onClose }: { actor: Actor; wide: boolean; onClose: () => void }) {
  const engine = useEngine();
  const d = actor.def;
  const role = roleOf(d);
  const rm = ROLE_META[role];
  const info = d.info;
  const chain = [info.kingdom, info.phylum, info.class, info.order, info.family].filter(Boolean) as string[];
  const ex = actor.model?.exhibitScale ?? 1;
  const [following, setFollowing] = useState(false);
  useEffect(() => () => { engine.follow(null); stopSpeech(); }, [engine, actor.id]);
  const eatsList = useMemo(() => speciesList(engine.actorList.filter((o) => o !== actor && !o.isClone && o.def.living !== false && webEats(engine, actor, o))), [engine, actor]);
  const eatenBy = useMemo(() => speciesList(engine.actorList.filter((o) => o !== actor && !o.isClone && webEats(engine, o, actor))), [engine, actor]);
  return (
    <div className={clsx('dd-panel absolute z-30 flex flex-col overflow-hidden rounded-3xl', wide ? 'right-4 top-4 max-h-[calc(100%-110px)] w-[360px]' : 'inset-x-2 bottom-[86px] max-h-[52%]')}>
      <div className="flex items-start gap-3 p-4 pb-2" style={{ background: `linear-gradient(135deg, ${rm.color}22, transparent)` }}>
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-4xl shadow-sm">{d.emoji}</div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-xl font-semibold leading-tight">{actor.name}</div>
          {info.scientific && <div className="text-sm italic text-ink/60">{info.scientific}</div>}
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Chip color={rm.color}>{rm.emoji} {rm.label}</Chip>
            {info.diet && info.diet !== 'none' && info.diet !== 'producer' && <Chip color="#5a6b7d">diet: {info.diet}</Chip>}
            {info.status && <Chip color={statusColor(info.status)}>{info.status}</Chip>}
          </div>
        </div>
        <IconBtn label="Close" onClick={onClose}><X size={18} /></IconBtn>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3 text-sm">
        {chain.length > 1 && (
          <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold text-ink/55">
            {chain.map((c, i) => <span key={c + i} className="flex items-center gap-1">{i > 0 && <span className="text-ink/30">›</span>}<span className="rounded-md bg-black/5 px-1.5 py-0.5">{c}</span></span>)}
          </div>
        )}
        {(info.fact || info.blurb) && <p className="leading-relaxed text-ink/85">💡 {info.fact ?? info.blurb}</p>}
        {actor.doc.note && <div className="rounded-2xl bg-amber-50 p-3 text-ink/85 ring-1 ring-amber-200"><div className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">My notes</div>{actor.doc.note}</div>}
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          {info.habitat && <Fact k="Lives in" v={info.habitat} />}
          {info.size && <Fact k="Real size" v={info.size} />}
          {ex >= 1.05 && <Fact k="Shown at" v={`×${ex < 10 ? ex.toFixed(1) : Math.round(ex)} life size`} />}
          {d.loco !== 'sessile' && d.loco !== 'scenery' && <Fact k="Moves by" v={{ walk: 'walking', fly: 'flying', swim: 'swimming', slither: 'slithering', hop: 'hopping', crawl: 'crawling' }[d.loco] ?? d.loco} />}
        </div>
        {(eatsList.length > 0 || eatenBy.length > 0) && (
          <div className="rounded-2xl bg-black/[0.03] p-3 text-[12.5px]">
            {eatsList.length > 0 && <div><b>Eats here:</b> {eatsList.slice(0, 8).join(', ')}</div>}
            {eatenBy.length > 0 && <div className="mt-1"><b>Eaten by:</b> {eatenBy.slice(0, 8).join(', ')}</div>}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-black/5 p-3">
        <Btn size="sm" onClick={() => engine.focusActor(actor.id)}><Crosshair size={14} /> Focus</Btn>
        <Btn size="sm" onClick={() => { audio(); void speak(`${actor.name}. ${info.scientific ? 'Scientific name: ' + info.scientific + '.' : ''} ${factText(actor)}`); }}><Volume2 size={14} /> Read</Btn>
        <Btn size="sm" active={following} onClick={() => { if (following) { engine.follow(null); setFollowing(false); } else { engine.focusActor(actor.id, 0.8, () => engine.follow(actor.id)); setFollowing(true); } }}><Video size={14} /> {following ? 'Stop' : 'Follow'}</Btn>
        <Btn size="sm" onClick={() => engine.walk?.enter(Math.max(0.03, Math.min(1.6, actor.height * 0.9)))}><Footprints size={14} /> Eye level</Btn>
      </div>
    </div>
  );
}
function Fact({ k, v }: { k: string; v: string }) {
  return <div className="rounded-xl bg-black/[0.03] px-2.5 py-1.5"><div className="text-[10px] font-bold uppercase tracking-wide text-ink/45">{k}</div><div className="font-semibold text-ink/85">{v}</div></div>;
}
function speciesList(list: Actor[]) {
  const m = new Map<string, number>();
  for (const a of list) m.set(a.def.name, (m.get(a.def.name) ?? 0) + 1);
  return [...m.entries()].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n));
}
function webEats(_e: Engine, a: Actor, b: Actor) {
  const want = a.def.info.eats ?? [];
  const tags = b.def.info.tags ?? [];
  return want.includes(b.def.id) || want.some((t) => tags.includes(t));
}

/* ---------------- food web ---------------- */
function FoodWeb({ onPick }: { onPick: (id: string) => void }) {
  const engine = useEngine();
  const web = useMemo(() => buildFoodWeb(engine.actorList.filter((a) => !a.isClone).map((a) => ({ id: a.id, def: a.def, name: a.name }))), [engine]);
  const [hover, setHover] = useState<string | null>(null);
  const levels = new Map<number, typeof web.nodes>();
  for (const n of web.nodes) {
    const L = n.role === 'decomposer' ? 0 : Math.max(1, n.level);
    if (!levels.has(L)) levels.set(L, []);
    levels.get(L)!.push(n);
  }
  const rows = [...levels.keys()].filter((l) => l >= 1).sort((a, b) => b - a);
  if (levels.has(0)) rows.push(0);
  const W = Math.max(720, Math.max(...[...levels.values()].map((l) => l.length)) * 92 + 140), rowH = 116, H = Math.max(220, rows.length * rowH + 30);
  const pos = new Map<string, { x: number; y: number }>();
  rows.forEach((L, ri) => {
    const list = levels.get(L)!;
    list.forEach((n, i) => pos.set(n.id, { x: ((i + 0.5) / list.length) * (W - 120) + 60, y: 50 + ri * rowH }));
  });
  if (!web.nodes.length) return <p className="text-ink/60">Add some plants and animals to see who eats whom.</p>;
  const levelName = (L: number) => (L === 0 ? 'Decomposers — recycle everything that dies' : L === 1 ? 'Producers — make food from sunlight' : L === 2 ? 'Primary consumers — eat producers' : L === 3 ? 'Secondary consumers' : 'Top predators');
  return (
    <div>
      <p className="mb-3 text-sm text-ink/70">Arrows show the flow of energy: <b>from the food to the eater</b>. Tap an organism to visit it.</p>
      <div className="overflow-x-auto rounded-2xl bg-[#fbf7ef] ring-1 ring-black/5">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[640px]" style={{ width: '100%' }}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#6b5b45" /></marker>
            <marker id="arrowHi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#e0662f" /></marker>
          </defs>
          {rows.map((L, ri) => <text key={L} x={12} y={22 + ri * rowH} fontSize="12" fontWeight="700" fill="#8a7a62">{levelName(L)}</text>)}
          {web.edges.map((e, i) => {
            const a = pos.get(e.from), b = pos.get(e.to);
            if (!a || !b) return null;
            const hi = hover === e.from || hover === e.to;
            const my = (a.y + b.y) / 2;
            return <path key={i} d={`M${a.x},${a.y - 22} C${a.x},${my} ${b.x},${my} ${b.x},${b.y + 24}`} fill="none" stroke={hi ? '#e0662f' : '#6b5b4588'} strokeWidth={hi ? 2.4 : 1.3} markerEnd={`url(#${hi ? 'arrowHi' : 'arrow'})`} />;
          })}
          {web.nodes.map((n) => {
            const p = pos.get(n.id);
            if (!p) return null;
            const c = ROLE_META[n.role as Role].color;
            return (
              <g key={n.id} transform={`translate(${p.x},${p.y})`} className="cursor-pointer" onClick={() => onPick(n.id)} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}>
                <circle r={22} fill="#fff" stroke={c} strokeWidth={hover === n.id ? 4 : 2.5} />
                <text textAnchor="middle" dy="8" fontSize="22">{n.def.emoji}</text>
                <text textAnchor="middle" y={38} fontSize="11.5" fontWeight="700" fill="#3b3328">{n.name.length > 16 ? n.name.slice(0, 15) + '…' : n.name}</text>
                {n.count > 1 && <g transform="translate(17,-17)"><circle r={9} fill={c} /><text textAnchor="middle" dy="3.5" fontSize="10" fontWeight="800" fill="#fff">×{n.count}</text></g>}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(['producer', 'primary', 'secondary', 'tertiary', 'decomposer'] as Role[]).map((r) => <Chip key={r} color={ROLE_META[r].color}>{ROLE_META[r].emoji} {ROLE_META[r].label}</Chip>)}
      </div>
    </div>
  );
}

/* ---------------- guide + checklist ---------------- */
function useChecklist(engine: Engine) {
  const actors = engine.actorList.filter((a) => !a.isClone);
  const roles = actors.map((a) => roleOf(a.def));
  const count = (r: Role) => roles.filter((x) => x === r).length;
  const web = buildFoodWeb(actors.map((a) => ({ id: a.id, def: a.def, name: a.name })));
  const maxLevel = Math.max(0, ...web.nodes.map((n) => n.level));
  const water = !!engine.terrain?.waterLevel || engine.doc.base.kind === 'asset' || actors.some((a) => a.def.category === 'water');
  const abiotic = water || actors.some((a) => a.def.category === 'land');
  const notes = actors.filter((a) => (a.doc.note ?? '').trim().length > 10).length;
  const coded = actors.some((a) => JSON.stringify(a.doc.scripts ?? '').includes('dd_when')) || JSON.stringify(engine.doc.worldScripts ?? '').includes('dd_when');
  return [
    { ok: engine.doc.title.trim().length > 2, text: 'Give your diorama a title', hint: 'Edit it in the top bar.' },
    { ok: count('producer') >= 3, text: `At least 3 producers (${count('producer')})`, hint: 'Plants and algae make food from sunlight.' },
    { ok: count('primary') >= 2, text: `At least 2 plant-eaters (${count('primary')})`, hint: 'Herbivores are primary consumers.' },
    { ok: count('secondary') + count('tertiary') >= 1, text: 'At least 1 predator', hint: 'Secondary and top consumers eat other animals.' },
    { ok: count('decomposer') >= 1, text: 'At least 1 decomposer', hint: 'Mushrooms, earthworms, a rotting log…' },
    { ok: maxLevel >= 3, text: 'A food chain with 3+ links', hint: 'Open the food web to check.' },
    { ok: water, text: 'A water source', hint: 'Every habitat needs water — add a pond or stream.' },
    { ok: abiotic, text: 'Non-living (abiotic) features', hint: 'Rocks, water, soil, sunlight.' },
    { ok: engine.env.labels, text: 'Labels turned on', hint: 'Toothpick flags name your organisms.' },
    { ok: notes >= 3, text: `Research notes on 3 organisms (${notes})`, hint: 'Build → select → My notes.' },
    { ok: coded, text: 'Bring something to life with code', hint: 'Code → “when ▶ clicked”.' },
  ];
}
function Guide() {
  const engine = useEngine();
  useEngineVersion();
  const b = BIOME_BY_ID[engine.doc.biome] ?? BIOME_BY_ID.blank;
  const g = b.guide;
  const list = useChecklist(engine);
  const done = list.filter((x) => x.ok).length;
  return (
    <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4 text-sm">
        <p className="text-base leading-relaxed">{g.summary}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl bg-sky-50 p-3 ring-1 ring-sky-100"><div className="text-xs font-bold uppercase text-sky-700">🌡️ Climate</div><div className="mt-1">{g.climate}</div></div>
          <div className="rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-100"><div className="text-xs font-bold uppercase text-emerald-700">🗺️ Where in the world</div><div className="mt-1">{g.where}</div></div>
        </div>
        <div><div className="mb-1 font-display font-semibold">🧬 Adaptations</div><ul className="list-disc space-y-1 pl-5">{g.adaptations.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <div><div className="mb-1 font-display font-semibold">⚠️ Threats</div><ul className="list-disc space-y-1 pl-5">{g.threats.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <div><div className="mb-1 font-display font-semibold">📖 Vocabulary</div><dl className="space-y-1">{g.vocab.map(([w, d]) => <div key={w}><dt className="inline font-bold">{w}:</dt> <dd className="inline text-ink/75">{d}</dd></div>)}</dl></div>
        <div><div className="mb-1 font-display font-semibold">❓ Think about it</div><ul className="list-disc space-y-1 pl-5">{g.questions.map((x) => <li key={x}>{x}</li>)}</ul></div>
      </div>
      <div>
        <div className="rounded-3xl bg-[#fff8e6] p-4 ring-1 ring-amber-200">
          <div className="flex items-center justify-between"><div className="font-display text-lg font-semibold">✅ Diorama checklist</div><div className="font-display text-sm font-semibold text-amber-700">{done}/{list.length}</div></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-100"><div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${(done / list.length) * 100}%` }} /></div>
          <ul className="mt-3 space-y-2">
            {list.map((x) => (
              <li key={x.text} className="flex gap-2 text-sm">
                {x.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-leaf" /> : <Circle size={18} className="mt-0.5 shrink-0 text-ink/30" />}
                <div><div className={clsx('font-semibold', x.ok && 'text-ink/60 line-through decoration-leaf/50')}>{x.text}</div>{!x.ok && <div className="text-xs text-ink/55">{x.hint}</div>}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------------- guided tour ---------------- */
function tourStops(engine: Engine) {
  const actors = engine.actorList.filter((a) => !a.isClone && a.root.visible && a.def.category !== 'sky' && a.def.category !== 'habitats');
  const order = (a: Actor) => ({ producer: 1, primary: 2, secondary: 3, tertiary: 4, decomposer: 5, abiotic: 6 }[roleOf(a.def)]);
  const withNotes = actors.filter((a) => (a.doc.note ?? '').trim());
  const pool = withNotes.length >= 3 ? withNotes : actors.filter((a) => a.def.living !== false);
  // one stop per species keeps the tour moving
  const seen = new Set<string>();
  return pool.sort((a, b) => order(a) - order(b)).filter((a) => { if (seen.has(a.def.id)) return false; seen.add(a.def.id); return true; }).slice(0, 24);
}
function Tour({ onExit }: { onExit: () => void }) {
  const engine = useEngine();
  const stops = useMemo(() => tourStops(engine), [engine]);
  const [i, setI] = useState(-1);
  const [auto, setAuto] = useState(true);
  const [narrate, setNarrate] = useState(true);
  const timer = useRef(0);
  const b = BIOME_BY_ID[engine.doc.biome];
  const stop = i >= 0 ? stops[i] : null;
  const text = stop ? `${stop.name}. ${factText(stop)}` : `${engine.doc.title}${engine.doc.author ? ', by ' + engine.doc.author : ''}. ${engine.doc.description || b?.guide.summary || ''}`;
  useEffect(() => {
    if (i < 0) { engine.select(null); engine.frameCamera(); }
    else if (stop) { engine.select(stop.id); engine.focusActor(stop.id, 1.4); }
    stopSpeech();
    let cancelled = false;
    const advance = () => { if (!cancelled && auto) setI((x) => (x + 1 < stops.length ? x + 1 : x)); };
    clearTimeout(timer.current);
    if (narrate) void speak(text).then(() => { if (!cancelled) timer.current = window.setTimeout(advance, 1500); });
    else if (auto) timer.current = window.setTimeout(advance, 6500);
    return () => { cancelled = true; clearTimeout(timer.current); };
  }, [i, auto, narrate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { stopSpeech(); engine.select(null); }, [engine]);
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-end p-3 sm:p-5">
      <div className="pointer-events-auto mx-auto w-full max-w-2xl dd-panel rounded-3xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-4xl shadow-sm">{stop ? stop.def.emoji : b?.emoji ?? '📦'}</div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink/45">{i < 0 ? 'Welcome to' : `Stop ${i + 1} of ${stops.length}`}</div>
            <div className="font-display text-2xl font-semibold leading-tight">{stop ? stop.name : engine.doc.title}</div>
            <p className="mt-1 text-sm leading-relaxed text-ink/80">{stop ? factText(stop) : (engine.doc.description || b?.guide.summary)}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Btn size="sm" disabled={i < 0} onClick={() => setI(i - 1)}><ChevronLeft size={16} /> Back</Btn>
          <Btn size="sm" variant="solid" disabled={i >= stops.length - 1} onClick={() => setI(i + 1)}>Next <ChevronRight size={16} /></Btn>
          <Btn size="sm" active={auto} onClick={() => setAuto(!auto)}>{auto ? <Pause size={14} /> : <Play size={14} />} Auto</Btn>
          <Btn size="sm" active={narrate} onClick={() => { setNarrate(!narrate); stopSpeech(); }}><Volume2 size={14} /> Narrate</Btn>
          <div className="flex-1" />
          <Btn size="sm" onClick={onExit}><X size={14} /> End tour</Btn>
        </div>
      </div>
    </div>
  );
}
