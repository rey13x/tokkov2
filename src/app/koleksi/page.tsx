"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FiChevronRight } from "react-icons/fi";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import { formatRupiah } from "@/data/products";
import { addToCart } from "@/lib/cart";
import { reopenMaintenanceNotice, useMaintenanceMode } from "@/lib/maintenance-mode";
import { fetchStoreData } from "@/lib/store-client";
import type { StoreProduct } from "@/types/store";
import styles from "./page.module.css";

export default function KoleksiPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { isMaintenanceEnabled } = useMaintenanceMode();
  const initialCategory =
    typeof window === "undefined"
      ? "Semua"
      : new URLSearchParams(window.location.search).get("category") ?? "Semua";
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [query, setQuery] = useState("");
  const [addingToCartId, setAddingToCartId] = useState<string | null>(null);

  useEffect(() => {
    fetchStoreData()
      .then((data) => setProducts(data.products))
      .catch(() => {});
  }, []);

  const categories = useMemo(() => {
    const set = new Set(products.map((product) => product.category));
    return ["Semua", ...set];
  }, [products]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = products.filter((product) => {
    const byCategory = activeCategory === "Semua" || product.category === activeCategory;
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
      router.push(`/produk/${product.slug}`);
      return;
    }

    if (status === "unauthenticated") {
      router.push(`/auth?redirect=${encodeURIComponent(`/koleksi?category=${activeCategory}`)}`);
      return;
    }

    if (status === "loading") {
      return;
    }

    setAddingToCartId(product.id);
    try {
      addToCart(product.slug, 1);
      // Show brief feedback
      setTimeout(() => {
        setAddingToCartId(null);
      }, 800);
    } catch {
      setAddingToCartId(null);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.stickyTop}>
        <header className={styles.header}>
          <h1>Layanan</h1>
          <Link href="/" className={styles.backLink}>
            Kembali
          </Link>
        </header>

        <div className={styles.searchWrap}>
          <div className={styles.searchRow}>
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
                  src={session.user.image || "/assets/logo.png"}
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
                <img
                  src="https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif"
                  alt=""
                />
              </div>
            )}
          </div>
        </div>

        <div className={styles.categoryRow}>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`${styles.categoryChip} ${
                activeCategory === category ? styles.categoryChipActive : ""
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {filtered.length > 0 ? (
        <section className={styles.productGrid}>
          {filtered.map((product) => (
            <article key={product.id} className={styles.productShell}>
              <Link href={`/produk/${product.slug}`} className={styles.productCard}>
                <div className={styles.productImageWrap}>
                  <FlexibleMedia
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className={styles.productImage}
                    sizes="(max-width: 760px) 44vw, (max-width: 1140px) 30vw, 20vw"
                    unoptimized
                  />
                  {product.productType === "jual_beli" && (
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
                    <span>{formatRupiah(product.price)}</span>
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
