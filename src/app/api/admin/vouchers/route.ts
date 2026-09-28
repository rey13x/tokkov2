import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { createVoucher, listVouchers } from "@/server/store-data";

const voucherSchema = z.object({
  code: z.string().trim().min(1).max(40),
  description: z.string().trim().min(1).max(240),
  percentage: z.number().int().min(1).max(100),
  validUntil: z.string().datetime().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  return NextResponse.json({ vouchers: await listVouchers() });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const payload = voucherSchema.parse(await request.json());
    const existing = await listVouchers();
    if (existing.some((voucher) => voucher.code === payload.code.toUpperCase())) {
      return NextResponse.json({ message: "Kode voucher sudah digunakan." }, { status: 409 });
    }

    const voucher = await createVoucher(payload);
    return NextResponse.json({ voucher }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Data voucher belum sesuai." }, { status: 400 });
    }
    console.error("POST /api/admin/vouchers failed:", error);
    return NextResponse.json({ message: "Gagal menambah voucher." }, { status: 500 });
  }
}