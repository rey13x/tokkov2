import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { getPayGateApiKeys } from "@/server/paygate/read";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  }

  try {
    const keys = await getPayGateApiKeys(session.user.id);
    return NextResponse.json({ ok: true, apiKeys: keys });
  } catch {
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
