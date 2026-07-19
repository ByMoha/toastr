const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 852, height: 1796 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:8137/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const vp = await page.$('#viewport');

  // stage offset inside viewport (centered in 852x1796, stage 804x1748 at scale 1)
  const ox = (852 - 804) / 2, oy = (1796 - 1748) / 2;
  const V3 = { x: ox + 17 + 180, y: oy + 866 + 46 };   // verse 3 centre

  // ---- real long-press on verse 3 ----
  await page.mouse.move(V3.x, V3.y);
  await page.mouse.down();
  await page.waitForTimeout(430);                        // hold -> highlight
  await vp.screenshot({ path: 'work/it-2.png' });
  await page.waitForTimeout(320);                        // sheet auto-appears
  await vp.screenshot({ path: 'work/it-3.png' });
  await page.mouse.up();

  // ---- tap bookmark (should turn gold) ----
  const BM = { x: ox + 804 - 22 - 186, y: oy + 1748 - 300 };
  // dismiss + reopen to a stable place instead; just tap outside to close
  await page.mouse.click(ox + 402, oy + 300);            // tap dim -> close
  await page.waitForTimeout(400);
  await vp.screenshot({ path: 'work/it-closed.png' });

  // ---- tap empty area toggles the floating menu (screen 4) ----
  await page.mouse.click(ox + 402, oy + 700);
  await page.waitForTimeout(400);
  await vp.screenshot({ path: 'work/it-4.png' });

  // ---- click FAB to expand (screen 5) ----
  await page.mouse.click(ox + 402, oy + 1748 - 34 - 66);
  await page.waitForTimeout(500);
  await vp.screenshot({ path: 'work/it-5.png' });

  await browser.close();
  console.log('itest done');
})();
