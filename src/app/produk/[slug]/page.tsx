import { notFound } from "next/navigation";
import { getProductBySlug } from "@/server/db";
import ProductDetailClient from "./ProductDetailClient";

type ProductDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return <ProductDetailClient product={product} />;
}

