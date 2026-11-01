import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import type { Env } from './infrastructure/config/env.js';
import { ApiModule } from './infrastructure/http/api.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ApiModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  // The web app's EventSource and fetches call the API cross-origin; only its origin is allowed.
  app.enableCors({ origin: config.get('WEB_ORIGIN', { infer: true }) });
  app.enableShutdownHooks();
  const port = config.get('PORT', { infer: true });
  await app.listen(port);
}

await bootstrap();
