import { NextResponse } from "next/server";
import { listApprovedBookStories } from "@/server/store-data";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;
    const stories = await listApprovedBookStories();
    const story = stories.find(s => s.id === storyId);
    
    if (!story) {
      return NextResponse.json(
        { message: "Cerita tidak ditemukan" },
        { status: 404 },
      );
    }

    // Create a simple SVG image with white background
    const textLines = story.story.split('\n').slice(0, 20);
    const svgContent = `
      <svg width="1080" height="1440" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
            text { font-family: 'Inter', sans-serif; }
          </style>
        </defs>
        <rect width="1080" height="1440" fill="white"/>
        <text x="54" y="100" font-size="48" font-weight="600" fill="#1a1a1a">Book Spirit</text>
        <text x="54" y="180" font-size="28" font-weight="500" fill="#666">Cerita dari ${story.userName}</text>
        ${textLines
          .map((line, idx) => {
            const yPos = 280 + idx * 60;
            return `<text x="54" y="${yPos}" font-size="24" fill="#333" width="972">${line.slice(0, 80)}</text>`;
          })
          .join('')}
        <text x="54" y="1350" font-size="18" fill="#999">tokko.app • Book Spirit</text>
      </svg>
    `;

    return new NextResponse(svgContent, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error("GET /api/book-stories/[storyId]/share failed:", error);
    return NextResponse.json(
      { message: "Gagal membuat gambar bagikan" },
      { status: 500 },
    );
  }
}
