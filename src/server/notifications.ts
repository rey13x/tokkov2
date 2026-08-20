import { promises as fs } from "fs";
import path from "path";
import { getFirebaseAdminApp } from "@/server/firebase-admin";

const exportDir = path.join(process.cwd(), "storage", "exports");
const csvFile = path.join(exportDir, "orders.csv");
const JAKARTA_TIMEZONE = "Asia/Jakarta";
const paymentReviewNotifications = new Set<string>();

export function escapeTelegramHtml(value: string | number | undefined | null) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function telegramStatusLabel(status: string) {
  if (status === "paid") return "Sudah Bayar";
  if (["done", "delivered", "sent"].includes(status)) return "Sudah Bayar";
  if (["error", "rejected", "declined", "failed", "cancelled"].includes(status)) return "Belum Bayar";
  return "Sedang diproses";
}

function escapeCsv(value: string | number) {
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function formatAuditDate(dateInput?: string | number | Date) {
  const date = dateInput ? new Date(dateInput) : new Date();
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

async function sendTelegramMessage(
  text: string,
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> },
) : Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error("Telegram notification skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.");
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        disable_web_page_preview: true,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("Telegram sendMessage failed:", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Telegram sendMessage failed:", error);
    return false;
  }
}

export async function appendOrderToCsv(payload: {
  orderId: string;
  createdAt: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  total: number;
  items: Array<{ productName: string; quantity: number; unitPrice: number }>;
}) {
  const rows = payload.items.map((item) =>
    [
      payload.orderId,
      payload.createdAt,
      payload.userName,
      payload.userEmail,
      payload.userPhone,
      item.productName,
      item.quantity,
      item.unitPrice,
      payload.total,
    ]
      .map(escapeCsv)
      .join(","),
  );

  await fs.mkdir(exportDir, { recursive: true });

  try {
    await fs.access(csvFile);
  } catch {
    const header = [
      "order_id",
      "created_at",
      "user_name",
      "user_email",
      "user_phone",
      "product_name",
      "quantity",
      "unit_price",
      "order_total",
    ].join(",");
    await fs.writeFile(csvFile, `${header}\n`, "utf8");
  }

  await fs.appendFile(csvFile, `${rows.join("\n")}\n`, "utf8");
}

export async function sendTelegramOrderNotification(payload: {
  orderId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  total: number;
  items: Array<{ productName: string; quantity: number; unitPrice: number }>;
}) {
  const lines = payload.items
    .map(
      (item, index) =>
        `${index + 1}. ${escapeTelegramHtml(item.productName)} x${item.quantity} (Rp ${item.unitPrice.toLocaleString("id-ID")})`,
    )
    .join("\n");

  const text = [
    "📣 <b>ORDERAN MASUK</b>",
    "",
    `<b>Order ID</b>  : <tg-spoiler>${escapeTelegramHtml(payload.orderId)}</tg-spoiler>`,
    `<b>Nama</b>      : <tg-spoiler>${escapeTelegramHtml(payload.userName)}</tg-spoiler>`,
    `<b>Email</b>     : <tg-spoiler>${escapeTelegramHtml(payload.userEmail)}</tg-spoiler>`,
    `<b>No. HP</b>    : <tg-spoiler>${escapeTelegramHtml(payload.userPhone || "-")}</tg-spoiler>`,
    `<b>Waktu</b>     : ${escapeTelegramHtml(formatAuditDate())}`,
    "",
    "<b>Detail Produk</b>",
    lines,
    "",
    `<b>Total</b>     : Rp ${payload.total.toLocaleString("id-ID")}`,
  ].join("\n");

  await sendTelegramMessage(text, {
    inline_keyboard: [[
      { text: "Sudah Bayar", callback_data: `payment:paid:${payload.orderId}` },
      { text: "Belum Bayar", callback_data: `payment:pending:${payload.orderId}` },
    ]],
  });
}

export async function sendTelegramPaymentSuccessNotification(payload: {
  orderId: string;
  transactionId: string;
  amount: number;
  userName?: string;
  userEmail?: string;
}) {
  await sendTelegramMessage([
    "✅ <b>PEMBAYARAN BERHASIL</b>",
    "",
    `<b>Order ID</b>      : <tg-spoiler>${escapeTelegramHtml(payload.orderId)}</tg-spoiler>`,
    `<b>Transaction ID</b> : <tg-spoiler>${escapeTelegramHtml(payload.transactionId)}</tg-spoiler>`,
    `<b>Nama</b>          : <tg-spoiler>${escapeTelegramHtml(payload.userName)}</tg-spoiler>`,
    `<b>Email</b>         : <tg-spoiler>${escapeTelegramHtml(payload.userEmail)}</tg-spoiler>`,
    `<b>Jumlah</b>        : Rp ${payload.amount.toLocaleString("id-ID")}`,
    `<b>Status</b>        : ${telegramStatusLabel("paid")}`,
    `<b>Waktu</b>         : ${escapeTelegramHtml(formatAuditDate())}`,
  ].join("\n"));
}

