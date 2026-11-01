import { BadRequestException, Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { type TrainHistory, TrainNumber } from '@stt/contracts';
import { z } from 'zod';
import { GetTrainHistory } from '../../application/train-history/get-train-history.use-case.js';
import { InvalidMovementValueError } from '../../domain/movement/index.js';

const Params = z.strictObject({ trainNumber: TrainNumber });
const HistoryQuery = z.strictObject({ days: z.coerce.number().int().min(1).max(90).optional() });

function parse<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
  return parsed.data;
}

/** Delay history per Train number (Epic E6): "this train is usually X min late". */
@Controller('trains')
export class TrainHistoryController {
  constructor(@Inject(GetTrainHistory) private readonly history: GetTrainHistory) {}

  @Get(':trainNumber/history')
  trainHistory(@Param() rawParams: unknown, @Query() rawQuery: unknown): Promise<TrainHistory> {
    const { trainNumber } = parse(Params, rawParams);
    const { days } = parse(HistoryQuery, rawQuery);
    return this.history
      .execute(trainNumber, days !== undefined ? { days } : {})
      .catch((error: unknown) => {
        // The contract allows 6 digits and all zeros; Train numbers are 1 to 5 digits.
        if (error instanceof InvalidMovementValueError)
          throw new BadRequestException(error.message);
        throw error;
      });
  }
}
