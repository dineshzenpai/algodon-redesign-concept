import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

let supabaseAdmin = null;

export const connectDB = async () => {
  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    console.warn('[db] Supabase credentials not set in environment. Running in offline/fallback mode.');
    return;
  }
  try {
    // Keep the client unavailable until an actual database request succeeds.
    const client = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    const { error } = await client.from('products').select('id').limit(1);
    if (error) throw error;
    supabaseAdmin = client;
    console.log('[db] Successfully connected to Supabase');
  } catch (error) {
    supabaseAdmin = null;
    console.error('[db] Connection failed:', error.message);
    if (env.nodeEnv === 'production') throw error;
  }
};

export const checkDatabase = async () => {
  try {
    const { error } = await getDb().from('products').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
};

export const getDb = () => {
  if (!supabaseAdmin) {
    if (env.supabase.url && env.supabase.serviceRoleKey) {
      supabaseAdmin = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      return supabaseAdmin;
    }
    throw new Error('Supabase client not initialized (SUPABASE_URL and SUPABASE_SECRET_KEY missing in .env)');
  }
  return supabaseAdmin;
};

export const setDb = (client) => {
  supabaseAdmin = client;
};
