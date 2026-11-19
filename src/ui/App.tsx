import { useEffect, useState } from 'react';
import { Welcome } from './Welcome';
import { Studio } from './Studio';
import { loadSettings, loadProject, type Settings } from '../storage/projects';
import type { DioramaDoc } from '../engine/types';
import { newDocById } from '../biomes/factory';
import { BIOME_BY_ID } from '../biomes/templates';

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [doc, setDoc] = useState<DioramaDoc | null>(null);
  const [studioKey, setStudioKey] = useState(0);

  // deep links: #new=savanna or #open=<project id>
  useEffect(() => {
    const h = new URLSearchParams(location.hash.slice(1));
    const n = h.get('new');
    if (n && BIOME_BY_ID[n]) setDoc(newDocById(n, (h.get('q') as Settings['quality']) || settings.quality, { author: settings.author }));
    const o = h.get('open');
    if (o) void loadProject(o).then((d) => d && setDoc(d));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (doc) {
    return <Studio key={studioKey} doc={doc} settings={settings} setSettings={setSettings} onExit={() => { setDoc(null); history.replaceState(null, '', location.pathname + location.search); }} />;
  }
  return <Welcome settings={settings} setSettings={setSettings} onOpen={(d) => { setStudioKey((k) => k + 1); setDoc(d); }} />;
}
