import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { incrementBookStoryLikes } from "@/server/store-data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.email || !session.user.id) {
      return NextResponse.json(
        { message: "Harus login untuk memberikan like" },
        { status: 401 },
      );
    }

    const { storyId } = await params;
    const story = await incrementBookStoryLikes(storyId, session.user.id);
    return NextResponse.json({ story });
  } catch (error) {
    console.error("POST /api/book-stories/[storyId]/likes failed:", error);
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Gagal memberikan like";

    return NextResponse.json(
      { message },
      { status: 500 },
    );
  }
}
