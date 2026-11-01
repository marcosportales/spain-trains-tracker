import { Module } from '@nestjs/common';
import { GetHealth } from '../../application/get-health.use-case.js';
import { GetLiveSnapshot } from '../../application/live/get-live-snapshot.use-case.js';
import { LiveRunsReader } from '../../application/live/live-runs.reader.js';
import { NetworkRepository } from '../../application/network/network.repository.js';
import { AppConfigModule } from '../config/app-config.module.js';
import { DbModule } from '../db/db.module.js';
import { DrizzleLiveRunsReader } from '../db/drizzle-live-runs.reader.js';
import { DrizzleNetworkRepository } from '../db/drizzle-network.repository.js';
import { LoggingModule } from '../logging/logging.module.js';
import { HealthController } from './health.controller.js';
import { LiveController } from './live.controller.js';

@Module({
  imports: [AppConfigModule, LoggingModule, DbModule],
  controllers: [HealthController, LiveController],
  providers: [
    GetHealth,
    { provide: LiveRunsReader, useClass: DrizzleLiveRunsReader },
    { provide: NetworkRepository, useClass: DrizzleNetworkRepository },
    {
      provide: GetLiveSnapshot,
      inject: [LiveRunsReader, NetworkRepository],
      useFactory: (reader: LiveRunsReader, network: NetworkRepository) =>
        new GetLiveSnapshot(reader, network),
    },
  ],
})
export class ApiModule {}
