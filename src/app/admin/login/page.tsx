"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirebaseClientAuth } from "@/lib/firebase-client";
import styles from "./page.module.css";

type LoginMode = "local" | "firebase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("local");
  const [identifier, setIdentifier] = useState("");
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

  const onLocalLogin = async () => {
    const result = await signIn("credentials", {
      identifier: identifier.trim(),
      password,
      redirect: false,
      callbackUrl: "/admin",
    });

    if (result?.error) {
      setError("Username/email atau password admin salah.");
      return;
    }

    const sessionResponse = await fetch("/api/admin/session", { cache: "no-store" });
    if (!sessionResponse.ok) {
      setError("Akun ini tidak memiliki akses admin.");
      return;
    }

    router.replace("/admin");
  };

  const onFirebaseLogin = async () => {
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
      setError(payload.message ?? "Login Firebase admin gagal.");
      return;
    }

    router.replace("/admin");
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (mode === "local") {
        await onLocalLogin();
      } else {
        await onFirebaseLogin();
      }
    } catch {
      setError("Login admin gagal.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.logoStrip}>
          {Array.from({ length: 9 }).map((_, index) => (
            <Link key={`logo-${index}`} href="/" aria-label="Beranda">
              <span>
                <Image src="/assets/logo.png" alt="" width={24} height={24} unoptimized />
              </span>
            </Link>
          ))}
        </div>

        <header className={styles.header}>
          <h1>Login Admin</h1>
          <p>Akses dashboard kelola produk, informasi, dan order.</p>
        </header>

        <div className={styles.modeSwitch}>
          <button
            type="button"
            onClick={() => setMode("local")}
            className={mode === "local" ? styles.modeActive : ""}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("firebase")}
            className={mode === "firebase" ? styles.modeActive : ""}
          >
            Firebase
          </button>
        </div>

        <form className={styles.form} onSubmit={onSubmit}>
          {mode === "local" ? (
            <label>
              Username / Gmail
              <input
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Admin123x atau email admin"
                required
              />
            </label>
          ) : (
            <label>
              Email Admin Firebase
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@email.com"
                required
              />
            </label>
          )}

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
            {isLoading ? "Memproses..." : "Login Admin"}
          </button>
        </form>
        <Link href="/" className={styles.backLink}>
          Kembali ke Beranda
        </Link>
      </section>
    </main>
  );
}
