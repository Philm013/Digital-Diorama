import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Check, ChevronRight, GraduationCap, Lock, Play, RotateCcw, Search } from 'lucide-react';
import { LESSONS, LESSON_BY_ID, UNITS, lessonOpen, nextLesson, type Lesson } from '../../learn/lessons';
import { CHALLENGES, GESTURES, HELP, KEYS, TEACHER_NOTES } from '../../learn/help';
import { useLearn } from '../../learn/store';
import { STAGES, featureStage, showLocked } from '../../game/unlocks';
import { updateProfile } from '../../game/progress';
import { useProfile } from '../game/useGame';
import { Toggle } from '../common';
import { uiSound } from '../feedback';

export type HubTab = 'lessons' | 'help' | 'keys' | 'teachers';
const TABS: [HubTab, string][] = [['lessons', '🎓 Lessons'], ['help', '❓ How do I…?'], ['keys', '⌨️ Shortcuts'], ['teachers', '🍎 Teachers']];

/**
 * Learn & help: Ranger training's lessons by unit (with what's done, what's next and what the
 * ranger path still has locked), answers to "How do I…?", shortcuts and gestures, and a guide for
 * teachers. Shown in the studio (lessons start right there) and on the home screen (they start in
 * a diorama).
 */
export function LearnHub({ onStart, tips, onTips, initialTab = 'lessons', note }: {
  onStart: (id: string, step?: number) => void;
  /** tips and the guided start (Settings) */
  tips: boolean;
  onTips: (v: boolean) => void;
  initialTab?: HubTab;
  /** a line under the summary, e.g. where lessons run from the home screen */
  note?: string;
}) {
  const [tab, setTab] = useState<HubTab>(initialTab);
  return (
    <div className="space-y-3" data-tour="learn-hub">
      <div className="dd-scroll-x -mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Learn and help">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); uiSound('tick'); }}
            className={clsx('h-10 shrink-0 rounded-2xl px-3.5 font-display text-[14px] font-semibold transition', tab === id ? 'dd-3d bg-ink text-white [--edge:#000]' : 'bg-black/[0.05] text-ink/65 hover:bg-black/10')}>{label}</button>
        ))}
      </div>
      {tab === 'lessons' && <Lessons onStart={onStart} note={note} />}
      {tab === 'help' && <HowDoI onStart={onStart} />}
      {tab === 'keys' && <Shortcuts />}
      {tab === 'teachers' && <Teachers tips={tips} onTips={onTips} />}
    </div>
  );
}

