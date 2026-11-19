import { useEffect, useRef, useState } from 'react';
import { Welcome } from './Welcome';
import { Studio } from './Studio';
import { loadSettings, loadProject, type Settings } from '../storage/projects';
import type { DioramaDoc } from '../engine/types';
import { newDocById } from '../biomes/factory';
import { BIOME_BY_ID } from '../biomes/templates';
import { layerOf, useBackLayer } from './backStack';

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [doc, setDoc] = useState<DioramaDoc | null>(null);
  const [studioKey, setStudioKey] = useState(0);
  // A diorama opened from the home screen gets its own history entry (#open=<id>): the phone's
  // Back button returns home, and reloading the page reopens it. Deep links keep their address.
  const [fromHome, setFromHome] = useState(false);
  const adopt = useRef(false);

  // deep links: #new=savanna or #open=<project id>
  useEffect(() => {
    const h = new URLSearchParams(location.hash.slice(1));
    const n = h.get('new');
    if (n && BIOME_BY_ID[n]) setDoc(newDocById(n, (h.get('q') as Settings['quality']) || settings.quality, { author: settings.author }));
    const o = h.get('open');
    if (o) void loadProject(o).then((d) => {
      if (!d) return;
      // reloaded while a diorama opened from the home screen was showing: Back still goes home
      if (layerOf(history.state)) { adopt.current = true; setFromHome(true); }
      setDoc(d);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useBackLayer(!!doc && fromHome, () => document.dispatchEvent(new CustomEvent('dd-exit')), {
    url: doc ? `#open=${encodeURIComponent(doc.id)}` : undefined,
    adopt: () => { const a = adopt.current; adopt.current = false; return a; },
  });

  if (doc) {
    return <Studio key={studioKey} doc={doc} settings={settings} setSettings={setSettings} onExit={() => {
      setDoc(null);
      // from the home screen, closing the layer steps history back to it; a deep link just drops its hash
      if (fromHome) setFromHome(false);
      else history.replaceState(null, '', location.pathname + location.search);
    }} />;
  }
  return <Welcome settings={settings} setSettings={setSettings} onOpen={(d) => { setStudioKey((k) => k + 1); setFromHome(true); setDoc(d); }} />;
}
