import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth";
import { getFirebaseFirestore } from "@/server/firebase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await params;

    const db = getFirebaseFirestore();
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    // Get order from database
    const orderDoc = await db.collection("orders").doc(orderId).get();

    if (!orderDoc.exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orderDoc.data();

    // Verify order belongs to user and is paid
    if (order?.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (order?.status !== "paid") {
      return NextResponse.json(
        { error: "Order not paid yet" },
        { status: 400 },
      );
    }

    // Get product file URLs from order items
    const items = order?.items || [];
    const fileUrls: Array<{ productName: string; fileUrl: string }> = [];

    for (const item of items) {
      if (item.productId) {
        const productDoc = await db?.collection("products")
          .doc(item.productId)
          .get();

        if (productDoc.exists) {
          const product = productDoc.data();
          if (
            product?.paymentMethod === "dynamic_qris" &&
            product?.paymentFileUrl
          ) {
            fileUrls.push({
              productName: item.productName,
              fileUrl: product.paymentFileUrl,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      orderId,
      fileUrls,
    });
  } catch (error) {
    console.error("Error fetching download files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files", details: String(error) },
      { status: 500 },
    );
  }
}
