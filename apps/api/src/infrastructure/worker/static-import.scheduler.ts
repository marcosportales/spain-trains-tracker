import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { ImportStaticNetwork } from '../../application/network/import-static-network.use-case.js';
import { nextMadridTime } from './next-run.js';

export const STATIC_IMPORT = Symbol('STATIC_IMPORT');
export const STATIC_IMPORT_LOGGER = Symbol('STATIC_IMPORT_LOGGER');

export type SchedulerLogger = { log(message: string): void; error(message: string): void };

/** Imports the static network at 03:30 Europe/Madrid, and on startup when a source was never imported. */
@Injectable()
export class StaticImportScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  static readonly HOUR = 3;
  static readonly MINUTE = 30;

  private timer: NodeJS.Timeout | undefined;
  private stopped = false;

  constructor(
    @Inject(STATIC_IMPORT)
    private readonly importer: Pick<ImportStaticNetwork, 'execute' | 'isMissingData'>,
    @Inject(STATIC_IMPORT_LOGGER) private readonly logger: SchedulerLogger,
  ) {}

  onApplicationBootstrap(): void {
    this.scheduleNext();
    // Not awaited: a long first import must not hold up the worker's startup.
    void this.runIfNeverImported();
  }

  onApplicationShutdown(): void {
    this.stopped = true;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  async runIfNeverImported(): Promise<void> {
    try {
      if (await this.importer.isMissingData()) await this.importer.execute();
    } catch (error) {
      this.logger.error(`startup static import failed: ${describe(error)}`);
    }
  }

  private scheduleNext(): void {
    const at = nextMadridTime(new Date(), StaticImportScheduler.HOUR, StaticImportScheduler.MINUTE);
    this.logger.log(`next static import at ${at.toISOString()}`);
    // setTimeout caps at ~24.8 days; the next run is always within a day.
    this.timer = setTimeout(() => void this.runScheduled(), at.getTime() - Date.now());
  }

  private async runScheduled(): Promise<void> {
    try {
      await this.importer.execute();
    } catch (error) {
      this.logger.error(`scheduled static import failed: ${describe(error)}`);
    } finally {
      if (!this.stopped) this.scheduleNext();
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
