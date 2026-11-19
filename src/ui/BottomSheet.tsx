import { useEffect, useRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';

/**
 * Touch-first bottom sheet: drag the handle/header to resize, fling to snap.
 * Snap points are fractions of the parent's height (smallest = peek).
 */
export function BottomSheet({ snaps, index, onIndex, header, children, className, onHeight }: {
  snaps: number[]; index: number; onIndex: (i: number) => void; header?: ReactNode; children: ReactNode; className?: string; onHeight?: (px: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [parentH, setParentH] = useState(600);
  const [drag, setDrag] = useState<number | null>(null);
  const st = useRef<{ y0: number; h0: number; t: number; lastY: number; lastT: number; v: number; moved: boolean } | null>(null);
  useEffect(() => {
    const p = ref.current?.parentElement;
    if (!p) return;
    const ro = new ResizeObserver(() => setParentH(p.clientHeight));
    ro.observe(p);
    setParentH(p.clientHeight);
    return () => ro.disconnect();
  }, []);
  const target = Math.round(snaps[Math.min(index, snaps.length - 1)] * parentH);
  const h = drag ?? target;
  useEffect(() => { onHeight?.(h); }, [h, onHeight]);
  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    st.current = { y0: e.clientY, h0: h, t: performance.now(), lastY: e.clientY, lastT: performance.now(), v: 0, moved: false };
  };
  const move = (e: React.PointerEvent) => {
    const s = st.current;
    if (!s) return;
    const dy = s.y0 - e.clientY;
    if (Math.abs(dy) > 4) s.moved = true;
    const now = performance.now();
    s.v = (s.lastY - e.clientY) / Math.max(1, now - s.lastT); // px/ms, + = up
    s.lastY = e.clientY; s.lastT = now;
    const min = snaps[0] * parentH * 0.7, max = snaps[snaps.length - 1] * parentH * 1.03;
    setDrag(Math.max(min, Math.min(max, s.h0 + dy)));
  };
  const up = () => {
    const s = st.current;
    st.current = null;
    if (!s) return;
    if (!s.moved) { setDrag(null); onIndex(index >= snaps.length - 1 ? 0 : index + 1); return; } // tap the handle: step up, wrap to peek
    const cur = drag ?? target;
    // fling: velocity picks the direction, otherwise the nearest snap
    let best = 0;
    if (Math.abs(s.v) > 0.5) {
      const dir = s.v > 0 ? 1 : -1;
      const sorted = snaps.map((f, i) => ({ i, px: f * parentH }));
      const cand = dir > 0 ? sorted.find((x) => x.px > cur + 10) : [...sorted].reverse().find((x) => x.px < cur - 10);
      best = cand ? cand.i : dir > 0 ? snaps.length - 1 : 0;
    } else {
      let d = Infinity;
      snaps.forEach((f, i) => { const dd = Math.abs(f * parentH - cur); if (dd < d) { d = dd; best = i; } });
    }
    setDrag(null);
    onIndex(best);
    if ('vibrate' in navigator) try { navigator.vibrate(6); } catch { /* ignore */ }
  };
  return (
    <div ref={ref} className={clsx('dd-sheet absolute inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-[28px]', drag === null && 'dd-sheet-anim', className)} style={{ height: h }}>
      <div className="shrink-0 touch-none select-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="flex justify-center pb-1 pt-2"><span className="h-1.5 w-11 rounded-full bg-black/20" /></div>
        {header}
      </div>
      <div className={clsx('min-h-0 flex-1', index === 0 && drag === null && 'invisible')}>{children}</div>
    </div>
  );
}
