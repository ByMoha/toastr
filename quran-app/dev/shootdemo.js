const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 804, height: 1748 }, deviceScaleFactor: 1 });
  await p.goto('http://127.0.0.1:8137/dev/medallion-demo.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  const n = await p.evaluate(() => document.querySelectorAll('.medallion-layer svg').length);
  console.log('overlay medallions rendered:', n);
  await p.screenshot({ path: 'work/med-demo.png' });
  await b.close();
})();
