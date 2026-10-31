import { z } from 'zod';
import { DEFAULT_DATABASE_URL } from '../db/default-database-url.js';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().min(1).optional(),
    WORKER_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(20_000),
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.DATABASE_URL, {
    path: ['DATABASE_URL'],
    message: 'required in production',
  })
  .transform((env) => ({ ...env, DATABASE_URL: env.DATABASE_URL ?? DEFAULT_DATABASE_URL }));

export type Env = z.output<typeof envSchema>;

export function parseEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return result.data;
}
