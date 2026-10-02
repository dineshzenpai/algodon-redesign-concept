// Firebase's public web configuration is served by Express from environment
// variables. The Admin SDK credentials are never returned to this module.
const response = await fetch('/api/firebase-config', { headers: { Accept: 'application/json' } });
if (!response.ok) {
  const result = await response.json().catch(() => ({}));
  const missing = Array.isArray(result.missing) ? result.missing : [];
  const message = missing.length
    ? `Firebase is not configured. Missing server environment variables: ${missing.join(', ')}.`
    : result.error || `Firebase configuration request failed (${response.status}).`;
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') console.error('[Firebase config]', message);
  throw new Error(message);
}
const firebaseConfig = await response.json();
const version = '12.19.0';
const [appSdk, authSdk, firestoreSdk, storageSdk] = await Promise.all([
  import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
  import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
  import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`),
  import(`https://www.gstatic.com/firebasejs/${version}/firebase-storage.js`)
]);

export const app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(firebaseConfig);
export const auth = authSdk.getAuth(app);
await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
export const db = firestoreSdk.getFirestore(app);
export const storage = storageSdk.getStorage(app);
export const sdk = { appSdk, authSdk, firestoreSdk, storageSdk };
export const googleProvider = new authSdk.GoogleAuthProvider();

export async function signInWithGoogle() {
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (mobile) return authSdk.signInWithRedirect(auth, googleProvider);
  try {
    return await authSdk.signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment') {
      window.dispatchEvent(new CustomEvent('firebase-auth-message', { detail: 'Your browser blocked the sign-in window. Continuing with Google redirect…' }));
      return authSdk.signInWithRedirect(auth, googleProvider);
    }
    throw error;
  }
}

export function logout() { return authSdk.signOut(auth); }
export function onAuthStateChanged(callback) { return authSdk.onAuthStateChanged(auth, callback); }
export function completeRedirect() { return authSdk.getRedirectResult(auth); }
export function getIdToken(forceRefresh = false) {
  if (!auth.currentUser) throw new Error('Sign in before calling a protected API.');
  return auth.currentUser.getIdToken(forceRefresh);
}
export async function firebaseApiFetch(path, options = {}) {
  const token = await getIdToken(); // Firebase refreshes an expired/near-expiry token.
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(path, { ...options, headers });
}
