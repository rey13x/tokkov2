import { NextResponse } from "next/server";
import receiptline from "receiptline";
import { getServerAuthSession } from "@/server/auth";
import { getAdminIdentity } from "@/server/admin";
import { getOrderById, listOrderItemsByOrderId } from "@/server/store-data";

type Params = Promise<{ id: string }>;

function escapeHtml(value: unknown) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function receiptlineQr(orderId: string) {
  const document = [
    "{a:left}",
    `{code:https://tokkov2.vercel.app/#${orderId};option:qrcode}`,
  ].join("\n");
  return receiptline.transform(document, { cpl: 42, encoding: "multilingual", command: "svg", cutting: false, spacing: true });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Params }) {
  try {
    const session = await getServerAuthSession();
    const adminIdentity = await getAdminIdentity();
    if (!session?.user?.id && !adminIdentity) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const [order, items] = await Promise.all([getOrderById(id), listOrderItemsByOrderId(id)]);
    if (!order) return NextResponse.json({ message: "Order tidak ditemukan." }, { status: 404 });

    const isAdmin = Boolean(adminIdentity) || session?.user?.role === "admin";
    if (!isAdmin && session?.user?.email?.toLowerCase() !== order.userEmail.toLowerCase()) {
      return NextResponse.json({ message: "Akses struk ditolak." }, { status: 403 });
    }
    if (!isAdmin && !["paid", "done", "delivered", "sent"].includes(order.status)) {
      return NextResponse.json({ message: "Struk baru tersedia setelah pembayaran berhasil." }, { status: 409 });
    }

    const rows = items.map((item) => `<tr><td>${escapeHtml(item.productName)}</td><td>${item.quantity}</td><td>${formatRupiah(item.unitPrice)}</td><td>${formatRupiah(item.unitPrice * item.quantity)}</td></tr>`).join("");
    const total = Number(order.total ?? 0);
    const qr = receiptlineQr(order.id);
    const logoUrl = "/assets/maintenancelogo.jpg";
    const signatureUrl = "/assets/TTD%20Dev.jpeg";
    const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Struk Tokko Marketplace</title><style>
body{margin:0;background:#edf0f4;color:#111;font-family:Georgia,"Times New Roman",serif;padding:16px 8px}.receipt{width:min(520px,100%);box-sizing:border-box;margin:auto;background:#fff;padding:30px 26px;box-shadow:0 8px 24px #10131a22}.brand{text-align:center}.brand img{width:96px;height:96px;border-radius:50%;object-fit:cover;display:block;margin:auto}.brand h1{font-family:Georgia,"Times New Roman",serif;font-size:29px;margin:12px 0 3px;text-transform:none}.brand p{font-size:14px;color:#5d6674;margin:0 0 20px}.meta{border-top:1px solid #111;border-bottom:1px solid #111;padding:12px 0;margin-bottom:14px;font-size:13px;line-height:1.7}.receipt table{width:100%;border-collapse:collapse;font-size:13px}.receipt th,.receipt td{padding:10px 5px;border-bottom:1px solid #151515}.receipt th{text-align:left;font-size:12px}.receipt th:nth-child(2),.receipt td:nth-child(2){text-align:center}.receipt th:nth-child(n+3),.receipt td:nth-child(n+3){text-align:right}.total{border-top:2px solid #111;margin-top:11px;padding-top:13px;text-align:right;font-size:21px;font-weight:800}.bottom{display:flex;justify-content:space-between;align-items:flex-start;border-top:1px solid #111;margin-top:20px;padding-top:16px}.qr{width:154px;height:154px;overflow:hidden}.qr svg{width:154px;height:154px}.founder{text-align:right;font-size:16px;font-weight:700}.founder img{display:block;width:154px;height:72px;object-fit:contain;margin:7px 0 0 auto}.founder small{font-size:11px;font-weight:400;white-space:nowrap}.thanks{text-align:center;font-size:12px;font-weight:700;margin:24px 0 0}@media print{body{background:#fff;padding:0}.receipt{box-shadow:none;width:100%}}</style></head><body><main class="receipt"><header class="brand"><img src="${logoUrl}" alt="Tokko Marketplace"><h1>Tokko Marketplace</h1><p>Struk Pembayaran</p></header><section class="meta"><b>No. Invoice:</b> #${escapeHtml(order.id)}<br><b>Tanggal:</b> ${escapeHtml(formatDate(order.createdAt))}<br><b>Status:</b> Pembayaran Berhasil</section><table><thead><tr><th>ITEM</th><th>QTY</th><th>HARGA SATUAN</th><th>JUMLAH</th></tr></thead><tbody>${rows}</tbody></table><div class="total">TOTAL: ${formatRupiah(total)}</div><div class="bottom"><div class="qr">${qr}</div><div class="founder">Founder<img src="${signatureUrl}" alt=""><small>Raihaan Bagastiam Pratama</small></div></div><p class="thanks">Terima Kasih sudah berbelanja di Tokko Marketplace</p></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250))</script></body></html>`;

    const styledHtml = html.replace(/<script>[\s\S]*?<\/script>/gi, "").replace(
      "</style>",
      "body{font-family:Arial,\"Helvetica Neue\",sans-serif}.brand img{width:128px;height:96px;border-radius:0;object-fit:contain}.brand h1{font-family:Arial,\"Helvetica Neue\",sans-serif;font-weight:800}</style>",
    );
    return new NextResponse(styledHtml, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `inline; filename="struk-${order.id}.html"`, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ReceiptLine receipt failed:", error);
    return NextResponse.json({ message: "Gagal membuat struk." }, { status: 500 });
  }
}
