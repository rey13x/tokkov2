"use client";

import { useEffect } from "react";
import Link from "next/link";
import styles from "./page.module.css";

export default function PrivacyPolicyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Privacy policy page error:", error);
  }, [error]);

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>Kebijakan Privasi & Sertifikasi Layanan</h1>
        <p className={styles.meta}>Halaman sedang mengalami gangguan sementara.</p>
        <p>Silakan muat ulang halaman atau kembali ke beranda.</p>
        <p style={{ marginTop: 12, display: "flex", gap: 12 }}>
          <button
            type="button"
            onClick={reset}
            style={{
              border: "none",
              borderRadius: 999,
              height: 38,
              padding: "0 14px",
              background: "#1b1d44",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Coba Lagi
          </button>
          <Link href="/">Kembali ke Beranda</Link>
        </p>
      </section>
    </main>
  );
}
