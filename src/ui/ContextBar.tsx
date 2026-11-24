import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { clsx } from 'clsx';
import { RotateCcw, RotateCw, Minus, Plus, Copy, Trash2, Crosshair, Blocks } from 'lucide-react';
import { useEngine, useEngineVersion } from './store';
import { haptic, uiSound } from './feedback';

/**
 * Quick actions for the selected object: turn, resize, copy, focus, delete, code.
 * Floats just above the object on desktop; `inline` renders it as a toolbar row
 * at the top of the phone panel, so it never covers the small 3D viewer.
 */
export function ContextBar({ onCode, inline }: { onCode: () => void; inline?: boolean }) {
  const engine = useEngine();
  useEngineVersion();
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const a = engine.getActor(engine.selectedId);
  useEffect(() => {
    const fn = (e: Event) => setDragging(!!(e as CustomEvent<boolean>).detail);
    document.addEventListener('dd-drag', fn);
    return () => document.removeEventListener('dd-drag', fn);
  }, []);
  useEffect(() => {
    if (inline || !a) return;
    let raf = 0;
    const v = new THREE.Vector3();
    const tick = () => {
      const el = ref.current;
      if (el && a.root.parent) {
        v.copy(a.root.position);
        v.y += a.height + 0.25;
        v.project(engine.camera);
        const w = engine.container.clientWidth, h = engine.container.clientHeight;
        const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
        const behind = v.z > 1;
        const bw = el.offsetWidth, bh = el.offsetHeight;
        const cx = Math.max(bw / 2 + 8, Math.min(w - bw / 2 - 8, x));
        const cy = Math.max(bh + 70, Math.min(h - 90, y));
        el.style.transform = `translate(${cx - bw / 2}px, ${cy - bh - 10}px)`;
        el.style.opacity = behind ? '0' : '1';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [a, inline, engine]);
  if (!a || a.isClone) return null;
  const act = (fn: () => void, sound: 'tick' | 'pop' | 'trash' = 'tick') => () => { fn(); haptic(8); uiSound(sound); };
  const turn = (deg: number) => act(() => { engine.pushUndo(); a.root.rotation.y -= (deg * Math.PI) / 180; engine.commitTransform(a); engine.changed(); });
  const size = (k: number) => act(() => { engine.pushUndo(); const s = THREE.MathUtils.clamp(a.root.scale.x * k, 0.25, 4); a.root.scale.setScalar(s); a.syncLabel(); a.updateRing(); engine.commitTransform(a); engine.changed(); });
  const B = ({ onClick, label, children, danger, solid, tour }: { onClick: () => void; label: string; children: React.ReactNode; danger?: boolean; solid?: boolean; tour?: string }) => (
    <button onClick={onClick} title={label} aria-label={label} data-tour={tour} className={clsx('grid place-items-center transition active:scale-90',
      inline ? 'h-10 min-w-0 flex-1 rounded-xl' : 'h-11 w-11 rounded-2xl',
      danger ? (inline ? 'text-red-600 active:bg-red-500/10' : 'text-[#ff8a8a] hover:bg-red-500/20')
        : solid ? 'bg-[#7c5cff] text-white hover:brightness-110'
          : inline ? 'text-ink/75 active:bg-black/10' : 'text-white hover:bg-white/15')}>{children}</button>
  );
  const sep = <span className={clsx('mx-0.5 h-6 w-px shrink-0', inline ? 'bg-black/10' : 'bg-white/15')} />;
  if (inline) {
    return (
      <div className="flex shrink-0 items-center gap-0.5 border-b border-black/5 bg-white/60 px-2 py-1" data-tour="context-bar">
        <B onClick={turn(-45)} label="Turn left"><RotateCcw size={18} /></B>
        <B onClick={turn(45)} label="Turn right" tour="ctx-turn"><RotateCw size={18} /></B>
        {sep}
        <B onClick={size(1 / 1.15)} label="Smaller"><Minus size={18} /></B>
        <B onClick={size(1.15)} label="Bigger" tour="ctx-bigger"><Plus size={18} /></B>
        {sep}
        <B onClick={act(() => void engine.duplicateActor(a.id), 'pop')} label="Duplicate (D)"><Copy size={17} /></B>
        <B onClick={act(() => engine.focusActor(a.id))} label="Focus (F)"><Crosshair size={17} /></B>
        <B onClick={act(() => engine.removeActor(a.id), 'trash')} label="Delete" danger><Trash2 size={17} /></B>
        <B onClick={() => { haptic(8); onCode(); }} label="Code it" solid><Blocks size={17} /></B>
      </div>
    );
  }
  return (
    <div ref={ref} data-tour="context-bar" className={clsx('dd-glass pointer-events-auto absolute left-0 top-0 z-30 flex items-center gap-0.5 rounded-[22px] p-1 transition-opacity', dragging && 'pointer-events-none opacity-0')}>
      <B onClick={turn(-45)} label="Turn left"><RotateCcw size={19} /></B>
      <B onClick={turn(45)} label="Turn right" tour="ctx-turn"><RotateCw size={19} /></B>
      {sep}
      <B onClick={size(1 / 1.15)} label="Smaller"><Minus size={19} /></B>
      <B onClick={size(1.15)} label="Bigger" tour="ctx-bigger"><Plus size={19} /></B>
      {sep}
      <B onClick={act(() => void engine.duplicateActor(a.id), 'pop')} label="Duplicate (D)"><Copy size={18} /></B>
      <B onClick={act(() => engine.focusActor(a.id))} label="Focus (F)"><Crosshair size={18} /></B>
      <B onClick={act(() => engine.removeActor(a.id), 'trash')} label="Delete" danger><Trash2 size={18} /></B>
      <B onClick={() => { haptic(8); onCode(); }} label="Code it" solid><Blocks size={18} /></B>
    </div>
  );
}
