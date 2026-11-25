import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, Blocks, Boxes, ChevronRight, Compass, GraduationCap, Hammer, House, Map as MapIcon, Play, Settings2, Sparkles, Trophy, Upload } from 'lucide-react';
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
import { ExpeditionPicker, KRAFT_EDGE, PathProgress, QUALITY_OPTIONS } from './home/Expeditions';
import { LockedNotice } from './game/Locked';
import { habitatUnlocked } from '../game/unlocks';
import { DioramaLibrary, ago } from './home/Library';
import { LearnHub } from './learn/LearnHub';
import { startLesson, useLearn } from '../learn/store';
import { LESSONS, LESSON_BY_ID, nextLesson } from '../learn/lessons';

const LIVING = CATALOG.filter((d) => d.living !== false && d.category !== 'habitats');

/** (Learn has no tab of its own: the Ranger training card opens it) */
type TrayId = 'expeditions' | 'library' | 'journal' | 'learn';
type TabId = 'home' | TrayId;
const TABS: ShellTab<Exclude<TabId, 'learn'>>[] = [
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
  // the room the home really has: what is left between the top bar and the tab bar (and any notch)
  const mainRef = useRef<HTMLElement>(null);
  const areaH = useElementHeight(mainRef);
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
  const learn = useLearn();
  const lessonsDone = LESSONS.filter((l) => learn.done.includes(l.id)).length;
  // lessons run inside a diorama: the latest one, or the expedition about to be started
  const startFromHome = (id: string, step = 0) => {
    startLesson(id, step);
    const last = projects?.[0];
    if (last) void openProject(last.id);
    else setTray('expeditions');
  };

  const header = {
    expeditions: <TrayHeader id="dd-tray-title" onClose={() => go('home')} icon="🧭" accent="#2fae4b" title="Choose your expedition"
      subtitle={`${BIOMES.filter((b) => habitatUnlocked(b.id, profile)).length} of ${BIOMES.length} habitats open${explored ? ` · ${explored} explored` : ''}`} />,
    library: <TrayHeader id="dd-tray-title" onClose={() => go('home')} icon="🗂️" accent="#3d85c6" title="My dioramas"
      subtitle={projects ? (projects.length === 1 ? '1 saved on this device' : `${projects.length} saved on this device`) : ' '}
      actions={<Btn size="sm" onClick={() => fileRef.current?.click()} title="Open a .diorama.json file"><Upload size={15} /> Open file</Btn>} />,
    journal: <TrayHeader id="dd-tray-title" onClose={() => go('home')} icon="📖" accent="#c98a00" title="Field journal"
      subtitle={`${found}/${LIVING.length} species · ${profile.badges.length}/${BADGES.length} badges`} />,
    learn: <TrayHeader id="dd-tray-title" onClose={() => go('home')} icon="🎓" accent="#c98a00" title="Learn & help"
      subtitle={`Ranger training · ${lessonsDone}/${LESSONS.length} lessons`} />,
  }[shownTray];
  const content = {
    expeditions: <ExpeditionPicker settings={settings} updateSettings={updateSettings} onStart={onOpen} active={tray === 'expeditions'} dense={landscape} />,
    library: <DioramaLibrary projects={projects} onOpenProject={(id) => void openProject(id)} onChanged={() => void refresh()} onNew={() => go('expeditions')} onImport={() => fileRef.current?.click()} error={error} />,
    journal: <div className="absolute inset-0 overflow-y-auto overscroll-contain px-3 pb-[var(--tray-pb)] pt-1 sm:px-5"><Journal /></div>,
    learn: (
      <div className="absolute inset-0 overflow-y-auto overscroll-contain px-3 pb-[var(--tray-pb)] pt-1 sm:px-5">
        <div className="mx-auto max-w-4xl">
          <LearnHub onStart={startFromHome} tips={settings.tips} onTips={(v) => updateSettings({ ...settings, tips: v })}
            note={projects?.length ? `Lessons open in your latest diorama, “${projects[0].title}”.` : 'Lessons happen inside a diorama: start an expedition and your lesson begins there.'} />
        </div>
      </div>
    ),
  }[shownTray];

  return (
    <div className="flex h-full flex-col bg-[#16211b]">
      <AppBar tall={wide}>
        <button type="button" onClick={() => go('home')} className="flex min-w-0 items-center gap-2 rounded-xl py-1 pl-1 pr-2 transition hover:bg-white/10" aria-label="Digital Diorama home">
          <img src="./favicon.svg" alt="" className="h-9 w-9 shrink-0 rounded-[11px] bg-white/10 p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]" />
          {!landscape && <span className={clsx('truncate font-display font-bold text-white', wide ? 'text-xl' : 'text-[17px]')}>Digital Diorama</span>}
        </button>
        {!phone && <TopTabs tabs={TABS} active={tray === 'learn' ? null : tray ?? 'home'} onSelect={go} compact={landscape} width={136} compactWidth={104} />}
        <div className="flex-1" />
        <XpChip profile={profile} compact={!wide} onClick={() => go('journal')} />
        <IconBtn label="Settings" onClick={() => setSettingsOpen(true)} className="text-white hover:bg-white/10"><Settings2 size={20} /></IconBtn>
      </AppBar>

      <main ref={mainRef} className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain" inert={tray !== null}>
          <HomeCore projects={projects} profile={profile} wide={wide} landscape={landscape} areaH={areaH} onTab={go} onContinue={(id) => void openProject(id)} />
        </div>
        <Tray open={tray !== null} onClose={() => go('home')} isTop={trayOnTop} labelId="dd-tray-title" header={header}
          className={wide ? 'h-[min(86%,800px)] max-w-[1180px] [--tray-pb:max(env(safe-area-inset-bottom),20px)]' : landscape ? 'top-1.5 [--tray-pb:max(env(safe-area-inset-bottom),12px)]' : 'top-2.5 [--tray-pb:16px]'}>
          <div key={shownTray} className="dd-swap absolute inset-0">{content}</div>
        </Tray>
      </main>

      {phone && <TabBar label="Main" tabs={TABS} active={tray === 'learn' ? null : tray ?? 'home'} onSelect={go} />}

      <input ref={fileRef} type="file" accept=".json,.diorama.json,application/json" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        try { setError(''); onOpen(await importProjectFile(f)); } catch (err) { setError((err as Error).message); setTray('library'); }
      }} />

      <LockedNotice />
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings">
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-[13px] font-semibold text-ink/70">Graphics quality</div>
            <Segmented value={settings.quality} onChange={(q) => updateSettings({ ...settings, quality: q })} options={QUALITY_OPTIONS} />
            <p className="mt-1 text-[11.5px] text-ink/50">Fast suits phones and Chromebooks; Detailed is for fast computers. Applies to dioramas you open next.</p>
          </div>
          <Toggle label="Sound effects" checked={settings.sound} onChange={(v) => updateSettings({ ...settings, sound: v })} />
          <div>
            <Toggle label="Tips and the guided start" checked={settings.tips} onChange={(v) => updateSettings({ ...settings, tips: v })} />
            <p className="mt-1 text-[11.5px] text-ink/50">A welcome with a guided start in new dioramas, and one-time tips in Build and Code. Every lesson stays under 🎓 Learn.</p>
          </div>
          <div>
            <Toggle label="Unlock everything (teacher mode)" checked={!!profile.unlockAll} onChange={(v) => updateProfile({ unlockAll: v })} />
            <p className="mt-1 text-[11.5px] text-ink/50">Normally habitats and tools open one step at a time as students complete expeditions (⭐⭐ on a diorama of their own). Switch this on to open every habitat, tool and example diorama on this device.</p>
          </div>
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

