import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";
import { getOrderStatsLastHours, listOrders } from "@/server/store-data";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const [series, latestOrders] = await Promise.all([
      getOrderStatsLastHours(24),
      listOrders(12),
    ]);

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
