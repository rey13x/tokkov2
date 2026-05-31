"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
// @ts-ignore - qrcode.react doesn't have type definitions
import QRCode from "qrcode.react";
import styles from "./PaymentQRModal.module.css";

interface PaymentQRModalProps {
  orderId: string;
  depositId: string;
  qrString: string;
  amount: number;
  isOpen: boolean;
  onClose: () => void;
  onPaymentVerified: (success: boolean) => void;
}

export function PaymentQRModal({
  orderId,
  depositId,
  qrString,
  amount,
  isOpen,
  onClose,
  onPaymentVerified,
}: PaymentQRModalProps) {
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes = 300 seconds
  const [isVerifying, setIsVerifying] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<
    "pending" | "paid" | "expired"
  >("pending");

  // Format countdown timer
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  // Countdown timer effect
  useEffect(() => {
    if (!isOpen || paymentStatus !== "pending") return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setPaymentStatus("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, paymentStatus]);

  // Reset timer when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeLeft(300);
      setPaymentStatus("pending");
      setShowNotification(false);
    }
  }, [isOpen]);

  const handleCheckTransaction = useCallback(async () => {
    if (paymentStatus !== "pending") return;

    setIsVerifying(true);
    setShowNotification(false);

    try {
      const response = await fetch("/api/payments/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId, depositId }),
      });

      const data = await response.json();

      if (data.status === "success") {
        setPaymentStatus("paid");
        setShowNotification(false);
        // Auto-download file after payment verification
        setTimeout(() => {
          onPaymentVerified(true);
          onClose();
        }, 1000);
      } else if (data.status === "expired") {
        setPaymentStatus("expired");
        setShowNotification(false);
      } else {
        // Still pending
        setPaymentStatus("pending");
        setShowNotification(true); // Show "segera scan dan bayar" notification
      }
    } catch (error) {
      console.error("Error verifying payment:", error);
      setShowNotification(true);
    } finally {
      setIsVerifying(false);
    }
  }, [paymentStatus, orderId, depositId, onPaymentVerified, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>QRIS Pembayaran</h2>
          <span className={styles.orderInfo}>Order {orderId}</span>
        </div>

        {/* QR Code Section */}
        <div className={styles.qrContainer}>
          {paymentStatus === "expired" ? (
            <div className={styles.expiredMessage}>
              <p>QR Code telah kadaluarsa</p>
              <p className={styles.subText}>Silakan buat pesanan baru</p>
            </div>
          ) : (
            <>
              <div className={styles.qrWrapper}>
                <QRCode
                  value={qrString}
                  size={256}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className={styles.qrInstructions}>
                Scan QRIS lalu simpulkan bukti transfer
              </p>
            </>
          )}
        </div>

        {/* Amount Section */}
        <div className={styles.amountSection}>
          <p className={styles.label}>Total Pembayaran</p>
          <p className={styles.amount}>
            Rp {amount.toLocaleString("id-ID")}
          </p>
        </div>

        {/* Countdown Timer */}
        {paymentStatus === "pending" && (
          <div className={styles.timerSection}>
            <p className={styles.timerLabel}>Waktu Berlaku:</p>
            <p
              className={`${styles.timer} ${
                timeLeft < 60 ? styles.timerWarning : ""
              }`}
            >
              {formattedTime}
            </p>
          </div>
        )}

        {/* Notification */}
        {showNotification && paymentStatus === "pending" && (
          <div className={styles.notification}>
            <p className={styles.notificationText}>
              ⚠️ Segera scan dan bayar QRIS diatas
            </p>
          </div>
        )}

        {/* Status Message */}
        {paymentStatus === "paid" && (
          <div className={styles.successMessage}>
            <p>✓ Pembayaran berhasil!</p>
            <p className={styles.subText}>File akan diunduh secara otomatis</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className={styles.buttonGroup}>
          {paymentStatus === "paid" ? (
            <button className={`${styles.button} ${styles.successButton}`}>
              Terima Kasih
            </button>
          ) : paymentStatus === "expired" ? (
            <>
              <button
                className={`${styles.button} ${styles.dangerButton}`}
                onClick={onClose}
              >
                Tutup
              </button>
              <button className={`${styles.button} ${styles.primaryButton}`}>
                Buat Pesanan Baru
              </button>
            </>
          ) : (
            <>
              <button
                className={`${styles.button} ${styles.primaryButton}`}
                onClick={handleCheckTransaction}
                disabled={isVerifying}
              >
                {isVerifying ? "Mengecek..." : "Cek Transaksi"}
              </button>
              <button
                className={`${styles.button} ${styles.secondaryButton}`}
                onClick={onClose}
              >
                Tutup
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
