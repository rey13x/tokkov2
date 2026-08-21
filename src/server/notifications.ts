import { promises as fs } from "fs";
import path from "path";
import QRCode from "qrcode";
import { getFirebaseAdminApp, getFirebaseFirestore } from "@/server/firebase-admin";
import { getOrderById, listOrderItemsByOrderId } from "@/server/store-data";

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
  if (status === "cancelled") return "Pre-order";
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
) : Promise<number | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error("Telegram notification skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.");
    return null;
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
      return null;
    }
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      result?: { message_id?: number };
    } | null;
    return payload?.ok && typeof payload.result?.message_id === "number"
      ? payload.result.message_id
      : null;
  } catch (error) {
    console.error("Telegram sendMessage failed:", error);
    return null;
  }
}

async function editTelegramMessage(chatId: string, messageId: number, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) return false;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [] },
      }),
      cache: "no-store",
    });
    return response.ok;
  } catch (error) {
    console.error("Telegram editMessageText failed:", error);
    return false;
  }
}

function maskEmail(value: string) {
  const [local = "", domain = ""] = value.split("@", 2);
  if (!local || !domain) return "***";
  const dot = domain.indexOf(".");
  return `${local.slice(0, 1)}***@${domain.slice(0, 1)}***${dot >= 0 ? domain.slice(dot) : ""}`;
}

function maskPhone(value: string) {
  const clean = value.trim();
  return clean.length > 4 ? `${clean.slice(0, 2)}***${clean.slice(-2)}` : "***";
}

