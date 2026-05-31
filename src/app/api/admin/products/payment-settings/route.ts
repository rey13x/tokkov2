import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth";
import { getFirebaseFirestore } from "@/server/firebase-admin";

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.role || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { productId, paymentMethod, paymentQrisImageUrl } = body;

    if (!productId || !paymentMethod) {
      return NextResponse.json(
        { error: "Missing productId or paymentMethod" },
        { status: 400 },
      );
    }

    // Validate payment method
    if (!["static_qris", "dynamic_qris"].includes(paymentMethod)) {
      return NextResponse.json(
        { error: "Invalid paymentMethod" },
        { status: 400 },
      );
    }

    const db = getFirebaseFirestore();
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const updateData: any = {
      paymentMethod,
      updatedAt: new Date().toISOString(),
    };

    // If static QRIS, update the QR image URL
    if (paymentMethod === "static_qris" && paymentQrisImageUrl) {
      updateData.paymentQrisImageUrl = paymentQrisImageUrl;
      // Clear dynamic QRIS file
      updateData.paymentFileUrl = "";
    }

    // Update product
    await db.collection("products").doc(productId).update(updateData);

    return NextResponse.json({
      success: true,
      productId,
      paymentMethod,
    });
  } catch (error) {
    console.error("Error updating payment settings:", error);
    return NextResponse.json(
      { error: "Failed to update payment settings", details: String(error) },
      { status: 500 },
    );
  }
}
