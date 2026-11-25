import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { useBackLayer } from './backStack';
import { useSheetDrag } from './sheetDrag';
import { useLayout } from './shell';
import { InTray, Tray, TrayHeader } from './Tray';

/**
 * Where a screen's panels go: an empty element covering the area between its top bar and its
 * tab bar (or the bottom of the screen when the tabs sit in the top bar).
 */
const Host = createContext<HTMLElement | null>(null);
export const PanelHost = Host.Provider;

/** the open dialogs and panels, so a tab bar can close them all */
const live = new Set<() => void>();
/** Close every open dialog and panel: a tab or another mode was chosen. */
export function closePanels() { for (const close of [...live]) close(); }

/**
 * A dialog that never leaves anyone stuck.
 *
 * - Wide screens: centred over everything, with a dimmed backdrop.
 * - Phones and tablets: a panel that pulls out over the screen's content (`PanelHost`) like the
 *   home screen's trays. The top bar and the tab bar stay in view and keep working, so any tab or
 *   button leads on from it, and its title bar with ✕ is always on screen: the panel is sized by
 *   the room between the bars, not by viewport units (which phone browsers measure past their
 *   toolbars, pushing the top of a tall sheet — and its ✕ — off the screen).
 *
 * ✕, Escape (when it is on top), the phone's Back button, tapping outside and dragging it down by
 * its title bar all close it. A dialog opened from inside a panel or tray stacks on top of it.
 */
export function Modal({ open, onClose, title, children, wide, closeOnCoach, label, icon, subtitle, accent, titleId }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode;
  /** a big one: wider on wide screens, and the full height of the room on phones (the rest fit their contents) */
  wide?: boolean | 'xl';
  /** close when a lesson card is tapped (the lesson has moved on to something this covers) */
  closeOnCoach?: boolean;
  /** the dialog's name for screen readers when the title is not plain text */
  label?: string;
  /** a picture beside the title, and a line under it */
  icon?: ReactNode; subtitle?: ReactNode; accent?: string;
  /** a fixed id for the title (otherwise one is made up) */
  titleId?: string;
}) {
  const { wide: roomy, landscape } = useLayout();
  const host = useContext(Host);
  const nested = useContext(InTray);
  const panel = !roomy && !!host;
  const isTop = useBackLayer(open, onClose);
  const close = useRef(onClose);
  close.current = onClose;
  const autoId = useId();
  const tid = titleId ?? autoId;
  // what it showed, kept while it slides away
  const last = useRef({ title, children, icon, subtitle });
  if (open) last.current = { title, children, icon, subtitle };
  useEffect(() => {
    if (!open) return;
    const fn = () => close.current();
    live.add(fn);
    // (the lesson card sits above every dialog, so its taps never reach the backdrop; a click
    // rather than a press, so a key on the card's buttons counts too)
    const coach = (e: MouseEvent) => { if (closeOnCoach && (e.target as Element | null)?.closest?.('[data-coach]')) close.current(); };
    window.addEventListener('click', coach, true);
    return () => { live.delete(fn); window.removeEventListener('click', coach, true); };
  }, [open, closeOnCoach]);

  if (panel) {
    const s = last.current;
    const full = !!wide;
    return createPortal(
      <Tray open={open} onClose={onClose} isTop={isTop} labelId={tid} label={label} layer="z-[45]"
        className={clsx(
          // a panel opened from inside another one leaves its top edge in view
          full ? (nested ? 'top-5' : 'top-2') : nested ? 'max-h-[calc(100%-20px)]' : 'max-h-[calc(100%-8px)]',
          full ? 'max-w-[1180px]' : 'sm:max-w-xl',
          // with the tabs in the top bar the panel reaches the bottom of the screen (and the home indicator)
          landscape ? '[--tray-pb:max(env(safe-area-inset-bottom),12px)]' : '[--tray-pb:16px]',
        )}
        header={<div className="border-b border-black/[0.06]"><TrayHeader id={tid} icon={s.icon} accent={accent} title={s.title} subtitle={s.subtitle} onClose={onClose} /></div>}>
        <div data-panel-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[var(--tray-pb)] pl-[max(env(safe-area-inset-left),16px)] pr-[max(env(safe-area-inset-right),16px)] pt-3">{s.children}</div>
      </Tray>,
      host,
    );
  }
  return <Dialog open={open} onClose={onClose} isTop={isTop} title={title} wide={wide} label={label} icon={icon} subtitle={subtitle} accent={accent} titleId={tid} sheet={!roomy}>{children}</Dialog>;
}

/**
 * Centred over everything (drawn at the top of the page, so nothing it was opened from can box it
 * in) — or, on a narrow screen without a panel host, a sheet from the bottom that can be dragged
 * down by its title bar.
 */
function Dialog({ open, onClose, isTop, title, children, wide, label, icon, subtitle, accent, titleId, sheet }: {
  open: boolean; onClose: () => void; isTop: () => boolean; title: ReactNode; children: ReactNode; wide?: boolean | 'xl'; label?: string;
  icon?: ReactNode; subtitle?: ReactNode; accent?: string; titleId: string; sheet: boolean;
}) {
  const close = useRef(onClose);
  close.current = onClose;
  const [leaving, setLeaving] = useState(false);
  const drag = useSheetDrag(() => { setLeaving(true); window.setTimeout(() => close.current(), 180); }, open && sheet);
  useEffect(() => { if (!open) setLeaving(false); }, [open]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && isTop()) close.current(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, isTop]);
  if (!open) return null;
  return createPortal(
    <div className={clsx('dd-modal-bg fixed inset-0 z-[65] flex justify-center bg-black/45 backdrop-blur-[3px] transition-opacity duration-200', sheet ? 'items-end p-0' : 'items-center p-6', leaving && 'opacity-0')} onClick={onClose}>
      <div data-sheet role="dialog" aria-modal="true" aria-labelledby={label ? undefined : titleId} aria-label={label} onClick={(e) => e.stopPropagation()}
        className={clsx('dd-panel dd-modal dd-modal-h flex w-full flex-col overflow-hidden', sheet ? 'rounded-t-[28px]' : 'rounded-[28px]', !drag.dragging && 'dd-sheet-snap', wide === 'xl' ? 'sm:max-w-6xl' : wide ? 'sm:max-w-4xl' : 'sm:max-w-lg')}
        style={leaving ? { transform: 'translateY(105%)' } : drag.dy ? { transform: `translateY(${drag.dy}px)` } : undefined}>
        <div data-sheet-head className={clsx('border-b border-black/5', sheet ? 'touch-none select-none' : 'pt-3')} {...drag.handlers}>
          {sheet && <div className="flex justify-center pb-1.5 pt-2"><span className="h-1.5 w-11 rounded-full bg-black/15" /></div>}
          <TrayHeader id={titleId} icon={icon} accent={accent} title={title} subtitle={subtitle} onClose={onClose} />
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-4 sm:px-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
