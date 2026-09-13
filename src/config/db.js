import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

let supabaseAdmin = null;

export const connectDB = async () => {
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
    throw error;
  }
};

export const getDb = () => {
  if (!supabaseAdmin) throw new Error('Supabase client not initialized');
  return supabaseAdmin;
};
