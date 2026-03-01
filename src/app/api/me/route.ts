import { compare, hash } from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/server/auth";
import {
  deletePasswordChangeOtpByUserId,
  findUserById,
  getPasswordChangeOtpByUserId,
  incrementPasswordChangeOtpAttempts,
  updateUserById,
} from "@/server/db";

const MAX_OTP_ATTEMPTS = 5;

const updateSchema = z.object({
  username: z.string().min(2).max(40),
  email: z.string().email(),
  phone: z.string().min(8).max(20),
  oldPassword: z.string().optional().default(""),
  newPassword: z.string().optional().default(""),
  otpCode: z.string().optional().default(""),
});

function hashOtp(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const user = await findUserById(session.user.id);
  if (!user) {
    return NextResponse.json({ message: "User tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role,
  });
}

export async function PATCH(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = updateSchema.parse(body);
    const user = await findUserById(session.user.id);

    if (!user) {
      return NextResponse.json({ message: "User tidak ditemukan" }, { status: 404 });
    }

    let passwordHash = user.passwordHash;
    const wantsPasswordChange = payload.newPassword.trim().length > 0;

    if (wantsPasswordChange) {
      if (!user.passwordHash) {
        return NextResponse.json(
          { message: "Akun Google belum punya password lama." },
          { status: 400 },
        );
      }

      const oldPasswordValid = await compare(payload.oldPassword, user.passwordHash);
      if (!oldPasswordValid) {
        return NextResponse.json(
          { message: "Password lama tidak cocok." },
          { status: 400 },
        );
      }

      if (payload.newPassword.length < 6) {
        return NextResponse.json(
          { message: "Password baru minimal 6 karakter." },
          { status: 400 },
        );
      }

      const otpCode = payload.otpCode.trim();
      if (!/^\d{6}$/.test(otpCode)) {
        return NextResponse.json(
          { message: "Masukkan OTP 6 digit untuk ganti password." },
          { status: 400 },
        );
      }

      const pendingOtp = await getPasswordChangeOtpByUserId(user.id);
      if (!pendingOtp) {
        return NextResponse.json(
          { message: "OTP belum diminta. Klik kirim OTP dulu." },
          { status: 400 },
        );
      }

      if (Date.now() > pendingOtp.expiresAt) {
        await deletePasswordChangeOtpByUserId(user.id);
        return NextResponse.json(
          { message: "OTP sudah kedaluwarsa. Kirim OTP baru." },
          { status: 400 },
        );
      }

      if (pendingOtp.attempts >= MAX_OTP_ATTEMPTS) {
        await deletePasswordChangeOtpByUserId(user.id);
        return NextResponse.json(
          { message: "Terlalu banyak percobaan OTP. Kirim OTP baru." },
          { status: 429 },
        );
      }

      if (pendingOtp.otpHash !== hashOtp(otpCode)) {
        await incrementPasswordChangeOtpAttempts(user.id);
        const remaining = Math.max(0, MAX_OTP_ATTEMPTS - (pendingOtp.attempts + 1));
        return NextResponse.json(
          { message: `OTP salah. Sisa percobaan: ${remaining}.` },
          { status: 400 },
        );
      }

      passwordHash = await hash(payload.newPassword, 10);
    }

    const updated = await updateUserById(user.id, {
      username: payload.username.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone.trim(),
      passwordHash,
    });

    if (!updated) {
      return NextResponse.json({ message: "Gagal update profil." }, { status: 500 });
    }

    if (wantsPasswordChange) {
      await deletePasswordChangeOtpByUserId(user.id);
    }

    return NextResponse.json({
      message: "Profil berhasil diperbarui.",
      user: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        phone: updated.phone,
        avatarUrl: updated.avatarUrl,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    if (error instanceof Error) {
      const detail = error.message.toLowerCase();
      if (detail.includes("unique") || detail.includes("duplicate")) {
        return NextResponse.json(
          { message: "Email sudah dipakai akun lain." },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      { message: "Gagal update profil. Coba lagi." },
      { status: 500 },
    );
  }
}
