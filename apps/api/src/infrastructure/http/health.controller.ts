import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { HealthDto } from '@stt/contracts';
import { GetHealth } from '../../application/get-health.use-case.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(GetHealth) private readonly getHealth: GetHealth) {}

  @Get()
  async get(): Promise<HealthDto> {
    const report = await this.getHealth.execute();
    if (report.status === 'down') throw new ServiceUnavailableException(report);
    return report;
  }
}
