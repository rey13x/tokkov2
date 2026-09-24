import { NextResponse } from "next/server";
import sharp from "sharp";
import { getServerAuthSession } from "@/server/auth";

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 450 * 1024;

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "File tidak ditemukan." },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        { message: "Hanya PNG, JPG, GIF, dan WEBP yang diizinkan." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let compressed = await sharp(buffer).rotate().resize({ width: 1800, withoutEnlargement: true }).webp({ quality: 68 }).toBuffer();
    let quality = 68;
    let width = 1800;
    while ((compressed.length > MAX_IMAGE_SIZE_BYTES || compressed.length > 220 * 1024) && quality > 32) {
      quality -= 8;
      width = Math.round(width * 0.8);
      compressed = await sharp(buffer).rotate().resize({ width, withoutEnlargement: true }).webp({ quality }).toBuffer();
    }
    if (compressed.length > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { message: "Foto terlalu besar setelah dikompres. Coba pilih foto lain." },
        { status: 400 },
      );
    }
    const mediaUrl = `data:image/webp;base64,${compressed.toString("base64")}`;

    return NextResponse.json({
      url: mediaUrl,
      message: "Foto berhasil diupload",
    });
  } catch (error) {
    console.error("Story media upload failed:", error);
    return NextResponse.json(
      { message: "Gagal upload foto. Coba lagi nanti." },
      { status: 500 }
    );
  }
}
