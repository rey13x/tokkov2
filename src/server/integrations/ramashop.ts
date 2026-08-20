import crypto from "crypto";
import { run, ensureDatabase } from "@/server/db";

const MASTER_KEY_ENV = "RAMASHOP_MASTER_KEY";
const RAMASHOP_DASHBOARD_URL = "https://ramashop.my.id/dashboard";

type JsonRecord = Record<string, unknown>;

function requireMasterKey() {
  const key = process.env[MASTER_KEY_ENV] || process.env.NEXTAUTH_SECRET;
  if (!key) throw new Error(`${MASTER_KEY_ENV} or NEXTAUTH_SECRET is not set`);
  return key;
}

function encryptApiKey(plain: string) {
  const master = requireMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", crypto.createHash("sha256").update(master).digest(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decryptApiKey(blob: string) {
  const master = requireMasterKey();
  const data = Buffer.from(blob, "base64");
  const iv = data.slice(0, 12);
  const tag = data.slice(12, 28);
  const encrypted = data.slice(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", crypto.createHash("sha256").update(master).digest(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

function maskApiKey(apiKey: string) {
  if (apiKey.length <= 12) return "********";
  return `${apiKey.slice(0, 6)}********${apiKey.slice(-6)}`;
}

export async function storeRamashopAccount(params: {
  userId: string;
  ramashopUsername: string;
  ramashopEmail: string;
  apiKey: string;
}) {
  await ensureDatabase();
  const id = crypto.randomUUID();
  const encrypted = encryptApiKey(params.apiKey);
  const now = Date.now();

  // If an entry for this user already exists, replace it
  const existing = await run("SELECT id FROM ramashop_accounts WHERE user_id = ? LIMIT 1", [params.userId]);
  if (existing.rows.length > 0) {
    const existingId = String(existing.rows[0].id);
    await run(
      `UPDATE ramashop_accounts SET ramashop_username = ?, ramashop_email = ?, encrypted_api_key = ?, updated_at = ?, api_key_last_used = ? WHERE id = ?`,
      [params.ramashopUsername, params.ramashopEmail, encrypted, now, now, existingId],
    );
    return existingId;
  }

  await run(
    `INSERT INTO ramashop_accounts (id, user_id, ramashop_username, ramashop_email, encrypted_api_key, api_key_last_used, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, params.userId, params.ramashopUsername, params.ramashopEmail, encrypted, now, now, now],
  );

  return id;
}

export async function getRamashopAccountByUserId(userId: string) {
  await ensureDatabase();
  const res = await run("SELECT * FROM ramashop_accounts WHERE user_id = ? LIMIT 1", [userId]);
  const row = res.rows[0] as JsonRecord | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    ramashopUsername: String(row.ramashop_username),
    ramashopEmail: String(row.ramashop_email),
    apiKeyEncrypted: String(row.encrypted_api_key),
    apiKeyLastUsed: row.api_key_last_used ? Number(row.api_key_last_used) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function getRamashopApiKeyForUser(userId: string) {
  const account = await getRamashopAccountByUserId(userId);
  if (!account) return null;
  const apiKey = decryptApiKey(account.apiKeyEncrypted);

  return {
    id: account.id,
    key: apiKey,
    maskedKey: maskApiKey(apiKey),
    requestCount: 0,
    lastUsed: account.apiKeyLastUsed,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export async function provisionRamashopAccount(opts: {
  name: string;
  email: string;
  userId: string;
  password: string;
  authMode?: "register" | "login";
}) {
  const remoteAccount = await registerOnRamashopAndFetchApiKey({
    username: opts.name,
    email: opts.email,
    password: opts.password,
    authMode: opts.authMode,
  });
  const accountId = await storeRamashopAccount({
    userId: opts.userId,
    ramashopUsername: remoteAccount.username,
    ramashopEmail: opts.email,
    apiKey: remoteAccount.apiKey,
  });

  return { accountId, maskedKey: maskApiKey(remoteAccount.apiKey) };
}

async function fillFirst(page: import("playwright").Page, selectors: string[], value: string) {
  for (const selector of selectors) {
    const input = page.locator(`${selector}:visible`).first();
    if ((await input.count().catch(() => 0)) === 0) continue;
    await input.fill(value, { timeout: 3000 }).catch(() => undefined);
    const currentValue = await input.inputValue({ timeout: 500 }).catch(() => "");
    if (currentValue.trim() === value.trim()) return true;
  }
  return false;
}

async function submitRamashopRegister(page: import("playwright").Page, opts: {
  username: string;
  email: string;
  password: string;
}) {
  await page.locator("#register-form").waitFor({ state: "visible", timeout: 2500 }).catch(async () => {
    await page.locator(".tabs button", { hasText: "Register" }).click({ timeout: 2500 });
  });
  const usernameFilled = await fillFirst(page, [
    "#reg-username",
    'input[placeholder="Username"]',
    'input[placeholder*="username" i]',
    'input[name="username"]',
    'input[type="text"]',
  ], opts.username);
  const emailFilled = await fillFirst(page, [
    "#reg-email",
    'input[placeholder="Email"]',
    'input[placeholder*="email" i]',
    'input[name="email"]',
    'input[type="email"]',
  ], opts.email);
  const passwordFilled = await fillFirst(page, [
    "#reg-password",
    'input[placeholder="Password"]',
    'input[placeholder*="password" i]',
    'input[name="password"]',
    'input[type="password"]',
  ], opts.password);
  if (!usernameFilled || !emailFilled || !passwordFilled) {
    throw new Error("Form registrasi Ramashop belum siap. Silakan coba lagi beberapa saat.");
  }
  const registerResponse = page.waitForResponse(
    (response) => response.url().includes("/api/auth/register") && response.request().method() === "POST",
    { timeout: 10000 },
  );
  await page.locator('#register-form button[type="submit"]:visible, #register-form button:visible').first().click({ timeout: 3000 });
  const response = await registerResponse;
  const payload = await response.json().catch(() => null);
  if (!response.ok() || payload?.success === false) {
    throw new Error(payload?.error || payload?.message || "Registrasi Ramashop gagal.");
  }
  await page.waitForTimeout(800);
}

async function submitRamashopLogin(page: import("playwright").Page, opts: {
  username: string;
  email: string;
  password: string;
}) {
  await page.locator("#login-form").waitFor({ state: "visible", timeout: 2500 }).catch(async () => {
    await page.locator(".tabs button", { hasText: "Login" }).click({ timeout: 2500 });
  });
  const identifierFilled = await fillFirst(page, [
    "#login-email",
    'input[placeholder="Username"]',
    'input[placeholder="Email"]',
    'input[placeholder*="username" i]',
    'input[placeholder*="email" i]',
    'input[name="username"]',
    'input[name="email"]',
    'input[type="email"]',
    'input[type="text"]',
  ], opts.email || opts.username);
  const passwordFilled = await fillFirst(page, [
    "#login-password",
    'input[placeholder="Password"]',
    'input[placeholder*="password" i]',
    'input[name="password"]',
    'input[type="password"]',
  ], opts.password);
  if (!identifierFilled || !passwordFilled) {
    throw new Error("Form login Ramashop belum siap. Silakan coba lagi beberapa saat.");
  }
  const loginResponse = page.waitForResponse(
    (response) => response.url().includes("/api/auth/login") && response.request().method() === "POST",
    { timeout: 10000 },
  );
  await page.locator('#login-form button[type="submit"]:visible, #login-form button:visible').first().click({ timeout: 3000 });
  const response = await loginResponse;
  const payload = await response.json().catch(() => null);
  if (!response.ok() || payload?.success === false) {
    throw new Error(payload?.error || payload?.message || "Login Ramashop gagal.");
  }
  await page.locator("#dashboard-section").waitFor({ state: "visible", timeout: 8000 });
}

async function extractRamashopApiKey(page: import("playwright").Page) {
  const directApiKey = await page.evaluate(async () => {
    const token = window.localStorage.getItem("token");
    if (!token) return "";

    const readPayload = async (response: Response) => {
      const payload = await response.json().catch(() => null) as {
        data?: { apiKey?: unknown };
      } | null;
      return typeof payload?.data?.apiKey === "string" ? payload.data.apiKey.trim() : "";
    };

    const headers = { Authorization: `Bearer ${token}` };
    const infoResponse = await fetch("/api/key/info", { headers });
    const existingKey = await readPayload(infoResponse);
    if (existingKey) return existingKey;

    const generateResponse = await fetch("/api/key/generate", { method: "POST", headers });
    return readPayload(generateResponse);
  }).catch(() => "");
  if (directApiKey) return directApiKey;

  const apiKeyResponse = page.waitForResponse(
    (response) => response.url().includes("/api/key/info") && response.request().method() === "GET",
    { timeout: 8000 },
  ).catch(() => null);
  await page.evaluate(() => {
    const showApiKeyModal = (window as unknown as { showApiKeyModal?: () => Promise<void> }).showApiKeyModal;
    if (!showApiKeyModal) throw new Error("Menu API Key Ramashop tidak tersedia.");
    return showApiKeyModal();
  });
  const response = await apiKeyResponse;
  if (response) {
    const payload = await response.json().catch(() => null);
    const key = payload?.data?.apiKey;
    if (typeof key === "string" && key.trim()) return key.trim();
  }

  const inputValues = await page
    .locator("#modal-body input, #modal-body textarea")
    .evaluateAll((elements) =>
      elements
        .map((element) => (element as HTMLInputElement | HTMLTextAreaElement).value || element.getAttribute("value") || "")
        .filter(Boolean),
    )
    .catch(() => []);
  const bodyText = await page.locator("body").innerText({ timeout: 2000 }).catch(() => "");
  const candidates = [...inputValues, ...bodyText.split(/\s+/)]
    .map((value) => value.trim())
    .filter((value) => value.length >= 12 && !/^(api key|your api key|belum ada)/i.test(value));

  return candidates[0] ?? "";
}

async function launchRamashopBrowser(chromium: typeof import("playwright").chromium) {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Executable doesn't exist")) {
      throw error;
    }

    try {
      return await chromium.launch({ channel: "chrome", headless: true });
    } catch (fallbackError) {
      console.error("PayGate browser launch failed:", fallbackError);
      throw new Error("Sistem PayGate belum siap memproses akun. Coba lagi sebentar lagi.");
    }
  }
}

async function openRamashopDashboard(page: import("playwright").Page) {
  let navigationError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(RAMASHOP_DASHBOARD_URL, {
        waitUntil: "commit",
        timeout: 12000,
      });
      navigationError = null;
      break;
    } catch (error) {
      navigationError = error;
      const pageReady = await page
        .locator("#login-form, #register-form, #dashboard-section")
        .first()
        .waitFor({ state: "attached", timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (pageReady) {
        navigationError = null;
        break;
      }
    }
  }

  if (navigationError) {
    throw new Error("Layanan PayGate sedang lambat atau tidak tersedia. Coba lagi beberapa saat.");
  }

  await page
    .locator("#login-form, #register-form, #dashboard-section")
    .first()
    .waitFor({ state: "attached", timeout: 10000 })
    .catch(() => {
      throw new Error("Halaman PayGate belum siap. Coba lagi beberapa saat.");
    });
}

export async function registerOnRamashopAndFetchApiKey(opts: {
  username: string;
  email: string;
  password: string;
  authMode?: "register" | "login";
}) {
  const { chromium } = await import("playwright");
  const browser = await launchRamashopBrowser(chromium);
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await openRamashopDashboard(page);
    if (opts.authMode === "login") {
      await submitRamashopLogin(page, opts);
    } else {
      await submitRamashopRegister(page, opts);
      await openRamashopDashboard(page);
      await submitRamashopLogin(page, opts);
    }

    const apiKey = await extractRamashopApiKey(page);
    const dashboardUsername = (await page.locator("#username").textContent().catch(() => ""))?.trim();

    if (!apiKey) {
      throw new Error("Gagal mengambil API key Ramashop untuk akun ini. Cek username/email/password PayGate atau perubahan tampilan Ramashop.");
    }

    return {
      apiKey,
      username: dashboardUsername || opts.username || opts.email.split("@")[0],
    };
  } finally {
    await browser.close();
  }
}

// Helper to call ramashop public API using stored API key
function pickDataRecord(payload: unknown): JsonRecord {
  if (!payload || typeof payload !== "object") return {};
  const data = (payload as JsonRecord).data;
  return data && typeof data === "object" ? (data as JsonRecord) : {};
}

export async function callRamashopApi(userId: string, path: string, method: "GET" | "POST" = "GET", body?: unknown) {
  const account = await getRamashopAccountByUserId(userId);
  if (!account) throw new Error("No Ramashop account for user");

  const apiKey = decryptApiKey(account.apiKeyEncrypted);
  const url = `https://ramashop.my.id/api/public${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = { "X-API-Key": apiKey };
  if (method === "POST") headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => null);
  await run("UPDATE ramashop_accounts SET api_key_last_used = ?, updated_at = ? WHERE user_id = ?", [
    Date.now(),
    Date.now(),
    userId,
  ]).catch(() => {});
  return { status: res.status, data: json };
}

export async function createDeposit(userId: string, amount: number) {
  const r = await callRamashopApi(userId, "/deposit/create", "POST", { amount, method: "qris" });
  const data = pickDataRecord(r.data);
  // store transaction mapping
  await ensureDatabase();
  const id = crypto.randomUUID();
  const now = Date.now();
  await run(
    `INSERT INTO ramashop_transactions (id, user_id, deposit_id, type, amount, status, raw_payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      data.depositId ? String(data.depositId) : null,
      "deposit",
      amount,
      data.status ? String(data.status) : "pending",
      JSON.stringify(r.data ?? r),
      now,
    ],
  );
  return r;
}

export async function checkDepositStatus(userId: string, depositId: string) {
  const response = await callRamashopApi(userId, `/deposit/status/${depositId}`, "GET");
  const status = pickDataRecord(response.data).status;
  if (status) {
    await ensureDatabase();
    const existing = await run(
      "SELECT raw_payload FROM ramashop_transactions WHERE user_id = ? AND deposit_id = ? LIMIT 1",
      [userId, depositId],
    ).catch(() => ({ rows: [] }));
    let previousRaw: unknown = {};
    try {
      previousRaw = existing.rows[0]?.raw_payload ? JSON.parse(String(existing.rows[0].raw_payload)) : {};
    } catch {
      previousRaw = {};
    }
    const previousRecord = previousRaw && typeof previousRaw === "object" ? previousRaw as JsonRecord : {};
    const responseRecord = response.data && typeof response.data === "object" ? response.data as JsonRecord : {};
    const mergedRaw = {
      ...previousRecord,
      ...responseRecord,
      data: {
        ...(previousRecord.data && typeof previousRecord.data === "object" ? previousRecord.data as JsonRecord : {}),
        ...(responseRecord.data && typeof responseRecord.data === "object" ? responseRecord.data as JsonRecord : {}),
      },
    };
    await run(
      "UPDATE ramashop_transactions SET status = ?, raw_payload = ?, updated_at = ? WHERE user_id = ? AND deposit_id = ?",
      [String(status), JSON.stringify(mergedRaw), Date.now(), userId, depositId],
    ).catch(() => {});
  }
  return response;
}

export async function getRamashopHistory(userId: string) {
  return callRamashopApi(userId, "/history", "GET");
}
