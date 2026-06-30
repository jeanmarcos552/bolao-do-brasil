import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let cachedApp: App | undefined;
function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  const existing = getApps();
  cachedApp = existing.length
    ? existing[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          // a private key vem com \n escapados nas env vars
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
  return cachedApp;
}

let cachedDb: Firestore | undefined;
let cachedAuth: Auth | undefined;
function db(): Firestore {
  return (cachedDb ??= getFirestore(getAdminApp()));
}
function authImpl(): Auth {
  return (cachedAuth ??= getAuth(getAdminApp()));
}

// Proxies lazily initialize on first property access, so merely importing this
// module has no side effects — build and tests don't need real credentials.
export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_target, prop) {
    const real = db() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});
export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    const real = authImpl() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export { Timestamp };