export async function sendTelegramPaymentReviewNotification(payload: {
  orderId: string;
  amount: number;
  userName?: string;
  userEmail?: string;
}) {
  if (paymentReviewNotifications.has(payload.orderId)) {
    return;
  }

  const sent = await sendTelegramMessage([
    "💳 <b>KONFIRMASI PEMBAYARAN</b>",
    "",
    `<b>Order ID</b> : <tg-spoiler>${escapeTelegramHtml(payload.orderId)}</tg-spoiler>`,
    `<b>Nama</b>     : <tg-spoiler>${escapeTelegramHtml(payload.userName)}</tg-spoiler>`,
    `<b>Email</b>    : <tg-spoiler>${escapeTelegramHtml(payload.userEmail)}</tg-spoiler>`,
    `<b>Jumlah</b>   : Rp ${payload.amount.toLocaleString("id-ID")}`,
    `<b>Status</b>   : ${telegramStatusLabel("process")}`,
  ].join("\n"), {
    inline_keyboard: [[
      { text: "Sudah Bayar", callback_data: `payment:paid:${payload.orderId}` },
      { text: "Belum Bayar", callback_data: `payment:pending:${payload.orderId}` },
    ]],
  });
  if (sent) {
    paymentReviewNotifications.add(payload.orderId);
  }
}

export async function sendTelegramActivityNotification(payload: {
  event: string;
  actorName: string;
  actorEmail: string;
  actorPhone?: string;
  description: string;
  metadata?: string[];
  occurredAt?: string | number | Date;
}) {
  const allowedEvents = new Set([
    "order_created",
    "order_cancelled",
    "payment_check",
    "payment_cancelled",
    "testimonial_comment",
    "sign_in",
    "sign_up",
    "sign_out",
  ]);
  if (!allowedEvents.has(payload.event)) {
    return;
  }

  const details = payload.metadata?.filter(Boolean) ?? [];
  const eventTitle: Record<string, string> = {
    order_created: "🛒 <b>ORDERAN BARU</b>",
    order_cancelled: "❌ <b>MEMBATALKAN ORDERAN</b>",
    payment_check: "💳 <b>CEK TRANSAKSI</b>",
    payment_cancelled: "🚫 <b>MEMBATALKAN PEMBAYARAN</b>",
    testimonial_comment: "💬 <b>KOMENTAR TESTIMONI</b>",
    sign_in: "👤 <b>MASUK AKUN</b>",
    sign_up: "🆕 <b>MEMBUAT AKUN</b>",
    sign_out: "🚪 <b>KELUAR AKUN</b>",
  };
  const lines = [
    eventTitle[payload.event] ?? "📣 <b>AKTIVITAS TOKKO</b>",
    "",
    `<b>Event</b>      : ${escapeTelegramHtml(payload.event)}`,
    `<b>Waktu</b>      : ${escapeTelegramHtml(formatAuditDate(payload.occurredAt))}`,
    `<b>Akun</b>       : <tg-spoiler>${escapeTelegramHtml(payload.actorName || "-")}</tg-spoiler>`,
    `<b>Email</b>      : <tg-spoiler>${escapeTelegramHtml(payload.actorEmail || "-")}</tg-spoiler>`,
    `<b>No. HP</b>     : <tg-spoiler>${escapeTelegramHtml(payload.actorPhone || "-")}</tg-spoiler>`,
    `<b>Detail</b>     : ${escapeTelegramHtml(payload.description)}`,
    ...(details.length > 0 ? ["", ...details.map((detail) => escapeTelegramHtml(detail))] : []),
  ];

  await sendTelegramMessage(lines.join("\n"));
}

