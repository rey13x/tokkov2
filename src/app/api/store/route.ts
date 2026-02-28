import { NextResponse } from "next/server";
import {
  listInformations,
  listMarquees,
  listProducts,
  listTestimonials,
} from "@/server/store-data";

export async function GET() {
  try {
    const [products, informations, testimonials, marquees] = await Promise.all([
      listProducts(),
      listInformations(),
      listTestimonials(),
      listMarquees(),
    ]);

    return NextResponse.json(
      { products, informations, testimonials, marquees },
      {
        headers: {
          "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=120",
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
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
