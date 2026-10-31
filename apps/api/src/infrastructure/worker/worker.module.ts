import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppConfigModule } from '../config/app-config.module.js';
import type { Env } from '../config/env.js';
import { LoggingModule } from '../logging/logging.module.js';
import { HEARTBEAT_INTERVAL_MS, HEARTBEAT_LOGGER, HeartbeatService } from './heartbeat.service.js';

@Module({
  imports: [AppConfigModule, LoggingModule],
  providers: [
    HeartbeatService,
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
