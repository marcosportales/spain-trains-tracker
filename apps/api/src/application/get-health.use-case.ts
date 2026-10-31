import { Injectable } from '@nestjs/common';

export type HealthStatus = { status: 'ok' };

@Injectable()
export class GetHealth {
  execute(): HealthStatus {
    return { status: 'ok' };
  }
}