/** the live height of an element, so a screen can size itself to the room it actually has */
function useElementHeight(ref: React.RefObject<HTMLElement | null>) {
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setH(Math.round(el.getBoundingClientRect().height));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return h;
}

/* ================================ the home itself ================================ */
function HomeCore({ projects, profile, wide, landscape, areaH, onTab, onContinue }: {
  projects: ProjectMeta[] | null; profile: Readonly<Profile>; wide: boolean; landscape: boolean; areaH: number; onTab: (id: TabId) => void; onContinue: (id: string) => void;
}) {
  const last = projects?.[0];
  // nothing saved yet: introduce the app and point at the first expedition
  const first = projects !== null && projects.length === 0;
  const meadow = useBiomeThumb('meadow', wide ? 1600 : 960, wide ? 420 : 320);
  return (
    <div className={clsx('dd-title-sky relative overflow-hidden', wide ? 'min-h-full' : 'h-full')}>
      {[[8, 6, 110, 38], [62, 3, 150, 46], [30, 14, 90, 30], [85, 18, 120, 36]].map(([top, delay, w, dur], i) => (
        <span key={i} className="dd-cloud" style={{ top: `${top * 0.6}%`, width: w, height: w * 0.32, animationDuration: `${dur * 2}s`, animationDelay: `-${delay * 7}s` }} />
      ))}
      {meadow && <div className="dd-thumb-in pointer-events-none absolute inset-x-0 bottom-0 h-[30%] min-h-[140px] bg-cover bg-bottom opacity-95" style={{ backgroundImage: `url(${meadow})`, maskImage: 'linear-gradient(to bottom, transparent, black 40%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 40%)' }} />}
      {wide ? (
        <div className="relative mx-auto grid min-h-full max-w-6xl grid-cols-[1.2fr_1fr] content-center items-center gap-10 px-8 py-10 [&>*]:min-w-0">
          <div className="flex flex-col gap-3">
            <Intro size="lg" />
            {last ? <ContinueCard p={last} stars={profile.projectStars[last.id] ?? 0} onOpen={() => onContinue(last.id)} />
              : first ? <button type="button" onClick={() => onTab('expeditions')} className="dd-cta flex h-14 w-auto items-center justify-center gap-2 self-start whitespace-nowrap rounded-2xl px-6 font-display text-lg font-bold text-white"><Sparkles size={21} className="shrink-0" /> Start your first expedition</button>
                : <div className="h-[104px] animate-pulse rounded-[24px] bg-white/45" />}
            {!first && <QuickActions count={projects?.length ?? 0} onTab={onTab} />}
            {first ? <HowItWorks /> : <FeatureTiles />}
          </div>
          <div className="flex flex-col gap-3">
            <RangerCard dark onOpenJournal={() => onTab('journal')} />
            <PathButton onTab={onTab} />
            <TrainingCard onOpen={() => onTab('learn')} />
            <BadgeStrip profile={profile} onClick={() => onTab('journal')} />
          </div>
        </div>
      ) : (
        <PhoneHome projects={projects} profile={profile} first={first} landscape={landscape} areaH={areaH} onTab={onTab} onContinue={onContinue} />
      )}
    </div>
  );
}

