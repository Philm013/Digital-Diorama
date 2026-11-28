/* Procedural sound effects — everything is synthesised with WebAudio, no files. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let volume = 0.8;

export function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
export function setVolume(v: number) { volume = Math.max(0, Math.min(1, v)); if (master) master.gain.value = volume; }

function noise(c: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  return s;
}
function env(c: AudioContext, t: number, a: number, peak: number, dur: number, rel = 0.08) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.setValueAtTime(Math.max(0.0002, peak), t + Math.max(a, dur - rel));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return g;
}
function osc(c: AudioContext, type: OscillatorType, f0: number, t: number, dur: number, f1?: number, out?: AudioNode) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  o.connect(out ?? master!);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}
function vibrato(c: AudioContext, o: OscillatorNode, rate: number, depth: number, t: number, dur: number) {
  const l = c.createOscillator(), g = c.createGain();
  l.frequency.value = rate; g.gain.value = depth;
  l.connect(g); g.connect(o.frequency);
  l.start(t); l.stop(t + dur + 0.05);
}
function filtered(c: AudioContext, type: BiquadFilterType, f: number, q = 1, out?: AudioNode) {
  const b = c.createBiquadFilter();
  b.type = type; b.frequency.value = f; b.Q.value = q;
  b.connect(out ?? master!);
  return b;
}

type Synth = (c: AudioContext, t: number) => number;
const S: Record<string, Synth> = {
  chirp: (c, t) => { for (let i = 0; i < 3; i++) { const g = env(c, t + i * 0.11, 0.005, 0.25, 0.08); g.connect(master!); osc(c, 'sine', 2600, t + i * 0.11, 0.08, 4300, g); } return 0.4; },
  tweet: (c, t) => { for (let i = 0; i < 4; i++) { const g = env(c, t + i * 0.13, 0.01, 0.2, 0.11); g.connect(master!); osc(c, 'sine', i % 2 ? 3600 : 3000, t + i * 0.13, 0.11, i % 2 ? 3200 : 3500, g); } return 0.55; },
  hoot: (c, t) => { for (const [d, dur] of [[0, 0.32], [0.45, 0.5]] as const) { const g = env(c, t + d, 0.06, 0.32, dur, 0.15); g.connect(master!); const o = osc(c, 'sine', 400, t + d, dur, 360, g); vibrato(c, o, 6, 6, t + d, dur); } return 1; },
  croak: (c, t) => { for (let i = 0; i < 2; i++) { const d = i * 0.42; const bp = filtered(c, 'bandpass', 600, 3); const g = env(c, t + d, 0.02, 0.5, 0.32); g.connect(bp); const o = osc(c, 'sawtooth', 115, t + d, 0.32, 95, g); const am = c.createOscillator(), ag = c.createGain(); am.frequency.value = 28; ag.gain.value = 0.4; am.connect(ag); ag.connect(g.gain); am.start(t + d); am.stop(t + d + 0.4); void o; } return 0.8; },
  howl: (c, t) => { const g = env(c, t, 0.35, 0.28, 2.2, 0.6); g.connect(master!); const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(680, t + 0.7); o.frequency.exponentialRampToValueAtTime(520, t + 1.6); o.frequency.exponentialRampToValueAtTime(380, t + 2.2); o.connect(g); o.start(t); o.stop(t + 2.3); vibrato(c, o, 5, 9, t, 2.2); return 2.2; },
  roar: (c, t) => { const lp = filtered(c, 'lowpass', 420, 0.8); const g = env(c, t, 0.08, 0.7, 1.3, 0.5); g.connect(lp); const n = noise(c); n.connect(g); n.start(t); n.stop(t + 1.4); const g2 = env(c, t, 0.1, 0.25, 1.2, 0.5); g2.connect(lp); const o = osc(c, 'sawtooth', 95, t, 1.2, 70, g2); vibrato(c, o, 9, 12, t, 1.2); return 1.3; },
  trumpet: (c, t) => { const bp = filtered(c, 'bandpass', 1200, 1.2); const g = env(c, t, 0.06, 0.45, 1.0, 0.3); g.connect(bp); const o = osc(c, 'sawtooth', 430, t, 1.0, 560, g); vibrato(c, o, 7, 14, t, 1); return 1.0; },
  buzz: (c, t) => { const g = env(c, t, 0.05, 0.16, 0.9, 0.2); g.connect(master!); const o = osc(c, 'sawtooth', 210, t, 0.9, 230, g); vibrato(c, o, 13, 18, t, 0.9); return 0.9; },
  cricket: (c, t) => { for (let i = 0; i < 6; i++) { const g = env(c, t + i * 0.07, 0.004, 0.12, 0.04); g.connect(master!); osc(c, 'sine', 4700, t + i * 0.07, 0.04, 4700, g); } return 0.5; },
  splash: (c, t) => { const hp = c.createBiquadFilter(); hp.type = 'bandpass'; hp.Q.value = 0.7; hp.frequency.setValueAtTime(3000, t); hp.frequency.exponentialRampToValueAtTime(400, t + 0.5); hp.connect(master!); const g = env(c, t, 0.01, 0.55, 0.55, 0.3); g.connect(hp); const n = noise(c); n.connect(g); n.start(t); n.stop(t + 0.6); return 0.6; },
  bubble: (c, t) => { for (let i = 0; i < 4; i++) { const d = i * 0.12 + Math.random() * 0.05; const g = env(c, t + d, 0.005, 0.22, 0.09); g.connect(master!); osc(c, 'sine', 280 + Math.random() * 200, t + d, 0.09, 900 + Math.random() * 400, g); } return 0.6; },
  pop: (c, t) => { const g = env(c, t, 0.003, 0.4, 0.09); g.connect(master!); osc(c, 'sine', 700, t, 0.09, 140, g); return 0.12; },
  chime: (c, t) => { for (const [f, a] of [[880, 0.25], [1320, 0.15], [1760, 0.1], [2640, 0.06]] as const) { const g = env(c, t, 0.005, a, 1.4, 1.2); g.connect(master!); osc(c, 'sine', f, t, 1.4, f, g); } return 1.4; },
  drum: (c, t) => { const g = env(c, t, 0.003, 0.8, 0.3, 0.25); g.connect(master!); osc(c, 'sine', 130, t, 0.3, 48, g); return 0.32; },
  thunder: (c, t) => { const lp = filtered(c, 'lowpass', 160, 0.7); const g = env(c, t, 0.05, 0.9, 3.2, 2.4); g.connect(lp); const n = noise(c); n.connect(g); n.start(t); n.stop(t + 3.3); return 3.2; },
  munch: (c, t) => { for (let i = 0; i < 3; i++) { const bp = filtered(c, 'bandpass', 1300, 2); const g = env(c, t + i * 0.22, 0.01, 0.4, 0.12); g.connect(bp); const n = noise(c); n.connect(g); n.start(t + i * 0.22); n.stop(t + i * 0.22 + 0.15); } return 0.7; },
  whoosh: (c, t) => { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2; bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2200, t + 0.3); bp.frequency.exponentialRampToValueAtTime(400, t + 0.65); bp.connect(master!); const g = env(c, t, 0.15, 0.45, 0.65, 0.25); g.connect(bp); const n = noise(c); n.connect(g); n.start(t); n.stop(t + 0.7); return 0.65; },
  quack: (c, t) => { for (let i = 0; i < 2; i++) { const bp = filtered(c, 'bandpass', 1100, 4); const g = env(c, t + i * 0.25, 0.01, 0.6, 0.17); g.connect(bp); osc(c, 'sawtooth', 320, t + i * 0.25, 0.17, 260, g); } return 0.45; },
  moo: (c, t) => { const bp = filtered(c, 'bandpass', 500, 2); const g = env(c, t, 0.15, 0.6, 1.3, 0.4); g.connect(bp); osc(c, 'sawtooth', 150, t, 1.3, 120, g); return 1.3; },
  baa: (c, t) => { const bp = filtered(c, 'bandpass', 900, 2); const g = env(c, t, 0.05, 0.5, 0.7, 0.2); g.connect(bp); const o = osc(c, 'sawtooth', 330, t, 0.7, 300, g); vibrato(c, o, 11, 20, t, 0.7); return 0.7; },
  squeak: (c, t) => { for (let i = 0; i < 2; i++) { const g = env(c, t + i * 0.16, 0.005, 0.25, 0.1); g.connect(master!); osc(c, 'sine', 2200, t + i * 0.16, 0.1, 3200, g); } return 0.3; },
  hiss: (c, t) => { const hp = filtered(c, 'highpass', 3500, 0.7); const g = env(c, t, 0.08, 0.35, 1.0, 0.4); g.connect(hp); const n = noise(c); n.connect(g); n.start(t); n.stop(t + 1.05); return 1.0; },
  caw: (c, t) => { for (let i = 0; i < 2; i++) { const bp = filtered(c, 'bandpass', 1500, 2); const g = env(c, t + i * 0.32, 0.01, 0.5, 0.22); g.connect(bp); osc(c, 'sawtooth', 600, t + i * 0.32, 0.22, 450, g); } return 0.6; },
  neigh: (c, t) => { const g = env(c, t, 0.05, 0.35, 1.1, 0.3); g.connect(master!); const o = osc(c, 'square', 750, t, 1.1, 420, g); vibrato(c, o, 22, 60, t, 1.1); return 1.1; },
  grunt: (c, t) => { const lp = filtered(c, 'lowpass', 700, 1); for (let i = 0; i < 3; i++) { const g = env(c, t + i * 0.2, 0.01, 0.5, 0.14); g.connect(lp); osc(c, 'sawtooth', 120, t + i * 0.2, 0.14, 90, g); } return 0.6; },
  yay: (c, t) => { [523, 659, 784, 1046].forEach((f, i) => { const g = env(c, t + i * 0.09, 0.005, 0.18, 0.2); g.connect(master!); osc(c, 'square', f, t + i * 0.09, 0.2, f, g); }); return 0.5; },
};

/** Play a sound now; resolves with its duration in seconds. */
export function playSound(name: string): number {
  const c = audio();
  if (!c || !master) return 0;
  const f = S[name] ?? S.pop;
  try { return f(c, c.currentTime + 0.01); } catch { return 0; }
}

