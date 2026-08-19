import crypto from "crypto";
import { chromium } from "playwright";
import fetch from "node-fetch";
import { run, ensureDatabase } from "@/server/db";

const MASTER_KEY_ENV = "RAMASHOP_MASTER_KEY";

function requireMasterKey() {
  const key = process.env[MASTER_KEY_ENV];
  if (!key) throw new Error(`${MASTER_KEY_ENV} is not set`);
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

async function storeRamashopAccount(params: {
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
  const row = res.rows[0] as any | undefined;
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

// Use Playwright to register a new account on ramashop and retrieve the API key from dashboard
export async function registerOnRamashopAndFetchApiKey(opts: {
  name: string;
  email: string;
  password: string;
  userId: string; // our local user id to associate
}) {
  // Launch browser in headless mode
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to registration page
    await page.goto("https://ramashop.my.id/dashboard", { waitUntil: "networkidle" });

    // The screenshots provided show a register form on /dashboard with fields for name/email/password
    // Fill form - selectors may need adjustment depending on the page structure
    await page.fill('input[placeholder="Email"]', opts.email).catch(() => {});
    await page.fill('input[type="password"]', opts.password).catch(() => {});
    // if there's a name input
    await page.fill('input[placeholder="Tokko Marketplace"]', opts.name).catch(() => {});

    // Click register button
    const registerButton = await page.$('button:has-text("Register")');
    if (registerButton) {
      await registerButton.click();
    } else {
      // fallback: submit the first form on the page
      await page.evaluate(() => {
        const f = document.querySelector('form');
        if (f) (f as HTMLFormElement).submit();
      }).catch(() => {});
    }

    // Wait for navigation to dashboard / after login
    await page.waitForLoadState("networkidle");

    // Open menu and navigate to API Key (based on screenshots)
    const menuButton = await page.$('button[aria-label="menu"], button:has-text("Menu")');
    if (menuButton) await menuButton.click().catch(() => {});
    await page.waitForTimeout(400);

    // Click API Key item
    const apiKeyButton = await page.$('text=API Key, text=/API Key/');
    if (apiKeyButton) {
      await apiKeyButton.click().catch(() => {});
    }

    // Wait for modal and read the api key field
    await page.waitForTimeout(500);
    // try common selectors for API key input
    let apiKey = "";
    const apiInput = await page.$('input[readonly][value], input[placeholder*="API"]');
    if (apiInput) {
      apiKey = (await apiInput.inputValue()).trim();
    } else {
      // try to find text nodes that look like api keys
      const possible = await page.$$eval("div, span, p, input", (els) => els.map((e) => e.textContent || (e as HTMLInputElement).value || ""));
      for (const t of possible) {
        if (t && t.length > 10 && /[a-zA-Z0-9-_]{10,}/.test(t)) {
          apiKey = t.trim();
          break;
        }
      }
    }

    if (!apiKey) {
      throw new Error("Failed to extract API key from ramashop dashboard (selectors may need adjustment or the site requires interactive steps)");
    }

    // Store account
    const accountId = await storeRamashopAccount({
      userId: opts.userId,
      ramashopUsername: opts.name,
      ramashopEmail: opts.email,
      apiKey,
    });

    await browser.close();

    return { accountId, apiKey: apiKey };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

// Helper to call ramashop public API using stored API key
export async function callRamashopApi(userId: string, path: string, method: "GET" | "POST" = "GET", body?: any) {
  const account = await getRamashopAccountByUserId(userId);
  if (!account) throw new Error("No Ramashop account for user");

  const apiKey = decryptApiKey(account.apiKeyEncrypted);
  const url = `https://ramashop.my.id/api/public${path.startsWith("/") ? path : `/${path}`}`;
  const headers: any = { "X-API-Key": apiKey };
  if (method === "POST") headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => null);
  return { status: res.status, data: json };
}

export async function createDeposit(userId: string, amount: number) {
  const r = await callRamashopApi(userId, "/deposit/create", "POST", { amount, method: "qris" });
  // store transaction mapping
  await ensureDatabase();
  const id = crypto.randomUUID();
  const now = Date.now();
  await run(
    `INSERT INTO ramashop_transactions (id, user_id, deposit_id, type, amount, status, raw_payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, r.data?.data?.depositId ?? null, "deposit", amount, r.data?.data?.status ?? "pending", JSON.stringify(r.data ?? r), now],
  );
  return r;
}

export async function checkDepositStatus(userId: string, depositId: string) {
  return callRamashopApi(userId, `/deposit/status/${depositId}`, "GET");
}
