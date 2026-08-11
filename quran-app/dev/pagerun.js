// Verify the SVG page mode: Hafs 596 + Warsh 300 — default, highlight, sheet.
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

server.listen(8143, async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 852, height: 1796 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push('' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text()); });
  p.on('requestfailed', r => errs.push('reqfail:' + r.url().slice(-60)));

  await p.goto('http://127.0.0.1:8143/index.html', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.Data && window.Data.ready, { timeout: 8000 });
  const vp = await p.$('#viewport');

  // ---- Hafs SVG page ----
  await p.evaluate(() => window.__quran.setArt('hafs-svg'));
  await p.waitForTimeout(700);
  console.log('hafs ids sample:', await p.evaluate(() => window.__quran.ids().slice(0, 4).join(',')),
    '| tags:', await p.evaluate(() => document.querySelectorAll('#medLayer .ayah-tag').length));
  await vp.screenshot({ path: 'work/pg-hafs.png' });

  await p.evaluate(() => window.__quran.selectAyah('v-93-3'));
  await p.waitForTimeout(150);
  await vp.screenshot({ path: 'work/pg-hafs-hl.png' });
  await p.waitForTimeout(500);
  const sheet1 = await p.evaluate(() => ({
    open: document.getElementById('sheet').classList.contains('show'),
    g: document.getElementById('sheetGharib').textContent.slice(0, 40)
  }));
  console.log('hafs 93:3 sheet:', JSON.stringify(sheet1));
  await vp.screenshot({ path: 'work/pg-hafs-sheet.png' });
  await p.evaluate(() => window.__quran.closeSelection());
  await p.waitForTimeout(400);

  // ---- Warsh SVG page ----
  await p.evaluate(() => window.__quran.setArt('warsh-svg'));
  await p.waitForTimeout(700);
  console.log('warsh ids:', await p.evaluate(() => window.__quran.ids().join(',')));
  await vp.screenshot({ path: 'work/pg-warsh.png' });

  await p.evaluate(() => window.__quran.selectAyah('v-18-56'));
  await p.waitForTimeout(650);
  const sheet2 = await p.evaluate(() => ({
    open: document.getElementById('sheet').classList.contains('show'),
    g: document.getElementById('sheetGharib').textContent.slice(0, 40)
  }));
  console.log('warsh 18:56 sheet:', JSON.stringify(sheet2));
  await vp.screenshot({ path: 'work/pg-warsh-sheet.png' });

  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  server.close();
  process.exit(0);
});
