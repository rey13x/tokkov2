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

function buildReceiptImageHtml(input: {
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
        <div style="margin-bottom: 12px; font-size: 14px;">
          <strong>${index + 1}. ${escapeHtml(item.productName)}</strong><br/>
          Qty ${item.quantity} x ${formatRupiah(item.unitPrice)} = ${formatRupiah(lineTotal)}
          ${item.productDuration ? `<br/>Durasi: ${escapeHtml(item.productDuration)}` : ""}
        </div>
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
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f5f7fb; 
      color: #1a2333; 
      padding: 16px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .receipt { 
      max-width: 520px; 
      width: 100%;
      background: #ffffff; 
      border-radius: 16px; 
      padding: 24px; 
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      border: 1px solid #dde3ef;
    }
    .header { 
      text-align: center; 
      margin-bottom: 20px; 
      padding-bottom: 16px;
      border-bottom: 2px dashed #dde3ef;
    }
    .logo-area {
      display: flex;
      justify-content: center;
      margin-bottom: 12px;
    }
    .logo {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #007AFF 0%, #0051D5 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 24px;
    }
    .header h1 { 
      font-size: 20px; 
      font-weight: 700;
      margin-bottom: 8px;
    }
    .header p {
      font-size: 13px;
      color: #64708a;
    }
    .info-section {
      margin-bottom: 16px;
      padding: 12px;
      background: #f9f9fb;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.6;
    }
    .info-label {
      color: #64708a;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .info-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 13px;
    }
    .info-item strong {
      color: #1a2333;
    }
    .info-item span {
      color: #64708a;
      word-break: break-all;
    }
    .items-section {
      margin: 20px 0;
      padding: 16px 0;
      border-top: 2px dashed #dde3ef;
      border-bottom: 2px dashed #dde3ef;
    }
    .items-label {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64708a;
      margin-bottom: 12px;
    }
    .item {
      margin-bottom: 12px;
      font-size: 13px;
      line-height: 1.5;
    }
    .item strong {
      color: #1a2333;
      display: block;
      margin-bottom: 4px;
    }
    .item small {
      color: #64708a;
      display: block;
    }
    .total-section {
      margin-bottom: 16px;
      padding: 16px 12px;
      background: linear-gradient(135deg, #007AFF15 0%, #0051D515 100%);
      border-radius: 8px;
      border-left: 4px solid #007AFF;
    }
    .total-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
      font-size: 13px;
    }
    .total-line.grand {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #007AFF30;
      font-size: 16px;
      font-weight: 700;
      color: #007AFF;
    }
    .footer {
      text-align: center;
      padding-top: 16px;
      border-top: 2px dashed #dde3ef;
      font-size: 12px;
      color: #64708a;
    }
    .footer strong {
      display: block;
      margin-top: 8px;
      color: #1a2333;
    }
  </style>
</head>
<body>
  <div class="receipt" id="receipt-container">
    <div class="header">
      <div class="logo-area">
        <div class="logo">🎫</div>
      </div>
      <h1>TOKKO</h1>
      <p>Struk Pemesanan</p>
    </div>

    <div class="info-section">
      <div class="info-label">Detail Pesanan</div>
      <div class="info-item">
        <strong>Order ID:</strong>
        <span>${escapeHtml(input.orderId)}</span>
      </div>
      <div class="info-item">
        <strong>Tanggal:</strong>
        <span>${formatDateLabel(input.createdAt)}</span>
      </div>
    </div>

    <div class="info-section">
      <div class="info-label">Informasi Akun</div>
      <div class="info-item">
        <strong>Nama:</strong>
        <span>${escapeHtml(input.userName)}</span>
      </div>
      <div class="info-item">
        <strong>Email:</strong>
        <span>${escapeHtml(input.userEmail)}</span>
      </div>
      <div class="info-item">
        <strong>No. HP:</strong>
        <span>${escapeHtml(input.userPhone || "-")}</span>
      </div>
      <div class="info-item">
        <strong>Status:</strong>
        <span>${escapeHtml(input.status)}</span>
      </div>
    </div>

    <div class="items-section">
      <div class="items-label">Produk yang Dibeli</div>
      ${itemsHtml}
    </div>

    <div class="total-section">
      <div class="total-line">
        <strong>Subtotal:</strong>
        <span>${formatRupiah(input.total)}</span>
      </div>
      <div class="total-line grand">
        <strong>Total:</strong>
        <span>${formatRupiah(input.total)}</span>
      </div>
    </div>

    <div class="footer">
      <p>Simpan struk ini untuk menjaga masa garansi produk Anda</p>
      <strong>© 2026 Tokko Marketplace</strong>
    </div>
  </div>

  <script>
    // Auto-capture and download after page load
    window.addEventListener('load', function() {
      setTimeout(function() {
        if (window.parent !== window) {
          window.parent.postMessage({ type: 'receipt-ready' }, '*');
        }
      }, 100);
    });
  </script>
</body>
</html>
  `;
}

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Params }) {
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

    const items = await listOrderItemsByOrderId(orderId);

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

    const html = buildReceiptImageHtml(receiptPayload);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/orders/[id]/receipt-image failed:", error);
    return NextResponse.json({ message: "Gagal membuat struk." }, { status: 500 });
  }
}
