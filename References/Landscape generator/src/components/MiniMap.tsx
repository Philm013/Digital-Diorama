import { useEffect, useRef } from 'react';
import { TerrainField } from '../terrain/TerrainField';

/**
 * Top-down relief map with hillshading — redrawn whenever `tick` changes.
 */
export function MiniMap({ field, tick, size = 132 }: { field: TerrainField | null; tick: number; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !field) return;
    const n = field.n;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(size, size);
    // light from the upper-left, matching the scene sun
    const lx = -0.55;
    const ly = 0.74;
    const lz = -0.38;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = Math.min(n - 1, Math.floor((x / size) * n));
        const j = Math.min(n - 1, Math.floor((y / size) * n));
        const k = j * n + i;
        const nx = field.normals[k * 3];
        const ny = field.normals[k * 3 + 1];
        const nz = field.normals[k * 3 + 2];
        const lambert = Math.max(0, nx * lx + ny * ly + nz * lz);
        const shade = 0.42 + 0.78 * lambert;
        const o = (y * size + x) * 4;
        img.data[o] = Math.min(255, field.colors[k * 3] * 255 * shade);
        img.data[o + 1] = Math.min(255, field.colors[k * 3 + 1] * 255 * shade);
        img.data[o + 2] = Math.min(255, field.colors[k * 3 + 2] * 255 * shade);
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [field, tick, size]);

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-slate-950/70 p-1 shadow-lg backdrop-blur">
      <canvas
        ref={ref}
        width={size}
        height={size}
        className="block rounded-md"
        style={{ width: size, height: size, imageRendering: 'pixelated' }}
      />
      <div className="px-1 pt-1 text-center text-[9px] uppercase tracking-[0.18em] text-slate-500">Relief Map</div>
    </div>
  );
}
