import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { deleteInformation, updateInformation } from "@/server/store-data";

const updateSchema = z.object({
  type: z.enum(["message", "poll", "update"]).optional(),
  title: z.string().min(2).max(160).optional(),
  body: z.string().min(4).max(3000).optional(),
  imageUrl: z.string().max(1000).optional(),
  pollOptions: z.array(z.string().min(1).max(80)).optional(),
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

    const information = await updateInformation(id, payload);
    if (!information) {
      return NextResponse.json(
        { message: "Informasi tidak ditemukan." },
        { status: 404 },
      );
    }

    return NextResponse.json({ information });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Gagal update informasi." },
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
  await deleteInformation(id);
  return NextResponse.json({ message: "Informasi berhasil dihapus." });
}