function escapeSvg(value: string | number | undefined | null) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function buildReceiptPhoto(input: {
  orderId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  createdAt: string;
  depositId?: string;
  paidAt?: string;
  items: Array<{ productName: string; productDuration: string; quantity: number; unitPrice: number; productType?: string; donationName?: string; donationMessage?: string }>;
  total: number;
}) {
  const donation = input.items.find((item) => item.productType === "donation");
  if (donation) {
    const logoPath = path.join(process.cwd(), "public", "assets", "maintenancelogo.jpg");
    const signaturePath = path.join(process.cwd(), "public", "assets", "TTD Dev.jpeg");
    const logoData = (await fs.readFile(logoPath)).toString("base64");
    let signatureData = "";
    try {
      signatureData = (await fs.readFile(signaturePath)).toString("base64");
    } catch {
      signatureData = "";
    }
    return `<svg width="595" height="842" xmlns="http://www.w3.org/2000/svg">
      <defs><clipPath id="cert-logo"><circle cx="530" cy="82" r="42" /></clipPath></defs>
      <rect width="595" height="842" fill="#050505"/><rect x="10" y="10" width="575" height="822" fill="none" stroke="#7d2bbd" stroke-width="12"/>
      <image href="data:image/jpeg;base64,${logoData}" x="488" y="40" width="84" height="84" preserveAspectRatio="xMidYMid slice" clip-path="url(#cert-logo)"/>
      <g opacity="0.5"><image href="data:image/jpeg;base64,${logoData}" x="177" y="301" width="240" height="240" preserveAspectRatio="xMidYMid slice"/></g>
      <style>.white{fill:#fff;font-family:Helvetica}.pink{fill:#d33d91;font-family:Helvetica}.muted{fill:#bdbdbd;font-family:Helvetica}</style>
      <text x="297" y="72" text-anchor="middle" class="white" font-size="21" font-weight="700">TOKKO MARKETPLACE</text>
      <text x="297" y="125" text-anchor="middle" class="pink" font-size="40" font-weight="700">Sertifikat</text>
      <text x="297" y="215" text-anchor="middle" class="white" font-size="18">Terima kasih kepada:</text>
      <text x="297" y="270" text-anchor="middle" class="pink" font-size="27" font-weight="700">${escapeSvg(donation.donationName || input.userName || "Donatur")}</text>
      <text x="90" y="342" class="white" font-size="14">Atas donasi yang telah diberikan untuk bantuan</text>
      <text x="297" y="374" text-anchor="middle" class="pink" font-size="20" font-weight="700">${escapeSvg(donation.productName)}</text>
      <text x="297" y="414" text-anchor="middle" class="white" font-size="14">dengan nominal sebesar:</text>
      <text x="297" y="465" text-anchor="middle" class="pink" font-size="29" font-weight="700">Rp ${escapeSvg(donation.unitPrice.toLocaleString("id-ID"))}</text>
      <line x1="185" y1="490" x2="410" y2="490" stroke="#fff" stroke-width="2"/>
      ${donation.donationMessage ? `<text x="297" y="535" text-anchor="middle" class="muted" font-size="13">&quot;${escapeSvg(donation.donationMessage)}&quot;</text>` : ""}
      <text x="297" y="625" text-anchor="middle" class="white" font-size="15" font-weight="700">Founder Tokko Marketplace</text>
      <image href="data:image/jpeg;base64,${signatureData}" x="242" y="650" width="110" height="55" preserveAspectRatio="xMidYMid meet"/>
      <text x="297" y="730" text-anchor="middle" class="white" font-size="14">Raihaan Bagastiam Pratama</text>
      <text x="297" y="800" text-anchor="middle" class="white" font-size="10">tokkomarketplace.shop</text>
    </svg>`;
  }
  const logoPath = path.join(process.cwd(), "public", "assets", "maintenancelogo.jpg");
  const logoData = (await fs.readFile(logoPath)).toString("base64");
  const receiptOrigin = (process.env.NEXTAUTH_URL?.trim() || "https://www.tokkomarketplace.shop").replace(/\/$/, "");
  const qrData = await QRCode.toDataURL(`${receiptOrigin}/status-pemesanan?order=${encodeURIComponent(input.orderId)}`, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 120,
  });
  const itemLines = input.items.flatMap((item, index) => [
    `<text x="32" y="${270 + index * 54}" class="item bold">${index + 1}. ${escapeSvg(item.productName)}</text>`,
    `<text x="44" y="${290 + index * 54}" class="item">${item.quantity} x Rp ${escapeSvg(item.unitPrice.toLocaleString("id-ID"))} = Rp ${escapeSvg(Number(item.quantity * item.unitPrice).toLocaleString("id-ID"))}</text>`,
    item.productDuration ? `<text x="44" y="${310 + index * 54}" class="item">Durasi: ${escapeSvg(item.productDuration)}</text>` : "",
  ]).join("");
  const itemHeight = input.items.length * 54;
  const totalY = 310 + itemHeight;
  const height = totalY + 210;

  return `<svg width="420" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="watermark-circle"><circle cx="210" cy="${Math.round(height / 2)}" r="112" /></clipPath></defs>
    <rect width="420" height="${height}" fill="white"/>
    <image href="data:image/jpeg;base64,${logoData}" x="182" y="20" width="56" height="56" preserveAspectRatio="xMidYMid slice"/>
    <g opacity="0.4"><image href="data:image/jpeg;base64,${logoData}" x="90" y="${Math.round(height / 2) - 112}" width="240" height="240" preserveAspectRatio="xMidYMid slice" clip-path="url(#watermark-circle)"/></g>
    <style>.title{font:700 15px Helvetica}.subtitle{font:700 11px Helvetica}.meta,.item{font:12px Courier}.bold{font-weight:700}.line{stroke:#222;stroke-width:1}</style>
    <text x="210" y="100" text-anchor="middle" class="title">TOKKO MARKETPLACE</text>
    <text x="210" y="122" text-anchor="middle" class="subtitle">Struk Pembayaran</text>
    <text x="32" y="155" class="meta">Order ID : ${escapeSvg(input.orderId)}</text>
    <text x="32" y="173" class="meta">Tanggal  : ${escapeSvg(formatAuditDate(input.createdAt))}</text>
    <text x="32" y="191" class="meta">Akun     : ${escapeSvg(input.userName)}</text>
    <text x="32" y="209" class="meta">Email    : ${escapeSvg(input.userEmail)}</text>
    <text x="32" y="227" class="meta">No. HP   : ${escapeSvg(input.userPhone || "-")}</text>
    <line x1="32" y1="242" x2="388" y2="242" class="line" stroke-dasharray="4 4"/>
    ${itemLines}
    <line x1="32" y1="${totalY - 16}" x2="388" y2="${totalY - 16}" class="line" stroke-dasharray="4 4"/>
    <text x="32" y="${totalY + 10}" class="item">Subtotal : ${escapeSvg(input.total.toLocaleString("id-ID"))}</text>
    <text x="32" y="${totalY + 30}" class="item">Pajak    : 500</text>
    <text x="32" y="${totalY + 52}" class="item bold">TOTAL    : ${escapeSvg(input.total.toLocaleString("id-ID"))}</text>
    <text x="32" y="${totalY + 78}" class="item bold">PEMBAYARAN BERHASIL</text>
    ${input.depositId ? `<text x="32" y="${totalY + 96}" class="item">Ref: ${escapeSvg(input.depositId)}</text>` : ""}
    ${input.paidAt ? `<text x="32" y="${totalY + 114}" class="item">Dibayar: ${escapeSvg(formatAuditDate(input.paidAt))}</text>` : ""}
    <image href="${qrData}" x="32" y="${height - 125}" width="100" height="100"/>
    <text x="150" y="${height - 95}" class="item bold">Founder</text>
    <text x="150" y="${height - 75}" class="item">Raihaan Bagastiam Pratama</text>
    <text x="210" y="${height - 22}" text-anchor="middle" class="item">Terima kasih sudah berbelanja di Tokko Marketplace.</text>
  </svg>`;
}

