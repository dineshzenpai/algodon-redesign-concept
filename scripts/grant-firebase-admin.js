import 'dotenv/config';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run grant:firebase-admin -- admin@example.com');
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const credential = clientEmail && privateKey
  ? cert({ projectId, clientEmail, privateKey })
  : applicationDefault();
const app = getApps()[0] || initializeApp({ credential, projectId });
const adminAuth = getAuth(app);

try {
  const user = await adminAuth.getUserByEmail(email);
  await adminAuth.setCustomUserClaims(user.uid, { ...user.customClaims, admin: true, role: 'admin' });
  console.log(`Granted Firebase admin claim to ${email} (${user.uid}). The user must refresh their ID token or sign in again.`);
} catch (error) {
  console.error(`Could not grant admin claim: ${error.message}`);
  process.exitCode = 1;
}
