import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { deleteMarquee, updateMarquee } from "@/server/store-data";

const updateSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  imageUrl: z.string().max(3000000).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
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
    const marquee = await updateMarquee(id, payload);

    if (!marquee) {
      return NextResponse.json(
        { message: "Logo marquee tidak ditemukan." },
        { status: 404 },
      );
    }

    return NextResponse.json({ marquee });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: "Gagal update logo marquee." },
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
  await deleteMarquee(id);
  return NextResponse.json({ message: "Logo marquee berhasil dihapus." });
}
