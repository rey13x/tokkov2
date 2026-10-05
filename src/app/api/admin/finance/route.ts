import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { getAppMetaValue, upsertAppMetaValue } from "@/server/db";
import { listAllProducts, listOrdersWithItems } from "@/server/store-data";
import type { FinanceAdjustment, FinanceSettings } from "@/lib/finance-report";

const FINANCE_SETTINGS_KEY = "admin-finance-settings-v1";
const LIMITED_ADMIN_EMAIL = (process.env.NEXT_PUBLIC_LIMITED_ADMIN_EMAIL ?? process.env.LIMITED_ADMIN_EMAIL ?? "sobatpremium@gmail.com").trim().toLowerCase();
const adjustmentSchema = z.object({
  date: z.string().datetime(),
  description: z.string().trim().min(1).max(160),
  direction: z.enum(["add", "subtract"]),
  affects: z.enum(["revenue", "hpp", "expense", "profit", "cash"]),
  amount: z.number().int().positive().max(1_000_000_000_000),
});
const costsSchema = z.record(z.string().min(1).max(120), z.number().int().min(0).max(1_000_000_000_000));

async function requireFinanceAdmin() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (auth.admin.email.trim().toLowerCase() === LIMITED_ADMIN_EMAIL) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: "Akses laporan keuangan hanya untuk admin penuh." }, { status: 403 }),
    };
  }
  return auth;
}

async function readSettings(): Promise<FinanceSettings> {
  const serialized = await getAppMetaValue(FINANCE_SETTINGS_KEY);
  if (!serialized) {
    return { costByProductId: {}, adjustments: [] };
  }

  try {
    const parsed = JSON.parse(serialized) as Partial<FinanceSettings>;
    const costs = parsed.costByProductId && typeof parsed.costByProductId === "object"
      ? Object.fromEntries(Object.entries(parsed.costByProductId).map(([id, value]) => [id, Math.max(0, Number(value) || 0)]))
      : {};
    const adjustments = Array.isArray(parsed.adjustments) ? parsed.adjustments.filter((item): item is FinanceAdjustment =>
      Boolean(item && typeof item.id === "string" && typeof item.description === "string" &&
        Number.isFinite(Number(item.amount)) && ["add", "subtract"].includes(item.direction) &&
        ["revenue", "hpp", "expense", "profit", "cash"].includes(item.affects) &&
        Number.isFinite(new Date(item.date).getTime())),
    ) : [];
    return { costByProductId: costs, adjustments };
  } catch {
    return { costByProductId: {}, adjustments: [] };
  }
}

async function saveSettings(settings: FinanceSettings) {
  await upsertAppMetaValue(FINANCE_SETTINGS_KEY, JSON.stringify(settings));
}

export async function GET() {
  const auth = await requireFinanceAdmin();
  if (!auth.ok) return auth.response;

  try {
    const [orders, products, settings] = await Promise.all([
      listOrdersWithItems(1000),
      listAllProducts(),
      readSettings(),
    ]);
    return NextResponse.json({ orders, products, settings }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/admin/finance failed:", error);
    return NextResponse.json({ message: "Gagal memuat laporan keuangan." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireFinanceAdmin();
  if (!auth.ok) return auth.response;

  try {
    const parsed = adjustmentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ message: "Data penyesuaian belum valid." }, { status: 400 });
    }

    const settings = await readSettings();
    const adjustment: FinanceAdjustment = {
      ...parsed.data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    settings.adjustments = [adjustment, ...settings.adjustments].slice(0, 2000);
    await saveSettings(settings);
    return NextResponse.json({ settings, adjustment }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/finance failed:", error);
    return NextResponse.json({ message: "Gagal menyimpan penyesuaian keuangan." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireFinanceAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as { costByProductId?: unknown };
    const parsedCosts = costsSchema.safeParse(body.costByProductId);
    if (!parsedCosts.success) {
      return NextResponse.json({ message: "Nilai HPP belum valid." }, { status: 400 });
    }

    const productIds = new Set((await listAllProducts()).map((product) => product.id));
    const settings = await readSettings();
    settings.costByProductId = Object.fromEntries(
      Object.entries(parsedCosts.data).filter(([productId]) => productIds.has(productId)),
    );
    await saveSettings(settings);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("PUT /api/admin/finance failed:", error);
    return NextResponse.json({ message: "Gagal menyimpan HPP." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireFinanceAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as { id?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ message: "ID penyesuaian wajib diisi." }, { status: 400 });
    }

    const settings = await readSettings();
    settings.adjustments = settings.adjustments.filter((adjustment) => adjustment.id !== id);
    await saveSettings(settings);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("DELETE /api/admin/finance failed:", error);
    return NextResponse.json({ message: "Gagal menghapus penyesuaian." }, { status: 500 });
  }
}