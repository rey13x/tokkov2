import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth";
import {
  createDynamicQRCode,
  saveOrder,
  QR_CODE_VALIDITY_SECONDS,
} from "@/server/payment";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      orderId,
      items,
      subtotal,
      tax,
      total,
      customerName,
      customerEmail,
      customerPhone,
    } = body;

    if (!orderId || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 },
      );
    }

    // Create QRIS QR Code using Rama Shop API
    const qrResponse = await createDynamicQRCode({
      orderId,
      amount: Math.round(total), // Ensure integer amount
      description: `Pembayaran Tokko - Order ${orderId}`,
      customerName,
      customerEmail,
      customerPhone,
    });

    // Save order to database
    await saveOrder(session.user.id, {
      orderId,
      depositId: qrResponse.depositId,
      items,
      subtotal,
      tax,
      total,
      qrString: qrResponse.qrString,
      customerEmail,
      customerPhone,
    });

    return NextResponse.json({
      success: true,
      orderId,
      depositId: qrResponse.depositId,
      qrCode: qrResponse.qrString,
      amount: qrResponse.amount,
      expiresIn: QR_CODE_VALIDITY_SECONDS,
      createdAt: qrResponse.createdAt,
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
