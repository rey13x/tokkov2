import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";
import { deleteOrder } from "@/server/store-data";

type Params = Promise<{ id: string }>;

export async function DELETE(_request: Request, context: { params: Params }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const deleted = await deleteOrder(id);
    if (!deleted) {
      return NextResponse.json({ message: "Order tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ message: "Order berhasil dihapus." });
  } catch (error) {
    console.error("DELETE /api/admin/orders/[id] failed:", error);
    return NextResponse.json({ message: "Gagal menghapus order." }, { status: 500 });
  }
}
