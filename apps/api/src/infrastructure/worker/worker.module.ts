import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { MovementRepository } from '../../application/movement/movement.repository.js';
import { ImportStaticNetwork } from '../../application/network/import-static-network.use-case.js';
import { NetworkRepository } from '../../application/network/network.repository.js';
import { StaticFeeds } from '../../application/network/static-feeds.js';
import { AppConfigModule } from '../config/app-config.module.js';
import type { Env } from '../config/env.js';
import { DbModule } from '../db/db.module.js';
import { DrizzleMovementRepository } from '../db/drizzle-movement.repository.js';
import { DrizzleNetworkRepository } from '../db/drizzle-network.repository.js';
import { LoggingModule } from '../logging/logging.module.js';
import { HttpStaticFeeds } from '../renfe/http-static-feeds.js';
import { HEARTBEAT_INTERVAL_MS, HEARTBEAT_LOGGER, HeartbeatService } from './heartbeat.service.js';
import {
  STATIC_IMPORT,
  STATIC_IMPORT_LOGGER,
  StaticImportScheduler,
} from './static-import.scheduler.js';

@Module({
  imports: [AppConfigModule, LoggingModule, DbModule],
  providers: [
    HeartbeatService,
    StaticImportScheduler,
    { provide: NetworkRepository, useClass: DrizzleNetworkRepository },
    { provide: MovementRepository, useClass: DrizzleMovementRepository },
    {
      provide: StaticFeeds,
      inject: [Logger],
      useFactory: (logger: Logger) =>
        new HttpStaticFeeds({
          onMalformedStationRow: ({ line, reason }) =>
            logger.warn(`estaciones.csv line ${line} skipped: ${reason}`),
        }),
    },
    {
      provide: STATIC_IMPORT,
      inject: [StaticFeeds, NetworkRepository, Logger],
      useFactory: (feeds: StaticFeeds, repository: NetworkRepository, logger: Logger) =>
        new ImportStaticNetwork(feeds, repository, logger),
    },
    { provide: STATIC_IMPORT_LOGGER, useExisting: Logger },
    { provide: HEARTBEAT_LOGGER, useExisting: Logger },
    {
      provide: HEARTBEAT_INTERVAL_MS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get('WORKER_HEARTBEAT_INTERVAL_MS', { infer: true }),
    },
  ],
})
export class WorkerModule {}
