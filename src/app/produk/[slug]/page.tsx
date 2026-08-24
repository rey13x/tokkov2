"use client";

import { useParams } from "next/navigation";
import { useStoreData } from "@/components/providers/StoreDataProvider";
import ProductDetailClient from "./ProductDetailClient";

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: storeData } = useStoreData();
  const product = storeData.products.find((item) => item.slug.toLowerCase() === slug.toLowerCase()) ?? null;

  if (!product) {
    return <p style={{ padding: "40px 20px", textAlign: "center" }}>Produk tidak ditemukan.</p>;
  }

  return <ProductDetailClient product={product} />;
}

