/** Typed rows for each GTFS static file Renfe publishes. Field names stay raw GTFS. */

export type AgencyRow = {
  agency_id: string | undefined;
  agency_name: string;
  agency_url: string;
  agency_timezone: string;
  agency_lang: string | undefined;
  agency_phone: string | undefined;
};

export type RouteRow = {
  route_id: string;
  agency_id: string | undefined;
  route_short_name: string;
  route_long_name: string;
  route_desc: string | undefined;
  route_type: number;
  route_url: string | undefined;
  route_color: string | undefined;
  route_text_color: string | undefined;
};

export type StopRow = {
  stop_id: string;
  stop_code: string | undefined;
  stop_name: string;
  stop_desc: string | undefined;
  stop_lat: number;
  stop_lon: number;
  zone_id: string | undefined;
  stop_url: string | undefined;
  location_type: number | undefined;
  parent_station: string | undefined;
  stop_timezone: string | undefined;
  wheelchair_boarding: number | undefined;
};

export type TripRow = {
  route_id: string;
  service_id: string;
  trip_id: string;
  trip_headsign: string | undefined;
  trip_short_name: string | undefined;
  direction_id: number | undefined;
  block_id: string | undefined;
  shape_id: string | undefined;
  wheelchair_accessible: number | undefined;
};

export type StopTimeRow = {
  trip_id: string;
  /** `H:MM:SS` or `HH:MM:SS`; may exceed 24h for Runs past midnight. */
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: number;
  stop_headsign: string | undefined;
  pickup_type: number | undefined;
  drop_off_type: number | undefined;
  shape_dist_traveled: number | undefined;
};

export type CalendarRow = {
  service_id: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  /** `YYYYMMDD` */
  start_date: string;
  end_date: string;
};

export type CalendarDateRow = {
  service_id: string;
  /** `YYYYMMDD` */
  date: string;
  /** 1 = service added, 2 = service removed. */
  exception_type: number;
};

export type ShapeRow = {
  shape_id: string;
  shape_pt_lat: number;
  shape_pt_lon: number;
  shape_pt_sequence: number;
  shape_dist_traveled: number | undefined;
};

export type GtfsRows = {
  agency: AgencyRow;
  routes: RouteRow;
  stops: StopRow;
  trips: TripRow;
  stop_times: StopTimeRow;
  calendar: CalendarRow;
  calendar_dates: CalendarDateRow;
  shapes: ShapeRow;
};

export type GtfsFileName = keyof GtfsRows;
