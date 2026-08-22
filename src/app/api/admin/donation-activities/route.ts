import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { createDonationActivity, listDonationActivities } from "@/server/store-data";
import { sendTelegramDonationActivityNotification } from "@/server/notifications";

const activitySchema = z.object({
  type: z.enum(["income", "expense", "refund"]),
  amount: z.number().int().positive(),
  note: z.string().min(1).max(2000),
  imageUrl: z.string().max(3000000).optional(),
  occurredAt: z.string().datetime(),
  actorName: z.string().min(1).max(120).default("Tokko Marketplace"),
  actorPhone: z.string().min(8).max(30).default("085121579597"),
});

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ activities: await listDonationActivities() });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const payload = activitySchema.parse(await request.json());
    const activity = await createDonationActivity(payload);
    if (!activity) throw new Error("Aktivitas gagal disimpan.");
    const telegramSent = await sendTelegramDonationActivityNotification(activity);
    return NextResponse.json({ activity, telegramSent }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Data aktivitas belum lengkap atau belum sesuai." }, { status: 400 });
    }
    console.error("POST /api/admin/donation-activities failed:", error);
    return NextResponse.json({ message: "Gagal menyimpan aktivitas donasi." }, { status: 500 });
  }
}