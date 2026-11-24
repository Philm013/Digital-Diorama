import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { X, Crosshair, Volume2, Footprints, Earth, Tag, Network, BookOpen, Presentation, Clock, CloudSun, ChevronLeft, ChevronRight, Pause, Play, Video, Maximize2, CheckCircle2, Circle, Glasses, Smartphone, Move, Library } from 'lucide-react';
import { XRMode } from '../engine/XRMode';
import { useEngine, useEngineEvent, useEngineVersion } from './store';
import { Btn, Chip, IconBtn, Modal, Segmented, Slider, statusColor } from './common';
import { ROLE_META, LINK_META, dietText, partnersOf } from '../assets/foodweb';
import { dioramaWeb } from '../game/ecology';
import { FoodWebView } from './FoodWebView';
import { getDef } from '../assets/catalog';
import { BIOME_BY_ID } from '../biomes/templates';
import { speak, stopSpeech, audio } from '../code/sound';
import { timeLabel } from './BuildPanels';
import type { Actor } from '../engine/Actor';
import type { Engine } from '../engine/Engine';
import type { Weather } from '../engine/types';
import { AssetThumb } from './AssetThumb';
import { discover, isDiscovered, awardBadge } from '../game/progress';
import { flag, quests, starsFor } from '../game/ecology';
import { haptic, uiSound } from './feedback';
import { isUnlocked, showLocked, type FeatureId } from '../game/unlocks';
import { useProfile } from './game/useGame';
import { LockBadge } from './game/Locked';
import { learnSignal } from '../learn/signals';

