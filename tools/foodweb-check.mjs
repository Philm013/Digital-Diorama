// Food-web accuracy check (dev tool): runs the relationship cases in tools/foodweb-cases.js and
// checks every habitat's example diorama for animals with nothing to eat.
//   node tools/foodweb-check.mjs
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PORT = 5194;
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
let ok = true;
try {
  for (let k = 0; ; k++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* wait */ } if (k > 150) throw new Error('vite did not start'); await new Promise((r) => setTimeout(r, 600)); }
  const browser = await chromium.launch();
  const pg = await browser.newPage();
  await pg.goto(`http://localhost:${PORT}/?harness=1&biome=blank&starter=1`);
  const out = await pg.evaluate(async () => {
    const fw = await import('/src/assets/foodweb.ts');
    const { getDef } = await import('/src/assets/catalog.ts');
    const { CASES } = await import('/tools/foodweb-cases.js');
    const { BIOMES } = await import('/src/biomes/templates.ts');
    const fails = [];
    for (const [a, b, want] of CASES) {
      const A = getDef(a), B = getDef(b);
      if (!A || !B) { fails.push(`missing ${!A ? a : b}`); continue; }
      const got = fw.feedsOn(A, B)?.kind ?? null;
      if (got !== want) fails.push(`${a} → ${b}: expected ${want}, got ${got}`);
    }
    const hungry = [];
    for (const bm of BIOMES) {
      const items = bm.placements.map((p, i) => ({ id: 'x' + i, def: getDef(p.asset), name: p.asset })).filter((x) => x.def);
      const web = fw.buildFoodWeb(items, { water: !!bm.terrain?.ponds || !!bm.terrain?.river || !!bm.base || bm.terrain?.waterLevel !== undefined });
      const h = web.nodes.filter((n) => n.hungry).map((n) => n.def.id);
      hungry.push(`${bm.id.padEnd(10)} species ${String(web.nodes.filter((n) => n.def).length).padStart(2)} · links ${String(web.edges.length).padStart(3)} · longest chain ${web.maxChain}${h.length ? ' · HUNGRY: ' + h.join(', ') : ''}${web.chains[0] ? '\n             ' + web.chains[0].map((id) => web.byId.get(id).name).join(' → ') : ''}`);
    }
    return { cases: CASES.length, fails, hungry };
  });
  console.log(`${out.cases - out.fails.length}/${out.cases} relationship cases pass`);
  for (const f of out.fails) console.log('FAIL', f);
  console.log(out.hungry.join('\n'));
  ok = out.fails.length === 0;
  await browser.close();
} finally { vite.kill('SIGKILL'); }
process.exit(ok ? 0 : 1);
