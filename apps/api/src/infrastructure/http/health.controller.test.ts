import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HealthDto } from '@stt/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GetHealth } from '../../application/get-health.use-case.js';
import type { FeedHealth } from '../../application/realtime/feed-health.source.js';
import { FeedHealthStore } from '../../application/realtime/feed-health.store.js';
import { HealthController } from './health.controller.js';

class FakeStore extends FeedHealthStore {
  feeds: FeedHealth[] = [];
  down = false;
  async save(): Promise<void> {}
  async list(): Promise<FeedHealth[]> {
    if (this.down) throw new Error('connection refused');
    return this.feeds;
  }
}

describe('GET /health', () => {
  let app: INestApplication;
  const store = new FakeStore();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [GetHealth, { provide: FeedHealthStore, useValue: store }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('returns 200 with lastSuccessAt per feed', async () => {
    store.down = false;
    store.feeds = [
      {
        feed: 'visor-cercanias',
        lastSuccessAt: new Date('2026-10-31T10:15:30Z'),
        lastError: null,
        consecutiveFailures: 0,
      },
    ];
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(HealthDto.parse(res.body).feeds[0]?.lastSuccessAt).toBe('2026-10-31T10:15:30.000Z');
    expect(res.body.status).toBe('ok');
  });

  it('returns 503 when the database is down', async () => {
    store.down = true;
    const res = await request(app.getHttpServer()).get('/health').expect(503);
    expect(res.body).toMatchObject({ status: 'down', database: 'down' });
  });
});
