"use client";

import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FiChevronRight, FiShoppingCart, FiAward } from "react-icons/fi";
import type { StoreProduct } from "@/types/store";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import DonationTotalTicker from "@/components/product/DonationTotalTicker";
import { formatRupiah } from "@/data/products";
import { addToCart } from "@/lib/cart";
import { getProductPath } from "@/lib/product-routing";
import styles from "./HomeClient.module.css";

interface ProductCardProps {
  product: StoreProduct;
  index: number;
  onboardingStage?: string;
  onClick?: () => void;
  showCartIcon?: boolean; // when false, hide the cart/donation icon (used on homepage)
}

const ProductCard = memo(function ProductCard({
  product,
  index,
  onboardingStage,
  onClick,
  showCartIcon = true,
}: ProductCardProps) {
  const [tapCount, setTapCount] = useState(0);
  const [isBouncing, setIsBouncing] = useState(false);
  const [isBadgeExiting, setIsBadgeExiting] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
  }, []);

  const onAddToCart = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    addToCart(product.slug, 1, undefined, undefined, undefined, { silent: true });
    setTapCount((current) => current + 1);
    setIsBadgeExiting(false);
    setIsBouncing(false);
    window.requestAnimationFrame(() => setIsBouncing(true));
    window.setTimeout(() => setIsBouncing(false), 560);
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setIsBadgeExiting(true);
      resetTimerRef.current = window.setTimeout(() => {
        setTapCount(0);
        setIsBadgeExiting(false);
      }, 420);
    }, 3000);
  };

  return (
    <article key={product.id} className={styles.productShell} data-card="product">
      <Link
        href={getProductPath(product)}
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
            {product.productType === "donation" ? (
              <DonationTotalTicker amount={product.donationTotal ?? 0} />
            ) : (
              <span>{formatRupiah(product.price)}</span>
            )}
          </div>
          <i>
            <FiChevronRight />
          </i>
        </div>
      </Link>
      {showCartIcon ? (
        <button
          type="button"
          className={`${styles.productCartButton} ${isBouncing ? styles.productCartButtonBouncing : ""}`}
          onClick={onAddToCart}
          aria-label={`Tambah ${product.name} ke troli`}
        >
          {product.productType === "donation" ? <FiAward /> : <FiShoppingCart /> }
          {tapCount > 0 ? (
            <b key={tapCount} className={isBadgeExiting ? styles.productCartBadgeExiting : ""}>
              {tapCount}+
            </b>
          ) : null}
        </button>
      ) : null}
    </article>
  );
});

export default ProductCard;
