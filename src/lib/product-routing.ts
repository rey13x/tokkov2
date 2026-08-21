import type { StoreProduct } from "@/types/store";

export function getProductPath(product: Pick<StoreProduct, "slug" | "productType">) {
  const prefix = product.productType === "donation" ? "donasi" : "produk";
  return `/${prefix}/${encodeURIComponent(product.slug)}`;
}