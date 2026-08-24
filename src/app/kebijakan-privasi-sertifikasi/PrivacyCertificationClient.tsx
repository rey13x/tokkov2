"use client";

import Image from "next/image";
import { useState } from "react";
import { useStoreData } from "@/components/providers/StoreDataProvider";
import styles from "./page.module.css";

const FALLBACK_POLICY = {
  title: "Kebijakan Privasi & Sertifikasi Layanan",
  updatedLabel: "Terakhir diperbarui: 28 Februari 2026",
  bannerImageUrl: "/assets/backgroundv2.png",
  contentHtml: "<h2>Kebijakan Privasi</h2><p>Konten sedang dimuat.</p>",
};

function sanitizeRichHtml(rawHtml: string) {
  return rawHtml
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

function sanitizeBannerSrc(rawUrl: string) {
  const value = rawUrl.trim();
  if (value.startsWith("/") || /^https?:\/\//i.test(value)) {
    return value;
  }
  return FALLBACK_POLICY.bannerImageUrl;
}

export default function PrivacyCertificationClient() {
  const { data: storeData } = useStoreData();
  const policy = storeData.privacyPolicy ?? FALLBACK_POLICY;

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>{policy.title || FALLBACK_POLICY.title}</h1>
        <p className={styles.meta}>{policy.updatedLabel || FALLBACK_POLICY.updatedLabel}</p>
        <div className={styles.bannerWrap}>
          <Image
            src={sanitizeBannerSrc(policy.bannerImageUrl || "")}
            alt={policy.title || FALLBACK_POLICY.title}
            width={320}
            height={46}
            className={styles.bannerImage}
            unoptimized
          />
        </div>
        <section
          className={styles.contentHtml}
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(policy.contentHtml || FALLBACK_POLICY.contentHtml) }}
        />
      </section>
    </main>
  );
}
