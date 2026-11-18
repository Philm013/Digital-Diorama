import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildAquarium, themeDefaults, THEMES, MODULES } from './aquarium/scene.mjs';
import type { Opts, AquariumBuild } from './aquarium/scene.mjs';

type Choice = { key: string; label: string; options: string[] };
type Range = { key: string; label: string; min: number; max: number; step: number };

const SECTIONS: { title: string; choices: Choice[]; ranges: Range[] }[] = [
  {
    title: 'Chassis',
    choices: [
      { key: 'tankShape', label: 'Tank Shape', options: ['rectangle', 'shallow', 'bowfront', 'hexagon', 'cylinder'] },
      { key: 'framing', label: 'Framing', options: ['rimless', 'black', 'chrome'] },
      { key: 'glassThickness', label: 'Glass', options: ['standard', 'starphire'] },
      { key: 'standStyle', label: 'Stand Style', options: ['minimalist', 'rustic', 'industrial', 'ornate', 'pedestal'] },
    ],
    ranges: [
      { key: 'tankWidth', label: 'Tank Width (m)', min: 0.6, max: 2.0, step: 0.05 },
      { key: 'tankDepth', label: 'Tank Depth (m)', min: 0.3, max: 0.8, step: 0.05 },
      { key: 'tankHeight', label: 'Tank Height (m)', min: 0.3, max: 0.8, step: 0.05 },
      { key: 'standHeight', label: 'Stand Height (m)', min: 0.3, max: 1.2, step: 0.05 },
      { key: 'waterLevel', label: 'Water Level', min: 0.5, max: 0.97, step: 0.01 },
    ],
  },
  {
    title: 'Lighting',
    choices: [
      { key: 'fixtureType', label: 'Fixture', options: ['pendants', 'bar', 'hood'] },
      { key: 'lightSpectrum', label: 'Spectrum', options: ['daylight', 'reef-blue', 'rgb-planted', 'warm-spot', 'cyber-neon'] },
    ],
    ranges: [{ key: 'lightIntensity', label: 'Intensity', min: 0, max: 2, step: 0.05 }],
  },
  {
    title: 'Terrain & Hardscape',
    choices: [
      { key: 'substrateType', label: 'Substrate', options: ['silica', 'aquasoil', 'coral', 'pebbles'] },
      { key: 'contour', label: 'Contour', options: ['flat', 'rear-bank', 'dual-mound', 'terraced'] },
      { key: 'stoneType', label: 'Stone', options: ['seiryu', 'dragon', 'river', 'liverock'] },
      { key: 'formation', label: 'Formation', options: ['monoliths', 'archway', 'rubble'] },
      { key: 'woodType', label: 'Wood', options: ['spider', 'mopani', 'manzanita'] },
    ],
    ranges: [{ key: 'woodComplexity', label: 'Wood Complexity', min: 1, max: 10, step: 1 }],
  },
  {
    title: 'Flora & Coral',
    choices: [
      { key: 'carpetSpecies', label: 'Carpet', options: ['hairgrass', 'babytears', 'montecarlo'] },
      { key: 'bgSpecies', label: 'Background', options: ['vallisneria', 'amazon', 'rotala'] },
      { key: 'leafColor', label: 'Leaf Color', options: ['green', 'red', 'bronze', 'neon'] },
      { key: 'coralSoftType', label: 'Soft Coral', options: ['anemone', 'xenia', 'toadstool', 'zoanthid'] },
      { key: 'coralSpsForm', label: 'SPS Form', options: ['branching', 'plating', 'encrusting'] },
    ],
    ranges: [{ key: 'coverage', label: 'Carpet Coverage', min: 0, max: 1, step: 0.05 }],
  },
  {
    title: 'Fauna',
    choices: [
      { key: 'heroSpecies', label: 'Hero Fish', options: ['discus', 'betta', 'tang', 'angelfish', 'clownfish'] },
      { key: 'finMorphology', label: 'Fins', options: ['standard', 'veiltail', 'crown'] },
      { key: 'colorPattern', label: 'Pattern', options: ['solid', 'striped', 'marbled'] },
      { key: 'schoolSpecies', label: 'School', options: ['neon', 'cardinal', 'harlequin', 'guppy', 'chromis', 'glofish'] },
      { key: 'formationBehavior', label: 'Formation', options: ['sphere', 'stream', 'scatter'] },
      { key: 'bottomSpecies', label: 'Bottom Crew', options: ['shrimp', 'corydoras', 'hermit'] },
    ],
    ranges: [
      { key: 'heroCount', label: 'Hero Count', min: 1, max: 6, step: 1 },
      { key: 'schoolSize', label: 'School Size', min: 10, max: 120, step: 1 },
      { key: 'population', label: 'Crew Population', min: 1, max: 20, step: 1 },
      { key: 'patternSoftness', label: 'Pattern Softness', min: 0.2, max: 2.0, step: 0.05 },
      { key: 'organicJitter', label: 'Organic Waviness', min: 0.0, max: 2.0, step: 0.05 },
    ],
  },
  {
    title: 'Water & Polish',
    choices: [],
    ranges: [
      { key: 'waterDensity', label: 'Water Density', min: 0.3, max: 2.2, step: 0.05 },
      { key: 'algaeLevel', label: 'Algae Dusting', min: 0, max: 1, step: 0.05 },
      { key: 'coralGlow', label: 'Coral Fluorescence', min: 0, max: 1.2, step: 0.05 },
      { key: 'plantSway', label: 'Plant Sway', min: 0, max: 2, step: 0.1 },
    ],
  },
  {
    title: 'Tech & Decor',
    choices: [
      { key: 'techStyle', label: 'Filtration', options: ['invisible', 'glassware', 'industrial'] },
      { key: 'decorType', label: 'Artifact', options: ['pagoda', 'shipwreck', 'ruins', 'skull', 'buddha', 'monolith'] },
      { key: 'decayLevel', label: 'Decay', options: ['pristine', 'algae', 'coral'] },
    ],
    ranges: [
      { key: 'flowRate', label: 'Flow Rate', min: 0, max: 1, step: 0.05 },
      { key: 'doorsOpen', label: 'Cabinet Doors', min: 0, max: 1, step: 0.05 },
      { key: 'lidOpen', label: 'Lid Slide', min: 0, max: 1, step: 0.05 },
    ],
  },
];

