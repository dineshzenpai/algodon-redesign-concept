# Algodon Organic

Organic shirts storefront, admin panel, and an Express backend using Supabase Auth, PostgreSQL, and Storage. The storefront uses HTML, CSS, and JavaScript; there is no React build step.

## Project structure

```text
backend/
  server.js             HTTP server
  src/admin/            Staff authentication and store management
  src/customer/         Customer authentication and account APIs
  src/config/           Environment and Supabase configuration
  src/firebase/         Optional Firebase authentication
  src/lib/              Shared validation and email helpers
frontend/
  storefront/           Storefront pages, scripts, styles, and images
  admin/                Admin interface
scripts/                Migrations, admin setup, and verification
supabase/migrations/    Active, versioned database migrations
supabase/setup/         Legacy schema used by compatibility tests
test/                   HTTP, security, and database tests
```

All Node dependencies are managed by the root `package.json` and `package-lock.json`.

## Local setup

Use Node.js 22 or later, npm, and PostgreSQL's `psql` command for database administration.

```powershell
npm install
Copy-Item .env.example .env
```

Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `DATABASE_URL`, and `CLIENT_URL` in `.env`. Keep the secret key and database password on the server. Public browser configuration is generated at `/js/config.js`.

```powershell
npm run db:migrate
npm run dev
```

Open http://localhost:3000 for the storefront or http://localhost:3000/admin for the admin panel. `npm start` runs without file watching. The `backend:start` and `backend:dev` scripts are aliases for the same server.

Migrations are recorded with checksums and applied transactionally. For an existing database without migration history, verify its schema before using `--baseline-through=LAST_APPLIED_FILE.sql`; never replay historical migrations over a newer schema. Set `PSQL_PATH` if PostgreSQL is installed outside the default location.

## Admin and catalog

To create the first admin, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (at least 12 characters), then run:

```powershell
npm run seed:admin
```

Remove the seed password from production environments afterward. Create and publish products with real variant stock through the admin panel. Static concept cards have no database inventory and cannot be purchased.

Checkout records pending orders without collecting payment. Prices, coupons, and inventory are verified by the server. Signed-in customers have private order history, profiles, saved carts, and wishlists. Newsletter signups are stored in Supabase. Staff manage catalog, orders, customers, coupons, uploads, roles, and audit logs.

Payment/refund fields are administrative records; they do not move money. Cancellation and return statuses do not automatically restock goods. Staff reconcile inventory explicitly.

Firebase is optional and currently deferred. SMTP email requires valid mail credentials; a sample SMTP host alone does not enable delivery. Deployment requires HTTPS, `NODE_ENV=production`, and the correct `CLIENT_URL`.

## Deployment: Vercel frontend and Render backend

Vercel serves static storefront and admin pages only. Render runs Express and all database, authentication, upload, and order APIs. Local development still uses `npm run dev`.

### 1. Deploy the frontend now

In Vercel select Root Directory **frontend**, Framework Preset **Other**, and leave build/output overrides disabled. The included configuration runs `node build.mjs` without installing backend dependencies. It produces the Vercel Build Output API directory with static files and routes; there are no Vercel Functions. The repository root is also supported with its own configuration.

You can deploy before Render exists. Pages and UI load, while API requests return a clear 503 backend-not-connected response. Login, live catalog, saved accounts, uploads, and checkout require the backend. Do not add database credentials or Supabase secret keys to Vercel.

### 2. Create the Render backend

Create a Render Web Service from this repository (or use the included `render.yaml` Blueprint). Use repository root, Node runtime, build command `npm ci --omit=dev`, start command `npm start`, and health check `/api/health/ready`. Render supplies PORT.

Set these environment variables on Render:

- `NODE_ENV=production`
- `CLIENT_URL=https://YOUR-FRONTEND.vercel.app` (the exact frontend origin)
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

Copy the Supabase values from your local environment to Render's private environment settings. SMTP settings are optional for email notifications. Database migrations and admin seeding are separate setup tasks, never automatic build steps. Existing Supabase data is reused.

### 3. Connect the deployments

After Render assigns its URL, add `RENDER_BACKEND_URL=https://YOUR-SERVICE.onrender.com` to Vercel's environment variables and redeploy. Use the HTTPS origin without an /api suffix. Vercel forwards /api requests and /js/config.js to Render; browser requests remain on the frontend origin, preserving the admin's secure, HttpOnly cookie flow. The public browser config comes from Render; server secrets stay there.

In Supabase Auth URL Configuration, use your frontend URL as Site URL and allow its /account and /admin redirect URLs for password recovery. Verify Render's /api/health/ready returns 200, then check login and orders through Vercel. Redeploy Vercel after changing RENDER_BACKEND_URL.

## Verification

```powershell
npm test
npm run test:db
npm run verify:backend
```

`npm test` runs HTTP and security regressions. `test:db` uses a disposable local PostgreSQL cluster. `verify:backend` uses the configured Supabase project, creates uniquely named test records, and removes them afterward; it requires admin and database credentials.

`.env`, dependencies, and local `docs/` notes are excluded from Git.

## License

ISC
