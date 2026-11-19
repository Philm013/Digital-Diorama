import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, Blocks, Boxes, Compass, Hammer, House, Map as MapIcon, Play, Settings2, Sparkles, Trophy, Upload } from 'lucide-react';
import { clsx } from 'clsx';
import { BIOMES, BIOME_BY_ID } from '../biomes/templates';
import { importProjectFile, listProjects, loadProject, saveSettings, type ProjectMeta, type Settings } from '../storage/projects';
import type { DioramaDoc } from '../engine/types';
import { CATALOG } from '../assets/catalog';
import { BADGES, updateProfile, type Profile } from '../game/progress';
import { Btn, IconBtn, Modal, Segmented, Toggle } from './common';
import { RangerCard, Journal } from './game/Journal';
import { Stars, XpChip } from './game/Hud';
import { useProfile } from './game/useGame';
import { haptic, setUiSound, uiSound } from './feedback';
import { useBiomeThumb } from './thumbs';
import { AppBar, TabBar, TopTabs, useLayout, type ShellTab } from './shell';
import { Tray, TrayHeader } from './Tray';
import { useBackLayer } from './backStack';
import { ExpeditionPicker, KRAFT_EDGE, QUALITY_OPTIONS } from './home/Expeditions';
import { DioramaLibrary, ago } from './home/Library';

const LIVING = CATALOG.filter((d) => d.living !== false && d.category !== 'habitats');

type TrayId = 'expeditions' | 'library' | 'journal';
type TabId = 'home' | TrayId;
const TABS: ShellTab<TabId>[] = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'expeditions', label: 'Expeditions', icon: MapIcon, title: 'Choose a habitat for a new diorama' },
  { id: 'library', label: 'My dioramas', icon: Boxes, title: 'Your saved dioramas' },
  { id: 'journal', label: 'Journal', icon: BookOpen, title: 'Field journal: species and badges' },
];

/**
 * The home screen, laid out like a phone app: a top bar, the home itself in the middle (pick up
 * where you left off, your ranger profile), and a bottom tab bar. Expeditions, My dioramas and
 * the Journal are trays that pull out over the home to browse and load from, rather than long
 * lists to scroll through. On wide screens (and phones held sideways) the tabs sit in the top bar.
 */
