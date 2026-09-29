/* Build the empty page-number cartouche frame from the clean reading-view
 * reference using a luminance key (keep everything darker than the cream paper,
 * which preserves the thin double-line panel outline and the floral scrolls),
 * then clear the baked ٥٩٦ digits. Output: assets/ui/page-frame.png */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const REF = '/root/.claude/uploads/84b9d9db-4142-5e96-9581-8afb6384ab3e/594e70f0-63756a1caa30af9b7702ab5588b1f180171303ba.png';
const CROP = { x: 332, y: 1650, w: 140, h: 46 };
const NUM = { x0: 372, x1: 432, y0: 1659, y1: 1689 };  // baked-digit region to erase

(async () => {
  const b64 = fs.readFileSync(REF).toString('base64');
  const b = await chromium.launch();
  const p = await b.newPage();
  const res = await p.evaluate(async ({ b64, CROP, NUM }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const src = document.createElement('canvas'); src.width = img.width; src.height = img.height;
    src.getContext('2d').drawImage(img, 0, 0);
    const sd = src.getContext('2d').getImageData(0, 0, img.width, img.height).data;
    const lumAt = (x, y) => { const i = ((y | 0) * img.width + (x | 0)) * 4; return sd[i] * 0.4 + sd[i + 1] * 0.4 + sd[i + 2] * 0.2; };

    // sample the paper luminance just outside the cartouche
    const paper = lumAt(CROP.x + 4, CROP.y + 4);
    const scale = 4;
    const out = document.createElement('canvas');
    out.width = CROP.w * scale; out.height = CROP.h * scale;
    const og = out.getContext('2d');
    const dst = og.createImageData(out.width, out.height);
    // also find the vertical center of retained ink (panel center)
    let iy0 = 1e9, iy1 = -1;
    for (let oy = 0; oy < out.height; oy++) {
      for (let ox = 0; ox < out.width; ox++) {
        const sx = CROP.x + ox / scale, sy = CROP.y + oy / scale;
        const i = ((sy | 0) * img.width + (sx | 0)) * 4;
        const r = sd[i], g = sd[i + 1], bl = sd[i + 2];
        const lum = r * 0.4 + g * 0.4 + bl * 0.2;
        const oi = (oy * out.width + ox) * 4;
        const inNum = sx >= NUM.x0 && sx <= NUM.x1 && sy >= NUM.y0 && sy <= NUM.y1;
        // alpha grows as the pixel gets darker than the paper (thin lines kept)
        let a = (paper - lum) / 70;
        a = a < 0 ? 0 : a > 1 ? 1 : a;
        // drop bluish/gray pixels (only keep warm ink)
        const warm = (r - bl) > 12;
        if (inNum || !warm) a = 0;
        if (a > 0) {
          dst.data[oi] = r; dst.data[oi + 1] = g; dst.data[oi + 2] = bl; dst.data[oi + 3] = Math.round(a * 255);
          if (!inNum) { if (sy < iy0) iy0 = sy; if (sy > iy1) iy1 = sy; }
        } else dst.data[oi + 3] = 0;
      }
    }
    og.putImageData(dst, 0, 0);
    return { url: out.toDataURL('png'), panelCenterY: (iy0 + iy1) / 2, cropCenterY: CROP.y + CROP.h / 2 };
  }, { b64, CROP, NUM });

  const png = Buffer.from(res.url.split(',')[1], 'base64');
  fs.writeFileSync(path.join(ROOT, 'assets/ui/page-frame.png'), png);
  console.log('wrote assets/ui/page-frame.png', CROP.w * 4 + 'x' + CROP.h * 4, Math.round(png.length / 1024) + 'KB');
  console.log('ink vertical center', res.panelCenterY.toFixed(1), 'vs crop center', res.cropCenterY.toFixed(1));
  await b.close();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
