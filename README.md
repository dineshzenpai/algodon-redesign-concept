# Algodon Organic — Editorial Redesign Concept

An editorial redesign concept for **Algodon Organic Shirts**, built with structural minimalism, modern commerce workflows, and full-stack capabilities. The project combines a responsive vanilla storefront, an administrative management portal, an Express API backend, and an optional modern React + Vite client.

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

3. **Backend API (`server.js`, `src/`)**
   - Express server with Helmet security headers, rate limiting, and CORS configuration.
   - Public commerce endpoints, order creation with fallback demo handling, and coupon verification.
   - Email invoice delivery via Nodemailer SMTP.
   - Firebase Admin SDK for token verification and Supabase PostgreSQL client with RLS.

4. **React Client (`client/`)**
   - React 19 + Vite + Tailwind CSS frontend application showcasing architectural tailoring and catalog browsing.

---

## Directory Structure

```
algodon-redesign-concept/
├── client/              # React 19 + Vite + Tailwind web application
│   ├── src/             # Pages, components, and Supabase client
│   └── package.json     # Client-specific dependencies and build scripts
├── css/                 # Stylesheets for storefront and admin panel
│   ├── admin.css        # Admin portal styling
│   └── styles.css       # Storefront editorial design system
├── docs/                # Setup guides and documentation
│   ├── ADMIN_PANEL_SETUP.md       # Admin panel installation & roles
│   ├── FIREBASE_AUTH_SETUP.md     # Firebase Auth & Google Sign-in setup
│   ├── SUPABASE_DATABASE_SETUP.md # Supabase commerce schemas & migrations
│   └── invoice-sample.pdf         # Sample generated order invoice
├── img/                 # High-resolution editorial photography & assets
├── js/                  # Frontend scripts
│   ├── admin.js         # Admin panel reactive controller
│   ├── config.example.js# Frontend configuration template
│   └── main.js          # Storefront interaction, cart, checkout, & PDF invoices
├── scripts/             # Operational utility scripts
│   ├── grant-firebase-admin.js    # Firebase admin claim provisioner
│   └── seed-admin.js    # Admin user seed script
├── src/                 # Express backend application source
│   ├── admin/           # Admin router and public storefront endpoints
│   ├── config/          # Environment validation (Zod) and DB connector
│   ├── firebase/        # Firebase Admin SDK initialization
│   └── lib/             # Shared server-side authentication helpers
├── supabase/            # Supabase database migrations and schemas
│   ├── migrations/      # Versioned schema migrations
│   └── setup/           # Sequential commerce setup SQL files
├── admin.html           # Admin portal HTML template
├── firestore.rules      # Firestore security rules
├── index.html           # Primary editorial storefront HTML template
├── package.json         # Root package configuration and operational scripts
├── server.js            # Express server entry point
└── storage.rules        # Firebase Storage security rules
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

Install client dependencies (optional, for React client development):
```bash
cd client && npm install && cd ..
```

### 3. Environment Configuration
1. Copy the environment example to create your secret configuration:
   ```bash
   cp .env.example .env
   ```
2. Configure your Supabase and Firebase keys in `.env`.
   *(Note: The server will run in offline fallback/demo mode if external database credentials are not present).*
3. Set up the frontend configuration:
   ```bash
   cp js/config.example.js js/config.js
   ```

### 4. Running the Application
- **Start the Express Server**:
  ```bash
  npm run dev      # Runs with Node --watch
  # or
  npm start        # Production start
  ```
  Visit [http://localhost:3000](http://localhost:3000) for the storefront and [http://localhost:3000/admin](http://localhost:3000/admin) for the admin portal.

- **Start the React Client** (Vite Dev Server):
  ```bash
  npm run client:dev
  ```

---

## Available Scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `npm start` | `node server.js` | Starts the Express server |
| `npm run dev` | `node --watch server.js` | Starts the Express server with file watch |
| `npm run seed:admin` | `node scripts/seed-admin.js` | Seeds initial Super Admin credentials |
| `npm run grant:firebase-admin` | `node scripts/grant-firebase-admin.js` | Grants admin custom claims to Firebase user |
| `npm run client:dev` | `npm --prefix client run dev` | Starts the Vite dev server for React client |
| `npm run client:build` | `npm --prefix client run build` | Compiles production bundle for React client |
| `npm run client:lint` | `npm --prefix client run lint` | Runs fast Oxlint linter on React client |

---

## Documentation

Detailed installation and service integration guides are located in the [`docs/`](docs/) folder:

- [Admin Panel Setup Guide](docs/ADMIN_PANEL_SETUP.md)
- [Firebase Authentication Setup](docs/FIREBASE_AUTH_SETUP.md)
- [Supabase Database & Commerce Setup](docs/SUPABASE_DATABASE_SETUP.md)

---

## License
ISC
