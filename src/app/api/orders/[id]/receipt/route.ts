import { promises as fs } from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import sharp from "sharp";
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
  if (status === "cancelled") return "Sudah Bayar (Pre-Order)";
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
    productType?: string;
    donationName?: string;
    donationMessage?: string;
  }>;
  total: number;
}) {
  const donation = input.items.find((item) => item.productType === "donation");
  const doc = new PDFDocument({
    size: donation ? "A4" : [420, 920],
    margins: { top: 28, left: 28, right: 28, bottom: 28 },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  if (donation) {
    const pageWidth = 595;
    const pageHeight = 842;
    const logoPath = path.join(process.cwd(), "public", "assets", "maintenancelogo.jpg");
    const signaturePath = path.join(process.cwd(), "public", "assets", "TTD Dev.jpeg");
    const logo = await fs.readFile(logoPath);
    const roundLogo = await sharp(logo)
      .resize(84, 84, { fit: "cover" })
      .composite([{ input: Buffer.from("<svg width=\"84\" height=\"84\"><circle cx=\"42\" cy=\"42\" r=\"42\" fill=\"white\"/></svg>"), blend: "dest-in" }])
      .png()
      .toBuffer();

    doc.rect(0, 0, pageWidth, pageHeight).fill("#050505");
    doc.lineWidth(12).strokeColor("#7d2bbd").rect(10, 10, pageWidth - 20, pageHeight - 20).stroke();
    doc.image(roundLogo, pageWidth - 122, 42, { width: 84, height: 84 });
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(21).text("TOKKO MARKETPLACE", 0, 52, { width: pageWidth, align: "center" });
    doc.fillColor("#d33d91").font("Helvetica-Bold").fontSize(38).text("Sertifikat", 0, 92, { width: pageWidth, align: "center" });
    doc.fillColor("#ffffff").font("Helvetica").fontSize(18).text("Terima kasih kepada:", 0, 185, { width: pageWidth, align: "center" });
    doc.fillColor("#d33d91").font("Helvetica-Bold").fontSize(26).text(donation.donationName || input.userName || "Donatur", 40, 225, { width: pageWidth - 80, align: "center" });
    doc.fillColor("#ffffff").font("Helvetica").fontSize(14).text(
      `Atas donasi yang telah diberikan untuk bantuan ${donation.productName} dengan nominal sebesar:`,
      65, 300, { width: pageWidth - 130, align: "center" },
    );
    doc.fillColor("#d33d91").font("Helvetica-Bold").fontSize(29).text(`Rp ${donation.unitPrice.toLocaleString("id-ID")}`, 0, 370, { width: pageWidth, align: "center" });
    doc.strokeColor("#ffffff").lineWidth(2).moveTo(185, 415).lineTo(410, 415).stroke();
    if (donation.donationMessage) {
      doc.fillColor("#bdbdbd").font("Helvetica-Oblique").fontSize(12).text(`"${donation.donationMessage}"`, 90, 455, { width: pageWidth - 180, align: "center" });
    }
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(15).text("Founder Tokko Marketplace", 0, 590, { width: pageWidth, align: "center" });
    try {
      const signature = await fs.readFile(signaturePath);
      doc.image(signature, 242, 620, { fit: [110, 55] });
    } catch {
      // Signature is optional.
    }
    doc.fillColor("#ffffff").font("Helvetica").fontSize(14).text("Raihaan Bagastiam Pratama", 0, 690, { width: pageWidth, align: "center" });
    doc.fontSize(10).text("tokkomarketplace.shop", 0, 790, { width: pageWidth, align: "center" });
    doc.end();
    return await new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
  }

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
        productType: item.productType,
        donationName: item.donationName,
        donationMessage: item.donationMessage,
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
