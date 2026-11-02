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
- **Validated values** (the exact hex for each token, both themes) are recorded in the section of that name at the end of this file once the prototype is approved.

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

A departures-board table: **Hora | Destino | Tren | Estado**, with tabs Salidas / Llegadas. A delayed row shows the scheduled time struck through and the new time beside it. It shows "actualizado hace X". The styling is our own, not an imitation of station screens.

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

_Filled in once the prototype is approved: final token hex values for light and dark, the Service type palette with its validator output, spacing/radius/shadow scale, and any decision the prototype changed._
