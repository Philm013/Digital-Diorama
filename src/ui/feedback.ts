import { audio } from '../code/sound';

/** gentle haptics on phones that support them */
export function haptic(ms: number | number[] = 10) {
  try { if ('vibrate' in navigator && matchMedia('(pointer: coarse)').matches) navigator.vibrate(ms); } catch { /* ignore */ }
}

let enabled = true;
export function setUiSound(on: boolean) { enabled = on; }

/** soft UI clicks synthesised with WebAudio (quiet, short) */
export function uiSound(kind: 'tick' | 'pop' | 'place' | 'trash' | 'open' | 'tab' = 'tick') {
  if (!enabled) return;
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const g = c.createGain();
  g.connect(c.destination);
  const o = c.createOscillator();
  o.connect(g);
  const env = (a: number, d: number) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d); };
  switch (kind) {
    case 'tick': o.type = 'triangle'; o.frequency.setValueAtTime(1300, t); env(0.05, 0.05); break;
    case 'tab': o.type = 'sine'; o.frequency.setValueAtTime(660, t); o.frequency.exponentialRampToValueAtTime(990, t + 0.06); env(0.07, 0.09); break;
    case 'open': o.type = 'sine'; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(840, t + 0.1); env(0.06, 0.14); break;
    case 'pop': o.type = 'sine'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(1040, t + 0.07); env(0.09, 0.12); break;
    case 'place': {
      o.type = 'sine'; o.frequency.setValueAtTime(380, t); o.frequency.exponentialRampToValueAtTime(760, t + 0.09); env(0.1, 0.16);
      const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(1140, t + 0.07); o2.connect(g); o2.start(t + 0.07); o2.stop(t + 0.2);
      break;
    }
    case 'trash': o.type = 'sawtooth'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.14); env(0.04, 0.16); break;
  }
  o.start(t);
  o.stop(t + 0.25);
}
