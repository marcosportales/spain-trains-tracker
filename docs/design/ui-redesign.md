# UI redesign: decisions

The source of truth for the web redesign, settled in a design session on 2026-11-02. The prototype brief (`prototype-brief.md`) and every redesign spec issue point here. Terms in **bold capitals** (Run, Station, Delay band…) are defined in `GLOSSARY.md`.

## The bar: readable at first glance

The app must make sense to someone who has never seen it. Every panel **answers a question in one sentence first** (the _headline_), then shows the detail below it. A panel that needs explaining is a bug in the panel. Help is contextual (legend, empty states that say what to do, an ⓘ next to non-obvious concepts). There is no onboarding tour.

## Visual direction

- **Neutral tool look** (in the spirit of Linear, Vercel, Flighty): cool whites and greys, generous spacing, one accent. The map and the trains carry the colour.
- **Own identity.** Nothing borrowed from Renfe's brand (colours, logo, typography, station-screen look): the app is independent and must not read as official.
- **Light and dark themes**, following the system by default, with a manual Sistema / Claro / Oscuro toggle. The basemap follows the theme.
- **Typography:** Inter via `next/font`, tabular figures for every time and minute count.
- **Icons:** Lucide.

## Colour

Built as tokens (Tailwind v4 `@theme`, redefined for dark). No hard-coded hex in components.

- **UI accent:** neutral ink is the primary action (near-black zinc on light, white on dark). A single blue is reserved for focus rings, selection and links.
- **Delay band colours are reserved.** Green, amber, red and grey mean On time, Late, Severely late and Cancelled, and nothing else uses those hues.
- **Service type palette** is categorical and avoids the reserved hues. Starting point to validate: Cercanías teal, AVE violet, Larga Distancia blue, Media Distancia magenta, Ancho métrico sand/brown. It must pass the `dataviz` skill's validator (contrast on both basemaps, colour-vision deficiency separation).
- **Validated values** (the exact hex for each token, both themes) are recorded in the section of that name at the end of this file.

## Delay bands

One definition everywhere (see **On time** and **Delay band** in `GLOSSARY.md`):

| Band | Delay | Colour | es copy | en copy |
|---|---|---|---|---|
| On time | < 5 min (early counts) | green | Puntual | On time |
| Late | 5 to < 15 min | amber | {n} min de retraso | {n} min late |
| Severely late | ≥ 15 min | red | {n} min de retraso | {n} min late |
| Cancelled | — | grey (solid) | Cancelado | Cancelled |
| Unknown | no Delay known | grey (soft) | Sin datos de retraso | No delay data |

## Plain language

Visible copy uses a traveller's words; glossary terms stay in code. es / en:

| Domain term | es | en |
|---|---|---|
| Run | Tren {n} | Train {n} |
| Rolling stock | Modelo de tren | Train model |
| Hub | Red de Cercanías | Cercanías network |
| Ancho métrico | Vía estrecha (ancho métrico) | Narrow gauge |
| Sighting | posición | position |
| Delay observations | nº de datos (secondary, tooltip only) | data points |
| Station board | Salidas y llegadas | Departures and arrivals |

Stations are always shown by **name**, never by code.

## Layout

- **Full-bleed map** on the home page. No footer: attribution lives in the MapLibre control.
- **Floating top bar:** logo + name, search (the protagonist, centred), nav **Mapa · Puntualidad · Reproducción**, language, theme toggle. On mobile: logo, a search icon that expands, and a menu.
- **Basemap:** OpenFreeMap `positron` (light) and `dark` (dark), both confirmed available at `https://tiles.openfreemap.org/styles/<name>`.
- **Detail surfaces** (Run detail, Station board): a side panel on desktop, a bottom sheet on mobile, built with `vaul`. Three snap points: _peek_ shows only the headline, _half_ shows the main content, _full_ shows everything.

## Map

- **Dots are coloured by Service type.** A Run that is Late or Severely late gets an amber or red ring (halo); On time Runs have no ring.
- **Legend**, always visible: each Service type with its live count ("● Cercanías 214"). Tapping one hides or shows it, which replaces the Service type checkboxes in the filter panel. Below it is one line: "◯ ámbar = retraso · ◯ rojo = retraso grave". On mobile it collapses into a scrollable chip row.
- **Live indicator**, next to the legend:
  - "● En directo · 312 trenes · hace 4 s" (green): normal.
  - "Reconectando…" (amber): more than 30 s without data.
  - "Sin conexión: posiciones de hace 3 min" (red): more than 2 min without data. Trains are dimmed in this state.
  - The thresholds are tuned to the stream's real cadence during implementation.
- **Service alerts:** a "⚠ 3 avisos" chip beside the live indicator, hidden when there are none. It opens a list; each alert says in one sentence which Lines it affects, and tapping one highlights those Lines on the map.
- **Filters panel** keeps only Red de Cercanías and Línea.
- **Selected Run:** its dot grows and gets a halo, its Track geometry is drawn (the travelled part dimmed, the remaining part strong), and the other trains are dimmed.

