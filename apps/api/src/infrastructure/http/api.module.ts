import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { GetHealth } from '../../application/get-health.use-case.js';
import { GetLiveSnapshot } from '../../application/live/get-live-snapshot.use-case.js';
import { LiveNotifications } from '../../application/live/live-notifications.js';
import { LiveRunsReader } from '../../application/live/live-runs.reader.js';
import { LiveStream } from '../../application/live/live-stream.js';
import { NetworkRepository } from '../../application/network/network.repository.js';
import { AppConfigModule } from '../config/app-config.module.js';
import { DbModule } from '../db/db.module.js';
import { DrizzleLiveRunsReader } from '../db/drizzle-live-runs.reader.js';
import { DrizzleNetworkRepository } from '../db/drizzle-network.repository.js';
import { PostgresLiveNotifications } from '../db/postgres-live-notifications.js';
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
    { provide: LiveNotifications, useClass: PostgresLiveNotifications },
    {
      provide: LiveStream,
      inject: [LiveNotifications, GetLiveSnapshot, NetworkRepository],
      useFactory: (
        notifications: LiveNotifications,
        snapshot: GetLiveSnapshot,
        network: NetworkRepository,
      ) => new LiveStream(notifications, snapshot, network),
    },
  ],
})
export class ApiModule implements OnModuleDestroy {
  constructor(@Inject(LiveStream) private readonly liveStream: LiveStream) {}

  async onModuleDestroy(): Promise<void> {
    await this.liveStream.close();
  }
}
