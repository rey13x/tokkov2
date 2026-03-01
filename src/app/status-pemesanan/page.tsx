"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import WaitLoading from "@/components/ui/WaitLoading";
import { formatRupiah } from "@/data/products";
import type { OrderSummary } from "@/types/store";
import styles from "./page.module.css";

function statusLabel(status: string) {
  if (status === "done") {
    return "Habis";
  }
  if (status === "error") {
    return "Dikirim";
  }
  return "Proses";
}

function statusClass(status: string) {
  if (status === "done") {
    return styles.statusDone;
  }
  if (status === "error") {
    return styles.statusError;
  }
  return styles.statusProcess;
}

function ReceiptIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M7 3h10a2 2 0 0 1 2 2v15l-2.2-1.3L14.5 20l-2.5-1.3L9.5 20 7.2 18.7 5 20V5a2 2 0 0 1 2-2Zm0 2v11h10V5H7Zm1.5 2h7v1.6h-7V7Zm0 3h7v1.6h-7V10Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2H3V7Zm0 4h18v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Zm3.2 3.2v1.6h4.4v-1.6H6.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function StatusPemesananPage() {
  const router = useRouter();
  const { status } = useSession();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [highlightedOrderId, setHighlightedOrderId] = useState("");
  const [activePaymentOrderId, setActivePaymentOrderId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (status !== "authenticated") {
      return;
    }

    const response = await fetch("/api/orders", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Gagal memuat status pemesanan.");
    }

    const data = (await response.json()) as { orders?: OrderSummary[] };
    setOrders(data.orders ?? []);
  }, [status]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const highlight = params.get("highlight") ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlightedOrderId(highlight);
    if ((params.get("pay") === "1" || params.get("pay") === "true") && highlight) {
      setActivePaymentOrderId(highlight);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status !== "authenticated") {
      router.push("/auth?redirect=/status-pemesanan");
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders()
      .then(() => setError(""))
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Gagal memuat status pemesanan.");
      })
      .finally(() => setIsLoading(false));
  }, [loadOrders, router, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    const timer = window.setInterval(() => {
      loadOrders().catch(() => {});
    }, 8000);

    return () => window.clearInterval(timer);
  }, [loadOrders, status]);

  const totalBelanja = useMemo(
    () => orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    [orders],
  );

  const onDownloadReceipt = (orderId: string) => {
    window.open(`/api/orders/${orderId}/receipt`, "_blank", "noopener,noreferrer");
  };

  const closePaymentPopup = () => {
    setActivePaymentOrderId(null);
  };

  const activePaymentOrder = orders.find((order) => order.id === activePaymentOrderId) ?? null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brandWrap}>
          <Image src="/assets/logo.png" alt="Tokko" width={42} height={42} className={styles.logo} priority />
          <div>
            <h1>Status Pemesanan</h1>
            <p>Riwayat transaksi akun kamu</p>
          </div>
        </div>
        <Link href="/troli" className={styles.backLink}>
          Kembali ke Troli
        </Link>
      </header>

      <section className={styles.summaryCard}>
        <div>
          <span>Total pesanan</span>
          <strong>{orders.length}</strong>
        </div>
        <div>
          <span>Total belanja</span>
          <strong>{formatRupiah(totalBelanja)}</strong>
        </div>
      </section>

      {isLoading ? <WaitLoading centered /> : null}
      {error ? <p className={styles.errorText}>{error}</p> : null}

      <section className={styles.listWrap}>
        {orders.map((order) => {
          const isHighlighted = highlightedOrderId === order.id;
          return (
            <article
              key={order.id}
              className={`${styles.orderCard} ${isHighlighted ? styles.orderCardHighlighted : ""}`}
            >
              <div className={styles.orderMain}>
                <p className={styles.orderId}>{order.id}</p>
                <span className={styles.orderDate}>{new Date(order.createdAt).toLocaleString("id-ID")}</span>
                <span className={`${styles.statusBadge} ${statusClass(order.status)}`}>
                  {statusLabel(order.status)}
                </span>
              </div>
              <div className={styles.orderMeta}>
                <span>Akun: {order.userName}</span>
                <span>Email: {order.userEmail}</span>
                <span>HP: {order.userPhone || "-"}</span>
                <strong>Total: {formatRupiah(order.total)}</strong>
              </div>
              <div className={styles.actionIcons}>
                <button
                  type="button"
                  className={styles.payIconButton}
                  onClick={() => setActivePaymentOrderId(order.id)}
                  title="Lihat QRIS pembayaran"
                  aria-label={`Lihat QRIS pembayaran order ${order.id}`}
                >
                  <PaymentIcon />
                </button>
                <button
                  type="button"
                  className={styles.receiptIconButton}
                  onClick={() => onDownloadReceipt(order.id)}
                  title="Download struk"
                  aria-label={`Download struk order ${order.id}`}
                >
                  <ReceiptIcon />
                </button>
              </div>
            </article>
          );
        })}
        {!isLoading && orders.length === 0 ? <p className={styles.emptyText}>Belum ada pesanan.</p> : null}
      </section>

      {activePaymentOrder ? (
        <div className={styles.popupOverlay} onClick={closePaymentPopup}>
          <section className={styles.popupCard} onClick={(event) => event.stopPropagation()}>
            <h2>QRIS Pembayaran</h2>
            <p className={styles.popupMeta}>Order: {activePaymentOrder.id}</p>
            <div className={styles.popupQrWrap}>
              <Image
                src="/assets/qris.jpg"
                alt="QRIS Pembayaran"
                fill
                className={styles.popupQrImage}
                sizes="260px"
                priority
              />
            </div>
            <p className={styles.popupHelp}>
              Scan QRIS lalu simpan bukti transfer. Status order kamu akan tetap dipantau admin.
            </p>
            <button type="button" className={styles.popupCloseButton} onClick={closePaymentPopup}>
              Tutup
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
