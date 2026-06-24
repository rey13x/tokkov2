import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { deleteStoryReel, updateStoryReel } from "@/server/store-data";

const updateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  mediaGallery: z.array(
    z.object({
      url: z.string().max(3000000),
      type: z.enum(["image", "video", "gif"]).optional(),
      alt: z.string().max(200).optional(),
      linkUrl: z.string().max(3000000).optional(),
    }),
  ).optional(),
  linkUrl: z.string().max(3000000).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, context: { params: Params }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const payload = updateSchema.parse(body);
    const storyReel = await updateStoryReel(id, payload);

    if (!storyReel) {
      return NextResponse.json({ message: "Story reel tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ storyReel });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message ?? "Input tidak valid." }, { status: 400 });
    }

    console.error("PATCH /api/admin/story-reels/[id] failed:", error);
    return NextResponse.json({ message: "Gagal update story reel." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Params }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  await deleteStoryReel(id);
  return NextResponse.json({ message: "Story reel berhasil dihapus." });
}
