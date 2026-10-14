# Algodon Firebase setup

The storefront is a vanilla JavaScript ES module app served by the existing Express server. Firebase Auth, Firestore, and Storage use the modular Firebase SDK. The existing Supabase email/password account and admin-panel sessions remain available, so enabling Google sign-in does not require replacing the current store database or admin login.

## 1. Configure Firebase

1. In the [Firebase Console](https://console.firebase.google.com/), create a project for Algodon Organic (or select the existing project).
2. Open **Project settings → General → Your apps**, add a **Web app**, and copy its configuration values.
3. Copy `.env.example` to `.env`. Set `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, and `FIREBASE_APP_ID` to the matching web-app values. The API key and other web config fields are public client configuration; the Admin SDK values below are private.
4. In **Authentication → Sign-in method**, enable **Google** and choose a support email.
5. In **Authentication → Settings → Authorized domains**, add `localhost` for local development and the exact production hostname (for example, `shop.example.com`, without a scheme or path). Add any preview hostnames you use.
6. In **Firestore Database**, create the database, choose a region, and deploy this repository's `../firestore.rules`.
7. In **Storage**, enable the bucket and deploy `../storage.rules`. Set `FIREBASE_STORAGE_BUCKET` to the bucket shown in project settings.
8. Create a service account for the backend/Admin SDK. Set `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` from its credentials in the server's secret environment. Store the private key with literal `\n` characters or newlines. Never put this service-account key in `js/config.js`, frontend code, or a public repository.
9. Keep the required existing Supabase environment values in `.env` as well. This project still uses Supabase for its catalog, orders, email/password accounts, and existing admin panel.

The server exposes only the six public web configuration values at `GET /api/firebase-config`; service-account credentials are not returned to the browser.

## 2. Local run

```powershell
Copy-Item .env.example .env
# Fill in the Firebase and existing Supabase values in .env
npm install
npm run dev
```

Open `http://localhost:3000`. Google sign-in uses a popup on desktop and redirects on mobile. If a desktop browser blocks the popup, the client retries with redirect. Firebase persists the session in browser-local storage, and the SDK refreshes ID tokens when `getIdToken()` is called.

## 3. Data and access model

- `users/{uid}` stores `name`, `email`, `photoURL`, `phone`, `role: "customer"`, `createdAt`, and `lastLoginAt`. First sign-in creates this document; later sign-ins update only `lastLoginAt`.
- `users/{uid}/cart/{itemId}` stores the signed-in cart. A guest cart is merged into the account once, then the cloud cart is the canonical copy. Sign-out clears the signed-in cart from the browser to prevent it appearing in another account.
- `users/{uid}/wishlist/{itemId}` is the private wishlist location for future/storefront wishlist items.
- `users/{uid}/orders/{orderId}` stores a customer-readable order reference after a successful managed checkout. The source order remains in the existing Supabase store database.
- Top-level `products` and `categories` allow public reads and Firebase-admin writes. `coupons` and top-level `orders` are admin-only. A user can create only their own user-scoped order reference.
- Admin status comes from the Firebase ID token's custom `role: "admin"` claim (also `admin: true` for Security Rules). A Firestore `users/{uid}.role` value is never used to grant admin rights.

The existing `/api/admin` routes continue to accept their current Supabase admin cookie. They also accept a Firebase bearer token only when its signed custom claim is `role: "admin"`; that identity receives the panel's `super_admin` permission tier. `src/firebase/admin.js` provides `requireFirebaseAuth` and `requireFirebaseAdmin`, and `GET /api/firebase-admin/whoami` is a protected example for Firebase-only endpoints. This preserves the current admin login while making Firebase admin claims available to protected admin APIs. Apply both Firebase middleware functions to every new Firebase-only admin route.

### Grant a Firebase admin claim

Make sure the email has signed into Firebase at least once, then run from the server environment with Firebase Admin credentials configured:

```powershell
npm run grant:firebase-admin -- admin@example.com
```

The script preserves existing custom claims and adds `role: "admin"` plus `admin: true`. The user must sign in again or refresh their ID token before the new claim appears. To revoke access, use a trusted Admin SDK script to remove those claims.

## 4. Rules deployment

Install Firebase CLI and authenticate with a project administrator, then select the project and deploy only the provided rules:

```powershell
firebase login
firebase use <your-firebase-project-id>
firebase deploy --only firestore:rules,storage
```

Review these rules against any future collections before adding client access. The Firebase Admin SDK bypasses Firestore and Storage rules, so server endpoints must always verify ID tokens and enforce admin claims themselves.

## 5. Hosting and production

- **Local:** `npm run dev`; keep `.env` out of version control. `PORT` and `CLIENT_URL` configure Express.
- **Vercel or Netlify:** deploy the existing Node server as a function using the platform's Express adapter or function entry point. Set the same Supabase and Firebase environment variables in the platform dashboard, and ensure static assets and `/api/*` reach the same deployment. Add the production and preview hostnames to Firebase Authorized domains.
- **Firebase Hosting:** this project currently relies on Express APIs, so static hosting alone is insufficient. Host Express as a Cloud Function/Cloud Run service and configure Hosting rewrites for `/api/**` and the storefront routes, or keep the existing Node host and use Firebase only for Auth/Firestore/Storage. Set server secrets in the function/service environment, never in Hosting files.
- Use HTTPS in production, restrict the service account to the minimum Firebase Auth/Firestore/Storage permissions required, and deploy `firestore.rules` and `storage.rules` with each rules change.

## 6. Verification checklist

- Desktop: sign in with a new Google account, refresh, sign out, retry with a returning user, and verify the avatar/menu plus profile fields in Firestore.
- Mobile: verify redirect sign-in returns to the original page and persists across refresh.
- Try a blocked popup, cancel the Google chooser, and disconnect the network to check the corresponding error messages.
- Add items before sign-in and verify they merge once into `users/{uid}/cart`; refresh and sign in again to ensure quantities do not duplicate.
- Verify one user's token cannot read another user's `users/{uid}` document, cart, wishlist, or order references; verify a normal user cannot write product/category/coupon data or change their role.
- Grant an admin claim, refresh the token, verify `/api/firebase-admin/whoami` succeeds, and verify it returns 403 for a regular user. Confirm the existing `/admin` Supabase login still works.

The repository has no Firebase project credentials, so the live desktop/mobile OAuth checks must be run after completing the console and environment setup above.
