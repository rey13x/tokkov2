/**
 * Firebase Admin SDK - Disabled
 * 
 * To re-enable Firebase integration, configure these environment variables:
 * 
 * Option 1: Service Account JSON (RECOMMENDED)
 *   export FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","...'
 * 
 * Option 2: Service Account Base64
 *   export FIREBASE_SERVICE_ACCOUNT_BASE64='base64-encoded-service-account'
 * 
 * Option 3: Service Account File
 *   Place service-account.json in project root
 * 
 * Option 4: Individual environment variables
 *   export FIREBASE_PROJECT_ID='your-project-id'
 *   export FIREBASE_CLIENT_EMAIL='service-account@project.iam.gserviceaccount.com'
 *   export FIREBASE_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----...'
 */

export const ADMIN_SESSION_COOKIE = "tokko-admin-session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;

/**
 * Get Firebase Admin App instance
 * Returns null when Firebase is not configured
 */
export function getFirebaseAdminApp() {
  console.warn("Firebase Admin is not configured. Using local database only.");
  return null;
}

/**
 * Get Firestore database instance
 * Returns null when Firebase is not configured
 */
export function getFirebaseFirestore() {
  return null;
}

/**
 * Get Firebase Storage bucket
 * Returns null when Firebase is not configured
 */
export function getFirebaseStorageBucket() {
  return null;
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
