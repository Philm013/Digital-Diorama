import { Noise2D, rng } from './util';

export type LayerKind = 'mountains' | 'hills' | 'trees' | 'dunes' | 'mesas' | 'ice' | 'sea' | 'ground' | 'rays' | 'kelp' | 'reef' | 'volcano';
export type TreeKind = 'conifer' | 'broadleaf' | 'acacia' | 'palm' | 'jungle' | 'cactus' | 'reeds' | 'shrub' | 'birch';
export interface BackdropLayer {
  kind: LayerKind;
  /** height above the horizon line as a fraction of canvas height (positive = higher) */
  at: number;
  amp?: number;
  color: string;
  haze?: number;
  tree?: TreeKind;
  density?: number;
  size?: number;
  snow?: number;
  seed?: number;
  freq?: number;
}
export interface BackdropStyle {
  id: string;
  name: string;
  haze: string;
  layers: BackdropLayer[];
  clouds: number;
  underwater?: boolean;
}

const L = (kind: LayerKind, at: number, color: string, o: Partial<BackdropLayer> = {}): BackdropLayer => ({ kind, at, color, ...o });

export const BACKDROPS: Record<string, BackdropStyle> = {
  meadow: { id: 'meadow', name: 'Rolling hills', haze: '#b9d3e6', clouds: 0.7, layers: [
    L('mountains', 0.2, '#7d8fa8', { amp: 0.12, haze: 0.6, snow: 0.25 }),
    L('hills', 0.1, '#7f9d6a', { amp: 0.05, haze: 0.45 }),
    L('trees', 0.06, '#4f6e3f', { tree: 'broadleaf', density: 0.5, size: 0.05, haze: 0.3 }),
    L('hills', 0.02, '#6f9a4f', { amp: 0.03, haze: 0.15 }),
    L('ground', -0.02, '#679247'),
  ] },
  forest: { id: 'forest', name: 'Deciduous forest', haze: '#b7cfdf', clouds: 0.6, layers: [
    L('mountains', 0.22, '#8394ab', { amp: 0.1, haze: 0.62 }),
    L('hills', 0.13, '#6d8a62', { amp: 0.05, haze: 0.45 }),
    L('trees', 0.1, '#56714a', { tree: 'broadleaf', density: 1, size: 0.06, haze: 0.35 }),
    L('trees', 0.05, '#3e5a33', { tree: 'broadleaf', density: 1.2, size: 0.085, haze: 0.15 }),
    L('trees', 0.02, '#46642f', { tree: 'birch', density: 0.35, size: 0.12, haze: 0.05 }),
    L('ground', -0.02, '#4c6233'),
  ] },
  taiga: { id: 'taiga', name: 'Boreal taiga', haze: '#c4d4e0', clouds: 0.55, layers: [
    L('mountains', 0.26, '#8d9cb0', { amp: 0.16, haze: 0.55, snow: 0.55 }),
    L('mountains', 0.14, '#6f8296', { amp: 0.08, haze: 0.4, snow: 0.2, seed: 5 }),
    L('trees', 0.09, '#3d5a4f', { tree: 'conifer', density: 1.6, size: 0.07, haze: 0.35 }),
    L('trees', 0.04, '#24402f', { tree: 'conifer', density: 1.4, size: 0.1, haze: 0.12 }),
    L('ground', -0.02, '#3f5a3a'),
  ] },
  mountains: { id: 'mountains', name: 'Alpine peaks', haze: '#c9daea', clouds: 0.45, layers: [
    L('mountains', 0.36, '#97a6bb', { amp: 0.24, haze: 0.5, snow: 0.6, freq: 1.4 }),
    L('mountains', 0.22, '#7d8ea3', { amp: 0.16, haze: 0.35, snow: 0.45, seed: 9 }),
    L('trees', 0.08, '#35553f', { tree: 'conifer', density: 1.2, size: 0.07, haze: 0.25 }),
    L('hills', 0.03, '#5d7f48', { amp: 0.03, haze: 0.1 }),
    L('ground', -0.02, '#5a7a45'),
  ] },
  savanna: { id: 'savanna', name: 'Savanna plains', haze: '#e7dcc0', clouds: 0.45, layers: [
    L('mountains', 0.14, '#a99bab', { amp: 0.06, haze: 0.62, freq: 0.6 }),
    L('volcano', 0.16, '#9b8f9e', { amp: 0.12, haze: 0.55 }),
    L('hills', 0.05, '#c2ae6e', { amp: 0.015, haze: 0.35 }),
    L('trees', 0.04, '#5a5530', { tree: 'acacia', density: 0.22, size: 0.07, haze: 0.25 }),
    L('ground', -0.02, '#bba35f'),
  ] },
  rainforest: { id: 'rainforest', name: 'Rainforest canopy', haze: '#bfd6cc', clouds: 0.8, layers: [
    L('mountains', 0.3, '#7e9a94', { amp: 0.18, haze: 0.6, freq: 2.2 }),
    L('trees', 0.16, '#4c7457', { tree: 'jungle', density: 1, size: 0.07, haze: 0.45 }),
    L('trees', 0.08, '#2f5a36', { tree: 'jungle', density: 1, size: 0.1, haze: 0.2 }),
    L('trees', 0.05, '#2b4f2c', { tree: 'palm', density: 0.25, size: 0.16, haze: 0.08 }),
    L('ground', -0.02, '#2f4f2a'),
  ] },
  desert: { id: 'desert', name: 'Desert mesas', haze: '#f0dcc0', clouds: 0.2, layers: [
    L('mesas', 0.17, '#c98b62', { amp: 0.12, haze: 0.45 }),
    L('mountains', 0.1, '#d0a07a', { amp: 0.05, haze: 0.4, freq: 0.7 }),
    L('dunes', 0.05, '#ddb27c', { amp: 0.03, haze: 0.25 }),
    L('trees', 0.03, '#6f7a4a', { tree: 'cactus', density: 0.18, size: 0.08, haze: 0.15 }),
    L('ground', -0.02, '#d6a670'),
  ] },
  arctic: { id: 'arctic', name: 'Polar ice', haze: '#d9e6ee', clouds: 0.5, layers: [
    L('mountains', 0.2, '#b9c8d6', { amp: 0.12, haze: 0.45, snow: 1 }),
    L('ice', 0.08, '#dce9f1', { amp: 0.06, haze: 0.25 }),
    L('sea', 0.03, '#5e8aa3', { haze: 0.25 }),
    L('ice', 0.02, '#eef5f9', { amp: 0.025, haze: 0.05, seed: 4 }),
    L('ground', -0.02, '#e6eef3'),
  ] },
  wetland: { id: 'wetland', name: 'Marshland', haze: '#c8d8d6', clouds: 0.75, layers: [
    L('hills', 0.12, '#87a08f', { amp: 0.04, haze: 0.55 }),
    L('trees', 0.08, '#4f6d50', { tree: 'broadleaf', density: 0.7, size: 0.05, haze: 0.35 }),
    L('sea', 0.03, '#7aa4a5', { haze: 0.3 }),
    L('trees', 0.035, '#6b7f45', { tree: 'reeds', density: 2.5, size: 0.05, haze: 0.08 }),
    L('ground', -0.02, '#5d7240'),
  ] },
  coast: { id: 'coast', name: 'Sea coast', haze: '#cfe2ee', clouds: 0.55, layers: [
    L('mountains', 0.1, '#8fa2b8', { amp: 0.05, haze: 0.55, freq: 0.5 }),
    L('sea', 0.04, '#3f7fa6', { haze: 0.15 }),
    L('ground', -0.02, '#d8c08b'),
  ] },
  garden: { id: 'garden', name: 'Neighbourhood', haze: '#c6dbea', clouds: 0.6, layers: [
    L('hills', 0.12, '#8ba67e', { amp: 0.04, haze: 0.5 }),
    L('trees', 0.08, '#5a7b4b', { tree: 'broadleaf', density: 0.8, size: 0.06, haze: 0.35 }),
    L('trees', 0.035, '#4a6b3a', { tree: 'shrub', density: 1.2, size: 0.04, haze: 0.1 }),
    L('ground', -0.02, '#679247'),
  ] },
  underwater: { id: 'underwater', name: 'Open ocean', haze: '#2f7ea0', clouds: 0, underwater: true, layers: [
    L('rays', 0, '#e6fbff'),
    L('reef', 0.1, '#2f6f86', { amp: 0.06, haze: 0.55 }),
    L('kelp', 0.18, '#2d6a5a', { density: 0.6, size: 0.3, haze: 0.5 }),
    L('reef', 0.03, '#3d6e74', { amp: 0.04, haze: 0.3, seed: 3 }),
    L('ground', -0.02, '#c9b98d'),
  ] },
  kelp: { id: 'kelp', name: 'Kelp forest', haze: '#2b6c7a', clouds: 0, underwater: true, layers: [
    L('rays', 0, '#e0f6ef'),
    L('kelp', 0.45, '#305f4c', { density: 1.2, size: 0.55, haze: 0.55 }),
    L('reef', 0.06, '#335a5d', { amp: 0.05, haze: 0.4 }),
    L('kelp', 0.5, '#3b6a3f', { density: 0.7, size: 0.65, haze: 0.25, seed: 4 }),
    L('ground', -0.02, '#8a8a72'),
  ] },
};

