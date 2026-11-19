// Render catalog assets to PNG contact sheets with review.html (dev tool).
//
//   node tools/review-assets.mjs --query "cat=animals&group=Mammals" --out review/shots/mammals
//   node tools/review-assets.mjs --query "ids=mammal/lion,bird/owl&views=front,side" --out review/shots/check
//
// Options: --query <url query>  --out <dir>  --per <n>  --pages <a-b>  --port <n>
// Needs Playwright (npm i -D playwright, or a global install).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => { if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true]); return acc; }, []));
const PORT = Number(args.port ?? 5199);
const OUT = String(args.out ?? 'review/shots');
const PER = Number(args.per ?? 12);
const QUERY = String(args.query ?? '');
fs.mkdirSync(OUT, { recursive: true });

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--clearScreen', 'false'], { stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
vite.stdout.on('data', (d) => { log += d; });
vite.stderr.on('data', (d) => { log += d; });

async function up(ms = 90000) {
  const t0 = Date.now();
  for (;;) {
    try { const r = await fetch(`http://localhost:${PORT}/review.html`); if (r.ok) return; } catch { /* not yet */ }
    if (Date.now() - t0 > ms) throw new Error('vite did not start:\n' + log.slice(-2000));
    await new Promise((r) => setTimeout(r, 700));
  }
}

try {
  await up();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: Number(args.width ?? 1600), height: 900 } });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 400)));
  pg.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 400)); });
  const isIds = /(^|&)(ids|base)=/.test(QUERY);
  let total = 1;
  let [p0, p1] = String(args.pages ?? '').split('-').map((x) => (x === '' ? undefined : Number(x)));
  for (let p = p0 ?? 0; p < (isIds ? 1 : total); p++) {
    const url = `http://localhost:${PORT}/review.html?${QUERY}&page=${p}&per=${PER}`;
    await pg.goto(url, { waitUntil: 'load' });
    await pg.waitForFunction('window.__REVIEW_DONE__ === true', null, { timeout: 600000 });
    total = Math.min(await pg.evaluate('window.__REVIEW_PAGES__'), p1 !== undefined ? p1 + 1 : Infinity);
    const file = path.join(OUT, `p${String(p).padStart(2, '0')}.png`);
    await pg.screenshot({ path: file, fullPage: true });
    const errs = await pg.evaluate('window.__REVIEW_ERRORS__');
    console.log(file, `(${p + 1}/${total})`, errs.length ? 'ERRORS: ' + errs.join(' | ') : 'ok');
  }
  await browser.close();
} finally {
  vite.kill('SIGKILL');
}
process.exit(0);
