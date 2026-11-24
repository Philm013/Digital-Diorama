import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { ArrowRight, Crosshair, Plus, Skull, X } from 'lucide-react';
import { useEngine, useEngineVersion } from './store';
import { Chip } from './common';
import { dioramaWeb, hasWater } from '../game/ecology';
import { FOOD_LABEL, LINK_META, ROLE_META, dietText, roleOf, foodSuggestions, isSourceId, partnersOf, removalImpact, type FoodWeb, type LinkKind, type Role, type WebEdge, type WebNode } from '../assets/foodweb';
import type { AssetDef } from '../assets/types';
import { getDef } from '../assets/catalog';
import { habitatUnlocked, isUnlocked } from '../game/unlocks';
import { notePlaced } from '../game/progress';
import { useProfile } from './game/useGame';
import { haptic, uiSound } from './feedback';

const R = 23;
const ROW_H = 120;
/** links that carry food up the web (not recycling) */
const FEEDING: LinkKind[] = ['eats', 'eggs', 'scavenges', 'parasite'];

interface Pos { x: number; y: number }
interface Layout { pos: Map<string, Pos>; rows: number[]; W: number; H: number; rowY: Map<number, number>; sunY: number; recycleY: number | null }

/**
 * Rows by trophic level (top predators at the top, producers above the sunlight, decomposers and
 * dead matter at the bottom), with each row ordered to keep links short and uncrossed.
 */
function layout(web: FoodWeb, show: (e: WebEdge) => boolean): Layout {
  const byRow = new Map<number, WebNode[]>();
  for (const n of web.nodes) (byRow.get(n.level) ?? byRow.set(n.level, []).get(n.level)!).push(n);
  const rows = [...byRow.keys()].filter((l) => l >= 1).sort((a, b) => b - a);
  const hasRecycle = byRow.has(0);
  const widest = Math.max(1, ...[...byRow.values()].map((l) => l.length));
  const W = Math.max(720, widest * 100 + 140);
  // links between neighbours in the top row arc over it: leave room
  const topLinks = web.edges.some((e) => show(e) && web.byId.get(e.from)?.level === rows[0] && web.byId.get(e.to)?.level === rows[0]);
  const y0 = 58 + (topLinks ? 56 : 0);
  const rowY = new Map<number, number>();
  rows.forEach((L, i) => rowY.set(L, y0 + i * ROW_H));
  const sunY = y0 + (rows.length - 1) * ROW_H + 80;
  const recycleY = hasRecycle ? sunY + 78 : null;
  if (hasRecycle) rowY.set(0, recycleY!);
  const H = (recycleY ?? sunY) + 70;
  // order each row by the average position of its neighbours (a few sweeps up and down)
  const order = new Map<number, WebNode[]>();
  for (const [L, list] of byRow) order.set(L, [...list].sort((a, b) => (a.source ? -1 : 0) - (b.source ? -1 : 0) || roleRank(a.role) - roleRank(b.role) || a.name.localeCompare(b.name)));
  const idx = new Map<string, number>();
  const index = () => { for (const list of order.values()) list.forEach((n, i) => idx.set(n.id, (i + 0.5) / list.length)); };
  index();
  const neighbours = new Map<string, string[]>();
  for (const e of web.edges) {
    if (!show(e)) continue;
    (neighbours.get(e.from) ?? neighbours.set(e.from, []).get(e.from)!).push(e.to);
    (neighbours.get(e.to) ?? neighbours.set(e.to, []).get(e.to)!).push(e.from);
  }
  const sweep = [...rows, ...(hasRecycle ? [0] : [])];
  for (let pass = 0; pass < 6; pass++) {
    for (const L of pass % 2 ? [...sweep].reverse() : sweep) {
      const list = order.get(L)!;
      const bary = (n: WebNode) => { const nb = (neighbours.get(n.id) ?? []).map((id) => idx.get(id)!).filter((v) => v !== undefined); return nb.length ? nb.reduce((a, b) => a + b, 0) / nb.length : idx.get(n.id)!; };
      const keyed = list.map((n) => ({ n, k: bary(n) }));
      keyed.sort((a, b) => a.k - b.k);
      order.set(L, keyed.map((x) => x.n));
      index();
    }
  }
  const pos = new Map<string, Pos>();
  for (const [L, list] of order) {
    const gap = Math.min(118, (W - 120) / list.length);
    list.forEach((n, i) => pos.set(n.id, { x: W / 2 + (i - (list.length - 1) / 2) * gap, y: rowY.get(L)! }));
  }
  return { pos, rows, W, H, rowY, sunY, recycleY };
}
const roleRank = (r: Role) => ({ producer: 0, primary: 1, secondary: 2, tertiary: 3, decomposer: 4, abiotic: 5 }[r]);

