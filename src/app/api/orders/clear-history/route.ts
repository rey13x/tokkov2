import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { deleteOrder, getOrderById, getFirestoreOrNull } from "@/server/store-data";

const deletableStatuses = new Set([
  "process",
  "pending",
  "pending_payment",
  "new",
  "done",
  "delivered",
  "sent",
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

    const isAdmin = session.user.role === "admin";
    const firestore = getFirestoreOrNull();

    for (const id of requestedIds) {
      const order = await getOrderById(id);
      if (!order || (!isAdmin && order.userEmail.toLowerCase() !== ownEmail)) {
        skippedIds.push(id);
        continue;
      }

      if (!deletableStatuses.has(order.status) || (requestedStatus !== "all" && statusGroup(order.status) !== requestedStatus)) {
        skippedIds.push(id);
        continue;
      }

      // If the caller is an admin, keep original delete behavior
      if (isAdmin) {
        if (await deleteOrder(id)) {
          deletedIds.push(id);
        } else {
          skippedIds.push(id);
        }
        continue;
      }

      // Non-admin user: attempt to soft-hide the order for this user when Firestore is available
      if (firestore) {
        try {
          const ref = firestore.collection("orders").doc(id);
          const doc = await ref.get();
          if (!doc.exists) {
            skippedIds.push(id);
            continue;
          }

          const data = doc.data() as Record<string, unknown>;
          const existing = Array.isArray(data.hiddenForUsers)
            ? (data.hiddenForUsers as string[])
            : Array.isArray(data.hidden_for_users)
              ? (data.hidden_for_users as string[])
              : [];

          const userId = session.user.id;
          if (!existing.includes(userId)) {
            const next = [...existing, userId];
            await ref.update({ hiddenForUsers: next, updatedAt: Date.now() });
          }

          // Report as "deleted" for the front-end so it disappears from user's list
          deletedIds.push(id);
        } catch (err) {
          console.error("Failed to hide order for user in Firestore:", err);
          skippedIds.push(id);
        }
        continue;
      }

      // Fallback: no Firestore available — preserve previous behavior and delete
      if (await deleteOrder(id)) {
        deletedIds.push(id);
      } else {
        skippedIds.push(id);
      }
    }

    return NextResponse.json({ success: true, deletedIds, skippedIds });
  } catch (error) {
    console.error("DELETE /api/orders/clear-history failed:", error);
    return NextResponse.json({ message: "Gagal membersihkan riwayat pemesanan." }, { status: 500 });
  }
}
