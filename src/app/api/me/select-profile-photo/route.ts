import { getServerAuthSession } from "@/server/auth";
import { findUserById, updateUserById } from "@/server/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { photoUrl } = body;

    if (!photoUrl || typeof photoUrl !== "string") {
      return NextResponse.json(
        { message: "photoUrl is required" },
        { status: 400 }
      );
    }

    // Get current user
    const user = await findUserById(session.user.id);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Update user avatar
    const updated = await updateUserById(session.user.id, {
      avatarUrl: photoUrl,
    });

    if (!updated) {
      return NextResponse.json(
        { message: "Failed to update user" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Profile photo updated successfully",
      avatarUrl: updated.avatarUrl,
    });
  } catch (error) {
    console.error("Failed to update profile photo:", error);
    return NextResponse.json(
      { message: "Failed to update profile photo" },
      { status: 500 }
    );
  }
}

