import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());

const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const siteUrl = process.env.TELEGRAM_WEBHOOK_URL?.trim() || process.env.NEXTAUTH_URL?.trim();

if (!botToken || !webhookSecret || !siteUrl) {
  console.error("Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, and TELEGRAM_WEBHOOK_URL or NEXTAUTH_URL before configuring the webhook.");
  process.exitCode = 1;
} else if (!/^[A-Za-z0-9_-]{1,256}$/.test(webhookSecret)) {
  console.error("TELEGRAM_WEBHOOK_SECRET must be 1-256 characters using only letters, numbers, underscores, and hyphens.");
  process.exitCode = 1;
} else {
  let webhookUrl;
  try {
    const baseUrl = new URL(siteUrl);
    if (baseUrl.protocol !== "https:") {
      throw new Error("NEXTAUTH_URL must use HTTPS for Telegram webhooks.");
    }
    webhookUrl = new URL("/api/telegram/webhook", baseUrl).toString();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "NEXTAUTH_URL is invalid.");
    process.exitCode = 1;
  }

  if (webhookUrl) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: webhookSecret,
          allowed_updates: ["message", "callback_query"],
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.description || `Telegram returned HTTP ${response.status}.`);
      }

      const infoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
      const info = await infoResponse.json();
      const configuredUrl = info?.result?.url;
      if (!infoResponse.ok || !info.ok || configuredUrl !== webhookUrl) {
        throw new Error(info?.description || "Telegram webhook URL verification failed.");
      }

      const lastError = info.result.last_error_message;
      if (lastError) {
        throw new Error(`Webhook registered but Telegram reports a delivery error: ${lastError}`);
      }

      console.log(`Telegram webhook verified at ${new URL(webhookUrl).host}${new URL(webhookUrl).pathname}.`);
      console.log(`Pending Telegram updates: ${info.result.pending_update_count ?? 0}.`);
    } catch (error) {
      console.error("Telegram webhook configuration failed:", error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
}
