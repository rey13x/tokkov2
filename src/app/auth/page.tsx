"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { gsap } from "gsap";
import styles from "./page.module.css";

type AuthMode = "login" | "register";

export default function AuthPage() {
  const rootRef = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const { status } = useSession();

  const [mode, setMode] = useState<AuthMode>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [suppressAutoRedirect, setSuppressAutoRedirect] = useState(false);

  const redirectTarget =
    typeof window === "undefined"
      ? "/"
      : new URLSearchParams(window.location.search).get("redirect") ?? "/";
  const safeRedirect = redirectTarget.startsWith("/") ? redirectTarget : "/";

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-auth='intro']",
        { y: 26, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.88,
          stagger: 0.1,
          ease: "power3.out",
        },
      );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (status === "authenticated" && !suppressAutoRedirect) {
      router.replace(safeRedirect);
    }
  }, [router, safeRedirect, status, suppressAutoRedirect]);

  useEffect(() => {
    fetch("/api/auth/providers", { cache: "no-store" })
      .then((response) => response.json())
      .then((providers: Record<string, unknown>) => {
        setGoogleAvailable(Boolean(providers.google));
      })
      .catch(() => {
        setGoogleAvailable(false);
      });
  }, []);

  const onRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          phone,
          password,
          confirmPassword,
        }),
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Registrasi gagal.");
        return;
      }

      setMessage("Akun berhasil dibuat. Silakan login.");
      setMode("login");
      setIdentifier(email);
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Registrasi gagal. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const onLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    const result = await signIn("credentials", {
      identifier,
      password,
      redirect: false,
      callbackUrl: safeRedirect,
    });

    if (result?.error) {
      setError("Username/email atau password salah.");
      setIsLoading(false);
      return;
    }

    setSuppressAutoRedirect(true);
    if (typeof window !== "undefined") {
      const audio = new Audio("/assets/buy.mp3");
      audio.volume = 0.8;
      await audio.play().catch(() => {});
    }
    router.push(result?.url ?? safeRedirect);
  };

  const onGoogleLogin = async () => {
    setError("");
    setMessage("");
    setIsGoogleLoading(true);
    if (typeof window !== "undefined") {
      const audio = new Audio("/assets/buy.mp3");
      audio.volume = 0.8;
      await audio.play().catch(() => {});
    }
    await signIn("google", { callbackUrl: safeRedirect });
  };

  return (
    <main className={styles.page} ref={rootRef}>
      <section className={styles.authCard} data-auth="intro">
        <div className={styles.banner} data-auth="intro">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={`logo-${index}`} className={styles.bannerLogoWrap}>
              <Image
                src="/assets/logo.png"
                alt="Logo"
                width={38}
                height={38}
                className={styles.bannerLogo}
                unoptimized
              />
            </div>
          ))}
        </div>

        <div className={styles.headerBlock}>
          <h1>{mode === "login" ? "Login" : "Buat Akun Baru"}</h1>
          <p className={styles.description}>
            {mode === "login"
              ? "Create an account"
              : "Lengkapi data akun dulu sebelum login."}
          </p>
        </div>

        <div className={styles.modeSwitch} data-auth="intro">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={mode === "login" ? styles.modeActive : ""}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={mode === "register" ? styles.modeActive : ""}
          >
            Buat Akun Baru
          </button>
        </div>

        {mode === "login" ? (
          <form className={styles.form} onSubmit={onLogin} data-auth="intro">
            <label className={styles.field}>
              Username / Gmail
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                type="text"
                placeholder="username atau email"
                required
              />
            </label>

            <label className={styles.field}>
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                placeholder="Password"
                required
              />
            </label>

            {error ? <p className={styles.errorText}>{error}</p> : null}
            {message ? <p className={styles.successText}>{message}</p> : null}

            <button type="submit" className={styles.submitButton} disabled={isLoading}>
              {isLoading ? "Loading..." : "Login"}
            </button>

            <label className={styles.rememberRow}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span>Keep me logged in</span>
            </label>

            {googleAvailable ? (
              <button
                type="button"
                onClick={onGoogleLogin}
                className={styles.googleButton}
                disabled={isGoogleLoading}
              >
                {isGoogleLoading ? "Menghubungkan Google..." : "Login dengan Google"}
              </button>
            ) : null}
          </form>
        ) : (
          <form className={styles.form} onSubmit={onRegister} data-auth="intro">
            <label className={styles.field}>
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                type="text"
                placeholder="Username kamu"
                required
              />
            </label>

            <label className={styles.field}>
              Gmail
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="nama@email.com"
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
                required
              />
            </label>

            <label className={styles.field}>
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                placeholder="Minimal 6 karakter"
                required
              />
            </label>

            <label className={styles.field}>
              Konfirmasi Password
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                placeholder="Ulangi password"
                required
              />
            </label>

            {error ? <p className={styles.errorText}>{error}</p> : null}
            {message ? <p className={styles.successText}>{message}</p> : null}

            <button type="submit" className={styles.submitButton} disabled={isLoading}>
              {isLoading ? "Loading..." : "Buat Akun"}
            </button>
          </form>
        )}

        <div className={styles.extraAction} data-auth="intro">
          <button type="button" className={styles.returnButton} onClick={() => router.back()}>
            Kembali
          </button>
          <Link href="/" className={styles.backLink}>
            Forgot password?
          </Link>
        </div>
      </section>
    </main>
  );
}
