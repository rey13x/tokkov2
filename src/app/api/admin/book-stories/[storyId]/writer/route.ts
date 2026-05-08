import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { changeBookStoryWriter } from "@/server/store-data";

const updateWriterSchema = z.object({
  userId: z.string().min(1, "User ID tidak boleh kosong"),
  userName: z.string().min(1, "Nama penulis tidak boleh kosong"),
  userEmail: z.string().email("Email tidak valid"),
  userAvatarUrl: z.string().default(""),
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
    const payload = updateWriterSchema.parse(body);

    const updatedStory = await changeBookStoryWriter(
      storyId,
      payload.userId,
      payload.userName,
      payload.userEmail,
      payload.userAvatarUrl,
    );

    return NextResponse.json({
      message: "Penulis cerita berhasil diubah",
      story: updatedStory,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid" },
        { status: 400 },
      );
    }

    console.error("PATCH /api/admin/book-stories/[storyId]/writer failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Gagal mengubah penulis cerita";
    return NextResponse.json(
      { message: errorMessage },
      { status: 500 },
    );
  }
}
