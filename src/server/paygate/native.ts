import crypto from "crypto";
import { ensureDatabase, run } from "@/server/db";

export const PAYGATE_QRIS_TTL_MINUTES = 15;

export type PayGateStore = {
  id: string;
  userId: string;
  slug: string;
  name: string;
  description: string;
  website: string;
  bannerUrl: string;
  logoUrl: string;
  theme: string;
  isActive: boolean;
  qrisName: string;
  staticQris: string;
  packageIds: string[];
  minAmount: number;
  maxAmount: number;
  allowCustomAmount: boolean;
  presetAmounts: number[];
  telegramChatId: string;
  webhookUrl: string;
  webhookSecret: string;
  createdAt: number;
  updatedAt: number;
};

export type PayGateProduct = {
  id: string;
  storeId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
};

export type PayGateNativeTransaction = {
  id: string;
  storeId: string;
  userId: string;
  productId: string | null;
  externalId: string;
  amount: number;
  totalAmount: number;
  uniqueCode: number;
  status: "pending" | "paid" | "cancel" | "expired";
  qrString: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  callbackUrl: string;
  rawPayload: Record<string, unknown>;
  expiredAt: number;
  paidAt: number | null;
  createdAt: number;
  updatedAt: number;
};

function now() {
  return Date.now();
}

function parseJsonArray(value: unknown, fallback: number[] | string[] = []) {
  try {
    const parsed = JSON.parse(String(value ?? ""));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseJsonRecord(value: unknown) {
  try {
    const parsed = JSON.parse(String(value ?? "{}"));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function normalizePayGateSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 30);
}

function mapStore(row: Record<string, unknown>): PayGateStore {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    slug: String(row.slug),
    name: String(row.name),
    description: String(row.description ?? ""),
    website: String(row.website ?? ""),
    bannerUrl: String(row.banner_url ?? ""),
    logoUrl: String(row.logo_url ?? ""),
    theme: String(row.theme ?? "light"),
    isActive: Number(row.is_active ?? 1) === 1,
    qrisName: String(row.qris_name ?? "QRIS Utama"),
    staticQris: String(row.static_qris ?? ""),
    packageIds: parseJsonArray(row.package_ids, []) as string[],
    minAmount: Number(row.min_amount ?? 1000),
    maxAmount: Number(row.max_amount ?? 10000000),
    allowCustomAmount: Number(row.allow_custom_amount ?? 1) === 1,
    presetAmounts: (parseJsonArray(row.preset_amounts, [10000, 25000, 50000, 100000]) as unknown[])
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0),
    telegramChatId: String(row.telegram_chat_id ?? ""),
    webhookUrl: String(row.webhook_url ?? ""),
    webhookSecret: String(row.webhook_secret ?? ""),
    createdAt: Number(row.created_at ?? now()),
    updatedAt: Number(row.updated_at ?? now()),
  };
}

function mapProduct(row: Record<string, unknown>): PayGateProduct {
  return {
    id: String(row.id),
    storeId: String(row.store_id),
    name: String(row.name),
    description: String(row.description ?? ""),
    price: Number(row.price ?? 0),
    imageUrl: String(row.image_url ?? ""),
    isActive: Number(row.is_active ?? 1) === 1,
    createdAt: Number(row.created_at ?? now()),
    updatedAt: Number(row.updated_at ?? now()),
  };
}