/** Pick a fitting call for an asset from its id. */
export function animalCallFor(assetId: string): string {
  const id = assetId.toLowerCase();
  const sp = id.split('/')[1] ?? id;
  const map: [RegExp, string][] = [
    [/lion|tiger|leopard|cheetah|jaguar|bear|lynx|snow-leopard|komodo|alligator|crocodile/, 'roar'],
    [/wolf|dog|fox|hyena|coyote|jackal/, 'howl'], [/elephant/, 'trumpet'], [/cow|bison/, 'moo'], [/sheep|goat|bighorn|llama/, 'baa'],
    [/horse|zebra|donkey/, 'neigh'], [/pig|boar|hippo|rhino|capybara|camel|moose|reindeer|deer|gazelle|pronghorn|giraffe/, 'grunt'],
    [/mouse|rabbit|cottontail|squirrel|chipmunk|hedgehog|beaver|otter|raccoon|badger|opossum|anteater|panda/, 'squeak'],
    [/owl/, 'hoot'], [/duck|swan|goose/, 'quack'], [/crow|gull|eagle|falcon|pelican|albatross|heron|crane|hornbill|toucan|macaw|cockatoo|flamingo|spoonbill|puffin|penguin/, 'caw'],
    [/rooster|turkey|peacock|ostrich|kiwi/, 'caw'], [/bird|sparrow|robin|cardinal|jay|woodpecker|dove|pigeon|kingfisher|hummingbird|stilt/, 'tweet'],
    [/frog|toad|bullfrog/, 'croak'], [/snake|cobra|python|sidewinder|lizard|iguana|gecko|chameleon|anole|tuatara|salamander|newt|axolotl|caecilian|tortoise|turtle/, 'hiss'],
    [/bee|wasp|fly|mosquito/, 'buzz'], [/cricket|mantis|grasshopper/, 'cricket'],
    [/fish|shark|ray|tang|clown|seahorse|whale|dolphin|seal|octopus|jelly|crab|lobster|urchin|star|clam|coral|sponge|anemone|shrimp|cuttle|nautilus|hare/, 'bubble'],
  ];
  for (const [re, s] of map) if (re.test(sp) || re.test(id)) return s;
  if (id.startsWith('plant') || id.startsWith('tree') || id.startsWith('fungi')) return 'pop';
  return 'chime';
}

