# Algodon Organic

Organic shirts storefront, admin panel, and an Express backend using Supabase Auth, PostgreSQL, and Storage. The storefront and admin panel use React and Vite, preserving the original design. Express runs separately on Render.

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
  src/storefront/       React storefront, account, cart, and checkout
  src/admin/            React store administration
  src/shared/           API, storage, and accessibility helpers
  public/img/           Original product and editorial images
  test/                 Desktop and mobile browser tests
scripts/                Migrations, admin setup, and verification
supabase/migrations/    Active, versioned database migrations
supabase/setup/         Legacy schema used by compatibility tests
test/                   HTTP, security, and database tests
```

Backend dependencies use the root package and lockfile. The React frontend has its own package and lockfile so Vercel installs only frontend dependencies.

## Local setup

Use Node.js 22 or later, npm, and PostgreSQL's `psql` command for database administration.

```powershell
npm ci
npm ci --prefix frontend
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env.local
```

Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `DATABASE_URL`, and `CLIENT_URL` in `.env`. Keep the secret key and database password on the server. Use `CLIENT_URL=http://localhost:5173` for local frontend access. Leave `VITE_API_URL` blank in `frontend/.env.local` to use Vite's local `/api` proxy, or set it to `http://localhost:3000` to call Express directly.

```powershell
npm run db:migrate
npm run dev
```

Open http://localhost:5173 for the storefront or http://localhost:5173/admin for the admin panel. `npm run dev` starts both Vite (5173) and Express (3000), with API requests proxied to Express. `npm start` starts only the production backend. To run them in separate terminals, use `npm run backend:dev` and `npm run frontend:dev`; set CLIENT_URL to the frontend origin in .env.

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

In Vercel select Root Directory **frontend**, Framework Preset **Other**, and leave build/output overrides disabled. The included configuration installs frontend dependencies with `npm ci` and runs `npm run build`. It produces the Vercel Build Output API directory with static files and routes; there are no Vercel Functions. The repository root is also supported with its own configuration.

Set the Vercel Production environment variable `VITE_API_URL` to the Render backend origin, with no trailing `/api`. Vite embeds this value in the browser bundle during the build, so redeploy after changing it. Do not add database credentials or the Supabase secret key to Vercel.

### 2. Create the Render backend

Create a Render Web Service from this repository (or use the included `render.yaml` Blueprint). Use repository root, Node runtime, build command `npm ci --omit=dev`, start command `npm start`, and health check `/api/health/ready`. Render supplies PORT.

Set these environment variables on Render:

- `NODE_ENV=production`
- `CLIENT_URL=https://www.algodonfashion.com` (the exact production frontend origin; use your actual Vercel domain if different)
- Optional `ALLOWED_ORIGINS=https://preview.example.com,https://another-controlled-domain.example` for additional exact frontend origins; do not use wildcards.
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

Copy the Supabase values from your local environment to Render's private environment settings. SMTP settings are optional for email notifications. Database migrations and admin seeding are separate setup tasks, never automatic build steps. Existing Supabase data is reused.

### 3. Connect the deployments

The browser calls Render directly using `VITE_API_URL`; Render's credentialed CORS allows `CLIENT_URL` and any explicitly configured `ALLOWED_ORIGINS`, and rejects other browser origins. Admin session cookies use `SameSite=None; Secure` in production so credentialed cross-origin requests can carry the session. Admin calls require the `X-Admin-Request: 1` CSRF header. Customer and Firebase admin bearer tokens are provider-issued JWTs verified by Supabase Auth and Firebase Admin SDK; no separate JWT signing secret is needed. Keep Supabase secret and database credentials on Render.

In Supabase Auth URL Configuration, use your frontend URL as Site URL and allow its /account and /admin redirect URLs for password recovery. Verify Render's `/api/health/ready` returns 200, then check login and orders through Vercel. If Vercel blocks deployment because the commit author lacks project access, ask a project owner or authorized administrator to grant access or redeploy the commit; do not bypass Deployment Protection.

## Verification

```powershell
npm test
npm run test:frontend
npm run frontend:build
npm run test:db
npm run verify:backend
```

`npm test` runs HTTP, security, and production bundle regressions after installing both dependency sets. `test:frontend` runs React interaction tests in Chrome at desktop and mobile widths, using mocked APIs without changing Supabase data. On systems without Chrome, install a Playwright browser with `npx --prefix frontend playwright install chromium`, or set CHROME_EXECUTABLE to your Chrome path. `test:db` uses a disposable local PostgreSQL cluster. `verify:backend` uses the configured Supabase project, creates uniquely named test records, and removes them afterward; it requires admin and database credentials.

`.env`, dependencies, and local `docs/` notes are excluded from Git.

## License

ISC
