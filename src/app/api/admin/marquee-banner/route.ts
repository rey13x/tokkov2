import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";
import { getAppMetaValue, upsertAppMetaValue } from "@/server/db";

const META_KEY = "homepage_marquee_banner";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const raw = await getAppMetaValue(META_KEY);
  const parsed = raw ? JSON.parse(raw) as { url?: string; radius?: number } : {};
  return NextResponse.json({ url: parsed.url ?? "", radius: Number(parsed.radius ?? 16) });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as { url?: string; radius?: number };
    const url = String(body.url ?? "").trim();
    const radius = Math.min(50, Math.max(0, Number(body.radius ?? 16)));
    if (url && !/^https?:\/\//i.test(url) && !url.startsWith("/")) {
      return NextResponse.json({ message: "URL foto tidak valid." }, { status: 400 });
    }
    await upsertAppMetaValue(META_KEY, JSON.stringify({ url, radius }));
    return NextResponse.json({ url, radius });
  } catch (error) {
    console.error("PUT /api/admin/marquee-banner failed:", error);
    return NextResponse.json({ message: "Gagal menyimpan foto marquee." }, { status: 500 });
  }
}
