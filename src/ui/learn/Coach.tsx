import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { clsx } from 'clsx';
import { Check, ChevronLeft, ChevronRight, GraduationCap, MousePointer2, Pointer, X } from 'lucide-react';
import type { Mode } from '../../engine/types';
import type { Engine } from '../../engine/Engine';
import { useStudio } from '../store';
import { useMedia } from '../hooks';
import { useBackLayer } from '../backStack';
import type { GameState } from '../game/useGame';
import { confetti } from '../game/Celebrate';
import { haptic, uiSound } from '../feedback';
import { audio, playSound } from '../../code/sound';
import { onProgress } from '../../game/progress';
import { LESSONS, LESSON_BY_ID, UNITS, nextLesson, snapshot, textOf, type Gesture, type LearnCtx, type Lesson, type Snapshot, type Target } from '../../learn/lessons';
import { finishLesson, hasSeen, markSeen, pauseLesson, setLessonStep, setWelcomed, startLesson, useLearn } from '../../learn/store';
import { onLearnSignal } from '../../learn/signals';
import { placeCard, type Box } from './place';

const MODE_NAME: Record<Mode, string> = { explore: '🧭 Explore', build: '🔨 Build', code: '🧩 Code' };
/** one-time tips a lesson makes unnecessary */
const TIPS_OF: Record<string, string[]> = { add: ['tip-build', 'tip-empty'], edit: ['tip-build'], code: ['tip-code'] };
/** the first lessons, offered by the welcome */
const FIRST_STEPS = LESSONS.filter((l) => l.unit === UNITS[0].id);

/* =============================== finding what to point at =============================== */
type Probe = 'shown' | 'clipped' | 'hidden';
/** on screen and not hidden under something else (a dialog, a sheet), or scrolled out of its panel */
function probe(el: HTMLElement): Probe {
  if (!el.isConnected) return 'hidden';
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return 'hidden';
  const cv = (el as HTMLElement & { checkVisibility?: (o: object) => boolean }).checkVisibility;
  if (cv && !cv.call(el, { opacityProperty: true, visibilityProperty: true, checkOpacity: true, checkVisibilityCSS: true })) return 'hidden';
  // off the screen inside a row or panel that scrolls (the Explore bar on a phone): it can be scrolled into view
  if (r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) return el.parentElement?.closest('.overflow-x-auto, .overflow-y-auto, .overflow-auto, .dd-scroll-x') ? 'clipped' : 'hidden';
  // look at points across the part of it that is on screen (a tall journal runs off the bottom)
  const x0 = Math.max(0, r.left), x1 = Math.min(innerWidth - 1, r.right), y0 = Math.max(0, r.top), y1 = Math.min(innerHeight - 1, r.bottom);
  let clipped = false;
  for (const [fx, fy] of [[0.5, 0.5], [0.2, 0.5], [0.8, 0.5], [0.5, 0.2], [0.5, 0.8]]) {
    const x = x0 + (x1 - x0) * fx, y = y0 + (y1 - y0) * fy;
    const hit = document.elementFromPoint(x, y);
    if (!hit || el.contains(hit) || hit.closest('[data-coach]')) return 'shown';
    if (hit.contains(el)) clipped = true;
  }
  return clipped ? 'clipped' : 'hidden';
}
/** the first element with this `data-tour` name that can be seen */
export function findShown(tour: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${tour}"]`)) if (probe(el) === 'shown') return el;
  return null;
}

/** a target as the coach uses it: `force` shows its hint even as the first choice (switch modes first) */
type Aim = Target & { force?: boolean; mode?: Mode };
const box = (r: DOMRect): Box => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
/** the part of `a` inside `b` (null when they don't meet) */
function inside(a: Box, b: DOMRect): Box | null {
  const left = Math.max(a.left, b.left), top = Math.max(a.top, b.top), right = Math.min(a.right, b.right), bottom = Math.min(a.bottom, b.bottom);
  return right > left && bottom > top ? { left, top, right, bottom, width: right - left, height: bottom - top } : null;
}
/** the title bar of the panel on top, when one is open (phones and tablets) */
function openPanelHead(): HTMLElement | null {
  const open = [...document.querySelectorAll<HTMLElement>('[data-sheet]')].filter((d) => d.getAttribute('aria-hidden') !== 'true' && d.offsetHeight > 0 && !d.closest('[data-coach]'));
  return open.pop()?.querySelector<HTMLElement>('[data-sheet-head]') ?? null;
}

