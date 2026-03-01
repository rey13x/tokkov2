import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";
import { deleteOrder } from "@/server/store-data";
import { sendTelegramActivityNotification } from "@/server/notifications";

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
    await sendTelegramActivityNotification({
      event: "admin_order_delete",
      actorName: auth.admin.email ?? "Admin",
      actorEmail: auth.admin.email ?? "-",
      description: `Admin menghapus order ${id}.`,
      metadata: [`Order ID: ${id}`],
    });
    return NextResponse.json({ message: "Order berhasil dihapus." });
  } catch (error) {
    console.error("DELETE /api/admin/orders/[id] failed:", error);
    return NextResponse.json({ message: "Gagal menghapus order." }, { status: 500 });
  }
}
