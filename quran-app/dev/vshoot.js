/* Verify the three decoration options render on the surah banner.
 * Loads the self-contained demo, screenshots the default page for each
 * data-orn value, plus the settings ornament chips. */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 804, height: 1748 }, deviceScaleFactor: 2 });
  const url = 'file://' + path.resolve(__dirname, '../work/demo.html');
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);

  // banner crop of page 596 (Duha / Sharh banners) for each option
  for (const orn of ['1', '2', '3']) {
    await p.evaluate((o) => {
      if (o === '1') delete document.body.dataset.orn; else document.body.dataset.orn = o;
    }, orn);
    await p.waitForTimeout(250);
    await p.screenshot({ path: `work/orn-${orn}-full.png` });
  }

  // settings panel with the three chips
  await p.evaluate(() => { delete document.body.dataset.orn; window.__quran.openSettings(); });
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'work/orn-settings.png' });

  await b.close();
  console.log('done: work/orn-{1,2,3}-full.png, work/orn-settings.png');
})();
