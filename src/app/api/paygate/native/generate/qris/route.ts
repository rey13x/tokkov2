import { NextResponse, type NextRequest } from "next/server";
import { authenticateNativeApiKey, createPayGateTransaction } from "@/server/paygate/native";

export async function POST(req: NextRequest) {
  const licenseKey = req.headers.get("x-license-key") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const auth = licenseKey ? await authenticateNativeApiKey(licenseKey) : null;
  if (!auth) return NextResponse.json({ status: 401, message: "License key tidak valid" }, { status: 401 });

  try {
    const body = await req.json();
    const trx = await createPayGateTransaction({
      store: auth.store,
      amount: Number(body.amount),
      externalId: body.externalId || body.orderId || "",
      useUniqueCode: body.useUniqueCode !== false,
      expiredInMinutes: Number(body.expiredInMinutes || 15),
      customerName: body.customerName || "",
      customerEmail: body.customerEmail || "",
      customerPhone: body.customerPhone || "",
      callbackUrl: body.callbackUrl || "",
    });
    return NextResponse.json({
      status: 200,
      message: "Transaksi QRIS dibuat",
      data: {
        transactionId: trx.id,
        amount: trx.amount,
        totalAmount: trx.totalAmount,
        uniqueCode: trx.uniqueCode,
        status: trx.status,
        qr_string: trx.qrString,
        expiredAt: new Date(trx.expiredAt).toISOString(),
        createdAt: new Date(trx.createdAt).toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { status: 400, message: error instanceof Error ? error.message : "Gagal membuat transaksi" },
      { status: 400 },
    );
  }
}
