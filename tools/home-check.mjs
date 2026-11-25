// Home screen and Back-button check (dev tool), on a phone: opens each tray from the tab bar,
// steps back through a habitat briefing, starts an expedition, opens and closes sheets in the
// studio (the heart's panel, the journal and a species card on top of it), reloads, drags trays
// and sheets closed, and checks that the phone's Back button always closes the top-most layer
// and never leaves a dead history entry. Saves screenshots.
//   node tools/home-check.mjs --out shots/home-check
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => { if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true]); return acc; }, []));
const PORT = Number(args.port ?? 5196);
const OUT = String(args.out ?? 'shots/home-check');
fs.mkdirSync(OUT, { recursive: true });
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--clearScreen', 'false'], { stdio: ['ignore', 'pipe', 'pipe'] });
async function up() { for (let k = 0; k < 120; k++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) return; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 700)); } throw new Error('vite did not start'); }
// (one species already discovered, so the journal has a card to open)
const init = `try {
  localStorage.setItem('dd-settings', JSON.stringify({ quality: 'low', author: '', sound: false, ambience: false, tips: false }));
  if (!localStorage.getItem('dd-profile')) localStorage.setItem('dd-profile', JSON.stringify({ discovered: ['mammal/rabbit'] }));
} catch {}`;
const failed = [];
const check = (name, ok, detail = '') => { console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : detail); if (!ok) failed.push(name); };

