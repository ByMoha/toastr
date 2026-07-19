/* ===== Aya-tag medallion overlay =====
 * The mushaf page art ships WITHOUT aya-tags; this module draws them as an
 * overlay from per-page position data (assets/data/layout/<riwaya>/<page>.json).
 *
 * The medallion is an app-drawn SVG gold rosette by default. To use an exact
 * asset instead, set Medallion.asset = (number,size) => <SVGElement|HTMLElement>.
 */
window.Medallion = {
  asset: null, // optional override: (number, size) => element

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

  node(number, size) {
    if (this.asset) return this.asset(number, size);
    const wrap = document.createElement("span");
    wrap.className = "medallion";
    wrap.innerHTML = this.svg(number, size);
    return wrap.firstElementChild;
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
      el.style.position = "absolute";
      el.style.left = (m.x - size / 2) + "px";
      el.style.top = (m.y - size / 2) + "px";
      el.dataset.s = m.s; el.dataset.a = m.a;
      box.appendChild(el);
    });
    return box;
  }
};
