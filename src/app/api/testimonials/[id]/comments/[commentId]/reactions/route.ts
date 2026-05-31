import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/server/auth";
import {
  addCommentReaction,
  removeCommentReaction,
  getCommentReactionsSummary,
} from "@/server/store-data";

const reactionSchema = z.object({
  emoji: z.string().min(1).max(2), // emoji is typically 1-2 chars
});

type Params = Promise<{ id: string; commentId: string }>;

export async function GET(request: Request, context: { params: Params }) {
  try {
    const { commentId } = await context.params;

    if (!commentId) {
      return NextResponse.json({ message: "Comment ID harus diisi." }, { status: 400 });
    }

    const session = await getServerAuthSession();
    const summary = await getCommentReactionsSummary(commentId, session?.user?.id);
    
    return NextResponse.json({ reactions: summary });
  } catch (error) {
    console.error("Error fetching comment reactions:", error);
    return NextResponse.json(
      { message: "Gagal memuat reaksi komentar." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: { params: Params }) {
  try {
    const { commentId } = await context.params;
    const session = await getServerAuthSession();

    if (!session?.user) {
      return NextResponse.json({ message: "Anda harus login untuk memberi reaksi." }, { status: 401 });
    }

    if (!commentId) {
      return NextResponse.json({ message: "Comment ID harus diisi." }, { status: 400 });
    }

    const body = await request.json();
    const validated = reactionSchema.parse(body);

    const reaction = await addCommentReaction({
      commentId,
      userId: session.user.id,
      emoji: validated.emoji,
    });

    if (!reaction) {
      return NextResponse.json(
        { message: "Gagal menambah reaksi." },
        { status: 500 },
      );
    }

    const summary = await getCommentReactionsSummary(commentId, session.user.id);

    return NextResponse.json({
      message: "Reaksi berhasil ditambahkan.",
      reactions: summary,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }
    console.error("Error adding comment reaction:", error);
    return NextResponse.json(
      { message: "Gagal menambah reaksi." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: { params: Params }) {
  try {
    const { commentId } = await context.params;
    const session = await getServerAuthSession();

    if (!session?.user) {
      return NextResponse.json({ message: "Anda harus login untuk menghapus reaksi." }, { status: 401 });
    }

    if (!commentId) {
      return NextResponse.json({ message: "Comment ID harus diisi." }, { status: 400 });
    }

    const body = await request.json();
    const validated = reactionSchema.parse(body);

    const success = await removeCommentReaction({
      commentId,
      userId: session.user.id,
      emoji: validated.emoji,
    });

    if (!success) {
      return NextResponse.json(
        { message: "Gagal menghapus reaksi." },
        { status: 500 },
      );
    }

    const summary = await getCommentReactionsSummary(commentId, session.user.id);

    return NextResponse.json({
      message: "Reaksi berhasil dihapus.",
      reactions: summary,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }
    console.error("Error removing comment reaction:", error);
    return NextResponse.json(
      { message: "Gagal menghapus reaksi." },
      { status: 500 },
    );
  }
}
