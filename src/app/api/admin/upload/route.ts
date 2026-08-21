import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";

export const runtime = "nodejs";
const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;
// Firestore document has ~1 MiB limit; keep inline media far below that.
const MAX_INLINE_FILE_SIZE_BYTES = 450 * 1024;

function toInlineDataUrl(file: File, buffer: Buffer) {
  const mimeType = file.type || "application/octet-stream";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
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
