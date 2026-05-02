import { NextResponse } from "next/server";
import { listApprovedBookStories } from "@/server/store-data";

export async function GET() {
  try {
    const stories = await listApprovedBookStories();
    return NextResponse.json({ stories });
  } catch (error) {
    console.error("GET /api/book-stories/approved failed:", error);
    // Return empty array instead of error to prevent page crashes
    return NextResponse.json({ stories: [] });
  }
}
