import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { createStoryReel, listStoryReels } from "@/server/store-data";

const storyReelSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).default(""),
  mediaGallery: z.array(
    z.object({
      url: z.string().max(3000000),
      type: z.enum(["image", "video", "gif"]).optional(),
      alt: z.string().max(200).optional(),
      linkUrl: z.string().max(3000000).optional(),
    }),
  ).default([]),
  linkUrl: z.string().max(3000000).default(""),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const storyReels = await listStoryReels();
  return NextResponse.json({ storyReels });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const payload = storyReelSchema.parse(body);
    const storyReel = await createStoryReel(payload);
    return NextResponse.json({ storyReel }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message ?? "Input tidak valid." }, { status: 400 });
    }

    console.error("POST /api/admin/story-reels failed:", error);
    return NextResponse.json({ message: "Gagal menambah story reel." }, { status: 500 });
  }
}
