import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth";
import {
  verifyPaymentStatus,
  updateOrderStatus,
  getOrderById,
  generateOrderWhatsAppLink,
  generatePaymentNotes,
} from "@/server/payment";
import { recordDonationTotals } from "@/server/store-data";
import {
  sendTelegramActivityNotification,
  sendTelegramPaymentReviewNotification,
  sendTelegramPaymentSuccessNotification,
  notifyNativeUsers,
} from "@/server/notifications";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, depositId, notifyTelegram } = body;

    if (!orderId && !depositId) {
      return NextResponse.json(
        { error: "Order ID or Deposit ID is required" },
        { status: 400 },
      );
    }

    // Get order details to find depositId if not provided
    let actualDepositId = depositId;
    let order = await getOrderById(orderId);
    
    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 },
      );
    }

    if (order.userId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    actualDepositId = actualDepositId || order.depositId;

    if (!actualDepositId) {
      return NextResponse.json(
        { error: "Deposit ID not found for this order" },
        { status: 400 },
      );
    }

    // Verify payment status from Rama Shop API (prefer per-user key)
    const paymentStatus = await verifyPaymentStatus(
      actualDepositId,
      order.userId,
    );

    // Update order status in database
    if (paymentStatus.status === "success") {
      const wasAlreadyPaid = ["paid", "sent"].includes(order.status);
      // Generate payment notes
      const paymentNotes = generatePaymentNotes({
        depositId: actualDepositId,
        amount: paymentStatus.paidAmount || paymentStatus.amount || order.total,
        method: "qris",
        timestamp: new Date().toISOString(),
      });

      if (!wasAlreadyPaid) {
        await updateOrderStatus(
          orderId,
          "paid",
          {
            depositId: actualDepositId,
            paidAmount: paymentStatus.paidAmount,
            paymentNotes,
          },
        );
      }
      if (!wasAlreadyPaid) {
        await recordDonationTotals(orderId);
        void notifyNativeUsers({
          userId: order.userId,
          title: "Pembayaran berhasil",
          body: `Pembayaran order ${order.id} sudah dikonfirmasi.`,
          url: "/status-pemesanan",
        });
        await sendTelegramPaymentSuccessNotification({
          orderId,
          transactionId: actualDepositId,
          amount: Number(paymentStatus.paidAmount || paymentStatus.amount || order.total),
          userName: String(order.userName || ""),
          userEmail: String(order.userEmail || ""),
        });
      }
      
      // Generate WhatsApp notification link after successful payment
      let whatsappLink = "";
      try {
        if (order.customerPhone) {
          whatsappLink = await generateOrderWhatsAppLink(orderId, order.customerPhone);
        }
      } catch (error) {
        console.error("[PAYMENT] Error generating WhatsApp link:", error);
        // Continue even if WhatsApp link generation fails
      }
      
      paymentStatus.whatsappLink = whatsappLink;
    } else if (paymentStatus.status === "expired") {
      await updateOrderStatus(orderId, "expired");
    } else if (notifyTelegram === true) {
      await sendTelegramActivityNotification({
        event: "payment_check",
        actorName: String(order.userName || "User"),
        actorEmail: String(order.userEmail || "-"),
        actorPhone: String(order.userPhone || ""),
        description: `User mengecek transaksi order ${order.id}.`,
        metadata: [`Order ID: ${order.id}`, `Nominal: Rp ${Number(order.totalAmount ?? order.total ?? 0).toLocaleString("id-ID")}`],
      });
      await sendTelegramPaymentReviewNotification({
        orderId: order.id,
        amount: Number(order.totalAmount ?? order.total ?? 0),
        userName: String(order.userName || order.customerName || ""),
        userEmail: String(order.userEmail || order.customerEmail || ""),
      });
    }

    // Get updated order details
    order = await getOrderById(orderId);

    return NextResponse.json({
      success: true,
      status: paymentStatus.status,
      depositId: actualDepositId,
      order,
      whatsappLink: paymentStatus.whatsappLink,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    return NextResponse.json(
      {
        error: "Failed to verify payment",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
