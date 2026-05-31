import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth";
import { getFirebaseFirestore } from "@/server/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.role || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const productId = formData.get("productId") as string;
    const file = formData.get("file") as File;

    if (!productId || !file) {
      return NextResponse.json(
        { error: "Missing productId or file" },
        { status: 400 },
      );
    }

    const db = getFirebaseFirestore();
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    // Convert file to base64
    const fileBuffer = await file.arrayBuffer();
    const base64File = Buffer.from(fileBuffer).toString("base64");
    const fileUrl = `data:${file.type};base64,${base64File}`;

    // Update product in database
    await db.collection("products").doc(productId).update({
      paymentFileUrl: fileUrl,
      paymentMethod: "dynamic_qris",
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      productId,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (error) {
    console.error("Error uploading product file:", error);
    return NextResponse.json(
      { error: "Failed to upload file", details: String(error) },
      { status: 500 },
    );
  }
}
