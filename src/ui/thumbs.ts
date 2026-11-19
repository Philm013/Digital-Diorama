import { useEffect, useState } from 'react';
import { BACKDROPS, paintClouds, paintLand } from '../engine/backdropPainter';

const cache = new Map<string, string>();

/* Painting a postcard takes ~30 ms, so lists paint them one at a time while the page is idle, in
   the order they were asked for (top of a grid first) instead of all at once. Urgent requests
   (a picture the user just opened) jump the queue. */
const queue: { key: string; run: () => void }[] = [];
const waiters = new Map<string, ((url: string) => void)[]>();
let pumping = false;
type Idle = (cb: () => void, o?: { timeout: number }) => number;
function pump() {
  const job = queue.shift();
  if (!job) { pumping = false; return; }
  job.run();
  const ric = (window as unknown as { requestIdleCallback?: Idle }).requestIdleCallback;
  if (ric) ric(pump, { timeout: 80 }); else setTimeout(pump, 16);
}
/** paint a postcard soon, without blocking the page */
export function biomeThumbLater(backdropId: string, w = 480, h = 270, urgent = false): Promise<string> {
  const key = backdropId + w + 'x' + h;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const list = waiters.get(key);
    if (list) {
      list.push(resolve);
      if (urgent) { const i = queue.findIndex((j) => j.key === key); if (i > 0) queue.unshift(...queue.splice(i, 1)); }
      return;
    }
    waiters.set(key, [resolve]);
    const job = { key, run: () => { const url = biomeThumb(backdropId, w, h); for (const fn of waiters.get(key) ?? []) fn(url); waiters.delete(key); } };
    if (urgent) queue.unshift(job); else queue.push(job);
    if (!pumping) { pumping = true; setTimeout(pump, 0); }
  });
}
/** a postcard URL once it has been painted (undefined until then) */
export function useBiomeThumb(backdropId: string, w = 480, h = 270, urgent = false): string | undefined {
  const key = backdropId + w + 'x' + h;
  const [url, setUrl] = useState<{ key: string; url: string } | undefined>(() => (cache.has(key) ? { key, url: cache.get(key)! } : undefined));
  useEffect(() => {
    if (url?.key === key) return;
    let live = true;
    void biomeThumbLater(backdropId, w, h, urgent).then((u) => { if (live) setUrl({ key, url: u }); });
    return () => { live = false; };
  }, [backdropId, w, h, key, url, urgent]);
  return url?.key === key ? url.url : undefined;
}
/** A little painted postcard of a biome's backdrop for the picker. */
export function biomeThumb(backdropId: string, w = 480, h = 270): string {
  const key = backdropId + w + 'x' + h;
  const hit = cache.get(key);
  if (hit) return hit;
  const style = BACKDROPS[backdropId] ?? BACKDROPS.meadow;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.75);
  if (style.underwater) { sky.addColorStop(0, '#0b3d5c'); sky.addColorStop(1, '#2f95b5'); }
  else { sky.addColorStop(0, '#4a8fdb'); sky.addColorStop(1, '#d4e8f4'); }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const land = document.createElement('canvas');
  land.width = w * 2; land.height = h * 2;
  paintLand(land, style, 0.7, 3);
  const clouds = document.createElement('canvas');
  clouds.width = w; clouds.height = h;
  paintClouds(clouds, style.clouds, 0.6, 5);
  if (!style.underwater) {
    ctx.fillStyle = 'rgba(255,244,214,0.95)';
    ctx.beginPath(); ctx.arc(w * 0.78, h * 0.2, h * 0.07, 0, Math.PI * 2); ctx.fill();
  }
  ctx.drawImage(clouds, 0, 0, w, h);
  ctx.drawImage(land, 0, 0, w, h);
  const url = c.toDataURL('image/jpeg', 0.85);
  cache.set(key, url);
  return url;
}
