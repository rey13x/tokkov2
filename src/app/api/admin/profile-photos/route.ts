import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { requireAdmin } from "@/server/admin";
import { listProfilePhotos, createProfilePhoto, deleteProfilePhoto } from "@/server/db";

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 450 * 1024;

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

      const buffer = Buffer.from(await fileInput.arrayBuffer());
      let quality = 68;
      let width = 1800;
      let compressed = await sharp(buffer)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();

      while ((compressed.length > MAX_IMAGE_SIZE_BYTES || compressed.length > 220 * 1024) && quality > 32) {
        quality -= 8;
        width = Math.round(width * 0.8);
        compressed = await sharp(buffer)
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality })
          .toBuffer();
      }

      if (compressed.length > MAX_IMAGE_SIZE_BYTES) {
        return NextResponse.json(
          { message: "Foto terlalu besar setelah dikompres. Maksimal 450KB." },
          { status: 400 },
        );
      }
      photoUrl = `data:image/webp;base64,${compressed.toString("base64")}`;
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
