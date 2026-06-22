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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, depositId } = body;

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
    
    actualDepositId = actualDepositId || order.depositId;

    if (!actualDepositId) {
      return NextResponse.json(
        { error: "Deposit ID not found for this order" },
        { status: 400 },
      );
    }

    // Verify payment status from Rama Shop API
    const paymentStatus = await verifyPaymentStatus(actualDepositId);

    // Update order status in database
    if (paymentStatus.status === "success") {
      // Generate payment notes
      const paymentNotes = generatePaymentNotes({
        depositId: actualDepositId,
        amount: paymentStatus.paidAmount || paymentStatus.amount || order.total,
        method: "qris",
        timestamp: new Date().toISOString(),
      });

      await updateOrderStatus(
        orderId,
        "paid",
        {
          depositId: actualDepositId,
          paidAmount: paymentStatus.paidAmount,
          paymentNotes,
        },
      );
      
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