/** how each part of the phone home is drawn */
interface Look {
  intro: 'md' | 'sm' | 'xs' | 'title'; how: 'full' | 'compact' | 'none'; greeting: 'full' | 'compact'; cont: 'full' | 'compact';
  ranger: 'full' | 'compact' | 'mini' | 'none'; path: 'full' | 'compact' | 'none'; training: 'full' | 'compact'; badges: boolean; tight: boolean;
  /** the quick actions' icons above their words (sideways, where the column is narrow), or beside them */
  quick: 'stacked' | 'row';
}
const UPRIGHT: Look = { intro: 'md', how: 'full', greeting: 'full', cont: 'full', ranger: 'full', path: 'full', training: 'full', badges: false, tight: false, quick: 'row' };
const SIDEWAYS: Look = { intro: 'sm', how: 'none', greeting: 'full', cont: 'full', ranger: 'compact', path: 'full', training: 'full', badges: true, tight: false, quick: 'stacked' };
// Each step makes the home a little shorter: first by drawing cards smaller, and only on the very
// smallest screens by leaving one out. Ranger training always stays: on phones it is the way in to the lessons.
const FIRST_STEPS: Partial<Look>[] = [{ how: 'compact' }, { intro: 'sm' }, { ranger: 'compact' }, { path: 'compact', training: 'compact' }, { tight: true }, { intro: 'xs' }, { ranger: 'mini' }, { intro: 'title' }, { path: 'none' }, { how: 'none' }];
const BACK_STEPS: Partial<Look>[] = [{ greeting: 'compact' }, { ranger: 'compact' }, { path: 'compact', training: 'compact' }, { tight: true }, { cont: 'compact' }, { ranger: 'mini' }, { path: 'none' }, { ranger: 'none' }];
const SIDEWAYS_STEPS: Partial<Look>[] = [{ ranger: 'mini' }, { path: 'compact', training: 'compact' }, { intro: 'xs', greeting: 'compact' }, { cont: 'compact' }, { tight: true }, { quick: 'row' }, { badges: false }, { path: 'none' }];

