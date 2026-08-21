import { NextResponse } from "next/server";
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

    // Keep the Firestore document safely below its size limit.
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return NextResponse.json(
        {
          message: `Foto terlalu besar (${sizeMB}MB). Maksimal 450KB.`,
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mediaUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

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
