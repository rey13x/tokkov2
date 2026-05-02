import { NextResponse } from "next/server";
import { findUserByEmail, updateUserById } from "@/server/db";
import { hash } from "bcryptjs";

export async function POST(request: Request) {
  // Dev-only endpoint for password reset
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { message: "This endpoint is only available in development" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { email, newPassword } = body;

    if (!email || !newPassword) {
      return NextResponse.json(
        { message: "Email dan password harus diisi" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { message: "Password minimal 8 karakter" },
        { status: 400 }
      );
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { message: "User tidak ditemukan" },
        { status: 404 }
      );
    }

    const passwordHash = await hash(newPassword, 10);
    await updateUserById(user.id, { passwordHash });

    return NextResponse.json({
      message: `✅ Password berhasil direset untuk ${email}`,
      userId: user.id,
    });
  } catch (error) {
    console.error("Reset password failed:", error);
    return NextResponse.json(
      {
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
