import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionFromIdToken,
  verifyAdminSessionCookie,
} from "@/server/firebase-admin";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerAuthSession();
  if (session?.user?.id && session.user.role === "admin" && session.user.email) {
    return NextResponse.json({
      authenticated: true,
      provider: "local",
      user: {
        uid: session.user.id,
        email: session.user.email,
      },
    });
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (sessionCookie) {
    const decoded = await verifyAdminSessionCookie(sessionCookie);
    if (decoded?.uid && decoded.email) {
      return NextResponse.json({
        authenticated: true,
        provider: "firebase",
        user: {
          uid: decoded.uid,
          email: decoded.email,
        },
      });
    }
  }

  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { idToken?: string };
    const idToken = body.idToken?.trim();

    if (!idToken) {
      return NextResponse.json({ message: "ID token wajib diisi." }, { status: 400 });
    }

    const session = await createAdminSessionFromIdToken(idToken);
    if (!session.ok) {
      if (session.reason === "firebase_not_configured") {
        return NextResponse.json(
          { message: "Firebase Admin belum dikonfigurasi." },
          { status: 500 },
        );
      }

      return NextResponse.json(
        { message: "Akun Firebase ini bukan admin." },
        { status: 403 },
      );
    }

    const cookieStore = await cookies();
    cookieStore.set(ADMIN_SESSION_COOKIE, session.sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
      path: "/",
    });

    return NextResponse.json({
      message: "Admin login berhasil.",
      user: {
        uid: session.decodedToken.uid,
        email: session.decodedToken.email,
      },
    });
  } catch {
    return NextResponse.json({ message: "Gagal membuat sesi admin." }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return NextResponse.json({ message: "Admin logout berhasil." });
}
