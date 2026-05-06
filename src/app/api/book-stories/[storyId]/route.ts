import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/server/auth";
import { run, ensureDatabase } from "@/server/db";

const updateStorySchema = z.object({
  story: z.string().min(10).max(5000),
  photos: z.array(z.string()).default([]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.email || !session.user.id) {
      return NextResponse.json(
        { message: "Harus login untuk edit cerita" },
        { status: 401 },
      );
    }

    await ensureDatabase();

    const { storyId } = await params;
    const body = await request.json();
    const payload = updateStorySchema.parse(body);

    // Check if user is author or admin
    const storyResult = await run("SELECT user_id FROM book_stories WHERE id = ?", [storyId]);
    const story = storyResult.rows?.[0] as any;
    if (!story) {
      return NextResponse.json(
        { message: "Cerita tidak ditemukan" },
        { status: 404 },
      );
    }

    const isAdmin = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase() === session.user.email.toLowerCase();
    if (story.user_id !== session.user.id && !isAdmin) {
      return NextResponse.json(
        { message: "Hanya penulis atau admin yang bisa edit cerita" },
        { status: 403 },
      );
    }

    // Update story
    await run(`
      UPDATE book_stories 
      SET story = ?, photos = ?
      WHERE id = ?
    `, [
      payload.story,
      JSON.stringify(payload.photos),
      storyId
    ]);

    // Fetch updated story
    const updatedResult = await run("SELECT * FROM book_stories WHERE id = ?", [storyId]);
    const updated = updatedResult.rows?.[0];
    
    return NextResponse.json({
      message: "Cerita berhasil diperbarui",
      story: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid" },
        { status: 400 },
      );
    }
    console.error("PATCH /api/book-stories/[storyId] failed:", error);
    return NextResponse.json(
      { message: "Gagal update cerita" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.email || !session.user.id) {
      return NextResponse.json(
        { message: "Harus login untuk hapus cerita" },
        { status: 401 },
      );
    }

    await ensureDatabase();

    const { storyId } = await params;

    // Check if user is author or admin
    const storyResult = await run("SELECT user_id FROM book_stories WHERE id = ?", [storyId]);
    const story = storyResult.rows?.[0] as any;
    if (!story) {
      return NextResponse.json(
        { message: "Cerita tidak ditemukan" },
        { status: 404 },
      );
    }

    const isAdmin = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase() === session.user.email.toLowerCase();
    if (story.user_id !== session.user.id && !isAdmin) {
      return NextResponse.json(
        { message: "Hanya penulis atau admin yang bisa hapus cerita" },
        { status: 403 },
      );
    }

    // Delete story
    await run("DELETE FROM book_stories WHERE id = ?", [storyId]);
    
    return NextResponse.json({
      message: "Cerita berhasil dihapus",
    });
  } catch (error) {
    console.error("DELETE /api/book-stories/[storyId] failed:", error);
    return NextResponse.json(
      { message: "Gagal hapus cerita" },
      { status: 500 },
    );
  }
}
