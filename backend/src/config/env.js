import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '..', '..', '..', '.env');
const backendEnvPath = path.resolve(__dirname, '..', '..', '.env');

function isHttpOrigin(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) &&
      url.origin === value &&
      !url.username &&
      !url.password;
  } catch {
    return false;
  }
}

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
} else {
  dotenv.config();
}

// Development-only diagnostic: report names only, never environment values.
const requiredEnvironmentVariables = {
  SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
  SUPABASE_PUBLISHABLE_KEY: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY),
  SUPABASE_SECRET_KEY: Boolean(process.env.SUPABASE_SECRET_KEY),
};
const missingEnvironmentVariables = Object.entries(requiredEnvironmentVariables)
  .filter(([, isDefined]) => !isDefined)
  .map(([name]) => name);
if ((!process.env.NODE_ENV || process.env.NODE_ENV === 'development') && missingEnvironmentVariables.length) {
  console.warn(`[config] Missing environment variables: ${missingEnvironmentVariables.join(', ')}`);
}

const envSchema = z.object({
  PORT: z.string().regex(/^\d+$/).refine(value => Number(value) > 0 && Number(value) <= 65535, 'PORT must be between 1 and 65535').default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol), 'CLIENT_URL must use HTTP or HTTPS').default('http://localhost:3000'),
  ALLOWED_ORIGINS: z.string().optional().default('').refine(
    value => value.split(',').every(origin => !origin.trim() || isHttpOrigin(origin.trim())),
    'ALLOWED_ORIGINS must be a comma-separated list of HTTP or HTTPS origins without paths'
  ),
  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional().or(z.literal('')),
  SUPABASE_SECRET_KEY: z.string().optional().or(z.literal('')),
  DATABASE_URL: z.string().optional(),
}).refine(
  (data) => data.NODE_ENV !== 'production' || (data.SUPABASE_URL && data.SUPABASE_PUBLISHABLE_KEY && data.SUPABASE_SECRET_KEY),
  { message: 'SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY are required in production' }
);

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = {
  port: parseInt(_env.data.PORT, 10),
  nodeEnv: _env.data.NODE_ENV,
  clientUrl: _env.data.CLIENT_URL,
  allowedOrigins: [...new Set([
    new URL(_env.data.CLIENT_URL).origin,
    ..._env.data.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
  ])],
  supabase: {
    url: _env.data.SUPABASE_URL || '',
    anonKey: _env.data.SUPABASE_PUBLISHABLE_KEY || '',
    serviceRoleKey: _env.data.SUPABASE_SECRET_KEY || '',
    dbUrl: _env.data.DATABASE_URL || ''
  }
};
