import { NextResponse } from "next/server";
// dynamic import of receiptline handled inside function - optional dependency

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

async function receiptlineQr(orderId: string) {
  // Try to use optional 'receiptline' package to render a compact SVG QR.
  // If not available, fallback to embedding a PNG data URL generated with 'qrcode'.
  const targetUrl = `https://tokkov2.vercel.app/#${orderId}`;
  try {
    const r = await import("receiptline");
    if (r && typeof r.transform === "function") {
      const document = ["{a:left}", `{code:${targetUrl};option:qrcode}`].join("\n");
      return r.transform(document, { cpl: 42, encoding: "multilingual", command: "svg", cutting: false, spacing: true });
    }
  } catch (err) {
    // ignore and fallback
  }

  try {
    const QRCode = await import("qrcode");
    const dataUrl = await QRCode.toDataURL(targetUrl, { errorCorrectionLevel: "H", margin: 1, width: 210 });
    // return an <img> tag that will render in the receipt HTML
    return `<img src="${dataUrl}" alt="QR" style="width:210px;height:210px;display:block;margin:auto"/>`;
  } catch (err) {
    // as ultimate fallback, return an empty placeholder
    return `<div style="width:210px;height:210px;background:#f3f4f6;border-radius:6px;margin:auto"></div>`;
  }
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
    const qr = await receiptlineQr(order.id);
    const logoUrl = "/assets/maintenancelogo.jpg";
    const signatureUrl = "/assets/TTD%20Dev.jpeg";

    // Detect donation order (any item marked as donation)
    const isDonation = items.some((it) => (it as any).productType === "donation" || /donasi|donation/i.test(String((it as any).productName || "")));

    if (isDonation) {
      const donationItem = items.find((it) => (it as any).productType === "donation") || items[0];
      const donorName = escapeHtml((donationItem as any).donationName || order.userName || order.userEmail || "Donatur");
      const donationTitle = escapeHtml((donationItem as any).productName || "Donasi");
      const donationAmount = Number(donationItem.quantity ?? 1) * Number(donationItem.unitPrice ?? 0);

      const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sertifikat Donasi - Tokko Marketplace</title><style>
  @page{size:A4 landscape;margin:0}
  *{box-sizing:border-box}
  body{margin:0;background:#eef0f5;color:#111;font-family:Arial,Helvetica,sans-serif;padding:16px;display:flex;justify-content:center;align-items:center;min-height:100vh}
  .receipt{width:min(1120px,100%);aspect-ratio:297/210;position:relative;overflow:hidden;background:#fff;border:3px solid #111;padding:6%;display:flex;flex-direction:column;justify-content:space-between}
  .receipt:before{content:"";position:absolute;inset:14px;border:1px solid #111;pointer-events:none}
  .top{text-align:center;position:relative;z-index:1}
  .top h1{margin:0;font-size:clamp(24px,4vw,54px);letter-spacing:1px;font-weight:800}
  .top p{margin:10px 0 0;font-size:clamp(10px,1.3vw,17px);font-weight:700;letter-spacing:2px}
  .content{display:flex;align-items:center;justify-content:center;position:relative;z-index:1}
  .donor{text-align:center;max-width:78%;min-width:0}
  .donor-label{font-size:clamp(10px,1.3vw,17px);font-weight:700}
  .donor-name{margin:10px 0 14px;font-size:clamp(20px,3.2vw,44px);font-weight:800;overflow-wrap:anywhere}
  .donation-title{font-size:clamp(10px,1.25vw,16px);font-weight:700;overflow-wrap:anywhere}
  .amount{margin-top:12px;font-size:clamp(18px,2.7vw,38px);font-weight:800}
  .bottom-row{display:flex;align-items:flex-end;justify-content:center;gap:12%;position:relative;z-index:1}
  .signature{width:28%;min-width:150px;text-align:center}
  .signature-label{font-size:clamp(10px,1.2vw,15px);font-weight:700;margin-bottom:5px}
  .signature img{display:block;width:100%;height:auto;max-height:100px;object-fit:contain;margin:0 auto}
  .signature small{display:block;font-size:clamp(8px,1vw,13px);font-weight:400;margin-top:4px}
  .signature small:last-child{font-size:clamp(7px,.85vw,11px)}
  .brand{display:flex;align-items:center;justify-content:center;gap:12px;width:28%;min-width:150px;position:relative;z-index:1}
  .brand img{width:clamp(42px,6vw,82px);height:clamp(42px,6vw,82px);border-radius:50%;object-fit:cover}
  .brand span{font-size:clamp(11px,1.4vw,18px);font-weight:700}
  @media print{body{background:#fff;padding:0}.receipt{width:100%;border:3px solid #111}}
</style></head><body><main class="receipt"><section class="top"><h1>SERTIFIKAT DONASI</h1><p>Terima kasih atas dukungan dan kebaikan Anda</p></section><section class="content"><div class="donor"><div class="donor-label">Diberikan kepada</div><div class="donor-name">${donorName}</div><div class="donation-title">Atas donasi untuk: ${donationTitle}</div><div class="amount">${formatRupiah(donationAmount)}</div></div></section><section class="bottom-row"><div class="brand"><img src="${logoUrl}" alt="Logo Tokko Marketplace"><span>Tokko Marketplace</span></div><div class="signature"><div class="signature-label">Founder</div><img src="${signatureUrl}" alt="Tanda tangan Founder"><small>Raihaan Bagastiam Pratama</small></div></section></main></body></html>`;

      return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `inline; filename="sertifikat-donasi-${order.id}.html"`, "Cache-Control": "no-store" } });
    }

    // Non-donation / default receipt
    const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Struk Tokko Marketplace</title><style>
body{margin:0;background:#edf0f4;color:#111;font-family:Georgia,"Times New Roman",serif;padding:16px 8px}.receipt{width:min(520px,100%);box-sizing:border-box;margin:auto;background:#fff;padding:30px 26px;box-shadow:0 8px 24px #10131a22}.brand{text-align:center}.brand img{width:96px;height:96px;border-radius:50%;object-fit:cover;display:block;margin:auto}.brand h1{font-family:Georgia,"Times New Roman",serif;font-size:29px;margin:12px 0 3px;text-transform:none}.brand p{font-size:14px;color:#5d6674;margin:0 0 20px}.meta{border-top:1px solid #111;border-bottom:1px solid #111;padding:12px 0;margin-bottom:14px;font-size:13px;line-height:1.7}.receipt table{width:100%;border-collapse:collapse;font-size:13px}.receipt th,.receipt td{padding:10px 5px;border-bottom:1px solid #151515}.receipt th{text-align:left;font-size:12px}.receipt th:nth-child(2),.receipt td:nth-child(2){text-align:center}.receipt th:nth-child(n+3),.receipt td:nth-child(n+3){text-align:right}.total{border-top:2px solid #111;margin-top:11px;padding-top:13px;text-align:right;font-size:21px;font-weight:800}.bottom{display:flex;justify-content:space-between;align-items:flex-start;border-top:1px solid #111;margin-top:20px;padding-top:16px}.qr{width:154px;height:154px;overflow:hidden}.qr svg{width:154px;height:154px}.founder{text-align:right;font-size:16px;font-weight:700}.founder img{display:block;width:154px;height:72px;object-fit:contain;margin:7px 0 0 auto}.founder small{font-size:11px;font-weight:400;white-space:nowrap}.thanks{text-align:center;font-size:12px;font-weight:700;margin:24px 0 0}@media print{body{background:#fff;padding:0}.receipt{box-shadow:none;width:100%}}</style></head><body><main class="receipt"><header class="brand"><img src="${logoUrl}" alt="Tokko Marketplace"><h1>Tokko Marketplace</h1><p>Struk Pembayaran</p></header><section class="meta"><b>No. Invoice:</b> #${escapeHtml(order.id)}<br><b>Tanggal:</b> ${escapeHtml(formatDate(order.createdAt))}<br><b>Status:</b> Pembayaran Berhasil</section><table><thead><tr><th>ITEM</th><th>QTY</th><th>HARGA SATUAN</th><th>JUMLAH</th></tr></thead><tbody>${rows}</tbody></table><div class="total">TOTAL: ${formatRupiah(total)}</div><div class="bottom"><div class="qr">${qr}</div><div class="founder">Founder<img src="${signatureUrl}" alt=""><small>Raihaan Bagastiam Pratama</small></div></div><p class="thanks">Terima Kasih sudah berbelanja di Tokko Marketplace</p></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250))</script></body></html>`;

    const styledHtml = html.replace(/<script>[\s\S]*?<\/script>/gi, "").replace(
      "</style>",
      "body{font-family:Arial,\"Helvetica Neue\",sans-serif}.brand img{width:96px;height:96px;border-radius:50%;object-fit:cover}.brand h1{font-family:Arial,\"Helvetica Neue\",sans-serif;font-weight:800}.qr{width:210px;height:210px}.qr svg{width:210px;height:210px}</style>",
    );
    return new NextResponse(styledHtml, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `attachment; filename="struk-${order.id}.html"`, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ReceiptLine receipt failed:", error);
    return NextResponse.json({ message: "Gagal membuat struk." }, { status: 500 });
  }
}
