import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { FEATURES, STAGES, featureStage, habitatStage, needFor, type FeatureId } from '../../game/unlocks';
import { BIOME_BY_ID } from '../../biomes/templates';
import { Modal } from '../common';
import { useProfile } from './useGame';
import { uiSound } from '../feedback';

/** a small padlock to put on locked buttons and tiles */
export function LockBadge({ className = '' }: { className?: string }) {
  return <span className={`pointer-events-none grid h-[18px] w-[18px] place-items-center rounded-full bg-[#3d2a00]/80 text-[#ffd75e] shadow ${className}`} aria-hidden><Lock size={10} strokeWidth={3} /></span>;
}

/**
 * Explains a locked feature or habitat when someone taps it: what it is, which step of the ranger
 * path opens it and how many expeditions are still to go. Listens for `showLocked()`.
 */
export function LockedNotice() {
  const profile = useProfile();
  const [what, setWhat] = useState<FeatureId | { habitat: string } | null>(null);
  useEffect(() => {
    const fn = (e: Event) => { setWhat((e as CustomEvent<FeatureId | { habitat: string }>).detail); uiSound('tick'); };
    document.addEventListener('dd-locked', fn);
    return () => document.removeEventListener('dd-locked', fn);
  }, []);
  if (!what) return null;
  const isHab = typeof what === 'object';
  const b = isHab ? BIOME_BY_ID[what.habitat] : null;
  const meta = isHab ? null : FEATURES[what];
  const stage = STAGES[isHab ? habitatStage(what.habitat) : featureStage(what)];
  const need = needFor(stage.n, profile);
  const done = profile.completed.length;
  return (
    <Modal open onClose={() => setWhat(null)} title={<span className="flex items-center gap-2"><Lock size={18} className="text-amber-600" /> Not unlocked yet</span>}>
      <div className="space-y-3 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-[26px] bg-amber-100 text-5xl">{b?.emoji ?? meta?.emoji}</div>
        <div>
          <div className="font-display text-xl font-bold">{b?.name ?? meta?.name}</div>
          <p className="text-[13.5px] text-ink/65">{b?.tagline ?? meta?.what}</p>
        </div>
        <div className="rounded-2xl bg-amber-50 p-3 text-left ring-1 ring-amber-200">
          <div className="font-display text-[13px] font-bold text-amber-800">{stage.emoji} Unlocks at {stage.rank}</div>
          <p className="mt-0.5 text-[13px] text-ink/70">
            Complete {need === 1 ? '1 more expedition' : `${need} more expeditions`} to unlock it. An expedition is complete when one of your own dioramas earns ⭐⭐ (10 quests).
          </p>
          <div className="mt-2 flex gap-1">
            {STAGES.slice(1).map((s) => <span key={s.n} className={`h-2 flex-1 rounded-full ${done >= s.n ? 'bg-amber-500' : s.n === stage.n ? 'bg-amber-200 ring-1 ring-amber-500' : 'bg-black/10'}`} />)}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-ink/50">{done} expedition{done === 1 ? '' : 's'} completed</div>
        </div>
        <p className="text-[11.5px] text-ink/45">Teachers can unlock everything in Settings on the home screen.</p>
        <button type="button" onClick={() => setWhat(null)} className="dd-cta h-12 w-full rounded-2xl font-display text-lg font-bold text-white">Got it</button>
      </div>
    </Modal>
  );
}
