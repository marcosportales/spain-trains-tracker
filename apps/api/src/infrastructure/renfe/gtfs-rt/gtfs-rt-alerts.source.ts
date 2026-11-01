import gtfsRealtime from 'gtfs-realtime-bindings';
import { ServiceAlertsSource } from '../../../application/realtime/service-alerts.source.js';
import {
  createServiceAlert,
  InvalidMovementValueError,
  type ServiceAlert,
} from '../../../domain/movement/index.js';
import type { SkippedEntity } from './gtfs-rt-positions.source.js';

const { transit_realtime: rt } = gtfsRealtime;

export const RENFE_ALERTS_URL = 'https://gtfsrt.renfe.com/alerts.pb';

const HEADER_MAX_LENGTH = 120;

/** Resolves GTFS `route_id`s to Line codes. Unknown route ids are left out of the result. */
export interface LineCodeLookup {
  lineCodesForRouteIds(routeIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}

export interface GtfsRtAlertsSourceOptions {
  readonly lines: LineCodeLookup;
  readonly url?: string;
  readonly fetch?: typeof fetch;
  /** Called for each alert left out of the result. */
  readonly onSkipped?: (problem: SkippedEntity) => void;
}

/**
 * Reads Renfe's GTFS-RT `alerts.pb` (Cercanías, Spanish only).
 *
 * - Lines: the `routeId` of each informed entity, resolved to a Line code. Unresolved ones are dropped.
 * - Stations: the `stopId` of each informed entity.
 * - Header: the feed has none, so it is the first sentence of the description, shortened.
 */
export class GtfsRtAlertsSource extends ServiceAlertsSource {
  private readonly lines: LineCodeLookup;
  private readonly url: string;
  private readonly fetchFn: typeof fetch;
  private readonly onSkipped: (problem: SkippedEntity) => void;

  constructor(options: GtfsRtAlertsSourceOptions) {
    super();
    this.lines = options.lines;
    this.url = options.url ?? RENFE_ALERTS_URL;
    this.fetchFn = options.fetch ?? fetch;
    this.onSkipped = options.onSkipped ?? (() => {});
  }

  async fetchServiceAlerts(): Promise<ServiceAlert[]> {
    const response = await this.fetchFn(this.url);
    if (!response.ok) throw new Error(`GET ${this.url} failed: ${response.status}`);
    const message = rt.FeedMessage.decode(new Uint8Array(await response.arrayBuffer()));

    const entities = message.entity.flatMap((entity) =>
      entity.alert ? [{ id: entity.id, alert: entity.alert }] : [],
    );
    const routeIds = new Set(
      entities.flatMap(({ alert }) =>
        (alert.informedEntity ?? []).map((e) => e.routeId?.trim() ?? ''),
      ),
    );
    routeIds.delete('');
    const lineByRoute =
      routeIds.size === 0 ? new Map() : await this.lines.lineCodesForRouteIds([...routeIds]);

    // A feed may repeat an id; storage takes one row per id, so the last one wins.
    const alerts = new Map<string, ServiceAlert>();
    for (const { id, alert } of entities) {
      try {
        const converted = toServiceAlert(id, alert, lineByRoute);
        alerts.set(converted.id, converted);
      } catch (error) {
        if (!(error instanceof InvalidMovementValueError)) throw error;
        this.onSkipped({ entityId: id, reason: error.message });
      }
    }
    return [...alerts.values()];
  }
}

function toServiceAlert(
  id: string,
  alert: gtfsRealtime.transit_realtime.IAlert,
  lineByRoute: ReadonlyMap<string, string>,
): ServiceAlert {
  const description = textOf(alert.descriptionText);
  const header = textOf(alert.headerText) || firstSentence(description);
  const url = textOf(alert.url);
  const informed = alert.informedEntity ?? [];
  const lineCodes = informed.flatMap((e) => {
    const code = lineByRoute.get(e.routeId?.trim() ?? '');
    return code === undefined ? [] : [code];
  });
  const stationCodes = informed.flatMap((e) => (e.stopId?.trim() ? [e.stopId.trim()] : []));

  return createServiceAlert({
    id,
    header,
    description,
    ...(url && { url }),
    activePeriods: (alert.activePeriod ?? []).map((p) => {
      const start = secondsToDate(p.start);
      const end = secondsToDate(p.end);
      return { ...(start && { start }), ...(end && { end }) };
    }),
    lineCodes,
    stationCodes,
    source: 'gtfsrt_cercanias',
  });
}

function textOf(
  translated: gtfsRealtime.transit_realtime.ITranslatedString | null | undefined,
): string {
  const translations = translated?.translation ?? [];
  const spanish = translations.find((t) => t.language === 'es') ?? translations[0];
  return spanish?.text?.trim() ?? '';
}

function firstSentence(text: string): string {
  const sentence = /^.*?[.!?](?=\s|$)/s.exec(text)?.[0] ?? text;
  return sentence.length <= HEADER_MAX_LENGTH
    ? sentence
    : `${sentence.slice(0, HEADER_MAX_LENGTH - 1).trimEnd()}…`;
}

function secondsToDate(seconds: number | Long | null | undefined): Date | undefined {
  if (seconds === null || seconds === undefined) return undefined;
  const value = Number(seconds);
  return value > 0 ? new Date(value * 1000) : undefined;
}
