import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { findUserById, updateUserById } from "@/server/db";

const resetPasswordSchema = z.object({
  userId: z.string().min(1),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const payload = resetPasswordSchema.parse(body);

    const user = await findUserById(payload.userId);
    if (!user) {
      return NextResponse.json(
        { message: "User tidak ditemukan." },
        { status: 404 },
      );
    }

    // Reset password to null - user must set new password on login
    const updated = await updateUserById(payload.userId, {
      passwordHash: null,
    });

    if (!updated) {
      return NextResponse.json(
        { message: "Gagal reset password user." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: `Password user ${updated.email} berhasil di-reset. User perlu set password baru saat login.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("POST /api/admin/users/reset-password failed:", error);
    return NextResponse.json(
      { message: "Gagal reset password user." },
      { status: 500 },
    );
  }
}
