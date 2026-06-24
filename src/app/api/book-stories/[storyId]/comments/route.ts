import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/server/auth";
import { addBookStoryComment, deleteBookStoryComment, listApprovedBookStories, updateBookStoryComment, updateBookStoryCommentVerified } from "@/server/store-data";
import { findUserById } from "@/server/db";

const addCommentSchema = z.object({
  text: z.string().min(1).max(500),
  replyToId: z.string().optional(),
  replyToName: z.string().optional(),
  photoUrl: z.string().optional(),
});

const deleteCommentSchema = z.object({
  commentId: z.string().min(1),
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
    const user = await findUserById(session.user.id).catch(() => null);
    // New comments from regular users start as unverified (admin can toggle later)
    // Only hardcoded admin is auto-verified
    const isHardcodedAdmin = session.user.id === "dev-admin-hardcoded";
    const verified = isHardcodedAdmin;

    const comment = {
      id: `comment_${Date.now()}`,
      userId: session.user.id,
      userName: session.user.username || session.user.name || "Anonymous",
      userEmail: session.user.email || user?.email || "",
      userAvatarUrl: session.user.image || user?.avatarUrl || "",
      verified,
      text: payload.text,
      replyToId: payload.replyToId,
      replyToName: payload.replyToName,
      photoUrl: payload.photoUrl,
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { storyId } = await params;
    const body = await request.json();
    const payload = deleteCommentSchema.parse(body);

    const stories = await listApprovedBookStories();
    const story = stories.find((item) => item.id === storyId);
    const comment = story?.comments.find((item) => item.id === payload.commentId);
    if (!story || !comment) {
      return NextResponse.json({ message: "Komentar tidak ditemukan" }, { status: 404 });
    }

    const user = await findUserById(session.user.id).catch(() => null);
    const isAdmin =
      session.user.role === "admin" ||
      user?.role === "admin" ||
      session.user.email?.toLowerCase() === "digitalawanku2@gmail.com" ||
      user?.email?.toLowerCase() === "digitalawanku2@gmail.com";

    if (!isAdmin && comment.userId !== session.user.id) {
      return NextResponse.json({ message: "Tidak boleh hapus komentar ini" }, { status: 403 });
    }

    const updatedStory = await deleteBookStoryComment(storyId, payload.commentId);
    if (!updatedStory) {
      return NextResponse.json({ message: "Komentar tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ story: updatedStory, message: "Komentar berhasil dihapus" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid" },
        { status: 400 },
      );
    }

    console.error("DELETE /api/book-stories/[storyId]/comments failed:", error);
    return NextResponse.json({ message: "Gagal hapus komentar" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { storyId } = await params;
    const body = await request.json();
    const patchSchema = z.object({
      commentId: z.string().min(1),
      userName: z.string().optional(),
      text: z.string().optional(),
      verified: z.boolean().optional(),
    });

    const payload = patchSchema.parse(body);

    const stories = await listApprovedBookStories();
    const story = stories.find((item) => item.id === storyId);
    const comment = story?.comments.find((item) => item.id === payload.commentId);

    if (!story || !comment) {
      return NextResponse.json({ message: "Komentar tidak ditemukan" }, { status: 404 });
    }

    const user = await findUserById(session.user.id).catch(() => null);
    const isAdmin =
      session.user.role === "admin" ||
      user?.role === "admin" ||
      session.user.email?.toLowerCase() === "digitalawanku2@gmail.com" ||
      user?.email?.toLowerCase() === "digitalawanku2@gmail.com";

    // Handle userName or text update
    if (payload.userName || payload.text) {
      if (!isAdmin && comment.userId !== session.user.id) {
        return NextResponse.json({ message: "Tidak boleh edit komentar ini" }, { status: 403 });
      }

      const updatedStory = await updateBookStoryComment(
        storyId,
        payload.commentId,
        payload.text || comment.text,
        payload.userName || comment.userName
      );

      if (!updatedStory) {
        return NextResponse.json({ message: "Gagal update komentar" }, { status: 500 });
      }

      return NextResponse.json({ story: updatedStory, message: "Komentar berhasil diubah" });
    }

    // Handle verified toggle (admin only)
    if (payload.verified !== undefined) {
      if (!isAdmin) {
        return NextResponse.json({ message: "Hanya admin yang dapat mengubah verified status" }, { status: 403 });
      }

      const updatedStory = await updateBookStoryCommentVerified(storyId, payload.commentId, payload.verified);

      if (!updatedStory) {
        return NextResponse.json({ message: "Gagal update verified status" }, { status: 500 });
      }

      return NextResponse.json({ story: updatedStory, message: "Verified status berhasil diubah" });
    }

    return NextResponse.json({ message: "Tidak ada yang diubah" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid" },
        { status: 400 },
      );
    }

    console.error("PATCH /api/book-stories/[storyId]/comments failed:", error);
    return NextResponse.json({ message: "Gagal update komentar" }, { status: 500 });
  }
}
