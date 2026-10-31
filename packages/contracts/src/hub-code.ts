import { z } from 'zod';

/** Identifies a Hub (Cercanías network) as a lowercase kebab-case slug, e.g. `rodalies-de-catalunya`. */
export const HubCode = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'expected a kebab-case slug');
export type HubCode = z.infer<typeof HubCode>;
