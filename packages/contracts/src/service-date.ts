import { z } from 'zod';

/** The operating day of a Run, as a valid calendar date formatted `YYYY-MM-DD`. */
export const ServiceDate = z.iso.date();
export type ServiceDate = z.infer<typeof ServiceDate>;
