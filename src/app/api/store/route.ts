import { NextResponse } from "next/server";
import {
  listInformations,
  listMarquees,
  listProducts,
  listTestimonials,
} from "@/server/store-data";

export async function GET() {
  const [products, informations, testimonials, marquees] = await Promise.all([
    listProducts(),
    listInformations(),
    listTestimonials(),
    listMarquees(),
  ]);

  return NextResponse.json({ products, informations, testimonials, marquees });
}
