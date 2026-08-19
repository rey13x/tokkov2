import { getFirebaseFirestore } from "../firebase-admin";
import { getServerAuthSession } from "../auth";
import { randomBytes, createHash } from "crypto";
import type { NextRequest } from "next/server";

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 20; // per window per user
const rateMap = new Map<string, { ts: number; count: number }>();

function assertTestMode() {
  const enabled = process.env.PAYGATE_TEST_MODE === "true" || process.env.NODE_ENV !== "production";
  if (!enabled) {
    const err = new Error("TEST_MODE_ONLY") as { status?: number };
    err.status = 403;
    throw err;
  }
}

function assertRateLimit(uid: string) {
  const now = Date.now();
  const entry = rateMap.get(uid);
  if (!entry || now - entry.ts > RATE_LIMIT_WINDOW_MS) {
    rateMap.set(uid, { ts: now, count: 1 });
    return;
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    const err = new Error("RATE_LIMIT_EXCEEDED") as { status?: number };
    err.status = 429;
    throw err;
  }
}

function validateAmount(amount: unknown, max = 10_000_000) {
  if (typeof amount !== "number") throw new Error("AMOUNT_MUST_BE_NUMBER");
  if (!Number.isInteger(amount)) throw new Error("AMOUNT_MUST_BE_INTEGER");
  if (amount <= 0) throw new Error("AMOUNT_MUST_BE_POSITIVE");
  if (amount > max) throw new Error("AMOUNT_EXCEEDS_MAX");
}

function generateId(prefix: string) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

async function getUidFromRequest() {
  const session = await getServerAuthSession();
  if (!session || !session.user || !session.user.id) {
    const err = new Error("UNAUTHENTICATED") as { status?: number };
    err.status = 401;
    throw err;
  }
  return session.user.id;
}

export async function createTestTransaction({ req }: { req: NextRequest }) {
  assertTestMode();
  const uid = await getUidFromRequest();
  assertRateLimit(uid);

  const body = await req.json().catch(() => ({}));
  const amount = body.amount;
  const customer = String(body.customer || "").trim();
  const description = body.description ? String(body.description).trim() : null;

  try {
    validateAmount(amount);
  } catch (e: unknown) {
    const ve = new Error("VALIDATION_ERROR") as { status?: number; info?: string };
    ve.status = 400;
    ve.info = (e as Error).message;
    throw ve;
  }
  if (!customer) {
    const ve = new Error("VALIDATION_ERROR") as { status?: number; info?: string };
    ve.status = 400;
    ve.info = "customer_required";
    throw ve;
  }

  const firestore = getFirebaseFirestore();
  const txnId = generateId("txn_test");
  const now = new Date().toISOString();
  const doc = {
    id: txnId,
    userId: uid,
    amount,
    customer,
    description,
    status: "success",
    environment: "test",
    isTest: true,
    createdAt: now,
  } as const;

  await firestore.collection("transactions").doc(txnId).set(doc);
  await firestore.collection("paygateAuditLogs").add({ userId: uid, action: "TEST_TRANSACTION_CREATED", timestamp: now, environment: "test" });

  return doc;
}

export async function createTestDeposit({ req }: { req: NextRequest }) {
  assertTestMode();
  const uid = await getUidFromRequest();
  assertRateLimit(uid);
  const body = await req.json().catch(() => ({}));
  const amount = body.amount;
  try {
    validateAmount(amount);
  } catch (e: unknown) {
    const ve = new Error("VALIDATION_ERROR") as { status?: number; info?: string };
    ve.status = 400;
    ve.info = (e as Error).message;
    throw ve;
  }

  const firestore = getFirebaseFirestore();
  const id = generateId("dep_test");
  const now = new Date().toISOString();
  const doc = { id, userId: uid, amount, status: "success", environment: "test", isTest: true, createdAt: now } as const;
  await firestore.collection("deposits").doc(id).set(doc);
  await firestore.collection("paygateAuditLogs").add({ userId: uid, action: "TEST_DEPOSIT_CREATED", timestamp: now, environment: "test" });
  return doc;
}

