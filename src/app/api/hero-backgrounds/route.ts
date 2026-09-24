import { NextResponse } from "next/server";
import { getFirebaseFirestore } from "@/server/firebase-admin";
import { getAppMetaValue } from "@/server/db";

interface HeroBackground {
  id: string;
  label: string;
  url: string;
  duration: number;
  sortOrder: number;
}

export async function GET() {
  try {
    const firestore = getFirebaseFirestore();
    if (!firestore) {
      const stored = await getAppMetaValue("hero-backgrounds-v1");
      const backgrounds = stored ? JSON.parse(stored) as HeroBackground[] : [];
      return NextResponse.json({ backgrounds }, {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    const doc = await firestore.collection("heroBackgrounds").doc("config").get();
    if (!doc.exists) {
      return NextResponse.json({ backgrounds: [] }, {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    const data = doc.data() as { backgrounds?: HeroBackground[] };
    const backgrounds = data.backgrounds ?? [];

    return NextResponse.json({ backgrounds }, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to get hero backgrounds:", error);
    
    return NextResponse.json({ backgrounds: [] }, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}
