import {
  getRamashopAccountByUserId,
  getRamashopApiKeyForUser,
  getRamashopHistory,
} from "@/server/integrations/ramashop";
import { ensureDatabase, run } from "@/server/db";

type PayGateTransaction = {
  id: string;
  userId: string;
  depositId: string | null;
  type: string;
  amount: number;
  status: string;
  createdAt: number;
  updatedAt: number | null;
  raw: Record<string, unknown> | null;
};

function toTimestamp(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function parseRawPayload(value: unknown) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function pickArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const data = (payload as Record<string, unknown>).data;
  if (Array.isArray(data)) return data;

  if (data && typeof data === "object") {
    const dataRecord = data as Record<string, unknown>;
    const nestedData = dataRecord.data;
    if (nestedData && typeof nestedData === "object") {
      const nestedArray = pickArray(nestedData);
      if (nestedArray.length > 0) return nestedArray;
    }
    for (const key of ["items", "transactions", "history", "deposits", "withdrawals"]) {
      if (Array.isArray(dataRecord[key])) return dataRecord[key] as unknown[];
    }
  }

  for (const key of ["items", "transactions", "history", "deposits", "withdrawals"]) {
    const value = (payload as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value;
  }

  return [];
}

function normalizeRemoteTransaction(item: unknown, userId: string, index: number): PayGateTransaction {
  const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
  const depositId = record.depositId ?? record.deposit_id;
  const id = String(record.id ?? record.transactionId ?? depositId ?? `remote-${index}`);
  const amount = Number(record.amount ?? record.totalAmount ?? record.paidAmount ?? 0);

  return {
    id,
    userId,
    depositId: depositId ? String(depositId) : null,
    type: String(record.type ?? record.method ?? "history"),
    amount: Number.isFinite(amount) ? amount : 0,
    status: String(record.status ?? record.state ?? "pending"),
    createdAt: toTimestamp(record.createdAt ?? record.created_at ?? record.paidAt ?? record.date),
    updatedAt: record.updatedAt || record.updated_at ? toTimestamp(record.updatedAt ?? record.updated_at) : null,
    raw: record,
  };
}

function normalizeLocalTransaction(row: Record<string, unknown>): PayGateTransaction {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    depositId: row.deposit_id ? String(row.deposit_id) : null,
    type: String(row.type ?? "deposit"),
    amount: Number(row.amount ?? 0),
    status: String(row.status ?? "pending"),
    createdAt: Number(row.created_at ?? Date.now()),
    updatedAt: row.updated_at ? Number(row.updated_at) : null,
    raw: parseRawPayload(row.raw_payload),
  };
}

async function getLocalTransactions(userId: string, limit: number, type?: string) {
  await ensureDatabase();
  const whereType = type ? " AND lower(type) = lower(?)" : "";
  const args = type ? [userId, type, limit] : [userId, limit];
  const result = await run(
    `SELECT * FROM ramashop_transactions WHERE user_id = ?${whereType} ORDER BY created_at DESC LIMIT ?`,
    args,
  );

  return result.rows.map((row) => normalizeLocalTransaction(row as Record<string, unknown>));
}

export async function getPayGateAccount(userId: string) {
  try {
    const account = await getRamashopAccountByUserId(userId);
    if (!account) return null;
    return {
      id: account.id,
      userId: account.userId,
      username: account.ramashopUsername,
      email: account.ramashopEmail,
      apiKeyLastUsed: account.apiKeyLastUsed,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  } catch (error) {
    console.warn("Failed to load PayGate account:", error);
    return null;
  }
}

export async function getPayGateWithdrawals(userId: string, opts?: { limit?: number; cursor?: string }) {
  const items = await getLocalTransactions(userId, opts?.limit ?? 25, "withdrawal");
  return { items, nextCursor: null };
}

export async function getPayGateTransactions(userId: string, opts?: { limit?: number; cursor?: string }) {
  const limit = opts?.limit ?? 25;
  const remote = await getRamashopHistory(userId)
    .then((response) => pickArray(response.data).map((item, index) => normalizeRemoteTransaction(item, userId, index)))
    .catch(() => []);
  const local = await getLocalTransactions(userId, limit);

  const localByKey = new Map(local.map((item) => [item.depositId || item.id, item]));
  const merged = new Map<string, PayGateTransaction>();

  for (const item of remote) {
    const key = item.depositId || item.id;
    const localItem = localByKey.get(key);
    merged.set(key, {
      ...localItem,
      ...item,
      id: item.id,
      depositId: item.depositId || localItem?.depositId || null,
      raw: {
        ...(localItem?.raw ?? {}),
        ...(item.raw ?? {}),
      },
    });
  }

  for (const item of local) {
    const key = item.depositId || item.id;
    if (!merged.has(key)) merged.set(key, item);
  }

  await Promise.all(
    remote
      .filter((item) => item.depositId)
      .map((item) =>
        run(
          "UPDATE ramashop_transactions SET status = ?, raw_payload = ?, updated_at = ? WHERE user_id = ? AND deposit_id = ?",
          [item.status, JSON.stringify(merged.get(item.depositId!)?.raw ?? item.raw ?? {}), Date.now(), userId, item.depositId],
        ).catch(() => {}),
      ),
  );

  return {
    items: Array.from(merged.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit),
    nextCursor: null,
  };
}

export async function getPayGateDeposits(userId: string, opts?: { limit?: number; cursor?: string }) {
  const limit = opts?.limit ?? 25;
  const transactions = await getPayGateTransactions(userId, { limit });
  return {
    items: transactions.items.filter((item) => item.type.toLowerCase().includes("deposit")).slice(0, limit),
    nextCursor: null,
  };
}

export async function getPayGateApiKeys(userId: string) {
  const apiKey = await getRamashopApiKeyForUser(userId).catch(() => null);
  return apiKey ? [apiKey] : [];
}
