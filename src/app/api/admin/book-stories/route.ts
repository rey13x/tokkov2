import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import {
  listPendingBookStories,
  listApprovedBookStories,
  approveBookStory,
  rejectBookStory,
  deleteBookStory,
  getStoryReports,
  resolveStoryReport,
  updateBookStoryLikes,
  addCustomBookStoryComments,
} from "@/server/store-data";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "stories";
    const status = searchParams.get("status") || "pending";

    if (type === "reports") {
      const reports = await getStoryReports();
      return NextResponse.json({ reports });
    }

    if (status === "pending") {
      const stories = await listPendingBookStories();
      return NextResponse.json({ stories });
    }

    if (status === "approved") {
      const stories = await listApprovedBookStories();
      return NextResponse.json({ stories });
    }

    return NextResponse.json({ stories: [] });
  } catch (error) {
    console.error("GET /api/admin/book-stories failed:", error);
    return NextResponse.json(
      { message: "Gagal memuat cerita." },
      { status: 500 },
    );
  }
}

const approveStorySchema = z.object({
  storyId: z.string().min(1).optional(),
  action: z.enum(["approve", "reject", "delete", "update-likes", "add-comments", "resolve-report"]),
  reportId: z.string().optional(),
  deleteReportedStory: z.boolean().optional(),
  likes: z.number().optional(),
  comments: z
    .array(
      z.object({
        userName: z.string(),
        text: z.string(),
      }),
    )
    .optional(),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const payload = approveStorySchema.parse(body);

    if (payload.action === "approve" && payload.storyId) {
      const story = await approveBookStory(payload.storyId);
      return NextResponse.json({ story });
    }

    if (payload.action === "reject" && payload.storyId) {
      const story = await rejectBookStory(payload.storyId);
      return NextResponse.json({ story });
    }

    if (payload.action === "delete" && payload.storyId) {
      await deleteBookStory(payload.storyId);
      return NextResponse.json({ success: true });
    }

    if (payload.action === "update-likes" && payload.storyId && payload.likes !== undefined) {
      const story = await updateBookStoryLikes(payload.storyId, payload.likes);
      return NextResponse.json({ story, message: "Like berhasil diupdate" });
    }

    if (payload.action === "add-comments" && payload.storyId && payload.comments) {
      const story = await addCustomBookStoryComments(payload.storyId, payload.comments);
      return NextResponse.json({ story, message: "Komentar berhasil ditambahkan" });
    }

    if (payload.action === "resolve-report" && payload.reportId) {
      await resolveStoryReport(payload.reportId, auth.admin.uid, payload.deleteReportedStory ?? false);
      return NextResponse.json({ success: true, message: "Laporan berhasil diselesaikan" });
    }

    return NextResponse.json(
      { message: "Action tidak dikenali." },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("POST /api/admin/book-stories failed:", error);
    const detail =
      error instanceof Error && error.message.trim()
        ? ` (${error.message.trim()})`
        : "";

    return NextResponse.json(
      { message: `Gagal memproses cerita.${detail}` },
      { status: 500 },
    );
  }
}
