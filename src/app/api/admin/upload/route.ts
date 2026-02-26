import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";
import { getFirebaseStorageBucket } from "@/server/firebase-admin";

export const runtime = "nodejs";

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const bucket = getFirebaseStorageBucket();
  if (!bucket) {
    return NextResponse.json(
      { message: "Firebase Storage belum dikonfigurasi." },
      { status: 500 },
    );
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
    if (!isImage && !isAudio) {
      return NextResponse.json(
        { message: "Hanya file image/audio yang diizinkan." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
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
    return NextResponse.json({ message: "Upload gambar gagal." }, { status: 500 });
  }
}
