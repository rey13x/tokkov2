"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { FcGoogle } from "react-icons/fc";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { getDeviceId } from "@/lib/device-fingerprint";
import styles from "./page.module.css";

type AuthMode = "signin" | "signup" | "forgotPassword";

function getTempPasswordResetMessage(message: string) {
  if (message.includes("sudah dikirim")) {
    return "Link reset password sudah dikirim. Cek email kamu!";
  }
  return message;
}

function getSafeRedirect(pathname: string | null) {
  if (!pathname || !pathname.startsWith("/") || pathname.startsWith("//")) {
    return "/";
  }
  if (pathname.startsWith("/auth")) {
    return "/";
  }
  return pathname;
}

function getAuthErrorMessage(code: string | null) {
  switch (code) {
    case "OAuthSignin":
    case "OAuthCallback":
    case "OAuthCreateAccount":
      return "Login Google gagal. Cek konfigurasi OAuth di Google Cloud lalu coba lagi.";
    case "AccessDenied":
      return "Akses login ditolak. Pastikan akun Google kamu sudah diizinkan pada OAuth Consent Screen (mode Testing) atau app sudah Publish.";
    case "Configuration":
      return "Konfigurasi login Google belum lengkap di server.";
    default:
      return "Login gagal. Coba lagi.";
  }
}

function triggerBrowserSavePassword(email: string, password: string) {
  // Create a hidden form to trigger browser's save password dialog
  const form = document.createElement("form");
  form.style.display = "none";
  form.method = "POST";
  form.action = "javascript:void(0);";

  const emailInput = document.createElement("input");
  emailInput.type = "email";
  emailInput.name = "email";
  emailInput.value = email;
  emailInput.autoComplete = "email";

  const passwordInput = document.createElement("input");
  passwordInput.type = "password";
  passwordInput.name = "password";
  passwordInput.value = password;
  passwordInput.autoComplete = "current-password";

  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";

  form.appendChild(emailInput);
  form.appendChild(passwordInput);
  form.appendChild(submitBtn);
  document.body.appendChild(form);

  // Submit the form to trigger browser's save password dialog
  form.submit();

  // Clean up after a short delay
  setTimeout(() => {
    document.body.removeChild(form);
  }, 100);
}

