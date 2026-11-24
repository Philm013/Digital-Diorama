// The app icon: a shoebox diorama. An open cardboard box seen from above and to the right, with a
// little habitat inside (painted sky, hills, a tree, a fox and a mushroom) and a sparkle for the
// "digital" part. Writes public/favicon.svg, public/icons/icon.svg and the PNG app icons, which are
// rendered with Playwright's Chromium.
//   node tools/make-icons.mjs            (writes into public/)
//   node tools/make-icons.mjs --out dir  (writes a preview set somewhere else)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => { if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true]); return acc; }, []));
const OUT = path.resolve(String(args.out ?? 'public'));
const f = (n) => +n.toFixed(2);

// ---- the box, in a 512 × 512 drawing ----
const F = { x0: 70, x1: 364, y0: 158, y1: 424 }; // the front (the open side), outer edge
const D = [72, -58]; // how far back the box goes: up and to the right, so its top and right side show
const RT = 17; // thickness of the cardboard rim
const O = { x0: F.x0 + RT, x1: F.x1 - RT, y0: F.y0 + RT, y1: F.y1 - RT }; // the opening
const B = { x0: O.x0 + D[0], x1: O.x1 + D[0], y0: O.y0 + D[1], y1: O.y1 + D[1] }; // the back wall, inside

/** a four-point sparkle */
const sparkle = (x, y, s, fill = '#fff8d8') => `<path d="M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z" fill="${fill}"/>`;

