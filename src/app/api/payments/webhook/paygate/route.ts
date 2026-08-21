import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  generatePaymentNotes,
  getOrderByTransactionId,
  updateOrderStatus,
  isDonationOrder,
} from "@/server/payment";
import { recordDonationTotals } from "@/server/store-data";
import { notifyNativeUsers, sendTelegramPaymentSuccessNotification } from "@/server/notifications";

export const runtime = "nodejs";

function verifySignature(rawBody: string, receivedSignature: string | null) {
  const secret = process.env.PAYGATE_WEBHOOK_SECRET?.trim();
  if (!secret || !receivedSignature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = receivedSignature.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(received)) return false;
  return crypto.timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-paygate-signature"))) {
    return NextResponse.json({ ok: false, error: "Signature tidak valid." }, { status: 401 });
  }

  let payload: {
    transactionId?: string;
    amount?: number;
    status?: string;
    paidAt?: string;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Payload JSON tidak valid." }, { status: 400 });
  }

  const transactionId = String(payload.transactionId || "").trim();
  const amount = Number(payload.amount);
  if (!transactionId || !Number.isFinite(amount) || !["paid", "success"].includes(String(payload.status).toLowerCase())) {
    return NextResponse.json({ ok: false, error: "Payload pembayaran tidak lengkap." }, { status: 400 });
  }

  const order = await getOrderByTransactionId(transactionId);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Transaksi tidak ditemukan." }, { status: 404 });
  }

  const expectedAmount = Number(order.totalAmount ?? order.total ?? 0);
  if (amount !== expectedAmount) {
    return NextResponse.json({ ok: false, error: "Nominal pembayaran tidak sesuai." }, { status: 409 });
  }

  if (order.status !== "paid") {
    await updateOrderStatus(order.id, "paid", {
      depositId: transactionId,
      paidAmount: amount,
      paymentNotes: generatePaymentNotes({
        depositId: transactionId,
        amount,
        method: "merchant qris",
        timestamp: payload.paidAt || new Date().toISOString(),
      }),
    });
    if (await isDonationOrder(order)) {
      await recordDonationTotals(order.id);
    }
    void notifyNativeUsers({
      userId: order.userId,
      title: "Pembayaran berhasil",
      body: `Pembayaran order ${order.id} sudah dikonfirmasi.`,
      url: "/status-pemesanan",
    });

    await sendTelegramPaymentSuccessNotification({
      orderId: order.id,
      transactionId,
      amount,
      userName: String(order.userName || order.customerName || ""),
      userEmail: String(order.userEmail || order.customerEmail || ""),
    });
  }

  return NextResponse.json({ ok: true, status: "paid", transactionId });
}
