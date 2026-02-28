import { promises as fs } from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
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

async function buildReceiptPdf(input: {
  orderId: string;
  userName: string;
  userEmail: string;
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
  doc.text(`Nama: ${input.userName}`);
  doc.text(`Gmail: ${input.userEmail}`);
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

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Params }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const [order, items] = await Promise.all([getOrderById(id), listOrderItemsByOrderId(id)]);
  if (!order) {
    return NextResponse.json({ message: "Order tidak ditemukan." }, { status: 404 });
  }

  const isAdmin = session.user.role === "admin";
  const ownEmail = (session.user.email ?? "").toLowerCase();
  if (!isAdmin && ownEmail !== order.userEmail.toLowerCase()) {
    return NextResponse.json({ message: "Akses struk ditolak." }, { status: 403 });
  }

  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const file = await buildReceiptPdf({
    orderId: order.id,
    userName: order.userName,
    userEmail: order.userEmail,
    createdAt: order.createdAt,
    items: items.map((item) => ({
      productName: item.productName,
      productDuration: item.productDuration,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    total,
  });

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="struk-${order.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
