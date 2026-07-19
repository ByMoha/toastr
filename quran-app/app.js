/* ===== Quran digital — design replica =====
   Coordinates are in the reference screenshot space (804 x 1748). */
(function () {
  "use strict";

  var STAGE_W = 804, STAGE_H = 1748;

  var app = document.getElementById("app");
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

  // The sample page (596) ships as the design image with medallions baked in.
  // A real SVG page-set is medallion-less, so this flips to false and the
  // Medallion overlay takes over. See config.js / ARCHITECTURE.md.
  var PAGE_BAKED_MEDALLIONS = true;

  var medLayer = document.getElementById("medLayer");

  // Live demo of swappable calligraphy on page 596, using two real page-art modes:
  //   baked   = the design capture (aya-tags baked into the art)
  //   overlay = medallion-less art + app-drawn aya-tags — the real SVG pipeline
  var ART = {
    baked:   { img: "assets/img/base.png",        overlay: false },
    overlay: { img: "assets/img/base-notags.png", overlay: true }
  };
  var artMode = "baked";
  function setArt(mode) {
    var a = ART[mode]; if (!a) return;
    artMode = mode;
    stage.style.setProperty("--art", 'url("' + a.img + '")');
    stage.classList.toggle("art-overlay", a.overlay);
    PAGE_BAKED_MEDALLIONS = !a.overlay;
  }
  function cycleRiwaya() { setArt(artMode === "baked" ? "overlay" : "baked"); }

  // build the app-drawn aya-tag overlay for the current page from layout data
  function buildMedallions() {
    if (!window.Data || !window.Medallion || !medLayer) return;
    Data.layout("hafs", 596).then(function (doc) {
      if (!doc) return;
      medLayer.innerHTML = "";
      doc.medallions.forEach(function (m) {
        var el = Medallion.node(m.a, 44);
        el.style.position = "absolute";
        el.style.left = (m.x - 22) + "px";
        el.style.top = (m.y - 22) + "px";
        medLayer.appendChild(el);
      });
    });
  }

  // map each hotspot id prefix -> surah number (page 596 sample surahs)
  var SURAH_OF = { layl: 92, duha: 93, sharh: 94 };
  function idToSA(id) { var p = id.split("-"); return { s: SURAH_OF[p[0]], a: +p[1] }; }

  // load content data (non-blocking; sheet gharib + aya-tag overlay fill in once ready)
  if (window.Data) Data.load().then(buildMedallions).catch(function () {});

  /* -------- Ayah map: rects [x,y,w,h] in stage space -------- */
  // hero = the ayah documented in the reference (Ad-Duha : 3), with tafsir.
  var AYAHS = [
    // --- End of Surah Al-Layl (92) ---
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
    // --- Surah Ad-Duha (93) ---
    { id: "duha-1", rects: [[609,866,163,92]] },
    { id: "duha-2", rects: [[353,866,280,92]] },
    { id: "duha-3", hero: true, rects: [[17,866,360,92]] },
    { id: "duha-4", rects: [[357,968,415,82]] },
    { id: "duha-5", rects: [[30,968,351,82],[653,1064,119,84]] },
    { id: "duha-6", rects: [[327,1064,350,84]] },
    { id: "duha-7", rects: [[17,1064,334,84]] },
    { id: "duha-8", rects: [[405,1160,367,82]] },
    { id: "duha-9", rects: [[17,1160,412,82]] },
    { id: "duha-10", rects: [[427,1256,345,82]] },
    { id: "duha-11", rects: [[17,1256,434,82]] },
    // --- Surah Ash-Sharh (94) ---
    { id: "sharh-1", rects: [[395,1554,377,84]] },
    { id: "sharh-2", rects: [[17,1554,402,84]] }
  ];
  var AYAH_BY_ID = {};
  AYAHS.forEach(function (a) { AYAH_BY_ID[a.id] = a; });

  /* -------- Scale the stage to fit -------- */
  function fit() {
    var pad = window.innerWidth > 540 ? 24 : 0;
    var availW = window.innerWidth - pad * 2;
    var availH = window.innerHeight - pad * 2;
    var s = Math.min(availW / STAGE_W, availH / STAGE_H);
    viewport.style.width = Math.round(STAGE_W * s) + "px";
    viewport.style.height = Math.round(STAGE_H * s) + "px";
    stage.style.transform = "scale(" + s + ")";
  }
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", fit);
  fit();

  /* -------- Build transparent hit targets -------- */
  AYAHS.forEach(function (a) {
    a.rects.forEach(function (r) {
      var b = document.createElement("div");
      b.className = "hit";
      b.style.left = r[0] + "px";
      b.style.top = r[1] + "px";
      b.style.width = r[2] + "px";
      b.style.height = r[3] + "px";
      b.dataset.id = a.id;
      hits.appendChild(b);
    });
  });

  /* -------- Highlight rendering (screen 2) -------- */
  function renderHighlight(a) {
    hl.innerHTML = "";
    a.rects.forEach(function (r, i) {
      var x = r[0], y = r[1], w = r[2], h = r[3];
      // the ayah's closing gold medallion sits at the left edge of its final rect;
      // keep the rose band clear of it so it stays gold.
      var isLast = i === a.rects.length - 1;
      var padL = isLast ? 50 : 7;
      var padR = 7;
      // rose band behind the words (lower portion of the line, rounded ends)
      var bandH = Math.round(h * 0.32);
      var rose = document.createElement("div");
      rose.className = "hl-rose";
      rose.style.left = (x + padL) + "px";
      rose.style.top = (y + Math.round(h * 0.53)) + "px";
      rose.style.width = (w - padL - padR) + "px";
      rose.style.height = bandH + "px";
      hl.appendChild(rose);
      // clean clip multiplied over the dim -> black glyphs, dimmed cream
      var clip = document.createElement("div");
      clip.className = "hl-clip";
      clip.style.left = x + "px";
      clip.style.top = y + "px";
      clip.style.width = w + "px";
      clip.style.height = h + "px";
      clip.style.backgroundPosition = (-x) + "px " + (-y) + "px";
      hl.appendChild(clip);
    });
  }

  /* -------- Sheet content -------- */
  function renderGharib(txt) {
    var esc = txt.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // emphasise the Quranic head-words wrapped in ﴿ ﴾
    return esc.replace(/﴿([^﴾]*)﴾/g, '<span class="qword">﴿$1﴾</span>');
  }

  function fillSheet(a) {
    var sa = idToSA(a.id);
    // ayah calligraphy: enlarged clip of the widest rect from the page art + aya-tag
    var best = a.rects.slice().sort(function (p, q) { return q[2] - p[2]; })[0];
    sheetAyah.classList.add("show");
    sheetAyah.innerHTML = "";
    var f = 1.3; // enlarge the ayah calligraphy in the sheet
    var clip = document.createElement("div");
    clip.className = "clip";
    clip.style.width = Math.round(best[2] * f) + "px";
    clip.style.height = Math.round(best[3] * f) + "px";
    clip.style.backgroundSize = Math.round(804 * f) + "px " + Math.round(1748 * f) + "px";
    clip.style.backgroundPosition = Math.round(-best[0] * f) + "px " + Math.round(-best[1] * f) + "px";
    sheetAyah.appendChild(clip);
    // draw the aya-tag only when the page art is medallion-less; the sample page
    // (page 596 image) already carries baked medallions inside the clip.
    if (window.Medallion && !PAGE_BAKED_MEDALLIONS) {
      var med = Medallion.node(sa.a, 40);
      med.classList.add("sheet-medallion");
      sheetAyah.appendChild(med);
    }
    // gharib gloss (الميسر في غريب القرآن) — real content, per ayah
    var g = (window.Data && Data.gharibOf(sa.s, sa.a)) || "";
    sheetGharib.innerHTML = g ? renderGharib(g) : "";
    sheetGharib.style.display = g ? "" : "none";
  }

  /* -------- State machine -------- */
  var state = { selected: null, sheetOpen: false, fabVisible: false, menuOpen: false };
  var sheetTimer = null;

  function selectAyah(id) {
    var a = AYAH_BY_ID[id];
    if (!a) return;
    state.selected = id;
    setFabVisible(false, true);
    closeMenu();
    renderHighlight(a);
    fillSheet(a);
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    // reset bookmark button visual per selection
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
    // restore floating menu if it was showing before selection
    if (state._fabWas) setFabVisible(true, true);
  }

  function setFabVisible(v, silent) {
    state.fabVisible = v;
    if (!silent) state._fabWas = v;
    if (v) { fabwrap.classList.add("visible"); fabwrap.setAttribute("aria-hidden", "false"); }
    else { fabwrap.classList.remove("visible"); fabwrap.setAttribute("aria-hidden", "true"); closeMenu(); }
  }

  function toggleFab() {
    setFabVisible(!state.fabVisible);
  }

  function openMenu() { fabwrap.dataset.open = "true"; state.menuOpen = true; scrim.classList.add("show"); }
  function closeMenu() { fabwrap.dataset.open = "false"; state.menuOpen = false; scrim.classList.remove("show"); }
  function toggleMenu() { state.menuOpen ? closeMenu() : openMenu(); }

  // scrim behind expanded menu
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

  function endPress(e) {
    if (!press) return;
    clearTimeout(press.timer);
    var wasFired = press.fired;
    var id = press.id;
    press = null;
    if (!wasFired) {
      // short tap on an ayah -> toggle the floating menu (reveals screen 4)
      if (!state.sheetOpen && !state.selected) toggleFab();
    }
  }
  window.addEventListener("pointerup", endPress);
  window.addEventListener("pointermove", function (e) {
    if (!press) return;
    if (Math.abs(e.clientX - press.x) > MOVE_TOL || Math.abs(e.clientY - press.y) > MOVE_TOL) {
      clearTimeout(press.timer); press = null;
    }
  });
  // suppress the browser context menu on long-press
  stage.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  /* -------- Taps on the page background -------- */
  stage.addEventListener("pointerdown", function (e) {
    if (e.target.closest(".hit") || e.target.closest(".sheet") ||
        e.target.closest(".fabwrap") || e.target.closest(".menu-scrim")) return;
    // background press
    if (state.sheetOpen || state.selected) { closeSelection(); return; }
    if (state.menuOpen) { closeMenu(); return; }
    toggleFab();
  });

  /* -------- Overlay dim closes selection -------- */
  overlay.addEventListener("pointerdown", function (e) { e.stopPropagation(); closeSelection(); });
  sheet.addEventListener("pointerdown", function (e) { e.stopPropagation(); });

  /* -------- FAB actions -------- */
  fab.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
  fab.addEventListener("click", function (e) { e.stopPropagation(); toggleMenu(); });
  Array.prototype.forEach.call(document.querySelectorAll(".fab-item"), function (it) {
    it.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    it.addEventListener("click", function (e) {
      e.stopPropagation();
      if (it.dataset.i === "4") cycleRiwaya(); // demo: swap page-art / aya-tag mode
      closeMenu();
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

  // expose for debugging / screenshot harness
  window.__quran = { selectAyah: selectAyah, closeSelection: closeSelection, setFabVisible: setFabVisible, openMenu: openMenu, closeMenu: closeMenu, fit: fit, setArt: setArt, cycleRiwaya: cycleRiwaya };
})();
