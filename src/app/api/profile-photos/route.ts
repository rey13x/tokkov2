import { NextResponse } from "next/server";
import { listProfilePhotos } from "@/server/db";

/**
 * Public endpoint for users to fetch available profile photos
 * This is used in the profile page modal to display photos for selection
 */
export async function GET() {
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
