// Ranger training check (dev tool): on a fresh device, starts the first expedition, answers the
// welcome with "Show me around" and follows the first unit's lessons by doing what each step asks
// — turning and zooming the camera, adding a plant and a plant-eater, moving, turning and resizing
// one, undoing, discovering a species, opening the journal — checking that every step notices it.
// Then it opens the Learn hub, starts a lesson from a quest's "Show me how" and looks at the home
// screen's training card. Suites: `first` (the above), `tips` (declining the guided start: the
// empty-box and Build tips) and `more` (teacher mode, the Forest example: every other lesson,
// started from the hub and done for real — stamping, painting, sculpting, walking, coding, touring,
// roaming…). Runs on a phone and a desktop, saves screenshots, exits non-zero on failure.
//   node tools/learn-check.mjs --out shots/learn-check [--only phone|desktop] [--suite first,tips,more]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => { if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true]); return acc; }, []));
const PORT = Number(args.port ?? 5198);
const OUT = String(args.out ?? 'shots/learn-check');
fs.mkdirSync(OUT, { recursive: true });
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--clearScreen', 'false'], { stdio: ['ignore', 'pipe', 'pipe'] });
async function up() { for (let k = 0; k < 120; k++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) return; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 700)); } throw new Error('vite did not start'); }
const SUITES = String(args.suite ?? 'first,tips').split(',');
// a brand-new device: nothing saved, tips on (the default); `more` starts as a teacher who has seen the welcome
const initFor = (extra = '') => `try { if (!sessionStorage.getItem('dd-fresh')) { localStorage.clear(); sessionStorage.setItem('dd-fresh', '1'); localStorage.setItem('dd-settings', JSON.stringify({ quality: 'low', author: '', sound: false, ambience: false, tips: true })); ${extra} } } catch {}`;
const INIT = {
  first: initFor(),
  tips: initFor(),
  more: initFor(`localStorage.setItem('dd-profile', JSON.stringify({ name: 'Tester', avatar: '🦊', xp: 0, discovered: [], placed: [], badges: [], biomeStars: {}, projectStars: {}, biomesBuilt: [], completed: [], completedBiomes: [], unlockAll: true, created: 1 })); localStorage.setItem('dd-learn', JSON.stringify({ done: [], active: null, paused: null, welcomed: true, seen: ['tip-empty', 'tip-build', 'tip-code'] }));`),
};
const failed = [];
const check = (name, ok, detail = '') => { console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : detail); if (!ok) failed.push(name); return ok; };

