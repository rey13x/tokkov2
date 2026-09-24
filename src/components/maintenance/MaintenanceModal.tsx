"use client";

import { useEffect, useRef } from "react";
import { useMaintenanceMode } from "@/lib/maintenance-mode";
import styles from "./MaintenanceModal.module.css";

export default function MaintenanceModal() {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const { settings, isMaintenanceActive, acknowledgeMaintenance } = useMaintenanceMode();

  useEffect(() => {
    if (!isMaintenanceActive || !textRef.current) return;
    textRef.current.classList.add(styles.contentVisible);
    return () => textRef.current?.classList.remove(styles.contentVisible);
  }, [isMaintenanceActive]);

  if (!settings || !isMaintenanceActive) return null;

  return (
    <div ref={modalRef} className={styles.fullscreen} data-maintenance-overlay role="dialog" aria-modal="true">
      <div className={styles.nonClickableOverlay} />
      <div className={styles.contentContainer}>
        <video
          className={styles.logoVideo}
          src="/assets/sobatpremium2.mp4"
          autoPlay
          loop
          muted
          playsInline
          aria-label="Sobat Premium"
        />
        <div ref={textRef} className={styles.textContent}>
          <h1 className={styles.mainTitle}>
            {settings.maintenanceTitle || "Website Sedang Dalam Pemeliharaan"}
          </h1>
          <p className={styles.subtitle}>
            {settings.maintenanceSubtitle || settings.message || "Website sedang disiapkan. Silakan kembali beberapa saat lagi."}
          </p>
          <p className={styles.brand}>Sobat Premium</p>
          <button type="button" className={styles.pahamButton} onClick={acknowledgeMaintenance}>
            Oke Sobat
          </button>
        </div>
      </div>
    </div>
  );
}