export function Welcome({ settings, setSettings, onOpen }: { settings: Settings; setSettings: (s: Settings) => void; onOpen: (doc: DioramaDoc) => void }) {
  const { wide, landscape, phone } = useLayout();
  const profile = useProfile();
  const [projects, setProjects] = useState<ProjectMeta[] | null>(null);
  const [tray, setTray] = useState<TrayId | null>(null);
  // the tray keeps showing what it held while it slides away
  const [shownTray, setShownTray] = useState<TrayId>('expeditions');
  if (tray && tray !== shownTray) setShownTray(tray);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = useCallback(async () => { setProjects(await listProjects()); }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { setUiSound(settings.sound); }, [settings.sound]);
  const trayOnTop = useBackLayer(tray !== null, () => setTray(null));

  const updateSettings = (s: Settings) => { setSettings(s); saveSettings(s); };
  const go = (id: TabId) => {
    // tapping the open tray's tab again puts it away
    const next = id === 'home' || id === tray ? null : id;
    if (next !== tray) { uiSound(next && !tray ? 'open' : 'tab'); haptic(6); }
    setTray(next);
  };
  const openProject = async (id: string) => { uiSound('pop'); const d = await loadProject(id); if (d) onOpen(d); };
  const found = profile.discovered.filter((id) => LIVING.some((d) => d.id === id)).length;
  const explored = profile.biomesBuilt.length;

  const header = {
    expeditions: <TrayHeader id="dd-tray-title" onClose={() => go('home')} icon="🧭" accent="#2fae4b" title="Choose your expedition"
      subtitle={`${BIOMES.length - 1} habitats & a blank box${explored ? ` · ${explored} explored` : ''}`} />,
    library: <TrayHeader id="dd-tray-title" onClose={() => go('home')} icon="🗂️" accent="#3d85c6" title="My dioramas"
      subtitle={projects ? (projects.length === 1 ? '1 saved on this device' : `${projects.length} saved on this device`) : ' '}
      actions={<Btn size="sm" onClick={() => fileRef.current?.click()} title="Open a .diorama.json file"><Upload size={15} /> Open file</Btn>} />,
    journal: <TrayHeader id="dd-tray-title" onClose={() => go('home')} icon="📖" accent="#c98a00" title="Field journal"
      subtitle={`${found}/${LIVING.length} species · ${profile.badges.length}/${BADGES.length} badges`} />,
  }[shownTray];
  const content = {
    expeditions: <ExpeditionPicker settings={settings} updateSettings={updateSettings} onStart={onOpen} active={tray === 'expeditions'} />,
    library: <DioramaLibrary projects={projects} onOpenProject={(id) => void openProject(id)} onChanged={() => void refresh()} onNew={() => go('expeditions')} onImport={() => fileRef.current?.click()} error={error} />,
    journal: <div className="absolute inset-0 overflow-y-auto overscroll-contain px-3 pb-[var(--tray-pb)] pt-1 sm:px-5"><Journal /></div>,
  }[shownTray];

  return (
    <div className="flex h-full flex-col bg-[#16211b]">
      <AppBar tall={wide}>
        <button type="button" onClick={() => go('home')} className="flex min-w-0 items-center gap-2 rounded-xl py-1 pl-1 pr-2 transition hover:bg-white/10" aria-label="Digital Diorama home">
          <img src="./favicon.svg" alt="" className="h-9 w-9 shrink-0 rounded-[11px] bg-white/10 p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]" />
          {!landscape && <span className={clsx('truncate font-display font-bold text-white', wide ? 'text-xl' : 'text-[17px]')}>Digital Diorama</span>}
        </button>
        {!phone && <TopTabs tabs={TABS} active={tray ?? 'home'} onSelect={go} compact={landscape} width={136} compactWidth={104} />}
        <div className="flex-1" />
        <XpChip profile={profile} compact={!wide} onClick={() => go('journal')} />
        <IconBtn label="Settings" onClick={() => setSettingsOpen(true)} className="text-white hover:bg-white/10"><Settings2 size={20} /></IconBtn>
      </AppBar>

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain" inert={tray !== null}>
          <HomeCore projects={projects} profile={profile} wide={wide} landscape={landscape} onTab={go} onContinue={(id) => void openProject(id)} />
        </div>
        <Tray open={tray !== null} onClose={() => go('home')} isTop={trayOnTop} labelId="dd-tray-title" header={header}
          className={wide ? 'h-[min(82%,780px)] max-w-[1180px] [--tray-pb:max(env(safe-area-inset-bottom),20px)]' : landscape ? 'top-1.5 [--tray-pb:max(env(safe-area-inset-bottom),12px)]' : 'top-2.5 [--tray-pb:16px]'}>
          <div key={shownTray} className="dd-swap absolute inset-0">{content}</div>
        </Tray>
      </main>

      {phone && <TabBar label="Main" tabs={TABS} active={tray ?? 'home'} onSelect={go} />}

      <input ref={fileRef} type="file" accept=".json,.diorama.json,application/json" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        try { setError(''); onOpen(await importProjectFile(f)); } catch (err) { setError((err as Error).message); setTray('library'); }
      }} />

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings">
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-[13px] font-semibold text-ink/70">Graphics quality</div>
            <Segmented value={settings.quality} onChange={(q) => updateSettings({ ...settings, quality: q })} options={QUALITY_OPTIONS} />
            <p className="mt-1 text-[11.5px] text-ink/50">Fast suits phones and Chromebooks; Detailed is for fast computers. Applies to dioramas you open next.</p>
          </div>
          <Toggle label="Sound effects" checked={settings.sound} onChange={(v) => updateSettings({ ...settings, sound: v })} />
          <label className="block">
            <span className="text-[13px] font-semibold text-ink/70">Made by <span className="font-normal text-ink/45">(your name or team, shown on new dioramas)</span></span>
            <input className="dd-input mt-1" value={settings.author || profile.name} placeholder="Your name or team" maxLength={40}
              onChange={(e) => { updateSettings({ ...settings, author: e.target.value }); if (!profile.name) updateProfile({ name: e.target.value.slice(0, 24) }); }} />
          </label>
          <p className="rounded-2xl bg-black/[0.03] p-3 text-[12px] leading-snug text-ink/60">Procedural three.js plants and animals · No accounts, no tracking — projects and progress stay on this device.</p>
        </div>
      </Modal>
    </div>
  );
}

