/** The commercial family a Run belongs to. Mirrors `ServiceType` in `@spain-trains/contracts`. */
export const SERVICE_TYPES = [
  'cercanias',
  'ave',
  'larga_distancia',
  'media_distancia',
  'ancho_metrico',
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export function isServiceType(value: unknown): value is ServiceType {
  return typeof value === 'string' && (SERVICE_TYPES as readonly string[]).includes(value);
}
