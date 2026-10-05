import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { compressImageToWebp } from "@/server/image-compression";

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_SOURCE_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

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

    if (file.size > MAX_SOURCE_IMAGE_SIZE_BYTES) {
      return NextResponse.json({ message: "Ukuran file terlalu besar. Maksimal 8MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const compressed = await compressImageToWebp(buffer);
    if (!compressed) {
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
