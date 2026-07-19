/* ===== Riwāyāt (calligraphy) registry =====
 *
 * Each riwāya supplies the mushaf PAGE ART (one file per page). Per the design,
 * that art carries NO aya-tag medallions — those are drawn by the app as a
 * separate overlay (see medallion.js) from per-page position data, so the same
 * medallion system works across every calligraphy.
 *
 * To add a calligraphy: register it here, drop its page files under
 * assets/pages/<id>/, and its aya-tag positions under
 * assets/data/layout/<id>/<page>.json  (schema in ARCHITECTURE.md).
 */
window.QURAN_CONFIG = {
  defaultRiwaya: "hafs",

  // number of pages in the standard Madani mushaf
  pages: 604,

  riwayat: {
    hafs: {
      id: "hafs",
      label: "حفص عن عاصم",
      dir: "rtl",
      // page art — SVG per page, WITHOUT aya-tag backgrounds
      page: {
        type: "svg",
        src: (p) => `assets/pages/hafs/${String(p).padStart(3, "0")}.svg`,
        viewBox: { w: 804, h: 1748 } // art coordinate system (overlays map into this)
      },
      // aya-tag medallion overlay
      medallion: { style: "gold-rosette", size: 46 },
      // per-page medallion (+ line) positions
      layout: (p) => `assets/data/layout/hafs/${p}.json`,
      // Sample fallback: until the SVG page-set lands, specific pages can ship as
      // the design capture. `bakedMedallions` = the art already contains aya-tags,
      // so the overlay is suppressed for that page.
      sample: {
        596: { type: "image", src: "assets/img/base.png", bakedMedallions: true }
      }
    },

    qaloon: {
      id: "qaloon",
      label: "قالون عن نافع",
      dir: "rtl",
      page: {
        type: "svg",
        src: (p) => `assets/pages/qaloon/${String(p).padStart(3, "0")}.svg`,
        viewBox: { w: 804, h: 1748 }
      },
      medallion: { style: "gold-rosette", size: 46 },
      layout: (p) => `assets/data/layout/qaloon/${p}.json`,
      sample: {}
    }

    // warsh, al-douri, … register the same way
  }
};
