import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { createDynamicQRCode } from "@/server/payment";
import { getOrderById, listOrderItemsByOrderId, updateOrderPayment } from "@/server/store-data";

const ORDER_TAX_AMOUNT = 500;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await params;
    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const sameUserId = order.userId === session.user.id;
    const sameVerifiedEmail = Boolean(
      session.user.email
      && order.userEmail
      && order.userEmail.trim().toLowerCase() === session.user.email.trim().toLowerCase(),
    );
    if (!sameUserId && !sameVerifiedEmail) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (["paid", "sent"].includes(order.status)) {
      return NextResponse.json({ error: "Order ini sudah dibayar." }, { status: 409 });
    }

    const items = await listOrderItemsByOrderId(orderId);
    const calculatedSubtotal = items.reduce((sum, item) => {
      const unitPrice = item.productType === "donation"
        ? item.donationAmount ?? item.unitPrice
        : item.unitPrice;
      return sum + unitPrice * item.quantity;
    }, 0);
    const calculatedTaxableSubtotal = items
      .filter((item) => item.productType !== "donation")
      .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const calculatedTotal = calculatedSubtotal + (calculatedTaxableSubtotal > 0 ? ORDER_TAX_AMOUNT : 0);
    const paymentAmount = Math.round(calculatedTotal > 0 ? calculatedTotal : order.total);

    const qrResponse = await createDynamicQRCode({
      userId: session.user.id,
      orderId,
      amount: paymentAmount,
      description: `Pembayaran Tokko - Order ${orderId}`,
      customerName: order.userName,
      customerEmail: order.userEmail,
      customerPhone: order.userPhone,
    });
    await updateOrderPayment(orderId, {
      paymentMethod: "dynamic_qris",
      qrCode: qrResponse.qrString,
      qrImage: qrResponse.qrImage,
      totalAmount: qrResponse.totalAmount,
      uniqueCode: qrResponse.uniqueCode,
      depositId: qrResponse.depositId,
      paymentExpiresAt: qrResponse.expiredAt,
    });

    return NextResponse.json({
      success: true,
      orderId,
      depositId: qrResponse.depositId,
      qrCode: qrResponse.qrString,
      qrImage: qrResponse.qrImage,
      amount: qrResponse.amount,
      totalAmount: qrResponse.totalAmount,
      uniqueCode: qrResponse.uniqueCode,
      expiresIn: qrResponse.expiresIn,
      expiredAt: qrResponse.expiredAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "QRIS belum berhasil dibuat.";
    const status = /akses|tidak ditemukan/i.test(message) ? 404 : 502;
    console.error("Error creating QRIS for existing order:", error);
    return NextResponse.json({ error: message }, { status });
  }
}