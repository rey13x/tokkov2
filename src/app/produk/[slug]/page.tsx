"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import WaitLoading from "@/components/ui/WaitLoading";
import { clearStoreDataCache, fetchStoreData } from "@/lib/store-client";
import type { StoreProduct } from "@/types/store";
import ProductDetailClient from "./ProductDetailClient";

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadProduct = () => {
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
    };

    const handleStoreRefresh = () => {
      clearStoreDataCache();
      loadProduct();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "tokko:store-data-invalidated") handleStoreRefresh();
    };

    loadProduct();
    window.addEventListener("tokko:store-data-updated", handleStoreRefresh);
    window.addEventListener("storage", handleStorage);

    return () => {
      mounted = false;
      window.removeEventListener("tokko:store-data-updated", handleStoreRefresh);
      window.removeEventListener("storage", handleStorage);
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

