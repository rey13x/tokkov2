import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { deleteVoucher, listVouchers, updateVoucher } from "@/server/store-data";

const updateSchema = z.object({
  code: z.string().trim().min(1).max(40).optional(),
  description: z.string().trim().min(1).max(240).optional(),
  percentage: z.number().int().min(1).max(100).optional(),
  validUntil: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
});

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, context: { params: Params }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const payload = updateSchema.parse(await request.json());
    if (payload.code) {
      const duplicate = (await listVouchers()).some(
        (voucher) => voucher.id !== id && voucher.code === payload.code!.toUpperCase(),
      );
      if (duplicate) {
        return NextResponse.json({ message: "Kode voucher sudah digunakan." }, { status: 409 });
      }
    }

    const voucher = await updateVoucher(id, payload);
    if (!voucher) {
      return NextResponse.json({ message: "Voucher tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ voucher });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Data voucher belum sesuai." }, { status: 400 });
    }
    console.error("PATCH /api/admin/vouchers/[id] failed:", error);
    return NextResponse.json({ message: "Gagal memperbarui voucher." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Params }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  await deleteVoucher(id);
  return NextResponse.json({ message: "Voucher berhasil dihapus." });
}