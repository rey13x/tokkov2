"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { CallBackProps, Step } from "react-joyride";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import AppOnboardingJoyride from "@/components/onboarding/AppOnboardingJoyride";
import WaitLoading from "@/components/ui/WaitLoading";
import { formatRupiah } from "@/data/products";
import { readCart, removeFromCart, updateCartQuantity } from "@/lib/cart";
import {
  ONBOARDING_STAGE,
  advanceOnboarding,
  isOnboardingStageActive,
} from "@/lib/onboarding";
import { fetchStoreData } from "@/lib/store-client";
import type { StoreProduct } from "@/types/store";
import styles from "./page.module.css";

type CartLine = {
  slug: string;
  quantity: number;
  selected: boolean;
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
  const { status } = useSession();
  const [cartLines, setCartLines] = useState<CartLine[]>(getInitialCartLines);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [isStoreLoading, setIsStoreLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [query, setQuery] = useState("");
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isCartTutorialRunning, setIsCartTutorialRunning] = useState(false);
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

  useEffect(() => {
    const shouldRun =
      !isStoreLoading &&
      detailedItems.length > 0 &&
      isOnboardingStageActive(ONBOARDING_STAGE.CART_CHECKOUT);
    setIsCartTutorialRunning(shouldRun);
    if (!shouldRun) {
      return;
    }

    const timer = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>("[data-onboarding='cart-checkout']");
      if (!target) {
        return;
      }
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [isStoreLoading, detailedItems.length]);

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
    if (status !== "authenticated") {
      router.push("/auth?redirect=/status-pemesanan");
      return;
    }

    router.push("/status-pemesanan");
  };

  const onCheckout = async () => {
    setError("");
    setSuccess("");

    if (status !== "authenticated") {
      router.push("/auth?redirect=/troli");
      return;
    }

    const selected = detailedItems.filter((item) => item.selected);
    if (selected.length === 0) {
      setError("Pilih minimal satu item untuk checkout.");
      return;
    }

    if (isOnboardingStageActive(ONBOARDING_STAGE.CART_CHECKOUT)) {
      advanceOnboarding(ONBOARDING_STAGE.STATUS_PAYMENT_OR_RECEIPT);
      setIsCartTutorialRunning(false);
    }

    setIsCheckoutLoading(true);
    try {
      const response = await fetch("/api/orders", {
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

      const result = (await response.json()) as {
        message?: string;
        orderId?: string;
        createdAt?: string;
      };
      if (!response.ok) {
        setError(result.message ?? "Gagal memproses pesanan.");
        return;
      }

      for (const item of selected) {
        removeFromCart(item.slug);
      }

      setCartLines((current) => current.filter((item) => !item.selected));
      const orderId = result.orderId ?? "";
      setSuccess("Pesanan berhasil dibuat. Mengarahkan ke status pemesanan...");
      const highlightQuery = orderId ? `?highlight=${orderId}&pay=1` : "";
      window.setTimeout(() => {
        router.push(`/status-pemesanan${highlightQuery}`);
      }, 450);
    } catch {
      setError("Gagal memproses pesanan. Coba lagi.");
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const cartTutorialSteps: Step[] = [
    {
      target: "[data-onboarding='cart-checkout']",
      content: "Klik Lanjut ke Pembayaran untuk membuat pesanan.",
      placement: "left",
      disableBeacon: true,
      hideFooter: true,
    },
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

      {!isClient || isStoreLoading ? <WaitLoading centered /> : null}

      {isClient && !isStoreLoading && detailedItems.length === 0 ? (
        <section className={styles.emptyState}>
          <h2>Troli masih kosong</h2>
          <p>Pilih produk dulu dari halaman katalog.</p>
          <button type="button" className={`${styles.actionButton} ${styles.actionSecondary}`} onClick={onOpenStatusPage}>
            Lihat Status Pemesanan
          </button>
          <Link href="/" className={styles.backShop}>
            Ke katalog
          </Link>
        </section>
      ) : null}

      {error ? <p className={styles.errorText}>{error}</p> : null}
      {success ? <p className={styles.successText}>{success}</p> : null}

      {isClient && !isStoreLoading && detailedItems.length > 0 ? (
        <section className={styles.cartLayout}>
          <div className={styles.itemsPanel}>
            <div className={styles.filterWrap}>
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
            >
              Lihat Status Pemesanan
            </button>
          </aside>
        </section>
      ) : null}
    </main>
  );
}
