import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/server/auth";
import { findUserById } from "@/server/db";
import { addTestimonialComment, listTestimonials } from "@/server/store-data";

const generateCommentsSchema = z.object({
  count: z.number().min(1).max(20).default(3),
  tone: z.enum(["positive", "neutral", "constructive"]).default("positive"),
  topics: z.array(z.string()).optional(),
});

type Params = Promise<{ id: string }>;

/**
 * POST /api/testimonials/[id]/ai-comments
 * Generate AI comments for a testimonial
 * Requires: Admin role
 */
export async function POST(request: Request, context: { params: Params }) {
  try {
    const { id } = await context.params;
    const session = await getServerAuthSession();

    if (!session?.user) {
      return NextResponse.json(
        { message: "Anda harus login untuk membuat komentar AI." },
        { status: 401 },
      );
    }

    // Check if user is admin
    const user = await findUserById(session.user.id ?? "");
    const isAdmin = user?.role === "admin" || user?.email?.toLowerCase() === "digitalawanku2@gmail.com";

    if (!isAdmin) {
      return NextResponse.json(
        { message: "Hanya admin yang bisa membuat komentar AI." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { count, tone, topics } = generateCommentsSchema.parse(body);

    // Verify testimonial exists
    const testimonials = await listTestimonials();
    const testimonial = testimonials.find((t: any) => t.id === id);

    if (!testimonial) {
      return NextResponse.json(
        { message: "Testimoni tidak ditemukan." },
        { status: 404 },
      );
    }

    // Get OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { message: "OpenAI API key tidak dikonfigurasi." },
        { status: 500 },
      );
    }

    // Prepare prompt for AI
    const prompt = `Berdasarkan testimoni berikut, buatkan ${count} komentar yang terlihat organik dan natural untuk komentar testimoni (bukan balasan, tapi comment utama). 
    Setiap komentar harus berbeda, singkat (maksimal 100 karakter), dan menggunakan bahasa Indonesia yang natural.
    Tone yang digunakan: ${tone}.
    ${topics && topics.length > 0 ? `Topik fokus: ${topics.join(", ")}` : ""}
    
    Testimoni:
    Nama: ${testimonial.name}
    Role: ${testimonial.roleLabel}
    Rating: ${testimonial.rating} bintang
    Pesan: ${testimonial.message}
    
    Hasilkan dalam format JSON array seperti ini (tanpa markdown):
    [
      {"text": "komentar 1", "rating": 4},
      {"text": "komentar 2", "rating": 5}
    ]
    
    PENTING: Hanya keluarkan JSON array, tidak ada teks lain.`;

    // Call OpenAI API
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.json();
      console.error("OpenAI API error:", error);
      return NextResponse.json(
        { message: "Gagal memanggil OpenAI API." },
        { status: 500 },
      );
    }

    const aiData = (await aiResponse.json()) as any;
    const contentText = aiData.choices?.[0]?.message?.content || "";

    // Parse the response
    let generatedComments: Array<{ text: string; rating?: number }> = [];
    try {
      generatedComments = JSON.parse(contentText);
    } catch {
      console.error("Failed to parse AI response:", contentText);
      return NextResponse.json(
        { message: "Gagal memproses respons AI." },
        { status: 500 },
      );
    }

    if (!Array.isArray(generatedComments) || generatedComments.length === 0) {
      return NextResponse.json(
        { message: "AI tidak dapat menghasilkan komentar." },
        { status: 500 },
      );
    }

    // Create comments in database
    const createdComments = [];
    for (const commentData of generatedComments) {
      try {
        const comment = await addTestimonialComment({
          testimonialId: id,
          userId: session.user.id,
          userName: "Tokko AI",
          userAvatarUrl: session.user.image || "/assets/logo.png",
          verified: false,
          rating: Math.max(1, Math.min(5, commentData.rating ?? 0)),
          text: commentData.text.substring(0, 500), // Limit to 500 chars
        });

        if (comment) {
          createdComments.push(comment);
        }
      } catch (error) {
        console.error("Failed to create comment:", error);
      }
    }

    return NextResponse.json({
      message: `${createdComments.length} komentar AI berhasil dibuat.`,
      comments: createdComments,
      generatedCount: createdComments.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("Error generating AI comments:", error);
    return NextResponse.json(
      { message: "Gagal membuat komentar AI." },
      { status: 500 },
    );
  }
}