async function sendTelegramReceipt(
  orderId: string,
  chatId: string,
  options: { notifiedField?: string; caption?: string } = {},
) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) return false;

  const firestore = getFirebaseFirestore();
  const order = await getOrderById(orderId);
  if (!order) return false;
  const notifiedField = options.notifiedField || "telegramReceiptNotifiedAt";
  let existingReceiptSentAt: unknown = null;
  if (firestore) {
    try {
      const snapshot = await firestore.collection("orders").doc(orderId).get();
      existingReceiptSentAt = snapshot.exists ? snapshot.data()?.[notifiedField] : null;
    } catch {
      existingReceiptSentAt = null;
    }
  }
  if (existingReceiptSentAt) return true;

  const items = await listOrderItemsByOrderId(orderId);
  const total = Number(order.totalAmount ?? order.total ?? 0);
  const receiptInput = {
    orderId: order.id,
    userName: order.userName,
    userEmail: order.userEmail,
    userPhone: order.userPhone,
    status: "paid",
    createdAt: order.createdAt,
    depositId: order.depositId,
    paidAt: order.paidAt,
    items: items.map((item) => ({
      productName: item.productName,
      productDuration: item.productDuration,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      productType: item.productType,
      donationName: item.donationName,
      donationMessage: item.donationMessage,
    })),
    total,
  };
  const loadSharp = new Function("return import('sharp')") as () => Promise<{ default: typeof import("sharp").default }>;
  const { default: sharp } = await loadSharp();
  const receiptPhoto = await sharp(Buffer.from(await buildReceiptPhoto(receiptInput)))
    .png()
    .toBuffer();

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", options.caption || `🧾 <b>Struk pembayaran ${escapeTelegramHtml(orderId)}</b>`);
  form.append("parse_mode", "HTML");
  form.append("photo", new Blob([new Uint8Array(receiptPhoto)], { type: "image/png" }), `struk-${orderId}.png`);

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  if (!response.ok) return false;

  await firestore?.collection("orders").doc(orderId).set({
    [notifiedField]: Date.now(),
  }, { merge: true });
  return true;
}

