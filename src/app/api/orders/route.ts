import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/server/auth";
import {
  createOrder,
  getProductById,
  listOrdersWithItems,
} from "@/server/store-data";
import {
  appendOrderToCsv,
  sendTelegramActivityNotification,
  sendTelegramOrderNotification,
} from "@/server/notifications";
import { enforceRateLimit } from "@/server/rate-limit";
import { pushOrderMetric } from "@/server/redis";

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1),
});

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const orders = await listOrdersWithItems(50);
  if (session.user.role === "admin") {
    return NextResponse.json({ orders });
  }

  const filtered = orders.filter(
    (order) => order.userEmail.toLowerCase() === (session.user.email ?? "").toLowerCase(),
  );
  return NextResponse.json({ orders: filtered });
}

export async function POST(request: Request) {
  const rateLimited = enforceRateLimit({
    request,
    keyPrefix: "create-order",
    limit: 20,
    windowMs: 60 * 1000,
  });
  if (rateLimited) {
    return rateLimited;
  }

  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = createOrderSchema.parse(body);

    const enrichedItems: Array<{
      productId: string;
      productName: string;
      productDuration: string;
      quantity: number;
      unitPrice: number;
    }> = [];

    for (const item of payload.items) {
      const product = await getProductById(item.productId);
      if (!product || !product.isActive) {
        return NextResponse.json(
          { message: `Produk tidak valid: ${item.productId}` },
          { status: 400 },
        );
      }

      enrichedItems.push({
        productId: product.id,
        productName: product.name,
        productDuration: product.duration ?? "",
        quantity: item.quantity,
        unitPrice: product.price,
      });
    }

    const created = await createOrder({
      userId: session.user.id,
      userName: session.user.username || session.user.name || "User",
      userEmail: session.user.email ?? "-",
      userPhone: session.user.phone ?? "",
      items: enrichedItems,
    });

    const createdAt = new Date().toISOString();

    await Promise.allSettled([
      appendOrderToCsv({
        orderId: created.id,
        createdAt,
        userName: session.user.username || session.user.name || "User",
        userEmail: session.user.email ?? "-",
        userPhone: session.user.phone ?? "",
        total: created.total,
        items: enrichedItems.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      }),
      sendTelegramOrderNotification({
        orderId: created.id,
        userName: session.user.username || session.user.name || "User",
        userEmail: session.user.email ?? "-",
        userPhone: session.user.phone ?? "",
        total: created.total,
        items: enrichedItems,
      }),
      sendTelegramActivityNotification({
        event: "order_created",
        actorName: session.user.username || session.user.name || "User",
        actorEmail: session.user.email ?? "-",
        actorPhone: session.user.phone ?? "",
        description: `Order ${created.id} dibuat (${enrichedItems.length} item).`,
        metadata: [
          `Order ID: ${created.id}`,
          `Total: Rp ${created.total.toLocaleString("id-ID")}`,
          "Produk:",
          ...enrichedItems.map(
            (item, index) =>
              `${index + 1}. ${item.productName} x${item.quantity} @ Rp ${item.unitPrice.toLocaleString("id-ID")}`,
          ),
        ],
      }),
      pushOrderMetric({
        orderId: created.id,
        total: created.total,
        userEmail: session.user.email ?? "-",
        createdAt,
      }),
    ]);

    return NextResponse.json(
      {
        message: "Order berhasil dibuat.",
        orderId: created.id,
        total: created.total,
        createdAt,
        itemCount: enrichedItems.length,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Gagal membuat order." },
      { status: 500 },
    );
  }
}
