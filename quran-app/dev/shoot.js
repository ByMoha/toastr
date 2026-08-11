const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 852, height: 1796 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:8137/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const vp = await page.$('#viewport');

  async function shot(name) { await vp.screenshot({ path: 'work/out-' + name + '.png' }); }

  // screen 1 — default
  await shot('1');

  // screen 4 — floating menu
  await page.evaluate(() => window.__quran.setFabVisible(true));
  await page.waitForTimeout(350);
  await shot('4');

  // screen 5 — menu expanded
  await page.evaluate(() => window.__quran.openMenu());
  await page.waitForTimeout(450);
  await shot('5');

  // reset
  await page.evaluate(() => { window.__quran.closeMenu(); window.__quran.setFabVisible(false); });
  await page.waitForTimeout(300);

  // screen 2 — long-press highlight (before sheet)
  await page.evaluate(() => window.__quran.selectAyah('duha-3'));
  await page.waitForTimeout(120);
  await shot('2');

  // screen 3 — bottom sheet
  await page.waitForTimeout(500);
  await shot('3');

  await browser.close();
  console.log('done');
})();
