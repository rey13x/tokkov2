import { promises as fs } from "fs";
import path from "path";
import QRCode from "qrcode";
import { getFirebaseAdminApp, getFirebaseFirestore } from "@/server/firebase-admin";
import { listUsersWithPushSubscription } from "@/server/db";
import { getOrderById, getProductById, listOrderItemsByOrderId } from "@/server/store-data";

type TelegramInlineButton = { text: string; callback_data?: string; url?: string };
type TelegramReplyMarkup = { inline_keyboard: TelegramInlineButton[][] };

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
  if (status === "sent") return "Sudah Bayar (Dikirim)";
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
  replyMarkup?: TelegramReplyMarkup,
  targetChatId?: string,
) : Promise<number | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const defaultChatId = process.env.TELEGRAM_CHAT_ID;
  const chatId = (targetChatId || defaultChatId)?.toString();

  if (!botToken || !chatId) {
    console.error("Telegram notification skipped: TELEGRAM_BOT_TOKEN or chat id is missing.");
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
      const errorBody = await response.text().catch(() => "");
      console.error("Telegram sendMessage failed:", response.status, errorBody);
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

export async function sendTelegramDonationActivityNotification(payload: {
  type: "income" | "expense" | "refund";
  amount: number;
  note: string;
  occurredAt: string | number | Date;
  actorName: string;
  actorPhone: string;
  donationProductName?: string;
  imageUrl?: string;
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) return { messageId: null, error: "TELEGRAM_BOT_TOKEN belum dikonfigurasi." };
  const channelId = process.env.TELEGRAM_PAYMENT_CHANNEL_ID?.trim() || "@tokkomarketplace";
  const typeLabel = { income: "PEMASUKAN", expense: "PENGELUARAN", refund: "PENGEMBALIAN" }[payload.type];
  const title = { income: "📣 PEMASUKAN DONASI", expense: "📣 PENGELUARAN DONASI", refund: "📣 PENGEMBALIAN DONASI" }[payload.type];
  const caption = [
    `<b>${title}</b>`,
    "",
    `<b>Jenis</b> : ${typeLabel}`,
    `<b>Nominal</b> : Rp ${payload.amount.toLocaleString("id-ID")}`,
    `<b>Card Donasi</b> : ${escapeTelegramHtml(payload.donationProductName || "-")}`,
    `<b>Catatan</b> : ${escapeTelegramHtml(payload.note || "-")}`,
    `<b>Waktu</b> : ${escapeTelegramHtml(formatAuditDate(payload.occurredAt))}`,
    `<b>Nama</b> : ${escapeTelegramHtml(payload.actorName)}`,
    `<b>No. HP</b> : ${escapeTelegramHtml(payload.actorPhone)}`,
  ].join("\n");
  let lastError = "Telegram gagal mengirim notifikasi.";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response: Response;
    if (payload.imageUrl) {
      if (payload.imageUrl.startsWith("data:")) {
        const match = payload.imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) return { messageId: null, error: "Format foto lampiran tidak valid." };
        const form = new FormData();
        form.append("chat_id", channelId);
        form.append("caption", caption);
        form.append("parse_mode", "HTML");
        form.append("photo", new Blob([Buffer.from(match[2], "base64")], { type: match[1] }), "donation-activity");
        response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, { method: "POST", body: form, cache: "no-store", signal: AbortSignal.timeout(15000) });
      } else {
        response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: channelId, photo: payload.imageUrl, caption, parse_mode: "HTML" }),
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        });
      }
    } else {
      response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: channelId, text: caption, parse_mode: "HTML" }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
    }
    if (response.ok) {
      const result = (await response.json().catch(() => null)) as { result?: { message_id?: number } } | null;
      if (typeof result?.result?.message_id === "number") {
        return { messageId: result.result.message_id, error: null };
      }
      lastError = "Telegram tidak mengembalikan ID pesan.";
    } else {
      const details = (await response.json().catch(() => null)) as { description?: string } | null;
      lastError = details?.description || `Telegram gagal (${response.status}).`;
    }
  }
  return { messageId: null, error: lastError };
}

