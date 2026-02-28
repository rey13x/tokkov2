"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { FcGoogle } from "react-icons/fc";
import styles from "./page.module.css";

type AuthMode = "signin" | "signup";

function getSafeRedirect(pathname: string | null) {
  if (!pathname || !pathname.startsWith("/") || pathname.startsWith("//")) {
    return "/";
  }
  if (pathname.startsWith("/auth")) {
    return "/";
  }
  return pathname;
}

export default function AuthPage() {
  const router = useRouter();
  const { status } = useSession();
  const canUseGoogleSignIn = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
  const canUseEmailOtp = process.env.NEXT_PUBLIC_EMAIL_OTP_ENABLED === "true";

  const [mode, setMode] = useState<AuthMode>("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState("/");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    setRedirectTarget(getSafeRedirect(params.get("redirect")));
  }, []);

  const resolveRedirectAfterAuth = useCallback(async () => {
    const response = await fetch("/api/me", { cache: "no-store" });
    if (!response.ok) {
      return redirectTarget;
    }
    const me = (await response.json()) as { role?: "user" | "admin" };
    if (me.role === "admin") {
      return "/admin";
    }
    return redirectTarget;
  }, [redirectTarget]);

  useEffect(() => {
    if (!canUseEmailOtp && mode === "signup") {
      setMode("signin");
    }
  }, [canUseEmailOtp, mode]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    resolveRedirectAfterAuth()
      .then((target) => router.replace(target))
      .catch(() => router.replace(redirectTarget));
  }, [status, router, redirectTarget, resolveRedirectAfterAuth]);

  const onSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        identifier: identifier.trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Username/Gmail atau password tidak sesuai.");
        return;
      }

      const target = await resolveRedirectAfterAuth();
      router.replace(target);
    } catch {
      setError("Gagal masuk. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onRequestCode = async () => {
    setError("");
    setSuccess("");
    setIsRequestingCode(true);

    try {
      const response = await fetch("/api/auth/signup/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: signupUsername,
          email: signupEmail,
          phone: signupPhone,
          password: signupPassword,
          confirmPassword: signupConfirmPassword,
        }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Gagal kirim kode verifikasi.");
        return;
      }

      setIsCodeSent(true);
      setSuccess(result.message ?? "Kode verifikasi sudah dikirim.");
    } catch {
      setError("Gagal kirim kode verifikasi.");
    } finally {
      setIsRequestingCode(false);
    }
  };

  const onSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const verifyResponse = await fetch("/api/auth/signup/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signupEmail,
          code: signupCode,
        }),
      });
      const verifyResult = (await verifyResponse.json()) as { message?: string };
      if (!verifyResponse.ok) {
        setError(verifyResult.message ?? "Verifikasi kode gagal.");
        return;
      }

      const loginResult = await signIn("credentials", {
        identifier: signupEmail.trim(),
        password: signupPassword,
        redirect: false,
      });

      if (loginResult?.error) {
        setSuccess("Akun berhasil dibuat. Silakan masuk.");
        setMode("signin");
        setIdentifier(signupEmail.trim());
        return;
      }

      const target = await resolveRedirectAfterAuth();
      router.replace(target);
    } catch {
      setError("Gagal menyelesaikan pendaftaran.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSignInWithGoogle = async () => {
    setError("");
    setSuccess("");
    setIsGoogleSubmitting(true);

    try {
      await signIn("google", { callbackUrl: redirectTarget });
    } catch {
      setError("Login Google gagal. Coba lagi.");
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.authCard}>
        <div className={styles.banner}>
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={`logo-${index}`} className={styles.bannerLogoWrap}>
              <Image src="/assets/logo.png" alt="" width={22} height={22} className={styles.bannerLogo} />
            </div>
          ))}
        </div>

        <header className={styles.headerBlock}>
          <h1>Login</h1>
          <p className={styles.description}>
            {canUseEmailOtp
              ? "Masuk atau daftar akun untuk lanjut belanja."
              : "Masuk akun untuk lanjut belanja."}
          </p>
        </header>

        <div className={`${styles.modeSwitch} ${!canUseEmailOtp ? styles.modeSwitchSingle : ""}`}>
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError("");
              setSuccess("");
            }}
            className={mode === "signin" ? styles.modeActive : ""}
          >
            Sign In
          </button>
          {canUseEmailOtp ? (
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError("");
                setSuccess("");
              }}
              className={mode === "signup" ? styles.modeActive : ""}
            >
              Sign Up
            </button>
          ) : null}
        </div>
        {!canUseEmailOtp ? (
          <p className={styles.disabledInfo}>Pendaftaran akun via email OTP sedang dimatikan.</p>
        ) : null}

        {mode === "signin" && canUseGoogleSignIn ? (
          <button
            type="button"
            className={styles.googleSignInButton}
            onClick={onSignInWithGoogle}
            disabled={isGoogleSubmitting || isSubmitting}
          >
            <FcGoogle className={styles.googleIcon} />
            <span>{isGoogleSubmitting ? "Memproses..." : "Sign in with Google"}</span>
          </button>
        ) : null}

        {mode === "signin" ? (
          <form className={styles.form} onSubmit={onSignIn}>
            <label className={styles.field}>
              Username / Gmail
              <input
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Username / Gmail kamu"
                required
              />
            </label>
            <label className={styles.field}>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password kamu"
                required
              />
            </label>
            {error ? <p className={styles.errorText}>{error}</p> : null}
            {success ? <p className={styles.successText}>{success}</p> : null}
            <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? "Memproses..." : "Masuk"}
            </button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={onSignUp}>
            <label className={styles.field}>
              Username
              <input
                type="text"
                value={signupUsername}
                onChange={(event) => setSignupUsername(event.target.value)}
                placeholder="Username kamu"
                required
              />
            </label>
            <label className={styles.field}>
              Gmail
              <input
                type="email"
                value={signupEmail}
                onChange={(event) => setSignupEmail(event.target.value)}
                placeholder="Gmail kamu"
                required
              />
            </label>
            <label className={styles.field}>
              No Telepon
              <input
                type="tel"
                value={signupPhone}
                onChange={(event) => setSignupPhone(event.target.value)}
                placeholder="Nomor telepon kamu"
                required
              />
            </label>
            <label className={styles.field}>
              Password
              <input
                type="password"
                value={signupPassword}
                onChange={(event) => setSignupPassword(event.target.value)}
                placeholder="Password kamu"
                required
              />
            </label>
            <label className={styles.field}>
              Konfirmasi Password
              <input
                type="password"
                value={signupConfirmPassword}
                onChange={(event) => setSignupConfirmPassword(event.target.value)}
                placeholder="Ulangi password kamu"
                required
              />
            </label>
            <button
              type="button"
              className={styles.returnButton}
              onClick={onRequestCode}
              disabled={isRequestingCode}
            >
              {isRequestingCode ? "Mengirim kode..." : isCodeSent ? "Kirim Ulang Kode" : "Kirim Kode Verifikasi"}
            </button>
            <label className={styles.field}>
              Kode Verifikasi
              <input
                type="text"
                value={signupCode}
                onChange={(event) => setSignupCode(event.target.value)}
                placeholder="Masukkan 6 digit kode"
                inputMode="numeric"
                maxLength={6}
                required
              />
            </label>
            {error ? <p className={styles.errorText}>{error}</p> : null}
            {success ? <p className={styles.successText}>{success}</p> : null}
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting || !isCodeSent}
            >
              {isSubmitting ? "Memproses..." : "Daftar dan Masuk"}
            </button>
          </form>
        )}

        <div className={styles.extraAction}>
          <Link href="/" className={styles.backLink}>
            Kembali ke Beranda
          </Link>
        </div>
      </section>
    </main>
  );
}
