import { NextResponse } from "next/server";
import receiptline from "receiptline";
import { getServerAuthSession } from "@/server/auth";
import { getAdminIdentity } from "@/server/admin";
import { getOrderById, listOrderItemsByOrderId } from "@/server/store-data";

type Params = Promise<{ id: string }>;
const TAX_AMOUNT = 500;

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function escapeReceiptText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\n/g, "\\n");
}

function statusLabel(status: string) {
  if (status === "paid") return "Sudah Bayar";
  if (["done", "delivered", "sent"].includes(status)) return "Sudah Bayar";
  if (["error", "rejected", "declined", "failed"].includes(status)) return "Belum Bayar";
  return "Sedang diproses";
}

function buildReceiptDocument(input: {
  orderId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  status: string;
  createdAt: string;
  depositId?: string;
  paidAt?: string;
  items: Array<{ productName: string; quantity: number; unitPrice: number }>;
  subtotal: number;
  total: number;
}) {
  const itemLines = input.items.flatMap((item) => [
    escapeReceiptText(item.productName),
    `  ${item.quantity} x ${formatRupiah(item.unitPrice)} = ${formatRupiah(item.unitPrice * item.quantity)}`,
  ]);

  return [
    "{a:center}",
    "TOKKO MARKETPLACE",
    "Struk Pembayaran",
    "{a:left}",
    "--------------------------------",
    `Order ID : ${escapeReceiptText(input.orderId)}`,
    `Tanggal  : ${escapeReceiptText(formatDate(input.createdAt))}`,
    `Akun     : ${escapeReceiptText(input.userName)}`,
    `Email    : ${escapeReceiptText(input.userEmail)}`,
    `No. HP   : ${escapeReceiptText(input.userPhone || "-")}`,
    `Status   : ${statusLabel(input.status)}`,
    "--------------------------------",
    "Produk                         Jumlah",
    ...itemLines,
    `Subtotal : ${formatRupiah(input.subtotal)}`,
    `Pajak    : ${formatRupiah(TAX_AMOUNT)}`,
    `TOTAL    : ${formatRupiah(input.total)}`,
    "--------------------------------",
    "{a:left}",
    "PEMBAYARAN BERHASIL",
    input.depositId ? `Ref: ${escapeReceiptText(input.depositId)}` : "",
    input.paidAt ? `Dibayar: ${escapeReceiptText(formatDate(input.paidAt))}` : "",
    `{code:${escapeReceiptText(`${(process.env.NEXTAUTH_URL?.trim() || "https://www.tokkomarketplace.shop").replace(/\/$/, "")}/status-pemesanan?order=${input.orderId}`)};option:qrcode}`,
    "Terima kasih sudah berbelanja di Tokko Marketplace.",
  ].filter(Boolean).join("\n");
}

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Params }) {
  try {
    const session = await getServerAuthSession();
    const adminIdentity = await getAdminIdentity();
    if (!session?.user?.id && !adminIdentity) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const [order, items] = await Promise.all([getOrderById(id), listOrderItemsByOrderId(id)]);
    if (!order) {
      return NextResponse.json({ message: "Order tidak ditemukan." }, { status: 404 });
    }

    const isAdmin = Boolean(adminIdentity) || session?.user?.role === "admin";
    const ownEmail = (session?.user?.email ?? "").toLowerCase();
    if (!isAdmin && ownEmail !== order.userEmail.toLowerCase()) {
      return NextResponse.json({ message: "Akses struk ditolak." }, { status: 403 });
    }

    const receiptReady = ["paid", "done", "delivered", "sent"].includes(order.status);
    if (!isAdmin && !receiptReady) {
      return NextResponse.json({ message: "Struk baru tersedia setelah pembayaran berhasil." }, { status: 409 });
    }

    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const document = buildReceiptDocument({
      orderId: order.id,
      userName: order.userName,
      userEmail: order.userEmail,
      userPhone: order.userPhone,
      status: order.status,
      createdAt: order.createdAt,
      depositId: order.depositId,
      items: items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      subtotal,
      total: order.total,
    });
    const svg = receiptline.transform(document, {
      cpl: 42,
      encoding: "multilingual",
      command: "svg",
      cutting: false,
      spacing: true,
    });
    const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Struk ${escapeReceiptText(order.id)}</title><style>body{margin:0;background:#eef1f5;display:flex;justify-content:center;padding:16px 8px;font-family:system-ui,sans-serif}.receipt{width:min(360px,100%);background:#fff;padding:12px 10px;box-shadow:0 8px 24px #10131a22}.brand{text-align:center;margin-bottom:4px}.brand img{width:58px;height:58px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 6px}.brand h1{font-size:16px;line-height:1.1;margin:0;font-weight:800}.brand p{font-size:11px;margin:3px 0 0;color:#5b6472}svg{display:block;width:100%;height:auto}.founder{margin-top:8px;font-weight:700}.founder small{display:block;font-weight:400;color:#5b6472}.founder img{display:block;width:110px;height:auto;margin-top:4px}@media print{body{background:#fff;padding:0}.receipt{box-shadow:none;width:100%}}</style></head><body><main class="receipt"><header class="brand"><img src="/assets/maintenancelogo.jpg" alt="Tokko Marketplace"><h1>TOKKO MARKETPLACE</h1><p>Struk Pembayaran</p></header>${svg}<div class="founder">Founder<small>Raihaan Bagastiam Pratama</small><img src="/assets/TTD%20Dev.jpeg" alt="Tanda tangan Founder"></div></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250))</script></body></html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="struk-${order.id}.html"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/orders/[id]/receiptline failed:", error);
    return NextResponse.json({ message: "Gagal membuat struk ReceiptLine." }, { status: 500 });
  }
}
