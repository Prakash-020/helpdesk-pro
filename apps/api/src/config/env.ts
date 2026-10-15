import 'dotenv/config';
import { z } from 'zod';

/**
 * Fail-fast environment validation. The process refuses to start with an
 * incomplete or malformed environment rather than failing mysteriously later.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(10),
  SLA_SWEEP_MINUTES: z.coerce.number().int().positive().default(15),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const [key, issues] of Object.entries(parsed.error.flatten().fieldErrors)) {
    console.error(`  ${key}: ${issues?.join(', ')}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** Comma-separated CORS allowlist. */
export const webOrigins = env.WEB_ORIGIN.split(',').map((o) => o.trim());
