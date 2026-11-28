// Drive the animal workbench (workbench.html) from Playwright (dev tool).
//
//   node tools/workbench.mjs ui --id mammal/zebra --view side --tab code --out shots/wb/zebra-ui.png
//   node tools/workbench.mjs sheet --ids mammal/zebra,mammal/tiger --views front34,side,front --out shots/wb
//   node tools/workbench.mjs sheet --group Mammals --out shots/wb/mammals        (every animal in a library group)
//   node tools/workbench.mjs sheet --ids bird/owl --params '{"specOverride":{"eye":{"r":0.2}}}' --out shots/wb/owl-try
//
// `ui` captures the whole workbench (library, live view, photo, code); `sheet` saves one image per
// animal: its reference photo beside the model from each view. --params patches the catalog params
// (objects merge one level deep) before capturing, so a change can be tried without saving it.
// Uses a running dev server with --url (e.g. http://localhost:5173), or starts its own.
// Other options: --q low|medium|high, --true 0 (exhibit size), --w/--h (view size), --clip name --phase 0.3,
// --width/--height (browser window, for `ui`).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [cmd = 'sheet', ...rest] = process.argv.slice(2);
const args = Object.fromEntries(rest.reduce((acc, a, i, all) => { if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true]); return acc; }, []));
const OUT = String(args.out ?? 'shots/workbench');
let base = args.url ? String(args.url).replace(/\/$/, '') : null;
let vite = null, viteLog = '';

async function up(url, ms = 90000) {
  const t0 = Date.now();
  for (;;) {
    try { const r = await fetch(`${url}/workbench.html`); if (r.ok) return; } catch { /* not yet */ }
    if (Date.now() - t0 > ms) throw new Error('dev server did not start:\n' + viteLog.slice(-2000));
    await new Promise((r) => setTimeout(r, 600));
  }
}

try {
  if (!base) {
    const port = Number(args.port ?? 5196);
    // its output is collected (not inherited), so a pipe reading this script's output still closes when it ends
    vite = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--clearScreen', 'false'], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    vite.stdout.on('data', (d) => { viteLog += d; });
    vite.stderr.on('data', (d) => { viteLog += d; });
    // stop the server (and npx's child) however this script ends: normally, on an error, or killed
    const stop = () => { try { process.kill(-vite.pid, 'SIGKILL'); } catch { /* already gone */ } };
    process.on('exit', stop);
    for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { stop(); process.exit(130); });
    base = `http://localhost:${port}`;
  }
  await up(base);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: Number(args.width ?? 1680), height: Number(args.height ?? 980) }, deviceScaleFactor: Number(args.dpr ?? 1) });
  // a clean slate each run: no remembered edits or camera from earlier sessions
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('wb:keep')) { for (const k of Object.keys(localStorage)) if (k.startsWith('wb:')) localStorage.removeItem(k); sessionStorage.setItem('wb:keep', '1'); } } catch { /* ignore */ } });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 400)));
  pg.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 400)); });
  const q = new URLSearchParams();
  if (args.q) q.set('q', String(args.q));
  if (args.true !== undefined) q.set('true', String(args.true));
  if (args.tab) q.set('tab', String(args.tab));
  if (args.clip) q.set('clip', String(args.clip));

  let ids = args.ids ? String(args.ids).split(',').map((s) => s.trim()).filter(Boolean) : args.id ? [String(args.id)] : [];
  q.set('id', ids[0] ?? 'mammal/lion');
  await pg.goto(`${base}/workbench.html?${q}`, { waitUntil: 'load' });
  await pg.waitForFunction('window.wb !== undefined', null, { timeout: 60000 });
  await pg.evaluate('wb.ready()');
  if (args.group || args.family) ids = await pg.evaluate(([g, f]) => window.wb.idsWhere({ group: g, family: f }), [args.group ?? null, args.family ?? null]);
  const patch = args.params ? JSON.parse(String(args.params)) : null;
  fs.mkdirSync(cmd === 'ui' ? path.dirname(OUT) : OUT, { recursive: true });

  for (const id of ids.length ? ids : [q.get('id')]) {
    await pg.evaluate((i) => window.wb.select(i), id);
    if (patch) await pg.evaluate((p) => window.wb.patchParams(p), patch);
    if (args.clip) await pg.evaluate(([c, ph]) => window.wb.clip(c, ph === undefined ? undefined : Number(ph)), [String(args.clip), args.phase]);
    const info = await pg.evaluate('wb.info()');
    if (info.error) console.log(`${id}: BUILD ERROR ${info.error.slice(0, 300)}`);
    if (cmd === 'ui') {
      if (args.view) await pg.evaluate((v) => window.wb.view(v), String(args.view));
      if (args.overlay) await pg.evaluate((o) => window.wb.overlay(Number(o)), args.overlay);
      await pg.waitForTimeout(Number(args.wait ?? 600));
      const file = ids.length > 1 ? path.join(path.dirname(OUT), `${id.replace('/', '-')}.png`) : OUT;
      await pg.screenshot({ path: file });
      console.log(file, `${info.triangles} tris, built in ${Math.round(info.buildMs)} ms`);
    } else {
      const views = String(args.views ?? 'front34,side,front').split(',');
      const url = await pg.evaluate(([v, w, h]) => window.wb.sheet(v, w, h), [views, Number(args.w ?? 420), Number(args.h ?? 320)]);
      const file = path.join(OUT, `${id.replace('/', '-')}.png`);
      fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
      console.log(file, `${info.triangles} tris · ${info.bounds ? info.bounds.map((n) => n.toFixed(3)).join(' × ') + ' m' : ''} · ${Math.round(info.buildMs)} ms`);
    }
  }
  await browser.close();
} catch (e) {
  console.error(String(e?.stack ?? e));
  process.exitCode = 1;
}
process.exit();
