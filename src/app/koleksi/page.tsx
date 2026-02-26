"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiChevronRight } from "react-icons/fi";
import { formatRupiah } from "@/data/products";
import { fetchStoreData } from "@/lib/store-client";
import type { StoreProduct } from "@/types/store";
import styles from "./page.module.css";

export default function KoleksiPage() {
  const initialCategory =
    typeof window === "undefined"
      ? "Semua"
      : new URLSearchParams(window.location.search).get("category") ?? "Semua";
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [query, setQuery] = useState("");

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

  return (
    <main className={styles.page}>
      <section className={styles.stickyTop}>
        <header className={styles.header}>
          <h1>Our Collections</h1>
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
              placeholder="Cari produk..."
            />
            <div className={styles.gifBox} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif"
                alt=""
              />
            </div>
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
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className={styles.productImage}
                    sizes="(max-width: 760px) 44vw, (max-width: 1140px) 30vw, 20vw"
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
          ))}
        </section>
      ) : (
        <p className={styles.emptyState}>Produk tidak ditemukan untuk filter ini.</p>
      )}
    </main>
  );
}
