import { NextResponse } from "next/server";
import {
  getPaymentSettings,
  listActiveInformations,
  listMarquees,
  listProducts,
  getPrivacyPolicyPage,
  listStoryReels,
  listTestimonials,
  listDonationActivities,
} from "@/server/store-data";
import type { StoreStoryReel } from "@/types/store";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const storyReelId = params.get("storyReelId")?.trim();
    if (storyReelId) {
      const storyReel = (await listStoryReels() as StoreStoryReel[]).find((item) => item.id === storyReelId) ?? null;
      return NextResponse.json(
        { storyReel },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (params.get("productsOnly") === "1") {
      return NextResponse.json(
        { products: await listProducts() },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const [products, informations, testimonials, marquees, storyReels, paymentSettings, privacyPolicy, donationActivities] = await Promise.all([
      params.get("withoutProducts") === "1" ? Promise.resolve([]) : listProducts(),
      listActiveInformations(),
      listTestimonials(),
      listMarquees(),
      listStoryReels(),
      getPaymentSettings(),
      getPrivacyPolicyPage(),
      listDonationActivities(),
    ]);

    return NextResponse.json(
      { products, informations, testimonials, marquees, storyReels, paymentSettings, privacyPolicy, donationActivities },
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