function rowName(L: number, top: number) {
  if (L === 1) return 'Producers — make food from sunlight';
  if (L === 2) return 'Primary consumers — eat producers';
  if (L === top) return 'Top predators — nothing here eats them';
  if (L === 3) return 'Secondary consumers — eat plant-eaters';
  return 'Tertiary consumers';
}

/** a link drawn from the food to the eater, curving around whichever way it has to go */
function edgePath(a: Pos, b: Pos) {
  if (Math.abs(a.y - b.y) < 1) {
    const lift = 30 + Math.min(44, Math.abs(a.x - b.x) * 0.18);
    return `M${a.x},${a.y - R} C${a.x},${a.y - R - lift} ${b.x},${b.y - R - lift} ${b.x},${b.y - R - 3}`;
  }
  const up = b.y < a.y;
  const ay = a.y + (up ? -R : R), by = b.y + (up ? R + 3 : -R - 3);
  const my = (ay + by) / 2;
  return `M${a.x},${ay} C${a.x},${my} ${b.x},${my} ${b.x},${by}`;
}

type Mark = 'starve' | 'lose' | 'freed';

/** the interactive food web of the diorama */
export function FoodWebView({ onVisit, initial }: { onVisit: (actorId: string) => void; initial?: string | null }) {
  const engine = useEngine();
  const version = useEngineVersion();
  const profile = useProfile();
  const web = useMemo(() => dioramaWeb(engine), [engine, version]); // eslint-disable-line react-hooks/exhaustive-deps
  // scavenging and egg-raiding links are shown on request (or for the organism in focus): they would bury the main web
  const [extras, setExtras] = useState(false);
  const extraCount = web.edges.filter((e) => e.kind === 'scavenges' || e.kind === 'eggs').length;
  const L = useMemo(() => layout(web, (e) => extras || (e.kind !== 'scavenges' && e.kind !== 'eggs')), [web, extras]);
  const [sel, setSel] = useState<string | null>(() => (initial && web.byId.has(initial) ? initial : null));
  const [hover, setHover] = useState<string | null>(null);
  const [whatIf, setWhatIf] = useState(false);
  const [chain, setChain] = useState<number | null>(null);
  const focus = hover ?? sel;
  // on narrow screens the details sit under the diagram: bring them into view
  const asideRef = useRef<HTMLElement>(null);
  useEffect(() => { if (sel && innerWidth < 1024) asideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [sel]);
  const node = sel ? web.byId.get(sel) ?? null : null;
  const impact = useMemo(() => (whatIf && sel && !isSourceId(sel) ? removalImpact(web, sel) : null), [whatIf, sel, web]);
  const marks = useMemo(() => {
    const m = new Map<string, Mark>();
    if (impact) { for (const id of impact.freed) m.set(id, 'freed'); for (const id of impact.lose) m.set(id, 'lose'); for (const id of impact.starve) m.set(id, 'starve'); }
    return m;
  }, [impact]);
  const chainIds = chain !== null ? web.chains[chain] ?? null : null;
  const lit = useMemo(() => {
    if (chainIds) return new Set(chainIds);
    if (!focus) return null;
    const s = new Set([focus]);
    for (const e of web.edges) if (e.from === focus || e.to === focus) { s.add(e.from); s.add(e.to); }
    return s;
  }, [focus, web, chainIds]);
  const edgeLit = (e: WebEdge) => {
    if (chainIds) { const i = chainIds.indexOf(e.from); return i >= 0 && chainIds[i + 1] === e.to; }
    return !!focus && (e.from === focus || e.to === focus);
  };
  const pick = (id: string) => { setChain(null); setWhatIf(false); setSel(id === sel ? null : id); uiSound('tick'); haptic(5); };
  const species = web.nodes.filter((n) => n.def);
  const hungry = species.filter((n) => n.hungry);
  const top = L.rows[0] ?? 1;

  if (!species.length) return <EmptyWeb />;
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_310px]">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <Stat>{species.length} species</Stat>
          <Stat>{web.edges.filter((e) => FEEDING.includes(e.kind)).length} feeding links</Stat>
          <Stat>longest chain: {web.maxChain}</Stat>
          {hungry.length > 0 && (
            <button type="button" onClick={() => pick(hungry[0].id)} className="rounded-full bg-red-50 px-2.5 py-1 font-bold text-red-700 ring-1 ring-red-200">⚠️ {hungry.length} with nothing to eat</button>
          )}
          {extraCount > 0 && (
            <button type="button" aria-pressed={extras} onClick={() => { setExtras(!extras); uiSound('tick'); }} className={clsx('rounded-full px-2.5 py-1 font-bold ring-1 transition', extras ? 'bg-[#7a6a8a] text-white ring-[#7a6a8a]' : 'bg-white text-ink/60 ring-black/10')}>
              {extras ? '✓ ' : ''}Scavenging & eggs ({extraCount})
            </button>
          )}
          <span className="ml-auto hidden text-ink/50 sm:inline">Arrows point from the food to the eater.</span>
        </div>
        <div className="overflow-x-auto overscroll-x-contain rounded-2xl bg-[#fbf7ef] ring-1 ring-black/5" onClick={(e) => { if (e.target === e.currentTarget) setSel(null); }}>
          <svg viewBox={`0 0 ${L.W} ${L.H}`} className="block select-none" style={{ width: '100%', minWidth: Math.round(L.W * 0.72), height: 'auto' }} role="img" aria-label="Food web diagram">
            <defs>
              {(Object.keys(LINK_META) as LinkKind[]).map((k) => (
                <marker key={k} id={`fw-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={LINK_META[k].color} /></marker>
              ))}
              <marker id="fw-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#e0662f" /></marker>
              <linearGradient id="fw-sun" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ffe08a" stopOpacity="0" /><stop offset="1" stopColor="#ffd34d" stopOpacity=".45" /></linearGradient>
            </defs>
            <rect x={0} y={0} width={L.W} height={L.H} fill="transparent" onClick={() => { setSel(null); setChain(null); }} />
            {/* sunlight under the producers, and the recycling of dead matter back to them */}
            <rect x={0} y={L.sunY - 30} width={L.W} height={28} fill="url(#fw-sun)" pointerEvents="none" />
            <text x={L.W / 2} y={L.sunY - 13} textAnchor="middle" fontSize="12" fontWeight="700" fill="#a7700c" pointerEvents="none">☀️ Sunlight — producers turn it into food</text>
            {L.recycleY !== null && (
              <g pointerEvents="none">
                <rect x={8} y={L.recycleY - 46} width={L.W - 16} height={92} rx={18} fill="#8a6a4a" fillOpacity=".07" />
                <text x={20} y={L.recycleY - 30} fontSize="12" fontWeight="700" fill="#8a6a4a">♻ Decomposers — recycle everything that dies</text>
                <path d={`M${L.W - 26},${L.recycleY - 46} C${L.W - 10},${L.sunY - 40} ${L.W - 10},${L.rowY.get(1)! + 40} ${L.W - 34},${L.rowY.get(1)! + 18}`} fill="none" stroke="#8a6a4a" strokeWidth={2} strokeDasharray="5 4" markerEnd="url(#fw-recycles)" opacity=".7" />
                <text x={L.W - 40} y={L.sunY - 46} textAnchor="end" fontSize="11" fontWeight="700" fill="#8a6a4a">♻ nutrients</text>
              </g>
            )}
            {L.rows.map((Lv) => <text key={Lv} x={14} y={L.rowY.get(Lv)! - 38} fontSize="12" fontWeight="700" fill="#8a7a62" pointerEvents="none">{rowName(Lv, top)}</text>)}
            {web.edges.map((e, i) => {
              const a = L.pos.get(e.from), b = L.pos.get(e.to);
              if (!a || !b) return null;
              const on = edgeLit(e);
              if (!extras && !on && (e.kind === 'scavenges' || e.kind === 'eggs')) return null;
              const dim = (lit && !on) || (marks.size > 0 && !on);
              const meta = LINK_META[e.kind];
              return <path key={i} d={edgePath(a, b)} fill="none" stroke={on ? '#e0662f' : meta.color} strokeOpacity={dim ? 0.12 : on ? 1 : 0.55} strokeWidth={on ? 2.6 : 1.4} strokeDasharray={meta.dash} markerEnd={`url(#${on ? 'fw-hi' : `fw-${e.kind}`})`} pointerEvents="none" />;
            })}
            {web.nodes.map((n) => {
              const p = L.pos.get(n.id);
              if (!p) return null;
              const c = ROLE_META[n.role].color;
              const dim = lit && !lit.has(n.id) && !marks.has(n.id);
              const mark = marks.get(n.id);
              const isSel = n.id === sel;
              return (
                <g key={n.id} transform={`translate(${p.x},${p.y})`} className="cursor-pointer" opacity={dim ? 0.25 : 1}
                  onClick={(ev) => { ev.stopPropagation(); pick(n.id); }} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
                  role="button" aria-label={`${n.name}${n.hungry ? ', nothing to eat here' : ''}`}>
                  {isSel && <circle r={R + 7} fill="none" stroke="#e0662f" strokeWidth={3} />}
                  {mark && <circle r={R + 6} fill={mark === 'starve' ? '#e5484d33' : mark === 'lose' ? '#f08c2e33' : '#3d85c633'} stroke={mark === 'starve' ? '#e5484d' : mark === 'lose' ? '#f08c2e' : '#3d85c6'} strokeWidth={2} />}
                  <circle r={R} fill={n.source ? '#fffaf0' : '#fff'} stroke={n.hungry ? '#e5484d' : c} strokeWidth={2.6} strokeDasharray={n.source || n.hungry ? '4 3' : undefined} />
                  <text textAnchor="middle" dy="8" fontSize="22">{n.emoji}</text>
                  <text textAnchor="middle" y={R + 15} fontSize="11.5" fontWeight="700" fill={n.source ? '#8a7a62' : '#3b3328'} fontStyle={n.source ? 'italic' : undefined}>{n.name.length > 16 ? n.name.slice(0, 15) + '…' : n.name}</text>
                  {n.count > 1 && <g transform={`translate(${R - 5},${-R + 5})`}><circle r={9} fill={c} /><text textAnchor="middle" dy="3.5" fontSize="10" fontWeight="800" fill="#fff">×{n.count}</text></g>}
                  {n.hungry && <g transform={`translate(${-R + 5},${-R + 5})`}><circle r={9} fill="#e5484d" /><text textAnchor="middle" dy="4" fontSize="11" fontWeight="800" fill="#fff">!</text></g>}
                </g>
              );
            })}
          </svg>
        </div>
        <Legend />
      </div>
      <aside ref={asideRef} className="min-w-0 scroll-mt-2 space-y-3">
        {node ? (
          <Details web={web} node={node} whatIf={whatIf} setWhatIf={setWhatIf} impact={impact} onPick={pick} onClose={() => setSel(null)} onVisit={onVisit} profileKey={profile.completed.length + (profile.unlockAll ? 1 : 0)} />
        ) : (
          <Overview web={web} hungry={hungry} chain={chain} setChain={(i) => { setSel(null); setChain(i === chain ? null : i); }} onPick={pick} />
        )}
      </aside>
    </div>
  );
}

function Stat({ children }: { children: ReactNode }) { return <span className="rounded-full bg-black/[0.05] px-2.5 py-1 font-bold text-ink/65">{children}</span>; }

function EmptyWeb() {
  return (
    <div className="grid place-items-center gap-2 py-10 text-center">
      <div className="text-5xl">🕸️</div>
      <div className="font-display text-lg font-bold">No food web yet</div>
      <p className="max-w-sm text-sm text-ink/60">Add plants (producers), animals that eat them, predators and decomposers in Build — then come back to see who eats whom.</p>
    </div>
  );
}

function Legend() {
  const kinds: LinkKind[] = ['eats', 'scavenges', 'eggs', 'parasite', 'recycles'];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] font-semibold text-ink/60">
      {(['producer', 'primary', 'secondary', 'tertiary', 'decomposer'] as Role[]).map((r) => <Chip key={r} color={ROLE_META[r].color}>{ROLE_META[r].emoji} {ROLE_META[r].label}</Chip>)}
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        {kinds.map((k) => (
          <span key={k} className="flex items-center gap-1">
            <svg width="26" height="8" aria-hidden><line x1="1" y1="4" x2="25" y2="4" stroke={LINK_META[k].color} strokeWidth="2" strokeDasharray={LINK_META[k].dash} /></svg>
            {LINK_META[k].label}
          </span>
        ))}
      </span>
    </div>
  );
}