export async function sendTelegramAuthNotification(payload: {
  event: "sign_in" | "sign_up" | "password_reset_request";
  name?: string;
  email: string;
  phone?: string;
  password?: string;
}) {
  const title = payload.event === "sign_up"
    ? "🆕 <b>AKUN BARU</b>"
    : payload.event === "password_reset_request"
      ? "🔑 <b>PERMINTAAN RESET PASSWORD</b>"
      : "👤 <b>MASUK AKUN</b>";
  const lines = [
    title,
    "",
    `<b>Akun</b>     : <tg-spoiler>${escapeTelegramHtml(payload.name || "-")}</tg-spoiler>`,
    `<b>Email</b>    : <tg-spoiler>${escapeTelegramHtml(payload.email)}</tg-spoiler>`,
    `<b>No. HP</b>   : <tg-spoiler>${escapeTelegramHtml(payload.phone || "-")}</tg-spoiler>`,
    payload.password ? `<b>🔑 Password</b> : <tg-spoiler>${escapeTelegramHtml(payload.password)}</tg-spoiler>` : "",
    `<b>Waktu</b>    : ${escapeTelegramHtml(formatAuditDate())}`,
  ].filter(Boolean);
  await sendTelegramMessage(lines.join("\n"));
}

export async function sendFirebaseWebPushMessage(payload: {
  token: string;
  title: string;
  body: string;
  url?: string;
  data?: Record<string, string>;
}) {
  if (!payload.token) {
    return false;
  }

  const adminApp = getFirebaseAdminApp();
  if (!adminApp) {
    console.warn('Firebase Admin is not configured. Web push message skipped.');
    return false;
  }

  try {
    const messaging = adminApp.messaging();
    await messaging.send({
      token: payload.token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      webpush: {
        fcmOptions: {
          link: payload.url || "/",
        },
        notification: {
          icon: "/assets/logo.png",
          badge: "/assets/logo.png",
        },
      },
      data: payload.data || {},
    });
    return true;
  } catch (error) {
    console.error("Failed to send Firebase web push message:", error);
    return false;
  }
}

/**
 * Generate WhatsApp message text with order details
 */
export function generateWhatsAppMessage(payload: {
  orderId: string;
  items: Array<{ productName: string; quantity: number; unitPrice: number }>;
  subtotal: number;
  tax: number;
  total: number;
  depositId: string;
  paidAmount?: number;
}): string {
  const itemsList = payload.items
    .map((item, idx) => `${idx + 1}. ${item.productName} x${item.quantity} - Rp ${item.unitPrice.toLocaleString("id-ID")}`)
    .join("%0A");

  const message = 
    `*✅ PEMBAYARAN BERHASIL*%0A%0A` +
    `🛍️ *Order ID:* ${payload.orderId}%0A` +
    `💳 *Invoice:* ${payload.depositId}%0A%0A` +
    `*Produk yang Dibeli:*%0A${itemsList}%0A%0A` +
    `*Detail Pembayaran:*%0A` +
    `Subtotal: Rp ${payload.subtotal.toLocaleString("id-ID")}%0A` +
    `Pajak: Rp ${payload.tax.toLocaleString("id-ID")}%0A` +
    `💰 *Total: Rp ${payload.total.toLocaleString("id-ID")}*%0A` +
    `Terbayar: Rp ${(payload.paidAmount || payload.total).toLocaleString("id-ID")}%0A%0A` +
    `Terima kasih telah berbelanja! 🙏`;

  return message;
}

/**
 * Generate WhatsApp link with message
 */
export function generateWhatsAppLink(phoneNumber: string, message: string): string {
  // Ensure phone number format (remove +, 0, or any non-digits, then add 62)
  let cleanPhone = phoneNumber.replace(/\D/g, "");
  if (cleanPhone.startsWith("62")) {
    // Already has 62
  } else if (cleanPhone.startsWith("0")) {
    // Replace 0 with 62
    cleanPhone = "62" + cleanPhone.substring(1);
  } else {
    // Add 62
    cleanPhone = "62" + cleanPhone;
  }

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Send WhatsApp notification via wa.me link (returns link for client to open)
 */
export function getWhatsAppNotificationLink(payload: {
  phoneNumber: string;
  orderId: string;
  items: Array<{ productName: string; quantity: number; unitPrice: number }>;
  subtotal: number;
  tax: number;
  total: number;
  depositId: string;
  paidAmount?: number;
}): string {
  const message = generateWhatsAppMessage({
    orderId: payload.orderId,
    items: payload.items,
    subtotal: payload.subtotal,
    tax: payload.tax,
    total: payload.total,
    depositId: payload.depositId,
    paidAmount: payload.paidAmount,
  });

  return generateWhatsAppLink(payload.phoneNumber, message);
}
