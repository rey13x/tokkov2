import { NextResponse } from "next/server";
import { getPublicStoreData } from "@/server/public-store-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const storeData = await getPublicStoreData();

    return NextResponse.json(
      storeData,
      {
        headers: {
          "Cache-Control": "public, max-age=5, s-maxage=10, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    console.error("Failed to load store data:", error);
    return NextResponse.json(
      {
        products: [],
        informations: [],
        testimonials: [],
        marquees: [],
        storyReels: [],
        paymentSettings: null,
        privacyPolicy: null,
        donationActivities: [],
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
