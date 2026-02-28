import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { createMarquee, listMarquees } from "@/server/store-data";

const marqueeSchema = z.object({
  label: z.string().min(1).max(80),
  imageUrl: z.string().max(3000000).default("/assets/logo.png"),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const marquees = await listMarquees();
  return NextResponse.json({ marquees });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const payload = marqueeSchema.parse(body);
    const marquee = await createMarquee(payload);
    return NextResponse.json({ marquee }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("POST /api/admin/marquees failed:", error);
    const detail =
      error instanceof Error && error.message.trim()
        ? ` (${error.message.trim()})`
        : "";

    return NextResponse.json(
      { message: `Gagal menambah logo marquee.${detail}` },
      { status: 500 },
    );
  }
}
