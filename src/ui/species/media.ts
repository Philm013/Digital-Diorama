import { useEffect, useState } from 'react';

/**
 * Real photos, range maps and short descriptions for the species cards. They live in
 * public/species/ (made by tools/fetch-species-media.mjs), with every picture's author, licence
 * and source, and are only loaded when a card first opens.
 */
export interface MediaCredit {
  /** file in public/species/ */
  src: string;
  w: number; h: number;
  /** author (or the attribution the licence asks for) */
  by: string;
  /** licence name, e.g. "CC BY-SA 4.0", "CC0" or "Public domain" */
  lic: string;
  licUrl?: string;
  /** the picture's page at its source */
  url: string;
  /** "Wikimedia Commons" or "iNaturalist" */
  from: string;
}
export type RedList = 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX' | 'DD';
export interface SpeciesMedia {
  name: string;
  /** Wikidata item */
  q?: string;
  /** English Wikipedia article (the description is adapted from its opening) */
  wiki?: string;
  photo?: MediaCredit;
  map?: MediaCredit;
  /** the opening of a Wikipedia article, shortened (CC BY-SA 4.0) */
  about?: string;
  /** the article `about` comes from, when it isn't `wiki` (a Labrador's text is from "Dog") */
  aboutUrl?: string;
  /** iNaturalist taxon id, and how many times people have recorded it there */
  inat?: number;
  obs?: number;
  /** global IUCN Red List category, and its page */
  redlist?: RedList;
  iucn?: string;
}

// (relative, so it also works from a sub-folder such as GitHub Pages)
const BASE = `${import.meta.env.BASE_URL}species/`;
export const mediaUrl = (src: string) => BASE + src;

let all: Record<string, SpeciesMedia> | null = null;
let loading: Promise<void> | null = null;
let failed = false;
const subs = new Set<() => void>();

/** fetch the species data once (again later if it failed, e.g. offline before it was cached) */
export function loadSpeciesMedia(): Promise<void> {
  if (all) return Promise.resolve();
  if (!loading) {
    failed = false;
    loading = fetch(`${BASE}media.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((m: Record<string, SpeciesMedia>) => { all = m; })
      .catch(() => { failed = true; loading = null; })
      .finally(() => { for (const fn of subs) fn(); });
  }
  return loading ?? Promise.resolve();
}

/** a species' photo, map and description: undefined while loading, null when there are none */
export function useSpeciesMedia(id: string | undefined): SpeciesMedia | null | undefined {
  const [, bump] = useState(0);
  useEffect(() => {
    if (all) return;
    const fn = () => bump((x) => x + 1);
    subs.add(fn);
    void loadSpeciesMedia();
    return () => { subs.delete(fn); };
  }, []);
  if (all) return (id && all[id]) || null;
  return failed ? null : undefined;
}
