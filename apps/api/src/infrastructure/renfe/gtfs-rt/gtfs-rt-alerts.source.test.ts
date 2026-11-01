import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import gtfsRealtime from 'gtfs-realtime-bindings';
import { describe, expect, it } from 'vitest';
import { GtfsRtAlertsSource, type LineCodeLookup } from './gtfs-rt-alerts.source.js';

const { transit_realtime: rt } = gtfsRealtime;
const FIXTURES = join(import.meta.dirname, '../../../../test/fixtures/2026-10-31');
const respond =
  (body: Uint8Array, status = 200): typeof fetch =>
  async () =>
    new Response(body, { status });

/** Line codes as the static import builds them: `<hub>-<short name>`, hub from the route id prefix. */
function fixtureLines(): LineCodeLookup {
  const rows = readFileSync(join(FIXTURES, 'static/cercanias/routes.txt'), 'utf8')
    .split('\n')
    .slice(1);
  const map = new Map<string, string>();
  for (const row of rows) {
    const [routeId, shortName] = row.split(',').map((c) => c.trim());
    if (routeId && shortName) map.set(routeId, `${routeId.slice(0, 2)}-${shortName}`);
  }
  return {
    lineCodesForRouteIds: async (ids) =>
      new Map(ids.flatMap((id) => (map.has(id) ? [[id, map.get(id) as string] as const] : []))),
  };
}

const fixture = new Uint8Array(readFileSync(join(FIXTURES, 'alerts.pb')));

describe('GtfsRtAlertsSource', () => {
  it('decodes every fixture alert and resolves Line references', async () => {
    const source = new GtfsRtAlertsSource({ lines: fixtureLines(), fetch: respond(fixture) });
    const alerts = await source.fetchServiceAlerts();

    // 69 entities, one of them repeating an id.
    expect(alerts).toHaveLength(68);
    expect(alerts.every((a) => a.source === 'gtfsrt_cercanias')).toBe(true);
    const first = alerts.find((a) => a.id === 'AVISO_518335');
    expect(first?.lineCodes).toContain('10-C4');
    expect(first?.activePeriods).toEqual([{ start: new Date(1791356520 * 1000) }]);
    expect(first?.description).toMatch(/^#MadC4b Por reajuste/);
    expect(first?.header.length).toBeLessThanOrEqual(120);
    const withLines = alerts.filter((a) => a.lineCodes.length > 0);
    // The static fixture is a trimmed sample, so only some of the alerts' routes are known.
    expect(withLines).toHaveLength(5);
    expect(alerts.some((a) => a.stationCodes.length > 0)).toBe(true);
  });

  it('resolves a Line for every alert that references a route when all routes are known', async () => {
    const everyRoute: LineCodeLookup = {
      lineCodesForRouteIds: async (ids) => new Map(ids.map((id) => [id, `L-${id}`])),
    };
    const alerts = await new GtfsRtAlertsSource({
      lines: everyRoute,
      fetch: respond(fixture),
    }).fetchServiceAlerts();
    const decoded = rt.FeedMessage.decode(fixture).entity;
    const expected = new Set(
      decoded.filter((e) => e.alert?.informedEntity?.some((i) => i.routeId)).map((e) => e.id),
    ).size;
    expect(alerts.filter((a) => a.lineCodes.length > 0)).toHaveLength(expected);
    expect(expected).toBeGreaterThan(0);
  });

  it('drops route ids that match no Line', async () => {
    const body = rt.FeedMessage.encode(
      rt.FeedMessage.create({
        header: { gtfsRealtimeVersion: '2.0' },
        entity: [
          {
            id: 'A1',
            alert: {
              informedEntity: [{ routeId: 'NOPE' }, { routeId: 'R1' }, { stopId: ' 60000 ' }],
              headerText: { translation: [{ text: 'Titulo', language: 'es' }] },
              descriptionText: { translation: [{ text: 'Detalle. Mas.', language: 'es' }] },
              url: { translation: [{ text: 'https://x.test/a', language: 'es' }] },
              activePeriod: [{ start: 1000, end: 2000 }],
            },
          },
        ],
      }),
    ).finish();
    const lines: LineCodeLookup = { lineCodesForRouteIds: async () => new Map([['R1', '10-C1']]) };
    const [alert] = await new GtfsRtAlertsSource({
      lines,
      fetch: respond(body),
    }).fetchServiceAlerts();

    expect(alert).toMatchObject({
      header: 'Titulo',
      url: 'https://x.test/a',
      lineCodes: ['10-C1'],
      stationCodes: ['60000'],
      activePeriods: [{ start: new Date(1_000_000), end: new Date(2_000_000) }],
    });
  });

  it('keeps one alert per id when the feed repeats an entity (last one wins)', async () => {
    const entity = (description: string) => ({
      id: 'AVISO_1',
      alert: { descriptionText: { translation: [{ text: description, language: 'es' }] } },
    });
    const body = rt.FeedMessage.encode(
      rt.FeedMessage.create({
        header: { gtfsRealtimeVersion: '2.0' },
        entity: [entity('Primera.'), entity('Segunda.')],
      }),
    ).finish();
    const lines: LineCodeLookup = { lineCodesForRouteIds: async () => new Map() };
    const alerts = await new GtfsRtAlertsSource({
      lines,
      fetch: respond(body),
    }).fetchServiceAlerts();
    expect(alerts.map((a) => [a.id, a.description])).toEqual([['AVISO_1', 'Segunda.']]);
  });

  it('skips an alert without description and reports it', async () => {
    const body = rt.FeedMessage.encode(
      rt.FeedMessage.create({
        header: { gtfsRealtimeVersion: '2.0' },
        entity: [{ id: 'EMPTY', alert: { informedEntity: [] } }],
      }),
    ).finish();
    const skipped: string[] = [];
    const lines: LineCodeLookup = { lineCodesForRouteIds: async () => new Map() };
    const alerts = await new GtfsRtAlertsSource({
      lines,
      fetch: respond(body),
      onSkipped: (p) => skipped.push(p.entityId),
    }).fetchServiceAlerts();
    expect(alerts).toEqual([]);
    expect(skipped).toEqual(['EMPTY']);
  });

  it('rejects when the feed answers with an error', async () => {
    const source = new GtfsRtAlertsSource({
      lines: fixtureLines(),
      fetch: respond(new Uint8Array(), 503),
    });
    await expect(source.fetchServiceAlerts()).rejects.toThrow(/503/);
  });
});
