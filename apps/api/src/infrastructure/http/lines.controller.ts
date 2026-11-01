import { BadRequestException, Controller, Get, Header, Inject, Query } from '@nestjs/common';
import { HubCode, type LineDto, ServiceType, type TrackFeatureCollection } from '@stt/contracts';
import { z } from 'zod';
import {
  GetLinesGeometry,
  type LinesQuery,
  ListLines,
  UnknownHubError,
} from '../../application/line/lines.js';

const LinesQueryParams = z.strictObject({
  serviceType: ServiceType.optional(),
  hub: HubCode.optional(),
});
const GeometryQueryParams = z.strictObject({ hub: HubCode.optional() });

function parse<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
  return parsed.data;
}

async function withKnownHub<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof UnknownHubError) throw new BadRequestException(error.message);
    throw error;
  }
}

@Controller('lines')
export class LinesController {
  constructor(
    @Inject(ListLines) private readonly listLines: ListLines,
    @Inject(GetLinesGeometry) private readonly getLinesGeometry: GetLinesGeometry,
  ) {}

  @Get()
  list(@Query() rawQuery: unknown): Promise<LineDto[]> {
    const { serviceType, hub } = parse(LinesQueryParams, rawQuery);
    const query: LinesQuery = {
      ...(serviceType !== undefined && { serviceType }),
      ...(hub !== undefined && { hubCode: hub }),
    };
    return withKnownHub(() => this.listLines.execute(query));
  }

  /** Track geometry changes only with a static import, so clients may cache it for a day. */
  @Get('geometry')
  @Header('Cache-Control', 'public, max-age=86400')
  geometry(@Query() rawQuery: unknown): Promise<TrackFeatureCollection> {
    const { hub } = parse(GeometryQueryParams, rawQuery);
    return withKnownHub(() =>
      this.getLinesGeometry.execute(hub !== undefined ? { hubCode: hub } : {}),
    );
  }
}
