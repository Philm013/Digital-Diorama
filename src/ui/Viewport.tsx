import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { clsx } from 'clsx';
import { LogOut, Footprints } from 'lucide-react';
import type { Mode } from '../engine/types';
import type { Actor } from '../engine/Actor';
import { useStudio } from './store';
import { Btn, Segmented } from './common';

const EYES = [
  { value: '1.6', label: '🧍 Person' },
  { value: '0.6', label: '🦊 Fox' },
  { value: '0.15', label: '🐸 Frog' },
  { value: '0.03', label: '🐜 Ant' },
];

export function Viewport({ mode, playing, toast }: { mode: Mode; playing: boolean; toast: (t: string, k?: 'info' | 'error' | 'success') => void }) {
  const { engine, runtime } = useStudio();
  const [caption, setCaption] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ q: string; who: string; resolve: (s: string) => void } | null>(null);
  const [answer, setAnswer] = useState('');
  const [walking, setWalking] = useState(false);
  const [eye, setEye] = useState('1.6');
  const capTimer = useRef(0);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  /* runtime → UI hooks */
  useEffect(() => {
    runtime.onCaption = (text, secs) => {
      setCaption(text || null);
      clearTimeout(capTimer.current);
      if (text) capTimer.current = window.setTimeout(() => setCaption(null), secs * 1000);
    };
    runtime.onAsk = (q, who) => new Promise<string>((resolve) => { setAnswer(''); setAsk({ q, who, resolve }); });
    if (engine.walk) engine.walk.onChange = () => setWalking(!!engine.walk?.active);
    return () => { runtime.onCaption = undefined; runtime.onAsk = undefined; };
  }, [engine, runtime]);
  useEffect(() => { if (!playing) { setCaption(null); if (ask) { ask.resolve(''); setAsk(null); } } }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  /* brush cursor */
  const ring = useRef<THREE.Mesh | null>(null);
  useEffect(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthTest: false }));
    m.renderOrder = 20;
    m.visible = false;
    engine.scene.add(m);
    ring.current = m;
    return () => { engine.scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); };
  }, [engine]);

  /* pointer interactions on the canvas (capture phase so we can pre-empt orbiting) */
  useEffect(() => {
    const el = engine.renderer.domElement;
    const host = el.parentElement!;
    let down: { x: number; y: number; t: number; id: number; actor?: Actor; offset?: THREE.Vector3; dragging?: boolean; stroke?: boolean } | null = null;
    let pointers = 0;
    let lastTap = { t: 0, id: '' };
    let lastStroke = 0;

    const onDown = (e: PointerEvent) => {
      pointers++;
      if (engine.walk?.active) {
        if (e.pointerType === 'mouse') engine.walk.lockPointer();
        return;
      }
      if (pointers > 1) {
        // second finger: hand control back to orbit/zoom
        if (down?.stroke) engine.endStroke();
        down = null;
        engine.controls.enabled = true;
        return;
      }
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      const m = modeRef.current;
      if (m === 'build' && !playingRef.current) {
        if (engine.brush.tool && engine.terrain) {
          const g = engine.pickGround(e.clientX, e.clientY);
          if (g) {
            engine.controls.enabled = false;
            down.stroke = true;
            engine.beginStroke(g.point);
            engine.strokeAt(g.point, 1 / 30);
            lastStroke = performance.now();
          }
          return;
        }
        const hit = engine.pickActor(e.clientX, e.clientY);
        if (hit && !hit.actor.isClone) {
          engine.controls.enabled = false;
          down.actor = hit.actor;
          const g = engine.pickGround(e.clientX, e.clientY);
          down.offset = g ? hit.actor.root.position.clone().sub(g.point).setY(0) : new THREE.Vector3();
          if (engine.selectedId !== hit.actor.id) engine.select(hit.actor.id);
        }
      }
    };
    const onMove = (e: PointerEvent) => {
      const r = ring.current;
      if (modeRef.current === 'build' && engine.brush.tool && engine.terrain && !engine.walk?.active) {
        const g = engine.pickGround(e.clientX, e.clientY);
        if (r) {
          r.visible = !!g;
          if (g) { r.position.copy(g.point).add(new THREE.Vector3(0, 0.08, 0)); r.scale.setScalar(engine.brush.radius); (r.material as THREE.MeshBasicMaterial).color.set(engine.brush.tool === 'lower' ? '#ffb4a8' : engine.brush.tool === 'paint' ? '#ffe28a' : '#ffffff'); }
        }
        if (down?.stroke && g && e.pointerId === down.id) {
          const now = performance.now();
          engine.strokeAt(g.point, Math.min(0.1, (now - lastStroke) / 1000));
          lastStroke = now;
        }
        return;
      } else if (r) r.visible = false;
      if (!down || e.pointerId !== down.id || !down.actor) return;
      const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (!down.dragging && dist > 5) { down.dragging = true; engine.pushUndo(); }
      if (down.dragging) {
        const a = down.actor;
        const perchable = a.def.category === 'animals';
        const g = engine.pickGround(e.clientX, e.clientY, perchable);
        if (!g) return;
        const p = g.point.clone();
        if (!g.actor) p.add(down.offset ?? new THREE.Vector3());
        const b = engine.bounds;
        p.x = THREE.MathUtils.clamp(p.x, b.minX + 0.2, b.maxX - 0.2);
        p.z = THREE.MathUtils.clamp(p.z, b.minZ + 0.2, b.maxZ - 0.2);
        a.root.position.x = p.x; a.root.position.z = p.z;
        if (g.actor && g.actor !== a) { a.doc.grounded = false; a.root.position.y = g.point.y; a.lift = 0; }
        else { a.doc.grounded = true; a.followGround(engine.worldQuery); }
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers = Math.max(0, pointers - 1);
      engine.controls.enabled = true;
      if (!down || e.pointerId !== down.id) return;
      const d = down;
      down = null;
      if (d.stroke) { engine.endStroke(); return; }
      if (d.dragging && d.actor) { engine.commitTransform(d.actor); engine.changed(); return; }
      const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      if (moved > 8 || performance.now() - d.t > 600) return;
      // a tap
      const hit = d.actor ? { actor: d.actor } : engine.pickActor(e.clientX, e.clientY);
      const m = modeRef.current;
      const now = performance.now();
      if (hit && lastTap.id === hit.actor.id && now - lastTap.t < 350) { engine.focusActor(hit.actor.id); lastTap = { t: 0, id: '' }; return; }
      lastTap = { t: now, id: hit?.actor.id ?? '' };
      if (playingRef.current && hit && runtime.tapped(hit.actor.id)) return;
      if (hit) {
        engine.select(hit.actor.id);
        engine.emit({ type: 'tap', id: hit.actor.id });
      } else if (m !== 'code') {
        engine.select(null);
        engine.emit({ type: 'tap', id: null });
      }
    };
    const onCancel = (e: PointerEvent) => { pointers = Math.max(0, pointers - 1); if (down?.stroke) engine.endStroke(); if (down && e.pointerId === down.id) down = null; engine.controls.enabled = true; };
    const onLeave = () => { if (ring.current) ring.current.visible = false; };
    const onDragOver = (e: DragEvent) => { if (e.dataTransfer?.types.includes('text/x-dd-asset')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } };
    const onDrop = async (e: DragEvent) => {
      const id = e.dataTransfer?.getData('text/x-dd-asset');
      if (!id) return;
      e.preventDefault();
      const g = engine.pickGround(e.clientX, e.clientY, true);
      if (!g) { toast('Drop it onto the diorama ground'); return; }
      const perched = !!g.actor;
      const a = await engine.addActor(id, g.point, perched ? { grounded: false, lift: 0 } : {});
      if (a) { if (perched) a.root.position.y = g.point.y; engine.select(a.id); }
    };
    host.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    el.addEventListener('pointerleave', onLeave);
    host.addEventListener('dragover', onDragOver);
    host.addEventListener('drop', onDrop);
    el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    return () => {
      host.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('dragover', onDragOver);
      host.removeEventListener('drop', onDrop);
    };
  }, [engine, runtime, toast]);

  const touch = typeof window !== 'undefined' && (navigator.maxTouchPoints > 0);

  return (
    <>
      {caption && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[12%] z-20 flex justify-center px-4">
          <div className="dd-caption max-w-3xl rounded-2xl bg-black/70 px-5 py-3 text-center font-display text-lg font-semibold text-white shadow-xl sm:text-2xl">{caption}</div>
        </div>
      )}
      {playing && !walking && (
        <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 rounded-full bg-[#3bb34a] px-3 py-1 font-display text-xs font-semibold text-white shadow">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Playing — tap things, press keys, Stop to reset
        </div>
      )}
      {walking && (
        <WalkOverlay touch={touch} eye={eye} setEye={(v) => { setEye(v); engine.walk?.exit(); engine.walk?.enter(Number(v)); }} onExit={() => engine.walk?.exit()} />
      )}
      {ask && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/35 p-4">
          <form className="dd-panel w-[min(92vw,420px)] rounded-3xl p-5" onSubmit={(e) => { e.preventDefault(); ask.resolve(answer); setAsk(null); }}>
            <div className="text-xs font-bold uppercase tracking-wide text-ink/50">{ask.who} asks</div>
            <div className="mt-1 font-display text-xl font-semibold">{ask.q}</div>
            <input autoFocus value={answer} onChange={(e) => setAnswer(e.target.value)} className="dd-input mt-3" placeholder="Type your answer" />
            <Btn variant="solid" className="mt-3 w-full" type="submit">Answer ✓</Btn>
          </form>
        </div>
      )}
    </>
  );
}

