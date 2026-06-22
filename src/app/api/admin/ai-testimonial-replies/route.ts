import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import {
  addTestimonialComment,
  getTestimonialComments,
} from "@/server/store-data";
import {
  generateAIReplies,
} from "@/server/ai";

/**
 * POST /api/admin/ai-testimonial-replies
 * Generate AI replies to a comment
 * 
 * Body:
 * - testimonialId: string (required)
 * - commentId: string (required)
 * - count: number (1-20, optional, default 3)
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const schema = z.object({
      testimonialId: z.string(),
      commentId: z.string(),
      count: z.number().min(1).max(20).default(3),
    });

    const validated = schema.parse(body);
    const { testimonialId, commentId, count } = validated;

    // Get the parent comment
    const comments = await getTestimonialComments(testimonialId);
    const parentComment = comments.find((c: any) => c.id === commentId);

    if (!parentComment) {
      return NextResponse.json(
        { message: "Komentar tidak ditemukan" },
        { status: 404 }
      );
    }

    // Generate AI replies
    const aiReplies = await generateAIReplies(parentComment.text, count);

    if (!aiReplies || aiReplies.length === 0) {
      return NextResponse.json(
        { message: "Gagal generate reply AI" },
        { status: 500 }
      );
    }

    // Add each reply as a comment to the database
    const createdReplies = [];
    for (const text of aiReplies) {
      const reply = await addTestimonialComment({
        testimonialId,
        userId: "ai-generated",
        userName: "Tokko Support",
        userAvatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=admin`,
        verified: true, // Support replies get verified badge
        text,
        replyToId: commentId,
        replyToName: parentComment.userName,
        rating: 0, // Replies don't have ratings
      });

      if (reply) {
        createdReplies.push(reply);
      }
    }

    return NextResponse.json({
      message: `${createdReplies.length} reply AI berhasil ditambahkan`,
      replies: createdReplies,
      count: createdReplies.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid" },
        { status: 400 }
      );
    }

    console.error("POST /api/admin/ai-testimonial-replies failed:", error);
    return NextResponse.json(
      { message: "Gagal generate reply AI" },
      { status: 500 }
    );
  }
}
