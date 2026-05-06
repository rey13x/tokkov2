import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { toggleBookStorySave } from "@/server/store-data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json(
        { message: "Harus login untuk menyimpan cerita" },
        { status: 401 },
      );
    }

    const { storyId } = await params;
    const story = await toggleBookStorySave(storyId, session.user.id);
    return NextResponse.json({ story });
  } catch (error) {
    console.error("POST /api/book-stories/[storyId]/save failed:", error);
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Gagal menyimpan cerita";
    return NextResponse.json(
      { message },
      { status: 500 },
    );
  }
}
