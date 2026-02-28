import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { deleteProduct, updateProduct } from "@/server/store-data";

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  category: z.string().min(2).max(50).optional(),
  shortDescription: z.string().min(3).max(140).optional(),
  description: z.string().min(6).max(2000).optional(),
  duration: z.string().max(80).optional(),
  price: z.number().int().min(0).optional(),
  imageUrl: z.string().max(3000000).optional(),
  isActive: z.boolean().optional(),
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
    const product = await updateProduct(id, payload);

    if (!product) {
      return NextResponse.json({ message: "Produk tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("PATCH /api/admin/products/[id] failed:", error);
    const detail =
      error instanceof Error && error.message.trim()
        ? ` (${error.message.trim()})`
        : "";

    return NextResponse.json({ message: `Gagal update produk.${detail}` }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Params }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  await deleteProduct(id);
  return NextResponse.json({ message: "Produk berhasil dihapus." });
}
