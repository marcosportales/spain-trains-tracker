import type { ServiceAlertDto } from '@stt/contracts';
import type { ServiceAlert } from '../../domain/movement/index.js';
import type { MovementRepository } from '../movement/movement.repository.js';

export interface ServiceAlertsQuery {
  /** `true`: only alerts in force now. `false`: only the others. Omitted: all. */
  readonly active?: boolean;
  readonly lineCode?: string;
}

/** An alert is in force when it has not left its feed and now falls in one of its active periods. */
export function isServiceAlertActive(alert: ServiceAlert, now: Date): boolean {
  if (alert.endedAt) return false;
  if (alert.activePeriods.length === 0) return true;
  return alert.activePeriods.some(
    (period) => (!period.start || period.start <= now) && (!period.end || now <= period.end),
  );
}

function toDto(alert: ServiceAlert): ServiceAlertDto {
  const starts = alert.activePeriods.flatMap((p) => (p.start ? [p.start.getTime()] : []));
  const ends = alert.activePeriods.flatMap((p) => (p.end ? [p.end.getTime()] : []));
  // One open-ended period keeps the whole alert open.
  const closed = alert.activePeriods.length > 0 && ends.length === alert.activePeriods.length;
  return {
    id: alert.id,
    lineCodes: [...alert.lineCodes],
    header: alert.header,
    description: alert.description,
    ...(starts.length > 0 && { activeFrom: new Date(Math.min(...starts)).toISOString() }),
    ...(closed && { activeUntil: new Date(Math.max(...ends)).toISOString() }),
  };
}

/** Service alerts, optionally only the active ones or those affecting one Line. */
export class ListServiceAlerts {
  constructor(
    private readonly movement: MovementRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(query: ServiceAlertsQuery = {}): Promise<ServiceAlertDto[]> {
    const now = this.clock();
    const alerts = await this.movement.listServiceAlerts();
    return alerts
      .filter((alert) => alert.lineCodes.length > 0)
      .filter((alert) => query.lineCode === undefined || alert.lineCodes.includes(query.lineCode))
      .filter(
        (alert) => query.active === undefined || isServiceAlertActive(alert, now) === query.active,
      )
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(toDto);
  }
}
