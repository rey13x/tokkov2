import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";
import { listOrders } from "@/server/store-data";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const orders = await listOrders(100);
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("GET /api/admin/orders failed:", error);
    return NextResponse.json(
      { message: "Gagal memuat daftar order." },
      { status: 500 },
    );
  }
}

