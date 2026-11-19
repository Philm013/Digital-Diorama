import { useEffect, useRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';

/**
 * The phone panel for Build and Code.
 *
 * - `split` (portrait): sits in the page flow under the 3D view, so a smaller viewer always stays
 *   visible above it and the panel gets most of the screen. Drag the grip/header to resize, fling
 *   to snap, tap the grip to step through the sizes. Snaps are fractions of the parent's height,
 *   or pixels when > 1; the first one is the "peek" that only shows the header.
 * - `side` (landscape phones): a column beside the viewer.
 */
export function BottomSheet({ snaps, index, onIndex, header, children, className, layout = 'split' }: {
  snaps: number[]; index: number; onIndex: (i: number) => void; header?: ReactNode; children: ReactNode; className?: string; layout?: 'split' | 'side';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [parentH, setParentH] = useState(600);
  const [drag, setDrag] = useState<number | null>(null);
  const st = useRef<{ y0: number; h0: number; lastY: number; lastT: number; v: number; moved: boolean; onButton: boolean } | null>(null);
  useEffect(() => {
    const p = ref.current?.parentElement;
    if (!p) return;
    const ro = new ResizeObserver(() => setParentH(p.clientHeight));
    ro.observe(p);
    setParentH(p.clientHeight);
    return () => ro.disconnect();
  }, []);
  const px = (f: number) => (f > 1 ? f : f * parentH);
  const target = Math.round(px(snaps[Math.min(index, snaps.length - 1)]));
  const h = drag ?? target;
  // The whole header is a handle. A press on one of its buttons (the tabs) stays a tap unless it
  // moves: phones retarget touches near the thin grip to the nearest button, so drags often start there.
  const down = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('input, select, textarea, a')) return;
    const onButton = !!t.closest('button');
    if (!onButton) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    st.current = { y0: e.clientY, h0: h, lastY: e.clientY, lastT: performance.now(), v: 0, moved: false, onButton };
  };
  const move = (e: React.PointerEvent) => {
    const s = st.current;
    if (!s) return;
    const dy = s.y0 - e.clientY;
    if (!s.moved && Math.abs(dy) > (s.onButton ? 10 : 4)) {
      s.moved = true;
      // capturing now means the release won't count as a click on the button
      if (s.onButton) try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    }
    if (!s.moved) return;
    const now = performance.now();
    s.v = (s.lastY - e.clientY) / Math.max(1, now - s.lastT); // px/ms, + = up
    s.lastY = e.clientY; s.lastT = now;
    const min = px(snaps[0]) * 0.9, max = px(snaps[snaps.length - 1]) * 1.02;
    setDrag(Math.max(min, Math.min(max, s.h0 + dy)));
  };
  const up = () => {
    const s = st.current;
    st.current = null;
    if (!s) return;
    if (!s.moved) { if (!s.onButton) { setDrag(null); onIndex(index >= snaps.length - 1 ? 0 : index + 1); } return; } // tap the grip: step up, wrap to peek
    const cur = drag ?? target;
    // fling: velocity picks the direction, otherwise the nearest snap
    let best = 0;
    if (Math.abs(s.v) > 0.5) {
      const dir = s.v > 0 ? 1 : -1;
      const sorted = snaps.map((f, i) => ({ i, px: px(f) }));
      const cand = dir > 0 ? sorted.find((x) => x.px > cur + 10) : [...sorted].reverse().find((x) => x.px < cur - 10);
      best = cand ? cand.i : dir > 0 ? snaps.length - 1 : 0;
    } else {
      let d = Infinity;
      snaps.forEach((f, i) => { const dd = Math.abs(px(f) - cur); if (dd < d) { d = dd; best = i; } });
    }
    setDrag(null);
    onIndex(best);
    if ('vibrate' in navigator) try { navigator.vibrate(6); } catch { /* ignore */ }
  };
  if (layout === 'side') {
    return (
      <div ref={ref} className={clsx('dd-sheet dd-sheet-side relative z-30 flex h-full shrink-0 flex-col overflow-hidden', className)}>
        <div className="shrink-0 pt-2">{header}</div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    );
  }
  return (
    // -mt-4: the rounded top corners overlap the viewer a little instead of leaving gaps
    <div ref={ref} className={clsx('dd-sheet relative z-30 -mt-4 flex shrink-0 flex-col overflow-hidden rounded-t-[22px]', drag === null && 'dd-sheet-anim', className)} style={{ height: h }}>
      <div className="shrink-0 touch-none select-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="flex justify-center pb-1.5 pt-2"><span className="h-1.5 w-10 rounded-full bg-black/20" /></div>
        {header}
      </div>
      <div className={clsx('min-h-0 flex-1', index === 0 && drag === null && 'invisible')}>{children}</div>
    </div>
  );
}
