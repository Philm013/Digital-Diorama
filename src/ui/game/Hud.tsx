import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { starGoals, type Health } from '../../game/ecology';
import { Modal } from '../common';
import { FEATURES, needFor, nextStage, type Stage } from '../../game/unlocks';
import { BIOME_BY_ID } from '../../biomes/templates';
import { useProfile } from './useGame';
import { ChevronDown, ChevronUp, Heart, Trophy, Lightbulb, CheckCircle2, Circle, GraduationCap } from 'lucide-react';
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
    <button onClick={onClick} className="dd-hudchip flex h-11 items-center gap-2 rounded-2xl pl-1 pr-3" title={`Level ${L.level} ${L.rank} — ${L.into}/${L.need} XP to the next level`} data-popover-anchor data-tour="xp">
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
/**
 * The heart in the top bar. Tapping it explains the score: in a popover under it on wide screens,
 * and in a panel from the bottom of the screen on phones (where a popover would hang off the edge).
 */
export function HealthChip({ game, compact, sheet }: { game: GameState; compact?: boolean; /** phones: the details open as a bottom panel */ sheet?: boolean }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const h = game.health;
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="dd-hudchip flex h-11 items-center gap-2 rounded-2xl px-2.5" title="Ecosystem health" aria-label={`Ecosystem health: ${h.score} out of 100, ${h.label}`} aria-expanded={open} aria-haspopup="dialog" data-popover-anchor data-tour="health">
        <span className="relative grid h-7 w-7 place-items-center rounded-full" style={{ background: h.color + '33' }}>
          <Heart size={16} fill={h.color} stroke={h.color} className={h.score >= 85 ? 'dd-beat' : ''} />
        </span>
        <span className="flex flex-col items-start leading-none">
          <span className="font-display text-[15px] font-bold text-white tabular-nums">{h.score}{!compact && <span className="ml-1 text-[11px] font-semibold text-white/60">/100</span>}</span>
          {!compact && <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: h.color }}>{h.label}</span>}
        </span>
      </button>
      {sheet ? (
        <Modal open={open} onClose={close} sheet closeOnCoach label="Ecosystem health"
          title={<span className="flex items-center gap-2"><Heart size={20} fill={h.color} stroke={h.color} /> Ecosystem health</span>}>
          <div className="space-y-3" data-tour="health-pop">
            <div className="dd-card-dark rounded-3xl p-4 text-white"><HealthScore h={h} caption="How well your habitat can keep its plants and animals alive, out of 100." /></div>
            <HealthParts h={h} />
          </div>
        </Modal>
      ) : (
        <Popover open={open} onClose={close} className="w-[min(92vw,340px)]">
          <div className="dd-card-dark rounded-3xl p-4 text-white" data-tour="health-pop">
            <HealthScore h={h} />
            <HealthParts h={h} dark />
          </div>
        </Popover>
      )}
    </div>
  );
}

/** the score; `caption` (the phone panel, whose title already names it) says what it means instead */
function HealthScore({ h, caption }: { h: Health; caption?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl" style={{ background: h.color + '2a', boxShadow: `inset 0 0 0 2px ${h.color}66` }}><Heart size={28} fill={h.color} stroke={h.color} /></div>
      <div className="min-w-0">
        {!caption && <div className="font-display text-xs font-bold uppercase tracking-widest text-white/60">Ecosystem health</div>}
        <div className="font-display text-2xl font-bold">{h.score}<span className="text-base text-white/50">/100</span> <span className="text-base" style={{ color: h.color }}>{h.label}</span></div>
        {caption && <div className="mt-0.5 text-[12.5px] leading-snug text-white/65">{caption}</div>}
      </div>
    </div>
  );
}