export function speak(text: string, rate = 1): Promise<void> {
  return new Promise((resolve) => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth || !text) { resolve(); return; }
    const u = new SpeechSynthesisUtterance(String(text));
    u.rate = rate; u.pitch = 1.05; u.volume = volume;
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    u.onend = finish; u.onerror = finish;
    setTimeout(finish, 1500 + String(text).length * 120);
    synth.speak(u);
  });
}
export function stopSpeech() { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }

/* ---------------- ambient soundscape ---------------- */
export class Ambience {
  private on = false;
  private windNode?: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode };
  private next = 0;
  biome = 'forest';
  night = 0;
  wind = 0.3;
  rain = 0;
  underwater = false;
  water = false;

  get enabled() { return this.on; }
  start() {
    const c = audio();
    if (!c || !master || this.on) return;
    this.on = true;
    const src = noise(c);
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 500;
    const gain = c.createGain(); gain.gain.value = 0;
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start();
    this.windNode = { src, gain, filter };
  }
  stop() {
    this.on = false;
    if (this.windNode) { try { this.windNode.src.stop(); } catch { /* */ } this.windNode.gain.disconnect(); this.windNode = undefined; }
  }
  update(dt: number) {
    if (!this.on || !ctx || !this.windNode) return;
    const w = this.windNode;
    const target = this.underwater ? 0.16 : 0.025 + this.wind * 0.06 + this.rain * 0.12;
    w.gain.gain.value += (target - w.gain.gain.value) * Math.min(1, dt * 2);
    w.filter.frequency.value = this.underwater ? 180 : 380 + this.rain * 2600 + this.wind * 400;
    this.next -= dt;
    if (this.next > 0) return;
    this.next = 1.2 + Math.random() * 3.5;
    const day = this.night < 0.5;
    const b = this.biome;
    if (this.underwater) { if (Math.random() < 0.6) playSoft('bubble', 0.35); return; }
    if (this.rain > 0.5) return;
    if (day) {
      if (['forest', 'garden', 'rainforest', 'taiga', 'wetland', 'grassland', 'mountain'].includes(b) && Math.random() < 0.7) playSoft(Math.random() < 0.5 ? 'chirp' : 'tweet', 0.25);
      if (b === 'shore' && Math.random() < 0.4) playSoft('caw', 0.2);
      if (b === 'rainforest' && Math.random() < 0.25) playSoft('caw', 0.15);
      if ((b === 'wetland' || this.water) && Math.random() < 0.2) playSoft('quack', 0.15);
    } else {
      if (Math.random() < 0.7) playSoft('cricket', 0.2);
      if ((b === 'wetland' || b === 'rainforest' || this.water) && Math.random() < 0.4) playSoft('croak', 0.18);
      if (['forest', 'taiga'].includes(b) && Math.random() < 0.15) playSoft('hoot', 0.25);
    }
  }
}
function playSoft(name: string, level: number) {
  const c = audio();
  if (!c || !master) return;
  const g = c.createGain();
  g.gain.value = level;
  g.connect(master);
  const prev = master;
  master = g; // route this one synth through a quieter bus
  try { S[name]?.(c, c.currentTime + 0.02); } finally { master = prev; }
}