/**
 * The home on a phone: one screen, sized to the room between the top bar and the tab bar, with
 * nothing to scroll. Upright it is one column; held sideways, two. It starts with the fullest
 * layout and, while that is taller than the room, steps down to a more compact one before the
 * screen is painted. (If even the most compact one does not fit, on a tiny screen or with very
 * large text, the home scrolls.)
 */
function PhoneHome({ projects, profile, first, landscape, areaH, onTab, onContinue }: {
  projects: ProjectMeta[] | null; profile: Readonly<Profile>; first: boolean; landscape: boolean; areaH: number; onTab: (id: TabId) => void; onContinue: (id: string) => void;
}) {
  const last = projects?.[0];
  const steps = landscape ? SIDEWAYS_STEPS : first ? FIRST_STEPS : BACK_STEPS;
  const [fonts, setFonts] = useState(0);
  useEffect(() => { void document.fonts?.ready.then(() => setFonts(1)); }, []);
  const key = `${areaH}|${landscape}|${first}|${last?.id ?? ''}|${projects === null}|${fonts}`;
  const [fit, setFit] = useState({ key, level: 0 });
  const level = fit.key === key ? fit.level : 0;
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!outer.current || !inner.current || !areaH) return;
    if (inner.current.offsetHeight > outer.current.clientHeight && level < steps.length) setFit({ key, level: level + 1 });
  }, [key, level, steps.length, areaH]);

  const look = steps.slice(0, level).reduce<Look>((l, step) => ({ ...l, ...step }), landscape ? SIDEWAYS : UPRIGHT);
  const top = first ? <Intro size={look.intro} /> : <Greeting name={profile.name} compact={look.greeting === 'compact'} />;
  const lead = last ? <ContinueCard p={last} stars={profile.projectStars[last.id] ?? 0} onOpen={() => onContinue(last.id)} compact={look.cont === 'compact'} />
    : first ? <button type="button" onClick={() => onTab('expeditions')} className="dd-cta flex h-14 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-4 font-display text-[clamp(15px,4.6vw,18px)] font-bold text-white"><Sparkles size={21} className="shrink-0" /> Start your first expedition</button>
      : <div className="h-[104px] animate-pulse rounded-[24px] bg-white/45" />;
  const quick = !first && <QuickActions count={projects?.length ?? 0} onTab={onTab} stacked={look.quick === 'stacked'} />;
  const how = look.how !== 'none' && <HowItWorks compact={look.how === 'compact'} />;
  const ranger = look.ranger !== 'none' && <RangerCard dark onOpenJournal={() => onTab('journal')} size={look.ranger} />;
  const path = look.path !== 'none' && <PathButton onTab={onTab} compact={look.path === 'compact'} />;
  const training = <TrainingCard onOpen={() => onTab('learn')} compact={look.training === 'compact'} />;
  const badges = look.badges && <BadgeStrip profile={profile} onClick={() => onTab('journal')} />;
  const gap = look.tight ? 'gap-2' : landscape ? 'gap-3' : 'gap-2.5';
  return (
    <div ref={outer} className={clsx('relative mx-auto flex h-full flex-col overflow-y-auto overscroll-contain px-4', landscape ? 'max-w-6xl' : 'max-w-xl sm:px-8')} data-fit={level}>
      {/* (margins rather than justify-center: if it ever overflows, its top stays reachable) */}
      {landscape ? (
        <div ref={inner} className={clsx('my-auto grid grid-cols-2 items-center [&>*]:min-w-0', gap, look.tight ? 'py-2' : 'py-2.5')}>
          <div className={clsx('flex flex-col', gap)}>{top}{lead}{quick}</div>
          <div className={clsx('flex flex-col', gap)}>{ranger}{path}{training}{badges}</div>
        </div>
      ) : (
        <div ref={inner} className={clsx('my-auto flex flex-col [&>*]:min-w-0 [&>*]:shrink-0', gap, look.tight ? 'py-2' : 'py-3')}>
          {top}{lead}{first ? <>{how}{ranger}{path}{training}</> : <>{quick}{training}{ranger}{path}</>}
        </div>
      )}
    </div>
  );
}

