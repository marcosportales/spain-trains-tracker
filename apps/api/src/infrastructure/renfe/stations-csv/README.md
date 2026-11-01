# Stations CSV

`parseStationsCsv(bytes, { onMalformedRow })` turns Renfe's `estaciones.csv` (`;`-separated,
Windows-1252) into `StationRecord`s: a domain `Station` plus the address, postal code, town,
province and the Cercanías / Ancho métrico flags that `Station` has no field for.

- Malformed rows (broken quoting, empty code, missing or out-of-range coordinates) go to
  `onMalformedRow({ line, reason })` and are skipped. They never abort the parse.
- Service types come from the two flags. The file cannot tell AVE, Larga Distancia and Media
  Distancia apart, so a Station with neither flag gets the provisional `larga_distancia`.

## Full-file check (manual)

Acceptance criterion: all 1,033 stations parse in the full file.

Run on 2026-11-01 against `https://ssl.renfe.com/ftransit/Fichero_estaciones/estaciones.csv`:
1,033 parsed, 0 malformed. LOGROÑO, LLEIDA-PIRINEUS and MADRID-PUERTA DE ATOCHA decode correctly.
