# Brief: UI redesign prototype

You are building a **throwaway prototype** of the redesigned web UI so the owner can check one thing before any real code is written: _does the app make sense at first glance?_ The decisions are fixed in `docs/design/ui-redesign.md` (read it in full first; it is the single source of truth, and this brief does not repeat it). Your output is a published page plus the **Validated values** section of that file.

The prototype is a sketch for judgement, not product code. Nothing from it is merged into `apps/web`.

## Inputs to read first

- `docs/design/ui-redesign.md`: every decision you are visualising.
- `GLOSSARY.md`: the domain terms (Run, Station, Delay band, On time, Service type…).
- `apps/web/messages/es.json`: today's copy, to see what the plain-language rewrite replaces.
- Skills: load `mattpocock-skills:prototype` (the throwaway-prototype method), `artifact-design` (page contract), and `dataviz` (palette validation and the mini charts).

## Steps

### 1. Validate the palette

Run the `dataviz` validator on the five Service type colours and the four Delay band colours against both basemaps (light `positron`-like greys, dark `dark`-like greys). Adjust hues until every check passes, keeping Delay band hues (green, amber, red, grey) out of the Service type palette.

**Done when** the validator passes for both themes and you have the final hex list for: neutral scale, ink, blue accent, 5 Service types, 4 Delay bands (soft background + strong foreground each).

### 2. Build the page

One self-contained HTML page, published as a **private claude.ai Artifact** with the Artifact tool. Spanish copy (the app's primary locale), taken from the plain-language table in the decisions doc. Use realistic sample data: real Spanish Station names (Madrid-Chamartín, Atocha, Sevilla-Santa Justa, Barcelona-Sants…), real-looking train numbers, a mix of On time, Late, Severely late, Cancelled and Scheduled Runs.

Controls on the page itself, so the owner can flip between them:

- Theme: Claro / Oscuro.
- Viewport: Escritorio / Móvil (a phone-width frame).
- State: Normal / Reconectando / Sin conexión / Cargando / Vacío.

Screens, each matching its section in the decisions doc:

1. **Home:** full-bleed map, floating top bar, legend with counts, live indicator, alerts chip, filters button, delay rings on a few dots. Clicking a dot opens Run detail.
2. **Run detail:** side panel on desktop, bottom sheet with peek/half/full on mobile, with the headline, stop timeline, history sentence + mini bars, and chips. Show the selected-Run map treatment.
3. **Station board:** the Hora | Destino | Tren | Estado table with tabs and "actualizado hace X".
4. **Puntualidad:** headline, ranking bars, by-hour chart with its summary sentence.
5. **Reproducción:** a light pass with the explanation line, time scrubber and play controls.

For the map, try MapLibre GL from a CDN with the OpenFreeMap `positron` / `dark` styles. If the tiles do not load inside the published page, draw a simplified SVG basemap of the Iberian peninsula with a few Line paths instead. The point is the overlay UI, not the tiles.

**Done when** every screen and every state above is reachable from the page controls, in both themes and both viewports, and each item of the decisions doc's Layout, Map, Run detail, Station board, Punctuality, Replay and States sections is visible somewhere. Tick them off against the doc before publishing.

### 3. Review with the owner

Send the link and ask the owner to judge it against the bar: _can you tell what each panel says without explanation?_ Walk them screen by screen. Apply their changes to the page and republish to the same URL. When a change contradicts the decisions doc, update the doc in the same pass so it stays the single source of truth.

**Done when** the owner explicitly approves the prototype.

### 4. Record the validated values

Fill in the **Validated values** section of `docs/design/ui-redesign.md`:

- Every colour token, light and dark, as hex, with the `dataviz` validator result.
- Spacing, radius, shadow and type scale the prototype settled on.
- The prototype's URL.
- Any decision the review changed (also corrected in its own section above).

Commit with the `/commit:commit` skill on a branch from `main` (for example `ui-prototype-validated-values`), push, and open a PR with `gh pr create`.

**Done when** the PR is open and the section has no placeholder text left.

## After this brief

With the values recorded, the remaining specs (S1, S4–S8 in the decisions doc's Delivery table) are written as GitHub issues in the same format as the S2 and S3 issues. Mention this to the owner when you finish; writing those specs is not part of this brief.
