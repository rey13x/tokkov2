import { NextRequest, NextResponse } from "next/server";
import { getFirebaseFirestore } from "@/server/firebase-admin";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, message: "Token diperlukan" },
        { status: 400 }
      );
    }

    // Find reset token
    const db = getFirebaseFirestore() as any;
    if (!db) {
      return NextResponse.json(
        { valid: false, message: "Layanan sedang tidak tersedia" },
        { status: 500 }
      );
    }
    const tokensSnapshot = await db
      .collection("passwordResetTokens")
      .where("token", "==", token)
      .where("used", "==", false)
      .limit(1)
      .get();

    if (tokensSnapshot.empty) {
      return NextResponse.json(
        { valid: false, message: "Token tidak valid atau sudah digunakan" },
        { status: 400 }
      );
    }

    const tokenData = tokensSnapshot.docs[0].data();

    // Check if token expired
    if (new Date() > tokenData.expiresAt.toDate()) {
      return NextResponse.json(
        { valid: false, message: "Link reset password sudah kadaluarsa" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { valid: true, email: tokenData.email },
      { status: 200 }
    );
  } catch (error) {
    console.error("Token verification error:", error);
    return NextResponse.json(
      { valid: false, message: "Gagal verifikasi token" },
      { status: 500 }
    );
  }
}
