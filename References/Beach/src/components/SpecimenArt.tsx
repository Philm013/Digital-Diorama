import { useId } from 'react';
import type { ArtKind } from '../lib/catalog';

export function ShellLogo({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 34C10 31 4 21 9 12s18-10 25 0c7 10 1 20-8 19-8-1-13-8-9-14 3-6 11-5 13 1 2 5-2 9-6 7-3-1-3-4-1-6"/><path d="m9 12 7 6M20 7l1 7m11-2-5 5m9 7-7-2M11 26l6-4m4 12 2-7"/></g></svg>;
}

interface Props {
  kind: ArtKind;
  className?: string;
  monochrome?: boolean;
}

export default function SpecimenArt({ kind, className = '', monochrome = false }: Props) {
  const id = useId().replace(/:/g, '');
  const peach = monochrome ? '#b6b9a7' : '#dab09a';
  const pale = monochrome ? '#e5e7da' : '#f2e1c8';
  const dark = monochrome ? '#7c8773' : '#af8267';
  const pink = monochrome ? '#c0c6b3' : '#dbb3b0';
  return <svg viewBox="0 0 100 100" className={`specimen-art ${className}`} fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-shell`} x1="22" y1="15" x2="74" y2="85" gradientUnits="userSpaceOnUse"><stop stopColor={pale}/><stop offset="0.48" stopColor={peach}/><stop offset="1" stopColor={dark}/></linearGradient>
      <linearGradient id={`${id}-pearl`} x1="22" y1="20" x2="65" y2="90" gradientUnits="userSpaceOnUse"><stop stopColor="#f5ebd6"/><stop offset="0.5" stopColor={pink}/><stop offset="1" stopColor="#b7b5b4"/></linearGradient>
      <linearGradient id={`${id}-glass`} x1="20" y1="20" x2="75" y2="80" gradientUnits="userSpaceOnUse"><stop stopColor="#c6dcd0"/><stop offset="0.55" stopColor="#86b3a5"/><stop offset="1" stopColor="#608f82"/></linearGradient>
      <radialGradient id={`${id}-urchin`} cx=".35" cy=".28" r=".75"><stop stopColor="#ecedd3"/><stop offset=".6" stopColor="#d0d3af"/><stop offset="1" stopColor="#989c7f"/></radialGradient>
      <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="1" dy="3" stdDeviation="2.2" floodColor="#6a6350" floodOpacity=".18"/></filter>
      <clipPath id={`${id}-oval`}><ellipse cx="50" cy="50" rx="26" ry="36" transform="rotate(26 50 50)"/></clipPath>
    </defs>
    <g filter={`url(#${id}-shadow)`}>
      {kind === 'conch' && <g transform="rotate(-28 50 50)">
        <path d="M48 7 55 24 63 20 65 34 78 34 73 49C90 73 70 91 50 83L36 96l-3-24C13 62 21 39 32 29l2-14 8 8Z" fill={`url(#${id}-shell)`} stroke={dark} strokeWidth=".7"/>
        <path d="M64 39C85 51 84 82 59 85 47 86 42 77 45 62c3-15 8-22 19-23Z" fill={`url(#${id}-pearl)`} stroke={pale} strokeWidth="2.5"/>
        <path d="M62 47c-12 6-19 27-8 32 16 5 25-16 8-32Z" fill="#b68171" opacity=".8"/>
        <path d="M63 48c8 15 3 26-6 30" stroke="#f6d1bc" strokeWidth="3"/>
        {[0, 1, 2, 3, 4, 5].map(i => <path key={i} d={`M${31 - Math.sin(i) * 3} ${35 + i * 6}Q${43 + i} ${25 + i * 6} ${58 + i * 2} ${34 + i * 4}`} stroke={pale} strokeWidth="1.8" opacity=".75"/>) }
        <path d="m40 25 12 4m-16 1 22 4M47 10l-1 14" stroke={dark} strokeWidth="1"/>
      </g>}
      {kind === 'cowrie' && <g>
        <ellipse cx="50" cy="50" rx="26" ry="36" transform="rotate(26 50 50)" fill={`url(#${id}-shell)`}/>
        <g clipPath={`url(#${id}-oval)`}>{Array.from({ length: 38 }, (_, i) => <ellipse key={i} cx={23 + (i * 13.7) % 55} cy={18 + (i * 17.1) % 65} rx={1.6 + i % 2} ry={2 + i % 3} fill={dark} opacity=".8"/>)}</g>
        <path d="M38 24c-11 10-15 27-10 36" stroke="#fff6e2" strokeWidth="4" strokeLinecap="round" opacity=".7"/>
        <path d="M53 29C38 50 41 62 43 72" stroke={pale} strokeWidth="2" opacity=".5"/>
      </g>}
      {kind === 'auger' && <g transform="rotate(36 50 50)">
        <path d="M49 5 67 73Q71 90 50 93 29 89 34 73Z" fill={`url(#${id}-shell)`} stroke={dark} strokeWidth=".7"/>
        {Array.from({ length: 13 }, (_, i) => <path key={i} d={`M${49 - i * 1.2} ${14 + i * 5.7}q${5 + i * .8} ${3 + i * .2} ${3 + i * 2.5} -1`} stroke={i % 2 ? pale : dark} strokeWidth={1 + i * .06}/>) }
        <ellipse cx="52" cy="82" rx="9" ry="5" fill="#8e7663"/><path d="M41 81q10 10 20 0" stroke={pale} strokeWidth="2"/>
      </g>}
      {kind === 'scallop' && <g transform="rotate(-13 50 50)">
        <path d="m39 79-14 5 1-17C9 60 11 46 18 42c-1-12 9-19 17-18 5-12 20-12 26-4 12-3 22 6 20 17 11 6 10 21 1 27-1 13-15 18-22 15l-4 10Z" fill={`url(#${id}-pearl)`} stroke={dark} strokeWidth=".7"/>
        {Array.from({ length: 15 }, (_, i) => { const a = (-158 + i * 9.8) * Math.PI / 180; return <path key={i} d={`M48 77Q${49 + Math.cos(a) * 25} ${76 + Math.sin(a) * 30} ${50 + Math.cos(a) * 37} ${60 + Math.sin(a) * 43}`} stroke={i % 2 ? pale : peach} strokeWidth={i % 2 ? 1.9 : 1.2} strokeLinecap="round"/>; })}
        <path d="M27 70q3 10 11 8m15 3 7 4" stroke={pale} strokeWidth="2"/>
      </g>}
      {kind === 'oyster' && <g transform="rotate(28 50 50)">
        <path d="M50 8 63 16 71 16 75 30 82 39 77 52 82 64 69 78 62 89 47 86 35 90 24 72 21 61 26 49 22 34 34 26 35 17Z" fill="#a0a594" stroke="#7d8574"/>
        <path d="M49 15c24 1 27 35 19 55S40 91 31 64s2-49 18-49Z" fill={`url(#${id}-pearl)`} stroke="#dbd5bf" strokeWidth="4"/>
        <path d="M49 23c17 2 22 28 14 45S40 78 36 61" stroke="#faf0db" strokeWidth="2" opacity=".9"/>
        <circle cx="46" cy="55" r="8" fill="#efebdc"/><circle cx="44" cy="52" r="3" fill="#fff9e8"/>
        <path d="m27 69-6 9m9-4-3 10m4-5-1 10" stroke="#8d806a" strokeWidth="1.5"/>
      </g>}
      {kind === 'razor' && <g transform="rotate(35 50 50)">
        <path d="M38 9q13-5 22 0l4 78q-14 8-26 1Z" fill={`url(#${id}-shell)`} stroke={dark} strokeWidth="1"/>
        <path d="M51 10v77" stroke={pale} strokeWidth="3"/>
        {Array.from({ length: 20 }, (_, i) => <path key={i} d={`M39 ${13 + i * 3.5}h22`} stroke={i % 4 ? pale : dark} strokeWidth=".7" opacity=".8"/>)}
      </g>}
      {kind === 'urchin' && <g>
        <ellipse cx="50" cy="53" rx="36" ry="31" fill={`url(#${id}-urchin)`}/>
        {Array.from({ length: 5 }, (_, i) => <g key={i} transform={`rotate(${i * 72} 50 49)`}>
          <path d="M50 50Q32 36 49 24q17 12 1 26Z" stroke="#a2a98b" strokeWidth=".6"/>
          {Array.from({ length: 9 }, (_, j) => <g key={j}><circle cx={50 - Math.sin(j / 8 * Math.PI) * 6} cy={26 + j * 2.7} r=".9" fill="#8f9a78"/><circle cx={50 + Math.sin(j / 8 * Math.PI) * 6} cy={26 + j * 2.7} r=".9" fill="#8f9a78"/></g>)}
        </g>)}
        {Array.from({ length: 55 }, (_, i) => { const r = 15 + (i % 5) * 4; return <circle key={i} cx={50 + Math.cos(i * 2.4) * r} cy={51 + Math.sin(i * 2.4) * r * .8} r=".6" fill="#eeecd4"/>; })}
      </g>}
      {kind === 'starfish' && <g transform="rotate(17 50 50)">
        <path d="M50 7c5 0 7 25 13 29s28-5 31-1-18 19-19 26 15 24 11 28-25-13-32-13-24 20-29 17 9-26 7-32S5 51 6 45s27-2 32-7S45 7 50 7Z" fill={`url(#${id}-shell)`} stroke={dark} strokeWidth=".6"/>
        {Array.from({ length: 5 }, (_, i) => <g key={i} transform={`rotate(${i * 72} 50 53)`}><path d="M50 49V17" stroke={peach} strokeWidth="2"/>{Array.from({ length: 10 }, (_, j) => <g key={j}><circle cx={50} cy={19 + j * 3.2} r={.7 + j * .04} fill={pale}/><circle cx={46 - j * .16} cy={30 + j * 2.1} r=".6" fill={dark}/><circle cx={54 + j * .16} cy={30 + j * 2.1} r=".6" fill={dark}/></g>)}</g>)}
      </g>}
      {kind === 'cuttlebone' && <g transform="rotate(30 50 50)">
        <path d="M50 6C80 25 83 75 51 94 15 72 24 28 50 6Z" fill="#e9e3d0" stroke="#c5bda8"/>
        <path d="M50 9c-18 21-19 61 1 81 24-27 15-67-1-81Z" fill="#f4efdf"/>
        {Array.from({ length: 21 }, (_, i) => { const w = Math.sin((i + 1) / 23 * Math.PI) * 18; return <path key={i} d={`M${50 - w} ${15 + i * 3.3}q${w} -4 ${w * 2} 0`} stroke="#dcd5bf" strokeWidth=".8"/>; })}
      </g>}
      {kind === 'crab' && <g>
        {[-1, 1].map(s => <g key={s}>{Array.from({ length: 4 }, (_, i) => <path key={i} d={`M${50 + s * 21} ${43 + i * 6}l${s * 14} 4 ${s * 9} ${10 + i * 2}`} stroke="#9b927d" strokeWidth="3" strokeLinecap="round"/>)}<path d={`M${50 + s * 16} 45q${s * 25} -2 ${s * 20} -18`} stroke={peach} strokeWidth="7" strokeLinecap="round"/><path d={`M${50 + s * 35} 28q${-s * 11} -17 ${-s * 11} -7m${s * 13} 6q${s * 4} -14 ${-s * 3} -10`} stroke={dark} strokeWidth="4" strokeLinecap="round"/></g>)}
        <path d="m26 38 4 2 5-8 5 3 10-4 9 4 6-3 5 8 6-2-3 9 6 4-7 9c-10 10-34 11-44-1l-5-7 6-5Z" fill={`url(#${id}-shell)`} stroke={dark} strokeWidth=".8"/>
        <path d="M35 43q15-10 29 0m-26 5q12-8 23 0" stroke={pale} strokeWidth="1"/>
        <circle cx="40" cy="33" r="2" fill="#766e5e"/><circle cx="60" cy="33" r="2" fill="#766e5e"/>
      </g>}
      {kind === 'tooth' && <g transform="rotate(-17 50 50)">
        <path d="m50 13 25 59-8 2-5-4-25 3-13-2Z" fill="#4f5752" stroke="#3e4841"/>
        <path d="m50 16-5 51 21 2Z" fill="#657066"/>
        <path d="M24 65c-8 1-12 17-3 19 13 5 24-7 30-6 9 1 24 15 29 5 7-11-3-20-9-18-14 6-31 6-47 0Z" fill="#9b9380" stroke="#827d6c"/>
        <path d="m26 69 9 7 15-3 15 6 11-7" stroke="#b6aa90" strokeWidth="2"/>
      </g>}
      {kind === 'kelp' && <g strokeLinecap="round">
        <path d="M49 87C39 65 58 40 47 10M49 85c-9-20-23-30-32-51m32 44c18-12 18-37 33-50" stroke="#738465" strokeWidth="2.4"/>
        <path d="M47 11C32 18 61 28 43 43c-17 16 12 15 2 32 20-20 4-32 14-39C65 24 49 23 47 11Z" fill="#8a9b72"/>
        <path d="M17 32C3 51 40 41 27 61c-5 9 13 13 20 17C41 60 34 47 17 32Z" fill="#a6ad7a"/>
        <path d="M83 28C59 32 80 51 63 55c-14 2-1 17-13 25 26-5 16-15 24-22 14-10 3-18 9-30Z" fill="#758666"/>
        <ellipse cx="45" cy="70" rx="5" ry="7" fill="#b7b485"/><ellipse cx="63" cy="58" rx="4" ry="6" fill="#aeb281"/>
      </g>}
      {kind === 'glass' && <g>
        <path d="m20 22 35-6 16 26-12 27-31 4-14-24Z" fill={`url(#${id}-glass)`} stroke="#c9e0d1" strokeWidth="2.2"/>
        <path d="m20 23 17 7 18-12M17 48l12 16 29 2" stroke="#e0ebe0" strokeWidth="2" opacity=".65"/>
        <path d="m64 52 25 8-4 25-24 3-11-15Z" fill="#e8ddc6" stroke="#cec1aa" strokeWidth="1.5"/>
        <path d="M61 62q17 1 16 13t-14 2q-6-5 3-7t14 10m-20 2 24-19" stroke="#7691a0" strokeWidth="1.7"/>
      </g>}
      {kind === 'wood' && <g>
        <path d="M10 55c19-19 25 10 46-9S78 38 90 30" stroke="#b29b7e" strokeWidth="18" strokeLinecap="round"/>
        <path d="M34 55 26 26m33 16 10 24m1-25 7-17" stroke="#bba487" strokeWidth="9" strokeLinecap="round"/>
        <path d="M12 55c19-21 25 11 44-8S80 38 87 31M17 59c17-16 25 9 44-8m-23 4-9-27" stroke="#d3c2a4" strokeWidth="2" strokeLinecap="round"/>
        <path d="M13 50c15-14 27 9 42-7m7-1 19-7" stroke="#89785e" strokeWidth="1.8"/>
        <circle cx="44" cy="68" r="21" fill={`url(#${id}-glass)`} stroke="#9da68c"/>
        <g stroke="#afa382" strokeWidth="1.2"><ellipse cx="44" cy="68" rx="10" ry="21"/><ellipse cx="44" cy="68" rx="18" ry="21"/><path d="M24 64h40M26 77h35M31 51l26 33m-30-5 29-27"/></g>
        <path d="M31 57q6-7 13-7" stroke="#e6ede0" strokeWidth="2.5" opacity=".7"/>
      </g>}
    </g>
  </svg>;
}

export function DioramaFallback() {
  const pieces: { kind: ArtKind; x: number; y: number; size: number; rotate: number }[] = [
    { kind: 'wood', x: 180, y: 85, size: 250, rotate: -12 }, { kind: 'kelp', x: 420, y: 145, size: 160, rotate: 20 },
    { kind: 'scallop', x: 292, y: 175, size: 122, rotate: -40 }, { kind: 'cuttlebone', x: 533, y: 195, size: 115, rotate: 60 },
    { kind: 'urchin', x: 486, y: 279, size: 122, rotate: 10 }, { kind: 'conch', x: 523, y: 369, size: 190, rotate: -24 },
    { kind: 'starfish', x: 310, y: 325, size: 135, rotate: 17 }, { kind: 'scallop', x: 215, y: 392, size: 140, rotate: -15 },
    { kind: 'oyster', x: 184, y: 270, size: 122, rotate: 54 }, { kind: 'cowrie', x: 387, y: 230, size: 100, rotate: 34 },
    { kind: 'glass', x: 340, y: 440, size: 80, rotate: -18 }, { kind: 'glass', x: 165, y: 415, size: 74, rotate: 14 },
    { kind: 'auger', x: 422, y: 359, size: 120, rotate: 17 }, { kind: 'tooth', x: 411, y: 489, size: 56, rotate: 40 },
    { kind: 'crab', x: 347, y: 269, size: 102, rotate: 10 }, { kind: 'razor', x: 145, y: 353, size: 130, rotate: -42 },
  ];
  return <svg className="diorama-fallback" viewBox="0 0 850 650" aria-label="Illustrated overview of the coastal specimen collection">
    <defs><radialGradient id="fallback-sand"><stop stopColor="#e0d0b1"/><stop offset=".85" stopColor="#e7dac2"/><stop offset="1" stopColor="#ede8dc"/></radialGradient></defs>
    <ellipse cx="426" cy="352" rx="349" ry="225" fill="url(#fallback-sand)"/>
    {Array.from({ length: 450 }, (_, i) => <circle key={i} cx={430 + Math.cos(i * 2.3999) * (100 + i % 236)} cy={350 + Math.sin(i * 2.3999) * (60 + i % 145)} r={.5 + i % 3 * .35} fill={i % 3 ? '#c5b89c' : '#fbf4e1'} opacity=".6"/>)}
    {pieces.map((p, i) => <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.rotate} ${p.size / 2} ${p.size / 2})`}><svg width={p.size} height={p.size}><SpecimenArt kind={p.kind}/></svg></g>)}
  </svg>;
}