export function startWalk(engine: import('../engine/Engine').Engine, eye = 1.6) {
  engine.walk?.enter(eye);
}

function WalkOverlay({ touch, eye, setEye, onExit }: { touch: boolean; eye: string; setEye: (v: string) => void; onExit: () => void }) {
  const { engine } = useStudio();
  const joyRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const el = engine.renderer.domElement;
    // touch look: drag anywhere outside the joystick
    let last: { x: number; y: number; id: number } | null = null;
    const down = (e: PointerEvent) => { if (e.pointerType !== 'mouse') last = { x: e.clientX, y: e.clientY, id: e.pointerId }; };
    const move = (e: PointerEvent) => { if (last && e.pointerId === last.id) { engine.walk?.look((e.clientX - last.x) * 1.4, (e.clientY - last.y) * 1.4); last = { x: e.clientX, y: e.clientY, id: e.pointerId }; } };
    const up = (e: PointerEvent) => { if (last && e.pointerId === last.id) last = null; };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [engine]);
  const onJoy = (e: React.PointerEvent) => {
    const r = joyRef.current!.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
    let x = (e.clientX - cx) / R, y = (e.clientY - cy) / R;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    setKnob({ x, y });
    if (engine.walk) { engine.walk.joy.x = x; engine.walk.joy.y = -y; }
  };
  const endJoy = () => { setKnob({ x: 0, y: 0 }); if (engine.walk) { engine.walk.joy.x = 0; engine.walk.joy.y = 0; } };
  return (
    <>
      <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2">
        <div className="rounded-2xl bg-white/90 p-1 shadow"><Segmented size="sm" value={eye} onChange={setEye} options={EYES} /></div>
        <Btn size="sm" onClick={onExit}><LogOut size={14} /> Leave</Btn>
      </div>
      {!touch && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-2xl bg-black/55 px-4 py-2 text-center text-xs font-semibold text-white">
          Click to look around · <b>W A S D</b> walk · <b>Shift</b> run · <b>Space</b> jump / swim up · <b>C</b> swim down · <b>Esc</b> leave
        </div>
      )}
      {touch && (
        <>
          <div ref={joyRef} className={clsx('absolute bottom-8 left-6 z-30 h-32 w-32 touch-none rounded-full bg-white/25 ring-2 ring-white/60 backdrop-blur-sm')}
            onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); onJoy(e); }} onPointerMove={(e) => { if (e.buttons || e.pointerType !== 'mouse') onJoy(e); }} onPointerUp={endJoy} onPointerCancel={endJoy}>
            <div className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/85 shadow" style={{ transform: `translate(calc(-50% + ${knob.x * 40}px), calc(-50% + ${knob.y * 40}px))` }}><Footprints size={20} className="text-ink/70" /></div>
          </div>
          <div className="absolute bottom-10 right-6 z-30 flex flex-col gap-3">
            <button className="h-14 w-14 rounded-full bg-white/80 font-display text-xl shadow" onPointerDown={() => { if (engine.walk) engine.walk.rise = 1; }} onPointerUp={() => { if (engine.walk) engine.walk.rise = 0; }} onPointerLeave={() => { if (engine.walk) engine.walk.rise = 0; }}>⬆</button>
            <button className="h-14 w-14 rounded-full bg-white/80 font-display text-xl shadow" onPointerDown={() => { if (engine.walk) engine.walk.rise = -1; }} onPointerUp={() => { if (engine.walk) engine.walk.rise = 0; }} onPointerLeave={() => { if (engine.walk) engine.walk.rise = 0; }}>⬇</button>
          </div>
          <div className="pointer-events-none absolute bottom-44 left-6 z-30 rounded-xl bg-black/45 px-2 py-1 text-[11px] font-semibold text-white">Move · drag the screen to look</div>
        </>
      )}
    </>
  );
}
