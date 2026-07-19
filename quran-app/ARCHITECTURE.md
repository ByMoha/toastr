# Architecture — data-driven, swappable-calligraphy Quran reader

This app is layered so the **calligraphy (page art)** and the **aya-tag medallions**
are independent from the **content** and the **UI chrome**. That lets one engine serve
Hafs, Qaloon, Warsh … by swapping page-art sets, while medallions, tafsir/gharib,
search and interactions stay identical.

```
┌────────────────────────────────────────────────────────────┐
│  UI chrome         status bar · header · sheet · menu        │  app.js / styles.css
├────────────────────────────────────────────────────────────┤
│  Page art          per-page SVG, per riwāya (NO aya-tags)    │  config.js  → assets/pages/<riwaya>/
│  Aya-tag overlay   app-drawn medallions from position data   │  medallion.js + assets/data/layout/
│  Hotspots          per-ayah tap targets                      │  app.js (+ layout)
├────────────────────────────────────────────────────────────┤
│  Content           ayah text · gharib · surah meta · pages   │  data.js → assets/data/*.json
└────────────────────────────────────────────────────────────┘
```

## 1. Content data (`assets/data/`)

| File | Rows | Schema | Source |
|------|------|--------|--------|
| `ayat.json` | 6236 | `"surah:ayah" → imlā'ī text` | orthographic_v1.0.csv |
| `gharib.json` | 5086 | `"surah:ayah" → "…﴿word﴾: meaning…"` | الميسر في غريب القرآن |
| `surahs.json` | 114 | `[{n,name,ayahs}]` | derived + names |
| `pagemap.json` | 604 | `"page" → [[surah,ayah],…]` | orthographic CSV (page column) |

`data.js` loads these and exposes `ayahText`, `gharibOf`, `surahName`, `pageAyat`,
`pageOf`, and `layout(riwaya,page)`. The bottom sheet already renders the **real
gharib gloss for every ayah** (head-words in `﴿ ﴾` styled via `.qword`).

> The 4 supplied `.xls` are surah statistics (ayah/word/letter counts) — not needed
> for layout; can be folded into `surahs.json` as extra stats on request.

## 2. Calligraphy (riwāya) system (`config.js`)

Each riwāya declares where its page art lives and how medallions are styled:

```js
hafs: {
  page:      { type:"svg", src:p=>`assets/pages/hafs/${pad(p)}.svg`, viewBox:{w:804,h:1748} },
  medallion: { style:"gold-rosette", size:46 },
  layout:    p=>`assets/data/layout/hafs/${p}.json`,
  sample:    { 596:{ type:"image", src:"assets/img/base.png", bakedMedallions:true } },
}
```

**To add a calligraphy:** register it, drop `assets/pages/<id>/NNN.svg`, and provide its
`assets/data/layout/<id>/<page>.json`. Nothing else changes.

`sample` lets specific pages ship as the current design capture until the SVG set lands
(`bakedMedallions:true` = art already contains tags, so the overlay is suppressed there).

## 3. Aya-tag medallion overlay (`medallion.js`)

Because the page art is **medallion-less**, medallions are drawn as an overlay from
position data and mapped into the art's `viewBox`, so they line up at any scale and for
any calligraphy. See `dev/medallion-demo.html` for a live proof over medallion-less art.

**Layout schema** — `assets/data/layout/<riwaya>/<page>.json`:

```json
{
  "page": 596,
  "riwaya": "hafs",
  "viewBox": { "w": 804, "h": 1748 },
  "medallions": [ { "s": 93, "a": 3, "x": 41, "y": 912 } ]
}
```
`x,y` = medallion centre in the page art's coordinate system.

**Exact artwork:** the default is a placeholder SVG rosette. To use the real aya-tag,
set `Medallion.asset = (number, size) => <element>` (or per-riwāya). The number is drawn
in Arabic-Indic digits.

## 4. What the engine still needs from you

1. **Page-art SVGs** — one per page, per riwāya, medallion-less. Naming + `viewBox`?
2. **Aya-tag positions** — a `layout/<riwaya>/<page>.json` per page **or** anchor
   elements inside each SVG (e.g. `<g id="aya-93-3">`) I can read positions from.
3. **Hotspots** — do the SVGs carry per-word/per-ayah element ids (precise tap targets),
   or are they flat art (then I derive hotspots from the layout boxes)?
4. **Medallion artwork** — the exact aya-tag asset (shared or per calligraphy).

Answer 1–4 and the SVG pipeline drops straight into this structure.
