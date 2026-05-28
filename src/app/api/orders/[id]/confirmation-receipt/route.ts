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

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Params }) {
  try {
    const params = await context.params;
    const orderId = params.id;

    const session = await getServerAuthSession();
    const admin = await getAdminIdentity();

    if (!session?.user?.id && !admin) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ message: "Order tidak ditemukan." }, { status: 404 });
    }

    const isAdmin = Boolean(admin) || session?.user?.role === "admin";
    const ownEmail = (session?.user?.email ?? "").toLowerCase();
    if (!isAdmin && ownEmail !== order.userEmail.toLowerCase()) {
      return NextResponse.json(
        { message: "Akses ditolak. Order bukan milik Anda." },
        { status: 403 },
      );
    }

    // Parse request body to get notes
    const body = (await request.json()) as { notes?: string; receiptImageUrl?: string };
    const notes = (body.notes ?? "").trim();
    const receiptImageUrl = body.receiptImageUrl ?? "";

    // Get order items
    const items = await listOrderItemsByOrderId(orderId);
    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    // Format product items
    const itemLines =
      items && items.length > 0
        ? items
            .map((item, index) => {
              const lineTotal = item.quantity * item.unitPrice;
              return `${index + 1}. ${item.productName}\nQty: ${item.quantity}\nHarga: ${formatRupiah(
                item.unitPrice,
              )}\nTotal: ${formatRupiah(lineTotal)}`;
            })
            .join("\n\n")
        : "-";

    // Build confirmation message
    const messageLines = [
      "Halo Tokko Marketplace saya order produk ini",
      "",
      "SPESIFIKASI PRODUK:",
      itemLines,
      "",
      `HARGA TOTAL: ${formatRupiah(total)}`,
      "",
      "STATUS: Proses",
      "",
      "INFORMASI AKUN:",
      `Username: ${order.userName}`,
      `Email: ${order.userEmail}`,
      `Nomor Telepon: ${order.userPhone || "-"}`,
      "",
      notes ? `CATATAN:\n${notes}` : "",
      "",
      "Mohon konfirmasi.",
    ]
      .filter((line) => line !== "")
      .join("\n");

    // Generate HTML for composite image
    const html = `
<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Konfirmasi Pemesanan ${orderId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f5f7fb; 
      color: #1a2333; 
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container { 
      max-width: 600px; 
      width: 100%;
      background: #ffffff; 
      border-radius: 12px; 
      padding: 24px; 
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      border: 1px solid #dde3ef;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #007AFF;
    }
    .header h1 {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 4px;
      color: #007AFF;
    }
    .message {
      white-space: pre-wrap;
      word-wrap: break-word;
      line-height: 1.6;
      margin-bottom: 24px;
      font-size: 14px;
      color: #333;
      font-family: 'Courier New', monospace;
      background: #f9f9fb;
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid #007AFF;
    }
    .receipt-section {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 2px dashed #dde3ef;
    }
    .receipt-section h2 {
      font-size: 14px;
      font-weight: 700;
      color: #64708a;
      margin-bottom: 12px;
      text-transform: uppercase;
    }
    .receipt-image {
      width: 100%;
      max-width: 400px;
      margin: 16px auto;
      border-radius: 8px;
      border: 1px solid #dde3ef;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      font-size: 12px;
      color: #64708a;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✓ Konfirmasi Pemesanan</h1>
      <p>Order ID: ${orderId}</p>
    </div>
    
    <div class="message">${messageLines}</div>
    
    ${
      receiptImageUrl
        ? `
    <div class="receipt-section">
      <h2>📎 Struk Pemesanan</h2>
      <img src="${receiptImageUrl}" alt="Struk Pemesanan" class="receipt-image" />
    </div>
    `
        : ""
    }
    
    <div class="footer">
      <p>© 2026 Tokko Marketplace - Konfirmasi Otomatis</p>
    </div>
  </div>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("POST /api/orders/[id]/confirmation-receipt failed:", error);
    return NextResponse.json({ message: "Gagal membuat konfirmasi." }, { status: 500 });
  }
}
