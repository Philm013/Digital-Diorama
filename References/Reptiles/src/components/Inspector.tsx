import { useState, type ReactNode } from 'react';
import type { Species } from '../lib/catalog';
import { statusTone } from '../lib/catalog';
import { ENVIRONMENTS } from '../lib/viewer';

type Vals = Record<string, string | number | boolean>;

function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-slate-800/80">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 hover:text-slate-200">
        {title}
        <svg className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" /></svg>
      </button>
      {open && <div className="space-y-4 px-5 pb-5">{children}</div>}
    </div>
  );
}

export function Inspector(props: {
  sp: Species;
  vals: Vals;
  colorFor: (k: string) => string;
  hidden: Record<string, boolean>;
  onChange: (k: string, v: string | number | boolean) => void;
  onColor: (k: string, v: string) => void;
  onHide: (name: string, v: boolean) => void;
  onReset: () => void;
}) {
  const { sp, vals } = props;
  const info = sp.mod.info;
  const entries = Object.entries(sp.mod.params);
  const geo = entries.filter(([k, p]) => p.affects === 'geometry' && k !== 'mergeForProduction');
  const cols = entries.filter(([, p]) => p.type === 'color');
  const choiceColors = entries.filter(([, p]) => p.affects === 'colors' && p.type !== 'color');

  const control = (k: string, p: (typeof entries)[number][1]) => {
    const v = vals[k];
    if (p.type === 'range') {
      const num = Number(v);
      const dec = (p.step ?? 1) < 0.01 ? 3 : (p.step ?? 1) < 1 ? 2 : 0;
      return (
        <label key={k} className="block" title={p.describe}>
          <div className="mb-1.5 flex items-center justify-between text-[13px]">
            <span className="text-slate-300">{p.label}</span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-emerald-300">{num.toFixed(dec)}</span>
          </div>
          <input className="slider" type="range" min={p.min} max={p.max} step={p.step} value={num} onChange={(e) => props.onChange(k, parseFloat(e.target.value))} />
        </label>
      );
    }
    if (p.type === 'choice') {
      return (
        <label key={k} className="block" title={p.describe}>
          <div className="mb-1.5 text-[13px] text-slate-300">{p.label}</div>
          <div className="flex flex-wrap gap-1.5">
            {p.options!.map((o) => (
              <button key={o} onClick={() => props.onChange(k, o)}
                className={`rounded-md px-2.5 py-1 text-xs capitalize ring-1 transition ${v === o ? 'bg-emerald-400/15 text-emerald-200 ring-emerald-400/50' : 'bg-slate-800/60 text-slate-300 ring-slate-700 hover:ring-slate-500'}`}>
                {o.replace(/-/g, ' ')}
              </button>
            ))}
          </div>
        </label>
      );
    }
    if (p.type === 'toggle') {
      return (
        <label key={k} className="flex cursor-pointer items-center justify-between text-[13px]" title={p.describe}>
          <span className="text-slate-300">{p.label}</span>
          <span className={`relative h-5 w-9 rounded-full transition ${v ? 'bg-emerald-500' : 'bg-slate-700'}`}>
            <input type="checkbox" className="sr-only" checked={!!v} onChange={(e) => props.onChange(k, e.target.checked)} />
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${v ? 'left-[18px]' : 'left-0.5'}`} />
          </span>
        </label>
      );
    }
    return null;
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-5">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-400/90">{info.order} · {info.family}</div>
        <h2 className="mt-1 text-xl font-semibold text-white">{info.name}</h2>
        <div className="text-sm italic text-slate-400">{info.scientific}</div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          <span className={`rounded-full px-2 py-0.5 ring-1 ${statusTone(info.status)}`}>{info.status}</span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300 ring-1 ring-slate-700">{info.size}</span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300 ring-1 ring-slate-700">{ENVIRONMENTS[info.environment]?.label ?? info.environment}</span>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-400">{info.habitat}</p>
        <p className="mt-2 rounded-lg bg-slate-900/80 p-3 text-[13px] leading-relaxed text-slate-300 ring-1 ring-slate-800">{info.fact}</p>
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto">
        <Section title="Shape & Pose">
          {geo.map(([k, p]) => control(k, p))}
        </Section>
        <Section title="Colour">
          {choiceColors.map(([k, p]) => control(k, p))}
          <div className="grid grid-cols-1 gap-2.5">
            {cols.map(([k, p]) => (
              <label key={k} className="flex items-center justify-between text-[13px]" title={p.describe}>
                <span className="text-slate-300">{p.label}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[11px] uppercase text-slate-500">{props.colorFor(k)}</span>
                  <input className="swatch" type="color" value={props.colorFor(k)} onChange={(e) => props.onColor(k, e.target.value)} />
                </span>
              </label>
            ))}
          </div>
        </Section>
        {sp.mod.detach.length > 0 && (
          <Section title="Parts">
            <div className="flex flex-wrap gap-1.5">
              {sp.mod.detach.map((d) => (
                <button key={d} onClick={() => props.onHide(d, !props.hidden[d])}
                  className={`rounded-md px-2.5 py-1 text-xs ring-1 transition ${props.hidden[d] ? 'bg-slate-900 text-slate-500 line-through ring-slate-800' : 'bg-slate-800/60 text-slate-200 ring-slate-600'}`}>
                  {d}
                </button>
              ))}
            </div>
          </Section>
        )}
        <Section title="Export" defaultOpen={false}>
          {control('mergeForProduction', sp.mod.params.mergeForProduction)}
          <div className="text-xs leading-relaxed text-slate-500">
            Rig bones: <span className="text-slate-300">{Object.keys(sp.mod.rig).join(', ')}</span>
          </div>
          <button onClick={props.onReset} className="w-full rounded-lg bg-slate-800 py-2 text-xs font-medium text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700">Reset to defaults</button>
        </Section>
      </div>
    </div>
  );
}