/* ================================ the home itself ================================ */
function HomeCore({ projects, profile, wide, landscape, onTab, onContinue }: {
  projects: ProjectMeta[] | null; profile: Readonly<Profile>; wide: boolean; landscape: boolean; onTab: (id: TabId) => void; onContinue: (id: string) => void;
}) {
  const last = projects?.[0];
  // nothing saved yet: introduce the app and point at the first expedition
  const first = projects !== null && projects.length === 0;
  const meadow = useBiomeThumb('meadow', wide ? 1600 : 960, wide ? 420 : 320);
  return (
    <div className="dd-title-sky relative min-h-full overflow-hidden">
      {[[8, 6, 110, 38], [62, 3, 150, 46], [30, 14, 90, 30], [85, 18, 120, 36]].map(([top, delay, w, dur], i) => (
        <span key={i} className="dd-cloud" style={{ top: `${top * 0.6}%`, width: w, height: w * 0.32, animationDuration: `${dur * 2}s`, animationDelay: `-${delay * 7}s` }} />
      ))}
      {meadow && <div className="dd-thumb-in pointer-events-none absolute inset-x-0 bottom-0 h-[30%] min-h-[140px] bg-cover bg-bottom opacity-95" style={{ backgroundImage: `url(${meadow})`, maskImage: 'linear-gradient(to bottom, transparent, black 40%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 40%)' }} />}
      <div className={clsx('relative mx-auto grid min-h-full max-w-6xl content-start gap-3.5 px-4 pb-8 pt-4 sm:px-8 [&>*]:min-w-0',
        wide ? 'grid-cols-[1.2fr_1fr] content-center items-center gap-10 py-10' : landscape ? 'grid-cols-2 items-start gap-4 pt-3' : 'sm:max-w-xl sm:pt-8')}>
        <div className="flex flex-col gap-3">
          {first || wide ? <Intro big={wide} /> : <Greeting name={profile.name} />}
          {last ? <ContinueCard p={last} stars={profile.projectStars[last.id] ?? 0} onOpen={() => onContinue(last.id)} />
            : first ? <button type="button" onClick={() => onTab('expeditions')} className="dd-cta flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-6 font-display text-lg font-bold text-white lg:w-auto lg:self-start"><Sparkles size={21} /> Start your first expedition</button>
              : <div className="h-[104px] animate-pulse rounded-[24px] bg-white/45" />}
          {!first && <QuickActions count={projects?.length ?? 0} onTab={onTab} />}
          {(first || wide) && <FeatureTiles />}
        </div>
        <div className="flex flex-col gap-3">
          <RangerCard dark onOpenJournal={() => onTab('journal')} />
          {(wide || landscape) && <BadgeStrip profile={profile} onClick={() => onTab('journal')} />}
        </div>
      </div>
    </div>
  );
}

function Intro({ big }: { big: boolean }) {
  return (
    <div className={clsx('text-center', big && 'text-left')}>
      <div className="mb-2.5 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-kraft-dark shadow-sm ring-1 ring-black/5">📦 The shoebox diorama, reimagined</div>
      <h1 className={clsx('dd-logo font-display font-bold leading-[0.95] text-ink', big ? 'text-7xl' : 'text-[42px] sm:text-6xl')}>Digital{big && <br />} Diorama</h1>
      <p className={clsx('mt-3 max-w-xl font-semibold text-ink/75', big ? 'text-lg' : 'mx-auto text-[15px]')}>Build a living 3D habitat, discover real species, keep its ecosystem healthy — then bring it to life with code.</p>
    </div>
  );
}

function Greeting({ name }: { name: string }) {
  const h = new Date().getHours();
  return (
    <div className="px-0.5 pt-0.5">
      <div className="font-display text-[12px] font-bold uppercase tracking-[0.16em] text-[#1d4e7a]/70">{h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}</div>
      <h1 className="truncate font-display text-[30px] font-bold leading-tight text-ink [text-shadow:0_2px_0_rgba(255,255,255,.85)]">Hi, {name.trim() || 'Ranger'}!</h1>
      <p className="text-[14px] font-semibold text-ink/65">Pick up where you left off, or set off somewhere new.</p>
    </div>
  );
}

