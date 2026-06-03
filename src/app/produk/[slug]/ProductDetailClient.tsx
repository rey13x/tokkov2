"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { CallBackProps, Step } from "react-joyride";
import { gsap } from "gsap";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import AppOnboardingJoyride from "@/components/onboarding/AppOnboardingJoyride";
import WaitLoading from "@/components/ui/WaitLoading";
import { formatRupiah } from "@/data/products";
import { addToCart } from "@/lib/cart";
import { reopenMaintenanceNotice, useMaintenanceMode } from "@/lib/maintenance-mode";
import {
  ONBOARDING_STAGE,
  advanceOnboarding,
  getOnboardingState,
  isOnboardingStageActive,
} from "@/lib/onboarding";
import type { StoreProduct } from "@/types/store";
import styles from "./page.module.css";

type ProductDetailClientProps = {
  product: StoreProduct;
};

const PENDING_CART_ACTION_KEY = "tokko_pending_cart_action";

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const noticeRef = useRef<HTMLParagraphElement | null>(null);
  const hasHandledPendingRef = useRef(false);
  const isApplyingRef = useRef(false); // Prevent concurrent job applications
  const lastApplyTimeRef = useRef(0); // Rate limiting
  const router = useRouter();
  const { status } = useSession();
  const { isMaintenanceEnabled } = useMaintenanceMode();

  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [isRedirectingToCart, setIsRedirectingToCart] = useState(false);
  const [isProductTutorialRunning, setIsProductTutorialRunning] = useState(false);
  const [currentApplicantCount, setCurrentApplicantCount] = useState(product.applicantCount ?? 0);
  const [jobApplicationError, setJobApplicationError] = useState("");

  const hasApplicantLimit = typeof product.maxApplicants === "number" && product.maxApplicants > 0;
  const maxApplicants = product.maxApplicants ?? 0;
  const maxApplicantsLabel = hasApplicantLimit ? maxApplicants : "-";
  const applicantLimitReached = hasApplicantLimit && currentApplicantCount >= maxApplicants;

  useEffect(() => {
    setCurrentApplicantCount(product.applicantCount ?? 0);
  }, [product.applicantCount]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-detail='intro']",
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.75,
          stagger: 0.12,
          ease: "power3.out",
        },
      );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!added || !noticeRef.current) {
      return;
    }

    gsap.fromTo(
      noticeRef.current,
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, ease: "power2.out" },
    );
  }, [added]);

  useEffect(() => {
    const shouldRun = isOnboardingStageActive(ONBOARDING_STAGE.PRODUCT_ADD_TO_CART);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsProductTutorialRunning(shouldRun);
    if (!shouldRun) {
      return;
    }

    const timer = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>("[data-onboarding='product-add-to-cart']");
      if (!target) {
        return;
      }
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || hasHandledPendingRef.current || typeof window === "undefined") {
      return;
    }

    const raw = window.sessionStorage.getItem(PENDING_CART_ACTION_KEY);
    if (!raw) {
      // Check for pending job application
      const jobRaw = window.sessionStorage.getItem("tokko_pending_job_apply");
      if (!jobRaw) {
        return;
      }

      hasHandledPendingRef.current = true;
      try {
        const pending = JSON.parse(jobRaw) as { slug?: string; link?: string };
        if (pending.slug !== product.slug || !pending.link) {
          return;
        }

        window.sessionStorage.removeItem("tokko_pending_job_apply");
        setAdded(true);
        setIsRedirectingToCart(true);

        // Record job application and redirect
        const recordApplication = async () => {
          try {
            const response = await fetch("/api/job-applications", {
              method: "POST",
              body: JSON.stringify({ productId: product.id }),
            });

            if (response.ok) {
              const result = await response.json();
              window.location.href = result.applicationLink;
            } else {
              window.location.href = pending.link!;
            }
          } catch {
            window.location.href = pending.link!;
          }
        };

        const timer = window.setTimeout(() => {
          recordApplication();
        }, 550);

        return () => window.clearTimeout(timer);
      } catch {
        window.sessionStorage.removeItem("tokko_pending_job_apply");
      }
      return;
    }

    hasHandledPendingRef.current = true;
    try {
      const pending = JSON.parse(raw) as { slug?: string; quantity?: number };
      if (pending.slug !== product.slug) {
        return;
      }

      const safeQty = Math.min(99, Math.max(1, Number(pending.quantity ?? 1)));
      window.sessionStorage.removeItem(PENDING_CART_ACTION_KEY);
      const timer = window.setTimeout(() => {
        addToCart(product.slug, safeQty);
        setAdded(true);
        setIsRedirectingToCart(true);
        router.replace("/troli");
      }, 550);

      return () => window.clearTimeout(timer);
    } catch {
      window.sessionStorage.removeItem(PENDING_CART_ACTION_KEY);
    }
  }, [status, product.slug, product.id, router]);

  const onAddToCart = () => {
    if (isMaintenanceEnabled) {
      reopenMaintenanceNotice();
      return;
    }

    // If this is a jual_beli product with buyNowLink, redirect to the link instead
    if (product.productType === "jual_beli" && product.buyNowLink) {
      window.location.href = product.buyNowLink;
      return;
    }

    if (product.productType === "pekerjaan") {
      onApplyForJob();
      return;
    }

    const onboardingActive = getOnboardingState().active;
    const isProductTutorialStep = isOnboardingStageActive(ONBOARDING_STAGE.PRODUCT_ADD_TO_CART);

    if (isProductTutorialStep) {
      advanceOnboarding(ONBOARDING_STAGE.CART_CHECKOUT);
      setIsProductTutorialRunning(false);
    }

    if (status === "loading" && !onboardingActive) {
      return;
    }

    if (onboardingActive && status !== "authenticated") {
      if (typeof window !== "undefined") {
        window.alert(
          "Di luar tutorial kamu akan dialihkan ke login/daftar. Karena ini tutorial, langkah login kita skip.",
        );
      }
      addToCart(product.slug, quantity);
      setAdded(true);
      setIsRedirectingToCart(true);
      window.setTimeout(() => {
        router.push("/troli?tutorial=1");
      }, 420);
      return;
    }

    if (status === "unauthenticated") {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          PENDING_CART_ACTION_KEY,
          JSON.stringify({
            slug: product.slug,
            quantity,
          }),
        );
      }
      router.push(`/auth?redirect=${encodeURIComponent(`/produk/${product.slug}`)}`);
      return;
    }

    addToCart(product.slug, quantity);
    setAdded(true);
    setIsRedirectingToCart(true);
    window.setTimeout(() => {
      router.push("/troli");
    }, 420);
  };

  const onApplyForJob = async () => {
    // ===== SECURITY: Prevent devtools bypass =====
    // Check if already applying (prevent concurrent requests)
    if (isApplyingRef.current) {
      setJobApplicationError("Mohon tunggu hingga lamaran selesai diproses.");
      return;
    }

    // Rate limiting: prevent rapid-fire clicks (500ms minimum between attempts)
    const now = Date.now();
    if (now - lastApplyTimeRef.current < 500) {
      setJobApplicationError("Mohon tunggu sebelum melamar lagi.");
      return;
    }
    lastApplyTimeRef.current = now;

    // Verify button should actually be disabled (check limit state)
    if (applicantLimitReached) {
      setJobApplicationError("Anda tidak dapat melamar pekerjaan ini saat ini.");
      return;
    }

    // Verify not loading
    if (status === "loading") {
      return;
    }
    // ===== END SECURITY =====

    setJobApplicationError(""); // Clear previous errors
    
    if (!product.jobApplicationLink) {
      setJobApplicationError("Link pendaftaran tidak tersedia.");
      return;
    }

    if (status === "unauthenticated") {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "tokko_pending_job_apply",
          JSON.stringify({
            slug: product.slug,
            link: product.jobApplicationLink,
          }),
        );
      }
      router.push(`/auth?redirect=${encodeURIComponent(`/produk/${product.slug}`)}`);
      return;
    }

    // Show confirmation popup
    const confirmed = window.confirm(
      "Yakin ingin melamar pekerjaan ini?\n\nSetelah kamu lamar, kamu akan dicatat di sistem kami."
    );
    if (!confirmed) {
      lastApplyTimeRef.current = 0; // Reset rate limit on cancel
      return;
    }

    // Mark as applying to prevent concurrent requests
    isApplyingRef.current = true;

    // User is authenticated, record application and redirect to job link
    try {
      const response = await fetch("/api/job-applications", {
        method: "POST",
        body: JSON.stringify({ productId: product.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.max_reached) {
          // Update limit reached state
          if (hasApplicantLimit) {
            setCurrentApplicantCount(maxApplicants);
          }
          setJobApplicationError("Posisi ini sudah penuh. Silakan coba pekerjaan lainnya.");
          isApplyingRef.current = false;
          return;
        }
        setJobApplicationError(error.message ?? "Gagal mencatat lamaran.");
        isApplyingRef.current = false;
        return;
      }

      const result = await response.json();
      setAdded(true);
      setCurrentApplicantCount(prev => prev + 1); // Optimistically increment count
      setIsRedirectingToCart(true);

      // Redirect to job application link after a short delay
      window.setTimeout(() => {
        window.location.href = result.applicationLink;
      }, 550);
    } catch (error) {
      console.error("Failed to record job application:", error);
      setJobApplicationError("Gagal mencatat lamaran. Anda akan dialihkan ke link pendaftaran.");
      const applicationLink = product.jobApplicationLink;
      if (applicationLink) {
        window.setTimeout(() => {
          window.location.href = applicationLink;
        }, 1000);
      }
      isApplyingRef.current = false;
    }
  };

  const decreaseQty = () => {
    setQuantity((current) => Math.max(1, current - 1));
  };

  const increaseQty = () => {
    setQuantity((current) => Math.min(99, current + 1));
  };

  const updateQtyDirectly = (value: string) => {
    const nextNumber = Number.parseInt(value, 10);
    if (Number.isNaN(nextNumber)) {
      setQuantity(1);
      return;
    }

    setQuantity(Math.min(99, Math.max(1, nextNumber)));
  };

  const productTutorialSteps: Step[] = [
    {
      target: "[data-onboarding='product-add-to-cart']",
      content: "Klik tombol Tambah ke Troli untuk melanjutkan.",
      placement: "top",
      disableBeacon: true,
      hideFooter: true,
    },
  ];

  const onProductTutorialCallback = (payload: CallBackProps) => {
    if (payload.type === "error:target_not_found") {
      setIsProductTutorialRunning(false);
    }
  };

  return (
    <main className={styles.page} ref={rootRef}>
      <AppOnboardingJoyride
        run={isProductTutorialRunning}
        steps={productTutorialSteps}
        onCallback={onProductTutorialCallback}
      />
      {isRedirectingToCart ? (
        <div
          style={{
            position: "fixed",
            top: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1100,
            pointerEvents: "none",
          }}
        >
          <WaitLoading />
        </div>
      ) : null}
      <div className={styles.backRow} data-detail="intro">
        <Link href="/" className={styles.backLink}>
          Kembali ke katalog
        </Link>
        <Link href="/troli" className={styles.cartLink}>
          Buka troli
        </Link>
      </div>

      <section className={styles.detailLayout} data-detail="intro">
        <div className={styles.imageWrap}>
          <FlexibleMedia
            src={product.imageUrl}
            alt={product.name}
            fill
            className={styles.image}
            sizes="(max-width: 920px) 100vw, 50vw"
            priority
            unoptimized
          />
        </div>

        <div className={styles.content}>
          <span className={styles.badge}>{product.category}</span>
          <h1>{product.name}</h1>
          <p className={styles.description}>{product.description}</p>
          {product.productType === "jual_beli" ? (
            <>
              <p className={styles.price}>{formatRupiah(product.price)}</p>
              <p className={styles.duration}>
                Durasi: {product.duration?.trim() ? product.duration : "-"}
              </p>

              <div className={styles.qtyRow}>
                <p>Jumlah</p>
                <div className={styles.qtyControl}>
                  <button type="button" onClick={decreaseQty} aria-label="Kurangi jumlah">
                    -
                  </button>
                  <input
                    value={quantity}
                    onChange={(event) => updateQtyDirectly(event.target.value)}
                    inputMode="numeric"
                    aria-label="Jumlah produk"
                  />
                  <button type="button" onClick={increaseQty} aria-label="Tambah jumlah">
                    +
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  type="button"
                  className={`${styles.orderButton}${product.buyNowLink ? ` ${styles.orderButtonWithLink}` : ''}`}
                  onClick={onAddToCart}
                  disabled={status === "loading"}
                  data-onboarding="product-add-to-cart"
                  style={{ flex: 1 }}
                >
                  {status === "loading" ? "Memuat..." : "Beli Sekarang"}
                </button>
                <button
                  type="button"
                  className={styles.cartIconButton}
                  onClick={onAddToCart}
                  disabled={status === "loading"}
                  title="Tambahkan ke troli"
                  aria-label="Tambahkan ke troli"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                  </svg>
                </button>
              </div>
              <p className={styles.orderHint}>
                Klik tambah ke troli. Jika belum login, kamu akan diarahkan ke halaman auth.
              </p>

              {added ? (
                <p className={styles.successMessage} ref={noticeRef}>
                  {quantity} item berhasil ditambahkan ke troli.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className={styles.price}>{formatRupiah(product.price)}</p>
              <p className={styles.duration}>
                Durasi: {product.duration?.trim() ? product.duration : "-"}
              </p>
              
              {/* Show applicant count */}
              <p style={{ fontSize: "14px", color: "#666", marginTop: "12px", marginBottom: "8px" }}>
                Pelamar: <strong>{currentApplicantCount} / {maxApplicantsLabel}</strong>
                {applicantLimitReached && <span style={{ marginLeft: "8px", color: "#d32f2f", fontWeight: "bold" }}>✗ Penuh</span>}
              </p>

              <button
                type="button"
                className={styles.orderButton}
                onClick={onApplyForJob}
                disabled={status === "loading" || applicantLimitReached || isRedirectingToCart}
                style={applicantLimitReached ? { opacity: 0.6, cursor: "not-allowed", backgroundColor: "#ccc" } : {}}
                data-onboarding="product-add-to-cart"
              >
                {status === "loading" ? "Memuat..." : isRedirectingToCart ? "Mengarahkan..." : applicantLimitReached ? "Posisi Penuh" : "Lamar"}
              </button>
              <p className={styles.orderHint}>
                {jobApplicationError ? (
                  <span style={{ color: "#d32f2f", fontWeight: "500" }}>{jobApplicationError}</span>
                ) : applicantLimitReached ? (
                  <span style={{ color: "#d32f2f", fontWeight: "500" }}>Posisi ini sudah penuh</span>
                ) : status === "unauthenticated" ? (
                  <>
                    Anda harus <Link href={`/auth?redirect=${encodeURIComponent(`/produk/${product.slug}`)}`} style={{ color: "#4a5fe3", textDecoration: "underline" }}>login terlebih dahulu</Link> untuk melamar pekerjaan ini.
                  </>
                ) : (
                  <>Klik tombol Lamar untuk melamar pekerjaan ini.</>
                )}
              </p>

              {added ? (
                <p className={styles.successMessage} ref={noticeRef}>
                  ✓ Lamaran berhasil dicatat! Cek riwayat lamaran di <Link href="/troli" style={{ color: "#214ebd", textDecoration: "underline", fontWeight: "600" }}>halaman troli</Link>. Anda akan dialihkan ke halaman pendaftaran...
                </p>
              ) : null}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
