import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { deleteTestimonialComment, listTestimonials, getTestimonialComments } from "@/server/store-data";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const testimonials = await listTestimonials();
    
    // Fetch comments for each testimonial
    const allComments: any[] = [];
    for (const testimonial of testimonials) {
      const comments = await getTestimonialComments(testimonial.id);
      allComments.push(...comments.map(comment => ({
        ...comment,
        testimonialId: testimonial.id,
        testimonialName: testimonial.name,
      })));
    }
    
    // Sort by creation date, newest first
    allComments.sort((a, b) => b.createdAt - a.createdAt);
    
    return NextResponse.json({ comments: allComments });
  } catch (error) {
    console.error("GET /api/admin/testimonial-comments failed:", error);
    return NextResponse.json(
      { message: "Gagal memuat komentar testimonial." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { commentId } = z.object({ commentId: z.string() }).parse(body);

    const success = await deleteTestimonialComment(commentId);
    
    if (!success) {
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

    console.error("DELETE /api/admin/testimonial-comments failed:", error);
    return NextResponse.json(
      { message: "Gagal menghapus komentar." },
      { status: 500 },
    );
  }
}
