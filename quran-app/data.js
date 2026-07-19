/* ===== Content data layer =====
 * Loads the normalised Quran data and exposes simple lookups.
 *   ayat.json     "surah:ayah" -> imlā'ī text          (6236)
 *   gharib.json   "surah:ayah" -> word-meaning gloss    (الميسر في غريب القرآن)
 *   surahs.json   [{n,name,ayahs}]                       (114)
 *   pagemap.json  "page"       -> [[surah,ayah], ...]    (604)
 */
window.Data = {
  ayat: null, gharib: null, surahs: null, pagemap: null,
  _layout: {},          // cache: `${riwaya}:${page}` -> layout doc
  ready: false,

  async load() {
    // Embed mode: a single-file build (demo artifact, offline bundle) supplies
    // the datasets inline instead of fetching them.
    if (window.__INLINE_DATA) {
      const d = window.__INLINE_DATA;
      this.ayat = d.ayat || {}; this.gharib = d.gharib || {};
      this.surahs = d.surahs || []; this.pagemap = d.pagemap || {};
      this.ready = true;
      return this;
    }
    const base = "assets/data/";
    const get = (f) => fetch(base + f).then((r) => r.json());
    const [ayat, gharib, surahs, pagemap] = await Promise.all([
      get("ayat.json"), get("gharib.json"), get("surahs.json"), get("pagemap.json")
    ]);
    this.ayat = ayat; this.gharib = gharib; this.surahs = surahs; this.pagemap = pagemap;
    this.ready = true;
    return this;
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
