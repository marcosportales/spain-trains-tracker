import { BadRequestException, Controller, Get, Inject, Query } from '@nestjs/common';
import { type DelayByHour, LineCode, type PunctualityRanking } from '@stt/contracts';
import { z } from 'zod';
import {
  GetDelayByHour,
  GetPunctualityRanking,
} from '../../application/punctuality/get-punctuality.use-case.js';

const Days = z.coerce.number().int().min(1).max(90).optional();
const RankingQuery = z.strictObject({ days: Days });
const DelayByHourQuery = z.strictObject({ days: Days, line: LineCode.optional() });

function parse<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
  return parsed.data;
}

/** Punctuality statistics (Epic E6): Delay per Line and per hour of day. */
@Controller('stats')
export class PunctualityController {
  constructor(
    @Inject(GetPunctualityRanking) private readonly ranking: GetPunctualityRanking,
    @Inject(GetDelayByHour) private readonly delayByHour: GetDelayByHour,
  ) {}

  @Get('punctuality')
  punctuality(@Query() rawQuery: unknown): Promise<PunctualityRanking> {
    const { days } = parse(RankingQuery, rawQuery);
    return this.ranking.execute(days !== undefined ? { days } : {});
  }

  @Get('delay-by-hour')
  byHour(@Query() rawQuery: unknown): Promise<DelayByHour> {
    const { days, line } = parse(DelayByHourQuery, rawQuery);
    return this.delayByHour.execute({
      ...(days !== undefined && { days }),
      ...(line !== undefined && { lineCode: line }),
    });
  }
}
