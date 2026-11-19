import { useRef, useState } from 'react';
import { haptic } from './feedback';

/**
 * Drag a sheet down by its header to put it away. Returns the offset to apply while dragging
 * and the pointer handlers for the header. A press on a button in the header stays a tap unless
 * it moves (phones retarget touches near a thin grip to the nearest button, so drags often start
 * there); once it moves, the header captures the pointer so the release doesn't click the button.
 */
export function useSheetDrag(onDismiss: () => void, enabled = true) {
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const st = useRef<{ y0: number; lastY: number; lastT: number; v: number; moved: boolean; onButton: boolean; h: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, select, textarea, a, [data-no-drag]')) return;
    const onButton = !!t.closest('button');
    if (!onButton) e.currentTarget.setPointerCapture(e.pointerId);
    const sheet = e.currentTarget.closest('[data-sheet]') as HTMLElement | null;
    st.current = { y0: e.clientY, lastY: e.clientY, lastT: performance.now(), v: 0, moved: false, onButton, h: sheet?.offsetHeight ?? 500 };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const s = st.current;
    if (!s) return;
    const d = e.clientY - s.y0;
    if (!s.moved) {
      if (Math.abs(d) < (s.onButton ? 10 : 4)) return;
      s.moved = true;
      setDragging(true);
      if (s.onButton) try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    }
    const now = performance.now();
    s.v = (e.clientY - s.lastY) / Math.max(1, now - s.lastT); // px/ms, + = down
    s.lastY = e.clientY;
    s.lastT = now;
    // down follows the finger; up only gives a little, like a rubber band
    setDy(d >= 0 ? d : -Math.min(16, Math.sqrt(-d) * 2));
  };
  const end = () => {
    const s = st.current;
    st.current = null;
    if (!s?.moved) return;
    setDragging(false);
    setDy(0);
    const d = s.lastY - s.y0;
    if (d > Math.min(150, s.h * 0.25) || (s.v > 0.5 && d > 24)) { haptic(8); dismiss.current(); }
  };
  return { dy, dragging, handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end } };
}
