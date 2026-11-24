import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { Lock, type LucideIcon } from 'lucide-react';
import { useMedia } from './hooks';

/**
 * The app shell shared by the home screen and the studio: a top bar, the screen's own content in
 * the middle, and a bottom tab bar on phones. Wide screens, and phones held sideways, move the
 * tabs into the top bar instead.
 */
export function useLayout() {
  const wide = useMedia('(min-width: 1024px)');
  const short = useMedia('(orientation: landscape) and (max-height: 540px)');
  const landscape = short && !wide;
  return { wide, landscape, phone: !wide && !landscape };
}

/** the dark top bar (grows by the notch / status bar when the app runs full screen) */
export function AppBar({ children, className, tall, hidden }: { children: ReactNode; className?: string; tall?: boolean; hidden?: boolean }) {
  return (
    <header className={clsx('dd-topbar pt-safe px-safe z-40 shrink-0', hidden && 'hidden', className)}>
      <div className={clsx('flex items-center gap-1.5 px-2 sm:gap-2 sm:px-3', tall ? 'h-[60px]' : 'h-[52px]')}>{children}</div>
    </header>
  );
}

export interface ShellTab<T extends string> { id: T; label: string; icon: LucideIcon; title?: string; badge?: ReactNode; /** further along the ranger path: shown with a padlock */ locked?: boolean }

/** the bottom tab bar on phones */
export function TabBar<T extends string>({ tabs, active, onSelect, label, tour }: { tabs: ShellTab<T>[]; active: T | null; onSelect: (id: T) => void; label: string; /** the tab bar's name for lessons (each tab is `tab-<id>`) */ tour?: string }) {
  return (
    <nav aria-label={label} className="dd-bottomnav pb-safe px-safe z-40 shrink-0" data-tour={tour}>
      <div className="flex justify-around gap-1 px-2 pt-1">
        {tabs.map(({ id, label: text, icon: Icon, title, badge, locked }) => {
          const on = id === active;
          return (
            <button key={id} type="button" onClick={() => onSelect(id)} aria-current={on ? 'page' : undefined} title={title} data-tour={`tab-${id}`}
              className={clsx('relative flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl font-display text-[11.5px] font-semibold transition', on ? 'bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12)]' : 'text-white/60 active:bg-white/10')}>
              <span className="relative">
                <Icon size={20} strokeWidth={on ? 2.4 : 2} className={locked ? 'opacity-50' : undefined} />
                {locked && <span className="absolute -right-2.5 -top-1.5"><LockMini /></span>}
                {badge != null && badge !== false && (
                  <span className="absolute -right-3 -top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[#ffbf2e] px-1 text-[10px] font-bold leading-none text-[#3d2a00] shadow-[0_0_0_2px_#141e18]">{badge}</span>
                )}
              </span>
              <span className="max-w-full truncate px-0.5">{text}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** segmented tabs with a sliding highlight, for the top bar */
export function TopTabs<T extends string>({ tabs, active, onSelect, compact, width = 112, compactWidth = 76, tour }: {
  tabs: ShellTab<T>[]; active: T | null; onSelect: (id: T) => void; compact?: boolean; width?: number; compactWidth?: number; tour?: string;
}) {
  const i = tabs.findIndex((t) => t.id === active);
  return (
    <nav className={clsx('dd-modes relative flex shrink-0 rounded-[18px] p-1', compact ? 'ml-1' : 'ml-2')} role="tablist" data-tour={tour}>
      {i >= 0 && <span className="dd-mode-ind absolute bottom-1 left-1 top-1 rounded-[14px]" style={{ width: `calc((100% - 8px) / ${tabs.length})`, transform: `translateX(${i * 100}%)` }} />}
      {tabs.map(({ id, label, icon: Icon, title, locked }) => (
        <button key={id} type="button" role="tab" aria-selected={id === active} onClick={() => onSelect(id)} title={title ?? label} style={{ width: compact ? compactWidth : width }} data-tour={`tab-${id}`}
          className={clsx('relative z-10 flex items-center justify-center gap-1.5 rounded-[14px] font-display font-semibold transition-colors', compact ? 'h-9 text-[13px]' : 'h-10 text-[15px]', id === active ? 'text-ink' : 'text-white/75 hover:text-white')}>
          {locked ? <LockMini /> : <Icon size={compact ? 15 : 17} strokeWidth={2.3} className="shrink-0" />}<span className={clsx('truncate', locked && 'opacity-60')}>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function LockMini() {
  return <span className="grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full bg-[#ffd75e] text-[#3d2a00] shadow" aria-label="locked"><Lock size={10} strokeWidth={3} /></span>;
}
