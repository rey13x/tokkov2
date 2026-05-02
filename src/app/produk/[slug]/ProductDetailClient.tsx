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
import MaintenanceModal from "@/components/maintenance/MaintenanceModal";
import { formatRupiah } from "@/data/products";
import { addToCart } from "@/lib/cart";
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
  const router = useRouter();
  const { status } = useSession();

  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [isRedirectingToCart, setIsRedirectingToCart] = useState(false);
  const [isProductTutorialRunning, setIsProductTutorialRunning] = useState(false);
  const [currentApplicantCount, setCurrentApplicantCount] = useState(product.applicantCount ?? 0);

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
    if (!product.jobApplicationLink) {
      if (typeof window !== "undefined") {
        window.alert("Link pendaftaran tidak tersedia.");
      }
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

    if (status === "loading") {
      return;
    }

    // Show confirmation popup
    const confirmed = window.confirm(
      "Yakin ingin melamar pekerjaan ini?\n\nSetelah kamu lamar, kamu akan dicatat di sistem kami."
    );
    if (!confirmed) return;

    // User is authenticated, record application and redirect to job link
    try {
      const response = await fetch("/api/job-applications", {
        method: "POST",
        body: JSON.stringify({ productId: product.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.max_reached) {
          if (hasApplicantLimit) {
            setCurrentApplicantCount(maxApplicants);
          }
          return;
        }
        if (typeof window !== "undefined") {
          window.alert(error.message ?? "Gagal mencatat lamaran.");
        }
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
      if (typeof window !== "undefined") {
        window.alert("Gagal mencatat lamaran. Anda akan dialihkan ke link pendaftaran.");
        window.location.href = product.jobApplicationLink;
      }
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

              <button
                type="button"
                className={styles.orderButton}
                onClick={onAddToCart}
                disabled={status === "loading"}
                data-onboarding="product-add-to-cart"
              >
                {status === "loading" ? "Memuat..." : "Tambah ke Troli"}
              </button>
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
              </p>

              <button
                type="button"
                className={styles.orderButton}
                onClick={onAddToCart}
                disabled={status === "loading" || applicantLimitReached || status === "unauthenticated"}
                style={(applicantLimitReached || status === "unauthenticated") ? { opacity: 0.6, cursor: "not-allowed" } : {}}
                data-onboarding="product-add-to-cart"
              >
                {status === "loading" ? "Memuat..." : status === "unauthenticated" ? "Login Terlebih Dahulu" : applicantLimitReached ? "Tidak Tersedia" : "Lamar"}
              </button>
              <p className={styles.orderHint}>
                {status === "unauthenticated" ? (
                  <>
                    Anda harus <Link href={`/auth?redirect=${encodeURIComponent(`/produk/${product.slug}`)}`} style={{ color: "#4a5fe3", textDecoration: "underline" }}>login terlebih dahulu</Link> untuk melamar pekerjaan ini.
                  </>
                ) : applicantLimitReached ? (
                  <>
                    Pekerjaan ini sudah penuh.
                  </>
                ) : (
                  <>
                    Klik tombol Lamar untuk melamar pekerjaan ini.
                  </>
                )}
              </p>

              {added ? (
                <p className={styles.successMessage} ref={noticeRef}>
                  Anda akan dialihkan ke halaman pendaftaran pekerjaan...
                </p>
              ) : null}
            </>
          )}
        </div>
      </section>
      <MaintenanceModal />
    </main>
  );
}
