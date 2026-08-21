import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { deleteOrder, getOrderById } from "@/server/store-data";

const deletableStatuses = new Set([
  "process",
  "pending",
  "pending_payment",
  "new",
  "done",
  "delivered",
  "sent",
  "paid",
  "error",
  "rejected",
  "declined",
  "failed",
]);

function statusGroup(status: string) {
  if (["done", "delivered", "sent"].includes(status)) return "done";
  if (["error", "rejected", "declined", "failed"].includes(status)) return "error";
  if (["paid"].includes(status)) return "paid";
  return "process";
}

type ClearHistoryBody = {
  orderIds?: string[];
  status?: "all" | "process" | "done" | "error";
};

export async function DELETE(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ClearHistoryBody;
    const requestedIds = Array.isArray(body.orderIds)
      ? [...new Set(body.orderIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
      : [];
    const requestedStatus = body.status ?? "all";

    if (requestedIds.length === 0) {
      return NextResponse.json({ message: "Pilih minimal satu riwayat." }, { status: 400 });
    }

    const deletedIds: string[] = [];
    const skippedIds: string[] = [];
    const ownEmail = (session.user.email ?? "").toLowerCase();

    for (const id of requestedIds) {
      const order = await getOrderById(id);
      if (!order || order.userEmail.toLowerCase() !== ownEmail) {
        skippedIds.push(id);
        continue;
      }

      if (!deletableStatuses.has(order.status) || (requestedStatus !== "all" && statusGroup(order.status) !== requestedStatus)) {
        skippedIds.push(id);
        continue;
      }

      if (await deleteOrder(id)) {
        const remainingOrder = await getOrderById(id);
        if (remainingOrder) {
          skippedIds.push(id);
        } else {
          deletedIds.push(id);
        }
      } else {
        skippedIds.push(id);
      }
    }

    if (skippedIds.length > 0) {
      return NextResponse.json(
        { success: false, message: `${skippedIds.length} riwayat belum berhasil dihapus.`, deletedIds, skippedIds },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, deletedIds, skippedIds });
  } catch (error) {
    console.error("DELETE /api/orders/clear-history failed:", error);
    return NextResponse.json({ message: "Gagal membersihkan riwayat pemesanan." }, { status: 500 });
  }
}
