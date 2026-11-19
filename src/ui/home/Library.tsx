import { useMemo, useState } from 'react';
import { Download, Map as MapIcon, MoreHorizontal, Play, Search, Trash2, Upload, X } from 'lucide-react';
import { clsx } from 'clsx';
import { BIOME_BY_ID } from '../../biomes/templates';
import { deleteProject, exportProject, loadProject, type ProjectMeta } from '../../storage/projects';
import { Btn } from '../common';
import { Stars } from '../game/Hud';
import { useProfile } from '../game/useGame';
import { uiSound } from '../feedback';

const rtf = typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }) : null;
/** "5 minutes ago", "yesterday", or a date */
export function ago(t: number) {
  const s = (t - Date.now()) / 1000;
  const a = Math.abs(s);
  if (!rtf || a > 86400 * 6.5) return new Date(t).toLocaleDateString();
  if (a < 60) return 'just now';
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}

/**
 * The My dioramas tray: saved dioramas as picture tiles, newest first. Tap one to open it; its
 * ⋯ button offers a download or delete.
 */
export function DioramaLibrary({ projects, onOpenProject, onChanged, onNew, onImport, error }: {
  projects: ProjectMeta[] | null; onOpenProject: (id: string) => void; onChanged: () => void; onNew: () => void; onImport: () => void; error?: string;
}) {
  const profile = useProfile();
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (projects ?? []).filter((p) => !s || `${p.title} ${BIOME_BY_ID[p.biome]?.name ?? ''} ${p.author}`.toLowerCase().includes(s));
  }, [projects, q]);
  const banner = error ? <div role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</div> : null;
  if (!projects) return <div className="grid h-full place-items-center text-sm font-semibold text-ink/45">Loading…</div>;
  if (!projects.length) {
    return (
      <div className="absolute inset-0 overflow-y-auto px-6 pb-[var(--tray-pb)] pt-2">
        {banner}
        <div className="mx-auto flex min-h-full max-w-sm flex-col items-center justify-center pb-6 text-center">
          <div className="grid h-24 w-24 place-items-center rounded-[28px] border-2 border-dashed border-black/15 bg-white/70 text-5xl">📦</div>
          <div className="mt-3 font-display text-xl font-bold">No dioramas yet</div>
          <p className="mt-1 text-sm text-ink/60">Everything you build saves automatically on this device and shows up here.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={onNew} className="dd-cta flex h-12 items-center gap-2 rounded-2xl px-5 font-display text-base font-bold text-white"><MapIcon size={18} /> Choose an expedition</button>
            <Btn onClick={onImport}><Upload size={16} /> Open a file</Btn>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain px-3 pb-[var(--tray-pb)] pt-1 sm:px-5">
      {banner}
      {projects.length > 6 && (
        <div className="relative mb-2.5">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your dioramas…" className="dd-input h-10 pl-9 text-[15px]" type="search" />
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] sm:gap-3">
        {list.map((p, i) => (
          <DioramaTile key={p.id} p={p} latest={i === 0 && !q} stars={profile.projectStars[p.id] ?? 0} menu={menu === p.id}
            onMenu={(on) => { setMenu(on ? p.id : null); uiSound('tick'); }} onOpen={() => onOpenProject(p.id)} onChanged={onChanged} />
        ))}
      </div>
      {list.length === 0 && <p className="py-8 text-center text-sm text-ink/55">No dioramas match “{q}”.</p>}
      <p className="mt-3 pb-1 text-center text-[11.5px] font-semibold text-ink/45">Saved on this device. Download a copy to move one to another device.</p>
    </div>
  );
}

function DioramaTile({ p, latest, stars, menu, onMenu, onOpen, onChanged }: {
  p: ProjectMeta; latest: boolean; stars: number; menu: boolean; onMenu: (on: boolean) => void; onOpen: () => void; onChanged: () => void;
}) {
  const b = BIOME_BY_ID[p.biome];
  const things = p.actors === 1 ? '1 thing' : `${p.actors} things`;
  return (
    <div className="dd-tile-card group relative flex min-w-0 flex-col overflow-hidden rounded-2xl" style={{ ['--accent' as string]: b?.accent }}>
      <button type="button" onClick={onOpen} className="flex flex-1 flex-col text-left" aria-label={`Open ${p.title}`}>
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#e9dfcc]">
          {p.thumb
            ? <img src={p.thumb} alt="" draggable={false} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            : <div className="dd-thumb-ph grid h-full w-full place-items-center text-4xl">{b?.emoji ?? '📦'}</div>}
          <span className="absolute left-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-[11px] bg-white/95 text-[18px] leading-none shadow-md">{b?.emoji ?? '📦'}</span>
          {latest && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[#2fae4b] px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-white shadow">Latest</span>}
          {stars > 0 && <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/45 px-1.5 py-0.5 leading-none backdrop-blur-sm"><Stars n={stars} size={10} /></span>}
        </div>
        <div className="min-w-0 px-2.5 pb-2.5 pt-2">
          <div className="truncate font-display text-[14.5px] font-bold leading-tight">{p.title}</div>
          <div className="mt-0.5 truncate text-[11.5px] text-ink/55">{ago(p.updated)} · {things}</div>
        </div>
      </button>
      <button type="button" onClick={() => onMenu(!menu)} aria-label={`More for ${p.title}`} aria-expanded={menu} title="More"
        className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/55">
        <MoreHorizontal size={17} />
      </button>
      {menu && (
        <div className="dd-pop absolute inset-0 z-10 flex flex-col justify-center gap-1.5 bg-[#16211b]/92 p-2.5 pt-10 backdrop-blur-[2px]">
          <button type="button" onClick={() => onMenu(false)} aria-label="Close" className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full text-white/80 hover:bg-white/10"><X size={17} /></button>
          <TileAction icon={<Play size={15} fill="currentColor" />} label="Open" onClick={onOpen} />
          <TileAction icon={<Download size={15} />} label="Download a copy" onClick={async () => { const d = await loadProject(p.id); if (d) exportProject(d); onMenu(false); }} />
          <TileAction danger icon={<Trash2 size={15} />} label="Delete…" onClick={async () => {
            if (!confirm(`Delete “${p.title}”? This cannot be undone.`)) return;
            await deleteProject(p.id);
            uiSound('trash');
            onMenu(false);
            onChanged();
          }} />
        </div>
      )}
    </div>
  );
}

function TileAction({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={clsx('flex h-9 min-w-0 items-center gap-2 rounded-xl px-3 font-display text-[13px] font-semibold transition', danger ? 'text-[#ff9a9a] hover:bg-red-500/20' : 'bg-white/10 text-white hover:bg-white/20')}>
      <span className="shrink-0">{icon}</span><span className="truncate">{label}</span>
    </button>
  );
}