export default function AuthPage() {
  const router = useRouter();
  const { status } = useSession();
  const googleUiEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED !== "false";
  const canUseEmailOtp = process.env.NEXT_PUBLIC_EMAIL_OTP_ENABLED === "true";
  const forgotPasswordEnabled = process.env.NEXT_PUBLIC_FORGOT_PASSWORD_ENABLED === "true";

  const [mode, setMode] = useState<AuthMode>("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [isForgotPasswordSubmitting, setIsForgotPasswordSubmitting] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState("");
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState("/");
  const [deviceId, setDeviceId] = useState("");
  const canUseGoogleSignIn = googleUiEnabled;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    setRedirectTarget(getSafeRedirect(params.get("redirect")));
    const authError = params.get("error");
    if (authError) {
      setError(getAuthErrorMessage(authError));
    }

    // Initialize device ID for account creation tracking
    try {
      setDeviceId(getDeviceId());
    } catch (error) {
      console.error("Failed to get device ID:", error);
    }
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
    let registrationCompleted = false;

    try {
      if (!canUseEmailOtp) {
        const registerResponse = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: signupUsername,
            email: signupEmail,
            phone: signupPhone,
            password: signupPassword,
            confirmPassword: signupConfirmPassword,
            deviceId,
          }),
        });
        let registerResult: { message?: string } = {};
        try {
          registerResult = (await registerResponse.json()) as { message?: string };
        } catch {}
        if (!registerResponse.ok) {
          setError(registerResult.message ?? "Pendaftaran gagal.");
          return;
        }
        registrationCompleted = true;
      } else {
        const verifyResponse = await fetch("/api/auth/signup/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: signupEmail,
            code: signupCode,
          }),
        });
        let verifyResult: { message?: string } = {};
        try {
          verifyResult = (await verifyResponse.json()) as { message?: string };
        } catch {}
        if (!verifyResponse.ok) {
          setError(verifyResult.message ?? "Verifikasi kode gagal.");
          return;
        }
        registrationCompleted = true;
      }

      try {
        const loginResult = await signIn("credentials", {
          identifier: signupEmail.trim(),
          password: signupPassword,
          redirect: false,
        });

        if (loginResult?.error) {
          setSuccess("Akun berhasil dibuat. Silakan login manual.");
          setMode("signin");
          setIdentifier(signupEmail.trim());
          return;
        }

        // Trigger browser's save password dialog
        triggerBrowserSavePassword(signupEmail, signupPassword);

        const target = await resolveRedirectAfterAuth();
        router.replace(target);
      } catch {
        setSuccess("Akun berhasil dibuat. Silakan login manual.");
        setMode("signin");
        setIdentifier(signupEmail.trim());
      }
    } catch {
      if (registrationCompleted) {
        setSuccess("Akun berhasil dibuat, tapi auto-login gagal. Silakan login manual.");
        setMode("signin");
        setIdentifier(signupEmail.trim());
      } else {
        setError("Gagal menyelesaikan pendaftaran.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSignInWithGoogle = async () => {
    setError("");
    setSuccess("");
    setIsGoogleSubmitting(true);

    try {
      if (!canUseGoogleSignIn) {
        setError("Google login belum aktif di server.");
        setIsGoogleSubmitting(false);
        return;
      }

      const providerCheck = await fetch("/api/auth/providers", { cache: "no-store" });
      if (!providerCheck.ok) {
        setError("Provider Google belum aktif di server.");
        setIsGoogleSubmitting(false);
        return;
      }
      const providerData = (await providerCheck.json()) as Record<string, unknown>;
      if (!providerData.google) {
        setError("Provider Google belum aktif di server.");
        setIsGoogleSubmitting(false);
        return;
      }

      await signIn("google", { callbackUrl: redirectTarget });
    } catch {
      setError("Google login gagal. Coba lagi.");
      setIsGoogleSubmitting(false);
    }
  };

  const onForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setForgotPasswordError("");
    setForgotPasswordSuccess("");
    setIsForgotPasswordSubmitting(true);

    try {
      const trimmedEmail = forgotPasswordEmail.trim();
      
      if (!trimmedEmail) {
        setForgotPasswordError("Email wajib diisi");
        return;
      }

      if (!trimmedEmail.includes("@")) {
        setForgotPasswordError("Email tidak valid");
        return;
      }

      const response = await fetch("/api/auth/reset-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        setForgotPasswordError(result.message ?? "Gagal mengirim link reset password.");
        return;
      }

      setForgotPasswordSuccess(getTempPasswordResetMessage(result.message ?? "Link reset password sudah dikirim."));
      setForgotPasswordEmail("");
      
      // Reset form after 3 seconds
      setTimeout(() => {
        setForgotPasswordSuccess("");
        setMode("signin");
      }, 3000);
    } catch {
      setForgotPasswordError("Gagal mengirim link reset password.");
    } finally {
      setIsForgotPasswordSubmitting(false);
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
          <p className={styles.description}>Masuk atau daftar akun untuk lanjut belanja.</p>
        </header>

        <div className={styles.modeSwitch}>
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError("");
              setSuccess("");
              setForgotPasswordError("");
              setForgotPasswordSuccess("");
            }}
            className={mode === "signin" ? styles.modeActive : ""}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
              setSuccess("");
              setForgotPasswordError("");
              setForgotPasswordSuccess("");
            }}
            className={mode === "signup" ? styles.modeActive : ""}
          >
            Sign Up
          </button>
          {forgotPasswordEnabled && (
            <button
              type="button"
              onClick={() => {
                setMode("forgotPassword");
                setError("");
                setSuccess("");
                setForgotPasswordError("");
                setForgotPasswordSuccess("");
              }}
              className={mode === "forgotPassword" ? styles.modeActive : ""}
            >
              Lupa Password
            </button>
          )}
        </div>

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
              <div className={styles.passwordField}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password kamu"
                  required
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <AiOutlineEyeInvisible className={styles.eyeIcon} />
                  ) : (
                    <AiOutlineEye className={styles.eyeIcon} />
                  )}
                </button>
              </div>
            </label>
            <p className={styles.helperText}>
              Lupa password? Konfirmasi ke{" "}
              <a
                href="https://wa.me/6281319865384?text=Halo%20min%20mau%20reset%20password.."
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "underline", color: "inherit" }}
              >
                admin
              </a>
            </p>
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
              <div className={styles.passwordField}>
                <input
                  type={showSignupPassword ? "text" : "password"}
                  value={signupPassword}
                  onChange={(event) => setSignupPassword(event.target.value)}
                  placeholder="Password kamu"
                  required
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                  aria-label={showSignupPassword ? "Hide password" : "Show password"}
                >
                  {showSignupPassword ? (
                    <AiOutlineEyeInvisible className={styles.eyeIcon} />
                  ) : (
                    <AiOutlineEye className={styles.eyeIcon} />
                  )}
                </button>
              </div>
            </label>
            <label className={styles.field}>
              Konfirmasi Password
              <div className={styles.passwordField}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={signupConfirmPassword}
                  onChange={(event) => setSignupConfirmPassword(event.target.value)}
                  placeholder="Ulangi password kamu"
                  required
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <AiOutlineEyeInvisible className={styles.eyeIcon} />
                  ) : (
                    <AiOutlineEye className={styles.eyeIcon} />
                  )}
                </button>
              </div>
            </label>
            {canUseEmailOtp ? (
              <>
                <button
                  type="button"
                  className={styles.returnButton}
                  onClick={onRequestCode}
                  disabled={isRequestingCode}
                >
                  {isRequestingCode
                    ? "Mengirim kode..."
                    : isCodeSent
                      ? "Kirim Ulang Kode"
                      : "Kirim Kode Verifikasi"}
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
              </>
            ) : (
              <p className={styles.disabledInfo}>Mode daftar cepat aktif: tanpa OTP email.</p>
            )}
            {error ? <p className={styles.errorText}>{error}</p> : null}
            {success ? <p className={styles.successText}>{success}</p> : null}
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting || (canUseEmailOtp && !isCodeSent)}
            >
              {isSubmitting ? "Memproses..." : "Daftar dan Masuk"}
            </button>
          </form>
        )}

        {mode === "forgotPassword" && forgotPasswordEnabled ? (
          <form className={styles.form} onSubmit={onForgotPassword}>
            <label className={styles.field}>
              Email / Gmail
              <input
                type="email"
                value={forgotPasswordEmail}
                onChange={(event) => setForgotPasswordEmail(event.target.value)}
                placeholder="Masukkan email kamu"
                required
              />
            </label>
            {forgotPasswordError ? <p className={styles.errorText}>{forgotPasswordError}</p> : null}
            {forgotPasswordSuccess ? <p className={styles.successText}>{forgotPasswordSuccess}</p> : null}
            <button 
              type="submit" 
              className={styles.submitButton} 
              disabled={isForgotPasswordSubmitting}
            >
              {isForgotPasswordSubmitting ? "Mengirim..." : "Kirim Link Reset Password"}
            </button>
            <p className={styles.helperText}>
              Kami akan mengirim link reset password ke email kamu. link berlaku selama 1 jam
            </p>
          </form>
        ) : null}

        <div className={styles.extraAction}>
          <Link href="/" className={styles.backLink}>
            Kembali ke Beranda
          </Link>
        </div>
      </section>
    </main>
  );
}
