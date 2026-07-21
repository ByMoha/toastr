/* ===== Quran digital — design replica =====
   Stage coordinates are the reference screenshot space (804 x 1748).
   Two art modes exist:
     capture — full-stage raster of the design (baked / medallion-less demo)
     page    — a real per-riwāya SVG page rendered into the page slot, with
               app-drawn aya-tags, auto-generated hit zones, and highlight/sheet
               clips driven by the same geometry. */
(function () {
  "use strict";

  var STAGE_W = 804, STAGE_H = 1748;
  // Page-text placement: UNIFORM scale (the calligraphy's aspect is never
  // distorted), sized to the width minus the side padding, centred in the
  // vertical band between the header and the page number.
  var PAGE_PAD = 18;                        // side padding, both sides
  var TEXT_TOP = 176, TEXT_BOTTOM = 1646;   // vertical band bounds

  var viewport = document.getElementById("viewport");
  var stage = document.getElementById("stage");
  var hits = document.getElementById("hits");
  var overlay = document.getElementById("overlay");
  var hl = document.getElementById("hl");
  var sheet = document.getElementById("sheet");
  var sheetAyah = document.getElementById("sheetAyah");
  var sheetGharib = document.getElementById("sheetGharib");
  var fabwrap = document.getElementById("fabwrap");
  var fab = document.getElementById("fab");
  var actShare = document.getElementById("actShare");
  var actBookmark = document.getElementById("actBookmark");
  var mkSwatches = document.getElementById("mkSwatches");
  var medLayer = document.getElementById("medLayer");
  var pageSlot = document.getElementById("pageSlot");

  var PAGE_BAKED_MEDALLIONS = true;

  /* -------- Art registry (demo switcher) --------
     baked / overlay = the design capture; *-svg = real riwāya pages. */
  var ART = window.__INLINE_ART || {
    "baked":     { img: "assets/img/base.png",        kind: "capture", overlay: false },
    "overlay":   { img: "assets/img/base-notags.png", kind: "capture", overlay: true },
    // full page-set: img/layout resolved per page number
    "hafs-svg":  { kind: "page", riwaya: "hafs", template: true, pages: 604, page: 596 },
    "warsh-svg": { img: "assets/pages/warsh/300.svg", kind: "page", riwaya: "warsh", page: 300,
                   layoutUrl: "assets/data/layout/warsh/300.svg.json", juz: "الجزء الخامس عشر" },
    "qaloon-svg": { img: "assets/pages/qaloon/300.svg", kind: "page", riwaya: "qaloon", page: 300,
                   layoutUrl: "assets/data/layout/qaloon/300.svg.json", juz: "الحزب الثلاثون" },
    "douri-svg": { img: "assets/pages/douri/300.svg", kind: "page", riwaya: "douri", page: 300,
                   layoutUrl: "assets/data/layout/douri/300.svg.json", juz: "الجزء الخامس عشر" }
  };
  var CYCLE = Object.keys(ART);
  var artMode = "baked";

  var JUZ_NAMES = ["الأول","الثاني","الثالث","الرابع","الخامس","السادس","السابع","الثامن","التاسع","العاشر",
    "الحادي عشر","الثاني عشر","الثالث عشر","الرابع عشر","الخامس عشر","السادس عشر","السابع عشر","الثامن عشر",
    "التاسع عشر","العشرون","الحادي والعشرون","الثاني والعشرون","الثالث والعشرون","الرابع والعشرون",
    "الخامس والعشرون","السادس والعشرون","السابع والعشرون","الثامن والعشرون","التاسع والعشرون","الثلاثون"];

  // resolve a page-mode entry's art + layout for a given page number
  function artImg(a, p) {
    if (a.imgByPage) return a.imgByPage[p] || null;
    if (a.template) return "assets/pages/" + a.riwaya + "/" + String(p).padStart(3, "0") + ".svg";
    return a.img;
  }
  function artLayoutUrl(a, p) {
    if (a.template || a.imgByPage) return "assets/data/layout/" + a.riwaya + "/" + p + ".svg.json";
    return a.layoutUrl;
  }
  function artHasPage(a, p) {
    if (!a.template && !a.imgByPage) return p === a.page;
    if (a.imgByPage) return !!a.imgByPage[p];
    return p >= 1 && p <= (a.pages || 604);
  }
  function artJuzLabel(a, p) {
    if (a.juz && !a.template) return a.juz;
    var j = window.Data && Data.juzOf(p);
    return j ? "الجزء " + JUZ_NAMES[j - 1] : "";
  }

  // geometry of the current art inside the stage (used by highlight + sheet clips)
  var G = { offX: 0, offY: 0, bgW: STAGE_W, bgH: STAGE_H };
  var TAG_STAGE = 46; // aya-tag width in stage px

  // svg→stage mapping for the current page layout — one uniform scale factor
  var M = null;
  function makeMap(layout) {
    var t = layout.textBox;
    var avail = TEXT_BOTTOM - TEXT_TOP;
    // fit by width (18px sides); if a page is taller than the band, shrink
    // uniformly to fit — padding grows, aspect never changes
    // cap the scale so small ornate pages (e.g. the opening spread) stay
    // elegantly centred instead of blowing up to full width
    var s = Math.min((STAGE_W - 2 * PAGE_PAD) / t.w, avail / t.h, 3.3);
    var ox = (STAGE_W - t.w * s) / 2 - t.x * s;
    var oy = TEXT_TOP + (avail - t.h * s) / 2 - t.y * s;
    return { sx: s, sy: s, ox: ox, oy: oy, vbW: layout.viewBox.w, vbH: layout.viewBox.h };
  }
  function mx(x) { return M.ox + x * M.sx; }
  function my(y) { return M.oy + y * M.sy; }

  /* -------- Selection model --------
     SEL: id -> { id, sa:{s,a}, rects:[[x,y,w,h] stage], med:{x,y} stage|null } */
  var SEL = {};

  // Design-capture ayah map (page 596), hand-measured in stage space.
  var SURAH_OF = { layl: 92, duha: 93, sharh: 94 };
  var AYAHS = [
    { id: "layl-10", rects: [[519,188,253,74]] },
    { id: "layl-11", rects: [[125,188,394,74]] },
    { id: "layl-12", rects: [[30,188,119,74],[643,282,129,74]] },
    { id: "layl-13", rects: [[309,282,358,74]] },
    { id: "layl-14", rects: [[15,282,318,74]] },
    { id: "layl-15", rects: [[439,378,333,82]] },
    { id: "layl-16", rects: [[173,378,290,82]] },
    { id: "layl-17", rects: [[30,378,167,82],[649,482,123,78]] },
    { id: "layl-18", rects: [[333,482,340,78]] },
    { id: "layl-19", rects: [[30,482,327,78],[653,578,119,80]] },
    { id: "layl-20", rects: [[255,578,422,80]] },
    { id: "layl-21", rects: [[15,578,264,80]] },
    { id: "duha-1", rects: [[609,866,163,92]] },
    { id: "duha-2", rects: [[353,866,280,92]] },
    { id: "duha-3", rects: [[17,866,360,92]] },
    { id: "duha-4", rects: [[357,968,415,82]] },
    { id: "duha-5", rects: [[30,968,351,82],[653,1064,119,84]] },
    { id: "duha-6", rects: [[327,1064,350,84]] },
    { id: "duha-7", rects: [[17,1064,334,84]] },
    { id: "duha-8", rects: [[405,1160,367,82]] },
    { id: "duha-9", rects: [[17,1160,412,82]] },
    { id: "duha-10", rects: [[427,1256,345,82]] },
    { id: "duha-11", rects: [[17,1256,434,82]] },
    { id: "sharh-1", rects: [[395,1554,377,84]] },
    { id: "sharh-2", rects: [[17,1554,402,84]] }
  ];

  function buildCaptureSel() {
    SEL = {};
    AYAHS.forEach(function (a) {
      var p = a.id.split("-");
      SEL[a.id] = { id: a.id, sa: { s: SURAH_OF[p[0]], a: +p[1] }, rects: a.rects, med: null };
    });
    return Object.keys(SEL).map(function (k) { return SEL[k]; });
  }

  function buildPageSel(layout) {
    SEL = {};
    var mapR = function (r) {
      return [mx(r[0]), my(r[1]), r[2] * M.sx, r[3] * M.sy]
        .map(function (v) { return Math.round(v * 10) / 10; });
    };
    layout.hits.forEach(function (h, i) {
      var id = h.s != null ? "v-" + h.s + "-" + h.a : "v-x-" + i;
      var med = layout.medallions[i]
        ? { x: mx(layout.medallions[i].x), y: my(layout.medallions[i].y) }
        : null;
      SEL[id] = { id: id, sa: { s: h.s, a: h.a }, rects: h.rects.map(mapR), med: med };
    });
    return Object.keys(SEL).map(function (k) { return SEL[k]; });
  }

  function rebuildHits(entries) {
    hits.innerHTML = "";
    entries.forEach(function (e) {
      e.rects.forEach(function (r) {
        var b = document.createElement("div");
        b.className = "hit";
        b.style.left = r[0] + "px"; b.style.top = r[1] + "px";
        b.style.width = r[2] + "px"; b.style.height = r[3] + "px";
        b.dataset.id = e.id;
        hits.appendChild(b);
      });
    });
  }

  /* -------- Aya-tag layers -------- */
  function placeTag(container, x, y, number) {
    var el = Medallion.node(number, TAG_STAGE);
    var h = el.style.height ? parseFloat(el.style.height) : TAG_STAGE;
    el.style.position = "absolute";
    el.style.left = (x - TAG_STAGE / 2) + "px";
    el.style.top = (y - h / 2) + "px";
    container.appendChild(el);
  }

  // capture-overlay mode: design-space medallions (numbers included — art has none)
  function buildCaptureMedallions() {
    if (!window.Data || !window.Medallion) return;
    Data.layout("hafs", 596).then(function (doc) {
      if (!doc || artMode !== "overlay") return;
      medLayer.innerHTML = "";
      doc.medallions.forEach(function (m) { placeTag(medLayer, m.x, m.y, m.a); });
    });
  }

  // page mode: tags UNDER the SVG's own bare digits (no number in the tag)
  function buildPageMedallions(layout) {
    medLayer.innerHTML = "";
    layout.medallions.forEach(function (m) {
      placeTag(medLayer, mx(m.x), my(m.y), "");
    });
  }

  // page mode chrome: ornate surah banners in the extracted bands + page number
  function buildPageChrome(layout, a) {
    var bl = document.getElementById("bannerLayer");
    bl.innerHTML = "";
    // the banner artwork keeps its natural proportions (768x84), centred on
    // the extracted band — decorations are never stretched
    var BAN_W = 768, BAN_H = 84;
    (layout.banners || []).forEach(function (b) {
      var d = document.createElement("div");
      d.className = "banner";
      var cy = (my(b.y0) + my(b.y1)) / 2;
      d.style.left = Math.round((STAGE_W - BAN_W) / 2) + "px";
      d.style.width = BAN_W + "px";
      d.style.top = Math.round(cy - BAN_H / 2) + "px";
      d.style.height = BAN_H + "px";
      bl.appendChild(d);
    });
    var pn = document.getElementById("pageNum");
    pn.style.top = "1648px";
    pn.innerHTML = '<span class="pn-val">' + window.toArabicDigits(a.page) + "</span>";
  }

  /* -------- Art switching -------- */
  var curPage = null;
  function setArt(mode, pageNum) {
    var a = ART[mode]; if (!a) return Promise.resolve();
    artMode = mode;
    if (a.kind === "page") {
      var p = pageNum || a.page || 1;
      if (!artHasPage(a, p)) return Promise.resolve();
      var prevPage = curPage;
      curPage = p;
      var imgUrl = artImg(a, p);
      return Data.layoutUrl(artLayoutUrl(a, p)).then(function (layout) {
        if (!layout) { if (curPage === p) curPage = prevPage; return; }
        if (artMode !== mode || curPage !== p) return;
        a.page = p; // remember per-mode position
        stage.classList.add("pagemode");
        stage.classList.remove("art-overlay");
        stage.style.setProperty("--art", 'url("' + imgUrl + '")');
        M = makeMap(layout);
        // the page-slot is the full scaled SVG, positioned so its text block
        // fills the design's text region
        pageSlot.style.left = M.ox + "px";
        pageSlot.style.top = M.oy + "px";
        pageSlot.style.width = Math.round(M.vbW * M.sx) + "px";
        pageSlot.style.height = Math.round(M.vbH * M.sy) + "px";
        PAGE_BAKED_MEDALLIONS = false;
        G = { offX: M.ox, offY: M.oy, bgW: M.vbW * M.sx, bgH: M.vbH * M.sy };
        rebuildHits(buildPageSel(layout));
        buildPageMedallions(layout);
        buildPageChrome(layout, { page: p });
        renderPageMarks();
        // live header text: juz (from data) + the surahs of this page. Like the
        // design, prefer surahs that BEGIN on the page (their banner is here);
        // if none begins here, show the continuing surah.
        var starting = [], all = [];
        layout.medallions.forEach(function (m) {
          if (m.s == null) return;
          if (all.indexOf(m.s) < 0) all.push(m.s);
          if (m.a === 1 && starting.indexOf(m.s) < 0) starting.push(m.s);
        });
        // pages may start mid-surah with no digit of the continuing surah row
        if (!all.length && window.Data) {
          Data.pageAyat(p).forEach(function (sa) { if (all.indexOf(sa[0]) < 0) all.push(sa[0]); });
        }
        var shown = starting.length ? starting : all.slice(0, 1);
        var frame = document.querySelector(".juz-frame");
        frame.classList.toggle("one-surah", shown.length < 2);
        document.getElementById("hdrJuz").textContent = artJuzLabel(a, p);
        document.getElementById("hdrS1").textContent = shown[0] != null ? "سُورَةُ " + Data.surahName(shown[0]) : "";
        document.getElementById("hdrS2").textContent = shown[1] != null ? "سُورَةُ " + Data.surahName(shown[1]) : "";
      });
    }
    stage.classList.remove("pagemode");
    stage.style.setProperty("--art", 'url("' + a.img + '")');
    stage.classList.toggle("art-overlay", !!a.overlay);
    PAGE_BAKED_MEDALLIONS = !a.overlay;
    G = { offX: 0, offY: 0, bgW: STAGE_W, bgH: STAGE_H };
    rebuildHits(buildCaptureSel());
    if (a.overlay) buildCaptureMedallions(); else medLayer.innerHTML = "";
    return Promise.resolve();
  }
  function cycleRiwaya() {
    var i = CYCLE.indexOf(artMode);
    setArt(CYCLE[(i + 1) % CYCLE.length]);
  }

  /* -------- Page navigation (swipe) -------- */
  function turnPage(delta) {
    var a = ART[artMode];
    if (!a || a.kind !== "page") return;
    var p = (curPage || a.page) + delta;
    // step over any missing pages (subset bundles)
    var guard = 0;
    while (guard++ < 700 && p >= 1 && p <= (a.pages || 604) && !artHasPage(a, p)) p += delta;
    if (p < 1 || p > (a.pages || 604) || !artHasPage(a, p)) return;
    setArt(artMode, p).then(function () { persist("page." + artMode, p); });
  }
  function goToPage(p) {
    var a = ART[artMode];
    var mode = (a && a.kind === "page" && (a.template || a.imgByPage)) ? artMode : "hafs-svg";
    if (!artHasPage(ART[mode], p)) return;
    setArt(mode, p).then(function () { persist("page." + mode, p); persist("art", mode); });
  }

  /* -------- Table of contents (الفهرس) -------- */
  var toc = document.getElementById("toc");
  var tocDim = document.getElementById("tocDim");
  var tocBuilt = false;

  // fold Arabic to a diacritic/spelling-insensitive form for forgiving search
  function normAr(s) {
    return (s || "")
      .replace(/[ً-ٰٟـ]/g, "")   // tashkeel, superscript alef, tatweel
      .replace(/[أإآٱ]/g, "ا") // hamza-alef variants -> alef
      .replace(/ى/g, "ي")                   // alef maqsura -> ya
      .replace(/ة/g, "ه")                   // ta marbuta -> ha
      .replace(/[ؤئء]/g, "")           // drop lone hamza forms
      .replace(/\s+/g, " ").trim().toLowerCase();
  }
  // Arabic-Indic digits -> Latin so "٩٣" and "93" both match
  function toLatinDigits(s) {
    return (s || "").replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x0660; });
  }

  function buildToc() {
    if (tocBuilt || !window.Data || !Data.surahs) return;
    var list = document.getElementById("tocList");
    var emptyEl = document.getElementById("tocEmpty");
    Data.surahs.forEach(function (s) {
      var pageN = Data.surahStartPage(s.n);
      var row = document.createElement("button");
      row.className = "toc-row";
      row.dataset.name = normAr("سورة " + s.name);
      row.dataset.n = String(s.n);
      row.innerHTML =
        '<span class="toc-num">' + window.toArabicDigits(s.n) + '</span>' +
        '<span class="toc-name">سُورَةُ ' + s.name + '</span>' +
        '<span class="toc-page">' + (pageN ? window.toArabicDigits(pageN) : "") + '</span>';
      row.addEventListener("click", function () {
        if (pageN) goToPage(pageN);
        closeToc();
      });
      list.insertBefore(row, emptyEl);
    });
    tocBuilt = true;
  }

  function filterToc(q) {
    var listEl = document.getElementById("tocList");
    var emptyEl = document.getElementById("tocEmpty");
    var nameQ = normAr(q);
    var numQ = toLatinDigits(q).replace(/[^\d]/g, "");
    var rows = listEl.querySelectorAll(".toc-row"), shown = 0;
    Array.prototype.forEach.call(rows, function (row) {
      var ok = !q.trim() ||
        (nameQ && row.dataset.name.indexOf(nameQ) >= 0) ||
        (numQ && row.dataset.n === numQ) ||
        (numQ && row.dataset.n.indexOf(numQ) === 0);
      row.hidden = !ok;
      if (ok) shown++;
    });
    if (emptyEl) emptyEl.hidden = shown > 0;
  }

  var tocSearch = document.getElementById("tocSearch");
  if (tocSearch) tocSearch.addEventListener("input", function () { filterToc(tocSearch.value); });

  function openToc() {
    buildToc();
    if (tocSearch) { tocSearch.value = ""; filterToc(""); }
    tocDim.classList.add("show"); toc.classList.add("show"); toc.setAttribute("aria-hidden", "false");
  }
  function closeToc() { tocDim.classList.remove("show"); toc.classList.remove("show"); toc.setAttribute("aria-hidden", "true"); }
  tocDim.addEventListener("pointerdown", function (e) { e.stopPropagation(); closeToc(); });
  toc.addEventListener("pointerdown", function (e) { e.stopPropagation(); });

  /* -------- Saved marks / favorites screen -------- */
  var marksScreen = document.getElementById("marksScreen");
  var marksDim = document.getElementById("marksDim");
  function buildMarksList() {
    var list = document.getElementById("marksList");
    var emptyEl = document.getElementById("marksEmpty");
    Array.prototype.forEach.call(list.querySelectorAll(".mark-cardwrap"), function (r) { r.remove(); });
    var keys = Object.keys(MARKS);
    keys.sort(function (a, b) {
      var pa = a.split(":").map(Number), pb = b.split(":").map(Number);
      return pa[0] - pb[0] || pa[1] - pb[1];
    });
    keys.forEach(function (k) {
      var parts = k.split(":"), s = +parts[0], a = +parts[1], color = MARKS[k];
      var name = (window.Data && Data.surahName) ? Data.surahName(s) : String(s);
      var text = (window.Data && Data.uthmaniOf && Data.uthmaniOf(s, a)) || "";
      text = text.replace(/\s*\u200F?[\uE900-\uEB00]$/, "");
      if (!text) text = (window.Data && Data.ayahText && Data.ayahText(s, a)) || "";

      var wrap = document.createElement("div");
      wrap.className = "mark-cardwrap";
      wrap.style.setProperty("--c", color);
      var del = document.createElement("div");
      del.className = "mark-swipe-del";
      del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>';
      var card = document.createElement("div");
      card.className = "mark-card";
      card.innerHTML =
        '<div class="mark-card-top">' +
          '<span class="mc-surah"><span class="mc-med"></span>سُورَةُ ' + name + '</span>' +
          '<span class="mc-tag"><span class="mc-num">آية ' + window.toArabicDigits(a) + '</span>' +
            '<svg class="mc-flag" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.5 3h11a1 1 0 0 1 1 1v17l-6.5-4.7L5.5 21V4a1 1 0 0 1 1-1Z"/></svg>' +
          '</span>' +
        '</div>' +
        '<div class="mc-text" dir="rtl"></div>';
      card.querySelector(".mc-text").textContent = text;
      if (window.Medallion) card.querySelector(".mc-med").appendChild(Medallion.node(a, 34));
      wrap.appendChild(del);
      wrap.appendChild(card);
      attachSwipeDelete(wrap, card);
      card.addEventListener("click", function () {
        if (wrap.dataset.swiped === "1") return;
        var page = (window.Data && Data.pageOf && Data.pageOf(s, a)) ||
          (window.Data && Data.surahStartPage && Data.surahStartPage(s));
        closeMarks();
        if (page) goToPage(page);
      });
      del.addEventListener("click", function () { setMark(s, a, null); buildMarksList(); });
      list.insertBefore(wrap, emptyEl);
    });
    emptyEl.hidden = keys.length > 0;
  }

  // iOS-style swipe-left to reveal a delete action on a favorites card
  function attachSwipeDelete(wrap, card) {
    var startX = 0, dx = 0, dragging = false, open = false;
    var OPEN = 96, THRESH = 46;
    card.addEventListener("pointerdown", function (e) {
      dragging = true; startX = e.clientX; card.style.transition = "none";
      try { card.setPointerCapture(e.pointerId); } catch (_) {}
    });
    card.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      dx = e.clientX - startX + (open ? -OPEN : 0);
      if (dx > 0) dx = 0; if (dx < -OPEN - 20) dx = -OPEN - 20;
      card.style.transform = "translateX(" + dx + "px)";
      if (Math.abs(dx) > 6) wrap.dataset.swiped = "1";
    });
    function end() {
      if (!dragging) return; dragging = false;
      card.style.transition = "transform .22s ease";
      open = dx < -THRESH;
      card.style.transform = "translateX(" + (open ? -OPEN : 0) + "px)";
      setTimeout(function () { wrap.dataset.swiped = "0"; }, 80);
    }
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", end);
  }

  function openMarks() {
    buildMarksList();
    marksDim.classList.add("show"); marksScreen.classList.add("show"); marksScreen.setAttribute("aria-hidden", "false");
  }
  function closeMarks() { marksDim.classList.remove("show"); marksScreen.classList.remove("show"); marksScreen.setAttribute("aria-hidden", "true"); }
  marksDim.addEventListener("pointerdown", function (e) { e.stopPropagation(); closeMarks(); });
  marksScreen.addEventListener("pointerdown", function (e) { e.stopPropagation(); });

  /* -------- Settings (riwāya + decoration color) -------- */
  var settings = document.getElementById("settings");
  var settingsDim = document.getElementById("settingsDim");

  // riwāya cards preview the real page art of each calligraphy
  Array.prototype.forEach.call(document.querySelectorAll(".rw-card[data-art]"), function (r) {
    var a = ART[r.dataset.art];
    if (a) r.querySelector(".rw-thumb").style.backgroundImage = 'url("' + a.img + '")';
  });

  function persist(k, v) { try { localStorage.setItem("quran." + k, v); } catch (_) {} }
  function persisted(k) { try { return localStorage.getItem("quran." + k); } catch (_) { return null; } }

  /* -------- Ayah marks (persistent favorites) -------- */
  var MARK_COLORS = ["#c8a34e", "#5c9a68", "#5486b0", "#a86a9e", "#c76b6b"];
  var MARKS = {};
  try { MARKS = JSON.parse(persisted("marks") || "{}") || {}; } catch (_) { MARKS = {}; }
  var lastMarkColor = persisted("markColor") || MARK_COLORS[0];
  function markKey(s, a) { return s + ":" + a; }
  function getMark(s, a) { return (s != null && MARKS[markKey(s, a)]) || null; }
  function setMark(s, a, color) {
    if (s == null || a == null) return;
    if (color) { MARKS[markKey(s, a)] = color; lastMarkColor = color; persist("markColor", color); }
    else delete MARKS[markKey(s, a)];
    persist("marks", JSON.stringify(MARKS));
    renderPageMarks();
  }

  // draw a soft colour band behind every marked ayah on the current page
  function renderPageMarks() {
    var layer = document.getElementById("marksLayer");
    if (!layer) return;
    layer.innerHTML = "";
    if (!SEL) return;
    Object.keys(SEL).forEach(function (id) {
      var e = SEL[id]; if (!e.sa) return;
      var color = getMark(e.sa.s, e.sa.a);
      if (!color) return;
      e.rects.forEach(function (r, i) {
        var x = r[0], y = r[1], w = r[2], h = r[3];
        var isLast = i === e.rects.length - 1;
        var padL = isLast ? 46 : 6, padR = 6;
        var band = document.createElement("div");
        band.className = "mark-band";
        band.style.background = color;
        band.style.left = (x + padL) + "px";
        band.style.top = (y + Math.round(h * 0.34)) + "px";
        band.style.width = Math.max(0, w - padL - padR) + "px";
        band.style.height = Math.round(h * 0.40) + "px";
        layer.appendChild(band);
      });
    });
  }

  function syncSettingsUI() {
    Array.prototype.forEach.call(document.querySelectorAll(".rw-card"), function (r) {
      r.classList.toggle("active", r.dataset.art === artMode);
    });
    var deco = document.body.dataset.deco || "sepia";
    Array.prototype.forEach.call(document.querySelectorAll(".theme-chip"), function (s) {
      s.classList.toggle("active", s.dataset.deco === deco);
    });
    var orn = document.body.dataset.orn || "1";
    Array.prototype.forEach.call(document.querySelectorAll(".orn-chip"), function (s) {
      s.classList.toggle("active", s.dataset.orn === orn);
    });
  }
  function openSettings() {
    syncSettingsUI();
    settingsDim.classList.add("show");
    settings.classList.add("show");
    settings.setAttribute("aria-hidden", "false");
  }
  function closeSettings() {
    settingsDim.classList.remove("show");
    settings.classList.remove("show");
    settings.setAttribute("aria-hidden", "true");
  }
  settingsDim.addEventListener("pointerdown", function (e) { e.stopPropagation(); closeSettings(); });
  settings.addEventListener("pointerdown", function (e) { e.stopPropagation(); });

  Array.prototype.forEach.call(document.querySelectorAll(".rw-card[data-art]"), function (r) {
    if (!r.dataset.art) return;
    r.addEventListener("click", function () {
      setArt(r.dataset.art);
      persist("art", r.dataset.art);
      syncSettingsUI();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll(".theme-chip"), function (s) {
    s.addEventListener("click", function () {
      var d = s.dataset.deco;
      if (d === "sepia") delete document.body.dataset.deco;
      else document.body.dataset.deco = d;
      persist("deco", d);
      syncSettingsUI();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll(".orn-chip"), function (s) {
    s.addEventListener("click", function () {
      var o = s.dataset.orn;
      if (o === "1") delete document.body.dataset.orn;
      else document.body.dataset.orn = o;
      persist("orn", o);
      syncSettingsUI();
    });
  });

  // restore persisted choices; the live Hafs page is the default view
  var savedDeco = persisted("deco");
  if (savedDeco && savedDeco !== "sepia") document.body.dataset.deco = savedDeco;
  var savedOrn = persisted("orn");
  if (savedOrn && savedOrn !== "1") document.body.dataset.orn = savedOrn;
  artMode = ART[persisted("art")] ? persisted("art") : (ART["hafs-svg"] ? "hafs-svg" : "baked");
  var savedPage = parseInt(persisted("page." + artMode), 10) || null;

  // content data, then initial art state
  if (window.Data) Data.load().then(function () { setArt(artMode, savedPage); }).catch(function () {});
  else rebuildHits(buildCaptureSel());

  /* -------- Scale the stage to fit -------- */
  function fit() {
    var pad = window.innerWidth > 540 ? 24 : 0;
    var s = Math.min((window.innerWidth - pad * 2) / STAGE_W, (window.innerHeight - pad * 2) / STAGE_H);
    viewport.style.width = Math.round(STAGE_W * s) + "px";
    viewport.style.height = Math.round(STAGE_H * s) + "px";
    stage.style.transform = "scale(" + s + ")";
  }
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", fit);
  fit();

  /* -------- Highlight rendering (screen 2) -------- */
  function renderHighlight(e) {
    hl.innerHTML = "";
    var isPage = ART[artMode].kind === "page";
    e.rects.forEach(function (r, i) {
      var x = r[0], y = r[1], w = r[2], h = r[3];
      var isLast = i === e.rects.length - 1;
      var padL = isLast ? 50 : 7, padR = 7;
      // rose marker sits *behind* the glyph bodies (straddling the baseline),
      // so the multiplied page-art clip on top reads as a highlighter — black
      // words over rose — rather than a solid bar in the descender gap.
      var rose = document.createElement("div");
      rose.className = "hl-rose";
      rose.style.left = (x + padL) + "px";
      rose.style.top = (y + Math.round(h * 0.34)) + "px";
      rose.style.width = Math.max(0, w - padL - padR) + "px";
      rose.style.height = Math.round(h * 0.40) + "px";
      hl.appendChild(rose);
      // page mode: the ayah's tag artwork stays visible inside the highlight
      if (isPage && e.med && e.med.x >= x && e.med.x <= x + w &&
          e.med.y >= y && e.med.y <= y + h) {
        var tagWrap = document.createElement("div");
        tagWrap.style.position = "absolute";
        tagWrap.style.left = "0"; tagWrap.style.top = "0";
        placeTag(tagWrap, e.med.x, e.med.y, "");
        hl.appendChild(tagWrap);
      }
      // clean clip multiplied over the dim -> glyphs stay black
      var clip = document.createElement("div");
      clip.className = "hl-clip";
      clip.style.left = x + "px"; clip.style.top = y + "px";
      clip.style.width = w + "px"; clip.style.height = h + "px";
      clip.style.backgroundSize = G.bgW + "px " + G.bgH + "px";
      clip.style.backgroundPosition = (G.offX - x) + "px " + (G.offY - y) + "px";
      hl.appendChild(clip);
    });
  }

  /* -------- Sheet content -------- */
  function renderGharib(txt) {
    var esc = txt.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc.replace(/﴿([^﴾]*)﴾/g, '<span class="qword">﴿$1﴾</span>');
  }

  function fillSheet(e) {
    var sa = e.sa;
    sheetAyah.classList.add("show");
    sheetAyah.innerHTML = "";

    // Preferred: the ayah as live text in the official Hafs Smart font,
    // with the numbered aya-tag artwork beside it.
    var uth = (sa.s != null && window.Data && Data.uthmaniOf(sa.s, sa.a)) || "";
    if (uth) {
      var txt = document.createElement("div");
      txt.className = "sheet-ayah-text";
      // drop the font's trailing end-of-ayah mark — the design closes the
      // ayah with the gold aya-tag artwork instead
      txt.textContent = uth.replace(/\s*\u200F?[\uE900-\uEB00]$/, "");
      sheetAyah.appendChild(txt);
      if (window.Medallion) {
        var med0 = Medallion.node(sa.a, 44);
        med0.classList.add("sheet-medallion");
        sheetAyah.appendChild(med0);
      }
    } else {
      // Fallback: clip the calligraphy from the page art.
      var best = e.rects.slice().sort(function (p, q) { return q[2] - p[2]; })[0].slice();
      if (ART[artMode].kind === "page" && e.med &&
          e.med.x >= best[0] && e.med.x <= best[0] + best[2] &&
          e.med.y >= best[1] && e.med.y <= best[1] + best[3]) {
        var newX = e.med.x + TAG_STAGE * 0.55;
        best[2] = Math.max(40, best[0] + best[2] - newX);
        best[0] = newX;
      }
      var f = Math.min(1.3, 640 / best[2]);
      var clip = document.createElement("div");
      clip.className = "clip";
      clip.style.width = Math.round(best[2] * f) + "px";
      clip.style.height = Math.round(best[3] * f) + "px";
      clip.style.backgroundSize = Math.round(G.bgW * f) + "px " + Math.round(G.bgH * f) + "px";
      clip.style.backgroundPosition = Math.round((G.offX - best[0]) * f) + "px " + Math.round((G.offY - best[1]) * f) + "px";
      sheetAyah.appendChild(clip);
      if (window.Medallion && !PAGE_BAKED_MEDALLIONS && sa.a != null) {
        var med = Medallion.node(sa.a, 40);
        med.classList.add("sheet-medallion");
        sheetAyah.appendChild(med);
      }
    }
    var g = (sa.s != null && window.Data && Data.gharibOf(sa.s, sa.a)) || "";
    sheetGharib.innerHTML = g ? renderGharib(g) : "";
    sheetGharib.style.display = g ? "" : "none";
  }

  /* -------- State machine -------- */
  var state = { selected: null, sheetOpen: false, fabVisible: false, menuOpen: false };
  var sheetTimer = null;

  function selectAyah(id) {
    var e = SEL[id];
    if (!e) return;
    state.selected = id;
    setFabVisible(false, true);
    closeMenu();
    renderHighlight(e);
    fillSheet(e);
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    state.sheetAyah = e.sa;
    syncSheetMarks(e.sa);
    resetPlayer();
    clearTimeout(sheetTimer);
    sheetTimer = setTimeout(function () {
      sheet.classList.add("show");
      sheet.setAttribute("aria-hidden", "false");
      state.sheetOpen = true;
    }, 250);
  }

  function closeSelection() {
    clearTimeout(sheetTimer);
    resetPlayer();
    sheet.classList.remove("show");
    sheet.setAttribute("aria-hidden", "true");
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
    state.sheetOpen = false;
    state.selected = null;
    if (state._fabWas) setFabVisible(true, true);
  }

  function setFabVisible(v, silent) {
    state.fabVisible = v;
    if (!silent) state._fabWas = v;
    if (v) { fabwrap.classList.add("visible"); fabwrap.setAttribute("aria-hidden", "false"); }
    else { fabwrap.classList.remove("visible"); fabwrap.setAttribute("aria-hidden", "true"); closeMenu(); }
  }
  function toggleFab() { setFabVisible(!state.fabVisible); }

  function openMenu() { fabwrap.dataset.open = "true"; state.menuOpen = true; scrim.classList.add("show"); }
  function closeMenu() { fabwrap.dataset.open = "false"; state.menuOpen = false; scrim.classList.remove("show"); }
  function toggleMenu() { state.menuOpen ? closeMenu() : openMenu(); }

  var scrim = document.createElement("div");
  scrim.className = "menu-scrim";
  stage.insertBefore(scrim, fabwrap);
  scrim.addEventListener("pointerdown", function (e) { e.stopPropagation(); closeMenu(); });

  /* -------- Pointer / long-press handling -------- */
  var LONG = 380, MOVE_TOL = 12;
  var press = null;

  hits.addEventListener("pointerdown", function (e) {
    var t = e.target.closest(".hit");
    if (!t) return;
    press = { id: t.dataset.id, x: e.clientX, y: e.clientY, fired: false };
    press.timer = setTimeout(function () {
      press.fired = true;
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
      selectAyah(press.id);
    }, LONG);
  });

  function endPress() {
    if (!press) return;
    clearTimeout(press.timer);
    var wasFired = press.fired;
    press = null;
    if (!wasFired && !state.sheetOpen && !state.selected) toggleFab();
  }
  window.addEventListener("pointerup", endPress);
  window.addEventListener("pointermove", function (e) {
    if (!press) return;
    if (Math.abs(e.clientX - press.x) > MOVE_TOL || Math.abs(e.clientY - press.y) > MOVE_TOL) {
      clearTimeout(press.timer); press = null;
    }
  });
  stage.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  /* -------- Background taps + horizontal swipes (page turning) -------- */
  var gest = null;
  stage.addEventListener("pointerdown", function (e) {
    if (e.target.closest(".sheet") || e.target.closest(".fabwrap") ||
        e.target.closest(".menu-scrim") || e.target.closest(".settings") ||
        e.target.closest(".settings-dim")) { gest = null; return; }
    gest = { x: e.clientX, y: e.clientY, onHit: !!e.target.closest(".hit") };
  });
  window.addEventListener("pointerup", function (e) {
    if (!gest) return;
    var dx = e.clientX - gest.x, dy = e.clientY - gest.y;
    var g = gest; gest = null;
    // swipe: horizontal, decisive — turn the page (RTL book: swipe right = forward)
    if (Math.abs(dx) > 64 && Math.abs(dx) > 1.6 * Math.abs(dy)) {
      if (state.sheetOpen || state.selected || state.menuOpen) return;
      turnPage(dx > 0 ? 1 : -1);
      return;
    }
    // small movement = tap; hits handle their own taps via endPress
    if (Math.abs(dx) > 12 || Math.abs(dy) > 12 || g.onHit) return;
    if (state.sheetOpen || state.selected) { closeSelection(); return; }
    if (state.menuOpen) { closeMenu(); return; }
    toggleFab();
  });

  overlay.addEventListener("pointerdown", function (e) { e.stopPropagation(); closeSelection(); });
  sheet.addEventListener("pointerdown", function (e) { e.stopPropagation(); });

  /* -------- FAB actions -------- */
  fab.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
  fab.addEventListener("click", function (e) { e.stopPropagation(); toggleMenu(); });
  Array.prototype.forEach.call(document.querySelectorAll(".fab-item"), function (it) {
    it.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    it.addEventListener("click", function (e) {
      e.stopPropagation();
      closeMenu();
      if (it.dataset.i === "4") { setFabVisible(false, true); openSettings(); }
      if (it.dataset.i === "1") { setFabVisible(false, true); openToc(); }
      if (it.dataset.i === "2") { setFabVisible(false, true); openMarks(); }
      if (it.dataset.i === "3") { setFabVisible(false, true); openToc(); if (tocSearch) tocSearch.focus(); }
    });
  });

  /* -------- Sheet actions -------- */
  // reflect the current ayah's mark (bookmark fill + active swatch)
  function syncSheetMarks(sa) {
    var color = sa ? getMark(sa.s, sa.a) : null;
    actBookmark.classList.toggle("saved", !!color);
    actBookmark.style.color = color || "";
    Array.prototype.forEach.call(mkSwatches.querySelectorAll(".mk-sw"), function (sw) {
      sw.classList.toggle("active", color ? sw.dataset.c === color : sw.dataset.c === lastMarkColor);
    });
  }
  // tap a colour: mark this ayah with it, or unmark if it's the current colour
  Array.prototype.forEach.call(mkSwatches.querySelectorAll(".mk-sw"), function (sw) {
    sw.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var sa = state.sheetAyah; if (!sa) return;
      var c = sw.dataset.c;
      setMark(sa.s, sa.a, getMark(sa.s, sa.a) === c ? null : c);
      syncSheetMarks(sa);
    });
  });
  actBookmark.addEventListener("click", function (e) {
    e.stopPropagation();
    var sa = state.sheetAyah; if (!sa) return;
    setMark(sa.s, sa.a, getMark(sa.s, sa.a) ? null : lastMarkColor);
    syncSheetMarks(sa);
  });
  actShare.addEventListener("click", function (e) {
    e.stopPropagation();
    if (navigator.share) { try { navigator.share({ title: "القرآن الكريم" }); } catch (_) {} }
  });

  /* -------- Recitation player (UI; wires to <audio> when a source exists) -------- */
  var actPlay = document.getElementById("actPlay");
  var sheetProgress = document.getElementById("sheetProgress");
  var spFill = document.getElementById("spFill");
  var spKnob = document.getElementById("spKnob");
  var spCur = document.getElementById("spCur");
  var spDur = document.getElementById("spDur");
  var player = { playing: false, t: 0, dur: 93, timer: null };
  function fmtTime(s) {
    s = Math.max(0, Math.round(s));
    var m = Math.floor(s / 60), ss = s % 60;
    return m + ":" + (ss < 10 ? "0" : "") + ss;
  }
  function paintPlayer() {
    var pct = player.dur ? Math.min(1, player.t / player.dur) : 0;
    spFill.style.width = (pct * 100) + "%";
    spKnob.style.left = (pct * 100) + "%";
    spCur.textContent = fmtTime(player.t);
    spDur.textContent = fmtTime(player.dur);
  }
  function setPlaying(on) {
    player.playing = on;
    actPlay.classList.toggle("playing", on);
    sheetProgress.hidden = !on && player.t === 0;
    clearInterval(player.timer);
    if (on) {
      sheetProgress.hidden = false;
      player.timer = setInterval(function () {
        player.t += 0.25;
        if (player.t >= player.dur) { player.t = player.dur; paintPlayer(); setPlaying(false); return; }
        paintPlayer();
      }, 250);
    }
  }
  function resetPlayer() { setPlaying(false); player.t = 0; sheetProgress.hidden = true; paintPlayer(); }
  actPlay.addEventListener("click", function (e) {
    e.stopPropagation();
    setPlaying(!player.playing);
    paintPlayer();
  });
  spTrackSeek();
  function spTrackSeek() {
    var track = document.getElementById("spTrack");
    if (!track) return;
    track.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
      var r = track.getBoundingClientRect();
      player.t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * player.dur;
      paintPlayer();
    });
  }

  /* -------- Universal press ripple -------- */
  var RIPPLE_SEL = ".pill,.fab,.fab-item,.rw-card,.theme-chip,.orn-chip,.mk-sw,.toc-row,.mark-row,.mark-del";
  document.addEventListener("pointerdown", function (e) {
    var el = e.target.closest(RIPPLE_SEL);
    if (!el) return;
    var r = el.getBoundingClientRect();
    var size = Math.max(r.width, r.height) * 1.1;
    var rip = document.createElement("span");
    rip.className = "ripple";
    rip.style.width = rip.style.height = size + "px";
    rip.style.left = (e.clientX - r.left - size / 2) + "px";
    rip.style.top = (e.clientY - r.top - size / 2) + "px";
    el.appendChild(rip);
    setTimeout(function () { rip.remove(); }, 560);
  }, true);

  window.__quran = {
    selectAyah: selectAyah, closeSelection: closeSelection, setFabVisible: setFabVisible,
    openMenu: openMenu, closeMenu: closeMenu, fit: fit,
    setArt: setArt, cycleRiwaya: cycleRiwaya,
    turnPage: turnPage, goToPage: goToPage,
    openToc: openToc, closeToc: closeToc,
    openMarks: openMarks, closeMarks: closeMarks,
    openSettings: openSettings, closeSettings: closeSettings,
    modes: function () { return CYCLE.slice(); },
    ids: function () { return Object.keys(SEL); }
  };
})();
