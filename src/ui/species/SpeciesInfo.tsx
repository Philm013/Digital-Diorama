import { useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { ExternalLink, Globe2, Camera, BookOpen } from 'lucide-react';
import type { AssetDef } from '../../assets/types';
import { ROLE_META, roleOf } from '../../assets/foodweb';
import { AssetThumb } from '../AssetThumb';
import { mediaUrl, type MediaCredit, type RedList, type SpeciesMedia } from './media';

/* ---------------- the real photo ---------------- */
/**
 * A real photo of the species (from public/species), with its 3D model in the corner to compare.
 * While the photos load, and for the few species without one, it shows the 3D model on its
 * food-web colour instead, at the same size so nothing jumps.
 */
export function SpeciesPhoto({ def, media, className, overlay, fallbackModel = true }: {
  def: AssetDef; media: SpeciesMedia | null | undefined; className?: string;
  /** drawn over the picture (names, buttons); told whether a photo is showing */
  overlay?: (photo: boolean) => ReactNode;
  /** without a photo, show the 3D model big in the middle (or leave it to the overlay) */
  fallbackModel?: boolean;
}) {
  const p = media?.photo;
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const show = !!p && failed !== p.src;
  const role = ROLE_META[roleOf(def)];
  return (
    <div className={clsx('relative isolate overflow-hidden', className)} style={{ ['--role' as string]: role.color, borderColor: role.color }}>
      <div className="dd-species-hero absolute inset-0 -z-10" />
      {show ? (
        <>
          <img src={mediaUrl(p.src)} alt={`Photo of a real ${def.name.toLowerCase()}`} width={p.w} height={p.h} draggable={false} decoding="async"
            onLoad={() => setLoaded(p.src)} onError={() => setFailed(p.src)}
            className={clsx('absolute inset-0 h-full w-full object-cover transition-opacity duration-300', loaded === p.src ? 'opacity-100' : 'opacity-0')} />
          <span className="absolute bottom-2 left-2 grid h-[58px] w-[58px] place-items-center rounded-2xl bg-white/85 shadow-[0_4px_12px_-4px_rgba(0,0,0,.5)] ring-2 ring-white/70 backdrop-blur-sm" title="Its 3D model in your diorama">
            <AssetThumb id={def.id} emoji={def.emoji} size={52} />
          </span>
        </>
      ) : fallbackModel && (
        <div className="absolute inset-0 grid place-items-center">
          <AssetThumb id={def.id} emoji={def.emoji} size={120} />
        </div>
      )}
      {overlay?.(show)}
    </div>
  );
}

/** "📷 Jane Doe · CC BY-SA 4.0 · Wikimedia Commons", each part a link */
export function Credit({ c, kind = 'Photo', className }: { c: MediaCredit; kind?: 'Photo' | 'Map'; className?: string }) {
  const link = 'underline decoration-dotted underline-offset-2 hover:text-ink';
  // (the whole credit, wrapped if it is long: the licences ask for it)
  return (
    <div className={clsx('flex min-w-0 items-start gap-1 text-[10.5px] font-semibold leading-snug text-ink/50', className)}>
      {kind === 'Photo' ? <Camera size={11} className="mt-px shrink-0" aria-hidden /> : <Globe2 size={11} className="mt-px shrink-0" aria-hidden />}
      <span className="min-w-0 break-words">
        <span className="sr-only">{kind} by </span>
        <a href={c.url} target="_blank" rel="noopener noreferrer" className={link}>{c.by}</a>
        {' · '}<a href={c.licUrl || c.url} target="_blank" rel="noopener noreferrer license" className={link}>{c.lic}</a>
        {' · '}{c.from}
      </span>
    </div>
  );
}

/* ---------------- conservation status ---------------- */
const RED: { code: RedList; label: string; color: string; says: string }[] = [
  { code: 'LC', label: 'Least Concern', color: '#3f9b3a', says: 'Widespread and plentiful in the wild.' },
  { code: 'NT', label: 'Near Threatened', color: '#9fae2a', says: 'Doing all right for now, but could soon be at risk.' },
  { code: 'VU', label: 'Vulnerable', color: '#d99a1e', says: 'At high risk of dying out in the wild.' },
  { code: 'EN', label: 'Endangered', color: '#e0662f', says: 'At very high risk of dying out in the wild.' },
  { code: 'CR', label: 'Critically Endangered', color: '#c0392b', says: 'At extremely high risk: very few are left in the wild.' },
];
const OTHER: Partial<Record<RedList, { label: string; says: string }>> = {
  EW: { label: 'Extinct in the Wild', says: 'Survives only in zoos, aquariums or gardens.' },
  EX: { label: 'Extinct', says: 'No longer alive anywhere.' },
  DD: { label: 'Data Deficient', says: 'Scientists don’t know enough yet to say how it is doing.' },
};
/** the catalog's own status first ("Vulnerable", "Least Concern (invasive)"), else the Red List's */
function readStatus(status: string | undefined, redlist: RedList | undefined) {
  const s = (status ?? '').trim();
  const note = s.match(/\(([^)]+)\)/)?.[1];
  const lower = s.toLowerCase();
  if (lower.startsWith('domestic')) return { kind: 'domestic' as const };
  const hit = RED.find((r) => lower.startsWith(r.label.toLowerCase())) ?? (s ? undefined : RED.find((r) => r.code === redlist));
  if (hit) return { kind: 'scale' as const, hit, note };
  if (!s && redlist && OTHER[redlist]) return { kind: 'other' as const, ...OTHER[redlist]! };
  if (lower.startsWith('not evaluated') || (!s && !redlist)) return null;
  return s ? { kind: 'other' as const, label: s, says: '' } : null;
}

