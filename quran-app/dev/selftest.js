// Self-hosted server + Playwright in one foreground process (no backgrounding).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = '/home/user/toastr/quran-app';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.css': 'text/css', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f === '/') f = '/index.html';
  const fp = path.join(ROOT, f);
  fs.readFile(fp, (e, data) => {
    if (e) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(8140, async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 852, height: 1796 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push('' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text()); });
  await p.goto('http://127.0.0.1:8140/index.html', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.Data && window.Data.ready, { timeout: 8000 });
  await p.waitForTimeout(400);
  const vp = await p.$('#viewport');

  await vp.screenshot({ path: 'work/sw-baked.png' });
  const med = await p.evaluate(() => document.querySelectorAll('#medLayer svg').length);

  await p.evaluate(() => window.__quran.setArt('overlay'));
  await p.waitForTimeout(500);
  await vp.screenshot({ path: 'work/sw-overlay.png' });

  await p.evaluate(() => window.__quran.selectAyah('duha-7'));
  await p.waitForTimeout(600);
  await vp.screenshot({ path: 'work/sw-overlay-sheet.png' });

  console.log('medallions built:', med, '| pageerrors:', errs.length ? errs : 'none');
  await b.close();
  server.close();
  process.exit(0);
});
