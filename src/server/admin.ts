import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";

export async function requireAdmin() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    };
  }

  if (session.user.role !== "admin") {
    return {
      ok: false as const,
      response: NextResponse.json({ message: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
    session,
  };
}