/** where it stands on the IUCN Red List, as a scale from Least Concern to Critically Endangered */
export function StatusScale({ status, redlist, iucn }: { status?: string; redlist?: RedList; iucn?: string }) {
  const r = readStatus(status, redlist);
  if (!r) return null;
  if (r.kind === 'domestic') {
    return (
      <Box title="🐾 Conservation">
        <p className="text-[13px] leading-snug text-ink/75"><b className="text-ink/85">Domesticated:</b> people have bred and cared for it for thousands of years, so it isn’t rated on the Red List of wild species.</p>
      </Box>
    );
  }
  if (r.kind === 'other') {
    return (
      <Box title="🛡️ Conservation">
        <p className="text-[13px] leading-snug text-ink/75"><b className="text-ink/85">{r.label}</b>{r.says ? ` — ${r.says}` : ''}</p>
      </Box>
    );
  }
  const i = RED.indexOf(r.hit);
  return (
    <Box title="🛡️ Conservation status" right={iucn ? <a href={iucn} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-[11px] font-bold text-[#3d85c6] hover:underline">IUCN <ExternalLink size={11} /></a> : null}>
      <div className="flex gap-1" role="img" aria-label={`${r.hit.label}: ${i + 1} of 5 on the scale from Least Concern to Critically Endangered`}>
        {RED.map((x, k) => (
          <span key={x.code} className={clsx('grid h-7 flex-1 place-items-center rounded-lg font-display text-[11.5px] font-bold transition', k === i ? 'text-white shadow-[0_2px_0_rgba(0,0,0,.18)] ring-2 ring-white' : 'text-ink/35')}
            style={{ background: k === i ? x.color : `color-mix(in srgb, ${x.color} 16%, white)` }} title={x.label}>{x.code}</span>
        ))}
      </div>
      <p className="mt-1.5 text-[13px] leading-snug text-ink/75"><b style={{ color: r.hit.color }}>{r.hit.label}</b>{r.note ? <span className="text-ink/55"> ({r.note})</span> : null} — {r.hit.says}</p>
    </Box>
  );
}

/* ---------------- about, where, learn more ---------------- */
/** the Wikipedia description, the range map and links to read more */
export function SpeciesMore({ media, name }: { media: SpeciesMedia | null | undefined; name: string }) {
  if (!media) return null;
  const links: [string, string, ReactNode][] = [];
  if (media.wiki) links.push(['Wikipedia', media.wiki, <BookOpen key="w" size={14} />]);
  if (media.inat) links.push(['iNaturalist', `https://www.inaturalist.org/taxa/${media.inat}`, <Camera key="i" size={14} />]);
  return (
    <>
      {media.about && (
        <Box title="📖 About">
          <p className="text-[13.5px] leading-relaxed text-ink/85">{media.about}</p>
          {(media.aboutUrl || media.wiki) && <p className="mt-1.5 text-[10.5px] font-semibold leading-tight text-ink/45">Adapted from <a href={media.aboutUrl || media.wiki} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-ink">Wikipedia</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer license" className="underline decoration-dotted underline-offset-2 hover:text-ink">CC BY-SA 4.0</a></p>}
        </Box>
      )}
      {media.map && <RangeMap c={media.map} name={name} />}
      {(links.length > 0 || media.obs) && (
        <Box title="🔎 Find out more">
          {!!media.obs && media.inat && <p className="mb-2 text-[13px] leading-snug text-ink/75">👀 People have recorded it <b className="text-ink/90">{media.obs.toLocaleString()}</b> {media.obs === 1 ? 'time' : 'times'} on iNaturalist. You could spot one too!</p>}
          <div className="flex flex-wrap gap-1.5">
            {links.map(([label, href, icon]) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 font-display text-[13px] font-semibold text-ink/80 ring-1 ring-black/10 transition hover:bg-black/[0.03] active:scale-95 [@media(pointer:coarse)]:h-10">
                {icon} {label} <ExternalLink size={12} className="text-ink/40" />
              </a>
            ))}
          </div>
        </Box>
      )}
    </>
  );
}

function RangeMap({ c, name }: { c: MediaCredit; name: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <Box title="🗺️ Where in the world">
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
        <img src={mediaUrl(c.src)} alt={`Map of where the ${name.toLowerCase()} lives`} width={c.w} height={c.h} loading="lazy" decoding="async" draggable={false} onError={() => setOk(false)} className="mx-auto block h-auto max-h-[220px] w-full object-contain" />
      </div>
      <Credit c={c} kind="Map" className="mt-1.5" />
    </Box>
  );
}

function Box({ title, right, children }: { title: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-black/[0.03] p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="font-display text-[12px] font-bold uppercase tracking-wider text-ink/55">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}
