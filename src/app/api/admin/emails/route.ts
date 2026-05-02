import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { getAdminEmails, addAdminEmail, removeAdminEmail } from "@/server/db";

const MAIN_ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "digitalawanku@gmail.com";

export async function GET() {
  try {
    const session = await getServerAuthSession();

    // Only main admin can access this
    if (!session?.user?.email || session.user.email.toLowerCase() !== MAIN_ADMIN_EMAIL) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 403 },
      );
    }

    const adminEmails = await getAdminEmails();
    return NextResponse.json({ adminEmails });
  } catch (error) {
    console.error("Error fetching admin emails:", error);
    return NextResponse.json(
      { message: "Gagal mengambil data admin." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();

    // Only main admin can access this
    if (!session?.user?.email || session.user.email.toLowerCase() !== MAIN_ADMIN_EMAIL) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 403 },
      );
    }

    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { message: "Email tidak valid." },
        { status: 400 },
      );
    }

    const normalized = email.trim().toLowerCase();

    // Validate email format
    if (!normalized.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return NextResponse.json(
        { message: "Format email tidak valid." },
        { status: 400 },
      );
    }

    const success = await addAdminEmail(normalized, session.user.email);

    if (!success) {
      return NextResponse.json(
        { message: "Email sudah ada di daftar admin." },
        { status: 409 },
      );
    }

    return NextResponse.json({ message: "Admin berhasil ditambahkan." });
  } catch (error) {
    console.error("Error adding admin email:", error);
    return NextResponse.json(
      { message: "Gagal menambahkan admin." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerAuthSession();

    // Only main admin can access this
    if (!session?.user?.email || session.user.email.toLowerCase() !== MAIN_ADMIN_EMAIL) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { message: "Email parameter required." },
        { status: 400 },
      );
    }

    // Prevent removing main admin email
    if (email.toLowerCase() === MAIN_ADMIN_EMAIL) {
      return NextResponse.json(
        { message: "Tidak bisa menghapus email admin utama." },
        { status: 400 },
      );
    }

    await removeAdminEmail(email);
    return NextResponse.json({ message: "Admin berhasil dihapus." });
  } catch (error) {
    console.error("Error removing admin email:", error);
    return NextResponse.json(
      { message: "Gagal menghapus admin." },
      { status: 500 },
    );
  }
}
