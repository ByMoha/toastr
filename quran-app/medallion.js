/* ===== Aya-tag medallion overlay =====
 * The mushaf page art ships WITHOUT aya-tags; this module draws them as an
 * overlay from per-page position data (assets/data/layout/<riwaya>/<page>.json).
 *
 * Default: the official aya-tag artwork (assets/ui/ayah-tag.png — the "open"
 * medallion) with the ayah number rendered into its open centre. The artwork
 * ships in the sepia theme; re-theming applies a CSS filter via --tag-tint.
 * A custom generator can still be plugged in via Medallion.asset.
 */
window.Medallion = {
  asset: null, // optional override: (number, size) => element

  // official artwork geometry (kept in sync with assets/ui/ayah-tag.png)
  art: {
    src: "assets/ui/ayah-tag.png",
    w: 40, h: 52,               // native px
    cx: 0.5, cy: 0.515,         // open-centre position (fraction of w/h)
    numScale: 0.42              // number font-size as a fraction of width
  },

  // Build the artwork-based tag: image + Arabic-Indic number in the open centre.
  artNode(number, size) {
    size = size || 46;                       // size = rendered WIDTH
    const a = this.art;
    const h = Math.round(size * a.h / a.w);
    const wrap = document.createElement("span");
    wrap.className = "ayah-tag";
    wrap.style.cssText =
      "position:relative;display:inline-block;width:" + size + "px;height:" + h + "px;";
    const img = document.createElement("img");
    img.src = a.src; img.alt = "";
    // tint on the artwork only, never the number text
    img.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;filter:var(--tag-tint,none);";
    img.draggable = false;
    const num = document.createElement("span");
    // empty number = underlay mode (the page art draws its own bare digit on top)
    num.textContent = number === "" || number == null ? "" : window.toArabicDigits(number);
    num.style.cssText =
      "position:absolute;left:" + (a.cx * 100) + "%;top:" + (a.cy * 100) + "%;" +
      "transform:translate(-50%,-50%);" +
      "font-family:'Amiri Quran','Scheherazade New','Noto Naskh Arabic',serif;" +
      "font-size:" + Math.round(size * a.numScale) + "px;line-height:1;" +
      "color:var(--tag-num,#8a5a24);font-weight:600;";
    wrap.appendChild(img); wrap.appendChild(num);
    return wrap;
  },

  // one medallion as an inline-SVG string (gold rosette + Arabic-Indic number)
  svg(number, size) {
    size = size || 46;
    const cx = 50, cy = 50, points = 16, rOut = 46, rIn = 39;
    let pet = "";
    for (let i = 0; i < points; i++) {
      const a = (Math.PI * 2 * i) / points;
      const x = cx + Math.cos(a) * rOut, y = cy + Math.sin(a) * rOut;
      pet += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6.2" fill="url(#mg)"/>`;
    }
    const num = window.toArabicDigits(number);
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="medallion-svg" aria-label="${number}">
      <defs>
        <radialGradient id="mg" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stop-color="#e7c987"/>
          <stop offset="55%" stop-color="#c69a4c"/>
          <stop offset="100%" stop-color="#9c6a2c"/>
        </radialGradient>
      </defs>
      ${pet}
      <circle cx="${cx}" cy="${cy}" r="${rIn}" fill="url(#mg)"/>
      <circle cx="${cx}" cy="${cy}" r="${rIn - 3}" fill="none" stroke="#8a5a24" stroke-width="1.4" opacity=".55"/>
      <circle cx="${cx}" cy="${cy}" r="${rIn - 9}" fill="#fdf8ee"/>
      <text x="${cx}" y="${cy + 1}" text-anchor="middle" dominant-baseline="central"
            font-family="'Amiri Quran','Scheherazade New','Noto Naskh Arabic',serif"
            font-size="34" fill="#8a5a24" font-weight="600">${num}</text>
    </svg>`;
  },

  node(number, size, style) {
    if (this.asset) return this.asset(number, size);
    if (style === "drawn") {          // legacy placeholder rosette
      const wrap = document.createElement("span");
      wrap.className = "medallion";
      wrap.innerHTML = this.svg(number, size);
      return wrap.firstElementChild;
    }
    return this.artNode(number, size);
  },

  /* Embed mode: a single-file build supplies the artwork inline. */
  init() {
    if (window.__INLINE_TAG) this.art.src = window.__INLINE_TAG;
    return this;
  },

  /* Build an absolutely-positioned overlay for a page.
   * medallions: [{s,a,x,y}] in the art's viewBox coordinates.
   * Returns a container sized to the viewBox; place it over the page art
   * (both scaled together). Skipped entirely when the art has baked medallions. */
  layer(medallions, viewBox, opts) {
    opts = opts || {};
    const size = opts.size || 46;
    const box = document.createElement("div");
    box.className = "medallion-layer";
    box.style.position = "absolute";
    box.style.left = "0"; box.style.top = "0";
    box.style.width = viewBox.w + "px";
    box.style.height = viewBox.h + "px";
    box.style.pointerEvents = "none";
    (medallions || []).forEach((m) => {
      const el = this.node(m.a, size);
      const h = el.style.height ? parseFloat(el.style.height) : size;
      el.style.position = "absolute";
      el.style.left = (m.x - size / 2) + "px";
      el.style.top = (m.y - h / 2) + "px";
      el.dataset.s = m.s; el.dataset.a = m.a;
      box.appendChild(el);
    });
    return box;
  }
};

window.Medallion.init();
