import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import {
  getOrderById,
  deleteOrder,
} from "@/server/store-data";
import { sendTelegramActivityNotification } from "@/server/notifications";

type Params = Promise<{ id: string }>;

export async function DELETE(request: Request, context: { params: Params }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
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

    // Allow deletion only if order status is still "process" (not yet confirmed payment)
    if (order.status !== "process") {
      return NextResponse.json(
        { message: "Hanya pesanan yang masih diproses yang dapat dibatalkan." },
        { status: 400 },
      );
    }

    const deleted = await deleteOrder(id);
    if (!deleted) {
      return NextResponse.json({ message: "Gagal menghapus order." }, { status: 500 });
    }

    await sendTelegramActivityNotification({
      event: "order_cancelled",
      actorName: session.user.username || session.user.name || order.userName || "User",
      actorEmail: session.user.email ?? order.userEmail,
      actorPhone: session.user.phone ?? order.userPhone,
      description: `Order ${id} dibatalkan dan dihapus dari sistem.`,
      metadata: [
        `Order ID: ${id}`,
        `Total: Rp ${order.total}`,
        `Status sebelumnya: ${order.status}`,
      ],
    });

    return NextResponse.json({ success: true, message: "Order berhasil dibatalkan." });
  } catch (error) {
    console.error("DELETE /api/orders/[id]/delete failed:", error);
    return NextResponse.json(
      { message: "Gagal membatalkan pesanan." },
      { status: 500 },
    );
  }
}