function mapTransaction(row: Record<string, unknown>): PayGateNativeTransaction {
  return {
    id: String(row.id),
    storeId: String(row.store_id),
    userId: String(row.user_id),
    productId: row.product_id ? String(row.product_id) : null,
    externalId: String(row.external_id ?? ""),
    amount: Number(row.amount ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    uniqueCode: Number(row.unique_code ?? 0),
    status: String(row.status ?? "pending") as PayGateNativeTransaction["status"],
    qrString: String(row.qr_string ?? ""),
    customerName: String(row.customer_name ?? ""),
    customerEmail: String(row.customer_email ?? ""),
    customerPhone: String(row.customer_phone ?? ""),
    callbackUrl: String(row.callback_url ?? ""),
    rawPayload: parseJsonRecord(row.raw_payload),
    expiredAt: Number(row.expired_at ?? now()),
    paidAt: row.paid_at ? Number(row.paid_at) : null,
    createdAt: Number(row.created_at ?? now()),
    updatedAt: Number(row.updated_at ?? now()),
  };
}

function crc16Ccitt(input: string) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function readTlv(input: string) {
  const tags: { id: string; length: number; value: string; raw: string }[] = [];
  let index = 0;
  while (index + 4 <= input.length) {
    const id = input.slice(index, index + 2);
    const length = Number(input.slice(index + 2, index + 4));
    if (!Number.isFinite(length) || length < 0) break;
    const start = index + 4;
    const value = input.slice(start, start + length);
    if (value.length !== length) break;
    tags.push({ id, length, value, raw: input.slice(index, start + length) });
    index = start + length;
  }
  return tags;
}

function encodeTag(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

export function makeDynamicQris(staticQris: string, amount: number) {
  const clean = staticQris.trim();
  if (!clean.startsWith("000201")) throw new Error("Format QRIS statis tidak valid.");
  const body = clean.replace(/6304[0-9A-Fa-f]{4}$/, "");
  const tags = readTlv(body).filter((tag) => tag.id !== "54" && tag.id !== "63");
  const total = Math.round(amount);
  if (!Number.isFinite(total) || total <= 0) throw new Error("Nominal QRIS tidak valid.");

  const out: string[] = [];
  let insertedAmount = false;
  for (const tag of tags) {
    if (tag.id === "01") {
      out.push(encodeTag("01", "12"));
      continue;
    }
    if (!insertedAmount && Number(tag.id) > 53) {
      out.push(encodeTag("54", String(total)));
      insertedAmount = true;
    }
    out.push(tag.raw);
  }
  if (!insertedAmount) out.push(encodeTag("54", String(total)));
  const withoutCrc = `${out.join("")}6304`;
  return `${withoutCrc}${crc16Ccitt(withoutCrc)}`;
}

export async function ensurePayGateStore(user: { id: string; username?: string | null; email?: string | null }) {
  await ensureDatabase();
  const existing = await run("SELECT * FROM paygate_stores WHERE user_id = ? LIMIT 1", [user.id]);
  if (existing.rows[0]) return mapStore(existing.rows[0] as Record<string, unknown>);

  const id = crypto.randomUUID();
  const base = normalizePayGateSlug(user.username || user.email?.split("@")[0] || "toko");
  let slug = base || `toko-${id.slice(0, 6)}`;
  for (let attempt = 1; attempt < 20; attempt += 1) {
    const found = await run("SELECT id FROM paygate_stores WHERE slug = ? LIMIT 1", [slug]);
    if (!found.rows[0]) break;
    slug = `${base}-${attempt + 1}`.slice(0, 30);
  }
  const ts = now();
  await run(
    `INSERT INTO paygate_stores
      (id, user_id, slug, name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, user.id, slug, user.username || "Toko PayGate", ts, ts],
  );
  const row = await run("SELECT * FROM paygate_stores WHERE id = ? LIMIT 1", [id]);
  return mapStore(row.rows[0] as Record<string, unknown>);
}

export async function getPayGateStoreByUser(userId: string) {
  await ensureDatabase();
  const res = await run("SELECT * FROM paygate_stores WHERE user_id = ? LIMIT 1", [userId]);
  return res.rows[0] ? mapStore(res.rows[0] as Record<string, unknown>) : null;
}

export async function getPayGateStoreBySlug(slug: string) {
  await ensureDatabase();
  const res = await run("SELECT * FROM paygate_stores WHERE slug = ? AND is_active = 1 LIMIT 1", [normalizePayGateSlug(slug)]);
  return res.rows[0] ? mapStore(res.rows[0] as Record<string, unknown>) : null;
}

export async function updatePayGateStore(userId: string, input: Partial<PayGateStore>) {
  const store = await getPayGateStoreByUser(userId);
  if (!store) throw new Error("Store PayGate tidak ditemukan.");
  const slug = input.slug ? normalizePayGateSlug(input.slug) : store.slug;
  if (!slug) throw new Error("Slug toko tidak valid.");
  const ts = now();
  await run(
    `UPDATE paygate_stores SET
      slug = ?, name = ?, description = ?, website = ?, banner_url = ?, logo_url = ?, theme = ?,
      is_active = ?, qris_name = ?, static_qris = ?, package_ids = ?, min_amount = ?, max_amount = ?,
      allow_custom_amount = ?, preset_amounts = ?, telegram_chat_id = ?, webhook_url = ?, webhook_secret = ?, updated_at = ?
     WHERE user_id = ?`,
    [
      slug,
      input.name ?? store.name,
      input.description ?? store.description,
      input.website ?? store.website,
      input.bannerUrl ?? store.bannerUrl,
      input.logoUrl ?? store.logoUrl,
      input.theme ?? store.theme,
      input.isActive ?? store.isActive ? 1 : 0,
      input.qrisName ?? store.qrisName,
      input.staticQris ?? store.staticQris,
      JSON.stringify(input.packageIds ?? store.packageIds),
      Math.max(1, Number(input.minAmount ?? store.minAmount)),
      Math.max(1, Number(input.maxAmount ?? store.maxAmount)),
      input.allowCustomAmount ?? store.allowCustomAmount ? 1 : 0,
      JSON.stringify(input.presetAmounts ?? store.presetAmounts),
      input.telegramChatId ?? store.telegramChatId,
      input.webhookUrl ?? store.webhookUrl,
      input.webhookSecret ?? store.webhookSecret,
      ts,
      userId,
    ],
  );
  return getPayGateStoreByUser(userId);
}

export async function listPayGateProducts(storeId: string, includeInactive = false) {
  await ensureDatabase();
  const res = await run(
    `SELECT * FROM paygate_products WHERE store_id = ?${includeInactive ? "" : " AND is_active = 1"} ORDER BY created_at DESC`,
    [storeId],
  );
  return res.rows.map((row) => mapProduct(row as Record<string, unknown>));
}

export async function upsertPayGateProduct(storeId: string, input: Partial<PayGateProduct> & { id?: string }) {
  await ensureDatabase();
  const id = input.id || crypto.randomUUID();
  const ts = now();
  const existing = input.id ? await run("SELECT id FROM paygate_products WHERE id = ? AND store_id = ?", [input.id, storeId]) : null;
  if (existing?.rows[0]) {
    await run(
      `UPDATE paygate_products SET name = ?, description = ?, price = ?, image_url = ?, is_active = ?, updated_at = ? WHERE id = ? AND store_id = ?`,
      [input.name || "Produk", input.description || "", Number(input.price || 0), input.imageUrl || "", input.isActive === false ? 0 : 1, ts, id, storeId],
    );
  } else {
    await run(
      `INSERT INTO paygate_products (id, store_id, name, description, price, image_url, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, storeId, input.name || "Produk", input.description || "", Number(input.price || 0), input.imageUrl || "", input.isActive === false ? 0 : 1, ts, ts],
    );
  }
  const res = await run("SELECT * FROM paygate_products WHERE id = ? LIMIT 1", [id]);
  return mapProduct(res.rows[0] as Record<string, unknown>);
}

export function hashApiKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function createNativeApiKey(userId: string, name = "Default") {
  await ensureDatabase();
  const key = `pg_live_${crypto.randomBytes(24).toString("hex")}`;
  const ts = now();
  const id = crypto.randomUUID();
  await run(
    `INSERT INTO paygate_api_keys (id, user_id, name, key_hash, prefix, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId, name, hashApiKey(key), key.slice(0, 12), ts],
  );
  return { id, name, key, maskedKey: `${key.slice(0, 12)}...${key.slice(-4)}`, requestCount: 0, lastUsed: null };
}

export async function listNativeApiKeys(userId: string) {
  await ensureDatabase();
  const res = await run(
    "SELECT * FROM paygate_api_keys WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC",
    [userId],
  );
  return res.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    maskedKey: `${String(row.prefix)}...`,
    requestCount: Number(row.request_count ?? 0),
    lastUsed: row.last_used_at ? Number(row.last_used_at) : null,
  }));
}

export async function authenticateNativeApiKey(key: string) {
  await ensureDatabase();
  const keyHash = hashApiKey(key);
  const res = await run("SELECT * FROM paygate_api_keys WHERE key_hash = ? AND revoked_at IS NULL LIMIT 1", [keyHash]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  await run("UPDATE paygate_api_keys SET request_count = request_count + 1, last_used_at = ? WHERE id = ?", [now(), String(row.id)]);
  const store = await getPayGateStoreByUser(String(row.user_id));
  return store ? { userId: String(row.user_id), store } : null;
}

export async function createPayGateTransaction(params: {
  store: PayGateStore;
  amount: number;
  productId?: string | null;
  externalId?: string;
  useUniqueCode?: boolean;
  expiredInMinutes?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  callbackUrl?: string;
}) {
  if (!params.store.staticQris) throw new Error("QRIS statis toko belum diisi.");
  const amount = Math.round(Number(params.amount));
  if (!Number.isFinite(amount) || amount < params.store.minAmount || amount > params.store.maxAmount) {
    throw new Error(`Nominal harus di antara ${params.store.minAmount} dan ${params.store.maxAmount}.`);
  }
  const uniqueCode = params.useUniqueCode === false ? 0 : crypto.randomInt(1, 999);
  const totalAmount = amount + uniqueCode;
  const qrString = makeDynamicQris(params.store.staticQris, totalAmount);
  const ts = now();
  const expiredAt = ts + Math.max(1, Number(params.expiredInMinutes ?? PAYGATE_QRIS_TTL_MINUTES)) * 60 * 1000;
  const id = `PG-${crypto.randomUUID()}`;
  await run(
    `INSERT INTO paygate_transactions
      (id, store_id, user_id, product_id, external_id, amount, total_amount, unique_code, status, qr_string,
       customer_name, customer_email, customer_phone, callback_url, raw_payload, expired_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, '{}', ?, ?, ?)`,
    [
      id,
      params.store.id,
      params.store.userId,
      params.productId ?? null,
      params.externalId ?? "",
      amount,
      totalAmount,
      uniqueCode,
      qrString,
      params.customerName ?? "",
      params.customerEmail ?? "",
      params.customerPhone ?? "",
      params.callbackUrl ?? "",
      expiredAt,
      ts,
      ts,
    ],
  );
  const trx = await getPayGateTransaction(id);
  await notifyTelegram(params.store, `Transaksi dibuat\nID: ${id}\nNominal: Rp ${totalAmount.toLocaleString("id-ID")}`).catch(() => {});
  return trx!;
}

export async function getPayGateTransaction(id: string) {
  await ensureDatabase();
  const res = await run("SELECT * FROM paygate_transactions WHERE id = ? LIMIT 1", [id]);
  const trx = res.rows[0] ? mapTransaction(res.rows[0] as Record<string, unknown>) : null;
  if (trx && trx.status === "pending" && trx.expiredAt <= now()) {
    await run("UPDATE paygate_transactions SET status = 'expired', updated_at = ? WHERE id = ?", [now(), id]);
    return { ...trx, status: "expired" as const, updatedAt: now() };
  }
  return trx;
}

export async function listPayGateTransactions(userId: string, limit = 50) {
  await ensureDatabase();
  const res = await run("SELECT * FROM paygate_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?", [
    userId,
    Math.min(Math.max(limit, 1), 100),
  ]);
  return res.rows.map((row) => mapTransaction(row as Record<string, unknown>));
}

export async function markPayGateTransactionPaid(payload: {
  transactionId: string;
  amount?: number;
  packageName?: string;
  appName?: string;
  paidAt?: string;
  raw?: Record<string, unknown>;
}) {
  const trx = await getPayGateTransaction(payload.transactionId);
  if (!trx) throw new Error("Transaksi tidak ditemukan.");
  const paidAmount = Math.round(Number(payload.amount ?? trx.totalAmount));
  if (paidAmount !== trx.totalAmount) throw new Error("Nominal pembayaran tidak cocok.");
  const paidAt = payload.paidAt ? Date.parse(payload.paidAt) : now();
  await run(
    "UPDATE paygate_transactions SET status = 'paid', paid_at = ?, raw_payload = ?, updated_at = ? WHERE id = ?",
    [Number.isFinite(paidAt) ? paidAt : now(), JSON.stringify(payload.raw ?? payload), now(), trx.id],
  );
  const store = (await run("SELECT * FROM paygate_stores WHERE id = ? LIMIT 1", [trx.storeId])).rows[0];
  if (store) {
    const mapped = mapStore(store as Record<string, unknown>);
    await notifyTelegram(mapped, `Pembayaran diterima\nID: ${trx.id}\nNominal: Rp ${trx.totalAmount.toLocaleString("id-ID")}`).catch(() => {});
    await callMerchantWebhook(mapped, { ...trx, status: "paid", paidAt: Number.isFinite(paidAt) ? paidAt : now() }).catch(() => {});
  }
  return getPayGateTransaction(trx.id);
}

export function signPayload(rawBody: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function timingSafeSignature(rawBody: string, secret: string, signature: string) {
  const expected = signPayload(rawBody, secret);
  const a = Buffer.from(signature || "", "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function notifyTelegram(store: PayGateStore, text: string) {
  const token = process.env.PAYGATE_TELEGRAM_BOT_TOKEN?.trim();
  const chatId = store.telegramChatId || process.env.PAYGATE_TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: `[PayGate] ${store.name}\n${text}` }),
  });
}

async function callMerchantWebhook(store: PayGateStore, trx: PayGateNativeTransaction) {
  if (!store.webhookUrl || !store.webhookSecret) return;
  const payload = {
    transactionId: trx.id,
    amount: trx.totalAmount,
    status: trx.status,
    paidAt: trx.paidAt ? new Date(trx.paidAt).toISOString() : new Date().toISOString(),
  };
  const rawBody = JSON.stringify(payload);
  await fetch(store.webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PayGate-Signature": signPayload(rawBody, store.webhookSecret),
    },
    body: rawBody,
  });
}
