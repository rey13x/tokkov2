"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function AuthPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/login");
  }, [router]);

  return (
    <main className={styles.page}>
      <section className={styles.authCard}>
        <h1>Login Dipindahkan</h1>
        <p>Halaman login umum sudah dinonaktifkan. Silakan login dari admin.</p>
      </section>
    </main>
  );
}