function ContinueCard({ p, stars, onOpen }: { p: ProjectMeta; stars: number; onOpen: () => void }) {
  const b = BIOME_BY_ID[p.biome];
  return (
    <button type="button" onClick={onOpen} className="dd-card dd-level-card group flex w-full items-center gap-3 overflow-hidden rounded-[24px] p-2.5 pr-3 text-left" aria-label={`Continue ${p.title}`}>
      <div className="relative aspect-[16/10] w-[44%] max-w-[210px] shrink-0 overflow-hidden rounded-[18px] bg-[#e9dfcc]" style={{ ['--accent' as string]: b?.accent }}>
        {p.thumb ? <img src={p.thumb} alt="" draggable={false} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="dd-thumb-ph grid h-full w-full place-items-center text-4xl">{b?.emoji ?? '📦'}</div>}
        <div className="absolute inset-x-0 bottom-0 h-[6px]" style={{ background: KRAFT_EDGE }} />
        <span className="absolute left-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-[10px] bg-white/95 text-[16px] leading-none shadow">{b?.emoji ?? '📦'}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-[#2a9a43]">Continue</div>
        <div className="truncate font-display text-[19px] font-bold leading-tight">{p.title}</div>
        <div className="mt-0.5 truncate text-[12px] text-ink/55">{b?.name ?? 'Diorama'} · {ago(p.updated)}</div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <Stars n={stars} size={13} />
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#4fd36a] to-[#2fae4b] text-white shadow-[0_3px_0_#1f7f35,0_8px_14px_-6px_rgba(31,127,53,.7)] transition-transform group-active:translate-y-0.5"><Play size={18} fill="currentColor" className="ml-0.5" /></span>
        </div>
      </div>
    </button>
  );
}

function QuickActions({ count, onTab }: { count: number; onTab: (id: TabId) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <ActionTile onClick={() => onTab('expeditions')} icon={<MapIcon size={20} />} title="New expedition" detail={`${BIOMES.length} habitats`}
        className="bg-white text-ink [--edge:rgba(0,0,0,.16)]" iconClass="bg-gradient-to-b from-[#4fd36a] to-[#2fae4b] text-white" />
      <ActionTile onClick={() => onTab('library')} icon={<Boxes size={20} />} title="My dioramas" detail={count === 1 ? '1 saved' : `${count} saved`}
        className="bg-[#3d85c6] text-white [--edge:#255a8c]" iconClass="bg-white/20 text-white" />
    </div>
  );
}
function ActionTile({ onClick, icon, title, detail, className, iconClass }: { onClick: () => void; icon: ReactNode; title: string; detail: string; className: string; iconClass: string }) {
  return (
    <button type="button" onClick={onClick} className={clsx('dd-3d flex min-w-0 items-center gap-2 rounded-[20px] p-2.5 text-left sm:gap-2.5 sm:p-3', className)}>
      <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-[14px] sm:h-10 sm:w-10', iconClass)}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate font-display text-[14.5px] font-bold leading-tight sm:text-[16px]">{title}</span>
        <span className="block truncate text-[12px] font-semibold opacity-65">{detail}</span>
      </span>
    </button>
  );
}

function FeatureTiles() {
  const rows: [ReactNode, string, string][] = [
    [<Hammer size={16} key="b" />, 'Build', `${Math.floor(CATALOG.length / 10) * 10}+ species & things`],
    [<Compass size={16} key="e" />, 'Discover', 'Tap to collect species'],
    [<Blocks size={16} key="c" />, 'Code', 'Scratch-style blocks'],
    [<Trophy size={16} key="q" />, 'Quests', 'Stars, XP & badges'],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 text-left sm:grid-cols-4">
      {rows.map(([icon, h, t]) => (
        <div key={h} className="rounded-2xl bg-white/75 p-2.5 ring-1 ring-black/5 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 font-display text-sm font-semibold text-leaf">{icon}{h}</div>
          <div className="mt-0.5 text-[11.5px] leading-snug text-ink/70">{t}</div>
        </div>
      ))}
    </div>
  );
}

function BadgeStrip({ profile, onClick }: { profile: Readonly<Profile>; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="dd-card-dark flex w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-[22px] p-2.5" title="Badges">
      {BADGES.slice(0, 7).map((b) => {
        const got = profile.badges.includes(b.id);
        return <span key={b.id} className={clsx('dd-medal-badge grid h-9 w-9 shrink-0 place-items-center rounded-full text-base', !got && 'opacity-30 grayscale')} style={{ ['--b' as string]: b.color, boxShadow: 'none' }}>{b.emoji}</span>;
      })}
      <span className="ml-auto pr-1 font-display text-xs font-bold text-white/70">{profile.badges.length}/{BADGES.length} →</span>
    </button>
  );
}
