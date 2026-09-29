# القرآن الكريم — Quran digital (web replica)

A pixel-faithful web replica of the Quran digital reading experience shown in the
reference designs. It reproduces the five requested screens exactly and wires them
up as a working, touch-friendly single-page app.

## Screens implemented

1. **Default reading view** — Madani Mushaf page 596 (end of Sūrat al-Layl, all of
   Sūrat aḍ-Ḍuḥā, start of Sūrat ash-Sharḥ) with the ornate Juz/Surah header,
   surah-name banners, gold ayah medallions and the page-number frame.
2. **Long-press on an ayah** — the page dims and the pressed ayah stays crisp with a
   rose highlight band behind its words.
3. **Bottom sheet** — slides up automatically after the highlight. Two actions
   (**share** on the left, **bookmark** on the right — the *play* action was removed
   as requested) plus the selected ayah and its tafsir.
4. **Primary floating menu** — the white circular menu button at the bottom.
5. **Expanded menu** — the button opens an in-place stack of icon actions
   (index, bookmarks, search, settings, night-mode) and the glyph morphs to a close “✕”.

## How to run

It is a static site — no build step, no dependencies.

```bash
# from this folder
npx http-server -p 8137 .      # or: python3 -m http.server 8137
# then open http://127.0.0.1:8137/
```

You can also open `index.html` directly, though a local server is recommended.

### Interactions
- **Long-press** any ayah → highlight, then the tafsir sheet (fully detailed for the
  documented verse, aḍ-Ḍuḥā : 3).
- **Tap** an empty area → show / hide the floating menu.
- **Tap** the menu button → expand / collapse the actions.
- **Tap** the dimmed area → dismiss the sheet.

## How it is built

The whole UI is authored in the reference screenshots' own coordinate space
(**804 × 1748**) and uniformly scaled to fit any viewport, so every measured
position maps 1:1 to the design.

Because the design uses the King-Fahd-Complex *Uthmanic Hafs* calligraphic script
(which is not a system/web font available in this environment), the Arabic
calligraphy is rendered from the reference page itself — exactly how production
mushaf apps render pages — while **all interactive chrome is real HTML/CSS/SVG**:
status bar, dim/highlight, bottom sheet, action buttons, floating menu and icons.

The long-press highlight keeps the selected ayah's glyphs black over the dimmed
page using a `mix-blend-mode: multiply` clip of the clean page (white cream ×
dim = dim unchanged; black glyph × anything = black) with a rose band behind the
words — so it works for **any** ayah, not just the demoed one. Ayah boundaries were
derived by detecting the gold medallions.

## Files

```
index.html        markup + inline SVG icons
styles.css        layout, device frame, sheet, menu, highlight
config.js         riwāyāt (calligraphy) registry — page-art source + medallion style
data.js           content loader + lookups (ayah text, gharib, surahs, pagemap)
medallion.js      app-drawn aya-tag overlay (positioned from layout data)
app.js            scaling, ayah map, long-press + tap state machine, sheet
assets/data/      ayat.json · gharib.json · surahs.json · pagemap.json · layout/<riwaya>/<page>.json
assets/img/       base.png (sample page) · base-notags.png (overlay demo)
dev/              measurement/crop tools, screenshot harness, medallion-demo.html
```

See **ARCHITECTURE.md** for the data-driven, swappable-calligraphy design and the
exact contract for supplying SVG page-sets + aya-tag positions.

## Content data
The bottom sheet renders the **real per-ayah gharib gloss** (*الميسر في غريب القرآن*) for
every ayah, keyed by `surah:ayah`, with the `﴿ ﴾` head-words emphasised. Full Quran text
(imlā'ī), the 604-page↔ayah map, and 114-surah metadata are loaded from `assets/data/`.
Arabic content renders with the device's Arabic font.

## Notes
- **Calligraphy is swappable** (Hafs, Qaloon, …): each riwāya is a set of medallion-less
  page files + an aya-tag position file; medallions are an app overlay. `dev/medallion-demo.html`
  proves the overlay over medallion-less art.
- Page 596 currently ships as the design capture (`sample` in config.js) until the SVG
  page-set lands; then it becomes fully data-driven with the overlay active.
- Screen 5 (expanded menu) is an interpretation — its reference frame wasn't supplied.
- The **international view** (English translation + transliteration) is scaffolded for next.
