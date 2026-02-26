"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { formatRupiah } from "@/data/products";
import {
  readCart,
  removeFromCart,
  updateCartQuantity,
} from "@/lib/cart";
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
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    let mounted = true;
    fetchStoreData()
      .then((data) => {
        if (mounted) {
          setProducts(data.products);
        }
      })
      .catch(() => {});

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

      const result = (await response.json()) as { message?: string; orderId?: string };
      if (!response.ok) {
        setError(result.message ?? "Checkout gagal.");
        return;
      }

      for (const item of selected) {
        removeFromCart(item.slug);
      }

      setCartLines((current) => current.filter((item) => !item.selected));
      setSuccess(
        `Checkout berhasil. Order ID: ${result.orderId ?? "-"} (notifikasi Telegram dikirim jika env aktif).`,
      );
    } catch {
      setError("Checkout gagal. Coba lagi.");
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>SHOPPING CART</h1>
        <Link href="/" className={styles.backLink}>
          Kembali belanja
        </Link>
      </header>

      {!isClient ? <p className={styles.loading}>Memuat troli...</p> : null}

      {isClient && detailedItems.length === 0 ? (
        <section className={styles.emptyState}>
          <h2>Troli masih kosong</h2>
          <p>Pilih produk dulu dari halaman katalog.</p>
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
            {detailedItems.map((item) => (
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
                  <Image
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
                  <p className={styles.metaLineMuted}>NON REFUNDABLE</p>
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
            ))}
          </div>

          <aside className={styles.summaryPanel}>
            <h3>ORDER SUMMARY</h3>
            <div className={styles.summaryRow}>
              <span>Subtotal</span>
              <strong>{formatRupiah(subtotal)}</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Tax</span>
              <strong>{formatRupiah(tax)}</strong>
            </div>
            <hr />
            <div className={styles.summaryRowTotal}>
              <span>Total</span>
              <strong>{formatRupiah(total)}</strong>
            </div>
            <button
              type="button"
              className={styles.checkoutButton}
              disabled={subtotal <= 0 || isCheckoutLoading}
              onClick={onCheckout}
            >
              {isCheckoutLoading ? "Processing..." : "Checkout"}
            </button>
          </aside>
        </section>
      ) : null}
    </main>
  );
}

