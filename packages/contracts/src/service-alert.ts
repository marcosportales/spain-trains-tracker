import { z } from 'zod';
import { LineCode, Timestamp } from './run-id.js';

/** An official Renfe notice affecting one or more Lines (Spanish text only). */
export const ServiceAlertDto = z.object({
  id: z.string().min(1),
  lineCodes: z.array(LineCode).min(1),
  header: z.string().min(1),
  description: z.string().optional(),
  activeFrom: Timestamp.optional(),
  activeUntil: Timestamp.optional(),
});
export type ServiceAlertDto = z.infer<typeof ServiceAlertDto>;
