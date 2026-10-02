import { auth, db, sdk, onAuthStateChanged, signInWithGoogle, logout, completeRedirect, firebaseApiFetch } from './firebase.js';

const state = { user: null, loading: true };
const listeners = new Set();
function publish() { listeners.forEach((listener) => listener({ ...state })); }

async function saveProfile(user) {
  const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = sdk.firestoreSdk;
  const profile = doc(db, 'users', user.uid);
  const existing = await getDoc(profile);
  if (!existing.exists()) {
    await setDoc(profile, {
      name: user.displayName || '', email: user.email || '', photoURL: user.photoURL || '',
      phone: '', role: 'customer', createdAt: serverTimestamp(), lastLoginAt: serverTimestamp()
    });
  } else {
    await updateDoc(profile, { lastLoginAt: serverTimestamp() });
  }
}

completeRedirect().catch((error) => console.error('[Firebase Auth] Redirect sign-in:', error));
onAuthStateChanged(async (user) => {
  state.user = user;
  state.loading = false;
  publish();
  if (user) {
    try { await saveProfile(user); }
    catch (error) { console.error('[Firebase Auth] Could not save user profile:', error); }
  }
});

export const AuthContext = Object.freeze({
  get user() { return state.user; },
  get loading() { return state.loading; },
  signInWithGoogle,
  logout,
  firebaseApiFetch,
  subscribe(listener) { listeners.add(listener); listener({ ...state }); return () => listeners.delete(listener); }
});

export function ProtectedRoute(path, user = state.user) {
  if (!user) {
    sessionStorage.setItem('algodon_return_to', path || window.location.pathname);
    window.location.assign('/?auth=required');
    return false;
  }
  return true;
}

const cartCollection = (uid) => sdk.firestoreSdk.collection(db, 'users', uid, 'cart');
const cartDocId = (item) => encodeURIComponent(`${item.id}__${item.size || ''}`).replaceAll('.', '%2E');

export async function mergeGuestCart(user, guestCart) {
  if (!user) return [];
  const { getDocs, setDoc, doc } = sdk.firestoreSdk;
  const ownerKey = 'algodon_firebase_cart_owner';
  const priorOwner = localStorage.getItem(ownerKey);
  const snapshot = await getDocs(cartCollection(user.uid));
  const cloud = new Map(snapshot.docs.map((entry) => [entry.id, entry.data()]));
  // Only add the browser cart once for a new account. Subsequent sign-ins use
  // the cloud cart as canonical, which avoids duplicating quantities on refresh.
  if (priorOwner !== user.uid) {
    for (const item of guestCart || []) {
      const id = cartDocId(item);
      const old = cloud.get(id);
      cloud.set(id, { ...item, qty: Number(item.qty || 0) + Number(old?.qty || 0), productId: String(item.id), size: item.size || '' });
    }
  }
  await Promise.all(Array.from(cloud, ([id, item]) => setDoc(doc(db, 'users', user.uid, 'cart', id), item)));
  localStorage.setItem(ownerKey, user.uid);
  const result = Array.from(cloud.values()).map((item) => ({ ...item, id: item.id || item.productId }));
  localStorage.setItem('algodon_demo_cart', JSON.stringify(result));
  return result;
}

export async function syncCartToCloud(user, cart) {
  if (!user) return;
  const { getDocs, setDoc, deleteDoc, doc } = sdk.firestoreSdk;
  const collection = cartCollection(user.uid);
  const snapshot = await getDocs(collection);
  const nextIds = new Set((cart || []).map(cartDocId));
  const tasks = (cart || []).map((item) => setDoc(doc(db, 'users', user.uid, 'cart', cartDocId(item)), {
    ...item, productId: String(item.id), size: item.size || ''
  }));
  snapshot.docs.forEach((entry) => { if (!nextIds.has(entry.id)) tasks.push(deleteDoc(entry.ref)); });
  await Promise.all(tasks);
}

export async function saveOrderReference(user, order) {
  if (!user || !order?.id) return;
  const { doc, setDoc, serverTimestamp } = sdk.firestoreSdk;
  await setDoc(doc(db, 'users', user.uid, 'orders', String(order.id)), {
    orderId: String(order.id), status: order.status || 'pending', total: Number(order.total || order.subtotal || 0),
    createdAt: order.createdAt || serverTimestamp()
  });
}

// `auth` is exported for backend-token refresh and integrations that need the
// underlying Firebase Auth instance; this is a vanilla-JS provider for this site.
export { auth };
