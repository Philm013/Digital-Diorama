import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { ChevronLeft, Lock, Sparkles } from 'lucide-react';
import { BIOMES, BIOME_BY_ID } from '../../biomes/templates';
import type { BiomeTemplate } from '../../biomes/types';
import { newDoc } from '../../biomes/factory';
import { DIORAMA_SIZES, MAX_DEPTH, MAX_WIDTH, MIN_SIZE } from '../../engine/sizes';
import { CATALOG } from '../../assets/catalog';
import type { DioramaDoc } from '../../engine/types';
import type { Settings } from '../../storage/projects';
import { updateProfile } from '../../game/progress';
import { Segmented, Slider } from '../common';
import { FEATURES, STAGES, exampleUnlocked, habitatUnlocked, isUnlocked, needFor, nextStage, showLocked, sizeUnlocked, stageOf } from '../../game/unlocks';
import { Stars, unlockSummary } from '../game/Hud';
import { useProfile } from '../game/useGame';
import { useBiomeThumb } from '../thumbs';
import { useBackLayer } from '../backStack';
import { uiSound } from '../feedback';

const LIVING = CATALOG.filter((d) => d.living !== false && d.category !== 'habitats');
/** the cardboard edge along the bottom of a diorama postcard */
export const KRAFT_EDGE = 'repeating-linear-gradient(90deg,#6b4a2c 0 18px,#7d5734 18px 30px,#5a3d24 30px 44px)';
export const QUALITY_OPTIONS: { value: Settings['quality']; label: string; title?: string }[] = [
  { value: 'low', label: 'Fast', title: 'Best for phones & Chromebooks' }, { value: 'medium', label: 'Balanced' }, { value: 'high', label: 'Detailed', title: 'For fast computers' },
];

/** [species found, species that live there] per habitat */
export function useBiomeProgress() {
  const profile = useProfile();
  return useMemo(() => Object.fromEntries(BIOMES.map((b) => {
    const all = LIVING.filter((d) => d.biomes.includes(b.id));
    return [b.id, [all.filter((d) => profile.discovered.includes(d.id)).length, all.length] as [number, number]];
  })), [profile.discovered]);
}

/**
 * The Expeditions tray: the ranger path. Habitats are grouped by the step of the path that opens
 * them; locked ones show what it takes to reach them. Picking an open habitat slides in its
 * briefing, where the new diorama is named, sized and started.
 */
