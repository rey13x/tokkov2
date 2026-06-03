import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { getFirebaseFirestore } from "@/server/firebase-admin";
import { sendTelegramActivityNotification } from "@/server/notifications";

const heroBackgroundSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(2).max(100),
  url: z.string().url("URL harus berupa URL yang valid"),
  duration: z.number().int().min(1000).max(60000).default(8000),
  sortOrder: z.number().int().min(0).default(0),
});

type HeroBackground = z.infer<typeof heroBackgroundSchema>;

const COLLECTION_NAME = "heroBackgrounds";
const DOCUMENT_ID = "config";

async function getHeroBackgroundsFromDb(): Promise<HeroBackground[]> {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return [];
  }

  try {
    const doc = await firestore.collection(COLLECTION_NAME).doc(DOCUMENT_ID).get();
    if (!doc.exists) {
      return [];
    }
    const data = doc.data() as { backgrounds?: HeroBackground[] };
    return data.backgrounds ?? [];
  } catch (error) {
    console.error("Failed to get hero backgrounds from db:", error);
    return [];
  }
}

async function saveHeroBackgroundsToDb(backgrounds: HeroBackground[]): Promise<boolean> {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return false;
  }

  try {
    await firestore.collection(COLLECTION_NAME).doc(DOCUMENT_ID).set({
      backgrounds: backgrounds.sort((a, b) => a.sortOrder - b.sortOrder),
      updatedAt: new Date(),
    });
    return true;
  } catch (error) {
    console.error("Failed to save hero backgrounds to db:", error);
    return false;
  }
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const backgrounds = await getHeroBackgroundsFromDb();
    return NextResponse.json({ backgrounds });
  } catch (error) {
    console.error("GET /api/admin/hero-backgrounds failed:", error);
    return NextResponse.json(
      { message: "Gagal memuat hero backgrounds." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const payload = heroBackgroundSchema.parse(body);

    const backgrounds = await getHeroBackgroundsFromDb();
    
    // Check if ID already exists
    if (backgrounds.some((bg) => bg.id === payload.id)) {
      return NextResponse.json(
        { message: "ID background sudah ada. Gunakan ID yang berbeda." },
        { status: 400 }
      );
    }

    backgrounds.push(payload);
    const saved = await saveHeroBackgroundsToDb(backgrounds);

    if (!saved) {
      return NextResponse.json(
        { message: "Gagal menyimpan hero background." },
        { status: 500 }
      );
    }

    await sendTelegramActivityNotification({
      event: "admin_hero_background_add",
      actorName: auth.admin.email ?? "Admin",
      actorEmail: auth.admin.email ?? "-",
      description: `Admin menambah hero background: ${payload.label}`,
      metadata: [
        `ID: ${payload.id}`,
        `Label: ${payload.label}`,
        `Durasi: ${payload.duration}ms`,
      ],
    });

    return NextResponse.json({ background: payload }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 }
      );
    }

    console.error("POST /api/admin/hero-backgrounds failed:", error);
    const detail =
      error instanceof Error && error.message.trim()
        ? ` (${error.message.trim()})`
        : "";

    return NextResponse.json(
      { message: `Gagal menambah hero background.${detail}` },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { id, ...payload } = body as { id: string } & Partial<HeroBackground>;

    if (!id) {
      return NextResponse.json(
        { message: "ID background wajib diisi." },
        { status: 400 }
      );
    }

    const backgrounds = await getHeroBackgroundsFromDb();
    const index = backgrounds.findIndex((bg) => bg.id === id);

    if (index === -1) {
      return NextResponse.json(
        { message: "Hero background tidak ditemukan." },
        { status: 404 }
      );
    }

    const updated = {
      ...backgrounds[index],
      ...payload,
      id, // Ensure ID doesn't change
    };

    const validationResult = heroBackgroundSchema.safeParse(updated);
    if (!validationResult.success) {
      return NextResponse.json(
        { message: validationResult.error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 }
      );
    }

    backgrounds[index] = validationResult.data;
    const saved = await saveHeroBackgroundsToDb(backgrounds);

    if (!saved) {
      return NextResponse.json(
        { message: "Gagal menyimpan perubahan hero background." },
        { status: 500 }
      );
    }

    await sendTelegramActivityNotification({
      event: "admin_hero_background_update",
      actorName: auth.admin.email ?? "Admin",
      actorEmail: auth.admin.email ?? "-",
      description: `Admin update hero background: ${validationResult.data.label}`,
      metadata: [
        `ID: ${id}`,
        `Label: ${validationResult.data.label}`,
        `Durasi: ${validationResult.data.duration}ms`,
      ],
    });

    return NextResponse.json({ background: validationResult.data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 }
      );
    }

    console.error("PUT /api/admin/hero-backgrounds failed:", error);
    const detail =
      error instanceof Error && error.message.trim()
        ? ` (${error.message.trim()})`
        : "";

    return NextResponse.json(
      { message: `Gagal update hero background.${detail}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { message: "ID background wajib diisi." },
        { status: 400 }
      );
    }

    const backgrounds = await getHeroBackgroundsFromDb();
    const index = backgrounds.findIndex((bg) => bg.id === id);

    if (index === -1) {
      return NextResponse.json(
        { message: "Hero background tidak ditemukan." },
        { status: 404 }
      );
    }

    const deleted = backgrounds[index];
    backgrounds.splice(index, 1);
    const saved = await saveHeroBackgroundsToDb(backgrounds);

    if (!saved) {
      return NextResponse.json(
        { message: "Gagal menghapus hero background." },
        { status: 500 }
      );
    }

    await sendTelegramActivityNotification({
      event: "admin_hero_background_delete",
      actorName: auth.admin.email ?? "Admin",
      actorEmail: auth.admin.email ?? "-",
      description: `Admin hapus hero background: ${deleted.label}`,
      metadata: [`ID: ${id}`],
    });

    return NextResponse.json({ message: "Hero background berhasil dihapus." });
  } catch (error) {
    console.error("DELETE /api/admin/hero-backgrounds failed:", error);
    return NextResponse.json(
      { message: "Gagal menghapus hero background." },
      { status: 500 }
    );
  }
}
