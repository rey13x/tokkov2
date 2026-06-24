import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/server/auth";
import { findUserById } from "@/server/db";
import {
  addTestimonialComment,
  getTestimonialComments,
  deleteTestimonialComment,
  updateTestimonialComment,
  updateTestimonialCommentRating,
  updateTestimonialCommentVerified,
} from "@/server/store-data";

const addCommentSchema = z.object({
  text: z.string().min(1).max(500),
  replyToId: z.string().optional(),
  replyToName: z.string().optional(),
});

type Params = Promise<{ id: string }>;

export async function GET(request: Request, context: { params: Params }) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ message: "Testimonial ID harus diisi." }, { status: 400 });
    }

    const comments = await getTestimonialComments(id);
    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Error fetching testimonial comments:", error);
    return NextResponse.json(
      { message: "Gagal memuat komentar testimoni." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: { params: Params }) {
  try {
    const { id } = await context.params;
    const session = await getServerAuthSession();

    if (!session?.user) {
      return NextResponse.json({ message: "Anda harus login untuk menambah komentar." }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ message: "Testimonial ID harus diisi." }, { status: 400 });
    }

    const body = await request.json();
    const validated = addCommentSchema.parse(body);

    // Get user data for verified status
    // New comments from regular users start as unverified (admin can toggle later in admin panel)
    // Only hardcoded admin is auto-verified
    const user = await findUserById(session.user.id ?? "");
    const isHardcodedAdmin = session.user.id === "dev-admin-hardcoded";
    const isVerified = isHardcodedAdmin;
    // Ensure avatar is provided
    const userAvatarUrl = session.user.image || user?.avatarUrl || "https://via.placeholder.com/32?text=U";
    
    // For hardcoded admin, always use "Tokko Marketplace" as username
    let userName = session.user.username || session.user.name || "User";
    if (isHardcodedAdmin) {
      userName = "Tokko Marketplace";
    }

    const comment = await addTestimonialComment({
      testimonialId: id,
      userId: session.user.id,
      userName,
      userAvatarUrl,
      verified: isVerified,
      text: validated.text,
      replyToId: validated.replyToId,
      replyToName: validated.replyToName,
    });

    if (!comment) {
      return NextResponse.json(
        { message: "Gagal menambah komentar." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "Komentar berhasil ditambahkan.",
      comment,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("Error adding testimonial comment:", error);
    return NextResponse.json(
      { message: "Gagal menambah komentar." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: { params: Params }) {
  try {
    const { id } = await context.params;
    const session = await getServerAuthSession();

    if (!session?.user) {
      return NextResponse.json(
        { message: "Anda harus login untuk menghapus komentar." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { commentId } = z.object({ commentId: z.string() }).parse(body);

    // Verify that the user is admin or owns this comment
    const user = await findUserById(session.user.id ?? "");
    const isAdmin = user?.role === "admin" || user?.email?.toLowerCase() === "digitalawanku2@gmail.com";
    
    if (!isAdmin) {
      // If not admin, verify user owns the comment
      const { getTestimonialComments } = await import("@/server/store-data");
      const comments = await getTestimonialComments(id);
      const comment = comments.find((c: any) => c.id === commentId);
      
      if (!comment || comment.userId !== session.user.id) {
        return NextResponse.json(
          { message: "Anda tidak punya akses untuk menghapus komentar ini." },
          { status: 403 },
        );
      }
    }

    const result = await deleteTestimonialComment(commentId);

    if (!result) {
      return NextResponse.json(
        { message: "Gagal menghapus komentar." },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: "Komentar berhasil dihapus." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("Error deleting testimonial comment:", error);
    return NextResponse.json(
      { message: "Gagal menghapus komentar." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: { params: Params }) {
  try {
    const { id } = await context.params;
    const session = await getServerAuthSession();

    if (!session?.user) {
      return NextResponse.json(
        { message: "Anda harus login untuk mengedit komentar." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { commentId, text, rating, verified } = z.object({ 
      commentId: z.string(),
      text: z.string().min(1).max(500).optional(),
      rating: z.number().min(0).max(5).optional(),
      verified: z.boolean().optional(),
    }).parse(body);

    // Verify that the user is admin or owns this comment
    const user = await findUserById(session.user.id ?? "");
    const isAdmin = user?.role === "admin" || user?.email?.toLowerCase() === "digitalawanku2@gmail.com";
    
    if (!isAdmin && (text || rating)) {
      // If not admin and trying to edit text/rating, verify user owns the comment
      const comments = await getTestimonialComments(id);
      const comment = comments.find((c: any) => c.id === commentId);
      
      if (!comment || comment.userId !== session.user.id) {
        return NextResponse.json(
          { message: "Anda tidak punya akses untuk mengedit komentar ini." },
          { status: 403 },
        );
      }
    }

    // Only admins can toggle verified
    if (verified !== undefined && !isAdmin) {
      return NextResponse.json(
        { message: "Anda tidak punya akses untuk mengubah verified status." },
        { status: 403 },
      );
    }

    let updatedComment = null;

    // Update text if provided
    if (text !== undefined) {
      updatedComment = await updateTestimonialComment(commentId, text);
    }

    // Update rating if provided
    if (rating !== undefined) {
      updatedComment = await updateTestimonialCommentRating(commentId, rating);
    }

    // Update verified if provided (admin only)
    if (verified !== undefined) {
      updatedComment = await updateTestimonialCommentVerified(commentId, verified);
    }

    if (!updatedComment) {
      return NextResponse.json(
        { message: "Gagal mengedit komentar." },
        { status: 500 },
      );
    }

    return NextResponse.json({ 
      message: "Komentar berhasil diedit.",
      comment: updatedComment,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("Error updating testimonial comment:", error);
    return NextResponse.json(
      { message: "Gagal mengedit komentar." },
      { status: 500 },
    );
  }
}
