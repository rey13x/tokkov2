import { NextResponse } from "next/server";
import {
  getPaymentSettings,
  listInformations,
  listMarquees,
  listProducts,
  listStoryReels,
  listTestimonials,
} from "@/server/store-data";

export async function GET() {
  try {
    const [products, informations, testimonials, marquees, storyReels, paymentSettings] = await Promise.all([
      listProducts(),
      listInformations(),
      listTestimonials(),
      listMarquees(),
      listStoryReels(),
      getPaymentSettings(),
    ]);

    return NextResponse.json(
      { products, informations, testimonials, marquees, storyReels, paymentSettings },
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
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
