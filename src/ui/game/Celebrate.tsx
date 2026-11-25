import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { BADGE_BY_ID, onProgress, type ProgressEvent } from '../../game/progress';
import { playSound, audio } from '../../code/sound';
import { FEATURES, STAGES, type Stage } from '../../game/unlocks';
import { BIOME_BY_ID } from '../../biomes/templates';
import { FEATURE_LESSON, LESSON_BY_ID } from '../../learn/lessons';
import { useLayout } from '../shell';

/* ---------------- confetti ---------------- */
let fire: ((x: number, y: number, n?: number) => void) | null = null;
/** burst of confetti at a screen point (no-op until the layer is mounted) */
export function confetti(x = window.innerWidth / 2, y = window.innerHeight * 0.3, n = 120) { fire?.(x, y, n); }

function ConfettiCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number; va: number; c: string; life: number; shape: number };
    let parts: P[] = [];
    let raf = 0;
    const colors = ['#ffcb3d', '#ff6b6b', '#4ecdc4', '#7c5cff', '#3ccf6e', '#ff9f43', '#54a0ff', '#f368e0'];
    const resize = () => { c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio; };
    resize();
    addEventListener('resize', resize);
    let last = 0;
    const loop = (now: number) => {
      ctx.clearRect(0, 0, c.width, c.height);
      const d = devicePixelRatio;
      // steps of a 60 fps frame, so slow devices see the same short burst rather than a slow-motion one
      const k = last ? Math.min(4, (now - last) / 16.7) : 1;
      last = now;
      parts = parts.filter((p) => p.life > 0 && p.y < innerHeight + 40);
      for (const p of parts) {
        p.vy += 0.18 * k; p.vx *= Math.pow(0.99, k); p.x += p.vx * k; p.y += p.vy * k; p.a += p.va * k; p.life -= k;
        ctx.save();
        ctx.translate(p.x * d, p.y * d);
        ctx.rotate(p.a);
        ctx.globalAlpha = Math.min(1, p.life / 30);
        ctx.fillStyle = p.c;
        if (p.shape === 0) ctx.fillRect(-p.r * d, -p.r * 0.5 * d, p.r * 2 * d, p.r * d);
        else { ctx.beginPath(); ctx.arc(0, 0, p.r * 0.7 * d, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
      raf = parts.length ? requestAnimationFrame(loop) : 0;
      if (!raf) last = 0;
    };
    fire = (x, y, n = 120) => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1, s = 4 + Math.random() * 9;
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 3 + Math.random() * 4, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3, c: colors[i % colors.length], life: 90 + Math.random() * 60, shape: i % 3 === 0 ? 1 : 0 });
      }
      if (!raf) raf = requestAnimationFrame(loop);
    };
    return () => { fire = null; cancelAnimationFrame(raf); removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[80] h-full w-full" />;
}

/* ---------------- banners ---------------- */
type Banner = { key: number; kind: 'discover' | 'quest' | 'badge' | 'level' | 'stars'; title: string; sub: string; emoji: string; color: string };
type Floater = { key: number; text: string };