async function run(layout, ctxOpts, phone, suite) {
  const name = `${layout}-${suite}`;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext(ctxOpts);
  await ctx.addInitScript(INIT[suite]);
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', (e) => { errors.push(String(e)); console.log('[pageerror]', String(e).slice(0, 300)); });
  const wait = (ms) => pg.waitForTimeout(ms);
  const shot = (n) => pg.screenshot({ path: path.join(OUT, `${name}-${n}.png`) });
  const T = (name) => `[data-tour="${name}"]`;
  const cdp = await ctx.newCDPSession(pg);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  /** what the lesson card says */
  const coach = () => pg.evaluate(() => {
    const c = document.querySelector('.dd-coach-card');
    if (!c) return null;
    const ring = document.querySelector('.dd-coach-ring');
    return { lesson: c.dataset.lesson ?? null, step: c.dataset.step ?? null, phase: c.dataset.phase ?? null, aim: c.dataset.aim ?? '', tip: c.dataset.tip ?? null, ring: ring ? ring.style.opacity === '1' : false, text: c.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) };
  });
  /** wait until the coach reaches a lesson's step (or any step of it with null) */
  const until = async (lesson, step, ms = 90000) => {
    const t0 = Date.now();
    let c = null;
    while (Date.now() - t0 < ms) {
      c = await coach();
      // (a moment for the card to find and point at its control)
      if (c && c.lesson === lesson && (step === null || c.step === step)) { await wait(400); return (await coach()) ?? c; }
      await wait(250);
    }
    return c;
  };
  const clickTour = async (t) => {
    const ok = await pg.evaluate((sel) => { const el = [...document.querySelectorAll(sel)].find((x) => x.getBoundingClientRect().width > 0); if (!el) return false; el.click(); return true; }, T(t));
    await wait(350);
    return ok;
  };
  const clickText = async (sel, text) => {
    const ok = await pg.evaluate(([s, t]) => { const el = [...document.querySelectorAll(s)].find((b) => b.textContent.includes(t)); if (!el) return false; el.click(); return true; }, [sel, text]);
    await wait(350);
    return ok;
  };
  const nextBtn = async () => (await clickText('.dd-coach-card button', 'Next')) || clickText('.dd-coach-card button', 'Finish');
  const centre = (t) => pg.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, top: r.top }; }, T(t));
  /** where an actor (the selected one, or a living one) is on screen */
  const actorAt = (which = 'selected') => pg.evaluate((w) => {
    const e = window.__engine;
    const a = w === 'selected' ? e.getActor(e.selectedId) : e.actorList.find((x) => !x.isClone && x.def.living !== false && x.def.category !== 'habitats');
    if (!a) return null;
    const v = a.root.position.clone(); v.y += a.height * 0.4; v.project(e.camera);
    const r = e.renderer.domElement.getBoundingClientRect();
    return { id: a.id, x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
  }, which);
  const drag = async (x, y, dx, dy, steps = 14, button = 'left') => {
    if (phone) {
      await touch('touchStart', [{ x, y }]);
      for (let k = 1; k <= steps; k++) { await touch('touchMove', [{ x: x + (dx * k) / steps, y: y + (dy * k) / steps }]); await wait(20); }
      await touch('touchEnd', []);
    } else {
      await pg.mouse.move(x, y);
      await pg.mouse.down({ button });
      for (let k = 1; k <= steps; k++) { await pg.mouse.move(x + (dx * k) / steps, y + (dy * k) / steps); await wait(20); }
      await pg.mouse.up({ button });
    }
    await wait(500);
  };
  const tap = async (x, y) => { if (phone) await pg.touchscreen.tap(x, y); else await pg.mouse.click(x, y); await wait(600); };
  /** the coach points the way there (👉 …): follow it, as a student would */
  const followWay = async () => {
    for (let k = 0; k < 3; k++) {
      const c = await coach();
      // only buttons and tabs can be followed by a click; areas (the 3D view, a panel) need the step's own action
      if (!c?.text.includes('👉') || !c.aim || !/^(tab-|sheet-|inv-cat-|landtab-|stamp-|sculpt-|insp-|explore-|open-|land-section|learn$|health$|quests-link|code-ideas-btn|xp$)/.test(c.aim)) return c;
      console.log('     following the way there:', c.aim);
      // (a folded section opens from its summary)
      const folded = await pg.evaluate((sel) => { const d = document.querySelector(sel); if (d?.tagName === 'DETAILS') { d.querySelector('summary')?.click(); return true; } return false; }, T(c.aim));
      if (!folded) await clickTour(c.aim);
      await wait(700);
    }
    return coach();
  };
  /** a step should be under way, then done once we act */
  const step = async (lesson, id, act, label) => {
    const c = await until(lesson, id, 60000);
    if (!check(`${label}: the step shows`, c?.step === id, JSON.stringify(c))) return false;
    await act(c);
    const t0 = Date.now();
    let d = await coach();
    while (Date.now() - t0 < 60000 && d?.lesson === lesson && d.step === id && d.phase !== 'done') { await wait(200); d = await coach(); }
    return check(`${label}: noticed`, !d || d.lesson !== lesson || d.step !== id || d.phase === 'done', JSON.stringify(d));
  };
  const finish = async (label) => {
    await pg.waitForSelector('#dd-lesson-done', { timeout: 30000 }).catch(() => {});
    const ok = await pg.evaluate(() => !!document.querySelector('#dd-lesson-done'));
    check(`${label}: lesson complete`, ok);
    return ok;
  };
  const studio = async (hash) => {
    await pg.goto(`http://localhost:${PORT}/${hash}`, { waitUntil: 'load' });
    await pg.waitForFunction('window.__loaded === true', null, { timeout: 240000 });
    await wait(1500);
  };

  if (suite === 'tips') {
    /* ---------------- declining the guided start: the tips still help ---------------- */
    await pg.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
    await wait(2000);
    await clickText('button', 'Start your first expedition'); await wait(900);
    await pg.evaluate(() => [...document.querySelectorAll('.dd-tray button')].find((b) => b.textContent.includes('Prairie'))?.click()); await wait(900);
    await clickText('button', 'Start expedition');
    await pg.waitForFunction('window.__loaded === true', null, { timeout: 240000 });
    await wait(1500);
    await clickText('button', 'explore on my own');
    await pg.waitForSelector('.dd-coach-card[data-tip="tip-empty"]', { timeout: 15000 }).catch(() => {});
    let c = await coach();
    check('an empty box suggests Build', c?.tip === 'tip-empty' && c.aim === 'tab-build', JSON.stringify(c));
    await shot('01-tip-empty');
    await clickTour('tab-build');
    await pg.waitForSelector('.dd-coach-card[data-tip="tip-build"]', { timeout: 15000 }).catch(() => {});
    c = await coach();
    check('Build explains itself the first time', c?.tip === 'tip-build', JSON.stringify(c));
    await shot('02-tip-build');
    await clickText('.dd-coach-card button', 'Show me how');
    c = await until('add', null, 10000);
    check('“Show me how” starts the lesson', c?.lesson === 'add', JSON.stringify(c));
    await pg.evaluate(() => document.querySelector('.dd-coach-card [aria-label="Pause the lesson"]')?.click()); await wait(600);
    await clickTour('tab-explore'); await wait(2500);
    check('tips show only once', !(await coach()), JSON.stringify(await coach()));
    check('no page errors', errors.length === 0, errors.join('\n'));
    await browser.close();
    return;
  }

  if (suite === 'more') {
    /* ---------------- every other lesson, in a full diorama, as a teacher ---------------- */
    await studio('#new=forest&model=1');
    const pressedIn = (tour, text) => pg.evaluate(([t, x]) => { const b = [...document.querySelectorAll(`[data-tour="${t}"] button`)].find((e) => e.textContent.includes(x) || e.title === x); b?.click(); return !!b; }, [tour, text]);
    const setRange = (tour, i, v) => pg.evaluate(([t, k, val]) => {
      const el = document.querySelectorAll(`[data-tour="${t}"] input[type=range]`)[k];
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(val));
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, [tour, i, v]);
    const shownT = (t) => pg.evaluate((sel) => [...document.querySelectorAll(sel)].some((e) => e.getBoundingClientRect().width > 0), T(t));
    /** the middle of the 3D view (clear of the lesson card) */
    const land = async () => {
      // (the lesson card may be sliding to a new place after the last click: let it settle first)
      await wait(700);
      const v = await centre('viewport');
      const card = await pg.evaluate(() => { const r = document.querySelector('.dd-coach-card')?.getBoundingClientRect(); return r ? { top: r.top, bottom: r.bottom } : null; });
      let y = v.top + v.h * 0.55;
      if (card && y > card.top - 30 && y < card.bottom + 30) y = card.top > v.top + v.h / 2 ? card.top - 60 : card.bottom + 60;
      return { x: v.x, y };
    };
    const tapLand = async () => { const p = await land(); await tap(p.x, p.y); };
    const dragLand = async (dx = 120, dy = 40) => { const p = await land(); await drag(p.x - dx / 2, p.y - dy / 2, dx, dy, 16); };
    const holdLand = async (ms = 1200) => {
      const p = await land();
      if (phone) { await touch('touchStart', [{ x: p.x, y: p.y }]); await wait(ms); await touch('touchEnd', []); }
      else { await pg.mouse.move(p.x, p.y); await pg.mouse.down(); await wait(ms); await pg.mouse.up(); }
      await wait(500);
    };
    const tapLiving = async () => {
      await pg.evaluate(() => { const e = window.__engine; const a = e.actorList.find((x) => !x.isClone && x.def.category === 'animals' && x.def.loco === 'walk'); if (a) e.focusActor(a.id, 0.01); });
      await wait(1200);
      const a = await pg.evaluate(() => {
        const e = window.__engine; const a = e.actorList.find((x) => !x.isClone && x.def.category === 'animals' && x.def.loco === 'walk');
        const v = a.root.position.clone(); v.y += a.height * 0.5; v.project(e.camera);
        const r = e.renderer.domElement.getBoundingClientRect();
        return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
      });
      await tap(a.x, a.y);
    };
    const pickTile = async (cat, role, prefer) => {
      await clickTour(`inv-cat-${cat}`); await wait(400);
      return pg.evaluate(([c, r, p]) => {
        const tiles = [...document.querySelectorAll(`[data-tour="inv-grid-${c}"] button`)].filter((b) => new RegExp(r).test(b.title));
        const t = tiles.find((b) => new RegExp(p, 'i').test(b.title)) ?? tiles[0];
        t?.click();
        return t?.title ?? null;
      }, [cat, role, prefer]);
    };
    /** walk forward (the stick, or W — with Shift to run) until the step notices, or `ms` at most */
    const walkFor = async (ms, run = false) => {
      const step0 = (await coach())?.step;
      const until = async () => { const t0 = Date.now(); while (Date.now() - t0 < ms) { await wait(300); const c = await coach(); if (!c || c.step !== step0 || c.phase === 'done') return; } };
      if (phone) {
        const r = await pg.evaluate((sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height * 0.6 }; }, T('walk-stick'));
        await touch('touchStart', [{ x: r.x, y: r.y }]);
        for (let k = 1; k <= 6; k++) { await touch('touchMove', [{ x: r.x, y: r.y - k * (run ? 12 : 7) }]); await wait(20); }
        await until();
        await touch('touchEnd', []);
      } else {
        if (run) await pg.keyboard.down('Shift');
        await pg.keyboard.down('w'); await until(); await pg.keyboard.up('w');
        if (run) await pg.keyboard.up('Shift');
      }
      await wait(400);
    };
    const ACTS = {
      health: { open: () => clickTour('health'), predator: () => pickTile('animals', 'Secondary consumer|Top predator', 'fox|weasel|stoat|owl|toad'), decomposer: () => pickTile('fungi', 'Decomposer', 'chanterelle|puffball|oyster|cap') },
      foodweb: {
        open: () => clickTour('explore-web'),
        // an organism (not sunlight or dead matter): one whose details offer "What if…?"
        pick: async () => {
          const n = await pg.evaluate(() => document.querySelectorAll('[data-tour="foodweb-diagram"] g.cursor-pointer').length);
          for (let i = 0; i < n; i++) {
            await pg.evaluate((k) => document.querySelectorAll('[data-tour="foodweb-diagram"] g.cursor-pointer')[k]?.dispatchEvent(new MouseEvent('click', { bubbles: true })), i);
            await wait(250);
            if (await shownT('web-whatif')) return;
          }
        },
        whatif: () => clickTour('web-whatif'),
      },
      quests: { open: () => clickTour('quests-link'), name: async () => { await pg.keyboard.press('Escape'); await wait(400); await pg.click(T('title'), { clickCount: 3 }); await pg.keyboard.type('Our forest'); await pg.keyboard.press('Enter'); } },
      landforms: { pick: () => clickTour('stamp-hill'), stamp: tapLand, top: () => clickTour('top-view'), back: () => clickTour('top-view') },
      paint: { open: () => clickTour('landtab-paint'), brush: () => dragLand(), water: async () => { await clickTour('landtab-landforms'); await clickTour('stamp-lake'); await tapLand(); } },
      labels: { select: tapLiving, tab: () => clickTour('insp-label'), label: async () => { await pg.fill(T('label-text'), 'Consumer: eats plants'); }, notes: async () => { await pg.fill(T('notes'), 'It hides in the bracken during the day.'); await pg.keyboard.press('Tab'); } },
      time: { open: () => clickTour('explore-time'), night: () => pressedIn('time-pop', '🌙'), cycle: () => setRange('time-pop', 1, 4) },
      walk: { enter: () => clickTour('explore-walk'), move: () => walkFor(20000), ant: () => pressedIn('walk-eyes', 'Ant'), leave: () => clickTour('walk-leave') },
      code: {
        mode: () => clickTour('tab-code'),
        who: () => pg.evaluate(() => { const names = window.__engine.actorList.filter((a) => !a.isClone && a.def.category === 'animals').map((a) => a.name); [...document.querySelectorAll('[data-tour="code-targets"] button')].find((x) => names.some((n) => x.textContent.trim().endsWith(n)))?.click(); }),
        blocks: async () => { if (!(await shownT('code-ideas'))) await clickTour('code-ideas-btn'); await wait(400); await pg.evaluate(() => document.querySelector('[data-tour="code-ideas"] button')?.click()); },
        play: () => clickTour('play'), stop: () => clickTour('play'),
      },
      weather: { open: () => clickTour('explore-weather'), rain: () => pressedIn('weather-pop', '🌧️'), wind: () => setRange('weather-pop', 0, 0.95) },
      sculpt: { open: () => clickTour('landtab-sculpt'), raise: async () => { await clickTour('sculpt-raise'); await holdLand(); }, dig: async () => { await clickTour('sculpt-lower'); await dragLand(); }, smooth: async () => { await clickTour('sculpt-smooth'); await dragLand(); } },
      tour: { start: () => clickTour('explore-tour'), watch: async () => { for (let k = 0; k < 40; k++) { const end = await pg.evaluate(() => { const b = [...document.querySelectorAll('[data-tour="tour-panel"] button')].find((x) => x.textContent.includes('Next')); if (!b || b.disabled) return true; b.click(); return false; }); if (end) break; await wait(250); } }, end: () => clickTour('tour-end') },
      seasons: { open: () => clickTour('explore-weather'), season: () => pressedIn('season-pick', '🍂') },
      area: { open: () => clickTour('landtab-area'), select: () => dragLand(160, 90), go: () => clickTour('area-generate') },
      roam: { start: () => clickTour('explore-roam'), out: () => walkFor(40000, true), home: () => clickTour('walk-home'), leave: () => clickTour('walk-leave') },
    };
    const order = String(args.lessons ?? 'health,foodweb,quests,landforms,paint,labels,time,walk,code,weather,sculpt,tour,seasons,area,roam').split(',');
    for (const id of order) {
      const t0 = Date.now();
      // start it from the hub, as a student would
      await pg.keyboard.press('Escape'); await wait(300);
      await clickTour('learn'); await wait(700);
      const started = await pg.evaluate((l) => { const b = document.querySelector(`button[data-lesson="${l}"]`); b?.click(); return !!b; }, id);
      if (!check(`${id}: starts from the hub`, started)) continue;
      await wait(700);
      let lastStep = null, guard = 0;
      while (guard++ < 12) {
        await wait(300);
        const done = await pg.evaluate(() => !!document.querySelector('#dd-lesson-done'));
        if (done) break;
        let c = await coach();
        if (!c || c.lesson !== id) { await wait(600); c = await coach(); if (!c || c.lesson !== id) break; }
        if (c.phase === 'blocked') { check(`${id}: not blocked`, false, c.text); break; }
        if (c.step === lastStep && c.phase !== 'done') { await wait(400); }
        lastStep = c.step;
        if (c.phase === 'done') { await wait(400); continue; }
        if (c.phase === 'pre' || c.phase === 'info') { await nextBtn(); continue; }
        c = await followWay();
        if (!c || c.lesson !== id) continue;
        const act = ACTS[id]?.[c.step];
        if (act) await act();
        // the step should notice within a while
        const s0 = Date.now();
        let d = await coach();
        while (Date.now() - s0 < 45000 && d?.lesson === id && d.step === c.step && d.phase !== 'done') { await wait(250); d = await coach(); }
        if (!check(`${id}/${c.step}: noticed`, !d || d.lesson !== id || d.step !== c.step || d.phase === 'done', JSON.stringify(d))) { await shot(`stuck-${id}-${c.step}`); break; }
      }
      if (await finish(`${id}`)) { console.log(`     ${id}: ${Math.round((Date.now() - t0) / 1000)} s`); await clickText('[role=dialog] button', 'Later'); }
      await wait(400);
      // leave things tidy for the next lesson
      await pg.evaluate(() => { const e = window.__engine; e.walk?.exit(); e.setLandTool(null); if (e.topView) e.setTopView(false); });
      await pg.keyboard.press('Escape'); await wait(300);
    }
    check('no page errors', errors.length === 0, errors.join('\n'));
    await browser.close();
    return;
  }

  /* ---------------- home: a first visit ---------------- */
  await pg.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await wait(2500);
  await shot('01-home');
  check('home explains how it works', await pg.evaluate(() => document.body.textContent.includes('How it works')));
  check('home shows Ranger training', await pg.evaluate(() => !!document.querySelector('[aria-label="Ranger training: lessons and help"]')));

  /* ---------------- first expedition → welcome ---------------- */
  await clickText('button', 'Start your first expedition');
  await wait(900);
  await pg.evaluate(() => [...document.querySelectorAll('.dd-tray button')].find((b) => b.textContent.includes('Backyard'))?.click());
  await wait(900);
  await clickText('button', 'Start expedition');
  await pg.waitForFunction('window.__loaded === true', null, { timeout: 240000 });
  await wait(1500);
  check('the welcome offers a guided start', await pg.evaluate(() => !!document.querySelector('#dd-welcome-title')));
  await wait(2500); // let the First Steps banner play
  await shot('02-welcome');
  await clickText('button', 'Show me around');

  /* ---------------- Meet your studio (read, then Next) ---------------- */
  for (const id of ['box', 'modes', 'health', 'quests', 'learn']) {
    const c = await until('studio', id, 20000);
    check(`studio/${id} shows`, c?.step === id, JSON.stringify(c));
    if (id !== 'box') check(`studio/${id} points at its control`, !!c?.ring, JSON.stringify(c));
    if (id === 'modes') await shot('03-studio-modes');
    await nextBtn();
  }
  if (await finish('Meet your studio')) { await shot('04-lesson-done'); await clickText('[role=dialog] button', 'Next:'); }

  /* ---------------- Look around ---------------- */
  const vp = await centre('viewport');
  await step('camera', 'orbit', async () => { await shot('05-camera-orbit'); await drag(vp.x - 60, vp.top + vp.h * 0.62, 180, 0); }, 'camera/orbit');
  await step('camera', 'zoom', async () => {
    if (!phone) { await pg.mouse.move(vp.x, vp.top + vp.h * 0.6); for (let k = 0; k < 6; k++) { await pg.mouse.wheel(0, -240); await wait(120); } return; }
    // two fingers pinching apart
    const x = vp.x, y = vp.top + vp.h * 0.62;
    await touch('touchStart', [{ x: x - 30, y, id: 0 }, { x: x + 30, y, id: 1 }]);
    for (let k = 1; k <= 12; k++) { await touch('touchMove', [{ x: x - 30 - k * 9, y, id: 0 }, { x: x + 30 + k * 9, y, id: 1 }]); await wait(25); }
    await touch('touchEnd', []);
    await wait(800);
    // (if the browser did not pass the pinch on, zoom the camera the way the pinch would)
    const c = await coach();
    if (c?.step === 'zoom' && c.phase !== 'done') { console.log('     (synthetic pinch not delivered: zooming the camera directly)'); await pg.evaluate(async () => { const e = window.__engine; for (let k = 0; k < 20; k++) { e.camera.position.lerp(e.controls.target, 0.03); await new Promise((r) => requestAnimationFrame(r)); } }); }
  }, 'camera/zoom');
  await step('camera', 'pan', async () => {
    if (!phone) { await drag(vp.x, vp.top + vp.h * 0.6, 160, 40, 14, 'right'); return; }
    const x = vp.x, y = vp.top + vp.h * 0.62;
    await touch('touchStart', [{ x: x - 30, y, id: 0 }, { x: x + 30, y, id: 1 }]);
    for (let k = 1; k <= 12; k++) { await touch('touchMove', [{ x: x - 30 + k * 12, y: y + k * 3, id: 0 }, { x: x + 30 + k * 12, y: y + k * 3, id: 1 }]); await wait(25); }
    await touch('touchEnd', []);
    await wait(800);
    const c = await coach();
    if (c?.step === 'pan' && c.phase !== 'done') { console.log('     (synthetic two-finger drag not delivered: sliding the camera directly)'); await pg.evaluate(async () => { const e = window.__engine; for (let k = 0; k < 20; k++) { e.camera.position.x += 0.15; e.controls.target.x += 0.15; await new Promise((r) => requestAnimationFrame(r)); } }); }
  }, 'camera/pan');
  await step('camera', 'overview', async () => { await clickTour('explore-home'); }, 'camera/overview');
  if (await finish('Look around')) await clickText('[role=dialog] button', 'Next:');

  /* ---------------- Bring it to life ---------------- */
  await step('add', 'build', async (c) => { check('add/build points at the Build tab', c.aim === 'tab-build', JSON.stringify(c)); await clickTour('tab-build'); }, 'add/build');
  {
    const c = await until('add', 'open', 20000);
    check('add/open: the inventory is already showing (read, then Next)', c?.phase === 'pre', JSON.stringify(c));
    await nextBtn();
  }
  await step('add', 'plant', async () => {
    await clickTour('inv-cat-plants');
    await wait(500);
    await shot('06-add-plant');
    const picked = await pg.evaluate(() => {
      const tiles = [...document.querySelectorAll('[data-tour="inv-grid-plants"] button[title*="Producer"]')];
      const t = tiles.find((b) => /clover|daisy|dandelion|grass|moss|fern|violet/i.test(b.title)) ?? tiles[0];
      t?.click();
      return t?.title ?? null;
    });
    console.log('     plant:', picked);
  }, 'add/plant');
  await step('add', 'eater', async () => {
    await clickTour('inv-cat-animals');
    await wait(500);
    const picked = await pg.evaluate(() => {
      const tiles = [...document.querySelectorAll('[data-tour="inv-grid-animals"] button[title*="Primary consumer"]')];
      const t = tiles.find((b) => /rabbit|cottontail|snail|squirrel|chipmunk/i.test(b.title)) ?? tiles[0];
      t?.click();
      return t?.title ?? null;
    });
    console.log('     plant-eater:', picked);
  }, 'add/eater');
  if (await finish('Bring it to life')) { await shot('07-add-done'); await clickText('[role=dialog] button', 'Next:'); }

  /* ---------------- Move, turn & resize ---------------- */
  {
    const c = await until('edit', 'select', 20000);
    check('edit/select: the new animal is already selected (read, then Next)', c?.phase === 'pre', JSON.stringify(c));
    await nextBtn();
  }
  await step('edit', 'move', async () => {
    await wait(800);
    const a = await actorAt('selected');
    await shot('08-edit-move');
    if (a) await drag(a.x, a.y, phone ? 50 : 110, phone ? 20 : 40, 16);
  }, 'edit/move');
  await step('edit', 'turn', async () => { await shot('09-edit-turn'); const c = await followWay(); check('edit/turn points at ↻', c?.aim === 'ctx-turn', JSON.stringify(c)); await clickTour('ctx-turn'); }, 'edit/turn');
  await step('edit', 'size', async () => { await followWay(); await clickTour('ctx-bigger'); }, 'edit/size');
  await step('edit', 'undo', async () => { await clickTour('undo'); }, 'edit/undo');
  if (await finish('Move, turn & resize')) await clickText('[role=dialog] button', 'Next:');

  /* ---------------- Discover species ---------------- */
  await step('discover', 'explore', async () => { await clickTour('tab-explore'); }, 'discover/explore');
  await step('discover', 'tap', async () => {
    await wait(1200);
    await shot('10-discover-tap');
    await pg.evaluate(() => { const e = window.__engine; const a = e.actorList.find((x) => !x.isClone && x.def.category === 'animals'); if (a) e.focusActor(a.id, 0.01); });
    await wait(1500);
    const a = await pg.evaluate(() => {
      const e = window.__engine; const a = e.actorList.find((x) => !x.isClone && x.def.category === 'animals');
      const v = a.root.position.clone(); v.y += a.height * 0.5; v.project(e.camera);
      const r = e.renderer.domElement.getBoundingClientRect();
      return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
    });
    await tap(a.x, a.y);
  }, 'discover/tap');
  {
    const c = await until('discover', 'card', 20000);
    check('discover/card points at the field card', !!c?.ring, JSON.stringify(c));
    await shot('11-discover-card');
    await nextBtn();
  }
  await step('discover', 'journal', async (c) => { console.log('     journal via', c.aim); await clickTour(c.aim || (phone ? 'tab-journal' : 'explore-journal')); }, 'discover/journal');
  if (await finish('Discover species')) {
    await shot('12-unit-done');
    check('the next lesson offered is Ecosystem health', await pg.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].some((b) => b.textContent.includes('Ecosystem health'))));
    await clickText('[role=dialog] button', 'Later');
  }
  const learn = await pg.evaluate(() => JSON.parse(localStorage.getItem('dd-learn') || '{}'));
  check('five lessons are recorded as done', ['studio', 'camera', 'add', 'edit', 'discover'].every((id) => learn.done?.includes(id)), JSON.stringify(learn.done));
  // close the journal the last step opened
  await pg.keyboard.press('Escape'); await wait(500);
  await pg.evaluate(() => document.querySelector('[role=dialog][aria-modal=true] [aria-label="Close"]')?.click()); await wait(500);

  /* ---------------- the Learn hub ---------------- */
  await clickTour('learn');
  await wait(900);
  await shot('13-hub');
  const hub = await pg.evaluate(() => ({ cards: document.querySelectorAll('button[data-lesson]').length, done: document.querySelectorAll('button[data-lesson][aria-label$="(done)"]').length, locked: document.querySelectorAll('button[data-lesson][aria-label$="(locked)"]').length }));
  check('the hub lists every lesson', hub.cards === 20, JSON.stringify(hub));
  check('the hub marks the five done', hub.done === 5, JSON.stringify(hub));
  check('the hub shows lessons still locked on the ranger path', hub.locked > 0, JSON.stringify(hub));
  await clickText('[role=tab]', 'How do I');
  await pg.fill('input[aria-label="Search help"]', 'water');
  await wait(500);
  await shot('14-hub-help');
  check('“How do I…?” finds answers', await pg.evaluate(() => [...document.querySelectorAll('details[open] summary')].some((s) => /water/i.test(s.textContent))));
  await pg.keyboard.press('Escape'); await wait(600);

  /* ---------------- a quest's "Show me how" ---------------- */
  await clickTour('quests-link');
  await wait(900);
  const learnBtn = await pg.evaluate(() => [...document.querySelectorAll('[data-tour^="quest-learn-"]')].map((b) => b.dataset.tour));
  check('quests offer "Show me how"', learnBtn.length > 0, JSON.stringify(learnBtn));
  if (learnBtn.length) {
    await clickTour(learnBtn[0]);
    await wait(1200);
    const c = await coach();
    check(`"Show me how" starts a lesson (${learnBtn[0]})`, !!c?.lesson, JSON.stringify(c));
    await shot('15-quest-lesson');
    await pg.evaluate(() => document.querySelector('.dd-coach-card [aria-label="Pause the lesson"]')?.click());
    await wait(500);
    check('✕ pauses the lesson', !(await coach()), '');
  }

  /* ---------------- back home ---------------- */
  await pg.click('[aria-label="Back to all dioramas"]');
  await wait(2500);
  await shot('16-home-after');
  check('home shows lesson progress', await pg.evaluate(() => document.body.textContent.includes('5/20 lessons')));
  check('no page errors', errors.length === 0, errors.join('\n'));
  await browser.close();
}

try {
  await up();
  for (const suite of SUITES) {
    if (args.only !== 'desktop') await run('phone', { ...devices['iPhone 13'], deviceScaleFactor: 1 }, true, suite);
    if (args.only !== 'phone') await run('desktop', { viewport: { width: 1440, height: 900 } }, false, suite);
  }
  console.log(failed.length ? `${failed.length} check(s) failed:\n  ${failed.join('\n  ')}` : 'all checks passed');
} finally {
  vite.kill('SIGKILL');
}
process.exit(failed.length ? 1 : 0);
