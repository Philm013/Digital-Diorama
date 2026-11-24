// Interaction smoke test for the studio UI (dev tool): taps an animal (discovery +
// field card), selects in Build mode (quick actions, resize), twists and pinches it,
// resizes the phone panel by its header and taps a panel tab, and saves screenshots.
//   node tools/ui-check.mjs --out shots/ui-check
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => { if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true]); return acc; }, []));
const PORT = Number(args.port ?? 5197);
const OUT = String(args.out ?? 'shots/ui-check');
const BIOME = String(args.biome ?? 'forest');
const TARGET = String(args.target ?? 'mammal/fox');
fs.mkdirSync(OUT, { recursive: true });
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--clearScreen', 'false'], { stdio: ['ignore', 'pipe', 'pipe'] });
async function up() { for (let k = 0; k < 120; k++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) return; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 700)); } throw new Error('vite did not start'); }
const init = `try { localStorage.setItem('dd-settings', JSON.stringify({ quality: 'low', author: '', sound: false, ambience: false, tips: false })); } catch {}`;
const where = (id) => `(() => { const e = window.__engine; const a = e.actorList.find((x) => x.def.id === '${id}'); if (!a) return null; const v = a.root.position.clone(); v.y += a.height * 0.5; v.project(e.camera); const r = e.renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height, id: a.id }; })()`;
const errors = [];

async function run(name, ctxOpts, phone) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext(ctxOpts);
  await ctx.addInitScript(init);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => { errors.push(`${name}: ${e}`); console.log('[pageerror]', String(e).slice(0, 300)); });
  await pg.goto(`http://localhost:${PORT}/#new=${BIOME}&model=1`, { waitUntil: 'load' });
  await pg.waitForFunction('window.__loaded === true', null, { timeout: 240000 });
  await pg.waitForTimeout(2500);
  // focus the target so it is big on screen, then tap it
  await pg.evaluate(`(() => { const e = window.__engine; const a = e.actorList.find((x) => x.def.id === '${TARGET}'); e.ambientOff = true; if (a) e.focusActor(a.id, 0.01); })()`);
  await pg.waitForTimeout(1500);
  let p = await pg.evaluate(where(TARGET));
  if (!p) { console.log('target not found'); await browser.close(); return; }
  if (phone) await pg.touchscreen.tap(p.x, p.y); else await pg.mouse.click(p.x, p.y);
  await pg.waitForTimeout(1800);
  const card = await pg.evaluate(`!!document.querySelector('.dd-species-card')`);
  const disc = await pg.evaluate(`JSON.parse(localStorage.getItem('dd-profile') || '{}').discovered || []`);
  console.log(name, 'info card:', card, 'discovered:', disc.length);
  await pg.screenshot({ path: path.join(OUT, `${name}-card.png`) });
  // build mode: select → context bar
  if (phone) await pg.evaluate(`[...document.querySelectorAll('nav button')].find((b) => b.textContent.includes('Build')).click()`);
  else await pg.keyboard.press('2');
  await pg.waitForTimeout(1500);
  p = await pg.evaluate(where(TARGET));
  if (phone) await pg.touchscreen.tap(p.x, p.y); else await pg.mouse.click(p.x, p.y);
  await pg.waitForTimeout(1500);
  const bar = await pg.evaluate(`!!document.querySelector('[aria-label="Turn left"]')`);
  console.log(name, 'context bar:', bar);
  if (bar) { await pg.click('[aria-label="Bigger"]'); await pg.waitForTimeout(400); }
  const scale = await pg.evaluate(`window.__engine.getActor(window.__engine.selectedId)?.root.scale.x`);
  console.log(name, 'scale after Bigger:', scale);
  await pg.screenshot({ path: path.join(OUT, `${name}-build.png`) });
  if (phone) {
    // two-finger twist + pinch on the selected object (real PointerEvents: CDP's synthetic second touch drops its pointerdown)
    const tw = await pg.evaluate(async () => {
      const e = window.__engine, el = e.renderer.domElement, a = e.getActor(e.selectedId);
      if (!a) return null;
      const before = { rot: a.root.rotation.y, s: a.root.scale.x };
      const v = a.root.position.clone(); v.y += a.height * 0.4; v.project(e.camera);
      const r = el.getBoundingClientRect();
      const cx = r.left + (v.x * 0.5 + 0.5) * r.width, cy = r.top + (-v.y * 0.5 + 0.5) * r.height;
      const ev = (type, id, x, y) => (type === 'pointerdown' ? el : window).dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 201, clientX: x, clientY: y, bubbles: true, button: 0 }));
      ev('pointerdown', 201, cx, cy); ev('pointerdown', 202, cx + 60, cy);
      for (let k = 1; k <= 8; k++) { ev('pointermove', 202, cx + Math.cos(k * 0.08) * (60 + k * 5), cy + Math.sin(k * 0.08) * (60 + k * 5)); await new Promise((q) => setTimeout(q, 16)); }
      ev('pointerup', 202, cx, cy); ev('pointerup', 201, cx, cy);
      return { dRot: +(a.root.rotation.y - before.rot).toFixed(2), scale: +(a.root.scale.x / before.s).toFixed(2) };
    });
    console.log(name, 'twist/pinch', JSON.stringify(tw));
    // drag the sheet handle up to the tall snap point
    const h = await pg.evaluate(`(() => { const s = document.querySelector('.dd-sheet'); const r = s.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 10, h: r.height }; })()`);
    const cdp = await ctx.newCDPSession(pg);
    const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await touch('touchStart', h.x, h.y);
    for (let k = 1; k <= 8; k++) { await touch('touchMove', h.x, h.y - k * 40); await pg.waitForTimeout(16); }
    await touch('touchEnd', h.x, h.y - 320);
    await pg.waitForTimeout(800);
    const h2 = await pg.evaluate(`document.querySelector('.dd-sheet').getBoundingClientRect().height`);
    console.log(name, 'sheet height', Math.round(h.h), '→', Math.round(h2));
    // the header doubles as a drag handle, but a plain tap on a tab must still switch tabs
    const tab = await pg.evaluate(`(() => { const b = [...document.querySelectorAll('.dd-sheet button')].find((x) => x.textContent.includes('Add things')); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await touch('touchStart', tab.x, tab.y);
    await touch('touchEnd', tab.x, tab.y);
    await pg.waitForTimeout(600);
    console.log(name, 'tab tap opens the inventory:', await pg.evaluate(`!!document.querySelector('.dd-sheet input[placeholder^="Search species"]')`));
    await pg.screenshot({ path: path.join(OUT, `${name}-sheet.png`) });
  }
  await browser.close();
}

try {
  await up();
  await run('desktop', { viewport: { width: 1440, height: 900 } }, false);
  await run('phone', { ...devices['iPhone 13'], deviceScaleFactor: 2 }, true);
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
} finally {
  vite.kill('SIGKILL');
}
process.exit(0);
