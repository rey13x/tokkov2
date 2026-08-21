import { promises as fs } from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { getAdminIdentity } from "@/server/admin";
import { getOrderById, listOrderItemsByOrderId } from "@/server/store-data";

type Params = Promise<{ id: string }>;

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateLabel(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string) {
  if (status === "paid" || ["done", "delivered", "sent"].includes(status)) return "Sudah Bayar";
  if (["error", "rejected", "declined", "failed", "cancelled"].includes(status)) return "Belum Bayar";
  return "Sedang diproses";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function buildReceiptPdf(input: {
  orderId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  status: string;
  createdAt: string;
  depositId?: string;
  paidAt?: string;
  items: Array<{
    productName: string;
    productDuration: string;
    quantity: number;
    unitPrice: number;
  }>;
  total: number;
}) {
  const doc = new PDFDocument({
    size: [420, 920],
    margins: { top: 28, left: 28, right: 28, bottom: 28 },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const logoPath = path.join(process.cwd(), "public", "assets", "maintenancelogo.jpg");
  try {
    const logo = await fs.readFile(logoPath);
    doc.image(logo, 182, 18, { fit: [56, 56], align: "center", valign: "center" });
    doc.moveDown(3.1);
  } catch {
    doc.moveDown(0.2);
  }

  doc.fontSize(15).font("Helvetica-Bold").text("TOKKO MARKETPLACE", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(11).font("Helvetica-Bold").text("Struk Pembayaran", { align: "center" });
  doc.moveDown(0.7);
  doc.fontSize(9).font("Courier");
  const metadata = [
    ["Order ID", input.orderId],
    ["Tanggal", formatDateLabel(input.createdAt)],
    ["Akun", input.userName],
    ["Email", input.userEmail],
    ["No. HP", input.userPhone || "-"],
    ["Status", statusLabel(input.status)],
  ];
  metadata.forEach(([label, value]) => {
    doc.text(`${label.padEnd(8, " ")} : ${value}`);
  });
  doc.moveDown(0.4);
  doc.text("-".repeat(54));
  doc.moveDown(0.2);

  input.items.forEach((item, index) => {
    const lineTotal = item.quantity * item.unitPrice;
    doc.font("Courier-Bold").fontSize(9).text(`${index + 1}. ${item.productName}`);
    doc.font("Courier").fontSize(8.5);
    doc.text(`   ${item.quantity} x ${formatRupiah(item.unitPrice)} = ${formatRupiah(lineTotal)}`);
    if (item.productDuration) {
      doc.text(`Durasi: ${item.productDuration}`);
    }
    doc.moveDown(0.25);
  });

  doc.text("-".repeat(54));
  doc.moveDown(0.3);
  doc.font("Courier-Bold").fontSize(9.5);
  doc.text(`Subtotal : ${formatRupiah(input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0))}`);
  doc.text(`Pajak    : ${formatRupiah(500)}`);
  doc.text(`TOTAL    : ${formatRupiah(input.total)}`);
  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(9).text("PEMBAYARAN BERHASIL");
  if (input.depositId) doc.font("Courier").fontSize(8).text(`Ref: ${input.depositId}`);
  if (input.paidAt) doc.text(`Dibayar: ${formatDateLabel(input.paidAt)}`);
  doc.moveDown(0.5);
  const receiptOrigin = (process.env.NEXTAUTH_URL?.trim() || "https://www.tokkomarketplace.shop").replace(/\/$/, "");
  const qrDataUrl = await QRCode.toDataURL(`${receiptOrigin}/status-pemesanan?order=${encodeURIComponent(input.orderId)}`, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 120,
  });
  doc.image(Buffer.from(qrDataUrl.split(",")[1], "base64"), 28, doc.y, { width: 100, height: 100 });
  doc.font("Helvetica-Bold").fontSize(9).text("Founder", 150, doc.y + 18);
  doc.font("Helvetica").fontSize(8).text("Raihaan Bagastiam Pratama", 150, doc.y + 4);
  const signaturePath = path.join(process.cwd(), "public", "assets", "TTD Dev.jpeg");
  try {
    const signature = await fs.readFile(signaturePath);
    doc.image(signature, 150, doc.y + 16, { fit: [110, 55] });
  } catch {
    // Keep the PDF usable when the optional signature asset is unavailable.
  }
  doc.y = Math.max(doc.y + 112, 790);
  doc.font("Helvetica").fontSize(8).text("Terima kasih sudah berbelanja di Tokko Marketplace.", { align: "center" });
  doc.end();

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function buildReceiptHtml(input: {
  orderId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  status: string;
  createdAt: string;
  items: Array<{
    productName: string;
    productDuration: string;
    quantity: number;
    unitPrice: number;
  }>;
  total: number;
}) {
  const itemsHtml = input.items
    .map((item, index) => {
      const lineTotal = item.quantity * item.unitPrice;
      return `
        <li>
          <strong>${index + 1}. ${escapeHtml(item.productName)}</strong><br/>
          Qty ${item.quantity} x ${formatRupiah(item.unitPrice)} = ${formatRupiah(lineTotal)}
          ${item.productDuration ? `<br/>Durasi: ${escapeHtml(item.productDuration)}` : ""}
        </li>
      `;
    })
    .join("");

  return `
<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Struk ${escapeHtml(input.orderId)}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f7fb; color: #1a2333; margin: 0; padding: 16px; }
    .card { max-width: 520px; margin: 0 auto; background: #fff; border-radius: 14px; padding: 16px; border: 1px solid #dde3ef; }
    .top { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .top img { width: 46px; height: 46px; border-radius: 10px; }
    h1 { margin: 0; font-size: 1.1rem; }
    p { margin: 2px 0; font-size: 0.86rem; }
    ul { padding-left: 18px; margin: 10px 0; }
    li { margin-bottom: 8px; font-size: 0.84rem; line-height: 1.45; }
    .total { margin-top: 10px; font-size: 1rem; font-weight: 700; }
  </style>
</head>
<body>
  <article class="card">
    <div class="top">
      <img src="/assets/logo.png" alt="Tokko" />
      <div>
        <h1>TOKKO</h1>
        <p>Struk pemesanan</p>
      </div>
    </div>
    <p>Order ID: ${escapeHtml(input.orderId)}</p>
    <p>Tanggal: ${escapeHtml(formatDateLabel(input.createdAt))}</p>
    <p>Akun: ${escapeHtml(input.userName)}</p>
    <p>Email: ${escapeHtml(input.userEmail)}</p>
    <p>No HP: ${escapeHtml(input.userPhone || "-")}</p>
    <p>Status: ${escapeHtml(input.status)}</p>
    <ul>${itemsHtml}</ul>
    <p class="total">Total: ${formatRupiah(input.total)}</p>
  </article>
</body>
</html>`;
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

    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const receiptPayload = {
      orderId: order.id,
      userName: order.userName,
      userEmail: order.userEmail,
      userPhone: order.userPhone,
      status: order.status,
      createdAt: order.createdAt,
      depositId: order.depositId,
      paidAt: (order as { paidAt?: string }).paidAt,
      items: items.map((item) => ({
        productName: item.productName,
        productDuration: item.productDuration,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      total,
    };

    try {
      const file = await buildReceiptPdf(receiptPayload);
      return new NextResponse(new Uint8Array(file), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="struk-${order.id}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (pdfError) {
      console.error("PDF generation failed. Falling back to HTML receipt.", pdfError);
      const html = buildReceiptHtml(receiptPayload);
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
  } catch (error) {
    console.error("GET /api/orders/[id]/receipt failed:", error);
    return NextResponse.json({ message: "Gagal membuat struk." }, { status: 500 });
  }
}