/**
 * A card that points at a control: a glowing ring around it (dimming the rest when asked), the
 * card placed beside it with an arrow, and a hand over the 3D view showing a gesture. Follows the
 * control every frame as panels slide and sheets are dragged. Reports which way-there hint is in use.
 */
function Spotlight({ engine, aims, ctx, gesture, gestureAt, dim, success, wide, onAim, children, label, meta }: {
  engine: Engine; aims: Aim[]; ctx: () => LearnCtx | null; gesture?: Gesture; gestureAt?: 'living'; dim: boolean; success: boolean; wide: boolean;
  onAim?: (a: Aim | null) => void; children: ReactNode; label: string;
  /** data attributes on the card (which lesson and step: for tests and styling) */
  meta?: Record<string, string>;
}) {
  const ring = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const hand = useRef<HTMLDivElement>(null);
  const live = useRef({ aims, ctx, gesture, gestureAt, dim, success, wide, onAim });
  live.current = { aims, ctx, gesture, gestureAt, dim, success, wide, onAim };
  useEffect(() => {
    let raf = 0, placed = false, lastAim = '', lastScroll = 0;
    const v = new THREE.Vector3();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const p = live.current;
      const c = p.ctx();
      let found: { el: HTMLElement; aim: Aim; i: number } | null = null;
      for (let i = 0; i < p.aims.length && !found; i++) {
        const aim = p.aims[i];
        if (aim.when && (!c || !aim.when(c))) continue;
        for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${aim.tour}"]`)) {
          const s = probe(el);
          if (s === 'hidden') continue;
          // scrolled out of its panel: bring it into view
          if (s === 'clipped' && performance.now() - lastScroll > 700) { lastScroll = performance.now(); el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); }
          found = { el, aim, i };
          break;
        }
      }
      const way = !!found && (found.i > 0 || !!found.aim.force) && !!found.aim.hint;
      const key = found ? `${found.aim.tour}|${way}` : '';
      if (key !== lastAim) { lastAim = key; p.onAim?.(found ? { ...found.aim, hint: way ? found.aim.hint : undefined } : null); }
      const area = found?.aim.tour === 'viewport';
      let r: Box | null = found ? box(found.el.getBoundingClientRect()) : null;
      // a control in a panel: only the part of it the panel shows (a long list runs on below the tab bar)
      const body = found?.el.closest('[data-panel-body]');
      if (r && body) r = inside(r, body.getBoundingClientRect()) ?? r;
      // the ring
      const rg = ring.current;
      if (rg) {
        if (r && !area) {
          const pad = 6;
          rg.style.transform = `translate(${Math.round(r.left - pad)}px, ${Math.round(r.top - pad)}px)`;
          rg.style.width = `${Math.round(r.width + pad * 2)}px`;
          rg.style.height = `${Math.round(r.height + pad * 2)}px`;
          rg.style.opacity = '1';
          rg.classList.toggle('dd-dim', p.dim && !p.success);
          rg.classList.toggle('dd-ok', p.success);
        } else rg.style.opacity = '0';
      }
      // the card
      const cd = card.current;
      if (!cd) return;
      const bar = document.querySelector('.dd-topbar');
      const barRect = bar ? bar.getBoundingClientRect() : null;
      let top = barRect && barRect.height > 0 && barRect.bottom > 0 ? barRect.bottom : 0;
      let bottom = innerHeight;
      let near = r;
      // phones and tablets: an open panel keeps its title bar (with its ✕) and the tab bar clear of
      // the card, which fits in between — just under the title bar when the control is above the panel
      const head = p.wide ? null : openPanelHead();
      if (head) {
        const hb = head.getBoundingClientRect();
        top = Math.max(top, hb.bottom);
        const nav = document.querySelector('nav[aria-label="Modes"]')?.getBoundingClientRect();
        if (nav && nav.height > 0) bottom = Math.min(bottom, nav.top);
        if (near && near.bottom <= hb.top + 1) near = null;
      }
      const pl = placeCard(near, cd.offsetWidth, cd.offsetHeight, innerWidth, bottom, top, p.wide, area);
      const tf = `translate(${Math.round(pl.x)}px, ${Math.round(pl.y)}px)`;
      if (cd.style.transform !== tf) cd.style.transform = tf;
      cd.dataset.side = pl.side ?? '';
      cd.style.setProperty('--arrow', `${Math.round(pl.arrow)}px`);
      if (!placed) { placed = true; requestAnimationFrame(() => cd.classList.add('dd-coach-placed')); }
      // the hand, over the 3D view (or over a living thing in it), clear of the card
      const hd = hand.current;
      if (!hd) return;
      const vpEl = document.querySelector<HTMLElement>('[data-tour="viewport"]');
      if (!p.gesture || p.success || !vpEl) { hd.style.opacity = '0'; return; }
      const vp = vpEl.getBoundingClientRect();
      const cr = cd.getBoundingClientRect();
      // the part of the view the card leaves free
      let y0 = vp.top, y1 = vp.bottom;
      if (cr.bottom > vp.top && cr.top < vp.bottom && cr.right > vp.left && cr.left < vp.right) {
        if (cr.top - vp.top > vp.bottom - cr.bottom) y1 = cr.top; else y0 = cr.bottom;
      }
      let x = vp.left + vp.width / 2, y = (y0 + y1) / 2;
      if (p.gestureAt === 'living') {
        const canvas = engine.renderer.domElement.getBoundingClientRect();
        let best = Infinity;
        for (const a of engine.actorList) {
          if (a.isClone || a.def.living === false || a.def.category === 'habitats' || !a.root.visible) continue;
          v.copy(a.root.position); v.y += a.height * 0.45; v.project(engine.camera);
          if (v.z > 1) continue;
          const sx = canvas.left + (v.x * 0.5 + 0.5) * canvas.width, sy = canvas.top + (-v.y * 0.5 + 0.5) * canvas.height;
          if (sx < vp.left + 20 || sx > vp.right - 20 || sy < y0 + 20 || sy > y1 - 20) continue;
          const d = Math.hypot(sx - x, sy - y);
          if (d < best) { best = d; x = sx; y = sy; }
        }
      }
      hd.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      hd.style.opacity = y1 - y0 > 90 ? '1' : '0';
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);
  const touch = useMedia('(pointer: coarse)');
  // a mouse zooms with the wheel and slides with a (right-button) drag
  const g = gesture && !touch ? (gesture === 'pinch' ? 'scroll' : gesture === 'pan' ? 'drag' : gesture) : gesture;
  const two = touch && (g === 'pinch' || g === 'pan');
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[86]" data-coach>
      <div ref={ring} className="dd-coach-ring" style={{ opacity: 0 }} />
      {g && (
        <div ref={hand} className={clsx('dd-gesture', `dd-g-${g}`)} style={{ opacity: 0 }} aria-hidden>
          <span className="dd-gdot">{touch ? <Pointer size={19} /> : <MousePointer2 size={18} />}</span>
          {two && <span className="dd-gdot"><Pointer size={19} /></span>}
        </div>
      )}
      <div ref={card} data-coach {...meta} role="dialog" aria-modal="false" aria-label={label}
        className="dd-coach-card pointer-events-auto absolute left-0 top-0 w-[min(calc(100vw-16px),400px)] rounded-[24px] p-3.5 text-white sm:w-[360px]">
        {children}
        <span className="dd-coach-arrow" aria-hidden />
      </div>
    </div>,
    document.body,
  );
}

