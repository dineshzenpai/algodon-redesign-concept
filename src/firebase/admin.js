import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { env } from '../config/env.js';

function adminAuth() {
  let app = getApps().find((item) => item.name === 'algodon-admin');
  if (!app) {
    const { firebase } = env;
    const credential = firebase.clientEmail && firebase.privateKey
      ? cert({ projectId: firebase.projectId, clientEmail: firebase.clientEmail, privateKey: firebase.privateKey })
      : applicationDefault();
    app = initializeApp({ credential, projectId: firebase.projectId }, 'algodon-admin');
  }
  return getAuth(app);
}

export function verifyFirebaseIdToken(token) {
  return adminAuth().verifyIdToken(token);
}

export async function requireFirebaseAuth(req, res, next) {
  try {
    const match = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '');
    if (!match) return res.status(401).json({ error: 'A Firebase ID token is required.' });
    req.user = await verifyFirebaseIdToken(match[1]);
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'The Firebase ID token is invalid or expired.' });
  }
}

export function requireFirebaseAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Firebase administrator access is required.' });
  }
  return next();
}
