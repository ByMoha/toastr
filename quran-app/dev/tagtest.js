// Verify the official aya-tag artwork: number placement + full-page overlay.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.css': 'text/css; charset=utf-8' };

const server = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f === '/') f = '/index.html';
  fs.readFile(path.join(ROOT, f), (e, data) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(8142, async () => {
  const b = await chromium.launch();

  // 1 — tag strip: numbers ١ ٣ ٧ ١١ ٩٩ ١١٤ at app size (44) and enlarged (80)
  const t = await b.newPage({ viewport: { width: 700, height: 260 } });
  await t.goto('http://127.0.0.1:8142/dev/blank.html').catch(() => {});
  await t.setContent(`<meta charset="utf-8"><body style="margin:0;background:#fefefa">
    <div id="row" style="display:flex;gap:18px;align-items:center;padding:16px"></div>
    <div id="row2" style="display:flex;gap:18px;align-items:center;padding:16px"></div>
    <script src="http://127.0.0.1:8142/data.js"></scr` + `ipt>
    <script src="http://127.0.0.1:8142/medallion.js"></scr` + `ipt>
    <script>
      Medallion.art.src = 'http://127.0.0.1:8142/assets/ui/ayah-tag.png';
      [1,3,7,11,99,114].forEach(n => document.getElementById('row').appendChild(Medallion.node(n, 44)));
      [3,114].forEach(n => document.getElementById('row2').appendChild(Medallion.node(n, 80)));
    </scr` + `ipt></body>`);
  await t.waitForTimeout(600);
  await t.screenshot({ path: 'work/tag-strip.png' });
  await t.close();

  // 2 — app in overlay mode with the real artwork
  const p = await b.newPage({ viewport: { width: 852, height: 1796 } });
  const errs = [];
  p.on('pageerror', e => errs.push('' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text()); });
  await p.goto('http://127.0.0.1:8142/index.html', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.Data && window.Data.ready, { timeout: 8000 });
  await p.evaluate(() => window.__quran.setArt('overlay'));
  await p.waitForTimeout(700);
  const vp = await p.$('#viewport');
  await vp.screenshot({ path: 'work/tag-page.png' });
  // sheet check: real tag in the sheet too
  await p.evaluate(() => window.__quran.selectAyah('duha-3'));
  await p.waitForTimeout(600);
  await vp.screenshot({ path: 'work/tag-sheet.png' });
  console.log('page tags:', await p.evaluate(() => document.querySelectorAll('#medLayer .ayah-tag').length),
    '| errors:', errs.length ? errs : 'none');
  await b.close();
  server.close();
  process.exit(0);
});