export async function deleteTelegramDonationActivityMessage(chatId: string | undefined, messageId: number | undefined) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken || !chatId || !messageId) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
      cache: "no-store",
    });
    return response.ok;
  } catch (error) {
    console.error("Telegram donation activity deletion failed:", error);
    return false;
  }
}

async function editTelegramMessage(
  chatId: string,
  messageId: number,
  text: string,
  replyMarkup?: TelegramReplyMarkup,
) {
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
        reply_markup: replyMarkup ?? { inline_keyboard: [] },
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
  if (!local || !domain) return "tersembunyi";
  const dot = domain.indexOf(".");
  return `${local.slice(0, 1)}...@${domain.slice(0, 1)}...${dot >= 0 ? domain.slice(dot) : ""}`;
}

function maskPhone(value: string) {
  const clean = value.trim();
  return clean.length > 4 ? `${clean.slice(0, 2)}...${clean.slice(-2)}` : "tersembunyi";
}

function maskChannelEmail(value: string) {
  const [local = "", domain = ""] = value.split("@", 2);
  if (!local || !domain) return "*****@*****.***";
  const visibleStart = local.slice(0, 1);
  const visibleEnd = local.length > 3 ? local.slice(-2) : "";
  return `${visibleStart}${"*".repeat(Math.max(3, local.length - visibleStart.length - visibleEnd.length))}${visibleEnd}@${domain}`;
}

function maskChannelPhone(value: string) {
  const clean = value.trim();
  return clean.length > 4 ? `${clean.slice(0, 2)}${"*".repeat(Math.max(4, clean.length - 4))}${clean.slice(-2)}` : "*****";
}

