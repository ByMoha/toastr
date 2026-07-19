const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const boxes = JSON.parse(fs.readFileSync('work/erase.json'));
  const b64 = fs.readFileSync('assets/img/base.png').toString('base64');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const out = await page.evaluate(async ({ url, boxes }) => {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    ctx.fillStyle = '#fefefa';
    boxes.forEach(([x, y]) => ctx.fillRect(x - 26, y - 26, 52, 52)); // cover the rosette
    return c.toDataURL('image/png');
  }, { url: 'data:image/png;base64,' + b64, boxes });
  fs.writeFileSync('assets/img/base-notags.png', Buffer.from(out.split(',')[1], 'base64'));
  await browser.close();
  console.log('wrote base-notags.png');
})();
