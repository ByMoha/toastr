const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 852, height: 1796 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto('http://127.0.0.1:8137/index.html', { waitUntil: 'networkidle' });
  // wait for data
  await page.waitForFunction(() => window.Data && window.Data.ready, { timeout: 8000 });
  const dataOk = await page.evaluate(() => ({
    ayat: Object.keys(Data.ayat).length,
    gharib: Object.keys(Data.gharib).length,
    surahs: Data.surahs.length,
    pages: Object.keys(Data.pagemap).length,
    g93_3: Data.gharibOf(93, 3),
    surah93: Data.surahName(93)
  }));
  console.log('DATA:', JSON.stringify(dataOk, null, 0));

  // select verse 3 and inspect the sheet
  await page.evaluate(() => window.__quran.selectAyah('duha-3'));
  await page.waitForTimeout(500);
  const sheet = await page.evaluate(() => {
    const g = document.getElementById('sheetGharib');
    const meds = document.querySelectorAll('#sheetAyah .medallion-svg, #sheetAyah svg').length;
    return {
      gharibText: g.textContent.slice(0, 200),
      gharibHTML_hasQword: /class="qword"/.test(g.innerHTML),
      hasClip: !!document.querySelector('#sheetAyah .clip'),
      medallionRendered: meds
    };
  });
  console.log('SHEET:', JSON.stringify(sheet, null, 0));
  const vp = await page.$('#viewport');
  await vp.screenshot({ path: 'work/v-sheet.png' });

  // medallion overlay sanity: build a layer from the sample layout
  const medLayer = await page.evaluate(async () => {
    const doc = await fetch('assets/data/layout/hafs/596.json').then(r => r.json());
    const layer = Medallion.layer(doc.medallions, doc.viewBox, { size: 46 });
    return { count: layer.querySelectorAll('svg').length, first: doc.medallions[0] };
  });
  console.log('MEDALLION LAYER:', JSON.stringify(medLayer));

  console.log('CONSOLE ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})();