/** a fox sitting and facing out, its feet at (x, y) */
const fox = (x, y, s) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="2" cy="1" rx="24" ry="4.5" fill="#1d4a22" opacity=".28"/>
    <clipPath id="tail"><path d="M6-3C24 1 37-11 34-31C33-38 26-40 23-35C23-23 18-15 7-13Z"/></clipPath>
    <path d="M6-3C24 1 37-11 34-31C33-38 26-40 23-35C23-23 18-15 7-13Z" fill="#e9782a"/>
    <circle cx="29" cy="-35" r="8.5" fill="#fff6ea" clip-path="url(#tail)"/>
    <path d="M-14 0C-17-15-12-29 0-31C12-29 17-15 14 0Z" fill="#f28a32"/>
    <path d="M-7-24C-8-14-5-6 0-4C5-6 8-14 7-24C3-27-3-27-7-24Z" fill="#fff6ea"/>
    <ellipse cx="-6" cy="-1" rx="4.6" ry="2.6" fill="#4a2616"/><ellipse cx="6" cy="-1" rx="4.6" ry="2.6" fill="#4a2616"/>
    <path d="M-16-46L-15-66L-3-55Z M16-46L15-66L3-55Z" fill="#e9782a"/>
    <path d="M-13.5-50L-13-61L-7-55Z M13.5-50L13-61L7-55Z" fill="#4a2616"/>
    <path d="M-18-45C-16-53-9-57 0-57C9-57 16-53 18-45C15-37 7-31 0-28C-7-31-15-37-18-45Z" fill="#f28a32"/>
    <path d="M-17-43C-11-41-5-39 0-34C5-39 11-41 17-43C14-36 7-31 0-28C-7-31-14-36-17-43Z" fill="#fff6ea"/>
    <circle cx="-6.5" cy="-45" r="2.4" fill="#2b1a10"/><circle cx="6.5" cy="-45" r="2.4" fill="#2b1a10"/>
    <circle cx="-5.8" cy="-45.8" r=".8" fill="#fff"/><circle cx="7.2" cy="-45.8" r=".8" fill="#fff"/>
    <ellipse cx="0" cy="-30" rx="2.8" ry="2.1" fill="#2b1a10"/>
  </g>`;

/** a toadstool, its foot at (x, y) */
const mushroom = (x, y) => `
  <g transform="translate(${x} ${y})">
    <ellipse cx="1" cy="1" rx="12" ry="2.6" fill="#1d5a26" opacity=".3"/>
    <path d="M-4 0V-9H4V0Z" fill="#fff4e4"/>
    <path d="M-12-8C-12-17-5-21 0-21C5-21 12-17 12-8Z" fill="#e8483a"/>
    <circle cx="-5" cy="-14" r="2.2" fill="#fff"/><circle cx="4" cy="-16" r="1.8" fill="#fff"/><circle cx="7" cy="-10.5" r="1.5" fill="#fff"/>
  </g>`;

/**
 * The box and its habitat. Options: `shadow: false` drops the shadow it casts; `sparkle` is
 * 'float' (above the box), 'glint' (on its back corner, which stays inside a maskable icon's safe
 * zone) or false.
 */
function art({ shadow = true, sparkle: sp = 'float' } = {}) {
  const flutesH = (xa, xb, y) => { let d = `M${xa} ${y}`; for (let x = xa; x < xb - 6; x += 10) d += 'q2.5 -3.5 5 0t5 0'; return d; };
  const flutesV = (x, ya, yb) => { let d = `M${x} ${ya}`; for (let y = ya; y < yb - 6; y += 10) d += 'q-3.5 2.5 0 5t0 5'; return d; };
  return `
  <defs>
    <linearGradient id="sky" x1="0" y1="${B.y0}" x2="0" y2="${B.y1}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3fa2ee"/><stop offset=".7" stop-color="#9fd9fb"/><stop offset="1" stop-color="#d8f3ff"/></linearGradient>
    <linearGradient id="wall" x1="${O.x0}" y1="0" x2="${B.x0}" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#b9864c"/><stop offset="1" stop-color="#d2a265"/></linearGradient>
    <linearGradient id="grass" x1="0" y1="${B.y1}" x2="0" y2="${O.y1}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8fd36a"/><stop offset="1" stop-color="#47a346"/></linearGradient>
    <linearGradient id="top" x1="0" y1="${F.y0 + D[1]}" x2="0" y2="${F.y0}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#f6dcae"/><stop offset="1" stop-color="#ebc68e"/></linearGradient>
    <linearGradient id="side" x1="0" y1="${F.y0 + D[1]}" x2="0" y2="${F.y1}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#c79358"/><stop offset="1" stop-color="#a97440"/></linearGradient>
    <linearGradient id="front" x1="0" y1="${F.y0}" x2="0" y2="${F.y1}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#e5ba7f"/><stop offset="1" stop-color="#d4a165"/></linearGradient>
    <radialGradient id="sun"><stop offset=".55" stop-color="#ffd54a"/><stop offset=".63" stop-color="#fff1a8" stop-opacity=".9"/><stop offset="1" stop-color="#fff1a8" stop-opacity="0"/></radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="blur" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="10"/></filter>
    <clipPath id="open"><rect x="${O.x0}" y="${O.y0}" width="${O.x1 - O.x0}" height="${O.y1 - O.y0}" rx="5"/></clipPath>
    <clipPath id="back"><rect x="${B.x0}" y="${B.y0}" width="${B.x1 - B.x0}" height="${B.y1 - B.y0}"/></clipPath>
  </defs>
  ${shadow ? `<path d="M${F.x0 + 10} ${F.y1 - 2}H${F.x1}L${F.x1 + D[0]} ${F.y1 + D[1]}" fill="none" stroke="#020a06" stroke-opacity=".6" stroke-width="26" stroke-linejoin="round" filter="url(#blur)"/>` : ''}
  <!-- outside of the box: top, right side, front rim -->
  <path d="M${F.x0} ${F.y0}L${F.x0 + D[0]} ${F.y0 + D[1]}H${F.x1 + D[0]}L${F.x1} ${F.y0}Z" fill="url(#top)" stroke="url(#top)" stroke-width="8" stroke-linejoin="round"/>
  <path d="M${F.x1} ${F.y0}L${F.x1 + D[0]} ${F.y0 + D[1]}V${F.y1 + D[1]}L${F.x1} ${F.y1}Z" fill="url(#side)" stroke="url(#side)" stroke-width="8" stroke-linejoin="round"/>
  <rect x="${F.x0}" y="${F.y0}" width="${F.x1 - F.x0}" height="${F.y1 - F.y0}" rx="6" fill="url(#front)" stroke="url(#front)" stroke-width="8" stroke-linejoin="round"/>
  <!-- inside: the painted back wall, the bare cardboard left wall and a grassy floor -->
  <g clip-path="url(#open)">
    <rect x="${B.x0}" y="${B.y0}" width="${B.x1 - B.x0}" height="${B.y1 - B.y0}" fill="url(#sky)"/>
    <g clip-path="url(#back)">
      <circle cx="${O.x1 - 42}" cy="${O.y0 + 42}" r="30" fill="url(#sun)"/>
      <g fill="#fff"><circle cx="${B.x0 + 62}" cy="${O.y0 + 44}" r="13"/><circle cx="${B.x0 + 80}" cy="${O.y0 + 37}" r="16"/><circle cx="${B.x0 + 97}" cy="${O.y0 + 45}" r="11"/><rect x="${B.x0 + 60}" y="${O.y0 + 44}" width="40" height="12" rx="6"/></g>
      <path d="M${B.x0} ${B.y1 - 40}C${B.x0 + 50} ${B.y1 - 74} ${B.x0 + 110} ${B.y1 - 60} ${B.x0 + 150} ${B.y1 - 36}S${B.x1 - 30} ${B.y1 - 66} ${B.x1} ${B.y1 - 52}V${B.y1}H${B.x0}Z" fill="#a8db82"/>
      <path d="M${B.x0} ${B.y1 - 18}C${B.x0 + 60} ${B.y1 - 44} ${B.x0 + 130} ${B.y1 - 10} ${B.x1} ${B.y1 - 30}V${B.y1}H${B.x0}Z" fill="#79c55f"/>
    </g>
    <path d="M${O.x0} ${O.y0}L${B.x0} ${B.y0}V${B.y1}L${O.x0} ${O.y1}Z" fill="url(#wall)"/>
    <path d="M${O.x0} ${O.y1}L${B.x0} ${B.y1}H${B.x1}L${O.x1} ${O.y1}Z" fill="url(#grass)"/>
    <path d="M${O.x0} ${O.y0}L${B.x0} ${B.y0}V${B.y1}L${O.x0} ${O.y1}M${B.x0} ${B.y1}H${O.x1}" fill="none" stroke="#3a2410" stroke-opacity=".22" stroke-width="2"/>
    <!-- a tree -->
    <ellipse cx="${B.x0 + 24}" cy="${O.y1 - 13}" rx="40" ry="7.5" fill="#1d5a26" opacity=".35"/>
    <path d="M${B.x0 - 2} ${O.y1 - 11}C${B.x0 + 6} ${O.y1 - 18} ${B.x0 + 8} ${O.y1 - 40} ${B.x0 + 8} ${O.y1 - 100}H${B.x0 + 22}C${B.x0 + 22} ${O.y1 - 40} ${B.x0 + 24} ${O.y1 - 18} ${B.x0 + 32} ${O.y1 - 11}Z" fill="#7a4a24"/>
    <path d="M${B.x0 + 17} ${O.y1 - 20}C${B.x0 + 17} ${O.y1 - 50} ${B.x0 + 18} ${O.y1 - 80} ${B.x0 + 18} ${O.y1 - 100}H${B.x0 + 22}C${B.x0 + 22} ${O.y1 - 60} ${B.x0 + 23} ${O.y1 - 30} ${B.x0 + 28} ${O.y1 - 13}Z" fill="#5e3517" opacity=".6"/>
    <g transform="translate(${B.x0 + 15} ${O.y1 - 126}) scale(1.1)">
      <g fill="#2f8a3d"><circle cx="0" cy="-26" r="32"/><circle cx="-28" cy="2" r="30"/><circle cx="28" cy="2" r="30"/><circle cx="0" cy="14" r="29"/></g>
      <g fill="#46a94b"><circle cx="-4" cy="-31" r="27"/><circle cx="-30" cy="-4" r="23"/><circle cx="24" cy="-5" r="23"/></g>
      <g fill="#68c35c"><circle cx="-11" cy="-39" r="12"/><circle cx="-36" cy="-11" r="9"/></g>
    </g>
    ${mushroom(B.x0 + 66, O.y1 - 16)}
    ${fox(O.x1 - 62, O.y1 - 12, 1.12)}
    <!-- the rim's shadow on the inside -->
    <path d="M${O.x0 - 8} ${O.y1}V${O.y0 - 8}H${O.x1 + 8}" fill="none" stroke="#1a0e04" stroke-opacity=".42" stroke-width="18" filter="url(#soft)"/>
  </g>
  <!-- edges: the opening's cut edge (corrugated), a light top edge and the crease to the side -->
  <rect x="${O.x0}" y="${O.y0}" width="${O.x1 - O.x0}" height="${O.y1 - O.y0}" rx="5" fill="none" stroke="#6e4720" stroke-opacity=".5" stroke-width="2.5"/>
  <path d="${flutesH(F.x0 + 8, F.x1 - 4, F.y0 + RT / 2 + 1.5)}" fill="none" stroke="#b07a40" stroke-opacity=".55" stroke-width="2"/>
  <path d="${flutesV(F.x1 - RT / 2 - 1.5, F.y0 + 10, F.y1 - 6)}" fill="none" stroke="#b07a40" stroke-opacity=".45" stroke-width="2"/>
  <path d="M${F.x0 - 2} ${F.y0 - 1}H${F.x1 + 1}L${F.x1 + D[0] + 1} ${F.y0 + D[1] - 1}" fill="none" stroke="#fff6e2" stroke-opacity=".75" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M${F.x1 + 2} ${F.y0 + 2}V${F.y1 + 2}" stroke="#7a4f22" stroke-opacity=".35" stroke-width="3"/>
  ${sp === 'glint' ? sparkle(F.x1 + D[0] - 2, F.y0 + D[1] + 2, 30) + sparkle(F.x1 + D[0] + 26, F.y0 + D[1] + 40, 11, '#ffe58a')
    : sp ? sparkle(F.x1 + D[0] + 6, F.y0 + D[1] - 34, 30) + sparkle(F.x1 + D[0] + 40, F.y0 + D[1] + 4, 12, '#ffe58a') : ''}`;
}

// the tile behind the box: the app's dark forest green, lit from above
const BG = '<radialGradient id="bg" cx="50%" cy="22%" r="85%"><stop offset="0" stop-color="#3c7550"/><stop offset=".55" stop-color="#21452f"/><stop offset="1" stop-color="#142a1d"/></radialGradient>';

/** `tile`: 'rounded' (transparent corners), 'full' (full bleed, for icons the system masks) or 'none' (just the box) */
function svg({ tile = 'rounded', scale = 1, dy = 0, viewBox = '0 0 512 512', ...o } = {}) {
  const bg = tile === 'rounded' ? '<rect width="512" height="512" rx="114" fill="url(#bg)"/>' : tile === 'full' ? '<rect width="512" height="512" fill="url(#bg)"/>' : '';
  const t = scale === 1 && !dy ? '' : ` transform="translate(${f(256 - 256 * scale)} ${f(256 - 256 * scale + dy)}) scale(${scale})"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><defs>${BG}</defs>${bg}<g${t}>${art(o)}</g></svg>\n`;
}

const icons = {
  any: svg({ tile: 'rounded', scale: 0.94, dy: -6 }),
  // Android crops this to a circle or other shape: the box and its glint stay inside the 80% safe zone
  maskable: svg({ tile: 'full', scale: 0.8, dy: -4, sparkle: 'glint' }),
  // iOS rounds the corners itself and wants no transparency
  apple: svg({ tile: 'full', scale: 0.92, dy: -6 }),
  // the browser tab and the home screen's top bar: just the box, filling the square
  favicon: svg({ tile: 'none', shadow: false, sparkle: false, viewBox: '62 74 380 380' }),
};

fs.mkdirSync(path.join(OUT, 'icons'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'favicon.svg'), icons.favicon);
fs.writeFileSync(path.join(OUT, 'icons', 'icon.svg'), icons.any);

const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function png(markup, size, file, opaque = false) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${size}" height="${size}" style="display:block" `)}</body></html>`);
  await page.screenshot({ path: path.join(OUT, file), omitBackground: !opaque });
}
await png(icons.any, 192, 'icons/icon-192.png');
await png(icons.any, 512, 'icons/icon-512.png');
await png(icons.maskable, 512, 'icons/icon-maskable-512.png', true);
await png(icons.apple, 180, 'icons/apple-touch-icon.png', true);
await browser.close();
console.log('icons written to', OUT);
