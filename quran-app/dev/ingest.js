/* ===== Mushaf SVG page-set ingestion =====
 * Prepares a per-riwāya page-set (e.g. Warsh) for the app:
 *
 *   1) unzip  <zip> <dir>                    extract the delivered archive
 *   2) inspect <file.svg|dir>                report each SVG's structure: viewBox +
 *                                            top-level groups (id / label / class,
 *                                            element counts, bbox) — used to decide
 *                                            which layers are borders/decoration
 *   3) strip  <in.svg> <out.svg> --remove <sel,sel,…>
 *                                            remove matching layers from one page
 *   4) batch  <indir> <outdir> --remove <sel,…> [--riwaya warsh]
 *                                            strip all pages, install them as
 *                                            assets/pages/<riwaya>/NNN.svg and
 *                                            report min/max viewBox for config.js
 *
 * Selectors are ordinary CSS selectors evaluated against the SVG DOM, e.g.:
 *   "#border, #frame, [id*=decor], [inkscape\\:label*=زخرفة]"
 * Run `inspect` first — its report tells you exactly what to pass to --remove.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const cmd = args[0];

function opt(name, dflt) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
}

function listSvgs(p) {
  const st = fs.statSync(p);
  if (st.isFile()) return [p];
  return fs.readdirSync(p).filter(f => f.toLowerCase().endsWith('.svg'))
    .map(f => path.join(p, f)).sort();
}

async function withPage(fn) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try { return await fn(page); } finally { await browser.close(); }
}

/* Runs inside Chromium: parse an SVG string, describe its top-level structure. */
const INSPECT_FN = (svgText) => {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.nodeName === 'parsererror' || root.querySelector('parsererror'))
    return { error: 'XML parse error' };
  const info = {
    viewBox: root.getAttribute('viewBox'),
    width: root.getAttribute('width'),
    height: root.getAttribute('height'),
    topLevel: []
  };
  // mount for bbox measurement
  document.body.innerHTML = '';
  document.body.appendChild(document.importNode(root, true));
  const live = document.body.querySelector('svg');
  for (const el of Array.from(live.children)) {
    if (el.nodeName === 'defs' || el.nodeName === 'metadata' ||
        el.nodeName === 'title' || el.nodeName === 'desc' ||
        el.nodeName === 'style') {
      info.topLevel.push({ tag: el.nodeName });
      continue;
    }
    const entry = {
      tag: el.nodeName,
      id: el.getAttribute('id') || undefined,
      label: el.getAttribute('inkscape:label') || el.getAttributeNS('http://www.inkscape.org/namespaces/inkscape', 'label') || undefined,
      cls: el.getAttribute('class') || undefined,
      children: el.childElementCount,
      paths: el.querySelectorAll('path').length,
      texts: el.querySelectorAll('text').length,
      images: el.querySelectorAll('image').length,
      uses: el.querySelectorAll('use').length
    };
    try {
      const b = el.getBBox();
      entry.bbox = [b.x, b.y, b.width, b.height].map(v => Math.round(v * 10) / 10);
    } catch (_) {}
    info.topLevel.push(entry);
  }
  return info;
};

/* Runs inside Chromium: remove matching elements, return serialized SVG.
   Also stamps preserveAspectRatio="none" so the app can stretch the page into
   its slot (the design's line spacing) with overlay coordinates mapping 1:1. */
const STRIP_FN = ({ svgText, selectors, removeHeader }) => {
  // operate on a live, rendered DOM so getBBox works, then serialize it back
  document.body.innerHTML = svgText;
  const live = document.body.querySelector('svg');
  if (!live) return { error: 'XML parse error' };
  let removed = 0;
  for (const sel of selectors) {
    for (const el of Array.from(live.querySelectorAll(sel))) { el.remove(); removed++; }
  }
  if (removeHeader) {
    // the page's own juz/surah header texts (top ~4.5% strip) and its page
    // number (small path in the bottom ~3%) — the app draws both live, so the
    // page art can be scaled to fill the design's text region
    const vb = live.viewBox.baseVal;
    for (const el of Array.from(live.querySelectorAll('path'))) {
      try {
        const bb = el.getBBox();
        if (bb.y + bb.height < vb.height * 0.045) { el.remove(); removed++; }
        else if (bb.y > vb.height * 0.96 && bb.width < vb.width * 0.1) { el.remove(); removed++; }
        // some sets merge header + page number into one sparse full-height path
        // (text blocks never exceed ~82% of the page height)
        else if (bb.height > vb.height * 0.93) { el.remove(); removed++; }
      } catch (_) {}
    }
  }
  live.setAttribute('preserveAspectRatio', 'none');
  return { removed, out: new XMLSerializer().serializeToString(live) };
};

