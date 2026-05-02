import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/server/auth";
import { reportStory } from "@/server/store-data";

const reportSchema = z.object({
  reason: z.string().min(5).max(500),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> },
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "Kamu harus login untuk melaporkan cerita." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const payload = reportSchema.parse(body);

    const { storyId } = await params;
    const result = await reportStory(storyId, session.user.id, payload.reason);

    return NextResponse.json({
      message: "Laporan kamu sudah diterima. Terima kasih!",
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("POST report failed:", error);
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Gagal melaporkan cerita. Coba lagi nanti.";

    return NextResponse.json(
      { message },
      { status: 500 },
    );
  }
}
