import { useEffect, useRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, ChevronUp, Heart, Trophy, Lightbulb, CheckCircle2, Circle } from 'lucide-react';
import { levelOf, type Profile } from '../../game/progress';
import type { GameState } from './useGame';
import type { Quest } from '../../game/ecology';

/* ---------------- shared popover ---------------- */
export function Popover({ open, onClose, children, className, align = 'right' }: { open: boolean; onClose: () => void; children: ReactNode; className?: string; align?: 'left' | 'right' | 'center' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const fn = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest?.('[data-popover-anchor]')) onClose(); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => window.addEventListener('pointerdown', fn), 0);
    window.addEventListener('keydown', k);
    return () => { window.removeEventListener('pointerdown', fn); window.removeEventListener('keydown', k); };
  }, [open, onClose]);
  if (!open) return null;
  return <div ref={ref} className={clsx('dd-pop absolute top-[calc(100%+10px)] z-50', align === 'right' ? 'right-0' : align === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2', className)}>{children}</div>;
}

/* ---------------- level ring ---------------- */
export function LevelRing({ xp, size = 40, stroke = 4 }: { xp: number; size?: number; stroke?: number }) {
  const L = levelOf(xp);
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ddxp)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - L.frac)} style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.2,.8,.2,1)' }} />
        <defs><linearGradient id="ddxp" x1="0" x2="1"><stop offset="0" stopColor="#ffe066" /><stop offset="1" stopColor="#ffb020" /></linearGradient></defs>
      </svg>
      <span className="font-display text-[13px] font-bold text-white" style={{ fontSize: size * 0.34 }}>{L.level}</span>
    </span>
  );
}

