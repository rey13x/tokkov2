"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { fetchStoreData } from "@/lib/store-client";
import type { StoreTestimonial } from "@/types/store";
import TestimoniClient from "./TestimoniClient";
import styles from "./page.module.css";

export default function TestimoniPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [testimonials, setTestimonials] = useState<StoreTestimonial[]>([]);
  const [activeRating, setActiveRating] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchStoreData()
      .then((data) => setTestimonials(data.testimonials))
      .catch(() => {});
  }, []);

  const ratings = useMemo(() => {
    const set = new Set(testimonials.map((t) => t.rating));
    return Array.from(set).sort((a, b) => b - a);
  }, [testimonials]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = testimonials.filter((testimonial) => {
    const byRating = activeRating === null || testimonial.rating === activeRating;
    // Search by first letter if single character, otherwise full text search
    let byQuery: boolean;
    if (normalizedQuery.length === 0) {
      byQuery = true;
    } else if (normalizedQuery.length === 1) {
      // Filter by first letter
      const text = `${testimonial.name} ${testimonial.roleLabel} ${testimonial.message}`.toLowerCase();
      byQuery = text.split(' ').some(word => word.startsWith(normalizedQuery));
    } else {
      // Full text search
      const text = `${testimonial.name} ${testimonial.roleLabel} ${testimonial.message}`.toLowerCase();
      byQuery = text.includes(normalizedQuery);
    }
    return byRating && byQuery;
  });

  return (
    <main className={styles.page}>
      <section className={styles.stickyTop}>
        <header className={styles.header}>
          <h1>Testimoni</h1>
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
              placeholder="Cari Testimoni..."
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
          <button
            type="button"
            onClick={() => setActiveRating(null)}
            className={`${styles.categoryChip} ${activeRating === null ? styles.categoryChipActive : ""}`}
          >
            Semua
          </button>
          {ratings.map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => setActiveRating(rating)}
              className={`${styles.categoryChip} ${
                activeRating === rating ? styles.categoryChipActive : ""
              }`}
            >
              {rating > 0 ? "⭐".repeat(rating) : "No Rating"}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.content}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#999" }}>
            <p>Tidak ada testimoni yang sesuai dengan filter.</p>
          </div>
        ) : (
          <TestimoniClient testimonials={filtered} activeRating={activeRating} />
        )}
      </section>

    </main>
  );
}
