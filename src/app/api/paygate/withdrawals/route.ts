import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { getPayGateWithdrawals } from "@/server/paygate/read";

export async function GET(req: Request) {
  const session = await getServerAuthSession();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "25");

  try {
    const items = await getPayGateWithdrawals(session.user.id, { limit: Math.min(limit, 100) });
    return NextResponse.json({ ok: true, withdrawals: items });
  } catch {
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