const TOGGLES: { key: string; label: string }[] = [
  { key: 'merge', label: 'Merge for Production' },
  { key: 'night', label: 'Night Mode' },
  { key: 'godRays', label: 'God Rays' },
  { key: 'caustics', label: 'Caustics' },
  { key: 'particles', label: 'Marine Snow' },
  { key: 'underglow', label: 'Underglow' },
];

const VIEWS: Record<string, [number, number, number]> = {
  Front: [0, 0.15, 1.9],
  Angle: [1.4, 0.45, 1.5],
  Top: [0.01, 1.4, 0.35],
  Macro: [0.35, -0.05, 0.75],
};

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const ctx = useRef<{
    renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls;
    build: AquariumBuild | null; helper: THREE.BoxHelper | null;
  } | null>(null);
  const [theme, setTheme] = useState('iwagumi');
  const [opts, setOpts] = useState<Opts>(() => themeDefaults('iwagumi'));
  const [stats, setStats] = useState({ tris: 0, meshes: 0, calls: 0, fps: 0, ms: 0, plantVertices: 0, plantOutside: 0, plantAbove: 0 });
  const [selected, setSelected] = useState<string[] | null>(null);
  const [open, setOpen] = useState<string>('Chassis');
  const [panel, setPanel] = useState(true);
  const [building, setBuilding] = useState(false);

  // ---------- three bootstrap ----------
  useEffect(() => {
    const mount = mountRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;

    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.01, 50);
    camera.position.set(1.4, 1.5, 1.9);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minDistance = 0.25; controls.maxDistance = 6;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.target.set(0, 1.0, 0);

    ctx.current = { renderer, scene, camera, controls, build: null, helper: null };

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight; camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // click-to-select (ModelMaker style)
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); let down = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4 || !ctx.current?.build) return;
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObject(ctx.current.build.root, true).filter(h => (h.object as THREE.Mesh).isMesh && h.object.visible && !['roomFloor', 'roomWall', 'floorCaustics', 'caustics', 'lightShaft', 'floorHalo', 'waterVolume', 'waterSurface', 'meniscus'].includes(h.object.name) && !(h.object.name.startsWith('glass') || h.object.name.startsWith('condensation') || h.object.name.startsWith('siliconeSeams')));
      if (ctx.current.helper) { scene.remove(ctx.current.helper); ctx.current.helper.dispose(); ctx.current.helper = null; }
      if (!hits.length) { setSelected(null); return; }
      const obj = hits[0].object;
      const chain: string[] = []; let o: THREE.Object3D | null = obj;
      while (o && o.name !== 'aquarium-kit') { if (o.name) chain.unshift(o.name); o = o.parent; }
      setSelected(chain);
      const helper = new THREE.BoxHelper(obj, 0xffd84a); ctx.current.helper = helper; scene.add(helper);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    const clock = new THREE.Clock();
    let frames = 0, acc = 0, msAcc = 0, raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
      const t0 = performance.now();
      ctx.current?.build?.update(t, dt);
      if (ctx.current?.helper) ctx.current.helper.update();
      controls.update();
      renderer.render(scene, camera);
      msAcc += performance.now() - t0; frames++; acc += dt;
      if (acc > 0.5) {
        const b = ctx.current?.build;
        setStats({
          tris: b?.stats.tris ?? 0, meshes: b?.stats.meshes ?? 0, calls: renderer.info.render.calls,
          fps: Math.round(frames / acc), ms: +(msAcc / frames).toFixed(1),
          plantVertices: b?.audit.vertices ?? 0, plantOutside: b?.audit.outsideFootprint ?? 0, plantAbove: b?.audit.aboveSurface ?? 0
        });
        frames = 0; acc = 0; msAcc = 0;
      }
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      ctx.current?.build?.dispose();
      renderer.dispose(); pmrem.dispose();
      mount.removeChild(renderer.domElement);
      ctx.current = null;
    };
  }, []);

  // ---------- (re)build aquarium on config change (debounced) ----------
  const firstBuild = useRef(true);
  useEffect(() => {
    setBuilding(true);
    const id = setTimeout(() => {
      const c = ctx.current; if (!c) return;
      if (c.helper) { c.scene.remove(c.helper); c.helper.dispose(); c.helper = null; setSelected(null); }
      if (c.build) { c.scene.remove(c.build.root); c.build.dispose(); }
      const b = buildAquarium(theme, opts);
      c.build = b; c.scene.add(b.root);
      c.scene.background = new THREE.Color(THEMES[theme].room.wall).multiplyScalar(opts.night ? 0.15 : 0.9);
      c.renderer.toneMappingExposure = opts.night ? 0.85 : 1.0;
      if (firstBuild.current) {
        firstBuild.current = false;
        c.controls.target.copy(b.focus);
        c.camera.position.set(b.focus.x + 1.1, b.focus.y + 0.35, b.focus.z + 1.6);
      }
      setBuilding(false);
    }, 120);
    return () => clearTimeout(id);
  }, [theme, opts]);

  const applyTheme = (k: string) => { setTheme(k); setOpts(themeDefaults(k)); };
  const set = (k: string, v: unknown) => setOpts(o => ({ ...o, [k]: v }));
  const setModule = (k: string, v: boolean) => setOpts(o => ({ ...o, modules: { ...o.modules, [k]: v } }));

  const goView = useCallback((name: string) => {
    const c = ctx.current; if (!c?.build) return;
    const f = c.build.focus, v = VIEWS[name], s = Math.max(0.8, c.build.dims.outerW / 1.2);
    c.controls.target.copy(f);
    c.camera.position.set(f.x + v[0] * s, f.y + v[1] * s, f.z + v[2] * s);
  }, []);

  const T = THEMES[theme];

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-neutral-950 font-sans text-neutral-100">
      <div ref={mountRef} className="absolute inset-0" />

      {/* top bar: themes */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 flex flex-col items-center gap-2 p-3">
        <div className="pointer-events-auto flex flex-wrap justify-center gap-1.5 rounded-2xl border border-white/10 bg-black/50 p-1.5 backdrop-blur-md">
          {Object.entries(THEMES).map(([k, th]) => (
            <button key={k} onClick={() => applyTheme(k)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${theme === k ? 'text-black shadow-lg' : 'text-white/80 hover:bg-white/10'}`}
              style={theme === k ? { background: th.accent } : undefined}>
              {th.label}
            </button>
          ))}
        </div>
        <div className="pointer-events-auto max-w-2xl rounded-xl bg-black/40 px-4 py-2 text-center text-[11px] leading-snug text-white/75 backdrop-blur">
          <span className="mr-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black" style={{ background: T.accent }}>{T.water}</span>
          {T.blurb}
        </div>
      </div>

      {/* left config panel */}
      <button onClick={() => setPanel(p => !p)} className="absolute left-3 top-3 z-20 rounded-lg border border-white/10 bg-black/60 px-2.5 py-1.5 text-xs backdrop-blur hover:bg-black/80">
        {panel ? '◀ Hide' : '▶ Configure'}
      </button>
      {panel && (
        <aside className="absolute bottom-3 left-3 top-14 z-10 flex w-80 flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/80 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/10 px-4 py-3">
            <h1 className="text-sm font-bold tracking-wide">AQUASCAPE KIT</h1>
            <p className="text-[11px] text-white/50">15 standalone parametric .mjs parts · zero textures</p>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-xs">
            <div className="grid grid-cols-2 gap-1.5">
              {TOGGLES.map(t => (
                <label key={t.key} className="flex cursor-pointer items-center justify-between rounded-lg bg-white/5 px-2 py-1.5 hover:bg-white/10">
                  <span className="text-[11px]">{t.label}</span>
                  <input type="checkbox" className="accent-cyan-400" checked={!!opts[t.key]} onChange={e => set(t.key, e.target.checked)} />
                </label>
              ))}
            </div>

            <Section title="Modules" open={open === 'Modules'} onToggle={() => setOpen(open === 'Modules' ? '' : 'Modules')}>
              <div className="space-y-1">
                {MODULES.map(m => (
                  <label key={m.key} className={`flex items-center justify-between rounded-md px-2 py-1 ${m.fixed ? 'opacity-50' : 'cursor-pointer hover:bg-white/5'}`}>
                    <span><span className="text-white/90">{m.label}</span><span className="ml-1.5 font-mono text-[9px] text-white/40">{m.file}</span></span>
                    <input type="checkbox" className="accent-cyan-400" disabled={m.fixed} checked={m.fixed ? true : !!opts.modules[m.key]} onChange={e => setModule(m.key, e.target.checked)} />
                  </label>
                ))}
              </div>
            </Section>

            {SECTIONS.map(s => (
              <Section key={s.title} title={s.title} open={open === s.title} onToggle={() => setOpen(open === s.title ? '' : s.title)}>
                <div className="space-y-2">
                  {s.choices.map(c => (
                    <div key={c.key}>
                      <div className="mb-1 text-[10px] uppercase tracking-wider text-white/45">{c.label}</div>
                      <div className="flex flex-wrap gap-1">
                        {c.options.map(op => (
                          <button key={op} onClick={() => set(c.key, op)}
                            className={`rounded-md px-2 py-1 text-[11px] capitalize transition ${opts[c.key] === op ? 'bg-cyan-400 font-semibold text-black' : 'bg-white/5 text-white/75 hover:bg-white/15'}`}>
                            {op.replace('-', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {s.ranges.map(r => (
                    <div key={r.key}>
                      <div className="mb-0.5 flex justify-between text-[10px] uppercase tracking-wider text-white/45">
                        <span>{r.label}</span><span className="font-mono text-white/70">{Number(opts[r.key]).toFixed(r.step < 1 ? 2 : 0)}</span>
                      </div>
                      <input type="range" min={r.min} max={r.max} step={r.step} value={Number(opts[r.key])}
                        onChange={e => set(r.key, parseFloat(e.target.value))} className="w-full accent-cyan-400" />
                    </div>
                  ))}
                </div>
              </Section>
            ))}
          </div>
          <div className="border-t border-white/10 px-3 py-2">
            <button onClick={() => setOpts(themeDefaults(theme))} className="w-full rounded-lg bg-white/10 py-1.5 text-[11px] font-semibold hover:bg-white/20">Reset to “{T.label}”</button>
          </div>
        </aside>
      )}

      {/* camera views */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-xl border border-white/10 bg-black/55 p-1 backdrop-blur">
        {Object.keys(VIEWS).map(v => (
          <button key={v} onClick={() => goView(v)} className="rounded-lg px-3 py-1 text-[11px] font-medium text-white/80 hover:bg-white/15">{v}</button>
        ))}
      </div>

      {/* stats + selection */}
      <div className="absolute bottom-3 right-3 w-64 space-y-2 text-[11px]">
        {selected && (
          <div className="rounded-xl border border-yellow-300/30 bg-black/65 p-3 backdrop-blur">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-yellow-300/80">Selected part</div>
            <div className="break-words font-mono text-[10px] leading-relaxed text-white/85">
              {selected.map((n, i) => <span key={i}>{i > 0 && <span className="text-white/30"> › </span>}<span className={i === selected.length - 1 ? 'text-yellow-200' : ''}>{n}</span></span>)}
            </div>
            {opts.merge && <div className="mt-1.5 text-[10px] text-white/45">Tip: disable “Merge for Production” to pick individual sub-meshes.</div>}
          </div>
        )}
        <div className="rounded-xl border border-white/10 bg-black/55 p-3 font-mono backdrop-blur">
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-white/70">
            <span>FPS</span><span className="text-right text-white">{stats.fps}</span>
            <span>Draw calls</span><span className="text-right text-white">{stats.calls}</span>
            <span>Meshes</span><span className="text-right text-white">{stats.meshes}</span>
            <span>Triangles</span><span className="text-right text-white">{stats.tris.toLocaleString()}</span>
            <span>Plant vertices</span><span className="text-right text-white">{stats.plantVertices.toLocaleString()}</span>
            <span>Outside / above</span><span className={`text-right ${stats.plantOutside + stats.plantAbove === 0 ? 'text-emerald-300' : 'text-red-300'}`}>{stats.plantOutside} / {stats.plantAbove}</span>
            <span>Frame</span><span className="text-right text-white">{stats.ms} ms</span>
          </div>
          <div className="mt-1.5 text-[10px] text-white/40">{building ? 'Rebuilding geometry…' : 'Click a part to inspect · drag to orbit'}</div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white/80 hover:bg-white/5">
        {title}<span className="text-white/40">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="border-t border-white/5 p-3">{children}</div>}
    </div>
  );
}
