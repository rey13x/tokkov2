"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { gsap } from "gsap";
import { useMaintenanceMode } from "@/lib/maintenance-mode";
import styles from "./MaintenanceModal.module.css";

export default function MaintenanceModal() {
  const router = useRouter();
  const pathname = usePathname();
  const guideRef = useRef<HTMLDivElement | null>(null);
  const { settings, isMaintenanceEnabled, isMaintenanceActive, acknowledgeMaintenance } =
    useMaintenanceMode();

  useEffect(() => {
    if (!isMaintenanceActive || !guideRef.current) {
      return;
    }

    // Animate guide instructions
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-guide-item]",
        { x: -20, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.2,
          ease: "power2.out",
        }
      );

      // Pulse animation for guide title
      gsap.to("[data-guide-title]", {
        scale: 1.05,
        duration: 0.8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }, guideRef);

    return () => ctx.revert();
  }, [isMaintenanceActive]);

  if (!settings || !isMaintenanceEnabled || pathname?.startsWith("/admin")) {
    return null;
  }

  const openTestimoni = () => {
    router.push("/book-spirit?maintenanceGuide=1");
  };

  return (
    <>
      {isMaintenanceActive ? (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="maintenance-title">
          <div className={styles.modal}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/maintenancelogo.jpg"
              alt="Maintenance Tokko Marketplace"
              className={styles.logo}
            />
            <h1 id="maintenance-title" className={styles.title}>
              Website sedang dalam Pemeliharaan
            </h1>
            <p className={styles.message}>
              Hi! Tokkers Website sedang dalam Pemeliharaan. Tenang.. kamu tetap bisa melihat
              tampilan website kami
            </p>
            <p className={styles.brand}>- Tokko Marketplace</p>

            {/* Animated Guide Instructions */}
            <div
              ref={guideRef}
              style={{
                marginBottom: "24px",
                padding: "16px",
                background: "rgba(255, 255, 255, 0.7)",
                borderRadius: "12px",
                border: "2px solid #11151E",
                textAlign: "left",
              }}
            >
              <div data-guide-title style={{ fontWeight: "700", marginBottom: "12px", fontSize: "0.9rem" }}>
                📍 Panduan Akses:
              </div>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <li
                  data-guide-item
                  style={{
                    fontSize: "0.85rem",
                    color: "#4c5260",
                    paddingLeft: "20px",
                    position: "relative",
                  }}
                >
                  <span style={{ position: "absolute", left: 0 }}>✓</span>
                  Lihat koleksi produk kami
                </li>
                <li
                  data-guide-item
                  style={{
                    fontSize: "0.85rem",
                    color: "#4c5260",
                    paddingLeft: "20px",
                    position: "relative",
                  }}
                >
                  <span style={{ position: "absolute", left: 0 }}>✓</span>
                  Baca testimoni dari Tokkers
                </li>
                <li
                  data-guide-item
                  style={{
                    fontSize: "0.85rem",
                    color: "#4c5260",
                    paddingLeft: "20px",
                    position: "relative",
                  }}
                >
                  <span style={{ position: "absolute", left: 0 }}>✓</span>
                  Chat dengan kami di testimoni
                </li>
              </ul>
            </div>

            <button type="button" className={styles.primaryButton} onClick={acknowledgeMaintenance}>
              Paham
            </button>
          </div>
        </div>
      ) : null}

      {!isMaintenanceActive ? (
        <button type="button" className={styles.notice} onClick={openTestimoni}>
          <strong>!Maintenance</strong>
          <span>Mengobrollah dengan kami di Testimoni!</span>
        </button>
      ) : null}
    </>
  );
}
