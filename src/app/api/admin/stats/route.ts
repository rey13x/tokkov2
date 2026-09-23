import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";
import { listOrders } from "@/server/store-data";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const [orders, latestOrders] = await Promise.all([listOrders(1000), listOrders(12)]);
    const dailyOrders = new Map<string, { bucket: string; totalOrders: number; totalAmount: number }>();
    orders.forEach((order: { createdAt: string; total: number }) => {
      const date = new Date(order.createdAt);
      const bucket = date.toISOString().slice(0, 10);
      const current = dailyOrders.get(bucket) ?? { bucket, totalOrders: 0, totalAmount: 0 };
      current.totalOrders += 1;
      current.totalAmount += Number(order.total ?? 0);
      dailyOrders.set(bucket, current);
    });
    const series = [...dailyOrders.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)).slice(-30);

    return NextResponse.json({
      series,
      latestOrders,
    });
  } catch (error) {
    console.error("GET /api/admin/stats failed:", error);
    return NextResponse.json(
      { message: "Gagal memuat statistik admin." },
      { status: 500 },
    );
  }
}
