import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import type { Engine, EngineEvent } from '../engine/Engine';
import type { ScriptRuntime } from '../code/runtime';
import type { Ambience } from '../code/sound';
import type { Settings } from '../storage/projects';

export interface StudioApi {
  engine: Engine;
  runtime: ScriptRuntime;
  ambience: Ambience;
  settings: Settings;
  setSettings: (s: Settings) => void;
}
export const StudioContext = createContext<StudioApi | null>(null);
export function useStudio(): StudioApi {
  const s = useContext(StudioContext);
  if (!s) throw new Error('Studio context missing');
  return s;
}
export function useEngine() { return useStudio().engine; }
/** re-render whenever the engine reports a change */
export function useEngineVersion() {
  const e = useEngine();
  return useSyncExternalStore(e.subscribe, e.getVersion);
}
export function useEngineEvent(fn: (ev: EngineEvent) => void) {
  const e = useEngine();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => { const off = e.on((ev) => ref.current(ev)); return () => { off(); }; }, [e]);
}