/** each part of the score as a bar, and what to add next */
function HealthParts({ h, dark }: { h: Health; dark?: boolean }) {
  return (
    <>
      <div className={clsx('space-y-2', dark ? 'mt-3' : 'rounded-3xl bg-black/[0.03] p-3.5 ring-1 ring-black/5')}>
        {!dark && <div className="font-display text-[12px] font-bold uppercase tracking-wider text-ink/50">What makes it healthy</div>}
        {h.parts.map((p) => (
          <div key={p.name}>
            <div className={clsx('flex justify-between font-semibold', dark ? 'text-[12px] text-white/80' : 'text-[13px] text-ink/80')}><span>{p.name}</span><span className={clsx('tabular-nums', dark ? 'text-white/60' : 'text-ink/50')}>{p.got}/{p.max}</span></div>
            <div className={clsx('mt-0.5 h-2 overflow-hidden rounded-full', dark ? 'bg-white/10' : 'bg-black/10')}><div className="h-full rounded-full transition-all duration-700" style={{ width: `${(p.got / p.max) * 100}%`, background: p.got >= p.max ? '#28c76f' : p.got > 0 ? '#f0b429' : '#e5484d' }} /></div>
          </div>
        ))}
      </div>
      {h.tips.length > 0 && (
        <div className={clsx('space-y-1.5 rounded-2xl p-3', dark ? 'mt-3 bg-white/[0.06]' : 'bg-amber-50 ring-1 ring-amber-200')}>
          <div className={clsx('flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider', dark ? 'text-amber-300' : 'text-amber-700')}><Lightbulb size={14} /> How to help it thrive</div>
          {h.tips.slice(0, dark ? 3 : 5).map((t) => <div key={t} className={clsx('leading-snug', dark ? 'text-[13px] text-white/85' : 'text-[14px] text-ink/85')}>• {t}</div>)}
        </div>
      )}
      {h.tips.length === 0 && !dark && <div className="rounded-2xl bg-[#3ccf6e]/15 p-3 text-[14px] font-semibold text-[#1f7a3d] ring-1 ring-[#3ccf6e]/30">🌟 A thriving habitat — every part is in balance.</div>}
    </>
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

/** "Show me": starts the lesson for a quest (only offered for quests a lesson teaches) */
export type QuestLearn = ((questId: string) => void) | undefined;
function QuestRow({ q, compact, onLearn }: { q: Quest; compact?: boolean; onLearn?: QuestLearn }) {
  return (
    <div className={clsx('flex items-start gap-2.5 rounded-2xl px-2.5 py-2', q.done ? 'opacity-60' : 'bg-white/[0.06]')}>
      <span className="mt-0.5 text-lg leading-none">{q.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={clsx('flex-1 font-display text-[13.5px] font-semibold leading-tight text-white', q.done && 'line-through decoration-white/40')}>{q.title}</span>
          <span className="shrink-0 rounded-full bg-amber-300/20 px-1.5 text-[10.5px] font-bold text-amber-200">+{q.xp}</span>
        </div>
        {!q.done && !compact && <div className="mt-0.5 text-[12px] leading-snug text-white/60">{q.hint}</div>}
        {!q.done && onLearn && (
          <button type="button" onClick={() => onLearn(q.id)} data-tour={`quest-learn-${q.id}`}
            className="mt-1 flex h-7 items-center gap-1 rounded-lg bg-amber-300/15 px-2 font-display text-[11.5px] font-bold text-amber-200 ring-1 ring-amber-300/30 transition hover:bg-amber-300/25 [@media(pointer:coarse)]:h-8">
            <GraduationCap size={13} /> Show me how
          </button>
        )}
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
export function QuestTracker({ game, onOpen, mobile, learnable }: { game: GameState; onOpen: () => void; mobile?: boolean; learnable?: (questId: string) => QuestLearn }) {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('dd-quests-open') !== '0'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem('dd-quests-open', open ? '1' : '0'); } catch { /* ignore */ } }, [open]);
  const next = game.quests.filter((q) => !q.done).slice(0, mobile ? 1 : 3);
  if (!game.quests.length) return null;
  return (
    <div className={clsx('dd-glass pointer-events-auto rounded-3xl text-white', mobile ? 'w-[min(78vw,320px)]' : 'w-[300px]')} data-tour="quest-tracker">
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
          <ExpeditionStrip game={game} />
          {next.length === 0 ? <div className="px-2 pb-1 text-sm text-white/75">🎉 Every quest complete — superstar habitat!</div> : next.map((q, i) => <QuestRow key={q.id} q={q} compact={mobile} onLearn={i === 0 ? learnable?.(q.id) : undefined} />)}
          <button onClick={onOpen} className="w-full rounded-2xl py-1.5 text-center font-display text-[12px] font-bold uppercase tracking-wider text-white/60 hover:bg-white/5 hover:text-white">All quests →</button>
        </div>
      )}
    </div>
  );
}

