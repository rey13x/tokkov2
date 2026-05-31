import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth";
import {
  verifyPaymentStatus,
  updateOrderStatus,
  getOrderById,
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
    if (!actualDepositId) {
      const order = await getOrderById(orderId);
      if (!order) {
        return NextResponse.json(
          { error: "Order not found" },
          { status: 404 },
        );
      }
      actualDepositId = order.depositId;
    }

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
      await updateOrderStatus(
        orderId,
        "paid",
        {
          depositId: actualDepositId,
          paidAmount: paymentStatus.paidAmount,
        },
      );
    } else if (paymentStatus.status === "expired") {
      await updateOrderStatus(orderId, "expired");
    }

    // Get updated order details
    const order = await getOrderById(orderId);

    return NextResponse.json({
      success: true,
      status: paymentStatus.status,
      depositId: actualDepositId,
      order,
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
