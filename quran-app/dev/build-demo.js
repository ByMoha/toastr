/* Build a single-file, self-contained demo of the app (for the hosted artifact).
 * Inlines: patched CSS, page-596 slice of the datasets, both page-art images as
 * data URIs, and all four JS modules. No network requests at runtime.
 * Output: work/demo.html
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const readJson = (f) => JSON.parse(read(f));
const dataUri = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, f)).toString('base64');

const bakedUri = dataUri('assets/img/base.png');
const overlayUri = dataUri('assets/img/base-notags.png');
const tagUri = dataUri('assets/ui/ayah-tag.png');

/* ---- slim data: only what page 596 needs ---- */
const ayat = readJson('assets/data/ayat.json');
const gharib = readJson('assets/data/gharib.json');
const surahs = readJson('assets/data/surahs.json');
const pagemap = readJson('assets/data/pagemap.json');
const layout596 = readJson('assets/data/layout/hafs/596.json');

const keys = pagemap['596'].map(([s, a]) => s + ':' + a);
const pick = (obj) => Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]]));
const inline = {
  ayat: pick(ayat),
  gharib: pick(gharib),
  surahs,
  pagemap: { '596': pagemap['596'] },
  layout: { 'hafs:596': layout596 }
};

/* ---- markup: the .app subtree from index.html ---- */
const html = read('index.html');
const mStart = html.indexOf('<div class="app"');
const mEnd = html.indexOf('<script src=');
if (mStart < 0 || mEnd < 0) throw new Error('index.html markup anchors not found');
const markup = html.slice(mStart, mEnd).trim();

/* ---- css: point the page art at the inlined data URI ---- */
let css = read('styles.css');
if (!css.includes('url("assets/img/base.png")')) throw new Error('styles.css art anchor not found');
css = css.replace('url("assets/img/base.png")', 'url("' + bakedUri + '")');

/* ---- js modules ---- */
const js = ['config.js', 'data.js', 'medallion.js', 'app.js'].map(read).join('\n;\n');

const out = `<title>القرآن الكريم — Quran Digital</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<style>
${css}
</style>
${markup}
<script>
window.__INLINE_DATA = ${JSON.stringify(inline)};
window.__INLINE_ART = {
  baked:   { img: ${JSON.stringify(bakedUri)}, overlay: false },
  overlay: { img: ${JSON.stringify(overlayUri)}, overlay: true }
};
window.__INLINE_TAG = ${JSON.stringify(tagUri)};
</script>
<script>
${js}
</script>
`;

fs.mkdirSync(path.join(ROOT, 'work'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'work/demo.html'), out);
console.log('wrote work/demo.html',
  Math.round(out.length / 1024) + 'KB,',
  'ayat:', Object.keys(inline.ayat).length + ',',
  'gharib:', Object.keys(inline.gharib).length);
