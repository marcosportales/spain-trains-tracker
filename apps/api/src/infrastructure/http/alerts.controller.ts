import { BadRequestException, Controller, Get, Inject, Query } from '@nestjs/common';
import { LineCode, type ServiceAlertDto } from '@stt/contracts';
import { z } from 'zod';
import {
  ListServiceAlerts,
  type ServiceAlertsQuery,
} from '../../application/alert/list-service-alerts.use-case.js';

const AlertsQuery = z.strictObject({
  active: z.enum(['true', 'false']).optional(),
  line: LineCode.optional(),
});

@Controller('alerts')
export class AlertsController {
  constructor(@Inject(ListServiceAlerts) private readonly listServiceAlerts: ListServiceAlerts) {}

  @Get()
  list(@Query() rawQuery: unknown): Promise<ServiceAlertDto[]> {
    const parsed = AlertsQuery.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
    const { active, line } = parsed.data;
    const query: ServiceAlertsQuery = {
      ...(active !== undefined && { active: active === 'true' }),
      ...(line !== undefined && { lineCode: line }),
    };
    return this.listServiceAlerts.execute(query);
  }
}
