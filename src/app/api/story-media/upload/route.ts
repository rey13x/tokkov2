import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { getFirebaseStorageBucket } from "@/server/firebase-admin";

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB max per image

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

    // Validate file size (2MB max)
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return NextResponse.json(
        {
          message: `Foto terlalu besar (${sizeMB}MB). Maksimal 2MB.`,
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = file.type === "image/png"
      ? "png"
      : file.type === "image/gif"
        ? "gif"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";

    const fileUploadEnabled = process.env.FILE_UPLOAD_ENABLED === "true";
    const bucket = getFirebaseStorageBucket() as any;

    let mediaUrl = "";

    if (!fileUploadEnabled || !bucket) {
      // Fallback: Return error if Firebase is not configured
      return NextResponse.json(
        {
          message:
            "File upload tidak tersedia. Hubungi administrator.",
        },
        { status: 503 }
      );
    }

    // Upload to Firebase Storage
    const fileName = sanitizeFileName(file.name.replace(/\.[^/.]+$/, "") || "story-photo");
    const objectPath = `stories/${session.user.id}/${Date.now()}-${fileName}.${extension}`;
    const object = bucket.file(objectPath);

    await object.save(buffer, {
      resumable: false,
      metadata: {
        contentType: file.type,
      },
    });

    await object.makePublic();
    mediaUrl = `https://storage.googleapis.com/${bucket.name}/${objectPath}`;

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
