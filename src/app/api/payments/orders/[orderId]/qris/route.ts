import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { createQRCodeForExistingOrder } from "@/server/payment";

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
    const qrResponse = await createQRCodeForExistingOrder(orderId, session.user.id);

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