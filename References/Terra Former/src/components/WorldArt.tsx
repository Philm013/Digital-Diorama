import { useId } from 'react';
import { BIOME_SWATCHES } from '../studio';

type Props = { mix: string[]; large?: boolean; water?: boolean; snow?: boolean };

const ridge = (seed: number, baseY: number, amp: number, freq: number, width = 190, steps = 26) => {
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = baseY - Math.sin(t * Math.PI * freq + seed) * amp * 0.55
      - Math.sin(t * Math.PI * freq * 2.3 + seed * 1.7) * amp * 0.28
      - Math.cos(t * Math.PI * freq * 0.6 + seed * 0.4) * amp * 0.2;
    points.push(`${(t * width).toFixed(1)},${y.toFixed(1)}`);
  }
  return `M0,104 L0,${(points[0].split(',')[1]).toString()} L${points.join(' L')} L${width},104 Z`;
};

/** Landscape thumbnail drawn from a world's own biome colours, cross-faded left to right. */
export function WorldArt({ mix, large = false, water = true, snow = false }: Props) {
  const id = useId().replace(/[:]/g, '');
  const picks = mix.length ? mix : ['foothills'];
  const low = (index: number) => BIOME_SWATCHES[picks[index % picks.length]]?.[0] || '#8b9a6c';
  const high = (index: number) => BIOME_SWATCHES[picks[index % picks.length]]?.[1] || '#a9b6a2';
  const layers = [
    { seed: 1.7, base: 66, amp: 16, freq: 1.6 },
    { seed: 4.2, base: 76, amp: 26, freq: 2.4 },
    { seed: 8.9, base: 86, amp: 20, freq: 3.1 },
    { seed: 2.4, base: 95, amp: 12, freq: 4.2 }
  ];
  const arid = picks.some((biome) => ['desert', 'saltflat', 'badlands', 'canyon'].includes(biome));
  const palms = picks.includes('islands') || picks.includes('savanna');
  const conifer = picks.includes('taiga') || picks.includes('alpine') || picks.includes('temperate');
  return (
    <svg viewBox="0 0 190 104" preserveAspectRatio={large ? 'xMidYMid meet' : 'none'} className={`world-art ${large ? 'large' : ''}`} aria-hidden="true">
      <defs>
        <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={large ? '#cfe0ea' : '#d5e2e6'} />
          <stop offset="1" stopColor="#f2f1e6" />
        </linearGradient>
        {layers.map((_, index) => (
          <linearGradient key={index} id={`ridge-${id}-${index}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={index % 2 ? high(index) : low(index)} />
            <stop offset="0.38" stopColor={low(index + 1)} />
            <stop offset="0.62" stopColor={high(index + 2)} />
            <stop offset="1" stopColor={index % 2 ? low(index + 3) : high(index + 3)} />
          </linearGradient>
        ))}
      </defs>
      <rect width="190" height="104" fill={`url(#sky-${id})`} />
      {snow && <path d="M0 44h190v10H0z" fill="#f4f7f4" opacity=".25" />}
      {layers.map((layer, index) => (
        <g key={index}>
          <path d={ridge(layer.seed, layer.base, layer.amp, layer.freq)} fill={`url(#ridge-${id}-${index})`} />
          {snow && index === 1 && (
            <path d={ridge(layer.seed + 0.05, layer.base - layer.amp * 0.34, layer.amp * 0.3, layer.freq)} fill="#f6f9f5" opacity=".8" />
          )}
        </g>
      ))}
      {arid && <path d="M12 96q22-9 44 0t44-3 44 4 44-2v10H12z" fill="#e6d3ad" opacity=".45" />}
      {water && <path d="M0 97h190v7H0z" fill="#79a8ab" opacity=".55" />}
      {(conifer || palms) && (
        <g opacity=".85">
          {[24, 46, 72, 122, 152].map((x, index) => (
            palms && index % 2 === 0 ? (
              <g key={x} transform={`translate(${x} ${92 - (index % 3) * 3}) scale(.8)`}>
                <path d="M0 0V-9" stroke="#7c6b4c" strokeWidth="1.4" />
                <path d="M-6-9q6-4 12 0M-6-8q6-6 12-1" stroke="#4f7a4a" strokeWidth="1.5" fill="none" />
              </g>
            ) : (
              <g key={x} transform={`translate(${x} ${92 - (index % 3) * 3}) scale(.72)`}>
                <path d="M0 2V-10" stroke="#776e52" strokeWidth="1.3" />
                <path d="M-5 0 0-14 5 0Z" fill="#43663f" />
              </g>
            )
          ))}
        </g>
      )}
    </svg>
  );
}
