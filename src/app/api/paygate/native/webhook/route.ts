import { NextResponse, type NextRequest } from "next/server";
import { markPayGateTransactionPaid, timingSafeSignature } from "@/server/paygate/native";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paygate-signature") || "";
  const secret = process.env.PAYGATE_WEBHOOK_SECRET || "";
  if (!secret || !signature || !timingSafeSignature(rawBody, secret, signature)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    if (payload.status !== "paid") return NextResponse.json({ ok: true, ignored: true });
    const transaction = await markPayGateTransactionPaid({
      transactionId: String(payload.transactionId || ""),
      amount: Number(payload.amount),
      packageName: payload.packageName,
      appName: payload.appName,
      paidAt: payload.paidAt,
      raw: payload,
    });
    return NextResponse.json({ ok: true, transaction });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Webhook gagal diproses" },
      { status: 400 },
    );
  }
}
