/* Mass page pipeline: strip + extract every downloaded page in ONE browser.
 *
 *   node dev/build-pages.js --riwaya hafs --src work/drive/hafs-pages \
 *        [--pagemap assets/data/pagemap.json] [--only 1,2,3]
 *
 * Per page NNN.svg:
 *   strip  -> assets/pages/<riwaya>/NNN.svg        ([fill] + header/pagenum,
 *                                                   preserveAspectRatio=none)
 *   extract-> assets/data/layout/<riwaya>/NNN.svg.json
 * QA report -> work/<riwaya>-pages-report.json  (digit-count vs pagemap, rows)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
function opt(n, d) { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; }
const riwaya = opt('riwaya', 'hafs');
const src = path.resolve(opt('src', 'work/drive/hafs-pages'));
const pagemapPath = opt('pagemap', 'assets/data/pagemap.json');
const only = opt('only', null);
// hand-annotated digit positions: "17:x,y|x,y;86:x,y|..." (reading order not required)
const FORCED = {};
const forceArg = opt('force', null);
if (forceArg) for (const part of forceArg.split(';')) {
  const [pg, list] = part.split(':');
  FORCED[+pg] = list.split('|').map(t => { const [x, y] = t.split(','); return { x: +x, y: +y }; });
}

const ROOT = path.join(__dirname, '..');
const outPages = path.join(ROOT, 'assets/pages', riwaya);
const outLayout = path.join(ROOT, 'assets/data/layout', riwaya);
fs.mkdirSync(outPages, { recursive: true });
fs.mkdirSync(outLayout, { recursive: true });
const pagemap = pagemapPath ? JSON.parse(fs.readFileSync(path.join(ROOT, pagemapPath), 'utf8')) : null;

const TAG_W = 16.6, TAG_HALF = TAG_W / 2;

/* strip + measure, all inside the browser for one page */
const PROCESS = ({ svgText, ayatCount }) => {
  document.body.innerHTML = svgText;
  const live = document.body.querySelector('svg');
  if (!live) return { error: 'parse' };
  const vb = live.viewBox.baseVal;

  // measure decoration bands BEFORE stripping (banner zones)
  const bands = [];
  for (const el of Array.from(live.querySelectorAll('[fill]'))) {
    try {
      const bb = el.getBBox();
      if (bb.width > vb.width * 0.4 && bb.height > 8 && bb.height < vb.height * 0.15)
        bands.push({ y0: bb.y, y1: bb.y + bb.height });
    } catch (_) {}
  }
  // strip decoration
  let removed = 0;
  for (const el of Array.from(live.querySelectorAll('[fill]'))) { el.remove(); removed++; }
  // strip header texts / page number / merged chrome
  for (const el of Array.from(live.querySelectorAll('path'))) {
    try {
      const bb = el.getBBox();
      if (bb.y + bb.height < vb.height * 0.045) { el.remove(); removed++; }
      else if (bb.y > vb.height * 0.96 && bb.width < vb.width * 0.1) { el.remove(); removed++; }
      else if (bb.height > vb.height * 0.93) { el.remove(); removed++; }
    } catch (_) {}
  }
  live.setAttribute('preserveAspectRatio', 'none');

  // measure digit candidates + text block on the stripped result.
  // Two digit styles exist: bare digits (small) and full aya-marks with the
  // ring glyph (large, used for 3-digit numbers on some pages). Waqf marks can
  // appear as separate small paths — disambiguate by expected ayah count.
  const small = [], large = [];
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;   // text block = union of paths
  for (const el of live.querySelectorAll('path')) {
    const bb = el.getBBox();
    const c = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
    if (bb.y > vb.height * 0.05 && bb.y < vb.height * 0.95) {
      if (bb.height > 2.4 && bb.height < 7 && bb.width < 16) small.push(c);
      else if (bb.height >= 8 && bb.height < 15 && bb.width >= 9 && bb.width < 21) large.push(c);
    }
    x0 = Math.min(x0, bb.x); y0 = Math.min(y0, bb.y);
    x1 = Math.max(x1, bb.x + bb.width); y1 = Math.max(y1, bb.y + bb.height);
  }
  const text = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  let digits = small;
  if (ayatCount != null) {
    if (large.length === ayatCount) digits = large;
    else if (small.length === ayatCount) digits = small;
    else if (small.length + large.length === ayatCount) digits = small.concat(large);
  } else if (!small.length) digits = large;
  return {
    out: new XMLSerializer().serializeToString(live),
    vb: { w: vb.width, h: vb.height },
    digits, text, bands, removed, ayatCount
  };
};

