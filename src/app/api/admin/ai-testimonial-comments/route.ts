import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import {
  addTestimonialComment,
} from "@/server/store-data";
import {
  generateAIComments,
  getRandomUsername,
  getRandomRating,
} from "@/server/ai";

/**
 * POST /api/admin/ai-testimonial-comments
 * Generate AI comments for a testimonial
 * 
 * Body:
 * - testimonialId: string (required)
 * - count: number (1-50, optional, default 5)
 * - productName?: string
 * - productRating?: number
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
      count: z.number().min(1).max(50).default(5),
      productName: z.string().optional(),
      productRating: z.number().min(1).max(5).optional(),
    });

    const validated = schema.parse(body);
    const { testimonialId, count, productName, productRating } = validated;

    // Generate AI comments
    const aiComments = await generateAIComments(count, {
      productName,
      rating: productRating,
    });

    if (!aiComments || aiComments.length === 0) {
      return NextResponse.json(
        { message: "Gagal generate komentar AI" },
        { status: 500 }
      );
    }

    // Add each comment to the database
    const createdComments = [];
    for (const text of aiComments) {
      const comment = await addTestimonialComment({
        testimonialId,
        userId: "ai-generated",
        userName: getRandomUsername(),
        userAvatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${Math.random()}`,
        verified: false,
        text,
        rating: getRandomRating(),
      });

      if (comment) {
        createdComments.push(comment);
      }
    }

    return NextResponse.json({
      message: `${createdComments.length} komentar AI berhasil ditambahkan`,
      comments: createdComments,
      count: createdComments.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid" },
        { status: 400 }
      );
    }

    console.error("POST /api/admin/ai-testimonial-comments failed:", error);
    return NextResponse.json(
      { message: "Gagal generate komentar AI" },
      { status: 500 }
    );
  }
}
