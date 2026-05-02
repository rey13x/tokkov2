import { NextRequest, NextResponse } from "next/server";
import { getFirebaseFirestore } from "@/server/firebase-admin";
import { hash } from "bcryptjs";
import { updateUserById } from "@/server/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, newPassword, confirmPassword } = body;

    if (!token || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { message: "Token dan password diperlukan" },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { message: "Password tidak cocok" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { message: "Password minimal 8 karakter" },
        { status: 400 }
      );
    }

    // Find reset token
    const db = getFirebaseFirestore() as any;
    if (!db) {
      return NextResponse.json(
        { message: "Layanan sedang tidak tersedia" },
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
        { message: "Token tidak valid atau sudah digunakan" },
        { status: 400 }
      );
    }

    const tokenDoc = tokensSnapshot.docs[0];
    const tokenData = tokenDoc.data();

    // Check if token expired
    if (new Date() > tokenData.expiresAt.toDate()) {
      return NextResponse.json(
        { message: "Link reset password sudah kadaluarsa" },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await hash(newPassword, 10);

    // Update user password
    await updateUserById(tokenData.userId, {
      passwordHash,
    });

    // Mark token as used
    await tokenDoc.ref.update({
      used: true,
      usedAt: new Date(),
    });

    return NextResponse.json(
      { message: "Password berhasil direset" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { message: "Gagal mereset password" },
      { status: 500 }
    );
  }
}
