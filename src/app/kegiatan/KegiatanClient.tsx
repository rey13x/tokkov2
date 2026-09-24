"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiChevronRight } from "react-icons/fi";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import WaitLoading from "@/components/ui/WaitLoading";
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

  const openDestination = (target: string | undefined) => {
    const destination = target?.trim();
    if (!destination) {
      return;
    }

    if (/^https?:\/\//i.test(destination) || destination.startsWith("//")) {
      window.open(destination, "_blank", "noopener,noreferrer");
      return;
    }

    if (destination.startsWith("/")) {
      router.push(destination);
      return;
    }

    window.location.assign(destination);
  };

  const visibleActivities = useMemo(
    () => activities.filter((item) => item.isActive && item.mediaGallery.some((media) => (media.url || media.linkUrl)?.trim())),
    [activities],
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.backButton} onClick={() => router.back()} aria-label="Kembali">
          <FiArrowLeft />
          <span>Kembali</span>
        </button>
        <h1>Sobat News</h1>
        <div className={styles.headerPlaceholder} />
      </header>

      {loading ? <WaitLoading centered text="Tunggu ya Sobat, pastiin internet Sobat ada.." /> : null}
      {!loading && visibleActivities.length === 0 ? <p className={styles.empty}>Belum ada kegiatan yang tersedia.</p> : null}
      <section className={styles.grid}>
        {visibleActivities.map((activity) => {
          const cover = activity.mediaGallery.find((media) => (media.url || media.linkUrl)?.trim()) ?? activity.mediaGallery[0];
          const imageSrc = cover?.url?.trim() || cover?.linkUrl?.trim() || "";
          const destination = activity.linkUrl?.trim() || cover?.linkUrl?.trim();

          return (
            <article
              key={activity.id}
              className={styles.card}
              onClick={() => {
                if (destination) {
                  openDestination(destination);
                  return;
                }
                router.push(`/kegiatan/${activity.id}`);
              }}
            >
              <div className={styles.imageWrap}>
                <FlexibleMedia src={imageSrc} alt={cover?.alt || activity.title} fill className={styles.image} sizes="(max-width: 760px) 100vw, 50vw" unoptimized />
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
