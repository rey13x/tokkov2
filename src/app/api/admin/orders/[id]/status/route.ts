import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { updateOrderStatus } from "@/server/store-data";

const statusSchema = z.object({
  status: z.enum(["process", "done", "error"]),
});

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, context: { params: Params }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const payload = statusSchema.parse(body);
    const { id } = await context.params;
    const order = await updateOrderStatus(id, payload.status);

    if (!order) {
      return NextResponse.json({ message: "Order tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("PATCH /api/admin/orders/[id]/status failed:", error);
    return NextResponse.json(
      { message: "Gagal mengubah status order." },
      { status: 500 },
    );
  }
}

