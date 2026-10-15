import { createClient } from '@supabase/supabase-js';
import { env } from '../backend/src/config/env.js';

const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
if (!email || !password || password.length < 12) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in .env.');
  process.exit(1);
}

const supabase = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw new Error(`Could not look up the admin account: ${listError.message}`);
let user = listed.users.find((entry) => entry.email && entry.email.toLowerCase() === email);
if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`Could not create the admin account: ${error.message}`);
  user = data.user;
}

const { data: existing, error: roleError } = await supabase.from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
if (roleError) throw new Error(`Could not read admin roles: ${roleError.message}`);
if (existing && existing.role !== 'super_admin') {
  throw new Error(`This account already has the ${existing.role} role. Promote it through the Super Admin panel first.`);
}
if (!existing) {
  const { error } = await supabase.from('admin_users').insert({ user_id: user.id, role: 'super_admin' });
  if (error) throw new Error(`Could not grant Super Admin access: ${error.message}`);
}
console.log(`Super Admin ready for ${email}. Remove ADMIN_PASSWORD from your environment after seeding.`);