export function QuestLog({ game, learnable }: { game: GameState; learnable?: (questId: string) => QuestLearn }) {
  const nextStar = game.stars >= 3 ? null : game.stars === 2 ? game.quests.length : game.stars === 1 ? 10 : 5;
  return (
    <div className="space-y-3" data-tour="quest-log">
      <div className="dd-card-dark flex items-center gap-4 rounded-3xl p-4 text-white">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-amber-300/15 text-4xl">🏆</div>
        <div className="flex-1">
          <Stars n={game.stars} size={24} />
          <div className="mt-1 text-sm text-white/75">{game.done} of {game.quests.length} quests done{nextStar ? ` · ${nextStar - game.done} more for the next star` : ' · all stars earned!'}</div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#ffe066] to-[#ffb020] transition-all" style={{ width: `${(game.done / Math.max(1, game.quests.length)) * 100}%` }} /></div>
        </div>
      </div>
      <ExpeditionStrip game={game} big />
      <div className="dd-card-dark grid gap-1.5 rounded-3xl p-2 sm:grid-cols-2">
        {game.quests.map((q) => <QuestRow key={q.id} q={q} onLearn={learnable?.(q.id)} />)}
      </div>
    </div>
  );
}

/** where this diorama stands on the ranger path: quests to go until the expedition is complete, and what that unlocks */
export function ExpeditionStrip({ game, big }: { game: GameState; big?: boolean }) {
  const profile = useProfile();
  if (!game.quests.length) return null;
  if (!game.expedition.counts) {
    return <div className={clsx('rounded-2xl bg-white/[0.06] px-3 py-2 text-white/70', big ? 'text-[13px]' : 'text-[11.5px] leading-snug')}>📚 A finished example to explore and learn from. Start your own expedition to move along the ranger path.</div>;
  }
  const goal = starGoals(game.quests)[1];
  const next = nextStage(profile);
  if (game.expedition.complete) {
    return <div className={clsx('rounded-2xl bg-[#3ccf6e]/15 px-3 py-2 font-semibold text-[#9df0b8] ring-1 ring-[#3ccf6e]/30', big ? 'text-[13px]' : 'text-[11.5px] leading-snug')}>✅ Expedition complete!{next ? ` Start a new one to unlock ${next.emoji} ${next.rank}.` : ''}</div>;
  }
  const left = Math.max(0, goal - game.done);
  return (
    <div className={clsx('rounded-2xl bg-amber-300/10 px-3 py-2 ring-1 ring-amber-300/25', big ? 'text-[13px]' : 'text-[11.5px] leading-snug')}>
      <div className="flex items-center gap-2 font-display font-bold text-amber-200">
        <span>🧭 Expedition</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-gradient-to-r from-[#ffe066] to-[#ffb020] transition-all duration-700" style={{ width: `${Math.min(1, game.done / goal) * 100}%` }} /></span>
        <span className="tabular-nums text-white/70">{Math.min(game.done, goal)}/{goal}</span>
      </div>
      <div className="mt-0.5 text-white/70">
        {left} more quest{left === 1 ? '' : 's'} to complete it{next && !profile.unlockAll && needFor(next.n, profile) === 1 ? <> and unlock {unlockSummary(next)}</> : null}.
      </div>
    </div>
  );
}

/** "🦩 Wetland, 🦁 Savanna, 🧩 Code and more" */
export function unlockSummary(s: Stage, max = 3) {
  const items = [...s.habitats.map((h) => BIOME_BY_ID[h]).filter(Boolean).map((b) => `${b.emoji} ${b.name.replace(/^(African|Tropical|Temperate|Prairie|Arctic|Boreal|Rocky|Coral|Wetland) /, '')}`), ...s.features.map((f) => `${FEATURES[f].emoji} ${FEATURES[f].name}`)];
  return items.length > max ? `${items.slice(0, max).join(', ')} and more` : items.join(', ');
}