## Run detail: "¿dónde va mi tren?"

1. **Headline**, large: "Va 7 min tarde · próxima parada Atocha, 10:42" (or "Puntual · …", "Cancelado", "Aún no ha salido · sale de Chamartín a las 10:05" for a Scheduled Run).
2. **Vertical stop timeline:** past stops dimmed, a marker where the train is, future stops normal. Each shows the Station name, the scheduled time, and the real time (old one struck through) when they differ.
3. **History** as a sentence ("Normalmente llega unos 5 min tarde") plus a mini bar chart of the recent Runs, coloured by Delay band.
4. Accessibility and Rolling stock as small chips with icons.

## Station board

A departures-board table: **Hora | Destino | Tren | Estado**, with tabs Salidas / Llegadas (on Llegadas the second column is **Origen**). A delayed row shows the scheduled time struck through and the new time beside it. It shows "actualizado hace X". The styling is our own, not an imitation of station screens.

## Punctuality

1. **Headline:** "En los últimos 7 días, el 87 % de los trenes llegó a destino con menos de 5 min de retraso". Until Punctuality is computed per Run (ADR 0007), the honest wording is "El 87 % del tiempo, los trenes iban con menos de 5 min de retraso".
2. **Line ranking** as horizontal bars, worst to best, coloured by band.
3. **By-hour chart** with a one-sentence summary ("Los retrasos se concentran entre 8:00 y 9:00").
4. Technical figures (data points) go in tooltips. One line explains what "a su hora" means.

## Replay

Kept, but secondary: last in the nav, a one-line explanation, and it opens on a recent hour that has data so it is never empty on arrival.

## States

- **Loading:** skeletons shaped like the content, never a bare "Cargando…".
- **Empty:** says what to do ("Ningún tren coincide con los filtros · Quitar filtros").
- **Error:** offers a retry and shows the time of the last good data.

## Components

Our own primitives on tokens, with Radix only where accessibility is hard (Select, Popover, Dialog) and `vaul` for sheets: Button, DelayBadge, Panel, Sheet, Select, SegmentedControl, Skeleton, EmptyState. shadcn/ui is not adopted wholesale.

## Delivery

Each spec is one GitHub issue labelled `ready-for-agent`. Its **tickets** live inside it as numbered sections, each atomic (one commit) with scope, files and acceptance criteria. Order and blockers:

