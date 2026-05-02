import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import {
  createPortfolioItem,
  listAllPortfolioItems,
  getHomepageConfig,
  updateHomepageConfig,
} from "@/server/store-data";
import { sendTelegramActivityNotification } from "@/server/notifications";

const portfolioItemSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(3).max(500),
  imageUrl: z.string().max(3000000).default("/assets/logo.png"),
  category: z.string().min(1).max(50),
  link: z.string().url().optional().or(z.literal("")),
  sortOrder: z.number().int().min(0).optional(),
});

const homepageConfigSchema = z.object({
  portfolioEnabled: z.boolean().optional(),
  servicesEnabled: z.boolean().optional(),
  testimonialEnabled: z.boolean().optional(),
  productsEnabled: z.boolean().optional(),
  informationEnabled: z.boolean().optional(),
  marqueeEnabled: z.boolean().optional(),
  heroTitle: z.string().max(100).optional(),
  heroSubtitle: z.string().max(200).optional(),
  portfolioSectionTitle: z.string().max(100).optional(),
});

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const [portfolioItems, homepageConfig] = await Promise.all([
      listAllPortfolioItems(),
      getHomepageConfig(),
    ]);

    return NextResponse.json({ portfolioItems, homepageConfig });
  } catch (error) {
    console.error("GET /api/admin/portfolio failed:", error);
    return NextResponse.json(
      { message: "Gagal mengambil data portfolio" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { type, ...payload } = body;

    if (type === "portfolio-item") {
      const validatedPayload = portfolioItemSchema.parse(payload);
      const item = await createPortfolioItem(validatedPayload);

      await sendTelegramActivityNotification({
        event: "admin_portfolio_item_create",
        actorName: auth.admin.email ?? "Admin",
        actorEmail: auth.admin.email ?? "-",
        description: `Admin menambah portfolio item ${validatedPayload.title}.`,
        metadata: [
          `Judul: ${validatedPayload.title}`,
          `Kategori: ${validatedPayload.category}`,
          `ID: ${item?.id ?? "-"}`,
        ],
      });

      return NextResponse.json({ item }, { status: 201 });
    } else if (type === "homepage-config") {
      const validatedPayload = homepageConfigSchema.parse(payload);
      const config = await updateHomepageConfig(validatedPayload);

      await sendTelegramActivityNotification({
        event: "admin_homepage_config_update",
        actorName: auth.admin.email ?? "Admin",
        actorEmail: auth.admin.email ?? "-",
        description: "Admin memperbarui konfigurasi homepage.",
      });

      return NextResponse.json({ config }, { status: 200 });
    } else {
      return NextResponse.json(
        { message: "Type tidak valid" },
        { status: 400 },
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("POST /api/admin/portfolio failed:", error);
    const detail =
      error instanceof Error && error.message.trim()
        ? ` (${error.message.trim()})`
        : "";

    return NextResponse.json(
      { message: `Gagal memproses portfolio.${detail}` },
      { status: 500 },
    );
  }
}
