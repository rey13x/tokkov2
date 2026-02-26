import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/server/auth";
import { findUserById, updateUserById } from "@/server/db";

const updateSchema = z.object({
  username: z.string().min(2).max(40),
  email: z.string().email(),
  phone: z.string().max(20),
  oldPassword: z.string().optional().default(""),
  newPassword: z.string().optional().default(""),
});

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

    return NextResponse.json({
      message: "Profil berhasil diperbarui.",
      user: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        phone: updated.phone,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Gagal update profil. Coba lagi." },
      { status: 500 },
    );
  }
}