export function ExpeditionPicker({ settings, updateSettings, onStart, active, dense }: {
  settings: Settings; updateSettings: (s: Settings) => void; onStart: (doc: DioramaDoc) => void; active: boolean;
  /** smaller tiles, for a short tray (phones held sideways) */
  dense?: boolean;
}) {
  const profile = useProfile();
  const progress = useBiomeProgress();
  const [pick, setPick] = useState<BiomeTemplate | null>(null);
  // Back steps from a briefing to the habitats, then puts the tray away
  useBackLayer(active && !!pick, () => setPick(null));
  const stage = stageOf(profile);
  const facts = (b: BiomeTemplate) => {
    const [found, total] = progress[b.id] ?? [0, 0];
    return { found, total, stars: profile.biomeStars[b.id] ?? 0, fresh: b.id !== 'blank' && !profile.biomesBuilt.includes(b.id), locked: !habitatUnlocked(b.id, profile), done: profile.completedBiomes.includes(b.id) };
  };
  const grid = clsx('grid gap-2', dense ? 'grid-cols-[repeat(auto-fill,minmax(96px,1fr))]'
    : 'grid-cols-[repeat(auto-fill,minmax(100px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(148px,1fr))] sm:gap-3 lg:grid-cols-[repeat(auto-fill,minmax(176px,1fr))]');
  return (
    <div className="absolute inset-0">
      <div className={clsx('absolute inset-0 overflow-y-auto overscroll-contain px-3 pb-[var(--tray-pb)] pt-1 sm:px-5', pick && 'invisible')} aria-hidden={!!pick || undefined}>
        <PathProgress />
        {STAGES.map((st) => {
          const open = stage >= st.n;
          const biomes = st.habitats.map((h) => BIOME_BY_ID[h]).filter(Boolean);
          return (
            <section key={st.n} className="mt-3 first:mt-1" aria-label={`${st.rank}${open ? '' : ' (locked)'}`}>
              <div className="mb-1.5 flex items-center gap-2 px-0.5">
                <span className={clsx('grid h-7 w-7 shrink-0 place-items-center rounded-[10px] text-[16px]', open ? 'bg-amber-100' : 'bg-black/[0.06] grayscale')}>{st.emoji}</span>
                <span className={clsx('font-display text-[14px] font-bold', open ? 'text-ink' : 'text-ink/45')}>{st.rank}</span>
                <span className="h-px flex-1 bg-black/10" />
                {open
                  ? <span className="text-[11px] font-bold uppercase tracking-wider text-[#2a9a43]">{st.n === 0 ? 'Start here' : 'Unlocked'}</span>
                  : <span className="flex items-center gap-1 text-[11px] font-bold text-ink/45"><Lock size={11} /> {needFor(st.n, profile)} more expedition{needFor(st.n, profile) === 1 ? '' : 's'}</span>}
              </div>
              <div className={grid}>
                {biomes.map((b) => {
                  const f = facts(b);
                  return <HabitatTile key={b.id} b={b} {...f} onClick={() => { if (f.locked) { showLocked({ habitat: b.id }); return; } setPick(b); uiSound('open'); }} />;
                })}
              </div>
              {!open && st.features.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1 px-0.5">
                  {st.features.map((ft) => <span key={ft} className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] font-semibold text-ink/50">{FEATURES[ft].emoji} {FEATURES[ft].name}</span>)}
                </div>
              )}
            </section>
          );
        })}
        <p className="mt-4 text-center text-[11.5px] font-semibold text-ink/45">Complete an expedition by earning ⭐⭐ on a diorama of your own. Each one unlocks the next step.</p>
      </div>
      {pick && <Briefing key={pick.id} b={pick} {...facts(pick)} settings={settings} updateSettings={updateSettings} onBack={() => { setPick(null); uiSound('tab'); }} onStart={onStart} />}
    </div>
  );
}

