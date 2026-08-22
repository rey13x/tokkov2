"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import DonationTotalTicker from "@/components/product/DonationTotalTicker";
import { fetchStoreData } from "@/lib/store-client";
import type { DonationActivity } from "@/types/store";
import styles from "./page.module.css";

const labels = { income: "Pemasukan", expense: "Pengeluaran", refund: "Pengembalian" } as const;
const signs = { income: "+", expense: "-", refund: "-" } as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export default function DonationActivityClient() {
  const [activities, setActivities] = useState<DonationActivity[]>([]);
  const [productsTotal, setProductsTotal] = useState(0);
  const [filter, setFilter] = useState<"all" | DonationActivity["type"]>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = () => fetchStoreData()
      .then((data) => {
        setActivities(data.donationActivities ?? []);
        setProductsTotal(
          data.products
            .filter((product) => product.productType === "donation")
            .reduce((total, product) => total + Math.max(0, product.donationTotal ?? 0), 0),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
      void loadData();
      const refreshTimer = window.setInterval(loadData, 30_000);
      return () => window.clearInterval(refreshTimer);
      }, []);

  const total = useMemo(() => productsTotal, [productsTotal]);
  const filteredActivities = filter === "all" ? activities : activities.filter((activity) => activity.type === filter);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerIdentity}>
          <Link href="/profil" className={styles.logoLink} aria-label="Buka profil">
            <Image src="/assets/maintenancelogo.jpg" alt="Tokko Marketplace" width={72} height={72} className={styles.logo} priority />
          </Link>
          <div className={styles.headerCopy}>
            <p className={styles.eyebrow}>TOKKO MARKETPLACE</p>
            <h1>Aktivitas Donasi</h1>
          </div>
        </div>
        <Link href="/" className={styles.backLink}>Kembali</Link>
      </header>

      <section className={styles.totalPanel}>
        <span>Total Terkumpul</span>
        <strong><DonationTotalTicker amount={Math.max(0, total)} slow showCelebration prefix="Rp" /></strong>
      </section>

      <section className={styles.activitySection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>LAPORAN TERBARU</p>
            <h2>Riwayat Aktivitas</h2>
          </div>
          <span>{activities.length} aktivitas</span>
        </div>
        <div className={styles.filters} role="group" aria-label="Filter aktivitas donasi">
          {(["all", "income", "expense", "refund"] as const).map((value) => (
            <button key={value} type="button" className={filter === value ? styles.filterActive : styles.filterButton} onClick={() => setFilter(value)}>
              {value === "all" ? "Semua" : labels[value]}
            </button>
          ))}
        </div>
        {loading ? <p className={styles.empty}>Memuat aktivitas...</p> : null}
        {!loading && activities.length === 0 ? <p className={styles.empty}>Belum ada aktivitas donasi.</p> : null}
        <div className={styles.list}>
          {filteredActivities.map((activity) => (
            <article key={activity.id} className={styles.activityCard}>
              <div className={styles.activityBody}>
                {activity.imageUrl ? <img src={activity.imageUrl} alt="Lampiran aktivitas donasi" className={styles.activityImage} /> : null}
                <div className={styles.activityTop}>
                  <div>
                    <h3>{labels[activity.type]}</h3>
                    <time>{formatDate(activity.occurredAt)}</time>
                  </div>
                  <strong className={styles[`${activity.type}Amount`]}>{signs[activity.type]}Rp {activity.amount.toLocaleString("id-ID")}</strong>
                </div>
                <p>{activity.type === "income" ? `Menerima Donasi dari card donasi sebesar Rp ${activity.amount.toLocaleString("id-ID")}` : `Melakukan ${activity.type === "expense" ? "Pengeluaran Dana" : "Pengembalian Dana"} dari card donasi sebesar Rp ${activity.amount.toLocaleString("id-ID")}`}</p>
                <p className={styles.reason}><strong>Untuk Kebutuhan :</strong> {activity.note}</p>
                <div className={styles.meta}>Atas nama {activity.actorName} · {activity.actorPhone}</div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
