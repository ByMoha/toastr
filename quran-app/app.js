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
  var medLayer = document.getElementById("medLayer");
  var pageSlot = document.getElementById("pageSlot");

  var PAGE_BAKED_MEDALLIONS = true;

  /* -------- Art registry (demo switcher) --------
     baked / overlay = the design capture; *-svg = real riwāya pages. */
  var ART = window.__INLINE_ART || {
    "baked":     { img: "assets/img/base.png",        kind: "capture", overlay: false },
    "overlay":   { img: "assets/img/base-notags.png", kind: "capture", overlay: true },
    "hafs-svg":  { img: "assets/pages/hafs/596.svg",  kind: "page", riwaya: "hafs",  page: 596,
                   layoutUrl: "assets/data/layout/hafs/596.svg.json", juz: "الجزء الثلاثون" },
    "warsh-svg": { img: "assets/pages/warsh/300.svg", kind: "page", riwaya: "warsh", page: 300,
                   layoutUrl: "assets/data/layout/warsh/300.svg.json", juz: "الجزء الخامس عشر" }
  };
  var CYCLE = Object.keys(ART);
  var artMode = "baked";

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
    var s = Math.min((STAGE_W - 2 * PAGE_PAD) / t.w, avail / t.h);
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
    pn.style.top = "1652px";
    pn.textContent = window.toArabicDigits(a.page);
  }

  /* -------- Art switching -------- */
  function setArt(mode) {
    var a = ART[mode]; if (!a) return Promise.resolve();
    artMode = mode;
    if (a.kind === "page") {
      return Data.layoutUrl(a.layoutUrl).then(function (layout) {
        if (!layout || artMode !== mode) return;
        stage.classList.add("pagemode");
        stage.classList.remove("art-overlay");
        stage.style.setProperty("--art", 'url("' + a.img + '")');
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
        buildPageChrome(layout, a);
        // live header text: juz (registry) + the surahs of this page. Like the
        // design, prefer surahs that BEGIN on the page (their banner is here);
        // if none begins here, show the continuing surah.
        var starting = [], all = [];
        layout.medallions.forEach(function (m) {
          if (m.s == null) return;
          if (all.indexOf(m.s) < 0) all.push(m.s);
          if (m.a === 1 && starting.indexOf(m.s) < 0) starting.push(m.s);
        });
        var shown = starting.length ? starting : all.slice(0, 1);
        var frame = document.querySelector(".juz-frame");
        frame.classList.toggle("one-surah", shown.length < 2);
        document.getElementById("hdrJuz").textContent = a.juz || "";
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

  /* -------- Settings (riwāya + decoration color) -------- */
  var settings = document.getElementById("settings");
  var settingsDim = document.getElementById("settingsDim");

  function persist(k, v) { try { localStorage.setItem("quran." + k, v); } catch (_) {} }
  function persisted(k) { try { return localStorage.getItem("quran." + k); } catch (_) { return null; } }

  function syncSettingsUI() {
    Array.prototype.forEach.call(document.querySelectorAll(".riwaya-row"), function (r) {
      r.classList.toggle("active", r.dataset.art === artMode);
    });
    var deco = document.body.dataset.deco || "sepia";
    Array.prototype.forEach.call(document.querySelectorAll(".swatch"), function (s) {
      s.classList.toggle("active", s.dataset.deco === deco);
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

  Array.prototype.forEach.call(document.querySelectorAll(".riwaya-row[data-art]"), function (r) {
    if (!r.dataset.art) return;
    r.addEventListener("click", function () {
      setArt(r.dataset.art);
      persist("art", r.dataset.art);
      syncSettingsUI();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll(".swatch"), function (s) {
    s.addEventListener("click", function () {
      var d = s.dataset.deco;
      if (d === "sepia") delete document.body.dataset.deco;
      else document.body.dataset.deco = d;
      persist("deco", d);
      syncSettingsUI();
    });
  });

  // restore persisted choices; the live Hafs page is the default view
  var savedDeco = persisted("deco");
  if (savedDeco && savedDeco !== "sepia") document.body.dataset.deco = savedDeco;
  artMode = ART[persisted("art")] ? persisted("art") : (ART["hafs-svg"] ? "hafs-svg" : "baked");

  // content data, then initial art state
  if (window.Data) Data.load().then(function () { setArt(artMode); }).catch(function () {});
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
      var rose = document.createElement("div");
      rose.className = "hl-rose";
      rose.style.left = (x + padL) + "px";
      rose.style.top = (y + Math.round(h * 0.53)) + "px";
      rose.style.width = Math.max(0, w - padL - padR) + "px";
      rose.style.height = Math.round(h * 0.32) + "px";
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
    var best = e.rects.slice().sort(function (p, q) { return q[2] - p[2]; })[0].slice();
    // page mode: if the SVG's bare digit sits in this rect, trim it out of the
    // clip (the sheet draws the numbered tag itself)
    if (ART[artMode].kind === "page" && e.med &&
        e.med.x >= best[0] && e.med.x <= best[0] + best[2] &&
        e.med.y >= best[1] && e.med.y <= best[1] + best[3]) {
      var newX = e.med.x + TAG_STAGE * 0.55;
      best[2] = Math.max(40, best[0] + best[2] - newX);
      best[0] = newX;
    }
    sheetAyah.classList.add("show");
    sheetAyah.innerHTML = "";
    var f = Math.min(1.3, 640 / best[2]); // enlarge but keep inside the card
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
    actBookmark.classList.remove("saved");
    clearTimeout(sheetTimer);
    sheetTimer = setTimeout(function () {
      sheet.classList.add("show");
      sheet.setAttribute("aria-hidden", "false");
      state.sheetOpen = true;
    }, 250);
  }

  function closeSelection() {
    clearTimeout(sheetTimer);
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

  /* -------- Taps on the page background -------- */
  stage.addEventListener("pointerdown", function (e) {
    if (e.target.closest(".hit") || e.target.closest(".sheet") ||
        e.target.closest(".fabwrap") || e.target.closest(".menu-scrim")) return;
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
    });
  });

  /* -------- Sheet actions -------- */
  actBookmark.addEventListener("click", function (e) {
    e.stopPropagation();
    actBookmark.classList.toggle("saved");
  });
  actShare.addEventListener("click", function (e) {
    e.stopPropagation();
    if (navigator.share) { try { navigator.share({ title: "القرآن الكريم" }); } catch (_) {} }
  });

  window.__quran = {
    selectAyah: selectAyah, closeSelection: closeSelection, setFabVisible: setFabVisible,
    openMenu: openMenu, closeMenu: closeMenu, fit: fit,
    setArt: setArt, cycleRiwaya: cycleRiwaya,
    openSettings: openSettings, closeSettings: closeSettings,
    modes: function () { return CYCLE.slice(); },
    ids: function () { return Object.keys(SEL); }
  };
})();
