import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth";
import {
  createDynamicQRCode,
  QR_CODE_VALIDITY_SECONDS,
} from "@/server/payment";
import { getOrderById, updateOrderPayment } from "@/server/store-data";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 },
      );
    }

    const order = await getOrderById(String(orderId));
    if (!order || order.userId !== session.user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Create QRIS QR Code using Rama Shop API
    const qrResponse = await createDynamicQRCode({
      userId: session.user.id,
      orderId,
      amount: Math.round(order.total),
      description: `Pembayaran Tokko - Order ${orderId}`,
    });

    // Save order to database
    await updateOrderPayment(String(orderId), {
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
      expiresIn: QR_CODE_VALIDITY_SECONDS,
      createdAt: qrResponse.createdAt,
      expiredAt: qrResponse.expiredAt,
    });
  } catch (error) {
    console.error("Error creating QR code:", error);
    return NextResponse.json(
      {
        error: "Failed to create QR code",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
