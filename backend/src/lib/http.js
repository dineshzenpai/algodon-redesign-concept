import { z } from 'zod';

export const uuid = z.string().uuid();
export const email = z.string().trim().toLowerCase().email().max(320);
export const address = z.object({
  name: z.string().trim().min(1).max(200), phone: z.string().trim().min(7).max(30),
  address1: z.string().trim().min(1).max(300), address2: z.string().trim().max(300).default(''),
  city: z.string().trim().min(1).max(120), state: z.string().trim().min(1).max(120),
  pin: z.string().trim().min(4).max(20)
}).strict();
export const cartItems = z.array(z.object({ id: uuid, size: z.string().trim().min(1).max(40), qty: z.number().int().min(1).max(100) }).strict()).max(50)
  .refine(items => new Set(items.map(item => `${item.id.toLowerCase()}:${item.size}`)).size === items.length, 'Combine duplicate product sizes.');

export function parse(schema, input, res) {
  const result = schema.safeParse(input);
  if (!result.success) { res.status(400).json({ error: result.error.issues[0].message }); return null; }
  return result.data;
}
export function databaseError(res, error) {
  if (error?.code === '23505') return res.status(409).json({ error: 'That value is already in use.' });
  if (['23503', '23514', '22023', '22P02'].includes(error?.code)) return res.status(400).json({ error: 'The submitted data is invalid or references an unavailable record.' });
  console.error('[database] Request failed:', error?.code || 'unavailable');
  return res.status(503).json({ error: 'The database is temporarily unavailable.' });
}
export function pagination(query) {
  const page = Math.max(1, Math.min(100000, Number.parseInt(query.page, 10) || 1));
  const limit = Math.max(1, Math.min(100, Number.parseInt(query.limit, 10) || 25));
  return { page, limit, from: (page - 1) * limit, to: page * limit - 1 };
}
export const publicOrderFields = 'id,items,subtotal,discount,coupon_code,customer,status,payment_status,payment_method,tracking_number,courier_name,created_at,updated_at';
