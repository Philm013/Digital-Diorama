import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, type AssetStats, type SortMode, type ViewPreset } from './viewer/Stage';
import { params as SCHEMA, species as SPECIES } from './assets/animals/mammal-rig.mjs';
import { CRITERIA, REVISIONS, type CriterionKey, type Review, type Verdict } from './review/revisions';

const SPECIES_KEYS = Object.keys(SPECIES);
const CLIPS = ['stand', 'idle', 'walk', 'trot', 'gallop', 'graze', 'alert', 'roar', 'sit'];
const VIEWS: { key: ViewPreset; label: string }[] = [
  { key: 'q34', label: '3/4' }, { key: 'side', label: 'Side' }, { key: 'rear', label: 'Rear' }, { key: 'front', label: 'Front' },
  { key: 'top', label: 'Top' }, { key: 'head', label: 'Head 3/4' }, { key: 'headSide', label: 'Head side' }, { key: 'hind', label: 'Hind 3/4' }, { key: 'hindSide', label: 'Hind side' },
];
const RANGE_KEYS = ['size', 'bodyLen', 'legLen', 'neckLen', 'headSize', 'muzzleLen', 'earSize', 'tailLen', 'countershading', 'seed'];
const CHOICE_KEYS = ['colorway', 'detail', 'age', 'earStyle', 'tailStyle', 'coatPattern'];
const STORE = 'polyforge-mammal-review-v2';

const defaults = () => Object.fromEntries(Object.entries(SCHEMA).filter(([, s]) => s.type !== 'color').map(([k, s]) => [k, s.default]));

function loadReviews(): Record<string, Review> {
  try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; }
}