function layoutFrom(res, pageNum, ayat) {
  // rows
  const digitRows = [];
  res.digits.sort((a, b) => a.y - b.y).forEach(d => {
    const r = digitRows.find(r => Math.abs(r.y - d.y) < 5);
    if (r) r.items.push(d); else digitRows.push({ y: d.y, items: [d] });
  });
  if (!digitRows.length) return null;
  const gaps = digitRows.slice(1).map((r, i) => r.y - digitRows[i].y);
  const minGap = gaps.length ? Math.min(...gaps) : 27;
  const unit = gaps.filter(g => g < minGap * 1.3);
  const s = unit.length ? unit.reduce((a, b) => a + b, 0) / unit.length : minGap;
  const inBand = (y) => res.bands.some(b => y > b.y0 - 2 && y < b.y1 + 2);
  const rows = [];
  const textTop = res.text.y, textBot = res.text.y + res.text.h;
  for (let y = digitRows[0].y - s; y > textTop + s * 0.25; y -= s)
    if (!inBand(y)) rows.unshift({ y });
  digitRows.forEach((r, i) => {
    if (i > 0) {
      const gap = r.y - digitRows[i - 1].y;
      const k = Math.round(gap / s);
      for (let j = 1; j < k; j++) {
        const y = digitRows[i - 1].y + (gap * j) / k;
        if (!inBand(y)) rows.push({ y });
      }
    }
    rows.push({ y: r.y, items: r.items });
  });
  for (let y = digitRows[digitRows.length - 1].y + s; y < textBot - s * 0.25; y += s)
    if (!inBand(y)) rows.push({ y });

  const ordered = digitRows.flatMap(r => r.items.slice().sort((a, b) => b.x - a.x));
  const ok = ayat && ayat.length === ordered.length;

  const xL = res.text.x, xR = res.text.x + res.text.w;
  const rowH = s * 0.92;
  const rowYs = rows.map(r => r.y);
  const rowOf = (y) => rowYs.reduce((best, ry, i) => Math.abs(ry - y) < Math.abs(rowYs[best] - y) ? i : best, 0);
  const rect = (x0, x1, ri) => [+x0.toFixed(2), +(rowYs[ri] - rowH / 2).toFixed(2), +(x1 - x0).toFixed(2), +rowH.toFixed(2)];
  const hits = ordered.map((d, i) => {
    const endRow = rowOf(d.y), endX = d.x - TAG_HALF;
    let startRow, startX;
    if (i === 0) { startRow = 0; startX = xR; }
    else {
      const p = ordered[i - 1];
      startRow = rowOf(p.y); startX = p.x - TAG_HALF;
      if (startX <= xL + 2) { startRow += 1; startX = xR; }
    }
    const rects = [];
    if (startRow === endRow) rects.push(rect(endX, startX, endRow));
    else {
      rects.push(rect(xL, startX, startRow));
      for (let ri = startRow + 1; ri < endRow; ri++) rects.push(rect(xL, xR, ri));
      rects.push(rect(endX, xR, endRow));
    }
    return { s: ok ? ayat[i][0] : null, a: ok ? ayat[i][1] : null, rects };
  });

  return {
    page: pageNum, riwaya, coordinateSpace: 'svg-viewBox', viewBox: res.vb,
    textBox: res.text, tagW: TAG_W,
    banners: res.bands.map(b => ({ y0: +b.y0.toFixed(2), y1: +b.y1.toFixed(2) })),
    rows: rowYs.map(y => +y.toFixed(2)),
    medallions: ordered.map((d, i) => ({
      s: ok ? ayat[i][0] : null, a: ok ? ayat[i][1] : null,
      x: +d.x.toFixed(2), y: +d.y.toFixed(2)
    })),
    hits, assigned: !!ok, digitCount: ordered.length
  };
}

(async () => {
  let files = fs.readdirSync(src).filter(f => /^\d+\.svg$/.test(f))
    .sort((a, b) => parseInt(a) - parseInt(b));
  if (only) {
    const set = new Set(only.split(',').map(Number));
    files = files.filter(f => set.has(parseInt(f)));
  }
  console.log('processing', files.length, 'pages from', src);
  const b = await chromium.launch();
  const page = await b.newPage();
  const report = [];
  let done = 0;
  for (const f of files) {
    const n = parseInt(f);
    const ayat = pagemap ? (pagemap[String(n)] || null) : null;
    try {
      const svgText = fs.readFileSync(path.join(src, f), 'utf8');
      const res = await page.evaluate(PROCESS, { svgText, ayatCount: ayat ? ayat.length : null });
      if (res.error) throw new Error(res.error);
      if (FORCED[n]) res.digits = FORCED[n];
      const name = String(n).padStart(3, '0') + '.svg';
      fs.writeFileSync(path.join(outPages, name), res.out);
      const layout = layoutFrom(res, n, ayat);
      if (!layout) throw new Error('no digits found');
      fs.writeFileSync(path.join(outLayout, n + '.svg.json'), JSON.stringify(layout));
      report.push({
        page: n, digits: layout.digitCount, ayat: ayat ? ayat.length : null,
        assigned: layout.assigned, rows: layout.rows.length, banners: layout.banners.length
      });
    } catch (e) {
      report.push({ page: n, error: e.message });
    }
    if (++done % 50 === 0) console.log('…', done, '/', files.length);
  }
  await b.close();
  const bad = report.filter(r => r.error);
  const unassigned = report.filter(r => !r.error && !r.assigned);
  fs.writeFileSync(path.join(ROOT, 'work', riwaya + '-pages-report.json'), JSON.stringify(report, null, 1));
  console.log('done:', report.length, '| errors:', bad.length, '| unassigned (digit≠ayat):', unassigned.length);
  if (bad.length) console.log('error pages:', bad.map(r => r.page).join(','));
  if (unassigned.length) console.log('unassigned pages:', unassigned.map(r => r.page + '(' + r.digits + '/' + r.ayat + ')').slice(0, 40).join(' '));
})();
