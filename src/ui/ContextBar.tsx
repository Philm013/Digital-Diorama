import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { clsx } from 'clsx';
import { RotateCcw, RotateCw, Minus, Plus, Copy, Trash2, Crosshair, Blocks } from 'lucide-react';
import { useEngine, useEngineVersion } from './store';
import { haptic, uiSound } from './feedback';

/**
 * Quick actions for the selected object, floating just above it (desktop) or
 * docked above the bottom sheet (phones): turn, resize, copy, delete, focus, code.
 */
export function ContextBar({ docked, bottom = 0, onCode }: { docked?: boolean; bottom?: number; onCode: () => void }) {
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
    if (docked || !a) return;
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
  }, [a, docked, engine]);
  if (!a || a.isClone) return null;
  const act = (fn: () => void, sound: 'tick' | 'pop' | 'trash' = 'tick') => () => { fn(); haptic(8); uiSound(sound); };
  const turn = (deg: number) => act(() => { engine.pushUndo(); a.root.rotation.y -= (deg * Math.PI) / 180; engine.commitTransform(a); engine.changed(); });
  const size = (k: number) => act(() => { engine.pushUndo(); const s = THREE.MathUtils.clamp(a.root.scale.x * k, 0.25, 4); a.root.scale.setScalar(s); a.syncLabel(); a.updateRing(); engine.commitTransform(a); engine.changed(); });
  const B = ({ onClick, label, children, danger, solid }: { onClick: () => void; label: string; children: React.ReactNode; danger?: boolean; solid?: boolean }) => (
    <button onClick={onClick} title={label} aria-label={label} className={clsx('grid h-11 w-11 place-items-center rounded-2xl transition active:scale-90', danger ? 'text-[#ff8a8a] hover:bg-red-500/20' : solid ? 'bg-[#7c5cff] text-white hover:brightness-110' : 'text-white hover:bg-white/15')}>{children}</button>
  );
  return (
    <div ref={ref} className={clsx('dd-glass pointer-events-auto z-30 flex items-center gap-0.5 rounded-[22px] p-1 transition-opacity', docked ? 'absolute left-1/2 -translate-x-1/2' : 'absolute left-0 top-0', dragging && 'pointer-events-none opacity-0')} style={docked ? { bottom: bottom + 10 } : undefined}>
      <B onClick={turn(-45)} label="Turn left"><RotateCcw size={19} /></B>
      <B onClick={turn(45)} label="Turn right"><RotateCw size={19} /></B>
      <span className="mx-0.5 h-6 w-px bg-white/15" />
      <B onClick={size(1 / 1.15)} label="Smaller"><Minus size={19} /></B>
      <B onClick={size(1.15)} label="Bigger"><Plus size={19} /></B>
      <span className="mx-0.5 h-6 w-px bg-white/15" />
      <B onClick={act(() => void engine.duplicateActor(a.id), 'pop')} label="Duplicate (D)"><Copy size={18} /></B>
      <B onClick={act(() => engine.focusActor(a.id))} label="Focus (F)"><Crosshair size={18} /></B>
      <B onClick={act(() => engine.removeActor(a.id), 'trash')} label="Delete" danger><Trash2 size={18} /></B>
      <B onClick={() => { haptic(8); onCode(); }} label="Code it" solid><Blocks size={18} /></B>
    </div>
  );
}
