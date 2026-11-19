import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { BADGE_BY_ID, onProgress, type ProgressEvent } from '../../game/progress';
import { playSound, audio } from '../../code/sound';

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
    const loop = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      const d = devicePixelRatio;
      parts = parts.filter((p) => p.life > 0 && p.y < innerHeight + 40);
      for (const p of parts) {
        p.vy += 0.18; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va; p.life -= 1;
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

export function Celebrations({ sound }: { sound: boolean }) {
  const [queue, setQueue] = useState<Banner[]>([]);
  const [current, setCurrent] = useState<Banner | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const soundRef = useRef(sound);
  soundRef.current = sound;
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
      <div className="pointer-events-none fixed right-3 top-16 z-[75] flex flex-col items-end gap-1 sm:right-5">
        {floaters.map((f) => <div key={f.key} className="dd-xp-floater rounded-full px-2.5 py-0.5 font-display text-sm font-bold">{f.text}</div>)}
      </div>
      {current && (
        <div className="pointer-events-none fixed inset-x-0 top-[70px] z-[78] flex justify-center px-3">
          <div key={current.key} onClick={() => setCurrent(null)} className={clsx('dd-banner pointer-events-auto flex max-w-[min(94vw,460px)] cursor-pointer items-center gap-3 rounded-[22px] py-2.5 pl-2.5 pr-5', current.kind === 'badge' || current.kind === 'level' ? 'dd-banner-big' : '')} style={{ ['--b' as string]: current.color }}>
            <div className="dd-medal grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl">{current.emoji}</div>
            <div className="min-w-0">
              <div className="font-display text-[11px] font-bold uppercase tracking-[0.12em] text-white/75">{current.title}</div>
              <div className="font-display text-lg font-semibold leading-tight text-white">{current.sub}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
