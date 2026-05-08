import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { manageBookStoryViewers } from "@/server/store-data";

const updateViewersSchema = z.object({
  isPrivate: z.boolean().default(false),
  restrictedViewerIds: z.array(z.string()).default([]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return auth.response;
    }

    const { storyId } = await params;
    const body = await request.json();
    const payload = updateViewersSchema.parse(body);

    const updatedStory = await manageBookStoryViewers(
      storyId,
      payload.isPrivate,
      payload.restrictedViewerIds,
    );

    return NextResponse.json({
      message: payload.isPrivate
        ? "Cerita berhasil dibuat private dengan pembaca terbatas"
        : "Cerita berhasil dibuat public",
      story: updatedStory,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid" },
        { status: 400 },
      );
    }

    console.error("PATCH /api/admin/book-stories/[storyId]/viewers failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Gagal mengatur penonton cerita";
    return NextResponse.json(
      { message: errorMessage },
      { status: 500 },
    );
  }
}
