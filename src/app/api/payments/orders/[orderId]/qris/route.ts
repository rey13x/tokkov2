import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { createDynamicQRCode } from "@/server/payment";
import { getOrderById, updateOrderPayment } from "@/server/store-data";

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
    if (order.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (["paid", "sent"].includes(order.status)) {
      return NextResponse.json({ error: "Order ini sudah dibayar." }, { status: 409 });
    }

    const qrResponse = await createDynamicQRCode({
      userId: session.user.id,
      orderId,
      amount: Math.round(order.total),
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