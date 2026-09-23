import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";
import { listOrders } from "@/server/store-data";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const period = new URL(request.url).searchParams.get("period") ?? "day";
    const [orders, latestOrders] = await Promise.all([listOrders(1000), listOrders(12)]);
    const dailyOrders = new Map<string, { bucket: string; totalOrders: number; totalAmount: number }>();
    orders.forEach((order: { createdAt: string; total: number }) => {
      const date = new Date(order.createdAt);
      const iso = date.toISOString();
      const bucket = period === "hour"
        ? `${iso.slice(0, 13)}:00`
        : period === "month"
          ? iso.slice(0, 7)
          : period === "year"
            ? iso.slice(0, 4)
            : iso.slice(0, 10);
      const current = dailyOrders.get(bucket) ?? { bucket, totalOrders: 0, totalAmount: 0 };
      current.totalOrders += 1;
      current.totalAmount += Number(order.total ?? 0);
      dailyOrders.set(bucket, current);
    });
    const limit = period === "hour" ? 24 : period === "month" ? 12 : period === "year" ? 10 : 30;
    const series = [...dailyOrders.values()]
      .sort((a, b) => a.bucket.localeCompare(b.bucket))
      .slice(-limit);

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
