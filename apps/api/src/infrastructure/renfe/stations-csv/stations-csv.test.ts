import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseStationsCsv } from './stations-csv.js';

const HEADER =
  '"CODIGO";"DESCRIPCION";"LATITUD";"LONGITUD";"DIRECION";"CP";"POBLACION";"PROVINCIA";"PAIS";"CERCANIAS";"ANCHO MÉTRICO";"COMUN"';

/** Renfe serves the file as Latin-1, so tests encode it the same way. */
const latin1 = (...lines: string[]): Buffer => Buffer.from(lines.join('\r\n'), 'latin1');

const LOGRONO =
  '"81100";"LOGROÑO";"42.4574590";"-2.4421930";"Avda. de Colon, 83";"26003";"LOGROÑO";"RIOJA, LA";"ESPAÑA";"NO";"NO";""';
const ATOCHA =
  '"60000";"MADRID-PUERTA DE ATOCHA-ALMUDENA GRANDES";"40.4064420";"-3.6908860";"Glorieta Emperador Carlos V, S/N";"28045";"MADRID";"MADRID";"ESPAÑA";"NO";"NO";""';
const TARREGA =
  '"78408";"TÀRREGA";"41.6503870";"1.13896300";"C/ del Segle Xx, S/N";"25300";"TÀRREGA";"LLEIDA";"ESPAÑA";"SI";"NO";""';

describe('parseStationsCsv', () => {
  it('decodes Latin-1 accents in names, towns and provinces', () => {
    const records = parseStationsCsv(latin1(HEADER, LOGRONO, ATOCHA, TARREGA));

    expect(records.map((r) => r.station.name)).toEqual([
      'LOGROÑO',
      'MADRID-PUERTA DE ATOCHA-ALMUDENA GRANDES',
      'TÀRREGA',
    ]);
    expect(records[0]).toMatchObject({ town: 'LOGROÑO', province: 'RIOJA, LA' });
    expect(records[2]?.province).toBe('LLEIDA');
  });

  it('maps code, coordinates, address, town, province and the Cercanías / Ancho métrico flags', () => {
    const both =
      '"12345";"EJEMPLO";"41.6157446";"0.6269556 ";"";"25191";"LLEIDA";"LLEIDA";"ESPAÑA";"SI";"SI";""';

    const [tarrega, example] = parseStationsCsv(latin1(HEADER, TARREGA, both));

    expect(tarrega).toEqual({
      station: {
        code: '78408',
        name: 'TÀRREGA',
        lat: 41.650387,
        lon: 1.138963,
        serviceTypes: ['cercanias'],
      },
      address: 'C/ del Segle Xx, S/N',
      postalCode: '25300',
      town: 'TÀRREGA',
      province: 'LLEIDA',
      cercanias: true,
      anchoMetrico: false,
    });
    // The padded coordinate parses, and an empty address is omitted rather than kept as "".
    expect(example?.station.lon).toBe(0.6269556);
    expect(example?.station.serviceTypes).toEqual(['cercanias', 'ancho_metrico']);
    expect(example).not.toHaveProperty('address');
    expect(example?.anchoMetrico).toBe(true);
  });

  it('logs malformed rows instead of failing and keeps parsing the rest', () => {
    const noLatitude =
      '"11111";"SIN LATITUD";"";"-3.7";"";"";"MADRID";"MADRID";"ESPAÑA";"NO";"NO";""';
    const noCode = '"";"SIN CODIGO";"40.1";"-3.7";"";"";"MADRID";"MADRID";"ESPAÑA";"NO";"NO";""';
    const outOfRange =
      '"22222";"FUERA DE RANGO";"140.1";"-3.7";"";"";"MADRID";"MADRID";"ESPAÑA";"NO";"NO";""';
    const unclosedQuote =
      '"33333";"COMILLA SIN CERRAR;"40.1";"-3.7";"";"";"X";"X";"ESPAÑA";"NO";"NO";""';
    const malformed: { line: number; reason: string }[] = [];

    const records = parseStationsCsv(
      latin1(HEADER, LOGRONO, noLatitude, noCode, outOfRange, unclosedQuote, ATOCHA),
      { onMalformedRow: (problem) => malformed.push(problem) },
    );

    expect(records.map((r) => r.station.code)).toEqual(['81100', '60000']);
    expect(malformed.map((m) => m.line)).toEqual([3, 4, 5, 6]);
    expect(malformed.every((m) => m.reason.length > 0)).toBe(true);
  });

  it('parses the recorded 2026-10-31 file without any malformed row', async () => {
    const bytes = await readFile(
      fileURLToPath(
        new URL('../../../../test/fixtures/2026-10-31/static/estaciones.csv', import.meta.url),
      ),
    );
    const malformed: unknown[] = [];

    const records = parseStationsCsv(bytes, { onMalformedRow: (p) => malformed.push(p) });

    expect(malformed).toEqual([]);
    expect(records).toHaveLength(50);
    expect(new Set(records.map((r) => r.station.code)).size).toBe(50);
  });
});
