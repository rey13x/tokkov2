import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { deleteProduct, updateProduct } from "@/server/store-data";
import { sendTelegramActivityNotification } from "@/server/notifications";
import { refreshPublicStoreData } from "@/server/public-store-data";

const normalizeExternalUrl = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const optionalExternalUrlSchema = z.preprocess(
  normalizeExternalUrl,
  z.union([z.string().url("Link harus berupa URL yang valid"), z.literal("")]),
);

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  category: z.string().min(2).max(50).optional(),
  shortDescription: z.string().min(3).max(140).optional(),
  description: z.string().min(6).max(2000).optional(),
  duration: z.string().max(80).optional(),
  price: z.number().int().min(0).optional(),
  imageUrl: z.string().max(3000000).optional(),
  mediaGallery: z.array(
    z.object({
      url: z.string().max(3000000),
      type: z.enum(["image", "video", "gif"]).optional(),
    })
  ).optional(),
  isActive: z.boolean().optional(),
  productType: z.enum(["jual_beli", "pekerjaan", "donation"]).optional(),
  isHighlighted: z.boolean().optional(),
  jobApplicationLink: optionalExternalUrlSchema.optional(),
  maxApplicants: z.number().int().min(0).optional(),
  buyNowLink: optionalExternalUrlSchema.optional(),
});

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, context: { params: Params }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const payload = updateSchema.parse(body);
    const product = await updateProduct(id, payload);

    if (!product) {
      return NextResponse.json({ message: "Produk tidak ditemukan." }, { status: 404 });
    }

    await sendTelegramActivityNotification({
      event: "admin_product_update",
      actorName: auth.admin.email ?? "Admin",
      actorEmail: auth.admin.email ?? "-",
      description: `Admin update produk ${product.name}.`,
      metadata: [
        `Produk ID: ${product.id}`,
        `Produk: ${product.name}`,
        `Harga: Rp ${product.price.toLocaleString("id-ID")}`,
      ],
    });
    refreshPublicStoreData();

    return NextResponse.json({ product });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Data yang kamu isi belum lengkap atau belum sesuai." },
        { status: 400 },
      );
    }

    console.error("PATCH /api/admin/products/[id] failed:", error);
    const detail =
      error instanceof Error && error.message.trim()
        ? ` (${error.message.trim()})`
        : "";

    return NextResponse.json({ message: `Gagal update produk.${detail}` }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Params }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  await deleteProduct(id);
  await sendTelegramActivityNotification({
    event: "admin_product_delete",
    actorName: auth.admin.email ?? "Admin",
    actorEmail: auth.admin.email ?? "-",
    description: `Admin menghapus produk ${id}.`,
    metadata: [`Produk ID: ${id}`],
  });
  refreshPublicStoreData();
  return NextResponse.json({ message: "Produk berhasil dihapus." });
}