function PathButton({ onTab, compact }: { onTab: (id: TabId) => void; compact?: boolean }) {
  return <button type="button" onClick={() => onTab('expeditions')} className="block w-full rounded-[20px] text-left transition active:scale-[0.99]" aria-label="Ranger path: see your expeditions"><PathProgress dark compact={compact} /></button>;
}

/** `title` (the smallest phones) is just the name: How it works says the rest */
function Intro({ size }: { size: 'title' | 'xs' | 'sm' | 'md' | 'lg' }) {
  const big = size === 'lg';
  return (
    <div className={clsx('text-center', big && 'text-left')}>
      {size !== 'xs' && size !== 'title' && <div className="mb-2.5 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-kraft-dark shadow-sm ring-1 ring-black/5">📦 The shoebox diorama, reimagined</div>}
      <h1 className={clsx('dd-logo font-display font-bold leading-[0.95] text-ink', big ? 'text-7xl' : size === 'sm' ? 'text-[34px]' : size === 'xs' || size === 'title' ? 'text-[32px]' : 'text-[42px] sm:text-6xl')}>Digital{big && <br />} Diorama</h1>
      {size !== 'title' && <p className={clsx('max-w-xl font-semibold text-ink/75', big ? 'mt-3 text-lg' : size === 'sm' || size === 'xs' ? 'mx-auto mt-1.5 text-[13.5px] leading-snug' : 'mx-auto mt-3 text-[15px]')}>{size === 'xs' || size === 'sm' ? 'Build living 3D habitats, discover real species and unlock more with every expedition.' : 'Build living 3D habitats from the ground up, discover real species and keep their ecosystems healthy. Every expedition you complete unlocks new habitats and tools.'}</p>}
    </div>
  );
}

function Greeting({ name, compact }: { name: string; compact?: boolean }) {
  const h = new Date().getHours();
  return (
    <div className="px-0.5 pt-0.5">
      <div className="font-display text-[12px] font-bold uppercase tracking-[0.16em] text-[#1d4e7a]/70">{h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}</div>
      <h1 className={clsx('truncate font-display font-bold leading-tight text-ink', compact ? 'text-[26px]' : 'text-[30px]')} style={{ textShadow: '0 2px 0 rgba(255,255,255,.85)' }}>Hi, {name.trim() || 'Ranger'}!</h1>
      {!compact && <p className="text-[14px] font-semibold text-ink/65">Pick up where you left off, or set off somewhere new.</p>}
    </div>
  );
}

