"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FiChevronRight } from "react-icons/fi";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import DonationTotalTicker from "@/components/product/DonationTotalTicker";
import { formatRupiah } from "@/data/products";
import { addToCart } from "@/lib/cart";
import { categoryToSlug } from "@/lib/category";
import { reopenMaintenanceNotice, useMaintenanceMode } from "@/lib/maintenance-mode";
import { getProductPath } from "@/lib/product-routing";
import { useStoreData } from "@/components/providers/StoreDataProvider";
import type { StoreProduct } from "@/types/store";
import styles from "./page.module.css";

type KoleksiPageProps = {
  category?: string;
};

export default function KoleksiPage({ category }: KoleksiPageProps = {}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { isMaintenanceEnabled } = useMaintenanceMode();
  const { data: storeData } = useStoreData();
  const stickyRef = useRef<HTMLElement | null>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const initialCategory = category ?? "Semua";
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const products = storeData.products;
  const [query, setQuery] = useState("");
  const [addingToCartId, setAddingToCartId] = useState<string | null>(null);
  const [cartNotice, setCartNotice] = useState("");

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setHasScrolled(scrollTop > 10);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const categories = useMemo(() => {
    const set = new Set(products.map((product) => product.category));
    return ["Semua", ...set];
  }, [products]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = products.filter((product) => {
    const byCategory = activeCategory === "Semua" || categoryToSlug(product.category) === activeCategory;
    const text = `${product.name} ${product.shortDescription} ${product.category}`.toLowerCase();
    const byQuery = normalizedQuery.length === 0 || text.includes(normalizedQuery);
    return byCategory && byQuery;
  });

  const onAddToCart = (e: React.MouseEvent, product: StoreProduct) => {
    e.preventDefault();
    e.stopPropagation();

    if (isMaintenanceEnabled) {
      reopenMaintenanceNotice();
      return;
    }

    if (product.productType === "pekerjaan") {
      // For jobs, navigate to product detail page instead
      router.push(getProductPath(product));
      return;
    }

    if (status === "unauthenticated") {
      const categoryPath = activeCategory === "Semua" ? "/koleksi" : `/koleksi/${categoryToSlug(activeCategory)}`;
      router.push(`/auth?redirect=${encodeURIComponent(categoryPath)}`);
      return;
    }

    if (status === "loading") {
      return;
    }

    setAddingToCartId(product.id);
    try {
      addToCart(product.slug, 1);
      setCartNotice(`Produk ${product.name} sudah masuk Troli ya!`);
      setTimeout(() => {
        setAddingToCartId(null);
      }, 800);
      setTimeout(() => {
        setCartNotice("");
      }, 2600);
    } catch {
      setAddingToCartId(null);
    }
  };

  return (
    <main className={styles.page}>
      <section 
        ref={stickyRef}
        className={`${styles.stickyTop} ${hasScrolled ? styles.stickyTopScrolled : ""}`}
      >
        <header className={styles.header}>
          <h1>Layanan</h1>
          <Link href="/" className={styles.backLink}>
            Kembali
          </Link>
        </header>

        <div className={styles.searchWrap}>
          <div className={styles.searchRow}>
            <div className={styles.searchInputWrapper}>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari Layanan..."
              />
              {session?.user ? (
                <button
                  type="button"
                  onClick={() => router.push("/profil")}
                  className={styles.gifBox}
                  style={{ cursor: "pointer", border: "none", background: "none", padding: 0 }}
                  title="Lihat profil"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={session.user.image || "/assets/maintenancelogo.jpg"}
                    alt="Profil"
                    style={{
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                </button>
              ) : (
                <div className={styles.gifBox} aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/assets/maintenancelogo.jpg" alt="Tokko" />
                </div>
              )}
            </div>
          </div>
          <div className={styles.categoryRow}>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => {
                  setActiveCategory(category);
                  router.push(category === "Semua" ? "/koleksi" : `/koleksi/${categoryToSlug(category)}`);
                }}
                className={`${styles.categoryChip} ${
                  (activeCategory === category || categoryToSlug(activeCategory) === categoryToSlug(category))
                    ? styles.categoryChipActive
                    : ""
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {cartNotice ? <p className={styles.cartNotice}>{cartNotice}</p> : null}

      {filtered.length > 0 ? (
        <section className={styles.productGrid}>
          {filtered.map((product) => (
            <article key={product.id} className={styles.productShell}>
              <Link href={getProductPath(product)} className={styles.productCard}>
                <div className={styles.productImageWrap}>
                  <FlexibleMedia
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className={styles.productImage}
                    sizes="(max-width: 760px) 44vw, (max-width: 1140px) 30vw, 20vw"
                    unoptimized
                  />
                  {product.productType !== "pekerjaan" && (
                    <button
                      type="button"
                      className={styles.cartIconOverlay}
                      onClick={(e) => onAddToCart(e, product)}
                      disabled={addingToCartId === product.id || status === "loading"}
                      title="Tambahkan ke troli"
                      aria-label={`Tambahkan ${product.name} ke troli`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="21" r="1"></circle>
                        <circle cx="20" cy="21" r="1"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                      </svg>
                    </button>
                  )}
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
            </article>
          ))}
        </section>
      ) : (
        <p className={styles.emptyState}>Produk tidak ditemukan untuk filter ini.</p>
      )}
    </main>
  );
}
