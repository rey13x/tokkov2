import { NextResponse } from "next/server";
import sharp from "sharp";
import { requireAdmin } from "@/server/admin";

export const runtime = "nodejs";
const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;
// Lebih baik menerima foto kecil asal tetap di bawah batas maksimal 450KB.
const MAX_INLINE_FILE_SIZE_BYTES = 450 * 1024;

function toInlineDataUrl(file: File, buffer: Buffer) {
  const mimeType = file.type || "application/octet-stream";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function compressImage(buffer: Buffer) {
  let width = 2400;
  let quality = 82;
  let output = await sharp(buffer).rotate().resize({ width, withoutEnlargement: true }).webp({ quality }).toBuffer();

  while (output.length > MAX_INLINE_FILE_SIZE_BYTES && quality > 42) {
    quality -= 8;
    width = Math.round(width * 0.85);
    output = await sharp(buffer).rotate().resize({ width, withoutEnlargement: true }).webp({ quality }).toBuffer();
  }

  return output;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "File tidak ditemukan." }, { status: 400 });
    }

    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isAudio && !isVideo) {
      return NextResponse.json(
        { message: "Hanya file image/video/audio yang diizinkan." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { message: "Ukuran file terlalu besar. Maksimal 8MB." },
        { status: 400 },
      );
    }

    if (isImage) {
      const compressed = await compressImage(buffer);
      if (compressed.length > MAX_INLINE_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { message: "Foto terlalu besar setelah dikompres. Maksimal 450KB." },
          { status: 400 },
        );
      }
      return NextResponse.json({ url: `data:image/webp;base64,${compressed.toString("base64")}` });
    }

    if (buffer.length > MAX_INLINE_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { message: "Ukuran file terlalu besar untuk Firestore. Maksimal 450KB." },
        { status: 400 },
      );
    }

    return NextResponse.json({ url: toInlineDataUrl(file, buffer) });
  } catch {
    return NextResponse.json({ message: "Upload media gagal." }, { status: 500 });
  }
}
