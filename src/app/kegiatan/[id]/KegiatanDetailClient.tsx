"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import WaitLoading from "@/components/ui/WaitLoading";
import type { StoreStoryReel } from "@/types/store";
import styles from "./page.module.css";

export default function KegiatanDetailClient() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [activity, setActivity] = useState<StoreStoryReel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/store?storyReelId=${encodeURIComponent(params.id)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Gagal memuat kegiatan");
        const data = (await response.json()) as { storyReel?: StoreStoryReel | null };
        setActivity(data.storyReel ?? null);
      })
      .catch(() => setActivity(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return <main className={styles.page}><WaitLoading centered text="Tunggu ya Sobat, pastiin internet Sobat ada.." /></main>;
  }

  if (!activity || !activity.isActive) {
    return (
      <main className={styles.page}>
        <button type="button" className={styles.backButton} onClick={() => router.back()}><FiArrowLeft /> Kembali</button>
        <p className={styles.empty}>Kegiatan tidak ditemukan, Sobat.</p>
      </main>
    );
  }

  const openLink = (target: string | undefined) => {
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

    window.location.href = destination;
  };

  return (
    <main className={styles.page}>
      <button type="button" className={styles.backButton} onClick={() => router.back()}><FiArrowLeft /> Kembali</button>
      <article className={styles.article}>
        <h1>{activity.title}</h1>
        {activity.mediaGallery.filter((media) => (media.url || media.linkUrl)?.trim()).map((media, index) => {
          const mediaSrc = media.url?.trim() || media.linkUrl?.trim() || "";
          const destination = media.linkUrl?.trim() || activity.linkUrl?.trim();

          return (
            <div
              key={`${mediaSrc}-${index}`}
              className={styles.mediaWrap}
              onClick={() => openLink(destination)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openLink(destination);
                }
              }}
              role="button"
              tabIndex={destination ? 0 : -1}
              aria-label={destination ? `Buka tautan kegiatan ${activity.title}` : undefined}
            >
              <FlexibleMedia src={mediaSrc} alt={media.alt || activity.title} fill className={styles.media} sizes="(max-width: 900px) 100vw, 900px" unoptimized />
            </div>
          );
        })}
        {activity.linkUrl.trim() ? (
          <a className={styles.activityLinkButton} href={activity.linkUrl.trim()} target="_blank" rel="noreferrer noopener">
            {activity.mediaGallery.find((media) => (media.url || media.linkUrl)?.trim())?.title?.trim() || "Buka Link"}
          </a>
        ) : null}
        <div className={styles.content}>
          {activity.description.split(/\n{2,}/).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
      </article>
    </main>
  );
}
