import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

export const HEARTBEAT_LOGGER = Symbol('HEARTBEAT_LOGGER');
export const HEARTBEAT_INTERVAL_MS = Symbol('HEARTBEAT_INTERVAL_MS');

export type HeartbeatLogger = { log(message: string): void };

@Injectable()
export class HeartbeatService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    @Inject(HEARTBEAT_LOGGER) private readonly logger: HeartbeatLogger,
    @Inject(HEARTBEAT_INTERVAL_MS) private readonly intervalMs: number,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => this.logger.log('worker heartbeat'), this.intervalMs);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