/** how far along the ranger path the student is, and what comes next */
export function PathProgress({ dark }: { dark?: boolean }) {
  const profile = useProfile();
  const stage = stageOf(profile);
  const next = nextStage(profile);
  const cur = STAGES[stage];
  return (
    <div className={clsx('flex items-center gap-3 rounded-[20px] p-2.5 pr-3', dark ? 'dd-card-dark text-white' : 'bg-gradient-to-r from-amber-50 to-white ring-1 ring-amber-200/70')}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-gradient-to-b from-amber-200 to-amber-400 text-2xl shadow-[0_3px_0_#b77d12]">{cur.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className={clsx('font-display text-[11px] font-bold uppercase tracking-[0.14em]', dark ? 'text-amber-300' : 'text-amber-700')}>Ranger path · {profile.completed.length} completed</div>
        <div className="truncate font-display text-[15px] font-bold leading-tight">{profile.unlockAll ? 'Everything unlocked (teacher mode)' : cur.rank}</div>
        <div className="mt-1 flex gap-1" aria-hidden>
          {STAGES.slice(1).map((s) => <span key={s.n} className={clsx('h-1.5 flex-1 rounded-full', stage >= s.n ? 'bg-amber-500' : dark ? 'bg-white/15' : 'bg-black/10')} />)}
        </div>
        {next && <div className={clsx('mt-1 truncate text-[11.5px] font-semibold', dark ? 'text-white/60' : 'text-ink/55')}>Next: {next.emoji} {next.rank} — {unlockSummary(next, 2)}</div>}
      </div>
    </div>
  );
}

function HabitatTile({ b, found, total, stars, fresh, locked, done, onClick }: { b: BiomeTemplate; found: number; total: number; stars: number; fresh: boolean; locked: boolean; done: boolean; onClick: () => void }) {
  const url = useBiomeThumb(b.env.backdrop ?? 'meadow', 320, 220);
  return (
    <button type="button" onClick={onClick} title={locked ? `${b.name} — locked` : b.tagline} aria-label={locked ? `${b.name} (locked)` : b.name}
      className={clsx('dd-tile-card group relative flex min-w-0 flex-col overflow-hidden rounded-2xl text-left', locked && 'opacity-70')} style={{ ['--accent' as string]: b.accent }}>
      <div className="relative aspect-[16/11] w-full overflow-hidden lg:aspect-[16/10]">
        {url ? <img src={url} alt="" draggable={false} className={clsx('dd-thumb-in h-full w-full object-cover transition-transform duration-500 group-hover:scale-110', locked && 'grayscale')} /> : <div className="dd-thumb-ph h-full w-full" />}
        <div className="absolute inset-x-0 bottom-0 h-[7px]" style={{ background: KRAFT_EDGE }} />
        <span className={clsx('absolute left-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-[11px] bg-white/95 text-[19px] leading-none shadow-md transition-transform group-hover:-rotate-6 group-hover:scale-110 sm:h-9 sm:w-9 sm:text-[21px]', locked && 'grayscale')}>{b.emoji}</span>
        {locked && <span className="absolute inset-0 grid place-items-center bg-black/25"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#ffd75e] text-[#3d2a00] shadow-lg"><Lock size={19} strokeWidth={2.6} /></span></span>}
        {!locked && done && <span className="absolute right-1.5 top-1.5 rounded-full bg-[#2fae4b] px-1.5 py-px font-display text-[9.5px] font-bold uppercase tracking-wider text-white shadow">✓ Done</span>}
        {!locked && !done && fresh && <span className="dd-ribbon absolute right-1.5 top-1.5 rounded-full px-1.5 py-px font-display text-[9.5px] font-bold uppercase tracking-wider">New</span>}
        {stars > 0 && <span className="absolute bottom-2.5 right-1.5 rounded-full bg-black/45 px-1.5 py-0.5 leading-none backdrop-blur-sm"><Stars n={stars} size={9} /></span>}
      </div>
      <div className="flex flex-1 flex-col justify-between gap-1.5 px-2 pb-2 pt-1.5 sm:px-2.5">
        <div className="line-clamp-2 font-display text-[13px] font-bold leading-[1.15] sm:text-[14.5px]" style={{ color: locked ? undefined : b.accent }}>{b.name}</div>
        {total > 0 && !locked && (
          <div className="h-1 overflow-hidden rounded-full bg-black/[0.07]" title={`${found} of ${total} species found`}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(found / total) * 100}%`, background: b.accent }} />
          </div>
        )}
      </div>
    </button>
  );
}

function Briefing({ b, found, total, stars, settings, updateSettings, onBack, onStart }: {
  b: BiomeTemplate; found: number; total: number; stars: number; settings: Settings; updateSettings: (s: Settings) => void; onBack: () => void; onStart: (doc: DioramaDoc) => void;
}) {
  const profile = useProfile();
  const hero = useBiomeThumb(b.env.backdrop ?? 'meadow', 640, 300, true);
  const [title, setTitle] = useState('');
  const [size, setSize] = useState('medium');
  const custom = isUnlocked('size-custom', profile);
  const [cw, setCw] = useState(40), [cd, setCd] = useState(28);
  const example = exampleUnlocked(b.id, profile);
  const tile = !b.terrain;
  const start = (model = false) => {
    uiSound('pop');
    const author = (settings.author || profile.name).trim();
    const sz = size === 'custom' ? { width: cw, depth: cd } : (() => { const x = DIORAMA_SIZES.find((y) => y.id === size); return x ? { width: x.w, depth: x.d } : undefined; })();
    onStart(newDoc(b, settings.quality, model ? { title: `${b.name} (example)`, author: '', model: true } : { title: title.trim() || b.name, author, size: sz }));
  };
  const sizes = [...DIORAMA_SIZES.map((x) => ({ id: x.id, label: x.label, detail: `${x.w}×${x.d} m`, ok: sizeUnlocked(x.id, profile) })), ...(custom && !tile ? [{ id: 'custom', label: 'Custom', detail: `${cw}×${cd} m`, ok: true }] : [])];
  return (
    <div className="dd-slide-in absolute inset-0 flex flex-col" role="group" aria-label={`${b.name} expedition`}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 sm:px-5">
        <button type="button" onClick={onBack} className="mb-1.5 inline-flex h-10 items-center gap-0.5 rounded-xl pl-1 pr-3 font-display text-[14px] font-semibold text-ink/65 transition hover:bg-black/5 hover:text-ink"><ChevronLeft size={19} /> All habitats</button>
        <div className="grid gap-4 sm:grid-cols-[1.15fr_1fr] sm:gap-5 md:gap-6">
          <div className="min-w-0">
            <div className="relative overflow-hidden rounded-3xl" style={{ ['--accent' as string]: b.accent }}>
              <div className="aspect-[16/7.5] w-full">{hero ? <img src={hero} alt="" className="dd-thumb-in h-full w-full object-cover" /> : <div className="dd-thumb-ph h-full w-full" />}</div>
              <div className="absolute inset-x-0 bottom-0 h-2.5" style={{ background: KRAFT_EDGE }} />
              <div className="absolute inset-x-0 bottom-2.5 flex items-end gap-2.5 bg-gradient-to-t from-black/60 via-black/25 to-transparent px-3 pb-2.5 pt-12">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/95 text-[28px] leading-none shadow-md">{b.emoji}</span>
                <div className="min-w-0 pb-0.5 text-white [text-shadow:0_1px_3px_rgba(0,0,0,.45)]">
                  <div className="truncate font-display text-[22px] font-bold leading-tight">{b.name}</div>
                  <div className="flex items-center gap-2 text-[12px] font-bold text-white/90">
                    {total > 0 && <span>📖 {found}/{total} species found</span>}
                    {stars > 0 && <Stars n={stars} size={11} />}
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-ink/70">{b.guide.summary}</p>
            <div className="mt-3 rounded-2xl bg-[#2fae4b]/[0.08] p-3 ring-1 ring-[#2fae4b]/20">
              <div className="font-display text-[13px] font-bold text-[#1f7f35]">🧭 Your mission</div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-ink/70">
                {b.id === 'blank' ? 'An empty box: shape the land and fill it with the habitat you are studying.' : `You start with the ${b.name.toLowerCase()}’s land and climate — it’s up to you to bring it to life.`}
                {' '}Add producers, plant-eaters, predators and decomposers, keep the ecosystem healthy, and complete 10 quests (⭐⭐) to finish the expedition.
              </p>
            </div>
          </div>
          <div className="space-y-3.5">
            <label className="block">
              <span className="text-[13px] font-semibold text-ink/70">Diorama title</span>
              <input className="dd-input mt-1 h-11" value={title} placeholder={b.name} onChange={(e) => setTitle(e.target.value)} maxLength={40} enterKeyHint="go" onKeyDown={(e) => { if (e.key === 'Enter') start(); }} />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-ink/70">Made by <span className="font-normal text-ink/45">(optional)</span></span>
              <input className="dd-input mt-1 h-11" value={settings.author || profile.name} placeholder="Your name or team" maxLength={40}
                onChange={(e) => { updateSettings({ ...settings, author: e.target.value }); if (!profile.name) updateProfile({ name: e.target.value.slice(0, 24) }); }} />
            </label>
            <div>
              <div className="mb-1 text-[13px] font-semibold text-ink/70">Size of the box <span className="font-normal text-ink/45">(you can change it later in Build)</span></div>
              <div className="grid grid-cols-2 gap-1.5 min-[420px]:grid-cols-4" role="radiogroup" aria-label="Size of the box">
                {sizes.map((x) => (
                  <button key={x.id} type="button" role="radio" aria-checked={size === x.id} onClick={() => { if (!x.ok) { showLocked(x.id === 'huge' ? 'size-huge' : 'size-large'); return; } setSize(x.id); uiSound('tick'); }}
                    className={clsx('relative flex h-12 flex-col items-center justify-center rounded-xl font-display ring-1 transition', size === x.id ? 'bg-ink text-white ring-ink' : 'bg-white text-ink/75 ring-black/10 hover:bg-black/[0.03]', !x.ok && 'opacity-55')}>
                    <span className="text-[13.5px] font-bold leading-tight">{x.label}</span>
                    <span className={clsx('text-[10.5px] font-semibold', size === x.id ? 'text-white/70' : 'text-ink/45')}>{x.detail}</span>
                    {!x.ok && <span className="absolute -right-1 -top-1 grid h-[18px] w-[18px] place-items-center rounded-full bg-[#ffd75e] text-[#3d2a00] shadow"><Lock size={10} strokeWidth={3} /></span>}
                  </button>
                ))}
              </div>
              {size === 'custom' && (
                <div className="mt-2 space-y-2 rounded-xl bg-black/[0.03] p-2.5">
                  <Slider label="Width" value={cw} min={MIN_SIZE} max={MAX_WIDTH} step={2} unit="m" onChange={setCw} />
                  <Slider label="Depth" value={cd} min={MIN_SIZE} max={MAX_DEPTH} step={2} unit="m" onChange={setCd} />
                </div>
              )}
              {tile && <p className="mt-1 text-[11px] text-ink/45">This habitat is a ready-made tile: the size sets how big its patch is.</p>}
            </div>
            <div>
              <div className="mb-1 text-[13px] font-semibold text-ink/70">Graphics</div>
              <Segmented size="sm" value={settings.quality} onChange={(q) => updateSettings({ ...settings, quality: q })} options={QUALITY_OPTIONS} />
            </div>
            {b.placements.length > 0 && (
              example ? (
                <button type="button" onClick={() => start(true)} className="flex w-full items-center gap-2.5 rounded-2xl bg-white p-2.5 text-left ring-1 ring-black/10 transition hover:bg-black/[0.02]">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#3d85c6]/10 text-xl">🏛️</span>
                  <span className="min-w-0 flex-1"><span className="block font-display text-[14px] font-bold">Visit the example diorama</span><span className="block text-[11.5px] text-ink/55">A finished {b.name.toLowerCase()} to explore and compare with yours</span></span>
                </button>
              ) : (
                <div className="flex items-center gap-2.5 rounded-2xl bg-black/[0.03] p-2.5 text-ink/55">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/[0.05] text-xl grayscale">🏛️</span>
                  <span className="min-w-0 flex-1 text-[12px] leading-snug"><b className="font-display text-[13px] text-ink/65">Example diorama</b><br />Complete an expedition here to unlock a finished example to compare with.</span>
                  <Lock size={16} className="shrink-0" />
                </div>
              )
            )}
          </div>
        </div>
      </div>
      <div className="shrink-0 border-t border-black/5 px-3 pb-[var(--tray-pb)] pt-2.5 sm:px-5">
        <button type="button" onClick={() => start()} className="dd-cta flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-display text-xl font-bold text-white sm:ml-auto sm:max-w-sm"><Sparkles size={22} /> Start expedition!</button>
      </div>
    </div>
  );
}
