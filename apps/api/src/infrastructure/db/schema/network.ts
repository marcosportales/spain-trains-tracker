import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

/** PostGIS `geography(<kind>, 4326)`. Values travel as EWKT strings (`SRID=4326;POINT(lon lat)`). */
const geography = (kind: 'Point' | 'LineString') =>
  customType<{ data: string; driverData: string }>({
    dataType: () => `geography(${kind}, 4326)`,
  });

export const hubs = pgTable('hubs', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
});

export const stations = pgTable(
  'stations',
  {
    code: text('code').primaryKey(),
    name: text('name').notNull(),
    location: geography('Point')('location').notNull(),
    hubCode: text('hub_code').references(() => hubs.code),
    serviceTypes: text('service_types').array().notNull(),
    wheelchairBoarding: boolean('wheelchair_boarding'),
  },
  (t) => [index('stations_location_gist').using('gist', t.location)],
);

export const lines = pgTable('lines', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  serviceType: text('service_type').notNull(),
  hubCode: text('hub_code').references(() => hubs.code),
  color: text('color'),
});

export const serviceCalendars = pgTable('service_calendars', {
  serviceId: text('service_id').primaryKey(),
  monday: boolean('monday').notNull(),
  tuesday: boolean('tuesday').notNull(),
  wednesday: boolean('wednesday').notNull(),
  thursday: boolean('thursday').notNull(),
  friday: boolean('friday').notNull(),
  saturday: boolean('saturday').notNull(),
  sunday: boolean('sunday').notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }).notNull(),
});

export const serviceCalendarDates = pgTable(
  'service_calendar_dates',
  {
    serviceId: text('service_id')
      .notNull()
      .references(() => serviceCalendars.serviceId, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    added: boolean('added').notNull(),
  },
  (t) => [primaryKey({ columns: [t.serviceId, t.date] })],
);

export const trackGeometries = pgTable(
  'track_geometries',
  {
    shapeId: text('shape_id').primaryKey(),
    lineCode: text('line_code').references(() => lines.code),
    geometry: geography('LineString')('geometry').notNull(),
  },
  (t) => [index('track_geometries_geometry_gist').using('gist', t.geometry)],
);

export const scheduledRuns = pgTable(
  'scheduled_runs',
  {
    tripId: text('trip_id').primaryKey(),
    trainNumber: text('train_number').notNull(),
    lineCode: text('line_code')
      .notNull()
      .references(() => lines.code),
    serviceType: text('service_type').notNull(),
    serviceId: text('service_id')
      .notNull()
      .references(() => serviceCalendars.serviceId),
    shapeId: text('shape_id').references(() => trackGeometries.shapeId),
  },
  (t) => [index('scheduled_runs_train_number_idx').on(t.trainNumber)],
);

export const scheduledStops = pgTable(
  'scheduled_stops',
  {
    tripId: text('trip_id')
      .notNull()
      .references(() => scheduledRuns.tripId, { onDelete: 'cascade' }),
    sequence: integer('seq').notNull(),
    stationCode: text('station_code')
      .notNull()
      .references(() => stations.code),
    arrivalSeconds: integer('arrival_seconds').notNull(),
    departureSeconds: integer('departure_seconds').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tripId, t.sequence] }),
    index('scheduled_stops_station_idx').on(t.stationCode),
  ],
);

export const staticImports = pgTable('static_imports', {
  id: serial('id').primaryKey(),
  source: text('source').notNull(),
  etag: text('etag'),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().default(sql`now()`),
});
