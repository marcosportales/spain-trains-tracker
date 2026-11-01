import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { GetHealth } from '../../application/get-health.use-case.js';
import { GetLiveSnapshot } from '../../application/live/get-live-snapshot.use-case.js';
import { LiveNotifications } from '../../application/live/live-notifications.js';
import { LiveRunsReader } from '../../application/live/live-runs.reader.js';
import { LiveStream } from '../../application/live/live-stream.js';
import { NetworkRepository } from '../../application/network/network.repository.js';
import { GetRunDetail } from '../../application/run/get-run-detail.use-case.js';
import { RunDetailReader } from '../../application/run/run-detail.reader.js';
import { SearchReader } from '../../application/search/search.reader.js';
import { SearchCatalog } from '../../application/search/search-catalog.use-case.js';
import { GetStationBoard } from '../../application/station/get-station-board.use-case.js';
import { ListStations } from '../../application/station/list-stations.use-case.js';
import { StationBoardReader } from '../../application/station/station-board.reader.js';
import { AppConfigModule } from '../config/app-config.module.js';
import { DbModule } from '../db/db.module.js';
import { DrizzleLiveRunsReader } from '../db/drizzle-live-runs.reader.js';
import { DrizzleNetworkRepository } from '../db/drizzle-network.repository.js';
import { DrizzleRunDetailReader } from '../db/drizzle-run-detail.reader.js';
import { DrizzleSearchReader } from '../db/drizzle-search.reader.js';
import { DrizzleStationBoardReader } from '../db/drizzle-station-board.reader.js';
import { PostgresLiveNotifications } from '../db/postgres-live-notifications.js';
import { LoggingModule } from '../logging/logging.module.js';
import { HealthController } from './health.controller.js';
import { LiveController } from './live.controller.js';
import { RunsController } from './runs.controller.js';
import { SearchController } from './search.controller.js';
import { StationsController } from './stations.controller.js';

@Module({
  imports: [AppConfigModule, LoggingModule, DbModule],
  controllers: [
    HealthController,
    LiveController,
    RunsController,
    SearchController,
    StationsController,
  ],
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
    { provide: RunDetailReader, useClass: DrizzleRunDetailReader },
    {
      provide: GetRunDetail,
      inject: [RunDetailReader, NetworkRepository],
      useFactory: (reader: RunDetailReader, network: NetworkRepository) =>
        new GetRunDetail(reader, network),
    },
    { provide: StationBoardReader, useClass: DrizzleStationBoardReader },
    {
      provide: GetStationBoard,
      inject: [StationBoardReader, NetworkRepository],
      useFactory: (reader: StationBoardReader, network: NetworkRepository) =>
        new GetStationBoard(reader, network),
    },
    { provide: SearchReader, useClass: DrizzleSearchReader },
    {
      provide: SearchCatalog,
      inject: [SearchReader],
      useFactory: (reader: SearchReader) => new SearchCatalog(reader),
    },
    {
      provide: ListStations,
      inject: [NetworkRepository],
      useFactory: (network: NetworkRepository) => new ListStations(network),
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
