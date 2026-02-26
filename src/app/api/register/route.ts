import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser, findUserByEmail, findUserByIdentifier } from "@/server/db";

const registerSchema = z
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = registerSchema.parse(body);

    const existingEmail = await findUserByEmail(payload.email);
    if (existingEmail) {
      return NextResponse.json(
        { message: "Email sudah terdaftar." },
        { status: 409 },
      );
    }

    const existingUsername = await findUserByIdentifier(payload.username);
    if (existingUsername) {
      return NextResponse.json(
        { message: "Username sudah dipakai." },
        { status: 409 },
      );
    }

    const passwordHash = await hash(payload.password, 10);
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

    await createUser({
      username: payload.username.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone.trim(),
      passwordHash,
      role:
        adminEmail && payload.email.trim().toLowerCase() === adminEmail
          ? "admin"
          : "user",
    });

    return NextResponse.json({ message: "Registrasi berhasil." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Gagal registrasi. Coba lagi." },
      { status: 500 },
    );
  }
}

