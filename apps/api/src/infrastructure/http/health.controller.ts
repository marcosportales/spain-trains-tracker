import { Controller, Get, Inject } from '@nestjs/common';
import { GetHealth, type HealthStatus } from '../../application/get-health.use-case.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(GetHealth) private readonly getHealth: GetHealth) {}

  @Get()
  get(): HealthStatus {
    return this.getHealth.execute();
  }
}
