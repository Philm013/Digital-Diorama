import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Search, Lock } from 'lucide-react';
import { CATALOG, CATEGORY_META } from '../../assets/catalog';
import type { AssetDef } from '../../assets/types';
import { dietText, roleOf, ROLE_META } from '../../assets/foodweb';
import { BIOMES } from '../../biomes/templates';
import { AVATARS, BADGES, levelOf, updateProfile } from '../../game/progress';
import { AssetThumb } from '../AssetThumb';
import { LevelRing } from './Hud';
import { useProfile } from './useGame';
import { statusColor, Chip } from '../common';

const LIVING = CATALOG.filter((d) => d.living !== false && d.category !== 'habitats');
const BIOME_NAME = Object.fromEntries(BIOMES.map((b) => [b.id, `${b.emoji} ${b.name}`]));

/** profile header shared by the welcome screen and the journal */
export function RangerCard({ dark = true, onOpenJournal }: { dark?: boolean; onOpenJournal?: () => void }) {
  const p = useProfile();
  const L = levelOf(p.xp);
  const [pick, setPick] = useState(false);
  const found = p.discovered.filter((id) => LIVING.some((d) => d.id === id)).length;
  return (
    <div className={clsx('relative rounded-[28px] p-4', dark ? 'dd-card-dark text-white' : 'dd-card text-ink')}>
      <div className="flex items-center gap-3">
        <button onClick={() => setPick((v) => !v)} className="grid h-16 w-16 shrink-0 place-items-center rounded-[22px] bg-gradient-to-br from-amber-200 to-amber-400 text-4xl shadow-[0_4px_0_#b77d12] transition active:translate-y-0.5" title="Choose your avatar">{p.avatar}</button>
        <div className="min-w-0 flex-1">
          <input value={p.name} onChange={(e) => updateProfile({ name: e.target.value.slice(0, 24) })} placeholder="Your ranger name" className={clsx('w-full rounded-lg bg-transparent font-display text-xl font-bold outline-none placeholder:opacity-50', dark ? 'focus:bg-white/10' : 'focus:bg-black/5')} aria-label="Ranger name" />
          <div className={clsx('font-display text-sm font-semibold', dark ? 'text-amber-300' : 'text-amber-700')}>Level {L.level} · {L.rank}</div>
          <div className={clsx('mt-1.5 h-2.5 overflow-hidden rounded-full', dark ? 'bg-white/10' : 'bg-black/10')}><div className="h-full rounded-full bg-gradient-to-r from-[#ffe066] to-[#ffb020] transition-all duration-700" style={{ width: `${L.frac * 100}%` }} /></div>
          <div className={clsx('mt-0.5 text-[11px] font-semibold', dark ? 'text-white/55' : 'text-ink/55')}>{L.into} / {L.need} XP to level {L.level + 1}</div>
        </div>
        <LevelRing xp={p.xp} size={52} stroke={5} />
      </div>
      {pick && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {AVATARS.map((a) => <button key={a} onClick={() => { updateProfile({ avatar: a }); setPick(false); }} className={clsx('grid h-10 w-10 place-items-center rounded-xl text-2xl transition hover:scale-110', a === p.avatar ? 'bg-amber-300/40 ring-2 ring-amber-300' : dark ? 'bg-white/10' : 'bg-black/5')}>{a}</button>)}
        </div>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[[found, LIVING.length, 'species found'], [p.badges.length, BADGES.length, 'badges'], [p.biomesBuilt.length, BIOMES.length - 1, 'habitats built']].map(([a, b, t]) => (
          <button key={String(t)} onClick={onOpenJournal} className={clsx('rounded-2xl py-2', dark ? 'bg-white/[0.07] hover:bg-white/[0.12]' : 'bg-black/[0.04] hover:bg-black/[0.07]')}>
            <div className="font-display text-xl font-bold tabular-nums">{a}<span className="text-sm opacity-50">/{b}</span></div>
            <div className="text-[10.5px] font-bold uppercase tracking-wider opacity-60">{t}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Journal({ initialTab = 'species' }: { initialTab?: 'species' | 'badges' }) {
  const p = useProfile();
  const [tab, setTab] = useState<'species' | 'badges'>(initialTab);
  const [cat, setCat] = useState<string>('animals');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<AssetDef | null>(null);
  const cats = ['animals', 'plants', 'fungi'] as const;
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return LIVING.filter((d) => (s ? (d.name + ' ' + (d.info.scientific ?? '')).toLowerCase().includes(s) && p.discovered.includes(d.id) : d.category === cat));
  }, [cat, q, p.discovered]);
  const byGroup = useMemo(() => {
    const m = new Map<string, AssetDef[]>();
    for (const d of list) { if (!m.has(d.group)) m.set(d.group, []); m.get(d.group)!.push(d); }
    return [...m.entries()];
  }, [list]);
  const countIn = (c: string) => { const all = LIVING.filter((d) => d.category === c); return [all.filter((d) => p.discovered.includes(d.id)).length, all.length]; };
  return (
    <div className="space-y-4" data-tour="journal">
      <RangerCard dark onOpenJournal={() => setTab('species')} />
      <div className="flex gap-1 rounded-2xl bg-black/[0.06] p-1">
        {(['species', 'badges'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={clsx('h-10 flex-1 rounded-xl font-display text-sm font-semibold transition', tab === t ? 'bg-white text-ink shadow' : 'text-ink/60 hover:text-ink')}>{t === 'species' ? '📖 Species' : '🏅 Badges'}</button>
        ))}
      </div>
      {tab === 'badges' ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {BADGES.map((b) => {
            const got = p.badges.includes(b.id);
            return (
              <div key={b.id} className={clsx('flex flex-col items-center rounded-3xl p-3 text-center', got ? 'bg-white shadow-sm ring-1 ring-black/5' : 'bg-black/[0.04]')}>
                <div className={clsx('dd-medal-badge grid h-16 w-16 place-items-center rounded-full text-3xl', !got && 'grayscale opacity-40')} style={{ ['--b' as string]: b.color }}>{got ? b.emoji : <Lock size={22} className="text-white/80" />}</div>
                <div className="mt-2 font-display text-sm font-semibold leading-tight">{b.name}</div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-ink/60">{b.how}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {cats.map((c) => {
              const [a, b] = countIn(c);
              return (
                <button key={c} onClick={() => { setCat(c); setQ(''); }} className={clsx('flex h-10 items-center gap-1.5 rounded-full px-3.5 font-display text-sm font-semibold ring-1 transition', cat === c && !q ? 'bg-ink text-white ring-ink' : 'bg-white text-ink/75 ring-black/10')}>
                  {CATEGORY_META[c].emoji} {CATEGORY_META[c].label} <span className="tabular-nums opacity-60">{a}/{b}</span>
                </button>
              );
            })}
            <div className="relative ml-auto min-w-[180px] flex-1 sm:max-w-[240px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search discoveries…" className="dd-input h-10 pl-9" />
            </div>
          </div>
          {byGroup.map(([g, items]) => (
            <div key={g}>
              <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink/50">{g} <span className="font-semibold text-ink/35">{items.filter((d) => p.discovered.includes(d.id)).length}/{items.length}</span></div>
              <div className="grid grid-cols-3 gap-2 min-[480px]:grid-cols-4 sm:grid-cols-6">
                {items.map((d) => {
                  const got = p.discovered.includes(d.id);
                  const rm = ROLE_META[roleOf(d)];
                  return (
                    <button key={d.id} onClick={() => got && setOpen(d)} className={clsx('dd-tile relative flex flex-col items-center rounded-2xl p-1.5 pb-2 text-center', got ? 'bg-white ring-1 ring-black/5' : 'bg-black/[0.05]')} style={{ borderBottom: `4px solid ${got ? rm.color : 'rgba(0,0,0,.08)'}` }} title={got ? d.name : `Not discovered yet — find it in: ${d.biomes.map((b) => BIOME_NAME[b]).filter(Boolean).join(', ') || 'any habitat'}`}>
                      <AssetThumb id={d.id} emoji={d.emoji} size={58} silhouette={!got} />
                      <span className={clsx('line-clamp-2 text-[11px] font-bold leading-tight', got ? 'text-ink/85' : 'text-ink/35')}>{got ? d.name : '???'}</span>
                      {!got && <span className="mt-0.5 text-[9.5px] font-semibold leading-tight text-ink/35">{d.biomes.length ? BIOME_NAME[d.biomes[0]]?.split(' ').slice(1).join(' ') : 'Anywhere'}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {byGroup.length === 0 && <p className="py-8 text-center text-sm text-ink/55">No discoveries match. Tap living things in Explore mode to add them to your journal.</p>}
        </>
      )}
      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4" onClick={() => setOpen(null)}>
          <div className="dd-species-card w-[min(92vw,380px)] overflow-hidden rounded-[28px]" onClick={(e) => e.stopPropagation()} style={{ ['--role' as string]: ROLE_META[roleOf(open)].color }}>
            <div className="dd-species-hero grid place-items-center pb-2 pt-4"><AssetThumb id={open.id} emoji={open.emoji} size={150} /></div>
            <div className="space-y-2 p-4">
              <div className="font-display text-2xl font-bold leading-tight">{open.name}</div>
              {open.info.scientific && <div className="-mt-1 text-sm italic text-ink/60">{open.info.scientific}</div>}
              <div className="flex flex-wrap gap-1"><Chip color={ROLE_META[roleOf(open)].color}>{ROLE_META[roleOf(open)].emoji} {ROLE_META[roleOf(open)].label}</Chip>{open.info.status && <Chip color={statusColor(open.info.status)}>{open.info.status}</Chip>}</div>
              <p className="text-sm leading-relaxed text-ink/80">💡 {open.info.fact ?? open.info.blurb}</p>
              {open.category === 'animals' && !!open.info.eats?.length && <p className="text-[13px] text-ink/70"><b className="text-ink/85">🍽️ Eats:</b> {dietText(open)}</p>}
              <div className="text-xs text-ink/55">{[open.info.kingdom, open.info.phylum, open.info.class, open.info.order, open.info.family].filter(Boolean).join(' › ')}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
