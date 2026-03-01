"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { CallBackProps, Step } from "react-joyride";
import AppOnboardingJoyride from "@/components/onboarding/AppOnboardingJoyride";
import WaitLoading from "@/components/ui/WaitLoading";
import { formatRupiah } from "@/data/products";
import {
  ONBOARDING_STAGE,
  ONBOARDING_TUTORIAL_ORDER_ID,
  ONBOARDING_TUTORIAL_QUERY_KEY,
  advanceOnboarding,
  completeOnboarding,
  getOnboardingState,
  isOnboardingStageActive,
  type OnboardingStage,
} from "@/lib/onboarding";
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

const ADMIN_WHATSAPP_URL = "https://wa.me/6281319865384";
const STATUS_ONBOARDING_STAGES: OnboardingStage[] = [
  ONBOARDING_STAGE.STATUS_PAYMENT_OR_RECEIPT,
  ONBOARDING_STAGE.STATUS_CANCEL_REASON,
  ONBOARDING_STAGE.STATUS_CANCEL_SUBMIT,
];

function formatStatusDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("id-ID");
}

export default function StatusPemesananPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [highlightedOrderId, setHighlightedOrderId] = useState("");
  const [isTutorialMode, setIsTutorialMode] = useState(false);
  const [activePaymentOrderId, setActivePaymentOrderId] = useState<string | null>(null);
  const [cancelReasonDrafts, setCancelReasonDrafts] = useState<Record<string, string>>({});
  const [isCancelSubmittingOrderId, setIsCancelSubmittingOrderId] = useState<string | null>(null);
  const [statusTutorialStage, setStatusTutorialStage] = useState<OnboardingStage | null>(null);

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
    const tutorialEnabled = params.get(ONBOARDING_TUTORIAL_QUERY_KEY) === "1";
    setIsTutorialMode(tutorialEnabled);
    setHighlightedOrderId(highlight);
    if (tutorialEnabled && !highlight) {
      setHighlightedOrderId(ONBOARDING_TUTORIAL_ORDER_ID);
    }
    if (
      (params.get("pay") === "1" || params.get("pay") === "true") &&
      highlight &&
      !isOnboardingStageActive(ONBOARDING_STAGE.STATUS_PAYMENT_OR_RECEIPT)
    ) {
      setActivePaymentOrderId(highlight);
    }
  }, []);

  useEffect(() => {
    const currentState = getOnboardingState();
    if (!currentState.active || !STATUS_ONBOARDING_STAGES.includes(currentState.stage)) {
      setStatusTutorialStage(null);
      return;
    }

    setStatusTutorialStage(currentState.stage);
  }, [orders.length, highlightedOrderId, cancelReasonDrafts]);

  useEffect(() => {
    if (
      activePaymentOrderId &&
      (statusTutorialStage === ONBOARDING_STAGE.STATUS_CANCEL_REASON ||
        statusTutorialStage === ONBOARDING_STAGE.STATUS_CANCEL_SUBMIT)
    ) {
      setActivePaymentOrderId(null);
    }
  }, [activePaymentOrderId, statusTutorialStage]);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status !== "authenticated") {
      router.push("/auth?redirect=/status-pemesanan");
      return;
    }

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

  const tutorialOrder = useMemo<OrderSummary>(
    () => ({
      id: ONBOARDING_TUTORIAL_ORDER_ID,
      userName:
        session?.user?.username?.trim() ||
        session?.user?.name?.trim() ||
        "Pengguna Tutorial",
      userEmail: session?.user?.email?.trim() || "tutorial@tokko.local",
      userPhone: "-",
      total: 5000,
      status: "process",
      cancelRequestStatus: "none",
      cancelRequestReason: "",
      cancelRequestedAt: null,
      cancelConfirmedAt: null,
      createdAt: "2026-03-01T12:00:00.000Z",
      items: [
        {
          id: "tutorial-item-1",
          orderId: ONBOARDING_TUTORIAL_ORDER_ID,
          productId: "tutorial-product",
          productName: "Paket Tutorial",
          productDuration: "-",
          quantity: 1,
          unitPrice: 5000,
        },
      ],
    }),
    [session?.user?.email, session?.user?.name, session?.user?.username],
  );

  const displayOrders = useMemo(() => {
    const withoutTutorial = orders.filter((order) => order.id !== ONBOARDING_TUTORIAL_ORDER_ID);
    if (!isTutorialMode) {
      return withoutTutorial;
    }
    return [tutorialOrder, ...withoutTutorial];
  }, [orders, isTutorialMode, tutorialOrder]);

  const displayTotalBelanja = useMemo(
    () => displayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    [displayOrders],
  );

  const onDownloadReceipt = (orderId: string) => {
    if (isOnboardingStageActive(ONBOARDING_STAGE.STATUS_PAYMENT_OR_RECEIPT)) {
      advanceOnboarding(ONBOARDING_STAGE.STATUS_CANCEL_REASON);
      setStatusTutorialStage(ONBOARDING_STAGE.STATUS_CANCEL_REASON);
    }
    if (orderId === ONBOARDING_TUTORIAL_ORDER_ID) {
      setSuccess("Mode tutorial: ini simulasi struk, tidak ada data yang disimpan.");
      return;
    }
    window.open(`/api/orders/${orderId}/receipt`, "_blank", "noopener,noreferrer");
  };

  const onOpenPayment = (orderId: string) => {
    if (isOnboardingStageActive(ONBOARDING_STAGE.STATUS_PAYMENT_OR_RECEIPT)) {
      advanceOnboarding(ONBOARDING_STAGE.STATUS_CANCEL_REASON);
      setStatusTutorialStage(ONBOARDING_STAGE.STATUS_CANCEL_REASON);
    }
    setActivePaymentOrderId(orderId);
  };

  const closePaymentPopup = () => {
    setActivePaymentOrderId(null);
  };

  const onChangeCancelReason = (orderId: string, value: string) => {
    setCancelReasonDrafts((current) => ({
      ...current,
      [orderId]: value,
    }));

    if (
      value.trim().length >= 5 &&
      isOnboardingStageActive(ONBOARDING_STAGE.STATUS_CANCEL_REASON)
    ) {
      advanceOnboarding(ONBOARDING_STAGE.STATUS_CANCEL_SUBMIT);
      setStatusTutorialStage(ONBOARDING_STAGE.STATUS_CANCEL_SUBMIT);
    }
  };

  const onRequestCancelViaWhatsapp = async (order: OrderSummary) => {
    const reason = (cancelReasonDrafts[order.id] ?? "").trim();
    if (reason.length < 5) {
      setError("Alasan pembatalan minimal 5 karakter.");
      return;
    }

    setError("");
    setSuccess("");

    if (getOnboardingState().active) {
      if (isOnboardingStageActive(ONBOARDING_STAGE.STATUS_CANCEL_SUBMIT)) {
        completeOnboarding();
        setStatusTutorialStage(null);
      }
      setIsTutorialMode(false);
      setHighlightedOrderId("");
      setActivePaymentOrderId(null);
      setSuccess("Tutorial selesai. Mode normal aktif kembali, transaksi berikutnya masuk database.");
      router.replace("/status-pemesanan");
      return;
    }

    setIsCancelSubmittingOrderId(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}/cancel-request`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const payload = (await response.json()) as { message?: string; order?: OrderSummary };
      if (!response.ok) {
        setError(payload.message ?? "Gagal mengajukan pembatalan pesanan.");
        return;
      }

      const updatedOrder = payload.order ?? order;
      const itemLines =
        updatedOrder.items && updatedOrder.items.length > 0
          ? updatedOrder.items
              .map(
                (item, index) =>
                  `${index + 1}. ${item.productName} x${item.quantity} - ${formatRupiah(
                    item.unitPrice * item.quantity,
                  )}`,
              )
              .join("\n")
          : "-";
      const message = [
        "*PERMINTAAN KONFIRMASI PEMBATALAN PEMESANAN*",
        "",
        `Waktu Request: ${new Date().toLocaleString("id-ID")}`,
        `Order ID: ${updatedOrder.id}`,
        `Akun: ${updatedOrder.userName}`,
        `Gmail: ${updatedOrder.userEmail}`,
        `Nomor HP: ${updatedOrder.userPhone || "-"}`,
        `Status Order Saat Ini: ${statusLabel(updatedOrder.status)}`,
        "",
        "*Produk yang Dibeli:*",
        itemLines,
        "",
        "*Alasan Pembatalan:*",
        reason,
        "",
        "Mohon konfirmasi admin. Order dibatalkan setelah admin menyetujui request ini.",
      ].join("\n");
      const waUrl = `${ADMIN_WHATSAPP_URL}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, "_blank", "noopener,noreferrer");

      if (isOnboardingStageActive(ONBOARDING_STAGE.STATUS_CANCEL_SUBMIT)) {
        completeOnboarding();
        setStatusTutorialStage(null);
      }

      setSuccess("Request pembatalan tersimpan. Lanjutkan konfirmasi via WhatsApp.");
      await loadOrders();
    } catch {
      setError("Gagal mengajukan pembatalan pesanan.");
    } finally {
      setIsCancelSubmittingOrderId(null);
    }
  };

  const activePaymentOrder = displayOrders.find((order) => order.id === activePaymentOrderId) ?? null;
  const onboardingTargetOrderId = useMemo(() => {
    if (highlightedOrderId && displayOrders.some((order) => order.id === highlightedOrderId)) {
      return highlightedOrderId;
    }
    return displayOrders[0]?.id || "";
  }, [highlightedOrderId, displayOrders]);
  const onboardingTargetSelectors = useMemo(() => {
    if (!onboardingTargetOrderId) {
      return {
        actionIcons: "[data-onboarding='status-action-icons']",
        cancelReason: "[data-onboarding='status-cancel-reason']",
        cancelSubmit: "[data-onboarding='status-cancel-submit']",
      };
    }

    return {
      actionIcons: `#status-action-icons-${onboardingTargetOrderId}`,
      cancelReason: `#status-cancel-reason-${onboardingTargetOrderId}`,
      cancelSubmit: `#status-cancel-submit-${onboardingTargetOrderId}`,
    };
  }, [onboardingTargetOrderId]);

  useEffect(() => {
    if (!statusTutorialStage) {
      return;
    }

    const selectorByStage: Partial<Record<OnboardingStage, string>> = {
      [ONBOARDING_STAGE.STATUS_PAYMENT_OR_RECEIPT]: onboardingTargetSelectors.actionIcons,
      [ONBOARDING_STAGE.STATUS_CANCEL_REASON]: onboardingTargetSelectors.cancelReason,
      [ONBOARDING_STAGE.STATUS_CANCEL_SUBMIT]: onboardingTargetSelectors.cancelSubmit,
    };
    const targetSelector = selectorByStage[statusTutorialStage];
    if (!targetSelector) {
      return;
    }

    const timer = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(targetSelector);
      if (!target) {
        return;
      }
      target.scrollIntoView({
        behavior: "smooth",
        block:
          statusTutorialStage === ONBOARDING_STAGE.STATUS_CANCEL_REASON ? "start" : "center",
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [statusTutorialStage, onboardingTargetOrderId, displayOrders.length, onboardingTargetSelectors]);

  const statusTutorialSteps: Step[] = useMemo(() => {
    if (statusTutorialStage === ONBOARDING_STAGE.STATUS_PAYMENT_OR_RECEIPT) {
      return [
        {
          target: onboardingTargetSelectors.actionIcons,
          content: "Pilih salah satu: ikon pembayaran atau ikon struk.",
          placement: "left",
          disableBeacon: true,
          hideFooter: true,
        },
      ];
    }

    if (statusTutorialStage === ONBOARDING_STAGE.STATUS_CANCEL_REASON) {
      return [
        {
          target: onboardingTargetSelectors.cancelReason,
          content: "Isi alasan pembatalan dulu (minimal 5 karakter) untuk lanjut.",
          placement: "bottom",
          offset: 14,
          floaterProps: {
            options: {
              flip: {
                enabled: false,
              },
            },
          },
          disableBeacon: true,
          hideFooter: true,
        },
      ];
    }

    if (statusTutorialStage === ONBOARDING_STAGE.STATUS_CANCEL_SUBMIT) {
      return [
        {
          target: onboardingTargetSelectors.cancelSubmit,
          content: "Klik Ajukan Batal & Kirim WhatsApp untuk menyelesaikan tutorial.",
          placement: "top",
          disableBeacon: true,
          hideFooter: true,
        },
      ];
    }

    return [];
  }, [statusTutorialStage, onboardingTargetSelectors]);

  const onStatusTutorialCallback = (payload: CallBackProps) => {
    if (payload.type === "error:target_not_found") {
      setStatusTutorialStage(null);
    }
  };

  return (
    <main className={styles.page}>
      <AppOnboardingJoyride
        run={Boolean(statusTutorialStage && onboardingTargetOrderId)}
        steps={statusTutorialSteps}
        onCallback={onStatusTutorialCallback}
      />
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
          <strong>{displayOrders.length}</strong>
        </div>
        <div>
          <span>Total belanja</span>
          <strong>{formatRupiah(displayTotalBelanja)}</strong>
        </div>
      </section>

      {isLoading ? <WaitLoading centered /> : null}
      {error ? <p className={styles.errorText}>{error}</p> : null}
      {success ? <p className={styles.successText}>{success}</p> : null}

      <section className={styles.listWrap}>
        {displayOrders.map((order) => {
          const isHighlighted = highlightedOrderId === order.id;
          const isOnboardingTargetOrder = onboardingTargetOrderId === order.id;
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
                <span>
                  Pembatalan:{" "}
                  {order.cancelRequestStatus === "confirmed"
                    ? "Disetujui admin"
                    : order.cancelRequestStatus === "requested"
                      ? "Menunggu konfirmasi admin"
                      : "Belum diajukan"}
                </span>
                {order.cancelRequestStatus === "requested" ? (
                  <span>Waktu request: {formatStatusDate(order.cancelRequestedAt)}</span>
                ) : null}
                {order.cancelRequestStatus === "confirmed" ? (
                  <span>Waktu konfirmasi: {formatStatusDate(order.cancelConfirmedAt)}</span>
                ) : null}
              </div>
              {order.cancelRequestStatus !== "confirmed" ? (
                <div className={styles.cancelRequestBox}>
                  <textarea
                    value={cancelReasonDrafts[order.id] ?? ""}
                    onChange={(event) => onChangeCancelReason(order.id, event.target.value)}
                    onInput={(event) =>
                      onChangeCancelReason(order.id, (event.target as HTMLTextAreaElement).value)
                    }
                    placeholder="Tulis alasan pembatalan (wajib)"
                    spellCheck={false}
                    data-onboarding={isOnboardingTargetOrder ? "status-cancel-reason" : undefined}
                    id={isOnboardingTargetOrder ? `status-cancel-reason-${order.id}` : undefined}
                  />
                  <button
                    type="button"
                    className={styles.cancelRequestButton}
                    disabled={isCancelSubmittingOrderId === order.id}
                    onClick={() => onRequestCancelViaWhatsapp(order)}
                    data-onboarding={isOnboardingTargetOrder ? "status-cancel-submit" : undefined}
                    id={isOnboardingTargetOrder ? `status-cancel-submit-${order.id}` : undefined}
                  >
                    {isCancelSubmittingOrderId === order.id
                      ? "Mengirim..."
                      : "Ajukan Batal & Kirim WhatsApp"}
                  </button>
                </div>
              ) : null}
              <div
                className={styles.actionIcons}
                data-onboarding={isOnboardingTargetOrder ? "status-action-icons" : undefined}
                id={isOnboardingTargetOrder ? `status-action-icons-${order.id}` : undefined}
              >
                <button
                  type="button"
                  className={styles.payIconButton}
                  onClick={() => onOpenPayment(order.id)}
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
        {!isLoading && displayOrders.length === 0 ? <p className={styles.emptyText}>Belum ada pesanan.</p> : null}
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
