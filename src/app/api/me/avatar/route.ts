import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { updateUserById } from "@/server/db";
import { getFirebaseStorageBucket } from "@/server/firebase-admin";

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif"]);
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (process.env.FILE_UPLOAD_ENABLED !== "true") {
    return NextResponse.json(
      { message: "Upload avatar dinonaktifkan." },
      { status: 403 },
    );
  }

  const bucket = getFirebaseStorageBucket();
  if (!bucket) {
    return NextResponse.json(
      { message: "Penyimpanan avatar belum dikonfigurasi." },
      { status: 500 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "File tidak ditemukan." }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        { message: "Hanya PNG, JPG, dan GIF yang diizinkan." },
        { status: 400 },
      );
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      return NextResponse.json(
        { message: "Ukuran file maksimal 5MB." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = file.type === "image/png" ? "png" : file.type === "image/gif" ? "gif" : "jpg";
    const fileName = sanitizeFileName(file.name.replace(/\.[^/.]+$/, "") || "avatar");
    const objectPath = `profiles/${session.user.id}/${Date.now()}-${fileName}.${extension}`;
    const object = bucket.file(objectPath);

    await object.save(buffer, {
      resumable: false,
      metadata: {
        contentType: file.type,
      },
    });
    await object.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${objectPath}`;
    const updated = await updateUserById(session.user.id, {
      avatarUrl: publicUrl,
    });
    if (!updated) {
      return NextResponse.json({ message: "Gagal update avatar." }, { status: 500 });
    }

    return NextResponse.json({
      message: "Foto profil berhasil diperbarui.",
      avatarUrl: updated.avatarUrl,
    });
  } catch {
    return NextResponse.json(
      { message: "Gagal upload foto profil." },
      { status: 500 },
    );
  }
}