function mixHex(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = ((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t;
  const g = ((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t;
  const bl = (pa & 255) * (1 - t) + (pb & 255) * t;
  return `rgb(${r | 0},${g | 0},${bl | 0})`;
}
function shade(hex: string, k: number) {
  const p = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((p >> 16) & 255)},${f((p >> 8) & 255)},${f(p & 255)})`;
}
function hexOf(c: string) { // rgb(...) or #hex -> #hex
  if (c.startsWith('#')) return c;
  const m = c.match(/\d+/g)!.map(Number);
  return '#' + m.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Paints the landscape (alpha = land) for a backdrop strip. The sky itself is
 * drawn live by the backdrop shader so it can follow the time of day.
 */
export function paintLand(canvas: HTMLCanvasElement, style: BackdropStyle, horizon: number, seed = 1) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const N = new Noise2D(seed);
  const hy = horizon * H;
  const ridge = (x: number, base: number, amp: number, freq: number, s: number, rough = 1) => {
    const u = x / W;
    return base - amp * H * (0.55 + 0.45 * N.fbm(u * 6 * freq + s * 13.7, s * 3.1, 4) + 0.35 * rough * N.ridged(u * 3 * freq + s, s * 1.7, 3) - 0.3);
  };
  for (const layer of style.layers) {
    const col = layer.haze ? mixHex(layer.color, style.haze, layer.haze) : layer.color;
    const chex = hexOf(col);
    const base = hy - layer.at * H;
    const s = (layer.seed ?? 0) + seed * 0.37 + layer.at * 10;
    const R = rng(Math.floor((layer.seed ?? 1) * 997 + seed * 31 + layer.at * 1000));
    ctx.save();
    switch (layer.kind) {
      case 'ground': {
        const g = ctx.createLinearGradient(0, base, 0, H);
        g.addColorStop(0, shade(chex, 1.08));
        g.addColorStop(0.5, shade(chex, 0.92));
        g.addColorStop(1, shade(chex, 0.7));
        ctx.fillStyle = g;
        ctx.fillRect(0, base, W, H - base);
        // painted dabs so the lower walls read as brushwork rather than a flat colour
        for (let i = 0; i < 2600; i++) {
          const y = base + Math.pow(R(), 0.8) * (H - base);
          ctx.fillStyle = shade(chex, 0.78 + R() * 0.38);
          ctx.globalAlpha = 0.18 + R() * 0.2;
          ctx.beginPath();
          ctx.ellipse(R() * W, y, 6 + R() * 18, 2 + R() * 4, (R() - 0.5) * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'mountains':
      case 'hills':
      case 'volcano': {
        const amp = layer.amp ?? 0.08, freq = layer.freq ?? 1;
        const pts: [number, number][] = [];
        for (let x = 0; x <= W; x += 4) {
          let y: number;
          if (layer.kind === 'hills') y = base - amp * H * (0.5 + 0.5 * Math.sin(x / W * Math.PI * 5 * freq + s) * 0.6 + 0.4 * N.fbm(x / W * 4 + s, s, 3));
          else if (layer.kind === 'volcano') {
            const cx = W * (0.3 + 0.4 * ((s * 7.3) % 1));
            const d = Math.abs(x - cx) / (W * 0.12);
            y = base - amp * H * Math.max(0, 1 - Math.pow(d, 1.25)) * (d < 0.12 ? 0.92 : 1) - 0.01 * H * N.noise(x / W * 30, s);
          } else y = ridge(x, base, amp, freq, s);
          pts.push([x, y]);
        }
        const g = ctx.createLinearGradient(0, base - amp * H * 1.6, 0, base + 0.05 * H);
        g.addColorStop(0, shade(chex, 1.08));
        g.addColorStop(1, shade(chex, 0.9));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (const [x, y] of pts) ctx.lineTo(x, y);
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
        if (layer.snow) {
          ctx.save();
          ctx.clip();
          const snowLine = base - amp * H * (1.25 - layer.snow * 0.75);
          ctx.fillStyle = mixHex('#ffffff', style.haze, (layer.haze ?? 0) * 0.5);
          ctx.beginPath();
          ctx.moveTo(0, snowLine);
          for (let x = 0; x <= W; x += 6) ctx.lineTo(x, snowLine + (N.noise(x / W * 40, s) * 0.5 + 0.5) * 0.035 * H + Math.max(0, Math.sin(x / 23)) * 0.006 * H);
          ctx.lineTo(W, 0); ctx.lineTo(0, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        break;
      }
      case 'dunes': {
        const amp = layer.amp ?? 0.03;
        for (let pass = 0; pass < 2; pass++) {
          ctx.fillStyle = pass ? shade(chex, 1.12) : shade(chex, 0.92);
          ctx.beginPath();
          ctx.moveTo(0, H);
          for (let x = 0; x <= W; x += 4) {
            const ph = x / W * Math.PI * 9 + s;
            const y = base - amp * H * (0.6 + 0.4 * Math.sin(ph) + 0.2 * N.noise(x / W * 6, s)) + (pass ? 0.012 * H * Math.max(0, Math.cos(ph)) : 0);
            ctx.lineTo(x, y);
          }
          ctx.lineTo(W, H);
          ctx.fill();
        }
        break;
      }
      case 'mesas': {
        const amp = layer.amp ?? 0.1;
        ctx.fillStyle = chex;
        let x = 0;
        while (x < W) {
          const w = (0.04 + R() * 0.12) * W, gap = (0.03 + R() * 0.12) * W;
          const top = base - amp * H * (0.5 + R() * 0.6);
          const slope = 0.012 * W;
          ctx.beginPath();
          ctx.moveTo(x, base + 0.02 * H);
          ctx.lineTo(x + slope, top + 0.01 * H);
          ctx.lineTo(x + slope * 1.6, top);
          ctx.lineTo(x + w - slope * 1.6, top);
          ctx.lineTo(x + w - slope, top + 0.01 * H);
          ctx.lineTo(x + w, base + 0.02 * H);
          ctx.fill();
          // strata stripes
          ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#ffffff';
          for (let k = 1; k < 4; k++) ctx.fillRect(x + slope * 1.2, top + (base - top) * k / 4.2, w - slope * 2.4, 0.004 * H);
          ctx.restore();
          x += w + gap;
        }
        ctx.fillStyle = chex;
        ctx.fillRect(0, base, W, H - base);
        break;
      }
      case 'ice': {
        const amp = layer.amp ?? 0.05;
        let x = -20;
        while (x < W) {
          const w = (0.06 + R() * 0.2) * W;
          const top = base - amp * H * (0.4 + R() * 0.8);
          ctx.fillStyle = chex;
          ctx.fillRect(x, top, w, base - top + 0.02 * H);
          ctx.fillStyle = mixHex(chex, '#7fb2d4', 0.45);
          ctx.fillRect(x + w * 0.65, top + 0.004 * H, w * 0.35, base - top);
          x += w + R() * 0.03 * W;
        }
        break;
      }
      case 'sea': {
        const g = ctx.createLinearGradient(0, base, 0, base + 0.06 * H);
        g.addColorStop(0, shade(chex, 1.15));
        g.addColorStop(1, chex);
        ctx.fillStyle = g;
        ctx.fillRect(0, base, W, H - base);
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 160; i++) ctx.fillRect(R() * W, base + R() * 0.05 * H, 6 + R() * 30, 1.5);
        break;
      }
      case 'trees': {
        const n = Math.floor((layer.density ?? 1) * W / (H * (layer.size ?? 0.06)) * 0.9);
        const sz = (layer.size ?? 0.06) * H;
        ctx.fillStyle = chex;
        // a filled band under the trees so the forest reads as a mass
        if (layer.tree === 'conifer' || layer.tree === 'jungle' || layer.tree === 'broadleaf') ctx.fillRect(0, base - sz * 0.25, W, H - base + sz * 0.25);
        for (let i = 0; i < n; i++) {
          const x = (i + R() * 0.9) * (W / n);
          const k = 0.7 + R() * 0.6;
          const y = base + R() * sz * 0.2;
          ctx.fillStyle = shade(chex, 0.88 + R() * 0.24);
          drawTree(ctx, layer.tree ?? 'broadleaf', x, y, sz * k, R);
        }
        break;
      }
      case 'kelp': {
        const n = Math.floor((layer.density ?? 1) * 40);
        const sz = (layer.size ?? 0.4) * H;
        ctx.strokeStyle = chex;
        ctx.fillStyle = chex;
        ctx.lineCap = 'round';
        for (let i = 0; i < n; i++) {
          const x = R() * W;
          const hgt = sz * (0.6 + R() * 0.6);
          ctx.lineWidth = 3 + R() * 4;
          ctx.beginPath();
          ctx.moveTo(x, base + 0.02 * H);
          for (let k = 1; k <= 12; k++) {
            const t = k / 12;
            ctx.lineTo(x + Math.sin(t * 6 + i) * 10 * t, base - hgt * t);
          }
          ctx.stroke();
          for (let k = 2; k < 12; k += 2) {
            const t = k / 12, bx = x + Math.sin(t * 6 + i) * 10 * t, by = base - hgt * t;
            ctx.beginPath(); ctx.ellipse(bx + 6, by, 9, 3, -0.6, 0, Math.PI * 2); ctx.fill();
          }
        }
        break;
      }
      case 'reef': {
        const amp = layer.amp ?? 0.05;
        ctx.fillStyle = chex;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 3) ctx.lineTo(x, base - amp * H * (0.4 + 0.6 * Math.abs(N.fbm(x / W * 14 + s, s, 4))) - (N.noise(x / 9, s) > 0.6 ? 0.01 * H : 0));
        ctx.lineTo(W, H);
        ctx.fill();
        break;
      }
      case 'rays': {
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 14; i++) {
          const x = R() * W, w = 30 + R() * 90, sl = (R() - 0.5) * 0.4;
          const g = ctx.createLinearGradient(0, 0, 0, hy);
          g.addColorStop(0, 'rgba(230,251,255,0.32)');
          g.addColorStop(1, 'rgba(230,251,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w * 2.2 + sl * hy, hy); ctx.lineTo(x + sl * hy, hy);
          ctx.fill();
        }
        break;
      }
    }
    ctx.restore();
  }
  // painterly grain
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const R2 = rng(seed + 99);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const k = 1 + (R2() - 0.5) * 0.07;
    d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k);
  }
  ctx.putImageData(img, 0, 0);
}

function drawTree(ctx: CanvasRenderingContext2D, kind: TreeKind, x: number, y: number, s: number, R: () => number) {
  ctx.beginPath();
  switch (kind) {
    case 'conifer': {
      const w = s * 0.32;
      for (let k = 0; k < 4; k++) {
        const ty = y - s * (0.25 + k * 0.22), bw = w * (1 - k * 0.2);
        ctx.moveTo(x - bw, ty + s * 0.3); ctx.lineTo(x, ty - s * 0.08); ctx.lineTo(x + bw, ty + s * 0.3);
      }
      ctx.rect(x - s * 0.03, y - s * 0.25, s * 0.06, s * 0.25);
      ctx.fill();
      break;
    }
    case 'broadleaf': case 'shrub': {
      const r = s * (kind === 'shrub' ? 0.32 : 0.28);
      const cy = kind === 'shrub' ? y - r * 0.6 : y - s * 0.62;
      if (kind !== 'shrub') ctx.fillRect(x - s * 0.035, cy, s * 0.07, y - cy);
      for (let k = 0; k < 6; k++) { ctx.moveTo(x, cy); ctx.arc(x + (R() - 0.5) * r * 1.4, cy + (R() - 0.6) * r, r * (0.55 + R() * 0.35), 0, Math.PI * 2); }
      ctx.fill();
      break;
    }
    case 'birch': {
      ctx.save(); ctx.fillStyle = '#e9e4d6'; ctx.fillRect(x - s * 0.025, y - s * 0.75, s * 0.05, s * 0.75); ctx.restore();
      for (let k = 0; k < 5; k++) { ctx.moveTo(x, y - s * 0.7); ctx.arc(x + (R() - 0.5) * s * 0.3, y - s * (0.7 + R() * 0.25), s * 0.13, 0, Math.PI * 2); }
      ctx.fill();
      break;
    }
    case 'acacia': {
      ctx.fillRect(x - s * 0.025, y - s * 0.6, s * 0.05, s * 0.6);
      ctx.moveTo(x, y - s * 0.4); ctx.lineTo(x - s * 0.25, y - s * 0.62); ctx.lineTo(x + s * 0.25, y - s * 0.62);
      ctx.ellipse(x, y - s * 0.66, s * 0.48, s * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'palm': {
      ctx.save();
      ctx.lineWidth = s * 0.04;
      ctx.strokeStyle = ctx.fillStyle as string;
      const tx = x + s * 0.15, ty = y - s * 0.95;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 0.02, y - s * 0.5, tx, ty); ctx.stroke();
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(tx + Math.cos(a) * s * 0.25, ty - s * 0.12, tx + Math.cos(a) * s * 0.4, ty + s * 0.1 + Math.abs(Math.sin(a)) * s * 0.05);
        ctx.lineWidth = s * 0.03; ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'jungle': {
      for (let k = 0; k < 5; k++) { ctx.moveTo(x, y); ctx.arc(x + (R() - 0.5) * s * 0.5, y - s * (0.35 + R() * 0.35), s * (0.22 + R() * 0.12), 0, Math.PI * 2); }
      ctx.fill();
      break;
    }
    case 'cactus': {
      const w = s * 0.07;
      ctx.roundRect(x - w, y - s * 0.75, w * 2, s * 0.75, w);
      ctx.roundRect(x - s * 0.22, y - s * 0.55, w * 1.6, s * 0.3, w);
      ctx.roundRect(x - s * 0.22, y - s * 0.32, s * 0.22, w * 1.4, w * 0.5);
      ctx.roundRect(x + s * 0.12, y - s * 0.62, w * 1.6, s * 0.28, w);
      ctx.roundRect(x, y - s * 0.4, s * 0.2, w * 1.4, w * 0.5);
      ctx.fill();
      break;
    }
    case 'reeds': {
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle as string;
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) {
        const bx = x + (R() - 0.5) * s * 0.3;
        ctx.beginPath(); ctx.moveTo(bx, y); ctx.quadraticCurveTo(bx + (R() - 0.5) * s * 0.2, y - s * 0.5, bx + (R() - 0.5) * s * 0.3, y - s * (0.6 + R() * 0.5)); ctx.stroke();
        if (R() > 0.6) { ctx.fillRect(bx - 2, y - s * 0.7, 4, s * 0.12); }
      }
      ctx.restore();
      break;
    }
  }
}

/** Cotton-ball clouds — a nod to the ones glued onto real shoebox dioramas. */
export function paintClouds(canvas: HTMLCanvasElement, amount: number, horizon: number, seed = 3) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (amount <= 0) return;
  const R = rng(seed);
  const n = Math.round(4 + amount * 14);
  for (let i = 0; i < n; i++) {
    const cx = R() * W, cy = (0.08 + R() * (horizon - 0.25)) * H;
    const w = (0.04 + R() * 0.08) * W * (0.6 + amount * 0.6), h = w * (0.22 + R() * 0.12);
    const puffs = 6 + Math.floor(R() * 8);
    for (let k = 0; k < puffs; k++) {
      const px = cx + (R() - 0.5) * w, py = cy + (R() - 0.3) * h * 0.6;
      const r = h * (0.35 + R() * 0.45);
      const g = ctx.createRadialGradient(px - r * 0.25, py - r * 0.35, r * 0.1, px, py, r);
      g.addColorStop(0, 'rgba(255,255,255,0.98)');
      g.addColorStop(0.6, 'rgba(246,248,252,0.9)');
      g.addColorStop(1, 'rgba(215,224,236,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }
  }
}
