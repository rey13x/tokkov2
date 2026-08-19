import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { getPayGateAccount } from "@/server/paygate/read";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  }

  try {
    const account = await getPayGateAccount(session.user.id);
    return NextResponse.json({ ok: true, account: account ?? null });
  } catch {
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
