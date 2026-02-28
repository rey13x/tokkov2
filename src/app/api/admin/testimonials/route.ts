import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { createTestimonial, listTestimonials } from "@/server/store-data";

const testimonialSchema = z.object({
  name: z.string().min(2).max(120),
  country: z.enum(["Indonesia", "Inggris", "Filipina"]),
  message: z.string().min(6).max(4000),
  rating: z.number().int().min(1).max(5),
  mediaUrl: z.string().max(3000000).default("/assets/logo.png"),
  audioUrl: z.string().max(3000000).default("/assets/notif.mp3"),
});

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const testimonials = await listTestimonials();
  return NextResponse.json({ testimonials });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const payload = testimonialSchema.parse(body);
    const testimonial = await createTestimonial(payload);
    return NextResponse.json({ testimonial }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Gagal menambah testimonial." },
      { status: 500 },
    );
  }
}
