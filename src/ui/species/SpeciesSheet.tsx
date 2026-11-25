import { useMemo, type ReactNode } from 'react';
import type { AssetDef } from '../../assets/types';
import { CATALOG } from '../../assets/catalog';
import { ROLE_META, dietText, feedsOn, partnersOf, roleOf } from '../../assets/foodweb';
import { BIOMES } from '../../biomes/templates';
import { Chip, statusColor } from '../common';
import { Modal } from '../Modal';
import { useSpeciesMedia } from './media';
import { Credit, SpeciesMore, SpeciesPhoto, StatusScale } from './SpeciesInfo';

const BIOME_BY = Object.fromEntries(BIOMES.map((b) => [b.id, b]));
const MOVES: Record<string, string> = { walk: 'walking', fly: 'flying', swim: 'swimming', slither: 'slithering', hop: 'hopping', crawl: 'crawling' };

/** who it eats and who eats it among the living things of its own habitats (not just one diorama) */
function wildLinks(d: AssetDef) {
  const near = CATALOG.filter((o) => o.id !== d.id && o.living !== false && o.biomes.some((b) => d.biomes.includes(b)));
  const by = (list: AssetDef[]) => list.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 10);
  return {
    eats: by(near.filter((o) => feedsOn(d, o)?.kind === 'eats')),
    eatenBy: by(near.filter((o) => feedsOn(o, d)?.kind === 'eats')),
  };
}

/**
 * A species from the Field journal, as a panel on top of the journal on phones and tablets (a
 * dialog on wide screens): a real photo beside its 3D model, what it is and does, who eats whom in
 * its habitats, how it is doing in the wild, a description, where in the world it lives and where
 * to find out more. It closes with ✕, by dragging it down, tapping outside, Escape or Back, which
 * leaves the journal open underneath; a tab leaves both.
 */
export function SpeciesSheet({ def, onClose }: { def: AssetDef | null; onClose: () => void }) {
  return (
    <Modal open={!!def} onClose={onClose} label={def?.name} icon={def?.emoji} accent={def ? ROLE_META[roleOf(def)].color : undefined}
      title={def?.name ?? ''}>
      {def && <SpeciesBody def={def} />}
    </Modal>
  );
}

function SpeciesBody({ def }: { def: AssetDef }) {
  const media = useSpeciesMedia(def.id);
  const info = def.info;
  const rm = ROLE_META[roleOf(def)];
  const links = useMemo(() => wildLinks(def), [def]);
  const chain = [info.kingdom, info.phylum, info.class, info.order, info.family].filter(Boolean) as string[];
  const partners = partnersOf(def.id);
  const facts: [string, string][] = [];
  if (info.habitat) facts.push(['Lives in', info.habitat]);
  if (info.size) facts.push(['Real size', info.size]);
  if (def.loco in MOVES) facts.push(['Moves by', MOVES[def.loco]]);
  if (info.diet && info.diet !== 'none' && info.diet !== 'producer') facts.push(['Diet', info.diet]);
  return (
    <div className="space-y-3 text-sm" data-tour="species-sheet" style={{ ['--role' as string]: rm.color }}>
      <div>
        <SpeciesPhoto def={def} media={media} className="h-[min(56vw,250px,42dvh)] rounded-3xl border-b-4" />
        {media?.photo && <Credit c={media.photo} className="mt-1.5 px-1" />}
      </div>
      <div>
        {info.scientific && <div className="text-[15px] italic text-ink/65">{info.scientific}</div>}
        <div className="mt-1.5 flex flex-wrap gap-1">
          <Chip color={rm.color}>{rm.emoji} {rm.label}</Chip>
          {info.status && <Chip color={statusColor(info.status)}>{info.status}</Chip>}
        </div>
      </div>
      {(info.fact || info.blurb) && <p className="rounded-2xl bg-amber-50 p-3 leading-relaxed text-ink/85 ring-1 ring-amber-200">💡 {info.fact ?? info.blurb}</p>}
      {facts.length > 0 && (
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          {facts.map(([k, v]) => <div key={k} className="rounded-xl bg-black/[0.03] px-2.5 py-1.5"><div className="text-[10px] font-bold uppercase tracking-wide text-ink/45">{k}</div><div className="font-semibold text-ink/85 first-letter:uppercase">{v}</div></div>)}
        </div>
      )}
      {def.living !== false && (
        <section className="space-y-1.5 rounded-2xl bg-black/[0.03] p-3 text-[13px]">
          <h3 className="font-display text-[12px] font-bold uppercase tracking-wider text-ink/55">🕸️ Food web in the wild</h3>
          {def.category === 'animals' && !!info.eats?.length && <p className="text-ink/75"><b className="text-ink/85">🍽️ Eats:</b> {dietText(def, 8)}</p>}
          {links.eats.length > 0 && <Names label={def.category === 'animals' ? 'Such as' : 'Feeds on'} list={links.eats} />}
          {links.eatenBy.length > 0 && <Names label={def.category === 'plants' ? '🐛 Eaten by' : '⚠️ Hunted by'} list={links.eatenBy} />}
          {roleOf(def) === 'decomposer' && <p className="text-ink/75"><b className="text-ink/85">♻ Recycles:</b> dead plants and animals back into soil that plants can use.</p>}
          {partners.map((p) => { const o = CATALOG.find((c) => c.id === p.other); return o ? <p key={p.other} className="text-emerald-800"><b>🤝 Partner — {o.emoji} {o.name}:</b> {p.how}</p> : null; })}
        </section>
      )}
      {def.biomes.length > 0 && (
        <section className="rounded-2xl bg-black/[0.03] p-3">
          <h3 className="mb-1.5 font-display text-[12px] font-bold uppercase tracking-wider text-ink/55">🧭 In these habitats</h3>
          <div className="flex flex-wrap gap-1">{def.biomes.filter((b) => BIOME_BY[b]).map((b) => <span key={b} className="rounded-full bg-white px-2 py-0.5 text-[12px] font-semibold text-ink/75 ring-1 ring-black/10">{BIOME_BY[b].emoji} {BIOME_BY[b].name}</span>)}</div>
        </section>
      )}
      <StatusScale status={info.status} redlist={media?.redlist} iucn={media?.iucn} />
      <SpeciesMore media={media} name={def.name} />
      {chain.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold text-ink/55" aria-label="Classification">
          {chain.map((c, i) => <span key={c + i} className="flex items-center gap-1">{i > 0 && <span className="text-ink/30">›</span>}<span className="rounded-md bg-black/5 px-1.5 py-0.5">{c}</span></span>)}
        </div>
      )}
    </div>
  );
}

function Names({ label, list }: { label: ReactNode; list: AssetDef[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <b className="mr-0.5 text-ink/85">{label}:</b>
      {list.map((o) => <span key={o.id} className="rounded-full bg-white px-2 py-0.5 text-[12px] font-semibold text-ink/80 ring-1 ring-black/10">{o.emoji} {o.name}</span>)}
    </div>
  );
}
