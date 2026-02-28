import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { getPrivacyPolicyPage, upsertPrivacyPolicyPage } from "@/server/store-data";

const privacyPolicySchema = z.object({
  title: z.string().min(3).max(180),
  updatedLabel: z.string().min(4).max(180),
  bannerImageUrl: z.string().max(1000).default("/assets/background.jpg"),
  contentHtml: z.string().min(10).max(80000),
});

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const privacyPolicy = await getPrivacyPolicyPage();
    return NextResponse.json({ privacyPolicy });
  } catch {
    return NextResponse.json(
      { message: "Gagal memuat halaman kebijakan privasi." },
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
    const payload = privacyPolicySchema.parse(body);
    const privacyPolicy = await upsertPrivacyPolicyPage(payload);
    return NextResponse.json({ privacyPolicy });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Gagal memperbarui halaman kebijakan privasi." },
      { status: 500 },
    );
  }
}
