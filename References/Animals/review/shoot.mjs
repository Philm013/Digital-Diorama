// Screenshot every catalog animal via review.html.
// Usage: node review/shoot.mjs [startPage] [endPage]   (0-based, inclusive)
//        node review/shoot.mjs --ids red-fox,african-lion
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 5193;
const PER = 11;
const TOTAL = 116;

const args = process.argv.slice(2);
let pages;
let tag = '';
if (args[0] === '--ids') {
  pages = [{ ids: args[1] || '' }];
  tag = 'custom';
} else {
  const start = parseInt(args[0] ?? '0', 10);
  const end = parseInt(args[1] ?? String(Math.ceil(TOTAL / PER) - 1), 10);
  pages = [];
  for (let p = start; p <= end; p++) pages.push({ page: p });
}

fs.mkdirSync('review/shots', { recursive: true });

// Start vite dev server
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--clearScreen', 'false'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
let viteLog = '';
vite.stdout.on('data', d => { viteLog += d.toString(); });
vite.stderr.on('data', d => { viteLog += d.toString(); });

async function waitForServer(timeoutMs = 90000) {
  const t0 = Date.now();
  for (;;) {
    try {
      const r = await fetch(`http://localhost:${PORT}/review.html`, { method: 'HEAD' });
      if (r.ok) return;
    } catch { /* not up yet */ }
    if (Date.now() - t0 > timeoutMs) throw new Error('vite never came up:\n' + viteLog.slice(-2000));
    await new Promise(r => setTimeout(r, 800));
  }
}

try {
  await waitForServer();
  console.log('vite up on', PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1000 } });
  const pg = await ctx.newPage();
  pg.on('console', m => { if (m.type() === 'error') console.log('[page-error]', m.text().slice(0, 300)); });
  pg.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));

  for (const spec of pages) {
    const url = spec.ids !== undefined
      ? `http://localhost:${PORT}/review.html?ids=${encodeURIComponent(spec.ids)}`
      : `http://localhost:${PORT}/review.html?page=${spec.page}&per=${PER}`;
    const name = spec.ids !== undefined ? `custom-${Date.now()}` : `p${spec.page}`;
    console.log('shooting', url);
    await pg.goto(url, { waitUntil: 'load' });
    await pg.waitForFunction('window.__REVIEW_DONE__ === true', { timeout: 240000 });
    await pg.waitForTimeout(400);
    await pg.screenshot({ path: `review/shots/${name}.png`, fullPage: true });
    const errs = await pg.evaluate('window.__REVIEW_ERRORS__');
    console.log(name, 'errors:', errs.length ? errs : 'none');
  }
  await browser.close();
  console.log('ALL SHOTS DONE');
} finally {
  vite.kill('SIGKILL');
}
process.exit(0);
