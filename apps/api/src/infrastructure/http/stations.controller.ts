import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { type StationBoard, StationCode, type StationSummary } from '@stt/contracts';
import { z } from 'zod';
import {
  GetStationBoard,
  StationNotFoundError,
} from '../../application/station/get-station-board.use-case.js';
import { ListStations } from '../../application/station/list-stations.use-case.js';

const StationParams = z.strictObject({ code: StationCode });
const BoardQuery = z.strictObject({
  type: z.enum(['departures', 'arrivals']).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
});

@Controller('stations')
export class StationsController {
  constructor(
    @Inject(GetStationBoard) private readonly getStationBoard: GetStationBoard,
    @Inject(ListStations) private readonly listStations: ListStations,
  ) {}

  @Get()
  list(): Promise<StationSummary[]> {
    return this.listStations.execute();
  }

  @Get(':code/board')
  async board(@Param() rawParams: unknown, @Query() rawQuery: unknown): Promise<StationBoard> {
    const params = StationParams.safeParse(rawParams);
    const query = BoardQuery.safeParse(rawQuery);
    if (!params.success) throw new BadRequestException(z.prettifyError(params.error));
    if (!query.success) throw new BadRequestException(z.prettifyError(query.error));
    try {
      return await this.getStationBoard.execute({
        stationCode: params.data.code,
        ...(query.data.type !== undefined && { type: query.data.type }),
        ...(query.data.from !== undefined && { from: new Date(query.data.from) }),
      });
    } catch (error) {
      if (error instanceof StationNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
