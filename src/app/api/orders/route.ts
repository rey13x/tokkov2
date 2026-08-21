import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/server/auth";
import {
  createOrder,
  getProductById,
  listOrdersWithItems,
} from "@/server/store-data";
import {
  updateUserLastActive,
} from "@/server/db";
import {
  appendOrderToCsv,
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
        donationAmount: z.number().int().min(1).optional(),
        donationName: z.string().max(120).optional(),
        donationMessage: z.string().max(500).optional(),
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

  // For normal users: only return orders that belong to them AND are not hidden for this user
  const myEmail = (session.user.email ?? "").toLowerCase();
  const myUserId = session.user.id;
  const filtered = orders.filter((order) => {
    if (order.userEmail.toLowerCase() !== myEmail) return false;
    // If order has hiddenForUsers and includes this user id, exclude it
    const hiddenList = (order as any).hiddenForUsers as string[] | undefined;
    if (Array.isArray(hiddenList) && hiddenList.includes(myUserId)) return false;
    return true;
  });

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
      productType: "jual_beli" | "pekerjaan" | "donation" | "lms";
      donationAmount?: number;
      donationName?: string;
      donationMessage?: string;
    }> = [];

    for (const item of payload.items) {
      const product = await getProductById(item.productId);
      if (!product || !product.isActive) {
        return NextResponse.json(
          { message: `Produk tidak valid: ${item.productId}` },
          { status: 400 },
        );
      }

      if (product.productType === "donation" && (!item.donationAmount || item.donationAmount < 1)) {
        return NextResponse.json(
          { message: `Nominal donasi untuk ${product.name} wajib diisi.` },
          { status: 400 },
        );
      }
      if (product.productType === "donation" && (!item.donationName?.trim() || !item.donationMessage?.trim())) {
        return NextResponse.json(
          { message: `Nama dan harapan donasi untuk ${product.name} wajib diisi.` },
          { status: 400 },
        );
      }

      enrichedItems.push({
        productId: product.id,
        productName: product.name,
        productDuration: product.duration ?? "",
        quantity: item.quantity,
        unitPrice: product.productType === "donation"
          ? Math.round(item.donationAmount ?? 0)
          : product.price,
        productType: product.productType,
        donationAmount: product.productType === "donation" ? item.donationAmount : undefined,
        donationName: product.productType === "donation" ? item.donationName?.trim() : undefined,
        donationMessage: product.productType === "donation" ? item.donationMessage?.trim() : undefined,
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

    void Promise.allSettled([
      updateUserLastActive(session.user.id),
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
          productType: item.productType,
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
        { message: "Data yang kamu isi belum lengkap atau belum sesuai." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Gagal membuat order." },
      { status: 500 },
    );
  }
}
