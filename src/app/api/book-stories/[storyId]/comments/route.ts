import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/server/auth";
import { addBookStoryComment } from "@/server/store-data";

const addCommentSchema = z.object({
  text: z.string().min(1).max(500),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Harus login untuk berkomentar" },
        { status: 401 },
      );
    }

    if (!session.user.id) {
      return NextResponse.json(
        { message: "Sesi login tidak valid" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const payload = addCommentSchema.parse(body);

    const { storyId } = await params;
    const comment = {
      id: `comment_${Date.now()}`,
      userId: session.user.id,
      userName: session.user.name || "Anonymous",
      text: payload.text,
      createdAt: new Date().toISOString(),
    };

    const story = await addBookStoryComment(storyId, comment);
    return NextResponse.json({ story });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid" },
        { status: 400 },
      );
    }

    console.error("POST /api/book-stories/[storyId]/comments failed:", error);
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Gagal menambah komentar";

    return NextResponse.json(
      { message },
      { status: 500 },
    );
  }
}
