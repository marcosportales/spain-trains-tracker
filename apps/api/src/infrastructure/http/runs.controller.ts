import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { type RunDetail, ServiceDate, TrainNumber } from '@stt/contracts';
import { z } from 'zod';
import { GetRunDetail, RunNotFoundError } from '../../application/run/get-run-detail.use-case.js';

const RunParams = z.strictObject({ serviceDate: ServiceDate, trainNumber: TrainNumber });

@Controller('runs')
export class RunsController {
  constructor(@Inject(GetRunDetail) private readonly getRunDetail: GetRunDetail) {}

  @Get(':serviceDate/:trainNumber')
  async detail(@Param() rawParams: unknown): Promise<RunDetail> {
    const parsed = RunParams.safeParse(rawParams);
    if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
    try {
      return await this.getRunDetail.execute(parsed.data.trainNumber, parsed.data.serviceDate);
    } catch (error) {
      if (error instanceof RunNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
