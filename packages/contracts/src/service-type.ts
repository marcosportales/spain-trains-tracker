import { z } from 'zod';

/** The commercial family a Run belongs to. */
export const ServiceType = z.enum([
  'cercanias',
  'ave',
  'larga_distancia',
  'media_distancia',
  'ancho_metrico',
]);
export type ServiceType = z.infer<typeof ServiceType>;
