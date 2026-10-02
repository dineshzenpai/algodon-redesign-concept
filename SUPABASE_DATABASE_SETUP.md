# Supabase database setup

This setup adds a customer-facing clothing catalog and commerce schema alongside the existing Express admin tables and `order_intents` flow. The current project includes a Vite/React concept client under `client/`; its Supabase module is `client/src/lib/supabase.js`. Seed currency and country defaults follow the existing INR/Rs storefront. Update these defaults for another market before taking real orders.

## Run order

In Supabase Dashboard → SQL Editor, create a new query for each file and run them in order:

1. [`supabase/setup/01_identity_catalog.sql`](supabase/setup/01_identity_catalog.sql) — profiles, addresses, categories, products, variants, and images.
2. [`supabase/setup/02_commerce.sql`](supabase/setup/02_commerce.sql) — carts, wishlists, store pricing settings, orders, coupons, redemptions, and reviews.
3. [`supabase/setup/03_auth_rls.sql`](supabase/setup/03_auth_rls.sql) — signup trigger, admin helper, grants, and row-level policies.
4. [`supabase/setup/04_storage_business_logic.sql`](supabase/setup/04_storage_business_logic.sql) — `product-images` bucket, cart/order RPCs, and reporting views.
5. [`supabase/setup/05_seed_data.sql`](supabase/setup/05_seed_data.sql) — six categories, twelve sample garments with S–XXL/Natural/Navy variants, and three sample coupons.

These scripts are safe to rerun for the seeded catalog and named triggers/policies. Back up any existing Supabase project before applying SQL. These tables are additive; the earlier admin-panel migration under `supabase/migrations/` remains separate and is not required for the customer schema.

## Supabase project checklist

1. Create a Supabase project and save its database password securely.
2. In Authentication → Providers, enable Email and Google. Configure the Google OAuth client ID/secret and the Supabase callback URL shown in the provider setup. Add local and production site URLs to Authentication URL Configuration.
3. In project API settings, copy the Project URL and publishable key (or legacy anon key) into `client/.env` using `client/.env.example`. The Vite client must only receive these public values. The Express API separately needs `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` in the repository-root `.env`; the secret/service-role key stays server-side.
4. Run the five SQL files in order above. The signup trigger creates a `profiles` row with `role='customer'` for both email and Google signups.
5. Grant the first admin only after that person signs up. In SQL Editor, replace the email below with the verified account email:

   ```sql
   update public.profiles p
   set role = 'admin'
   from auth.users u
   where p.id = u.id and lower(u.email) = lower('admin@example.com');
   ```

6. Start the Vite client with `cd client` then `npm run dev`. Restart Vite after changing `.env` values. Build with `npm run build`.

## Client examples

```js
import { listProducts, getProductBySlug, addToCart, placeOrder } from './lib/supabase';

const filtered = await listProducts({ category: 'shirts', size: 'M', fit: 'regular', minPrice: 1000, maxPrice: 5000 });
const product = await getProductBySlug('everyday-oxford-shirt');
await addToCart(product.product_variants[0].id, 1); // Requires a signed-in user.
const orderId = await placeOrder(savedAddressId, 'WELCOME10'); // DB locks stock, applies coupon, snapshots items, and clears cart atomically.
```

For Supabase Auth, call `supabase.auth.signInWithPassword(...)` for email or `supabase.auth.signInWithOAuth({ provider: 'google' })` for Google. `place_order` creates pending orders; connect a payment provider before treating an order as paid. Shipping and tax amounts default to zero because the operating country and tax/shipping rules need to be selected for production. The existing Firebase sign-in in the classic storefront is not replaced by this setup.

## Security and operating notes

- Browser code uses the publishable/anon key and RLS. Never expose `SUPABASE_SECRET_KEY` / service-role key to Vite or the browser.
- Customers can only manage their own profile, addresses, cart, wishlist, and reviews; order creation uses the atomic RPC. Order status updates, catalog changes, coupons, and uploads require `profiles.role='admin'`.
- The admin helper protects this schema's policies through `profiles.role`. The pre-existing admin panel also uses its separate `admin_users` role table; assign roles consistently if one account uses both interfaces.
- The low-stock view uses a default threshold of five units. Change its predicate or introduce a per-variant threshold if your inventory policy differs.
- Configure shipping and tax for the selected market in `public.store_settings` before launch. It defaults to INR with zero shipping and tax until you enter locally appropriate values.
- The SQL schema is designed for Supabase Postgres 15+ (security-invoker views) and Supabase Storage/Auth.
