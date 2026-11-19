import { useEffect, useRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';
import { IconBtn } from './common';
import { useSheetDrag } from './sheetDrag';

/**
 * A tray that pulls out from the bottom of its parent — on phones it slides out from behind the
 * bottom tab bar — to browse and pick from without leaving the screen. Drag it down by its
 * header (or fling it) to put it away; tap the dimmed backdrop or press Escape to close.
 * The parent decides how tall it is (`className`), and keeps Back wired up (`useBackLayer`).
 */
export function Tray({ open, onClose, header, children, className, labelId, isTop }: {
  open: boolean; onClose: () => void; header: ReactNode; children: ReactNode; className?: string; labelId?: string;
  /** whether this tray is the top-most layer (Escape belongs to whatever is on top) */
  isTop?: () => boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // keep the content mounted while the tray slides away
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  const close = useRef(onClose);
  close.current = onClose;
  const top = useRef(isTop);
  top.current = isTop;
  const drag = useSheetDrag(onClose, open);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && (top.current?.() ?? true)) close.current(); };
    window.addEventListener('keydown', key);
    // move focus into the tray (for keyboards and screen readers) once it starts to slide in
    const t = window.setTimeout(() => panel.current?.focus({ preventScroll: true }), 40);
    return () => {
      window.removeEventListener('keydown', key);
      clearTimeout(t);
      if (prev && prev !== document.body && document.contains(prev) && panel.current?.contains(document.activeElement)) prev.focus({ preventScroll: true });
    };
  }, [open]);
  const visible = open || shown;
  return (
    <div className={clsx('absolute inset-0 z-30 overflow-hidden', !open && 'pointer-events-none')}>
      <div className={clsx('dd-tray-scrim absolute inset-0', open && 'is-on')} onClick={onClose} aria-hidden />
      <div
        ref={panel}
        data-sheet
        role="dialog"
        aria-labelledby={labelId}
        aria-hidden={!open || undefined}
        tabIndex={-1}
        className={clsx('dd-tray absolute inset-x-0 bottom-0 mx-auto flex w-full flex-col overflow-hidden outline-none', !drag.dragging && 'dd-tray-anim', className)}
        style={{ transform: open ? `translate3d(0, ${drag.dy}px, 0)` : 'translate3d(0, calc(100% + 40px), 0)', visibility: visible ? 'visible' : 'hidden' }}
        onTransitionEnd={(e) => { if (e.target === e.currentTarget && e.propertyName === 'transform' && !open) setShown(false); }}
      >
        <div className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing" {...drag.handlers}>
          <div className="flex justify-center pb-1.5 pt-2"><span className="h-1.5 w-10 rounded-full bg-black/20" /></div>
          {header}
        </div>
        <div className="relative min-h-0 flex-1">{visible && children}</div>
      </div>
    </div>
  );
}

/** Title row of a tray: an icon, a title and a line of detail, actions, and a close button. */
export function TrayHeader({ id, icon, title, subtitle, actions, onClose, accent = '#3f7d3a' }: {
  id?: string; icon?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; onClose: () => void; accent?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 pb-2.5 sm:px-5">
      {icon && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[22px] leading-none" style={{ background: `color-mix(in srgb, ${accent} 16%, white)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 30%, transparent)` }}>{icon}</span>}
      <div className="min-w-0 flex-1">
        <h2 id={id} className="truncate font-display text-[19px] font-bold leading-tight sm:text-[21px]">{title}</h2>
        {subtitle && <div className="truncate text-[12px] font-semibold text-ink/50">{subtitle}</div>}
      </div>
      {actions}
      <IconBtn label="Close" onClick={onClose} className="bg-black/[0.05] hover:bg-black/10"><X size={19} /></IconBtn>
    </div>
  );
}
