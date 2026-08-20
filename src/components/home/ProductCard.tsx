"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FiChevronRight } from "react-icons/fi";
import type { StoreProduct } from "@/types/store";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import { formatRupiah } from "@/data/products";
import { addToCart } from "@/lib/cart";
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
  const router = useRouter();
  const { status } = useSession();
  const [donationAmount, setDonationAmount] = useState("");
  const [donationError, setDonationError] = useState("");

  const onDonate = () => {
    const amount = Number(donationAmount.replace(/\D/g, ""));
    if (!amount || amount < 1) {
      setDonationError("Masukkan nominal donasi.");
      return;
    }
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push(`/auth?redirect=${encodeURIComponent(`/produk/${product.slug}`)}`);
      return;
    }
    addToCart(product.slug, 1, amount);
    router.push("/troli");
  };

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
            {product.productType === "donation" ? (
              <span>Terkumpul {formatRupiah(product.donationTotal ?? 0)}</span>
            ) : (
              <span>{formatRupiah(product.price)}</span>
            )}
          </div>
          <i>
            <FiChevronRight />
          </i>
        </div>
      </Link>
      {product.productType === "donation" ? (
          <div className={styles.donationCardControls}>
            <p>Terkumpul {formatRupiah(product.donationTotal ?? 0)}</p>
            <label>
              <span>Mau Donasi berapa?</span>
              <div className={styles.donationCardInput}>
                <span>Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={donationAmount}
                  onChange={(event) => {
                    setDonationError("");
                    const digits = event.target.value.replace(/\D/g, "");
                    setDonationAmount(digits ? Number(digits).toLocaleString("id-ID") : "");
                  }}
                  placeholder="Nominal"
                  aria-label={`Nominal donasi untuk ${product.name}`}
                />
              </div>
            </label>
            {donationError ? <small>{donationError}</small> : null}
            <button type="button" onClick={onDonate}>Donasi Sekarang</button>
          </div>
      ) : null}
    </article>
  );
});

export default ProductCard;