export function XpChip({ profile, onClick, compact }: { profile: Profile; onClick?: () => void; compact?: boolean }) {
  const L = levelOf(profile.xp);
  return (
    <button onClick={onClick} className="dd-hudchip flex h-11 items-center gap-2 rounded-2xl pl-1 pr-3" title={`Level ${L.level} ${L.rank} — ${L.into}/${L.need} XP to the next level`} data-popover-anchor>
      <LevelRing xp={profile.xp} size={36} />
      {!compact && (
        <span className="flex flex-col items-start leading-none">
          <span className="font-display text-[12px] font-semibold text-white">{profile.avatar} {L.rank}</span>
          <span className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-gradient-to-r from-[#ffe066] to-[#ffb020] transition-all duration-700" style={{ width: `${L.frac * 100}%` }} /></span>
        </span>
      )}
    </button>
  );
}

/* ---------------- ecosystem health ---------------- */
export function HealthChip({ game, compact }: { game: GameState; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const h = game.health;
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="dd-hudchip flex h-11 items-center gap-2 rounded-2xl px-2.5" title="Ecosystem health" data-popover-anchor>
        <span className="relative grid h-7 w-7 place-items-center rounded-full" style={{ background: h.color + '33' }}>
          <Heart size={16} fill={h.color} stroke={h.color} className={h.score >= 85 ? 'dd-beat' : ''} />
        </span>
        <span className="flex flex-col items-start leading-none">
          <span className="font-display text-[15px] font-bold text-white tabular-nums">{h.score}{!compact && <span className="ml-1 text-[11px] font-semibold text-white/60">/100</span>}</span>
          {!compact && <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: h.color }}>{h.label}</span>}
        </span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className="w-[min(92vw,340px)]">
        <div className="dd-card-dark rounded-3xl p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: h.color + '2a', boxShadow: `inset 0 0 0 2px ${h.color}66` }}><Heart size={28} fill={h.color} stroke={h.color} /></div>
            <div>
              <div className="font-display text-xs font-bold uppercase tracking-widest text-white/60">Ecosystem health</div>
              <div className="font-display text-2xl font-bold">{h.score} <span className="text-base" style={{ color: h.color }}>{h.label}</span></div>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {h.parts.map((p) => (
              <div key={p.name}>
                <div className="flex justify-between text-[12px] font-semibold text-white/80"><span>{p.name}</span><span className="tabular-nums text-white/60">{p.got}/{p.max}</span></div>
                <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${(p.got / p.max) * 100}%`, background: p.got >= p.max ? '#28c76f' : p.got > 0 ? '#f0b429' : '#e5484d' }} /></div>
              </div>
            ))}
          </div>
          {h.tips.length > 0 && (
            <div className="mt-3 space-y-1.5 rounded-2xl bg-white/[0.06] p-3">
              <div className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider text-amber-300"><Lightbulb size={14} /> How to help it thrive</div>
              {h.tips.slice(0, 3).map((t) => <div key={t} className="text-[13px] leading-snug text-white/85">• {t}</div>)}
            </div>
          )}
        </div>
      </Popover>
    </div>
  );
}

/* ---------------- quests ---------------- */
export function Stars({ n, size = 14, className }: { n: number; size?: number; className?: string }) {
  return (
    <span className={clsx('inline-flex gap-0.5', className)} aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => <span key={i} style={{ fontSize: size, filter: i < n ? 'drop-shadow(0 1px 1px rgba(0,0,0,.35))' : 'grayscale(1) opacity(.35)' }}>⭐</span>)}
    </span>
  );
}

function QuestRow({ q, compact }: { q: Quest; compact?: boolean }) {
  return (
    <div className={clsx('flex items-start gap-2.5 rounded-2xl px-2.5 py-2', q.done ? 'opacity-60' : 'bg-white/[0.06]')}>
      <span className="mt-0.5 text-lg leading-none">{q.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={clsx('flex-1 font-display text-[13.5px] font-semibold leading-tight text-white', q.done && 'line-through decoration-white/40')}>{q.title}</span>
          <span className="shrink-0 rounded-full bg-amber-300/20 px-1.5 text-[10.5px] font-bold text-amber-200">+{q.xp}</span>
        </div>
        {!q.done && !compact && <div className="mt-0.5 text-[12px] leading-snug text-white/60">{q.hint}</div>}
        {!q.done && q.need > 1 && (
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#8f7bff] to-[#5ad1ff] transition-all duration-700" style={{ width: `${(q.cur / q.need) * 100}%` }} /></div>
            <span className="text-[10.5px] font-bold tabular-nums text-white/55">{q.cur}/{q.need}</span>
          </div>
        )}
      </div>
      {q.done ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#3ccf6e]" /> : <Circle size={18} className="mt-0.5 shrink-0 text-white/25" />}
    </div>
  );
}

/** compact floating quest tracker shown over the viewport */
export function QuestTracker({ game, onOpen, mobile }: { game: GameState; onOpen: () => void; mobile?: boolean }) {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('dd-quests-open') !== '0'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem('dd-quests-open', open ? '1' : '0'); } catch { /* ignore */ } }, [open]);
  const next = game.quests.filter((q) => !q.done).slice(0, mobile ? 1 : 3);
  if (!game.quests.length) return null;
  return (
    <div className={clsx('dd-glass pointer-events-auto rounded-3xl text-white', mobile ? 'w-[min(78vw,320px)]' : 'w-[300px]')}>
      <button className="flex w-full items-center gap-2 px-3.5 py-2.5" onClick={() => setOpen((v) => !v)}>
        <Trophy size={16} className="text-amber-300" />
        <span className="font-display text-[13px] font-bold uppercase tracking-wider">Quests</span>
        <Stars n={game.stars} size={12} />
        <span className="flex-1" />
        <span className="font-display text-xs font-bold tabular-nums text-white/70">{game.done}/{game.quests.length}</span>
        {open ? <ChevronUp size={16} className="text-white/60" /> : <ChevronDown size={16} className="text-white/60" />}
      </button>
      {open && (
        <div className="space-y-1.5 px-2 pb-2">
          {next.length === 0 ? <div className="px-2 pb-1 text-sm text-white/75">🎉 Every quest complete — superstar habitat!</div> : next.map((q) => <QuestRow key={q.id} q={q} compact={mobile} />)}
          <button onClick={onOpen} className="w-full rounded-2xl py-1.5 text-center font-display text-[12px] font-bold uppercase tracking-wider text-white/60 hover:bg-white/5 hover:text-white">All quests →</button>
        </div>
      )}
    </div>
  );
}

export function QuestLog({ game }: { game: GameState }) {
  const nextStar = game.stars >= 3 ? null : game.stars === 2 ? game.quests.length : game.stars === 1 ? 10 : 5;
  return (
    <div className="space-y-3">
      <div className="dd-card-dark flex items-center gap-4 rounded-3xl p-4 text-white">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-amber-300/15 text-4xl">🏆</div>
        <div className="flex-1">
          <Stars n={game.stars} size={24} />
          <div className="mt-1 text-sm text-white/75">{game.done} of {game.quests.length} quests done{nextStar ? ` · ${nextStar - game.done} more for the next star` : ' · all stars earned!'}</div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#ffe066] to-[#ffb020] transition-all" style={{ width: `${(game.done / Math.max(1, game.quests.length)) * 100}%` }} /></div>
        </div>
      </div>
      <div className="dd-card-dark grid gap-1.5 rounded-3xl p-2 sm:grid-cols-2">
        {game.quests.map((q) => <QuestRow key={q.id} q={q} />)}
      </div>
    </div>
  );
}
