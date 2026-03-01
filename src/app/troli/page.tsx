"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import { formatRupiah } from "@/data/products";
import { readCart, removeFromCart, updateCartQuantity } from "@/lib/cart";
import { fetchStoreData } from "@/lib/store-client";
import type { StorePaymentSettings, StoreProduct } from "@/types/store";
import styles from "./page.module.css";

type CartLine = {
  slug: string;
  quantity: number;
  selected: boolean;
};

const TAX_RATE = 0.11;

const defaultPaymentSettings: StorePaymentSettings = {
  id: "main",
  title: "Qriss",
  qrisImageUrl: "/assets/qriss.jpg",
  instructionText:
    "Scan Qriss diatas ini untuk proses produk kamu. Pastikan benar-benar sudah membayar",
  expiryMinutes: 30,
  updatedAt: new Date().toISOString(),
};

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
  const [paymentSettings, setPaymentSettings] = useState<StorePaymentSettings>(defaultPaymentSettings);
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [query, setQuery] = useState("");
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false);
  const [hasScannedQris, setHasScannedQris] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [latestOrderId, setLatestOrderId] = useState<string | null>(null);
  const [latestOrderCreatedAt, setLatestOrderCreatedAt] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
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
        if (data.paymentSettings) {
          setPaymentSettings(data.paymentSettings);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!latestOrderCreatedAt) {
      setRemainingSeconds(0);
      return;
    }

    const deadline =
      new Date(latestOrderCreatedAt).getTime() + paymentSettings.expiryMinutes * 60 * 1000;
    const updateTimer = () => {
      const remain = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setRemainingSeconds(remain);
    };

    updateTimer();
    const timer = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timer);
  }, [latestOrderCreatedAt, paymentSettings.expiryMinutes]);

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
      setLatestOrderId(result.orderId ?? null);
      setLatestOrderCreatedAt(result.createdAt ?? new Date().toISOString());
      setHasScannedQris(false);
      setSuccess("Pesanan berhasil dibuat. Scan QRIS lalu konfirmasi pembayaran.");
    } catch {
      setError("Gagal memproses pesanan. Coba lagi.");
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const patchOrderStatus = async (nextStatus: "process" | "error") => {
    if (!latestOrderId) {
      return false;
    }

    const response = await fetch(`/api/orders/${latestOrderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(payload.message ?? "Gagal mengubah status transaksi.");
    }

    return true;
  };

  const onCancelPayment = async () => {
    setError("");
    setSuccess("");
    setIsStatusSubmitting(true);

    try {
      await patchOrderStatus("error");
      setHasScannedQris(false);
      setSuccess("Transaksi dibatalkan.");
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Gagal mengubah status transaksi.");
    } finally {
      setIsStatusSubmitting(false);
    }
  };

  const onConfirmPayment = async () => {
    setError("");
    setSuccess("");

    if (!latestOrderId) {
      setError("Order belum tersedia.");
      return;
    }

    if (!hasScannedQris) {
      setError("Centang dulu bahwa kamu sudah scan dan membayar QRIS.");
      return;
    }

    setIsStatusSubmitting(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 1400));
      await patchOrderStatus("process");
      setSuccess("Konfirmasi pembayaran dikirim. Cek status pemesanan di halaman status.");
      router.push(`/status-pemesanan?highlight=${latestOrderId}`);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Gagal mengonfirmasi pembayaran.");
    } finally {
      setIsStatusSubmitting(false);
    }
  };

  const countdownLabel = `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(
    remainingSeconds % 60,
  ).padStart(2, "0")}`;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Troli</h1>
        <Link href="/" className={styles.backLink}>
          Kembali belanja
        </Link>
      </header>

      {!isClient ? <p className={styles.loading}>Memuat troli...</p> : null}

      {isClient && detailedItems.length === 0 ? (
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

      {isClient && detailedItems.length > 0 ? (
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

            {latestOrderId ? (
              <section className={styles.paymentPanel}>
                <h4>{paymentSettings.title}</h4>
                <div className={styles.qrisImageWrap}>
                  <FlexibleMedia
                    src={paymentSettings.qrisImageUrl}
                    alt={paymentSettings.title}
                    fill
                    className={styles.qrisImage}
                    sizes="220px"
                    unoptimized
                  />
                </div>
                <span className={styles.timerLabel}>Batas waktu: {countdownLabel}</span>
                <p className={styles.paymentHint}>{paymentSettings.instructionText}</p>
                <label className={styles.scanCheck}>
                  <input
                    type="checkbox"
                    checked={hasScannedQris}
                    onChange={(event) => setHasScannedQris(event.target.checked)}
                    disabled={isStatusSubmitting}
                  />
                  Saya sudah scan QRIS dan melakukan pembayaran.
                </label>
                <div className={styles.paymentButtons}>
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.actionDanger}`}
                    disabled={isStatusSubmitting}
                    onClick={onCancelPayment}
                  >
                    {isStatusSubmitting ? "Memproses..." : "Batalkan Transaksi"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.actionPrimary}`}
                    disabled={isStatusSubmitting || !hasScannedQris}
                    onClick={onConfirmPayment}
                  >
                    {isStatusSubmitting ? "Mengonfirmasi..." : "Konfirmasi Pembayaran"}
                  </button>
                </div>
              </section>
            ) : null}
          </aside>
        </section>
      ) : null}
    </main>
  );
}
