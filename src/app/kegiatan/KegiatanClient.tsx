"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiChevronRight } from "react-icons/fi";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import { fetchStoreData } from "@/lib/store-client";
import type { StoreStoryReel } from "@/types/store";
import styles from "./page.module.css";

export default function KegiatanClient() {
  const router = useRouter();
  const [activities, setActivities] = useState<StoreStoryReel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStoreData()
      .then((data) => setActivities(data.storyReels ?? []))
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  }, []);

  const visibleActivities = useMemo(
    () => activities.filter((item) => item.isActive && item.mediaGallery.some((media) => media.url)),
    [activities],
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.backButton} onClick={() => router.back()} aria-label="Kembali">
          <FiArrowLeft />
        </button>
        <h1>Kegiatan Sobat</h1>
        <div className={styles.headerPlaceholder} />
      </header>

      {loading ? <p className={styles.loading}>Tunggu ya Sobat, pastiin internet Sobat ada..</p> : null}
      {!loading && visibleActivities.length === 0 ? <p className={styles.empty}>Belum ada kegiatan yang tersedia.</p> : null}
      <section className={styles.grid}>
        {visibleActivities.map((activity) => {
          const cover = activity.mediaGallery.find((media) => media.url);
          return (
            <article key={activity.id} className={styles.card} onClick={() => router.push(`/kegiatan/${activity.id}`)}>
              <div className={styles.imageWrap}>
                <FlexibleMedia src={cover?.url ?? ""} alt={cover?.alt || activity.title} fill className={styles.image} sizes="(max-width: 760px) 100vw, 50vw" unoptimized />
              </div>
              <div className={styles.cardBody}>
                <h2>{activity.title}</h2>
                <p>{activity.description}</p>
                <span className={styles.arrow}><FiChevronRight /></span>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
