import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { deleteTestimonial, updateTestimonial } from "@/server/store-data";

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  country: z.string().min(2).max(60).optional(),
  roleLabel: z.string().max(80).optional(),
  message: z.string().min(6).max(4000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  mediaUrl: z.string().max(3000000).optional(),
  audioUrl: z.string().max(3000000).optional(),
});

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, context: { params: Params }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const payload = updateSchema.parse(body);
    const testimonial = await updateTestimonial(id, payload);

    if (!testimonial) {
      return NextResponse.json(
        { message: "Testimonial tidak ditemukan." },
        { status: 404 },
      );
    }

    return NextResponse.json({ testimonial });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("PATCH /api/admin/testimonials/[id] failed:", error);
    const detail =
      error instanceof Error && error.message.trim()
        ? ` (${error.message.trim()})`
        : "";

    return NextResponse.json(
      { message: `Gagal update testimonial.${detail}` },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Params }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  await deleteTestimonial(id);
  return NextResponse.json({ message: "Testimonial berhasil dihapus." });
}
