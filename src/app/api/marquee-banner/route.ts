import { NextResponse } from "next/server";
import { getAppMetaValue } from "@/server/db";

const META_KEY = "homepage_marquee_banner";
const DEFAULT_BANNER = { url: "", radius: 16 };

export async function GET() {
  try {
    const raw = await getAppMetaValue(META_KEY);
    const parsed = raw ? JSON.parse(raw) as { url?: string; radius?: number } : {};
    return NextResponse.json({
      url: typeof parsed.url === "string" ? parsed.url : DEFAULT_BANNER.url,
      radius: Number.isFinite(parsed.radius) ? Math.min(50, Math.max(0, Number(parsed.radius))) : DEFAULT_BANNER.radius,
    }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("GET /api/marquee-banner failed:", error);
    return NextResponse.json(DEFAULT_BANNER);
  }
}
