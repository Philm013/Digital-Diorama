import { BACKDROPS, paintClouds, paintLand } from '../engine/backdropPainter';

const cache = new Map<string, string>();
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
