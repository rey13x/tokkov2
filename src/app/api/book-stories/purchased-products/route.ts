import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { listProducts, listTestimonialPurchasedProducts } from "@/server/store-data";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.email) {
    return NextResponse.json(
      { message: "Kamu harus login untuk mengisi testimoni." },
      { status: 401 },
    );
  }

  if (session.user.role === "admin") {
    const products = (await listProducts())
      .filter((product) => product.isActive && product.productType !== "donation")
      .map((product) => ({ id: product.id, name: product.name }));
    return NextResponse.json({ products });
  }

  const products = await listTestimonialPurchasedProducts(session.user.email);
  return NextResponse.json({ products });
}