function statusOf(r?: Review): 'pending' | 'pass' | 'issue' | 'partial' {
  if (!r) return 'pending';
  const v = CRITERIA.map((c) => r.verdicts[c.key] || 'pending');
  if (v.includes('issue')) return 'issue';
  if (v.every((x) => x === 'pass')) return 'pass';
  if (v.some((x) => x === 'pass')) return 'partial';
  return 'pending';
}
const DOT: Record<string, string> = { pending: 'bg-slate-300', pass: 'bg-emerald-500', issue: 'bg-rose-500', partial: 'bg-amber-400' };

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="border-b border-slate-200 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-1 text-sm text-slate-700">
      {label}
      <button type="button" onClick={() => onChange(!value)} className={`relative h-5 w-9 rounded-full transition ${value ? 'bg-indigo-600' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${value ? 'left-4.5' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const [mode, setMode] = useState<'lineup' | 'inspect'>('lineup');
  const [progress, setProgress] = useState<[number, number]>([0, SPECIES_KEYS.length]);
  const [busy, setBusy] = useState(false);
  const [lineup, setLineup] = useState({ colorway: 'natural', detail: 'standard', normalize: true, sort: 'height' as SortMode });
  const [p, setP] = useState<Record<string, unknown>>(() => ({ ...defaults(), species: 'horse' }));
  const [stats, setStats] = useState<AssetStats | null>(null);
  const [clip, setClip] = useState('stand');
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [phase, setPhase] = useState(0.25);
  const [wire, setWire] = useState(false);
  const [skel, setSkel] = useState(false);
  const [grid, setGrid] = useState(true);
  const [picked, setPicked] = useState<string>('');
  const [search, setSearch] = useState('');
  const [reviews, setReviews] = useState<Record<string, Review>>(loadReviews);
  const [showNotes, setShowNotes] = useState(false);
  const species = String(p.species);

  useEffect(() => {
    const s = new Stage(host.current!);
    stage.current = s;
    return () => { s.dispose(); stage.current = null; };
  }, []);

  useEffect(() => { localStorage.setItem(STORE, JSON.stringify(reviews)); }, [reviews]);

  useEffect(() => {
    const s = stage.current; if (!s) return;
    s.onPick = ({ species: sp, part }) => {
      if (s.mode === 'lineup') { setP((o) => ({ ...o, species: sp })); setMode('inspect'); }
      else setPicked(part);
    };
  });

  // lineup build
  useEffect(() => {
    const s = stage.current; if (!s || mode !== 'lineup') return;
    setBusy(true);
    s.buildLineup({ ...lineup, clip: clip === 'stand' ? null : clip }, (d, t) => setProgress([d, t])).then(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, lineup]);

  // inspect build
  const geoKey = JSON.stringify(p);
  const firstInspect = useRef(true);
  useEffect(() => {
    const s = stage.current; if (!s || mode !== 'inspect') return;
    const st = s.inspect(p, clip === 'stand' ? null : clip);
    setStats(st);
    setPicked('');
    if (firstInspect.current) { s.view('q34'); firstInspect.current = false; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, geoKey]);
  useEffect(() => { if (mode === 'inspect') { firstInspect.current = true; } }, [species, mode]);
  useEffect(() => { if (mode === 'inspect') stage.current?.view('q34'); }, [species, mode]);

  useEffect(() => { stage.current?.setClip(clip === 'stand' ? null : clip); }, [clip]);
  useEffect(() => { if (stage.current) { stage.current.playing = playing; } }, [playing]);
  useEffect(() => { if (stage.current) stage.current.speed = speed; }, [speed]);
  useEffect(() => { stage.current?.setWireframe(wire); }, [wire]);
  useEffect(() => { stage.current?.setSkeleton(skel); }, [skel]);
  useEffect(() => { stage.current?.setGrid(grid); }, [grid]);

  const review = reviews[species] || { verdicts: {}, notes: '' };
  const setVerdict = (k: CriterionKey, v: Verdict) => setReviews((r) => ({ ...r, [species]: { ...review, verdicts: { ...review.verdicts, [k]: v }, updated: Date.now() } }));
  const setNotes = (notes: string) => setReviews((r) => ({ ...r, [species]: { ...review, notes, updated: Date.now() } }));
  const counts = useMemo(() => {
    const c = { pass: 0, issue: 0, partial: 0, pending: 0 };
    for (const k of SPECIES_KEYS) c[statusOf(reviews[k])]++;
    return c;
  }, [reviews]);
  const idx = SPECIES_KEYS.indexOf(species);
  const go = (d: number) => setP((o) => ({ ...o, species: SPECIES_KEYS[(idx + d + SPECIES_KEYS.length) % SPECIES_KEYS.length] }));

  const exportReviews = () => {
    const blob = new Blob([JSON.stringify({ asset: 'mammal-rig.mjs', exported: new Date().toISOString(), reviews }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mammal-review.json'; a.click();
  };

  const filtered = SPECIES_KEYS.filter((k) => SPECIES[k].toLowerCase().includes(search.toLowerCase()) || k.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-100 text-slate-800">
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">PF</div>
          <div>
            <div className="text-sm font-semibold leading-tight">Mammal Rig Review Harness</div>
            <div className="text-[11px] leading-tight text-slate-500">mammal-rig.mjs · revision 2 · {SPECIES_KEYS.length} species</div>
          </div>
        </div>
        <nav className="ml-4 flex rounded-lg bg-slate-100 p-1">
          {(['lineup', 'inspect'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${mode === m ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              {m === 'lineup' ? 'Lineup scene' : 'Inspect'}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-500" />{counts.pass} pass</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-400" />{counts.partial} partial</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-rose-500" />{counts.issue} issue</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-slate-300" />{counts.pending} pending</span>
          <button onClick={() => setShowNotes(true)} className="rounded-md border border-slate-200 px-3 py-1.5 font-medium hover:bg-slate-50">Revision notes</button>
          <button onClick={exportReviews} className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-700">Export review</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* species list */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="p-3">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter species…" className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {filtered.map((k) => (
              <li key={k}>
                <button onClick={() => { setP((o) => ({ ...o, species: k })); setMode('inspect'); }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${mode === 'inspect' && species === k ? 'bg-indigo-50 font-medium text-indigo-700' : 'hover:bg-slate-50'}`}>
                  <i className={`h-2 w-2 shrink-0 rounded-full ${DOT[statusOf(reviews[k])]}`} />
                  <span className="truncate">{SPECIES[k]}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* viewport */}
        <main className="relative min-w-0 flex-1">
          <div ref={host} className="absolute inset-0" />
          {mode === 'lineup' && busy && (
            <div className="pointer-events-none absolute inset-x-0 top-4 mx-auto w-80 rounded-xl bg-white/90 p-3 shadow-lg backdrop-blur">
              <div className="mb-1.5 flex justify-between text-xs text-slate-600"><span>Building mammals…</span><span>{progress[0]} / {progress[1]}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-indigo-600 transition-all" style={{ width: `${(progress[0] / progress[1]) * 100}%` }} /></div>
            </div>
          )}
          {mode === 'lineup' && !busy && (
            <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg bg-slate-900/80 px-3 py-2 text-xs text-slate-100">
              Click any animal to inspect it · drag to orbit · scroll to zoom · {lineup.normalize ? 'heights normalized for shape comparison' : 'real-world scale'}
            </div>
          )}
          {mode === 'inspect' && (
            <>
              <div className="absolute left-1/2 top-3 flex -translate-x-1/2 flex-wrap justify-center gap-1 rounded-xl bg-white/90 p-1 shadow-md backdrop-blur">
                {VIEWS.map((v) => (
                  <button key={v.key} onClick={() => stage.current?.view(v.key)} className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700">{v.label}</button>
                ))}
              </div>
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <button onClick={() => go(-1)} className="rounded-lg bg-white/90 px-3 py-2 text-sm shadow hover:bg-white">← Prev</button>
                <div className="rounded-lg bg-slate-900/85 px-3 py-2 text-sm font-medium text-white">{SPECIES[species]} <span className="text-slate-400">({idx + 1}/{SPECIES_KEYS.length})</span></div>
                <button onClick={() => go(1)} className="rounded-lg bg-white/90 px-3 py-2 text-sm shadow hover:bg-white">Next →</button>
              </div>
              {picked && (
                <div className="absolute bottom-4 right-4 rounded-lg bg-white/90 px-3 py-2 text-xs shadow">Selected part: <b className="font-mono">{picked}</b></div>
              )}
            </>
          )}
        </main>

        {/* controls */}
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white">
          {mode === 'lineup' ? (
            <>
              <Section title="Lineup scene">
                <Toggle label="Normalize heights (shape review)" value={lineup.normalize} onChange={(v) => setLineup((l) => ({ ...l, normalize: v }))} />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-xs text-slate-500">Sort
                    <select value={lineup.sort} onChange={(e) => setLineup((l) => ({ ...l, sort: e.target.value as SortMode }))} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-800">
                      <option value="height">Height</option><option value="length">Length</option><option value="alpha">A–Z</option>
                    </select>
                  </label>
                  <label className="text-xs text-slate-500">Detail
                    <select value={lineup.detail} onChange={(e) => setLineup((l) => ({ ...l, detail: e.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-800">
                      {SCHEMA.detail.options!.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </label>
                  <label className="col-span-2 text-xs text-slate-500">Colourway
                    <select value={lineup.colorway} onChange={(e) => setLineup((l) => ({ ...l, colorway: e.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-800">
                      {SCHEMA.colorway.options!.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </label>
                </div>
                <button onClick={() => stage.current?.frameAll()} className="mt-3 w-full rounded-md border border-slate-200 py-1.5 text-sm hover:bg-slate-50">Frame all</button>
              </Section>
            </>
          ) : (
            <>
              <Section title={`Review · ${SPECIES[species]}`} right={<i className={`h-2.5 w-2.5 rounded-full ${DOT[statusOf(reviews[species])]}`} />}>
                <div className="space-y-2">
                  {CRITERIA.map((c) => {
                    const v = review.verdicts[c.key] || 'pending';
                    return (
                      <div key={c.key} title={c.hint}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-700">{c.label}</span>
                          <div className="flex overflow-hidden rounded-md border border-slate-200 text-[11px] font-medium">
                            {(['pass', 'issue', 'pending'] as Verdict[]).map((x) => (
                              <button key={x} onClick={() => setVerdict(c.key, x)}
                                className={`px-2 py-0.5 capitalize ${v === x ? (x === 'pass' ? 'bg-emerald-500 text-white' : x === 'issue' ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-700') : 'text-slate-500 hover:bg-slate-50'}`}>{x === 'pending' ? '–' : x}</button>
                            ))}
                          </div>
                        </div>
                        <p className="text-[11px] leading-snug text-slate-400">{c.hint}</p>
                      </div>
                    );
                  })}
                  <textarea value={review.notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notes for the next revision…" className="mt-1 w-full rounded-md border border-slate-200 p-2 text-sm outline-none focus:border-indigo-400" />
                </div>
              </Section>

              {stats && (
                <Section title="Asset stats">
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-slate-500">Triangles</dt><dd className="font-mono">{stats.triangles.toLocaleString()}</dd>
                    <dt className="text-slate-500">L × H × W</dt><dd className="font-mono">{stats.dimensions.length} × {stats.dimensions.height} × {stats.dimensions.width} m</dd>
                    <dt className="text-slate-500">Stance</dt><dd className="font-mono">{stats.stance}</dd>
                    <dt className="text-slate-500">Bones / parts</dt><dd className="font-mono">{stats.bones.length} / {stats.parts.length}</dd>
                  </dl>
                </Section>
              )}

              <Section title="Animation">
                <div className="flex flex-wrap gap-1">
                  {CLIPS.map((c) => (
                    <button key={c} onClick={() => setClip(c)} className={`rounded-md px-2 py-1 text-xs capitalize ${clip === c ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{c}</button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <button onClick={() => setPlaying(!playing)} className="rounded-md border border-slate-200 px-2 py-1">{playing ? 'Pause' : 'Play'}</button>
                  <span className="text-slate-500">Speed</span>
                  <input type="range" min={0.1} max={2} step={0.05} value={speed} onChange={(e) => setSpeed(+e.target.value)} className="flex-1 accent-indigo-600" />
                  <span className="w-8 font-mono">{speed.toFixed(2)}</span>
                </div>
                {clip !== 'stand' && !playing && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Phase</span>
                    <input type="range" min={0} max={1} step={0.01} value={phase} onChange={(e) => { setPhase(+e.target.value); stage.current?.scrubPose(clip, +e.target.value); }} className="flex-1 accent-indigo-600" />
                    <span className="w-8 font-mono">{phase.toFixed(2)}</span>
                  </div>
                )}
              </Section>

              <Section title="Parameters" right={<button onClick={() => setP({ ...defaults(), species })} className="text-[11px] text-indigo-600 hover:underline">Reset</button>}>
                <div className="grid grid-cols-2 gap-2">
                  {CHOICE_KEYS.map((k) => (
                    <label key={k} className="text-[11px] text-slate-500">{SCHEMA[k].label}
                      <select value={String(p[k])} onChange={(e) => setP((o) => ({ ...o, [k]: e.target.value }))} className="mt-0.5 w-full rounded-md border border-slate-200 px-1.5 py-1 text-xs text-slate-800">
                        {SCHEMA[k].options!.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="mt-3 space-y-1.5">
                  {RANGE_KEYS.map((k) => {
                    const s = SCHEMA[k];
                    return (
                      <label key={k} className="flex items-center gap-2 text-xs" title={s.describe}>
                        <span className="w-24 shrink-0 text-slate-600">{s.label}</span>
                        <input type="range" min={s.min} max={s.max} step={s.step} value={Number(p[k])} onChange={(e) => setP((o) => ({ ...o, [k]: +e.target.value }))} className="flex-1 accent-indigo-600" />
                        <span className="w-10 text-right font-mono text-slate-500">{Number(p[k]).toFixed(k === 'seed' ? 0 : 2)}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-2">
                  <Toggle label="Horns / antlers" value={!!p.showHorns} onChange={(v) => setP((o) => ({ ...o, showHorns: v }))} />
                  <Toggle label="Tusks" value={!!p.showTusks} onChange={(v) => setP((o) => ({ ...o, showTusks: v }))} />
                </div>
              </Section>
            </>
          )}

          <Section title="Display">
            <Toggle label="Wireframe" value={wire} onChange={setWire} />
            <Toggle label="Skeleton" value={skel} onChange={setSkel} />
            <Toggle label="Ground grid" value={grid} onChange={setGrid} />
            {mode === 'lineup' && (
              <div className="mt-2 flex flex-wrap gap-1">
                {CLIPS.map((c) => (
                  <button key={c} onClick={() => setClip(c)} className={`rounded-md px-2 py-1 text-xs capitalize ${clip === c ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{c}</button>
                ))}
              </div>
            )}
          </Section>
        </aside>
      </div>

      {showNotes && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-6" onClick={() => setShowNotes(false)}>
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Revision 2: what changed and why</h2>
              <button onClick={() => setShowNotes(false)} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button>
            </div>
            <div className="space-y-3">
              {REVISIONS.map((r) => (
                <div key={r.area} className="rounded-xl border border-slate-200 p-3">
                  <div className="text-sm font-semibold text-indigo-700">{r.area}</div>
                  <p className="mt-1 text-sm text-slate-600"><span className="font-medium text-rose-600">Before:</span> {r.problem}</p>
                  <p className="mt-1 text-sm text-slate-600"><span className="font-medium text-emerald-600">After:</span> {r.fix}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-500">These changes were checked with headless contact sheets (side / rear / 3/4 / head / hind-quarter views) rendered by tools/render.mjs: <code>node tools/render.mjs out.png horse,cow side,rear,q34,head,hind</code>.</p>
          </div>
        </div>
      )}
    </div>
  );
}
