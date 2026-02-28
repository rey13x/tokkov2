import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createUser,
  deleteEmailVerificationByEmail,
  findUserByEmail,
  findUserByIdentifier,
  getEmailVerificationByEmail,
  incrementEmailVerificationAttempts,
} from "@/server/db";
import { enforceRateLimit } from "@/server/rate-limit";

const MAX_VERIFY_ATTEMPTS = 5;

const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6).regex(/^\d{6}$/),
});

function hashOtp(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimited = enforceRateLimit({
    request,
    keyPrefix: "signup-verify-code",
    limit: 10,
    windowMs: 60 * 1000,
  });
  if (rateLimited) {
    return rateLimited;
  }

  if (process.env.EMAIL_OTP_ENABLED !== "true") {
    return NextResponse.json(
      { message: "Pendaftaran via email OTP sedang dinonaktifkan." },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const payload = verifyCodeSchema.parse(body);
    const email = payload.email.trim().toLowerCase();
    const codeHash = hashOtp(payload.code.trim());

    const pending = await getEmailVerificationByEmail(email);
    if (!pending) {
      return NextResponse.json(
        { message: "Data pendaftaran tidak ditemukan. Kirim kode lagi." },
        { status: 404 },
      );
    }

    if (Date.now() > pending.expiresAt) {
      await deleteEmailVerificationByEmail(email);
      return NextResponse.json(
        { message: "Kode verifikasi sudah kedaluwarsa. Kirim kode baru." },
        { status: 400 },
      );
    }

    if (pending.attempts >= MAX_VERIFY_ATTEMPTS) {
      await deleteEmailVerificationByEmail(email);
      return NextResponse.json(
        { message: "Terlalu banyak percobaan. Kirim kode baru." },
        { status: 429 },
      );
    }

    if (pending.otpHash !== codeHash) {
      await incrementEmailVerificationAttempts(email);
      const remaining = Math.max(0, MAX_VERIFY_ATTEMPTS - (pending.attempts + 1));
      return NextResponse.json(
        { message: `Kode verifikasi salah. Sisa percobaan: ${remaining}.` },
        { status: 400 },
      );
    }

    const [existingEmail, existingUsername] = await Promise.all([
      findUserByEmail(email),
      findUserByIdentifier(pending.username),
    ]);

    if (existingEmail) {
      await deleteEmailVerificationByEmail(email);
      return NextResponse.json({ message: "Gmail sudah terdaftar." }, { status: 409 });
    }

    if (existingUsername) {
      return NextResponse.json({ message: "Username sudah dipakai." }, { status: 409 });
    }

    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    await createUser({
      username: pending.username,
      email,
      phone: pending.phone,
      passwordHash: pending.passwordHash,
      role: adminEmail && email === adminEmail ? "admin" : "user",
    });

    await deleteEmailVerificationByEmail(email);
    return NextResponse.json({ message: "Pendaftaran berhasil. Silakan masuk." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Verifikasi gagal. Coba lagi." },
      { status: 500 },
    );
  }
}
