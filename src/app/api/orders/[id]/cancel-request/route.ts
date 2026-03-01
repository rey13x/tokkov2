import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/server/auth";
import {
  getOrderById,
  requestOrderCancellation,
} from "@/server/store-data";
import { sendTelegramActivityNotification } from "@/server/notifications";

const cancelRequestSchema = z.object({
  reason: z.string().min(5).max(600),
});

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, context: { params: Params }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = cancelRequestSchema.parse(body);
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

    if (order.cancelRequestStatus === "confirmed") {
      return NextResponse.json(
        { message: "Order ini sudah dibatalkan setelah konfirmasi admin." },
        { status: 400 },
      );
    }

    const updated = await requestOrderCancellation(id, payload.reason);
    if (!updated) {
      return NextResponse.json({ message: "Order tidak ditemukan." }, { status: 404 });
    }

    await sendTelegramActivityNotification({
      event: "cancel_request_created",
      actorName: session.user.username || session.user.name || order.userName || "User",
      actorEmail: session.user.email ?? order.userEmail,
      actorPhone: session.user.phone ?? order.userPhone,
      description: `User mengajukan pembatalan order ${id}.`,
      metadata: [
        `Order ID: ${id}`,
        `Alasan: ${payload.reason.trim()}`,
      ],
    });

    return NextResponse.json({ order: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("PATCH /api/orders/[id]/cancel-request failed:", error);
    return NextResponse.json(
      { message: "Gagal mengajukan pembatalan pesanan." },
      { status: 500 },
    );
  }
}

