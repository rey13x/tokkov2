import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import {
  updatePortfolioItem,
  deletePortfolioItem,
} from "@/server/store-data";
import { sendTelegramActivityNotification } from "@/server/notifications";

const updateSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  description: z.string().min(3).max(500).optional(),
  imageUrl: z.string().optional(),
  category: z.string().min(1).max(50).optional(),
  link: z.string().url().optional().or(z.literal("")),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const resolvedParams = await params;
    const body = await request.json();
    const payload = updateSchema.parse(body);
    const item = await updatePortfolioItem(resolvedParams.id, payload);

    if (!item) {
      return NextResponse.json(
        { message: "Portfolio item tidak ditemukan" },
        { status: 404 },
      );
    }

    await sendTelegramActivityNotification({
      event: "admin_portfolio_item_update",
      actorName: auth.admin.email ?? "Admin",
      actorEmail: auth.admin.email ?? "-",
      description: `Admin memperbarui portfolio item ${item.title}.`,
      metadata: [`ID: ${item.id}`],
    });

    return NextResponse.json({ item }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("PATCH /api/admin/portfolio/[id] failed:", error);
    const detail =
      error instanceof Error && error.message.trim()
        ? ` (${error.message.trim()})`
        : "";

    return NextResponse.json(
      { message: `Gagal memperbarui portfolio item.${detail}` },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const resolvedParams = await params;
    await deletePortfolioItem(resolvedParams.id);

    await sendTelegramActivityNotification({
      event: "admin_portfolio_item_delete",
      actorName: auth.admin.email ?? "Admin",
      actorEmail: auth.admin.email ?? "-",
      description: `Admin menghapus portfolio item.`,
      metadata: [`ID: ${resolvedParams.id}`],
    });

    return NextResponse.json(
      { message: "Portfolio item berhasil dihapus." },
      { status: 200 },
    );
  } catch (error) {
    console.error("DELETE /api/admin/portfolio/[id] failed:", error);
    const detail =
      error instanceof Error && error.message.trim()
        ? ` (${error.message.trim()})`
        : "";

    return NextResponse.json(
      { message: `Gagal menghapus portfolio item.${detail}` },
      { status: 500 },
    );
  }
}
