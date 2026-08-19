import { NextResponse, type NextRequest } from "next/server";
import { revokeTestApiKey } from "@/server/paygate/test-mode";

export async function POST(req: NextRequest, context: { params: { keyId: string } | Promise<{ keyId: string }> }) {
  try {
    const params = (await Promise.resolve(context.params)) as { keyId: string };
    const result = await revokeTestApiKey({ params });
    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; info?: string };
    const status = e?.status || 500;
    const code = e?.message || "INTERNAL_ERROR";
    const message = e?.info || e?.message || "Internal error";
    return NextResponse.json({ success: false, error: { code, message } }, { status });
  }
}
