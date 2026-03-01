import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";
import { confirmOrderCancellation, getOrderById } from "@/server/store-data";
import { sendTelegramActivityNotification } from "@/server/notifications";

type Params = Promise<{ id: string }>;

export async function PATCH(_request: Request, context: { params: Params }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const current = await getOrderById(id);
    if (!current) {
      return NextResponse.json({ message: "Order tidak ditemukan." }, { status: 404 });
    }

    if (current.cancelRequestStatus !== "requested") {
      return NextResponse.json(
        { message: "Order ini belum memiliki permintaan pembatalan aktif." },
        { status: 400 },
      );
    }

    const updated = await confirmOrderCancellation(id);
    if (!updated) {
      return NextResponse.json({ message: "Order tidak ditemukan." }, { status: 404 });
    }

    await sendTelegramActivityNotification({
      event: "cancel_request_confirmed",
      actorName: "Admin",
      actorEmail: "-",
      actorPhone: "-",
      description: `Admin konfirmasi pembatalan order ${id}.`,
      metadata: [
        `Order ID: ${id}`,
        `Pemesan: ${updated.userName}`,
        `Email: ${updated.userEmail}`,
      ],
    });

    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("PATCH /api/admin/orders/[id]/cancel-request failed:", error);
    return NextResponse.json(
      { message: "Gagal konfirmasi pembatalan order." },
      { status: 500 },
    );
  }
}

