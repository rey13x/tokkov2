import { NextResponse } from "next/server";
import { GET as getReceipt } from "@/app/api/orders/[id]/receiptline/route";

export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  return getReceipt(request, { params: Promise.resolve({ id: orderId }) });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
