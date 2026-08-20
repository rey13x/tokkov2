import { NextResponse, type NextRequest } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { listPayGateTransactions } from "@/server/paygate/native";

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  const limit = Number(new URL(req.url).searchParams.get("limit") || 50);
  const transactions = await listPayGateTransactions(session.user.id, limit);
  return NextResponse.json({ ok: true, transactions });
}
