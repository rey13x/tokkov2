import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionCookie } from "@/server/firebase-admin";

type AdminIdentity = {
  uid: string;
  email: string;
};

export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (sessionCookie) {
    const decoded = await verifyAdminSessionCookie(sessionCookie);
    if (decoded?.uid && decoded.email) {
      return {
        uid: decoded.uid,
        email: decoded.email,
      };
    }
  }

  const session = await getServerAuthSession();
  if (session?.user?.id && session.user.role === "admin" && session.user.email) {
    return {
      uid: session.user.id,
      email: session.user.email,
    };
  }

  return null;
}

export async function requireAdmin() {
  const admin = await getAdminIdentity();
  if (!admin) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    ok: true as const,
    admin,
  };
}
