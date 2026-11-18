import { useEffect, useMemo, useRef, useState } from 'react';
import { Viewer, ENVIRONMENTS } from './lib/viewer';
import { SPECIES, groupsByClass, defaultsOf } from './lib/catalog';
import { Inspector } from './components/Inspector';

type Vals = Record<string, string | number | boolean>;
const LINEUP = '__lineup__';

const Icon = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const I = {
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  play: 'M7 5v14l11-7L7 5Z',
  pause: 'M8 5v14M16 5v14',
  rotate: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  frame: 'M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4',
  grid: 'M3 9h18M3 15h18M9 3v18M15 3v18',
  download: 'M12 3v12m0 0-4-4m4 4 4-4M5 21h14',
  camera: 'M3 8h3l2-3h8l2 3h3v11H3V8Zm9 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  x: 'M6 6l12 12M18 6 6 18',
  search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3',
  layers: 'M12 3 2 8l10 5 10-5-10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5'
};

export default function App() {
  const mount = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const lastFit = useRef('');
  const [ready, setReady] = useState(false);
  const [sel, setSel] = useState<string>(SPECIES.find((s) => s.id === 'panther-chameleon')?.id ?? SPECIES[0].id);
  const [values, setValues] = useState<Record<string, Vals>>({});
  const [colorOv, setColorOv] = useState<Record<string, Record<string, string>>>({});
  const [hidden, setHidden] = useState<Record<string, Record<string, boolean>>>({});
  const [night, setNight] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [grid, setGrid] = useState(true);
  const [normalize, setNormalize] = useState(true);
  const [env, setEnv] = useState<'auto' | string>('auto');
  const [query, setQuery] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [stats, setStats] = useState({ tris: 0, calls: 0, dims: '' });

  const byId = useMemo(() => Object.fromEntries(SPECIES.map((s) => [s.id, s])), []);
  const groups = useMemo(() => groupsByClass(), []);
  const sp = sel === LINEUP ? null : byId[sel];
  const vals: Vals = sp ? { ...defaultsOf(sp.mod), ...(values[sel] || {}) } : {};

  useEffect(() => {
    const v = new Viewer(mount.current!);
    v.onStats = setStats;
    viewer.current = v;
    setReady(true);
    return () => v.dispose();
  }, []);

  // rebuild the asset (or the composed lineup scene) whenever its parameters change
  useEffect(() => {
    const v = viewer.current;
    if (!v || !ready) return;
    if (sel === LINEUP) {
      const items = SPECIES.map((s) => ({ obj: s.mod.createAsset({ mergeForProduction: true }), label: s.mod.info.name, sub: s.mod.info.size, row: s.mod.info.class === 'Reptilia' ? 0 : 1 }));
      v.setLineup(items, normalize);
      lastFit.current = LINEUP + normalize;
      return;
    }
    const s = byId[sel];
    const up: Vals = { ...defaultsOf(s.mod), ...(values[sel] || {}) };
    for (const [k, p] of Object.entries(s.mod.params)) if (p.type === 'color') { const o = colorOv[sel]?.[k]; if (o) up[k] = o; else delete up[k]; }
    const obj = s.mod.createAsset(up);
    const fit = lastFit.current !== sel;
    lastFit.current = sel;
    v.setContent(obj, s.mod.rig, s.mod.night, fit);
    for (const [name, h] of Object.entries(hidden[sel] || {})) v.setVisible(name, !h);
    v.setAnimate(animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, values, colorOv, ready, normalize]);

  useEffect(() => { viewer.current?.setEnvironment(sel === LINEUP ? (env === 'auto' ? 'studio' : env) : env === 'auto' ? sp!.mod.info.environment : env); }, [sel, env, ready, sp]);
  useEffect(() => { viewer.current?.setNight(night); }, [night, ready]);
  useEffect(() => { viewer.current?.setAnimate(animate); }, [animate, ready]);
  useEffect(() => { viewer.current?.setAutoRotate(autoRotate); }, [autoRotate, ready]);
  useEffect(() => { viewer.current?.setGrid(grid); }, [grid, ready]);

  const select = (id: string) => { setSel(id); setNavOpen(false); };
  const setVal = (k: string, v: string | number | boolean) => {
    setValues((s) => ({ ...s, [sel]: { ...(s[sel] || {}), [k]: v } }));
    if (k === 'colorway') setColorOv((s) => ({ ...s, [sel]: {} }));
  };
  const colorFor = (k: string) => {
    if (!sp) return '#000000';
    const cw = sp.mod.COLORWAYS[String(vals.colorway)] || sp.mod.COLORWAYS.default;
    return colorOv[sel]?.[k] ?? cw[k] ?? String(sp.mod.params[k].default);
  };
  const download = () => {
    if (!sp) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([sp.source], { type: 'text/javascript' }));
    a.download = sp.file;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const snapshot = () => {
    const url = viewer.current?.snapshot();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = `${sp ? sp.id : 'herp-lineup'}.png`; a.click();
  };

  const q = query.trim().toLowerCase();
  const match = (id: string) => { const i = byId[id].mod.info; return !q || `${i.name} ${i.scientific} ${i.group} ${i.order} ${i.habitat}`.toLowerCase().includes(q); };
  const title = sp ? sp.mod.info : null;
  const toolBtn = (on: boolean) => `flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ring-1 backdrop-blur transition ${on ? 'bg-emerald-400/20 text-emerald-100 ring-emerald-400/40' : 'bg-slate-950/55 text-slate-200 ring-white/10 hover:bg-slate-900/80'}`;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-slate-950 text-slate-100">
      {/* catalog */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[19rem] flex-col border-r border-slate-800 bg-slate-950/95 backdrop-blur transition-transform lg:static lg:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400">Herpetarium</div>
            <h1 className="text-lg font-semibold leading-tight text-white">Reptiles & Amphibians</h1>
            <p className="mt-0.5 text-xs text-slate-500">{SPECIES.length} parametric species · 8 orders & groups</p>
          </div>
          <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:hidden" onClick={() => setNavOpen(false)}><Icon d={I.x} /></button>
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 ring-1 ring-slate-800 focus-within:ring-emerald-500/50">
            <Icon d={I.search} className="h-4 w-4 text-slate-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search species, habitat…" className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-slate-600" />
          </div>
          <button onClick={() => select(LINEUP)} className={`mt-3 flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 transition ${sel === LINEUP ? 'bg-emerald-400/10 ring-emerald-400/40' : 'bg-slate-900/60 ring-slate-800 hover:ring-slate-600'}`}>
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-emerald-500/30 to-amber-500/20 text-emerald-200"><Icon d={I.layers} /></span>
            <span><span className="block text-sm font-medium text-white">Full Collection Lineup</span><span className="block text-xs text-slate-500">Every species composed in one scene</span></span>
          </button>
        </div>
        <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-6">
          {groups.map((c) => (
            <div key={c.cls} className="mt-3">
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{c.cls === 'Reptilia' ? 'Reptilia · Reptiles' : 'Amphibia · Amphibians'}</div>
              {c.groups.map((g) => {
                const items = g.items.filter((s) => match(s.id));
                if (!items.length) return null;
                return (
                  <div key={g.group} className="mb-1">
                    <div className="flex items-baseline justify-between px-2 pb-1 pt-2">
                      <span className="text-xs font-semibold text-slate-300">{g.group}</span>
                      <span className="text-[10px] italic text-slate-600">{g.order}</span>
                    </div>
                    {items.map((s) => (
                      <button key={s.id} onClick={() => select(s.id)} className={`group flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition ${sel === s.id ? 'bg-emerald-400/10 text-emerald-100 ring-1 ring-emerald-400/30' : 'text-slate-300 hover:bg-slate-900'}`}>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px]">{s.mod.info.name}</span>
                          <span className="block truncate text-[11px] italic text-slate-500">{s.mod.info.scientific}</span>
                        </span>
                        <span className="ml-2 shrink-0 text-[10px] text-slate-500">{s.mod.info.size.split('–').pop()}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
      {navOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setNavOpen(false)} />}

      {/* viewport */}
      <main className="relative min-w-0 flex-1">
        <div ref={mount} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-3 sm:p-4">
          <div className="pointer-events-auto flex items-center gap-2">
            <button className={`${toolBtn(false)} lg:hidden`} onClick={() => setNavOpen(true)}><Icon d={I.menu} /></button>
            <div className="rounded-xl bg-slate-950/55 px-3.5 py-2 ring-1 ring-white/10 backdrop-blur">
              <div className="text-sm font-semibold text-white sm:text-base">{title ? title.name : 'Full Collection'}</div>
              <div className="text-[11px] italic text-slate-300 sm:text-xs">{title ? title.scientific : normalize ? 'Normalised scale — every species at equal size' : 'True real-world scale'}</div>
            </div>
          </div>
          <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5">
            <button className={toolBtn(night)} onClick={() => setNight(!night)} title="Day / night"><Icon d={night ? I.moon : I.sun} /><span className="hidden sm:inline">{night ? 'Night' : 'Day'}</span></button>
            <button className={toolBtn(animate)} onClick={() => setAnimate(!animate)} title="Animate rig"><Icon d={animate ? I.pause : I.play} /><span className="hidden sm:inline">Animate</span></button>
            <button className={toolBtn(autoRotate)} onClick={() => setAutoRotate(!autoRotate)} title="Turntable"><Icon d={I.rotate} /></button>
            <button className={toolBtn(grid)} onClick={() => setGrid(!grid)} title="Grid"><Icon d={I.grid} /></button>
            <button className={toolBtn(false)} onClick={() => viewer.current?.fit(sel === LINEUP ? 0.9 : 1)} title="Frame model"><Icon d={I.frame} /></button>
            <button className={toolBtn(false)} onClick={snapshot} title="Save PNG"><Icon d={I.camera} /></button>
            {sp && <button className={toolBtn(false)} onClick={download} title="Download standalone .mjs"><Icon d={I.download} /><span className="hidden sm:inline">.mjs</span></button>}
            {sp && <button className={`${toolBtn(panelOpen)} lg:hidden`} onClick={() => setPanelOpen(!panelOpen)}><Icon d={I.sliders} /></button>}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-3 sm:p-4">
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-950/55 px-3 py-2 text-[11px] text-slate-300 ring-1 ring-white/10 backdrop-blur">
            <span><b className="font-mono text-emerald-300">{stats.tris.toLocaleString()}</b> tris</span>
            <span className="text-slate-600">·</span>
            <span><b className="font-mono text-emerald-300">{stats.calls}</b> draw calls</span>
            <span className="text-slate-600">·</span>
            <span className="font-mono">{stats.dims}</span>
          </div>
          <div className="pointer-events-auto flex items-center gap-1.5">
            {sel === LINEUP && (
              <div className="flex rounded-lg bg-slate-950/55 p-0.5 text-xs ring-1 ring-white/10 backdrop-blur">
                {[['Normalised', true], ['True scale', false]].map(([l, v]) => (
                  <button key={String(l)} onClick={() => setNormalize(v as boolean)} className={`rounded-md px-2.5 py-1.5 ${normalize === v ? 'bg-emerald-400/20 text-emerald-100' : 'text-slate-300'}`}>{l as string}</button>
                ))}
              </div>
            )}
            <select value={env} onChange={(e) => setEnv(e.target.value)} className="h-8 rounded-lg bg-slate-950/70 px-2 text-xs text-slate-200 outline-none ring-1 ring-white/10 backdrop-blur">
              <option value="auto">Habitat: native</option>
              {Object.entries(ENVIRONMENTS).map(([k, e]) => <option key={k} value={k}>{e.label}</option>)}
            </select>
          </div>
        </div>
      </main>

      {/* inspector */}
      {sp && (
        <aside className={`fixed inset-x-0 bottom-0 z-30 h-[62dvh] rounded-t-2xl border-t border-slate-800 bg-slate-950/97 shadow-2xl backdrop-blur transition-transform lg:static lg:h-auto lg:w-[22rem] lg:translate-y-0 lg:rounded-none lg:border-l lg:border-t-0 ${panelOpen ? 'translate-y-0' : 'translate-y-full'}`}>
          <button className="absolute right-3 top-3 z-10 rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:hidden" onClick={() => setPanelOpen(false)}><Icon d={I.x} /></button>
          <Inspector
            key={sp.id}
            sp={sp}
            vals={vals}
            colorFor={colorFor}
            hidden={hidden[sel] || {}}
            onChange={setVal}
            onColor={(k, v) => setColorOv((s) => ({ ...s, [sel]: { ...(s[sel] || {}), [k]: v } }))}
            onHide={(name, h) => { setHidden((s) => ({ ...s, [sel]: { ...(s[sel] || {}), [name]: h } })); viewer.current?.setVisible(name, !h); }}
            onReset={() => { setValues((s) => ({ ...s, [sel]: {} })); setColorOv((s) => ({ ...s, [sel]: {} })); setHidden((s) => ({ ...s, [sel]: {} })); }}
          />
        </aside>
      )}
    </div>
  );
}
