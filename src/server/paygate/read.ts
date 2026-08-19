import { getFirebaseFirestore } from "@/server/firebase-admin";
import type { firestore } from "firebase-admin";

async function safeGetFirestore(): Promise<firestore.Firestore> {
  const firestoreDb = getFirebaseFirestore() as unknown as firestore.Firestore | null;
  if (!firestoreDb) {
    throw new Error("firebase_not_configured");
  }
  return firestoreDb;
}

export async function getPayGateAccount(userId: string) {
  const firestore = await safeGetFirestore();
  const q = firestore.collection("paygateAccounts").where("userId", "==", userId).limit(1);
  const snap = await q.get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data() as firestore.DocumentData;
  return { id: doc.id, ...data } as Record<string, unknown>;
}

export async function getPayGateTransactions(userId: string, opts?: { limit?: number }) {
  const firestore = await safeGetFirestore();
  const limit = opts?.limit ?? 25;
  const q = firestore
    .collection("transactions")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(limit);

  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as firestore.DocumentData) }));
}

export async function getPayGateApiKeys(userId: string) {
  const firestore = await safeGetFirestore();
  const q = firestore.collection("apiKeys").where("userId", "==", userId).orderBy("createdAt", "desc").limit(50);
  const snap = await q.get();
  // Mask sensitive fields before returning
  return snap.docs.map((d) => {
    const data = d.data() as firestore.DocumentData;
    return {
      id: d.id,
      keyPrefix: (data.keyPrefix as string) ?? null,
      createdAt: (data.createdAt as string) ?? null,
      lastUsedAt: (data.lastUsedAt as string) ?? null,
      status: (data.status as string) ?? null,
    };
  });
}

export async function getPayGateDeposits(userId: string, opts?: { limit?: number }) {
  const firestore = await safeGetFirestore();
  const limit = opts?.limit ?? 25;
  const q = firestore
    .collection("deposits")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(limit);
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as firestore.DocumentData) }));
}

export async function getPayGateWithdrawals(userId: string, opts?: { limit?: number }) {
  const firestore = await safeGetFirestore();
  const limit = opts?.limit ?? 25;
  const q = firestore
    .collection("withdrawals")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(limit);
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as firestore.DocumentData) }));
}
