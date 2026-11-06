import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { getDb } from '../config/db.js';

const COOKIE = 'algodon_admin_session';
const cookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
  path: '/api/admin'
};
function digest(value) {
  return createHash('sha256').update(`${env.supabase.serviceRoleKey}:${value}`).digest('hex');
}
function sessionHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

export async function ensureInitialAdmin() {
  let db;
  try {
    db = getDb();
  } catch {
    return;
  }
  if (!db || !env.supabase.serviceRoleKey) return;
  try {
    const { count, error } = await db.from('admin_users').select('user_id', { count: 'exact', head: true });
    if (error) {
      console.warn('[admin] Could not check admin_users table:', error.message);
      return;
    }
    if (count === 0) {
      const email = (process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
      const password = process.env.ADMIN_PASSWORD || 'AdminPassword123!';
      console.log(`[admin] Bootstrapping initial Super Admin account (${email})...`);

      const { data: listed } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      let user = listed?.users?.find(u => u.email?.toLowerCase() === email);
      if (!user) {
        const { data: created, error: createError } = await db.auth.admin.createUser({
          email,
          password,
          email_confirm: true
        });
        if (createError) {
          console.error('[admin] Failed to create initial admin user:', createError.message);
          return;
        }
        user = created?.user;
      } else {
        await db.auth.admin.updateUserById(user.id, { password, email_confirm: true });
      }

      if (user?.id) {
        const { error: insertError } = await db.from('admin_users').upsert({
          user_id: user.id,
          role: 'super_admin'
        }, { onConflict: 'user_id' });
        if (insertError) {
          console.error('[admin] Failed to grant super_admin role:', insertError.message);
        } else {
          console.log(`[admin] Successfully configured initial Super Admin (${email})`);
        }
      }
    }
  } catch (err) {
    console.error('[admin] Admin bootstrap failed:', err.message);
  }
}

export async function loginAdmin(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password || email.length > 320 || password.length > 1024) {
    return res.status(400).json({ error: 'Enter a valid email and password.' });
  }

  const emailHash = digest(email);
  const ipHash = digest(req.ip || req.socket.remoteAddress || 'unknown');
  const db = getDb();
  const { data: locked, error: lockError } = await db.rpc('admin_login_is_locked', {
    p_email_hash: emailHash, p_ip_hash: ipHash
  });
  if (lockError) {
    console.error('[admin] Login lockout check failed:', lockError.message);
    return res.status(503).json({ error: 'Admin sign-in is temporarily unavailable.' });
  }
  if (locked) return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });

  const authClient = createClient(env.supabase.url, env.supabase.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
  let { data: signedIn, error: authError } = await authClient.auth.signInWithPassword({ email, password });
  let user = signedIn && signedIn.user;

  // If login failed, check if admin_users is unseeded and matches the default admin
  if (authError || !user) {
    const defaultEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
    const defaultPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';
    if (email === defaultEmail && password === defaultPassword) {
      await ensureInitialAdmin();
      const retry = await authClient.auth.signInWithPassword({ email, password });
      if (retry.data?.user && retry.data?.session?.access_token) {
        signedIn = retry.data;
        user = retry.data.user;
        authError = null;
      }
    }
  }

  if (authError || !user || !signedIn?.session?.access_token) {
    await db.rpc('admin_record_login_failure', { p_email_hash: emailHash, p_ip_hash: ipHash });
    const msg = authError?.message?.toLowerCase().includes('confirm')
      ? 'Your email address has not been confirmed yet. Please verify your email.'
      : 'Email or password is incorrect.';
    return res.status(401).json({ error: msg });
  }

  const { data: admin, error: roleError } = await db.from('admin_users')
    .select('role').eq('user_id', user.id).maybeSingle();
  if (roleError) {
    console.error('[admin] Role check failed on login:', roleError.message);
    await authClient.auth.signOut().catch(() => {});
    return res.status(503).json({ error: 'Admin sign-in is temporarily unavailable.' });
  }
  if (!admin) {
    await authClient.auth.signOut().catch(() => {});
    return res.status(403).json({ error: 'This account does not have admin access.' });
  }

  await db.rpc('admin_clear_login_failures', { p_email_hash: emailHash, p_ip_hash: ipHash });
  const expiresIn = Math.max(60, Math.min(signedIn.session.expires_in || 3600, 3600));
  const { error: sessionError } = await db.from('admin_sessions').insert({
    token_hash: sessionHash(signedIn.session.access_token),
    user_id: user.id,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString()
  });
  if (sessionError) return res.status(503).json({ error: 'Admin sign-in is temporarily unavailable.' });
  res.cookie(COOKIE, signedIn.session.access_token, { ...cookieOptions, maxAge: expiresIn * 1000 });
  await writeAudit({ id: user.id, email: user.email }, 'admin.login', 'admin', user.id, { role: admin.role });
  return res.json({ user: { email: user.email, role: admin.role, expiresIn } });
}

export async function logoutAdmin(req, res) {
  const token = req.cookies?.[COOKIE];
  try {
    if (token) {
      const { error } = await getDb().from('admin_sessions').delete().eq('token_hash', sessionHash(token));
      if (error) console.error('[admin] Failed to delete session on logout:', error.message);
    }
  } finally {
    res.clearCookie(COOKIE, cookieOptions);
  }
  return res.json({ ok: true });
}

export async function requireAdmin(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    const { data: active, error: sessionError } = await getDb().rpc('admin_session_active', { p_token_hash: sessionHash(token) });
    if (sessionError) return res.status(503).json({ error: 'Admin session could not be verified.' });
    if (active !== true) return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
    const { data, error } = await getDb().auth.getUser(token);
    const user = data?.user;
    if (error || !user) return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
    const { data: admin, error: roleError } = await getDb().from('admin_users')
      .select('role').eq('user_id', user.id).maybeSingle();
    if (roleError || !admin || !['super_admin', 'manager', 'support'].includes(admin.role)) return res.status(403).json({ error: 'Admin access has been removed.' });
    req.admin = { id: user.id, email: user.email || '', role: admin.role };
    return next();
  } catch (error) {
    console.error('[admin] Session verification failed:', error.message);
    return res.status(503).json({ error: 'Admin session could not be verified.' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.admin && req.admin.role)
    ? next()
    : res.status(403).json({ error: 'Your role cannot perform this action.' });
}

export function requireAdminCsrf(req, res, next) {
  if (req.get('x-admin-request') !== '1') return res.status(403).json({ error: 'Request verification failed.' });
  const origin = req.get('origin');
  if (origin && !env.allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Request origin is not allowed.' });
  }
  return next();
}

export async function writeAudit(actor, action, entityType, entityId, details = {}) {
  const { error } = await getDb().from('admin_activity_logs').insert({
    actor_id: actor?.id || null,
    actor_email: actor?.email || '',
    action,
    entity_type: entityType,
    entity_id: entityId == null ? null : String(entityId),
    details: details || {}
  });
  if (error) console.error('[admin] Activity log write failed:', error.message);
}

export { COOKIE };
