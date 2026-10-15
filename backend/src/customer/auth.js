import { createClient } from '@supabase/supabase-js';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { getDb } from '../config/db.js';
import { env } from '../config/env.js';
import { email, parse, databaseError } from '../lib/http.js';

export const authRouter = Router();
authRouter.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false }));
authRouter.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
function client() {
  return createClient(env.supabase.url, env.supabase.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
const password = z.string().min(12).max(128);
const safeUser = user => user ? { id: user.id, email: user.email, full_name: user.user_metadata?.full_name || '', email_confirmed: Boolean(user.email_confirmed_at) } : null;
const tokenHash = token => createHash('sha256').update(token).digest('hex');

export async function customerAuth(req, res, next) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') || '');
  if (!match) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    const { data, error } = await getDb().auth.getUser(match[1]);
    if (error || !data?.user?.email_confirmed_at) return res.status(401).json({ error: 'A verified customer session is required.' });
    const revoked = await getDb().from('customer_revoked_tokens').select('token_hash').eq('token_hash', tokenHash(match[1])).maybeSingle();
    if (revoked.error) return res.status(503).json({ error: 'Your account could not be verified.' });
    if (revoked.data) return res.status(401).json({ error: 'Session expired. Sign in again.' });
    req.customer = data.user;
    req.customerToken = match[1];
    next();
  } catch { return res.status(503).json({ error: 'Your account could not be verified.' }); }
}

authRouter.post('/signup', async (req, res) => {
  const input = parse(z.object({ email, password, name: z.string().trim().min(1).max(200) }).strict(), req.body, res);
  if (!input) return;
  const { data, error } = await client().auth.signUp({ email: input.email, password: input.password, options: { data: { full_name: input.name }, emailRedirectTo: new URL('/account', env.clientUrl).href } });
  if (error) return res.status(error.status === 429 ? 429 : 400).json({ error: 'Account registration could not be completed. Check your details or try signing in.' });
  // Confirmation policy remains controlled by Supabase; never confirm emails with the service key here.
  res.status(201).json({ user: safeUser(data.user), session: data.session, message: data.session ? 'Account created.' : 'Check your email to confirm your account.' });
});
authRouter.post('/login', async (req, res) => {
  const input = parse(z.object({ email, password: z.string().min(1).max(128) }).strict(), req.body, res);
  if (!input) return;
  const { data, error } = await client().auth.signInWithPassword(input);
  if (error) return res.status(error.status === 429 ? 429 : 401).json({ error: 'Email or password is incorrect, or the email is not confirmed.' });
  res.json({ user: safeUser(data.user), session: data.session });
});
authRouter.post('/refresh', async (req, res) => {
  const input = parse(z.object({ refresh_token: z.string().min(1).max(4096) }).strict(), req.body, res);
  if (!input) return;
  const { data, error } = await client().auth.refreshSession(input);
  if (error) return res.status(401).json({ error: 'Session expired. Sign in again.' });
  res.json({ user: safeUser(data.user), session: data.session });
});
authRouter.post('/password-reset', async (req, res) => {
  const input = parse(z.object({ email }).strict(), req.body, res);
  if (!input) return;
  await client().auth.resetPasswordForEmail(input.email, { redirectTo: new URL('/account', env.clientUrl).href });
  res.json({ message: 'If this account exists, password reset instructions have been sent.' });
});
authRouter.post('/password-update', customerAuth, async (req, res) => {
  const input = parse(z.object({ password }).strict(), req.body, res);
  if (!input) return;
  const { error } = await getDb().auth.admin.updateUserById(req.customer.id, { password: input.password });
  if (error) return res.status(400).json({ error: 'Password update failed. Request a new recovery link or sign in again.' });
  res.json({ ok: true });
});
authRouter.post('/logout', customerAuth, async (req, res) => {
  let expiresAt = Date.now() + 3600000;
  try { const exp = JSON.parse(Buffer.from(req.customerToken.split('.')[1], 'base64url')).exp; if (Number.isFinite(exp)) expiresAt = exp * 1000; } catch { /* Auth has already verified the token. */ }
  const recorded = await getDb().from('customer_revoked_tokens').insert({ token_hash: tokenHash(req.customerToken), user_id: req.customer.id, expires_at: new Date(expiresAt).toISOString() });
  if (recorded.error && recorded.error.code !== '23505') return databaseError(res, recorded.error);
  const { error } = await getDb().auth.admin.signOut(req.customerToken, 'local');
  if (error) return databaseError(res, error);
  await getDb().from('customer_revoked_tokens').delete().lt('expires_at', new Date().toISOString());
  res.json({ ok: true });
});
