import * as fs from "fs";
import * as path from "path";

export const ADMIN_SESSION_COOKIE = "tokko-admin-session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;

let _adminApp: any = null;
let _firestore: any = null;
let _storage: any = null;
let _initialized = false;

function initializeFirebase() {
  if (_initialized) return;
  _initialized = true;

  try {
    // Dynamically require firebase-admin to handle CommonJS compatibility
    const admin = require("firebase-admin");
    
    // Try to load service account from file or environment
    let serviceAccountJson: any = null;

    // Check environment variables
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      serviceAccountJson = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      serviceAccountJson = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString()
      );
    } else if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      // Support individual env variables
      serviceAccountJson = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "",
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID || "",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      };
    } else {
      // Try to load from file
      const serviceAccountPath = path.join(process.cwd(), "service-account.json");
      if (fs.existsSync(serviceAccountPath)) {
        serviceAccountJson = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
      }
    }

    if (!serviceAccountJson) {
      console.warn("Firebase Admin is not configured. Using local database only.");
      return;
    }

    // Initialize Firebase - try to get existing app, otherwise create new one
    try {
      _adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountJson),
        storageBucket: `${serviceAccountJson.project_id}.appspot.com`,
      });
    } catch (initError: any) {
      // App already initialized, get the default app
      if (initError.code === "app/duplicate-app") {
        _adminApp = admin.app();
      } else {
        throw initError;
      }
    }

    _firestore = admin.firestore();
    _storage = admin.storage();

    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
  }
}

/**
 * Get Firebase Admin App instance
 * Returns null when Firebase is not configured
 */
export function getFirebaseAdminApp() {
  initializeFirebase();
  return _adminApp;
}

/**
 * Get Firestore database instance
 * Returns null when Firebase is not configured
 */
export function getFirebaseFirestore() {
  initializeFirebase();
  return _firestore;
}

/**
 * Get Firebase Storage bucket
 * Returns null when Firebase is not configured
 */
export function getFirebaseStorageBucket() {
  initializeFirebase();
  return _storage;
}

/**
 * Check if user is a Firebase admin
 */
export function isFirebaseAdminUser() {
  return false;
}

/**
 * Create admin session from Firebase ID token
 * Returns error when Firebase is not configured
 */
export async function createAdminSessionFromIdToken(idToken?: string): Promise<
  | { ok: false; reason: "firebase_not_configured" | "not_admin" }
  | { ok: true; sessionCookie: string; decodedToken: { uid: string; email: string } }
> {
  return {
    ok: false as const,
    reason: "firebase_not_configured" as const,
  };
}

/**
 * Verify admin session cookie
 * Returns null when Firebase is not configured
 */
export async function verifyAdminSessionCookie(cookie?: string): Promise<{ uid: string; email: string } | null> {
  return null;
}
