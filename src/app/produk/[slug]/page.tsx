"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import WaitLoading from "@/components/ui/WaitLoading";
import { fetchStoreData } from "@/lib/store-client";
import type { StoreProduct } from "@/types/store";
import ProductDetailClient from "./ProductDetailClient";

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    fetchStoreData()
      .then((data) => {
        if (!mounted) {
          return;
        }
        const foundProduct = data.products.find(
          (item) => item.slug.toLowerCase() === slug.toLowerCase(),
        );
        setProduct(foundProduct ?? null);
      })
      .catch(() => {
        if (mounted) {
          setProduct(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [slug]);

  if (isLoading) {
    return <WaitLoading centered />;
  }

  if (!product) {
    return <p style={{ padding: "40px 20px", textAlign: "center" }}>Produk tidak ditemukan.</p>;
  }

  return <ProductDetailClient product={product} />;
}

