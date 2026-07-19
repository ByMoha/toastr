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

/* Runs inside Chromium: remove matching elements, return serialized SVG. */
const STRIP_FN = ({ svgText, selectors }) => {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.querySelector('parsererror')) return { error: 'XML parse error' };
  let removed = 0;
  for (const sel of selectors) {
    for (const el of Array.from(root.querySelectorAll(sel))) { el.remove(); removed++; }
  }
  return { removed, out: new XMLSerializer().serializeToString(doc) };
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
    if (!selectors.length) { console.error('need --remove <sel,sel,…>'); process.exit(1); }
    await withPage(async (page) => {
      const res = await page.evaluate(STRIP_FN, { svgText: fs.readFileSync(fin, 'utf8'), selectors });
      if (res.error) { console.error(res.error); process.exit(1); }
      fs.writeFileSync(fout, res.out);
      console.log(`removed ${res.removed} element(s) -> ${fout}`);
    });
  }

  else if (cmd === 'batch') {
    const [indir, outdir] = args.slice(1);
    const selectors = (opt('remove', '') || '').split(',').map(s => s.trim()).filter(Boolean);
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
            ? await page.evaluate(STRIP_FN, { svgText: txt, selectors })
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

  /* extract <clean.svg> --page N [--riwaya hafs] [--pagemap assets/data/pagemap.json] [--out file]
   * Auto-extract ayah-digit positions from a stripped page and emit a layout doc.
   * Digits are the small bare number glyphs (the aya-tag artwork is drawn behind
   * them by the app). If a pagemap covering this riwāya's pagination is given,
   * digits are assigned surah:ayah in RTL reading order (rows top→bottom,
   * right→left within a row); otherwise positions only. */
  else if (cmd === 'extract') {
    const fin = args[1];
    const pageNum = +opt('page', 0);
    const riwaya = opt('riwaya', 'hafs');
    const pagemapPath = opt('pagemap', null);
    const out = opt('out', null);
    const svgText = fs.readFileSync(fin, 'utf8');
    const res = await withPage(async (page) => page.evaluate((svgText) => {
      document.body.innerHTML = svgText;
      const root = document.body.querySelector('svg');
      const vb = root.viewBox.baseVal;
      const digits = [];
      for (const el of root.querySelectorAll('path')) {
        const bb = el.getBBox();
        if (bb.height > 3 && bb.height < 7 && bb.width < 12 &&
            bb.y > vb.height * 0.05 && bb.y < vb.height * 0.95)
          digits.push({ x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 });
      }
      return { vb: { w: vb.width, h: vb.height }, digits };
    }, svgText));
    // RTL reading order
    const rows = [];
    res.digits.sort((a, b) => a.y - b.y).forEach(d => {
      const r = rows.find(r => Math.abs(r.y - d.y) < 5);
      if (r) { r.items.push(d); } else rows.push({ y: d.y, items: [d] });
    });
    const ordered = rows.flatMap(r => r.items.sort((a, b) => b.x - a.x));
    let ayat = null;
    if (pagemapPath && pageNum) ayat = (JSON.parse(fs.readFileSync(pagemapPath, 'utf8'))[String(pageNum)] || null);
    if (ayat && ayat.length !== ordered.length)
      console.error(`WARN: ${ordered.length} digits but pagemap lists ${ayat.length} ayat — s:a left null`);
    const ok = ayat && ayat.length === ordered.length;
    const doc = {
      page: pageNum, riwaya, coordinateSpace: 'svg-viewBox', viewBox: res.vb,
      medallions: ordered.map((d, i) => ({
        s: ok ? ayat[i][0] : null, a: ok ? ayat[i][1] : null,
        x: +d.x.toFixed(2), y: +d.y.toFixed(2)
      }))
    };
    const dest = out || fin.replace(/\.svg$/, '.layout.json');
    fs.writeFileSync(dest, JSON.stringify(doc, null, 1));
    console.log(`extracted ${ordered.length} digit positions -> ${dest}` + (ok ? ' (s:a assigned)' : ''));
  }

  else {
    console.log('usage: node dev/ingest.js unzip|inspect|strip|batch|extract …  (see file header)');
  }
})();
