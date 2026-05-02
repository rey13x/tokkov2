import { NextResponse } from "next/server";
import { createUser } from "@/server/db";
import { hash } from "bcryptjs";

export async function POST(request: Request) {
  // Dev-only endpoint for creating admin
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { message: "This endpoint is only available in development" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { email, username, password } = body;

    if (!email || !username || !password) {
      return NextResponse.json(
        { message: "Email, username, dan password harus diisi" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: "Password minimal 8 karakter" },
        { status: 400 }
      );
    }

    const passwordHash = await hash(password, 10);
    const user = await createUser({
      email,
      username,
      phone: "+62",
      passwordHash,
      role: "admin",
    });

    if (!user) {
      return NextResponse.json(
        { message: "Failed to create admin user" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `✅ Admin berhasil dibuat`,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Create admin failed:", error);
    return NextResponse.json(
      {
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
