import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { updateUserLastActive } from "@/server/db";

export async function POST() {
  const session = await getServerAuthSession();

  if (!session || !session.user?.id) {
    return NextResponse.json(
      { message: "Not authenticated" },
      { status: 401 },
    );
  }

  try {
    await updateUserLastActive(session.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to update user last active time:", error);
    return NextResponse.json(
      { ok: false },
      { status: 500 },
    );
  }
}