export function ExploreLayer({ wide, landscape, onJournal }: { wide: boolean; landscape?: boolean; playing?: boolean; onJournal?: () => void }) {
  const engine = useEngine();
  useEngineVersion();
  useProfile();
  const [card, setCard] = useState<string | null>(null);
  // the food web, optionally opened on one species
  const [web, setWeb] = useState<string | true | null>(null);
  const [guide, setGuide] = useState(false);
  const [tour, setTour] = useState(false);
  const [pop, setPop] = useState<'time' | 'weather' | null>(null);
  useEngineEvent((e) => {
    if (e.type === 'tap') setCard(e.id);
    if (e.type === 'select' && e.id === null) setCard(null);
  });
  const walking = !!engine.walk?.active;
  const [xrSupport, setXrSupport] = useState({ ar: false, vr: false });
  const [xrOn, setXrOn] = useState(false);
  const [, bumpXr] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!engine.xr) engine.xr = new XRMode(engine);
    engine.xr.onChange = () => { setXrOn(!!engine.xr?.active); bumpXr((x) => x + 1); };
    void XRMode.support().then(setXrSupport);
  }, [engine]);
  const startXr = (kind: 'ar' | 'vr') => {
    setXrOn(true); // the AR overlay must be visible before the session starts
    engine.select(null);
    requestAnimationFrame(() => {
      engine.xr!.start(kind, overlayRef.current).catch((err: Error) => { setXrOn(false); engine.toast(`Couldn’t start ${kind.toUpperCase()}: ${err.message}`, 'error'); });
    });
  };
  const walkIn = (eye: number) => { engine.walk?.enter(eye); document.dispatchEvent(new CustomEvent('dd-walk', { detail: eye })); };
  // out of the box and into an endless landscape of the same habitat
  const roam = () => { engine.select(null); engine.walk?.enter(1.6, { endless: true }); document.dispatchEvent(new CustomEvent('dd-walk', { detail: 1.6 })); };
  const xrOverlay = (
    <div ref={overlayRef} className={xrOn ? 'pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-between p-4' : 'hidden'}>
      <div className="pointer-events-auto rounded-2xl bg-black/60 px-4 py-2 text-center font-display text-sm font-semibold text-white">
        {engine.xr?.kind === 'ar' && !engine.xr.placed ? 'Point your camera at a table or the floor, then tap to place the diorama' : 'Walk around your diorama to look at it from every side'}
      </div>
      <div className="pointer-events-auto flex gap-2">
        {engine.xr?.kind === 'ar' && engine.xr.placed && <Btn onClick={() => engine.xr?.replace()}><Move size={16} /> Move it</Btn>}
        <Btn variant="stop" onClick={() => engine.xr?.stop()}><X size={16} /> Exit</Btn>
      </div>
    </div>
  );
  if (tour) return <Tour onExit={() => setTour(false)} />;
  const actor = engine.getActor(card);
  const tools: { key: string; icon: React.ReactNode; label: string; on?: boolean; fn: () => void; sep?: boolean; needs?: FeatureId }[] = [
    { key: 'labels', icon: <Tag size={20} />, label: 'Labels', on: engine.env.labels, fn: () => engine.setEnv({ labels: !engine.env.labels }, false) },
    { key: 'time', icon: <Clock size={20} />, label: timeLabel(engine.env.time), on: pop === 'time', fn: () => setPop(pop === 'time' ? null : 'time') },
    { key: 'weather', icon: <CloudSun size={20} />, label: 'Weather', on: pop === 'weather', fn: () => setPop(pop === 'weather' ? null : 'weather'), sep: true, needs: 'weather' },
    { key: 'web', icon: <Network size={20} />, label: 'Food web', fn: () => setWeb(true) },
    { key: 'guide', icon: <BookOpen size={20} />, label: 'Guide', fn: () => setGuide(true) },
    // on phones the Journal is in the tab bar
    ...(wide || landscape ? [{ key: 'journal', icon: <Library size={20} />, label: 'Journal', fn: () => onJournal?.() }] : []),
    { key: 'tour', icon: <Presentation size={20} />, label: 'Tour', fn: () => { audio(); engine.select(null); setTour(true); }, needs: 'tour' },
    { key: 'walk', icon: <Footprints size={20} />, label: 'Walk in', fn: () => walkIn(1.6) },
    ...(engine.terrain ? [{ key: 'roam', icon: <Earth size={20} />, label: 'Roam', fn: roam, needs: 'roam' as const }] : []),
    ...(xrSupport.ar ? [{ key: 'ar', icon: <Smartphone size={20} />, label: 'AR table', fn: () => startXr('ar'), needs: 'xr' as const }] : []),
    ...(xrSupport.vr ? [{ key: 'vr', icon: <Glasses size={20} />, label: 'VR', fn: () => startXr('vr'), needs: 'xr' as const }] : []),
    { key: 'home', icon: <Maximize2 size={20} />, label: 'Overview', fn: () => { engine.follow(null); engine.frameCamera(); learnSignal('overview'); } },
  ];
  return (
    <>
      {actor && !walking && <InfoCard actor={actor} wide={wide} side={wide || !!landscape} onClose={() => { setCard(null); engine.select(null); }} onWalk={walkIn} onWeb={() => setWeb(actor.id)} />}
      {!walking && !(actor && !wide) && (
        <div className={clsx('pointer-events-none absolute inset-x-0 z-20 flex justify-center px-2', wide ? 'bottom-4' : 'bottom-2')}>
          <div className="dd-hotbar dd-scroll-x pointer-events-auto relative flex max-w-full items-center gap-1 overflow-x-auto rounded-[22px] p-1.5" data-tour="hotbar">
            {tools.map((t) => (
              <span key={t.key} className="flex shrink-0 items-center gap-1">
                <button onClick={() => { if (t.needs && !isUnlocked(t.needs)) { setPop(null); showLocked(t.needs); return; } uiSound('tick'); haptic(6); t.fn(); }}
                  className={clsx('dd-hotkey relative flex h-[54px] min-w-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl px-2 font-display text-[11px] font-semibold transition', t.on ? 'on' : 'text-white/85', t.needs && !isUnlocked(t.needs) && 'opacity-55')}
                  aria-label={t.needs && !isUnlocked(t.needs) ? `${t.label} (locked)` : undefined} data-tour={`explore-${t.key}`}>
                  {t.icon}<span className="whitespace-nowrap">{t.label}</span>
                  {t.needs && !isUnlocked(t.needs) && <LockBadge className="absolute right-1 top-1" />}
                </button>
                {t.sep && <span className="mx-0.5 h-8 w-px bg-white/15" />}
              </span>
            ))}
          </div>
          {pop && (
            <div className="dd-panel dd-pop pointer-events-auto absolute bottom-[calc(100%+10px)] w-[min(92vw,360px)] rounded-3xl p-3.5" onMouseLeave={() => setPop(null)}>
              {pop === 'time' && <div data-tour="time-pop"><TimePop /></div>}
              {pop === 'weather' && <div data-tour="weather-pop"><WeatherPop /></div>}
            </div>
          )}
        </div>
      )}
      {xrOverlay}
      <Modal open={web !== null} onClose={() => setWeb(null)} title="🕸️ Food web" wide="xl"><FoodWebView initial={typeof web === 'string' ? web : null} onVisit={(id) => { setWeb(null); engine.select(id); engine.focusActor(id); setCard(id); }} /></Modal>
      <Modal open={guide} onClose={() => setGuide(false)} title={`${BIOME_BY_ID[engine.doc.biome]?.emoji ?? '📦'} Habitat guide`} wide><Guide /></Modal>
    </>
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
      {isUnlocked('seasons')
        ? <div data-tour="season-pick"><Segmented size="sm" value={engine.env.season} onChange={(s) => engine.setEnv({ season: s }, false)} options={[{ value: 'spring', label: '🌱' }, { value: 'summer', label: '☀️' }, { value: 'autumn', label: '🍂' }, { value: 'winter', label: '❄️' }]} /></div>
        : <button type="button" onClick={() => showLocked('seasons')} className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-black/[0.05] font-display text-[13px] font-semibold text-ink/55"><LockBadge /> Seasons unlock later on your ranger path</button>}
      <Slider label="Wind" value={engine.env.wind} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => engine.setEnv({ wind: v }, false)} />
    </div>
  );
}

