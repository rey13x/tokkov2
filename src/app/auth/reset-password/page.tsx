"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./reset-password.module.css";

type ResetStep = "verify" | "reset" | "success" | "error";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [step, setStep] = useState<ResetStep>("verify");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setStep("error");
      setMessage("Token tidak ditemukan");
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await fetch(
          `/api/auth/reset-password/verify?token=${token}`
        );
        const data = (await response.json()) as { valid: boolean; email?: string; message?: string };

        if (!data.valid) {
          setStep("error");
          setMessage(data.message || "Token tidak valid atau sudah kadaluarsa");
          return;
        }

        setEmail(data.email || "");
        setStep("reset");
      } catch {
        setStep("error");
        setMessage("Gagal verifikasi token");
      }
    };

    verifyToken();
  }, [token]);

  const onSubmitReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      if (!newPassword || !confirmPassword) {
        setMessage("Kedua password harus diisi");
        return;
      }

      if (newPassword !== confirmPassword) {
        setMessage("Password tidak cocok");
        return;
      }

      if (newPassword.length < 8) {
        setMessage("Password minimal 8 karakter");
        return;
      }

      const response = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword,
          confirmPassword,
        }),
      });

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        setMessage(result.message || "Gagal mereset password");
        return;
      }

      setStep("success");
      setMessage(result.message || "Password berhasil direset");
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.replace("/auth");
      }, 2000);
    } catch {
      setMessage("Gagal mereset password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {step === "error" && (
          <div className={styles.content}>
            <h1 className={styles.title}>Reset Password Gagal</h1>
            <p className={styles.message}>{message}</p>
            <button
              onClick={() => router.replace("/auth")}
              className={styles.button}
            >
              Kembali ke Login
            </button>
          </div>
        )}

        {step === "reset" && (
          <div className={styles.content}>
            <h1 className={styles.title}>Reset Password</h1>
            <p className={styles.subtitle}>Masukkan password baru untuk akun {email}</p>

            <form onSubmit={onSubmitReset} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="newPassword" className={styles.label}>
                  Password Baru
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className={styles.input}
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="confirmPassword" className={styles.label}>
                  Konfirmasi Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang password"
                  className={styles.input}
                  disabled={isSubmitting}
                />
              </div>

              {message && (
                <div className={styles.error}>{message}</div>
              )}

              <button
                type="submit"
                className={styles.button}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sedang diproses..." : "Reset Password"}
              </button>
            </form>

            <p className={styles.help}>
              <a href="/auth">Kembali ke Login</a>
            </p>
          </div>
        )}

        {step === "success" && (
          <div className={styles.content}>
            <h1 className={styles.title}>Password Berhasil Direset</h1>
            <p className={styles.message}>{message}</p>
            <p className={styles.subtitle}>
              Tunggu beberapa detik untuk diarahkan ke halaman login...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
