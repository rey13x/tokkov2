import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { getPaymentSettings, upsertPaymentSettings } from "@/server/store-data";

const MAX_QRIS_DATA_URL_LENGTH = 900_000;

const paymentSettingsSchema = z.object({
  title: z.string().min(2).max(80),
  qrisImageUrl: z
    .string()
    .max(3000000)
    .refine(
      (value) => !value.startsWith("data:") || value.length <= MAX_QRIS_DATA_URL_LENGTH,
      {
        message:
          "Gambar QRIS terlalu besar untuk mode inline. Kompres gambar atau aktifkan bucket upload.",
      },
    ),
  instructionText: z.string().min(10).max(400),
  expiryMinutes: z.number().int().min(5).max(180),
});

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const paymentSettings = await getPaymentSettings();
    return NextResponse.json({ paymentSettings });
  } catch (error) {
    console.error("GET /api/admin/payment-settings failed:", error);
    return NextResponse.json(
      { message: "Gagal memuat pengaturan pembayaran." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const payload = paymentSettingsSchema.parse(body);
    const paymentSettings = await upsertPaymentSettings(payload);
    return NextResponse.json({ paymentSettings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("PUT /api/admin/payment-settings failed:", error);
    return NextResponse.json(
      { message: "Gagal menyimpan pengaturan pembayaran." },
      { status: 500 },
    );
  }
}
