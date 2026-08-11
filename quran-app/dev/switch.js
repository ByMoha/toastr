const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 852, height: 1796 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push('' + e.message));
  await p.goto('http://127.0.0.1:8137/index.html', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.Data && window.Data.ready, { timeout: 8000 });
  await p.waitForTimeout(400);
  const vp = await p.$('#viewport');
  await vp.screenshot({ path: 'work/sw-baked.png' });                 // default (baked)
  const med = await p.evaluate(() => document.querySelectorAll('#medLayer svg').length);
  await p.evaluate(() => window.__quran.setArt('overlay'));           // switch calligraphy mode
  await p.waitForTimeout(500);
  await vp.screenshot({ path: 'work/sw-overlay.png' });               // medallion-less + app aya-tags
  // and the highlight still works in overlay mode
  await p.evaluate(() => window.__quran.selectAyah('duha-7'));
  await p.waitForTimeout(600);
  await vp.screenshot({ path: 'work/sw-overlay-sheet.png' });
  console.log('medallions built:', med, '| errors:', errs.length ? errs : 'none');
  await b.close();
})();
