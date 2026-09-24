"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import { fetchStoreData } from "@/lib/store-client";
import type { StoreStoryReel } from "@/types/store";
import styles from "./page.module.css";

export default function KegiatanDetailClient() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [activity, setActivity] = useState<StoreStoryReel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStoreData()
      .then((data) => setActivity((data.storyReels ?? []).find((item) => item.id === params.id) ?? null))
      .catch(() => setActivity(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return <main className={styles.page}><p className={styles.loading}>Tunggu ya Sobat, pastiin internet Sobat ada..</p></main>;
  }

  if (!activity || !activity.isActive) {
    return (
      <main className={styles.page}>
        <button type="button" className={styles.backButton} onClick={() => router.back()}><FiArrowLeft /> Kembali</button>
        <p className={styles.empty}>Kegiatan tidak ditemukan, Sobat.</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <button type="button" className={styles.backButton} onClick={() => router.back()}><FiArrowLeft /> Kembali</button>
      <article className={styles.article}>
        <h1>{activity.title}</h1>
        {activity.mediaGallery.filter((media) => media.url).map((media, index) => (
          <div key={`${media.url}-${index}`} className={styles.mediaWrap}>
            <FlexibleMedia src={media.url} alt={media.alt || activity.title} fill className={styles.media} sizes="(max-width: 900px) 100vw, 900px" unoptimized />
          </div>
        ))}
        <div className={styles.content}>
          {activity.description.split(/\n{2,}/).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
      </article>
    </main>
  );
}
