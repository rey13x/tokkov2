import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";
import { getOrderStatsLastHours, listOrders } from "@/server/store-data";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const [series, latestOrders] = await Promise.all([
    getOrderStatsLastHours(24),
    listOrders(12),
  ]);

  return NextResponse.json({
    series,
    latestOrders,
  });
}
