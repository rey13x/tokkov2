"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useMaintenanceMode } from "@/lib/maintenance-mode";
import styles from "./MaintenanceModal.module.css";

export default function MaintenanceModal() {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const logoRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);

  const { settings, isMaintenanceEnabled, isMaintenanceActive, acknowledgeMaintenance } =
    useMaintenanceMode();

  // Handle circular animation when modal opens
  useEffect(() => {
    if (!isMaintenanceActive || !logoRef.current || !textRef.current) {
      return;
    }

    const ctx = gsap.context(() => {
      // Fade in overlay
      gsap.fromTo(
        "[data-maintenance-overlay]",
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: "power2.inOut" }
      );

      // Circular expands from center
      gsap.fromTo(
        "[data-logo-circle]",
        { scale: 0, x: 0, opacity: 0 },
        {
          scale: 1,
          x: 0,
          opacity: 1,
          duration: 1.2,
          ease: "back.out",
          delay: 0.3,
        }
      );

      // Text fades in after circle settles
      gsap.fromTo(
        "[data-text-content]",
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power2.out",
          delay: 1,
        }
      );

      // Don't auto close - wait for user to click Paham button
      return () => {};
    }, modalRef);

    return () => ctx.revert();
  }, [isMaintenanceActive, acknowledgeMaintenance]);

  if (!settings || !isMaintenanceEnabled) {
    return null;
  }

  const handlePahamClick = () => {
    gsap.to("[data-maintenance-overlay]", {
      opacity: 0,
      duration: 0.5,
      ease: "power2.inOut",
      onComplete: () => {
        acknowledgeMaintenance();
      },
    });
  };

  return (
    <>
      {isMaintenanceActive ? (
        <div
          ref={modalRef}
          className={styles.fullscreen}
          data-maintenance-overlay
          role="dialog"
          aria-modal="true"
        >
          {/* Non-clickable overlay with pointer-events: none */}
          <div className={styles.nonClickableOverlay} />

          {/* Content Container - clickable only for Paham button */}
          <div className={styles.contentContainer}>
            {/* Circular Logo with animation */}
            <div ref={logoRef} data-logo-circle className={styles.logCircle}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/maintenancelogo.jpg"
                alt="Maintenance"
                className={styles.logoImage}
              />
            </div>

            {/* Text Content */}
            <div ref={textRef} data-text-content className={styles.textContent}>
              <h1 className={styles.mainTitle}>
                {settings.maintenanceTitle || "Website Sedang Menjalani Pemeliharaan"}
              </h1>
              <p className={styles.subtitle}>
                {settings.maintenanceSubtitle ||
                  "Kami sedang melakukan pemeliharaan sistem untuk meningkatkan kualitas layanan. Website akan kembali online dalam waktu singkat. Anda tetap dapat melihat tampilan website kami."}
              </p>
              <p className={styles.brand}>- Tokko Marketplace</p>

              {/* Paham Button - only clickable element */}
              <button
                type="button"
                className={styles.pahamButton}
                onClick={handlePahamClick}
                style={{ pointerEvents: "auto" }}
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
