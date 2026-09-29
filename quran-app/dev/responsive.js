const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  // desktop: phone should be centered in a dark frame
  const d = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
  await d.goto('http://127.0.0.1:8137/index.html', { waitUntil: 'networkidle' });
  await d.waitForTimeout(300);
  await d.screenshot({ path: 'work/resp-desktop.png' });
  await d.close();
  // mobile: full-bleed
  const m = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 1, isMobile: true });
  await m.goto('http://127.0.0.1:8137/index.html', { waitUntil: 'networkidle' });
  await m.waitForTimeout(300);
  await m.screenshot({ path: 'work/resp-mobile.png' });
  await m.close();
  await browser.close();
  console.log('resp done');
})();
