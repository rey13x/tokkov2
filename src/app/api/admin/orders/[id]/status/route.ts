import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { updateOrderStatus } from "@/server/store-data";
import { notifyNativeUsers, sendTelegramActivityNotification, telegramStatusLabel } from "@/server/notifications";

const statusSchema = z.object({
  status: z.enum(["process", "paid", "done", "error", "sent"]),
  adminNote: z.string().max(1000).optional(),
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
    const order = await updateOrderStatus(id, payload.status, payload.adminNote);

    if (!order) {
      return NextResponse.json({ message: "Order tidak ditemukan." }, { status: 404 });
    }

    await sendTelegramActivityNotification({
      event: "admin_order_status_update",
      actorName: auth.admin.email ?? "Admin",
      actorEmail: auth.admin.email ?? "-",
      description: `Admin mengubah status order ${id} menjadi ${payload.status}.`,
      metadata: [
        `Order ID: ${id}`,
        `Status Baru: ${telegramStatusLabel(payload.status)}`,
        `Pemesan: ${order.userName} (${order.userEmail})`,
      ],
    });
    void notifyNativeUsers({
      userId: order.userId,
      title: "Status pesanan berubah",
      body: `Pesanan kamu sekarang: ${telegramStatusLabel(payload.status)}${payload.adminNote?.trim() ? ` - ${payload.adminNote.trim()}` : ""}`,
      url: "/status-pemesanan",
    });

    return NextResponse.json({ order });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Data yang kamu isi belum lengkap atau belum sesuai." },
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
