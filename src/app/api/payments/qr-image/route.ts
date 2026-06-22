import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth";
import { getOrderById } from "@/server/payment";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 },
      );
    }

    // Fetch order data
    const order = await getOrderById(orderId);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verify user owns this order
    if (order.userId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Return QR image from Rama Shop API
    if (order.qrImage) {
      return NextResponse.json({
        success: true,
        qrImage: order.qrImage,
        amount: order.amount,
        totalAmount: order.totalAmount,
        depositId: order.depositId,
        status: order.status,
      });
    }

    return NextResponse.json(
      { error: "QR image not available" },
      { status: 404 },
    );
  } catch (error) {
    console.error("Error fetching QR image:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch QR image",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
