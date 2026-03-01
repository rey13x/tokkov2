import { promises as fs } from "fs";
import path from "path";

const exportDir = path.join(process.cwd(), "storage", "exports");
const csvFile = path.join(exportDir, "orders.csv");
const JAKARTA_TIMEZONE = "Asia/Jakarta";

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

async function sendTelegramMessage(text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return;
  }

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
    cache: "no-store",
  }).catch(() => {});
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
        `${index + 1}. ${item.productName} x${item.quantity} (Rp ${item.unitPrice.toLocaleString("id-ID")})`,
    )
    .join("\n");

  const text = [
    "Orderan Masuk!",
    `Order ID: ${payload.orderId}`,
    `Nama: ${payload.userName}`,
    `Email: ${payload.userEmail}`,
    `No HP: ${payload.userPhone || "-"}`,
    `Waktu: ${formatAuditDate()}`,
    "",
    "Detail Produk:",
    lines,
    "",
    `Total: Rp ${payload.total.toLocaleString("id-ID")}`,
  ].join("\n");

  await sendTelegramMessage(text);
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
  const details = payload.metadata?.filter(Boolean) ?? [];
  const lines = [
    "Info Aktivitas",
    `Event: ${payload.event}`,
    `Waktu: ${formatAuditDate(payload.occurredAt)}`,
    `Akun: ${payload.actorName || "-"}`,
    `Email: ${payload.actorEmail || "-"}`,
    `No HP: ${payload.actorPhone || "-"}`,
    `Detail: ${payload.description}`,
    ...(details.length > 0 ? ["", ...details] : []),
  ];

  await sendTelegramMessage(lines.join("\n"));
}
