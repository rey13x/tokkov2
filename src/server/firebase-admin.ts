import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

export const ADMIN_SESSION_COOKIE = "tokko-admin-session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, "\n");
}

function getFirebaseAdminApp(): App | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: normalizePrivateKey(privateKey),
    }),
  });
}

function getAllowedAdminEmails() {
  return (process.env.FIREBASE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isFirebaseAdminUser(decodedToken: DecodedIdToken) {
  const claims = decodedToken as DecodedIdToken & {
    admin?: boolean;
    role?: string;
  };

  if (claims.admin === true || claims.role === "admin") {
    return true;
  }

  const allowedEmails = getAllowedAdminEmails();
  if (allowedEmails.length === 0) {
    return false;
  }

  const email = decodedToken.email?.toLowerCase();
  return Boolean(email && allowedEmails.includes(email));
}

export async function createAdminSessionFromIdToken(idToken: string) {
  const app = getFirebaseAdminApp();
  if (!app) {
    return {
      ok: false as const,
      reason: "firebase_not_configured" as const,
    };
  }

  const auth = getAuth(app);
  const decodedToken = await auth.verifyIdToken(idToken, true);
  if (!isFirebaseAdminUser(decodedToken)) {
    return {
      ok: false as const,
      reason: "not_admin" as const,
    };
  }

  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
  });

  return {
    ok: true as const,
    sessionCookie,
    decodedToken,
  };
}

export async function verifyAdminSessionCookie(sessionCookie: string) {
  const app = getFirebaseAdminApp();
  if (!app) {
    return null;
  }

  try {
    const auth = getAuth(app);
    const decodedToken = await auth.verifySessionCookie(sessionCookie, true);
    if (!isFirebaseAdminUser(decodedToken)) {
      return null;
    }

    return decodedToken;
  } catch {
    return null;
  }
}
