const puppeteer = require('puppeteer');

const ASSET_IDS = [
  'gastropod-spiral','gastropod-cowrie','gastropod-auger',
  'bivalve-scallop-cockle','bivalve-oyster-mussel','bivalve-razor-clam',
  'echinoderm-urchin-test','echinoderm-starfish','cephalopod-remnants',
  'crustacean-carapace','elasmobranch-artifacts','marine-flora-sponges',
  'beach-glass-and-pottery','nautical-debris'
];

const LAUNCH_ARGS = [
  '--no-sandbox','--disable-setuid-sandbox',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist','--disable-gpu-sandbox'
];

async function newPage(browser, viewport) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', req => {
    const url = req.url();
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) req.abort();
    else req.continue();
  });
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));
  await page.setViewport(viewport);
  return page;
}

async function goto(page, opts = {}) {
  await page.goto('http://localhost:4173', { waitUntil: 'domcontentloaded', timeout: 15000, ...opts });
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: puppeteer.executablePath(),
    args: LAUNCH_ARGS,
    protocolTimeout: 60000
  });

  // Desktop overview
  {
    const page = await newPage(browser, { width: 1600, height: 950, deviceScaleFactor: 1 });
    await goto(page);
    await new Promise(r => setTimeout(r, 4500));
    await page.screenshot({ path: '/home/user/sandbox/audit-shots/00-overview-desktop.png' });
    console.log('shot: overview');

    const libBtn = await page.evaluateHandle(() =>
      [...document.querySelectorAll('button')].find(b => b.textContent.includes('Asset library')));
    if (libBtn.asElement()) { await libBtn.asElement().click(); await new Promise(r => setTimeout(r, 900)); }
    await page.screenshot({ path: '/home/user/sandbox/audit-shots/01-library.png', fullPage: true });
    console.log('shot: library');
    await page.close();
  }

  // Isolate each specimen using localStorage settings then reload
  for (const id of ASSET_IDS) {
    try {
      const page = await newPage(browser, { width: 1600, height: 950, deviceScaleFactor: 1 });
      await goto(page);
      await page.evaluate((assetId) => {
        localStorage.setItem('tideline-studio-v1', JSON.stringify({
          colorway: 'default', paramsByAsset: {}, selectedId: assetId,
          hiddenAssets: [], hiddenParts: {}, density: 1, wetness: 0.45, seed: 42,
          additionalAssets: [], sunlight: 52
        }));
      }, id);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(r => setTimeout(r, 3200));
      await page.keyboard.press('f');
      await new Promise(r => setTimeout(r, 1400));
      await page.screenshot({ path: `/home/user/sandbox/audit-shots/specimen-${id}.png` });
      console.log('shot: specimen', id);
      await page.close();
    } catch (e) {
      console.log('FAILED specimen', id, e.message);
    }
  }

  // Mobile viewport
  {
    const page = await newPage(browser, { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await goto(page);
    await new Promise(r => setTimeout(r, 3800));
    await page.screenshot({ path: '/home/user/sandbox/audit-shots/mobile-00-studio.png' });
    console.log('shot: mobile studio');

    const menuBtn = await page.$('.mobile-studio-actions button');
    if (menuBtn) { await menuBtn.click(); await new Promise(r => setTimeout(r, 700)); }
    await page.screenshot({ path: '/home/user/sandbox/audit-shots/mobile-01-collection.png' });
    console.log('shot: mobile collection');
    await page.close();
  }

  {
    const page = await newPage(browser, { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await goto(page);
    await new Promise(r => setTimeout(r, 3800));
    const buttons = await page.$$('.mobile-studio-actions button');
    if (buttons[1]) { await buttons[1].click(); await new Promise(r => setTimeout(r, 700)); }
    await page.screenshot({ path: '/home/user/sandbox/audit-shots/mobile-02-inspector.png' });
    console.log('shot: mobile inspector');
    await page.close();
  }

  {
    const page = await newPage(browser, { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await goto(page);
    await new Promise(r => setTimeout(r, 3200));
    const libBtn = await page.evaluateHandle(() =>
      [...document.querySelectorAll('button')].find(b => b.textContent.includes('Asset library')));
    if (libBtn.asElement()) { await libBtn.asElement().click(); await new Promise(r => setTimeout(r, 800)); }
    await page.screenshot({ path: '/home/user/sandbox/audit-shots/mobile-03-library.png', fullPage: true });
    console.log('shot: mobile library');
    await page.close();
  }

  await browser.close();
  console.log('DONE');
  process.exit(0);
})().catch(err => { console.error('FATAL', err); process.exit(1); });
