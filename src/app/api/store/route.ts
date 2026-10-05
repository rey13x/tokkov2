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
import { findStoryReelBySlug } from "@/lib/story-reel";
import { toPublicStoryReel } from "@/lib/story-reel-quiz";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const storyReelId = params.get("storyReelId")?.trim();
    if (storyReelId) {
      const storyReel = (await listStoryReels() as StoreStoryReel[]).find((item) => item.id === storyReelId) ?? null;
      return NextResponse.json(
        { storyReel: storyReel ? toPublicStoryReel(storyReel) : null },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const storyReelSlug = params.get("storyReelSlug")?.trim();
    if (storyReelSlug) {
      const activeStoryReels = (await listStoryReels() as StoreStoryReel[]).filter((item) => item.isActive);
      const storyReel = findStoryReelBySlug(activeStoryReels, storyReelSlug);
      return NextResponse.json(
        { storyReel: storyReel ? toPublicStoryReel(storyReel) : null },
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
      {
        products,
        informations,
        testimonials,
        marquees,
        storyReels: (storyReels as StoreStoryReel[]).map(toPublicStoryReel),
        paymentSettings,
        privacyPolicy,
        donationActivities,
      },
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
