"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import styles from "./page.module.css";

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth?redirect=/profil");
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    const load = async () => {
      const response = await fetch("/api/me", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const result = (await response.json()) as {
        username: string;
        email: string;
        phone: string;
      };

      setName(result.username);
      setEmail(result.email);
      setPhone(result.phone);
    };

    load().catch(() => {});
  }, [status]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: name,
          email,
          phone,
          oldPassword,
          newPassword,
        }),
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Gagal update profil.");
        return;
      }

      setMessage(result.message ?? "Profil berhasil diperbarui.");
      setOldPassword("");
      setNewPassword("");
    } catch {
      setError("Gagal update profil.");
    } finally {
      setIsSaving(false);
    }
  };

  const onLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Profil Akun</h1>
        <Link href="/" className={styles.backLink}>
          Kembali ke beranda
        </Link>
      </header>

      {status === "loading" ? <p className={styles.loading}>Memuat data profil...</p> : null}

      {status === "authenticated" ? (
        <section className={styles.card}>
          <form className={styles.form} onSubmit={onSubmit}>
            <label className={styles.field}>
              Username
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                type="text"
                required
              />
            </label>

            <label className={styles.field}>
              Gmail
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
              />
            </label>

            <label className={styles.field}>
              No Telepon
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                type="tel"
                placeholder="08xxxxxxxxxx"
              />
            </label>

            <label className={styles.field}>
              Password Lama
              <input
                value={oldPassword}
                onChange={(event) => setOldPassword(event.target.value)}
                type="password"
                placeholder="Isi jika ingin ganti password"
              />
            </label>

            <label className={styles.field}>
              Ubah Password Baru
              <input
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                placeholder="Minimal 6 karakter"
              />
            </label>

            {error ? <p className={styles.error}>{error}</p> : null}
            {message ? <p className={styles.success}>{message}</p> : null}

            <button type="submit" className={styles.submitButton} disabled={isSaving}>
              {isSaving ? "Menyimpan..." : "Perbarui"}
            </button>
          </form>

          <div className={styles.accountMeta}>
            <p>Login sebagai: {session?.user?.email ?? "-"}</p>
          </div>

          <button type="button" className={styles.logoutButton} onClick={onLogout}>
            Logout
          </button>
        </section>
      ) : null}
    </main>
  );
}

