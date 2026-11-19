import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { BIOMES } from '../../biomes/templates';
import type { BiomeTemplate } from '../../biomes/types';
import { newDoc } from '../../biomes/factory';
import { DIORAMA_SIZES } from '../../engine/sizes';
import { CATALOG } from '../../assets/catalog';
import type { DioramaDoc } from '../../engine/types';
import type { Settings } from '../../storage/projects';
import { updateProfile } from '../../game/progress';
import { Segmented } from '../common';
import { Stars } from '../game/Hud';
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
 * The Expeditions tray: every habitat as a compact postcard tile, so they can all be browsed at a
 * glance. Picking one slides in its briefing, where the diorama is named and started.
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
  const facts = (b: BiomeTemplate) => {
    const [found, total] = progress[b.id] ?? [0, 0];
    return { found, total, stars: profile.biomeStars[b.id] ?? 0, fresh: b.id !== 'blank' && !profile.biomesBuilt.includes(b.id) };
  };
  return (
    <div className="absolute inset-0">
      <div className={clsx('absolute inset-0 overflow-y-auto overscroll-contain px-3 pb-[var(--tray-pb)] pt-1 sm:px-5', pick && 'invisible')} aria-hidden={!!pick || undefined}>
        <div className={clsx('grid gap-2', dense ? 'grid-cols-[repeat(auto-fill,minmax(96px,1fr))]'
          : 'grid-cols-[repeat(auto-fill,minmax(100px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(148px,1fr))] sm:gap-3 lg:grid-cols-[repeat(auto-fill,minmax(196px,1fr))]')}>
          {BIOMES.map((b) => <HabitatTile key={b.id} b={b} {...facts(b)} onClick={() => { setPick(b); uiSound('open'); }} />)}
        </div>
        <p className="mt-3 text-center text-[11.5px] font-semibold text-ink/45">Every habitat has its own species to discover and quests to complete.</p>
      </div>
      {pick && <Briefing key={pick.id} b={pick} {...facts(pick)} settings={settings} updateSettings={updateSettings} onBack={() => { setPick(null); uiSound('tab'); }} onStart={onStart} />}
    </div>
  );
}

function HabitatTile({ b, found, total, stars, fresh, onClick }: { b: BiomeTemplate; found: number; total: number; stars: number; fresh: boolean; onClick: () => void }) {
  const url = useBiomeThumb(b.env.backdrop ?? 'meadow', 320, 220);
  return (
    <button type="button" onClick={onClick} title={b.tagline} className="dd-tile-card group relative flex min-w-0 flex-col overflow-hidden rounded-2xl text-left" style={{ ['--accent' as string]: b.accent }}>
      <div className="relative aspect-[16/11] w-full overflow-hidden lg:aspect-[16/10]">
        {url ? <img src={url} alt="" draggable={false} className="dd-thumb-in h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" /> : <div className="dd-thumb-ph h-full w-full" />}
        <div className="absolute inset-x-0 bottom-0 h-[7px]" style={{ background: KRAFT_EDGE }} />
        <span className="absolute left-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-[11px] bg-white/95 text-[19px] leading-none shadow-md transition-transform group-hover:-rotate-6 group-hover:scale-110 sm:h-9 sm:w-9 sm:text-[21px]">{b.emoji}</span>
        {fresh && <span className="dd-ribbon absolute right-1.5 top-1.5 rounded-full px-1.5 py-px font-display text-[9.5px] font-bold uppercase tracking-wider">New</span>}
        {stars > 0 && <span className="absolute bottom-2.5 right-1.5 rounded-full bg-black/45 px-1.5 py-0.5 leading-none backdrop-blur-sm"><Stars n={stars} size={9} /></span>}
      </div>
      <div className="flex flex-1 flex-col justify-between gap-1.5 px-2 pb-2 pt-1.5 sm:px-2.5">
        <div className="line-clamp-2 font-display text-[13px] font-bold leading-[1.15] sm:text-[14.5px]" style={{ color: b.accent }}>{b.name}</div>
        {total > 0 && (
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
  const start = () => {
    uiSound('pop');
    const author = (settings.author || profile.name).trim();
    const sz = DIORAMA_SIZES.find((x) => x.id === size);
    onStart(newDoc(b, settings.quality, { title: title.trim() || b.name, author, size: b.id === 'blank' && sz ? { width: sz.w, depth: sz.d } : undefined }));
  };
  return (
    <div className="dd-slide-in absolute inset-0 flex flex-col" role="group" aria-label={`${b.name} expedition`}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 sm:px-5">
        <button type="button" onClick={onBack} className="mb-1.5 inline-flex h-9 items-center gap-0.5 rounded-xl pl-1 pr-3 font-display text-[14px] font-semibold text-ink/65 transition hover:bg-black/5 hover:text-ink"><ChevronLeft size={19} /> All habitats</button>
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
            <p className="mt-3 text-[14.5px] font-bold leading-snug" style={{ color: b.accent }}>{b.tagline}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink/70">{b.guide.summary}</p>
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
            {b.id === 'blank' && (
              <div>
                <div className="mb-1 text-[13px] font-semibold text-ink/70">Size of the box <span className="font-normal text-ink/45">(you can change it later in Build)</span></div>
                <Segmented value={size} onChange={setSize} options={DIORAMA_SIZES.map((x) => ({ value: x.id, label: x.label, title: `${x.w} × ${x.d} m` }))} />
              </div>
            )}
            <div>
              <div className="mb-1 text-[13px] font-semibold text-ink/70">Graphics</div>
              <Segmented size="sm" value={settings.quality} onChange={(q) => updateSettings({ ...settings, quality: q })} options={QUALITY_OPTIONS} />
            </div>
          </div>
        </div>
      </div>
      <div className="shrink-0 border-t border-black/5 px-3 pb-[var(--tray-pb)] pt-2.5 sm:px-5">
        <button type="button" onClick={start} className="dd-cta flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-display text-xl font-bold text-white sm:ml-auto sm:max-w-sm"><Sparkles size={22} /> Start expedition!</button>
      </div>
    </div>
  );
}
