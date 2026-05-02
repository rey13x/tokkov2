import { NextRequest, NextResponse } from "next/server";
import { getFirebaseFirestore } from "@/server/firebase-admin";
import { findUserByEmail } from "@/server/db";
import { sendPasswordResetEmail } from "@/server/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { message: "Email diperlukan" },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await findUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists for security
      return NextResponse.json(
        { message: "Jika email terdaftar, link reset password akan dikirim" },
        { status: 200 }
      );
    }

    // Generate reset token (use crypto for better security)
    const resetToken = Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token valid for 1 hour

    // Store reset token in Firestore
    const db = getFirebaseFirestore() as any;
    if (!db) {
      return NextResponse.json(
        { message: "Sistem sedang bermasalah. Silakan coba lagi nanti." },
        { status: 500 }
      );
    }
    await db.collection("passwordResetTokens").add({
      userId: user.id,
      email: user.email,
      token: resetToken,
      createdAt: new Date(),
      expiresAt,
      used: false,
    });

    // Send email with reset link
    const resetLink = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}`;
    await sendPasswordResetEmail(user.email || "", resetLink, user.username);

    return NextResponse.json(
      { message: "Link reset password sudah dikirim ke email kamu" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Password reset request error:", error);
    const errorMessage = error instanceof Error ? error.message : "";
    
    // Check if error is due to SMTP config
    if (errorMessage.includes("Konfigurasi SMTP")) {
      return NextResponse.json(
        { message: "Fitur reset password sedang tidak tersedia. Hubungi support atau coba cara lain." },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { message: "Gagal memproses permintaan. Silakan coba lagi nanti." },
      { status: 500 }
    );
  }
}
