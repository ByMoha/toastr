# Quran Digital — Native iOS App: BRD & Implementation Guide

As of 2026-09-29 · Living copy (with the architecture drawing): https://claude.ai/code/artifact/e48ec7c7-676d-4db2-b679-f0583d610ecb

## 1. Executive summary

Quran Digital is a pixel-faithful digital mushaf: the 604-page Hafs Madinah Quran rendered from per-page calligraphy, with app-drawn chrome, ayah tools and a translation view. A complete, verified web reference implementation exists on branch `claude/quran-digital-app-148rpr` (PR #1: https://github.com/ByMoha/toastr/pull/1): about 2,400 lines of vanilla JS/CSS/HTML, 604 page SVGs, 604 layout files, the KFGQPC Hafs Smart font and the content datasets. This document hands that build off for a native iOS rebuild.

Built and verified in the web version:
- Full mushaf: all 604 Hafs pages, swipe and index navigation, a juz · surah · hizb header and the page-number cartouche.
- Ayah tools: long-press selection with highlight, a sheet showing the Uthmani text and gharib tafsir, share, recitation controls, coloured persistent marks and a favorites screen.
- Reading modes: mushaf, and translation (per-ayah cards with transliteration and English).
- Settings: four riwayat (Hafs complete; Warsh, Qaloon and Douri one sample page each), six themes including dark, three decoration styles.
- Material speed-dial menu, a universal press ripple, and Microsoft Clarity analytics hooks.

Recommended path: wrap the web app with Capacitor. It reuses everything, ships to the App Store and adds native share, haptics, audio and offline bundling. A full SwiftUI rewrite is the alternative; §7 maps it module by module. The Xcode build, signing and submission run on a Mac. Live demo (pages 593–604 only): https://claude.ai/code/artifact/df76a483-0f5f-4109-9268-5ebac6371682

## 2. Goals, users and success criteria

Goal: a native iOS mushaf that reproduces the web reference exactly, works fully offline, and ships on the App Store for iPhone and iPad.

Users:
- Daily readers who want the printed Madinah mushaf on a phone, page-faithful, in their chosen calligraphy.
- Learners who read with transliteration and an English meaning (the translation view).
- Memorizers and reviewers who mark ayat in colour, return to favorites and listen to recitation.

Success criteria (performance figures are proposed targets to confirm):

| Criterion | Target |
| --- | --- |
| Visual fidelity | Every screen matches the reference designs and the web build; decoration artwork is never stretched |
| Offline | All 604 pages, layouts, datasets and fonts bundled in the app; reading needs no network |
| Persistence | Last page, riwaya, theme, decoration, reading mode and every mark survive relaunch |
| Content | Uthmani text rendered in Hafs Smart; gharib tafsir available for every ayah |
| Page turn | Next page rendered within 100 ms of the swipe on iPhone 12 or newer (proposed) |
| Cold start | First page visible within 1.5 s (proposed) |
| Store | Passes App Store review; iOS 16 and later (proposed) |
| Analytics | Clarity session recording plus the custom events in §6 |

## 3. Functional scope

The iOS app reproduces seven screens and eleven behaviours of the reference build; every number below is measured from the web code (stage px unless marked client px).

| Screen | Opened by | Holds |
| --- | --- | --- |
| Reading view (mushaf) | Launch | One page, juz header, surah banners, page-number cartouche, aya-tags |
| Ayah sheet | Long-press an ayah | Uthmani text, gharib gloss, share · play · bookmark, mark colours, scrubber |
| Index (الفهرس) | Menu list or search icon | 114 surahs with start pages, live search |
| Favorites (العلامات) | Menu bookmark icon | Marked ayat as cards, swipe to delete |
| Settings (الإعدادات) | Menu gear | Reading mode, riwaya, theme, decoration style |
| Translation view | Settings › الترجمة | Per-ayah cards: Arabic, transliteration, English |
| Speed-dial menu | Tap the page | Four actions fanning out of a primary button |

**Reading view.** Shows one page from `pagemap`; first run lands on Hafs page 596, sepia theme, arched banners, mushaf mode. The header reads juz · surah · second surah, or the hizb when only one surah begins on the page. The last page is persisted per riwaya.

**Navigation.** A swipe is |dx| > 64 client px with |dx| > 1.6·|dy|; swipe right turns to the next page (right-to-left book), left to the previous. Swipes are ignored while a sheet, selection or menu is open, and step over missing pages. Index and favorites jumps go through `goToPage`, which switches to Hafs if the current riwaya is a single-page sample. The reference has no page-turn animation; a native curl or slide is welcome.

**Ayah selection.** Hold 380 ms within 12 client px; fire a light haptic (12 ms vibrate on web); dim the page (rgba 0,0,0,.68), draw the highlight, open the sheet after 250 ms. Moving more than 12 px cancels. A short tap on the page or an ayah toggles the menu button when nothing is open; tapping the dim closes the selection.

**Highlight.** For each hit rect: a rose band `#633d45` (dark `#7d4551`) at top + 34% of the rect height, 40% tall, radius 22, inset 7 px each side and 50 px on the last rect so it clears the medallion; the clean page is composited over the dim with multiply so only the selected ayah stays crisp; the medallion ring is redrawn above the dim.

**Ayah sheet.** Grabber (44×5); scrubber only while playing; three pills left-to-right share · play · bookmark (92 tall, radius 26, white); the mark-colour row (five 52 px swatches, the active one ringed in its own colour); a white card (radius 30) with the Uthmani ayah (HafsSmart 46/1.9, end mark stripped) beside a numbered medallion (44), then the gharib gloss (30/2.05, justified, ﴿head-words﴾ in `#8a5a24` weight 600), hidden when the ayah has none. Share sends only a title today; iOS should share the ayah text and its surah:ayah reference.

**Recitation controls.** Play toggles play/pause; the web build runs a simulated 93 s timer (250 ms tick) — iOS binds real per-ayah audio. Scrubber: 6 px track, gold fill and a 22 px knob, times as m:ss, tap to seek, reset whenever the selection changes.

**Marks.** Five colours `#c8a34e` · `#5c9a68` · `#5486b0` · `#a86a9e` · `#c76b6b`; one colour per ayah; tapping the current colour unmarks; the bookmark pill toggles with the last-used colour. Stored as `{"surah:ayah": "#hex"}`. On the page a band with the highlight's geometry (inset 6, 46 on the last rect) is multiplied at 50% opacity and stays visible at all times.

**Favorites screen.** Cards sorted by surah then ayah: medallion (34) + سُورَةُ name, آية N + a flag in the mark's colour, the full Uthmani text (34/1.95, centred). Tap opens the ayah's page. Swipe left reveals a 96 px delete zone (threshold 46 px, 20 px over-drag; a drag over 6 px suppresses the tap). Empty state لا توجد علامات محفوظة.

**Index and search.** 114 rows: a 56 px number badge (62 px Hafs digit), سُورَةُ name (30), start page (52). Search folds Arabic (strip tashkeel and tatweel; أإآٱ → ا; ى → ي; ة → ه; drop ؤئء) and accepts Arabic-Indic or Latin digits; a row matches on name substring, exact number or number prefix. Empty state لا توجد نتائج. Tap opens the surah's first page.

**Translation view.** Chosen in settings and persisted. The header stays; page art, banners, marks and hit zones hide. One card per ayah on the page: share and bookmark (46 px buttons) on the left, medallion (52) on the right; Arabic (HafsSmart 50/2.0, RTL); transliteration (italic serif 26, — when missing); English (30/1.6, placeholder الترجمة غير محمّلة لهذه الآية when missing). A surah head precedes ayah 1. Bookmark toggles the mark; swipes still turn pages.

**Speed-dial menu.** Primary button: 112 px circle centred at x 712 with its bottom edge at y 1704, hamburger morphing to an X. Four 84 px mini buttons fan out leftward to x 596 · 496 · 396 · 296 (stagger 30–120 ms): الفهرس, العلامات, بحث (index with the field focused), الإعدادات. A scrim closes it. The button hides while a sheet is open and returns only after a selection closes.

**Settings.** Reading mode المصحف / الترجمة; riwaya cards حفص · ورش · قالون · الدوري (Hafs complete, the others page 300 only); six theme chips; three decoration chips مُقوَّس · مُسنَّن · مُستطيل. Every choice persists.

## 4. Design-fidelity requirements

Everything is authored on an 804×1748 stage and scaled uniformly to the screen; the port keeps these rules and numbers exactly.

**Stage and fit.** Scale s = min((W − 2·pad)/804, (H − 2·pad)/1748), pad 24 when the window is wider than 540 px, else 0; the whole UI is right-to-left. Layer order bottom to top: page chrome (header, banners, page number) → aya-tag underlay → page art → mark bands → hit zones → translation view → dim + highlight → menu scrim → speed dial → ayah sheet → index / favorites / settings panels.

**Page placement (one uniform scale).** With t = the layout's textBox: s = min(768 / t.w, 1470 / t.h, 3.3); ox = (804 − t.w·s)/2 − t.x·s; oy = 176 + (1470 − t.h·s)/2 − t.y·s; every layout point maps as (ox + x·s, oy + y·s). Side padding is 18 px, the text band runs y 176–1646, and the 3.3 cap keeps the small opening pages centred. sx always equals sy, so the calligraphy is never distorted. Worked page 596: s 3.1359, ox −57.77, oy 142.65, page slot 920×1522.

**Chrome geometry.** Decoration artwork keeps its natural proportions; only the page SVG is fitted.

| Element | Size and position |
| --- | --- |
| Juz header | `juz-header.png` 804×52 at y 112; text 23 px HafsSmart `#3f3327` in a 448 px row at x 178, centred, gap 14; 7 px dot separators in `--tag-num` |
| Surah banner | 768×84 at x 18, centred on the extracted band's midpoint; art swapped by decoration style |
| Page-number cartouche | `page-frame.png` at 150×52, centre y 1675 (block top 1648); number 29 px `--tag-num`, raised 3 px |
| Aya-tag | `ayah-tag.png` 40×52 drawn 46 wide × 60 tall centred on each medallion point; number = 0.42×width, weight 600; empty on the page (the SVG's own digit shows through the open centre) |
| Hit zone | One rounded rect (radius 12) per layout rect, scaled with the page |

**Themes.** Artwork ships in sepia and is recoloured by a filter; text is never filtered; paper shifts to the whitest tint of the theme hue. Fixed tokens: gold `#b07a3c`, rose `#633d45`, dim rgba(0,0,0,.68), sheet `#e7e7e8`, header ink `#3f3327`.

| Theme | Paper | Artwork tint | Number ink | Accent |
| --- | --- | --- | --- | --- |
| Sepia (ذهبي, default) | #fefefa | none | #8a5a24 | #b07a3c |
| Green (أخضر) | #f2f8f2 | hue-rotate 95°, saturate .8 | #3f7a4c | #57996a |
| Blue (أزرق) | #f1f6fb | hue-rotate 185°, saturate .7 | #3b5f8a | #547ca7 |
| Mauve (بنفسجي) | #faf3f8 | hue-rotate 280°, saturate .7 | #8a4a6b | #a2689a |
| Slate (رمادي) | #f6f6f7 | saturate 0, brightness .97 | #5a5a5c | #84848a |
| Dark (داكن) | #201f1d | brightness 1.08 | #c9a45e | #c9a45e |

Dark mode also inverts the page art (invert, brightness .92), inverts then hue-rotates decorations back to warm (tags brightness 1.12, banners and header 1.08), composites the highlight with screen instead of multiply, uses rose `#7d4551`, dim .72, and surfaces `#343436` (pills, buttons) and `#2c2c2e` (cards, lists).

**Typography and numerals.** HafsSmart renders every Quranic string and every numeral; all numbers are Arabic-Indic digits. Hafs digit glyphs sit small in the em box, so they are sized up (a 62 px digit fills a 56 px badge). The gharib gloss uses a naskh text face (Amiri Quran, Geeza Pro on iOS), UI labels use the system font. Key sizes: header 23; page number 29; sheet ayah 46/1.9; gharib 30/2.05; index name 30, badge digit 62, start page 52; favorites text 34/1.95; translation Arabic 50/2.0, transliteration italic 26, English 30/1.6; settings title 600 34, labels 600 26, card names 26.

**Highlight and marks.** Both depend on multiply compositing of the black-on-transparent page art over a tinted band; a native renderer must support that blend (or re-draw the page clipped to the rects over the dim).

**Decoration styles.** مُقوَّس = `surah-banner-angular.png`, مُسنَّن = `surah-banner-alt.png`, مُستطيل = `surah-banner-round.png`; all drawn in the 768×84 box and tinted with the theme.

**Motion.** Sheets slide up over 340 ms (cubic-bezier .22,.61,.36,1); the dim fades in 220 ms; speed-dial items scale from .3 with a 340 ms spring-like curve; every tappable control shows a 550 ms press ripple, disabled under reduced motion.

## 5. Data and content requirements

Eight JSON datasets plus one layout file per page drive every screen; all live under `quran-app/assets/data/` and are loaded once at launch.

| File | Key → value | Entries | Size | Notes |
| --- | --- | --- | --- | --- |
| `pagemap.json` | page → ordered [surah, ayah] pairs | 604 pages, 6,236 pairs | 66 KB | Source of truth for page composition; an ayah sits on the page where it ends |
| `uthmani.json` | "surah:ayah" → Uthmani text | 6,236 | 2.0 MB | PUA-encoded glyph stream for HafsSmart only; each glyph preceded by U+200F; last token is the end-of-ayah mark (U+E900–U+EB00), which the app strips |
| `ayat.json` | "surah:ayah" → plain imla'i text | 6,236 | 812 KB | No diacritics; use for search, VoiceOver, sharing and fallback |
| `gharib.json` | "surah:ayah" → gloss | 5,086 | 1.1 MB | Head-words wrapped in ﴿ ﴾ followed by ": meaning."; 1,150 ayat have none |
| `surahs.json` | array of {n, name, ayahs} | 114 | 5 KB | Names are bare; the app prefixes سُورَةُ |
| `juzpage.json` | page → juz 1–30 | 604 | 6 KB | Juz starts: 1, 22, 42, 62, 82, 102, 122, 142, 162, 182, 202, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 503, 522, 542, 562, 582 |
| `translation.json` | "surah:ayah" → English | 19 | 1 KB | Sample only (93:1–11, 94:1–8); needs all 6,236 |
| `translit.json` | "surah:ayah" → Latin transliteration | 19 | 1 KB | Sample only; needs all 6,236 |

**Layout files** — `assets/data/layout/hafs/<page>.svg.json`, one per page (604, about 4 KB each), generated by `dev/build-pages.js` and all `assigned: true`. Coordinates are in the page SVG's own viewBox units, y down, x left to right.

```json
{
  "page": 596, "riwaya": "hafs", "coordinateSpace": "svg-viewBox",
  "viewBox": { "w": 293.23, "h": 485.37 },
  "textBox": { "x": 24.16, "y": 45.43, "w": 244.90, "h": 399.16 },
  "tagW": 16.6,
  "banners": [ { "y0": 177.91, "y1": 205.73 }, { "y0": 364.99, "y1": 392.81 } ],
  "rows": [ 58.6, 85.5, 112.32, 139.08, 165.86, 219.34, 246.08, 272.87, 299.31, 326.56, 353.12, 406.69, 433.48 ],
  "medallions": [ { "s": 92, "a": 10, "x": 183.68, "y": 58.75 } ],
  "hits": [ { "s": 92, "a": 10, "rects": [ [175.38, 46.28, 93.69, 24.64] ] } ],
  "assigned": true, "digitCount": 25
}
```

Invariants across all 604 files: `hits`, `medallions` and `pagemap[page]` share the same length and order (index i is the same ayah in all three); an ayah that wraps a line has one rect per row; `viewBox.w` is 293.23 for pages 3–604 and 240.74 for pages 1–2; `viewBox.h` varies per page (482.9–486.01), so never assume a constant page height.

**Page art** — `assets/pages/hafs/NNN.svg` (zero-padded), black vector glyphs on transparent, decoration and the page's own header and number stripped, `preserveAspectRatio="none"`. Warsh, Qaloon and Douri ship only `300.svg` with matching `300.svg.json`; their pagination differs from Hafs, so `pagemap` and `juzpage` apply to Hafs only.

**Riwayat registry** (`config.js`): id, Arabic label (حفص عن عاصم, قالون عن نافع, ورش عن نافع, الدوري عن أبي عمرو), page source pattern, layout pattern, medallion size 46. Its `viewBox {804,1748}` and `layout(p) → <p>.json` fields are legacy; the real per-page viewBox is in each `.svg.json`.

**Lookups the app relies on** (`data.js`): `uthmaniOf`, `ayahText`, `gharibOf`, `translationOf`, `translitOf` (all "surah:ayah"); `surah(n)`, `surahName(n)`; `pageAyat(p)`; `pageOf(s, a)` (first page holding the ayah); `surahStartPage(s)` (first page holding ayah 1); `juzOf(p)`; `toArabicDigits(n)`. Derived: juz label = الجزء + the ordinal (30 names in `JUZ_NAMES`); hizb = 2j−1 if the page is in the first half of juz j's page range, else 2j.

**iOS data notes.** Decode all datasets once with Codable (about 4 MB of JSON); build `pageOfAyah` and `surahStartPage` indexes eagerly instead of scanning; load layout files lazily per page with an in-memory cache; keep the U+200F marks in Uthmani strings and never let the system substitute a font for them; parse gharib into (head-word, meaning) pairs by splitting on ﴿…﴾:.

## 6. Non-functional requirements

The app must read fully offline: every page, layout, dataset and font ships inside the bundle, exactly as the web build already proves (its demo is a single self-contained file and the app fetches only local `assets/` files).

| Area | Requirement |
| --- | --- |
| Offline | No runtime network for reading. Only Clarity and (later) recitation audio may use the network. |
| Bundle size | 604 Hafs page SVGs total about 210 MB. Compress (SVGZ/gzip, or on-demand download of page ranges) to stay under App Store cellular limits. |
| Rendering | One page = one SVG placed at a single uniform scale plus overlays; no re-layout on turn. Layout JSON is about 4 KB per page. |
| RTL | The whole UI is right-to-left (`dir="rtl"`); flex rows (header, index, favorites) mirror; Arabic-Indic numerals everywhere. |
| Typography | Bundle `HafsSmart_08.ttf` (KFGQPC Uthmanic Hafs Smart v8) and register it for live text; it is the only font that renders the PUA-encoded Uthmani text. |
| Accessibility | Buttons carry labels; the ripple honours reduced-motion; sheet and translation text are live text (VoiceOver-readable) while the page art is an image. |
| Persistence | Keys the web build stores, to map to UserDefaults or a small store: `quran.page.<mode>` (last page per riwaya), `quran.art` (riwaya), `quran.deco` (theme), `quran.orn` (decoration style), `quran.view` (mushaf or translation), `quran.marks` (JSON `{"surah:ayah":"#hex"}`), `quran.markColor` (last colour). |
| Analytics | Microsoft Clarity via `analytics.js`; enabled by `config.analytics.clarity.projectId`; silent no-op when empty. Custom events: `page_view {page, riwaya}`, `ayah_select {ayah}`, `mark_add` / `mark_remove {ayah, color}`, `view_mode {mode}`, `open_index`, `open_favorites {count}`, `open_settings`. |
| Privacy | No accounts, no PII; marks live on-device. Clarity records sessions, so declare it in the App Store privacy labels and add an in-app opt-out toggle (proposed). |
| Dark mode | Follow the system appearance by mapping it to the `dark` theme (proposed); the user can still pick any theme in settings. |
| Devices | iPhone and iPad, portrait-first; the 804×1748 stage scales uniformly to any screen with a 24 px gutter on wide windows. |

## 7. Native iOS implementation guide

Wrap the web app with Capacitor: it keeps every screen and asset as built, ships a real App Store binary, and adds native share, haptics, audio, storage and status-bar handling through plugins. A full SwiftUI rewrite is the alternative; its module map follows the Capacitor steps.

Architecture (the living doc has the drawing):

    Xcode project: Swift shell (Capacitor)
      — signs, packages and submits the App Store build; owns status bar, safe-area insets, orientation
        ↓ loads
    WKWebView: the reference web app, unchanged            → bridge → Native plugins
      — index.html, app.js, styles.css, data.js,                        Share: ayah text and reference
        medallion.js, analytics.js                                       Haptics: light impact on hold
      — renders pages, ayah sheet, index, favorites,                     Preferences: marks and settings
        translation view; WebKit supports the multiply blends            AVPlayer: per-ayah recitation
        ↓ reads                                                          Status bar and safe-area insets
    Bundled assets, fully offline                                        Clarity SDK: same event names
      — 604 page SVGs + 604 layout JSON; 8 JSON datasets;
        HafsSmart_08.ttf and the sepia chrome PNGs

| | Capacitor wrapper | SwiftUI rewrite |
| --- | --- | --- |
| Reuse of the reference build | All of it | Assets, data and font only |
| Effort | Days: setup, bridge points, store prep | Weeks: every screen and renderer rewritten |
| Fidelity risk | Low (same rendering engine) | High (every rule in §4 re-implemented) |
| Native feel | Good with plugins; web scrolling and sheets | Best |
| Offline and store | Yes | Yes |

**Capacitor setup (on the Mac)**

1. Install Node 18+, Xcode 15+ and CocoaPods. In `quran-app/`: `npm init -y`, then `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/share @capacitor/haptics @capacitor/preferences @capacitor/status-bar`.
2. Add a `www/` build step that copies `index.html`, `*.js`, `styles.css` and `assets/` (exclude `dev/`, `work/`, docs). Run `npx cap init "Quran Digital" <bundle id> --web-dir www`, then `npx cap add ios` and `npx cap sync`.
3. Open `ios/App/App.xcworkspace`. Set the team, bundle id, iOS 16 deployment target, portrait orientation, and `allowsInlineMediaPlayback`. The font loads through the existing `@font-face`; no `UIAppFonts` entry is needed.
4. Bridge points in `app.js` (guard each with a feature check so the web build keeps working): `navigator.share` → `Share.share({ title, text: <ayah text> + " " + <surah:ayah> })`; `navigator.vibrate(12)` → `Haptics.impact({ style: 'light' })`; keep `localStorage` (WKWebView persists it) or move the `quran.*` keys to `Preferences` for durability; `StatusBar.setStyle` light/dark per theme; recitation through an `<audio>` element, or a native AVPlayer plugin when background playback is required.
5. Assets: the 604 SVGs total about 210 MB uncompressed. Either ship them and accept the over-200 MB cellular prompt, pre-compress and inflate at runtime, or move page ranges to On-Demand Resources.
6. Analytics: the Clarity web tag runs inside WKWebView once `projectId` is set; alternatively wire the Clarity iOS SDK and re-emit the eight `track()` events with the same names.
7. Run with `npx cap run ios`, compare page 596 side by side with the web build, then TestFlight.

**Module map for a SwiftUI rewrite**

| Web module | Native counterpart |
| --- | --- |
| `index.html`, `styles.css` | SwiftUI views plus a `Theme` struct holding the token table from §4 |
| `app.js` `makeMap`, `setArt` | `PageRenderer`: compute s, ox, oy; draw the SVG (SVGKit or PocketSVG, or a pre-rasterised PDF per page) at (ox, oy, viewBox.w·s, viewBox.h·s) |
| `medallion.js` | `AyaTagView`: `ayah-tag.png` in a 40:52 box, number label at 0.42×width, weight 600 |
| `renderHighlight`, `renderPageMarks` | Core Graphics compositing of the clean page over the dim with `.multiply` (`.screen` in dark), bands at 34%/40% |
| `data.js` | Codable models, eager `pageOfAyah` and `surahStartPage` indexes, lazy layout cache |
| `buildToc`, `normAr`, `filterToc` | `SearchIndex` with the same folding rules and Arabic-Indic digit handling |
| marks (`quran.marks`) | UserDefaults or SwiftData, `{"s:a": hex}` plus last colour |
| Ayah sheet | A custom bottom sheet (30 pt radius, `#e7e7e8`, 250 ms delay, 340 ms slide), not the system detent sheet |
| Speed dial | Custom view: 112 pt primary at (712, 1648), four 84 pt items at −116/−216/−316/−416 pt, 30 ms stagger |
| Player | AVPlayer per ayah with the same transport UI |
| Gestures | Long press 0.38 s with 12 pt tolerance and a light impact; pan of 64 pt with dx > 1.6·dy turns the page, right = next |
| `analytics.js` | Clarity iOS SDK behind the same `track(name, tags)` contract |

**App Store readiness**
- Privacy labels for Clarity session recording, and an in-app opt-out.
- Font licence: `HafsSmart_08.ttf` embeds a King Fahd Glorious Quran Printing Complex notice requiring written approval for redistribution; obtain it before shipping the binary.
- Support iPhone and iPad; the stage letterboxes on screens that are not 19.5:9.
- Replace the reference's raster status strip with the system status bar; keep the header at y 112.

## 8. Resource inventory

Everything below is in `quran-app/` on the branch; copy it verbatim.

| Resource | Path | Count · size | Purpose |
| --- | --- | --- | --- |
| Hafs pages | `assets/pages/hafs/001.svg` … `604.svg` | 604 · 210 MB (98 KB–462 KB each) | Stripped black-vector calligraphy, `preserveAspectRatio="none"`, viewBox 293.23×~485 (240.74×323.95 for pages 1–2) |
| Hafs layouts | `assets/data/layout/hafs/1.svg.json` … `604.svg.json` | 604 · 2.4 MB | Per-page geometry: textBox, banners, rows, medallions, hit rects |
| Legacy layout | `assets/data/layout/hafs/596.json` | 1 | Design-space medallions for the capture demo modes; not needed natively |
| Other riwayat | `assets/pages/{warsh,qaloon,douri}/300.svg` and `assets/data/layout/{warsh,qaloon,douri}/300.svg.json` | 3 + 3 | One sample page each (al-Kahf 18:53–60) |

**Content datasets** — `assets/data/`: `pagemap.json` (66 KB), `uthmani.json` (2.0 MB), `ayat.json` (812 KB), `gharib.json` (1.1 MB), `surahs.json` (5 KB), `juzpage.json` (6 KB), `translation.json` and `translit.json` (sample, 19 keys each). Schemas in §5.

**Font** — `assets/fonts/HafsSmart_08.ttf`, 301 KB TrueType; family "KFGQPC Hafs Smart", PostScript name `KFGQPCHafsSmart-Regular`, version 0.08. Required for `uthmani.json` and every numeral. Its embedded notice requires KFGQPC approval for redistribution.

**Chrome artwork** — `assets/ui/`, all 8-bit RGBA PNG in the sepia master, tinted at runtime:

| File | Pixels | Used for |
| --- | --- | --- |
| `ayah-tag.png` | 40×52 | Open aya-tag medallion; number centred at 50%, 51.5% |
| `juz-header.png` | 804×52 | Top cartouche (baked dividers removed) |
| `page-frame.png` | 560×184 | Empty page-number cartouche, drawn at 150×52 |
| `surah-banner-angular.png` | 768×96 | Decoration style 1, مُقوَّس (default) |
| `surah-banner-alt.png` | 768×84 | Decoration style 2, مُسنَّن |
| `surah-banner-round.png` | 768×84 | Decoration style 3, مُستطيل |
| `surah-banner.png` | 768×84 | Original reference banner; registered in config, unused by CSS |
| `orn2-banner.svg`, `orn2-header.svg` | 768×84, 804×52 | Earlier vector ornament set; unused |

**Design captures** — `assets/img/base.png` and `base-notags.png` (804×1748, the reference capture of page 596 with and without medallions) and `sheet-text.png` (720×245). Reference material only.

**Icons** — inline SVG in `index.html` (share, play, pause, bookmark, list, magnifier, gear, menu bars) and `app.js` (`ICON_SHARE`, `ICON_BM`, trash); 24-unit viewBoxes, stroke 1.7–1.8, round caps.

**Source modules** — `index.html` (250 lines), `styles.css` (768), `app.js` (1,029), `data.js` (109), `medallion.js` (121), `config.js` (106), `analytics.js` (31). Notes: `README.md`, `ARCHITECTURE.md` (its layout schema is the legacy one).

**Tooling** — `dev/` (Node + Playwright unless noted; outputs go to the git-ignored `work/`):

| Script | Does |
| --- | --- |
| `build-pages.js` | The page pipeline: strips decoration, header and page number from raw SVGs, detects aya digits, derives rows, hit rects and medallions, writes pages + layouts + a QA report; `--force` for hand-annotated digits |
| `build-demo.js` | Bundles the single-file offline demo (`work/demo.html`) with inlined assets and pages 593–604 |
| `ingest.js` | Generic riwaya page-set tool: unzip, inspect, strip, batch, single-page extract |
| `make-pageframe.js`, `extract-pageframe.js` | Generate the empty page-number cartouche (shipped file comes from the first) |
| `clean-juzheader.js` | Removes the baked divider lines from the header artwork |
| `erase.js`, `tool.js` | Capture editing and pixel-analysis helpers |
| `claim.py` | Claims Drive download results during the page ingest (Python) |
| `fullrun.js`, `pagerun.js`, `settingsrun.js`, `selftest.js`, `switch.js`, `tagtest.js`, `test-demo.js`, `verify.js`, `itest.js` | Self-hosted verification harnesses that drive real gestures and assert screens |
| `shoot.js`, `shootdemo.js`, `vshoot.js`, `responsive.js` | Screenshot harnesses |
| `medallion-demo.html` | Proof page: app-drawn tags over the medallion-less capture |

**Reference designs** — the product owner's screenshots (reading view, highlight and sheet, favorites cards, search screens, reading-mode picker, translation view) and the three banner PNGs; supplied in the design conversation, not stored in the repo.

## 9. Repository, links and handoff checklist

| Resource | Where |
| --- | --- |
| Repository | https://github.com/ByMoha/toastr, app under `quran-app/` |
| Branch | `claude/quran-digital-app-148rpr` |
| Pull request | https://github.com/ByMoha/toastr/pull/1 — every commit of the reference build |
| Live demo | https://claude.ai/code/artifact/df76a483-0f5f-4109-9268-5ebac6371682 — single-file bundle, pages 593–604 only |
| Architecture notes | `quran-app/ARCHITECTURE.md`, `quran-app/README.md` |
| Demo builder | `node dev/build-demo.js` (needs `NODE_PATH=/opt/node22/lib/node_modules` or a local `playwright` install for the harness scripts) |

Handoff checklist for the implementing chat:
1. Clone the repository, check out `claude/quran-digital-app-148rpr`, `cd quran-app`.
2. Read `ARCHITECTURE.md`, `README.md` and this document end to end.
3. Serve `quran-app/` over HTTP (any static server) and use the web app as the behavioural reference; keep it open beside the iOS build.
4. Confirm the path in §7 (Capacitor recommended) with the product owner.
5. Follow §7 step by step; commit to a new branch off `claude/quran-digital-app-148rpr`.
6. Obtain the three external inputs: the full translation/transliteration JSON, per-ayah recitation audio, and the Clarity project id.
7. Verify every item in §4 against the web build on the same page (596 is the canonical test page).
8. TestFlight on iPhone and iPad, then App Store submission with the privacy labels from §6.

## 10. Open items, risks and dependencies

| Item | State | Needed |
| --- | --- | --- |
| Translation and transliteration | Only surahs 93 and 94 seeded | Full dataset keyed `"surah:ayah"` with `en` and `tr` for all 6,236 ayat |
| Recitation audio | Player is UI only: a simulated 93 s timer | Per-ayah audio (URL or bundled), bound to AVPlayer; background playback |
| Analytics | `config.analytics.clarity.projectId` is empty | Create a Clarity project and set the id |
| Hizb label | Computed as the midpoint of the juz page range (approximate) | Exact hizb start pages or ayat for the 60 hizbs |
| Riwayat | Hafs complete; Warsh, Qaloon, Douri have one sample page (300) each | Full page sets; `dev/build-pages.js` strips and extracts layouts automatically |
| Header labels | Juz and surah names partly vocalized; the reference is fully vocalized | Fully vocalized juz ordinals (30) and surah names (114) |
| Search | Index search built; the dedicated full-screen search with results-with-translation is not | Depends on the translation dataset |
| Reading-mode picker | Implemented as a settings toggle; the modal with thumbnails and language dropdown is not built | Decide whether the modal is still wanted |
| Bundle size | 604 page SVGs, about 210 MB uncompressed | Compression or on-demand page ranges before store submission |
| Font licence | KFGQPC notice embedded in the TTF | Written approval before App Store redistribution |
| Demo coverage | Demo bundle carries pages 593–604 | The full app bundles all 604 |

Risks: the Hafs Smart font is the only renderer of the PUA Uthmani text, so any font substitution breaks the ayah text; a WKWebView build must keep `mix-blend-mode: multiply` (used by the highlight and marks), which WebKit supports. Known web-build stubs not to copy blindly: share sends only a title; the Hafs riwaya thumbnail resolves to an undefined URL; `turnPage` does not emit `page_view`; closing the index/favorites/settings does not restore the menu button.
