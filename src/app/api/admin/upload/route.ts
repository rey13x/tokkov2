import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";
import { getFirebaseStorageBucket } from "@/server/firebase-admin";

export const runtime = "nodejs";
const MAX_INLINE_FILE_SIZE_BYTES = 8 * 1024 * 1024;

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

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
    const folderRaw = String(formData.get("folder") ?? "media");
    const folder = folderRaw.replace(/[^a-z0-9/_-]+/gi, "").slice(0, 50) || "media";

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
    if (buffer.length > MAX_INLINE_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { message: "Ukuran file terlalu besar. Maksimal 8MB." },
        { status: 400 },
      );
    }

    const fileUploadEnabled = process.env.FILE_UPLOAD_ENABLED === "true";
    const bucket = getFirebaseStorageBucket();
    if (!fileUploadEnabled || !bucket) {
      return NextResponse.json({ url: toInlineDataUrl(file, buffer) });
    }

    const extension = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const fileName = sanitizeFileName(file.name.replace(/\.[^/.]+$/, ""));
    const objectPath = `${folder}/${Date.now()}-${fileName}.${extension}`;
    const object = bucket.file(objectPath);

    await object.save(buffer, {
      resumable: false,
      metadata: {
        contentType: file.type,
      },
    });
    await object.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${objectPath}`;
    return NextResponse.json({ url: publicUrl });
  } catch {
    return NextResponse.json({ message: "Upload media gagal." }, { status: 500 });
  }
}
