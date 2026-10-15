# Algodon Organic — Editorial Redesign Concept

An editorial redesign concept for **Algodon Organic Shirts**, built with structural minimalism, modern commerce workflows, and full-stack capabilities. The project combines a responsive vanilla storefront, an administrative management portal, an Express API backend.

---

## Architecture Overview

1. **Editorial Storefront (`/`)**
   - Pure HTML5, modern CSS3 (with responsive layouts and custom CSS properties), and ES Modules.
   - Interactive cart drawer, guest and authenticated checkout flows, and localStorage persistence.
   - Live order tracking with a visual progress stepper (Confirmed → Tailored → Shipped → Delivered).
   - Instant client-side PDF invoice generation via jsPDF with one-click download.

2. **Admin Portal (`/admin`)**
   - Role-based staff panel (Super Admin, Manager, Support) for managing catalog items, stock variants, coupons, customer notes, and orders.
   - Protected API access with session and token validation.

3. **Backend API (`backend/server.js`, `backend/src/`)**
   - Express server with Helmet security headers, rate limiting, and CORS configuration.
   - Public catalog, atomic order creation, coupon verification, customer accounts, profiles, saved carts, wishlists, private order history, and newsletter storage.
   - Email invoice delivery via Nodemailer SMTP.
   - Firebase Admin SDK for token verification and Supabase PostgreSQL client with RLS.

---

## Directory Structure

```
algodon-redesign-concept/
├── backend/                             # Express backend application
│   ├── package.json                     # Backend service dependencies & scripts
│   ├── server.js                        # Express HTTP server entry point
│   └── src/                             # Backend source code
│       ├── admin/                       # Admin router & public checkout RPC
│       ├── config/                      # Environment schema (Zod) & DB client
│       └── firebase/                    # Firebase Admin SDK initialization
├── frontend/                            # Frontend applications and interfaces
│   ├── admin/                           # Admin portal browser interface
│   │   ├── admin.html                   # Admin entry point
│   │   └── assets/                      # Admin stylesheets and JavaScript
│   ├── storefront/                      # Editorial organic shirts storefront
│   │   ├── index.html                   # Storefront landing page & SPA host
│   │   ├── css/                         # Storefront editorial design system
│   │   ├── js/                          # Storefront interaction & cart scripts
│   │   ├── img/                         # High-res photography & assets
│   │   └── lib/                         # Client-side Firebase auth & storage SDK
├── supabase/                            # Supabase database migrations and schemas
│   ├── migrations/                      # Versioned schema migrations
│   └── setup/                           # Sequential commerce setup SQL files
├── docs/                                # Architecture & setup guides
├── scripts/                             # Utility scripts (seed admin, claims)
├── test/                                # Automated security & routing tests
├── .env.example                         # Environment configuration template
├── package.json                         # Monorepo root orchestration
└── README.md
```

---

## Getting Started

### 1. Prerequisites
- **Node.js** (v18.0.0 or later recommended)
- **npm** (v9.0.0 or later)

### 2. Installation
Clone the repository and install root dependencies:
```bash
npm install
```

### 3. Environment Configuration
1. Copy the environment example to create your secret configuration:
   ```bash
   cp .env.example .env
   ```
2. Configure your Supabase and Firebase keys in `.env`.
   *(Note: The server will run in offline fallback/demo mode if external database credentials are not present).*
3. Run `npm run db:migrate` to apply pending migrations. Public storefront configuration is served automatically at `/js/config.js`; no browser secret file is needed. See [Backend API and Setup](docs/BACKEND_API.md).

### 4. Running the Application
- **Start the Express Server & Storefront**:
  ```bash
  npm run dev      # Runs with Node --watch
  # or
  npm start        # Production start
  ```
  Visit [http://localhost:3000](http://localhost:3000) for the storefront and [http://localhost:3000/admin](http://localhost:3000/admin) for the admin portal.

---

## Available Scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `npm start` | `node backend/server.js` | Starts the Express server |
| `npm run dev` | `node --watch backend/server.js` | Starts the Express server with file watch |
| `npm test` | `node --test test/*.test.js` | Runs automated security & route tests |
| `npm run db:migrate` | `node scripts/migrate.js` | Applies pending migrations and verifies checksums |
| `npm run verify:backend` | `node scripts/verify-backend.js` | Verifies live backend flows using temporary Supabase records |
| `npm run backend:start` | `npm --prefix backend start` | Starts backend server via backend package |
| `npm run seed:admin` | `node scripts/seed-admin.js` | Seeds initial Super Admin credentials |
| `npm run grant:firebase-admin` | `node scripts/grant-firebase-admin.js` | Grants admin custom claims to Firebase user |

---

## Documentation

Detailed installation and service integration guides are located in the [`docs/`](docs/) folder:

- [Admin Panel Setup Guide](docs/ADMIN_PANEL_SETUP.md)
- [Backend API and Setup](docs/BACKEND_API.md)
- [Firebase Authentication Setup](docs/FIREBASE_AUTH_SETUP.md)
- [Supabase Database & Commerce Setup](docs/SUPABASE_DATABASE_SETUP.md)

---

## License
ISC
