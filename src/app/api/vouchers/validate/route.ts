import { NextResponse } from "next/server";
import { z } from "zod";
import { getVoucherByCode } from "@/server/store-data";
import { isVoucherCodeValid, normalizeVoucherCode } from "@/lib/voucher";

const schema = z.object({ code: z.string().trim().min(1).max(40) });

export async function POST(request: Request) {
  try {
    const { code } = schema.parse(await request.json());
    const voucher = await getVoucherByCode(normalizeVoucherCode(code));
    if (!voucher) {
      return NextResponse.json({ message: "Kode Voucher tidak ditemukan sobat." }, { status: 404 });
    }
    if (!isVoucherCodeValid(voucher)) {
      return NextResponse.json({ message: "Kode Voucher udah gak berlaku sobat." }, { status: 410 });
    }
    return NextResponse.json({ voucher: { code: voucher.code, description: voucher.description, percentage: voucher.percentage } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Masukkan kode voucher terlebih dahulu." }, { status: 400 });
    }
    console.error("POST /api/vouchers/validate failed:", error);
    return NextResponse.json({ message: "Gagal memeriksa voucher." }, { status: 500 });
  }
}