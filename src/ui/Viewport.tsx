import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { clsx } from 'clsx';
import { LogOut, Footprints } from 'lucide-react';
import type { Mode } from '../engine/types';
import type { Actor } from '../engine/Actor';
import { useStudio } from './store';
import { Btn, Segmented } from './common';
import { haptic, uiSound } from './feedback';
import { confetti } from './game/Celebrate';
import { notePlaced } from '../game/progress';

const EYES = [
  { value: '1.6', label: '🧍 Person' },
  { value: '0.6', label: '🦊 Fox' },
  { value: '0.15', label: '🐸 Frog' },
  { value: '0.03', label: '🐜 Ant' },
];
const nearestEye = (v: string) => EYES.reduce((best, o) => (Math.abs(Math.log(Number(o.value) / Number(v))) < Math.abs(Math.log(Number(best.value) / Number(v))) ? o : best), EYES[0]).value;

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
    if (engine.walk) engine.walk.onChange = () => { setWalking(!!engine.walk?.active); if (engine.walk?.active) setEye(String(engine.walk.eye)); };
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

  /* pointer interactions on the canvas (capture phase so we can pre-empt orbiting).
     Touch: tap selects; a selected object drags with one finger; long-press picks up
     anything; while holding an object a second finger twists (turn) and pinches (size). */
  useEffect(() => {
    const el = engine.renderer.domElement;
    const host = el.parentElement!;
    type Down = { x: number; y: number; t: number; id: number; touch: boolean; actor?: Actor; armed?: boolean; offset?: THREE.Vector3; dragging?: boolean; stroke?: boolean; sx?: number; sy?: number };
    let down: Down | null = null;
    const pts = new Map<number, { x: number; y: number }>();
    let longTimer = 0;
    let twist: { a0: number; d0: number; rot0: number; s0: number; actor: Actor; ids: [number, number] } | null = null;
    let lastTap = { t: 0, id: '' };
    let lastStroke = 0;
    const dragEvent = (on: boolean) => document.dispatchEvent(new CustomEvent('dd-drag', { detail: on }));
    const ringUp = new THREE.Vector3(0, 0.08, 0);
    const placeRing = (point: THREE.Vector3 | null) => {
      const r = ring.current;
      if (!r) return;
      r.visible = !!point;
      if (!point) return;
      r.position.copy(point).add(ringUp);
      r.scale.setScalar(engine.brush.radius);
      (r.material as THREE.MeshBasicMaterial).color.set(engine.brush.tool === 'lower' ? '#ffb4a8' : engine.brush.tool === 'paint' ? '#ffe28a' : '#ffffff');
    };
    const pair = () => { const [a, b] = [...pts.values()]; return { ang: Math.atan2(b.y - a.y, b.x - a.x), dist: Math.hypot(b.x - a.x, b.y - a.y) }; };
    const arm = (d: Down, actor: Actor, e: { clientX: number; clientY: number }) => {
      d.actor = actor;
      d.armed = true;
      engine.controls.enabled = false;
      const g = engine.pickGround(e.clientX, e.clientY);
      d.offset = g ? actor.root.position.clone().sub(g.point).setY(0) : new THREE.Vector3();
      if (engine.selectedId !== actor.id) engine.select(actor.id);
    };

    const onDown = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (engine.walk?.active) {
        if (e.pointerType === 'mouse') engine.walk.lockPointer();
        return;
      }
      if (pts.size === 2 && down?.armed && down.actor && modeRef.current === 'build' && !playingRef.current) {
        // second finger on a held object: twist to turn, pinch to resize
        clearTimeout(longTimer);
        const p = pair();
        if (!down.dragging) { engine.pushUndo(); down.dragging = true; dragEvent(true); }
        twist = { a0: p.ang, d0: Math.max(10, p.dist), rot0: down.actor.root.rotation.y, s0: down.actor.root.scale.x, actor: down.actor, ids: [...pts.keys()] as [number, number] };
        haptic(10);
        return;
      }
      if (pts.size > 1) {
        // a second finger without a held object: hand control back to orbit/zoom
        clearTimeout(longTimer);
        if (down?.stroke) { engine.endStroke(); placeRing(null); }
        if (down?.dragging) { engine.commitTransform(down.actor!); engine.changed(); dragEvent(false); }
        down = null;
        engine.controls.enabled = true;
        return;
      }
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const d: Down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, touch: e.pointerType !== 'mouse' };
      down = d;
      const m = modeRef.current;
      if (m === 'build' && !playingRef.current) {
        if (engine.brush.tool && engine.terrain) {
          const g = engine.pickGround(e.clientX, e.clientY);
          if (g) {
            engine.controls.enabled = false;
            d.stroke = true;
            d.sx = e.clientX; d.sy = e.clientY;
            engine.beginStroke(g.point);
            engine.strokeAt(g.point, 1 / 60);
            placeRing(g.point);
            lastStroke = performance.now();
            // airbrush: keep working every frame while held — holding still builds a hill
            const tick = () => {
              if (down !== d) return;
              const now = performance.now();
              const gp = engine.pickGround(d.sx!, d.sy!);
              if (gp) { engine.strokeAt(gp.point, Math.min(0.1, (now - lastStroke) / 1000)); placeRing(gp.point); }
              lastStroke = now;
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
          return;
        }
        const hit = engine.pickActor(e.clientX, e.clientY, d.touch ? 18 : 6);
        if (hit && !hit.actor.isClone) {
          if (!d.touch || engine.selectedId === hit.actor.id) arm(d, hit.actor, e);
          else {
            d.actor = hit.actor;
            // long-press picks up an unselected object without fighting the camera on a quick swipe
            longTimer = window.setTimeout(() => {
              if (down !== d || d.dragging) return;
              arm(d, hit.actor, { clientX: d.x, clientY: d.y });
              haptic(18);
              uiSound('pop');
            }, 420);
          }
        }
      }
    };
    let hoverT = 0;
    const hover = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.buttons || engine.walk?.active) return;
      const now = performance.now();
      if (now - hoverT < 120) return;
      hoverT = now;
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      if (modeRef.current === 'build' && engine.brush.tool) { el.style.cursor = 'crosshair'; return; }
      const hit = engine.pickActor(e.clientX, e.clientY);
      el.style.cursor = hit ? (modeRef.current === 'build' && !playingRef.current ? 'grab' : 'pointer') : '';
    };
    const onMove = (e: PointerEvent) => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      hover(e);
      if (twist && pts.size >= 2) {
        const p = pair();
        const a = twist.actor;
        a.root.rotation.y = twist.rot0 - (p.ang - twist.a0);
        const s = THREE.MathUtils.clamp(twist.s0 * (p.dist / twist.d0), 0.25, 4);
        a.root.scale.setScalar(s);
        a.syncLabel(); a.updateRing();
        return;
      }
      if (down?.dragging) el.style.cursor = 'grabbing';
      if (modeRef.current === 'build' && engine.brush.tool && engine.terrain && !engine.walk?.active) {
        // while sculpting the frame loop applies the brush; moves only steer it
        if (down?.stroke && e.pointerId === down.id) { down.sx = e.clientX; down.sy = e.clientY; return; }
        if (e.pointerType === 'mouse') placeRing(engine.pickGround(e.clientX, e.clientY)?.point ?? null);
        return;
      } else if (ring.current) ring.current.visible = false;
      if (!down || e.pointerId !== down.id || !down.actor) return;
      const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (!down.armed) { if (dist > 10) clearTimeout(longTimer); return; }
      if (!down.dragging && dist > 5) { down.dragging = true; engine.pushUndo(); dragEvent(true); }
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
      pts.delete(e.pointerId);
      clearTimeout(longTimer);
      if (twist) {
        if (twist.ids.includes(e.pointerId)) {
          engine.commitTransform(twist.actor);
          engine.changed();
          haptic(8);
          twist = null;
          // the first finger can keep dragging after the second one lifts
          if (down && pts.has(down.id)) { const q = pts.get(down.id)!; down.x = q.x; down.y = q.y; const g = engine.pickGround(q.x, q.y); down.offset = g && down.actor ? down.actor.root.position.clone().sub(g.point).setY(0) : down.offset; return; }
        }
      }
      if (pts.size === 0) engine.controls.enabled = true;
      if (!down || e.pointerId !== down.id) return;
      const d = down;
      down = null;
      engine.controls.enabled = true;
      if (d.stroke) { engine.endStroke(); if (d.touch) placeRing(null); return; }
      if (d.dragging && d.actor) { engine.commitTransform(d.actor); engine.changed(); dragEvent(false); haptic(10); uiSound('tick'); return; }
      const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      if (moved > 8 || performance.now() - d.t > 600) return;
      // a tap
      const hit = d.actor ? { actor: d.actor } : engine.pickActor(e.clientX, e.clientY, d.touch ? 24 : 10);
      const m = modeRef.current;
      const now = performance.now();
      if (hit && lastTap.id === hit.actor.id && now - lastTap.t < 350) { engine.focusActor(hit.actor.id); lastTap = { t: 0, id: '' }; return; }
      lastTap = { t: now, id: hit?.actor.id ?? '' };
      if (playingRef.current && hit && runtime.tapped(hit.actor.id)) return;
      if (hit) {
        engine.select(hit.actor.id);
        engine.emit({ type: 'tap', id: hit.actor.id });
        haptic(6);
      } else if (m !== 'code') {
        engine.select(null);
        engine.emit({ type: 'tap', id: null });
      }
    };
    const onCancel = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      clearTimeout(longTimer);
      if (twist) { engine.commitTransform(twist.actor); engine.changed(); twist = null; }
      if (down && e.pointerId === down.id) {
        if (down.stroke) { engine.endStroke(); placeRing(null); }
        if (down.dragging && down.actor) { engine.commitTransform(down.actor); engine.changed(); dragEvent(false); }
        down = null;
      }
      engine.controls.enabled = true;
    };
    const onLeave = () => { if (ring.current) ring.current.visible = false; };
    const onDragOver = (e: DragEvent) => { if (e.dataTransfer?.types.includes('text/x-dd-asset')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } };
    const onDrop = async (e: DragEvent) => {
      const id = e.dataTransfer?.getData('text/x-dd-asset');
      if (!id) return;
      e.preventDefault();
      const g = engine.pickGround(e.clientX, e.clientY, true);
      if (!g) { toast('Drop it onto the diorama ground'); return; }
      const perched = !!g.actor;
      uiSound('place');
      confetti(e.clientX, e.clientY, 22);
      const a = await engine.addActor(id, g.point, perched ? { grounded: false, lift: 0 } : {});
      if (a) {
        if (perched) a.root.position.y = g.point.y;
        engine.select(a.id);
        if (a.def.living !== false) notePlaced(a.def.id, a.def.name);
      }
    };
    host.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    el.addEventListener('pointerleave', onLeave);
    host.addEventListener('dragover', onDragOver);
    host.addEventListener('drop', onDrop);
    const ctxMenu = (ev: Event) => ev.preventDefault();
    el.addEventListener('contextmenu', ctxMenu);
    return () => {
      clearTimeout(longTimer);
      if (down?.stroke) engine.endStroke();
      down = null; // also stops the brush loop
      host.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('contextmenu', ctxMenu);
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
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#3bb34a] px-3.5 py-1.5 font-display text-xs font-semibold text-white shadow-[0_3px_0_#23802f,0_10px_20px_-8px_rgba(0,0,0,.5)]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Playing — tap things, press keys, Stop to reset
        </div>
      )}
      {walking && (
        <WalkOverlay touch={touch} eye={eye} setEye={(v) => { setEye(v); engine.walk?.exit(); engine.walk?.enter(Number(v)); document.dispatchEvent(new CustomEvent('dd-walk', { detail: Number(v) })); }} onExit={() => engine.walk?.exit()} />
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
  const [joy, setJoy] = useState<{ cx: number; cy: number; x: number; y: number; id: number } | null>(null);
  useEffect(() => {
    const el = engine.renderer.domElement;
    // touch look: drag anywhere on the right side of the screen
    let last: { x: number; y: number; id: number } | null = null;
    const down = (e: PointerEvent) => { if (e.pointerType !== 'mouse') last = { x: e.clientX, y: e.clientY, id: e.pointerId }; };
    const move = (e: PointerEvent) => { if (last && e.pointerId === last.id) { engine.walk?.look((e.clientX - last.x) * 1.4, (e.clientY - last.y) * 1.4); last = { x: e.clientX, y: e.clientY, id: e.pointerId }; } };
    const up = (e: PointerEvent) => { if (last && e.pointerId === last.id) last = null; };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [engine]);
  const R = 56;
  const setStick = (cx: number, cy: number, px: number, py: number, id: number) => {
    let x = (px - cx) / R, y = (py - cy) / R;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    setJoy({ cx, cy, x, y, id });
    if (engine.walk) { engine.walk.joy.x = x; engine.walk.joy.y = -y; engine.walk.joyRun = l > 0.95; }
  };
  const endJoy = () => { setJoy(null); if (engine.walk) { engine.walk.joy.x = 0; engine.walk.joy.y = 0; engine.walk.joyRun = false; } };
  const hold = (v: number) => ({
    onPointerDown: (e: React.PointerEvent) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); if (engine.walk) engine.walk.rise = v; haptic(8); },
    onPointerUp: () => { if (engine.walk) engine.walk.rise = 0; },
    onPointerCancel: () => { if (engine.walk) engine.walk.rise = 0; },
  });
  return (
    <>
      <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2">
        <div className="dd-glass rounded-2xl p-1"><Segmented size="sm" value={nearestEye(eye)} onChange={setEye} options={EYES} /></div>
        <Btn size="sm" onClick={onExit}><LogOut size={14} /> Leave</Btn>
      </div>
      {!touch && (
        <div className="dd-glass pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-2xl px-4 py-2 text-center text-xs font-semibold text-white">
          Click to look around · <b>W A S D</b> walk · <b>Shift</b> run · <b>Space</b> jump / swim up · <b>C</b> swim down · <b>Esc</b> leave
        </div>
      )}
      {touch && (
        <>
          {/* left half: a joystick appears wherever your thumb lands */}
          <div className="absolute bottom-0 left-0 top-16 z-20 w-1/2 touch-none"
            onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setStick(e.clientX - r.left, e.clientY - r.top, e.clientX - r.left, e.clientY - r.top, e.pointerId); haptic(6); }}
            onPointerMove={(e) => { if (joy && e.pointerId === joy.id) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setStick(joy.cx, joy.cy, e.clientX - r.left, e.clientY - r.top, joy.id); } }}
            onPointerUp={endJoy} onPointerCancel={endJoy}>
            {joy ? (
              <div className="pointer-events-none absolute grid place-items-center rounded-full bg-white/20 ring-2 ring-white/60 backdrop-blur-sm" style={{ left: joy.cx - R, top: joy.cy - R, width: R * 2, height: R * 2 }}>
                <div className={clsx('grid h-14 w-14 place-items-center rounded-full shadow-lg transition-colors', Math.hypot(joy.x, joy.y) > 0.95 ? 'bg-amber-300' : 'bg-white/90')} style={{ transform: `translate(${joy.x * R * 0.75}px, ${joy.y * R * 0.75}px)` }}><Footprints size={20} className="text-ink/70" /></div>
              </div>
            ) : (
              <div className="pointer-events-none absolute bottom-10 left-8 grid h-28 w-28 place-items-center rounded-full border-2 border-dashed border-white/50 text-center text-[11px] font-bold text-white/80">Drag here<br />to walk</div>
            )}
          </div>
          <div className="absolute bottom-10 right-5 z-30 flex flex-col gap-3">
            <button className="dd-3d grid h-16 w-16 place-items-center rounded-full bg-white/85 font-display text-2xl text-ink [--edge:rgba(0,0,0,.25)]" aria-label="Up / jump" {...hold(1)}>⬆</button>
            <button className="dd-3d grid h-16 w-16 place-items-center rounded-full bg-white/85 font-display text-2xl text-ink [--edge:rgba(0,0,0,.25)]" aria-label="Down" {...hold(-1)}>⬇</button>
          </div>
          <div className="dd-glass pointer-events-none absolute right-5 top-20 z-30 rounded-xl px-2.5 py-1 text-[11px] font-semibold text-white">Drag the right side to look · push the stick to the rim to run</div>
        </>
      )}
    </>
  );
}
