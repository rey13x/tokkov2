"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiArrowRight, FiArrowLeft } from "react-icons/fi";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import { fetchStoreData } from "@/lib/store-client";
import type { StoreInformation } from "@/types/store";
import styles from "./InformasiClient.module.css";

export default function InformasiClient() {
  const router = useRouter();
  const [informations, setInformations] = useState<StoreInformation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchStoreData();
        setInformations(data.informations ?? []);
      } catch (error) {
        console.error("Failed to fetch informations:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.loadingContainer}>
          <p>Tunggu sebentar yaa..</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => router.back()}
          aria-label="Kembali"
        >
          <FiArrowLeft />
        </button>
        <h1>Informasi</h1>
        <div className={styles.headerPlaceholder} />
      </header>

      <section className={styles.informationList}>
        {informations.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Tidak ada informasi tersedia</p>
          </div>
        ) : (
          informations.map((item) => (
            <article
              key={item.id}
              className={styles.informationItem}
              onClick={() => router.push(`/informasi/${item.id}`)}
            >
              <div className={styles.itemImageWrap}>
                <FlexibleMedia
                  src={item.imageUrl}
                  alt={item.title}
                  fill
                  className={styles.itemImage}
                  sizes="(max-width: 600px) 100vw, 600px"
                  unoptimized
                />
              </div>
              <div className={styles.itemContent}>
                <div className={styles.itemText}>
                  <h2 className={styles.itemTitle}>{item.title}</h2>
                  <p className={styles.itemBody}>{item.body}</p>
                </div>
                <div className={styles.itemArrow}>
                  <FiArrowRight />
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
