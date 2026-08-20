"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { CallBackProps, Step } from "react-joyride";
// @ts-expect-error - qrcode.react does not ship complete React 19 types in this project.
import QRCode from "qrcode.react";
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

function statusGroup(status: string) {
  if (status === "paid") {
    return "paid";
  }
  if (["done", "delivered", "sent"].includes(status)) {
    return "done";
  }
  if (["error", "rejected", "declined", "failed", "cancelled"].includes(status)) {
    return "error";
  }
  return "process";
}

function statusLabel(status: string) {
  if (status === "cancelled") {
    return "Dibatalkan";
  }
  if (statusGroup(status) === "paid") {
    return "Sudah Bayar";
  }
  if (statusGroup(status) === "done") {
    return "Sudah Bayar";
  }
  if (statusGroup(status) === "error") {
    return "Belum Bayar";
  }
  return "Sedang diproses";
}

function statusClass(status: string) {
  if (["paid", "done", "delivered", "sent"].includes(status)) {
    return styles.statusDone;
  }
  if (statusGroup(status) === "error") {
    return styles.statusError;
  }
  return styles.statusProcess;
}

function isPaymentExpired(order: OrderSummary) {
  if (!order.paymentExpiresAt) {
    return false;
  }

  const expiresAt = new Date(order.paymentExpiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
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

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 7h12l-1 14H7L6 7Zm3-4h6l1 2H8l1-2ZM4 5h16v2H4V5Z" fill="currentColor" />
    </svg>
  );
}

const ADMIN_WHATSAPP_URL = "https://wa.me/6281319865384";
const CONFIRMATION_WHATSAPP_NUMBER = "6285121579597";
const STATUS_ONBOARDING_STAGES: OnboardingStage[] = [
  ONBOARDING_STAGE.STATUS_PAYMENT_OR_RECEIPT,
  ONBOARDING_STAGE.STATUS_OPEN_PAYMENT,
  ONBOARDING_STAGE.STATUS_CLOSE_PAYMENT,
  ONBOARDING_STAGE.STATUS_OPEN_RECEIPT,
  ONBOARDING_STAGE.STATUS_RECEIPT_BACK_TO_CART,
  ONBOARDING_STAGE.STATUS_CANCEL_REASON,
  ONBOARDING_STAGE.STATUS_CANCEL_SUBMIT,
  ONBOARDING_STAGE.STATUS_SUCCESS,
  ONBOARDING_STAGE.STATUS_FINISH,
];

function formatStatusDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("id-ID");
}

