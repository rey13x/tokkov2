"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirebaseClientAuth } from "@/lib/firebase-client";
import styles from "./page.module.css";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => {
        if (response.ok) {
          router.replace("/admin");
        }
      })
      .catch(() => {});
  }, [router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const auth = getFirebaseClientAuth();
      if (!auth) {
        setError("Konfigurasi Firebase client belum lengkap.");
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await credential.user.getIdToken(true);

      const sessionResponse = await fetch("/api/admin/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idToken }),
      });

      const payload = (await sessionResponse.json()) as { message?: string };
      if (!sessionResponse.ok) {
        await signOut(auth).catch(() => {});
        setError(payload.message ?? "Login admin gagal.");
        return;
      }

      router.replace("/admin");
    } catch {
      setError("Email/password admin tidak valid.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>Admin Login</h1>
        <p>Masuk dengan akun admin yang sudah terdaftar di Firebase.</p>

        <form className={styles.form} onSubmit={onSubmit}>
          <label>
            Email Admin
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@email.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password admin"
              required
            />
          </label>

          {error ? <p className={styles.errorText}>{error}</p> : null}

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Memproses..." : "Masuk Admin"}
          </button>
        </form>

        <Link href="/" className={styles.backLink}>
          Kembali ke Beranda
        </Link>
        <Link href="/auth?redirect=/admin" className={styles.backLink}>
          Login lokal admin (username/password)
        </Link>
      </section>
    </main>
  );
}
