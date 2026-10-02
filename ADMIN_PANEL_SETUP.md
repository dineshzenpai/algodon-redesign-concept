# Algodon Organic admin panel

This panel uses the existing Express API and Supabase project. Supabase Auth handles admin email/password credentials and password recovery; its access JWT is held in an HTTP-only, SameSite=Strict cookie. Every admin API request verifies that JWT with Supabase and reloads the user's role from `admin_users`. The browser never receives the Supabase service key.

## Setup

1. Create a private backup of the existing Supabase database.
2. Configure the server `.env` with `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`. Keep the service key on the server only. Set `CLIENT_URL` to the storefront origin.
3. Apply [`supabase/migrations/202610020001_admin_panel.sql`](supabase/migrations/202610020001_admin_panel.sql) using the Supabase CLI or SQL Editor. It adds catalog, category, coupon, staff, customer flags, audit, and order-management fields; enables row-level security on admin tables; creates a public-read image bucket with server-only uploads and an atomic managed-catalog checkout function.
4. Enable Email and Password under Supabase Authentication providers. Add the exact `/admin` URL to the Supabase password recovery redirect allowlist.
5. Run `npm install`, set `ADMIN_EMAIL` and an initial `ADMIN_PASSWORD` of at least 12 characters in `.env`, then run `npm run seed:admin`. The seed is safe to repeat for the existing Super Admin. Remove `ADMIN_PASSWORD` from the environment after seeding.
6. Start the app with `npm start` and visit `/admin`. Set real stock, variants, category, and image data before publishing products. Published managed products replace the static concept cards in the storefront and use server-side price, inventory, customer-block, and coupon checks at checkout.
7. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` to send order-status and invoice emails. For Gmail, use `smtp.gmail.com`, port `587`, and `SMTP_SECURE=false`; use a Google App Password for `SMTP_PASSWORD` (not the normal account password). Without SMTP, order updates still save and no email is sent.

Use HTTPS in production. Set `NODE_ENV=production` so the admin cookie is marked Secure. Configure the deployment proxy carefully before enabling Express `trust proxy`; rate limits depend on the IP address Express sees. The public browser configuration remains in `js/config.js`; the server `.env` must never be copied into a public directory.

The existing hard-coded concept catalog and its original Supabase insert path remain available when no admin products are published, so an empty admin database does not blank the storefront. Those legacy orders do not decrement managed inventory or enforce admin customer blocks and coupons. Populate and publish the real catalog before using those controls as production checkout rules.

## Roles

| Role | Access |
| --- | --- |
| Super Admin | All data and actions; create staff, change roles, revoke staff, and view activity logs. |
| Manager | Catalog, inventory, categories, coupons, customers, and order/payment status. Cannot manage staff or audit logs. |
| Support | Read products/customers and update order fulfilment, tracking, and internal notes. Cannot change payment/refund status, coupons, customer blocks, catalog, or staff. |

Passwords are managed and hashed by Supabase Auth. Failed logins are rate-limited and locked for 15 minutes after repeated attempts; counters are stored in Supabase. Admin sessions expire with the Supabase access token and the panel signs users out after 20 minutes without activity. Password reset links are available from the login screen.

## API routes

All `/api/admin/*` data routes require an authenticated admin session and the `X-Admin-Request: 1` request header. Changes also check the request origin and write an audit entry.

| Method and route | Purpose |
| --- | --- |
| `POST /api/admin/auth/login`, `POST /api/admin/auth/logout`, `POST /api/admin/auth/password-reset`, `POST /api/admin/auth/password-update` | Admin login, logout, and recovery. |
| `GET /api/admin/me`, `GET /api/admin/dashboard` | Current staff role and sales KPIs. |
| `GET/POST /api/admin/products`, `PATCH/DELETE /api/admin/products/:id`, `POST /api/admin/products/:id/duplicate`, `PATCH /api/admin/products/bulk-stock`, `POST /api/admin/products/import`, `GET /api/admin/products/export` | Catalog editing, publishing, inventory, and bulk transfer. |
| `GET/POST /api/admin/categories`, `PATCH/DELETE /api/admin/categories/:id`, `PATCH /api/admin/categories/reorder` | Category and subcategory management. |
| `GET /api/admin/orders`, `GET /api/admin/orders/:id`, `PATCH /api/admin/orders/:id`, `GET /api/admin/orders/export` | Order search, fulfilment updates, notes, tracking, and export. |
| `GET/POST /api/admin/coupons`, `PATCH/DELETE /api/admin/coupons/:id`, `GET /api/admin/coupons/:id/usage` | Discount rules and redemption reporting. |
| `GET /api/admin/customers`, `GET /api/admin/customers/:email`, `PATCH /api/admin/customers/:email/block`, `GET /api/admin/customers/export` | Customer profiles, order history, access flags, and export. |
| `POST/DELETE /api/admin/images` | Validate, store, and delete product images in Supabase Storage. |
| `GET/POST /api/admin/staff`, `PATCH/DELETE /api/admin/staff/:id` | Staff provisioning and roles (Super Admin only). |
| `GET /api/admin/activity` | Paginated activity history (Super Admin only). |
| `GET /api/products`, `GET /api/categories` | Public published catalog used by the storefront. |
| `POST /api/coupons/validate`, `POST /api/checkout/orders` | Public coupon preview and server-validated atomic checkout for managed catalog products. |

## Data model

The migration creates `admin_users`, `admin_login_attempts`, `admin_activity_logs`, `products`, `categories`, `coupons`, `coupon_redemptions`, and `customer_admin_flags`. It extends the existing `order_intents` table so current storefront records remain readable. Product variants and order line items are JSONB snapshots; searchable catalog fields and status/date fields have indexes. Supabase Auth owns staff credentials. Supabase Storage keeps public product images in the `admin-product-images` bucket.

## Service integrations and operational limits

The current project has no payment processor or SMS provider configured. Marking an order Refunded records the status; it does not transfer money. Email notifications are sent only when SMTP is configured, and no SMS is sent. Admin order printing uses the browser's print dialog to save an invoice or packing slip as PDF. TOTP two-factor authentication is not enabled in this implementation; add a required Supabase MFA enrollment/verification step before production if policy requires it. Conversion tracking is omitted because the storefront has no analytics event data.
