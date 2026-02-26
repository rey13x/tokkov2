import { NextResponse } from "next/server";
import { listInformations, listProducts, listTestimonials } from "@/server/store-data";

export async function GET() {
  const [products, informations, testimonials] = await Promise.all([
    listProducts(),
    listInformations(),
    listTestimonials(),
  ]);

  return NextResponse.json({ products, informations, testimonials });
}
