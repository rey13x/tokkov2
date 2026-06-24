import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";

// In-memory storage for demo - replace with database in production
let profilePhotos: Array<{ id: string; url: string; createdAt: string }> = [];

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json({
    success: true,
    photos: profilePhotos,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { message: "URL is required" },
        { status: 400 }
      );
    }

    const newPhoto = {
      id: Date.now().toString(),
      url,
      createdAt: new Date().toISOString(),
    };

    profilePhotos.push(newPhoto);

    return NextResponse.json({
      success: true,
      photo: newPhoto,
      message: "Profile photo added successfully",
    });
  } catch (error) {
    console.error("Failed to add profile photo:", error);
    return NextResponse.json(
      { message: "Failed to add profile photo" },
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
      return NextResponse.json({ message: "ID is required" }, { status: 400 });
    }

    profilePhotos = profilePhotos.filter((photo) => photo.id !== id);

    return NextResponse.json({
      success: true,
      message: "Profile photo deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete profile photo:", error);
    return NextResponse.json(
      { message: "Failed to delete profile photo" },
      { status: 500 }
    );
  }
}
