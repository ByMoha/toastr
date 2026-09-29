// Image analysis + crop tool using global Playwright (no external deps, no network).
const { chromium } = require('playwright');
const fs = require('fs');

function dataUrl(path) {
  return 'data:image/png;base64,' + fs.readFileSync(path).toString('base64');
}

(async () => {
  const cmd = process.argv[2];
  const browser = await chromium.launch();
  const page = await browser.newPage();

  if (cmd === 'dims') {
    const src = process.argv[3];
    const d = await page.evaluate(async (u) => {
      const img = new Image(); img.src = u; await img.decode();
      return { w: img.naturalWidth, h: img.naturalHeight };
    }, dataUrl(src));
    console.log(JSON.stringify(d));
  }

  else if (cmd === 'crop') {
    const [src, out, x, y, w, h] = process.argv.slice(3);
    const result = await page.evaluate(async ({ u, x, y, w, h }) => {
      const img = new Image(); img.src = u; await img.decode();
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
      return c.toDataURL('image/png');
    }, { u: dataUrl(src), x: +x, y: +y, w: +w, h: +h });
    fs.writeFileSync(out, Buffer.from(result.split(',')[1], 'base64'));
    console.log('wrote ' + out + ' (' + w + 'x' + h + ')');
  }

  // Row darkness profile: for each row band of `step` px, report mean darkness (0..255) and colored-pixel fraction
  else if (cmd === 'rows') {
    const src = process.argv[3];
    const step = +(process.argv[4] || 10);
    const prof = await page.evaluate(async ({ u, step }) => {
      const img = new Image(); img.src = u; await img.decode();
      const W = img.naturalWidth, H = img.naturalHeight;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, W, H).data;
      const out = [];
      for (let y = 0; y < H; y += step) {
        let dark = 0, colored = 0, n = 0;
        for (let yy = y; yy < Math.min(y + step, H); yy += 2) {
          for (let x = 0; x < W; x += 4) {
            const i = (yy * W + x) * 4;
            const r = d[i], g = d[i + 1], b = d[i + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            dark += (255 - lum);
            // "colored/ink" = notably darker than cream bg
            if (lum < 200) colored++;
            n++;
          }
        }
        out.push({ y, dark: Math.round(dark / n), ink: (colored / n).toFixed(3) });
      }
      return out;
    }, { u: dataUrl(src), step });
    prof.forEach(p => console.log(`y=${p.y}\tdark=${p.dark}\tink=${p.ink}`));
  }

  // Detect gold ayah-medallion x-centers within a horizontal band [yTop,yBot]
  else if (cmd === 'gold') {
    const src = process.argv[3], yTop = +process.argv[4], yBot = +process.argv[5];
    const centers = await page.evaluate(async ({ u, yTop, yBot }) => {
      const img = new Image(); img.src = u; await img.decode();
      const W = img.naturalWidth, H = img.naturalHeight;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, W, H).data;
      const col = new Array(W).fill(0);
      for (let x = 0; x < W; x++) {
        for (let y = yTop; y <= yBot && y < H; y++) {
          const i = (y * W + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
          if (r > 135 && r < 225 && g > 85 && g < 160 && b > 35 && b < 120 && (r - b) > 45 && (r - g) > 20) col[x]++;
        }
      }
      // cluster columns with count above threshold
      const th = 6; const clusters = []; let cur = null;
      for (let x = 0; x < W; x++) {
        if (col[x] >= th) { if (!cur) cur = { x0: x, x1: x, sum: 0, wsum: 0 }; cur.x1 = x; cur.sum += col[x]; cur.wsum += col[x] * x; }
        else { if (cur && (x - cur.x1) > 12) { clusters.push(cur); cur = null; } }
      }
      if (cur) clusters.push(cur);
      return clusters.filter(c => (c.x1 - c.x0) >= 8).map(c => ({ c: Math.round(c.wsum / c.sum), x0: c.x0, x1: c.x1 }));
    }, { u: dataUrl(src), yTop, yBot });
    console.log(JSON.stringify(centers));
  }

  else if (cmd === 'pixel') {
    const [src, x, y] = process.argv.slice(3);
    const px = await page.evaluate(async ({ u, x, y }) => {
      const img = new Image(); img.src = u; await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(x, y, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] };
    }, { u: dataUrl(src), x: +x, y: +y });
    console.log(`rgb(${px.r},${px.g},${px.b}) a=${px.a}  #${[px.r,px.g,px.b].map(v=>v.toString(16).padStart(2,'0')).join('')}`);
  }

  await browser.close();
})();