/* =============================== lessons =============================== */
function Lessons({ onStart, note }: { onStart: (id: string, step?: number) => void; note?: string }) {
  const learn = useLearn();
  const profile = useProfile();
  const done = LESSONS.filter((l) => learn.done.includes(l.id)).length;
  const open = LESSONS.filter((l) => lessonOpen(l, profile)).length;
  const resume = learn.active ?? learn.paused;
  const resumeLesson = resume ? LESSON_BY_ID[resume.id] : null;
  const next = nextLesson(learn.done, undefined, profile);
  const start = (l: Lesson, step = 0) => {
    if (!lessonOpen(l, profile)) { showLocked(l.needs!); return; }
    uiSound('pop');
    onStart(l.id, step);
  };
  return (
    <div className="space-y-4">
      <div className="dd-card-dark rounded-3xl p-3.5 text-white">
        <div className="flex items-center gap-3">
          <ProgressRing value={done / LESSONS.length} />
          <div className="min-w-0 flex-1">
            <div className="font-display text-[11.5px] font-bold uppercase tracking-[0.16em] text-amber-300">Ranger training</div>
            <div className="font-display text-[19px] font-bold leading-tight">{done} of {LESSONS.length} lessons done</div>
            <div className="text-[12px] text-white/60">{open < LESSONS.length ? `${open} open now · more unlock along the ranger path` : 'Every lesson is open'}</div>
          </div>
        </div>
        {resumeLesson ? (
          <button type="button" onClick={() => start(resumeLesson, resume!.step)} className="dd-cta mt-3 flex h-12 w-full items-center gap-2 rounded-2xl px-4 text-left font-display text-white">
            <Play size={18} fill="currentColor" className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-[16px] font-bold">Carry on: {resumeLesson.emoji} {resumeLesson.title}</span>
            <span className="shrink-0 text-[12px] font-semibold text-white/80">step {Math.min(resume!.step, resumeLesson.steps.length - 1) + 1} of {resumeLesson.steps.length}</span>
          </button>
        ) : next ? (
          <button type="button" onClick={() => start(next)} className="dd-cta mt-3 flex h-12 w-full items-center gap-2 rounded-2xl px-4 text-left font-display text-white">
            <Play size={18} fill="currentColor" className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-[16px] font-bold">{done ? 'Next' : 'Start'}: {next.emoji} {next.title}</span>
            <span className="shrink-0 text-[12px] font-semibold text-white/80">{next.minutes} min</span>
          </button>
        ) : (
          <div className="mt-3 rounded-2xl bg-[#3ccf6e]/15 px-3 py-2.5 text-[13px] font-semibold text-[#9df0b8] ring-1 ring-[#3ccf6e]/30">🎉 You’ve done every open lesson. Complete expeditions to unlock the rest.</div>
        )}
        {note && <p className="mt-2 text-[12px] leading-snug text-white/55">{note}</p>}
      </div>
      {UNITS.map((u) => {
        const list = LESSONS.filter((l) => l.unit === u.id);
        const n = list.filter((l) => learn.done.includes(l.id)).length;
        return (
          <section key={u.id} aria-label={u.title}>
            <div className="flex items-center gap-2 px-0.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-amber-100 text-[17px] leading-none">{u.emoji}</span>
              <h3 className="min-w-0 flex-1 truncate font-display text-[16px] font-bold">{u.title}</h3>
              <span className={clsx('shrink-0 rounded-full px-2 py-0.5 font-display text-[12px] font-bold tabular-nums', n === list.length ? 'bg-[#2fae4b] text-white' : 'bg-black/[0.06] text-ink/55')}>{n === list.length ? '✓ ' : ''}{n}/{list.length}</span>
            </div>
            <p className="mt-0.5 px-0.5 text-[12.5px] leading-snug text-ink/55">{u.blurb}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {list.map((l) => <LessonCard key={l.id} l={l} done={learn.done.includes(l.id)} open={lessonOpen(l, profile)} at={resume?.id === l.id ? resume.step : null} onClick={() => start(l, resume?.id === l.id ? resume.step : 0)} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function LessonCard({ l, done, open, at, onClick }: { l: Lesson; done: boolean; open: boolean; at: number | null; onClick: () => void }) {
  const stage = l.needs ? STAGES[featureStage(l.needs)] : null;
  return (
    <button type="button" onClick={onClick} data-lesson={l.id} className={clsx('dd-lesson-card flex min-w-0 items-center gap-3 rounded-2xl p-2.5 text-left', !open && 'opacity-70')}
      aria-label={`${l.title}${done ? ' (done)' : ''}${open ? '' : ' (locked)'}`}>
      <span className={clsx('relative grid h-12 w-12 shrink-0 place-items-center rounded-[16px] text-[26px] leading-none', done ? 'bg-[#e3f6e8]' : open ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-black/[0.05] grayscale')}>
        {l.emoji}
        {done && <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#2fae4b] text-white shadow ring-2 ring-white"><Check size={12} strokeWidth={3.5} /></span>}
        {!open && <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#ffd75e] text-[#3d2a00] shadow"><Lock size={11} strokeWidth={3} /></span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[15px] font-bold leading-tight">{l.title}</span>
        <span className="block text-[12px] leading-snug text-ink/60">{l.blurb}</span>
        <span className={clsx('mt-0.5 block text-[11px] font-bold', at !== null ? 'text-[#c27c0e]' : 'text-ink/40')}>
          {!open && stage ? `Unlocks at ${stage.emoji} ${stage.rank}` : at !== null ? `Under way · step ${Math.min(at, l.steps.length - 1) + 1} of ${l.steps.length}` : `${l.minutes} min · ${l.steps.length} steps · +${l.xp} XP`}
        </span>
      </span>
      <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-full', !open ? 'text-ink/35' : done ? 'bg-black/[0.05] text-ink/55' : 'bg-gradient-to-b from-[#4fd36a] to-[#2fae4b] text-white shadow-[0_2px_0_#1f7f35]')} aria-hidden>
        {!open ? <Lock size={16} /> : done ? <RotateCcw size={15} /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
      </span>
    </button>
  );
}

function ProgressRing({ value, size = 56 }: { value: number; size?: number }) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ffcf3d" strokeWidth={6} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <GraduationCap size={24} className="text-amber-200" />
    </span>
  );
}

/* =============================== how do I…? =============================== */
function HowDoI({ onStart }: { onStart: (id: string, step?: number) => void }) {
  const profile = useProfile();
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  const topics = useMemo(() => HELP.map((t) => ({ ...t, items: s ? t.items.filter((it) => `${it.q} ${it.a}`.toLowerCase().includes(s)) : t.items })).filter((t) => t.items.length), [s]);
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: camera, water, labels, code…" className="dd-input h-11 pl-9 text-[15px]" aria-label="Search help" />
      </div>
      {topics.length === 0 && <p className="py-6 text-center text-sm text-ink/55">Nothing matches “{q}”. Try another word — or follow a lesson.</p>}
      {topics.map((t) => (
        <section key={t.id}>
          <h3 className="mb-1.5 px-0.5 font-display text-[15px] font-bold">{t.emoji} {t.title}</h3>
          <div className="space-y-1.5">
            {t.items.map((it) => {
              const l = it.lesson ? LESSON_BY_ID[it.lesson] : null;
              const open = !l || lessonOpen(l, profile);
              return (
                <details key={it.q} open={!!s} className="group rounded-2xl bg-white ring-1 ring-black/[0.06]">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 font-display text-[14px] font-semibold leading-snug">
                    <span className="min-w-0 flex-1">{it.q}</span>
                    <ChevronRight size={16} className="shrink-0 text-ink/35 transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="px-3 pb-3 text-[13.5px] leading-relaxed text-ink/75">
                    {it.a}
                    {l && (
                      <button type="button" onClick={() => { if (!open) { showLocked(l.needs!); return; } uiSound('pop'); onStart(l.id); }}
                        className={clsx('mt-2 flex h-9 items-center gap-1.5 rounded-xl px-3 font-display text-[13px] font-bold', open ? 'bg-amber-100 text-[#6b4a00] ring-1 ring-amber-300 hover:bg-amber-200' : 'bg-black/[0.05] text-ink/50')}>
                        {open ? <GraduationCap size={15} /> : <Lock size={13} />} Show me: {l.emoji} {l.title}
                      </button>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/* =============================== shortcuts & gestures =============================== */
function Shortcuts() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section>
        <h3 className="mb-1.5 font-display text-[15px] font-bold">⌨️ Keyboard</h3>
        <div className="divide-y divide-black/5 overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.06]">
          {KEYS.map(([k, what]) => (
            <div key={k} className="flex items-center gap-3 px-3 py-2 text-[13px]">
              <span className="flex shrink-0 flex-wrap gap-1">{k.split(' · ').map((x) => <kbd key={x} className="rounded-md bg-black/[0.06] px-1.5 py-0.5 font-sans text-[11.5px] font-bold text-ink/70 shadow-[inset_0_-1px_0_rgba(0,0,0,.12)]">{x}</kbd>)}</span>
              <span className="min-w-0 flex-1 text-right text-ink/70">{what}</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-1.5 font-display text-[15px] font-bold">👆 Touch</h3>
        <div className="divide-y divide-black/5 overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.06]">
          {GESTURES.map(([g, what]) => (
            <div key={g} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
              <span className="shrink-0 font-display font-semibold text-ink/80">{g}</span>
              <span className="min-w-0 flex-1 text-right text-ink/70">{what}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 px-0.5 text-[12px] leading-snug text-ink/50">The phone’s Back button closes whatever is on top — a sheet, a tray, a diorama — like in other apps.</p>
      </section>
    </div>
  );
}

/* =============================== for teachers =============================== */
function Teachers({ tips, onTips }: { tips: boolean; onTips: (v: boolean) => void }) {
  const profile = useProfile();
  return (
    <div className="space-y-3">
      <div className="space-y-1 rounded-2xl bg-white p-3 ring-1 ring-black/[0.06]">
        <Toggle label="Unlock everything (teacher mode)" checked={!!profile.unlockAll} onChange={(v) => updateProfile({ unlockAll: v })} />
        <p className="text-[11.5px] leading-snug text-ink/50">Opens every habitat, tool, lesson and example diorama on this device.</p>
        <Toggle label="Tips and the guided start" checked={tips} onChange={onTips} />
        <p className="text-[11.5px] leading-snug text-ink/50">The welcome in a new diorama and one-time tips in Build and Code. Lessons stay available either way.</p>
      </div>
      {TEACHER_NOTES.map((n) => (
        <section key={n.title} className="rounded-2xl bg-white p-3.5 ring-1 ring-black/[0.06]">
          <h3 className="font-display text-[15px] font-bold">{n.emoji} {n.title}</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink/75">{n.text}</p>
          {n.list && <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[13.5px] leading-snug text-ink/75">{n.list.map((x) => <li key={x}>{x}</li>)}</ol>}
        </section>
      ))}
      <section className="rounded-2xl bg-amber-50 p-3.5 ring-1 ring-amber-200">
        <h3 className="font-display text-[15px] font-bold">🧩 Coding challenges</h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13.5px] leading-snug text-ink/80">{CHALLENGES.map((c) => <li key={c}>{c}</li>)}</ul>
      </section>
    </div>
  );
}
