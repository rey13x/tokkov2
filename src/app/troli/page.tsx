"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { CallBackProps, Step } from "react-joyride";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import AppOnboardingJoyride from "@/components/onboarding/AppOnboardingJoyride";
import WaitLoading from "@/components/ui/WaitLoading";
import { formatRupiah } from "@/data/products";
import { readCart, removeFromCart, updateCartQuantity } from "@/lib/cart";
import { reopenMaintenanceNotice, useMaintenanceMode } from "@/lib/maintenance-mode";
import {
  ONBOARDING_STAGE,
  ONBOARDING_TUTORIAL_ORDER_ID,
  ONBOARDING_TUTORIAL_QUERY_KEY,
  advanceOnboarding,
  getOnboardingState,
  type OnboardingStage,
} from "@/lib/onboarding";
import { fetchStoreData } from "@/lib/store-client";
import type { StoreProduct } from "@/types/store";
import styles from "./page.module.css";

type CartLine = {
  slug: string;
  quantity: number;
  selected: boolean;
};

type JobApplication = {
  id: string;
  product_id: string;
  product_name: string;
  created_at: number;
  applicationLink?: string; // Will be fetched from product
  imageUrl?: string;
  price?: number;
  maxApplicants?: number;
  applicantCount?: number;
  category?: string;
};

const TAX_RATE = 0.11;

function getInitialCartLines(): CartLine[] {
  if (typeof window === "undefined") {
    return [];
  }

  return readCart().map((entry) => ({
    slug: entry.slug,
    quantity: entry.quantity,
    selected: true,
  }));
}

