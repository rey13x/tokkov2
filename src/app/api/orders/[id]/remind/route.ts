import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { getOrderById } from "@/server/store-data";
import { sendTelegramActivityNotification } from "@/server/notifications";

type Params = Promise<{ id: string }>;

export async function POST(_request: Request, context: { params: Params }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ message: "Order tidak ditemukan." }, { status: 404 });
  if (order.userId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
  }

  await sendTelegramActivityNotification({
    event: "order_reminder",
    actorName: session.user.username || session.user.name || order.userName,
    actorEmail: session.user.email || order.userEmail,
    actorPhone: session.user.phone || order.userPhone,
    description: `User meminta admin segera memproses order ${id}.`,
    metadata: [`Order ID: ${id}`, `Status: ${order.status}`],
  });

  return NextResponse.json({ message: "Admin sudah diingatkan." });
}