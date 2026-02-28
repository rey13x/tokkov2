import crypto from "crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  findUserByEmail,
  findUserByIdentifier,
  getEmailVerificationByEmail,
  upsertEmailVerification,
} from "@/server/db";
import { sendVerificationCodeEmail } from "@/server/email";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

const requestCodeSchema = z
  .object({
    username: z.string().min(2).max(40),
    email: z.string().email(),
    phone: z.string().min(8).max(20),
    password: z.string().min(6).max(120),
    confirmPassword: z.string().min(6).max(120),
  })
  .refine((payload) => payload.password === payload.confirmPassword, {
    message: "Konfirmasi password tidak sama.",
    path: ["confirmPassword"],
  });

function hashOtp(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function createOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = requestCodeSchema.parse(body);

    const email = payload.email.trim().toLowerCase();
    const username = payload.username.trim();
    const phone = payload.phone.trim();

    const [existingEmail, existingUsername] = await Promise.all([
      findUserByEmail(email),
      findUserByIdentifier(username),
    ]);

    if (existingEmail) {
      return NextResponse.json({ message: "Gmail sudah terdaftar." }, { status: 409 });
    }

    if (existingUsername) {
      return NextResponse.json({ message: "Username sudah dipakai." }, { status: 409 });
    }

    const pending = await getEmailVerificationByEmail(email);
    if (pending) {
      const waitMs = RESEND_COOLDOWN_MS - (Date.now() - pending.createdAt);
      if (waitMs > 0) {
        return NextResponse.json(
          {
            message: `Tunggu ${Math.ceil(waitMs / 1000)} detik sebelum kirim ulang kode.`,
          },
          { status: 429 },
        );
      }
    }

    const otpCode = createOtpCode();
    const [passwordHash, otpHash] = await Promise.all([
      hash(payload.password, 10),
      Promise.resolve(hashOtp(otpCode)),
    ]);

    await upsertEmailVerification({
      email,
      username,
      phone,
      passwordHash,
      otpHash,
      expiresAt: Date.now() + OTP_TTL_MS,
    });

    await sendVerificationCodeEmail({
      to: email,
      username,
      code: otpCode,
    });

    return NextResponse.json({
      message: "Kode verifikasi sudah dikirim ke Gmail kamu.",
      expiresInSeconds: OTP_TTL_MS / 1000,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Gagal kirim kode verifikasi. Coba lagi." },
      { status: 500 },
    );
  }
}
