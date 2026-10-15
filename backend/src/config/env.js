import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '..', '..', '..', '.env');
const backendEnvPath = path.resolve(__dirname, '..', '..', '.env');

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
  FIREBASE_API_KEY: Boolean(process.env.FIREBASE_API_KEY),
  FIREBASE_AUTH_DOMAIN: Boolean(process.env.FIREBASE_AUTH_DOMAIN),
  FIREBASE_PROJECT_ID: Boolean(process.env.FIREBASE_PROJECT_ID),
  FIREBASE_STORAGE_BUCKET: Boolean(process.env.FIREBASE_STORAGE_BUCKET),
  FIREBASE_MESSAGING_SENDER_ID: Boolean(process.env.FIREBASE_MESSAGING_SENDER_ID),
  FIREBASE_APP_ID: Boolean(process.env.FIREBASE_APP_ID)
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
  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional().or(z.literal('')),
  SUPABASE_SECRET_KEY: z.string().optional().or(z.literal('')),
  DATABASE_URL: z.string().optional(),
  FIREBASE_API_KEY: z.string().optional(),
  FIREBASE_AUTH_DOMAIN: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
  FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  FIREBASE_APP_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional()
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
  supabase: {
    url: _env.data.SUPABASE_URL || '',
    anonKey: _env.data.SUPABASE_PUBLISHABLE_KEY || '',
    serviceRoleKey: _env.data.SUPABASE_SECRET_KEY || '',
    dbUrl: _env.data.DATABASE_URL || ''
  },
  firebase: {
    apiKey: _env.data.FIREBASE_API_KEY,
    authDomain: _env.data.FIREBASE_AUTH_DOMAIN,
    projectId: _env.data.FIREBASE_PROJECT_ID,
    storageBucket: _env.data.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: _env.data.FIREBASE_MESSAGING_SENDER_ID,
    appId: _env.data.FIREBASE_APP_ID,
    clientEmail: _env.data.FIREBASE_CLIENT_EMAIL,
    privateKey: _env.data.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  }
};
