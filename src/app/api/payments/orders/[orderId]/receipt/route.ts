import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth";
import { getFirebaseFirestore } from "@/server/firebase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await params;

    const db = getFirebaseFirestore();
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    // Get order from database
    const orderDoc = await db.collection("orders").doc(orderId).get();

    if (!orderDoc.exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orderDoc.data();

    // Verify order belongs to user
    if (order?.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Generate receipt HTML
    const receiptHtml = generateReceiptHtml(order, orderId);

    // Return as HTML that can be printed/saved
    return new NextResponse(receiptHtml, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="struk-${orderId}.html"`,
      },
    });
  } catch (error) {
    console.error("Error generating receipt:", error);
    return NextResponse.json(
      { error: "Failed to generate receipt", details: String(error) },
      { status: 500 },
    );
  }
}

function generateReceiptHtml(
  order: any,
  orderId: string,
): string {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const itemsHtml = (order.items || [])
    .map(
      (item: any) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.productName}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatRupiah(item.unitPrice)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatRupiah(item.unitPrice * item.quantity)}</td>
    </tr>
  `,
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Struk Pembayaran - ${orderId}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        .receipt {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 30px;
            background-color: #f9f9f9;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #11151E;
            padding-bottom: 15px;
        }
        .logo-text {
            font-size: 28px;
            font-weight: 700;
            color: #11151E;
            margin: 0;
        }
        .receipt-title {
            font-size: 18px;
            font-weight: 600;
            color: #11151E;
            margin: 15px 0 5px 0;
        }
        .receipt-number {
            font-size: 12px;
            color: #666;
            margin: 0;
        }
        .order-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 25px 0;
            font-size: 13px;
        }
        .info-group label {
            font-weight: 600;
            color: #11151E;
            display: block;
            margin-bottom: 4px;
        }
        .info-group p {
            margin: 0;
            color: #666;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 25px 0;
        }
        table thead {
            background-color: #f0f0f0;
        }
        table th {
            padding: 12px 8px;
            text-align: left;
            font-weight: 600;
            color: #11151E;
            font-size: 13px;
        }
        table td {
            padding: 8px;
            font-size: 13px;
        }
        .summary {
            border-top: 2px solid #11151E;
            padding-top: 15px;
            margin-top: 15px;
        }
        .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 13px;
        }
        .summary-row.total {
            font-size: 16px;
            font-weight: 700;
            color: #11151E;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid #eee;
        }
        .status {
            text-align: center;
            margin: 25px 0;
            padding: 15px;
            border-radius: 8px;
            font-weight: 600;
        }
        .status.paid {
            background-color: #d4edda;
            color: #155724;
        }
        .status.pending {
            background-color: #fff3cd;
            color: #856404;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #999;
        }
        @media print {
            body {
                padding: 0;
                margin: 0;
            }
            .receipt {
                border: none;
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <div class="receipt">
        <div class="header">
            <p class="logo-text">TOKKO</p>
            <h2 class="receipt-title">Struk Pembayaran</h2>
            <p class="receipt-number">Order #${orderId}</p>
        </div>

        <div class="order-info">
            <div class="info-group">
                <label>Nama Pemesan:</label>
                <p>${order.customerName || order.userName || "-"}</p>
            </div>
            <div class="info-group">
                <label>Email:</label>
                <p>${order.customerEmail || order.userEmail || "-"}</p>
            </div>
            <div class="info-group">
                <label>Tanggal Pemesanan:</label>
                <p>${formatDate(order.createdAt)}</p>
            </div>
            <div class="info-group">
                <label>Tanggal Pembayaran:</label>
                <p>${order.paidAt ? formatDate(order.paidAt) : "-"}</p>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Produk</th>
                    <th>Qty</th>
                    <th>Harga</th>
                    <th>Subtotal</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>

        <div class="summary">
            <div class="summary-row">
                <span>Subtotal:</span>
                <span>${formatRupiah(order.subtotal || 0)}</span>
            </div>
            <div class="summary-row">
                <span>Pajak (11%):</span>
                <span>${formatRupiah(order.tax || 0)}</span>
            </div>
            <div class="summary-row total">
                <span>Total:</span>
                <span>${formatRupiah(order.total || 0)}</span>
            </div>
        </div>

        <div class="status ${order.status}">
            ${order.status === "paid" ? "✓ Pembayaran Berhasil" : "Menunggu Pembayaran"}
        </div>

        <div class="footer">
            <p>Terima kasih telah berbelanja di TOKKO Marketplace!</p>
            <p>Untuk pertanyaan, hubungi support@tokko.id</p>
            <p style="margin-top: 15px; font-size: 11px;">Dokumen ini dicetak pada ${new Date().toLocaleString("id-ID")}</p>
        </div>
    </div>
</body>
</html>
  `;
}
