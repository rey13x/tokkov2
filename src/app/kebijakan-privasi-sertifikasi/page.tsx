import Image from "next/image";
import type { Metadata } from "next";
import { getPrivacyPolicyPage } from "@/server/store-data";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Kebijakan Privasi & Sertifikasi Layanan | Tokko",
  description:
    "Informasi kebijakan privasi, keamanan data, serta sertifikasi dan standar layanan Tokko.",
};

export const dynamic = "force-dynamic";

const FALLBACK_POLICY = {
  title: "Kebijakan Privasi & Sertifikasi Layanan",
  updatedLabel: "Terakhir diperbarui: 28 Februari 2026",
  bannerImageUrl: "/assets/ramadhan.jpg",
  contentHtml: `
<h2>Kebijakan Privasi</h2>
<p>Konten sedang dimuat. Jika ini terus terjadi, silakan hubungi admin.</p>
  `.trim(),
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
  if (!value) {
    return FALLBACK_POLICY.bannerImageUrl;
  }
  if (value.startsWith("/")) {
    return value;
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return FALLBACK_POLICY.bannerImageUrl;
}

function toSafeString(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizePolicy(value: unknown) {
  if (!value || typeof value !== "object") {
    return FALLBACK_POLICY;
  }

  const row = value as Record<string, unknown>;
  return {
    title: toSafeString(row.title, FALLBACK_POLICY.title),
    updatedLabel: toSafeString(row.updatedLabel, FALLBACK_POLICY.updatedLabel),
    bannerImageUrl: toSafeString(row.bannerImageUrl, FALLBACK_POLICY.bannerImageUrl),
    contentHtml: toSafeString(row.contentHtml, FALLBACK_POLICY.contentHtml),
  };
}

export default async function PrivacyCertificationPage() {
  const privacyPolicy = normalizePolicy(
    await getPrivacyPolicyPage().catch(() => FALLBACK_POLICY),
  );
  const safeHtml = sanitizeRichHtml(privacyPolicy.contentHtml);
  const safeBannerSrc = sanitizeBannerSrc(privacyPolicy.bannerImageUrl);

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>{privacyPolicy.title}</h1>
        <p className={styles.meta}>{privacyPolicy.updatedLabel}</p>
        <div className={styles.bannerWrap}>
          <Image
            src={safeBannerSrc}
            alt={privacyPolicy.title}
            width={320}
            height={46}
            className={styles.bannerImage}
            unoptimized
          />
        </div>

        <section
          className={styles.contentHtml}
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </section>
    </main>
  );
}
