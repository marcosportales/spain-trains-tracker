# GTFS static parser

`readGtfsRows(zipPath, 'stop_times')` streams one file of a Renfe GTFS zip as typed rows
(yauzl + csv-parse). Every header and value is trimmed (Renfe pads with spaces). Optional files
absent from the zip (`calendar`, `calendar_dates`, `shapes`) yield nothing; required ones throw.

## Memory check (manual)

Acceptance criterion: memory stays under 300 MB parsing the full Cercanías zip.

Run on 2026-11-01 against `https://ssl.renfe.com/ftransit/Fichero_CER_FOMENTO/fomento_transit.zip`
(16 MB), iterating all of `stop_times.txt` and sampling `process.memoryUsage().rss` every 100k rows:

| Rows | Peak RSS | Time |
|---|---|---|
| 1,907,767 | 118 MB (includes the tsx runtime) | 14 s |

To repeat: download the zip, then run a script that does
`for await (const _ of readGtfsRows(zip, 'stop_times')) { /* sample process.memoryUsage().rss */ }`.
