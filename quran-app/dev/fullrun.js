// Full live run of the app: self-hosted server + real pointer-event walkthrough.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.css': 'text/css', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f === '/') f = '/index.html';
  fs.readFile(path.join(ROOT, f), (e, data) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(8141, async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 852, height: 1796 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push('' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text()); });

  await p.goto('http://127.0.0.1:8141/index.html', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.Data && window.Data.ready, { timeout: 8000 });
  await p.waitForTimeout(400);
  const vp = await p.$('#viewport');
  const box = await vp.boundingBox();
  const S = box.width / 804; // stage scale
  const at = (x, y) => [box.x + x * S, box.y + y * S];
  const log = [];

  // 1 — default reading view
  await vp.screenshot({ path: 'work/run-1-default.png' });
  log.push('1 default view');

  // 2 — tap empty area -> floating menu button
  await p.mouse.click(...at(402, 690));
  await p.waitForTimeout(450);
  log.push('2 FAB visible: ' + await p.evaluate(() => document.getElementById('fabwrap').classList.contains('visible')));
  await vp.screenshot({ path: 'work/run-2-fab.png' });

  // 3 — tap the button -> expanded menu
  await p.mouse.click(...at(402, 1748 - 34 - 66));
  await p.waitForTimeout(550);
  log.push('3 menu open: ' + await p.evaluate(() => document.getElementById('fabwrap').dataset.open));
  await vp.screenshot({ path: 'work/run-3-menu.png' });

  // 4 — gear item -> switch calligraphy layer mode (overlay)
  await p.evaluate(() => document.querySelector('.fab-item[data-i="4"]').click());
  await p.waitForTimeout(550);
  log.push('4 overlay medallions: ' + await p.evaluate(() => document.querySelectorAll('#medLayer svg').length));
  await vp.screenshot({ path: 'work/run-4-warshmode.png' });

  // hide FAB again for a clean long-press demo
  await p.mouse.click(...at(402, 690));
  await p.waitForTimeout(350);

  // 5 — real long-press on 93:3 -> highlight
  await p.mouse.move(...at(197, 912));
  await p.mouse.down();
  await p.waitForTimeout(430);
  await vp.screenshot({ path: 'work/run-5-highlight.png' });
  log.push('5 overlay shown: ' + await p.evaluate(() => document.getElementById('overlay').classList.contains('show')));

  // 6 — release -> sheet with gharib
  await p.mouse.up();
  await p.waitForTimeout(550);
  const sheet = await p.evaluate(() => ({
    open: document.getElementById('sheet').classList.contains('show'),
    g: document.getElementById('sheetGharib').textContent.slice(0, 40)
  }));
  log.push('6 sheet: ' + JSON.stringify(sheet));
  await vp.screenshot({ path: 'work/run-6-sheet.png' });

  // 7 — tap bookmark -> saved state
  await p.evaluate(() => document.getElementById('actBookmark').click());
  await p.waitForTimeout(300);
  log.push('7 bookmarked: ' + await p.evaluate(() => document.getElementById('actBookmark').classList.contains('saved')));
  await vp.screenshot({ path: 'work/run-7-bookmark.png' });

  // 8 — tap the dim -> everything dismissed, back to reading
  await p.mouse.click(...at(402, 300));
  await p.waitForTimeout(450);
  log.push('8 dismissed: ' + await p.evaluate(() =>
    !document.getElementById('sheet').classList.contains('show') &&
    !document.getElementById('overlay').classList.contains('show')));
  await vp.screenshot({ path: 'work/run-8-back.png' });

  console.log(log.join('\n'));
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  server.close();
  process.exit(0);
});
