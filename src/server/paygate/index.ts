import crypto from "crypto";
import { hash as bcryptHash } from "bcryptjs";
import { getFirebaseFirestore } from "@/server/firebase-admin";
import type { firestore } from "firebase-admin";

const ACCOUNT_PREFIX = "PG_";
const KEY_PREFIX = "tk_live_";

function generateAccountId() {
  return ACCOUNT_PREFIX + crypto.randomUUID().replaceAll("-", "").slice(0, 24);
}

function generateRawApiKey() {
  // 32 bytes -> 64 hex chars, secure
  return KEY_PREFIX + crypto.randomBytes(32).toString("hex");
}

export async function provisionPayGateForUser(userId: string) {
  const firestore = getFirebaseFirestore() as unknown as firestore.Firestore | null;
  if (!firestore) {
    return { ok: false, reason: "firebase_not_configured" } as const;
  }

  // Check existing account by userId
  try {
    const existingQuery = await firestore.collection("paygateAccounts").where("userId", "==", userId).limit(1).get();
    if (!existingQuery.empty) {
      const doc = existingQuery.docs[0];
      return { ok: true, created: false, account: { id: doc.id, ...doc.data() } } as const;
    }

    // Perform transactionally to avoid races
    const accountId = generateAccountId();
    const keyId = "KEY_" + crypto.randomUUID().replaceAll("-", "").slice(0, 24);
    const rawKey = generateRawApiKey();
    const keyHash = await bcryptHash(rawKey, 10);

    const accountRef = firestore.collection("paygateAccounts").doc(accountId);
    const apiKeyRef = firestore.collection("apiKeys").doc(keyId);

    await firestore.runTransaction(async (tx: firestore.Transaction) => {
      // Re-check inside transaction
      const q = firestore.collection("paygateAccounts").where("userId", "==", userId).limit(1) as firestore.Query<firestore.DocumentData>;
      const qsnap = await tx.get(q);
      if (!qsnap.empty) {
        // Someone else created it
        return;
      }

      const now = new Date().toISOString();

      tx.set(accountRef, {
        accountId,
        userId,
        status: "active",
        currency: "IDR",
        balance: 0,
        createdAt: now,
        updatedAt: now,
      });

      tx.set(apiKeyRef, {
        keyId,
        userId,
        accountId,
        keyPrefix: rawKey.slice(0, 12),
        keyHash,
        status: "active",
        createdAt: now,
        lastUsedAt: null,
        requestCount: 0,
      });
    });

    // Return the raw key for one-time display from server call (do not log)
    return {
      ok: true,
      created: true,
      account: {
        accountId,
        userId,
        status: "active",
        currency: "IDR",
        balance: 0,
      },
      apiKey: rawKey,
    } as const;
  } catch (error) {
    console.error("PayGate provisioning failed:", error);
    return { ok: false, reason: "error" } as const;
  }
}

export function generateUniqueCode(mod = 1000) {
  // Return a small integer unique code; caller must ensure collision handling
  return crypto.randomInt(1, mod);
}