export default function CartPage() {
  const router = useRouter();
  const { status, data: session } = useSession();
  const { isMaintenanceEnabled } = useMaintenanceMode();
  const filterRef = useRef<HTMLDivElement | null>(null);
  const [cartLines, setCartLines] = useState<CartLine[]>(getInitialCartLines);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [isStoreLoading, setIsStoreLoading] = useState(true);
  const [jobApplications, setJobApplications] = useState<JobApplication[]>([]);
  const [isJobApplicationsLoading, setIsJobApplicationsLoading] = useState(true);
  const [jobApplicationError, setJobApplicationError] = useState("");
  const [cancelingApplicationId, setCancelingApplicationId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [query, setQuery] = useState("");
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isCartTutorialRunning, setIsCartTutorialRunning] = useState(false);
  const [cartTutorialStage, setCartTutorialStage] = useState<OnboardingStage | null>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  // Static QRIS state
  const [staticQRData, setStaticQRData] = useState<{
    qrImageUrl: string;
    amount: number;
  } | null>(null);
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    let mounted = true;
    fetchStoreData()
      .then((data) => {
        if (!mounted) {
          return;
        }
        setProducts(data.products ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) {
          setIsStoreLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Fetch job applications
  useEffect(() => {
    if (status !== "authenticated") {
      setIsJobApplicationsLoading(false);
      return;
    }

    let mounted = true;
    setIsJobApplicationsLoading(true);
    setJobApplicationError("");

    fetch("/api/job-applications")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat lamaran");
        }
        return res.json() as Promise<{ applications: Array<{ id: string; product_id: string; product_name: string; created_at: number }> }>;
      })
      .then((data) => {
        if (!mounted) return;
        // Enrich with application links from products
        const enriched = data.applications.map((app) => {
          const product = products.find((p) => p.id === app.product_id);
          return {
            ...app,
            applicationLink: product?.jobApplicationLink,
            imageUrl: product?.imageUrl,
            price: product?.price,
            maxApplicants: product?.maxApplicants,
            applicantCount: product?.applicantCount,
            category: product?.category,
          };
        });
        setJobApplications(enriched);
      })
      .catch((err) => {
        if (mounted) {
          console.error("Failed to load job applications:", err);
          setJobApplicationError("Gagal memuat riwayat lamaran");
        }
      })
      .finally(() => {
        if (mounted) {
          setIsJobApplicationsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [status, products]);

  const detailedItems = useMemo(() => {
    return cartLines
      .map((line) => {
        const product = products.find((item) => item.slug === line.slug);
        if (!product) {
          return null;
        }

        return {
          ...line,
          product,
          lineTotal: product.price * line.quantity,
        };
      })
      .filter((line): line is NonNullable<typeof line> => Boolean(line));
  }, [cartLines, products]);

  const freelanceJobApplications = useMemo(() => {
    return jobApplications.filter((app) => app.category === "Freelance");
  }, [jobApplications]);

  useEffect(() => {
    const currentState = getOnboardingState();
    const supportedStages: OnboardingStage[] = [
      ONBOARDING_STAGE.CART_CHECKOUT,
      ONBOARDING_STAGE.CART_RETURN_STATUS,
    ];
    if (!currentState.active || !supportedStages.includes(currentState.stage)) {
      setCartTutorialStage(null);
      setIsCartTutorialRunning(false);
      return;
    }

    if (
      currentState.stage === ONBOARDING_STAGE.CART_CHECKOUT &&
      (isStoreLoading || detailedItems.length === 0)
    ) {
      setCartTutorialStage(currentState.stage);
      setIsCartTutorialRunning(false);
      return;
    }

    setCartTutorialStage(currentState.stage);
    setIsCartTutorialRunning(true);

    const timer = window.setTimeout(() => {
      const targetSelector =
        currentState.stage === ONBOARDING_STAGE.CART_RETURN_STATUS
          ? "[data-onboarding='cart-open-status']"
          : "[data-onboarding='cart-checkout']";
      const target = document.querySelector<HTMLElement>(targetSelector);
      if (!target) {
        return;
      }
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [isStoreLoading, detailedItems.length]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setHasScrolled(scrollTop > 10);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const categories = useMemo(() => {
    const set = new Set(detailedItems.map((item) => item.product.category));
    return ["Semua", ...set];
  }, [detailedItems]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = detailedItems.filter((item) => {
    const byCategory =
      activeCategory === "Semua" || item.product.category === activeCategory;
    const searchable = `${item.product.name} ${item.product.category}`.toLowerCase();
    const byQuery = normalizedQuery.length === 0 || searchable.includes(normalizedQuery);
    return byCategory && byQuery;
  });

  const subtotal = detailedItems
    .filter((item) => item.selected)
    .reduce((total, item) => total + item.lineTotal, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  const changeQuantity = (slug: string, nextQuantity: number) => {
    const safeQuantity = Math.min(99, Math.max(1, nextQuantity));
    setCartLines((current) =>
      current.map((item) =>
        item.slug === slug ? { ...item, quantity: safeQuantity } : item,
      ),
    );
    updateCartQuantity(slug, safeQuantity);
  };

  const removeLine = (slug: string) => {
    setCartLines((current) => current.filter((item) => item.slug !== slug));
    removeFromCart(slug);
  };

  const toggleSelected = (slug: string) => {
    setCartLines((current) =>
      current.map((item) =>
        item.slug === slug ? { ...item, selected: !item.selected } : item,
      ),
    );
  };

  const onOpenStatusPage = () => {
    const onboardingState = getOnboardingState();
    if (
      onboardingState.active &&
      onboardingState.stage === ONBOARDING_STAGE.CART_RETURN_STATUS
    ) {
      advanceOnboarding(ONBOARDING_STAGE.STATUS_CANCEL_REASON);
      setIsCartTutorialRunning(false);
      router.push(
        `/status-pemesanan?highlight=${encodeURIComponent(
          ONBOARDING_TUTORIAL_ORDER_ID,
        )}&${ONBOARDING_TUTORIAL_QUERY_KEY}=1`,
      );
      return;
    }

    if (onboardingState.active) {
      router.push(
        `/status-pemesanan?highlight=${encodeURIComponent(
          ONBOARDING_TUTORIAL_ORDER_ID,
        )}&${ONBOARDING_TUTORIAL_QUERY_KEY}=1`,
      );
      return;
    }

    if (status !== "authenticated") {
      router.push("/auth?redirect=/status-pemesanan");
      return;
    }

    router.push("/status-pemesanan");
  };

  const onCheckout = async () => {
    setError("");
    setSuccess("");

    if (isMaintenanceEnabled) {
      reopenMaintenanceNotice();
      return;
    }

    const selected = detailedItems.filter((item) => item.selected);
    if (selected.length === 0) {
      setError("Pilih minimal satu item untuk checkout.");
      return;
    }

    const onboardingState = getOnboardingState();
    if (onboardingState.active) {
      if (onboardingState.stage === ONBOARDING_STAGE.CART_CHECKOUT) {
        advanceOnboarding(ONBOARDING_STAGE.STATUS_OPEN_PAYMENT);
        setIsCartTutorialRunning(false);
      }
      setSuccess("Mode tutorial aktif. Simulasi berjalan, data pesanan tidak masuk database.");
      window.setTimeout(() => {
        router.push(
          `/status-pemesanan?highlight=${encodeURIComponent(
            ONBOARDING_TUTORIAL_ORDER_ID,
          )}&pay=1&${ONBOARDING_TUTORIAL_QUERY_KEY}=1`,
        );
      }, 450);
      return;
    }

    if (status !== "authenticated") {
      router.push("/auth?redirect=/troli");
      return;
    }

    setIsCheckoutLoading(true);
    try {
      // Step 1: Create order in database
      const orderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: selected.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
        }),
      });

      const orderResult = (await orderResponse.json()) as {
        message?: string;
        orderId?: string;
        total?: number;
        createdAt?: string;
      };

      if (!orderResponse.ok) {
        setError(orderResult.message ?? "Gagal memproses pesanan.");
        return;
      }

      const orderId = orderResult.orderId ?? "";
      const total = orderResult.total ?? 0;

      // Step 2: Generate dynamic QRIS QR code
      try {
        const qrResponse = await fetch("/api/payments/create-qr", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderId,
            items: selected.map((item) => ({
              productId: item.product.id,
              productName: item.product.name,
              quantity: item.quantity,
              price: item.product.price,
            })),
            subtotal: selected.reduce((acc, item) => acc + item.product.price * item.quantity, 0),
            tax: total - selected.reduce((acc, item) => acc + item.product.price * item.quantity, 0),
            total,
            customerName: session?.user?.username || session?.user?.name || "User",
            customerEmail: session?.user?.email ?? "",
            customerPhone: session?.user?.phone ?? "",
          }),
        });

        if (!qrResponse.ok) {
          console.warn("Failed to generate dynamic QRIS, using fallback");
        }
      } catch (qrError) {
        console.warn("Error generating dynamic QRIS:", qrError);
      }

      // Step 3: Remove items from cart
      for (const item of selected) {
        removeFromCart(item.slug);
      }

      setCartLines((current) => current.filter((item) => !item.selected));

      // Step 4: Show success and redirect to status page
      setSuccess("Pesanan berhasil dibuat! Silakan lakukan pembayaran dengan QRIS.");
      window.setTimeout(() => {
        router.push(`/status-pemesanan?highlight=${orderId}`);
      }, 1500);
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Gagal memproses pesanan. Coba lagi.");
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const onContinueJobApplication = (app: JobApplication) => {
    if (!app.applicationLink) {
      setJobApplicationError("Link pendaftaran tidak tersedia untuk pekerjaan ini.");
      return;
    }
    window.location.href = app.applicationLink;
  };

  const onCancelJobApplication = async (applicationId: string) => {
    const confirmed = window.confirm("Yakin ingin membatalkan lamaran ini?");
    if (!confirmed) return;

    setCancelingApplicationId(applicationId);
    setJobApplicationError("");

    try {
      const response = await fetch("/api/job-applications", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ applicationId }),
      });

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        setJobApplicationError(result.message ?? "Gagal membatalkan lamaran.");
        return;
      }

      // Remove from state
      setJobApplications((current) => current.filter((app) => app.id !== applicationId));
      setSuccess("Lamaran berhasil dibatalkan.");
    } catch (err) {
      console.error("Failed to cancel job application:", err);
      setJobApplicationError("Gagal membatalkan lamaran. Coba lagi.");
    } finally {
      setCancelingApplicationId(null);
    }
  };

  const cartTutorialSteps: Step[] = [
    ...(cartTutorialStage === ONBOARDING_STAGE.CART_RETURN_STATUS
      ? [
          {
            target: "[data-onboarding='cart-open-status']",
            content: "Sekarang kembali ke status pemesanan lewat tombol ini.",
            placement: "top" as const,
            disableBeacon: true,
            hideFooter: true,
          },
        ]
      : [
          {
            target: "[data-onboarding='cart-checkout']",
            content: "Klik Lanjut ke Pembayaran untuk membuat pesanan.",
            placement: "left" as const,
            disableBeacon: true,
            hideFooter: true,
          },
        ]),
  ];

  const onCartTutorialCallback = (payload: CallBackProps) => {
    if (payload.type === "error:target_not_found") {
      setIsCartTutorialRunning(false);
    }
  };

  return (
    <main className={styles.page}>
      <AppOnboardingJoyride
        run={isCartTutorialRunning}
        steps={cartTutorialSteps}
        onCallback={onCartTutorialCallback}
      />
      
      <header className={styles.header}>
        <h1>Troli</h1>
        <Link href="/" className={styles.backLink}>
          Kembali belanja
        </Link>
      </header>

      {!isClient || isStoreLoading || isJobApplicationsLoading ? <WaitLoading centered /> : null}

      {isClient && !isStoreLoading && !isJobApplicationsLoading && detailedItems.length === 0 && freelanceJobApplications.length === 0 ? (
        <section className={styles.emptyState}>
          <h2>Troli masih kosong</h2>
          <p>Pilih produk dulu dari halaman katalog.</p>
          <button
            type="button"
            className={`${styles.actionButton} ${styles.actionSecondary}`}
            onClick={onOpenStatusPage}
            data-onboarding="cart-open-status"
          >
            Lihat Status Pemesanan
          </button>
          <Link href="/" className={styles.backShop}>
            Ke katalog
          </Link>
        </section>
      ) : null}

      {error ? <p className={styles.errorText}>{error}</p> : null}
      {success ? <p className={styles.successText}>{success}</p> : null}
      {jobApplicationError ? <p className={styles.errorText}>{jobApplicationError}</p> : null}

      {/* Job Applications Section */}
      {isClient && !isJobApplicationsLoading && freelanceJobApplications.length > 0 ? (
        <section className={styles.jobApplicationsSection}>
          <h2 className={styles.sectionTitle}>Pekerjaan Dilamar</h2>
          <div className={styles.jobApplicationsList}>
            {freelanceJobApplications.map((app) => (
              <article key={app.id} className={styles.jobApplicationItem}>
                <div className={styles.jobApplicationImageWrap}>
                  <FlexibleMedia
                    src={app.imageUrl || "/assets/logo.png"}
                    alt={app.product_name}
                    fill
                    className={styles.jobApplicationImage}
                    sizes="80px"
                    unoptimized
                  />
                </div>
                <div className={styles.jobApplicationContent}>
                  <h3>{app.product_name}</h3>
                  <p className={styles.jobApplicationSalary}>{formatRupiah(app.price || 0)}</p>
                  <p className={styles.jobApplicationDate}>
                    Dilamar: {new Date(app.created_at).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                  <p className={styles.jobApplicationApplicants}>
                    {app.applicantCount || 0}/{app.maxApplicants ? app.maxApplicants : "∞"}
                  </p>
                </div>
                <div className={styles.jobApplicationActions}>
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.actionBlack}`}
                    onClick={() => onContinueJobApplication(app)}
                  >
                    Lanjutkan
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.actionBlack}`}
                    onClick={() => onCancelJobApplication(app.id)}
                    disabled={cancelingApplicationId === app.id}
                  >
                    {cancelingApplicationId === app.id ? "Membatalkan..." : "Batalkan"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* Products Section */}
      {isClient && !isStoreLoading && detailedItems.length > 0 ? (
        <section className={styles.cartLayout}>
          <div className={styles.itemsPanel}>
            <div 
              ref={filterRef}
              className={`${styles.filterWrap} ${hasScrolled ? styles.filterWrapScrolled : ""}`}
            >
              <div className={styles.searchWrap}>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari di troli..."
                />
              </div>
              <div className={styles.categoryRow}>
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`${styles.categoryChip} ${
                      activeCategory === category ? styles.categoryChipActive : ""
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <article key={item.slug} className={styles.cartItem}>
                  <div className={styles.checkboxCell}>
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => toggleSelected(item.slug)}
                      aria-label={`Pilih ${item.product.name}`}
                    />
                  </div>

                  <div className={styles.thumbWrap}>
                    <FlexibleMedia
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      fill
                      className={styles.thumb}
                      sizes="100px"
                      unoptimized
                    />
                  </div>

                  <div className={styles.itemContent}>
                    <div className={styles.itemHead}>
                      <h2>{item.product.name}</h2>
                      <button
                        type="button"
                        onClick={() => removeLine(item.slug)}
                        className={styles.removeButton}
                        aria-label={`Hapus ${item.product.name}`}
                      >
                        x
                      </button>
                    </div>
                    <p className={styles.metaLine}>{item.product.category}</p>
                    <p className={styles.metaLineMuted}>Tidak dapat refund</p>
                  </div>

                  <div className={styles.actionCol}>
                    <div className={styles.qtyControl}>
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.slug, item.quantity - 1)}
                      >
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.slug, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <strong>{formatRupiah(item.lineTotal)}</strong>
                  </div>
                </article>
              ))
            ) : (
              <p className={styles.emptyFilterText}>
                Tidak ada item yang cocok dengan filter ini.
              </p>
            )}
          </div>

          <aside className={styles.summaryPanel}>
            <h3>Ringkasan Pesanan</h3>
            <div className={styles.summaryRow}>
              <span>Subtotal</span>
              <strong>{formatRupiah(subtotal)}</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Pajak</span>
              <strong>{formatRupiah(tax)}</strong>
            </div>
            <hr />
            <div className={styles.summaryRowTotal}>
              <span>Total</span>
              <strong>{formatRupiah(total)}</strong>
            </div>
            <button
              type="button"
              className={`${styles.actionButton} ${styles.actionPrimary}`}
              disabled={subtotal <= 0 || isCheckoutLoading}
              onClick={onCheckout}
              data-onboarding="cart-checkout"
            >
              {isCheckoutLoading ? "Memproses..." : "Lanjut ke Pembayaran"}
            </button>

            <button
              type="button"
              className={`${styles.actionButton} ${styles.actionSecondary}`}
              onClick={onOpenStatusPage}
              data-onboarding="cart-open-status"
            >
              Lihat Status Pemesanan
            </button>
          </aside>
        </section>
      ) : null}
    </main>
  );
}
