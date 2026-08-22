"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import styles from "./page.module.css";

const FullscreenMarketingMap = dynamic(() => import("@/components/PetaPemasaran"), {
  ssr: false,
  loading: () => <p className={styles.loading}>Menyiapkan peta...</p>,
});

export default function MarketingMapPage() {
  return (
    <main className={styles.page}>
      <FullscreenMarketingMap fullScreen />
      <Link href="/#tim-marketing" className={styles.brandLink}>
        Tokko Marketplace
      </Link>
    </main>
  );
}
