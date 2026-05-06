import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { incrementBookStoryViews } from "@/server/store-data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const session = await getServerAuthSession();
    const { storyId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "Perlu login untuk track view" },
        { status: 401 },
      );
    }

    const story = await incrementBookStoryViews(storyId, session.user.id);
    return NextResponse.json({ story });
  } catch (error) {
    console.error("POST /api/book-stories/[storyId]/views failed:", error);
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Gagal track view";
    return NextResponse.json(
      { message },
      { status: 500 },
    );
  }
}
