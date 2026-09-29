/* Extract the empty page-number cartouche frame from an original (unstripped)
 * page SVG. The build pipeline strips this decoration; we recover it as a
 * transparent PNG so the app can draw the live page number inside it. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'work/drive/hafs-pages/596.svg');

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ deviceScaleFactor: 4 });
  const svgText = fs.readFileSync(SRC, 'utf8');

  const meas = await page.evaluate((svgText) => {
    document.body.style.margin = '0';
    document.body.innerHTML = svgText;
    const svg = document.body.querySelector('svg');
    const vb = svg.viewBox.baseVal;
    // page-number zone: bottom 5% of the page, horizontally central
    const yMin = vb.y + vb.height * 0.95;
    const frame = [];      // decoration paths (the cartouche)
    const digits = [];     // the number glyphs to erase
    let fx0 = 1e9, fy0 = 1e9, fx1 = -1e9, fy1 = -1e9;
    for (const el of Array.from(svg.querySelectorAll('*'))) {
      if (!el.getBBox) continue;
      let bb; try { bb = el.getBBox(); } catch (_) { continue; }
      if (!bb.width || !bb.height) continue;
      const cx = bb.x + bb.width / 2;
      if (bb.y < yMin) continue;
      if (Math.abs(cx - (vb.x + vb.width / 2)) > vb.width * 0.30) continue;
      // decoration frame carries a fill attribute; digits are thin strokes/paths
      const filled = el.hasAttribute('fill') && el.getAttribute('fill') !== 'none';
      const wide = bb.width > vb.width * 0.06;
      if (filled && wide) {
        frame.push(el);
        fx0 = Math.min(fx0, bb.x); fy0 = Math.min(fy0, bb.y);
        fx1 = Math.max(fx1, bb.x + bb.width); fy1 = Math.max(fy1, bb.y + bb.height);
      } else {
        digits.push(el);
      }
    }
    return {
      vb: { x: vb.x, y: vb.y, w: vb.width, h: vb.height },
      frameBox: { x: fx0, y: fy0, w: fx1 - fx0, h: fy1 - fy0 },
      frameCount: frame.length, digitCount: digits.length
    };
  }, svgText);

  console.log('viewBox', meas.vb);
  console.log('frameBox', meas.frameBox, 'frameEls', meas.frameCount, 'digitEls', meas.digitCount);

  // Rebuild an SVG cropped to the frame box, with the digit glyphs removed.
  const pad = 2;
  const fb = meas.frameBox;
  const crop = await page.evaluate(({ svgText, fb, pad, vb }) => {
    document.body.innerHTML = svgText;
    const svg = document.body.querySelector('svg');
    const yMin = vb.y + vb.height * 0.95;
    // remove everything except the central bottom decoration
    for (const el of Array.from(svg.querySelectorAll('*'))) {
      if (el === svg) continue;
      if (!el.getBBox) { continue; }
      let bb; try { bb = el.getBBox(); } catch (_) { continue; }
      const cx = bb.x + bb.width / 2;
      const filled = el.hasAttribute('fill') && el.getAttribute('fill') !== 'none';
      const inZone = bb.y >= yMin && Math.abs(cx - (vb.x + vb.width / 2)) < vb.width * 0.30;
      const wide = bb.width > vb.width * 0.06;
      if (inZone && filled && wide) continue;   // keep the cartouche frame
      try { el.remove(); } catch (_) {}
    }
    svg.setAttribute('viewBox', `${fb.x - pad} ${fb.y - pad} ${fb.w + pad * 2} ${fb.h + pad * 2}`);
    svg.setAttribute('width', (fb.w + pad * 2));
    svg.setAttribute('height', (fb.h + pad * 2));
    svg.removeAttribute('preserveAspectRatio');
    return new XMLSerializer().serializeToString(svg);
  }, { svgText, fb, pad, vb: meas.vb });

  fs.writeFileSync(path.join(ROOT, 'work/page-frame.svg'), crop);

  // rasterize to a crisp transparent PNG
  const scale = 6;
  const w = Math.round((fb.w + pad * 2) * scale), h = Math.round((fb.h + pad * 2) * scale);
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<style>*{margin:0}html,body{background:transparent}svg{display:block;width:${w}px;height:${h}px}</style>` + crop,
    { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(ROOT, 'assets/ui/page-frame.png'), omitBackground: true });
  console.log('wrote assets/ui/page-frame.png', w + 'x' + h);
  await b.close();
})();