| Spec | Blocked by |
|---|---|
| S1 Visual foundations | prototype approved |
| S2 One definition of On time (#124) | — |
| S3 Punctuality per Run (backend) (#125) | — |
| S4 Home screen | S1, S2 |
| S5 Run detail | S1, S2 |
| S6 Station board | S1, S2 |
| S7 Punctuality page | S1, S2 (S3 for the final headline) |
| S8 Replay | S1 |

## Validated values

Settled by the prototype, approved by the owner on 2026-11-02.

- **Prototype:** https://claude.ai/artifact/QnsFSHAvRaGwc4DxbGeozd (private). Source on the throwaway branch `prototype/ui-redesign` (`docs/design/prototype/`), kept off `main`.
- **Basemap surfaces used for validation:** light `#f2f3f0` (positron land), dark `#16181b` (dark land). The published prototype draws a simplified SVG basemap because artifact pages cannot load OpenFreeMap tiles; re-check the colours on the real styles in S1.

### Colour tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `page` | `#e6e7ea` | `#0a0b0d` | Background behind non-map pages |
| `surface` | `#ffffff` | `#1d1f23` | Panels, bars, cards |
| `surface-2` | `#f4f4f5` | `#25282d` | Inputs, hover, chips |
| `surface-3` | `#e7e7ea` | `#30333a` | Skeletons, neutral bars, segmented track |
| `line` | `#e4e4e7` | `#30333a` | Borders and dividers |
| `ink` | `#18181b` | `#f4f4f5` | Primary text and primary action |
| `ink-2` | `#52525b` | `#c4c5cb` | Secondary text |
| `ink-3` | `#71717a` | `#8e939c` | Muted text, captions |
| `on-ink` | `#ffffff` | `#18181b` | Text on a primary (ink) button |
| `accent` | `#2563eb` | `#6ea8fe` | Focus rings, selection, links, alert highlight on the map |
| `accent-soft` | `#dbe6fd` | `#1c2c47` | Selected item background |
| `dot-outline` | `#18181b` @ 55 % | `#f4f4f5` @ 50 % | 1 px outline on every train dot |

### Service type palette

| Service type | Light | Dark |
|---|---|---|
| Cercanías (teal) | `#53c3b1` | `#0c8568` |
| AVE (violet) | `#ad9bfa` | `#7943aa` |
| Larga Distancia (blue) | `#0d60e0` | `#257bf1` |
| Media Distancia (magenta) | `#8e2b86` | `#ca68b9` |
| Vía estrecha / Ancho métrico (brown) | `#8b440e` | `#a04b00` |

`dataviz` validator, all pairs (`--pairs all`, since any two dots can touch on a map):

```
light, surface #f2f3f0
  [PASS] Lightness band       all 5 inside L 0.43–0.77
  [PASS] Chroma floor         all 5 >= 0.1
  [PASS] CVD separation       worst #ad9bfa↔#53c3b1 ΔE 11.7 (deutan) · tritan 4.1
  [PASS] Normal-vision floor  worst #8b440e↔#8e2b86 ΔE 18.7
  [WARN] Contrast vs surface  #53c3b1 1.92, #ad9bfa 2.13 — relief required
dark, surface #16181b
  [PASS] Lightness band       all 5 inside L 0.48–0.67
  [PASS] Chroma floor         all 5 >= 0.1
  [PASS] CVD separation       worst #ca68b9↔#257bf1 ΔE 9.4 (protan) · tritan 7.7
  [PASS] Normal-vision floor  worst #257bf1↔#7943aa ΔE 17.9
  [WARN] Contrast vs surface  #7943aa 2.71, #a04b00 2.97 — relief required
```

The contrast WARN is structural, not a tuning miss: a search over each hue family found no five-hue palette that passes CVD separation, the normal-vision floor and 3:1 contrast at once on the light basemap. CVD separation was kept fully passing, since identity on the map depends on it, and the contrast relief is mandatory in implementation: every dot carries the `dot-outline`, the legend always names each type in text, and Run detail names the type.

Every Service type colour is at least ΔE 15 (OKLab ×100) from every Delay band strong colour in both themes, so dots never read as a Delay band.

### Delay band colours

Strong is the mark colour (map ring, bar, badge dot). Soft is the badge background; badge text is `ink`, so colour is never the only cue.

| Band | Strong light | Strong dark | Soft light | Soft dark |
|---|---|---|---|---|
| On time | `#1f9e55` | `#3fbf74` | `#e3f4e9` | `#163322` |
| Late | `#c27c00` | `#f0a832` | `#fbefd6` | `#3a2c10` |
| Severely late | `#d6382f` | `#f2635a` | `#fbe3e1` | `#3d1c1a` |
| Cancelled | `#868c96` | `#8b919b` | solid `#52525b`, text `#ffffff` | solid `#4a4d55`, text `#f4f4f5` |
| Unknown | hollow ring `#868c96` | hollow ring `#8b919b` | `#ececee` | `#2a2c31` |

Checks: strong vs basemap 3.10 / 3.05 / 4.22 / 3.04 (light) and 7.55 / 8.77 / 5.68 / 5.61 (dark), all ≥ 3:1. Ink on soft ≥ 14.5:1 (light) and ≥ 12.3:1 (dark).

### Spacing, radius, shadow, type

- **Spacing** (4-based): 4, 8, 12, 16, 20, 24, 32 px. Floating chrome sits 12 px from the map edge (10 px on mobile).
- **Radius:** 6 (small controls), 10 (buttons, inputs, menus), 14 (panels, cards, top bar), 20 (bottom sheet top corners), pill 999.
- **Shadow:** `shadow-1` `0 1px 2px rgba(20,22,28,.06), 0 2px 8px rgba(20,22,28,.06)` for cards; `shadow-2` `0 2px 6px rgba(20,22,28,.08), 0 12px 32px rgba(20,22,28,.14)` for floating chrome over the map. Dark: `0 1px 2px rgba(0,0,0,.4), 0 2px 8px rgba(0,0,0,.3)` and `0 2px 6px rgba(0,0,0,.45), 0 12px 32px rgba(0,0,0,.5)`.
- **Type** (Inter, tabular figures on every time and count): 12 / 13 / 14 (body) / 16 / 20 / 24 / 30 px. Run detail and Station board headline 22 px desktop, 20 px mobile, weight 600; Punctuality headline 30 px desktop, 24 px mobile.
- **Layout sizes:** top bar 52 px high (48 mobile); desktop side panel 400 px wide; map dot radius 4 px (4.4 mobile), Delay ring 2.2 px stroke at +2.6 px; selected dot ×1.7 with a 9 px halo.
- **Sheet snap points (mobile):** peek ≈ 150 px of headline, half at 42 % of the viewport height, full up to just under the top bar.

### Decisions the prototype changed or added

- **Llegadas column:** the second column reads **Origen** on the Llegadas tab (Station board section updated).
- **Board status for not-yet-departed Runs:** a Scheduled Run with no Delay shows the Unknown band, "Sin datos de retraso", in soft grey. Kept after review; revisit if it crowds the board in real data.
- **Delay band colour roles:** each band has a strong mark colour and a soft badge background, and badge text stays in ink (refines the Delay bands table above).
