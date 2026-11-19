import { useEffect, useRef } from 'react';

/**
 * Makes the phone's back button (and the browser's Back) close whatever is on top — a tray, a
 * sheet, the studio — the way it does in a native app, instead of leaving the site.
 *
 * Every open layer owns one history entry, marked with its id. Ids only grow (they start from
 * the clock, so they keep growing across reloads), which means the layers stack in id order:
 * landing on an entry closes every layer opened after it. Closing a layer from the UI steps
 * history back over its entry; that popstate is ours and is ignored. A layer opened in the same
 * moment others close (a tray handing over to the studio) takes over the oldest released entry
 * instead of racing `history.go()` with `pushState()`.
 */
interface Layer { id: number; close: () => void }
interface Waiting { id: number; url?: string }

const KEY = 'ddLayer';
const stack: Layer[] = [];
/** layers opened while history was busy: they get their entry once it settles */
const waiting: Waiting[] = [];
let seq = 0;
/** released entries to step back over at the next flush */
let steps = 0;
/** our own history.go() is in progress (its token); the popstate it causes is not a Back press */
let inFlight = 0;
let flights = 0;
let afterPop: (() => void) | null = null;
let timer = 0;

const mark = (id: number) => ({ ...(typeof history.state === 'object' && history.state ? history.state : {}), [KEY]: id });
const nextId = () => (seq = Math.max(seq + 1, Date.now()));
export const layerOf = (state: unknown): number => (state && typeof state === 'object' && KEY in state ? Number((state as Record<string, unknown>)[KEY]) || 0 : 0);

function schedule() {
  if (!timer && !inFlight) timer = window.setTimeout(flush, 0);
}

function flush() {
  timer = 0;
  if (inFlight) return;
  const reuse = steps > 0 ? waiting.shift() : undefined;
  const n = steps - (reuse ? 1 : 0);
  steps = 0;
  const settle = () => {
    if (reuse) history.replaceState(mark(reuse.id), '', reuse.url);
    for (const w of waiting.splice(0)) history.pushState(mark(w.id), '', w.url);
  };
  if (n <= 0) { settle(); return; }
  const token = (inFlight = ++flights);
  afterPop = settle;
  history.go(-n);
  // a browser that never reports the step back must not block history for good
  window.setTimeout(() => { if (inFlight === token) landed(); }, 800);
}

function landed() {
  inFlight = 0;
  const f = afterPop;
  afterPop = null;
  f?.();
  if (steps > 0 || waiting.length) schedule();
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (e) => {
    if (inFlight) { landed(); return; }
    // Back (or Forward): close everything opened after the entry we landed on, newest first
    const at = layerOf(e.state);
    while (stack.length && stack[stack.length - 1].id > at) stack.pop()!.close();
  });
}

/** Open a layer that Back closes; `url` (e.g. "#open=…") is shown while it is open. */
export function openLayer(close: () => void, url?: string): number {
  const id = nextId();
  stack.push({ id, close });
  if (steps > 0 || inFlight || waiting.length) { waiting.push({ id, url }); schedule(); }
  else history.pushState(mark(id), '', url);
  return id;
}

/** Take over the current history entry (a layer that was open before the page reloaded). */
export function adoptLayer(close: () => void): number {
  const id = layerOf(history.state) || nextId();
  seq = Math.max(seq, id);
  stack.push({ id, close });
  return id;
}

/** The UI closed a layer: step history back over its entry (no-op if Back already closed it). */
export function closeLayer(id: number) {
  const i = stack.findIndex((l) => l.id === id);
  if (i < 0) return;
  stack.splice(i, 1);
  const w = waiting.findIndex((x) => x.id === id);
  if (w >= 0) { waiting.splice(w, 1); return; } // it never got an entry
  steps++;
  schedule();
}

/**
 * While `open`, Back calls `onClose` instead of leaving the page. Pass `adopt` to reuse the
 * current history entry rather than adding one. Returns `isTop()`: whether this layer is the
 * top-most one (so Escape closes only that).
 */
export function useBackLayer(open: boolean, onClose: () => void, opts?: { url?: string; adopt?: () => boolean }) {
  const close = useRef(onClose);
  close.current = onClose;
  const o = useRef(opts);
  o.current = opts;
  const mine = useRef(0);
  useEffect(() => {
    if (!open) return;
    const fn = () => close.current();
    const id = (mine.current = o.current?.adopt?.() ? adoptLayer(fn) : openLayer(fn, o.current?.url));
    return () => { mine.current = 0; closeLayer(id); };
  }, [open]);
  const isTop = useRef(() => mine.current !== 0 && stack.length > 0 && stack[stack.length - 1].id === mine.current);
  return isTop.current;
}