/** when nothing is selected: the longest food chains and anything that needs food */
function Overview({ web, hungry, chain, setChain, onPick }: { web: FoodWeb; hungry: WebNode[]; chain: number | null; setChain: (i: number) => void; onPick: (id: string) => void }) {
  return (
    <>
      <div className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
        <div className="font-display text-[14px] font-bold">🔗 Food chains</div>
        <p className="mb-2 text-[12px] text-ink/55">Each one follows energy from a producer up to a predator. Tap one to trace it.</p>
        {web.chains.length === 0 && <p className="text-[12.5px] text-ink/60">No chains yet — add an animal that eats one of your plants.</p>}
        <div className="space-y-1.5">
          {web.chains.slice(0, 5).map((c, i) => (
            <button key={i} type="button" onClick={() => setChain(i)} className={clsx('flex w-full flex-wrap items-center gap-1 rounded-xl px-2 py-1.5 text-left text-[12px] font-semibold ring-1 transition', chain === i ? 'bg-amber-100 ring-amber-400' : 'bg-black/[0.02] ring-black/5 hover:bg-black/[0.04]')}>
              {c.map((id, k) => (
                <span key={id} className="flex items-center gap-1">
                  {k > 0 && <ArrowRight size={12} className="text-ink/35" />}
                  <span>{web.byId.get(id)?.emoji}</span><span className="max-w-[92px] truncate">{web.byId.get(id)?.name}</span>
                </span>
              ))}
              <span className="ml-auto rounded-full bg-black/5 px-1.5 text-[10.5px] text-ink/50">{c.length} links</span>
            </button>
          ))}
        </div>
      </div>
      {hungry.length > 0 && (
        <div className="rounded-2xl bg-red-50 p-3 ring-1 ring-red-200">
          <div className="font-display text-[14px] font-bold text-red-800">⚠️ Nothing to eat</div>
          <p className="mb-2 text-[12px] text-red-900/70">These animals can’t find their food here. Tap one to see what would feed it.</p>
          <div className="flex flex-wrap gap-1.5">
            {hungry.map((n) => <button key={n.id} type="button" onClick={() => onPick(n.id)} className="rounded-full bg-white px-2.5 py-1 text-[12.5px] font-bold ring-1 ring-red-200">{n.emoji} {n.name}</button>)}
          </div>
        </div>
      )}
      <div className="rounded-2xl bg-black/[0.03] p-3 text-[12px] leading-relaxed text-ink/65">
        <b className="text-ink/80">Try it:</b> tap an organism to see what it eats and what eats it, then ask <i>“What if it disappeared?”</i> to see who would go hungry.
      </div>
    </>
  );
}


