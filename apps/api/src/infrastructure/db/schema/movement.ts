import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/** One row per Run (Train number + Service date, ADR 0004). */
export const runs = pgTable(
  'runs',
  {
    trainNumber: text('train_number').notNull(),
    serviceDate: date('service_date', { mode: 'string' }).notNull(),
    serviceType: text('service_type').notNull(),
    lineCode: text('line_code'),
    originStationCode: text('origin_station_code'),
    destinationStationCode: text('destination_station_code'),
    status: text('status'),
    wheelchairAccessible: boolean('wheelchair_accessible'),
    rollingStock: text('rolling_stock'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.trainNumber, t.serviceDate] }),
    index('runs_last_seen_at_idx').on(t.lastSeenAt),
  ],
);

/**
 * Hypertable on `observed_at` (1-day chunks, compressed after 7 days, segmented by train_number).
 * The hypertable parts live in the migration: Drizzle cannot express them.
 */
export const sightings = pgTable(
  'sightings',
  {
    trainNumber: text('train_number').notNull(),
    serviceDate: date('service_date', { mode: 'string' }).notNull(),
    source: text('source').notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    lat: doublePrecision('lat'),
    lon: doublePrecision('lon'),
    status: text('status').notNull(),
    stationCode: text('station_code'),
    platform: text('platform'),
    positionIsSnapped: boolean('position_is_snapped').notNull(),
  },
  (t) => [
    // Dedupe key. A hypertable unique index must include the partition column (observed_at).
    uniqueIndex('sightings_run_source_observed_at_uq').on(
      t.trainNumber,
      t.serviceDate,
      t.source,
      t.observedAt,
    ),
  ],
);

/** Hypertable like `sightings`. */
export const delays = pgTable(
  'delays',
  {
    trainNumber: text('train_number').notNull(),
    serviceDate: date('service_date', { mode: 'string' }).notNull(),
    source: text('source').notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    seconds: integer('seconds').notNull(),
    atStationCode: text('at_station_code'),
  },
  (t) => [
    uniqueIndex('delays_run_source_observed_at_uq').on(
      t.trainNumber,
      t.serviceDate,
      t.source,
      t.observedAt,
    ),
  ],
);

/**
 * When a Run is expected at each Station of its journey (timetable plus Delay). Only the latest
 * estimates are kept: every update replaces the Run's rows. Not a hypertable.
 */
export const runStopEstimates = pgTable(
  'run_stop_estimates',
  {
    trainNumber: text('train_number').notNull(),
    serviceDate: date('service_date', { mode: 'string' }).notNull(),
    sequence: integer('sequence').notNull(),
    stationCode: text('station_code').notNull(),
    scheduledArrival: timestamp('scheduled_arrival', { withTimezone: true }).notNull(),
    scheduledDeparture: timestamp('scheduled_departure', { withTimezone: true }).notNull(),
    estimatedArrival: timestamp('estimated_arrival', { withTimezone: true }).notNull(),
    estimatedDeparture: timestamp('estimated_departure', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.trainNumber, t.serviceDate, t.sequence] })],
);

export const serviceAlerts = pgTable(
  'service_alerts',
  {
    id: text('id').primaryKey(),
    header: text('header').notNull(),
    description: text('description').notNull(),
    url: text('url'),
    /** `[{ start?: ISO string, end?: ISO string }]` */
    activePeriods: jsonb('active_periods').notNull(),
    lineCodes: text('line_codes').array().notNull(),
    stationCodes: text('station_codes').array().notNull(),
    source: text('source').notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [index('service_alerts_ended_at_idx').on(t.endedAt)],
);

/** Latest health of each polled feed: written by the worker, read by the API's `/health`. */
export const feedHealth = pgTable('feed_health', {
  feed: text('feed').primaryKey(),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastError: text('last_error'),
  consecutiveFailures: integer('consecutive_failures').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});
