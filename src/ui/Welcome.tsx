import { useEffect, useRef, useState } from 'react';
import { Download, FolderOpen, Trash2, Upload, Sparkles, Hammer, Compass, Blocks, Presentation } from 'lucide-react';
import { BIOMES } from '../biomes/templates';
import type { BiomeTemplate } from '../biomes/types';
import { deleteProject, exportProject, importProjectFile, listProjects, loadProject, saveSettings, type ProjectMeta, type Settings } from '../storage/projects';
import type { DioramaDoc } from '../engine/types';
import { newDoc } from '../biomes/factory';
import { biomeThumb } from './thumbs';
import { Btn, Modal, Segmented } from './common';

export function Welcome({ settings, setSettings, onOpen }: { settings: Settings; setSettings: (s: Settings) => void; onOpen: (doc: DioramaDoc) => void }) {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [pick, setPick] = useState<BiomeTemplate | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { void listProjects().then(setProjects); }, []);

  const start = () => {
    if (!pick) return;
    const doc = newDoc(pick, settings.quality, { title: title.trim() || pick.name, author: settings.author.trim() });
    setPick(null);
    onOpen(doc);
  };
  const updateSettings = (s: Settings) => { setSettings(s); saveSettings(s); };

  return (
    <div className="dd-welcome h-full overflow-y-auto">
      <header className="relative overflow-hidden px-5 pb-10 pt-10 text-center sm:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-wider text-kraft-dark ring-1 ring-black/5">
            <span>📦</span> The shoebox diorama, reimagined
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight text-ink sm:text-6xl">Digital Diorama</h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-ink/75 sm:text-lg">Build a living 3D habitat, fill it with real species, label what you learned — then bring it to life with block code and present it to your class.</p>
          <div className="mx-auto mt-6 grid max-w-2xl grid-cols-2 gap-2 text-left sm:grid-cols-4">
            {[
              [<Hammer size={18} key="b" />, 'Build', 'Sculpt land, add 250+ plants & animals'],
              [<Compass size={18} key="e" />, 'Explore', 'Tap to learn, walk inside, food webs'],
              [<Blocks size={18} key="c" />, 'Code', 'Scratch-style blocks make it move'],
              [<Presentation size={18} key="p" />, 'Present', 'Guided tours with narration'],
            ].map(([icon, h, t]) => (
              <div key={h as string} className="rounded-2xl bg-white/75 p-3 ring-1 ring-black/5">
                <div className="flex items-center gap-1.5 font-display font-semibold text-leaf">{icon}{h}</div>
                <div className="mt-0.5 text-xs leading-snug text-ink/70">{t}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-8">
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold">Start a new diorama</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-ink/60">Graphics</span>
              <Segmented size="sm" value={settings.quality} onChange={(q) => updateSettings({ ...settings, quality: q })}
                options={[{ value: 'low', label: 'Fast', title: 'Best for phones & Chromebooks' }, { value: 'medium', label: 'Balanced' }, { value: 'high', label: 'Detailed', title: 'For fast computers' }]} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {BIOMES.map((b) => (
              <button key={b.id} onClick={() => { setPick(b); setTitle(''); }} className="dd-card group flex flex-col justify-start text-left">
                <div className="relative aspect-[16/9] overflow-hidden rounded-t-2xl">
                  <img src={biomeThumb(b.env.backdrop ?? 'meadow')} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute bottom-0 left-0 right-0 h-3" style={{ background: 'repeating-linear-gradient(90deg,#6b4a2c 0 18px,#7d5734 18px 30px,#5a3d24 30px 44px)' }} />
                  <span className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-xl bg-white/90 text-2xl shadow">{b.emoji}</span>
                </div>
                <div className="p-3.5">
                  <div className="font-display text-lg font-semibold" style={{ color: b.accent }}>{b.name}</div>
                  <div className="mt-0.5 text-[13px] leading-snug text-ink/70">{b.tagline}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold">My dioramas</h2>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept=".json,.diorama.json,application/json" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try { onOpen(await importProjectFile(f)); } catch (err) { setError((err as Error).message); }
              }} />
              <Btn onClick={() => fileRef.current?.click()}><Upload size={16} /> Open a file</Btn>
            </div>
          </div>
          {error && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}
          {projects.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-black/10 p-8 text-center text-ink/60">Your saved dioramas will appear here. Everything saves automatically on this device.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
              {projects.map((p) => (
                <div key={p.id} className="dd-card overflow-hidden">
                  <button className="block w-full text-left" onClick={async () => { const d = await loadProject(p.id); if (d) onOpen(d); }}>
                    <div className="aspect-[16/10] bg-kraft/30">
                      {p.thumb ? <img src={p.thumb} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-4xl">{BIOMES.find((b) => b.id === p.biome)?.emoji ?? '📦'}</div>}
                    </div>
                    <div className="px-3.5 pt-3">
                      <div className="truncate font-display font-semibold">{p.title}</div>
                      <div className="text-xs text-ink/60">{p.author ? `${p.author} · ` : ''}{p.actors} things · {new Date(p.updated).toLocaleDateString()}</div>
                    </div>
                  </button>
                  <div className="flex gap-1 p-2.5">
                    <Btn size="sm" onClick={async () => { const d = await loadProject(p.id); if (d) onOpen(d); }}><FolderOpen size={14} /> Open</Btn>
                    <Btn size="sm" variant="ghost" title="Download a copy" onClick={async () => { const d = await loadProject(p.id); if (d) exportProject(d); }}><Download size={14} /></Btn>
                    <Btn size="sm" variant="ghost" title="Delete" onClick={async () => { if (confirm(`Delete “${p.title}”? This cannot be undone.`)) { await deleteProject(p.id); setProjects(await listProjects()); } }}><Trash2 size={14} /></Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-14 text-center text-xs text-ink/50">
          Built from the procedural three.js asset library in <code>References/</code> · No accounts, no tracking — projects stay on this device.
        </footer>
      </main>

      <Modal open={!!pick} onClose={() => setPick(null)} title={<span>{pick?.emoji} New {pick?.name} diorama</span>}>
        {pick && (
          <div className="space-y-4">
            <img src={biomeThumb(pick.env.backdrop ?? 'meadow', 640, 300)} alt="" className="w-full rounded-2xl" />
            <p className="text-sm text-ink/75">{pick.guide.summary}</p>
            <label className="block">
              <span className="text-[13px] font-semibold text-ink/70">Diorama title</span>
              <input className="dd-input mt-1" value={title} placeholder={pick.name} onChange={(e) => setTitle(e.target.value)} maxLength={40} autoFocus />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-ink/70">Made by (optional)</span>
              <input className="dd-input mt-1" value={settings.author} placeholder="Your name or team" onChange={(e) => updateSettings({ ...settings, author: e.target.value })} maxLength={40} />
            </label>
            <Btn variant="solid" size="lg" className="w-full" onClick={start}><Sparkles size={18} /> Build it!</Btn>
          </div>
        )}
      </Modal>
    </div>
  );
}
