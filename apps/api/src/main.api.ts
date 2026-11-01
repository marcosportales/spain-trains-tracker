import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import type { Env } from './infrastructure/config/env.js';
import { ApiModule } from './infrastructure/http/api.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ApiModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // Read-only public data; the web app's EventSource and fetches call the API cross-origin.
  app.enableCors();
  app.enableShutdownHooks();
  const port = app.get<ConfigService<Env, true>>(ConfigService).get('PORT', { infer: true });
  await app.listen(port);
}

await bootstrap();
