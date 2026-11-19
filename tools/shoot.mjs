// Screenshot app URLs with Playwright (dev tool).
//
//   node tools/shoot.mjs --out shots --paths "?harness=1&biome=desert,?harness=1&biome=taiga"
//   node tools/shoot.mjs --out shots --paths "#new=forest" --device phone --wait 6000
//
// Each path is loaded against a fresh Vite dev server; the page is captured after
// window.__loaded (or --wait ms). --device phone emulates an iPhone-sized touch screen.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => { if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true]); return acc; }, []));
const PORT = Number(args.port ?? 5198);
const OUT = String(args.out ?? 'shots');
const WAIT = Number(args.wait ?? 2500);
fs.mkdirSync(OUT, { recursive: true });
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--clearScreen', 'false'], { stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
vite.stdout.on('data', (d) => { log += d; });
vite.stderr.on('data', (d) => { log += d; });
async function up(ms = 90000) {
  const t0 = Date.now();
  for (;;) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) return; } catch { /* not yet */ }
    if (Date.now() - t0 > ms) throw new Error('vite did not start:\n' + log.slice(-2000));
    await new Promise((r) => setTimeout(r, 700));
  }
}
try {
  await up();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const phone = args.device === 'phone';
  const ctx = await browser.newContext(phone
    ? { ...devices['iPhone 13'], deviceScaleFactor: Number(args.dpr ?? 2) }
    : { viewport: { width: Number(args.width ?? 1440), height: Number(args.height ?? 900) }, deviceScaleFactor: Number(args.dpr ?? 1) });
  // --init "<js>" runs before every page script (e.g. to seed localStorage)
  if (args.init) await ctx.addInitScript(`try { ${String(args.init)} } catch {}`);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 400)));
  pg.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('PERF')) console.log('[console]', m.text().slice(0, 400)); });
  const paths = String(args.paths ?? '/').split(',');
  let i = 0;
  for (const p0 of paths) {
    // a leading "!" means: don't wait for the 3D scene (e.g. the welcome screen)
    const quick = p0.startsWith('!');
    const p = quick ? p0.slice(1) : p0;
    const url = `http://localhost:${PORT}/${p.startsWith('?') || p.startsWith('#') ? p : p.replace(/^\//, '')}`;
    const t0 = Date.now();
    await pg.goto('about:blank');
    await pg.goto(url, { waitUntil: 'load' });
    if (!quick) { try { await pg.waitForFunction('window.__loaded === true', null, { timeout: 240000 }); } catch { console.log('no __loaded for', url); } }
    const loadMs = Date.now() - t0;
    await pg.waitForTimeout(WAIT);
    // --eval runs once per path after load ("|"-separated per path is allowed), then waits --after ms
    if (args.eval) {
      const evs = String(args.eval).split('|||');
      const ev = evs.length > 1 ? evs[i] : evs[0];
      if (ev) await pg.evaluate(ev);
      await pg.waitForTimeout(Number(args.after ?? 1200));
    }
    const name = String(args.names ? String(args.names).split(',')[i] : `s${String(i).padStart(2, '0')}`);
    const file = path.join(OUT, `${name}.png`);
    await pg.screenshot({ path: file });
    const stats = await pg.evaluate(() => { const e = (window).__engine; if (!e) return null; const info = e.renderer.info.render; return { tris: info.triangles, calls: info.calls, actors: e.actors?.size }; });
    console.log(file, `load ${loadMs} ms`, stats ? JSON.stringify(stats) : '');
    i++;
  }
  await browser.close();
} finally {
  vite.kill('SIGKILL');
}
process.exit(0);
