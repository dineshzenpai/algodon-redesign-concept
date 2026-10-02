import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { getDb } from '../config/db.js';
import { verifyFirebaseIdToken } from '../firebase/admin.js';

const COOKIE = 'algodon_admin_session';
const cookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'strict',
  path: '/api/admin',
  maxAge: 60 * 60 * 1000
};
function digest(value) {
  return createHash('sha256').update(`${env.supabase.serviceRoleKey}:${value}`).digest('hex');
}

export async function loginAdmin(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
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
  const { data: signedIn, error: authError } = await authClient.auth.signInWithPassword({ email, password });
  const user = signedIn && signedIn.user;
  if (authError || !user) {
    await db.rpc('admin_record_login_failure', { p_email_hash: emailHash, p_ip_hash: ipHash });
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }

  const { data: admin, error: roleError } = await db.from('admin_users')
    .select('role').eq('user_id', user.id).maybeSingle();
  if (roleError || !admin) {
    await authClient.auth.signOut();
    return res.status(403).json({ error: 'This account does not have admin access.' });
  }

  await db.rpc('admin_clear_login_failures', { p_email_hash: emailHash, p_ip_hash: ipHash });
  const expiresIn = Math.max(60, Math.min(signedIn.session.expires_in || 3600, 3600));
  res.cookie(COOKIE, signedIn.session.access_token, { ...cookieOptions, maxAge: expiresIn * 1000 });
  await writeAudit({ id: user.id, email: user.email }, 'admin.login', 'admin', user.id, { role: admin.role });
  return res.json({ user: { email: user.email, role: admin.role, expiresIn } });
}

export function logoutAdmin(req, res) {
  res.clearCookie(COOKIE, cookieOptions);
  return res.json({ ok: true });
}

export async function requireAdmin(req, res, next) {
  const bearer = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '');
  if (bearer) {
    try {
      const claims = await verifyFirebaseIdToken(bearer[1]);
      if (claims.role !== 'admin') return res.status(403).json({ error: 'Firebase admin access is required.' });
      req.admin = { id: claims.uid, email: claims.email || '', role: 'super_admin', authProvider: 'firebase' };
      return next();
    } catch (error) {
      return res.status(401).json({ error: 'The Firebase ID token is invalid or expired.' });
    }
  }
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    const { data: { user }, error } = await getDb().auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
    const { data: admin, error: roleError } = await getDb().from('admin_users')
      .select('role').eq('user_id', user.id).maybeSingle();
    if (roleError || !admin) return res.status(403).json({ error: 'Admin access has been removed.' });
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
  const requestOrigin = `${req.protocol}://${req.get('host')}`;
  const configuredOrigin = new URL(env.clientUrl).origin;
  if (origin && origin !== requestOrigin && origin !== configuredOrigin) {
    return res.status(403).json({ error: 'Request origin is not allowed.' });
  }
  return next();
}

export async function writeAudit(actor, action, entityType, entityId, details = {}) {
  const { error } = await getDb().from('admin_activity_logs').insert({
    actor_id: actor.authProvider === 'firebase' ? null : actor.id,
    actor_email: actor.email || '',
    action,
    entity_type: entityType,
    entity_id: entityId == null ? null : String(entityId),
    details: actor.authProvider === 'firebase' ? { ...details, authProvider: 'firebase' } : details
  });
  if (error) console.error('[admin] Activity log write failed:', error.message);
}

export { COOKIE };
