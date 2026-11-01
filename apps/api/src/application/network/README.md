# Static network import

`ImportStaticNetwork` downloads Renfe's three static datasets and stores the network. The worker
runs it at 03:30 Europe/Madrid, and on startup when any source was never imported
(`StaticImportScheduler`).

| Source | URL | Content |
|---|---|---|
| `estaciones` | `estaciones.csv` | Stations (imported first: the GTFS sources reference them) |
| `cercanias` | `fomento_transit.zip` | Cercanías Lines, scheduled Runs, stops, Track geometry |
| `larga-distancia` | `google_transit.zip` | AVE / Larga Distancia / Media Distancia Lines, Runs, stops |

- Each request sends `If-None-Match` with the ETag of the source's last import. `304` means the
  source is skipped with no writes (and no new import record).
- A changed source is saved in one transaction (`saveStaticNetwork`). A failing source is reported
  and does not stop the others.
- Stations already stored keep their data; GTFS imports only add Service types and a Hub. Stations
  missing from the CSV are created from the GTFS stop.

## Mapping

- **Line**: Cercanías `route_short_name` prefixed with the Hub code (`10-C1`, because C1 exists in
  several Hubs); AV/LD/MD uses `route_short_name` (`ALVIA`, `AVE`). Both directions of a Cercanías
  route share one Line.
- **Train number**: AV/LD/MD `trip_short_name`; Cercanías the 5 digits in the trip id
  (`3003S23578C1` → `23578`). One Train number can have several trip variants on a date.

## Service type rule

`route_type` is 2 (rail) on every route in both feeds, so the type comes from the route name
(`classifyServiceType`, covered by tests):

| Feed | Rule |
|---|---|
| Cercanías | `cercanias`; `ancho_metrico` when the name says FEVE/ancho, or every Station of the route is metre-gauge only |
| AV/LD/MD | by the first word of `route_short_name`: AVE, AVLO → `ave`; Avant, MD, Regional, `R11`, Proximidad, Trencelta, Lanzadera → `media_distancia`; Alvia, Intercity, Altaria, Euromed, Talgo, Trenhotel, Arco, Alaris → `larga_distancia`; FEVE/ancho → `ancho_metrico`; anything else → `larga_distancia` |

## Live check (manual)

2026-11-01, real feeds into an empty schema, first import 2 min 6 s: 1,907,767 Cercanías stops,
138,503 Cercanías Runs, 8,532 AV/LD/MD Runs (1,941 `ave`, 2,338 `larga_distancia`, 4,253
`media_distancia`).

Every `tripId` in the live `vehicle_positions.pb` and `vehicle_positions_LD.pb` feeds: 416 of 416
(100%) resolve to a scheduled Run. The recorded fixtures cannot show this: the static fixtures are
50-row samples that do not overlap the recorded realtime ids.

The AV/LD/MD server returns a different ETag on every request, so that source is re-imported on
each run. The upserts are idempotent, so this costs time, not correctness.