export async function sendTelegramPaymentChannelNotification(payload: {
  orderId: string;
  transactionId: string;
  amount: number;
}) {
  const channelId = process.env.TELEGRAM_PAYMENT_CHANNEL_ID?.trim();
  if (!channelId) {
    console.warn("Payment channel notification skipped: TELEGRAM_PAYMENT_CHANNEL_ID is missing.");
    return false;
  }

  const order = await getOrderById(payload.orderId);
  if (!order) return false;
  const items = await listOrderItemsByOrderId(payload.orderId);
  const donation = items.find((item) => item.productType === "donation");
  if (donation) {
    const donationCaption = [
      "💙 <b>DONASI MASUK</b>",
      "",
      `<b>Username</b>: ${escapeTelegramHtml(order.userName)}`,
      `<b>Email</b>: ${escapeTelegramHtml(maskEmail(order.userEmail))}`,
      `<b>No. Telepon</b>: ${escapeTelegramHtml(maskPhone(order.userPhone))}`,
      "",
      `<b>Atas donasi yang diberikan untuk bantuan</b> ${escapeTelegramHtml(donation.productName)} dengan nominal sebesar: <b>Rp ${donation.unitPrice.toLocaleString("id-ID")}</b>`,
      "",
      "tokkomarketplace.shop",
    ].join("\n");
    return sendTelegramReceipt(payload.orderId, channelId, {
      notifiedField: "telegramDonationChannelNotifiedAt",
      caption: donationCaption,
    });
  }
  const accountText = [
    `Nama: ${escapeTelegramHtml(order.userName)}`,
    `Email: ${escapeTelegramHtml(maskEmail(order.userEmail))}`,
    `No. HP: ${escapeTelegramHtml(maskPhone(order.userPhone))}`,
  ].join("\n");
  const caption = [
    "✅ <b>PEMBAYARAN SUKSES</b>",
    "",
    `<b>Order ID</b>: <code>${escapeTelegramHtml(payload.orderId)}</code>`,
    `<b>Jumlah</b>: Rp ${payload.amount.toLocaleString("id-ID")}`,
    `<b>Transaksi</b>: <code>${escapeTelegramHtml(payload.transactionId)}</code>`,
    "",
    `<b>Informasi Account</b>\n<tg-spoiler>${accountText}</tg-spoiler>`,
  ].join("\n");

  return sendTelegramReceipt(payload.orderId, channelId, {
    notifiedField: "telegramPaymentChannelNotifiedAt",
    caption,
  });
}

export async function appendOrderToCsv(payload: {
  orderId: string;
  createdAt: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  total: number;
  items: Array<{ productName: string; quantity: number; unitPrice: number; productType?: string }>;
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
  items: Array<{ productName: string; quantity: number; unitPrice: number; productType?: string }>;
}) {
  const isDonation = payload.items.some((item) => item.productType === "donation");
  const lines = payload.items
    .map(
      (item, index) =>
        `${index + 1}. ${escapeTelegramHtml(item.productName)} x${item.quantity} (Rp ${item.unitPrice.toLocaleString("id-ID")})`,
    )
    .join("\n");

  const text = [
    isDonation ? "💙 <b>DONASI MASUK</b>" : "📣 <b>ORDERAN MASUK</b>",
    "",
    `<b>Order ID</b>  : <tg-spoiler>${escapeTelegramHtml(payload.orderId)}</tg-spoiler>`,
    isDonation
      ? `<b>Username</b> : ${escapeTelegramHtml(payload.userName)}\n<b>Email</b>    : ${escapeTelegramHtml(maskEmail(payload.userEmail))}\n<b>No. HP</b>   : ${escapeTelegramHtml(maskPhone(payload.userPhone || "-"))}`
      : `<b>Nama</b>      : <tg-spoiler>${escapeTelegramHtml(payload.userName)}</tg-spoiler>\n<b>Email</b>     : <tg-spoiler>${escapeTelegramHtml(payload.userEmail)}</tg-spoiler>\n<b>No. HP</b>    : <tg-spoiler>${escapeTelegramHtml(payload.userPhone || "-")}</tg-spoiler>`,
    `<b>Waktu</b>     : ${escapeTelegramHtml(formatAuditDate())}`,
    "",
    "<b>Detail Produk</b>",
    lines,
    "",
    `<b>Total</b>     : Rp ${payload.total.toLocaleString("id-ID")}`,
  ].join("\n");

  const messageId = await sendTelegramMessage(text, {
    inline_keyboard: [[
      { text: "Sudah Bayar", callback_data: `payment:paid:${payload.orderId}` },
      { text: "Belum Bayar", callback_data: `payment:pending:${payload.orderId}` },
      { text: "Pre-order", callback_data: `payment:preorder:${payload.orderId}` },
      { text: "Pre-order", callback_data: `payment:preorder:${payload.orderId}` },
    ]],
  });

  if (messageId) {
    try {
      const firestore = getFirebaseFirestore();
      await firestore?.collection("orders").doc(payload.orderId).set({
        telegramMessageId: messageId,
        telegramChatId: process.env.TELEGRAM_CHAT_ID?.trim() || "",
        telegramMessageUpdatedAt: Date.now(),
      }, { merge: true });
    } catch (error) {
      console.error("Failed to persist Telegram order message state:", error);
    }
  }

  return messageId;
}