async function run() {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2 });
  await ctx.addInitScript(init);
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', (e) => { errors.push(String(e)); console.log('[pageerror]', String(e).slice(0, 300)); });
  const wait = (ms) => pg.waitForTimeout(ms);
  const back = async () => { await pg.evaluate(() => history.back()); await wait(900); };
  const shot = (name) => pg.screenshot({ path: path.join(OUT, `${name}.png`) });
  const tab = (label) => pg.evaluate((l) => [...document.querySelectorAll('nav button')].find((b) => b.textContent.trim().startsWith(l))?.click(), label);
  const state = () => pg.evaluate(() => ({
    url: location.href.replace(location.origin, ''),
    home: !!document.querySelector('[aria-label="Digital Diorama home"]'),
    studio: !!document.querySelector('[aria-label="Back to all dioramas"]'),
    tray: document.querySelector('.dd-tray-scrim.is-on') ? document.querySelector('#dd-tray-title')?.textContent : null,
    briefing: !!document.querySelector('[role=group][aria-label$=" expedition"]'),
    sheets: [...document.querySelectorAll('[role=dialog][aria-modal=true]')].map((d) => d.getAttribute('aria-label') || d.querySelector('h2')?.textContent),
    // the studio's journal tray (phones), and its tab bar
    journal: !!document.querySelector('.dd-tray-scrim.is-on') && !!document.querySelector('#dd-journal-title'),
    tabbar: !!document.querySelector('nav[aria-label="Modes"]'),
  }));
  // the top-most dialog's close button is on screen and nothing covers it
  const closeReachable = () => pg.evaluate(() => { const d = [...document.querySelectorAll('[role=dialog][aria-modal=true]')].pop(); const b = d?.querySelector('[aria-label=Close]'); if (!b) return false; const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.top >= 0 && r.bottom <= innerHeight && !!hit && b.contains(hit); });
  const cdp = await ctx.newCDPSession(pg);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const drag = async (sel, dy, steps = 10) => {
    const r = await pg.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + 8 }; }, sel);
    await touch('touchStart', r.x, r.y);
    for (let k = 1; k <= steps; k++) { await touch('touchMove', r.x, r.y + (dy * k) / steps); await wait(16); }
    await touch('touchEnd', r.x, r.y + dy);
    await wait(700);
  };

  await pg.goto('about:blank');
  await pg.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await wait(2000);
  await shot('1-home');
  let s = await state();
  check('home opens with no tray', s.home && !s.tray, JSON.stringify(s));

  await tab('Expeditions'); await wait(1500);
  await shot('2-expeditions');
  s = await state(); check('Expeditions tray opens from the tab bar', s.tray === 'Choose your expedition', JSON.stringify(s));
  await back();
  s = await state(); check('Back closes the tray and stays home', s.home && !s.tray && s.url === '/', JSON.stringify(s));

  await tab('Expeditions'); await wait(500); await tab('My dioramas'); await wait(600);
  s = await state(); check('the tab bar switches trays', s.tray === 'My dioramas', JSON.stringify(s));
  await back();
  s = await state(); check('one Back closes a switched tray', !s.tray, JSON.stringify(s));

  await tab('Expeditions'); await wait(600);
  // habitats further along the ranger path explain how to unlock them
  await pg.evaluate(() => [...document.querySelectorAll('.dd-tray button')].find((b) => b.textContent.includes('Desert'))?.click()); await wait(700);
  s = await state(); check('a locked habitat explains how to unlock it', s.sheets.some((t) => t.includes('Not unlocked yet')), JSON.stringify(s));
  await back();
  s = await state(); check('Back closes the explanation and keeps the tray', !s.sheets.length && !!s.tray, JSON.stringify(s));
  await pg.evaluate(() => [...document.querySelectorAll('.dd-tray button')].find((b) => b.textContent.includes('Backyard'))?.click()); await wait(900);
  await shot('3-briefing');
  s = await state(); check('a habitat opens its briefing', s.briefing, JSON.stringify(s));
  await back();
  s = await state(); check('Back returns from the briefing to the habitats', !s.briefing && !!s.tray, JSON.stringify(s));
  await drag('.dd-tray', 60, 12);
  s = await state(); check('a short drag snaps the tray back', !!s.tray, JSON.stringify(s));
  await drag('.dd-tray', 320);
  s = await state(); check('dragging the tray down closes it', !s.tray, JSON.stringify(s));

  await tab('Expeditions'); await wait(600);
  await pg.evaluate(() => [...document.querySelectorAll('.dd-tray button')].find((b) => b.textContent.includes('Backyard'))?.click()); await wait(600);
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Start expedition'))?.click());
  await pg.waitForFunction('window.__loaded === true', null, { timeout: 240000 }); await wait(1500);
  s = await state(); check('Start opens the studio at #open=<id>', s.studio && /#open=/.test(s.url), JSON.stringify(s));
  await pg.click('[aria-label="More"]'); await wait(600);
  await shot('4-studio-more');
  s = await state(); check('More opens as a sheet on phones', s.sheets.includes('More'), JSON.stringify(s));
  await back();
  s = await state(); check('Back closes the sheet and stays in the studio', s.studio && !s.sheets.length, JSON.stringify(s));
  await pg.click('[aria-label="More"]'); await wait(400);
  await pg.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.includes('Quests'))?.click()); await wait(800);
  s = await state(); check('a sheet can hand over to another sheet', s.sheets.some((t) => t.includes('Quests')), JSON.stringify(s));
  await drag('[role=dialog][aria-modal=true]', 300); await wait(300);
  s = await state(); check('dragging a sheet down closes it', s.studio && !s.sheets.length, JSON.stringify(s));

  // the heart: its details are a panel at the bottom of the screen, not a popover off the edge
  await pg.click('[data-tour="health"]'); await wait(700);
  await shot('4b-health');
  const health = await pg.evaluate(() => { const d = document.querySelector('[role=dialog][aria-label="Ecosystem health"]'); if (!d) return null; const r = d.getBoundingClientRect(); return { left: r.left, right: r.right, bottom: r.bottom, w: innerWidth, h: innerHeight }; });
  check('the heart opens a panel at the bottom of the screen', !!health && health.left >= 0 && health.right <= health.w && Math.abs(health.bottom - health.h) <= 1, JSON.stringify(health));
  await back();
  s = await state(); check('Back closes the health panel', s.studio && !s.sheets.length, JSON.stringify(s));

  // the Journal is a tab: it pulls out over the diorama and keeps the top bar and the tab bar
  await tab('Journal'); await wait(1000);
  await shot('4c-journal');
  s = await state(); check('the Journal tab pulls the journal out over the diorama, keeping the tab bar', s.journal && s.tabbar && s.studio && !s.sheets.length, JSON.stringify(s));
  await pg.evaluate(() => [...document.querySelectorAll('[data-tour=journal] button')].find((b) => b.textContent.includes('European rabbit'))?.click()); await wait(900);
  await shot('4d-species');
  s = await state(); check('a discovered species opens its card over the journal', s.sheets.includes('European rabbit') && s.journal, JSON.stringify(s));
  check('the species card keeps a close button that can be tapped', await closeReachable());
  await back();
  s = await state(); check('Back closes just the species card', !s.sheets.length && s.journal, JSON.stringify(s));
  await tab('Explore'); await wait(700);
  s = await state(); check('another tab leaves the journal', !s.journal && s.studio, JSON.stringify(s));
  await tab('Journal'); await wait(900);
  await drag('.dd-tray', 320);
  s = await state(); check('dragging the journal down closes it', !s.journal && s.studio, JSON.stringify(s));
  await pg.click('[aria-label="More"]'); await wait(400);
  await pg.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.includes('Field journal'))?.click()); await wait(900);
  s = await state(); check('More → Field journal opens the same journal', s.journal && !s.sheets.length, JSON.stringify(s));
  await back();
  s = await state(); check('Back closes the journal and stays in the studio', !s.journal && s.studio, JSON.stringify(s));
  await pg.reload({ waitUntil: 'load' });
  await pg.waitForFunction('window.__loaded === true', null, { timeout: 240000 }); await wait(1000);
  s = await state(); check('a reload reopens the diorama', s.studio && /#open=/.test(s.url), JSON.stringify(s));
  await back(); await wait(1500);
  s = await state(); check('Back leaves the studio for the home screen', s.home && s.url === '/', JSON.stringify(s));

  await pg.evaluate(() => document.querySelector('[aria-label^="Continue "]')?.click());
  await pg.waitForFunction('window.__loaded === true', null, { timeout: 240000 }); await wait(1000);
  await pg.click('[aria-label="Back to all dioramas"]'); await wait(2000);
  s = await state(); check('the back arrow returns home with a clean address', s.home && s.url === '/', JSON.stringify(s));
  await tab('My dioramas'); await wait(1200);
  await shot('5-my-dioramas');
  await pg.click('[aria-label="Settings"]'); await wait(500);
  await pg.keyboard.press('Escape'); await wait(500);
  s = await state(); check('Escape closes only the top-most layer', !!s.tray && !s.sheets.length, JSON.stringify(s));
  await pg.keyboard.press('Escape'); await wait(600);
  await back();
  check('Back on the bare home leaves the app (no dead entries)', (await pg.evaluate(() => location.href)) === 'about:blank');
  await browser.close();
  return errors;
}

try {
  await up();
  const errors = await run();
  console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors');
  console.log(failed.length ? `${failed.length} check(s) failed` : 'all checks passed');
} finally {
  vite.kill('SIGKILL');
}
process.exit(failed.length ? 1 : 0);
