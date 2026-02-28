import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { createInformation, listInformations } from "@/server/store-data";

const informationSchema = z.object({
  type: z.enum(["message", "poll", "update"]),
  title: z.string().min(2).max(160),
  body: z.string().min(4).max(3000),
  imageUrl: z.string().max(3000000).default("/assets/logo.png"),
  pollOptions: z.array(z.string().min(1).max(80)).default([]),
});

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const informations = await listInformations();
  return NextResponse.json({ informations });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const payload = informationSchema.parse(body);
    const information = await createInformation(payload);
    return NextResponse.json({ information }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("POST /api/admin/informations failed:", error);
    const detail =
      error instanceof Error && error.message.trim()
        ? ` (${error.message.trim()})`
        : "";

    return NextResponse.json(
      { message: `Gagal menambah informasi.${detail}` },
      { status: 500 },
    );
  }
}
