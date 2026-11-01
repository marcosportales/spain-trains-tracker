import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  StationBoardReader,
  type StationPass,
} from '../../application/station/station-board.reader.js';
import type { ServiceType } from '../../domain/network/index.js';
import { DB } from './db.module.js';
import * as t from './schema/index.js';

interface PassRow extends Record<string, unknown> {
  train_number: string;
  line_code: string;
  service_type: string;
  arrival_seconds: number;
  departure_seconds: number;
  is_first: boolean;
  is_last: boolean;
  origin: string;
  destination: string;
  status: string | null;
  delay_seconds: number | null;
  estimated_arrival: Date | string | null;
  estimated_departure: Date | string | null;
}

@Injectable()
export class DrizzleStationBoardReader extends StationBoardReader {
  constructor(@Inject(DB) private readonly db: PostgresJsDatabase) {
    super();
  }

  async listPasses(
    stationCode: string,
    serviceDate: string,
    fromSeconds: number,
    toSeconds: number,
  ): Promise<StationPass[]> {
    const rows = await this.db.execute<PassRow>(sql`
      SELECT r.train_number, r.line_code, r.service_type,
        s.arrival_seconds, s.departure_seconds,
        s.seq = (SELECT min(m.seq) FROM ${t.scheduledStops} m WHERE m.trip_id = r.trip_id) AS is_first,
        s.seq = (SELECT max(m.seq) FROM ${t.scheduledStops} m WHERE m.trip_id = r.trip_id) AS is_last,
        (SELECT o.station_code FROM ${t.scheduledStops} o
          WHERE o.trip_id = r.trip_id ORDER BY o.seq ASC LIMIT 1) AS origin,
        (SELECT d.station_code FROM ${t.scheduledStops} d
          WHERE d.trip_id = r.trip_id ORDER BY d.seq DESC LIMIT 1) AS destination,
        run.status,
        delay.seconds AS delay_seconds,
        est.estimated_arrival,
        est.estimated_departure
      FROM ${t.scheduledStops} s
      JOIN ${t.scheduledRuns} r ON r.trip_id = s.trip_id
      JOIN ${t.serviceCalendars} c ON c.service_id = r.service_id
      LEFT JOIN ${t.serviceCalendarDates} e
        ON e.service_id = r.service_id AND e.date = ${serviceDate}::date
      LEFT JOIN ${t.runs} run
        ON run.train_number = r.train_number AND run.service_date = ${serviceDate}::date
      LEFT JOIN LATERAL (
        SELECT x.seconds FROM ${t.delays} x
        WHERE x.train_number = r.train_number AND x.service_date = ${serviceDate}::date
        ORDER BY x.observed_at DESC LIMIT 1
      ) delay ON true
      LEFT JOIN LATERAL (
        SELECT v.estimated_arrival, v.estimated_departure FROM ${t.runStopEstimates} v
        WHERE v.train_number = r.train_number AND v.service_date = ${serviceDate}::date
          AND v.station_code = s.station_code
        ORDER BY v.sequence ASC LIMIT 1
      ) est ON true
      WHERE s.station_code = ${stationCode}
        AND s.departure_seconds >= ${fromSeconds}
        AND s.arrival_seconds <= ${toSeconds}
        AND CASE
          WHEN e.added IS NOT NULL THEN e.added
          ELSE ${serviceDate}::date BETWEEN c.start_date AND c.end_date
            AND CASE extract(isodow FROM ${serviceDate}::date)::int
              WHEN 1 THEN c.monday WHEN 2 THEN c.tuesday WHEN 3 THEN c.wednesday
              WHEN 4 THEN c.thursday WHEN 5 THEN c.friday WHEN 6 THEN c.saturday
              ELSE c.sunday END
        END
      ORDER BY s.departure_seconds, r.train_number`);

    return rows.map((row) => ({
      trainNumber: row.train_number,
      serviceDate,
      serviceType: row.service_type as ServiceType,
      lineCode: row.line_code,
      arrivalSeconds: row.arrival_seconds,
      departureSeconds: row.departure_seconds,
      isFirstStop: row.is_first,
      isLastStop: row.is_last,
      originStationCode: row.origin,
      destinationStationCode: row.destination,
      ...(row.status !== null && { serviceStatus: row.status as 'scheduled' | 'cancelled' }),
      ...(row.delay_seconds !== null && { delaySeconds: row.delay_seconds }),
      ...(row.estimated_arrival !== null && { estimatedArrival: new Date(row.estimated_arrival) }),
      ...(row.estimated_departure !== null && {
        estimatedDeparture: new Date(row.estimated_departure),
      }),
    }));
  }
}
