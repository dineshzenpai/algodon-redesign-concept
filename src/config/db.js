import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

let supabaseAdmin = null;

export const connectDB = async () => {
  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    console.warn('[db] Supabase credentials not set in environment. Running in offline/fallback mode.');
    return;
  }
  try {
    // We use the service role key for backend operations so we have admin access
    supabaseAdmin = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log('[db] Successfully connected to Supabase');
  } catch (error) {
    console.error('[db] Connection failed:', error.message);
    if (env.nodeEnv === 'production') throw error;
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
