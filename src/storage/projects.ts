import type { DioramaDoc } from '../engine/types';

export interface ProjectMeta { id: string; title: string; biome: string; author: string; updated: number; thumb?: string; actors: number }

const DB_NAME = 'digital-diorama';
const VERSION = 1;
let dbp: Promise<IDBDatabase | null> | null = null;

function db(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbp;
}
function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return db().then((d) => new Promise((resolve) => {
    if (!d) { resolve(undefined); return; }
    try {
      const t = d.transaction(store, mode);
      const r = fn(t.objectStore(store));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  }));
}

const LS_KEY = 'dd-projects-fallback';
function lsAll(): Record<string, { doc: DioramaDoc; meta: ProjectMeta }> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}

export async function saveProject(doc: DioramaDoc, thumb?: string): Promise<boolean> {
  const prev = await getMeta(doc.id);
  const meta: ProjectMeta = { id: doc.id, title: doc.title, biome: doc.biome, author: doc.author, updated: doc.updated || Date.now(), thumb: thumb ?? prev?.thumb, actors: doc.actors.length };
  const d = await db();
  if (d) {
    await tx('projects', 'readwrite', (s) => s.put(doc));
    await tx('meta', 'readwrite', (s) => s.put(meta));
    return true;
  }
  try {
    const all = lsAll();
    all[doc.id] = { doc, meta };
    localStorage.setItem(LS_KEY, JSON.stringify(all));
    return true;
  } catch { return false; }
}
async function getMeta(id: string): Promise<ProjectMeta | undefined> {
  const d = await db();
  if (d) return tx<ProjectMeta>('meta', 'readonly', (s) => s.get(id));
  return lsAll()[id]?.meta;
}
export async function listProjects(): Promise<ProjectMeta[]> {
  const d = await db();
  const list = d ? ((await tx<ProjectMeta[]>('meta', 'readonly', (s) => s.getAll())) ?? []) : Object.values(lsAll()).map((x) => x.meta);
  return list.sort((a, b) => b.updated - a.updated);
}
export async function loadProject(id: string): Promise<DioramaDoc | null> {
  const d = await db();
  if (d) return (await tx<DioramaDoc>('projects', 'readonly', (s) => s.get(id))) ?? null;
  return lsAll()[id]?.doc ?? null;
}
export async function deleteProject(id: string) {
  const d = await db();
  if (d) { await tx('projects', 'readwrite', (s) => s.delete(id)); await tx('meta', 'readwrite', (s) => s.delete(id)); return; }
  const all = lsAll(); delete all[id]; localStorage.setItem(LS_KEY, JSON.stringify(all));
}

export function downloadText(name: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type });
  downloadBlob(name, blob);
}
export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function downloadDataUrl(name: string, dataUrl: string) {
  const a = document.createElement('a');
  a.href = dataUrl; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
export function fileSafe(s: string) { return (s || 'diorama').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'diorama'; }

export function exportProject(doc: DioramaDoc) {
  downloadText(`${fileSafe(doc.title)}.diorama.json`, JSON.stringify(doc));
}
export async function importProjectFile(file: File): Promise<DioramaDoc> {
  const text = await file.text();
  const doc = JSON.parse(text) as DioramaDoc;
  if (doc?.format !== 'digital-diorama' || !doc.base || !Array.isArray(doc.actors)) throw new Error('This file is not a Digital Diorama project.');
  doc.id = doc.id || 'd_' + Math.random().toString(36).slice(2, 10);
  doc.updated = Date.now();
  return doc;
}

/** shrink a data URL screenshot to a small thumbnail */
export function makeThumb(dataUrl: string, w = 360, h = 220): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d')!;
      const s = Math.max(w / img.width, h / img.height);
      const dw = img.width * s, dh = img.height * s;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      resolve(c.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}

/* ---------- small settings store ---------- */
export interface Settings { quality: 'low' | 'medium' | 'high'; author: string; sound: boolean; ambience: boolean; tips: boolean }
const SETTINGS_KEY = 'dd-settings';
export function loadSettings(): Settings {
  const small = typeof window !== 'undefined' && (Math.min(window.innerWidth, window.innerHeight) < 700 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
  const dflt: Settings = { quality: small ? 'low' : 'medium', author: '', sound: true, ambience: false, tips: true };
  try { return { ...dflt, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return dflt; }
}
export function saveSettings(s: Settings) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ } }
