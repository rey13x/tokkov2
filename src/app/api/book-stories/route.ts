import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/server/auth";
import { createBookStory } from "@/server/store-data";
import { findUserById } from "@/server/db";

const categoryOptions = [
  "Novel",
  "Cerpen",
  "Puisi",
  "Horor",
  "Romance",
  "Komedi",
  "Action",
  "Petualangan",
  "Fantasi",
  "Fiksi Ilmiah",
  "Misteri",
  "Thriller",
  "Drama",
  "Slice of Life",
  "Motivasi",
  "Inspirasi Hidup",
  "Psikologi",
  "Filosofi",
  "Self Improvement",
  "Biografi",
  "Autobiografi",
  "Sejarah",
  "Religi",
  "Spiritual",
  "Teen Fiction",
  "Young Adult",
  "New Adult",
  "Adult",
  "Distopia",
  "Kriminal",
  "Detektif",
  "Survival",
  "Tragedi",
  "Supernatural",
  "Paranormal",
  "Zombie",
  "Apocalypse",
  "Coming of Age",
  "Romcom",
  "Sastra",
  "Dongeng",
  "Mitologi",
  "Kehidupan Sekolah",
  "Persahabatan",
  "Keluarga",
  "Politik",
  "Bisnis",
  "Teknologi",
  "Pendidikan",
  "Cerita Perang",
  "Time Travel",
  "Dark Fantasy",
  "Historical Fiction",
  "Antologi",
  "Kumpulan Cerita Pendek",
  "Monolog",
  "Fabel",
  "Satire",
] as const;

const submitStorySchema = z.object({
  story: z.string().min(10).max(5000),
  photos: z.array(z.string()).default([]),
  rating: z.number().min(0).max(5).optional(),
  linkedProducts: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })).optional(),
  elements: z.array(z.object({
    emoji: z.string(),
    opacity: z.number().min(0).max(1),
  })).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Kamu harus login untuk menambahkan cerita." },
        { status: 401 },
      );
    }

    if (!session.user.id) {
      console.error("User session missing ID:", session.user);
      return NextResponse.json(
        { message: "Sesi login tidak valid. Silakan login ulang." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const payload = submitStorySchema.parse(body);

    // Get user avatar URL from database
    const user = await findUserById(session.user.id).catch(() => null);
    const userAvatarUrl = user?.avatarUrl || "";

    const story = await createBookStory({
      userId: session.user.id,
      userName: session.user.name || "Anonymous",
      userEmail: session.user.email,
      userAvatarUrl,
      title: "", // Title is optional now
      category: "", // Category is optional now
      story: payload.story,
      photos: payload.photos,
      rating: payload.rating,
      linkedProducts: payload.linkedProducts,
      elements: payload.elements,
    });

    return NextResponse.json({
      story,
      message: "Cerita kamu sudah tersimpan dan langsung dipublikasikan!",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    console.error("POST /api/book-stories failed:", error);
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Gagal menyimpan cerita. Coba lagi nanti.";

    return NextResponse.json(
      { message },
      { status: 500 },
    );
  }
}
