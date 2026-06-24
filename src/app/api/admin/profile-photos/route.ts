import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";
import { listProfilePhotos, createProfilePhoto, deleteProfilePhoto } from "@/server/db";
import { getFirebaseStorageBucket } from "@/server/firebase-admin";

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB max per image

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const photos = await listProfilePhotos();
    return NextResponse.json({
      success: true,
      photos,
    });
  } catch (error) {
    console.error("Failed to fetch profile photos:", error);
    return NextResponse.json(
      { message: "Gagal mengambil foto profil" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    let urlInput = "";
    let fileInput: File | null = null;
    const contentType = request.headers.get("content-type") || "";

    // Handle both JSON and FormData content types
    if (contentType.includes("application/json")) {
      // Parse as JSON
      const body = await request.json();
      urlInput = body.url || "";
    } else if (contentType.includes("multipart/form-data")) {
      // Parse as FormData
      const formData = await request.formData();
      const urlField = formData.get("url");
      const fileField = formData.get("file");
      
      if (typeof urlField === "string") {
        urlInput = urlField;
      }
      if (fileField instanceof File) {
        fileInput = fileField;
      }
    }

    let photoUrl = "";

    // Handle URL input
    if (urlInput && typeof urlInput === "string" && urlInput.trim()) {
      photoUrl = urlInput.trim();
    }
    // Handle file upload
    else if (fileInput instanceof File) {
      // Validate file type
      if (!ALLOWED_IMAGE_TYPES.has(fileInput.type)) {
        return NextResponse.json(
          { message: "Hanya PNG, JPG, GIF, dan WEBP yang diizinkan" },
          { status: 400 }
        );
      }

      // Validate file size (1MB max)
      if (fileInput.size > MAX_IMAGE_SIZE_BYTES) {
        const sizeMB = (fileInput.size / (1024 * 1024)).toFixed(2);
        return NextResponse.json(
          { message: `Foto terlalu besar (${sizeMB}MB). Maksimal 1MB.` },
          { status: 400 }
        );
      }

      const fileUploadEnabled = process.env.FILE_UPLOAD_ENABLED === "true";
      const bucket = getFirebaseStorageBucket() as any;

      if (!fileUploadEnabled || !bucket) {
        return NextResponse.json(
          { message: "Upload file tidak tersedia. Gunakan URL atau hubungi administrator." },
          { status: 503 }
        );
      }

      // Upload to Firebase Storage
      const buffer = Buffer.from(await fileInput.arrayBuffer());
      const extension = fileInput.type === "image/png"
        ? "png"
        : fileInput.type === "image/gif"
          ? "gif"
          : fileInput.type === "image/webp"
            ? "webp"
            : "jpg";

      const fileName = sanitizeFileName(fileInput.name.replace(/\.[^/.]+$/, "") || "profile-photo");
      const objectPath = `profile-photos/${Date.now()}-${fileName}.${extension}`;
      const object = bucket.file(objectPath);

      await object.save(buffer, {
        resumable: false,
        metadata: {
          contentType: fileInput.type,
        },
      });

      await object.makePublic();
      photoUrl = `https://storage.googleapis.com/${bucket.name}/${objectPath}`;
    } else {
      return NextResponse.json(
        { message: "URL atau file foto diperlukan" },
        { status: 400 }
      );
    }

    const newPhoto = await createProfilePhoto(photoUrl);

    return NextResponse.json({
      success: true,
      photo: newPhoto,
      message: "Foto profil berhasil ditambahkan",
    });
  } catch (error) {
    console.error("Failed to add profile photo:", error);
    return NextResponse.json(
      { message: "Gagal menambahkan foto profil" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ message: "ID foto diperlukan" }, { status: 400 });
    }

    await deleteProfilePhoto(id);

    return NextResponse.json({
      success: true,
      message: "Foto profil berhasil dihapus",
    });
  } catch (error) {
    console.error("Failed to delete profile photo:", error);
    return NextResponse.json(
      { message: "Gagal menghapus foto profil" },
      { status: 500 }
    );
  }
}