export async function sendTelegramPaymentSuccessNotification(payload: {
  orderId: string;
  transactionId: string;
  amount: number;
  userName?: string;
  userEmail?: string;
}) {
  await sendTelegramPaymentChannelNotification({
    orderId: payload.orderId,
    transactionId: payload.transactionId,
    amount: payload.amount,
  }).catch((error) => {
    console.error("Failed to send Telegram payment channel notification:", error);
  });

  const text = [
    "✅ <b>PEMBAYARAN BERHASIL</b>",
    "",
    `<b>Order ID</b>      : <tg-spoiler>${escapeTelegramHtml(payload.orderId)}</tg-spoiler>`,
    `<b>Transaction ID</b> : <tg-spoiler>${escapeTelegramHtml(payload.transactionId)}</tg-spoiler>`,
    `<b>Nama</b>          : <tg-spoiler>${escapeTelegramHtml(payload.userName)}</tg-spoiler>`,
    `<b>Email</b>         : <tg-spoiler>${escapeTelegramHtml(payload.userEmail)}</tg-spoiler>`,
    `<b>Jumlah</b>        : Rp ${payload.amount.toLocaleString("id-ID")}`,
    `<b>Status</b>        : ${telegramStatusLabel("paid")}`,
    `<b>Waktu</b>         : ${escapeTelegramHtml(formatAuditDate())}`,
  ].join("\n");

  try {
    const firestore = getFirebaseFirestore();
    const orderSnapshot = await firestore?.collection("orders").doc(payload.orderId).get();
    const orderData = orderSnapshot?.exists ? orderSnapshot.data() : undefined;
    const messageId = Number(orderData?.telegramMessageId ?? 0);
    const chatId = String(orderData?.telegramChatId ?? process.env.TELEGRAM_CHAT_ID ?? "").trim();
    if (messageId && chatId && await editTelegramMessage(chatId, messageId, text)) {
      await firestore?.collection("orders").doc(payload.orderId).set({
        telegramMessageUpdatedAt: Date.now(),
        telegramPaymentNotifiedAt: Date.now(),
      }, { merge: true });
      await sendTelegramReceipt(payload.orderId, chatId).catch((error) => {
        console.error("Failed to send Telegram receipt:", error);
      });
      return;
    }
  } catch (error) {
    console.error("Failed to update Telegram payment message:", error);
  }

  const fallbackMessageId = await sendTelegramMessage(text);
  if (fallbackMessageId) {
    await sendTelegramReceipt(payload.orderId, process.env.TELEGRAM_CHAT_ID?.trim() || "").catch((error) => {
      console.error("Failed to send Telegram receipt:", error);
    });
  }
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
