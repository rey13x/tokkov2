import { NextResponse, type NextRequest } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { createNativeApiKey, listNativeApiKeys } from "@/server/paygate/native";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  const apiKeys = await listNativeApiKeys(session.user.id);
  return NextResponse.json({ ok: true, apiKeys });
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const apiKey = await createNativeApiKey(session.user.id, body.name || "Default");
  return NextResponse.json({ ok: true, apiKey });
}
