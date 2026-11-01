import { BadRequestException, Controller, Get, Inject, Query } from '@nestjs/common';
import { HubCode, LineCode, type LiveSnapshot, ServiceType } from '@stt/contracts';
import { z } from 'zod';
import {
  GetLiveSnapshot,
  UnknownLiveFilterError,
} from '../../application/live/get-live-snapshot.use-case.js';

const LiveQuery = z.strictObject({
  serviceType: ServiceType.optional(),
  hub: HubCode.optional(),
  line: LineCode.optional(),
});

@Controller('live')
export class LiveController {
  constructor(@Inject(GetLiveSnapshot) private readonly getLiveSnapshot: GetLiveSnapshot) {}

  @Get()
  async snapshot(@Query() rawQuery: unknown): Promise<LiveSnapshot> {
    const parsed = LiveQuery.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
    const { serviceType, hub, line } = parsed.data;
    try {
      return await this.getLiveSnapshot.execute({
        ...(serviceType !== undefined && { serviceType }),
        ...(hub !== undefined && { hubCode: hub }),
        ...(line !== undefined && { lineCode: line }),
      });
    } catch (error) {
      if (error instanceof UnknownLiveFilterError) throw new BadRequestException(error.message);
      throw error;
    }
  }
}
