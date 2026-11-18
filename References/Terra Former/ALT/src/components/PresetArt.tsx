import { useId } from 'react';
import type { TerrainKind } from '../studio';

export function PresetArt({ kind, large = false }: { kind: TerrainKind; large?: boolean }) {
  const id = useId().replace(/:/g, '');
  const desert = kind === 'desert', islands = kind === 'islands', canyon = kind === 'canyon', volcano = kind === 'volcanic';
  const soil = desert ? '#b99b75' : canyon ? '#af7c5c' : volcano ? '#797c71' : '#9d9479';
  const background = desert ? '#f0ece2' : islands ? '#e9eff0' : canyon ? '#f0e9e2' : '#e9eee6';
  const pine = (x: number, y: number, scale = 1) => <g transform={`translate(${x} ${y}) scale(${scale})`}><path d="M0 3V-9" stroke="#776e52" strokeWidth="1.4" /><path d="M-5 0 0-13 5 0-1-3Z" fill="#456746" /><path d="M-3.5-5 0-16 3.5-5Z" fill="#608253" /></g>;
  return <svg viewBox="0 0 190 104" preserveAspectRatio={large ? 'xMidYMid meet' : 'none'} className={`preset-art ${large ? 'large' : ''}`} aria-hidden="true">
    <defs><linearGradient id={`bg-${id}`} x2="0" y2="1"><stop stopColor={background} /><stop offset="1" stopColor="#f6f7f3" /></linearGradient></defs>
    <rect width="190" height="104" fill={`url(#bg-${id})`} />
    <ellipse cx="97" cy="88" rx="66" ry="9" fill="#4b564a" opacity=".08" />
    <path d="M24 66 96 90 168 63 168 72 96 99 24 75Z" fill={soil} />
    <path d="M96 90 168 63 168 72 96 99Z" fill="#605b48" opacity=".22" />
    {kind === 'alpine' && <>
      <path d="M24 66 41 50 60 44 81 49 109 33 135 41 168 63 96 90Z" fill="#819762" />
      <path d="M37 63 68 15 99 63 114 74 70 82Z" fill="#8a9580" />
      <path d="M68 15 65 57 37 63Z" fill="#a2ac98" />
      <path d="M85 57 116 20 151 60 128 74Z" fill="#8d9983" />
      <path d="M116 20 112 52 85 57Z" fill="#b0b5a4" />
      <path d="M54 37 68 15 83 38 73 35 69 39 65 32 61 37Z" fill="#f4f6ed" />
      <path d="M103 35 116 20 130 37 119 33 115 38 112 32Z" fill="#f5f6ef" />
      <path d="M105 52C82 63 123 62 105 72S130 79 117 83L111 86C135 76 94 76 102 70S88 63 105 52" fill="#8ac7bf" />
      {pine(49, 68, .65)}{pine(60, 72, .8)}{pine(75, 80, .7)}{pine(135, 63, .65)}{pine(141, 70, .8)}{pine(85, 68, .5)}
    </>}
    {kind === 'hills' && <>
      <path d="M24 66Q43 32 67 49Q88 14 112 42Q135 26 168 63L96 90Z" fill="#8da86c" />
      <path d="M24 66Q55 36 83 68L96 90Z" fill="#a0b579" /><path d="M83 68Q109 22 142 52L168 63 96 90Z" fill="#819b60" />
      <path d="M116 43C84 65 132 66 101 87L94 89C118 66 82 63 116 43" fill="#a6cfbb" />
      {pine(58, 65, .8)}{pine(68, 72, .65)}{pine(135, 63, .7)}{pine(128, 71, .65)}
    </>}
    {desert && <>
      <path d="M24 66 57 33 82 53 111 29 146 49 168 63 96 90Z" fill="#d2b285" />
      <path d="M24 66 57 33 53 68 96 90Z" fill="#e4c898" /><path d="M57 33 82 53 53 68Z" fill="#bd9a70" />
      <path d="M53 68 111 29 97 74 96 90Z" fill="#e8c999" /><path d="M111 29 146 49 97 74Z" fill="#c3a073" /><path d="M97 74 146 49 168 63 96 90Z" fill="#debd8b" />
      <path d="M66 73 82 70M111 80 128 73M125 50 134 51" stroke="#b99a71" strokeWidth=".8" opacity=".6" />
    </>}
    {islands && <>
      <path d="M24 66 95 34 168 63 96 90Z" fill="#87c5c0" />
      <path d="M43 62 75 32 95 54 80 73 56 71Z" fill="#c6c4a0" /><path d="M46 61 75 28 91 53 79 68 59 66Z" fill="#88a16a" /><path d="M75 28 91 53 79 68 72 51Z" fill="#6d8a58" />
      <path d="M101 67 124 48 147 64 130 78 109 76Z" fill="#caccac" /><path d="M106 67 124 44 142 63 129 74 113 71Z" fill="#8aab74" />
      {pine(68, 57, .65)}{pine(77, 63, .7)}{pine(124, 64, .7)}
      <path d="M34 70 42 73M87 78 94 81M144 77 151 74M107 43 114 46" stroke="#d7eeea" strokeWidth="1.5" />
    </>}
    {canyon && <>
      <path d="M24 66 49 35 83 30 96 49 121 29 151 44 168 63 96 90Z" fill="#cba17b" />
      <path d="M24 66 49 35 51 58 83 53 83 30 96 49 87 78 61 81Z" fill="#b77f5c" /><path d="M121 29 121 61 151 69 151 44 168 63 126 81 101 75Z" fill="#b67c58" />
      <path d="M88 80 104 68 98 52 121 40 107 57 113 70 96 90Z" fill="#91bdb0" />
      <path d="M28 61 55 71 79 65M125 67 150 76M46 48 58 53 81 46" stroke="#ddba90" strokeWidth="2" />
    </>}
    {volcano && <>
      <path d="M24 66 62 43 128 41 168 63 96 90Z" fill="#8d9582" />
      <path d="M47 70 79 28 102 24 125 38 145 72 98 85Z" fill="#777e73" /><path d="M79 28 102 24 97 62 47 70Z" fill="#91968a" /><path d="M102 24 125 38 111 48 85 42 79 28Z" fill="#525f55" /><path d="M85 35 102 29 116 38 109 43 93 40Z" fill="#a1aa91" />
      <path d="M97 62 109 51 120 71 111 64 110 58 104 69Z" fill="#a89873" />
    </>}
  </svg>;
}