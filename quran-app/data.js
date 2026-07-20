/* ===== Content data layer =====
 * Loads the normalised Quran data and exposes simple lookups.
 *   ayat.json     "surah:ayah" -> imlā'ī text          (6236)
 *   gharib.json   "surah:ayah" -> word-meaning gloss    (الميسر في غريب القرآن)
 *   surahs.json   [{n,name,ayahs}]                       (114)
 *   pagemap.json  "page"       -> [[surah,ayah], ...]    (604)
 */
window.Data = {
  ayat: null, gharib: null, surahs: null, pagemap: null, uthmani: null, juzpage: null,
  _layout: {},          // cache: `${riwaya}:${page}` -> layout doc
  ready: false,

  async load() {
    // Embed mode: a single-file build (demo artifact, offline bundle) supplies
    // the datasets inline instead of fetching them.
    if (window.__INLINE_DATA) {
      const d = window.__INLINE_DATA;
      this.ayat = d.ayat || {}; this.gharib = d.gharib || {};
      this.surahs = d.surahs || []; this.pagemap = d.pagemap || {};
      this.uthmani = d.uthmani || {};
      this.juzpage = d.juzpage || {};
      this.ready = true;
      return this;
    }
    const base = "assets/data/";
    const get = (f) => fetch(base + f).then((r) => r.json());
    const [ayat, gharib, surahs, pagemap, uthmani, juzpage] = await Promise.all([
      get("ayat.json"), get("gharib.json"), get("surahs.json"), get("pagemap.json"),
      get("uthmani.json").catch(() => ({})), get("juzpage.json").catch(() => ({}))
    ]);
    this.ayat = ayat; this.gharib = gharib; this.surahs = surahs; this.pagemap = pagemap;
    this.uthmani = uthmani; this.juzpage = juzpage;
    this.ready = true;
    return this;
  },

  // Uthmani ayah text encoded for the KFGQPC Hafs Smart font
  uthmaniOf(s, a) { return (this.uthmani && this.uthmani[s + ":" + a]) || ""; },

  // juz number of a (Hafs-pagination) page
  juzOf(page) { return (this.juzpage && this.juzpage[String(page)]) || null; },

  // first page of each surah (computed once from the pagemap)
  surahStartPage(s) {
    if (!this._surahPage) {
      this._surahPage = {};
      const pages = Object.keys(this.pagemap || {}).map(Number).sort((a, b) => a - b);
      for (const p of pages) {
        for (const [ss, aa] of this.pagemap[String(p)]) {
          if (aa === 1 && this._surahPage[ss] === undefined) this._surahPage[ss] = p;
        }
      }
    }
    return this._surahPage[s] || null;
  },

  ayahText(s, a) { return (this.ayat && this.ayat[s + ":" + a]) || ""; },
  gharibOf(s, a) { return (this.gharib && this.gharib[s + ":" + a]) || ""; },
  hasGharib(s, a) { return !!(this.gharib && this.gharib[s + ":" + a]); },
  surah(n) { return this.surahs && this.surahs[n - 1]; },
  surahName(n) { const x = this.surah(n); return x ? x.name : ""; },
  pageAyat(p) { return (this.pagemap && this.pagemap[String(p)]) || []; },

  // which page a given ayah sits on (first page it appears)
  pageOf(s, a) {
    if (!this.pagemap) return null;
    for (const p in this.pagemap) if (this.pagemap[p].some((x) => x[0] === s && x[1] === a)) return +p;
    return null;
  },

  // load a layout doc by explicit URL (page-SVG mode; embed-aware, cached)
  async layoutUrl(url) {
    if (window.__INLINE_DATA && window.__INLINE_DATA.layoutByUrl && window.__INLINE_DATA.layoutByUrl[url])
      return window.__INLINE_DATA.layoutByUrl[url];
    const key = "url:" + url;
    if (this._layout[key] !== undefined) return this._layout[key];
    let doc = null;
    try { doc = await fetch(url).then((r) => (r.ok ? r.json() : null)); }
    catch (_) { doc = null; }
    this._layout[key] = doc;
    return doc;
  },

  // per-page aya-tag / line layout for a riwāya (cached)
  async layout(riwaya, page) {
    const key = riwaya + ":" + page;
    if (window.__INLINE_DATA && window.__INLINE_DATA.layout && window.__INLINE_DATA.layout[key])
      return window.__INLINE_DATA.layout[key];
    if (this._layout[key] !== undefined) return this._layout[key];
    const cfg = window.QURAN_CONFIG.riwayat[riwaya];
    let doc = null;
    try { doc = await fetch(cfg.layout(page)).then((r) => (r.ok ? r.json() : null)); }
    catch (_) { doc = null; }
    this._layout[key] = doc;
    return doc;
  }
};

/* Arabic-Indic digits, used by medallions and numbering. */
window.toArabicDigits = function (n) {
  return String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);
};