function maskChannelIdentifier(value: string) {
  const clean = value.trim();
  return clean.length > 8 ? `${clean.slice(0, 4)}****${clean.slice(-4)}` : `****${clean || "ID"}`;
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
    const signaturePath = path.join(process.cwd(), "public", "assets", "TTDev-trans.png");
    const logoData = (await fs.readFile(logoPath)).toString("base64");
    let signatureData = "";
    try {
      signatureData = (await fs.readFile(signaturePath)).toString("base64");
    } catch {
      signatureData = "";
    }
    return `<svg width="842" height="595" xmlns="http://www.w3.org/2000/svg">
      <defs><clipPath id="cert-logo"><circle cx="790" cy="82" r="42" /></clipPath></defs>
      <rect width="842" height="595" fill="#ffffff"/><rect x="10" y="10" width="822" height="575" fill="none" stroke="#ffffff" stroke-width="12"/>
      <image href="data:image/jpeg;base64,${logoData}" x="748" y="40" width="84" height="84" preserveAspectRatio="xMidYMid slice" clip-path="url(#cert-logo)"/>
      <g opacity="0.1"><image href="data:image/jpeg;base64,${logoData}" x="301" y="178" width="240" height="240" preserveAspectRatio="xMidYMid slice"/></g>
      <style>.white{fill:#111;font-family:Helvetica}.pink{fill:#111;font-family:Helvetica}.muted{fill:#666;font-family:Helvetica}</style>
      <text x="421" y="72" text-anchor="middle" class="white" font-size="21" font-weight="700">TOKKO MARKETPLACE</text>
      <text x="421" y="125" text-anchor="middle" class="pink" font-size="40" font-weight="700">Sertifikat</text>
      <text x="421" y="165" text-anchor="middle" class="white" font-size="18">Terima kasih kepada:</text>
      <text x="421" y="205" text-anchor="middle" class="pink" font-size="27" font-weight="700">${escapeSvg(donation.donationName || input.userName || "Donatur")}</text>
      <text x="421" y="275" text-anchor="middle" class="white" font-size="14">Atas donasi yang telah diberikan untuk bantuan</text>
      <text x="421" y="307" text-anchor="middle" class="pink" font-size="20" font-weight="700">${escapeSvg(donation.productName)}</text>
      <text x="421" y="347" text-anchor="middle" class="white" font-size="14">dengan nominal sebesar:</text>
      <text x="421" y="385" text-anchor="middle" class="pink" font-size="29" font-weight="700">Rp ${escapeSvg(donation.unitPrice.toLocaleString("id-ID"))}</text>
      <line x1="310" y1="405" x2="532" y2="405" stroke="#fff" stroke-width="2"/>
      ${donation.donationMessage ? `<text x="421" y="435" text-anchor="middle" class="muted" font-size="13">&quot;${escapeSvg(donation.donationMessage)}&quot;</text>` : ""}
      <text x="421" y="485" text-anchor="middle" class="white" font-size="15" font-weight="700">Founder Tokko Marketplace</text>
      <image href="data:image/jpeg;base64,${signatureData}" x="366" y="490" width="110" height="55" preserveAspectRatio="xMidYMid meet"/>
      <text x="421" y="565" text-anchor="middle" class="white" font-size="14">Raihaan Bagastiam Pratama</text>
      <text x="421" y="585" text-anchor="middle" class="white" font-size="10">tokkomarketplace.shop</text>
    </svg>`;
  }
  const logoPath = path.join(process.cwd(), "public", "assets", "maintenancelogo.jpg");
  const signaturePath = path.join(process.cwd(), "public", "assets", "TTDev-trans.png");
  const logoData = (await fs.readFile(logoPath)).toString("base64");
  let signatureData = "";
  try {
    signatureData = (await fs.readFile(signaturePath)).toString("base64");
  } catch {
    signatureData = "";
  }
  const qrData = await QRCode.toDataURL(`https://tokkov2.vercel.app/#${encodeURIComponent(input.orderId)}`, {
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
  const height = totalY + 250;

  return `<svg width="420" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="logo-circle"><circle cx="210" cy="48" r="34" /></clipPath><clipPath id="watermark-circle"><circle cx="210" cy="${Math.round(height / 2)}" r="112" /></clipPath></defs>
    <rect width="420" height="${height}" fill="white"/>
    <image href="data:image/jpeg;base64,${logoData}" x="176" y="14" width="68" height="68" preserveAspectRatio="xMidYMid slice" clip-path="url(#logo-circle)"/>
    <g opacity="0.1" style="filter:grayscale(1)"><image href="data:image/jpeg;base64,${logoData}" x="90" y="${Math.round(height / 2) - 112}" width="240" height="240" preserveAspectRatio="xMidYMid slice" clip-path="url(#watermark-circle)"/></g>
    <style>.title{font:700 15px Helvetica}.subtitle{font:700 11px Helvetica}.meta,.item{font:12px Courier}.bold{font-weight:700}.line{stroke:#222;stroke-width:1}</style>
    <text x="210" y="104" text-anchor="middle" class="title">Tokko Marketplace</text>
    <text x="210" y="126" text-anchor="middle" class="subtitle">Struk Pembayaran</text>
    <text x="32" y="159" class="meta">Invoice : #${escapeSvg(input.orderId)}</text>
    <text x="32" y="177" class="meta">Tanggal : ${escapeSvg(formatAuditDate(input.createdAt))}</text>
    <text x="32" y="195" class="meta">Akun    : ${escapeSvg(input.userName)}</text>
    <text x="32" y="213" class="meta">Email   : ${escapeSvg(input.userEmail)}</text>
    <text x="32" y="231" class="meta">No. HP  : ${escapeSvg(input.userPhone || "-")}</text>
    <line x1="32" y1="246" x2="388" y2="246" class="line" stroke-dasharray="4 4"/>
    ${itemLines}
    <line x1="32" y1="${totalY - 16}" x2="388" y2="${totalY - 16}" class="line" stroke-dasharray="4 4"/>
    <text x="32" y="${totalY + 10}" class="item">Subtotal : ${escapeSvg(input.total.toLocaleString("id-ID"))}</text>
    <text x="32" y="${totalY + 30}" class="item">Pajak    : 500</text>
    <text x="32" y="${totalY + 52}" class="item bold">TOTAL    : ${escapeSvg(input.total.toLocaleString("id-ID"))}</text>
    <text x="32" y="${totalY + 78}" class="item bold">PEMBAYARAN BERHASIL</text>
    ${input.depositId ? `<text x="32" y="${totalY + 96}" class="item">Ref: ${escapeSvg(input.depositId)}</text>` : ""}
    ${input.paidAt ? `<text x="32" y="${totalY + 114}" class="item">Dibayar: ${escapeSvg(formatAuditDate(input.paidAt))}</text>` : ""}
    <image href="${qrData}" x="28" y="${height - 146}" width="130" height="130"/>
    <text x="220" y="${height - 108}" class="item bold">Founder</text>
    ${signatureData ? `<image href="data:image/jpeg;base64,${signatureData}" x="205" y="${height - 98}" width="150" height="62" preserveAspectRatio="xMidYMid meet"/>` : ""}
    <text x="210" y="${height - 20}" class="item">Raihaan Bagastiam Pratama</text>
    <text x="210" y="${height - 22}" text-anchor="middle" class="item">Terima kasih sudah berbelanja di Tokko Marketplace.</text>
  </svg>`;
}

export async function sendTelegramPaymentChannelNotification(payload: {
  orderId: string;
  transactionId: string;
  amount: number;
}) {
  const channelId = process.env.TELEGRAM_PAYMENT_CHANNEL_ID?.trim() || "@tokkomarketplace";

  try {
    const order = await getOrderById(payload.orderId);
    if (!order) return false;
    const items = await listOrderItemsByOrderId(payload.orderId);
    const enrichedItems = await Promise.all(items.map(async (item) => {
      const product = await getProductById(item.productId);
      return { ...item, productType: item.productType || product?.productType, imageUrl: product?.imageUrl };
    }));
    const donation = enrichedItems.find((item) => item.productType === "donation");
    if (donation) {
      const donationCaption = [
        "✅ <b>PEMBAYARAN BERHASIL | DONASI MASUK</b>",
        "",
        `<b>Order ID</b>: <tg-spoiler>${escapeTelegramHtml(maskChannelIdentifier(payload.orderId))}</tg-spoiler>  <b>Transaksi</b>: <tg-spoiler>${escapeTelegramHtml(maskChannelIdentifier(payload.transactionId))}</tg-spoiler>`,
        `<b>Waktu</b>: ${escapeTelegramHtml(formatAuditDate())}`,
        `<b>Username</b>: ${escapeTelegramHtml(order.userName)}`,
        `<b>Email</b>: ${escapeTelegramHtml(maskChannelEmail(order.userEmail))}`,
        `<b>No. Telepon</b>: ${escapeTelegramHtml(maskChannelPhone(order.userPhone))}`,
        "",
        `<b>Produk</b>: ${escapeTelegramHtml(donation.productName)} x${donation.quantity}`,
        `<b>Nominal</b>: <b>Rp ${donation.unitPrice.toLocaleString("id-ID")}</b>`,
        "",
        "tokkomarketplace.shop",
      ].join("\n");

      // prepare channel redirect button
      const channelButton: TelegramReplyMarkup = { inline_keyboard: [[{ text: "Tokko Marketplace", url: "https://tokkov2.vercel.app" }]] };

      const textSent = await sendTelegramMessage(donationCaption, channelButton, channelId).catch(() => null);
      if (!textSent) {
        await sendTelegramMessage(`⚠️ Gagal mengirim info donasi ke channel untuk order ${payload.orderId}.`).catch(() => {});
      }
      return Boolean(textSent);
    }

    const caption = [
      "📣 <b>PEMBAYARAN BERHASIL</b>",
      "",
      `<b>Order ID</b>     : <tg-spoiler>${escapeTelegramHtml(maskChannelIdentifier(payload.orderId))}</tg-spoiler>`,
      `<b>Transaksi</b>   : <tg-spoiler>${escapeTelegramHtml(maskChannelIdentifier(payload.transactionId))}</tg-spoiler>`,
      `<b>Waktu</b>       : ${escapeTelegramHtml(formatAuditDate())}`,
      `<b>Jumlah</b>       : Rp ${payload.amount.toLocaleString("id-ID")}`,
      "",
      "<b>Produk Dibeli</b>",
      ...enrichedItems.map((item, index) => `${index + 1}. ${escapeTelegramHtml(item.productName)} x${item.quantity}`),
      "",
      "<b>Informasi Akun</b>",
        `Nama           : ${escapeTelegramHtml(order.userName)}`,
        `Email          : ${escapeTelegramHtml(maskChannelEmail(order.userEmail))}`,
        `No. HP         : ${escapeTelegramHtml(maskChannelPhone(order.userPhone))}`,
    ].join("\n");

    // prepare channel redirect button
    const channelButton: TelegramReplyMarkup = { inline_keyboard: [[{ text: "Tokko Marketplace", url: "https://tokkov2.vercel.app" }]] };

    const textSent = await sendTelegramMessage(caption, channelButton, channelId).catch(() => null);
    if (!textSent) {
      await sendTelegramMessage(`⚠️ Gagal mengirim info pembayaran ke channel untuk order ${payload.orderId}.`).catch(() => {});
    }
    return Boolean(textSent);
  } catch (error) {
    console.error("Error in sendTelegramPaymentChannelNotification:", error);
    await sendTelegramMessage(`⚠️ Error saat mengirim struk ke channel untuk order ${payload.orderId}. Mohon cek log.`).catch(() => {});
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
    `<b>Order ID</b>  : ${escapeTelegramHtml(payload.orderId)}`,
    isDonation
      ? `<b>Username</b> : <tg-spoiler>${escapeTelegramHtml(payload.userName)}</tg-spoiler>\n<b>Email</b>    : <tg-spoiler>${escapeTelegramHtml(maskEmail(payload.userEmail))}</tg-spoiler>\n<b>No. HP</b>   : <tg-spoiler>${escapeTelegramHtml(maskPhone(payload.userPhone || "-"))}</tg-spoiler>`
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
  preOrder?: boolean;
  userName?: string;
  userEmail?: string;
}) {
  const order = await getOrderById(payload.orderId);
  const items = order ? await listOrderItemsByOrderId(payload.orderId) : [];
  const isDonation = items.some((item) => item.productType === "donation");
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
    `<b>Status</b>        : ${payload.preOrder ? "Sudah Bayar | Pre-Order" : telegramStatusLabel("paid")}`,
    `<b>Waktu</b>         : ${escapeTelegramHtml(formatAuditDate())}`,
  ].join("\n");
  const adminOrderUrl = buildAdminOrderUrl(payload.orderId);
  const paymentSuccessKeyboard = {
    inline_keyboard: [[
      { text: "Buka Order Admin", url: adminOrderUrl },
      { text: "Sudah dikirim", callback_data: `delivery:sent:${payload.orderId}` },
    ]],
  };

  let receiptTarget: { chatId: string; messageId: number } | null = null;
  try {
    const firestore = getFirebaseFirestore();
    const orderSnapshot = await firestore?.collection("orders").doc(payload.orderId).get();
    const orderData = orderSnapshot?.exists ? orderSnapshot.data() : undefined;
    const messageId = Number(orderData?.telegramMessageId ?? 0);
    const chatId = String(orderData?.telegramChatId ?? process.env.TELEGRAM_CHAT_ID ?? "").trim();
    if (messageId && chatId && await editTelegramMessage(chatId, messageId, text, paymentSuccessKeyboard)) {
      await firestore?.collection("orders").doc(payload.orderId).set({
        telegramMessageUpdatedAt: Date.now(),
        telegramPaymentNotifiedAt: Date.now(),
      }, { merge: true });
      receiptTarget = { chatId, messageId };
    }
  } catch (error) {
    console.error("Failed to update Telegram payment message:", error);
  }

  if (!receiptTarget) {
    const messageId = await sendTelegramMessage(text, paymentSuccessKeyboard);
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim() || "";
    if (messageId && chatId) receiptTarget = { chatId, messageId };
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!isDonation && order && receiptTarget && botToken) {
    try {
      const receiptSvg = await buildReceiptPhoto({
        orderId: order.id,
        userName: order.userName,
        userEmail: order.userEmail,
        userPhone: order.userPhone,
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
        total: Number(order.totalAmount ?? order.total ?? payload.amount),
      });
      const loadSharp = new Function("return import('sharp')") as () => Promise<{ default: typeof import("sharp").default }>;
      const { default: sharp } = await loadSharp();
      const receiptPhoto = await sharp(Buffer.from(receiptSvg)).png().toBuffer();
      const form = new FormData();
      form.append("chat_id", receiptTarget.chatId);
      form.append("caption", "✅ <b>Pembayaran Berhasil</b>\n\n🧾 Struk transaksi terlampir.");
      form.append("parse_mode", "HTML");
      form.append("photo", new Blob([new Uint8Array(receiptPhoto)], { type: "image/png" }), `tokkomarketplace-struk-${order.id}.png`);
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: "POST",
        body: form,
        cache: "no-store",
      });
      if (!response.ok) console.error("Failed to send Telegram product receipt:", await response.text().catch(() => ""));
    } catch (error) {
      console.error("Failed to generate Telegram product receipt:", error);
    }
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
    "order_reminder",
    "admin_order_status_update",
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
    order_reminder: "📣 <b>PERMINTAAN PROSES ORDER</b>",
    admin_order_status_update: "🔄 <b>STATUS ORDER DIPERBARUI</b>",
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

  const orderId = details.find((detail) => detail.toLowerCase().startsWith("order id:"))?.split(":").slice(1).join(":").trim();
  const reminderKeyboard = orderId && payload.event === "order_reminder"
    ? {
        inline_keyboard: [[
          { text: "Buka Order Admin", url: buildAdminOrderUrl(orderId) },
          { text: "Sudah dikirim", callback_data: `delivery:sent:${orderId}` },
        ]],
      }
    : orderId
      ? { inline_keyboard: [[{ text: "Buka Order Admin", url: buildAdminOrderUrl(orderId) }]] }
      : undefined;
  await sendTelegramMessage(lines.join("\n"), reminderKeyboard);
}

