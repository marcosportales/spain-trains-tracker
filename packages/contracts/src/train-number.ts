import { z } from 'zod';

/** The commercial number of a Run: 1-6 digits, kept as a string to preserve leading zeros. */
export const TrainNumber = z.string().regex(/^\d{1,6}$/, 'expected 1-6 digits');
export type TrainNumber = z.infer<typeof TrainNumber>;
