import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/server/auth";
import { getOrderById, updateOrderStatus } from "@/server/store-data";

const statusSchema = z.object({
  status: z.enum(["process", "error"]),
});

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, context: { params: Params }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = statusSchema.parse(body);
    const { id } = await context.params;
    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json({ message: "Order tidak ditemukan." }, { status: 404 });
    }

    const isAdmin = session.user.role === "admin";
    const ownEmail = (session.user.email ?? "").toLowerCase();
    if (!isAdmin && ownEmail !== order.userEmail.toLowerCase()) {
      return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }

    const updated = await updateOrderStatus(id, payload.status);
    if (!updated) {
      return NextResponse.json({ message: "Order tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ order: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("PATCH /api/orders/[id]/status failed:", error);
    return NextResponse.json(
      { message: "Gagal mengubah status order." },
      { status: 500 },
    );
  }
}