function buildAdminOrderUrl(orderId: string) {
  const origin = (process.env.NEXTAUTH_URL?.trim() || "https://www.tokkomarketplace.shop").replace(/\/$/, "");
  return `${origin}/admin?section=orders&order=${encodeURIComponent(orderId)}`;
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
          requireInteraction: true,
          tag: payload.data?.event || "tokko-update",
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

export async function notifyNativeUsers(payload: {
  title: string;
  body: string;
  url: string;
  userId?: string;
}) {
  // Jika ingin mengandalkan notifikasi Telegram saja (mis. Firebase web push dimatikan di device),
  // aktifkan var env DISABLE_FIREBASE_NOTIFICATIONS=1 atau TELEGRAM_ONLY_NOTIFICATIONS=1
  if (process.env.DISABLE_FIREBASE_NOTIFICATIONS === "1" || process.env.TELEGRAM_ONLY_NOTIFICATIONS === "1") {
    console.info("Skipping Firebase web push notifications because DISABLE_FIREBASE_NOTIFICATIONS / TELEGRAM_ONLY_NOTIFICATIONS is set.");
    return 0;
  }

  try {
    const subscribers = await listUsersWithPushSubscription();
    const targets = payload.userId
      ? subscribers.filter((subscriber) => subscriber.id === payload.userId)
      : subscribers;
    if (targets.length === 0) return 0;

    const results = await Promise.all(
      targets.map((subscriber) => sendFirebaseWebPushMessage({
        token: subscriber.pushSubscription,
        title: payload.title.startsWith("📣") ? payload.title : `📣 ${payload.title}`,
        body: payload.body,
        url: payload.url,
        data: { url: payload.url },
      })),
    );
    return results.filter(Boolean).length;
  } catch (error) {
    console.error("Failed to send automatic native notification:", error);
    return 0;
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
