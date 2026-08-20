import { NextResponse, type NextRequest } from "next/server";
import { getPayGateTransaction } from "@/server/paygate/native";

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("transactionId") || "";
  const trx = id ? await getPayGateTransaction(id) : null;
  if (!trx) return NextResponse.json({ ok: false, error: "Transaksi tidak ditemukan." }, { status: 404 });
  return NextResponse.json({
    ok: true,
    transaction: {
      id: trx.id,
      amount: trx.amount,
      totalAmount: trx.totalAmount,
      status: trx.status,
      paidAt: trx.paidAt,
      expiredAt: trx.expiredAt,
    },
  });
}
