import type { ServiceType } from './service-type.js';

/** Which weekdays and dates a `service_id` runs on, as in GTFS `calendar.txt`. Dates are `YYYY-MM-DD`. */
export interface ServiceCalendar {
  readonly serviceId: string;
  /** Monday first: index 0 is Monday, 6 is Sunday. */
  readonly weekdays: readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
  readonly startDate: string;
  readonly endDate: string;
  /** Dates that deviate from the weekly pattern, as in GTFS `calendar_dates.txt`. */
  readonly exceptions: readonly { readonly date: string; readonly added: boolean }[];
}

/** A scheduled Run template: a Train number on the days its service calendar says. */
export interface ScheduledRun {
  /** The feed's trip id. Only a key for the timetable; a Run is identified by Train number + Service date. */
  readonly tripId: string;
  readonly trainNumber: string;
  readonly lineCode: string;
  readonly serviceType: ServiceType;
  readonly serviceId: string;
  readonly shapeId?: string;
}

/** One Station stop of a scheduled Run. Times are seconds since the start of the Service date (may exceed 24h). */
export interface ScheduledStop {
  readonly tripId: string;
  readonly sequence: number;
  readonly stationCode: string;
  readonly arrivalSeconds: number;
  readonly departureSeconds: number;
}

/** The drawn path of a Line, as `[lon, lat]` vertices. */
export interface TrackGeometry {
  readonly shapeId: string;
  readonly lineCode?: string;
  readonly path: readonly (readonly [number, number])[];
}

/** One import of a static dataset. */
export interface StaticImport {
  readonly source: string;
  readonly etag?: string;
  readonly importedAt: Date;
}
