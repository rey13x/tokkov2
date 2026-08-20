import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { getOrderById, updateOrderStatus } from "@/server/store-data";
import { verifyPaymentStatus } from "@/server/payment";
import { sendTelegramActivityNotification } from "@/server/notifications";

type Params = Promise<{ id: string }>;

export async function POST(request: Request, context: { params: Params }) {
  void request;
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

    if (!isAdmin && order.status !== "process") {
      return NextResponse.json(
        { message: "Hanya pesanan yang masih diproses yang dapat dibatalkan." },
        { status: 400 },
      );
    }

    if (order.depositId) {
      const paymentStatus = await verifyPaymentStatus(order.depositId, session.user.id);
      if (paymentStatus.status === "success") {
        return NextResponse.json(
          { message: "Pembayaran sudah berhasil. Pesanan tidak dapat dibatalkan." },
          { status: 409 },
        );
      }
    }

    const updated = await updateOrderStatus(id, "cancelled");
    if (!updated) {
      return NextResponse.json({ message: "Order tidak ditemukan." }, { status: 404 });
    }

    await sendTelegramActivityNotification({
      event: "order_cancelled",
      actorName: session.user.username || session.user.name || order.userName || "User",
      actorEmail: session.user.email ?? order.userEmail,
      actorPhone: session.user.phone ?? order.userPhone,
      description: `Order ${id} dibatalkan oleh user.`,
      metadata: [
        `Order ID: ${id}`,
        `Total: Rp ${order.total}`,
        `Status sebelumnya: ${order.status}`,
      ],
    });

    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    console.error("POST /api/orders/[id]/cancel failed:", error);
    return NextResponse.json({ message: "Gagal membatalkan pesanan." }, { status: 500 });
  }
}