import type { ServiceAlert } from '../../domain/movement/index.js';

/** Reads the Service alerts currently published by an Official feed. */
export abstract class ServiceAlertsSource {
  /** Every alert in the feed. Rejects if the feed fails. */
  abstract fetchServiceAlerts(): Promise<ServiceAlert[]>;
}
