import { promises as fs } from "fs";
import path from "path";
import PDFDocument from "pdfkit";
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function buildReceiptPdf(input: {
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
  const doc = new PDFDocument({
    size: [320, 760],
    margins: { top: 24, left: 20, right: 20, bottom: 24 },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const logoPath = path.join(process.cwd(), "public", "assets", "logo.png");
  try {
    const logo = await fs.readFile(logoPath);
    doc.image(logo, 132, 16, { fit: [56, 56], align: "center", valign: "center" });
    doc.moveDown(2.9);
  } catch {
    doc.moveDown(0.2);
  }

  doc.fontSize(12).font("Helvetica-Bold").text("TOKKO RAMADHAN", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(9).font("Helvetica");
  doc.text(`Order ID: ${input.orderId}`);
  doc.text(`Tanggal: ${formatDateLabel(input.createdAt)}`);
  doc.text(`Akun: ${input.userName}`);
  doc.text(`Email: ${input.userEmail}`);
  doc.text(`No HP: ${input.userPhone || "-"}`);
  doc.text(`Status: ${input.status}`);
  doc.moveDown(0.4);
  doc.text("========================================");
  doc.moveDown(0.2);

  input.items.forEach((item, index) => {
    const lineTotal = item.quantity * item.unitPrice;
    doc.font("Helvetica-Bold").fontSize(9).text(`${index + 1}. ${item.productName}`);
    doc.font("Helvetica").fontSize(8);
    doc.text(`Qty ${item.quantity} x ${formatRupiah(item.unitPrice)} = ${formatRupiah(lineTotal)}`);
    if (item.productDuration) {
      doc.text(`Durasi: ${item.productDuration}`);
    }
    doc.moveDown(0.25);
  });

  doc.text("========================================");
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(10).text(`Total: ${formatRupiah(input.total)}`);
  doc.moveDown(0.8);
  doc.font("Helvetica").fontSize(8).text("Simpan Struk ini untuk menjaga masa Garansi", {
    align: "center",
  });
  doc.moveDown(0.1);
  doc.fontSize(7).text("** Tokko Ramadhan **", { align: "center" });
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
        <h1>TOKKO RAMADHAN</h1>
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
