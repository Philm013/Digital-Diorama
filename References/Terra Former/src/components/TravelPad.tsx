import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

type Props = { onAxis: (x: number, y: number) => void };

/** Analogue-style travel pad: one pointer, any direction, held = keep walking. */
export function TravelPad({ onAxis }: Props) {
  const dialRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [axis, setAxis] = useState({ x: 0, y: 0 });
  const nudgeTimer = useRef<number | null>(null);

  const push = useCallback((x: number, y: number) => {
    setAxis((current) => (Math.abs(current.x - x) < 0.02 && Math.abs(current.y - y) < 0.02 ? current : { x, y }));
    onAxis(x, y);
  }, [onAxis]);

  const read = useCallback((event: PointerEvent | React.PointerEvent<HTMLDivElement>) => {
    const dial = dialRef.current;
    if (!dial) return;
    const rect = dial.getBoundingClientRect();
    const dx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const dy = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    const length = Math.hypot(dx, dy);
    const scale = length > 1 ? 1 / length : 1;
    push(dx * scale, -dy * scale);
  }, [push]);

  useEffect(() => {
    const move = (event: PointerEvent) => { if (dragging.current) read(event); };
    const end = () => { if (!dragging.current) return; dragging.current = false; push(0, 0); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      onAxis(0, 0);
    };
  }, [push, read, onAxis]);

  useEffect(() => () => { if (nudgeTimer.current) clearTimeout(nudgeTimer.current); onAxis(0, 0); }, [onAxis]);

  const nudge = (x: number, y: number) => {
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    push(x, y);
    nudgeTimer.current = window.setTimeout(() => push(0, 0), 460);
  };

  return (
    <div className="travel-pad" role="group" aria-label="Travel controls">
      <div
        ref={dialRef}
        className="pad-dial"
        role="application"
        tabIndex={0}
        aria-label="Drag to walk the world"
        onPointerDown={(event) => { event.preventDefault(); dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); read(event); }}
        onPointerMove={(event) => { if (dragging.current) read(event); }}
        onPointerUp={() => { dragging.current = false; push(0, 0); }}
        onKeyDown={(event) => {
          const map: Record<string, [number, number]> = { w: [0, 1], arrowup: [0, 1], s: [0, -1], arrowdown: [0, -1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
          const next = map[event.key.toLowerCase()];
          if (next) { event.preventDefault(); push(next[0], next[1]); }
        }}
        onKeyUp={(event) => { if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(event.key.toLowerCase())) push(0, 0); }}
        style={{ ['--pad-x' as string]: `${axis.x * 26}px`, ['--pad-y' as string]: `${-axis.y * 26}px` }}
      >
        <span className="pad-ring" />
        <span className="pad-ticks" aria-hidden="true" />
        <span className="pad-knob" data-live={axis.x || axis.y ? 'yes' : 'no'} />
        <i className="pad-north" aria-hidden="true">N</i>
      </div>
      <div className="pad-steps">
        <button aria-label="Step north" onClick={() => nudge(0, 1)}><ChevronDown size={13} style={{ transform: 'rotate(180deg)' }} /></button>
        <div>
          <button aria-label="Step west" onClick={() => nudge(-1, 0)}><ChevronLeft size={13} /></button>
          <button aria-label="Step south" onClick={() => nudge(0, -1)}><ChevronDown size={13} /></button>
          <button aria-label="Step east" onClick={() => nudge(1, 0)}><ChevronRight size={13} /></button>
        </div>
      </div>
      <p>Drag the dial to walk. <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> also work, <kbd>Shift</kbd> to run.</p>
    </div>
  );
}
