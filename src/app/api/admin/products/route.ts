import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import {
  createProduct,
  deleteAllProducts,
  listAllProducts,
} from "@/server/store-data";
import { sendTelegramActivityNotification } from "@/server/notifications";

const baseSchema = z.object({
  name: z.string().min(2).max(120),
  category: z.string().min(2).max(50),
  shortDescription: z.string().min(3).max(140),
  description: z.string().min(6).max(2000),
  duration: z.string().max(80).default("") ,
  price: z.number().int().min(0),
  imageUrl: z.string().max(3000000).default("/assets/logo.png"),
  mediaGallery: z.array(
    z.object({
      url: z.string().max(3000000),
      type: z.enum(["image", "video", "gif"]).optional(),
    })
  ).default([]),
  productType: z.enum(["jual_beli", "pekerjaan"]).default("jual_beli"),
});

const productSchema = baseSchema.and(
  z.union([
    z.object({
      productType: z.literal("jual_beli"),
      jobApplicationLink: z.string().optional().or(z.literal("")),
      maxApplicants: z.number().optional().or(z.literal(0)),
      buyNowLink: z.string().url("Link harus berupa URL yang valid").optional().or(z.literal("")),
    }),
    z.object({
      productType: z.literal("pekerjaan"),
      jobApplicationLink: z.string().min(1, "Link pendaftaran wajib diisi").url("Link pendaftaran harus berupa URL yang valid"),
      maxApplicants: z.number().int().min(1, { message: "Jumlah pelamar maksimal minimal 1" }),
    }),
  ])
);

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const products = await listAllProducts();
  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const payload = productSchema.parse(body);
    const product = await createProduct(payload);
    await sendTelegramActivityNotification({
      event: "admin_product_create",
      actorName: auth.admin.email ?? "Admin",
      actorEmail: auth.admin.email ?? "-",
      description: `Admin menambah produk ${payload.name}.`,
      metadata: [
        `Produk: ${payload.name}`,
        `Kategori: ${payload.category}`,
        `Harga: Rp ${payload.price.toLocaleString("id-ID")}`,
        `ID Produk: ${product?.id ?? "-"}`,
      ],
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("POST /api/admin/products failed:", error);
    const detail =
      error instanceof Error && error.message.trim()
        ? ` (${error.message.trim()})`
        : "";

    return NextResponse.json(
      { message: `Gagal menambah produk.${detail}` },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  await deleteAllProducts();
  await sendTelegramActivityNotification({
    event: "admin_product_delete_all",
    actorName: auth.admin.email ?? "Admin",
    actorEmail: auth.admin.email ?? "-",
    description: "Admin menghapus semua produk.",
  });
  return NextResponse.json({ message: "Semua produk berhasil dihapus." });
}
