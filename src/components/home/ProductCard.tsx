import { memo } from "react";
import Link from "next/link";
import { FiChevronRight } from "react-icons/fi";
import type { StoreProduct } from "@/types/store";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import { formatRupiah } from "@/data/products";
import styles from "./HomeClient.module.css";

interface ProductCardProps {
  product: StoreProduct;
  index: number;
  onboardingStage?: string;
  onClick?: () => void;
}

const ProductCard = memo(function ProductCard({
  product,
  index,
  onboardingStage,
  onClick,
}: ProductCardProps) {
  return (
    <article key={product.id} className={styles.productShell} data-card="product">
      <Link
        href={`/produk/${product.slug}`}
        className={styles.productCard}
        data-onboarding={onboardingStage}
        onClick={onClick}
      >
        <div className={styles.productImageWrap}>
          <FlexibleMedia
            src={product.imageUrl}
            alt={product.name}
            fill
            className={styles.productImage}
            sizes="(max-width: 760px) 44vw, (max-width: 1140px) 30vw, 20vw"
            priority={index < 3}
            unoptimized
          />
        </div>
        <div className={styles.floatingMeta}>
          <div>
            <p>{product.name}</p>
            <span>{formatRupiah(product.price)}</span>
          </div>
          <i>
            <FiChevronRight />
          </i>
        </div>
      </Link>
    </article>
  );
});

export default ProductCard;
