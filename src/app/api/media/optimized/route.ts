import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const rawUrl = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return new NextResponse("Invalid image URL", { status: 400 });
  }

  if (!/^https?:$/.test(target.protocol)) {
    return new NextResponse("Unsupported image URL", { status: 400 });
  }

  const hostname = target.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("172.16.")
  ) {
    return new NextResponse("Private image URL is not allowed", { status: 400 });
  }

  try {
    const response = await fetch(target, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      return new NextResponse("Image unavailable", { status: response.status });
    }
    const input = Buffer.from(await response.arrayBuffer());
    const output = await sharp(input)
      .rotate()
      .resize({ width: 2400, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();

    return new NextResponse(output, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
      },
    });
  } catch {
    return new NextResponse("Image optimization failed", { status: 502 });
  }
}