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

  /* Analytics — Microsoft Clarity (heatmaps + session recording + custom events).
   * Create a project at https://clarity.microsoft.com and paste its ID here.
   * Leave the id empty to disable tracking entirely (e.g. local/offline builds). */
  analytics: {
    clarity: { projectId: "", enabled: true }
  },

  /* Shared chrome assets (theme-tintable via CSS vars --tag-tint / --tag-num).
   * The aya-tag is the official "open" medallion — the app renders the ayah
   * number into its open centre (see medallion.js `art`). Banners/header are
   * composed over medallion-less page art when the SVG page-sets land. */
  ui: {
    ayahTag: "assets/ui/ayah-tag.png",
    surahBanner: "assets/ui/surah-banner.png",          // matches the reference design
    surahBannerAlt: "assets/ui/surah-banner-alt.png",
    surahBannerAngular: "assets/ui/surah-banner-angular.png",
    juzHeader: "assets/ui/juz-header.png"
  },

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
    },

    warsh: {
      id: "warsh",
      label: "ورش عن نافع",
      dir: "rtl",
      page: {
        type: "svg",
        src: (p) => `assets/pages/warsh/${String(p).padStart(3, "0")}.svg`,
        // Warsh mushaf pagination differs from the 604-page Hafs Madani mushaf;
        // pageCount + viewBox are confirmed by dev/ingest.js when the set is installed.
        viewBox: { w: 804, h: 1748 }
      },
      medallion: { style: "gold-rosette", size: 46 },
      layout: (p) => `assets/data/layout/warsh/${p}.json`,
      sample: {}
    },

    douri: {
      id: "douri",
      label: "الدوري عن أبي عمرو",
      dir: "rtl",
      page: {
        type: "svg",
        src: (p) => `assets/pages/douri/${String(p).padStart(3, "0")}.svg`,
        viewBox: { w: 804, h: 1748 }
      },
      medallion: { style: "gold-rosette", size: 46 },
      layout: (p) => `assets/data/layout/douri/${p}.json`,
      sample: {}
    }

    // shu'ba, qunbul, … register the same way
  }
};
