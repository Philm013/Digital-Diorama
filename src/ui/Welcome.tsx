import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FolderOpen, Trash2, Upload, Sparkles, Play, BookOpen, Compass, Hammer, Blocks, Trophy } from 'lucide-react';
import { clsx } from 'clsx';
import { BIOMES } from '../biomes/templates';
import type { BiomeTemplate } from '../biomes/types';
import { deleteProject, exportProject, importProjectFile, listProjects, loadProject, saveSettings, type ProjectMeta, type Settings } from '../storage/projects';
import type { DioramaDoc } from '../engine/types';
import { newDoc } from '../biomes/factory';
import { CATALOG } from '../assets/catalog';
import { biomeThumb } from './thumbs';
import { Btn, Modal, Segmented } from './common';
import { RangerCard, Journal } from './game/Journal';
import { Stars } from './game/Hud';
import { useProfile } from './game/useGame';
import { BADGES, updateProfile } from '../game/progress';
import { uiSound } from './feedback';

const LIVING = CATALOG.filter((d) => d.living !== false && d.category !== 'habitats');

export function Welcome({ settings, setSettings, onOpen }: { settings: Settings; setSettings: (s: Settings) => void; onOpen: (doc: DioramaDoc) => void }) {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [pick, setPick] = useState<BiomeTemplate | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [journal, setJournal] = useState<null | 'species' | 'badges'>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const biomesRef = useRef<HTMLElement>(null);
  const profile = useProfile();
  useEffect(() => { void listProjects().then(setProjects); }, []);
  const last = projects[0];
  const perBiome = useMemo(() => Object.fromEntries(BIOMES.map((b) => {
    const all = LIVING.filter((d) => d.biomes.includes(b.id));
    return [b.id, [all.filter((d) => profile.discovered.includes(d.id)).length, all.length]];
  })), [profile.discovered]);

  const start = () => {
    if (!pick) return;
    uiSound('pop');
    const author = (settings.author || profile.name).trim();
    const doc = newDoc(pick, settings.quality, { title: title.trim() || pick.name, author });
    setPick(null);
    onOpen(doc);
  };
  const updateSettings = (s: Settings) => { setSettings(s); saveSettings(s); };
  const open = async (id: string) => { uiSound('pop'); const d = await loadProject(id); if (d) onOpen(d); };

  return (
    <div className="dd-welcome h-full overflow-y-auto overflow-x-hidden">
      {/* ---------------- title screen ---------------- */}
      <header className="dd-title-sky relative overflow-hidden">
        {[[8, 6, 110, 38], [62, 3, 150, 46], [30, 14, 90, 30], [85, 18, 120, 36]].map(([top, delay, w, dur], i) => (
          <span key={i} className="dd-cloud" style={{ top: `${top}%`, width: w, height: w * 0.32, animationDuration: `${dur * 2}s`, animationDelay: `-${delay * 7}s` }} />
        ))}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-cover bg-bottom opacity-95" style={{ backgroundImage: `url(${biomeThumb('meadow', 1600, 420)})`, maskImage: 'linear-gradient(to bottom, transparent, black 35%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 35%)' }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[#f4ecdc]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-6 px-4 pb-14 pt-8 sm:px-8 sm:pt-12 lg:grid-cols-[1.25fr_1fr] [&>*]:min-w-0">
          <div className="text-center lg:text-left">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-kraft-dark shadow-sm ring-1 ring-black/5">📦 The shoebox diorama, reimagined</div>
            <h1 className="dd-logo font-display text-[44px] font-bold leading-[0.95] text-ink sm:text-7xl">Digital<br className="hidden sm:block" /> Diorama</h1>
            <p className="mx-auto mt-4 max-w-xl text-base font-semibold text-ink/75 sm:text-lg lg:mx-0">Build a living 3D habitat, discover real species, keep its ecosystem healthy — then bring it to life with code.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5 lg:justify-start">
              {last && (
                <button onClick={() => void open(last.id)} className="dd-cta flex h-14 items-center gap-2.5 rounded-2xl px-5 text-left font-display text-white transition-transform">
                  <Play size={22} fill="currentColor" />
                  <span className="leading-tight"><span className="block text-[11px] font-bold uppercase tracking-widest text-white/80">Continue</span><span className="block max-w-[200px] truncate text-lg font-bold">{last.title}</span></span>
                </button>
              )}
              <button onClick={() => { biomesRef.current?.scrollIntoView({ behavior: 'smooth' }); uiSound('tick'); }} className={clsx('dd-3d flex h-14 items-center gap-2 rounded-2xl px-5 font-display text-lg font-bold', last ? 'bg-white text-ink [--edge:rgba(0,0,0,.18)]' : 'dd-cta text-white')}>
                <Sparkles size={20} /> New expedition
              </button>
              <button onClick={() => setJournal('species')} className="dd-3d flex h-14 items-center gap-2 rounded-2xl bg-[#3d85c6] px-5 font-display text-lg font-bold text-white [--edge:#255a8c]">
                <BookOpen size={20} /> Journal
              </button>
            </div>
            <div className="mx-auto mt-5 grid max-w-xl grid-cols-2 gap-2 text-left sm:grid-cols-4 lg:mx-0">
              {[[<Hammer size={16} key="b" />, 'Build', `${CATALOG.length}+ species & things`], [<Compass size={16} key="e" />, 'Discover', 'Tap to collect species'], [<Blocks size={16} key="c" />, 'Code', 'Scratch-style blocks'], [<Trophy size={16} key="q" />, 'Quests', 'Stars, XP & badges']].map(([icon, h, t]) => (
                <div key={h as string} className="rounded-2xl bg-white/75 p-2.5 ring-1 ring-black/5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 font-display text-sm font-semibold text-leaf">{icon}{h}</div>
                  <div className="mt-0.5 text-[11.5px] leading-snug text-ink/70">{t}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mx-auto w-full max-w-md">
            <RangerCard dark onOpenJournal={() => setJournal('species')} />
            <button onClick={() => setJournal('badges')} className="dd-card-dark mt-3 flex w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-[22px] p-2.5" title="Badges">
              {BADGES.slice(0, 7).map((b) => {
                const got = profile.badges.includes(b.id);
                return <span key={b.id} className={clsx('dd-medal-badge grid h-9 w-9 shrink-0 place-items-center rounded-full text-base', !got && 'grayscale opacity-30')} style={{ ['--b' as string]: b.color, boxShadow: 'none' }}>{b.emoji}</span>;
              })}
              <span className="ml-auto pr-1 font-display text-xs font-bold text-white/70">{profile.badges.length}/{BADGES.length} →</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-8">
        <section ref={biomesRef} className="scroll-mt-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold sm:text-3xl">Choose your expedition</h2>
              <p className="text-sm text-ink/60">Every habitat has its own species to discover and quests to complete.</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-ink/60">Graphics</span>
              <Segmented size="sm" value={settings.quality} onChange={(q) => updateSettings({ ...settings, quality: q })}
                options={[{ value: 'low', label: 'Fast', title: 'Best for phones & Chromebooks' }, { value: 'medium', label: 'Balanced' }, { value: 'high', label: 'Detailed', title: 'For fast computers' }]} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {BIOMES.map((b) => {
              const [found, total] = perBiome[b.id] ?? [0, 0];
              const stars = profile.biomeStars[b.id] ?? 0;
              const fresh = b.id !== 'blank' && !profile.biomesBuilt.includes(b.id);
              return (
                <button key={b.id} onClick={() => { setPick(b); setTitle(''); uiSound('open'); }} className="dd-card dd-level-card group flex flex-col justify-start overflow-hidden text-left">
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <img src={biomeThumb(b.env.backdrop ?? 'meadow')} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute bottom-0 left-0 right-0 h-3" style={{ background: 'repeating-linear-gradient(90deg,#6b4a2c 0 18px,#7d5734 18px 30px,#5a3d24 30px 44px)' }} />
                    <span className="absolute left-3 top-3 grid h-11 w-11 place-items-center rounded-2xl bg-white/95 text-2xl shadow-md transition-transform group-hover:scale-110 group-hover:-rotate-6">{b.emoji}</span>
                    {fresh && <span className="dd-ribbon absolute right-3 top-3 rounded-full px-2 py-0.5 font-display text-[10.5px] font-bold uppercase tracking-wider">New</span>}
                    {stars > 0 && <span className="absolute bottom-4 right-3 rounded-full bg-black/45 px-2 py-0.5 backdrop-blur-sm"><Stars n={stars} size={13} /></span>}
                  </div>
                  <div className="flex flex-1 flex-col p-3.5">
                    <div className="font-display text-lg font-bold" style={{ color: b.accent }}>{b.name}</div>
                    <div className="mt-0.5 flex-1 text-[13px] leading-snug text-ink/70">{b.tagline}</div>
                    {total > 0 && (
                      <div className="mt-2.5">
                        <div className="flex justify-between text-[11px] font-bold text-ink/50"><span>📖 Species found</span><span className="tabular-nums">{found}/{total}</span></div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.07]"><div className="h-full rounded-full transition-all" style={{ width: `${(found / total) * 100}%`, background: b.accent }} /></div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">My dioramas</h2>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept=".json,.diorama.json,application/json" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try { onOpen(await importProjectFile(f)); } catch (err) { setError((err as Error).message); }
              }} />
              <Btn onClick={() => fileRef.current?.click()}><Upload size={16} /> Open a file</Btn>
            </div>
          </div>
          {error && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}
          {projects.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-black/10 p-8 text-center text-ink/60">Your saved dioramas will appear here. Everything saves automatically on this device.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
              {projects.map((p) => (
                <div key={p.id} className="dd-card dd-level-card overflow-hidden">
                  <button className="block w-full text-left" onClick={() => void open(p.id)}>
                    <div className="relative aspect-[16/10] bg-kraft/30">
                      {p.thumb ? <img src={p.thumb} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-4xl">{BIOMES.find((b) => b.id === p.biome)?.emoji ?? '📦'}</div>}
                      <span className="absolute bottom-2 right-2 rounded-full bg-black/45 px-2 py-0.5 backdrop-blur-sm"><Stars n={profile.projectStars[p.id] ?? 0} size={12} /></span>
                    </div>
                    <div className="px-3.5 pt-3">
                      <div className="truncate font-display font-bold">{p.title}</div>
                      <div className="text-xs text-ink/60">{p.author ? `${p.author} · ` : ''}{p.actors} things · {new Date(p.updated).toLocaleDateString()}</div>
                    </div>
                  </button>
                  <div className="flex gap-1 p-2.5">
                    <Btn size="sm" onClick={() => void open(p.id)}><FolderOpen size={14} /> Open</Btn>
                    <Btn size="sm" variant="ghost" title="Download a copy" onClick={async () => { const d = await loadProject(p.id); if (d) exportProject(d); }}><Download size={14} /></Btn>
                    <Btn size="sm" variant="ghost" title="Delete" onClick={async () => { if (confirm(`Delete “${p.title}”? This cannot be undone.`)) { await deleteProject(p.id); setProjects(await listProjects()); } }}><Trash2 size={14} /></Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-14 text-center text-xs text-ink/50">
          Procedural three.js plants and animals · No accounts, no tracking — projects and progress stay on this device.
        </footer>
      </main>

      <Modal open={!!pick} onClose={() => setPick(null)} title={<span>{pick?.emoji} {pick?.name} expedition</span>}>
        {pick && (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-3xl">
              <img src={biomeThumb(pick.env.backdrop ?? 'meadow', 640, 300)} alt="" className="w-full" />
              <div className="absolute bottom-2 left-2 flex gap-1.5">
                <span className="rounded-full bg-black/50 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">📖 {perBiome[pick.id]?.[0] ?? 0}/{perBiome[pick.id]?.[1] ?? 0} species found</span>
                <span className="rounded-full bg-black/50 px-2.5 py-1 backdrop-blur-sm"><Stars n={profile.biomeStars[pick.id] ?? 0} size={12} /></span>
              </div>
            </div>
            <p className="text-sm text-ink/75">{pick.guide.summary}</p>
            <label className="block">
              <span className="text-[13px] font-semibold text-ink/70">Diorama title</span>
              <input className="dd-input mt-1 h-11" value={title} placeholder={pick.name} onChange={(e) => setTitle(e.target.value)} maxLength={40} autoFocus />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-ink/70">Made by (optional)</span>
              <input className="dd-input mt-1 h-11" value={settings.author || profile.name} placeholder="Your name or team" onChange={(e) => { updateSettings({ ...settings, author: e.target.value }); if (!profile.name) updateProfile({ name: e.target.value.slice(0, 24) }); }} maxLength={40} />
            </label>
            <button onClick={start} className="dd-cta flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-display text-xl font-bold text-white"><Sparkles size={22} /> Start expedition!</button>
          </div>
        )}
      </Modal>
      <Modal open={!!journal} onClose={() => setJournal(null)} title="📖 Field journal" wide>
        {journal && <Journal initialTab={journal} />}
      </Modal>
    </div>
  );
}
