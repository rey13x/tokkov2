import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/server/auth";
import { findUserById } from "@/server/db";
import { addTestimonialComment, getTestimonialComments } from "@/server/store-data";

const generateReplySchema = z.object({
  commentId: z.string(),
  count: z.number().min(1).max(5).default(1),
});

type Params = Promise<{ id: string }>;

/**
 * POST /api/testimonials/[id]/ai-replies
 * Generate AI replies to a specific comment
 * Requires: Admin role
 */
export async function POST(request: Request, context: { params: Params }) {
  try {
    const { id } = await context.params;
    const session = await getServerAuthSession();

    if (!session?.user) {
      return NextResponse.json(
        { message: "Anda harus login untuk membuat balasan AI." },
        { status: 401 },
      );
    }

    // Check if user is admin
    const user = await findUserById(session.user.id ?? "");
    const isAdmin = user?.role === "admin" || user?.email?.toLowerCase() === "digitalawanku2@gmail.com";

    if (!isAdmin) {
      return NextResponse.json(
        { message: "Hanya admin yang bisa membuat balasan AI." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { commentId, count } = generateReplySchema.parse(body);

    // Get the comment to reply to
    const comments = await getTestimonialComments(id);
    const targetComment = comments.find((c: any) => c.id === commentId);

    if (!targetComment) {
      return NextResponse.json(
        { message: "Komentar tidak ditemukan." },
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
    const prompt = `Buatkan ${count} balasan natural terhadap komentar berikut. Setiap balasan harus:
    - Singkat dan natural (maksimal 100 karakter)
    - Berbeda satu sama lain
    - Menggunakan bahasa Indonesia
    - Terlihat seperti respons dari pemberi testimoni atau pengguna lain
    
    Komentar yang akan di-balas:
    Pemberi komentar: ${targetComment.userName}
    Komentar: "${targetComment.text}"
    
    Hasilkan dalam format JSON array (tanpa markdown):
    [
      {"text": "balasan 1"},
      {"text": "balasan 2"}
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
        max_tokens: 300,
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
    let generatedReplies: Array<{ text: string }> = [];
    try {
      generatedReplies = JSON.parse(contentText);
    } catch {
      console.error("Failed to parse AI response:", contentText);
      return NextResponse.json(
        { message: "Gagal memproses respons AI." },
        { status: 500 },
      );
    }

    if (!Array.isArray(generatedReplies) || generatedReplies.length === 0) {
      return NextResponse.json(
        { message: "AI tidak dapat menghasilkan balasan." },
        { status: 500 },
      );
    }

    // Create reply comments in database
    const createdReplies = [];
    for (const replyData of generatedReplies) {
      try {
        const reply = await addTestimonialComment({
          testimonialId: id,
          userId: session.user.id,
          userName: "Tokko AI",
          userAvatarUrl: session.user.image || "/assets/logo.png",
          verified: false,
          text: replyData.text.substring(0, 500),
          replyToId: commentId,
          replyToName: targetComment.userName,
        });

        if (reply) {
          createdReplies.push(reply);
        }
      } catch (error) {
        console.error("Failed to create reply:", error);
      }
    }

    return NextResponse.json({
      message: `${createdReplies.length} balasan AI berhasil dibuat.`,
      replies: createdReplies,
      generatedCount: createdReplies.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("Error generating AI replies:", error);
    return NextResponse.json(
      { message: "Gagal membuat balasan AI." },
      { status: 500 },
    );
  }
}
