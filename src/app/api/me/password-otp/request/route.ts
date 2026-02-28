import crypto from "crypto";
import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import {
  findUserById,
  getPasswordChangeOtpByUserId,
  upsertPasswordChangeOtp,
} from "@/server/db";
import { sendPasswordChangeOtpEmail } from "@/server/email";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function hashOtp(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function createOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserById(session.user.id);
    if (!user) {
      return NextResponse.json({ message: "User tidak ditemukan." }, { status: 404 });
    }

    const pending = await getPasswordChangeOtpByUserId(user.id);
    if (pending) {
      const waitMs = RESEND_COOLDOWN_MS - (Date.now() - pending.createdAt);
      if (waitMs > 0) {
        return NextResponse.json(
          { message: `Tunggu ${Math.ceil(waitMs / 1000)} detik untuk kirim ulang OTP.` },
          { status: 429 },
        );
      }
    }

    const code = createOtpCode();
    await upsertPasswordChangeOtp({
      userId: user.id,
      email: user.email,
      otpHash: hashOtp(code),
      expiresAt: Date.now() + OTP_TTL_MS,
    });

    await sendPasswordChangeOtpEmail({
      to: user.email,
      username: user.username,
      code,
    });

    return NextResponse.json({
      message: "OTP verifikasi sudah dikirim ke Gmail kamu.",
      expiresInSeconds: OTP_TTL_MS / 1000,
    });
  } catch {
    return NextResponse.json({ message: "Gagal mengirim OTP." }, { status: 500 });
  }
}