function ContinueCard({ p, stars, onOpen, compact }: { p: ProjectMeta; stars: number; onOpen: () => void; compact?: boolean }) {
  const b = BIOME_BY_ID[p.biome];
  return (
    <button type="button" onClick={onOpen} className={clsx('dd-card dd-level-card group flex w-full items-center gap-3 overflow-hidden rounded-[24px] pr-3 text-left', compact ? 'p-2' : 'p-2.5')} aria-label={`Continue ${p.title}`}>
      <div className={clsx('relative aspect-[16/10] max-w-[210px] shrink-0 overflow-hidden rounded-[18px] bg-[#e9dfcc]', compact ? 'w-[34%]' : 'w-[38%] min-[360px]:w-[44%]')} style={{ ['--accent' as string]: b?.accent }}>
        {p.thumb ? <img src={p.thumb} alt="" draggable={false} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="dd-thumb-ph grid h-full w-full place-items-center text-4xl">{b?.emoji ?? '📦'}</div>}
        <div className="absolute inset-x-0 bottom-0 h-[6px]" style={{ background: KRAFT_EDGE }} />
        <span className="absolute left-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-[10px] bg-white/95 text-[16px] leading-none shadow">{b?.emoji ?? '📦'}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-[#2a9a43]">Continue</div>
        <div className={clsx('font-display text-[clamp(16px,4.9vw,19px)] font-bold leading-tight', compact ? 'truncate' : 'line-clamp-2')}>{p.title}</div>
        <div className="mt-0.5 truncate text-[12px] text-ink/55">{b?.name ?? 'Diorama'} · {ago(p.updated)}</div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <Stars n={stars} size={13} />
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#4fd36a] to-[#2fae4b] text-white shadow-[0_3px_0_#1f7f35,0_8px_14px_-6px_rgba(31,127,53,.7)] transition-transform group-active:translate-y-0.5"><Play size={18} fill="currentColor" className="ml-0.5" /></span>
        </div>
      </div>
    </button>
  );
}

/** `stacked` puts each icon above its words, for a column too narrow for them side by side */
function QuickActions({ count, onTab, stacked }: { count: number; onTab: (id: TabId) => void; stacked?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <ActionTile onClick={() => onTab('expeditions')} icon={<MapIcon size={20} />} title="New expedition" detail={`${BIOMES.filter((b) => habitatUnlocked(b.id)).length} habitats open`} stacked={stacked}
        className="bg-white text-ink [--edge:rgba(0,0,0,.16)]" iconClass="bg-gradient-to-b from-[#4fd36a] to-[#2fae4b] text-white" />
      <ActionTile onClick={() => onTab('library')} icon={<Boxes size={20} />} title="My dioramas" detail={count === 1 ? '1 saved' : `${count} saved`} stacked={stacked}
        className="bg-[#3d85c6] text-white [--edge:#255a8c]" iconClass="bg-white/20 text-white" />
    </div>
  );
}
function ActionTile({ onClick, icon, title, detail, className, iconClass, stacked }: { onClick: () => void; icon: ReactNode; title: string; detail: string; className: string; iconClass: string; stacked?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={clsx('dd-3d flex min-w-0 flex-col items-start gap-1.5 rounded-[20px] p-2.5 text-left', !stacked && 'min-[360px]:flex-row min-[360px]:items-center min-[360px]:gap-2 sm:gap-2.5 sm:p-3', className)}>
      <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-[14px] sm:h-10 sm:w-10', iconClass)}>{icon}</span>
      <span className="min-w-0 max-w-full">
        <span className="block truncate font-display text-[clamp(13px,3.7vw,14.5px)] font-bold leading-tight sm:text-[16px]">{title}</span>
        <span className="block truncate text-[12px] font-semibold opacity-65">{detail}</span>
      </span>
    </button>
  );
}

/** first-timers: the whole idea in three steps */
function HowItWorks({ compact }: { compact?: boolean }) {
  const steps: [string, string, string][] = [
    ['🗺️', 'Pick a habitat', 'Start an expedition: the Backyard, a Forest or the Prairie.'],
    ['🌱', 'Bring it to life', 'Add plants, animals and decomposers, and keep the heart healthy.'],
    ['⭐', 'Earn ⭐⭐, unlock more', '10 quests complete an expedition and open new habitats and tools.'],
  ];
  if (compact) {
    // short screens: the three steps as a single row of chips
    return (
      <div>
        <div className="px-0.5 font-display text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#1d4e7a]/70">How it works</div>
        <ol className="mt-1.5 grid grid-cols-3 gap-2">
          {steps.map(([e, h], i) => (
            <li key={h} className="flex flex-col items-center gap-1 rounded-2xl bg-white/80 px-1 py-2 text-center ring-1 ring-black/5 backdrop-blur-sm">
              <span className="relative grid h-9 w-9 place-items-center rounded-[12px] bg-amber-50 text-[20px] leading-none ring-1 ring-amber-200">{e}<span className="absolute -left-1.5 -top-1.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-[#2fae4b] font-display text-[10.5px] font-bold text-white">{i + 1}</span></span>
              <span className="font-display text-[12px] font-bold leading-tight text-ink">{h}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  return (
    <div className="rounded-[22px] bg-white/80 p-3 ring-1 ring-black/5 backdrop-blur-sm">
      <div className="px-0.5 font-display text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#1d4e7a]/70">How it works</div>
      <ol className="mt-2 grid gap-2 sm:grid-cols-3">
        {steps.map(([e, h, t], i) => (
          <li key={h} className="flex items-start gap-2.5 rounded-2xl bg-white/80 p-2.5 ring-1 ring-black/5 sm:flex-col sm:gap-1.5">
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-amber-50 text-[20px] leading-none ring-1 ring-amber-200">{e}<span className="absolute -left-1.5 -top-1.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-[#2fae4b] font-display text-[10.5px] font-bold text-white">{i + 1}</span></span>
            <span className="min-w-0"><span className="block font-display text-[14px] font-bold leading-tight text-ink">{h}</span><span className="block text-[12px] leading-snug text-ink/65">{t}</span></span>
          </li>
        ))}
      </ol>
      <p className="mt-2 flex items-center gap-1.5 px-0.5 text-[12px] font-semibold text-ink/60"><GraduationCap size={15} className="shrink-0 text-amber-600" /> A ranger guide shows you around when you start.</p>
    </div>
  );
}

/** Ranger training on the home screen: how far through the lessons, and the next one. `compact` (short phone
 * screens) has a smaller badge and no progress bar or arrow, and keeps the lesson count. */
function TrainingCard({ onOpen, compact }: { onOpen: () => void; compact?: boolean }) {
  const learn = useLearn();
  const profile = useProfile();
  const done = LESSONS.filter((l) => learn.done.includes(l.id)).length;
  const resume = learn.active ?? learn.paused;
  const resumeLesson = resume ? LESSON_BY_ID[resume.id] : null;
  const next = resumeLesson ?? nextLesson(learn.done, undefined, profile);
  return (
    <button type="button" onClick={() => { uiSound('open'); onOpen(); }} className={clsx('dd-card-dark flex w-full min-w-0 items-center gap-3 rounded-[20px] pr-3 text-left text-white transition active:scale-[0.99]', compact ? 'p-2' : 'p-2.5')} aria-label="Ranger training: lessons and help">
      <span className={clsx('grid shrink-0 place-items-center bg-gradient-to-b from-[#ffe680] to-[#ffbf2e] text-[#3d2a00] shadow-[0_3px_0_#c98a00]', compact ? 'h-9 w-9 rounded-[12px]' : 'h-11 w-11 rounded-[14px]')}><GraduationCap size={compact ? 20 : 24} /></span>
      <span className="min-w-0 flex-1">
        <span className={clsx('block truncate font-display text-[11px] font-bold uppercase text-amber-300', compact ? 'tracking-[0.06em]' : 'tracking-[0.14em]')}>Ranger training · {done}/{LESSONS.length} lessons</span>
        <span className="block truncate font-display text-[15px] font-bold leading-tight">{next ? `${resumeLesson ? 'Carry on' : done ? 'Next' : 'Start'}: ${next.emoji} ${next.title}` : '🎉 Every open lesson done'}</span>
        {!compact && <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-gradient-to-r from-[#ffe066] to-[#ffb020] transition-all duration-700" style={{ width: `${(done / LESSONS.length) * 100}%` }} /></span>}
      </span>
      {!compact && <ChevronRight size={20} className="shrink-0 text-white/50" />}
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
    <button type="button" onClick={onClick} className="dd-card-dark flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-[22px] p-2.5" title="Badges">
      {/* (on a narrow column the badges that do not fit fade out; the count always shows) */}
      <span className="flex min-w-0 flex-1 gap-1.5 overflow-hidden [mask-image:linear-gradient(to_right,black_82%,transparent)]">
        {BADGES.slice(0, 7).map((b) => {
          const got = profile.badges.includes(b.id);
          return <span key={b.id} className={clsx('dd-medal-badge grid h-9 w-9 shrink-0 place-items-center rounded-full text-base', !got && 'opacity-30 grayscale')} style={{ ['--b' as string]: b.color, boxShadow: 'none' }}>{b.emoji}</span>;
        })}
      </span>
      <span className="shrink-0 pr-1 font-display text-xs font-bold text-white/70">{profile.badges.length}/{BADGES.length} →</span>
    </button>
  );
}