function countWords(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export default function StatusPemesananPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [jobApplications, setJobApplications] = useState<Array<{ id: string; product_name: string; created_at: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [highlightedOrderId, setHighlightedOrderId] = useState("");
  const [isTutorialMode, setIsTutorialMode] = useState(false);
  const [activePaymentOrderId, setActivePaymentOrderId] = useState<string | null>(null);
  const [showTutorialReceiptModal, setShowTutorialReceiptModal] = useState(false);
  const [cancelReasonDrafts, setCancelReasonDrafts] = useState<Record<string, string>>({});
  const [isCancelSubmittingOrderId, setIsCancelSubmittingOrderId] = useState<string | null>(null);
  const [confirmationNotes, setConfirmationNotes] = useState<Record<string, string>>({});
  const [isConfirmationSubmittingOrderId, setIsConfirmationSubmittingOrderId] = useState<string | null>(null);
  const [isDeletingOrderId, setIsDeletingOrderId] = useState<string | null>(null);
  const [showCancellationSuccess, setShowCancellationSuccess] = useState(false);
  const [showHistoryCleaner, setShowHistoryCleaner] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<"all" | "process" | "done" | "error">("all");
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [isPreparingPaymentOrderId, setIsPreparingPaymentOrderId] = useState<string | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [paymentCheckCooldown, setPaymentCheckCooldown] = useState(30);
  const [paymentSuccessPopup, setPaymentSuccessPopup] = useState<{ amount: number } | null>(null);
  const knownPaymentStatusesRef = useRef<Record<string, string>>({});
  const [isClosingPayment, setIsClosingPayment] = useState(false);
  const [paymentSecondsLeft, setPaymentSecondsLeft] = useState<number | null>(null);
  const [statusTutorialStage, setStatusTutorialStage] = useState<OnboardingStage | null>(null);
  const summaryCardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isLoading || typeof window === "undefined") {
      return;
    }

    const summaryCard = summaryCardRef.current;
    if (!summaryCard || window.matchMedia("(min-width: 721px)").matches || summaryCard.scrollWidth <= summaryCard.clientWidth) {
      return;
    }

    const startTimer = window.setTimeout(() => {
      summaryCard.scrollTo({ left: summaryCard.scrollWidth - summaryCard.clientWidth, behavior: "smooth" });
      window.setTimeout(() => {
        summaryCard.scrollTo({ left: 0, behavior: "smooth" });
      }, 2200);
    }, 500);

    return () => window.clearTimeout(startTimer);
  }, [isLoading]);

  const loadOrders = useCallback(async () => {
    if (status !== "authenticated") {
      return;
    }

    const response = await fetch("/api/orders", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Gagal memuat status pemesanan.");
    }

    const data = (await response.json()) as { orders?: OrderSummary[] };
    const nextOrders = data.orders ?? [];
    nextOrders.forEach((order) => {
      const previousStatus = knownPaymentStatusesRef.current[order.id];
      if (previousStatus && previousStatus !== "paid" && order.status === "paid") {
        window.setTimeout(() => {
          setPaymentSuccessPopup({ amount: Number(order.totalAmount || order.total || 0) });
        }, 4000);
      }
      knownPaymentStatusesRef.current[order.id] = order.status;
    });
    setOrders(nextOrders);
  }, [status]);

  const loadJobApplications = useCallback(async () => {
    if (status !== "authenticated") {
      return;
    }

    try {
      const response = await fetch("/api/job-applications", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { applications?: Array<{ id: string; product_name: string; created_at: string }> };
        setJobApplications(data.applications ?? []);
      }
    } catch (err) {
      console.error("Failed to load job applications:", err);
    }
  }, [status]);

  const syncPendingPaymentStatuses = useCallback(async () => {
    const paymentOrders = orders.filter((order) => order.depositId && !["paid", "sent", "cancelled"].includes(order.status));
    if (paymentOrders.length === 0) {
      return;
    }

    const paidOrders = await Promise.all(
      paymentOrders.map(async (order) => {
        try {
          const response = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: order.id, depositId: order.depositId }),
          });
          if (!response.ok) {
            return null;
          }

          const result = (await response.json()) as { status?: string; order?: OrderSummary };
          return result.status === "success" ? result.order ?? null : null;
        } catch {
          return null;
        }
      }),
    );

    const successfulOrders = paidOrders.filter((order): order is OrderSummary => Boolean(order));
    if (successfulOrders.length === 0) {
      return;
    }

    setOrders((current) => current.map((order) => {
      const updated = successfulOrders.find((paidOrder) => paidOrder.id === order.id);
      return updated ?? order;
    }));
  }, [orders]);

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
      !getOnboardingState().active
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

    if (currentState.stage === ONBOARDING_STAGE.STATUS_PAYMENT_OR_RECEIPT) {
      setStatusTutorialStage(ONBOARDING_STAGE.STATUS_OPEN_PAYMENT);
      return;
    }

    setStatusTutorialStage(currentState.stage);
  }, [orders.length, highlightedOrderId, cancelReasonDrafts]);

  useEffect(() => {
    if (
      activePaymentOrderId &&
      (statusTutorialStage === ONBOARDING_STAGE.STATUS_CANCEL_REASON ||
        statusTutorialStage === ONBOARDING_STAGE.STATUS_CANCEL_SUBMIT ||
        statusTutorialStage === ONBOARDING_STAGE.STATUS_SUCCESS ||
        statusTutorialStage === ONBOARDING_STAGE.STATUS_FINISH)
    ) {
      setActivePaymentOrderId(null);
    }
  }, [activePaymentOrderId, statusTutorialStage]);

  useEffect(() => {
    if (statusTutorialStage !== ONBOARDING_STAGE.STATUS_FINISH) {
      return;
    }

    const timer = window.setTimeout(() => {
      completeOnboarding();
      setStatusTutorialStage(null);
      setIsTutorialMode(false);
      setShowTutorialReceiptModal(false);
      window.location.assign("/");
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [statusTutorialStage]);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status !== "authenticated") {
      const onboardingActive = getOnboardingState().active;
      const tutorialFromQuery =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get(ONBOARDING_TUTORIAL_QUERY_KEY) === "1";
      if (onboardingActive || tutorialFromQuery) {
        setIsLoading(false);
        setError("");
        return;
      }
      router.push("/auth?redirect=/status-pemesanan");
      return;
    }

    loadOrders()
      .then(() => setError(""))
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Gagal memuat status pemesanan.");
      })
      .finally(() => setIsLoading(false));

    loadJobApplications();
  }, [loadOrders, loadJobApplications, router, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    const timer = window.setInterval(() => {
      loadOrders().catch(() => {});
      loadJobApplications();
      syncPendingPaymentStatuses().catch(() => {});
    }, 8000);

    return () => window.clearInterval(timer);
  }, [loadOrders, loadJobApplications, status, syncPendingPaymentStatuses]);

  useEffect(() => {
    if (status === "authenticated") {
      syncPendingPaymentStatuses().catch(() => {});
    }
  }, [status, syncPendingPaymentStatuses]);

  useEffect(() => {
    if (status !== "authenticated" || orders.length === 0) {
      return;
    }

    const expiredOrders = orders.filter((order) => {
      if (order.id === activePaymentOrderId || ["paid", "sent", "cancelled"].includes(order.status) || !order.paymentExpiresAt) {
        return false;
      }

      const expiresAt = new Date(order.paymentExpiresAt).getTime();
      return Number.isFinite(expiresAt) && expiresAt <= Date.now();
    });

    if (expiredOrders.length === 0) {
      return;
    }

    let cancelled = false;
    let cleanupStarted = false;
    const removeExpiredOrders = async () => {
      if (cleanupStarted) {
        return;
      }
      cleanupStarted = true;
      const removedOrderIds: string[] = [];

      for (const order of expiredOrders) {
        try {
          if (order.depositId) {
            const verifyResponse = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: order.id, depositId: order.depositId }),
            });
            const verifyResult = (await verifyResponse.json()) as { status?: string; order?: OrderSummary };
            if (verifyResult.status === "success") {
              if (!cancelled && verifyResult.order) {
                setOrders((current) => current.map((item) => item.id === order.id ? verifyResult.order! : item));
              }
              continue;
            }
          }

          const deleteResponse = await fetch(`/api/orders/${order.id}/delete`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
          });
          if (deleteResponse.ok) {
            removedOrderIds.push(order.id);
          }
        } catch {
          // Keep the order visible so a later page poll can retry the cleanup.
        }
      }

      if (cancelled || removedOrderIds.length === 0) {
        return;
      }

      setOrders((current) => current.filter((order) => !removedOrderIds.includes(order.id)));
      if (removedOrderIds.includes(activePaymentOrderId ?? "")) {
        setActivePaymentOrderId(null);
      }
      setSuccess("Waktu QRIS habis, jadi pesanan yang belum dibayar sudah dihapus ya.");
    };

    void removeExpiredOrders();
    const expiryTimer = window.setInterval(() => void removeExpiredOrders(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(expiryTimer);
    };
  }, [activePaymentOrderId, orders, status]);

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

  const donationHistory = useMemo(
    () => displayOrders
      .filter((order) => order.status === "paid")
      .flatMap((order) => (order.items ?? [])
        .filter((item) => item.productType === "donation")
        .map((item) => ({
          order,
          item,
          amount: item.donationAmount ?? item.unitPrice * item.quantity,
        }))),
    [displayOrders],
  );

  const historyCandidates = useMemo(
    () => displayOrders.filter((order) => statusGroup(order.status) !== "paid"),
    [displayOrders],
  );

  const filteredHistoryCandidates = useMemo(
    () => historyCandidates.filter((order) => historyFilter === "all" || statusGroup(order.status) === historyFilter),
    [historyCandidates, historyFilter],
  );

  const toggleHistorySelection = (orderId: string) => {
    setSelectedHistoryIds((current) =>
      current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId],
    );
  };

  const selectAllFilteredHistory = () => {
    const filteredIds = filteredHistoryCandidates.map((order) => order.id);
    setSelectedHistoryIds((current) => [
      ...current.filter((id) => !filteredIds.includes(id)),
      ...filteredIds,
    ]);
  };

  const clearSelectedHistory = async () => {
    if (selectedHistoryIds.length === 0) {
      return;
    }

    setIsClearingHistory(true);
    setError("");
    try {
      const response = await fetch("/api/orders/clear-history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedHistoryIds, status: historyFilter }),
      });
      const result = (await response.json()) as { message?: string; deletedIds?: string[] };
      if (!response.ok) {
        throw new Error(result.message ?? "Gagal membersihkan riwayat pemesanan.");
      }

      const deletedIds = result.deletedIds ?? [];
      setOrders((current) => current.filter((order) => !deletedIds.includes(order.id)));
      setSelectedHistoryIds([]);
      setShowHistoryCleaner(false);
      setSuccess(`${deletedIds.length} riwayat pemesanan berhasil dihapus.`);
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Gagal membersihkan riwayat pemesanan.");
    } finally {
      setIsClearingHistory(false);
    }
  };

  const displayTotalBelanja = useMemo(
    () => displayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    [displayOrders],
  );

  const orderStatusCounts = useMemo(
    () => ({
      process: displayOrders.filter((order) => statusGroup(order.status) === "process").length,
      done: displayOrders.filter((order) => statusGroup(order.status) === "done").length,
      error: displayOrders.filter((order) => statusGroup(order.status) === "error").length,
    }),
    [displayOrders],
  );

  const onDownloadReceipt = async (orderId: string) => {
    const onboardingState = getOnboardingState();
    if (
      onboardingState.active &&
      (onboardingState.stage === ONBOARDING_STAGE.STATUS_OPEN_RECEIPT ||
        onboardingState.stage === ONBOARDING_STAGE.STATUS_PAYMENT_OR_RECEIPT)
    ) {
      setShowTutorialReceiptModal(true);
      advanceOnboarding(ONBOARDING_STAGE.STATUS_RECEIPT_BACK_TO_CART);
      setStatusTutorialStage(ONBOARDING_STAGE.STATUS_RECEIPT_BACK_TO_CART);
      setSuccess("Struk tutorial tampil. Lanjutkan sesuai arahan onboarding.");
      return;
    }
    if (orderId === ONBOARDING_TUTORIAL_ORDER_ID) {
      setSuccess("Mode tutorial: ini simulasi struk, tidak ada data yang disimpan.");
      return;
    }
    try {
      const response = await fetch(`/api/orders/${orderId}/receipt`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Receipt download failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `struk-${orderId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Struk belum berhasil diunduh. Coba lagi sebentar.");
    }
  };

  const onCancelJobApplication = async (applicationId: string) => {
    if (!window.confirm("Yakin ingin membatalkan lamaran pekerjaan ini?")) {
      return;
    }

    try {
      const response = await fetch("/api/job-applications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });

      if (!response.ok) {
        const error = await response.json();
        setError(error.message ?? "Gagal membatalkan lamaran.");
        return;
      }

      setSuccess("Lamaran berhasil dibatalkan.");
      await loadJobApplications();
    } catch (err) {
      setError("Gagal membatalkan lamaran.");
      console.error("Failed to cancel job application:", err);
    }
  };

  const onOpenPayment = async (orderId: string) => {
    const onboardingState = getOnboardingState();
    if (
      onboardingState.active &&
      (onboardingState.stage === ONBOARDING_STAGE.STATUS_OPEN_PAYMENT ||
        onboardingState.stage === ONBOARDING_STAGE.STATUS_PAYMENT_OR_RECEIPT)
    ) {
      advanceOnboarding(ONBOARDING_STAGE.STATUS_CLOSE_PAYMENT);
      setStatusTutorialStage(ONBOARDING_STAGE.STATUS_CLOSE_PAYMENT);
    }
    const order = displayOrders.find((item) => item.id === orderId);
    if (!order) return;

    if (order.qrCode || order.qrImage) {
      setPaymentCheckCooldown(30);
      if (order.status !== "paid" && order.status !== "sent") {
      setActivePaymentOrderId(orderId);
      }
      return;
    }

    setIsPreparingPaymentOrderId(orderId);
    setActivePaymentOrderId(orderId);
    setError("");
    try {
      const response = await fetch(`/api/payments/orders/${orderId}/qris`, { method: "POST" });
      const result = (await response.json()) as {
        error?: string;
        qrCode?: string;
        qrImage?: string;
        depositId?: string;
        totalAmount?: number;
        uniqueCode?: number;
        expiredAt?: string;
      };
      if (!response.ok || (!result.qrCode && !result.qrImage)) {
        throw new Error("QRIS belum berhasil dimuat.");
      }

      setOrders((current) => current.map((item) => item.id === orderId
        ? {
            ...item,
            qrCode: result.qrCode,
            qrImage: result.qrImage,
            depositId: result.depositId,
            totalAmount: result.totalAmount,
            uniqueCode: result.uniqueCode,
            paymentExpiresAt: result.expiredAt,
          }
        : item));
    } catch (error) {
      console.error("Payment preparation failed:", error);
      setActivePaymentOrderId(null);
      setError("QRIS belum berhasil dimuat. Coba buka pembayaran lagi.");
    } finally {
      setIsPreparingPaymentOrderId(null);
    }
  };

  const closePaymentPopup = () => {
    setIsClosingPayment(true);
    window.setTimeout(() => {
      setActivePaymentOrderId(null);
      setIsClosingPayment(false);
    }, 520);
    const onboardingState = getOnboardingState();
    if (onboardingState.active && onboardingState.stage === ONBOARDING_STAGE.STATUS_CLOSE_PAYMENT) {
      advanceOnboarding(ONBOARDING_STAGE.STATUS_OPEN_RECEIPT);
      setStatusTutorialStage(ONBOARDING_STAGE.STATUS_OPEN_RECEIPT);
    }
  };

  const onCheckPayment = async () => {
    if (!activePaymentOrder?.depositId || paymentCheckCooldown > 0) {
      return;
    }

    setIsCheckingPayment(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: activePaymentOrder.id,
          depositId: activePaymentOrder.depositId,
          notifyTelegram: true,
        }),
      });
      const result = (await response.json()) as { status?: string; order?: OrderSummary; error?: string };
      if (!response.ok) {
        throw new Error("Cek transaksi gagal.");
      }

      if (result.order) {
        setOrders((current) => current.map((item) => item.id === result.order?.id ? result.order : item));
      }
      if (result.status === "success") {
        setActivePaymentOrderId(null);
        await loadOrders();
      } else if (result.status === "expired") {
        setError("QRIS-nya sudah kedaluwarsa. Buat pembayaran baru ya.");
      } else {
      }
    } catch (error) {
      console.error("Payment verification failed:", error);
      setError("Cek transaksi gagal. Coba lagi sebentar.");
    } finally {
      setIsCheckingPayment(false);
      setPaymentCheckCooldown(60);
    }
  };

  useEffect(() => {
    if (paymentCheckCooldown <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setPaymentCheckCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paymentCheckCooldown]);

  const onTutorialReceiptBackToCart = () => {
    setShowTutorialReceiptModal(false);
    const onboardingState = getOnboardingState();
    if (onboardingState.active && onboardingState.stage === ONBOARDING_STAGE.STATUS_RECEIPT_BACK_TO_CART) {
      advanceOnboarding(ONBOARDING_STAGE.CART_RETURN_STATUS);
      setStatusTutorialStage(null);
      // Instead of redirecting to the cart (/troli), keep user on status page or highlight the tutorial order
      router.push(`/status-pemesanan?${ONBOARDING_TUTORIAL_QUERY_KEY}=1&highlight=${ONBOARDING_TUTORIAL_ORDER_ID}`);
      return;
    }
    // Don't redirect to /troli from PayGate/status flows; stay on status page
    router.push(`/status-pemesanan`);
  };

  const onChangeCancelReason = (orderId: string, value: string) => {
    setCancelReasonDrafts((current) => ({
      ...current,
      [orderId]: value,
    }));

    if (
      countWords(value) >= 5 &&
      isOnboardingStageActive(ONBOARDING_STAGE.STATUS_CANCEL_REASON)
    ) {
      advanceOnboarding(ONBOARDING_STAGE.STATUS_CANCEL_SUBMIT);
      setStatusTutorialStage(ONBOARDING_STAGE.STATUS_CANCEL_SUBMIT);
    }
  };

  const onChangeConfirmationNotes = (orderId: string, value: string) => {
    setConfirmationNotes((current) => ({
      ...current,
      [orderId]: value,
    }));
  };

  const onSendConfirmationViaWhatsapp = async (order: OrderSummary) => {
    const notes = (confirmationNotes[order.id] ?? "").trim();
    
    setError("");
    setSuccess("");
    setIsConfirmationSubmittingOrderId(order.id);

    try {
      // Format product items
      const itemLines =
        order.items && order.items.length > 0
          ? order.items
              .map((item, index) => {
                const lineTotal = item.quantity * item.unitPrice;
                return `${index + 1}. ${item.productName}\n   Qty: ${item.quantity}\n   Harga: ${formatRupiah(
                  item.unitPrice,
                )}\n   Total: ${formatRupiah(lineTotal)}`;
              })
              .join("\n\n")
          : "-";

      // Build simple confirmation message
      const messageParts = [
        `Username: ${order.userName}`,
        `Email: ${order.userEmail}`,
        "",
        "*SPESIFIKASI PRODUK:*",
        itemLines,
        "",
        `*HARGA TOTAL: ${formatRupiah(order.total)}*`,
        "",
        "Mohon konfirmasi.",
      ];

      const message = messageParts.join("\n");

      // Open WhatsApp with message
      const waUrl = `https://wa.me/${CONFIRMATION_WHATSAPP_NUMBER}?text=${encodeURIComponent(
        message,
      )}`;
      
      // Create a temporary link and click it to ensure it opens
      const link = document.createElement("a");
      link.href = waUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccess(
        "Link WhatsApp dibuka. Silakan kirim pesan untuk mengkonfirmasi pesanan.",
      );
    } catch (err) {
      setError("Gagal membuka WhatsApp. Silakan coba lagi.");
      console.error("Failed to send confirmation:", err);
    } finally {
      setIsConfirmationSubmittingOrderId(null);
    }
  };

  const onRequestCancelViaWhatsapp = async (order: OrderSummary) => {
    const reason = (cancelReasonDrafts[order.id] ?? "").trim();
    const onboardingActive = getOnboardingState().active;
    if (onboardingActive && countWords(reason) < 5) {
      setError("Untuk tutorial, isi minimal 5 kata pada alasan pembatalan.");
      return;
    }
    if (!onboardingActive && reason.length < 5) {
      setError("Alasan pembatalan minimal 5 karakter.");
      return;
    }

    setError("");
    setSuccess("");

    if (onboardingActive) {
      if (isOnboardingStageActive(ONBOARDING_STAGE.STATUS_CANCEL_SUBMIT)) {
        advanceOnboarding(ONBOARDING_STAGE.STATUS_SUCCESS);
        setStatusTutorialStage(ONBOARDING_STAGE.STATUS_SUCCESS);
      }
      setSuccess("Sukses! Simulasi pengajuan pembatalan berhasil diproses.");
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

  const onCancelTransaction = async (order: OrderSummary) => {
    const reason = (cancelReasonDrafts[order.id] ?? "").trim();
    if (reason.length < 5) {
      setError("Tulis alasan pembatalan minimal 5 karakter terlebih dahulu.");
      return;
    }
    if (!window.confirm("Yakin ingin membatalkan transaksi ini?\n\nOrder akan tetap tersimpan dengan status Dibatalkan.")) {
      return;
    }

    setError("");
    setSuccess("");
    setShowCancellationSuccess(false);
    setIsDeletingOrderId(order.id);

    try {
      const response = await fetch(`/api/orders/${order.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.message ?? "Gagal membatalkan transaksi.");
        setIsDeletingOrderId(null);
        return;
      }

      setSuccess("Transaksi berhasil dibatalkan. Status order sekarang Dibatalkan.");
      setShowCancellationSuccess(true);
      await loadOrders();
    } catch (err) {
      setError("Gagal membatalkan transaksi.");
      console.error("Failed to cancel transaction:", err);
    } finally {
      setIsDeletingOrderId(null);
    }
  };

  const activePaymentOrder = displayOrders.find((order) => order.id === activePaymentOrderId) ?? null;

  useEffect(() => {
    if (!success) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSuccess("");
      setShowCancellationSuccess(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!activePaymentOrder?.paymentExpiresAt || ["paid", "sent", "cancelled"].includes(activePaymentOrder.status)) {
      setPaymentSecondsLeft(null);
      return;
    }

    const expiresAt = new Date(activePaymentOrder.paymentExpiresAt).getTime();
    if (!Number.isFinite(expiresAt)) return;

    let handled = false;
    const checkExpiry = async () => {
      const secondsLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setPaymentSecondsLeft(secondsLeft);
      if (secondsLeft > 0 || handled) return;
      handled = true;

      try {
        if (activePaymentOrder.depositId) {
          const verifyResponse = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: activePaymentOrder.id, depositId: activePaymentOrder.depositId }),
          });
          const verifyResult = (await verifyResponse.json()) as { status?: string; order?: OrderSummary };
          if (verifyResult.status === "success") {
            if (verifyResult.order) {
              setOrders((current) => current.map((item) => item.id === verifyResult.order?.id ? verifyResult.order : item));
            }
            setSuccess("Pembayaran kamu sudah masuk sebelum waktunya habis ya.");
            return;
          }
        }

        const deleteResponse = await fetch(`/api/orders/${activePaymentOrder.id}/delete`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });
        if (!deleteResponse.ok) {
          const deleteResult = (await deleteResponse.json().catch(() => null)) as { message?: string } | null;
          throw new Error(deleteResult?.message ?? "Order expired belum bisa dihapus.");
        }
        setActivePaymentOrderId(null);
        await loadOrders();
        setSuccess("Waktu QRIS habis, jadi pesanan yang belum dibayar sudah dihapus ya.");
      } catch {
        setError("Server lagi sibuk, coba lagi nanti ya!");
      }
    };

    void checkExpiry();
    const timer = window.setInterval(() => void checkExpiry(), 1000);
    return () => window.clearInterval(timer);
  }, [activePaymentOrder, loadOrders]);
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
        payIcon: "[data-onboarding='status-pay-icon']",
        receiptIcon: "[data-onboarding='status-receipt-icon']",
        paymentClose: "#status-payment-close-button",
        receiptBackToCart: "#tutorial-receipt-back-to-cart",
        cancelReason: "[data-onboarding='status-cancel-reason']",
        cancelSubmit: "[data-onboarding='status-cancel-submit']",
        pageTitle: "[data-onboarding='status-page-title']",
      };
    }

    return {
      actionIcons: `#status-action-icons-${onboardingTargetOrderId}`,
      payIcon: `#status-pay-icon-${onboardingTargetOrderId}`,
      receiptIcon: `#status-receipt-icon-${onboardingTargetOrderId}`,
      paymentClose: "#status-payment-close-button",
      receiptBackToCart: "#tutorial-receipt-back-to-cart",
      cancelReason: `#status-cancel-reason-${onboardingTargetOrderId}`,
      cancelSubmit: `#status-cancel-submit-${onboardingTargetOrderId}`,
      pageTitle: "[data-onboarding='status-page-title']",
    };
  }, [onboardingTargetOrderId]);

  useEffect(() => {
    if (!statusTutorialStage) {
      return;
    }

    const selectorByStage: Partial<Record<OnboardingStage, string>> = {
      [ONBOARDING_STAGE.STATUS_PAYMENT_OR_RECEIPT]: onboardingTargetSelectors.actionIcons,
      [ONBOARDING_STAGE.STATUS_OPEN_PAYMENT]: onboardingTargetSelectors.payIcon,
      [ONBOARDING_STAGE.STATUS_CLOSE_PAYMENT]: onboardingTargetSelectors.paymentClose,
      [ONBOARDING_STAGE.STATUS_OPEN_RECEIPT]: onboardingTargetSelectors.receiptIcon,
      [ONBOARDING_STAGE.STATUS_RECEIPT_BACK_TO_CART]: onboardingTargetSelectors.receiptBackToCart,
      [ONBOARDING_STAGE.STATUS_CANCEL_REASON]: onboardingTargetSelectors.cancelReason,
      [ONBOARDING_STAGE.STATUS_CANCEL_SUBMIT]: onboardingTargetSelectors.cancelSubmit,
      [ONBOARDING_STAGE.STATUS_SUCCESS]: onboardingTargetSelectors.cancelSubmit,
      [ONBOARDING_STAGE.STATUS_FINISH]: onboardingTargetSelectors.pageTitle,
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
          statusTutorialStage === ONBOARDING_STAGE.STATUS_CANCEL_REASON ? "end" : "center",
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [statusTutorialStage, onboardingTargetOrderId, displayOrders.length, onboardingTargetSelectors]);

  const statusTutorialSteps: Step[] = useMemo(() => {
    if (statusTutorialStage === ONBOARDING_STAGE.STATUS_OPEN_PAYMENT) {
      return [
        {
          target: onboardingTargetSelectors.payIcon,
          content: "Jika yakin ingin beli produk ini, buka QRIS lalu bayar sesuai harga produk.",
          placement: "left",
          disableBeacon: true,
          hideFooter: true,
        },
      ];
    }

    if (statusTutorialStage === ONBOARDING_STAGE.STATUS_CLOSE_PAYMENT) {
      return [
        {
          target: onboardingTargetSelectors.paymentClose,
          content: "Setelah lihat QRIS, klik Tutup untuk lanjut ke langkah struk.",
          placement: "top",
          disableBeacon: true,
          hideFooter: true,
        },
      ];
    }

    if (statusTutorialStage === ONBOARDING_STAGE.STATUS_OPEN_RECEIPT) {
      return [
        {
          target: onboardingTargetSelectors.receiptIcon,
          content: "Sekarang buka struk dan tunggu sampai struk tutorial muncul.",
          placement: "left",
          disableBeacon: true,
          hideFooter: true,
        },
      ];
    }

    if (statusTutorialStage === ONBOARDING_STAGE.STATUS_RECEIPT_BACK_TO_CART) {
      return [
        {
          target: onboardingTargetSelectors.receiptBackToCart,
          content: "Di halaman struk, klik tombol Balik ke Troli.",
          placement: "top",
          disableBeacon: true,
          hideFooter: true,
        },
      ];
    }

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
          content:
            "Jika ingin membatalkan pemesanan, isi alasan minimal 5 kata di kolom ini.",
          placement: "top",
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
          content:
            "Jika sudah oke, klik Ajukan Batal & Kirim WhatsApp untuk simulasi pembatalan.",
          placement: "top",
          disableBeacon: true,
          hideFooter: true,
        },
      ];
    }

    if (statusTutorialStage === ONBOARDING_STAGE.STATUS_SUCCESS) {
      return [
        {
          target: onboardingTargetSelectors.cancelSubmit,
          content: "Sukses! Pengajuan pembatalan tutorial berhasil. Klik Oke untuk lanjut.",
          placement: "top",
          disableBeacon: true,
          hideFooter: false,
        },
      ];
    }

    if (statusTutorialStage === ONBOARDING_STAGE.STATUS_FINISH) {
      return [
        {
          target: onboardingTargetSelectors.pageTitle,
          content:
            "Tutorial cara order selesai! Selamat berbelanja kembali. Dalam 5 detik kamu akan kembali ke halaman utama.",
          placement: "bottom",
          disableBeacon: true,
          hideFooter: true,
        },
      ];
    }

    return [];
  }, [statusTutorialStage, onboardingTargetSelectors]);

  const onStatusTutorialCallback = (payload: CallBackProps) => {
    if (
      statusTutorialStage === ONBOARDING_STAGE.STATUS_SUCCESS &&
      payload.status === "finished"
    ) {
      advanceOnboarding(ONBOARDING_STAGE.STATUS_FINISH);
      setStatusTutorialStage(ONBOARDING_STAGE.STATUS_FINISH);
      return;
    }

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
          <button
            type="button"
            className={styles.profileButton}
            onClick={() => router.push("/profil")}
            title="Buka profil"
            aria-label="Buka profil"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={session?.user?.image || "/assets/maintenancelogo.jpg"}
              alt="Profil"
            />
          </button>
          <div>
            <h1 data-onboarding="status-page-title">Status Pemesanan</h1>
            <p>Riwayat transaksi akun kamu</p>
          </div>
        </div>
        <Link href="/troli" className={styles.backLink}>
          Balik ke Troli
        </Link>
      </header>

      <section ref={summaryCardRef} className={styles.summaryCard}>
        <div>
          <span>Total pesanan</span>
          <strong>{displayOrders.length}</strong>
        </div>
        <div>
          <span>Proses</span>
          <strong>{orderStatusCounts.process}</strong>
        </div>
        <div>
          <span>Sudah Bayar</span>
          <strong>{orderStatusCounts.done}</strong>
        </div>
        <div>
          <span>Belum Bayar</span>
          <strong>{orderStatusCounts.error}</strong>
        </div>
        <div>
          <span>Total belanja</span>
          <strong>{formatRupiah(displayTotalBelanja)}</strong>
        </div>
        <div className={styles.summaryHistoryAction}>
          <button
            type="button"
            className={styles.clearHistoryIconButton}
            onClick={() => {
              setSelectedHistoryIds([]);
              setHistoryFilter("all");
              setShowHistoryCleaner(true);
            }}
            title="Hapus Riwayat Pemesanan"
            aria-label="Hapus Riwayat Pemesanan"
          >
            <TrashIcon />
          </button>
        </div>
      </section>

      <section className={styles.donationHistorySection} aria-labelledby="donation-history-title">
        <div className={styles.donationHistoryHeader}>
          <h2 id="donation-history-title">Riwayat Donasi</h2>
          <strong>{formatRupiah(donationHistory.reduce((total, entry) => total + entry.amount, 0))}</strong>
        </div>
        {donationHistory.length > 0 ? (
          <div className={styles.donationHistoryList}>
            {donationHistory.map(({ order, item, amount }) => (
              <div key={`${order.id}-${item.productId}`} className={styles.donationHistoryItem}>
                <span>{item.productName}</span>
                <strong>{formatRupiah(amount)}</strong>
                <small>{new Date(order.createdAt).toLocaleString("id-ID")}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.donationHistoryEmpty}>Belum ada Riwayat Donasi, Yuk donasi sekarang</p>
        )}
      </section>

      {isLoading ? <WaitLoading centered /> : null}
      {error ? <p className={styles.errorText}>{error}</p> : null}
      {success && !showCancellationSuccess && typeof document !== "undefined" ? createPortal(
        <div className={styles.successToastOverlay} role="status" aria-live="polite">
          <div className={styles.successToast}>
            <div className={styles.successCheck} aria-hidden="true">✓</div>
            <div>
              <strong>Berhasil</strong>
              <p>{success}</p>
            </div>
          </div>
        </div>
      , document.body) : null}
      {paymentSuccessPopup && typeof document !== "undefined" ? createPortal(
        <div className={styles.paymentSuccessOverlay} role="alertdialog" aria-modal="true">
          <section className={styles.paymentSuccessCard}>
            <div className={styles.paymentSuccessCheck} aria-hidden="true">✓</div>
            <h2>Pembayaran Berhasil</h2>
            <p>Pembayaran sudah <strong>Rp {paymentSuccessPopup.amount.toLocaleString("id-ID")}</strong> kamu dikonfirmasi!</p>
            <button type="button" className={styles.popupCloseButton} onClick={() => setPaymentSuccessPopup(null)}>OKE!</button>
          </section>
        </div>,
        document.body,
      ) : null}
      {showCancellationSuccess && typeof document !== "undefined" ? createPortal(
        <div className={styles.successToastOverlay} role="status" aria-live="polite">
          <div className={styles.successToast}>
            <div className={styles.successCheck} aria-hidden="true">✓</div>
            <div>
              <strong>Transaksi dibatalkan</strong>
              <p>QRIS berhasil dibatalkan. Order tidak lagi aktif di status pemesanan.</p>
            </div>
          </div>
        </div>
      , document.body) : null}

      {showHistoryCleaner && typeof document !== "undefined" ? createPortal(
        <div className={styles.historyOverlay} role="dialog" aria-modal="true" aria-labelledby="history-cleaner-title">
          <section className={styles.historyModal}>
            <div className={styles.historyModalHeader}>
              <div>
                <h2 id="history-cleaner-title">Bersihkan Riwayat</h2>
                <p>Pilih status atau pesanan yang ingin dihapus permanen.</p>
              </div>
              <button type="button" className={styles.modalCloseButton} onClick={() => setShowHistoryCleaner(false)} aria-label="Tutup bersihkan riwayat">×</button>
            </div>
            <div className={styles.historyFilters}>
              {([
                ["all", "Semua", historyCandidates.length],
                ["process", "Sedang diproses", orderStatusCounts.process],
                ["done", "Sudah Bayar", orderStatusCounts.done],
                ["error", "Belum Bayar", orderStatusCounts.error],
              ] as const).map(([value, label, count]) => (
                <button key={value} type="button" className={historyFilter === value ? styles.historyFilterActive : styles.historyFilter} onClick={() => setHistoryFilter(value)}>
                  {label} ({count})
                </button>
              ))}
            </div>
            <button type="button" className={styles.selectAllHistoryButton} onClick={selectAllFilteredHistory} disabled={filteredHistoryCandidates.length === 0}>
              Pilih semua yang tampil ({filteredHistoryCandidates.length})
            </button>
            <div className={styles.historySelectionList}>
              {filteredHistoryCandidates.length > 0 ? filteredHistoryCandidates.map((order) => (
                <label key={order.id} className={styles.historySelectionItem}>
                  <input type="checkbox" checked={selectedHistoryIds.includes(order.id)} onChange={() => toggleHistorySelection(order.id)} />
                  <span><strong>{statusLabel(order.status)}</strong><small>{order.id} · {formatRupiah(order.total)}</small></span>
                </label>
              )) : <p className={styles.historyEmpty}>Tidak ada riwayat pada filter ini.</p>}
            </div>
            <div className={styles.historyModalActions}>
              <button type="button" className={styles.historyCancelButton} onClick={() => setShowHistoryCleaner(false)}>Batal</button>
              <button type="button" className={styles.historyDeleteButton} onClick={() => void clearSelectedHistory()} disabled={selectedHistoryIds.length === 0 || isClearingHistory}>
                {isClearingHistory ? <span className={styles.buttonSpinner} aria-label="Menghapus riwayat" /> : `Hapus ${selectedHistoryIds.length} riwayat`}
              </button>
            </div>
          </section>
        </div>
      , document.body) : null}

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
              {order.status !== "paid" && order.cancelRequestStatus !== "confirmed" ? (
                <div className={styles.cancelRequestBox}>
                  <textarea
                    value={confirmationNotes[order.id] ?? ""}
                    onChange={(event) => onChangeConfirmationNotes(order.id, event.target.value)}
                    onInput={(event) =>
                      onChangeConfirmationNotes(order.id, (event.target as HTMLTextAreaElement).value)
                    }
                    placeholder="Tulis catatan atau komentar (opsional)"
                    spellCheck={false}
                    data-onboarding={isOnboardingTargetOrder ? "status-cancel-reason" : undefined}
                    id={isOnboardingTargetOrder ? `status-cancel-reason-${order.id}` : undefined}
                  />
                  <button
                    type="button"
                    className={styles.adminConfirmationButton}
                    disabled={isConfirmationSubmittingOrderId === order.id}
                    onClick={() => onSendConfirmationViaWhatsapp(order)}
                    data-onboarding={isOnboardingTargetOrder ? "status-cancel-submit" : undefined}
                    id={isOnboardingTargetOrder ? `status-cancel-submit-${order.id}` : undefined}
                  >
                    {isConfirmationSubmittingOrderId === order.id
                      ? "Mengirim..."
                      : "Konfirmasi Pemesanan & Kirim Admin"}
                  </button>
                </div>
              ) : null}
              <div
                className={styles.actionIcons}
                data-onboarding={isOnboardingTargetOrder ? "status-action-icons" : undefined}
                id={isOnboardingTargetOrder ? `status-action-icons-${order.id}` : undefined}
              >
                {statusGroup(order.status) === "process" && !isPaymentExpired(order) ? <button
                  type="button"
                  className={styles.payIconButton}
                  onClick={() => void onOpenPayment(order.id)}
                  disabled={isPreparingPaymentOrderId === order.id}
                  title="Lihat QRIS pembayaran"
                  aria-label={`Lihat QRIS pembayaran order ${order.id}`}
                  data-onboarding={isOnboardingTargetOrder ? "status-pay-icon" : undefined}
                  id={isOnboardingTargetOrder ? `status-pay-icon-${order.id}` : undefined}
                >
                  <PaymentIcon />
                </button> : null}
                {statusGroup(order.status) === "paid" || statusGroup(order.status) === "done" ? (
                  <button
                    type="button"
                    className={styles.receiptIconButton}
                    onClick={() => onDownloadReceipt(order.id)}
                    title="Buka struk pembayaran"
                    aria-label={`Buka struk pembayaran order ${order.id}`}
                    data-onboarding={isOnboardingTargetOrder ? "status-receipt-icon" : undefined}
                    id={isOnboardingTargetOrder ? `status-receipt-icon-${order.id}` : undefined}
                  >
                    <ReceiptIcon />
                  </button>
                ) : null}
                {order.status === "process" && (
                  <button
                    type="button"
                    className={styles.cancelTransactionButton}
                    onClick={() => onCancelTransaction(order)}
                    disabled={isDeletingOrderId === order.id}
                    title="Batalkan transaksi dan QRIS"
                    aria-label={`Batalkan transaksi dan QRIS order ${order.id}`}
                  >
                    {isDeletingOrderId === order.id ? (
                      <span className={styles.buttonSpinner} aria-label="Membatalkan transaksi" />
                    ) : "✕"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {!isLoading && displayOrders.length === 0 ? <p className={styles.emptyText}>Belum ada pesanan.</p> : null}
      </section>

      <section className={styles.listWrap}>
        <h2 className={styles.sectionTitle}>Lamaran Pekerjaan</h2>
        {jobApplications.map((application) => (
          <article key={application.id} className={styles.orderCard}>
            <div className={styles.orderMain}>
              <p className={styles.orderId}>{application.product_name}</p>
              <span className={styles.orderDate}>{new Date(application.created_at).toLocaleString("id-ID")}</span>
              <span className={`${styles.statusBadge} ${styles.statusProcess}`}>Aktif</span>
            </div>
            <div className={styles.orderMeta}>
              <span>ID Lamaran: {application.id}</span>
              <span>Dilamar pada: {new Date(application.created_at).toLocaleString("id-ID")}</span>
            </div>
            <div className={styles.actionIcons}>
              <button
                type="button"
                className={styles.cancelRequestButton}
                onClick={() => onCancelJobApplication(application.id)}
                title="Batalkan lamaran"
                aria-label={`Batalkan lamaran untuk ${application.product_name}`}
              >
                Batalkan Lamaran
              </button>
            </div>
          </article>
        ))}
        {!isLoading && jobApplications.length === 0 ? <p className={styles.emptyText}>Belum ada lamaran pekerjaan.</p> : null}
      </section>

      {activePaymentOrder && typeof document !== "undefined"
        ? createPortal(
        <div className={styles.popupOverlay} onClick={closePaymentPopup}>
          <section className={`${styles.popupCard} ${isClosingPayment ? styles.popupCardExiting : styles.popupCardEntering}`} onClick={(event) => event.stopPropagation()}>
            <h2>Pembayaran QRISS</h2>
            <p className={styles.popupMeta}>
              <strong>Tunggu konfirmasi pembayaran kamu dari admin ya.</strong>
            </p>
            {paymentSecondsLeft !== null ? (
              <p className={styles.popupCountdown}>
                Sisa waktu QRIS: {Math.floor(paymentSecondsLeft / 60)}:{String(paymentSecondsLeft % 60).padStart(2, "0")}
              </p>
            ) : null}
            <div className={styles.popupQrWrap}>
              {isPreparingPaymentOrderId === activePaymentOrder.id ? (
                <span className={styles.paymentQrSpinner} role="status" aria-label="Menyiapkan pembayaran" />
              ) : activePaymentOrder.qrCode ? (
                <QRCode
                  value={activePaymentOrder.qrCode}
                  size={260}
                  level="H"
                  includeMargin
                />
              ) : activePaymentOrder.qrImage ? (
                <Image
                  src={activePaymentOrder.qrImage}
                  alt="QRIS Pembayaran"
                  fill
                  className={styles.popupQrImage}
                  unoptimized
                  onError={() => {
                    console.error("Failed to load QR image");
                  }}
                />
              ) : null}
            </div>
            {activePaymentOrder.totalAmount && (
              <p className={styles.popupAmount}>
                Jumlah bayar: Rp {activePaymentOrder.totalAmount.toLocaleString("id-ID")}
              </p>
            )}
            <button
              type="button"
              className={`${styles.popupCloseButton} ${isCheckingPayment ? styles.popupButtonGlitch : ""}`}
              onClick={onCheckPayment}
              disabled={isCheckingPayment || paymentCheckCooldown > 0}
              id="status-payment-close-button"
            >
              {isCheckingPayment
                ? "Mengecek..."
                : paymentCheckCooldown > 0
                  ? `Cek Transaksi (${paymentCheckCooldown}s)`
                  : "Cek Transaksi"}
            </button>
            <button
              type="button"
              className={styles.popupCloseIcon}
              onClick={closePaymentPopup}
              aria-label="Tutup pembayaran"
            >
              ×
            </button>
          </section>
        </div>,
        document.body,
      )
        : null}

      {showTutorialReceiptModal ? (
        <div className={styles.popupOverlay}>
          <section className={styles.popupCard}>
            <h2>Struk Pembayaran (Tutorial)</h2>
            <p className={styles.popupMeta}>Order: {ONBOARDING_TUTORIAL_ORDER_ID}</p>
            <p className={styles.popupHelp}>
              Struk tutorial sudah muncul. Setelah ini kembali ke troli untuk lanjut langkah
              berikutnya.
            </p>
            <button
              type="button"
              className={styles.popupCloseButton}
              id="tutorial-receipt-back-to-cart"
              onClick={onTutorialReceiptBackToCart}
            >
              Balik ke Troli
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