export function Celebrations({ sound, onLearn }: { sound: boolean; /** start a lesson (a newly unlocked tool's "Learn how") */ onLearn?: (lessonId: string) => void }) {
  const [queue, setQueue] = useState<Banner[]>([]);
  const [current, setCurrent] = useState<Banner | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  // a completed expedition opens the next step of the ranger path: shown until dismissed
  const [opened, setOpened] = useState<Stage | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  // phones and tablets: an open panel's title bar (with its ✕) sits just under the top bar, so
  // banners and XP pop up over the top bar instead, smaller, and never in the way of closing it
  const { wide } = useLayout();
  useEffect(() => onProgress((e: ProgressEvent) => {
    const key = Date.now() + Math.random();
    if (e.type === 'xp') {
      setFloaters((f) => [...f.slice(-4), { key, text: `+${e.amount} XP` }]);
      setTimeout(() => setFloaters((f) => f.filter((x) => x.key !== key)), 1600);
      return;
    }
    let b: Banner | null = null;
    if (e.type === 'discover') {
      // the species card already shows a "new discovery" ribbon; on phones a banner would also
      // sit right on top of the organism the camera just brought into view
      if (innerWidth < 1024) { if (soundRef.current) { audio(); playSound('chime'); } return; }
      b = { key, kind: 'discover', title: 'New species discovered!', sub: e.name, emoji: e.emoji, color: '#3d85c6' };
    }
    if (e.type === 'quest') b = { key, kind: 'quest', title: 'Quest complete!', sub: `${e.title}  ·  +${e.xp} XP`, emoji: '✅', color: '#7c5cff' };
    if (e.type === 'badge') { const d = BADGE_BY_ID[e.id]; b = { key, kind: 'badge', title: 'Badge unlocked!', sub: `${d.name} — ${d.how}`, emoji: d.emoji, color: d.color }; }
    if (e.type === 'level') b = { key, kind: 'level', title: `Level ${e.level}!`, sub: `You are now a ${e.rank}`, emoji: '🎉', color: '#e0a800' };
    if (e.type === 'complete') {
      const st = e.stage !== null ? STAGES[e.stage] : null;
      if (st) {
        setTimeout(() => { setOpened(st); confetti(innerWidth / 2, innerHeight * 0.3, 200); if (soundRef.current) { audio(); playSound('yay'); } }, 2600);
        return;
      }
      b = { key, kind: 'badge', title: 'Expedition complete!', sub: `${BIOME_BY_ID[e.biome]?.name ?? 'Diorama'} · +100 XP`, emoji: '🧭', color: '#2fae4b' };
    }
    if (e.type === 'stars') b = { key, kind: 'stars', title: `${'★'.repeat(e.stars)}${'☆'.repeat(3 - e.stars)}`, sub: `Your diorama earned ${e.stars} star${e.stars > 1 ? 's' : ''}!`, emoji: '🏆', color: '#e0a800' };
    if (b) setQueue((q) => [...q, b!]);
  }), []);
  // show the next banner when the stage is free…
  useEffect(() => {
    if (current || !queue.length) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next);
    if (soundRef.current) { audio(); playSound(next.kind === 'discover' ? 'chime' : next.kind === 'quest' ? 'pop' : 'yay'); }
    if (next.kind !== 'discover') confetti(innerWidth / 2, innerHeight * 0.22, next.kind === 'quest' ? 50 : 140);
  }, [queue, current]);
  // …and dismiss it on its own timer (kept separate so queue updates can't cancel it)
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setCurrent(null), current.kind === 'badge' || current.kind === 'level' ? 3400 : 2300);
    return () => clearTimeout(t);
  }, [current]);
  return (
    <>
      <ConfettiCanvas />
      <div className={clsx('pointer-events-none fixed right-3 z-[75] flex flex-col items-end gap-1 sm:right-5', wide ? 'top-[calc(4rem+env(safe-area-inset-top))]' : 'top-[calc(0.5rem+env(safe-area-inset-top))]')}>
        {floaters.map((f) => <div key={f.key} className="dd-xp-floater rounded-full px-2.5 py-0.5 font-display text-sm font-bold">{f.text}</div>)}
      </div>
      {opened && <Unlocked stage={opened} onClose={() => setOpened(null)} onLearn={onLearn ? (id) => { setOpened(null); onLearn(id); } : undefined} />}
      {current && (
        <div className={clsx('pointer-events-none fixed inset-x-0 z-[78] flex justify-center px-3', wide ? 'top-[calc(70px+env(safe-area-inset-top))]' : 'top-[calc(4px+env(safe-area-inset-top))]')}>
          <div key={current.key} onClick={() => setCurrent(null)} className={clsx('dd-banner pointer-events-auto flex max-w-[min(94vw,460px)] cursor-pointer items-center gap-3 rounded-[22px] pl-2.5 pr-5', wide ? 'py-2.5' : 'py-2', current.kind === 'badge' || current.kind === 'level' ? 'dd-banner-big' : '')} style={{ ['--b' as string]: current.color }}>
            <div className={clsx('dd-medal grid shrink-0 place-items-center rounded-2xl', wide ? 'h-14 w-14 text-3xl' : 'h-11 w-11 text-[26px]')}>{current.emoji}</div>
            <div className="min-w-0">
              <div className="font-display text-[11px] font-bold uppercase tracking-[0.12em] text-white/75">{current.title}</div>
              <div className={clsx('font-display font-semibold leading-tight text-white', wide ? 'text-lg' : 'line-clamp-2 text-[15px]')}>{current.sub}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** the next step of the ranger path, opened by a completed expedition (new tools offer their lesson) */
function Unlocked({ stage, onClose, onLearn }: { stage: Stage; onClose: () => void; onLearn?: (lessonId: string) => void }) {
  const habitats = stage.habitats.map((h) => BIOME_BY_ID[h]).filter(Boolean);
  return (
    // (sized by the screen it covers, not viewport units: a flex item's max-h-full is that room)
    <div className="fixed inset-0 z-[81] flex items-center justify-center bg-black/50 p-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-[max(env(safe-area-inset-top),12px)] backdrop-blur-[2px]" onClick={onClose} role="dialog" aria-modal="true" aria-label="New things unlocked">
      <div className="dd-card-dark dd-pop flex max-h-full w-[min(94vw,480px)] flex-col rounded-[30px] p-5 text-center text-white" onClick={(e) => e.stopPropagation()}>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
        <div className="font-display text-[12px] font-bold uppercase tracking-[0.18em] text-amber-300">Expedition complete!</div>
        <div className="dd-bob mx-auto mt-3 grid h-16 w-16 sm:h-20 sm:w-20 place-items-center rounded-[26px] bg-white/10 text-5xl">{stage.emoji}</div>
        <div className="mt-2 font-display text-2xl font-bold">You’re now {/^[AEIOU]/.test(stage.rank) ? 'an' : 'a'} {stage.rank}</div>
        <p className="mt-1 text-[13.5px] text-white/70">Here’s what you unlocked:</p>
        <div className="mt-3 grid gap-1.5 text-left">
          {habitats.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.07] px-3 py-2 ring-1 ring-white/10">
              <span className="text-2xl">{b.emoji}</span>
              <div className="min-w-0"><div className="font-display font-semibold">{b.name}</div><div className="truncate text-[12px] text-white/60">New habitat · {b.tagline}</div></div>
            </div>
          ))}
          {stage.features.map((f) => {
            const lesson = LESSON_BY_ID[FEATURE_LESSON[f] ?? ''];
            return (
              <div key={f} className="flex items-center gap-3 rounded-2xl bg-white/[0.07] px-3 py-2 ring-1 ring-white/10">
                <span className="text-2xl">{FEATURES[f].emoji}</span>
                <div className="min-w-0 flex-1"><div className="font-display font-semibold">{FEATURES[f].name}</div><div className="text-[12px] leading-snug text-white/60">{FEATURES[f].what}</div></div>
                {lesson && onLearn && (
                  <button type="button" onClick={() => onLearn(lesson.id)} className="shrink-0 rounded-xl bg-amber-300/20 px-2.5 py-1.5 font-display text-[12.5px] font-bold text-amber-200 ring-1 ring-amber-300/40 transition hover:bg-amber-300/30" title={`Lesson: ${lesson.title}`}>🎓 Learn how</button>
                )}
              </div>
            );
          })}
        </div>
        </div>
        <button type="button" onClick={onClose} autoFocus className="dd-cta mt-4 h-12 w-full shrink-0 rounded-2xl font-display text-lg font-bold text-white">Awesome!</button>
      </div>
    </div>
  );
}