/* ---------------- info card ---------------- */
function factText(a: Actor) {
  const d = a.def;
  return [a.doc.note, d.info.fact ?? d.info.blurb].filter(Boolean).join(' ');
}
function InfoCard({ actor, wide, side, onClose, onWalk, onWeb }: { actor: Actor; wide: boolean; side: boolean; onClose: () => void; onWalk: (eye: number) => void; onWeb: () => void }) {
  const engine = useEngine();
  const version = useEngineVersion();
  const d = actor.def;
  // its place in this diorama's food web (the same model as the food web diagram)
  const web = useMemo(() => dioramaWeb(engine), [engine, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const wnode = web.nodes.find((n) => n.ids.includes(actor.id));
  const role = wnode?.role ?? (d.category === 'plants' ? 'producer' : 'abiotic');
  const rm = ROLE_META[role];
  const info = d.info;
  const chain = [info.kingdom, info.phylum, info.class, info.order, info.family].filter(Boolean) as string[];
  const ex = actor.model?.exhibitScale ?? 1;
  const [following, setFollowing] = useState(false);
  // reading the card discovers the species (XP the first time)
  const [isNew] = useState(() => d.living !== false && !isDiscovered(d.id));
  useEffect(() => { if (d.living !== false) discover(d.id, d.name, d.emoji); }, [d]);
  useEffect(() => () => { engine.follow(null); stopSpeech(); }, [engine, actor.id]);
  // phones: the card covers a big part of the view (below in portrait, beside in landscape), so
  // centre the scene in the space that is left and glide the camera (no zoom) to bring the tapped
  // organism into it. On a desktop the card covers little: only glide if it hides the organism.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const p = actor.root.position.clone().setY(actor.root.position.y + actor.height * 0.5);
    if (wide) {
      const v = p.clone().project(engine.camera);
      const w = engine.container.clientWidth, x = (v.x * 0.5 + 0.5) * w;
      if (x > w - el.offsetWidth - 40 || v.z > 1) engine.centerOn(p);
      return;
    }
    const apply = () => (side ? engine.setViewInset(0, el.offsetWidth + 16) : engine.setViewInset(el.offsetHeight + 8, 0));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    engine.centerOn(p);
    return () => { ro.disconnect(); engine.setViewInset(0, 0); };
  }, [engine, actor, wide, side]);
  const eatsList = wnode ? web.food(wnode.id).map((e) => ({ n: web.byId.get(e.from)!, kind: e.kind })) : [];
  const eatenBy = wnode ? web.eaters(wnode.id).map((e) => ({ n: web.byId.get(e.to)!, kind: e.kind })) : [];
  const partners = partnersOf(d.id).filter((p) => engine.actorList.some((o) => o.def.id === p.other));
  return (
    <div ref={cardRef} data-tour="species-card" className={clsx('dd-species-card dd-pop absolute z-30 flex flex-col overflow-hidden rounded-[28px]', wide ? 'right-4 top-4 max-h-[calc(100%-32px)] w-[370px]' : side ? 'bottom-2 right-2 top-2 w-[min(370px,50%)]' : 'inset-x-2 bottom-2 max-h-[64%]')} style={{ ['--role' as string]: rm.color }}>
      <div className="dd-species-hero relative flex items-end gap-3 px-4 pb-3 pt-3">
        <div className="grid h-[92px] w-[92px] shrink-0 place-items-center rounded-3xl bg-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,.5)]"><AssetThumb id={d.id} emoji={d.emoji} size={88} /></div>
        <div className="min-w-0 flex-1 pb-1 text-white [text-shadow:0_1px_3px_rgba(0,0,0,.35)]">
          {isNew && <span className="dd-ribbon mb-1 inline-block rounded-full px-2 py-0.5 font-display text-[10.5px] font-bold uppercase tracking-wider">✨ New discovery +15 XP</span>}
          <div className="font-display text-[22px] font-bold leading-tight">{actor.name}</div>
          {info.scientific && <div className="text-sm italic text-white/85">{info.scientific}</div>}
        </div>
        <IconBtn label="Close" onClick={onClose} className="absolute right-2 top-2 bg-black/15 text-white hover:bg-black/25"><X size={18} /></IconBtn>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-3 pt-3 text-sm">
        <div className="flex flex-wrap gap-1">
          <Chip color={rm.color}>{rm.emoji} {rm.label}</Chip>
          {info.diet && info.diet !== 'none' && info.diet !== 'producer' && <Chip color="#5a6b7d">diet: {info.diet}</Chip>}
          {info.status && <Chip color={statusColor(info.status)}>{info.status}</Chip>}
        </div>
        {(info.fact || info.blurb) && <p className="leading-relaxed text-ink/85">💡 {info.fact ?? info.blurb}</p>}
        {actor.doc.note && <div className="rounded-2xl bg-amber-50 p-3 text-ink/85 ring-1 ring-amber-200"><div className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">My notes</div>{actor.doc.note}</div>}
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          {info.habitat && <Fact k="Lives in" v={info.habitat} />}
          {info.size && <Fact k="Real size" v={info.size} />}
          {ex >= 1.05 && <Fact k="Shown at" v={`×${ex < 10 ? ex.toFixed(1) : Math.round(ex)} life size`} />}
          {d.loco !== 'sessile' && d.loco !== 'scenery' && <Fact k="Moves by" v={{ walk: 'walking', fly: 'flying', swim: 'swimming', slither: 'slithering', hop: 'hopping', crawl: 'crawling' }[d.loco] ?? d.loco} />}
        </div>
        {d.living !== false && (
          <div className="space-y-1.5 rounded-2xl bg-black/[0.03] p-3 text-[12.5px]">
            {d.category === 'animals' && d.info.eats?.length ? <div className="text-ink/70"><b className="text-ink/85">Diet:</b> {dietText(d)}</div> : null}
            {wnode?.hungry && <div className="rounded-xl bg-red-50 px-2.5 py-1.5 font-semibold text-red-800 ring-1 ring-red-200">⚠️ Nothing it can eat is here yet.</div>}
            {eatsList.length > 0 && <FoodRow label={wnode?.role === 'decomposer' ? '♻ Breaks down:' : '🍽️ Eats here:'} items={eatsList} />}
            {eatenBy.length > 0 && <FoodRow label={wnode?.source ? '♻ Recycled by:' : '⚠️ Eaten by:'} items={eatenBy} />}
            {partners.map((p) => <div key={p.other} className="text-emerald-800"><b>🤝 Partner — {getDef(p.other)?.name}:</b> {p.how}</div>)}
            <button type="button" onClick={onWeb} className="mt-0.5 flex items-center gap-1 font-display text-[12.5px] font-bold text-[#3d85c6] hover:underline">🕸️ See it in the food web →</button>
          </div>
        )}
        {chain.length > 1 && (
          <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold text-ink/55">
            {chain.map((c, i) => <span key={c + i} className="flex items-center gap-1">{i > 0 && <span className="text-ink/30">›</span>}<span className="rounded-md bg-black/5 px-1.5 py-0.5">{c}</span></span>)}
          </div>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1.5 border-t border-black/5 p-2.5">
        <CardBtn icon={<Crosshair size={18} />} label="Focus" onClick={() => engine.focusActor(actor.id)} />
        <CardBtn icon={<Volume2 size={18} />} label="Read" onClick={() => { audio(); void speak(`${actor.name}. ${info.scientific ? 'Scientific name: ' + info.scientific + '.' : ''} ${factText(actor)}`); }} />
        <CardBtn icon={<Video size={18} />} label={following ? 'Stop' : 'Follow'} on={following} onClick={() => { if (following) { engine.follow(null); setFollowing(false); } else { engine.focusActor(actor.id, 0.8, () => engine.follow(actor.id)); setFollowing(true); } }} />
        <CardBtn icon={<Footprints size={18} />} label="Eye level" onClick={() => onWalk(Math.max(0.03, Math.min(1.6, actor.height * 0.9)))} />
      </div>
    </div>
  );
}
function CardBtn({ icon, label, onClick, on }: { icon: React.ReactNode; label: string; onClick: () => void; on?: boolean }) {
  return <button onClick={() => { uiSound('tick'); onClick(); }} className={clsx('flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl font-display text-[11.5px] font-semibold transition active:scale-95', on ? 'bg-amber-200 text-ink' : 'bg-black/[0.04] text-ink/75 hover:bg-black/[0.08]')}>{icon}{label}</button>;
}
function Fact({ k, v }: { k: string; v: string }) {
  return <div className="rounded-xl bg-black/[0.03] px-2.5 py-1.5"><div className="text-[10px] font-bold uppercase tracking-wide text-ink/45">{k}</div><div className="font-semibold text-ink/85">{v}</div></div>;
}
function FoodRow({ label, items }: { label: string; items: { n: { id: string; name: string; emoji: string; count: number }; kind: keyof typeof LINK_META }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <b className="mr-1">{label}</b>
      {items.slice(0, 8).map(({ n, kind }) => (
        <span key={n.id + kind} className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 font-semibold ring-1 ring-black/10">
          {n.emoji} {n.name}{n.count > 1 ? ` ×${n.count}` : ''}
          {kind !== 'eats' && kind !== 'recycles' && <span className="text-[10px] font-bold uppercase" style={{ color: LINK_META[kind].color }}>{kind === 'eggs' ? 'eggs' : kind === 'scavenges' ? 'remains' : 'host'}</span>}
        </span>
      ))}
      {items.length > 8 && <span className="text-ink/50">+{items.length - 8} more</span>}
    </div>
  );
}

/* ---------------- guide + checklist ---------------- */
function Guide() {
  const engine = useEngine();
  useEngineVersion();
  const b = BIOME_BY_ID[engine.doc.biome] ?? BIOME_BY_ID.blank;
  const g = b.guide;
  const list = quests(engine);
  const done = list.filter((x) => x.done).length;
  return (
    <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]" data-tour="guide">
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
          <div className="flex items-center justify-between"><div className="font-display text-lg font-semibold">✅ Diorama checklist</div><div className="font-display text-sm font-semibold text-amber-700">{done}/{list.length} · {'★'.repeat(starsFor(list))}{'☆'.repeat(3 - starsFor(list))}</div></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-100"><div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${(done / list.length) * 100}%` }} /></div>
          <p className="mt-2 text-xs text-ink/60">The same quests as the trophy in the top bar — a ready-made rubric.</p>
          <ul className="mt-3 space-y-2">
            {list.map((x) => (
              <li key={x.id} className="flex gap-2 text-sm">
                {x.done ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-leaf" /> : <Circle size={18} className="mt-0.5 shrink-0 text-ink/30" />}
                <div><div className={clsx('font-semibold', x.done && 'text-ink/60 line-through decoration-leaf/50')}>{x.emoji} {x.title}{x.need > 1 && !x.done ? ` (${x.cur}/${x.need})` : ''}</div>{!x.done && <div className="text-xs text-ink/55">{x.hint}</div>}</div>
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
  // up the food web: producers, plant-eaters, predators by trophic level, then decomposers
  const web = dioramaWeb(engine);
  const tlOf = new Map<string, number>();
  for (const n of web.nodes) for (const id of n.ids) tlOf.set(id, n.role === 'decomposer' ? 9 : n.tl);
  const order = (a: Actor) => tlOf.get(a.id) ?? 10;
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
  // reaching the last stop completes the tour quest and badge
  useEffect(() => {
    if (stops.length && i === stops.length - 1) {
      if (flag(engine, 'tour')) engine.changed();
      awardBadge('tour-guide');
      learnSignal('tour-end');
    }
  }, [i, stops.length, engine]);
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-end p-3 sm:p-5">
      <div className="dd-pop pointer-events-auto mx-auto w-full max-w-2xl rounded-[28px] bg-[#fffdf8] p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,.6)] ring-1 ring-black/5 sm:p-5" data-tour="tour-panel">
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-black/5"><div className="h-full rounded-full bg-gradient-to-r from-[#8f7bff] to-[#5ad1ff] transition-all duration-500" style={{ width: `${((i + 1) / (stops.length + 1)) * 100}%` }} /></div>
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
          <Btn size="sm" onClick={onExit} data-tour="tour-end"><X size={14} /> End tour</Btn>
        </div>
      </div>
    </div>
  );
}
