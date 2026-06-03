import { NextResponse } from "next/server";
import { getFirebaseFirestore } from "@/server/firebase-admin";

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
      // Fallback ke static data jika tidak ada database
      const defaultBackgrounds: HeroBackground[] = [
        { id: "bg-default", label: "Background Default", url: "/assets/backgroundv2.png", duration: 8000, sortOrder: 0 },
        { id: "bg-2", label: "Background 2", url: "/assets/bg2.jpeg", duration: 6000, sortOrder: 1 },
        { id: "bg-3", label: "Background 3", url: "/assets/bg3.jpeg", duration: 8000, sortOrder: 2 },
        { id: "bg-4", label: "Background 4", url: "/assets/bg4.jpeg", duration: 8000, sortOrder: 3 },
      ];
      return NextResponse.json({ backgrounds: defaultBackgrounds }, {
        headers: {
          "Cache-Control": "public, max-age=5, s-maxage=10, stale-while-revalidate=60",
        },
      });
    }

    const doc = await firestore.collection("heroBackgrounds").doc("config").get();
    if (!doc.exists) {
      // Return default backgrounds
      const defaultBackgrounds: HeroBackground[] = [
        { id: "bg-default", label: "Background Default", url: "/assets/backgroundv2.png", duration: 8000, sortOrder: 0 },
        { id: "bg-2", label: "Background 2", url: "/assets/bg2.jpeg", duration: 6000, sortOrder: 1 },
        { id: "bg-3", label: "Background 3", url: "/assets/bg3.jpeg", duration: 8000, sortOrder: 2 },
        { id: "bg-4", label: "Background 4", url: "/assets/bg4.jpeg", duration: 8000, sortOrder: 3 },
      ];
      return NextResponse.json({ backgrounds: defaultBackgrounds }, {
        headers: {
          "Cache-Control": "public, max-age=5, s-maxage=10, stale-while-revalidate=60",
        },
      });
    }

    const data = doc.data() as { backgrounds?: HeroBackground[] };
    const backgrounds = data.backgrounds ?? [];

    return NextResponse.json({ backgrounds }, {
      headers: {
        "Cache-Control": "public, max-age=5, s-maxage=10, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Failed to get hero backgrounds:", error);
    
    // Fallback ke default data
    const defaultBackgrounds: HeroBackground[] = [
      { id: "bg-default", label: "Background Default", url: "/assets/backgroundv2.png", duration: 8000, sortOrder: 0 },
      { id: "bg-2", label: "Background 2", url: "/assets/bg2.jpeg", duration: 6000, sortOrder: 1 },
      { id: "bg-3", label: "Background 3", url: "/assets/bg3.jpeg", duration: 8000, sortOrder: 2 },
      { id: "bg-4", label: "Background 4", url: "/assets/bg4.jpeg", duration: 8000, sortOrder: 3 },
    ];
    
    return NextResponse.json({ backgrounds: defaultBackgrounds }, {
      headers: {
        "Cache-Control": "public, max-age=5, s-maxage=10, stale-while-revalidate=60",
      },
    });
  }
}
