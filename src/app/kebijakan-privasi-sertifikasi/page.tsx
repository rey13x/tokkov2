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

function sanitizeRichHtml(rawHtml: string) {
  return rawHtml
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

export default async function PrivacyCertificationPage() {
  const privacyPolicy = await getPrivacyPolicyPage();
  const safeHtml = sanitizeRichHtml(privacyPolicy.contentHtml);

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>{privacyPolicy.title}</h1>
        <p className={styles.meta}>{privacyPolicy.updatedLabel}</p>
        <div className={styles.bannerWrap}>
          <Image
            src={privacyPolicy.bannerImageUrl}
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
