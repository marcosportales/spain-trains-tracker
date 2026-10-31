import { Module } from '@nestjs/common';
import { GetHealth } from '../../application/get-health.use-case.js';
import { AppConfigModule } from '../config/app-config.module.js';
import { LoggingModule } from '../logging/logging.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [AppConfigModule, LoggingModule],
  controllers: [HealthController],
  providers: [GetHealth],
})
export class ApiModule {}
