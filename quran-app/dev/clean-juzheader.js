/* Remove the two baked vertical-line dividers from juz-header.png so the app can
 * draw circular separators instead. Detects thin tan columns in the cartouche
 * interior and repaints them from neighbouring background. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets/ui/juz-header.png');

(async () => {
  const b64 = fs.readFileSync(SRC).toString('base64');
  const b = await chromium.launch();
  const p = await b.newPage();
  const out = await p.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const W = img.width, H = img.height;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H);
    const px = d.data;
    const at = (x, y) => { const i = (y * W + x) * 4; return [px[i], px[i + 1], px[i + 2], px[i + 3]]; };
    // a divider pixel is simply darker than the near-white cartouche interior
    const isInk = (r, gg, bb, aa) => aa > 30 && (r < 232 || gg < 225 || bb < 210) && (r - bb) > 8;
    // find thin vertical divider columns in the interior band
    const y0 = Math.round(H * 0.30), y1 = Math.round(H * 0.72);
    const cols = [];
    let maxN = 0;
    for (let x = Math.round(W * 0.24); x < Math.round(W * 0.70); x++) {
      let n = 0; for (let y = y0; y < y1; y++) { const [r, gg, bb, aa] = at(x, y); if (isInk(r, gg, bb, aa)) n++; }
      cols.push({ x, n }); if (n > maxN) maxN = n;
    }
    const thresh = Math.max(4, (y1 - y0) * 0.45);
    const hits = cols.filter(c => c.n >= thresh).map(c => c.x);
    console.log('DEBUG maxColCount', maxN, 'thresh', Math.round(thresh), 'hits', hits.length);
    // group contiguous x into line centers
    const groups = [];
    hits.forEach(x => { const g0 = groups[groups.length - 1]; if (g0 && x - g0.last <= 3) { g0.last = x; g0.xs.push(x); } else groups.push({ last: x, xs: [x] }); });
    const centers = groups.map(g => Math.round(g.xs.reduce((a, b) => a + b, 0) / g.xs.length));
    // repaint each divider column (±3px) with a clean background sampled above the band
    for (const cx of centers) {
      for (let x = cx - 3; x <= cx + 3; x++) {
        for (let y = 0; y < H; y++) {
          // sample background from a clear interior column to the side
          const sx = cx - 22;
          const i = (y * W + x) * 4, si = (y * W + sx) * 4;
          px[i] = px[si]; px[i + 1] = px[si + 1]; px[i + 2] = px[si + 2]; px[i + 3] = px[si + 3];
        }
      }
    }
    g.putImageData(d, 0, 0);
    return { url: c.toDataURL('png'), centers, W, maxN, hitCount: hits.length };
  }, b64);
  console.log('DEBUG maxColCount', out.maxN, 'hits', out.hitCount);
  if (!out.centers.length) { console.log('no dividers detected — not writing'); await b.close(); return; }
  fs.writeFileSync(SRC, Buffer.from(out.url.split(',')[1], 'base64'));
  console.log('cleaned juz-header.png; removed dividers at x =', out.centers.join(', '), '(width', out.W + ')');
  await b.close();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
