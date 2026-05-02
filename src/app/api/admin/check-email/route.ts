import { NextResponse } from "next/server";
import { isAdminEmail } from "@/server/db";

/**
 * DEBUG ENDPOINT: Check if an email is registered as admin
 * This is a public endpoint for debugging purposes only
 * 
 * GET /api/admin/check-email?email=test@example.com
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter required" },
        { status: 400 }
      );
    }

    const isAdmin = await isAdminEmail(email);
    const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "digitalawanku2@gmail.com";

    return NextResponse.json({
      email: email.toLowerCase(),
      isAdmin,
      configuredAdminEmail,
      message: isAdmin 
        ? `✅ ${email} is registered as ADMIN` 
        : `❌ ${email} is NOT admin (but configured admin is: ${configuredAdminEmail})`
    });
  } catch (error) {
    console.error("Error checking admin email:", error);
    return NextResponse.json(
      { error: "Failed to check admin email", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
