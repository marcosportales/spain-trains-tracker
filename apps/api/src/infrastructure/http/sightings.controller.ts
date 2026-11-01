import { BadRequestException, Controller, Get, Inject, Query } from '@nestjs/common';
import { type SightingWindow, TrainNumber } from '@stt/contracts';
import { z } from 'zod';
import {
  GetSightingWindow,
  InvalidSightingWindowError,
} from '../../application/sighting-window/get-sighting-window.use-case.js';
import { InvalidMovementValueError } from '../../domain/movement/index.js';

const WindowQuery = z.strictObject({
  from: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
  to: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
  stepSeconds: z.coerce.number().int().min(10).max(3600).optional(),
  trainNumber: TrainNumber.optional(),
});

/** Historical replay (Epic E7): downsampled Sightings of a time window. */
@Controller('sightings')
export class SightingsController {
  constructor(@Inject(GetSightingWindow) private readonly window: GetSightingWindow) {}

  @Get()
  sightings(@Query() rawQuery: unknown): Promise<SightingWindow> {
    const parsed = WindowQuery.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
    const { from, to, stepSeconds, trainNumber } = parsed.data;
    return this.window
      .execute({
        from,
        to,
        ...(stepSeconds !== undefined ? { stepSeconds } : {}),
        ...(trainNumber !== undefined ? { trainNumber } : {}),
      })
      .catch((error: unknown) => {
        if (
          error instanceof InvalidSightingWindowError ||
          error instanceof InvalidMovementValueError
        )
          throw new BadRequestException(error.message);
        throw error;
      });
  }
}