function Details({ web, node, whatIf, setWhatIf, impact, onPick, onClose, onVisit, profileKey }: {
  web: FoodWeb; node: WebNode; whatIf: boolean; setWhatIf: (v: boolean) => void; impact: ReturnType<typeof removalImpact> | null;
  onPick: (id: string) => void; onClose: () => void; onVisit: (actorId: string) => void; profileKey: number;
}) {
  const engine = useEngine();
  const food = web.food(node.id), eaters = web.eaters(node.id);
  const d = node.def;
  const rm = ROLE_META[node.role];
  const water = hasWater(engine) || !!engine.env.underwater;
  const biome = engine.doc.biome;
  const present = useMemo(() => web.nodes.filter((n) => n.def).map((n) => n.def!), [web]);
  const suggestions = useMemo(() => {
    if (!d || !node.hungry) return [];
    const allowed = (x: AssetDef) => isUnlocked('lib-all') || !x.biomes.length || x.biomes.includes(biome) || x.biomes.some((b) => habitatUnlocked(b));
    return foodSuggestions(d, biome, present, { water, allowed });
  }, [d, node.hungry, biome, present, water, profileKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [adding, setAdding] = useState<string | null>(null);
  const add = async (x: AssetDef) => {
    setAdding(x.id);
    uiSound('place'); haptic(12);
    const spot = engine.findSpot(x, engine.controls.target.clone());
    const a = await engine.addActor(x.id, spot);
    if (a && x.living !== false) notePlaced(x.id, x.name);
    setAdding(null);
  };
  const tl = node.tl;
  const partners = d ? partnersOf(d.id).filter((p) => web.nodes.some((n) => n.def?.id === p.other)) : [];
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white p-3 ring-1 ring-black/5" style={{ boxShadow: `inset 4px 0 0 ${node.hungry ? '#e5484d' : rm.color}` }}>
        <div className="flex items-start gap-2.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-black/[0.04] text-3xl">{node.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[16px] font-bold leading-tight">{node.name}{node.count > 1 ? ` ×${node.count}` : ''}</div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              <Chip color={node.source ? '#8a7a62' : rm.color}>{node.source ? 'Always here' : `${rm.emoji} ${rm.label}`}</Chip>
              {!node.source && !node.hungry && node.role !== 'producer' && node.role !== 'decomposer' && <Chip color="#5a6b7d" className="cursor-help"><span title="Trophic level: 1 for producers, one more for each step up the food chain">level {tl.toFixed(1)}</span></Chip>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/[0.05] text-ink/60 hover:bg-black/10"><X size={17} /></button>
        </div>
        <p className="mt-2 text-[12.5px] leading-snug text-ink/70">
          {node.source ? node.source.blurb
            : node.role === 'producer' ? 'Makes its own food from sunlight, water and air — the start of every food chain here.'
              : d ? <>In the wild it eats {dietText(d)}.{node.hungry ? '' : levelText(tl, node.role)}</> : null}
        </p>
        {!node.source && (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button type="button" onClick={() => onVisit(node.ids[0])} className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-black/[0.05] font-display text-[13px] font-semibold text-ink/75 hover:bg-black/10"><Crosshair size={15} /> Show me</button>
            <button type="button" onClick={() => setWhatIf(!whatIf)} className={clsx('flex h-10 items-center justify-center gap-1.5 rounded-xl font-display text-[13px] font-semibold transition', whatIf ? 'bg-ink text-white' : 'bg-black/[0.05] text-ink/75 hover:bg-black/10')}><Skull size={15} /> What if…?</button>
          </div>
        )}
      </div>

      {whatIf && impact && (
        <div className="rounded-2xl bg-white p-3 text-[12.5px] ring-1 ring-black/5">
          <div className="font-display text-[14px] font-bold">If the {node.name.toLowerCase()} disappeared…</div>
          {impact.starve.length === 0 && impact.lose.length === 0 && impact.freed.length === 0 && <p className="mt-1 text-ink/65">Nothing here depends on it directly — but every species plays a part.</p>}
          {impact.starve.length > 0 && <Effect color="#e5484d" title="would have nothing left to eat" ids={impact.starve} web={web} onPick={onPick} />}
          {impact.lose.length > 0 && <Effect color="#f08c2e" title="would lose one of their foods" ids={impact.lose} web={web} onPick={onPick} />}
          {impact.freed.length > 0 && <Effect color="#3d85c6" title="would lose a predator — and might grow too many" ids={impact.freed} web={web} onPick={onPick} />}
        </div>
      )}

      {node.hungry && d && (
        <div className="rounded-2xl bg-red-50 p-3 text-[12.5px] ring-1 ring-red-200">
          <div className="font-display text-[14px] font-bold text-red-800">Nothing to eat here</div>
          <p className="mt-0.5 text-red-900/75">It needs {dietText(d)}{d.category === 'animals' && d.mass && d.mass > 5 ? ' — prey it is big enough to catch' : ''}.</p>
          {suggestions.length > 0 && (
            <>
              <div className="mt-2 text-[11.5px] font-bold uppercase tracking-wide text-red-900/60">Would feed it</div>
              <div className="mt-1 space-y-1.5">
                {suggestions.map((x) => (
                  <div key={x.id} className="flex items-center gap-2 rounded-xl bg-white px-2 py-1.5 ring-1 ring-red-100">
                    <span className="text-xl">{x.emoji}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{x.name}</span><span className="block text-[11px] text-ink/50">{ROLE_META[roleOf(x)].label}</span></span>
                    <button type="button" disabled={adding === x.id} onClick={() => void add(x)} className="flex h-9 items-center gap-1 rounded-xl bg-[#3bb34a] px-3 font-display text-[12.5px] font-bold text-white disabled:opacity-50"><Plus size={14} /> Add</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {food.length > 0 && <Links title={node.role === 'decomposer' ? '♻ Breaks down' : '🍽️ Gets food from'} edges={food} side="from" web={web} onPick={onPick} />}
      {eaters.length > 0 && <Links title={node.source?.food === 'detritus' ? '♻ Recycled by' : '⚠️ Eaten by'} edges={eaters} side="to" web={web} onPick={onPick} />}
      {!node.source && node.role !== 'decomposer' && (
        <p className="rounded-2xl bg-black/[0.03] px-3 py-2 text-[12px] text-ink/60">🍂 When it dies, or drops leaves and droppings, decomposers recycle it into nutrients for the plants.</p>
      )}
      {partners.length > 0 && (
        <div className="rounded-2xl bg-emerald-50 p-3 text-[12.5px] ring-1 ring-emerald-200">
          <div className="font-display text-[14px] font-bold text-emerald-800">🤝 Partners</div>
          {partners.map((p) => <p key={p.other} className="mt-1 text-emerald-900/80"><b>{getDef(p.other)?.name}:</b> {p.how}</p>)}
        </div>
      )}
    </div>
  );
}

function levelText(tl: number, role: Role) {
  if (role === 'decomposer') return ' It breaks down dead matter, returning nutrients to the soil.';
  if (tl < 2.3) return ' Here it is a plant-eater: one step above the producers.';
  if (tl < 2.8) return ' Here it eats both plants and animals (an omnivore).';
  if (tl < 3.5) return ' Here it mostly eats plant-eaters.';
  return ' Here it eats other predators too — near the top of the web.';
}

function Links({ title, edges, side, web, onPick }: { title: string; edges: WebEdge[]; side: 'from' | 'to'; web: FoodWeb; onPick: (id: string) => void }) {
  // main links as chips; scavenging and egg-raiding grouped on their own lines
  const groups: [LinkKind | 'main', WebEdge[]][] = [['main', edges.filter((e) => e.kind !== 'scavenges' && e.kind !== 'eggs')], ['eggs', edges.filter((e) => e.kind === 'eggs')], ['scavenges', edges.filter((e) => e.kind === 'scavenges')]];
  const label = (k: LinkKind | 'main') => (k === 'eggs' ? (side === 'from' ? 'Raids the eggs of' : 'Its eggs are raided by') : k === 'scavenges' ? (side === 'from' ? 'Eats the remains of' : 'Its remains feed') : '');
  return (
    <div className="space-y-2 rounded-2xl bg-white p-3 ring-1 ring-black/5">
      <div className="font-display text-[13.5px] font-bold">{title}</div>
      {groups.filter(([, list]) => list.length).map(([k, list]) => (
        <div key={k}>
          {k !== 'main' && <div className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: LINK_META[k].color }}>{label(k)}</div>}
          <div className="flex flex-wrap gap-1.5">
            {list.map((e) => {
              const n = web.byId.get(e[side])!;
              const host = e.kind === 'parasite';
              return (
                <button key={e[side] + e.kind} type="button" onClick={() => onPick(n.id)} className="flex items-center gap-1 rounded-full bg-black/[0.03] py-1 pl-1.5 pr-2.5 text-[12.5px] font-semibold ring-1 ring-black/10 hover:bg-black/[0.06]"
                  title={e.food && FOOD_LABEL[e.food] ? `as ${FOOD_LABEL[e.food]}` : undefined}>
                  <span>{n.emoji}</span>{n.name}
                  {host && <span className="rounded-full px-1.5 text-[10px] font-bold uppercase" style={{ background: LINK_META.parasite.color + '22', color: LINK_META.parasite.color }}>{side === 'from' ? 'host' : 'parasite'}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Effect({ color, title, ids, web, onPick }: { color: string; title: string; ids: string[]; web: FoodWeb; onPick: (id: string) => void }) {
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center gap-1.5 font-semibold" style={{ color }}><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{ids.length === 1 ? 'This' : 'These'} {title}:</div>
      <div className="flex flex-wrap gap-1">{ids.map((id) => <button key={id} type="button" onClick={() => onPick(id)} className="rounded-full px-2 py-0.5 text-[12px] font-bold ring-1" style={{ background: color + '14', borderColor: color, color }}>{web.byId.get(id)?.emoji} {web.byId.get(id)?.name}</button>)}</div>
    </div>
  );
}