/* =============================== the coach =============================== */
/**
 * Runs Ranger training inside the studio: the welcome on a first visit, the lesson being followed
 * (pointing at each control and moving on when the diorama shows the step was done), the end of a
 * lesson, and one-time tips on first visiting Build and Code or an empty box.
 */
export function Coach({ mode, setMode, game, wide, ready, tips, sound, model, biome, onOpenHub }: {
  mode: Mode; setMode: (m: Mode) => void; game: GameState; wide: boolean;
  /** the diorama has loaded and nothing (AR/VR) covers the studio */
  ready: boolean;
  /** tips and the guided start are switched on (Settings) */
  tips: boolean;
  sound: boolean;
  /** a finished example diorama */
  model: boolean;
  biome: { name: string; emoji: string };
  onOpenHub: () => void;
}) {
  const { engine, runtime } = useStudio();
  const learn = useLearn();
  const touch = useMedia('(pointer: coarse)');
  const lesson: Lesson | null = learn.active ? LESSON_BY_ID[learn.active.id] ?? null : null;
  const stepIdx = lesson ? Math.min(learn.active!.step, lesson.steps.length - 1) : 0;
  const step = lesson?.steps[stepIdx] ?? null;
  const key = ready && lesson ? `${lesson.id}:${stepIdx}` : '';

  const [phase, setPhase] = useState<'doing' | 'done'>('doing');
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  /** the step was already done when it began: read it, then Next */
  const [pre, setPre] = useState(false);
  const [blocked, setBlocked] = useState<{ text: string; lesson?: string } | null>(null);
  const [finished, setFinished] = useState<{ lesson: Lesson; first: boolean } | null>(null);
  const [aim, setAim] = useState<Aim | null>(null);

  /* ---------- what the checks see ---------- */
  const live = useRef({ mode, wide, touch, game });
  live.current = { mode, wide, touch, game };
  /** moments with the time they happened: a step sees those since it began (or since the step before was done) */
  const moments = useRef<{ name: string; t: number }[]>([]);
  const since = useRef(0);
  const moved = useRef({ orbit: 0, zoom: 0, pan: 0 });
  const start = useRef<Snapshot | null>(null);
  const prepared = useRef('');
  const lastCtx = useRef<LearnCtx | null>(null);
  const makeCtx = useCallback((): LearnCtx => {
    const now = snapshot(engine, runtime);
    const l = live.current;
    const t0 = since.current;
    const c: LearnCtx = {
      engine, runtime, mode: l.mode, wide: l.wide, touch: l.touch,
      seen: new Set(moments.current.filter((m) => m.t > t0).map((m) => m.name)),
      moved: moved.current, start: start.current ?? now, now, chain: l.game.health.maxLevel,
      shown: (t) => !!findShown(t),
    };
    lastCtx.current = c;
    return c;
  }, [engine, runtime]);
  /** cheap context for choosing targets every frame (the snapshot may be a moment old) */
  const aimCtx = useCallback((): LearnCtx | null => (lastCtx.current ? { ...lastCtx.current, mode: live.current.mode } : null), []);
  /** the next step starts counting from now */
  const prepareFor = useCallback((nextKey: string) => {
    since.current = performance.now();
    moved.current = { orbit: 0, zoom: 0, pan: 0 };
    start.current = snapshot(engine, runtime);
    prepared.current = nextKey;
  }, [engine, runtime]);

  /* ---------- moments: taps, discoveries, land edits and UI signals ---------- */
  const poke = useRef<() => void>(() => {});
  useEffect(() => {
    if (!lesson) return;
    const add = (name: string) => { moments.current.push({ name, t: performance.now() }); if (moments.current.length > 200) moments.current.splice(0, 100); poke.current(); };
    const offE = engine.on((e) => {
      if (e.type === 'tap' && e.id) { const a = engine.getActor(e.id); if (a && a.def.living !== false) add('tap-living'); }
      if (e.type === 'land') { add(`land:${e.tool}`); if (e.detail) add(`land:${e.tool}:${e.detail}`); }
    });
    const offP = onProgress((e) => { if (e.type === 'discover') add('discover'); });
    const offS = onLearnSignal(add);
    return () => { offE(); offP(); offS(); };
  }, [lesson?.id, engine]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- how the camera moves: turning, zooming and sliding, told apart frame by frame ---------- */
  useEffect(() => {
    if (!lesson || !ready) return;
    let raf = 0;
    let prev: { az: number; po: number; dist: number; t: THREE.Vector3 } | null = null;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (engine.walk?.active) { prev = null; return; }
      const ctl = engine.controls;
      const az = ctl.getAzimuthalAngle(), po = ctl.getPolarAngle(), dist = engine.camera.position.distanceTo(ctl.target);
      if (prev) {
        const dl = Math.abs(Math.log(dist / Math.max(1e-6, prev.dist)));
        let da = az - prev.az;
        if (da > Math.PI) da -= Math.PI * 2; else if (da < -Math.PI) da += Math.PI * 2;
        const m = moved.current;
        if (dl > 0.002) m.zoom += dl;
        else { m.orbit += Math.abs(da) + Math.abs(po - prev.po); m.pan += ctl.target.distanceTo(prev.t); }
        prev.az = az; prev.po = po; prev.dist = dist; prev.t.copy(ctl.target);
      } else prev = { az, po, dist, t: ctl.target.clone() };
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lesson?.id, ready, engine]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- a step begins ---------- */
  const checkedFor = useRef('');
  const advanceTimer = useRef(0);
  useEffect(() => {
    if (!lesson) checkedFor.current = '';
    if (!key || !lesson || !step) return;
    if (prepared.current !== key) prepareFor(key);
    setPhase('doing');
    setAim(null);
    // a lesson that needs something first (land, living things) says so
    if (checkedFor.current !== lesson.id) {
      checkedFor.current = lesson.id;
      const why = lesson.requires?.(makeCtx()) ?? null;
      setBlocked(why);
      if (why) return;
    }
    step.enter?.(makeCtx());
    setPre(!!step.done && step.done(makeCtx()));
    return () => clearTimeout(advanceTimer.current);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const complete = useCallback((l: Lesson) => {
    const first = finishLesson(l.id, l.xp, l.title);
    markSeen(...(TIPS_OF[l.id] ?? []));
    setFinished({ lesson: l, first });
    confetti(innerWidth / 2, innerHeight * 0.32, 90);
    if (sound) { audio(); playSound('yay'); }
  }, [sound]);
  const advance = useCallback(() => {
    if (!lesson) return;
    clearTimeout(advanceTimer.current);
    if (stepIdx + 1 < lesson.steps.length) {
      if (phaseRef.current !== 'done') prepareFor(`${lesson.id}:${stepIdx + 1}`);
      setLessonStep(stepIdx + 1);
    } else complete(lesson);
  }, [lesson, stepIdx, complete, prepareFor]);
  const succeed = useCallback(() => {
    if (phaseRef.current !== 'doing' || !lesson) return;
    phaseRef.current = 'done';
    setPhase('done');
    // what happens during the little celebration already counts towards the next step
    if (stepIdx + 1 < lesson.steps.length) prepareFor(`${lesson.id}:${stepIdx + 1}`);
    uiSound('pop');
    haptic([6, 40, 10]);
    advanceTimer.current = window.setTimeout(advance, 900);
  }, [lesson, stepIdx, advance, prepareFor]);

  /* ---------- watching for the step to be done ---------- */
  useEffect(() => {
    if (!key || !step?.done || pre || phase !== 'doing' || blocked) { poke.current = () => {}; return; }
    const check = () => { if (phaseRef.current === 'doing' && step.done!(makeCtx())) succeed(); };
    poke.current = () => queueMicrotask(check);
    const id = window.setInterval(check, 220);
    check();
    return () => { clearInterval(id); poke.current = () => {}; };
  }, [key, pre, phase, blocked, step, makeCtx, succeed]);

  /* ---------- welcome and one-time tips ---------- */
  const living = game.health.species;
  const tip = useMemo(() => {
    if (!ready || !tips || !learn.welcomed || lesson || finished) return null;
    if (mode === 'explore' && !model && living === 0 && !hasSeen('tip-empty')) return 'tip-empty';
    if (mode === 'build' && !hasSeen('tip-build') && !learn.done.includes('add')) return 'tip-build';
    if (mode === 'code' && !hasSeen('tip-code') && !learn.done.includes('code')) return 'tip-code';
    return null;
  }, [ready, tips, learn, lesson, finished, mode, model, living]);
  // tips wait a moment (the mode has just changed), and count as seen once they have shown
  const [tipShown, setTipShown] = useState<string | null>(null);
  useEffect(() => {
    if (!tip) { setTipShown(null); return; }
    const t = window.setTimeout(() => setTipShown(tip), tip === 'tip-empty' ? 1400 : 700);
    return () => clearTimeout(t);
  }, [tip]);
  useEffect(() => () => { if (tipShown) markSeen(tipShown); }, [tipShown]);

  const welcome = ready && tips && !learn.welcomed && !lesson && !finished;

  if (!ready) return null;
  if (finished) {
    return <Finished lesson={finished.lesson} first={finished.first} onClose={() => setFinished(null)} onHub={() => { setFinished(null); onOpenHub(); }} onNext={(id) => { setFinished(null); startLesson(id); }} />;
  }
  if (lesson && step) {
    const n = lesson.steps.length;
    const c = lastCtx.current ?? makeCtx();
    const isInfo = !step.done;
    const modeOff = !!step.mode && mode !== step.mode;
    const aims: Aim[] = blocked ? [] : modeOff ? [{ tour: `tab-${step.mode}`, hint: `First, switch to ${MODE_NAME[step.mode!]}`, force: true, mode: step.mode }] : step.targets ?? [];
    const done = phase === 'done';
    return (
      <Spotlight engine={engine} aims={aims} ctx={aimCtx} gesture={blocked || modeOff ? undefined : step.gesture} gestureAt={step.gestureAt}
        dim={step.dim !== false && !blocked} success={done} wide={wide} onAim={setAim} label={`Lesson: ${lesson.title}`}
        meta={{ 'data-lesson': lesson.id, 'data-step': step.id, 'data-phase': blocked ? 'blocked' : done ? 'done' : pre ? 'pre' : isInfo ? 'info' : 'doing', 'data-aim': aim?.tour ?? '' }}>
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[10px] bg-white/10 text-[16px] leading-none">{lesson.emoji}</span>
          <span className="min-w-0 flex-1 truncate font-display text-[11.5px] font-bold uppercase tracking-[0.12em] text-amber-300">{lesson.title}</span>
          <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-white/45">{stepIdx + 1}/{n}</span>
          <button type="button" onClick={() => { uiSound('tick'); pauseLesson(); }} className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white/55 transition hover:bg-white/10 hover:text-white" aria-label="Pause the lesson" title="Pause — carry on later from 🎓 Learn"><X size={17} /></button>
        </div>
        {blocked ? (
          <div className="mt-2" role="status">
            <div className="font-display text-[17px] font-bold leading-tight">Not quite ready</div>
            <p className="mt-1 text-[13px] leading-snug text-white/80">{blocked.text}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {blocked.lesson && LESSON_BY_ID[blocked.lesson] && (
                <button type="button" onClick={() => { setBlocked(null); startLesson(blocked.lesson!); }} className="dd-coach-go h-10 rounded-2xl px-3.5 font-display text-[14px] font-bold">{LESSON_BY_ID[blocked.lesson].emoji} {LESSON_BY_ID[blocked.lesson].title}</button>
              )}
              <button type="button" onClick={() => { checkedFor.current = ''; const why = lesson.requires?.(makeCtx()) ?? null; setBlocked(why); if (!why) { step.enter?.(makeCtx()); setPre(!!step.done && step.done(makeCtx())); } }} className="h-10 rounded-2xl bg-white/10 px-3.5 font-display text-[13.5px] font-semibold text-white/85 hover:bg-white/15">Try again</button>
              <button type="button" onClick={() => { pauseLesson(); onOpenHub(); }} className="h-10 rounded-2xl px-3 font-display text-[13.5px] font-semibold text-white/60 hover:bg-white/10">Other lessons</button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-1.5" aria-live="polite">
              <div className={clsx('flex items-center gap-1.5 font-display text-[17px] font-bold leading-tight', done && 'text-[#7cf0a2]')}>
                {(done || pre) && <Check size={18} strokeWidth={3} className="shrink-0 text-[#5ee08a]" />}{textOf(step.title, c)}
              </div>
              <p className="mt-1 text-[13px] leading-snug text-white/80">{textOf(step.body, c)}</p>
            </div>
            {aim?.hint && !done && (
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-amber-300/[0.14] py-1.5 pl-2.5 pr-1.5 text-[12.5px] font-semibold leading-snug text-amber-100 ring-1 ring-amber-300/30">
                <span className="min-w-0 flex-1">👉 {aim.hint}</span>
                {aim.mode && <button type="button" onClick={() => setMode(aim.mode!)} className="h-8 shrink-0 rounded-lg bg-amber-300 px-2.5 font-display text-[12.5px] font-bold text-[#3d2a00]">Go</button>}
              </div>
            )}
            <div className="mt-2.5 flex items-center gap-1.5">
              {stepIdx > 0 && !done && <button type="button" onClick={() => { uiSound('tick'); setLessonStep(stepIdx - 1); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white/55 hover:bg-white/10 hover:text-white" aria-label="Previous step"><ChevronLeft size={18} /></button>}
              <span className="flex gap-1" aria-hidden>{lesson.steps.map((_, i) => <span key={i} className={clsx('h-1.5 rounded-full transition-all', i < stepIdx || (i === stepIdx && done) ? 'w-3 bg-[#5ee08a]' : i === stepIdx ? 'w-4 bg-amber-300' : 'w-1.5 bg-white/20')} />)}</span>
              <span className="flex-1" />
              {done ? <span className="dd-coach-yay font-display text-[15px] font-bold text-[#7cf0a2]">Nice!</span>
                : isInfo || pre ? (
                  <button type="button" onClick={() => { uiSound('tab'); advance(); }} className="dd-coach-go flex h-10 items-center gap-1 rounded-2xl pl-4 pr-3 font-display text-[14.5px] font-bold">
                    {stepIdx + 1 === n ? 'Finish' : 'Next'} <ChevronRight size={17} />
                  </button>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5 pr-1 font-display text-[12.5px] font-semibold text-white/60"><span className="dd-coach-wait" aria-hidden><i /><i /><i /></span>Your turn</span>
                    <button type="button" onClick={() => { uiSound('tick'); advance(); }} className="h-9 shrink-0 rounded-xl px-2.5 font-display text-[12.5px] font-semibold text-white/50 hover:bg-white/10 hover:text-white/80">Skip</button>
                  </>
                )}
            </div>
          </>
        )}
      </Spotlight>
    );
  }
  if (welcome) return <Welcome biome={biome} model={model} onStart={() => { setWelcomed(); startLesson(FIRST_STEPS[0].id); }} onSkip={() => setWelcomed()} />;
  if (tipShown && tipShown === tip) {
    const TIP: Record<string, { title: string; body: string; aims: Aim[]; lesson: string; emoji: string }> = {
      'tip-empty': { emoji: '🌱', title: 'Your box is empty — for now!', body: 'Plants and animals are added in Build mode. Want me to show you how?', aims: [{ tour: 'tab-build' }], lesson: 'add' },
      'tip-build': { emoji: '🔨', title: 'This is Build mode', body: 'Add plants and animals from the inventory, tap things to select them and drag to move them. World & land has the land tools.', aims: [{ tour: 'inventory' }, { tour: 'sheet-add' }, { tour: 'world-panel' }], lesson: learn.done.includes('add') ? 'edit' : 'add' },
      'tip-code': { emoji: '🧩', title: 'This is Code mode', body: 'Pick a plant, an animal or the World at the top, snap blocks together, then press ▶ Play.', aims: [{ tour: 'code-workspace' }], lesson: 'code' },
    };
    const t = TIP[tipShown];
    const l = LESSON_BY_ID[t.lesson];
    return (
      <Spotlight engine={engine} aims={t.aims} ctx={aimCtx} dim={false} success={false} wide={wide} label={t.title} onAim={setAim} meta={{ 'data-tip': tipShown, 'data-aim': aim?.tour ?? '' }}>
        <div className="flex items-start gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-white/10 text-[22px] leading-none">{t.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[16px] font-bold leading-tight">{t.title}</div>
            <p className="mt-0.5 text-[13px] leading-snug text-white/75">{t.body}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={() => { markSeen(tipShown); uiSound('pop'); startLesson(l.id); }} className="dd-coach-go flex h-10 items-center gap-1.5 rounded-2xl px-3.5 font-display text-[14px] font-bold"><GraduationCap size={17} /> Show me how</button>
          <button type="button" onClick={() => { markSeen(tipShown); setTipShown(null); uiSound('tick'); }} className="h-10 rounded-2xl px-3 font-display text-[13.5px] font-semibold text-white/65 hover:bg-white/10">Got it</button>
        </div>
      </Spotlight>
    );
  }
  return null;
}

/* =============================== welcome =============================== */
function Welcome({ biome, model, onStart, onSkip }: { biome: { name: string; emoji: string }; model: boolean; onStart: () => void; onSkip: () => void }) {
  useBackLayer(true, onSkip);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onSkip(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onSkip]);
  const minutes = FIRST_STEPS.reduce((s, l) => s + l.minutes, 0);
  return (
    <div data-coach className="dd-modal-bg fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-2.5 pb-[calc(max(env(safe-area-inset-bottom),8px)+66px)] backdrop-blur-[2px] sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="dd-welcome-title">
      <div className="dd-card-dark dd-modal flex max-h-full w-full max-w-[460px] flex-col overflow-hidden rounded-[28px] text-white">
        <div className="min-h-0 overflow-y-auto overscroll-contain p-5">
          <div className="flex items-center gap-3">
            <span className="dd-bob grid h-14 w-14 shrink-0 place-items-center rounded-[20px] bg-white/10 text-[32px] leading-none">{biome.emoji}</span>
            <div className="min-w-0">
              <div className="font-display text-[11.5px] font-bold uppercase tracking-[0.18em] text-amber-300">Ranger training</div>
              <h2 id="dd-welcome-title" className="font-display text-[23px] font-bold leading-tight">Welcome to your {biome.name}!</h2>
            </div>
          </div>
          <p className="mt-3 text-[14px] leading-snug text-white/80">
            {model ? 'This finished example shows a healthy habitat to explore. ' : 'Your box starts as bare land, sky and climate — it’s up to you to bring it to life. '}
            Want a quick guided start? About {minutes} minutes, one small step at a time — you do each one yourself.
          </p>
          {/* (short screens — phones held sideways — keep the message and the buttons, without the list) */}
          <ol className="mt-3 space-y-1.5 [@media(max-height:540px)]:hidden">
            {FIRST_STEPS.map((l, i) => (
              <li key={l.id} className="flex items-center gap-2.5 rounded-2xl bg-white/[0.06] px-3 py-2 ring-1 ring-white/[0.08]">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-300/20 font-display text-[12px] font-bold text-amber-200">{i + 1}</span>
                <span className="text-[17px] leading-none">{l.emoji}</span>
                <span className="min-w-0 flex-1 truncate font-display text-[14px] font-semibold">{l.title}</span>
                <span className="shrink-0 text-[11.5px] font-semibold text-white/45">{l.minutes} min</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="shrink-0 border-t border-white/[0.08] p-4 pt-3">
          <button type="button" autoFocus onClick={() => { uiSound('pop'); onStart(); }} className="dd-cta flex h-13 min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl font-display text-[18px] font-bold text-white"><GraduationCap size={22} /> Show me around</button>
          <button type="button" onClick={() => { uiSound('tick'); onSkip(); }} className="mt-1.5 h-11 w-full rounded-2xl font-display text-[14.5px] font-semibold text-white/70 transition hover:bg-white/10">I’ll explore on my own</button>
          <p className="mt-0.5 text-center text-[11.5px] text-white/45">Every lesson is waiting under 🎓 Learn.</p>
        </div>
      </div>
    </div>
  );
}

/* =============================== a lesson is done =============================== */
function Finished({ lesson, first, onClose, onNext, onHub }: { lesson: Lesson; first: boolean; onClose: () => void; onNext: (id: string) => void; onHub: () => void }) {
  useBackLayer(true, onClose);
  const learn = useLearn();
  const next = nextLesson(learn.done, lesson.id);
  const doneCount = LESSONS.filter((l) => learn.done.includes(l.id)).length;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div data-coach className="dd-modal-bg fixed inset-0 z-[87] flex items-center justify-center bg-black/45 p-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-[max(env(safe-area-inset-top),12px)] backdrop-blur-[2px]" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="dd-lesson-done">
      <div className="dd-card-dark dd-pop flex max-h-full w-[min(94vw,420px)] flex-col overflow-hidden rounded-[30px] text-center text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pt-5">
          <div className="font-display text-[12px] font-bold uppercase tracking-[0.18em] text-amber-300">Lesson complete!</div>
          <div className="dd-bob mx-auto mt-3 grid h-16 w-16 place-items-center rounded-[22px] bg-white/10 text-[38px] leading-none">{lesson.emoji}</div>
          <h2 id="dd-lesson-done" className="mt-2 font-display text-[24px] font-bold leading-tight">{lesson.title}</h2>
          {first && <div className="mt-1.5 inline-flex rounded-full bg-gradient-to-b from-[#ffe680] to-[#ffbf2e] px-3 py-0.5 font-display text-[13px] font-bold text-[#3d2a00] shadow-[0_2px_0_#c98a00]">+{lesson.xp} XP</div>}
          <ul className="mt-3 space-y-1.5 text-left">
            {lesson.recap.map((r) => <li key={r} className="flex items-start gap-2 rounded-2xl bg-white/[0.06] px-3 py-2 text-[13px] leading-snug text-white/85 ring-1 ring-white/[0.06]"><Check size={16} strokeWidth={3} className="mt-px shrink-0 text-[#5ee08a]" />{r}</li>)}
          </ul>
          <div className="mt-3 flex items-center gap-2 px-1">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-gradient-to-r from-[#ffe066] to-[#ffb020]" style={{ width: `${(doneCount / LESSONS.length) * 100}%` }} /></span>
            <span className="shrink-0 font-display text-[12px] font-bold text-white/60">{doneCount}/{LESSONS.length} lessons</span>
          </div>
        </div>
        <div className="shrink-0 p-5 pt-4">
          {next ? (
            <button type="button" autoFocus onClick={() => { uiSound('pop'); onNext(next.id); }} className="dd-cta flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-3 font-display text-[16px] font-bold text-white">
              <span className="truncate">Next: {next.emoji} {next.title}</span><ChevronRight size={19} className="shrink-0" />
            </button>
          ) : <div className="rounded-2xl bg-[#3ccf6e]/15 px-3 py-2.5 font-display text-[14px] font-bold text-[#9df0b8] ring-1 ring-[#3ccf6e]/30">🎓 You’ve done every lesson that’s open. New ones unlock along the ranger path!</div>}
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={onClose} className="h-11 flex-1 rounded-2xl bg-white/10 font-display text-[14px] font-semibold text-white/85 hover:bg-white/15">{next ? 'Later' : 'Done'}</button>
            <button type="button" onClick={onHub} className="h-11 flex-1 rounded-2xl font-display text-[14px] font-semibold text-white/65 hover:bg-white/10">All lessons</button>
          </div>
        </div>
      </div>
    </div>
  );
}
