import { NextResponse } from "next/server";
import {
  getPaymentSettings,
  listInformations,
  listMarquees,
  listProducts,
  getPrivacyPolicyPage,
  listStoryReels,
  listTestimonials,
  listDonationActivities,
} from "@/server/store-data";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    if (params.get("productsOnly") === "1") {
      return NextResponse.json(
        { products: await listProducts() },
        { headers: { "Cache-Control": "public, max-age=5, s-maxage=10, stale-while-revalidate=60" } },
      );
    }

    const [products, informations, testimonials, marquees, storyReels, paymentSettings, privacyPolicy, donationActivities] = await Promise.all([
      params.get("withoutProducts") === "1" ? Promise.resolve([]) : listProducts(),
      listInformations(),
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
