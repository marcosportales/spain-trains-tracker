import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Optional,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { HubCode, LineCode, type LiveSnapshot, ServiceType } from '@stt/contracts';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  GetLiveSnapshot,
  type LiveSnapshotQuery,
  UnknownLiveFilterError,
} from '../../application/live/get-live-snapshot.use-case.js';
import { LiveStream } from '../../application/live/live-stream.js';

/** `heartbeat` events keep idle connections open through proxies and let clients time the stream. */
export const LIVE_STREAM_HEARTBEAT_MS = Symbol('LIVE_STREAM_HEARTBEAT_MS');
const DEFAULT_HEARTBEAT_MS = 15_000;

const LiveQuery = z.strictObject({
  serviceType: ServiceType.optional(),
  hub: HubCode.optional(),
  line: LineCode.optional(),
});

function parseQuery(rawQuery: unknown): LiveSnapshotQuery {
  const parsed = LiveQuery.safeParse(rawQuery);
  if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
  const { serviceType, hub, line } = parsed.data;
  return {
    ...(serviceType !== undefined && { serviceType }),
    ...(hub !== undefined && { hubCode: hub }),
    ...(line !== undefined && { lineCode: line }),
  };
}

@Controller('live')
export class LiveController {
  constructor(
    @Inject(GetLiveSnapshot) private readonly getLiveSnapshot: GetLiveSnapshot,
    @Inject(LiveStream) private readonly liveStream: LiveStream,
    @Optional() @Inject(LIVE_STREAM_HEARTBEAT_MS) private readonly heartbeatMs?: number,
  ) {}

  @Get()
  async snapshot(@Query() rawQuery: unknown): Promise<LiveSnapshot> {
    return this.withKnownFilters(() => this.getLiveSnapshot.execute(parseQuery(rawQuery)));
  }

  /** Server-sent events: a `snapshot` event, then a `diff` event per ingest cycle that changed Runs,
   * and a `heartbeat` event every 15 s so a quiet stream is told from a dead one. */
  @Get('stream')
  async stream(
    @Query() rawQuery: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const query = parseQuery(rawQuery);
    let closed = false;
    let started = false;
    const write = (chunk: string) => {
      if (closed) return;
      if (!started) {
        // Headers go out with the first event, so an unknown filter can still answer 400.
        started = true;
        res.status(200).set({
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        res.flushHeaders();
      }
      res.write(chunk);
    };
    let unsubscribe = () => {};
    let heartbeat: NodeJS.Timeout | undefined;
    const release = () => {
      closed = true;
      clearInterval(heartbeat);
      unsubscribe();
    };
    req.on('close', release);
    res.on('error', release);

    unsubscribe = await this.withKnownFilters(() =>
      this.liveStream.subscribe(
        query,
        (event) => write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`),
        () => res.end(),
      ),
    );
    if (closed) return unsubscribe();
    heartbeat = setInterval(
      () => write('event: heartbeat\ndata: {}\n\n'),
      this.heartbeatMs ?? DEFAULT_HEARTBEAT_MS,
    );
  }

  private async withKnownFilters<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof UnknownLiveFilterError) throw new BadRequestException(error.message);
      throw error;
    }
  }
}
