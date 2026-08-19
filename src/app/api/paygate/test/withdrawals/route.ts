import { NextResponse, type NextRequest } from "next/server";
import { createTestWithdrawal } from "@/server/paygate/test-mode";

export async function POST(req: NextRequest) {
  try {
    const result = await createTestWithdrawal({ req });
    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; info?: string };
    const status = e?.status || 500;
    const code = e?.message || "INTERNAL_ERROR";
    const message = e?.info || e?.message || "Internal error";
    return NextResponse.json({ success: false, error: { code, message } }, { status });
  }
}
