import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { LiveUpdatesPublisher } from '../../application/live/live-updates.publisher.js';
import { RunIngestCycle } from '../../application/live/run-ingest-cycle.use-case.js';
import { MovementRepository } from '../../application/movement/movement.repository.js';
import { ImportStaticNetwork } from '../../application/network/import-static-network.use-case.js';
import { NetworkRepository } from '../../application/network/network.repository.js';
import { StaticFeeds } from '../../application/network/static-feeds.js';
import { FeedHealthSource } from '../../application/realtime/feed-health.source.js';
import { FeedHealthStore } from '../../application/realtime/feed-health.store.js';
import { AppConfigModule } from '../config/app-config.module.js';
import type { Env } from '../config/env.js';
import { DbModule } from '../db/db.module.js';
import { DrizzleFeedHealthStore } from '../db/drizzle-feed-health.store.js';
import { DrizzleMovementRepository } from '../db/drizzle-movement.repository.js';
import { DrizzleNetworkRepository } from '../db/drizzle-network.repository.js';
import { PostgresLiveUpdatesPublisher } from '../db/postgres-live-updates.publisher.js';
import { LoggingModule } from '../logging/logging.module.js';
import { HttpStaticFeeds } from '../renfe/http-static-feeds.js';
import { RenfeVisorFeed } from '../renfe/visor/visor-feed.js';
import { FeedHealthReporter } from './feed-health.reporter.js';
import { FeedPollers } from './feed-pollers.js';
import { HEARTBEAT_INTERVAL_MS, HEARTBEAT_LOGGER, HeartbeatService } from './heartbeat.service.js';
import {
  STATIC_IMPORT,
  STATIC_IMPORT_LOGGER,
  StaticImportScheduler,
} from './static-import.scheduler.js';
import { createVisorPollers } from './visor-pollers.js';

@Module({
  imports: [AppConfigModule, LoggingModule, DbModule],
  providers: [
    HeartbeatService,
    StaticImportScheduler,
    { provide: NetworkRepository, useClass: DrizzleNetworkRepository },
    { provide: MovementRepository, useClass: DrizzleMovementRepository },
    { provide: LiveUpdatesPublisher, useClass: PostgresLiveUpdatesPublisher },
    {
      provide: RunIngestCycle,
      inject: [MovementRepository, LiveUpdatesPublisher],
      useFactory: (repository: MovementRepository, publisher: LiveUpdatesPublisher) =>
        new RunIngestCycle(repository, publisher),
    },
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
    {
      provide: FeedPollers,
      inject: [ConfigService, NetworkRepository, MovementRepository, RunIngestCycle, Logger],
      useFactory: (
        config: ConfigService<Env, true>,
        network: NetworkRepository,
        movement: MovementRepository,
        cycle: RunIngestCycle,
        logger: Logger,
      ) =>
        new FeedPollers(
          createVisorPollers({
            enabled: config.get('VISOR_FEED_ENABLED', { infer: true }),
            intervalMs: config.get('FEED_POLL_INTERVAL_MS', { infer: true }),
            fetch,
            logger,
            feed: new RenfeVisorFeed({
              timetable: network,
              onSkipped: ({ entityId, reason }) =>
                logger.warn(`visor entity ${entityId} skipped: ${reason}`),
            }),
            cycle,
            repository: movement,
          }),
        ),
    },
    { provide: FeedHealthSource, useExisting: FeedPollers },
    { provide: FeedHealthStore, useClass: DrizzleFeedHealthStore },
    {
      provide: FeedHealthReporter,
      inject: [FeedHealthSource, FeedHealthStore, ConfigService, Logger],
      useFactory: (
        source: FeedHealthSource,
        store: FeedHealthStore,
        config: ConfigService<Env, true>,
        logger: Logger,
      ) =>
        new FeedHealthReporter(
          source,
          store,
          config.get('WORKER_HEARTBEAT_INTERVAL_MS', { infer: true }),
          logger,
        ),
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