export async function createTestWithdrawal({ req }: { req: NextRequest }) {
  assertTestMode();
  const uid = await getUidFromRequest();
  assertRateLimit(uid);
  const body = await req.json().catch(() => ({}));
  const amount = body.amount;
  const bank = String(body.bank || "").trim();
  const accountNumber = String(body.accountNumber || "").trim();
  const accountName = String(body.accountName || "").trim();

  try {
    validateAmount(amount);
  } catch (e: unknown) {
    const ve = new Error("VALIDATION_ERROR") as { status?: number; info?: string };
    ve.status = 400;
    ve.info = (e as Error).message;
    throw ve;
  }
  if (!bank || !accountNumber || !accountName) {
    const ve = new Error("VALIDATION_ERROR") as { status?: number; info?: string };
    ve.status = 400;
    ve.info = "bank_account_required";
    throw ve;
  }

  const firestore = getFirebaseFirestore();
  const id = generateId("wd_test");
  const now = new Date().toISOString();
  const doc = { id, userId: uid, amount, bank, accountNumber: accountNumber.replace(/\s+/g, ""), accountName, status: "pending", environment: "test", isTest: true, createdAt: now } as const;
  await firestore.collection("withdrawals").doc(id).set(doc);
  await firestore.collection("paygateAuditLogs").add({ userId: uid, action: "TEST_WITHDRAWAL_CREATED", timestamp: now, environment: "test" });
  return doc;
}

export async function createTestApiKey({ req }: { req: NextRequest }) {
  assertTestMode();
  const uid = await getUidFromRequest();
  assertRateLimit(uid);
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name || name.length > 200) {
    const ve = new Error("VALIDATION_ERROR") as { status?: number; info?: string };
    ve.status = 400;
    ve.info = "invalid_name";
    throw ve;
  }

  const firestore = getFirebaseFirestore();
  const id = generateId("pk_test");
  // generate secret and hash
  const secret = `sk_test_${randomBytes(24).toString("hex")}`;
  const hash = hashSecret(secret);
  const prefix = id.split("_")[1].slice(0, 6);
  const now = new Date().toISOString();

  const record = { id, prefix, hash, name, userId: uid, environment: "test", status: "active", createdAt: now, lastUsedAt: null } as const;
  await firestore.collection("apiKeys").doc(id).set(record);
  await firestore.collection("paygateAuditLogs").add({ userId: uid, action: "TEST_API_KEY_CREATED", timestamp: now, environment: "test" });

  // Return the plaintext secret only once
  return { id, secret, prefix };
}

export async function revokeTestApiKey({ params }: { params: { keyId: string } }) {
  assertTestMode();
  const uid = await getUidFromRequest();
  assertRateLimit(uid);
  const keyId = params.keyId;
  if (!keyId) {
    const ve = new Error("INVALID_REQUEST") as { status?: number };
    ve.status = 400;
    throw ve;
  }
  const firestore = getFirebaseFirestore();
  const doc = await firestore.collection("apiKeys").doc(keyId).get();
  if (!doc.exists) {
    const ve = new Error("NOT_FOUND") as { status?: number };
    ve.status = 404;
    throw ve;
  }
  const data = doc.data() as { userId?: string } | undefined;
  if (data?.userId !== uid) {
    const ve = new Error("FORBIDDEN") as { status?: number };
    ve.status = 403;
    throw ve;
  }
  await firestore.collection("apiKeys").doc(keyId).update({ status: "revoked", lastUsedAt: new Date().toISOString() });
  await firestore.collection("paygateAuditLogs").add({ userId: uid, action: "TEST_API_KEY_REVOKED", timestamp: new Date().toISOString(), environment: "test" });
  return { id: keyId, status: "revoked" };
}

export { assertTestMode as assertPayGateTestMode };
