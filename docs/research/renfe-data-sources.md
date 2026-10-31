# Renfe data sources (research, 2026-10-31)

Verified with live curl on 2026-10-31 unless marked UNVERIFIED.

## Official GTFS-Realtime (data.renfe.com, CC-BY 4.0, no auth, no CORS)

| Feed | URL (`.pb` or `.json`) | Refresh |
|---|---|---|
| Cercanías vehicle positions | `https://gtfsrt.renfe.com/vehicle_positions.pb` | ~20 s |
| AVE/LD/MD vehicle positions | `https://gtfsrt.renfe.com/vehicle_positions_LD.pb` | 15 s |
| Cercanías trip updates | `https://gtfsrt.renfe.com/trip_updates.pb` | 20 s |
| AVE/LD/MD trip updates | `https://gtfsrt.renfe.com/trip_updates_LD.pb` | 30 s |
| Cercanías service alerts | `https://gtfsrt.renfe.com/alerts.pb` | 20 s (looked stale) |

- Response headers: `Cache-Control: max-age=30`, `ETag`, `Last-Modified`. No rate-limit headers.
- The `.pb` responses are about 5x smaller than `.json` (23 KB vs 105 KB).
- Sample: 274 Cercanías vehicles (Rodalies and ex-FEVE included) and 142 LD vehicles.
- Fields: `tripId`, lat/lon, `currentStatus`, `stopId`, and a `vehicle.label` like `C1-23579-PLATF.(1)`.
- Missing: bearing, speed and occupancy.
- The LD feed has no per-vehicle timestamp, and its header timestamp is about 1 h off (timezone bug).
- Cercanías positions with status STOPPED_AT or INCOMING_AT are snapped to the station. Only IN_TRANSIT_TO is real GPS.
- Trip updates give a trip-level `delay` (seconds) and usually only the next stop.
- Alerts are Spanish only and cover Cercanías only.
- Iryo and Ouigo are not covered (UNVERIFIED).

## Official GTFS static

- Cercanías: `https://ssl.renfe.com/ftransit/Fichero_CER_FOMENTO/fomento_transit.zip`, 16 MB, updated daily.
  - Includes `shapes.txt` and wheelchair flags.
  - `stop_times` is 288 MB unzipped.
- AV/LD/MD: `https://ssl.renfe.com/gtransit/Fichero_AV_LD/google_transit.zip`, updated daily.
  - No `shapes.txt`; track geometry has to come from OpenStreetMap.
- Stations: `https://ssl.renfe.com/ftransit/Fichero_estaciones/estaciones.csv`, `;`-separated and Latin-1 encoded.
- All GTFS fields are space-padded, so trim before joining. `tripId` joins between RT and static: 273/274 (Cercanías), 142/142 (LD).
- Other datasets: ridership by time band (2018 data only) and rolling-stock specs. There is no historical punctuality dataset.

## Unofficial "visor" JSON (no license, stability unknown, no CORS)

- `https://tiempo-real.largorecorrido.renfe.com/renfe-visor/flotaLD.json`
  - 106 trains with continuous GPS.
  - Fields: `ultRetraso` (min), previous/next station, platform, rolling stock (`mat`), commercial code.
- `https://tiempo-real.largorecorrido.renfe.com/renfe-visor/trenesConEstacionesLD.json`
  - Per-train stop list with scheduled and estimated times.
- `https://tiempo-real.renfe.com/renfe-visor/flota.json`
  - Cercanías trains, including `porAvanc` (% progress to the next stop) and `retrasoMin`.

## Adif

- The Adif app API requires HMAC signing with keys extracted from the app. It is the only source with Iryo/Ouigo data.
- Not suitable for a public site.

## Prior art

- gariasf/viapeninsula (Cloudflare Worker proxy, OSM tracks), tenfe, trenes-espana.es, Renfetraso, retrasometro, open-tren.
- The punctuality projects build their own history by polling these feeds.
