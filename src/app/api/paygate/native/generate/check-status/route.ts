import { NextResponse, type NextRequest } from "next/server";
import { authenticateNativeApiKey, getPayGateTransaction } from "@/server/paygate/native";

export async function POST(req: NextRequest) {
  const licenseKey = req.headers.get("x-license-key") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const auth = licenseKey ? await authenticateNativeApiKey(licenseKey) : null;
  if (!auth) return NextResponse.json({ status: 401, message: "License key tidak valid" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const trx = body.transactionId ? await getPayGateTransaction(String(body.transactionId)) : null;
  if (!trx || trx.userId !== auth.userId) {
    return NextResponse.json({ status: 404, message: "Transaksi tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({
    status: 200,
    data: {
      transactionId: trx.id,
      amount: trx.amount,
      totalAmount: trx.totalAmount,
      status: trx.status,
      createdAt: new Date(trx.createdAt).toISOString(),
      expiredAt: new Date(trx.expiredAt).toISOString(),
      paidAt: trx.paidAt ? new Date(trx.paidAt).toISOString() : null,
    },
  });
}
