import { z } from 'zod';
import { HubCode } from './hub-code.js';
import { LineCode } from './run-id.js';
import { ServiceType } from './service-type.js';

const Position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const LineStringGeometry = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(Position).min(2),
});
const MultiLineStringGeometry = z.object({
  type: z.literal('MultiLineString'),
  coordinates: z.array(z.array(Position).min(2)).min(1),
});

/** One piece of Track geometry for a Line. */
export const TrackFeature = z.object({
  type: z.literal('Feature'),
  geometry: z.union([LineStringGeometry, MultiLineStringGeometry]),
  properties: z.record(z.string(), z.unknown()),
});
export type TrackFeature = z.infer<typeof TrackFeature>;

export const TrackFeatureCollection = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(TrackFeature),
});
export type TrackFeatureCollection = z.infer<typeof TrackFeatureCollection>;

/** A Line with its Track geometry. */
export const LineDto = z.object({
  lineCode: LineCode,
  name: z.string().min(1),
  serviceType: ServiceType,
  hubCode: HubCode.optional(),
  track: TrackFeatureCollection,
});
export type LineDto = z.infer<typeof LineDto>;
