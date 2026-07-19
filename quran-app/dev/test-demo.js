// Verify the single-file demo (work/demo.html) with real interactions, offline.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 852, height: 1796 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push('' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text()); });
  p.on('requestfailed', r => { if (!r.url().startsWith('data:')) errs.push('reqfail:' + r.url().slice(0, 80)); });

  await p.goto('file://' + path.resolve(__dirname, '../work/demo.html'));
  await p.waitForFunction(() => window.Data && window.Data.ready, { timeout: 8000 });
  await p.waitForTimeout(500);
  const vp = await p.$('#viewport');
  await vp.screenshot({ path: 'work/demo-1.png' });

  // real long-press on verse 93:3
  const box = await vp.boundingBox();
  const scale = box.width / 804;
  await p.mouse.move(box.x + (17 + 180) * scale, box.y + (866 + 46) * scale);
  await p.mouse.down();
  await p.waitForTimeout(450);
  await p.mouse.up();
  await p.waitForTimeout(500);
  const sheet = await p.evaluate(() => ({
    open: document.getElementById('sheet').classList.contains('show'),
    gharib: document.getElementById('sheetGharib').textContent.slice(0, 60)
  }));
  await vp.screenshot({ path: 'work/demo-3.png' });

  // dismiss, then switch calligraphy mode
  await p.mouse.click(box.x + 400 * scale, box.y + 300 * scale);
  await p.waitForTimeout(400);
  await p.evaluate(() => window.__quran.setArt('overlay'));
  await p.waitForTimeout(500);
  const meds = await p.evaluate(() => document.querySelectorAll('#medLayer svg').length);
  await vp.screenshot({ path: 'work/demo-overlay.png' });

  console.log('sheet:', JSON.stringify(sheet));
  console.log('overlay medallions:', meds);
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
