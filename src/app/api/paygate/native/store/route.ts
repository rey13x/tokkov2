import { NextResponse, type NextRequest } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { ensurePayGateStore, updatePayGateStore } from "@/server/paygate/native";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  const store = await ensurePayGateStore({
    id: session.user.id,
    username: session.user.name,
    email: session.user.email,
  });
  return NextResponse.json({ ok: true, store: { ...store, webhookSecret: "" } });
}

export async function PUT(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  try {
    await ensurePayGateStore({ id: session.user.id, username: session.user.name, email: session.user.email });
    const body = await req.json();
    const store = await updatePayGateStore(session.user.id, {
      slug: body.slug,
      name: body.name,
      description: body.description,
      website: body.website,
      bannerUrl: body.bannerUrl,
      logoUrl: body.logoUrl,
      theme: body.theme,
      isActive: Boolean(body.isActive),
      qrisName: body.qrisName,
      staticQris: body.staticQris,
      packageIds: String(body.packageIds || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      minAmount: Number(body.minAmount),
      maxAmount: Number(body.maxAmount),
      allowCustomAmount: Boolean(body.allowCustomAmount),
      presetAmounts: String(body.presetAmounts || "")
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isFinite(item) && item > 0),
      telegramChatId: body.telegramChatId,
      webhookUrl: body.webhookUrl,
      webhookSecret: typeof body.webhookSecret === "string" && body.webhookSecret.trim()
        ? body.webhookSecret.trim()
        : undefined,
    });
    return NextResponse.json({ ok: true, store });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Konfigurasi gagal disimpan." },
      { status: 400 },
    );
  }
}
