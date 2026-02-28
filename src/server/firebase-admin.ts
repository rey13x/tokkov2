import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const ADMIN_SESSION_COOKIE = "tokko-admin-session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;
let didLogFirebaseInitError = false;
let didLogServiceAccountError = false;
let cachedServiceAccount: FirebaseServiceAccount | null | undefined;

type FirebaseServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function normalizeEnvValue(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function normalizePrivateKey(value: string) {
  return normalizeEnvValue(value)
    .replace(/\\\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\\r?\n/g, "\n");
}

function buildServiceAccount(input: {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
}): FirebaseServiceAccount | null {
  const projectId = input.projectId ? normalizeEnvValue(input.projectId) : "";
  const clientEmail = input.clientEmail ? normalizeEnvValue(input.clientEmail) : "";
  const privateKey = input.privateKey ? normalizePrivateKey(input.privateKey) : "";

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

function parseServiceAccountJson(raw: string): FirebaseServiceAccount | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return buildServiceAccount({
      projectId:
        typeof parsed.project_id === "string"
          ? parsed.project_id
          : typeof parsed.projectId === "string"
            ? parsed.projectId
            : "",
      clientEmail:
        typeof parsed.client_email === "string"
          ? parsed.client_email
          : typeof parsed.clientEmail === "string"
            ? parsed.clientEmail
            : "",
      privateKey:
        typeof parsed.private_key === "string"
          ? parsed.private_key
          : typeof parsed.privateKey === "string"
            ? parsed.privateKey
            : "",
    });
  } catch {
    return null;
  }
}

function resolveServiceAccountPath() {
  const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    ? normalizeEnvValue(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
    : "";

  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.join(process.cwd(), configuredPath);
  }

  return path.join(process.cwd(), "service-account.json");
}

function getFirebaseServiceAccount(): FirebaseServiceAccount | null {
  if (cachedServiceAccount !== undefined) {
    return cachedServiceAccount;
  }

  const directJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (directJson?.trim()) {
    const parsed = parseServiceAccountJson(directJson.trim());
    if (parsed) {
      cachedServiceAccount = parsed;
      return parsed;
    }
  }

  const base64Json = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (base64Json?.trim()) {
    try {
      const decoded = Buffer.from(base64Json.trim(), "base64").toString("utf8");
      const parsed = parseServiceAccountJson(decoded);
      if (parsed) {
        cachedServiceAccount = parsed;
        return parsed;
      }
    } catch {}
  }

  const serviceAccountPath = resolveServiceAccountPath();
  if (existsSync(serviceAccountPath)) {
    try {
      const raw = readFileSync(serviceAccountPath, "utf8");
      const parsed = parseServiceAccountJson(raw);
      if (parsed) {
        cachedServiceAccount = parsed;
        return parsed;
      }
    } catch {}
  }

  const fromFlatEnv = buildServiceAccount({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  });

  if (fromFlatEnv) {
    cachedServiceAccount = fromFlatEnv;
    return fromFlatEnv;
  }

  if (!didLogServiceAccountError) {
    console.error(
      "Firebase credentials not found. Use FIREBASE_SERVICE_ACCOUNT_JSON (recommended) or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.",
    );
    didLogServiceAccountError = true;
  }

  cachedServiceAccount = null;
  return null;
}

export function getFirebaseAdminApp(): App | null {
  const serviceAccount = getFirebaseServiceAccount();
  if (!serviceAccount) {
    return null;
  }

  try {
    if (getApps().length > 0) {
      return getApp();
    }

    return initializeApp({
      credential: cert({
        projectId: serviceAccount.projectId,
        clientEmail: serviceAccount.clientEmail,
        privateKey: serviceAccount.privateKey,
      }),
    });
  } catch (error) {
    if (!didLogFirebaseInitError) {
      console.error("Firebase Admin init failed. Falling back to local database.", error);
      didLogFirebaseInitError = true;
    }
    return null;
  }
}

export function getFirebaseFirestore() {
  const app = getFirebaseAdminApp();
  if (!app) {
    return null;
  }
  return getFirestore(app);
}

export function getFirebaseStorageBucket() {
  const app = getFirebaseAdminApp();
  if (!app) {
    return null;
  }

  const projectId = getFirebaseServiceAccount()?.projectId ?? "";
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET
    ? normalizeEnvValue(process.env.FIREBASE_STORAGE_BUCKET)
    : `${projectId}.appspot.com`;

  if (!bucketName) {
    return null;
  }

  return getStorage(app).bucket(bucketName);
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