(async () => {
  if (cmd === 'unzip') {
    const [zip, dir] = args.slice(1);
    fs.mkdirSync(dir, { recursive: true });
    execSync(`unzip -o -q ${JSON.stringify(zip)} -d ${JSON.stringify(dir)}`);
    const all = execSync(`find ${JSON.stringify(dir)} -type f | head -1000`).toString().trim().split('\n');
    const svgs = all.filter(f => f.toLowerCase().endsWith('.svg'));
    console.log(`extracted ${all.length} files, ${svgs.length} SVGs`);
    console.log('first:', svgs.slice(0, 3).join('\n       '));
  }

  else if (cmd === 'inspect') {
    const files = listSvgs(args[1]);
    const sample = files.length > 5
      ? [files[0], files[1], files[Math.floor(files.length / 2)], files[files.length - 2], files[files.length - 1]]
      : files;
    await withPage(async (page) => {
      for (const f of sample) {
        const res = await page.evaluate(INSPECT_FN, fs.readFileSync(f, 'utf8'));
        console.log('=====', path.basename(f), '=====');
        console.log(JSON.stringify(res, null, 1));
      }
    });
    if (files.length > sample.length) console.log(`(${files.length} files total; showed ${sample.length})`);
  }

  else if (cmd === 'strip') {
    const [fin, fout] = args.slice(1);
    const selectors = (opt('remove', '') || '').split(',').map(s => s.trim()).filter(Boolean);
    const removeHeader = args.includes('--remove-header');
    if (!selectors.length) { console.error('need --remove <sel,sel,…>'); process.exit(1); }
    await withPage(async (page) => {
      const res = await page.evaluate(STRIP_FN, { svgText: fs.readFileSync(fin, 'utf8'), selectors, removeHeader });
      if (res.error) { console.error(res.error); process.exit(1); }
      fs.writeFileSync(fout, res.out);
      console.log(`removed ${res.removed} element(s) -> ${fout}`);
    });
  }

  else if (cmd === 'batch') {
    const [indir, outdir] = args.slice(1);
    const selectors = (opt('remove', '') || '').split(',').map(s => s.trim()).filter(Boolean);
    const removeHeader = args.includes('--remove-header');
    const riwaya = opt('riwaya', null);
    fs.mkdirSync(outdir, { recursive: true });
    const files = listSvgs(indir);
    const boxes = new Set(); let done = 0, failed = 0;
    await withPage(async (page) => {
      for (const f of files) {
        // page number from the filename's digits; keep original order as fallback
        const m = path.basename(f).match(/(\d+)/);
        const n = m ? +m[1] : done + 1;
        const name = String(n).padStart(3, '0') + '.svg';
        try {
          const txt = fs.readFileSync(f, 'utf8');
          const res = selectors.length
            ? await page.evaluate(STRIP_FN, { svgText: txt, selectors, removeHeader })
            : { out: txt, removed: 0 };
          if (res.error) throw new Error(res.error);
          fs.writeFileSync(path.join(outdir, name), res.out);
          const vb = (res.out.match(/viewBox="([^"]+)"/) || [])[1];
          if (vb) boxes.add(vb);
          done++;
        } catch (e) { failed++; console.error('FAIL', path.basename(f), e.message); }
        if (done % 100 === 0) console.log(`…${done}/${files.length}`);
      }
    });
    console.log(`installed ${done} pages -> ${outdir} (${failed} failed)`);
    console.log('distinct viewBoxes:', [...boxes].slice(0, 5));
    if (riwaya) console.log(`next: set pages/viewBox for '${riwaya}' in config.js from the values above`);
  }

  /* extract <clean.svg> --page N [--riwaya hafs] [--orig original.svg]
   *         [--pagemap assets/data/pagemap.json] [--ayat "18:53,18:54,…"] [--out file]
   * Auto-extract a full page layout from a stripped page SVG:
   *  - medallions: ayah-digit centres (the app draws the open aya-tag behind them)
   *  - rows:       the inferred text-line grid (digit rows + gap-filled lines,
   *                skipping surah-banner bands read from --orig's [fill] layer)
   *  - hits:       per-ayah tap/highlight rectangles built RTL from digit to digit
   * surah:ayah comes from --pagemap (this riwāya's pagination) or an explicit
   * --ayat list; digit-count mismatches leave s:a null and print a warning. */
  else if (cmd === 'extract') {
    const fin = args[1];
    const pageNum = +opt('page', 0);
    const riwaya = opt('riwaya', 'hafs');
    const origPath = opt('orig', null);
    const pagemapPath = opt('pagemap', null);
    const ayatOpt = opt('ayat', null);
    const out = opt('out', null);
    const TAG_W = 16.6, TAG_HALF = TAG_W / 2;

    const svgText = fs.readFileSync(fin, 'utf8');
    const origText = origPath ? fs.readFileSync(origPath, 'utf8') : null;

    const res = await withPage(async (page) => page.evaluate(({ svgText, origText }) => {
      document.body.innerHTML = svgText;
      const root = document.body.querySelector('svg');
      const vb = root.viewBox.baseVal;
      const digits = []; let text = null;
      for (const el of root.querySelectorAll('path')) {
        const bb = el.getBBox();
        if (bb.height > 2.4 && bb.height < 7 && bb.width < 16 &&
            bb.y > vb.height * 0.05 && bb.y < vb.height * 0.95)
          digits.push({ x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 });
        if (!text || bb.width * bb.height > text.w * text.h)
          text = { x: bb.x, y: bb.y, w: bb.width, h: bb.height };
      }
      let bands = [];
      if (origText) {
        document.body.innerHTML = origText;
        const oroot = document.body.querySelector('svg');
        for (const el of oroot.querySelectorAll('[fill]')) {
          const bb = el.getBBox();
          // banner band: wide and short (the full frame is nearly page-height)
          if (bb.width > vb.width * 0.4 && bb.height > 8 && bb.height < vb.height * 0.15)
            bands.push({ y0: bb.y, y1: bb.y + bb.height });
        }
      }
      return { vb: { w: vb.width, h: vb.height }, digits, text, bands };
    }, { svgText, origText }));

    // ---- rows from digits, gap-filled, banner rows excluded ----
    const digitRows = [];
    res.digits.sort((a, b) => a.y - b.y).forEach(d => {
      const r = digitRows.find(r => Math.abs(r.y - d.y) < 5);
      if (r) r.items.push(d); else digitRows.push({ y: d.y, items: [d] });
    });
    // unit line spacing = the smallest gap cluster (digit rows may sit 2+ lines apart)
    const gaps = digitRows.slice(1).map((r, i) => r.y - digitRows[i].y);
    const minGap = gaps.length ? Math.min(...gaps) : 27;
    const unit = gaps.filter(g => g < minGap * 1.3);
    const s = unit.length ? unit.reduce((a, b) => a + b, 0) / unit.length : minGap;
    const inBand = (y) => res.bands.some(b => y > b.y0 - 2 && y < b.y1 + 2);
    const rows = [];
    // lines above the first digit row (page starts mid-ayah)
    const textTop = res.text.y, textBot = res.text.y + res.text.h;
    for (let y = digitRows[0].y - s; y > textTop + s * 0.25; y -= s)
      if (!inBand(y)) rows.unshift({ y, filled: true });
    digitRows.forEach((r, i) => {
      if (i > 0) {
        const gap = r.y - digitRows[i - 1].y;
        const k = Math.round(gap / s);
        for (let j = 1; j < k; j++) {
          const y = digitRows[i - 1].y + (gap * j) / k;
          if (!inBand(y)) rows.push({ y, filled: true });
        }
      }
      rows.push({ y: r.y, items: r.items });
    });
    // lines below the last digit row (page ends mid-ayah) — tap area only
    for (let y = digitRows[digitRows.length - 1].y + s; y < textBot - s * 0.25; y += s)
      if (!inBand(y)) rows.push({ y, filled: true });

    // ---- RTL digit order + s:a assignment ----
    const ordered = digitRows.flatMap(r => r.items.slice().sort((a, b) => b.x - a.x));
    let ayat = null;
    if (ayatOpt) ayat = ayatOpt.split(',').map(t => t.trim().split(':').map(Number));
    else if (pagemapPath && pageNum) ayat = (JSON.parse(fs.readFileSync(pagemapPath, 'utf8'))[String(pageNum)] || null);
    if (ayat && ayat.length !== ordered.length) {
      console.error(`WARN: ${ordered.length} digits but ${ayat.length} ayat listed — s:a left null`);
      ayat = null;
    }

    // ---- per-ayah hit rects (RTL: right→left, top→bottom) ----
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
        if (startX <= xL + 2) { startRow += 1; startX = xR; }   // prev ayah ended flush left
      }
      const rects = [];
      if (startRow === endRow) rects.push(rect(endX, startX, endRow));
      else {
        rects.push(rect(xL, startX, startRow));
        for (let ri = startRow + 1; ri < endRow; ri++) rects.push(rect(xL, xR, ri));
        rects.push(rect(endX, xR, endRow));
      }
      return { s: ayat ? ayat[i][0] : null, a: ayat ? ayat[i][1] : null, rects };
    });

    const doc = {
      page: pageNum, riwaya, coordinateSpace: 'svg-viewBox', viewBox: res.vb,
      textBox: res.text, tagW: TAG_W,
      // surah-banner bands (from the original's decoration layer) — the app
      // draws the ornate banner asset in these zones
      banners: res.bands.map(b => ({ y0: +b.y0.toFixed(2), y1: +b.y1.toFixed(2) })),
      rows: rowYs.map(y => +y.toFixed(2)),
      medallions: ordered.map((d, i) => ({
        s: ayat ? ayat[i][0] : null, a: ayat ? ayat[i][1] : null,
        x: +d.x.toFixed(2), y: +d.y.toFixed(2)
      })),
      hits
    };
    const dest = out || fin.replace(/\.svg$/, '.layout.json');
    fs.writeFileSync(dest, JSON.stringify(doc));
    console.log(`extracted ${ordered.length} digits, ${rowYs.length} rows, ${hits.length} hit groups -> ${dest}` + (ayat ? ' (s:a assigned)' : ''));
  }

  else {
    console.log('usage: node dev/ingest.js unzip|inspect|strip|batch|extract …  (see file header)');
  }
})();
