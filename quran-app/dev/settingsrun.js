// Verify: scaled-up page fill, banners, page number, settings page,
// riwāya switching and decoration color themes.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8' };

const server = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f === '/') f = '/index.html';
  fs.readFile(path.join(ROOT, f), (e, data) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(8144, async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 852, height: 1796 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push('' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text()); });
  p.on('requestfailed', r => errs.push('reqfail:' + r.url().slice(-60)));

  await p.goto('http://127.0.0.1:8144/index.html', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.Data && window.Data.ready, { timeout: 8000 });
  await p.waitForTimeout(800);
  const vp = await p.$('#viewport');

  // 1 — default is now the real Hafs page, scaled to fill, banners + page number
  console.log('banners:', await p.evaluate(() => document.querySelectorAll('.banner').length),
    '| pageNum:', await p.evaluate(() => document.getElementById('pageNum').textContent));
  await vp.screenshot({ path: 'work/st-1-default.png' });

  // 2 — highlight + sheet still aligned after the rescale
  await p.evaluate(() => window.__quran.selectAyah('v-93-3'));
  await p.waitForTimeout(650);
  await vp.screenshot({ path: 'work/st-2-sheet.png' });
  await p.evaluate(() => window.__quran.closeSelection());
  await p.waitForTimeout(400);

  // 3 — settings page
  await p.evaluate(() => window.__quran.openSettings());
  await p.waitForTimeout(500);
  await vp.screenshot({ path: 'work/st-3-settings.png' });

  // 4 — switch riwāya to Warsh from settings
  await p.evaluate(() => document.querySelector('.riwaya-row[data-art="warsh-svg"]').click());
  await p.waitForTimeout(700);
  await vp.screenshot({ path: 'work/st-4-warsh-settings.png' });

  // 5 — pick the green decoration theme, close settings
  await p.evaluate(() => document.querySelector('.swatch[data-deco="green"]').click());
  await p.waitForTimeout(400);
  await p.evaluate(() => window.__quran.closeSettings());
  await p.waitForTimeout(450);
  await vp.screenshot({ path: 'work/st-5-warsh-green.png' });

  // 6 — back to Hafs + mauve via settings, verify persistence values
  await p.evaluate(() => window.__quran.openSettings());
  await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('.riwaya-row[data-art="hafs-svg"]').click());
  await p.evaluate(() => document.querySelector('.swatch[data-deco="mauve"]').click());
  await p.waitForTimeout(700);
  await p.evaluate(() => window.__quran.closeSettings());
  await p.waitForTimeout(450);
  await vp.screenshot({ path: 'work/st-6-hafs-mauve.png' });
  console.log('persisted:', await p.evaluate(() =>
    localStorage.getItem('quran.art') + ' / ' + localStorage.getItem('quran.deco')));

  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  server.close();
  process.exit(0);
});
