import { NextResponse } from "next/server";
import {
  getPaymentSettings,
  listInformations,
  listMarquees,
  listProducts,
  getPrivacyPolicyPage,
  listStoryReels,
  listTestimonials,
} from "@/server/store-data";

export async function GET() {
  try {
    const [products, informations, testimonials, marquees, storyReels, paymentSettings, privacyPolicy] = await Promise.all([
      listProducts(),
      listInformations(),
      listTestimonials(),
      listMarquees(),
      listStoryReels(),
      getPaymentSettings(),
      getPrivacyPolicyPage(),
    ]);

    return NextResponse.json(
      { products, informations, testimonials, marquees, storyReels, paymentSettings, privacyPolicy },
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
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
